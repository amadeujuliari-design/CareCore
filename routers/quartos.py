from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
from models import QuartoDB, LeitoDB, ConviventeDB
from schemas import LeitoAlocacaoPayload, QuartoCreate, QuartoUpdate
from ordenacao_natural import chave_ordenacao_natural
from security import exigir_perfis, exigir_tecnico_ou_gestor, get_usuario_logado
from tenant_scope import obter_instituicao_escopo

router = APIRouter(prefix="/api/quartos", tags=["Quartos e Leitos"])

exigir_alocacao_leito = exigir_perfis("Gestor", "Técnico", "Administrativo")


@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_quarto(
    payload: QuartoCreate, 
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(exigir_tecnico_ou_gestor)
):
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    try:
        novo_quarto = QuartoDB(
            instituicao_id=instituicao_id,
            nome=payload.nome,
            tipo_publico=payload.tipo_publico,
            modalidade=payload.modalidade
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
                    ).where(
                        ConviventeDB.instituicao_id == instituicao_id,
                        ConviventeDB.leito_id.in_(leito_ids),
                        ConviventeDB.status == "Ativo",
                    )
                )
            ).all()
            convivente_por_leito = {row.leito_id: row for row in ocupantes}

    lista_quartos = []

    for q in quartos:
        lista_leitos = []

        for l in leitos_por_quarto.get(q.id, []):
            convivente = convivente_por_leito.get(l.id)
            convivente_id = None
            convivente_nome = None
            convivente_nome_completo = None
            numero_institucional = None
            cpf = None

            if convivente:
                convivente_id = convivente.id
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

            lista_leitos.append({
                "id": l.id,
                "identificacao": l.identificacao,
                "status": l.status,
                "convivente_id": convivente_id,
                "convivente_nome": convivente_nome,
                "convivente_nome_completo": convivente_nome_completo,
                "numero_institucional": numero_institucional,
                "cpf": cpf
            })

        lista_leitos.sort(key=lambda leito: chave_ordenacao_natural(leito["identificacao"]))

        lista_quartos.append({
            "id": q.id,
            "nome": q.nome,
            "tipo_publico": q.tipo_publico,
            "modalidade": q.modalidade,
            "is_active": q.is_active,
            "leitos": lista_leitos
        })

    lista_quartos.sort(key=lambda quarto: chave_ordenacao_natural(quarto["nome"]))

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
                ConviventeDB.status == "Ativo"
            )
        )
    ).scalar_one_or_none()

    if ocupante_atual and ocupante_atual.id != convivente.id:
        raise HTTPException(
            status_code=400,
            detail="Este leito já está ocupado. Libere o leito antes de alocar outro convivente."
        )

    try:
        if convivente.leito_id and convivente.leito_id != leito_id:
            leito_anterior = (
                await db.execute(
                    select(LeitoDB).where(LeitoDB.id == convivente.leito_id)
                )
            ).scalar_one_or_none()

            if leito_anterior:
                leito_anterior.status = "Livre"

        convivente.leito_id = leito_id
        leito.status = "Ocupado"
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

    ocupante = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.instituicao_id == instituicao_id,
                ConviventeDB.leito_id == leito_id,
                ConviventeDB.status == "Ativo"
            )
        )
    ).scalar_one_or_none()

    if not ocupante:
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
    try:
        query = select(QuartoDB).where(QuartoDB.id == quarto_id, QuartoDB.instituicao_id == instituicao_id)
        res = await db.execute(query)
        quarto = res.scalar_one_or_none()
        
        if not quarto:
            raise HTTPException(status_code=404, detail="Quarto não encontrado.")

        quarto.nome = payload.nome
        quarto.tipo_publico = payload.tipo_publico
        quarto.modalidade = payload.modalidade

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
                        ConviventeDB.status == "Ativo"
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
                if l_id in ids_ocupados:
                    # Preserva leitos ocupados mesmo se o front antigo não enviar o ID.
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
                        ConviventeDB.status == "Ativo"
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