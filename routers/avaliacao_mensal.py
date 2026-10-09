"""Avaliação mensal pública das Vilas Reencontro e o relatório da equipe."""

from __future__ import annotations

import json
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from avaliacao_mensal import (
    VILAS,
    competencia_de,
    mensagem_agradecimento,
    mensagem_ja_respondida,
    normalizar_sugestoes,
    perguntas_da_vila,
    rotulo_competencia,
    validar_respostas,
    vila_por_codigo,
)
from config_operacional_projeto import _normalizar_texto_busca, projeto_e_reencontro_pari
from database import get_db
from models import AvaliacaoMensalDB, ConviventeDB, InstituicaoDB
from security import (
    PERFIL_ADMINISTRATIVO,
    PERFIL_GESTOR,
    PERFIL_GLOBAL,
    PERFIL_ORIENTADOR,
    PERFIL_TECNICO,
    get_usuario_logado,
    usuario_tem_perfil,
)
from time_operacional import agora_operacional_naive

router = APIRouter(prefix="/api/avaliacao-mensal", tags=["Avaliação mensal"])

_RE_COMPETENCIA = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
_PERFIS_RELATORIO = {
    PERFIL_GESTOR,
    PERFIL_TECNICO,
    PERFIL_ORIENTADOR,
    PERFIL_ADMINISTRATIVO,
    PERFIL_GLOBAL,
}


class IdentificarIn(BaseModel):
    projeto: str
    numero_prontuario: str | int


class ResponderIn(BaseModel):
    projeto: str
    numero_prontuario: str | int
    respostas: dict = Field(default_factory=dict)
    sugestoes: str | None = None


def _numero_prontuario(valor) -> int:
    if isinstance(valor, bool):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Informe o número de prontuário.",
        )
    texto = str(valor if valor is not None else "").strip()
    if not texto.isdigit():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Informe o número de prontuário.",
        )
    numero = int(texto)
    if numero < 1 or numero > 999999:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Informe o número de prontuário.",
        )
    return numero


def _vila_ou_erro(codigo: str) -> dict:
    vila = vila_por_codigo(codigo)
    if not vila:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Escolha a vila antes de continuar.",
        )
    return vila


def _primeiro_nome(convivente: ConviventeDB) -> str:
    base = (convivente.nome_social or convivente.nome_completo or "").strip()
    if not base:
        return ""
    return base.split()[0]


def _nome_equipe(convivente: ConviventeDB | None, numero: int) -> str:
    if not convivente:
        return f"Prontuário {numero}"
    social = (convivente.nome_social or "").strip()
    if social:
        return social
    return (convivente.nome_completo or "").strip() or f"Prontuário {numero}"


async def _projeto_da_vila(db: AsyncSession, vila: dict) -> InstituicaoDB:
    resultado = await db.execute(
        select(InstituicaoDB).where(InstituicaoDB.is_active.is_(True))
    )
    marcador = vila["marcador"]
    achados = []
    for projeto in resultado.scalars().all():
        texto = _normalizar_texto_busca(
            " ".join(
                parte
                for parte in (projeto.nome_fantasia, projeto.relatorio_nome_exibicao)
                if parte
            )
        )
        if marcador in texto:
            achados.append(projeto)
    if not achados:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Esta vila ainda não está cadastrada. Procure a equipe.",
        )
    if len(achados) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Há mais de um projeto com esse nome. Procure a equipe.",
        )
    return achados[0]


async def _convivente_ativo(
    db: AsyncSession,
    instituicao_id: str,
    numero: int,
) -> ConviventeDB:
    resultado = await db.execute(
        select(ConviventeDB).where(
            ConviventeDB.instituicao_id == instituicao_id,
            ConviventeDB.numero_institucional == numero,
            func.lower(ConviventeDB.status) == "ativo",
        )
    )
    encontrados = resultado.scalars().all()
    if not encontrados:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                "Não encontramos esse número de prontuário nesta vila. "
                "Confira o número e tente de novo."
            ),
        )
    if len(encontrados) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Não foi possível identificar esse prontuário. Procure a equipe.",
        )
    return encontrados[0]


async def _resposta_do_mes(
    db: AsyncSession,
    convivente_id: str,
    competencia: str,
) -> AvaliacaoMensalDB | None:
    resultado = await db.execute(
        select(AvaliacaoMensalDB).where(
            AvaliacaoMensalDB.convivente_id == convivente_id,
            AvaliacaoMensalDB.competencia == competencia,
        )
    )
    return resultado.scalar_one_or_none()


def _competencia_atual() -> str:
    return competencia_de(agora_operacional_naive())


@router.post("/identificar")
async def identificar(
    corpo: IdentificarIn,
    db: AsyncSession = Depends(get_db),
):
    vila = _vila_ou_erro(corpo.projeto)
    numero = _numero_prontuario(corpo.numero_prontuario)
    projeto = await _projeto_da_vila(db, vila)
    convivente = await _convivente_ativo(db, projeto.id, numero)
    competencia = _competencia_atual()
    if await _resposta_do_mes(db, convivente.id, competencia):
        return {
            "situacao": "respondido",
            "mensagem": mensagem_ja_respondida(competencia),
            "competencia": competencia,
        }
    return {
        "situacao": "liberado",
        "primeiro_nome": _primeiro_nome(convivente),
        "projeto": vila["rotulo"],
        "competencia": competencia,
        "rotulo_competencia": rotulo_competencia(competencia),
        "perguntas": perguntas_da_vila(vila["rotulo"]),
    }


