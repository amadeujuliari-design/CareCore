"""
Importa relatorios PDF de presencas do SIAT para a Rotina Legada.

Uso seguro:
  1. Rodar primeiro em dry-run, sem --yes.
  2. Conferir totais, linhas rejeitadas e duplicidades.
  3. Fazer backup do banco de destino.
  4. Executar novamente com --yes para gravar.

Exemplos:
  python scripts/importar_presencas_pdf_rotina_legada.py --dry-run
  python scripts/importar_presencas_pdf_rotina_legada.py --database-url sqlite:///carecore_aeb.db --yes
  python scripts/importar_presencas_pdf_rotina_legada.py --database-url "$env:DATABASE_URL" --yes
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import re
import sys
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pypdf import PdfReader
from sqlalchemy import create_engine, select

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from database import carregar_env_local
from models import HistoricoLegadoRotinaSIATDB, InstituicaoDB


SERVICO_PRESENCA_PDF = "PRESENCA - RELATORIO MENSAL SIAT"
USUARIO_ORIGEM = "IMPORTACAO_PDF_PRESENCAS_SIAT"
DEFAULT_DATABASE_URL = "sqlite:///carecore_aeb.db"

RE_DATA_NASCIMENTO = re.compile(r"\b\d{2}/\d{2}/\d{4}\b")
RE_DIAS = r"(?:0[1-9]|[12]\d|3[01])(?:,\s*(?:0[1-9]|[12]\d|3[01]))*"
RE_SEQUENCIA_DIAS = re.compile(RE_DIAS)
RE_FINAL = re.compile(
    r"^(?P<mae>.*?)\s+(?:(?P<sexo>[MF])\s+)?(?:(?P<sisa>\d+)\s+)?(?P<total>\d+)(?P<aj>\*\*\*)?\s*$"
)
RE_MES_ANO_ARQUIVO = re.compile(r"(?P<mes>\d{2})-(?P<ano>\d{2})")


@dataclass(frozen=True)
class PresencaPessoa:
    arquivo: str
    linha_origem: int
    ano: int
    mes: int
    rg: str | None
    dias: tuple[int, ...]
    nome: str
    data_nascimento: dt.date
    nome_mae: str
    sexo: str | None
    numero_sisa: str | None
    total_pdf: int
    ausencia_justificada: bool
    texto_original: str


@dataclass(frozen=True)
class LinhaRejeitada:
    arquivo: str
    linha_origem: int
    motivo: str
    texto: str


def normalizar_database_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

    if url.startswith("postgresql"):
        url = url.replace("?ssl=require", "?sslmode=require")
        url = url.replace("&ssl=require", "&sslmode=require")

    return url


def normalizar_texto(valor: str | None) -> str:
    return " ".join((valor or "").strip().split())


def parse_data_br(valor: str) -> dt.date:
    return dt.datetime.strptime(valor, "%d/%m/%Y").date()


def parse_mes_ano_do_arquivo(path: Path) -> tuple[int, int]:
    match = RE_MES_ANO_ARQUIVO.search(path.stem)
    if not match:
        raise ValueError(f"Nao foi possivel identificar mes/ano no nome do arquivo: {path.name}")

    mes = int(match.group("mes"))
    ano = 2000 + int(match.group("ano"))
    if not 1 <= mes <= 12:
        raise ValueError(f"Mes invalido no nome do arquivo: {path.name}")

    return ano, mes


def encontrar_inicio_linha(antes_data: str, total_pdf: int) -> tuple[str | None, tuple[int, ...], str] | None:
    candidatos: list[tuple[str | None, tuple[int, ...], str]] = []

    for match in RE_SEQUENCIA_DIAS.finditer(antes_data):
        nome = normalizar_texto(antes_data[match.end() :])
        if not nome or not nome[0].isalpha():
            continue

        dias = tuple(int(valor) for valor in re.findall(r"0[1-9]|[12]\d|3[01]", match.group(0)))
        rg = normalizar_texto(antes_data[: match.start()])
        if rg in {"", "0", "***", "NAO INF"}:
            rg = None
        candidatos.append((rg, dias, nome))

    for candidato in candidatos:
        if len(candidato[1]) == total_pdf:
            return candidato

    return candidatos[0] if candidatos else None


def descobrir_pdfs_padrao() -> list[Path]:
    base = Path.home() / "Downloads"
    return sorted(
        base.glob(
            "Relat* SIATI/Atendimento 2020 a 2026 98001/2026/Relatorio de presen* *-26.pdf"
        )
    )


def extrair_linhas_pdf(path: Path) -> list[str]:
    reader = PdfReader(str(path))
    texto = "\n".join(page.extract_text() or "" for page in reader.pages)
    return [normalizar_texto(linha) for linha in texto.splitlines() if normalizar_texto(linha)]


def parse_linha_presenca(path: Path, linha_origem: int, texto: str) -> tuple[PresencaPessoa | None, LinhaRejeitada | None]:
    if "Orgsystem Software" in texto or texto.startswith("ASSOCIACAO EVANGELICA"):
        return None, None
    if texto.startswith("PRESENCAS:") or texto.startswith("Nome Data nasc."):
        return None, None
    if texto.startswith("AJ ="):
        return None, None
    if not RE_DATA_NASCIMENTO.search(texto):
        return None, None

    ano, mes = parse_mes_ano_do_arquivo(path)
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

    ultimo_dia_mes = (dt.date(ano + (mes // 12), (mes % 12) + 1, 1) - dt.timedelta(days=1)).day
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


def extrair_pessoas(paths: list[Path]) -> tuple[list[PresencaPessoa], list[LinhaRejeitada]]:
    pessoas: list[PresencaPessoa] = []
    rejeitadas: list[LinhaRejeitada] = []

    for path in paths:
        for indice, texto in enumerate(extrair_linhas_pdf(path), start=1):
            pessoa, rejeitada = parse_linha_presenca(path, indice, texto)
            if pessoa:
                pessoas.append(pessoa)
            if rejeitada:
                rejeitadas.append(rejeitada)

    return pessoas, rejeitadas


def token_pessoa(pessoa: PresencaPessoa) -> str:
    if pessoa.numero_sisa:
        return pessoa.numero_sisa

    base = "|".join(
        [
            pessoa.nome,
            pessoa.data_nascimento.isoformat(),
            pessoa.nome_mae,
            pessoa.arquivo,
        ]
    )
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:12]


def chave_registro(pessoa: PresencaPessoa, dia: int) -> str:
    return f"PRESENCA_PDF_{pessoa.ano}_{pessoa.mes:02d}_{token_pessoa(pessoa)}_{dia:02d}"


def chave_atendimento(pessoa: PresencaPessoa) -> str:
    return f"PRESENCA_PDF_{pessoa.ano}_{pessoa.mes:02d}_{token_pessoa(pessoa)}"


def observacoes(pessoa: PresencaPessoa) -> str:
    partes = [
        f"Origem: {pessoa.arquivo}",
        f"Linha extraida: {pessoa.linha_origem}",
        f"Total mensal no PDF: {pessoa.total_pdf}",
        f"Dias no PDF: {','.join(f'{dia:02d}' for dia in pessoa.dias)}",
    ]
    if pessoa.rg:
        partes.append(f"RG legado: {pessoa.rg}")
    if pessoa.sexo:
        partes.append(f"Sexo informado no PDF: {pessoa.sexo}")
    if pessoa.ausencia_justificada:
        partes.append("AJ indicado no relatorio")

    return "; ".join(partes)


def montar_registros(pessoas: list[PresencaPessoa], instituicao_id: str) -> list[dict[str, Any]]:
    agora = dt.datetime.now(dt.UTC).replace(tzinfo=None)
    registros: list[dict[str, Any]] = []

    for pessoa in pessoas:
        for dia in pessoa.dias:
            registros.append(
                {
                    "id": str(uuid.uuid4()),
                    "instituicao_id": instituicao_id,
                    "convivente_id": None,
                    "origem_arquivo": pessoa.arquivo,
                    "linha_origem": pessoa.linha_origem,
                    "id_as_atendimento_serv_legado": chave_registro(pessoa, dia),
                    "id_as_atendimento_legado": chave_atendimento(pessoa),
                    "id_cr_clientes_legado": None,
                    "numero_sisa": pessoa.numero_sisa,
                    "numero_institucional_legado": pessoa.rg,
                    "nome_convivente": pessoa.nome,
                    "data_nascimento": pessoa.data_nascimento,
                    "nome_mae": pessoa.nome_mae,
                    "data_servico": dt.date(pessoa.ano, pessoa.mes, dia),
                    "servico_prestado": SERVICO_PRESENCA_PDF,
                    "id_servico_prestado_legado": "PRESENCA_PDF_MENSAL",
                    "atividade": "Presenca registrada em relatorio mensal SIAT",
                    "id_atividade_legado": None,
                    "quarto": None,
                    "cama": None,
                    "periodo_acolhimento": None,
                    "data_entrada": None,
                    "data_saida": None,
                    "motivo_saida": None,
                    "gestante": None,
                    "gestante_com_pre_natal": None,
                    "auditoria_datahora": None,
                    "usuario_origem": USUARIO_ORIGEM,
                    "chave_natural_convivente": "|".join(
                        [
                            pessoa.numero_sisa or "",
                            pessoa.nome,
                            pessoa.data_nascimento.isoformat(),
                            pessoa.nome_mae,
                        ]
                    ),
                    "confianca_vinculo": "Nao vinculado automaticamente",
                    "identificado": False,
                    "status_revisao": "Pendente",
                    "observacoes": observacoes(pessoa),
                    "importado_em": agora,
                }
            )

    return registros


def deduplicar_registros_do_lote(registros: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    unicos: dict[str, dict[str, Any]] = {}
    duplicados: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for registro in registros:
        chave = registro["id_as_atendimento_serv_legado"]
        if chave in unicos:
            duplicados[chave].append(registro)
            continue
        unicos[chave] = registro

    return list(unicos.values()), duplicados


def obter_instituicao_id(engine, instituicao_id: str | None) -> str:
    if instituicao_id:
        return instituicao_id

    tabela = InstituicaoDB.__table__
    with engine.connect() as conn:
        ids = [linha[0] for linha in conn.execute(select(tabela.c.id).order_by(tabela.c.nome_fantasia)).fetchall()]

    if not ids:
        raise SystemExit("Nenhuma instituicao encontrada no banco de destino.")
    if len(ids) > 1:
        raise SystemExit(
            "O banco tem mais de uma instituicao. Informe --instituicao-id para evitar importar no projeto errado."
        )

    return ids[0]


def contar_existentes(engine, chaves: list[str]) -> set[str]:
    if not chaves:
        return set()

    tabela = HistoricoLegadoRotinaSIATDB.__table__
    existentes: set[str] = set()
    with engine.connect() as conn:
        for inicio in range(0, len(chaves), 1000):
            lote = chaves[inicio : inicio + 1000]
            resultado = conn.execute(
                select(tabela.c.id_as_atendimento_serv_legado).where(
                    tabela.c.id_as_atendimento_serv_legado.in_(lote)
                )
            )
            existentes.update(str(linha[0]) for linha in resultado.fetchall())

    return existentes


def inserir_registros(engine, registros: list[dict[str, Any]], batch_size: int) -> None:
    tabela = HistoricoLegadoRotinaSIATDB.__table__
    with engine.begin() as conn:
        for inicio in range(0, len(registros), batch_size):
            conn.execute(tabela.insert(), registros[inicio : inicio + batch_size])


def imprimir_resumo(
    pessoas: list[PresencaPessoa],
    rejeitadas: list[LinhaRejeitada],
    registros: list[dict[str, Any]],
    duplicados_lote: dict[str, list[dict[str, Any]]],
    existentes: set[str],
    destino: str,
) -> None:
    por_arquivo = Counter(pessoa.arquivo for pessoa in pessoas)
    presencas_por_mes = Counter(str(registro["data_servico"])[:7] for registro in registros)
    aj_por_arquivo = Counter(pessoa.arquivo for pessoa in pessoas if pessoa.ausencia_justificada)

    print(f"Destino: {destino}")
    print(f"Pessoas parseadas: {len(pessoas)}")
    print(f"Presencas-dia extraidas: {len(registros)}")
    print(f"Duplicidades internas ignoradas: {sum(len(items) for items in duplicados_lote.values())}")
    print(f"Ja existentes no destino: {len(existentes)}")
    print(f"Novas se executar com --yes: {len(registros) - len(existentes)}")
    print(f"Linhas rejeitadas para revisao: {len(rejeitadas)}")
    print("")

    print("Por arquivo:")
    for arquivo in sorted(por_arquivo):
        print(f"- {arquivo}: pessoas={por_arquivo[arquivo]} aj={aj_por_arquivo[arquivo]}")

    print("")
    print("Presencas por mes:")
    for mes in sorted(presencas_por_mes):
        print(f"- {mes}: {presencas_por_mes[mes]}")

    if rejeitadas:
        print("")
        print("Primeiras linhas rejeitadas:")
        for item in rejeitadas[:10]:
            print(f"- {item.arquivo} linha {item.linha_origem} [{item.motivo}]: {item.texto[:180]}")

    if duplicados_lote:
        print("")
        print("Primeiras duplicidades internas ignoradas:")
        for chave, items in list(duplicados_lote.items())[:10]:
            exemplos = ", ".join(
                f"{item['origem_arquivo']} linha {item['linha_origem']}" for item in items[:3]
            )
            print(f"- {chave}: {exemplos}")


def escrever_relatorio(
    path: Path,
    pessoas: list[PresencaPessoa],
    rejeitadas: list[LinhaRejeitada],
    registros: list[dict[str, Any]],
    duplicados_lote: dict[str, list[dict[str, Any]]],
    existentes: set[str],
) -> None:
    import csv

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as arquivo:
        writer = csv.writer(arquivo, delimiter=";")
        writer.writerow(
            [
                "tipo",
                "arquivo",
                "linha_origem",
                "data_servico",
                "nome",
                "data_nascimento",
                "nome_mae",
                "numero_sisa",
                "id_as_atendimento_serv_legado",
                "status",
                "detalhe",
            ]
        )
        for registro in registros:
            status = "existente" if registro["id_as_atendimento_serv_legado"] in existentes else "novo"
            writer.writerow(
                [
                    "registro",
                    registro["origem_arquivo"],
                    registro["linha_origem"],
                    registro["data_servico"],
                    registro["nome_convivente"],
                    registro["data_nascimento"],
                    registro["nome_mae"],
                    registro["numero_sisa"],
                    registro["id_as_atendimento_serv_legado"],
                    status,
                    registro["observacoes"],
                ]
            )
        for item in rejeitadas:
            writer.writerow(
                [
                    "rejeitada",
                    item.arquivo,
                    item.linha_origem,
                    "",
                    "",
                    "",
                    "",
                    "",
                    "",
                    item.motivo,
                    item.texto,
                ]
            )
        for chave, items in duplicados_lote.items():
            for item in items:
                writer.writerow(
                    [
                        "duplicada_no_pdf",
                        item["origem_arquivo"],
                        item["linha_origem"],
                        item["data_servico"],
                        item["nome_convivente"],
                        item["data_nascimento"],
                        item["nome_mae"],
                        item["numero_sisa"],
                        chave,
                        "ignorada",
                        item["observacoes"],
                    ]
                )

    print(f"Relatorio gerado: {path}")


def importar(args: argparse.Namespace) -> None:
    carregar_env_local()

    pdfs = [Path(item).expanduser().resolve() for item in args.pdfs] if args.pdfs else descobrir_pdfs_padrao()
    if not pdfs:
        raise SystemExit("Nenhum PDF encontrado. Informe os arquivos como argumentos.")

    faltantes = [str(path) for path in pdfs if not path.exists()]
    if faltantes:
        raise SystemExit("PDFs nao encontrados:\n" + "\n".join(faltantes))

    database_url = normalizar_database_url(args.database_url)
    engine = create_engine(database_url, future=True)
    instituicao_id = obter_instituicao_id(engine, args.instituicao_id)

    pessoas, rejeitadas = extrair_pessoas(pdfs)
    registros_extraidos = montar_registros(pessoas, instituicao_id)
    registros, duplicados_lote = deduplicar_registros_do_lote(registros_extraidos)
    chaves = [registro["id_as_atendimento_serv_legado"] for registro in registros]

    existentes = contar_existentes(engine, chaves)
    novos = [registro for registro in registros if registro["id_as_atendimento_serv_legado"] not in existentes]

    imprimir_resumo(pessoas, rejeitadas, registros, duplicados_lote, existentes, database_url)

    if args.report:
        escrever_relatorio(Path(args.report), pessoas, rejeitadas, registros, duplicados_lote, existentes)

    if not args.yes:
        print("Dry-run concluido. Nenhum dado foi gravado.")
        return

    if rejeitadas and not args.allow_rejected:
        raise SystemExit(
            "Ha linhas rejeitadas. Revise o relatorio ou rode com --allow-rejected se aceitar importar apenas as linhas validas."
        )

    inserir_registros(engine, novos, args.batch_size)
    print(f"Importacao concluida. Registros inseridos: {len(novos)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa PDFs de presencas SIAT para historico_legado_rotina_siat.")
    parser.add_argument("pdfs", nargs="*", help="Caminhos dos PDFs. Se omitido, procura os seis PDFs de 2026 em Downloads.")
    parser.add_argument("--database-url", default=DEFAULT_DATABASE_URL, help="URL do banco de destino.")
    parser.add_argument("--instituicao-id", default=None, help="Instituicao de destino quando houver mais de uma.")
    parser.add_argument("--batch-size", type=int, default=1000, help="Tamanho dos lotes de insert.")
    parser.add_argument("--report", default=None, help="Caminho CSV para relatorio de conferencia.")
    parser.add_argument("--allow-rejected", action="store_true", help="Permite gravar linhas validas mesmo havendo rejeitadas.")
    parser.add_argument("--dry-run", action="store_true", help="Compatibilidade: dry-run e o padrao quando --yes nao e usado.")
    parser.add_argument("--yes", action="store_true", help="Confirma a gravacao no banco.")
    args = parser.parse_args()
    importar(args)


if __name__ == "__main__":
    main()
