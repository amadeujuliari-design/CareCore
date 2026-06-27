
# =====================================================================
# ARQUIVO: models.py (COMPLETO E AUDITADO - COM AVISOS INTERNOS)
# =====================================================================
from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, Date, Float, Text, DateTime, Index, UniqueConstraint
import uuid
import datetime
from database import Base
from time_operacional import agora_operacional_naive

def get_uuid():
    return str(uuid.uuid4())

class OrganizacaoDB(Base):
    __tablename__ = "organizacoes"
    id = Column(String, primary_key=True, default=get_uuid)
    nome = Column(String, nullable=False)
    cnpj = Column(String, nullable=True)
    telefone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    cep = Column(String, nullable=True)
    logradouro = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    uf = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)

class InstituicaoDB(Base):
    __tablename__ = "instituicoes"
    id = Column(String, primary_key=True, default=get_uuid)
    organizacao_id = Column(String, ForeignKey("organizacoes.id"), nullable=True, index=True)
    nome_fantasia = Column(String, nullable=False)
    cnpj = Column(String, nullable=True)
    telefone = Column(String, nullable=False)
    email = Column(String, nullable=True)
    cep = Column(String, nullable=True)
    logradouro = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    uf = Column(String, nullable=True)
    tipo_projeto = Column(String, default="Projeto")
    projeto_unico = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True) 
    # Controle SaaS / assinatura da instituição
    status_assinatura = Column(String, default="Ativa")
    data_vencimento = Column(Date, nullable=True)
    bloqueado = Column(Boolean, default=False)
    bloqueado_em = Column(DateTime, nullable=True)
    dias_tolerancia = Column(Integer, default=5)
    # Identidade visual/documental dos relatórios do projeto
    relatorio_logo_url = Column(String, nullable=True)
    relatorio_nome_exibicao = Column(String, nullable=True)
    relatorio_rodape_linha1 = Column(String, nullable=True)
    relatorio_rodape_linha2 = Column(String, nullable=True)
    relatorio_telefone = Column(String, nullable=True)
    relatorio_email = Column(String, nullable=True)
    relatorio_site = Column(String, nullable=True)
    historico_legado_ativo = Column(Boolean, default=False)

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

    organizacao_id = Column(
        String,
        ForeignKey("organizacoes.id"),
        nullable=True,
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
    token_version = Column(Integer, default=0, nullable=False)

    # =========================================================
    # RBAC
    # =========================================================
    perfil_acesso = Column(String, default="Consulta")

    is_master = Column(Boolean, default=False)

    is_global = Column(Boolean, default=False)

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

class UsuarioPasskeyDB(Base):
    __tablename__ = "usuarios_passkeys"
    __table_args__ = (
        Index("ix_usuarios_passkeys_usuario_ativo", "usuario_id", "ativo"),
        Index("ix_usuarios_passkeys_credential_id", "credential_id"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    organizacao_id = Column(String, ForeignKey("organizacoes.id"), nullable=True, index=True)

    credential_id = Column(String, nullable=False, unique=True)
    public_key = Column(Text, nullable=False)
    sign_count = Column(Integer, default=0, nullable=False)
    transports = Column(Text, nullable=True)

    nome_dispositivo = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    ultimo_uso_em = Column(DateTime, nullable=True)
    revogado_em = Column(DateTime, nullable=True)


class SuporteChamadoDB(Base):
    __tablename__ = "suporte_chamados"
    __table_args__ = (
        Index("ix_suporte_chamados_instituicao_status", "instituicao_id", "status"),
        Index("ix_suporte_chamados_instituicao_criado", "instituicao_id", "criado_em"),
        Index("ix_suporte_chamados_usuario_criado", "usuario_id", "criado_em"),
        UniqueConstraint("numero_ticket", name="uq_suporte_chamados_numero_ticket"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    numero_ticket = Column(String, nullable=False, index=True)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    organizacao_id = Column(String, ForeignKey("organizacoes.id"), nullable=True, index=True)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)

    modulo = Column(String, nullable=False)
    tela = Column(String, nullable=False)
    tipo_problema = Column(String, nullable=False)
    caminho_sistema = Column(String, nullable=False)
    url_origem = Column(Text, nullable=True)

    prioridade = Column(String, default="normal", nullable=False)
    status = Column(String, default="Aberto", nullable=False, index=True)
    assunto = Column(String, nullable=False)
    relato = Column(Text, nullable=False)

    email_notificacao_enviado = Column(Boolean, default=False, nullable=False)
    email_notificacao_erro = Column(Text, nullable=True)

    criado_em = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    atualizado_em = Column(DateTime, nullable=True)
    resolvido_em = Column(DateTime, nullable=True)


class SuporteChamadoMensagemDB(Base):
    __tablename__ = "suporte_chamados_mensagens"
    __table_args__ = (
        Index("ix_suporte_mensagens_chamado_criado", "chamado_id", "criado_em"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    chamado_id = Column(String, ForeignKey("suporte_chamados.id"), nullable=False, index=True)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=True, index=True)

    autor_nome = Column(String, nullable=False)
    autor_tipo = Column(String, default="usuario", nullable=False)
    mensagem = Column(Text, nullable=False)
    publico = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow, index=True)

class QuartoDB(Base):
    __tablename__ = "quartos"
    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    nome = Column(String, nullable=False)
    tipo_publico = Column(String, nullable=False) 
    modalidade = Column(String, nullable=False, default="Fixo") 
    rotativo = Column(Boolean, default=False, nullable=False)
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
    inativado_em = Column(DateTime, nullable=True)
    ausencia_justificada_desde = Column(Date, nullable=True, index=True)
    motivo_inativacao_id = Column(String, ForeignKey("motivos_inativacao.id"), nullable=True)
    origem_encaminhamento_id = Column(String, ForeignKey("origens_encaminhamento.id"), nullable=True)
    origem_encaminhamento_outros = Column(String, nullable=True)
    data_entrada = Column(Date, nullable=True)
    data_inclusao = Column(Date, nullable=True)
    data_inativacao = Column(Date, nullable=True)
    data_nova_vinculacao = Column(Date, nullable=True)
    prontuario_saude = Column(String, nullable=True)
    leito_id = Column(String, ForeignKey("leitos.id"), nullable=True) 
    leito_provisorio_desde = Column(DateTime, nullable=True)
    preferencial = Column(Boolean, default=False, nullable=False)
    
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
    tem_mandado_prisao = Column(Boolean, default=False)
    medidas_protetivas = Column(Text, nullable=True)
    acompanhamento_caps = Column(String, nullable=True)
    uso_substancias = Column(Text, nullable=True)
    transtorno_mental = Column(Text, nullable=True)

    cor_raca = Column(String, nullable=True)
    possui_religiao = Column(Boolean, default=False)
    religiao_qual = Column(String, nullable=True)
    relacao_familiar_situacao = Column(String, nullable=True)
    relacao_familiar_outra = Column(Text, nullable=True)

    data_inicio_pia = Column(Date, nullable=True)
    em_sao_paulo_desde = Column(Date, nullable=True)

    alfabetizado = Column(Boolean, nullable=True)
    ef_concluido = Column(Boolean, nullable=True)
    ef_incompleto = Column(Boolean, nullable=True)
    ef_incompleto_serie = Column(String, nullable=True)
    em_concluido = Column(Boolean, nullable=True)
    em_incompleto = Column(Boolean, nullable=True)
    em_incompleto_serie = Column(String, nullable=True)
    es_concluido = Column(Boolean, nullable=True)
    es_incompleto = Column(Boolean, nullable=True)
    es_incompleto_periodo = Column(String, nullable=True)
    estuda_atualmente = Column(Boolean, nullable=True)
    estuda_curso = Column(String, nullable=True)
    interesse_eja = Column(Boolean, nullable=True)

    profissao = Column(String, nullable=True)
    situacoes_trabalho = Column(Text, nullable=True)
    trabalho_nao_remunerada_qual = Column(Text, nullable=True)
    trabalho_cursos_participou = Column(Boolean, nullable=True)
    trabalho_cursos_quais = Column(Text, nullable=True)
    trabalho_certificados = Column(Boolean, nullable=True)
    trabalho_certificados_quais = Column(Text, nullable=True)
    trabalho_pretende_curso = Column(Boolean, nullable=True)
    trabalho_pretende_curso_quais = Column(Text, nullable=True)
    beneficios_pia = Column(Text, nullable=True)

    rua_desde = Column(String, nullable=True)
    rua_relato = Column(Text, nullable=True)

    saude_hist_familia = Column(Boolean, nullable=True)
    saude_hist_familia_qual = Column(Text, nullable=True)
    saude_problema = Column(Boolean, nullable=True)
    saude_problema_qual = Column(Text, nullable=True)
    saude_laudo = Column(Boolean, nullable=True)
    saude_cid = Column(String, nullable=True)
    saude_outro_equipamento = Column(Boolean, nullable=True)
    saude_outro_equipamento_onde = Column(String, nullable=True)

    pendencia_judiciaria = Column(Boolean, nullable=True)
    pendencia_judiciaria_qual = Column(Text, nullable=True)
    pendencia_eleitoral = Column(Boolean, nullable=True)
    pendencia_eleitoral_qual = Column(Text, nullable=True)
    egresso_artigo_motivo = Column(Text, nullable=True)
    egresso_ano = Column(String, nullable=True)


class ConviventeFamiliarDB(Base):
    __tablename__ = "convivente_familiares"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False, index=True)
    parentesco = Column(String, nullable=False)
    parentesco_outros = Column(String, nullable=True)
    nome = Column(String, nullable=True)
    idade = Column(Integer, nullable=True)
    cep = Column(String, nullable=True)
    logradouro = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    complemento = Column(String, nullable=True)
    bairro = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    uf = Column(String, nullable=True)
    endereco = Column(Text, nullable=True)
    telefone = Column(String, nullable=True)


class ConviventeDocumentoCivilDB(Base):
    __tablename__ = "convivente_documentos_civis"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False, index=True)
    tipo = Column(String, nullable=False)
    tipo_outros = Column(String, nullable=True)
    numero = Column(String, nullable=True)
    orientacoes = Column(Text, nullable=True)


class ConviventeSubstanciaDB(Base):
    __tablename__ = "convivente_substancias"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False, index=True)
    tipo = Column(String, nullable=False)
    desde_quando = Column(String, nullable=True)
    quantidade = Column(String, nullable=True)


class ConviventeMedicamentoDB(Base):
    __tablename__ = "convivente_medicamentos"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False, index=True)
    nome = Column(String, nullable=False)
    tempo_uso = Column(String, nullable=True)
    modo_uso = Column(Text, nullable=True)


