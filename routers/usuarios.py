# =====================================================================
# ARQUIVO: routers/usuarios.py
# CARECORE+ OFICIAL
# FASE 1B — Usuários, equipe institucional e permissões
# =====================================================================

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from audit_log import registrar_evento_auditoria
from database import get_db
from models import ConviventeDB, InstituicaoDB, UsuarioDB
from nfp_utils import CAPTADORES_PADRAO, normalizar_agente_captacao
from nfp_vinculo_projeto import (
    buscar_projeto_por_captador,
    garantir_agente_para_projeto,
    rotulo_captador_de_projeto,
    vinculo_eh_sede,
    vinculo_pertence_ao_projeto,
)
from tenant_scope import obter_instituicao_escopo
from schemas import (
    UsuarioCreate,
    UsuarioUpdate,
    UsuarioResponse,
    UsuarioResumoResponse,
    UsuarioAlterarSenha,
    UsuarioDefinirSenha,
    UsuarioAtivarInativar,
)
from security import (
    PERFIL_ADM_GLOBAL,
    PERFIL_ADM_PRODUCAO,
    PERFIS_ADM_NFP_ORG,
    get_usuario_logado,
    gerar_hash_senha,
    usuario_eh_adm_global,
    usuario_eh_adm_nfp_org,
    usuario_eh_gestor,
    usuario_eh_manutencao,
    usuario_eh_oficineiro,
    verificar_senha,
)


router = APIRouter(
    prefix="/api/usuarios",
    tags=["Usuários e Permissões"],
)


# =====================================================================
# CONSTANTES
# =====================================================================

PERFIS_ACESSO_VALIDOS = {
    "Gestor",
    "Global",
    "ADM Global",
    "ADM Produção",
    "Manutenção",
    "Técnico",
    "Orientador",
    "Administrativo",
    "Consulta",
    "Oficineiro(a)",
}

PERFIS_LEGADOS_MAPEAMENTO = {
    "Gestao": "Gestor",
    "Gestão": "Gestor",
    "Tecnico": "Técnico",
    "Manutencao": "Manutenção",
    "Manutenção": "Manutenção",
    "Oficineiro": "Oficineiro(a)",
    "Adm Global": "ADM Global",
    "ADMGlobal": "ADM Global",
    "Adm Producao": "ADM Produção",
    "Adm Produção": "ADM Produção",
    "ADMProducao": "ADM Produção",
}


# =====================================================================
# HELPERS
# =====================================================================

def agora_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def obter_usuario_id(usuario_atual: dict) -> Optional[str]:
    return (
        usuario_atual.get("id")
        or usuario_atual.get("sub")
        or usuario_atual.get("usuario_id")
    )


def usuario_sistemico_manutencao(usuario: UsuarioDB | dict | None) -> bool:
    return usuario_eh_manutencao(usuario)


def exigir_nao_manutencao(usuario: UsuarioDB) -> None:
    if usuario_sistemico_manutencao(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário sistêmico de manutenção não pode ser alterado pela gestão do cliente.",
        )


def exigir_nao_adm_global_na_lista_projeto(usuario: UsuarioDB) -> None:
    """ADM Global fica só na aba org. ADM Produção do próprio projeto pode ser gerido pelo gestor."""
    if usuario_eh_adm_global(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuários ADM Global são gerenciados na aba Usuários da organização.",
        )


def exigir_gestao_adm_global_org(usuario_atual: dict) -> None:
    if usuario_eh_manutencao(usuario_atual) or usuario_atual.get("is_global"):
        return
    if usuario_eh_adm_global(usuario_atual):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas ADM Global, Global ou Manutenção podem gerenciar usuários ADM Global / ADM Produção.",
    )


def perfil_adm_nfp_org_valido(perfil: Optional[str]) -> str:
    perfil_n = normalizar_perfil_acesso(perfil or PERFIL_ADM_GLOBAL)
    if perfil_n not in PERFIS_ADM_NFP_ORG:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Perfil deve ser ADM Global ou ADM Produção.",
        )
    return perfil_n


def normalizar_vinculo_nfp_captador(
    valor: Optional[str],
    *,
    obrigatorio: bool = False,
    rotulos_extra: Optional[list[str]] = None,
) -> Optional[str]:
    captador = normalizar_agente_captacao(valor)
    if not captador:
        if obrigatorio:
            raise HTTPException(
                status_code=400,
                detail="ADM Produção precisa do vínculo com projeto/Sede (captador NFP).",
            )
        return None

    candidatos: list[str] = list(CAPTADORES_PADRAO)
    for extra in rotulos_extra or []:
        rotulo = (extra or "").strip()
        if rotulo:
            candidatos.append(rotulo)

    for item in candidatos:
        if normalizar_agente_captacao(item) == captador:
            # Preferir rotulo canonico da lista padrao quando houver.
            for padrao in CAPTADORES_PADRAO:
                if normalizar_agente_captacao(padrao) == captador:
                    return padrao
            return rotulo_captador_de_projeto(item) or item

    # Aceita nome livre de projeto novo (sera mapeado para agente NFP).
    rotulo = rotulo_captador_de_projeto(valor) or (valor or "").strip()
    if rotulo:
        return rotulo

    raise HTTPException(
        status_code=400,
        detail="Vínculo NFP inválido. Selecione um projeto/Sede válido.",
    )


