# =====================================================================
# ARQUIVO: schemas.py
# CARECORE+ - Schemas Pydantic
# =====================================================================

import re
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


# --- AUXILIARES (MOTIVOS E ORIGENS) ---

class MotivoInativacaoBase(BaseModel):
    descricao: str


class MotivoInativacaoCreate(MotivoInativacaoBase):
    pass


class MotivoInativacaoResponse(MotivoInativacaoBase):
    id: str
    instituicao_id: str

    model_config = ConfigDict(from_attributes=True)


class OrigemEncaminhamentoBase(BaseModel):
    descricao: str


class OrigemEncaminhamentoCreate(OrigemEncaminhamentoBase):
    pass


class OrigemEncaminhamentoResponse(OrigemEncaminhamentoBase):
    id: str
    instituicao_id: str

    model_config = ConfigDict(from_attributes=True)


# --- INSTITUIÇÃO ---

class InstituicaoBase(BaseModel):
    nome_fantasia: str
    cnpj: Optional[str] = None
    telefone: str


class InstituicaoCreate(InstituicaoBase):
    pass


class InstituicaoResponse(InstituicaoBase):
    id: str
    is_active: bool

    status_assinatura: Optional[str] = "Ativa"
    data_vencimento: Optional[date] = None
    bloqueado: Optional[bool] = False
    bloqueado_em: Optional[datetime] = None
    dias_tolerancia: Optional[int] = 5

    model_config = ConfigDict(from_attributes=True)


# --- USUÁRIO / RBAC / EQUIPE INSTITUCIONAL ---

PERFIS_ACESSO_VALIDOS = {
    "Gestor",
    "Técnico",
    "Orientador",
    "Administrativo",
    "Consulta",
}

MAPEAMENTO_PERFIS_LEGADOS = {
    "Gestao": "Gestor",
    "Gestão": "Gestor",
    "Tecnico": "Técnico",
}


