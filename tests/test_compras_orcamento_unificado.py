"""Unificação dos orçamentos do fornecedor vencedor."""

from types import SimpleNamespace
from datetime import datetime

from compras_regras import (
    PREFIXO_ORCAMENTO_UNIFICADO,
    TIPO_ANEXO_ORCAMENTO,
    TIPO_ANEXO_ORCAMENTO_ASSINADO,
    TIPO_ANEXO_ORCAMENTO_ORIGEM,
    anexos_orcamento_para_envio,
    eh_anexo_orcamento_unificado,
    fontes_unificacao_orcamento,
)


def _anexo(**kwargs):
    base = {
        "id": kwargs.get("id", "x"),
        "tipo": TIPO_ANEXO_ORCAMENTO,
        "ativo": True,
        "nome_arquivo": "a.pdf",
        "criado_em": datetime(2026, 10, 31, 10, 0, 0),
    }
    base.update(kwargs)
    return SimpleNamespace(**base)


def test_reconhece_nome_do_pacote():
    assert eh_anexo_orcamento_unificado(f"{PREFIXO_ORCAMENTO_UNIFICADO}-AB12.pdf")
    assert not eh_anexo_orcamento_unificado("orcamento-fornecedor.pdf")


def test_fontes_ignora_pacote_e_ordena_por_anexacao():
    pacote = _anexo(
        id="p",
        nome_arquivo=f"{PREFIXO_ORCAMENTO_UNIFICADO}-X.pdf",
        criado_em=datetime(2026, 10, 31, 12, 0, 0),
    )
    origem_b = _anexo(
        id="b",
        tipo=TIPO_ANEXO_ORCAMENTO_ORIGEM,
        ativo=False,
        nome_arquivo="b.pdf",
        criado_em=datetime(2026, 10, 31, 11, 0, 0),
    )
    origem_a = _anexo(
        id="a",
        tipo=TIPO_ANEXO_ORCAMENTO_ORIGEM,
        ativo=False,
        nome_arquivo="a.pdf",
        criado_em=datetime(2026, 10, 31, 10, 0, 0),
    )
    novo = _anexo(
        id="c",
        nome_arquivo="c.pdf",
        criado_em=datetime(2026, 10, 31, 13, 0, 0),
    )
    fontes = fontes_unificacao_orcamento([pacote, origem_b, origem_a, novo])
    assert [f.id for f in fontes] == ["a", "b", "c"]


def test_um_arquivo_so_nao_precisa_juntar():
    unico = _anexo(id="1", nome_arquivo="unico.pdf")
    assert len(fontes_unificacao_orcamento([unico])) == 1


def test_envio_prefere_assinado_depois_unificado():
    origem = _anexo(
        id="o",
        tipo=TIPO_ANEXO_ORCAMENTO_ORIGEM,
        ativo=False,
        nome_arquivo="parte1.pdf",
    )
    unificado = _anexo(
        id="u",
        nome_arquivo=f"{PREFIXO_ORCAMENTO_UNIFICADO}-X.pdf",
    )
    assinado = _anexo(
        id="s",
        tipo=TIPO_ANEXO_ORCAMENTO_ASSINADO,
        nome_arquivo="orcamento-assinado.pdf",
        criado_em=datetime(2026, 10, 31, 14, 0, 0),
    )
    assert [a.id for a in anexos_orcamento_para_envio([origem, unificado, assinado])] == ["s"]
    assert [a.id for a in anexos_orcamento_para_envio([origem, unificado])] == ["u"]


def test_envio_sem_pacote_manda_os_ativos():
    a = _anexo(id="a", nome_arquivo="a.pdf", criado_em=datetime(2026, 10, 31, 10, 0, 0))
    b = _anexo(id="b", nome_arquivo="b.pdf", criado_em=datetime(2026, 10, 31, 11, 0, 0))
    assert [x.id for x in anexos_orcamento_para_envio([a, b])] == ["a", "b"]
