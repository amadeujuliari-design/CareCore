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
from compras_assinatura_pdf import (
    carimbar_assinatura_gestor_pdf,
    carimbar_assinatura_pdf,
    carimbar_texto_pdf,
    juntar_anexos_orcamento,
    juntar_pdfs,
)
from security import verificar_senha
from compras_emails import (
    corpo_padrao_notas_pendentes,
    corpo_padrao_pedido_compra,
    corpo_padrao_solicitacao_cotacao,
    metadados_assinatura,
    preparar_envio_email_compras,
    sanitizar_corpo_email,
)
from compras_patrimonio_utils import reais_para_centavos
from compras_pedido_pdf import (
    montar_pdf_pedido_compra,
    montar_pdf_solicitacao_cotacao,
)
from compras_regras import (
    ESCOPO_PROJETO,
    MIN_COTACOES_RECOMENDADAS,
    FONTE_TIPO_CONVENIO,
    PATRIMONIO_ORIGEM_COMPRA,
    PATRIMONIO_PROPRIEDADE_AEB,
    PATRIMONIO_PROPRIEDADE_PUBLICO,
    PATRIMONIO_SITUACAO_BOM,
    STATUS_AGUARDANDO_COTACAO,
    STATUS_AGUARDANDO_ESCOLHA,
    STATUS_AGUARDANDO_SEDE,
    STATUS_AGUARDANDO_UNIDADE,
    STATUS_APROVADO,
    STATUS_CANCELADO,
    STATUS_COTACAO_SEDE_COLETANDO,
    STATUS_EM_COTACAO,
    STATUS_ENVIADO,
    STATUS_RECEBIDO,
    STATUS_IMPRIMIR_NF,
    STATUS_AGUARDANDO_PAGAMENTO,
    STATUS_AGUARDANDO_EXTRATO,
    STATUS_REPROVADO,
    STATUS_RASCUNHO,
    STATUS_TERMINAIS_PEDIDO,
    perfil_adm_compras_sede,
    TIPO_CONSUMO,
    TIPOS_COTACAO_PROJETO,
    TIPO_ANEXO_AQUISICAO,
    TIPO_ANEXO_NF_PDF,
    TIPO_ANEXO_NF_XML,
    TIPOS_ANEXO_NO_BEM,
    TIPO_ANEXO_ORCAMENTO,
    TIPO_ANEXO_ORCAMENTO_ORIGEM,
    TIPO_ANEXO_ORCAMENTO_ASSINADO,
    PREFIXO_ORCAMENTO_UNIFICADO,
    anexos_orcamento_para_envio,
    eh_anexo_orcamento_unificado,
    fontes_unificacao_orcamento,
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
    TIPO_EMERGENCIA,
    EMAIL_NOTAS_PENDENTES,
    assunto_solicitacao_cotacao,
    categoria_email_cotacao,
    formatar_data_br_compras,
    tipo_eh_emergencia,
    tipo_pula_orcamento,
    TIPOS_ANEXO_PEDIDO,
    TIPOS_EVENTO_AGUARDAM_OK,
    TIPOS_EVENTO_PEDIDO,
    aviso_cotacoes_insuficientes,
    aviso_pedido_sem_tres_orcamentos_para_sede,
    data_operacional,
    pedido_escopo_sede,
    pedido_itens_podem_editar,
    pedido_rascunho_pode_excluir,
    pode_reabrir_orcamento_aprovado,
    sede_pode_reabrir_aprovado,
    CLASSE_DOC_BOLETO,
    CLASSE_DOC_COMPROVANTE,
    CLASSE_DOC_CONTRATO,
    CLASSE_DOC_NOTA,
    CLASSE_DOC_RELACIONADO,
    normalizar_qtd_parcelas_pagamento,
    pagamento_infra_completo,
    parcela_conta_como_paga,
    maior_parcela_com_documento,
    ETAPA_CONTRATO_ASSINADO,
    ETAPA_CONTRATO_NOEMI,
    ETAPA_CONTRATO_ROBSON,
    pedido_segue_infraestrutura,
    pedido_na_fila_concluidos_infra,
    pedido_na_fila_nf_pagamento,
    pedido_na_fila_nf_pagamento_suprimentos,
    tipo_eh_cotacao_projeto,
    projeto_pode_trocar_orcamento,
    tipo_suprimentos_aprova_e_envia,
    tipo_eh_cotacao_sede,
    usuario_e_sede_compras,
    usuario_global_assina_orcamento,
    usuario_ve_alerta_contrato_assinado,
    usuario_pode_aprovar_sede,
    lado_timeline_compras,
    tipo_arquivo_bem_de_anexo_pedido,
    usuario_pode_enviar_email_compras,
    usuario_pode_pedir,
    usuario_sede_pode_ver_tipo,
)
from compras_upload_utils import remover_arquivo_compras, salvar_arquivo_compras
from email_utils import enviar_email_smtp_com_anexo
from models import (
    ComprasCotacaoDB,
    ComprasFornecedorDB,
    ComprasFonteRecursoDB,
    ComprasItemConsumoDB,
    ComprasPatrimonioAnexoDB,
    ComprasPatrimonioDB,
    ComprasPedidoAnexoDB,
    ComprasPedidoDB,
    ComprasPedidoEventoDB,
    ComprasPedidoEventoRevisaoDB,
    ComprasPedidoItemDB,
    UsuarioDB,
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

MENSAGEM_INFRA_SEM_EMAIL = (
    "O perfil de Infraestrutura aprova o orçamento na Sede; "
    "o envio de e-mail ao fornecedor fica com o projeto."
)


def _exigir_envio_email_compras(usuario: dict) -> None:
    perfil = str(usuario.get("perfil_acesso") or usuario.get("perfil") or "")
    if not usuario_pode_enviar_email_compras(
        perfil=perfil,
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        raise HTTPException(status_code=403, detail=MENSAGEM_INFRA_SEM_EMAIL)


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


def _usuario_do_projeto_anexa_nf(usuario: dict) -> bool:
    """Gestor, técnico, administrativo ou ADM Pedidos do projeto. Sede Compras não assina NF."""
    from security import normalizar_perfil_acesso

    perfil = normalizar_perfil_acesso(
        str(usuario.get("perfil_acesso") or usuario.get("perfil") or "").strip()
    )
    return bool(usuario.get("is_manutencao")) or perfil in {
        "Gestor",
        "Técnico",
        "Administrativo",
        "ADM Pedidos",
    }


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


async def contar_orcamentos_com_anexo(db: AsyncSession, pedido_id: str) -> int:
    """Quantidade de cotações ativas que já têm ao menos um PDF de orçamento."""
    cotacoes = await _cotacoes_ativas(db, pedido_id)
    if not cotacoes:
        return 0
    anexos = await _anexos_pedido(db, pedido_id)
    com_pdf = {
        a.cotacao_id
        for a in anexos
        if a.cotacao_id and a.tipo == TIPO_ANEXO_ORCAMENTO
    }
    return sum(1 for c in cotacoes if c.id in com_pdf)


async def _marcar_pronto_para_escolha_sede(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    motivo: str,
) -> bool:
    """Passa cotação da Sede de 'coletando' para 'pronto para escolher'. Retorna se mudou."""
    if not tipo_eh_cotacao_sede(pedido.tipo):
        return False
    if pedido.status not in STATUS_COTACAO_SEDE_COLETANDO:
        return False
    anterior = pedido.status
    pedido.status = STATUS_AGUARDANDO_ESCOLHA
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=motivo,
        usuario_id=_uid(usuario),
        status_anterior=anterior,
        status_novo=STATUS_AGUARDANDO_ESCOLHA,
    )
    return True


async def liberar_cotacao_para_escolha(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    """Sede libera a escolha do vencedor com menos de 3 orçamentos anexados."""
    from compras_regras import usuario_pode_aprovar_sede

    if not usuario_pode_aprovar_sede(
        perfil=(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        raise HTTPException(status_code=403, detail="Somente a Sede libera a escolha do orçamento.")
    if not tipo_eh_cotacao_sede(pedido.tipo):
        raise HTTPException(
            status_code=400,
            detail="Liberar escolha vale para pedidos de cotação da Sede (consumo/hortifruti/manutenção).",
        )
    if pedido.status not in STATUS_COTACAO_SEDE_COLETANDO:
        raise HTTPException(
            status_code=400,
            detail="Só é possível liberar enquanto o pedido está em cotação.",
        )
    qtd = await contar_orcamentos_com_anexo(db, pedido.id)
    if qtd < 1:
        raise HTTPException(
            status_code=400,
            detail="Anexe ao menos um orçamento antes de liberar a escolha.",
        )
    await _marcar_pronto_para_escolha_sede(
        db,
        usuario,
        pedido,
        motivo=(
            f"Cotação liberada para escolha com {qtd} orçamento(s) anexado(s) "
            f"(recomendado: {MIN_COTACOES_RECOMENDADAS})."
        ),
    )
    return pedido


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


async def _anexos_orcamento_da_cotacao(
    db: AsyncSession,
    cotacao_id: str,
    *,
    so_ativos: bool = False,
) -> list[ComprasPedidoAnexoDB]:
    filtros = [
        ComprasPedidoAnexoDB.cotacao_id == cotacao_id,
        ComprasPedidoAnexoDB.tipo.in_({TIPO_ANEXO_ORCAMENTO, TIPO_ANEXO_ORCAMENTO_ORIGEM}),
    ]
    if so_ativos:
        filtros.append(ComprasPedidoAnexoDB.ativo.is_(True))
    return list(
        (
            await db.execute(
                select(ComprasPedidoAnexoDB)
                .where(*filtros)
                .order_by(ComprasPedidoAnexoDB.criado_em.asc())
            )
        ).scalars().all()
    )


async def restaurar_orcamentos_originais_cotacao(db: AsyncSession, cotacao_id: str) -> None:
    """Devolve os PDFs separados e tira de cena o pacote unificado."""
    if not cotacao_id:
        return
    for anexo in await _anexos_orcamento_da_cotacao(db, cotacao_id):
        if anexo.tipo == TIPO_ANEXO_ORCAMENTO_ORIGEM:
            anexo.tipo = TIPO_ANEXO_ORCAMENTO
            anexo.ativo = True
        elif anexo.ativo and anexo.tipo == TIPO_ANEXO_ORCAMENTO and eh_anexo_orcamento_unificado(
            anexo.nome_arquivo
        ):
            anexo.ativo = False


async def unificar_orcamentos_vencedor(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    cotacao: ComprasCotacaoDB,
) -> Optional[ComprasPedidoAnexoDB]:
    """Junta os orçamentos do vencedor num PDF único que segue assinatura e envio."""
    anexos = await _anexos_orcamento_da_cotacao(db, cotacao.id)
    fontes = fontes_unificacao_orcamento(anexos)
    if len(fontes) < 2:
        return None

    partes: list[tuple[bytes, str, str]] = []
    nomes: list[str] = []
    for anexo in fontes:
        try:
            bruto, tipo_lido = ler_bytes_anexo(anexo.caminho_arquivo)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Não foi possível ler «{anexo.nome_arquivo}» para unir os orçamentos "
                    f"do vencedor: {exc}"
                ),
            ) from exc
        partes.append((bruto, anexo.nome_arquivo or "orcamento.pdf", tipo_lido or anexo.content_type or ""))
        nomes.append(anexo.nome_arquivo or "arquivo")

    try:
        pdf_bytes = juntar_anexos_orcamento(partes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    numero = pedido.id.split("-")[0].upper()[:8]
    nome_arquivo = f"{PREFIXO_ORCAMENTO_UNIFICADO}-{numero}.pdf"

    class _ArquivoGerado:
        filename = nome_arquivo
        content_type = "application/pdf"

    caminho, nome_original, tamanho, content_type = await salvar_arquivo_compras(
        organizacao_id=pedido.organizacao_id,
        pedido_id=pedido.id,
        file=_ArquivoGerado(),  # type: ignore[arg-type]
        conteudo=pdf_bytes,
    )

    for anexo in anexos:
        if anexo.ativo and anexo.tipo == TIPO_ANEXO_ORCAMENTO and eh_anexo_orcamento_unificado(
            anexo.nome_arquivo
        ):
            anexo.ativo = False
    for anexo in fontes:
        anexo.tipo = TIPO_ANEXO_ORCAMENTO_ORIGEM
        anexo.ativo = False

    pacote = ComprasPedidoAnexoDB(
        pedido_id=pedido.id,
        cotacao_id=cotacao.id,
        tipo=TIPO_ANEXO_ORCAMENTO,
        nome_arquivo=nome_original,
        caminho_arquivo=caminho,
        content_type=content_type or "application/pdf",
        tamanho_bytes=tamanho,
        criado_por_id=_uid(usuario),
    )
    db.add(pacote)
    await db.flush()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_ANEXO,
        texto=(
            f"Orçamentos do vencedor {cotacao.fornecedor_nome} unidos em um PDF "
            f"({len(fontes)} arquivos: {', '.join(nomes)})."
        ),
        usuario_id=_uid(usuario),
        anexo_id=pacote.id,
        cotacao_id=cotacao.id,
    )
    pedido.atualizado_em = agora_operacional_naive()
    return pacote


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


TEXTO_SEM_CONTRATO = "Não há contrato neste pedido."
TEXTO_COMPRA_DIRETA = "Compra direta sem envio de e-mail"


def situacao_contrato_de_registros(pedido: ComprasPedidoDB, eventos, anexos) -> dict:
    """Contrato, quando existe, trava a compra e o pagamento até a assinatura da Noemi."""
    segue = pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
    sem_contrato = any((e.texto or "").startswith(TEXTO_SEM_CONTRATO) for e in eventos)
    contratos = [
        a for a in anexos
        if (getattr(a, "classe_documento", None) or "") == CLASSE_DOC_CONTRATO
        and getattr(a, "ativo", True)
    ]
    contrato_assinado = any(
        (getattr(a, "etapa_contrato", None) or "") == ETAPA_CONTRATO_ASSINADO for a in contratos
    )
    contrato_pendente = any(
        (getattr(a, "etapa_contrato", None) or "") in {ETAPA_CONTRATO_ROBSON, ETAPA_CONTRATO_NOEMI}
        for a in contratos
    )
    email_ok = any(
        e.tipo == TIPO_EVENTO_EMAIL and (e.texto or "").startswith("E-mail enviado para")
        for e in eventos
    )
    compra_direta = any((e.texto or "").startswith(TEXTO_COMPRA_DIRETA) for e in eventos)
    compra_executada = bool((email_ok and pedido.pedido_compra_anexo_id) or compra_direta)
    if not segue:
        return {
            "segue": False,
            "sem_contrato": False,
            "contrato_assinado": False,
            "contrato_pendente": False,
            "compra_direta_sem_email": compra_direta,
            "compra_liberada": True,
            "compra_executada": pedido.status == STATUS_ENVIADO or compra_executada,
            "motivo": None,
        }
    if contrato_pendente:
        liberada = False
        motivo = "A compra só abre depois que o contrato for assinado."
    elif contrato_assinado or sem_contrato:
        liberada = True
        motivo = None
    else:
        liberada = False
        motivo = "Anexe o contrato ou registre que este pedido não tem contrato."
    return {
        "segue": True,
        "sem_contrato": sem_contrato,
        "contrato_assinado": contrato_assinado,
        "contrato_pendente": contrato_pendente,
        "compra_direta_sem_email": compra_direta,
        "compra_liberada": liberada,
        "compra_executada": compra_executada,
        "motivo": motivo,
    }


async def situacao_contrato_infra(db: AsyncSession, pedido: ComprasPedidoDB) -> dict:
    eventos = await _eventos_pedido(db, pedido.id)
    anexos = await _anexos_pedido(db, pedido.id)
    return situacao_contrato_de_registros(pedido, eventos, anexos)


async def exigir_compra_liberada_infra(db: AsyncSession, pedido: ComprasPedidoDB) -> None:
    sit = await situacao_contrato_infra(db, pedido)
    if not sit["segue"] or sit["compra_executada"]:
        return
    if not sit["compra_liberada"]:
        raise HTTPException(status_code=400, detail=sit["motivo"])


async def exigir_documentos_finais_infra(db: AsyncSession, pedido: ComprasPedidoDB) -> None:
    if tipo_pula_orcamento(pedido.tipo):
        return
    sit = await situacao_contrato_infra(db, pedido)
    if sit["segue"] and not sit["compra_executada"]:
        raise HTTPException(
            status_code=400,
            detail="Boleto, nota fiscal, comprovante e arquivo relacionado abrem depois que a compra for executada.",
        )


def _numero_parcela_doc(valor) -> int:
    try:
        n = int(valor)
    except (TypeError, ValueError):
        return 0
    return n if n > 0 else 0


def situacao_pagamento_de_registros(pedido: ComprasPedidoDB, notas, anexos) -> dict:
    segue = pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
    qtd = getattr(pedido, "pagamento_qtd_parcelas", None)
    quitado = bool(getattr(pedido, "pagamento_quitado_em", None))
    if not segue:
        return {
            "segue": False,
            "qtd_parcelas": None,
            "quitado": False,
            "completo": True,
            "parcelas_pagas": 0,
            "parcelas": [],
        }
    docs: dict[int, bool] = {}
    for nota in notas or []:
        if (nota.tipo_nf or "") == "boleto":
            continue
        if not getattr(nota, "anexo_id", None):
            continue
        docs[_numero_parcela_doc(getattr(nota, "parcela_numero", None))] = True
    for anexo in anexos or []:
        if not getattr(anexo, "ativo", True):
            continue
        classe = (getattr(anexo, "classe_documento", None) or "")
        if classe not in {CLASSE_DOC_COMPROVANTE, CLASSE_DOC_NOTA}:
            continue
        docs[_numero_parcela_doc(getattr(anexo, "parcela_numero", None))] = True
    parcelas = []
    pagas = 0
    total = int(qtd or 0)
    for numero in range(1, total + 1):
        paga = parcela_conta_como_paga(numero, docs, qtd=total)
        if paga:
            pagas += 1
        parcelas.append({"numero": numero, "paga": paga})
    completo = pagamento_infra_completo(qtd=qtd, parcelas_pagas=pagas, quitado=quitado)
    return {
        "segue": True,
        "qtd_parcelas": qtd,
        "quitado": quitado,
        "completo": completo,
        "parcelas_pagas": pagas,
        "parcelas": parcelas,
    }


async def situacao_pagamento_infra(db: AsyncSession, pedido: ComprasPedidoDB) -> dict:
    notas = await _notas_pedido(db, pedido.id)
    anexos = await _anexos_pedido(db, pedido.id)
    return situacao_pagamento_de_registros(pedido, notas, anexos)


def _exigir_parcela_infra(pedido: ComprasPedidoDB, payload: dict) -> Optional[int]:
    if tipo_pula_orcamento(pedido.tipo):
        return None
    if not pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None)):
        return None
    qtd = getattr(pedido, "pagamento_qtd_parcelas", None)
    if not qtd:
        raise HTTPException(
            status_code=400,
            detail="Informe se o pagamento será à vista (1 parcela) ou em quantas parcelas.",
        )
    bruto = payload.get("parcela_numero")
    if bruto in (None, ""):
        if int(qtd) == 1:
            return 1
        raise HTTPException(status_code=400, detail="Escolha a parcela deste pagamento.")
    try:
        numero = int(bruto)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Parcela inválida.") from exc
    if numero < 1 or numero > int(qtd):
        raise HTTPException(
            status_code=400,
            detail=f"A parcela deve ser entre 1 e {int(qtd)}.",
        )
    return numero


