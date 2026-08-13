#!/usr/bin/env python3
"""Painel local do agente NFP — tela de controle no navegador (porta 8765).

Uso: python painel.py
Atalho: abrir_painel.bat
"""

from __future__ import annotations

import json
import os
import sys
import threading
import traceback
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "robo"))

from agente_nfp import (  # noqa: E402
    _ler_token,
    apagar_token,
    autenticar,
    carregar_config,
    carregar_config_leve,
    limpar_parar,
    marcar_parar,
    obter_api,
    processar_sessao,
    salvar_credenciais,
)
from carecore_api import CareCoreApi, CareCoreApiError  # noqa: E402
from chrome_local import abrir_chrome_fazenda, status_cdp  # noqa: E402

HOST = "127.0.0.1"
PORTA = int(os.environ.get("CARECORE_NFP_PAINEL_PORTA", "8765"))

_job_lock = threading.Lock()
_job: dict[str, Any] = {
    "status": "idle",
    "mensagem": "Aguardando.",
    "log": [],
}


def _set_job(**kwargs) -> None:
    with _job_lock:
        _job.update(kwargs)
        if "mensagem" in kwargs:
            logs = list(_job.get("log") or [])
            logs.append(str(kwargs["mensagem"]))
            _job["log"] = logs[-40:]


def _snap_job() -> dict[str, Any]:
    with _job_lock:
        return dict(_job)


