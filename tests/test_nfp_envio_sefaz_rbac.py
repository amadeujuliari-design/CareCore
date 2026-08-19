from security import (
    usuario_pode_operar_envio_sefaz,
    usuario_pode_ver_envio_sefaz,
)


def test_envio_sefaz_rbac_perfis():
    assert usuario_pode_ver_envio_sefaz({"perfil_acesso": "Global", "is_global": True})
    assert not usuario_pode_operar_envio_sefaz({"perfil_acesso": "Global", "is_global": True})

    assert usuario_pode_ver_envio_sefaz({"perfil_acesso": "ADM Global NFP"})
    assert usuario_pode_operar_envio_sefaz({"perfil_acesso": "ADM Global NFP"})
    assert usuario_pode_ver_envio_sefaz({"perfil_acesso": "ADM Global"})
    assert usuario_pode_operar_envio_sefaz({"perfil_acesso": "ADM Global"})

    assert usuario_pode_ver_envio_sefaz({"perfil_acesso": "Manutenção", "is_manutencao": True})
    assert usuario_pode_operar_envio_sefaz({"perfil_acesso": "Manutenção", "is_manutencao": True})

    assert not usuario_pode_ver_envio_sefaz({"perfil_acesso": "ADM Produção NFP"})
    assert not usuario_pode_operar_envio_sefaz({"perfil_acesso": "ADM Produção NFP"})
    assert not usuario_pode_ver_envio_sefaz({"perfil_acesso": "ADM Produção"})
    assert not usuario_pode_operar_envio_sefaz({"perfil_acesso": "ADM Produção"})
