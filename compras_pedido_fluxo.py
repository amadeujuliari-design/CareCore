"""Timeline, anexos, NFs, reprovação e pedido de compra do módulo Compras."""

from __future__ import annotations

import os
import re
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from compras_itens_consumo_utils import embalagem_efetiva_pedido
from compras_nf_xml_utils import extrair_campos_nf_xml
from compras_pedido_pdf import (
    montar_pdf_aprovacao_orcamento_sede,
    montar_pdf_pedido_compra,
    montar_pdf_solicitacao_cotacao,
)
from compras_regras import (
    ESCOPO_PROJETO,
    PATRIMONIO_ORIGEM_COMPRA,
    PATRIMONIO_SITUACAO_BOM,
    STATUS_AGUARDANDO_COTACAO,
    STATUS_AGUARDANDO_SEDE,
    STATUS_AGUARDANDO_UNIDADE,
    STATUS_APROVADO,
    STATUS_CANCELADO,
    STATUS_EM_COTACAO,
    STATUS_ENVIADO,
    STATUS_RECEBIDO,
    STATUS_REPROVADO,
    STATUS_RASCUNHO,
    STATUS_TERMINAIS_PEDIDO,
    TIPO_CONSUMO,
    TIPO_ANEXO_NF_PDF,
    TIPO_ANEXO_NF_XML,
    TIPO_ANEXO_ORCAMENTO,
    TIPO_ANEXO_ORCAMENTO_ASSINADO,
    TIPO_ANEXO_PEDIDO_PDF,
    TIPO_ANEXO_RESPOSTA_FORNECEDOR,
    TIPO_EVENTO_ANEXO,
    TIPO_EVENTO_EMAIL,
    TIPO_EVENTO_ITENS,
    TIPO_EVENTO_ITENS_OK,
    TIPO_EVENTO_NEGATIVA,
    TIPO_EVENTO_OBSERVACAO,
    TIPO_EVENTO_OK,
    TIPO_EVENTO_PARECER,
    TIPO_EVENTO_STATUS,
    TIPO_IMOBILIZADO,
    TIPOS_ANEXO_PEDIDO,
    TIPOS_EVENTO_AGUARDAM_OK,
    TIPOS_EVENTO_PEDIDO,
    aviso_cotacoes_insuficientes,
    data_operacional,
    pedido_escopo_sede,
    pedido_itens_podem_editar,
    pedido_rascunho_pode_excluir,
    tipo_eh_cotacao_projeto,
    usuario_e_sede_compras,
    usuario_pode_aprovar_sede,
    usuario_pode_pedir,
)
from compras_upload_utils import remover_arquivo_compras, salvar_arquivo_compras
from email_utils import enviar_email_smtp_com_anexo
from models import (
    ComprasCotacaoDB,
    ComprasFornecedorDB,
    ComprasItemConsumoDB,
    ComprasPatrimonioDB,
    ComprasPedidoAnexoDB,
    ComprasPedidoDB,
    ComprasPedidoEventoDB,
    ComprasPedidoItemDB,
    ComprasPedidoNotaFiscalDB,
    InstituicaoDB,
    OrganizacaoDB,
)
from storage_uploads import (
    StorageErro,
    baixar_supabase_storage,
    extrair_bucket_caminho_storage,
    storage_supabase_configurado,
)
from time_operacional import agora_operacional_naive


_PADRAO_SOLICITACAO_COTACAO = re.compile(
    r"Pedido de cotação enviado para\s+(.+?)\s+<([^>]+)>(?:\s*\[id:([^\]]+)\])?",
    re.IGNORECASE,
)


def _fornecedores_solicitacao_dos_eventos(
    eventos: list[ComprasPedidoEventoDB],
    fornecedores: list[ComprasFornecedorDB],
) -> list[dict[str, str]]:
    """Extrai fornecedores a quem a Sede pediu cotação por e-mail (timeline)."""
    por_id = {f.id: f for f in fornecedores}
    por_email = {}
    for f in fornecedores:
        for campo in (f.email, f.email_empresa):
            em = (campo or "").strip().lower()
            if em:
                por_email[em] = f

    vistos: set[str] = set()
    saida: list[dict[str, str]] = []
    for ev in eventos:
        if ev.tipo != TIPO_EVENTO_EMAIL:
            continue
        texto = (ev.texto or "").strip()
        if "Pedido de cotação enviado" not in texto:
            continue
        m = _PADRAO_SOLICITACAO_COTACAO.search(texto)
        if not m:
            continue
        nome, email, fid = m.group(1).strip(), m.group(2).strip(), (m.group(3) or "").strip()
        forn = por_id.get(fid) if fid else None
        if not forn:
            forn = por_email.get(email.lower())
        chave = (forn.id if forn else email.lower())
        if chave in vistos:
            continue
        vistos.add(chave)
        saida.append({
            "id": forn.id if forn else "",
            "nome": (forn.nome if forn else nome) or nome,
            "email": (forn.email or forn.email_empresa if forn else email) or email,
        })
    return saida


def _uid(usuario: dict) -> str:
    return str(usuario.get("id") or usuario.get("usuario_id") or "")


def _iso(valor) -> Optional[str]:
    if valor is None:
        return None
    if isinstance(valor, date):
        return valor.isoformat()
    return valor.isoformat() if hasattr(valor, "isoformat") else str(valor)


async def registrar_evento_pedido(
    db: AsyncSession,
    *,
    pedido_id: str,
    tipo: str,
    texto: Optional[str] = None,
    usuario_id: Optional[str] = None,
    cotacao_id: Optional[str] = None,
    anexo_id: Optional[str] = None,
    status_anterior: Optional[str] = None,
    status_novo: Optional[str] = None,
    aguardando_confirmacao: Optional[bool] = None,
) -> ComprasPedidoEventoDB:
    if tipo not in TIPOS_EVENTO_PEDIDO:
        raise ValueError(f"Tipo de evento inválido: {tipo}")
    if aguardando_confirmacao is None:
        aguardando_confirmacao = tipo in TIPOS_EVENTO_AGUARDAM_OK
    evento = ComprasPedidoEventoDB(
        pedido_id=pedido_id,
        tipo=tipo,
        texto=(texto or "").strip() or None,
        usuario_id=usuario_id,
        cotacao_id=cotacao_id,
        anexo_id=anexo_id,
        status_anterior=status_anterior,
        status_novo=status_novo,
        aguardando_confirmacao=bool(aguardando_confirmacao),
    )
    db.add(evento)
    return evento


async def _cotacoes_ativas(db: AsyncSession, pedido_id: str) -> list[ComprasCotacaoDB]:
    rows = (
        await db.execute(
            select(ComprasCotacaoDB).where(ComprasCotacaoDB.pedido_id == pedido_id)
        )
    ).scalars().all()
    return [c for c in rows if getattr(c, "ativa", True)]


