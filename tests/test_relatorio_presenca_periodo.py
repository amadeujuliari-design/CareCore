from datetime import date, datetime

from presenca_operacional import (
    STATUS_DIA_AUSENTE,
    STATUS_DIA_JUSTIFICADO,
    STATUS_DIA_NA,
    STATUS_DIA_PRESENTE,
    linha_atende_filtro_situacao_periodo,
    linha_tem_dia_elegivel_no_periodo,
    montar_status_presenca_por_dia,
    normalizar_filtro_situacao_presenca,
    totais_status_presenca,
)


def _mov(tipo: str, dia: int, hora: int = 10) -> dict:
    return {
        "tipo_registro": tipo,
        "data_registro": datetime(2026, 6, dia, hora, 0),
    }


def test_matriz_presenca_com_entrada_no_dia():
    status = montar_status_presenca_por_dia(
        [_mov("Entrada", 10)],
        date(2026, 6, 10),
        date(2026, 6, 12),
        data_entrada=date(2026, 6, 1),
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
    )
    assert status["2026-06-10"] == STATUS_DIA_PRESENTE
    assert status["2026-06-11"] == STATUS_DIA_PRESENTE
    assert status["2026-06-12"] == STATUS_DIA_PRESENTE


def test_matriz_ausencia_apos_saida():
    status = montar_status_presenca_por_dia(
        [_mov("Entrada", 8, 8), _mov("Saída", 8, 18)],
        date(2026, 6, 8),
        date(2026, 6, 10),
        data_entrada=date(2026, 6, 1),
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
    )
    assert status["2026-06-08"] == STATUS_DIA_PRESENTE
    assert status["2026-06-09"] == STATUS_DIA_AUSENTE
    assert status["2026-06-10"] == STATUS_DIA_AUSENTE


def test_aj_nao_cobre_dia_com_presenca_operacional():
    from datetime import datetime

    status = montar_status_presenca_por_dia(
        [
            {"tipo_registro": "Entrada", "data_registro": datetime(2026, 6, 10, 8, 0)},
            {"tipo_registro": "Saída", "data_registro": datetime(2026, 6, 10, 20, 0)},
        ],
        date(2026, 6, 1),
        date(2026, 6, 12),
        data_entrada=date(2026, 6, 1),
        status_convivente="Ausência justificada",
        ausencia_justificada_desde=None,
    )
    assert status["2026-06-10"] == STATUS_DIA_PRESENTE
    assert status["2026-06-11"] == STATUS_DIA_JUSTIFICADO


def test_matriz_justificada_conta_como_presenca_no_total():
    status = montar_status_presenca_por_dia(
        [],
        date(2026, 6, 5),
        date(2026, 6, 7),
        data_entrada=date(2026, 6, 1),
        status_convivente="Ausência justificada",
        ausencia_justificada_desde=date(2026, 6, 5),
    )
    totais = totais_status_presenca(status)
    assert status["2026-06-05"] == STATUS_DIA_JUSTIFICADO
    assert totais["presentes"] == 3
    assert totais["justificados"] == 3
    assert totais["ausentes"] == 0


def test_matriz_dias_apos_inativacao_sao_na():
    status = montar_status_presenca_por_dia(
        [_mov("Entrada", 10, 8), _mov("Saída", 10, 18)],
        date(2026, 6, 10),
        date(2026, 6, 13),
        data_entrada=date(2026, 6, 1),
        data_inativacao=date(2026, 6, 11),
        status_convivente="Inativado",
        ausencia_justificada_desde=None,
    )
    assert status["2026-06-10"] == STATUS_DIA_PRESENTE
    assert status["2026-06-11"] == STATUS_DIA_NA
    assert status["2026-06-12"] == STATUS_DIA_NA
    assert status["2026-06-13"] == STATUS_DIA_NA


def test_ativo_com_data_inativacao_residual_nao_corta_presenca():
    """Cadastro Ativo com data_inativacao residual (bug legado) não gera NA."""
    status = montar_status_presenca_por_dia(
        [_mov("Entrada", 10, 8), _mov("Saída", 10, 18)],
        date(2026, 6, 10),
        date(2026, 6, 13),
        data_entrada=date(2026, 6, 1),
        data_inativacao=date(2026, 6, 11),
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
    )
    assert status["2026-06-10"] == STATUS_DIA_PRESENTE
    assert status["2026-06-11"] == STATUS_DIA_AUSENTE
    assert status["2026-06-12"] == STATUS_DIA_AUSENTE
    assert status["2026-06-13"] == STATUS_DIA_AUSENTE
    assert STATUS_DIA_NA not in status.values()


