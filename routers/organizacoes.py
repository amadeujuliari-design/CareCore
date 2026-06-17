from datetime import date, datetime, time, timedelta
import os
from pathlib import Path
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import (
    AvisoDB,
    ConviventeDB,
    InstituicaoDB,
    LeitoDB,
    OcorrenciaConviventeDB,
    OrganizacaoDB,
    QuartoDB,
    RegistroRotinaDB,
    SisaDivergenciaDB,
    SisaLancamentoDB,
    UsuarioDB,
)
from schemas import (
    GestaoGlobalProjetoResumo,
    GestaoGlobalResumoResponse,
    GestaoGlobalTotais,
    IdentidadeRelatorioResponse,
    IdentidadeRelatorioUpdate,
    InstituicaoCreate,
    InstituicaoResponse,
    Token,
)
from security import (
    criar_access_token,
    get_usuario_logado,
    normalizar_perfil_acesso,
    usuario_eh_gestor,
    usuario_eh_manutencao,
)
from imagem_upload import eh_arquivo_imagem, padronizar_upload_imagem
from storage_uploads import (
    StorageErro,
    extrair_bucket_caminho_storage,
    remover_supabase_storage,
    storage_supabase_configurado,
    upload_supabase_storage,
)


router = APIRouter(
    prefix="/api/organizacao",
    tags=["Organização e Projetos"],
)

_UPLOADS_RELATORIOS = Path("uploads/relatorios")
_TAMANHO_MAXIMO_LOGO_BYTES = 2 * 1024 * 1024
_AMBIENTES_COM_UPLOAD_LOCAL = {"local", "development", "dev", "test", "testing"}


def _upload_local_relatorios_permitido() -> bool:
    app_env = os.getenv("APP_ENV", "local").strip().lower()
    return app_env in _AMBIENTES_COM_UPLOAD_LOCAL


def _logo_relatorio_local_indisponivel(caminho_logo: str | None) -> bool:
    if _upload_local_relatorios_permitido():
        return False

    caminho_normalizado = (caminho_logo or "").strip().replace("\\", "/")
    return caminho_normalizado.startswith(("/uploads/relatorios/", "uploads/relatorios/"))


def _content_type_logo(extensao: str) -> str:
    return "image/png" if extensao == ".png" else "image/jpeg"


def _remover_logo_relatorio_armazenado(caminho_logo: str | None) -> None:
    if not caminho_logo:
        return

    storage_ref = extrair_bucket_caminho_storage(caminho_logo)
    if storage_ref and storage_supabase_configurado():
        bucket, caminho = storage_ref
        try:
            remover_supabase_storage(bucket, caminho)
        except StorageErro:
            pass
        return

    caminho_normalizado = caminho_logo.strip().replace("\\", "/")
    if caminho_normalizado.startswith("/uploads/relatorios/"):
        caminho_relativo = caminho_normalizado.removeprefix("/uploads/relatorios/")
    elif caminho_normalizado.startswith("uploads/relatorios/"):
        caminho_relativo = caminho_normalizado.removeprefix("uploads/relatorios/")
    else:
        return

    candidato = (_UPLOADS_RELATORIOS / caminho_relativo).resolve()
    try:
        candidato.relative_to(_UPLOADS_RELATORIOS.resolve())
    except ValueError:
        return

    if candidato.is_file():
        candidato.unlink()


def exigir_usuario_global(usuario_atual: dict) -> None:
    if not usuario_atual.get("is_global"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas usuários globais podem gerenciar projetos da organização.",
        )


def exigir_gestor_projeto(usuario_atual: dict) -> None:
    if not usuario_eh_gestor(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas gestores podem alterar a identidade dos relatórios.",
        )