async def _anexos_pedido(db: AsyncSession, pedido_id: str) -> list[ComprasPedidoAnexoDB]:
    return list(
        (
            await db.execute(
                select(ComprasPedidoAnexoDB)
                .where(
                    ComprasPedidoAnexoDB.pedido_id == pedido_id,
                    ComprasPedidoAnexoDB.ativo.is_(True),
                )
                .order_by(ComprasPedidoAnexoDB.criado_em.desc())
            )
        ).scalars().all()
    )


async def _notas_pedido(db: AsyncSession, pedido_id: str) -> list[ComprasPedidoNotaFiscalDB]:
    return list(
        (
            await db.execute(
                select(ComprasPedidoNotaFiscalDB)
                .where(ComprasPedidoNotaFiscalDB.pedido_id == pedido_id)
                .order_by(ComprasPedidoNotaFiscalDB.criado_em.asc())
            )
        ).scalars().all()
    )


async def _eventos_pedido(db: AsyncSession, pedido_id: str) -> list[ComprasPedidoEventoDB]:
    return list(
        (
            await db.execute(
                select(ComprasPedidoEventoDB)
                .where(ComprasPedidoEventoDB.pedido_id == pedido_id)
                .order_by(ComprasPedidoEventoDB.criado_em.desc())
            )
        ).scalars().all()
    )


def _serializar_anexo(anexo: ComprasPedidoAnexoDB) -> dict:
    return {
        "id": anexo.id,
        "tipo": anexo.tipo,
        "nome_arquivo": anexo.nome_arquivo,
        "caminho_arquivo": anexo.caminho_arquivo,
        "content_type": anexo.content_type,
        "cotacao_id": anexo.cotacao_id,
        "nota_fiscal_id": anexo.nota_fiscal_id,
        "criado_em": _iso(anexo.criado_em),
    }


def _serializar_nota(nota: ComprasPedidoNotaFiscalDB) -> dict:
    return {
        "id": nota.id,
        "tipo_nf": nota.tipo_nf,
        "numero": nota.numero,
        "serie": nota.serie,
        "chave_acesso": nota.chave_acesso,
        "emitente_nome": nota.emitente_nome,
        "emitente_cnpj": nota.emitente_cnpj,
        "data_emissao": _iso(nota.data_emissao),
        "valor_centavos": nota.valor_centavos,
        "origem_dados": nota.origem_dados,
        "observacao": nota.observacao,
        "anexo_id": nota.anexo_id,
        "criado_em": _iso(nota.criado_em),
    }


def _serializar_evento(evento: ComprasPedidoEventoDB) -> dict:
    return {
        "id": evento.id,
        "tipo": evento.tipo,
        "texto": evento.texto,
        "usuario_id": evento.usuario_id,
        "cotacao_id": evento.cotacao_id,
        "anexo_id": evento.anexo_id,
        "status_anterior": evento.status_anterior,
        "status_novo": evento.status_novo,
        "aguardando_confirmacao": bool(getattr(evento, "aguardando_confirmacao", False)),
        "confirmado_em": _iso(getattr(evento, "confirmado_em", None)),
        "confirmado_por_id": getattr(evento, "confirmado_por_id", None),
        "criado_em": _iso(evento.criado_em),
    }


async def extras_serializacao_pedido(db: AsyncSession, pedido: ComprasPedidoDB) -> dict:
    cotacoes_todas = list(
        (
            await db.execute(
                select(ComprasCotacaoDB).where(ComprasCotacaoDB.pedido_id == pedido.id)
            )
        ).scalars().all()
    )
    cotacoes = [c for c in cotacoes_todas if getattr(c, "ativa", True)]
    anexos = await _anexos_pedido(db, pedido.id)
    notas = await _notas_pedido(db, pedido.id)
    eventos = await _eventos_pedido(db, pedido.id)
    qtd_anexos_todos = len(
        (
            await db.execute(
                select(ComprasPedidoAnexoDB.id).where(ComprasPedidoAnexoDB.pedido_id == pedido.id)
            )
        ).scalars().all()
    )
    fechado_por = pedido.reprovado_por_id or pedido.cancelado_por_id
    eventos_itens = [e for e in eventos if e.tipo == TIPO_EVENTO_ITENS]
    ultimo_itens = eventos_itens[0] if eventos_itens else None  # timeline já vem do mais recente
    tem_cotacao = bool(cotacoes)
    aviso_alteracao = None
    precisa_revisar = False
    if ultimo_itens and pedido_itens_podem_editar(pedido.status) and pedido.status != "rascunho":
        # Pendente enquanto o último evento relevante for alteração de itens (não o OK).
        for ev in eventos:
            if ev.tipo == TIPO_EVENTO_ITENS_OK:
                break
            if ev.tipo == TIPO_EVENTO_ITENS:
                precisa_revisar = True
                break
        if tem_cotacao:
            aviso_alteracao = (
                "Itens alterados após o envio/cotação. Confira se precisa reenviar a cotação "
                "aos fornecedores e anexar novo orçamento se o PDF anterior ficou desatualizado."
            )
        else:
            aviso_alteracao = (
                "Itens alterados após o envio do pedido. Confira a lista antes de solicitar cotação."
            )
        if ultimo_itens.texto:
            aviso_alteracao = f"{aviso_alteracao} Última alteração: {ultimo_itens.texto}"

    fornecedores_org = list(
        (
            await db.execute(
                select(ComprasFornecedorDB).where(
                    ComprasFornecedorDB.organizacao_id == pedido.organizacao_id,
                )
            )
        ).scalars().all()
    )
    fornecedores_solicitacao = _fornecedores_solicitacao_dos_eventos(eventos, fornecedores_org)
    qtd_orcamentos = len([c for c in cotacoes if getattr(c, "ativa", True)])
    email_pedido_ok = any(
        e.tipo == TIPO_EVENTO_EMAIL and (e.texto or "").startswith("E-mail enviado para")
        for e in eventos
    )

    return {
        "anexos": [_serializar_anexo(a) for a in anexos],
        "notas_fiscais": [_serializar_nota(n) for n in notas],
        "eventos": [_serializar_evento(e) for e in eventos],
        "aviso_cotacoes": aviso_cotacoes_insuficientes(len(cotacoes)),
        "aviso_alteracao_itens": aviso_alteracao,
        "precisa_revisar_cotacao": precisa_revisar,
        "pode_editar_itens": pedido_itens_podem_editar(pedido.status),
        "qtd_orcamentos": qtd_orcamentos,
        "pode_substituir_orcamento": False,  # preenchido em serializar_pedido com perfil
        "fornecedores_solicitacao": fornecedores_solicitacao,
        "motivo_reprovacao": pedido.motivo_reprovacao,
        "motivo_cancelamento": pedido.motivo_cancelamento,
        "status_anterior": pedido.status_anterior,
        "fechado_por_id": fechado_por,
        "pedido_compra_anexo_id": pedido.pedido_compra_anexo_id,
        "email_pedido_compra_enviado": bool(email_pedido_ok and pedido.pedido_compra_anexo_id),
        "pode_reabrir": pedido.status in {STATUS_REPROVADO, STATUS_CANCELADO},
        "pode_excluir": pedido_rascunho_pode_excluir(
            status=pedido.status,
            qtd_cotacoes=len(cotacoes_todas),
            qtd_anexos=qtd_anexos_todos,
            qtd_eventos=len(eventos),
            qtd_notas=len(notas),
        ),
    }


