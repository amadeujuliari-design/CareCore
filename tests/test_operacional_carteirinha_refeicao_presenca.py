from datetime import date, datetime, timedelta

import pytest
from fastapi import HTTPException

from carteirinha_operacional import avaliar_carteirinha_provisoria
from refeicao_horario_operacional import validar_horario_refeicao_operacional
from presenca_operacional import montar_status_presenca_por_dia, STATUS_DIA_NA


def test_presenca_respeita_primeira_vinculacao_passada_como_data_entrada():
    """Callers passam coalesce(data_inclusao, data_entrada) no parâmetro data_entrada."""
    status = montar_status_presenca_por_dia(
        [],
        date(2026, 6, 10),
        date(2026, 6, 12),
        data_entrada=date(2026, 6, 15),
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
    )
    assert status["2026-06-10"] == STATUS_DIA_NA
    assert status["2026-06-11"] == STATUS_DIA_NA
    assert status["2026-06-12"] == STATUS_DIA_NA


def test_carteirinha_provisoria_bloqueia_apos_7_dias():
    inicio = datetime(2026, 6, 1, 10, 0)
    status = avaliar_carteirinha_provisoria(
        inicio,
        quarto_rotativo=True,
        agora=inicio + timedelta(days=7, hours=1),
    )
    assert status["provisoria"] is True
    assert status["bloqueada"] is True


def test_carteirinha_provisoria_conta_5_dias_de_aviso_desde_alocacao():
    inicio = datetime(2026, 6, 1, 10, 0)
    status = avaliar_carteirinha_provisoria(
        inicio,
        quarto_rotativo=True,
        agora=inicio,
    )
    assert status["em_aviso"] is True
    assert status["em_tolerancia"] is False
    assert status["bloqueada"] is False
    assert "5 dia(s)" in status["restante_texto"]


def test_carteirinha_provisoria_tolerancia_apos_5_dias():
    inicio = datetime(2026, 6, 1, 10, 0)
    status = avaliar_carteirinha_provisoria(
        inicio,
        quarto_rotativo=True,
        agora=inicio + timedelta(days=5, hours=2),
    )
    assert status["em_aviso"] is False
    assert status["em_tolerancia"] is True
    assert status["bloqueada"] is False
    assert "bloqueio" in status["restante_texto"]


from routers.conviventes import _repeticao_extra_refeicao_ao_registrar


def test_repeticao_extra_refeicao_rotulos():
    assert _repeticao_extra_refeicao_ao_registrar(0) is None
    assert _repeticao_extra_refeicao_ao_registrar(1) == 1
    assert _repeticao_extra_refeicao_ao_registrar(2) == 2


def test_horario_refeicao_dentro_da_janela():
    validar_horario_refeicao_operacional(
        "Almoço",
        datetime(2026, 6, 10, 12, 30),
    )


def test_horario_refeicao_fora_da_janela():
    with pytest.raises(HTTPException) as exc:
        validar_horario_refeicao_operacional(
            "Café da manhã",
            datetime(2026, 6, 10, 9, 0),
        )
    assert exc.value.status_code == 400
