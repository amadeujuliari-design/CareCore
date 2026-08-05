from security import (
    PERFIL_ADM_GLOBAL,
    caminho_api_permitido_para_adm_global,
    usuario_eh_adm_global,
    usuario_pode_acessar_nfp,
)


def test_usuario_eh_adm_global():
    assert usuario_eh_adm_global({"perfil_acesso": "ADM Global"}) is True
    assert usuario_eh_adm_global({"perfil_acesso": "Global"}) is False
    assert usuario_eh_adm_global({"perfil_acesso": "ADM Global", "is_manutencao": True}) is False


def test_usuario_pode_acessar_nfp():
    assert usuario_pode_acessar_nfp({"perfil_acesso": "ADM Global"}) is True
    assert usuario_pode_acessar_nfp({"perfil_acesso": "Global"}) is True
    assert usuario_pode_acessar_nfp({"perfil_acesso": "Manutenção"}) is True
    assert usuario_pode_acessar_nfp({"perfil_acesso": "Gestor"}) is False
    assert usuario_pode_acessar_nfp({"perfil_acesso": "Técnico"}) is False


def test_caminho_api_adm_global():
    assert caminho_api_permitido_para_adm_global("/api/nfp/dashboard") is True
    assert caminho_api_permitido_para_adm_global("/api/auth/login") is True
    assert caminho_api_permitido_para_adm_global("/api/usuarios/me") is True
    assert caminho_api_permitido_para_adm_global("/api/conviventes") is False
    assert PERFIL_ADM_GLOBAL == "ADM Global"