def ler_bytes_anexo(caminho: str) -> tuple[bytes, str]:
    caminho = (caminho or "").strip()
    if caminho.startswith("/storage/") or caminho.startswith("storage/"):
        parsed = extrair_bucket_caminho_storage(caminho.lstrip("/"))
        if not parsed:
            raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
        bucket, rel = parsed
        try:
            arquivo = baixar_supabase_storage(bucket, rel)
            return arquivo.conteudo, arquivo.content_type
        except StorageErro as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    rel = caminho.replace("\\", "/")
    if rel.startswith("/uploads/"):
        rel = rel[len("/uploads/"):]
    elif rel.startswith("uploads/"):
        rel = rel[len("uploads/"):]

    base = Path(__file__).resolve().parent / "uploads" / rel
    if not base.is_file():
        raise HTTPException(status_code=404, detail="Arquivo não encontrado no servidor.")
    return base.read_bytes(), "application/octet-stream"


async def upload_anexo_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    file: UploadFile,
    tipo: str,
    cotacao_id: Optional[str] = None,
    substituir_anexo_id: Optional[str] = None,
) -> ComprasPedidoAnexoDB:
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Processo encerrado não aceita novos anexos.")
    if tipo not in TIPOS_ANEXO_PEDIDO:
        raise HTTPException(status_code=400, detail="Tipo de anexo inválido.")

    conteudo = await file.read()
    caminho, nome_original, tamanho, content_type = await salvar_arquivo_compras(
        organizacao_id=pedido.organizacao_id,
        pedido_id=pedido.id,
        file=file,
        conteudo=conteudo,
    )

    if substituir_anexo_id:
        anterior = (
            await db.execute(
                select(ComprasPedidoAnexoDB).where(
                    ComprasPedidoAnexoDB.id == substituir_anexo_id,
                    ComprasPedidoAnexoDB.pedido_id == pedido.id,
                )
            )
        ).scalar_one_or_none()
        if anterior:
            anterior.ativo = False
            remover_arquivo_compras(anterior.caminho_arquivo)
    else:
        anterior = None

    anexo = ComprasPedidoAnexoDB(
        pedido_id=pedido.id,
        cotacao_id=cotacao_id,
        tipo=tipo,
        nome_arquivo=nome_original,
        caminho_arquivo=caminho,
        content_type=content_type or None,
        tamanho_bytes=tamanho,
        substituido_por_id=None,
        criado_por_id=_uid(usuario),
    )
    db.add(anexo)
    await db.flush()

    if substituir_anexo_id and anterior:
        anterior.substituido_por_id = anexo.id

    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_ANEXO,
        texto=f"Arquivo anexado com sucesso ({tipo}: {nome_original}). Aguardando ok.",
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
        cotacao_id=cotacao_id,
    )
    pedido.atualizado_em = agora_operacional_naive()
    return anexo


async def confirmar_evento_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    evento_id: str,
) -> ComprasPedidoEventoDB:
    """Confirma (Ok) um evento pendente na timeline — a outra parte reconhece a alteração."""
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Processo encerrado.")
    evento = (
        await db.execute(
            select(ComprasPedidoEventoDB).where(
                ComprasPedidoEventoDB.id == evento_id,
                ComprasPedidoEventoDB.pedido_id == pedido.id,
            )
        )
    ).scalar_one_or_none()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    if not getattr(evento, "aguardando_confirmacao", False):
        raise HTTPException(status_code=400, detail="Este evento não aguarda confirmação.")
    uid = _uid(usuario)
    if evento.usuario_id and evento.usuario_id == uid:
        raise HTTPException(
            status_code=400,
            detail="Quem registrou a alteração não confirma o próprio Ok — a outra parte deve confirmar.",
        )
    evento.aguardando_confirmacao = False
    evento.confirmado_em = agora_operacional_naive()
    evento.confirmado_por_id = uid
    nome = (
        (usuario.get("nome") or usuario.get("nome_completo") or usuario.get("email") or "Usuário")
    ).strip()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_OK if evento.tipo != TIPO_EVENTO_ITENS else TIPO_EVENTO_ITENS_OK,
        texto=f"{nome}: confirmou o registro na timeline.",
        usuario_id=uid,
        aguardando_confirmacao=False,
    )
    pedido.atualizado_em = agora_operacional_naive()
    return evento


async def registrar_comunicacao_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    tipo: str,
    texto: str,
    cotacao_id: Optional[str] = None,
) -> ComprasPedidoEventoDB:
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Processo encerrado.")
    if tipo not in {TIPO_EVENTO_PARECER, TIPO_EVENTO_NEGATIVA, TIPO_EVENTO_OBSERVACAO}:
        raise HTTPException(status_code=400, detail="Tipo de comunicação inválido.")
    mensagem = (texto or "").strip()
    if not mensagem:
        raise HTTPException(status_code=400, detail="Informe o texto.")
    evento = await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=tipo,
        texto=mensagem,
        usuario_id=_uid(usuario),
        cotacao_id=cotacao_id,
    )
    pedido.atualizado_em = agora_operacional_naive()
    return evento


async def confirmar_revisao_itens_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoEventoDB:
    """Marca que o usuário conferiu a última alteração de itens (baixa o aviso âmbar)."""
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Processo encerrado.")
    if not pedido_itens_podem_editar(pedido.status) or pedido.status == "rascunho":
        raise HTTPException(status_code=400, detail="Não há alteração de itens pendente de conferência.")
    nome = (
        (usuario.get("nome") or usuario.get("nome_completo") or usuario.get("email") or "Usuário")
    ).strip()
    evento = await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_ITENS_OK,
        texto=f"{nome}: conferiu a alteração dos itens.",
        usuario_id=_uid(usuario),
    )
    pedido.atualizado_em = agora_operacional_naive()
    return evento


async def reprovar_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    motivo: str,
) -> ComprasPedidoDB:
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Este pedido já está encerrado.")
    texto = (motivo or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Informe o motivo da reprovação.")
    anterior = pedido.status
    pedido.status_anterior = anterior
    pedido.status = STATUS_REPROVADO
    pedido.reprovado_em = agora_operacional_naive()
    pedido.reprovado_por_id = _uid(usuario)
    pedido.motivo_reprovacao = texto
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=texto,
        usuario_id=_uid(usuario),
        status_anterior=anterior,
        status_novo=STATUS_REPROVADO,
    )
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_NEGATIVA,
        texto=texto,
        usuario_id=_uid(usuario),
    )
    return pedido


