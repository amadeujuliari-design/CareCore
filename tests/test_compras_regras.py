from datetime import date

import pytest

from compras_regras import (
    aviso_cotacoes_insuficientes,
    detectar_semana_util,
    dias_liberados_janela,
    economia_centavos,
    janela_consumo_aberta,
    normalizar_competencia,
    normalizar_escopo_unidade,
    pedido_escopo_sede,
    pedido_pronto_para_aprovacao_unidade,
    pedido_rascunho_pode_excluir,
    periodo_semana_util_mes,
    rotulo_sede_relatorio,
    rotulo_unidade_relatorio,
    sugerir_segunda_semana_util,
    usuario_e_sede_compras,
    usuario_pode_aprovar_sede,
    usuario_pode_aprovar_unidade,
    usuario_pode_pedir,
    usuario_ve_modulo_compras,
)


def test_competencia_valida():
    assert normalizar_competencia("2026-08") == "2026-08"
    with pytest.raises(ValueError):
        normalizar_competencia("2026/08")


def test_janela_consumo():
    assert janela_consumo_aberta(
        hoje=date(2026, 8, 12),
        data_inicio=date(2026, 8, 10),
        data_fim=date(2026, 8, 14),
    )
    assert not janela_consumo_aberta(
        hoje=date(2026, 8, 9),
        data_inicio=date(2026, 8, 10),
        data_fim=date(2026, 8, 14),
    )
    assert janela_consumo_aberta(
        hoje=date(2026, 8, 1),
        data_inicio=date(2026, 8, 10),
        data_fim=date(2026, 8, 14),
        liberacao_projeto=True,
    )


def test_sugestao_agosto_2026():
    inicio, fim = sugerir_segunda_semana_util(2026, 8)
    assert inicio == date(2026, 8, 10)
    assert fim == date(2026, 8, 14)


def test_sugestao_setembro_2026():
    inicio, fim = sugerir_segunda_semana_util(2026, 9)
    assert inicio == date(2026, 9, 14)
    assert fim == date(2026, 9, 18)


def test_periodo_semana_util_agosto_2026():
    inicio, fim = periodo_semana_util_mes(2026, 8, 2)
    assert inicio == date(2026, 8, 10)
    assert fim == date(2026, 8, 14)


def test_periodo_semana_util_setembro_2026_terceira():
    inicio, fim = periodo_semana_util_mes(2026, 9, 3)
    assert inicio == date(2026, 9, 15)
    assert fim == date(2026, 9, 21)


def test_dias_liberados_excluem_fim_de_semana():
    dias = dias_liberados_janela(date(2026, 9, 8), date(2026, 9, 14))
    assert date(2026, 9, 12) not in dias
    assert date(2026, 9, 13) not in dias
    assert date(2026, 9, 14) in dias


def test_detectar_semana_util():
    assert detectar_semana_util("2026-08", date(2026, 8, 10), date(2026, 8, 14)) == 2
    assert detectar_semana_util("2026-09", date(2026, 9, 14), date(2026, 9, 18)) is None


def test_rascunho_rejeita_fim_de_semana():
    from compras_regras import pode_criar_rascunho_consumo

    ok, msg = pode_criar_rascunho_consumo(
        hoje=date(2026, 9, 11),
        data_inicio=date(2026, 9, 8),
        data_fim=date(2026, 9, 14),
        data_prevista=date(2026, 9, 12),
    )
    assert not ok
    assert "dia útil" in msg


def test_calendario_institucional_2026():
    from compras_regras import sugerir_janela_competencia

    assert sugerir_janela_competencia(2026, 3) == (date(2026, 3, 16), date(2026, 3, 20))
    assert sugerir_janela_competencia(2026, 12) == (date(2026, 12, 7), date(2026, 12, 11))
    assert sugerir_janela_competencia(2026, 8) == (date(2026, 8, 10), date(2026, 8, 14))


