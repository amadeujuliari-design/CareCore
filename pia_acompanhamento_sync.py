"""Espelha registros de acompanhamentos técnicos no PIA do convivente."""
from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    AcompanhamentoDiscussaoHospitalarDB,
    AcompanhamentoPotDB,
    AcompanhamentoTbDB,
    RegistroPIADB,
)
from routers.conviventes_helpers import agora_sao_paulo

ORIGEM_DISCUSSAO = "discussao_hospitalar"
ORIGEM_TB = "tuberculose"
ORIGEM_POT = "pot"

PIA_STATUS_ATIVO = "Em acompanhamento"
PIA_STATUS_INATIVO = "Concluído"

EventoSync = Literal["criacao", "edicao"]


def _fmt_data(valor: date | None) -> str:
    if not valor:
        return ""
    return valor.strftime("%d/%m/%Y")


def _data_para_datetime(valor: date | None) -> datetime:
    if valor:
        return datetime.combine(valor, time.min)
    return agora_sao_paulo()


def _hospital_exibicao(nome_hospital: str | None, hospital_outro: str | None) -> str:
    if not nome_hospital:
        return "Hospital não informado"
    if nome_hospital == "Outros" and hospital_outro:
        return f"Outros — {hospital_outro}"
    return nome_hospital


def _descricao_texto(observacoes: str | None, fallback: str = "Sem observações registradas.") -> str:
    texto = (observacoes or "").strip()
    return texto or fallback


async def _pia_ja_sincronizado(
    db: AsyncSession,
    instituicao_id: str,
    origem_modulo: str,
    origem_registro_id: str,
) -> RegistroPIADB | None:
    if not origem_registro_id:
        return None

    return (
        await db.execute(
            select(RegistroPIADB).where(
                RegistroPIADB.instituicao_id == instituicao_id,
                RegistroPIADB.origem_modulo == origem_modulo,
                RegistroPIADB.origem_registro_id == origem_registro_id,
            )
        )
    ).scalar_one_or_none()


async def _obter_pia_espelho_origem(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
    origem_modulo: str,
    origem_registro_id: str,
) -> RegistroPIADB | None:
    if not origem_registro_id:
        return None

    registro = await _pia_ja_sincronizado(
        db, instituicao_id, origem_modulo, origem_registro_id
    )
    if registro:
        return registro

    candidatos = (
        await db.execute(
            select(RegistroPIADB)
            .where(
                RegistroPIADB.instituicao_id == instituicao_id,
                RegistroPIADB.convivente_id == convivente_id,
                RegistroPIADB.origem_modulo == origem_modulo,
                RegistroPIADB.origem_registro_id.is_(None),
            )
            .order_by(RegistroPIADB.data_registro.desc())
        )
    ).scalars().all()

    if len(candidatos) != 1:
        return None

    legado = candidatos[0]
    legado.origem_registro_id = origem_registro_id
    await db.flush()
    return legado


async def _obter_pia_principal_alvo(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
) -> RegistroPIADB | None:
    principais = (
        await db.execute(
            select(RegistroPIADB)
            .where(
                RegistroPIADB.instituicao_id == instituicao_id,
                RegistroPIADB.convivente_id == convivente_id,
                RegistroPIADB.registro_pai_id.is_(None),
                RegistroPIADB.origem_modulo.is_(None),
            )
            .order_by(RegistroPIADB.data_registro.desc())
        )
    ).scalars().all()

    for registro in principais:
        if registro.status == PIA_STATUS_ATIVO:
            return registro

    for registro in principais:
        if registro.status != PIA_STATUS_INATIVO:
            return registro

    return None


async def _criar_registro_pia(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente_id: str,
    usuario_id: str,
    registro_pai_id: str | None,
    tipo_registro: str,
    titulo: str,
    subtitulo: str | None,
    descricao: str,
    status: str,
    data_registro: datetime,
    origem_modulo: str,
    origem_registro_id: str,
) -> RegistroPIADB:
    registro = RegistroPIADB(
        instituicao_id=instituicao_id,
        convivente_id=convivente_id,
        usuario_id=usuario_id,
        registro_pai_id=registro_pai_id,
        tipo_registro=tipo_registro,
        titulo=titulo,
        subtitulo=subtitulo,
        descricao=descricao,
        status=status,
        data_registro=data_registro,
        origem_modulo=origem_modulo,
        origem_registro_id=origem_registro_id,
    )
    db.add(registro)
    await db.flush()
    return registro