async def reabrir_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    if pedido.status not in {STATUS_REPROVADO, STATUS_CANCELADO}:
        raise HTTPException(status_code=400, detail="Só pedidos reprovados ou cancelados podem ser reabertos.")
    fechador = pedido.reprovado_por_id if pedido.status == STATUS_REPROVADO else pedido.cancelado_por_id
    if fechador != _uid(usuario) and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=403, detail="Somente quem encerrou o processo pode reabri-lo.")
    if not pedido.status_anterior:
        raise HTTPException(status_code=400, detail="Estado anterior não registrado.")
    anterior_status = pedido.status
    novo = pedido.status_anterior
    pedido.status = novo
    pedido.status_anterior = None
    if anterior_status == STATUS_REPROVADO:
        pedido.reprovado_em = None
        pedido.reprovado_por_id = None
        pedido.motivo_reprovacao = None
    else:
        pedido.cancelado_em = None
        pedido.cancelado_por_id = None
        pedido.motivo_cancelamento = None
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto="Processo reaberto.",
        usuario_id=_uid(usuario),
        status_anterior=anterior_status,
        status_novo=novo,
    )
    return pedido


async def _dados_instituicao(db: AsyncSession, pedido: ComprasPedidoDB) -> Optional[dict]:
    if not pedido.instituicao_id:
        return None
    inst = (
        await db.execute(select(InstituicaoDB).where(InstituicaoDB.id == pedido.instituicao_id))
    ).scalar_one_or_none()
    if not inst:
        return None
    return {
        "nome": inst.nome_fantasia,
        "logradouro": inst.logradouro,
        "numero": inst.numero,
        "complemento": inst.complemento,
        "bairro": inst.bairro,
        "cidade": inst.cidade,
        "uf": inst.uf,
        "relatorio_logo_url": getattr(inst, "relatorio_logo_url", None),
        "relatorio_nome_exibicao": getattr(inst, "relatorio_nome_exibicao", None),
        "relatorio_rodape_linha1": getattr(inst, "relatorio_rodape_linha1", None),
        "relatorio_rodape_linha2": getattr(inst, "relatorio_rodape_linha2", None),
        "relatorio_telefone": getattr(inst, "relatorio_telefone", None) or getattr(inst, "telefone", None),
        "relatorio_email": getattr(inst, "relatorio_email", None) or getattr(inst, "email", None),
        "relatorio_site": getattr(inst, "relatorio_site", None),
        "email_adm_compras": getattr(inst, "email_adm_compras", None),
    }


def _identidade_de_entidade(entidade: Any) -> dict[str, Any]:
    return {
        "relatorio_logo_url": getattr(entidade, "relatorio_logo_url", None),
        "relatorio_nome_exibicao": getattr(entidade, "relatorio_nome_exibicao", None)
        or getattr(entidade, "nome_fantasia", None)
        or getattr(entidade, "nome", None),
        "relatorio_rodape_linha1": getattr(entidade, "relatorio_rodape_linha1", None),
        "relatorio_rodape_linha2": getattr(entidade, "relatorio_rodape_linha2", None),
        "relatorio_telefone": getattr(entidade, "relatorio_telefone", None)
        or getattr(entidade, "telefone", None),
        "relatorio_email": getattr(entidade, "relatorio_email", None) or getattr(entidade, "email", None),
        "relatorio_site": getattr(entidade, "relatorio_site", None),
    }


async def _identidade_relatorio_pedido(
    db: AsyncSession,
    pedido: ComprasPedidoDB,
    org: Optional[OrganizacaoDB],
) -> dict[str, Any]:
    """Preferência: identidade do projeto; fallback organização (padrão relatórios AEB)."""
    if pedido.instituicao_id:
        inst = (
            await db.execute(select(InstituicaoDB).where(InstituicaoDB.id == pedido.instituicao_id))
        ).scalar_one_or_none()
        if inst:
            idn = _identidade_de_entidade(inst)
            if any(idn.get(k) for k in (
                "relatorio_logo_url",
                "relatorio_nome_exibicao",
                "relatorio_rodape_linha1",
                "relatorio_rodape_linha2",
            )):
                return idn
    if org:
        return _identidade_de_entidade(org)
    return {"relatorio_nome_exibicao": "AEB"}


def _logo_bytes_relatorio(logo_url: Optional[str]) -> Optional[bytes]:
    if not logo_url:
        return None
    caminho = str(logo_url).strip().replace("\\", "/")
    try:
        storage_ref = extrair_bucket_caminho_storage(caminho)
        if storage_ref and storage_supabase_configurado():
            bucket, path = storage_ref
            arquivo = baixar_supabase_storage(bucket, path)
            return arquivo.conteudo if arquivo else None
    except (StorageErro, Exception):  # noqa: BLE001
        pass

    if caminho.startswith("/uploads/"):
        local = Path(caminho.lstrip("/"))
    elif caminho.startswith("uploads/"):
        local = Path(caminho)
    else:
        return None
    try:
        if local.is_file():
            return local.read_bytes()
    except OSError:
        return None
    return None


async def gerar_pedido_compra(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoAnexoDB:
    if pedido.status not in {STATUS_APROVADO, STATUS_ENVIADO, STATUS_RECEBIDO}:
        raise HTTPException(status_code=400, detail="Gere o pedido de compra após as aprovações.")

    itens = (
        await db.execute(
            select(ComprasPedidoItemDB).where(ComprasPedidoItemDB.pedido_id == pedido.id)
        )
    ).scalars().all()
    ids_catalogo = [getattr(i, "catalogo_item_id", None) for i in itens if getattr(i, "catalogo_item_id", None)]
    catalogo_campos: dict[str, dict] = {}
    if ids_catalogo:
        catalogo_campos = {
            row[0]: {"embalagem": row[1], "marca": row[2]}
            for row in (
                await db.execute(
                    select(
                        ComprasItemConsumoDB.id,
                        ComprasItemConsumoDB.embalagem,
                        ComprasItemConsumoDB.marca_preferencial,
                    ).where(ComprasItemConsumoDB.id.in_(ids_catalogo))
                )
            ).all()
        }
    cotacoes = await _cotacoes_ativas(db, pedido.id)
    escolhida = next((c for c in cotacoes if c.escolhida), None)
    if not escolhida:
        raise HTTPException(status_code=400, detail="Escolha uma cotação antes de gerar o pedido.")

    org = (
        await db.execute(select(OrganizacaoDB).where(OrganizacaoDB.id == pedido.organizacao_id))
    ).scalar_one_or_none()
    inst = await _dados_instituicao(db, pedido)
    identidade = await _identidade_relatorio_pedido(db, pedido, org)
    logo_bytes = _logo_bytes_relatorio(identidade.get("relatorio_logo_url"))
    numero = pedido.id.split("-")[0].upper()[:8]
    pdf_bytes = montar_pdf_pedido_compra(
        pedido={
            "competencia": pedido.competencia,
            "tipo": pedido.tipo,
            "instituicao_nome": inst.get("nome") if inst else None,
        },
        instituicao=inst,
        organizacao_nome=org.nome if org else "AEB",
        itens=[
            {
                "descricao": i.descricao,
                "quantidade": i.quantidade,
                "unidade_medida": i.unidade_medida,
                "embalagem": embalagem_efetiva_pedido(
                    getattr(i, "embalagem", None),
                    (catalogo_campos.get(getattr(i, "catalogo_item_id", None) or "") or {}).get("embalagem"),
                ),
                "marca_preferencial": embalagem_efetiva_pedido(
                    i.marca_preferencial,
                    (catalogo_campos.get(getattr(i, "catalogo_item_id", None) or "") or {}).get("marca"),
                ),
            }
            for i in itens
        ],
        cotacao_escolhida={
            "fornecedor_nome": escolhida.fornecedor_nome,
            "valor_centavos": escolhida.valor_centavos,
        },
        numero_pedido=numero,
        identidade=identidade,
        logo_bytes=logo_bytes,
    )
    conteudo = pdf_bytes
    nome_arquivo = f"pedido-compra-{numero}.pdf"

    class _ArquivoGerado:
        filename = nome_arquivo
        content_type = "application/pdf"

    caminho, nome_original, tamanho, content_type = await salvar_arquivo_compras(
        organizacao_id=pedido.organizacao_id,
        pedido_id=pedido.id,
        file=_ArquivoGerado(),  # type: ignore[arg-type]
        conteudo=conteudo,
    )

    if pedido.pedido_compra_anexo_id:
        antigo = (
            await db.execute(
                select(ComprasPedidoAnexoDB).where(ComprasPedidoAnexoDB.id == pedido.pedido_compra_anexo_id)
            )
        ).scalar_one_or_none()
        if antigo:
            antigo.ativo = False
            remover_arquivo_compras(antigo.caminho_arquivo)

    anexo = ComprasPedidoAnexoDB(
        pedido_id=pedido.id,
        tipo=TIPO_ANEXO_PEDIDO_PDF,
        nome_arquivo=nome_original,
        caminho_arquivo=caminho,
        content_type=content_type or "application/pdf",
        tamanho_bytes=tamanho,
        criado_por_id=_uid(usuario),
    )
    db.add(anexo)
    await db.flush()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_ANEXO,
        texto=f"Pedido de compra gerado: {nome_original}",
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
    )
    pedido.pedido_compra_anexo_id = anexo.id
    pedido.atualizado_em = agora_operacional_naive()
    return anexo


