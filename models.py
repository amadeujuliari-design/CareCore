
# =====================================================================
# ARQUIVO: models.py (COMPLETO E AUDITADO - COM AVISOS INTERNOS)
# =====================================================================
from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Date, Float, Text, DateTime
import uuid
import datetime
from database import Base

def get_uuid():
    return str(uuid.uuid4())

class InstituicaoDB(Base):
    __tablename__ = "instituicoes"
    id = Column(String, primary_key=True, default=get_uuid)
    nome_fantasia = Column(String, nullable=False)
    cnpj = Column(String, nullable=True)
    telefone = Column(String, nullable=False)
    is_active = Column(Boolean, default=True) 
    # Controle SaaS / assinatura da instituição
    status_assinatura = Column(String, default="Ativa")
    data_vencimento = Column(Date, nullable=True)
    bloqueado = Column(Boolean, default=False)
    bloqueado_em = Column(DateTime, nullable=True)
    dias_tolerancia = Column(Integer, default=5)

class UsuarioDB(Base):
    __tablename__ = "usuarios"

    # =========================================================
    # IDENTIFICAÇÃO
    # =========================================================
    id = Column(String, primary_key=True, default=get_uuid)

    instituicao_id = Column(
        String,
        ForeignKey("instituicoes.id"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # DADOS BÁSICOS
    # =========================================================
    nome = Column(String, nullable=False)

    email = Column(
        String,
        unique=True,
        nullable=False,
        index=True,
    )

    cpf = Column(
        String,
        unique=True,
        nullable=True,
        index=True,
    )

    telefone = Column(String, nullable=True)

    avatar_url = Column(String, nullable=True)

    senha_hash = Column(String, nullable=False)

    # =========================================================
    # RBAC
    # =========================================================
    perfil_acesso = Column(String, default="Consulta")

    is_master = Column(Boolean, default=False)

    ativo = Column(Boolean, default=True)

    # =========================================================
    # DADOS PESSOAIS
    # =========================================================
    data_nascimento = Column(Date, nullable=True)

    genero = Column(String, nullable=True)

    rg = Column(String, nullable=True)

    orgao_emissor = Column(String, nullable=True)

    estado_civil = Column(String, nullable=True)

    nacionalidade = Column(String, nullable=True)

    naturalidade = Column(String, nullable=True)

    # =========================================================
    # ENDEREÇO
    # =========================================================
    cep = Column(String, nullable=True)

    logradouro = Column(String, nullable=True)

    numero = Column(String, nullable=True)

    complemento = Column(String, nullable=True)

    bairro = Column(String, nullable=True)

    cidade = Column(String, nullable=True)

    uf = Column(String, nullable=True)

    # =========================================================
    # DADOS PROFISSIONAIS
    # =========================================================
    cargo = Column(String, nullable=True)

    setor = Column(String, nullable=True)

    conselho_profissional = Column(String, nullable=True)

    numero_conselho = Column(String, nullable=True)

    carga_horaria = Column(Integer, nullable=True)

    data_admissao = Column(Date, nullable=True)

    data_desligamento = Column(Date, nullable=True)

    motivo_desligamento = Column(Text, nullable=True)

    observacoes_profissionais = Column(Text, nullable=True)

    # =========================================================
    # AUDITORIA
    # =========================================================
    criado_em = Column(
        DateTime,
        default=datetime.datetime.utcnow,
    )

    atualizado_em = Column(
        DateTime,
        nullable=True,
    )

    ultimo_login_em = Column(
        DateTime,
        nullable=True,
    )

    inativado_em = Column(
        DateTime,
        nullable=True,
    )

    criado_por_id = Column(
        String,
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    atualizado_por_id = Column(
        String,
        ForeignKey("usuarios.id"),
        nullable=True,
    )

    inativado_por_id = Column(
        String,
        ForeignKey("usuarios.id"),
        nullable=True,
    )

class QuartoDB(Base):
    __tablename__ = "quartos"
    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    nome = Column(String, nullable=False)
    tipo_publico = Column(String, nullable=False) 
    modalidade = Column(String, nullable=False, default="Fixo") 
    is_active = Column(Boolean, default=True)

class LeitoDB(Base):
    __tablename__ = "leitos"
    id = Column(String, primary_key=True, default=get_uuid)
    quarto_id = Column(String, ForeignKey("quartos.id"), nullable=False)
    identificacao = Column(String, nullable=False) 
    status = Column(String, default="Livre") 

class MotivoInativacaoDB(Base):
    __tablename__ = "motivos_inativacao"
    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    descricao = Column(String, nullable=False)

class OrigemEncaminhamentoDB(Base):
    __tablename__ = "origens_encaminhamento"
    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    descricao = Column(String, nullable=False)

class ConviventeDB(Base):
    __tablename__ = "conviventes"
    
    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    
    numero_institucional = Column(Integer, nullable=True, index=True)
    status = Column(String, default="Ativo")
    motivo_inativacao_id = Column(String, ForeignKey("motivos_inativacao.id"), nullable=True)
    origem_encaminhamento_id = Column(String, ForeignKey("origens_encaminhamento.id"), nullable=True)
    data_entrada = Column(Date, nullable=True)
    leito_id = Column(String, ForeignKey("leitos.id"), nullable=True) 
    
    tecnico_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    foto_url = Column(String, nullable=True)
    
    nome_completo = Column(String, nullable=False)
    nome_social = Column(String, nullable=True)
    identidade_genero = Column(String, nullable=True)
    orientacao_sexual = Column(String, nullable=True)
    data_nascimento = Column(Date, nullable=True)
    cpf = Column(String, nullable=True)
    rg = Column(String, nullable=True)
    naturalidade = Column(String, nullable=True)
    estado_civil = Column(String, nullable=True)
    escolaridade = Column(String, nullable=True)
    telefone_celular = Column(String, nullable=True)
    
    cep = Column(String, nullable=True)
    logradouro = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    uf = Column(String, nullable=True)
    
    nome_mae = Column(String, nullable=True)
    nome_pai = Column(String, nullable=True)
    
    numero_sisa = Column(String, nullable=True)
    numero_nis = Column(String, nullable=True)
    status_cadunico = Column(String, nullable=True)
    programas_beneficios = Column(Text, nullable=True) 
    possui_renda = Column(Boolean, default=False)
    renda_mensal = Column(Float, nullable=True)
    
    contato_emergencia_nome = Column(String, nullable=True)
    contato_emergencia_telefone = Column(String, nullable=True)
    observacoes_saude = Column(Text, nullable=True)
    
    email_pessoal = Column(String, nullable=True)
    senha_email = Column(String, nullable=True)
    senha_govbr = Column(String, nullable=True)
    
    egresso_prisional = Column(Boolean, default=False)
    usa_tornozeleira = Column(Boolean, default=False)
    medidas_protetivas = Column(Text, nullable=True)
    acompanhamento_caps = Column(String, nullable=True)
    uso_substancias = Column(Text, nullable=True)
    transtorno_mental = Column(Text, nullable=True)

class DocumentoConviventeDB(Base):
    __tablename__ = "documentos_conviventes"
    id = Column(String, primary_key=True, default=get_uuid)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    nome_arquivo = Column(String, nullable=False) 
    caminho_arquivo = Column(String, nullable=False) 
    tipo_documento = Column(String, nullable=False)
    data_upload = Column(DateTime, default=datetime.datetime.utcnow)

class OcorrenciaConviventeDB(Base):
    __tablename__ = "ocorrencias_conviventes"
    
    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False) 
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    
    usuario_criador_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    tecnico_responsavel_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    
    tipo_ocorrencia = Column(String, nullable=False)
    motivo = Column(String, nullable=False) 
    descricao = Column(Text, nullable=False) 
    data_ocorrencia = Column(DateTime, default=datetime.datetime.utcnow)
    
    requer_acao_tecnica = Column(Boolean, default=False)
    status_resolucao = Column(String, default="Pendente")
    
    parecer_tecnico = Column(Text, nullable=True) 
    data_resolucao = Column(DateTime, nullable=True)
    usuario_resolutor_id = Column(String, ForeignKey("usuarios.id"), nullable=True)

class InteracaoOcorrenciaDB(Base):
    __tablename__ = "interacoes_ocorrencias"
    
    id = Column(String, primary_key=True, default=get_uuid)
    ocorrencia_id = Column(String, ForeignKey("ocorrencias_conviventes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    
    mensagem = Column(Text, nullable=False)
    tipo_interacao = Column(String, default="Comentário")
    data_interacao = Column(DateTime, default=datetime.datetime.utcnow)

class ObservadorOcorrenciaDB(Base):
    __tablename__ = "observadores_ocorrencias"
    
    id = Column(String, primary_key=True, default=get_uuid)
    ocorrencia_id = Column(String, ForeignKey("ocorrencias_conviventes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    data_marcacao = Column(DateTime, default=datetime.datetime.utcnow)

class RegistroRotinaDB(Base):
    __tablename__ = "registros_rotina"
    
    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)

    # Quem registrou originalmente
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    
    tipo_registro = Column(String, nullable=False)
    data_registro = Column(DateTime, default=datetime.datetime.utcnow)

    # Retorno rápido: entrada registrada em menos de 10 minutos após uma saída
    retorno_rapido = Column(Boolean, default=False)
    justificativa_retorno_rapido = Column(Text, nullable=True)

    # Auditoria de edição/correção
    foi_editado = Column(Boolean, default=False)
    editado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    editado_em = Column(DateTime, nullable=True)
    motivo_edicao = Column(Text, nullable=True)

    # Valores originais para rastreabilidade
    tipo_registro_original = Column(String, nullable=True)
    data_registro_original = Column(DateTime, nullable=True)

    # Cancelamento lógico, sem apagar do banco
    cancelado = Column(Boolean, default=False)
    cancelado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    cancelado_em = Column(DateTime, nullable=True)
    motivo_cancelamento = Column(Text, nullable=True)

class FechamentoMensalDB(Base):
    __tablename__ = "fechamentos_mensais"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)

    ano = Column(Integer, nullable=False)
    mes = Column(Integer, nullable=False)

    protocolo = Column(String, nullable=False, unique=True)
    status = Column(String, default="Fechado")

    fechado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    fechado_em = Column(DateTime, default=datetime.datetime.utcnow)

    observacoes = Column(Text, nullable=True)

    # Auditoria de reabertura
    reaberto_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    reaberto_em = Column(DateTime, nullable=True)
    motivo_reabertura = Column(Text, nullable=True)


class SisaLancamentoDB(Base):
    __tablename__ = "sisa_lancamentos"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)

    ano = Column(Integer, nullable=False)
    mes = Column(Integer, nullable=False)

    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)

    status = Column(String, default="Lancado")
    lancado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    lancado_em = Column(DateTime, default=datetime.datetime.utcnow)

    observacoes = Column(Text, nullable=True)

# =====================================================================
# COMUNICAÇÃO INTERNA / AVISOS IMPORTANTES
# =====================================================================
# Fonte única para:
# - Dashboard > Avisos importantes
# - Dashboard > card "Alertas ativos"
# - Topbar/Header > sininho
#
# Regras:
# - destino_tipo = "todos": todos os usuários ativos da instituição visualizam.
# - destino_tipo = "usuarios": apenas usuários relacionados em aviso_destinatarios visualizam.
# - Para mensagens privadas/grupo, o frontend deve exibir texto resumido
#   ("Você tem uma mensagem") em vez de expor o título completo no dashboard.
# =====================================================================

class AvisoDB(Base):
    __tablename__ = "avisos"

    id = Column(String, primary_key=True, default=get_uuid)

    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    remetente_id = Column(String, ForeignKey("usuarios.id"), nullable=False)

    titulo = Column(String, nullable=False)
    mensagem = Column(Text, nullable=False)

    # Ex.: "Informativo", "Atenção", "Urgente", "Comunicado", "Pendência"
    classificacao = Column(String, default="Informativo")

    # Ex.: "baixa", "normal", "alta", "critica"
    prioridade = Column(String, default="normal")

    # "todos" ou "usuarios"
    destino_tipo = Column(String, default="todos", nullable=False)

    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    valido_ate = Column(DateTime, nullable=True)

    # Auditoria simples
    atualizado_em = Column(DateTime, nullable=True)
    cancelado_em = Column(DateTime, nullable=True)
    cancelado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)


class AvisoDestinatarioDB(Base):
    __tablename__ = "aviso_destinatarios"

    id = Column(String, primary_key=True, default=get_uuid)

    aviso_id = Column(String, ForeignKey("avisos.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)

    lido = Column(Boolean, default=False)
    lido_em = Column(DateTime, nullable=True)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)



