"""Configuração operacional por projeto (portaria, refeições, módulos, documentos)."""
from __future__ import annotations

import json
import re
from copy import deepcopy
from datetime import time
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from config_operacional_defaults import (
    INTERACOES_ROTINA_PADRAO,
    MODULOS_PADRAO,
    PORTARIA_PADRAO,
    REFEICOES_PADRAO,
    TERMO_BAGAGEIRO_COMPROMISSO_PADRAO,
    TERMO_BAGAGEIRO_ITENS_PADRAO,
    TERMO_BAGAGEIRO_RETIRADA_SUBTITULO_PADRAO,
    TERMO_BAGAGEIRO_RETIRADA_TEXTO_PADRAO,
    TERMO_BAGAGEIRO_RETIRADA_TITULO_PADRAO,
    TERMO_BAGAGEIRO_ROTULO_FUNCIONARIO_PADRAO,
    TERMO_BAGAGEIRO_TITULO_PADRAO,
    TERMO_COMPROMISSO_TEXTO_PADRAO,
    TERMO_COMPROMISSO_TITULO_PADRAO,
    TERMO_LGPD_SUBTITULO_PADRAO,
    TERMO_LGPD_TEXTO_PADRAO,
    TERMO_LGPD_TITULO_PADRAO,
)
from config_operacional_defaults_siat import (
    MODULOS_SIAT,
    TERMO_BAGAGEIRO_ITENS_SIAT,
    TERMO_BAGAGEIRO_RETIRADA_TEXTO_SIAT,
    TERMO_COMPROMISSO_TEXTO_SIAT,
    TERMO_COMPROMISSO_TITULO_SIAT,
    TERMO_LGPD_TEXTO_SIAT,
)

_HORA_RE = re.compile(r"^\d{1,2}:\d{2}$")


class RefeicaoOperacionalItem(BaseModel):
    id: str
    nome: str
    inicio: str
    fim: str
    ativo: bool = True

    @field_validator("nome")
    @classmethod
    def validar_nome(cls, valor: str) -> str:
        texto = (valor or "").strip()
        if not texto:
            raise ValueError("Nome da refeição obrigatório.")
        return texto

    @field_validator("inicio", "fim")
    @classmethod
    def validar_hora(cls, valor: str) -> str:
        texto = (valor or "").strip()
        if not _HORA_RE.match(texto):
            raise ValueError("Horário inválido. Use HH:MM.")
        hora, minuto = map(int, texto.split(":"))
        if hora > 23 or minuto > 59:
            raise ValueError("Horário inválido.")
        return f"{hora:02d}:{minuto:02d}"


class RefeicoesOperacionalConfig(BaseModel):
    habilitadas: bool = True
    itens: list[RefeicaoOperacionalItem] = Field(default_factory=list)


class PortariaOperacionalConfig(BaseModel):
    hora_saida_padrao: str = "17:00"
    hora_entrada_padrao: str = "19:00"
    hora_entrada_apos_pernoite_fora: str = "11:00"
    hora_movimento_pernoite_dentro: str = "04:00"
    min_caracteres_justificativa: int = 30
    motivos_excecao: list[str] = Field(
        default_factory=lambda: ["estudante", "trabalho", "saude", "eventual"]
    )

    @field_validator(
        "hora_saida_padrao",
        "hora_entrada_padrao",
        "hora_entrada_apos_pernoite_fora",
        "hora_movimento_pernoite_dentro",
    )
    @classmethod
    def validar_horas(cls, valor: str) -> str:
        texto = (valor or "").strip()
        if not _HORA_RE.match(texto):
            raise ValueError("Horário inválido. Use HH:MM.")
        hora, minuto = map(int, texto.split(":"))
        return f"{hora:02d}:{minuto:02d}"

    @field_validator("min_caracteres_justificativa")
    @classmethod
    def validar_min_chars(cls, valor: int) -> int:
        if valor < 10 or valor > 500:
            raise ValueError("Mínimo de caracteres deve estar entre 10 e 500.")
        return valor


GRUPOS_INTERACAO_ROTINA = frozenset({"simples", "par", "par_bagageiro", "observacao", "refeicao"})


