#!/usr/bin/env python3
"""
Robo NFP — fase 1: PREENCHE a chave de acesso e NAO envia.

Fluxo recomendado (evita travar no gov.br):
  1) Feche o Chrome
  2) scripts/nfp_robo/abrir_chrome_debug.bat
  3) Login + CAPTCHA ate a tela de doacao (Chrome normal)
  4) scripts/nfp_robo/rodar_preencher.bat  (conecta na porta 9222)

NUNCA clica em Registrar Doacao / Enviar nesta fase.

Abrir o Chrome pelo Playwright (--channel chrome) costuma fazer o
gov.br ficar no spinner depois do CPF — use o fluxo CDP acima.
"""

from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ler_planilha_chaves import ler_chaves_xlsx  # noqa: E402

URL_PADRAO = "https://www.nfp.fazenda.sp.gov.br/"
PLANILHA_PADRAO = Path.home() / "Downloads" / "Chave-de-acesso lançamento das notas na sefaz.xlsx"
CDP_PADRAO = "http://127.0.0.1:9222"

# Termos tipicos do botao de envio — usados so para GARANTIR que nao clicamos neles.
BOTOES_ENVIO_PROIBIDOS = re.compile(
    r"registrar\s*doa[cç][aã]o|enviar|confirmar\s*doa",
    re.I,
)


async def escolher_pagina(contexto):
    """Prefere a aba do NFP / formulario de doacao."""
    pages = list(contexto.pages)
    if not pages:
        return await contexto.new_page()

    def score(url: str) -> int:
        u = (url or "").lower()
        pts = 0
        if "nfp.fazenda" in u or "fazenda.sp.gov" in u:
            pts += 5
        if "doacaonotas.aspx" in u and "listagem" not in u:
            pts += 12
        if "doacaonotas" in u:
            pts += 8
        if "doacaonotaslistagem" in u or "listagem" in u:
            pts += 4
        if "listagemnotaentidade" in u or "cadastronotaentidade" in u:
            pts += 6
        if "doa" in u or "entidade" in u:
            pts += 3
        if "principal.aspx" in u:
            pts += 1
        if "sso.acesso.gov" in u or "login" in u:
            pts -= 2
        return pts

    pages_ord = sorted(pages, key=lambda p: score(p.url), reverse=True)
    return pages_ord[0]


async def listar_inputs(page) -> None:
    infos = await page.evaluate(
        """() => Array.from(document.querySelectorAll('input, textarea'))
          .slice(0, 40)
          .map((el, i) => ({
            i,
            tag: el.tagName,
            type: el.type || '',
            id: el.id || '',
            name: el.name || '',
            maxLength: el.maxLength,
            placeholder: el.placeholder || '',
            aria: el.getAttribute('aria-label') || '',
            visible: !!(el.offsetWidth || el.offsetHeight),
          }))"""
    )
    print("\n--- Campos detectados na pagina ---")
    for info in infos:
        print(
            f"  [{info['i']}] type={info['type']!r} id={info['id']!r} "
            f"name={info['name']!r} maxLength={info['maxLength']} "
            f"ph={info['placeholder']!r} visible={info['visible']}"
        )
    print("--- fim ---\n")


async def localizar_campo_chave(page):
    """Tenta varios seletores comuns do formulario NFP."""
    candidatos = [
        page.get_by_label(re.compile(r"chave[\s\-]*de[\s\-]*acesso", re.I)),
        page.get_by_role("textbox", name=re.compile(r"chave", re.I)),
        page.locator('input[maxlength="44"]'),
        page.locator('input[maxlength="50"]'),
        page.locator('input[id*="chave" i]'),
        page.locator('input[name*="chave" i]'),
        page.locator('input[id*="Chave" i]'),
        page.locator('input[name*="Chave" i]'),
        page.locator("input[type='text']").filter(
            has=page.locator("xpath=ancestor::*[contains(., 'Chave') or contains(., 'chave')]")
        ),
    ]
    for loc in candidatos:
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=800):
                return alvo
        except Exception:
            continue
    return None


