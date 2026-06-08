# =====================================================================
# ARQUIVO: billing.py
# Regras comerciais de contagem e mensalidade CareCore+
# =====================================================================
from __future__ import annotations

from datetime import date, datetime
from typing import Iterable, Mapping, Sequence

BLOCO_CADASTROS = 100
VALOR_BLOCO = 500
TETO_DESCONTO = 1000
DESCONTO_INICIAL_PERCENTUAL = 20
INCREMENTO_DESCONTO_POR_BLOCO = 55 / 9
DESCONTO_MAXIMO_PERCENTUAL = 75
"""Dias mínimos entre inativação e fechamento para o cadastro sair da conta."""
DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO = 15


def desconto_percentual_degrau(indice_degrau: int) -> float:
    desconto = DESCONTO_INICIAL_PERCENTUAL + (indice_degrau - 1) * INCREMENTO_DESCONTO_POR_BLOCO
    return min(DESCONTO_MAXIMO_PERCENTUAL, desconto)


def valor_bloco_degrau(indice_degrau: int) -> float:
    desconto = desconto_percentual_degrau(indice_degrau)
    return VALOR_BLOCO * (1 - desconto / 100)


def calcular_mensalidade(total_cadastros_faturaveis: int) -> float:
    total = max(0, int(total_cadastros_faturaveis or 0))

    if total == 0:
        return 0.0

    if total <= TETO_DESCONTO:
        return ((total + BLOCO_CADASTROS - 1) // BLOCO_CADASTROS) * VALOR_BLOCO

    blocos_extras = (total - TETO_DESCONTO + BLOCO_CADASTROS - 1) // BLOCO_CADASTROS
    base_ate_mil = (TETO_DESCONTO // BLOCO_CADASTROS) * VALOR_BLOCO
    extras = sum(valor_bloco_degrau(degrau) for degrau in range(1, blocos_extras + 1))
    return base_ate_mil + extras


def _data_inativacao(inativado_em: datetime | date | None) -> date | None:
    if inativado_em is None:
        return None
    if isinstance(inativado_em, datetime):
        return inativado_em.date()
    return inativado_em


def cadastro_conta_para_faturamento(
    *,
    ativo: bool,
    inativado_em: datetime | date | None,
    data_fechamento: date,
    dias_antecedencia_exclusao: int = DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO,
) -> bool:
    """
    Define se um cadastro entra na cobrança na data de fechamento.

    - Ativos: sempre entram.
    - Inativos: só entram se foram inativados há menos de 15 dias antes do fechamento
      (ex.: inativado 14 dias antes ainda compõe; 15 dias antes ou mais, não compõe).
    """
    if ativo:
        return True

    data_inativacao = _data_inativacao(inativado_em)
    if data_inativacao is None:
        return False

    dias_antes_do_fechamento = (data_fechamento - data_inativacao).days
    return dias_antes_do_fechamento < dias_antecedencia_exclusao


def contar_cadastros_faturaveis(
    cadastros: Sequence[Mapping[str, object]],
    data_fechamento: date,
) -> int:
    total = 0

    for cadastro in cadastros:
        if cadastro_conta_para_faturamento(
            ativo=bool(cadastro.get("ativo")),
            inativado_em=cadastro.get("inativado_em"),  # type: ignore[arg-type]
            data_fechamento=data_fechamento,
        ):
            total += 1

    return total


def convivente_conta_para_faturamento(
    *,
    status: str,
    inativado_em: datetime | date | None,
    data_fechamento: date,
) -> bool:
    return cadastro_conta_para_faturamento(
        ativo=(status or "").strip() == "Ativo",
        inativado_em=inativado_em,
        data_fechamento=data_fechamento,
    )


def usuario_conta_para_faturamento(
    *,
    ativo: bool,
    inativado_em: datetime | date | None,
    data_fechamento: date,
) -> bool:
    return cadastro_conta_para_faturamento(
        ativo=ativo,
        inativado_em=inativado_em,
        data_fechamento=data_fechamento,
    )
