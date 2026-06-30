# =====================================================================
# Privacidade na revisão de texto — bloqueio de nomes próprios
# =====================================================================
from __future__ import annotations

import re
import unicodedata
from typing import Iterable

MENSAGEM_NOMES_REVISAO_OCORRENCIA = (
    "Para usar a revisão por IA, o título e o relato não podem conter nomes próprios. "
    "Selecione os funcionários envolvidos no campo indicado e descreva os fatos sem citar nomes."
)

MENSAGEM_NOMES_REVISAO = MENSAGEM_NOMES_REVISAO_OCORRENCIA

MENSAGEM_NOMES_REVISAO_AVISO = (
    "Para usar a revisão por IA, o título e o texto não podem conter nomes próprios de pessoas. "
    "Use termos genéricos como equipe, técnicos ou orientadores."
)

PALAVRAS_PERMITIDAS = {
    "acolhido",
    "acolhidos",
    "acolhida",
    "administrativo",
    "almoço",
    "almoco",
    "asa",
    "atendido",
    "atendida",
    "bebida",
    "banheiro",
    "carecore",
    "comportamental",
    "convivente",
    "conviventes",
    "cozinha",
    "crise",
    "equipe",
    "funcionaria",
    "funcionário",
    "funcionario",
    "funcionários",
    "funcionarios",
    "gestão",
    "gestao",
    "gestor",
    "jantar",
    "lavanderia",
    "masculino",
    "feminino",
    "orientador",
    "orientadora",
    "orientadores",
    "projeto",
    "quarto",
    "quartos",
    "refeitório",
    "refeitorio",
    "reclamação",
    "reclamacao",
    "reunião",
    "reuniao",
    "saúde",
    "saude",
    "siat",
    "técnico",
    "tecnico",
    "técnica",
    "tecnica",
    "técnicos",
    "tecnicos",
    "urgente",
    "segunda",
    "terça",
    "terca",
    "quarta",
    "quinta",
    "sexta",
    "sábado",
    "sabado",
    "domingo",
    "janeiro",
    "fevereiro",
    "março",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
}

# Partículas de nome — nunca viram fragmento isolado para bloqueio.
PARTICULAS_NOME = {
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "y",
}

# Cadastros placeholder ou inválidos — ignorados na montagem de fragmentos.
NOMES_CADASTRO_INVALIDOS = {
    "nao possui",
    "não possui",
    "nao informado",
    "não informado",
    "sem nome",
    "desconhecido",
    "nao cadastrado",
    "não cadastrado",
}

# Palavras comuns do português que não devem disparar bloqueio por coincidência.
FRAGMENTOS_IGNORADOS = PALAVRAS_PERMITIDAS | PARTICULAS_NOME | {
    "nao",
    "sim",
    "com",
    "por",
    "para",
    "que",
    "uma",
    "uns",
    "umas",
    "ele",
    "ela",
    "eles",
    "elas",
    "nos",
    "vos",
    "seu",
    "sua",
    "seus",
    "suas",
    "meu",
    "minha",
    "dia",
    "mes",
    "ano",
    "hora",
    "horas",
    "ola",
    "obrigado",
    "obrigada",
    "todos",
    "todas",
    "vcs",
    "vc",
    "turnos",
    "turno",
    "gostaria",
    "avisar",
    "nossa",
    "nosso",
    "sobre",
    "sera",
    "será",
    "regime",
    "minutos",
    "minuto",
    "primeiro",
    "assim",
    "conto",
    "presente",
    "presentça",
    "presenca",
    "organizem",
    "enviem",
    "final",
    "amanha",
    "amanhã",
    "quem",
    "participara",
    "participará",
    "espediente",
    "expediente",
    "atendimento",
    "planejamento",
    "planejamente",
    "acontecera",
    "acontecerá",
    "fique",
    "entre",
    "deveremos",
    "sucetivamente",
    "sucessivamente",
}


def _normalizar_texto_busca(valor: str) -> str:
    texto = unicodedata.normalize("NFKD", (valor or "").strip().casefold())
    return "".join(ch for ch in texto if not unicodedata.combining(ch))


def _fragmentos_de_nome(nome: str | None) -> set[str]:
    if not nome or not str(nome).strip():
        return set()

    bruto = str(nome).strip()
    normalizado = _normalizar_texto_busca(bruto)
    if normalizado in NOMES_CADASTRO_INVALIDOS:
        return set()

    fragmentos = {normalizado}

    partes = [
        p for p in re.split(r"\s+", normalizado)
        if len(p) >= 3 and p not in PARTICULAS_NOME and p not in FRAGMENTOS_IGNORADOS
    ]
    fragmentos.update(partes)

    if len(partes) >= 2:
        fragmentos.add(" ".join(partes[:2]))
        if len(partes) >= 3:
            fragmentos.add(" ".join(partes))

    return {
        frag for frag in fragmentos
        if len(frag) >= 3 and frag not in FRAGMENTOS_IGNORADOS
    }


def montar_fragmentos_nomes_cadastrados(
    nomes_conviventes: Iterable[str | None],
    nomes_funcionarios: Iterable[str | None],
) -> set[str]:
    fragmentos: set[str] = set()
    for nome in list(nomes_conviventes) + list(nomes_funcionarios):
        fragmentos.update(_fragmentos_de_nome(nome))
    return fragmentos


def _parece_nome_proprio_heuristico(palavra: str) -> bool:
    if not palavra or len(palavra) < 3:
        return False
    if not re.match(r"^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]", palavra):
        return False
    if _normalizar_texto_busca(palavra) in FRAGMENTOS_IGNORADOS:
        return False
    return bool(re.match(r"^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+$", palavra))


def detectar_nomes_proprios_no_texto(
    titulo: str,
    texto: str,
    fragmentos_cadastrados: set[str],
    *,
    usar_fragmentos_cadastrados: bool = True,
) -> list[str]:
    combinado = f"{titulo or ''}\n{texto or ''}".strip()
    if not combinado:
        return []

    encontrados: list[str] = []
    vistos: set[str] = set()
    texto_norm = _normalizar_texto_busca(combinado)

    if usar_fragmentos_cadastrados:
        for fragmento in sorted(fragmentos_cadastrados, key=len, reverse=True):
            if len(fragmento) < 3:
                continue
            if fragmento in FRAGMENTOS_IGNORADOS:
                continue
            padrao = r"(?<!\w)" + re.escape(fragmento) + r"(?!\w)"
            if re.search(padrao, texto_norm, flags=re.IGNORECASE):
                chave = fragmento.casefold()
                if chave not in vistos:
                    vistos.add(chave)
                    encontrados.append(fragmento)

    for match in re.finditer(
        r"\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,})(?:\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{2,}))+\b",
        combinado,
    ):
        trecho = match.group(0)
        chave = _normalizar_texto_busca(trecho)
        if chave not in vistos and chave not in FRAGMENTOS_IGNORADOS:
            vistos.add(chave)
            encontrados.append(trecho)

    for match in re.finditer(r"\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]{3,})\b", combinado):
        palavra = match.group(1)
        if not _parece_nome_proprio_heuristico(palavra):
            continue
        chave = _normalizar_texto_busca(palavra)
        if chave in vistos:
            continue
        vistos.add(chave)
        encontrados.append(palavra)

    return encontrados
