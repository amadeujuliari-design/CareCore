"""Caixa de correio de Suprimentos nos pedidos concluídos."""

import asyncio
from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from compras_pedido_fluxo import (
    definir_pagamento_parcelas,
    marcar_leitura_caixa_suprimentos,
    registrar_impressao_nf_e_opcional_encerrar,
    registrar_impressao_nf_suprimentos,
)
from compras_regras import (
    PERFIL_ADM_COMPRAS_INFRAESTRUTURA,
    PERFIL_ADM_COMPRAS_SUPRIMENTOS,
    STATUS_AGUARDANDO_PAGAMENTO,
    STATUS_IMPRIMIR_NF,
    STATUS_RECEBIDO,
)


def _pedido(**kwargs):
    base = dict(
        status="recebido",
        suprimentos_lida_em=None,
        suprimentos_lida_por_id=None,
        nf_impressa_em=None,
        nf_impressa_por_id=None,
        atualizado_em=datetime(2026, 10, 1, 9, 0, 0),
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_abrir_concluido_marca_lida_so_para_suprimentos():
    pedido = _pedido()
    momento = pedido.atualizado_em
    assert marcar_leitura_caixa_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-1"},
        pedido,
    ) is True
    assert pedido.suprimentos_lida_por_id == "sup-1"
    assert pedido.suprimentos_lida_em is not None
    assert pedido.atualizado_em == momento
    assert marcar_leitura_caixa_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-1"},
        pedido,
    ) is False


def test_andamento_e_outros_perfis_nao_marcam_leitura():
    pedido = _pedido(status="enviado_fornecedor")
    assert marcar_leitura_caixa_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-1"},
        pedido,
    ) is False
    concluido = _pedido()
    assert marcar_leitura_caixa_suprimentos(
        {"perfil_acesso": "Gestor", "id": "g-1"},
        concluido,
    ) is False
    assert marcar_leitura_caixa_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_INFRAESTRUTURA, "id": "inf-1"},
        concluido,
    ) is False
    assert concluido.suprimentos_lida_em is None


def test_impressao_nf_so_no_pedido_encerrado():
    pedido = _pedido()
    momento = pedido.atualizado_em
    registrar_impressao_nf_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-1"},
        pedido,
    )
    assert pedido.nf_impressa_por_id == "sup-1"
    assert pedido.nf_impressa_em is not None
    assert pedido.atualizado_em == momento
    primeira = pedido.nf_impressa_em
    registrar_impressao_nf_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-2"},
        pedido,
    )
    assert pedido.nf_impressa_em == primeira
    assert pedido.nf_impressa_por_id == "sup-1"

    with pytest.raises(HTTPException) as aberto:
        registrar_impressao_nf_suprimentos(
            {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-1"},
            _pedido(status="enviado_fornecedor"),
        )
    assert aberto.value.status_code == 400

    with pytest.raises(HTTPException) as negado:
        registrar_impressao_nf_suprimentos(
            {"perfil_acesso": "Gestor", "id": "g-1"},
            _pedido(),
        )
    assert negado.value.status_code == 403

    infra = _pedido()
    registrar_impressao_nf_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_INFRAESTRUTURA, "id": "inf-1"},
        infra,
    )
    assert infra.nf_impressa_por_id == "inf-1"


def test_impressao_nf_em_imprimir_nf_pode_encerrar():
    pedido = _pedido(status=STATUS_IMPRIMIR_NF)
    registrar_impressao_nf_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-1"},
        pedido,
        encerrar=True,
    )
    assert pedido.status == STATUS_RECEBIDO
    assert pedido.nf_impressa_por_id == "sup-1"


def test_impressao_nf_em_imprimir_nf_sem_encerrar_mantem_status():
    pedido = _pedido(status=STATUS_IMPRIMIR_NF)
    registrar_impressao_nf_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-1"},
        pedido,
        encerrar=False,
    )
    assert pedido.status == STATUS_IMPRIMIR_NF


def test_impressao_nf_infraestrutura_pode_encerrar():
    pedido = _pedido(status=STATUS_IMPRIMIR_NF)
    registrar_impressao_nf_suprimentos(
        {"perfil_acesso": PERFIL_ADM_COMPRAS_INFRAESTRUTURA, "id": "inf-1"},
        pedido,
        encerrar=True,
    )
    assert pedido.status == STATUS_RECEBIDO
    assert pedido.nf_impressa_por_id == "inf-1"


class _Db:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)


def _infra():
    return {"perfil_acesso": PERFIL_ADM_COMPRAS_INFRAESTRUTURA, "id": "inf-1"}


def test_impressao_de_parcela_incompleta_nao_conclui_nem_marca_impressa(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido(
        id="p-bel",
        status=STATUS_AGUARDANDO_PAGAMENTO,
        pagamento_qtd_parcelas=4,
        recebido_em=None,
    )

    async def _sit(_db, _pedido):
        return {"segue": True, "completo": False, "qtd_parcelas": 4, "parcelas_pagas": 1}

    monkeypatch.setattr(fluxo, "situacao_pagamento_infra", _sit)
    db = _Db()

    async def caso():
        await registrar_impressao_nf_e_opcional_encerrar(db, _infra(), pedido)

    asyncio.run(caso())
    assert pedido.status == STATUS_AGUARDANDO_PAGAMENTO
    assert pedido.nf_impressa_em is None
    assert pedido.pagamento_qtd_parcelas == 4
    assert db.added
    assert "permanece em A pagar" in (db.added[0].texto or "")
    assert "4 parcelas" in (db.added[0].texto or "")


def test_impressao_com_pagamento_completo_conclui(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido(
        id="p-ok",
        status=STATUS_AGUARDANDO_PAGAMENTO,
        pagamento_qtd_parcelas=4,
        recebido_em=None,
        recebido_por_id=None,
    )

    async def _sit(_db, _pedido):
        return {"segue": True, "completo": True, "qtd_parcelas": 4, "parcelas_pagas": 4}

    async def _patrimonio(_db, _pedido):
        return None

    monkeypatch.setattr(fluxo, "situacao_pagamento_infra", _sit)
    monkeypatch.setattr(fluxo, "garantir_patrimonio_imobilizado_apos_conclusao", _patrimonio)
    db = _Db()

    async def caso():
        await registrar_impressao_nf_e_opcional_encerrar(db, _infra(), pedido)

    asyncio.run(caso())
    assert pedido.status == STATUS_RECEBIDO
    assert pedido.nf_impressa_em is not None
    assert any("concluído" in (item.texto or "") for item in db.added)


def test_plano_parcelado_nao_diminui(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = SimpleNamespace(
        id="p-4",
        tipo="servico",
        destino_compras="infraestrutura",
        status=STATUS_AGUARDANDO_PAGAMENTO,
        pagamento_qtd_parcelas=4,
        pagamento_quitado_em=None,
        atualizado_em=datetime(2026, 11, 16, 9, 0, 0),
    )

    async def _contrato(_db, _pedido):
        return {"compra_executada": True}

    monkeypatch.setattr(fluxo, "situacao_contrato_infra", _contrato)

    async def caso():
        await definir_pagamento_parcelas(None, _infra(), pedido, 1)

    with pytest.raises(HTTPException) as erro:
        asyncio.run(caso())
    assert erro.value.status_code == 400
    assert pedido.pagamento_qtd_parcelas == 4
    assert "não diminui" in erro.value.detail
