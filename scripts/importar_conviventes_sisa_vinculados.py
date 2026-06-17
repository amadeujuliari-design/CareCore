"""
Importa o relatorio "Cidadaos Vinculados" do SISA para conviventes.

Uso seguro para a virada AEB:
  1. Nunca rodar direto no backup congelado.
  2. Copiar o banco base para uma copia operacional.
  3. Rodar primeiro sem --yes para dry-run.
  4. Conferir o relatorio CSV gerado.
  5. Rodar novamente com --yes apenas na copia operacional validada.

Exemplos:
  python scripts/importar_conviventes_sisa_vinculados.py --source-xls "C:\\Users\\user\\Downloads\\RelatorioCidadaoVinculado (1).xls" --database backups\\carecore_aeb_backup_validacao_sistema_20260607_102124.db
  python scripts/importar_conviventes_sisa_vinculados.py --source-xls "C:\\Users\\user\\Downloads\\RelatorioCidadaoVinculado (1).xls" --database carecore_aeb_producao_preparada_20260618.db --yes
"""

from __future__ import annotations

import argparse
import csv
import re
import shutil
import sqlite3
import unicodedata
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

try:
    import pandas as pd
except ImportError as exc:  # pragma: no cover - mensagem operacional
    raise SystemExit(
        "Dependencia ausente: pandas. Instale as dependencias do projeto antes de executar."
    ) from exc


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE = ROOT_DIR / "carecore_aeb.db"
DEFAULT_REPORT_DIR = ROOT_DIR / "relatorios_importacao"
STATUS_ATIVO = "Ativo"
STATUS_INATIVADO = "Inativado"
USUARIO_OPERACAO = "IMPORTACAO_SISA_CIDADAOS_VINCULADOS"


@dataclass(frozen=True)
class CidadaoSisa:
    numero_sisa: str
    nome_completo: str
    nome_social: str | None
    data_nascimento: str | None
    data_vinculacao: str | None
    data_desligamento: str | None
    dias_permanencia: int | None
    linha_origem: int

    @property
    def nome_norm(self) -> str:
        return normalizar_nome(self.nome_completo)


@dataclass
class AcaoImportacao:
    tipo: str
    numero_sisa: str
    nome_sisa: str
    convivente_id: str | None
    numero_institucional: int | None
    status_atual: str | None
    detalhe: str


def limpar_texto(valor) -> str:
    if valor is None:
        return ""
    try:
        if pd.isna(valor):
            return ""
    except TypeError:
        pass
    texto = str(valor).strip()
    if texto.lower() == "nan":
        return ""
    return re.sub(r"\s+", " ", texto)


def only_digits(valor) -> str:
    return re.sub(r"\D+", "", limpar_texto(valor))


def normalizar_nome(valor: str | None) -> str:
    texto = unicodedata.normalize("NFD", limpar_texto(valor))
    texto = "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")
    texto = re.sub(r"[^A-Za-z0-9 ]+", " ", texto).upper()
    return re.sub(r"\s+", " ", texto).strip()


def normalizar_cabecalho(valor) -> str:
    texto = unicodedata.normalize("NFD", limpar_texto(valor))
    texto = "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")
    texto = texto.replace("�", " ")
    texto = re.sub(r"[^A-Za-z0-9 ]+", " ", texto).upper()
    return re.sub(r"\s+", " ", texto).strip()


def parse_data_br(valor) -> str | None:
    texto = limpar_texto(valor)
    if not texto or texto == "---":
        return None
    data = pd.to_datetime(texto, dayfirst=True, errors="coerce")
    if pd.isna(data):
        return None
    return data.date().isoformat()


def parse_int(valor) -> int | None:
    texto = only_digits(valor)
    return int(texto) if texto else None


def encontrar_linha_cabecalho(df: pd.DataFrame) -> int:
    for idx, row in df.iterrows():
        celulas = [normalizar_cabecalho(v) for v in row.tolist()]
        tem_codigo = any("DIGO DO CIDAD" in c or "CODIGO DO CIDADA" in c for c in celulas)
        tem_nome = any("NOME DO CIDAD" in c or "NOME DO CIDADA" in c for c in celulas)
        if tem_codigo and tem_nome:
            return int(idx)
    raise ValueError("Nao encontrei a linha de cabecalho do relatorio SISA.")


