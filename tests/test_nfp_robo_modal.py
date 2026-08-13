"""Classificacao dos avisos da NFP que o robo precisa fechar sozinho."""

from __future__ import annotations

import sys
from pathlib import Path

ROBO = Path(__file__).resolve().parents[1] / "agente-nfp-robo" / "robo"
sys.path.insert(0, str(ROBO))

from navegar_doacao_aeb import classificar_modal_nfp  # noqa: E402


def test_aviso_chave_44_digitos_e_instrutivo():
    texto = (
        "Mensagem Caso o documento a ser doado possua chave de acesso (44 dígitos), "
        "digite-a na opção 'Documentos com chave de acesso'. Nos demais casos, "
        "utilize a opção 'Documentos sem chave de acesso'. "
        "Deseja que esta mensagem não seja mais apresentada? "
        "Pressione ESC para fechar mensagem Sim Não"
    )
    assert classificar_modal_nfp(texto) == "instrutivo_chave"


def test_formulario_cadastro_sem_modal_nao_e_instrutivo():
    texto = (
        "Entidade - Cadastro de Notas Documentos com Chave-de-acesso "
        "Chave-de-acesso CNPJ do Emissor Data da Nota Salvar Nota"
    )
    assert classificar_modal_nfp(texto) == "generico"


def test_doar_todos_nao_e_instrutivo():
    texto = "Deseja doar todos os documentos fiscais com o seu CPF? Sim Não"
    assert classificar_modal_nfp(texto) == "doar_todos"


def test_bloqueio_terceiros():
    texto = (
        "Há indícios de que o consumidor tentou doar documentos que "
        "não eram referentes ao seu CPF."
    )
    assert classificar_modal_nfp(texto) == "bloqueio"
