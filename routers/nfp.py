"""API do modulo NFP – Creditos."""
from __future__ import annotations

import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import cast, func, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import (
    NfpAgenteCaptadorDB,
    NfpBatimentoDB,
    NfpCnpjLojaDB,
    NfpCpfCaptadoDB,
    NfpCupomLidoDB,
    NfpDoadorDB,
    NfpRateioDB,
)
from nfp_cupom_leitura_service import agendar_checagem_sefaz, registrar_leitura_rapida
from nfp_cupom_relatorio_service import relatorio_cupons
from nfp_metas_service import (
    consolidado_metas,
    exportar_metas_xlsx,
    listar_competencias_metas,
    obter_metas,
    salvar_metas,
    sugerir_do_rateio,
)
from nfp_service import (
    _bool_payload,
    _int_percentual,
    _texto_opcional,
    aplicar_endereco,
    calcular_rateio,
    exportar_rateio_xlsx,
    garantir_agentes_padrao,
    garantir_doador_por_cpf,
    importar_cnpjs,
    importar_doacoes_sefaz,
    importar_doadores,
    importar_sefaz_creditos,
    listar_agentes_captacao,
    proximo_numero_cadastro_agente,
    proximo_numero_cadastro_cnpj,
    proximo_numero_cadastro_cpf_captado,
    proximo_numero_cadastro_doador,
    relatorio_rateio_consolidado,
    relatorio_rateio_detalhado,
    listar_origens_rateio,
    resumo_dashboard,
    serializar_agente,
    serializar_cnpj,
    serializar_cpf_captado,
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
from time_operacional import agora_operacional_naive
from security import (
    bloquear_usuario_global_puro,
    get_usuario_logado,
    usuario_eh_adm_global,
    usuario_eh_adm_producao,
    usuario_pode_acessar_nfp,
    usuario_pode_gestao_nfp_completa,
    usuario_pode_leitura_cupons_nfp,
    usuario_pode_operar_envio_sefaz,
    usuario_pode_ver_envio_sefaz,
)
from nfp_cupom_reserva_service import (
    TAMANHO_LOTE_PADRAO,
    aplicar_resultados_envio,
    liberar_lote,
    liberar_reservas_expiradas,
    reservar_lote_cupons,
)
from nfp_envio_sefaz_service import (
    PLANILHA_PADRAO,
    abrir_chrome_fazenda,
    iniciar_envio_fila,
    parar_envio_fila,
    robo_disponivel_neste_ambiente,
    snapshot_job,
    status_cdp,
)

router = APIRouter(prefix="/api/nfp", tags=["NFP – Créditos"])


def _exigir_nfp(usuario_atual: dict) -> None:
    if not usuario_pode_acessar_nfp(usuario_atual):
        raise HTTPException(status_code=403, detail="Acesso restrito ao modulo NFP – Creditos.")


def _exigir_nfp_gestao(usuario_atual: dict) -> None:
    if not usuario_pode_gestao_nfp_completa(usuario_atual):
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito a gestao NFP (Global / ADM Global / Manutencao).",
        )


def _exigir_nfp_escrita_gestao(usuario_atual: dict) -> None:
    """Cadastros, importacoes e rateio — consulta Global ok; edicao nao."""
    _exigir_nfp_gestao(usuario_atual)
    bloquear_usuario_global_puro(usuario_atual)


def _exigir_nfp_leitura_cupons(usuario_atual: dict) -> None:
    if not usuario_pode_leitura_cupons_nfp(usuario_atual):
        raise HTTPException(status_code=403, detail="Acesso restrito a Leitura de Cupons.")


def _exigir_nfp_escrita_cupons(usuario_atual: dict) -> None:
    _exigir_nfp_leitura_cupons(usuario_atual)
    bloquear_usuario_global_puro(usuario_atual)


def _exigir_envio_sefaz_ver(usuario_atual: dict) -> None:
    if not usuario_pode_ver_envio_sefaz(usuario_atual):
        raise HTTPException(
            status_code=403,
            detail="Acesso restrito a Envio SEFAZ (Global / ADM Global / Manutencao).",
        )


