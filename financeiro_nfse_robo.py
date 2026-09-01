"""Robô Playwright — conferência NFS-e emitidas no portal nacional."""

from __future__ import annotations

import asyncio
import calendar
import random
import re
import traceback
import urllib.parse
from datetime import date
from pathlib import Path
from typing import Any

from financeiro_nfse_runtime import executar_no_loop

from financeiro_nfse_conferencia_service import (
    ConferenciaTracker,
    IndicePdf,
    aplicar_resumo_final,
    copiar_pdf_confirmado,
    deve_parar,
    extrair_chave_acesso,
    montar_observacao_cancelada_sem_pdf,
    resolver_periodo_meses,
    resolver_ritmo_nfse,
    resolver_situacao_cancelada,
    salvar_print_nao_encontrada,
    set_job,
    snap_job,
    sugerir_pdf_substituto,
)

_BASE_NFSE = "https://www.nfse.gov.br"
_BASE_EMITIDAS = f"{_BASE_NFSE}/EmissorNacional/Notas/Emitidas"

_RE_BLOQUEIO_PORTAL = re.compile(
    r"muitas requis|too many|429|rate.?limit|bloqueio|tente novamente|"
    r"acesso negado|excesso de|limite de requis|aguarde",
    re.I,
)

_playwright = None
_browser = None
_context = None
_page = None


class RitmoPortal:
    """Pausas aleatórias entre ações para imitar uso humano e evitar bloqueio."""

    def __init__(self, params: dict[str, float | int]) -> None:
        self.params = params
        self._contador_notas = 0

    async def _sleep(self, segundos: float) -> None:
        restante = max(0.0, segundos)
        while restante > 0 and not deve_parar():
            fatia = min(restante, 2.0)
            await asyncio.sleep(fatia)
            restante -= fatia

    async def apos_nota(self) -> None:
        self._contador_notas += 1
        pausa_cada = int(self.params.get("pausa_a_cada_notas") or 10)
        if pausa_cada > 0 and self._contador_notas % pausa_cada == 0:
            seg = random.uniform(
                float(self.params["pausa_longa_min_seg"]),
                float(self.params["pausa_longa_max_seg"]),
            )
            set_job(
                mensagem=(
                    f"Pausa longa ({seg:.0f}s) após {self._contador_notas} nota(s) "
                    f"— evita bloqueio do portal…"
                )
            )
            await self._sleep(seg)
            return

        seg = random.uniform(
            float(self.params["intervalo_notas_min_seg"]),
            float(self.params["intervalo_notas_max_seg"]),
        )
        await self._sleep(seg)

    async def apos_pagina(self) -> None:
        seg = random.uniform(
            float(self.params["intervalo_pagina_min_seg"]),
            float(self.params["intervalo_pagina_max_seg"]),
        )
        set_job(mensagem=f"Aguardando {seg:.0f}s antes da próxima página…")
        await self._sleep(seg)

    async def apos_mes(self) -> None:
        seg = random.uniform(
            float(self.params["intervalo_mes_min_seg"]),
            float(self.params["intervalo_mes_max_seg"]),
        )
        set_job(mensagem=f"Aguardando {seg:.0f}s antes do próximo mês…")
        await self._sleep(seg)


async def _pagina_bloqueada(page) -> bool:
    try:
        texto = await page.locator("body").inner_text()
    except Exception:
        return False
    return bool(_RE_BLOQUEIO_PORTAL.search(texto or ""))


