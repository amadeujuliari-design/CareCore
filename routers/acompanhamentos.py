from datetime import date, datetime
from calendar import monthrange
from typing import Any, Callable, Optional, Type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Date, cast, func, or_, String
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from convivente_datas_cadastro import (
    aplicar_datas_convivente_objeto,
    registrar_historico_inativacao,
    STATUS_INATIVOS,
    STATUS_OPERACIONAIS,
)
from models import (
    AcompanhamentoDiscussaoHospitalarDB,
    AcompanhamentoPotDB,
    AcompanhamentoSuspensaoProvisoriaDB,
    AcompanhamentoTbDB,
    AcompanhamentoTransferenciaDB,
    ConviventeDB,
    LeitoDB,
    OcorrenciaConviventeDB,
    RegistroPIADB,
    UsuarioDB,
)
from routers.conviventes_helpers import agora_sao_paulo
from hospitais_sao_paulo_sus import HOSPITAIS_SAOPAULO_SUS
from tipos_acao_acompanhamento import (
    DESTINOS_TRANSFERENCIA,
    DESTINOS_TRANSFERENCIA_VALIDOS,
    LINHAS_RELATORIO_MENSAL_ACOES,
    TIPOS_ACAO_ACOMPANHAMENTO,
    normalizar_destino_para_linha_relatorio,
)
from pia_acompanhamento_sync import (
    reconciliar_espelhos_pia_convivente,
    sincronizar_discussao_hospitalar_pia,
    sincronizar_pot_pia,
    sincronizar_tuberculose_pia,
)
from schemas import (
    AcompanhamentoDiscussaoHospitalarCreate,
    AcompanhamentoDiscussaoHospitalarResponse,
    AcompanhamentoDiscussaoHospitalarUpdate,
    AcompanhamentoDiscussaoEvolucaoCreate,
    AcompanhamentoDiscussaoEvolucaoUpdate,
    STATUS_EVOLUCAO_DISCUSSAO_HOSPITALAR,
    AcompanhamentoPotCreate,
    AcompanhamentoPotResponse,
    AcompanhamentoPotUpdate,
    AcompanhamentoPotEvolucaoCreate,
    AcompanhamentoPotEvolucaoUpdate,
    STATUS_EVOLUCAO_POT,
    AcompanhamentoSuspensaoProvisoriaCreate,
    AcompanhamentoSuspensaoProvisoriaResponse,
    AcompanhamentoSuspensaoProvisoriaUpdate,
    AcompanhamentoTbCreate,
    AcompanhamentoTbResponse,
    AcompanhamentoTbUpdate,
    AcompanhamentoTransferenciaCreate,
    AcompanhamentoTransferenciaResponse,
    AcompanhamentoTransferenciaUpdate,
    AcompanhamentosListaResponse,
    AcompanhamentoResumoMensalResponse,
    AcompanhamentoResumoMensalLinha,
    SITUACOES_TB,
)
from security import (
    PERFIL_GESTOR,
    PERFIL_GLOBAL,
    PERFIL_TECNICO,
    bloquear_usuario_global_puro,
    get_usuario_logado,
    usuario_eh_manutencao,
    usuario_tem_perfil,
)
from tenant_scope import obter_instituicao_escopo


router = APIRouter(prefix="/api/acompanhamentos", tags=["Acompanhamentos Técnicos"])

REGISTROS_POR_PAGINA_PADRAO = 30
REGISTROS_POR_PAGINA_PRONTUARIO_ACOMP = 10

SECOES_ACOMPANHAMENTO_CONVIVENTE = {
    "transferencias",
    "discussoes_hospitalares",
    "tuberculose",
    "pot",
    "suspensoes_provisorias",
}

PERFIS_ACOMPANHAMENTOS = {
    PERFIL_GESTOR,
    PERFIL_TECNICO,
    PERFIL_GLOBAL,
}

STATUS_CONVIVENTE_ATIVO = {"Ativo"}
STATUS_CONVIVENTE_ACOES = {"Ativo", "Ausência justificada"}
STATUS_CONVIVENTE_DISCUSSAO = {"Ativo", "Em acolhimento"}

MESES_RELATORIO_PT = (
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
)


def usuario_pode_acompanhamentos(usuario: dict) -> bool:
    return usuario_eh_manutencao(usuario) or usuario_tem_perfil(usuario, PERFIS_ACOMPANHAMENTOS)


def exigir_acesso_acompanhamentos(usuario: dict = Depends(get_usuario_logado)) -> dict:
    if not usuario_pode_acompanhamentos(usuario):
        raise HTTPException(status_code=403, detail="Sem permissão para acessar acompanhamentos técnicos.")
    return usuario


def exigir_edicao_acompanhamentos(usuario: dict = Depends(exigir_acesso_acompanhamentos)) -> dict:
    bloquear_usuario_global_puro(usuario)
    return usuario


def _parse_data_filtro(valor: Optional[str]) -> Optional[date]:
    if not valor:
        return None
    try:
        return date.fromisoformat(valor.strip())
    except ValueError:
        raise HTTPException(status_code=400, detail="Data inválida. Use o formato AAAA-MM-DD.")


def _nome_convivente(convivente: ConviventeDB | None) -> str | None:
    if not convivente:
        return None
    return convivente.nome_social or convivente.nome_completo


def _prontuario_convivente(convivente: ConviventeDB | None) -> str | None:
    if not convivente or convivente.numero_institucional is None:
        return None
    return str(convivente.numero_institucional)


def _destino_exibicao(destino: str, destino_outro: str | None) -> str:
    if destino == "Outros" and destino_outro:
        return f"Outros — {destino_outro}"
    return destino


def _hospital_exibicao(nome_hospital: str | None, hospital_outro: str | None) -> str | None:
    if not nome_hospital:
        return None
    if nome_hospital == "Outros" and hospital_outro:
        return f"Outros — {hospital_outro}"
    return nome_hospital


async def _liberar_leito_convivente(db: AsyncSession, leito_id: str | None) -> None:
    if not leito_id:
        return
    leito = (
        await db.execute(select(LeitoDB).where(LeitoDB.id == leito_id))
    ).scalar_one_or_none()
    if leito:
        leito.status = "Livre"


async def _registrar_ocorrencia_status(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente: ConviventeDB,
    status_antigo: str,
    status_novo: str,
    descricao: str,
    usuario_id: str,
) -> None:
    db.add(
        OcorrenciaConviventeDB(
            instituicao_id=instituicao_id,
            convivente_id=convivente.id,
            usuario_criador_id=usuario_id,
            tecnico_responsavel_id=convivente.tecnico_id,
            tipo_ocorrencia="Mudança de Status Institucional",
            motivo=f"Alterado de {status_antigo} para {status_novo}",
            descricao=descricao,
            requer_acao_tecnica=False,
            status_resolucao="Resolvido",
            parecer_tecnico="Registro formal via Acompanhamentos Técnicos.",
        )
    )