def _exigir_envio_sefaz_operar(usuario_atual: dict) -> None:
    if not usuario_pode_operar_envio_sefaz(usuario_atual):
        raise HTTPException(
            status_code=403,
            detail="Somente ADM Global ou Manutencao podem operar o Envio SEFAZ.",
        )


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


async def _obter_cpf_captado_org(db: AsyncSession, org: str, cpf_id: str) -> NfpCpfCaptadoDB:
    row = await db.get(NfpCpfCaptadoDB, cpf_id)
    if not row or row.organizacao_id != org:
        raise HTTPException(status_code=404, detail="CPF captado nao encontrado.")
    return row


def _aplicar_cpf_captado_payload(row: NfpCpfCaptadoDB, payload: dict, *, criando: bool) -> None:
    cpf = limpar_documento(payload.get("cpf") if "cpf" in payload or criando else row.cpf)
    if not cpf:
        raise HTTPException(status_code=400, detail="CPF obrigatorio.")
    if not cpf_valido(cpf):
        raise HTTPException(status_code=400, detail="CPF invalido.")
    captador = normalizar_agente_captacao(
        payload.get("captador") if "captador" in payload or criando else row.captador
    )
    if not captador:
        raise HTTPException(status_code=400, detail="Captador obrigatorio.")
    if captador == "AEB":
        raise HTTPException(
            status_code=400,
            detail="Use um agente captador (nao AEB) para CPF captado.",
        )
    row.cpf = cpf
    row.captador = captador
    if "nome" in payload or criando:
        row.nome = _texto_opcional(payload.get("nome"))
    if "email" in payload or criando:
        row.email = _texto_opcional(payload.get("email"))
    if "telefone" in payload or criando:
        row.telefone = _texto_opcional(payload.get("telefone"))
    if "ativo" in payload or criando:
        row.ativo = _bool_payload(payload.get("ativo"), True)
    if "observacoes" in payload or criando:
        row.observacoes = _texto_opcional(payload.get("observacoes"))
    row.atualizado_em = agora_operacional_naive()


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
        "somente_nfp": usuario_eh_adm_global(usuario_atual) or usuario_eh_adm_producao(usuario_atual),
        "somente_leitura_cupons": usuario_eh_adm_producao(usuario_atual),
        "pode_gestao_nfp": usuario_pode_gestao_nfp_completa(usuario_atual),
        "pode_ver_envio_sefaz": usuario_pode_ver_envio_sefaz(usuario_atual),
        "pode_operar_envio_sefaz": usuario_pode_operar_envio_sefaz(usuario_atual),
        "nfp_captador_vinculo": usuario_atual.get("nfp_captador_vinculo"),
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
    _exigir_nfp_gestao(usuario_atual)
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
    bloquear_usuario_global_puro(usuario_atual)
    return await garantir_agentes_padrao(db, _organizacao_id(usuario_atual))


