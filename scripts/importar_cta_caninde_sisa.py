"""Importa conviventes do CTA Canindé (SISA) com famílias e acomodações.

Fonte mestra de identidade: RelatorioCidadaoVinculado_Caninde.xlsx
Estrutura de quarto/família: LISTA DE PRESENÇA (só nº do quarto + nome;
não grava presença de refeição na rotina).

Uso:
  python scripts/importar_cta_caninde_sisa.py
  python scripts/importar_cta_caninde_sisa.py --force
  python scripts/importar_cta_caninde_sisa.py --online --force
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import os
import re
import ssl
import sys
import unicodedata
import uuid
from datetime import date, datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from openpyxl import load_workbook
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

SISA_PADRAO = Path(r"C:\Users\AClaudio\Downloads\CTA Canindé\RelatorioCidadaoVinculado_Caninde.xlsx")
PRESENCA_PADRAO = Path(r"C:\Users\AClaudio\Downloads\CTA Canindé\LISTA DE PRESENÇA ATUALIZADA.xlsx")
RELATORIO_DIR = ROOT / "relatorios_importacao"


def _novo_id() -> str:
    return str(uuid.uuid4())


def _texto(valor) -> str | None:
    if valor is None:
        return None
    texto = str(valor).replace("\t", " ").strip()
    if not texto or texto.lower() in {"none", "nan"}:
        return None
    return re.sub(r"\s+", " ", texto)


def _norm_nome(valor: str | None) -> str:
    texto = unicodedata.normalize("NFD", _texto(valor) or "")
    texto = "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")
    # N'ZUMBA → NZUMBA (não virar "N ZUMBA")
    texto = texto.replace("'", "").replace("'", "").replace("`", "")
    texto = re.sub(r"[^A-Za-z0-9 ]+", " ", texto).upper()
    return re.sub(r"\s+", " ", texto).strip()


# Correções conhecidas presença ↔ SISA (ambos lados normalizam)
CORRECOES_TOKEN = {
    "SIVA": "SILVA",
    "TEDEXACHI": "TEDESCHI",
    "MURCA": "MURGA",
    "FERRERIRA": "FERREIRA",
    "FERRIEIRA": "FERREIRA",
    "MASCARANHAS": "MASCARENHAS",
    "JHUNIOR": "JUNIOR",
    "CLEA": "CLEIA",
    "GRIESMAN": "GRISMAN",
    "LINARES": "LINAREZ",
    "LOURENZO": "LORENZO",
    "FANTINI": "FAITINI",
    "LUCILA": "LUCILIA",
    "VEZCARRA": "VIZCARRO",
    "MANNI": "MANU",
}


def _norm_para_match(valor: str | None) -> str:
    tokens = _norm_nome(valor).split()
    out = []
    for tok in tokens:
        out.append(CORRECOES_TOKEN.get(tok, tok))
    return " ".join(out)


def _data(valor) -> date | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = _texto(valor)
    if not texto:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto[:10], fmt).date()
        except ValueError:
            continue
    return None


def _sexo(valor) -> str | None:
    texto = (_texto(valor) or "").upper()
    if texto.startswith("F"):
        return "F"
    if texto.startswith("M"):
        return "M"
    return None


def _cpf(valor) -> str | None:
    digitos = re.sub(r"\D", "", _texto(valor) or "")
    if len(digitos) != 11 or digitos == digitos[0] * 11:
        return None
    return digitos


def ler_sisa(caminho: Path) -> list[dict]:
    wb = load_workbook(caminho, data_only=True, read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if not rows:
        raise SystemExit("Planilha SISA vazia.")
    def _cab(h) -> str:
        texto = unicodedata.normalize("NFD", (_texto(h) or "").upper())
        return "".join(ch for ch in texto if unicodedata.category(ch) != "Mn")

    header = [_cab(c) for c in rows[0]]

    def idx_contem(*parts: str) -> int | None:
        for i, h in enumerate(header):
            if all(p.upper() in h for p in parts):
                return i
        return None

    i_cod = idx_contem("CODIGO", "CIDAD") or idx_contem("CODIGO") or 0
    i_nome = idx_contem("NOME", "CIDAD")
    if i_nome is None:
        i_nome = next((i for i, h in enumerate(header) if h.startswith("NOME DO")), 1)
    i_social = idx_contem("NOME", "SOCIAL") or idx_contem("SOCIAL")
    i_cpf = idx_contem("CPF")
    i_nasc = idx_contem("NASCIMENTO")
    i_sexo = idx_contem("SEXO")
    i_vinc = idx_contem("VINCULA")

    pessoas: list[dict] = []
    for row in rows[1:]:
        if not row:
            continue
        sisa = _texto(row[i_cod] if i_cod < len(row) else None)
        if not sisa or not re.fullmatch(r"\d{6,8}", re.sub(r"\D", "", sisa)):
            continue
        sisa = re.sub(r"\D", "", sisa)
        nome = _texto(row[i_nome] if i_nome is not None and i_nome < len(row) else None)
        if not nome:
            continue
        social = _texto(row[i_social] if i_social is not None and i_social < len(row) else None)
        cpf = _cpf(row[i_cpf] if i_cpf is not None and i_cpf < len(row) else None)
        nasc = _data(row[i_nasc] if i_nasc is not None and i_nasc < len(row) else None)
        sexo = _sexo(row[i_sexo] if i_sexo is not None and i_sexo < len(row) else None)
        vinc = _data(row[i_vinc] if i_vinc is not None and i_vinc < len(row) else None)
        pessoas.append(
            {
                "sisa": sisa,
                "nome": nome,
                "nome_social": social,
                "cpf": cpf,
                "nasc": nasc,
                "sexo": sexo,
                "entrada": vinc,
                "nn": _norm_para_match(nome),
                "nn_raw": _norm_nome(nome),
            }
        )
    if not pessoas:
        raise SystemExit("Nenhum cidadão lido do SISA.")
    # dedup sisa
    vistos: set[str] = set()
    unicos = []
    for p in pessoas:
        if p["sisa"] in vistos:
            continue
        vistos.add(p["sisa"])
        unicos.append(p)
    return unicos


def ler_quartos_presenca(caminho: Path) -> list[dict]:
    """Só quarto + nome (estrutura familiar). Ignora café/almoço/presença."""
    wb = load_workbook(caminho, data_only=True, read_only=True)
    ws = wb.active
    itens: list[dict] = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i < 2:
            continue
        nome = _texto(row[1] if len(row) > 1 else None)
        if not nome:
            continue
        quarto = row[0] if row else None
        if quarto is None or str(quarto).strip() == "":
            continue
        try:
            quarto_n: int | str = int(float(quarto))
        except (TypeError, ValueError):
            quarto_n = _texto(quarto) or str(quarto)
        itens.append(
            {
                "quarto": quarto_n,
                "nome": nome,
                "nn": _norm_para_match(nome),
                "nn_raw": _norm_nome(nome),
            }
        )
    wb.close()
    return itens


def casar_sisa_com_quarto(
    sisa_pessoas: list[dict],
    presenca: list[dict],
) -> tuple[list[dict], list[dict], list[dict]]:
    """Devolve (casados com quarto), (sisa sem quarto), (presenca sem sisa)."""
    usados_pres: set[int] = set()
    casados: list[dict] = []
    sem_quarto: list[dict] = []

    def score(a: str, b: str) -> int:
        if a == b:
            return 100
        if a.startswith(b) or b.startswith(a):
            return 90
        ta, tb = a.split(), b.split()
        if len(ta) >= 2 and len(tb) >= 2 and ta[0] == tb[0] and ta[-1] == tb[-1]:
            return 85
        if len(ta) >= 2 and len(tb) >= 2 and ta[0] == tb[0] and ta[1] == tb[1]:
            return 80
        comuns = set(ta) & set(tb)
        if len(comuns) >= 3:
            return 70
        if len(comuns) >= 2 and ta[0] in comuns:
            return 60
        return 0

    for p in sisa_pessoas:
        melhor_i = None
        melhor_s = 0
        for i, pr in enumerate(presenca):
            if i in usados_pres:
                continue
            s = score(p["nn"], pr["nn"])
            if s > melhor_s:
                melhor_s = s
                melhor_i = i
        if melhor_i is not None and melhor_s >= 60:
            usados_pres.add(melhor_i)
            pr = presenca[melhor_i]
            casados.append(
                {
                    **p,
                    "quarto": pr["quarto"],
                    "match_score": melhor_s,
                    "nome_presenca": pr["nome"],
                }
            )
        else:
            sem_quarto.append(p)

    sobra_pres = [pr for i, pr in enumerate(presenca) if i not in usados_pres]
    return casados, sem_quarto, sobra_pres


def montar_familias(quartos: list[int | str]) -> dict[int | str, str]:
    ordenados = sorted(set(quartos), key=lambda x: (isinstance(x, str), x))
    return {q: f"F{i:03d}" for i, q in enumerate(ordenados, start=1)}


def _preparar_online() -> str:
    sys.path.insert(0, str(ROOT / "scripts"))
    from baixar_snapshot_online import resolver_snapshot_url

    url = resolver_snapshot_url()
    if url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://") :]
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k.lower() != "sslmode"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _url_local() -> str:
    bruto = (os.getenv("DATABASE_URL") or "").strip()
    if bruto.startswith("postgresql"):
        if bruto.startswith("postgresql://"):
            return "postgresql+asyncpg://" + bruto[len("postgresql://") :]
        if bruto.startswith("postgresql+psycopg2://"):
            return bruto.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
        return bruto
    sqlite = ROOT / "carecore_aeb.db"
    if not sqlite.exists():
        sqlite = ROOT / "carecore_local.db"
    return f"sqlite+aiosqlite:///{sqlite.as_posix()}"


async def _engine_session(url: str, *, online: bool):
    kwargs: dict = {"pool_pre_ping": True}
    if online or url.startswith("postgresql+asyncpg://"):
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        parts = urlsplit(url)
        query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k.lower() != "sslmode"]
        url = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
        kwargs["connect_args"] = {"ssl": ctx, "statement_cache_size": 0}
    engine = create_async_engine(url, **kwargs)
    return engine, async_sessionmaker(engine, expire_on_commit=False)


def _escrever_relatorio(
    path: Path,
    casados: list[dict],
    sem_quarto: list[dict],
    sobra_pres: list[dict],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["tipo", "sisa", "nome_sisa", "nome_presenca", "quarto", "score", "detalhe"])
        for c in casados:
            w.writerow(
                [
                    "casado",
                    c["sisa"],
                    c["nome"],
                    c.get("nome_presenca", ""),
                    c.get("quarto", ""),
                    c.get("match_score", ""),
                    "SISA + quarto da lista",
                ]
            )
        for c in sem_quarto:
            w.writerow(["sisa_sem_quarto", c["sisa"], c["nome"], "", "", "", "Sem casamento de quarto"])
        for p in sobra_pres:
            w.writerow(["presenca_sem_sisa", "", "", p["nome"], p["quarto"], "", "Só na lista de quartos"])


async def importar(
    *,
    sisa_path: Path,
    presenca_path: Path,
    online: bool,
    force: bool,
) -> dict:
    from models import (
        ConviventeDB,
        FamiliaConviventeDB,
        InstituicaoDB,
        LeitoDB,
        QuartoDB,
    )
    from time_operacional import agora_operacional_naive

    sisa_pessoas = ler_sisa(sisa_path)
    presenca = ler_quartos_presenca(presenca_path)
    casados, sem_quarto, sobra_pres = casar_sisa_com_quarto(sisa_pessoas, presenca)

    # Quem não casou quarto ainda entra como convivente, sem leito/família de quarto
    # (família individual F9xx opcional — aqui deixa sem família até revisão)
    mapa_familia = montar_familias([c["quarto"] for c in casados])

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    rel_path = RELATORIO_DIR / f"caninde_import_{stamp}.csv"
    _escrever_relatorio(rel_path, casados, sem_quarto, sobra_pres)

    url = _preparar_online() if online else _url_local()
    engine, Session = await _engine_session(url, online=online)

    async with Session() as db:
        projeto = (
            await db.execute(
                select(InstituicaoDB).where(
                    func.lower(InstituicaoDB.nome_fantasia).like("%canind%")
                )
            )
        ).scalar_one_or_none()
        if not projeto:
            raise SystemExit("Projeto CTA Canindé não encontrado.")

        iid = projeto.id
        n_fam = (
            await db.execute(
                select(func.count()).select_from(FamiliaConviventeDB).where(
                    FamiliaConviventeDB.instituicao_id == iid
                )
            )
        ).scalar_one()
        n_conv = (
            await db.execute(
                select(func.count()).select_from(ConviventeDB).where(ConviventeDB.instituicao_id == iid)
            )
        ).scalar_one()
        if (n_fam or n_conv) and not force:
            raise SystemExit(
                f"Já existem {n_conv} conviventes / {n_fam} famílias em {projeto.nome_fantasia}. "
                "Use --force para limpar e reimportar."
            )

        if force and (n_fam or n_conv):
            quarto_ids = (
                await db.execute(select(QuartoDB.id).where(QuartoDB.instituicao_id == iid))
            ).scalars().all()
            if quarto_ids:
                await db.execute(delete(LeitoDB).where(LeitoDB.quarto_id.in_(list(quarto_ids))))
                await db.execute(
                    update(ConviventeDB)
                    .where(ConviventeDB.instituicao_id == iid)
                    .values(leito_id=None, leito_reservado_id=None, familia_id=None)
                )
            await db.execute(delete(ConviventeDB).where(ConviventeDB.instituicao_id == iid))
            await db.execute(delete(QuartoDB).where(QuartoDB.instituicao_id == iid))
            await db.execute(delete(FamiliaConviventeDB).where(FamiliaConviventeDB.instituicao_id == iid))

        familias_db: dict[str, FamiliaConviventeDB] = {}
        for codigo in mapa_familia.values():
            fam = FamiliaConviventeDB(id=_novo_id(), instituicao_id=iid, codigo=codigo)
            db.add(fam)
            familias_db[codigo] = fam

        quartos_db: dict[int | str, QuartoDB] = {}
        for quarto_num in sorted(mapa_familia.keys(), key=lambda x: (isinstance(x, str), x)):
            q = QuartoDB(
                id=_novo_id(),
                instituicao_id=iid,
                nome=f"Quarto {quarto_num}",
                tipo_publico="Misto",
                modalidade="Fixo",
                rotativo=False,
                is_active=True,
            )
            db.add(q)
            quartos_db[quarto_num] = q

        await db.flush()

        proximo = (
            await db.execute(
                select(func.coalesce(func.max(ConviventeDB.numero_institucional), 0)).where(
                    ConviventeDB.instituicao_id == iid
                )
            )
        ).scalar_one() + 1

        hoje = agora_operacional_naive().date()
        leitos_por_quarto: dict[int | str, int] = {}
        criados = 0

        # 1) Com quarto/família
        for pessoa in sorted(
            casados,
            key=lambda p: ((isinstance(p["quarto"], str), p["quarto"]), p["nome"].upper()),
        ):
            codigo = mapa_familia[pessoa["quarto"]]
            leitos_por_quarto[pessoa["quarto"]] = leitos_por_quarto.get(pessoa["quarto"], 0) + 1
            n_cama = leitos_por_quarto[pessoa["quarto"]]
            leito = LeitoDB(
                id=_novo_id(),
                quarto_id=quartos_db[pessoa["quarto"]].id,
                identificacao=f"Cama {n_cama}",
                status="Ocupado",
            )
            db.add(leito)
            await db.flush()
            entrada = pessoa["entrada"] or hoje
            db.add(
                ConviventeDB(
                    id=_novo_id(),
                    instituicao_id=iid,
                    numero_institucional=proximo,
                    status="Ativo",
                    data_entrada=entrada,
                    data_inclusao=entrada,
                    leito_id=leito.id,
                    nome_completo=pessoa["nome"],
                    nome_social=pessoa.get("nome_social"),
                    data_nascimento=pessoa.get("nasc"),
                    cpf=pessoa.get("cpf"),
                    numero_sisa=pessoa["sisa"],
                    familia_id=familias_db[codigo].id,
                    sexo=pessoa.get("sexo"),
                    retira_alimentacao=True,
                )
            )
            proximo += 1
            criados += 1

        # 2) SISA sem quarto — cadastra ativo, sem acomodação/família
        for pessoa in sorted(sem_quarto, key=lambda p: p["nome"].upper()):
            entrada = pessoa["entrada"] or hoje
            db.add(
                ConviventeDB(
                    id=_novo_id(),
                    instituicao_id=iid,
                    numero_institucional=proximo,
                    status="Ativo",
                    data_entrada=entrada,
                    data_inclusao=entrada,
                    nome_completo=pessoa["nome"],
                    nome_social=pessoa.get("nome_social"),
                    data_nascimento=pessoa.get("nasc"),
                    cpf=pessoa.get("cpf"),
                    numero_sisa=pessoa["sisa"],
                    sexo=pessoa.get("sexo"),
                    retira_alimentacao=True,
                )
            )
            proximo += 1
            criados += 1

        await db.commit()
        resumo = {
            "alvo": "ONLINE" if online else "LOCAL",
            "projeto": projeto.nome_fantasia,
            "projeto_id": iid,
            "sisa_lidos": len(sisa_pessoas),
            "com_familia_quarto": len(casados),
            "sem_quarto": len(sem_quarto),
            "lista_quarto_sem_sisa": len(sobra_pres),
            "familias": len(familias_db),
            "quartos": len(quartos_db),
            "conviventes": criados,
            "relatorio": str(rel_path),
        }
    await engine.dispose()
    return resumo


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa CTA Canindé (SISA + famílias/acomodações)")
    parser.add_argument("--online", action="store_true", help="Aplica no Postgres de produção")
    parser.add_argument("--force", action="store_true", help="Apaga cadastro atual do Canindé e reimporta")
    parser.add_argument("--sisa", type=Path, default=SISA_PADRAO)
    parser.add_argument("--presenca", type=Path, default=PRESENCA_PADRAO, help="Só estrutura de quarto")
    args = parser.parse_args()
    if not args.sisa.exists():
        raise SystemExit(f"SISA não encontrado: {args.sisa}")
    if not args.presenca.exists():
        raise SystemExit(f"Lista de quartos não encontrada: {args.presenca}")
    resultado = asyncio.run(
        importar(
            sisa_path=args.sisa,
            presenca_path=args.presenca,
            online=args.online,
            force=args.force,
        )
    )
    print("=== Importação CTA Canindé ===")
    for k, v in resultado.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
