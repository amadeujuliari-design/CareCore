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


# --- ORGANIZAÇÃO / PROJETO ---

class EnderecoBase(BaseModel):
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None

    @field_validator("cep")
    @classmethod
    def validar_cep(cls, valor: Optional[str]):
        return normalizar_cep(valor)

    @field_validator("uf")
    @classmethod
    def validar_uf(cls, valor: Optional[str]):
        return normalizar_uf(valor)


class OrganizacaoBase(EnderecoBase):
    nome: str
    cnpj: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, valor: str):
        valor = valor.strip()
        if not valor:
            raise ValueError("Nome da organização obrigatório.")
        return valor

    @field_validator("cnpj")
    @classmethod
    def validar_cnpj(cls, valor: Optional[str]):
        return normalizar_cnpj(valor)

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor: Optional[str]):
        return normalizar_telefone(valor)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: Optional[str]):
        return normalizar_email(valor)


class OrganizacaoCreate(OrganizacaoBase):
    pass


class OrganizacaoResponse(OrganizacaoBase):
    id: str
    is_active: bool = True
    criado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class InstituicaoBase(EnderecoBase):
    nome_fantasia: str
    cnpj: Optional[str] = None
    telefone: str
    email: Optional[str] = None
    tipo_projeto: Optional[str] = "Projeto"
    projeto_unico: Optional[bool] = True

    @field_validator("nome_fantasia")
    @classmethod
    def validar_nome_fantasia(cls, valor: str):
        valor = valor.strip()
        if not valor:
            raise ValueError("Nome do projeto obrigatório.")
        return valor

    @field_validator("cnpj")
    @classmethod
    def validar_cnpj(cls, valor: Optional[str]):
        return normalizar_cnpj(valor)

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor: str):
        telefone = normalizar_telefone(valor)
        if not telefone:
            raise ValueError("Telefone obrigatório.")
        return telefone

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: Optional[str]):
        return normalizar_email(valor)


class InstituicaoCreate(InstituicaoBase):
    pass


class InstituicaoResponse(InstituicaoBase):
    id: str
    organizacao_id: Optional[str] = None
    is_active: bool

    status_assinatura: Optional[str] = "Ativa"
    data_vencimento: Optional[date] = None
    bloqueado: Optional[bool] = False
    bloqueado_em: Optional[datetime] = None
    dias_tolerancia: Optional[int] = 5

    model_config = ConfigDict(from_attributes=True)


class IdentidadeRelatorioBase(BaseModel):
    relatorio_nome_exibicao: Optional[str] = None
    relatorio_rodape_linha1: Optional[str] = None
    relatorio_rodape_linha2: Optional[str] = None
    relatorio_telefone: Optional[str] = None
    relatorio_email: Optional[str] = None
    relatorio_site: Optional[str] = None

    @field_validator("relatorio_telefone")
    @classmethod
    def validar_relatorio_telefone(cls, valor: Optional[str]):
        return normalizar_telefone(valor)

    @field_validator("relatorio_email")
    @classmethod
    def validar_relatorio_email(cls, valor: Optional[str]):
        return normalizar_email(valor)


class IdentidadeRelatorioUpdate(IdentidadeRelatorioBase):
    pass


class IdentidadeRelatorioResponse(IdentidadeRelatorioBase):
    relatorio_logo_url: Optional[str] = None


class GestaoGlobalProjetoResumo(BaseModel):
    id: str
    nome: str
    tipo_projeto: Optional[str] = "Projeto"
    is_active: bool = True
    status_assinatura: Optional[str] = "Ativa"
    bloqueado: Optional[bool] = False
    conviventes_total: int = 0
    conviventes_ativos: int = 0
    saidas_qualificadas: int = 0
    saidas_qualificadas_periodo: int = 0
    inativacoes_periodo: int = 0
    taxa_sucesso_periodo: float = 0
    usuarios_ativos: int = 0
    quartos_ativos: int = 0
    leitos_total: int = 0
    leitos_ocupados: int = 0
    ocupacao_percentual: float = 0
    rotina_registros: int = 0
    rotina_cancelados: int = 0
    ocorrencias_total: int = 0
    ocorrencias_pendentes: int = 0
    ocorrencias_alta_critica: int = 0
    avisos_ativos: int = 0
    sisa_lancamentos: int = 0
    sisa_divergencias_pendentes: int = 0


