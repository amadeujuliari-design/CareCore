from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

MODULO = Path(__file__).resolve().parents[1] / "agente-nfp-robo" / "robo" / "contador_estado.py"


def _carregar():
    spec = spec_from_file_location("contador_estado_nfp", MODULO)
    modulo = module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(modulo)
    return modulo


def test_resumo_exibicao_agrupa_envios_da_sessao():
    modulo = _carregar()
    estado = {
        "ativo": True,
        "mensagem": "Ultimo: sucesso",
        "atualizado_em": "2026-08-17 09:10:00",
        "total": 5,
        "por_tipo": {
            "sucesso": 2,
            "ja_existe": 1,
            "erro": 0,
            "inconclusivo": 1,
            "sessao_caiu": 0,
            "bloqueio_sefaz": 1,
        },
        "por_status": {
            "enviado": 3,
            "rejeitado_prazo": 1,
            "erro": 0,
            "pendente": 1,
        },
        "ultimo": {"tipo": "sucesso", "chave": "3526", "mensagem": "ok"},
    }
    resumo = modulo.resumo_exibicao(estado)
    assert resumo["enviados"] == 3
    assert resumo["novos"] == 2
    assert resumo["ja_existe"] == 1
    assert resumo["prazo"] == 1
    assert resumo["erros"] == 1
    assert resumo["inconclusivo"] == 1
    assert resumo["total"] == 5
    assert resumo["ativo"] is True


def test_resumo_exibicao_vazio_nao_quebra():
    modulo = _carregar()
    resumo = modulo.resumo_exibicao({})
    assert resumo["enviados"] == 0
    assert resumo["total"] == 0
    assert resumo["ativo"] is False
