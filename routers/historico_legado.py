from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import HistoricoLegadoRotinaSIATDB, HistoricoLegadoSIATDB, InstituicaoDB
from schemas import (
    HistoricoLegadoRotinaSIATListResponse,
    HistoricoLegadoRotinaSIATResponse,
    HistoricoLegadoRotinaSIATUpdate,
    HistoricoLegadoSIATListResponse,
    HistoricoLegadoSIATResponse,
    HistoricoLegadoSIATUpdate,
)
from security import get_usuario_logado


router = APIRouter(prefix="/api/historico-legado", tags=["Histórico Legado SIAT"])


def _instituicao_id(usuario_atual: dict) -> str | None:
    return usuario_atual.get("instituicao_id")


async def _historico_legado_ativo(db: AsyncSession, usuario_atual: dict) -> bool:
    inst_id = _instituicao_id(usuario_atual)
    if not inst_id:
        return False

    ativo = (
        await db.execute(
            select(InstituicaoDB.historico_legado_ativo).where(InstituicaoDB.id == inst_id)
        )
    ).scalar_one_or_none()

    return bool(ativo)


async def _exigir_historico_legado_ativo(db: AsyncSession, usuario_atual: dict) -> None:
    if not await _historico_legado_ativo(db, usuario_atual):
        raise HTTPException(
            status_code=403,
            detail="Histórico legado não está habilitado para este projeto."
        )


def _parse_data(valor: str | None, fim_do_dia: bool = False):
    if not valor:
        return None

    try:
        data = datetime.fromisoformat(valor)
        if fim_do_dia and len(valor) == 10:
            data = data.replace(hour=23, minute=59, second=59, microsecond=999999)
        return data.date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use o formato AAAA-MM-DD.")


def _filtro_base(usuario_atual: dict):
    inst_id = _instituicao_id(usuario_atual)
    filtro = HistoricoLegadoSIATDB.instituicao_id == inst_id

    # Registros importados antes de vincular uma instituição ficam visíveis
    # somente enquanto a sessão também não tiver instituição associada.
    if not inst_id:
        filtro = HistoricoLegadoSIATDB.instituicao_id.is_(None)

    return filtro


def _aplicar_filtros(
    query,
    usuario_atual: dict,
    busca: str | None = None,
    ano: int | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    arquivo_origem: str | None = None,
    tipo_sugerido: str | None = None,
    status_revisao: str | None = None,
    operador_origem: str | None = None,
    nome_identificado: str | None = None,
):
    query = query.where(_filtro_base(usuario_atual))

    if busca and busca.strip():
        termo = f"%{busca.strip()}%"
        query = query.where(
            or_(
                HistoricoLegadoSIATDB.texto_original.ilike(termo),
                HistoricoLegadoSIATDB.titulo_original.ilike(termo),
                HistoricoLegadoSIATDB.nome_identificado.ilike(termo),
                HistoricoLegadoSIATDB.operador_origem.ilike(termo),
                HistoricoLegadoSIATDB.arquivo_origem.ilike(termo),
            )
        )

    if ano:
        query = query.where(HistoricoLegadoSIATDB.ano_origem == ano)

    inicio = _parse_data(data_inicio)
    if inicio:
        query = query.where(HistoricoLegadoSIATDB.data_original >= inicio)

    fim = _parse_data(data_fim, fim_do_dia=True)
    if fim:
        query = query.where(HistoricoLegadoSIATDB.data_original <= fim)

    if arquivo_origem:
        query = query.where(HistoricoLegadoSIATDB.arquivo_origem == arquivo_origem)

    if tipo_sugerido:
        query = query.where(HistoricoLegadoSIATDB.tipo_sugerido == tipo_sugerido)

    if status_revisao:
        query = query.where(HistoricoLegadoSIATDB.status_revisao == status_revisao)

    if operador_origem:
        query = query.where(HistoricoLegadoSIATDB.operador_origem == operador_origem)

    if nome_identificado and nome_identificado.strip():
        termo_nome = f"%{nome_identificado.strip()}%"
        query = query.where(
            or_(
                HistoricoLegadoSIATDB.nome_identificado.ilike(termo_nome),
                HistoricoLegadoSIATDB.titulo_original.ilike(termo_nome),
                HistoricoLegadoSIATDB.texto_original.ilike(termo_nome),
            )
        )

    return query