def normalizar_email(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None

    valor = valor.strip().lower()

    if not valor:
        return valor

    padrao_email = r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$"

    if not re.match(padrao_email, valor):
        raise ValueError("E-mail inválido.")

    return valor


def normalizar_cpf(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None

    cpf = re.sub(r"\D", "", valor)

    if not cpf:
        return None

    if len(cpf) != 11:
        raise ValueError("CPF deve conter 11 dígitos.")

    if cpf == cpf[0] * 11:
        raise ValueError("CPF inválido.")

    soma = sum(int(cpf[i]) * (10 - i) for i in range(9))
    digito_1 = 11 - (soma % 11)
    digito_1 = 0 if digito_1 >= 10 else digito_1

    soma = sum(int(cpf[i]) * (11 - i) for i in range(10))
    digito_2 = 11 - (soma % 11)
    digito_2 = 0 if digito_2 >= 10 else digito_2

    if cpf[-2:] != f"{digito_1}{digito_2}":
        raise ValueError("CPF inválido.")

    return cpf


def normalizar_telefone(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None

    telefone = re.sub(r"\D", "", valor)

    if not telefone:
        return None

    if len(telefone) not in (10, 11):
        raise ValueError("Telefone deve conter DDD e 10 ou 11 dígitos.")

    return telefone


def normalizar_cep(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None

    cep = re.sub(r"\D", "", valor)

    if not cep:
        return None

    if len(cep) != 8:
        raise ValueError("CEP deve conter 8 dígitos.")

    return cep


def normalizar_uf(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None

    uf = valor.strip().upper()

    if not uf:
        return None

    ufs_validas = {
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
        "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
        "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
    }

    if uf not in ufs_validas:
        raise ValueError("UF inválida.")

    return uf


def validar_senha_forte_valor(senha: str) -> str:
    if not senha:
        raise ValueError("Senha obrigatória.")

    if len(senha) < 8:
        raise ValueError("A senha deve possuir no mínimo 8 caracteres.")

    if not re.search(r"[A-Z]", senha):
        raise ValueError("A senha deve possuir ao menos 1 letra maiúscula.")

    if not re.search(r"[a-z]", senha):
        raise ValueError("A senha deve possuir ao menos 1 letra minúscula.")

    if not re.search(r"\d", senha):
        raise ValueError("A senha deve possuir ao menos 1 número.")

    if not re.search(r"[@$!%*?&_\-#]", senha):
        raise ValueError("A senha deve possuir ao menos 1 caractere especial.")

    return senha


def normalizar_perfil_acesso(valor: Optional[str]) -> str:
    if valor is None:
        return "Consulta"

    perfil = valor.strip()

    if not perfil:
        return "Consulta"

    perfil = MAPEAMENTO_PERFIS_LEGADOS.get(perfil, perfil)

    if perfil not in PERFIS_ACESSO_VALIDOS:
        raise ValueError(
            "Perfil de acesso inválido. "
            "Use: Gestor, Técnico, Orientador, Administrativo ou Consulta."
        )

    return perfil


class UsuarioBase(BaseModel):
    nome: str
    email: str
    perfil_acesso: str = "Consulta"

    cpf: Optional[str] = None
    telefone: Optional[str] = None
    avatar_url: Optional[str] = None

    data_nascimento: Optional[date] = None
    genero: Optional[str] = None
    rg: Optional[str] = None
    orgao_emissor: Optional[str] = None
    estado_civil: Optional[str] = None
    nacionalidade: Optional[str] = None
    naturalidade: Optional[str] = None

    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None

    cargo: Optional[str] = None
    setor: Optional[str] = None
    conselho_profissional: Optional[str] = None
    numero_conselho: Optional[str] = None
    carga_horaria: Optional[int] = None
    data_admissao: Optional[date] = None
    data_desligamento: Optional[date] = None
    motivo_desligamento: Optional[str] = None
    observacoes_profissionais: Optional[str] = None

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, valor: str):
        valor = valor.strip()

        if len(valor) < 3:
            raise ValueError("Nome deve possuir no mínimo 3 caracteres.")

        return valor

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str):
        email = normalizar_email(valor)

        if not email:
            raise ValueError("E-mail obrigatório.")

        return email

    @field_validator("perfil_acesso")
    @classmethod
    def validar_perfil_acesso(cls, valor: Optional[str]):
        return normalizar_perfil_acesso(valor)

    @field_validator("cpf")
    @classmethod
    def validar_cpf(cls, valor: Optional[str]):
        return normalizar_cpf(valor)

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor: Optional[str]):
        return normalizar_telefone(valor)

    @field_validator("cep")
    @classmethod
    def validar_cep(cls, valor: Optional[str]):
        return normalizar_cep(valor)

    @field_validator("uf")
    @classmethod
    def validar_uf(cls, valor: Optional[str]):
        return normalizar_uf(valor)

    @field_validator("carga_horaria")
    @classmethod
    def validar_carga_horaria(cls, valor: Optional[int]):
        if valor is not None and valor < 0:
            raise ValueError("Carga horária não pode ser negativa.")

        return valor

    @model_validator(mode="after")
    def validar_datas_profissionais_usuario_base(self):
        if (
            self.data_desligamento is not None
            and self.data_admissao is not None
            and self.data_desligamento < self.data_admissao
        ):
            raise ValueError(
                "Data de desligamento não pode ser anterior à data de admissão."
            )

        if self.data_desligamento is not None and not self.motivo_desligamento:
            raise ValueError(
                "Motivo do desligamento é obrigatório quando há data de desligamento."
            )

        return self


class UsuarioCreate(UsuarioBase):
    senha: str

    @field_validator("senha")
    @classmethod
    def validar_senha_forte(cls, senha: str):
        return validar_senha_forte_valor(senha)


class UsuarioUpdate(BaseModel):
    nome: Optional[str] = None
    email: Optional[str] = None
    perfil_acesso: Optional[str] = None

    cpf: Optional[str] = None
    telefone: Optional[str] = None
    avatar_url: Optional[str] = None
    ativo: Optional[bool] = None

    data_nascimento: Optional[date] = None
    genero: Optional[str] = None
    rg: Optional[str] = None
    orgao_emissor: Optional[str] = None
    estado_civil: Optional[str] = None
    nacionalidade: Optional[str] = None
    naturalidade: Optional[str] = None

    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None

    cargo: Optional[str] = None
    setor: Optional[str] = None
    conselho_profissional: Optional[str] = None
    numero_conselho: Optional[str] = None
    carga_horaria: Optional[int] = None
    data_admissao: Optional[date] = None
    data_desligamento: Optional[date] = None
    motivo_desligamento: Optional[str] = None
    observacoes_profissionais: Optional[str] = None

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, valor: Optional[str]):
        if valor is None:
            return None

        valor = valor.strip()

        if len(valor) < 3:
            raise ValueError("Nome deve possuir no mínimo 3 caracteres.")

        return valor

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: Optional[str]):
        return normalizar_email(valor)

    @field_validator("perfil_acesso")
    @classmethod
    def validar_perfil_acesso(cls, valor: Optional[str]):
        if valor is None:
            return None

        return normalizar_perfil_acesso(valor)

    @field_validator("cpf")
    @classmethod
    def validar_cpf(cls, valor: Optional[str]):
        return normalizar_cpf(valor)

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor: Optional[str]):
        return normalizar_telefone(valor)

    @field_validator("cep")
    @classmethod
    def validar_cep(cls, valor: Optional[str]):
        return normalizar_cep(valor)

    @field_validator("uf")
    @classmethod
    def validar_uf(cls, valor: Optional[str]):
        return normalizar_uf(valor)

    @field_validator("carga_horaria")
    @classmethod
    def validar_carga_horaria(cls, valor: Optional[int]):
        if valor is not None and valor < 0:
            raise ValueError("Carga horária não pode ser negativa.")

        return valor

    @model_validator(mode="after")
    def validar_datas_profissionais_usuario_update(self):
        if (
            self.data_desligamento is not None
            and self.data_admissao is not None
            and self.data_desligamento < self.data_admissao
        ):
            raise ValueError(
                "Data de desligamento não pode ser anterior à data de admissão."
            )

        if self.data_desligamento is not None and not self.motivo_desligamento:
            raise ValueError(
                "Motivo do desligamento é obrigatório quando há data de desligamento."
            )

        return self


