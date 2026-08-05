"""API do modulo NFP – Creditos."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import (
    NfpAgenteCaptadorDB,
    NfpBatimentoDB,
    NfpCnpjLojaDB,
    NfpDoadorDB,
    NfpRateioDB,
)
from nfp_service import (
    _bool_payload,
    _int_percentual,
    _texto_opcional,
    aplicar_endereco,
    calcular_rateio,
    exportar_rateio_xlsx,
    garantir_agentes_padrao,
    importar_cnpjs,
    importar_doacoes_sefaz,
    importar_doadores,
    importar_sefaz_creditos,
    listar_agentes_captacao,
    proximo_numero_cadastro_agente,
    proximo_numero_cadastro_cnpj,
    proximo_numero_cadastro_doador,
    relatorio_rateio_consolidado,
    relatorio_rateio_detalhado,
    listar_origens_rateio,
    resumo_dashboard,
    serializar_agente,
    serializar_cnpj,
    serializar_doador,
    sincronizar_doadores_de_doacoes,
    ORIGEM_DOADOR_MANUAL,
)
from nfp_utils import (
    AGENTES_CAPTACAO_PADRAO,
    CAPTADORES_PADRAO,
    cnpj_valido,
    cpf_valido,
    limpar_documento,
    nome_loja_para_cadastro,
    normalizar_agente_captacao,
    percentual_agente_padrao,
    NOME_GENERICO_CONFERIR,
)
from security import (
    get_usuario_logado,
    usuario_eh_adm_global,
    usuario_pode_acessar_nfp,
)
from time_operacional import agora_operacional_naive

router = APIRouter(prefix="/api/nfp", tags=["NFP – Créditos"])


def _exigir_nfp(usuario_atual: dict) -> None:
    if not usuario_pode_acessar_nfp(usuario_atual):
        raise HTTPException(status_code=403, detail="Acesso restrito ao modulo NFP – Creditos.")


def _organizacao_id(usuario_atual: dict) -> str:
    org = usuario_atual.get("organizacao_id")
    if org:
        return str(org)
    raise HTTPException(status_code=400, detail="Usuario sem organizacao vinculada.")


async def _obter_agente_org(db: AsyncSession, org: str, agente_id: str) -> NfpAgenteCaptadorDB:
    row = await db.get(NfpAgenteCaptadorDB, agente_id)
    if not row or row.organizacao_id != org:
        raise HTTPException(status_code=404, detail="Agente nao encontrado.")
    return row


async def _obter_doador_org(db: AsyncSession, org: str, doador_id: str) -> NfpDoadorDB:
    row = await db.get(NfpDoadorDB, doador_id)
    if not row or row.organizacao_id != org:
        raise HTTPException(status_code=404, detail="Doador nao encontrado.")
    return row


async def _obter_cnpj_org(db: AsyncSession, org: str, cnpj_id: str) -> NfpCnpjLojaDB:
    row = await db.get(NfpCnpjLojaDB, cnpj_id)
    if not row or row.organizacao_id != org:
        raise HTTPException(status_code=404, detail="CNPJ/loja nao encontrado.")
    return row


def _aplicar_agente_payload(row: NfpAgenteCaptadorDB, payload: dict, *, criando: bool) -> None:
    codigo = normalizar_agente_captacao(payload.get("codigo") or row.codigo)
    if not codigo:
        raise HTTPException(status_code=400, detail="Codigo do agente obrigatorio.")
    tipo = (payload.get("tipo") or row.tipo or "PJ").strip().upper()
    if tipo not in {"PF", "PJ"}:
        raise HTTPException(status_code=400, detail="Tipo deve ser PF ou PJ.")
    nome = (payload.get("nome") or row.nome or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome obrigatorio.")

    cpf = limpar_documento(payload.get("cpf")) if "cpf" in payload or criando else (row.cpf or "")
    cnpj = limpar_documento(payload.get("cnpj")) if "cnpj" in payload or criando else (row.cnpj or "")
    if tipo == "PF":
        if cpf and not cpf_valido(cpf):
            raise HTTPException(status_code=400, detail="CPF invalido.")
        cnpj = None
    else:
        if cnpj and not cnpj_valido(cnpj):
            raise HTTPException(status_code=400, detail="CNPJ invalido.")
        cpf = None

    row.codigo = codigo
    row.tipo = tipo
    row.nome = nome
    row.nome_fantasia = _texto_opcional(payload.get("nome_fantasia")) if "nome_fantasia" in payload or criando else row.nome_fantasia
    row.cpf = cpf or None
    row.cnpj = cnpj or None
    if "email" in payload or criando:
        row.email = _texto_opcional(payload.get("email"))
    if "telefone" in payload or criando:
        row.telefone = _texto_opcional(payload.get("telefone"))
    if "percentual_agente" in payload or criando:
        default_pct = percentual_agente_padrao(codigo)
        row.percentual_agente = _int_percentual(payload.get("percentual_agente"), default_pct)
    if "ativo" in payload or criando:
        row.ativo = _bool_payload(payload.get("ativo"), True)
    if "observacoes" in payload or criando:
        row.observacoes = _texto_opcional(payload.get("observacoes"))
    aplicar_endereco(row, payload)
    row.atualizado_em = agora_operacional_naive()


def _aplicar_doador_payload(row: NfpDoadorDB, payload: dict, *, criando: bool) -> None:
    nome = (payload.get("nome") or row.nome or "").strip()
    cpf = limpar_documento(payload.get("cpf") if "cpf" in payload or criando else row.cpf)
    if not nome or not cpf:
        raise HTTPException(status_code=400, detail="Nome e CPF obrigatorios.")
    if not cpf_valido(cpf):
        raise HTTPException(status_code=400, detail="CPF invalido.")
    row.nome = nome
    row.cpf = cpf
    if "email" in payload or criando:
        row.email = _texto_opcional(payload.get("email"))
    if "telefone" in payload or criando:
        row.telefone = _texto_opcional(payload.get("telefone"))
    if "data_nascimento" in payload or criando:
        row.data_nascimento = _texto_opcional(payload.get("data_nascimento"))
    if "unidade_captador" in payload or criando:
        unidade = _texto_opcional(payload.get("unidade_captador"))
        row.unidade_captador = normalizar_agente_captacao(unidade) if unidade else None
    if "ativo" in payload or criando:
        row.ativo = _bool_payload(payload.get("ativo"), True)
    if "observacoes" in payload or criando:
        row.observacoes = _texto_opcional(payload.get("observacoes"))
    if criando and not getattr(row, "origem_cadastro", None):
        row.origem_cadastro = ORIGEM_DOADOR_MANUAL
    aplicar_endereco(row, payload)
    row.atualizado_em = agora_operacional_naive()


def _aplicar_cnpj_payload(row: NfpCnpjLojaDB, payload: dict, *, criando: bool) -> None:
    cnpj = limpar_documento(payload.get("cnpj") if "cnpj" in payload or criando else row.cnpj)
    if not cnpj:
        raise HTTPException(status_code=400, detail="CNPJ obrigatorio.")
    if not cnpj_valido(cnpj):
        raise HTTPException(status_code=400, detail="CNPJ invalido.")
    loja_informada = payload.get("loja") if "loja" in payload or criando else row.loja
    loja = nome_loja_para_cadastro(cnpj, loja_informada)
    captador_raw = payload.get("captador") if "captador" in payload or criando else row.captador
    captador = normalizar_agente_captacao(captador_raw) or "DIEGO"

    row.cnpj = cnpj
    row.loja = loja
    row.captador = captador
    row.cnpj_conferir = loja == NOME_GENERICO_CONFERIR or bool(payload.get("cnpj_conferir"))
    if "razao_social" in payload or criando:
        row.razao_social = _texto_opcional(payload.get("razao_social"))
    if "inscricao_estadual" in payload or criando:
        row.inscricao_estadual = _texto_opcional(payload.get("inscricao_estadual"))
    if "email" in payload or criando:
        row.email = _texto_opcional(payload.get("email"))
    if "telefone" in payload or criando:
        row.telefone = _texto_opcional(payload.get("telefone"))
    if "ativo" in payload or criando:
        row.ativo = _bool_payload(payload.get("ativo"), True)
    if "observacoes" in payload or criando:
        row.observacoes = _texto_opcional(payload.get("observacoes"))
    aplicar_endereco(row, payload)
    row.atualizado_em = agora_operacional_naive()


@router.get("/me/acesso")
async def nfp_acesso(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    agentes = await listar_agentes_captacao(db, org)
    return {
        "pode_acessar": usuario_pode_acessar_nfp(usuario_atual),
        "somente_nfp": usuario_eh_adm_global(usuario_atual),
        "captadores_padrao": CAPTADORES_PADRAO,
        "agentes_captacao": agentes,
        "agentes_captacao_padrao": list(AGENTES_CAPTACAO_PADRAO),
        "nome_generico_conferir": NOME_GENERICO_CONFERIR,
    }


@router.get("/dashboard")
async def nfp_dashboard(
    competencia: Optional[str] = Query(None),
    agente: Optional[str] = Query(None, description="Agente de captacao (ex.: DIEGO)"),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    return await resumo_dashboard(
        db,
        _organizacao_id(usuario_atual),
        competencia,
        agente=agente,
    )


@router.get("/agentes")
async def listar_agentes(
    busca: Optional[str] = None,
    ativo: Optional[bool] = None,
    limite: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    await garantir_agentes_padrao(db, org)
    q = select(NfpAgenteCaptadorDB).where(NfpAgenteCaptadorDB.organizacao_id == org).order_by(
        NfpAgenteCaptadorDB.numero_cadastro, NfpAgenteCaptadorDB.codigo
    )
    if ativo is not None:
        q = q.where(NfpAgenteCaptadorDB.ativo.is_(ativo))
    if busca:
        termo = f"%{busca.strip()}%"
        q = q.where(
            (NfpAgenteCaptadorDB.codigo.ilike(termo))
            | (NfpAgenteCaptadorDB.nome.ilike(termo))
            | (NfpAgenteCaptadorDB.nome_fantasia.ilike(termo))
            | (NfpAgenteCaptadorDB.cpf.ilike(termo))
            | (NfpAgenteCaptadorDB.cnpj.ilike(termo))
        )
    rows = (await db.execute(q.offset(offset).limit(limite))).scalars().all()
    return [serializar_agente(r) for r in rows]


@router.post("/agentes/garantir-padrao")
async def post_garantir_agentes_padrao(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    return await garantir_agentes_padrao(db, _organizacao_id(usuario_atual))


@router.get("/agentes/{agente_id}")
async def obter_agente(
    agente_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    row = await _obter_agente_org(db, _organizacao_id(usuario_atual), agente_id)
    return serializar_agente(row)


@router.post("/agentes")
async def criar_agente(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    codigo = normalizar_agente_captacao(payload.get("codigo"))
    if not codigo:
        raise HTTPException(status_code=400, detail="Codigo do agente obrigatorio.")
    existe = (
        await db.execute(
            select(NfpAgenteCaptadorDB).where(
                NfpAgenteCaptadorDB.organizacao_id == org,
                NfpAgenteCaptadorDB.codigo == codigo,
            )
        )
    ).scalar_one_or_none()
    if existe:
        raise HTTPException(status_code=400, detail="Ja existe agente com este codigo.")
    numero = await proximo_numero_cadastro_agente(db, org)
    row = NfpAgenteCaptadorDB(
        organizacao_id=org,
        numero_cadastro=numero,
        codigo=codigo,
        tipo="PJ",
        nome=codigo,
        percentual_agente=percentual_agente_padrao(codigo),
        ativo=True,
        criado_em=agora_operacional_naive(),
        atualizado_em=agora_operacional_naive(),
    )
    _aplicar_agente_payload(row, payload, criando=True)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return serializar_agente(row)


@router.put("/agentes/{agente_id}")
async def atualizar_agente(
    agente_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    row = await _obter_agente_org(db, org, agente_id)
    novo_codigo = normalizar_agente_captacao(payload.get("codigo") or row.codigo)
    if novo_codigo != row.codigo:
        existe = (
            await db.execute(
                select(NfpAgenteCaptadorDB).where(
                    NfpAgenteCaptadorDB.organizacao_id == org,
                    NfpAgenteCaptadorDB.codigo == novo_codigo,
                    NfpAgenteCaptadorDB.id != row.id,
                )
            )
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(status_code=400, detail="Ja existe agente com este codigo.")
    _aplicar_agente_payload(row, payload, criando=False)
    await db.commit()
    await db.refresh(row)
    return serializar_agente(row)


@router.get("/doadores")
async def listar_doadores(
    busca: Optional[str] = None,
    limite: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    q = (
        select(NfpDoadorDB)
        .where(NfpDoadorDB.organizacao_id == org)
        .order_by(NfpDoadorDB.numero_cadastro, NfpDoadorDB.nome)
    )
    if busca:
        termo_bruto = busca.strip()
        termo = f"%{termo_bruto}%"
        filtros = [
            NfpDoadorDB.nome.ilike(termo),
            NfpDoadorDB.cpf.ilike(termo),
            cast(NfpDoadorDB.numero_cadastro, String).ilike(termo),
        ]
        if termo_bruto.isdigit():
            filtros.append(NfpDoadorDB.numero_cadastro == int(termo_bruto))
        q = q.where(or_(*filtros))
    rows = (await db.execute(q.offset(offset).limit(limite))).scalars().all()
    return [serializar_doador(r) for r in rows]


@router.post("/doadores/sincronizar")
async def post_sincronizar_doadores(
    competencia: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """Sincroniza cadastro de doadores a partir dos CPFs das doacoes automaticas."""
    _exigir_nfp(usuario_atual)
    return await sincronizar_doadores_de_doacoes(
        db,
        _organizacao_id(usuario_atual),
        competencia=competencia,
    )


@router.post("/doadores/importar")
async def post_importar_doadores(
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    try:
        return await importar_doadores(db, _organizacao_id(usuario_atual), arquivo.file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/doadores/{doador_id}")
async def obter_doador(
    doador_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    row = await _obter_doador_org(db, _organizacao_id(usuario_atual), doador_id)
    return serializar_doador(row)


@router.post("/doadores")
async def criar_doador(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    cpf = limpar_documento(payload.get("cpf"))
    if cpf:
        existe = (
            await db.execute(
                select(NfpDoadorDB).where(
                    NfpDoadorDB.organizacao_id == org,
                    NfpDoadorDB.cpf == cpf,
                )
            )
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(status_code=400, detail="Ja existe doador com este CPF.")
    numero = await proximo_numero_cadastro_doador(db, org)
    row = NfpDoadorDB(
        organizacao_id=org,
        numero_cadastro=numero,
        nome=(payload.get("nome") or "").strip() or "Sem nome",
        cpf=cpf or "00000000000",
        ativo=True,
        criado_em=agora_operacional_naive(),
        atualizado_em=agora_operacional_naive(),
    )
    _aplicar_doador_payload(row, payload, criando=True)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return serializar_doador(row)


@router.put("/doadores/{doador_id}")
async def atualizar_doador(
    doador_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    row = await _obter_doador_org(db, org, doador_id)
    novo_cpf = limpar_documento(payload.get("cpf") or row.cpf)
    if novo_cpf != row.cpf:
        existe = (
            await db.execute(
                select(NfpDoadorDB).where(
                    NfpDoadorDB.organizacao_id == org,
                    NfpDoadorDB.cpf == novo_cpf,
                    NfpDoadorDB.id != row.id,
                )
            )
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(status_code=400, detail="Ja existe doador com este CPF.")
    _aplicar_doador_payload(row, payload, criando=False)
    await db.commit()
    await db.refresh(row)
    return serializar_doador(row)


@router.get("/cnpjs")
async def listar_cnpjs(
    busca: Optional[str] = None,
    captador: Optional[str] = None,
    somente_conferir: bool = False,
    limite: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    q = (
        select(NfpCnpjLojaDB)
        .where(NfpCnpjLojaDB.organizacao_id == org)
        .order_by(NfpCnpjLojaDB.numero_cadastro, NfpCnpjLojaDB.loja)
    )
    if busca:
        termo_bruto = busca.strip()
        termo = f"%{termo_bruto}%"
        filtros = [
            NfpCnpjLojaDB.loja.ilike(termo),
            NfpCnpjLojaDB.cnpj.ilike(termo),
            cast(NfpCnpjLojaDB.numero_cadastro, String).ilike(termo),
        ]
        if termo_bruto.isdigit():
            filtros.append(NfpCnpjLojaDB.numero_cadastro == int(termo_bruto))
        q = q.where(or_(*filtros))
    if captador:
        q = q.where(NfpCnpjLojaDB.captador == captador.strip().upper())
    if somente_conferir:
        q = q.where(NfpCnpjLojaDB.cnpj_conferir.is_(True))
    rows = (await db.execute(q.offset(offset).limit(limite))).scalars().all()
    return [serializar_cnpj(r) for r in rows]


@router.get("/cnpjs/{cnpj_id}")
async def obter_cnpj(
    cnpj_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    row = await _obter_cnpj_org(db, _organizacao_id(usuario_atual), cnpj_id)
    return serializar_cnpj(row)


@router.post("/cnpjs")
async def criar_cnpj(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    cnpj = limpar_documento(payload.get("cnpj"))
    if cnpj:
        existe = (
            await db.execute(
                select(NfpCnpjLojaDB).where(
                    NfpCnpjLojaDB.organizacao_id == org,
                    NfpCnpjLojaDB.cnpj == cnpj,
                )
            )
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(status_code=400, detail="Ja existe loja com este CNPJ.")
    numero = await proximo_numero_cadastro_cnpj(db, org)
    row = NfpCnpjLojaDB(
        organizacao_id=org,
        numero_cadastro=numero,
        cnpj=cnpj or "00000000000000",
        loja=None,
        captador="DIEGO",
        cnpj_conferir=False,
        ativo=True,
        criado_em=agora_operacional_naive(),
        atualizado_em=agora_operacional_naive(),
    )
    _aplicar_cnpj_payload(row, payload, criando=True)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return serializar_cnpj(row)


@router.put("/cnpjs/{cnpj_id}")
async def atualizar_cnpj(
    cnpj_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    row = await _obter_cnpj_org(db, org, cnpj_id)
    novo_cnpj = limpar_documento(payload.get("cnpj") or row.cnpj)
    if novo_cnpj != row.cnpj:
        existe = (
            await db.execute(
                select(NfpCnpjLojaDB).where(
                    NfpCnpjLojaDB.organizacao_id == org,
                    NfpCnpjLojaDB.cnpj == novo_cnpj,
                    NfpCnpjLojaDB.id != row.id,
                )
            )
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(status_code=400, detail="Ja existe loja com este CNPJ.")
    _aplicar_cnpj_payload(row, payload, criando=False)
    await db.commit()
    await db.refresh(row)
    return serializar_cnpj(row)


@router.post("/cnpjs/importar")
async def post_importar_cnpjs(
    arquivo: UploadFile = File(...),
    captador_padrao: str = Form("DIEGO"),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    try:
        return await importar_cnpjs(
            db, _organizacao_id(usuario_atual), arquivo.file, captador_padrao=captador_padrao
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/importar/doacoes-sefaz")
async def post_importar_doacoes(
    competencia: str = Form(...),
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    try:
        return await importar_doacoes_sefaz(
            db, _organizacao_id(usuario_atual), arquivo.file, competencia
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/importar/sefaz-creditos")
async def post_importar_sefaz(
    competencia: str = Form(...),
    arquivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    try:
        return await importar_sefaz_creditos(
            db, _organizacao_id(usuario_atual), arquivo.file, competencia
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rateio/calcular")
async def post_calcular_rateio(
    competencia: str = Form(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    try:
        return await calcular_rateio(db, _organizacao_id(usuario_atual), competencia)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/rateio")
async def listar_rateio(
    competencia: str = Query(...),
    limite: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    rows = (
        await db.execute(
            select(NfpRateioDB)
            .where(
                NfpRateioDB.organizacao_id == org,
                NfpRateioDB.competencia == competencia,
            )
            .order_by(NfpRateioDB.origem, NfpRateioDB.loja)
            .offset(offset)
            .limit(limite)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "cnpj": r.cnpj,
            "loja": r.loja,
            "captador": r.captador,
            "origem": r.origem,
            "qtd": r.qtd,
            "retorno": r.retorno,
            "valor_diego": r.valor_diego,
            "valor_aeb": r.valor_aeb,
            "final": r.final,
            "competencia": r.competencia,
        }
        for r in rows
    ]


@router.get("/rateio/exportar")
async def exportar_rateio(
    competencia: str = Query(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    rows = (
        await db.execute(
            select(NfpRateioDB).where(
                NfpRateioDB.organizacao_id == org,
                NfpRateioDB.competencia == competencia,
            )
        )
    ).scalars().all()
    conteudo = exportar_rateio_xlsx(rows)
    return Response(
        content=conteudo,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="nfp_rateio_{competencia}.xlsx"'},
    )


@router.get("/batimentos")
async def listar_batimentos(
    competencia: str = Query(...),
    limite: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    org = _organizacao_id(usuario_atual)
    rows = (
        await db.execute(
            select(NfpBatimentoDB)
            .where(
                NfpBatimentoDB.organizacao_id == org,
                NfpBatimentoDB.competencia == competencia,
            )
            .offset(offset)
            .limit(limite)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "cpf_doador_cadastrador": r.cpf_doador_cadastrador,
            "cnpj_estabelecimento": r.cnpj_estabelecimento,
            "emitente": r.emitente,
            "numero_nota": r.numero_nota,
            "creditos_centavos": r.creditos_centavos,
            "competencia": r.competencia,
        }
        for r in rows
    ]


@router.get("/relatorios/rateio-consolidado")
async def get_relatorio_rateio_consolidado(
    competencia_inicio: Optional[str] = Query(None),
    competencia_fim: Optional[str] = Query(None),
    agente: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    return await relatorio_rateio_consolidado(
        db,
        _organizacao_id(usuario_atual),
        competencia_inicio=competencia_inicio,
        competencia_fim=competencia_fim,
        agente=agente,
    )


@router.get("/relatorios/origens-rateio")
async def get_origens_rateio(
    competencia: str = Query(...),
    agente: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    try:
        return await listar_origens_rateio(
            db,
            _organizacao_id(usuario_atual),
            competencia=competencia,
            agente=agente,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/relatorios/rateio-detalhado")
async def get_relatorio_rateio_detalhado(
    competencia: str = Query(...),
    agente: Optional[str] = Query(None),
    origem: Optional[str] = Query(None),
    busca: Optional[str] = Query(None),
    limite: int = Query(2000, ge=1, le=5000),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp(usuario_atual)
    try:
        return await relatorio_rateio_detalhado(
            db,
            _organizacao_id(usuario_atual),
            competencia=competencia,
            agente=agente,
            origem=origem,
            busca=busca,
            limite=limite,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
