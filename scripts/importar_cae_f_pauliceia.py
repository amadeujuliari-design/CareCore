"""Importa famílias, conviventes e quartos do CAE F Pauliceia a partir da planilha.

Padrão alinhado ao Reencontro Pari: quarto = família (F001…).

Uso:
  python scripts/importar_cae_f_pauliceia.py
  python scripts/importar_cae_f_pauliceia.py --online
  python scripts/importar_cae_f_pauliceia.py --online --planilha "C:/Users/.../COMPOSIÇÃO FAMILIAR PAULICEIA.xlsx"
"""

from __future__ import annotations

import argparse
import asyncio
import os
import re
import ssl
import sys
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

PLANILHA_PADRAO = Path(r"C:\Users\AClaudio\Downloads\COMPOSIÇÃO FAMILIAR PAULICEIA.xlsx")


def _novo_id() -> str:
    return str(uuid.uuid4())


def _texto(valor) -> str | None:
    if valor is None:
        return None
    texto = str(valor).replace("\t", " ").strip()
    if not texto or texto.lower() == "none":
        return None
    return re.sub(r"\s+", " ", texto)


def _digitos(valor) -> str | None:
    texto = _texto(valor)
    if not texto:
        return None
    so = re.sub(r"\D", "", texto)
    return so or None


def _cpf(valor) -> str | None:
    so = _digitos(valor)
    if not so:
        return None
    if len(so) < 11:
        so = so.zfill(11)
    if len(so) != 11:
        return _texto(valor)
    return f"{so[:3]}.{so[3:6]}.{so[6:9]}-{so[9:]}"


def _sisa(valor) -> str | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, float):
        if valor.is_integer():
            return str(int(valor))
        return str(valor).rstrip("0").rstrip(".")
    texto = _texto(valor)
    if not texto:
        return None
    if re.fullmatch(r"\d+\.0+", texto):
        return texto.split(".", 1)[0]
    return texto


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
    return texto or None


def ler_planilha(caminho: Path) -> list[dict]:
    wb = load_workbook(caminho, data_only=True)
    ws = wb.active
    pessoas: list[dict] = []
    quarto_atual = None
    for row in range(4, ws.max_row + 1):
        nome = _texto(ws.cell(row, 5).value)
        if not nome:
            continue
        q = ws.cell(row, 4).value
        if q is not None and str(q).strip() != "":
            try:
                quarto_atual = int(float(q))
            except (TypeError, ValueError):
                quarto_atual = str(q).strip()
        if quarto_atual is None:
            raise SystemExit(f"Linha {row}: pessoa sem quarto (nome={nome}).")
        pessoas.append(
            {
                "linha": row,
                "entrada": _data(ws.cell(row, 1).value),
                "sisa": _sisa(ws.cell(row, 3).value),
                "quarto": quarto_atual,
                "nome": nome,
                "mae": _texto(ws.cell(row, 6).value),
                "rg": _texto(ws.cell(row, 7).value),
                "cpf": _cpf(ws.cell(row, 8).value),
                "nasc": _data(ws.cell(row, 9).value),
                "sexo": _sexo(ws.cell(row, 11).value),
            }
        )
    if not pessoas:
        raise SystemExit("Planilha sem pessoas.")
    return pessoas


def montar_familias(pessoas: list[dict]) -> dict[int | str, str]:
    """quarto -> codigo F00N (ordem crescente dos quartos)."""
    quartos = sorted({p["quarto"] for p in pessoas}, key=lambda x: (isinstance(x, str), x))
    return {q: f"F{i:03d}" for i, q in enumerate(quartos, start=1)}


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
    kwargs = {"pool_pre_ping": True}
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


async def importar(*, planilha: Path, online: bool, force: bool) -> dict:
    from models import (
        ConviventeDB,
        FamiliaConviventeDB,
        InstituicaoDB,
        LeitoDB,
        QuartoDB,
    )
    from time_operacional import agora_operacional_naive

    pessoas = ler_planilha(planilha)
    mapa_familia = montar_familias(pessoas)
    url = _preparar_online() if online else _url_local()
    engine, Session = await _engine_session(url, online=online)

    async with Session() as db:
        projeto = (
            await db.execute(
                select(InstituicaoDB).where(
                    func.lower(InstituicaoDB.nome_fantasia).like("%paulic%")
                )
            )
        ).scalar_one_or_none()
        if not projeto:
            raise SystemExit("Projeto Pauliceia não encontrado.")

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
        if n_fam and not force:
            raise SystemExit(
                f"Já existem {n_fam} famílias em {projeto.nome_fantasia}. Use --force para reimportar."
            )

        if force and (n_fam or n_conv):
            # Limpa acomodações e cadastro do projeto antes de recriar.
            quarto_ids = (
                await db.execute(select(QuartoDB.id).where(QuartoDB.instituicao_id == iid))
            ).scalars().all()
            if quarto_ids:
                await db.execute(delete(LeitoDB).where(LeitoDB.quarto_id.in_(list(quarto_ids))))
                await db.execute(
                    update(ConviventeDB)
                    .where(ConviventeDB.instituicao_id == iid)
                    .values(leito_id=None, leito_reservado_id=None)
                )
            await db.execute(delete(ConviventeDB).where(ConviventeDB.instituicao_id == iid))
            await db.execute(delete(QuartoDB).where(QuartoDB.instituicao_id == iid))
            await db.execute(delete(FamiliaConviventeDB).where(FamiliaConviventeDB.instituicao_id == iid))
        elif n_conv and not n_fam:
            # Remove placeholder de teste (ex.: online com 1 convivente lixo).
            await db.execute(delete(ConviventeDB).where(ConviventeDB.instituicao_id == iid))

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

        leitos_por_quarto: dict[int | str, int] = {}
        hoje = agora_operacional_naive().date()
        for pessoa in sorted(
            pessoas,
            key=lambda p: (
                (isinstance(p["quarto"], str), p["quarto"]),
                p["nome"].upper(),
            ),
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
                    data_nascimento=pessoa["nasc"],
                    cpf=pessoa["cpf"],
                    rg=pessoa["rg"],
                    nome_mae=pessoa["mae"],
                    numero_sisa=pessoa["sisa"],
                    familia_id=familias_db[codigo].id,
                    sexo=pessoa["sexo"],
                    retira_alimentacao=True,
                )
            )
            proximo += 1

        await db.commit()
        resumo = {
            "alvo": "ONLINE" if online else "LOCAL",
            "projeto": projeto.nome_fantasia,
            "projeto_id": iid,
            "familias": len(familias_db),
            "quartos": len(quartos_db),
            "conviventes": len(pessoas),
            "planilha": str(planilha),
        }
    await engine.dispose()
    return resumo


def main() -> None:
    parser = argparse.ArgumentParser(description="Importa composição familiar do CAE F Pauliceia")
    parser.add_argument("--online", action="store_true", help="Aplica no Postgres de produção")
    parser.add_argument("--force", action="store_true", help="Apaga famílias/conviventes/quartos e reimporta")
    parser.add_argument("--planilha", type=Path, default=PLANILHA_PADRAO)
    args = parser.parse_args()
    if not args.planilha.exists():
        raise SystemExit(f"Planilha não encontrada: {args.planilha}")
    resultado = asyncio.run(importar(planilha=args.planilha, online=args.online, force=args.force))
    print("=== Importação Pauliceia ===")
    for k, v in resultado.items():
        print(f"{k}: {v}")


if __name__ == "__main__":
    main()
