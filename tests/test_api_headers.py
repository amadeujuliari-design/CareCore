import asyncio
import logging

from fastapi import Request, Response

import main


def montar_request(path="/api/health", headers=None, method="GET"):
    raw_headers = [
        (chave.lower().encode("latin-1"), valor.encode("latin-1"))
        for chave, valor in (headers or {}).items()
    ]

    return Request({
        "type": "http",
        "method": method,
        "path": path,
        "headers": raw_headers,
        "scheme": "http",
        "server": ("testserver", 80),
        "client": ("127.0.0.1", 12345),
    })


def executar_middleware(request, response=None):
    async def call_next(_request):
        return response or Response(status_code=200)

    return asyncio.run(main.security_headers_carecore(request, call_next))


def executar_cors_middleware(request, response=None):
    async def call_next(_request):
        return response or Response(status_code=200)

    return asyncio.run(main.cors_seguro_carecore(request, call_next))


def test_security_headers_sao_adicionados_em_resposta_api():
    response = executar_middleware(montar_request("/api/health"))

    assert response.headers["X-CareCore-Request-Id"]
    assert float(response.headers["X-CareCore-Process-Time-Ms"]) >= 0
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
    assert response.headers["Permissions-Policy"] == "geolocation=(), payment=(), usb=(), serial=()"
    assert response.headers["Cache-Control"] == "no-store"


def test_request_id_recebido_e_preservado():
    request = montar_request(
        "/api/health",
        headers={"X-CareCore-Request-Id": "req-test-123"},
    )

    response = executar_middleware(request)

    assert response.headers["X-CareCore-Request-Id"] == "req-test-123"


def test_cache_control_nao_sobrescreve_rota_de_arquivo():
    response = executar_middleware(montar_request("/api/arquivos/documentos/foto.png"))

    assert "Cache-Control" not in response.headers


def test_requisicao_lenta_gera_log(monkeypatch, caplog):
    monkeypatch.setattr(main, "SLOW_REQUEST_MS", 1000)
    tempos = iter([10.0, 12.5])
    monkeypatch.setattr(main.time, "perf_counter", lambda: next(tempos))
    caplog.set_level(logging.WARNING, logger="carecore.api")

    response = executar_middleware(montar_request("/api/health"))

    assert response.headers["X-CareCore-Process-Time-Ms"] == "2500.0"
    registro = caplog.records[-1]
    assert registro.message == "Requisição lenta na API"
    assert registro.path == "/api/health"
    assert registro.method == "GET"
    assert registro.status_code == 200
    assert registro.duration_ms == 2500.0


def test_cors_preflight_permite_request_id(monkeypatch):
    monkeypatch.setattr(main, "ORIGENS_PERMITIDAS", {"http://localhost:5173"})
    request = montar_request(
        "/api/health",
        headers={"Origin": "http://localhost:5173"},
        method="OPTIONS",
    )

    response = executar_cors_middleware(request)

    assert response.status_code == 204
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:5173"
    assert response.headers["Access-Control-Allow-Credentials"] == "true"
    assert "X-CareCore-Request-Id" in response.headers["Access-Control-Allow-Headers"]
    assert response.headers["Access-Control-Expose-Headers"] == (
        "X-CareCore-Request-Id, X-CareCore-Process-Time-Ms"
    )
    assert response.headers["Vary"] == "Origin"


def test_cors_nao_reflete_origem_nao_permitida(monkeypatch):
    monkeypatch.setattr(main, "ORIGENS_PERMITIDAS", {"http://localhost:5173"})
    request = montar_request(
        "/api/health",
        headers={"Origin": "https://exemplo-nao-permitido.com"},
    )

    response = executar_cors_middleware(request)

    assert "Access-Control-Allow-Origin" not in response.headers
    assert "Access-Control-Expose-Headers" not in response.headers


def test_cors_regex_extra_permite_origem_compativel(monkeypatch):
    monkeypatch.setattr(main, "ORIGENS_PERMITIDAS", set())
    monkeypatch.setattr(main, "ORIGEM_EXTRA_REGEX", r"^https://preview-[a-z]+\.carecore\.app$")
    request = montar_request(
        "/api/health",
        headers={"Origin": "https://preview-demo.carecore.app"},
    )

    response = executar_cors_middleware(request)

    assert response.headers["Access-Control-Allow-Origin"] == "https://preview-demo.carecore.app"


def test_cors_regex_extra_invalida_nao_quebra_requisicao(monkeypatch, caplog):
    monkeypatch.setattr(main, "ORIGENS_PERMITIDAS", set())
    monkeypatch.setattr(main, "ORIGEM_EXTRA_REGEX", "[regex-invalida")
    caplog.set_level(logging.WARNING, logger="carecore.api")
    request = montar_request(
        "/api/health",
        headers={"Origin": "https://preview-demo.carecore.app"},
    )

    response = executar_cors_middleware(request)

    assert response.status_code == 200
    assert "Access-Control-Allow-Origin" not in response.headers
    assert caplog.records[-1].message == "Regex CORS inválida ignorada"
