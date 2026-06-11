from io import BytesIO

from PIL import Image

from imagem_upload import (
    FOTO_PERFIL_TAMANHO,
    LOGO_RELATORIO_TAMANHO_MAX,
    padronizar_logo_relatorio_bytes,
    padronizar_foto_perfil_bytes,
    padronizar_imagem_documento_bytes,
    padronizar_upload_imagem,
)


def _criar_imagem_teste(largura: int, altura: int, cor=(120, 80, 200)) -> bytes:
    img = Image.new("RGB", (largura, altura), color=cor)
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def test_padronizar_foto_perfil_redimensiona_para_quadrado_512():
    original = _criar_imagem_teste(1600, 900)
    padronizada = padronizar_foto_perfil_bytes(original)

    with Image.open(BytesIO(padronizada)) as img:
        assert img.format == "JPEG"
        assert img.size == (FOTO_PERFIL_TAMANHO, FOTO_PERFIL_TAMANHO)


def test_padronizar_imagem_documento_limita_lado_maximo():
    original = _criar_imagem_teste(4000, 3000)
    padronizada = padronizar_imagem_documento_bytes(original)

    with Image.open(BytesIO(padronizada)) as img:
        assert img.format == "JPEG"
        assert max(img.size) <= 2048


def test_padronizar_upload_imagem_retorna_jpg_para_foto_perfil():
    original = _criar_imagem_teste(800, 600)
    conteudo, extensao = padronizar_upload_imagem(
        original,
        tipo_documento="Foto de Perfil",
    )

    assert extensao == ".jpg"
    assert conteudo.startswith(b"\xff\xd8")


def test_padronizar_logo_relatorio_limita_dimensoes():
    original = _criar_imagem_teste(2400, 900)
    padronizada = padronizar_logo_relatorio_bytes(original)

    with Image.open(BytesIO(padronizada)) as img:
        largura_max, altura_max = LOGO_RELATORIO_TAMANHO_MAX
        assert img.width <= largura_max
        assert img.height <= altura_max


def test_padronizar_upload_imagem_retorna_png_para_logo_transparente():
    img = Image.new("RGBA", (900, 300), color=(120, 80, 200, 120))
    buffer = BytesIO()
    img.save(buffer, format="PNG")

    conteudo, extensao = padronizar_upload_imagem(
        buffer.getvalue(),
        tipo_documento="Logo de Relatório",
    )

    assert extensao == ".png"
    assert conteudo.startswith(b"\x89PNG")