def montar_payload_token(usuario: UsuarioDB, projeto: InstituicaoDB | None = None) -> dict:
    perfil_acesso = normalizar_perfil_acesso(getattr(usuario, "perfil_acesso", None))

    return {
        "sub": usuario.id,
        "id": usuario.id,
        "usuario_id": usuario.id,
        "nome": usuario.nome,
        "email": usuario.email,
        "instituicao_id": getattr(projeto, "id", None) or usuario.instituicao_id,
        "organizacao_id": getattr(usuario, "organizacao_id", None),
        "projeto_nome": getattr(projeto, "nome_fantasia", None),
        "perfil_acesso": perfil_acesso,
        "is_master": bool(getattr(usuario, "is_master", False)),
        "is_global": bool(getattr(usuario, "is_global", False)),
        "is_manutencao": usuario_eh_manutencao(usuario),
        "ativo": bool(getattr(usuario, "ativo", True)),
    }


async def contar(db: AsyncSession, consulta) -> int:
    resultado = await db.execute(consulta)
    return int(resultado.scalar() or 0)


def calcular_ocupacao(leitos_ocupados: int, leitos_total: int) -> float:
    if leitos_total <= 0:
        return 0

    return round((leitos_ocupados / leitos_total) * 100, 1)


def calcular_taxa_sucesso(saidas_qualificadas: int, inativacoes: int) -> float:
    if inativacoes <= 0:
        return 0

    return round((saidas_qualificadas / inativacoes) * 100, 1)


def aplicar_periodo_inativacao(consulta, data_inicio: date | None, data_fim: date | None):
    if data_inicio:
        consulta = consulta.where(
            ConviventeDB.inativado_em >= datetime.combine(data_inicio, time.min),
        )

    if data_fim:
        consulta = consulta.where(
            ConviventeDB.inativado_em <= datetime.combine(data_fim, time.max),
        )

    return consulta