class UsuarioAlterarSenha(BaseModel):
    senha_atual: Optional[str] = None
    nova_senha: str

    @field_validator("nova_senha")
    @classmethod
    def validar_nova_senha(cls, senha: str):
        return validar_senha_forte_valor(senha)


class UsuarioDefinirSenha(BaseModel):
    nova_senha: str

    @field_validator("nova_senha")
    @classmethod
    def validar_nova_senha(cls, senha: str):
        return validar_senha_forte_valor(senha)


class UsuarioAtivarInativar(BaseModel):
    ativo: bool


class UsuarioResponse(UsuarioBase):
    id: str
    instituicao_id: str
    is_master: bool
    ativo: bool = True

    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    ultimo_login_em: Optional[datetime] = None
    inativado_em: Optional[datetime] = None

    criado_por_id: Optional[str] = None
    atualizado_por_id: Optional[str] = None
    inativado_por_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UsuarioResumoResponse(BaseModel):
    id: str
    nome: str
    email: str
    perfil_acesso: str
    ativo: bool = True
    avatar_url: Optional[str] = None
    cargo: Optional[str] = None
    setor: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- AUTENTICAÇÃO E ONBOARDING ---

class LoginPayload(BaseModel):
    email: str
    senha: str

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str):
        email = normalizar_email(valor)

        if not email:
            raise ValueError("E-mail obrigatório.")

        return email


class OnboardingPayload(BaseModel):
    instituicao: InstituicaoCreate
    usuario_master: UsuarioCreate


# --- LOGIN / TOKEN ---

class Token(BaseModel):
    access_token: str
    token_type: str
    usuario: UsuarioResponse

# --- QUARTOS E LEITOS ---

class LeitoBase(BaseModel):
    identificacao: str
    status: str = "Livre"


class LeitoCreate(LeitoBase):
    id: Optional[str] = None


class LeitoResponse(LeitoBase):
    id: str
    quarto_id: str

    model_config = ConfigDict(from_attributes=True)


class QuartoBase(BaseModel):
    nome: str
    tipo_publico: str
    modalidade: str


class QuartoCreate(QuartoBase):
    leitos: List[LeitoCreate] = []


class QuartoUpdate(QuartoBase):
    is_active: Optional[bool] = None
    leitos: List[LeitoCreate] = []


class QuartoResponse(QuartoBase):
    id: str
    instituicao_id: str
    is_active: bool
    leitos: List[LeitoResponse] = []

    model_config = ConfigDict(from_attributes=True)


