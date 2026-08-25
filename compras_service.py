"""Servico do modulo Compras (janela, pedidos, cotacoes, recebimento, patrimonio)."""

from __future__ import annotations

import re
from datetime import date, datetime
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from compras_categoria_utils import (
    mensagem_nome_semelhante,
    nome_cadastro_exato,
    nomes_cadastro_semelhantes,
    resolver_nome_cadastro,
)
from compras_itens_consumo_utils import chave_item_consumo, embalagem_efetiva_pedido, limpar_item_consumo, sanitizar_unidade_medida
from compras_fornecedor_projetos_utils import montar_rotulo_projetos
from compras_telefone_utils import formatar_telefone_compras, sanitizar_telefone_compras
from compras_patrimonio_utils import (
    normalizar_origem,
    normalizar_propriedade,
    normalizar_situacao,
    parse_data_aquisicao,
    reais_para_centavos,
)
from compras_regras import (
    CATEGORIAS_PADRAO,
    ESCOPO_PROJETO,
    ESCOPO_SEDE,
    FONTES_PADRAO,
    PATRIMONIO_ORIGEM_COMPRA,
    PATRIMONIO_SITUACAO_BOM,
    SEGMENTO_CONSUMO,
    STATUS_AGUARDANDO_COTACAO,
    STATUS_AGUARDANDO_SEDE,
    STATUS_AGUARDANDO_UNIDADE,
    STATUS_APROVADO,
    STATUS_CANCELADO,
    STATUS_EM_COTACAO,
    STATUS_ENVIADO,
    STATUS_RASCUNHO,
    STATUS_RECEBIDO,
    STATUS_REPROVADO,
    STATUS_TERMINAIS_PEDIDO,
    TIPO_CONSUMO,
    TIPO_EVENTO_ITENS,
    TIPO_EVENTO_STATUS,
    TIPO_IMOBILIZADO,
    TIPO_MANUTENCAO,
    TIPO_SERVICO,
    TIPOS_PEDIDO,
    TIPOS_MANUTENCAO,
    URGENCIAS_PEDIDO,
    URGENCIA_NORMAL,
    chave_split_categoria_pedido,
    competencia_de_data,
    data_operacional,
    dias_liberados_janela,
    economia_centavos,
    exige_tres_cotacoes,
    formatar_grupo_codigo,
    competencia_padrao_do_segmento,
    inferir_fator_embalagem,
    inferir_perecivel,
    inferir_segmento_por_nome_categoria,
    inferir_tipo_fonte,
    janela_consumo_aberta,
    normalizar_competencia,
    normalizar_competencia_orcamento,
    normalizar_escopo_unidade,
    normalizar_segmento_catalogo,
    normalizar_tipo_fonte,
    pedido_escopo_sede,
    pedido_itens_podem_editar,
    pedido_pronto_para_aprovacao_unidade,
    pedido_rascunho_pode_excluir,
    periodo_semana_util_mes,
    pode_criar_rascunho_consumo,
    pode_enviar_consumo,
    resumo_alteracao_itens_pedido,
    rotulo_tipo_pedido,
    rotulo_unidade_relatorio,
    sequencia_grupo_codigo,
    status_janela,
    sugerir_janela_competencia,
    tipo_eh_cotacao_projeto,
    unidade_medida_para_pedido,
    usuario_e_sede_compras,
    usuario_pode_aprovar_sede,
    usuario_pode_aprovar_unidade,
    usuario_pode_cadastrar_mestre_compras,
    usuario_pode_pedir,
    usuario_ve_modulo_compras,
    validar_periodo_janela,
)
from compras_pedido_fluxo import (
    desativar_cotacao,
    encerrar_pedido,
    enviar_email_fornecedor,
    extras_serializacao_pedido,
    gerar_pedido_compra,
    ler_bytes_anexo,
    registrar_comunicacao_pedido,
    registrar_evento_pedido,
    registrar_nota_fiscal,
    reabrir_pedido,
    reprovar_pedido,
    upload_anexo_pedido,
)
from models import (
    ComprasCategoriaDB,
    ComprasCotacaoDB,
    ComprasItemConsumoDB,
    ComprasFonteRecursoDB,
    ComprasFornecedorDB,
    ComprasFornecedorCategoriaDB,
    ComprasFornecedorProjetoDB,
    ComprasJanelaDB,
    ComprasJanelaLiberacaoDB,
    ComprasPatrimonioDB,
    ComprasPedidoDB,
    ComprasPedidoAnexoDB,
    ComprasPedidoEventoDB,
    ComprasPedidoItemDB,
    ComprasPedidoNotaFiscalDB,
    InstituicaoDB,
    OrganizacaoDB,
    get_uuid,
)
from time_operacional import agora_operacional_naive


def _perfil(usuario: dict) -> str:
    return (usuario.get("perfil_acesso") or "").strip()


def _org_id(usuario: dict) -> str:
    org = usuario.get("organizacao_id")
    if not org:
        raise HTTPException(status_code=400, detail="Usuário sem organização vinculada.")
    return org


def _uid(usuario: dict) -> str:
    return usuario.get("id") or usuario.get("sub") or usuario.get("usuario_id") or ""


async def org_compras_ativo(db: AsyncSession, organizacao_id: str) -> bool:
    org = (
        await db.execute(select(OrganizacaoDB).where(OrganizacaoDB.id == organizacao_id))
    ).scalar_one_or_none()
    if not org:
        return False
    return bool(getattr(org, "compras_ativo", False))


async def exigir_modulo(db: AsyncSession, usuario: dict, *, operacao: bool = True) -> None:
    org_id = usuario.get("organizacao_id")
    if not org_id and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=400, detail="Usuário sem organização vinculada.")
    ativo = await org_compras_ativo(db, org_id) if org_id else False
    if not usuario_ve_modulo_compras(
        perfil=_perfil(usuario),
        compras_modulo_ativo=bool(usuario.get("compras_modulo_ativo")),
        is_manutencao=bool(usuario.get("is_manutencao")),
        org_compras_ativo=ativo,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sem permissão para o módulo Compras.",
        )
    if operacao and not ativo and not usuario.get("is_manutencao"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Módulo Compras ainda não foi ativado nesta organização. Use Ativar módulo Compras.",
        )


def _sede(usuario: dict) -> bool:
    return usuario_e_sede_compras(
        perfil=_perfil(usuario),
        is_manutencao=bool(usuario.get("is_manutencao")),
    )


def _aplicar_cabecalho_cotacao_projeto(
    pedido: ComprasPedidoDB,
    payload: dict,
    *,
    obrigatorio: bool = False,
) -> None:
    """Aplica campos de bem/manutenção/serviço. Consumo ignora (não grava)."""
    if not tipo_eh_cotacao_projeto(pedido.tipo):
        return

    if "titulo" in payload:
        pedido.titulo = (payload.get("titulo") or "").strip() or None
    if "justificativa" in payload:
        pedido.justificativa = (payload.get("justificativa") or "").strip() or None
    if "urgencia" in payload:
        urg = (payload.get("urgencia") or URGENCIA_NORMAL).strip().lower()
        if urg not in URGENCIAS_PEDIDO:
            raise HTTPException(status_code=400, detail="Urgência inválida.")
        pedido.urgencia = urg
    if "data_desejada" in payload:
        raw = payload.get("data_desejada")
        if raw:
            try:
                pedido.data_desejada = date.fromisoformat(str(raw)[:10])
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Data desejada inválida.") from exc
        else:
            pedido.data_desejada = None
    if "local_texto" in payload:
        pedido.local_texto = (payload.get("local_texto") or "").strip() or None
    if "patrimonio_id" in payload:
        pedido.patrimonio_id = (payload.get("patrimonio_id") or "").strip() or None
    if "defeito" in payload:
        pedido.defeito = (payload.get("defeito") or "").strip() or None
    if "tipo_manutencao" in payload:
        tm = (payload.get("tipo_manutencao") or "").strip().lower() or None
        if tm and tm not in TIPOS_MANUTENCAO:
            raise HTTPException(status_code=400, detail="Tipo de manutenção inválido.")
        pedido.tipo_manutencao = tm
    if "escopo_servico" in payload:
        pedido.escopo_servico = (payload.get("escopo_servico") or "").strip() or None
    if "valor_estimado_centavos" in payload:
        ve = payload.get("valor_estimado_centavos")
        pedido.valor_estimado_centavos = int(ve) if ve is not None and str(ve).strip() != "" else None
    elif "valor_estimado_reais" in payload and payload.get("valor_estimado_reais") is not None:
        pedido.valor_estimado_centavos = int(round(float(payload["valor_estimado_reais"]) * 100))
    if "fonte_recurso_id" in payload:
        pedido.fonte_recurso_id = payload.get("fonte_recurso_id") or None
    if "observacao" in payload:
        pedido.observacao = (payload.get("observacao") or "").strip() or None

    if obrigatorio:
        if not (pedido.titulo or "").strip():
            raise HTTPException(status_code=400, detail="Informe o título / objeto do pedido.")
        if not (pedido.justificativa or "").strip():
            raise HTTPException(status_code=400, detail="Informe a justificativa.")
        if not pedido.data_desejada:
            raise HTTPException(status_code=400, detail="Informe a data desejada.")
        if pedido.tipo == TIPO_MANUTENCAO and not (pedido.defeito or "").strip():
            raise HTTPException(status_code=400, detail="Descreva o defeito ou sintoma.")
        if pedido.tipo == TIPO_SERVICO and not (pedido.escopo_servico or "").strip():
            raise HTTPException(status_code=400, detail="Descreva o escopo do serviço.")


def exigir_sede(usuario: dict) -> None:
    if not _sede(usuario):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ação restrita à Sede (ADM Compras).",
        )


def exigir_cadastro_mestre_compras(usuario: dict) -> None:
    if usuario_pode_cadastrar_mestre_compras(
        perfil=_perfil(usuario),
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Cadastro de categorias/itens/fornecedores restrito à Sede ou ADM Pedidos.",
    )


async def garantir_cadastros_padrao(db: AsyncSession, organizacao_id: str) -> None:
    existentes_cat = {
        (row[0] or "").strip().lower()
        for row in (
            await db.execute(
                select(ComprasCategoriaDB.nome).where(
                    ComprasCategoriaDB.organizacao_id == organizacao_id
                )
            )
        ).all()
    }
    for nome in CATEGORIAS_PADRAO:
        if nome.lower() not in existentes_cat:
            db.add(ComprasCategoriaDB(
                organizacao_id=organizacao_id,
                nome=nome,
                segmento=inferir_segmento_por_nome_categoria(nome),
                ativo=True,
            ))
            existentes_cat.add(nome.lower())

    existentes_fonte = {
        (row[0] or "").strip().lower()
        for row in (
            await db.execute(
                select(ComprasFonteRecursoDB.nome).where(
                    ComprasFonteRecursoDB.organizacao_id == organizacao_id
                )
            )
        ).all()
    }
    for nome in FONTES_PADRAO:
        if nome.lower() not in existentes_fonte:
            db.add(ComprasFonteRecursoDB(
                organizacao_id=organizacao_id,
                nome=nome,
                tipo=inferir_tipo_fonte(nome),
                ativo=True,
            ))
            existentes_fonte.add(nome.lower())


def _iso(valor: Optional[datetime | date]) -> Optional[str]:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.isoformat(sep=" ", timespec="seconds")
    return valor.isoformat()


async def _nomes_instituicao(db: AsyncSession, ids: list[str]) -> dict[str, str]:
    limpos = [item for item in ids if item]
    if not limpos:
        return {}
    rows = (
        await db.execute(
            select(InstituicaoDB.id, InstituicaoDB.nome_fantasia).where(InstituicaoDB.id.in_(limpos))
        )
    ).all()
    return {row[0]: row[1] for row in rows}


async def _nome_organizacao(db: AsyncSession, organizacao_id: str) -> Optional[str]:
    row = (
        await db.execute(
            select(OrganizacaoDB.nome).where(OrganizacaoDB.id == organizacao_id)
        )
    ).scalar_one_or_none()
    return row


def _pedido_escopo_sede(pedido: ComprasPedidoDB) -> bool:
    return pedido_escopo_sede(getattr(pedido, "escopo_unidade", ESCOPO_PROJETO))


async def _rotulo_unidade_pedido(db: AsyncSession, pedido: ComprasPedidoDB) -> str:
    inst_nome = None
    if pedido.instituicao_id:
        nomes = await _nomes_instituicao(db, [pedido.instituicao_id])
        inst_nome = nomes.get(pedido.instituicao_id)
    org_nome = await _nome_organizacao(db, pedido.organizacao_id)
    return rotulo_unidade_relatorio(
        escopo_unidade=getattr(pedido, "escopo_unidade", ESCOPO_PROJETO),
        instituicao_nome=inst_nome,
        organizacao_nome=org_nome,
    )


