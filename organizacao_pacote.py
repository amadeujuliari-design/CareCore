"""Constantes de pacote/tenant da organização CareCore+."""

TIPO_PACOTE_ASSISTENCIAL = "assistencial"
TIPO_PACOTE_FINANCEIRO_PESSOAL = "financeiro_pessoal"

TIPOS_PACOTE_VALIDOS = frozenset(
    {
        TIPO_PACOTE_ASSISTENCIAL,
        TIPO_PACOTE_FINANCEIRO_PESSOAL,
    }
)


def normalizar_tipo_pacote(valor: str | None) -> str:
    tipo = (valor or TIPO_PACOTE_ASSISTENCIAL).strip().lower()
    if tipo not in TIPOS_PACOTE_VALIDOS:
        return TIPO_PACOTE_ASSISTENCIAL
    return tipo