async def definir_pagamento_parcelas(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    qtd_parcelas,
) -> ComprasPedidoDB:
    if not pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None)):
        raise HTTPException(status_code=400, detail="O pagamento parcelado vale só para Infraestrutura.")
    sit = await situacao_contrato_infra(db, pedido)
    if not sit["compra_executada"]:
        raise HTTPException(status_code=400, detail="Defina o pagamento depois da compra.")
    if pedido.status != STATUS_ENVIADO:
        raise HTTPException(status_code=400, detail="O pagamento só se define com o pedido enviado ao fornecedor.")
    try:
        qtd = normalizar_qtd_parcelas_pagamento(qtd_parcelas)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    atual = await situacao_pagamento_infra(db, pedido)
    maior = maior_parcela_com_documento(atual.get("parcelas"))
    if maior and qtd < maior:
        raise HTTPException(
            status_code=400,
            detail=f"Já há documento na parcela {maior}. A quantidade não pode ser menor que {maior}.",
        )
    pedido.pagamento_qtd_parcelas = qtd
    if qtd == 1:
        pedido.pagamento_quitado_em = None
    pedido.atualizado_em = agora_operacional_naive()
    rotulo = "à vista (1 pagamento)" if qtd == 1 else f"em {qtd} parcelas"
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=f"Pagamento definido: {rotulo}.",
        usuario_id=_uid(usuario),
        status_anterior=pedido.status,
        status_novo=pedido.status,
    )
    return pedido


async def quitar_pagamento_infra(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    if not pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None)):
        raise HTTPException(status_code=400, detail="A quitação vale só para Infraestrutura.")
    if not getattr(pedido, "pagamento_qtd_parcelas", None):
        raise HTTPException(
            status_code=400,
            detail="Informe se o pagamento será à vista ou em quantas parcelas.",
        )
    if pedido.status != STATUS_ENVIADO:
        raise HTTPException(status_code=400, detail="Quite o pagamento antes de encerrar, com o pedido ainda aberto.")
    pedido.pagamento_quitado_em = agora_operacional_naive()
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto="Todos os valores deste pedido foram pagos.",
        usuario_id=_uid(usuario),
        status_anterior=pedido.status,
        status_novo=pedido.status,
    )
    return pedido


async def registrar_ausencia_contrato(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    if not pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None)):
        raise HTTPException(
            status_code=400,
            detail="A decisão de contrato vale para bem, serviço e manutenção de infraestrutura.",
        )
    perfil = str(usuario.get("perfil_acesso") or usuario.get("perfil") or "")
    sede = usuario_e_sede_compras(perfil=perfil, is_manutencao=bool(usuario.get("is_manutencao")))
    if not sede:
        if not usuario_pode_pedir(
            perfil=perfil,
            compras_modulo_ativo=bool(usuario.get("compras_modulo_ativo")),
            is_manutencao=bool(usuario.get("is_manutencao")),
            org_compras_ativo=True,
        ):
            raise HTTPException(status_code=403, detail="Sem permissão para registrar a ausência de contrato.")
        if pedido.instituicao_id != usuario.get("instituicao_id") and not usuario.get("is_manutencao"):
            raise HTTPException(status_code=403, detail="Essa decisão é do próprio projeto.")
    if pedido.status not in {STATUS_APROVADO, STATUS_ENVIADO}:
        raise HTTPException(
            status_code=400,
            detail="Registre o contrato depois que a Sede escolher e assinar o orçamento.",
        )
    sit = await situacao_contrato_infra(db, pedido)
    if sit["compra_executada"]:
        raise HTTPException(status_code=400, detail="A compra já foi executada.")
    if sit["contrato_pendente"] or sit["contrato_assinado"]:
        raise HTTPException(
            status_code=400,
            detail="Já existe contrato neste pedido. Exclua o arquivo antes de registrar que não há contrato.",
        )
    if sit["sem_contrato"]:
        return pedido
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=f"{TEXTO_SEM_CONTRATO} A compra pode ser executada.",
        usuario_id=_uid(usuario),
        status_anterior=pedido.status,
        status_novo=pedido.status,
    )
    pedido.atualizado_em = agora_operacional_naive()
    return pedido


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
        "classe_documento": getattr(anexo, "classe_documento", None),
        "etapa_contrato": getattr(anexo, "etapa_contrato", None),
        "parcela_numero": getattr(anexo, "parcela_numero", None),
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
        "parcela_numero": getattr(nota, "parcela_numero", None),
        "origem_dados": nota.origem_dados,
        "observacao": nota.observacao,
        "anexo_id": nota.anexo_id,
        "criado_em": _iso(nota.criado_em),
    }


def _serializar_evento(
    evento: ComprasPedidoEventoDB,
    *,
    lado: str = "projeto",
    autor_nome: Optional[str] = None,
    revisoes: Optional[list] = None,
) -> dict:
    return {
        "id": evento.id,
        "tipo": evento.tipo,
        "texto": evento.texto,
        "usuario_id": evento.usuario_id,
        "autor_nome": autor_nome,
        "lado": lado if evento.usuario_id else "",
        "cotacao_id": evento.cotacao_id,
        "anexo_id": evento.anexo_id,
        "status_anterior": evento.status_anterior,
        "status_novo": evento.status_novo,
        "aguardando_confirmacao": bool(getattr(evento, "aguardando_confirmacao", False)),
        "confirmado_em": _iso(getattr(evento, "confirmado_em", None)),
        "confirmado_por_id": getattr(evento, "confirmado_por_id", None),
        "criado_em": _iso(evento.criado_em),
        "revisoes": revisoes or [],
        "editavel": evento.tipo in {
            TIPO_EVENTO_PARECER,
            TIPO_EVENTO_NEGATIVA,
            TIPO_EVENTO_OBSERVACAO,
        },
    }


async def _autores_eventos(db: AsyncSession, usuario_ids: list[str]) -> dict[str, dict]:
    ids = [item for item in dict.fromkeys(usuario_ids) if item]
    if not ids:
        return {}
    rows = (
        await db.execute(
            select(UsuarioDB.id, UsuarioDB.nome, UsuarioDB.perfil_acesso).where(UsuarioDB.id.in_(ids))
        )
    ).all()
    return {
        row[0]: {
            "nome": row[1],
            "lado": lado_timeline_compras(perfil=row[2] or ""),
        }
        for row in rows
    }


