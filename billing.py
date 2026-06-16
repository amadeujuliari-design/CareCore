# =====================================================================
# ARQUIVO: billing.py
# Regras comerciais de contagem e mensalidade CareCore+
# =====================================================================
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, ROUND_FLOOR
from typing import Iterable, Mapping, Sequence

BLOCO_CADASTROS = 100
VALOR_BLOCO = 500
CADASTROS_SEM_DESCONTO = 500
CADASTROS_TETO_DESCONTO = 3000
DESCONTO_INICIAL_PERCENTUAL = 5
DESCONTO_MAXIMO_PERCENTUAL = 75
EXPOENTE_CURVA_DESCONTO = 0.5746292138076721
"""Dias mínimos entre inativação e fechamento para o cadastro sair da conta."""
DIAS_ANTECEDENCIA_EXCLUSAO_INATIVO = 15


def desconto_percentual_degrau(indice_degrau: int) -> float:
    if indice_degrau <= 0:
        return 0.0

    bloco_inicio_desconto = (CADASTROS_SEM_DESCONTO // BLOCO_CADASTROS) + 1
    bloco_teto_desconto = CADASTROS_TETO_DESCONTO // BLOCO_CADASTROS

    if indice_degrau < bloco_inicio_desconto:
        return 0.0
    if indice_degrau >= bloco_teto_desconto:
        return DESCONTO_MAXIMO_PERCENTUAL

    progresso = (indice_degrau - bloco_inicio_desconto) / (bloco_teto_desconto - bloco_inicio_desconto)
    desconto = DESCONTO_INICIAL_PERCENTUAL + (
        (DESCONTO_MAXIMO_PERCENTUAL - DESCONTO_INICIAL_PERCENTUAL)
        * (progresso ** EXPOENTE_CURVA_DESCONTO)
    )
    return min(DESCONTO_MAXIMO_PERCENTUAL, desconto)


def valor_bloco_degrau(indice_degrau: int) -> float:
    desconto = desconto_percentual_degrau(indice_degrau)
    return VALOR_BLOCO * (1 - desconto / 100)


def calcular_mensalidade(total_cadastros_faturaveis: int) -> float:
    total = max(0, int(total_cadastros_faturaveis or 0))

    if total == 0:
        return 0.0

    total_blocos = (total + BLOCO_CADASTROS - 1) // BLOCO_CADASTROS
    mensalidade = sum(valor_bloco_degrau(bloco) for bloco in range(1, total_blocos + 1))
    return round(mensalidade, 2)


def _centavos(valor: float | Decimal) -> int:
    decimal = Decimal(str(valor))
    return int((decimal * 100).quantize(Decimal("1"), rounding=ROUND_FLOOR))


def _ratear_centavos(valor_total: float, pesos: Sequence[int]) -> list[float]:
    if not pesos:
        return []

    total_pesos = sum(max(0, int(peso or 0)) for peso in pesos)
    if total_pesos <= 0:
        return [0.0 for _ in pesos]

    total_centavos = _centavos(valor_total)
    cotas = []
    centavos_alocados = 0

    for indice, peso in enumerate(pesos):
        peso_normalizado = max(0, int(peso or 0))
        bruto = (Decimal(total_centavos) * Decimal(peso_normalizado)) / Decimal(total_pesos)
        base = int(bruto.quantize(Decimal("1"), rounding=ROUND_FLOOR))
        resto = bruto - Decimal(base)
        centavos_alocados += base
        cotas.append({
            "indice": indice,
            "centavos": base,
            "resto": resto,
        })

    centavos_restantes = total_centavos - centavos_alocados
    cotas_ordenadas = sorted(cotas, key=lambda item: item["resto"], reverse=True)
    for item in cotas_ordenadas[:centavos_restantes]:
        item["centavos"] += 1

    cotas_por_indice = sorted(cotas, key=lambda item: item["indice"])
    return [item["centavos"] / 100 for item in cotas_por_indice]


def calcular_rateio_organizacao(projetos: Sequence[Mapping[str, object]]) -> dict:
    """
    Calcula a cobrança mensal da organização e a divisão por projeto.

    - Até 500 cadastros na organização: cada projeto é cobrado pela sua própria
      faixa/bloco, sem rateio por quantidade exata.
    - A partir de 501 cadastros na organização: calcula a mensalidade consolidada
      pela tabela progressiva e rateia pelo número exato de cadastros faturáveis
      de cada projeto.
    """
    projetos_normalizados = []
    for projeto in projetos:
        cadastros = max(0, int(projeto.get("cadastros_faturaveis") or 0))
        projeto_normalizado = dict(projeto)
        projeto_normalizado.update({
            "projeto_id": projeto.get("projeto_id"),
            "projeto_nome": projeto.get("projeto_nome"),
            "cadastros_faturaveis": cadastros,
        })
        projetos_normalizados.append(projeto_normalizado)

    total_cadastros = sum(projeto["cadastros_faturaveis"] for projeto in projetos_normalizados)

    if total_cadastros <= CADASTROS_SEM_DESCONTO:
        projetos_calculados = []
        valor_total = 0.0
        for projeto in projetos_normalizados:
            valor = calcular_mensalidade(projeto["cadastros_faturaveis"])
            valor_total += valor
            projetos_calculados.append({
                **projeto,
                "percentual_rateio": None,
                "valor_mensalidade": valor,
            })

        return {
            "modo": "individual_por_projeto",
            "limite_rateio_cadastros": CADASTROS_SEM_DESCONTO,
            "total_cadastros_faturaveis": total_cadastros,
            "valor_total_mensalidade": round(valor_total, 2),
            "projetos": projetos_calculados,
        }

    valor_total = calcular_mensalidade(total_cadastros)
    valores_rateados = _ratear_centavos(
        valor_total,
        [projeto["cadastros_faturaveis"] for projeto in projetos_normalizados],
    )

    projetos_calculados = []
    for projeto, valor in zip(projetos_normalizados, valores_rateados):
        percentual = (
            (projeto["cadastros_faturaveis"] / total_cadastros) * 100
            if total_cadastros
            else 0
        )
        projetos_calculados.append({
            **projeto,
            "percentual_rateio": round(percentual, 4),
            "valor_mensalidade": valor,
        })

    return {
        "modo": "rateio_organizacao",
        "limite_rateio_cadastros": CADASTROS_SEM_DESCONTO,
        "total_cadastros_faturaveis": total_cadastros,
        "valor_total_mensalidade": valor_total,
        "projetos": projetos_calculados,
    }


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
