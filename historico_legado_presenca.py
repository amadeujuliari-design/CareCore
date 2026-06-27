"""Relatório matricial de presenças importadas na rotina legada (somente dias com registro)."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from presenca_operacional import MAX_DIAS_RELATORIO_PRESENCA, listar_dias_periodo

SERVICO_PRESENCA_LEGADO = "PRESENCA - RELATORIO MENSAL SIAT"
ID_SERVICO_PRESENCA_LEGADO = "PRESENCA_PDF_MENSAL"
STATUS_DIA_PRESENTE_LEGADO = "presente"
STATUS_DIA_SEM_REGISTRO_LEGADO = "sem_registro"


@dataclass
class _GrupoPresencaLegado:
    chave: str
    nome: str = ""
    numero_sisa: str | None = None
    convivente_id: str | None = None
    prontuario: str | None = None
    origem_arquivo: str | None = None
    dias_presentes: set[str] = field(default_factory=set)


def registro_e_presenca_legado(
    *,
    servico_prestado: str | None,
    id_servico_prestado_legado: str | None,
) -> bool:
    if id_servico_prestado_legado == ID_SERVICO_PRESENCA_LEGADO:
        return True
    servico = (servico_prestado or "").strip().upper()
    return servico == SERVICO_PRESENCA_LEGADO.upper()


def chave_agrupamento_pessoa_legado(
    *,
    chave_natural_convivente: str | None,
    id_as_atendimento_legado: str | None,
    numero_sisa: str | None,
    nome_convivente: str | None,
) -> str:
    natural = (chave_natural_convivente or "").strip()
    if natural:
        return natural
    if id_as_atendimento_legado:
        return id_as_atendimento_legado
    sisa = (numero_sisa or "").strip()
    nome = (nome_convivente or "").strip().upper()
    return f"{sisa}|{nome}" if sisa or nome else "desconhecido"


def montar_relatorio_presenca_legado(
  linhas_brutas: list[dict],
  *,
  data_inicio: date,
  data_fim: date,
  busca: str | None = None,
) -> dict:
    dias_periodo = listar_dias_periodo(data_inicio, data_fim)
    if len(dias_periodo) > MAX_DIAS_RELATORIO_PRESENCA:
        raise ValueError(f"periodo_maximo_{MAX_DIAS_RELATORIO_PRESENCA}")

    dias_iso = [dia.isoformat() for dia in dias_periodo]
    grupos: dict[str, _GrupoPresencaLegado] = {}
    termo_busca = (busca or "").strip().lower()

    for item in linhas_brutas:
        if not registro_e_presenca_legado(
            servico_prestado=item.get("servico_prestado"),
            id_servico_prestado_legado=item.get("id_servico_prestado_legado"),
        ):
            continue

        data_servico = item.get("data_servico")
        if not isinstance(data_servico, date):
            continue
        if data_servico < data_inicio or data_servico > data_fim:
            continue

        chave = chave_agrupamento_pessoa_legado(
            chave_natural_convivente=item.get("chave_natural_convivente"),
            id_as_atendimento_legado=item.get("id_as_atendimento_legado"),
            numero_sisa=item.get("numero_sisa"),
            nome_convivente=item.get("nome_convivente"),
        )
        grupo = grupos.get(chave)
        if not grupo:
            grupo = _GrupoPresencaLegado(
                chave=chave,
                nome=(item.get("nome_convivente") or "Não identificado no legado").strip(),
                numero_sisa=item.get("numero_sisa"),
                convivente_id=item.get("convivente_id"),
                prontuario=(
                    str(item["numero_institucional"])
                    if item.get("numero_institucional") is not None
                    else None
                ),
                origem_arquivo=item.get("origem_arquivo"),
            )
            grupos[chave] = grupo

        if item.get("nome_convivente") and not grupo.nome:
            grupo.nome = item["nome_convivente"]
        if item.get("numero_sisa") and not grupo.numero_sisa:
            grupo.numero_sisa = item["numero_sisa"]
        if item.get("convivente_id") and not grupo.convivente_id:
            grupo.convivente_id = item["convivente_id"]
        if item.get("numero_institucional") is not None and not grupo.prontuario:
            grupo.prontuario = str(item["numero_institucional"])
        if item.get("origem_arquivo") and not grupo.origem_arquivo:
            grupo.origem_arquivo = item["origem_arquivo"]

        grupo.dias_presentes.add(data_servico.isoformat())

    linhas = []
    total_presencas = 0

    for grupo in sorted(grupos.values(), key=lambda g: (g.nome or "").upper()):
        if termo_busca:
            campos = [
                (grupo.nome or "").lower(),
                (grupo.numero_sisa or "").lower(),
                (grupo.prontuario or "").lower(),
            ]
            if not any(termo_busca in campo for campo in campos if campo):
                continue

        dias = {
            dia: (
                STATUS_DIA_PRESENTE_LEGADO
                if dia in grupo.dias_presentes
                else STATUS_DIA_SEM_REGISTRO_LEGADO
            )
            for dia in dias_iso
        }
        presentes = len(grupo.dias_presentes)
        total_presencas += presentes

        linhas.append(
            {
                "pessoa_legado_id": grupo.chave,
                "convivente_id": grupo.convivente_id,
                "nome": grupo.nome,
                "numero_sisa": grupo.numero_sisa,
                "prontuario": grupo.prontuario,
                "origem_arquivo": grupo.origem_arquivo,
                "dias": dias,
                "totais": {"presentes": presentes},
            }
        )

    return {
        "data_inicio": data_inicio.isoformat(),
        "data_fim": data_fim.isoformat(),
        "dias": dias_iso,
        "total_pessoas": len(linhas),
        "resumo": {
            "pessoas": len(linhas),
            "presentes": total_presencas,
        },
        "linhas": linhas,
    }
