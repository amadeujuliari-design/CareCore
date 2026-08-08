from nfp_metas_utils import calcular_metas_julho, codigo_projeto_metas, ref_credito_padrao


def test_codigo_projeto_aliases():
    assert codigo_projeto_metas("SEDE AEB") == "SEDE"
    assert codigo_projeto_metas("CEI BELÉM") == "CEI BELÉM"
    assert codigo_projeto_metas("CTA 17 – LIBERDADE") == "CTA 17 - LIBERDADE"


def test_ref_credito_padrao_atras_4_meses():
    assert ref_credito_padrao("2026-05") == "2026-01"
    assert ref_credito_padrao("2026-07") == "2026-03"
    assert ref_credito_padrao("2026-03") == "2025-11"
    assert ref_credito_padrao("2026-04") == "2025-12"


def test_parse_ref_titulo_planilha():
    from nfp_metas_planilha import parse_ref_do_titulo

    assert parse_ref_do_titulo("JULHO 2026 - REF MARÇO", "2026-07") == "2026-03"
    assert parse_ref_do_titulo("MAIO 2026 - REF JANEIRO 2026", "2026-05") == "2026-01"
    assert parse_ref_do_titulo("MARÇO 2026- REF NOVEMBRO", "2026-03") == "2025-11"
    assert parse_ref_do_titulo("AGOSTO 2026 - REF ", "2026-08") == "2026-04"


def test_calculo_metas_julho_basico():
    resumo = calcular_metas_julho(
        digitadas_por_projeto={"SEDE": 100, "CEDESP": 100},
        doadas_por_projeto={"SEDE": 50, "CEDESP": 50},
        soulcial_por_projeto={"SEDE": 10},
        campanhas_por_projeto={"SEDE": 5},
        f35_digitado=1000,
        f36_doado=1000,
        soulcial_base=100,
        total_captador=200,
        digitadas_diego=10,
    )
    assert resumo.g35_fundo == 300
    assert resumo.h35_projetos == 700
    assert resumo.g36_fundo == 300
    assert resumo.h36_projetos == 700
    assert resumo.soulcial_20 == 20
    assert resumo.fundo_10 == 10
    assert resumo.premiacao_10 == 10
    assert resumo.valor_diego == 100
    assert resumo.total_geral_aeb == resumo.valor_conquistado
    assert resumo.valor_conquistado == 2300.0
    assert resumo.valor_aplicado == round(resumo.soulcial_rateio + resumo.g37_fundo + sum(l.total for l in resumo.linhas) + resumo.valor_diego, 2)
    assert resumo.batimento_diferenca == round(resumo.valor_conquistado - resumo.valor_aplicado, 2)
    sede = next(l for l in resumo.linhas if l.codigo_projeto == "SEDE")
    cedesp = next(l for l in resumo.linhas if l.codigo_projeto == "CEDESP")
    assert sede.pct_digitadas == 0.5
    assert sede.valor_digitado == 350
    assert sede.valor_aplicativo == 350
    assert sede.diego == 100
    assert cedesp.diego == 0
    assert sede.total == 350 + 350 + 10 + 5 + 100
    assert resumo.digitadas_geral == 210


def test_batimento_conquistado_vs_aplicado_fecha():
    """Quando Soulcial/Campanhas nas linhas = 60% da base, entradas = saidas."""
    resumo = calcular_metas_julho(
        digitadas_por_projeto={"SEDE": 100},
        doadas_por_projeto={"SEDE": 100},
        soulcial_por_projeto={"SEDE": 40},
        campanhas_por_projeto={"SEDE": 20},
        f35_digitado=1000,
        f36_doado=0,
        soulcial_base=100,
        total_captador=200,
        digitadas_diego=0,
    )
    # 60% de 100 = 60 = 40+20 nas linhas; captador fecha com Diego duplicado no batimento
    assert resumo.valor_conquistado == 1300.0
    assert resumo.batimento_ok is True
    assert resumo.batimento_diferenca == 0
    # Total rateio CareCore nao conta Diego 2x
    assert resumo.total_rateio_geral == round(resumo.valor_aplicado - resumo.valor_diego, 2)
