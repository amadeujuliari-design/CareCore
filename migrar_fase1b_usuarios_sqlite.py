# =====================================================================
# ARQUIVO: gerar_secret_key_segura.py
# CARECORE+ OFICIAL
# FASE 1B — Fortalecimento da SECRET_KEY JWT
# =====================================================================
#
# OBJETIVO
# - Gerar SECRET_KEY forte para JWT.
# - Atualizar/criar arquivo .env local.
# - Criar backup automático do .env existente.
# - Não alterar banco.
# - Não alterar usuários.
#
# COMO USAR
# 1. Coloque este arquivo na raiz do projeto CareCore+.
# 2. Pare o backend.
# 3. Execute:
#    python gerar_secret_key_segura.py
# 4. Reinicie o backend:
#    uvicorn main:app --reload
#
# OBSERVAÇÃO
# Após trocar a SECRET_KEY, tokens antigos deixam de valer.
# Basta fazer login novamente.
# =====================================================================

from __future__ import annotations

import secrets
from datetime import datetime
from pathlib import Path


ARQUIVO_ENV = ".env"
CHAVE = "SECRET_KEY"


def gerar_secret_key() -> str:
    return secrets.token_urlsafe(64)


def criar_backup(env_path: Path) -> Path | None:
    if not env_path.exists():
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = env_path.with_name(f".env_backup_secret_key_{timestamp}")
    backup.write_text(env_path.read_text(encoding="utf-8"), encoding="utf-8")

    return backup


def atualizar_env(env_path: Path, secret_key: str) -> bool:
    if not env_path.exists():
        env_path.write_text(f"{CHAVE}={secret_key}\n", encoding="utf-8")
        return True

    linhas = env_path.read_text(encoding="utf-8").splitlines()
    atualizado = False
    novas_linhas = []

    for linha in linhas:
        if linha.strip().startswith(f"{CHAVE}="):
            novas_linhas.append(f"{CHAVE}={secret_key}")
            atualizado = True
        else:
            novas_linhas.append(linha)

    if not atualizado:
        if novas_linhas and novas_linhas[-1].strip():
            novas_linhas.append("")
        novas_linhas.append(f"{CHAVE}={secret_key}")

    env_path.write_text("\n".join(novas_linhas) + "\n", encoding="utf-8")

    return atualizado


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    env_path = base_dir / ARQUIVO_ENV

    backup = criar_backup(env_path)
    secret_key = gerar_secret_key()
    ja_existia = atualizar_env(env_path, secret_key)

    print("\n============================================================")
    print("CARECORE+ OFICIAL — SECRET_KEY JWT atualizada")
    print("============================================================")
    print(f"Arquivo .env: {env_path}")

    if backup:
        print(f"Backup criado: {backup}")
    else:
        print("Backup criado: nenhum, pois .env não existia.")

    if ja_existia:
        print("Status: SECRET_KEY existente substituída.")
    else:
        print("Status: SECRET_KEY adicionada.")

    print("\nIMPORTANTE:")
    print("  - Tokens antigos deixam de valer.")
    print("  - Faça login novamente após reiniciar o backend.")
    print("  - O aviso InsecureKeyLengthWarning deve desaparecer.")
    print("============================================================\n")


if __name__ == "__main__":
    main()
