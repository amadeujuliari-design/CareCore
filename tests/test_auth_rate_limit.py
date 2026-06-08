from datetime import datetime, timedelta

from routers import auth


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
