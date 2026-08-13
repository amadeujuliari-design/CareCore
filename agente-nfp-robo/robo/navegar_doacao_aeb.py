#!/usr/bin/env python3
"""Posiciona a tela de cadastro de cupons como representante da entidade (AEB).

Fluxo oficial (prints 2026-08-12) — NÃO usar doação de consumidor:
  principal.aspx
    → Entidades → Cadastramento de Cupons
  CadastroNotaEntidadeAviso.aspx
    → Prosseguir  (Voltar = volta à doação de consumidor — evitar)
  Listagem de Notas
    → combo Entidade = ASSOCIACAO EVANGELICA BENEFICENTE
    → Nova Nota
  ListagemNotaEntidade.aspx (Cadastro de doação de documento fiscal)
    → Chave-de-acesso → Salvar Nota
"""

from __future__ import annotations

import re

CNPJ_AEB_DIGITOS = "61705877000172"
CNPJ_AEB_FMT = "61.705.877/0001-72"
NOME_AEB_MARKERS = (
    "ASSOCIACAO EVANGELICA BENEFICENTE",
    "ASSOCIAÇÃO EVANGÉLICA BENEFICENTE",
    "ASSOCIACAO EVANGÉLICA BENEFICENTE",
    "ASSOCIAÇÃO EVANGELICA BENEFICENTE",
)

URL_AVISO = (
    "https://www.nfp.fazenda.sp.gov.br/EntidadesFilantropicas/CadastroNotaEntidadeAviso.aspx"
)
URL_CADASTRO = (
    "https://www.nfp.fazenda.sp.gov.br/EntidadesFilantropicas/CadastroNotaEntidade.aspx"
)
URL_LISTAGEM_NOTA = (
    "https://www.nfp.fazenda.sp.gov.br/EntidadesFilantropicas/ListagemNotaEntidade.aspx"
)


def _url_norm(url: str) -> str:
    return (url or "").lower()


def _norm_txt(s: str) -> str:
    return " ".join((s or "").upper().replace("Ã", "A").replace("Ç", "C").split())


def _norm_modal(texto: str) -> str:
    t = (texto or "").lower()
    for origem, destino in (
        ("á", "a"),
        ("à", "a"),
        ("ã", "a"),
        ("â", "a"),
        ("é", "e"),
        ("ê", "e"),
        ("í", "i"),
        ("ó", "o"),
        ("ô", "o"),
        ("õ", "o"),
        ("ú", "u"),
        ("ç", "c"),
    ):
        t = t.replace(origem, destino)
    return " ".join(t.split())


def classificar_modal_nfp(texto: str) -> str:
    """Identifica o dialogo visivel da NFP (texto do body/modal).

    Retornos: bloqueio | doar_todos | instrutivo_chave | generico | nenhum
    """
    t = _norm_modal(texto)
    if not t:
        return "nenhum"
    if "indicios de que o consumidor" in t or "nao eram referentes" in t:
        return "bloqueio"
    if (
        "doar todos" in t
        or "documentos fiscais com o seu cpf" in t
        or "doacao automatica" in t
    ):
        return "doar_todos"
    if (
        "nao seja mais apresentada" in t
        or "pressione esc para fechar" in t
        or ("possua chave de acesso" in t and "44" in t)
    ):
        return "instrutivo_chave"
    return "generico"


async def _texto_corpo(page) -> str:
    try:
        return " ".join(((await page.inner_text("body")) or "").lower().split())
    except Exception:
        return ""


async def bloqueio_doacao_terceiros_sefaz(page) -> bool:
    """Modal que trava a doacao de *consumidor* por indicios de notas de terceiros."""
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


