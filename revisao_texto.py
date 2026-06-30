# =====================================================================
# Revisão de texto institucional via Gemini (avisos, ocorrências)
# =====================================================================
from __future__ import annotations

import json
import logging
import os
import re
import urllib.error
import urllib.request
from typing import Any

from config_utils import env_int
from security import usuario_pode_ver_texto_original
from time_operacional import agora_operacional_naive

logger = logging.getLogger("carecore.revisao_texto")

PROMPT_SISTEMA = """Você é um revisor de textos institucionais de uma organização assistencial brasileira (avisos, ocorrências e relatos operacionais).

Sua tarefa é melhorar a redação do TÍTULO e do TEXTO fornecidos, em português do Brasil, SEM alterar o sentido, os fatos ou a gravidade do relato.

Regras obrigatórias:
- Corrija ortografia, acentuação, pontuação e espaços indevidos.
- Corrija erros comuns de português brasileiro, inclusive grafias com X (ex.: "chingamento/chingamentos" → "xingamento/xingamentos"; "chingou" → "xingou"; "chingar" → "xingar").
- Capitalização: use primeira letra maiúscula e demais minúsculas em título e corpo.
- Preserve siglas e acrônimos em MAIÚSCULAS quando for uso convencional (ex.: SP, LGBT, CPF, SIAT, AEB, RH).
- Preserve a capitalização correta de nomes próprios de pessoas, instituições e locais.
- Não use CAIXA ALTA em palavras inteiras, salvo siglas/acrônimos.
- Melhore clareza e fluência com o mínimo de mudanças possível.
- NÃO invente, omita ou interprete fatos que não estejam no texto original.
- NÃO acrescente julgamentos, diagnósticos, causas ou consequências não mencionadas.
- Preserve nomes próprios, prontuários, siglas, horários, datas, locais e termos técnicos (apenas corrija erro óbvio de digitação se houver).
- Mantenha tom profissional, objetivo e neutro, adequado a registro institucional.
- Não expanda o texto em mais de 20% do tamanho original.
- Se titulo ou texto vier vazio, devolva string vazia nesse campo.
- Se o texto já estiver adequado, devolva-o com correções mínimas ou iguais ao original.

Formato de resposta: APENAS um JSON válido, sem markdown, sem explicações, no formato:
{"titulo": "...", "texto": "..."}"""


def limite_mensal_revisao_texto() -> int:
    return env_int("REVISAO_TEXTO_LIMITE_MENSAL", 100, minimo=0)


def gemini_configurado() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


def _modelo_gemini() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"


def _extrair_json_resposta(conteudo: str) -> dict[str, str]:
    texto = (conteudo or "").strip()
    if not texto:
        raise ValueError("Resposta vazia da IA.")

    try:
        dados = json.loads(texto)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", texto)
        if not match:
            raise ValueError("Não foi possível interpretar a resposta da IA.")
        dados = json.loads(match.group(0))

    if not isinstance(dados, dict):
        raise ValueError("Formato de resposta inválido.")

    titulo = str(dados.get("titulo", "") or "").strip()
    corpo = str(dados.get("texto", "") or "").strip()
    return {"titulo": titulo, "texto": corpo}


