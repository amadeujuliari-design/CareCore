from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
from models import QuartoDB, LeitoDB, ConviventeDB
from schemas import LeitoAlocacaoPayload, QuartoCreate, QuartoUpdate
from ordenacao_natural import chave_ordenacao_natural
from security import exigir_perfis, exigir_tecnico_ou_gestor, get_usuario_logado
from tenant_scope import obter_instituicao_escopo
from carteirinha_operacional import sincronizar_leito_provisorio_convivente
from acomodacao_tb import (
    MODALIDADES_QUARTO_VALIDAS,
    finalizar_reserva_tb_convivente,
    leito_esta_reservado_por_outro,
    sincronizar_status_leitos_convivente,
)

router = APIRouter(prefix="/api/quartos", tags=["Quartos e Leitos"])

STATUS_CONVIVENTE_OCUPA_LEITO = frozenset({
    "Ativo",
    "Em acolhimento",
    "Ausência justificada",
})
STATUS_CONVIVENTE_LIBERA_LEITO = frozenset({
    "Inativado",
    "Bloqueado",
    "Saída qualificada",
})

exigir_alocacao_leito = exigir_perfis("Gestor", "Técnico", "Administrativo")


def _validar_modalidade_quarto(modalidade: str) -> None:
    if modalidade not in MODALIDADES_QUARTO_VALIDAS:
        raise HTTPException(
            status_code=400,
            detail="Modalidade de quarto inválida.",
        )


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_quarto(
    payload: QuartoCreate, 
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(exigir_tecnico_ou_gestor)
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    _validar_modalidade_quarto(payload.modalidade)
    try:
        novo_quarto = QuartoDB(
            instituicao_id=instituicao_id,
            nome=payload.nome,
            tipo_publico=payload.tipo_publico,
            modalidade=payload.modalidade,
            rotativo=payload.rotativo,
        )
        db.add(novo_quarto)
        await db.flush()

        for leito in payload.leitos:
            novo_leito = LeitoDB(
                quarto_id=novo_quarto.id,
                identificacao=leito.identificacao,
                status="Livre"
            )
            db.add(novo_leito)

        await db.commit()
        return {"status": "sucesso", "mensagem": "Quarto configurado e leitos criados com sucesso."}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Não foi possível criar a estrutura de quartos.",
        ) from e

