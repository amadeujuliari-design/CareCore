from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import (
    ConviventeDB,
    HistoricoConviventeDB,
    LavanderiaRegistroDB,
    LeitoDB,
    PertenceRecolhidoBaixaDB,
    PertenceRecolhidoDB,
    QuartoDB,
    UsuarioDB,
)
from routers.conviventes_helpers import agora_sao_paulo
from schemas import (
    LavanderiaCancelamento,
    LavanderiaRegistroCreate,
    LavanderiaRegistroResponse,
    LavanderiaRetirada,
    PertenceRecolhidoBaixaAdministrativa,
    PertenceRecolhidoBaixaResponse,
    PertenceRecolhidoCreate,
    PertenceRecolhidoResponse,
    PertenceRecolhidoRetirada,
)
from security import (
    PERFIL_TECNICO,
    get_usuario_logado,
    usuario_eh_gestor,
    usuario_eh_manutencao,
    usuario_tem_perfil,
)
from tenant_scope import obter_instituicao_escopo


router = APIRouter(prefix="/api/rotina", tags=["Rotina Operacional"])


def _nome_convivente(convivente: ConviventeDB | None) -> str | None:
    if not convivente:
        return None
    return convivente.nome_social or convivente.nome_completo


def usuario_pode_baixa_administrativa_pertences(usuario_atual: dict) -> bool:
    return (
        usuario_eh_manutencao(usuario_atual)
        or usuario_eh_gestor(usuario_atual)
        or usuario_tem_perfil(usuario_atual, {PERFIL_TECNICO})
    )


def _status_lavanderia(registro: LavanderiaRegistroDB):
    if registro.status != "Em lavanderia":
        return registro.status
    if registro.prazo_retirada_em and agora_sao_paulo() > registro.prazo_retirada_em:
        return "Atrasado"
    return registro.status


def _horas_restantes_lavanderia(registro: LavanderiaRegistroDB):
    if registro.status != "Em lavanderia" or not registro.prazo_retirada_em:
        return None
    return round((registro.prazo_retirada_em - agora_sao_paulo()).total_seconds() / 3600, 1)


def _append_observacao_lavanderia(atual: str | None, nova: str | None) -> str | None:
    nova = (nova or "").strip()
    if not nova:
        return atual
    if not atual:
        return nova
    return f"{atual}\n{agora_sao_paulo().strftime('%d/%m/%Y %H:%M')} - {nova}"


def _registrar_historico_convivente(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente_id: str,
    usuario_id: str,
    titulo: str,
    descricao: str,
):
    db.add(
        HistoricoConviventeDB(
            instituicao_id=instituicao_id,
            convivente_id=convivente_id,
            usuario_id=usuario_id,
            origem_informacao="Rotina operacional",
            data_origem=agora_sao_paulo().date(),
            titulo=titulo,
            descricao=descricao,
            criado_em=agora_sao_paulo(),
        )
    )


async def _mapear_usuarios(db: AsyncSession, ids: set[str]) -> dict[str, str]:
    ids_limpos = {item for item in ids if item}
    if not ids_limpos:
        return {}

    usuarios = (
        await db.execute(
            select(UsuarioDB.id, UsuarioDB.nome).where(UsuarioDB.id.in_(ids_limpos))
        )
    ).all()

    return {usuario_id: nome for usuario_id, nome in usuarios}


async def _obter_convivente_ativo(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
) -> ConviventeDB:
    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == convivente_id,
                ConviventeDB.instituicao_id == instituicao_id,
                ConviventeDB.status == "Ativo",
            )
        )
    ).scalar_one_or_none()

    if not convivente:
        raise HTTPException(
            status_code=404,
            detail="Convivente ativo não encontrado no projeto atual.",
        )

    return convivente


async def _obter_quarto_do_convivente(
    db: AsyncSession,
    instituicao_id: str,
    convivente: ConviventeDB,
) -> QuartoDB:
    if not convivente.leito_id:
        raise HTTPException(
            status_code=400,
            detail="Convivente não possui quarto/leito vinculado.",
        )

    quarto = (
        await db.execute(
            select(QuartoDB)
            .join(LeitoDB, LeitoDB.quarto_id == QuartoDB.id)
            .where(
                QuartoDB.instituicao_id == instituicao_id,
                LeitoDB.id == convivente.leito_id,
            )
        )
    ).scalar_one_or_none()

    if not quarto:
        raise HTTPException(
            status_code=400,
            detail="Quarto atual do convivente não pertence ao projeto atual.",
        )

    return quarto


