"""Reabertura do processo por fase (Sede escolhe até onde voltar)."""

from __future__ import annotations

import asyncio
from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from compras_pedido_fluxo import reabrir_processo_para_fase
from compras_regras import (
    FASE_REABERTURA_A_PAGAR,
    FASE_REABERTURA_AGUARDANDO_NF,
    FASE_REABERTURA_ASSINATURA_NF,
    FASE_REABERTURA_ENVIADO,
    FASE_REABERTURA_EXTRATO,
    PERFIL_ADM_COMPRAS_INFRAESTRUTURA,
    PERFIL_ADM_COMPRAS_SUPRIMENTOS,
    STATUS_AGUARDANDO_EXTRATO,
    STATUS_AGUARDANDO_NF,
    STATUS_AGUARDANDO_PAGAMENTO,
    STATUS_ENVIADO,
    STATUS_IMPRIMIR_NF,
    STATUS_RECEBIDO,
    fase_reabertura_valida,
    fases_reabertura_processo,
    pedido_status_permite_reabrir_processo,
)


def _pedido(**kwargs):
    base = dict(
        id="p-1",
        tipo="emergencia",
        destino_compras="infraestrutura",
        status=STATUS_IMPRIMIR_NF,
        recebido_em=datetime(2026, 11, 24, 9, 22, 0),
        recebido_por_id="proj-1",
        nf_impressa_em=datetime(2026, 11, 24, 8, 30, 0),
        nf_impressa_por_id="inf-1",
        nf_para_pagamento_em=datetime(2026, 11, 24, 8, 30, 0),
        nf_para_pagamento_por_id="inf-1",
        a_pagar_lida_em=datetime(2026, 11, 24, 8, 0, 0),
        a_pagar_lida_por_id="inf-1",
        status_anterior=None,
        atualizado_em=datetime(2026, 11, 24, 9, 22, 0),
    )
    base.update(kwargs)
    return SimpleNamespace(**base)


def _infra():
    return {"perfil_acesso": PERFIL_ADM_COMPRAS_INFRAESTRUTURA, "id": "inf-1"}


def _suprimentos():
    return {"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS, "id": "sup-1"}


def _gestor():
    return {"perfil_acesso": "Gestor", "id": "g-1"}


class _Db:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)


def test_status_origem_reabertura():
    assert pedido_status_permite_reabrir_processo(STATUS_IMPRIMIR_NF)
    assert pedido_status_permite_reabrir_processo(STATUS_RECEBIDO)
    assert pedido_status_permite_reabrir_processo(STATUS_AGUARDANDO_EXTRATO)
    assert pedido_status_permite_reabrir_processo(STATUS_AGUARDANDO_PAGAMENTO)
    assert not pedido_status_permite_reabrir_processo(STATUS_AGUARDANDO_NF)
    assert not pedido_status_permite_reabrir_processo("cancelado")


def test_fases_emergencia_concluida():
    ids = [f["id"] for f in fases_reabertura_processo("emergencia", "infraestrutura", STATUS_IMPRIMIR_NF)]
    assert ids == [
        FASE_REABERTURA_AGUARDANDO_NF,
        FASE_REABERTURA_ASSINATURA_NF,
        FASE_REABERTURA_A_PAGAR,
        FASE_REABERTURA_EXTRATO,
    ]


def test_fases_emergencia_em_a_pagar_nao_oferece_extrato():
    ids = [f["id"] for f in fases_reabertura_processo("emergencia", "infraestrutura", STATUS_AGUARDANDO_PAGAMENTO)]
    assert FASE_REABERTURA_EXTRATO not in ids
    assert FASE_REABERTURA_AGUARDANDO_NF in ids
    assert FASE_REABERTURA_A_PAGAR not in ids  # já está nela


def test_fases_consumo_concluido():
    ids = [f["id"] for f in fases_reabertura_processo("consumo", None, STATUS_RECEBIDO)]
    assert ids == [FASE_REABERTURA_ENVIADO, FASE_REABERTURA_A_PAGAR]
    assert FASE_REABERTURA_AGUARDANDO_NF not in ids


def test_fase_valida_rejeita_fase_de_outro_tipo():
    assert fase_reabertura_valida("emergencia", FASE_REABERTURA_AGUARDANDO_NF, status_atual=STATUS_IMPRIMIR_NF)
    assert not fase_reabertura_valida("emergencia", FASE_REABERTURA_ENVIADO, status_atual=STATUS_IMPRIMIR_NF)
    assert not fase_reabertura_valida("consumo", FASE_REABERTURA_AGUARDANDO_NF, status_atual=STATUS_RECEBIDO)


