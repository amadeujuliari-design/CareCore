import asyncio
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from routers import auth


class RedisFake:
    def __init__(self):
        self.valores = {}
        self.expiracoes = {}
        self.erro = False

    async def exists(self, chave):
        if self.erro:
            raise RuntimeError("redis indisponivel")
        return 1 if chave in self.valores else 0

    async def incr(self, chave):
        if self.erro:
            raise RuntimeError("redis indisponivel")
        self.valores[chave] = int(self.valores.get(chave, 0)) + 1
        return self.valores[chave]

    async def expire(self, chave, segundos):
        self.expiracoes[chave] = segundos

    async def set(self, chave, valor, ex=None):
        self.valores[chave] = valor
        self.expiracoes[chave] = ex

    async def delete(self, *chaves):
        for chave in chaves:
            self.valores.pop(chave, None)


class RedisModuloFake:
    def __init__(self, cliente):
        self.cliente = cliente

    def from_url(self, *_args, **_kwargs):
        return self.cliente


def request_fake(ip="10.0.0.1"):
    return SimpleNamespace(headers={}, client=SimpleNamespace(host=ip))


@pytest.fixture
def redis_rate_limit_fake(monkeypatch):
    cliente = RedisFake()
    monkeypatch.setattr(auth, "RATE_LIMIT_REDIS_URL", "redis://localhost:6379/0")
    monkeypatch.setattr(auth, "redis_async", RedisModuloFake(cliente))
    monkeypatch.setattr(auth, "_redis_rate_limit_client", None)
    yield cliente
    monkeypatch.setattr(auth, "_redis_rate_limit_client", None)


def test_limitar_cache_tentativas_remove_chaves_expiradas(monkeypatch):
    agora = datetime(2026, 6, 7, 12, 0, 0)
    monkeypatch.setattr(auth, "LOGIN_JANELA_SEGUNDOS", 900)

    auth._tentativas_login.clear()
    auth._tentativas_login.update({
        "ip:expirado@example.com": [agora - timedelta(seconds=901)],
        "ip:recente@example.com": [agora - timedelta(seconds=100)],
    })

    auth.limitar_cache_tentativas_login(agora)

    assert "ip:expirado@example.com" not in auth._tentativas_login
    assert "ip:recente@example.com" in auth._tentativas_login

    auth._tentativas_login.clear()


def test_limitar_cache_tentativas_preserva_chaves_mais_recentes(monkeypatch):
    agora = datetime(2026, 6, 7, 12, 0, 0)
    monkeypatch.setattr(auth, "LOGIN_JANELA_SEGUNDOS", 900)
    monkeypatch.setattr(auth, "LOGIN_MAX_CHAVES_CACHE", 2)

    auth._tentativas_login.clear()
    auth._tentativas_login.update({
        "ip:antigo@example.com": [agora - timedelta(seconds=500)],
        "ip:medio@example.com": [agora - timedelta(seconds=300)],
        "ip:novo@example.com": [agora - timedelta(seconds=100)],
    })

    auth.limitar_cache_tentativas_login(agora)

    assert set(auth._tentativas_login) == {
        "ip:medio@example.com",
        "ip:novo@example.com",
    }

    auth._tentativas_login.clear()


def test_limitar_cache_tentativas_nao_limita_quando_configurado_zero(monkeypatch):
    agora = datetime(2026, 6, 7, 12, 0, 0)
    monkeypatch.setattr(auth, "LOGIN_JANELA_SEGUNDOS", 900)
    monkeypatch.setattr(auth, "LOGIN_MAX_CHAVES_CACHE", 0)

    auth._tentativas_login.clear()
    auth._tentativas_login.update({
        "ip:um@example.com": [agora - timedelta(seconds=100)],
        "ip:dois@example.com": [agora - timedelta(seconds=100)],
        "ip:tres@example.com": [agora - timedelta(seconds=100)],
    })

    auth.limitar_cache_tentativas_login(agora)

    assert len(auth._tentativas_login) == 3

    auth._tentativas_login.clear()


def test_chave_tentativa_login_redis_nao_expoe_email_ou_ip():
    chave = auth.chave_tentativa_login_redis(
        request_fake("192.168.0.10"),
        "Pessoa.Teste@exemplo.com",
    )

    assert chave.startswith("carecore:login-rate-limit:")
    assert "Pessoa" not in chave
    assert "exemplo.com" not in chave
    assert "192.168.0.10" not in chave


def test_rate_limit_redis_bloqueia_quando_chave_blocked_existe(redis_rate_limit_fake):
    request = request_fake()
    chave = auth.chave_tentativa_login_redis(request, "usuario@example.com")
    redis_rate_limit_fake.valores[f"{chave}:blocked"] = "1"

    with pytest.raises(HTTPException) as erro:
        asyncio.run(auth.verificar_limite_login(request, "usuario@example.com"))

    assert erro.value.status_code == 429


def test_rate_limit_redis_registra_ttl_e_bloqueio(redis_rate_limit_fake, monkeypatch):
    monkeypatch.setattr(auth, "LOGIN_MAX_TENTATIVAS", 2)
    monkeypatch.setattr(auth, "LOGIN_JANELA_SEGUNDOS", 300)
    monkeypatch.setattr(auth, "LOGIN_BLOQUEIO_SEGUNDOS", 600)
    request = request_fake()
    chave = auth.chave_tentativa_login_redis(request, "usuario@example.com")

    asyncio.run(auth.registrar_falha_login(request, "usuario@example.com"))
    asyncio.run(auth.registrar_falha_login(request, "usuario@example.com"))

    assert redis_rate_limit_fake.valores[chave] == 2
    assert redis_rate_limit_fake.expiracoes[chave] == 300
    assert redis_rate_limit_fake.valores[f"{chave}:blocked"] == "1"
    assert redis_rate_limit_fake.expiracoes[f"{chave}:blocked"] == 600


def test_rate_limit_redis_indisponivel_usa_fallback_local(redis_rate_limit_fake, monkeypatch):
    monkeypatch.setattr(auth, "LOGIN_MAX_TENTATIVAS", 2)
    monkeypatch.setattr(auth, "LOGIN_JANELA_SEGUNDOS", 300)
    auth._tentativas_login.clear()
    redis_rate_limit_fake.erro = True
    request = request_fake()

    asyncio.run(auth.registrar_falha_login(request, "usuario@example.com"))

    assert auth.chave_tentativa_login(request, "usuario@example.com") in auth._tentativas_login
    auth._tentativas_login.clear()
