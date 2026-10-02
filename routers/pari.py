"""Kit mensal de higiene e agenda OMO do Reencontro Pari."""
from __future__ import annotations

import json
import re
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from config_operacional_projeto import projeto_e_reencontro_pari
from database import get_db
from kit_higiene_pari import (
    PERFIS_PADRAO,
    SEXOS_PERFIL,
    descricao_faixa,
    faixa_cruza,
    montar_kit,
    normalizar_sexo,
)
from models import (
    ConviventeDB,
    FamiliaConviventeDB,
    InstituicaoDB,
    ItemHigieneDB,
    KitHigieneEntregaDB,
    KitHigieneRegraDB,
    LavanderiaAgendaDB,
    TipoIndividuoHigieneDB,
)
from security import bloquear_usuario_global_puro, get_usuario_logado
from tenant_scope import obter_instituicao_escopo
from time_operacional import agora_operacional_naive

router = APIRouter(prefix="/api/pari", tags=["Reencontro Pari"])

class PerfilUpdate(BaseModel):
    idade_min: int = Field(ge=0, le=120)
    idade_max: int | None = Field(default=None, ge=0, le=120)
    sexo: str


INICIOS_LAVANDERIA = (
    (5, 20),
    (6, 50),
    (8, 20),
    (9, 50),
    (11, 20),
    (14, 0),
    (15, 30),
    (17, 0),
    (18, 30),
    (20, 0),
    (21, 30),
    (23, 0),
)
DURACAO_SLOT = timedelta(minutes=90)
MAQUINA_CONJUNTO = "conjunto"


class NomeCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=80)
    descricao: str = ""


class RegraCreate(BaseModel):
    item_id: str
    tipo_id: str
    quantidade: int = Field(ge=1, le=99)


class EntregaCreate(BaseModel):
    convivente_id: str


class MembroKitUpdate(BaseModel):
    data_nascimento: date | None = None
    sexo: str = ""


class LeituraLavanderia(BaseModel):
    convivente_id: str
    maquina: str | None = None
    inicio: str | None = None


class VinculoFamiliar(BaseModel):
    convivente_id: str
    familia_id: str | None = None
    nova: bool = False


def _usuario_id(usuario_atual: dict) -> str | None:
    return usuario_atual.get("sub") or usuario_atual.get("id")


async def _exigir_pari(db: AsyncSession, usuario_atual: dict) -> str:
    bloquear_usuario_global_puro(usuario_atual)
    instituicao_id = obter_instituicao_escopo(usuario_atual)
    projeto = await db.get(InstituicaoDB, instituicao_id)
    if not projeto_e_reencontro_pari(projeto):
        raise HTTPException(status_code=404, detail="Recurso disponível apenas no Reencontro Pari.")
    return instituicao_id


def _perfil_dict(tipo: TipoIndividuoHigieneDB) -> dict:
    return {
        "id": tipo.id,
        "nome": tipo.nome,
        "idade_min": tipo.idade_min,
        "idade_max": tipo.idade_max,
        "sexo": tipo.sexo or "",
        "ativo": bool(tipo.ativo),
        "ordem": tipo.ordem or 0,
    }


def _pessoa_kit(membro: ConviventeDB) -> dict:
    return {
        "nome": membro.nome_social or membro.nome_completo,
        "nascimento": membro.data_nascimento,
        "sexo": membro.sexo or membro.identidade_genero,
    }