async def preencher_chave(page, chave: str) -> bool:
    campo = await localizar_campo_chave(page)
    if campo is None:
        print("ERRO: nao achei o campo Chave-de-acesso.")
        await listar_inputs(page)
        print("Dica: confirme que esta na tela de doacao com o campo visivel.")
        return False

    await campo.click()
    await campo.fill("")
    await campo.fill(chave)
    # Dispara eventos que ASP.NET / validadores costumam ouvir
    await campo.dispatch_event("input")
    await campo.dispatch_event("change")
    await campo.blur()

    atual = (await campo.input_value()).strip()
    ok = re.sub(r"\D", "", atual) == chave
    if ok:
        print(f"OK: campo preenchido com {chave}")
    else:
        print(f"AVISO: valor no campo ficou {atual!r} (esperado {chave})")
    return ok


async def garantir_nao_enviar(page) -> None:
    """Sanidade: se o usuario pedir envio no futuro, este helper existe para bloquear."""
    botoes = page.get_by_role("button", name=BOTOES_ENVIO_PROIBIDOS)
    n = await botoes.count()
    if n:
        print(f"(modo seguro) {n} botao(oes) de envio detectado(s) — NAO serao clicados.")


async def clicar_registrar(page) -> bool:
    """Clica em Registrar Doacao / Salvar Nota. Usar so em teste explicito."""
    candidatos = [
        page.locator('input[type="submit"][value*="Registrar Doação" i]'),
        page.locator('input[value*="Registrar Doação" i]'),
        page.get_by_role("button", name=re.compile(r"registrar\s*doa[cç][aã]o", re.I)),
        page.get_by_role("button", name=re.compile(r"salvar\s*nota", re.I)),
        page.locator('input[type="submit"][value*="Registrar" i]'),
        page.locator('input[type="button"][value*="Registrar" i]'),
        page.locator('input[type="submit"][value*="Salvar" i]'),
        page.locator('a', has_text=re.compile(r"registrar\s*doa", re.I)),
    ]
    for loc in candidatos:
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=800):
                await alvo.scroll_into_view_if_needed()
                await alvo.click(timeout=5000)
                print("Cliquei no botao de envio. Aguarde o retorno do site...")
                try:
                    await page.wait_for_load_state("domcontentloaded", timeout=15000)
                except Exception:
                    pass
                await page.wait_for_timeout(2000)
                return True
        except Exception:
            continue
    print("ERRO: nao achei botao Registrar Doacao / Salvar Nota.")
    return False


async def resumir_retorno(page) -> str:
    cls = await classificar_retorno_pagina(page)
    return (
        f"tipo={cls.tipo} | status_carecore={cls.status_carecore} | "
        f"msg={cls.mensagem} | trecho={cls.trecho[:200]}"
    )


async def _texto_modais_visiveis(page) -> str:
    """Prioriza texto de modais/dialogs (sucesso e erro ficam aqui na NFP)."""
    try:
        partes = await page.evaluate(
            """() => {
              const sels = [
                '[role="dialog"]',
                '.modal',
                '.ui-dialog',
                '.popup',
                '[id*="pnlMensagem"]',
                '[id*="pnlErro"]',
                '[id*="Modal"]',
                '[class*="mensagem" i]',
                '[class*="aviso" i]',
              ];
              const out = [];
              const seen = new Set();
              for (const s of sels) {
                for (const el of document.querySelectorAll(s)) {
                  const style = window.getComputedStyle(el);
                  if (style && (style.display === "none" || style.visibility === "hidden")) continue;
                  const t = (el.innerText || el.textContent || "").trim();
                  if (!t || t.length < 8 || seen.has(t)) continue;
                  const compact = t.replace(/\\s+/g, " ");
                  if (/^(Erro|Aviso|Mensagem)?\\s*close?\\s*Ok$/i.test(compact)) continue;
                  seen.add(t);
                  out.push(compact);
                }
              }
              return out;
            }"""
        )
    except Exception:
        return ""
    return " | ".join(partes or [])


async def coletar_texto_retorno(page) -> str:
    modal = await _texto_modais_visiveis(page)
    body = ""
    try:
        body = await page.inner_text("body")
    except Exception:
        body = ""
    if modal and body:
        return f"{modal}\n{body}"
    return modal or body


async def classificar_retorno_pagina(page) -> "ClassificacaoRetorno":
    from retorno_nfp import classificar_texto_retorno

    url = page.url
    try:
        texto = await coletar_texto_retorno(page)
    except Exception as exc:
        from retorno_nfp import ClassificacaoRetorno

        return ClassificacaoRetorno(
            tipo="inconclusivo",
            mensagem=f"Não li o retorno: {exc}",
            status_carecore="pendente",
        )
    return classificar_texto_retorno(texto, url=url)


