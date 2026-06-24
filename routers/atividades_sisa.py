from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from atividades_sisa_catalogo import TIPOS_CATALOGO_SISA
from atividades_sisa_conferencia import montar_comparativo_sisa_carecore
from atividades_sisa_parser import (
    ler_relatorio_resumo_atividades_sisa,
    normalizar_horario_sisa,
    normalizar_texto_sisa,
)
from atividades_sisa_service import (
    montar_catalogo_sisa_response,
    registrar_catalogo_sisa_se_necessario,
)
from database import get_db
from models import (
    AtividadeDB,
    AtividadeOcorrenciaDB,
    AtividadePresencaDB,
    AtividadeSisaConferenciaHistoricoDB,
    AtividadeSisaVinculoDB,
    UsuarioDB,
)
from routers.atividades import exigir_edicao_atividades, exigir_leitura_atividades
from routers.conviventes_helpers import agora_sao_paulo
from schemas import (
    AtividadeCatalogoSisaCreate,
    AtividadeCatalogoSisaResponse,
    AtividadeSisaConferenciaHistoricoDetalheResponse,
    AtividadeSisaConferenciaHistoricoListaResponse,
    AtividadeSisaConferenciaHistoricoResumo,
    AtividadeSisaConferenciaLinha,
    AtividadeSisaConferenciaResumo,
    AtividadeSisaConferenciaResponse,
    AtividadeSisaSomenteCarecoreLinha,
    AtividadeSisaVinculoPayload,
)
from tenant_scope import obter_instituicao_escopo


router = APIRouter(prefix="/api/atividades/sisa", tags=["Atividades SISA"])


def _parse_vinculos_json(valor: str | None) -> dict[str, str]:
    if not valor:
        return {}
    try:
        dados = json.loads(valor)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="JSON de vínculos inválido.") from exc
    if not isinstance(dados, list):
        raise HTTPException(status_code=400, detail="Vínculos devem ser enviados como lista JSON.")

    resultado: dict[str, str] = {}
    for item in dados:
        if not isinstance(item, dict):
            continue
        chave = str(item.get("chave") or "").strip()
        atividade_id = str(item.get("atividade_id") or "").strip()
        if chave and atividade_id:
            resultado[chave] = atividade_id
    return resultado


