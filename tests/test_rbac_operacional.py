from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers.conviventes import usuario_pode_resolver_ocorrencia
from security import (
    bloquear_usuario_global_puro,
    usuario_eh_gestor,
    usuario_eh_global_puro,
    usuario_eh_tecnico_ou_superior,
)


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


def test_global_puro_nao_eh_tratado_como_gestor_operacional():
    usuario = {
        "perfil_acesso": "Global",
        "is_global": True,
        "is_master": False,
    }

    assert usuario_eh_global_puro(usuario)
    assert not usuario_eh_gestor(usuario)
    assert not usuario_eh_tecnico_ou_superior(usuario)


def test_global_puro_eh_bloqueado_em_operacoes_de_projeto():
    usuario = {
        "perfil_acesso": "Global",
        "is_global": True,
        "is_master": False,
    }

    with pytest.raises(HTTPException) as erro:
        bloquear_usuario_global_puro(usuario)

    assert getattr(erro.value, "status_code", None) == 403


def test_global_gestor_nao_eh_global_puro():
    usuario = {
        "perfil_acesso": "Gestor",
        "is_global": True,
        "is_master": True,
    }

    assert usuario_eh_gestor(usuario)
    assert not usuario_eh_global_puro(usuario)
    bloquear_usuario_global_puro(usuario)


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
