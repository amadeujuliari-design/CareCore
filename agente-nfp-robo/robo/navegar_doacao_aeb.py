#!/usr/bin/env python3
"""Recupera a tela DoacaoNotas com entidade AEB selecionada.

Fluxo observado na NFP (2026-08-07):
  principal.aspx
    → Entidades → Doação de Cupons sem CPF
  DoacaoNotasListagem.aspx
    → Nova Doação
  DoacaoNotas.aspx (sem entidade)
    → CNPJ 61.705.877/0001-72 → Pesquisar → marcar AEB
  Modal instrutivo (chave 44 digitos)
    → Sim / ESC
"""

from __future__ import annotations

import re
from typing import Optional

CNPJ_AEB_DIGITOS = "61705877000172"
CNPJ_AEB_FMT = "61.705.877/0001-72"
URL_DOACAO = (
    "https://www.nfp.fazenda.sp.gov.br/EntidadesFilantropicas/DoacaoNotas.aspx"
)
URL_LISTAGEM = (
    "https://www.nfp.fazenda.sp.gov.br/EntidadesFilantropicas/DoacaoNotasListagem.aspx"
)


def _url_norm(url: str) -> str:
    return (url or "").lower()


async def _texto_corpo(page) -> str:
    try:
        return " ".join(((await page.inner_text("body")) or "").lower().split())
    except Exception:
        return ""


async def bloqueio_doacao_terceiros_sefaz(page) -> bool:
    """Modal que trava a doacao por indicios de notas de terceiros (conta)."""
    texto = await _texto_corpo(page)
    if not texto:
        return False
    if "indícios de que o consumidor" in texto or "indicios de que o consumidor" in texto:
        return True
    if "não eram referentes" in texto or "nao eram referentes" in texto:
        return True
    if "funcionalidade indispon" in texto and (
        "indíc" in texto or "indic" in texto or "referentes" in texto
    ):
        return True
    return False


async def fechar_modal_instrutivo(page) -> bool:
    """Fecha avisos/modais (overlay ui-widget) que bloqueiam o formulario.

    Nao fecha o bloqueio SEFAZ de 'indicios de doacoes de terceiros' — isso exige parar.
    """
    if await bloqueio_doacao_terceiros_sefaz(page):
        print(
            "SEFAZ: funcionalidade bloqueada (indicios de doacoes que nao sao do consumidor). "
            "Nao vou clicar Ok nem reabrir Nova Doacao."
        )
        return False

    fechou = False
    for _ in range(5):
        if await bloqueio_doacao_terceiros_sefaz(page):
            return False
        overlay = False
        try:
            overlay = await page.evaluate(
                "() => !!document.querySelector('.ui-widget-overlay')"
            )
        except Exception:
            overlay = False

        # Botoes oficiais da NFP (IDs estaveis)
        for sel in ("#btnSimAcaoUsuario", "#btnNaoAcaoUsuario", "#btnOkAcaoUsuario"):
            loc = page.locator(sel)
            try:
                if await loc.count() == 0:
                    continue
                # force: o overlay intercepta clique normal
                await loc.first.click(force=True, timeout=1200)
                await page.wait_for_timeout(400)
                fechou = True
                print(f"Recuperacao: fechei modal ({sel}).")
            except Exception:
                continue

        try:
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(250)
        except Exception:
            pass

        ainda = False
        try:
            ainda = await page.evaluate(
                "() => !!document.querySelector('.ui-widget-overlay')"
            )
        except Exception:
            ainda = False
        if not overlay and not ainda:
            break
        if not ainda:
            break
    return fechou


async def _tem_campo_chave(page) -> bool:
    candidatos = [
        page.locator('input[maxlength="44"]'),
        page.locator('input[maxlength="55"]'),
        page.get_by_label(re.compile(r"chave[\s\-]*de[\s\-]*acesso", re.I)),
        page.locator('input[id*="chave" i]'),
        page.locator('input[name*="chave" i]'),
    ]
    for loc in candidatos:
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=400):
                return True
        except Exception:
            continue
    return False


async def _entidade_aeb_selecionada(page) -> bool:
    """True se o CNPJ da AEB ja esta no campo entidade selecionada."""
    try:
        valor = await page.locator("#txtCNPJEntidadeFilantropica").input_value()
    except Exception:
        valor = ""
    digitos = re.sub(r"\D", "", valor or "")
    if digitos == CNPJ_AEB_DIGITOS:
        return True
    if valor and "selecione" in valor.lower():
        return False
    # Fallback: radio marcado na grade
    try:
        return bool(
            await page.evaluate(
                """(cnpj) => {
                  for (const r of document.querySelectorAll('input[type=radio]')) {
                    if (!r.checked) continue;
                    const ctx = ((r.closest('tr') || r.parentElement || document.body).innerText || '').toUpperCase();
                    if (ctx.includes('AEB') || ctx.includes(cnpj) || ctx.includes('61.705.877')) return true;
                  }
                  return false;
                }""",
                CNPJ_AEB_DIGITOS,
            )
        )
    except Exception:
        return False