async def _revisoes_eventos(db: AsyncSession, evento_ids: list[str]) -> dict[str, list]:
    if not evento_ids:
        return {}
    rows = (
        await db.execute(
            select(ComprasPedidoEventoRevisaoDB, UsuarioDB.nome)
            .outerjoin(UsuarioDB, UsuarioDB.id == ComprasPedidoEventoRevisaoDB.usuario_id)
            .where(ComprasPedidoEventoRevisaoDB.evento_id.in_(evento_ids))
            .order_by(ComprasPedidoEventoRevisaoDB.criado_em.desc())
        )
    ).all()
    saida: dict[str, list] = {}
    for revisao, nome in rows:
        saida.setdefault(revisao.evento_id, []).append({
            "id": revisao.id,
            "texto_anterior": revisao.texto_anterior,
            "usuario_id": revisao.usuario_id,
            "autor_nome": nome,
            "criado_em": _iso(revisao.criado_em),
        })
    return saida


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
    orcamentos_com_anexo = len({
        a.cotacao_id
        for a in anexos
        if a.cotacao_id and a.tipo == TIPO_ANEXO_ORCAMENTO
    } & {c.id for c in cotacoes if getattr(c, "ativa", True)})
    email_pedido_ok = any(
        e.tipo == TIPO_EVENTO_EMAIL and (e.texto or "").startswith("E-mail enviado para")
        for e in eventos
    )
    sit_contrato = situacao_contrato_de_registros(pedido, eventos, anexos)
    sit_pag = situacao_pagamento_de_registros(pedido, notas, anexos)
    autores = await _autores_eventos(db, [e.usuario_id for e in eventos if e.usuario_id])
    revisoes = await _revisoes_eventos(db, [e.id for e in eventos])

    return {
        "anexos": [_serializar_anexo(a) for a in anexos],
        "notas_fiscais": [_serializar_nota(n) for n in notas],
        "eventos": [
            _serializar_evento(
                e,
                lado=(autores.get(e.usuario_id) or {}).get("lado", "projeto"),
                autor_nome=(autores.get(e.usuario_id) or {}).get("nome"),
                revisoes=revisoes.get(e.id) or [],
            )
            for e in eventos
        ],
        "aviso_cotacoes": aviso_cotacoes_insuficientes(len(cotacoes), pedido.tipo),
        "aviso_alteracao_itens": aviso_alteracao,
        "precisa_revisar_cotacao": precisa_revisar,
        "pode_editar_itens": pedido_itens_podem_editar(pedido.status),
        "qtd_orcamentos": qtd_orcamentos,
        "orcamentos_com_anexo": orcamentos_com_anexo,
        "min_orcamentos_recomendados": MIN_COTACOES_RECOMENDADAS,
        "aviso_sede_sem_tres_orcamentos": (
            aviso_pedido_sem_tres_orcamentos_para_sede(orcamentos_com_anexo)
            if pedido.status == STATUS_AGUARDANDO_SEDE
            else None
        ),
        "pode_substituir_orcamento": False,  # preenchido em serializar_pedido com perfil
        "fornecedores_solicitacao": fornecedores_solicitacao,
        "motivo_reprovacao": pedido.motivo_reprovacao,
        "motivo_cancelamento": pedido.motivo_cancelamento,
        "status_anterior": pedido.status_anterior,
        "fechado_por_id": fechado_por,
        "pedido_compra_anexo_id": pedido.pedido_compra_anexo_id,
        "email_pedido_compra_enviado": bool(email_pedido_ok and pedido.pedido_compra_anexo_id),
        "compra_direta_sem_email": sit_contrato["compra_direta_sem_email"],
        "sem_contrato": sit_contrato["sem_contrato"],
        "contrato_assinado": sit_contrato["contrato_assinado"],
        "contrato_pendente": sit_contrato["contrato_pendente"],
        "compra_liberada": sit_contrato["compra_liberada"],
        "compra_executada": sit_contrato["compra_executada"],
        "pagamento_qtd_parcelas": sit_pag["qtd_parcelas"],
        "pagamento_quitado": sit_pag["quitado"],
        "pagamento_completo": sit_pag["completo"],
        "pagamento_parcelas": sit_pag["parcelas"],
        "pagamento_parcelas_pagas": sit_pag["parcelas_pagas"],
        "pode_reabrir": pedido.status in {STATUS_REPROVADO, STATUS_CANCELADO},
        "pode_reabrir_aprovado": pode_reabrir_orcamento_aprovado(
            status=pedido.status,
            pedido_compra_enviado=bool(email_pedido_ok and pedido.pedido_compra_anexo_id),
        ),
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
            return arquivo.conteudo, _content_type_anexo(arquivo.conteudo, getattr(arquivo, "content_type", None), rel)
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
    conteudo = base.read_bytes()
    return conteudo, _content_type_anexo(conteudo, None, base.name)


def _content_type_anexo(conteudo: bytes, declarado: Optional[str], nome: Optional[str] = None) -> str:
    """Evita application/octet-stream em PDF/imagem — senão o browser baixa blob com nome UUID e abre em branco."""
    bruto = (declarado or "").split(";", 1)[0].strip().lower()
    if bruto and bruto not in {"application/octet-stream", "binary/octet-stream"}:
        return bruto
    head = conteudo[:8] if conteudo else b""
    if head.startswith(b"%PDF"):
        return "application/pdf"
    if head.startswith(b"\x89PNG"):
        return "image/png"
    if head[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if head.startswith(b"GIF8"):
        return "image/gif"
    if head.startswith(b"RIFF") and conteudo[8:12] == b"WEBP":
        return "image/webp"
    nome_l = (nome or "").lower()
    if nome_l.endswith(".pdf"):
        return "application/pdf"
    if nome_l.endswith(".png"):
        return "image/png"
    if nome_l.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if nome_l.endswith(".webp"):
        return "image/webp"
    if nome_l.endswith(".xml"):
        return "application/xml"
    return bruto or "application/octet-stream"


async def upload_anexo_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    file: UploadFile,
    tipo: str,
    cotacao_id: Optional[str] = None,
    substituir_anexo_id: Optional[str] = None,
    conteudo: Optional[bytes] = None,
    classe_documento: Optional[str] = None,
    etapa_contrato: Optional[str] = None,
    parcela_numero: Optional[int] = None,
) -> ComprasPedidoAnexoDB:
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Processo encerrado não aceita novos anexos.")
    if tipo not in TIPOS_ANEXO_PEDIDO:
        raise HTTPException(status_code=400, detail="Tipo de anexo inválido.")
    classe = (classe_documento or "").strip().lower()
    if pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None)):
        if classe == CLASSE_DOC_CONTRATO and (etapa_contrato or "") != ETAPA_CONTRATO_ASSINADO:
            if pedido.status not in {STATUS_APROVADO, STATUS_ENVIADO}:
                raise HTTPException(
                    status_code=400,
                    detail="Anexe o contrato depois que a Sede escolher e assinar o orçamento.",
                )
            sit = await situacao_contrato_infra(db, pedido)
            if sit["compra_executada"]:
                raise HTTPException(status_code=400, detail="O contrato é anexado antes da compra.")
            if sit["contrato_pendente"] or sit["contrato_assinado"]:
                raise HTTPException(
                    status_code=400,
                    detail="Já existe contrato neste pedido. Exclua o atual antes de anexar outro.",
                )
        elif classe in {CLASSE_DOC_RELACIONADO, CLASSE_DOC_BOLETO, CLASSE_DOC_NOTA, CLASSE_DOC_COMPROVANTE}:
            await exigir_documentos_finais_infra(db, pedido)
            if classe != CLASSE_DOC_RELACIONADO:
                parcela_numero = _exigir_parcela_infra(pedido, {"parcela_numero": parcela_numero})

    if conteudo is None:
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
        classe_documento=(classe_documento or "").strip().lower() or None,
        parcela_numero=parcela_numero,
        etapa_contrato=(
            etapa_contrato
            or (ETAPA_CONTRATO_ROBSON if (classe_documento or "").strip().lower() == CLASSE_DOC_CONTRATO else None)
        ),
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
        texto=(
            f"Contrato assinado ({nome_original})."
            if (etapa_contrato or "") == ETAPA_CONTRATO_ASSINADO
            else (
                f"Contrato anexado ({nome_original}). Aguardando revisão da Infraestrutura."
                if (classe_documento or "").strip().lower() == CLASSE_DOC_CONTRATO
                else f"Arquivo anexado com sucesso ({tipo}: {nome_original}). Aguardando ok."
            )
        ),
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
        cotacao_id=cotacao_id,
    )
    pedido.atualizado_em = agora_operacional_naive()

    if tipo == TIPO_ANEXO_ORCAMENTO and cotacao_id:
        cotacao_alvo = next(
            (c for c in await _cotacoes_ativas(db, pedido.id) if c.id == cotacao_id and c.escolhida),
            None,
        )
        if cotacao_alvo:
            await unificar_orcamentos_vencedor(db, usuario, pedido, cotacao_alvo)

    # Com 3 orçamentos anexados (cotação do projeto), envia automaticamente à Sede.
    if (
        tipo == TIPO_ANEXO_ORCAMENTO
        and (
            tipo_eh_cotacao_projeto(pedido.tipo)
            or pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
        )
        and pedido.status in {STATUS_RASCUNHO, STATUS_EM_COTACAO, STATUS_AGUARDANDO_COTACAO}
    ):
        qtd = await contar_orcamentos_com_anexo(db, pedido.id)
        if qtd >= MIN_COTACOES_RECOMENDADAS:
            await enviar_cotacao_projeto_para_sede(
                db,
                usuario,
                pedido,
                automatico=True,
                confirmar_sem_tres_orcamentos=True,
            )

    # Cotação da Sede: com 3 PDFs anexados, libera a fase de escolha do vencedor.
    # Consumo não avança sozinho: Suprimentos dá ok para o projeto escolher.
    if (
        tipo == TIPO_ANEXO_ORCAMENTO
        and tipo_eh_cotacao_sede(pedido.tipo)
        and not pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
        and (pedido.tipo or "").strip().lower() != "consumo"
        and pedido.status in STATUS_COTACAO_SEDE_COLETANDO
    ):
        qtd = await contar_orcamentos_com_anexo(db, pedido.id)
        if qtd >= MIN_COTACOES_RECOMENDADAS:
            await _marcar_pronto_para_escolha_sede(
                db,
                usuario,
                pedido,
                motivo=(
                    f"Com {qtd} orçamentos anexados, pedido pronto para escolher o vencedor."
                ),
            )

    return anexo


async def arquivar_orcamento_assinado_govbr(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    file: UploadFile,
) -> ComprasPedidoAnexoDB:
    """Guarda o PDF assinado no gov.br e aprova o pedido na Sede."""
    segue_infra = pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
    if usuario_global_assina_orcamento(usuario):
        if (pedido.tipo or "").strip().lower() not in TIPOS_COTACAO_PROJETO and not segue_infra:
            raise HTTPException(
                status_code=403,
                detail="Esta autorização cobre bem, serviço e manutenção de infraestrutura.",
            )
    elif not usuario_pode_aprovar_sede(
        perfil=str(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        raise HTTPException(status_code=403, detail="Somente ADM Compras aprova na Sede.")
    if not usuario_global_assina_orcamento(usuario) and not usuario_sede_pode_ver_tipo(
        perfil=str(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        tipo=pedido.tipo,
        is_manutencao=bool(usuario.get("is_manutencao")),
        destino=getattr(pedido, "destino_compras", None),
    ):
        raise HTTPException(status_code=403, detail="Pedido fora do escopo da sua classe de Compras.")
    if not tipo_eh_cotacao_projeto(pedido.tipo) and not segue_infra:
        raise HTTPException(
            status_code=400,
            detail="O arquivo do gov.br entra em orçamento de bem, serviço ou manutenção de infraestrutura.",
        )
    if pedido.status != STATUS_AGUARDANDO_SEDE:
        raise HTTPException(status_code=400, detail="Pedido não está aguardando aprovação da Sede.")
    if not pedido.aprovado_unidade_em and not pedido_escopo_sede(getattr(pedido, "escopo_unidade", None)):
        raise HTTPException(
            status_code=400,
            detail="O projeto precisa enviar o pedido à Sede antes da assinatura.",
        )

    nome = (file.filename or "").strip()
    if not nome.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Envie o PDF assinado no gov.br.")

    escolhida = (
        await db.execute(
            select(ComprasCotacaoDB).where(
                ComprasCotacaoDB.pedido_id == pedido.id,
                ComprasCotacaoDB.escolhida.is_(True),
                ComprasCotacaoDB.ativa.is_(True),
            )
        )
    ).scalars().first()
    if not escolhida:
        raise HTTPException(status_code=400, detail="Escolha o orçamento vencedor antes de arquivar o PDF.")

    conteudo = await file.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="O arquivo está vazio.")

    caminho, nome_original, tamanho, content_type = await salvar_arquivo_compras(
        organizacao_id=pedido.organizacao_id,
        pedido_id=pedido.id,
        file=file,
        conteudo=conteudo,
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
    for anterior in anteriores:
        anterior.ativo = False
        remover_arquivo_compras(anterior.caminho_arquivo)

    agora = agora_operacional_naive()
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
    assinante = (
        usuario.get("nome") or usuario.get("nome_completo") or usuario.get("email") or "ADM Compras"
    ).strip()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=(
            f"ATO DE ASSINATURA: {assinante} arquivou o PDF assinado no gov.br "
            f"({nome_original}) do orçamento de {escolhida.fornecedor_nome}. "
            "Pedido aprovado na Sede."
        ),
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
        cotacao_id=escolhida.id,
        status_anterior=STATUS_AGUARDANDO_SEDE,
        status_novo=STATUS_APROVADO,
    )
    return anexo


async def enviar_cotacao_projeto_para_sede(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    automatico: bool = False,
    confirmar_sem_tres_orcamentos: bool = False,
) -> ComprasPedidoDB:
    """Projeto envia à Sede para escolha/assinatura (sem exigir orçamento escolhido)."""
    segue_infra = pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
    if not tipo_eh_cotacao_projeto(pedido.tipo) and not segue_infra:
        raise HTTPException(status_code=400, detail="Envio à Sede para assinatura vale para cotação do projeto.")
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
    if not itens_proj and not segue_infra:
        raise HTTPException(status_code=400, detail="Inclua ao menos um item antes de enviar.")

    qtd_com_anexo = await contar_orcamentos_com_anexo(db, pedido.id)
    if qtd_com_anexo < 1:
        raise HTTPException(
            status_code=400,
            detail="Anexe ao menos um orçamento (PDF) antes de enviar à Sede.",
        )
    if qtd_com_anexo < MIN_COTACOES_RECOMENDADAS and not confirmar_sem_tres_orcamentos:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "orcamentos_insuficientes",
                "message": (
                    f"Você ainda não anexou os {MIN_COTACOES_RECOMENDADAS} orçamentos "
                    f"(há {qtd_com_anexo}). É importante que {MIN_COTACOES_RECOMENDADAS} "
                    "orçamentos sejam anexados antes do envio para o parecer da Sede. "
                    "Deseja enviar mesmo assim?"
                ),
                "orcamentos_com_anexo": qtd_com_anexo,
                "min_recomendado": MIN_COTACOES_RECOMENDADAS,
            },
        )

    status_anterior = pedido.status
    pedido.aprovado_unidade_por_id = _uid(usuario)
    pedido.aprovado_unidade_em = agora_operacional_naive()
    pedido.status = STATUS_AGUARDANDO_SEDE
    pedido.submetido_em = agora_operacional_naive()
    pedido.atualizado_em = agora_operacional_naive()
    if automatico:
        texto = (
            f"Pedido enviado automaticamente à Sede para escolha e assinatura "
            f"({qtd_com_anexo} orçamentos anexados)."
        )
    elif qtd_com_anexo < MIN_COTACOES_RECOMENDADAS:
        texto = (
            f"Pedido enviado à Sede para assinatura sem os {MIN_COTACOES_RECOMENDADAS} "
            f"orçamentos (apenas {qtd_com_anexo}). Projeto confirmou o envio antecipado."
        )
    else:
        texto = "Pedido enviado à Sede para escolha do orçamento e assinatura."
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=texto,
        usuario_id=_uid(usuario),
        status_anterior=status_anterior,
        status_novo=pedido.status,
    )
    return pedido


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


