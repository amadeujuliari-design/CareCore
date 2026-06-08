import pytest
from fastapi import HTTPException

from schemas import Token, UsuarioResponse, UsuarioResumoResponse
from tenant_scope import obter_instituicao_escopo, obter_organizacao_escopo


def test_token_usuario_nao_expoe_campos_pessoais_administrativos():
    token = Token.model_validate({
        "access_token": "token",
        "token_type": "bearer",
        "usuario": {
            "id": "u1",
            "sub": "u1",
            "usuario_id": "u1",
            "nome": "Usuário Teste",
            "email": "usuario@example.com",
            "instituicao_id": "inst1",
            "organizacao_id": "org1",
            "projeto_nome": "Projeto",
            "perfil_acesso": "Gestor",
            "is_master": True,
            "is_global": False,
            "ativo": True,
            "avatar_url": "/foto.png",
            "token_version": 2,
            "cpf": "12345678909",
            "rg": "MG123",
            "cep": "01001000",
            "logradouro": "Rua Teste",
            "data_nascimento": "1990-01-01",
        },
    })

    dados = token.model_dump()["usuario"]

    assert dados["id"] == "u1"
    assert dados["token_version"] == 2
    assert "cpf" not in dados
    assert "rg" not in dados
    assert "cep" not in dados
    assert "logradouro" not in dados
    assert "data_nascimento" not in dados


def test_usuario_resumo_nao_expoe_cpf_rg_ou_endereco():
    resumo = UsuarioResumoResponse.model_validate({
        "id": "u1",
        "nome": "Usuário Teste",
        "email": "usuario@example.com",
        "perfil_acesso": "Técnico",
        "is_global": False,
        "ativo": True,
        "avatar_url": "/foto.png",
        "cargo": "Técnico",
        "setor": "Social",
        "cpf": "12345678909",
        "rg": "MG123",
        "logradouro": "Rua Teste",
    })

    dados = resumo.model_dump()

    assert "cpf" not in dados
    assert "rg" not in dados
    assert "logradouro" not in dados


def test_usuario_response_administrativo_mantem_detalhe_autorizado():
    usuario = UsuarioResponse.model_validate({
        "id": "u1",
        "instituicao_id": "inst1",
        "nome": "Usuário Teste",
        "email": "usuario@example.com",
        "perfil_acesso": "Técnico",
        "is_master": False,
        "is_global": False,
        "ativo": True,
        "cpf": "11144477735",
        "rg": "MG123",
    })

    assert usuario.cpf == "11144477735"
    assert usuario.rg == "MG123"


def test_obter_instituicao_escopo_exige_projeto_ativo():
    assert obter_instituicao_escopo({"instituicao_id": "inst1"}) == "inst1"

    with pytest.raises(HTTPException) as erro:
        obter_instituicao_escopo({"instituicao_id": None})

    assert erro.value.status_code == 403


def test_obter_organizacao_escopo_eh_opcional():
    assert obter_organizacao_escopo({"organizacao_id": "org1"}) == "org1"
    assert obter_organizacao_escopo({}) is None
