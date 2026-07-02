from types import SimpleNamespace
import asyncio

from acomodacao_tb import (
    MAPA_SITUACAO_MODALIDADE,
    MODALIDADE_TB_CONFIRMADO,
    MODALIDADE_TB_SUSPEITA,
    aplicar_regras_acomodacao_tb,
    modalidade_eh_tb,
)


def test_modalidade_tb_mapeamento():
    assert MAPA_SITUACAO_MODALIDADE["Suspeita"] == MODALIDADE_TB_SUSPEITA
    assert MAPA_SITUACAO_MODALIDADE["Confirmado"] == MODALIDADE_TB_CONFIRMADO
    assert modalidade_eh_tb(MODALIDADE_TB_SUSPEITA)
    assert not modalidade_eh_tb("Fixo")


def test_encerrar_tb_realoca_para_leito_reservado():
    convivente = SimpleNamespace(
        tb_remanejamento_situacao="Suspeita",
        reservar_leito_fixo=True,
        leito_reservado_id="leito-fixo-1",
        leito_id="leito-tb-1",
    )
    dados = {"tb_remanejamento_situacao": None}

    asyncio.run(aplicar_regras_acomodacao_tb(
        None,
        dados=dados,
        convivente=convivente,
        instituicao_id="inst-1",
    ))

    assert dados["leito_id"] == "leito-fixo-1"
    assert dados["tb_remanejamento_situacao"] is None
    assert dados["reservar_leito_fixo"] is False
    assert dados["leito_reservado_id"] is None


def test_voltar_ao_leito_reservado_encerra_remanejamento_tb():
    convivente = SimpleNamespace(
        tb_remanejamento_situacao="Confirmado",
        reservar_leito_fixo=True,
        leito_reservado_id="leito-fixo-1",
        leito_id="leito-tb-1",
    )
    dados = {
        "tb_remanejamento_situacao": "Confirmado",
        "reservar_leito_fixo": True,
        "leito_id": "leito-fixo-1",
        "leito_reservado_id": "leito-fixo-1",
    }

    asyncio.run(aplicar_regras_acomodacao_tb(
        None,
        dados=dados,
        convivente=convivente,
        instituicao_id="inst-1",
        leito_id_antigo="leito-tb-1",
    ))

    assert dados["leito_id"] == "leito-fixo-1"
    assert dados["tb_remanejamento_situacao"] is None
    assert dados["reservar_leito_fixo"] is False
    assert dados["leito_reservado_id"] is None