async def editar_texto_evento_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    evento_id: str,
    texto: str,
) -> ComprasPedidoEventoDB:
    """Corrige observação, parecer ou negativa e guarda o texto anterior."""
    evento = (
        await db.execute(
            select(ComprasPedidoEventoDB).where(
                ComprasPedidoEventoDB.id == evento_id,
                ComprasPedidoEventoDB.pedido_id == pedido.id,
            )
        )
    ).scalar_one_or_none()
    if not evento:
        raise HTTPException(status_code=404, detail="Registro da timeline não encontrado.")
    if evento.tipo not in {TIPO_EVENTO_PARECER, TIPO_EVENTO_NEGATIVA, TIPO_EVENTO_OBSERVACAO}:
        raise HTTPException(status_code=400, detail="Só é possível corrigir observação, parecer ou negativa.")
    novo = (texto or "").strip()
    if not novo:
        raise HTTPException(status_code=400, detail="Informe o texto.")
    anterior = (evento.texto or "").strip()
    if novo == anterior:
        return evento
    db.add(
        ComprasPedidoEventoRevisaoDB(
            evento_id=evento.id,
            texto_anterior=evento.texto,
            usuario_id=_uid(usuario),
            criado_em=agora_operacional_naive(),
        )
    )
    evento.texto = novo
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


async def reabrir_orcamento_aprovado(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    motivo: str,
) -> ComprasPedidoDB:
    """A Sede desfaz a aprovação e devolve o pedido à escolha do orçamento vencedor."""
    if not sede_pode_reabrir_aprovado(usuario, pedido.tipo):
        raise HTTPException(status_code=403, detail="Somente a Sede pode reabrir um orçamento aprovado.")
    texto = (motivo or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Informe o motivo da reabertura.")
    if pedido.status != STATUS_APROVADO:
        raise HTTPException(
            status_code=400,
            detail="Só um pedido aprovado, ainda não enviado ao fornecedor, pode ser reaberto.",
        )
    eventos = await _eventos_pedido(db, pedido.id)
    email_enviado = any(
        evento.tipo == TIPO_EVENTO_EMAIL and (evento.texto or "").startswith("E-mail enviado para")
        for evento in eventos
    )
    if email_enviado and pedido.pedido_compra_anexo_id:
        raise HTTPException(
            status_code=400,
            detail="O pedido de compra já foi enviado ao fornecedor. Não é possível reabrir.",
        )

    cotacoes = await _cotacoes_ativas(db, pedido.id)
    for cotacao in cotacoes:
        cotacao.escolhida = False
        await restaurar_orcamentos_originais_cotacao(db, cotacao.id)

    anexos = await _anexos_pedido(db, pedido.id)
    for anexo in anexos:
        if anexo.tipo in {TIPO_ANEXO_ORCAMENTO_ASSINADO, TIPO_ANEXO_PEDIDO_PDF}:
            anexo.ativo = False
    pedido.pedido_compra_anexo_id = None
    pedido.aprovado_unidade_por_id = None
    pedido.aprovado_unidade_em = None
    pedido.aprovado_sede_por_id = None
    pedido.aprovado_sede_em = None
    anterior = pedido.status
    pedido.status = STATUS_AGUARDANDO_ESCOLHA
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=(
            f"Sede reabriu o orçamento aprovado. Motivo: {texto}. "
            "O processo voltou para a escolha do orçamento vencedor e precisa de nova aprovação."
        ),
        usuario_id=_uid(usuario),
        status_anterior=anterior,
        status_novo=STATUS_AGUARDANDO_ESCOLHA,
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
    *,
    fornecedor_nome: Optional[str] = None,
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
    if not escolhida and not (tipo_suprimentos_aprova_e_envia(pedido.tipo) or fornecedor_nome):
        raise HTTPException(status_code=400, detail="Escolha uma cotação antes de gerar o pedido.")

    org = (
        await db.execute(select(OrganizacaoDB).where(OrganizacaoDB.id == pedido.organizacao_id))
    ).scalar_one_or_none()
    inst = await _dados_instituicao(db, pedido)
    identidade = await _identidade_relatorio_pedido(db, pedido, org)
    logo_bytes = _logo_bytes_relatorio(identidade.get("relatorio_logo_url"))
    numero = pedido.id.split("-")[0].upper()[:8]
    data_pedido = formatar_data_br_compras(data_operacional())
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
            "fornecedor_nome": (escolhida.fornecedor_nome if escolhida else None) or fornecedor_nome,
            "valor_centavos": escolhida.valor_centavos if escolhida else None,
        },
        numero_pedido=numero,
        identidade=identidade,
        logo_bytes=logo_bytes,
        data_pedido=data_pedido,
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


async def _orcamento_assinado_pedido(
    db: AsyncSession,
    pedido: ComprasPedidoDB,
    escolhida: Optional[ComprasCotacaoDB] = None,
) -> Optional[ComprasPedidoAnexoDB]:
    if escolhida:
        achado = (
            await db.execute(
                select(ComprasPedidoAnexoDB).where(
                    ComprasPedidoAnexoDB.pedido_id == pedido.id,
                    ComprasPedidoAnexoDB.cotacao_id == escolhida.id,
                    ComprasPedidoAnexoDB.tipo == TIPO_ANEXO_ORCAMENTO_ASSINADO,
                    ComprasPedidoAnexoDB.ativo.is_(True),
                ).order_by(ComprasPedidoAnexoDB.criado_em.desc())
            )
        ).scalars().first()
        if achado:
            return achado
    return (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.tipo == TIPO_ANEXO_ORCAMENTO_ASSINADO,
                ComprasPedidoAnexoDB.ativo.is_(True),
            ).order_by(ComprasPedidoAnexoDB.criado_em.desc())
        )
    ).scalars().first()


async def _pacote_orcamento_para_email(
    db: AsyncSession,
    pedido: ComprasPedidoDB,
    escolhida: Optional[ComprasCotacaoDB],
) -> list[ComprasPedidoAnexoDB]:
    """Orçamentos do vencedor que vão no e-mail com o pedido de compra."""
    if not escolhida:
        return []
    anexos = list(await _anexos_orcamento_da_cotacao(db, escolhida.id))
    assinado = await _orcamento_assinado_pedido(db, pedido, escolhida)
    if assinado and all(getattr(item, "id", None) != assinado.id for item in anexos):
        anexos.append(assinado)
    return anexos_orcamento_para_envio(anexos)


async def rascunho_email_compras(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    tipo: str,
) -> dict:
    _exigir_envio_email_compras(usuario)
    tipo_n = (tipo or "").strip().lower()
    if tipo_n not in {"cotacao", "pedido_compra"}:
        raise HTTPException(status_code=400, detail="Tipo de rascunho inválido.")
    inst = await _dados_instituicao(db, pedido)
    projeto = (inst or {}).get("nome") or "projeto"
    if tipo_n == "cotacao":
        categoria = categoria_email_cotacao(pedido)
        data_br = formatar_data_br_compras(data_operacional())
        assunto = assunto_solicitacao_cotacao(projeto=projeto, categoria=categoria)
        corpo = corpo_padrao_solicitacao_cotacao(
            projeto=projeto,
            competencia=data_br,
            categoria=categoria,
            data_br=data_br,
        )
    else:
        cotacoes = await _cotacoes_ativas(db, pedido.id)
        escolhida = next((c for c in cotacoes if c.escolhida), None)
        pacote = await _pacote_orcamento_para_email(db, pedido, escolhida)
        assinado = any(getattr(a, "tipo", None) == TIPO_ANEXO_ORCAMENTO_ASSINADO for a in pacote)
        assunto = f"Pedido de compra CareCore · {projeto} · {pedido.competencia}"
        corpo = corpo_padrao_pedido_compra(
            projeto=projeto,
            com_orcamento=bool(pacote),
            com_orcamento_assinado=assinado,
        )
    return {
        "tipo": tipo_n,
        "assunto": assunto,
        "corpo": corpo,
        "assinatura": metadados_assinatura(usuario),
    }


