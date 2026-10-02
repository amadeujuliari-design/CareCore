"""Reentrada no portal NFP quando a sessao cai na tela de login gov.br.

Usa CPF e senha gravados no painel deste PC (variaveis de ambiente do processo).
Nao contorna captcha nem verificacao em duas etapas: se o GOV pedir isso, para.
"""

from __future__ import annotations

import os
import re


def digitos_cpf(valor: str) -> str:
    return re.sub(r"\D", "", valor or "")


def pagina_pede_login(url: str, texto: str) -> bool:
    """Mesma regra de sessao_nfp_caiu, sem depender do navegador."""
    url_n = (url or "").lower()
    if "sso.acesso.gov" in url_n or "acesso.gov.br" in url_n:
        return True
    if "login" in url_n and "nfce" not in url_n:
        return True
    t = " ".join((texto or "").lower().split())
    if "acesse sua conta gov.br" in t or "entrar com gov.br" in t:
        return True
    if "efetuar login" in t and "entidad" not in url_n:
        return True
    return False


def gov_pediu_etapa_extra(texto: str) -> bool:
    t = " ".join((texto or "").lower().split())
    marcas = (
        "captcha",
        "hcaptcha",
        "recaptcha",
        "não sou um robô",
        "nao sou um robo",
        "verificação em duas etapas",
        "verificacao em duas etapas",
        "código de acesso",
        "codigo de acesso",
        "aplicativo gov.br",
        "enviar código",
        "enviar codigo",
    )
    return any(m in t for m in marcas)


def gov_recusou_senha(texto: str) -> bool:
    t = " ".join((texto or "").lower().split())
    marcas = (
        "senha incorreta",
        "usuário ou senha",
        "usuario ou senha",
        "cpf ou senha",
        "dados inválidos",
        "dados invalidos",
    )
    return any(m in t for m in marcas)


def credenciais_gov() -> tuple[str, str]:
    cpf = digitos_cpf(os.environ.get("CARECORE_NFP_GOV_CPF") or "")
    senha = os.environ.get("CARECORE_NFP_GOV_SENHA") or ""
    return cpf, senha


async def _texto(page) -> str:
    try:
        return (await page.inner_text("body")) or ""
    except Exception:
        return ""


async def _clicar_visivel(loc) -> bool:
    try:
        if await loc.count() == 0:
            return False
        alvo = loc.first
        if not await alvo.is_visible():
            return False
        await alvo.click(timeout=4000)
        return True
    except Exception:
        return False


async def _digitar(loc, valor: str) -> bool:
    try:
        if await loc.count() == 0:
            return False
        alvo = loc.first
        if not await alvo.is_visible():
            return False
        await alvo.click(timeout=3000)
        try:
            await alvo.fill("")
        except Exception:
            pass
        try:
            await alvo.press_sequentially(valor, delay=50)
        except Exception:
            await alvo.fill(valor)
        return True
    except Exception:
        return False


async def _primeiro(page, locais, valor: str) -> bool:
    for loc in locais:
        if await _digitar(loc, valor):
            return True
    return False


async def _abrir_gov_a_partir_da_fazenda(page) -> bool:
    botao = page.get_by_role("button", name=re.compile(r"entrar com gov", re.I))
    link = page.get_by_role("link", name=re.compile(r"entrar com gov", re.I))
    if not await _clicar_visivel(botao) and not await _clicar_visivel(link):
        radio = page.get_by_text(re.compile(r"consumidor pessoa f", re.I))
        if await _clicar_visivel(radio):
            await page.wait_for_timeout(600)
        if not await _clicar_visivel(botao) and not await _clicar_visivel(link):
            texto = page.get_by_text(re.compile(r"entrar com gov\.?br", re.I))
            if not await _clicar_visivel(texto):
                return False
    try:
        await page.wait_for_timeout(1200)
    except Exception:
        pass
    return True


