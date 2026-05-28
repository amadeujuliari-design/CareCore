# =====================================================================
import contextlib
import os
import uuid
import calendar
from io import BytesIO
from datetime import datetime, timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, String

from database import get_db
from models import (
    ConviventeDB, MotivoInativacaoDB, OrigemEncaminhamentoDB, 
    LeitoDB, DocumentoConviventeDB, OcorrenciaConviventeDB, UsuarioDB,
    InteracaoOcorrenciaDB, ObservadorOcorrenciaDB, RegistroRotinaDB,
    FechamentoMensalDB,
    SisaLancamentoDB
)
from schemas import (
    ConviventeCreate, ConviventeUpdate, ConviventeResponse,
    MotivoInativacaoCreate, MotivoInativacaoResponse,
    OrigemEncaminhamentoCreate, OrigemEncaminhamentoResponse,
    DocumentoResponse, OcorrenciaResponse, InteracaoOcorrenciaCreate, OcorrenciaCreate,
    OcorrenciaRelatorioPrioridades, OcorrenciaPrioridadeResumo,
    RegistroRotinaCreate,
    RegistroRotinaResponse,
    RegistroRotinaEdicao,
    RegistroRotinaCancelamento,
    RegistroRotinaDesfazerRapido,
    FechamentoMensalCreate,
    FechamentoMensalReabertura,
    FechamentoMensalResponse,
    SisaLancamentoCreate,
    SisaLancamentoResponse
)
from security import (
    get_usuario_logado,
    normalizar_perfil_acesso,
    PERFIL_GESTOR,
    usuario_eh_gestor,
)
from routers.conviventes_helpers import (
    PESO_PRIORIDADE,
    PRIORIDADES_OCORRENCIA,
    agora_sao_paulo,
    aplicar_credenciais_convivente_salvar,
    convivente_para_response,
    normalizar_prioridade_ocorrencia,
    usuario_pode_resolver_ocorrencia,
    usuario_pode_ver_credenciais_cofre_convivente,
)
from routers.conviventes_xlsx import (
    gerar_xlsx_convenio_sisa_mensal,
    gerar_xlsx_historico,
)

router = APIRouter(prefix="/api", tags=["Conviventes e Ocorrencias"])

UPLOAD_DIR = "uploads/documentos"
os.makedirs(UPLOAD_DIR, exist_ok=True)
UPLOAD_DIR_ABSOLUTO = os.path.abspath(UPLOAD_DIR)
TAMANHO_MAXIMO_DOCUMENTO_BYTES = 10 * 1024 * 1024
EXTENSOES_DOCUMENTO_PERMITIDAS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
}
CONTENT_TYPES_DOCUMENTO_PERMITIDOS = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def validar_upload_documento(file: UploadFile) -> str:
    nome_original = os.path.basename(file.filename or "")
    extensao = os.path.splitext(nome_original)[1].lower()
    content_type = (file.content_type or "").lower()

    if not nome_original or extensao not in EXTENSOES_DOCUMENTO_PERMITIDAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de arquivo não permitido.",
        )

    if content_type and content_type not in CONTENT_TYPES_DOCUMENTO_PERMITIDOS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de arquivo não permitido.",
        )

    return nome_original


async def salvar_upload_documento(file: UploadFile, caminho_completo: str) -> None:
    tamanho_total = 0

    with open(caminho_completo, "wb") as buffer:
        while True:
            bloco = await file.read(1024 * 1024)

            if not bloco:
                break

            tamanho_total += len(bloco)

            if tamanho_total > TAMANHO_MAXIMO_DOCUMENTO_BYTES:
                buffer.close()
                with contextlib.suppress(FileNotFoundError):
                    os.remove(caminho_completo)

                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="Arquivo muito grande. O limite é 10 MB.",
                )

            buffer.write(bloco)


def caminho_absoluto_documento(caminho_arquivo: str) -> str:
    nome_arquivo = os.path.basename(caminho_arquivo or "")
    return os.path.abspath(os.path.join(UPLOAD_DIR, nome_arquivo))


async def verificar_mes_fechado(
    db: AsyncSession,
    usuario_atual: dict,
    data_referencia: datetime,
    acao: str = "alterar registros"
):
    """
    Bloqueia alterações operacionais em períodos já fechados.

    Considera mês fechado apenas quando existe registro em fechamentos_mensais
    com status = 'Fechado'. Um mês reaberto não bloqueia novas alterações.
    """
    fechamento = (
        await db.execute(
            select(FechamentoMensalDB).where(
                FechamentoMensalDB.instituicao_id == usuario_atual["instituicao_id"],
                FechamentoMensalDB.ano == data_referencia.year,
                FechamentoMensalDB.mes == data_referencia.month,
                FechamentoMensalDB.status == "Fechado"
            )
        )
    ).scalar_one_or_none()

    if fechamento:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Mês {str(data_referencia.month).zfill(2)}/{data_referencia.year} "
                f"está fechado. Não é possível {acao}. "
                "Reabra o mês pela gestão antes de prosseguir."
            )
        )

    return None