async def rotulos_vinculo_da_organizacao(
    db: AsyncSession,
    organizacao_id: Optional[str],
) -> list[str]:
    if not organizacao_id:
        return list(CAPTADORES_PADRAO)
    rows = (
        await db.execute(
            select(InstituicaoDB.nome_fantasia).where(
                InstituicaoDB.organizacao_id == organizacao_id
            )
        )
    ).scalars().all()
    extras = [rotulo_captador_de_projeto(n) or (n or "").strip() for n in rows if n]
    # SEDE sempre disponivel mesmo sem projeto "SEDE".
    unidos = ["SEDE AEB", *CAPTADORES_PADRAO, *extras]
    vistos: set[str] = set()
    saida: list[str] = []
    for item in unidos:
        chave = normalizar_agente_captacao(item)
        if not chave or chave in vistos:
            continue
        vistos.add(chave)
        saida.append(item)
    return saida


async def aplicar_vinculo_e_instituicao_adm_producao(
    db: AsyncSession,
    *,
    organizacao_id: str,
    captador: str,
    instituicao_fallback_id: Optional[str] = None,
) -> tuple[str, str]:
    """Retorna (rotulo_vinculo, instituicao_id) alinhados ao projeto CareCore."""
    rotulos = await rotulos_vinculo_da_organizacao(db, organizacao_id)
    vinculo = normalizar_vinculo_nfp_captador(
        captador,
        obrigatorio=True,
        rotulos_extra=rotulos,
    )
    assert vinculo is not None
    await garantir_agente_para_projeto(db, organizacao_id, vinculo)
    projeto = await buscar_projeto_por_captador(db, organizacao_id, vinculo)
    if projeto:
        return vinculo, projeto.id
    if vinculo_eh_sede(vinculo):
        # Sede sem instituicao dedicada: permanece no fallback do criador.
        if not instituicao_fallback_id:
            raise HTTPException(
                status_code=400,
                detail="Não foi possível vincular ADM Produção da Sede: usuário sem projeto de referência.",
            )
        return vinculo, instituicao_fallback_id
    if not instituicao_fallback_id:
        raise HTTPException(
            status_code=400,
            detail="Não foi encontrado projeto CareCore correspondente ao vínculo NFP informado.",
        )
    return vinculo, instituicao_fallback_id


async def carregar_projeto_atual(
    db: AsyncSession,
    instituicao_id: Optional[str],
) -> Optional[InstituicaoDB]:
    if not instituicao_id:
        return None
    return (
        await db.execute(select(InstituicaoDB).where(InstituicaoDB.id == instituicao_id))
    ).scalar_one_or_none()


def normalizar_perfil_acesso(perfil: Optional[str]) -> str:
    if perfil is None:
        return "Consulta"

    perfil_normalizado = perfil.strip()

    if not perfil_normalizado:
        return "Consulta"

    perfil_normalizado = PERFIS_LEGADOS_MAPEAMENTO.get(
        perfil_normalizado,
        perfil_normalizado,
    )

    if perfil_normalizado not in PERFIS_ACESSO_VALIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Perfil de acesso inválido. "
                "Use: Gestor, Global, ADM Global, ADM Produção, Manutenção, Técnico, Orientador, Administrativo, Consulta ou Oficineiro(a)."
            ),
        )

    return perfil_normalizado


async def buscar_usuario_por_id(
    db: AsyncSession,
    usuario_id: str,
    instituicao_id: str,
) -> UsuarioDB:
    resultado = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.id == usuario_id,
            UsuarioDB.instituicao_id == instituicao_id,
        )
    )

    usuario = resultado.scalar_one_or_none()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado.",
        )

    return usuario


async def verificar_email_unico(
    db: AsyncSession,
    email: str,
    usuario_id_ignorar: Optional[str] = None,
) -> None:
    email_normalizado = email.lower().strip()

    filtros = [UsuarioDB.email == email_normalizado]

    if usuario_id_ignorar:
        filtros.append(UsuarioDB.id != usuario_id_ignorar)

    resultado = await db.execute(select(UsuarioDB).where(*filtros))
    usuario_existente = resultado.scalar_one_or_none()

    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com este e-mail.",
        )