async def _clicar_botao_rotulo(page, rotulo: str) -> bool:
    """Clica Sim / Nao / Ok visivel no modal (ids NFP + value/role)."""
    chave = (rotulo or "").strip().lower()
    if chave.startswith("n"):
        chave = "nao"
    ids = {
        "sim": "#btnSimAcaoUsuario",
        "nao": "#btnNaoAcaoUsuario",
        "ok": "#btnOkAcaoUsuario",
    }
    valores = {
        "sim": ["Sim", "SIM"],
        "nao": ["Não", "Nao", "NÃO", "NAO"],
        "ok": ["Ok", "OK", "ok"],
    }
    nomes = {
        "sim": re.compile(r"^sim$", re.I),
        "nao": re.compile(r"^n[aã]o$", re.I),
        "ok": re.compile(r"^ok$", re.I),
    }
    candidatos = []
    if chave in ids:
        candidatos.append(page.locator(ids[chave]))
    for val in valores.get(chave, []):
        candidatos.append(page.locator(f'input[type="button"][value="{val}"]'))
        candidatos.append(page.locator(f'input[type="submit"][value="{val}"]'))
    nome_re = nomes.get(chave)
    if nome_re is not None:
        candidatos.append(page.get_by_role("button", name=nome_re))
        candidatos.append(page.locator("a", has_text=nome_re))
        candidatos.append(page.locator("button", has_text=nome_re))
    for loc in candidatos:
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=400):
                await alvo.click(force=True, timeout=1500)
                await page.wait_for_timeout(400)
                return True
        except Exception:
            continue
    return False


async def _tem_aviso_instrutivo(page) -> bool:
    return classificar_modal_nfp(await _texto_corpo(page)) == "instrutivo_chave"


async def _tem_overlay_ou_aviso(page) -> bool:
    if await _tem_aviso_instrutivo(page):
        return True
    try:
        return bool(
            await page.evaluate(
                """() => {
                  if (document.querySelector('.ui-widget-overlay')) return true;
                  const sels = ['.ui-dialog', '[role="dialog"]', '.modal'];
                  for (const s of sels) {
                    for (const el of document.querySelectorAll(s)) {
                      const st = window.getComputedStyle(el);
                      if (!st || st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') {
                        continue;
                      }
                      const t = (el.innerText || '').trim();
                      if (t.length > 15) return true;
                    }
                  }
                  return false;
                }"""
            )
        )
    except Exception:
        return False


async def fechar_modal_instrutivo(page) -> bool:
    """Fecha avisos que bloqueiam o formulario (Sim/Nao/Ok/ESC).

    - Aviso 'nao mostrar de novo' (chave 44 digitos): clica Sim.
    - Convite doar todos / doacao automatica: clica Nao.
    - Nao fecha o bloqueio SEFAZ de indicios de terceiros.
    """
    if await bloqueio_doacao_terceiros_sefaz(page):
        print(
            "SEFAZ: bloqueio de doacao de consumidor. "
            "Use Cadastramento de Cupons (representante ONG), nao Doacao sem CPF."
        )
        return False

    fechou = False
    for _ in range(4):
        if await bloqueio_doacao_terceiros_sefaz(page):
            return False
        tipo = classificar_modal_nfp(await _texto_corpo(page))
        if tipo == "bloqueio":
            return False
        if tipo == "doar_todos":
            if await _clicar_botao_rotulo(page, "nao"):
                print("Recuperacao: cliquei em Nao (doar todos / doacao automatica).")
                fechou = True
                continue
        elif tipo == "instrutivo_chave":
            if await _clicar_botao_rotulo(page, "sim"):
                print(
                    "Recuperacao: fechei aviso de chave de acesso "
                    "(Sim — nao mostrar de novo)."
                )
                fechou = True
                continue
            try:
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(300)
                print("Recuperacao: fechei aviso de chave de acesso (ESC).")
                fechou = True
            except Exception:
                pass
            continue
        if not await _tem_overlay_ou_aviso(page):
            break
        if await _clicar_botao_rotulo(page, "ok"):
            print("Recuperacao: fechei modal (Ok).")
            fechou = True
            continue
        try:
            await page.keyboard.press("Escape")
            await page.wait_for_timeout(250)
        except Exception:
            pass
        if not await _tem_overlay_ou_aviso(page):
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