async def _atualizar_pia_espelho(
    registro: RegistroPIADB,
    *,
    subtitulo: str | None,
    descricao: str,
    data_registro: datetime,
) -> RegistroPIADB:
    registro.subtitulo = subtitulo or registro.subtitulo
    registro.descricao = _descricao_texto(descricao)
    registro.data_registro = data_registro
    return registro


async def _sincronizar_filho_espelho_pia(
    db: AsyncSession,
    *,
    pia_pai: RegistroPIADB,
    instituicao_id: str,
    convivente_id: str,
    usuario_id: str,
    origem_modulo: str,
    origem_registro_id: str,
    evento: EventoSync,
    subtitulo: str | None,
    descricao: str,
    data_referencia: date | None,
) -> RegistroPIADB:
    descricao_limpa = _descricao_texto(descricao)
    data_registro = _data_para_datetime(data_referencia)
    existente = await _pia_ja_sincronizado(
        db, instituicao_id, origem_modulo, origem_registro_id
    )

    if evento == "edicao" and existente:
        return await _atualizar_pia_espelho(
            existente,
            subtitulo=subtitulo,
            descricao=descricao_limpa,
            data_registro=data_registro,
        )

    if evento == "criacao" and existente:
        return existente

    status_pai = (
        await db.execute(
            select(RegistroPIADB.status).where(RegistroPIADB.id == pia_pai.id)
        )
    ).scalar_one_or_none() or PIA_STATUS_ATIVO

    return await _criar_registro_pia(
        db,
        instituicao_id=instituicao_id,
        convivente_id=convivente_id,
        usuario_id=usuario_id,
        registro_pai_id=pia_pai.id,
        tipo_registro="Evolução",
        titulo="Evolução",
        subtitulo=subtitulo,
        descricao=descricao_limpa,
        status=status_pai,
        data_registro=data_registro,
        origem_modulo=origem_modulo,
        origem_registro_id=origem_registro_id,
    )


async def sincronizar_para_pia(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente_id: str,
    usuario_id: str,
    origem_modulo: str,
    origem_registro_id: str,
    evento: EventoSync,
    titulo: str,
    subtitulo: str | None,
    descricao: str,
    data_referencia: date | None,
) -> RegistroPIADB | None:
    if not origem_registro_id:
        return None

    descricao_limpa = _descricao_texto(descricao)
    data_registro = _data_para_datetime(data_referencia)
    existente = await _pia_ja_sincronizado(
        db, instituicao_id, origem_modulo, origem_registro_id
    )
    if not existente:
        existente = await _obter_pia_espelho_origem(
            db, instituicao_id, convivente_id, origem_modulo, origem_registro_id
        )

    if evento == "edicao" and existente:
        return await _atualizar_pia_espelho(
            existente,
            subtitulo=subtitulo or titulo,
            descricao=descricao_limpa,
            data_registro=data_registro,
        )

    if evento == "criacao" and existente:
        return existente

    principal_alvo = await _obter_pia_principal_alvo(db, instituicao_id, convivente_id)

    if principal_alvo is None:
        return await _criar_registro_pia(
            db,
            instituicao_id=instituicao_id,
            convivente_id=convivente_id,
            usuario_id=usuario_id,
            registro_pai_id=None,
            tipo_registro="PIA",
            titulo=titulo,
            subtitulo=subtitulo,
            descricao=descricao_limpa,
            status=PIA_STATUS_ATIVO,
            data_registro=data_registro,
            origem_modulo=origem_modulo,
            origem_registro_id=origem_registro_id,
        )

    return await _criar_registro_pia(
        db,
        instituicao_id=instituicao_id,
        convivente_id=convivente_id,
        usuario_id=usuario_id,
        registro_pai_id=principal_alvo.id,
        tipo_registro="Evolução",
        titulo="Evolução",
        subtitulo=subtitulo or titulo,
        descricao=descricao_limpa,
        status=principal_alvo.status,
        data_registro=data_registro,
        origem_modulo=origem_modulo,
        origem_registro_id=origem_registro_id,
    )