class GestaoGlobalTotais(BaseModel):
    projetos: int = 0
    conviventes_total: int = 0
    conviventes_ativos: int = 0
    saidas_qualificadas: int = 0
    saidas_qualificadas_periodo: int = 0
    inativacoes_periodo: int = 0
    taxa_sucesso_periodo: float = 0
    usuarios_ativos: int = 0
    leitos_total: int = 0
    leitos_ocupados: int = 0
    ocupacao_percentual: float = 0
    rotina_registros: int = 0
    ocorrencias_total: int = 0
    ocorrencias_pendentes: int = 0
    ocorrencias_alta_critica: int = 0
    avisos_ativos: int = 0
    sisa_lancamentos: int = 0
    sisa_divergencias_pendentes: int = 0


class GestaoGlobalResumoResponse(BaseModel):
    organizacao_id: str
    organizacao_nome: Optional[str] = None
    projeto_atual_id: Optional[str] = None
    projeto_atual_nome: Optional[str] = None
    periodo_inicio: Optional[date] = None
    periodo_fim: Optional[date] = None
    totais: GestaoGlobalTotais
    projetos: List[GestaoGlobalProjetoResumo]


# --- USUÁRIO / RBAC / EQUIPE INSTITUCIONAL ---

PERFIS_ACESSO_VALIDOS = {
    "Gestor",
    "Global",
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


def normalizar_cnpj(valor: Optional[str]) -> Optional[str]:
    if valor is None:
        return None

    cnpj = re.sub(r"\D", "", valor)

    if not cnpj:
        return None

    if len(cnpj) != 14:
        raise ValueError("CNPJ deve conter 14 dígitos.")

    if cnpj == cnpj[0] * 14:
        raise ValueError("CNPJ inválido.")

    def calcular_digito(base: str) -> str:
        pesos = (
            [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
            if len(base) == 12
            else [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        )
        soma = sum(int(digito) * peso for digito, peso in zip(base, pesos))
        resto = soma % 11
        return "0" if resto < 2 else str(11 - resto)

    digito_1 = calcular_digito(cnpj[:12])
    digito_2 = calcular_digito(cnpj[:12] + digito_1)

    if cnpj[-2:] != f"{digito_1}{digito_2}":
        raise ValueError("CNPJ inválido.")

    return cnpj


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


STATUS_CONVIVENTE_VALIDOS = {
    "Ativo",
    "Inativado",
    "Bloqueado",
    "Saída qualificada",
    "Ausência justificada",
}

MAPEAMENTO_STATUS_CONVIVENTE = {
    "ativo": "Ativo",
    "inativado": "Inativado",
    "bloqueado": "Bloqueado",
    "saida qualificada": "Saída qualificada",
    "saída qualificada": "Saída qualificada",
    "ausencia justificada": "Ausência justificada",
    "ausência justificada": "Ausência justificada",
}


def normalizar_status_convivente(valor: Optional[str]) -> str:
    if valor is None:
        return "Ativo"

    status = valor.strip()
    if not status:
        return "Ativo"

    status = MAPEAMENTO_STATUS_CONVIVENTE.get(status.lower(), status)
    if status not in STATUS_CONVIVENTE_VALIDOS:
        raise ValueError(
            "Status do convivente inválido. "
            "Use: Ativo, Inativado, Bloqueado, Saída qualificada ou Ausência justificada."
        )

    return status


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
            "Use: Gestor, Global, Técnico, Orientador, Administrativo ou Consulta."
        )

    return perfil


class UsuarioBase(BaseModel):
    nome: str
    email: str
    perfil_acesso: str = "Consulta"
    is_global: bool = False

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
    is_global: Optional[bool] = None

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
    data_desligamento: Optional[date] = None
    motivo_desligamento: Optional[str] = None

    @model_validator(mode="after")
    def validar_motivo_ao_inativar(self):
        if self.ativo is False:
            motivo = (self.motivo_desligamento or "").strip()

            if not motivo:
                raise ValueError("Informe o motivo do desligamento para inativar o usuário.")

            self.motivo_desligamento = motivo

        return self


class UsuarioResponse(UsuarioBase):
    id: str
    instituicao_id: str
    organizacao_id: Optional[str] = None
    is_master: bool
    is_global: bool = False
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
    is_global: bool = False
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
    organizacao: Optional[OrganizacaoCreate] = None
    projeto: Optional[InstituicaoCreate] = None
    projeto_unico: bool = True
    # Compatibilidade com payload antigo.
    instituicao: Optional[InstituicaoCreate] = None
    usuario_master: UsuarioCreate

    @model_validator(mode="after")
    def validar_organizacao_e_projeto(self):
        if self.organizacao is None and self.instituicao is None:
            raise ValueError("Informe os dados da organização.")

        if self.projeto is None and self.instituicao is None:
            raise ValueError("Informe os dados do projeto.")

        return self


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


class LeitoAlocacaoPayload(BaseModel):
    convivente_id: str


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
    sensivel: bool = False
    data_upload: datetime

    model_config = ConfigDict(from_attributes=True)


# --- PIA (Plano Individual de Atendimento) ---

class RegistroPIABase(BaseModel):
    tipo_registro: str = "Evolução"
    titulo: str
    subtitulo: Optional[str] = None
    descricao: str
    objetivos: Optional[str] = None
    encaminhamentos: Optional[str] = None
    status: str = "Em acompanhamento"


class RegistroPIACreate(RegistroPIABase):
    registro_pai_id: Optional[str] = None


class RegistroPIAResponse(RegistroPIABase):
    id: str
    instituicao_id: str
    convivente_id: str
    usuario_id: str
    registro_pai_id: Optional[str] = None
    usuario_nome: Optional[str] = None
    data_registro: datetime

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
    convivente_autor_ocorrencia: bool = False
    funcionario_envolvido_id: Optional[str] = None
    assinatura_convivente_metodo: Optional[str] = None
    assinatura_convivente_codigo: Optional[str] = None


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
    convivente_autor_ocorrencia: bool = False
    funcionario_envolvido_id: Optional[str] = None
    assinatura_convivente_metodo: Optional[str] = None
    assinatura_convivente_codigo: Optional[str] = None
    assinatura_convivente_validada_em: Optional[datetime] = None

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
    ausencia_justificada_desde: Optional[date] = None
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
    tem_mandado_prisao: bool = False

    medidas_protetivas: Optional[str] = None
    acompanhamento_caps: Optional[str] = None
    uso_substancias: Optional[str] = None
    transtorno_mental: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validar_status(cls, valor: Optional[str]):
        return normalizar_status_convivente(valor)

    @field_validator(
        "possui_renda",
        "egresso_prisional",
        "usa_tornozeleira",
        "tem_mandado_prisao",
        mode="before",
    )
    @classmethod
    def normalizar_booleanos_legados(cls, valor):
        return False if valor is None else valor


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


class AusenciaJustificadaPendenteResponse(BaseModel):
    convivente_id: str
    nome: str
    prontuario: Optional[int] = None
    tecnico_id: Optional[str] = None
    tecnico_nome: Optional[str] = None
    ausencia_justificada_desde: Optional[date] = None
    dias_em_ausencia: int = 0


class AusenciaJustificadaResposta(BaseModel):
    continua_ausente: bool
    status_atribuido: Optional[str] = None
    justificativa: Optional[str] = None

    @field_validator("status_atribuido")
    @classmethod
    def validar_status_atribuido(cls, valor: Optional[str]):
        if valor is None or not valor.strip():
            return None

        status = normalizar_status_convivente(valor)
        if status not in {"Ativo", "Inativado"}:
            raise ValueError("Quando a ausência não continuar, escolha Ativo ou Inativado.")
        return status


# --- HISTÓRICO MANUAL DO CONVIVENTE ---

class HistoricoConviventeCreate(BaseModel):
    origem_informacao: str
    data_origem: date
    descricao: str
    titulo: Optional[str] = None
    historico_legado_id: Optional[str] = None

    @field_validator("origem_informacao", "descricao")
    @classmethod
    def validar_texto_obrigatorio(cls, valor: str):
        valor = (valor or "").strip()
        if not valor:
            raise ValueError("Campo obrigatório.")
        return valor


class HistoricoConviventeUpdate(BaseModel):
    origem_informacao: str
    data_origem: date
    descricao: str
    titulo: Optional[str] = None

    @field_validator("origem_informacao", "descricao")
    @classmethod
    def validar_texto_obrigatorio(cls, valor: str):
        valor = (valor or "").strip()
        if not valor:
            raise ValueError("Campo obrigatório.")
        return valor


class HistoricoConviventeResponse(BaseModel):
    id: str
    instituicao_id: str
    convivente_id: str
    usuario_id: str
    usuario_nome: Optional[str] = None
    historico_legado_id: Optional[str] = None

    origem_informacao: str
    data_origem: date
    titulo: Optional[str] = None
    descricao: str
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)


# =====================================================================
# ROTINA DIÁRIA
# =====================================================================

class RegistroRotinaBase(BaseModel):
    tipo_registro: str
    observacao: Optional[str] = None


class RegistroRotinaCreate(RegistroRotinaBase):
    convivente_id: str
    justificativa_retorno_rapido: Optional[str] = None


class RegistroRotinaResponse(RegistroRotinaBase):
    id: str

    instituicao_id: str
    convivente_id: str
    usuario_id: str

    data_registro: datetime
    observacao: Optional[str] = None

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
    observacao: Optional[str] = None
    motivo_edicao: str


class RegistroRotinaCancelamento(BaseModel):
    motivo_cancelamento: str


class RegistroRotinaDesfazerRapido(BaseModel):
    pass


# =====================================================================
# HISTÓRICO LEGADO SIAT
# =====================================================================

class HistoricoLegadoSIATResponse(BaseModel):
    id: str
    instituicao_id: Optional[str] = None

    origem_informacao: str
    arquivo_origem: str
    ano_origem: Optional[int] = None
    pagina_origem: Optional[int] = None
    sequencia_origem: Optional[int] = None

    data_original: Optional[date] = None
    data_original_texto: Optional[str] = None
    operador_origem: Optional[str] = None
    titulo_original: Optional[str] = None
    nome_identificado: Optional[str] = None

    tipo_sugerido: Optional[str] = "Não classificado"
    status_revisao: Optional[str] = "Pendente"
    texto_original: str
    observacoes_revisao: Optional[str] = None
    importado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class HistoricoLegadoSIATListResponse(BaseModel):
    items: List[HistoricoLegadoSIATResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    resumo: dict
    opcoes: dict


class HistoricoLegadoSIATUpdate(BaseModel):
    status_revisao: Optional[str] = None
    tipo_sugerido: Optional[str] = None
    observacoes_revisao: Optional[str] = None


class HistoricoLegadoRotinaSIATResponse(BaseModel):
    id: str
    instituicao_id: str
    convivente_id: Optional[str] = None

    origem_arquivo: str
    linha_origem: Optional[int] = None
    id_as_atendimento_serv_legado: str
    id_as_atendimento_legado: Optional[str] = None
    id_cr_clientes_legado: Optional[str] = None

    numero_sisa: Optional[str] = None
    numero_institucional_legado: Optional[str] = None
    nome_convivente: Optional[str] = None
    data_nascimento: Optional[date] = None
    nome_mae: Optional[str] = None

    data_servico: date
    servico_prestado: Optional[str] = None
    id_servico_prestado_legado: Optional[str] = None
    atividade: Optional[str] = None
    id_atividade_legado: Optional[str] = None

    quarto: Optional[str] = None
    cama: Optional[str] = None
    periodo_acolhimento: Optional[str] = None
    data_entrada: Optional[date] = None
    data_saida: Optional[date] = None
    motivo_saida: Optional[str] = None
    gestante: Optional[bool] = None
    gestante_com_pre_natal: Optional[bool] = None

    auditoria_datahora: Optional[datetime] = None
    usuario_origem: Optional[str] = None
    chave_natural_convivente: Optional[str] = None
    confianca_vinculo: Optional[str] = None
    identificado: Optional[bool] = False
    status_revisao: Optional[str] = "Pendente"
    observacoes: Optional[str] = None
    importado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class HistoricoLegadoRotinaSIATListResponse(BaseModel):
    items: List[HistoricoLegadoRotinaSIATResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    resumo: dict
    opcoes: dict


class HistoricoLegadoRotinaSIATUpdate(BaseModel):
    status_revisao: Optional[str] = None
    observacoes: Optional[str] = None


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


class SisaDivergenciaResponse(BaseModel):
    id: str
    importacao_id: str
    instituicao_id: str
    convivente_id: Optional[str] = None
    numero_sisa: str
    nome_convivente: str
    tipo: str
    prioridade: str
    status: str
    data_inicio: Optional[date] = None
    data_fim: date
    dias_sisa_anterior: Optional[int] = None
    dias_sisa_atual: int
    dias_sisa_delta: Optional[int] = None
    dias_carecore: int
    diferenca: Optional[int] = None
    dias_carecore_lista: Optional[str] = None
    resumo_carecore_json: Optional[str] = None
    mensagem: Optional[str] = None
    criado_em: datetime
    status_convivente: Optional[str] = None
    tem_desligamento: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


class SisaDivergenciaStatusUpdate(BaseModel):
    status: str


class SisaImportacaoResponse(BaseModel):
    id: str
    instituicao_id: str
    usuario_id: str
    nome_arquivo: str
    servico: Optional[str] = None
    data_referencia: date
    importado_em: datetime
    total_linhas: int
    total_vinculados: int
    total_nao_encontrados: int
    total_divergencias: int
    total_alertas_criticos: int

    model_config = ConfigDict(from_attributes=True)


class SisaImportacaoDetalheResponse(SisaImportacaoResponse):
    divergencias: List[SisaDivergenciaResponse] = []


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


class AvisoHistoricoListResponse(BaseModel):
    items: List[AvisoResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


class AvisoDashboardResponse(BaseModel):
    id: str
    remetente_id: str
    remetente_nome: Optional[str] = None
    remetente_avatar_url: Optional[str] = None

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


# =====================================================================
# CHAT INTERNO
# =====================================================================

class ChatUsuarioResponse(BaseModel):
    id: str
    nome: str
    email: str
    perfil_acesso: str
    avatar_url: Optional[str] = None
    cargo: Optional[str] = None
    setor: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ChatConversaCreate(BaseModel):
    participantes_ids: List[str]
    titulo: Optional[str] = None


class ChatMensagemCreate(BaseModel):
    conteudo: str

    @field_validator("conteudo")
    @classmethod
    def validar_conteudo(cls, valor: str):
        conteudo = (valor or "").strip()

        if not conteudo:
            raise ValueError("Digite uma mensagem.")

        if len(conteudo) > 4000:
            raise ValueError("Mensagem muito longa. Limite de 4000 caracteres.")

        return conteudo


class ChatMensagemResponse(BaseModel):
    id: str
    conversa_id: str
    remetente_id: str
    remetente_nome: Optional[str] = None
    conteudo: str
    criado_em: datetime
    enviada_por_mim: bool = False


class ChatConversaResponse(BaseModel):
    id: str
    tipo: str
    titulo: Optional[str] = None
    participantes: List[ChatUsuarioResponse] = []
    ultima_mensagem: Optional[ChatMensagemResponse] = None
    nao_lidas: int = 0
    atualizado_em: datetime


class ChatMensagensListResponse(BaseModel):
    items: List[ChatMensagemResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


class ChatResumoResponse(BaseModel):
    total_nao_lidas: int
    total_conversas: int