async def enviar_email_fornecedor(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> dict:
    if not pedido.pedido_compra_anexo_id:
        await gerar_pedido_compra(db, usuario, pedido)
    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(ComprasPedidoAnexoDB.id == pedido.pedido_compra_anexo_id)
        )
    ).scalar_one_or_none()
    if not anexo:
        raise HTTPException(status_code=400, detail="Pedido de compra não gerado.")

    cotacoes = await _cotacoes_ativas(db, pedido.id)
    escolhida = next((c for c in cotacoes if c.escolhida), None)
    email_dest = None
    if escolhida and escolhida.fornecedor_id:
        forn = (
            await db.execute(
                select(ComprasFornecedorDB).where(ComprasFornecedorDB.id == escolhida.fornecedor_id)
            )
        ).scalar_one_or_none()
        if forn:
            email_dest = (forn.email or forn.email_empresa or "").strip()

    if not email_dest:
        raise HTTPException(status_code=400, detail="Fornecedor escolhido não tem e-mail cadastrado.")

    bytes_arquivo, content_type = ler_bytes_anexo(anexo.caminho_arquivo)
    inst = await _dados_instituicao(db, pedido)
    projeto = (inst or {}).get("nome") or "projeto"
    assunto = f"Pedido de compra CareCore · {projeto} · {pedido.competencia}"
    corpo = (
        f"Segue em anexo o pedido de compra do {projeto}.\n\n"
        f"Endereço de entrega conforme documento anexo.\n\n"
        f"— CareCore+ / Compras"
    )
    resultado = enviar_email_smtp_com_anexo(
        assunto=assunto,
        corpo=corpo,
        para=email_dest,
        anexo_nome=anexo.nome_arquivo,
        anexo_bytes=bytes_arquivo,
        anexo_content_type=content_type or getattr(anexo, "content_type", None) or "application/pdf",
        perfil="compras",
        mailbox=(inst or {}).get("email_adm_compras") if tipo_eh_cotacao_projeto(pedido.tipo) else None,
    )
    texto_evento = f"E-mail enviado para {email_dest}." if resultado.enviado else f"Falha no e-mail: {resultado.erro}"
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_EMAIL,
        texto=texto_evento,
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
    )
    return {"enviado": resultado.enviado, "erro": resultado.erro, "destinatario": email_dest}


def _email_destino_fornecedor(fornecedor: ComprasFornecedorDB) -> str:
    return ((fornecedor.email or fornecedor.email_empresa or "") or "").strip()


async def _itens_html_pedido(db: AsyncSession, pedido: ComprasPedidoDB) -> list[dict]:
    itens = (
        await db.execute(
            select(ComprasPedidoItemDB).where(ComprasPedidoItemDB.pedido_id == pedido.id)
        )
    ).scalars().all()
    ids_catalogo = [getattr(i, "catalogo_item_id", None) for i in itens if getattr(i, "catalogo_item_id", None)]
    catalogo_campos: dict[str, dict] = {}
    if ids_catalogo:
        catalogo_campos = {
            row[0]: {"embalagem": row[1], "marca": row[2]}
            for row in (
                await db.execute(
                    select(
                        ComprasItemConsumoDB.id,
                        ComprasItemConsumoDB.embalagem,
                        ComprasItemConsumoDB.marca_preferencial,
                    ).where(ComprasItemConsumoDB.id.in_(ids_catalogo))
                )
            ).all()
        }
    return [
        {
            "descricao": i.descricao,
            "quantidade": i.quantidade,
            "unidade_medida": i.unidade_medida,
            "embalagem": embalagem_efetiva_pedido(
                getattr(i, "embalagem", None),
                (catalogo_campos.get(getattr(i, "catalogo_item_id", None) or "") or {}).get("embalagem"),
            ),
            "marca_preferencial": embalagem_efetiva_pedido(
                i.marca_preferencial,
                (catalogo_campos.get(getattr(i, "catalogo_item_id", None) or "") or {}).get("marca"),
            ),
        }
        for i in itens
    ]