def test_reabrir_emergencia_para_aguardando_nf_limpa_marcadores(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido()
    db = _Db()

    async def _notas(_db, _pid):
        return [SimpleNamespace(tipo_nf="produto", anexo_id="nf1")]

    monkeypatch.setattr(fluxo, "_notas_pedido", _notas)

    async def caso():
        await reabrir_processo_para_fase(
            db,
            _infra(),
            pedido,
            fase=FASE_REABERTURA_AGUARDANDO_NF,
            motivo="NF errada anexada pelo projeto",
        )

    asyncio.run(caso())
    assert pedido.status == STATUS_AGUARDANDO_NF
    assert pedido.recebido_em is None
    assert pedido.recebido_por_id is None
    assert pedido.nf_impressa_em is None
    assert pedido.nf_para_pagamento_em is None
    assert pedido.a_pagar_lida_em is None
    assert any("Aguardando NF" in (item.texto or "") for item in db.added)
    assert any("NF errada" in (item.texto or "") for item in db.added)


async def _sem_notas(_db, _pid):
    return []


def test_reabrir_emergencia_para_a_pagar(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido(status=STATUS_RECEBIDO)
    db = _Db()
    monkeypatch.setattr(fluxo, "_notas_pedido", _sem_notas)

    async def caso():
        await reabrir_processo_para_fase(
            db,
            _suprimentos(),
            pedido,
            fase=FASE_REABERTURA_A_PAGAR,
            motivo="Precisa reimprimir NF",
        )

    asyncio.run(caso())
    assert pedido.status == STATUS_AGUARDANDO_PAGAMENTO
    assert pedido.nf_impressa_em is None
    assert any("A pagar" in (item.texto or "") for item in db.added)


def test_reabrir_para_extrato_mantem_impressao(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido(status=STATUS_IMPRIMIR_NF)
    impressa = pedido.nf_impressa_em
    db = _Db()
    monkeypatch.setattr(fluxo, "_notas_pedido", _sem_notas)

    async def caso():
        await reabrir_processo_para_fase(
            db,
            _infra(),
            pedido,
            fase=FASE_REABERTURA_EXTRATO,
            motivo="Projeto precisa reencerrar após conferência",
        )

    asyncio.run(caso())
    assert pedido.status == STATUS_AGUARDANDO_EXTRATO
    assert pedido.recebido_em is None
    assert pedido.nf_impressa_em == impressa
    assert pedido.nf_para_pagamento_em is not None


def test_reabrir_assinatura_sem_nf_cai_para_aguardando_nf(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido()
    db = _Db()
    monkeypatch.setattr(fluxo, "_notas_pedido", _sem_notas)

    async def caso():
        await reabrir_processo_para_fase(
            db,
            _infra(),
            pedido,
            fase=FASE_REABERTURA_ASSINATURA_NF,
            motivo="Reassinatura necessária",
        )

    asyncio.run(caso())
    assert pedido.status == STATUS_AGUARDANDO_NF


def test_reabrir_consumo_para_enviado(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido(
        tipo="consumo",
        destino_compras=None,
        status=STATUS_RECEBIDO,
        nf_impressa_em=datetime(2026, 11, 20, 10, 0, 0),
    )
    db = _Db()
    monkeypatch.setattr(fluxo, "_notas_pedido", _sem_notas)

    async def caso():
        await reabrir_processo_para_fase(
            db,
            _suprimentos(),
            pedido,
            fase=FASE_REABERTURA_ENVIADO,
            motivo="Trocar NF de consumo",
        )

    asyncio.run(caso())
    assert pedido.status == STATUS_ENVIADO
    assert pedido.nf_impressa_em is None


def test_projeto_nao_pode_reabrir(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido()
    db = _Db()
    monkeypatch.setattr(fluxo, "_notas_pedido", _sem_notas)

    async def caso():
        with pytest.raises(HTTPException) as exc:
            await reabrir_processo_para_fase(
                db,
                _gestor(),
                pedido,
                fase=FASE_REABERTURA_AGUARDANDO_NF,
                motivo="Tentativa do projeto",
            )
        assert exc.value.status_code == 403

    asyncio.run(caso())


def test_motivo_obrigatorio(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido()
    db = _Db()
    monkeypatch.setattr(fluxo, "_notas_pedido", _sem_notas)

    async def caso():
        with pytest.raises(HTTPException) as exc:
            await reabrir_processo_para_fase(
                db,
                _infra(),
                pedido,
                fase=FASE_REABERTURA_AGUARDANDO_NF,
                motivo="ab",
            )
        assert exc.value.status_code == 400

    asyncio.run(caso())


def test_fase_invalida_para_tipo(monkeypatch):
    import compras_pedido_fluxo as fluxo

    pedido = _pedido(tipo="consumo", destino_compras=None, status=STATUS_RECEBIDO)
    db = _Db()
    monkeypatch.setattr(fluxo, "_notas_pedido", _sem_notas)

    async def caso():
        with pytest.raises(HTTPException) as exc:
            await reabrir_processo_para_fase(
                db,
                _suprimentos(),
                pedido,
                fase=FASE_REABERTURA_AGUARDANDO_NF,
                motivo="Fase errada para consumo",
            )
        assert exc.value.status_code == 400

    asyncio.run(caso())
