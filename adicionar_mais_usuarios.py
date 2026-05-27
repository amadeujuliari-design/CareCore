# =====================================================================
# ARQUIVO: adicionar_mais_usuarios.py (EXPANSÃO DA EQUIPE)
# =====================================================================
import asyncio
from sqlalchemy.future import select
from passlib.context import CryptContext

from database import AsyncSessionLocal
from models import UsuarioDB, InstituicaoDB

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def injetar_mais_equipe():
    print("Iniciando injeção da nova equipe na base de dados...")
    
    async with AsyncSessionLocal() as db:
        query = select(InstituicaoDB).limit(1)
        result = await db.execute(query)
        instituicao = result.scalar_one_or_none()

        if not instituicao:
            print("❌ ERRO: Nenhuma Instituição encontrada.")
            return

        senha_padrao = pwd_context.hash("123456")

        novos_usuarios = [
            # --- 3 NOVOS TÉCNICOS ---
            UsuarioDB(instituicao_id=instituicao.id, nome="Carlos (Assistente Social)", email="carlos.tec@ong.com", senha_hash=senha_padrao, perfil_acesso="Técnico", is_master=False),
            UsuarioDB(instituicao_id=instituicao.id, nome="Fernanda (Psicóloga)", email="fernanda.tec@ong.com", senha_hash=senha_padrao, perfil_acesso="Técnico", is_master=False),
            UsuarioDB(instituicao_id=instituicao.id, nome="Juliana (Terapeuta Ocupacional)", email="juliana.tec@ong.com", senha_hash=senha_padrao, perfil_acesso="Técnico", is_master=False),
            
            # --- 6 NOVOS ORIENTADORES ---
            UsuarioDB(instituicao_id=instituicao.id, nome="João (Orientador Dia)", email="joao.ori@ong.com", senha_hash=senha_padrao, perfil_acesso="Orientador", is_master=False),
            UsuarioDB(instituicao_id=instituicao.id, nome="Maria (Orientadora Dia)", email="maria.ori@ong.com", senha_hash=senha_padrao, perfil_acesso="Orientador", is_master=False),
            UsuarioDB(instituicao_id=instituicao.id, nome="Pedro (Plantonista Noturno)", email="pedro.ori@ong.com", senha_hash=senha_padrao, perfil_acesso="Orientador", is_master=False),
            UsuarioDB(instituicao_id=instituicao.id, nome="Lucas (Orientador)", email="lucas.ori@ong.com", senha_hash=senha_padrao, perfil_acesso="Orientador", is_master=False),
            UsuarioDB(instituicao_id=instituicao.id, nome="Carla (Orientadora FDS)", email="carla.ori@ong.com", senha_hash=senha_padrao, perfil_acesso="Orientador", is_master=False),
            UsuarioDB(instituicao_id=instituicao.id, nome="Ana (Plantonista FDS)", email="ana.ori@ong.com", senha_hash=senha_padrao, perfil_acesso="Orientador", is_master=False),
        ]

        db.add_all(novos_usuarios)
        await db.commit()
        
        print("🎉 SUCESSO! 3 Técnicos e 6 Orientadores foram adicionados ao quadro de funcionários.")

if __name__ == "__main__":
    asyncio.run(injetar_mais_equipe())