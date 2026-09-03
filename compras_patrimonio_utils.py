# -*- coding: utf-8 -*-
"""Normalização de patrimônio (inventário / cadastro)."""

from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from typing import Optional

from compras_regras import (
    PATRIMONIO_ORIGEM_COMPRA,
    PATRIMONIO_ORIGEM_DOACAO,
    PATRIMONIO_ORIGEM_INVENTARIO,
    PATRIMONIO_ORIGEM_OUTROS,
    PATRIMONIO_ORIGENS,
    PATRIMONIO_PROPRIEDADE_AEB,
    PATRIMONIO_PROPRIEDADE_PUBLICO,
    PATRIMONIO_PROPRIEDADES,
    PATRIMONIO_SITUACAO_BAIXADO,
    PATRIMONIO_SITUACAO_BOM,
    PATRIMONIO_SITUACAO_MANUTENCAO,
    PATRIMONIO_SITUACAO_REGULAR,
    PATRIMONIO_SITUACAO_RUIM,
    PATRIMONIO_SITUACOES,
)


def _norm(texto: Optional[str]) -> str:
    bruto = unicodedata.normalize("NFKD", (texto or "").strip().upper())
    bruto = "".join(ch for ch in bruto if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", bruto).strip()


def etiqueta_texto(valor) -> Optional[str]:
    if valor is None or valor == "":
        return None
    if isinstance(valor, float) and valor.is_integer():
        return str(int(valor))
    if isinstance(valor, int):
        return str(valor)
    texto = str(valor).strip()
    if texto.endswith(".0") and texto.replace(".", "", 1).isdigit():
        return texto[:-2]
    return texto or None


def reais_para_centavos(valor) -> Optional[int]:
    if valor is None or valor == "":
        return None
    if isinstance(valor, (int, float)):
        return int(round(float(valor) * 100))
    texto = str(valor).strip().replace("R$", "").replace(" ", "")
    if not texto:
        return None
    if "," in texto and "." in texto:
        texto = texto.replace(".", "").replace(",", ".")
    elif "," in texto:
        texto = texto.replace(",", ".")
    try:
        return int(round(float(texto) * 100))
    except ValueError:
        return None


def parse_data_aquisicao(valor) -> Optional[date]:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    texto = str(valor).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            continue
    return None


def normalizar_propriedade(valor: Optional[str]) -> str:
    n = _norm(valor)
    if n in {"PREF", "PREFEITURA", "PUBLICO", "PÚBLICO", "PRED", "SAS", "SMADS"}:
        return PATRIMONIO_PROPRIEDADE_PUBLICO
    if valor in PATRIMONIO_PROPRIEDADES:
        return valor
    return PATRIMONIO_PROPRIEDADE_AEB


def normalizar_situacao(valor: Optional[str], *, data_baixa=None) -> str:
    if data_baixa:
        return PATRIMONIO_SITUACAO_BAIXADO
    n = _norm(valor)
    if valor in PATRIMONIO_SITUACOES:
        return valor
    if n in {"BAIXADO", "BAIXA", "INATIVO"}:
        return PATRIMONIO_SITUACAO_BAIXADO
    if "MANUT" in n:
        return PATRIMONIO_SITUACAO_MANUTENCAO
    if n in {"RUIM", "PESSIMO", "PÉSSIMO", "RUIM ESTADO"}:
        return PATRIMONIO_SITUACAO_RUIM
    if n in {"REGULAR", "MEDIO", "MÉDIO"}:
        return PATRIMONIO_SITUACAO_REGULAR
    return PATRIMONIO_SITUACAO_BOM


def normalizar_origem(valor: Optional[str], *, forma: Optional[str] = None) -> str:
    n = _norm(valor)
    if valor in PATRIMONIO_ORIGENS:
        return valor
    if n in {"COMPRA", "ADQUIRIDO", "ADQUIRIDO PELA AEB"}:
        return PATRIMONIO_ORIGEM_COMPRA
    if n in {"INVENTARIO", "INVENTÁRIO"}:
        return PATRIMONIO_ORIGEM_INVENTARIO
    if "DOAC" in n or n == "DOACAO":
        return PATRIMONIO_ORIGEM_DOACAO
    forma_n = _norm(forma)
    if "DOAC" in forma_n:
        return PATRIMONIO_ORIGEM_DOACAO
    if valor or forma:
        return PATRIMONIO_ORIGEM_OUTROS
    return PATRIMONIO_ORIGEM_INVENTARIO


# Chave lógica → palavras-chave na descrição (ordem: mais específica primeiro).
_REGRAS_CATEGORIA_PATRIMONIO: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "eletronicos",
        (
            "NOTEBOOK",
            "NETBOOK",
            "COMPUTADOR",
            "MONITOR",
            "IMPRESSORA",
            " CPU",
            "TABLET",
            "PROJETOR",
            "DATA SHOW",
            "DATASHOW",
            "SWITCH",
            "ROTEADOR",
            "NOBREAK",
            "TECLADO",
            "MOUSE",
            "CAMERA",
            "CELULAR",
            "SMARTPHONE",
            "PABX",
            "TELEFONE",
            "TELEVISAO",
            "TELEVIS",
            " SMART ",
            " UHD ",
            "RELOGIO DE PONTO",
            "TELAO",
            "CAIXA AMPLIFICADA",
            "AMPLIFICAD",
            "APARELHO DE SOM",
            "CAIXA DE SOM",
            "CAIXAS DE SOM",
        ),
    ),
    (
        "eletrodomesticos",
        (
            "GELADEIRA",
            "MICROONDAS",
            "MICRO ONDAS",
            "FOGAO",
            "LAVADEIRA",
            "TANQUINHO",
            "FREEZER",
            "BEBEDOURO",
            "AR CONDICIONADO",
            "VENTILADOR",
            "AQUECEDOR",
            "LIQUIDIFICADOR",
            "CAFETEIRA",
            "FRITADERA",
            "FORNO",
            "BATEDEIRA",
            "ESPREMEDOR",
            "SECADORA",
            "PURIFICADOR",
            "CLIMATIZADOR",
        ),
    ),
    (
        "moveis",
        (
            "MESA",
            "MESINHA",
            "CADEIRA",
            "ARMARIO",
            "ESTANTE",
            "BERCO",
            "ESCRIVANINHA",
            "GAVETEIRO",
            "GAVETER",
            "SOFA",
            "BANCO",
            "PRATELEIRA",
            "MURAL",
            "PAINEL",
            "RACK",
            "GUARDA",
            "ARQUIVO",
            "ESTACAO",
            "ESTACOES",
            "BANQUETA",
            "ESPELHO",
            "BALCAO",
            "APARADOR",
            "QUADRO",
            "POLTRONA",
            "COFRE",
            "BIRO",
            "CRIADO",
            "ROUPEIRO",
            "CABIDEIRO",
            "CRISTALEIRA",
            "SAPATEIRA",
            "CAMA",
        ),
    ),
    (
        "equipamentos",
        (
            "EQUIP",
            "MAQUINA",
            "BOMBA",
            "FERRAMENTA",
            "SERRA",
            "FURADEIRA",
            "ESMERIL",
            "COMPRESSOR",
            "BALANCA",
            "EXTINTOR",
            "CADEIRA DE RODAS",
            "CARRINHO",
            "MACA",
            "OXIMETRO",
            "ESTETOSCOPIO",
            "ASPIRADOR",
            "CORTADOR",
            "GERADOR",
            "CILINDRO",
            "TRIPE",
            "SUPORTE SORO",
        ),
    ),
)