async def _goto_com_retry(
    page,
    url: str,
    *,
    timeout: int = 120_000,
    max_tentativas: int = 4,
) -> bool:
    """Navega e, se o portal sinalizar excesso de requisições, aguarda e tenta de novo."""
    for tentativa in range(1, max_tentativas + 1):
        if deve_parar():
            return False
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
        except Exception as exc:
            if tentativa >= max_tentativas:
                set_job(mensagem=f"Falha ao abrir página: {exc}")
                return False
            espera = 30 * tentativa + random.uniform(5, 20)
            set_job(
                mensagem=(
                    f"Erro de navegação — pausa {espera:.0f}s "
                    f"(tentativa {tentativa}/{max_tentativas})…"
                )
            )
            await asyncio.sleep(espera)
            continue

        await page.wait_for_timeout(500)
        if not await _pagina_bloqueada(page):
            return True

        espera = 45 * tentativa + random.uniform(10, 30)
        set_job(
            mensagem=(
                f"Portal sinalizou excesso de requisições — pausa {espera:.0f}s "
                f"(tentativa {tentativa}/{max_tentativas}). "
                f"Se persistir, use ritmo «Muito lento»."
            )
        )
        await asyncio.sleep(espera)

    set_job(
        mensagem=(
            "Portal continua bloqueando após várias pausas. "
            "Interrompa, aguarde alguns minutos e reinicie com ritmo mais lento."
        )
    )
    return False


def _playwright_disponivel():
    try:
        from playwright.async_api import async_playwright  # noqa: F401

        return True
    except ImportError:
        return False


async def _fechar_browser() -> None:
    global _playwright, _browser, _context, _page
    try:
        if _context:
            await _context.close()
    except Exception:
        pass
    try:
        if _browser:
            await _browser.close()
    except Exception:
        pass
    try:
        if _playwright:
            await _playwright.stop()
    except Exception:
        pass
    _playwright = None
    _browser = None
    _context = None
    _page = None
    set_job(browser_aberto=False)


async def abrir_navegador_nfse(*, slow_mo_ms: int = 200) -> None:
    global _playwright, _browser, _context, _page

    if not _playwright_disponivel():
        raise RuntimeError(
            "Playwright não instalado. Rode: pip install playwright && playwright install chromium"
        )

    await _fechar_browser()

    from playwright.async_api import async_playwright

    _playwright = await async_playwright().start()
    _browser = await _playwright.chromium.launch(
        headless=False,
        slow_mo=max(80, int(slow_mo_ms)),
    )
    _context = await _browser.new_context(viewport={"width": 1400, "height": 900})
    _page = await _context.new_page()
    await _goto_com_retry(_page, _BASE_EMITIDAS)

    set_job(
        browser_aberto=True,
        aguardando_login=True,
        status="aguardando_login",
        mensagem="Navegador aberto. Faça login no portal NFS-e e clique em «Iniciar conferência».",
    )


async def _obter_pagina():
    global _page
    if _page is None or _page.is_closed():
        raise RuntimeError("Navegador não aberto. Clique em «Abrir navegador NFS-e».")
    return _page


async def _indice_coluna_situacao(page) -> int | None:
    headers = page.locator("table thead th")
    total = await headers.count()
    for i in range(total):
        texto = (await headers.nth(i).inner_text()).strip().lower()
        if "situa" in texto:
            return i
    return None


async def _linha_cancelada(linha) -> bool:
    """Detecta cancelada na coluna Situação (ícone vermelho ou texto)."""
    page = await _obter_pagina()
    idx = await _indice_coluna_situacao(page)
    celula = (
        linha.locator("td").nth(idx)
        if idx is not None
        else linha.locator("td").last
    )
    if await celula.count() == 0:
        return False

    texto = re.sub(r"\s+", " ", (await celula.inner_text()).strip()).lower()
    html = (await celula.inner_html()).lower()

    if _RE_SITUACAO_CANCELADA.search(texto):
        return True

    indicadores_html = (
        "cancelad",
        "glyphicon-remove",
        "fa-times",
        "icon-cancel",
        "substitu",
        "anulad",
        "text-danger",
        "sit-cancel",
        "nfse-cancel",
    )
    if any(ind in html for ind in indicadores_html):
        return True

    imgs = celula.locator("img, svg, i")
    for i in range(await imgs.count()):
        for attr in ("src", "alt", "title", "class"):
            val = (await imgs.nth(i).get_attribute(attr) or "").lower()
            if any(
                x in val
                for x in ("cancel", "vermelh", "substitu", "anulad", "negativ", "times")
            ):
                return True

    if _RE_SITUACAO_ATIVA.search(texto):
        return False
    if any(
        x in html
        for x in ("glyphicon-ok", "fa-check", "autoriz", "text-success", "verde")
    ):
        return False

    return False


