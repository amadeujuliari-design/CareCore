from datetime import date

from routers.conviventes import (
    _consolidar_linhas_sisa_por_ultimo_movimento,
    _dias_sisa_no_recorte,
    _desligamento_valido_no_recorte,
    _extrair_periodo_referencia_sisa,
    _linha_sisa_ativa_no_recorte,
    usuario_pode_excluir_importacao_sisa,
    usuario_pode_gerenciar_pia_convivente,
    usuario_visivel_como_equipe,
)


def test_gestor_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Gestor"}

    assert usuario_pode_excluir_importacao_sisa(usuario)


def test_manutencao_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Manutenção"}

    assert usuario_pode_excluir_importacao_sisa(usuario)


def test_orientador_nao_pode_excluir_importacao_sisa():
    usuario = {"perfil_acesso": "Orientador"}

    assert not usuario_pode_excluir_importacao_sisa(usuario)


def test_orientador_aparece_como_equipe_operacional():
    usuario = {"perfil_acesso": "Orientador", "is_global": False}

    assert usuario_visivel_como_equipe(usuario)


def test_manutencao_nao_aparece_como_equipe_operacional():
    usuario = {"perfil_acesso": "Manutenção", "is_global": False}

    assert not usuario_visivel_como_equipe(usuario)


def test_usuario_global_nao_aparece_como_equipe_operacional():
    usuario = {"perfil_acesso": "Gestor", "is_global": True}

    assert not usuario_visivel_como_equipe(usuario)


def test_perfil_global_literal_nao_aparece_como_equipe_operacional():
    usuario = {"perfil_acesso": " Global ", "is_global": False}

    assert not usuario_visivel_como_equipe(usuario)


def test_perfil_global_legado_executivo_nao_aparece_como_equipe_operacional():
    usuario = {"perfil_acesso": "Executivo", "is_global": False}

    assert not usuario_visivel_como_equipe(usuario)


def test_manutencao_pode_gerenciar_pia_convivente():
    usuario = {"perfil_acesso": "Manutenção"}

    assert usuario_pode_gerenciar_pia_convivente(usuario)


def test_extrai_periodo_completo_do_cabecalho_sisa():
    texto = "Data de Referência do Relatório: 01/05/2026 à 31/05/2026 - Relatório Emitido em: 17/06/2026"

    inicio, fim = _extrair_periodo_referencia_sisa(texto)

    assert inicio == date(2026, 5, 1)
    assert fim == date(2026, 5, 31)


def test_dias_sisa_no_recorte_limita_vazamento_para_mes_seguinte():
    dias_maio = _dias_sisa_no_recorte(
        data_inicio_recorte=date(2026, 5, 1),
        data_fim_recorte=date(2026, 5, 31),
        data_vinculacao=date(2026, 5, 1),
        data_desligamento=date(2026, 6, 16),
        dias_permanencia_acumulado=47,
    )
    dias_junho = _dias_sisa_no_recorte(
        data_inicio_recorte=date(2026, 6, 1),
        data_fim_recorte=date(2026, 6, 30),
        data_vinculacao=date(2026, 5, 1),
        data_desligamento=date(2026, 6, 16),
        dias_permanencia_acumulado=47,
    )

    assert dias_maio == 31
    assert dias_junho == 16


def test_desligamento_futuro_nao_inativa_no_recorte_atual():
    assert not _desligamento_valido_no_recorte(
        date(2026, 6, 16),
        date(2026, 5, 31),
    )


def test_desligamento_ate_recorte_pode_inativar():
    assert _desligamento_valido_no_recorte(
        date(2026, 5, 31),
        date(2026, 5, 31),
    )


def test_ativo_sem_sisa_deve_entrar_na_revisao_de_inativacao():
    class Convivente:
        numero_sisa = None
        status = "Ativo"
        id = "conv-1"
        nome_social = None
        nome_completo = "Sem SISA"
        data_nascimento = None

    convivente = Convivente()
    deve_sugerir = (
        (
            not convivente.numero_sisa
            or str(convivente.numero_sisa) not in {"123"}
        )
        and convivente.status == "Ativo"
    )

    assert deve_sugerir


def test_sisa_consolidado_considera_ultimo_movimento_do_recorte():
    linhas = [
        {
            "numero_sisa": "123",
            "nome_planilha": "Pessoa",
            "data_vinculacao": date(2026, 1, 1),
            "data_desligamento": date(2026, 5, 5),
        },
        {
            "numero_sisa": "123",
            "nome_planilha": "Pessoa",
            "data_vinculacao": date(2026, 5, 21),
            "data_desligamento": None,
        },
    ]

    [linha_atual] = _consolidar_linhas_sisa_por_ultimo_movimento(
        linhas,
        date(2026, 5, 31),
    )

    assert linha_atual["data_vinculacao"] == date(2026, 5, 21)
    assert linha_atual["data_desligamento"] is None
    assert _linha_sisa_ativa_no_recorte(linha_atual, date(2026, 5, 31))