async def serializar_pedido(
    db: AsyncSession,
    pedido: ComprasPedidoDB,
    *,
    incluir_detalhe: bool = False,
    usuario: Optional[dict] = None,
) -> dict:
    instituicao_nome = await _rotulo_unidade_pedido(db, pedido)
    email_adm_compras = None
    if pedido.instituicao_id:
        email_adm_compras = (
            await db.execute(
                select(InstituicaoDB.email_adm_compras).where(
                    InstituicaoDB.id == pedido.instituicao_id
                )
            )
        ).scalar_one_or_none()
        email_adm_compras = (email_adm_compras or "").strip() or None
    payload = {
        "id": pedido.id,
        "organizacao_id": pedido.organizacao_id,
        "instituicao_id": pedido.instituicao_id,
        "escopo_unidade": getattr(pedido, "escopo_unidade", ESCOPO_PROJETO) or ESCOPO_PROJETO,
        "instituicao_nome": instituicao_nome,
        "email_adm_compras": email_adm_compras,
        "tipo": pedido.tipo,
        "tipo_rotulo": rotulo_tipo_pedido(pedido.tipo),
        "cotacao_projeto": tipo_eh_cotacao_projeto(pedido.tipo),
        "competencia": pedido.competencia,
        "status": pedido.status,
        "fonte_recurso_id": pedido.fonte_recurso_id,
        "observacao": pedido.observacao,
        "titulo": getattr(pedido, "titulo", None),
        "justificativa": getattr(pedido, "justificativa", None),
        "urgencia": getattr(pedido, "urgencia", None) or URGENCIA_NORMAL,
        "data_desejada": pedido.data_desejada.isoformat() if getattr(pedido, "data_desejada", None) else None,
        "local_texto": getattr(pedido, "local_texto", None),
        "patrimonio_id": getattr(pedido, "patrimonio_id", None),
        "defeito": getattr(pedido, "defeito", None),
        "tipo_manutencao": getattr(pedido, "tipo_manutencao", None),
        "escopo_servico": getattr(pedido, "escopo_servico", None),
        "valor_estimado_centavos": getattr(pedido, "valor_estimado_centavos", None),
        "data_envio_prevista": pedido.data_envio_prevista.isoformat() if getattr(pedido, "data_envio_prevista", None) else None,
        "envio_automatico": bool(getattr(pedido, "envio_automatico", False)),
        "aprovado_unidade_em": _iso(pedido.aprovado_unidade_em),
        "aprovado_sede_em": _iso(pedido.aprovado_sede_em),
        "enviado_em": _iso(pedido.enviado_em),
        "recebido_em": _iso(pedido.recebido_em),
        "recebimento_observacao": pedido.recebimento_observacao,
        "recebimento_divergencia": bool(pedido.recebimento_divergencia),
        "pedido_origem_id": getattr(pedido, "pedido_origem_id", None),
        "grupo_split_id": getattr(pedido, "grupo_split_id", None),
        "grupo_codigo": getattr(pedido, "grupo_codigo", None),
        "categoria_split_id": getattr(pedido, "categoria_split_id", None),
        "categoria_split_nome": getattr(pedido, "categoria_split_nome", None),
        "criado_em": _iso(pedido.criado_em),
        "atualizado_em": _iso(pedido.atualizado_em),
    }
    qtd_orc = (
        await db.execute(
            select(func.count())
            .select_from(ComprasCotacaoDB)
            .where(
                ComprasCotacaoDB.pedido_id == pedido.id,
                ComprasCotacaoDB.ativa.is_(True),
            )
        )
    ).scalar_one()
    payload["qtd_orcamentos"] = int(qtd_orc or 0)
    if not incluir_detalhe:
        return payload

    itens = (
        await db.execute(
            select(ComprasPedidoItemDB)
            .where(ComprasPedidoItemDB.pedido_id == pedido.id)
            .order_by(ComprasPedidoItemDB.descricao.asc())
        )
    ).scalars().all()
    ids_catalogo = [getattr(item, "catalogo_item_id", None) for item in itens]
    ids_catalogo = [item_id for item_id in ids_catalogo if item_id]
    catalogo_campos: dict[str, dict] = {}
    if ids_catalogo:
        catalogo_campos = {
            row[0]: {"embalagem": row[1], "marca": row[2], "fator_embalagem": row[3]}
            for row in (
                await db.execute(
                    select(
                        ComprasItemConsumoDB.id,
                        ComprasItemConsumoDB.embalagem,
                        ComprasItemConsumoDB.marca_preferencial,
                        ComprasItemConsumoDB.fator_embalagem,
                    ).where(ComprasItemConsumoDB.id.in_(ids_catalogo))
                )
            ).all()
        }
    cotacoes = (
        await db.execute(
            select(ComprasCotacaoDB)
            .where(ComprasCotacaoDB.pedido_id == pedido.id)
            .order_by(ComprasCotacaoDB.valor_centavos.asc())
        )
    ).scalars().all()
    payload["itens"] = []
    for item in itens:
        cat = catalogo_campos.get(getattr(item, "catalogo_item_id", None) or "") or {}
        embalagem = embalagem_efetiva_pedido(
            getattr(item, "embalagem", None),
            cat.get("embalagem"),
        )
        payload["itens"].append(
            {
                "id": item.id,
                "categoria_id": item.categoria_id,
                "descricao": item.descricao,
                "quantidade": item.quantidade,
                "unidade_medida": unidade_medida_para_pedido(
                    item.unidade_medida,
                    fator_embalagem=cat.get("fator_embalagem"),
                    embalagem=embalagem,
                ),
                "embalagem": embalagem,
                "embalagem_cadastro": cat.get("embalagem") or None,
                "marca_preferencial": embalagem_efetiva_pedido(
                    item.marca_preferencial,
                    cat.get("marca"),
                ),
                "marca_cadastro": cat.get("marca") or None,
                "observacao": item.observacao,
                "catalogo_item_id": getattr(item, "catalogo_item_id", None),
                "quantidade_recebida": item.quantidade_recebida,
                "validade_lote": _iso(item.validade_lote),
            }
        )
    payload["cotacoes"] = [
        {
            "id": cotacao.id,
            "fornecedor_id": cotacao.fornecedor_id,
            "fornecedor_nome": cotacao.fornecedor_nome,
            "valor_centavos": cotacao.valor_centavos,
            "escolhida": bool(cotacao.escolhida),
            "ativa": bool(getattr(cotacao, "ativa", True)),
            "observacao": cotacao.observacao,
        }
        for cotacao in cotacoes
        if getattr(cotacao, "ativa", True)
    ]
    escolhida = next((c for c in cotacoes if c.escolhida and getattr(c, "ativa", True)), None)
    payload["economia"] = economia_centavos(
        [c.valor_centavos for c in cotacoes if getattr(c, "ativa", True)],
        escolhida.valor_centavos if escolhida else None,
    )
    payload.update(await extras_serializacao_pedido(db, pedido))
    pode_itens = bool(payload.get("pode_editar_itens"))
    if (
        pode_itens
        and pedido.tipo == TIPO_CONSUMO
        and pedido.status != STATUS_RASCUNHO
        and not await _janela_aberta_para_pedido(db, pedido)
    ):
        pode_itens = False
    payload["pode_editar_itens"] = pode_itens
    payload["pode_substituir_orcamento"] = bool(usuario and _sede(usuario))
    return payload


async def listar_unidades(db: AsyncSession, organizacao_id: str) -> list[dict]:
    rows = (
        await db.execute(
            select(InstituicaoDB)
            .where(InstituicaoDB.organizacao_id == organizacao_id)
            .order_by(InstituicaoDB.nome_fantasia.asc())
        )
    ).scalars().all()
    return [
        {
            "id": inst.id,
            "nome": inst.nome_fantasia,
            "cnpj": getattr(inst, "cnpj", None),
            "cidade": getattr(inst, "cidade", None),
            "logradouro": getattr(inst, "logradouro", None),
        }
        for inst in rows
    ]


async def _janela_da_competencia(
    db: AsyncSession,
    organizacao_id: str,
    competencia: str,
) -> Optional[ComprasJanelaDB]:
    return (
        await db.execute(
            select(ComprasJanelaDB).where(
                ComprasJanelaDB.organizacao_id == organizacao_id,
                ComprasJanelaDB.competencia == competencia,
            )
        )
    ).scalar_one_or_none()


