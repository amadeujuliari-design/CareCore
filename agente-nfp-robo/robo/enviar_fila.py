#!/usr/bin/env python3
"""
Robo NFP — envia fila de chaves (preencher + Salvar Nota).

Fluxo oficial do operador (representante ONG — NAO doacao de consumidor):
  1) Chrome com depuracao (porta 9222)
  2) Login/CAPTCHA ate a tela inicial (principal / Bem-vindo)
  3) Entidades → Cadastramento de Cupons → Prosseguir → AEB → Nova Nota
     → chave → Salvar Nota; se voltar ao inicio, recupera o mesmo caminho

Trata tambem:
  - popup "Deseja doar todos os documentos...?" → clica Nao
  - aviso "nao mostrar de novo" (chave 44 digitos, Sim/Nao) → clica Sim
  - "Este pedido já existe no sistema..." → ja resolvido (enviado)
  - sucesso / prazo / erros da SEFAZ
  - se cair no fluxo consumidor (bloqueio terceiros) → para sem martelar

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
from contador_estado import marcar_fim, registrar_item  # noqa: E402
from navegar_doacao_aeb import (  # noqa: E402
    bloqueio_doacao_terceiros_sefaz,
    fechar_modal_instrutivo,
    garantir_tela_doacao_aeb,
    sessao_nfp_caiu,
    tela_pronta_para_enviar,
)
from preencher_sem_enviar import (  # noqa: E402
    CDP_PADRAO,
    PLANILHA_PADRAO,
    aguardar_classificacao_retorno,
    classificar_retorno_pagina,
    clicar_registrar,
    coletar_texto_retorno,
    conectar_navegador,
    escolher_pagina,
    fechar_modal_mensagem,
    preencher_chave,
)
from retorno_nfp import resultado_operacional_ok  # noqa: E402
from validar_chave_acesso import validar_chave_acesso_nfe  # noqa: E402

try:
    from captura_tela_sefaz import captura_tela_habilitada, gravar_captura_sefaz  # noqa: E402
    from ler_formulario_sefaz import (  # noqa: E402
        aguardar_e_ler_formulario_sefaz,
        captura_metadados_habilitada,
    )
except ImportError:
    async def gravar_captura_sefaz(*_a, **_k):  # type: ignore[misc]
        return None

    def captura_tela_habilitada() -> bool:
        return False

    async def aguardar_e_ler_formulario_sefaz(*_a, **_k):  # type: ignore[misc]
        return {}

    def captura_metadados_habilitada() -> bool:
        return False

STOP_FLAG = Path(__file__).resolve().parent / "_capturas" / "fila_parar.flag"


def _parada_solicitada() -> bool:
    return STOP_FLAG.is_file()


def _gravar_resultado_lote(
    out_dir: Path,
    *,
    resultados: list[dict],
    fila_total: int,
    ok_count: int,
    ja_existe_count: int,
    erro_count: int,
    parado_pelo_usuario: bool,
    motivo_interrupcao: str,
    lote_origem: str = "",
) -> Path:
    """Sempre grava JSON do lote (mesmo parcial) para o orquestrador nao reusar lote antigo."""
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_json = out_dir / f"fila_resultado_{stamp}.json"
    motivo = (motivo_interrupcao or "").strip()
    if not motivo:
        if len(resultados) >= fila_total and fila_total > 0:
            motivo = "lote_completo"
        else:
            motivo = "lote_parcial"
    payload = {
        "gerado_em": stamp,
        "lote_origem": lote_origem or "",
        "resumo": {
            "total": len(resultados),
            "fila_total": fila_total,
            "ok_operacional": ok_count,
            "ja_existe": ja_existe_count,
            "erro": erro_count,
            "parado_pelo_usuario": parado_pelo_usuario,
            "motivo_interrupcao": motivo,
        },
        "itens": resultados,
    }
    out_json.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(
        f"\nConcluido: ok={ok_count} (ja_existe={ja_existe_count}) "
        f"erro={erro_count} / processados={len(resultados)}/{fila_total}"
        f" motivo={motivo}"
        + (" (parado)" if parado_pelo_usuario else "")
    )
    print(f"Log: {out_json}")
    return out_json


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


async def processar_retorno(page, *, texto_antes: str = "") -> object:
    """Aguarda pos-envio, classifica mensagem (modal OU banner inline) e fecha modais se houver."""
    await page.wait_for_timeout(100)
    # Cadastro entidade: sucesso aparece em texto azul no topo, sem modal.
    cls = await aguardar_classificacao_retorno(
        page, timeout_ms=6000, intervalo_ms=200, texto_antes=texto_antes
    )
    if cls.tipo == "inconclusivo":
        cls = await aguardar_classificacao_retorno(
            page, timeout_ms=4000, intervalo_ms=250, texto_antes=texto_antes
        )

    # Bloqueio de conta: nao clicar Ok (e nao retomar Nova Doacao depois).
    if cls.tipo == "bloqueio_sefaz" or await bloqueio_doacao_terceiros_sefaz(page):
        if cls.tipo != "bloqueio_sefaz":
            from retorno_nfp import ClassificacaoRetorno

            cls = ClassificacaoRetorno(
                tipo="bloqueio_sefaz",
                mensagem=(
                    "SEFAZ bloqueou a doacao (indicios de notas de terceiros). "
                    "Parando sem fechar o modal."
                ),
                status_carecore="pendente",
            )
        print("Bloqueio SEFAZ detectado — mantendo modal; encerrar sessao.")
        return cls

    # Sucesso/erro inline: nao ha Ok para clicar — so fecha se existir modal.
    await fechar_popup_doacao_automatica(page)
    await fechar_modal_instrutivo(page)
    await fechar_modal_mensagem(page)
    if cls.status_carecore == "rejeitado_prazo":
        await page.wait_for_timeout(100)
        await fechar_modal_mensagem(page)
    return cls


async def _posicionar_tela(page, *, rotulo: str) -> str:
    """Garante Cadastro+AEB. Se ja estiver no formulario, nao refaz menu/Nova Nota.

    Retorna: 'ok' | 'sessao_caiu' | 'bloqueio_sefaz' | 'falha' | 'parada_usuario'
    """
    if _parada_solicitada():
        return "parada_usuario"
    if await sessao_nfp_caiu(page):
        return "sessao_caiu"
    if await bloqueio_doacao_terceiros_sefaz(page):
        return "bloqueio_sefaz"
    # Caminho quente: apos Salvar Nota a SEFAZ costuma manter Cadastro + AEB.
    if await tela_pronta_para_enviar(page, fechar_modais=False):
        return "ok"
    if await garantir_tela_doacao_aeb(page):
        return "ok"
    if await bloqueio_doacao_terceiros_sefaz(page):
        return "bloqueio_sefaz"
    if await sessao_nfp_caiu(page):
        return "sessao_caiu"
    print(f"Falha ao posicionar Cadastro de Notas/AEB ({rotulo}).")
    return "falha"


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
    print(
        "Rotina inicial: Entidades → Cadastramento de Cupons → Prosseguir → AEB → Nova Nota."
    )
    print("Envio com Salvar Nota (representante ONG). Nao usa Doacao de Cupons sem CPF.")
    print("Se ja estiver no cadastro com AEB, so preenche chave (sem refazer menu).")
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
    lote_origem = Path(args.json).name if args.json else ""
    # Limpa flag antiga para nao abortar logo no inicio
    try:
        STOP_FLAG.unlink(missing_ok=True)
    except OSError:
        pass

    parado_pelo_usuario = False
    motivo_interrupcao = ""
    ok_count = 0
    ja_existe_count = 0
    erro_count = 0
    codigo_saida = 0
    gravou_resultado = False

    async with async_playwright() as p:
        browser, page, usar_cdp = await conectar_navegador(p, args)
        if page is None:
            motivo_interrupcao = "falha_conectar"
            codigo_saida = 1
        else:
            print(
                "Rotina inicial: posicionando Cadastro de Notas (representante) + AEB..."
            )
            estado0 = await _posicionar_tela(page, rotulo="inicio")
            if estado0 == "sessao_caiu":
                print("ERRO: sessao NFP caiu (login). Autentique manualmente e rode de novo.")
                motivo_interrupcao = "sessao_caiu"
                codigo_saida = 1
            elif estado0 == "bloqueio_sefaz":
                print(
                    "ERRO: SEFAZ mostrou bloqueio de doacao de *consumidor*. "
                    "Feche o modal, va em Entidades → Cadastramento de Cupons e rode de novo."
                )
                motivo_interrupcao = "bloqueio_sefaz"
                codigo_saida = 1
            elif estado0 == "parada_usuario":
                print("Parada solicitada antes de iniciar.")
                parado_pelo_usuario = True
                motivo_interrupcao = "parada_usuario"
                codigo_saida = 0
            elif estado0 != "ok":
                print(
                    "ERRO: nao consegui posicionar Cadastro de Notas com AEB. "
                    "Confirme login na NFP (Bem-vindo) e tente de novo."
                )
                motivo_interrupcao = "falha_tela"
                codigo_saida = 1
            else:
                print("Rotina inicial ok — iniciando envios (Salvar Nota).")

                for i, item in enumerate(fila, start=1):
                    if _parada_solicitada():
                        print("Parada solicitada pelo CareCore — encerrando apos o item atual.")
                        parado_pelo_usuario = True
                        motivo_interrupcao = "parada_usuario"
                        break

                    if usar_cdp and browser.contexts:
                        page = await escolher_pagina(browser.contexts[0])

                    estado = await _posicionar_tela(page, rotulo=f"item {i}")
                    if estado == "parada_usuario":
                        parado_pelo_usuario = True
                        motivo_interrupcao = "parada_usuario"
                        break
                    if estado == "sessao_caiu":
                        motivo_interrupcao = "sessao_caiu"
                        print("Sessao caiu — interrompendo (login manual).")
                        break
                    if estado == "bloqueio_sefaz":
                        motivo_interrupcao = "bloqueio_sefaz"
                        print("Bloqueio SEFAZ — interrompendo (nao retomar menu/Nova Doacao).")
                        break
                    if estado != "ok":
                        motivo_interrupcao = "falha_tela"
                        codigo_saida = 1
                        print(
                            "Falha ao recuperar Cadastro de Notas/AEB — interrompendo. "
                            f"Retome com --inicio {i - 1 + int(args.inicio)}"
                        )
                        break

                    chave = item["chave"]
                    print(f"\n[{i}/{len(fila)}] {chave}")
                    ok_chave, motivo_chave = validar_chave_acesso_nfe(chave)
                    if not ok_chave:
                        msg = (
                            (motivo_chave or "Chave estruturalmente invalida.")
                            + " Removida da fila de envio SEFAZ."
                        )
                        print(f"  → {msg}")
                        resultados.append(
                            {
                                "chave": chave,
                                "tipo": "erro",
                                "status_carecore": "erro",
                                "mensagem": msg[:2000],
                                "trecho": "",
                            }
                        )
                        try:
                            registrar_item(
                                tipo="erro",
                                status_carecore="erro",
                                mensagem=msg,
                                chave=chave,
                            )
                        except Exception:
                            pass
                        erro_count += 1
                        # Nao para a sessao: grava erro e segue as demais chaves.
                        if i < len(fila):
                            await page.wait_for_timeout(int(args.pausa * 1000))
                        continue

                    if not await preencher_chave(page, chave):
                        print("Campo chave sumiu — tentando recuperar tela e repetir uma vez...")
                        estado_r = await _posicionar_tela(page, rotulo="retry preencher")
                        if estado_r == "bloqueio_sefaz":
                            motivo_interrupcao = "bloqueio_sefaz"
                            print("Bloqueio SEFAZ no retry — parando.")
                            break
                        if estado_r == "ok" and await preencher_chave(page, chave):
                            pass
                        else:
                            print("Falha ao preencher — interrompendo.")
                            motivo_interrupcao = "falha_preencher"
                            codigo_saida = 1
                            break

                    meta_sefaz: dict = {}
                    if captura_metadados_habilitada():
                        try:
                            meta_sefaz = await aguardar_e_ler_formulario_sefaz(page)
                        except Exception:
                            meta_sefaz = {}

                    if captura_tela_habilitada():
                        await gravar_captura_sefaz(
                            page, etapa="01_apos_chave", chave=chave, meta=meta_sefaz
                        )

                    # Snapshot antes do Salvar: sucesso fica inline e nao some sozinho.
                    try:
                        texto_antes = await coletar_texto_retorno(page)
                    except Exception:
                        texto_antes = ""

                    if not await clicar_registrar(page):
                        print("Salvar Nota falhou — tentando recuperar tela e repetir uma vez...")
                        estado_r = await _posicionar_tela(page, rotulo="retry salvar")
                        if estado_r == "bloqueio_sefaz":
                            motivo_interrupcao = "bloqueio_sefaz"
                            print("Bloqueio SEFAZ no retry — parando.")
                            break
                        if estado_r == "ok":
                            if not await preencher_chave(page, chave):
                                print("Falha ao preencher apos recuperacao — interrompendo.")
                                motivo_interrupcao = "falha_preencher"
                                codigo_saida = 1
                                break
                            try:
                                texto_antes = await coletar_texto_retorno(page)
                            except Exception:
                                texto_antes = ""
                            if not await clicar_registrar(page):
                                print("Falha ao clicar Salvar Nota — interrompendo.")
                                motivo_interrupcao = "falha_registrar"
                                codigo_saida = 1
                                break
                        else:
                            print("Falha ao clicar Salvar Nota — interrompendo.")
                            motivo_interrupcao = "falha_registrar"
                            codigo_saida = 1
                            break

                    cls = await processar_retorno(page, texto_antes=texto_antes)
                    if captura_tela_habilitada():
                        await gravar_captura_sefaz(
                            page,
                            etapa="02_apos_retorno",
                            chave=chave,
                            meta={**meta_sefaz, "tipo_retorno": cls.tipo, "mensagem": cls.mensagem},
                        )
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
                            "tipo_retorno_sefaz": cls.tipo,
                            **meta_sefaz,
                        }
                    )
                    try:
                        registrar_item(
                            tipo=cls.tipo,
                            status_carecore=cls.status_carecore,
                            mensagem=cls.mensagem,
                            chave=chave,
                        )
                    except Exception:
                        pass

                    if cls.tipo == "sessao_caiu":
                        motivo_interrupcao = "sessao_caiu"
                        print(
                            "Sessao caiu. Refaca login e rode de novo com --inicio",
                            i - 1 + int(args.inicio),
                        )
                        break

                    if cls.tipo == "bloqueio_sefaz":
                        motivo_interrupcao = "bloqueio_sefaz"
                        print(
                            "Bloqueio SEFAZ — encerrando fila. "
                            "Nao vou clicar Ok nem reabrir Nova Doacao."
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
                            motivo_interrupcao = "parar_em_erro"
                            print("Parando por --parar-em-erro.")
                            break
                    else:
                        # inconclusivo: segue, mas nao conta como ok
                        print("  → inconclusivo; segue (revise o log depois).")

                    if _parada_solicitada():
                        print("Parada solicitada pelo CareCore — encerrando.")
                        parado_pelo_usuario = True
                        motivo_interrupcao = "parada_usuario"
                        break

                    if i < len(fila):
                        await page.wait_for_timeout(int(args.pausa * 1000))

        # Sempre grava — inclusive lote parcial / falha no meio — para sincronizar CareCore.
        try:
            _gravar_resultado_lote(
                out_dir,
                resultados=resultados,
                fila_total=len(fila),
                ok_count=ok_count,
                ja_existe_count=ja_existe_count,
                erro_count=erro_count,
                parado_pelo_usuario=parado_pelo_usuario,
                motivo_interrupcao=motivo_interrupcao,
                lote_origem=lote_origem,
            )
            gravou_resultado = True
        except Exception as exc:
            print(f"ERRO ao gravar fila_resultado: {exc}", file=sys.stderr)

    if not gravou_resultado:
        try:
            _gravar_resultado_lote(
                out_dir,
                resultados=resultados,
                fila_total=len(fila),
                ok_count=ok_count,
                ja_existe_count=ja_existe_count,
                erro_count=erro_count,
                parado_pelo_usuario=parado_pelo_usuario,
                motivo_interrupcao=motivo_interrupcao or "falha_sem_gravacao",
                lote_origem=lote_origem,
            )
        except Exception as exc:
            print(f"ERRO ao gravar fila_resultado (fallback): {exc}", file=sys.stderr)

    try:
        marcar_fim(mensagem=f"Fim do lote — motivo={motivo_interrupcao or 'ok'}")
    except Exception:
        pass
    try:
        STOP_FLAG.unlink(missing_ok=True)
    except OSError:
        pass
    return codigo_saida


def main() -> int:
    parser = argparse.ArgumentParser(description="Envia fila de chaves NFP (Registrar Doacao).")
    parser.add_argument("--planilha", default=str(PLANILHA_PADRAO))
    parser.add_argument("--json", default="", help="Arquivo exportado do CareCore (pendentes)")
    parser.add_argument("--chave", default="")
    parser.add_argument("--inicio", type=int, default=0)
    parser.add_argument("--cdp", default=CDP_PADRAO)
    parser.add_argument(
        "--pausa",
        type=float,
        default=0.75,
        help="Segundos entre envios (padrao 0.75; a SEFAZ ja demora no Salvar)",
    )
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
