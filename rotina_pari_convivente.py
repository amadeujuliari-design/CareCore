"""Separa o texto de observação operacional do Reencontro Pari em campos."""

from __future__ import annotations

import re
import unicodedata

DIAS_ORDEM = ("seg", "ter", "qua", "qui", "sex", "sab", "dom")
DIAS_NOME = {
    "SEGUNDA": "seg",
    "SEG": "seg",
    "TERCA": "ter",
    "TER": "ter",
    "QUARTA": "qua",
    "QUA": "qua",
    "QUINTA": "qui",
    "QUI": "qui",
    "SEXTA": "sex",
    "SEX": "sex",
    "SABADO": "sab",
    "SAB": "sab",
    "DOMINGO": "dom",
    "DOM": "dom",
}
OCUPACAO_VAZIA = {"", "NAO", "NENHUMA", "NENHUM", "NAO TEM", "SEM", "N", "0", "-"}

CAMPOS_ROTINA = (
    "ocupacao_trabalho",
    "escala_trabalho",
    "dias_trabalho",
    "trabalho_inicio",
    "trabalho_fim",
    "parcerias",
    "etapa_escolar",
    "curso_escolar",
    "turno_escolar",
    "escolar_inicio",
    "escolar_fim",
)


def sem_acento(texto: str) -> str:
    base = unicodedata.normalize("NFKD", texto or "")
    return "".join(caractere for caractere in base if not unicodedata.combining(caractere))


def _vazio(texto: str) -> bool:
    return sem_acento(texto).upper().strip(" .") in OCUPACAO_VAZIA


def _limpar_ocupacao(texto: str) -> str:
    bruto = (texto or "").strip()
    if _vazio(bruto):
        return ""
    if sem_acento(bruto).upper().startswith("SIM"):
        return re.sub(r"(?i)^sim\.?\s*", "", bruto).strip(" .")
    return bruto


def _montar_oficio(ocupacao: str, cargo: str, empresa: str) -> str:
    oficio = _limpar_ocupacao(ocupacao)
    cargo_limpo = "" if _vazio(cargo) else cargo.strip()
    empresa_limpa = "" if _vazio(empresa) else empresa.strip()
    partes: list[str] = []
    if oficio:
        partes.append(oficio)
    if cargo_limpo and sem_acento(cargo_limpo).upper() not in sem_acento(oficio).upper():
        partes.append(cargo_limpo)
    if empresa_limpa and sem_acento(empresa_limpa).upper() not in sem_acento(" ".join(partes)).upper():
        partes.append(empresa_limpa)
    return " · ".join(partes)


def _extrair_horas(texto: str) -> tuple[str, str]:
    horas: list[str] = []
    for hora, minuto in re.findall(r"(\d{1,2})\s*:\s*(\d{2})", texto or ""):
        hora_i, minuto_i = int(hora), int(minuto)
        if 0 <= hora_i <= 23 and 0 <= minuto_i <= 59:
            horas.append(f"{hora_i:02d}:{minuto_i:02d}")
    if len(horas) < 2:
        for hora in re.findall(r"\b(\d{1,2})\s*h\b", sem_acento(texto or ""), flags=re.IGNORECASE):
            hora_i = int(hora)
            if 0 <= hora_i <= 23:
                marca = f"{hora_i:02d}:00"
                if marca not in horas:
                    horas.append(marca)
    if not horas:
        return "", ""
    if len(horas) == 1:
        return horas[0], ""
    return horas[0], horas[1]


