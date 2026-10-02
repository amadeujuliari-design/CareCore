"""Deteccao da tela de login NFP/GOV e gravacao local do CPF (sem a senha no status)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROBO = Path(__file__).resolve().parents[1] / "agente-nfp-robo" / "robo"
AGENTE = Path(__file__).resolve().parents[1] / "agente-nfp-robo"
sys.path.insert(0, str(ROBO))
sys.path.insert(0, str(AGENTE))

from login_gov import (  # noqa: E402
    digitos_cpf,
    gov_pediu_etapa_extra,
    gov_recusou_senha,
    pagina_pede_login,
)


def test_login_fazenda_pelo_botao_gov():
    assert pagina_pede_login(
        "https://www.nfp.fazenda.sp.gov.br/login.aspx",
        "Consumidor Pessoa Física Entrar com gov.br",
    )


def test_login_gov_cpf_e_senha():
    assert pagina_pede_login("https://sso.acesso.gov.br/login", "Digite seu CPF")
    assert pagina_pede_login(
        "https://sso.acesso.gov.br/login",
        "Digite sua senha atual",
    )


def test_tela_de_doacao_nao_e_login():
    assert not pagina_pede_login(
        "https://www.nfp.fazenda.sp.gov.br/Entidades/Cadastro.aspx",
        "Entidade - Cadastro de Notas Bem-vindo",
    )


def test_senha_comum_nao_e_etapa_extra():
    assert not gov_pediu_etapa_extra("Digite sua senha atual Entrar")
    assert gov_pediu_etapa_extra("Confirme o captcha para continuar")
    assert gov_pediu_etapa_extra("Verificação em duas etapas")


def test_senha_recusada():
    assert gov_recusou_senha("Usuário ou senha inválidos")
    assert not gov_recusou_senha("Digite sua senha atual")


def test_cpf_so_digitos():
    assert digitos_cpf("390.533.447-05") == "39053344705"
    assert digitos_cpf("") == ""


def test_item_para_sync_nao_leva_trecho_da_pagina():
    from agente_nfp import item_para_sync

    item = item_para_sync(
        {
            "chave": "1" * 44,
            "tipo": "sucesso",
            "status_carecore": "enviado",
            "mensagem": "ok",
            "trecho": "x" * 8000,
            "html": "<pagina>",
        }
    )
    assert "trecho" not in item
    assert "html" not in item
    assert item["chave"] == "1" * 44


def test_sincronizar_repete_quando_a_conexao_cai(monkeypatch):
    import agente_nfp
    from agente_nfp import sincronizar_resultados
    from carecore_api import CareCoreApiError

    monkeypatch.setattr(agente_nfp.time, "sleep", lambda _s: None)

    chamadas = {"n": 0}

    class Api:
        def aplicar_resultados(self, itens):
            chamadas["n"] += 1
            if chamadas["n"] < 3:
                raise CareCoreApiError(
                    "Falha de rede em /api/nfp/envio-sefaz/agente/aplicar-resultados: "
                    "WinError 10054"
                )
            return {"atualizados": len(itens)}

    sync = sincronizar_resultados(Api(), [{"chave": "1" * 44, "tipo": "sucesso", "mensagem": "ok"}])
    assert chamadas["n"] == 3
    assert sync["atualizados"] == 1


def test_salvar_gov_mantem_senha_se_vier_vazia(tmp_path: Path):
    from agente_nfp import salvar_gov

    caminho = tmp_path / "config.json"
    caminho.write_text(
        json.dumps({"email": "a@b.c", "senha": "care", "gov_cpf": "", "gov_senha": ""}),
        encoding="utf-8",
    )
    salvar_gov(cpf="390.533.447-05", senha="gov-teste", path=caminho)
    salvo = json.loads(caminho.read_text(encoding="utf-8"))
    assert salvo["gov_cpf"] == "39053344705"
    assert salvo["gov_senha"] == "gov-teste"
    assert salvo["email"] == "a@b.c"
    salvar_gov(cpf="390.533.447-05", senha="", path=caminho)
    de_novo = json.loads(caminho.read_text(encoding="utf-8"))
    assert de_novo["gov_senha"] == "gov-teste"
