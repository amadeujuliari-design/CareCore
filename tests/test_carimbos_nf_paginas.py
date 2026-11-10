from compras_assinatura_pdf import parse_posicoes_carimbo


def test_parse_posicoes_json_varias_paginas():
    payload = {
        "carimbos_texto_json": [
            {"page": 0, "x": 10, "y": 20, "width": 100, "height": 40},
            {"page": 2, "x": 30, "y": 40, "width": 120, "height": 50},
        ]
    }
    pos = parse_posicoes_carimbo(
        payload,
        chave_json="carimbos_texto_json",
        pagina="carimbo_pagina",
        x="carimbo_x",
        y="carimbo_y",
        w="carimbo_w",
        h="carimbo_h",
    )
    assert len(pos) == 2
    assert pos[0]["page"] == 0
    assert pos[1]["page"] == 2
    assert pos[1]["x"] == 30.0


def test_parse_posicoes_legado_unico():
    payload = {
        "carimbo_pagina": 1,
        "carimbo_x": 12,
        "carimbo_y": 34,
        "carimbo_w": 200,
        "carimbo_h": 48,
    }
    pos = parse_posicoes_carimbo(
        payload,
        chave_json="carimbos_texto_json",
        pagina="carimbo_pagina",
        x="carimbo_x",
        y="carimbo_y",
        w="carimbo_w",
        h="carimbo_h",
    )
    assert pos == [{"page": 1, "x": 12.0, "y": 34.0, "width": 200.0, "height": 48.0}]
