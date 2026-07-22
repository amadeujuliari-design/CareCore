# =====================================================================
# ARQUIVO: schemas.py
# CARECORE+ - Schemas Pydantic
# =====================================================================

import json
import re
from datetime import date, datetime
from typing import Optional, List, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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
    emails_adicionais: Optional[str] = None

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

    @field_validator("emails_adicionais")
    @classmethod
    def validar_emails_adicionais(cls, valor: Optional[str]):
        return normalizar_emails_adicionais(valor)


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
    emails_adicionais: Optional[str] = None
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

    @field_validator("emails_adicionais")
    @classmethod
    def validar_emails_adicionais(cls, valor: Optional[str]):
        return normalizar_emails_adicionais(valor)


class InstituicaoCreate(InstituicaoBase):
    pass


class CadastroContatoUpdate(EnderecoBase):
    """Atualização de telefone, e-mail e endereço (organização ou projeto)."""

    telefone: Optional[str] = None
    email: Optional[str] = None
    emails_adicionais: Optional[str] = None

    @field_validator("telefone")
    @classmethod
    def validar_telefone(cls, valor: Optional[str]):
        return normalizar_telefone(valor)

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: Optional[str]):
        return normalizar_email(valor)

    @field_validator("emails_adicionais")
    @classmethod
    def validar_emails_adicionais(cls, valor: Optional[str]):
        return normalizar_emails_adicionais(valor)


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
    "Manutenção",
    "Técnico",
    "Orientador",
    "Administrativo",
    "Consulta",
    "Oficineiro(a)",
}

MAPEAMENTO_PERFIS_LEGADOS = {
    "Gestao": "Gestor",
    "Gestão": "Gestor",
    "Tecnico": "Técnico",
    "Manutencao": "Manutenção",
    "Manutenção": "Manutenção",
    "Oficineiro": "Oficineiro(a)",
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


def normalizar_emails_adicionais(valor: Optional[str]) -> Optional[str]:
    """Normaliza lista de e-mails separados por vírgula, ponto-e-vírgula ou quebra de linha."""
    if valor is None:
        return None

    texto = str(valor).strip()
    if not texto:
        return None

    emails: list[str] = []
    for pedaco in re.split(r"[,;\n]+", texto):
        candidato = pedaco.strip()
        if not candidato:
            continue
        email = normalizar_email(candidato)
        if email and email not in emails:
            emails.append(email)

    if not emails:
        return None

    return ", ".join(emails)


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
    "Em acolhimento",
    "Inativado",
    "Bloqueado",
    "Saída qualificada",
    "Ausência justificada",
}