async def verificar_cpf_unico(
    db: AsyncSession,
    cpf: Optional[str],
    usuario_id_ignorar: Optional[str] = None,
) -> None:
    if not cpf:
        return

    filtros = [UsuarioDB.cpf == cpf]

    if usuario_id_ignorar:
        filtros.append(UsuarioDB.id != usuario_id_ignorar)

    resultado = await db.execute(select(UsuarioDB).where(*filtros))
    usuario_existente = resultado.scalar_one_or_none()

    if usuario_existente:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um usuário com este CPF.",
        )


def aplicar_dados_usuario(
    usuario: UsuarioDB,
    dados: dict,
    permitir_ativo: bool = False,
    permitir_global: bool = False,
) -> None:
    campos_permitidos = {
        "nome",
        "email",
        "perfil_acesso",
        "cpf",
        "telefone",
        "avatar_url",
        "data_nascimento",
        "genero",
        "rg",
        "orgao_emissor",
        "estado_civil",
        "nacionalidade",
        "naturalidade",
        "cep",
        "logradouro",
        "numero",
        "complemento",
        "bairro",
        "cidade",
        "uf",
        "cargo",
        "setor",
        "nfp_captador_vinculo",
        "instituicao_id",
        "conselho_profissional",
        "numero_conselho",
        "carga_horaria",
        "data_admissao",
        "data_desligamento",
        "motivo_desligamento",
        "observacoes_profissionais",
    }

    if permitir_ativo:
        campos_permitidos.add("ativo")

    if permitir_global:
        campos_permitidos.add("is_global")

    for campo, valor in dados.items():
        if campo not in campos_permitidos:
            continue

        if campo == "perfil_acesso":
            valor = normalizar_perfil_acesso(valor)

        if campo == "email" and isinstance(valor, str):
            valor = valor.lower().strip()

        setattr(usuario, campo, valor)


async def desvincular_conviventes_do_usuario_inativo(
    db: AsyncSession,
    *,
    usuario_id: str,
    instituicao_id: str,
) -> int:
    resultado = await db.execute(
        update(ConviventeDB)
        .where(
            ConviventeDB.instituicao_id == instituicao_id,
            ConviventeDB.tecnico_id == usuario_id,
        )
        .values(tecnico_id=None)
    )

    return int(resultado.rowcount or 0)


def usuario_para_response(usuario: UsuarioDB) -> UsuarioResponse:
    return UsuarioResponse.model_validate(usuario)


def usuario_para_resumo(usuario: UsuarioDB) -> UsuarioResumoResponse:
    return UsuarioResumoResponse.model_validate(usuario)


def incrementar_token_version(usuario: UsuarioDB) -> None:
    usuario.token_version = int(getattr(usuario, "token_version", 0) or 0) + 1


def usuario_pode_gerenciar_globais(usuario_atual: dict) -> bool:
    return bool(usuario_atual.get("is_global"))


async def exigir_gestor_ou_global(
    usuario_atual: dict = Depends(get_usuario_logado),
) -> dict:
    if usuario_eh_gestor(usuario_atual) or usuario_atual.get("is_global"):
        return usuario_atual

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas gestores ou usuários globais podem gerenciar usuários.",
    )


async def exigir_gestor_global_ou_oficineiro_listagem(
    usuario_atual: dict = Depends(get_usuario_logado),
) -> dict:
    if (
        usuario_eh_gestor(usuario_atual)
        or usuario_atual.get("is_global")
        or usuario_eh_oficineiro(usuario_atual)
    ):
        return usuario_atual

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Sem permissão para listar usuários da equipe.",
    )


def validar_alteracao_global(
    usuario_atual: dict,
    valor_global_solicitado: Optional[bool],
) -> None:
    if valor_global_solicitado is None:
        return

    if not usuario_pode_gerenciar_globais(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas usuários globais podem conceder ou remover acesso global.",
        )


# =====================================================================
# ME
# =====================================================================

@router.get("/me", response_model=UsuarioResponse)
async def obter_meu_usuario(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = obter_usuario_id(usuario_atual)

    if not usuario_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )

    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=obter_instituicao_escopo(usuario_atual),
    )

    return usuario_para_response(usuario)


# =====================================================================
# LISTAR
# =====================================================================

