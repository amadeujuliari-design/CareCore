from datetime import date, datetime

from presenca_operacional import (
    calcular_dias_presenca_operacional,
    convivente_ausente_saida_ontem_sem_retorno,
    convivente_dentro_por_ultimo_fluxo,
    convivente_presente_no_dia,
    sem_interacao_rotina_24h,
)


def _mov(tipo: str, dia: int, hora: int = 10, mes: int = 6) -> dict:
    return {
        "tipo_registro": tipo,
        "data_registro": datetime(2026, mes, dia, hora, 0),
    }


def test_sem_movimentos_assume_dentro_se_ja_estava_no_projeto():
    dias = calcular_dias_presenca_operacional(
        [],
        date(2026, 6, 1),
        date(2026, 6, 5),
        date(2026, 5, 1),
    )
    assert dias == [
        "2026-06-01",
        "2026-06-02",
        "2026-06-03",
        "2026-06-04",
        "2026-06-05",
    ]


def test_sem_movimentos_antes_da_data_entrada_nao_conta_presenca():
    dias = calcular_dias_presenca_operacional(
        [],
        date(2026, 6, 1),
        date(2026, 6, 5),
        date(2026, 6, 3),
    )
    assert dias == ["2026-06-03", "2026-06-04", "2026-06-05"]


def test_entrada_no_meio_do_periodo_conta_a_partir_da_admissao():
    dias = calcular_dias_presenca_operacional(
        [_mov("Entrada", 3)],
        date(2026, 6, 1),
        date(2026, 6, 5),
        date(2026, 6, 3),
    )
    assert dias == ["2026-06-03", "2026-06-04", "2026-06-05"]


def test_saida_ontem_sem_retorno_hoje():
    movimentos = [
        _mov("Saída", 23, 20),
    ]
    assert convivente_ausente_saida_ontem_sem_retorno(movimentos, date(2026, 6, 24)) is True


def test_saida_ontem_com_retorno_hoje_nao_e_ausente():
    movimentos = [
        _mov("Saída", 23, 20),
        _mov("Entrada", 24, 8),
    ]
    assert convivente_ausente_saida_ontem_sem_retorno(movimentos, date(2026, 6, 24)) is False


def test_ausencia_justificada_conta_como_presente():
    assert convivente_presente_no_dia(
        [],
        date(2026, 6, 10),
        data_entrada=date(2026, 6, 1),
        ausencia_justificada=True,
    ) is True


def test_dentro_por_ultimo_fluxo():
    assert convivente_dentro_por_ultimo_fluxo({"tipo_registro": "Entrada"}) is True
    assert convivente_dentro_por_ultimo_fluxo({"tipo_registro": "Saída"}) is False
    assert convivente_dentro_por_ultimo_fluxo(None) is True


def test_sem_interacao_24h():
    agora = datetime(2026, 6, 24, 12, 0)
    assert sem_interacao_rotina_24h(None, agora) is True
    assert sem_interacao_rotina_24h(datetime(2026, 6, 24, 11, 30), agora) is False
    assert sem_interacao_rotina_24h(datetime(2026, 6, 23, 11, 0), agora) is True
