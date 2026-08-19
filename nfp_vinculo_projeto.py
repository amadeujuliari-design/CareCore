"""Vinculo NFP (captador/Sede) <-> projeto CareCore (instituicao)."""

from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import InstituicaoDB, NfpAgenteCaptadorDB, OrganizacaoDB
from nfp_metas_utils import ALIASES_PROJETO_METAS, codigo_projeto_metas, _norm
from nfp_utils import CAPTADORES_PADRAO, normalizar_agente_captacao, percentual_agente_padrao
from time_operacional import agora_operacional_naive

# Rotulos especiais de Sede (nao necessariamente um "projeto" operacional).
ROTULOS_SEDE = {"SEDE AEB", "SEDE"}


def _norm_cap(valor: Optional[str]) -> str:
    return _norm(valor).replace("–", "-").replace("—", "-")


def rotulo_captador_de_projeto(nome_fantasia: Optional[str]) -> str:
    """Deriva o rotulo de captador NFP a partir do nome do projeto CareCore."""
    nome = (nome_fantasia or "").strip()
    if not nome:
        return ""
    # Preferencia: casar com lista padrao / aliases de metas.
    codigo = codigo_projeto_metas(nome)
    if codigo == "SEDE":
        return "SEDE AEB"
    for item in CAPTADORES_PADRAO:
        if _norm_cap(item) == _norm_cap(nome) or _norm_cap(item) == _norm_cap(codigo):
            return item
    if codigo:
        for item in CAPTADORES_PADRAO:
            if _norm_cap(item) == _norm_cap(codigo):
                return item
        return codigo
    return nome


def vinculo_eh_sede(captador: Optional[str]) -> bool:
    n = _norm_cap(captador)
    return n in {_norm_cap(x) for x in ROTULOS_SEDE} or n.startswith("SEDE")


CAMPOS_ENDERECO_ORG = (
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "uf",
    "cnpj",
    "telefone",
    "email",
    "emails_adicionais",
)


def aplicar_endereco_org_na_instituicao_sede(org: OrganizacaoDB, inst: InstituicaoDB) -> bool:
    """Copia endereço e contato da organização para o projeto SEDE AEB."""
    mudou = False
    for campo in CAMPOS_ENDERECO_ORG:
        val = getattr(org, campo, None)
        if getattr(inst, campo) != val:
            setattr(inst, campo, val)
            mudou = True
    return mudou


async def sincronizar_sede_com_organizacao(db: AsyncSession, org: OrganizacaoDB) -> int:
    """Alinha todos os projetos Sede da org ao endereço da organização."""
    if not org or not org.id:
        return 0
    rows = (
        await db.execute(select(InstituicaoDB).where(InstituicaoDB.organizacao_id == org.id))
    ).scalars().all()
    n = 0
    for inst in rows:
        if vinculo_eh_sede(inst.nome_fantasia) and aplicar_endereco_org_na_instituicao_sede(org, inst):
            n += 1
    return n


def captadores_compativeis_com_projeto(nome_fantasia: Optional[str]) -> set[str]:
    """Conjunto normalizado de rotulos que equivalem a este projeto."""
    rotulo = rotulo_captador_de_projeto(nome_fantasia)
    out = {_norm_cap(rotulo), _norm_cap(nome_fantasia)}
    codigo = codigo_projeto_metas(nome_fantasia) or codigo_projeto_metas(rotulo)
    if codigo:
        out.add(_norm_cap(codigo))
    for alias, dest in ALIASES_PROJETO_METAS.items():
        if _norm_cap(dest) in out or _norm_cap(alias) in out:
            out.add(_norm_cap(alias))
            out.add(_norm_cap(dest))
    if "SEDE" in out or _norm_cap("SEDE AEB") in out:
        out.update({_norm_cap("SEDE"), _norm_cap("SEDE AEB")})
    return {x for x in out if x}


def vinculo_pertence_ao_projeto(captador: Optional[str], nome_fantasia: Optional[str]) -> bool:
    if not captador or not nome_fantasia:
        return False
    return _norm_cap(captador) in captadores_compativeis_com_projeto(nome_fantasia)


async def buscar_projeto_por_captador(
    db: AsyncSession,
    organizacao_id: str,
    captador: str,
) -> Optional[InstituicaoDB]:
    """Localiza instituicao da org cujo nome casa com o captador."""
    if not organizacao_id or not captador:
        return None
    rows = (
        await db.execute(
            select(InstituicaoDB).where(InstituicaoDB.organizacao_id == organizacao_id)
        )
    ).scalars().all()
    # Match direto / aliases / codigo metas
    for row in rows:
        if vinculo_pertence_ao_projeto(captador, row.nome_fantasia):
            return row
    return None


async def garantir_agente_para_projeto(
    db: AsyncSession,
    organizacao_id: str,
    nome_fantasia: str,
) -> dict:
    """Garante linha em nfp_agentes_captadores para o projeto (novo ou existente)."""
    rotulo = rotulo_captador_de_projeto(nome_fantasia) or (nome_fantasia or "").strip()
    if not organizacao_id or not rotulo:
        return {"criado": False, "rotulo": rotulo}

    codigo = normalizar_agente_captacao(rotulo)
    existente = (
        await db.execute(
            select(NfpAgenteCaptadorDB).where(
                NfpAgenteCaptadorDB.organizacao_id == organizacao_id,
                NfpAgenteCaptadorDB.codigo == codigo,
            )
        )
    ).scalar_one_or_none()
    if existente:
        return {"criado": False, "rotulo": rotulo, "agente_id": existente.id}

    from nfp_service import proximo_numero_cadastro_agente

    agora = agora_operacional_naive()
    proximo = await proximo_numero_cadastro_agente(db, organizacao_id)
    row = NfpAgenteCaptadorDB(
        organizacao_id=organizacao_id,
        numero_cadastro=proximo,
        codigo=codigo,
        tipo="PJ",
        nome=rotulo,
        nome_fantasia=(nome_fantasia or "").strip() or None,
        percentual_agente=percentual_agente_padrao(codigo),
        ativo=True,
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(row)
    await db.flush()
    return {"criado": True, "rotulo": rotulo, "agente_id": row.id}
