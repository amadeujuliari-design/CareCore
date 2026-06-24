from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from atividades_agenda import (
    TIPOS_FREQUENCIA_VALIDOS,
    gerar_datas_ocorrencias_mes,
    mes_referencia_de,
    parse_configuracao_agenda,
    parse_mes_referencia,
    serializar_configuracao_agenda,
)
from database import get_db
from models import (
    AtividadeDB,
    AtividadeOcorrenciaDB,
    AtividadePontosResgateDB,
    AtividadePresencaDB,
    AtividadeSessaoConteudoDB,
    ConviventeDB,
    UsuarioDB,
)
from routers.conviventes_helpers import agora_sao_paulo
from schemas import (
    AtividadeChamadaResponse,
    AtividadeCreate,
    AtividadeGerarOcorrenciasRequest,
    AtividadeGradeConviventeLinha,
    AtividadeGradeResponse,
    AtividadeOcorrenciaResponse,
    AtividadeOcorrenciasListaResponse,
    AtividadePresencaCancelamento,
    AtividadePresencaCreate,
    AtividadePresencaResponse,
    AtividadeRelatorioLinha,
    AtividadeRelatorioResponse,
    AtividadeRelatorioResumo,
    AtividadeResponse,
    AtividadeSessaoConteudoResponse,
    AtividadeSessaoConteudoUpsert,
    AtividadeOcorrenciaStatusUpdate,
    AtividadePontosRankingItem,
    AtividadePontosRankingResponse,
    AtividadePontosResgateCreate,
    AtividadePontosResgateResponse,
    AtividadePontosResgatesListaResponse,
    AtividadeUpdate,
    AtividadesListaResponse,
    CATEGORIAS_ATIVIDADE,
    METODOS_PRESENCA_ATIVIDADE,
    STATUS_OCORRENCIA_ATIVIDADE,
    TIPOS_FREQUENCIA_ATIVIDADE,
)
from security import bloquear_usuario_global_puro, get_usuario_logado, usuario_eh_manutencao
from tenant_scope import obter_instituicao_escopo
from atividades_pontos_service import (
    PONTOS_POR_PRESENCA_ATIVIDADE,
    calcular_saldo_convivente,
    montar_ranking_pontos,
)
from atividades_sisa_service import registrar_catalogos_de_atividade
from pia_assinatura_digital import validar_codigo_carteirinha_convivente


router = APIRouter(prefix="/api/atividades", tags=["Atividades"])

STATUS_CONVIVENTE_ATIVIDADES = {"Ativo", "Em acolhimento"}
METODOS_DIGITAIS_PRESENCA = {"QR Code", "Código de barras", "Leitor USB"}
PRAZO_DESFAZER = timedelta(minutes=1)
AGRUPAMENTOS_RELATORIO = frozenset({"detalhado", "por_atividade", "por_convivente"})