def mapear_colunas(header_values: list) -> dict[str, int]:
    mapa: dict[str, int] = {}
    for idx, valor in enumerate(header_values):
        nome = normalizar_cabecalho(valor)
        if ("DIGO DO CIDAD" in nome or "CODIGO DO CIDADA" in nome) and "codigo" not in mapa:
            mapa["codigo"] = idx
        elif ("NOME DO CIDAD" in nome or "NOME DO CIDADA" in nome) and "nome" not in mapa:
            mapa["nome"] = idx
        elif "NOME SOCIAL" in nome and "nome_social" not in mapa:
            mapa["nome_social"] = idx
        elif "NASCIMENTO" in nome and "data_nascimento" not in mapa:
            mapa["data_nascimento"] = idx
        elif "VINCULA" in nome and "data_vinculacao" not in mapa:
            mapa["data_vinculacao"] = idx
        elif "DESLIGAMENTO" in nome and "data_desligamento" not in mapa:
            mapa["data_desligamento"] = idx
        elif "PERMAN" in nome and "dias_permanencia" not in mapa:
            mapa["dias_permanencia"] = idx

    obrigatorias = {"codigo", "nome", "data_nascimento", "data_vinculacao"}
    faltantes = sorted(obrigatorias - set(mapa))
    if faltantes:
        raise ValueError(f"Colunas obrigatorias nao encontradas no XLS: {faltantes}")
    return mapa


def carregar_relatorio_sisa(path: Path) -> list[CidadaoSisa]:
    if not path.exists():
        raise FileNotFoundError(f"Relatorio SISA nao encontrado: {path}")

    df = pd.read_excel(path, sheet_name=0, header=None, dtype=str)
    header_idx = encontrar_linha_cabecalho(df)
    mapa = mapear_colunas(df.iloc[header_idx].tolist())

    cidadaos: list[CidadaoSisa] = []
    for idx in range(header_idx + 1, len(df)):
        row = df.iloc[idx]
        numero_sisa = only_digits(row.iloc[mapa["codigo"]])
        nome_completo = limpar_texto(row.iloc[mapa["nome"]])
        if not numero_sisa or not nome_completo:
            continue

        cidadaos.append(
            CidadaoSisa(
                numero_sisa=numero_sisa,
                nome_completo=nome_completo,
                nome_social=limpar_texto(row.iloc[mapa["nome_social"]])
                if "nome_social" in mapa
                else None,
                data_nascimento=parse_data_br(row.iloc[mapa["data_nascimento"]]),
                data_vinculacao=parse_data_br(row.iloc[mapa["data_vinculacao"]]),
                data_desligamento=parse_data_br(row.iloc[mapa["data_desligamento"]])
                if "data_desligamento" in mapa
                else None,
                dias_permanencia=parse_int(row.iloc[mapa["dias_permanencia"]])
                if "dias_permanencia" in mapa
                else None,
                linha_origem=idx + 1,
            )
        )

    duplicados = [sisa for sisa, total in Counter(c.numero_sisa for c in cidadaos).items() if total > 1]
    if duplicados:
        raise ValueError(f"Relatorio SISA contem numeros duplicados: {', '.join(duplicados[:20])}")

    return cidadaos


def obter_colunas(con: sqlite3.Connection, tabela: str) -> set[str]:
    return {row["name"] for row in con.execute(f"PRAGMA table_info({tabela})").fetchall()}


def obter_instituicao_id(con: sqlite3.Connection, instituicao_id: str | None) -> str:
    if instituicao_id:
        existe = con.execute("SELECT 1 FROM instituicoes WHERE id = ?", (instituicao_id,)).fetchone()
        if not existe:
            raise ValueError(f"Instituicao nao encontrada no banco: {instituicao_id}")
        return instituicao_id

    linhas = con.execute("SELECT id FROM instituicoes").fetchall()
    if len(linhas) != 1:
        raise ValueError("Informe --instituicao-id quando o banco tiver mais de uma instituicao.")
    return str(linhas[0]["id"])


def carregar_conviventes(con: sqlite3.Connection, instituicao_id: str) -> list[sqlite3.Row]:
    return con.execute(
        """
        SELECT *
        FROM conviventes
        WHERE instituicao_id = ?
        """,
        (instituicao_id,),
    ).fetchall()


def montar_indices(conviventes: list[sqlite3.Row]):
    por_sisa: dict[str, list[sqlite3.Row]] = defaultdict(list)
    por_nome_nascimento: dict[tuple[str, str | None], list[sqlite3.Row]] = defaultdict(list)

    for convivente in conviventes:
        numero_sisa = only_digits(convivente["numero_sisa"])
        if numero_sisa:
            por_sisa[numero_sisa].append(convivente)

        data_nascimento = convivente["data_nascimento"]
        for nome in (convivente["nome_completo"], convivente["nome_social"]):
            nome_norm = normalizar_nome(nome)
            if nome_norm:
                por_nome_nascimento[(nome_norm, data_nascimento)].append(convivente)

    return por_sisa, por_nome_nascimento


