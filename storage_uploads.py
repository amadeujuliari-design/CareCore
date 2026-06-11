from __future__ import annotations

import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


class StorageConfiguracaoAusente(RuntimeError):
    pass


class StorageErro(RuntimeError):
    pass


@dataclass(frozen=True)
class StorageArquivo:
    conteudo: bytes
    content_type: str


def storage_supabase_configurado() -> bool:
    return bool(_supabase_url() and _supabase_service_key())


def caminho_storage(bucket: str, caminho: str) -> str:
    return f"/storage/{bucket}/{caminho.strip('/')}"


def extrair_bucket_caminho_storage(caminho_storage: str) -> tuple[str, str] | None:
    valor = (caminho_storage or "").strip().replace("\\", "/").lstrip("/")

    if not valor.startswith("storage/"):
        return None

    partes = valor.split("/", 2)
    if len(partes) != 3 or not partes[1] or not partes[2]:
        return None

    return partes[1], partes[2]


def upload_supabase_storage(
    caminho: str,
    conteudo: bytes,
    *,
    content_type: str,
    bucket: str | None = None,
) -> str:
    bucket_final = bucket or _supabase_bucket()
    caminho_final = caminho.strip("/")
    url = _url_objeto(bucket_final, caminho_final)

    request = urllib.request.Request(
        url,
        data=conteudo,
        method="POST",
        headers={
            **_headers_supabase(),
            "Content-Type": content_type,
            "x-upsert": "true",
        },
    )

    _executar_request_sem_corpo(request)
    return caminho_storage(bucket_final, caminho_final)


def baixar_supabase_storage(bucket: str, caminho: str) -> StorageArquivo:
    request = urllib.request.Request(
        _url_objeto(bucket, caminho.strip("/")),
        method="GET",
        headers=_headers_supabase(),
    )

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            content_type = response.headers.get("Content-Type", "application/octet-stream")
            return StorageArquivo(
                conteudo=response.read(),
                content_type=content_type,
            )
    except urllib.error.HTTPError as exc:
        raise StorageErro(f"Storage retornou HTTP {exc.code}.") from exc
    except urllib.error.URLError as exc:
        raise StorageErro("Não foi possível acessar o storage.") from exc


def remover_supabase_storage(bucket: str, caminho: str) -> None:
    request = urllib.request.Request(
        _url_objeto(bucket, caminho.strip("/")),
        method="DELETE",
        headers=_headers_supabase(),
    )

    _executar_request_sem_corpo(request)


def _supabase_url() -> str:
    return (
        os.getenv("CARECORE_SUPABASE_URL")
        or os.getenv("SUPABASE_URL")
        or ""
    ).strip().rstrip("/")


def _supabase_service_key() -> str:
    return (
        os.getenv("CARECORE_SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or ""
    ).strip()


def _supabase_bucket() -> str:
    return (
        os.getenv("CARECORE_SUPABASE_STORAGE_BUCKET")
        or os.getenv("SUPABASE_STORAGE_BUCKET")
        or "carecore"
    ).strip()


def _headers_supabase() -> dict[str, str]:
    service_key = _supabase_service_key()
    if not _supabase_url() or not service_key:
        raise StorageConfiguracaoAusente("Storage Supabase não configurado.")

    return {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }


def _url_objeto(bucket: str, caminho: str) -> str:
    base = _supabase_url()
    if not base:
        raise StorageConfiguracaoAusente("Storage Supabase não configurado.")

    bucket_seguro = urllib.parse.quote(bucket.strip("/"), safe="")
    caminho_seguro = "/".join(
        urllib.parse.quote(parte, safe="")
        for parte in caminho.strip("/").split("/")
        if parte
    )
    return f"{base}/storage/v1/object/{bucket_seguro}/{caminho_seguro}"


def _executar_request_sem_corpo(request: urllib.request.Request) -> None:
    try:
        with urllib.request.urlopen(request, timeout=20):
            return
    except urllib.error.HTTPError as exc:
        raise StorageErro(f"Storage retornou HTTP {exc.code}.") from exc
    except urllib.error.URLError as exc:
        raise StorageErro("Não foi possível acessar o storage.") from exc
