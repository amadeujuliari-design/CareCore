from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from database import get_db
from models import QuartoDB, LeitoDB, ConviventeDB
from schemas import QuartoCreate, QuartoUpdate
from security import exigir_tecnico_ou_gestor, get_usuario_logado

router = APIRouter(prefix="/api/quartos", tags=["Quartos e Leitos"])

@router.post("", status_code=status.HTTP_201_CREATED)
async def criar_quarto(
    payload: QuartoCreate, 
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(exigir_tecnico_ou_gestor)
):
    try:
        async with db.begin():
            novo_quarto = QuartoDB(
                instituicao_id=usuario_atual["instituicao_id"],
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
                
        return {"status": "sucesso", "mensagem": "Quarto configurado e leitos criados com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao criar estrutura de quartos: {str(e)}")

@router.get("")
async def listar_quartos(
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(get_usuario_logado)
):
    query = select(QuartoDB).where(
        QuartoDB.instituicao_id == usuario_atual["instituicao_id"]
    )
    resultado = await db.execute(query)
    quartos = resultado.scalars().all()

    lista_quartos = []

    for q in quartos:
        query_leitos = select(LeitoDB).where(
            LeitoDB.quarto_id == q.id
        )
        res_leitos = await db.execute(query_leitos)
        leitos_do_quarto = res_leitos.scalars().all()

        lista_leitos = []

        for l in leitos_do_quarto:
            convivente = (
                await db.execute(
                    select(ConviventeDB).where(
                        ConviventeDB.instituicao_id == usuario_atual["instituicao_id"],
                        ConviventeDB.leito_id == l.id,
                        ConviventeDB.status == "Ativo"
                    )
                )
            ).scalar_one_or_none()

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

        lista_quartos.append({
            "id": q.id,
            "nome": q.nome,
            "tipo_publico": q.tipo_publico,
            "modalidade": q.modalidade,
            "is_active": q.is_active,
            "leitos": lista_leitos
        })

    return lista_quartos

@router.put("/{quarto_id}")
async def atualizar_quarto(
    quarto_id: str, 
    payload: QuartoUpdate, 
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(exigir_tecnico_ou_gestor)
):
    try:
        # CORREÇÃO: Iniciamos a transação ANTES de fazer as buscas no banco
        async with db.begin():
            query = select(QuartoDB).where(QuartoDB.id == quarto_id, QuartoDB.instituicao_id == usuario_atual["instituicao_id"])
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

            ids_recebidos = []
            for leito_payload in payload.leitos:
                if leito_payload.id and leito_payload.id in mapa_leitos_atuais:
                    l_existente = mapa_leitos_atuais[leito_payload.id]
                    l_existente.identificacao = leito_payload.identificacao
                    ids_recebidos.append(leito_payload.id)
                else:
                    novo_leito = LeitoDB(quarto_id=quarto.id, identificacao=leito_payload.identificacao, status="Livre")
                    db.add(novo_leito)

            for l_id, l_obj in mapa_leitos_atuais.items():
                if l_id not in ids_recebidos:
                    await db.delete(l_obj)

        return {"status": "sucesso", "mensagem": "Quarto atualizado com sucesso."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro no banco de dados: {str(e)}")

@router.delete("/{quarto_id}")
async def excluir_quarto(
    quarto_id: str, 
    db: AsyncSession = Depends(get_db), 
    usuario_atual: dict = Depends(exigir_tecnico_ou_gestor)
):
    try:
        # CORREÇÃO: Transação em volta de tudo aqui também
        async with db.begin():
            query = select(QuartoDB).where(QuartoDB.id == quarto_id, QuartoDB.instituicao_id == usuario_atual["instituicao_id"])
            res = await db.execute(query)
            quarto = res.scalar_one_or_none()
            
            if not quarto:
                raise HTTPException(status_code=404, detail="Quarto não encontrado.")

            query_leitos = select(LeitoDB).where(LeitoDB.quarto_id == quarto.id)
            res_leitos = await db.execute(query_leitos)
            leitos = res_leitos.scalars().all()
            for l in leitos:
                await db.delete(l)
            
            await db.delete(quarto)
            
        return {"status": "sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))