async def enviar_email_fornecedor(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    corpo: str | None = None,
    fornecedor_id: str | None = None,
) -> dict:
    _exigir_envio_email_compras(usuario)
    await exigir_compra_liberada_infra(db, pedido)
    nome_envio = None
    if fornecedor_id and tipo_suprimentos_aprova_e_envia(pedido.tipo):
        forn_envio = (
            await db.execute(
                select(ComprasFornecedorDB).where(
                    ComprasFornecedorDB.id == fornecedor_id,
                    ComprasFornecedorDB.organizacao_id == pedido.organizacao_id,
                )
            )
        ).scalar_one_or_none()
        if not forn_envio or not forn_envio.ativo:
            raise HTTPException(status_code=400, detail="Fornecedor inválido para o envio.")
        nome_envio = forn_envio.nome
    cotacoes_ativas = await _cotacoes_ativas(db, pedido.id)
    tem_escolhida = any(c.escolhida for c in cotacoes_ativas)
    if not pedido.pedido_compra_anexo_id or (nome_envio and not tem_escolhida):
        await gerar_pedido_compra(db, usuario, pedido, fornecedor_nome=nome_envio)
    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(ComprasPedidoAnexoDB.id == pedido.pedido_compra_anexo_id)
        )
    ).scalar_one_or_none()
    if not anexo:
        raise HTTPException(status_code=400, detail="Pedido de compra não gerado.")

    cotacoes = await _cotacoes_ativas(db, pedido.id)
    escolhida = next((c for c in cotacoes if c.escolhida), None)
    if escolhida:
        await unificar_orcamentos_vencedor(db, usuario, pedido, escolhida)
    email_dest = None
    if escolhida and escolhida.fornecedor_id:
        forn = (
            await db.execute(
                select(ComprasFornecedorDB).where(ComprasFornecedorDB.id == escolhida.fornecedor_id)
            )
        ).scalar_one_or_none()
        if forn:
            email_dest = (forn.email or forn.email_empresa or "").strip()

    if not email_dest and fornecedor_id and tipo_suprimentos_aprova_e_envia(pedido.tipo):
        forn = (
            await db.execute(
                select(ComprasFornecedorDB).where(ComprasFornecedorDB.id == fornecedor_id)
            )
        ).scalar_one_or_none()
        if forn:
            email_dest = (forn.email or forn.email_empresa or "").strip()
    if not email_dest:
        raise HTTPException(
            status_code=400,
            detail="Informe um fornecedor com e-mail para enviar o pedido."
            if tipo_suprimentos_aprova_e_envia(pedido.tipo)
            else "Fornecedor escolhido não tem e-mail cadastrado.",
        )

    bytes_arquivo, content_type = ler_bytes_anexo(anexo.caminho_arquivo)
    anexos_extras: list[tuple[str, bytes, str]] = []
    pacote = await _pacote_orcamento_para_email(db, pedido, escolhida)
    if escolhida and not pacote:
        raise HTTPException(
            status_code=400,
            detail="O orçamento do vencedor precisa acompanhar o pedido de compra.",
        )
    for extra in pacote:
        try:
            bytes_extra, tipo_extra = ler_bytes_anexo(extra.caminho_arquivo)
        except Exception as exc:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Não foi possível ler «{extra.nome_arquivo}» para enviar "
                    f"com o pedido de compra: {exc}"
                ),
            ) from exc
        anexos_extras.append(
            (
                extra.nome_arquivo or "orcamento.pdf",
                bytes_extra,
                tipo_extra
                or getattr(extra, "content_type", None)
                or "application/pdf",
            )
        )
    orcamento_assinado = next(
        (item for item in pacote if getattr(item, "tipo", None) == TIPO_ANEXO_ORCAMENTO_ASSINADO),
        None,
    )

    inst = await _dados_instituicao(db, pedido)
    projeto = (inst or {}).get("nome") or "projeto"
    assunto = f"Pedido de compra CareCore · {projeto} · {pedido.competencia}"
    padrao = corpo_padrao_pedido_compra(
        projeto=projeto,
        com_orcamento=bool(anexos_extras),
        com_orcamento_assinado=bool(orcamento_assinado),
    )
    corpo_texto, corpo_html, imagens_inline = preparar_envio_email_compras(
        usuario=usuario,
        corpo=corpo,
        padrao=padrao,
    )
    resultado = enviar_email_smtp_com_anexo(
        assunto=assunto,
        corpo=corpo_texto,
        para=email_dest,
        anexo_nome=anexo.nome_arquivo,
        anexo_bytes=bytes_arquivo,
        anexo_content_type=content_type or getattr(anexo, "content_type", None) or "application/pdf",
        perfil="compras",
        mailbox=(inst or {}).get("email_adm_compras") if tipo_eh_cotacao_projeto(pedido.tipo) else None,
        anexos_extras=anexos_extras or None,
        corpo_html=corpo_html,
        imagens_inline=imagens_inline or None,
    )
    if resultado.enviado:
        if anexos_extras:
            nomes = ", ".join(nome for nome, _b, _t in anexos_extras)
            extras = f" + orçamento ({nomes})."
        else:
            extras = "."
        texto_evento = f"E-mail enviado para {email_dest}{extras}"
    else:
        texto_evento = f"Falha no e-mail: {resultado.erro}"
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_EMAIL,
        texto=texto_evento,
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
    )
    return {
        "enviado": resultado.enviado,
        "erro": resultado.erro,
        "destinatario": email_dest,
        "orcamento_anexado": bool(anexos_extras and resultado.enviado),
        "orcamento_assinado_anexado": bool(orcamento_assinado and resultado.enviado),
    }


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
    corpo: str | None = None,
) -> dict:
    """Envia pedido de cotação por e-mail: um To por fornecedor (nunca lista no mesmo e-mail)."""
    _exigir_envio_email_compras(usuario)
    perfil = str(usuario.get("perfil_acesso") or usuario.get("perfil") or "")
    sede = usuario_e_sede_compras(
        perfil=perfil,
        is_manutencao=bool(usuario.get("is_manutencao")),
    )
    cotacao_projeto = (
        tipo_eh_cotacao_projeto(pedido.tipo)
        or pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
    )
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
        raise HTTPException(status_code=403, detail="Pedido de cotação de consumo/hortifruti é enviado pela Sede (ADM Compras).")
    elif not tipo_eh_cotacao_sede(pedido.tipo):
        raise HTTPException(status_code=400, detail="Pedido de cotação por e-mail da Sede é para consumo ou hortifruti.")

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
    data_pedido = formatar_data_br_compras(data_operacional())
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
        data_pedido=data_pedido,
    )
    anexo_nome = f"solicitacao-cotacao-{numero}.pdf"
    projeto = (inst or {}).get("nome") or "projeto"
    categoria = categoria_email_cotacao(pedido)
    data_br = formatar_data_br_compras(data_operacional())
    assunto = assunto_solicitacao_cotacao(projeto=projeto, categoria=categoria)
    padrao = corpo_padrao_solicitacao_cotacao(
        projeto=projeto,
        competencia=data_br,
        categoria=categoria,
        data_br=data_br,
    )
    corpo_texto, corpo_html, imagens_inline = preparar_envio_email_compras(
        usuario=usuario,
        corpo=corpo,
        padrao=padrao,
    )

    enviados: list[dict] = []
    falhas: list[dict] = []
    # Ordem da seleção do usuário
    ordenados = [mapa[fid] for fid in ids]
    for forn in ordenados:
        email_dest = _email_destino_fornecedor(forn)
        resultado = enviar_email_smtp_com_anexo(
            assunto=assunto,
            corpo=corpo_texto,
            para=email_dest,
            anexo_nome=anexo_nome,
            anexo_bytes=anexo_bytes,
            anexo_content_type="application/pdf",
            perfil="compras",
            mailbox=mailbox_projeto,
            corpo_html=corpo_html,
            imagens_inline=imagens_inline or None,
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


async def _validar_assinatura_eletronica_gestor(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    senha: str,
) -> tuple[UsuarioDB, str, str]:
    """Confere a senha do gestor e devolve o nome dele e o do projeto para o carimbo."""
    from security import normalizar_perfil_acesso

    perfil = normalizar_perfil_acesso(
        str(usuario.get("perfil_acesso") or usuario.get("perfil") or "").strip()
    )
    if not _usuario_do_projeto_anexa_nf(usuario):
        raise HTTPException(
            status_code=403,
            detail="A assinatura digital do gestor pode ser usada pelo gestor, pelo técnico, pelo administrativo ou pelo ADM Pedidos do projeto.",
        )
    if (
        pedido.instituicao_id
        and usuario.get("instituicao_id")
        and pedido.instituicao_id != usuario.get("instituicao_id")
        and not usuario.get("is_manutencao")
    ):
        raise HTTPException(
            status_code=403,
            detail="A assinatura da nota fiscal é do gestor deste projeto.",
        )
    senha_limpa = (senha or "").strip()
    if not senha_limpa:
        raise HTTPException(
            status_code=400,
            detail="Informe a senha da assinatura eletrônica do gestor.",
        )
    gestores = list(
        (
            await db.execute(
                select(UsuarioDB).where(
                    UsuarioDB.instituicao_id == pedido.instituicao_id,
                    UsuarioDB.perfil_acesso.in_(("Gestor", "Gestao", "Gestão")),
                    UsuarioDB.ativo.is_(True),
                )
            )
        ).scalars().all()
    )
    if perfil == "Gestor":
        proprio = next((g for g in gestores if g.id == _uid(usuario)), None)
        if proprio is None:
            proprio = (
                await db.execute(select(UsuarioDB).where(UsuarioDB.id == _uid(usuario)))
            ).scalar_one_or_none()
        if proprio:
            gestores = [proprio] + [g for g in gestores if g.id != proprio.id]
    com_senha = [g for g in gestores if getattr(g, "assinatura_eletronica_senha_hash", None)]
    if not com_senha:
        raise HTTPException(
            status_code=400,
            detail="Cadastre a senha de assinatura eletrônica no perfil do gestor, em Usuários.",
        )
    row = next((g for g in com_senha if verificar_senha(senha_limpa, g.assinatura_eletronica_senha_hash)), None)
    if row is None:
        raise HTTPException(status_code=400, detail="Senha da assinatura eletrônica incorreta.")
    inst = await _dados_instituicao(db, pedido)
    projeto = ((inst or {}).get("relatorio_nome_exibicao") or (inst or {}).get("nome") or "Projeto").strip()
    nome = (row.nome or "Gestor").strip()
    return row, nome, projeto


async def registrar_nota_fiscal(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    file: Optional[UploadFile],
    conteudo_xml: Optional[bytes],
    payload: dict,
    pdfs_junto: Optional[list[bytes]] = None,
) -> ComprasPedidoNotaFiscalDB:
    if tipo_pula_orcamento(pedido.tipo):
        if pedido.status not in {
            STATUS_RASCUNHO,
            STATUS_AGUARDANDO_PAGAMENTO,
            STATUS_AGUARDANDO_EXTRATO,
        }:
            raise HTTPException(status_code=400, detail="Não é mais possível anexar nota neste pedido.")
    else:
        if pedido.status != STATUS_ENVIADO:
            raise HTTPException(status_code=400, detail="Notas fiscais só após envio ao fornecedor.")
        await exigir_documentos_finais_infra(db, pedido)
    classe_doc = (payload.get("classe_documento") or CLASSE_DOC_NOTA).strip().lower()
    parcela_numero = _exigir_parcela_infra(pedido, payload)
    segue_infra = pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
    if classe_doc != "boleto" and not segue_infra:
        ja_tem_nf = (
            await db.execute(
                select(ComprasPedidoNotaFiscalDB.id).where(
                    ComprasPedidoNotaFiscalDB.pedido_id == pedido.id,
                    ComprasPedidoNotaFiscalDB.anexo_id.isnot(None),
                    ComprasPedidoNotaFiscalDB.tipo_nf != "boleto",
                )
            )
        ).first()
    else:
        ja_tem_nf = None
    if ja_tem_nf:
        raise HTTPException(
            status_code=400,
            detail="Já existe nota fiscal anexada neste processo. Exclua o arquivo antes de anexar outra.",
        )
    _gestor_row, nome_gestor, nome_projeto = await _validar_assinatura_eletronica_gestor(
        db,
        usuario,
        pedido,
        str(payload.get("senha_assinatura_eletronica") or ""),
    )

    campos = {
        "tipo_nf": "boleto" if (payload.get("classe_documento") or "").strip().lower() == "boleto" else (payload.get("tipo_nf") or "produto").strip().lower(),
        "numero": (payload.get("numero") or "").strip() or None,
        "serie": (payload.get("serie") or "").strip() or None,
        "chave_acesso": (payload.get("chave_acesso") or "").strip() or None,
        "emitente_nome": (payload.get("emitente_nome") or "").strip() or None,
        "emitente_cnpj": (payload.get("emitente_cnpj") or "").strip() or None,
        "observacao": (payload.get("observacao") or "").strip() or None,
        "origem_dados": "manual",
    }
    if payload.get("valor_centavos") is not None and str(payload.get("valor_centavos")).strip() != "":
        try:
            campos["valor_centavos"] = int(payload["valor_centavos"])
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Valor da NF inválido.") from exc
    elif payload.get("valor_reais") not in (None, ""):
        centavos = reais_para_centavos(payload.get("valor_reais"))
        if centavos is None:
            raise HTTPException(
                status_code=400,
                detail="Valor da NF inválido. Use formato como 400,00 ou 400.00.",
            )
        campos["valor_centavos"] = centavos
    if payload.get("data_emissao"):
        try:
            campos["data_emissao"] = date.fromisoformat(str(payload["data_emissao"])[:10])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Data de emissão da NF inválida.") from exc

    tipo_anexo = TIPO_ANEXO_NF_PDF
    anexo = None
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="Arquivo da NF está vazio.")
        extras = [parte for parte in (pdfs_junto or []) if parte]
        if extras and ext == ".pdf":
            raw = juntar_pdfs([raw, *extras])
        texto_nf = (campos.get("observacao") or "").strip()
        if ext == ".pdf":
            try:
                if texto_nf:
                    raw = carimbar_texto_pdf(
                        pdf_bytes=raw,
                        texto=texto_nf,
                        projeto=nome_projeto,
                        todas_as_paginas=True,
                        page_index=int(payload.get("carimbo_pagina") or 0),
                        x=float(payload.get("carimbo_x") or 36),
                        y=float(payload.get("carimbo_y") or 36),
                        width=float(payload.get("carimbo_w") or 240),
                        height=float(payload.get("carimbo_h") or 48),
                    )
                tem_posicao_assinatura = payload.get("assinatura_x") not in (None, "") and payload.get("assinatura_y") not in (None, "")
                raw = carimbar_assinatura_gestor_pdf(
                    pdf_bytes=raw,
                    nome=nome_gestor,
                    projeto=nome_projeto,
                    todas_as_paginas=True,
                    page_index=int(
                        (payload.get("assinatura_pagina") if tem_posicao_assinatura else payload.get("carimbo_pagina"))
                        or 0
                    ),
                    x=float(payload["assinatura_x"]) if tem_posicao_assinatura else None,
                    y=float(payload["assinatura_y"]) if tem_posicao_assinatura else None,
                    width=float(payload["assinatura_w"]) if payload.get("assinatura_w") not in (None, "") else None,
                    height=float(payload["assinatura_h"]) if payload.get("assinatura_h") not in (None, "") else None,
                    ancora_x=None if tem_posicao_assinatura or payload.get("carimbo_x") in (None, "") else float(payload["carimbo_x"]),
                    ancora_y=None if tem_posicao_assinatura or payload.get("carimbo_y") in (None, "") else float(payload["carimbo_y"]),
                    ancora_h=float(payload.get("carimbo_h") or 0),
                )
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=400, detail=str(exc) or "Não foi possível gravar a assinatura na NF.") from exc
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
        anexo = await upload_anexo_pedido(
            db,
            usuario,
            pedido,
            file=file,
            tipo=tipo_anexo,
            conteudo=raw,
            classe_documento=classe_doc,
            parcela_numero=parcela_numero,
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
        parcela_numero=parcela_numero,
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
        texto=(
            f"Nota fiscal registrada{f' nº {nota.numero}' if nota.numero else ''}. "
            f"Assinado Digitalmente por {nome_gestor}, gestor de {nome_projeto}."
        ),
        usuario_id=_uid(usuario),
        anexo_id=anexo.id if anexo else None,
    )
    pedido.atualizado_em = agora_operacional_naive()
    return nota


async def remover_nota_fiscal(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    nota_id: str,
) -> None:
    if tipo_pula_orcamento(pedido.tipo):
        if not _usuario_do_projeto_anexa_nf(usuario):
            raise HTTPException(
                status_code=403,
                detail="Somente o projeto exclui a nota fiscal assinada.",
            )
        if pedido.status not in {STATUS_RASCUNHO, STATUS_AGUARDANDO_PAGAMENTO}:
            raise HTTPException(status_code=400, detail="A NF só pode ser removida enquanto o pedido ainda não foi encerrado.")
    elif pedido.status != STATUS_ENVIADO:
        raise HTTPException(status_code=400, detail="A NF só pode ser removida antes de encerrar o processo.")
    nota = (
        await db.execute(
            select(ComprasPedidoNotaFiscalDB).where(
                ComprasPedidoNotaFiscalDB.id == nota_id,
                ComprasPedidoNotaFiscalDB.pedido_id == pedido.id,
            )
        )
    ).scalar_one_or_none()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota fiscal não encontrada.")
    if nota.anexo_id:
        anexo = (
            await db.execute(
                select(ComprasPedidoAnexoDB).where(ComprasPedidoAnexoDB.id == nota.anexo_id)
            )
        ).scalar_one_or_none()
        if anexo:
            anexo.ativo = False
    await db.delete(nota)
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_ANEXO,
        texto="Nota fiscal removida para nova inclusão.",
        usuario_id=_uid(usuario),
    )


def _uid_caixa(usuario: dict) -> str | None:
    return (usuario.get("id") or usuario.get("sub") or usuario.get("usuario_id") or "") or None


def _preservar_atualizacao(pedido: ComprasPedidoDB):
    return pedido.atualizado_em


def marcar_leitura_caixa_suprimentos(usuario: dict, pedido: ComprasPedidoDB) -> bool:
    """Abrir um pedido concluído marca a mensagem como lida na caixa de Suprimentos."""
    if perfil_adm_compras_sede(usuario) != "suprimentos":
        return False
    if (pedido.status or "") not in STATUS_TERMINAIS_PEDIDO:
        return False
    if getattr(pedido, "suprimentos_lida_em", None):
        return False
    momento = _preservar_atualizacao(pedido)
    pedido.suprimentos_lida_em = agora_operacional_naive()
    pedido.suprimentos_lida_por_id = _uid_caixa(usuario)
    pedido.atualizado_em = momento
    return True


