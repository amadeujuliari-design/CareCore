# =====================================================================
# ARQUIVO: criar_usuarios.py (SCRIPT PARA INJETAR EQUIPE)
# =====================================================================
import asyncio
from sqlalchemy.future import select
from passlib.context import CryptContext

from database import AsyncSessionLocal
from models import UsuarioDB, InstituicaoDB

# Configuração do encriptador de senhas (o mesmo que o FastAPI usa)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def injetar_equipe():
    print("Iniciando injeção de usuários na base de dados...")
    
    async with AsyncSessionLocal() as db:
        # 1. Pega a Instituição que você já criou no Onboarding
        query = select(InstituicaoDB).limit(1)
        result = await db.execute(query)
        instituicao = result.scalar_one_or_none()

        if not instituicao:
            print("❌ ERRO: Nenhuma Instituição encontrada. Faça o cadastro no navegador primeiro.")
            return

        print(f"✅ Instituição vinculada: {instituicao.nome_fantasia}")

        # 2. Prepara os 3 funcionários com a mesma senha padrão para facilitar seus testes
        senha_padrao = pwd_context.hash("123456")

        novos_usuarios = [
            UsuarioDB(
                instituicao_id=instituicao.id,
                nome="Marcos (Gerente Geral)",
                email="gerente@ong.com",
                senha_hash=senha_padrao,
                perfil_acesso="Gerente",
                is_master=True
            ),
            UsuarioDB(
                instituicao_id=instituicao.id,
                nome="Dra. Aline (Técnica / Psicóloga)",
                email="tecnica@ong.com",
                senha_hash=senha_padrao,
                perfil_acesso="Técnico",
                is_master=False
            ),
            UsuarioDB(
                instituicao_id=instituicao.id,
                nome="Roberto (Orientador / Plantonista)",
                email="orientador@ong.com",
                senha_hash=senha_padrao,
                perfil_acesso="Orientador",
                is_master=False
            )
        ]

        # 3. Salva no banco de dados
        db.add_all(novos_usuarios)
        await db.commit()
        
        print("🎉 SUCESSO! A equipe foi cadastrada.")
        print("---")
        print("Credenciais para teste (Senha para todos: 123456):")
        print("1. gerente@ong.com (Vê tudo + Cria Usuários)")
        print("2. tecnica@ong.com (Vê tudo)")
        print("3. orientador@ong.com (NÃO vê dados sensíveis)")
        print("---")

if __name__ == "__main__":
    asyncio.run(injetar_equipe())