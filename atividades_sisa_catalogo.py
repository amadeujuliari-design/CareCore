"""Catálogo padrão SISA (Relatório Resumo de Atividades) — seed inicial."""

SISA_CATALOGO_TIPOS_PADRAO = [
    "ATIVIDADE EM GRUPO",
    "OFICINAS",
]

SISA_CATALOGO_TEMAS_PADRAO = [
    "ASSEMBLEIA OU REUNIAO COM PARTICIPANTES",
    "GERACOES DE RENDA",
    "ESPORTE COLETIVO",
    "ANIVERSARIANTE DO MES",
    "OCUPACIONAIS",
]

TIPOS_CATALOGO_SISA = frozenset({"descricao_atividade", "descricao_tema"})