async def tela_pronta_para_enviar(page) -> bool:
    await fechar_modal_instrutivo(page)
    if not await _tem_campo_chave(page):
        return False
    return await _entidade_aeb_selecionada(page)


async def sessao_nfp_caiu(page) -> bool:
    """True somente quando o portal pede login de novo (nao recuperavel sozinho)."""
    try:
        url = _url_norm(page.url or "")
    except Exception:
        url = ""
    if "sso.acesso.gov" in url or "acesso.gov.br" in url:
        return True
    if "login" in url and "nfce" not in url:
        return True
    try:
        texto = " ".join(((await page.inner_text("body")) or "").lower().split())
    except Exception:
        texto = ""
    if "acesse sua conta gov.br" in texto or "entrar com gov.br" in texto:
        return True
    if "efetuar login" in texto and "doacaonotas" not in url:
        return True
    return False


async def _clicar_menu_doacao_sem_cpf(page) -> bool:
    """principal.aspx → Entidades → Doação de Cupons sem CPF."""
    # Hover / click Entidades
    for loc in (
        page.get_by_role("link", name=re.compile(r"^entidades$", re.I)),
        page.locator("a", has_text=re.compile(r"^entidades$", re.I)),
        page.locator("td", has_text=re.compile(r"^entidades$", re.I)),
        page.locator("span", has_text=re.compile(r"^entidades$", re.I)),
    ):
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=800):
                await alvo.hover(timeout=2000)
                await page.wait_for_timeout(400)
                await alvo.click(timeout=2000)
                await page.wait_for_timeout(500)
                break
        except Exception:
            continue

    for loc in (
        page.get_by_role("link", name=re.compile(r"doa[cç][aã]o\s+de\s+cupons\s+sem\s+cpf", re.I)),
        page.locator("a", has_text=re.compile(r"doa[cç][aã]o\s+de\s+cupons\s+sem\s+cpf", re.I)),
        page.locator("td", has_text=re.compile(r"doa[cç][aã]o\s+de\s+cupons\s+sem\s+cpf", re.I)),
    ):
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=1500):
                await alvo.click(timeout=3000)
                await page.wait_for_timeout(1200)
                print("Recuperacao: Entidades → Doação de Cupons sem CPF.")
                return True
        except Exception:
            continue

    # Fallback: ir direto na listagem
    try:
        await page.goto(URL_LISTAGEM, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(1000)
        print("Recuperacao: abri DoacaoNotasListagem via URL.")
        return True
    except Exception as exc:
        print(f"Recuperacao: falha ao abrir listagem ({exc})")
        return False


async def _clicar_nova_doacao(page) -> bool:
    for loc in (
        page.get_by_role("button", name=re.compile(r"nova\s*doa[cç][aã]o", re.I)),
        page.locator('input[type="submit"][value*="Nova Doação" i]'),
        page.locator('input[value*="Nova Doação" i]'),
        page.locator('input[type="button"][value*="Nova Doação" i]'),
        page.locator("a", has_text=re.compile(r"nova\s*doa[cç][aã]o", re.I)),
    ):
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=1000):
                await alvo.click(timeout=3000)
                await page.wait_for_timeout(1200)
                print("Recuperacao: cliquei em Nova Doação.")
                return True
        except Exception:
            continue
    try:
        await page.goto(URL_DOACAO, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(1000)
        print("Recuperacao: abri DoacaoNotas via URL.")
        return True
    except Exception as exc:
        print(f"Recuperacao: falha Nova Doação/URL ({exc})")
        return False


async def _pesquisar_e_selecionar_aeb(page) -> bool:
    """Preenche #txtCNPJEntidade, clica #btnBuscar e marca AEB (#rdbSelecao)."""
    await fechar_modal_instrutivo(page)

    if await _entidade_aeb_selecionada(page):
        print("Recuperacao: AEB ja estava selecionada.")
        return True

    # Por CNPJ (ID estavel)
    try:
        await page.locator("#rblModoPesquisa_0").check(force=True)
    except Exception:
        try:
            await page.locator("#rblModoPesquisa_0").click(force=True)
        except Exception as exc:
            print(f"Recuperacao: aviso ao marcar Por CNPJ ({exc})")

    campo = page.locator("#txtCNPJEntidade")
    if await campo.count() == 0:
        print("Recuperacao: campo #txtCNPJEntidade nao encontrado.")
        return False

    try:
        await campo.click(force=True, timeout=3000)
        # Limpa e digita SO digitos — a mascara SetAutomaticMaskCNPJ formata
        await campo.evaluate("el => { el.value = ''; el.focus(); }")
        for ch in CNPJ_AEB_DIGITOS:
            await page.keyboard.type(ch, delay=20)
        valor = await campo.input_value()
        digitos = re.sub(r"\D", "", valor or "")
        print(f"Recuperacao: CNPJ no campo = {valor!r}")
        if digitos != CNPJ_AEB_DIGITOS:
            # fallback sem mascara via JS + eventos
            await campo.evaluate(
                """(args) => {
                  const el = document.querySelector(args.sel);
                  if (!el) return;
                  el.value = args.fmt;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  if (typeof SetAutomaticMaskCNPJ === 'function') {
                    try { SetAutomaticMaskCNPJ(el, { keyCode: 0 }); } catch (e) {}
                  }
                }""",
                {"sel": "#txtCNPJEntidade", "fmt": CNPJ_AEB_FMT},
            )
            valor = await campo.input_value()
            digitos = re.sub(r"\D", "", valor or "")
            print(f"Recuperacao: CNPJ apos fallback = {valor!r}")
        if digitos != CNPJ_AEB_DIGITOS:
            print("Recuperacao: CNPJ nao ficou correto no campo.")
            return False
    except Exception as exc:
        print(f"Recuperacao: falha ao preencher CNPJ ({exc})")
        return False

    btn = page.locator("#btnBuscar")
    if await btn.count() == 0:
        print("Recuperacao: #btnBuscar nao encontrado.")
        return False
    try:
        await btn.click(force=True, timeout=5000)
        await page.wait_for_timeout(2000)
        print("Recuperacao: cliquei em Pesquisar (#btnBuscar).")
    except Exception as exc:
        print(f"Recuperacao: falha ao clicar Pesquisar ({exc})")
        return False

    await fechar_modal_instrutivo(page)

    # Radio da grade (id rdbSelecao na linha AEB)
    marcado = False
    try:
        marcado = bool(
            await page.evaluate(
                """(cnpj) => {
                  for (const row of document.querySelectorAll('tr')) {
                    const t = (row.innerText || '').toUpperCase();
                    if (!t.includes('AEB') && !t.includes(cnpj) && !t.includes('61.705.877')) continue;
                    const radio = row.querySelector('input[type=radio]');
                    if (!radio) continue;
                    radio.click();
                    radio.checked = true;
                    radio.dispatchEvent(new Event('click', { bubbles: true }));
                    radio.dispatchEvent(new Event('change', { bubbles: true }));
                    return true;
                  }
                  const rdb = document.getElementById('rdbSelecao');
                  if (rdb) { rdb.click(); return true; }
                  return false;
                }""",
                CNPJ_AEB_DIGITOS,
            )
        )
    except Exception as exc:
        print(f"Recuperacao: falha ao marcar radio AEB ({exc})")
        marcado = False

    if not marcado:
        # Playwright click no radio
        try:
            loc = page.locator("#rdbSelecao")
            if await loc.count():
                await loc.first.click(force=True)
                marcado = True
        except Exception:
            pass

    await page.wait_for_timeout(1000)
    if await _entidade_aeb_selecionada(page):
        print("Recuperacao: entidade AEB selecionada.")
        return True

    if marcado:
        print("Recuperacao: radio clicado, aguardando confirmacao do CNPJ entidade...")
        for _ in range(8):
            await page.wait_for_timeout(400)
            if await _entidade_aeb_selecionada(page):
                print("Recuperacao: entidade AEB selecionada.")
                return True

    print("Recuperacao: AEB nao ficou selecionada apos pesquisa.")
    return False


async def garantir_tela_doacao_aeb(page, *, tentativas: int = 6) -> bool:
    """Garante DoacaoNotas com AEB pronta para preencher chave."""
    for n in range(1, tentativas + 1):
        # Bloqueio de conta SEFAZ: nao clicar menu/Nova Doacao (piora o bloqueio).
        if await bloqueio_doacao_terceiros_sefaz(page):
            print(
                "Recuperacao: abortada — SEFAZ bloqueou doacao (indicios de notas de terceiros)."
            )
            return False

        await fechar_modal_instrutivo(page)
        if await bloqueio_doacao_terceiros_sefaz(page):
            return False

        if await tela_pronta_para_enviar(page):
            if n > 1:
                print("Recuperacao: tela DoacaoNotas + AEB ok.")
            return True

        url = _url_norm(page.url)
        print(f"Recuperacao [{n}/{tentativas}]: url={page.url}")

        # Login / SSO — nao tenta recuperar sozinho
        if "login" in url or "sso.acesso.gov" in url or "acesso.gov.br" in url:
            print("Recuperacao: sessao/login — e preciso autenticar manualmente.")
            return False

        if "principal.aspx" in url or "bem-vindo ao sistema" in (await _texto_corpo(page)):
            await _clicar_menu_doacao_sem_cpf(page)
            continue

        if "doacaonotaslistagem" in url or "listagem" in url:
            await _clicar_nova_doacao(page)
            continue

        if "doacaonotas" in url:
            # Formulario aberto mas sem AEB / com modal
            if await _tem_campo_chave(page):
                ok = await _pesquisar_e_selecionar_aeb(page)
                if ok and await tela_pronta_para_enviar(page):
                    return True
            else:
                await _clicar_nova_doacao(page)
            continue

        # Outra pagina NFP: tenta menu Entidades
        await _clicar_menu_doacao_sem_cpf(page)

    print("Recuperacao: esgotaram as tentativas.")
    return await tela_pronta_para_enviar(page)