async def enviar_solicitacao_cotacao_fornecedores(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    fornecedor_ids: list[str],
) -> dict:
    """Envia pedido de cotação por e-mail: um To por fornecedor (nunca lista no mesmo e-mail)."""
    perfil = str(usuario.get("perfil_acesso") or usuario.get("perfil") or "")
    sede = usuario_e_sede_compras(
        perfil=perfil,
        is_manutencao=bool(usuario.get("is_manutencao")),
    )
    cotacao_projeto = tipo_eh_cotacao_projeto(pedido.tipo)
    pode_projeto = usuario_pode_pedir(
        perfil=perfil,
        compras_modulo_ativo=bool(usuario.get("compras_modulo_ativo")),
        is_manutencao=bool(usuario.get("is_manutencao")),
        org_compras_ativo=True,
    )

    if cotacao_projeto:
        if not sede and not pode_projeto:
            raise HTTPException(status_code=403, detail="Sem permissão para pedir cotação deste pedido.")
    elif not sede:
        raise HTTPException(status_code=403, detail="Pedido de cotação de consumo é enviado pela Sede (ADM Compras).")
    elif pedido.tipo != TIPO_CONSUMO:
        raise HTTPException(status_code=400, detail="Pedido de cotação por e-mail da Sede é para consumo.")

    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Pedido encerrado não aceita nova solicitação de cotação.")

    status_ok_consumo = {
        STATUS_AGUARDANDO_COTACAO,
        STATUS_EM_COTACAO,
        STATUS_AGUARDANDO_UNIDADE,
        STATUS_AGUARDANDO_SEDE,
        STATUS_APROVADO,
    }
    status_ok_projeto = {
        STATUS_RASCUNHO,
        STATUS_AGUARDANDO_COTACAO,
        STATUS_EM_COTACAO,
        STATUS_AGUARDANDO_UNIDADE,
        STATUS_AGUARDANDO_SEDE,
    }
    if cotacao_projeto:
        if pedido.status not in status_ok_projeto:
            raise HTTPException(
                status_code=400,
                detail="Status do pedido não permite solicitar cotação por e-mail.",
            )
    elif pedido.status not in status_ok_consumo:
        raise HTTPException(
            status_code=400,
            detail="Status do pedido não permite solicitar cotação por e-mail.",
        )

    mailbox_projeto = None
    if cotacao_projeto and pedido.instituicao_id:
        inst_row = (
            await db.execute(select(InstituicaoDB).where(InstituicaoDB.id == pedido.instituicao_id))
        ).scalar_one_or_none()
        mailbox_projeto = (getattr(inst_row, "email_adm_compras", None) or "").strip() or None
        if not mailbox_projeto:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Cadastre o e-mail administrativo (Compras) no projeto antes de enviar "
                    "o pedido de orçamento."
                ),
            )

    ids = []
    vistos = set()
    for raw in fornecedor_ids or []:
        fid = str(raw or "").strip()
        if not fid or fid in vistos:
            continue
        vistos.add(fid)
        ids.append(fid)
    if not ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos um fornecedor.")

    fornecedores = (
        await db.execute(
            select(ComprasFornecedorDB).where(
                ComprasFornecedorDB.id.in_(ids),
                ComprasFornecedorDB.organizacao_id == pedido.organizacao_id,
            )
        )
    ).scalars().all()
    mapa = {f.id: f for f in fornecedores}
    faltando = [fid for fid in ids if fid not in mapa]
    if faltando:
        raise HTTPException(status_code=400, detail="Um ou mais fornecedores são inválidos.")

    sem_email = [f.nome for f in fornecedores if not _email_destino_fornecedor(f)]
    if sem_email:
        raise HTTPException(
            status_code=400,
            detail=f"Cadastre e-mail antes de enviar: {', '.join(sem_email)}.",
        )
    bloqueados = [f.nome for f in fornecedores if f.bloqueado or not f.ativo]
    if bloqueados:
        raise HTTPException(
            status_code=400,
            detail=f"Fornecedor inativo ou bloqueado: {', '.join(bloqueados)}.",
        )

    itens_html = await _itens_html_pedido(db, pedido)
    if not itens_html:
        raise HTTPException(status_code=400, detail="Pedido sem itens para cotar.")

    org = (
        await db.execute(select(OrganizacaoDB).where(OrganizacaoDB.id == pedido.organizacao_id))
    ).scalar_one_or_none()
    inst = await _dados_instituicao(db, pedido)
    identidade = await _identidade_relatorio_pedido(db, pedido, org)
    logo_bytes = _logo_bytes_relatorio(identidade.get("relatorio_logo_url"))
    numero = pedido.id.split("-")[0].upper()[:8]
    anexo_bytes = montar_pdf_solicitacao_cotacao(
        pedido={
            "competencia": pedido.competencia,
            "tipo": pedido.tipo,
            "instituicao_nome": inst.get("nome") if inst else None,
        },
        instituicao=inst,
        organizacao_nome=org.nome if org else "AEB",
        itens=itens_html,
        numero_pedido=numero,
        identidade=identidade,
        logo_bytes=logo_bytes,
    )
    anexo_nome = f"solicitacao-cotacao-{numero}.pdf"
    projeto = (inst or {}).get("nome") or "projeto"
    assunto = f"Solicitação de cotação CareCore · {projeto} · {pedido.competencia}"

    enviados: list[dict] = []
    falhas: list[dict] = []
    # Ordem da seleção do usuário
    ordenados = [mapa[fid] for fid in ids]
    for forn in ordenados:
        email_dest = _email_destino_fornecedor(forn)
        corpo = (
            f"Prezado(a),\n\n"
            f"Solicitamos cotação para o projeto {projeto} (competência {pedido.competencia}).\n"
            f"Segue em anexo a lista de itens em PDF.\n\n"
            f"Responda a este e-mail com o orçamento em PDF.\n\n"
            f"— CareCore+ / Compras AEB"
        )
        resultado = enviar_email_smtp_com_anexo(
            assunto=assunto,
            corpo=corpo,
            para=email_dest,
            anexo_nome=anexo_nome,
            anexo_bytes=anexo_bytes,
            anexo_content_type="application/pdf",
            perfil="compras",
            mailbox=mailbox_projeto,
        )
        if resultado.enviado:
            texto_evento = f"Pedido de cotação enviado para {forn.nome} <{email_dest}> [id:{forn.id}]."
            enviados.append({"fornecedor_id": forn.id, "nome": forn.nome, "email": email_dest})
        else:
            texto_evento = (
                f"Falha ao pedir cotação a {forn.nome} <{email_dest}> [id:{forn.id}]: {resultado.erro}"
            )
            falhas.append({
                "fornecedor_id": forn.id,
                "nome": forn.nome,
                "email": email_dest,
                "erro": resultado.erro,
            })
        await registrar_evento_pedido(
            db,
            pedido_id=pedido.id,
            tipo=TIPO_EVENTO_EMAIL,
            texto=texto_evento,
            usuario_id=_uid(usuario),
        )

    status_anterior = pedido.status
    if cotacao_projeto and pedido.status == STATUS_RASCUNHO and enviados:
        pedido.status = STATUS_EM_COTACAO
        await registrar_evento_pedido(
            db,
            pedido_id=pedido.id,
            tipo=TIPO_EVENTO_STATUS,
            texto="Status atualizado após pedido de cotação por e-mail.",
            usuario_id=_uid(usuario),
            status_anterior=status_anterior,
            status_novo=STATUS_EM_COTACAO,
        )
    elif pedido.status == STATUS_AGUARDANDO_COTACAO and enviados:
        pedido.status = STATUS_EM_COTACAO
        await registrar_evento_pedido(
            db,
            pedido_id=pedido.id,
            tipo=TIPO_EVENTO_STATUS,
            texto="Status atualizado após pedido de cotação por e-mail.",
            usuario_id=_uid(usuario),
            status_anterior=status_anterior,
            status_novo=STATUS_EM_COTACAO,
        )
    pedido.atualizado_em = agora_operacional_naive()

    from email_utils import mailbox_graph_compras

    return {
        "enviados": enviados,
        "falhas": falhas,
        "total_enviados": len(enviados),
        "total_falhas": len(falhas),
        "remetente": mailbox_graph_compras(mailbox_projeto),
    }