def _aplicar_filtros_rotina(
    query,
    usuario_atual: dict,
    busca: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    servico_prestado: str | None = None,
    status_revisao: str | None = None,
    numero_sisa: str | None = None,
    nome_convivente: str | None = None,
    quarto: str | None = None,
    cama: str | None = None,
    periodo_acolhimento: str | None = None,
    usuario_origem: str | None = None,
    identificacao: str | None = None,
):
    inst_id = _instituicao_id(usuario_atual)
    query = query.where(HistoricoLegadoRotinaSIATDB.instituicao_id == inst_id)

    if busca and busca.strip():
        termo = f"%{busca.strip()}%"
        query = query.where(
            or_(
                HistoricoLegadoRotinaSIATDB.nome_convivente.ilike(termo),
                HistoricoLegadoRotinaSIATDB.numero_sisa.ilike(termo),
                HistoricoLegadoRotinaSIATDB.servico_prestado.ilike(termo),
                HistoricoLegadoRotinaSIATDB.atividade.ilike(termo),
                HistoricoLegadoRotinaSIATDB.quarto.ilike(termo),
                HistoricoLegadoRotinaSIATDB.cama.ilike(termo),
                HistoricoLegadoRotinaSIATDB.usuario_origem.ilike(termo),
                HistoricoLegadoRotinaSIATDB.observacoes.ilike(termo),
            )
        )

    inicio = _parse_data(data_inicio)
    if inicio:
        query = query.where(HistoricoLegadoRotinaSIATDB.data_servico >= inicio)

    fim = _parse_data(data_fim, fim_do_dia=True)
    if fim:
        query = query.where(HistoricoLegadoRotinaSIATDB.data_servico <= fim)

    if servico_prestado:
        query = query.where(HistoricoLegadoRotinaSIATDB.servico_prestado == servico_prestado)

    if status_revisao:
        query = query.where(HistoricoLegadoRotinaSIATDB.status_revisao == status_revisao)

    if numero_sisa and numero_sisa.strip():
        query = query.where(HistoricoLegadoRotinaSIATDB.numero_sisa == numero_sisa.strip())

    if nome_convivente and nome_convivente.strip():
        termo_nome = f"%{nome_convivente.strip()}%"
        query = query.where(HistoricoLegadoRotinaSIATDB.nome_convivente.ilike(termo_nome))

    if quarto:
        query = query.where(HistoricoLegadoRotinaSIATDB.quarto == quarto)

    if cama:
        query = query.where(HistoricoLegadoRotinaSIATDB.cama == cama)

    if periodo_acolhimento:
        query = query.where(HistoricoLegadoRotinaSIATDB.periodo_acolhimento == periodo_acolhimento)

    if usuario_origem:
        query = query.where(HistoricoLegadoRotinaSIATDB.usuario_origem == usuario_origem)

    if identificacao == "identificados":
        query = query.where(HistoricoLegadoRotinaSIATDB.identificado.is_(True))
    elif identificacao == "vinculados":
        query = query.where(HistoricoLegadoRotinaSIATDB.convivente_id.is_not(None))
    elif identificacao == "sem_identificacao":
        query = query.where(HistoricoLegadoRotinaSIATDB.identificado.is_(False))

    return query


async def _opcoes_filtros(db: AsyncSession, usuario_atual: dict):
    filtro = _filtro_base(usuario_atual)

    async def distintos(coluna):
        resultado = await db.execute(
            select(coluna)
            .where(and_(filtro, coluna.is_not(None), coluna != ""))
            .distinct()
            .order_by(coluna.asc())
        )
        return list(resultado.scalars().all())

    return {
        "anos": await distintos(HistoricoLegadoSIATDB.ano_origem),
        "arquivos": await distintos(HistoricoLegadoSIATDB.arquivo_origem),
        "tipos": await distintos(HistoricoLegadoSIATDB.tipo_sugerido),
        "status": await distintos(HistoricoLegadoSIATDB.status_revisao),
        "operadores": await distintos(HistoricoLegadoSIATDB.operador_origem),
    }


async def _opcoes_filtros_rotina(db: AsyncSession, usuario_atual: dict):
    inst_id = _instituicao_id(usuario_atual)
    filtro = HistoricoLegadoRotinaSIATDB.instituicao_id == inst_id

    async def distintos(coluna):
        resultado = await db.execute(
            select(coluna)
            .where(and_(filtro, coluna.is_not(None), coluna != ""))
            .distinct()
            .order_by(coluna.asc())
        )
        return list(resultado.scalars().all())

    return {
        "servicos": await distintos(HistoricoLegadoRotinaSIATDB.servico_prestado),
        "status": await distintos(HistoricoLegadoRotinaSIATDB.status_revisao),
        "quartos": await distintos(HistoricoLegadoRotinaSIATDB.quarto),
        "periodos": await distintos(HistoricoLegadoRotinaSIATDB.periodo_acolhimento),
        "usuarios": await distintos(HistoricoLegadoRotinaSIATDB.usuario_origem),
    }