def chamar_gemini_revisar_texto(titulo: str, texto: str) -> dict[str, str]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Revisão de texto indisponível: GEMINI_API_KEY não configurada.")

    modelo = _modelo_gemini()
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent"
        f"?key={api_key}"
    )

    entrada = json.dumps({"titulo": titulo or "", "texto": texto or ""}, ensure_ascii=False)
    payload = {
        "systemInstruction": {"parts": [{"text": PROMPT_SISTEMA}]},
        "contents": [{"parts": [{"text": entrada}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            corpo_resposta = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detalhe = exc.read().decode("utf-8", errors="replace")[:800]
        logger.warning("Gemini HTTP %s: %s", exc.code, detalhe)
        if exc.code == 429:
            raise ValueError(
                "Cota gratuita do Gemini esgotada para este modelo. "
                "Tente mais tarde ou ajuste GEMINI_MODEL no .env."
            ) from exc
        if exc.code in {401, 403}:
            raise ValueError(
                "Chave GEMINI_API_KEY inválida ou sem permissão. "
                "Gere uma nova chave no Google AI Studio."
            ) from exc
        raise ValueError("Serviço de revisão temporariamente indisponível.") from exc
    except urllib.error.URLError as exc:
        logger.warning("Gemini URLError: %s", exc)
        raise ValueError("Não foi possível contactar o serviço de revisão.") from exc

    try:
        resposta_api = json.loads(corpo_resposta)
        candidatos = resposta_api.get("candidates") or []
        if not candidatos:
            raise ValueError("IA não retornou sugestão.")
        parts = (candidatos[0].get("content") or {}).get("parts") or []
        texto_resposta = "".join(str(part.get("text", "")) for part in parts)
        return aplicar_correcoes_ortografia_frequente(_extrair_json_resposta(texto_resposta))
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        logger.warning("Falha ao parsear resposta Gemini: %s", exc)
        raise ValueError("Resposta da IA em formato inesperado.") from exc


def referencia_mes_operacional() -> tuple[int, int]:
    agora = agora_operacional_naive()
    return agora.year, agora.month


_CORRECOES_ORTOGRAFIA_FREQUENTE = (
    (re.compile(r"\bchingamentos\b", re.IGNORECASE), "xingamentos"),
    (re.compile(r"\bchingamento\b", re.IGNORECASE), "xingamento"),
    (re.compile(r"\bchingando\b", re.IGNORECASE), "xingando"),
    (re.compile(r"\bchingou\b", re.IGNORECASE), "xingou"),
    (re.compile(r"\bchingar\b", re.IGNORECASE), "xingar"),
    (re.compile(r"\bchingada\b", re.IGNORECASE), "xingada"),
    (re.compile(r"\bchingado\b", re.IGNORECASE), "xingado"),
    (re.compile(r"\bchingadas\b", re.IGNORECASE), "xingadas"),
    (re.compile(r"\bchingados\b", re.IGNORECASE), "xingados"),
)


def _preservar_caixa(original: str, substituto: str) -> str:
    if original.isupper():
        return substituto.upper()
    if original[:1].isupper():
        return substituto[:1].upper() + substituto[1:]
    return substituto


def corrigir_ortografia_frequente(texto: str) -> str:
    if not texto:
        return texto

    resultado = texto
    for padrao, substituto in _CORRECOES_ORTOGRAFIA_FREQUENTE:
        resultado = padrao.sub(
            lambda match, subst=substituto: _preservar_caixa(match.group(0), subst),
            resultado,
        )
    return resultado


def aplicar_correcoes_ortografia_frequente(resultado: dict[str, str]) -> dict[str, str]:
    return {
        "titulo": corrigir_ortografia_frequente(resultado.get("titulo", "") or ""),
        "texto": corrigir_ortografia_frequente(resultado.get("texto", "") or ""),
    }


CAMPOS_ORIGINAL_OCORRENCIA = ("motivo_original", "descricao_original")
CAMPOS_ORIGINAL_INTERACAO = ("mensagem_original",)
CAMPOS_ORIGINAL_AVISO = ("titulo_original", "mensagem_original")


def sanitizar_ocorrencia_para_usuario(ocorrencia: dict[str, Any], usuario_atual: dict) -> dict[str, Any]:
    if usuario_pode_ver_texto_original(usuario_atual):
        return ocorrencia

    for campo in CAMPOS_ORIGINAL_OCORRENCIA:
        ocorrencia.pop(campo, None)

    interacoes = ocorrencia.get("interacoes")
    if isinstance(interacoes, list):
        for interacao in interacoes:
            if isinstance(interacao, dict):
                for campo in CAMPOS_ORIGINAL_INTERACAO:
                    interacao.pop(campo, None)

    return ocorrencia


def sanitizar_ocorrencias_para_usuario(
    ocorrencias: list[dict[str, Any]],
    usuario_atual: dict,
) -> list[dict[str, Any]]:
    return [sanitizar_ocorrencia_para_usuario(dict(oc), usuario_atual) for oc in ocorrencias]


def sanitizar_aviso_para_usuario(aviso: dict[str, Any], usuario_atual: dict) -> dict[str, Any]:
    if usuario_pode_ver_texto_original(usuario_atual):
        return aviso

    for campo in CAMPOS_ORIGINAL_AVISO:
        aviso.pop(campo, None)

    return aviso