class ConviventeInternacaoDB(Base):
    __tablename__ = "convivente_internacoes"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False, index=True)
    onde = Column(String, nullable=True)
    periodo = Column(String, nullable=True)
    quem_encaminhou = Column(String, nullable=True)


class ConviventeEquipamentoAnteriorDB(Base):
    __tablename__ = "convivente_equipamentos_anteriores"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False, index=True)
    origem_encaminhamento_id = Column(String, ForeignKey("origens_encaminhamento.id"), nullable=True)
    descricao_outros = Column(String, nullable=True)


class RegistroPIADB(Base):
    __tablename__ = "registros_pia"
    __table_args__ = (
        Index("ix_registros_pia_origem", "origem_modulo", "origem_registro_id"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    registro_pai_id = Column(String, ForeignKey("registros_pia.id"), nullable=True)

    tipo_registro = Column(String, nullable=False, default="Evolução")
    titulo = Column(String, nullable=False)
    subtitulo = Column(String, nullable=True)
    descricao = Column(Text, nullable=False)
    objetivos = Column(Text, nullable=True)
    encaminhamentos = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="Em acompanhamento")
    data_registro = Column(DateTime, default=datetime.datetime.utcnow)

    expectativas_servico = Column(Text, nullable=True)
    expectativas_vida_projetos = Column(Text, nullable=True)
    destino_siat_iii = Column(Boolean, default=False)
    destino_moradia_autonoma = Column(Boolean, default=False)
    destino_retorno_familiar = Column(Boolean, default=False)
    destino_explicacao = Column(Text, nullable=True)
    dificuldades_planos = Column(Text, nullable=True)
    origem_modulo = Column(String, nullable=True)
    origem_registro_id = Column(String, nullable=True)


class AssinaturaFormularioPiaDB(Base):
    __tablename__ = "assinaturas_formulario_pia"
    __table_args__ = (
        Index("ix_assinaturas_formulario_pia_convivente", "convivente_id", "assinado_em"),
        Index("ix_assinaturas_formulario_pia_instituicao", "instituicao_id"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    tipo_evento = Column(String, nullable=False)
    metodo_leitura = Column(String, nullable=True)
    codigo_lido = Column(String, nullable=False)
    numero_prontuario = Column(Integer, nullable=True)
    modo_formulario = Column(String, nullable=True)
    assinado_em = Column(DateTime, nullable=False, default=agora_operacional_naive)
    criado_em = Column(DateTime, default=agora_operacional_naive)


class AssinaturaTermoBagageiroDB(Base):
    __tablename__ = "assinaturas_termo_bagageiro"
    __table_args__ = (
        Index("ix_assinaturas_termo_bagageiro_convivente", "convivente_id", "criado_em"),
        Index("ix_assinaturas_termo_bagageiro_instituicao", "instituicao_id"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    tipo_evento = Column(String, nullable=False)
    metodo_leitura = Column(String, nullable=True)
    codigo_lido = Column(String, nullable=True)
    numero_prontuario = Column(Integer, nullable=True)
    assinado_em = Column(DateTime, nullable=True)
    criado_em = Column(DateTime, default=agora_operacional_naive)


class HistoricoConviventeDB(Base):
    __tablename__ = "historicos_conviventes"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False, index=True)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    historico_legado_id = Column(String, ForeignKey("historico_legado_siat.id"), nullable=True)

    origem_informacao = Column(String, nullable=False)
    data_origem = Column(Date, nullable=False, index=True)
    titulo = Column(String, nullable=True)
    descricao = Column(Text, nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)

class DocumentoConviventeDB(Base):
    __tablename__ = "documentos_conviventes"
    id = Column(String, primary_key=True, default=get_uuid)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    nome_arquivo = Column(String, nullable=False) 
    caminho_arquivo = Column(String, nullable=False) 
    tipo_documento = Column(String, nullable=False)
    sensivel = Column(Boolean, default=False)
    data_upload = Column(DateTime, default=datetime.datetime.utcnow)

class OcorrenciaConviventeDB(Base):
    __tablename__ = "ocorrencias_conviventes"
    
    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False) 
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    
    usuario_criador_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    tecnico_responsavel_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    convivente_autor_ocorrencia = Column(Boolean, default=False)
    funcionario_envolvido_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    assinatura_convivente_metodo = Column(String, nullable=True)
    assinatura_convivente_codigo = Column(String, nullable=True)
    assinatura_convivente_validada_em = Column(DateTime, nullable=True)
    
    tipo_ocorrencia = Column(String, nullable=False)
    motivo = Column(String, nullable=False) 
    descricao = Column(Text, nullable=False) 
    data_ocorrencia = Column(DateTime, default=datetime.datetime.utcnow)
    
    requer_acao_tecnica = Column(Boolean, default=False)
    prioridade = Column(String, default="Média")
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
    observacao = Column(Text, nullable=True)
    data_registro = Column(DateTime, default=datetime.datetime.utcnow)
    # 1 = 1ª refeição extra do dia (Rep1), 2 = Rep2, etc.; null na 1ª refeição do tipo.
    repeticao_extra_refeicao = Column(Integer, nullable=True)

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


class LavanderiaRegistroDB(Base):
    __tablename__ = "lavanderia_registros"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False, index=True)

    usuario_entrega_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    quantidade_entregue = Column(Integer, nullable=False)
    entregue_em = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    prazo_retirada_em = Column(DateTime, nullable=False, index=True)
    observacao_entrega = Column(Text, nullable=True)

    status = Column(String, default="Em lavanderia", index=True)
    quantidade_retirada = Column(Integer, nullable=True)
    usuario_retirada_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    retirado_em = Column(DateTime, nullable=True)
    observacao_retirada = Column(Text, nullable=True)

    cancelado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    cancelado_em = Column(DateTime, nullable=True)
    motivo_cancelamento = Column(Text, nullable=True)


class PertenceRecolhidoDB(Base):
    __tablename__ = "pertences_recolhidos"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    quarto_id = Column(String, ForeignKey("quartos.id"), nullable=False, index=True)
    usuario_recolha_id = Column(String, ForeignKey("usuarios.id"), nullable=False)

    quantidade_recolhida = Column(Integer, nullable=False)
    quantidade_disponivel = Column(Integer, nullable=False)
    recolhido_em = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    observacao = Column(Text, nullable=True)
    status = Column(String, default="Com saldo", index=True)

    encerrado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    encerrado_em = Column(DateTime, nullable=True)
    justificativa_encerramento = Column(Text, nullable=True)
    destino_encerramento = Column(String, nullable=True)


class PertenceRecolhidoBaixaDB(Base):
    __tablename__ = "pertences_recolhidos_baixas"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    pertence_recolhido_id = Column(String, ForeignKey("pertences_recolhidos.id"), nullable=False, index=True)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=True, index=True)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)

    quantidade = Column(Integer, nullable=False)
    tipo_baixa = Column(String, nullable=False)
    justificativa = Column(Text, nullable=True)
    destino = Column(String, nullable=True)
    baixado_em = Column(DateTime, default=datetime.datetime.utcnow, index=True)