async def _resumo(db: AsyncSession, usuario_atual: dict):
    filtro = _filtro_base(usuario_atual)

    total = (await db.execute(select(func.count(HistoricoLegadoSIATDB.id)).where(filtro))).scalar_one()
    pendentes = (
        await db.execute(
            select(func.count(HistoricoLegadoSIATDB.id)).where(
                filtro,
                HistoricoLegadoSIATDB.status_revisao == "Pendente",
            )
        )
    ).scalar_one()
    revisados = (
        await db.execute(
            select(func.count(HistoricoLegadoSIATDB.id)).where(
                filtro,
                HistoricoLegadoSIATDB.status_revisao == "Revisado",
            )
        )
    ).scalar_one()

    anos = (
        await db.execute(
            select(func.count(func.distinct(HistoricoLegadoSIATDB.ano_origem))).where(
                filtro,
                HistoricoLegadoSIATDB.ano_origem.is_not(None),
            )
        )
    ).scalar_one()

    return {
        "total": int(total or 0),
        "pendentes": int(pendentes or 0),
        "revisados": int(revisados or 0),
        "anos": int(anos or 0),
    }


async def _resumo_rotina(db: AsyncSession, usuario_atual: dict):
    inst_id = _instituicao_id(usuario_atual)
    filtro = HistoricoLegadoRotinaSIATDB.instituicao_id == inst_id

    total, revisados, pendentes, com_vinculo, sem_identificacao = (
        await db.execute(
            select(
                func.count(HistoricoLegadoRotinaSIATDB.id),
                func.sum(
                    case(
                        (HistoricoLegadoRotinaSIATDB.status_revisao == "Revisado", 1),
                        else_=0,
                    )
                ),
                func.sum(
                    case(
                        (HistoricoLegadoRotinaSIATDB.status_revisao == "Pendente", 1),
                        else_=0,
                    )
                ),
                func.count(HistoricoLegadoRotinaSIATDB.convivente_id),
                func.sum(
                    case(
                        (HistoricoLegadoRotinaSIATDB.identificado.is_(False), 1),
                        else_=0,
                    )
                ),
            ).where(filtro)
        )
    ).one()

    return {
        "total": int(total or 0),
        "pendentes": int(pendentes or 0),
        "revisados": int(revisados or 0),
        "com_vinculo": int(com_vinculo or 0),
        "sem_identificacao": int(sem_identificacao or 0),
    }