async def _liberacao_projeto(
    db: AsyncSession,
    janela: Optional[ComprasJanelaDB],
    instituicao_id: str,
) -> bool:
    if not janela:
        return False
    row = (
        await db.execute(
            select(ComprasJanelaLiberacaoDB.id).where(
                ComprasJanelaLiberacaoDB.janela_id == janela.id,
                ComprasJanelaLiberacaoDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    return bool(row)


async def _janela_aberta_para_pedido(db: AsyncSession, pedido: ComprasPedidoDB) -> bool:
    """Consumo: janela (ou liberação) aberta para a competência do pedido."""
    if (pedido.tipo or "").strip().lower() != TIPO_CONSUMO:
        return True
    janela = await _janela_da_competencia(db, pedido.organizacao_id, pedido.competencia)
    liberacao = False
    if not _pedido_escopo_sede(pedido) and pedido.instituicao_id:
        liberacao = await _liberacao_projeto(db, janela, pedido.instituicao_id)
    return janela_consumo_aberta(
        hoje=data_operacional(),
        data_inicio=janela.data_inicio if janela else None,
        data_fim=janela.data_fim if janela else None,
        liberacao_projeto=liberacao,
    )


async def exigir_janela_consumo(
    db: AsyncSession,
    *,
    organizacao_id: str,
    instituicao_id: Optional[str],
    competencia: str,
    tipo: str,
    escopo_unidade: str = ESCOPO_PROJETO,
    data_prevista: Optional[date] = None,
    para_rascunho: bool = False,
) -> None:
    if (tipo or "").strip().lower() != TIPO_CONSUMO:
        return
    janela = await _janela_da_competencia(db, organizacao_id, competencia)
    liberacao = False
    if not pedido_escopo_sede(escopo_unidade):
        if not instituicao_id:
            raise HTTPException(status_code=400, detail="Unidade do pedido não informada.")
        liberacao = await _liberacao_projeto(db, janela, instituicao_id)
    inicio = janela.data_inicio if janela else None
    fim = janela.data_fim if janela else None
    if para_rascunho:
        ok, detalhe = pode_criar_rascunho_consumo(
            hoje=data_operacional(),
            data_inicio=inicio,
            data_fim=fim,
            data_prevista=data_prevista,
            liberacao_projeto=liberacao,
        )
    else:
        ok, detalhe = pode_enviar_consumo(
            hoje=data_operacional(),
            data_inicio=inicio,
            data_fim=fim,
            data_prevista=data_prevista,
            liberacao_projeto=liberacao,
        )
    if not ok:
        raise HTTPException(status_code=400, detail=detalhe)


async def obter_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido_id: str,
) -> ComprasPedidoDB:
    pedido = (
        await db.execute(select(ComprasPedidoDB).where(ComprasPedidoDB.id == pedido_id))
    ).scalar_one_or_none()
    if not pedido or pedido.organizacao_id != _org_id(usuario):
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    if not _sede(usuario):
        if _pedido_escopo_sede(pedido):
            raise HTTPException(status_code=403, detail="Pedido da Sede (organização).")
        if pedido.instituicao_id != usuario.get("instituicao_id"):
            raise HTTPException(status_code=403, detail="Pedido de outra unidade.")
    return pedido


async def listar_pedidos(
    db: AsyncSession,
    usuario: dict,
    *,
    competencia: Optional[str] = None,
    status_filtro: Optional[str] = None,
    tipo: Optional[str] = None,
) -> list[dict]:
    filtros = [ComprasPedidoDB.organizacao_id == _org_id(usuario)]
    if not _sede(usuario):
        filtros.append(ComprasPedidoDB.instituicao_id == usuario.get("instituicao_id"))
    else:
        # ADM Global Compras: não lista rascunhos (só após envio pelo projeto).
        if not status_filtro:
            filtros.append(ComprasPedidoDB.status != STATUS_RASCUNHO)
    if competencia:
        filtros.append(ComprasPedidoDB.competencia == normalizar_competencia(competencia))
    if status_filtro:
        filtros.append(ComprasPedidoDB.status == status_filtro)
    if tipo:
        filtros.append(ComprasPedidoDB.tipo == tipo.strip().lower())

    rows = (
        await db.execute(
            select(ComprasPedidoDB)
            .where(*filtros)
            .order_by(ComprasPedidoDB.atualizado_em.desc())
        )
    ).scalars().all()
    return [await serializar_pedido(db, pedido) for pedido in rows]


async def criar_pedido(
    db: AsyncSession,
    usuario: dict,
    payload: dict,
) -> ComprasPedidoDB:
    if not usuario_pode_pedir(
        perfil=_perfil(usuario),
        compras_modulo_ativo=bool(usuario.get("compras_modulo_ativo")),
        is_manutencao=bool(usuario.get("is_manutencao")),
        org_compras_ativo=True,
    ) and not _sede(usuario):
        raise HTTPException(status_code=403, detail="Sem permissão para criar pedido.")

    tipo = (payload.get("tipo") or TIPO_CONSUMO).strip().lower()
    if tipo not in TIPOS_PEDIDO:
        raise HTTPException(
            status_code=400,
            detail="Tipo inválido. Use consumo, imobilizado, manutencao ou servico.",
        )

    try:
        escopo = normalizar_escopo_unidade(payload.get("escopo_unidade"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    instituicao_id = payload.get("instituicao_id") or usuario.get("instituicao_id")

    if _sede(usuario):
        if escopo == ESCOPO_SEDE:
            instituicao_id = None
        elif payload.get("instituicao_id"):
            instituicao_id = payload["instituicao_id"]
            escopo = ESCOPO_PROJETO
        elif escopo == ESCOPO_PROJETO and not instituicao_id:
            raise HTTPException(
                status_code=400,
                detail="Informe a unidade do pedido ou use escopo Sede (matriz).",
            )
    else:
        escopo = ESCOPO_PROJETO
        instituicao_id = usuario.get("instituicao_id")

    if escopo == ESCOPO_SEDE:
        if not _sede(usuario):
            raise HTTPException(status_code=403, detail="Somente a Sede cria pedidos da matriz.")
        instituicao_id = None
    else:
        if not instituicao_id:
            raise HTTPException(status_code=400, detail="Unidade do pedido não informada.")
        inst = (
            await db.execute(
                select(InstituicaoDB).where(
                    InstituicaoDB.id == instituicao_id,
                    InstituicaoDB.organizacao_id == _org_id(usuario),
                )
            )
        ).scalar_one_or_none()
        if not inst:
            raise HTTPException(status_code=400, detail="Unidade inválida para esta organização.")

    competencia = payload.get("competencia")
    data_prevista = None
    if payload.get("data_envio_prevista"):
        try:
            data_prevista = date.fromisoformat(str(payload.get("data_envio_prevista"))[:10])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Data prevista de envio inválida.") from exc
        competencia = competencia or competencia_de_data(data_prevista)
    competencia = normalizar_competencia(competencia or competencia_de_data(data_operacional()))
    if tipo == TIPO_CONSUMO and data_prevista is None:
        janela_comp = await _janela_da_competencia(db, _org_id(usuario), competencia)
        if janela_comp:
            hoje = data_operacional()
            candidatos = [d for d in dias_liberados_janela(janela_comp.data_inicio, janela_comp.data_fim) if d >= hoje]
            data_prevista = candidatos[0] if candidatos else janela_comp.data_inicio
    await exigir_janela_consumo(
        db,
        organizacao_id=_org_id(usuario),
        instituicao_id=instituicao_id,
        competencia=competencia,
        tipo=tipo,
        escopo_unidade=escopo,
        data_prevista=data_prevista,
        para_rascunho=True,
    )

    pedido = ComprasPedidoDB(
        organizacao_id=_org_id(usuario),
        instituicao_id=instituicao_id,
        escopo_unidade=escopo,
        tipo=tipo,
        competencia=competencia,
        status=STATUS_RASCUNHO,
        fonte_recurso_id=payload.get("fonte_recurso_id") or None,
        observacao=(payload.get("observacao") or None),
        criado_por_id=_uid(usuario),
        data_envio_prevista=data_prevista if tipo == TIPO_CONSUMO else None,
        envio_automatico=bool(payload.get("envio_automatico")) if tipo == TIPO_CONSUMO else False,
    )
    _aplicar_cabecalho_cotacao_projeto(pedido, payload, obrigatorio=tipo_eh_cotacao_projeto(tipo))
    db.add(pedido)
    await db.flush()

    linhas = [item for item in (payload.get("itens") or []) if (item.get("descricao") or "").strip()]
    catalogo = await _fator_catalogo_por_ids(
        db,
        [item.get("catalogo_item_id") for item in linhas],
    )
    for item in linhas:
        cat = catalogo.get(item.get("catalogo_item_id") or "") or {}
        db.add(
            ComprasPedidoItemDB(
                pedido_id=pedido.id,
                categoria_id=item.get("categoria_id") or None,
                descricao=(item.get("descricao") or "").strip(),
                quantidade=float(item.get("quantidade") or 1),
                unidade_medida=_unidade_linha_pedido(item, cat),
                embalagem=(item.get("embalagem") or "").strip() or None,
                marca_preferencial=item.get("marca_preferencial") or None,
                observacao=item.get("observacao") or None,
                catalogo_item_id=item.get("catalogo_item_id") or None,
            )
        )
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto="Rascunho criado.",
        usuario_id=_uid(usuario),
        status_novo=STATUS_RASCUNHO,
        aguardando_confirmacao=False,
    )
    return pedido


async def _fator_catalogo_por_ids(db: AsyncSession, ids: list[str]) -> dict[str, dict]:
    ids_ok = [item_id for item_id in ids if item_id]
    if not ids_ok:
        return {}
    return {
        row[0]: {"fator_embalagem": row[1], "embalagem": row[2]}
        for row in (
            await db.execute(
                select(
                    ComprasItemConsumoDB.id,
                    ComprasItemConsumoDB.fator_embalagem,
                    ComprasItemConsumoDB.embalagem,
                ).where(ComprasItemConsumoDB.id.in_(ids_ok))
            )
        ).all()
    }


def _unidade_linha_pedido(item: dict, catalogo: dict | None = None) -> str:
    cat = catalogo or {}
    embalagem = (item.get("embalagem") or cat.get("embalagem") or "").strip() or None
    return unidade_medida_para_pedido(
        item.get("unidade_medida"),
        fator_embalagem=item.get("fator_embalagem", cat.get("fator_embalagem")),
        embalagem=embalagem,
    )


def _chave_item_pedido_diff(item: dict | object) -> str:
    if isinstance(item, dict):
        cat = (item.get("catalogo_item_id") or "").strip()
        desc = (item.get("descricao") or "").strip().lower()
        return cat or f"desc:{desc}"
    cat = (getattr(item, "catalogo_item_id", None) or "").strip()
    desc = (getattr(item, "descricao", None) or "").strip().lower()
    return cat or f"desc:{desc}"


def _snapshot_item_pedido(item: dict | object) -> dict:
    if isinstance(item, dict):
        return {
            "descricao": (item.get("descricao") or "").strip(),
            "quantidade": float(item.get("quantidade") or 0),
            "unidade_medida": (item.get("unidade_medida") or "").strip() or "un",
            "embalagem": (item.get("embalagem") or "").strip(),
            "marca_preferencial": (item.get("marca_preferencial") or "").strip(),
            "catalogo_item_id": (item.get("catalogo_item_id") or "").strip() or None,
        }
    return {
        "descricao": (getattr(item, "descricao", None) or "").strip(),
        "quantidade": float(getattr(item, "quantidade", None) or 0),
        "unidade_medida": (getattr(item, "unidade_medida", None) or "").strip() or "un",
        "embalagem": (getattr(item, "embalagem", None) or "").strip(),
        "marca_preferencial": (getattr(item, "marca_preferencial", None) or "").strip(),
        "catalogo_item_id": (getattr(item, "catalogo_item_id", None) or "").strip() or None,
    }


async def substituir_itens(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    itens: list[dict],
) -> None:
    if not pedido_itens_podem_editar(pedido.status):
        raise HTTPException(
            status_code=400,
            detail="Só é possível editar itens até o pedido de compra ser enviado ao fornecedor.",
        )
    if (
        pedido.tipo == TIPO_CONSUMO
        and pedido.status != STATUS_RASCUNHO
        and not await _janela_aberta_para_pedido(db, pedido)
    ):
        raise HTTPException(
            status_code=400,
            detail="Janela mensal encerrada: não é mais possível editar itens. Use parecer, observação ou aprovação.",
        )

    linhas = [item for item in (itens or []) if (item.get("descricao") or "").strip()]
    if getattr(pedido, "grupo_split_id", None):
        chave_pedido, rotulo_pedido = chave_split_categoria_pedido(
            getattr(pedido, "categoria_split_nome", None),
            getattr(pedido, "categoria_split_id", None),
        )
        cat_ids = {i.get("categoria_id") for i in linhas if i.get("categoria_id")}
        nomes_cat: dict[str, str] = {}
        if cat_ids:
            nomes_cat = {
                row[0]: row[1]
                for row in (
                    await db.execute(
                        select(ComprasCategoriaDB.id, ComprasCategoriaDB.nome).where(
                            ComprasCategoriaDB.id.in_(list(cat_ids))
                        )
                    )
                ).all()
            }
        for item in linhas:
            nome = nomes_cat.get(item.get("categoria_id") or "", "") if item.get("categoria_id") else ""
            chave, _ = chave_split_categoria_pedido(
                nome,
                item.get("categoria_id"),
                item.get("descricao"),
            )
            if chave != chave_pedido:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Este pedido é só da categoria «{rotulo_pedido}». "
                        "Inclua itens de outra categoria no pedido correspondente do mesmo grupo."
                    ),
                )

    atuais = (
        await db.execute(select(ComprasPedidoItemDB).where(ComprasPedidoItemDB.pedido_id == pedido.id))
    ).scalars().all()
    snapshot_antes = [_snapshot_item_pedido(item) for item in atuais]
    catalogo = await _fator_catalogo_por_ids(
        db,
        [item.get("catalogo_item_id") for item in linhas],
    )
    for item in atuais:
        await db.delete(item)
    for item in linhas:
        cat = catalogo.get(item.get("catalogo_item_id") or "") or {}
        db.add(
            ComprasPedidoItemDB(
                pedido_id=pedido.id,
                categoria_id=item.get("categoria_id") or None,
                descricao=(item.get("descricao") or "").strip(),
                quantidade=float(item.get("quantidade") or 1),
                unidade_medida=_unidade_linha_pedido(item, cat),
                embalagem=(item.get("embalagem") or "").strip() or None,
                marca_preferencial=item.get("marca_preferencial") or None,
                observacao=item.get("observacao") or None,
                catalogo_item_id=item.get("catalogo_item_id") or None,
            )
        )
    pedido.atualizado_em = agora_operacional_naive()

    snapshot_depois = []
    for item in linhas:
        cat = catalogo.get(item.get("catalogo_item_id") or "") or {}
        snap = _snapshot_item_pedido(item)
        snap["unidade_medida"] = _unidade_linha_pedido(item, cat)
        snapshot_depois.append(snap)
    resumo = resumo_alteracao_itens_pedido(snapshot_antes, snapshot_depois)
    if resumo.startswith("Itens regravados sem mudança"):
        return

    # No rascunho: salva sem poluir a timeline (só "Rascunho criado" / "Pedido enviado").
    if pedido.status == STATUS_RASCUNHO:
        return

    nome = (
        (usuario.get("nome") or usuario.get("nome_completo") or usuario.get("email") or "Usuário")
    ).strip()
    texto = f"{nome}: {resumo}"
    texto += (
        " Confira se é necessário reenviar a cotação aos fornecedores"
        " e anexar novo orçamento, se o PDF anterior ficou desatualizado."
    )
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_ITENS,
        texto=texto,
        usuario_id=_uid(usuario),
    )

async def _cotacoes_do_pedido(db: AsyncSession, pedido_id: str) -> list[ComprasCotacaoDB]:
    return list(
        (
            await db.execute(
                select(ComprasCotacaoDB).where(ComprasCotacaoDB.pedido_id == pedido_id)
            )
        ).scalars().all()
    )


async def _proximo_grupo_codigo(
    db: AsyncSession,
    *,
    instituicao_id: Optional[str],
    agora: datetime,
) -> str:
    """Próximo N-DD/MM/AAAA do projeto no dia operacional (lote de envio)."""
    dia = agora.date() if hasattr(agora, "date") else data_operacional()
    dia_fmt = dia.strftime("%d/%m/%Y")
    q = select(ComprasPedidoDB.grupo_codigo).where(
        ComprasPedidoDB.grupo_codigo.is_not(None),
        ComprasPedidoDB.grupo_codigo != "",
    )
    if instituicao_id:
        q = q.where(ComprasPedidoDB.instituicao_id == instituicao_id)
    else:
        q = q.where(ComprasPedidoDB.instituicao_id.is_(None))
    rows = (await db.execute(q)).scalars().all()
    max_seq = 0
    for codigo in rows:
        seq = sequencia_grupo_codigo(codigo, dia_fmt)
        if seq is not None and seq > max_seq:
            max_seq = seq
    return formatar_grupo_codigo(max_seq + 1, dia)