def _texto_parece_aeb(texto: str) -> bool:
    n = _norm_txt(texto)
    if "EVANGELICA BENEFICENTE" in n or "EVANGELICA BENEFICENTE" in n.replace("É", "E"):
        return True
    if "ASSOCIACAO EVANGELICA" in n:
        return True
    # Combo às vezes mostra só AEB
    if re.search(r"\bAEB\b", texto or "", re.I) and "CASA ABRIGO" not in n:
        return True
    return False


async def _entidade_aeb_selecionada(page) -> bool:
    """True se o combo/campo de entidade aponta para a AEB."""
    # Combos <select> (listagem e cadastro representante)
    try:
        selects = page.locator("select")
        n = await selects.count()
        for i in range(min(n, 12)):
            sel = selects.nth(i)
            try:
                if not await sel.is_visible(timeout=200):
                    continue
            except Exception:
                continue
            try:
                # option selecionada
                val = await sel.input_value()
                opt = sel.locator("option:checked")
                texto = ""
                if await opt.count():
                    texto = (await opt.first.inner_text()) or ""
                if not texto and val:
                    texto = val
                if _texto_parece_aeb(texto):
                    return True
            except Exception:
                continue
    except Exception:
        pass

    # Fluxo antigo consumidor (CNPJ preenchido) — só como detecção
    try:
        valor = await page.locator("#txtCNPJEntidadeFilantropica").input_value()
        digitos = re.sub(r"\D", "", valor or "")
        if digitos == CNPJ_AEB_DIGITOS:
            return True
    except Exception:
        pass

    return False


async def tela_pronta_para_enviar(page, *, fechar_modais: bool = True) -> bool:
    """Formulario de cadastro representante com chave + AEB.

    fechar_modais=False: checagem rapida entre cupons (tela ja no cadastro).
    """
    if fechar_modais or await _tem_aviso_instrutivo(page):
        await fechar_modal_instrutivo(page)
    url = _url_norm(page.url)
    # Nunca considerar "pronto" a tela de doacao de consumidor
    if "doacaonotas" in url:
        return False
    if not await _tem_campo_chave(page):
        return False
    # Precisa botao Salvar Nota (nao Registrar Doacao)
    if not await _tem_botao_salvar_nota(page):
        return False
    if await _tem_aviso_instrutivo(page):
        return False
    return await _entidade_aeb_selecionada(page)


async def _tem_botao_salvar_nota(page) -> bool:
    for loc in (
        page.locator('input[value*="Salvar Nota" i]'),
        page.get_by_role("button", name=re.compile(r"salvar\s*nota", re.I)),
        page.locator('input[type="submit"][value*="Salvar Nota" i]'),
    ):
        try:
            if await loc.count() and await loc.first.is_visible(timeout=300):
                return True
        except Exception:
            continue
    return False


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
    if "efetuar login" in texto and "entidad" not in url:
        return True
    return False


async def _eh_fluxo_consumidor(page) -> bool:
    url = _url_norm(page.url)
    if "doacaonotas" in url:
        return True
    texto = await _texto_corpo(page)
    if "registrar doação" in texto or "registrar doacao" in texto:
        if "salvar nota" not in texto:
            return True
    return False


async def _abrir_menu_entidades(page) -> None:
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
                return
        except Exception:
            continue


