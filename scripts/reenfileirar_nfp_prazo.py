"""Reenfileira cupons rejeitado_prazo que cabem na janela NFP de 2 meses.

Uso:
  python scripts/reenfileirar_nfp_prazo.py --dry-run
  python scripts/reenfileirar_nfp_prazo.py --yes
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import select  # noqa: E402

from database import AsyncSessionLocal  # noqa: E402
from models import NfpCupomLidoDB  # noqa: E402
from nfp_cupom_leitura_service import STATUS_PENDENTE, STATUS_REJEITADO_CPF  # noqa: E402
from nfp_cupom_utils import cupom_fora_prazo_leitura, parsear_chave_nfe  # noqa: E402
from time_operacional import agora_operacional_naive  # noqa: E402

ORG_PADRAO = "2248993f-a4d8-4188-b461-c3f213e10386"


def _org_id() -> str:
    return os.getenv("CARECORE_ORG_ID") or os.getenv("ORGANIZACAO_ID") or ORG_PADRAO


def _backfill_chave(row: NfpCupomLidoDB) -> None:
    meta = parsear_chave_nfe(row.chave or "")
    if not meta:
        return
    if not row.uf_ibge:
        row.uf_ibge = meta.get("uf_ibge")
    if not row.modelo:
        row.modelo = meta.get("modelo")
    if not row.serie:
        row.serie = meta.get("serie")
    if not row.numero_nf:
        row.numero_nf = meta.get("numero_nf")
    if not row.tipo_emissao:
        row.tipo_emissao = meta.get("tipo_emissao")
    if not row.cnpj_emitente:
        row.cnpj_emitente = meta.get("cnpj_emitente")
    if not row.data_emissao_ref:
        row.data_emissao_ref = meta.get("data_emissao_ref")


async def rodar(*, org_id: str, dry_run: bool) -> None:
    agora = agora_operacional_naive()
    hoje = agora.date()
    async with AsyncSessionLocal() as db:
        rows = (
            await db.execute(
                select(NfpCupomLidoDB).where(
                    NfpCupomLidoDB.organizacao_id == org_id,
                    NfpCupomLidoDB.status == "rejeitado_prazo",
                )
            )
        ).scalars().all()
        ainda_fora = 0
        para_fila = 0
        para_cpf = 0
        print(f"Org: {org_id}")
        print(f"Rejeitados prazo encontrados: {len(rows)}")
        print(f"Hoje operacional: {hoje.isoformat()}")
        for row in rows:
            _backfill_chave(row)
            ref = row.data_emissao_ref
            if cupom_fora_prazo_leitura(ref, hoje=hoje):
                ainda_fora += 1
                continue
            if row.consumidor_identificado is True:
                para_cpf += 1
                if not dry_run:
                    row.status = STATUS_REJEITADO_CPF
                    row.mensagem = (
                        "Reclassificado: consumidor identificado (nao era so prazo)."
                    )
                    row.atualizado_em = agora
                continue
            para_fila += 1
            if not dry_run:
                row.status = STATUS_PENDENTE
                row.lote_id = None
                row.reservado_em = None
                row.reservado_por = None
                row.mensagem = (
                    "Reenfileirado: janela NFP de 2 meses (retrasado + passado ate dia 20)."
                )
                row.atualizado_em = agora
        if dry_run:
            print(
                f"DRY-RUN: fila={para_fila} cpf={para_cpf} ainda_fora={ainda_fora} "
                "(nenhum update)"
            )
            return
        await db.commit()
        print(
            f"OK reenfileirados={para_fila} reclass_cpf={para_cpf} "
            f"permanecem_fora={ainda_fora}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reenfileira rejeitado_prazo que cabem na janela de 2 meses."
    )
    parser.add_argument("--org", default=None)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--yes", action="store_true", help="Persiste as alteracoes.")
    args = parser.parse_args()
    if not args.yes:
        args.dry_run = True
    asyncio.run(rodar(org_id=args.org or _org_id(), dry_run=args.dry_run))


if __name__ == "__main__":
    main()
