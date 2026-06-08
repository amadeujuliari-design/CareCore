# =====================================================================
# Criptografia opcional das senhas de e-mail / GOV.BR do convivente.
# =====================================================================

from __future__ import annotations

import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


_PREFIXO_FERNET = "fernet:"


def _chave_fernet() -> bytes:
    """
    CREDENCIAIS_CONVIVENTE_KEY ou fallback local para SECRET_KEY.
    Fernet espera base64-url de 32 bytes.
    """
    explicita = os.getenv("CREDENCIAIS_CONVIVENTE_KEY", "").strip()
    if explicita:
        digest = hashlib.sha256(explicita.encode("utf-8")).digest()
    else:
        app_env = os.getenv("APP_ENV", "local").strip().lower()
        if app_env in {"production", "prod"}:
            raise RuntimeError(
                "Defina CREDENCIAIS_CONVIVENTE_KEY em produção para separar "
                "a criptografia do cofre da SECRET_KEY dos tokens."
            )

        secret = os.getenv("SECRET_KEY", "CARECORE_SECRET_DEV_LOCAL")
        digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet:
    return Fernet(_chave_fernet())


def criptografar_credencial(valor: Optional[str]) -> Optional[str]:
    if valor is None or str(valor).strip() == "":
        return None

    # Se a UI reenviar um valor já armazenado como "fernet:...",
    # primeiro normalizamos para texto claro para evitar dupla criptografia.
    texto = descriptografar_credencial_armazenado(str(valor))

    if texto is None or str(texto).strip() == "":
        return None

    token = _fernet().encrypt(texto.encode("utf-8")).decode("utf-8")
    return _PREFIXO_FERNET + token


def descriptografar_credencial_armazenado(valor: Optional[str]) -> Optional[str]:
    if valor is None or str(valor).strip() == "":
        return None
    s = str(valor)
    # Legado em texto claro: será regravado criptografado no próximo save.
    if not s.startswith(_PREFIXO_FERNET):
        return s

    # Suporta registros que tenham sido criptografados mais de uma vez
    # durante testes/migrações locais. O ideal é sempre armazenar só 1 camada.
    texto = s

    for _ in range(5):
        if not texto.startswith(_PREFIXO_FERNET):
            return texto

        blob = texto[len(_PREFIXO_FERNET):]

        try:
            texto = _fernet().decrypt(blob.encode("utf-8")).decode("utf-8")
        except InvalidToken:
            return None

    return texto
