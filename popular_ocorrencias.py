# =====================================================================
# ARQUIVO: popular_ocorrencias.py (GERADOR DE TICKETS MOCK)
# =====================================================================
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy.future import select
from database import AsyncSessionLocal
from models import (
    UsuarioDB, ConviventeDB, OcorrenciaConviventeDB, 
    InteracaoOcorrenciaDB, ObservadorOcorrenciaDB, InstituicaoDB
)

# --- DADOS FALSOS PARA SIMULAÇÃO ---
MOTIVOS = {
    "Comportamental": [
        ("Discussão no refeitório", "O paciente exaltou-se durante o almoço e atirou o prato ao chão."),
        ("Recusa de atividades", "Recusou-se a participar na dinâmica de grupo e isolou-se no quarto."),
        ("Conflito com colega", "Desentendimento verbal com outro convivente no pátio."),
        ("Evasão noturna", "Tentativa de sair das instalações após o horário de recolher.")
    ],
    "Saúde": [
        ("Febre alta", "Apresentou 39 graus de febre durante a madrugada. Medicação administrada."),
        ("Crise de ansiedade", "Episódio de taquicardia e choro excessivo. Necessita de apoio psicológico."),
        ("Ferimento leve", "Corte superficial no braço durante atividade na horta.")
    ],
    "Administrativo": [
        ("Perda de documento", "Relatou ter perdido o RG original durante o passeio ao centro."),
        ("Solicitação de passe", "Pede a emissão de passe livre para deslocação ao médico.")
    ]
}

PARECERES_TECNICOS = [
    "Paciente atendido na sala de serviço social. Situação contornada e orientações dadas.",
    "Conversa de alinhamento realizada com sucesso. O convivente comprometeu-se a melhorar.",
    "Encaminhado para a rede de saúde (UBS) para acompanhamento médico.",
    "Situação registada. A equipa deve manter o convivente em observação durante as próximas 48 horas."
]

async def popular_chamados():
    print("A iniciar a injeção de ocorrências no banco de dados...")
    
    async with AsyncSessionLocal() as db:
        # 1. Obter a Instituição
        instituicao = (await db.execute(select(InstituicaoDB).limit(1))).scalar_one_or_none()
        if not instituicao:
            print("❌ ERRO: Nenhuma Instituição encontrada.")
            return

        # 2. Obter a Equipa (Orientadores e Técnicos)
        usuarios = (await db.execute(select(UsuarioDB))).scalars().all()
        orientadores = [u for u in usuarios if u.perfil_acesso == "Orientador"]
        tecnicos = [u for u in usuarios if u.perfil_acesso == "Técnico"]

        if not orientadores or not tecnicos:
            print("❌ ERRO: Precisa de ter pelo menos um Orientador e um Técnico registados.")
            return

        # 3. Obter Conviventes
        conviventes = (await db.execute(select(ConviventeDB))).scalars().all()
        if not conviventes:
            print("❌ ERRO: Precisa de ter Conviventes registados.")
            return

        print(f"✅ Encontrados {len(orientadores)} Orientadores, {len(tecnicos)} Técnicos e {len(conviventes)} Conviventes.")
        print("A gerar 50 chamados aleatórios...")

        for i in range(50):
            convivente = random.choice(conviventes)
            orientador = random.choice(orientadores)
            tecnico_resp = convivente.tecnico_id if convivente.tecnico_id else random.choice(tecnicos).id
            
            tipo = random.choice(list(MOTIVOS.keys()))
            motivo, descricao = random.choice(MOTIVOS[tipo])
            
            # Gera datas retroativas (últimos 30 dias)
            dias_atras = random.randint(0, 30)
            data_criacao = datetime.utcnow() - timedelta(days=dias_atras, hours=random.randint(1, 23))
            
            # 60% de probabilidade de estar RESOLVIDO, 40% de estar PENDENTE
            is_resolvido = random.random() > 0.4 
            
            nova_oc = OcorrenciaConviventeDB(
                instituicao_id=instituicao.id,
                convivente_id=convivente.id,
                usuario_criador_id=orientador.id,
                tecnico_responsavel_id=tecnico_resp,
                tipo_ocorrencia=tipo,
                motivo=motivo,
                descricao=descricao,
                requer_acao_tecnica=True,
                status_resolucao="Resolvido" if is_resolvido else "Pendente",
                data_ocorrencia=data_criacao,
                data_resolucao=(data_criacao + timedelta(hours=random.randint(1, 48))) if is_resolvido else None,
                usuario_resolutor_id=tecnico_resp if is_resolvido else None,
                parecer_tecnico=random.choice(PARECERES_TECNICOS) if is_resolvido else None
            )
            
            db.add(nova_oc)
            await db.flush() # Precisamos do ID para as tabelas filhas

            # Adicionar Observadores (Menções) - 30% de hipótese de ter observadores
            if random.random() > 0.7:
                qtd_observadores = random.randint(1, 3)
                observadores_sorteados = random.sample(usuarios, min(qtd_observadores, len(usuarios)))
                for obs in observadores_sorteados:
                    if obs.id != orientador.id: # Não marcar quem já abriu o chamado
                        db.add(ObservadorOcorrenciaDB(ocorrencia_id=nova_oc.id, usuario_id=obs.id))

            # Adicionar Interação (Thread) se estiver resolvido
            if is_resolvido:
                db.add(InteracaoOcorrenciaDB(
                    ocorrencia_id=nova_oc.id,
                    usuario_id=tecnico_resp,
                    mensagem=nova_oc.parecer_tecnico,
                    tipo_interacao="Parecer Técnico",
                    data_interacao=nova_oc.data_resolucao
                ))
            # Pode haver também um comentário do orientador antes de ser resolvido
            elif random.random() > 0.5:
                db.add(InteracaoOcorrenciaDB(
                    ocorrencia_id=nova_oc.id,
                    usuario_id=orientador.id,
                    mensagem="Por favor, deem prioridade a este caso, a situação agravou-se no plantão.",
                    tipo_interacao="Comentário",
                    data_interacao=data_criacao + timedelta(minutes=30)
                ))

        await db.commit()
        print("🎉 SUCESSO! 50 chamados (pendentes e resolvidos) foram injetados na base de dados com sucesso.")

if __name__ == "__main__":
    asyncio.run(popular_chamados())