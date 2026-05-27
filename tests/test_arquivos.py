from routers.arquivos import candidatos_caminho_upload


def test_candidatos_caminho_upload_normaliza_caminho_relativo():
    assert candidatos_caminho_upload("documentos/arquivo.pdf") == [
        "/uploads/documentos/arquivo.pdf",
        "uploads/documentos/arquivo.pdf",
        "documentos/arquivo.pdf",
        "/documentos/arquivo.pdf",
    ]


def test_candidatos_caminho_upload_remove_prefixo_uploads():
    assert candidatos_caminho_upload("/uploads/documentos/foto.png")[0] == (
        "/uploads/documentos/foto.png"
    )


def test_candidatos_caminho_upload_normaliza_barras_windows():
    assert candidatos_caminho_upload(r"uploads\documentos\foto.png")[0] == (
        "/uploads/documentos/foto.png"
    )