async def _aplicar_status_convivente(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente: ConviventeDB,
    status_novo: str,
    descricao: str,
    usuario_id: str,
) -> None:
    status_antigo = convivente.status
    if status_antigo == status_novo:
        return

    leito_id_antigo = convivente.leito_id
    data_inativacao_antes = convivente.data_inativacao
    convivente.status = status_novo
    aplicar_datas_convivente_objeto(convivente, status_antigo, status_novo, agora_sao_paulo().date())

    if status_novo == "Ativo":
        convivente.inativado_em = None
        convivente.ausencia_justificada_desde = None
    elif status_novo in {"Em acolhimento"}:
        convivente.inativado_em = None
        convivente.ausencia_justificada_desde = None
    elif status_novo == "Ausência justificada":
        convivente.inativado_em = None
        if status_antigo != "Ausência justificada" or not convivente.ausencia_justificada_desde:
            convivente.ausencia_justificada_desde = agora_sao_paulo().date()
    elif status_novo in {"Inativado", "Bloqueado", "Saída qualificada"}:
        convivente.leito_id = None
        if status_novo == "Inativado":
            convivente.inativado_em = agora_sao_paulo()
        convivente.ausencia_justificada_desde = None
        await _liberar_leito_convivente(db, leito_id_antigo)

    if status_novo in STATUS_INATIVOS and convivente.data_inativacao:
        await registrar_historico_inativacao(
            db,
            instituicao_id=instituicao_id,
            convivente_id=convivente.id,
            usuario_id=usuario_id,
            data_inativacao=convivente.data_inativacao,
            descricao=f"Inativação registrada na mudança de status de {status_antigo} para {status_novo}.",
        )
    elif (
        status_antigo in STATUS_INATIVOS
        and status_novo in STATUS_OPERACIONAIS
        and data_inativacao_antes
    ):
        await registrar_historico_inativacao(
            db,
            instituicao_id=instituicao_id,
            convivente_id=convivente.id,
            usuario_id=usuario_id,
            data_inativacao=data_inativacao_antes,
            descricao=f"Data de inativação arquivada na reativação de {status_antigo} para {status_novo}.",
        )

    await _registrar_ocorrencia_status(
        db,
        instituicao_id=instituicao_id,
        convivente=convivente,
        status_antigo=status_antigo,
        status_novo=status_novo,
        descricao=descricao,
        usuario_id=usuario_id,
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


async def _mapear_conviventes(db: AsyncSession, ids: set[str]) -> dict[str, ConviventeDB]:
    ids_limpos = {item for item in ids if item}
    if not ids_limpos:
        return {}

    conviventes = (
        await db.execute(select(ConviventeDB).where(ConviventeDB.id.in_(ids_limpos)))
    ).scalars().all()
    return {convivente.id: convivente for convivente in conviventes}


async def _obter_convivente_instituicao(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
    *,
    status_permitidos: set[str] | None = None,
) -> ConviventeDB:
    convivente = (
        await db.execute(
            select(ConviventeDB).where(
                ConviventeDB.id == convivente_id,
                ConviventeDB.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()

    if not convivente:
        raise HTTPException(status_code=404, detail="Convivente não encontrado no projeto atual.")

    if status_permitidos and convivente.status not in status_permitidos:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Convivente com status '{convivente.status}' não pode ser selecionado neste módulo. "
                f"Status permitidos: {', '.join(sorted(status_permitidos))}."
            ),
        )

    return convivente


def _aplicar_busca_convivente(query, busca: str, convivente_ids: list[str] | None = None):
    if convivente_ids is not None:
        if not convivente_ids:
            return query.where(False)
        return query.where(ConviventeDB.id.in_(convivente_ids))

    termo = f"%{busca.strip().lower()}%"
    termo_numerico = "".join(caractere for caractere in busca if caractere.isdigit())
    condicoes = [
        func.lower(ConviventeDB.nome_completo).like(termo),
        func.lower(func.coalesce(ConviventeDB.nome_social, "")).like(termo),
    ]

    if termo_numerico:
        padrao_numerico = f"%{termo_numerico}%"
        condicoes.append(cast(ConviventeDB.numero_institucional, String).like(padrao_numerico))
        condicoes.append(func.replace(func.coalesce(ConviventeDB.cpf, ""), ".", "").like(padrao_numerico))
        condicoes.append(func.replace(func.replace(func.coalesce(ConviventeDB.cpf, ""), ".", ""), "-", "").like(padrao_numerico))
    else:
        condicoes.append(cast(ConviventeDB.numero_institucional, String).like(termo))

    return query.where(or_(*condicoes))


async def _listar_registros(
    db: AsyncSession,
    instituicao_id: str,
    model: Type,
    data_coluna,
    mapper: Callable[[Any, dict[str, ConviventeDB], dict[str, str]], dict],
    *,
    busca: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    destino: Optional[str] = None,
    situacao: Optional[str] = None,
    mes_referencia: Optional[str] = None,
    offset: int = 0,
    limite: int = REGISTROS_POR_PAGINA_PADRAO,
    extras: Optional[dict] = None,
) -> AcompanhamentosListaResponse:
    query = (
        select(model, ConviventeDB)
        .join(ConviventeDB, ConviventeDB.id == model.convivente_id)
        .where(model.instituicao_id == instituicao_id)
        .order_by(model.criado_em.desc())
    )

    if busca:
        query = _aplicar_busca_convivente(query, busca)

    if data_inicio and data_coluna is not None:
        query = query.where(data_coluna >= data_inicio)
    if data_fim and data_coluna is not None:
        query = query.where(data_coluna <= data_fim)

    if destino and hasattr(model, "destino"):
        query = query.where(model.destino == destino)
    if situacao and hasattr(model, "situacao"):
        query = query.where(model.situacao == situacao)
    if mes_referencia and hasattr(model, "mes_referencia"):
        query = query.where(model.mes_referencia == mes_referencia)

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()

    rows = (
        await db.execute(query.offset(offset).limit(limite))
    ).all()

    usuario_ids = {registro.registrado_por_id for registro, _ in rows}
    usuarios_map = await _mapear_usuarios(db, usuario_ids)

    items = [
        mapper(registro, {convivente.id: convivente}, usuarios_map)
        for registro, convivente in rows
    ]

    payload = {
        "items": items,
        "total": total,
        "limit": limite,
        "offset": offset,
        "has_more": offset + len(items) < total,
    }
    if extras:
        payload.update(extras)
    return AcompanhamentosListaResponse(**payload)


def _map_transferencia(registro, conv_map, usuarios_map):
    convivente = conv_map.get(registro.convivente_id)
    return AcompanhamentoTransferenciaResponse(
        id=registro.id,
        convivente_id=registro.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        prontuario=_prontuario_convivente(convivente),
        destino=registro.destino,
        destino_outro=registro.destino_outro,
        destino_exibicao=_destino_exibicao(registro.destino, registro.destino_outro),
        data_discussao=registro.data_discussao,
        data_visita=registro.data_visita,
        data_transferencia=registro.data_transferencia,
        observacoes=registro.observacoes,
        registrado_por_id=registro.registrado_por_id,
        registrado_por_nome=usuarios_map.get(registro.registrado_por_id),
        criado_em=registro.criado_em,
        atualizado_em=registro.atualizado_em,
    )


def _map_discussao(
    registro,
    conv_map,
    usuarios_map,
    *,
    situacao_atual: str | None = None,
    evolucoes: list | None = None,
):
    convivente = conv_map.get(registro.convivente_id)
    return AcompanhamentoDiscussaoHospitalarResponse(
        id=registro.id,
        convivente_id=registro.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        prontuario=_prontuario_convivente(convivente),
        registro_pai_id=registro.registro_pai_id,
        nome_hospital=registro.nome_hospital,
        hospital_outro=registro.hospital_outro,
        hospital_exibicao=_hospital_exibicao(registro.nome_hospital, registro.hospital_outro),
        data_discussao=registro.data_discussao,
        data_prevista_entrada=registro.data_prevista_entrada,
        status_evolucao=registro.status_evolucao,
        data_evolucao=registro.data_evolucao,
        situacao_atual=situacao_atual,
        observacoes=registro.observacoes,
        registrado_por_id=registro.registrado_por_id,
        registrado_por_nome=usuarios_map.get(registro.registrado_por_id),
        criado_em=registro.criado_em,
        atualizado_em=registro.atualizado_em,
        evolucoes=evolucoes,
    )


async def _mapear_situacao_atual_discussoes(
    db: AsyncSession,
    instituicao_id: str,
    registros_principais_ids: set[str],
) -> dict[str, str]:
    if not registros_principais_ids:
        return {}

    evolucoes = (
        await db.execute(
            select(AcompanhamentoDiscussaoHospitalarDB)
            .where(
                AcompanhamentoDiscussaoHospitalarDB.instituicao_id == instituicao_id,
                AcompanhamentoDiscussaoHospitalarDB.registro_pai_id.in_(registros_principais_ids),
            )
            .order_by(
                AcompanhamentoDiscussaoHospitalarDB.data_evolucao.desc(),
                AcompanhamentoDiscussaoHospitalarDB.criado_em.desc(),
            )
        )
    ).scalars().all()

    situacao_por_pai: dict[str, str] = {}
    for evolucao in evolucoes:
        if evolucao.registro_pai_id and evolucao.registro_pai_id not in situacao_por_pai:
            situacao_por_pai[evolucao.registro_pai_id] = evolucao.status_evolucao or "Em discussão"
    return situacao_por_pai


async def _obter_discussao_principal(
    db: AsyncSession,
    instituicao_id: str,
    registro_id: str,
) -> AcompanhamentoDiscussaoHospitalarDB:
    registro = await _obter_registro_instituicao(
        db, AcompanhamentoDiscussaoHospitalarDB, instituicao_id, registro_id
    )
    if registro.registro_pai_id:
        raise HTTPException(status_code=400, detail="Evolua sempre o registro principal da discussão.")
    return registro


async def _obter_evolucao_discussao(
    db: AsyncSession,
    instituicao_id: str,
    registro_id: str,
) -> AcompanhamentoDiscussaoHospitalarDB:
    registro = await _obter_registro_instituicao(
        db, AcompanhamentoDiscussaoHospitalarDB, instituicao_id, registro_id
    )
    if not registro.registro_pai_id:
        raise HTTPException(status_code=400, detail="Registro informado não é uma evolução.")
    return registro


async def _discussao_encerrada(
    db: AsyncSession,
    instituicao_id: str,
    registro_pai_id: str,
) -> bool:
    ultima = (
        await db.execute(
            select(AcompanhamentoDiscussaoHospitalarDB)
            .where(
                AcompanhamentoDiscussaoHospitalarDB.instituicao_id == instituicao_id,
                AcompanhamentoDiscussaoHospitalarDB.registro_pai_id == registro_pai_id,
            )
            .order_by(
                AcompanhamentoDiscussaoHospitalarDB.data_evolucao.desc(),
                AcompanhamentoDiscussaoHospitalarDB.criado_em.desc(),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    return bool(ultima and ultima.status_evolucao == "Encerrado")


async def _obter_pot_principal(
    db: AsyncSession,
    instituicao_id: str,
    registro_id: str,
) -> AcompanhamentoPotDB:
    registro = await _obter_registro_instituicao(
        db, AcompanhamentoPotDB, instituicao_id, registro_id
    )
    if registro.registro_pai_id:
        raise HTTPException(status_code=400, detail="Evolua sempre o registro principal do POT.")
    return registro


async def _obter_evolucao_pot(
    db: AsyncSession,
    instituicao_id: str,
    registro_id: str,
) -> AcompanhamentoPotDB:
    registro = await _obter_registro_instituicao(
        db, AcompanhamentoPotDB, instituicao_id, registro_id
    )
    if not registro.registro_pai_id:
        raise HTTPException(status_code=400, detail="Registro informado não é uma evolução do POT.")
    return registro


async def _mapear_situacao_atual_pot(
    db: AsyncSession,
    instituicao_id: str,
    registros_principais_ids: set[str],
) -> dict[str, str]:
    if not registros_principais_ids:
        return {}

    evolucoes = (
        await db.execute(
            select(AcompanhamentoPotDB)
            .where(
                AcompanhamentoPotDB.instituicao_id == instituicao_id,
                AcompanhamentoPotDB.registro_pai_id.in_(registros_principais_ids),
            )
            .order_by(
                AcompanhamentoPotDB.data_evolucao.desc(),
                AcompanhamentoPotDB.criado_em.desc(),
            )
        )
    ).scalars().all()

    situacao_por_pai: dict[str, str] = {}
    for evolucao in evolucoes:
        if evolucao.registro_pai_id and evolucao.registro_pai_id not in situacao_por_pai:
            situacao_por_pai[evolucao.registro_pai_id] = evolucao.status_evolucao or "Em participação"
    return situacao_por_pai


async def _pot_encerrado(
    db: AsyncSession,
    instituicao_id: str,
    registro_pai_id: str,
) -> bool:
    ultima = (
        await db.execute(
            select(AcompanhamentoPotDB)
            .where(
                AcompanhamentoPotDB.instituicao_id == instituicao_id,
                AcompanhamentoPotDB.registro_pai_id == registro_pai_id,
            )
            .order_by(
                AcompanhamentoPotDB.data_evolucao.desc(),
                AcompanhamentoPotDB.criado_em.desc(),
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    return bool(ultima and ultima.status_evolucao == "Encerrado")


async def _mapear_evolucoes_pot_principais(
    db: AsyncSession,
    instituicao_id: str,
    conv_map: dict[str, ConviventeDB],
    usuarios_map: dict[str, str],
    principais: list[AcompanhamentoPotDB],
) -> list[dict]:
    if not principais:
        return []

    ids_principais = {item.id for item in principais}
    situacao_map = await _mapear_situacao_atual_pot(db, instituicao_id, ids_principais)

    evolucoes_db = (
        await db.execute(
            select(AcompanhamentoPotDB)
            .where(
                AcompanhamentoPotDB.instituicao_id == instituicao_id,
                AcompanhamentoPotDB.registro_pai_id.in_(ids_principais),
            )
            .order_by(
                AcompanhamentoPotDB.data_evolucao.desc(),
                AcompanhamentoPotDB.criado_em.desc(),
            )
        )
    ).scalars().all()

    evolucoes_por_pai: dict[str, list] = {}
    for item in evolucoes_db:
        evolucoes_por_pai.setdefault(item.registro_pai_id, []).append(item)

    return [
        _map_pot(
            registro,
            conv_map,
            usuarios_map,
            situacao_atual=situacao_map.get(registro.id, "Em participação"),
            evolucoes=[
                _map_pot(evo, conv_map, usuarios_map).model_dump()
                for evo in evolucoes_por_pai.get(registro.id, [])
            ],
        ).model_dump()
        for registro in principais
    ]


def _map_tb(registro, conv_map, usuarios_map):
    convivente = conv_map.get(registro.convivente_id)
    return AcompanhamentoTbResponse(
        id=registro.id,
        convivente_id=registro.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        prontuario=_prontuario_convivente(convivente),
        situacao=registro.situacao,
        data_inicio=registro.data_inicio,
        data_fim=registro.data_fim,
        observacoes=registro.observacoes,
        registrado_por_id=registro.registrado_por_id,
        registrado_por_nome=usuarios_map.get(registro.registrado_por_id),
        criado_em=registro.criado_em,
        atualizado_em=registro.atualizado_em,
    )


def _map_pot(
    registro,
    conv_map,
    usuarios_map,
    *,
    situacao_atual: str | None = None,
    evolucoes: list | None = None,
):
    convivente = conv_map.get(registro.convivente_id)
    return AcompanhamentoPotResponse(
        id=registro.id,
        convivente_id=registro.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        prontuario=_prontuario_convivente(convivente),
        registro_pai_id=registro.registro_pai_id,
        status_evolucao=registro.status_evolucao,
        data_evolucao=registro.data_evolucao,
        situacao_atual=situacao_atual,
        data_insercao=registro.data_insercao,
        data_desligamento=registro.data_desligamento,
        congelamento_ativo=bool(registro.congelamento_ativo),
        congelamento_inicio=registro.congelamento_inicio,
        congelamento_fim=registro.congelamento_fim,
        observacoes=registro.observacoes,
        registrado_por_id=registro.registrado_por_id,
        registrado_por_nome=usuarios_map.get(registro.registrado_por_id),
        criado_em=registro.criado_em,
        atualizado_em=registro.atualizado_em,
        evolucoes=evolucoes,
    )


def _map_suspensao(registro, conv_map, usuarios_map):
    convivente = conv_map.get(registro.convivente_id)
    return AcompanhamentoSuspensaoProvisoriaResponse(
        id=registro.id,
        convivente_id=registro.convivente_id,
        convivente_nome=_nome_convivente(convivente),
        prontuario=_prontuario_convivente(convivente),
        mes_referencia=registro.mes_referencia,
        data_registro=registro.data_registro,
        motivo=registro.motivo,
        observacoes=registro.observacoes,
        status_aplicado=registro.status_aplicado or "Bloqueado",
        registrado_por_id=registro.registrado_por_id,
        registrado_por_nome=usuarios_map.get(registro.registrado_por_id),
        criado_em=registro.criado_em,
        atualizado_em=registro.atualizado_em,
    )


async def _obter_registro_instituicao(db, model, instituicao_id, registro_id):
    registro = (
        await db.execute(
            select(model).where(
                model.id == registro_id,
                model.instituicao_id == instituicao_id,
            )
        )
    ).scalar_one_or_none()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    return registro


def _montar_pagina_secao(items: list, total: int, offset: int, limite: int) -> dict:
    return {
        "items": items,
        "total": total,
        "offset": offset,
        "limit": limite,
        "has_more": offset + len(items) < total,
    }


async def _paginar_registros_convivente(
    db: AsyncSession,
    model: Type,
    instituicao_id: str,
    convivente_id: str,
    offset: int,
    limite: int,
    filtro_query: Callable | None = None,
) -> tuple[list, int]:
    query = select(model).where(
        model.instituicao_id == instituicao_id,
        model.convivente_id == convivente_id,
    )
    if filtro_query is not None:
        query = filtro_query(query)

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()

    registros = (
        await db.execute(
            query.order_by(model.criado_em.desc()).offset(offset).limit(limite)
        )
    ).scalars().all()
    return registros, total


async def _mapear_evolucoes_discussoes_principais(
    db: AsyncSession,
    instituicao_id: str,
    conv_map: dict[str, ConviventeDB],
    usuarios_map: dict[str, str],
    principais: list[AcompanhamentoDiscussaoHospitalarDB],
) -> list[dict]:
    if not principais:
        return []

    ids_principais = {item.id for item in principais}
    situacao_map = await _mapear_situacao_atual_discussoes(db, instituicao_id, ids_principais)

    evolucoes_db = (
        await db.execute(
            select(AcompanhamentoDiscussaoHospitalarDB)
            .where(
                AcompanhamentoDiscussaoHospitalarDB.instituicao_id == instituicao_id,
                AcompanhamentoDiscussaoHospitalarDB.registro_pai_id.in_(ids_principais),
            )
            .order_by(
                AcompanhamentoDiscussaoHospitalarDB.data_evolucao.desc(),
                AcompanhamentoDiscussaoHospitalarDB.criado_em.desc(),
            )
        )
    ).scalars().all()

    evolucoes_por_pai: dict[str, list] = {}
    for item in evolucoes_db:
        evolucoes_por_pai.setdefault(item.registro_pai_id, []).append(item)

    return [
        _map_discussao(
            registro,
            conv_map,
            usuarios_map,
            situacao_atual=situacao_map.get(registro.id, "Em discussão"),
            evolucoes=[
                _map_discussao(evo, conv_map, usuarios_map).model_dump()
                for evo in evolucoes_por_pai.get(registro.id, [])
            ],
        ).model_dump()
        for registro in principais
    ]


async def _carregar_secao_acompanhamentos_convivente(
    db: AsyncSession,
    instituicao_id: str,
    convivente_id: str,
    secao: str,
    conv_map: dict[str, ConviventeDB],
    usuarios_map: dict[str, str],
    offset: int,
    limite: int,
) -> dict:
    if secao == "transferencias":
        registros, total = await _paginar_registros_convivente(
            db,
            AcompanhamentoTransferenciaDB,
            instituicao_id,
            convivente_id,
            offset,
            limite,
        )
        items = [
            _map_transferencia(registro, conv_map, usuarios_map).model_dump()
            for registro in registros
        ]
        return _montar_pagina_secao(items, total, offset, limite)

    if secao == "discussoes_hospitalares":
        registros, total = await _paginar_registros_convivente(
            db,
            AcompanhamentoDiscussaoHospitalarDB,
            instituicao_id,
            convivente_id,
            offset,
            limite,
            filtro_query=lambda query: query.where(AcompanhamentoDiscussaoHospitalarDB.registro_pai_id.is_(None)),
        )
        items = await _mapear_evolucoes_discussoes_principais(
            db,
            instituicao_id,
            conv_map,
            usuarios_map,
            registros,
        )
        return _montar_pagina_secao(items, total, offset, limite)

    if secao == "tuberculose":
        registros, total = await _paginar_registros_convivente(
            db,
            AcompanhamentoTbDB,
            instituicao_id,
            convivente_id,
            offset,
            limite,
        )
        items = [_map_tb(registro, conv_map, usuarios_map).model_dump() for registro in registros]
        return _montar_pagina_secao(items, total, offset, limite)

    if secao == "pot":
        registros, total = await _paginar_registros_convivente(
            db,
            AcompanhamentoPotDB,
            instituicao_id,
            convivente_id,
            offset,
            limite,
            filtro_query=lambda query: query.where(AcompanhamentoPotDB.registro_pai_id.is_(None)),
        )
        items = await _mapear_evolucoes_pot_principais(
            db,
            instituicao_id,
            conv_map,
            usuarios_map,
            registros,
        )
        return _montar_pagina_secao(items, total, offset, limite)

    if secao == "suspensoes_provisorias":
        registros, total = await _paginar_registros_convivente(
            db,
            AcompanhamentoSuspensaoProvisoriaDB,
            instituicao_id,
            convivente_id,
            offset,
            limite,
        )
        items = [_map_suspensao(registro, conv_map, usuarios_map).model_dump() for registro in registros]
        return _montar_pagina_secao(items, total, offset, limite)

    raise HTTPException(status_code=400, detail="Seção de acompanhamento inválida.")


def _validar_destino_outro_update(destino: str | None, destino_outro: str | None):
    if destino == "Outros":
        texto = (destino_outro or "").strip()
        if len(texto) < 2:
            raise HTTPException(status_code=400, detail="Informe o destino quando selecionar Outros.")
        return texto
    return None if destino else destino_outro


def _usuario_operacional_id(usuario: dict) -> str:
    return str(usuario.get("sub") or usuario.get("id") or "")


@router.get("/transferencias/opcoes")
async def opcoes_transferencias(
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    return {
        "destinos": DESTINOS_TRANSFERENCIA,
        "tipos_acao": TIPOS_ACAO_ACOMPANHAMENTO,
    }


@router.get("/transferencias", response_model=AcompanhamentosListaResponse)
async def listar_transferencias(
    busca: Optional[str] = Query(None),
    destino: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limite: int = Query(REGISTROS_POR_PAGINA_PADRAO, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    if destino and destino not in DESTINOS_TRANSFERENCIA_VALIDOS:
        raise HTTPException(status_code=400, detail="Tipo de ação inválido.")

    return await _listar_registros(
        db,
        instituicao_id,
        AcompanhamentoTransferenciaDB,
        AcompanhamentoTransferenciaDB.data_transferencia,
        lambda reg, conv_map, users: _map_transferencia(reg, conv_map, users),
        busca=busca,
        data_inicio=_parse_data_filtro(data_inicio),
        data_fim=_parse_data_filtro(data_fim),
        destino=destino,
        offset=offset,
        limite=limite,
        extras={"destinos_transferencia": DESTINOS_TRANSFERENCIA},
    )


@router.post("/transferencias", response_model=AcompanhamentoTransferenciaResponse, status_code=status.HTTP_201_CREATED)
async def criar_transferencia(
    payload: AcompanhamentoTransferenciaCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    convivente = await _obter_convivente_instituicao(
        db,
        instituicao_id,
        payload.convivente_id,
        status_permitidos=STATUS_CONVIVENTE_ACOES,
    )
    agora = agora_sao_paulo()

    registro = AcompanhamentoTransferenciaDB(
        instituicao_id=instituicao_id,
        convivente_id=payload.convivente_id,
        destino=payload.destino,
        destino_outro=payload.destino_outro,
        data_discussao=payload.data_discussao,
        data_visita=payload.data_visita,
        data_transferencia=payload.data_transferencia,
        observacoes=(payload.observacoes or "").strip() or None,
        registrado_por_id=_usuario_operacional_id(usuario),
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(registro)

    destino_txt = _destino_exibicao(payload.destino, payload.destino_outro)
    usuario_id = _usuario_operacional_id(usuario)

    if payload.marcar_ausencia_justificada:
        await _aplicar_status_convivente(
            db,
            instituicao_id=instituicao_id,
            convivente=convivente,
            status_novo="Ausência justificada",
            descricao=f"Ausência justificada registrada via ação: {destino_txt}.",
            usuario_id=usuario_id,
        )
    elif payload.inativar_convivente:
        await _aplicar_status_convivente(
            db,
            instituicao_id=instituicao_id,
            convivente=convivente,
            status_novo="Inativado",
            descricao=f"Inativação após ação/encaminhamento/saída: {destino_txt}.",
            usuario_id=usuario_id,
        )

    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_transferencia(registro, {convivente.id: convivente}, usuarios_map)


@router.patch("/transferencias/{registro_id}", response_model=AcompanhamentoTransferenciaResponse)
async def atualizar_transferencia(
    registro_id: str,
    payload: AcompanhamentoTransferenciaUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_registro_instituicao(
        db, AcompanhamentoTransferenciaDB, instituicao_id, registro_id
    )

    dados = payload.model_dump(exclude_unset=True)
    novo_destino = dados.get("destino", registro.destino)
    if "destino_outro" in dados or "destino" in dados:
        destino_outro = dados.get("destino_outro", registro.destino_outro)
        dados["destino_outro"] = _validar_destino_outro_update(novo_destino, destino_outro)

    for campo, valor in dados.items():
        if campo == "observacoes":
            valor = (valor or "").strip() or None
        setattr(registro, campo, valor)
    registro.atualizado_em = agora_sao_paulo()

    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_transferencia(registro, {convivente.id: convivente}, usuarios_map)


@router.delete("/transferencias/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_transferencia(
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_registro_instituicao(
        db, AcompanhamentoTransferenciaDB, instituicao_id, registro_id
    )
    await db.delete(registro)
    await db.commit()


@router.get("/discussoes-hospitalares/opcoes")
async def opcoes_discussoes_hospitalares(
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    return {
        "hospitais": HOSPITAIS_SAOPAULO_SUS,
        "status_evolucao": STATUS_EVOLUCAO_DISCUSSAO_HOSPITALAR,
    }


async def _listar_discussoes_principais(
    db: AsyncSession,
    instituicao_id: str,
    *,
    busca: Optional[str] = None,
    data_inicio: Optional[date] = None,
    data_fim: Optional[date] = None,
    offset: int = 0,
    limite: int = REGISTROS_POR_PAGINA_PADRAO,
) -> AcompanhamentosListaResponse:
    query = (
        select(AcompanhamentoDiscussaoHospitalarDB, ConviventeDB)
        .join(ConviventeDB, ConviventeDB.id == AcompanhamentoDiscussaoHospitalarDB.convivente_id)
        .where(
            AcompanhamentoDiscussaoHospitalarDB.instituicao_id == instituicao_id,
            AcompanhamentoDiscussaoHospitalarDB.registro_pai_id.is_(None),
        )
        .order_by(AcompanhamentoDiscussaoHospitalarDB.criado_em.desc())
    )

    if busca:
        query = _aplicar_busca_convivente(query, busca)

    if data_inicio:
        query = query.where(AcompanhamentoDiscussaoHospitalarDB.data_discussao >= data_inicio)
    if data_fim:
        query = query.where(AcompanhamentoDiscussaoHospitalarDB.data_discussao <= data_fim)

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()

    rows = (
        await db.execute(query.offset(offset).limit(limite))
    ).all()

    ids_principais = {registro.id for registro, _ in rows}
    situacao_map = await _mapear_situacao_atual_discussoes(db, instituicao_id, ids_principais)

    usuario_ids = {registro.registrado_por_id for registro, _ in rows}
    usuarios_map = await _mapear_usuarios(db, usuario_ids)
    conv_map = {convivente.id: convivente for _, convivente in rows}

    items = [
        _map_discussao(
            registro,
            conv_map,
            usuarios_map,
            situacao_atual=situacao_map.get(registro.id, "Em discussão"),
        ).model_dump()
        for registro, _ in rows
    ]

    return AcompanhamentosListaResponse(
        items=items,
        total=total,
        limit=limite,
        offset=offset,
        has_more=offset + len(items) < total,
        hospitais=HOSPITAIS_SAOPAULO_SUS,
        status_evolucao=STATUS_EVOLUCAO_DISCUSSAO_HOSPITALAR,
    )


@router.get("/discussoes-hospitalares", response_model=AcompanhamentosListaResponse)
async def listar_discussoes_hospitalares(
    busca: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limite: int = Query(REGISTROS_POR_PAGINA_PADRAO, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    return await _listar_discussoes_principais(
        db,
        instituicao_id,
        busca=busca,
        data_inicio=_parse_data_filtro(data_inicio),
        data_fim=_parse_data_filtro(data_fim),
        offset=offset,
        limite=limite,
    )


@router.get("/discussoes-hospitalares/{registro_id}", response_model=AcompanhamentoDiscussaoHospitalarResponse)
async def obter_discussao_hospitalar(
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_discussao_principal(db, instituicao_id, registro_id)

    evolucoes_db = (
        await db.execute(
            select(AcompanhamentoDiscussaoHospitalarDB)
            .where(
                AcompanhamentoDiscussaoHospitalarDB.instituicao_id == instituicao_id,
                AcompanhamentoDiscussaoHospitalarDB.registro_pai_id == registro.id,
            )
            .order_by(
                AcompanhamentoDiscussaoHospitalarDB.data_evolucao.desc(),
                AcompanhamentoDiscussaoHospitalarDB.criado_em.desc(),
            )
        )
    ).scalars().all()

    usuario_ids = {registro.registrado_por_id, *(item.registrado_por_id for item in evolucoes_db)}
    usuarios_map = await _mapear_usuarios(db, usuario_ids)
    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    conv_map = {convivente.id: convivente}

    situacao_atual = evolucoes_db[0].status_evolucao if evolucoes_db else "Em discussão"
    evolucoes = [
        _map_discussao(item, conv_map, usuarios_map).model_dump()
        for item in evolucoes_db
    ]

    return _map_discussao(
        registro,
        conv_map,
        usuarios_map,
        situacao_atual=situacao_atual,
        evolucoes=evolucoes,
    )


@router.post("/discussoes-hospitalares", response_model=AcompanhamentoDiscussaoHospitalarResponse, status_code=status.HTTP_201_CREATED)
async def criar_discussao_hospitalar(
    payload: AcompanhamentoDiscussaoHospitalarCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    await _obter_convivente_instituicao(
        db,
        instituicao_id,
        payload.convivente_id,
        status_permitidos=STATUS_CONVIVENTE_DISCUSSAO,
    )
    agora = agora_sao_paulo()

    registro = AcompanhamentoDiscussaoHospitalarDB(
        instituicao_id=instituicao_id,
        convivente_id=payload.convivente_id,
        nome_hospital=payload.nome_hospital,
        hospital_outro=payload.hospital_outro,
        data_discussao=payload.data_discussao,
        data_prevista_entrada=payload.data_prevista_entrada,
        observacoes=(payload.observacoes or "").strip() or None,
        registrado_por_id=_usuario_operacional_id(usuario),
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(registro)
    await db.flush()
    await sincronizar_discussao_hospitalar_pia(
        db,
        registro,
        _usuario_operacional_id(usuario),
        evento="criacao",
    )
    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_discussao(
        registro,
        {convivente.id: convivente},
        usuarios_map,
        situacao_atual="Em discussão",
    )


@router.patch("/discussoes-hospitalares/{registro_id}", response_model=AcompanhamentoDiscussaoHospitalarResponse)
async def atualizar_discussao_hospitalar(
    registro_id: str,
    payload: AcompanhamentoDiscussaoHospitalarUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_discussao_principal(db, instituicao_id, registro_id)

    for campo, valor in payload.model_dump(exclude_unset=True).items():
        if campo in {"nome_hospital", "observacoes"}:
            valor = (valor or "").strip() or None
        setattr(registro, campo, valor)
    registro.atualizado_em = agora_sao_paulo()

    await sincronizar_discussao_hospitalar_pia(
        db,
        registro,
        _usuario_operacional_id(usuario),
        evento="edicao",
    )
    await db.commit()
    await db.refresh(registro)

    situacao_map = await _mapear_situacao_atual_discussoes(db, instituicao_id, {registro.id})
    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_discussao(
        registro,
        {convivente.id: convivente},
        usuarios_map,
        situacao_atual=situacao_map.get(registro.id, "Em discussão"),
    )


@router.post(
    "/discussoes-hospitalares/{registro_id}/evolucoes",
    response_model=AcompanhamentoDiscussaoHospitalarResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_evolucao_discussao_hospitalar(
    registro_id: str,
    payload: AcompanhamentoDiscussaoEvolucaoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro_pai = await _obter_discussao_principal(db, instituicao_id, registro_id)

    if await _discussao_encerrada(db, instituicao_id, registro_pai.id):
        raise HTTPException(
            status_code=400,
            detail="Esta discussão já foi encerrada. Não é possível registrar novas evoluções.",
        )

    agora = agora_sao_paulo()
    evolucao = AcompanhamentoDiscussaoHospitalarDB(
        instituicao_id=instituicao_id,
        convivente_id=registro_pai.convivente_id,
        registro_pai_id=registro_pai.id,
        status_evolucao=payload.status_evolucao,
        data_evolucao=payload.data_evolucao,
        observacoes=(payload.observacoes or "").strip() or None,
        registrado_por_id=_usuario_operacional_id(usuario),
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(evolucao)
    await db.flush()
    await sincronizar_discussao_hospitalar_pia(
        db,
        evolucao,
        _usuario_operacional_id(usuario),
        evento="criacao",
    )
    await db.commit()
    await db.refresh(evolucao)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, evolucao.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {evolucao.registrado_por_id})
    return _map_discussao(evolucao, {convivente.id: convivente}, usuarios_map)


@router.patch(
    "/discussoes-hospitalares/evolucoes/{registro_id}",
    response_model=AcompanhamentoDiscussaoHospitalarResponse,
)
async def atualizar_evolucao_discussao_hospitalar(
    registro_id: str,
    payload: AcompanhamentoDiscussaoEvolucaoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_evolucao_discussao(db, instituicao_id, registro_id)

    for campo, valor in payload.model_dump(exclude_unset=True).items():
        if campo == "observacoes":
            valor = (valor or "").strip() or None
        setattr(registro, campo, valor)
    registro.atualizado_em = agora_sao_paulo()

    await sincronizar_discussao_hospitalar_pia(
        db,
        registro,
        _usuario_operacional_id(usuario),
        evento="edicao",
    )
    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_discussao(registro, {convivente.id: convivente}, usuarios_map)


@router.delete("/discussoes-hospitalares/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_discussao_hospitalar(
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_discussao_principal(db, instituicao_id, registro_id)
    await db.delete(registro)
    await db.commit()


@router.get("/tuberculose", response_model=AcompanhamentosListaResponse)
async def listar_tuberculose(
    busca: Optional[str] = Query(None),
    situacao: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limite: int = Query(REGISTROS_POR_PAGINA_PADRAO, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    if situacao and situacao not in SITUACOES_TB:
        raise HTTPException(status_code=400, detail="Situação inválida.")

    return await _listar_registros(
        db,
        instituicao_id,
        AcompanhamentoTbDB,
        AcompanhamentoTbDB.data_inicio,
        lambda reg, conv_map, users: _map_tb(reg, conv_map, users),
        busca=busca,
        data_inicio=_parse_data_filtro(data_inicio),
        data_fim=_parse_data_filtro(data_fim),
        situacao=situacao,
        offset=offset,
        limite=limite,
        extras={"situacoes_tb": SITUACOES_TB},
    )


@router.post("/tuberculose", response_model=AcompanhamentoTbResponse, status_code=status.HTTP_201_CREATED)
async def criar_tuberculose(
    payload: AcompanhamentoTbCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    await _obter_convivente_instituicao(
        db,
        instituicao_id,
        payload.convivente_id,
        status_permitidos=STATUS_CONVIVENTE_ATIVO,
    )
    agora = agora_sao_paulo()

    registro = AcompanhamentoTbDB(
        instituicao_id=instituicao_id,
        convivente_id=payload.convivente_id,
        situacao=payload.situacao,
        data_inicio=payload.data_inicio,
        data_fim=payload.data_fim,
        observacoes=(payload.observacoes or "").strip() or None,
        registrado_por_id=_usuario_operacional_id(usuario),
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(registro)
    await db.flush()
    await sincronizar_tuberculose_pia(
        db,
        registro,
        _usuario_operacional_id(usuario),
        evento="criacao",
    )
    if registro.situacao == "Alta":
        await sincronizar_tuberculose_pia(
            db,
            registro,
            _usuario_operacional_id(usuario),
            evento="criacao",
            encerramento=True,
        )
    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_tb(registro, {convivente.id: convivente}, usuarios_map)


@router.patch("/tuberculose/{registro_id}", response_model=AcompanhamentoTbResponse)
async def atualizar_tuberculose(
    registro_id: str,
    payload: AcompanhamentoTbUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_registro_instituicao(db, AcompanhamentoTbDB, instituicao_id, registro_id)

    situacao_anterior = registro.situacao
    dados = payload.model_dump(exclude_unset=True)
    for campo, valor in dados.items():
        if campo == "observacoes":
            valor = (valor or "").strip() or None
        setattr(registro, campo, valor)
    registro.atualizado_em = agora_sao_paulo()

    await sincronizar_tuberculose_pia(
        db,
        registro,
        _usuario_operacional_id(usuario),
        evento="edicao",
    )
    nova_situacao = registro.situacao
    if nova_situacao == "Alta" and situacao_anterior != "Alta":
        await sincronizar_tuberculose_pia(
            db,
            registro,
            _usuario_operacional_id(usuario),
            evento="criacao",
            encerramento=True,
        )

    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_tb(registro, {convivente.id: convivente}, usuarios_map)


@router.delete("/tuberculose/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_tuberculose(
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_registro_instituicao(db, AcompanhamentoTbDB, instituicao_id, registro_id)
    await db.delete(registro)
    await db.commit()


@router.get("/pot", response_model=AcompanhamentosListaResponse)
async def listar_pot(
    busca: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limite: int = Query(REGISTROS_POR_PAGINA_PADRAO, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)

    query = (
        select(AcompanhamentoPotDB, ConviventeDB)
        .join(ConviventeDB, ConviventeDB.id == AcompanhamentoPotDB.convivente_id)
        .where(
            AcompanhamentoPotDB.instituicao_id == instituicao_id,
            AcompanhamentoPotDB.registro_pai_id.is_(None),
        )
        .order_by(AcompanhamentoPotDB.criado_em.desc())
    )

    if busca:
        query = _aplicar_busca_convivente(query, busca)

    if data_inicio:
        query = query.where(AcompanhamentoPotDB.data_insercao >= _parse_data_filtro(data_inicio))
    if data_fim:
        query = query.where(AcompanhamentoPotDB.data_insercao <= _parse_data_filtro(data_fim))

    total = (
        await db.execute(select(func.count()).select_from(query.subquery()))
    ).scalar_one()

    rows = (
        await db.execute(query.offset(offset).limit(limite))
    ).all()

    ids_principais = {registro.id for registro, _ in rows}
    situacao_map = await _mapear_situacao_atual_pot(db, instituicao_id, ids_principais)

    usuario_ids = {registro.registrado_por_id for registro, _ in rows}
    usuarios_map = await _mapear_usuarios(db, usuario_ids)
    conv_map = {convivente.id: convivente for _, convivente in rows}

    items = [
        _map_pot(
            registro,
            conv_map,
            usuarios_map,
            situacao_atual=situacao_map.get(registro.id, "Em participação"),
        ).model_dump()
        for registro, _ in rows
    ]

    return AcompanhamentosListaResponse(
        items=items,
        total=total,
        limit=limite,
        offset=offset,
        has_more=offset + len(items) < total,
        status_evolucao=STATUS_EVOLUCAO_POT,
    )


@router.get("/pot/opcoes")
async def opcoes_pot(
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    return {"status_evolucao": STATUS_EVOLUCAO_POT}


@router.get("/pot/{registro_id}", response_model=AcompanhamentoPotResponse)
async def obter_pot(
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_pot_principal(db, instituicao_id, registro_id)

    evolucoes_db = (
        await db.execute(
            select(AcompanhamentoPotDB)
            .where(
                AcompanhamentoPotDB.instituicao_id == instituicao_id,
                AcompanhamentoPotDB.registro_pai_id == registro.id,
            )
            .order_by(
                AcompanhamentoPotDB.data_evolucao.desc(),
                AcompanhamentoPotDB.criado_em.desc(),
            )
        )
    ).scalars().all()

    usuario_ids = {registro.registrado_por_id, *(item.registrado_por_id for item in evolucoes_db)}
    usuarios_map = await _mapear_usuarios(db, usuario_ids)
    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    conv_map = {convivente.id: convivente}

    situacao_atual = evolucoes_db[0].status_evolucao if evolucoes_db else "Em participação"
    evolucoes = [
        _map_pot(item, conv_map, usuarios_map).model_dump()
        for item in evolucoes_db
    ]

    return _map_pot(
        registro,
        conv_map,
        usuarios_map,
        situacao_atual=situacao_atual,
        evolucoes=evolucoes,
    )


@router.post("/pot", response_model=AcompanhamentoPotResponse, status_code=status.HTTP_201_CREATED)
async def criar_pot(
    payload: AcompanhamentoPotCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    await _obter_convivente_instituicao(
        db,
        instituicao_id,
        payload.convivente_id,
        status_permitidos=STATUS_CONVIVENTE_ATIVO,
    )
    agora = agora_sao_paulo()

    registro = AcompanhamentoPotDB(
        instituicao_id=instituicao_id,
        convivente_id=payload.convivente_id,
        data_insercao=payload.data_insercao,
        data_desligamento=payload.data_desligamento,
        congelamento_ativo=payload.congelamento_ativo,
        congelamento_inicio=payload.congelamento_inicio,
        congelamento_fim=payload.congelamento_fim,
        observacoes=(payload.observacoes or "").strip() or None,
        registrado_por_id=_usuario_operacional_id(usuario),
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(registro)
    await db.flush()
    await sincronizar_pot_pia(
        db,
        registro,
        _usuario_operacional_id(usuario),
        evento="criacao",
    )
    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_pot(
        registro,
        {convivente.id: convivente},
        usuarios_map,
        situacao_atual="Em participação",
    )


@router.patch("/pot/{registro_id}", response_model=AcompanhamentoPotResponse)
async def atualizar_pot(
    registro_id: str,
    payload: AcompanhamentoPotUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_pot_principal(db, instituicao_id, registro_id)

    for campo, valor in payload.model_dump(exclude_unset=True).items():
        if campo == "observacoes":
            valor = (valor or "").strip() or None
        setattr(registro, campo, valor)
    registro.atualizado_em = agora_sao_paulo()

    await sincronizar_pot_pia(
        db,
        registro,
        _usuario_operacional_id(usuario),
        evento="edicao",
    )
    await db.commit()
    await db.refresh(registro)

    situacao_map = await _mapear_situacao_atual_pot(db, instituicao_id, {registro.id})
    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_pot(
        registro,
        {convivente.id: convivente},
        usuarios_map,
        situacao_atual=situacao_map.get(registro.id, "Em participação"),
    )


@router.post(
    "/pot/{registro_id}/evolucoes",
    response_model=AcompanhamentoPotResponse,
    status_code=status.HTTP_201_CREATED,
)
async def criar_evolucao_pot(
    registro_id: str,
    payload: AcompanhamentoPotEvolucaoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro_pai = await _obter_pot_principal(db, instituicao_id, registro_id)

    if await _pot_encerrado(db, instituicao_id, registro_pai.id):
        raise HTTPException(
            status_code=400,
            detail="Este registro POT já foi encerrado. Não é possível registrar novas evoluções.",
        )

    agora = agora_sao_paulo()
    evolucao = AcompanhamentoPotDB(
        instituicao_id=instituicao_id,
        convivente_id=registro_pai.convivente_id,
        registro_pai_id=registro_pai.id,
        status_evolucao=payload.status_evolucao,
        data_evolucao=payload.data_evolucao,
        observacoes=(payload.observacoes or "").strip() or None,
        registrado_por_id=_usuario_operacional_id(usuario),
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(evolucao)
    await db.flush()
    await sincronizar_pot_pia(
        db,
        evolucao,
        _usuario_operacional_id(usuario),
        evento="criacao",
    )
    await db.commit()
    await db.refresh(evolucao)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, evolucao.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {evolucao.registrado_por_id})
    return _map_pot(evolucao, {convivente.id: convivente}, usuarios_map)


@router.patch(
    "/pot/evolucoes/{registro_id}",
    response_model=AcompanhamentoPotResponse,
)
async def atualizar_evolucao_pot(
    registro_id: str,
    payload: AcompanhamentoPotEvolucaoUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_evolucao_pot(db, instituicao_id, registro_id)

    for campo, valor in payload.model_dump(exclude_unset=True).items():
        if campo == "observacoes":
            valor = (valor or "").strip() or None
        setattr(registro, campo, valor)
    registro.atualizado_em = agora_sao_paulo()

    await sincronizar_pot_pia(
        db,
        registro,
        _usuario_operacional_id(usuario),
        evento="edicao",
    )
    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_pot(registro, {convivente.id: convivente}, usuarios_map)


@router.delete("/pot/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_pot(
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_pot_principal(db, instituicao_id, registro_id)
    await db.delete(registro)
    await db.commit()


@router.get("/suspensoes-provisorias", response_model=AcompanhamentosListaResponse)
async def listar_suspensoes_provisorias(
    busca: Optional[str] = Query(None),
    mes_referencia: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limite: int = Query(REGISTROS_POR_PAGINA_PADRAO, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    return await _listar_registros(
        db,
        instituicao_id,
        AcompanhamentoSuspensaoProvisoriaDB,
        AcompanhamentoSuspensaoProvisoriaDB.data_registro,
        lambda reg, conv_map, users: _map_suspensao(reg, conv_map, users),
        busca=busca,
        data_inicio=_parse_data_filtro(data_inicio),
        data_fim=_parse_data_filtro(data_fim),
        mes_referencia=mes_referencia,
        offset=offset,
        limite=limite,
    )


@router.post("/suspensoes-provisorias", response_model=AcompanhamentoSuspensaoProvisoriaResponse, status_code=status.HTTP_201_CREATED)
async def criar_suspensao_provisoria(
    payload: AcompanhamentoSuspensaoProvisoriaCreate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    convivente = await _obter_convivente_instituicao(
        db,
        instituicao_id,
        payload.convivente_id,
        status_permitidos=STATUS_CONVIVENTE_ATIVO,
    )
    agora = agora_sao_paulo()
    status_aplicado = payload.status_aplicado or "Bloqueado"

    registro = AcompanhamentoSuspensaoProvisoriaDB(
        instituicao_id=instituicao_id,
        convivente_id=payload.convivente_id,
        mes_referencia=payload.mes_referencia,
        data_registro=payload.data_registro,
        motivo=payload.motivo.strip(),
        observacoes=(payload.observacoes or "").strip() or None,
        status_aplicado=status_aplicado,
        registrado_por_id=_usuario_operacional_id(usuario),
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(registro)

    descricao = payload.motivo.strip()
    if payload.observacoes:
        descricao = f"{descricao}\n\n{payload.observacoes.strip()}"

    await _aplicar_status_convivente(
        db,
        instituicao_id=instituicao_id,
        convivente=convivente,
        status_novo=status_aplicado,
        descricao=descricao,
        usuario_id=_usuario_operacional_id(usuario),
    )

    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_suspensao(registro, {convivente.id: convivente}, usuarios_map)


@router.patch("/suspensoes-provisorias/{registro_id}", response_model=AcompanhamentoSuspensaoProvisoriaResponse)
async def atualizar_suspensao_provisoria(
    registro_id: str,
    payload: AcompanhamentoSuspensaoProvisoriaUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_registro_instituicao(
        db, AcompanhamentoSuspensaoProvisoriaDB, instituicao_id, registro_id
    )

    for campo, valor in payload.model_dump(exclude_unset=True).items():
        if campo in {"motivo", "observacoes"}:
            valor = (valor or "").strip() or None
        setattr(registro, campo, valor)
    registro.atualizado_em = agora_sao_paulo()

    await db.commit()
    await db.refresh(registro)

    convivente = await _obter_convivente_instituicao(db, instituicao_id, registro.convivente_id)
    usuarios_map = await _mapear_usuarios(db, {registro.registrado_por_id})
    return _map_suspensao(registro, {convivente.id: convivente}, usuarios_map)


@router.delete("/suspensoes-provisorias/{registro_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_suspensao_provisoria(
    registro_id: str,
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_edicao_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    registro = await _obter_registro_instituicao(
        db, AcompanhamentoSuspensaoProvisoriaDB, instituicao_id, registro_id
    )
    await db.delete(registro)
    await db.commit()


def _validar_mes_referencia(mes_referencia: str) -> tuple[int, int]:
    valor = (mes_referencia or "").strip()
    if len(valor) != 7 or valor[4] != "-":
        raise HTTPException(status_code=400, detail="Mês de referência inválido. Use AAAA-MM.")
    ano_str, mes_str = valor.split("-", 1)
    if not ano_str.isdigit() or not mes_str.isdigit():
        raise HTTPException(status_code=400, detail="Mês de referência inválido. Use AAAA-MM.")
    ano, mes = int(ano_str), int(mes_str)
    if mes < 1 or mes > 12:
        raise HTTPException(status_code=400, detail="Mês de referência inválido.")
    return ano, mes


def _intervalo_mes_referencia(mes_referencia: str) -> tuple[date, date]:
    ano, mes = _validar_mes_referencia(mes_referencia)
    inicio = date(ano, mes, 1)
    fim = date(ano, mes, monthrange(ano, mes)[1])
    return inicio, fim


def _rotulo_mes_relatorio(mes_referencia: str) -> str:
    ano, mes = _validar_mes_referencia(mes_referencia)
    return f"{MESES_RELATORIO_PT[mes - 1]}/{ano}"


def _data_referencia_acao_sql():
    return func.coalesce(
        AcompanhamentoTransferenciaDB.data_transferencia,
        AcompanhamentoTransferenciaDB.data_visita,
        AcompanhamentoTransferenciaDB.data_discussao,
        cast(AcompanhamentoTransferenciaDB.criado_em, Date),
    )


def _rotulo_periodo(inicio: date, fim: date) -> str:
    return f"{inicio.strftime('%d/%m/%Y')} a {fim.strftime('%d/%m/%Y')}"


def _resolver_periodo_resumo(
    mes_referencia: str,
    data_inicio: Optional[str],
    data_fim: Optional[str],
) -> tuple[date, date, bool]:
    inicio_padrao, fim_padrao = _intervalo_mes_referencia(mes_referencia)
    inicio = _parse_data_filtro(data_inicio) if data_inicio else inicio_padrao
    fim = _parse_data_filtro(data_fim) if data_fim else fim_padrao
    if inicio > fim:
        raise HTTPException(
            status_code=400,
            detail="A data inicial deve ser anterior ou igual à data final.",
        )
    personalizado = inicio != inicio_padrao or fim != fim_padrao
    return inicio, fim, personalizado


@router.get("/resumo-mensal", response_model=AcompanhamentoResumoMensalResponse)
async def resumo_mensal_acompanhamentos(
    mes_referencia: str = Query(..., description="Mês de referência no formato AAAA-MM"),
    data_inicio: Optional[str] = Query(None, description="Início do período (AAAA-MM-DD). Padrão: 1º dia do mês."),
    data_fim: Optional[str] = Query(None, description="Fim do período (AAAA-MM-DD). Padrão: último dia do mês."),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    inicio_periodo, fim_periodo, periodo_personalizado = _resolver_periodo_resumo(
        mes_referencia,
        data_inicio,
        data_fim,
    )
    data_ref = _data_referencia_acao_sql()

    registros_acoes = (
        await db.execute(
            select(
                AcompanhamentoTransferenciaDB.destino,
                AcompanhamentoTransferenciaDB.destino_outro,
            ).where(
                AcompanhamentoTransferenciaDB.instituicao_id == instituicao_id,
                data_ref >= inicio_periodo,
                data_ref <= fim_periodo,
            )
        )
    ).all()

    totais_por_linha: dict[str, int] = {linha: 0 for linha in LINHAS_RELATORIO_MENSAL_ACOES}
    for destino, destino_outro in registros_acoes:
        linha = normalizar_destino_para_linha_relatorio(destino, destino_outro)
        if linha.startswith("Outros —"):
            totais_por_linha["Outros"] = totais_por_linha.get("Outros", 0) + 1
        elif linha in totais_por_linha:
            totais_por_linha[linha] += 1
        else:
            totais_por_linha[linha] = totais_por_linha.get(linha, 0) + 1

    linhas: list[AcompanhamentoResumoMensalLinha] = [
        AcompanhamentoResumoMensalLinha(acao=acao, total=totais_por_linha.get(acao, 0), origem="acoes")
        for acao in LINHAS_RELATORIO_MENSAL_ACOES
    ]

    pia_em_andamento = int(
        (
            await db.execute(
                select(func.count(func.distinct(RegistroPIADB.convivente_id))).where(
                    RegistroPIADB.instituicao_id == instituicao_id,
                    RegistroPIADB.registro_pai_id.is_(None),
                    RegistroPIADB.status == "Em acompanhamento",
                )
            )
        ).scalar_one()
        or 0
    )
    linhas.append(
        AcompanhamentoResumoMensalLinha(
            acao="P.I.A. em andamento",
            total=pia_em_andamento,
            origem="pia",
        )
    )

    suspensoes_mes = int(
        (
            await db.execute(
                select(func.count()).select_from(AcompanhamentoSuspensaoProvisoriaDB).where(
                    AcompanhamentoSuspensaoProvisoriaDB.instituicao_id == instituicao_id,
                    AcompanhamentoSuspensaoProvisoriaDB.data_registro >= inicio_periodo,
                    AcompanhamentoSuspensaoProvisoriaDB.data_registro <= fim_periodo,
                )
            )
        ).scalar_one()
        or 0
    )
    linhas.append(
        AcompanhamentoResumoMensalLinha(
            acao="Conviventes suspensão provisória no mês",
            total=suspensoes_mes,
            origem="suspensao",
        )
    )

    pot_insercoes = int(
        (
            await db.execute(
                select(func.count()).select_from(AcompanhamentoPotDB).where(
                    AcompanhamentoPotDB.instituicao_id == instituicao_id,
                    AcompanhamentoPotDB.data_insercao.isnot(None),
                    AcompanhamentoPotDB.data_insercao >= inicio_periodo,
                    AcompanhamentoPotDB.data_insercao <= fim_periodo,
                )
            )
        ).scalar_one()
        or 0
    )
    linhas.append(
        AcompanhamentoResumoMensalLinha(
            acao="POT — inserções no mês",
            total=pot_insercoes,
            origem="pot",
        )
    )

    pot_desligamentos = int(
        (
            await db.execute(
                select(func.count()).select_from(AcompanhamentoPotDB).where(
                    AcompanhamentoPotDB.instituicao_id == instituicao_id,
                    AcompanhamentoPotDB.data_desligamento.isnot(None),
                    AcompanhamentoPotDB.data_desligamento >= inicio_periodo,
                    AcompanhamentoPotDB.data_desligamento <= fim_periodo,
                )
            )
        ).scalar_one()
        or 0
    )
    linhas.append(
        AcompanhamentoResumoMensalLinha(
            acao="POT — desligamentos no mês",
            total=pot_desligamentos,
            origem="pot",
        )
    )

    mes_rotulo = _rotulo_mes_relatorio(mes_referencia)
    periodo_rotulo = _rotulo_periodo(inicio_periodo, fim_periodo)
    return AcompanhamentoResumoMensalResponse(
        mes_referencia=mes_referencia,
        mes_rotulo=mes_rotulo,
        titulo=f"RELATÓRIO MENSAL – {mes_rotulo}",
        periodo_inicio=inicio_periodo,
        periodo_fim=fim_periodo,
        periodo_rotulo=periodo_rotulo,
        periodo_personalizado=periodo_personalizado,
        linhas=linhas,
        gerado_em=agora_sao_paulo(),
    )


@router.get("/por-convivente/{convivente_id}")
async def listar_acompanhamentos_por_convivente(
    convivente_id: str,
    secao: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limite: int = Query(REGISTROS_POR_PAGINA_PRONTUARIO_ACOMP, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    usuario: dict = Depends(exigir_acesso_acompanhamentos),
):
    instituicao_id = obter_instituicao_escopo(usuario)
    convivente = await _obter_convivente_instituicao(db, instituicao_id, convivente_id)
    conv_map = {convivente.id: convivente}

    if secao:
        if secao not in SECOES_ACOMPANHAMENTO_CONVIVENTE:
            raise HTTPException(status_code=400, detail="Seção de acompanhamento inválida.")
        pagina = await _carregar_secao_acompanhamentos_convivente(
            db,
            instituicao_id,
            convivente_id,
            secao,
            conv_map,
            {},
            offset,
            limite,
        )
        usuario_ids = {
            item.get("registrado_por_id")
            for item in pagina["items"]
            if item.get("registrado_por_id")
        }
        for item in pagina["items"]:
            for evolucao in item.get("evolucoes") or []:
                if evolucao.get("registrado_por_id"):
                    usuario_ids.add(evolucao["registrado_por_id"])
        usuarios_map = await _mapear_usuarios(db, usuario_ids)
        pagina = await _carregar_secao_acompanhamentos_convivente(
            db,
            instituicao_id,
            convivente_id,
            secao,
            conv_map,
            usuarios_map,
            offset,
            limite,
        )
        return {"secao": secao, **pagina}

    paginas_brutas: dict[str, dict] = {}
    usuario_ids: set[str] = set()

    for nome_secao in (
        "transferencias",
        "discussoes_hospitalares",
        "tuberculose",
        "pot",
        "suspensoes_provisorias",
    ):
        pagina = await _carregar_secao_acompanhamentos_convivente(
            db,
            instituicao_id,
            convivente_id,
            nome_secao,
            conv_map,
            {},
            0,
            limite,
        )
        paginas_brutas[nome_secao] = pagina
        for item in pagina["items"]:
            if item.get("registrado_por_id"):
                usuario_ids.add(item["registrado_por_id"])
            for evolucao in item.get("evolucoes") or []:
                if evolucao.get("registrado_por_id"):
                    usuario_ids.add(evolucao["registrado_por_id"])

    usuarios_map = await _mapear_usuarios(db, usuario_ids)

    secoes_resposta = {}
    for nome_secao, pagina in paginas_brutas.items():
        if not pagina["items"]:
            secoes_resposta[nome_secao] = pagina
            continue
        secoes_resposta[nome_secao] = await _carregar_secao_acompanhamentos_convivente(
            db,
            instituicao_id,
            convivente_id,
            nome_secao,
            conv_map,
            usuarios_map,
            0,
            limite,
        )

    return secoes_resposta
