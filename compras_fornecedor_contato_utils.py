# -*- coding: utf-8 -*-
"""Desmembra texto livre do campo contato (legado/importação)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from compras_telefone_utils import (
    extrair_telefones_compras,
    formatar_telefone_compras,
    sanitizar_telefone_compras,
)

_RE_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", re.I)
_RE_EMAIL_COMPLETO = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
_RE_SITE_SEM_ARROBA = re.compile(
    r"^(?:https?://)?(?:www\.)?[A-Za-z0-9][A-Za-z0-9.-]*\.(?:com\.br|com|net|org|br)(?:/.*)?$",
    re.I,
)
_RE_GMAIL_SEM_ARROBA = re.compile(r"^(.+)\.gmail\.com$", re.I)
_RE_CNPJ = re.compile(r"\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}")
_RE_ENDERECO = re.compile(
    r"^(AV\.?|RUA|R\.|AL\.|ALAMEDA|TRAVESSA|TV\.|ROD\.|ESTRADA|PÇ\.|PRAÇA)\b",
    re.I,
)
_RE_ENDERECO_NUM_BAIRRO = re.compile(
    r"^(?P<log>.+?)\s*,\s*(?P<num>\d+[A-Za-z]?)\s*(?:-\s*(?P<bairro>.+))?$",
    re.I,
)
_RE_SO_LETRAS = re.compile(r"^[A-Za-zÀ-ú\s.'-]+$", re.I)


@dataclass
class EnderecoParseado:
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    complemento: Optional[str] = None


@dataclass
class ContatoDesmembrado:
    representante: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco: EnderecoParseado = field(default_factory=EnderecoParseado)


def _limpar_cnpj(valor: str) -> Optional[str]:
    digitos = re.sub(r"\D", "", valor or "")
    return digitos if len(digitos) == 14 else None


def _parse_endereco(texto: str) -> Optional[EnderecoParseado]:
    bruto = (texto or "").strip()
    if not bruto or not _RE_ENDERECO.search(bruto):
        return None
    match = _RE_ENDERECO_NUM_BAIRRO.match(bruto)
    if not match:
        return EnderecoParseado(logradouro=bruto)
    return EnderecoParseado(
        logradouro=(match.group("log") or "").strip(" ,") or None,
        numero=(match.group("num") or "").strip() or None,
        bairro=(match.group("bairro") or "").strip() or None,
    )


def desmembrar_contato_livre(
    contato: Optional[str],
    *,
    cnpj_atual: Optional[str] = None,
    email_atual: Optional[str] = None,
    telefone_atual: Optional[str] = None,
) -> ContatoDesmembrado:
    texto = (contato or "").strip()
    if not texto:
        return ContatoDesmembrado()

    resultado = ContatoDesmembrado()
    restante = texto

    email_match = _RE_EMAIL.search(restante)
    if email_match:
        if not email_atual:
            resultado.email = email_match.group(0).strip().lower()
        restante = restante.replace(email_match.group(0), " ").strip(" ,;-")

    cnpj_match = _RE_CNPJ.search(restante)
    if cnpj_match and not cnpj_atual:
        cnpj_limpo = _limpar_cnpj(cnpj_match.group(0))
        if cnpj_limpo:
            resultado.cnpj = cnpj_limpo
            restante = restante.replace(cnpj_match.group(0), " ").strip(" ,;-")

    if not telefone_atual:
        tel, _ = sanitizar_telefone_compras(restante)
        if tel:
            resultado.telefone = tel
            for bruto_tel in extrair_telefones_compras(restante):
                restante = re.sub(re.sub(r"\D", "", bruto_tel), "", restante, count=1)
            restante = re.sub(r"\(\s*\d{2}\s*\)[\d\s\-]+", "", restante).strip(" ,;-")

    endereco = _parse_endereco(restante)
    if endereco and endereco.logradouro:
        resultado.endereco = endereco
        restante = ""

    representante = re.sub(r"\s+", " ", restante).strip(" ,;-")
    if representante and not _RE_ENDERECO.search(representante):
        if _limpar_cnpj(representante):
            if not cnpj_atual and not resultado.cnpj:
                resultado.cnpj = _limpar_cnpj(representante)
        elif "@" not in representante:
            resultado.representante = representante

    return resultado


def formatar_endereco_fornecedor(registro: dict) -> str:
    partes = []
    log = (registro.get("logradouro") or "").strip()
    num = (registro.get("numero") or "").strip()
    if log:
        partes.append(f"{log}{f', {num}' if num else ''}")
    bairro = (registro.get("bairro") or "").strip()
    if bairro:
        partes.append(bairro)
    cidade = (registro.get("cidade") or "").strip()
    uf = (registro.get("uf") or "").strip()
    if cidade:
        partes.append(f"{cidade}/{uf}" if uf else cidade)
    elif uf:
        partes.append(uf)
    cep = re.sub(r"\D", "", registro.get("cep") or "")
    if len(cep) == 8:
        partes.append(f"CEP {cep[:5]}-{cep[5:]}")
    return " · ".join(partes)


def email_fornecedor_valido(valor: Optional[str]) -> bool:
    texto = str(valor or "").strip()
    if not texto:
        return True
    return bool(_RE_EMAIL_COMPLETO.match(texto))


def cep_fornecedor_valido(valor: Optional[str]) -> bool:
    digitos = re.sub(r"\D", "", str(valor or ""))
    if not digitos:
        return True
    return len(digitos) == 8


def _txt(valor: Any) -> str:
    return str(valor or "").strip()


def _anexar_obs(obs_atual: Optional[str], trecho: str) -> Optional[str]:
    trecho = _txt(trecho)
    if not trecho:
        return _txt(obs_atual) or None
    atual = _txt(obs_atual)
    if trecho in atual:
        return atual or None
    return f"{atual} | {trecho}".strip(" |") if atual else trecho


def _corrigir_email_quase_gmail(texto: str) -> Optional[str]:
    match = _RE_GMAIL_SEM_ARROBA.match(texto.strip())
    if not match:
        return None
    local = match.group(1).strip().rstrip(".")
    if not local or "@" in local:
        return None
    candidato = f"{local}@gmail.com"
    return candidato.lower() if email_fornecedor_valido(candidato) else None


def _parece_site(texto: str) -> bool:
    s = texto.strip()
    if "@" in s:
        return False
    return bool(_RE_SITE_SEM_ARROBA.match(s)) or s.lower().startswith("www.")


def _parece_nome_pessoa(texto: str) -> bool:
    s = _txt(texto)
    if not s or len(s) < 3 or not _RE_SO_LETRAS.match(s):
        return False
    if any(p in s.upper() for p in ("PEDIDO", "WHATS", "SOMENTE", "APENAS")):
        return False
    return True


def sanitizar_campos_contato_fornecedor(registro: dict) -> tuple[dict, list[str]]:
    """
    Corrige e-mail/telefone/CEP fora do padrão (importação legada).
    Não inventa CEP; só limpa inválidos e redistribui valores misturados.
    """
    out = dict(registro)
    mudancas: list[str] = []

    for campo_email in ("email", "email_empresa"):
        bruto = _txt(out.get(campo_email))
        if not bruto:
            out[campo_email] = None
            continue
        if email_fornecedor_valido(bruto):
            normalizado = bruto.lower()
            if normalizado != bruto:
                mudancas.append(f"{campo_email}: normalizado")
            out[campo_email] = normalizado
            continue

        corrigido = _corrigir_email_quase_gmail(bruto)
        if corrigido:
            out[campo_email] = corrigido
            mudancas.append(f"{campo_email}: corrigido gmail")
            continue

        tel_principal, tel_extras = sanitizar_telefone_compras(bruto)
        if tel_principal:
            if not _txt(out.get("telefone")):
                out["telefone"] = tel_principal
                mudancas.append(f"{campo_email}->telefone")
                if tel_extras:
                    extras_txt = " / ".join(formatar_telefone_compras(t) for t in tel_extras)
                    out["observacao"] = _anexar_obs(out.get("observacao"), f"Tel. adicional: {extras_txt}")
            out[campo_email] = None
            mudancas.append(f"{campo_email}: limpo (era telefone)")
            continue

        endereco = _parse_endereco(bruto)
        if endereco and endereco.logradouro:
            if not _txt(out.get("logradouro")):
                out["logradouro"] = endereco.logradouro
                mudancas.append(f"{campo_email}->logradouro")
            if endereco.numero and not _txt(out.get("numero")):
                out["numero"] = endereco.numero
            if endereco.bairro and not _txt(out.get("bairro")):
                out["bairro"] = endereco.bairro
            out[campo_email] = None
            mudancas.append(f"{campo_email}: limpo (era endereço)")
            continue

        if _parece_site(bruto):
            out["observacao"] = _anexar_obs(out.get("observacao"), f"Site: {bruto}")
            out[campo_email] = None
            mudancas.append(f"{campo_email}: limpo (era site)")
            continue

        # Localidade solta (ex.: CARAPICUIBA, Brás) antes de nome de pessoa
        if (
            len(bruto) <= 40
            and _RE_SO_LETRAS.match(bruto)
            and " " not in bruto.strip()
            and not any(p in bruto.upper() for p in ("PEDIDO", "WHATS", "SOMENTE", "APENAS"))
        ):
            if not _txt(out.get("bairro")):
                out["bairro"] = bruto
                mudancas.append(f"{campo_email}->bairro")
            elif not _txt(out.get("cidade")):
                out["cidade"] = bruto
                mudancas.append(f"{campo_email}->cidade")
            else:
                out["observacao"] = _anexar_obs(out.get("observacao"), bruto)
            out[campo_email] = None
            mudancas.append(f"{campo_email}: limpo (era localidade)")
            continue

        if _parece_nome_pessoa(bruto) and " " in bruto:
            if not _txt(out.get("contato")):
                out["contato"] = bruto
                mudancas.append(f"{campo_email}->contato")
            else:
                out["observacao"] = _anexar_obs(out.get("observacao"), bruto)
            out[campo_email] = None
            mudancas.append(f"{campo_email}: limpo (era nome/texto)")
            continue

        out["observacao"] = _anexar_obs(out.get("observacao"), bruto)
        out[campo_email] = None
        mudancas.append(f"{campo_email}: limpo (texto livre -> obs)")

    telefone_bruto = _txt(out.get("telefone"))
    if telefone_bruto:
        tel_principal, tel_extras = sanitizar_telefone_compras(telefone_bruto)
        if not tel_principal:
            digitos = re.sub(r"\D", "", telefone_bruto)
            if len(digitos) >= 11 and digitos[2] == "9":
                tel_principal = digitos[:11]
                tel_extras = []
            elif len(digitos) >= 10:
                tel_principal = digitos[:10]
                tel_extras = []
            else:
                tel_principal = None
            if tel_principal:
                resto = digitos[len(tel_principal):]
                mudancas.append("telefone: truncado para padrão")
                if resto:
                    out["observacao"] = _anexar_obs(
                        out.get("observacao"),
                        f"Tel. adicional (legado): {resto}",
                    )
        if tel_principal:
            out["telefone"] = tel_principal
            if tel_extras:
                extras_txt = " / ".join(formatar_telefone_compras(t) for t in tel_extras)
                out["observacao"] = _anexar_obs(out.get("observacao"), f"Tel. adicional: {extras_txt}")
        else:
            if _parece_nome_pessoa(telefone_bruto) or "/" in telefone_bruto:
                out["observacao"] = _anexar_obs(out.get("observacao"), f"Contato legado: {telefone_bruto}")
            out["telefone"] = None
            mudancas.append("telefone: limpo (inválido)")

    cep_digitos = re.sub(r"\D", "", _txt(out.get("cep")))
    if cep_digitos:
        if len(cep_digitos) == 8:
            out["cep"] = cep_digitos
        else:
            out["cep"] = None
            mudancas.append("cep: limpo (inválido)")
    else:
        out["cep"] = None

    for campo in ("email", "email_empresa", "telefone", "contato", "logradouro", "numero", "bairro", "cidade", "observacao"):
        if campo in out and out[campo] is not None and not _txt(out[campo]):
            out[campo] = None

    return out, mudancas
