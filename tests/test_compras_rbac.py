from security import (
    PERFIL_ADM_COMPRAS,
    PERFIL_ADM_PEDIDOS,
    caminho_api_permitido_para_adm_compras,
    caminho_api_permitido_para_adm_pedidos,
    usuario_eh_adm_compras,
    usuario_eh_adm_pedidos,
)


def test_usuario_eh_adm_compras():
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Global Compras"}) is True
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Compras"}) is True
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Pedidos"}) is False
    assert usuario_eh_adm_compras({"perfil_acesso": "ADM Global Compras", "is_manutencao": True}) is False


def test_usuario_eh_adm_pedidos():
    assert usuario_eh_adm_pedidos({"perfil_acesso": "ADM Pedidos"}) is True
    assert usuario_eh_adm_pedidos({"perfil_acesso": "Adm Pedidos"}) is True
    assert usuario_eh_adm_pedidos({"perfil_acesso": "Gestor"}) is False


def test_caminho_api_adm_compras():
    assert caminho_api_permitido_para_adm_compras("/api/compras/pedidos") is True
    assert caminho_api_permitido_para_adm_compras("/api/usuarios/organizacao/adm-global") is True
    assert caminho_api_permitido_para_adm_compras("/api/chat") is True
    assert caminho_api_permitido_para_adm_compras("/api/conviventes") is False
    assert PERFIL_ADM_COMPRAS == "ADM Global Compras"


def test_caminho_api_adm_pedidos():
    assert caminho_api_permitido_para_adm_pedidos("/api/compras/pedidos/abc/receber") is True
    assert caminho_api_permitido_para_adm_pedidos("/api/usuarios/me") is True
    assert caminho_api_permitido_para_adm_pedidos("/api/nfp/dashboard") is False
    assert caminho_api_permitido_para_adm_pedidos("/api/conviventes") is False
    assert PERFIL_ADM_PEDIDOS == "ADM Pedidos"
