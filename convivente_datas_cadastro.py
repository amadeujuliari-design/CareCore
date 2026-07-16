"""Regras de datas cadastrais do convivente (inclusão, inativação, nova vinculação)."""
from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from models import (
    DocumentoConviventeDB,
    HistoricoConviventeDB,
    LavanderiaRegistroDB,
    OcorrenciaConviventeDB,
    RegistroPIADB,
    RegistroRotinaDB,
)

STATUS_INATIVOS = frozenset({"Inativado", "Bloqueado", "Saída qualificada"})
STATUS_VINCULACAO_ATIVA = frozenset({"Ativo", "Em acolhimento"})
STATUS_OPERACIONAIS = frozenset({"Ativo", "Em acolhimento", "Ausência justificada"})
TITULO_HISTORICO_INATIVACAO = "Inativação institucional"
ORIGEM_HISTORICO_INATIVACAO = "Mudança de status"
DATA_INCLUSAO_SUBSTITUTO_LEGADO = date(2020, 1, 1)
DATA_INCLUSAO_PLACEHOLDER_LEGADO = date(2000, 1, 1)
DATA_INCLUSAO_ANO_MINIMO_CONFIAVEL = 1990


def _extrair_data(valor) -> date | None:
    if valor is None:
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    return None


def normalizar_prontuario_saude(valor: str | None) -> str | None:
    texto = (valor or "").strip()
    return texto or None


def preparar_datas_convivente_criacao(dados: dict, hoje: date) -> None:
    dados["data_entrada"] = hoje
    if not dados.get("data_inclusao"):
        dados["data_inclusao"] = hoje

    if "prontuario_saude" in dados:
        dados["prontuario_saude"] = normalizar_prontuario_saude(dados.get("prontuario_saude"))

    status = dados.get("status", "Ativo")
    if status in STATUS_INATIVOS and not dados.get("data_inativacao"):
        dados["data_inativacao"] = hoje


def bloquear_alteracao_data_entrada_convivente(dados: dict) -> None:
    dados.pop("data_entrada", None)


def aplicar_datas_convivente_payload(
    dados: dict,
    status_antigo: str | None,
    novo_status: str,
    hoje: date,
    campos_enviados: set[str],
) -> None:
    if novo_status != status_antigo:
        if novo_status in STATUS_INATIVOS and "data_inativacao" not in campos_enviados:
            dados["data_inativacao"] = hoje
        if status_antigo in STATUS_INATIVOS and novo_status in STATUS_OPERACIONAIS:
            if (
                novo_status in STATUS_VINCULACAO_ATIVA
                and "data_nova_vinculacao" not in campos_enviados
            ):
                dados["data_nova_vinculacao"] = hoje
            # Campo operacional: limpa na reativação; a data fica só no histórico.
            if "data_inativacao" not in campos_enviados:
                dados["data_inativacao"] = None

    if "prontuario_saude" in dados:
        dados["prontuario_saude"] = normalizar_prontuario_saude(dados.get("prontuario_saude"))


def aplicar_datas_convivente_objeto(
    convivente,
    status_antigo: str,
    novo_status: str,
    hoje: date,
) -> None:
    if novo_status == status_antigo:
        return
    if novo_status in STATUS_INATIVOS:
        convivente.data_inativacao = hoje
    if status_antigo in STATUS_INATIVOS and novo_status in STATUS_OPERACIONAIS:
        if novo_status in STATUS_VINCULACAO_ATIVA:
            convivente.data_nova_vinculacao = hoje
        convivente.data_inativacao = None


async def obter_data_primeira_interacao(
    db: AsyncSession,
    convivente_id: str,
) -> date | None:
    candidatos: list[date] = []

    consultas = [
        (RegistroRotinaDB, RegistroRotinaDB.data_registro),
        (OcorrenciaConviventeDB, OcorrenciaConviventeDB.data_ocorrencia),
        (RegistroPIADB, RegistroPIADB.data_registro),
        (DocumentoConviventeDB, DocumentoConviventeDB.data_upload),
        (LavanderiaRegistroDB, LavanderiaRegistroDB.entregue_em),
    ]

    for modelo, coluna in consultas:
        minimo = (
            await db.execute(
                select(func.min(coluna)).where(modelo.convivente_id == convivente_id)
            )
        ).scalar()
        data_minima = _extrair_data(minimo)
        if data_minima:
            candidatos.append(data_minima)

    min_historico = (
        await db.execute(
            select(func.min(HistoricoConviventeDB.data_origem)).where(
                HistoricoConviventeDB.convivente_id == convivente_id
            )
        )
    ).scalar()
    data_historico = _extrair_data(min_historico)
    if data_historico:
        candidatos.append(data_historico)

    return min(candidatos) if candidatos else None