def proximo_numero_institucional(conviventes: list[sqlite3.Row]) -> int:
    usados = [
        int(row["numero_institucional"])
        for row in conviventes
        if row["numero_institucional"] is not None
    ]
    return (max(usados) if usados else 0) + 1


def gerar_plano(
    con: sqlite3.Connection,
    cidadaos: list[CidadaoSisa],
    instituicao_id: str,
) -> tuple[list[AcaoImportacao], dict[str, sqlite3.Row | None], set[str]]:
    conviventes = carregar_conviventes(con, instituicao_id)
    por_sisa, por_nome_nascimento = montar_indices(conviventes)
    sisa_relatorio = {c.numero_sisa for c in cidadaos}

    acoes: list[AcaoImportacao] = []
    matches: dict[str, sqlite3.Row | None] = {}
    proximo_prontuario = proximo_numero_institucional(conviventes)

    for cidadao in cidadaos:
        candidatos_sisa = por_sisa.get(cidadao.numero_sisa, [])
        if len(candidatos_sisa) == 1:
            convivente = candidatos_sisa[0]
            matches[cidadao.numero_sisa] = convivente
            tipo = "manter_ativo" if convivente["status"] == STATUS_ATIVO else "reativar"
            acoes.append(
                AcaoImportacao(
                    tipo=tipo,
                    numero_sisa=cidadao.numero_sisa,
                    nome_sisa=cidadao.nome_completo,
                    convivente_id=convivente["id"],
                    numero_institucional=convivente["numero_institucional"],
                    status_atual=convivente["status"],
                    detalhe="match por numero_sisa",
                )
            )
            continue

        if len(candidatos_sisa) > 1:
            candidatos_exatos = [
                candidato
                for candidato in candidatos_sisa
                if normalizar_nome(candidato["nome_completo"]) == cidadao.nome_norm
                and candidato["data_nascimento"] == cidadao.data_nascimento
            ]
            if candidatos_exatos:
                convivente = sorted(
                    candidatos_exatos,
                    key=lambda row: row["numero_institucional"] or 10**9,
                )[0]
                matches[cidadao.numero_sisa] = convivente
                tipo = "manter_ativo" if convivente["status"] == STATUS_ATIVO else "reativar"
                acoes.append(
                    AcaoImportacao(
                        tipo=tipo,
                        numero_sisa=cidadao.numero_sisa,
                        nome_sisa=cidadao.nome_completo,
                        convivente_id=convivente["id"],
                        numero_institucional=convivente["numero_institucional"],
                        status_atual=convivente["status"],
                        detalhe=(
                            "numero_sisa duplicado resolvido por nome+nascimento; "
                            "escolhido menor prontuario"
                        ),
                    )
                )
                continue

            matches[cidadao.numero_sisa] = None
            acoes.append(
                AcaoImportacao(
                    tipo="revisar_numero_sisa_duplicado",
                    numero_sisa=cidadao.numero_sisa,
                    nome_sisa=cidadao.nome_completo,
                    convivente_id=None,
                    numero_institucional=None,
                    status_atual=None,
                    detalhe=f"{len(candidatos_sisa)} conviventes com o mesmo numero_sisa no banco",
                )
            )
            continue

        candidatos_nome = por_nome_nascimento.get((cidadao.nome_norm, cidadao.data_nascimento), [])
        if len(candidatos_nome) == 1:
            convivente = candidatos_nome[0]
            matches[cidadao.numero_sisa] = convivente
            acoes.append(
                AcaoImportacao(
                    tipo="vincular_sisa_e_ativar",
                    numero_sisa=cidadao.numero_sisa,
                    nome_sisa=cidadao.nome_completo,
                    convivente_id=convivente["id"],
                    numero_institucional=convivente["numero_institucional"],
                    status_atual=convivente["status"],
                    detalhe="match por nome normalizado + data_nascimento",
                )
            )
            continue

        if len(candidatos_nome) > 1:
            matches[cidadao.numero_sisa] = None
            acoes.append(
                AcaoImportacao(
                    tipo="revisar_nome_nascimento_duplicado",
                    numero_sisa=cidadao.numero_sisa,
                    nome_sisa=cidadao.nome_completo,
                    convivente_id=None,
                    numero_institucional=None,
                    status_atual=None,
                    detalhe=f"{len(candidatos_nome)} candidatos por nome + nascimento",
                )
            )
            continue

        matches[cidadao.numero_sisa] = None
        acoes.append(
            AcaoImportacao(
                tipo="criar",
                numero_sisa=cidadao.numero_sisa,
                nome_sisa=cidadao.nome_completo,
                convivente_id=None,
                numero_institucional=proximo_prontuario,
                status_atual=None,
                detalhe="nao encontrado no banco",
            )
        )
        proximo_prontuario += 1

    ids_ativos_relatorio = {
        row["id"]
        for row in matches.values()
        if row is not None
    }
    for convivente in conviventes:
        if convivente["status"] == STATUS_ATIVO and convivente["id"] not in ids_ativos_relatorio:
            acoes.append(
                AcaoImportacao(
                    tipo="inativar_fora_relatorio",
                    numero_sisa=only_digits(convivente["numero_sisa"]),
                    nome_sisa=convivente["nome_completo"],
                    convivente_id=convivente["id"],
                    numero_institucional=convivente["numero_institucional"],
                    status_atual=convivente["status"],
                    detalhe="ativo no banco, ausente no relatorio SISA",
                )
            )

    return acoes, matches, sisa_relatorio