@router.get("", response_model=list[UsuarioResumoResponse])
async def listar_usuarios(
    busca: Optional[str] = Query(default=None),
    perfil_acesso: Optional[str] = Query(default=None),
    ativo: Optional[bool] = Query(default=None),
    limite: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_gestor_global_ou_oficineiro_listagem),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    organizacao_id = usuario_atual.get("organizacao_id")
    projeto = await carregar_projeto_atual(db, instituicao_id)
    filtros = [
        UsuarioDB.instituicao_id == instituicao_id,
        UsuarioDB.perfil_acesso != "Manutenção",
        UsuarioDB.perfil_acesso != PERFIL_ADM_GLOBAL,
        UsuarioDB.perfil_acesso != PERFIL_ADM_PRODUCAO,
    ]

    if ativo is not None:
        filtros.append(UsuarioDB.ativo == ativo)

    if perfil_acesso:
        filtros.append(
            UsuarioDB.perfil_acesso == normalizar_perfil_acesso(perfil_acesso)
        )

    if busca:
        termo = f"%{busca.strip()}%"
        filtros.append(
            or_(
                UsuarioDB.nome.ilike(termo),
                UsuarioDB.email.ilike(termo),
                UsuarioDB.cpf.ilike(termo),
                UsuarioDB.cargo.ilike(termo),
                UsuarioDB.setor.ilike(termo),
            )
        )

    resultado = await db.execute(
        select(UsuarioDB)
        .where(*filtros)
        .order_by(UsuarioDB.nome.asc())
        .offset(offset)
        .limit(limite)
    )
    usuarios = list(resultado.scalars().all())

    # ADM Produção do projeto: por vinculo NFP (= projeto), na mesma organização.
    nome_projeto = getattr(projeto, "nome_fantasia", None) if projeto else None
    incluir_adm_producao = (
        nome_projeto
        and organizacao_id
        and (
            not perfil_acesso
            or normalizar_perfil_acesso(perfil_acesso) == PERFIL_ADM_PRODUCAO
        )
    )
    if incluir_adm_producao:
        filtros_adm = [
            UsuarioDB.organizacao_id == organizacao_id,
            UsuarioDB.perfil_acesso == PERFIL_ADM_PRODUCAO,
        ]
        if ativo is not None:
            filtros_adm.append(UsuarioDB.ativo == ativo)
        if busca:
            termo = f"%{busca.strip()}%"
            filtros_adm.append(
                or_(
                    UsuarioDB.nome.ilike(termo),
                    UsuarioDB.email.ilike(termo),
                    UsuarioDB.cpf.ilike(termo),
                    UsuarioDB.cargo.ilike(termo),
                    UsuarioDB.setor.ilike(termo),
                )
            )
        adm_rows = (
            await db.execute(
                select(UsuarioDB)
                .where(*filtros_adm)
                .order_by(UsuarioDB.nome.asc())
            )
        ).scalars().all()
        ids_ja = {u.id for u in usuarios}
        alinhou_instituicao = False
        for adm in adm_rows:
            if adm.id in ids_ja:
                continue
            if not vinculo_pertence_ao_projeto(
                getattr(adm, "nfp_captador_vinculo", None),
                nome_projeto,
            ):
                continue
            if adm.instituicao_id != instituicao_id:
                adm.instituicao_id = instituicao_id
                alinhou_instituicao = True
            usuarios.append(adm)
        if alinhou_instituicao:
            try:
                await db.commit()
            except Exception:
                await db.rollback()

    usuarios.sort(key=lambda u: (u.nome or "").lower())
    return [usuario_para_resumo(usuario) for usuario in usuarios]


# =====================================================================
# USUÁRIOS DA ORGANIZAÇÃO — ADM Global / ADM Produção
# =====================================================================

