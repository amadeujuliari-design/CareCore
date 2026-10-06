"""Faixas de idade e sexo do kit mensal do Reencontro Pari."""

from datetime import date

from kit_higiene_pari import (
    COMPLEMENTOS_CRUZEIRO,
    PERFIS_PADRAO,
    faixa_cruza,
    idade_em,
    montar_kit,
    normalizar_sexo,
)


HOJE = date(2026, 10, 1)


def _nascimento(anos: int) -> date:
    return date(HOJE.year - anos, 1, 1)


def _perfis():
    return [
        {"id": item["nome"], **item, "ativo": True}
        for item in PERFIS_PADRAO
    ]


def _pessoa(nome, anos=None, sexo="Masculino"):
    return {
        "nome": nome,
        "nascimento": None if anos is None else _nascimento(anos),
        "sexo": sexo,
    }


def test_sexo_do_cadastro():
    assert normalizar_sexo("Masculino") == "masculino"
    assert normalizar_sexo("Feminino") == "feminino"
    assert normalizar_sexo("") is None


def test_idade_fecha_no_aniversario():
    assert idade_em(date(2010, 10, 2), HOJE) == 15
    assert idade_em(date(2010, 10, 1), HOJE) == 16


def test_faixas_padrao_nao_se_cruzam():
    perfis = list(PERFIS_PADRAO)
    for indice, esquerda in enumerate(perfis):
        for direita in perfis[indice + 1:]:
            assert not faixa_cruza(esquerda, direita)


def test_faixa_editada_que_invade_a_seguinte_cruza():
    assert faixa_cruza(
        {"idade_min": 2, "idade_max": 11, "sexo": "qualquer"},
        {"idade_min": 11, "idade_max": 16, "sexo": "masculino"},
    )


def test_familia_soma_os_perfis():
    resultado = montar_kit(
        [
            _pessoa("Pai", 40, "Masculino"),
            _pessoa("Mae", 38, "Feminino"),
            _pessoa("Filho", 12, "Masculino"),
            _pessoa("Filha", 8, "Feminino"),
            _pessoa("Bebe", 0, "Feminino"),
        ],
        _perfis(),
        [
            {"tipo_id": "Homem", "item_id": "sab", "quantidade": 2},
            {"tipo_id": "Mulher", "item_id": "sab", "quantidade": 2},
            {"tipo_id": "Mulher", "item_id": "abs", "quantidade": 1},
            {"tipo_id": "Adolescente masculino", "item_id": "sab", "quantidade": 1},
            {"tipo_id": "Criança", "item_id": "sab", "quantidade": 1},
            {"tipo_id": "Bebê", "item_id": "fra", "quantidade": 3},
        ],
        [
            {"id": "sab", "nome": "Sabonete", "ativo": True},
            {"id": "abs", "nome": "Absorvente", "ativo": True},
            {"id": "fra", "nome": "Fralda", "ativo": True},
        ],
        HOJE,
    )
    assert resultado["completo"] is True
    assert resultado["pendencias"] == []
    assert resultado["composicao"] == [
        {"nome": "Absorvente", "quantidade": 1},
        {"nome": "Fralda", "quantidade": 3},
        {"nome": "Sabonete", "quantidade": 6},
    ]
    assert [grupo["perfil"] for grupo in resultado["grupos"]] == [
        "Bebê",
        "Criança",
        "Adolescente masculino",
        "Homem",
        "Mulher",
    ]


def test_sem_sexo_na_faixa_de_qualquer_entra_no_kit():
    resultado = montar_kit(
        [_pessoa("Criança sem sexo", 4, "")],
        _perfis(),
        [{"tipo_id": "Criança", "item_id": "sab", "quantidade": 1}],
        [{"id": "sab", "nome": "Sabonete", "ativo": True}],
        HOJE,
    )
    assert resultado["completo"] is True
    assert resultado["composicao"] == [{"nome": "Sabonete", "quantidade": 1}]


