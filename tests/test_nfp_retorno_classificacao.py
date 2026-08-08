"""Testes leves do classificador de retorno NFP (sem browser)."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts" / "nfp_robo"))

from retorno_nfp import classificar_texto_retorno, resultado_operacional_ok  # noqa: E402


def test_ja_existe():
    cls = classificar_texto_retorno(
        "Erro close Este pedido já existe no sistema. Favor inserir uma nova nota."
    )
    assert cls.tipo == "ja_existe"
    assert cls.status_carecore == "enviado"
    assert resultado_operacional_ok(cls)


def test_sucesso_oficial_nfp():
    cls = classificar_texto_retorno(
        "Mensagem Doação registrada com sucesso. Aguardando processamento pelo sistema. "
        "Deseja doar todos os documentos fiscais com o seu CPF para esta entidade? Sim Não"
    )
    assert cls.tipo == "sucesso"
    assert cls.status_carecore == "enviado"
    assert resultado_operacional_ok(cls)


def test_sucesso_vence_texto_antigo_ja_existe_no_dom():
    """DOM da NFP costuma manter texto antigo do modal Erro."""
    cls = classificar_texto_retorno(
        "Erro close Este pedido já existe no sistema. Favor inserir uma nova nota. "
        "Mensagem Doação registrada com sucesso. Aguardando processamento pelo sistema."
    )
    assert cls.tipo == "sucesso"


def test_sucesso_variantes():
    for msg in (
        "Doação registrada com sucesso.",
        "Registrado com sucesso",
        "Operação realizada com sucesso",
        "Documento doado com sucesso",
        "A doação foi efetuada com sucesso",
        "Pedido registrado na base",
    ):
        cls = classificar_texto_retorno(msg)
        assert cls.tipo == "sucesso", msg
        assert cls.status_carecore == "enviado", msg


def test_inconclusivo_menu():
    cls = classificar_texto_retorno(
        "Ir para o Menu Ir para o Conteúdo Doação de Documento Fiscal "
        "CPF: 048.175.133-57 Usuário: ROBSON"
    )
    assert cls.tipo == "inconclusivo"
    assert cls.status_carecore == "pendente"
