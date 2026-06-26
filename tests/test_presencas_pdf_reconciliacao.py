from datetime import date, datetime

from presencas_pdf_reconciliacao import (
    calcular_data_inativacao_pdf,
    contar_presencas_pdf,
    dias_pdf_no_periodo,
    dias_protegidos_para_importacao,
    montar_atualizacao_fora_pdf,
    planejar_complemento_presenca_pdf,
    planejar_correcoes_ausencia_pdf,
)
from presencas_pdf_operacional_plan import planejar_movimentos_convivente


class _Pessoa:
    def __init__(self, dias):
        self.dias = dias


class _Conv:
    def __init__(self, status, data_inativacao=None):
        self.id = "conv-1"
        self.status = status
        self.data_inativacao = data_inativacao
        self.data_inclusao = date(2020, 1, 1)
        self.data_entrada = date(2020, 1, 1)
        self.ausencia_justificada_desde = None


def test_calcular_data_inativacao_pdf_ativo_no_25():
    assert calcular_data_inativacao_pdf(
        {24, 25},
        ano=2026,
        mes=6,
        dia_limite=25,
        presenca_dia_25=True,
    ) is None


def test_calcular_data_inativacao_pdf_apos_ultima_presenca():
    assert calcular_data_inativacao_pdf(
        {5, 6, 10},
        ano=2026,
        mes=6,
        dia_limite=25,
        presenca_dia_25=False,
    ) == date(2026, 6, 11)


def test_dias_protegidos_reconciliacao_nao_bloqueia_periodo_fechado():
    protegidos = dias_protegidos_para_importacao(
        reconciliar=True,
        hoje=date(2026, 6, 26),
        ontem=date(2026, 6, 25),
        ano=2026,
        mes=6,
        dia_limite=25,
    )
    assert protegidos == set()


def test_dias_protegidos_operacional_preserva_hoje_ontem_no_mes():
    protegidos = dias_protegidos_para_importacao(
        reconciliar=False,
        hoje=date(2026, 6, 23),
        ontem=date(2026, 6, 22),
        ano=2026,
        mes=6,
        dia_limite=25,
    )
    assert protegidos == {date(2026, 6, 23), date(2026, 6, 22)}


def test_dias_pdf_no_periodo_respeita_protegidos():
    dias = dias_pdf_no_periodo(
        {1, 2, 23},
        dia_limite=25,
        dias_protegidos={date(2026, 6, 23)},
        ano=2026,
        mes=6,
    )
    assert dias == {1, 2}


def test_contar_presencas_pdf():
    pessoas = [_Pessoa({1, 2}), _Pessoa({2, 3})]
    assert contar_presencas_pdf(pessoas, dia_limite=3) == 4


def test_montar_atualizacao_fora_pdf_inativa_ativo_sem_data():
    atualizacao = montar_atualizacao_fora_pdf(_Conv("Ativo", None))
    assert atualizacao["status"] == "Inativado"
    assert atualizacao["data_inativacao"] == date(2026, 5, 31)


def test_planejar_complemento_presenca_dia_25_apos_saida_no_24():
    from datetime import datetime

    movimentos_reais = [
        {
            "tipo_registro": "Entrada",
            "data_registro": datetime(2026, 6, 19, 8, 0),
        },
        {
            "tipo_registro": "Saída",
            "data_registro": datetime(2026, 6, 24, 20, 0),
        },
    ]
    complementos = planejar_complemento_presenca_pdf(
        convivente_id="conv-1",
        ano=2026,
        mes=6,
        dias_pdf={19, 20, 21, 22, 23, 24, 25},
        dia_limite=25,
        presenca_dia_25=True,
        movimentos_existentes=movimentos_reais,
        movimentos_plano=[],
        data_vinculacao=date(2026, 6, 1),
        data_inativacao=None,
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
        chaves_existentes=set(),
    )
    tipos_por_dia = {}
    for movimento in complementos:
        tipos_por_dia.setdefault(movimento.data_registro.day, []).append(movimento.tipo_registro)

    assert tipos_por_dia[25] == ["Entrada"]
    assert any(movimento.tipo_registro == "Entrada" for movimento in complementos)


def test_planejar_complemento_usa_movimentos_import_ja_gravados():
    """Lacuna no dia 25 após importação parcial deve fechar com Entrada."""
    movimentos_db = [
        {
            "tipo_registro": "Entrada",
            "data_registro": datetime(2026, 6, 22, 8, 0),
            "observacao": "IMPORTACAO_PDF_SIAT_JUN2026",
        },
        {
            "tipo_registro": "Saída",
            "data_registro": datetime(2026, 6, 24, 20, 0),
            "observacao": "IMPORTACAO_PDF_SIAT_JUN2026",
        },
    ]
    complementos = planejar_complemento_presenca_pdf(
        convivente_id="conv-1",
        ano=2026,
        mes=6,
        dias_pdf={22, 23, 24, 25},
        dia_limite=25,
        presenca_dia_25=True,
        movimentos_existentes=movimentos_db,
        movimentos_plano=[],
        data_vinculacao=date(2026, 6, 1),
        data_inativacao=None,
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
        chaves_existentes=set(),
    )
    entradas_25 = [
        movimento
        for movimento in complementos
        if movimento.tipo_registro == "Entrada" and movimento.data_registro.day == 25
    ]
    assert len(entradas_25) == 1


def test_planejar_correcoes_ausencia_pdf_remove_presente_fantasma():
    correcoes = planejar_correcoes_ausencia_pdf(
        convivente_id="conv-1",
        ano=2026,
        mes=6,
        dias_pdf={5},
        dia_limite=10,
        dias_protegidos=set(),
        movimentos_existentes=[],
        movimentos_plano=[],
        data_vinculacao=date(2026, 6, 1),
        data_inativacao=None,
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
        chaves_existentes=set(),
    )
    assert len(correcoes) >= 1
    assert all(item.tipo_registro == "Saída" for item in correcoes)
