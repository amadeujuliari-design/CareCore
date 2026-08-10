"""Leitura leve da planilha de chaves NFP (sem openpyxl)."""

from __future__ import annotations

import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RE_CHAVE = re.compile(r"\d{44}")


def _shared_strings(z: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in z.namelist():
        return []
    root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    saida: list[str] = []
    for si in root.findall("m:si", NS):
        textos = [t.text or "" for t in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")]
        if textos:
            saida.append("".join(textos))
        else:
            saida.append("")
    return saida


def _celula_valor(cel: ET.Element, strings: list[str]) -> str:
    tipo = cel.get("t")
    no_v = cel.find("m:v", NS)
    if no_v is None or no_v.text is None:
        return ""
    if tipo == "s":
        idx = int(no_v.text)
        return strings[idx] if 0 <= idx < len(strings) else ""
    return no_v.text


def _col_letra(ref: str) -> str:
    return "".join(ch for ch in ref if ch.isalpha())


def ler_chaves_xlsx(caminho: Path) -> list[dict[str, str]]:
    """Retorna linhas com chave de 44 digitos e metadados quando existirem."""
    caminho = Path(caminho)
    if not caminho.is_file():
        raise FileNotFoundError(f"Planilha nao encontrada: {caminho}")

    with zipfile.ZipFile(caminho) as z:
        strings = _shared_strings(z)
        sheet_name = "xl/worksheets/sheet1.xml"
        if sheet_name not in z.namelist():
            raise ValueError("Planilha sem sheet1.xml")
        root = ET.fromstring(z.read(sheet_name))
        linhas_xml = root.findall("m:sheetData/m:row", NS)

    matriz: list[list[str]] = []
    for row in linhas_xml:
        mapa: dict[str, str] = {}
        for cel in row.findall("m:c", NS):
            ref = cel.get("r") or ""
            mapa[_col_letra(ref)] = _celula_valor(cel, strings).strip()
        if not mapa:
            continue
        # Ordena colunas A, B, C...
        cols = sorted(mapa.keys(), key=lambda c: (len(c), c))
        matriz.append([mapa.get(c, "") for c in cols])

    if not matriz:
        return []

    cabecalho = [h.strip().lower() for h in matriz[0]]
    idx_chave = next((i for i, h in enumerate(cabecalho) if "chave" in h), 0)

    def pegar(row: list[str], nome: str) -> str:
        for i, h in enumerate(cabecalho):
            if nome in h and i < len(row):
                return row[i]
        return ""

    registros: list[dict[str, str]] = []
    vistos: set[str] = set()
    for row in matriz[1:]:
        bruto = row[idx_chave] if idx_chave < len(row) else ""
        m = RE_CHAVE.search(re.sub(r"\D", "", bruto) or bruto)
        if not m:
            # tenta qualquer celula da linha
            for cel in row:
                m = RE_CHAVE.search(re.sub(r"\D", "", cel) or cel)
                if m:
                    break
        if not m:
            continue
        chave = m.group(0)
        if chave in vistos:
            continue
        vistos.add(chave)
        registros.append(
            {
                "chave": chave,
                "data": pegar(row, "data"),
                "valor": pegar(row, "valor"),
                "local": pegar(row, "local"),
                "entidade": pegar(row, "entidade"),
            }
        )
    return registros


def ler_chaves_json(caminho: Path) -> list[dict[str, str]]:
    import json

    data = json.loads(Path(caminho).read_text(encoding="utf-8"))
    chaves = data.get("chaves") if isinstance(data, dict) else data
    saida: list[dict[str, str]] = []
    vistos: set[str] = set()
    for item in chaves or []:
        bruto = item if isinstance(item, str) else (item.get("chave") or "")
        digitos = re.sub(r"\D", "", bruto)
        if len(digitos) == 44 and digitos not in vistos:
            vistos.add(digitos)
            saida.append({"chave": digitos})
    return saida