def data_inclusao_suspeita_legado(valor: date | None) -> bool:
    """Datas placeholder/corrompidas de importação legada (ex.: 01/01/2000, ano 0206)."""
    if valor is None:
        return False
    if valor == DATA_INCLUSAO_PLACEHOLDER_LEGADO:
        return True
    return valor.year < DATA_INCLUSAO_ANO_MINIMO_CONFIAVEL


def normalizar_data_inclusao_legado(valor: date | None) -> date | None:
    if data_inclusao_suspeita_legado(valor):
        return DATA_INCLUSAO_SUBSTITUTO_LEGADO
    return valor


def primeira_interacao_operacional(valor: date | None) -> date | None:
    """Ignora mínimos legados inválidos ao calcular vinculação pela 1ª interação."""
    if valor is None or data_inclusao_suspeita_legado(valor):
        return None
    return valor


def corrigir_data_inclusao_apos_primeira_interacao(
    data_inclusao: date | None,
    primeira_interacao: date | None,
) -> date | None:
    """Se a inclusão for posterior à 1ª interação, usa a data da interação."""
    if not data_inclusao or not primeira_interacao:
        return data_inclusao
    if data_inclusao > primeira_interacao:
        return primeira_interacao
    return data_inclusao


def data_vinculacao_efetiva_convivente(
    data_inclusao: date | None,
    data_entrada: date | None = None,
) -> date | None:
    return data_inclusao or data_entrada


def resolver_data_inclusao_coerente(
    data_inclusao: date | None,
    data_entrada: date | None,
    primeira_interacao: date | None,
) -> date | None:
    """Data de inclusão que deve persistir; None se já está coerente."""
    if data_inclusao and data_inclusao_suspeita_legado(data_inclusao):
        destino = DATA_INCLUSAO_SUBSTITUTO_LEGADO
        return destino if data_inclusao != destino else None

    primeira_util = primeira_interacao_operacional(primeira_interacao)
    if not primeira_util:
        return None

    vinculacao = data_vinculacao_efetiva_convivente(data_inclusao, data_entrada)
    if not vinculacao:
        return None

    corrigida = normalizar_data_inclusao_legado(
        corrigir_data_inclusao_apos_primeira_interacao(vinculacao, primeira_util)
    )
    if corrigida is None or data_inclusao == corrigida:
        return None
    return corrigida


async def _listar_conviventes_datas_cadastro(
    db: AsyncSession,
    *,
    instituicao_id: str | None = None,
) -> list[dict]:
    """Consulta mínima — compatível com schema online sem migrations pendentes."""
    sql = """
        SELECT id, instituicao_id, numero_institucional, nome_completo, status,
               data_inclusao, data_entrada
        FROM conviventes
    """
    params: dict = {}
    if instituicao_id:
        sql += " WHERE instituicao_id = :instituicao_id"
        params["instituicao_id"] = instituicao_id
    sql += " ORDER BY nome_completo ASC"

    resultado = await db.execute(text(sql), params)
    return [dict(linha._mapping) for linha in resultado]


async def _atualizar_data_inclusao_conviventes(
    db: AsyncSession,
    atualizacoes: dict[str, date],
) -> int:
    if not atualizacoes:
        return 0

    for convivente_id, nova_data in atualizacoes.items():
        await db.execute(
            text(
                "UPDATE conviventes SET data_inclusao = :data_inclusao WHERE id = :convivente_id"
            ),
            {"data_inclusao": nova_data, "convivente_id": convivente_id},
        )
    await db.commit()
    return len(atualizacoes)


async def listar_divergencias_data_inclusao(
    db: AsyncSession,
    *,
    instituicao_id: str | None = None,
) -> list[dict]:
    conviventes = await _listar_conviventes_datas_cadastro(db, instituicao_id=instituicao_id)
    divergencias: list[dict] = []

    for convivente in conviventes:
        primeira_interacao = await obter_data_primeira_interacao(db, convivente["id"])
        nova_inclusao = resolver_data_inclusao_coerente(
            convivente["data_inclusao"],
            convivente["data_entrada"],
            primeira_interacao,
        )
        if nova_inclusao is None:
            continue

        vinculacao = data_vinculacao_efetiva_convivente(
            convivente["data_inclusao"],
            convivente["data_entrada"],
        )
        divergencias.append(
            {
                "convivente_id": convivente["id"],
                "nome_completo": convivente["nome_completo"],
                "numero_institucional": convivente["numero_institucional"],
                "status": convivente["status"],
                "data_inclusao_atual": convivente["data_inclusao"],
                "data_entrada": convivente["data_entrada"],
                "vinculacao_efetiva": vinculacao,
                "primeira_interacao": primeira_interacao,
                "data_inclusao_corrigida": nova_inclusao,
            }
        )

    return divergencias