def test_sem_sexo_na_faixa_adulta_fica_fora():
    resultado = montar_kit(
        [_pessoa("Adulto sem sexo", 30, "")],
        _perfis(),
        [{"tipo_id": "Homem", "item_id": "sab", "quantidade": 1}],
        [{"id": "sab", "nome": "Sabonete", "ativo": True}],
        HOJE,
    )
    assert resultado["completo"] is False
    assert resultado["composicao"] == []
    assert resultado["pendencias"] == [{"nome": "Adulto sem sexo", "motivo": "Sem sexo"}]


def test_sem_nascimento_fica_fora():
    resultado = montar_kit(
        [_pessoa("Sem data", None, "Feminino")],
        _perfis(),
        [],
        [],
        HOJE,
    )
    assert resultado["pendencias"][0]["motivo"] == "Sem data de nascimento"
    assert resultado["completo"] is False


def _meses(quantidade: int) -> date:
    ano = HOJE.year
    mes = HOJE.month - quantidade
    while mes <= 0:
        mes += 12
        ano -= 1
    return date(ano, mes, HOJE.day)


def _complementos():
    return [
        {"id": item["nome"], **item, "ativo": True, "idade_min": 0, "idade_max": None}
        for item in COMPLEMENTOS_CRUZEIRO
    ]


def _regras_cruzeiro():
    return [
        {"tipo_id": "Bebê", "item_id": "base", "quantidade": 1},
        {"tipo_id": "Criança", "item_id": "base", "quantidade": 1},
        {"tipo_id": "Adolescente feminino", "item_id": "base", "quantidade": 1},
        {"tipo_id": "Fralda", "item_id": "fra", "quantidade": 1},
        {"tipo_id": "Sabonete infantil", "item_id": "sab", "quantidade": 1},
        {"tipo_id": "Leite", "item_id": "lei", "quantidade": 1},
        {"tipo_id": "Menstruação", "item_id": "abs", "quantidade": 1},
    ]


def _itens_cruzeiro():
    return [
        {"id": "base", "nome": "Kit base", "ativo": True},
        {"id": "fra", "nome": "Fralda", "ativo": True},
        {"id": "sab", "nome": "Sabonete infantil", "ativo": True},
        {"id": "lei", "nome": "Leite", "ativo": True},
        {"id": "abs", "nome": "Absorvente", "ativo": True},
    ]


def _nomes(meses, sexo="Feminino", menstrua=False):
    pessoa = {
        "nome": "Acolhido",
        "nascimento": _meses(meses),
        "sexo": sexo,
        "menstrua": menstrua,
    }
    resultado = montar_kit(
        [pessoa],
        _perfis() + _complementos(),
        _regras_cruzeiro(),
        _itens_cruzeiro(),
        HOJE,
        somar_complementos=True,
    )
    return {item["nome"] for item in resultado["composicao"]}


def test_cruzeiro_soma_complementos_pela_idade_em_meses():
    assert _nomes(0) == {"Kit base", "Fralda", "Sabonete infantil"}
    assert _nomes(6) == {"Kit base", "Fralda", "Sabonete infantil", "Leite"}
    assert _nomes(23) == {"Kit base", "Fralda", "Sabonete infantil", "Leite"}
    assert _nomes(24) == {"Kit base", "Fralda", "Leite"}
    assert _nomes(35) == {"Kit base", "Fralda", "Leite"}
    assert _nomes(36) == {"Kit base", "Leite"}
    assert _nomes(71) == {"Kit base", "Leite"}
    assert _nomes(72) == {"Kit base"}


def test_cruzeiro_menstruacao_so_entra_com_a_flag():
    assert "Absorvente" not in _nomes(13 * 12, "Feminino", False)
    assert "Absorvente" in _nomes(13 * 12, "Feminino", True)
    assert "Absorvente" not in _nomes(13 * 12, "Masculino", True)


def test_pari_ignora_complemento_mesmo_se_a_faixa_existir():
    resultado = montar_kit(
        [_pessoa("Bebe", 0, "Feminino")],
        _perfis() + _complementos(),
        _regras_cruzeiro(),
        _itens_cruzeiro(),
        HOJE,
    )
    assert resultado["composicao"] == [{"nome": "Kit base", "quantidade": 1}]
