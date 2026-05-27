# diagnosticar_login.py
import asyncio
import os
from sqlalchemy.future import select

from database import AsyncSessionLocal
from models import UsuarioDB
from security import verificar_senha

EMAIL = os.getenv("CARECORE_DIAGNOSTICO_EMAIL", "")
SENHA = os.getenv("CARECORE_DIAGNOSTICO_SENHA", "")

async def main():
    if not EMAIL or not SENHA:
        print(
            "Informe CARECORE_DIAGNOSTICO_EMAIL e CARECORE_DIAGNOSTICO_SENHA "
            "no ambiente antes de rodar este diagnóstico."
        )
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(UsuarioDB).where(UsuarioDB.email == EMAIL))
        usuario = result.scalar_one_or_none()

        if not usuario:
            print("❌ Usuário não encontrado")
            return

        print("ID:", usuario.id)
        print("Email:", usuario.email)
        print("Ativo:", getattr(usuario, "ativo", None))
        print("Perfil:", usuario.perfil_acesso)
        print("Hash:", usuario.senha_hash[:30], "...")
        print("Senha confere?", verificar_senha(SENHA, usuario.senha_hash))

asyncio.run(main())