class HistoricoLegadoSIATDB(Base):
    __tablename__ = "historico_legado_siat"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=True, index=True)

    origem_informacao = Column(String, default="SIAT II", nullable=False)
    arquivo_origem = Column(String, nullable=False, index=True)
    ano_origem = Column(Integer, nullable=True, index=True)
    pagina_origem = Column(Integer, nullable=True)
    sequencia_origem = Column(Integer, nullable=True)

    data_original = Column(Date, nullable=True, index=True)
    data_original_texto = Column(String, nullable=True)
    operador_origem = Column(String, nullable=True, index=True)
    titulo_original = Column(String, nullable=True)
    nome_identificado = Column(String, nullable=True, index=True)

    tipo_sugerido = Column(String, default="Não classificado", index=True)
    status_revisao = Column(String, default="Pendente", index=True)
    texto_original = Column(Text, nullable=False)
    observacoes_revisao = Column(Text, nullable=True)

    importado_em = Column(DateTime, default=datetime.datetime.utcnow)


class HistoricoLegadoRotinaSIATDB(Base):
    __tablename__ = "historico_legado_rotina_siat"
    __table_args__ = (
        UniqueConstraint("id_as_atendimento_serv_legado", name="uq_rotina_siat_atendimento_serv_legado"),
        Index("ix_rotina_siat_instituicao_data", "instituicao_id", "data_servico"),
        Index("ix_rotina_siat_instituicao_convivente_data", "instituicao_id", "convivente_id", "data_servico"),
        Index("ix_rotina_siat_instituicao_sisa_data", "instituicao_id", "numero_sisa", "data_servico"),
        Index("ix_rotina_siat_instituicao_servico_data", "instituicao_id", "servico_prestado", "data_servico"),
        Index("ix_rotina_siat_instituicao_quarto_cama", "instituicao_id", "quarto", "cama"),
        Index("ix_rotina_siat_instituicao_status", "instituicao_id", "status_revisao"),
        Index("ix_rotina_siat_legado_atendimento", "id_as_atendimento_legado"),
        Index("ix_rotina_siat_nome_convivente", "instituicao_id", "nome_convivente"),
        Index("ix_rotina_siat_usuario_origem", "instituicao_id", "usuario_origem"),
        Index("ix_rotina_siat_instituicao_identificado_data", "instituicao_id", "identificado", "data_servico"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=True)

    origem_arquivo = Column(String, nullable=False)
    linha_origem = Column(Integer, nullable=True)
    id_as_atendimento_serv_legado = Column(String, nullable=False)
    id_as_atendimento_legado = Column(String, nullable=True)
    id_cr_clientes_legado = Column(String, nullable=True)

    numero_sisa = Column(String, nullable=True)
    numero_institucional_legado = Column(String, nullable=True)
    nome_convivente = Column(String, nullable=True)
    data_nascimento = Column(Date, nullable=True)
    nome_mae = Column(String, nullable=True)

    data_servico = Column(Date, nullable=False)
    servico_prestado = Column(String, nullable=True)
    id_servico_prestado_legado = Column(String, nullable=True)
    atividade = Column(String, nullable=True)
    id_atividade_legado = Column(String, nullable=True)

    quarto = Column(String, nullable=True)
    cama = Column(String, nullable=True)
    periodo_acolhimento = Column(String, nullable=True)
    data_entrada = Column(Date, nullable=True)
    data_saida = Column(Date, nullable=True)
    motivo_saida = Column(String, nullable=True)
    gestante = Column(Boolean, nullable=True)
    gestante_com_pre_natal = Column(Boolean, nullable=True)

    auditoria_datahora = Column(DateTime, nullable=True)
    usuario_origem = Column(String, nullable=True)
    chave_natural_convivente = Column(String, nullable=True)
    confianca_vinculo = Column(String, nullable=True)
    identificado = Column(Boolean, default=False)
    status_revisao = Column(String, default="Pendente")
    observacoes = Column(Text, nullable=True)
    importado_em = Column(DateTime, default=datetime.datetime.utcnow)


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


class SisaImportacaoDB(Base):
    __tablename__ = "sisa_importacoes"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)

    nome_arquivo = Column(String, nullable=False)
    servico = Column(String, nullable=True)
    data_referencia = Column(Date, nullable=False)
    importado_em = Column(DateTime, default=datetime.datetime.utcnow)

    total_linhas = Column(Integer, default=0)
    total_vinculados = Column(Integer, default=0)
    total_nao_encontrados = Column(Integer, default=0)
    total_divergencias = Column(Integer, default=0)
    total_alertas_criticos = Column(Integer, default=0)