def test_rascunho_antes_da_janela_e_envio_no_dia():
    from compras_regras import pode_criar_rascunho_consumo, pode_enviar_consumo

    inicio, fim = date(2026, 8, 24), date(2026, 8, 28)
    ok, _ = pode_criar_rascunho_consumo(
        hoje=date(2026, 8, 17),
        data_inicio=inicio,
        data_fim=fim,
        data_prevista=date(2026, 8, 24),
    )
    assert ok
    ok_envio, msg = pode_enviar_consumo(
        hoje=date(2026, 8, 17),
        data_inicio=inicio,
        data_fim=fim,
        data_prevista=date(2026, 8, 24),
    )
    assert not ok_envio
    assert "abre" in msg.lower()
    ok_dia, _ = pode_enviar_consumo(
        hoje=date(2026, 8, 24),
        data_inicio=inicio,
        data_fim=fim,
        data_prevista=date(2026, 8, 24),
    )
    assert ok_dia
    ok_antes_previsto, _ = pode_enviar_consumo(
        hoje=date(2026, 8, 24),
        data_inicio=inicio,
        data_fim=fim,
        data_prevista=date(2026, 8, 26),
    )
    assert not ok_antes_previsto


def test_periodo_janela_nao_inverte_nem_muda_de_mes():
    from compras_regras import validar_periodo_janela

    validar_periodo_janela(
        competencia="2026-09",
        data_inicio=date(2026, 9, 14),
        data_fim=date(2026, 9, 18),
    )
    with pytest.raises(ValueError, match="anterior"):
        validar_periodo_janela(
            competencia="2026-09",
            data_inicio=date(2026, 8, 24),
            data_fim=date(2026, 8, 21),
        )
    with pytest.raises(ValueError, match="mês da competência"):
        validar_periodo_janela(
            competencia="2026-09",
            data_inicio=date(2026, 8, 24),
            data_fim=date(2026, 8, 28),
        )


def test_rbac_visibilidade():
    assert usuario_ve_modulo_compras(perfil="ADM Global Compras", compras_modulo_ativo=False, org_compras_ativo=False)
    assert usuario_ve_modulo_compras(perfil="ADM Compras", compras_modulo_ativo=False, org_compras_ativo=False)
    assert usuario_e_sede_compras(perfil="ADM Global Compras")
    assert usuario_e_sede_compras(perfil="ADM Compras")
    assert usuario_pode_aprovar_sede(perfil="ADM Global Compras")
    assert not usuario_e_sede_compras(perfil="ADM Pedidos")
    assert not usuario_ve_modulo_compras(perfil="ADM Pedidos", compras_modulo_ativo=False, org_compras_ativo=False)
    assert usuario_ve_modulo_compras(perfil="ADM Pedidos", compras_modulo_ativo=False, org_compras_ativo=True)
    assert usuario_ve_modulo_compras(perfil="Gestor", compras_modulo_ativo=True)
    assert not usuario_ve_modulo_compras(perfil="Gestor", compras_modulo_ativo=False)
    assert not usuario_ve_modulo_compras(perfil="Orientador", compras_modulo_ativo=True)
    assert not usuario_ve_modulo_compras(perfil="Consulta", compras_modulo_ativo=True)
    assert usuario_ve_modulo_compras(perfil="Gestor", compras_modulo_ativo=False, is_manutencao=True)


def test_pedir_e_aprovar():
    assert usuario_pode_pedir(perfil="ADM Pedidos", compras_modulo_ativo=False)
    assert usuario_pode_aprovar_unidade(perfil="Técnico", compras_modulo_ativo=True)
    assert not usuario_pode_aprovar_unidade(perfil="Técnico", compras_modulo_ativo=False)
    assert usuario_pode_aprovar_sede(perfil="ADM Global Compras")
    assert not usuario_pode_aprovar_sede(perfil="ADM Pedidos")
    assert not usuario_pode_aprovar_sede(perfil="Gestor", is_manutencao=False)


def test_tres_cotacoes_imobilizado():
    assert pedido_pronto_para_aprovacao_unidade("imobilizado", 2, True)
    assert pedido_pronto_para_aprovacao_unidade("imobilizado", 3, True)
    assert not pedido_pronto_para_aprovacao_unidade("imobilizado", 1, False)
    assert pedido_pronto_para_aprovacao_unidade("manutencao", 1, True)
    assert pedido_pronto_para_aprovacao_unidade("servico", 2, True)


