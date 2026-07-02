"""Regras de remanejamento TB e reserva de leito fixo."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import ConviventeDB, LeitoDB, QuartoDB

MODALIDADE_FIXO = "Fixo"
MODALIDADE_TRANSITORIO = "Transitorio"
MODALIDADE_TB_SUSPEITA = "TB_Suspeita"
MODALIDADE_TB_CONFIRMADO = "TB_Confirmado"

MODALIDADES_QUARTO_VALIDAS = frozenset({
    MODALIDADE_FIXO,
    MODALIDADE_TRANSITORIO,
    MODALIDADE_TB_SUSPEITA,
    MODALIDADE_TB_CONFIRMADO,
})

SITUACOES_TB_REMANEJAMENTO = frozenset({"Suspeita", "Confirmado"})

MAPA_SITUACAO_MODALIDADE = {
    "Suspeita": MODALIDADE_TB_SUSPEITA,
    "Confirmado": MODALIDADE_TB_CONFIRMADO,
}


def modalidade_eh_tb(modalidade: str | None) -> bool:
    return modalidade in {MODALIDADE_TB_SUSPEITA, MODALIDADE_TB_CONFIRMADO}


def modalidade_eh_fixo(modalidade: str | None) -> bool:
    return modalidade == MODALIDADE_FIXO


async def obter_quarto_do_leito(
    db: AsyncSession,
    leito_id: str | None,
    instituicao_id: str,
) -> QuartoDB | None:
    if not leito_id:
        return None
    return (
        await db.execute(
            select(QuartoDB)
            .join(LeitoDB, LeitoDB.quarto_id == QuartoDB.id)
            .where(
                LeitoDB.id == leito_id,
                QuartoDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()


async def validar_leito_tb_para_situacao(
    db: AsyncSession,
    leito_id: str | None,
    situacao_tb: str | None,
    instituicao_id: str,
) -> None:
    if not situacao_tb:
        return
    if situacao_tb not in SITUACOES_TB_REMANEJAMENTO:
        raise HTTPException(
            status_code=400,
            detail="Situação TB inválida. Use Suspeita ou Confirmado.",
        )
    if not leito_id:
        raise HTTPException(
            status_code=400,
            detail="Informe o leito no quarto TB para o remanejamento.",
        )

    quarto = await obter_quarto_do_leito(db, leito_id, instituicao_id)
    if not quarto:
        raise HTTPException(status_code=400, detail="Leito TB informado não encontrado.")

    modalidade_esperada = MAPA_SITUACAO_MODALIDADE[situacao_tb]
    if quarto.modalidade != modalidade_esperada:
        raise HTTPException(
            status_code=400,
            detail=(
                f"O leito selecionado não pertence a um quarto TB {situacao_tb}. "
                "Escolha um leito do quarto correto."
            ),
        )


async def leito_esta_reservado_por_outro(
    db: AsyncSession,
    leito_id: str,
    instituicao_id: str,
    convivente_id: str | None = None,
) -> bool:
    query = select(ConviventeDB.id).where(
        ConviventeDB.instituicao_id == instituicao_id,
        ConviventeDB.leito_reservado_id == leito_id,
        ConviventeDB.reservar_leito_fixo.is_(True),
    )
    if convivente_id:
        query = query.where(ConviventeDB.id != convivente_id)
    reservante = (await db.execute(query.limit(1))).scalar_one_or_none()
    return reservante is not None


async def finalizar_reserva_tb_convivente(convivente: ConviventeDB) -> None:
    convivente.tb_remanejamento_situacao = None
    convivente.reservar_leito_fixo = False
    convivente.leito_reservado_id = None


async def aplicar_regras_acomodacao_tb(
    db: AsyncSession,
    *,
    dados: dict[str, Any],
    convivente: ConviventeDB | None,
    instituicao_id: str,
    leito_id_antigo: str | None = None,
) -> None:
    situacao = dados.get(
        "tb_remanejamento_situacao",
        convivente.tb_remanejamento_situacao if convivente else None,
    )
    if situacao is not None:
        situacao = str(situacao).strip() or None
        dados["tb_remanejamento_situacao"] = situacao

    reservar = dados.get(
        "reservar_leito_fixo",
        convivente.reservar_leito_fixo if convivente else False,
    )
    reservar = bool(reservar)
    dados["reservar_leito_fixo"] = reservar

    leito_atual = dados.get("leito_id", convivente.leito_id if convivente else None)
    leito_reservado_atual = dados.get(
        "leito_reservado_id",
        convivente.leito_reservado_id if convivente else None,
    )

    if (
        situacao
        and reservar
        and leito_atual
        and leito_reservado_atual
        and leito_atual == leito_reservado_atual
    ):
        dados["tb_remanejamento_situacao"] = None
        dados["reservar_leito_fixo"] = False
        dados["leito_reservado_id"] = None
        return

    if not situacao:
        if (
            convivente
            and convivente.tb_remanejamento_situacao
            and convivente.reservar_leito_fixo
            and convivente.leito_reservado_id
        ):
            leito_reserva = convivente.leito_reservado_id
            if "leito_id" not in dados:
                dados["leito_id"] = leito_reserva
            elif dados.get("leito_id") in (None, ""):
                dados["leito_id"] = leito_reserva
            elif dados.get("leito_id") == convivente.leito_id:
                dados["leito_id"] = leito_reserva

        dados["tb_remanejamento_situacao"] = None
        dados["reservar_leito_fixo"] = False
        dados["leito_reservado_id"] = None
        return

    if situacao not in SITUACOES_TB_REMANEJAMENTO:
        raise HTTPException(
            status_code=400,
            detail="Situação TB inválida. Use Suspeita ou Confirmado.",
        )

    leito_atual = dados.get("leito_id", convivente.leito_id if convivente else None)
    leito_reservado_atual = dados.get(
        "leito_reservado_id",
        convivente.leito_reservado_id if convivente else None,
    )

    await validar_leito_tb_para_situacao(db, leito_atual, situacao, instituicao_id)

    if leito_atual and await leito_esta_reservado_por_outro(
        db,
        leito_atual,
        instituicao_id,
        convivente.id if convivente else None,
    ):
        raise HTTPException(
            status_code=400,
            detail="Este leito está reservado para outro convivente.",
        )

    if reservar:
        candidato_reserva = leito_reservado_atual
        if not candidato_reserva and leito_id_antigo:
            quarto_antigo = await obter_quarto_do_leito(db, leito_id_antigo, instituicao_id)
            if quarto_antigo and modalidade_eh_fixo(quarto_antigo.modalidade):
                candidato_reserva = leito_id_antigo

        if not candidato_reserva:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Para reservar o leito fixo, o convivente precisa ter tido "
                    "alocação em quarto Fixo antes do remanejamento TB."
                ),
            )

        quarto_reserva = await obter_quarto_do_leito(db, candidato_reserva, instituicao_id)
        if not quarto_reserva or not modalidade_eh_fixo(quarto_reserva.modalidade):
            raise HTTPException(
                status_code=400,
                detail="Somente leitos de quartos Fixos podem ser reservados.",
            )

        if await leito_esta_reservado_por_outro(
            db,
            candidato_reserva,
            instituicao_id,
            convivente.id if convivente else None,
        ):
            raise HTTPException(
                status_code=400,
                detail="O leito fixo escolhido já está reservado para outro convivente.",
            )

        ocupante_query = select(ConviventeDB.id).where(
            ConviventeDB.instituicao_id == instituicao_id,
            ConviventeDB.leito_id == candidato_reserva,
        )
        if convivente:
            ocupante_query = ocupante_query.where(ConviventeDB.id != convivente.id)
        ocupante = (await db.execute(ocupante_query.limit(1))).scalar_one_or_none()
        if ocupante:
            raise HTTPException(
                status_code=400,
                detail="O leito fixo a reservar está ocupado por outro convivente.",
            )

        dados["leito_reservado_id"] = candidato_reserva
    else:
        dados["leito_reservado_id"] = None


async def sincronizar_status_leitos_convivente(
    db: AsyncSession,
    convivente: ConviventeDB,
    leito_id_antigo: str | None,
) -> None:
    ids_afetados = {lid for lid in (leito_id_antigo, convivente.leito_id, convivente.leito_reservado_id) if lid}

    for leito_id in ids_afetados:
        leito = (await db.execute(select(LeitoDB).where(LeitoDB.id == leito_id))).scalar_one_or_none()
        if not leito:
            continue

        ocupante_direto = (
            await db.execute(
                select(ConviventeDB.id).where(
                    ConviventeDB.leito_id == leito_id,
                    ConviventeDB.id != convivente.id,
                ).limit(1)
            )
        ).scalar_one_or_none()

        if ocupante_direto:
            leito.status = "Ocupado"
        elif convivente.leito_id == leito_id:
            leito.status = "Ocupado"
        else:
            leito.status = "Livre"