@router.get("/projetos", response_model=list[InstituicaoResponse])
async def listar_projetos_organizacao(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_global(usuario_atual)

    if usuario_eh_manutencao(usuario_atual):
        resultado = await db.execute(
            select(InstituicaoDB).order_by(InstituicaoDB.nome_fantasia)
        )
        return resultado.scalars().all()

    organizacao_id = usuario_atual.get("organizacao_id")
    if not organizacao_id:
        return []

    resultado = await db.execute(
        select(InstituicaoDB)
        .where(InstituicaoDB.organizacao_id == organizacao_id)
        .order_by(InstituicaoDB.nome_fantasia)
    )

    return resultado.scalars().all()


@router.get("/gestao-global/resumo", response_model=GestaoGlobalResumoResponse)
async def obter_resumo_gestao_global(
    data_inicio: date | None = None,
    data_fim: date | None = None,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_global(usuario_atual)

    organizacao_id = usuario_atual.get("organizacao_id")
    if not organizacao_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário sem organização vinculada.",
        )

    if data_inicio and data_fim and data_inicio > data_fim:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data inicial não pode ser maior que a data final.",
        )

    resultado_organizacao = await db.execute(
        select(OrganizacaoDB).where(OrganizacaoDB.id == organizacao_id)
    )
    organizacao = resultado_organizacao.scalar_one_or_none()

    resultado_projetos = await db.execute(
        select(InstituicaoDB)
        .where(InstituicaoDB.organizacao_id == organizacao_id)
        .order_by(InstituicaoDB.nome_fantasia)
    )
    projetos = resultado_projetos.scalars().all()

    resumos: list[GestaoGlobalProjetoResumo] = []

    for projeto in projetos:
        projeto_id = projeto.id

        conviventes_total = await contar(
            db,
            select(func.count()).select_from(ConviventeDB).where(
                ConviventeDB.instituicao_id == projeto_id,
            ),
        )
        conviventes_ativos = await contar(
            db,
            select(func.count()).select_from(ConviventeDB).where(
                ConviventeDB.instituicao_id == projeto_id,
                ConviventeDB.status == "Ativo",
            ),
        )
        saidas_qualificadas = await contar(
            db,
            select(func.count()).select_from(ConviventeDB).where(
                ConviventeDB.instituicao_id == projeto_id,
                ConviventeDB.status == "Saída qualificada",
            ),
        )
        consulta_saidas_periodo = select(func.count()).select_from(ConviventeDB).where(
            ConviventeDB.instituicao_id == projeto_id,
            ConviventeDB.status == "Saída qualificada",
        )
        consulta_inativacoes_periodo = select(func.count()).select_from(ConviventeDB).where(
            ConviventeDB.instituicao_id == projeto_id,
            ConviventeDB.status.in_(["Inativado", "Bloqueado", "Saída qualificada"]),
        )

        if data_inicio or data_fim:
            consulta_saidas_periodo = aplicar_periodo_inativacao(
                consulta_saidas_periodo,
                data_inicio,
                data_fim,
            )
            consulta_inativacoes_periodo = aplicar_periodo_inativacao(
                consulta_inativacoes_periodo,
                data_inicio,
                data_fim,
            )

        saidas_qualificadas_periodo = await contar(db, consulta_saidas_periodo)
        inativacoes_periodo = await contar(db, consulta_inativacoes_periodo)
        usuarios_ativos = await contar(
            db,
            select(func.count()).select_from(UsuarioDB).where(
                UsuarioDB.instituicao_id == projeto_id,
                UsuarioDB.ativo == True,  # noqa: E712
            ),
        )
        quartos_ativos = await contar(
            db,
            select(func.count()).select_from(QuartoDB).where(
                QuartoDB.instituicao_id == projeto_id,
                QuartoDB.is_active == True,  # noqa: E712
            ),
        )
        leitos_total = await contar(
            db,
            select(func.count()).select_from(LeitoDB).join(QuartoDB).where(
                QuartoDB.instituicao_id == projeto_id,
            ),
        )
        leitos_ocupados = await contar(
            db,
            select(func.count()).select_from(LeitoDB).join(QuartoDB).where(
                QuartoDB.instituicao_id == projeto_id,
                LeitoDB.status == "Ocupado",
            ),
        )
        rotina_registros = await contar(
            db,
            select(func.count()).select_from(RegistroRotinaDB).where(
                RegistroRotinaDB.instituicao_id == projeto_id,
                RegistroRotinaDB.cancelado == False,  # noqa: E712
            ),
        )
        rotina_cancelados = await contar(
            db,
            select(func.count()).select_from(RegistroRotinaDB).where(
                RegistroRotinaDB.instituicao_id == projeto_id,
                RegistroRotinaDB.cancelado == True,  # noqa: E712
            ),
        )
        ocorrencias_total = await contar(
            db,
            select(func.count()).select_from(OcorrenciaConviventeDB).where(
                OcorrenciaConviventeDB.instituicao_id == projeto_id,
            ),
        )
        ocorrencias_pendentes = await contar(
            db,
            select(func.count()).select_from(OcorrenciaConviventeDB).where(
                OcorrenciaConviventeDB.instituicao_id == projeto_id,
                OcorrenciaConviventeDB.status_resolucao != "Resolvido",
            ),
        )
        ocorrencias_alta_critica = await contar(
            db,
            select(func.count()).select_from(OcorrenciaConviventeDB).where(
                OcorrenciaConviventeDB.instituicao_id == projeto_id,
                OcorrenciaConviventeDB.status_resolucao != "Resolvido",
                func.lower(OcorrenciaConviventeDB.prioridade).in_(
                    ["alta", "critica", "crítica", "critico", "crítico"],
                ),
            ),
        )
        avisos_ativos = await contar(
            db,
            select(func.count()).select_from(AvisoDB).where(
                AvisoDB.instituicao_id == projeto_id,
                AvisoDB.ativo == True,  # noqa: E712
            ),
        )
        sisa_lancamentos = await contar(
            db,
            select(func.count()).select_from(SisaLancamentoDB).where(
                SisaLancamentoDB.instituicao_id == projeto_id,
            ),
        )
        sisa_divergencias_pendentes = await contar(
            db,
            select(func.count()).select_from(SisaDivergenciaDB).where(
                SisaDivergenciaDB.instituicao_id == projeto_id,
                SisaDivergenciaDB.status != "Resolvido",
            ),
        )

        resumos.append(
            GestaoGlobalProjetoResumo(
                id=projeto.id,
                nome=projeto.nome_fantasia,
                tipo_projeto=projeto.tipo_projeto,
                is_active=bool(projeto.is_active),
                status_assinatura=projeto.status_assinatura,
                bloqueado=bool(projeto.bloqueado),
                conviventes_total=conviventes_total,
                conviventes_ativos=conviventes_ativos,
                saidas_qualificadas=saidas_qualificadas,
                saidas_qualificadas_periodo=saidas_qualificadas_periodo,
                inativacoes_periodo=inativacoes_periodo,
                taxa_sucesso_periodo=calcular_taxa_sucesso(
                    saidas_qualificadas_periodo,
                    inativacoes_periodo,
                ),
                usuarios_ativos=usuarios_ativos,
                quartos_ativos=quartos_ativos,
                leitos_total=leitos_total,
                leitos_ocupados=leitos_ocupados,
                ocupacao_percentual=calcular_ocupacao(leitos_ocupados, leitos_total),
                rotina_registros=rotina_registros,
                rotina_cancelados=rotina_cancelados,
                ocorrencias_total=ocorrencias_total,
                ocorrencias_pendentes=ocorrencias_pendentes,
                ocorrencias_alta_critica=ocorrencias_alta_critica,
                avisos_ativos=avisos_ativos,
                sisa_lancamentos=sisa_lancamentos,
                sisa_divergencias_pendentes=sisa_divergencias_pendentes,
            )
        )

    totais_dict = {
        "projetos": len(resumos),
        "conviventes_total": sum(item.conviventes_total for item in resumos),
        "conviventes_ativos": sum(item.conviventes_ativos for item in resumos),
        "saidas_qualificadas": sum(item.saidas_qualificadas for item in resumos),
        "saidas_qualificadas_periodo": sum(item.saidas_qualificadas_periodo for item in resumos),
        "inativacoes_periodo": sum(item.inativacoes_periodo for item in resumos),
        "usuarios_ativos": sum(item.usuarios_ativos for item in resumos),
        "leitos_total": sum(item.leitos_total for item in resumos),
        "leitos_ocupados": sum(item.leitos_ocupados for item in resumos),
        "rotina_registros": sum(item.rotina_registros for item in resumos),
        "ocorrencias_total": sum(item.ocorrencias_total for item in resumos),
        "ocorrencias_pendentes": sum(item.ocorrencias_pendentes for item in resumos),
        "ocorrencias_alta_critica": sum(item.ocorrencias_alta_critica for item in resumos),
        "avisos_ativos": sum(item.avisos_ativos for item in resumos),
        "sisa_lancamentos": sum(item.sisa_lancamentos for item in resumos),
        "sisa_divergencias_pendentes": sum(item.sisa_divergencias_pendentes for item in resumos),
    }
    totais_dict["ocupacao_percentual"] = calcular_ocupacao(
        totais_dict["leitos_ocupados"],
        totais_dict["leitos_total"],
    )
    totais_dict["taxa_sucesso_periodo"] = calcular_taxa_sucesso(
        totais_dict["saidas_qualificadas_periodo"],
        totais_dict["inativacoes_periodo"],
    )

    projeto_atual_id = usuario_atual.get("instituicao_id")
    projeto_atual = next((projeto for projeto in projetos if projeto.id == projeto_atual_id), None)

    return GestaoGlobalResumoResponse(
        organizacao_id=organizacao_id,
        organizacao_nome=getattr(organizacao, "nome", None),
        projeto_atual_id=projeto_atual_id,
        projeto_atual_nome=getattr(projeto_atual, "nome_fantasia", None),
        periodo_inicio=data_inicio,
        periodo_fim=data_fim,
        totais=GestaoGlobalTotais(**totais_dict),
        projetos=resumos,
    )


