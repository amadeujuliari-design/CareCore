from datetime import date, datetime
from dataclasses import dataclass

from presenca_operacional import STATUS_DIA_AUSENTE, STATUS_DIA_PRESENTE
from presencas_pdf_operacional_plan import (
    construir_blocos_consecutivos,
    decidir_dias_presentes_importar,
    definir_status_final,
    escolher_melhor_candidato_sisa,
    planejar_movimentos_convivente,
)


@dataclass
class _Conv:
    status: str
    data_nascimento: date | None
    data_entrada: date | None
    data_inclusao: date | None
    numero_sisa: str | None
    nome_mae: str | None
    numero_institucional: int | None


def test_desambigua_sisa_prioriza_ativo_e_cadastro_completo():
    ativo = _Conv("Ativo", date(1993, 7, 26), date(2026, 6, 1), None, "6199351", "MAE", 6273)
    inativo = _Conv("Inativado", None, None, None, "6199351", "MAE", 5797)
    escolhido, motivo = escolher_melhor_candidato_sisa([inativo, ativo])
    assert escolhido is ativo
    assert motivo == "sisa_exato_desambiguado"


def test_blocos_consecutivos():
    assert construir_blocos_consecutivos({1, 2, 3, 5, 8, 9}) == [(1, 3), (5, 5), (8, 9)]


def test_status_final_novo_com_presenca_25():
    status, aj = definir_status_final(presenca_dia_25=True, ausencia_justificada_pdf=True)
    assert status == "Ativo"
    assert aj is False


def test_status_final_novo_inativo_com_aj():
    status, aj = definir_status_final(presenca_dia_25=False, ausencia_justificada_pdf=True)
    assert status == "Ausência justificada"
    assert aj is True


def test_decidir_dias_prevalece_pdf_quando_carecore_ausente():
    dias = decidir_dias_presentes_importar(
        ano=2026,
        mes=6,
        dias_pdf={5, 6},
        dia_limite_importacao=10,
        dias_protegidos=set(),
        movimentos_reais=[],
        data_vinculacao=date(2026, 6, 1),
        data_inativacao=None,
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
    )
    assert dias == {5, 6}


def test_decidir_dias_mantem_carecore_com_fluxo_real():
    movimentos = [
        {
            "tipo_registro": "Entrada",
            "data_registro": datetime(2026, 6, 4, 8, 0),
        }
    ]
    dias = decidir_dias_presentes_importar(
        ano=2026,
        mes=6,
        dias_pdf={4, 5},
        dia_limite_importacao=10,
        dias_protegidos=set(),
        movimentos_reais=movimentos,
        data_vinculacao=date(2026, 6, 1),
        data_inativacao=None,
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
    )
    assert 4 not in dias
    assert 5 not in dias


def test_decidir_dias_nao_importa_dia_protegido():
    dias = decidir_dias_presentes_importar(
        ano=2026,
        mes=6,
        dias_pdf={23},
        dia_limite_importacao=25,
        dias_protegidos={date(2026, 6, 23)},
        movimentos_reais=[],
        data_vinculacao=date(2026, 6, 1),
        data_inativacao=None,
        status_convivente="Ativo",
        ausencia_justificada_desde=None,
    )
    assert dias == set()


def test_planejar_movimentos_mantem_dentro_no_25():
    movimentos = planejar_movimentos_convivente(
        convivente_id="conv-1",
        ano=2026,
        mes=6,
        dias_importar={24, 25},
        dia_limite_importacao=25,
        presenca_dia_25=True,
        respeitar_dentro_no_25=True,
        chaves_existentes=set(),
    )
    tipos = [item.tipo_registro for item in movimentos]
    assert tipos[-1] == "Entrada"
    assert movimentos[-1].data_registro == datetime(2026, 6, 24, 8, 0)
    assert all(item.tipo_registro != "Saída" or item.data_registro.month == 5 for item in movimentos)


def test_planejar_movimentos_saida_pre_periodo():
    movimentos = planejar_movimentos_convivente(
        convivente_id="conv-1",
        ano=2026,
        mes=6,
        dias_importar={5, 6},
        dia_limite_importacao=25,
        presenca_dia_25=False,
        respeitar_dentro_no_25=False,
        chaves_existentes=set(),
    )
    assert movimentos[0].tipo_registro == "Saída"
    assert movimentos[0].data_registro == datetime(2026, 5, 31, 20, 0)