async def sincronizar_discussao_hospitalar_pia(
    db: AsyncSession,
    registro: AcompanhamentoDiscussaoHospitalarDB,
    usuario_id: str,
    *,
    evento: EventoSync,
) -> RegistroPIADB | None:
    if registro.registro_pai_id:
        subtitulo = f"{registro.status_evolucao or 'Evolução'} — {_fmt_data(registro.data_evolucao)}"
        data_ref = registro.data_evolucao
        pia_pai = await _obter_pia_espelho_origem(
            db,
            registro.instituicao_id,
            registro.convivente_id,
            ORIGEM_DISCUSSAO,
            registro.registro_pai_id,
        )
        if pia_pai:
            return await _sincronizar_filho_espelho_pia(
                db,
                pia_pai=pia_pai,
                instituicao_id=registro.instituicao_id,
                convivente_id=registro.convivente_id,
                usuario_id=usuario_id,
                origem_modulo=ORIGEM_DISCUSSAO,
                origem_registro_id=registro.id,
                evento=evento,
                subtitulo=subtitulo,
                descricao=registro.observacoes,
                data_referencia=data_ref,
            )
    else:
        hospital = _hospital_exibicao(registro.nome_hospital, registro.hospital_outro)
        partes = [hospital]
        if registro.data_discussao:
            partes.append(f"discussão {_fmt_data(registro.data_discussao)}")
        if registro.data_prevista_entrada:
            partes.append(f"previsão {_fmt_data(registro.data_prevista_entrada)}")
        subtitulo = " · ".join(partes)
        data_ref = registro.data_discussao

        return await sincronizar_para_pia(
            db,
            instituicao_id=registro.instituicao_id,
            convivente_id=registro.convivente_id,
            usuario_id=usuario_id,
            origem_modulo=ORIGEM_DISCUSSAO,
            origem_registro_id=registro.id,
            evento=evento,
            titulo="Discussões hospitalares",
            subtitulo=subtitulo,
            descricao=registro.observacoes,
            data_referencia=data_ref,
        )

    subtitulo = f"{registro.status_evolucao or 'Evolução'} — {_fmt_data(registro.data_evolucao)}"
    return await sincronizar_para_pia(
        db,
        instituicao_id=registro.instituicao_id,
        convivente_id=registro.convivente_id,
        usuario_id=usuario_id,
        origem_modulo=ORIGEM_DISCUSSAO,
        origem_registro_id=registro.id,
        evento=evento,
        titulo="Discussões hospitalares",
        subtitulo=subtitulo,
        descricao=registro.observacoes,
        data_referencia=registro.data_evolucao,
    )


async def sincronizar_tuberculose_pia(
    db: AsyncSession,
    registro: AcompanhamentoTbDB,
    usuario_id: str,
    *,
    evento: EventoSync,
    encerramento: bool = False,
) -> RegistroPIADB | None:
    partes = []
    if registro.situacao:
        partes.append(registro.situacao)
    if registro.data_inicio:
        partes.append(f"início {_fmt_data(registro.data_inicio)}")
    if registro.data_fim:
        partes.append(f"fim {_fmt_data(registro.data_fim)}")
    subtitulo = " · ".join(partes) if partes else "Registro de tuberculose"

    if encerramento:
        subtitulo = f"Encerramento — Alta · {_fmt_data(registro.data_fim or registro.data_inicio)}"

    data_ref = registro.data_fim if encerramento else (registro.data_inicio or None)
    origem_registro_id = f"{registro.id}:encerramento" if encerramento else registro.id

    return await sincronizar_para_pia(
        db,
        instituicao_id=registro.instituicao_id,
        convivente_id=registro.convivente_id,
        usuario_id=usuario_id,
        origem_modulo=ORIGEM_TB,
        origem_registro_id=origem_registro_id,
        evento=evento if not encerramento else "criacao",
        titulo="Tuberculose",
        subtitulo=subtitulo,
        descricao=registro.observacoes,
        data_referencia=data_ref,
    )


