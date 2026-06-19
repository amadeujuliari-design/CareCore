from datetime import datetime, time, timedelta, timezone
from typing import Optional

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover - Python < 3.9
    ZoneInfo = None

    class ZoneInfoNotFoundError(Exception):
        pass


try:
    FUSO_OPERACIONAL = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    # Windows pode não trazer a base IANA de fusos sem o pacote tzdata.
    FUSO_OPERACIONAL = timezone(timedelta(hours=-3))


def agora_operacional_naive() -> datetime:
    """Data/hora institucional (America/Sao_Paulo) armazenada como datetime naive."""
    return datetime.now(FUSO_OPERACIONAL).replace(tzinfo=None)


def parse_data_filtro_operacional(
    valor: Optional[str],
    fim_do_dia: bool = False,
) -> Optional[datetime]:
    """
    Converte AAAA-MM-DD enviado pelo frontend em limites do dia no fuso operacional.
    Deve ser usado para comparar com colunas gravadas via agora_operacional_naive().
    """
    if not valor:
        return None

    data = datetime.fromisoformat(valor.strip()).date()
    return datetime.combine(data, time.max if fim_do_dia else time.min)