_RE_SITUACAO_CANCELADA = re.compile(
    r"cancelad|substituíd|substituid|anulad|inutiliz",
    re.IGNORECASE,
)
_RE_SITUACAO_ATIVA = re.compile(
    r"autorizad|emitid|normal|válid|valid|ativa",
    re.IGNORECASE,
)


def _abs_url(href: str | None) -> str | None:
    if not href:
        return None
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return f"{_BASE_NFSE}{href}"
    return f"{_BASE_NFSE}/{href.lstrip('/')}"


async def _extrair_url_visualizar(linha) -> str | None:
    """Obtém URL de visualização sem clicar em links ocultos (ex.: Download DANFSe)."""
    link = linha.locator("a[href*='Visualizar/Index']").first
    if await link.count() > 0:
        return _abs_url(await link.get_attribute("href"))

    page = await _obter_pagina()
    toggle = linha.locator(
        "button.dropdown-toggle, [data-toggle='dropdown'], .btn-group button"
    ).first
    if await toggle.count() > 0:
        await toggle.click()
        await page.wait_for_timeout(350)
        menu_link = page.locator(
            ".dropdown-menu.show a[href*='Visualizar/Index'], "
            ".open a[href*='Visualizar/Index']"
        ).first
        if await menu_link.count() > 0:
            href = _abs_url(await menu_link.get_attribute("href"))
            await page.keyboard.press("Escape")
            return href
        await page.keyboard.press("Escape")
    return None


async def _coletar_notas_pagina() -> list[tuple[str, bool]]:
    linhas = (await _obter_pagina()).locator("table tbody tr")
    total = await linhas.count()
    fila: list[tuple[str, bool]] = []
    for i in range(total):
        linha = linhas.nth(i)
        if not await linha.locator("td").count():
            continue
        url = await _extrair_url_visualizar(linha)
        if not url:
            continue
        cancelada = await _linha_cancelada(linha)
        if url not in {u for u, _ in fila}:
            fila.append((url, cancelada))
    return fila


async def _processar_nota_por_url(
    url: str,
    *,
    cancelada_lista: bool,
    indice_pdf: IndicePdf,
    pasta_destino: Path,
    contador_nao_encontrada: int,
    ritmo: RitmoPortal,
    tracker: ConferenciaTracker,
) -> None:
    page = await _obter_pagina()
    if not await _goto_com_retry(page, url):
        return
    await page.wait_for_timeout(random.randint(400, 900))

    if await _pagina_bloqueada(page):
        set_job(mensagem="Nota ignorada — portal bloqueando neste momento.")
        return

    texto = await page.locator("body").inner_text()
    chave = extrair_chave_acesso(texto)

    if chave and chave in tracker.chaves_confirmadas:
        tracker.registrar(
            chave=chave,
            cancelada=cancelada_lista,
            resultado="ja_conferida",
            observacao="Chave já confirmada nesta execução.",
        )
        set_job(mensagem=f"NF já conferida (chave …{chave[-8:]}).")
        await ritmo.apos_nota()
        return

    pdf = indice_pdf.buscar_por_chave(chave)
    cancelada = resolver_situacao_cancelada(
        cancelada_lista=cancelada_lista,
        texto_pagina=texto,
        pdf=pdf,
    )

    if pdf and chave:
        destino = copiar_pdf_confirmado(pdf, pasta_destino, cancelada=cancelada)
        tracker.chaves_confirmadas.add(chave)
        resultado = "cancelada" if cancelada else "ok"
        tracker.registrar(
            chave=chave,
            cancelada=cancelada,
            resultado=resultado,
            pdf=pdf,
        )
        if cancelada:
            set_job(mensagem=f"Cancelada confirmada: {destino.name}")
        else:
            set_job(mensagem=f"NF confirmada: {destino.name}")
    else:
        await _screenshot_identificacao_nfse(
            page,
            pasta_destino,
            chave=chave,
            indice=contador_nao_encontrada,
        )
        rotulo = f"chave …{chave[-8:]}" if chave else "sem chave"
        if cancelada:
            sugestao = sugerir_pdf_substituto(
                indice_pdf,
                texto_portal=texto,
                chave_atual=chave,
            )
            observacao = montar_observacao_cancelada_sem_pdf(
                sugestao,
                indice=indice_pdf,
            )
            tracker.registrar(
                chave=chave,
                cancelada=cancelada,
                resultado="cancelada_sem_pdf",
                pdf=sugestao,
                observacao=observacao,
            )
            set_job(
                mensagem=f"NF cancelada sem PDF local ({rotulo}) — print salvo."
            )
        else:
            tracker.registrar(
                chave=chave,
                cancelada=cancelada,
                resultado="nao_encontrada",
                observacao="PDF não encontrado nas pastas de origem.",
            )
            set_job(mensagem=f"NF não encontrada nos PDFs ({rotulo}) — print salvo.")

    await ritmo.apos_nota()


