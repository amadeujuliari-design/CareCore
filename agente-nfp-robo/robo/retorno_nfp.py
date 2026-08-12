#!/usr/bin/env python3
"""Classificacao das mensagens de retorno do cadastro NFP (SEFAZ).

No fluxo CadastroNotaEntidade (representante ONG) as msgs principais sao
INLINE no topo do formulario (sem modal):
  - sucesso: "Doação registrada com sucesso. Aguardando processamento..."
  - ja existe: "Este pedido já existe no sistema. Favor inserir uma nova nota."
  - prazo: "A Data da Nota excedeu o prazo máximo para cadastro."
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

ResultadoTipo = Literal[
    "sucesso",
    "ja_existe",
    "erro",
    "sessao_caiu",
    "bloqueio_sefaz",
    "inconclusivo",
]

# CadastroNotaEntidade.aspx (inline) — 2026-08-12
MSG_PEDIDO_JA_EXISTE = "Este pedido já existe no sistema. Favor inserir uma nova nota."
MSG_SUCESSO = (
    "Doação registrada com sucesso. Aguardando processamento pelo sistema."
)
MSG_PRAZO = "A Data da Nota excedeu o prazo máximo para cadastro."

RE_JA_EXISTE = re.compile(
    r"este\s+pedido\s+j[aá]\s+existe|"
    r"pedido\s+j[aá]\s+existe\s+no\s+sistema|"
    r"j[aá]\s+existe\s+no\s+sistema|"
    r"favor\s+inserir\s+uma\s+nova\s+nota|"
    r"nota\s+j[aá]\s+(?:foi\s+)?(?:doad|cadastrad|utiliz|inserid)",
    re.I,
)

RE_SUCESSO = re.compile(
    r"doa[cç][aã]o\s+registrada\s+com\s+sucesso|"
    r"aguardando\s+processamento\s+pelo\s+sistema|"
    r"doa[cç][aã]o\s+(?:registrad|realizad|efetuad|conclu[ií]d)|"
    r"nota\s+(?:cadastrad|salv|registrad|inclu[ií]d)[oa]\s+com\s+sucesso|"
    r"cadastr[oa]\s+(?:da\s+)?nota\s+(?:realizado|efetuado|conclu[ií]do)|"
    r"registrad[oa]\s+com\s+sucesso|"
    r"realizad[oa]\s+com\s+sucesso|"
    r"efetuad[oa]\s+com\s+sucesso|"
    r"inclu[ií]d[oa]\s+com\s+sucesso|"
    r"cadastrad[oa]\s+com\s+sucesso|"
    r"opera[cç][aã]o\s+realizada\s+com\s+sucesso|"
    r"documento\s+(?:doado|inclu[ií]do|registrado|cadastrado)\s+com\s+sucesso|"
    r"nota\s+doada\s+com\s+sucesso|"
    r"pedido\s+registrado",
    re.I,
)

RE_ERRO = re.compile(
    r"chave\s+(?:inv[aá]lid|incorret)|"
    r"documento\s+inv[aá]lid|"
    r"n[aã]o\s+foi\s+poss[ií]vel|"
    r"cpf\s+inv[aá]lid",
    re.I,
)

# Inline: "A Data da Nota excedeu o prazo máximo para cadastro."
RE_PRAZO = re.compile(
    r"a\s+data\s+da\s+nota\s+excedeu|"
    r"excedeu\s+o\s+prazo|"
    r"prazo\s+m[aá]ximo\s+para\s+cadastro|"
    r"fora\s+do\s+prazo|"
    r"data\s+da\s+nota\s+excedeu",
    re.I,
)

# Conta bloqueada: indicios de doacao de notas de terceiros (parar tudo)
RE_BLOQUEIO_TERCEIROS = re.compile(
    r"ind[ií]cios\s+de\s+que\s+o\s+consumidor|"
    r"n[aã]o\s+eram\s+referentes\s+[aà]s\s+suas\s+pr[oó]prias|"
    r"funcionalidade\s+indispon[ií]vel.{0,120}(?:ind[ií]cios|referentes)",
    re.I | re.S,
)


@dataclass
class ClassificacaoRetorno:
    tipo: ResultadoTipo
    mensagem: str
    # Status sugerido para a fila CareCore (nfp_cupons_lidos.status)
    status_carecore: str  # enviado | erro | pendente | rejeitado_prazo
    trecho: str = ""


def normalizar_texto(texto: str) -> str:
    return " ".join((texto or "").split())


def classificar_texto_retorno(texto: str, *, url: str = "") -> ClassificacaoRetorno:
    if "login" in (url or "").lower():
        return ClassificacaoRetorno(
            tipo="sessao_caiu",
            mensagem="Sessão NFP caiu (redirecionou para login).",
            status_carecore="pendente",
            trecho=url,
        )

    compacto = normalizar_texto(texto)
    if not compacto:
        return ClassificacaoRetorno(
            tipo="inconclusivo",
            mensagem="Retorno vazio — não foi possível classificar.",
            status_carecore="pendente",
        )

    # Bloqueio de conta: parar imediatamente (antes de sucesso/erro generico).
    if RE_BLOQUEIO_TERCEIROS.search(compacto):
        trecho = _extrair_trecho(compacto, RE_BLOQUEIO_TERCEIROS) or compacto[:280]
        return ClassificacaoRetorno(
            tipo="bloqueio_sefaz",
            mensagem=(
                "SEFAZ bloqueou a doacao (indicios de notas que nao sao do consumidor). "
                "Nao retomar menu/Nova Doacao nesta sessao."
            ),
            status_carecore="pendente",
            trecho=trecho,
        )

    # Sucesso ANTES de "já existe": o DOM da NFP costuma manter o modal Erro
    # antigo com "já existe" enquanto o modal Mensagem mostra o sucesso real
    # (+ pergunta "Deseja doar todos os documentos...?").
    if RE_SUCESSO.search(compacto):
        return ClassificacaoRetorno(
            tipo="sucesso",
            mensagem=MSG_SUCESSO,
            status_carecore="enviado",
            trecho=_extrair_trecho(compacto, RE_SUCESSO),
        )

    if RE_JA_EXISTE.search(compacto):
        return ClassificacaoRetorno(
            tipo="ja_existe",
            mensagem=MSG_PEDIDO_JA_EXISTE,
            status_carecore="enviado",
            trecho=_extrair_trecho(compacto, RE_JA_EXISTE),
        )

    if RE_PRAZO.search(compacto):
        trecho = _extrair_trecho(compacto, RE_PRAZO) or compacto[:240]
        return ClassificacaoRetorno(
            tipo="erro",
            mensagem=trecho,
            status_carecore="rejeitado_prazo",
            trecho=trecho,
        )

    if RE_ERRO.search(compacto):
        return ClassificacaoRetorno(
            tipo="erro",
            mensagem=_extrair_trecho(compacto, RE_ERRO) or "Erro retornado pela NFP.",
            status_carecore="erro",
            trecho=_extrair_trecho(compacto, RE_ERRO),
        )

    # Modal genérico de Erro sem padrão conhecido
    if re.search(r"\berro\b", compacto, re.I) and "pedido" in compacto.lower():
        return ClassificacaoRetorno(
            tipo="erro",
            mensagem=compacto[:240],
            status_carecore="erro",
            trecho=compacto[:240],
        )

    return ClassificacaoRetorno(
        tipo="inconclusivo",
        mensagem="Retorno não reconhecido — revisar manualmente.",
        status_carecore="pendente",
        trecho=compacto[:280],
    )


def _extrair_trecho(texto: str, padrao: re.Pattern[str]) -> str:
    m = padrao.search(texto)
    if not m:
        return ""
    ini = max(0, m.start() - 20)
    fim = min(len(texto), m.end() + 80)
    return texto[ini:fim].strip()


def resultado_operacional_ok(cls: ClassificacaoRetorno) -> bool:
    """Sucesso novo ou pedido já existente: ambos saem da fila operacional."""
    return cls.tipo in {"sucesso", "ja_existe"}