@router.get("")
async def listar_quartos(
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(get_usuario_logado)
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    query = select(QuartoDB).where(
        QuartoDB.instituicao_id == instituicao_id
    )
    resultado = await db.execute(query)
    quartos = resultado.scalars().all()

    quarto_ids = [q.id for q in quartos]
    leitos_por_quarto = {quarto_id: [] for quarto_id in quarto_ids}
    convivente_por_leito = {}
    reserva_tb_por_leito = {}

    if quarto_ids:
        leitos = (
            await db.execute(
                select(LeitoDB).where(LeitoDB.quarto_id.in_(quarto_ids))
            )
        ).scalars().all()

        for leito in leitos:
            leitos_por_quarto.setdefault(leito.quarto_id, []).append(leito)

        leito_ids = [leito.id for leito in leitos]
        if leito_ids:
            ocupantes = (
                await db.execute(
                    select(
                        ConviventeDB.id,
                        ConviventeDB.nome_completo,
                        ConviventeDB.nome_social,
                        ConviventeDB.numero_institucional,
                        ConviventeDB.cpf,
                        ConviventeDB.leito_id,
                        ConviventeDB.status,
                    ).where(
                        ConviventeDB.instituicao_id == instituicao_id,
                        ConviventeDB.leito_id.in_(leito_ids),
                        ConviventeDB.status.in_(STATUS_CONVIVENTE_OCUPA_LEITO),
                    )
                )
            ).all()
            convivente_por_leito = {row.leito_id: row for row in ocupantes}

            reservas_tb = (
                await db.execute(
                    select(
                        ConviventeDB.id,
                        ConviventeDB.nome_completo,
                        ConviventeDB.nome_social,
                        ConviventeDB.numero_institucional,
                        ConviventeDB.cpf,
                        ConviventeDB.leito_reservado_id,
                        ConviventeDB.tb_remanejamento_situacao,
                    ).where(
                        ConviventeDB.instituicao_id == instituicao_id,
                        ConviventeDB.leito_reservado_id.in_(leito_ids),
                        ConviventeDB.reservar_leito_fixo.is_(True),
                        ConviventeDB.tb_remanejamento_situacao.isnot(None),
                    )
                )
            ).all()
            reserva_tb_por_leito = {row.leito_reservado_id: row for row in reservas_tb}

    lista_quartos = []
    leitos_orfaos_corrigidos = False

    for q in quartos:
        lista_leitos = []

        for l in leitos_por_quarto.get(q.id, []):
            convivente = convivente_por_leito.get(l.id)
            reserva_tb = reserva_tb_por_leito.get(l.id)
            convivente_id = None
            convivente_nome = None
            convivente_nome_completo = None
            numero_institucional = None
            cpf = None
            convivente_status = None
            tipo_reserva = None
            tb_remanejamento_situacao = None
            status_leito = l.status

            if convivente:
                convivente_id = convivente.id
                convivente_status = convivente.status
                convivente_nome_completo = (
                    convivente.nome_social
                    or convivente.nome_completo
                    or ""
                ).strip()

                convivente_nome = (
                    convivente_nome_completo.split(" ")[0]
                    if convivente_nome_completo
                    else "Sem nome"
                )

                numero_institucional = convivente.numero_institucional
                cpf = convivente.cpf
                status_leito = "Ocupado"
            elif reserva_tb:
                convivente_id = reserva_tb.id
                convivente_status = "Reservado TB"
                tipo_reserva = "tb_fixo"
                tb_remanejamento_situacao = reserva_tb.tb_remanejamento_situacao
                convivente_nome_completo = (
                    reserva_tb.nome_social
                    or reserva_tb.nome_completo
                    or ""
                ).strip()
                convivente_nome = (
                    convivente_nome_completo.split(" ")[0]
                    if convivente_nome_completo
                    else "Reservado"
                )
                numero_institucional = reserva_tb.numero_institucional
                cpf = reserva_tb.cpf
                status_leito = "Reservado"
            elif l.status == "Ocupado":
                l.status = "Livre"
                status_leito = "Livre"
                leitos_orfaos_corrigidos = True

            lista_leitos.append({
                "id": l.id,
                "identificacao": l.identificacao,
                "status": status_leito,
                "convivente_id": convivente_id,
                "convivente_status": convivente_status,
                "tipo_reserva": tipo_reserva,
                "convivente_nome": convivente_nome,
                "convivente_nome_completo": convivente_nome_completo,
                "numero_institucional": numero_institucional,
                "cpf": cpf,
                "tb_remanejamento_situacao": tb_remanejamento_situacao,
            })

        lista_leitos.sort(key=lambda leito: chave_ordenacao_natural(leito["identificacao"]))

        lista_quartos.append({
            "id": q.id,
            "nome": q.nome,
            "tipo_publico": q.tipo_publico,
            "modalidade": q.modalidade,
            "rotativo": bool(getattr(q, "rotativo", False)),
            "is_active": q.is_active,
            "leitos": lista_leitos
        })

    lista_quartos.sort(key=lambda quarto: chave_ordenacao_natural(quarto["nome"]))

    if leitos_orfaos_corrigidos:
        await db.commit()

    return lista_quartos


@router.patch("/leitos/{leito_id}/alocar")
async def alocar_convivente_leito(
    leito_id: str,
    payload: LeitoAlocacaoPayload,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_alocacao_leito)
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    leito = (
        await db.execute(
            select(LeitoDB)
            .join(QuartoDB, QuartoDB.id == LeitoDB.quarto_id)
            .where(
                LeitoDB.id == leito_id,
                QuartoDB.instituicao_id == instituicao_id
            )
        )
    ).scalar_one_or_none()

    if not leito:
        raise HTTPException(status_code=404, detail="Leito não encontrado.")

    if await leito_esta_reservado_por_outro(
        db,
        leito_id,
        instituicao_id,
        payload.convivente_id,
    ):
        raise HTTPException(
            status_code=400,
            detail="Este leito está reservado para remanejamento TB.",
        )

    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == payload.convivente_id,
                ConviventeDB.instituicao_id == instituicao_id,
                ConviventeDB.status == "Ativo"
            )
        )
    ).scalar_one_or_none()

    if not convivente:
        raise HTTPException(status_code=404, detail="Convivente ativo não encontrado.")

    ocupante_atual = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.instituicao_id == instituicao_id,
                ConviventeDB.leito_id == leito_id,
                ConviventeDB.status.in_(STATUS_CONVIVENTE_OCUPA_LEITO),
            )
        )
    ).scalar_one_or_none()

    if ocupante_atual and ocupante_atual.id != convivente.id:
        raise HTTPException(
            status_code=400,
            detail="Este leito já está ocupado. Libere o leito antes de alocar outro convivente."
        )

    try:
        leito_id_antigo = convivente.leito_id
        retornando_leito_reservado = (
            convivente.reservar_leito_fixo
            and convivente.leito_reservado_id == leito_id
        )

        if convivente.leito_id and convivente.leito_id != leito_id:
            if convivente.leito_reservado_id != convivente.leito_id:
                leito_anterior = (
                    await db.execute(
                        select(LeitoDB).where(LeitoDB.id == convivente.leito_id)
                    )
                ).scalar_one_or_none()

                if leito_anterior:
                    leito_anterior.status = "Livre"

        convivente.leito_id = leito_id
        leito.status = "Ocupado"

        if retornando_leito_reservado:
            await finalizar_reserva_tb_convivente(convivente)

        await sincronizar_leito_provisorio_convivente(
            db,
            convivente,
            leito_id,
            instituicao_id,
        )
        if leito_id_antigo != convivente.leito_id or convivente.leito_reservado_id:
            await sincronizar_status_leitos_convivente(db, convivente, leito_id_antigo)
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Não foi possível alocar o convivente no leito.",
        ) from e

    return {"status": "sucesso", "mensagem": "Convivente alocado com sucesso."}