async def _obter_quarto(
    db: AsyncSession,
    instituicao_id: str,
    quarto_id: str,
) -> QuartoDB:
    quarto = (
        await db.execute(
            select(QuartoDB).where(
                QuartoDB.id == quarto_id,
                QuartoDB.instituicao_id == instituicao_id,
                QuartoDB.is_active == True,  # noqa: E712
            )
        )
    ).scalar_one_or_none()

    if not quarto:
        raise HTTPException(status_code=404, detail="Quarto ativo não encontrado.")

    return quarto


def _lavanderia_response(
    registro: LavanderiaRegistroDB,
    convivente: ConviventeDB | None,
    usuarios: dict[str, str],
) -> LavanderiaRegistroResponse:
    status_operacional = _status_lavanderia(registro)

    return LavanderiaRegistroResponse(
        id=registro.id,
        instituicao_id=registro.instituicao_id,
        convivente_id=registro.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        prontuario=convivente.numero_institucional if convivente else None,
        usuario_entrega_nome=usuarios.get(registro.usuario_entrega_id),
        usuario_retirada_nome=usuarios.get(registro.usuario_retirada_id),
        quantidade_entregue=registro.quantidade_entregue,
        quantidade_retirada=registro.quantidade_retirada,
        entregue_em=registro.entregue_em,
        prazo_retirada_em=registro.prazo_retirada_em,
        retirado_em=registro.retirado_em,
        observacao_entrega=registro.observacao_entrega,
        observacao_retirada=registro.observacao_retirada,
        status=status_operacional,
        atrasado=status_operacional == "Atrasado",
        horas_restantes=_horas_restantes_lavanderia(registro),
    )


def _baixa_response(
    baixa: PertenceRecolhidoBaixaDB,
    conviventes: dict[str, ConviventeDB],
    usuarios: dict[str, str],
) -> PertenceRecolhidoBaixaResponse:
    convivente = conviventes.get(baixa.convivente_id)

    return PertenceRecolhidoBaixaResponse(
        id=baixa.id,
        pertence_recolhido_id=baixa.pertence_recolhido_id,
        convivente_id=baixa.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        usuario_nome=usuarios.get(baixa.usuario_id),
        quantidade=baixa.quantidade,
        tipo_baixa=baixa.tipo_baixa,
        justificativa=baixa.justificativa,
        destino=baixa.destino,
        baixado_em=baixa.baixado_em,
    )


def _pertence_response(
    registro: PertenceRecolhidoDB,
    quarto: QuartoDB | None,
    baixas: list[PertenceRecolhidoBaixaDB],
    conviventes: dict[str, ConviventeDB],
    usuarios: dict[str, str],
) -> PertenceRecolhidoResponse:
    return PertenceRecolhidoResponse(
        id=registro.id,
        instituicao_id=registro.instituicao_id,
        quarto_id=registro.quarto_id,
        quarto_nome=quarto.nome if quarto else None,
        usuario_recolha_nome=usuarios.get(registro.usuario_recolha_id),
        quantidade_recolhida=registro.quantidade_recolhida,
        quantidade_disponivel=registro.quantidade_disponivel,
        recolhido_em=registro.recolhido_em,
        observacao=registro.observacao,
        status=registro.status,
        encerrado_em=registro.encerrado_em,
        justificativa_encerramento=registro.justificativa_encerramento,
        destino_encerramento=registro.destino_encerramento,
        baixas=[
            _baixa_response(baixa, conviventes, usuarios)
            for baixa in sorted(baixas, key=lambda item: item.baixado_em, reverse=True)
        ],
    )