class SisaPresencaImportadaDB(Base):
    __tablename__ = "sisa_presencas_importadas"

    id = Column(String, primary_key=True, default=get_uuid)
    importacao_id = Column(String, ForeignKey("sisa_importacoes.id"), nullable=False)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=True)

    numero_sisa = Column(String, nullable=False)
    nome_planilha = Column(String, nullable=False)
    nome_social_planilha = Column(String, nullable=True)
    data_referencia = Column(Date, nullable=False)
    data_nascimento = Column(Date, nullable=True)
    sexo = Column(String, nullable=True)
    data_vinculacao = Column(Date, nullable=True)
    data_desligamento = Column(Date, nullable=True)
    dias_permanencia = Column(Integer, nullable=False, default=0)
    status_vinculo = Column(String, default="Vinculado")


class AusenciaJustificadaConfirmacaoDB(Base):
    __tablename__ = "ausencias_justificadas_confirmacoes"
    __table_args__ = (
        Index("ix_aus_just_conf_instituicao_id", "instituicao_id"),
        Index("ix_aus_just_conf_convivente_id", "convivente_id"),
        Index("ix_aus_just_conf_data_referencia", "data_referencia"),
        Index(
            "ux_aus_just_conf_convivente_data",
            "instituicao_id",
            "convivente_id",
            "data_referencia",
            unique=True,
        ),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)

    data_referencia = Column(Date, nullable=False)
    continua_ausente = Column(Boolean, nullable=False)
    status_atribuido = Column(String, nullable=True)
    justificativa = Column(Text, nullable=True)
    respondido_em = Column(DateTime, default=datetime.datetime.utcnow)