# --- DOCUMENTOS (GED) ---

class DocumentoResponse(BaseModel):
    id: str
    convivente_id: str
    nome_arquivo: str
    caminho_arquivo: str
    tipo_documento: str
    data_upload: datetime

    model_config = ConfigDict(from_attributes=True)


# --- OCORRÊNCIAS ---

class InteracaoOcorrenciaBase(BaseModel):
    mensagem: str
    tipo_interacao: str = "Comentário"


class InteracaoOcorrenciaCreate(InteracaoOcorrenciaBase):
    pass


class InteracaoOcorrenciaResponse(InteracaoOcorrenciaBase):
    id: str
    ocorrencia_id: str
    usuario_id: str
    data_interacao: datetime

    model_config = ConfigDict(from_attributes=True)


class ObservadorOcorrenciaResponse(BaseModel):
    id: str
    usuario_id: str
    data_marcacao: datetime

    model_config = ConfigDict(from_attributes=True)


class OcorrenciaBase(BaseModel):
    tipo_ocorrencia: str
    motivo: str
    descricao: str
    requer_acao_tecnica: bool = False
    prioridade: str = "Média"


class OcorrenciaCreate(OcorrenciaBase):
    convivente_id: str
    tecnico_responsavel_id: Optional[str] = None
    observadores_ids: List[str] = []


