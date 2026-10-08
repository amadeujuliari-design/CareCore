"""Parada do agente NFP vale para qualquer rotina."""

from __future__ import annotations

import sys
from pathlib import Path

AGENTE = Path(__file__).resolve().parents[1] / "agente-nfp-robo"
sys.path.insert(0, str(AGENTE))

from agente_nfp import operador_pediu_parada  # noqa: E402


def test_parada_encerra_mesmo_sem_motivo_no_lote():
    assert operador_pediu_parada("", parada=True) is True
    assert operador_pediu_parada("lote_completo", parada=True) is True


def test_motivo_de_parada_encerra_continuo_e_lote_unico():
    assert operador_pediu_parada("parada_usuario", parada=False) is True


def test_lote_normal_nao_e_parada():
    assert operador_pediu_parada("", parada=False) is False
    assert operador_pediu_parada("lote_completo", parada=False) is False
    assert operador_pediu_parada("sessao_caiu", parada=False) is False