def test_tipos_cotacao_projeto():
    from compras_regras import exige_tres_cotacoes, rotulo_tipo_pedido, tipo_eh_cotacao_projeto

    assert tipo_eh_cotacao_projeto("imobilizado")
    assert tipo_eh_cotacao_projeto("manutencao")
    assert tipo_eh_cotacao_projeto("servico")
    assert not tipo_eh_cotacao_projeto("consumo")
    assert exige_tres_cotacoes("servico")
    assert rotulo_tipo_pedido("manutencao") == "Manutenção"
    assert pedido_pronto_para_aprovacao_unidade("consumo", 1, True)
    assert not pedido_pronto_para_aprovacao_unidade("consumo", 1, False)
    assert aviso_cotacoes_insuficientes(2)


def test_economia():
    eco = economia_centavos([1000, 800, 900], 800)
    assert eco["economia_vs_maior_centavos"] == 200
    assert eco["economia_vs_media_centavos"] == 100


def test_escopo_sede_e_rotulo():
    assert pedido_escopo_sede("sede")
    assert not pedido_escopo_sede("projeto")
    assert normalizar_escopo_unidade("sede") == "sede"
    assert rotulo_sede_relatorio("AEB") == "Sede – AEB"
    assert rotulo_unidade_relatorio(
        escopo_unidade="sede",
        instituicao_nome=None,
        organizacao_nome="AEB",
    ) == "Sede – AEB"
    assert rotulo_unidade_relatorio(
        escopo_unidade="projeto",
        instituicao_nome="SIAT II Armênia",
        organizacao_nome="AEB",
    ) == "SIAT II Armênia"


def test_rascunho_so_exclui_sem_tramitacao():
    assert pedido_rascunho_pode_excluir(
        status="rascunho", qtd_cotacoes=0, qtd_anexos=0, qtd_eventos=0, qtd_notas=0,
    )
    assert not pedido_rascunho_pode_excluir(
        status="rascunho", qtd_cotacoes=1, qtd_anexos=0, qtd_eventos=0, qtd_notas=0,
    )
    assert not pedido_rascunho_pode_excluir(
        status="aguardando_cotacao", qtd_cotacoes=0, qtd_anexos=0, qtd_eventos=0, qtd_notas=0,
    )


def test_pedido_itens_editaveis_ate_envio_fornecedor():
    from compras_regras import pedido_itens_podem_editar

    assert pedido_itens_podem_editar("rascunho")
    assert pedido_itens_podem_editar("aguardando_cotacao")
    assert pedido_itens_podem_editar("em_cotacao")
    assert pedido_itens_podem_editar("aguardando_aprovacao_unidade")
    assert pedido_itens_podem_editar("aguardando_aprovacao_sede")
    assert pedido_itens_podem_editar("aprovado")
    assert not pedido_itens_podem_editar("enviado_fornecedor")
    assert not pedido_itens_podem_editar("recebido")
    assert not pedido_itens_podem_editar("cancelado")


def test_resumo_alteracao_itens_embalagem():
    from compras_regras import resumo_alteracao_itens_pedido

    antes = [{
        "descricao": "Absorvente",
        "quantidade": 15,
        "unidade_medida": "pct",
        "embalagem": "",
        "marca_preferencial": "",
        "catalogo_item_id": "abc",
    }]
    depois = [{
        "descricao": "Absorvente",
        "quantidade": 15,
        "unidade_medida": "pct",
        "embalagem": "PCT 16",
        "marca_preferencial": "",
        "catalogo_item_id": "abc",
    }]
    texto = resumo_alteracao_itens_pedido(antes, depois)
    assert "Absorvente" in texto
    assert "PCT 16" in texto


def test_chave_split_categoria_pedido():
    from compras_regras import chave_split_categoria_pedido

    assert chave_split_categoria_pedido("Carne bovina") == ("carne", "Carne")
    assert chave_split_categoria_pedido("Peixe fresco") == ("peixe", "Peixe")
    assert chave_split_categoria_pedido("Alimentação") == ("alimentacao", "Alimentação")
    chave, rotulo = chave_split_categoria_pedido("Papelaria", "cat-1")
    assert chave == "cat:cat-1"
    assert rotulo == "Papelaria"
    # Sem categoria Carne no cadastro, o texto do item não move o grupo
    assert chave_split_categoria_pedido(
        "Alimentação", "ali-1", "Carne Bovina Acem Moido"
    ) == ("alimentacao", "Alimentação")
    assert chave_split_categoria_pedido(
        "Alimentação", "ali-1", "Acem Isca"
    ) == ("alimentacao", "Alimentação")