MAPEAMENTO_STATUS_CONVIVENTE = {
    "ativo": "Ativo",
    "em acolhimento": "Em acolhimento",
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
            "Use: Ativo, Em acolhimento, Inativado, Bloqueado, Saída qualificada ou Ausência justificada."
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
            "Use: Gestor, Global, Manutenção, Técnico, Orientador, Administrativo, Consulta ou Oficineiro(a)."
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


class UsuarioSessaoResponse(BaseModel):
    id: str
    sub: Optional[str] = None
    usuario_id: Optional[str] = None
    nome: str
    email: str
    instituicao_id: Optional[str] = None
    organizacao_id: Optional[str] = None
    projeto_nome: Optional[str] = None
    perfil_acesso: str
    is_master: bool = False
    is_global: bool = False
    is_manutencao: bool = False
    ativo: bool = True
    avatar_url: Optional[str] = None
    token_version: Optional[int] = None

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
    usuario: UsuarioSessaoResponse


class PasskeyOptionsResponse(BaseModel):
    publicKey: dict
    challenge_token: str


class PasskeyRegistroVerifyPayload(BaseModel):
    credential: dict
    challenge_token: str
    nome_dispositivo: Optional[str] = None


class PasskeyLoginOptionsPayload(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str):
        email = normalizar_email(valor)

        if not email:
            raise ValueError("E-mail obrigatório.")

        return email


class PasskeyLoginVerifyPayload(PasskeyLoginOptionsPayload):
    credential: dict
    challenge_token: str


class PasskeyDispositivoResponse(BaseModel):
    id: str
    nome_dispositivo: Optional[str] = None
    criado_em: Optional[datetime] = None
    ultimo_uso_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

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
    rotativo: bool = False


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
    expectativas_servico: Optional[str] = None
    expectativas_vida_projetos: Optional[str] = None
    destino_siat_iii: bool = False
    destino_moradia_autonoma: bool = False
    destino_retorno_familiar: bool = False
    destino_explicacao: Optional[str] = None
    dificuldades_planos: Optional[str] = None

    @field_validator(
        "destino_siat_iii",
        "destino_moradia_autonoma",
        "destino_retorno_familiar",
        mode="before",
    )
    @classmethod
    def normalizar_destinos_pia(cls, valor):
        return False if valor is None else valor


class RegistroPIACreate(RegistroPIABase):
    registro_pai_id: Optional[str] = None


class RegistroPIAUpdate(RegistroPIABase):
    """Atualização de PIA principal ou evolução (não altera vínculo pai)."""


class RegistroPIAResponse(RegistroPIABase):
    id: str
    instituicao_id: str
    convivente_id: str
    usuario_id: str
    registro_pai_id: Optional[str] = None
    usuario_nome: Optional[str] = None
    data_registro: datetime
    origem_modulo: Optional[str] = None
    origem_registro_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AssinaturaFormularioPiaRegistrar(BaseModel):
    codigo_lido: str
    metodo_leitura: Optional[str] = None
    modo_formulario: Optional[str] = None


class AssinaturaFormularioPiaReimpressao(BaseModel):
    modo_formulario: Optional[str] = None


class AssinaturaFormularioPiaResponse(BaseModel):
    id: str
    convivente_id: str
    tipo_evento: str
    metodo_leitura: Optional[str] = None
    codigo_lido: str
    numero_prontuario: Optional[int] = None
    modo_formulario: Optional[str] = None
    assinado_em: datetime
    usuario_id: str
    usuario_nome: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AssinaturaFormularioPiaConsultaResponse(BaseModel):
    possui_assinatura: bool
    assinatura: Optional[AssinaturaFormularioPiaResponse] = None


class AssinaturaTermoBagageiroRegistrar(BaseModel):
    codigo_lido: str
    metodo_leitura: Optional[str] = None


class AssinaturaTermoBagageiroReimpressao(BaseModel):
    pass


class AssinaturaTermoBagageiroResponse(BaseModel):
    id: str
    convivente_id: str
    tipo_evento: str
    metodo_leitura: Optional[str] = None
    codigo_lido: Optional[str] = None
    numero_prontuario: Optional[int] = None
    assinado_em: Optional[datetime] = None
    usuario_id: str
    usuario_nome: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AssinaturaTermoBagageiroConsultaResponse(BaseModel):
    possui_assinatura: bool
    assinatura: Optional[AssinaturaTermoBagageiroResponse] = None
    termo_aceito: bool = False
    exige_termo_primeiro_bagageiro: bool = False
    possui_movimentacao_bagageiro: bool = False
    documento_ged: Optional[DocumentoResponse] = None


# --- OCORRÊNCIAS ---

class InteracaoOcorrenciaBase(BaseModel):
    mensagem: str
    tipo_interacao: str = "Comentário"
    mensagem_original: Optional[str] = None


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


class FuncionarioEnvolvidoOcorrenciaResponse(BaseModel):
    id: str
    usuario_id: str
    data_marcacao: datetime

    model_config = ConfigDict(from_attributes=True)


class OcorrenciaBase(BaseModel):
    tipo_ocorrencia: str
    motivo: str
    descricao: str
    motivo_original: Optional[str] = None
    descricao_original: Optional[str] = None
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
    funcionarios_envolvidos_ids: List[str] = []


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
    motivo_original: Optional[str] = None
    descricao_original: Optional[str] = None

    interacoes: List[InteracaoOcorrenciaResponse] = []
    observadores: List[ObservadorOcorrenciaResponse] = []
    funcionarios_envolvidos: List[FuncionarioEnvolvidoOcorrenciaResponse] = []

    model_config = ConfigDict(from_attributes=True)


class OcorrenciaConviventeListaResponse(BaseModel):
    registros: List[OcorrenciaResponse]
    total: int
    limite: int
    deslocamento: int


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

class FamiliarConviventeItem(BaseModel):
    id: Optional[str] = None
    parentesco: str
    parentesco_outros: Optional[str] = None
    nome: Optional[str] = None
    idade: Optional[int] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    endereco: Optional[str] = None
    telefone: Optional[str] = None


class DocumentoCivilItem(BaseModel):
    id: Optional[str] = None
    tipo: str
    tipo_outros: Optional[str] = None
    numero: Optional[str] = None
    orientacoes: Optional[str] = None


class SubstanciaItem(BaseModel):
    id: Optional[str] = None
    tipo: str
    desde_quando: Optional[str] = None
    quantidade: Optional[str] = None


class MedicamentoItem(BaseModel):
    id: Optional[str] = None
    nome: str
    tempo_uso: Optional[str] = None
    modo_uso: Optional[str] = None


class InternacaoItem(BaseModel):
    id: Optional[str] = None
    onde: Optional[str] = None
    periodo: Optional[str] = None
    quem_encaminhou: Optional[str] = None


class EquipamentoAnteriorItem(BaseModel):
    id: Optional[str] = None
    origem_encaminhamento_id: Optional[str] = None
    descricao_outros: Optional[str] = None


class ConviventeBase(BaseModel):
    status: str = "Ativo"

    data_entrada: Optional[date] = None
    data_inclusao: Optional[date] = None
    data_inativacao: Optional[date] = None
    data_nova_vinculacao: Optional[date] = None
    prontuario_saude: Optional[str] = None
    preferencial: bool = False
    observacao_operacional: Optional[str] = None
    leito_provisorio_desde: Optional[datetime] = None
    ausencia_justificada_desde: Optional[date] = None
    leito_id: Optional[str] = None
    leito_reservado_id: Optional[str] = None
    reservar_leito_fixo: bool = False
    tb_remanejamento_situacao: Optional[str] = None
    tecnico_id: Optional[str] = None

    motivo_inativacao_id: Optional[str] = None
    origem_encaminhamento_id: Optional[str] = None
    origem_encaminhamento_outros: Optional[str] = None

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

    cor_raca: Optional[str] = None
    possui_religiao: bool = False
    religiao_qual: Optional[str] = None
    relacao_familiar_situacao: Optional[str] = None
    relacao_familiar_outra: Optional[str] = None

    data_inicio_pia: Optional[date] = None
    em_sao_paulo_desde: Optional[date] = None

    alfabetizado: Optional[bool] = None
    ef_concluido: Optional[bool] = None
    ef_incompleto: Optional[bool] = None
    ef_incompleto_serie: Optional[str] = None
    em_concluido: Optional[bool] = None
    em_incompleto: Optional[bool] = None
    em_incompleto_serie: Optional[str] = None
    es_concluido: Optional[bool] = None
    es_incompleto: Optional[bool] = None
    es_incompleto_periodo: Optional[str] = None
    estuda_atualmente: Optional[bool] = None
    estuda_curso: Optional[str] = None
    interesse_eja: Optional[bool] = None

    profissao: Optional[str] = None
    situacoes_trabalho: Optional[List[str]] = None
    trabalho_nao_remunerada_qual: Optional[str] = None
    trabalho_cursos_participou: Optional[bool] = None
    trabalho_cursos_quais: Optional[str] = None
    trabalho_certificados: Optional[bool] = None
    trabalho_certificados_quais: Optional[str] = None
    trabalho_pretende_curso: Optional[bool] = None
    trabalho_pretende_curso_quais: Optional[str] = None
    beneficios_pia: Optional[dict] = None

    rua_desde: Optional[str] = None
    rua_relato: Optional[str] = None

    saude_hist_familia: Optional[bool] = None
    saude_hist_familia_qual: Optional[str] = None
    saude_problema: Optional[bool] = None
    saude_problema_qual: Optional[str] = None
    saude_laudo: Optional[bool] = None
    saude_cid: Optional[str] = None
    saude_outro_equipamento: Optional[bool] = None
    saude_outro_equipamento_onde: Optional[str] = None

    pendencia_judiciaria: Optional[bool] = None
    pendencia_judiciaria_qual: Optional[str] = None
    pendencia_eleitoral: Optional[bool] = None
    pendencia_eleitoral_qual: Optional[str] = None
    egresso_artigo_motivo: Optional[str] = None
    egresso_ano: Optional[str] = None

    portaria_excecao_motivo: Optional[str] = None
    portaria_excecao_saida_ate: Optional[str] = None
    portaria_excecao_entrada_ate: Optional[str] = None
    impressoes_carteirinha_oficiais: int = 0

    familiares: Optional[List[FamiliarConviventeItem]] = None
    documentos_civis: Optional[List[DocumentoCivilItem]] = None
    substancias: Optional[List[SubstanciaItem]] = None
    medicamentos: Optional[List[MedicamentoItem]] = None
    internacoes: Optional[List[InternacaoItem]] = None
    equipamentos_anteriores: Optional[List[EquipamentoAnteriorItem]] = None

    @field_validator("beneficios_pia", mode="before")
    @classmethod
    def parse_beneficios_pia(cls, valor):
        if not valor:
            return {}
        if isinstance(valor, dict):
            return valor
        if isinstance(valor, str):
            try:
                parsed = json.loads(valor)
                return parsed if isinstance(parsed, dict) else {}
            except (TypeError, json.JSONDecodeError):
                return {}
        return {}

    @field_validator("situacoes_trabalho", mode="before")
    @classmethod
    def parse_situacoes_trabalho(cls, valor):
        if not valor:
            return []
        if isinstance(valor, list):
            return valor
        if isinstance(valor, str):
            try:
                parsed = json.loads(valor)
                return parsed if isinstance(parsed, list) else []
            except (TypeError, json.JSONDecodeError):
                return []
        return []

    @field_validator("status")
    @classmethod
    def validar_status(cls, valor: Optional[str]):
        return normalizar_status_convivente(valor)

    @field_validator("tb_remanejamento_situacao", mode="before")
    @classmethod
    def normalizar_tb_remanejamento(cls, valor):
        if valor is None or str(valor).strip() == "":
            return None
        texto = str(valor).strip()
        if texto not in {"Suspeita", "Confirmado"}:
            raise ValueError("Situação TB deve ser Suspeita ou Confirmado.")
        return texto

    @field_validator(
        "possui_renda",
        "egresso_prisional",
        "usa_tornozeleira",
        "tem_mandado_prisao",
        "possui_religiao",
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
    data_primeira_interacao: Optional[date] = None
    inativacoes_anteriores: List[date] = []

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


class HistoricoConviventeListaResponse(BaseModel):
    registros: List[HistoricoConviventeResponse]
    total: int
    limite: int
    deslocamento: int


class RegistroPIAListaResponse(BaseModel):
    registros: List[RegistroPIAResponse]
    total: int
    limite: int
    deslocamento: int
    has_more: bool


class DocumentoListaResponse(BaseModel):
    registros: List[DocumentoResponse]
    total: int
    limite: int
    deslocamento: int
    has_more: bool


class RotinaHistoricoResumoPeriodo(BaseModel):
    total: int = 0
    entradas: int = 0
    saidas: int = 0
    editados: int = 0
    cancelados: int = 0
    retornos_rapidos: int = 0
    contagens_por_tipo: dict[str, int] = Field(default_factory=dict)
    tem_ajuste_manual: bool = False
    total_complemento_ajuste: int = 0
    total_registrado: Optional[int] = None
    entradas_registradas: Optional[int] = None
    saidas_registradas: Optional[int] = None
    ajustes_por_tipo: dict[str, int] = Field(default_factory=dict)


class RotinaHistoricoListaResponse(BaseModel):
    registros: List[dict]
    total: int
    limite: int
    deslocamento: int
    has_more: bool
    resumo_periodo: Optional[RotinaHistoricoResumoPeriodo] = None


class RelatorioPiaListaResponse(BaseModel):
    registros: List[dict]
    total: int
    limite: int
    deslocamento: int
    has_more: bool


class RelatorioPresencaPeriodoLinha(BaseModel):
    convivente_id: str
    nome: str
    prontuario: Optional[str] = None
    numero_sisa: Optional[str] = None
    status: str
    tecnico_id: Optional[str] = None
    tecnico_nome: Optional[str] = None
    dias: dict[str, str]
    totais: dict[str, int]


class RelatorioPresencaPeriodoResponse(BaseModel):
    data_inicio: str
    data_fim: str
    dias: List[str]
    total_conviventes: int
    filtro_situacao: str
    status_filtro: List[str]
    resumo: dict[str, int]
    linhas: List[RelatorioPresencaPeriodoLinha]


class RelatorioCadastrosNovosLinha(BaseModel):
    convivente_id: str
    nome: str
    nome_mae: Optional[str] = None
    prontuario_saude: Optional[str] = None
    prontuario_institucional: Optional[str] = None
    data_inclusao: Optional[str] = None
    data_nova_vinculacao: Optional[str] = None
    status: str


class RelatorioCadastrosNovosResponse(BaseModel):
    data_inicio: str
    data_fim: str
    criterio: str
    status_filtro: List[str] = Field(default_factory=list)
    total_cadastros: int
    linhas: List[RelatorioCadastrosNovosLinha]


# =====================================================================
# ROTINA DIÁRIA
# =====================================================================

class RegistroRotinaBase(BaseModel):
    tipo_registro: str
    observacao: Optional[str] = None


class RegistroRotinaCreate(RegistroRotinaBase):
    convivente_id: str
    justificativa_retorno_rapido: Optional[str] = None
    justificativa_horario_portaria: Optional[str] = None
    confirmar_refeicao_extra: bool = False


class RegistroRotinaResponse(RegistroRotinaBase):
    id: str

    instituicao_id: str
    convivente_id: str
    usuario_id: str

    data_registro: datetime
    observacao: Optional[str] = None

    retorno_rapido: Optional[bool] = False
    justificativa_retorno_rapido: Optional[str] = None
    justificativa_horario_portaria: Optional[str] = None
    repeticao_extra_refeicao: Optional[int] = None

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


class RotinaAjusteDiarioItemInput(BaseModel):
    tipo_registro: str
    quantidade_ajuste: int = 0


class RotinaAjusteDiarioSalvarRequest(BaseModel):
    data_referencia: date
    justificativa: str
    ajustes: list[RotinaAjusteDiarioItemInput] = []


class RotinaAjusteDiarioItemResponse(BaseModel):
    tipo_registro: str
    registrados: int
    ajuste_manual: int
    total_exibido: int
    ajuste_id: Optional[str] = None


class RotinaAjusteDiarioPainelResponse(BaseModel):
    data_referencia: date
    bloqueado: bool = False
    motivo_bloqueio: Optional[str] = None
    justificativa_existente: Optional[str] = None
    tem_ajuste_manual: bool = False
    itens: list[RotinaAjusteDiarioItemResponse] = []


class RegistroRotinaDesfazerRapido(BaseModel):
    pass


class LavanderiaRegistroCreate(BaseModel):
    convivente_id: str
    quantidade_entregue: int
    observacao_entrega: Optional[str] = None

    @field_validator("quantidade_entregue")
    @classmethod
    def validar_quantidade_entregue(cls, valor: int):
        if valor <= 0:
            raise ValueError("Informe uma quantidade de peças maior que zero.")
        return valor


class LavanderiaRetirada(BaseModel):
    quantidade_retirada: int
    observacao_retirada: Optional[str] = None
    encerrar_pendencia: bool = False
    motivo_baixa: Optional[str] = None

    @field_validator("quantidade_retirada")
    @classmethod
    def validar_quantidade_retirada(cls, valor: int):
        if valor < 0:
            raise ValueError("Informe uma quantidade retirada igual ou maior que zero.")
        return valor


class LavanderiaCancelamento(BaseModel):
    motivo_cancelamento: str


class LavanderiaRegistroResponse(BaseModel):
    id: str
    instituicao_id: str
    convivente_id: str
    convivente_nome: Optional[str] = None
    prontuario: Optional[int] = None
    usuario_entrega_nome: Optional[str] = None
    usuario_retirada_nome: Optional[str] = None
    quantidade_entregue: int
    quantidade_retirada: Optional[int] = None
    entregue_em: datetime
    prazo_retirada_em: datetime
    retirado_em: Optional[datetime] = None
    observacao_entrega: Optional[str] = None
    observacao_retirada: Optional[str] = None
    status: str
    atrasado: bool = False
    horas_restantes: Optional[float] = None


class PertenceRecolhidoCreate(BaseModel):
    quarto_id: str
    quantidade_recolhida: int
    observacao: Optional[str] = None

    @field_validator("quantidade_recolhida")
    @classmethod
    def validar_quantidade_recolhida(cls, valor: int):
        if valor <= 0:
            raise ValueError("Informe uma quantidade recolhida maior que zero.")
        return valor


class PertenceRecolhidoRetirada(BaseModel):
    convivente_id: str
    quantidade: int
    justificativa: Optional[str] = None

    @field_validator("quantidade")
    @classmethod
    def validar_quantidade_retirada_pertence(cls, valor: int):
        if valor <= 0:
            raise ValueError("Informe uma quantidade retirada maior que zero.")
        return valor


class PertenceRecolhidoBaixaAdministrativa(BaseModel):
    quantidade: int
    justificativa: str
    destino: str

    @field_validator("quantidade")
    @classmethod
    def validar_quantidade_baixa(cls, valor: int):
        if valor <= 0:
            raise ValueError("Informe uma quantidade para baixa maior que zero.")
        return valor


class PertenceRecolhidoBaixaAdministrativaLote(BaseModel):
    registro_ids: List[str]
    justificativa: str
    destino: str

    @field_validator("registro_ids")
    @classmethod
    def validar_registro_ids(cls, valor: List[str]):
        ids = [str(item or "").strip() for item in (valor or []) if str(item or "").strip()]
        if not ids:
            raise ValueError("Selecione ao menos uma recolha para baixa administrativa em lote.")
        if len(ids) > 100:
            raise ValueError("Limite de 100 recolhas por lote.")
        # remove duplicados preservando ordem
        vistos = set()
        unicos = []
        for item in ids:
            if item in vistos:
                continue
            vistos.add(item)
            unicos.append(item)
        return unicos


class PertenceRecolhidoBaixaResponse(BaseModel):
    id: str
    pertence_recolhido_id: str
    convivente_id: Optional[str] = None
    convivente_nome: Optional[str] = None
    usuario_nome: Optional[str] = None
    quantidade: int
    tipo_baixa: str
    justificativa: Optional[str] = None
    destino: Optional[str] = None
    baixado_em: datetime


class PertenceRecolhidoResponse(BaseModel):
    id: str
    instituicao_id: str
    quarto_id: str
    quarto_nome: Optional[str] = None
    usuario_recolha_nome: Optional[str] = None
    quantidade_recolhida: int
    quantidade_disponivel: int
    recolhido_em: datetime
    observacao: Optional[str] = None
    status: str
    encerrado_em: Optional[datetime] = None
    justificativa_encerramento: Optional[str] = None
    destino_encerramento: Optional[str] = None
    baixas: List[PertenceRecolhidoBaixaResponse] = []


class PertenceRecolhidoBaixaAdministrativaLoteResponse(BaseModel):
    processados: int
    itens_baixados: int
    justificativa: str
    destino: str
    registros: List[PertenceRecolhidoResponse] = []


class LavanderiaResumoFila(BaseModel):
    pendentes: int
    atrasados: int
    pecas_em_aberto: int


class LavanderiaListaResponse(BaseModel):
    items: List[LavanderiaRegistroResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    resumo_fila: Optional[LavanderiaResumoFila] = None


class PertenceRecolhidoResumoFila(BaseModel):
    abertos: int
    itens_disponiveis: int
    itens_recolhidos: int


class PertenceRecolhidoListaResponse(BaseModel):
    items: List[PertenceRecolhidoResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    resumo_fila: Optional[PertenceRecolhidoResumoFila] = None


class CarteirinhaImpressaoOficialCreate(BaseModel):
    quantidade: int = Field(default=1, ge=1, le=20)
    origem: str = Field(default="unitaria")

    @field_validator("origem")
    @classmethod
    def validar_origem(cls, valor: str) -> str:
        origem = str(valor or "unitaria").strip().lower()
        if origem not in {"unitaria", "lote"}:
            raise ValueError("Origem de impressão inválida.")
        return origem


class CarteirinhaImpressaoOficialResponse(BaseModel):
    convivente_id: str
    impressoes_carteirinha_oficiais: int
    log_id: str
    quantidade: int
    origem: str
    impresso_em: datetime


class CarteirinhaImpressaoResumoPeriodo(BaseModel):
    total_eventos: int
    total_carteirinhas: int
    conviventes_distintos: int


class CarteirinhaImpressaoLogItem(BaseModel):
    id: str
    convivente_id: str
    convivente_nome: str
    numero_institucional: Optional[str] = None
    usuario_id: str
    usuario_nome: Optional[str] = None
    quantidade: int
    origem: str
    impresso_em: datetime
    total_acumulado_convivente: int = 0


class CarteirinhaImpressaoLogListaResponse(BaseModel):
    items: List[CarteirinhaImpressaoLogItem]
    total: int
    limit: int
    offset: int
    has_more: bool
    resumo: CarteirinhaImpressaoResumoPeriodo


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


class RelatorioPresencaLegadoLinha(BaseModel):
    pessoa_legado_id: str
    convivente_id: Optional[str] = None
    nome: str
    numero_sisa: Optional[str] = None
    prontuario: Optional[str] = None
    origem_arquivo: Optional[str] = None
    dias: dict[str, str]
    totais: dict[str, int]


class RelatorioPresencaLegadoResponse(BaseModel):
    data_inicio: str
    data_fim: str
    dias: List[str]
    total_pessoas: int
    resumo: dict[str, int]
    linhas: List[RelatorioPresencaLegadoLinha]


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


class FechamentoMensalListaResponse(BaseModel):
    items: List[FechamentoMensalResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


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


class SisaImportacaoListaResponse(BaseModel):
    items: List[SisaImportacaoResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


class SisaImportacaoDetalheResponse(SisaImportacaoResponse):
    divergencias: List[SisaDivergenciaResponse] = []


class SisaDivergenciaResumoLista(BaseModel):
    pendencias: int
    alertas_criticos: int
    dias_perdidos_filtrados: int


class SisaDivergenciaListaResponse(BaseModel):
    items: List[SisaDivergenciaResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    resumo: SisaDivergenciaResumoLista


class SisaPreviaConviventeLinha(BaseModel):
    numero_sisa: str
    nome: str
    nome_social: Optional[str] = None
    data_nascimento: Optional[date] = None
    data_vinculacao: Optional[date] = None
    data_desligamento: Optional[date] = None
    dias_permanencia: int = 0
    status_sugerido: Optional[str] = None
    convivente_id: Optional[str] = None
    convivente_nome: Optional[str] = None
    motivo: Optional[str] = None


class SisaPreviaImportacaoResponse(BaseModel):
    nome_arquivo: str
    servico: Optional[str] = None
    data_inicio_referencia: date
    data_referencia: date
    total_linhas: int
    vinculados: int
    criar_ativos: List[SisaPreviaConviventeLinha] = []
    criar_inativos: List[SisaPreviaConviventeLinha] = []
    possiveis_duplicidades: List[SisaPreviaConviventeLinha] = []
    inativar_existentes: List[SisaPreviaConviventeLinha] = []
    reativar_existentes: List[SisaPreviaConviventeLinha] = []


class SisaAcoesImportacao(BaseModel):
    criar_ativos: List[str] = []
    criar_inativos: List[str] = []
    inativar_existentes: List[str] = []
    mesclar_duplicidades: List[str] = []
    reativar_existentes: List[str] = []


# =====================================================================
# COMUNICAÇÃO INTERNA / AVISOS IMPORTANTES
# =====================================================================

class AvisoDestinatarioCreate(BaseModel):
    usuario_id: str


class AvisoCreate(BaseModel):
    titulo: str
    mensagem: str
    titulo_original: Optional[str] = None
    mensagem_original: Optional[str] = None
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
    titulo_original: Optional[str] = None
    mensagem_original: Optional[str] = None
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
    remetente_perfil_acesso: Optional[str] = None

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
    titulo_original: Optional[str] = None
    mensagem_original: Optional[str] = None


class AvisoMeListResponse(BaseModel):
    items: List[AvisoDashboardResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


class AvisosResumoResponse(BaseModel):
    total_visiveis: int
    total_nao_lidos: int
    total_alertas_ativos: int


class TextoRevisarRequest(BaseModel):
    titulo: Optional[str] = None
    texto: str = ""
    convivente_id: Optional[str] = None
    contexto: Optional[str] = None


class TextoRevisarResponse(BaseModel):
    titulo: str
    texto: str
    titulo_original: str
    texto_original: str
    usado_mes: int
    limite_mensal: Optional[int] = None


class TextoRevisaoStatusResponse(BaseModel):
    configurado: bool
    disponivel: bool
    limite_mensal: int
    usado_mes: int
    ano: int
    mes: int


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


# =====================================================================
# SUPORTE / CHAMADOS
# =====================================================================

class SuporteChamadoCreate(BaseModel):
    modulo: str
    tela: str
    tipo_problema: str
    caminho_sistema: str
    assunto: str
    relato: str
    prioridade: str = "normal"
    url_origem: Optional[str] = None

    @field_validator("modulo", "tela", "tipo_problema", "caminho_sistema", "assunto", "relato")
    @classmethod
    def validar_texto_obrigatorio(cls, valor: str):
        texto = (valor or "").strip()
        if not texto:
            raise ValueError("Campo obrigatório.")
        return texto

    @field_validator("assunto")
    @classmethod
    def validar_assunto(cls, valor: str):
        texto = valor.strip()
        if len(texto) > 160:
            raise ValueError("Assunto muito longo. Limite de 160 caracteres.")
        return texto

    @field_validator("relato")
    @classmethod
    def validar_relato(cls, valor: str):
        texto = valor.strip()
        if len(texto) < 10:
            raise ValueError("Descreva o problema com um pouco mais de detalhe.")
        if len(texto) > 6000:
            raise ValueError("Relato muito longo. Limite de 6000 caracteres.")
        return texto

    @field_validator("prioridade")
    @classmethod
    def validar_prioridade(cls, valor: str):
        prioridade = (valor or "normal").strip().lower()
        if prioridade not in {"baixa", "normal", "media", "média", "alta", "critica", "crítica"}:
            raise ValueError("Prioridade inválida.")
        return "critica" if prioridade == "crítica" else "media" if prioridade == "média" else prioridade


class SuporteChamadoMensagemCreate(BaseModel):
    mensagem: str

    @field_validator("mensagem")
    @classmethod
    def validar_mensagem(cls, valor: str):
        texto = (valor or "").strip()
        if not texto:
            raise ValueError("Digite uma resposta.")
        if len(texto) > 6000:
            raise ValueError("Mensagem muito longa. Limite de 6000 caracteres.")
        return texto


class SuporteChamadoStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validar_status(cls, valor: str):
        status = (valor or "").strip()
        permitidos = {
            "Aberto",
            "Em análise",
            "Aguardando usuário",
            "Em desenvolvimento",
            "Resolvido",
            "Cancelado",
        }
        if status not in permitidos:
            raise ValueError("Status inválido.")
        return status


class SuporteChamadoMensagemResponse(BaseModel):
    id: str
    chamado_id: str
    usuario_id: Optional[str] = None
    autor_nome: str
    autor_tipo: str
    mensagem: str
    publico: bool = True
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)


class SuporteChamadoResponse(BaseModel):
    id: str
    numero_ticket: str
    instituicao_id: str
    organizacao_id: Optional[str] = None
    usuario_id: str
    usuario_nome: Optional[str] = None
    usuario_email: Optional[str] = None
    modulo: str
    tela: str
    tipo_problema: str
    caminho_sistema: str
    url_origem: Optional[str] = None
    prioridade: str
    status: str
    assunto: str
    relato: str
    email_notificacao_enviado: bool = False
    criado_em: datetime
    atualizado_em: Optional[datetime] = None
    resolvido_em: Optional[datetime] = None
    mensagens: List[SuporteChamadoMensagemResponse] = []

    model_config = ConfigDict(from_attributes=True)


class SuporteChamadosListResponse(BaseModel):
    items: List[SuporteChamadoResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


from tipos_acao_acompanhamento import (
    DESTINOS_TRANSFERENCIA_VALIDOS,
)

SITUACOES_TB = [
    "Suspeita",
    "Confirmado",
    "Em tratamento",
    "Alta",
]


class AcompanhamentoTransferenciaCreate(BaseModel):
    convivente_id: str
    destino: str
    destino_outro: Optional[str] = None
    data_discussao: Optional[date] = None
    data_visita: Optional[date] = None
    data_transferencia: Optional[date] = None
    observacoes: Optional[str] = None
    inativar_convivente: bool = False
    marcar_ausencia_justificada: bool = False

    @field_validator("destino")
    @classmethod
    def validar_destino(cls, valor: str):
        if valor not in DESTINOS_TRANSFERENCIA_VALIDOS:
            raise ValueError("Tipo de ação inválido.")
        return valor

    @model_validator(mode="after")
    def validar_destino_outro(self):
        if self.destino == "Outros":
            texto = (self.destino_outro or "").strip()
            if len(texto) < 2:
                raise ValueError("Informe o destino quando selecionar Outros.")
            self.destino_outro = texto
        elif self.destino_outro:
            self.destino_outro = None
        return self


class AcompanhamentoTransferenciaUpdate(BaseModel):
    destino: Optional[str] = None
    destino_outro: Optional[str] = None
    data_discussao: Optional[date] = None
    data_visita: Optional[date] = None
    data_transferencia: Optional[date] = None
    observacoes: Optional[str] = None

    @field_validator("destino")
    @classmethod
    def validar_destino(cls, valor: Optional[str]):
        if valor is not None and valor not in DESTINOS_TRANSFERENCIA_VALIDOS:
            raise ValueError("Tipo de ação inválido.")
        return valor


class AcompanhamentoTransferenciaResponse(BaseModel):
    id: str
    convivente_id: str
    convivente_nome: Optional[str] = None
    prontuario: Optional[str] = None
    destino: str
    destino_outro: Optional[str] = None
    destino_exibicao: Optional[str] = None
    data_discussao: Optional[date] = None
    data_visita: Optional[date] = None
    data_transferencia: Optional[date] = None
    observacoes: Optional[str] = None
    registrado_por_id: str
    registrado_por_nome: Optional[str] = None
    criado_em: datetime
    atualizado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AcompanhamentoDiscussaoHospitalarCreate(BaseModel):
    convivente_id: str
    nome_hospital: Optional[str] = None
    hospital_outro: Optional[str] = None
    data_discussao: Optional[date] = None
    data_prevista_entrada: Optional[date] = None
    observacoes: Optional[str] = None

    @model_validator(mode="after")
    def validar_hospital(self):
        hospital = (self.nome_hospital or "").strip()
        if not hospital:
            raise ValueError("Selecione o hospital.")
        if hospital == "Outros":
            texto = (self.hospital_outro or "").strip()
            if len(texto) < 2:
                raise ValueError("Informe o hospital quando selecionar Outros.")
            self.hospital_outro = texto
        else:
            self.hospital_outro = None
        self.nome_hospital = hospital
        return self


class AcompanhamentoDiscussaoHospitalarUpdate(BaseModel):
    nome_hospital: Optional[str] = None
    hospital_outro: Optional[str] = None
    data_discussao: Optional[date] = None
    data_prevista_entrada: Optional[date] = None
    observacoes: Optional[str] = None


STATUS_EVOLUCAO_DISCUSSAO_HOSPITALAR = [
    "Internado",
    "Alta",
    "Encerrado",
]


class AcompanhamentoDiscussaoEvolucaoCreate(BaseModel):
    status_evolucao: str
    data_evolucao: date
    observacoes: Optional[str] = None

    @field_validator("status_evolucao")
    @classmethod
    def validar_status_evolucao(cls, valor: str):
        valor = (valor or "").strip()
        if valor not in STATUS_EVOLUCAO_DISCUSSAO_HOSPITALAR:
            raise ValueError("Status de evolução inválido. Use: Internado, Alta ou Encerrado.")
        return valor


class AcompanhamentoDiscussaoEvolucaoUpdate(BaseModel):
    status_evolucao: Optional[str] = None
    data_evolucao: Optional[date] = None
    observacoes: Optional[str] = None

    @field_validator("status_evolucao")
    @classmethod
    def validar_status_evolucao(cls, valor: Optional[str]):
        if valor is None:
            return valor
        valor = valor.strip()
        if valor not in STATUS_EVOLUCAO_DISCUSSAO_HOSPITALAR:
            raise ValueError("Status de evolução inválido. Use: Internado, Alta ou Encerrado.")
        return valor


class AcompanhamentoDiscussaoHospitalarResponse(BaseModel):
    id: str
    convivente_id: str
    convivente_nome: Optional[str] = None
    prontuario: Optional[str] = None
    registro_pai_id: Optional[str] = None
    nome_hospital: Optional[str] = None
    hospital_outro: Optional[str] = None
    hospital_exibicao: Optional[str] = None
    data_discussao: Optional[date] = None
    data_prevista_entrada: Optional[date] = None
    status_evolucao: Optional[str] = None
    data_evolucao: Optional[date] = None
    situacao_atual: Optional[str] = None
    observacoes: Optional[str] = None
    registrado_por_id: str
    registrado_por_nome: Optional[str] = None
    criado_em: datetime
    atualizado_em: Optional[datetime] = None
    evolucoes: Optional[List["AcompanhamentoDiscussaoHospitalarResponse"]] = None

    model_config = ConfigDict(from_attributes=True)


class AcompanhamentoTbCreate(BaseModel):
    convivente_id: str
    situacao: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    observacoes: Optional[str] = None

    @field_validator("situacao")
    @classmethod
    def validar_situacao(cls, valor: Optional[str]):
        if valor is not None and valor not in SITUACOES_TB:
            raise ValueError("Situação inválida.")
        return valor


class AcompanhamentoTbUpdate(BaseModel):
    situacao: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    observacoes: Optional[str] = None

    @field_validator("situacao")
    @classmethod
    def validar_situacao(cls, valor: Optional[str]):
        if valor is not None and valor not in SITUACOES_TB:
            raise ValueError("Situação inválida.")
        return valor


class AcompanhamentoTbResponse(BaseModel):
    id: str
    convivente_id: str
    convivente_nome: Optional[str] = None
    prontuario: Optional[str] = None
    situacao: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    observacoes: Optional[str] = None
    registrado_por_id: str
    registrado_por_nome: Optional[str] = None
    criado_em: datetime
    atualizado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AcompanhamentoPotCreate(BaseModel):
    convivente_id: str
    data_insercao: Optional[date] = None
    data_desligamento: Optional[date] = None
    congelamento_ativo: bool = False
    congelamento_inicio: Optional[date] = None
    congelamento_fim: Optional[date] = None
    observacoes: Optional[str] = None


class AcompanhamentoPotUpdate(BaseModel):
    data_insercao: Optional[date] = None
    data_desligamento: Optional[date] = None
    congelamento_ativo: Optional[bool] = None
    congelamento_inicio: Optional[date] = None
    congelamento_fim: Optional[date] = None
    observacoes: Optional[str] = None


STATUS_EVOLUCAO_POT = [
    "Em participação",
    "Congelamento",
    "Desligado",
    "Encerrado",
]


class AcompanhamentoPotEvolucaoCreate(BaseModel):
    status_evolucao: str
    data_evolucao: date
    observacoes: Optional[str] = None

    @field_validator("status_evolucao")
    @classmethod
    def validar_status_evolucao_pot(cls, valor: str):
        valor = (valor or "").strip()
        if valor not in STATUS_EVOLUCAO_POT:
            raise ValueError(
                "Status de evolução inválido. Use: Em participação, Congelamento, Desligado ou Encerrado."
            )
        return valor


class AcompanhamentoPotEvolucaoUpdate(BaseModel):
    status_evolucao: Optional[str] = None
    data_evolucao: Optional[date] = None
    observacoes: Optional[str] = None

    @field_validator("status_evolucao")
    @classmethod
    def validar_status_evolucao_pot_update(cls, valor: Optional[str]):
        if valor is None:
            return valor
        valor = valor.strip()
        if valor not in STATUS_EVOLUCAO_POT:
            raise ValueError(
                "Status de evolução inválido. Use: Em participação, Congelamento, Desligado ou Encerrado."
            )
        return valor


class AcompanhamentoPotResponse(BaseModel):
    id: str
    convivente_id: str
    convivente_nome: Optional[str] = None
    prontuario: Optional[str] = None
    registro_pai_id: Optional[str] = None
    status_evolucao: Optional[str] = None
    data_evolucao: Optional[date] = None
    situacao_atual: Optional[str] = None
    status_convivente: Optional[str] = None
    data_insercao: Optional[date] = None
    data_desligamento: Optional[date] = None
    congelamento_ativo: bool = False
    congelamento_inicio: Optional[date] = None
    congelamento_fim: Optional[date] = None
    observacoes: Optional[str] = None
    registrado_por_id: str
    registrado_por_nome: Optional[str] = None
    criado_em: datetime
    atualizado_em: Optional[datetime] = None
    evolucoes: Optional[List["AcompanhamentoPotResponse"]] = None

    model_config = ConfigDict(from_attributes=True)


class AcompanhamentoSuspensaoProvisoriaCreate(BaseModel):
    convivente_id: str
    mes_referencia: str
    data_registro: date
    motivo: str
    observacoes: Optional[str] = None
    status_aplicado: str = "Bloqueado"

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: str):
        texto = (valor or "").strip()
        if len(texto) < 5:
            raise ValueError("Informe o motivo da suspensão/bloqueio (mínimo 5 caracteres).")
        return texto

    @field_validator("status_aplicado")
    @classmethod
    def validar_status_aplicado(cls, valor: str):
        if valor not in {"Bloqueado"}:
            raise ValueError("Status operacional inválido para suspensão.")
        return valor

    @field_validator("mes_referencia")
    @classmethod
    def validar_mes_referencia(cls, valor: str):
        valor = (valor or "").strip()
        if len(valor) != 7 or valor[4] != "-":
            raise ValueError("Mês de referência inválido. Use AAAA-MM.")
        ano, mes = valor.split("-", 1)
        if not ano.isdigit() or not mes.isdigit():
            raise ValueError("Mês de referência inválido. Use AAAA-MM.")
        mes_int = int(mes)
        if mes_int < 1 or mes_int > 12:
            raise ValueError("Mês de referência inválido.")
        return valor


class AcompanhamentoSuspensaoProvisoriaUpdate(BaseModel):
    mes_referencia: Optional[str] = None
    data_registro: Optional[date] = None
    motivo: Optional[str] = None
    observacoes: Optional[str] = None
    status_aplicado: Optional[str] = None

    @field_validator("motivo")
    @classmethod
    def validar_motivo(cls, valor: Optional[str]):
        if valor is None:
            return valor
        texto = valor.strip()
        if len(texto) < 5:
            raise ValueError("Informe o motivo da suspensão/bloqueio (mínimo 5 caracteres).")
        return texto

    @field_validator("mes_referencia")
    @classmethod
    def validar_mes_referencia(cls, valor: Optional[str]):
        if valor is None:
            return valor
        valor = valor.strip()
        if len(valor) != 7 or valor[4] != "-":
            raise ValueError("Mês de referência inválido. Use AAAA-MM.")
        ano, mes = valor.split("-", 1)
        if not ano.isdigit() or not mes.isdigit():
            raise ValueError("Mês de referência inválido. Use AAAA-MM.")
        mes_int = int(mes)
        if mes_int < 1 or mes_int > 12:
            raise ValueError("Mês de referência inválido.")
        return valor


class AcompanhamentoSuspensaoProvisoriaResponse(BaseModel):
    id: str
    convivente_id: str
    convivente_nome: Optional[str] = None
    prontuario: Optional[str] = None
    mes_referencia: str
    data_registro: date
    motivo: Optional[str] = None
    observacoes: Optional[str] = None
    status_aplicado: str = "Bloqueado"
    registrado_por_id: str
    registrado_por_nome: Optional[str] = None
    criado_em: datetime
    atualizado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AcompanhamentosListaResponse(BaseModel):
    items: List[Any]
    total: int
    limit: int
    offset: int
    has_more: bool
    destinos_transferencia: Optional[List[str]] = None
    situacoes_tb: Optional[List[str]] = None
    hospitais: Optional[List[str]] = None
    status_evolucao: Optional[List[str]] = None


class AcompanhamentoResumoMensalLinha(BaseModel):
    acao: str
    total: int
    origem: str = "acoes"
    observacoes: Optional[str] = None


class AcompanhamentoResumoMensalResponse(BaseModel):
    mes_referencia: str
    mes_rotulo: str
    titulo: str
    periodo_inicio: date
    periodo_fim: date
    periodo_rotulo: str
    periodo_personalizado: bool = False
    linhas: List[AcompanhamentoResumoMensalLinha]
    gerado_em: datetime


# --- Atividades (oficinas / presença) ---

CATEGORIAS_ATIVIDADE = [
    "oficina",
    "esporte",
    "reuniao_tecnica",
    "noturna",
    "cultural",
    "outra",
]

TIPOS_FREQUENCIA_ATIVIDADE = [
    "diaria",
    "semanal",
    "bisemanal",
    "dias_mes",
]

METODOS_PRESENCA_ATIVIDADE = [
    "QR Code",
    "Código de barras",
    "Leitor USB",
    "Manual",
]

STATUS_OCORRENCIA_ATIVIDADE = ["aberta", "encerrada", "cancelada"]


class AtividadeConfiguracaoAgenda(BaseModel):
    dias_semana: List[int] = Field(default_factory=list)
    datas_especificas: List[str] = Field(default_factory=list)
    somente_dias_uteis: bool = False
    max_sessoes_mes: Optional[int] = None


class AtividadeCreate(BaseModel):
    nome: str
    categoria: str = "oficina"
    responsavel_usuario_id: Optional[str] = None
    tipo_frequencia: str = "semanal"
    configuracao_agenda: AtividadeConfiguracaoAgenda = Field(default_factory=AtividadeConfiguracaoAgenda)
    vigencia_inicio: Optional[date] = None
    vigencia_fim: Optional[date] = None
    sisa_descricao_atividade: Optional[str] = None
    sisa_descricao_tema: Optional[str] = None
    sisa_horario_padrao: Optional[str] = None
    ativo: bool = True
    contabiliza_pontos: bool = True


class AtividadeUpdate(BaseModel):
    nome: Optional[str] = None
    categoria: Optional[str] = None
    responsavel_usuario_id: Optional[str] = None
    tipo_frequencia: Optional[str] = None
    configuracao_agenda: Optional[AtividadeConfiguracaoAgenda] = None
    vigencia_inicio: Optional[date] = None
    vigencia_fim: Optional[date] = None
    sisa_descricao_atividade: Optional[str] = None
    sisa_descricao_tema: Optional[str] = None
    sisa_horario_padrao: Optional[str] = None
    ativo: Optional[bool] = None
    contabiliza_pontos: Optional[bool] = None


class AtividadeResponse(BaseModel):
    id: str
    instituicao_id: str
    nome: str
    categoria: str
    responsavel_usuario_id: Optional[str] = None
    responsavel_nome: Optional[str] = None
    tipo_frequencia: str
    configuracao_agenda: dict = Field(default_factory=dict)
    vigencia_inicio: Optional[date] = None
    vigencia_fim: Optional[date] = None
    sisa_descricao_atividade: Optional[str] = None
    sisa_descricao_tema: Optional[str] = None
    sisa_horario_padrao: Optional[str] = None
    ativo: bool = True
    contabiliza_pontos: bool = True
    criado_por_id: str
    criado_em: datetime
    atualizado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AtividadesListaResponse(BaseModel):
    items: List[AtividadeResponse]
    total: int


class AtividadeGerarOcorrenciasRequest(BaseModel):
    mes_referencia: str


class AtividadeOcorrenciaResponse(BaseModel):
    id: str
    atividade_id: str
    data_sessao: date
    numero_sessao_mes: int
    mes_referencia: str
    horario_sessao: str = ""
    status: str
    criado_em: datetime
    total_presentes: int = 0
    acoes_realizadas: Optional[str] = None
    tem_conteudo: bool = False

    model_config = ConfigDict(from_attributes=True)


class AtividadeOcorrenciasListaResponse(BaseModel):
    items: List[AtividadeOcorrenciaResponse]
    total: int
    mes_referencia: str


class AtividadePresencaCreate(BaseModel):
    convivente_id: str
    metodo_leitura: str
    codigo_lido: Optional[str] = None


class AtividadePresencaResponse(BaseModel):
    id: str
    atividade_id: str
    ocorrencia_id: str
    convivente_id: str
    convivente_nome: Optional[str] = None
    prontuario: Optional[str] = None
    usuario_id: str
    usuario_nome: Optional[str] = None
    metodo_leitura: str
    codigo_lido: Optional[str] = None
    registrado_em: datetime
    cancelado: bool = False
    pode_desfazer: bool = False

    model_config = ConfigDict(from_attributes=True)


class AtividadePresencaCancelamento(BaseModel):
    motivo_cancelamento: str


class AtividadeChamadaResponse(BaseModel):
    ocorrencia: AtividadeOcorrenciaResponse
    atividade: AtividadeResponse
    presencas: List[AtividadePresencaResponse]
    conviventes_elegiveis: List[dict]


class AtividadeGradeConviventeLinha(BaseModel):
    convivente_id: str
    nome: str
    prontuario: Optional[str] = None
    status: str
    presencas_por_ocorrencia: dict[str, Optional[AtividadePresencaResponse]]


class AtividadeGradeResponse(BaseModel):
    mes_referencia: str
    atividade: AtividadeResponse
    ocorrencias: List[AtividadeOcorrenciaResponse]
    linhas: List[AtividadeGradeConviventeLinha]


class AtividadeSessaoConteudoUpsert(BaseModel):
    acoes_realizadas: Optional[str] = None


class AtividadeSessaoConteudoResponse(BaseModel):
    id: str
    ocorrencia_id: str
    atividade_id: str
    acoes_realizadas: Optional[str] = None
    registrado_por_id: str
    registrado_por_nome: Optional[str] = None
    criado_em: datetime
    atualizado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AtividadeOcorrenciaStatusUpdate(BaseModel):
    status: str


class AtividadeRelatorioResumo(BaseModel):
    total_presencas: int = 0
    total_conviventes: int = 0
    total_atividades: int = 0
    total_sessoes: int = 0


class AtividadeRelatorioLinha(BaseModel):
    chave: str
    rotulo: str
    data_sessao: Optional[date] = None
    atividade_id: Optional[str] = None
    atividade_nome: Optional[str] = None
    responsavel_nome: Optional[str] = None
    convivente_id: Optional[str] = None
    convivente_nome: Optional[str] = None
    prontuario: Optional[str] = None
    metodo_leitura: Optional[str] = None
    registrado_por_nome: Optional[str] = None
    total_presencas: Optional[int] = None
    total_sessoes: Optional[int] = None
    total_conviventes: Optional[int] = None
    total_atividades: Optional[int] = None


class AtividadeRelatorioResponse(BaseModel):
    data_inicio: date
    data_fim: date
    agrupamento: str
    resumo: AtividadeRelatorioResumo
    linhas: List[AtividadeRelatorioLinha]


class AtividadeCatalogoSisaItem(BaseModel):
    valor: str
    personalizado: bool = False


class AtividadeCatalogoSisaResponse(BaseModel):
    descricao_atividade: List[AtividadeCatalogoSisaItem]
    descricao_tema: List[AtividadeCatalogoSisaItem]


class AtividadeCatalogoSisaCreate(BaseModel):
    tipo: str
    valor: str


class AtividadeSisaVinculoPayload(BaseModel):
    chave: str
    atividade_id: str


class AtividadeSisaConferenciaLinha(BaseModel):
    indice: int
    chave: str
    dimensao: Optional[str] = None
    descricao_atividade: str
    descricao_tema: str
    data_sessao: date
    horario: str
    participacoes_sisa: int
    participacoes_carecore: int = 0
    delta: Optional[int] = None
    atividade_id: Optional[str] = None
    atividade_nome: Optional[str] = None
    ocorrencia_id: Optional[str] = None
    status: str
    mensagem: str
    sugestao_atividade_id: Optional[str] = None


class AtividadeSisaSomenteCarecoreLinha(BaseModel):
    chave: str
    data_sessao: date
    horario: str
    descricao_atividade: Optional[str] = None
    descricao_tema: Optional[str] = None
    atividade_id: str
    atividade_nome: Optional[str] = None
    ocorrencia_id: str
    participacoes_carecore: int
    status: str
    mensagem: str


class AtividadeSisaConferenciaResumo(BaseModel):
    conferidas: int = 0
    divergencias_quantidade: int = 0
    sem_vinculo: int = 0
    sem_ocorrencia_carecore: int = 0
    somente_sisa: int = 0
    somente_carecore: int = 0


class AtividadeSisaConferenciaResponse(BaseModel):
    nome_arquivo: str
    data_inicio_referencia: date
    data_fim_referencia: date
    servico: Optional[str] = None
    projeto: Optional[str] = None
    totais_sisa: dict = Field(default_factory=dict)
    resumo: AtividadeSisaConferenciaResumo
    linhas: List[AtividadeSisaConferenciaLinha]
    somente_carecore: List[AtividadeSisaSomenteCarecoreLinha]
    historico_id: Optional[str] = None


class AtividadeSisaConferenciaHistoricoResumo(BaseModel):
    id: str
    nome_arquivo: str
    data_inicio_referencia: date
    data_fim_referencia: date
    servico: Optional[str] = None
    importado_em: datetime
    usuario_nome: Optional[str] = None
    resumo: AtividadeSisaConferenciaResumo


class AtividadeSisaConferenciaHistoricoListaResponse(BaseModel):
    items: List[AtividadeSisaConferenciaHistoricoResumo]
    total: int
    limit: int
    offset: int
    has_more: bool


class AtividadeSisaConferenciaHistoricoDetalheResponse(BaseModel):
    id: str
    nome_arquivo: str
    data_inicio_referencia: date
    data_fim_referencia: date
    servico: Optional[str] = None
    projeto: Optional[str] = None
    importado_em: datetime
    usuario_nome: Optional[str] = None
    vinculos: List[AtividadeSisaVinculoPayload]
    resultado: AtividadeSisaConferenciaResponse


PONTOS_POR_PRESENCA_ATIVIDADE = 1


class AtividadePontosRankingItem(BaseModel):
    posicao: int
    convivente_id: str
    nome: str
    numero_institucional: Optional[int] = None
    total_presencas: int
    pontos_ganhos: int
    pontos_utilizados: int
    saldo_pontos: int


class AtividadePontosRankingResponse(BaseModel):
    items: List[AtividadePontosRankingItem]
    total: int
    pontos_por_presenca: int = PONTOS_POR_PRESENCA_ATIVIDADE


class AtividadePontosResgateCreate(BaseModel):
    convivente_id: str
    pontos_utilizados: int = Field(gt=0)
    descricao_brinde: Optional[str] = None
    metodo_leitura: str
    codigo_lido: str


class AtividadePontosResgateResponse(BaseModel):
    id: str
    convivente_id: str
    convivente_nome: str
    pontos_utilizados: int
    descricao_brinde: Optional[str] = None
    saldo_restante: Optional[int] = None
    usuario_nome: Optional[str] = None
    metodo_leitura: str
    registrado_em: datetime


class AtividadePontosResgatesListaResponse(BaseModel):
    items: List[AtividadePontosResgateResponse]
    total: int
    limit: int
    offset: int
    has_more: bool