@router.patch("/leitos/{leito_id}/liberar")
async def liberar_leito(
    leito_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(exigir_alocacao_leito)
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    leito = (
        await db.execute(
            select(LeitoDB)
            .join(QuartoDB, QuartoDB.id == LeitoDB.quarto_id)
            .where(
                LeitoDB.id == leito_id,
                QuartoDB.instituicao_id == instituicao_id
            )
        )
    ).scalar_one_or_none()

    if not leito:
        raise HTTPException(status_code=404, detail="Leito não encontrado.")

    if await leito_esta_reservado_por_outro(db, leito_id, instituicao_id):
        raise HTTPException(
            status_code=400,
            detail="Este leito está reservado para remanejamento TB. Retorne o convivente ao leito fixo ou encerre a reserva no prontuário.",
        )

    ocupante = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.instituicao_id == instituicao_id,
                ConviventeDB.leito_id == leito_id,
                ConviventeDB.status.in_(STATUS_CONVIVENTE_OCUPA_LEITO),
            )
        )
    ).scalar_one_or_none()

    if not ocupante:
        reserva_tb = (
            await db.execute(
                select(ConviventeDB).where(
                    ConviventeDB.instituicao_id == instituicao_id,
                    ConviventeDB.leito_reservado_id == leito_id,
                    ConviventeDB.reservar_leito_fixo.is_(True),
                ).limit(1)
            )
        ).scalar_one_or_none()
        if reserva_tb:
            nome = (reserva_tb.nome_social or reserva_tb.nome_completo or "convivente").strip()
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Este leito está reservado para {nome}. "
                    "Use a opção de retorno ao leito fixo no mapa de quartos ou no prontuário."
                ),
            )
        leito.status = "Livre"
        await db.commit()
        return {"status": "sucesso", "mensagem": "Leito liberado."}

    try:
        ocupante.leito_id = None
        leito.status = "Livre"
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Não foi possível liberar o leito.",
        ) from e

    return {"status": "sucesso", "mensagem": "Leito liberado com sucesso."}

