"""Chave e busca de itens de consumo."""

from __future__ import annotations

import re
import unicodedata
from typing import Iterable


PACK_WORDS = {
    "FARDO", "FARDOS", "CX", "CAIXA", "CAIXAS", "PACOTE", "PACOTES", "PCT",
    "UN", "UNI", "UNID", "UNIDADE", "UNIDADES", "KG", "GR", "GRAMAS", "G",
    "ML", "L", "LITRO", "LITROS", "BALDE", "ROLO", "ROLOS", "SACO", "SACOS",
    "TP", "TIPO", "C", "DE", "DA", "DO", "COM", "PARA",
}


def _sem_acento(texto: str) -> str:
    nfd = unicodedata.normalize("NFD", texto or "")
    return "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")


def chave_item_consumo(texto: str) -> str:
    t = _sem_acento(texto).upper()
    t = re.sub(r"[^A-Z0-9]+", " ", t)
    t = re.sub(r"\d+", " ", t)
    tokens = [tok for tok in t.split() if tok not in PACK_WORDS]
    chave = " ".join(tokens).strip()
    if chave:
        return chave
    fallback = re.sub(r"\s+", " ", _sem_acento(texto).upper()).strip()
    return fallback[:80] or "ITEM"


def normalizar_busca(texto: str) -> str:
    return re.sub(r"\s+", " ", _sem_acento(texto).lower()).strip()


def item_bate_busca(item: dict, termo: str) -> bool:
    if not termo:
        return True
    blob = " ".join(
        str(item.get(k) or "")
        for k in ("descricao", "marca_preferencial", "observacao", "unidade_medida", "embalagem", "categoria_nome")
    )
    return termo in normalizar_busca(blob)


def filtrar_itens_consumo(
    itens: Iterable[dict],
    *,
    busca: str = "",
    categoria_id: str = "",
    status: str = "ativo",
) -> list[dict]:
    termo = normalizar_busca(busca)
    saida = []
    for item in itens:
        if status == "ativo" and not item.get("ativo", True):
            continue
        if status == "inativo" and item.get("ativo", True):
            continue
        if categoria_id and item.get("categoria_id") != categoria_id:
            continue
        if not item_bate_busca(item, termo):
            continue
        saida.append(item)
    return saida


_MARCAS_LIXO = {
    "MARCA C / NECESSITE",
    "MARCA C/NECESSITE",
    "MARCA C / NECESSITE.",
    "O MAIS BARATO",
    "A MAIS BARATA",
    "A MAIS BARATA / O MAIS BARATO",
}

_OBS_LIXO = {"OBSERVACOES", "OBSERVAÇÕES", "OBSERVACAO", "OBSERVAÇÃO"}

_DESC_LIXO = {
    "ALIMENTACAO VERBA MENSAL",
    "ALIMENTACAO INDIRETO",
    "ALIMENTACAO - DIETA ESPECIAL",
    "ALIMENTACAO DIETA ESPECIAL",
    "ALIMENTACAO VERBA MENSAL - FRIOS",
    "ALIMENTACAO LEITE",
}

_RE_SO_TAMANHO = re.compile(
    r"^\d+(\s*(e|,|/)\s*\d+)*\s+(grande|grandes|pequena|pequenas|medio|medios|média|medias)s?"
    r"(\s+e\s+\d+\s+(grande|grandes|pequena|pequenas|medio|medios))?s?\s*$",
    re.I,
)

_RE_EMB_PAREN = re.compile(
    r"\(([^)]*(?:caixa|cx|pacote|pct|fardo|unid|\bun\b|kg|ml|litro)[^)]*)\)",
    re.I,
)

_RE_EMB_PEDACOS = [
    re.compile(
        r"[-–—,;(]?\s*(?:fardo|caixa|cx|pct[s]?|pacotes?|balde|saco|rolo)\s*"
        r"(?:c/?|com)?\s*\d[\d.,]*\s*"
        r"(?:unidades?(?:\s+de\s+\d[\d.,]*\s*kgs?)?|un(?:id)?|kg|g|ml|l)?\s*\)?\s*$",
        re.I,
    ),
    re.compile(r"[-–—,;(]?\s*(?:caixa|cx|pct|pacote|fardo)\s+com\s+\d+\b.*$", re.I),
    re.compile(r"[-–—]?\s*pct\s*\d+\s*un(?:id(?:ades?)?)?\s*$", re.I),
    re.compile(r"[-–—,;(]?\s*c/\s*\d+\s*(?:un(?:id(?:ades?)?)?)?\s*$", re.I),
    re.compile(
        r"[-–—,;(]?\s*\d+[\d.,]*\s*(?:kilos?|kgs?|gramas?|grs?|g|mls?|litros?|l|metros?|mts?|m|un(?:id(?:ades?)?)?)\s*$",
        re.I,
    ),
    re.compile(r"[-–—,;(]?\s*balde\s*\d+[\d.,]*\s*kgs?\s*$", re.I),
]

