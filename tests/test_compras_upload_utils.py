import asyncio
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image

from compras_upload_utils import remover_arquivo_compras, salvar_arquivo_compras


def _png_grande() -> bytes:
    img = Image.new("RGB", (3200, 2400), color=(40, 90, 140))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_salvar_arquivo_compras_padroniza_imagem_para_jpeg(monkeypatch, tmp_path):
    monkeypatch.setenv("APP_ENV", "local")
    monkeypatch.delenv("CARECORE_SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("CARECORE_SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)

    import compras_upload_utils as utils

    root_uploads = tmp_path / "uploads"
    compras_dir = root_uploads / "compras"
    compras_dir.mkdir(parents=True)
    monkeypatch.setattr(utils, "_ROOT", tmp_path)
    monkeypatch.setattr(utils, "UPLOAD_DIR", str(compras_dir))
    monkeypatch.setattr(utils, "UPLOAD_DIR_ABSOLUTO", str(compras_dir.resolve()))
    monkeypatch.setattr(utils, "_ROOT_UPLOADS_ABSOLUTO", str(root_uploads.resolve()))

    arquivo = SimpleNamespace(filename="orcamento.png", content_type="image/png")
    original = _png_grande()

    async def caso():
        return await salvar_arquivo_compras(
            organizacao_id="org1",
            pedido_id="ped1",
            file=arquivo,  # type: ignore[arg-type]
            conteudo=original,
        )

    caminho, nome, tamanho, content_type = asyncio.run(caso())

    assert nome == "orcamento.jpg"
    assert content_type == "image/jpeg"
    assert caminho.endswith(".jpg")
    assert tamanho < len(original)
    gravado = Path(utils.UPLOAD_DIR) / "org1" / "ped1" / Path(caminho).name
    assert gravado.is_file()
    assert gravado.read_bytes().startswith(b"\xff\xd8")


def test_remover_arquivo_compras_apaga_local(monkeypatch, tmp_path):
    import compras_upload_utils as utils

    root_uploads = tmp_path / "uploads"
    destino = root_uploads / "compras" / "org" / "ped" / "a.pdf"
    destino.parent.mkdir(parents=True)
    destino.write_bytes(b"%PDF-1.4 teste")

    monkeypatch.setattr(utils, "_ROOT", tmp_path)
    monkeypatch.setattr(utils, "_ROOT_UPLOADS_ABSOLUTO", str(root_uploads.resolve()))

    with patch.object(utils, "storage_supabase_configurado", return_value=False):
        remover_arquivo_compras("/uploads/compras/org/ped/a.pdf")

    assert not destino.exists()


def test_remover_arquivo_compras_remove_storage(monkeypatch):
    import compras_upload_utils as utils

    chamado = {}

    def _fake_remover(bucket, caminho):
        chamado["bucket"] = bucket
        chamado["caminho"] = caminho

    monkeypatch.setattr(utils, "storage_supabase_configurado", lambda: True)
    monkeypatch.setattr(utils, "remover_supabase_storage", _fake_remover)

    remover_arquivo_compras("/storage/carecore/compras/org/ped/x.jpg")

    assert chamado == {"bucket": "carecore", "caminho": "compras/org/ped/x.jpg"}