class InteracaoRotinaItem(BaseModel):
    valor: str
    label: str
    grupo: str
    ativo: bool = True
    tipo_retirada: Optional[str] = None
    tipo_entrega: Optional[str] = None

    @field_validator("valor", "label", "grupo")
    @classmethod
    def validar_texto(cls, valor: str) -> str:
        texto = (valor or "").strip()
        if not texto:
            raise ValueError("Campo obrigatório.")
        return texto

    @field_validator("grupo")
    @classmethod
    def validar_grupo(cls, valor: str) -> str:
        texto = (valor or "").strip()
        if texto not in GRUPOS_INTERACAO_ROTINA:
            raise ValueError("Grupo de interação inválido.")
        return texto

    @field_validator("tipo_retirada", "tipo_entrega")
    @classmethod
    def validar_tipo_par(cls, valor: Optional[str]) -> Optional[str]:
        if valor is None:
            return None
        texto = valor.strip()
        return texto or None


class ModulosOperacionalConfig(BaseModel):
    tb: bool = True
    sisa: bool = True
    pot: bool = True
    discussoes_hospitalares: bool = True
    suspensoes: bool = True
    transferencias: bool = True
    tuberculose: bool = True
    historico_legado: bool = False


class TermoCompromissoConfig(BaseModel):
    imprimir: bool = True
    titulo: str = TERMO_COMPROMISSO_TITULO_PADRAO
    texto: str = TERMO_COMPROMISSO_TEXTO_PADRAO


class TermoLgpdConfig(BaseModel):
    imprimir: bool = True
    titulo: str = TERMO_LGPD_TITULO_PADRAO
    subtitulo: str = TERMO_LGPD_SUBTITULO_PADRAO
    texto: str = TERMO_LGPD_TEXTO_PADRAO


class TermoBagageiroConfig(BaseModel):
    imprimir: bool = True
    titulo: str = TERMO_BAGAGEIRO_TITULO_PADRAO
    itens: list[str] = Field(default_factory=lambda: list(TERMO_BAGAGEIRO_ITENS_PADRAO))
    compromisso: str = TERMO_BAGAGEIRO_COMPROMISSO_PADRAO
    retirada_titulo: str = TERMO_BAGAGEIRO_RETIRADA_TITULO_PADRAO
    retirada_subtitulo: str = TERMO_BAGAGEIRO_RETIRADA_SUBTITULO_PADRAO
    retirada_texto: str = TERMO_BAGAGEIRO_RETIRADA_TEXTO_PADRAO
    rotulo_assinatura_funcionario: str = TERMO_BAGAGEIRO_ROTULO_FUNCIONARIO_PADRAO


class DocumentosOperacionalConfig(BaseModel):
    termo_compromisso: TermoCompromissoConfig = Field(default_factory=TermoCompromissoConfig)
    termo_lgpd: TermoLgpdConfig = Field(default_factory=TermoLgpdConfig)
    termo_bagageiro: TermoBagageiroConfig = Field(default_factory=TermoBagageiroConfig)


class ConfigOperacionalProjeto(BaseModel):
    model_config = ConfigDict(extra="ignore")

    refeicoes: RefeicoesOperacionalConfig = Field(default_factory=RefeicoesOperacionalConfig)
    portaria: PortariaOperacionalConfig = Field(default_factory=PortariaOperacionalConfig)
    interacoes_rotina: list[InteracaoRotinaItem] = Field(default_factory=list)
    modulos: ModulosOperacionalConfig = Field(default_factory=ModulosOperacionalConfig)
    documentos: DocumentosOperacionalConfig = Field(default_factory=DocumentosOperacionalConfig)


def _parse_hora_str(valor: str) -> time:
    hora, minuto = map(int, valor.split(":"))
    return time(hora, minuto)


