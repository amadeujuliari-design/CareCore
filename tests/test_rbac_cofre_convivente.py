from types import SimpleNamespace

from routers.conviventes import usuario_pode_ver_credenciais_cofre_convivente


def _convivente(tecnico_id="tecnico-1"):
    return SimpleNamespace(tecnico_id=tecnico_id)


def test_gestor_pode_ver_cofre_de_qualquer_convivente():
    usuario = {
        "sub": "gestor-1",
        "perfil_acesso": "Gestor",
        "is_master": False,
    }

    assert usuario_pode_ver_credenciais_cofre_convivente(
        usuario,
        _convivente("tecnico-1"),
    )


def test_master_pode_ver_cofre_de_qualquer_convivente():
    usuario = {
        "sub": "usuario-master",
        "perfil_acesso": "Consulta",
        "is_master": True,
    }

    assert usuario_pode_ver_credenciais_cofre_convivente(
        usuario,
        _convivente("tecnico-1"),
    )


def test_tecnico_responsavel_pode_ver_cofre():
    usuario = {
        "sub": "tecnico-1",
        "perfil_acesso": "Técnico",
        "is_master": False,
    }

    assert usuario_pode_ver_credenciais_cofre_convivente(
        usuario,
        _convivente("tecnico-1"),
    )


def test_tecnico_nao_responsavel_nao_pode_ver_cofre():
    usuario = {
        "sub": "tecnico-2",
        "perfil_acesso": "Técnico",
        "is_master": False,
    }

    assert not usuario_pode_ver_credenciais_cofre_convivente(
        usuario,
        _convivente("tecnico-1"),
    )


def test_outros_perfis_nao_podem_ver_cofre():
    usuario = {
        "sub": "consulta-1",
        "perfil_acesso": "Consulta",
        "is_master": False,
    }

    assert not usuario_pode_ver_credenciais_cofre_convivente(
        usuario,
        _convivente("tecnico-1"),
    )