async def sincronizar_pot_pia(
    db: AsyncSession,
    registro: AcompanhamentoPotDB,
    usuario_id: str,
    *,
    evento: EventoSync,
) -> RegistroPIADB | None:
    if registro.registro_pai_id:
        subtitulo = f"{registro.status_evolucao or 'Evolução'} — {_fmt_data(registro.data_evolucao)}"
        data_ref = registro.data_evolucao
        pia_pai = await _obter_pia_espelho_origem(
            db,
            registro.instituicao_id,
            registro.convivente_id,
            ORIGEM_POT,
            registro.registro_pai_id,
        )
        if pia_pai:
            return await _sincronizar_filho_espelho_pia(
                db,
                pia_pai=pia_pai,
                instituicao_id=registro.instituicao_id,
                convivente_id=registro.convivente_id,
                usuario_id=usuario_id,
                origem_modulo=ORIGEM_POT,
                origem_registro_id=registro.id,
                evento=evento,
                subtitulo=subtitulo,
                descricao=registro.observacoes,
                data_referencia=data_ref,
            )

        return await sincronizar_para_pia(
            db,
            instituicao_id=registro.instituicao_id,
            convivente_id=registro.convivente_id,
            usuario_id=usuario_id,
            origem_modulo=ORIGEM_POT,
            origem_registro_id=registro.id,
            evento=evento,
            titulo="POT",
            subtitulo=subtitulo,
            descricao=registro.observacoes,
            data_referencia=data_ref,
        )

    partes = []
    if registro.data_insercao:
        partes.append(f"inserção {_fmt_data(registro.data_insercao)}")
    if registro.data_desligamento:
        partes.append(f"desligamento {_fmt_data(registro.data_desligamento)}")
    if registro.congelamento_ativo:
        cong = "congelamento ativo"
        if registro.congelamento_inicio:
            cong += f" desde {_fmt_data(registro.congelamento_inicio)}"
        partes.append(cong)
    subtitulo = " · ".join(partes) if partes else "Participação no POT"
    data_ref = registro.data_insercao or registro.data_desligamento

    return await sincronizar_para_pia(
        db,
        instituicao_id=registro.instituicao_id,
        convivente_id=registro.convivente_id,
        usuario_id=usuario_id,
        origem_modulo=ORIGEM_POT,
        origem_registro_id=registro.id,
        evento=evento,
        titulo="POT",
        subtitulo=subtitulo,
        descricao=registro.observacoes,
        data_referencia=data_ref,
    )


async def reconciliar_espelhos_pia_convivente(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
) -> int:
    """Cria espelhos PIA ausentes para acompanhamentos já registrados."""
    criados = 0

    pot_registros = (
        await db.execute(
            select(AcompanhamentoPotDB)
            .where(
                AcompanhamentoPotDB.instituicao_id == instituicao_id,
                AcompanhamentoPotDB.convivente_id == convivente_id,
            )
            .order_by(AcompanhamentoPotDB.criado_em.asc())
        )
    ).scalars().all()

    for registro in pot_registros:
        if await _pia_ja_sincronizado(db, instituicao_id, ORIGEM_POT, registro.id):
            continue
        await sincronizar_pot_pia(
            db,
            registro,
            registro.registrado_por_id,
            evento="criacao",
        )
        criados += 1

    discussao_registros = (
        await db.execute(
            select(AcompanhamentoDiscussaoHospitalarDB)
            .where(
                AcompanhamentoDiscussaoHospitalarDB.instituicao_id == instituicao_id,
                AcompanhamentoDiscussaoHospitalarDB.convivente_id == convivente_id,
            )
            .order_by(AcompanhamentoDiscussaoHospitalarDB.criado_em.asc())
        )
    ).scalars().all()

    for registro in discussao_registros:
        if await _pia_ja_sincronizado(db, instituicao_id, ORIGEM_DISCUSSAO, registro.id):
            continue
        await sincronizar_discussao_hospitalar_pia(
            db,
            registro,
            registro.registrado_por_id,
            evento="criacao",
        )
        criados += 1

    tb_registros = (
        await db.execute(
            select(AcompanhamentoTbDB)
            .where(
                AcompanhamentoTbDB.instituicao_id == instituicao_id,
                AcompanhamentoTbDB.convivente_id == convivente_id,
            )
            .order_by(AcompanhamentoTbDB.criado_em.asc())
        )
    ).scalars().all()

    for registro in tb_registros:
        if await _pia_ja_sincronizado(db, instituicao_id, ORIGEM_TB, registro.id):
            continue
        await sincronizar_tuberculose_pia(
            db,
            registro,
            registro.registrado_por_id,
            evento="criacao",
        )
        criados += 1

    if criados:
        await db.flush()

    return criados
