# =====================================================================
# ARQUIVO: vincular_tecnicos.py (ATUALIZA AS FICHAS COM OS TÉCNICOS)
# =====================================================================
import asyncio
import random
from sqlalchemy.future import select
from database import AsyncSessionLocal
from models import ConviventeDB, UsuarioDB

async def vincular_tecnicos():
    print("Iniciando o vínculo de Técnicos aos Conviventes...")
    
    async with AsyncSessionLocal() as db:
        # 1. Busca quem são os Técnicos no sistema
        query_tecnicos = select(UsuarioDB).where(UsuarioDB.perfil_acesso == "Técnico")
        res_tecnicos = await db.execute(query_tecnicos)
        tecnicos = res_tecnicos.scalars().all()

        if not tecnicos:
            print("❌ Nenhum Técnico encontrado. Verifique se o criar_usuarios.py rodou corretamente.")
            return

        print(f"✅ Encontrados {len(tecnicos)} técnicos (Ex: {tecnicos[0].nome}).")

        # 2. Busca todas as fichas de conviventes
        query_conviventes = select(ConviventeDB)
        res_conv = await db.execute(query_conviventes)
        conviventes = res_conv.scalars().all()

        print(f"👥 Sorteando e vinculando {len(conviventes)} prontuários...")

        # 3. Percorre cada ficha e atribui um técnico aleatório da lista
        for c in conviventes:
            tecnico_sorteado = random.choice(tecnicos)
            c.tecnico_id = tecnico_sorteado.id

        # 4. Salva a mágica no banco
        await db.commit()
        print("🎉 SUCESSO! Todas as fichas agora possuem um Técnico de Referência responsável.")

if __name__ == "__main__":
    asyncio.run(vincular_tecnicos())