_RE_EMB_INICIO = re.compile(
    r"^\s*(\d+[\d.,]*\s*(?:kilos?|kgs?|gramas?|grs?|g|mls?|litros?|l|metros?|mts?|m))\s+",
    re.I,
)

_RE_EMB_OBS = re.compile(
    r"^(caixa\s+com\s+\d+|pct\s*\d+\s*kg|pct\s+de\s+\d+\s*kg|pacote|fardo|1\s*fd|"
    r"\d+[\d.,]*\s*(?:kg|g|ml|l|unid|un)|frado\s+com\s+\d+|c/\s*\d+)\b",
    re.I,
)

_RE_PERCENTUAL = re.compile(r"\d+\s*%")


def _titulo_item(texto: str) -> str:
    t = re.sub(r"\s+", " ", (texto or "").strip(" -–—,;/"))
    if not t:
        return ""
    letras = [c for c in t if c.isalpha()]
    if letras and (sum(1 for c in letras if c.isupper()) / len(letras)) > 0.7:
        pequenos = {"de", "da", "do", "das", "dos", "e", "com", "para", "em", "a", "o", "s"}
        partes = t.lower().split()
        out = []
        for i, parte in enumerate(partes):
            if i > 0 and parte in pequenos:
                out.append(parte)
            else:
                out.append(parte[:1].upper() + parte[1:])
        return " ".join(out)
    return t


def _juntar_embalagem(*partes: str) -> str:
    vistos = []
    chaves = set()
    for parte in partes:
        texto = re.sub(r"\s+", " ", (parte or "").strip(" -–—,;()"))
        if not texto:
            continue
        chave = normalizar_busca(texto)
        if chave in chaves:
            continue
        chaves.add(chave)
        vistos.append(texto)
    return " · ".join(vistos)


def _inferir_unidade(embalagem: str, atual: str = "") -> str:
    if (atual or "").strip():
        return sanitizar_unidade_medida(atual)
    u = _sem_acento(embalagem).upper()
    if "FARDO" in u:
        return "fardo"
    if "CAIXA" in u or re.search(r"\bCX\b", u):
        return "cx"
    if "BALDE" in u:
        return "un"
    if "PACOTE" in u or re.search(r"\bPCT\b", u):
        return "pct"
    if re.search(r"\bKG\b", u) and not re.search(r"\b(UN|CX|PCT|FARDO)\b", u):
        return "kg"
    if re.search(r"\b(ML)\b", u) and not re.search(r"\b(UN|CX|PCT|FARDO|KG)\b", u):
        return "ml"
    if re.search(r"\b(L|LT|LITRO)\b", u) and not re.search(r"\b(UN|CX|PCT|FARDO|KG|ML)\b", u):
        return "l"
    if re.search(r"\b(M|MT|METRO)\b", u) and not re.search(r"\b(UN|CX|PCT|FARDO|KG|ML|L)\b", u):
        return "m"
    return "un" if embalagem else ""


# Códigos canônicos de unidade no cadastro de item de consumo.
UNIDADES_MEDIDA_ITEM = ("un", "kg", "pct", "cx", "fardo", "rolo", "l", "ml", "g", "m")

_ALIAS_UNIDADE_MEDIDA = {
    "und": "un",
    "uni": "un",
    "unid": "un",
    "unidade": "un",
    "unidades": "un",
    "u": "un",
    "quilo": "kg",
    "quilos": "kg",
    "kilo": "kg",
    "kilos": "kg",
    "kilograma": "kg",
    "quilograma": "kg",
    "pc": "pct",
    "pcte": "pct",
    "pacote": "pct",
    "pacotes": "pct",
    "caixa": "cx",
    "caixas": "cx",
    "fardos": "fardo",
    "rolos": "rolo",
    "lt": "l",
    "litro": "l",
    "litros": "l",
    "gr": "g",
    "grama": "g",
    "gramas": "g",
    "mt": "m",
    "metro": "m",
    "metros": "m",
    "balde": "un",
    "baldes": "un",
}


def sanitizar_unidade_medida(valor: str | None) -> str | None:
    """Normaliza variantes (KG, und, quilo…) para o código da lista oficial."""
    texto = (valor or "").strip().lower().replace(".", "")
    if not texto:
        return None
    if texto in UNIDADES_MEDIDA_ITEM:
        return texto
    mapped = _ALIAS_UNIDADE_MEDIDA.get(texto)
    if mapped:
        return mapped
    # "und." / espaços extras já tratados; tenta prefixo conhecido
    for alias, canonico in _ALIAS_UNIDADE_MEDIDA.items():
        if texto.startswith(alias):
            return canonico
    return "un"