async def _clicar_menu_cadastramento_cupons(page) -> bool:
    """principal → Entidades → Cadastramento de Cupons (representante ONG)."""
    await _abrir_menu_entidades(page)

    for loc in (
        page.get_by_role("link", name=re.compile(r"cadastramento\s+de\s+cupons", re.I)),
        page.locator("a", has_text=re.compile(r"cadastramento\s+de\s+cupons", re.I)),
        page.locator("td", has_text=re.compile(r"cadastramento\s+de\s+cupons", re.I)),
        page.locator("span", has_text=re.compile(r"cadastramento\s+de\s+cupons", re.I)),
    ):
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=1500):
                await alvo.click(timeout=3000)
                await page.wait_for_timeout(1200)
                print("Recuperacao: Entidades → Cadastramento de Cupons.")
                return True
        except Exception:
            continue

    # Fallback URL do aviso (gate representante)
    try:
        await page.goto(URL_AVISO, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(1000)
        print("Recuperacao: abri CadastroNotaEntidadeAviso via URL.")
        return True
    except Exception as exc:
        print(f"Recuperacao: falha ao abrir cadastramento ({exc})")
        return False


async def _clicar_prosseguir_aviso(page) -> bool:
    """Aviso: cadastrar em nome da entidade → Prosseguir (nunca Voltar)."""
    texto = await _texto_corpo(page)
    if "prosseguir" not in texto and "optando por cadastrar" not in texto:
        # Sem aviso — talvez ja esteja na listagem
        return False

    for loc in (
        page.locator('input[value*="Prosseguir" i]'),
        page.get_by_role("button", name=re.compile(r"^prosseguir$", re.I)),
        page.locator("a", has_text=re.compile(r"^prosseguir$", re.I)),
        page.locator('input[type="submit"][value*="Prosseguir" i]'),
        page.locator('input[type="button"][value*="Prosseguir" i]'),
    ):
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=1000):
                await alvo.click(timeout=3000)
                await page.wait_for_timeout(1200)
                print("Recuperacao: cliquei em Prosseguir (representante ONG).")
                return True
        except Exception:
            continue
    print("Recuperacao: aviso presente mas Prosseguir nao encontrado.")
    return False


async def _selecionar_aeb_no_combo(page) -> bool:
    """Seleciona AEB no <select> Entidade da listagem/cadastro."""
    if await _entidade_aeb_selecionada(page):
        return True

    try:
        ok = await page.evaluate(
            """(markers) => {
              const upper = (s) => (s || '').toUpperCase()
                .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
              const isAeb = (t) => {
                const u = upper(t);
                if (u.includes('EVANGELICA BENEFICENTE')) return true;
                if (u.includes('ASSOCIACAO EVANGELICA')) return true;
                for (const m of markers) {
                  if (u.includes(upper(m))) return true;
                }
                return false;
              };
              for (const sel of document.querySelectorAll('select')) {
                const opts = Array.from(sel.options || []);
                if (opts.length < 2) continue;
                const labelNearby = ((sel.closest('tr') || sel.parentElement || document.body)
                  .innerText || '').toUpperCase();
                const pareceEntidade = labelNearby.includes('ENTIDADE') || opts.some(o => isAeb(o.text));
                if (!pareceEntidade) continue;
                for (const opt of opts) {
                  if (!isAeb(opt.text) && !isAeb(opt.value)) continue;
                  sel.value = opt.value;
                  opt.selected = true;
                  sel.dispatchEvent(new Event('change', { bubbles: true }));
                  sel.dispatchEvent(new Event('input', { bubbles: true }));
                  return true;
                }
              }
              return false;
            }""",
            list(NOME_AEB_MARKERS),
        )
    except Exception as exc:
        print(f"Recuperacao: falha ao selecionar AEB no combo ({exc})")
        ok = False

    await page.wait_for_timeout(500)
    if ok or await _entidade_aeb_selecionada(page):
        print("Recuperacao: AEB selecionada no combo Entidade.")
        # Checkbox "manter dado" ao lado, se existir
        try:
            await page.evaluate(
                """() => {
                  for (const cb of document.querySelectorAll('input[type=checkbox]')) {
                    const ctx = ((cb.closest('tr') || cb.parentElement || {}).innerText || '').toUpperCase();
                    if (ctx.includes('ENTIDADE') && !cb.checked) {
                      cb.click();
                      return;
                    }
                  }
                }"""
            )
        except Exception:
            pass
        return True
    return False


async def _clicar_nova_nota(page) -> bool:
    for loc in (
        page.locator('input[value*="Nova Nota" i]'),
        page.get_by_role("button", name=re.compile(r"nova\s*nota", re.I)),
        page.locator('input[type="submit"][value*="Nova Nota" i]'),
        page.locator('input[type="button"][value*="Nova Nota" i]'),
        page.locator("a", has_text=re.compile(r"nova\s*nota", re.I)),
    ):
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=1000):
                await alvo.click(timeout=3000)
                await page.wait_for_timeout(700)
                print("Recuperacao: cliquei em Nova Nota.")
                return True
        except Exception:
            continue
    return False


