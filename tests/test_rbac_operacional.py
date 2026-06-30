from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers.conviventes import (
    convivente_esta_ativo,
    exigir_convivente_ativo_para_registro,
    usuario_pode_excluir_convivente_sem_vinculos,
    usuario_pode_alterar_status_convivente,
    usuario_pode_gerenciar_pia_convivente,
    usuario_pode_resolver_ocorrencia,
)
from security import (
    bloquear_usuario_global_puro,
    caminho_api_permitido_para_oficineiro,
    usuario_eh_gestor,
    usuario_eh_global_puro,
    usuario_eh_oficineiro,
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


def test_tecnico_pode_resolver_ocorrencia_sem_responsavel():
    usuario = {
        "sub": "tecnico-2",
        "perfil_acesso": "Técnico",
        "is_master": False,
    }
    ocorrencia = SimpleNamespace(tecnico_responsavel_id=None)

    assert usuario_pode_resolver_ocorrencia(usuario, ocorrencia)


def test_orientador_nao_pode_resolver_ocorrencia_sem_responsavel():
    usuario = {
        "sub": "orientador-1",
        "perfil_acesso": "Orientador",
        "is_master": False,
    }
    ocorrencia = SimpleNamespace(tecnico_responsavel_id=None)

    assert not usuario_pode_resolver_ocorrencia(usuario, ocorrencia)


def test_tecnico_pode_alterar_status_de_convivente_sem_tecnico_atrelado():
    usuario = {
        "sub": "tecnico-2",
        "perfil_acesso": "Técnico",
        "is_master": False,
    }
    convivente = SimpleNamespace(tecnico_id=None)

    assert usuario_pode_alterar_status_convivente(usuario, convivente)


def test_tecnico_nao_responsavel_nao_pode_alterar_status_com_tecnico_atrelado():
    usuario = {
        "sub": "tecnico-2",
        "perfil_acesso": "Técnico",
        "is_master": False,
    }
    convivente = SimpleNamespace(tecnico_id="tecnico-1")

    assert not usuario_pode_alterar_status_convivente(usuario, convivente)


def test_manutencao_pode_alterar_status_mesmo_com_tecnico_atrelado():
    usuario = {
        "sub": "manutencao-1",
        "perfil_acesso": "Manutenção",
        "is_manutencao": True,
    }
    convivente = SimpleNamespace(tecnico_id="tecnico-1")

    assert usuario_pode_alterar_status_convivente(usuario, convivente)


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


def test_manutencao_com_visao_global_nao_e_global_puro():
    usuario = {
        "perfil_acesso": "Manutenção",
        "is_global": True,
        "is_master": False,
        "is_manutencao": True,
    }

    assert not usuario_eh_global_puro(usuario)
    assert usuario_eh_tecnico_ou_superior(usuario)
    bloquear_usuario_global_puro(usuario)


def test_manutencao_por_perfil_nao_e_global_puro_mesmo_sem_master():
    usuario = {
        "perfil_acesso": "Manutenção",
        "is_global": True,
        "is_master": False,
    }

    assert not usuario_eh_global_puro(usuario)
    bloquear_usuario_global_puro(usuario)


def test_orientador_nao_pode_gerenciar_quartos_e_leitos():
    assert not usuario_eh_tecnico_ou_superior(
        {
            "perfil_acesso": "Orientador",
            "is_master": False,
        }
    )


def test_gestor_pode_excluir_convivente_sem_vinculos():
    assert usuario_pode_excluir_convivente_sem_vinculos({
        "perfil_acesso": "Gestor",
        "is_master": False,
    })


def test_manutencao_pode_excluir_convivente_sem_vinculos():
    assert usuario_pode_excluir_convivente_sem_vinculos({
        "perfil_acesso": "Manutenção",
        "is_manutencao": True,
    })


def test_tecnico_nao_pode_excluir_convivente_sem_vinculos():
    assert not usuario_pode_excluir_convivente_sem_vinculos({
        "perfil_acesso": "Técnico",
        "is_master": False,
    })


def test_gestor_pode_gerenciar_pia_convivente():
    assert usuario_pode_gerenciar_pia_convivente({
        "perfil_acesso": "Gestor",
        "is_master": False,
    })


def test_tecnico_pode_gerenciar_pia_convivente():
    assert usuario_pode_gerenciar_pia_convivente({
        "perfil_acesso": "Técnico",
        "is_master": False,
    })


def test_orientador_nao_pode_gerenciar_pia_convivente():
    assert not usuario_pode_gerenciar_pia_convivente({
        "perfil_acesso": "Orientador",
        "is_master": False,
    })


def test_convivente_ativo_pode_receber_registro_operacional():
    convivente = SimpleNamespace(status="Ativo")

    assert convivente_esta_ativo(convivente)
    exigir_convivente_ativo_para_registro(convivente)


def test_convivente_inativo_bloqueia_registro_operacional():
    convivente = SimpleNamespace(status="Inativado")

    assert not convivente_esta_ativo(convivente)
    with pytest.raises(HTTPException) as erro:
        exigir_convivente_ativo_para_registro(convivente)

    assert getattr(erro.value, "status_code", None) == 409
    assert "Ative o convivente" in str(erro.value.detail)


def test_oficineiro_eh_identificado_pelo_perfil():
    usuario = {
        "perfil_acesso": "Oficineiro(a)",
        "is_master": False,
    }

    assert usuario_eh_oficineiro(usuario)
    assert not usuario_eh_gestor(usuario)


def test_oficineiro_legado_eh_normalizado():
    usuario = {
        "perfil_acesso": "Oficineiro",
        "is_master": False,
    }

    assert usuario_eh_oficineiro(usuario)


def test_caminho_api_oficineiro_permite_atividades_e_bloqueia_conviventes():
    assert caminho_api_permitido_para_oficineiro("/api/atividades", "GET")
    assert caminho_api_permitido_para_oficineiro("/api/atividades/sisa/catalogo", "GET")
    assert caminho_api_permitido_para_oficineiro("/api/usuarios", "GET")
    assert caminho_api_permitido_para_oficineiro("/api/usuarios/me", "GET")
    assert not caminho_api_permitido_para_oficineiro("/api/conviventes", "GET")
    assert not caminho_api_permitido_para_oficineiro("/api/rotina", "POST")
