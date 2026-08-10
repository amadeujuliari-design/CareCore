"""Cliente HTTP do agente NFP → CareCore+ online."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any, Optional


class CareCoreApiError(RuntimeError):
    def __init__(self, mensagem: str, *, status: Optional[int] = None, detalhe: Any = None):
        super().__init__(mensagem)
        self.status = status
        self.detalhe = detalhe


class CareCoreApi:
    def __init__(self, base_url: str, token: str = ""):
        self.base_url = (base_url or "").rstrip("/")
        self.token = (token or "").strip()

    def _url(self, path: str) -> str:
        if not path.startswith("/"):
            path = "/" + path
        return f"{self.base_url}{path}"

    def _request(
        self,
        method: str,
        path: str,
        *,
        body: Optional[dict] = None,
        auth: bool = True,
        timeout: int = 60,
    ) -> Any:
        data = None
        headers = {"Accept": "application/json"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if auth:
            if not self.token:
                raise CareCoreApiError("Token ausente. Faca login no agente.")
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(self._url(path), data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                if not raw:
                    return {}
                return json.loads(raw)
        except urllib.error.HTTPError as exc:
            detalhe = exc.read().decode("utf-8", errors="replace")
            try:
                detalhe_json = json.loads(detalhe)
            except Exception:
                detalhe_json = detalhe
            raise CareCoreApiError(
                f"HTTP {exc.code} em {path}: {detalhe_json}",
                status=exc.code,
                detalhe=detalhe_json,
            ) from exc
        except urllib.error.URLError as exc:
            raise CareCoreApiError(f"Falha de rede em {path}: {exc}") from exc

    def login(self, email: str, senha: str) -> str:
        out = self._request(
            "POST",
            "/api/login",
            body={"email": email, "senha": senha},
            auth=False,
        )
        token = (out.get("access_token") or "").strip()
        if not token:
            raise CareCoreApiError("Login sem access_token.")
        self.token = token
        return token

    def fila(self) -> dict:
        return self._request("GET", "/api/nfp/envio-sefaz/agente/fila")

    def reservar_lote(self, tamanho: int = 100) -> dict:
        return self._request(
            "POST",
            "/api/nfp/envio-sefaz/agente/reservar-lote",
            body={"tamanho": tamanho},
        )

    def liberar_lote(self, lote_id: str) -> dict:
        return self._request(
            "POST",
            "/api/nfp/envio-sefaz/agente/liberar-lote",
            body={"lote_id": lote_id},
        )

    def aplicar_resultados(self, itens: list[dict]) -> dict:
        return self._request(
            "POST",
            "/api/nfp/envio-sefaz/agente/aplicar-resultados",
            body={"itens": itens},
            timeout=120,
        )

    def liberar_expirados(self) -> dict:
        return self._request("POST", "/api/nfp/envio-sefaz/agente/liberar-expirados", body={})
