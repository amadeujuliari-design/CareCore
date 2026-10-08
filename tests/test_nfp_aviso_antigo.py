"""Aviso da Fazenda que continua igual ao de antes do clique."""

from __future__ import annotations

import sys
from pathlib import Path

ROBO = Path(__file__).resolve().parents[1] / "agente-nfp-robo" / "robo"
sys.path.insert(0, str(ROBO))

from retorno_nfp import classificar_texto_retorno, feedback_ainda_e_o_anterior  # noqa: E402

ERRO = (
    "Cadastro de doação 05/10/2026 às 14:52:00 "
    "Não foi possível incluir o pedido no sistema."
)
ERRO_NOVO = (
    "Cadastro de doação 05/10/2026 às 15:01:08 "
    "Não foi possível incluir o pedido no sistema."
)
SUCESSO = (
    "Doação registrada com sucesso. Aguardando processamento pelo sistema. "
    "05/10/2026 11:20:00"
)
SUCESSO_NOVO = (
    "Doação registrada com sucesso. Aguardando processamento pelo sistema. "
    "05/10/2026 11:21:04"
)
JA_EXISTE = "Este pedido já existe no sistema. Favor inserir uma nova nota."
PRAZO = "A Data da Nota excedeu o prazo máximo para cadastro."
CHAVE = "Chave inválida. Verifique o documento informado."
FORMULARIO = (
    "Entidade - Cadastro de Notas Documentos com Chave-de-acesso "
    "Chave-de-acesso Salvar Nota"
)


def test_erro_generico_com_o_mesmo_horario_e_aviso_anterior():
    assert feedback_ainda_e_o_anterior(ERRO, ERRO) is True


def test_erro_generico_com_horario_novo_e_resposta_nova():
    assert feedback_ainda_e_o_anterior(ERRO, ERRO_NOVO) is False


def test_sucesso_com_o_mesmo_horario_e_aviso_anterior():
    assert feedback_ainda_e_o_anterior(SUCESSO, SUCESSO) is True


def test_sucesso_com_horario_novo_e_resposta_nova():
    assert feedback_ainda_e_o_anterior(SUCESSO, SUCESSO_NOVO) is False


def test_ja_existe_igual_ao_que_ja_estava_na_tela():
    assert feedback_ainda_e_o_anterior(JA_EXISTE, JA_EXISTE) is True


def test_prazo_igual_ao_que_ja_estava_na_tela():
    assert feedback_ainda_e_o_anterior(PRAZO, PRAZO) is True


def test_chave_invalida_igual_a_que_ja_estava_na_tela():
    assert feedback_ainda_e_o_anterior(CHAVE, CHAVE) is True


def test_formulario_limpo_nao_e_aviso_anterior():
    assert feedback_ainda_e_o_anterior(FORMULARIO, JA_EXISTE) is False
    assert feedback_ainda_e_o_anterior(FORMULARIO, ERRO) is False
    assert feedback_ainda_e_o_anterior(FORMULARIO, SUCESSO) is False


def test_frase_diferente_nao_e_o_aviso_anterior():
    assert feedback_ainda_e_o_anterior(JA_EXISTE, SUCESSO) is False
    assert feedback_ainda_e_o_anterior(ERRO, PRAZO) is False


FORA_SP = (
    "Não é possível cadastrar nota de CF-e SAT/NFC-e emitido fora do Estado de São Paulo."
)
TELA_COM_MENU = (
    "Bem-vindo Entidade - Cadastro de Notas Documentos com Chave-de-acesso "
    "Chave-de-acesso Salvar Nota " + FORA_SP
)


def test_nota_de_fora_de_sao_paulo_sai_da_fila():
    cls = classificar_texto_retorno(TELA_COM_MENU)
    assert cls.tipo == "erro"
    assert cls.status_carecore == "erro"
    assert cls.mensagem == FORA_SP


def test_nota_de_fora_de_sao_paulo_igual_a_que_ja_estava_na_tela():
    assert feedback_ainda_e_o_anterior(FORA_SP, FORA_SP) is True