async def _tem_nova_nota(page) -> bool:
    for loc in (
        page.locator('input[value*="Nova Nota" i]'),
        page.get_by_role("button", name=re.compile(r"nova\s*nota", re.I)),
    ):
        try:
            if await loc.count() and await loc.first.is_visible(timeout=300):
                return True
        except Exception:
            continue
    return False


async def garantir_tela_doacao_aeb(page, *, tentativas: int = 8) -> bool:
    """Garante cadastro representante (chave + Salvar Nota) com AEB.

    Mantem o nome da funcao por compatibilidade com enviar_fila.
    """
    for n in range(1, tentativas + 1):
        if await bloqueio_doacao_terceiros_sefaz(page):
            print(
                "Recuperacao: abortada — bloqueio de doacao de consumidor. "
                "Feche o modal e use Cadastramento de Cupons (nao Doacao sem CPF)."
            )
            return False

        # Caminho rapido: ja no Cadastro com AEB (apos Salvar Nota a pagina costuma ficar).
        if await tela_pronta_para_enviar(page, fechar_modais=False):
            if n > 1:
                print("Recuperacao: tela Cadastro Nota + AEB ok (Salvar Nota).")
            return True

        await fechar_modal_instrutivo(page)
        if await bloqueio_doacao_terceiros_sefaz(page):
            return False

        if await tela_pronta_para_enviar(page, fechar_modais=False):
            if n > 1:
                print("Recuperacao: tela Cadastro Nota + AEB ok (Salvar Nota).")
            return True

        url = _url_norm(page.url)
        print(f"Recuperacao [{n}/{tentativas}]: url={page.url}")

        if "login" in url or "sso.acesso.gov" in url or "acesso.gov.br" in url:
            print("Recuperacao: sessao/login — e preciso autenticar manualmente.")
            return False

        # Sai do fluxo errado (consumidor)
        if await _eh_fluxo_consumidor(page):
            print(
                "Recuperacao: estava no fluxo de consumidor (DoacaoNotas) — "
                "redirecionando para Cadastramento de Cupons."
            )
            await _clicar_menu_cadastramento_cupons(page)
            continue

        # Aviso representante → Prosseguir
        corpo = await _texto_corpo(page)
        if (
            "cadastronotaentidadeaviso" in url
            or "optando por cadastrar notas" in corpo
            or ("cadastrar notas em nome" in corpo and "prosseguir" in corpo)
        ):
            if await _clicar_prosseguir_aviso(page):
                continue
            # Se o botao sumiu, talvez ja avancou
            if await _tem_nova_nota(page):
                await _selecionar_aeb_no_combo(page)
                await _clicar_nova_nota(page)
                continue

        # Listagem entidade: combo + Nova Nota
        if await _tem_nova_nota(page) or "listagem" in url or "entidade - listagem" in corpo:
            await _selecionar_aeb_no_combo(page)
            if await _tem_campo_chave(page) and await _tem_botao_salvar_nota(page):
                # Ja no form
                if await _entidade_aeb_selecionada(page) or await _selecionar_aeb_no_combo(page):
                    if await tela_pronta_para_enviar(page):
                        return True
            if await _clicar_nova_nota(page):
                continue

        # Formulario aberto sem AEB
        if await _tem_campo_chave(page) and await _tem_botao_salvar_nota(page):
            if await _selecionar_aeb_no_combo(page) and await tela_pronta_para_enviar(page):
                return True
            continue

        # Home / bem-vindo / outras paginas NFP
        if "principal.aspx" in url or "bem-vindo ao sistema" in corpo:
            await _clicar_menu_cadastramento_cupons(page)
            continue

        await _clicar_menu_cadastramento_cupons(page)

    print("Recuperacao: esgotaram as tentativas (cadastro representante).")
    return await tela_pronta_para_enviar(page)