class OcorrenciaResponse(OcorrenciaBase):
    id: str
    instituicao_id: str
    convivente_id: str
    usuario_criador_id: str
    tecnico_responsavel_id: Optional[str]
    data_ocorrencia: datetime
    status_resolucao: str
    parecer_tecnico: Optional[str]
    data_resolucao: Optional[datetime]
    usuario_resolutor_id: Optional[str]

    interacoes: List[InteracaoOcorrenciaResponse] = []
    observadores: List[ObservadorOcorrenciaResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OcorrenciaPrioridadeResumo(BaseModel):
    prioridade: str
    total: int
    pendentes: int
    resolvidas: int


class OcorrenciaRelatorioPrioridades(BaseModel):
    total: int
    pendentes: int
    resolvidas: int
    por_prioridade: List[OcorrenciaPrioridadeResumo]


# --- CONVIVENTE ---

class ConviventeBase(BaseModel):
    status: str = "Ativo"

    data_entrada: Optional[date] = None
    leito_id: Optional[str] = None
    tecnico_id: Optional[str] = None

    motivo_inativacao_id: Optional[str] = None
    origem_encaminhamento_id: Optional[str] = None

    nome_completo: str
    nome_social: Optional[str] = None

    cpf: Optional[str] = None
    rg: Optional[str] = None

    data_nascimento: Optional[date] = None

    identidade_genero: Optional[str] = None
    orientacao_sexual: Optional[str] = None

    estado_civil: Optional[str] = None
    escolaridade: Optional[str] = None
    naturalidade: Optional[str] = None

    telefone_celular: Optional[str] = None

    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None

    nome_mae: Optional[str] = None
    nome_pai: Optional[str] = None

    numero_nis: Optional[str] = None
    numero_sisa: Optional[str] = None

    status_cadunico: Optional[str] = None
    programas_beneficios: Optional[str] = None

    possui_renda: bool = False
    renda_mensal: Optional[float] = None

    contato_emergencia_nome: Optional[str] = None
    contato_emergencia_telefone: Optional[str] = None

    observacoes_saude: Optional[str] = None

    email_pessoal: Optional[str] = None
    senha_email: Optional[str] = None
    senha_govbr: Optional[str] = None

    egresso_prisional: bool = False
    usa_tornozeleira: bool = False

    medidas_protetivas: Optional[str] = None
    acompanhamento_caps: Optional[str] = None
    uso_substancias: Optional[str] = None
    transtorno_mental: Optional[str] = None


class ConviventeCreate(ConviventeBase):
    observacao_status: Optional[str] = None


class ConviventeUpdate(ConviventeBase):
    observacao_status: Optional[str] = None


class ConviventeResponse(ConviventeBase):
    id: str
    instituicao_id: str

    numero_institucional: Optional[int] = None
    foto_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# ROTINA DIÁRIA
# =====================================================================

class RegistroRotinaBase(BaseModel):
    tipo_registro: str


class RegistroRotinaCreate(RegistroRotinaBase):
    convivente_id: str
    justificativa_retorno_rapido: Optional[str] = None


class RegistroRotinaResponse(RegistroRotinaBase):
    id: str

    instituicao_id: str
    convivente_id: str
    usuario_id: str

    data_registro: datetime

    retorno_rapido: Optional[bool] = False
    justificativa_retorno_rapido: Optional[str] = None

    foi_editado: Optional[bool] = False
    editado_por_id: Optional[str] = None
    editado_em: Optional[datetime] = None
    motivo_edicao: Optional[str] = None

    tipo_registro_original: Optional[str] = None
    data_registro_original: Optional[datetime] = None

    cancelado: Optional[bool] = False
    cancelado_por_id: Optional[str] = None
    cancelado_em: Optional[datetime] = None
    motivo_cancelamento: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class RegistroRotinaEdicao(BaseModel):
    tipo_registro: str
    motivo_edicao: str


class RegistroRotinaCancelamento(BaseModel):
    motivo_cancelamento: str


class RegistroRotinaDesfazerRapido(BaseModel):
    pass


# =====================================================================
# CONVÊNIO / SISA / FECHAMENTO MENSAL
# =====================================================================

class FechamentoMensalCreate(BaseModel):
    ano: int
    mes: int
    observacoes: Optional[str] = None


class FechamentoMensalReabertura(BaseModel):
    motivo_reabertura: str


class FechamentoMensalResponse(BaseModel):
    id: str
    instituicao_id: str
    ano: int
    mes: int
    protocolo: str
    status: str
    fechado_por_id: str
    fechado_em: datetime
    observacoes: Optional[str] = None

    reaberto_por_id: Optional[str] = None
    reaberto_em: Optional[datetime] = None
    motivo_reabertura: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SisaLancamentoCreate(BaseModel):
    ano: int
    mes: int
    convivente_id: str
    observacoes: Optional[str] = None


class SisaLancamentoResponse(BaseModel):
    id: str
    instituicao_id: str
    ano: int
    mes: int
    convivente_id: str
    status: str
    lancado_por_id: str
    lancado_em: datetime
    observacoes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# COMUNICAÇÃO INTERNA / AVISOS IMPORTANTES
# =====================================================================

class AvisoDestinatarioCreate(BaseModel):
    usuario_id: str


class AvisoCreate(BaseModel):
    titulo: str
    mensagem: str
    classificacao: str = "Informativo"
    prioridade: str = "normal"
    destino_tipo: str = "todos"
    destinatarios_ids: List[str] = []
    ativo: bool = True
    valido_ate: Optional[datetime] = None


class AvisoUpdate(BaseModel):
    titulo: Optional[str] = None
    mensagem: Optional[str] = None
    classificacao: Optional[str] = None
    prioridade: Optional[str] = None
    destino_tipo: Optional[str] = None
    destinatarios_ids: Optional[List[str]] = None
    ativo: Optional[bool] = None
    valido_ate: Optional[datetime] = None


class AvisoDestinatarioResponse(BaseModel):
    id: str
    aviso_id: str
    usuario_id: str
    lido: bool
    lido_em: Optional[datetime] = None
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)


class AvisoResponse(BaseModel):
    id: str
    instituicao_id: str
    remetente_id: str

    titulo: str
    mensagem: str
    classificacao: str
    prioridade: str
    destino_tipo: str

    ativo: bool
    criado_em: datetime
    valido_ate: Optional[datetime] = None

    atualizado_em: Optional[datetime] = None
    cancelado_em: Optional[datetime] = None
    cancelado_por_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AvisoDashboardResponse(BaseModel):
    id: str
    remetente_id: str
    remetente_nome: Optional[str] = None

    titulo: str
    mensagem: Optional[str] = None
    mensagem_resumo: str
    classificacao: str
    prioridade: str
    destino_tipo: str

    lido: bool = False
    lido_em: Optional[datetime] = None
    criado_em: datetime
    valido_ate: Optional[datetime] = None

    pode_exibir_titulo: bool = True


class AvisosResumoResponse(BaseModel):
    total_visiveis: int
    total_nao_lidos: int
    total_alertas_ativos: int

