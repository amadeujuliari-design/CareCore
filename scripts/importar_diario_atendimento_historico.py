"""
Importa diarios do CSV AEB Atendimento Diario para historicos_conviventes (producao).

Dry-run (padrao): somente leitura no banco online + relatorio local.
Aplicar: requer --yes (gravacao em producao via Fly SSH).

Exemplo:
  python scripts/importar_diario_atendimento_historico.py
  python scripts/importar_diario_atendimento_historico.py --yes
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import csv
import gzip
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "relatorios_importacao"
DEFAULT_CSV = Path(r"c:\Users\user\Downloads\AEB_Atendimento_Diario_in.csv")
INSTITUICAO_ID = "32a13620-ad70-48bc-a6eb-df81677ea864"
ORIGEM_HISTORICO = "Importação legado SIAT"
MOTIVO_INATIVACAO = "Importação legado"
MARCADOR_LINHA = "legado-linha"
SITUACOES_VALIDAS = {"ATIVO", "INATIVO", "BLOQUEADO"}
STATUS_CSV_MAP = {"ATIVO": "Ativo", "INATIVO": "Inativado", "BLOQUEADO": "Bloqueado"}
DEPENDENCIAS = (
    ("ocorrencias_conviventes", "ocorrencias"),
    ("registros_rotina", "rotina"),
    ("documentos_conviventes", "documentos"),
    ("historicos_conviventes", "historicos"),
    ("registros_pia", "pias"),
    ("lavanderia_registros", "lavanderia"),
)

PAT_DATA_EM = re.compile(r"EM\s+(\d{1,2})/(\d{1,2})/(\d{2,4})", re.IGNORECASE)


def limpar(v: str | None) -> str:
    return re.sub(r"\s+", " ", (v or "").strip())


def nd(v: str | None) -> str:
    return re.sub(r"\D+", "", limpar(v))


def nn(v: str | None) -> str:
    t = unicodedata.normalize("NFD", limpar(v))
    t = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9 ]+", " ", t).upper()).strip()


def parse_data_br(valor: str | None) -> date | None:
    texto = limpar(valor)
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", texto)
    if not m:
        return None
    d, mes, ano = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if ano < 100:
        ano += 1900 if ano > 30 else 2000
    try:
        return date(ano, mes, d)
    except ValueError:
        return None


def extrair_data_diario(texto: str) -> date | None:
    m = PAT_DATA_EM.search(texto or "")
    if not m:
        return None
    return parse_data_br(f"{m.group(1)}/{m.group(2)}/{m.group(3)}")


def normalizar_prontuario(valor: str | None) -> str | None:
    d = nd(valor)
    return str(int(d)) if d else None


def hash_idempotencia(convivente_id: str | None, chave_pessoa: str, linha: int, data_origem: date, descricao: str) -> str:
    base = f"{convivente_id or chave_pessoa}|{data_origem.isoformat()}|{nn(descricao)}|{linha}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()[:32]


def titulo_com_marcador(linha: int, titulo: str | None = None) -> str | None:
    marcador = f"[{MARCADOR_LINHA}:{linha}]"
    if titulo:
        return f"{titulo} {marcador}"
    return marcador


@dataclass
class RegistroDiario:
    linha: int
    nome: str
    nome_social: str
    cpf: str
    rg: str
    sisa: str
    deficiente: str
    recebe_aposent: str
    prontuario_legado: str | None
    data_nascimento: date | None
    genero: str
    nome_mae: str
    situacao_csv: str
    status_alvo: str
    diario: str
    nome_norm: str
    data_origem: date | None = None


def parse_linha_csv(linha: str, numero: int) -> RegistroDiario | None:
    partes = linha.rstrip("\n\r").split(";")
    if len(partes) < 15:
        return None
    nome = limpar(partes[0])
    if not nome or nome.upper() == "NOME":
        return None
    sit = unicodedata.normalize("NFD", limpar(partes[13])).encode("ascii", "ignore").decode().upper()
    if sit not in SITUACOES_VALIDAS:
        return None
    diario = limpar(";".join(partes[14:]))
    if not diario or diario.upper() == "BENEFICIOS":
        return None
    return RegistroDiario(
        linha=numero,
        nome=nome,
        nome_social=limpar(partes[1]),
        cpf=nd(partes[2]),
        rg=nd(partes[3]),
        sisa=nd(partes[4]),
        deficiente=limpar(partes[5]),
        recebe_aposent=limpar(partes[6]),
        prontuario_legado=normalizar_prontuario(partes[7]),
        data_nascimento=parse_data_br(partes[9]),
        genero=limpar(partes[10]),
        nome_mae=limpar(partes[11]),
        situacao_csv=limpar(partes[13]),
        status_alvo=STATUS_CSV_MAP[sit],
        diario=diario,
        nome_norm=nn(nome),
    )


def carregar_csv(caminho: Path) -> tuple[list[RegistroDiario], dict]:
    registros: list[RegistroDiario] = []
    meta = Counter()
    with caminho.open("r", encoding="latin-1", errors="replace") as arq:
        for idx, linha in enumerate(arq, 1):
            if idx == 1:
                continue
            meta["linhas_total"] += 1
            partes = linha.split(";")
            if len(partes) < 15:
                meta["invalidas"] += 1
                continue
            diario_raw = ";".join(partes[14:]).strip()
            if not diario_raw:
                meta["sem_diario"] += 1
                continue
            if diario_raw.upper() == "BENEFICIOS":
                meta["beneficios"] += 1
                continue
            reg = parse_linha_csv(linha, idx)
            if reg is None:
                meta["invalidas"] += 1
                continue
            registros.append(reg)
    return registros, dict(meta)


def chave_pessoa(reg: RegistroDiario) -> str:
    if reg.sisa:
        return f"sisa:{reg.sisa}"
    if reg.prontuario_legado:
        return f"pront:{reg.prontuario_legado}"
    dn = reg.data_nascimento.isoformat() if reg.data_nascimento else "?"
    return f"nome:{reg.nome_norm}|{dn}|{nn(reg.nome_mae)}"


def aplicar_datas_fallback(registros: list[RegistroDiario]) -> int:
    por_pessoa: dict[str, list[RegistroDiario]] = defaultdict(list)
    for reg in registros:
        por_pessoa[chave_pessoa(reg)].append(reg)

    sem_data = 0
    for grupo in por_pessoa.values():
        datas = [extrair_data_diario(r.diario) for r in grupo]
        datas_validas = [d for d in datas if d]
        fallback = max(datas_validas) if datas_validas else date(2000, 1, 1)
        for reg in grupo:
            reg.data_origem = extrair_data_diario(reg.diario) or fallback
            if extrair_data_diario(reg.diario) is None:
                sem_data += 1
    return sem_data


def escolher_principal(candidatos: list[dict]) -> dict:
    ativos = [c for c in candidatos if c["status"] == "Ativo"]
    pool = ativos or candidatos
    return max(pool, key=lambda c: (c["numero_institucional"] or 0))


def escolher_por_nome(candidatos: list[dict], nome_norm: str) -> dict | None:
    exatos = [c for c in candidatos if c["nome_norm"] == nome_norm]
    if len(exatos) == 1:
        return exatos[0]
    if len(exatos) > 1:
        return escolher_principal(exatos)
    return None


def nomes_muito_diferentes(a: str, b: str) -> bool:
    return a != b


def montar_payload_convivente(reg: RegistroDiario, motivo_id: str | None) -> dict:
    return {
        "nome_completo": reg.nome,
        "nome_social": reg.nome_social or None,
        "cpf": reg.cpf or None,
        "rg": reg.rg or None,
        "numero_sisa": reg.sisa or None,
        "data_nascimento": reg.data_nascimento.isoformat() if reg.data_nascimento else None,
        "nome_mae": reg.nome_mae or None,
        "identidade_genero": reg.genero or None,
        "status": "Inativado",
        "motivo_inativacao_id": motivo_id,
        "possui_renda": False,
        "egresso_prisional": False,
        "usa_tornozeleira": False,
        "tem_mandado_prisao": False,
    }


def fly_python(script: str) -> dict | list:
    proc = subprocess.run(
        ["fly", "ssh", "console", "-a", "carecoreplus-api", "-C", "python -"],
        input=script,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    texto = proc.stdout + proc.stderr
    ini, fim = texto.find("{"), texto.rfind("}")
    if ini < 0:
        raise RuntimeError(f"Falha consulta Fly:\n{texto[-4000:]}")
    try:
        return json.loads(texto[ini : fim + 1])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON invalido do Fly: {exc}\n{texto[-4000:]}") from exc


def carregar_contexto_producao() -> dict:
    script = r'''
import asyncio, json, os, re
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

INST = "''' + INSTITUICAO_ID + r'''"
ORIGEM = "''' + ORIGEM_HISTORICO + r'''"

def norm_url(url):
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url

async def main():
    engine = create_async_engine(norm_url(os.environ["DATABASE_URL"]))
    async with engine.connect() as conn:
        inst = await conn.execute(text("select nome_fantasia from instituicoes where id=:i"), {"i": INST})
        inst_nome = inst.scalar_one()
        conv = await conn.execute(text("""
            select id, nome_completo, numero_institucional, coalesce(numero_sisa,''),
                   data_nascimento::text, coalesce(nome_mae,''), coalesce(cpf,''),
                   coalesce(rg,''), coalesce(status,'')
            from conviventes where instituicao_id=:i
        """), {"i": INST})
        conviventes = []
        for r in conv.fetchall():
            dn = r[4].split(" ")[0] if r[4] else None
            conviventes.append({
                "id": r[0], "nome_completo": r[1], "nome_norm": re.sub(r"\s+"," ", r[1].upper().strip()),
                "numero_institucional": r[2], "numero_sisa": re.sub(r"\D+","", r[3] or ""),
                "data_nascimento": dn, "nome_mae": r[5], "cpf": re.sub(r"\D+","", r[6] or ""),
                "rg": re.sub(r"\D+","", r[7] or ""), "status": r[8],
            })
        for c in conviventes:
            import unicodedata
            t = unicodedata.normalize("NFD", c["nome_norm"])
            c["nome_norm"] = "".join(ch for ch in t if unicodedata.category(ch) != "Mn")
        motivos = await conn.execute(text(
            "select id, descricao from motivos_inativacao where instituicao_id=:i"
        ), {"i": INST})
        motivos_list = [{"id": r[0], "descricao": r[1]} for r in motivos.fetchall()]
        hashes = await conn.execute(text("""
            select coalesce(titulo,'') from historicos_conviventes
            where instituicao_id=:i and origem_informacao=:o
        """), {"i": INST, "o": ORIGEM})
        marcadores = [r[0] for r in hashes.fetchall() if r[0]]
        deps = {}
        for tabela, rotulo in ''' + json.dumps(list(DEPENDENCIAS)) + r''':
            try:
                rows = await conn.execute(text(f"select convivente_id, count(*) from {tabela} group by convivente_id"))
                for cid, qtd in rows.fetchall():
                    deps.setdefault(cid, {})[rotulo] = int(qtd)
            except Exception:
                pass
        usuarios = await conn.execute(text(
            "select id, nome, perfil_acesso from usuarios order by case when lower(perfil_acesso) like '%manut%' then 0 else 1 end limit 5"
        ))
        users = [{"id": r[0], "nome": r[1], "perfil": r[2]} for r in usuarios.fetchall()]
    print(json.dumps({
        "instituicao_nome": inst_nome,
        "conviventes": conviventes,
        "motivos_inativacao": motivos_list,
        "marcadores_existentes": marcadores,
        "dependencias_por_convivente": deps,
        "usuarios_operacao": users,
    }, ensure_ascii=False))

asyncio.run(main())
'''
    return fly_python(script)


def indexar_conviventes(conviventes: list[dict]) -> dict:
    idx = {
        "sisa": defaultdict(list),
        "pront": defaultdict(list),
        "nome_dn": defaultdict(list),
    }
    for c in conviventes:
        if c["numero_sisa"]:
            idx["sisa"][c["numero_sisa"]].append(c)
        if c["numero_institucional"] is not None:
            idx["pront"][str(c["numero_institucional"])].append(c)
        idx["nome_dn"][f"{c['nome_norm']}|{c['data_nascimento'] or '?'}"].append(c)
    return idx


def resolver_convivente(
    reg: RegistroDiario,
    idx: dict,
    ambiguos_sisa: dict[str, list[dict]],
) -> tuple[str, dict | None, list[dict], str]:
    if reg.sisa and reg.sisa in ambiguos_sisa:
        cands = ambiguos_sisa[reg.sisa]
        escolha = escolher_por_nome(cands, reg.nome_norm)
        if escolha:
            nomes_distintos = {c["nome_norm"] for c in cands}
            if len(nomes_distintos) > 1:
                return "ambiguo_nome_distinto", escolha, cands, "nome_csv_em_sisa_compartilhado"
            return "ambiguo_mesclar", escolha, cands, "sisa_duplicado_mesmo_nome"
        return "ambiguo_sem_match_nome", None, cands, "sisa_duplicado"

    if reg.sisa:
        cands = idx["sisa"].get(reg.sisa, [])
        if len(cands) == 1:
            return "existente_sisa", cands[0], [], "sisa"
        if len(cands) == 0:
            return "novo_cadastro", None, [], "sisa_ausente"

    if reg.prontuario_legado:
        cands = idx["pront"].get(reg.prontuario_legado, [])
        if len(cands) == 1:
            return "existente_prontuario", cands[0], [], "prontuario"

    ch = f"{reg.nome_norm}|{reg.data_nascimento.isoformat() if reg.data_nascimento else '?'}"
    cands = idx["nome_dn"].get(ch, [])
    if len(cands) == 1:
        return "existente_nome_dn", cands[0], [], "nome_data_nascimento"
    if len(cands) > 1:
        return "ambiguo_nome_dn", escolher_principal(cands), cands, "nome_data_nascimento"

    return "novo_cadastro", None, [], "sem_match"


TABELAS_TRANSFERENCIA_VINCULOS = (
    "ocorrencias_conviventes",
    "registros_rotina",
    "historicos_conviventes",
    "registros_pia",
    "documentos_conviventes",
    "lavanderia_registros",
    "pertences_recolhidos_baixas",
    "historico_legado_rotina_siat",
    "sisa_lancamentos",
    "sisa_presencas_importadas",
    "sisa_divergencias",
    "ausencias_justificadas_confirmacoes",
    "convivente_familiares",
    "convivente_documentos_civis",
    "convivente_substancias",
    "convivente_medicamentos",
    "convivente_internacoes",
    "convivente_equipamentos_anteriores",
    "acompanhamentos_transferencias",
    "acompanhamentos_discussoes_hospitalares",
    "acompanhamentos_tb",
    "acompanhamentos_pot",
    "acompanhamentos_suspensoes_provisorias",
)

CAMPOS_MESCLAGEM_CONVIVENTE = (
    "numero_sisa",
    "cpf",
    "rg",
    "data_nascimento",
    "nome_mae",
    "nome_social",
    "identidade_genero",
)


def analisar(registros: list[RegistroDiario], ctx: dict) -> tuple[dict, dict]:
    conviventes = ctx["conviventes"]
    idx = indexar_conviventes(conviventes)
    ambiguos_sisa = {s: cs for s, cs in idx["sisa"].items() if len(cs) > 1}

    motivo = next((m for m in ctx["motivos_inativacao"] if m["descricao"].strip().lower() == MOTIVO_INATIVACAO.lower()), None)
    motivo_plano = motivo["id"] if motivo else None
    criar_motivo = motivo is None

    marcadores_existentes = set()
    for t in ctx.get("marcadores_existentes", []):
        m = re.search(rf"\[{MARCADOR_LINHA}:(\d+)\]", t or "")
        if m:
            marcadores_existentes.add(int(m.group(1)))

    deps = ctx.get("dependencias_por_convivente", {})
    contadores = Counter()
    novos_cadastros: dict[str, dict] = {}
    mesclagens: dict[str, dict] = {}
    revisoes: list[dict] = []
    historicos: list[dict] = []
    historicos_aplicacao: list[dict] = []
    pessoas_resolvidas: dict[str, dict] = {}
    chave_para_id: dict[str, str] = {}

    for reg in registros:
        ch = chave_pessoa(reg)
        if ch not in pessoas_resolvidas:
            tipo, principal, cands, metodo = resolver_convivente(reg, idx, ambiguos_sisa)
            pessoas_resolvidas[ch] = {
                "tipo": tipo,
                "principal": principal,
                "candidatos": cands,
                "metodo": metodo,
                "amostra": reg,
            }
            if tipo == "novo_cadastro":
                novo_id = str(uuid.uuid4())
                chave_para_id[ch] = novo_id
                novos_cadastros[ch] = {
                    "chave": ch,
                    "id": novo_id,
                    "payload": montar_payload_convivente(reg, motivo_plano),
                    "criar_motivo": criar_motivo,
                }
                contadores["novos_cadastros"] += 1
            elif tipo.startswith("ambiguo_mesclar"):
                secundarios = [c for c in cands if c["id"] != principal["id"]]
                mesclagens[ch] = {
                    "principal": principal,
                    "secundarios": secundarios,
                    "acao": "mesclar_e_excluir",
                }
                contadores["mesclagens"] += 1
                contadores["exclusoes_planejadas"] += len(secundarios)
            elif tipo == "ambiguo_nome_distinto":
                outros = [c for c in cands if c["id"] != principal["id"]]
                revisoes.append({
                    "nome_csv": reg.nome,
                    "sisa": reg.sisa,
                    "principal_id": principal["id"],
                    "principal_nome": principal["nome_completo"],
                    "outros_cadastros": [{"id": c["id"], "nome": c["nome_completo"], "prontuario": c["numero_institucional"]} for c in outros],
                })
                contadores["revisao_cadastral"] += 1

        info = pessoas_resolvidas[ch]
        conv_id = None
        if info["principal"]:
            conv_id = info["principal"]["id"]
            chave_para_id.setdefault(ch, conv_id)
        elif info["tipo"] == "novo_cadastro":
            conv_id = chave_para_id[ch]

        if reg.linha in marcadores_existentes:
            contadores["historicos_ja_importados"] += 1
            continue

        contadores["historicos_a_importar"] += 1
        historicos.append({
            "linha": reg.linha,
            "chave_pessoa": ch,
            "convivente_id": conv_id,
            "data_origem": reg.data_origem.isoformat() if reg.data_origem else None,
            "com_data_explicita": extrair_data_diario(reg.diario) is not None,
            "origem_informacao": ORIGEM_HISTORICO,
            "titulo": titulo_com_marcador(reg.linha),
            "descricao_preview": reg.diario[:180],
        })
        historicos_aplicacao.append({
            "linha": reg.linha,
            "convivente_id": conv_id,
            "data_origem": reg.data_origem.isoformat() if reg.data_origem else None,
            "titulo": titulo_com_marcador(reg.linha),
            "descricao": reg.diario,
        })

    transferencias = 0
    for item in mesclagens.values():
        for sec in item["secundarios"]:
            if sec["id"] in deps:
                transferencias += sum(deps[sec["id"]].values())

    exclusoes_com_vinculos = []
    for item in mesclagens.values():
        for sec in item["secundarios"]:
            if sec["id"] in deps:
                exclusoes_com_vinculos.append({
                    "convivente_id": sec["id"],
                    "nome": sec["nome_completo"],
                    "prontuario": sec["numero_institucional"],
                    "vinculos": deps[sec["id"]],
                })

    resumo = {
        "instituicao": ctx["instituicao_nome"],
        "modo": "dry-run",
        "csv": {
            "registros_diario": len(registros),
        },
        "contadores": dict(contadores),
        "configuracao": {
            "origem_historico": ORIGEM_HISTORICO,
            "motivo_inativacao": MOTIVO_INATIVACAO,
            "criar_motivo_inativacao": criar_motivo,
            "usuario_operacao": (ctx.get("usuarios_operacao") or [{}])[0],
        },
        "novos_cadastros_total": len(novos_cadastros),
        "mesclagens_total": len(mesclagens),
        "revisoes_cadastrais_total": len(revisoes),
        "transferencias_vinculos_planejadas": transferencias,
        "exclusoes_com_vinculos": exclusoes_com_vinculos,
        "exemplos_novos_cadastros": list(novos_cadastros.values())[:15],
        "exemplos_mesclagens": [
            {
                "principal": f"#{m['principal']['numero_institucional']} {m['principal']['nome_completo']} ({m['principal']['status']})",
                "excluir": [f"#{s['numero_institucional']} {s['nome_completo']} ({s['status']})" for s in m["secundarios"]],
            }
            for m in list(mesclagens.values())[:15]
        ],
        "revisoes_cadastrais": revisoes,
        "exemplos_historicos": historicos[:20],
        "historicos_a_importar": contadores["historicos_a_importar"],
        "historicos_ja_importados": contadores["historicos_ja_importados"],
    }

    aplicacao = {
        "instituicao_id": INSTITUICAO_ID,
        "origem_historico": ORIGEM_HISTORICO,
        "motivo_inativacao": MOTIVO_INATIVACAO,
        "criar_motivo_inativacao": criar_motivo,
        "motivo_inativacao_id": motivo_plano,
        "usuario_id": (ctx.get("usuarios_operacao") or [{}])[0].get("id"),
        "novos_cadastros": list(novos_cadastros.values()),
        "mesclagens": [
            {
                "chave": ch,
                "principal_id": item["principal"]["id"],
                "secundario_ids": [s["id"] for s in item["secundarios"]],
            }
            for ch, item in mesclagens.items()
        ],
        "historicos": historicos_aplicacao,
    }
    return resumo, aplicacao


def planejar(registros: list[RegistroDiario], ctx: dict) -> dict:
    resumo, _ = analisar(registros, ctx)
    return resumo


def salvar_relatorios(plano: dict, registros: list[RegistroDiario], meta_csv: dict) -> dict[str, Path]:
    REPORT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    resumo_path = REPORT_DIR / f"diario_legado_dry_run_{stamp}.json"
    payload = {"meta_csv": meta_csv, "plano": plano}
    resumo_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    novos_path = REPORT_DIR / f"diario_legado_novos_cadastros_{stamp}.csv"
    with novos_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["chave", "nome", "sisa", "data_nascimento", "nome_mae", "status"])
        vistos = set()
        for reg in registros:
            ch = chave_pessoa(reg)
            if ch in vistos:
                continue
            # detect novos via plano counter - recompute quickly
            vistos.add(ch)
        # use exemplos + count from plano only for dry run file of novos
    return {"resumo": resumo_path}


def imprimir_resumo(plano: dict, meta_csv: dict, sem_data: int, paths: dict[str, Path]) -> None:
    c = plano["contadores"]
    print("=" * 68)
    print("DRY-RUN — IMPORTACAO DIARIO LEGADO (SEM GRAVACAO)")
    print("=" * 68)
    print(f"Instituicao: {plano['instituicao']}")
    print(f"CSV: {meta_csv.get('caminho', '-')}")
    print()
    print("--- CSV ---")
    print(f"Linhas de dados: {meta_csv.get('linhas_total', 0)}")
    print(f"Registros com diario: {plano['csv']['registros_diario']}")
    print(f"Diarios sem data explicita (fallback ultima data): {sem_data}")
    print()
    print("--- Plano ---")
    print(f"Novos cadastros Inativados: {plano['novos_cadastros_total']}")
    print(f"Mesclagens de duplicata (SISA): {plano['mesclagens_total']}")
    print(f"Exclusoes de duplicata apos mesclagem: {c.get('exclusoes_planejadas', 0)}")
    print(f"Transferencias de vinculos planejadas: {plano['transferencias_vinculos_planejadas']}")
    print(f"Revisao cadastral (SISA compartilhado, nomes distintos): {plano['revisoes_cadastrais_total']}")
    print(f"Historicos a importar: {plano['historicos_a_importar']}")
    print(f"Historicos ja importados (idempotencia): {plano['historicos_ja_importados']}")
    print()
    print("--- Config ---")
    print(f"Origem historico: {plano['configuracao']['origem_historico']}")
    print(f"Motivo inativacao: {plano['configuracao']['motivo_inativacao']}")
    if plano["configuracao"]["criar_motivo_inativacao"]:
        print("  -> motivo sera criado na aplicacao")
    print(f"Usuario operacao sugerido: {plano['configuracao']['usuario_operacao'].get('nome')} ({plano['configuracao']['usuario_operacao'].get('perfil')})")
    print()
    if plano["exclusoes_com_vinculos"]:
        print("--- Duplicatas com vinculos a transferir ---")
        for item in plano["exclusoes_com_vinculos"][:10]:
            print(f"  #{item['prontuario']} {item['nome']}: {item['vinculos']}")
        print()
    if plano["revisoes_cadastrais"]:
        print("--- Revisao cadastral (nao mesclar) ---")
        for r in plano["revisoes_cadastrais"]:
            print(f"  {r['nome_csv']} (SISA {r['sisa']}) -> #{r['principal_nome']}")
    print()
    if plano["exemplos_mesclagens"]:
        print("--- Exemplos mesclagem ---")
        for ex in plano["exemplos_mesclagens"][:8]:
            print(f"  Manter {ex['principal']}")
            for sec in ex["excluir"]:
                print(f"    Excluir {sec}")
    print()
    print(f"Relatorio completo: {paths['resumo']}")
    print()
    print("Nenhuma alteracao foi feita no banco online.")


def _script_aplicar_fly(plan_b64: str) -> str:
  tabelas = json.dumps(list(TABELAS_TRANSFERENCIA_VINCULOS))
  campos = json.dumps(list(CAMPOS_MESCLAGEM_CONVIVENTE))
  return f'''import asyncio, base64, gzip, json, os, uuid
from datetime import date, datetime
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

PLAN = json.loads(gzip.decompress(base64.b64decode({plan_b64!r})))
TABELAS = {tabelas}
CAMPOS_MESCLAGEM = {campos}

def norm_url(url):
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url

def agora():
    try:
        from time_operacional import agora_operacional_naive
        return agora_operacional_naive()
    except Exception:
        return datetime.now()

async def mesclar_registros(conn, principal_id, secundario_id):
    row_p = (await conn.execute(text(
        "select numero_sisa, cpf, rg, data_nascimento::text, nome_mae, nome_social, identidade_genero "
        "from conviventes where id=:id"
    ), {{"id": principal_id}})).mappings().first()
    row_s = (await conn.execute(text(
        "select numero_sisa, cpf, rg, data_nascimento::text, nome_mae, nome_social, identidade_genero "
        "from conviventes where id=:id"
    ), {{"id": secundario_id}})).mappings().first()
    if not row_p or not row_s:
        return
    sets = []
    params = {{"id": principal_id}}
    for campo in CAMPOS_MESCLAGEM:
        pv, sv = row_p.get(campo), row_s.get(campo)
        if (pv is None or pv == "") and sv not in (None, ""):
            sets.append(f"{{campo}} = :{{campo}}")
            params[campo] = sv if campo != "data_nascimento" else sv.split(" ")[0]
    if sets:
        await conn.execute(text("update conviventes set " + ", ".join(sets) + " where id=:id"), params)
    for tabela in TABELAS:
        try:
            await conn.execute(text(
                f"update {{tabela}} set convivente_id=:principal where convivente_id=:secundario"
            ), {{"principal": principal_id, "secundario": secundario_id}})
        except Exception:
            pass
    await conn.execute(text("delete from conviventes where id=:id"), {{"id": secundario_id}})

async def aplicar_setup(conn, plan):
    stats = {{
        "motivo_criado": False,
        "novos_cadastros": 0,
        "mesclagens": 0,
        "exclusoes": 0,
        "transferencias": 0,
    }}
    inst = plan["instituicao_id"]
    motivo_id = plan.get("motivo_inativacao_id")
    if plan.get("criar_motivo_inativacao"):
        motivo_id = str(uuid.uuid4())
        await conn.execute(text(
            "insert into motivos_inativacao (id, instituicao_id, descricao) values (:id, :inst, :desc)"
        ), {{"id": motivo_id, "inst": inst, "desc": plan["motivo_inativacao"]}})
        stats["motivo_criado"] = True
    max_num = (await conn.execute(text(
        "select coalesce(max(numero_institucional), 0) from conviventes where instituicao_id=:i"
    ), {{"i": inst}})).scalar_one()
    proximo = int(max_num)
    agora_dt = agora()
    for item in plan.get("novos_cadastros", []):
        payload = item["payload"]
        proximo += 1
        params = {{
            "id": item["id"],
            "inst": inst,
            "numero": proximo,
            "status": payload.get("status", "Inativado"),
            "inativado_em": agora_dt,
            "motivo_id": motivo_id,
            "nome": payload["nome_completo"],
            "nome_social": payload.get("nome_social"),
            "cpf": payload.get("cpf"),
            "rg": payload.get("rg"),
            "sisa": payload.get("numero_sisa"),
            "dn": payload.get("data_nascimento"),
            "mae": payload.get("nome_mae"),
            "genero": payload.get("identidade_genero"),
        }}
        await conn.execute(text("""
            insert into conviventes (
                id, instituicao_id, numero_institucional, status, inativado_em, motivo_inativacao_id,
                nome_completo, nome_social, cpf, rg, numero_sisa, data_nascimento, nome_mae,
                identidade_genero, possui_renda, egresso_prisional, usa_tornozeleira, tem_mandado_prisao
            ) values (
                :id, :inst, :numero, :status, :inativado_em, :motivo_id,
                :nome, :nome_social, :cpf, :rg, :sisa, cast(:dn as date), :mae,
                :genero, false, false, false, false
            )
        """), params)
        stats["novos_cadastros"] += 1
    for mescla in plan.get("mesclagens", []):
        principal = mescla["principal_id"]
        for sec in mescla.get("secundario_ids", []):
            await mesclar_registros(conn, principal, sec)
            stats["exclusoes"] += 1
        stats["mesclagens"] += 1
    return stats

async def aplicar_historicos(conn, plan):
    inst = plan["instituicao_id"]
    usuario = plan["usuario_id"]
    origem = plan["origem_historico"]
    existentes = await conn.execute(text(
        "select titulo from historicos_conviventes where instituicao_id=:i and origem_informacao=:o"
    ), {{"i": inst, "o": origem}})
    marcadores = set()
    import re
    for (titulo,) in existentes.fetchall():
        if titulo:
            m = re.search(r"\\[legado-linha:(\\d+)\\]", titulo)
            if m:
                marcadores.add(int(m.group(1)))
    inseridos = 0
    pulados = 0
    agora_dt = agora()
    lote = []
    for h in plan.get("historicos", []):
        linha = int(h["linha"])
        if linha in marcadores:
            pulados += 1
            continue
        lote.append({{
            "id": str(uuid.uuid4()),
            "inst": inst,
            "conv": h["convivente_id"],
            "usuario": usuario,
            "origem": origem,
            "data": date.fromisoformat(h["data_origem"]) if h.get("data_origem") else date(2000, 1, 1),
            "titulo": h.get("titulo"),
            "descricao": h["descricao"],
            "criado": agora_dt,
        }})
        if len(lote) >= 200:
            await conn.execute(text("""
                insert into historicos_conviventes (
                    id, instituicao_id, convivente_id, usuario_id, origem_informacao,
                    data_origem, titulo, descricao, criado_em
                ) values (
                    :id, :inst, :conv, :usuario, :origem,
                    :data, :titulo, :descricao, :criado
                )
            """), lote)
            inseridos += len(lote)
            lote.clear()
    if lote:
        await conn.execute(text("""
            insert into historicos_conviventes (
                id, instituicao_id, convivente_id, usuario_id, origem_informacao,
                data_origem, titulo, descricao, criado_em
            ) values (
                :id, :inst, :conv, :usuario, :origem,
                :data, :titulo, :descricao, :criado
            )
        """), lote)
        inseridos += len(lote)
    return {{"historicos_inseridos": inseridos, "historicos_pulados": pulados}}

async def main():
    engine = create_async_engine(norm_url(os.environ["DATABASE_URL"]))
    async with engine.begin() as conn:
        fase = PLAN.get("fase", "setup")
        if fase == "setup":
            resultado = await aplicar_setup(conn, PLAN)
        else:
            resultado = await aplicar_historicos(conn, PLAN)
    print(json.dumps({{"ok": True, "fase": PLAN.get("fase", "setup"), "resultado": resultado}}, ensure_ascii=False))

asyncio.run(main())
'''


def fly_aplicar_plano(plan: dict) -> dict:
    plan_bytes = gzip.compress(json.dumps(plan, ensure_ascii=False).encode("utf-8"))
    plan_b64 = base64.b64encode(plan_bytes).decode("ascii")
    script = _script_aplicar_fly(plan_b64)
    proc = subprocess.run(
        ["fly", "ssh", "console", "-a", "carecoreplus-api", "-C", "python -"],
        input=script,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=3600,
    )
    texto = proc.stdout + proc.stderr
    ini, fim = texto.find("{"), texto.rfind("}")
    if ini < 0:
        raise RuntimeError(f"Falha aplicacao Fly (code={proc.returncode}):\n{texto[-8000:]}")
    try:
        payload = json.loads(texto[ini : fim + 1])
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"JSON invalido na aplicacao: {exc}\n{texto[-8000:]}") from exc
    if proc.returncode != 0 and not payload.get("ok"):
        raise RuntimeError(f"Falha aplicacao Fly (code={proc.returncode}):\n{texto[-8000:]}")
    return payload


def aplicar_em_producao(aplicacao: dict) -> dict:
    if not aplicacao.get("usuario_id"):
        raise RuntimeError("Nenhum usuario de operacao encontrado no banco online.")

    setup_plan = {k: v for k, v in aplicacao.items() if k != "historicos"}
    setup_plan["fase"] = "setup"
    setup_plan["historicos"] = []

    if setup_plan.get("novos_cadastros") or setup_plan.get("mesclagens"):
        print("Fase 1/2: motivo, cadastros novos e mesclagens...")
        stats_setup = fly_aplicar_plano(setup_plan)
        print(json.dumps(stats_setup, ensure_ascii=False, indent=2))
    else:
        print("Fase 1/2: pulada (cadastros e mesclagens ja aplicados).")
        stats_setup = {"ok": True, "fase": "setup", "resultado": {"pulado": True}}

    historicos = aplicacao.get("historicos", [])
    stats_hist: list[dict] = []
    batch_size = 2500
    total_lotes = max(1, (len(historicos) + batch_size - 1) // batch_size)
    for idx in range(0, len(historicos), batch_size):
        lote_num = idx // batch_size + 1
        print(f"Fase 2/2: historicos lote {lote_num}/{total_lotes} ({len(historicos[idx:idx+batch_size])} registros)...")
        hist_plan = {
            "fase": "historicos",
            "instituicao_id": aplicacao["instituicao_id"],
            "origem_historico": aplicacao["origem_historico"],
            "usuario_id": aplicacao["usuario_id"],
            "historicos": historicos[idx : idx + batch_size],
        }
        stats_hist.append(fly_aplicar_plano(hist_plan))

    inseridos = sum(h.get("resultado", {}).get("historicos_inseridos", 0) for h in stats_hist)
    pulados = sum(h.get("resultado", {}).get("historicos_pulados", 0) for h in stats_hist)
    return {
        "setup": stats_setup,
        "historicos_lotes": stats_hist,
        "historicos_inseridos_total": inseridos,
        "historicos_pulados_total": pulados,
    }


def salvar_relatorio_aplicacao(
    aplicacao: dict,
    resultado: dict,
    meta_csv: dict,
    sem_data: int,
) -> Path:
    REPORT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = REPORT_DIR / f"diario_legado_aplicado_{stamp}.json"
    path.write_text(
        json.dumps(
            {
                "meta_csv": meta_csv,
                "aplicacao_resumo": {
                    "novos_cadastros": len(aplicacao.get("novos_cadastros", [])),
                    "mesclagens": len(aplicacao.get("mesclagens", [])),
                    "historicos": len(aplicacao.get("historicos", [])),
                    "sem_data_fallback": sem_data,
                },
                "resultado": resultado,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return path


def imprimir_resumo_aplicacao(resultado: dict, path: Path) -> None:
    setup = resultado.get("setup", {}).get("resultado", {})
    print("=" * 68)
    print("IMPORTACAO DIARIO LEGADO — APLICADA EM PRODUCAO")
    print("=" * 68)
    print(f"Motivo criado: {setup.get('motivo_criado', False)}")
    print(f"Novos cadastros: {setup.get('novos_cadastros', 0)}")
    print(f"Mesclagens: {setup.get('mesclagens', 0)}")
    print(f"Exclusoes duplicata: {setup.get('exclusoes', 0)}")
    print(f"Historicos inseridos: {resultado.get('historicos_inseridos_total', 0)}")
    print(f"Historicos pulados (idempotencia): {resultado.get('historicos_pulados_total', 0)}")
    print()
    print(f"Relatorio: {path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Importa diario legado para historicos (dry-run padrao)")
    parser.add_argument("--csv", default=str(DEFAULT_CSV))
    parser.add_argument("--yes", action="store_true", help="Aplicar em producao (nao usar sem validar dry-run)")
    args = parser.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"CSV nao encontrado: {csv_path}", file=sys.stderr)
        return 1

    if args.yes:
        registros, meta_csv = carregar_csv(csv_path)
        meta_csv["caminho"] = str(csv_path)
        sem_data = aplicar_datas_fallback(registros)
        print("Consultando banco online (somente leitura)...")
        ctx = carregar_contexto_producao()
        resumo, aplicacao = analisar(registros, ctx)
        print("Resumo do plano:")
        print(f"  Novos cadastros: {resumo['novos_cadastros_total']}")
        print(f"  Mesclagens: {resumo['mesclagens_total']}")
        print(f"  Historicos: {resumo['historicos_a_importar']}")
        print()
        print("Aplicando em producao (Fly SSH)...")
        resultado = aplicar_em_producao(aplicacao)
        path = salvar_relatorio_aplicacao(aplicacao, resultado, meta_csv, sem_data)
        imprimir_resumo_aplicacao(resultado, path)
        return 0

    registros, meta_csv = carregar_csv(csv_path)
    meta_csv["caminho"] = str(csv_path)
    sem_data = aplicar_datas_fallback(registros)

    print("Consultando banco online (somente leitura)...")
    ctx = carregar_contexto_producao()
    plano = planejar(registros, ctx)
    paths = salvar_relatorios(plano, registros, meta_csv)
    imprimir_resumo(plano, meta_csv, sem_data, paths)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