def _json_bytes(payload: dict) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def _ler_json(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    try:
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _credenciais_ok(cfg: dict[str, Any]) -> bool:
    email = (cfg.get("email") or "").strip().lower()
    senha = cfg.get("senha") or ""
    if not email or not senha or senha == "ALTERE_AQUI":
        return False
    if email.startswith("seu.usuario"):
        return False
    return True


def _status_completo() -> dict[str, Any]:
    cfg = carregar_config_leve()
    cdp = status_cdp(cfg["cdp"])
    fila: dict[str, Any] = {}
    erro_api = None
    logado = False
    if _credenciais_ok(cfg):
        token = _ler_token()
        if not token:
            erro_api = (
                "Senha salva neste PC. Clique em Entrar uma vez para conectar a fila "
                "(nao deixe o painel tentando sozinho)."
            )
        else:
            try:
                api = CareCoreApi(cfg["api_base_url"], token=token)
                fila = api.fila()
                logado = True
                erro_api = None
            except CareCoreApiError as exc:
                if exc.status == 429:
                    erro_api = (
                        "Muitas tentativas de login no CareCore. Feche esta janela, "
                        "aguarde 15 minutos e clique em Entrar uma unica vez com a senha correta."
                    )
                elif exc.status in {401, 403}:
                    apagar_token()
                    erro_api = (
                        "Sessao expirada ou senha antiga neste PC. Digite a senha correta "
                        "e clique em Entrar uma vez."
                    )
                else:
                    erro_api = str(exc)
            except Exception as exc:
                erro_api = str(exc)
    return {
        "ok": True,
        "cdp": cdp,
        "fila": fila,
        "job": _snap_job(),
        "config": {
            "api_base_url": cfg["api_base_url"],
            "email": cfg.get("email") or "",
            "nome_maquina": cfg["nome_maquina"],
            "cdp": cfg["cdp"],
            "config_ok": _credenciais_ok(cfg),
            "logado": logado,
        },
        "erro_api": erro_api,
    }


def _worker_enviar(*, continuo: bool, limite: Optional[int]) -> None:
    try:
        _set_job(status="running", mensagem="Iniciando envio...")
        limpar_parar()
        cfg = carregar_config()
        api = obter_api(cfg)
        _set_job(mensagem="Envio em andamento...")
        processar_sessao(api, cfg, limite=limite, continuo=continuo)
        snap = _snap_job()
        if snap.get("status") == "running":
            _set_job(status="ok", mensagem="Envio concluído.")
    except SystemExit as exc:
        _set_job(status="erro", mensagem=str(exc) or "Falha de configuração.")
    except Exception as exc:
        _set_job(status="erro", mensagem=f"{exc}\n{traceback.format_exc()[-800:]}")


HTML = r"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CareCore+ · Agente NFP SEFAZ</title>
  <style>
    :root {
      --bg: #f1f5f9; --card: #fff; --ink: #0f172a; --muted: #64748b;
      --line: #e2e8f0; --sky: #e0f2fe; --skyb: #bae6fd; --btn: #0f172a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; font-family: "Segoe UI", system-ui, sans-serif;
      background: linear-gradient(180deg, #e0f2fe 0%, var(--bg) 220px); color: var(--ink);
    }
    .wrap { max-width: 920px; margin: 0 auto; padding: 24px 16px 48px; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .sub { color: var(--muted); font-size: 0.92rem; margin-bottom: 18px; }
    .grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); margin-bottom: 14px; }
    .card {
      background: var(--card); border: 1px solid var(--line); border-radius: 16px;
      padding: 14px 16px; box-shadow: 0 1px 2px rgba(15,23,42,.04);
    }
    .card.ok { border-color: #a7f3d0; background: #ecfdf5; }
    .card.warn { border-color: #fde68a; background: #fffbeb; }
    .lbl { font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
    .val { margin-top: 6px; font-size: .95rem; font-weight: 800; }
    .box { margin-top: 12px; }
    .box h2 { font-size: .95rem; margin: 0 0 6px; }
    .box p { margin: 0 0 12px; color: var(--muted); font-size: .9rem; line-height: 1.45; }
    .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .fields { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; margin-bottom: 12px; }
    @media (max-width: 640px) { .fields { grid-template-columns: 1fr; } }
    label.field { display: block; font-size: .82rem; font-weight: 700; color: #334155; }
    input[type=email], input[type=password], input[type=text], input[type=number] {
      display: block; width: 100%; margin-top: 4px; border: 1px solid var(--line);
      border-radius: 12px; padding: 10px 12px; font-size: .9rem;
    }
    input.limite { width: 140px; display: inline-block; }
    button, .chip {
      border: 0; border-radius: 12px; padding: 10px 14px; font-weight: 700; font-size: .9rem; cursor: pointer;
    }
    button.primary { background: var(--btn); color: #fff; }
    button.primary:hover { background: #1e293b; }
    button.secondary { background: #f8fafc; border: 1px solid var(--line); color: var(--ink); }
    button:disabled { opacity: .45; cursor: not-allowed; }
    .chip { background: #f8fafc; border: 1px solid var(--line); color: var(--ink); }
    .msg { margin-top: 12px; padding: 10px 12px; border-radius: 12px; font-size: .88rem; display: none; }
    .msg.show { display: block; }
    .msg.ok { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
    .msg.err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
    .msg.info { background: var(--sky); border: 1px solid var(--skyb); color: #075985; }
    .log {
      margin-top: 10px; font-family: ui-monospace, Consolas, monospace; font-size: 11px;
      color: var(--muted); max-height: 160px; overflow: auto; white-space: pre-wrap;
    }
    .foot { margin-top: 18px; font-size: 11px; color: var(--muted); }
    .badge {
      display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px;
      font-size: 11px; font-weight: 700;
    }
    .badge.on { background: #d1fae5; color: #065f46; }
    .badge.off { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>CareCore+ · Agente NFP SEFAZ</h1>
    <p class="sub">Painel local deste PC. Chrome e envio rodam aqui; a fila fica no CareCore online.</p>

    <div class="card box">
      <h2>Login CareCore
        <span class="badge off" id="badgeLogin">não conectado</span>
      </h2>
      <p>Use o mesmo e-mail e senha do CareCore (ADM Global ou Manutenção). Não precisa editar arquivo.</p>
      <div class="fields">
        <label class="field">E-mail
          <input id="email" type="email" autocomplete="username" placeholder="seu.email@aeb.org.br" />
        </label>
        <label class="field">Senha
          <input id="senha" type="password" autocomplete="current-password" placeholder="Senha do CareCore" />
        </label>
        <label class="field">Nome deste PC (opcional)
          <input id="nomeMaquina" type="text" placeholder="SEDE-PC1" />
        </label>
      </div>
      <div class="row">
        <button class="primary" id="btnLogin" type="button">Entrar / salvar neste PC</button>
        <button class="secondary" id="btnRefresh" type="button">Atualizar status</button>
      </div>
    </div>

    <div class="grid" id="cards"></div>

    <div class="card box">
      <h2>1. Abrir site e fazer login na Fazenda</h2>
      <p>Abre o Chrome do robô no portal da SEFAZ. Faça login/CAPTCHA até a tela <strong>Bem-vindo</strong>.</p>
      <div class="row">
        <button class="primary" id="btnChrome" type="button">Abrir site Fazenda</button>
      </div>
    </div>

    <div class="card box">
      <h2>2. Enviar fila</h2>
      <p>Reserva lotes de 100 no CareCore online e envia neste Chrome. Várias máquinas podem rodar juntas.</p>
      <div class="row" style="margin-bottom:10px">
        <label class="field" style="margin:0">Limite da sessão
          <input id="limite" class="limite" type="number" min="1" placeholder="vazio = 1 lote" />
        </label>
        <button class="chip" type="button" data-lim="100">100</button>
        <button class="chip" type="button" data-lim="200">200</button>
        <button class="chip" type="button" data-lim="500">500</button>
        <button class="chip" type="button" data-lim="">Continuo</button>
      </div>
      <div class="row">
        <button class="primary" id="btnEnviar" type="button">Rodar rotina / enviar fila</button>
        <button class="secondary" id="btnContinuo" type="button">Envio contínuo (noite)</button>
        <button class="secondary" id="btnContador" type="button">Abrir contador</button>
        <button class="secondary" id="btnParar" type="button">Parar</button>
      </div>
      <p class="sub">Continuo: esgota a fila e espera novas leituras. Contador: janela no topo — arraste sobre a Fazenda (abre sozinho ao enviar).</p>
      <div class="log" id="log"></div>
    </div>

    <div class="msg" id="msg"></div>
    <p class="foot" id="foot"></p>
  </div>
  <script>
    const $ = (id) => document.getElementById(id);
    let state = null;
    let msgStickyUntil = 0;

    function showMsg(text, kind, stickyMs) {
      const el = $('msg');
      el.className = 'msg show ' + (kind || 'info');
      el.textContent = text || '';
      if (stickyMs && stickyMs > 0) {
        msgStickyUntil = Date.now() + stickyMs;
      }
    }

    function card(label, value, ok) {
      return `<div class="card ${ok ? 'ok' : 'warn'}"><div class="lbl">${label}</div><div class="val">${value}</div></div>`;
    }

    function render() {
      if (!state) return;
      const cdpOk = !!(state.cdp && state.cdp.ok);
      const fila = state.fila || {};
      const job = state.job || {};
      const cfg = state.config || {};
      const badge = $('badgeLogin');
      badge.textContent = cfg.logado ? 'conectado' : (cfg.config_ok ? 'credencial salva' : 'não conectado');
      badge.className = 'badge ' + (cfg.logado ? 'on' : 'off');
      if (cfg.email && !$('email').value) $('email').value = cfg.email.startsWith('seu.usuario') ? '' : cfg.email;
      if (cfg.nome_maquina && !$('nomeMaquina').value) $('nomeMaquina').value = cfg.nome_maquina;
      $('cards').innerHTML = [
        card('Chrome / CDP', cdpOk ? (state.cdp.browser || 'Ativo') : 'Não conectado', cdpOk),
        card('Pendentes', String(fila.pendentes_total ?? '—'), (fila.pendentes_total || 0) === 0),
        card('Reservados', String(fila.reservados_total ?? '—'), (fila.reservados_total || 0) === 0),
        card('Enviados', String(fila.enviados_total ?? '—'), (fila.enviados_total || 0) > 0),
        card('Job local', job.status || 'idle', job.status !== 'erro'),
        card('Máquina', cfg.nome_maquina || '—', true),
      ].join('');
      $('log').textContent = (job.log || []).slice().reverse().join('\\n');
      const running = job.status === 'running';
      $('btnEnviar').disabled = running || !cfg.config_ok;
      $('btnContinuo').disabled = running || !cfg.config_ok;
      $('btnParar').disabled = !running;
      $('foot').textContent = (cfg.api_base_url || '') + (cfg.email && !cfg.email.startsWith('seu.usuario') ? (' · ' + cfg.email) : '');
      // Nao apagar mensagem operacional (ex.: Abrir Fazenda) no refresh automatico.
      if (Date.now() < msgStickyUntil) return;
      if (!cfg.config_ok) {
        showMsg('Faça login acima com e-mail e senha do CareCore para ver a fila e enviar.', 'info');
      } else if (state.erro_api) {
        showMsg(state.erro_api, 'err');
      }
    }

    async function api(path, opts) {
      const resp = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.erro || ('HTTP ' + resp.status));
      return data;
    }

    async function refresh() {
      try {
        state = await api('/api/status');
        render();
      } catch (e) {
        showMsg(String(e.message || e), 'err');
      }
    }

    $('btnRefresh').onclick = refresh;
    $('btnLogin').onclick = async () => {
      try {
        const data = await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({
            email: $('email').value.trim(),
            senha: $('senha').value,
            nome_maquina: $('nomeMaquina').value.trim(),
          }),
        });
        $('senha').value = '';
        showMsg(data.mensagem || 'Login ok.', 'ok', 15000);
        await refresh();
      } catch (e) { showMsg(String(e.message || e), 'err', 20000); }
    };
    $('btnChrome').onclick = async () => {
      try {
        $('btnChrome').disabled = true;
        showMsg('Abrindo portal da Fazenda...', 'info', 20000);
        const data = await api('/api/abrir-chrome', { method: 'POST', body: '{}' });
        showMsg(data.mensagem || 'Chrome aberto.', 'ok', 30000);
        await refresh();
      } catch (e) {
        showMsg(String(e.message || e), 'err', 20000);
      } finally {
        $('btnChrome').disabled = false;
      }
    };
    $('btnParar').onclick = async () => {
      try {
        const data = await api('/api/parar', { method: 'POST', body: '{}' });
        showMsg(data.mensagem || 'Parada solicitada.', 'info');
        await refresh();
      } catch (e) { showMsg(String(e.message || e), 'err'); }
    };
    $('btnContador').onclick = async () => {
      try {
        const data = await api('/api/contador', { method: 'POST', body: '{}' });
        showMsg(data.mensagem || 'Contador aberto.', 'ok', 8000);
      } catch (e) { showMsg(String(e.message || e), 'err'); }
    };

    async function enviar(continuo) {
      const raw = $('limite').value.trim();
      const body = { continuo: !!continuo };
      if (raw) body.limite = Number(raw);
      try {
        const data = await api('/api/enviar', { method: 'POST', body: JSON.stringify(body) });
        showMsg(data.mensagem || 'Envio iniciado.', 'ok');
        await refresh();
      } catch (e) { showMsg(String(e.message || e), 'err'); }
    }
    $('btnEnviar').onclick = () => enviar(false);
    $('btnContinuo').onclick = () => { $('limite').value = ''; enviar(true); };
    document.querySelectorAll('[data-lim]').forEach((btn) => {
      btn.onclick = () => { $('limite').value = btn.getAttribute('data-lim') || ''; };
    });

    refresh();
    setInterval(refresh, 2500);
  </script>
</body>
</html>
"""


class PainelHandler(BaseHTTPRequestHandler):
    server_version = "CareCoreNfpPainel/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stdout.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_json(self, code: int, payload: dict) -> None:
        self._send(code, _json_bytes(payload), "application/json; charset=utf-8")

    def do_GET(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        if path in {"/", "/index.html"}:
            self._send(200, HTML.encode("utf-8"), "text/html; charset=utf-8")
            return
        if path == "/api/status":
            try:
                self._send_json(200, _status_completo())
            except Exception as exc:
                self._send_json(500, {"ok": False, "erro": str(exc)})
            return
        self._send_json(404, {"ok": False, "erro": "Nao encontrado."})

    def do_POST(self) -> None:  # noqa: N802
        path = urllib.parse.urlparse(self.path).path
        body = _ler_json(self)
        try:
            if path == "/api/login":
                email = str(body.get("email") or "").strip()
                senha = str(body.get("senha") or "")
                nome = str(body.get("nome_maquina") or "").strip() or None
                salvar_credenciais(email=email, senha=senha, nome_maquina=nome)
                cfg = carregar_config()
                try:
                    api = autenticar(cfg)
                except CareCoreApiError as exc:
                    if exc.status == 429:
                        self._send_json(
                            200,
                            {
                                "ok": True,
                                "senha_salva": True,
                                "email": cfg["email"],
                                "mensagem": (
                                    "Senha gravada neste PC. O CareCore bloqueou o login "
                                    "(muitas tentativas). Feche esta janela preta, aguarde "
                                    "15 minutos e clique em Entrar uma unica vez."
                                ),
                            },
                        )
                        return
                    if exc.status in {401, 403}:
                        self._send_json(
                            401,
                            {
                                "ok": False,
                                "senha_salva": True,
                                "erro": (
                                    "Senha gravada neste PC, mas o CareCore recusou o login "
                                    "(e-mail ou senha incorretos). Confira e clique em Entrar "
                                    "uma vez. Se aparecer bloqueio, aguarde 15 minutos."
                                ),
                            },
                        )
                        return
                    raise
                try:
                    api.fila()
                    msg = "Login ok. Fila online conectada."
                except CareCoreApiError as exc:
                    if exc.status == 404:
                        msg = (
                            "Login CareCore ok. Endpoints do agente ainda nao estao "
                            "no servidor online (falta deploy). Voce ja pode Abrir site Fazenda."
                        )
                    else:
                        msg = f"Login CareCore ok. Fila: {exc}"
                except Exception as exc:
                    msg = f"Login CareCore ok. Fila: {exc}"
                self._send_json(200, {"ok": True, "mensagem": msg, "email": cfg["email"]})
                return
            if path == "/api/abrir-chrome":
                cfg = carregar_config_leve()
                out = abrir_chrome_fazenda(cfg["cdp"])
                self._send_json(200, {"ok": True, **out})
                return
            if path == "/api/parar":
                marcar_parar()
                _set_job(mensagem="Parada solicitada pelo painel.")
                self._send_json(200, {"ok": True, "mensagem": "Parada solicitada."})
                return
            if path == "/api/contador":
                from contador_estado import abrir_hud

                pid = abrir_hud()
                if not pid:
                    self._send_json(
                        500,
                        {
                            "ok": False,
                            "erro": "contador_hud.py nao encontrado na pasta do agente.",
                        },
                    )
                    return
                self._send_json(
                    200,
                    {
                        "ok": True,
                        "mensagem": "Contador aberto (janela no topo). Arraste sobre o site da Fazenda.",
                        "pid": pid,
                    },
                )
                return
            if path == "/api/enviar":
                with _job_lock:
                    if _job.get("status") == "running":
                        self._send_json(409, {"ok": False, "erro": "Ja existe envio em andamento."})
                        return
                continuo = bool(body.get("continuo"))
                limite = body.get("limite")
                limite_n = None
                if limite not in (None, ""):
                    limite_n = int(limite)
                    if limite_n < 1:
                        raise ValueError("limite invalido")
                th = threading.Thread(
                    target=_worker_enviar,
                    kwargs={"continuo": continuo, "limite": limite_n},
                    daemon=True,
                )
                th.start()
                self._send_json(200, {"ok": True, "mensagem": "Envio iniciado em segundo plano."})
                return
            self._send_json(404, {"ok": False, "erro": "Nao encontrado."})
        except Exception as exc:
            self._send_json(400, {"ok": False, "erro": str(exc)})


def main() -> int:
    exemplo = ROOT / "config.exemplo.json"
    cfg_path = ROOT / "config.json"
    if not cfg_path.is_file() and exemplo.is_file():
        cfg_path.write_text(exemplo.read_text(encoding="utf-8"), encoding="utf-8")

    server = ThreadingHTTPServer((HOST, PORTA), PainelHandler)
    url = f"http://{HOST}:{PORTA}/"
    print(f"Painel do agente NFP em {url}")
    print("Deixe esta janela aberta enquanto usa o painel. Ctrl+C para encerrar.")
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nPainel encerrado.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