async def submeter_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> list[ComprasPedidoDB]:
    """Envia o rascunho. Em consumo, parte por categoria (Carne/Alimentação separados)."""
    if tipo_eh_cotacao_projeto(pedido.tipo):
        if pedido.status not in {STATUS_RASCUNHO, STATUS_EM_COTACAO, STATUS_AGUARDANDO_COTACAO}:
            raise HTTPException(
                status_code=400,
                detail="Este pedido não pode ser enviado à Sede neste status.",
            )
        itens_proj = list(
            (
                await db.execute(
                    select(ComprasPedidoItemDB).where(ComprasPedidoItemDB.pedido_id == pedido.id)
                )
            ).scalars().all()
        )
        if not itens_proj:
            raise HTTPException(status_code=400, detail="Inclua ao menos um item antes de enviar.")
        cotacoes = [c for c in await _cotacoes_do_pedido(db, pedido.id) if getattr(c, "ativa", True)]
        escolhida = any(c.escolhida for c in cotacoes)
        if not pedido_pronto_para_aprovacao_unidade(pedido.tipo, len(cotacoes), escolhida):
            raise HTTPException(
                status_code=400,
                detail="Escolha o orçamento vencedor antes de enviar à Sede.",
            )
        status_anterior = pedido.status
        pedido.status = STATUS_AGUARDANDO_SEDE
        pedido.submetido_em = agora_operacional_naive()
        pedido.atualizado_em = agora_operacional_naive()
        await registrar_evento_pedido(
            db,
            pedido_id=pedido.id,
            tipo=TIPO_EVENTO_STATUS,
            texto="Pedido enviado à Sede para assinatura.",
            usuario_id=_uid(usuario),
            status_anterior=status_anterior,
            status_novo=pedido.status,
        )
        return [pedido]

    if pedido.status != STATUS_RASCUNHO:
        raise HTTPException(status_code=400, detail="Somente rascunho pode ser enviado.")
    itens = list(
        (
            await db.execute(
                select(ComprasPedidoItemDB).where(ComprasPedidoItemDB.pedido_id == pedido.id)
            )
        ).scalars().all()
    )
    if not itens:
        raise HTTPException(status_code=400, detail="Inclua ao menos um item antes de enviar.")

    await exigir_janela_consumo(
        db,
        organizacao_id=pedido.organizacao_id,
        instituicao_id=pedido.instituicao_id,
        competencia=pedido.competencia,
        tipo=pedido.tipo,
        escopo_unidade=getattr(pedido, "escopo_unidade", ESCOPO_PROJETO),
        data_prevista=getattr(pedido, "data_envio_prevista", None),
    )

    # Consumo: agrupar por categoria (Carne / Alimentação / demais).
    cat_ids = {i.categoria_id for i in itens if i.categoria_id}
    nomes_cat: dict[str, str] = {}
    if cat_ids:
        nomes_cat = {
            row[0]: row[1]
            for row in (
                await db.execute(
                    select(ComprasCategoriaDB.id, ComprasCategoriaDB.nome).where(
                        ComprasCategoriaDB.id.in_(list(cat_ids))
                    )
                )
            ).all()
        }

    grupos: dict[str, list[ComprasPedidoItemDB]] = defaultdict(list)
    rotulos: dict[str, str] = {}
    cat_ids_grupo: dict[str, Optional[str]] = {}
    for item in itens:
        nome = nomes_cat.get(item.categoria_id or "", "") if item.categoria_id else ""
        chave, rotulo = chave_split_categoria_pedido(nome, item.categoria_id, item.descricao)
        grupos[chave].append(item)
        rotulos[chave] = rotulo
        cat_ids_grupo[chave] = item.categoria_id

    chaves = list(grupos.keys())
    grupo_split_id = pedido.id
    agora = agora_operacional_naive()
    grupo_codigo = await _proximo_grupo_codigo(
        db,
        instituicao_id=pedido.instituicao_id,
        agora=agora,
    )
    pedidos_resultado: list[ComprasPedidoDB] = []

    async def _aplicar_envio(p: ComprasPedidoDB, chave: str, itens_grupo: list[ComprasPedidoItemDB]) -> None:
        p.grupo_split_id = grupo_split_id
        p.grupo_codigo = grupo_codigo
        p.categoria_split_nome = rotulos[chave]
        p.categoria_split_id = cat_ids_grupo.get(chave)
        p.status = STATUS_AGUARDANDO_COTACAO
        p.submetido_em = agora
        p.atualizado_em = agora
        for item in itens_grupo:
            item.pedido_id = p.id
        await registrar_evento_pedido(
            db,
            pedido_id=p.id,
            tipo=TIPO_EVENTO_STATUS,
            texto=(
                f"Pedido enviado — categoria {rotulos[chave]} (grupo {grupo_codigo})."
                if len(chaves) > 1
                else f"Pedido enviado (grupo {grupo_codigo})."
            ),
            usuario_id=_uid(usuario),
            status_anterior=STATUS_RASCUNHO,
            status_novo=STATUS_AGUARDANDO_COTACAO,
        )

    if len(chaves) == 1:
        chave = chaves[0]
        await _aplicar_envio(pedido, chave, grupos[chave])
        pedidos_resultado.append(pedido)
        return pedidos_resultado

    # Primeiro grupo fica no pedido original; demais viram irmãos.
    primeira = chaves[0]
    await _aplicar_envio(pedido, primeira, grupos[primeira])
    pedido.pedido_origem_id = None
    pedidos_resultado.append(pedido)

    for chave in chaves[1:]:
        irmao = ComprasPedidoDB(
            id=get_uuid(),
            organizacao_id=pedido.organizacao_id,
            instituicao_id=pedido.instituicao_id,
            escopo_unidade=getattr(pedido, "escopo_unidade", ESCOPO_PROJETO),
            tipo=pedido.tipo,
            competencia=pedido.competencia,
            status=STATUS_RASCUNHO,
            fonte_recurso_id=pedido.fonte_recurso_id,
            observacao=pedido.observacao,
            criado_por_id=pedido.criado_por_id,
            data_envio_prevista=getattr(pedido, "data_envio_prevista", None),
            envio_automatico=bool(getattr(pedido, "envio_automatico", False)),
            pedido_origem_id=grupo_split_id,
            grupo_split_id=grupo_split_id,
            grupo_codigo=grupo_codigo,
            criado_em=agora,
            atualizado_em=agora,
        )
        db.add(irmao)
        await db.flush()
        await _aplicar_envio(irmao, chave, grupos[chave])
        await registrar_evento_pedido(
            db,
            pedido_id=irmao.id,
            tipo=TIPO_EVENTO_STATUS,
            texto=f"Separado do grupo {grupo_codigo} ({rotulos[chave]}).",
            usuario_id=_uid(usuario),
        )
        pedidos_resultado.append(irmao)

    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=(
            f"Pedido dividido em {len(chaves)} por categoria "
            f"({', '.join(rotulos[c] for c in chaves)}). Grupo {grupo_codigo}."
        ),
        usuario_id=_uid(usuario),
    )
    return pedidos_resultado


async def atualizar_rascunho(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    payload: dict,
) -> ComprasPedidoDB:
    if pedido.status != STATUS_RASCUNHO:
        raise HTTPException(status_code=400, detail="Só o rascunho pode ser ajustado aqui.")

    if tipo_eh_cotacao_projeto(pedido.tipo):
        _aplicar_cabecalho_cotacao_projeto(pedido, payload, obrigatorio=False)
        pedido.atualizado_em = agora_operacional_naive()
        return pedido

    if pedido.tipo != TIPO_CONSUMO:
        raise HTTPException(status_code=400, detail="Envio automático vale só para pedido de consumo.")

    if "data_envio_prevista" in payload and payload.get("data_envio_prevista"):
        try:
            prevista = date.fromisoformat(str(payload.get("data_envio_prevista"))[:10])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Data prevista de envio inválida.") from exc
        await exigir_janela_consumo(
            db,
            organizacao_id=pedido.organizacao_id,
            instituicao_id=pedido.instituicao_id,
            competencia=pedido.competencia,
            tipo=pedido.tipo,
            escopo_unidade=getattr(pedido, "escopo_unidade", ESCOPO_PROJETO),
            data_prevista=prevista,
            para_rascunho=True,
        )
        pedido.data_envio_prevista = prevista
        pedido.competencia = competencia_de_data(prevista)

    if "envio_automatico" in payload:
        pedido.envio_automatico = bool(payload.get("envio_automatico"))
        if pedido.envio_automatico and pedido.tipo == TIPO_CONSUMO and not pedido.data_envio_prevista:
            raise HTTPException(
                status_code=400,
                detail="Escolha no calendário o dia liberado antes de marcar o envio automático.",
            )
    pedido.atualizado_em = agora_operacional_naive()
    return pedido


async def registrar_cotacao(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    payload: dict,
) -> ComprasCotacaoDB:
    unidade_cotacao_projeto = (
        tipo_eh_cotacao_projeto(pedido.tipo)
        and pedido.status in {
            STATUS_RASCUNHO,
            STATUS_AGUARDANDO_COTACAO,
            STATUS_EM_COTACAO,
            STATUS_AGUARDANDO_UNIDADE,
            STATUS_AGUARDANDO_SEDE,
        }
        and not _sede(usuario)
    )
    if not _sede(usuario) and not unidade_cotacao_projeto:
        raise HTTPException(status_code=403, detail="Cotações de consumo são lançadas pela Sede.")
    if pedido.status not in {
        STATUS_RASCUNHO,
        STATUS_AGUARDANDO_COTACAO,
        STATUS_EM_COTACAO,
        STATUS_AGUARDANDO_UNIDADE,
        STATUS_AGUARDANDO_SEDE,
        STATUS_APROVADO,
        STATUS_ENVIADO,
    }:
        raise HTTPException(status_code=400, detail="Este pedido não aceita novas cotações.")

    nome = (payload.get("fornecedor_nome") or "").strip()
    fornecedor_id = payload.get("fornecedor_id")
    if fornecedor_id:
        fornecedor = (
            await db.execute(
                select(ComprasFornecedorDB).where(
                    ComprasFornecedorDB.id == fornecedor_id,
                    ComprasFornecedorDB.organizacao_id == pedido.organizacao_id,
                )
            )
        ).scalar_one_or_none()
        if not fornecedor or fornecedor.bloqueado or not fornecedor.ativo:
            raise HTTPException(status_code=400, detail="Fornecedor inválido ou bloqueado.")
        nome = nome or fornecedor.nome

    if not nome:
        raise HTTPException(status_code=400, detail="Informe o fornecedor.")

    valor = payload.get("valor_centavos")
    if valor is None and payload.get("valor_reais") is not None:
        valor = int(round(float(payload["valor_reais"]) * 100))
    valor = int(valor or 0)
    if valor < 0:
        raise HTTPException(status_code=400, detail="Valor da cotação inválido.")

    cotacao = ComprasCotacaoDB(
        pedido_id=pedido.id,
        fornecedor_id=fornecedor_id or None,
        fornecedor_nome=nome,
        valor_centavos=valor,
        observacao=payload.get("observacao") or None,
        criado_por_id=_uid(usuario),
        ativa=True,
    )
    db.add(cotacao)
    if pedido.status == STATUS_AGUARDANDO_COTACAO:
        pedido.status = STATUS_EM_COTACAO
    pedido.atualizado_em = agora_operacional_naive()
    return cotacao


async def escolher_cotacao(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    cotacao_id: str,
) -> ComprasPedidoDB:
    cotacoes = [c for c in await _cotacoes_do_pedido(db, pedido.id) if getattr(c, "ativa", True)]
    alvo = next((c for c in cotacoes if c.id == cotacao_id), None)
    if not alvo:
        raise HTTPException(status_code=404, detail="Cotação não encontrada.")

    unidade_projeto = tipo_eh_cotacao_projeto(pedido.tipo) and not _sede(usuario)
    unidade_consumo = pedido.tipo == TIPO_CONSUMO and not _sede(usuario)
    if not _sede(usuario) and not unidade_projeto and not unidade_consumo:
        raise HTTPException(status_code=403, detail="Sem permissão para escolher esta cotação.")

    for cotacao in cotacoes:
        cotacao.escolhida = cotacao.id == cotacao_id

    if pedido.tipo == TIPO_CONSUMO and pedido.status in {
        STATUS_AGUARDANDO_COTACAO,
        STATUS_EM_COTACAO,
    }:
        if pedido_pronto_para_aprovacao_unidade(pedido.tipo, len(cotacoes), True):
            pedido.status = (
                STATUS_AGUARDANDO_SEDE if _pedido_escopo_sede(pedido) else STATUS_AGUARDANDO_UNIDADE
            )
    pedido.atualizado_em = agora_operacional_naive()
    return pedido


async def aprovar_unidade(db: AsyncSession, usuario: dict, pedido: ComprasPedidoDB) -> ComprasPedidoDB:
    if _pedido_escopo_sede(pedido):
        raise HTTPException(status_code=400, detail="Pedido da Sede não passa por aprovação de unidade.")
    if not usuario_pode_aprovar_unidade(
        perfil=_perfil(usuario),
        compras_modulo_ativo=bool(usuario.get("compras_modulo_ativo")),
        is_manutencao=bool(usuario.get("is_manutencao")),
        org_compras_ativo=True,
    ):
        raise HTTPException(status_code=403, detail="Sem permissão para aprovar na unidade.")
    if pedido.instituicao_id != usuario.get("instituicao_id") and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=403, detail="Aprovação da unidade só no próprio projeto.")
    if pedido.status != STATUS_AGUARDANDO_UNIDADE:
        raise HTTPException(status_code=400, detail="Pedido não está aguardando aprovação da unidade.")
    cotacoes = [c for c in await _cotacoes_do_pedido(db, pedido.id) if getattr(c, "ativa", True)]
    if not pedido_pronto_para_aprovacao_unidade(
        pedido.tipo,
        len(cotacoes),
        any(c.escolhida for c in cotacoes),
    ):
        raise HTTPException(status_code=400, detail="Cotação escolhida ainda não está completa.")
    pedido.aprovado_unidade_por_id = _uid(usuario)
    pedido.aprovado_unidade_em = agora_operacional_naive()
    pedido.status = STATUS_AGUARDANDO_SEDE
    pedido.atualizado_em = agora_operacional_naive()
    return pedido


async def aprovar_sede(db: AsyncSession, usuario: dict, pedido: ComprasPedidoDB) -> ComprasPedidoDB:
    if not usuario_pode_aprovar_sede(
        perfil=_perfil(usuario),
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        raise HTTPException(status_code=403, detail="Somente ADM Compras aprova na Sede.")
    if pedido.status != STATUS_AGUARDANDO_SEDE:
        raise HTTPException(status_code=400, detail="Pedido não está aguardando aprovação da Sede.")
    if not _pedido_escopo_sede(pedido) and not pedido.aprovado_unidade_em:
        raise HTTPException(status_code=400, detail="A unidade precisa aprovar antes da Sede.")
    pedido.aprovado_sede_por_id = _uid(usuario)
    pedido.aprovado_sede_em = agora_operacional_naive()
    pedido.status = STATUS_APROVADO
    pedido.atualizado_em = agora_operacional_naive()
    return pedido


async def enviar_fornecedor(db: AsyncSession, usuario: dict, pedido: ComprasPedidoDB) -> ComprasPedidoDB:
    if tipo_eh_cotacao_projeto(pedido.tipo):
        if not _sede(usuario):
            if not usuario_pode_pedir(
                perfil=_perfil(usuario),
                compras_modulo_ativo=bool(usuario.get("compras_modulo_ativo")),
                is_manutencao=bool(usuario.get("is_manutencao")),
                org_compras_ativo=True,
            ):
                raise HTTPException(status_code=403, detail="Sem permissão para enviar ao fornecedor.")
            if pedido.instituicao_id != usuario.get("instituicao_id") and not usuario.get("is_manutencao"):
                raise HTTPException(status_code=403, detail="Envio ao fornecedor só no próprio projeto.")
    else:
        exigir_sede(usuario)
    if pedido.status != STATUS_APROVADO:
        raise HTTPException(
            status_code=400,
            detail=(
                "Envio ao fornecedor só após assinatura/aprovação da Sede."
                if tipo_eh_cotacao_projeto(pedido.tipo)
                else "Envio ao fornecedor só após as duas aprovações."
            ),
        )
    await gerar_pedido_compra(db, usuario, pedido)
    pedido.status = STATUS_ENVIADO
    pedido.enviado_em = agora_operacional_naive()
    pedido.enviado_por_id = _uid(usuario)
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto="Pedido enviado ao fornecedor.",
        usuario_id=_uid(usuario),
        status_anterior=STATUS_APROVADO,
        status_novo=STATUS_ENVIADO,
    )
    return pedido