def test_inativado_sem_data_inativacao_nao_ganha_presenca():
    status = montar_status_presenca_por_dia(
        [],
        date(2026, 6, 1),
        date(2026, 6, 5),
        data_entrada=date(2026, 6, 1),
        status_convivente="Inativado",
        ausencia_justificada_desde=None,
    )
    assert all(valor == STATUS_DIA_NA for valor in status.values())


def test_inativado_antes_do_periodo_todo_na():
    status = montar_status_presenca_por_dia(
        [],
        date(2026, 6, 1),
        date(2026, 6, 5),
        data_entrada=date(2025, 1, 1),
        data_inativacao=date(2026, 5, 31),
        status_convivente="Inativado",
        ausencia_justificada_desde=None,
    )
    assert all(valor == STATUS_DIA_NA for valor in status.values())


def test_inativado_no_periodo_ainda_aparece_com_presenca():
    status = montar_status_presenca_por_dia(
        [_mov("Entrada", 5)],
        date(2026, 6, 1),
        date(2026, 6, 30),
        data_entrada=date(2026, 6, 1),
        data_inativacao=date(2026, 6, 20),
        status_convivente="Inativado",
        ausencia_justificada_desde=None,
    )
    totais = totais_status_presenca(status)
    assert totais["presentes_operacionais"] >= 1
    assert linha_atende_filtro_situacao_periodo(
        totais,
        "presenca_ou_justificada",
        total_dias=30,
    )


def test_filtro_situacao_presenca_ou_justificada():
    assert linha_atende_filtro_situacao_periodo(
        {"presentes_operacionais": 1, "justificados": 0, "ausentes": 0, "na": 0},
        "presenca_ou_justificada",
        total_dias=5,
    )
    assert linha_atende_filtro_situacao_periodo(
        {"presentes_operacionais": 0, "justificados": 2, "ausentes": 0, "na": 0},
        "presenca_ou_justificada",
        total_dias=5,
    )
    assert not linha_atende_filtro_situacao_periodo(
        {"presentes_operacionais": 0, "justificados": 0, "ausentes": 3, "na": 0},
        "presenca_ou_justificada",
        total_dias=5,
    )


def test_filtro_situacao_apenas_ausencia():
    assert linha_atende_filtro_situacao_periodo(
        {"presentes_operacionais": 0, "justificados": 0, "ausentes": 1, "na": 0},
        "apenas_ausencia",
        total_dias=5,
    )
    assert not linha_atende_filtro_situacao_periodo(
        {"presentes_operacionais": 2, "justificados": 0, "ausentes": 0, "na": 0},
        "apenas_ausencia",
        total_dias=5,
    )


def test_linha_so_na_nao_atende_filtro():
    totais = {"presentes_operacionais": 0, "justificados": 0, "ausentes": 0, "na": 10}
    assert not linha_tem_dia_elegivel_no_periodo(totais, 10)
    assert not linha_atende_filtro_situacao_periodo(
        totais,
        "apenas_ausencia",
        total_dias=10,
    )


def test_normalizar_filtro_situacao_aliases():
    assert normalizar_filtro_situacao_presenca("presentes_no_periodo") == "presenca_ou_justificada"
    assert normalizar_filtro_situacao_presenca("ausentes_no_periodo") == "apenas_ausencia"


def test_schema_aceita_prontuario_como_texto():
    from schemas import RelatorioPresencaPeriodoResponse

    payload = RelatorioPresencaPeriodoResponse.model_validate({
        "data_inicio": "2026-06-01",
        "data_fim": "2026-06-25",
        "filtro_situacao": "presenca_ou_justificada",
        "status_filtro": [],
        "dias": ["2026-06-01"],
        "total_conviventes": 1,
        "resumo": {"presentes": 1, "ausentes": 0},
        "linhas": [{
            "convivente_id": "abc",
            "nome": "Test",
            "prontuario": "123",
            "status": "Inativado",
            "dias": {"2026-06-01": "presente"},
            "totais": {"presentes": 1, "ausentes": 0},
        }],
    })
    assert payload.linhas[0].prontuario == "123"
    assert payload.filtro_situacao == "presenca_ou_justificada"
    assert payload.status_filtro == []