class SisaDivergenciaDB(Base):
    __tablename__ = "sisa_divergencias"

    id = Column(String, primary_key=True, default=get_uuid)
    importacao_id = Column(String, ForeignKey("sisa_importacoes.id"), nullable=False)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=True)

    numero_sisa = Column(String, nullable=False)
    nome_convivente = Column(String, nullable=False)
    tipo = Column(String, nullable=False)
    prioridade = Column(String, default="Normal")
    status = Column(String, default="Pendente")

    data_inicio = Column(Date, nullable=True)
    data_fim = Column(Date, nullable=False)
    dias_sisa_anterior = Column(Integer, nullable=True)
    dias_sisa_atual = Column(Integer, nullable=False, default=0)
    dias_sisa_delta = Column(Integer, nullable=True)
    dias_carecore = Column(Integer, nullable=False, default=0)
    diferenca = Column(Integer, nullable=True)

    dias_carecore_lista = Column(Text, nullable=True)
    resumo_carecore_json = Column(Text, nullable=True)
    mensagem = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)

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
    criado_em = Column(DateTime, default=agora_operacional_naive)
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
    criado_em = Column(DateTime, default=agora_operacional_naive)


class CobrancaCicloDB(Base):
    __tablename__ = "cobranca_ciclos"
    __table_args__ = (
        UniqueConstraint("organizacao_id", "data_fechamento", name="uq_cobranca_ciclo_organizacao_fechamento"),
        Index("ix_cobranca_ciclos_organizacao_fechamento", "organizacao_id", "data_fechamento"),
        Index("ix_cobranca_ciclos_organizacao_status", "organizacao_id", "status_pagamento"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    organizacao_id = Column(String, ForeignKey("organizacoes.id"), nullable=False, index=True)
    data_fechamento = Column(Date, nullable=False)
    data_corte_inativacao = Column(Date, nullable=False)
    data_vencimento = Column(Date, nullable=False)

    modo = Column(String, nullable=False)
    total_cadastros_faturaveis = Column(Integer, default=0, nullable=False)
    valor_total_mensalidade = Column(Float, default=0, nullable=False)
    status = Column(String, default="Calculado", nullable=False)
    status_pagamento = Column(String, default="Pendente", nullable=False)

    asaas_customer_id = Column(String, nullable=True)
    asaas_payment_id = Column(String, nullable=True, index=True)
    asaas_invoice_url = Column(String, nullable=True)
    asaas_bank_slip_url = Column(String, nullable=True)
    asaas_pix_qr_code = Column(Text, nullable=True)

    criado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    atualizado_em = Column(DateTime, nullable=True)
    pago_em = Column(DateTime, nullable=True)
    cancelado_em = Column(DateTime, nullable=True)


class CobrancaProjetoRateioDB(Base):
    __tablename__ = "cobranca_projetos_rateio"
    __table_args__ = (
        UniqueConstraint("ciclo_id", "instituicao_id", name="uq_cobranca_rateio_ciclo_projeto"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    ciclo_id = Column(String, ForeignKey("cobranca_ciclos.id"), nullable=False, index=True)
    organizacao_id = Column(String, ForeignKey("organizacoes.id"), nullable=False, index=True)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    projeto_nome = Column(String, nullable=False)

    conviventes_faturaveis = Column(Integer, default=0, nullable=False)
    usuarios_faturaveis = Column(Integer, default=0, nullable=False)
    cadastros_faturaveis = Column(Integer, default=0, nullable=False)
    percentual_rateio = Column(Float, nullable=True)
    valor_mensalidade = Column(Float, default=0, nullable=False)

    criado_em = Column(DateTime, default=datetime.datetime.utcnow)


class CobrancaEventoAsaasDB(Base):
    __tablename__ = "cobranca_eventos_asaas"

    id = Column(String, primary_key=True, default=get_uuid)
    ciclo_id = Column(String, ForeignKey("cobranca_ciclos.id"), nullable=True, index=True)
    organizacao_id = Column(String, ForeignKey("organizacoes.id"), nullable=True, index=True)
    asaas_event_id = Column(String, nullable=True, unique=True)
    evento_tipo = Column(String, nullable=False)
    payload = Column(Text, nullable=False)
    recebido_em = Column(DateTime, default=datetime.datetime.utcnow)


class CobrancaLiberacaoTemporariaDB(Base):
    __tablename__ = "cobranca_liberacoes_temporarias"
    __table_args__ = (
        Index("ix_cobranca_liberacoes_organizacao_ativo", "organizacao_id", "ativo"),
        Index("ix_cobranca_liberacoes_organizacao_prazo", "organizacao_id", "liberado_ate"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    organizacao_id = Column(String, ForeignKey("organizacoes.id"), nullable=False, index=True)
    motivo = Column(Text, nullable=False)
    liberado_ate = Column(DateTime, nullable=False)
    ativo = Column(Boolean, default=True, nullable=False)

    criado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    revogado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    revogado_em = Column(DateTime, nullable=True)
    observacao_revogacao = Column(Text, nullable=True)


class ChatConversaDB(Base):
    __tablename__ = "chat_conversas"

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    tipo = Column(String, default="direta", nullable=False)
    titulo = Column(String, nullable=True)
    criado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.datetime.utcnow)


class ChatParticipanteDB(Base):
    __tablename__ = "chat_participantes"

    id = Column(String, primary_key=True, default=get_uuid)
    conversa_id = Column(String, ForeignKey("chat_conversas.id"), nullable=False, index=True)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    ativo = Column(Boolean, default=True)
    ultimo_lido_em = Column(DateTime, nullable=True)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)


class ChatMensagemDB(Base):
    __tablename__ = "chat_mensagens"

    id = Column(String, primary_key=True, default=get_uuid)
    conversa_id = Column(String, ForeignKey("chat_conversas.id"), nullable=False, index=True)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False, index=True)
    remetente_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)
    conteudo = Column(Text, nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class AcompanhamentoTransferenciaDB(Base):
    __tablename__ = "acompanhamentos_transferencias"
    __table_args__ = (
        Index("ix_acomp_transferencias_instituicao_id", "instituicao_id"),
        Index("ix_acomp_transferencias_convivente_id", "convivente_id"),
        Index("ix_acomp_transferencias_destino", "destino"),
        Index("ix_acomp_transferencias_data_transferencia", "data_transferencia"),
        Index("ix_acomp_transferencias_criado_em", "criado_em"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    destino = Column(String, nullable=False)
    destino_outro = Column(String, nullable=True)
    data_discussao = Column(Date, nullable=True)
    data_visita = Column(Date, nullable=True)
    data_transferencia = Column(Date, nullable=True)
    observacoes = Column(Text, nullable=True)
    registrado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.datetime.utcnow)


class AcompanhamentoDiscussaoHospitalarDB(Base):
    __tablename__ = "acompanhamentos_discussoes_hospitalares"
    __table_args__ = (
        Index("ix_acomp_discussoes_instituicao_id", "instituicao_id"),
        Index("ix_acomp_discussoes_convivente_id", "convivente_id"),
        Index("ix_acomp_discussoes_registro_pai_id", "registro_pai_id"),
        Index("ix_acomp_discussoes_data_discussao", "data_discussao"),
        Index("ix_acomp_discussoes_status_evolucao", "status_evolucao"),
        Index("ix_acomp_discussoes_criado_em", "criado_em"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    registro_pai_id = Column(
        String,
        ForeignKey("acompanhamentos_discussoes_hospitalares.id", ondelete="CASCADE"),
        nullable=True,
    )
    nome_hospital = Column(String, nullable=True)
    hospital_outro = Column(String, nullable=True)
    data_discussao = Column(Date, nullable=True)
    data_prevista_entrada = Column(Date, nullable=True)
    status_evolucao = Column(String, nullable=True)
    data_evolucao = Column(Date, nullable=True)
    observacoes = Column(Text, nullable=True)
    registrado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.datetime.utcnow)


class AcompanhamentoTbDB(Base):
    __tablename__ = "acompanhamentos_tb"
    __table_args__ = (
        Index("ix_acomp_tb_instituicao_id", "instituicao_id"),
        Index("ix_acomp_tb_convivente_id", "convivente_id"),
        Index("ix_acomp_tb_situacao", "situacao"),
        Index("ix_acomp_tb_data_inicio", "data_inicio"),
        Index("ix_acomp_tb_criado_em", "criado_em"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    situacao = Column(String, nullable=True)
    data_inicio = Column(Date, nullable=True)
    data_fim = Column(Date, nullable=True)
    observacoes = Column(Text, nullable=True)
    registrado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.datetime.utcnow)


class AcompanhamentoPotDB(Base):
    __tablename__ = "acompanhamentos_pot"
    __table_args__ = (
        Index("ix_acomp_pot_instituicao_id", "instituicao_id"),
        Index("ix_acomp_pot_convivente_id", "convivente_id"),
        Index("ix_acomp_pot_registro_pai_id", "registro_pai_id"),
        Index("ix_acomp_pot_status_evolucao", "status_evolucao"),
        Index("ix_acomp_pot_data_insercao", "data_insercao"),
        Index("ix_acomp_pot_criado_em", "criado_em"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    registro_pai_id = Column(
        String,
        ForeignKey("acompanhamentos_pot.id", ondelete="CASCADE"),
        nullable=True,
    )
    status_evolucao = Column(String, nullable=True)
    data_evolucao = Column(Date, nullable=True)
    data_insercao = Column(Date, nullable=True)
    data_desligamento = Column(Date, nullable=True)
    congelamento_ativo = Column(Boolean, default=False)
    congelamento_inicio = Column(Date, nullable=True)
    congelamento_fim = Column(Date, nullable=True)
    observacoes = Column(Text, nullable=True)
    registrado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.datetime.utcnow)


class AcompanhamentoSuspensaoProvisoriaDB(Base):
    __tablename__ = "acompanhamentos_suspensoes_provisorias"
    __table_args__ = (
        Index("ix_acomp_suspensoes_instituicao_id", "instituicao_id"),
        Index("ix_acomp_suspensoes_convivente_id", "convivente_id"),
        Index("ix_acomp_suspensoes_mes_referencia", "mes_referencia"),
        Index("ix_acomp_suspensoes_data_registro", "data_registro"),
        Index("ix_acomp_suspensoes_status_aplicado", "status_aplicado"),
        Index("ix_acomp_suspensoes_criado_em", "criado_em"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    mes_referencia = Column(String, nullable=False)
    data_registro = Column(Date, nullable=False)
    motivo = Column(Text, nullable=True)
    observacoes = Column(Text, nullable=True)
    status_aplicado = Column(String, nullable=False, default="Bloqueado")
    registrado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=datetime.datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.datetime.utcnow)


class AtividadeDB(Base):
    __tablename__ = "atividades"
    __table_args__ = (
        Index("ix_atividades_instituicao_id", "instituicao_id"),
        Index("ix_atividades_instituicao_ativo", "instituicao_id", "ativo"),
        Index("ix_atividades_responsavel", "responsavel_usuario_id"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    nome = Column(String, nullable=False)
    categoria = Column(String, nullable=False, default="oficina")
    responsavel_usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    tipo_frequencia = Column(String, nullable=False, default="semanal")
    configuracao_agenda = Column(Text, nullable=True)
    vigencia_inicio = Column(Date, nullable=True)
    vigencia_fim = Column(Date, nullable=True)
    sisa_descricao_atividade = Column(String, nullable=True)
    sisa_descricao_tema = Column(String, nullable=True)
    sisa_horario_padrao = Column(String, nullable=True)
    ativo = Column(Boolean, default=True)
    criado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=agora_operacional_naive)
    atualizado_em = Column(DateTime, default=agora_operacional_naive)


class AtividadeOcorrenciaDB(Base):
    __tablename__ = "atividade_ocorrencias"
    __table_args__ = (
        Index("ix_atividade_ocorrencias_instituicao", "instituicao_id"),
        Index("ix_atividade_ocorrencias_atividade_mes", "atividade_id", "mes_referencia"),
        UniqueConstraint("atividade_id", "data_sessao", "horario_sessao", name="uq_atividade_ocorrencia_data_horario"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    atividade_id = Column(String, ForeignKey("atividades.id"), nullable=False)
    data_sessao = Column(Date, nullable=False)
    numero_sessao_mes = Column(Integer, nullable=False)
    mes_referencia = Column(String, nullable=False)
    horario_sessao = Column(String, nullable=False, default="")
    status = Column(String, nullable=False, default="aberta")
    criado_em = Column(DateTime, default=agora_operacional_naive)


class AtividadePresencaDB(Base):
    __tablename__ = "atividade_presencas"
    __table_args__ = (
        Index("ix_atividade_presencas_instituicao", "instituicao_id"),
        Index("ix_atividade_presencas_ocorrencia", "ocorrencia_id"),
        Index("ix_atividade_presencas_convivente", "convivente_id"),
        Index("ix_atividade_presencas_atividade", "atividade_id"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    atividade_id = Column(String, ForeignKey("atividades.id"), nullable=False)
    ocorrencia_id = Column(String, ForeignKey("atividade_ocorrencias.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    metodo_leitura = Column(String, nullable=False)
    codigo_lido = Column(String, nullable=True)
    registrado_em = Column(DateTime, default=agora_operacional_naive)
    cancelado = Column(Boolean, default=False)
    cancelado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    cancelado_em = Column(DateTime, nullable=True)
    motivo_cancelamento = Column(Text, nullable=True)


class AtividadeSessaoConteudoDB(Base):
    __tablename__ = "atividade_sessao_conteudos"
    __table_args__ = (
        Index("ix_atividade_sessao_conteudos_ocorrencia", "ocorrencia_id"),
        UniqueConstraint("ocorrencia_id", name="uq_atividade_sessao_conteudo_ocorrencia"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    atividade_id = Column(String, ForeignKey("atividades.id"), nullable=False)
    ocorrencia_id = Column(String, ForeignKey("atividade_ocorrencias.id"), nullable=False)
    acoes_realizadas = Column(Text, nullable=True)
    registrado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=agora_operacional_naive)
    atualizado_em = Column(DateTime, default=agora_operacional_naive)


class AtividadeCatalogoSisaDB(Base):
    __tablename__ = "atividade_catalogo_sisa"
    __table_args__ = (
        Index("ix_atividade_catalogo_sisa_instituicao", "instituicao_id"),
        UniqueConstraint("instituicao_id", "tipo", "valor_norm", name="uq_atividade_catalogo_sisa_valor"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    tipo = Column(String, nullable=False)
    valor = Column(String, nullable=False)
    valor_norm = Column(String, nullable=False)
    personalizado = Column(Boolean, default=True)
    criado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)
    criado_em = Column(DateTime, default=agora_operacional_naive)


class AtividadeSisaVinculoDB(Base):
    __tablename__ = "atividade_sisa_vinculos"
    __table_args__ = (
        Index("ix_atividade_sisa_vinculos_instituicao", "instituicao_id"),
        UniqueConstraint(
            "instituicao_id",
            "sisa_descricao_atividade_norm",
            "sisa_descricao_tema_norm",
            "sisa_horario_norm",
            name="uq_atividade_sisa_vinculo_chave",
        ),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    sisa_descricao_atividade = Column(String, nullable=False)
    sisa_descricao_tema = Column(String, nullable=False)
    sisa_horario = Column(String, nullable=False, default="")
    sisa_descricao_atividade_norm = Column(String, nullable=False)
    sisa_descricao_tema_norm = Column(String, nullable=False)
    sisa_horario_norm = Column(String, nullable=False, default="")
    atividade_id = Column(String, ForeignKey("atividades.id"), nullable=False)
    criado_por_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    criado_em = Column(DateTime, default=agora_operacional_naive)
    atualizado_em = Column(DateTime, default=agora_operacional_naive)


class AtividadeSisaConferenciaHistoricoDB(Base):
    __tablename__ = "atividade_sisa_conferencias_historico"
    __table_args__ = (
        Index("ix_atividade_sisa_conf_hist_instituicao_data", "instituicao_id", "importado_em"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    nome_arquivo = Column(String, nullable=False)
    data_inicio_referencia = Column(Date, nullable=False)
    data_fim_referencia = Column(Date, nullable=False)
    servico = Column(String, nullable=True)
    projeto = Column(String, nullable=True)
    conferidas = Column(Integer, default=0)
    divergencias_quantidade = Column(Integer, default=0)
    sem_vinculo = Column(Integer, default=0)
    sem_ocorrencia_carecore = Column(Integer, default=0)
    somente_carecore = Column(Integer, default=0)
    total_linhas_sisa = Column(Integer, default=0)
    resultado_json = Column(Text, nullable=False)
    vinculos_json = Column(Text, nullable=True, default="[]")
    importado_em = Column(DateTime, default=agora_operacional_naive)


class AtividadePontosResgateDB(Base):
    __tablename__ = "atividade_pontos_resgates"
    __table_args__ = (
        Index("ix_atividade_pontos_resgates_instituicao", "instituicao_id"),
        Index("ix_atividade_pontos_resgates_convivente", "convivente_id"),
        Index("ix_atividade_pontos_resgates_registrado", "instituicao_id", "registrado_em"),
    )

    id = Column(String, primary_key=True, default=get_uuid)
    instituicao_id = Column(String, ForeignKey("instituicoes.id"), nullable=False)
    convivente_id = Column(String, ForeignKey("conviventes.id"), nullable=False)
    pontos_utilizados = Column(Integer, nullable=False)
    descricao_brinde = Column(String, nullable=True)
    usuario_id = Column(String, ForeignKey("usuarios.id"), nullable=False)
    metodo_leitura = Column(String, nullable=False)
    codigo_lido = Column(String, nullable=True)
    registrado_em = Column(DateTime, default=agora_operacional_naive)