async def aguardar_classificacao_retorno(
    page,
    *,
    timeout_ms: int = 12000,
    intervalo_ms: int = 350,
) -> "ClassificacaoRetorno":
    """Espera o modal/mensagem da NFP antes de classificar (evita falso inconclusivo)."""
    from retorno_nfp import ClassificacaoRetorno

    tentativas = max(1, int(timeout_ms / max(intervalo_ms, 50)))
    ultima = ClassificacaoRetorno(
        tipo="inconclusivo",
        mensagem="Retorno não reconhecido — revisar manualmente.",
        status_carecore="pendente",
    )
    for _ in range(tentativas):
        ultima = await classificar_retorno_pagina(page)
        if ultima.tipo != "inconclusivo":
            return ultima
        await page.wait_for_timeout(intervalo_ms)
    return ultima


async def fechar_modal_mensagem(page) -> bool:
    """Fecha modal Erro/Aviso/Mensagem clicando em Ok / close (sem ESC cego).

    Nao fecha o bloqueio SEFAZ de indicios de notas de terceiros.
    """
    try:
        from navegar_doacao_aeb import bloqueio_doacao_terceiros_sefaz

        if await bloqueio_doacao_terceiros_sefaz(page):
            print("Modal SEFAZ de bloqueio de conta — nao clicar Ok.")
            return False
    except Exception:
        pass

    try:
        tem_modal = await page.evaluate(
            """() => {
              const sels = ['[role="dialog"]', '.modal', '.ui-dialog', '.popup'];
              for (const s of sels) {
                for (const el of document.querySelectorAll(s)) {
                  const style = window.getComputedStyle(el);
                  if (style && style.display !== 'none' && style.visibility !== 'hidden') {
                    const t = (el.innerText || '').trim();
                    if (t.length > 5) return true;
                  }
                }
              }
              return false;
            }"""
        )
    except Exception:
        tem_modal = False

    candidatos = [
        page.get_by_role("button", name=re.compile(r"^ok$", re.I)),
        page.locator('input[type="button"][value="Ok"]'),
        page.locator('input[type="button"][value="OK"]'),
        page.locator('button:has-text("Ok")'),
        page.locator('.modal button', has_text=re.compile(r"^ok$", re.I)),
        page.locator('[role="dialog"] button', has_text=re.compile(r"^ok$", re.I)),
        page.locator("a", has_text=re.compile(r"^ok$", re.I)),
    ]
    for loc in candidatos:
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=400):
                await alvo.click(timeout=2500)
                await page.wait_for_timeout(400)
                return True
        except Exception:
            continue

    if not tem_modal:
        return False

    try:
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(300)
        return True
    except Exception:
        return False


async def conectar_navegador(p, args):
    usar_cdp = bool(args.cdp)
    if usar_cdp:
        print(f"Conectando no Chrome existente ({args.cdp})...")
        try:
            browser = await p.chromium.connect_over_cdp(args.cdp)
        except Exception as exc:
            print(f"ERRO ao conectar via CDP: {exc}")
            print("Feche o Chrome, rode abrir_chrome_debug.bat, faca login e tente de novo.")
            return None, None, None
        contexto = browser.contexts[0] if browser.contexts else await browser.new_context()
        page = await escolher_pagina(contexto)
        print(f"Aba em uso: {page.url}")
        return browser, page, True

    print(
        "AVISO: abrir o Chrome pelo Playwright costuma travar o login gov.br.\n"
        "Prefira: abrir_chrome_debug.bat + este script com --cdp.\n"
    )
    browser = await p.chromium.launch(headless=False, channel=args.channel or None)
    contexto = await browser.new_context()
    page = await contexto.new_page()
    await page.goto(args.url, wait_until="domcontentloaded")
    return browser, page, False


