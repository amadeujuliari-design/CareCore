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

from config_operacional_projeto import projeto_e_casa_pari, projeto_e_reencontro_pari
from database import get_db
from kit_higiene_pari import (
    COMPLEMENTOS_CRUZEIRO,
    PERFIS_PADRAO,
    SEXOS_PERFIL,
    descricao_faixa,
    faixa_cruza,
    montar_kit,
    normalizar_sexo,
    papel_do_perfil,
)
from lavanderia_cruzeiro import (
    MAQUINA_LAVAR,
    MAQUINA_SECAR,
    PADRAO,
    PADRAO_PARI,
    PeriodosLavanderia,
    eh_slot_lavagem,
    periodos_do_json,
    proxima_secagem,
    slots_do_dia as slots_cruzeiro,
    validar_periodos,
)
from models import (
    ConviventeDB,
    FamiliaConviventeDB,
    InstituicaoDB,
    ItemHigieneDB,
    KitHigieneEntregaDB,
    KitHigieneItemFamiliaDB,
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
    idade_min_meses: int | None = Field(default=None, ge=0, le=1440)
    idade_max_meses: int | None = Field(default=None, ge=0, le=1440)


class NomeCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=80)
    descricao: str = ""
    papel: str = "base"
    gatilho: str = "idade"


class RegraCreate(BaseModel):
    item_id: str
    tipo_id: str
    quantidade: int = Field(ge=1, le=99)


class ItemFamiliaCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=80)
    quantidade: int = Field(ge=1, le=99)


class EntregaCreate(BaseModel):
    convivente_id: str


class MembroKitUpdate(BaseModel):
    data_nascimento: date | None = None
    sexo: str = ""
    menstrua: bool | None = None


class LeituraLavanderia(BaseModel):
    convivente_id: str
    maquina: str | None = None
    inicio: str | None = None


class PeriodosLavanderiaIn(BaseModel):
    manha_inicio: str
    manha_fim: str
    tarde_inicio: str
    tarde_fim: str


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
        raise HTTPException(status_code=404, detail="Recurso disponível apenas nos projetos do modelo Reencontro Pari.")
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
        "papel": papel_do_perfil({"papel": getattr(tipo, "papel", None)}),
        "gatilho": getattr(tipo, "gatilho", None) or "idade",
        "idade_min_meses": getattr(tipo, "idade_min_meses", None),
        "idade_max_meses": getattr(tipo, "idade_max_meses", None),
    }


