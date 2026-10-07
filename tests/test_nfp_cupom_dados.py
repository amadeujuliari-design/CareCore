"""Cupom NFP digitado (sem chave de acesso) e leitura do JSON do robô."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from nfp_cupom_utils import cupom_lancado_por_dados, montar_chave_cupom_dados

ROBO = Path(__file__).resolve().parents[1] / "agente-nfp-robo" / "robo"
sys.path.insert(0, str(ROBO))

from ler_planilha_chaves import ler_chaves_json  # noqa: E402


def test_chave_sintetica_de_dados():
    chave = montar_chave_cupom_dados("26.563.652/0787-47", "2026-08-03", "019651")
    assert chave == "DADOS:26563652078747:20260803:019651"
    assert cupom_lancado_por_dados(chave)


def test_json_do_robo_mantem_cupom_por_dados(tmp_path: Path):
    caminho = tmp_path / "fila.json"
    caminho.write_text(
        json.dumps(
            [
                {"chave": "1" * 44, "forma": "chave"},
                {
                    "chave": "DADOS:26563652078747:20260803:019652",
                    "forma": "dados",
                    "cnpj": "26563652078747",
                    "data": "2026-08-03",
                    "coo": "019652",
                    "valor": "21,88",
                    "tipo_nota": "Cupom Fiscal",
                },
            ]
        ),
        encoding="utf-8",
    )
    fila = ler_chaves_json(caminho)
    assert [item["forma"] for item in fila] == ["chave", "dados"]
    assert fila[1]["coo"] == "019652"
    assert fila[1]["valor"] == "21,88"