@router.post("/responder")
async def responder(
    corpo: ResponderIn,
    db: AsyncSession = Depends(get_db),
):
    vila = _vila_ou_erro(corpo.projeto)
    numero = _numero_prontuario(corpo.numero_prontuario)
    erro_respostas = validar_respostas(corpo.respostas)
    if erro_respostas:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=erro_respostas,
        )
    projeto = await _projeto_da_vila(db, vila)
    convivente = await _convivente_ativo(db, projeto.id, numero)
    competencia = _competencia_atual()
    if await _resposta_do_mes(db, convivente.id, competencia):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=mensagem_ja_respondida(competencia),
        )

    registro = AvaliacaoMensalDB(
        organizacao_id=projeto.organizacao_id,
        instituicao_id=projeto.id,
        convivente_id=convivente.id,
        numero_prontuario=numero,
        competencia=competencia,
        respostas_json=json.dumps(corpo.respostas, ensure_ascii=False),
        sugestoes=normalizar_sugestoes(corpo.sugestoes) or None,
        respondido_em=agora_operacional_naive(),
    )
    db.add(registro)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=mensagem_ja_respondida(competencia),
        ) from None
    return {
        "situacao": "gravado",
        "mensagem": mensagem_agradecimento(vila["rotulo"]),
    }


def _exigir_relatorio(usuario: dict) -> None:
    if usuario.get("is_manutencao"):
        return
    if usuario_tem_perfil(usuario, _PERFIS_RELATORIO):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Você não tem permissão para este relatório.",
    )


def _rotulo_vila_projeto(projeto: InstituicaoDB) -> str:
    texto = _normalizar_texto_busca(
        " ".join(
            parte
            for parte in (projeto.nome_fantasia, projeto.relatorio_nome_exibicao)
            if parte
        )
    )
    for vila in VILAS:
        if vila["marcador"] in texto:
            return vila["rotulo"]
    return (projeto.nome_fantasia or "vila").strip()


def _rotulo_opcao(pergunta: dict, opcao_id: str) -> str:
    for opcao in pergunta["opcoes"]:
        if opcao["id"] == opcao_id:
            return opcao["rotulo"]
    return opcao_id


@router.get("/relatorio")
async def relatorio(
    competencia: str | None = Query(default=None),
    usuario: dict = Depends(get_usuario_logado),
    db: AsyncSession = Depends(get_db),
):
    _exigir_relatorio(usuario)
    instituicao_id = usuario.get("instituicao_id")
    if not instituicao_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Abra o projeto da vila para ver as respostas.",
        )
    resultado_projeto = await db.execute(
        select(InstituicaoDB).where(InstituicaoDB.id == instituicao_id)
    )
    projeto = resultado_projeto.scalar_one_or_none()
    if not projeto_e_reencontro_pari(projeto):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="A avaliação mensal é das Vilas Reencontro.",
        )

    mes = (competencia or _competencia_atual()).strip()
    if not _RE_COMPETENCIA.match(mes):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Informe o mês no formato AAAA-MM.",
        )

    resultado = await db.execute(
        select(AvaliacaoMensalDB, ConviventeDB)
        .outerjoin(ConviventeDB, ConviventeDB.id == AvaliacaoMensalDB.convivente_id)
        .where(
            AvaliacaoMensalDB.instituicao_id == instituicao_id,
            AvaliacaoMensalDB.competencia == mes,
        )
        .order_by(AvaliacaoMensalDB.numero_prontuario, AvaliacaoMensalDB.respondido_em)
    )
    linhas = resultado.all()
    perguntas = perguntas_da_vila(_rotulo_vila_projeto(projeto))
    contagem = {
        pergunta["id"]: {opcao["id"]: 0 for opcao in pergunta["opcoes"]}
        for pergunta in perguntas
    }
    pessoas = []
    for registro, convivente in linhas:
        try:
            respostas = json.loads(registro.respostas_json or "{}")
        except json.JSONDecodeError:
            respostas = {}
        if not isinstance(respostas, dict):
            respostas = {}
        for pergunta in perguntas:
            opcao_id = str(respostas.get(pergunta["id"]) or "")
            if opcao_id in contagem[pergunta["id"]]:
                contagem[pergunta["id"]][opcao_id] += 1
        momento = registro.respondido_em
        pessoas.append(
            {
                "numero_prontuario": registro.numero_prontuario,
                "nome": _nome_equipe(convivente, registro.numero_prontuario),
                "respondido_em": momento.strftime("%d/%m/%Y %H:%M") if momento else "",
                "sugestoes": registro.sugestoes or "",
                "respostas": [
                    {
                        "pergunta": pergunta["texto"],
                        "resposta": _rotulo_opcao(
                            pergunta,
                            str(respostas.get(pergunta["id"]) or ""),
                        ),
                    }
                    for pergunta in perguntas
                ],
            }
        )

    return {
        "competencia": mes,
        "rotulo_competencia": rotulo_competencia(mes),
        "projeto": projeto.nome_fantasia,
        "total": len(pessoas),
        "perguntas": [
            {
                "id": pergunta["id"],
                "texto": pergunta["texto"],
                "opcoes": [
                    {
                        "id": opcao["id"],
                        "rotulo": opcao["rotulo"],
                        "total": contagem[pergunta["id"]][opcao["id"]],
                    }
                    for opcao in pergunta["opcoes"]
                ],
            }
            for pergunta in perguntas
        ],
        "pessoas": pessoas,
    }
