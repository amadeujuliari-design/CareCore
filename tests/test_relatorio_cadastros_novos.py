def test_schema_relatorio_cadastros_novos():
    from schemas import RelatorioCadastrosNovosResponse

    payload = RelatorioCadastrosNovosResponse.model_validate({
        "data_inicio": "2026-06-01",
        "data_fim": "2026-06-30",
        "criterio": "inclusoes",
        "total_cadastros": 1,
        "linhas": [{
            "convivente_id": "abc",
            "nome": "Maria Silva",
            "nome_mae": "Ana Silva",
            "prontuario_saude": "PS-123A",
            "prontuario_institucional": "42",
            "data_inclusao": "2026-06-10",
            "data_nova_vinculacao": None,
            "status": "Ativo",
        }],
    })
    assert payload.total_cadastros == 1
    assert payload.linhas[0].prontuario_saude == "PS-123A"
