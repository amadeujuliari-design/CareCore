import os
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers.conviventes_documentos import (
    UPLOAD_DIR_ABSOLUTO,
    caminho_absoluto_documento,
    validar_upload_documento,
)


def arquivo_upload(nome, content_type):
    return SimpleNamespace(filename=nome, content_type=content_type)


def test_validar_upload_documento_aceita_pdf():
    nome = validar_upload_documento(
        arquivo_upload("documento.pdf", "application/pdf")
    )

    assert nome == "documento.pdf"


def test_validar_upload_documento_aceita_html_com_charset():
    nome = validar_upload_documento(
        arquivo_upload("termo_bagageiro_2.html", "text/html; charset=utf-8")
    )

    assert nome == "termo_bagageiro_2.html"


def test_validar_upload_documento_rejeita_extensao_perigosa():
    with pytest.raises(HTTPException):
        validar_upload_documento(
            arquivo_upload("atalho.exe", "application/octet-stream")
        )


def test_caminho_absoluto_documento_fica_na_pasta_uploads():
    caminho = caminho_absoluto_documento("/uploads/documentos/arquivo.pdf")

    assert os.path.commonpath([UPLOAD_DIR_ABSOLUTO, caminho]) == UPLOAD_DIR_ABSOLUTO
    assert caminho.endswith(os.path.join("uploads", "documentos", "arquivo.pdf"))