def _parse_data_filtro(valor: Optional[str], obrigatorio: bool = False) -> Optional[date]:
    if not valor:
        if obrigatorio:
            raise HTTPException(status_code=400, detail="Informe a data no formato AAAA-MM-DD.")
        return None
    try:
        return date.fromisoformat(valor.strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use o formato AAAA-MM-DD.")


def _periodo_padrao_mes_atual() -> tuple[date, date]:
    agora = agora_sao_paulo()
    inicio = date(agora.year, agora.month, 1)
    if agora.month == 12:
        fim = date(agora.year + 1, 1, 1) - timedelta(days=1)
    else:
        fim = date(agora.year, agora.month + 1, 1) - timedelta(days=1)
    return inicio, fim


def exigir_edicao_atividades(usuario: dict = Depends(get_usuario_logado)) -> dict:
    if not usuario_eh_manutencao(usuario):
        bloquear_usuario_global_puro(usuario)
    obter_instituicao_escopo(usuario)
    return usuario


def exigir_leitura_atividades(usuario: dict = Depends(get_usuario_logado)) -> dict:
    obter_instituicao_escopo(usuario)
    return usuario


def convivente_elegivel_atividade(convivente: ConviventeDB | None) -> bool:
    if not convivente:
        return False
    return getattr(convivente, "status", None) in STATUS_CONVIVENTE_ATIVIDADES


def metodo_presenca_eh_digital(metodo: str) -> bool:
    return str(metodo or "").strip() in METODOS_DIGITAIS_PRESENCA


def pode_desfazer_presenca(presenca: AtividadePresencaDB, usuario_id: str, agora=None) -> bool:
    if presenca.cancelado:
        return False
    if str(presenca.usuario_id) != str(usuario_id):
        return False
    agora = agora or agora_sao_paulo()
    return agora - presenca.registrado_em <= PRAZO_DESFAZER


async def _buscar_atividade(
    db: AsyncSession,
    atividade_id: str,
    instituicao_id: str,
) -> AtividadeDB:
    atividade = (
        await db.execute(
            select(AtividadeDB).where(
                AtividadeDB.id == atividade_id,
                AtividadeDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not atividade:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    return atividade


async def _buscar_ocorrencia(
    db: AsyncSession,
    ocorrencia_id: str,
    instituicao_id: str,
) -> AtividadeOcorrenciaDB:
    ocorrencia = (
        await db.execute(
            select(AtividadeOcorrenciaDB).where(
                AtividadeOcorrenciaDB.id == ocorrencia_id,
                AtividadeOcorrenciaDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not ocorrencia:
        raise HTTPException(status_code=404, detail="Sessão da atividade não encontrada.")
    return ocorrencia


async def _buscar_presenca(
    db: AsyncSession,
    presenca_id: str,
    instituicao_id: str,
) -> AtividadePresencaDB:
    presenca = (
        await db.execute(
            select(AtividadePresencaDB).where(
                AtividadePresencaDB.id == presenca_id,
                AtividadePresencaDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not presenca:
        raise HTTPException(status_code=404, detail="Presença não encontrada.")
    return presenca


async def _nome_usuario(db: AsyncSession, usuario_id: str | None) -> str | None:
    if not usuario_id:
        return None
    usuario = (
        await db.execute(select(UsuarioDB).where(UsuarioDB.id == usuario_id))
    ).scalar_one_or_none()
    return usuario.nome if usuario else None


def _nome_convivente(convivente: ConviventeDB | None) -> str:
    if not convivente:
        return ""
    return convivente.nome_social or convivente.nome_completo or ""


def _prontuario_convivente(convivente: ConviventeDB | None) -> str | None:
    if not convivente or convivente.numero_institucional is None:
        return None
    return str(convivente.numero_institucional)


def _validar_payload_atividade(payload: AtividadeCreate | AtividadeUpdate, criacao: bool = False) -> None:
    nome = getattr(payload, "nome", None)
    if criacao and (not nome or not str(nome).strip()):
        raise HTTPException(status_code=400, detail="Informe o nome da atividade.")

    categoria = getattr(payload, "categoria", None)
    if categoria is not None and categoria not in CATEGORIAS_ATIVIDADE:
        raise HTTPException(status_code=400, detail="Categoria de atividade inválida.")

    tipo = getattr(payload, "tipo_frequencia", None)
    if tipo is not None and tipo not in TIPOS_FREQUENCIA_VALIDOS:
        raise HTTPException(status_code=400, detail="Tipo de frequência inválido.")


async def _montar_atividade_response(
    db: AsyncSession,
    atividade: AtividadeDB,
) -> AtividadeResponse:
    return AtividadeResponse(
        id=atividade.id,
        instituicao_id=atividade.instituicao_id,
        nome=atividade.nome,
        categoria=atividade.categoria,
        responsavel_usuario_id=atividade.responsavel_usuario_id,
        responsavel_nome=await _nome_usuario(db, atividade.responsavel_usuario_id),
        tipo_frequencia=atividade.tipo_frequencia,
        configuracao_agenda=parse_configuracao_agenda(atividade.configuracao_agenda),
        vigencia_inicio=atividade.vigencia_inicio,
        vigencia_fim=atividade.vigencia_fim,
        sisa_descricao_atividade=atividade.sisa_descricao_atividade,
        sisa_descricao_tema=atividade.sisa_descricao_tema,
        sisa_horario_padrao=atividade.sisa_horario_padrao,
        ativo=bool(atividade.ativo),
        criado_por_id=atividade.criado_por_id,
        criado_em=atividade.criado_em,
        atualizado_em=atividade.atualizado_em,
    )


async def _contar_presentes(db: AsyncSession, ocorrencia_id: str) -> int:
    total = (
        await db.execute(
            select(func.count(AtividadePresencaDB.id)).where(
                AtividadePresencaDB.ocorrencia_id == ocorrencia_id,
                AtividadePresencaDB.cancelado.is_(False),
            )
        )
    ).scalar()
    return int(total or 0)


async def _montar_ocorrencia_response(
    db: AsyncSession,
    ocorrencia: AtividadeOcorrenciaDB,
) -> AtividadeOcorrenciaResponse:
    return AtividadeOcorrenciaResponse(
        id=ocorrencia.id,
        atividade_id=ocorrencia.atividade_id,
        data_sessao=ocorrencia.data_sessao,
        numero_sessao_mes=ocorrencia.numero_sessao_mes,
        mes_referencia=ocorrencia.mes_referencia,
        horario_sessao=ocorrencia.horario_sessao or "",
        status=ocorrencia.status,
        criado_em=ocorrencia.criado_em,
        total_presentes=await _contar_presentes(db, ocorrencia.id),
    )


async def _montar_presenca_response(
    db: AsyncSession,
    presenca: AtividadePresencaDB,
    convivente: ConviventeDB | None,
    usuario_atual_id: str,
) -> AtividadePresencaResponse:
    return AtividadePresencaResponse(
        id=presenca.id,
        atividade_id=presenca.atividade_id,
        ocorrencia_id=presenca.ocorrencia_id,
        convivente_id=presenca.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        prontuario=_prontuario_convivente(convivente),
        usuario_id=presenca.usuario_id,
        usuario_nome=await _nome_usuario(db, presenca.usuario_id),
        metodo_leitura=presenca.metodo_leitura,
        codigo_lido=presenca.codigo_lido,
        registrado_em=presenca.registrado_em,
        cancelado=bool(presenca.cancelado),
        pode_desfazer=pode_desfazer_presenca(presenca, usuario_atual_id),
    )


async def _listar_conviventes_elegiveis(
    db: AsyncSession,
    instituicao_id: str,
) -> list[ConviventeDB]:
    conviventes = (
        await db.execute(
            select(ConviventeDB)
            .where(
                ConviventeDB.instituicao_id == instituicao_id,
                ConviventeDB.status.in_(STATUS_CONVIVENTE_ATIVIDADES),
            )
            .order_by(ConviventeDB.nome_completo.asc())
        )
    ).scalars().all()
    return list(conviventes)


async def _validar_conflito_presenca_manual(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
    data_sessao: date,
    atividade_id_atual: str,
) -> None:
    conflito = (
        await db.execute(
            select(AtividadePresencaDB, AtividadeDB)
            .join(AtividadeDB, AtividadeDB.id == AtividadePresencaDB.atividade_id)
            .join(AtividadeOcorrenciaDB, AtividadeOcorrenciaDB.id == AtividadePresencaDB.ocorrencia_id)
            .where(
                AtividadePresencaDB.instituicao_id == instituicao_id,
                AtividadePresencaDB.convivente_id == convivente_id,
                AtividadePresencaDB.cancelado.is_(False),
                AtividadePresencaDB.metodo_leitura == "Manual",
                AtividadePresencaDB.atividade_id != atividade_id_atual,
                AtividadeOcorrenciaDB.data_sessao == data_sessao,
            )
        )
    ).first()
    if not conflito:
        return
    _, atividade_conflito = conflito
    raise HTTPException(
        status_code=409,
        detail=(
            f"Presença manual já registrada hoje em \"{atividade_conflito.nome}\". "
            "Use a carteirinha se a participação for em ambas as atividades."
        ),
    )


async def _obter_presenca_ativa(
    db: AsyncSession,
    ocorrencia_id: str,
    convivente_id: str,
) -> AtividadePresencaDB | None:
    return (
        await db.execute(
            select(AtividadePresencaDB).where(
                AtividadePresencaDB.ocorrencia_id == ocorrencia_id,
                AtividadePresencaDB.convivente_id == convivente_id,
                AtividadePresencaDB.cancelado.is_(False),
            )
        )
    ).scalar_one_or_none()


@router.get("/meta/opcoes")
async def meta_opcoes_atividades(
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    return {
        "categorias": CATEGORIAS_ATIVIDADE,
        "tipos_frequencia": TIPOS_FREQUENCIA_ATIVIDADE,
        "metodos_presenca": METODOS_PRESENCA_ATIVIDADE,
        "status_ocorrencia": STATUS_OCORRENCIA_ATIVIDADE,
        "pontos_por_presenca": PONTOS_POR_PRESENCA_ATIVIDADE,
        "dias_semana": [
            {"valor": 0, "rotulo": "Segunda-feira"},
            {"valor": 1, "rotulo": "Terça-feira"},
            {"valor": 2, "rotulo": "Quarta-feira"},
            {"valor": 3, "rotulo": "Quinta-feira"},
            {"valor": 4, "rotulo": "Sexta-feira"},
            {"valor": 5, "rotulo": "Sábado"},
            {"valor": 6, "rotulo": "Domingo"},
        ],
    }


@router.get("", response_model=AtividadesListaResponse)
async def listar_atividades(
    somente_ativas: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    query = select(AtividadeDB).where(AtividadeDB.instituicao_id == instituicao_id)
    if somente_ativas:
        query = query.where(AtividadeDB.ativo.is_(True))
    query = query.order_by(AtividadeDB.nome.asc())
    atividades = (await db.execute(query)).scalars().all()
    items = [await _montar_atividade_response(db, item) for item in atividades]
    return AtividadesListaResponse(items=items, total=len(items))


@router.post("", response_model=AtividadeResponse, status_code=status.HTTP_201_CREATED)
async def criar_atividade(
    payload: AtividadeCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    _validar_payload_atividade(payload, criacao=True)

    if payload.responsavel_usuario_id:
        responsavel = (
            await db.execute(
                select(UsuarioDB).where(UsuarioDB.id == payload.responsavel_usuario_id)
            )
        ).scalar_one_or_none()
        if not responsavel:
            raise HTTPException(status_code=400, detail="Responsável informado não encontrado.")

    agora = agora_sao_paulo()
    atividade = AtividadeDB(
        instituicao_id=instituicao_id,
        nome=payload.nome.strip(),
        categoria=payload.categoria,
        responsavel_usuario_id=payload.responsavel_usuario_id,
        tipo_frequencia=payload.tipo_frequencia,
        configuracao_agenda=serializar_configuracao_agenda(payload.configuracao_agenda.model_dump()),
        vigencia_inicio=payload.vigencia_inicio,
        vigencia_fim=payload.vigencia_fim,
        sisa_descricao_atividade=(payload.sisa_descricao_atividade or "").strip() or None,
        sisa_descricao_tema=(payload.sisa_descricao_tema or "").strip() or None,
        sisa_horario_padrao=(payload.sisa_horario_padrao or "").strip() or None,
        ativo=payload.ativo,
        criado_por_id=usuario_atual["sub"],
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(atividade)
    await registrar_catalogos_de_atividade(
        db,
        instituicao_id=instituicao_id,
        usuario_id=usuario_atual["sub"],
        descricao_atividade=atividade.sisa_descricao_atividade,
        descricao_tema=atividade.sisa_descricao_tema,
    )
    await db.commit()
    await db.refresh(atividade)
    return await _montar_atividade_response(db, atividade)


@router.get("/relatorios", response_model=AtividadeRelatorioResponse)
async def relatorio_atividades(
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    atividade_id: Optional[str] = Query(None),
    responsavel_usuario_id: Optional[str] = Query(None),
    convivente_id: Optional[str] = Query(None),
    agrupamento: str = Query("detalhado"),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    agrup = str(agrupamento or "detalhado").strip().lower()
    if agrup not in AGRUPAMENTOS_RELATORIO:
        raise HTTPException(status_code=400, detail="Agrupamento de relatório inválido.")

    inicio = _parse_data_filtro(data_inicio)
    fim = _parse_data_filtro(data_fim)
    if not inicio or not fim:
        padrao_inicio, padrao_fim = _periodo_padrao_mes_atual()
        inicio = inicio or padrao_inicio
        fim = fim or padrao_fim
    if inicio > fim:
        raise HTTPException(status_code=400, detail="Data inicial não pode ser maior que a data final.")

    query = (
        select(
            AtividadePresencaDB,
            AtividadeOcorrenciaDB,
            AtividadeDB,
            ConviventeDB,
            UsuarioDB,
        )
        .join(AtividadeOcorrenciaDB, AtividadeOcorrenciaDB.id == AtividadePresencaDB.ocorrencia_id)
        .join(AtividadeDB, AtividadeDB.id == AtividadePresencaDB.atividade_id)
        .join(ConviventeDB, ConviventeDB.id == AtividadePresencaDB.convivente_id)
        .join(UsuarioDB, UsuarioDB.id == AtividadePresencaDB.usuario_id)
        .where(
            AtividadePresencaDB.instituicao_id == instituicao_id,
            AtividadePresencaDB.cancelado.is_(False),
            AtividadeOcorrenciaDB.data_sessao >= inicio,
            AtividadeOcorrenciaDB.data_sessao <= fim,
        )
        .order_by(
            AtividadeOcorrenciaDB.data_sessao.asc(),
            AtividadeDB.nome.asc(),
            ConviventeDB.nome_completo.asc(),
        )
    )
    if atividade_id:
        query = query.where(AtividadePresencaDB.atividade_id == atividade_id)
    if responsavel_usuario_id:
        query = query.where(AtividadeDB.responsavel_usuario_id == responsavel_usuario_id)
    if convivente_id:
        query = query.where(AtividadePresencaDB.convivente_id == convivente_id)

    registros = (await db.execute(query)).all()
    responsavel_cache: dict[str, str | None] = {}

    async def responsavel_nome(usuario_id: str | None) -> str | None:
        if not usuario_id:
            return None
        if usuario_id not in responsavel_cache:
            responsavel_cache[usuario_id] = await _nome_usuario(db, usuario_id)
        return responsavel_cache[usuario_id]

    detalhes: list[AtividadeRelatorioLinha] = []
    conviventes_ids: set[str] = set()
    atividades_ids: set[str] = set()
    sessoes_ids: set[str] = set()

    for presenca, ocorrencia, atividade, convivente, usuario_registro in registros:
        conviventes_ids.add(convivente.id)
        atividades_ids.add(atividade.id)
        sessoes_ids.add(ocorrencia.id)
        detalhes.append(
            AtividadeRelatorioLinha(
                chave=presenca.id,
                rotulo=_nome_convivente(convivente),
                data_sessao=ocorrencia.data_sessao,
                atividade_id=atividade.id,
                atividade_nome=atividade.nome,
                responsavel_nome=await responsavel_nome(atividade.responsavel_usuario_id),
                convivente_id=convivente.id,
                convivente_nome=_nome_convivente(convivente),
                prontuario=_prontuario_convivente(convivente),
                metodo_leitura=presenca.metodo_leitura,
                registrado_por_nome=usuario_registro.nome if usuario_registro else None,
            )
        )

    resumo = AtividadeRelatorioResumo(
        total_presencas=len(detalhes),
        total_conviventes=len(conviventes_ids),
        total_atividades=len(atividades_ids),
        total_sessoes=len(sessoes_ids),
    )

    if agrup == "detalhado":
        linhas = detalhes
    elif agrup == "por_atividade":
        agregado: dict[str, dict] = {}
        for linha in detalhes:
            bucket = agregado.setdefault(
                linha.atividade_id or "",
                {
                    "atividade_nome": linha.atividade_nome,
                    "responsavel_nome": linha.responsavel_nome,
                    "presencas": 0,
                    "conviventes": set(),
                    "sessoes": set(),
                },
            )
            bucket["presencas"] += 1
            if linha.convivente_id:
                bucket["conviventes"].add(linha.convivente_id)
            if linha.data_sessao:
                bucket["sessoes"].add(linha.data_sessao.isoformat())
        linhas = [
            AtividadeRelatorioLinha(
                chave=atividade_key,
                rotulo=dados["atividade_nome"] or "Atividade",
                atividade_id=atividade_key or None,
                atividade_nome=dados["atividade_nome"],
                responsavel_nome=dados["responsavel_nome"],
                total_presencas=dados["presencas"],
                total_conviventes=len(dados["conviventes"]),
                total_sessoes=len(dados["sessoes"]),
            )
            for atividade_key, dados in sorted(
                agregado.items(),
                key=lambda item: (item[1]["atividade_nome"] or "").lower(),
            )
        ]
    else:
        agregado_conv: dict[str, dict] = {}
        for linha in detalhes:
            bucket = agregado_conv.setdefault(
                linha.convivente_id or "",
                {
                    "convivente_nome": linha.convivente_nome,
                    "prontuario": linha.prontuario,
                    "presencas": 0,
                    "atividades": set(),
                },
            )
            bucket["presencas"] += 1
            if linha.atividade_id:
                bucket["atividades"].add(linha.atividade_id)
        linhas = [
            AtividadeRelatorioLinha(
                chave=conv_key,
                rotulo=dados["convivente_nome"] or "Convivente",
                convivente_id=conv_key or None,
                convivente_nome=dados["convivente_nome"],
                prontuario=dados["prontuario"],
                total_presencas=dados["presencas"],
                total_atividades=len(dados["atividades"]),
            )
            for conv_key, dados in sorted(
                agregado_conv.items(),
                key=lambda item: (item[1]["convivente_nome"] or "").lower(),
            )
        ]

    return AtividadeRelatorioResponse(
        data_inicio=inicio,
        data_fim=fim,
        agrupamento=agrup,
        resumo=resumo,
        linhas=linhas,
    )


async def _montar_resgate_response(
    db: AsyncSession,
    resgate: AtividadePontosResgateDB,
    convivente: ConviventeDB,
    saldo_restante: int | None,
) -> AtividadePontosResgateResponse:
    usuario = (
        await db.execute(select(UsuarioDB).where(UsuarioDB.id == resgate.usuario_id))
    ).scalar_one_or_none()
    return AtividadePontosResgateResponse(
        id=resgate.id,
        convivente_id=convivente.id,
        convivente_nome=convivente.nome_completo,
        pontos_utilizados=resgate.pontos_utilizados,
        descricao_brinde=resgate.descricao_brinde,
        saldo_restante=saldo_restante,
        usuario_nome=getattr(usuario, "nome", None) if usuario else None,
        metodo_leitura=resgate.metodo_leitura,
        registrado_em=resgate.registrado_em,
    )


@router.get("/pontos/ranking", response_model=AtividadePontosRankingResponse)
async def ranking_pontos_atividades(
    busca: Optional[str] = Query(None),
    somente_com_saldo: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    itens_ranking = await montar_ranking_pontos(
        db,
        instituicao_id,
        busca=busca,
        somente_com_saldo=somente_com_saldo,
    )
    items = [
        AtividadePontosRankingItem(
            posicao=item["posicao"],
            convivente_id=item["convivente"].id,
            nome=item["convivente"].nome_social or item["convivente"].nome_completo,
            numero_institucional=item["convivente"].numero_institucional,
            total_presencas=item["total_presencas"],
            pontos_ganhos=item["pontos_ganhos"],
            pontos_utilizados=item["pontos_utilizados"],
            saldo_pontos=item["saldo_pontos"],
        )
        for item in itens_ranking
    ]
    return AtividadePontosRankingResponse(
        items=items,
        total=len(items),
        pontos_por_presenca=PONTOS_POR_PRESENCA_ATIVIDADE,
    )


@router.get("/pontos/resgates", response_model=AtividadePontosResgatesListaResponse)
async def listar_resgates_pontos_atividades(
    limit: int = Query(30, ge=1, le=200),
    offset: int = Query(0, ge=0),
    convivente_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)

    filtros = [AtividadePontosResgateDB.instituicao_id == instituicao_id]
    if convivente_id:
        filtros.append(AtividadePontosResgateDB.convivente_id == convivente_id)

    total = await db.scalar(
        select(func.count(AtividadePontosResgateDB.id)).where(*filtros)
    )

    rows = (
        await db.execute(
            select(AtividadePontosResgateDB, ConviventeDB)
            .join(ConviventeDB, ConviventeDB.id == AtividadePontosResgateDB.convivente_id)
            .where(*filtros)
            .order_by(AtividadePontosResgateDB.registrado_em.desc())
            .offset(offset)
            .limit(limit)
        )
    ).all()

    items: list[AtividadePontosResgateResponse] = []
    for resgate, convivente in rows:
        items.append(
            await _montar_resgate_response(db, resgate, convivente, None)
        )

    total_int = int(total or 0)
    return AtividadePontosResgatesListaResponse(
        items=items,
        total=total_int,
        limit=limit,
        offset=offset,
        has_more=(offset + len(items)) < total_int,
    )


@router.post("/pontos/resgates", response_model=AtividadePontosResgateResponse)
async def registrar_resgate_pontos_atividades(
    payload: AtividadePontosResgateCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)

    metodo = str(payload.metodo_leitura or "").strip()
    if metodo not in METODOS_DIGITAIS_PRESENCA:
        raise HTTPException(
            status_code=400,
            detail="O resgate de brindes exige leitura da carteirinha (QR, código de barras ou leitor USB).",
        )

    codigo_lido = str(payload.codigo_lido or "").strip()
    if not codigo_lido:
        raise HTTPException(status_code=400, detail="Informe o código lido da carteirinha.")

    pontos = int(payload.pontos_utilizados)
    if pontos <= 0:
        raise HTTPException(status_code=400, detail="Informe uma quantidade de pontos maior que zero.")

    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == payload.convivente_id,
                ConviventeDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not convivente_elegivel_atividade(convivente):
        raise HTTPException(status_code=400, detail="Convivente não elegível para resgate de pontos.")

    try:
        validar_codigo_carteirinha_convivente(convivente, codigo_lido)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    saldo = await calcular_saldo_convivente(db, instituicao_id, convivente.id)
    if pontos > saldo.saldo_pontos:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Saldo insuficiente. Disponível: {saldo.saldo_pontos} pontos; "
                f"solicitado: {pontos} pontos."
            ),
        )

    descricao = (payload.descricao_brinde or "").strip() or None
    resgate = AtividadePontosResgateDB(
        instituicao_id=instituicao_id,
        convivente_id=convivente.id,
        pontos_utilizados=pontos,
        descricao_brinde=descricao,
        usuario_id=usuario_atual["sub"],
        metodo_leitura=metodo,
        codigo_lido=codigo_lido,
        registrado_em=agora_sao_paulo(),
    )
    db.add(resgate)
    await db.commit()
    await db.refresh(resgate)

    saldo_restante = saldo.saldo_pontos - pontos
    return await _montar_resgate_response(db, resgate, convivente, saldo_restante)


@router.get("/{atividade_id}", response_model=AtividadeResponse)
async def obter_atividade(
    atividade_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    atividade = await _buscar_atividade(db, atividade_id, instituicao_id)
    return await _montar_atividade_response(db, atividade)


@router.put("/{atividade_id}", response_model=AtividadeResponse)
async def atualizar_atividade(
    atividade_id: str,
    payload: AtividadeUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    _validar_payload_atividade(payload)
    atividade = await _buscar_atividade(db, atividade_id, instituicao_id)

    if payload.nome is not None:
        if not payload.nome.strip():
            raise HTTPException(status_code=400, detail="Informe o nome da atividade.")
        atividade.nome = payload.nome.strip()
    if payload.categoria is not None:
        atividade.categoria = payload.categoria
    if payload.responsavel_usuario_id is not None:
        atividade.responsavel_usuario_id = payload.responsavel_usuario_id or None
    if payload.tipo_frequencia is not None:
        atividade.tipo_frequencia = payload.tipo_frequencia
    if payload.configuracao_agenda is not None:
        atividade.configuracao_agenda = serializar_configuracao_agenda(
            payload.configuracao_agenda.model_dump()
        )
    if payload.vigencia_inicio is not None:
        atividade.vigencia_inicio = payload.vigencia_inicio
    if payload.vigencia_fim is not None:
        atividade.vigencia_fim = payload.vigencia_fim
    if payload.sisa_descricao_atividade is not None:
        atividade.sisa_descricao_atividade = payload.sisa_descricao_atividade.strip() or None
    if payload.sisa_descricao_tema is not None:
        atividade.sisa_descricao_tema = payload.sisa_descricao_tema.strip() or None
    if payload.sisa_horario_padrao is not None:
        atividade.sisa_horario_padrao = payload.sisa_horario_padrao.strip() or None
    if payload.ativo is not None:
        atividade.ativo = payload.ativo

    atividade.atualizado_em = agora_sao_paulo()
    await registrar_catalogos_de_atividade(
        db,
        instituicao_id=instituicao_id,
        usuario_id=usuario_atual["sub"],
        descricao_atividade=atividade.sisa_descricao_atividade,
        descricao_tema=atividade.sisa_descricao_tema,
    )
    await db.commit()
    await db.refresh(atividade)
    return await _montar_atividade_response(db, atividade)


@router.post("/{atividade_id}/gerar-ocorrencias", response_model=AtividadeOcorrenciasListaResponse)
async def gerar_ocorrencias_atividade(
    atividade_id: str,
    payload: AtividadeGerarOcorrenciasRequest,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    atividade = await _buscar_atividade(db, atividade_id, instituicao_id)

    try:
        ano, mes = parse_mes_referencia(payload.mes_referencia)
        datas = gerar_datas_ocorrencias_mes(
            ano,
            mes,
            atividade.tipo_frequencia,
            atividade.configuracao_agenda,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not datas:
        raise HTTPException(
            status_code=400,
            detail="Nenhuma sessão gerada para o mês informado. Revise a agenda da atividade.",
        )

    mes_ref = mes_referencia_de(ano, mes)
    existentes = (
        await db.execute(
            select(AtividadeOcorrenciaDB.data_sessao, AtividadeOcorrenciaDB.horario_sessao).where(
                AtividadeOcorrenciaDB.atividade_id == atividade.id,
                AtividadeOcorrenciaDB.mes_referencia == mes_ref,
            )
        )
    ).all()
    existentes_set = {(data, horario or "") for data, horario in existentes}

    criadas: list[AtividadeOcorrenciaDB] = []
    numero = len(existentes_set)
    agora = agora_sao_paulo()
    horario_padrao = (atividade.sisa_horario_padrao or "").strip()
    for data_sessao in datas:
        if (data_sessao, horario_padrao) in existentes_set:
            continue
        if atividade.vigencia_inicio and data_sessao < atividade.vigencia_inicio:
            continue
        if atividade.vigencia_fim and data_sessao > atividade.vigencia_fim:
            continue
        numero += 1
        ocorrencia = AtividadeOcorrenciaDB(
            instituicao_id=instituicao_id,
            atividade_id=atividade.id,
            data_sessao=data_sessao,
            numero_sessao_mes=numero,
            mes_referencia=mes_ref,
            horario_sessao=horario_padrao,
            status="aberta",
            criado_em=agora,
        )
        db.add(ocorrencia)
        criadas.append(ocorrencia)

    await db.commit()
    for item in criadas:
        await db.refresh(item)

    todas = (
        await db.execute(
            select(AtividadeOcorrenciaDB)
            .where(
                AtividadeOcorrenciaDB.atividade_id == atividade.id,
                AtividadeOcorrenciaDB.mes_referencia == mes_ref,
            )
            .order_by(AtividadeOcorrenciaDB.data_sessao.asc())
        )
    ).scalars().all()

    items = [await _montar_ocorrencia_response(db, item) for item in todas]
    return AtividadeOcorrenciasListaResponse(
        items=items,
        total=len(items),
        mes_referencia=mes_ref,
    )


@router.get("/{atividade_id}/ocorrencias", response_model=AtividadeOcorrenciasListaResponse)
async def listar_ocorrencias_atividade(
    atividade_id: str,
    mes_referencia: str = Query(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    await _buscar_atividade(db, atividade_id, instituicao_id)
    try:
        parse_mes_referencia(mes_referencia)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    ocorrencias = (
        await db.execute(
            select(AtividadeOcorrenciaDB)
            .where(
                AtividadeOcorrenciaDB.atividade_id == atividade_id,
                AtividadeOcorrenciaDB.instituicao_id == instituicao_id,
                AtividadeOcorrenciaDB.mes_referencia == mes_referencia,
            )
            .order_by(AtividadeOcorrenciaDB.data_sessao.asc())
        )
    ).scalars().all()
    items = [await _montar_ocorrencia_response(db, item) for item in ocorrencias]
    return AtividadeOcorrenciasListaResponse(
        items=items,
        total=len(items),
        mes_referencia=mes_referencia,
    )


@router.patch("/ocorrencias/{ocorrencia_id}/status", response_model=AtividadeOcorrenciaResponse)
async def atualizar_status_ocorrencia(
    ocorrencia_id: str,
    payload: AtividadeOcorrenciaStatusUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    ocorrencia = await _buscar_ocorrencia(db, ocorrencia_id, instituicao_id)
    status_novo = str(payload.status or "").strip().lower()
    if status_novo not in {"aberta", "encerrada", "cancelada"}:
        raise HTTPException(status_code=400, detail="Status de sessão inválido.")
    ocorrencia.status = status_novo
    await db.commit()
    await db.refresh(ocorrencia)
    return await _montar_ocorrencia_response(db, ocorrencia)


@router.get("/ocorrencias/{ocorrencia_id}/chamada", response_model=AtividadeChamadaResponse)
async def obter_chamada_atividade(
    ocorrencia_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    ocorrencia = await _buscar_ocorrencia(db, ocorrencia_id, instituicao_id)
    atividade = await _buscar_atividade(db, ocorrencia.atividade_id, instituicao_id)

    conviventes = await _listar_conviventes_elegiveis(db, instituicao_id)
    conviventes_map = {item.id: item for item in conviventes}

    presencas_db = (
        await db.execute(
            select(AtividadePresencaDB).where(
                AtividadePresencaDB.ocorrencia_id == ocorrencia.id,
                AtividadePresencaDB.cancelado.is_(False),
            )
            .order_by(AtividadePresencaDB.registrado_em.asc())
        )
    ).scalars().all()

    presencas = [
        await _montar_presenca_response(
            db,
            item,
            conviventes_map.get(item.convivente_id),
            usuario_atual["sub"],
        )
        for item in presencas_db
    ]

    conviventes_elegiveis = [
        {
            "id": item.id,
            "nome": _nome_convivente(item),
            "prontuario": _prontuario_convivente(item),
            "status": item.status,
        }
        for item in conviventes
    ]

    return AtividadeChamadaResponse(
        ocorrencia=await _montar_ocorrencia_response(db, ocorrencia),
        atividade=await _montar_atividade_response(db, atividade),
        presencas=presencas,
        conviventes_elegiveis=conviventes_elegiveis,
    )


@router.post("/ocorrencias/{ocorrencia_id}/presencas", response_model=AtividadePresencaResponse)
async def registrar_presenca_atividade(
    ocorrencia_id: str,
    payload: AtividadePresencaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    ocorrencia = await _buscar_ocorrencia(db, ocorrencia_id, instituicao_id)
    atividade = await _buscar_atividade(db, ocorrencia.atividade_id, instituicao_id)

    if ocorrencia.status != "aberta":
        raise HTTPException(status_code=400, detail="Esta sessão não está aberta para presença.")

    metodo = str(payload.metodo_leitura or "").strip()
    if metodo not in METODOS_PRESENCA_ATIVIDADE:
        raise HTTPException(status_code=400, detail="Método de leitura inválido.")

    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == payload.convivente_id,
                ConviventeDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not convivente_elegivel_atividade(convivente):
        raise HTTPException(
            status_code=400,
            detail="Convivente não elegível para presença nesta atividade.",
        )

    existente = await _obter_presenca_ativa(db, ocorrencia.id, convivente.id)
    if existente:
        return await _montar_presenca_response(db, existente, convivente, usuario_atual["sub"])

    if metodo == "Manual":
        await _validar_conflito_presenca_manual(
            db,
            instituicao_id,
            convivente.id,
            ocorrencia.data_sessao,
            atividade.id,
        )

    presenca = AtividadePresencaDB(
        instituicao_id=instituicao_id,
        atividade_id=atividade.id,
        ocorrencia_id=ocorrencia.id,
        convivente_id=convivente.id,
        usuario_id=usuario_atual["sub"],
        metodo_leitura=metodo,
        codigo_lido=(payload.codigo_lido or "").strip() or None,
        registrado_em=agora_sao_paulo(),
        cancelado=False,
    )
    db.add(presenca)
    await db.commit()
    await db.refresh(presenca)
    return await _montar_presenca_response(db, presenca, convivente, usuario_atual["sub"])


@router.patch("/presencas/{presenca_id}/desfazer", response_model=AtividadePresencaResponse)
async def desfazer_presenca_atividade(
    presenca_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    presenca = await _buscar_presenca(db, presenca_id, instituicao_id)

    if presenca.cancelado:
        raise HTTPException(status_code=400, detail="Presença já cancelada.")

    if not pode_desfazer_presenca(presenca, usuario_atual["sub"]):
        raise HTTPException(
            status_code=403,
            detail="Prazo de desfazer expirado ou operador diferente do registro original.",
        )

    presenca.cancelado = True
    presenca.cancelado_por_id = usuario_atual["sub"]
    presenca.cancelado_em = agora_sao_paulo()
    presenca.motivo_cancelamento = "Erro operacional - correção imediata"

    await db.commit()
    await db.refresh(presenca)

    convivente = (
        await db.execute(select(ConviventeDB).where(ConviventeDB.id == presenca.convivente_id))
    ).scalar_one_or_none()
    return await _montar_presenca_response(db, presenca, convivente, usuario_atual["sub"])


@router.patch("/presencas/{presenca_id}/cancelar", response_model=AtividadePresencaResponse)
async def cancelar_presenca_atividade(
    presenca_id: str,
    payload: AtividadePresencaCancelamento,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    presenca = await _buscar_presenca(db, presenca_id, instituicao_id)

    if presenca.cancelado:
        raise HTTPException(status_code=400, detail="Presença já cancelada.")

    motivo = (payload.motivo_cancelamento or "").strip()
    if not motivo:
        raise HTTPException(status_code=400, detail="Informe o motivo do cancelamento.")

    presenca.cancelado = True
    presenca.cancelado_por_id = usuario_atual["sub"]
    presenca.cancelado_em = agora_sao_paulo()
    presenca.motivo_cancelamento = motivo

    await db.commit()
    await db.refresh(presenca)

    convivente = (
        await db.execute(select(ConviventeDB).where(ConviventeDB.id == presenca.convivente_id))
    ).scalar_one_or_none()
    return await _montar_presenca_response(db, presenca, convivente, usuario_atual["sub"])


@router.get("/{atividade_id}/grade", response_model=AtividadeGradeResponse)
async def obter_grade_atividade(
    atividade_id: str,
    mes_referencia: str = Query(...),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    atividade = await _buscar_atividade(db, atividade_id, instituicao_id)

    ocorrencias = (
        await db.execute(
            select(AtividadeOcorrenciaDB)
            .where(
                AtividadeOcorrenciaDB.atividade_id == atividade.id,
                AtividadeOcorrenciaDB.instituicao_id == instituicao_id,
                AtividadeOcorrenciaDB.mes_referencia == mes_referencia,
            )
            .order_by(AtividadeOcorrenciaDB.data_sessao.asc())
        )
    ).scalars().all()

    conviventes = await _listar_conviventes_elegiveis(db, instituicao_id)
    ocorrencia_ids = [item.id for item in ocorrencias]

    presencas_db = []
    if ocorrencia_ids:
        presencas_db = (
            await db.execute(
                select(AtividadePresencaDB).where(
                    AtividadePresencaDB.ocorrencia_id.in_(ocorrencia_ids),
                    AtividadePresencaDB.cancelado.is_(False),
                )
            )
        ).scalars().all()

    presenca_map: dict[tuple[str, str], AtividadePresencaDB] = {}
    for item in presencas_db:
        presenca_map[(item.ocorrencia_id, item.convivente_id)] = item

    linhas: list[AtividadeGradeConviventeLinha] = []
    for convivente in conviventes:
        presencas_por_ocorrencia: dict[str, Optional[AtividadePresencaResponse]] = {}
        for ocorrencia in ocorrencias:
            presenca = presenca_map.get((ocorrencia.id, convivente.id))
            presencas_por_ocorrencia[ocorrencia.id] = (
                await _montar_presenca_response(db, presenca, convivente, usuario_atual["sub"])
                if presenca
                else None
            )
        linhas.append(
            AtividadeGradeConviventeLinha(
                convivente_id=convivente.id,
                nome=_nome_convivente(convivente),
                prontuario=_prontuario_convivente(convivente),
                status=convivente.status,
                presencas_por_ocorrencia=presencas_por_ocorrencia,
            )
        )

    return AtividadeGradeResponse(
        mes_referencia=mes_referencia,
        atividade=await _montar_atividade_response(db, atividade),
        ocorrencias=[await _montar_ocorrencia_response(db, item) for item in ocorrencias],
        linhas=linhas,
    )


@router.get("/ocorrencias/{ocorrencia_id}/conteudo", response_model=AtividadeSessaoConteudoResponse)
async def obter_conteudo_sessao(
    ocorrencia_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    ocorrencia = await _buscar_ocorrencia(db, ocorrencia_id, instituicao_id)
    conteudo = (
        await db.execute(
            select(AtividadeSessaoConteudoDB).where(
                AtividadeSessaoConteudoDB.ocorrencia_id == ocorrencia.id
            )
        )
    ).scalar_one_or_none()
    if not conteudo:
        raise HTTPException(status_code=404, detail="Conteúdo da sessão ainda não registrado.")
    return AtividadeSessaoConteudoResponse(
        id=conteudo.id,
        ocorrencia_id=conteudo.ocorrencia_id,
        atividade_id=conteudo.atividade_id,
        acoes_realizadas=conteudo.acoes_realizadas,
        registrado_por_id=conteudo.registrado_por_id,
        registrado_por_nome=await _nome_usuario(db, conteudo.registrado_por_id),
        criado_em=conteudo.criado_em,
        atualizado_em=conteudo.atualizado_em,
    )


@router.put("/ocorrencias/{ocorrencia_id}/conteudo", response_model=AtividadeSessaoConteudoResponse)
async def salvar_conteudo_sessao(
    ocorrencia_id: str,
    payload: AtividadeSessaoConteudoUpsert,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    ocorrencia = await _buscar_ocorrencia(db, ocorrencia_id, instituicao_id)
    agora = agora_sao_paulo()

    conteudo = (
        await db.execute(
            select(AtividadeSessaoConteudoDB).where(
                AtividadeSessaoConteudoDB.ocorrencia_id == ocorrencia.id
            )
        )
    ).scalar_one_or_none()

    if conteudo:
        conteudo.acoes_realizadas = (payload.acoes_realizadas or "").strip() or None
        conteudo.atualizado_em = agora
    else:
        conteudo = AtividadeSessaoConteudoDB(
            instituicao_id=instituicao_id,
            atividade_id=ocorrencia.atividade_id,
            ocorrencia_id=ocorrencia.id,
            acoes_realizadas=(payload.acoes_realizadas or "").strip() or None,
            registrado_por_id=usuario_atual["sub"],
            criado_em=agora,
            atualizado_em=agora,
        )
        db.add(conteudo)

    await db.commit()
    await db.refresh(conteudo)
    return AtividadeSessaoConteudoResponse(
        id=conteudo.id,
        ocorrencia_id=conteudo.ocorrencia_id,
        atividade_id=conteudo.atividade_id,
        acoes_realizadas=conteudo.acoes_realizadas,
        registrado_por_id=conteudo.registrado_por_id,
        registrado_por_nome=await _nome_usuario(db, conteudo.registrado_por_id),
        criado_em=conteudo.criado_em,
        atualizado_em=conteudo.atualizado_em,
    )
