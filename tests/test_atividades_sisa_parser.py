from datetime import date
from pathlib import Path

import pytest

from atividades_sisa_conferencia import montar_comparativo_sisa_carecore
from atividades_sisa_parser import (
    ler_relatorio_resumo_atividades_sisa,
    normalizar_horario_sisa,
    normalizar_texto_sisa,
)


def test_normalizar_texto_sisa_remove_acentos():
    assert normalizar_texto_sisa("Gerações de Renda") == "GERACOES DE RENDA"


def test_normalizar_horario_sisa():
    assert normalizar_horario_sisa("09:00 às 11:00") == "09:00-11:00"
    assert normalizar_horario_sisa("09:00 as 16:00") == "09:00-16:00"


def test_ler_relatorio_resumo_atividades_sisa_arquivo_real():
    caminho = Path(
        r"c:\Users\user\Downloads\Encaminhamento de Documentos\RelatorioResumoAtividades.xls"
    )
    if not caminho.exists():
        pytest.skip("Arquivo de exemplo SISA não disponível neste ambiente.")

    dados = ler_relatorio_resumo_atividades_sisa(caminho.read_bytes(), caminho.name)
    assert dados["data_inicio_referencia"] == date(2026, 5, 23)
    assert dados["data_fim_referencia"] == date(2026, 6, 23)
    assert len(dados["linhas"]) >= 40
    assert dados["linhas"][0]["participacoes_sisa"] >= 0


def test_comparativo_detecta_divergencia_quantidade():
    linhas_sisa = [
        {
            "chave": "2026-06-14|09:00-16:00|ATIVIDADE EM GRUPO|GERACOES DE RENDA",
            "dimensao": "CIDADÃO",
            "descricao_atividade": "ATIVIDADE EM GRUPO",
            "descricao_tema": "GERACOES DE RENDA",
            "descricao_atividade_norm": "ATIVIDADE EM GRUPO",
            "descricao_tema_norm": "GERACOES DE RENDA",
            "data_sessao": date(2026, 6, 14),
            "horario": "09:00 às 16:00",
            "horario_norm": "09:00-16:00",
            "participacoes_sisa": 8,
        }
    ]
    atividades_por_id = {
        "a1": {
            "id": "a1",
            "nome": "Gerações tarde",
            "sisa_descricao_atividade": "ATIVIDADE EM GRUPO",
            "sisa_descricao_tema": "GERACOES DE RENDA",
            "sisa_horario_padrao": "09:00 às 16:00",
            "ocorrencias": [
                {
                    "id": "o1",
                    "data_sessao": date(2026, 6, 14),
                    "horario_sessao": "09:00 às 16:00",
                }
            ],
        }
    }
    resultado = montar_comparativo_sisa_carecore(
        linhas_sisa=linhas_sisa,
        vinculos_por_chave={linhas_sisa[0]["chave"]: "a1"},
        atividades_por_id=atividades_por_id,
        ocorrencias_por_id={},
        presencas_por_ocorrencia={"o1": 5},
        sugestoes_vinculo={},
    )
    assert resultado["linhas"][0]["status"] == "divergencia_quantidade"
    assert resultado["linhas"][0]["participacoes_carecore"] == 5
    assert resultado["resumo"]["divergencias_quantidade"] == 1
