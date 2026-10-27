from datetime import date, datetime
from types import SimpleNamespace

import pytest

from compras_regras import (
    aviso_cotacoes_insuficientes,
    compras_modulo_ativo_padrao,
    detectar_semana_util,
    dias_liberados_janela,
    data_referencia_economia,
    economia_centavos,
    pedido_no_periodo_economia,
    janela_consumo_aberta,
    normalizar_competencia,
    normalizar_escopo_unidade,
    pedido_escopo_sede,
    pedido_pronto_para_aprovacao_unidade,
    pedido_rascunho_pode_excluir,
    periodo_semana_util_mes,
    rotulo_custo_fonte,
    rotulo_sede_relatorio,
    rotulo_unidade_relatorio,
    sugerir_segunda_semana_util,
    usuario_e_sede_compras,
    usuario_ve_alerta_contrato_assinado,
    usuario_pode_aprovar_sede,
    usuario_pode_aprovar_unidade,
    usuario_pode_enviar_email_compras,
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


def test_rascunho_consumo_com_janela_fechada_ou_sem_publicar():
    from compras_regras import pode_criar_rascunho_consumo, pode_enviar_consumo

    ok, _ = pode_criar_rascunho_consumo(
        hoje=date(2026, 10, 27),
        data_inicio=date(2026, 10, 13),
        data_fim=date(2026, 10, 17),
        data_prevista=date(2026, 10, 13),
    )
    assert ok
    ok_sem_janela, _ = pode_criar_rascunho_consumo(
        hoje=date(2026, 10, 27),
        data_inicio=None,
        data_fim=None,
        data_prevista=None,
    )
    assert ok_sem_janela
    ok_envio, msg = pode_enviar_consumo(
        hoje=date(2026, 10, 27),
        data_inicio=date(2026, 10, 13),
        data_fim=date(2026, 10, 17),
        data_prevista=date(2026, 10, 13),
    )
    assert not ok_envio
    assert "encerrou" in msg.lower()


def test_dia_previsto_rascunho_pula_janela_passada():
    from compras_regras import dia_previsto_rascunho_consumo

    assert dia_previsto_rascunho_consumo(
        hoje=date(2026, 10, 27),
        data_inicio=date(2026, 10, 13),
        data_fim=date(2026, 10, 17),
    ) is None
    assert dia_previsto_rascunho_consumo(
        hoje=date(2026, 10, 27),
        data_inicio=date(2026, 11, 9),
        data_fim=date(2026, 11, 13),
    ) == date(2026, 11, 9)


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
    assert usuario_ve_modulo_compras(perfil="ADM Global Compras Suprimentos", compras_modulo_ativo=False, org_compras_ativo=False)
    assert usuario_ve_modulo_compras(perfil="ADM Global Compras Infraestrutura", compras_modulo_ativo=False, org_compras_ativo=False)
    assert usuario_e_sede_compras(perfil="ADM Global Compras")
    assert usuario_e_sede_compras(perfil="ADM Compras")
    assert usuario_e_sede_compras(perfil="ADM Global Compras Suprimentos")
    assert usuario_e_sede_compras(perfil="ADM Global Compras Infraestrutura")
    assert usuario_pode_aprovar_sede(perfil="ADM Global Compras")
    assert not usuario_e_sede_compras(perfil="ADM Pedidos")
    assert not usuario_ve_modulo_compras(perfil="ADM Pedidos", compras_modulo_ativo=False, org_compras_ativo=False)
    assert usuario_ve_modulo_compras(perfil="ADM Pedidos", compras_modulo_ativo=False, org_compras_ativo=True)
    assert usuario_ve_modulo_compras(perfil="Gestor", compras_modulo_ativo=True)
    assert not usuario_ve_modulo_compras(perfil="Gestor", compras_modulo_ativo=False)
    assert usuario_ve_modulo_compras(perfil="Orientador", compras_modulo_ativo=True)
    assert usuario_ve_modulo_compras(perfil="Consulta", compras_modulo_ativo=True)
    assert not usuario_ve_modulo_compras(perfil="Orientador", compras_modulo_ativo=False)
    assert usuario_ve_modulo_compras(perfil="Gestor", compras_modulo_ativo=False, is_manutencao=True)


def test_alerta_contrato_assinado_projeto_e_infra():
    assert usuario_ve_alerta_contrato_assinado({
        "perfil_acesso": "ADM Global Compras Infraestrutura",
    })
    assert usuario_ve_alerta_contrato_assinado({
        "perfil_acesso": "ADM Pedidos",
        "compras_modulo_ativo": True,
    })
    assert usuario_ve_alerta_contrato_assinado({
        "perfil_acesso": "Gestor",
        "compras_modulo_ativo": True,
    })
    assert not usuario_ve_alerta_contrato_assinado({
        "perfil_acesso": "ADM Global Compras Suprimentos",
    })
    assert not usuario_ve_alerta_contrato_assinado({
        "perfil_acesso": "Global",
        "is_global": True,
        "email": "noemi@aeb-brasil.org.br",
    })
    assert usuario_ve_alerta_contrato_assinado({
        "perfil_acesso": "Gestor",
        "is_manutencao": True,
    })


def test_compras_modulo_ativo_padrao_gestor():
    assert compras_modulo_ativo_padrao("Gestor") is True
    assert compras_modulo_ativo_padrao("Técnico") is False
    assert compras_modulo_ativo_padrao("Administrativo") is False
    assert compras_modulo_ativo_padrao("Consulta") is False
    assert compras_modulo_ativo_padrao(None) is False


def test_global_consulta_compras_sem_editar_e_noemi_assina():
    from compras_regras import usuario_global_assina_orcamento, usuario_global_consulta_compras

    global_comum = {"perfil_acesso": "Global", "is_global": True, "email": "outro@aeb-brasil.org.br"}
    noemi = {"perfil_acesso": "Global", "is_global": True, "email": "Noemi@aeb-brasil.org.br"}
    gestor = {"perfil_acesso": "Gestor", "is_global": True, "email": "gestor@aeb-brasil.org.br"}
    assert usuario_global_consulta_compras(global_comum)
    assert not usuario_global_assina_orcamento(global_comum)
    assert usuario_global_assina_orcamento(noemi)
    assert not usuario_global_consulta_compras(gestor)
    assert not usuario_global_consulta_compras({"perfil_acesso": "Manutenção", "is_global": True, "is_manutencao": True})


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
    from compras_regras import exige_tres_cotacoes, rotulo_tipo_pedido, tipo_eh_cotacao_projeto, tipo_eh_cotacao_sede

    assert tipo_eh_cotacao_projeto("imobilizado")
    assert tipo_eh_cotacao_projeto("servico")
    assert not tipo_eh_cotacao_projeto("manutencao")
    assert not tipo_eh_cotacao_projeto("consumo")
    assert tipo_eh_cotacao_sede("manutencao")
    assert exige_tres_cotacoes("servico")
    assert not exige_tres_cotacoes("manutencao")
    assert rotulo_tipo_pedido("manutencao") == "Itens de manutenção"
    assert pedido_pronto_para_aprovacao_unidade("consumo", 1, True)
    assert not pedido_pronto_para_aprovacao_unidade("consumo", 1, False)
    assert aviso_cotacoes_insuficientes(2)


def test_economia():
    eco = economia_centavos([1000, 800, 900], 800)
    assert eco["valor_cheio_centavos"] == 1000
    assert eco["valor_medio_centavos"] == 900
    assert eco["economia_vs_maior_centavos"] == 200
    assert eco["economia_vs_media_centavos"] == 100
    vazio = economia_centavos([], None)
    assert vazio["valor_cheio_centavos"] == 0
    assert vazio["economia_vs_maior_centavos"] == 0


def test_periodo_economia():
    pedido = SimpleNamespace(
        aprovado_sede_em=datetime(2026, 10, 16, 9, 0),
        aprovado_unidade_em=datetime(2026, 10, 1, 8, 0),
        submetido_em=None,
        criado_em=datetime(2026, 9, 1, 8, 0),
    )
    assert data_referencia_economia(pedido) == date(2026, 10, 16)
    sem_sede = SimpleNamespace(
        aprovado_sede_em=None,
        aprovado_unidade_em=datetime(2026, 10, 1, 8, 0),
        submetido_em=datetime(2026, 9, 20, 8, 0),
        criado_em=datetime(2026, 9, 1, 8, 0),
    )
    assert data_referencia_economia(sem_sede) == date(2026, 10, 1)
    assert pedido_no_periodo_economia(date(2026, 10, 16), date(2026, 10, 1), date(2026, 10, 16))
    assert not pedido_no_periodo_economia(date(2026, 9, 30), date(2026, 10, 1), None)
    assert pedido_no_periodo_economia(None, None, None)
    assert not pedido_no_periodo_economia(None, date(2026, 10, 1), None)


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


def test_aviso_envio_sem_tres_orcamentos():
    from compras_regras import (
        MIN_COTACOES_RECOMENDADAS,
        aviso_pedido_sem_tres_orcamentos_para_sede,
        mensagem_confirmacao_envio_sem_tres,
    )

    assert MIN_COTACOES_RECOMENDADAS == 3
    assert aviso_pedido_sem_tres_orcamentos_para_sede(3) is None
    assert "apenas 1" in (aviso_pedido_sem_tres_orcamentos_para_sede(1) or "")
    assert "Deseja enviar mesmo assim" in mensagem_confirmacao_envio_sem_tres(2)


def test_competencia_orcamento():
    from compras_regras import (
        COMPETENCIA_PROJETO,
        COMPETENCIA_SEDE,
        competencia_padrao_do_segmento,
        normalizar_competencia_orcamento,
    )

    assert normalizar_competencia_orcamento("projeto") == COMPETENCIA_PROJETO
    assert normalizar_competencia_orcamento("sede") == COMPETENCIA_SEDE
    assert competencia_padrao_do_segmento("manutencao") == COMPETENCIA_SEDE
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
    assert inferir_segmento_por_nome_categoria("EPI") == SEGMENTO_MANUTENCAO
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
    assert usuario_pode_cadastrar_mestre_compras(perfil="Gestor", compras_modulo_ativo=True)
    assert usuario_pode_cadastrar_mestre_compras(perfil="Técnico", compras_modulo_ativo=True)
    assert not usuario_pode_cadastrar_mestre_compras(perfil="Técnico")
    assert usuario_pode_cadastrar_mestre_compras(perfil="Orientador", compras_modulo_ativo=True)
    assert usuario_pode_aprovar_unidade(perfil="Consulta", compras_modulo_ativo=True)


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


def test_hortifruti_segmento_e_fluxo():
    from compras_regras import (
        SEGMENTO_HORTIFRUTI,
        TIPO_HORTIFRUTI,
        exige_tres_cotacoes,
        inferir_segmento_por_nome_categoria,
        normalizar_segmento_catalogo,
        segmento_do_tipo_pedido,
        tipo_eh_cotacao_projeto,
        tipo_eh_cotacao_sede,
        tipo_exige_janela,
        tipo_pula_aprovacao_sede,
    )

    assert normalizar_segmento_catalogo("hortifruti") == SEGMENTO_HORTIFRUTI
    assert inferir_segmento_por_nome_categoria("Hortifruti") == SEGMENTO_HORTIFRUTI
    assert segmento_do_tipo_pedido(TIPO_HORTIFRUTI) == SEGMENTO_HORTIFRUTI
    assert tipo_eh_cotacao_sede(TIPO_HORTIFRUTI)
    assert not tipo_eh_cotacao_projeto(TIPO_HORTIFRUTI)
    assert not tipo_exige_janela(TIPO_HORTIFRUTI)
    assert not tipo_pula_aprovacao_sede(TIPO_HORTIFRUTI)
    assert not exige_tres_cotacoes(TIPO_HORTIFRUTI)


def test_consumo_aguardando_sede_nao_exige_aprovacao_da_unidade():
    from compras_regras import TIPO_CONSUMO, TIPO_IMOBILIZADO, sede_exige_aprovacao_previa_unidade

    assert not sede_exige_aprovacao_previa_unidade(
        TIPO_CONSUMO, escopo_sede=False, aprovado_unidade=False,
    )
    assert sede_exige_aprovacao_previa_unidade(
        TIPO_IMOBILIZADO, escopo_sede=False, aprovado_unidade=False,
    )
    assert not sede_exige_aprovacao_previa_unidade(
        TIPO_IMOBILIZADO, escopo_sede=False, aprovado_unidade=True,
    )


def test_infraestrutura_nao_envia_email_fornecedor():
    from compras_regras import PERFIL_ADM_COMPRAS_INFRAESTRUTURA, PERFIL_ADM_COMPRAS_SUPRIMENTOS

    assert usuario_pode_enviar_email_compras(
        perfil=PERFIL_ADM_COMPRAS_INFRAESTRUTURA,
    ) is False
    assert usuario_pode_enviar_email_compras(
        perfil=PERFIL_ADM_COMPRAS_INFRAESTRUTURA,
        is_manutencao=True,
    ) is True
    assert usuario_pode_enviar_email_compras(perfil=PERFIL_ADM_COMPRAS_SUPRIMENTOS) is True
    assert usuario_pode_enviar_email_compras(perfil="Gestor") is True


def test_competencia_mes_seguinte_e_lado_da_timeline():
    from compras_regras import (
        PERFIL_ADM_COMPRAS_SUPRIMENTOS,
        competencia_mes_seguinte,
        lado_timeline_compras,
        tipo_arquivo_bem_de_anexo_pedido,
    )

    assert competencia_mes_seguinte("2026-09") == "2026-10"
    assert competencia_mes_seguinte("2026-12") == "2027-01"
    assert lado_timeline_compras(perfil=PERFIL_ADM_COMPRAS_SUPRIMENTOS) == "suprimentos"
    assert lado_timeline_compras(perfil="ADM Global Compras Infraestrutura") == "infraestrutura"
    assert lado_timeline_compras(perfil="Gestor") == "projeto"
    from compras_regras import pedido_segue_infraestrutura
    assert pedido_segue_infraestrutura("imobilizado") is True
    assert pedido_segue_infraestrutura("servico") is True
    assert pedido_segue_infraestrutura("manutencao", "infraestrutura") is True
    assert pedido_segue_infraestrutura("manutencao", "suprimentos") is False
    assert pedido_segue_infraestrutura("consumo") is False
    from compras_regras import normalizar_qtd_parcelas_pagamento, pagamento_infra_completo
    assert normalizar_qtd_parcelas_pagamento(1) == 1
    assert normalizar_qtd_parcelas_pagamento("4") == 4
    try:
        normalizar_qtd_parcelas_pagamento(0)
        assert False
    except ValueError:
        pass
    assert pagamento_infra_completo(qtd=3, parcelas_pagas=3, quitado=False) is True
    assert pagamento_infra_completo(qtd=3, parcelas_pagas=1, quitado=False) is False
    assert pagamento_infra_completo(qtd=3, parcelas_pagas=0, quitado=True) is True
    assert pagamento_infra_completo(qtd=None, parcelas_pagas=0, quitado=False) is False
    from compras_regras import maior_parcela_com_documento
    assert maior_parcela_com_documento([
        {"numero": 1, "paga": True},
        {"numero": 2, "paga": True},
        {"numero": 3, "paga": False},
        {"numero": 4, "paga": False},
    ]) == 2
    assert maior_parcela_com_documento([]) == 0
    from compras_regras import parcela_conta_como_paga
    assert parcela_conta_como_paga(1, {1: True}, qtd=3) is True
    assert parcela_conta_como_paga(2, {1: True}, qtd=3) is False
    assert parcela_conta_como_paga(1, {0: True}, qtd=1) is True
    assert parcela_conta_como_paga(1, {0: True}, qtd=3) is False
    assert tipo_arquivo_bem_de_anexo_pedido("orcamento_assinado") == "orcamento"
    assert tipo_arquivo_bem_de_anexo_pedido("nf_pdf") == "nota"
    assert tipo_arquivo_bem_de_anexo_pedido("termo_doacao") == "termo_doacao"


def test_situacao_pagamento_infra_conta_nf_ou_comprovante():
    from types import SimpleNamespace
    from compras_pedido_fluxo import situacao_pagamento_de_registros

    pedido = SimpleNamespace(
        tipo="imobilizado",
        destino_compras=None,
        pagamento_qtd_parcelas=2,
        pagamento_quitado_em=None,
    )
    notas = [
        SimpleNamespace(tipo_nf="produto", anexo_id="a1", parcela_numero=1),
        SimpleNamespace(tipo_nf="boleto", anexo_id="a2", parcela_numero=2),
    ]
    anexos = [
        SimpleNamespace(ativo=True, classe_documento="boleto", parcela_numero=2),
        SimpleNamespace(ativo=True, classe_documento="comprovante", parcela_numero=2),
    ]
    sit = situacao_pagamento_de_registros(pedido, notas, anexos)
    assert sit["parcelas_pagas"] == 2
    assert sit["completo"] is True
    assert sit["parcelas"][0]["paga"] is True
    assert sit["parcelas"][1]["paga"] is True

    so_boleto = situacao_pagamento_de_registros(
        pedido,
        [SimpleNamespace(tipo_nf="boleto", anexo_id="b1", parcela_numero=1)],
        [SimpleNamespace(ativo=True, classe_documento="boleto", parcela_numero=1)],
    )
    assert so_boleto["parcelas_pagas"] == 0
    assert so_boleto["completo"] is False


def test_acento_quebrado_de_cp437_volta_ao_portugues():
    from compras_regras import corrigir_acento_quebrado

    assert corrigir_acento_quebrado("Alimenta\u251c\u00ba\u251c\u00fao") == "Alimentação"
    assert corrigir_acento_quebrado("Conv\u251c\u00acnio") == "Convênio"
    assert corrigir_acento_quebrado("Caf\u251c\u00ae") == "Café"
    assert corrigir_acento_quebrado("Fil\u251c\u00ae") == "Filé"
    assert corrigir_acento_quebrado("Manuten\u251c\u00ba\u251c\u00fao") == "Manutenção"
    assert corrigir_acento_quebrado("Convênio") == "Convênio"
    assert corrigir_acento_quebrado("Custo indireto") == "Custo indireto"
    assert corrigir_acento_quebrado(None) is None


def test_rotulo_custo_fonte_convenio_e_indireto():
    assert rotulo_custo_fonte("convenio", "Convênio") == "Custo direto"
    assert rotulo_custo_fonte("custo_indireto", "Custo indireto") == "Custo indireto"
    assert rotulo_custo_fonte("", "Convênio municipal") == "Custo direto"


def test_compras_emergencia_e_filas_infra():
    from datetime import date
    from types import SimpleNamespace

    from compras_regras import (
        TIPO_EMERGENCIA,
        TIPO_IMOBILIZADO,
        STATUS_AGUARDANDO_PAGAMENTO,
        STATUS_RECEBIDO,
        assunto_solicitacao_cotacao,
        aviso_cotacoes_insuficientes,
        categoria_email_cotacao,
        formatar_data_br_compras,
        pedido_na_fila_concluidos_infra,
        pedido_na_fila_nf_pagamento,
        pedido_segue_infraestrutura,
        texto_cadastro_caixa_alta,
        tipo_eh_emergencia,
        tipo_pula_orcamento,
        tipos_visiveis_adm_compras,
    )

    assert tipo_eh_emergencia("emergencia")
    assert tipo_pula_orcamento(TIPO_EMERGENCIA)
    assert aviso_cotacoes_insuficientes(0, TIPO_EMERGENCIA) is None
    assert pedido_segue_infraestrutura(TIPO_EMERGENCIA)
    assert pedido_na_fila_nf_pagamento(TIPO_EMERGENCIA, STATUS_AGUARDANDO_PAGAMENTO)
    assert not pedido_na_fila_nf_pagamento(TIPO_IMOBILIZADO, STATUS_AGUARDANDO_PAGAMENTO)
    assert pedido_na_fila_concluidos_infra(
        tipo=TIPO_IMOBILIZADO, destino=None, status=STATUS_RECEBIDO, ok_final_em=None,
    )
    assert not pedido_na_fila_concluidos_infra(
        tipo=TIPO_IMOBILIZADO, destino=None, status=STATUS_RECEBIDO, ok_final_em=date(2026, 10, 27),
    )
    visao = tipos_visiveis_adm_compras(perfil="ADM Global Compras Infraestrutura")
    assert visao is not None and TIPO_EMERGENCIA in visao
    assert texto_cadastro_caixa_alta("  arroz tipo 1 ") == "ARROZ TIPO 1"
    assert formatar_data_br_compras(date(2026, 10, 26)) == "26/10/2026"
    pedido = SimpleNamespace(categoria_split_nome="Alimentação", tipo="consumo")
    assert categoria_email_cotacao(pedido) == "ALIMENTAÇÃO"
    assunto = assunto_solicitacao_cotacao(
        projeto="SIAT II Armênia", categoria="Alimentação", dia=date(2026, 10, 26),
    )
    assert assunto == "Solicitação de cotação CareCore · SIAT II Armênia · ALIMENTAÇÃO · 26/10/2026"