def inserir_convivente(
    con: sqlite3.Connection,
    cidadao: CidadaoSisa,
    instituicao_id: str,
    numero_institucional: int,
) -> str:
    colunas = obter_colunas(con, "conviventes")
    novo_id = str(uuid.uuid4())
    valores = {
        "id": novo_id,
        "instituicao_id": instituicao_id,
        "numero_institucional": numero_institucional,
        "status": STATUS_ATIVO,
        "inativado_em": None,
        "ausencia_justificada_desde": None,
        "data_entrada": cidadao.data_vinculacao,
        "leito_id": None,
        "nome_completo": cidadao.nome_completo,
        "nome_social": cidadao.nome_social,
        "data_nascimento": cidadao.data_nascimento,
        "numero_sisa": cidadao.numero_sisa,
        "possui_renda": 0,
        "egresso_prisional": 0,
        "usa_tornozeleira": 0,
        "tem_mandado_prisao": 0,
    }
    valores = {chave: valor for chave, valor in valores.items() if chave in colunas}
    campos = list(valores)
    placeholders = ", ".join("?" for _ in campos)
    con.execute(
        f"INSERT INTO conviventes ({', '.join(campos)}) VALUES ({placeholders})",
        [valores[campo] for campo in campos],
    )
    return novo_id


def atualizar_convivente(
    con: sqlite3.Connection,
    convivente_id: str,
    cidadao: CidadaoSisa,
    vincular_sisa: bool,
) -> None:
    campos = {
        "status": STATUS_ATIVO,
        "inativado_em": None,
        "ausencia_justificada_desde": None,
        "nome_completo": cidadao.nome_completo,
        "nome_social": cidadao.nome_social,
        "data_nascimento": cidadao.data_nascimento,
        "data_entrada": cidadao.data_vinculacao,
    }
    if vincular_sisa:
        campos["numero_sisa"] = cidadao.numero_sisa

    colunas = obter_colunas(con, "conviventes")
    campos = {chave: valor for chave, valor in campos.items() if chave in colunas}
    set_sql = ", ".join(f"{campo} = ?" for campo in campos)
    con.execute(
        f"UPDATE conviventes SET {set_sql} WHERE id = ?",
        [*campos.values(), convivente_id],
    )


def inativar_convivente(con: sqlite3.Connection, convivente_id: str, agora: str) -> None:
    colunas = obter_colunas(con, "conviventes")
    campos = {"status": STATUS_INATIVADO, "inativado_em": agora, "leito_id": None}
    if "ausencia_justificada_desde" in colunas:
        campos["ausencia_justificada_desde"] = None
    set_sql = ", ".join(f"{campo} = ?" for campo in campos)
    con.execute(
        f"UPDATE conviventes SET {set_sql} WHERE id = ?",
        [*campos.values(), convivente_id],
    )