async def registrar_nota_fiscal(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    file: Optional[UploadFile],
    conteudo_xml: Optional[bytes],
    payload: dict,
) -> ComprasPedidoNotaFiscalDB:
    if pedido.status != STATUS_ENVIADO:
        raise HTTPException(status_code=400, detail="Notas fiscais só após envio ao fornecedor.")

    campos = {
        "tipo_nf": (payload.get("tipo_nf") or "produto").strip().lower(),
        "numero": (payload.get("numero") or "").strip() or None,
        "serie": (payload.get("serie") or "").strip() or None,
        "chave_acesso": (payload.get("chave_acesso") or "").strip() or None,
        "emitente_nome": (payload.get("emitente_nome") or "").strip() or None,
        "emitente_cnpj": (payload.get("emitente_cnpj") or "").strip() or None,
        "observacao": (payload.get("observacao") or "").strip() or None,
        "origem_dados": "manual",
    }
    if payload.get("valor_centavos") is not None:
        campos["valor_centavos"] = int(payload["valor_centavos"])
    elif payload.get("valor_reais") is not None:
        campos["valor_centavos"] = int(round(float(payload["valor_reais"]) * 100))
    if payload.get("data_emissao"):
        campos["data_emissao"] = date.fromisoformat(str(payload["data_emissao"])[:10])

    tipo_anexo = TIPO_ANEXO_NF_PDF
    anexo = None
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        raw = await file.read()
        if ext == ".xml":
            tipo_anexo = TIPO_ANEXO_NF_XML
            try:
                xml_campos = extrair_campos_nf_xml(raw)
                if xml_campos.get("numero"):
                    campos["numero"] = xml_campos["numero"]
                if xml_campos.get("serie"):
                    campos["serie"] = xml_campos["serie"]
                if xml_campos.get("chave_acesso"):
                    campos["chave_acesso"] = xml_campos["chave_acesso"]
                if xml_campos.get("emitente_nome"):
                    campos["emitente_nome"] = xml_campos["emitente_nome"]
                if xml_campos.get("emitente_cnpj"):
                    campos["emitente_cnpj"] = xml_campos["emitente_cnpj"]
                if xml_campos.get("valor_centavos") is not None:
                    campos["valor_centavos"] = xml_campos["valor_centavos"]
                if xml_campos.get("data_emissao"):
                    campos["data_emissao"] = date.fromisoformat(str(xml_campos["data_emissao"])[:10])
                campos["origem_dados"] = "xml"
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
        await file.seek(0)
        anexo = await upload_anexo_pedido(
            db, usuario, pedido, file=file, tipo=tipo_anexo,
        )

    nota = ComprasPedidoNotaFiscalDB(
        pedido_id=pedido.id,
        anexo_id=anexo.id if anexo else None,
        tipo_nf=campos["tipo_nf"],
        numero=campos.get("numero"),
        serie=campos.get("serie"),
        chave_acesso=campos.get("chave_acesso"),
        emitente_nome=campos.get("emitente_nome"),
        emitente_cnpj=campos.get("emitente_cnpj"),
        data_emissao=campos.get("data_emissao"),
        valor_centavos=campos.get("valor_centavos"),
        origem_dados=campos.get("origem_dados") or "manual",
        observacao=campos.get("observacao"),
        criado_por_id=_uid(usuario),
    )
    db.add(nota)
    await db.flush()
    if anexo:
        anexo.nota_fiscal_id = nota.id

    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_ANEXO,
        texto=f"Nota fiscal registrada{f' nº {nota.numero}' if nota.numero else ''}.",
        usuario_id=_uid(usuario),
        anexo_id=anexo.id if anexo else None,
    )
    pedido.atualizado_em = agora_operacional_naive()
    return nota


async def encerrar_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    payload: dict,
) -> ComprasPedidoDB:
    if pedido.status != STATUS_ENVIADO:
        raise HTTPException(status_code=400, detail="Encerramento só após envio ao fornecedor.")
    notas = await _notas_pedido(db, pedido.id)
    if not notas:
        raise HTTPException(status_code=400, detail="Anexe ao menos uma nota fiscal antes de encerrar.")

    pedido.recebido_em = agora_operacional_naive()
    pedido.recebido_por_id = _uid(usuario)
    pedido.recebimento_observacao = payload.get("observacao") or None
    pedido.recebimento_divergencia = bool(payload.get("divergencia"))
    anterior = pedido.status
    pedido.status = STATUS_RECEBIDO
    pedido.atualizado_em = agora_operacional_naive()

    itens_payload = {item.get("id"): item for item in (payload.get("itens") or []) if item.get("id")}
    if itens_payload:
        itens = (
            await db.execute(
                select(ComprasPedidoItemDB).where(ComprasPedidoItemDB.pedido_id == pedido.id)
            )
        ).scalars().all()
        for item in itens:
            dados = itens_payload.get(item.id) or {}
            if dados.get("quantidade_recebida") is not None:
                item.quantidade_recebida = float(dados["quantidade_recebida"])
            if dados.get("validade_lote"):
                item.validade_lote = date.fromisoformat(str(dados["validade_lote"]))

    doc_nf = notas[0].numero or notas[0].chave_acesso

    if pedido.tipo == TIPO_IMOBILIZADO:
        existentes = (
            await db.execute(
                select(ComprasPatrimonioDB.id).where(ComprasPatrimonioDB.pedido_id == pedido.id)
            )
        ).scalars().all()
        if not existentes:
            itens = (
                await db.execute(
                    select(ComprasPedidoItemDB).where(ComprasPedidoItemDB.pedido_id == pedido.id)
                )
            ).scalars().all()
            cotacoes = await _cotacoes_ativas(db, pedido.id)
            escolhida = next((c for c in cotacoes if c.escolhida), None)
            valor_item = None
            if escolhida and itens:
                valor_item = int(escolhida.valor_centavos / max(len(itens), 1))
            escopo = getattr(pedido, "escopo_unidade", ESCOPO_PROJETO) or ESCOPO_PROJETO
            inst_id = None if pedido_escopo_sede(escopo) else pedido.instituicao_id
            agora = agora_operacional_naive()
            for item in itens:
                db.add(
                    ComprasPatrimonioDB(
                        organizacao_id=pedido.organizacao_id,
                        instituicao_id=inst_id,
                        pedido_id=pedido.id,
                        pedido_item_id=item.id,
                        descricao=item.descricao,
                        documento_nf=doc_nf,
                        valor_centavos=valor_item,
                        origem=PATRIMONIO_ORIGEM_COMPRA,
                        propriedade="aeb",
                        situacao=PATRIMONIO_SITUACAO_BOM,
                        escopo_unidade=escopo,
                        data_aquisicao=data_operacional(),
                        criado_em=agora,
                        atualizado_em=agora,
                    )
                )

    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto="Processo encerrado com nota(s) fiscal(is) anexada(s).",
        usuario_id=_uid(usuario),
        status_anterior=anterior,
        status_novo=STATUS_RECEBIDO,
    )
    return pedido