@router.get("/organizacao/adm-global", response_model=list[UsuarioResumoResponse])
async def listar_adm_global_organizacao(
    busca: Optional[str] = Query(default=None),
    ativo: Optional[bool] = Query(default=None),
    perfil: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_gestao_adm_global_org(usuario_atual)
    organizacao_id = usuario_atual.get("organizacao_id")
    if not organizacao_id:
        raise HTTPException(status_code=400, detail="Usuário sem organização vinculada.")

    perfis = list(PERFIS_ADM_NFP_ORG)
    if perfil:
        perfis = [perfil_adm_nfp_org_valido(perfil)]

    filtros = [
        UsuarioDB.organizacao_id == organizacao_id,
        UsuarioDB.perfil_acesso.in_(perfis),
    ]
    if ativo is not None:
        filtros.append(UsuarioDB.ativo == ativo)
    if busca:
        termo = f"%{busca.strip()}%"
        filtros.append(
            or_(
                UsuarioDB.nome.ilike(termo),
                UsuarioDB.email.ilike(termo),
            )
        )

    resultado = await db.execute(
        select(UsuarioDB)
        .where(*filtros)
        .order_by(UsuarioDB.perfil_acesso.asc(), UsuarioDB.nome.asc())
    )
    return [usuario_para_resumo(usuario) for usuario in resultado.scalars().all()]


@router.get("/organizacao/vinculos-nfp")
async def listar_vinculos_nfp_organizacao(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    """Lista rotulos de vinculo NFP (projetos da org + Sede + padrao)."""
    if not (
        usuario_eh_manutencao(usuario_atual)
        or usuario_atual.get("is_global")
        or usuario_eh_adm_global(usuario_atual)
        or usuario_eh_gestor(usuario_atual)
    ):
        raise HTTPException(status_code=403, detail="Sem permissão para listar vínculos NFP.")
    organizacao_id = usuario_atual.get("organizacao_id")
    itens = await rotulos_vinculo_da_organizacao(db, organizacao_id)
    return {"itens": itens}


@router.post(
    "/organizacao/adm-global",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_adm_global_organizacao(
    payload: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_gestao_adm_global_org(usuario_atual)
    organizacao_id = usuario_atual.get("organizacao_id")
    if not organizacao_id:
        raise HTTPException(status_code=400, detail="Usuário sem organização vinculada.")

    await verificar_email_unico(db, payload.email)
    await verificar_cpf_unico(db, payload.cpf)

    perfil = perfil_adm_nfp_org_valido(payload.perfil_acesso or PERFIL_ADM_GLOBAL)
    cargo_padrao = "ADM Global NFP" if perfil == PERFIL_ADM_GLOBAL else "ADM Produção NFP"
    instituicao_fallback = obter_instituicao_escopo(usuario_atual)
    vinculo = None
    instituicao_id = instituicao_fallback
    if perfil == PERFIL_ADM_PRODUCAO:
        vinculo, instituicao_id = await aplicar_vinculo_e_instituicao_adm_producao(
            db,
            organizacao_id=organizacao_id,
            captador=getattr(payload, "nfp_captador_vinculo", None) or "",
            instituicao_fallback_id=instituicao_fallback,
        )

    novo_usuario = UsuarioDB(
        instituicao_id=instituicao_id,
        organizacao_id=organizacao_id,
        nome=payload.nome,
        email=payload.email.lower().strip(),
        cpf=payload.cpf,
        telefone=payload.telefone,
        avatar_url=payload.avatar_url,
        senha_hash=gerar_hash_senha(payload.senha),
        perfil_acesso=perfil,
        is_master=False,
        is_global=False,
        ativo=True,
        cargo=payload.cargo or cargo_padrao,
        setor=payload.setor or "NFP – Créditos",
        nfp_captador_vinculo=vinculo,
        criado_em=agora_utc(),
        criado_por_id=obter_usuario_id(usuario_atual),
    )
    db.add(novo_usuario)
    try:
        await db.commit()
        await db.refresh(novo_usuario)
        registrar_evento_auditoria(
            "usuario_adm_nfp_org_criado",
            usuario_atual=usuario_atual,
            usuario_alvo_id=novo_usuario.id,
            perfil_acesso=novo_usuario.perfil_acesso,
        )
    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível criar o usuário ADM NFP.",
        ) from erro

    return usuario_para_response(novo_usuario)


@router.put("/organizacao/adm-global/{usuario_id}", response_model=UsuarioResponse)
async def editar_adm_global_organizacao(
    usuario_id: str,
    payload: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_gestao_adm_global_org(usuario_atual)
    organizacao_id = usuario_atual.get("organizacao_id")
    resultado = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.id == usuario_id,
            UsuarioDB.organizacao_id == organizacao_id,
            UsuarioDB.perfil_acesso.in_(list(PERFIS_ADM_NFP_ORG)),
        )
    )
    usuario = resultado.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário ADM NFP não encontrado.")

    dados = payload.model_dump(exclude_unset=True)
    if "perfil_acesso" in dados and dados["perfil_acesso"]:
        dados["perfil_acesso"] = perfil_adm_nfp_org_valido(dados["perfil_acesso"])
    else:
        dados.pop("perfil_acesso", None)
    dados.pop("is_global", None)

    perfil_final = dados.get("perfil_acesso") or usuario.perfil_acesso
    instituicao_fallback = usuario.instituicao_id or obter_instituicao_escopo(usuario_atual)
    if perfil_final == PERFIL_ADM_PRODUCAO:
        vinculo_in = dados.get(
            "nfp_captador_vinculo",
            getattr(usuario, "nfp_captador_vinculo", None),
        )
        vinculo, instituicao_id = await aplicar_vinculo_e_instituicao_adm_producao(
            db,
            organizacao_id=organizacao_id,
            captador=vinculo_in or "",
            instituicao_fallback_id=instituicao_fallback,
        )
        dados["nfp_captador_vinculo"] = vinculo
        dados["instituicao_id"] = instituicao_id
    else:
        dados["nfp_captador_vinculo"] = None

    if "email" in dados and dados["email"]:
        await verificar_email_unico(db, dados["email"], usuario_id_ignorar=usuario.id)
        dados["email"] = dados["email"].lower().strip()
    if "cpf" in dados:
        await verificar_cpf_unico(db, dados.get("cpf"), usuario_id_ignorar=usuario.id)

    aplicar_dados_usuario(usuario, dados, permitir_ativo=True, permitir_global=False)
    usuario.atualizado_em = agora_utc()
    usuario.atualizado_por_id = obter_usuario_id(usuario_atual)

    try:
        await db.commit()
        await db.refresh(usuario)
    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Não foi possível atualizar o usuário ADM NFP.",
        ) from erro

    return usuario_para_response(usuario)


@router.patch("/organizacao/adm-global/{usuario_id}/status", response_model=UsuarioResponse)
async def status_adm_global_organizacao(
    usuario_id: str,
    payload: UsuarioAtivarInativar,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_gestao_adm_global_org(usuario_atual)
    organizacao_id = usuario_atual.get("organizacao_id")
    resultado = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.id == usuario_id,
            UsuarioDB.organizacao_id == organizacao_id,
            UsuarioDB.perfil_acesso.in_(list(PERFIS_ADM_NFP_ORG)),
        )
    )
    usuario = resultado.scalar_one_or_none()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário ADM NFP não encontrado.")

    usuario.ativo = payload.ativo
    if payload.ativo:
        usuario.inativado_em = None
        usuario.data_desligamento = None
        usuario.motivo_desligamento = None
        usuario.inativado_por_id = None
    else:
        usuario.inativado_em = agora_utc()
        usuario.inativado_por_id = obter_usuario_id(usuario_atual)
        usuario.data_desligamento = payload.data_desligamento
        usuario.motivo_desligamento = payload.motivo_desligamento
        incrementar_token_version(usuario)

    usuario.atualizado_em = agora_utc()
    await db.commit()
    await db.refresh(usuario)
    return usuario_para_response(usuario)