async def _screenshot_identificacao_nfse(
    page,
    pasta_destino: Path,
    *,
    chave: str | None,
    indice: int,
) -> None:
    """Print da aba inicial com chave de acesso (Identificação da NFS-e)."""
    alvo = page.get_by_text(
        re.compile(r"Chave de acesso|Identifica", re.I)
    ).first
    if await alvo.count() > 0:
        bloco = alvo.locator("xpath=ancestor::div[contains(@class,'row') or contains(@class,'panel')][1]")
        if await bloco.count() > 0:
            alvo = bloco.first
    else:
        alvo = page.locator("main, .container, body").first

    png = await alvo.screenshot(type="png")
    destino = salvar_print_nao_encontrada(
        pasta_destino, png, chave=chave, indice=indice
    )
    set_job(mensagem=f"Print salvo (NF não encontrada): {destino.name}")


async def _url_mes(ano: int, mes: int) -> str:
    ultimo = calendar.monthrange(ano, mes)[1]
    ini = f"01/{mes:02d}/{ano}"
    fim = f"{ultimo:02d}/{mes:02d}/{ano}"
    params = urllib.parse.urlencode(
        {"datainicio": ini, "datafim": fim},
        quote_via=urllib.parse.quote,
    )
    return f"{_BASE_EMITIDAS}?{params}"


async def _processar_pagina_lista(
    *,
    indice_pdf: IndicePdf,
    pasta_destino: Path,
    contador_nao_encontrada: int,
    ritmo: RitmoPortal,
    tracker: ConferenciaTracker,
) -> int:
    page = await _obter_pagina()
    url_lista = page.url
    pagina = await _numero_pagina_lista(page)
    fila = await _coletar_notas_pagina()
    set_job(mensagem=f"Página {pagina}: processando {len(fila)} nota(s)…")

    for url, cancelada_lista in fila:
        if deve_parar():
            break
        try:
            await _processar_nota_por_url(
                url,
                cancelada_lista=cancelada_lista,
                indice_pdf=indice_pdf,
                pasta_destino=pasta_destino,
                contador_nao_encontrada=contador_nao_encontrada,
                ritmo=ritmo,
                tracker=tracker,
            )
            contador_nao_encontrada += 1
        except Exception as exc:
            set_job(mensagem=f"Erro em uma nota: {exc}")
        if deve_parar():
            break
        if not await _goto_com_retry(page, url_lista):
            break
        await page.wait_for_timeout(random.randint(500, 1000))

    return contador_nao_encontrada