async def receber_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    payload: dict,
) -> ComprasPedidoDB:
    if not usuario_pode_aprovar_unidade(
        perfil=_perfil(usuario),
        compras_modulo_ativo=bool(usuario.get("compras_modulo_ativo")),
        is_manutencao=bool(usuario.get("is_manutencao")),
        org_compras_ativo=True,
    ) and not _sede(usuario):
        raise HTTPException(status_code=403, detail="Sem permissão para conferir o recebimento.")
    if not _sede(usuario):
        if _pedido_escopo_sede(pedido):
            raise HTTPException(status_code=403, detail="Recebimento da Sede só pela matriz.")
        if pedido.instituicao_id != usuario.get("instituicao_id"):
            raise HTTPException(status_code=403, detail="Recebimento só na unidade do pedido.")
    return await encerrar_pedido(db, usuario, pedido, payload)


async def cancelar_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    motivo: Optional[str],
) -> ComprasPedidoDB:
    if pedido.status in {STATUS_RECEBIDO, STATUS_CANCELADO, STATUS_REPROVADO}:
        raise HTTPException(status_code=400, detail="Este pedido não pode ser cancelado.")
    if not _sede(usuario):
        if _pedido_escopo_sede(pedido):
            raise HTTPException(status_code=403, detail="Sem permissão para cancelar.")
        if pedido.instituicao_id != usuario.get("instituicao_id"):
            raise HTTPException(status_code=403, detail="Sem permissão para cancelar.")
    if not _sede(usuario) and pedido.status not in {STATUS_RASCUNHO, STATUS_AGUARDANDO_COTACAO}:
        raise HTTPException(status_code=403, detail="A unidade só cancela rascunho ou pedido ainda sem cotação.")
    texto = (motivo or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Informe o motivo do cancelamento.")
    anterior = pedido.status
    pedido.status_anterior = anterior
    pedido.status = STATUS_CANCELADO
    pedido.cancelado_em = agora_operacional_naive()
    pedido.cancelado_por_id = _uid(usuario)
    pedido.motivo_cancelamento = texto
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=texto,
        usuario_id=_uid(usuario),
        status_anterior=anterior,
        status_novo=STATUS_CANCELADO,
    )
    return pedido


async def excluir_rascunho_pedido(db: AsyncSession, usuario: dict, pedido: ComprasPedidoDB) -> None:
    if not _sede(usuario):
        if _pedido_escopo_sede(pedido):
            raise HTTPException(status_code=403, detail="Sem permissão para excluir.")
        if pedido.instituicao_id != usuario.get("instituicao_id"):
            raise HTTPException(status_code=403, detail="Sem permissão para excluir.")
    qtd_cotacoes = len(
        (
            await db.execute(
                select(ComprasCotacaoDB.id).where(ComprasCotacaoDB.pedido_id == pedido.id)
            )
        ).scalars().all()
    )
    qtd_anexos = len(
        (
            await db.execute(
                select(ComprasPedidoAnexoDB.id).where(ComprasPedidoAnexoDB.pedido_id == pedido.id)
            )
        ).scalars().all()
    )
    qtd_eventos = len(
        (
            await db.execute(
                select(ComprasPedidoEventoDB.id).where(ComprasPedidoEventoDB.pedido_id == pedido.id)
            )
        ).scalars().all()
    )
    qtd_notas = len(
        (
            await db.execute(
                select(ComprasPedidoNotaFiscalDB.id).where(
                    ComprasPedidoNotaFiscalDB.pedido_id == pedido.id
                )
            )
        ).scalars().all()
    )
    if not pedido_rascunho_pode_excluir(
        status=pedido.status,
        qtd_cotacoes=qtd_cotacoes,
        qtd_anexos=qtd_anexos,
        qtd_eventos=qtd_eventos,
        qtd_notas=qtd_notas,
    ):
        raise HTTPException(
            status_code=400,
            detail="Este pedido já tem tramitação. Use Cancelar e informe o motivo.",
        )
    await db.execute(delete(ComprasPedidoItemDB).where(ComprasPedidoItemDB.pedido_id == pedido.id))
    await db.flush()
    await db.delete(pedido)


async def salvar_janela(
    db: AsyncSession,
    usuario: dict,
    payload: dict,
) -> ComprasJanelaDB:
    exigir_sede(usuario)
    competencia = normalizar_competencia(payload.get("competencia") or "")
    data_inicio = date.fromisoformat(str(payload["data_inicio"]))
    data_fim = date.fromisoformat(str(payload["data_fim"]))
    try:
        validar_periodo_janela(competencia=competencia, data_inicio=data_inicio, data_fim=data_fim)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    janela = await _janela_da_competencia(db, _org_id(usuario), competencia)
    if not janela:
        janela = ComprasJanelaDB(
            organizacao_id=_org_id(usuario),
            competencia=competencia,
            data_inicio=data_inicio,
            data_fim=data_fim,
            criado_por_id=_uid(usuario),
        )
        db.add(janela)
    else:
        janela.data_inicio = data_inicio
        janela.data_fim = data_fim
        janela.atualizado_em = agora_operacional_naive()
    return janela


async def excluir_janela(db: AsyncSession, usuario: dict, janela_id: str) -> None:
    exigir_sede(usuario)
    janela = (
        await db.execute(
            select(ComprasJanelaDB).where(
                ComprasJanelaDB.id == janela_id,
                ComprasJanelaDB.organizacao_id == _org_id(usuario),
            )
        )
    ).scalar_one_or_none()
    if not janela:
        raise HTTPException(status_code=404, detail="Janela não encontrada.")
    await db.execute(
        delete(ComprasJanelaLiberacaoDB).where(ComprasJanelaLiberacaoDB.janela_id == janela.id)
    )
    await db.delete(janela)


async def listar_janelas(db: AsyncSession, usuario: dict) -> dict:
    hoje = data_operacional()
    rows = (
        await db.execute(
            select(ComprasJanelaDB)
            .where(ComprasJanelaDB.organizacao_id == _org_id(usuario))
            .order_by(ComprasJanelaDB.competencia.asc())
        )
    ).scalars().all()
    sede = _sede(usuario)
    inst_id = usuario.get("instituicao_id")
    saida = []
    for janela in rows:
        libs = (
            await db.execute(
                select(ComprasJanelaLiberacaoDB).where(
                    ComprasJanelaLiberacaoDB.janela_id == janela.id
                )
            )
        ).scalars().all()
        liberado_projeto = bool(inst_id and any(lib.instituicao_id == inst_id for lib in libs))
        situacao = status_janela(hoje=hoje, data_inicio=janela.data_inicio, data_fim=janela.data_fim)
        saida.append({
            "id": janela.id,
            "competencia": janela.competencia,
            "data_inicio": janela.data_inicio.isoformat(),
            "data_fim": janela.data_fim.isoformat(),
            "dias_liberados": [d.isoformat() for d in dias_liberados_janela(janela.data_inicio, janela.data_fim)],
            "status": situacao,
            "aberta_hoje": janela_consumo_aberta(
                hoje=hoje,
                data_inicio=janela.data_inicio,
                data_fim=janela.data_fim,
                liberacao_projeto=liberado_projeto,
            ),
            "liberado_projeto": liberado_projeto,
            "liberacoes": [
                {
                    "id": lib.id,
                    "instituicao_id": lib.instituicao_id,
                    "motivo": lib.motivo,
                }
                for lib in libs
            ] if sede else [],
        })
    return {"hoje": hoje.isoformat(), "itens": saida}


async def publicar_janelas_ano(
    db: AsyncSession,
    usuario: dict,
    ano: int,
    *,
    semana: int = 2,
) -> dict:
    exigir_sede(usuario)
    if ano < 2020 or ano > 2100:
        raise HTTPException(status_code=400, detail="Ano inválido.")
    if semana not in (1, 2, 3, 4):
        raise HTTPException(status_code=400, detail="Semana deve ser 1, 2, 3 ou 4.")
    criadas = existentes = 0
    for mes in range(1, 13):
        competencia = f"{ano:04d}-{mes:02d}"
        if await _janela_da_competencia(db, _org_id(usuario), competencia):
            existentes += 1
            continue
        try:
            inicio, fim = periodo_semana_util_mes(ano, mes, semana)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        await salvar_janela(
            db,
            usuario,
            {
                "competencia": competencia,
                "data_inicio": inicio.isoformat(),
                "data_fim": fim.isoformat(),
            },
        )
        criadas += 1
    return {"ano": ano, "semana": semana, "criadas": criadas, "existentes": existentes}


async def processar_envios_automaticos(db: AsyncSession) -> dict:
    hoje = data_operacional()
    pedidos = (
        await db.execute(
            select(ComprasPedidoDB).where(
                ComprasPedidoDB.status == STATUS_RASCUNHO,
                ComprasPedidoDB.envio_automatico == True,
                ComprasPedidoDB.tipo == TIPO_CONSUMO,
            )
        )
    ).scalars().all()
    enviados = ignorados = 0
    for pedido in pedidos:
        try:
            await submeter_pedido(db, {"organizacao_id": pedido.organizacao_id}, pedido)
            enviados += 1
        except HTTPException:
            ignorados += 1
        except Exception:
            ignorados += 1
    if enviados:
        await db.commit()
    return {"hoje": hoje.isoformat(), "enviados": enviados, "ignorados": ignorados}


