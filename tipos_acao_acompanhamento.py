"""Tipos de ação alinhados ao relatório mensal técnico (MAIO.2026) e regras operacionais."""

from __future__ import annotations

from typing import Literal

NaturezaAcao = Literal["saida_temporaria", "encaminhamento", "saida_definitiva"]

# Valores legados (registros antigos) → linha do relatório
LEGADO_PARA_LINHA_RELATORIO: dict[str, str] = {
    "SIAT III - Hermelino": "SIAT III - Ermelino",
    "Hotel social": "Transferidos para Hotéis Sociais",
    "Retorno familiar": "Saída autônoma para retorno familiar",
    "Retorno cidade natal": "Saída autônoma para retorno a local de origem",
    "Alojamento": "Saída autônoma para trabalho com alojamento",
    "Óbito": "Óbitos",
}

TIPOS_ACAO_ACOMPANHAMENTO: list[dict] = [
    {
        "valor": "Contatos familiares",
        "linha_relatorio": "Contatos Familiares",
        "natureza": "saida_temporaria",
        "sugerir_ausencia_justificada": True,
        "sugerir_inativar": False,
    },
    {
        "valor": "Encaminhamentos para cursos",
        "linha_relatorio": "Encaminhamentos para Cursos",
        "natureza": "saida_temporaria",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": False,
    },
    {
        "valor": "Encaminhamentos PTR e benefícios sociais",
        "linha_relatorio": "Encaminhamentos PTR e Benefícios Sociais",
        "natureza": "saida_temporaria",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": False,
    },
    {
        "valor": "Encaminhamentos escola formal",
        "linha_relatorio": "Encaminhamentos Escola formal",
        "natureza": "saida_temporaria",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": False,
    },
    {
        "valor": "Encaminhamentos para trabalho",
        "linha_relatorio": "Encaminhamentos para Trabalho",
        "natureza": "saida_temporaria",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": False,
    },
    {
        "valor": "Encaminhamentos para regularização de documentos",
        "linha_relatorio": "Encaminhamentos para Regularização de Documentos",
        "natureza": "saida_temporaria",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": False,
    },
    {
        "valor": "Encaminhamentos para CREAS POP",
        "linha_relatorio": "Encaminhamentos para CREAS POP",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Encaminhamentos para o SCP",
        "linha_relatorio": "Encaminhamentos para o SCP",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Encaminhamentos para outro C.A. ou C.T.A",
        "linha_relatorio": "Encaminhamentos para outro C.A. ou C.T.A",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Encaminhamentos para outro serviço da rede de Assistência",
        "linha_relatorio": "Encaminhamentos para outro serviço da rede de Assistência",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Casa Terapêutica",
        "linha_relatorio": "Casa Terapêutica",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "CTA",
        "linha_relatorio": "CTA",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "SIAT III - Ermelino",
        "linha_relatorio": "SIAT III - Ermelino",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "SIAT III - Heliópolis",
        "linha_relatorio": "SIAT III - Heliópolis",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "SIAT III - Penha",
        "linha_relatorio": "SIAT III - Penha",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Transferidos para Hotéis Sociais",
        "linha_relatorio": "Transferidos para Hotéis Sociais",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Saída autônoma para retorno familiar",
        "linha_relatorio": "Saída Autônoma para Retorno a Familiar",
        "natureza": "saida_definitiva",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Saída autônoma para retorno a local de origem",
        "linha_relatorio": "Saída Autônoma para Retorno a local de origem",
        "natureza": "saida_definitiva",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Saída autônoma para trabalho com alojamento",
        "linha_relatorio": "Saída Autônoma para Trabalho com Alojamento",
        "natureza": "saida_definitiva",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Saída autônoma para moradia autônoma",
        "linha_relatorio": "Saída Autônoma para Moradia Autônoma",
        "natureza": "saida_definitiva",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Desligamentos solicitados pelos conviventes",
        "linha_relatorio": "Desligamentos solicitados pelos conviventes",
        "natureza": "saida_definitiva",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Óbitos",
        "linha_relatorio": "Óbitos",
        "natureza": "saida_definitiva",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
    {
        "valor": "Outros",
        "linha_relatorio": "Outros",
        "natureza": "encaminhamento",
        "sugerir_ausencia_justificada": False,
        "sugerir_inativar": True,
    },
]

TIPOS_ACAO_POR_VALOR = {item["valor"]: item for item in TIPOS_ACAO_ACOMPANHAMENTO}

DESTINOS_TRANSFERENCIA = [item["valor"] for item in TIPOS_ACAO_ACOMPANHAMENTO]

DESTINOS_TRANSFERENCIA_VALIDOS = set(DESTINOS_TRANSFERENCIA) | set(LEGADO_PARA_LINHA_RELATORIO.keys())

LINHAS_RELATORIO_MENSAL_ACOES = [item["linha_relatorio"] for item in TIPOS_ACAO_ACOMPANHAMENTO]

# Linhas derivadas de outros módulos (espelho MAIO.2026)
LINHAS_RELATORIO_DERIVADAS = [
    "P.I.A. em andamento",
    "Conviventes suspensão provisória no mês",
    "POT — inserções no mês",
]


def normalizar_destino_para_linha_relatorio(destino: str, destino_outro: str | None = None) -> str:
    if destino in LEGADO_PARA_LINHA_RELATORIO:
        return LEGADO_PARA_LINHA_RELATORIO[destino]
    meta = TIPOS_ACAO_POR_VALOR.get(destino)
    if meta:
        return meta["linha_relatorio"]
    if destino == "Outros" and destino_outro:
        return f"Outros — {destino_outro}"
    return destino


def obter_metadados_tipo_acao(destino: str) -> dict | None:
    if destino in TIPOS_ACAO_POR_VALOR:
        return TIPOS_ACAO_POR_VALOR[destino]
    linha = LEGADO_PARA_LINHA_RELATORIO.get(destino)
    if linha:
        for item in TIPOS_ACAO_ACOMPANHAMENTO:
            if item["linha_relatorio"] == linha:
                return item
    return None