@router.get("/projeto-atual", response_model=InstituicaoResponse)
async def obter_projeto_atual(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    resultado = await db.execute(
        select(InstituicaoDB).where(
            InstituicaoDB.id == usuario_atual["instituicao_id"],
        )
    )
    projeto = resultado.scalar_one_or_none()

    if not projeto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Projeto atual não encontrado.",
        )

    return projeto


def montar_identidade_relatorio(projeto: InstituicaoDB) -> IdentidadeRelatorioResponse:
    logo_url = projeto.relatorio_logo_url
    if _logo_relatorio_local_indisponivel(logo_url):
        logo_url = None

    return IdentidadeRelatorioResponse(
        relatorio_logo_url=logo_url,
        relatorio_nome_exibicao=projeto.relatorio_nome_exibicao or projeto.nome_fantasia,
        relatorio_rodape_linha1=projeto.relatorio_rodape_linha1,
        relatorio_rodape_linha2=projeto.relatorio_rodape_linha2,
        relatorio_telefone=projeto.relatorio_telefone or projeto.telefone,
        relatorio_email=projeto.relatorio_email or projeto.email,
        relatorio_site=projeto.relatorio_site,
    )


async def obter_projeto_da_sessao(
    db: AsyncSession,
    usuario_atual: dict,
) -> InstituicaoDB:
    resultado = await db.execute(
        select(InstituicaoDB).where(
            InstituicaoDB.id == usuario_atual["instituicao_id"],
        )
    )
    projeto = resultado.scalar_one_or_none()
    if not projeto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Projeto atual não encontrado.",
        )

    return projeto