async def _numero_pagina_lista(page) -> str:
    ativa = page.locator(
        ".pagination .active, .pagination li.active, .page-item.active"
    )
    if await ativa.count() == 0:
        return "1"
    texto = (await ativa.first.inner_text()).strip()
    return texto or "1"


async def _localizar_link_proxima_pagina(page):
    """Encontra o link da próxima página na grade de emitidas."""
    ativa = page.locator(
        ".pagination .active, .pagination li.active, .page-item.active"
    )
    if await ativa.count() > 0:
        prox = ativa.locator("xpath=following-sibling::li[1]//a").first
        if await prox.count() > 0:
            pai = prox.locator("xpath=ancestor::li[1]")
            if await pai.count() == 0 or "disabled" not in (
                (await pai.first.get_attribute("class") or "").lower()
            ):
                return prox

    for seletor in (
        ".pagination li:not(.disabled) a[rel='next']",
        ".pagination li:not(.disabled) a",
    ):
        candidatos = page.locator(seletor).filter(
            has_text=re.compile(r"^›|^>|»|Próxim", re.I)
        )
        if await candidatos.count() > 0:
            return candidatos.first

    pagina_atual = await _numero_pagina_lista(page)
    if pagina_atual.isdigit():
        prox_num = str(int(pagina_atual) + 1)
        numerica = page.locator(".pagination li:not(.disabled) a").filter(
            has_text=re.compile(rf"^{re.escape(prox_num)}$")
        )
        if await numerica.count() > 0:
            return numerica.first

    return None


async def _ir_proxima_pagina(ritmo: RitmoPortal) -> bool:
    page = await _obter_pagina()
    pagina_atual = await _numero_pagina_lista(page)
    prox = await _localizar_link_proxima_pagina(page)
    if prox is None or await prox.count() == 0:
        set_job(
            mensagem=(
                f"Página {pagina_atual} concluída — "
                f"sem mais páginas neste mês."
            )
        )
        return False

    href = await prox.get_attribute("href")
    if href and href not in {"#", ""} and not href.lower().startswith("javascript"):
        destino = _abs_url(href)
        set_job(mensagem=f"Avançando da página {pagina_atual} → próxima…")
        if not await _goto_com_retry(page, destino):
            return False
    else:
        set_job(mensagem=f"Avançando da página {pagina_atual} → próxima (clique)…")
        await prox.click()
        await page.wait_for_load_state("domcontentloaded")
        await page.wait_for_timeout(random.randint(800, 1400))

    if await _pagina_bloqueada(page):
        set_job(mensagem="Bloqueio detectado ao mudar de página — aguardando retry…")
        if not await _goto_com_retry(page, page.url):
            return False

    nova = await _numero_pagina_lista(page)
    set_job(mensagem=f"Lista na página {nova}.")
    await ritmo.apos_pagina()
    return True