async def _carregar_contexto_conferencia(
    db: AsyncSession,
    instituicao_id: str,
    data_inicio,
    data_fim,
) -> tuple[dict[str, dict], dict[str, int]]:
    atividades = (
        await db.execute(
            select(AtividadeDB).where(AtividadeDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()

    atividade_ids = [item.id for item in atividades]
    ocorrencias = []
    if atividade_ids:
        ocorrencias = (
            await db.execute(
                select(AtividadeOcorrenciaDB).where(
                    AtividadeOcorrenciaDB.instituicao_id == instituicao_id,
                    AtividadeOcorrenciaDB.atividade_id.in_(atividade_ids),
                    AtividadeOcorrenciaDB.data_sessao >= data_inicio,
                    AtividadeOcorrenciaDB.data_sessao <= data_fim,
                )
            )
        ).scalars().all()

    ocorrencia_ids = [item.id for item in ocorrencias]
    presencas_por_ocorrencia: dict[str, int] = {}
    if ocorrencia_ids:
        contagens = (
            await db.execute(
                select(
                    AtividadePresencaDB.ocorrencia_id,
                    func.count(AtividadePresencaDB.id),
                )
                .where(
                    AtividadePresencaDB.ocorrencia_id.in_(ocorrencia_ids),
                    AtividadePresencaDB.cancelado.is_(False),
                )
                .group_by(AtividadePresencaDB.ocorrencia_id)
            )
        ).all()
        presencas_por_ocorrencia = {ocorrencia_id: int(total) for ocorrencia_id, total in contagens}

    ocorrencias_por_atividade: dict[str, list[dict]] = {}
    for ocorrencia in ocorrencias:
        ocorrencias_por_atividade.setdefault(ocorrencia.atividade_id, []).append(
            {
                "id": ocorrencia.id,
                "data_sessao": ocorrencia.data_sessao,
                "horario_sessao": ocorrencia.horario_sessao or "",
            }
        )

    atividades_por_id: dict[str, dict] = {}
    for atividade in atividades:
        atividades_por_id[atividade.id] = {
            "id": atividade.id,
            "nome": atividade.nome,
            "sisa_descricao_atividade": atividade.sisa_descricao_atividade,
            "sisa_descricao_tema": atividade.sisa_descricao_tema,
            "sisa_horario_padrao": atividade.sisa_horario_padrao,
            "ocorrencias": ocorrencias_por_atividade.get(atividade.id, []),
        }

    return atividades_por_id, presencas_por_ocorrencia


async def _salvar_vinculos(
    db: AsyncSession,
    *,
    instituicao_id: str,
    usuario_id: str,
    linhas_sisa: list[dict],
    vinculos_por_chave: dict[str, str],
) -> None:
    agora = agora_sao_paulo()
    linhas_por_chave = {linha["chave"]: linha for linha in linhas_sisa}
    for chave, atividade_id in vinculos_por_chave.items():
        linha = linhas_por_chave.get(chave)
        if not linha:
            continue
        existente = (
            await db.execute(
                select(AtividadeSisaVinculoDB).where(
                    AtividadeSisaVinculoDB.instituicao_id == instituicao_id,
                    AtividadeSisaVinculoDB.sisa_descricao_atividade_norm == linha["descricao_atividade_norm"],
                    AtividadeSisaVinculoDB.sisa_descricao_tema_norm == linha["descricao_tema_norm"],
                    AtividadeSisaVinculoDB.sisa_horario_norm == linha["horario_norm"],
                )
            )
        ).scalar_one_or_none()
        if existente:
            existente.atividade_id = atividade_id
            existente.sisa_descricao_atividade = linha["descricao_atividade"]
            existente.sisa_descricao_tema = linha["descricao_tema"]
            existente.sisa_horario = linha["horario"]
            existente.atualizado_em = agora
        else:
            db.add(
                AtividadeSisaVinculoDB(
                    instituicao_id=instituicao_id,
                    sisa_descricao_atividade=linha["descricao_atividade"],
                    sisa_descricao_tema=linha["descricao_tema"],
                    sisa_horario=linha["horario"],
                    sisa_descricao_atividade_norm=linha["descricao_atividade_norm"],
                    sisa_descricao_tema_norm=linha["descricao_tema_norm"],
                    sisa_horario_norm=linha["horario_norm"],
                    atividade_id=atividade_id,
                    criado_por_id=usuario_id,
                    criado_em=agora,
                    atualizado_em=agora,
                )
            )


def _montar_response_conferencia(
    *,
    nome_arquivo: str,
    dados: dict,
    comparativo: dict,
    historico_id: str | None = None,
) -> AtividadeSisaConferenciaResponse:
    return AtividadeSisaConferenciaResponse(
        nome_arquivo=nome_arquivo,
        data_inicio_referencia=dados["data_inicio_referencia"],
        data_fim_referencia=dados["data_fim_referencia"],
        servico=dados.get("servico"),
        projeto=dados.get("projeto"),
        totais_sisa=dados.get("totais_sisa") or {},
        resumo=AtividadeSisaConferenciaResumo(**comparativo["resumo"]),
        linhas=[AtividadeSisaConferenciaLinha(**item) for item in comparativo["linhas"]],
        somente_carecore=[
            AtividadeSisaSomenteCarecoreLinha(**item) for item in comparativo["somente_carecore"]
        ],
        historico_id=historico_id,
    )


def _vinculos_para_json(vinculos_por_chave: dict[str, str]) -> str:
    payload = [
        {"chave": chave, "atividade_id": atividade_id}
        for chave, atividade_id in vinculos_por_chave.items()
        if chave and atividade_id
    ]
    return json.dumps(payload, ensure_ascii=False)


def _vinculos_de_json(valor: str | None) -> list[AtividadeSisaVinculoPayload]:
    if not valor:
        return []
    try:
        dados = json.loads(valor)
    except json.JSONDecodeError:
        return []
    if not isinstance(dados, list):
        return []
    resultado: list[AtividadeSisaVinculoPayload] = []
    for item in dados:
        if not isinstance(item, dict):
            continue
        chave = str(item.get("chave") or "").strip()
        atividade_id = str(item.get("atividade_id") or "").strip()
        if chave and atividade_id:
            resultado.append(AtividadeSisaVinculoPayload(chave=chave, atividade_id=atividade_id))
    return resultado


async def _salvar_historico_conferencia(
    db: AsyncSession,
    *,
    instituicao_id: str,
    usuario_id: str,
    nome_arquivo: str,
    dados: dict,
    comparativo: dict,
    response: AtividadeSisaConferenciaResponse,
    vinculos_por_chave: dict[str, str],
) -> AtividadeSisaConferenciaHistoricoDB:
    agora = agora_sao_paulo()
    resumo = comparativo["resumo"]
    historico = AtividadeSisaConferenciaHistoricoDB(
        instituicao_id=instituicao_id,
        usuario_id=usuario_id,
        nome_arquivo=nome_arquivo,
        data_inicio_referencia=dados["data_inicio_referencia"],
        data_fim_referencia=dados["data_fim_referencia"],
        servico=dados.get("servico"),
        projeto=dados.get("projeto"),
        conferidas=int(resumo.get("conferidas") or 0),
        divergencias_quantidade=int(resumo.get("divergencias_quantidade") or 0),
        sem_vinculo=int(resumo.get("sem_vinculo") or 0),
        sem_ocorrencia_carecore=int(resumo.get("sem_ocorrencia_carecore") or 0),
        somente_carecore=int(resumo.get("somente_carecore") or 0),
        total_linhas_sisa=len(comparativo.get("linhas") or []),
        resultado_json=json.dumps(response.model_dump(mode="json"), ensure_ascii=False),
        vinculos_json=_vinculos_para_json(vinculos_por_chave),
        importado_em=agora,
    )
    db.add(historico)
    await db.flush()
    return historico


def _montar_resumo_historico(item: AtividadeSisaConferenciaHistoricoDB, usuario_nome: str | None) -> AtividadeSisaConferenciaHistoricoResumo:
    return AtividadeSisaConferenciaHistoricoResumo(
        id=item.id,
        nome_arquivo=item.nome_arquivo,
        data_inicio_referencia=item.data_inicio_referencia,
        data_fim_referencia=item.data_fim_referencia,
        servico=item.servico,
        importado_em=item.importado_em,
        usuario_nome=usuario_nome,
        resumo=AtividadeSisaConferenciaResumo(
            conferidas=item.conferidas or 0,
            divergencias_quantidade=item.divergencias_quantidade or 0,
            sem_vinculo=item.sem_vinculo or 0,
            sem_ocorrencia_carecore=item.sem_ocorrencia_carecore or 0,
            somente_sisa=0,
            somente_carecore=item.somente_carecore or 0,
        ),
    )


@router.get("/conferencias/historico", response_model=AtividadeSisaConferenciaHistoricoListaResponse)
async def listar_historico_conferencias_sisa(
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    base = select(AtividadeSisaConferenciaHistoricoDB).where(
        AtividadeSisaConferenciaHistoricoDB.instituicao_id == instituicao_id
    )
    total = int((await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one() or 0)
    registros = (
        await db.execute(
            base.order_by(
                AtividadeSisaConferenciaHistoricoDB.importado_em.desc(),
                AtividadeSisaConferenciaHistoricoDB.data_fim_referencia.desc(),
            )
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()

    usuario_ids = {item.usuario_id for item in registros}
    nomes_usuarios: dict[str, str] = {}
    if usuario_ids:
        usuarios = (
            await db.execute(select(UsuarioDB).where(UsuarioDB.id.in_(usuario_ids)))
        ).scalars().all()
        nomes_usuarios = {usuario.id: usuario.nome for usuario in usuarios}

    items = [
        _montar_resumo_historico(item, nomes_usuarios.get(item.usuario_id))
        for item in registros
    ]
    return AtividadeSisaConferenciaHistoricoListaResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
        has_more=offset + len(items) < total,
    )


@router.get("/conferencias/historico/{historico_id}", response_model=AtividadeSisaConferenciaHistoricoDetalheResponse)
async def obter_historico_conferencia_sisa(
    historico_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    historico = (
        await db.execute(
            select(AtividadeSisaConferenciaHistoricoDB).where(
                AtividadeSisaConferenciaHistoricoDB.id == historico_id,
                AtividadeSisaConferenciaHistoricoDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not historico:
        raise HTTPException(status_code=404, detail="Histórico de conferência não encontrado.")

    usuario_nome = None
    if historico.usuario_id:
        usuario = (
            await db.execute(select(UsuarioDB).where(UsuarioDB.id == historico.usuario_id))
        ).scalar_one_or_none()
        usuario_nome = usuario.nome if usuario else None

    try:
        resultado_dict = json.loads(historico.resultado_json or "{}")
        resultado = AtividadeSisaConferenciaResponse(**resultado_dict)
        resultado.historico_id = historico.id
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=500, detail="Histórico salvo está corrompido.") from exc

    return AtividadeSisaConferenciaHistoricoDetalheResponse(
        id=historico.id,
        nome_arquivo=historico.nome_arquivo,
        data_inicio_referencia=historico.data_inicio_referencia,
        data_fim_referencia=historico.data_fim_referencia,
        servico=historico.servico,
        projeto=historico.projeto,
        importado_em=historico.importado_em,
        usuario_nome=usuario_nome,
        vinculos=_vinculos_de_json(historico.vinculos_json),
        resultado=resultado,
    )


@router.delete("/conferencias/historico/{historico_id}")
async def excluir_historico_conferencia_sisa(
    historico_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    historico = (
        await db.execute(
            select(AtividadeSisaConferenciaHistoricoDB).where(
                AtividadeSisaConferenciaHistoricoDB.id == historico_id,
                AtividadeSisaConferenciaHistoricoDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not historico:
        raise HTTPException(status_code=404, detail="Histórico de conferência não encontrado.")

    await db.delete(historico)
    await db.commit()
    return {"ok": True, "id": historico_id}


@router.get("/catalogo", response_model=AtividadeCatalogoSisaResponse)
async def obter_catalogo_sisa(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    return await montar_catalogo_sisa_response(db, instituicao_id)


@router.post("/catalogo", response_model=AtividadeCatalogoSisaResponse)
async def adicionar_catalogo_sisa(
    payload: AtividadeCatalogoSisaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_edicao_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    tipo = str(payload.tipo or "").strip().lower()
    if tipo not in TIPOS_CATALOGO_SISA:
        raise HTTPException(status_code=400, detail="Tipo de catálogo SISA inválido.")
    if not str(payload.valor or "").strip():
        raise HTTPException(status_code=400, detail="Informe o valor do catálogo SISA.")

    await registrar_catalogo_sisa_se_necessario(
        db,
        instituicao_id=instituicao_id,
        usuario_id=usuario_atual["sub"],
        tipo=tipo,
        valor=payload.valor,
        somente_personalizado=False,
    )
    await db.commit()
    return await montar_catalogo_sisa_response(db, instituicao_id)


@router.post("/conferencia", response_model=AtividadeSisaConferenciaResponse)
async def conferir_atividades_sisa(
    arquivo: UploadFile = File(...),
    vinculos_json: Optional[str] = Form(None),
    salvar_vinculos: bool = Form(True),
    salvar_historico: bool = Form(True),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_leitura_atividades),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    conteudo = await arquivo.read()
    dados = ler_relatorio_resumo_atividades_sisa(conteudo, arquivo.filename or "")
    linhas_sisa = dados["linhas"]

    for linha in linhas_sisa:
        await registrar_catalogo_sisa_se_necessario(
            db,
            instituicao_id=instituicao_id,
            usuario_id=usuario_atual["sub"],
            tipo="descricao_atividade",
            valor=linha["descricao_atividade"],
            somente_personalizado=False,
        )
        await registrar_catalogo_sisa_se_necessario(
            db,
            instituicao_id=instituicao_id,
            usuario_id=usuario_atual["sub"],
            tipo="descricao_tema",
            valor=linha["descricao_tema"],
            somente_personalizado=False,
        )

    vinculos_por_chave = _parse_vinculos_json(vinculos_json)
    atividades_por_id, presencas_por_ocorrencia = await _carregar_contexto_conferencia(
        db,
        instituicao_id,
        dados["data_inicio_referencia"],
        dados["data_fim_referencia"],
    )

    vinculos_salvos = (
        await db.execute(
            select(AtividadeSisaVinculoDB).where(
                AtividadeSisaVinculoDB.instituicao_id == instituicao_id
            )
        )
    ).scalars().all()
    atividades_db = (
        await db.execute(
            select(AtividadeDB).where(AtividadeDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()

    mapa_vinculo = {
        (
            item.sisa_descricao_atividade_norm,
            item.sisa_descricao_tema_norm,
            item.sisa_horario_norm,
        ): item.atividade_id
        for item in vinculos_salvos
    }
    mapa_atividade = {
        (
            normalizar_texto_sisa(item.sisa_descricao_atividade),
            normalizar_texto_sisa(item.sisa_descricao_tema),
            normalizar_horario_sisa(item.sisa_horario_padrao),
        ): item.id
        for item in atividades_db
        if item.sisa_descricao_atividade or item.sisa_descricao_tema
    }

    sugestoes_por_chave: dict[str, str | None] = {}
    for linha in linhas_sisa:
        chave_comp = (
            linha["descricao_atividade_norm"],
            linha["descricao_tema_norm"],
            linha["horario_norm"],
        )
        sugestoes_por_chave[linha["chave"]] = mapa_vinculo.get(chave_comp) or mapa_atividade.get(chave_comp)

    for chave, atividade_id in list(vinculos_por_chave.items()):
        if atividade_id not in atividades_por_id:
            del vinculos_por_chave[chave]

    comparativo = montar_comparativo_sisa_carecore(
        linhas_sisa=linhas_sisa,
        vinculos_por_chave=vinculos_por_chave,
        atividades_por_id=atividades_por_id,
        ocorrencias_por_id={},
        presencas_por_ocorrencia=presencas_por_ocorrencia,
        sugestoes_vinculo=sugestoes_por_chave,
    )

    if salvar_vinculos and vinculos_por_chave:
        await _salvar_vinculos(
            db,
            instituicao_id=instituicao_id,
            usuario_id=usuario_atual["sub"],
            linhas_sisa=linhas_sisa,
            vinculos_por_chave=vinculos_por_chave,
        )

    nome_arquivo = arquivo.filename or "planilha_sisa.xls"
    response = _montar_response_conferencia(
        nome_arquivo=nome_arquivo,
        dados=dados,
        comparativo=comparativo,
    )

    historico_id = None
    if salvar_historico:
        historico = await _salvar_historico_conferencia(
            db,
            instituicao_id=instituicao_id,
            usuario_id=usuario_atual["sub"],
            nome_arquivo=nome_arquivo,
            dados=dados,
            comparativo=comparativo,
            response=response,
            vinculos_por_chave=vinculos_por_chave,
        )
        historico_id = historico.id
        response.historico_id = historico_id

    await db.commit()

    return response