@router.get("/identidade-relatorios", response_model=IdentidadeRelatorioResponse)
async def obter_identidade_relatorios(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    projeto = await obter_projeto_da_sessao(db, usuario_atual)
    return montar_identidade_relatorio(projeto)


@router.put("/identidade-relatorios", response_model=IdentidadeRelatorioResponse)
async def atualizar_identidade_relatorios(
    payload: IdentidadeRelatorioUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_gestor_projeto(usuario_atual)
    projeto = await obter_projeto_da_sessao(db, usuario_atual)

    for campo, valor in payload.model_dump().items():
        setattr(projeto, campo, valor.strip() if isinstance(valor, str) else valor)

    await db.commit()
    await db.refresh(projeto)
    return montar_identidade_relatorio(projeto)


@router.post("/identidade-relatorios/logo", response_model=IdentidadeRelatorioResponse)
async def enviar_logo_identidade_relatorios(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_gestor_projeto(usuario_atual)
    projeto = await obter_projeto_da_sessao(db, usuario_atual)

    if not eh_arquivo_imagem(file.filename or "", file.content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Envie uma imagem em PNG, JPG ou WEBP.",
        )

    conteudo = await file.read()
    if len(conteudo) > _TAMANHO_MAXIMO_LOGO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Logo muito grande. O limite é 2 MB.",
        )

    try:
        conteudo, extensao_final = padronizar_upload_imagem(
            conteudo,
            tipo_documento="Logo de Relatório",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível processar a imagem enviada.",
        ) from exc

    nome_arquivo = f"logo_{uuid.uuid4().hex}{extensao_final}"
    caminho_anterior = projeto.relatorio_logo_url

    if storage_supabase_configurado():
        try:
            projeto.relatorio_logo_url = upload_supabase_storage(
                f"relatorios/{projeto.id}/{nome_arquivo}",
                conteudo,
                content_type=_content_type_logo(extensao_final),
            )
        except StorageErro as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível salvar o logotipo no storage persistente.",
            ) from exc
    else:
        if not _upload_local_relatorios_permitido():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Storage persistente não configurado para logotipos. "
                    "Configure CARECORE_SUPABASE_URL e CARECORE_SUPABASE_SERVICE_ROLE_KEY no backend."
                ),
            )

        pasta_projeto = _UPLOADS_RELATORIOS / projeto.id
        pasta_projeto.mkdir(parents=True, exist_ok=True)
        caminho = pasta_projeto / nome_arquivo
        caminho.write_bytes(conteudo)
        projeto.relatorio_logo_url = f"/uploads/relatorios/{projeto.id}/{nome_arquivo}"

    await db.commit()
    await db.refresh(projeto)
    _remover_logo_relatorio_armazenado(caminho_anterior)
    return montar_identidade_relatorio(projeto)