async def executar_conferencia(config: dict[str, Any]) -> None:
    if not _playwright_disponivel():
        set_job(
            status="erro",
            mensagem="Playwright não instalado. pip install playwright && playwright install chromium",
        )
        return

    try:
        page = await _obter_pagina()
    except RuntimeError as exc:
        set_job(status="erro", mensagem=str(exc))
        return

    ano, mes_inicio, mes_fim = resolver_periodo_meses(config)
    pasta_destino = Path(config["pasta_destino"])
    params_ritmo = resolver_ritmo_nfse(config)
    ritmo = RitmoPortal(params_ritmo)
    rotulo_ritmo = str(config.get("ritmo") or "lento")

    set_job(
        status="executando",
        aguardando_login=False,
        mensagem=(
            f"Indexando PDFs (ritmo «{rotulo_ritmo}»: "
            f"{params_ritmo['intervalo_notas_min_seg']}-"
            f"{params_ritmo['intervalo_notas_max_seg']}s entre notas)…"
        ),
    )

    indice = await asyncio.to_thread(IndicePdf.montar, config["pastas_origem"])
    qtd_chaves = len(indice.mapa_chave)
    set_job(
        mensagem=(
            f"Índice pronto: {len(indice.arquivos)} PDF(s), "
            f"{qtd_chaves} chave(s) de acesso."
        )
    )
    if indice.arquivos and qtd_chaves == 0:
        set_job(
            mensagem=(
                "Aviso: nenhuma chave de acesso lida nos PDFs. "
                "Verifique se os arquivos têm texto legível."
            )
        )
    if indice.sem_chave:
        set_job(
            mensagem=(
                f"Aviso: {len(indice.sem_chave)} PDF(s) sem chave extraída "
                f"(listados no relatório final)."
            )
        )

    tracker = ConferenciaTracker()
    contador_nao_encontrada = 1

    set_job(
        mensagem=(
            f"Período da conferência: {mes_inicio:02d}/{ano} a {mes_fim:02d}/{ano} "
            f"({mes_fim - mes_inicio + 1} mês(es))."
        )
    )

    for mes in range(mes_inicio, mes_fim + 1):
        if deve_parar():
            break
        url = await _url_mes(ano, mes)
        set_job(mensagem=f"Filtrando {mes:02d}/{ano}…")
        if not await _goto_com_retry(page, url):
            break
        await page.wait_for_timeout(random.randint(800, 1500))

        filtrar = page.get_by_role("button", name=re.compile(r"Filtrar", re.I))
        if await filtrar.count() > 0:
            await filtrar.first.click()
            await page.wait_for_timeout(random.randint(1200, 2000))

        while True:
            if deve_parar():
                break
            contador_nao_encontrada = await _processar_pagina_lista(
                indice_pdf=indice,
                pasta_destino=pasta_destino,
                contador_nao_encontrada=contador_nao_encontrada,
                ritmo=ritmo,
                tracker=tracker,
            )
            if not await _ir_proxima_pagina(ritmo):
                break

        if mes < mes_fim and not deve_parar():
            await ritmo.apos_mes()

    relatorio = tracker.finalizar(
        indice,
        pasta_destino,
        ano=ano,
        mes_inicio=mes_inicio,
        mes_fim=mes_fim,
    )
    aplicar_resumo_final(relatorio["resumo"])

    if deve_parar():
        set_job(
            status="cancelado",
            mensagem="Conferência interrompida pelo usuário.",
            relatorio=relatorio,
        )
    else:
        resumo = relatorio["resumo"]
        set_job(
            status="concluido",
            relatorio=relatorio,
            mensagem=(
                f"Conferência concluída — Site: {resumo.get('registros_site', 0)}, "
                f"OK: {resumo.get('ok', 0)}, "
                f"Canceladas: {resumo.get('cancelada', 0)}, "
                f"Canceladas s/ PDF: {resumo.get('cancelada_sem_pdf', 0)}, "
                f"Não encontradas: {resumo.get('nao_encontrada', 0)}, "
                f"PDF sem portal: {resumo.get('pdf_sem_portal', 0)}. "
                f"Relatório: {relatorio.get('relatorio_xlsx', '')}"
            ),
        )


def executar_conferencia_sync(config: dict[str, Any]) -> None:
    try:
        executar_no_loop(executar_conferencia(config), timeout=None)
    except Exception:
        set_job(
            status="erro",
            mensagem=traceback.format_exc(limit=8).strip(),
        )


async def fechar_navegador_nfse() -> None:
    await _fechar_browser()


def abrir_navegador_sync(*, slow_mo_ms: int = 200) -> None:
    try:
        executar_no_loop(abrir_navegador_nfse(slow_mo_ms=slow_mo_ms), timeout=180)
    except Exception as exc:
        set_job(status="erro", mensagem=str(exc))


def fechar_navegador_sync() -> None:
    try:
        executar_no_loop(fechar_navegador_nfse(), timeout=60)
    except Exception:
        pass
