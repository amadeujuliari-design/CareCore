"""Helpers para identificar perfil operacional do projeto."""
from __future__ import annotations

import re
import unicodedata

from models import InstituicaoDB

_MARCADORES_SIAT = ("siat", "armenia")
_MARCADORES_CASA_PORTO = ("casa porto",)
# Mesmo menu e rotina do PARI. Não inclui outros nomes que só contenham "reencontro".
_MARCADORES_REENCONTRO_PARI = (
    "reencontro pari",
    "reencontro anhangabau",
    "reencontro cruzeiro do sul",
    "reencontro jabaquara",
)


def _normalizar_texto_busca(valor: str | None) -> str:
    texto = (valor or "").strip().lower()
    if not texto:
        return ""
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(ch for ch in sem_acento if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", sem_acento)


def projeto_usa_defaults_siat(projeto: InstituicaoDB | None) -> bool:
    if not projeto:
        return False
    if projeto.historico_legado_ativo:
        return True

    referencias = " ".join(
        filter(
            None,
            [
                projeto.nome_fantasia,
                projeto.relatorio_nome_exibicao,
            ],
        )
    )
    texto = _normalizar_texto_busca(referencias)
    return any(marcador in texto for marcador in _MARCADORES_SIAT)


def projeto_e_casa_porto(projeto: InstituicaoDB | None) -> bool:
    if not projeto:
        return False
    referencias = " ".join(
        filter(
            None,
            [
                projeto.nome_fantasia,
                projeto.relatorio_nome_exibicao,
            ],
        )
    )
    texto = _normalizar_texto_busca(referencias)
    return any(marcador in texto for marcador in _MARCADORES_CASA_PORTO)


def projeto_e_cruzeiro_do_sul(projeto: InstituicaoDB | None) -> bool:
    if not projeto:
        return False
    referencias = " ".join(
        filter(
            None,
            [
                projeto.nome_fantasia,
                projeto.relatorio_nome_exibicao,
            ],
        )
    )
    return "reencontro cruzeiro do sul" in _normalizar_texto_busca(referencias)


def projeto_e_reencontro_pari(projeto: InstituicaoDB | None) -> bool:
    if not projeto:
        return False
    referencias = " ".join(
        filter(
            None,
            [
                projeto.nome_fantasia,
                projeto.relatorio_nome_exibicao,
            ],
        )
    )
    texto = _normalizar_texto_busca(referencias)
    return any(marcador in texto for marcador in _MARCADORES_REENCONTRO_PARI)