def executar_plano(
    con: sqlite3.Connection,
    cidadaos: list[CidadaoSisa],
    acoes: list[AcaoImportacao],
    matches: dict[str, sqlite3.Row | None],
    instituicao_id: str,
) -> None:
    por_sisa = {cidadao.numero_sisa: cidadao for cidadao in cidadaos}
    agora = datetime.now().isoformat(sep=" ", timespec="seconds")

    for acao in acoes:
        cidadao = por_sisa.get(acao.numero_sisa)
        if acao.tipo in {"manter_ativo", "reativar"} and cidadao and acao.convivente_id:
            atualizar_convivente(con, acao.convivente_id, cidadao, vincular_sisa=False)
        elif acao.tipo == "vincular_sisa_e_ativar" and cidadao and acao.convivente_id:
            atualizar_convivente(con, acao.convivente_id, cidadao, vincular_sisa=True)
        elif acao.tipo == "criar" and cidadao and acao.numero_institucional:
            inserir_convivente(con, cidadao, instituicao_id, acao.numero_institucional)
        elif acao.tipo == "inativar_fora_relatorio" and acao.convivente_id:
            inativar_convivente(con, acao.convivente_id, agora)

    # Falhas de revisao bloqueiam a execucao real para evitar ativa/inativacao ambigua.
    bloqueantes = [a for a in acoes if a.tipo.startswith("revisar_")]
    if bloqueantes:
        raise RuntimeError(f"Plano contem {len(bloqueantes)} acoes de revisao manual.")


def escrever_relatorio(path: Path, acoes: list[AcaoImportacao]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as arquivo:
        writer = csv.DictWriter(
            arquivo,
            fieldnames=[
                "tipo",
                "numero_sisa",
                "nome_sisa",
                "convivente_id",
                "numero_institucional",
                "status_atual",
                "detalhe",
            ],
            delimiter=";",
        )
        writer.writeheader()
        for acao in acoes:
            writer.writerow(acao.__dict__)


def imprimir_resumo(cidadaos: list[CidadaoSisa], acoes: list[AcaoImportacao], report_path: Path) -> None:
    contagem = Counter(acao.tipo for acao in acoes)
    print("Resumo da importacao SISA vinculados")
    print(f"- Cidadaos no relatorio: {len(cidadaos)}")
    for tipo, total in sorted(contagem.items()):
        print(f"- {tipo}: {total}")
    print(f"- Relatorio CSV: {report_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa conviventes vinculados do SISA para SQLite.")
    parser.add_argument("--source-xls", required=True, help="Caminho do RelatorioCidadaoVinculado .xls")
    parser.add_argument("--database", default=str(DEFAULT_DATABASE), help="SQLite de destino")
    parser.add_argument("--instituicao-id", default=None, help="Instituicao alvo; opcional se houver apenas uma")
    parser.add_argument("--report-dir", default=str(DEFAULT_REPORT_DIR), help="Pasta para relatorio CSV")
    parser.add_argument("--yes", action="store_true", help="Executa alteracoes; sem isso roda dry-run")
    parser.add_argument("--no-backup", action="store_true", help="Nao cria copia .bak antes de executar")
    args = parser.parse_args()

    source_xls = Path(args.source_xls).expanduser().resolve()
    database = Path(args.database).expanduser()
    if not database.is_absolute():
        database = (ROOT_DIR / database).resolve()

    cidadaos = carregar_relatorio_sisa(source_xls)
    con = sqlite3.connect(str(database))
    con.row_factory = sqlite3.Row

    try:
        integrity = con.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"Banco falhou no integrity_check: {integrity}")

        instituicao_id = obter_instituicao_id(con, args.instituicao_id)
        acoes, matches, _sisa_relatorio = gerar_plano(con, cidadaos, instituicao_id)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        modo = "execucao" if args.yes else "dry_run"
        report_path = Path(args.report_dir) / f"{modo}_importacao_conviventes_sisa_vinculados_{stamp}.csv"
        escrever_relatorio(report_path, acoes)
        imprimir_resumo(cidadaos, acoes, report_path)

        bloqueantes = [acao for acao in acoes if acao.tipo.startswith("revisar_")]
        if bloqueantes:
            print(f"- BLOQUEADO: {len(bloqueantes)} acoes exigem revisao manual.")
            if args.yes:
                raise SystemExit("Execucao cancelada por acoes ambiguas de revisao manual.")

        if not args.yes:
            print("Dry-run concluido. Nenhum dado foi alterado.")
            return

        if not args.no_backup:
            backup_path = database.with_name(f"{database.stem}_antes_importacao_sisa_{stamp}{database.suffix}")
            shutil.copy2(database, backup_path)
            print(f"- Backup antes da importacao: {backup_path}")

        executar_plano(con, cidadaos, acoes, matches, instituicao_id)
        con.commit()
        print("Importacao concluida com sucesso.")
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


if __name__ == "__main__":
    main()