async def rodar(args: argparse.Namespace) -> int:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Instale as dependencias:")
        print("  pip install -r scripts/nfp_robo/requirements.txt")
        print("  playwright install chromium")
        return 1

    if args.chave:
        chave_unica = re.sub(r"\D", "", args.chave)
        if len(chave_unica) != 44:
            print(f"Chave invalida (precisa 44 digitos): {args.chave!r}")
            return 1
        fila = [{"chave": chave_unica, "data": "", "valor": "", "local": "", "entidade": ""}]
        inicio = 0
        print(f"Modo chave unica: {chave_unica}")
    else:
        planilha = Path(args.planilha)
        registros = ler_chaves_xlsx(planilha)
        if not registros:
            print(f"Nenhuma chave de 44 digitos em: {planilha}")
            return 1
        inicio = max(0, int(args.inicio))
        if inicio >= len(registros):
            print(f"--inicio {inicio} fora do range (0..{len(registros) - 1})")
            return 1
        fila = registros[inicio:]
        print(f"Planilha: {planilha}")
        print(f"Chaves carregadas: {len(registros)} | a partir do indice {inicio}: {len(fila)}")

    if args.enviar:
        print("MODO: preencher + ENVIAR (teste).")
    else:
        print("MODO: somente preencher — NAO clica em Registrar/Salvar.\n")

    async with async_playwright() as p:
        browser, page, usar_cdp = await conectar_navegador(p, args)
        if page is None:
            return 1

        # Uma chave, sem prompt (validacao rapida)
        if args.chave and args.auto:
            ok = await preencher_chave(page, fila[0]["chave"])
            if not ok:
                return 1
            if args.enviar:
                enviado = await clicar_registrar(page)
                if not enviado:
                    return 1
                print(await resumir_retorno(page))
            else:
                print("Preenchido. Confira no navegador (sem envio).")
            return 0

        print("=" * 60)
        print("1) Faca login no NFP e passe no CAPTCHA (no Chrome aberto)")
        print("2) Pare na tela de doacao (campo Chave-de-acesso visivel)")
        print("3) Volte aqui e pressione Enter para preencher a 1a chave")
        print("   Comandos: Enter=preencher | s=pular | d=dump campos | q=sair")
        print("=" * 60)

        idx = 0
        while idx < len(fila):
            if usar_cdp and browser.contexts:
                page = await escolher_pagina(browser.contexts[0])

            item = fila[idx]
            chave = item["chave"]
            meta = " | ".join(
                x for x in [item.get("data"), item.get("valor"), item.get("local")] if x
            )
            prompt = f"\n[{inicio + idx + 1}/{inicio + len(fila)}] {chave}"
            if meta:
                prompt += f"\n  ({meta})"
            prompt += "\n> "
            try:
                cmd = input(prompt).strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("\nEncerrado.")
                break

            if cmd in {"q", "quit", "sair"}:
                break
            if cmd in {"s", "skip", "pular"}:
                print("Pulada.")
                idx += 1
                continue
            if cmd in {"d", "dump"}:
                await listar_inputs(page)
                continue

            if not args.enviar:
                await garantir_nao_enviar(page)
            ok = await preencher_chave(page, chave)
            if ok and args.enviar:
                await clicar_registrar(page)
            if ok:
                print("Confira no navegador. Se estiver certo, Enter para a proxima.")
                idx += 1
            else:
                print("Ajuste a tela e tente de novo (Enter), ou d para listar campos.")

        if not usar_cdp:
            print("\nFechando navegador em 3s...")
            await page.wait_for_timeout(3000)
            await browser.close()
        else:
            print("\nSessao CDP mantida (Chrome do usuario).")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Preenche chave NFP (validacao do robo)."
    )
    parser.add_argument(
        "--planilha",
        default=str(PLANILHA_PADRAO),
        help="Caminho do XLSX com coluna Chave",
    )
    parser.add_argument(
        "--chave",
        default="",
        help="Testa uma unica chave de 44 digitos (ignora planilha)",
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Com --chave: preenche na hora, sem prompt no terminal",
    )
    parser.add_argument(
        "--enviar",
        action="store_true",
        help="Apos preencher, clica em Registrar Doacao / Salvar Nota",
    )
    parser.add_argument(
        "--inicio",
        type=int,
        default=0,
        help="Indice 0-based da primeira chave a usar",
    )
    parser.add_argument(
        "--url",
        default=URL_PADRAO,
        help="URL inicial quando o Chromium e aberto pelo script",
    )
    parser.add_argument(
        "--cdp",
        default="",
        help=f"Ex.: {CDP_PADRAO} para usar Chrome ja logado (recomendado)",
    )
    parser.add_argument(
        "--channel",
        default="",
        help="Opcional: chrome | msedge (evite para login gov.br)",
    )
    return asyncio.run(rodar(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
