"""Extração de campos principais de NF-e (XML)."""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from datetime import date
from typing import Any, Optional


def _texto(node: Optional[ET.Element]) -> Optional[str]:
    if node is None or node.text is None:
        return None
    texto = node.text.strip()
    return texto or None


def _primeiro(root: ET.Element, *nomes: str) -> Optional[ET.Element]:
    for nome in nomes:
        encontrado = root.find(f".//{nome}")
        if encontrado is not None:
            return encontrado
        for elem in root.iter():
            if elem.tag.split("}")[-1] == nome:
                return elem
    return None


def _parse_data(valor: Optional[str]) -> Optional[date]:
    if not valor:
        return None
    limpo = valor.strip()[:10]
    try:
        return date.fromisoformat(limpo)
    except ValueError:
        return None


def _parse_valor_centavos(valor: Optional[str]) -> Optional[int]:
    if valor is None:
        return None
    texto = str(valor).strip().replace(",", ".")
    try:
        return int(round(float(texto) * 100))
    except ValueError:
        return None


def extrair_campos_nf_xml(conteudo: bytes) -> dict[str, Any]:
    try:
        root = ET.fromstring(conteudo)
    except ET.ParseError as exc:
        raise ValueError("XML inválido ou corrompido.") from exc

    chave = None
    inf = _primeiro(root, "infNFe")
    if inf is not None:
        chave_attr = inf.attrib.get("Id") or inf.attrib.get("id")
        if chave_attr:
            chave = re.sub(r"\D", "", chave_attr)[-44:] or chave_attr.replace("NFe", "")

    ide = _primeiro(root, "ide")
    emit = _primeiro(root, "emit")
    total = _primeiro(root, "ICMSTot")

    numero = _texto(_primeiro(ide, "nNF")) if ide is not None else None
    serie = _texto(_primeiro(ide, "serie")) if ide is not None else None
    data_emissao = _parse_data(_texto(_primeiro(ide, "dhEmi")) or _texto(_primeiro(ide, "dEmi")))
    emitente_nome = _texto(_primeiro(emit, "xNome")) if emit is not None else None
    emitente_cnpj = _texto(_primeiro(emit, "CNPJ")) if emit is not None else None
    valor_centavos = _parse_valor_centavos(_texto(_primeiro(total, "vNF")) if total is not None else None)

    if not chave:
        prot = _texto(_primeiro(root, "chNFe"))
        chave = prot

    if not any([numero, chave, emitente_cnpj, valor_centavos]):
        raise ValueError("Não foi possível identificar campos principais neste XML.")

    return {
        "numero": numero,
        "serie": serie,
        "chave_acesso": chave,
        "emitente_nome": emitente_nome,
        "emitente_cnpj": emitente_cnpj,
        "data_emissao": data_emissao.isoformat() if data_emissao else None,
        "valor_centavos": valor_centavos,
        "origem_dados": "xml",
    }