# =====================================================================
# DETALHAR
# =====================================================================

@router.get("/{usuario_id}", response_model=UsuarioResponse)
async def obter_usuario(
    usuario_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_gestor_ou_global),
):
    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=obter_instituicao_escopo(usuario_atual),
    )
    exigir_nao_manutencao(usuario)
    exigir_nao_adm_global_na_lista_projeto(usuario)

    return usuario_para_response(usuario)


# =====================================================================
# CRIAR
# Regra: somente Gestor cria usuários.
# =====================================================================

@router.post(
    "",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_usuario(
    payload: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_gestor_ou_global),
):
    perfil_normalizado = normalizar_perfil_acesso(payload.perfil_acesso)
    if perfil_normalizado == PERFIL_ADM_GLOBAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Crie usuários ADM Global na aba Usuários da organização.",
        )
    solicita_acesso_global = bool(payload.is_global) or perfil_normalizado == "Global"

    validar_alteracao_global(
        usuario_atual,
        True if solicita_acesso_global else None,
    )
    await verificar_email_unico(db, payload.email)
    await verificar_cpf_unico(db, payload.cpf)

    usuario_criador_id = obter_usuario_id(usuario_atual)
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    organizacao_id = usuario_atual.get("organizacao_id")
    vinculo = None
    cargo = payload.cargo
    setor = payload.setor

    if perfil_normalizado == PERFIL_ADM_PRODUCAO:
        projeto = await carregar_projeto_atual(db, instituicao_id)
        if not projeto:
            raise HTTPException(
                status_code=400,
                detail="Projeto atual não encontrado para vincular o ADM Produção.",
            )
        vinculo, instituicao_id = await aplicar_vinculo_e_instituicao_adm_producao(
            db,
            organizacao_id=organizacao_id,
            captador=rotulo_captador_de_projeto(projeto.nome_fantasia) or projeto.nome_fantasia,
            instituicao_fallback_id=instituicao_id,
        )
        if not vinculo_pertence_ao_projeto(vinculo, projeto.nome_fantasia):
            raise HTTPException(
                status_code=400,
                detail="No projeto, ADM Produção só pode ser criado com vínculo deste projeto.",
            )
        cargo = cargo or "ADM Produção NFP"
        setor = setor or "NFP – Créditos"

    novo_usuario = UsuarioDB(
        instituicao_id=instituicao_id,
        organizacao_id=organizacao_id,
        nome=payload.nome,
        email=payload.email.lower().strip(),
        cpf=payload.cpf,
        telefone=payload.telefone,
        avatar_url=payload.avatar_url,
        senha_hash=gerar_hash_senha(payload.senha),
        perfil_acesso=perfil_normalizado,
        is_master=False,
        is_global=bool(payload.is_global),
        ativo=True,
        data_nascimento=payload.data_nascimento,
        genero=payload.genero,
        rg=payload.rg,
        orgao_emissor=payload.orgao_emissor,
        estado_civil=payload.estado_civil,
        nacionalidade=payload.nacionalidade,
        naturalidade=payload.naturalidade,
        cep=payload.cep,
        logradouro=payload.logradouro,
        numero=payload.numero,
        complemento=payload.complemento,
        bairro=payload.bairro,
        cidade=payload.cidade,
        uf=payload.uf,
        cargo=cargo,
        setor=setor,
        nfp_captador_vinculo=vinculo,
        conselho_profissional=payload.conselho_profissional,
        numero_conselho=payload.numero_conselho,
        carga_horaria=payload.carga_horaria,
        data_admissao=payload.data_admissao,
        data_desligamento=payload.data_desligamento,
        motivo_desligamento=payload.motivo_desligamento,
        observacoes_profissionais=payload.observacoes_profissionais,
        criado_em=agora_utc(),
        criado_por_id=usuario_criador_id,
    )

    db.add(novo_usuario)

    try:
        await db.commit()
        await db.refresh(novo_usuario)
        registrar_evento_auditoria(
            "usuario_criado",
            usuario_atual=usuario_atual,
            usuario_alvo_id=novo_usuario.id,
            perfil_acesso=novo_usuario.perfil_acesso,
            usuario_global=bool(novo_usuario.is_global),
        )

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível criar o usuário. Verifique os dados informados.",
        ) from erro

    return usuario_para_response(novo_usuario)