def _obs_e_embalagem(observacao: str) -> tuple[str, str]:
    obs = re.sub(r"\s+", " ", (observacao or "").strip())
    if not obs:
        return "", ""
    if _sem_acento(obs).upper() in _OBS_LIXO:
        return "", ""
    if _RE_EMB_OBS.match(obs) or _sem_acento(obs).upper() in {"PACOTE", "FARDO", "CAIXA"}:
        return "", obs
    return obs, ""


def _extrair_embalagem_descricao(descricao: str) -> tuple[str, str]:
    texto = re.sub(r"\s+", " ", (descricao or "").strip())
    embalagens: list[str] = []
    mudou = True
    while mudou and texto:
        mudou = False
        m = _RE_EMB_PAREN.search(texto)
        if m and not _RE_PERCENTUAL.search(m.group(1)):
            embalagens.append(m.group(1).strip())
            texto = (texto[: m.start()] + " " + texto[m.end() :]).strip()
            mudou = True
            continue
        for padrao in _RE_EMB_PEDACOS:
            m = padrao.search(texto)
            if not m:
                continue
            trecho = m.group(0).strip(" -–—,;()")
            # "70%" / "50%" não é embalagem
            if _RE_PERCENTUAL.search(trecho) and not re.search(r"\b(kg|g|ml|l|un)\b", trecho, re.I):
                continue
            # "Aptanutri 3" — dígito solto sem unidade
            if re.fullmatch(r"\d+", trecho.strip()):
                continue
            embalagens.append(trecho)
            texto = texto[: m.start()].strip(" -–—,;(")
            mudou = True
            break
        if mudou:
            continue
        m = _RE_EMB_INICIO.match(texto)
        if m:
            embalagens.append(m.group(1).strip())
            texto = texto[m.end() :].strip()
            mudou = True
    return texto, _juntar_embalagem(*reversed(embalagens))


def item_consumo_eh_lixo(descricao: str, *, marca: str = "", observacao: str = "") -> bool:
    desc = _sem_acento(descricao).upper().strip()
    desc = re.sub(r"\s+", " ", desc)
    if not desc or len(desc) < 3:
        return True
    if desc in _DESC_LIXO or desc.startswith("ALIMENTACAO VERBA"):
        return True
    if _RE_SO_TAMANHO.match(desc):
        return True
    marca_n = re.sub(r"\s+", " ", _sem_acento(marca).upper())
    obs_n = _sem_acento(observacao).upper().strip()
    if "MARCA C" in marca_n and "NECESSITE" in marca_n and obs_n in _OBS_LIXO:
        return True
    chave = chave_item_consumo(descricao)
    if chave in {"ITEM"} or len(chave) < 3:
        return True
    if set(chave.split()) <= {"GRANDE", "PEQUENA", "PEQUENAS", "PEQUENO", "MEDIO", "MEDIA"}:
        return True
    return False


def limpar_item_consumo(
    *,
    descricao: str,
    unidade_medida: str = "",
    marca_preferencial: str = "",
    observacao: str = "",
    embalagem: str = "",
) -> dict:
    """Separa embalagem da descrição e marca lixo de planilha."""
    marca = re.sub(r"\s+", " ", (marca_preferencial or "").strip())
    if _sem_acento(marca).upper() in { _sem_acento(m).upper() for m in _MARCAS_LIXO } or (
        "MAIS BARAT" in _sem_acento(marca).upper() and "/" in marca
    ):
        marca = ""
    obs, emb_obs = _obs_e_embalagem(observacao)
    desc, emb_desc = _extrair_embalagem_descricao(descricao)
    desc = _titulo_item(desc)
    emb = _juntar_embalagem(embalagem, emb_desc, emb_obs)
    lixo = item_consumo_eh_lixo(desc or descricao, marca=marca_preferencial, observacao=observacao)
    if not desc:
        lixo = True
    unidade = _inferir_unidade(emb, unidade_medida)
    return {
        "lixo": lixo,
        "descricao": desc,
        "embalagem": emb or None,
        "unidade_medida": sanitizar_unidade_medida(unidade),
        "marca_preferencial": marca or None,
        "observacao": obs or None,
        "chave": chave_item_consumo(desc) if desc else "",
    }


def embalagem_efetiva_pedido(embalagem_linha: str | None, embalagem_cadastro: str | None) -> str | None:
    """A linha do pedido prevalece; se vazia, usa a embalagem do cadastro."""
    return (embalagem_linha or "").strip() or (embalagem_cadastro or "").strip() or None
