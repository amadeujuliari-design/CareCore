import os
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from routers import conviventes_documentos as docs


def test_upload_local_documentos_bloqueado_em_producao(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")

    assert not docs.upload_local_documentos_permitido()


def test_upload_local_documentos_permitido_em_ambiente_local(monkeypatch):
    monkeypatch.setenv("APP_ENV", "local")

    assert docs.upload_local_documentos_permitido()


def test_salvar_conteudo_documento_usa_storage_quando_configurado(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")

    with patch.object(docs, "storage_supabase_configurado", return_value=True), patch.object(
        docs,
        "upload_supabase_storage",
        return_value="/storage/carecore/documentos/inst/conv/arquivo.jpg",
    ) as upload_mock:
        caminho = docs.salvar_conteudo_documento_convivente(
            instituicao_id="inst-1",
            convivente_id="conv-1",
            extensao_final=".jpg",
            conteudo=b"conteudo",
            content_type="image/jpeg",
        )

    upload_mock.assert_called_once()
    assert caminho.startswith("/storage/")


def test_salvar_conteudo_documento_grava_local_em_dev(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "local")
    upload_dir = tmp_path / "documentos"
    upload_dir.mkdir()

    with patch.object(docs, "UPLOAD_DIR", str(upload_dir)), patch.object(
        docs,
        "UPLOAD_DIR_ABSOLUTO",
        str(upload_dir.resolve()),
    ), patch.object(docs, "storage_supabase_configurado", return_value=False):
        caminho = docs.salvar_conteudo_documento_convivente(
            instituicao_id="inst-1",
            convivente_id="conv-1",
            extensao_final=".jpg",
            conteudo=b"conteudo",
            content_type="image/jpeg",
        )

    assert caminho.startswith("/uploads/documentos/")
    assert len(list(upload_dir.iterdir())) == 1


def test_salvar_conteudo_documento_rejeita_local_em_producao_sem_storage(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")

    with patch.object(docs, "storage_supabase_configurado", return_value=False):
        with pytest.raises(HTTPException) as exc:
            docs.salvar_conteudo_documento_convivente(
                instituicao_id="inst-1",
                convivente_id="conv-1",
                extensao_final=".jpg",
                conteudo=b"conteudo",
            )

    assert exc.value.status_code == 503


def test_remover_arquivo_documento_remove_storage(monkeypatch):
    with patch.object(docs, "storage_supabase_configurado", return_value=True), patch.object(
        docs,
        "extrair_bucket_caminho_storage",
        return_value=("carecore", "documentos/inst/conv/a.jpg"),
    ), patch.object(docs, "remover_supabase_storage") as remover_mock:
        docs.remover_arquivo_documento("/storage/carecore/documentos/inst/conv/a.jpg")

    remover_mock.assert_called_once_with("carecore", "documentos/inst/conv/a.jpg")