@router.get("/agentes/{agente_id}")
async def obter_agente(
    agente_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_gestao(usuario_atual)
    row = await _obter_agente_org(db, _organizacao_id(usuario_atual), agente_id)
    return serializar_agente(row)


@router.post("/agentes")
async def criar_agente(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
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
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
    row = await _obter_doador_org(db, _organizacao_id(usuario_atual), doador_id)
    return serializar_doador(row)


@router.post("/doadores")
async def criar_doador(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
    row = await _obter_cnpj_org(db, _organizacao_id(usuario_atual), cnpj_id)
    return serializar_cnpj(row)


@router.post("/cnpjs")
async def criar_cnpj(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    competencia: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
    try:
        return await importar_cnpjs(
            db,
            _organizacao_id(usuario_atual),
            arquivo.file,
            captador_padrao=captador_padrao,
            competencia=(competencia or "").strip() or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/cpfs-captados")
async def listar_cpfs_captados(
    busca: Optional[str] = None,
    captador: Optional[str] = None,
    ativo: Optional[bool] = None,
    limite: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_gestao(usuario_atual)
    org = _organizacao_id(usuario_atual)
    q = (
        select(NfpCpfCaptadoDB)
        .where(NfpCpfCaptadoDB.organizacao_id == org)
        .order_by(NfpCpfCaptadoDB.numero_cadastro, NfpCpfCaptadoDB.nome)
    )
    if busca:
        termo_bruto = busca.strip()
        termo = f"%{termo_bruto}%"
        filtros = [
            NfpCpfCaptadoDB.nome.ilike(termo),
            NfpCpfCaptadoDB.cpf.ilike(termo),
            cast(NfpCpfCaptadoDB.numero_cadastro, String).ilike(termo),
        ]
        digitos = limpar_documento(termo_bruto)
        if digitos:
            filtros.append(NfpCpfCaptadoDB.cpf.ilike(f"%{digitos}%"))
        if termo_bruto.isdigit():
            filtros.append(NfpCpfCaptadoDB.numero_cadastro == int(termo_bruto))
        q = q.where(or_(*filtros))
    if captador:
        q = q.where(NfpCpfCaptadoDB.captador == captador.strip().upper())
    if ativo is not None:
        q = q.where(NfpCpfCaptadoDB.ativo.is_(ativo))
    rows = (await db.execute(q.offset(offset).limit(limite))).scalars().all()
    return [serializar_cpf_captado(r) for r in rows]


@router.get("/cpfs-captados/{cpf_id}")
async def obter_cpf_captado(
    cpf_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_gestao(usuario_atual)
    row = await _obter_cpf_captado_org(db, _organizacao_id(usuario_atual), cpf_id)
    return serializar_cpf_captado(row)


@router.post("/cpfs-captados")
async def criar_cpf_captado(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
    org = _organizacao_id(usuario_atual)
    cpf = limpar_documento(payload.get("cpf"))
    if cpf:
        existe = (
            await db.execute(
                select(NfpCpfCaptadoDB).where(
                    NfpCpfCaptadoDB.organizacao_id == org,
                    NfpCpfCaptadoDB.cpf == cpf,
                )
            )
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(status_code=400, detail="Ja existe CPF captado com este documento.")
    numero = await proximo_numero_cadastro_cpf_captado(db, org)
    row = NfpCpfCaptadoDB(
        organizacao_id=org,
        numero_cadastro=numero,
        cpf=cpf or "00000000000",
        captador="DIEGO",
        ativo=True,
        criado_em=agora_operacional_naive(),
        atualizado_em=agora_operacional_naive(),
    )
    _aplicar_cpf_captado_payload(row, payload, criando=True)
    db.add(row)
    doador = (
        await db.execute(
            select(NfpDoadorDB).where(
                NfpDoadorDB.organizacao_id == org,
                NfpDoadorDB.cpf == row.cpf,
            )
        )
    ).scalar_one_or_none()
    if doador:
        doador.unidade_captador = row.captador
        if row.nome:
            doador.nome = row.nome
        doador.atualizado_em = agora_operacional_naive()
    else:
        await garantir_doador_por_cpf(
            db,
            org,
            row.cpf,
            nome=row.nome,
            unidade_captador=row.captador,
            origem_cadastro=ORIGEM_DOADOR_MANUAL,
        )
    await db.commit()
    await db.refresh(row)
    return serializar_cpf_captado(row)


@router.put("/cpfs-captados/{cpf_id}")
async def atualizar_cpf_captado(
    cpf_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
    org = _organizacao_id(usuario_atual)
    row = await _obter_cpf_captado_org(db, org, cpf_id)
    novo_cpf = limpar_documento(payload.get("cpf") or row.cpf)
    if novo_cpf != row.cpf:
        existe = (
            await db.execute(
                select(NfpCpfCaptadoDB).where(
                    NfpCpfCaptadoDB.organizacao_id == org,
                    NfpCpfCaptadoDB.cpf == novo_cpf,
                    NfpCpfCaptadoDB.id != row.id,
                )
            )
        ).scalar_one_or_none()
        if existe:
            raise HTTPException(status_code=400, detail="Ja existe CPF captado com este documento.")
    _aplicar_cpf_captado_payload(row, payload, criando=False)
    doador = (
        await db.execute(
            select(NfpDoadorDB).where(
                NfpDoadorDB.organizacao_id == org,
                NfpDoadorDB.cpf == row.cpf,
            )
        )
    ).scalar_one_or_none()
    if doador:
        doador.unidade_captador = row.captador
        if row.nome:
            doador.nome = row.nome
        doador.atualizado_em = agora_operacional_naive()
    else:
        await garantir_doador_por_cpf(
            db,
            org,
            row.cpf,
            nome=row.nome,
            unidade_captador=row.captador,
            origem_cadastro=ORIGEM_DOADOR_MANUAL,
        )
    await db.commit()
    await db.refresh(row)
    return serializar_cpf_captado(row)


@router.post("/importar/doacoes-sefaz")
async def post_importar_doacoes(
    arquivo: UploadFile = File(...),
    competencia: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
    try:
        return await importar_doacoes_sefaz(
            db,
            _organizacao_id(usuario_atual),
            arquivo.file,
            competencia=(competencia or "").strip() or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/importar/sefaz-creditos")
async def post_importar_sefaz(
    arquivos: list[UploadFile] = File(...),
    competencia: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
    try:
        payloads = []
        for arq in arquivos:
            payloads.append(await arq.read())
        return await importar_sefaz_creditos(
            db,
            _organizacao_id(usuario_atual),
            arquivos=payloads,
            competencia=(competencia or "").strip() or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/rateio/calcular")
async def post_calcular_rateio(
    competencia: str = Form(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
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
    _exigir_nfp_gestao(usuario_atual)
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


@router.get("/relatorios/cupons")
async def get_relatorio_cupons(
    data_inicio: Optional[str] = Query(None, description="AAAA-MM-DD (fuso SP)"),
    data_fim: Optional[str] = Query(None, description="AAAA-MM-DD (fuso SP)"),
    captador: Optional[str] = Query(None, description="Unidade / captador da leitura"),
    status: Optional[str] = Query(
        None,
        description="Um status ou CSV: pendente,enviado,reservado,erro,checando,rejeitado_cpf,rejeitado_prazo",
    ),
    busca: Optional[str] = Query(None, description="Chave, CNPJ ou mensagem"),
    eixo_data: str = Query("lido_em", description="lido_em ou enviado_em"),
    limite: int = Query(50, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    incluir_agregados: bool = Query(True),
    exportacao: bool = Query(False, description="Permite ate 2000 linhas no detalhe"),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_gestao(usuario_atual)
    try:
        return await relatorio_cupons(
            db,
            _organizacao_id(usuario_atual),
            data_inicio=data_inicio,
            data_fim=data_fim,
            captador=captador,
            status=status,
            busca=busca,
            eixo_data=eixo_data,
            limite=limite,
            offset=offset,
            incluir_agregados=incluir_agregados,
            exportacao=exportacao,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _serializar_cupom_lido(row: NfpCupomLidoDB) -> dict:
    return {
        "id": row.id,
        "chave": row.chave,
        "captador": row.captador,
        "status": row.status,
        "consumidor_identificado": row.consumidor_identificado,
        "cnpj_emitente": row.cnpj_emitente,
        "data_emissao_ref": row.data_emissao_ref,
        "mensagem": row.mensagem,
        "url_consulta": row.url_consulta,
        "lido_em": row.lido_em.isoformat(sep=" ", timespec="seconds") if row.lido_em else None,
        "enviado_em": row.enviado_em.isoformat(sep=" ", timespec="seconds") if row.enviado_em else None,
    }


@router.get("/cupons")
async def listar_cupons_lidos(
    status: Optional[str] = Query(None),
    captador: Optional[str] = Query(None),
    busca: Optional[str] = Query(None),
    limite: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_leitura_cupons(usuario_atual)
    org = _organizacao_id(usuario_atual)
    # So na 1a pagina: reagenda poucas checagens orfas (evita custo em volume alto).
    if offset == 0:
        checando_ids = (
            await db.execute(
                select(NfpCupomLidoDB.id).where(
                    NfpCupomLidoDB.organizacao_id == org,
                    NfpCupomLidoDB.status == "checando",
                ).limit(20)
            )
        ).scalars().all()
        for cupom_id in checando_ids:
            agendar_checagem_sefaz(cupom_id)

    filtros = [NfpCupomLidoDB.organizacao_id == org]
    if status:
        filtros.append(NfpCupomLidoDB.status == status.strip().lower())
    if captador:
        filtros.append(NfpCupomLidoDB.captador == normalizar_agente_captacao(captador))
    if busca and str(busca).strip():
        termo = f"%{str(busca).strip()}%"
        filtros.append(
            (NfpCupomLidoDB.chave.ilike(termo))
            | (NfpCupomLidoDB.cnpj_emitente.ilike(termo))
            | (NfpCupomLidoDB.mensagem.ilike(termo))
        )

    total = int(
        (await db.execute(select(func.count()).select_from(NfpCupomLidoDB).where(*filtros))).scalar_one()
        or 0
    )
    q = (
        select(NfpCupomLidoDB)
        .where(*filtros)
        .order_by(NfpCupomLidoDB.lido_em.desc())
        .offset(offset)
        .limit(limite)
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "itens": [_serializar_cupom_lido(r) for r in rows],
        "total": total,
        "paginacao": {
            "offset": offset,
            "limite": limite,
            "total": total,
            "pagina": (offset // limite) + 1 if limite else 1,
            "total_paginas": max(1, (total + limite - 1) // limite) if limite else 1,
        },
    }


@router.post("/cupons/leitura")
async def registrar_leitura_cupom(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """Leitura continua: grava na hora e valida SEFAZ em background."""
    _exigir_nfp_escrita_cupons(usuario_atual)
    org = _organizacao_id(usuario_atual)
    await garantir_agentes_padrao(db, org)

    if usuario_eh_adm_producao(usuario_atual):
        captador = (usuario_atual.get("nfp_captador_vinculo") or "").strip()
        if not normalizar_agente_captacao(captador):
            raise HTTPException(
                status_code=400,
                detail="Seu usuário ADM Produção ainda não tem vínculo com projeto/Sede. Peça ao ADM Global, Global ou Manutenção para configurar.",
            )
    else:
        captador = normalizar_agente_captacao(payload.get("captador"))
        if not captador:
            raise HTTPException(status_code=400, detail="Selecione o captador / unidade (ex.: SEDE AEB).")

    bruto = (payload.get("codigo_ou_qr") or payload.get("qr") or payload.get("chave") or "").strip()
    if not bruto:
        raise HTTPException(status_code=400, detail="Leitura vazia.")

    try:
        resultado = await registrar_leitura_rapida(
            db,
            organizacao_id=org,
            captador=captador,
            bruto=bruto,
            usuario_id=str(usuario_atual.get("id") or "") or None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LookupError as exc:
        existente = exc.args[0]
        raise HTTPException(
            status_code=409,
            detail={
                "mensagem": "Cupom ja lido anteriormente.",
                "cupom": _serializar_cupom_lido(existente),
            },
        ) from exc

    row = resultado["cupom"]
    return {
        "ok": True,
        "checagem": resultado.get("checagem"),
        "cupom": _serializar_cupom_lido(row),
    }


@router.patch("/cupons/{cupom_id}/status")
async def atualizar_status_cupom(
    cupom_id: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
    org = _organizacao_id(usuario_atual)
    row = await db.get(NfpCupomLidoDB, cupom_id)
    if not row or row.organizacao_id != org:
        raise HTTPException(status_code=404, detail="Cupom nao encontrado.")

    novo = (payload.get("status") or "").strip().lower()
    if novo not in {
        "pendente",
        "enviado",
        "erro",
        "checando",
        "rejeitado_cpf",
        "rejeitado_prazo",
        "reservado",
    }:
        raise HTTPException(
            status_code=400,
            detail=(
                "Status deve ser pendente, reservado, enviado, erro, checando, "
                "rejeitado_cpf ou rejeitado_prazo."
            ),
        )

    row.status = novo
    row.mensagem = _texto_opcional(payload.get("mensagem")) or row.mensagem
    row.atualizado_em = agora_operacional_naive()
    if novo == "enviado":
        row.enviado_em = agora_operacional_naive()
    await db.commit()
    await db.refresh(row)
    return _serializar_cupom_lido(row)


@router.get("/envio-sefaz/status")
async def envio_sefaz_status(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_envio_sefaz_ver(usuario_atual)
    org = _organizacao_id(usuario_atual)

    contagens_rows = (
        await db.execute(
            select(NfpCupomLidoDB.status, func.count())
            .where(NfpCupomLidoDB.organizacao_id == org)
            .group_by(NfpCupomLidoDB.status)
        )
    ).all()
    contagens = {str(status or ""): int(qtd or 0) for status, qtd in contagens_rows}
    pendentes_total = contagens.get("pendente", 0)
    reservados_total = contagens.get("reservado", 0)
    enviados_total = contagens.get("enviado", 0)
    erros_total = contagens.get("erro", 0)
    cupons_total = sum(contagens.values())

    pendentes = (
        await db.execute(
            select(NfpCupomLidoDB).where(
                NfpCupomLidoDB.organizacao_id == org,
                NfpCupomLidoDB.status == "pendente",
            ).order_by(NfpCupomLidoDB.lido_em.asc()).limit(50)
        )
    ).scalars().all()
    return {
        "robo_local_habilitado": robo_disponivel_neste_ambiente(),
        "cdp": status_cdp(),
        "planilha_padrao": str(PLANILHA_PADRAO),
        "planilha_existe": PLANILHA_PADRAO.is_file(),
        "pendentes_total": pendentes_total,
        "reservados_total": reservados_total,
        "enviados_total": enviados_total,
        "erros_total": erros_total,
        "cupons_total": cupons_total,
        "tamanho_lote": 100,
        "contagens_por_status": contagens,
        "pendentes": [_serializar_cupom_lido(r) for r in pendentes],
        "job": snapshot_job(),
        "pode_operar": usuario_pode_operar_envio_sefaz(usuario_atual),
        "url_nfp": "https://www.nfp.fazenda.sp.gov.br/",
    }


@router.post("/envio-sefaz/abrir-chrome")
async def envio_sefaz_abrir_chrome(
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_envio_sefaz_operar(usuario_atual)
    try:
        return await asyncio.to_thread(abrir_chrome_fazenda)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/envio-sefaz/enviar-fila")
async def envio_sefaz_enviar_fila(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_envio_sefaz_operar(usuario_atual)
    org = _organizacao_id(usuario_atual)
    fonte = (payload.get("fonte") or "pendentes").strip().lower()
    limite = payload.get("limite")
    try:
        limite_n = int(limite) if limite not in (None, "") else None
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="limite invalido.") from exc
    if limite_n is not None and limite_n < 1:
        raise HTTPException(status_code=400, detail="limite deve ser >= 1 ou vazio.")

    chaves = []
    if fonte == "planilha":
        # Mantem leitura opcional de chaves no payload se o front enviar.
        for c in payload.get("chaves") or []:
            dig = "".join(ch for ch in str(c) if ch.isdigit())
            if len(dig) == 44:
                chaves.append(dig)

    try:
        return await asyncio.to_thread(
            iniciar_envio_fila,
            organizacao_id=org,
            fonte=fonte,
            chaves=chaves or None,
            limite=limite_n,
            usuario_id=str(usuario_atual.get("id") or "") or None,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/envio-sefaz/parar")
async def envio_sefaz_parar(
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_envio_sefaz_operar(usuario_atual)
    resultado = await asyncio.to_thread(parar_envio_fila)
    if not resultado.get("ok"):
        raise HTTPException(status_code=409, detail=resultado.get("mensagem") or "Nada a parar.")
    return resultado


@router.get("/envio-sefaz/agente/fila")
async def envio_sefaz_agente_fila(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """Contagens da fila online (sem CDP). Usado pelo agente local de cada Sede."""
    _exigir_envio_sefaz_operar(usuario_atual)
    org = _organizacao_id(usuario_atual)
    contagens_rows = (
        await db.execute(
            select(NfpCupomLidoDB.status, func.count())
            .where(NfpCupomLidoDB.organizacao_id == org)
            .group_by(NfpCupomLidoDB.status)
        )
    ).all()
    contagens = {str(status or ""): int(qtd or 0) for status, qtd in contagens_rows}
    return {
        "ok": True,
        "pendentes_total": contagens.get("pendente", 0),
        "reservados_total": contagens.get("reservado", 0),
        "enviados_total": contagens.get("enviado", 0),
        "erros_total": contagens.get("erro", 0),
        "cupons_total": sum(contagens.values()),
        "tamanho_lote": TAMANHO_LOTE_PADRAO,
        "contagens_por_status": contagens,
    }


@router.post("/envio-sefaz/agente/reservar-lote")
async def envio_sefaz_agente_reservar_lote(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """Reserva fatia exclusiva de pendentes para esta maquina (API online)."""
    _exigir_envio_sefaz_operar(usuario_atual)
    org = _organizacao_id(usuario_atual)
    try:
        tamanho = int(payload.get("tamanho") or TAMANHO_LOTE_PADRAO)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="tamanho invalido.") from exc
    if tamanho < 1:
        raise HTTPException(status_code=400, detail="tamanho deve ser >= 1.")
    reserva = await reservar_lote_cupons(
        db,
        organizacao_id=org,
        usuario_id=str(usuario_atual.get("id") or "") or None,
        tamanho=tamanho,
    )
    return {"ok": True, **reserva}


@router.post("/envio-sefaz/agente/liberar-lote")
async def envio_sefaz_agente_liberar_lote(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_envio_sefaz_operar(usuario_atual)
    org = _organizacao_id(usuario_atual)
    lote_id = str(payload.get("lote_id") or "").strip()
    if not lote_id:
        raise HTTPException(status_code=400, detail="lote_id obrigatorio.")
    n = await liberar_lote(db, organizacao_id=org, lote_id=lote_id)
    return {"ok": True, "liberados": n, "lote_id": lote_id}


@router.post("/envio-sefaz/agente/aplicar-resultados")
async def envio_sefaz_agente_aplicar_resultados(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """Sincroniza retorno do Chrome local com o CareCore online."""
    _exigir_envio_sefaz_operar(usuario_atual)
    org = _organizacao_id(usuario_atual)
    itens = payload.get("itens") or []
    if not isinstance(itens, list):
        raise HTTPException(status_code=400, detail="itens deve ser uma lista.")
    atualizados = await aplicar_resultados_envio(db, organizacao_id=org, itens=itens)
    return {"ok": True, "atualizados": atualizados}


@router.post("/envio-sefaz/agente/liberar-expirados")
async def envio_sefaz_agente_liberar_expirados(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_envio_sefaz_operar(usuario_atual)
    org = _organizacao_id(usuario_atual)
    n = await liberar_reservas_expiradas(db, org)
    return {"ok": True, "liberados": n}


@router.get("/metas/competencias")
async def get_metas_competencias(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_gestao(usuario_atual)
    return await listar_competencias_metas(db, _organizacao_id(usuario_atual))


@router.get("/metas/consolidado")
async def get_metas_consolidado(
    competencias: Optional[str] = Query(None, description="Lista AAAA-MM separada por virgula"),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_gestao(usuario_atual)
    lista = None
    if competencias:
        lista = [c.strip() for c in competencias.split(",") if c.strip()]
    return await consolidado_metas(db, _organizacao_id(usuario_atual), lista)


@router.get("/metas/{competencia}")
async def get_metas(
    competencia: str,
    sincronizar_doadas: bool = True,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_gestao(usuario_atual)
    try:
        return await obter_metas(
            db,
            _organizacao_id(usuario_atual),
            competencia,
            sincronizar_doadas=sincronizar_doadas,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/metas/{competencia}")
async def put_metas(
    competencia: str,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
    try:
        return await salvar_metas(db, _organizacao_id(usuario_atual), competencia, payload or {})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/metas/{competencia}/sugerir-rateio")
async def post_metas_sugerir_rateio(
    competencia: str,
    sobrescrever: bool = False,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_escrita_gestao(usuario_atual)
    try:
        return await sugerir_do_rateio(
            db,
            _organizacao_id(usuario_atual),
            competencia,
            sobrescrever=sobrescrever,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/metas/{competencia}/exportar")
async def get_metas_exportar(
    competencia: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    _exigir_nfp_gestao(usuario_atual)
    try:
        dados = await obter_metas(
            db,
            _organizacao_id(usuario_atual),
            competencia,
            sincronizar_doadas=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    conteudo = exportar_metas_xlsx(dados)
    nome = f"nfp-metas-{competencia}.xlsx"
    return Response(
        content=conteudo,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nome}"'},
    )