async def _na_tela_senha(page) -> bool:
    texto = (await _texto(page)).lower()
    if "digite sua senha" in texto:
        return True
    loc = page.locator("input[type='password']")
    try:
        return await loc.count() > 0 and await loc.first.is_visible()
    except Exception:
        return False


async def _clicar_rotulo(page, nome: str) -> bool:
    rx = re.compile(rf"^{re.escape(nome)}$", re.I)
    for role in ("button", "link"):
        if await _clicar_visivel(page.get_by_role(role, name=rx)):
            return True
    return False


async def tentar_relogin_gov(page) -> bool:
    """Clica em Entrar com gov.br, digita CPF e senha e espera voltar a NFP.

    Uma tentativa. Sem captcha e sem 2FA. Nao imprime a senha.
    """
    cpf, senha = credenciais_gov()
    if len(cpf) != 11 or not senha.strip():
        print("Sessao NFP caiu e nao ha CPF/senha GOV salvos neste PC. O envio parou.")
        return False

    print("Sessao NFP caiu. Entrando de novo com gov.br (CPF e senha salvos neste PC).")
    try:
        url = (page.url or "").lower()
    except Exception:
        url = ""

    if "acesso.gov.br" not in url and "sso.acesso.gov" not in url:
        if not await _abrir_gov_a_partir_da_fazenda(page):
            print("Nao achei o botao Entrar com gov.br na tela de login da Fazenda.")
            return False

    if gov_pediu_etapa_extra(await _texto(page)):
        print(
            "GOV pediu uma confirmacao extra (captcha ou codigo). "
            "Conclua no Chrome; o envio parou."
        )
        return False

    if not await _na_tela_senha(page):
        cpf_ok = await _primeiro(
            page,
            [
                page.get_by_placeholder(re.compile(r"cpf", re.I)),
                page.get_by_label(re.compile(r"cpf", re.I)),
                page.locator("#accountId"),
                page.locator("input[name='accountId']"),
            ],
            cpf,
        )
        if not cpf_ok:
            print("Nao achei o campo de CPF no gov.br.")
            return False
        if not await _clicar_rotulo(page, "continuar"):
            print("Nao achei o botao Continuar no gov.br.")
            return False
        abriu_senha = False
        for _ in range(20):
            await page.wait_for_timeout(500)
            texto = await _texto(page)
            if gov_pediu_etapa_extra(texto):
                print(
                    "GOV pediu uma confirmacao extra (captcha ou codigo). "
                    "Conclua no Chrome; o envio parou."
                )
                return False
            if await _na_tela_senha(page):
                abriu_senha = True
                break
        if not abriu_senha:
            print("O gov.br nao abriu a tela de senha. O envio parou.")
            return False

    senha_ok = await _primeiro(
        page,
        [
            page.get_by_placeholder(re.compile(r"senha", re.I)),
            page.get_by_label(re.compile(r"^senha$", re.I)),
            page.locator("#password"),
            page.locator("input[type='password']"),
        ],
        senha,
    )
    if not senha_ok:
        print("Nao achei o campo de senha no gov.br.")
        return False
    if not await _clicar_rotulo(page, "entrar"):
        print("Nao achei o botao Entrar no gov.br.")
        return False

    for _ in range(30):
        await page.wait_for_timeout(1000)
        texto = await _texto(page)
        if gov_pediu_etapa_extra(texto):
            print(
                "GOV pediu uma confirmacao extra (captcha ou codigo). "
                "Conclua no Chrome; o envio parou."
            )
            return False
        if gov_recusou_senha(texto):
            print("O gov.br nao aceitou a senha salva. Confira no painel e rode de novo.")
            return False
        try:
            url_agora = page.url or ""
        except Exception:
            url_agora = ""
        if not pagina_pede_login(url_agora, texto):
            print("Login GOV ok. Seguindo a fila.")
            return True

    print("O login GOV nao voltou para a NFP a tempo. O envio parou.")
    return False
