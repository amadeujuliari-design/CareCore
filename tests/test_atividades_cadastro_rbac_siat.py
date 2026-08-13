from security import (
    usuario_pode_gerenciar_cadastro_atividades_siat,
    usuario_na_allowlist_cadastro_atividades_siat,
)


def test_allowlist_luciana_siat():
    assert usuario_na_allowlist_cadastro_atividades_siat(
        {"email": "luciana@carecore.com"}
    )
    assert usuario_na_allowlist_cadastro_atividades_siat(
        {"email": " LUCIANA@CARECORE.COM "}
    )
    assert not usuario_na_allowlist_cadastro_atividades_siat(
        {"email": "outro@carecore.com"}
    )


def test_pode_gerenciar_cadastro_atividades_siat():
    assert usuario_pode_gerenciar_cadastro_atividades_siat(
        {"is_manutencao": True, "email": "x@y.com", "perfil_acesso": "Técnico"}
    )
    assert usuario_pode_gerenciar_cadastro_atividades_siat(
        {"perfil_acesso": "Gestor", "email": "gestor@aeb.org.br", "is_manutencao": False}
    )
    assert usuario_pode_gerenciar_cadastro_atividades_siat(
        {
            "perfil_acesso": "Administrativo",
            "email": "luciana@carecore.com",
            "is_manutencao": False,
        }
    )
    assert not usuario_pode_gerenciar_cadastro_atividades_siat(
        {
            "perfil_acesso": "Técnico",
            "email": "tecnico@aeb.org.br",
            "is_manutencao": False,
        }
    )
    assert not usuario_pode_gerenciar_cadastro_atividades_siat(
        {
            "perfil_acesso": "Oficineiro(a)",
            "email": "oficina@aeb.org.br",
            "is_manutencao": False,
        }
    )
