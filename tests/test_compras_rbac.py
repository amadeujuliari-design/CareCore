from security import (
    PERFIL_ADM_COMPRAS,
    PERFIL_ADM_COMPRAS_INFRAESTRUTURA,
    PERFIL_ADM_COMPRAS_SUPRIMENTOS,
    usuario_eh_adm_compras,
    usuario_eh_adm_compras_infraestrutura,
    usuario_eh_adm_compras_suprimentos,
)


def test_usuario_eh_adm_compras():
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Global Compras"}) is True
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Compras"}) is True
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Global Compras Suprimentos"}) is True
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Global Compras Infraestrutura"}) is True
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Pedidos"}) is False
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Global Compras", "is_manutencao": True}) is False


def test_classes_adm_compras():
    assert usuario_eh_adm_compras_suprimentos({"perfil_acesso": PERFIL_ADM_COMPRAS_SUPRIMENTOS}) is True
    assert usuario_eh_adm_compras_infraestrutura({"perfil_acesso": PERFIL_ADM_COMPRAS_INFRAESTRUTURA}) is True
    assert usuario_eh_adm_compras_suprimentos({"perfil_acesso": PERFIL_ADM_COMPRAS_INFRAESTRUTURA}) is False
    assert PERFIL_ADM_COMPRAS == "ADM Global Compras"