async def reconciliar_datas_inclusao_conviventes(
    db: AsyncSession,
    *,
    aplicar: bool = False,
    instituicao_id: str | None = None,
) -> dict:
    """Corrige data_inclusao em lote para todos os conviventes com divergência."""
    divergencias = await listar_divergencias_data_inclusao(db, instituicao_id=instituicao_id)
    if not aplicar or not divergencias:
        return {
            "aplicar": aplicar,
            "divergentes": len(divergencias),
            "corrigidos": 0,
            "registros": divergencias,
        }

    por_id = {
        item["convivente_id"]: item["data_inclusao_corrigida"] for item in divergencias
    }
    corrigidos = await _atualizar_data_inclusao_conviventes(db, por_id)
    return {
        "aplicar": True,
        "divergentes": len(divergencias),
        "corrigidos": corrigidos,
        "registros": divergencias,
    }


async def corrigir_datas_inclusao_suspeitas_legado(
    db: AsyncSession,
    *,
    aplicar: bool = False,
    instituicao_id: str | None = None,
) -> dict:
    """Substitui data_inclusao placeholder/corrompida (2000-01-01 ou ano < 1990) por 2020-01-01."""
    conviventes = await _listar_conviventes_datas_cadastro(db, instituicao_id=instituicao_id)
    afetados = [
        conv
        for conv in conviventes
        if data_inclusao_suspeita_legado(conv["data_inclusao"])
    ]

    registros = [
        {
            "convivente_id": conv["id"],
            "numero_institucional": conv["numero_institucional"],
            "nome_completo": conv["nome_completo"],
            "data_inclusao_anterior": conv["data_inclusao"],
        }
        for conv in afetados[:50]
    ]

    if aplicar and afetados:
        por_id = {conv["id"]: DATA_INCLUSAO_SUBSTITUTO_LEGADO for conv in afetados}
        await _atualizar_data_inclusao_conviventes(db, por_id)

    return {
        "aplicar": aplicar,
        "suspeitos": len(afetados),
        "corrigidos": len(afetados) if aplicar else 0,
        "registros": registros,
    }


async def ajustar_data_inclusao_convivente(
    db: AsyncSession,
    convivente_id: str | None,
    data_inclusao: date | None,
    data_entrada: date | None = None,
) -> date | None:
    if not convivente_id:
        return data_inclusao

    primeira_interacao = await obter_data_primeira_interacao(db, convivente_id)
    corrigida = resolver_data_inclusao_coerente(
        data_inclusao,
        data_entrada,
        primeira_interacao,
    )
    if corrigida is not None:
        return corrigida
    if data_inclusao:
        return data_inclusao
    return data_vinculacao_efetiva_convivente(data_inclusao, data_entrada)


async def registrar_historico_inativacao(
    db: AsyncSession,
    *,
    instituicao_id: str,
    convivente_id: str,
    usuario_id: str,
    data_inativacao: date,
    descricao: str,
) -> bool:
    """Grava a data de inativação no histórico do prontuário (idempotente por data)."""
    existente = (
        await db.execute(
            select(HistoricoConviventeDB.id).where(
                HistoricoConviventeDB.convivente_id == convivente_id,
                HistoricoConviventeDB.titulo == TITULO_HISTORICO_INATIVACAO,
                HistoricoConviventeDB.data_origem == data_inativacao,
            ).limit(1)
        )
    ).scalar_one_or_none()
    if existente:
        return False

    db.add(
        HistoricoConviventeDB(
            instituicao_id=instituicao_id,
            convivente_id=convivente_id,
            usuario_id=usuario_id,
            origem_informacao=ORIGEM_HISTORICO_INATIVACAO,
            data_origem=data_inativacao,
            titulo=TITULO_HISTORICO_INATIVACAO,
            descricao=descricao,
        )
    )
    return True


async def listar_datas_inativacao_historico(
    db: AsyncSession,
    convivente_id: str,
    data_inativacao_atual: date | None = None,
) -> list[date]:
    """Datas de inativação arquivadas + data operacional atual (se houver)."""
    rows = (
        await db.execute(
            select(HistoricoConviventeDB.data_origem)
            .where(
                HistoricoConviventeDB.convivente_id == convivente_id,
                HistoricoConviventeDB.titulo == TITULO_HISTORICO_INATIVACAO,
            )
            .order_by(HistoricoConviventeDB.data_origem.desc())
        )
    ).scalars().all()

    datas: list[date] = []
    vistos: set[date] = set()
    for valor in rows:
        data = _extrair_data(valor)
        if data and data not in vistos:
            vistos.add(data)
            datas.append(data)

    atual = _extrair_data(data_inativacao_atual)
    if atual and atual not in vistos:
        datas.append(atual)
        datas.sort(reverse=True)

    return datas