# =====================================================================
# EDITAR
# Regra: somente Gestor edita usuários.
# =====================================================================

@router.put("/{usuario_id}", response_model=UsuarioResponse)
async def editar_usuario(
    usuario_id: str,
    payload: UsuarioUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_gestor_ou_global),
):
    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=obter_instituicao_escopo(usuario_atual),
    )
    exigir_nao_manutencao(usuario)
    exigir_nao_adm_global_na_lista_projeto(usuario)

    dados = payload.model_dump(exclude_unset=True)
    perfil_final = normalizar_perfil_acesso(
        dados.get("perfil_acesso") or usuario.perfil_acesso
    )
    if perfil_final == PERFIL_ADM_GLOBAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuários ADM Global são gerenciados na aba Usuários da organização.",
        )
    validar_alteracao_global(usuario_atual, dados.get("is_global"))

    instituicao_id = obter_instituicao_escopo(usuario_atual)
    organizacao_id = usuario_atual.get("organizacao_id")
    projeto = await carregar_projeto_atual(db, instituicao_id)

    if perfil_final == PERFIL_ADM_PRODUCAO:
        if not projeto:
            raise HTTPException(status_code=400, detail="Projeto atual não encontrado.")
        vinculo, instituicao_resolvida = await aplicar_vinculo_e_instituicao_adm_producao(
            db,
            organizacao_id=organizacao_id,
            captador=rotulo_captador_de_projeto(projeto.nome_fantasia) or projeto.nome_fantasia,
            instituicao_fallback_id=instituicao_id,
        )
        if not vinculo_pertence_ao_projeto(vinculo, projeto.nome_fantasia):
            raise HTTPException(
                status_code=400,
                detail="No projeto, ADM Produção só pode ficar vinculado a este projeto.",
            )
        dados["nfp_captador_vinculo"] = vinculo
        dados["instituicao_id"] = instituicao_resolvida
        dados.setdefault("cargo", getattr(usuario, "cargo", None) or "ADM Produção NFP")
        dados.setdefault("setor", getattr(usuario, "setor", None) or "NFP – Créditos")
    else:
        dados["nfp_captador_vinculo"] = None

    if "email" in dados and dados["email"]:
        await verificar_email_unico(
            db=db,
            email=dados["email"],
            usuario_id_ignorar=usuario.id,
        )

    if "cpf" in dados and dados["cpf"]:
        await verificar_cpf_unico(
            db=db,
            cpf=dados["cpf"],
            usuario_id_ignorar=usuario.id,
        )

    ativo_anterior = bool(getattr(usuario, "ativo", True))
    ativo_novo = dados.get("ativo", ativo_anterior)

    aplicar_dados_usuario(
        usuario=usuario,
        dados=dados,
        permitir_ativo=True,
        permitir_global=usuario_pode_gerenciar_globais(usuario_atual),
    )

    usuario.atualizado_em = agora_utc()
    usuario.atualizado_por_id = obter_usuario_id(usuario_atual)

    conviventes_desvinculados = 0

    if ativo_anterior and ativo_novo is False:
        usuario.inativado_em = agora_utc()
        usuario.inativado_por_id = obter_usuario_id(usuario_atual)
        conviventes_desvinculados = await desvincular_conviventes_do_usuario_inativo(
            db,
            usuario_id=usuario.id,
            instituicao_id=obter_instituicao_escopo(usuario_atual),
        )

    if not ativo_anterior and ativo_novo is True:
        usuario.inativado_em = None
        usuario.inativado_por_id = None

    try:
        await db.commit()
        await db.refresh(usuario)
        registrar_evento_auditoria(
            "usuario_editado",
            usuario_atual=usuario_atual,
            usuario_alvo_id=usuario.id,
            campos_alterados=",".join(sorted(dados.keys())),
            ativo_anterior=ativo_anterior,
            ativo_novo=bool(getattr(usuario, "ativo", True)),
            conviventes_desvinculados=conviventes_desvinculados,
        )

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível editar o usuário.",
        ) from erro

    return usuario_para_response(usuario)