async def liberar_unidade_janela(
    db: AsyncSession,
    usuario: dict,
    janela_id: str,
    instituicao_id: str,
    motivo: Optional[str],
) -> ComprasJanelaLiberacaoDB:
    exigir_sede(usuario)
    janela = (
        await db.execute(
            select(ComprasJanelaDB).where(
                ComprasJanelaDB.id == janela_id,
                ComprasJanelaDB.organizacao_id == _org_id(usuario),
            )
        )
    ).scalar_one_or_none()
    if not janela:
        raise HTTPException(status_code=404, detail="Janela não encontrada.")
    existente = (
        await db.execute(
            select(ComprasJanelaLiberacaoDB).where(
                ComprasJanelaLiberacaoDB.janela_id == janela.id,
                ComprasJanelaLiberacaoDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if existente:
        existente.motivo = motivo or existente.motivo
        return existente
    lib = ComprasJanelaLiberacaoDB(
        janela_id=janela.id,
        instituicao_id=instituicao_id,
        motivo=motivo,
        liberado_por_id=_uid(usuario),
    )
    db.add(lib)
    return lib


async def _mapa_projetos_fornecedores(
    db: AsyncSession,
    fornecedor_ids: list[str],
) -> dict[str, list[dict]]:
    if not fornecedor_ids:
        return {}
    vinculos = (
        await db.execute(
            select(
                ComprasFornecedorProjetoDB.fornecedor_id,
                ComprasFornecedorProjetoDB.instituicao_id,
                InstituicaoDB.nome_fantasia,
            )
            .join(InstituicaoDB, InstituicaoDB.id == ComprasFornecedorProjetoDB.instituicao_id)
            .where(ComprasFornecedorProjetoDB.fornecedor_id.in_(fornecedor_ids))
            .order_by(InstituicaoDB.nome_fantasia.asc())
        )
    ).all()
    mapa: dict[str, list[dict]] = {}
    for fornecedor_id, instituicao_id, nome in vinculos:
        mapa.setdefault(fornecedor_id, []).append({"id": instituicao_id, "nome": nome})
    return mapa


def _serializar_fornecedor(
    f: ComprasFornecedorDB,
    projetos: Optional[list[dict]] = None,
    categoria_ids: Optional[list[str]] = None,
) -> dict:
    lista_projetos = projetos if projetos is not None else []
    ids_cat = list(categoria_ids or [])
    if f.categoria_id and f.categoria_id not in ids_cat:
        ids_cat.insert(0, f.categoria_id)
    atende_geral = bool(getattr(f, "atende_geral", True))
    rotulo = montar_rotulo_projetos(
        atende_geral=atende_geral,
        nomes=[p["nome"] for p in lista_projetos],
    )
    return {
        "id": f.id,
        "categoria_id": f.categoria_id or (ids_cat[0] if ids_cat else None),
        "categoria_ids": ids_cat,
        "nome": f.nome,
        "cnpj": f.cnpj,
        "segmento": f.segmento,
        "contato": f.contato,
        "telefone": f.telefone,
        "email": f.email,
        "email_empresa": f.email_empresa,
        "cep": f.cep,
        "logradouro": f.logradouro,
        "numero": f.numero,
        "complemento": f.complemento,
        "bairro": f.bairro,
        "cidade": f.cidade,
        "uf": f.uf,
        "atende_geral": atende_geral,
        "prazo_entrega_dias": getattr(f, "prazo_entrega_dias", None),
        "projeto_ids": [p["id"] for p in lista_projetos],
        "projetos": lista_projetos,
        "projetos_atendidos": rotulo or f.projetos_atendidos,
        "ativo": bool(f.ativo),
        "bloqueado": bool(f.bloqueado),
        "observacao": f.observacao,
    }


async def listar_fornecedores(db: AsyncSession, usuario: dict, ativos: Optional[bool] = None) -> list[dict]:
    filtros = [ComprasFornecedorDB.organizacao_id == _org_id(usuario)]
    if ativos is True:
        filtros.append(ComprasFornecedorDB.ativo.is_(True))
        filtros.append(ComprasFornecedorDB.bloqueado.is_(False))
    rows = (
        await db.execute(
            select(ComprasFornecedorDB)
            .where(*filtros)
            .order_by(ComprasFornecedorDB.nome.asc())
        )
    ).scalars().all()
    mapa_projetos = await _mapa_projetos_fornecedores(db, [f.id for f in rows])
    mapa_cats = await _mapa_categorias_fornecedores(db, [f.id for f in rows])
    return [
        _serializar_fornecedor(f, mapa_projetos.get(f.id, []), mapa_cats.get(f.id, []))
        for f in rows
    ]


async def _mapa_categorias_fornecedores(db: AsyncSession, fornecedor_ids: list[str]) -> dict[str, list[str]]:
    if not fornecedor_ids:
        return {}
    vinculos = (
        await db.execute(
            select(
                ComprasFornecedorCategoriaDB.fornecedor_id,
                ComprasFornecedorCategoriaDB.categoria_id,
            ).where(ComprasFornecedorCategoriaDB.fornecedor_id.in_(fornecedor_ids))
        )
    ).all()
    mapa: dict[str, list[str]] = defaultdict(list)
    for fornecedor_id, categoria_id in vinculos:
        if categoria_id and categoria_id not in mapa[fornecedor_id]:
            mapa[fornecedor_id].append(categoria_id)
    return mapa


async def _sync_categorias_fornecedor(
    db: AsyncSession,
    fornecedor: ComprasFornecedorDB,
    categoria_ids: list[str],
    org_id: str,
) -> None:
    limpos: list[str] = []
    visto: set[str] = set()
    for cid in categoria_ids:
        token = (cid or "").strip()
        if not token or token in visto:
            continue
        visto.add(token)
        limpos.append(token)
    principal = (fornecedor.categoria_id or "").strip()
    if principal and principal not in visto:
        limpos.insert(0, principal)
        visto.add(principal)
    if limpos:
        validos = {
            row[0]
            for row in (
                await db.execute(
                    select(ComprasCategoriaDB.id).where(
                        ComprasCategoriaDB.organizacao_id == org_id,
                        ComprasCategoriaDB.id.in_(limpos),
                    )
                )
            ).all()
        }
        limpos = [cid for cid in limpos if cid in validos]
    await db.execute(
        delete(ComprasFornecedorCategoriaDB).where(
            ComprasFornecedorCategoriaDB.fornecedor_id == fornecedor.id
        )
    )
    for cid in limpos:
        db.add(ComprasFornecedorCategoriaDB(fornecedor_id=fornecedor.id, categoria_id=cid))
    fornecedor.categoria_id = limpos[0] if limpos else None


async def _sync_projetos_fornecedor(
    db: AsyncSession,
    fornecedor: ComprasFornecedorDB,
    *,
    atende_geral: bool,
    projeto_ids: list[str],
    org_id: str,
) -> list[dict]:
    limpos = []
    visto: set[str] = set()
    for inst_id in projeto_ids:
        token = (inst_id or "").strip()
        if not token or token in visto:
            continue
        visto.add(token)
        limpos.append(token)

    if not atende_geral and limpos:
        validos = (
            await db.execute(
                select(InstituicaoDB.id, InstituicaoDB.nome_fantasia).where(
                    InstituicaoDB.organizacao_id == org_id,
                    InstituicaoDB.id.in_(limpos),
                )
            )
        ).all()
        if len(validos) != len(limpos):
            raise HTTPException(status_code=400, detail="Projeto inválido para esta organização.")
        limpos = [inst_id for inst_id, _ in validos]
    elif not atende_geral and not limpos:
        raise HTTPException(
            status_code=400,
            detail="Selecione ao menos um projeto ou marque GERAL (toda organização).",
        )
    else:
        limpos = []

    await db.execute(
        delete(ComprasFornecedorProjetoDB).where(
            ComprasFornecedorProjetoDB.fornecedor_id == fornecedor.id
        )
    )
    projetos: list[dict] = []
    if not atende_geral:
        nomes_map = dict(
            (
                await db.execute(
                    select(InstituicaoDB.id, InstituicaoDB.nome_fantasia).where(
                        InstituicaoDB.id.in_(limpos)
                    )
                )
            ).all()
        )
        for inst_id in limpos:
            db.add(
                ComprasFornecedorProjetoDB(
                    fornecedor_id=fornecedor.id,
                    instituicao_id=inst_id,
                    criado_em=agora_operacional_naive(),
                )
            )
            projetos.append({"id": inst_id, "nome": nomes_map.get(inst_id) or inst_id})

    fornecedor.atende_geral = atende_geral
    fornecedor.projetos_atendidos = montar_rotulo_projetos(
        atende_geral=atende_geral,
        nomes=[p["nome"] for p in projetos],
    ) or None
    return projetos


async def salvar_fornecedor(db: AsyncSession, usuario: dict, payload: dict, fornecedor_id: Optional[str] = None):
    exigir_cadastro_mestre_compras(usuario)
    nome = (payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do fornecedor obrigatório.")
    if fornecedor_id:
        fornecedor = (
            await db.execute(
                select(ComprasFornecedorDB).where(
                    ComprasFornecedorDB.id == fornecedor_id,
                    ComprasFornecedorDB.organizacao_id == _org_id(usuario),
                )
            )
        ).scalar_one_or_none()
        if not fornecedor:
            raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    else:
        fornecedor = ComprasFornecedorDB(organizacao_id=_org_id(usuario))
        db.add(fornecedor)
    fornecedor.nome = nome
    ids_cat = payload.get("categoria_ids")
    if isinstance(ids_cat, str):
        ids_cat = [p.strip() for p in ids_cat.split(",") if p.strip()]
    if ids_cat is None:
        ids_cat = [payload.get("categoria_id")] if payload.get("categoria_id") else []
    fornecedor.categoria_id = payload.get("categoria_id") or (ids_cat[0] if ids_cat else None)
    prazo = payload.get("prazo_entrega_dias")
    if prazo in (None, ""):
        fornecedor.prazo_entrega_dias = None
    else:
        try:
            dias = int(prazo)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Prazo de entrega inválido.")
        if dias < 0 or dias > 365:
            raise HTTPException(status_code=400, detail="Prazo de entrega deve ser entre 0 e 365 dias.")
        fornecedor.prazo_entrega_dias = dias
    fornecedor.cnpj = payload.get("cnpj") or None
    fornecedor.segmento = payload.get("segmento") or None
    fornecedor.contato = payload.get("contato") or None
    telefone_bruto = payload.get("telefone")
    if telefone_bruto and str(telefone_bruto).strip():
        tel_principal, tel_extras = sanitizar_telefone_compras(telefone_bruto)
        if not tel_principal:
            raise HTTPException(
                status_code=400,
                detail="Telefone inválido. Informe DDD e número completos (SP: 11).",
            )
        fornecedor.telefone = tel_principal
        if tel_extras:
            extras_txt = " / ".join(formatar_telefone_compras(t) for t in tel_extras)
            obs_atual = fornecedor.observacao or payload.get("observacao") or ""
            if extras_txt not in obs_atual:
                obs_nova = f"{obs_atual} | Tel. adicional: {extras_txt}".strip(" |")
                fornecedor.observacao = obs_nova
                payload["observacao"] = obs_nova
    else:
        fornecedor.telefone = None
    fornecedor.email = payload.get("email") or None
    fornecedor.email_empresa = payload.get("email_empresa") or None
    fornecedor.cep = re.sub(r"\D", "", payload.get("cep") or "") or None
    fornecedor.logradouro = (payload.get("logradouro") or "").strip() or None
    fornecedor.numero = (payload.get("numero") or "").strip() or None
    fornecedor.complemento = (payload.get("complemento") or "").strip() or None
    fornecedor.bairro = (payload.get("bairro") or "").strip() or None
    fornecedor.cidade = (payload.get("cidade") or "").strip() or None
    uf = (payload.get("uf") or "").strip().upper()
    fornecedor.uf = uf or None
    if "atende_geral" in payload or "projeto_ids" in payload:
        atende_geral = bool(payload.get("atende_geral", True))
        projeto_ids = payload.get("projeto_ids") or []
        if isinstance(projeto_ids, str):
            projeto_ids = [p.strip() for p in projeto_ids.split(",") if p.strip()]
        await _sync_projetos_fornecedor(
            db,
            fornecedor,
            atende_geral=atende_geral,
            projeto_ids=list(projeto_ids),
            org_id=_org_id(usuario),
        )
    elif payload.get("projetos_atendidos") is not None and not fornecedor_id:
        fornecedor.projetos_atendidos = payload.get("projetos_atendidos") or None
    if "ativo" in payload:
        fornecedor.ativo = bool(payload["ativo"])
    if "bloqueado" in payload:
        fornecedor.bloqueado = bool(payload["bloqueado"])
    fornecedor.observacao = payload.get("observacao") or None
    await db.flush()
    await _sync_categorias_fornecedor(db, fornecedor, list(ids_cat or []), _org_id(usuario))
    fornecedor.atualizado_em = agora_operacional_naive()
    return fornecedor


async def importar_fornecedores_planilha(
    db: AsyncSession,
    usuario: dict,
    conteudo: bytes,
    nome_arquivo: str,
) -> dict:
    from compras_fornecedores_planilha import (
        extrair_linhas_fornecedores,
        linha_para_payload,
        mesclar_payload_fornecedor,
        _norm_chave_nome,
    )

    exigir_sede(usuario)
    org_id = _org_id(usuario)
    linhas = extrair_linhas_fornecedores(conteudo, nome_arquivo)
    if not linhas:
        raise HTTPException(status_code=400, detail="Nenhum fornecedor encontrado na planilha.")

    existentes = (
        await db.execute(
            select(ComprasFornecedorDB).where(ComprasFornecedorDB.organizacao_id == org_id)
        )
    ).scalars().all()
    indice = {_norm_chave_nome(f.nome): f for f in existentes}

    importados = 0
    atualizados = 0
    ignorados = 0
    for linha in linhas:
        chave = _norm_chave_nome(linha.nome)
        if not chave:
            ignorados += 1
            continue
        atual = indice.get(chave)
        if atual:
            payload = mesclar_payload_fornecedor(_serializar_fornecedor(atual), linha)
            await salvar_fornecedor(db, usuario, payload, atual.id)
            atualizados += 1
            continue
        payload = linha_para_payload(linha)
        novo = await salvar_fornecedor(db, usuario, payload)
        indice[chave] = novo
        importados += 1

    return {
        "total_linhas": len(linhas),
        "importados": importados,
        "atualizados": atualizados,
        "ignorados": ignorados,
    }


async def _contagem_itens_por_categoria(db: AsyncSession, organizacao_id: str) -> dict[str, int]:
    rows = (
        await db.execute(
            select(ComprasItemConsumoDB.categoria_id, func.count())
            .where(
                ComprasItemConsumoDB.organizacao_id == organizacao_id,
                ComprasItemConsumoDB.categoria_id.is_not(None),
            )
            .group_by(ComprasItemConsumoDB.categoria_id)
        )
    ).all()
    return {row[0]: int(row[1]) for row in rows}


async def listar_categorias(db: AsyncSession, usuario: dict) -> list[dict]:
    org_id = _org_id(usuario)
    rows = (
        await db.execute(
            select(ComprasCategoriaDB)
            .where(ComprasCategoriaDB.organizacao_id == org_id)
            .order_by(ComprasCategoriaDB.nome.asc())
        )
    ).scalars().all()
    contagem = await _contagem_itens_por_categoria(db, org_id)
    saida = [
        {
            "id": r.id,
            "nome": r.nome,
            "segmento": normalizar_segmento_catalogo(getattr(r, "segmento", None) or SEGMENTO_CONSUMO),
            "ativo": bool(r.ativo),
            "qtd_itens": contagem.get(r.id, 0),
            "ordem": int(getattr(r, "ordem", 0) or 0),
        }
        for r in rows
    ]
    saida.sort(key=lambda item: (item["ordem"], -item["qtd_itens"], (item["nome"] or "").lower()))
    return saida


async def _nomes_categorias_org(
    db: AsyncSession, organizacao_id: str, *, ignorar_id: Optional[str] = None
) -> list[str]:
    rows = (
        await db.execute(
            select(ComprasCategoriaDB).where(ComprasCategoriaDB.organizacao_id == organizacao_id)
        )
    ).scalars().all()
    return [r.nome for r in rows if r.id != ignorar_id]


def _recusar_nome_semelhante(*, tipo: str, nome: str, existentes: list[str]) -> None:
    exato = nome_cadastro_exato(nome, existentes)
    if exato:
        raise HTTPException(
            status_code=400,
            detail=f'Já existe {tipo} "{exato}". Use a existente para não duplicar.',
        )
    semelhantes = nomes_cadastro_semelhantes(nome, existentes)
    if semelhantes:
        raise HTTPException(
            status_code=400,
            detail=mensagem_nome_semelhante(tipo=tipo, semelhantes=semelhantes),
        )


async def salvar_categoria(db: AsyncSession, usuario: dict, payload: dict, categoria_id: Optional[str] = None):
    exigir_cadastro_mestre_compras(usuario)
    nome = (payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da categoria obrigatório.")
    org_id = _org_id(usuario)
    existentes = await _nomes_categorias_org(db, org_id, ignorar_id=categoria_id)
    _recusar_nome_semelhante(tipo="categoria", nome=nome, existentes=existentes)
    if categoria_id:
        row = (
            await db.execute(
                select(ComprasCategoriaDB).where(
                    ComprasCategoriaDB.id == categoria_id,
                    ComprasCategoriaDB.organizacao_id == org_id,
                )
            )
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Categoria não encontrada.")
    else:
        row = ComprasCategoriaDB(organizacao_id=org_id)
        db.add(row)
    row.nome = nome
    if "segmento" in payload and payload.get("segmento") is not None:
        row.segmento = normalizar_segmento_catalogo(payload.get("segmento"))
    elif not categoria_id:
        row.segmento = inferir_segmento_por_nome_categoria(nome)
    elif not getattr(row, "segmento", None):
        row.segmento = inferir_segmento_por_nome_categoria(nome)
    if "ativo" in payload:
        row.ativo = bool(payload["ativo"])
    return row


def _serializar_item_consumo(row: ComprasItemConsumoDB, categorias: dict) -> dict:
    meta = categorias.get(row.categoria_id) if row.categoria_id else None
    if isinstance(meta, dict):
        cat_nome = meta.get("nome")
        segmento = normalizar_segmento_catalogo(meta.get("segmento") or SEGMENTO_CONSUMO)
    else:
        cat_nome = meta
        segmento = SEGMENTO_CONSUMO
    return {
        "id": row.id,
        "categoria_id": row.categoria_id,
        "categoria_nome": cat_nome,
        "segmento": segmento,
        "competencia_orcamento": normalizar_competencia_orcamento(
            getattr(row, "competencia_orcamento", None) or competencia_padrao_do_segmento(segmento)
        ),
        "descricao": row.descricao,
        "chave": row.chave,
        "unidade_medida": sanitizar_unidade_medida(row.unidade_medida),
        "embalagem": getattr(row, "embalagem", None),
        "marca_preferencial": row.marca_preferencial,
        "sinonimos": getattr(row, "sinonimos", None),
        "fator_embalagem": getattr(row, "fator_embalagem", None),
        "perecivel": bool(getattr(row, "perecivel", False)),
        "equivalente_item_id": getattr(row, "equivalente_item_id", None),
        "observacao": row.observacao,
        "ativo": bool(row.ativo),
        "atualizado_em": _iso(row.atualizado_em),
    }


async def _mapa_nomes_categoria(db: AsyncSession, organizacao_id: str) -> dict[str, dict]:
    rows = (
        await db.execute(
            select(
                ComprasCategoriaDB.id,
                ComprasCategoriaDB.nome,
                ComprasCategoriaDB.segmento,
            ).where(ComprasCategoriaDB.organizacao_id == organizacao_id)
        )
    ).all()
    return {
        row[0]: {
            "nome": row[1],
            "segmento": normalizar_segmento_catalogo(row[2] or SEGMENTO_CONSUMO),
        }
        for row in rows
    }


async def listar_itens_consumo(db: AsyncSession, usuario: dict, ativos: Optional[bool] = None) -> list[dict]:
    filtros = [ComprasItemConsumoDB.organizacao_id == _org_id(usuario)]
    if ativos is True:
        filtros.append(ComprasItemConsumoDB.ativo.is_(True))
    elif ativos is False:
        filtros.append(ComprasItemConsumoDB.ativo.is_(False))
    rows = (
        await db.execute(
            select(ComprasItemConsumoDB)
            .where(*filtros)
            .order_by(ComprasItemConsumoDB.descricao.asc())
        )
    ).scalars().all()
    cats = await _mapa_nomes_categoria(db, _org_id(usuario))
    return [_serializar_item_consumo(r, cats) for r in rows]


async def salvar_item_consumo(db: AsyncSession, usuario: dict, payload: dict, item_id: Optional[str] = None):
    org_id = _org_id(usuario)
    pode_mestre = usuario_pode_cadastrar_mestre_compras(
        perfil=_perfil(usuario),
        is_manutencao=bool(usuario.get("is_manutencao")),
    )

    # Projeto/unidade sem ADM Pedidos: só atualiza embalagem/marca de item já cadastrado (via pedido).
    if not pode_mestre:
        if not item_id:
            raise HTTPException(
                status_code=403,
                detail="Sem permissão para cadastrar item novo. Escolha um do cadastro ou peça à Sede/ADM Pedidos.",
            )
        row = (
            await db.execute(
                select(ComprasItemConsumoDB).where(
                    ComprasItemConsumoDB.id == item_id,
                    ComprasItemConsumoDB.organizacao_id == org_id,
                )
            )
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Item não encontrado.")
        limpo_parcial = limpar_item_consumo(
            descricao=row.descricao or "",
            unidade_medida=row.unidade_medida or "",
            marca_preferencial=(
                payload.get("marca_preferencial")
                if "marca_preferencial" in payload
                else (row.marca_preferencial or "")
            ),
            observacao=row.observacao or "",
            embalagem=(
                payload.get("embalagem")
                if "embalagem" in payload
                else (getattr(row, "embalagem", None) or "")
            ),
        )
        if "embalagem" in payload:
            row.embalagem = limpo_parcial["embalagem"] or None
            if getattr(row, "fator_embalagem", None) is None:
                row.fator_embalagem = inferir_fator_embalagem(row.embalagem)
        if "marca_preferencial" in payload:
            row.marca_preferencial = limpo_parcial["marca_preferencial"] or None
        row.atualizado_em = agora_operacional_naive()
        return row

    limpo = limpar_item_consumo(
        descricao=(payload.get("descricao") or "").strip(),
        unidade_medida=payload.get("unidade_medida") or "",
        marca_preferencial=payload.get("marca_preferencial") or "",
        observacao=payload.get("observacao") or "",
        embalagem=payload.get("embalagem") or "",
    )
    if limpo["lixo"] or not limpo["descricao"]:
        raise HTTPException(status_code=400, detail="Descrição do item inválida.")
    descricao = limpo["descricao"]
    chave = limpo["chave"] or chave_item_consumo(descricao)
    extra = [ComprasItemConsumoDB.id != item_id] if item_id else []
    duplicado = (
        await db.execute(
            select(ComprasItemConsumoDB).where(
                ComprasItemConsumoDB.organizacao_id == org_id,
                ComprasItemConsumoDB.chave == chave,
                *extra,
            )
        )
    ).scalar_one_or_none()
    if duplicado:
        raise HTTPException(
            status_code=400,
            detail=f"Já existe item semelhante no cadastro: {duplicado.descricao}.",
        )
    if item_id:
        row = (
            await db.execute(
                select(ComprasItemConsumoDB).where(
                    ComprasItemConsumoDB.id == item_id,
                    ComprasItemConsumoDB.organizacao_id == org_id,
                )
            )
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Item não encontrado.")
    else:
        row = ComprasItemConsumoDB(organizacao_id=org_id)
        db.add(row)
    row.descricao = descricao
    row.chave = chave
    row.categoria_id = payload.get("categoria_id") or None
    row.unidade_medida = limpo["unidade_medida"]
    row.embalagem = limpo["embalagem"]
    row.marca_preferencial = limpo["marca_preferencial"]
    row.observacao = limpo["observacao"]
    row.sinonimos = (payload.get("sinonimos") or "").strip() or None
    cats = await _mapa_nomes_categoria(db, org_id)
    seg_item = SEGMENTO_CONSUMO
    if row.categoria_id and row.categoria_id in cats:
        seg_item = normalizar_segmento_catalogo((cats[row.categoria_id] or {}).get("segmento"))
    if "competencia_orcamento" in payload and payload.get("competencia_orcamento") is not None:
        row.competencia_orcamento = normalizar_competencia_orcamento(payload.get("competencia_orcamento"))
    elif not item_id or not getattr(row, "competencia_orcamento", None):
        row.competencia_orcamento = competencia_padrao_do_segmento(seg_item)
    fator = payload.get("fator_embalagem")
    if fator in (None, ""):
        if getattr(row, "fator_embalagem", None) is None:
            row.fator_embalagem = inferir_fator_embalagem(row.embalagem)
    else:
        try:
            row.fator_embalagem = float(str(fator).replace(",", "."))
        except ValueError:
            raise HTTPException(status_code=400, detail="Quantidade na embalagem inválida.")
    if "perecivel" in payload and payload.get("perecivel") is not None:
        row.perecivel = bool(payload.get("perecivel"))
    elif not item_id:
        row.perecivel = inferir_perecivel(
            categoria_nome=(cats.get(row.categoria_id) or {}).get("nome") if row.categoria_id else None,
            descricao=row.descricao,
        )
    eq_id = (payload.get("equivalente_item_id") or "").strip() or None
    if eq_id:
        if eq_id == (item_id or row.id):
            raise HTTPException(status_code=400, detail="Item equivalente não pode ser o próprio cadastro.")
        eq_row = (
            await db.execute(
                select(ComprasItemConsumoDB.id).where(
                    ComprasItemConsumoDB.id == eq_id,
                    ComprasItemConsumoDB.organizacao_id == org_id,
                )
            )
        ).scalar_one_or_none()
        if not eq_row:
            raise HTTPException(status_code=400, detail="Item equivalente inválido.")
    row.equivalente_item_id = eq_id
    if "ativo" in payload:
        row.ativo = bool(payload["ativo"])
    row.atualizado_em = agora_operacional_naive()
    return row


async def importar_itens_consumo(db: AsyncSession, usuario: dict, linhas) -> dict:
    exigir_sede(usuario)
    org_id = _org_id(usuario)
    await garantir_cadastros_padrao(db, org_id)
    cats = (
        await db.execute(
            select(ComprasCategoriaDB).where(ComprasCategoriaDB.organizacao_id == org_id)
        )
    ).scalars().all()
    por_nome = {(c.nome or "").strip().lower(): c for c in cats}
    existentes = (
        await db.execute(
            select(ComprasItemConsumoDB).where(ComprasItemConsumoDB.organizacao_id == org_id)
        )
    ).scalars().all()
    por_chave = {r.chave: r for r in existentes}
    criados = atualizados = ignorados = 0
    for linha in linhas:
        limpo = limpar_item_consumo(
            descricao=(linha.descricao or "").strip(),
            unidade_medida=linha.unidade_medida or "",
            marca_preferencial=linha.marca_preferencial or "",
            observacao=linha.observacao or "",
        )
        if limpo["lixo"] or not limpo["descricao"]:
            ignorados += 1
            continue
        chave = limpo["chave"]
        categoria = None
        nome_cat = (linha.categoria or "").strip()
        if nome_cat:
            nomes_existentes = [c.nome for c in por_nome.values()]
            canonico = resolver_nome_cadastro(nome_cat, nomes_existentes)
            if canonico:
                categoria = por_nome.get(canonico.lower())
            elif not nomes_cadastro_semelhantes(nome_cat, nomes_existentes):
                categoria = ComprasCategoriaDB(organizacao_id=org_id, nome=nome_cat, ativo=True)
                db.add(categoria)
                await db.flush()
                por_nome[nome_cat.lower()] = categoria
        row = por_chave.get(chave)
        if row is None:
            row = ComprasItemConsumoDB(organizacao_id=org_id, chave=chave)
            db.add(row)
            por_chave[chave] = row
            criados += 1
        else:
            atualizados += 1
        row.descricao = limpo["descricao"]
        row.chave = chave
        row.categoria_id = categoria.id if categoria else row.categoria_id
        row.unidade_medida = limpo["unidade_medida"] or row.unidade_medida
        row.embalagem = limpo["embalagem"] or getattr(row, "embalagem", None)
        row.marca_preferencial = limpo["marca_preferencial"] or row.marca_preferencial
        row.observacao = limpo["observacao"] if limpo["observacao"] is not None else row.observacao
        row.ativo = bool(linha.ativo)
        if getattr(row, "fator_embalagem", None) is None:
            row.fator_embalagem = inferir_fator_embalagem(getattr(row, "embalagem", None))
        if not getattr(row, "perecivel", False):
            row.perecivel = inferir_perecivel(
                categoria_nome=categoria.nome if categoria else None,
                descricao=row.descricao,
            )
        row.atualizado_em = agora_operacional_naive()
    return {
        "criados": criados,
        "atualizados": atualizados,
        "ignorados": ignorados,
        "total": criados + atualizados,
    }


async def sanear_itens_consumo(db: AsyncSession, usuario: dict) -> dict:
    exigir_sede(usuario)
    org_id = _org_id(usuario)
    rows = list(
        (
            await db.execute(
                select(ComprasItemConsumoDB).where(ComprasItemConsumoDB.organizacao_id == org_id)
            )
        ).scalars().all()
    )
    grupos: dict[str, list] = {}
    excluidos = 0
    agora = agora_operacional_naive()
    for row in rows:
        limpo = limpar_item_consumo(
            descricao=row.descricao or "",
            unidade_medida=row.unidade_medida or "",
            marca_preferencial=row.marca_preferencial or "",
            observacao=row.observacao or "",
            embalagem=getattr(row, "embalagem", None) or "",
        )
        if limpo["lixo"] or not limpo["descricao"]:
            await db.execute(
                update(ComprasPedidoItemDB)
                .where(ComprasPedidoItemDB.catalogo_item_id == row.id)
                .values(catalogo_item_id=None)
            )
            await db.delete(row)
            excluidos += 1
            continue
        grupos.setdefault(limpo["chave"], []).append((row, limpo))
    await db.flush()

    limpos = mesclados = 0
    for chave, itens in grupos.items():
        keeper, limpo = itens[0]
        for extra, extra_limpo in itens[1:]:
            if not limpo["embalagem"] and extra_limpo["embalagem"]:
                limpo["embalagem"] = extra_limpo["embalagem"]
            if not limpo["unidade_medida"] and extra_limpo["unidade_medida"]:
                limpo["unidade_medida"] = extra_limpo["unidade_medida"]
            if not limpo["marca_preferencial"] and extra_limpo["marca_preferencial"]:
                limpo["marca_preferencial"] = extra_limpo["marca_preferencial"]
            await db.execute(
                update(ComprasPedidoItemDB)
                .where(ComprasPedidoItemDB.catalogo_item_id == extra.id)
                .values(catalogo_item_id=keeper.id)
            )
            await db.delete(extra)
            mesclados += 1
        await db.flush()
        keeper.descricao = limpo["descricao"]
        keeper.chave = chave
        keeper.embalagem = limpo["embalagem"]
        keeper.unidade_medida = limpo["unidade_medida"]
        keeper.marca_preferencial = limpo["marca_preferencial"]
        keeper.observacao = limpo["observacao"]
        keeper.atualizado_em = agora
        limpos += 1
    return {"limpos": limpos, "excluidos": excluidos, "mesclados": mesclados}


async def listar_fontes(db: AsyncSession, usuario: dict) -> list[dict]:
    org_id = _org_id(usuario)
    rows = (
        await db.execute(
            select(ComprasFonteRecursoDB)
            .where(ComprasFonteRecursoDB.organizacao_id == org_id)
            .order_by(ComprasFonteRecursoDB.nome.asc())
        )
    ).scalars().all()
    contagem = {
        row[0]: int(row[1])
        for row in (
            await db.execute(
                select(ComprasPedidoDB.fonte_recurso_id, func.count())
                .where(
                    ComprasPedidoDB.organizacao_id == org_id,
                    ComprasPedidoDB.fonte_recurso_id.is_not(None),
                )
                .group_by(ComprasPedidoDB.fonte_recurso_id)
            )
        ).all()
    }
    saida = [
        {
            "id": r.id,
            "nome": r.nome,
            "ativo": bool(r.ativo),
            "tipo": getattr(r, "tipo", None) or inferir_tipo_fonte(r.nome),
            "vigencia_inicio": r.vigencia_inicio.isoformat() if getattr(r, "vigencia_inicio", None) else None,
            "vigencia_fim": r.vigencia_fim.isoformat() if getattr(r, "vigencia_fim", None) else None,
            "qtd_pedidos": contagem.get(r.id, 0),
        }
        for r in rows
    ]
    saida.sort(key=lambda item: (-item["qtd_pedidos"], (item["nome"] or "").lower()))
    return saida


async def salvar_fonte(db: AsyncSession, usuario: dict, payload: dict, fonte_id: Optional[str] = None):
    exigir_sede(usuario)
    nome = (payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da fonte obrigatório.")
    org_id = _org_id(usuario)
    existentes = [
        r.nome
        for r in (
            await db.execute(
                select(ComprasFonteRecursoDB).where(ComprasFonteRecursoDB.organizacao_id == org_id)
            )
        ).scalars().all()
        if r.id != fonte_id
    ]
    _recusar_nome_semelhante(tipo="fonte", nome=nome, existentes=existentes)
    if fonte_id:
        row = (
            await db.execute(
                select(ComprasFonteRecursoDB).where(
                    ComprasFonteRecursoDB.id == fonte_id,
                    ComprasFonteRecursoDB.organizacao_id == org_id,
                )
            )
        ).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Fonte não encontrada.")
    else:
        row = ComprasFonteRecursoDB(organizacao_id=org_id)
        db.add(row)
    row.nome = nome
    row.tipo = normalizar_tipo_fonte(payload.get("tipo"), nome=nome)
    row.vigencia_inicio = parse_data_aquisicao(payload.get("vigencia_inicio"))
    row.vigencia_fim = parse_data_aquisicao(payload.get("vigencia_fim"))
    if "ativo" in payload:
        row.ativo = bool(payload["ativo"])
    return row


async def listar_patrimonio(db: AsyncSession, usuario: dict) -> list[dict]:
    filtros = [ComprasPatrimonioDB.organizacao_id == _org_id(usuario)]
    if not _sede(usuario):
        filtros.append(ComprasPatrimonioDB.instituicao_id == usuario.get("instituicao_id"))
    rows = (
        await db.execute(
            select(ComprasPatrimonioDB)
            .where(*filtros)
            .order_by(ComprasPatrimonioDB.descricao.asc())
        )
    ).scalars().all()
    nomes = await _nomes_instituicao(db, [r.instituicao_id for r in rows if r.instituicao_id])
    org_nome = await _nome_organizacao(db, _org_id(usuario))
    cats = await _mapa_nomes_categoria(db, _org_id(usuario))
    return [_serializar_patrimonio(r, nomes, org_nome, cats) for r in rows]


def _serializar_patrimonio(
    r: ComprasPatrimonioDB,
    nomes: dict[str, str],
    org_nome: Optional[str],
    categorias: Optional[dict] = None,
) -> dict:
    escopo = getattr(r, "escopo_unidade", ESCOPO_PROJETO) or ESCOPO_PROJETO
    inst_nome = rotulo_unidade_relatorio(
        escopo_unidade=ESCOPO_SEDE if pedido_escopo_sede(escopo) or not r.instituicao_id else ESCOPO_PROJETO,
        instituicao_nome=nomes.get(r.instituicao_id) if r.instituicao_id else None,
        organizacao_nome=org_nome,
    )
    if pedido_escopo_sede(escopo) or not r.instituicao_id:
        inst_nome = rotulo_unidade_relatorio(
            escopo_unidade=ESCOPO_SEDE,
            instituicao_nome=None,
            organizacao_nome=org_nome,
        )
    cat_id = getattr(r, "categoria_id", None)
    cat_meta = (categorias or {}).get(cat_id) if cat_id else None
    cat_nome = cat_meta.get("nome") if isinstance(cat_meta, dict) else cat_meta
    return {
        "id": r.id,
        "instituicao_id": r.instituicao_id,
        "instituicao_nome": inst_nome,
        "escopo_unidade": escopo if r.instituicao_id else ESCOPO_SEDE,
        "pedido_id": r.pedido_id,
        "descricao": r.descricao,
        "numero_etiqueta": r.numero_etiqueta,
        "localizacao": r.localizacao,
        "departamento": r.departamento,
        "propriedade": r.propriedade or "aeb",
        "documento_nf": r.documento_nf,
        "valor_centavos": r.valor_centavos,
        "origem": r.origem or PATRIMONIO_ORIGEM_COMPRA,
        "forma_aquisicao": r.forma_aquisicao,
        "data_aquisicao": r.data_aquisicao.isoformat() if r.data_aquisicao else None,
        "situacao": r.situacao or PATRIMONIO_SITUACAO_BOM,
        "motivo_baixa": r.motivo_baixa,
        "data_baixa": r.data_baixa.isoformat() if r.data_baixa else None,
        "observacao": r.observacao,
        "categoria_id": cat_id,
        "categoria_nome": cat_nome,
        "criado_em": _iso(r.criado_em),
    }


async def salvar_patrimonio(
    db: AsyncSession,
    usuario: dict,
    payload: dict,
    item_id: Optional[str] = None,
) -> ComprasPatrimonioDB:
    descricao = (payload.get("descricao") or "").strip()
    if not descricao:
        raise HTTPException(status_code=400, detail="Informe a descrição do bem.")

    if item_id:
        item = (
            await db.execute(
                select(ComprasPatrimonioDB).where(
                    ComprasPatrimonioDB.id == item_id,
                    ComprasPatrimonioDB.organizacao_id == _org_id(usuario),
                )
            )
        ).scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=404, detail="Bem não encontrado.")
        if not _sede(usuario) and item.instituicao_id != usuario.get("instituicao_id"):
            raise HTTPException(status_code=403, detail="Sem permissão para editar este bem.")
    else:
        item = ComprasPatrimonioDB(organizacao_id=_org_id(usuario), descricao=descricao)
        db.add(item)

    item.descricao = descricao

    if _sede(usuario):
        escopo = normalizar_escopo_unidade(payload.get("escopo_unidade") or ESCOPO_PROJETO)
        instituicao_id = payload.get("instituicao_id") or None
        if pedido_escopo_sede(escopo):
            instituicao_id = None
        elif not instituicao_id:
            raise HTTPException(status_code=400, detail="Selecione o projeto do bem.")
        else:
            inst = (
                await db.execute(
                    select(InstituicaoDB.id).where(
                        InstituicaoDB.id == instituicao_id,
                        InstituicaoDB.organizacao_id == _org_id(usuario),
                    )
                )
            ).scalar_one_or_none()
            if not inst:
                raise HTTPException(status_code=400, detail="Projeto inválido.")
        item.escopo_unidade = escopo
        item.instituicao_id = instituicao_id
    else:
        inst_id = usuario.get("instituicao_id")
        if not inst_id:
            raise HTTPException(status_code=400, detail="Usuário sem projeto vinculado.")
        item.escopo_unidade = ESCOPO_PROJETO
        item.instituicao_id = inst_id

    item.numero_etiqueta = (payload.get("numero_etiqueta") or "").strip() or None
    item.localizacao = (payload.get("localizacao") or "").strip() or None
    item.departamento = (payload.get("departamento") or "").strip() or None
    item.propriedade = normalizar_propriedade(payload.get("propriedade"))
    item.origem = normalizar_origem(payload.get("origem"))
    item.forma_aquisicao = (payload.get("forma_aquisicao") or "").strip() or None
    item.documento_nf = (payload.get("documento_nf") or "").strip() or None
    item.data_aquisicao = parse_data_aquisicao(payload.get("data_aquisicao"))
    item.situacao = normalizar_situacao(payload.get("situacao"), data_baixa=payload.get("data_baixa"))
    item.motivo_baixa = (payload.get("motivo_baixa") or "").strip() or None
    item.data_baixa = parse_data_aquisicao(payload.get("data_baixa"))
    item.observacao = (payload.get("observacao") or "").strip() or None
    item.categoria_id = (payload.get("categoria_id") or "").strip() or None
    if "valor_centavos" in payload and payload.get("valor_centavos") is not None:
        item.valor_centavos = int(payload["valor_centavos"])
    elif payload.get("valor_reais") not in (None, ""):
        item.valor_centavos = reais_para_centavos(payload.get("valor_reais"))
    item.atualizado_em = agora_operacional_naive()
    return item


async def relatorio_economia(
    db: AsyncSession,
    usuario: dict,
    competencia: Optional[str] = None,
) -> dict:
    exigir_sede(usuario)
    filtros = [
        ComprasPedidoDB.organizacao_id == _org_id(usuario),
        ComprasPedidoDB.status.in_({STATUS_APROVADO, STATUS_ENVIADO, STATUS_RECEBIDO}),
    ]
    if competencia:
        filtros.append(ComprasPedidoDB.competencia == normalizar_competencia(competencia))
    pedidos = (
        await db.execute(select(ComprasPedidoDB).where(*filtros))
    ).scalars().all()
    total_escolhida = 0
    total_vs_maior = 0
    total_vs_media = 0
    linhas = []
    for pedido in pedidos:
        cotacoes = await _cotacoes_do_pedido(db, pedido.id)
        escolhida = next((c for c in cotacoes if c.escolhida), None)
        eco = economia_centavos(
            [c.valor_centavos for c in cotacoes],
            escolhida.valor_centavos if escolhida else None,
        )
        total_escolhida += escolhida.valor_centavos if escolhida else 0
        total_vs_maior += eco["economia_vs_maior_centavos"]
        total_vs_media += eco["economia_vs_media_centavos"]
        linhas.append({
            "pedido_id": pedido.id,
            "competencia": pedido.competencia,
            "tipo": pedido.tipo,
            "escopo_unidade": getattr(pedido, "escopo_unidade", ESCOPO_PROJETO),
            "instituicao_id": pedido.instituicao_id,
            "instituicao_nome": await _rotulo_unidade_pedido(db, pedido),
            "valor_escolhida_centavos": escolhida.valor_centavos if escolhida else 0,
            **eco,
        })
    return {
        "competencia": competencia,
        "pedidos": len(linhas),
        "total_escolhida_centavos": total_escolhida,
        "economia_vs_maior_centavos": total_vs_maior,
        "economia_vs_media_centavos": total_vs_media,
        "linhas": linhas,
    }


def sugestao_janela(competencia: str, *, semana: Optional[int] = None) -> dict:
    competencia_n = normalizar_competencia(competencia)
    ano, mes = map(int, competencia_n.split("-"))
    if semana is not None:
        inicio, fim = periodo_semana_util_mes(ano, mes, semana)
    else:
        inicio, fim = sugerir_janela_competencia(ano, mes)
    return {
        "competencia": competencia_n,
        "data_inicio": inicio.isoformat(),
        "data_fim": fim.isoformat(),
        "semana": semana,
    }


async def definir_modulo_ativo(db: AsyncSession, usuario: dict, ativo: bool) -> dict:
    if not (
        _sede(usuario)
        or usuario.get("is_global")
        or _perfil(usuario) == "Global"
    ):
        raise HTTPException(status_code=403, detail="Somente Sede, Global ou Manutenção ativam o módulo.")
    org = (
        await db.execute(select(OrganizacaoDB).where(OrganizacaoDB.id == _org_id(usuario)))
    ).scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada.")
    org.compras_ativo = bool(ativo)
    if org.compras_ativo:
        await garantir_cadastros_padrao(db, org.id)
    return {"compras_ativo": bool(org.compras_ativo)}
