"""Helpers para identificar perfil operacional do projeto."""
from __future__ import annotations

import re
import unicodedata

from models import InstituicaoDB

_MARCADORES_SIAT = ("siat", "armenia")


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
