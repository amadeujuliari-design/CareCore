#!/usr/bin/env python3
"""
Robo NFP — envia fila de chaves (preencher + Registrar Doacao).

Fluxo oficial do operador:
  1) Chrome com depuracao (porta 9222)
  2) Login/CAPTCHA ate a tela inicial (principal / Bem-vindo)
  3) Rodar a fila — o robo sozinho vai a DoacaoNotas, seleciona AEB
     e, se o site voltar para o inicio, recupera e retoma

Trata tambem:
  - popup "Deseja doar todos os documentos...?" → clica Nao
  - "Este pedido já existe no sistema..." → ja resolvido (enviado)
  - "Doação registrada com sucesso..." → sucesso (enviado)

Uso:
  python scripts/nfp_robo/enviar_fila.py --cdp http://127.0.0.1:9222
  python scripts/nfp_robo/enviar_fila.py --cdp http://127.0.0.1:9222 --planilha caminho.xlsx
  python scripts/nfp_robo/enviar_fila.py --cdp http://127.0.0.1:9222 --chave 3526...
  python scripts/nfp_robo/enviar_fila.py --cdp http://127.0.0.1:9222 --json pendentes.json --auto
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ler_planilha_chaves import ler_chaves_json, ler_chaves_xlsx  # noqa: E402
from navegar_doacao_aeb import garantir_tela_doacao_aeb  # noqa: E402
from preencher_sem_enviar import (  # noqa: E402
    CDP_PADRAO,
    PLANILHA_PADRAO,
    aguardar_classificacao_retorno,
    classificar_retorno_pagina,
    clicar_registrar,
    conectar_navegador,
    escolher_pagina,
    fechar_modal_mensagem,
    preencher_chave,
)
from retorno_nfp import resultado_operacional_ok  # noqa: E402

STOP_FLAG = Path(__file__).resolve().parent / "_capturas" / "fila_parar.flag"


def _parada_solicitada() -> bool:
    return STOP_FLAG.is_file()


async def fechar_popup_doacao_automatica(page) -> None:
    """Clica Nao no convite de doacao automatica / 'doar todos com CPF'."""
    # So age se o texto do convite estiver visivel (evita fechar modal errado)
    try:
        corpo = await page.inner_text("body")
    except Exception:
        corpo = ""
    corpo_n = " ".join((corpo or "").lower().split())
    convite = (
        "doar todos" in corpo_n
        or "documentos fiscais com o seu cpf" in corpo_n
        or "doacao automatica" in corpo_n
        or "doação automática" in corpo_n
    )
    if not convite:
        return

    candidatos = [
        page.get_by_role("button", name=re.compile(r"^n[aã]o$", re.I)),
        page.locator('input[type="button"][value="Não"]'),
        page.locator('input[type="button"][value="Nao"]'),
        page.locator('input[value="Não"]'),
        page.locator("button", has_text=re.compile(r"^n[aã]o$", re.I)),
        page.locator("a", has_text=re.compile(r"^n[aã]o$", re.I)),
    ]
    for loc in candidatos:
        try:
            alvo = loc.first
            if await alvo.count() == 0:
                continue
            if await alvo.is_visible(timeout=600):
                await alvo.click(timeout=3000)
                print("Popup: cliquei em Nao (doar todos / doacao automatica).")
                await page.wait_for_timeout(700)
                return
        except Exception:
            continue


async def processar_retorno(page) -> object:
    """Aguarda pos-envio, classifica mensagem e so depois fecha modais."""
    await page.wait_for_timeout(200)
    # Classifica COM o modal aberto. Fechar "Nao" antes apagava o sucesso
    # e sobrava so o texto antigo "já existe" no DOM.
    # Prazo e erros claros: timeout curto; demais: espera um pouco mais.
    cls = await aguardar_classificacao_retorno(page, timeout_ms=5000, intervalo_ms=200)
    if cls.tipo == "inconclusivo":
        cls = await aguardar_classificacao_retorno(page, timeout_ms=7000, intervalo_ms=300)
    await fechar_popup_doacao_automatica(page)
    await fechar_modal_mensagem(page)
    if cls.status_carecore == "rejeitado_prazo":
        # Segunda tentativa rapida: modal de prazo às vezes reaparece.
        await page.wait_for_timeout(150)
        await fechar_modal_mensagem(page)
    return cls


async def rodar(args: argparse.Namespace) -> int:
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Instale: pip install -r scripts/nfp_robo/requirements.txt && playwright install chromium")
        return 1

    if args.chave:
        chave = re.sub(r"\D", "", args.chave)
        if len(chave) != 44:
            print("Chave invalida.")
            return 1
        fila = [{"chave": chave}]
    elif args.json:
        fila = ler_chaves_json(Path(args.json))
        if not fila:
            print("JSON sem chaves.")
            return 1
    else:
        registros = ler_chaves_xlsx(Path(args.planilha))
        inicio = max(0, int(args.inicio))
        fila = registros[inicio:]
        if not fila:
            print("Fila vazia.")
            return 1

    print(f"Enviando {len(fila)} chave(s). Pausa entre envios: {args.pausa}s")
    print("Rotina inicial: a partir da tela Bem-vindo o robo abre DoacaoNotas + AEB.")
    print("Se o site voltar ao inicio no meio da fila, o robo recupera e retoma.")
    print("Ctrl+C ou botao Parar no CareCore para interromper.\n")
    if not args.auto:
        try:
            input("Enter para iniciar... ")
        except (EOFError, KeyboardInterrupt):
            return 0

    resultados: list[dict] = []
    out_dir = Path(__file__).resolve().parent / "_capturas"
    out_dir.mkdir(exist_ok=True)
    # Limpa flag antiga para nao abortar logo no inicio
    try:
        STOP_FLAG.unlink(missing_ok=True)
    except OSError:
        pass

    parado_pelo_usuario = False
    async with async_playwright() as p:
        browser, page, usar_cdp = await conectar_navegador(p, args)
        if page is None:
            return 1

        print("Rotina inicial: posicionando DoacaoNotas + entidade AEB (pode partir da home)...")
        if not await garantir_tela_doacao_aeb(page):
            print(
                "ERRO: nao consegui posicionar a tela de doacao com AEB. "
                "Confirme que esta logado na NFP (tela Bem-vindo) e tente de novo."
            )
            return 1
        print("Rotina inicial ok — iniciando envios.")

        ok_count = 0
        ja_existe_count = 0
        erro_count = 0

        for i, item in enumerate(fila, start=1):
            if _parada_solicitada():
                print("Parada solicitada pelo CareCore — encerrando apos o item atual.")
                parado_pelo_usuario = True
                break

            if usar_cdp and browser.contexts:
                page = await escolher_pagina(browser.contexts[0])

            if not await garantir_tela_doacao_aeb(page):
                print(
                    "Falha ao recuperar tela DoacaoNotas/AEB — interrompendo. "
                    f"Retome com --inicio {i - 1 + int(args.inicio)}"
                )
                break

            chave = item["chave"]
            print(f"\n[{i}/{len(fila)}] {chave}")
            if not await preencher_chave(page, chave):
                print("Campo chave sumiu — tentando recuperar tela e repetir uma vez...")
                if await garantir_tela_doacao_aeb(page) and await preencher_chave(page, chave):
                    pass
                else:
                    print("Falha ao preencher — interrompendo.")
                    return 1
            if not await clicar_registrar(page):
                print("Registrar falhou — tentando recuperar tela e repetir uma vez...")
                if await garantir_tela_doacao_aeb(page):
                    if not await preencher_chave(page, chave):
                        print("Falha ao preencher apos recuperacao — interrompendo.")
                        return 1
                    if not await clicar_registrar(page):
                        print("Falha ao clicar Registrar — interrompendo.")
                        return 1
                else:
                    print("Falha ao clicar Registrar — interrompendo.")
                    return 1

            cls = await processar_retorno(page)
            print(
                f"Resultado: {cls.tipo} | CareCore->{cls.status_carecore} | {cls.mensagem}"
            )
            if cls.trecho and cls.trecho != cls.mensagem:
                print(f"  trecho: {cls.trecho[:180]}")

            resultados.append(
                {
                    "chave": chave,
                    "tipo": cls.tipo,
                    "status_carecore": cls.status_carecore,
                    "mensagem": cls.mensagem,
                    "trecho": cls.trecho,
                }
            )

            if cls.tipo == "sessao_caiu":
                print(
                    "Sessao caiu. Refaca login e rode de novo com --inicio",
                    i - 1 + int(args.inicio),
                )
                break

            if resultado_operacional_ok(cls):
                ok_count += 1
                if cls.tipo == "ja_existe":
                    ja_existe_count += 1
                    print("  → tratado como ja resolvido; seguindo para a proxima.")
            elif cls.tipo == "erro":
                erro_count += 1
                if args.parar_em_erro:
                    print("Parando por --parar-em-erro.")
                    break
            else:
                # inconclusivo: segue, mas nao conta como ok
                print("  → inconclusivo; segue (revise o log depois).")

            if _parada_solicitada():
                print("Parada solicitada pelo CareCore — encerrando.")
                parado_pelo_usuario = True
                break

            if i < len(fila):
                await page.wait_for_timeout(int(args.pausa * 1000))

        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_json = out_dir / f"fila_resultado_{stamp}.json"
        out_json.write_text(
            json.dumps(
                {
                    "gerado_em": stamp,
                    "resumo": {
                        "total": len(resultados),
                        "ok_operacional": ok_count,
                        "ja_existe": ja_existe_count,
                        "erro": erro_count,
                        "parado_pelo_usuario": parado_pelo_usuario,
                    },
                    "itens": resultados,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(
            f"\nConcluido: ok={ok_count} (ja_existe={ja_existe_count}) "
            f"erro={erro_count} / processados={len(resultados)}"
            + (" (parado)" if parado_pelo_usuario else "")
        )
        print(f"Log: {out_json}")
    try:
        STOP_FLAG.unlink(missing_ok=True)
    except OSError:
        pass
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Envia fila de chaves NFP (Registrar Doacao).")
    parser.add_argument("--planilha", default=str(PLANILHA_PADRAO))
    parser.add_argument("--json", default="", help="Arquivo exportado do CareCore (pendentes)")
    parser.add_argument("--chave", default="")
    parser.add_argument("--inicio", type=int, default=0)
    parser.add_argument("--cdp", default=CDP_PADRAO)
    parser.add_argument("--pausa", type=float, default=1.5, help="Segundos entre envios")
    parser.add_argument("--url", default="https://www.nfp.fazenda.sp.gov.br/")
    parser.add_argument("--channel", default="")
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Inicia sem pedir Enter no terminal",
    )
    parser.add_argument(
        "--parar-em-erro",
        action="store_true",
        help="Interrompe a fila no primeiro erro real (nao aplica a 'ja existe')",
    )
    return asyncio.run(rodar(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())