def _pessoa_kit(membro: ConviventeDB) -> dict:
    return {
        "nome": membro.nome_social or membro.nome_completo,
        "nascimento": membro.data_nascimento,
        "sexo": membro.sexo or membro.identidade_genero,
        "menstrua": bool(getattr(membro, "kit_menstrua", False)),
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


async def _alinhar_complementos_cruzeiro(db: AsyncSession, instituicao_id: str) -> None:
    tipos = (
        await db.execute(
            select(TipoIndividuoHigieneDB).where(TipoIndividuoHigieneDB.instituicao_id == instituicao_id)
        )
    ).scalars().all()
    itens = (
        await db.execute(select(ItemHigieneDB).where(ItemHigieneDB.instituicao_id == instituicao_id))
    ).scalars().all()
    por_nome = {tipo.nome.casefold(): tipo for tipo in tipos}
    item_por_nome = {item.nome.casefold(): item for item in itens}
    for origem in ("menstruação", "absorvente íntimo?"):
        antigo = por_nome.get(origem)
        if antigo is None or "absorvente íntimo" in por_nome:
            continue
        antigo.nome = "Absorvente íntimo"
        por_nome["absorvente íntimo"] = antigo
        del por_nome[origem]
    for padrao in COMPLEMENTOS_CRUZEIRO:
        atual = por_nome.get(padrao["nome"].casefold())
        criado_agora = atual is None
        if atual is None:
            atual = TipoIndividuoHigieneDB(
                instituicao_id=instituicao_id,
                nome=padrao["nome"],
                descricao=padrao["descricao"],
                ordem=padrao["ordem"],
                ativo=True,
                idade_min=0,
                idade_max=None,
                sexo=padrao["sexo"],
                papel="complemento",
                gatilho=padrao["gatilho"],
                idade_min_meses=padrao["idade_min_meses"],
                idade_max_meses=padrao["idade_max_meses"],
            )
            db.add(atual)
            await db.flush()
            por_nome[padrao["nome"].casefold()] = atual
        elif (atual.papel or "base") != "complemento":
            atual.papel = "complemento"
            atual.gatilho = padrao["gatilho"]
            atual.sexo = padrao["sexo"]
            atual.descricao = padrao["descricao"]
            atual.idade_min_meses = padrao["idade_min_meses"]
            atual.idade_max_meses = padrao["idade_max_meses"]
            atual.ativo = True
        if padrao["gatilho"] == "flag" and "menstru" in (atual.descricao or "").casefold():
            atual.descricao = padrao["descricao"]
        item = item_por_nome.get(padrao["item"].casefold())
        if item is None:
            item = ItemHigieneDB(instituicao_id=instituicao_id, nome=padrao["item"], ativo=True)
            db.add(item)
            await db.flush()
            item_por_nome[padrao["item"].casefold()] = item
        if not criado_agora:
            continue
        regra = (
            await db.execute(
                select(KitHigieneRegraDB).where(
                    KitHigieneRegraDB.item_id == item.id,
                    KitHigieneRegraDB.tipo_id == atual.id,
                )
            )
        ).scalar_one_or_none()
        if regra is None:
            db.add(
                KitHigieneRegraDB(
                    instituicao_id=instituicao_id,
                    item_id=item.id,
                    tipo_id=atual.id,
                    quantidade=1,
                )
            )
    await db.commit()


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
    projeto = await db.get(InstituicaoDB, instituicao_id)
    await _alinhar_perfis(db, instituicao_id)
    if projeto_e_reencontro_pari(projeto):
        await _alinhar_complementos_cruzeiro(db, instituicao_id)
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
                "papel": papel_do_perfil(_perfil_dict(tipo)),
                "gatilho": getattr(tipo, "gatilho", None) or "idade",
                "idade_min_meses": getattr(tipo, "idade_min_meses", None),
                "idade_max_meses": getattr(tipo, "idade_max_meses", None),
            }
            for tipo in tipos
        ],
        "modelo": "cruzeiro" if projeto_e_reencontro_pari(projeto) else "pari",
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
        "itens_familia": [
            {"id": item.id, "nome": item.nome, "quantidade": item.quantidade}
            for item in await _listar_itens_familia(db, instituicao_id)
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
    projeto = await db.get(InstituicaoDB, instituicao_id)
    papel = (payload.papel or "base").strip().casefold()
    gatilho = (payload.gatilho or "idade").strip().casefold()
    if papel not in {"base", "complemento"} or gatilho not in {"idade", "flag"}:
        raise HTTPException(status_code=400, detail="Perfil inválido.")
    if papel == "complemento" and not projeto_e_reencontro_pari(projeto):
        raise HTTPException(status_code=400, detail="Complemento de kit existe nos projetos Reencontro.")
    db.add(
        TipoIndividuoHigieneDB(
            instituicao_id=instituicao_id,
            nome=payload.nome.strip(),
            descricao=(
                payload.descricao.strip()
                or ("Absorvente íntimo" if gatilho == "flag" else "Defina a faixa em meses")
            ),
            ordem=50 if papel == "complemento" else 40,
            ativo=True,
            idade_min=0 if papel == "complemento" else None,
            sexo="feminino" if papel == "complemento" and gatilho == "flag" else "qualquer",
            papel=papel,
            gatilho=gatilho if papel == "complemento" else "idade",
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


async def _listar_itens_familia(db: AsyncSession, instituicao_id: str) -> list[KitHigieneItemFamiliaDB]:
    return (
        await db.execute(
            select(KitHigieneItemFamiliaDB)
            .where(KitHigieneItemFamiliaDB.instituicao_id == instituicao_id)
            .order_by(KitHigieneItemFamiliaDB.nome)
        )
    ).scalars().all()


@router.post("/kit/familia")
async def criar_item_familia(
    payload: ItemFamiliaCreate,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    nome = payload.nome.strip()
    for atual in await _listar_itens_familia(db, instituicao_id):
        if atual.nome.casefold() == nome.casefold():
            atual.nome = nome
            atual.quantidade = payload.quantidade
            await db.commit()
            return {"status": "ok"}
    db.add(
        KitHigieneItemFamiliaDB(
            instituicao_id=instituicao_id,
            nome=nome,
            quantidade=payload.quantidade,
        )
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Já existe um item da família com esse nome.")
    return {"status": "ok"}


@router.delete("/kit/familia/{item_id}")
async def excluir_item_familia(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    item = await db.get(KitHigieneItemFamiliaDB, item_id)
    if not item or item.instituicao_id != instituicao_id:
        raise HTTPException(status_code=404, detail="Item da família não encontrado.")
    await db.delete(item)
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
    projeto = await db.get(InstituicaoDB, instituicao_id)
    familiares = await _listar_itens_familia(db, instituicao_id)
    previa = montar_kit(
        [_pessoa_kit(membro) for membro in membros],
        [_perfil_dict(tipo) for tipo in tipos],
        [
            {"tipo_id": regra.tipo_id, "item_id": regra.item_id, "quantidade": regra.quantidade}
            for regra in regras
        ],
        [{"id": item.id, "nome": item.nome, "ativo": bool(item.ativo)} for item in itens],
        hoje,
        somar_complementos=projeto_e_reencontro_pari(projeto),
        itens_familia=[{"nome": item.nome, "quantidade": item.quantidade} for item in familiares],
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
                "menstrua": bool(getattr(membro, "kit_menstrua", False)),
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
    if (
        payload.idade_max_meses is not None
        and payload.idade_min_meses is not None
        and payload.idade_max_meses < payload.idade_min_meses
    ):
        raise HTTPException(status_code=400, detail="A faixa em meses precisa terminar depois do início.")
    eh_complemento = papel_do_perfil(_perfil_dict(tipo)) == "complemento"
    if not eh_complemento:
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
            if papel_do_perfil(_perfil_dict(outro)) == "complemento":
                continue
            if faixa_cruza(proposta, _perfil_dict(outro)):
                raise HTTPException(status_code=400, detail=f"Essa faixa cruza com {outro.nome}.")
    tipo.idade_min = payload.idade_min
    tipo.idade_max = payload.idade_max
    tipo.sexo = sexo
    if eh_complemento and (tipo.gatilho or "idade") == "idade" and payload.idade_min_meses is not None:
        tipo.idade_min_meses = payload.idade_min_meses
        tipo.idade_max_meses = payload.idade_max_meses
        tipo.descricao = f"De {payload.idade_min_meses} a {payload.idade_max_meses if payload.idade_max_meses is not None else '…'} meses"
    elif not eh_complemento:
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
    if payload.menstrua is not None:
        convivente.kit_menstrua = bool(payload.menstrua)
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


def _periodos_do_projeto(projeto: InstituicaoDB | None) -> PeriodosLavanderia:
    padrao = PADRAO_PARI if projeto_e_casa_pari(projeto) else PADRAO
    return periodos_do_json(getattr(projeto, "lavanderia_grade_json", None), padrao)


def _rotulo_maquina(maquina: str) -> str:
    return {"lavar": "Lavagem", "secar": "Secagem"}.get(maquina, "Lavagem e secagem")


async def _migrar_conjunto_compativel(
    db: AsyncSession,
    instituicao_id: str,
    periodos: PeriodosLavanderia,
) -> None:
    """Uso antigo de 1h30 que cai num início da nova grade vira lavagem de 45 minutos e uma secagem."""
    agora = agora_operacional_naive()
    registros = (
        await db.execute(
            select(LavanderiaAgendaDB).where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.maquina == "conjunto",
                LavanderiaAgendaDB.status == "agendado",
                LavanderiaAgendaDB.inicio > agora,
                LavanderiaAgendaDB.fim > agora,
            )
        )
    ).scalars().all()
    compativeis = sorted(
        (registro for registro in registros if eh_slot_lavagem(registro.inicio, periodos)),
        key=lambda registro: registro.inicio,
    )
    if not compativeis:
        return
    for registro in compativeis:
        fim = next(
            fim_slot
            for marca, fim_slot in slots_cruzeiro(registro.inicio.date(), periodos)
            if marca == registro.inicio
        )
        registro.maquina = MAQUINA_LAVAR
        registro.fim = fim
        await db.flush()
        ocupados = set(
            (
                await db.execute(
                    select(LavanderiaAgendaDB.inicio).where(
                        LavanderiaAgendaDB.instituicao_id == instituicao_id,
                        LavanderiaAgendaDB.maquina == MAQUINA_SECAR,
                        LavanderiaAgendaDB.status.in_(("agendado", "em_uso")),
                        LavanderiaAgendaDB.inicio >= fim,
                    )
                )
            ).scalars().all()
        )
        seco = proxima_secagem(fim, ocupados, periodos=periodos)
        if seco:
            inicio_seco, fim_seco = seco
            await _gravar_reserva(
                db,
                instituicao_id,
                MAQUINA_SECAR,
                inicio_seco,
                fim_seco,
                registro.convivente_id,
            )
    await db.commit()


async def _conflitos_da_grade(db: AsyncSession, instituicao_id: str, periodos: PeriodosLavanderia) -> list[dict]:
    agora = agora_operacional_naive()
    pendentes = (
        await db.execute(
            select(LavanderiaAgendaDB, ConviventeDB.nome_social, ConviventeDB.nome_completo)
            .join(ConviventeDB, ConviventeDB.id == LavanderiaAgendaDB.convivente_id)
            .where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.status.in_(("agendado", "em_uso")),
                LavanderiaAgendaDB.fim > agora,
            )
            .order_by(LavanderiaAgendaDB.inicio)
        )
    ).all()
    conflitos = []
    for registro, nome_social, nome_completo in pendentes:
        if registro.maquina != "conjunto" and eh_slot_lavagem(registro.inicio, periodos):
            continue
        conflitos.append({
            "nome": nome_social or nome_completo,
            "maquina": _rotulo_maquina(registro.maquina),
            "inicio": _iso(registro.inicio),
            "fim": _iso(registro.fim),
        })
    return conflitos


@router.get("/lavanderia")
async def listar_agenda(
    data: str | None = None,
    dias: int = Query(7, ge=1, le=14),
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    projeto = await db.get(InstituicaoDB, instituicao_id)
    periodos = _periodos_do_projeto(projeto)
    await _migrar_conjunto_compativel(db, instituicao_id, periodos)
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
    conjuntos = (
        await db.execute(
            select(LavanderiaAgendaDB, ConviventeDB.nome_completo, FamiliaConviventeDB.codigo)
            .join(ConviventeDB, ConviventeDB.id == LavanderiaAgendaDB.convivente_id)
            .outerjoin(FamiliaConviventeDB, FamiliaConviventeDB.id == ConviventeDB.familia_id)
            .where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.maquina == "conjunto",
                LavanderiaAgendaDB.status.in_(("agendado", "em_uso")),
                LavanderiaAgendaDB.fim > agora,
            )
        )
    ).all()
    agenda = []
    for deslocamento in range(dias):
        dia_slot = dia + timedelta(days=deslocamento)
        for maquina in (MAQUINA_LAVAR, MAQUINA_SECAR):
            for inicio, fim in slots_cruzeiro(dia_slot, periodos):
                chave = (maquina, inicio)
                if chave in ocupados:
                    agenda.append(ocupados[chave])
                    continue
                cobre = next(
                    (
                        (registro, nome, codigo)
                        for registro, nome, codigo in conjuntos
                        if registro.inicio < fim and inicio < registro.fim
                    ),
                    None,
                )
                if cobre:
                    registro, nome, codigo = cobre
                    agenda.append({
                        "id": registro.id,
                        "maquina": maquina,
                        "inicio": _iso(inicio),
                        "fim": _iso(fim),
                        "status": registro.status,
                        "convivente_id": registro.convivente_id,
                        "convivente_nome": nome,
                        "familia_codigo": codigo or "",
                    })
                    continue
                agenda.append({
                    "maquina": maquina,
                    "inicio": _iso(inicio),
                    "fim": _iso(fim),
                    "status": "livre",
                    "convivente_id": "",
                    "convivente_nome": "",
                    "familia_codigo": "",
                })
    conflitos = await _conflitos_da_grade(db, instituicao_id, periodos)
    return {
        "data": dia.isoformat(),
        "dias": dias,
        "modelo": "separado",
        "periodos": periodos.como_dict(),
        "agenda": agenda,
        "fora_da_grade": {
            "mensagem": "Há agendamentos que ficaram fora da grade de 45 minutos. Conclua esses usos, ou cancele e mude o horário.",
            "conflitos": conflitos[:20],
            "restantes": max(len(conflitos) - 20, 0),
        } if conflitos else None,
    }


@router.put("/lavanderia/periodos")
async def salvar_periodos_lavanderia(
    payload: PeriodosLavanderiaIn,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    projeto = await db.get(InstituicaoDB, instituicao_id)
    try:
        periodos = validar_periodos(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await _migrar_conjunto_compativel(db, instituicao_id, periodos)
    conflitos = await _conflitos_da_grade(db, instituicao_id, periodos)
    if conflitos:
        raise HTTPException(
            status_code=409,
            detail={
                "mensagem": "Há agendamentos que ficariam fora da nova grade. Conclua esses usos, ou cancele e mude o horário, antes de salvar.",
                "conflitos": conflitos[:20],
                "restantes": max(len(conflitos) - 20, 0),
            },
        )
    projeto.lavanderia_grade_json = json.dumps(periodos.como_dict(), ensure_ascii=False)
    await db.commit()
    return periodos.como_dict()


@router.get("/lavanderia/registros")
async def listar_registros_lavanderia(
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    maquinas = (MAQUINA_LAVAR, MAQUINA_SECAR, "conjunto")
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
                LavanderiaAgendaDB.maquina.in_(maquinas),
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
            "maquina_rotulo": {"lavar": "Lavar", "secar": "Secar", "conjunto": "Lavagem e secagem"}.get(registro.maquina, ""),
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
    if registro.maquina in (MAQUINA_LAVAR, MAQUINA_SECAR):
        par = await _par_lavanderia_cruzeiro(db, registro)
        if par:
            par.status = "cancelado"
    await db.commit()
    return {"status": "ok", "mensagem": "Horário cancelado. A vaga voltou a ficar livre."}


async def _par_lavanderia_cruzeiro(db: AsyncSession, registro: LavanderiaAgendaDB):
    outros = (
        await db.execute(
            select(LavanderiaAgendaDB).where(
                LavanderiaAgendaDB.instituicao_id == registro.instituicao_id,
                LavanderiaAgendaDB.convivente_id == registro.convivente_id,
                LavanderiaAgendaDB.status == "agendado",
                LavanderiaAgendaDB.id != registro.id,
            )
        )
    ).scalars().all()
    if registro.maquina == MAQUINA_LAVAR:
        candidatos = [item for item in outros if item.maquina == MAQUINA_SECAR and item.inicio >= registro.fim]
        return min(candidatos, key=lambda item: item.inicio, default=None)
    if registro.maquina == MAQUINA_SECAR:
        candidatos = [item for item in outros if item.maquina == MAQUINA_LAVAR and item.fim <= registro.inicio]
        return max(candidatos, key=lambda item: item.fim, default=None)
    return None


async def _ler_lavanderia_cruzeiro(db: AsyncSession, instituicao_id: str, payload: LeituraLavanderia):
    periodos = _periodos_do_projeto(await db.get(InstituicaoDB, instituicao_id))
    convivente = await _convivente_pari(db, instituicao_id, payload.convivente_id)
    if convivente.status != "Ativo":
        raise HTTPException(status_code=400, detail="Somente convivente ativo usa a lavanderia.")
    agora = agora_operacional_naive()
    inicio_pedido = _parse_inicio_agenda(payload.inicio) if payload.inicio else None
    if inicio_pedido and inicio_pedido < agora - timedelta(minutes=2):
        raise HTTPException(status_code=400, detail="Esse horário já passou.")
    if inicio_pedido and not eh_slot_lavagem(inicio_pedido, periodos):
        raise HTTPException(status_code=400, detail="Escolha um horário da grade de lavagem.")
    vigentes = (
        await db.execute(
            select(LavanderiaAgendaDB).where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.convivente_id == convivente.id,
                LavanderiaAgendaDB.maquina.in_((MAQUINA_LAVAR, MAQUINA_SECAR)),
                LavanderiaAgendaDB.status == "agendado",
                LavanderiaAgendaDB.fim > agora,
            )
        )
    ).scalars().all()
    em_curso = [item for item in vigentes if item.inicio <= agora]
    if em_curso and (inicio_pedido is None or any(item.inicio == inicio_pedido for item in em_curso)):
        alvo = next(item for item in em_curso if inicio_pedido is None or item.inicio == inicio_pedido)
        alvo.status = "em_uso"
        alvo.liberado_em = agora
        await db.commit()
        etapa = "Lavagem" if alvo.maquina == MAQUINA_LAVAR else "Secagem"
        return {
            "acao": "liberado",
            "mensagem": f"{etapa} liberada até {_iso(alvo.fim)[-5:]}.",
            "inicio": _iso(alvo.inicio),
            "fim": _iso(alvo.fim),
            "maquina": alvo.maquina,
        }
    lavagem = next((item for item in vigentes if item.maquina == MAQUINA_LAVAR), None)
    if lavagem and (inicio_pedido is None or inicio_pedido == lavagem.inicio):
        secagem = next((item for item in vigentes if item.maquina == MAQUINA_SECAR), None)
        texto_seco = f" Secagem às {_iso(secagem.inicio)[-5:]}." if secagem else ""
        return {
            "acao": "agendado",
            "mensagem": f"Lavagem já marcada às {_iso(lavagem.inicio)[-5:]}.{texto_seco}",
            "inicio": _iso(lavagem.inicio),
            "fim": _iso(lavagem.fim),
            "maquina": MAQUINA_LAVAR,
        }
    for item in list(vigentes):
        await db.delete(item)
    if vigentes:
        await db.flush()
    expirados = (
        await db.execute(
            select(LavanderiaAgendaDB).where(
                LavanderiaAgendaDB.instituicao_id == instituicao_id,
                LavanderiaAgendaDB.convivente_id == convivente.id,
                LavanderiaAgendaDB.status == "agendado",
                LavanderiaAgendaDB.fim <= agora,
            )
        )
    ).scalars().all()
    for expirado in expirados:
        expirado.status = "perdido"
    if inicio_pedido:
        inicio = inicio_pedido
        fim = next(fim_slot for marca, fim_slot in slots_cruzeiro(inicio.date(), periodos) if marca == inicio)
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
                            LavanderiaAgendaDB.maquina == MAQUINA_LAVAR,
                            LavanderiaAgendaDB.status.in_(("agendado", "em_uso")),
                            LavanderiaAgendaDB.inicio >= datetime.combine(dia, time.min),
                            LavanderiaAgendaDB.inicio < datetime.combine(dia, time.min) + timedelta(days=1),
                        )
                    )
                ).scalars().all()
            )
            for marca, fim_slot in slots_cruzeiro(dia, periodos):
                if marca < limite or marca in ocupados:
                    continue
                escolhido = (marca, fim_slot)
                break
            if escolhido:
                break
        if not escolhido:
            raise HTTPException(status_code=400, detail="Não há lavagem livre nas próximas duas semanas.")
        inicio, fim = escolhido
    ocupados_secar = set(
        (
            await db.execute(
                select(LavanderiaAgendaDB.inicio).where(
                    LavanderiaAgendaDB.instituicao_id == instituicao_id,
                    LavanderiaAgendaDB.maquina == MAQUINA_SECAR,
                    LavanderiaAgendaDB.status.in_(("agendado", "em_uso")),
                    LavanderiaAgendaDB.inicio >= fim,
                )
            )
        ).scalars().all()
    )
    seco = proxima_secagem(fim, ocupados_secar, periodos=periodos)
    if not seco:
        raise HTTPException(status_code=400, detail="Não há secagem livre nas próximas duas semanas.")
    inicio_seco, fim_seco = seco
    await _gravar_reserva(db, instituicao_id, MAQUINA_LAVAR, inicio, fim, convivente.id)
    await _gravar_reserva(db, instituicao_id, MAQUINA_SECAR, inicio_seco, fim_seco, convivente.id)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Esse horário acabou de ser reservado. Leia de novo.")
    return {
        "acao": "agendado",
        "mensagem": f"Lavagem às {_iso(inicio)[-5:]} e secagem às {_iso(inicio_seco)[-5:]}.",
        "inicio": _iso(inicio),
        "fim": _iso(fim_seco),
        "maquina": MAQUINA_LAVAR,
    }


@router.post("/lavanderia/leitura")
async def ler_lavanderia(
    payload: LeituraLavanderia,
    db: AsyncSession = Depends(get_db),
    usuario_atual: dict = Depends(get_usuario_logado),
):
    instituicao_id = await _exigir_pari(db, usuario_atual)
    return await _ler_lavanderia_cruzeiro(db, instituicao_id, payload)


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