@router.put("/{quarto_id}")
async def atualizar_quarto(
    quarto_id: str, 
    payload: QuartoUpdate, 
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(exigir_tecnico_ou_gestor)
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    _validar_modalidade_quarto(payload.modalidade)
    try:
        query = select(QuartoDB).where(QuartoDB.id == quarto_id, QuartoDB.instituicao_id == instituicao_id)
        res = await db.execute(query)
        quarto = res.scalar_one_or_none()
        
        if not quarto:
            raise HTTPException(status_code=404, detail="Quarto não encontrado.")

        quarto.nome = payload.nome
        quarto.tipo_publico = payload.tipo_publico
        quarto.modalidade = payload.modalidade
        quarto.rotativo = payload.rotativo

        query_leitos = select(LeitoDB).where(LeitoDB.quarto_id == quarto.id)
        res_leitos = await db.execute(query_leitos)
        leitos_atuais = res_leitos.scalars().all()
        mapa_leitos_atuais = {l.id: l for l in leitos_atuais}
        mapa_leitos_por_identificacao = {
            (l.identificacao or "").strip().lower(): l
            for l in leitos_atuais
            if (l.identificacao or "").strip()
        }
        ids_ocupados = {
            leito_id
            for leito_id in (
                await db.execute(
                    select(ConviventeDB.leito_id).where(
                        ConviventeDB.instituicao_id == instituicao_id,
                        ConviventeDB.leito_id.in_(list(mapa_leitos_atuais.keys())),
                        ConviventeDB.status.in_(STATUS_CONVIVENTE_OCUPA_LEITO),
                    )
                )
            ).scalars().all()
            if leito_id
        } if mapa_leitos_atuais else set()

        ids_reservados = {
            leito_id
            for leito_id in (
                await db.execute(
                    select(ConviventeDB.leito_reservado_id).where(
                        ConviventeDB.instituicao_id == instituicao_id,
                        ConviventeDB.leito_reservado_id.in_(list(mapa_leitos_atuais.keys())),
                        ConviventeDB.reservar_leito_fixo.is_(True),
                    )
                )
            ).scalars().all()
            if leito_id
        } if mapa_leitos_atuais else set()

        ids_recebidos = []
        for leito_payload in payload.leitos:
            if leito_payload.id and leito_payload.id in mapa_leitos_atuais:
                l_existente = mapa_leitos_atuais[leito_payload.id]
                l_existente.identificacao = leito_payload.identificacao
                ids_recebidos.append(leito_payload.id)
            else:
                identificacao = (leito_payload.identificacao or "").strip()
                if not identificacao:
                    continue

                leito_existente_por_nome = mapa_leitos_por_identificacao.get(
                    identificacao.lower()
                )

                if leito_existente_por_nome:
                    leito_existente_por_nome.identificacao = identificacao
                    ids_recebidos.append(leito_existente_por_nome.id)
                    continue

                novo_leito = LeitoDB(
                    quarto_id=quarto.id,
                    identificacao=identificacao,
                    status="Livre"
                )
                db.add(novo_leito)

        for l_id, l_obj in mapa_leitos_atuais.items():
            if l_id not in ids_recebidos:
                if l_id in ids_ocupados or l_id in ids_reservados:
                    continue

                await db.delete(l_obj)

        await db.commit()
        return {"status": "sucesso", "mensagem": "Quarto atualizado com sucesso."}
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Não foi possível atualizar o quarto.",
        ) from e

@router.delete("/{quarto_id}")
async def excluir_quarto(
    quarto_id: str, 
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(exigir_tecnico_ou_gestor)
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    try:
        query = select(QuartoDB).where(QuartoDB.id == quarto_id, QuartoDB.instituicao_id == instituicao_id)
        res = await db.execute(query)
        quarto = res.scalar_one_or_none()
        
        if not quarto:
            raise HTTPException(status_code=404, detail="Quarto não encontrado.")

        query_leitos = select(LeitoDB).where(LeitoDB.quarto_id == quarto.id)
        res_leitos = await db.execute(query_leitos)
        leitos = res_leitos.scalars().all()
        leito_ids = [leito.id for leito in leitos]

        if leito_ids:
            convivente_vinculado = (
                await db.execute(
                    select(ConviventeDB.id).where(
                        ConviventeDB.instituicao_id == instituicao_id,
                        ConviventeDB.leito_id.in_(leito_ids),
                        ConviventeDB.status.in_(STATUS_CONVIVENTE_OCUPA_LEITO),
                    )
                )
            ).scalar_one_or_none()

            if convivente_vinculado:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Não é possível excluir um quarto com leitos ocupados. "
                        "Transfira ou desvincule os conviventes antes de excluir."
                    )
                )

            reserva_vinculada = (
                await db.execute(
                    select(ConviventeDB.id).where(
                        ConviventeDB.instituicao_id == instituicao_id,
                        ConviventeDB.leito_reservado_id.in_(leito_ids),
                        ConviventeDB.reservar_leito_fixo.is_(True),
                    )
                )
            ).scalar_one_or_none()
            if reserva_vinculada:
                raise HTTPException(
                    status_code=400,
                    detail="Não é possível excluir um quarto com leitos reservados para TB.",
                )

        for l in leitos:
            await db.delete(l)
        
        await db.delete(quarto)
        await db.commit()
        return {"status": "sucesso"}
    except HTTPException:
        await db.rollback()
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Não foi possível excluir o quarto.",
        ) from e
