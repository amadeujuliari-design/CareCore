# =====================================================================
# ARQUIVO: routers/usuarios.py
# CARECORE+ OFICIAL
# FASE 1B — Usuários, equipe institucional e permissões
# =====================================================================

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import UsuarioDB
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
    get_usuario_logado,
    exigir_gestor,
    gerar_hash_senha,
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
    "Técnico",
    "Orientador",
    "Administrativo",
    "Consulta",
}

PERFIS_LEGADOS_MAPEAMENTO = {
    "Gestao": "Gestor",
    "Gestão": "Gestor",
    "Tecnico": "Técnico",
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
                "Use: Gestor, Técnico, Orientador, Administrativo ou Consulta."
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

    for campo, valor in dados.items():
        if campo not in campos_permitidos:
            continue

        if campo == "perfil_acesso":
            valor = normalizar_perfil_acesso(valor)

        if campo == "email" and isinstance(valor, str):
            valor = valor.lower().strip()

        setattr(usuario, campo, valor)


def usuario_para_response(usuario: UsuarioDB) -> UsuarioResponse:
    return UsuarioResponse.model_validate(usuario)


def usuario_para_resumo(usuario: UsuarioDB) -> UsuarioResumoResponse:
    return UsuarioResumoResponse.model_validate(usuario)


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
        instituicao_id=usuario_atual["instituicao_id"],
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
    usuario_atual: dict = Depends(exigir_gestor),
):
    filtros = [
        UsuarioDB.instituicao_id == usuario_atual["instituicao_id"],
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

    usuarios = resultado.scalars().all()

    return [usuario_para_resumo(usuario) for usuario in usuarios]


# =====================================================================
# DETALHAR
# =====================================================================

@router.get("/{usuario_id}", response_model=UsuarioResponse)
async def obter_usuario(
    usuario_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_gestor),
):
    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=usuario_atual["instituicao_id"],
    )

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
    usuario_atual: dict = Depends(exigir_gestor),
):
    await verificar_email_unico(db, payload.email)
    await verificar_cpf_unico(db, payload.cpf)

    usuario_criador_id = obter_usuario_id(usuario_atual)

    novo_usuario = UsuarioDB(
        instituicao_id=usuario_atual["instituicao_id"],
        nome=payload.nome,
        email=payload.email.lower().strip(),
        cpf=payload.cpf,
        telefone=payload.telefone,
        avatar_url=payload.avatar_url,
        senha_hash=gerar_hash_senha(payload.senha),
        perfil_acesso=normalizar_perfil_acesso(payload.perfil_acesso),
        is_master=False,
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
        cargo=payload.cargo,
        setor=payload.setor,
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

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao criar usuário: {str(erro)}",
        )

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
    usuario_atual: dict = Depends(exigir_gestor),
):
    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=usuario_atual["instituicao_id"],
    )

    dados = payload.model_dump(exclude_unset=True)

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
    )

    usuario.atualizado_em = agora_utc()
    usuario.atualizado_por_id = obter_usuario_id(usuario_atual)

    if ativo_anterior and ativo_novo is False:
        usuario.inativado_em = agora_utc()
        usuario.inativado_por_id = obter_usuario_id(usuario_atual)

    if not ativo_anterior and ativo_novo is True:
        usuario.inativado_em = None
        usuario.inativado_por_id = None

    try:
        await db.commit()
        await db.refresh(usuario)

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao editar usuário: {str(erro)}",
        )

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
    usuario_atual: dict = Depends(exigir_gestor),
):
    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=usuario_atual["instituicao_id"],
    )

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
        usuario.inativado_em = agora_utc()
        usuario.inativado_por_id = usuario_logado_id

    try:
        await db.commit()
        await db.refresh(usuario)

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao alterar status do usuário: {str(erro)}",
        )

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
    usuario_atual: dict = Depends(exigir_gestor),
):
    usuario = await buscar_usuario_por_id(
        db=db,
        usuario_id=usuario_id,
        instituicao_id=usuario_atual["instituicao_id"],
    )

    usuario.senha_hash = gerar_hash_senha(payload.nova_senha)
    usuario.atualizado_em = agora_utc()
    usuario.atualizado_por_id = obter_usuario_id(usuario_atual)

    try:
        await db.commit()
        await db.refresh(usuario)

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao redefinir senha: {str(erro)}",
        )

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
        instituicao_id=usuario_atual["instituicao_id"],
    )

    if not payload.senha_atual:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Senha atual obrigatória.",
        )

    if not verificar_senha(payload.senha_atual, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Senha atual inválida.",
        )

    usuario.senha_hash = gerar_hash_senha(payload.nova_senha)
    usuario.atualizado_em = agora_utc()
    usuario.atualizado_por_id = usuario.id

    try:
        await db.commit()
        await db.refresh(usuario)

    except Exception as erro:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erro ao alterar senha: {str(erro)}",
        )

    return usuario_para_response(usuario)