def registrar_impressao_nf_suprimentos(
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    encerrar: bool = False,
) -> None:
    """Registra impressão da NF. Em Imprimir NF, pode enviar o pedido para Encerrado."""
    perfil = str(usuario.get("perfil_acesso") or usuario.get("perfil") or "")
    if not usuario_e_sede_compras(perfil=perfil, is_manutencao=bool(usuario.get("is_manutencao"))):
        raise HTTPException(
            status_code=403,
            detail="Somente Infraestrutura ou Suprimentos registram a impressão da nota fiscal.",
        )
    if pedido.status not in {STATUS_RECEBIDO, STATUS_IMPRIMIR_NF}:
        raise HTTPException(
            status_code=400,
            detail="A impressão da NF fica disponível depois que o projeto encerra o processo.",
        )
    if not getattr(pedido, "nf_impressa_em", None):
        momento = _preservar_atualizacao(pedido)
        pedido.nf_impressa_em = agora_operacional_naive()
        pedido.nf_impressa_por_id = _uid_caixa(usuario)
        pedido.atualizado_em = momento
    if encerrar and pedido.status == STATUS_IMPRIMIR_NF:
        pedido.status = STATUS_RECEBIDO
        pedido.atualizado_em = agora_operacional_naive()


async def registrar_impressao_nf_e_opcional_encerrar(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    encerrar: bool = False,
) -> None:
    anterior = pedido.status
    registrar_impressao_nf_suprimentos(usuario, pedido, encerrar=encerrar)
    if encerrar and anterior == STATUS_IMPRIMIR_NF and pedido.status == STATUS_RECEBIDO:
        await registrar_evento_pedido(
            db,
            pedido_id=pedido.id,
            tipo=TIPO_EVENTO_STATUS,
            texto="Pedido encerrado após impressão da nota fiscal.",
            usuario_id=_uid(usuario),
            status_anterior=anterior,
            status_novo=STATUS_RECEBIDO,
        )


async def encerrar_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    payload: dict,
) -> ComprasPedidoDB:
    emergencia = tipo_eh_emergencia(pedido.tipo)
    if emergencia:
        if pedido.status != STATUS_AGUARDANDO_EXTRATO:
            raise HTTPException(
                status_code=400,
                detail="Encerramento da emergência só depois do envio da NF para pagamento e o projeto conferir o extrato.",
            )
    elif pedido.status != STATUS_ENVIADO:
        raise HTTPException(status_code=400, detail="Encerramento só após envio ao fornecedor.")
    notas = await _notas_pedido(db, pedido.id)
    notas_nf = [n for n in notas if (n.tipo_nf or "") != "boleto"]
    if emergencia:
        if not notas_nf:
            raise HTTPException(status_code=400, detail="Anexe ao menos uma nota fiscal antes de encerrar.")
    else:
        sit_pag = situacao_pagamento_de_registros(pedido, notas, await _anexos_pedido(db, pedido.id))
        if sit_pag["segue"]:
            if not notas_nf:
                raise HTTPException(status_code=400, detail="Anexe ao menos uma nota fiscal antes de encerrar.")
            if not sit_pag["completo"]:
                raise HTTPException(
                    status_code=400,
                    detail="Registre o pagamento de cada parcela (NF ou comprovante) ou marque que todos os valores já foram pagos.",
                )
        elif not notas:
            raise HTTPException(status_code=400, detail="Anexe ao menos uma nota fiscal antes de encerrar.")
        eventos_assinatura = (
            await db.execute(
                select(ComprasPedidoEventoDB).where(ComprasPedidoEventoDB.pedido_id == pedido.id)
            )
        ).scalars().all()
        if not any("Assinado Digitalmente" in (evento.texto or "") for evento in eventos_assinatura):
            raise HTTPException(
                status_code=400,
                detail="Encerre somente depois da assinatura eletrônica do gestor na nota fiscal.",
            )

    pedido.recebido_em = agora_operacional_naive()
    pedido.recebido_por_id = _uid(usuario)
    pedido.recebimento_observacao = payload.get("observacao") or None
    pedido.recebimento_divergencia = bool(payload.get("divergencia"))
    anterior = pedido.status
    segue_infra = pedido_segue_infraestrutura(pedido.tipo, getattr(pedido, "destino_compras", None))
    pedido.status = STATUS_IMPRIMIR_NF
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
            propriedade = PATRIMONIO_PROPRIEDADE_AEB
            if pedido.fonte_recurso_id:
                fonte = (
                    await db.execute(
                        select(ComprasFonteRecursoDB).where(
                            ComprasFonteRecursoDB.id == pedido.fonte_recurso_id
                        )
                    )
                ).scalar_one_or_none()
                if fonte and (fonte.tipo or "") == FONTE_TIPO_CONVENIO:
                    propriedade = PATRIMONIO_PROPRIEDADE_PUBLICO
            for item in itens:
                bem = ComprasPatrimonioDB(
                    organizacao_id=pedido.organizacao_id,
                    instituicao_id=inst_id,
                    pedido_id=pedido.id,
                    pedido_item_id=item.id,
                    categoria_id=item.categoria_id,
                    descricao=item.descricao,
                    documento_nf=doc_nf,
                    valor_centavos=valor_item,
                    origem=PATRIMONIO_ORIGEM_COMPRA,
                    propriedade=propriedade,
                    situacao=PATRIMONIO_SITUACAO_BOM,
                    escopo_unidade=escopo,
                    data_aquisicao=data_operacional(),
                    criado_em=agora,
                    atualizado_em=agora,
                )
                db.add(bem)
                await db.flush()
                anexos_pedido = await _anexos_pedido(db, pedido.id)
                ids_nf = {n.anexo_id for n in notas if n.anexo_id}
                vistos = set()
                for anexo_nf in anexos_pedido:
                    if not anexo_nf.ativo:
                        continue
                    if anexo_nf.id not in ids_nf and anexo_nf.tipo not in TIPOS_ANEXO_NO_BEM:
                        continue
                    chave = anexo_nf.caminho_arquivo or anexo_nf.id
                    if chave in vistos:
                        continue
                    vistos.add(chave)
                    db.add(
                        ComprasPatrimonioAnexoDB(
                            patrimonio_id=bem.id,
                            nome_arquivo=anexo_nf.nome_arquivo,
                            caminho_arquivo=anexo_nf.caminho_arquivo,
                            content_type=anexo_nf.content_type,
                            tamanho_bytes=anexo_nf.tamanho_bytes,
                            tipo=tipo_arquivo_bem_de_anexo_pedido(anexo_nf.tipo) or "nota",
                            ativo=True,
                            criado_em=agora,
                        )
                    )

    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto="Pedido pronto para imprimir a nota fiscal.",
        usuario_id=_uid(usuario),
        status_anterior=anterior,
        status_novo=pedido.status,
    )
    return pedido


async def _pedido_tem_orcamento_assinado(db: AsyncSession, pedido_id: str) -> bool:
    row = (
        await db.execute(
            select(ComprasPedidoAnexoDB.id).where(
                ComprasPedidoAnexoDB.pedido_id == pedido_id,
                ComprasPedidoAnexoDB.ativo.is_(True),
                ComprasPedidoAnexoDB.tipo == TIPO_ANEXO_ORCAMENTO_ASSINADO,
            ).limit(1)
        )
    ).first()
    return bool(row)


async def remover_anexo_pedido(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    anexo_id: str,
) -> None:
    """Remove (desativa) um anexo de orçamento — projeto ou Sede, antes do processo fechar."""
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Processo encerrado não permite remover anexos.")
    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.id == anexo_id,
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.ativo.is_(True),
            )
        )
    ).scalar_one_or_none()
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")
    if (getattr(anexo, "classe_documento", None) or "") == CLASSE_DOC_CONTRATO:
        if (getattr(anexo, "etapa_contrato", None) or "") == ETAPA_CONTRATO_ASSINADO:
            raise HTTPException(status_code=400, detail="Contrato já assinado não pode ser excluído.")
        if pedido.status not in {STATUS_APROVADO, STATUS_ENVIADO}:
            raise HTTPException(
                status_code=400,
                detail="O contrato só pode ser excluído depois da assinatura do orçamento e antes da compra.",
            )
        sit = await situacao_contrato_infra(db, pedido)
        if sit["compra_executada"]:
            raise HTTPException(status_code=400, detail="A compra já foi executada. O contrato não pode mais ser excluído.")
        perfil = str(usuario.get("perfil_acesso") or usuario.get("perfil") or "")
        sede = usuario_e_sede_compras(perfil=perfil, is_manutencao=bool(usuario.get("is_manutencao")))
        if not sede:
            if not usuario_pode_pedir(
                perfil=perfil,
                compras_modulo_ativo=bool(usuario.get("compras_modulo_ativo")),
                is_manutencao=bool(usuario.get("is_manutencao")),
                org_compras_ativo=True,
            ):
                raise HTTPException(status_code=403, detail="Sem permissão para excluir o contrato.")
            if pedido.instituicao_id != usuario.get("instituicao_id") and not usuario.get("is_manutencao"):
                raise HTTPException(status_code=403, detail="A exclusão do contrato é do próprio projeto.")
        anexo.ativo = False
        remover_arquivo_compras(anexo.caminho_arquivo)
        await registrar_evento_pedido(
            db,
            pedido_id=pedido.id,
            tipo=TIPO_EVENTO_OBSERVACAO,
            texto=f"Contrato excluído ({anexo.nome_arquivo}). O projeto pode anexar o arquivo correto.",
            usuario_id=_uid(usuario),
            aguardando_confirmacao=False,
        )
        pedido.atualizado_em = agora_operacional_naive()
        return
    if anexo.tipo == TIPO_ANEXO_AQUISICAO:
        if pedido.status != STATUS_ENVIADO:
            raise HTTPException(
                status_code=400,
                detail="Os arquivos da aquisição só podem ser excluídos antes de encerrar o processo.",
            )
        anexo.ativo = False
        remover_arquivo_compras(anexo.caminho_arquivo)
        await registrar_evento_pedido(
            db,
            pedido_id=pedido.id,
            tipo=TIPO_EVENTO_OBSERVACAO,
            texto=f"Anexo removido ({anexo.tipo}: {anexo.nome_arquivo}).",
            usuario_id=_uid(usuario),
            cotacao_id=anexo.cotacao_id,
            aguardando_confirmacao=False,
        )
        pedido.atualizado_em = agora_operacional_naive()
        return
    sede = usuario_e_sede_compras(
        perfil=(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        is_manutencao=bool(usuario.get("is_manutencao")),
    )
    statuses_projeto = {
        STATUS_RASCUNHO,
        STATUS_AGUARDANDO_COTACAO,
        STATUS_EM_COTACAO,
        STATUS_AGUARDANDO_ESCOLHA,
    }
    tem_assinado = await _pedido_tem_orcamento_assinado(db, pedido.id)
    projeto_troca = projeto_pode_trocar_orcamento(
        pedido.tipo,
        getattr(pedido, "destino_compras", None),
        pedido.status,
        tem_orcamento_assinado=tem_assinado,
    )
    if not sede and not projeto_troca and pedido.status not in statuses_projeto:
        raise HTTPException(
            status_code=400,
            detail="Só é possível remover orçamentos anexados enquanto a Sede não assinou.",
        )
    if sede and pedido.status not in {
        *statuses_projeto,
        STATUS_AGUARDANDO_UNIDADE,
        STATUS_AGUARDANDO_SEDE,
        STATUS_APROVADO,
    }:
        raise HTTPException(
            status_code=400,
            detail="Após o envio ao fornecedor não é possível remover anexos de orçamento.",
        )

    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.id == anexo_id,
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.ativo.is_(True),
            )
        )
    ).scalar_one_or_none()
    if not anexo:
        raise HTTPException(status_code=404, detail="Anexo não encontrado.")
    if anexo.tipo not in {TIPO_ANEXO_ORCAMENTO, TIPO_ANEXO_RESPOSTA_FORNECEDOR}:
        raise HTTPException(
            status_code=400,
            detail="Este tipo de anexo não pode ser removido por aqui (orçamento assinado pela Sede fica bloqueado).",
        )

    anexo.ativo = False
    remover_arquivo_compras(anexo.caminho_arquivo)
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_OBSERVACAO,
        texto=f"Anexo removido ({anexo.tipo}: {anexo.nome_arquivo}).",
        usuario_id=_uid(usuario),
        cotacao_id=anexo.cotacao_id,
        aguardando_confirmacao=False,
    )
    pedido.atualizado_em = agora_operacional_naive()