# =====================================================================
# ATIVAR / INATIVAR
# Regra: somente Gestor ativa/inativa usuários.
# =====================================================================

@router.patch("/{usuario_id}/status", response_model=UsuarioResponse)
async def alterar_status_usuario(
    usuario_id: str,
    payload: UsuarioAtivarInativar,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_gestor_ou_global),
):
    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=obter_instituicao_escopo(usuario_atual),
    )
    exigir_nao_manutencao(usuario)
    exigir_nao_adm_global_na_lista_projeto(usuario)

    usuario_logado_id = obter_usuario_id(usuario_atual)

    if usuario.id == usuario_logado_id and payload.ativo is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode inativar o próprio usuário.",
        )

    usuario.ativo = payload.ativo
    usuario.atualizado_em = agora_utc()
    usuario.atualizado_por_id = usuario_logado_id

    if payload.ativo:
        usuario.inativado_em = None
        usuario.inativado_por_id = None
    else:
        agora = agora_utc()
        usuario.inativado_em = agora
        usuario.inativado_por_id = usuario_logado_id
        usuario.data_desligamento = payload.data_desligamento or agora.date()
        usuario.motivo_desligamento = payload.motivo_desligamento.strip()
        conviventes_desvinculados = await desvincular_conviventes_do_usuario_inativo(
            db,
            usuario_id=usuario.id,
            instituicao_id=obter_instituicao_escopo(usuario_atual),
        )

    try:
        await db.commit()
        await db.refresh(usuario)
        registrar_evento_auditoria(
            "usuario_status_alterado",
            usuario_atual=usuario_atual,
            usuario_alvo_id=usuario.id,
            ativo=bool(usuario.ativo),
            conviventes_desvinculados=conviventes_desvinculados if not payload.ativo else 0,
        )

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível alterar o status do usuário.",
        ) from erro

    return usuario_para_response(usuario)


# =====================================================================
# REDEFINIR SENHA
# Regra: somente Gestor redefine senha de usuários.
# =====================================================================

@router.patch("/{usuario_id}/senha", response_model=UsuarioResponse)
async def redefinir_senha_usuario(
    usuario_id: str,
    payload: UsuarioDefinirSenha,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_gestor_ou_global),
):
    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=obter_instituicao_escopo(usuario_atual),
    )
    exigir_nao_manutencao(usuario)

    usuario.senha_hash = gerar_hash_senha(payload.nova_senha)
    incrementar_token_version(usuario)
    usuario.atualizado_em = agora_utc()
    usuario.atualizado_por_id = obter_usuario_id(usuario_atual)

    try:
        await db.commit()
        await db.refresh(usuario)
        registrar_evento_auditoria(
            "senha_redefinida_por_gestor",
            usuario_atual=usuario_atual,
            usuario_alvo_id=usuario.id,
        )

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível redefinir a senha.",
        ) from erro

    return usuario_para_response(usuario)


# =====================================================================
# ALTERAR MINHA SENHA
# Regra: usuário autenticado altera a própria senha informando senha atual.
# =====================================================================

@router.patch("/me/senha/alterar", response_model=UsuarioResponse)
async def alterar_minha_senha(
    payload: UsuarioAlterarSenha,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    usuario_id = obter_usuario_id(usuario_atual)

    if not usuario_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido.",
        )

    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=obter_instituicao_escopo(usuario_atual),
    )

    if not payload.senha_atual:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual obrigatória.",
        )

    if not verificar_senha(payload.senha_atual, usuario.senha_hash):
        registrar_evento_auditoria(
            "senha_atual_invalida",
            usuario_atual=usuario_atual,
            usuario_alvo_id=usuario.id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual inválida.",
        )

    usuario.senha_hash = gerar_hash_senha(payload.nova_senha)
    incrementar_token_version(usuario)
    usuario.atualizado_em = agora_utc()
    usuario.atualizado_por_id = usuario.id

    try:
        await db.commit()
        await db.refresh(usuario)
        registrar_evento_auditoria(
            "senha_alterada_pelo_usuario",
            usuario_atual=usuario_atual,
            usuario_alvo_id=usuario.id,
        )

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível alterar a senha.",
        ) from erro

    return usuario_para_response(usuario)