def montar_config_operacional_padrao(*, siat: bool = False) -> ConfigOperacionalProjeto:
    modulos = MODULOS_SIAT if siat else MODULOS_PADRAO
    termo_compromisso_titulo = TERMO_COMPROMISSO_TITULO_SIAT if siat else TERMO_COMPROMISSO_TITULO_PADRAO
    termo_compromisso_texto = TERMO_COMPROMISSO_TEXTO_SIAT if siat else TERMO_COMPROMISSO_TEXTO_PADRAO
    termo_lgpd_texto = TERMO_LGPD_TEXTO_SIAT if siat else TERMO_LGPD_TEXTO_PADRAO
    termo_bagageiro_itens = TERMO_BAGAGEIRO_ITENS_SIAT if siat else TERMO_BAGAGEIRO_ITENS_PADRAO
    termo_bagageiro_retirada = (
        TERMO_BAGAGEIRO_RETIRADA_TEXTO_SIAT if siat else TERMO_BAGAGEIRO_RETIRADA_TEXTO_PADRAO
    )

    return ConfigOperacionalProjeto(
        refeicoes=RefeicoesOperacionalConfig(
            habilitadas=True,
            itens=[RefeicaoOperacionalItem(**item) for item in REFEICOES_PADRAO],
        ),
        portaria=PortariaOperacionalConfig(**PORTARIA_PADRAO),
        interacoes_rotina=[InteracaoRotinaItem(**item) for item in INTERACOES_ROTINA_PADRAO],
        modulos=ModulosOperacionalConfig(**modulos),
        documentos=DocumentosOperacionalConfig(
            termo_compromisso=TermoCompromissoConfig(
                imprimir=True,
                titulo=termo_compromisso_titulo,
                texto=termo_compromisso_texto,
            ),
            termo_lgpd=TermoLgpdConfig(
                imprimir=True,
                titulo=TERMO_LGPD_TITULO_PADRAO,
                subtitulo=TERMO_LGPD_SUBTITULO_PADRAO,
                texto=termo_lgpd_texto,
            ),
            termo_bagageiro=TermoBagageiroConfig(
                imprimir=True,
                titulo=TERMO_BAGAGEIRO_TITULO_PADRAO,
                itens=list(termo_bagageiro_itens),
                compromisso=TERMO_BAGAGEIRO_COMPROMISSO_PADRAO,
                retirada_titulo=TERMO_BAGAGEIRO_RETIRADA_TITULO_PADRAO,
                retirada_subtitulo=TERMO_BAGAGEIRO_RETIRADA_SUBTITULO_PADRAO,
                retirada_texto=termo_bagageiro_retirada,
                rotulo_assinatura_funcionario=TERMO_BAGAGEIRO_ROTULO_FUNCIONARIO_PADRAO,
            ),
        ),
    )


def mesclar_config_operacional(
  stored: dict[str, Any] | str | None,
  *,
  siat: bool = False,
) -> ConfigOperacionalProjeto:
    base = montar_config_operacional_padrao(siat=siat)
    if not stored:
        return base

    if isinstance(stored, str):
        try:
            stored = json.loads(stored)
        except json.JSONDecodeError:
            return base

    if not isinstance(stored, dict):
        return base

    merged = deepcopy(base.model_dump())
    for chave, valor in stored.items():
        if valor is None:
            continue
        if chave in merged and isinstance(merged[chave], dict) and isinstance(valor, dict):
            merged[chave] = {**merged[chave], **valor}
        else:
            merged[chave] = valor

    return ConfigOperacionalProjeto.model_validate(merged)


def serializar_config_operacional(config: ConfigOperacionalProjeto) -> str:
    return json.dumps(config.model_dump(), ensure_ascii=False)


def obter_refeicoes_ativas(config: ConfigOperacionalProjeto) -> list[RefeicaoOperacionalItem]:
    if not config.refeicoes.habilitadas:
        return []
    return [item for item in config.refeicoes.itens if item.ativo and item.nome.strip()]


def obter_tipos_refeicao_ativos(config: ConfigOperacionalProjeto) -> set[str]:
    return {item.nome for item in obter_refeicoes_ativas(config)}


def obter_janelas_refeicao(config: ConfigOperacionalProjeto) -> dict[str, tuple[time, time]]:
    janelas: dict[str, tuple[time, time]] = {}
    for item in obter_refeicoes_ativas(config):
        janelas[item.nome] = (_parse_hora_str(item.inicio), _parse_hora_str(item.fim))
    return janelas


def obter_interacoes_rotina_ativas(config: ConfigOperacionalProjeto) -> list[InteracaoRotinaItem]:
    interacoes = [item for item in config.interacoes_rotina if item.ativo]
    if config.refeicoes.habilitadas:
        nomes_refeicao = {item.nome for item in obter_refeicoes_ativas(config)}
        interacoes_refeicao = [
            InteracaoRotinaItem(valor=nome, label=nome, grupo="refeicao", ativo=True)
            for nome in nomes_refeicao
        ]
        existentes = {item.valor for item in interacoes}
        for item in interacoes_refeicao:
            if item.valor not in existentes:
                interacoes.insert(0, item)
    return interacoes