async def desativar_cotacao(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    cotacao_id: str,
    motivo: Optional[str] = None,
) -> None:
    sede = usuario_e_sede_compras(
        perfil=(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        is_manutencao=bool(usuario.get("is_manutencao")),
    )
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(status_code=400, detail="Processo encerrado.")
    statuses_ok_sede = {
        STATUS_RASCUNHO,
        STATUS_AGUARDANDO_COTACAO,
        STATUS_EM_COTACAO,
        STATUS_AGUARDANDO_ESCOLHA,
        STATUS_AGUARDANDO_UNIDADE,
        STATUS_AGUARDANDO_SEDE,
        STATUS_APROVADO,
    }
    if sede and pedido.status not in statuses_ok_sede:
        raise HTTPException(
            status_code=400,
            detail="Após o envio ao fornecedor não é possível remover orçamentos. Encerre o processo ou use comunicação na timeline.",
        )
    tem_assinado = await _pedido_tem_orcamento_assinado(db, pedido.id)
    if not sede and not projeto_pode_trocar_orcamento(
        pedido.tipo,
        getattr(pedido, "destino_compras", None),
        pedido.status,
        tem_orcamento_assinado=tem_assinado,
    ):
        raise HTTPException(
            status_code=403,
            detail="Somente a Sede (ADM Compras) ou o projeto, enquanto a Sede não assinou, podem remover orçamentos.",
        )
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
            )
        )
    ).scalars().all()
    for anexo in anexos:
        anexo.ativo = False
        remover_arquivo_compras(anexo.caminho_arquivo)
    texto = (motivo or "Cotação removida/desativada.").strip()
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
    *,
    page_index: Optional[int] = None,
    x: Optional[float] = None,
    y: Optional[float] = None,
    width: Optional[float] = None,
    height: Optional[float] = None,
) -> ComprasPedidoDB:
    """Ato explícito: carimba assinatura no orçamento (posição opcional) e aprova."""
    if usuario_global_assina_orcamento(usuario):
        if (pedido.tipo or "").strip().lower() not in TIPOS_COTACAO_PROJETO:
            raise HTTPException(
                status_code=403,
                detail="Esta autorização cobre bem/imobilizado e prestação de serviço.",
            )
    elif not usuario_pode_aprovar_sede(
        perfil=str(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        raise HTTPException(status_code=403, detail="Somente ADM Compras aprova na Sede.")
    if not usuario_global_assina_orcamento(usuario) and not usuario_sede_pode_ver_tipo(
        perfil=str(usuario.get("perfil_acesso") or usuario.get("perfil") or ""),
        tipo=pedido.tipo,
        is_manutencao=bool(usuario.get("is_manutencao")),
        destino=getattr(pedido, "destino_compras", None),
    ):
        raise HTTPException(status_code=403, detail="Pedido fora do escopo da sua classe de Compras.")
    if pedido.status != STATUS_AGUARDANDO_SEDE:
        raise HTTPException(status_code=400, detail="Pedido não está aguardando aprovação da Sede.")
    if not pedido.aprovado_unidade_em and not pedido_escopo_sede(getattr(pedido, "escopo_unidade", None)):
        raise HTTPException(
            status_code=400,
            detail="O projeto precisa enviar o pedido à Sede antes da assinatura.",
        )

    from models import UsuarioDB

    user_row = (
        await db.execute(select(UsuarioDB).where(UsuarioDB.id == _uid(usuario)))
    ).scalar_one_or_none()
    caminho_assinatura = getattr(user_row, "assinatura_digital_caminho", None) if user_row else None
    nome_assinatura = getattr(user_row, "assinatura_digital_nome", None) if user_row else None
    if not caminho_assinatura:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cadastre o PDF da sua assinatura digital antes de assinar "
                "(menu Aguardando assinatura → Assinatura digital)."
            ),
        )

    cotacoes = await _cotacoes_ativas(db, pedido.id)
    escolhida = next((c for c in cotacoes if c.escolhida), None)
    if not escolhida:
        raise HTTPException(
            status_code=400,
            detail="Escolha o orçamento vencedor nesta fila antes de assinar.",
        )
    await unificar_orcamentos_vencedor(db, usuario, pedido, escolhida)

    anexos_orc = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.cotacao_id == escolhida.id,
                ComprasPedidoAnexoDB.tipo == TIPO_ANEXO_ORCAMENTO,
                ComprasPedidoAnexoDB.ativo.is_(True),
            ).order_by(ComprasPedidoAnexoDB.criado_em.desc())
        )
    ).scalars().all()
    if not anexos_orc:
        raise HTTPException(
            status_code=400,
            detail="Anexe o PDF do orçamento vencedor antes de assinar na Sede.",
        )
    orcamento_original = next(
        (a for a in anexos_orc if eh_anexo_orcamento_unificado(a.nome_arquivo)),
        anexos_orc[0],
    )

    agora = agora_operacional_naive()
    assinante = (
        (usuario.get("nome") or usuario.get("nome_completo") or usuario.get("email") or "ADM Compras")
    ).strip()
    assinado_em_texto = agora.strftime("%d/%m/%Y %H:%M")
    numero = pedido.id.split("-")[0].upper()[:8]

    try:
        orc_bytes, _ = ler_bytes_anexo(orcamento_original.caminho_arquivo)
        assinatura_bytes, _ = ler_bytes_anexo(caminho_assinatura)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Não foi possível ler os PDFs: {exc}") from exc

    try:
        pdf_bytes = carimbar_assinatura_pdf(
            orcamento_bytes=orc_bytes,
            assinatura_bytes=assinatura_bytes,
            page_index=page_index,
            x=x,
            y=y,
            width=width,
            height=height,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Falha ao montar o PDF assinado: {exc}") from exc

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

    rotulo_assinatura = nome_assinatura or "PDF de assinatura digital"
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=(
            f"ATO DE ASSINATURA: {assinante} assinou o orçamento de {escolhida.fornecedor_nome} "
            f"em {assinado_em_texto}, carimbando «{rotulo_assinatura}» no rodapé do PDF "
            f"«{orcamento_original.nome_arquivo}». Pedido aprovado na Sede."
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
        texto=(
            f"Orçamento assinado (Sede): {nome_original}. "
            "Disponível para o projeto enviar ao fornecedor com o pedido de compra."
        ),
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
        cotacao_id=escolhida.id,
    )
    return pedido


async def listar_alertas_contrato_assinado(db: AsyncSession, usuario: dict) -> list[dict]:
    """Pedidos com contrato assinado ainda sem compra — modal de Compras, não o menu de avisos."""
    if not usuario_ve_alerta_contrato_assinado(usuario):
        return []
    org_id = usuario.get("organizacao_id")
    if not org_id:
        return []
    filtros = [
        ComprasPedidoDB.organizacao_id == org_id,
        ComprasPedidoDB.status == STATUS_APROVADO,
        ComprasPedidoAnexoDB.ativo.is_(True),
        ComprasPedidoAnexoDB.classe_documento == CLASSE_DOC_CONTRATO,
        ComprasPedidoAnexoDB.etapa_contrato == ETAPA_CONTRATO_ASSINADO,
    ]
    if perfil_adm_compras_sede(usuario) != "infraestrutura" and not usuario.get("is_manutencao"):
        filtros.append(ComprasPedidoDB.instituicao_id == usuario.get("instituicao_id"))
    linhas = (
        await db.execute(
            select(ComprasPedidoDB, ComprasPedidoAnexoDB, InstituicaoDB.nome_fantasia)
            .join(ComprasPedidoAnexoDB, ComprasPedidoAnexoDB.pedido_id == ComprasPedidoDB.id)
            .outerjoin(InstituicaoDB, InstituicaoDB.id == ComprasPedidoDB.instituicao_id)
            .where(*filtros)
            .order_by(ComprasPedidoAnexoDB.criado_em.desc())
        )
    ).all()
    saida = []
    vistos: set[str] = set()
    for pedido, anexo, projeto in linhas:
        if pedido.id in vistos:
            continue
        vistos.add(pedido.id)
        saida.append({
            "pedido_id": pedido.id,
            "titulo": pedido.titulo or "Pedido",
            "projeto": projeto or "",
            "arquivo": anexo.nome_arquivo,
            "assinado_em": anexo.criado_em.isoformat(sep=" ") if anexo.criado_em else None,
        })
    return saida


async def liberar_contrato_infraestrutura(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    anexo_id: str,
) -> ComprasPedidoAnexoDB:
    if perfil_adm_compras_sede(usuario) != "infraestrutura" and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=403, detail="A revisão do contrato é da Infraestrutura.")
    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.id == anexo_id,
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
            )
        )
    ).scalar_one_or_none()
    if not anexo or getattr(anexo, "classe_documento", None) != CLASSE_DOC_CONTRATO:
        raise HTTPException(status_code=404, detail="Contrato não encontrado neste pedido.")
    if getattr(anexo, "etapa_contrato", None) != ETAPA_CONTRATO_ROBSON:
        raise HTTPException(status_code=400, detail="Este contrato não está aguardando a Infraestrutura.")
    anexo.etapa_contrato = ETAPA_CONTRATO_NOEMI
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=f"Infraestrutura revisou o contrato {anexo.nome_arquivo} e enviou para a assinatura da Noemi.",
        usuario_id=_uid(usuario),
        anexo_id=anexo.id,
    )
    return anexo


async def registrar_contrato_assinado(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    anexo_id: str,
    *,
    file: UploadFile,
) -> ComprasPedidoAnexoDB:
    if not usuario_global_assina_orcamento(usuario) and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=403, detail="A assinatura do contrato no gov.br é da Noemi.")
    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.id == anexo_id,
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
            )
        )
    ).scalar_one_or_none()
    if not anexo or getattr(anexo, "etapa_contrato", None) != ETAPA_CONTRATO_NOEMI:
        raise HTTPException(status_code=400, detail="Este contrato não está aguardando a assinatura.")
    novo = await upload_anexo_pedido(
        db, usuario, pedido, file=file, tipo=anexo.tipo or TIPO_ANEXO_AQUISICAO,
        classe_documento=CLASSE_DOC_CONTRATO,
        etapa_contrato=ETAPA_CONTRATO_ASSINADO,
    )
    anexo.ativo = False
    anexo.etapa_contrato = ETAPA_CONTRATO_ASSINADO
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=f"Noemi assinou o contrato {anexo.nome_arquivo}. O processo volta para o projeto.",
        usuario_id=_uid(usuario),
        anexo_id=novo.id,
    )
    return novo


TEXTO_FILA_REPRESENTANTE = "Enviado para a fila do representante legal."


def _orcamento_da_infra(pedido: ComprasPedidoDB) -> bool:
    return tipo_eh_cotacao_projeto(pedido.tipo) or pedido_segue_infraestrutura(
        pedido.tipo, getattr(pedido, "destino_compras", None),
    )


def _papeis_fila_assinatura(usuario: dict) -> tuple[bool, bool]:
    manutencao = bool(usuario.get("is_manutencao"))
    ver_infra = perfil_adm_compras_sede(usuario) == "infraestrutura" or manutencao
    ver_representante = usuario_global_assina_orcamento(usuario) or manutencao
    return ver_infra, ver_representante


async def separar_fila_assinatura(db: AsyncSession, usuario: dict) -> dict:
    vazio = {
        "ver_infra": False,
        "ver_representante": False,
        "orcamentos_infra": [],
        "orcamentos_representante": [],
        "contratos_infra": [],
        "contratos_representante": [],
    }
    ver_infra, ver_representante = _papeis_fila_assinatura(usuario)
    if not ver_infra and not ver_representante:
        return vazio
    org_id = usuario.get("organizacao_id")
    if not org_id:
        vazio["ver_infra"] = ver_infra
        vazio["ver_representante"] = ver_representante
        return vazio

    candidatos = list(
        (
            await db.execute(
                select(ComprasPedidoDB).where(
                    ComprasPedidoDB.organizacao_id == org_id,
                    ComprasPedidoDB.status == STATUS_AGUARDANDO_SEDE,
                )
            )
        ).scalars().all()
    )
    candidatos = [p for p in candidatos if _orcamento_da_infra(p)]
    ids = [p.id for p in candidatos]
    enviados: set[str] = set()
    if ids:
        eventos = (
            await db.execute(
                select(ComprasPedidoEventoDB.pedido_id).where(
                    ComprasPedidoEventoDB.pedido_id.in_(ids),
                    ComprasPedidoEventoDB.texto.like(f"{TEXTO_FILA_REPRESENTANTE}%"),
                )
            )
        ).all()
        enviados = {row[0] for row in eventos}

    orcamentos_infra = [p for p in candidatos if p.id not in enviados]
    orcamentos_representante = [p for p in candidatos if p.id in enviados]

    linhas = (
        await db.execute(
            select(ComprasPedidoAnexoDB, ComprasPedidoDB)
            .join(ComprasPedidoDB, ComprasPedidoDB.id == ComprasPedidoAnexoDB.pedido_id)
            .where(
                ComprasPedidoDB.organizacao_id == org_id,
                ComprasPedidoDB.status.notin_(tuple(STATUS_TERMINAIS_PEDIDO)),
                ComprasPedidoAnexoDB.classe_documento == CLASSE_DOC_CONTRATO,
                ComprasPedidoAnexoDB.ativo.is_(True),
                ComprasPedidoAnexoDB.etapa_contrato.in_((ETAPA_CONTRATO_ROBSON, ETAPA_CONTRATO_NOEMI)),
            )
        )
    ).all()
    contratos_infra = [(anexo, pedido) for anexo, pedido in linhas if anexo.etapa_contrato == ETAPA_CONTRATO_ROBSON]
    contratos_representante = [
        (anexo, pedido) for anexo, pedido in linhas if anexo.etapa_contrato == ETAPA_CONTRATO_NOEMI
    ]
    return {
        "ver_infra": ver_infra,
        "ver_representante": ver_representante,
        "orcamentos_infra": orcamentos_infra,
        "orcamentos_representante": orcamentos_representante,
        "contratos_infra": contratos_infra,
        "contratos_representante": contratos_representante,
    }


def contagem_fila_assinatura(separada: dict) -> int:
    total = 0
    if separada.get("ver_infra"):
        total += len(separada.get("orcamentos_infra") or [])
        total += len(separada.get("contratos_infra") or [])
    if separada.get("ver_representante"):
        total += len(separada.get("orcamentos_representante") or [])
        total += len(separada.get("contratos_representante") or [])
    return total


async def enviar_orcamento_para_representante(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    if perfil_adm_compras_sede(usuario) != "infraestrutura" and not usuario.get("is_manutencao"):
        raise HTTPException(
            status_code=403,
            detail="Só a Infraestrutura envia o orçamento para o representante legal.",
        )
    if not _orcamento_da_infra(pedido):
        raise HTTPException(status_code=400, detail="Esse pedido não passa pela fila da Infraestrutura.")
    if pedido.status != STATUS_AGUARDANDO_SEDE:
        raise HTTPException(status_code=400, detail="Esse orçamento não está aguardando a Infraestrutura.")
    cotacoes = await _cotacoes_ativas(db, pedido.id)
    escolhida = next((c for c in cotacoes if c.escolhida), None)
    if not escolhida:
        raise HTTPException(status_code=400, detail="Escolha o orçamento vencedor antes de enviar à Noemi.")
    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB.id).where(
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.cotacao_id == escolhida.id,
                ComprasPedidoAnexoDB.tipo == TIPO_ANEXO_ORCAMENTO,
                ComprasPedidoAnexoDB.ativo.is_(True),
            )
        )
    ).first()
    if not anexo:
        raise HTTPException(status_code=400, detail="O orçamento vencedor precisa ter o PDF anexado.")
    ja = (
        await db.execute(
            select(ComprasPedidoEventoDB.id).where(
                ComprasPedidoEventoDB.pedido_id == pedido.id,
                ComprasPedidoEventoDB.texto.like(f"{TEXTO_FILA_REPRESENTANTE}%"),
            )
        )
    ).first()
    if ja:
        return pedido
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=(
            f"{TEXTO_FILA_REPRESENTANTE} "
            f"Orçamento de {escolhida.fornecedor_nome} aguarda assinatura no gov.br."
        ),
        usuario_id=_uid(usuario),
        cotacao_id=escolhida.id,
        status_anterior=pedido.status,
        status_novo=pedido.status,
    )
    pedido.atualizado_em = agora_operacional_naive()
    return pedido