@router.get("/lavanderia", response_model=list[LavanderiaRegistroResponse])
async def listar_lavanderia(
    status_filtro: str = "pendentes",
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    query = (
        select(LavanderiaRegistroDB, ConviventeDB)
        .join(ConviventeDB, ConviventeDB.id == LavanderiaRegistroDB.convivente_id)
        .where(LavanderiaRegistroDB.instituicao_id == instituicao_id)
        .order_by(LavanderiaRegistroDB.entregue_em.desc())
    )

    if status_filtro == "pendentes":
        query = query.where(LavanderiaRegistroDB.status == "Em lavanderia")
    elif status_filtro != "todos":
        query = query.where(LavanderiaRegistroDB.status == status_filtro)

    linhas = (await db.execute(query)).all()
    ids_usuarios = {
        registro.usuario_entrega_id
        for registro, _ in linhas
    } | {
        registro.usuario_retirada_id
        for registro, _ in linhas
        if registro.usuario_retirada_id
    }
    usuarios = await _mapear_usuarios(db, ids_usuarios)

    return [
        _lavanderia_response(registro, convivente, usuarios)
        for registro, convivente in linhas
    ]


@router.post(
    "/lavanderia",
    response_model=LavanderiaRegistroResponse,
    status_code=status.HTTP_201_CREATED,
)
async def registrar_lavanderia(
    payload: LavanderiaRegistroCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    convivente = await _obter_convivente_ativo(db, instituicao_id, payload.convivente_id)
    agora = agora_sao_paulo()

    registro = LavanderiaRegistroDB(
        instituicao_id=instituicao_id,
        convivente_id=convivente.id,
        usuario_entrega_id=usuario_atual["sub"],
        quantidade_entregue=payload.quantidade_entregue,
        entregue_em=agora,
        prazo_retirada_em=agora + timedelta(hours=48),
        observacao_entrega=(payload.observacao_entrega or "").strip() or None,
        status="Em lavanderia",
    )

    db.add(registro)
    _registrar_historico_convivente(
        db,
        instituicao_id=instituicao_id,
        convivente_id=convivente.id,
        usuario_id=usuario_atual["sub"],
        titulo="Lavanderia - entrega de peças",
        descricao=(
            f"Entrega de {payload.quantidade_entregue} peça(s) na lavanderia. "
            f"Prazo de retirada: {(agora + timedelta(hours=48)).strftime('%d/%m/%Y %H:%M')}."
            + (f" Observação: {(payload.observacao_entrega or '').strip()}" if (payload.observacao_entrega or "").strip() else "")
        ),
    )
    await db.commit()
    await db.refresh(registro)

    usuarios = await _mapear_usuarios(db, {registro.usuario_entrega_id})
    return _lavanderia_response(registro, convivente, usuarios)


@router.patch("/lavanderia/{registro_id}/retirar", response_model=LavanderiaRegistroResponse)
async def retirar_lavanderia(
    registro_id: str,
    payload: LavanderiaRetirada,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    linha = (
        await db.execute(
            select(LavanderiaRegistroDB, ConviventeDB)
            .join(ConviventeDB, ConviventeDB.id == LavanderiaRegistroDB.convivente_id)
            .where(
                LavanderiaRegistroDB.id == registro_id,
                LavanderiaRegistroDB.instituicao_id == instituicao_id,
            )
        )
    ).one_or_none()

    if not linha:
        raise HTTPException(status_code=404, detail="Registro de lavanderia não encontrado.")

    registro, convivente = linha
    if registro.status != "Em lavanderia":
        raise HTTPException(status_code=400, detail="Este registro de lavanderia já foi encerrado.")

    total_ja_retirado = int(registro.quantidade_retirada or 0)
    saldo_pendente = max(int(registro.quantidade_entregue or 0) - total_ja_retirado, 0)
    quantidade_nova = int(payload.quantidade_retirada or 0)
    total_retirado = total_ja_retirado + quantidade_nova
    observacao = (payload.observacao_retirada or "").strip()
    motivo_baixa = (payload.motivo_baixa or "").strip()

    if quantidade_nova <= 0 and not payload.encerrar_pendencia:
        raise HTTPException(
            status_code=400,
            detail="Informe a quantidade retirada ou marque a baixa da pendência com motivo.",
        )

    if quantidade_nova > saldo_pendente:
        raise HTTPException(
            status_code=400,
            detail=f"Há apenas {saldo_pendente} peça(s) pendente(s) neste registro.",
        )

    if payload.encerrar_pendencia and not motivo_baixa:
        raise HTTPException(
            status_code=400,
            detail="Informe o motivo para baixar a pendência da lavanderia.",
        )

    if total_retirado < registro.quantidade_entregue and payload.encerrar_pendencia and not observacao:
        raise HTTPException(
            status_code=400,
            detail="Baixa com quantidade divergente exige observação.",
        )

    registro.quantidade_retirada = total_retirado
    registro.observacao_retirada = _append_observacao_lavanderia(
        registro.observacao_retirada,
        observacao,
    )
    registro.usuario_retirada_id = usuario_atual["sub"]
    registro.retirado_em = agora_sao_paulo()

    if total_retirado >= registro.quantidade_entregue:
        registro.status = "Retirado"
    elif payload.encerrar_pendencia:
        registro.status = "Baixa com divergência"
        registro.observacao_retirada = _append_observacao_lavanderia(
            registro.observacao_retirada,
            f"Baixa da pendência: {motivo_baixa}",
        )
    else:
        registro.status = "Em lavanderia"

    saldo_restante = max(registro.quantidade_entregue - total_retirado, 0)
    _registrar_historico_convivente(
        db,
        instituicao_id=instituicao_id,
        convivente_id=convivente.id,
        usuario_id=usuario_atual["sub"],
        titulo="Lavanderia - retirada de peças",
        descricao=(
            f"Retirada de {quantidade_nova} peça(s) da lavanderia. "
            f"Total retirado: {total_retirado}/{registro.quantidade_entregue}. "
            f"Saldo pendente: {saldo_restante}. Status: {registro.status}."
            + (f" Observação: {registro.observacao_retirada}" if registro.observacao_retirada else "")
        ),
    )

    await db.commit()
    await db.refresh(registro)

    usuarios = await _mapear_usuarios(db, {registro.usuario_entrega_id, registro.usuario_retirada_id})
    return _lavanderia_response(registro, convivente, usuarios)


@router.patch("/lavanderia/{registro_id}/cancelar", response_model=LavanderiaRegistroResponse)
async def cancelar_lavanderia(
    registro_id: str,
    payload: LavanderiaCancelamento,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    linha = (
        await db.execute(
            select(LavanderiaRegistroDB, ConviventeDB)
            .join(ConviventeDB, ConviventeDB.id == LavanderiaRegistroDB.convivente_id)
            .where(
                LavanderiaRegistroDB.id == registro_id,
                LavanderiaRegistroDB.instituicao_id == instituicao_id,
            )
        )
    ).one_or_none()

    if not linha:
        raise HTTPException(status_code=404, detail="Registro de lavanderia não encontrado.")

    motivo = (payload.motivo_cancelamento or "").strip()
    if not motivo:
        raise HTTPException(status_code=400, detail="Informe o motivo do cancelamento.")

    registro, convivente = linha
    if registro.status != "Em lavanderia":
        raise HTTPException(status_code=400, detail="Apenas registros pendentes podem ser cancelados.")

    registro.status = "Cancelado"
    registro.cancelado_por_id = usuario_atual["sub"]
    registro.cancelado_em = agora_sao_paulo()
    registro.motivo_cancelamento = motivo
    _registrar_historico_convivente(
        db,
        instituicao_id=instituicao_id,
        convivente_id=convivente.id,
        usuario_id=usuario_atual["sub"],
        titulo="Lavanderia - registro cancelado",
        descricao=f"Registro de lavanderia cancelado. Motivo: {motivo}",
    )

    await db.commit()
    await db.refresh(registro)

    usuarios = await _mapear_usuarios(db, {registro.usuario_entrega_id})
    return _lavanderia_response(registro, convivente, usuarios)


@router.get("/pertences-recolhidos", response_model=list[PertenceRecolhidoResponse])
async def listar_pertences_recolhidos(
    status_filtro: str = "abertos",
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    query = (
        select(PertenceRecolhidoDB, QuartoDB)
        .join(QuartoDB, QuartoDB.id == PertenceRecolhidoDB.quarto_id)
        .where(PertenceRecolhidoDB.instituicao_id == instituicao_id)
        .order_by(PertenceRecolhidoDB.recolhido_em.desc())
    )

    if status_filtro == "abertos":
        query = query.where(PertenceRecolhidoDB.quantidade_disponivel > 0)
    elif status_filtro != "todos":
        query = query.where(PertenceRecolhidoDB.status == status_filtro)

    linhas = (await db.execute(query)).all()
    registros = [registro for registro, _ in linhas]
    registro_ids = [registro.id for registro in registros]

    baixas_por_registro: dict[str, list[PertenceRecolhidoBaixaDB]] = {
        registro.id: []
        for registro in registros
    }
    baixas = []
    if registro_ids:
        baixas = (
            await db.execute(
                select(PertenceRecolhidoBaixaDB).where(
                    PertenceRecolhidoBaixaDB.instituicao_id == instituicao_id,
                    PertenceRecolhidoBaixaDB.pertence_recolhido_id.in_(registro_ids),
                )
            )
        ).scalars().all()
        for baixa in baixas:
            baixas_por_registro.setdefault(baixa.pertence_recolhido_id, []).append(baixa)

    convivente_ids = {baixa.convivente_id for baixa in baixas if baixa.convivente_id}
    conviventes = {}
    if convivente_ids:
        conviventes_lista = (
            await db.execute(
                select(ConviventeDB).where(
                    ConviventeDB.instituicao_id == instituicao_id,
                    ConviventeDB.id.in_(convivente_ids),
                )
            )
        ).scalars().all()
        conviventes = {convivente.id: convivente for convivente in conviventes_lista}

    usuario_ids = {registro.usuario_recolha_id for registro in registros} | {
        baixa.usuario_id for baixa in baixas
    }
    usuarios = await _mapear_usuarios(db, usuario_ids)

    return [
        _pertence_response(
            registro,
            quarto,
            baixas_por_registro.get(registro.id, []),
            conviventes,
            usuarios,
        )
        for registro, quarto in linhas
    ]


@router.post(
    "/pertences-recolhidos",
    response_model=PertenceRecolhidoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def registrar_pertences_recolhidos(
    payload: PertenceRecolhidoCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    quarto = await _obter_quarto(db, instituicao_id, payload.quarto_id)

    registro = PertenceRecolhidoDB(
        instituicao_id=instituicao_id,
        quarto_id=quarto.id,
        usuario_recolha_id=usuario_atual["sub"],
        quantidade_recolhida=payload.quantidade_recolhida,
        quantidade_disponivel=payload.quantidade_recolhida,
        recolhido_em=agora_sao_paulo(),
        observacao=(payload.observacao or "").strip() or None,
        status="Com saldo",
    )

    db.add(registro)
    await db.commit()
    await db.refresh(registro)

    usuarios = await _mapear_usuarios(db, {registro.usuario_recolha_id})
    return _pertence_response(registro, quarto, [], {}, usuarios)


@router.patch(
    "/pertences-recolhidos/{registro_id}/retirar",
    response_model=PertenceRecolhidoResponse,
)
async def retirar_pertences_recolhidos(
    registro_id: str,
    payload: PertenceRecolhidoRetirada,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    linha = (
        await db.execute(
            select(PertenceRecolhidoDB, QuartoDB)
            .join(QuartoDB, QuartoDB.id == PertenceRecolhidoDB.quarto_id)
            .where(
                PertenceRecolhidoDB.id == registro_id,
                PertenceRecolhidoDB.instituicao_id == instituicao_id,
            )
        )
    ).one_or_none()

    if not linha:
        raise HTTPException(status_code=404, detail="Recolha de pertences não encontrada.")

    registro, quarto = linha
    if registro.quantidade_disponivel <= 0:
        raise HTTPException(status_code=400, detail="Esta recolha não possui saldo disponível.")

    if payload.quantidade > registro.quantidade_disponivel:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Há apenas {registro.quantidade_disponivel} item(ns) disponível(is) "
                "para este quarto. Confira com os conviventes antes de prosseguir."
            ),
        )

    convivente = await _obter_convivente_ativo(db, instituicao_id, payload.convivente_id)
    quarto_convivente = await _obter_quarto_do_convivente(db, instituicao_id, convivente)

    if quarto_convivente.id != registro.quarto_id:
        raise HTTPException(
            status_code=400,
            detail="Este convivente não está alocado no quarto desta recolha.",
        )

    registro.quantidade_disponivel -= payload.quantidade
    if registro.quantidade_disponivel == 0:
        registro.status = "Esgotado"

    baixa = PertenceRecolhidoBaixaDB(
        instituicao_id=instituicao_id,
        pertence_recolhido_id=registro.id,
        convivente_id=convivente.id,
        usuario_id=usuario_atual["sub"],
        quantidade=payload.quantidade,
        tipo_baixa="Retirada por convivente",
        justificativa=(payload.justificativa or "").strip() or None,
        baixado_em=agora_sao_paulo(),
    )
    db.add(baixa)
    _registrar_historico_convivente(
        db,
        instituicao_id=instituicao_id,
        convivente_id=convivente.id,
        usuario_id=usuario_atual["sub"],
        titulo="Pertences recolhidos - retirada",
        descricao=(
            f"Retirada de {payload.quantidade} item(ns) recolhido(s) do quarto {quarto.nome}. "
            f"Saldo restante da recolha: {registro.quantidade_disponivel} item(ns)."
            + (f" Observação: {(payload.justificativa or '').strip()}" if (payload.justificativa or "").strip() else "")
        ),
    )

    await db.commit()
    await db.refresh(registro)
    await db.refresh(baixa)

    usuarios = await _mapear_usuarios(db, {registro.usuario_recolha_id, baixa.usuario_id})
    return _pertence_response(
        registro,
        quarto,
        [baixa],
        {convivente.id: convivente},
        usuarios,
    )


@router.patch(
    "/pertences-recolhidos/{registro_id}/baixa-administrativa",
    response_model=PertenceRecolhidoResponse,
)
async def baixa_administrativa_pertences_recolhidos(
    registro_id: str,
    payload: PertenceRecolhidoBaixaAdministrativa,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    if not usuario_pode_baixa_administrativa_pertences(usuario_atual):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Baixa administrativa de pertences é restrita a Gestores, Técnicos e Manutenção.",
        )

    instituicao_id = obter_instituicao_escopo(usuario_atual)
    linha = (
        await db.execute(
            select(PertenceRecolhidoDB, QuartoDB)
            .join(QuartoDB, QuartoDB.id == PertenceRecolhidoDB.quarto_id)
            .where(
                PertenceRecolhidoDB.id == registro_id,
                PertenceRecolhidoDB.instituicao_id == instituicao_id,
            )
        )
    ).one_or_none()

    if not linha:
        raise HTTPException(status_code=404, detail="Recolha de pertences não encontrada.")

    registro, quarto = linha
    justificativa = (payload.justificativa or "").strip()
    destino = (payload.destino or "").strip()

    if not justificativa or not destino:
        raise HTTPException(
            status_code=400,
            detail="Baixa administrativa exige justificativa e destino.",
        )

    if payload.quantidade > registro.quantidade_disponivel:
        raise HTTPException(
            status_code=400,
            detail=f"Há apenas {registro.quantidade_disponivel} item(ns) disponível(is) para baixa.",
        )

    registro.quantidade_disponivel -= payload.quantidade
    if registro.quantidade_disponivel == 0:
        registro.status = "Baixa administrativa"
        registro.encerrado_por_id = usuario_atual["sub"]
        registro.encerrado_em = agora_sao_paulo()
        registro.justificativa_encerramento = justificativa
        registro.destino_encerramento = destino

    baixa = PertenceRecolhidoBaixaDB(
        instituicao_id=instituicao_id,
        pertence_recolhido_id=registro.id,
        usuario_id=usuario_atual["sub"],
        quantidade=payload.quantidade,
        tipo_baixa="Baixa administrativa",
        justificativa=justificativa,
        destino=destino,
        baixado_em=agora_sao_paulo(),
    )
    db.add(baixa)

    await db.commit()
    await db.refresh(registro)
    await db.refresh(baixa)

    usuarios = await _mapear_usuarios(db, {registro.usuario_recolha_id, baixa.usuario_id})
    return _pertence_response(registro, quarto, [baixa], {}, usuarios)
