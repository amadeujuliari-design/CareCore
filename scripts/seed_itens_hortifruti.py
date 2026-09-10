"""
Garante categoria Hortifruti (segmento hortifruti) e itens do catalogo
extraidos das planilhas Leopoldina/VNC — sem quantidades de pedido.

Uso:
  python scripts/seed_itens_hortifruti.py --alvo local
  python scripts/seed_itens_hortifruti.py --alvo local --aplicar
  python scripts/seed_itens_hortifruti.py --alvo online --aplicar
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from compras_itens_consumo_utils import chave_item_consumo, limpar_item_consumo, sanitizar_unidade_medida
from compras_regras import (
    COMPETENCIA_SEDE,
    SEGMENTO_HORTIFRUTI,
    inferir_perecivel,
    normalizar_segmento_catalogo,
)
from models import get_uuid
from time_operacional import agora_operacional_naive

# descricao + unidade de medida (NUNCA quantidade do pedido).
ITENS_HORTIFRUTI = (
    ("Abacate", "kg"),
    ("Abacaxi", "kg"),
    ("Abóbora", "kg"),
    ("Abobrinha", "kg"),
    ("Acelga", "kg"),
    ("Alface americana", "un"),
    ("Alface romana", "kg"),
    ("Alho descascado", "kg"),
    ("Banana", "cx"),
    ("Banana Nanica", "kg"),
    ("Batata", "kg"),
    ("Batata Baroa", "kg"),
    ("Batata doce", "kg"),
    ("Batata lavada", "kg"),
    ("Beringela", "kg"),
    ("Brócolis", "un"),
    ("Cebola", "kg"),
    ("Cebola grande", "kg"),
    ("Cenoura", "kg"),
    ("Chuchu", "kg"),
    ("Coentro", "maço"),
    ("Couve", "un"),
    ("Couve Manteiga", "kg"),
    ("Laranja", "kg"),
    ("Limão", "kg"),
    ("Maçã", "kg"),
    ("Manga", "kg"),
    ("Maracujá", "kg"),
    ("Melancia", "un"),
    ("Melão", "un"),
    ("Mexerica Murcot", "kg"),
    ("Ovos", "bandeja"),
    ("Pepino", "kg"),
    ("Repolho", "kg"),
    ("Repolho branco", "un"),
    ("Repolho roxo", "un"),
    ("Rúcula", "un"),
    ("Tomate para molho", "kg"),
    ("Tomate para salada", "kg"),
)


def _carregar_env_snapshot() -> None:
    env_path = ROOT / ".env.snapshot"
    if not env_path.exists():
        return
    for linha in env_path.read_text(encoding="utf-8-sig").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        chave, valor = linha.split("=", 1)
        os.environ.setdefault(chave.strip(), valor.strip().strip('"').strip("'"))


def _url_online() -> str:
    _carregar_env_snapshot()
    url = os.environ.get("SNAPSHOT_DATABASE_URL") or os.environ.get("DATABASE_URL_SNAPSHOT")
    if not url:
        raise RuntimeError("Configure SNAPSHOT_DATABASE_URL em .env.snapshot")
    url = url.strip()
    for a, b in (
        ("postgresql+asyncpg://", "postgresql://"),
        ("postgresql+psycopg2://", "postgresql://"),
        ("postgres://", "postgresql://"),
    ):
        if url.startswith(a):
            url = b + url[len(a) :]
    url = url.replace("ssl=require", "sslmode=require")
    if "sslmode=" not in url:
        url += ("&" if "?" in url else "?") + "sslmode=require"
    return url


def _org_aeb_id(cur, dialect: str) -> str:
    # Prefer org with most fornecedores / known name AEB
    if dialect == "sqlite":
        row = cur.execute(
            """
            SELECT o.id, o.nome, COUNT(f.id) c
            FROM organizacoes o
            LEFT JOIN compras_fornecedores f ON f.organizacao_id = o.id
            GROUP BY o.id
            ORDER BY c DESC
            LIMIT 1
            """
        ).fetchone()
        return row[0]
    cur.execute(
        """
        SELECT o.id, o.nome, COUNT(f.id) c
        FROM organizacoes o
        LEFT JOIN compras_fornecedores f ON f.organizacao_id = o.id
        GROUP BY o.id, o.nome
        ORDER BY c DESC
        LIMIT 1
        """
    )
    return cur.fetchone()[0]


def _garantir_categoria(cur, org_id: str, dialect: str, aplicar: bool) -> str:
    if dialect == "sqlite":
        row = cur.execute(
            "SELECT id, segmento FROM compras_categorias WHERE organizacao_id=? AND lower(nome)=lower(?)",
            (org_id, "Hortifruti"),
        ).fetchone()
    else:
        cur.execute(
            "SELECT id, segmento FROM compras_categorias WHERE organizacao_id=%s AND lower(nome)=lower(%s)",
            (org_id, "Hortifruti"),
        )
        row = cur.fetchone()
    if row:
        cat_id, seg = row[0], row[1]
        if normalizar_segmento_catalogo(seg) != SEGMENTO_HORTIFRUTI:
            print(f"categoria existente {cat_id}: segmento {seg!r} -> {SEGMENTO_HORTIFRUTI}")
            if aplicar:
                if dialect == "sqlite":
                    cur.execute(
                        "UPDATE compras_categorias SET segmento=? WHERE id=?",
                        (SEGMENTO_HORTIFRUTI, cat_id),
                    )
                else:
                    cur.execute(
                        "UPDATE compras_categorias SET segmento=%s WHERE id=%s",
                        (SEGMENTO_HORTIFRUTI, cat_id),
                    )
        else:
            print(f"categoria Hortifruti ok id={cat_id}")
        return cat_id

    cat_id = get_uuid()
    agora = agora_operacional_naive()
    print(f"criar categoria Hortifruti id={cat_id}")
    if aplicar:
        if dialect == "sqlite":
            cur.execute(
                """
                INSERT INTO compras_categorias
                (id, organizacao_id, nome, ordem, ativo, segmento, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (cat_id, org_id, "Hortifruti", 15, 1, SEGMENTO_HORTIFRUTI, agora),
            )
        else:
            cur.execute(
                """
                INSERT INTO compras_categorias
                (id, organizacao_id, nome, ordem, ativo, segmento, criado_em)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (cat_id, org_id, "Hortifruti", 15, True, SEGMENTO_HORTIFRUTI, agora),
            )
    return cat_id


def _seed_itens(cur, org_id: str, cat_id: str, dialect: str, aplicar: bool) -> tuple[int, int]:
    criados = 0
    existentes = 0
    agora = agora_operacional_naive()
    for descricao, unidade in ITENS_HORTIFRUTI:
        limpo = limpar_item_consumo(descricao=descricao, unidade_medida=unidade)
        if limpo.get("lixo") or not limpo.get("descricao"):
            print(f"  ! ignorado {descricao!r}")
            continue
        desc = limpo["descricao"]
        uni = limpo.get("unidade_medida") or sanitizar_unidade_medida(unidade) or unidade
        chave = limpo.get("chave") or chave_item_consumo(desc)
        # Cadastro: sem embalagem/quantidade do pedido (só UOM).
        embalagem = None
        fator = None
        if dialect == "sqlite":
            row = cur.execute(
                "SELECT id FROM compras_itens_consumo WHERE organizacao_id=? AND chave=?",
                (org_id, chave),
            ).fetchone()
        else:
            cur.execute(
                "SELECT id FROM compras_itens_consumo WHERE organizacao_id=%s AND chave=%s",
                (org_id, chave),
            )
            row = cur.fetchone()
        if row:
            existentes += 1
            continue
        criados += 1
        print(f"  + {desc} ({uni})")
        if not aplicar:
            continue
        item_id = get_uuid()
        if dialect == "sqlite":
            cur.execute(
                """
                INSERT INTO compras_itens_consumo (
                  id, organizacao_id, descricao, chave, unidade_medida, embalagem,
                  fator_embalagem, categoria_id, marca_preferencial, sinonimos,
                  perecivel, observacao, ativo, competencia_orcamento, criado_em, atualizado_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item_id, org_id, desc, chave, uni, embalagem,
                    fator, cat_id, None, None,
                    1 if inferir_perecivel(descricao=desc, categoria_nome="Hortifruti") else 0, None, 1, COMPETENCIA_SEDE, agora, agora,
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO compras_itens_consumo (
                  id, organizacao_id, descricao, chave, unidade_medida, embalagem,
                  fator_embalagem, categoria_id, marca_preferencial, sinonimos,
                  perecivel, observacao, ativo, competencia_orcamento, criado_em, atualizado_em
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    item_id, org_id, desc, chave, uni, embalagem,
                    fator, cat_id, None, None,
                    bool(inferir_perecivel(descricao=desc, categoria_nome="Hortifruti")), None, True, COMPETENCIA_SEDE, agora, agora,
                ),
            )
    return criados, existentes


def _rodar_sqlite(path: Path, aplicar: bool) -> None:
    import sqlite3

    conn = sqlite3.connect(str(path))
    cur = conn.cursor()
    org_id = _org_aeb_id(cur, "sqlite")
    print("org", org_id)
    cat_id = _garantir_categoria(cur, org_id, "sqlite", aplicar)
    criados, existentes = _seed_itens(cur, org_id, cat_id, "sqlite", aplicar)
    if aplicar:
        conn.commit()
    conn.close()
    print(f"itens_novos={criados} ja_existiam={existentes}")


def _rodar_postgres(aplicar: bool) -> None:
    import psycopg2

    conn = psycopg2.connect(_url_online())
    cur = conn.cursor()
    org_id = _org_aeb_id(cur, "pg")
    print("org", org_id)
    cat_id = _garantir_categoria(cur, org_id, "pg", aplicar)
    criados, existentes = _seed_itens(cur, org_id, cat_id, "pg", aplicar)
    if aplicar:
        conn.commit()
        print("COMMIT online ok")
    else:
        conn.rollback()
    cur.close()
    conn.close()
    print(f"itens_novos={criados} ja_existiam={existentes}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--alvo", choices=("local", "online"), required=True)
    parser.add_argument("--aplicar", action="store_true")
    parser.add_argument("--db", default=str(ROOT / "carecore_aeb.db"))
    args = parser.parse_args()
    print(f"[{'APLICAR' if args.aplicar else 'DRY-RUN'}] alvo={args.alvo}")
    print(f"catalogo={len(ITENS_HORTIFRUTI)} itens (sem quantidades de pedido)")
    if args.alvo == "local":
        path = Path(args.db)
        if not path.is_absolute():
            path = ROOT / path
        _rodar_sqlite(path, args.aplicar)
    else:
        _rodar_postgres(args.aplicar)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
