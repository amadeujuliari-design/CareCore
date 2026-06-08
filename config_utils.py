import os


VALORES_BOOLEANOS_VERDADEIROS = {"1", "true", "yes", "sim"}


def env_bool(nome: str, padrao: str | bool = False) -> bool:
    if isinstance(padrao, bool):
        valor_padrao = "true" if padrao else "false"
    else:
        valor_padrao = padrao

    return os.getenv(nome, valor_padrao).strip().lower() in VALORES_BOOLEANOS_VERDADEIROS


def env_int(nome: str, padrao: int, *, minimo: int | None = None) -> int:
    valor = os.getenv(nome, "").strip()

    if not valor:
        numero = padrao
    else:
        try:
            numero = int(valor)
        except ValueError:
            numero = padrao

    if minimo is not None and numero < minimo:
        return minimo

    return numero


def env_float(nome: str, padrao: float, *, minimo: float | None = None, maximo: float | None = None) -> float:
    valor = os.getenv(nome, "").strip()

    if not valor:
        numero = padrao
    else:
        try:
            numero = float(valor)
        except ValueError:
            numero = padrao

    if minimo is not None and numero < minimo:
        return minimo

    if maximo is not None and numero > maximo:
        return maximo

    return numero