def test_competencia_orcamento():
    from compras_regras import (
        COMPETENCIA_PROJETO,
        COMPETENCIA_SEDE,
        competencia_padrao_do_segmento,
        normalizar_competencia_orcamento,
    )

    assert normalizar_competencia_orcamento("projeto") == COMPETENCIA_PROJETO
    assert normalizar_competencia_orcamento("sede") == COMPETENCIA_SEDE
    assert competencia_padrao_do_segmento("manutencao") == COMPETENCIA_PROJETO
    assert competencia_padrao_do_segmento("consumo") == COMPETENCIA_SEDE


def test_segmento_catalogo():
    from compras_regras import (
        SEGMENTO_CONSUMO,
        SEGMENTO_MANUTENCAO,
        inferir_segmento_por_nome_categoria,
        segmento_do_tipo_pedido,
    )

    assert inferir_segmento_por_nome_categoria("Manutenção") == SEGMENTO_MANUTENCAO
    assert inferir_segmento_por_nome_categoria("Infraestrutura") == SEGMENTO_MANUTENCAO
    assert inferir_segmento_por_nome_categoria("Alimentação") == SEGMENTO_CONSUMO
    assert segmento_do_tipo_pedido("consumo") == SEGMENTO_CONSUMO
    assert segmento_do_tipo_pedido("manutencao") == SEGMENTO_MANUTENCAO
    assert segmento_do_tipo_pedido("servico") is None


def test_formatar_grupo_codigo():
    from datetime import date

    from compras_regras import formatar_grupo_codigo, sequencia_grupo_codigo

    assert formatar_grupo_codigo(1, date(2026, 8, 24)) == "1-24/08/2026"
    assert formatar_grupo_codigo(12, date(2026, 8, 24)) == "12-24/08/2026"
    assert sequencia_grupo_codigo("1-24/08/2026", "24/08/2026") == 1
    assert sequencia_grupo_codigo("12-24/08/2026", "24/08/2026") == 12
    assert sequencia_grupo_codigo("1-23/08/2026", "24/08/2026") is None
    assert sequencia_grupo_codigo("abc-24/08/2026", "24/08/2026") is None


def test_usuario_pode_cadastrar_mestre_compras():
    from compras_regras import usuario_pode_cadastrar_mestre_compras

    assert usuario_pode_cadastrar_mestre_compras(perfil="ADM Global Compras")
    assert usuario_pode_cadastrar_mestre_compras(perfil="ADM Pedidos")
    assert usuario_pode_cadastrar_mestre_compras(perfil="Gestor", is_manutencao=True)
    assert not usuario_pode_cadastrar_mestre_compras(perfil="Gestor")
    assert not usuario_pode_cadastrar_mestre_compras(perfil="Técnico")


def test_inferir_cadastros_compras():
    from compras_regras import (
        inferir_fator_embalagem,
        inferir_perecivel,
        inferir_tipo_fonte,
        normalizar_tipo_fonte,
    )

    assert inferir_tipo_fonte("Convênio municipal") == "convenio"
    assert inferir_tipo_fonte("Emenda parlamentar") == "emenda"
    assert normalizar_tipo_fonte("proprio", nome="X") == "proprio"
    assert inferir_fator_embalagem("fardo 12 un") == 12.0
    assert inferir_fator_embalagem("") is None
    assert inferir_perecivel(categoria_nome="Alimentação")
    assert not inferir_perecivel(categoria_nome="Higiene e limpeza")


def test_unidade_medida_para_pedido_por_fator():
    from compras_regras import unidade_medida_para_pedido

    assert unidade_medida_para_pedido("kg", embalagem="PCT 2 kg") == "un"
    assert unidade_medida_para_pedido("kg", fator_embalagem=12) == "un"
    assert unidade_medida_para_pedido("l", fator_embalagem=5) == "un"
    assert unidade_medida_para_pedido("m", fator_embalagem=10) == "un"
    assert unidade_medida_para_pedido("kg", fator_embalagem=1) == "kg"
    assert unidade_medida_para_pedido("kg", embalagem="") == "kg"
    assert unidade_medida_para_pedido("pct", embalagem="PCT 1Kg") == "pct"
