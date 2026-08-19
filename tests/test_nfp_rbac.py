import pytest

from security import (
    PERFIL_ADM_GLOBAL,
    PERFIL_ADM_PRODUCAO,
    bloquear_usuario_global_puro,
    caminho_api_permitido_para_adm_global,
    caminho_api_permitido_para_adm_producao,
    usuario_eh_adm_global,
    usuario_eh_adm_producao,
    usuario_eh_global_puro,
    usuario_pode_acessar_nfp,
    usuario_pode_gestao_nfp_completa,
    usuario_pode_leitura_cupons_nfp,
)


def test_usuario_eh_adm_global():
    assert usuario_eh_adm_global({"perfil_acesso": "ADM Global"}) is True
    assert usuario_eh_adm_global({"perfil_acesso": "Global"}) is False
    assert usuario_eh_adm_global({"perfil_acesso": "ADM Global", "is_manutencao": True}) is False


def test_usuario_eh_adm_producao():
    assert usuario_eh_adm_producao({"perfil_acesso": "ADM Produção"}) is True
    assert usuario_eh_adm_producao({"perfil_acesso": "ADM Global"}) is False
    assert usuario_eh_adm_producao({"perfil_acesso": "Adm Producao"}) is True


def test_usuario_pode_acessar_nfp():
    assert usuario_pode_acessar_nfp({"perfil_acesso": "ADM Global"}) is True
    assert usuario_pode_acessar_nfp({"perfil_acesso": "ADM Produção"}) is True
    assert usuario_pode_acessar_nfp({"perfil_acesso": "Global"}) is True
    assert usuario_pode_acessar_nfp({"perfil_acesso": "Manutenção"}) is True
    assert usuario_pode_acessar_nfp({"perfil_acesso": "Gestor"}) is False
    assert usuario_pode_acessar_nfp({"perfil_acesso": "Técnico"}) is False


def test_gestao_vs_leitura():
    assert usuario_pode_gestao_nfp_completa({"perfil_acesso": "ADM Global"}) is True
    assert usuario_pode_gestao_nfp_completa({"perfil_acesso": "ADM Produção"}) is False
    assert usuario_pode_leitura_cupons_nfp({"perfil_acesso": "ADM Produção"}) is True


def test_global_puro_consulta_nfp_mas_nao_escreve():
    global_puro = {"perfil_acesso": "Global", "is_global": True, "is_master": False}
    assert usuario_pode_gestao_nfp_completa(global_puro) is True
    assert usuario_eh_global_puro(global_puro) is True
    with pytest.raises(Exception) as erro:
        bloquear_usuario_global_puro(global_puro)
    assert getattr(erro.value, "status_code", None) == 403

    adm = {"perfil_acesso": "ADM Global"}
    assert usuario_eh_global_puro(adm) is False
    bloquear_usuario_global_puro(adm)


def test_caminho_api_adm_global():
    assert caminho_api_permitido_para_adm_global("/api/nfp/dashboard") is True
    assert caminho_api_permitido_para_adm_global("/api/auth/login") is True
    assert caminho_api_permitido_para_adm_global("/api/login") is True
    assert caminho_api_permitido_para_adm_global("/api/onboarding") is True
    assert caminho_api_permitido_para_adm_global("/api/usuarios/me") is True
    assert caminho_api_permitido_para_adm_global("/api/usuarios/organizacao/adm-global") is True
    assert caminho_api_permitido_para_adm_global("/api/usuarios/organizacao/vinculos-nfp") is True
    assert caminho_api_permitido_para_adm_global("/api/chat") is True
    assert caminho_api_permitido_para_adm_global("/api/chat/usuarios") is True
    assert caminho_api_permitido_para_adm_global("/api/conviventes") is False
    assert PERFIL_ADM_GLOBAL == "ADM Global NFP"


def test_caminho_api_adm_producao():
    assert caminho_api_permitido_para_adm_producao("/api/nfp/cupons", "GET") is True
    assert caminho_api_permitido_para_adm_producao("/api/nfp/cupons/leitura", "POST") is True
    assert caminho_api_permitido_para_adm_producao("/api/nfp/agentes", "GET") is True
    assert caminho_api_permitido_para_adm_producao("/api/chat/conversas", "GET") is True
    assert caminho_api_permitido_para_adm_producao("/api/nfp/dashboard", "GET") is False
    assert caminho_api_permitido_para_adm_producao("/api/nfp/cupons/x/status", "PATCH") is False
    assert PERFIL_ADM_PRODUCAO == "ADM Produção NFP"