@router.get("/config")
async def config_historico_legado(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    ativo = await _historico_legado_ativo(db, usuario_atual)
    total = 0

    if ativo:
        total = (
            await db.execute(
                select(func.count(HistoricoLegadoSIATDB.id)).where(_filtro_base(usuario_atual))
            )
        ).scalar_one()

    return {
        "ativo": ativo,
        "total_registros": int(total or 0),
    }


@router.get("", response_model=HistoricoLegadoSIATListResponse)
async def listar_historico_legado(
    busca: str | None = None,
    ano: int | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    arquivo_origem: str | None = None,
    tipo_sugerido: str | None = None,
    status_revisao: str | None = None,
    operador_origem: str | None = None,
    nome_identificado: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _exigir_historico_legado_ativo(db, usuario_atual)

    query_total = _aplicar_filtros(
        select(func.count(HistoricoLegadoSIATDB.id)),
        usuario_atual,
        busca=busca,
        ano=ano,
        data_inicio=data_inicio,
        data_fim=data_fim,
        arquivo_origem=arquivo_origem,
        tipo_sugerido=tipo_sugerido,
        status_revisao=status_revisao,
        operador_origem=operador_origem,
        nome_identificado=nome_identificado,
    )
    total = (await db.execute(query_total)).scalar_one()

    query = _aplicar_filtros(
        select(HistoricoLegadoSIATDB),
        usuario_atual,
        busca=busca,
        ano=ano,
        data_inicio=data_inicio,
        data_fim=data_fim,
        arquivo_origem=arquivo_origem,
        tipo_sugerido=tipo_sugerido,
        status_revisao=status_revisao,
        operador_origem=operador_origem,
        nome_identificado=nome_identificado,
    )
    query = query.order_by(
        HistoricoLegadoSIATDB.data_original.desc().nullslast(),
        HistoricoLegadoSIATDB.ano_origem.desc().nullslast(),
        HistoricoLegadoSIATDB.pagina_origem.asc().nullslast(),
        HistoricoLegadoSIATDB.sequencia_origem.asc().nullslast(),
    ).offset(offset).limit(limit)

    items = (await db.execute(query)).scalars().all()

    return {
        "items": items,
        "total": int(total or 0),
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < int(total or 0),
        "resumo": await _resumo(db, usuario_atual),
        "opcoes": await _opcoes_filtros(db, usuario_atual),
    }


@router.get("/rotina", response_model=HistoricoLegadoRotinaSIATListResponse)
async def listar_rotina_legada(
    busca: str | None = None,
    data_inicio: str | None = None,
    data_fim: str | None = None,
    servico_prestado: str | None = None,
    status_revisao: str | None = None,
    numero_sisa: str | None = None,
    nome_convivente: str | None = None,
    quarto: str | None = None,
    cama: str | None = None,
    periodo_acolhimento: str | None = None,
    usuario_origem: str | None = None,
    identificacao: str | None = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _exigir_historico_legado_ativo(db, usuario_atual)

    query_total = _aplicar_filtros_rotina(
        select(func.count(HistoricoLegadoRotinaSIATDB.id)),
        usuario_atual,
        busca=busca,
        data_inicio=data_inicio,
        data_fim=data_fim,
        servico_prestado=servico_prestado,
        status_revisao=status_revisao,
        numero_sisa=numero_sisa,
        nome_convivente=nome_convivente,
        quarto=quarto,
        cama=cama,
        periodo_acolhimento=periodo_acolhimento,
        usuario_origem=usuario_origem,
        identificacao=identificacao,
    )
    total = (await db.execute(query_total)).scalar_one()

    query = _aplicar_filtros_rotina(
        select(HistoricoLegadoRotinaSIATDB),
        usuario_atual,
        busca=busca,
        data_inicio=data_inicio,
        data_fim=data_fim,
        servico_prestado=servico_prestado,
        status_revisao=status_revisao,
        numero_sisa=numero_sisa,
        nome_convivente=nome_convivente,
        quarto=quarto,
        cama=cama,
        periodo_acolhimento=periodo_acolhimento,
        usuario_origem=usuario_origem,
        identificacao=identificacao,
    )
    query = query.order_by(
        HistoricoLegadoRotinaSIATDB.data_servico.desc(),
        HistoricoLegadoRotinaSIATDB.nome_convivente.asc().nullslast(),
        HistoricoLegadoRotinaSIATDB.servico_prestado.asc().nullslast(),
    ).offset(offset).limit(limit)

    items = (await db.execute(query)).scalars().all()

    return {
        "items": items,
        "total": int(total or 0),
        "limit": limit,
        "offset": offset,
        "has_more": offset + limit < int(total or 0),
        "resumo": {"total": int(total or 0)},
        "opcoes": {},
    }


@router.get("/rotina/meta")
async def meta_rotina_legada(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _exigir_historico_legado_ativo(db, usuario_atual)

    return {
        "resumo": await _resumo_rotina(db, usuario_atual),
        "opcoes": await _opcoes_filtros_rotina(db, usuario_atual),
    }


@router.patch("/rotina/{registro_id}", response_model=HistoricoLegadoRotinaSIATResponse)
async def atualizar_rotina_legada(
    registro_id: str,
    payload: HistoricoLegadoRotinaSIATUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _exigir_historico_legado_ativo(db, usuario_atual)

    registro = (
        await db.execute(
            select(HistoricoLegadoRotinaSIATDB).where(
                HistoricoLegadoRotinaSIATDB.id == registro_id,
                HistoricoLegadoRotinaSIATDB.instituicao_id == _instituicao_id(usuario_atual),
            )
        )
    ).scalar_one_or_none()

    if not registro:
        raise HTTPException(status_code=404, detail="Registro de rotina legada não encontrado.")

    if payload.status_revisao is not None:
        registro.status_revisao = payload.status_revisao.strip() or "Pendente"

    if payload.observacoes is not None:
        registro.observacoes = payload.observacoes.strip() or None

    await db.commit()
    await db.refresh(registro)

    return registro


@router.patch("/{registro_id}", response_model=HistoricoLegadoSIATResponse)
async def atualizar_historico_legado(
    registro_id: str,
    payload: HistoricoLegadoSIATUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    await _exigir_historico_legado_ativo(db, usuario_atual)

    registro = (
        await db.execute(
            select(HistoricoLegadoSIATDB).where(
                HistoricoLegadoSIATDB.id == registro_id,
                _filtro_base(usuario_atual),
            )
        )
    ).scalar_one_or_none()

    if not registro:
        raise HTTPException(status_code=404, detail="Registro legado não encontrado.")

    if payload.status_revisao is not None:
        registro.status_revisao = payload.status_revisao.strip() or "Pendente"

    if payload.tipo_sugerido is not None:
        registro.tipo_sugerido = payload.tipo_sugerido.strip() or "Não classificado"

    if payload.observacoes_revisao is not None:
        registro.observacoes_revisao = payload.observacoes_revisao.strip() or None

    await db.commit()
    await db.refresh(registro)

    return registro
