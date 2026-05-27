import asyncio
import random
from faker import Faker
from sqlalchemy.future import select
from sqlalchemy import func

# Importa as configurações do seu projeto
from database import AsyncSessionLocal
from models import InstituicaoDB, ConviventeDB, QuartoDB, LeitoDB

# Inicia o gerador de dados configurado para o Brasil
fake = Faker('pt_BR')

async def gerar_dados():
    print("🪄 Iniciando a Super Injeção de Dados CARECORE+...")
    
    async with AsyncSessionLocal() as db:
        # 1. Pega a instituição
        result = await db.execute(select(InstituicaoDB).limit(1))
        instituicao = result.scalar_one_or_none()

        if not instituicao:
            print("ERRO: Nenhuma instituição encontrada!")
            print("Crie a conta no navegador antes de rodar o script.")
            return

        inst_id = instituicao.id

        # ---------------------------------------------------------
        # FASE 1: CRIANDO QUARTOS E CAMAS
        # ---------------------------------------------------------
        print("🛏️ Construindo Quartos e Camas...")
        nomes_quartos = [
            ("Ala Masculina Principal", "Masculino", "Fixo", 10),
            ("Ala Feminina Esperança", "Feminino", "Fixo", 8),
            ("Quarto Misto de Triagem", "Misto", "Transitorio", 5)
        ]
        
        leitos_disponiveis = []
        
        for nome_quarto, publico, modalidade, qtd_camas in nomes_quartos:
            # Cria o quarto
            quarto = QuartoDB(instituicao_id=inst_id, nome=nome_quarto, tipo_publico=publico, modalidade=modalidade)
            db.add(quarto)
            await db.flush() # Salva temporariamente para gerar o ID
            
            # Cria as camas dentro do quarto
            for i in range(1, qtd_camas + 1):
                leito = LeitoDB(quarto_id=quarto.id, identificacao=f"Cama {i}", status="Livre")
                db.add(leito)
                await db.flush()
                leitos_disponiveis.append(leito) # Guarda as camas na lista para colocarmos pessoas depois

        # ---------------------------------------------------------
        # FASE 2: GERANDO OS CONVIVENTES E ALOCANDO
        # ---------------------------------------------------------
        print("👥 Gerando 200 Fichas Médicas, Sociais e Criminais...")
        
        novos_conviventes = []
        for i in range(1, 201):
            
            status_sorteio = random.choices(["Ativo", "Inativado"], weights=[80, 20])[0]
            
            # LÓGICA DE ALOCAÇÃO: Se o utente for ativo e ainda tivermos camas vazias na lista
            leito_alocado_id = None
            if status_sorteio == "Ativo" and len(leitos_disponiveis) > 0:
                # 30% de chance do utente ganhar uma cama (se não ganhar, fica no Centro Dia)
                if random.choice([True, False, False]): 
                    cama_sorteada = leitos_disponiveis.pop(0) # Tira a primeira cama da lista de livres
                    cama_sorteada.status = "Ocupado"
                    leito_alocado_id = cama_sorteada.id

            novo = ConviventeDB(
                instituicao_id=inst_id,
                numero_institucional=i,
                status=status_sorteio,
                data_entrada=fake.date_between(start_date='-2y', end_date='today'),
                leito_id=leito_alocado_id,
                
                # --- ABA PESSOAL ---
                nome_completo=fake.name(),
                nome_social=fake.first_name() if random.choice([True, False, False]) else None,
                cpf=fake.cpf(),
                rg=f"{random.randint(10, 99)}.{random.randint(100, 999)}.{random.randint(100, 999)}-{random.randint(0, 9)}",
                data_nascimento=fake.date_of_birth(minimum_age=18, maximum_age=80),
                identidade_genero=random.choice(["Homem Cisgênero", "Mulher Cisgênero", "Homem Transgênero", "Mulher Transgênero", "Não-Binário"]),
                estado_civil=random.choice(["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)"]),
                escolaridade=random.choice(["Analfabeto", "Ensino Fundamental", "Ensino Médio Incomp.", "Ensino Médio Comp."]),
                naturalidade=f"{fake.city()} - {fake.estado_sigla()}",
                telefone_celular=fake.cellphone_number(),
                
                # --- ENDEREÇO ---
                cep=fake.postcode(),
                logradouro=fake.street_name(),
                numero=fake.building_number(),
                complemento=random.choice(["Casa dos fundos", "Apto 12", "Embaixo da ponte", "Viela 3", None, None]),
                bairro=fake.bairro(),
                cidade=fake.city(),
                uf=fake.estado_sigla(),
                
                # --- FILIAÇÃO ---
                nome_mae=fake.name_female(),
                nome_pai=fake.name_male() if random.choice([True, False]) else "Não Declarado na Certidão",
                
                # --- ABA SOCIAL ---
                numero_nis=str(random.randint(10000000000, 99999999999)),
                numero_sisa=str(random.randint(10000, 99999)),
                status_cadunico=random.choice(["Atualizado", "Desatualizado", "Não Possui"]),
                programas_beneficios=random.choice(["Bolsa Família", "BPC", "Auxílio Gás", "Nenhum relato", "Bolsa Família e Auxílio Gás"]),
                possui_renda=random.choice([True, False]),
                renda_mensal=round(random.uniform(600, 1500), 2) if random.choice([True, False]) else None,
                
                # --- ABA SAÚDE ---
                contato_emergencia_nome=fake.name(),
                contato_emergencia_telefone=fake.cellphone_number(),
                observacoes_saude=random.choice(["Hipertensão severa", "Diabetes Tipo 2", "Alérgico a Dipirona e Amoxicilina", "Nenhuma restrição relatada", "Toma remédio controlado para pressão"]),
                
                # --- COFRE DE SENHAS ---
                email_pessoal=fake.email(),
                senha_email=fake.password(length=8) if random.choice([True, False]) else None,
                senha_govbr=fake.password(length=12) if random.choice([True, False]) else None,
                
                # --- ABA SENSÍVEIS ---
                egresso_prisional=random.choices([True, False], weights=[20, 80])[0], # 20% de chance
                usa_tornozeleira=random.choices([True, False], weights=[5, 95])[0], # 5% de chance
                acompanhamento_caps=random.choice(["Sim, CAPS AD 1x na semana", "Não", "Aguardando Vaga", None]),
                uso_substancias=random.choice(["Álcool severo diário", "Uso de Crack e Álcool", "Tabagismo", "Nenhum relato de uso", "Maconha frequente"]),
                transtorno_mental=random.choice(["Esquizofrenia leve (CID F20)", "Depressão crônica", "Não relatado", "Ansiedade generalizada", None]),
            )
            
            novos_conviventes.append(novo)

        # 3. Salva os 200 de uma vez só no banco de dados
        db.add_all(novos_conviventes)
        await db.commit()
        
        print("🎉 MÁGICA CONCLUÍDA! Quartos, Camas e 200 Prontuários Hyper-Realistas criados!")

if __name__ == "__main__":
    asyncio.run(gerar_dados())