async def _alinhar_perfis(db: AsyncSession, instituicao_id: str) -> None:
    tipos = (
        await db.execute(
            select(TipoIndividuoHigieneDB).where(
                TipoIndividuoHigieneDB.instituicao_id == instituicao_id
            )
        )
    ).scalars().all()
    com_regra = set(
        (
            await db.execute(
                select(KitHigieneRegraDB.tipo_id).where(
                    KitHigieneRegraDB.instituicao_id == instituicao_id
                )
            )
        ).scalars().all()
    )
    por_nome = {tipo.nome.casefold(): tipo for tipo in tipos}

    def renomear(antigo: str, novo: str) -> None:
        atual = por_nome.get(antigo)
        if not atual or novo.casefold() in por_nome or atual.id in com_regra:
            return
        atual.nome = novo
        por_nome[novo.casefold()] = atual
        del por_nome[antigo]

    renomear("adolescente", "Adolescente masculino")
    renomear("adulto", "Homem")
    await db.flush()

    for padrao in PERFIS_PADRAO:
        atual = por_nome.get(padrao["nome"].casefold())
        if atual is None:
            novo = TipoIndividuoHigieneDB(
                instituicao_id=instituicao_id,
                nome=padrao["nome"],
                descricao=descricao_faixa(padrao["idade_min"], padrao["idade_max"], padrao["sexo"]),
                ordem=padrao["ordem"],
                ativo=True,
                idade_min=padrao["idade_min"],
                idade_max=padrao["idade_max"],
                sexo=padrao["sexo"],
            )
            db.add(novo)
            por_nome[padrao["nome"].casefold()] = novo
            continue
        if atual.idade_min is None:
            atual.idade_min = padrao["idade_min"]
            atual.idade_max = padrao["idade_max"]
            atual.sexo = padrao["sexo"]
            atual.ordem = padrao["ordem"]
            atual.ativo = True
            atual.descricao = descricao_faixa(padrao["idade_min"], padrao["idade_max"], padrao["sexo"])
    await db.commit()


def _slots_do_dia(dia) -> list[tuple[datetime, datetime]]:
    saida = []
    for hora, minuto in INICIOS_LAVANDERIA:
        inicio = datetime.combine(dia, time(hora, minuto))
        saida.append((inicio, inicio + DURACAO_SLOT))
    return saida


def _parse_inicio_agenda(valor: str) -> datetime:
    texto = (valor or "").strip().replace("Z", "")
    if "." in texto:
        texto = texto.split(".", 1)[0]
    for formato in ("%Y-%m-%dT%H:%M", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(texto, formato)
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail="Horário inválido.")


def _fim_do_slot(inicio: datetime) -> datetime:
    grade = {marca: fim for marca, fim in _slots_do_dia(inicio.date())}
    fim = grade.get(inicio)
    if not fim:
        raise HTTPException(status_code=400, detail="Esse horário não faz parte da grade de 1h30.")
    return fim


async def _unificar_maquinas(db: AsyncSession, instituicao_id: str) -> None:
    antigos = (
        await db.execute(
            select(LavanderiaAgendaDB).where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.maquina.in_(("lavar", "secar")),
            )
        )
    ).scalars().all()
    if not antigos:
        return
    for registro in antigos:
        if registro.maquina == "secar":
            await db.delete(registro)
        else:
            registro.maquina = MAQUINA_CONJUNTO
    await db.commit()


async def _gravar_reserva(
    db: AsyncSession,
    instituicao_id: str,
    maquina: str,
    inicio: datetime,
    fim: datetime,
    convivente_id: str,
) -> LavanderiaAgendaDB:
    existente = (
        await db.execute(
            select(LavanderiaAgendaDB).where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.maquina == maquina,
                LavanderiaAgendaDB.inicio == inicio,
            )
        )
    ).scalar_one_or_none()
    if existente and existente.status in ("agendado", "em_uso"):
        raise HTTPException(status_code=409, detail="Esse horário já está ocupado.")
    if existente:
        existente.convivente_id = convivente_id
        existente.fim = fim
        existente.status = "agendado"
        existente.liberado_em = None
        return existente
    registro = LavanderiaAgendaDB(
        instituicao_id=instituicao_id,
        maquina=maquina,
        inicio=inicio,
        fim=fim,
        convivente_id=convivente_id,
        status="agendado",
    )
    db.add(registro)
    return registro


def _iso(valor: datetime | None) -> str | None:
    return valor.isoformat(timespec="minutes") if valor else None


async def _convivente_pari(db: AsyncSession, instituicao_id: str, convivente_id: str) -> ConviventeDB:
    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == convivente_id,
                ConviventeDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not convivente:
        raise HTTPException(status_code=404, detail="Convivente não encontrado neste projeto.")
    return convivente


