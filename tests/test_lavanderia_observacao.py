from routers.rotina_operacional import _append_observacao_lavanderia


def test_append_observacao_guarda_historico():
    atual = "2 camisetas e 1 calça"
    nova = "saiu 1 camiseta"
    resultado = _append_observacao_lavanderia(atual, nova)
    assert resultado is not None
    assert "2 camisetas e 1 calça" in resultado
    assert "saiu 1 camiseta" in resultado
    assert resultado != nova


def test_append_observacao_vazia_nao_apaga_historico():
    atual = "entrada: 8 peças"
    assert _append_observacao_lavanderia(atual, "  ") == atual
    assert _append_observacao_lavanderia(None, "primeira retirada") == "primeira retirada"