_CHAVE_POR_NOME_CATEGORIA: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("eletronicos", ("ELETRONIC", "INFORMAT", " TI", "/ TI")),
    ("eletrodomesticos", ("ELETRODOM",)),
    ("moveis", ("MOVEIS", "MÓVEIS")),
    ("equipamentos", ("EQUIPAMENT",)),
    ("bem", ("BEM", "IMOBILIZ")),
)


def chave_categoria_patrimonio_por_descricao(descricao: Optional[str]) -> str:
    """Retorna chave lógica: eletronicos|eletrodomesticos|moveis|equipamentos|bem."""
    texto = f" {_norm(descricao)} "
    for chave, palavras in _REGRAS_CATEGORIA_PATRIMONIO:
        for palavra in palavras:
            alvo = _norm(palavra)
            if alvo and alvo in texto:
                return chave
    return "bem"


def _chave_de_nome_categoria(nome: Optional[str]) -> Optional[str]:
    n = f" {_norm(nome)} "
    for chave, marcas in _CHAVE_POR_NOME_CATEGORIA:
        if any(marca in n for marca in marcas):
            return chave
    return None


def resolver_categoria_patrimonio_id(
    descricao: Optional[str],
    categorias_imobilizado: list[dict],
) -> Optional[str]:
    """
    Escolhe o id da categoria imobilizado pela descrição.
    categorias_imobilizado: [{'id': ..., 'nome': ...}, ...]
    """
    if not categorias_imobilizado:
        return None
    por_chave: dict[str, str] = {}
    fallback_id = None
    for cat in categorias_imobilizado:
        cid = (cat.get("id") or "").strip()
        nome = cat.get("nome") or ""
        if not cid:
            continue
        chave = _chave_de_nome_categoria(nome)
        if chave == "bem" and fallback_id is None:
            fallback_id = cid
        if chave and chave not in por_chave:
            por_chave[chave] = cid
        if fallback_id is None:
            fallback_id = cid
    desejada = chave_categoria_patrimonio_por_descricao(descricao)
    return por_chave.get(desejada) or fallback_id