TIPOS_ROTINA_PRINCIPAIS_FIXOS = frozenset({"Entrada", "Saída"})
TIPOS_ROTINA_PARES_MAP = {
    "Cobertor": ("Retirada de Cobertor", "Entrega de Cobertor"),
    "Toalha": ("Retirada de Toalha", "Entrega de Toalha"),
}
TIPO_ROTINA_BAGAGEIRO = "Movimentação de Bagageiro"
GRUPO_BAGAGEIRO_VALOR = "Bagageiro"


def obter_pares_interacao(item: InteracaoRotinaItem) -> tuple[str, str] | None:
    if item.grupo != "par":
        return None
    if item.tipo_retirada and item.tipo_entrega:
        return (item.tipo_retirada, item.tipo_entrega)
    return TIPOS_ROTINA_PARES_MAP.get(item.valor)


def obter_tipos_rotina_validos(config: ConfigOperacionalProjeto) -> set[str]:
    tipos = set(TIPOS_ROTINA_PRINCIPAIS_FIXOS)
    for interacao in obter_interacoes_rotina_ativas(config):
        if interacao.grupo == "refeicao":
            tipos.add(interacao.valor)
        elif interacao.grupo == "simples":
            tipos.add(interacao.valor)
        elif interacao.grupo == "par":
            pares = obter_pares_interacao(interacao)
            if pares:
                tipos.update(pares)
        elif interacao.grupo == "par_bagageiro" and interacao.valor == GRUPO_BAGAGEIRO_VALOR:
            tipos.add(TIPO_ROTINA_BAGAGEIRO)
        elif interacao.grupo == "observacao":
            tipos.add(interacao.valor)
    return tipos


def obter_tipos_ajuste_totais(config: ConfigOperacionalProjeto) -> tuple[str, ...]:
    tipos = ["Entrada", "Saída"]
    for interacao in obter_interacoes_rotina_ativas(config):
        if interacao.grupo == "refeicao":
            tipos.append(interacao.valor)
        elif interacao.grupo == "simples" and interacao.valor == "Banho":
            tipos.append(interacao.valor)
    return tuple(dict.fromkeys(tipos))


def modulo_acompanhamento_ativo(config: ConfigOperacionalProjeto, slug: str) -> bool:
    modulos = config.modulos
    mapa = {
        "transferencias": modulos.transferencias,
        "discussoes-hospitalares": modulos.discussoes_hospitalares,
        "tuberculose": modulos.tuberculose,
        "pot": modulos.pot,
        "suspensoes": modulos.suspensoes,
    }
    return mapa.get(slug, True)


def portaria_para_validacao(config: ConfigOperacionalProjeto) -> dict[str, Any]:
    p = config.portaria
    return {
        "hora_saida_padrao": _parse_hora_str(p.hora_saida_padrao),
        "hora_entrada_padrao": _parse_hora_str(p.hora_entrada_padrao),
        "hora_entrada_apos_pernoite_fora": _parse_hora_str(p.hora_entrada_apos_pernoite_fora),
        "hora_movimento_pernoite_dentro": _parse_hora_str(p.hora_movimento_pernoite_dentro),
        "min_caracteres_justificativa": p.min_caracteres_justificativa,
        "motivos_excecao": frozenset(m.strip().lower() for m in p.motivos_excecao if m.strip()),
    }


def config_operacional_para_resposta(
    config: ConfigOperacionalProjeto,
    *,
    personalizado: bool,
    perfil_defaults: str = "generico",
) -> dict[str, Any]:
    dados = config.model_dump()
    dados["personalizado"] = personalizado
    dados["perfil_defaults"] = perfil_defaults
    dados["refeicoes_ativas"] = [item.model_dump() for item in obter_refeicoes_ativas(config)]
    dados["interacoes_ativas"] = [item.model_dump() for item in obter_interacoes_rotina_ativas(config)]
    dados["tipos_rotina_validos"] = sorted(obter_tipos_rotina_validos(config))
    return dados