@router.get("/tecnicos")
async def listar_tecnicos(db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    query = select(
        UsuarioDB.id,
        UsuarioDB.nome,
        UsuarioDB.perfil_acesso,
        UsuarioDB.avatar_url,
    ).where(
        UsuarioDB.instituicao_id == usuario_atual["instituicao_id"]
    )
    result = await db.execute(query)
    return [
        {
            "id": t.id,
            "nome": t.nome,
            "perfil_acesso": t.perfil_acesso,
            "avatar_url": t.avatar_url,
        }
        for t in result.all()
    ]

@router.get("/motivos-inteligentes")
async def listar_motivos_inteligentes(db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    query = select(OcorrenciaConviventeDB.motivo).where(OcorrenciaConviventeDB.instituicao_id == usuario_atual["instituicao_id"]).distinct()
    return [m for m in (await db.execute(query)).scalars().all() if m and m.strip()]

@router.get("/motivos-inativacao", response_model=List[MotivoInativacaoResponse])
async def listar_motivos(db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    return (await db.execute(select(MotivoInativacaoDB).where(MotivoInativacaoDB.instituicao_id == usuario_atual["instituicao_id"]))).scalars().all()

@router.post("/motivos-inativacao", response_model=MotivoInativacaoResponse)
async def criar_motivo(motivo: MotivoInativacaoCreate, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    novo_motivo = MotivoInativacaoDB(instituicao_id=usuario_atual["instituicao_id"], descricao=motivo.descricao)
    db.add(novo_motivo)
    await db.commit()
    await db.refresh(novo_motivo)
    return novo_motivo

@router.get("/origens-encaminhamento", response_model=List[OrigemEncaminhamentoResponse])
async def listar_origens(db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    return (await db.execute(select(OrigemEncaminhamentoDB).where(OrigemEncaminhamentoDB.instituicao_id == usuario_atual["instituicao_id"]))).scalars().all()

@router.post("/origens-encaminhamento", response_model=OrigemEncaminhamentoResponse)
async def criar_origem(origem: OrigemEncaminhamentoCreate, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    nova_origem = OrigemEncaminhamentoDB(instituicao_id=usuario_atual["instituicao_id"], descricao=origem.descricao)
    db.add(nova_origem)
    await db.commit()
    await db.refresh(nova_origem)
    return nova_origem


@router.post("/conviventes", response_model=ConviventeResponse)
async def criar_convivente(convivente: ConviventeCreate, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    try:
        obs_status = getattr(convivente, "observacao_status", None)
        dados = convivente.model_dump(exclude_unset=True, exclude={"observacao_status"})
        
        if dados.get("status") in ["Inativado", "Bloqueado"]:
            dados["leito_id"] = None

        aplicar_credenciais_convivente_salvar(dados)

        novo_convivente = ConviventeDB(instituicao_id=usuario_atual["instituicao_id"], **dados)
        maior_numero = (await db.execute(select(func.max(ConviventeDB.numero_institucional)).where(ConviventeDB.instituicao_id == usuario_atual["instituicao_id"]))).scalar()
        novo_convivente.numero_institucional = (maior_numero or 0) + 1
        db.add(novo_convivente)
        await db.flush() 

        if novo_convivente.leito_id and novo_convivente.status == "Ativo":
            leito = (await db.execute(select(LeitoDB).where(LeitoDB.id == novo_convivente.leito_id))).scalar_one_or_none()
            if leito: leito.status = "Ocupado"

        if novo_convivente.status != "Ativo" and obs_status:
            db.add(OcorrenciaConviventeDB(
                instituicao_id=usuario_atual["instituicao_id"], convivente_id=novo_convivente.id,
                usuario_criador_id=usuario_atual["sub"], tecnico_responsavel_id=novo_convivente.tecnico_id,
                tipo_ocorrencia="Mudança de Status Institucional", motivo=f"Registro Inicial: {novo_convivente.status}",
                descricao=obs_status, requer_acao_tecnica=False, status_resolucao="Resolvido",
                parecer_tecnico="Ação registrada diretamente na criação da ficha."
            ))

        await db.commit()
        await db.refresh(novo_convivente)
        return convivente_para_response(novo_convivente, usuario_atual)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao criar convivente: {str(e)}")

@router.get("/conviventes", response_model=List[ConviventeResponse])
async def listar_conviventes(db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    rows = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.instituicao_id == usuario_atual["instituicao_id"],
            )
        )
    ).scalars().all()

    return [convivente_para_response(conv, usuario_atual) for conv in rows]

@router.get("/conviventes/{convivente_id}", response_model=ConviventeResponse)
async def obtener_convivente(convivente_id: str, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    convivente = (await db.execute(select(ConviventeDB).where(ConviventeDB.id == convivente_id, ConviventeDB.instituicao_id == usuario_atual["instituicao_id"]))).scalar_one_or_none()
    if not convivente: raise HTTPException(status_code=404, detail="Convivente não encontrado.")
    return convivente_para_response(convivente, usuario_atual)

@router.put("/conviventes/{convivente_id}", response_model=ConviventeResponse)
async def atualizar_convivente(convivente_id: str, dados_atualizacao: ConviventeUpdate, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    convivente = (await db.execute(select(ConviventeDB).where(ConviventeDB.id == convivente_id, ConviventeDB.instituicao_id == usuario_atual["instituicao_id"]))).scalar_one_or_none()
    if not convivente: raise HTTPException(status_code=404, detail="Convivente não encontrado.")

    leito_id_antigo = convivente.leito_id
    status_antigo = convivente.status
    obs_status = getattr(dados_atualizacao, "observacao_status", None)
    dados = dados_atualizacao.model_dump(exclude_unset=True, exclude={"observacao_status"})

    if status_antigo != dados.get("status", status_antigo):
        perfil_token = normalizar_perfil_acesso(usuario_atual.get("perfil_acesso"))
        mesmo_tecnico = str(usuario_atual.get("sub")) == str(convivente.tecnico_id)

        if perfil_token != PERFIL_GESTOR and not mesmo_tecnico:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Operação negada. "
                    "Apenas um Gestor ou o Técnico responsável podem alterar o status."
                ),
            )

    if dados.get("status") in ["Inativado", "Bloqueado"]:
        dados["leito_id"] = None

    aplicar_credenciais_convivente_salvar(dados)

    for key, value in dados.items(): setattr(convivente, key, value)

    try:
        if leito_id_antigo != convivente.leito_id:
            if leito_id_antigo:
                l_antigo = (await db.execute(select(LeitoDB).where(LeitoDB.id == leito_id_antigo))).scalar_one_or_none()
                if l_antigo: l_antigo.status = "Livre"
            if convivente.leito_id:
                l_novo = (await db.execute(select(LeitoDB).where(LeitoDB.id == convivente.leito_id))).scalar_one_or_none()
                if l_novo: l_novo.status = "Ocupado"

        if status_antigo != convivente.status and obs_status:
            db.add(OcorrenciaConviventeDB(
                instituicao_id=usuario_atual["instituicao_id"], convivente_id=convivente.id,
                usuario_criador_id=usuario_atual["sub"], tecnico_responsavel_id=convivente.tecnico_id,
                tipo_ocorrencia="Mudança de Status Institucional",
                motivo=f"Alterado de {status_antigo} para {convivente.status}",
                descricao=obs_status, requer_acao_tecnica=False, status_resolucao="Resolvido",
                parecer_tecnico="Ação e parecer registrados diretamente pelo Técnico Responsável/Gerência."
            ))

        await db.commit()
        await db.refresh(convivente)
        return convivente_para_response(convivente, usuario_atual)
    except HTTPException: raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Erro ao atualizar: {str(e)}")

# =====================================================================
# ROTAS DO SISTEMA DE TICKETS / OCORRÊNCIAS
# =====================================================================

@router.get("/ocorrencias", response_model=List[OcorrenciaResponse])
async def listar_todas_ocorrencias(db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    perfil = usuario_atual.get("perfil_acesso")
    user_id = usuario_atual.get("sub")
    inst_id = usuario_atual.get("instituicao_id")
    
    query = select(OcorrenciaConviventeDB).where(OcorrenciaConviventeDB.instituicao_id == inst_id)
    
    if perfil == "Orientador":
        subq = select(ObservadorOcorrenciaDB.ocorrencia_id).where(ObservadorOcorrenciaDB.usuario_id == user_id)
        query = query.where(
            or_(
                OcorrenciaConviventeDB.usuario_criador_id == user_id,
                OcorrenciaConviventeDB.id.in_(subq)
            )
        )
        
    query = query.order_by(
        OcorrenciaConviventeDB.status_resolucao.asc(),
        OcorrenciaConviventeDB.data_ocorrencia.desc()
    )
    ocorrencias_db = (await db.execute(query)).scalars().all()
    
    resultado = []
    for oc in ocorrencias_db:
        q_int = select(InteracaoOcorrenciaDB).where(InteracaoOcorrenciaDB.ocorrencia_id == oc.id).order_by(InteracaoOcorrenciaDB.data_interacao.asc())
        interacoes = (await db.execute(q_int)).scalars().all()
        
        q_obs = select(ObservadorOcorrenciaDB).where(ObservadorOcorrenciaDB.ocorrencia_id == oc.id)
        observadores = (await db.execute(q_obs)).scalars().all()
        
        oc_dict = {c.name: getattr(oc, c.name) for c in oc.__table__.columns}
        oc_dict["interacoes"] = interacoes
        oc_dict["observadores"] = observadores
        resultado.append(oc_dict)
        
    return resultado


@router.get("/ocorrencias/relatorio-prioridades", response_model=OcorrenciaRelatorioPrioridades)
async def relatorio_prioridades_ocorrencias(db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    inst_id = usuario_atual.get("instituicao_id")

    query = select(OcorrenciaConviventeDB).where(OcorrenciaConviventeDB.instituicao_id == inst_id)
    ocorrencias = (await db.execute(query)).scalars().all()

    resumo = {}
    for prioridade in PRIORIDADES_OCORRENCIA:
        resumo[prioridade] = {"prioridade": prioridade, "total": 0, "pendentes": 0, "resolvidas": 0}

    total = 0
    pendentes = 0
    resolvidas = 0

    for oc in ocorrencias:
        prioridade = normalizar_prioridade_ocorrencia(getattr(oc, "prioridade", None))
        status = getattr(oc, "status_resolucao", "Pendente")
        resolvido = status == "Resolvido"

        total += 1
        resumo[prioridade]["total"] += 1

        if resolvido:
            resolvidas += 1
            resumo[prioridade]["resolvidas"] += 1
        else:
            pendentes += 1
            resumo[prioridade]["pendentes"] += 1

    return {
        "total": total,
        "pendentes": pendentes,
        "resolvidas": resolvidas,
        "por_prioridade": [resumo[p] for p in PRIORIDADES_OCORRENCIA]
    }


@router.get("/ocorrencias/pendencias-tecnicas", response_model=List[OcorrenciaResponse])
async def listar_pendencias_tecnicas_priorizadas(db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    inst_id = usuario_atual.get("instituicao_id")

    query = select(OcorrenciaConviventeDB).where(
        OcorrenciaConviventeDB.instituicao_id == inst_id,
        OcorrenciaConviventeDB.status_resolucao != "Resolvido",
        or_(
            OcorrenciaConviventeDB.requer_acao_tecnica == True,
            OcorrenciaConviventeDB.prioridade.in_(["Alta", "Crítica"])
        )
    ).order_by(OcorrenciaConviventeDB.data_ocorrencia.desc())

    ocorrencias_db = (await db.execute(query)).scalars().all()

    resultado = []
    for oc in ocorrencias_db:
        q_int = select(InteracaoOcorrenciaDB).where(InteracaoOcorrenciaDB.ocorrencia_id == oc.id).order_by(InteracaoOcorrenciaDB.data_interacao.asc())
        interacoes = (await db.execute(q_int)).scalars().all()

        q_obs = select(ObservadorOcorrenciaDB).where(ObservadorOcorrenciaDB.ocorrencia_id == oc.id)
        observadores = (await db.execute(q_obs)).scalars().all()

        oc_dict = {c.name: getattr(oc, c.name) for c in oc.__table__.columns}
        oc_dict["interacoes"] = interacoes
        oc_dict["observadores"] = observadores
        resultado.append(oc_dict)

    resultado.sort(key=lambda oc: (PESO_PRIORIDADE.get(oc.get("prioridade", "Média"), 2), oc.get("data_ocorrencia")), reverse=True)
    return resultado

@router.post("/ocorrencias")
async def criar_ocorrencia_manual(payload: OcorrenciaCreate, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    prioridade = normalizar_prioridade_ocorrencia(payload.prioridade)
    requer_acao_tecnica = bool(payload.requer_acao_tecnica or prioridade in ["Alta", "Crítica"])

    nova_oc = OcorrenciaConviventeDB(
        instituicao_id=usuario_atual["instituicao_id"],
        convivente_id=payload.convivente_id,
        usuario_criador_id=usuario_atual["sub"],
        tecnico_responsavel_id=payload.tecnico_responsavel_id,
        tipo_ocorrencia=payload.tipo_ocorrencia,
        motivo=payload.motivo,
        descricao=payload.descricao,
        requer_acao_tecnica=requer_acao_tecnica,
        prioridade=prioridade,
        status_resolucao="Pendente" if requer_acao_tecnica else "Resolvido"
    )
    db.add(nova_oc)
    await db.flush()

    for obs_id in payload.observadores_ids:
        obs = ObservadorOcorrenciaDB(ocorrencia_id=nova_oc.id, usuario_id=obs_id)
        db.add(obs)

    await db.commit()
    return {"status": "sucesso", "id": nova_oc.id, "prioridade": prioridade}

@router.post("/ocorrencias/{ocorrencia_id}/interacoes")
async def adicionar_interacao(ocorrencia_id: str, payload: InteracaoOcorrenciaCreate, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    query = select(OcorrenciaConviventeDB).where(OcorrenciaConviventeDB.id == ocorrencia_id, OcorrenciaConviventeDB.instituicao_id == usuario_atual["instituicao_id"])
    oc = (await db.execute(query)).scalar_one_or_none()
    
    if not oc: 
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada.")
    
    if payload.tipo_interacao == "Parecer Técnico":
        if not usuario_pode_resolver_ocorrencia(usuario_atual, oc):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Apenas um Gestor ou o Técnico responsável podem "
                    "registrar parecer técnico e encerrar a ocorrência."
                ),
            )

        oc.status_resolucao = "Resolvido"
        oc.data_resolucao = agora_sao_paulo()
        oc.usuario_resolutor_id = usuario_atual["sub"]
        oc.parecer_tecnico = payload.mensagem 
        
    nova_int = InteracaoOcorrenciaDB(
        ocorrencia_id=oc.id,
        usuario_id=usuario_atual["sub"],
        mensagem=payload.mensagem,
        tipo_interacao=payload.tipo_interacao
    )
    db.add(nova_int)
    await db.commit()
    
    return {"status": "sucesso"}

@router.get("/conviventes/{convivente_id}/ocorrencias", response_model=List[OcorrenciaResponse])
async def listar_ocorrencias_convivente(convivente_id: str, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    query = select(OcorrenciaConviventeDB).where(
        OcorrenciaConviventeDB.convivente_id == convivente_id, 
        OcorrenciaConviventeDB.instituicao_id == usuario_atual["instituicao_id"]
    ).order_by(OcorrenciaConviventeDB.data_ocorrencia.desc())
    
    ocorrencias_db = (await db.execute(query)).scalars().all()
    
    resultado = []
    for oc in ocorrencias_db:
        q_int = select(InteracaoOcorrenciaDB).where(InteracaoOcorrenciaDB.ocorrencia_id == oc.id).order_by(InteracaoOcorrenciaDB.data_interacao.asc())
        interacoes = (await db.execute(q_int)).scalars().all()
        
        q_obs = select(ObservadorOcorrenciaDB).where(ObservadorOcorrenciaDB.ocorrencia_id == oc.id)
        observadores = (await db.execute(q_obs)).scalars().all()
        
        oc_dict = {c.name: getattr(oc, c.name) for c in oc.__table__.columns}
        oc_dict["interacoes"] = interacoes
        oc_dict["observadores"] = observadores
        resultado.append(oc_dict)
        
    return resultado

# =====================================================================
# ROTAS DE UPLOAD DE DOCUMENTOS (GED)
# =====================================================================
@router.post("/conviventes/{convivente_id}/documentos", response_model=DocumentoResponse)
async def upload_documento(convivente_id: str, tipo_documento: str = Form(...), file: UploadFile = File(...), db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    if not (await db.execute(select(ConviventeDB).where(ConviventeDB.id == convivente_id, ConviventeDB.instituicao_id == usuario_atual["instituicao_id"]))).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Convivente não encontrado.")

    nome_original = validar_upload_documento(file)
    nome_unico = f"{uuid.uuid4().hex}{os.path.splitext(nome_original)[1].lower()}"
    caminho_completo = os.path.join(UPLOAD_DIR, nome_unico)
    await salvar_upload_documento(file, caminho_completo)

    novo_doc = DocumentoConviventeDB(convivente_id=convivente_id, nome_arquivo=nome_original, caminho_arquivo=f"/uploads/documentos/{nome_unico}", tipo_documento=tipo_documento)
    db.add(novo_doc)
    await db.commit()
    await db.refresh(novo_doc)
    return novo_doc

@router.get("/conviventes/{convivente_id}/documentos", response_model=List[DocumentoResponse])
async def listar_documentos(convivente_id: str, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    return (
        await db.execute(
            select(DocumentoConviventeDB)
            .join(ConviventeDB, ConviventeDB.id == DocumentoConviventeDB.convivente_id)
            .where(
                DocumentoConviventeDB.convivente_id == convivente_id,
                ConviventeDB.instituicao_id == usuario_atual["instituicao_id"],
            )
            .order_by(DocumentoConviventeDB.data_upload.desc())
        )
    ).scalars().all()

@router.delete("/documentos/{documento_id}")
async def excluir_documento(documento_id: str, db: AsyncSession = Depends(get_db), usuario_atual: dict = Depends(get_usuario_logado)):
    documento = (
        await db.execute(
            select(DocumentoConviventeDB)
            .join(ConviventeDB, ConviventeDB.id == DocumentoConviventeDB.convivente_id)
            .where(
                DocumentoConviventeDB.id == documento_id,
                ConviventeDB.instituicao_id == usuario_atual["instituicao_id"],
            )
        )
    ).scalar_one_or_none()
    if not documento: raise HTTPException(status_code=404, detail="Não encontrado.")
    caminho_documento = caminho_absoluto_documento(documento.caminho_arquivo)
    if os.path.commonpath([UPLOAD_DIR_ABSOLUTO, caminho_documento]) == UPLOAD_DIR_ABSOLUTO and os.path.exists(caminho_documento):
        os.remove(caminho_documento)
    await db.delete(documento)
    await db.commit()
    return {"status": "sucesso"}

# =====================================================================
# NOVAS ROTAS DE ROTINA DIÁRIA E FLUXO (PORTARIA)
# =====================================================================

@router.post("/rotina", response_model=RegistroRotinaResponse)
async def registar_rotina(
    payload: RegistroRotinaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    tipos_validos = ["Entrada", "Saída", "Almoço"]

    if payload.tipo_registro not in tipos_validos:
        raise HTTPException(
            status_code=400,
            detail="Tipo de registro inválido."
        )

    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == payload.convivente_id,
                ConviventeDB.instituicao_id == usuario_atual["instituicao_id"],
                ConviventeDB.status == "Ativo"
            )
        )
    ).scalar_one_or_none()

    if not convivente:
        raise HTTPException(
            status_code=404,
            detail="Convivente não encontrado."
        )

    hoje = agora_sao_paulo().date()

    inicio_dia = datetime.combine(
        hoje,
        datetime.min.time()
    )

    registros_hoje = (
        await db.execute(
            select(RegistroRotinaDB).where(
                RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"],
                RegistroRotinaDB.convivente_id == payload.convivente_id,
                RegistroRotinaDB.cancelado != True,
                RegistroRotinaDB.data_registro >= inicio_dia
            ).order_by(
                RegistroRotinaDB.data_registro.asc()
            )
        )
    ).scalars().all()

    # O almoço continua sendo uma regra diária.
    almocou = any(
        registro.tipo_registro == "Almoço"
        for registro in registros_hoje
    )

    # Entrada/Saída não podem resetar na virada do dia.
    # Por isso o último movimento precisa ser histórico, não apenas de hoje.
    ultimo_movimento = (
        await db.execute(
            select(RegistroRotinaDB).where(
                RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"],
                RegistroRotinaDB.convivente_id == payload.convivente_id,
                RegistroRotinaDB.cancelado != True,
                RegistroRotinaDB.tipo_registro.in_(["Entrada", "Saída"])
            ).order_by(
                RegistroRotinaDB.data_registro.desc()
            )
        )
    ).scalars().first()

    esta_fora = (
        ultimo_movimento and
        ultimo_movimento.tipo_registro == "Saída"
    )

    # ============================================================
    # BLOQUEIOS OPERACIONAIS
    # ============================================================

    if payload.tipo_registro == "Entrada" and not esta_fora:

        raise HTTPException(
            status_code=400,
            detail="O convivente já consta como presente."
        )

    if payload.tipo_registro == "Saída" and esta_fora:

        raise HTTPException(
            status_code=400,
            detail="O convivente já consta como fora."
        )

    if payload.tipo_registro == "Almoço":

        if esta_fora:

            raise HTTPException(
                status_code=400,
                detail="Convivente está fora da unidade."
            )

        if almocou:

            raise HTTPException(
                status_code=400,
                detail="Almoço já registrado hoje."
            )

    # ============================================================
    # RETORNO RÁPIDO (<10 MIN)
    # ============================================================

    retorno_rapido = False

    justificativa_retorno_rapido = None

    if (
        payload.tipo_registro == "Entrada"
        and ultimo_movimento
        and ultimo_movimento.tipo_registro == "Saída"
    ):

        diferenca = (
            agora_sao_paulo() -
            ultimo_movimento.data_registro
        )

        if diferenca <= timedelta(minutes=10):

            retorno_rapido = True

            if (
                not payload.justificativa_retorno_rapido
                or not payload.justificativa_retorno_rapido.strip()
            ):

                raise HTTPException(
                    status_code=400,
                    detail="Retorno em menos de 10 minutos exige justificativa."
                )

            justificativa_retorno_rapido = (
                payload.justificativa_retorno_rapido.strip()
            )

    await verificar_mes_fechado(
        db,
        usuario_atual,
        agora_sao_paulo(),
        acao="registrar movimento de rotina"
    )

    novo_registro = RegistroRotinaDB(
        instituicao_id=usuario_atual["instituicao_id"],
        convivente_id=payload.convivente_id,
        usuario_id=usuario_atual["sub"],

        tipo_registro=payload.tipo_registro,
        data_registro=agora_sao_paulo(),

        retorno_rapido=retorno_rapido,
        justificativa_retorno_rapido=justificativa_retorno_rapido
    )

    db.add(novo_registro)

    await db.commit()

    await db.refresh(novo_registro)

    return novo_registro


@router.get("/rotina/hoje")
async def resumo_rotina_hoje(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):

    # ============================================================
    # REGISTROS DE HOJE (apenas almoço e histórico visual)
    # ============================================================

    hoje = agora_sao_paulo().date()

    inicio_dia = datetime.combine(
        hoje,
        datetime.min.time()
    )

    registros_hoje = (
        await db.execute(
            select(RegistroRotinaDB).where(
                RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"],
                RegistroRotinaDB.cancelado != True,
                RegistroRotinaDB.data_registro >= inicio_dia
            ).order_by(
                RegistroRotinaDB.data_registro.asc()
            )
        )
    ).scalars().all()

    # ============================================================
    # ÚLTIMO MOVIMENTO HISTÓRICO REAL
    # (não pode resetar na virada do dia)
    # ============================================================

    ultimos_movimentos = (
        await db.execute(
            select(RegistroRotinaDB).where(
                RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"],
                RegistroRotinaDB.cancelado != True
            ).order_by(
                RegistroRotinaDB.data_registro.desc()
            )
        )
    ).scalars().all()

    resumo = {}

    # ============================================================
    # HISTÓRICO DE HOJE
    # ============================================================

    for r in registros_hoje:

        if r.convivente_id not in resumo:

            resumo[r.convivente_id] = {
                "presencas": [],
                "ultimo_movimento": None,
                "ultimo_movimento_id": None,
                "ultimo_movimento_data": None,
                "almocou": False
            }

        resumo[r.convivente_id]["presencas"].append({
            "id": r.id,
            "tipo_registro": r.tipo_registro,
            "data_registro": r.data_registro.isoformat(),
            "usuario_id": r.usuario_id,
            "retorno_rapido": bool(r.retorno_rapido),
            "justificativa_retorno_rapido": r.justificativa_retorno_rapido
        })

        if r.tipo_registro == "Almoço":
            resumo[r.convivente_id]["almocou"] = True

    # ============================================================
    # ESTADO REAL (último movimento histórico)
    # ============================================================

    movimentos_processados = set()

    for r in ultimos_movimentos:

        if r.convivente_id in movimentos_processados:
            continue

        movimentos_processados.add(r.convivente_id)

        if r.convivente_id not in resumo:

            resumo[r.convivente_id] = {
                "presencas": [],
                "ultimo_movimento": None,
                "ultimo_movimento_id": None,
                "ultimo_movimento_data": None,
                "almocou": False
            }

        if r.tipo_registro in [
            "Entrada",
            "Saída"
        ]:

            resumo[r.convivente_id]["ultimo_movimento"] = (
                r.tipo_registro
            )

            resumo[r.convivente_id]["ultimo_movimento_id"] = r.id

            resumo[r.convivente_id]["ultimo_movimento_data"] = (
                r.data_registro.isoformat()
            )

    return resumo


@router.get("/rotina/sync-status")
async def status_sincronizacao_rotina(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    hoje = agora_sao_paulo().date()
    inicio_dia = datetime.combine(hoje, datetime.min.time())

    resultado = (
        await db.execute(
            select(
                func.count(RegistroRotinaDB.id),
                func.max(RegistroRotinaDB.data_registro),
                func.max(RegistroRotinaDB.cancelado_em),
                func.max(RegistroRotinaDB.editado_em),
            ).where(
                RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"],
                RegistroRotinaDB.data_registro >= inicio_dia,
            )
        )
    ).one()

    total_registros, ultima_data, ultimo_cancelamento, ultima_edicao = resultado
    marcos = [
        marco
        for marco in (ultima_data, ultimo_cancelamento, ultima_edicao)
        if marco is not None
    ]
    ultimo_evento = max(marcos) if marcos else None

    return {
        "total_registros_hoje": int(total_registros or 0),
        "ultimo_evento": ultimo_evento.isoformat() if ultimo_evento else None,
        "verificado_em": agora_sao_paulo().isoformat(),
    }

# =====================================================================
# DASHBOARD OPERACIONAL DA ROTINA
# =====================================================================

@router.get("/rotina/dashboard-operacional")
async def dashboard_operacional_rotina(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    """
    Dashboard operacional da rotina.

    Regra importante:
    - "Presentes agora" e "Fora agora" representam o estado real atual
      dos conviventes ativos da instituição, considerando o último movimento
      histórico válido de cada convivente.
    - Os indicadores "Entradas hoje", "Saídas hoje", "Almoços hoje" etc.
      representam apenas a movimentação do dia.
    """
    hoje = agora_sao_paulo().date()
    inicio_dia = datetime.combine(hoje, datetime.min.time())
    fim_dia = datetime.combine(hoje, datetime.max.time())

    inst_id = usuario_atual["instituicao_id"]

    # Base operacional: conviventes ativos da instituição.
    # Eles compõem o universo para "presentes agora" e "fora agora".
    conviventes_ativos = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.instituicao_id == inst_id,
                ConviventeDB.status == "Ativo"
            ).order_by(ConviventeDB.nome_completo.asc())
        )
    ).scalars().all()

    # Movimentação do dia: usada somente para métricas diárias e últimos registros.
    registros_hoje = (
        await db.execute(
            select(
                RegistroRotinaDB,
                ConviventeDB.nome_completo,
                ConviventeDB.nome_social,
                ConviventeDB.numero_institucional,
                UsuarioDB.nome.label("usuario_nome")
            )
            .join(ConviventeDB, RegistroRotinaDB.convivente_id == ConviventeDB.id)
            .join(UsuarioDB, RegistroRotinaDB.usuario_id == UsuarioDB.id)
            .where(
                RegistroRotinaDB.instituicao_id == inst_id,
                RegistroRotinaDB.data_registro >= inicio_dia,
                RegistroRotinaDB.data_registro <= fim_dia
            )
            .order_by(RegistroRotinaDB.data_registro.desc())
        )
    ).all()

    # Estado atual real: último movimento histórico válido de Entrada/Saída.
    movimentos_historicos = (
        await db.execute(
            select(
                RegistroRotinaDB,
                ConviventeDB.nome_completo,
                ConviventeDB.nome_social,
                ConviventeDB.numero_institucional
            )
            .join(ConviventeDB, RegistroRotinaDB.convivente_id == ConviventeDB.id)
            .where(
                RegistroRotinaDB.instituicao_id == inst_id,
                RegistroRotinaDB.cancelado != True,
                RegistroRotinaDB.tipo_registro.in_(["Entrada", "Saída"])
            )
            .order_by(RegistroRotinaDB.data_registro.desc())
        )
    ).all()

    ultimo_movimento_por_convivente = {}

    for registro, nome_completo, nome_social, numero_institucional in movimentos_historicos:
        if registro.convivente_id in ultimo_movimento_por_convivente:
            continue

        ultimo_movimento_por_convivente[registro.convivente_id] = {
            "id": registro.id,
            "convivente_id": registro.convivente_id,
            "convivente_nome": nome_social or nome_completo,
            "numero_institucional": numero_institucional,
            "tipo_registro": registro.tipo_registro,
            "data_registro": registro.data_registro,
            "origem_estado": "ultimo_movimento_historico"
        }

    presentes = []
    fora_por_saida = []
    sem_movimento = []
    fora_agora_lista = []

    for convivente in conviventes_ativos:
        ultimo = ultimo_movimento_por_convivente.get(convivente.id)

        if ultimo and ultimo["tipo_registro"] == "Entrada":
            presentes.append(ultimo)
            continue

        if ultimo and ultimo["tipo_registro"] == "Saída":
            item_fora = {
                **ultimo,
                "origem_estado": "saida_registrada"
            }
            fora_por_saida.append(item_fora)
            fora_agora_lista.append(item_fora)
            continue

        # Sem movimento de entrada/saída também não pode ser contado como presente.
        # Portanto entra em "fora agora" e também fica destacado como pendência.
        item_sem_movimento = {
            "id": None,
            "convivente_id": convivente.id,
            "convivente_nome": convivente.nome_social or convivente.nome_completo,
            "numero_institucional": convivente.numero_institucional,
            "tipo_registro": None,
            "data_registro": None,
            "origem_estado": "sem_movimento"
        }

        sem_movimento.append(item_sem_movimento)
        fora_agora_lista.append(item_sem_movimento)

    registros_validos_hoje = [
        registro for registro, *_ in registros_hoje
        if not registro.cancelado
    ]

    entradas_hoje = sum(
        1 for registro in registros_validos_hoje
        if registro.tipo_registro == "Entrada"
    )

    saidas_hoje = sum(
        1 for registro in registros_validos_hoje
        if registro.tipo_registro == "Saída"
    )

    almocos_hoje = sum(
        1 for registro in registros_validos_hoje
        if registro.tipo_registro == "Almoço"
    )

    retornos_rapidos_hoje = sum(
        1 for registro in registros_validos_hoje
        if registro.retorno_rapido
    )

    cancelados_hoje = sum(
        1 for registro, *_ in registros_hoje
        if registro.cancelado
    )

    editados_hoje = sum(
        1 for registro, *_ in registros_hoje
        if registro.foi_editado
    )

    ultimos_registros = []

    for registro, nome_completo, nome_social, numero_institucional, usuario_nome in registros_hoje[:12]:
        ultimos_registros.append({
            "id": registro.id,
            "convivente_id": registro.convivente_id,
            "convivente_nome": nome_social or nome_completo,
            "numero_institucional": numero_institucional,
            "tipo_registro": registro.tipo_registro,
            "data_registro": registro.data_registro,
            "usuario_nome": usuario_nome,
            "cancelado": bool(registro.cancelado),
            "foi_editado": bool(registro.foi_editado),
            "retorno_rapido": bool(registro.retorno_rapido),
            "justificativa_retorno_rapido": registro.justificativa_retorno_rapido
        })

    alertas = []

    if retornos_rapidos_hoje:
        alertas.append({
            "tipo": "retorno_rapido",
            "titulo": "Retornos rápidos hoje",
            "descricao": f"{retornos_rapidos_hoje} retorno(s) em menos de 10 minutos exigiram justificativa."
        })

    if cancelados_hoje:
        alertas.append({
            "tipo": "cancelamentos",
            "titulo": "Registros cancelados hoje",
            "descricao": f"{cancelados_hoje} registro(s) foram cancelados e precisam permanecer auditáveis."
        })

    if sem_movimento:
        alertas.append({
            "tipo": "sem_movimento",
            "titulo": "Conviventes ativos sem entrada/saída",
            "descricao": f"{len(sem_movimento)} convivente(s) ativo(s) ainda não possuem movimento histórico de entrada/saída e foram considerados fora agora."
        })

    capacidade_operacional = len(conviventes_ativos)
    percentual_presentes = (
        round((len(presentes) / capacidade_operacional) * 100, 1)
        if capacidade_operacional
        else 0
    )

    return {
        "data_referencia": hoje.isoformat(),
        "atualizado_em": agora_sao_paulo().isoformat(),
        "resumo": {
            "conviventes_ativos": capacidade_operacional,

            # Estado real atual.
            "presentes_agora": len(presentes),
            "fora_agora": len(fora_agora_lista),
            "fora_com_saida": len(fora_por_saida),
            "sem_movimento": len(sem_movimento),
            "percentual_presentes": percentual_presentes,

            # Movimento diário.
            "entradas_hoje": entradas_hoje,
            "saidas_hoje": saidas_hoje,
            "almocos_hoje": almocos_hoje,
            "retornos_rapidos_hoje": retornos_rapidos_hoje,
            "cancelados_hoje": cancelados_hoje,
            "editados_hoje": editados_hoje,
            "total_registros_hoje": len(registros_validos_hoje)
        },
        "presentes": presentes,
        "fora": fora_agora_lista,
        "fora_com_saida": fora_por_saida,
        "sem_movimento": sem_movimento,
        "ultimos_registros": ultimos_registros,
        "alertas": alertas
    }


# =====================================================================
# HISTÓRICO GERAL DA ROTINA / PORTARIA
# =====================================================================


def _aplicar_filtros_historico_rotina(
    query,
    data_inicio: str = None,
    data_fim: str = None,
    tipo_registro: str = None,
    convivente_id: str = None,
    busca: str = None,
    status_registro: str = None,
    apenas_editados: bool = False,
    apenas_cancelados: bool = False,
    apenas_retorno_rapido: bool = False
):
    if data_inicio:
        try:
            inicio = datetime.fromisoformat(data_inicio)
            query = query.where(RegistroRotinaDB.data_registro >= inicio)
        except ValueError:
            raise HTTPException(status_code=400, detail="Data inicial inválida.")

    if data_fim:
        try:
            fim = datetime.fromisoformat(data_fim)
            if len(data_fim) == 10:
                fim = fim.replace(hour=23, minute=59, second=59, microsecond=999999)
            query = query.where(RegistroRotinaDB.data_registro <= fim)
        except ValueError:
            raise HTTPException(status_code=400, detail="Data final inválida.")

    if tipo_registro:
        query = query.where(RegistroRotinaDB.tipo_registro == tipo_registro)

    if convivente_id:
        query = query.where(RegistroRotinaDB.convivente_id == convivente_id)

    if busca:
        termo = f"%{busca.strip()}%"
        query = query.where(
            or_(
                ConviventeDB.nome_completo.ilike(termo),
                ConviventeDB.nome_social.ilike(termo),
                func.cast(ConviventeDB.numero_institucional, String).ilike(termo)
            )
        )

    if status_registro == "ativos":
        query = query.where(RegistroRotinaDB.cancelado == False)

    if status_registro == "cancelados":
        query = query.where(RegistroRotinaDB.cancelado == True)

    if apenas_editados:
        query = query.where(RegistroRotinaDB.foi_editado == True)

    if apenas_cancelados:
        query = query.where(RegistroRotinaDB.cancelado == True)

    if apenas_retorno_rapido:
        query = query.where(RegistroRotinaDB.retorno_rapido == True)

    return query


def _query_base_historico_rotina(usuario_atual: dict):
    return (
        select(
            RegistroRotinaDB,
            ConviventeDB.nome_completo,
            ConviventeDB.nome_social,
            ConviventeDB.numero_institucional,
            UsuarioDB.nome.label("usuario_nome"),
            UsuarioDB.perfil_acesso.label("usuario_perfil")
        )
        .join(ConviventeDB, RegistroRotinaDB.convivente_id == ConviventeDB.id)
        .join(UsuarioDB, RegistroRotinaDB.usuario_id == UsuarioDB.id)
        .where(
            RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"]
        )
        .order_by(RegistroRotinaDB.data_registro.desc())
    )


def _linha_historico_para_dict(
    registro,
    nome_completo,
    nome_social,
    numero_institucional,
    usuario_nome,
    usuario_perfil
):
    return {
        "id": registro.id,
        "instituicao_id": registro.instituicao_id,
        "convivente_id": registro.convivente_id,
        "convivente_nome": nome_social or nome_completo,
        "convivente_nome_completo": nome_completo,
        "numero_institucional": numero_institucional,

        "tipo_registro": registro.tipo_registro,
        "data_registro": registro.data_registro,

        "usuario_id": registro.usuario_id,
        "usuario_nome": usuario_nome,
        "usuario_perfil": usuario_perfil,

        "retorno_rapido": bool(registro.retorno_rapido),
        "justificativa_retorno_rapido": registro.justificativa_retorno_rapido,

        "foi_editado": bool(registro.foi_editado),
        "editado_por_id": registro.editado_por_id,
        "editado_em": registro.editado_em,
        "motivo_edicao": registro.motivo_edicao,
        "tipo_registro_original": registro.tipo_registro_original,
        "data_registro_original": registro.data_registro_original,

        "cancelado": bool(registro.cancelado),
        "cancelado_por_id": registro.cancelado_por_id,
        "cancelado_em": registro.cancelado_em,
        "motivo_cancelamento": registro.motivo_cancelamento
    }


@router.get("/rotina/historico")
async def listar_historico_rotina(
    data_inicio: str = None,
    data_fim: str = None,
    tipo_registro: str = None,
    convivente_id: str = None,
    busca: str = None,
    status_registro: str = None,
    apenas_editados: bool = False,
    apenas_cancelados: bool = False,
    apenas_retorno_rapido: bool = False,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    query = _query_base_historico_rotina(usuario_atual)

    query = _aplicar_filtros_historico_rotina(
        query=query,
        data_inicio=data_inicio,
        data_fim=data_fim,
        tipo_registro=tipo_registro,
        convivente_id=convivente_id,
        busca=busca,
        status_registro=status_registro,
        apenas_editados=apenas_editados,
        apenas_cancelados=apenas_cancelados,
        apenas_retorno_rapido=apenas_retorno_rapido
    )

    resultado = await db.execute(query)
    linhas = resultado.all()

    return [
        _linha_historico_para_dict(
            registro,
            nome_completo,
            nome_social,
            numero_institucional,
            usuario_nome,
            usuario_perfil
        )
        for registro, nome_completo, nome_social, numero_institucional, usuario_nome, usuario_perfil in linhas
    ]


@router.get("/rotina/historico/exportar-xlsx")
async def exportar_historico_rotina_xlsx(
    data_inicio: str = None,
    data_fim: str = None,
    tipo_registro: str = None,
    convivente_id: str = None,
    busca: str = None,
    status_registro: str = None,
    apenas_editados: bool = False,
    apenas_cancelados: bool = False,
    apenas_retorno_rapido: bool = False,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    query = _query_base_historico_rotina(usuario_atual)

    query = _aplicar_filtros_historico_rotina(
        query=query,
        data_inicio=data_inicio,
        data_fim=data_fim,
        tipo_registro=tipo_registro,
        convivente_id=convivente_id,
        busca=busca,
        status_registro=status_registro,
        apenas_editados=apenas_editados,
        apenas_cancelados=apenas_cancelados,
        apenas_retorno_rapido=apenas_retorno_rapido
    )

    resultado = await db.execute(query)
    linhas = resultado.all()

    historico = [
        _linha_historico_para_dict(
            registro,
            nome_completo,
            nome_social,
            numero_institucional,
            usuario_nome,
            usuario_perfil
        )
        for registro, nome_completo, nome_social, numero_institucional, usuario_nome, usuario_perfil in linhas
    ]

    arquivo = gerar_xlsx_historico(historico)

    nome_arquivo = f"historico_rotina_{agora_sao_paulo().strftime('%Y%m%d_%H%M%S')}.xlsx"

    return StreamingResponse(
        BytesIO(arquivo),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_arquivo}"'
        }
    )



# =====================================================================
# CONVÊNIO / SISA / FECHAMENTO MENSAL
# =====================================================================

def _parse_data_simples(valor: str, nome_campo: str) -> datetime:
    try:
        return datetime.fromisoformat(valor)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=f"{nome_campo} inválida. Use o formato AAAA-MM-DD."
        )


def _inicio_fim_dia(data: str):
    base_data = _parse_data_simples(data, "Data").date()
    inicio = datetime.combine(base_data, datetime.min.time())
    fim = datetime.combine(base_data, datetime.max.time())
    return inicio, fim


def _inicio_fim_mes(ano: int, mes: int):
    if mes < 1 or mes > 12:
        raise HTTPException(status_code=400, detail="Mês inválido.")

    inicio = datetime(ano, mes, 1)

    if mes == 12:
        fim = datetime(ano + 1, 1, 1) - timedelta(microseconds=1)
    else:
        fim = datetime(ano, mes + 1, 1) - timedelta(microseconds=1)

    return inicio, fim


async def _conviventes_ativos_instituicao(
    db: AsyncSession,
    instituicao_id: str
):
    resultado = await db.execute(
        select(ConviventeDB).where(
            ConviventeDB.instituicao_id == instituicao_id,
            ConviventeDB.status == "Ativo"
        ).order_by(
            ConviventeDB.nome_completo.asc()
        )
    )

    return resultado.scalars().all()


async def _registros_rotina_periodo(
    db: AsyncSession,
    instituicao_id: str,
    inicio: datetime,
    fim: datetime
):
    resultado = await db.execute(
        select(RegistroRotinaDB).where(
            RegistroRotinaDB.instituicao_id == instituicao_id,
            RegistroRotinaDB.cancelado != True,
            RegistroRotinaDB.data_registro >= inicio,
            RegistroRotinaDB.data_registro <= fim
        ).order_by(
            RegistroRotinaDB.data_registro.asc()
        )
    )

    return resultado.scalars().all()


def _nome_convivente_relatorio(convivente: ConviventeDB):
    return convivente.nome_social or convivente.nome_completo


@router.get("/convenio-sisa/diario")
async def relatorio_sisa_diario(
    data: str = None,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    if not data:
        data = agora_sao_paulo().date().isoformat()

    inicio, fim = _inicio_fim_dia(data)

    conviventes = await _conviventes_ativos_instituicao(
        db,
        usuario_atual["instituicao_id"]
    )

    registros = await _registros_rotina_periodo(
        db,
        usuario_atual["instituicao_id"],
        inicio,
        fim
    )

    registros_por_convivente = {}

    for registro in registros:
        registros_por_convivente.setdefault(
            registro.convivente_id,
            []
        ).append(registro)

    linhas = []

    for convivente in conviventes:
        regs = registros_por_convivente.get(convivente.id, [])

        entradas = [
            r for r in regs
            if r.tipo_registro == "Entrada"
        ]

        saidas = [
            r for r in regs
            if r.tipo_registro == "Saída"
        ]

        almocos = [
            r for r in regs
            if r.tipo_registro == "Almoço"
        ]

        presente = bool(regs)

        primeira_entrada = entradas[0].data_registro if entradas else None
        ultima_saida = saidas[-1].data_registro if saidas else None

        observacoes = []

        if any(r.retorno_rapido for r in regs):
            observacoes.append("Retorno rápido")

        linhas.append({
            "convivente_id": convivente.id,
            "nome": _nome_convivente_relatorio(convivente),
            "nome_completo": convivente.nome_completo,
            "prontuario": convivente.numero_institucional,
            "numero_sisa": convivente.numero_sisa,
            "presenca": "Sim" if presente else "Não",
            "entrada": primeira_entrada,
            "saida": ultima_saida,
            "almoco": "Sim" if almocos else "Não",
            "total_movimentos": len(regs),
            "observacoes": ", ".join(observacoes)
        })

    resumo = {
        "data": data,
        "conviventes_ativos": len(conviventes),
        "presentes": sum(1 for item in linhas if item["presenca"] == "Sim"),
        "ausentes": sum(1 for item in linhas if item["presenca"] == "Não"),
        "almocos": sum(1 for item in linhas if item["almoco"] == "Sim"),
        "entradas": sum(1 for registro in registros if registro.tipo_registro == "Entrada"),
        "saidas": sum(1 for registro in registros if registro.tipo_registro == "Saída"),
        "retornos_rapidos": sum(1 for registro in registros if registro.retorno_rapido)
    }

    return {
        "resumo": resumo,
        "items": linhas
    }


@router.get("/convenio-sisa/mensal")
async def relatorio_sisa_mensal(
    ano: int,
    mes: int,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    inicio, fim = _inicio_fim_mes(ano, mes)

    conviventes = await _conviventes_ativos_instituicao(
        db,
        usuario_atual["instituicao_id"]
    )

    registros = await _registros_rotina_periodo(
        db,
        usuario_atual["instituicao_id"],
        inicio,
        fim
    )

    registros_por_convivente = {}

    for registro in registros:
        registros_por_convivente.setdefault(
            registro.convivente_id,
            []
        ).append(registro)

    lancamentos_resultado = await db.execute(
        select(
            SisaLancamentoDB,
            UsuarioDB.nome.label("usuario_nome")
        )
        .join(UsuarioDB, SisaLancamentoDB.lancado_por_id == UsuarioDB.id)
        .where(
            SisaLancamentoDB.instituicao_id == usuario_atual["instituicao_id"],
            SisaLancamentoDB.ano == ano,
            SisaLancamentoDB.mes == mes
        )
    )

    lancamentos_por_convivente = {
        lancamento.convivente_id: {
            "id": lancamento.id,
            "status": lancamento.status,
            "lancado_por_id": lancamento.lancado_por_id,
            "lancado_por_nome": usuario_nome,
            "lancado_em": lancamento.lancado_em,
            "observacoes": lancamento.observacoes
        }
        for lancamento, usuario_nome in lancamentos_resultado.all()
    }

    linhas = []

    for convivente in conviventes:
        regs = registros_por_convivente.get(convivente.id, [])

        dias_presentes = sorted({
            r.data_registro.date().isoformat()
            for r in regs
        })

        entradas = [
            r for r in regs
            if r.tipo_registro == "Entrada"
        ]

        saidas = [
            r for r in regs
            if r.tipo_registro == "Saída"
        ]

        almocos = [
            r for r in regs
            if r.tipo_registro == "Almoço"
        ]

        lancamento_sisa = lancamentos_por_convivente.get(convivente.id)

        linhas.append({
            "convivente_id": convivente.id,
            "nome": _nome_convivente_relatorio(convivente),
            "nome_completo": convivente.nome_completo,
            "prontuario": convivente.numero_institucional,
            "numero_sisa": convivente.numero_sisa,
            "dias_presentes": len(dias_presentes),
            "dias_presentes_lista": dias_presentes,
            "entradas": len(entradas),
            "saidas": len(saidas),
            "almocos": len(almocos),
            "total_atendimentos": len(dias_presentes),
            "retornos_rapidos": sum(1 for r in regs if r.retorno_rapido),
            "lancado_sisa": bool(lancamento_sisa),
            "lancamento_sisa_id": lancamento_sisa["id"] if lancamento_sisa else None,
            "lancado_por_id": lancamento_sisa["lancado_por_id"] if lancamento_sisa else None,
            "lancado_por_nome": lancamento_sisa["lancado_por_nome"] if lancamento_sisa else None,
            "lancado_em": lancamento_sisa["lancado_em"] if lancamento_sisa else None,
            "observacoes_lancamento_sisa": lancamento_sisa["observacoes"] if lancamento_sisa else None
        })

    fechamento = (
        await db.execute(
            select(FechamentoMensalDB).where(
                FechamentoMensalDB.instituicao_id == usuario_atual["instituicao_id"],
                FechamentoMensalDB.ano == ano,
                FechamentoMensalDB.mes == mes
            )
        )
    ).scalar_one_or_none()

    mes_esta_fechado = bool(fechamento and fechamento.status == "Fechado")

    resumo = {
        "ano": ano,
        "mes": mes,
        "conviventes_ativos": len(conviventes),
        "total_atendimentos": sum(item["total_atendimentos"] for item in linhas),
        "total_almocos": sum(item["almocos"] for item in linhas),
        "total_entradas": sum(item["entradas"] for item in linhas),
        "total_saidas": sum(item["saidas"] for item in linhas),
        "total_retornos_rapidos": sum(item["retornos_rapidos"] for item in linhas),
        "lancados_sisa": sum(1 for item in linhas if item.get("lancado_sisa")),
        "pendentes_sisa": sum(1 for item in linhas if not item.get("lancado_sisa")),
        "fechado": mes_esta_fechado,
        "fechamento_id": fechamento.id if fechamento else None,
        "status_fechamento": fechamento.status if fechamento else None,
        "protocolo": fechamento.protocolo if fechamento else None,
        "fechado_em": fechamento.fechado_em if fechamento else None
    }

    return {
        "resumo": resumo,
        "items": linhas
    }


@router.get("/convenio-sisa/fechamentos", response_model=List[FechamentoMensalResponse])
async def listar_fechamentos_mensais(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    resultado = await db.execute(
        select(FechamentoMensalDB).where(
            FechamentoMensalDB.instituicao_id == usuario_atual["instituicao_id"]
        ).order_by(
            FechamentoMensalDB.ano.desc(),
            FechamentoMensalDB.mes.desc()
        )
    )

    return resultado.scalars().all()


@router.post("/convenio-sisa/fechar-mes", response_model=FechamentoMensalResponse)
async def fechar_mes_convenio_sisa(
    payload: FechamentoMensalCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    if not usuario_eh_gestor(usuario_atual):
        raise HTTPException(
            status_code=403,
            detail="Apenas gestão pode fechar o mês."
        )

    _inicio_fim_mes(payload.ano, payload.mes)

    fechamento_existente = (
        await db.execute(
            select(FechamentoMensalDB).where(
                FechamentoMensalDB.instituicao_id == usuario_atual["instituicao_id"],
                FechamentoMensalDB.ano == payload.ano,
                FechamentoMensalDB.mes == payload.mes
            )
        )
    ).scalar_one_or_none()

    protocolo = (
        f"SISA-{payload.ano}{str(payload.mes).zfill(2)}-"
        f"{agora_sao_paulo().strftime('%Y%m%d%H%M%S')}"
    )

    if fechamento_existente:
        if fechamento_existente.status == "Fechado":
            raise HTTPException(
                status_code=400,
                detail="Este mês já está fechado."
            )

        # Refecha um mês que havia sido reaberto, preservando auditoria.
        fechamento_existente.status = "Fechado"
        fechamento_existente.protocolo = protocolo
        fechamento_existente.fechado_por_id = usuario_atual["sub"]
        fechamento_existente.fechado_em = agora_sao_paulo()
        fechamento_existente.observacoes = payload.observacoes.strip() if payload.observacoes else None

        await db.commit()
        await db.refresh(fechamento_existente)

        return fechamento_existente

    fechamento = FechamentoMensalDB(
        instituicao_id=usuario_atual["instituicao_id"],
        ano=payload.ano,
        mes=payload.mes,
        protocolo=protocolo,
        fechado_por_id=usuario_atual["sub"],
        fechado_em=agora_sao_paulo(),
        observacoes=payload.observacoes.strip() if payload.observacoes else None
    )

    db.add(fechamento)

    await db.commit()
    await db.refresh(fechamento)

    return fechamento




@router.patch("/convenio-sisa/fechamentos/{fechamento_id}/reabrir", response_model=FechamentoMensalResponse)
async def reabrir_fechamento_convenio_sisa(
    fechamento_id: str,
    payload: FechamentoMensalReabertura,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    if not usuario_eh_gestor(usuario_atual):
        raise HTTPException(
            status_code=403,
            detail="Apenas gestão pode reabrir um mês fechado."
        )

    if not payload.motivo_reabertura or not payload.motivo_reabertura.strip():
        raise HTTPException(
            status_code=400,
            detail="Informe o motivo da reabertura."
        )

    fechamento = (
        await db.execute(
            select(FechamentoMensalDB).where(
                FechamentoMensalDB.id == fechamento_id,
                FechamentoMensalDB.instituicao_id == usuario_atual["instituicao_id"]
            )
        )
    ).scalar_one_or_none()

    if not fechamento:
        raise HTTPException(
            status_code=404,
            detail="Fechamento mensal não encontrado."
        )

    if fechamento.status != "Fechado":
        raise HTTPException(
            status_code=400,
            detail="Este mês não está fechado."
        )

    fechamento.status = "Reaberto"
    fechamento.reaberto_por_id = usuario_atual["sub"]
    fechamento.reaberto_em = agora_sao_paulo()
    fechamento.motivo_reabertura = payload.motivo_reabertura.strip()

    await db.commit()
    await db.refresh(fechamento)

    return fechamento


@router.post("/convenio-sisa/lancamentos", response_model=SisaLancamentoResponse)
async def marcar_lancamento_sisa(
    payload: SisaLancamentoCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    fechamento = (
        await db.execute(
            select(FechamentoMensalDB).where(
                FechamentoMensalDB.instituicao_id == usuario_atual["instituicao_id"],
                FechamentoMensalDB.ano == payload.ano,
                FechamentoMensalDB.mes == payload.mes
            )
        )
    ).scalar_one_or_none()

    if fechamento and fechamento.status == "Fechado":
        raise HTTPException(
            status_code=400,
            detail="Mês fechado. Não é possível alterar lançamentos SISA."
        )

    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == payload.convivente_id,
                ConviventeDB.instituicao_id == usuario_atual["instituicao_id"]
            )
        )
    ).scalar_one_or_none()

    if not convivente:
        raise HTTPException(
            status_code=404,
            detail="Convivente não encontrado."
        )

    existente = (
        await db.execute(
            select(SisaLancamentoDB).where(
                SisaLancamentoDB.instituicao_id == usuario_atual["instituicao_id"],
                SisaLancamentoDB.ano == payload.ano,
                SisaLancamentoDB.mes == payload.mes,
                SisaLancamentoDB.convivente_id == payload.convivente_id
            )
        )
    ).scalar_one_or_none()

    if existente:
        existente.status = "Lancado"
        existente.lancado_por_id = usuario_atual["sub"]
        existente.lancado_em = agora_sao_paulo()
        existente.observacoes = payload.observacoes.strip() if payload.observacoes else None

        await db.commit()
        await db.refresh(existente)

        return existente

    lancamento = SisaLancamentoDB(
        instituicao_id=usuario_atual["instituicao_id"],
        ano=payload.ano,
        mes=payload.mes,
        convivente_id=payload.convivente_id,
        status="Lancado",
        lancado_por_id=usuario_atual["sub"],
        lancado_em=agora_sao_paulo(),
        observacoes=payload.observacoes.strip() if payload.observacoes else None
    )

    db.add(lancamento)

    await db.commit()
    await db.refresh(lancamento)

    return lancamento


@router.delete("/convenio-sisa/lancamentos/{lancamento_id}")
async def desfazer_lancamento_sisa(
    lancamento_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    lancamento = (
        await db.execute(
            select(SisaLancamentoDB).where(
                SisaLancamentoDB.id == lancamento_id,
                SisaLancamentoDB.instituicao_id == usuario_atual["instituicao_id"]
            )
        )
    ).scalar_one_or_none()

    if not lancamento:
        raise HTTPException(
            status_code=404,
            detail="Lançamento SISA não encontrado."
        )

    fechamento = (
        await db.execute(
            select(FechamentoMensalDB).where(
                FechamentoMensalDB.instituicao_id == usuario_atual["instituicao_id"],
                FechamentoMensalDB.ano == lancamento.ano,
                FechamentoMensalDB.mes == lancamento.mes
            )
        )
    ).scalar_one_or_none()

    if fechamento and fechamento.status == "Fechado":
        raise HTTPException(
            status_code=400,
            detail="Mês fechado. Não é possível desfazer lançamento SISA."
        )

    await db.delete(lancamento)
    await db.commit()

    return {"status": "sucesso"}


@router.get("/convenio-sisa/mensal/exportar-xlsx")
async def exportar_sisa_mensal_xlsx(
    ano: int,
    mes: int,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    dados = await relatorio_sisa_mensal(
        ano=ano,
        mes=mes,
        db=db,
        usuario_atual=usuario_atual
    )

    arquivo = gerar_xlsx_convenio_sisa_mensal(dados)

    nome_arquivo = f"relatorio_sisa_convenio_{ano}_{str(mes).zfill(2)}.xlsx"

    return StreamingResponse(
        BytesIO(arquivo),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_arquivo}"'
        }
    )

# =====================================================================
# EDIÇÃO E CANCELAMENTO DE REGISTROS DA ROTINA
# =====================================================================

async def verificar_permissao_edicao(
    db: AsyncSession,
    usuario_atual: dict,
    registro: RegistroRotinaDB
):

    if usuario_eh_gestor(usuario_atual):
        return

    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == registro.convivente_id
            )
        )
    ).scalar_one_or_none()

    if (
        convivente and
        str(convivente.tecnico_id) ==
        str(usuario_atual["sub"])
    ):
        return

    raise HTTPException(
        status_code=403,
        detail="Sem permissão para editar este registro."
    )


@router.put("/rotina/{registro_id}", response_model=RegistroRotinaResponse)
async def editar_registro_rotina(
    registro_id: str,
    payload: RegistroRotinaEdicao,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    tipos_validos = ["Entrada", "Saída", "Almoço"]

    if payload.tipo_registro not in tipos_validos:
        raise HTTPException(
            status_code=400,
            detail="Tipo de registro inválido. Use Entrada, Saída ou Almoço."
        )

    if not payload.motivo_edicao or not payload.motivo_edicao.strip():
        raise HTTPException(
            status_code=400,
            detail="Informe o motivo da edição."
        )

    registro = (
        await db.execute(
            select(RegistroRotinaDB).where(
                RegistroRotinaDB.id == registro_id,
                RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"]
            )
        )
    ).scalar_one_or_none()

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="Registro de rotina não encontrado."
        )

    await verificar_permissao_edicao(
        db,
        usuario_atual,
        registro
    )

    await verificar_mes_fechado(
        db,
        usuario_atual,
        registro.data_registro,
        acao="editar registro de rotina"
    )

    if registro.cancelado:
        raise HTTPException(
            status_code=400,
            detail="Não é possível editar um registro cancelado."
        )

    if not registro.foi_editado:
        registro.tipo_registro_original = registro.tipo_registro
        registro.data_registro_original = registro.data_registro

    registro.tipo_registro = payload.tipo_registro
    registro.foi_editado = True
    registro.editado_por_id = usuario_atual["sub"]
    registro.editado_em = agora_sao_paulo()
    registro.motivo_edicao = payload.motivo_edicao.strip()

    await db.commit()
    await db.refresh(registro)

    return registro


@router.patch("/rotina/{registro_id}/cancelar", response_model=RegistroRotinaResponse)
async def cancelar_registro_rotina(
    registro_id: str,
    payload: RegistroRotinaCancelamento,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    if not payload.motivo_cancelamento or not payload.motivo_cancelamento.strip():
        raise HTTPException(
            status_code=400,
            detail="Informe o motivo do cancelamento."
        )

    registro = (
        await db.execute(
            select(RegistroRotinaDB).where(
                RegistroRotinaDB.id == registro_id,
                RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"]
            )
        )
    ).scalar_one_or_none()

    if not registro:
        raise HTTPException(
            status_code=404,
            detail="Registro de rotina não encontrado."
        )

    await verificar_permissao_edicao(
        db,
        usuario_atual,
        registro
    )

    await verificar_mes_fechado(
        db,
        usuario_atual,
        registro.data_registro,
        acao="cancelar registro de rotina"
    )

    if registro.cancelado:
        raise HTTPException(
            status_code=400,
            detail="Este registro já está cancelado."
        )

    registro.cancelado = True
    registro.cancelado_por_id = usuario_atual["sub"]
    registro.cancelado_em = agora_sao_paulo()
    registro.motivo_cancelamento = payload.motivo_cancelamento.strip()

    await db.commit()
    await db.refresh(registro)

    return registro

@router.patch(
    "/rotina/{registro_id}/desfazer",
    response_model=RegistroRotinaResponse
)
async def desfazer_registro_rapido(
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):

    registro = (
        await db.execute(
            select(RegistroRotinaDB).where(
                RegistroRotinaDB.id == registro_id,
                RegistroRotinaDB.instituicao_id == usuario_atual["instituicao_id"]
            )
        )
    ).scalar_one_or_none()

    if not registro:

        raise HTTPException(
            status_code=404,
            detail="Registro não encontrado."
        )

    if registro.cancelado:

        raise HTTPException(
            status_code=400,
            detail="Registro já cancelado."
        )

    if str(registro.usuario_id) != str(usuario_atual["sub"]):

        raise HTTPException(
            status_code=403,
            detail="Apenas o operador original pode desfazer."
        )

    diferenca = (
        agora_sao_paulo() -
        registro.data_registro
    )

    if diferenca > timedelta(minutes=1):

        raise HTTPException(
            status_code=403,
            detail="Prazo de desfazer expirado."
        )

    await verificar_mes_fechado(
        db,
        usuario_atual,
        registro.data_registro,
        acao="desfazer registro de rotina"
    )

    registro.cancelado = True

    registro.cancelado_por_id = usuario_atual["sub"]

    registro.cancelado_em = agora_sao_paulo()

    registro.motivo_cancelamento = (
        "Erro operacional - correção imediata"
    )

    await db.commit()

    await db.refresh(registro)

    return registro

# =====================================================================
# DASHBOARD — SÉRIES REAIS DE ATENDIMENTOS
# =====================================================================

def _inicio_mes_referencia(data_base: datetime, meses_atras: int = 0) -> datetime:
    ano = data_base.year
    mes = data_base.month - meses_atras

    while mes <= 0:
        mes += 12
        ano -= 1

    return datetime(ano, mes, 1)


def _chave_semana(data: datetime):
    ano, semana, _ = data.isocalendar()
    return f"{ano}-S{str(semana).zfill(2)}"


@router.get("/dashboard/series-atendimentos")
async def dashboard_series_atendimentos(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado)
):
    """
    Séries reais para o Dashboard.

    Fonte:
    - registros_rotina não cancelados;
    - agrupamento por dia, semana e mês;
    - atendimento = registro operacional válido de rotina.
    """
    inst_id = usuario_atual["instituicao_id"]
    agora = agora_sao_paulo()
    hoje = agora.date()

    inicio_7_dias = datetime.combine(
        hoje - timedelta(days=6),
        datetime.min.time()
    )

    inicio_6_semanas = datetime.combine(
        hoje - timedelta(weeks=5),
        datetime.min.time()
    )

    inicio_6_meses = _inicio_mes_referencia(agora, 5)

    registros = (
        await db.execute(
            select(RegistroRotinaDB).where(
                RegistroRotinaDB.instituicao_id == inst_id,
                RegistroRotinaDB.cancelado != True,
                RegistroRotinaDB.data_registro >= inicio_6_meses
            )
        )
    ).scalars().all()

    conviventes_criados_por_mes = {
        _inicio_mes_referencia(agora, offset).strftime("%Y-%m"): 0
        for offset in range(5, -1, -1)
    }

    try:
        conviventes_periodo = (
            await db.execute(
                select(ConviventeDB).where(
                    ConviventeDB.instituicao_id == inst_id,
                    ConviventeDB.data_entrada != None,
                    ConviventeDB.data_entrada >= inicio_6_meses.date()
                )
            )
        ).scalars().all()

        for convivente in conviventes_periodo:
            if convivente.data_entrada:
                chave = convivente.data_entrada.strftime("%Y-%m")
                if chave in conviventes_criados_por_mes:
                    conviventes_criados_por_mes[chave] += 1
    except Exception:
        pass

    # Últimos 6 meses
    meses = []
    for offset in range(5, -1, -1):
        inicio_mes = _inicio_mes_referencia(agora, offset)
        chave = inicio_mes.strftime("%Y-%m")
        rotulo = f"{str(inicio_mes.month).zfill(2)}/{inicio_mes.year}"
        meses.append({
            "chave": chave,
            "rotulo": rotulo,
            "atendimentos": 0,
            "novos_conviventes": conviventes_criados_por_mes.get(chave, 0)
        })

    indice_meses = {item["chave"]: item for item in meses}

    # Últimos 7 dias
    dias = []
    for offset in range(6, -1, -1):
        dia = hoje - timedelta(days=offset)
        dias.append({
            "chave": dia.isoformat(),
            "rotulo": dia.strftime("%d/%m"),
            "atendimentos": 0
        })

    indice_dias = {item["chave"]: item for item in dias}

    # Últimas 6 semanas
    semanas = []
    semanas_chaves = []
    for offset in range(5, -1, -1):
        data_ref = hoje - timedelta(weeks=offset)
        chave = _chave_semana(datetime.combine(data_ref, datetime.min.time()))
        semanas_chaves.append(chave)
        semanas.append({
            "chave": chave,
            "rotulo": chave.replace("-", " "),
            "atendimentos": 0
        })

    indice_semanas = {item["chave"]: item for item in semanas}

    for registro in registros:
        data_registro = registro.data_registro
        if not data_registro:
            continue

        chave_mes = data_registro.strftime("%Y-%m")
        if chave_mes in indice_meses:
            indice_meses[chave_mes]["atendimentos"] += 1

        chave_dia = data_registro.date().isoformat()
        if chave_dia in indice_dias:
            indice_dias[chave_dia]["atendimentos"] += 1

        chave_semana = _chave_semana(data_registro)
        if chave_semana in indice_semanas:
            indice_semanas[chave_semana]["atendimentos"] += 1

    total_hoje = indice_dias.get(hoje.isoformat(), {}).get("atendimentos", 0)

    semana_atual_chave = _chave_semana(datetime.combine(hoje, datetime.min.time()))
    total_semana = indice_semanas.get(semana_atual_chave, {}).get("atendimentos", 0)

    mes_atual_chave = agora.strftime("%Y-%m")
    total_mes = indice_meses.get(mes_atual_chave, {}).get("atendimentos", 0)

    return {
        "mensal_6_meses": meses,
        "diario_7_dias": dias,
        "semanal_6_semanas": semanas,
        "resumo": {
            "atendimentos_hoje": total_hoje,
            "atendimentos_semana": total_semana,
            "atendimentos_mes": total_mes,
            "novos_conviventes_mes": indice_meses.get(mes_atual_chave, {}).get("novos_conviventes", 0)
        }
    }