async def desativar_cotacao(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    cotacao_id: str,
    motivo: Optional[str] = None,
) -> None:
    if not usuario_e_sede_compras(
        perfil=(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        raise HTTPException(
            status_code=403,
            detail="Somente a Sede (ADM Compras) pode substituir orçamentos.",
        )
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Processo encerrado.")
    cotacao = (
        await db.execute(
            select(ComprasCotacaoDB).where(
                ComprasCotacaoDB.id == cotacao_id,
                ComprasCotacaoDB.pedido_id == pedido.id,
            )
        )
    ).scalar_one_or_none()
    if not cotacao:
        raise HTTPException(status_code=404, detail="Cotação não encontrada.")
    cotacao.ativa = False
    if cotacao.escolhida:
        cotacao.escolhida = False
    anexos = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.cotacao_id == cotacao.id,
                ComprasPedidoAnexoDB.ativo.is_(True),
            )
        )
    ).scalars().all()
    for anexo in anexos:
        anexo.ativo = False
        remover_arquivo_compras(anexo.caminho_arquivo)
    texto = (motivo or "Cotação substituída/desativada.").strip()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_OBSERVACAO,
        texto=f"{cotacao.fornecedor_nome}: {texto}",
        usuario_id=_uid(usuario),
        cotacao_id=cotacao.id,
        aguardando_confirmacao=False,
    )
    pedido.atualizado_em = agora_operacional_naive()


async def assinar_orcamento_e_aprovar_sede(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    """Assina o orçamento vencedor (folha digitalizada) e aprova na Sede — só cotação do projeto."""
    if not usuario_pode_aprovar_sede(
        perfil=str(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        raise HTTPException(status_code=403, detail="Somente ADM Compras aprova na Sede.")
    if not tipo_eh_cotacao_projeto(pedido.tipo):
        raise HTTPException(
            status_code=400,
            detail="Assinatura de orçamento vale para bem, manutenção ou prestação de serviço.",
        )
    if pedido.status != STATUS_AGUARDANDO_SEDE:
        raise HTTPException(status_code=400, detail="Pedido não está aguardando aprovação da Sede.")
    if not pedido.aprovado_unidade_em and not pedido_escopo_sede(getattr(pedido, "escopo_unidade", None)):
        raise HTTPException(
            status_code=400,
            detail="O projeto precisa enviar o pedido à Sede antes da assinatura.",
        )

    cotacoes = await _cotacoes_ativas(db, pedido.id)
    escolhida = next((c for c in cotacoes if c.escolhida), None)
    if not escolhida:
        raise HTTPException(status_code=400, detail="Não há orçamento vencedor escolhido.")

    anexos_orc = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.cotacao_id == escolhida.id,
                ComprasPedidoAnexoDB.tipo == TIPO_ANEXO_ORCAMENTO,
                ComprasPedidoAnexoDB.ativo.is_(True),
            )
        )
    ).scalars().all()
    if not anexos_orc:
        raise HTTPException(
            status_code=400,
            detail="Anexe o PDF do orçamento vencedor antes de assinar na Sede.",
        )
    orcamento_original = anexos_orc[0]

    agora = agora_operacional_naive()
    assinante = (
        (usuario.get("nome") or usuario.get("nome_completo") or usuario.get("email") or "ADM Compras")
    ).strip()
    assinado_em_texto = agora.strftime("%d/%m/%Y %H:%M")

    org = (
        await db.execute(select(OrganizacaoDB).where(OrganizacaoDB.id == pedido.organizacao_id))
    ).scalar_one_or_none()
    inst = await _dados_instituicao(db, pedido)
    identidade = await _identidade_relatorio_pedido(db, pedido, org)
    logo_bytes = _logo_bytes_relatorio(identidade.get("relatorio_logo_url"))
    numero = pedido.id.split("-")[0].upper()[:8]
    pdf_bytes = montar_pdf_aprovacao_orcamento_sede(
        pedido={
            "competencia": pedido.competencia,
            "tipo": pedido.tipo,
            "instituicao_nome": (inst or {}).get("nome"),
        },
        instituicao=inst,
        organizacao_nome=org.nome if org else "AEB",
        cotacao_escolhida={
            "fornecedor_nome": escolhida.fornecedor_nome,
            "valor_centavos": escolhida.valor_centavos,
        },
        numero_pedido=numero,
        assinante_nome=assinante,
        assinado_em_texto=assinado_em_texto,
        arquivo_orcamento_original=orcamento_original.nome_arquivo,
        identidade=identidade,
        logo_bytes=logo_bytes,
    )
    nome_arquivo = f"orcamento-assinado-sede-{numero}.pdf"

    class _ArquivoGerado:
        filename = nome_arquivo
        content_type = "application/pdf"

    caminho, nome_original, tamanho, content_type = await salvar_arquivo_compras(
        organizacao_id=pedido.organizacao_id,
        pedido_id=pedido.id,
        file=_ArquivoGerado(),  # type: ignore[arg-type]
        conteudo=pdf_bytes,
    )

    anteriores = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.cotacao_id == escolhida.id,
                ComprasPedidoAnexoDB.tipo == TIPO_ANEXO_ORCAMENTO_ASSINADO,
                ComprasPedidoAnexoDB.ativo.is_(True),
            )
        )
    ).scalars().all()
    for ant in anteriores:
        ant.ativo = False
        remover_arquivo_compras(ant.caminho_arquivo)

    anexo = ComprasPedidoAnexoDB(
        pedido_id=pedido.id,
        cotacao_id=escolhida.id,
        tipo=TIPO_ANEXO_ORCAMENTO_ASSINADO,
        nome_arquivo=nome_original,
        caminho_arquivo=caminho,
        content_type=content_type or "application/pdf",
        tamanho_bytes=tamanho,
        criado_por_id=_uid(usuario),
    )
    db.add(anexo)
    await db.flush()

    pedido.aprovado_sede_por_id = _uid(usuario)
    pedido.aprovado_sede_em = agora
    pedido.status = STATUS_APROVADO
    pedido.atualizado_em = agora

    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=(
            f"Orçamento de {escolhida.fornecedor_nome} assinado digitalmente pela Sede "
            f"({assinante}) e pedido aprovado."
        ),
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
        cotacao_id=escolhida.id,
        status_anterior=STATUS_AGUARDANDO_SEDE,
        status_novo=STATUS_APROVADO,
    )
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_ANEXO,
        texto=f"Orçamento assinado (Sede): {nome_original}. Disponível para o projeto.",
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
        cotacao_id=escolhida.id,
    )
    return pedido