async def listar_contratos_assinados_representante(db: AsyncSession, usuario: dict) -> list[dict]:
    if not usuario_global_assina_orcamento(usuario) and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=403, detail="A lista de contratos assinados é da Noemi.")
    org_id = usuario.get("organizacao_id")
    if not org_id:
        return []
    linhas = (
        await db.execute(
            select(ComprasPedidoAnexoDB, ComprasPedidoDB, InstituicaoDB.nome_fantasia)
            .join(ComprasPedidoDB, ComprasPedidoDB.id == ComprasPedidoAnexoDB.pedido_id)
            .outerjoin(InstituicaoDB, InstituicaoDB.id == ComprasPedidoDB.instituicao_id)
            .where(
                ComprasPedidoDB.organizacao_id == org_id,
                ComprasPedidoAnexoDB.classe_documento == CLASSE_DOC_CONTRATO,
                ComprasPedidoAnexoDB.etapa_contrato == ETAPA_CONTRATO_ASSINADO,
                ComprasPedidoAnexoDB.ativo.is_(True),
            )
            .order_by(ComprasPedidoAnexoDB.criado_em.desc())
        )
    ).all()
    saida = []
    for anexo, pedido, projeto in linhas:
        saida.append({
            "id": anexo.id,
            "pedido_id": pedido.id,
            "titulo": pedido.titulo,
            "projeto": projeto or "Projeto",
            "nome_arquivo": anexo.nome_arquivo,
            "assinado_em": anexo.criado_em.isoformat(timespec="minutes") if anexo.criado_em else None,
            "pode_substituir": pedido.status not in STATUS_TERMINAIS_PEDIDO,
        })
    return saida


async def substituir_contrato_assinado(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    anexo_id: str,
    *,
    file: UploadFile,
) -> ComprasPedidoAnexoDB:
    if not usuario_global_assina_orcamento(usuario) and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=403, detail="A troca do contrato assinado é da Noemi.")
    if pedido.status in STATUS_TERMINAIS_PEDIDO:
        raise HTTPException(
            status_code=400,
            detail="Processo encerrado. O contrato assinado não pode mais ser substituído.",
        )
    anexo = (
        await db.execute(
            select(ComprasPedidoAnexoDB).where(
                ComprasPedidoAnexoDB.id == anexo_id,
                ComprasPedidoAnexoDB.pedido_id == pedido.id,
                ComprasPedidoAnexoDB.ativo.is_(True),
            )
        )
    ).scalar_one_or_none()
    if (
        not anexo
        or getattr(anexo, "classe_documento", None) != CLASSE_DOC_CONTRATO
        or getattr(anexo, "etapa_contrato", None) != ETAPA_CONTRATO_ASSINADO
    ):
        raise HTTPException(status_code=404, detail="Contrato assinado não encontrado neste pedido.")
    nome_anterior = anexo.nome_arquivo
    novo = await upload_anexo_pedido(
        db, usuario, pedido, file=file, tipo=anexo.tipo or TIPO_ANEXO_AQUISICAO,
        classe_documento=CLASSE_DOC_CONTRATO,
        etapa_contrato=ETAPA_CONTRATO_ASSINADO,
    )
    anexo.ativo = False
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=(
            f"Contrato assinado substituído ({nome_anterior} por {novo.nome_arquivo}). "
            "O arquivo anterior estava incorreto."
        ),
        usuario_id=_uid(usuario),
        anexo_id=novo.id,
    )
    return novo


def _exigir_infraestrutura(usuario: dict) -> None:
    if perfil_adm_compras_sede(usuario) != "infraestrutura" and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=403, detail="Somente a Infraestrutura acessa esta fila.")


async def listar_fila_concluidos_infra(db: AsyncSession, usuario: dict) -> list[ComprasPedidoDB]:
    _exigir_infraestrutura(usuario)
    org_id = usuario.get("organizacao_id")
    if not org_id:
        return []
    rows = list(
        (
            await db.execute(
                select(ComprasPedidoDB).where(
                    ComprasPedidoDB.organizacao_id == org_id,
                    ComprasPedidoDB.status == STATUS_RECEBIDO,
                )
            )
        ).scalars().all()
    )
    return [
        pedido
        for pedido in rows
        if pedido_na_fila_concluidos_infra(
            tipo=pedido.tipo,
            destino=getattr(pedido, "destino_compras", None),
            status=pedido.status,
            ok_final_em=getattr(pedido, "infraestrutura_ok_final_em", None),
        )
    ]


async def listar_fila_nf_pagamento(db: AsyncSession, usuario: dict) -> list[ComprasPedidoDB]:
    _exigir_infraestrutura(usuario)
    org_id = usuario.get("organizacao_id")
    if not org_id:
        return []
    rows = list(
        (
            await db.execute(
                select(ComprasPedidoDB).where(
                    ComprasPedidoDB.organizacao_id == org_id,
                    ComprasPedidoDB.status == STATUS_AGUARDANDO_PAGAMENTO,
                    ComprasPedidoDB.tipo == TIPO_EMERGENCIA,
                )
            )
        ).scalars().all()
    )
    return [
        p
        for p in rows
        if pedido_na_fila_nf_pagamento(p.tipo, p.status, getattr(p, "destino_compras", None))
    ]


def _exigir_suprimentos(usuario: dict) -> None:
    if perfil_adm_compras_sede(usuario) != "suprimentos" and not usuario.get("is_manutencao"):
        raise HTTPException(status_code=403, detail="Somente Suprimentos acessa esta fila.")


async def listar_fila_nf_pagamento_suprimentos(db: AsyncSession, usuario: dict) -> list[ComprasPedidoDB]:
    _exigir_suprimentos(usuario)
    org_id = usuario.get("organizacao_id")
    if not org_id:
        return []
    rows = list(
        (
            await db.execute(
                select(ComprasPedidoDB).where(
                    ComprasPedidoDB.organizacao_id == org_id,
                    ComprasPedidoDB.status == STATUS_AGUARDANDO_PAGAMENTO,
                    ComprasPedidoDB.tipo == TIPO_EMERGENCIA,
                )
            )
        ).scalars().all()
    )
    return [
        p
        for p in rows
        if pedido_na_fila_nf_pagamento_suprimentos(
            p.tipo, p.status, getattr(p, "destino_compras", None)
        )
    ]


async def listar_fila_extrato_projeto(db: AsyncSession, usuario: dict) -> list[ComprasPedidoDB]:
    org_id = usuario.get("organizacao_id")
    if not org_id:
        return []
    filtros = [
        ComprasPedidoDB.organizacao_id == org_id,
        ComprasPedidoDB.status == STATUS_AGUARDANDO_EXTRATO,
        ComprasPedidoDB.tipo == TIPO_EMERGENCIA,
    ]
    if not usuario_e_sede_compras(
        perfil=str(usuario.get("perfil_acesso") or ""),
        is_manutencao=bool(usuario.get("is_manutencao")),
    ):
        filtros.append(ComprasPedidoDB.instituicao_id == usuario.get("instituicao_id"))
    return list((await db.execute(select(ComprasPedidoDB).where(*filtros))).scalars().all())


async def enviar_emergencia_para_pagamento(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    if not tipo_eh_emergencia(pedido.tipo):
        raise HTTPException(status_code=400, detail="Somente Compras emergência envia a NF direto para pagamento.")
    if not _usuario_do_projeto_anexa_nf(usuario):
        raise HTTPException(
            status_code=403,
            detail="O projeto anexa a NF assinada e envia para a fila de pagamento.",
        )
    if pedido.status != STATUS_RASCUNHO:
        raise HTTPException(status_code=400, detail="A NF já foi enviada para pagamento ou o pedido não está em rascunho.")
    notas = [n for n in await _notas_pedido(db, pedido.id) if (n.tipo_nf or "") != "boleto"]
    if not notas:
        raise HTTPException(status_code=400, detail="Anexe a nota fiscal antes de enviar para pagamento.")
    anterior = pedido.status
    pedido.status = STATUS_AGUARDANDO_PAGAMENTO
    pedido.atualizado_em = agora_operacional_naive()
    destino = getattr(pedido, "destino_compras", None)
    fila = (
        "Suprimentos"
        if (destino or "").strip().lower() == "suprimentos"
        else "Infraestrutura"
    )
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=f"NF enviada para a fila de pagamento de {fila}.",
        usuario_id=_uid(usuario),
        status_anterior=anterior,
        status_novo=STATUS_AGUARDANDO_PAGAMENTO,
    )
    return pedido


async def confirmar_nf_enviada_pagamento(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    destino = getattr(pedido, "destino_compras", None)
    if pedido_na_fila_nf_pagamento_suprimentos(pedido.tipo, pedido.status, destino):
        _exigir_suprimentos(usuario)
        texto_evento = "Suprimentos confirmou o envio da NF para pagamento. Projeto: conferir o extrato."
    elif pedido_na_fila_nf_pagamento(pedido.tipo, pedido.status, destino):
        _exigir_infraestrutura(usuario)
        texto_evento = "Infraestrutura confirmou o envio da NF para pagamento. Projeto: conferir o extrato."
    else:
        raise HTTPException(status_code=400, detail="Este pedido não está na fila de NFs a pagar.")
    anterior = pedido.status
    pedido.status = STATUS_AGUARDANDO_EXTRATO
    pedido.nf_para_pagamento_em = agora_operacional_naive()
    pedido.nf_para_pagamento_por_id = _uid(usuario)
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_STATUS,
        texto=texto_evento,
        usuario_id=_uid(usuario),
        status_anterior=anterior,
        status_novo=STATUS_AGUARDANDO_EXTRATO,
    )
    return pedido


async def confirmar_ok_final_infra(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
) -> ComprasPedidoDB:
    _exigir_infraestrutura(usuario)
    if not pedido_na_fila_concluidos_infra(
        tipo=pedido.tipo,
        destino=getattr(pedido, "destino_compras", None),
        status=pedido.status,
        ok_final_em=getattr(pedido, "infraestrutura_ok_final_em", None),
    ):
        raise HTTPException(status_code=400, detail="Este pedido não está na fila de concluídos da Infraestrutura.")
    pedido.infraestrutura_ok_final_em = agora_operacional_naive()
    pedido.infraestrutura_ok_final_por_id = _uid(usuario)
    pedido.atualizado_em = agora_operacional_naive()
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_OK,
        texto="Infraestrutura deu o OK final. Pedido sai da fila de concluídos.",
        usuario_id=_uid(usuario),
    )
    return pedido


async def enviar_nfs_notas_pendentes(
    db: AsyncSession,
    usuario: dict,
    pedido: ComprasPedidoDB,
    *,
    corpo: str | None = None,
    substituir: bool = False,
) -> dict:
    if pedido.tipo != TIPO_IMOBILIZADO:
        raise HTTPException(status_code=400, detail="O e-mail de notas pendentes é só para bem / imobilizado.")
    notas = [n for n in await _notas_pedido(db, pedido.id) if (n.tipo_nf or "") != "boleto"]
    if not notas:
        raise HTTPException(status_code=400, detail="Anexe ao menos uma nota fiscal antes de enviar o e-mail.")
    anexos = await _anexos_pedido(db, pedido.id)
    por_id = {a.id: a for a in anexos}
    arquivos = []
    for nota in notas:
        anexo = por_id.get(nota.anexo_id) if nota.anexo_id else None
        if not anexo:
            continue
        try:
            dados, _ctype = ler_bytes_anexo(anexo.caminho_arquivo)
        except Exception:
            continue
        arquivos.append((anexo.nome_arquivo or "nota.pdf", dados, anexo.content_type or "application/pdf"))
    if not arquivos:
        raise HTTPException(status_code=400, detail="Não foi possível ler os arquivos das notas fiscais.")
    padrao = corpo_padrao_notas_pendentes()
    extra = (corpo or "").strip()
    if substituir and extra:
        texto = sanitizar_corpo_email(extra, padrao)
    elif extra:
        texto = sanitizar_corpo_email(f"{padrao}\n\n{extra}", padrao)
    else:
        texto = padrao
    primeiro = arquivos[0]
    extras = arquivos[1:]
    resultado = enviar_email_smtp_com_anexo(
        assunto="Notas fiscais — CareCore+",
        corpo=texto,
        para=EMAIL_NOTAS_PENDENTES,
        anexo_nome=primeiro[0],
        anexo_bytes=primeiro[1],
        anexo_content_type=primeiro[2],
        anexos_extras=extras or None,
    )
    if not resultado.enviado:
        raise HTTPException(status_code=502, detail=resultado.erro or "Não foi possível enviar o e-mail.")
    await registrar_evento_pedido(
        db,
        pedido_id=pedido.id,
        tipo=TIPO_EVENTO_EMAIL,
        texto=f"Notas fiscais enviadas para {EMAIL_NOTAS_PENDENTES}.",
        usuario_id=_uid(usuario),
    )
    return {"ok": True, "para": EMAIL_NOTAS_PENDENTES, "anexos": len(arquivos)}