@router.delete("/identidade-relatorios/logo", response_model=IdentidadeRelatorioResponse)
async def remover_logo_identidade_relatorios(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_gestor_projeto(usuario_atual)
    projeto = await obter_projeto_da_sessao(db, usuario_atual)
    caminho_anterior = projeto.relatorio_logo_url
    projeto.relatorio_logo_url = None
    await db.commit()
    await db.refresh(projeto)
    _remover_logo_relatorio_armazenado(caminho_anterior)
    return montar_identidade_relatorio(projeto)


@router.post("/projetos", response_model=InstituicaoResponse, status_code=status.HTTP_201_CREATED)
async def criar_projeto_organizacao(
    payload: InstituicaoCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_global(usuario_atual)

    organizacao_id = usuario_atual.get("organizacao_id")
    if not organizacao_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuário sem organização vinculada.",
        )

    projeto = InstituicaoDB(
        organizacao_id=organizacao_id,
        nome_fantasia=payload.nome_fantasia,
        cnpj=payload.cnpj,
        telefone=payload.telefone,
        email=payload.email,
        cep=payload.cep,
        logradouro=payload.logradouro,
        numero=payload.numero,
        complemento=payload.complemento,
        bairro=payload.bairro,
        cidade=payload.cidade,
        uf=payload.uf,
        tipo_projeto=payload.tipo_projeto or "Projeto",
        projeto_unico=False,
    )

    db.add(projeto)
    await db.commit()
    await db.refresh(projeto)

    return projeto


@router.post("/projetos/{projeto_id}/selecionar", response_model=Token)
async def selecionar_projeto_organizacao(
    projeto_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    exigir_usuario_global(usuario_atual)

    organizacao_id = usuario_atual.get("organizacao_id")

    if usuario_eh_manutencao(usuario_atual):
        resultado_projeto = await db.execute(
            select(InstituicaoDB).where(InstituicaoDB.id == projeto_id)
        )
        projeto = resultado_projeto.scalar_one_or_none()

        if not projeto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Projeto não encontrado.",
            )

        resultado_usuario = await db.execute(
            select(UsuarioDB).where(
                UsuarioDB.id == usuario_atual["id"],
                UsuarioDB.is_global == True,  # noqa: E712
            )
        )
        usuario = resultado_usuario.scalar_one_or_none()

        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário de manutenção não autorizado.",
            )

        token = criar_access_token(
            data=montar_payload_token(usuario, projeto),
            expires_delta=timedelta(hours=12),
        )

        return {
            "access_token": token,
            "token_type": "bearer",
            "usuario": {
                **montar_payload_token(usuario, projeto),
                "avatar_url": getattr(usuario, "avatar_url", None),
            },
        }

    resultado_projeto = await db.execute(
        select(InstituicaoDB).where(
            InstituicaoDB.id == projeto_id,
            InstituicaoDB.organizacao_id == organizacao_id,
        )
    )
    projeto = resultado_projeto.scalar_one_or_none()

    if not projeto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Projeto não encontrado nesta organização.",
        )

    resultado_usuario = await db.execute(
        select(UsuarioDB).where(
            UsuarioDB.id == usuario_atual["id"],
            UsuarioDB.organizacao_id == organizacao_id,
            UsuarioDB.is_global == True,  # noqa: E712
        )
    )
    usuario = resultado_usuario.scalar_one_or_none()

    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário global não autorizado para esta organização.",
        )

    token = criar_access_token(
        data=montar_payload_token(usuario, projeto),
        expires_delta=timedelta(hours=12),
    )

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            **montar_payload_token(usuario, projeto),
            "avatar_url": getattr(usuario, "avatar_url", None),
        },
    }