def _interpretar_escala(valor: str) -> tuple[str, list[str]]:
    normal = re.sub(r"\s+", " ", sem_acento(valor).upper()).strip()
    compacto = normal.replace(" ", "")
    if compacto in {"SEG-SEX", "SEGASEX"} or "SEGUNDA A SEXTA" in normal:
        return "seg-sex", list(DIAS_ORDEM[:5])
    if compacto in {"SEG-SAB", "SEG-SABADO"} or "SEGUNDA A SAB" in normal:
        return "seg-sab", list(DIAS_ORDEM[:6])
    if compacto == "SEG-DOM" or "SEGUNDA A DOMINGO" in normal:
        return "seg-dom", list(DIAS_ORDEM)
    if normal in {"TODOS OS DIAS", "DIARIO", "DIARIAMENTE"}:
        return "todos", list(DIAS_ORDEM)
    if "12" in compacto and "36" in compacto:
        return "12x36", []
    if compacto == "6X1":
        return "6x1", []
    if compacto == "5X2":
        return "5x2", []
    if "ESCALA FIXA" in normal or "ESPORADIC" in normal or "EVENTUAL" in normal or "UMA VEZ" in normal:
        return "sem_escala", []
    if compacto == "SEG-SEG":
        return "dias", ["seg"]

    encontrados: list[str] = []
    for parte in re.split(r"\s+E\s+|,\s*|/\s*|\s+A\s+|-", normal):
        chave = parte.strip()
        dia = DIAS_NOME.get(chave)
        if dia and dia not in encontrados:
            encontrados.append(dia)
    if encontrados:
        return "dias", encontrados
    return "", []


def _aplicar_escolar(resultado: dict, valor: str) -> bool:
    normal = sem_acento(valor).upper()
    inicio, fim = _extrair_horas(valor)
    turno = ""
    if "INTEGRAL" in normal:
        turno = "integral"
    elif "MANHA" in normal:
        turno = "manha"
    elif "TARDE" in normal:
        turno = "tarde"
    elif "NOTURN" in normal or "NOITE" in normal:
        turno = "noite"

    etapa = ""
    compacto = re.sub(r"[^A-Z]", "", normal)
    if "CONCLUID" in normal:
        etapa = "concluido"
    elif "NAO ESTUDA" in normal:
        etapa = "nao_frequenta"
    elif "EAD" in compacto:
        etapa = "ead"

    if etapa:
        resultado["etapa_escolar"] = etapa
    if turno:
        resultado["turno_escolar"] = turno
    if inicio:
        resultado["escolar_inicio"] = inicio
    if fim:
        resultado["escolar_fim"] = fim
    return bool(etapa or turno or inicio or fim)


def separar_observacao_operacional(texto: str) -> dict:
    resultado = {campo: "" for campo in CAMPOS_ROTINA}
    resultado["observacao_restante"] = (texto or "").strip()
    resultado["consumiu"] = False
    if not (texto or "").strip():
        return resultado

    empresa = ""
    cargo = ""
    ocupacao = ""
    sobras: list[str] = []
    reconheceu = False

    for parte in texto.split("|"):
        parte = parte.strip()
        if not parte:
            continue
        if ":" not in parte:
            sobras.append(parte)
            continue
        chave, valor = parte.split(":", 1)
        chave_n = sem_acento(chave).strip().lower()
        valor = valor.strip()
        if chave_n == "ocupacao":
            ocupacao = valor
            reconheceu = True
        elif chave_n == "empresa":
            empresa = valor
            reconheceu = True
        elif chave_n == "cargo":
            cargo = valor
            reconheceu = True
        elif chave_n == "escala":
            escala, dias = _interpretar_escala(valor)
            if escala:
                resultado["escala_trabalho"] = escala
                resultado["dias_trabalho"] = ",".join(dias)
                reconheceu = True
            else:
                sobras.append(parte)
        elif chave_n == "parcerias":
            resultado["parcerias"] = re.sub(r"\s*;\s*", "; ", valor).strip(" ;")
            reconheceu = True
        elif chave_n == "horario de trabalho":
            inicio, fim = _extrair_horas(valor)
            if inicio or fim:
                resultado["trabalho_inicio"] = inicio
                resultado["trabalho_fim"] = fim
                reconheceu = True
            else:
                sobras.append(parte)
        elif chave_n == "horario escolar":
            if _aplicar_escolar(resultado, valor):
                reconheceu = True
            else:
                sobras.append(parte)
        else:
            sobras.append(parte)

    if reconheceu:
        resultado["ocupacao_trabalho"] = _montar_oficio(ocupacao, cargo, empresa)
        resultado["observacao_restante"] = " | ".join(sobras).strip()
        resultado["consumiu"] = True
    return resultado


def tem_rotina_extraida(resultado: dict) -> bool:
    return any((resultado.get(campo) or "").strip() for campo in CAMPOS_ROTINA)