@router.get("/kit")
async def obter_kit(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    await _alinhar_perfis(db, instituicao_id)
    tipos = (
        await db.execute(
            select(TipoIndividuoHigieneDB)
            .where(
                TipoIndividuoHigieneDB.instituicao_id == instituicao_id,
                TipoIndividuoHigieneDB.ativo.is_(True),
            )
            .order_by(TipoIndividuoHigieneDB.ordem, TipoIndividuoHigieneDB.nome)
        )
    ).scalars().all()
    itens = (
        await db.execute(
            select(ItemHigieneDB)
            .where(ItemHigieneDB.instituicao_id == instituicao_id)
            .order_by(ItemHigieneDB.nome)
        )
    ).scalars().all()
    regras = (
        await db.execute(
            select(KitHigieneRegraDB).where(KitHigieneRegraDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()
    entregas = (
        await db.execute(
            select(KitHigieneEntregaDB, FamiliaConviventeDB.codigo)
            .outerjoin(FamiliaConviventeDB, FamiliaConviventeDB.id == KitHigieneEntregaDB.familia_id)
            .where(KitHigieneEntregaDB.instituicao_id == instituicao_id)
            .order_by(KitHigieneEntregaDB.entregue_em.desc())
            .limit(20)
        )
    ).all()
    return {
        "tipos": [
            {
                "id": tipo.id,
                "nome": tipo.nome,
                "descricao": tipo.descricao or "",
                "idade_min": tipo.idade_min,
                "idade_max": tipo.idade_max,
                "sexo": tipo.sexo or "qualquer",
                "ordem": tipo.ordem or 0,
            }
            for tipo in tipos
        ],
        "itens": [
            {"id": item.id, "nome": item.nome, "ativo": bool(item.ativo)}
            for item in itens
        ],
        "regras": [
            {
                "id": regra.id,
                "item_id": regra.item_id,
                "tipo_id": regra.tipo_id,
                "quantidade": regra.quantidade,
            }
            for regra in regras
        ],
        "entregas": [
            {
                "id": entrega.id,
                "familia_id": entrega.familia_id,
                "familia_codigo": codigo or "",
                "competencia": entrega.competencia,
                "entregue_em": _iso(entrega.entregue_em),
                "composicao": json.loads(entrega.composicao or "[]"),
            }
            for entrega, codigo in entregas
        ],
    }


@router.post("/kit/tipos")
async def criar_tipo(
    payload: NomeCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    db.add(
        TipoIndividuoHigieneDB(
            instituicao_id=instituicao_id,
            nome=payload.nome.strip(),
            descricao=payload.descricao.strip() or None,
            ordem=50,
            ativo=True,
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Já existe um tipo com esse nome.")
    return {"status": "ok"}


@router.post("/kit/itens")
async def criar_item(
    payload: NomeCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    db.add(ItemHigieneDB(instituicao_id=instituicao_id, nome=payload.nome.strip(), ativo=True))
    await db.commit()
    return {"status": "ok"}


@router.post("/kit/regras")
async def criar_regra(
    payload: RegraCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    item = await db.get(ItemHigieneDB, payload.item_id)
    tipo = await db.get(TipoIndividuoHigieneDB, payload.tipo_id)
    if not item or item.instituicao_id != instituicao_id or not tipo or tipo.instituicao_id != instituicao_id:
        raise HTTPException(status_code=404, detail="Item ou tipo não encontrado.")
    existente = (
        await db.execute(
            select(KitHigieneRegraDB).where(
                KitHigieneRegraDB.item_id == item.id,
                KitHigieneRegraDB.tipo_id == tipo.id,
            )
        )
    ).scalar_one_or_none()
    if existente:
        existente.quantidade = payload.quantidade
        await db.commit()
        return {"status": "ok"}
    db.add(
        KitHigieneRegraDB(
            instituicao_id=instituicao_id,
            item_id=item.id,
            tipo_id=tipo.id,
            quantidade=payload.quantidade,
        )
    )
    await db.commit()
    return {"status": "ok"}


@router.delete("/kit/regras/{regra_id}")
async def excluir_regra(
    regra_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    regra = await db.get(KitHigieneRegraDB, regra_id)
    if not regra or regra.instituicao_id != instituicao_id:
        raise HTTPException(status_code=404, detail="Regra não encontrada.")
    await db.delete(regra)
    await db.commit()
    return {"status": "ok"}


async def _previa_familia(db: AsyncSession, instituicao_id: str, convivente_id: str) -> tuple[dict, ConviventeDB]:
    await _alinhar_perfis(db, instituicao_id)
    convivente = await _convivente_pari(db, instituicao_id, convivente_id)
    if not convivente.familia_id:
        raise HTTPException(status_code=400, detail="Este convivente ainda não está em uma família.")
    familia = await db.get(FamiliaConviventeDB, convivente.familia_id)
    membros = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.familia_id == convivente.familia_id,
                ConviventeDB.instituicao_id == instituicao_id,
                ConviventeDB.status == "Ativo",
            )
        )
    ).scalars().all()
    tipos = (
        await db.execute(
            select(TipoIndividuoHigieneDB).where(TipoIndividuoHigieneDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()
    regras = (
        await db.execute(
            select(KitHigieneRegraDB).where(KitHigieneRegraDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()
    itens = (
        await db.execute(
            select(ItemHigieneDB).where(ItemHigieneDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()
    hoje = agora_operacional_naive().date()
    previa = montar_kit(
        [_pessoa_kit(membro) for membro in membros],
        [_perfil_dict(tipo) for tipo in tipos],
        [
            {"tipo_id": regra.tipo_id, "item_id": regra.item_id, "quantidade": regra.quantidade}
            for regra in regras
        ],
        [{"id": item.id, "nome": item.nome, "ativo": bool(item.ativo)} for item in itens],
        hoje,
    )
    competencia = hoje.strftime("%Y-%m")
    ja_entregue = (
        await db.execute(
            select(KitHigieneEntregaDB).where(
                KitHigieneEntregaDB.familia_id == convivente.familia_id,
                KitHigieneEntregaDB.competencia == competencia,
            )
        )
    ).scalar_one_or_none()
    previa.update({
        "familia_codigo": familia.codigo if familia else "",
        "familia_id": convivente.familia_id,
        "competencia": competencia,
        "ja_entregue": ja_entregue is not None,
        "composicao_entregue": json.loads(ja_entregue.composicao or "[]") if ja_entregue else [],
        "membros": [
            {
                "id": membro.id,
                "nome": membro.nome_social or membro.nome_completo,
                "nascimento": membro.data_nascimento.isoformat() if membro.data_nascimento else None,
                "sexo": normalizar_sexo(membro.sexo or membro.identidade_genero) or "",
            }
            for membro in sorted(
                membros,
                key=lambda item: (item.nome_social or item.nome_completo or "").casefold(),
            )
        ],
    })
    return previa, convivente


@router.patch("/kit/tipos/{tipo_id}")
async def atualizar_tipo(
    tipo_id: str,
    payload: PerfilUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    tipo = await db.get(TipoIndividuoHigieneDB, tipo_id)
    if not tipo or tipo.instituicao_id != instituicao_id:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")
    sexo = payload.sexo.strip().casefold()
    if sexo not in SEXOS_PERFIL:
        raise HTTPException(status_code=400, detail="Sexo do perfil inválido.")
    if payload.idade_max is not None and payload.idade_max < payload.idade_min:
        raise HTTPException(status_code=400, detail="A idade final precisa ser igual ou maior que a inicial.")
    outros = (
        await db.execute(
            select(TipoIndividuoHigieneDB).where(
                TipoIndividuoHigieneDB.instituicao_id == instituicao_id,
                TipoIndividuoHigieneDB.id != tipo.id,
                TipoIndividuoHigieneDB.ativo.is_(True),
            )
        )
    ).scalars().all()
    proposta = {
        "idade_min": payload.idade_min,
        "idade_max": payload.idade_max,
        "sexo": sexo,
        "ativo": True,
    }
    for outro in outros:
        if faixa_cruza(proposta, _perfil_dict(outro)):
            raise HTTPException(status_code=400, detail=f"Essa faixa cruza com {outro.nome}.")
    tipo.idade_min = payload.idade_min
    tipo.idade_max = payload.idade_max
    tipo.sexo = sexo
    tipo.descricao = descricao_faixa(payload.idade_min, payload.idade_max, sexo)
    await db.commit()
    return {"status": "ok", "descricao": tipo.descricao}


@router.patch("/kit/membros/{convivente_id}")
async def atualizar_membro_kit(
    convivente_id: str,
    payload: MembroKitUpdate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    convivente = await _convivente_pari(db, instituicao_id, convivente_id)
    if convivente.status != "Ativo":
        raise HTTPException(status_code=400, detail="Somente acolhido ativo entra no kit.")
    texto_sexo = (payload.sexo or "").strip()
    if texto_sexo:
        sexo = normalizar_sexo(texto_sexo)
        if sexo not in {"masculino", "feminino"}:
            raise HTTPException(status_code=400, detail="Informe masculino ou feminino.")
    else:
        sexo = None
    convivente.data_nascimento = payload.data_nascimento
    convivente.sexo = sexo
    await db.commit()
    previa, _convivente = await _previa_familia(db, instituicao_id, convivente.id)
    return previa


@router.post("/kit/previa")
async def prever_kit(
    payload: EntregaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    previa, _convivente = await _previa_familia(db, instituicao_id, payload.convivente_id)
    return previa


@router.post("/kit/entrega")
async def entregar_kit(
    payload: EntregaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    previa, convivente = await _previa_familia(db, instituicao_id, payload.convivente_id)
    if previa["ja_entregue"]:
        raise HTTPException(
            status_code=409,
            detail=f"A família {previa['familia_codigo']} já retirou o kit em {previa['competencia'][5:7]}/{previa['competencia'][:4]}.",
        )
    if previa["pendencias"]:
        nomes = ", ".join(item["nome"] for item in previa["pendencias"][:6])
        raise HTTPException(
            status_code=400,
            detail=f"O kit não fecha enquanto houver alguém fora do perfil: {nomes}.",
        )
    if not previa["composicao"]:
        raise HTTPException(
            status_code=400,
            detail="Cadastre os itens e a quantidade de cada perfil antes de entregar.",
        )
    agora = agora_operacional_naive()
    entrega = KitHigieneEntregaDB(
        instituicao_id=instituicao_id,
        familia_id=convivente.familia_id,
        competencia=previa["competencia"],
        convivente_id=convivente.id,
        usuario_id=_usuario_id(usuario_atual),
        composicao=json.dumps(previa["composicao"], ensure_ascii=False),
        entregue_em=agora,
    )
    db.add(entrega)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"A família {previa['familia_codigo']} já retirou o kit neste mês.",
        )
    return previa


@router.get("/lavanderia")
async def listar_agenda(
    data: str | None = None,
    dias: int = Query(7, ge=1, le=14),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    await _unificar_maquinas(db, instituicao_id)
    agora = agora_operacional_naive()
    try:
        dia = datetime.strptime(data, "%Y-%m-%d").date() if data else agora.date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida.")
    inicio_faixa = datetime.combine(dia, time.min)
    fim_faixa = inicio_faixa + timedelta(days=dias)
    registros = (
        await db.execute(
            select(LavanderiaAgendaDB, ConviventeDB.id, ConviventeDB.nome_completo, FamiliaConviventeDB.codigo)
            .join(ConviventeDB, ConviventeDB.id == LavanderiaAgendaDB.convivente_id)
            .outerjoin(FamiliaConviventeDB, FamiliaConviventeDB.id == ConviventeDB.familia_id)
            .where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.inicio >= inicio_faixa,
                LavanderiaAgendaDB.inicio < fim_faixa,
                LavanderiaAgendaDB.status.in_(("agendado", "em_uso")),
            )
            .order_by(LavanderiaAgendaDB.inicio)
        )
    ).all()
    ocupados = {
        (registro.maquina, registro.inicio): {
            "id": registro.id,
            "maquina": registro.maquina,
            "inicio": _iso(registro.inicio),
            "fim": _iso(registro.fim),
            "status": registro.status,
            "convivente_id": convivente_id,
            "convivente_nome": nome,
            "familia_codigo": codigo or "",
        }
        for registro, convivente_id, nome, codigo in registros
    }
    agenda = []
    for deslocamento in range(dias):
        dia_slot = dia + timedelta(days=deslocamento)
        for inicio, fim in _slots_do_dia(dia_slot):
            chave = (MAQUINA_CONJUNTO, inicio)
            agenda.append(
                ocupados.get(
                    chave,
                    {
                        "maquina": MAQUINA_CONJUNTO,
                        "inicio": _iso(inicio),
                        "fim": _iso(fim),
                        "status": "livre",
                        "convivente_id": "",
                        "convivente_nome": "",
                        "familia_codigo": "",
                    },
                )
            )
    return {"data": dia.isoformat(), "dias": dias, "agenda": agenda}


@router.get("/lavanderia/registros")
async def listar_registros_lavanderia(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    await _unificar_maquinas(db, instituicao_id)
    linhas = (
        await db.execute(
            select(
                LavanderiaAgendaDB,
                ConviventeDB.nome_social,
                ConviventeDB.nome_completo,
                ConviventeDB.numero_institucional,
                FamiliaConviventeDB.codigo,
            )
            .join(ConviventeDB, ConviventeDB.id == LavanderiaAgendaDB.convivente_id)
            .outerjoin(FamiliaConviventeDB, FamiliaConviventeDB.id == ConviventeDB.familia_id)
            .where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.maquina == MAQUINA_CONJUNTO,
                LavanderiaAgendaDB.status.in_(("agendado", "em_uso")),
            )
            .order_by(LavanderiaAgendaDB.inicio)
        )
    ).all()
    confirmados = []
    realizados = []
    for registro, nome_social, nome_completo, prontuario, familia in linhas:
        item = {
            "id": registro.id,
            "convivente_nome": nome_social or nome_completo,
            "prontuario": prontuario,
            "familia_codigo": familia or "",
            "inicio": _iso(registro.inicio),
            "fim": _iso(registro.fim),
            "liberado_em": _iso(registro.liberado_em),
        }
        if registro.status == "em_uso":
            realizados.append(item)
        else:
            confirmados.append(item)
    return {"confirmados": confirmados, "realizados": list(reversed(realizados))}


@router.delete("/lavanderia/{agenda_id}")
async def cancelar_agendamento(
    agenda_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    registro = await db.get(LavanderiaAgendaDB, agenda_id)
    if not registro or registro.instituicao_id != instituicao_id:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
    if registro.status != "agendado":
        raise HTTPException(status_code=400, detail="Só é possível cancelar um horário que ainda está agendado.")
    registro.status = "cancelado"
    await db.commit()
    return {"status": "ok", "mensagem": "Horário cancelado. A vaga voltou a ficar livre."}


@router.post("/lavanderia/leitura")
async def ler_lavanderia(
    payload: LeituraLavanderia,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    await _unificar_maquinas(db, instituicao_id)
    maquina = MAQUINA_CONJUNTO
    convivente = await _convivente_pari(db, instituicao_id, payload.convivente_id)
    if convivente.status != "Ativo":
        raise HTTPException(status_code=400, detail="Somente convivente ativo usa a lavanderia.")
    agora = agora_operacional_naive()
    inicio_pedido = _parse_inicio_agenda(payload.inicio) if payload.inicio else None
    if inicio_pedido and inicio_pedido < agora - timedelta(minutes=2):
        raise HTTPException(status_code=400, detail="Esse horário já passou.")
    vigente = (
        await db.execute(
            select(LavanderiaAgendaDB).where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.maquina == maquina,
                LavanderiaAgendaDB.convivente_id == convivente.id,
                LavanderiaAgendaDB.status == "agendado",
                LavanderiaAgendaDB.fim > agora,
            )
        )
    ).scalar_one_or_none()
    if vigente and vigente.inicio <= agora:
        vigente.status = "em_uso"
        vigente.liberado_em = agora
        await db.commit()
        return {
            "acao": "liberado",
            "mensagem": f"Uso liberado até {_iso(vigente.fim)[-5:]}.",
            "inicio": _iso(vigente.inicio),
            "fim": _iso(vigente.fim),
            "maquina": maquina,
        }
    if vigente and (inicio_pedido is None or inicio_pedido == vigente.inicio):
        return {
            "acao": "agendado",
            "mensagem": f"Já há horário marcado às {_iso(vigente.inicio)[-5:]}. A segunda leitura, nesse horário, libera o uso.",
            "inicio": _iso(vigente.inicio),
            "fim": _iso(vigente.fim),
            "maquina": maquina,
        }
    if vigente and inicio_pedido:
        await db.delete(vigente)
        await db.flush()
    expirados = (
        await db.execute(
            select(LavanderiaAgendaDB).where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.convivente_id == convivente.id,
                LavanderiaAgendaDB.maquina == maquina,
                LavanderiaAgendaDB.status == "agendado",
                LavanderiaAgendaDB.fim <= agora,
            )
        )
    ).scalars().all()
    for expirado in expirados:
        expirado.status = "perdido"
    if inicio_pedido:
        inicio = inicio_pedido
        fim = _fim_do_slot(inicio_pedido)
    else:
        limite = agora - timedelta(minutes=2)
        escolhido = None
        for deslocamento in range(15):
            dia = (agora + timedelta(days=deslocamento)).date()
            ocupados = set(
                (
                    await db.execute(
                        select(LavanderiaAgendaDB.inicio).where(
                            LavanderiaAgendaDB.instituicao_id == instituicao_id,
                            LavanderiaAgendaDB.maquina == maquina,
                            LavanderiaAgendaDB.status.in_(("agendado", "em_uso")),
                            LavanderiaAgendaDB.inicio >= datetime.combine(dia, time.min),
                            LavanderiaAgendaDB.inicio < datetime.combine(dia, time.min) + timedelta(days=1),
                        )
                    )
                ).scalars().all()
            )
            for marca, fim_slot in _slots_do_dia(dia):
                if marca < limite or marca in ocupados:
                    continue
                escolhido = (marca, fim_slot)
                break
            if escolhido:
                break
        if not escolhido:
            raise HTTPException(status_code=400, detail="Não há horário livre nas próximas duas semanas.")
        inicio, fim = escolhido
    await _gravar_reserva(db, instituicao_id, maquina, inicio, fim, convivente.id)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Esse horário acabou de ser reservado. Leia de novo.")
    return {
        "acao": "agendado",
        "mensagem": f"Horário marcado: {inicio.strftime('%d/%m')} às {inicio.strftime('%H:%M')}. Nova leitura nesse horário libera o uso.",
        "inicio": _iso(inicio),
        "fim": _iso(fim),
        "maquina": maquina,
    }


def _numero_familia(codigo: str) -> int:
    texto = (codigo or "").strip().upper()
    if texto.startswith("F") and texto[1:].isdigit():
        return int(texto[1:])
    return 0


def _proximo_codigo(codigos: list[str]) -> str:
    maior = max((_numero_familia(codigo) for codigo in codigos), default=0)
    return f"F{maior + 1:03d}"


@router.get("/familias")
async def listar_familias(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    familias = (
        await db.execute(
            select(FamiliaConviventeDB).where(FamiliaConviventeDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()
    membros = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.instituicao_id == instituicao_id,
                ConviventeDB.familia_id.is_not(None),
            )
        )
    ).scalars().all()
    por_familia: dict[str, list] = {}
    for membro in membros:
        por_familia.setdefault(membro.familia_id, []).append(membro)
    lista = []
    for familia in sorted(familias, key=lambda item: _numero_familia(item.codigo)):
        pessoas = sorted(
            por_familia.get(familia.id, []),
            key=lambda item: (item.status != "Ativo", (item.nome_social or item.nome_completo or "").upper()),
        )
        lista.append({
            "id": familia.id,
            "codigo": familia.codigo,
            "membros": [
                {
                    "id": pessoa.id,
                    "nome": pessoa.nome_social or pessoa.nome_completo,
                    "status": pessoa.status,
                }
                for pessoa in pessoas
            ],
        })
    return {
        "proximo_codigo": _proximo_codigo([familia.codigo for familia in familias]),
        "familias": lista,
    }


@router.post("/familias/vincular")
async def vincular_familia(
    payload: VinculoFamiliar,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    convivente = await _convivente_pari(db, instituicao_id, payload.convivente_id)
    if payload.nova:
        codigos = (
            await db.execute(
                select(FamiliaConviventeDB.codigo).where(
                    FamiliaConviventeDB.instituicao_id == instituicao_id
                )
            )
        ).scalars().all()
        familia = FamiliaConviventeDB(
            instituicao_id=instituicao_id,
            codigo=_proximo_codigo(list(codigos)),
        )
        db.add(familia)
        await db.flush()
    elif payload.familia_id:
        familia = await db.get(FamiliaConviventeDB, payload.familia_id)
        if not familia or familia.instituicao_id != instituicao_id:
            raise HTTPException(status_code=404, detail="Família não encontrada neste projeto.")
    else:
        familia = None
    convivente.familia_id = familia.id if familia else None
    await db.commit()
    return {
        "familia_id": familia.id if familia else None,
        "codigo": familia.codigo if familia else "",
    }
