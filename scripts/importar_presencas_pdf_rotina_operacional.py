"""
Importa presenças do PDF mensal SIAT para registros operacionais (Entrada/Saída).

Uso:
  python scripts/importar_presencas_pdf_rotina_operacional.py --dry-run \\
    --pdf "%USERPROFILE%\\Downloads\\Presencas Junho.pdf" --mes 6 --ano 2026 \\
    --report relatorios_importacao/presencas_jun2026_dryrun.csv

  python scripts/importar_presencas_pdf_rotina_operacional.py --yes \\
    --pdf "%USERPROFILE%\\Downloads\\Presencas Junho.pdf" --mes 6 --ano 2026 \\
    --report relatorios_importacao/presencas_jun2026_aplicado.csv

  python scripts/importar_presencas_pdf_rotina_operacional.py --reconciliar-junho \\
    --pdf "%USERPROFILE%\\Downloads\\Presencas Junho.pdf" --mes 6 --ano 2026 \\
    --report relatorios_importacao/presencas_jun2026_reconciliacao_dryrun.csv
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, func, or_, select

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from database import carregar_env_local
from models import ConviventeDB, InstituicaoDB, RegistroRotinaDB, UsuarioDB
from presenca_operacional import montar_status_presenca_por_dia
from presencas_pdf_reconciliacao import (
    contar_presencas_pdf,
    dias_pdf_no_periodo,
    dias_protegidos_para_importacao,
    montar_atualizacao_cadastro_pdf,
    montar_atualizacao_fora_pdf,
    planejar_correcoes_ausencia_pdf,
    planejar_complemento_presenca_pdf,
    simular_presencas_carecore_apos_plano,
)
from presencas_pdf_operacional_plan import (
    OBSERVACAO_IMPORT,
    STATUS_AJ,
    STATUS_ATIVO,
    STATUS_INATIVADO,
    MovimentoPlano,
    carecore_tem_presenca_computada,
    chave_movimento,
    construir_blocos_consecutivos,
    decidir_dias_presentes_importar,
    definir_status_final,
    escolher_melhor_candidato_sisa,
    normalizar_digits,
    planejar_movimentos_convivente,
    precisa_retroagir_datas,
    status_carecore_no_dia,
)
from scripts.importar_presencas_pdf_rotina_legada import (
    LinhaRejeitada,
    PresencaPessoa,
    extrair_linhas_pdf,
    normalizar_database_url,
    normalizar_texto,
    parse_data_br,
    encontrar_inicio_linha,
    RE_DATA_NASCIMENTO,
    RE_FINAL,
)
from time_operacional import agora_operacional_naive

DEFAULT_DATABASE_URL = "sqlite:///carecore_aeb.db"
DEFAULT_REPORT_DIR = ROOT_DIR / "relatorios_importacao"
DATA_VINCULACAO_PADRAO = date(2026, 6, 1)
DIA_LIMITE_PADRAO = 25

MESES_NOME = {
    "janeiro": 1,
    "fevereiro": 2,
    "marco": 3,
    "março": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}


@dataclass
class ConviventeRegistro:
    id: str
    nome_completo: str
    nome_mae: str | None
    data_nascimento: date | None
    numero_sisa: str | None
    numero_institucional: int | None
    rg: str | None
    status: str
    data_entrada: date | None
    data_inclusao: date | None
    data_inativacao: date | None
    ausencia_justificada_desde: date | None


def normalizar_nome(valor: str | None) -> str:
    texto = unicodedata.normalize("NFD", normalizar_texto(valor))
    texto = "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")
    texto = re.sub(r"[^A-Za-z0-9 ]+", " ", texto).upper()
    return re.sub(r"\s+", " ", texto).strip()


def resolver_mes_ano(path: Path, mes: int | None, ano: int | None) -> tuple[int, int]:
    if mes and ano:
        return ano, mes

    stem = path.stem.lower()
    for nome, numero in MESES_NOME.items():
        if nome in stem:
            ano_resolvido = ano or 2026
            return ano_resolvido, numero

    match = re.search(r"(?P<mes>\d{2})-(?P<ano>\d{2})", stem)
    if match:
        return 2000 + int(match.group("ano")), int(match.group("mes"))

    raise ValueError(
        f"Informe --mes e --ano para o arquivo {path.name} (ex.: --mes 6 --ano 2026)."
    )


def parse_linha_presenca_com_mes(
    path: Path,
    linha_origem: int,
    texto: str,
    ano: int,
    mes: int,
) -> tuple[PresencaPessoa | None, LinhaRejeitada | None]:
    if "Orgsystem Software" in texto or texto.startswith("ASSOCIACAO EVANGELICA"):
        return None, None
    if texto.startswith("PRESENCAS:") or texto.startswith("Nome Data nasc."):
        return None, None
    if texto.startswith("AJ ="):
        return None, None
    if not RE_DATA_NASCIMENTO.search(texto):
        return None, None

    match_data = RE_DATA_NASCIMENTO.search(texto)
    assert match_data is not None

    antes_data = normalizar_texto(texto[: match_data.start()])
    depois_data = normalizar_texto(texto[match_data.end() :])

    match_final = RE_FINAL.match(depois_data)
    if not match_final:
        return None, LinhaRejeitada(path.name, linha_origem, "final_nao_parseado", texto)

    total_pdf = int(match_final.group("total"))
    inicio = encontrar_inicio_linha(antes_data, total_pdf)
    if not inicio:
        return None, LinhaRejeitada(path.name, linha_origem, "inicio_nao_parseado", texto)

    rg, dias, nome = inicio
    if len(dias) != total_pdf:
        return None, LinhaRejeitada(
            path.name,
            linha_origem,
            f"total_divergente_pdf_{total_pdf}_dias_{len(dias)}",
            texto,
        )

    ultimo_dia_mes = (date(ano + (mes // 12), (mes % 12) + 1, 1) - timedelta(days=1)).day
    if any(dia > ultimo_dia_mes for dia in dias):
        return None, LinhaRejeitada(path.name, linha_origem, "dia_invalido_para_mes", texto)

    return (
        PresencaPessoa(
            arquivo=path.name,
            linha_origem=linha_origem,
            ano=ano,
            mes=mes,
            rg=rg,
            dias=dias,
            nome=nome,
            data_nascimento=parse_data_br(match_data.group(0)),
            nome_mae=normalizar_texto(match_final.group("mae")),
            sexo=match_final.group("sexo"),
            numero_sisa=match_final.group("sisa") or None,
            total_pdf=total_pdf,
            ausencia_justificada=bool(match_final.group("aj")),
            texto_original=texto,
        ),
        None,
    )


def extrair_pessoas_pdf(path: Path, ano: int, mes: int) -> tuple[list[PresencaPessoa], list[LinhaRejeitada]]:
    pessoas: list[PresencaPessoa] = []
    rejeitadas: list[LinhaRejeitada] = []
    for indice, texto in enumerate(extrair_linhas_pdf(path), start=1):
        pessoa, rejeitada = parse_linha_presenca_com_mes(path, indice, texto, ano, mes)
        if pessoa:
            pessoas.append(pessoa)
        if rejeitada:
            rejeitadas.append(rejeitada)
    return pessoas, rejeitadas


def carregar_conviventes(engine, instituicao_id: str) -> list[ConviventeRegistro]:
    tabela = ConviventeDB.__table__
    with engine.connect() as conn:
        linhas = conn.execute(
            select(
                tabela.c.id,
                tabela.c.nome_completo,
                tabela.c.nome_mae,
                tabela.c.data_nascimento,
                tabela.c.numero_sisa,
                tabela.c.numero_institucional,
                tabela.c.rg,
                tabela.c.status,
                tabela.c.data_entrada,
                tabela.c.data_inclusao,
                tabela.c.data_inativacao,
                tabela.c.ausencia_justificada_desde,
            ).where(tabela.c.instituicao_id == instituicao_id)
        ).fetchall()

    return [
        ConviventeRegistro(
            id=str(linha.id),
            nome_completo=linha.nome_completo,
            nome_mae=linha.nome_mae,
            data_nascimento=linha.data_nascimento,
            numero_sisa=linha.numero_sisa,
            numero_institucional=linha.numero_institucional,
            rg=linha.rg,
            status=linha.status,
            data_entrada=linha.data_entrada,
            data_inclusao=linha.data_inclusao,
            data_inativacao=linha.data_inativacao,
            ausencia_justificada_desde=linha.ausencia_justificada_desde,
        )
        for linha in linhas
    ]


def match_convivente(
    conviventes: list[ConviventeRegistro],
    pessoa: PresencaPessoa,
) -> tuple[ConviventeRegistro | None, str]:
    if pessoa.numero_sisa:
        sisa_pdf = normalizar_digits(pessoa.numero_sisa)
        por_sisa = [
            item
            for item in conviventes
            if normalizar_digits(item.numero_sisa) == sisa_pdf
        ]
        if len(por_sisa) == 1:
            return por_sisa[0], "sisa_exato"
        if len(por_sisa) > 1:
            return escolher_melhor_candidato_sisa(por_sisa)

    nome_pdf = normalizar_nome(pessoa.nome)
    mae_pdf = normalizar_nome(pessoa.nome_mae)
    candidatos = [
        item
        for item in conviventes
        if normalizar_nome(item.nome_completo) == nome_pdf
        and item.data_nascimento == pessoa.data_nascimento
    ]
    if mae_pdf:
        com_mae = [
            item for item in candidatos if normalizar_nome(item.nome_mae) == mae_pdf
        ]
        if len(com_mae) == 1:
            return com_mae[0], "nome_nasc_mae"
        if len(com_mae) > 1:
            return None, "nome_nasc_mae_ambiguo"

    if len(candidatos) == 1:
        return candidatos[0], "nome_nasc_parcial"

    if len(candidatos) > 1:
        return None, "nome_nasc_ambiguo"

    return None, "nao_encontrado"


def proximo_numero_institucional(engine, instituicao_id: str) -> int:
    tabela = ConviventeDB.__table__
    with engine.connect() as conn:
        atual = conn.execute(
            select(func.max(tabela.c.numero_institucional)).where(
                tabela.c.instituicao_id == instituicao_id
            )
        ).scalar()
    return int(atual or 0) + 1


def obter_usuario_manutencao(engine, instituicao_id: str) -> str:
    tabela = UsuarioDB.__table__
    with engine.connect() as conn:
        usuario = conn.execute(
            select(tabela.c.id)
            .where(
                tabela.c.instituicao_id == instituicao_id,
                tabela.c.ativo == True,  # noqa: E712
                or_(
                    func.lower(tabela.c.nome).contains("manuten"),
                    func.lower(tabela.c.perfil_acesso).contains("manuten"),
                ),
            )
            .order_by(tabela.c.nome.asc())
            .limit(1)
        ).scalar()
    if not usuario:
        raise SystemExit(
            "Usuario Manutencao nao encontrado na instituicao. "
            "Crie ou informe --usuario-id."
        )
    return str(usuario)


def obter_instituicao_id(engine, instituicao_id: str | None) -> str:
    if instituicao_id:
        return instituicao_id

    tabela = InstituicaoDB.__table__
    with engine.connect() as conn:
        ids = [
            str(linha[0])
            for linha in conn.execute(select(tabela.c.id).order_by(tabela.c.nome_fantasia)).fetchall()
        ]
    if not ids:
        raise SystemExit("Nenhuma instituicao encontrada.")
    if len(ids) > 1:
        raise SystemExit("Informe --instituicao-id (ha mais de uma instituicao).")
    return ids[0]


def carregar_movimentos_por_convivente(
    engine,
    instituicao_id: str,
    convivente_ids: list[str],
    fim: datetime,
) -> dict[str, list[dict]]:
    if not convivente_ids:
        return {}

    tabela = RegistroRotinaDB.__table__
    resultado: dict[str, list[dict]] = {}
    with engine.connect() as conn:
        linhas = conn.execute(
            select(
                tabela.c.convivente_id,
                tabela.c.tipo_registro,
                tabela.c.data_registro,
                tabela.c.observacao,
            )
            .where(
                tabela.c.instituicao_id == instituicao_id,
                tabela.c.cancelado != True,  # noqa: E712
                tabela.c.convivente_id.in_(convivente_ids),
                tabela.c.tipo_registro.in_(("Entrada", "Saída")),
                tabela.c.data_registro <= fim,
            )
            .order_by(tabela.c.data_registro.asc())
        ).fetchall()

    for convivente_id, tipo_registro, data_registro, observacao in linhas:
        resultado.setdefault(str(convivente_id), []).append(
            {
                "tipo_registro": tipo_registro,
                "data_registro": data_registro,
                "observacao": observacao,
            }
        )
    return resultado


def separar_movimentos_reais(movimentos: list[dict]) -> list[dict]:
    return [
        movimento
        for movimento in movimentos
        if not (movimento.get("observacao") or "").startswith(OBSERVACAO_IMPORT)
    ]


def carregar_chaves_import_existentes(engine, instituicao_id: str) -> set[str]:
    tabela = RegistroRotinaDB.__table__
    chaves: set[str] = set()
    with engine.connect() as conn:
        linhas = conn.execute(
            select(
                tabela.c.convivente_id,
                tabela.c.tipo_registro,
                tabela.c.data_registro,
            ).where(
                tabela.c.instituicao_id == instituicao_id,
                tabela.c.cancelado != True,  # noqa: E712
                tabela.c.observacao.like(f"{OBSERVACAO_IMPORT}%"),
            )
        ).fetchall()

    for convivente_id, tipo_registro, data_registro in linhas:
        chaves.add(
            chave_movimento(str(convivente_id), tipo_registro, data_registro)
        )
    return chaves


def data_vinculacao_convivente(convivente: ConviventeRegistro) -> date | None:
    return convivente.data_inclusao or convivente.data_entrada


def montar_planos(
    pessoas: list[PresencaPessoa],
    conviventes: list[ConviventeRegistro],
    movimentos_por_id: dict[str, list[dict]],
    chaves_existentes: set[str],
    *,
    ano: int,
    mes: int,
    dia_limite: int,
    dias_protegidos: set[date],
    data_vinculacao_alvo: date,
    reconciliar: bool = False,
) -> tuple[list[dict[str, Any]], list[ConviventeRegistro]]:
    novos_conviventes: list[ConviventeRegistro] = []
    linhas_relatorio: list[dict[str, Any]] = []
    conviventes_mutaveis = list(conviventes)

    for pessoa in pessoas:
        convivente, acao_match = match_convivente(conviventes_mutaveis, pessoa)
        presenca_dia_25 = 25 in pessoa.dias
        status_final, aplicar_aj = definir_status_final(
            presenca_dia_25=presenca_dia_25,
            ausencia_justificada_pdf=pessoa.ausencia_justificada,
        )

        if convivente is None and acao_match.endswith("ambiguo"):
            linhas_relatorio.append(
                {
                    "tipo": "erro_match",
                    "nome_pdf": pessoa.nome,
                    "numero_sisa": pessoa.numero_sisa,
                    "acao": acao_match,
                    "detalhe": pessoa.texto_original[:200],
                }
            )
            continue

        criado = False
        if convivente is None:
            convivente = ConviventeRegistro(
                id=str(uuid.uuid4()),
                nome_completo=pessoa.nome,
                nome_mae=pessoa.nome_mae,
                data_nascimento=pessoa.data_nascimento,
                numero_sisa=pessoa.numero_sisa,
                numero_institucional=None,
                rg=pessoa.rg,
                status=status_final,
                data_entrada=data_vinculacao_alvo,
                data_inclusao=data_vinculacao_alvo,
                data_inativacao=None,
                ausencia_justificada_desde=None,
            )
            conviventes_mutaveis.append(convivente)
            novos_conviventes.append(convivente)
            acao_match = "criar_convivente"
            criado = True

        movimentos_todos = movimentos_por_id.get(convivente.id, [])
        movimentos_reais = separar_movimentos_reais(movimentos_todos)
        vinculacao = data_vinculacao_alvo if criado else (data_vinculacao_convivente(convivente) or data_vinculacao_alvo)

        status_para_calculo = convivente.status
        aj_desde = convivente.ausencia_justificada_desde
        usar_somente_aj = criado and aplicar_aj and not presenca_dia_25
        if usar_somente_aj:
            status_para_calculo = STATUS_AJ
            aj_desde = data_vinculacao_alvo

        dias_pdf = set(pessoa.dias)
        if reconciliar:
            dias_importar = dias_pdf_no_periodo(
                dias_pdf,
                dia_limite=dia_limite,
                dias_protegidos=dias_protegidos,
                ano=ano,
                mes=mes,
            )
        else:
            dias_importar = decidir_dias_presentes_importar(
                ano=ano,
                mes=mes,
                dias_pdf=dias_pdf,
                dia_limite_importacao=dia_limite,
                dias_protegidos=dias_protegidos,
                movimentos_reais=movimentos_reais,
                data_vinculacao=vinculacao,
                data_inativacao=convivente.data_inativacao,
                status_convivente=status_para_calculo,
                ausencia_justificada_desde=aj_desde,
            )

        dia_25 = date(ano, mes, 25)
        tem_fluxo_real_25 = any(
            movimento["data_registro"].date() == dia_25
            for movimento in movimentos_reais
        )
        if not reconciliar and 25 in dias_importar and tem_fluxo_real_25:
            dias_importar.discard(25)

        retroagir = precisa_retroagir_datas(
            convivente.data_inclusao,
            convivente.data_entrada,
            data_vinculacao_alvo,
        ) or criado

        movimentos_plano: list[MovimentoPlano] = []
        cadastro_reconciliacao: dict[str, Any] | None = None
        if not usar_somente_aj:
            movimentos_plano = planejar_movimentos_convivente(
                convivente_id=convivente.id,
                ano=ano,
                mes=mes,
                dias_importar=dias_importar,
                dia_limite_importacao=dia_limite,
                presenca_dia_25=presenca_dia_25,
                respeitar_dentro_no_25=not tem_fluxo_real_25,
                chaves_existentes=chaves_existentes,
            )

        if reconciliar and not usar_somente_aj:
            cadastro_reconciliacao = montar_atualizacao_cadastro_pdf(
                presenca_dia_25=presenca_dia_25,
                ausencia_justificada_pdf=pessoa.ausencia_justificada,
                dias_pdf=dias_pdf,
                ano=ano,
                mes=mes,
                dia_limite=dia_limite,
                data_vinculacao_alvo=data_vinculacao_alvo,
                retroagir=retroagir,
            )
            movimentos_plano.extend(
                planejar_correcoes_ausencia_pdf(
                    convivente_id=convivente.id,
                    ano=ano,
                    mes=mes,
                    dias_pdf=dias_pdf,
                    dia_limite=dia_limite,
                    dias_protegidos=dias_protegidos,
                    movimentos_existentes=movimentos_todos,
                    movimentos_plano=movimentos_plano,
                    data_vinculacao=cadastro_reconciliacao.get("data_inclusao") or vinculacao,
                    data_inativacao=cadastro_reconciliacao.get("data_inativacao"),
                    status_convivente=cadastro_reconciliacao["status"],
                    ausencia_justificada_desde=cadastro_reconciliacao.get(
                        "ausencia_justificada_desde"
                    ),
                    chaves_existentes=chaves_existentes,
                )
            )
            movimentos_plano.extend(
                planejar_complemento_presenca_pdf(
                    convivente_id=convivente.id,
                    ano=ano,
                    mes=mes,
                    dias_pdf=dias_pdf,
                    dia_limite=dia_limite,
                    presenca_dia_25=presenca_dia_25,
                    movimentos_existentes=movimentos_todos,
                    movimentos_plano=movimentos_plano,
                    data_vinculacao=cadastro_reconciliacao.get("data_inclusao") or vinculacao,
                    data_inativacao=cadastro_reconciliacao.get("data_inativacao"),
                    status_convivente=cadastro_reconciliacao["status"],
                    ausencia_justificada_desde=cadastro_reconciliacao.get(
                        "ausencia_justificada_desde"
                    ),
                    chaves_existentes=chaves_existentes,
                )
            )

        for numero_dia in range(1, dia_limite + 1):
            dia = date(ano, mes, numero_dia)
            status_cc = status_carecore_no_dia(
                movimentos_reais,
                dia,
                data_vinculacao=vinculacao,
                data_inativacao=convivente.data_inativacao,
                status_convivente=status_para_calculo,
                ausencia_justificada_desde=aj_desde,
            )
            pdf_presente = numero_dia in dias_pdf
            acao_dia = "manter_carecore"
            if dia in dias_protegidos and carecore_tem_presenca_computada(status_cc):
                acao_dia = "protegido_carecore"
            elif numero_dia in dias_importar:
                acao_dia = "importar_presente"
            elif usar_somente_aj and not pdf_presente and dia >= data_vinculacao_alvo:
                acao_dia = "aj_cadastro"
            elif pdf_presente and carecore_tem_presenca_computada(status_cc):
                acao_dia = "manter_carecore"
            elif pdf_presente and status_cc == "ausente":
                acao_dia = "importar_presente_prevalece_pdf"
            elif reconciliar and not pdf_presente and status_cc == "presente":
                acao_dia = "corrigir_ausencia_pdf"

            linhas_relatorio.append(
                {
                    "tipo": "dia",
                    "convivente_id": convivente.id,
                    "nome_pdf": pessoa.nome,
                    "numero_sisa": pessoa.numero_sisa or "",
                    "dia": dia.isoformat(),
                    "pdf_presente": "sim" if pdf_presente else "nao",
                    "status_carecore_antes": status_cc,
                    "acao": acao_dia,
                    "match": acao_match,
                    "movimentos_novos": len(movimentos_plano),
                }
            )

        linhas_relatorio.append(
            {
                "tipo": "convivente",
                "convivente_id": convivente.id,
                "nome_pdf": pessoa.nome,
                "numero_sisa": pessoa.numero_sisa or "",
                "acao": acao_match,
                "status_final": status_final,
                "retroagir_datas": "sim" if retroagir else "nao",
                "aplicar_aj": "sim" if usar_somente_aj else "nao",
                "dias_importar": ",".join(f"{dia:02d}" for dia in sorted(dias_importar)),
                "blocos": str(construir_blocos_consecutivos(dias_importar)),
                "movimentos_novos": len(movimentos_plano),
                "detalhe": "",
            }
        )

        linhas_relatorio.append(
            {
                "tipo": "plano_movimentos",
                "convivente_id": convivente.id,
                "nome_pdf": pessoa.nome,
                "movimentos": movimentos_plano,
                "status_final": status_final,
                "retroagir": retroagir,
                "aplicar_aj": usar_somente_aj,
                "enriquecer": acao_match in {"nome_nasc_parcial", "nome_nasc_mae", "sisa_exato"},
                "pessoa": pessoa,
                "convivente": convivente,
                "criado": criado,
                "cadastro_reconciliacao": cadastro_reconciliacao,
                "reconciliar": reconciliar,
            }
        )

    if reconciliar:
        pdf_ids = {
            linha["convivente"].id
            for linha in linhas_relatorio
            if linha["tipo"] == "plano_movimentos"
        }
        for convivente in conviventes_mutaveis:
            if convivente.id in pdf_ids:
                continue
            atualizacao = montar_atualizacao_fora_pdf(convivente)
            if not atualizacao:
                continue
            linhas_relatorio.append(
                {
                    "tipo": "plano_fora_pdf",
                    "convivente_id": convivente.id,
                    "nome_pdf": convivente.nome_completo,
                    "cadastro_reconciliacao": atualizacao,
                    "convivente": convivente,
                    "detalhe": "fora do PDF jun/2026",
                }
            )

    return linhas_relatorio, novos_conviventes


def enriquecer_convivente(convivente: ConviventeRegistro, pessoa: PresencaPessoa) -> dict[str, Any]:
    dados: dict[str, Any] = {}
    if pessoa.numero_sisa and not convivente.numero_sisa:
        dados["numero_sisa"] = pessoa.numero_sisa
    if pessoa.rg and not convivente.rg:
        dados["rg"] = pessoa.rg
    if pessoa.nome_mae and not convivente.nome_mae:
        dados["nome_mae"] = pessoa.nome_mae
    return dados


def aplicar_importacao(
    engine,
    instituicao_id: str,
    usuario_id: str,
    linhas_relatorio: list[dict[str, Any]],
    data_vinculacao_alvo: date,
) -> dict[str, int]:
    tabela_conv = ConviventeDB.__table__
    tabela_rotina = RegistroRotinaDB.__table__
    contadores = {
        "conviventes_criados": 0,
        "conviventes_atualizados": 0,
        "movimentos_inseridos": 0,
        "fora_pdf_atualizados": 0,
    }

    proximo_prontuario = proximo_numero_institucional(engine, instituicao_id)

    with engine.begin() as conn:
        for linha in linhas_relatorio:
            if linha["tipo"] == "plano_fora_pdf":
                atualizacao = dict(linha["cadastro_reconciliacao"])
                set_clause = ", ".join(f"{campo} = :{campo}" for campo in atualizacao)
                conn.execute(
                    tabela_conv.update()
                    .where(tabela_conv.c.id == linha["convivente_id"])
                    .values(**atualizacao)
                )
                contadores["fora_pdf_atualizados"] += 1
                continue

            if linha["tipo"] != "plano_movimentos":
                continue

            pessoa: PresencaPessoa = linha["pessoa"]
            convivente: ConviventeRegistro = linha["convivente"]
            criado: bool = linha["criado"]

            if criado:
                valores = {
                    "id": convivente.id,
                    "instituicao_id": instituicao_id,
                    "numero_institucional": proximo_prontuario,
                    "status": linha["status_final"],
                    "nome_completo": convivente.nome_completo,
                    "nome_mae": convivente.nome_mae,
                    "data_nascimento": convivente.data_nascimento,
                    "numero_sisa": convivente.numero_sisa,
                    "rg": convivente.rg,
                    "data_entrada": data_vinculacao_alvo,
                    "data_inclusao": data_vinculacao_alvo,
                    "ausencia_justificada_desde": None,
                    "possui_renda": False,
                    "egresso_prisional": False,
                    "usa_tornozeleira": False,
                    "tem_mandado_prisao": False,
                    "preferencial": False,
                }
                colunas = {col.name for col in tabela_conv.columns}
                valores = {chave: valor for chave, valor in valores.items() if chave in colunas}
                conn.execute(tabela_conv.insert(), valores)
                contadores["conviventes_criados"] += 1
                proximo_prontuario += 1
            else:
                atualizacao: dict[str, Any] = {}
                if linha.get("cadastro_reconciliacao"):
                    atualizacao.update(linha["cadastro_reconciliacao"])
                elif linha["retroagir"]:
                    atualizacao["data_entrada"] = data_vinculacao_alvo
                    atualizacao["data_inclusao"] = data_vinculacao_alvo
                atualizacao.update(enriquecer_convivente(convivente, pessoa))
                if atualizacao:
                    set_clause = ", ".join(f"{campo} = :{campo}" for campo in atualizacao)
                    conn.execute(
                        tabela_conv.update()
                        .where(tabela_conv.c.id == convivente.id)
                        .values(**atualizacao)
                    )
                    contadores["conviventes_atualizados"] += 1

            movimentos: list[MovimentoPlano] = linha["movimentos"]
            if movimentos:
                registros = [
                    {
                        "id": str(uuid.uuid4()),
                        "instituicao_id": instituicao_id,
                        "convivente_id": convivente.id,
                        "usuario_id": usuario_id,
                        "tipo_registro": movimento.tipo_registro,
                        "observacao": movimento.observacao,
                        "data_registro": movimento.data_registro,
                        "retorno_rapido": False,
                        "cancelado": False,
                        "foi_editado": False,
                    }
                    for movimento in movimentos
                ]
                conn.execute(tabela_rotina.insert(), registros)
                contadores["movimentos_inseridos"] += len(registros)

    return contadores


def escrever_relatorio_csv(path: Path, linhas: list[dict[str, Any]], rejeitadas: list[LinhaRejeitada]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as arquivo:
        writer = csv.writer(arquivo, delimiter=";")
        writer.writerow(
            [
                "tipo",
                "convivente_id",
                "nome_pdf",
                "numero_sisa",
                "dia",
                "pdf_presente",
                "status_carecore_antes",
                "acao",
                "match",
                "status_final",
                "retroagir_datas",
                "dias_importar",
                "movimentos_novos",
                "detalhe",
            ]
        )
        for linha in linhas:
            if linha["tipo"] in {"plano_movimentos"}:
                continue
            writer.writerow(
                [
                    linha.get("tipo", ""),
                    linha.get("convivente_id", ""),
                    linha.get("nome_pdf", ""),
                    linha.get("numero_sisa", ""),
                    linha.get("dia", ""),
                    linha.get("pdf_presente", ""),
                    linha.get("status_carecore_antes", ""),
                    linha.get("acao", ""),
                    linha.get("match", ""),
                    linha.get("status_final", ""),
                    linha.get("retroagir_datas", ""),
                    linha.get("dias_importar", ""),
                    linha.get("movimentos_novos", ""),
                    linha.get("detalhe", ""),
                ]
            )
        for item in rejeitadas:
            writer.writerow(
                [
                    "rejeitada",
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    item.motivo,
                    "",
                    "",
                    "",
                    "",
                    "",
                    item.texto[:300],
                ]
            )


def imprimir_reconciliacao_resumo(
    pessoas: list[PresencaPessoa],
    linhas: list[dict[str, Any]],
    movimentos_por_id: dict[str, list[dict]],
    *,
    ano: int,
    mes: int,
    dia_limite: int,
    data_vinculacao_alvo: date,
) -> None:
    pdf_total = contar_presencas_pdf(pessoas, dia_limite=dia_limite)
    conviventes_por_id = {
        linha["convivente"].id: linha["convivente"]
        for linha in linhas
        if linha["tipo"] == "plano_movimentos"
    }
    simulado, por_dia = simular_presencas_carecore_apos_plano(
        linhas,
        ano=ano,
        mes=mes,
        dia_limite=dia_limite,
        movimentos_por_id=movimentos_por_id,
        conviventes_por_id=conviventes_por_id,
        data_vinculacao_alvo=data_vinculacao_alvo,
    )
    fora_pdf = sum(1 for linha in linhas if linha["tipo"] == "plano_fora_pdf")
    correcoes = sum(
        1
        for linha in linhas
        if linha["tipo"] == "dia" and linha.get("acao") == "corrigir_ausencia_pdf"
    )

    print("--- Reconciliacao PDF x CareCore (simulado apos plano) ---")
    print(f"Presencas no PDF (1-{dia_limite}): {pdf_total}")
    print(f"Presencas simuladas CareCore (somente lista PDF): {simulado}")
    print(f"Diferenca: {simulado - pdf_total}")
    print(f"Conviventes fora do PDF a ajustar: {fora_pdf}")
    print(f"Dias com correcao de ausencia (PDF ausente, CC presente): {correcoes}")
    if por_dia:
        pico_dia = max(por_dia.items(), key=lambda item: item[1])
        print(f"Pico P/dia simulado (PDF): {pico_dia[1]} em {pico_dia[0]}")


def imprimir_resumo(linhas: list[dict[str, Any]], rejeitadas: list[LinhaRejeitada]) -> None:
    conviventes = [linha for linha in linhas if linha["tipo"] == "convivente"]
    movimentos = sum(
        len(linha["movimentos"])
        for linha in linhas
        if linha["tipo"] == "plano_movimentos"
    )
    criados = sum(1 for linha in linhas if linha["tipo"] == "plano_movimentos" and linha["criado"])
    importar_dias = sum(
        1 for linha in linhas if linha["tipo"] == "dia" and linha["acao"] == "importar_presente"
    )
    print(f"Pessoas planejadas: {len(conviventes)}")
    print(f"Novos conviventes: {criados}")
    print(f"Dias a importar como presente: {importar_dias}")
    print(f"Movimentos novos planejados: {movimentos}")
    print(f"Linhas PDF rejeitadas: {len(rejeitadas)}")
    erros = [linha for linha in linhas if linha["tipo"] == "erro_match"]
    if erros:
        print(f"Matches ambiguos/erro: {len(erros)}")


def importar(args: argparse.Namespace) -> None:
    carregar_env_local()

    pdf = Path(args.pdf).expanduser().resolve()
    if not pdf.exists():
        raise SystemExit(f"PDF nao encontrado: {pdf}")

    ano, mes = resolver_mes_ano(pdf, args.mes, args.ano)
    dia_limite = args.dia_limite
    data_vinculacao_alvo = date(args.ano_vinculacao, args.mes_vinculacao, args.dia_vinculacao)

    database_url = normalizar_database_url(args.database_url)
    engine = create_engine(database_url, future=True)
    instituicao_id = obter_instituicao_id(engine, args.instituicao_id)
    usuario_id = args.usuario_id or obter_usuario_manutencao(engine, instituicao_id)

    pessoas, rejeitadas = extrair_pessoas_pdf(pdf, ano, mes)
    if not pessoas:
        raise SystemExit("Nenhuma pessoa valida extraida do PDF.")

    agora = agora_operacional_naive()
    hoje = agora.date()
    ontem = hoje - timedelta(days=1)
    dias_protegidos = dias_protegidos_para_importacao(
        reconciliar=args.reconciliar_junho,
        hoje=hoje,
        ontem=ontem,
        ano=ano,
        mes=mes,
        dia_limite=dia_limite,
    )

    conviventes = carregar_conviventes(engine, instituicao_id)
    fim_periodo = datetime(ano, mes, dia_limite, 23, 59, 59)
    movimentos_por_id = carregar_movimentos_por_convivente(
        engine,
        instituicao_id,
        [item.id for item in conviventes],
        fim_periodo,
    )
    chaves_existentes = carregar_chaves_import_existentes(engine, instituicao_id)

    linhas_relatorio, _ = montar_planos(
        pessoas,
        conviventes,
        movimentos_por_id,
        chaves_existentes,
        ano=ano,
        mes=mes,
        dia_limite=dia_limite,
        dias_protegidos=dias_protegidos,
        data_vinculacao_alvo=data_vinculacao_alvo,
        reconciliar=args.reconciliar_junho,
    )

    imprimir_resumo(linhas_relatorio, rejeitadas)
    if args.reconciliar_junho:
        imprimir_reconciliacao_resumo(
            pessoas,
            linhas_relatorio,
            movimentos_por_id,
            ano=ano,
            mes=mes,
            dia_limite=dia_limite,
            data_vinculacao_alvo=data_vinculacao_alvo,
        )

    report_path = Path(args.report) if args.report else (
        DEFAULT_REPORT_DIR / (
            f"presencas_pdf_reconciliacao_{ano}{mes:02d}_dryrun.csv"
            if args.reconciliar_junho
            else f"presencas_pdf_operacional_{ano}{mes:02d}_dryrun.csv"
        )
    )
    escrever_relatorio_csv(report_path, linhas_relatorio, rejeitadas)
    print(f"Relatorio: {report_path}")

    if not args.yes:
        print("Dry-run concluido. Nenhum dado gravado.")
        return

    if any(linha["tipo"] == "erro_match" for linha in linhas_relatorio) and not args.allow_ambiguous:
        raise SystemExit("Ha matches ambiguos. Revise o CSV ou use --allow-ambiguous.")

    contadores = aplicar_importacao(
        engine,
        instituicao_id,
        usuario_id,
        linhas_relatorio,
        data_vinculacao_alvo,
    )
    print(
        "Importacao aplicada: "
        f"conviventes_criados={contadores['conviventes_criados']} "
        f"conviventes_atualizados={contadores['conviventes_atualizados']} "
        f"fora_pdf_atualizados={contadores['fora_pdf_atualizados']} "
        f"movimentos_inseridos={contadores['movimentos_inseridos']}"
    )
    if args.reconciliar_junho:
        imprimir_reconciliacao_resumo(
            pessoas,
            linhas_relatorio,
            movimentos_por_id,
            ano=ano,
            mes=mes,
            dia_limite=dia_limite,
            data_vinculacao_alvo=data_vinculacao_alvo,
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Importa PDF SIAT para registros operacionais de presenca (Entrada/Saida)."
    )
    parser.add_argument(
        "--pdf",
        default=str(Path.home() / "Downloads" / "Presencas Junho.pdf"),
        help="Caminho do PDF de presencas.",
    )
    parser.add_argument("--mes", type=int, default=6, help="Mes do relatorio (ex.: 6).")
    parser.add_argument("--ano", type=int, default=2026, help="Ano do relatorio (ex.: 2026).")
    parser.add_argument("--dia-limite", type=int, default=DIA_LIMITE_PADRAO, help="Ultimo dia do PDF a importar.")
    parser.add_argument("--dia-vinculacao", type=int, default=1)
    parser.add_argument("--mes-vinculacao", type=int, default=6)
    parser.add_argument("--ano-vinculacao", type=int, default=2026)
    parser.add_argument("--database-url", default=DEFAULT_DATABASE_URL)
    parser.add_argument("--instituicao-id", default=None)
    parser.add_argument("--usuario-id", default=None, help="ID do usuario Manutencao (autopreenchido se omitido).")
    parser.add_argument("--report", default=None)
    parser.add_argument("--allow-ambiguous", action="store_true")
    parser.add_argument(
        "--reconciliar-junho",
        action="store_true",
        help=(
            "Reconciliacao excepcional: PDF como retrato dos dias 1-N "
            "(status, data_inativacao, fluxo e fora do PDF)."
        ),
    )
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true")
    importar(parser.parse_args())


if __name__ == "__main__":
    main()
