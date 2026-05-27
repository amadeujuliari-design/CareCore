from types import SimpleNamespace

from routers.conviventes import usuario_pode_resolver_ocorrencia
from security import usuario_eh_gestor, usuario_eh_tecnico_ou_superior


def test_master_eh_tratado_como_gestor():
    assert usuario_eh_gestor(
        {
            "perfil_acesso": "Consulta",
            "is_master": True,
        }
    )


def test_gestor_legado_gerente_eh_normalizado_como_gestor():
    assert usuario_eh_gestor(
        {
            "perfil_acesso": "Gerente",
            "is_master": False,
        }
    )


def test_tecnico_responsavel_pode_resolver_ocorrencia():
    usuario = {
        "sub": "tecnico-1",
        "perfil_acesso": "Técnico",
        "is_master": False,
    }
    ocorrencia = SimpleNamespace(tecnico_responsavel_id="tecnico-1")

    assert usuario_pode_resolver_ocorrencia(usuario, ocorrencia)


def test_tecnico_nao_responsavel_nao_pode_resolver_ocorrencia():
    usuario = {
        "sub": "tecnico-2",
        "perfil_acesso": "Técnico",
        "is_master": False,
    }
    ocorrencia = SimpleNamespace(tecnico_responsavel_id="tecnico-1")

    assert not usuario_pode_resolver_ocorrencia(usuario, ocorrencia)


def test_gestor_pode_resolver_ocorrencia_de_qualquer_tecnico():
    usuario = {
        "sub": "gestor-1",
        "perfil_acesso": "Gestor",
        "is_master": False,
    }
    ocorrencia = SimpleNamespace(tecnico_responsavel_id="tecnico-1")

    assert usuario_pode_resolver_ocorrencia(usuario, ocorrencia)


def test_tecnico_pode_gerenciar_quartos_e_leitos():
    assert usuario_eh_tecnico_ou_superior(
        {
            "perfil_acesso": "Técnico",
            "is_master": False,
        }
    )


def test_orientador_nao_pode_gerenciar_quartos_e_leitos():
    assert not usuario_eh_tecnico_ou_superior(
        {
            "perfil_acesso": "Orientador",
            "is_master": False,
        }
    )
