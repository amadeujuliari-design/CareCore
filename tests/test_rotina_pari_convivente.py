"""Separação da observação operacional do Reencontro Pari."""

from rotina_pari_convivente import separar_observacao_operacional


def test_seg_sex_marca_segunda_a_sexta_e_tira_o_texto():
    resultado = separar_observacao_operacional(
        "Ocupação: SERVENTE DE PEDREIRO | Escala: SEG-SEX | "
        "Parcerias: Cozinha escola; Educação financeira | Horário escolar: CONCLUÍDO"
    )
    assert resultado["ocupacao_trabalho"] == "SERVENTE DE PEDREIRO"
    assert resultado["escala_trabalho"] == "seg-sex"
    assert resultado["dias_trabalho"] == "seg,ter,qua,qui,sex"
    assert resultado["parcerias"] == "Cozinha escola; Educação financeira"
    assert resultado["etapa_escolar"] == "concluido"
    assert resultado["observacao_restante"] == ""


def test_seis_por_um_nao_inventa_dias():
    resultado = separar_observacao_operacional(
        "Empresa: MACDONALDS | Cargo: ATENDENTE | Escala: 6x1"
    )
    assert resultado["ocupacao_trabalho"] == "ATENDENTE · MACDONALDS"
    assert resultado["escala_trabalho"] == "6x1"
    assert resultado["dias_trabalho"] == ""


def test_horario_escolar_com_turno_e_horas():
    resultado = separar_observacao_operacional(
        "Horário escolar: TARDE ( 12:00 AS 18:00)"
    )
    assert resultado["turno_escolar"] == "tarde"
    assert resultado["escolar_inicio"] == "12:00"
    assert resultado["escolar_fim"] == "18:00"
    assert resultado["etapa_escolar"] == ""


def test_aviso_operacional_permanece():
    resultado = separar_observacao_operacional(
        "Ocupação: DIARISTA | Escala: SEGUNDA E QUINTA | Só no relatório de saída"
    )
    assert resultado["ocupacao_trabalho"] == "DIARISTA"
    assert resultado["escala_trabalho"] == "dias"
    assert resultado["dias_trabalho"] == "seg,qui"
    assert resultado["observacao_restante"] == "Só no relatório de saída"


def test_ocupacao_nao_sai_do_texto():
    resultado = separar_observacao_operacional(
        "Não está na lista de refeição | Ocupação: NENHUMA"
    )
    assert resultado["ocupacao_trabalho"] == ""
    assert resultado["observacao_restante"] == "Não está na lista de refeição"
    assert resultado["consumiu"] is True


def test_texto_sem_rotina_nao_e_consumido():
    resultado = separar_observacao_operacional("Não está na lista de refeição")
    assert resultado["ocupacao_trabalho"] == ""
    assert resultado["observacao_restante"] == "Não está na lista de refeição"
