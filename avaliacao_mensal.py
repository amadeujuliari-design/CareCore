"""Avaliação mensal das Vilas Reencontro — regras sem acesso a banco."""

from __future__ import annotations

from datetime import datetime

VILAS = (
    {
        "codigo": "anhangabau",
        "rotulo": "Vila Reencontro Anhangabaú",
        "rotulo_escolha": "VILA REENCONTRO ANHANGABAÚ",
        "marcador": "reencontro anhangabau",
    },
    {
        "codigo": "cruzeiro",
        "rotulo": "Vila Reencontro Cruzeiro do Sul",
        "rotulo_escolha": "VILA REENCONTRO CRUZEIRO DO SUL",
        "marcador": "reencontro cruzeiro do sul",
    },
    {
        "codigo": "jabaquara",
        "rotulo": "Vila Reencontro Jabaquara",
        "rotulo_escolha": "VILA REENCONTRO JABAQUARA",
        "marcador": "reencontro jabaquara",
    },
    {
        "codigo": "pari",
        "rotulo": "Vila Reencontro Pari",
        "rotulo_escolha": "VILA REENCONTRO PARI",
        "marcador": "reencontro pari",
    },
)

OPCOES_VILA = (
    ("otimo", "Ótimo"),
    ("bom", "Bom"),
    ("mais_ou_menos", "Mais ou menos"),
    ("ruim", "Ruim"),
)

OPCOES_PESSOA = (
    ("otimo", "Ótimo"),
    ("mais_ou_menos", "Mais ou menos"),
    ("preciso_melhorar", "Preciso melhorar"),
    ("ruim", "Ruim"),
)

_TEMAS_VILA = (
    ("alimentacao", "a alimentação"),
    ("horario_refeicoes", "o horário das refeições"),
    ("modulos", "os módulos"),
    ("acolhida", "a acolhida e a abordagem"),
    ("equipe_tecnica", "a equipe técnica"),
    ("assistentes_campo", "os assistentes de campo"),
    ("supervisao", "a supervisão e a coordenação"),
    ("termos", "os termos e as informações"),
    ("encaminhamentos", "os encaminhamentos"),
    ("atividades", "as atividades e oficinas"),
    ("capelania", "a capelania"),
)

_TEMAS_PESSOA = (
    ("cogestao", "sua participação na cogestão"),
    ("participacao_atividades", "sua participação nas atividades e eventos"),
    ("higienizacao", "seus cuidados com a higienização e a organização do módulo"),
    ("convivio", "seu convívio com os vizinhos"),
    ("respeito_equipe", "seu respeito com a equipe"),
    ("respeito_regras", "seu respeito com as regras do serviço"),
    ("respeito_orientacoes", "seu respeito com as orientações recebidas"),
)

_MESES = (
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
)

SUGESTOES_MAX = 2000


def vila_por_codigo(codigo: str) -> dict | None:
    chave = (codigo or "").strip().lower()
    for vila in VILAS:
        if vila["codigo"] == chave:
            return vila
    return None


def competencia_de(momento: datetime) -> str:
    return f"{momento.year:04d}-{momento.month:02d}"


def competencia_seguinte(competencia: str) -> str:
    ano, mes = (int(parte) for parte in competencia.split("-"))
    if mes == 12:
        return f"{ano + 1:04d}-01"
    return f"{ano:04d}-{mes + 1:02d}"


def rotulo_competencia(competencia: str) -> str:
    ano, mes = competencia.split("-")
    return f"{_MESES[int(mes) - 1]} de {ano}"


def mensagem_agradecimento(rotulo_vila: str) -> str:
    vila = (rotulo_vila or "vila").strip()
    return (
        f"Sua avaliação é muito importante para nós. "
        f"Com ela, vamos trabalhar para tornar a {vila} ainda melhor para você e sua família.\n\n"
        f"A {vila} agradece a sua participação."
    )


def mensagem_ja_respondida(competencia: str) -> str:
    atual = rotulo_competencia(competencia)
    proxima = rotulo_competencia(competencia_seguinte(competencia))
    return (
        f"Este formulário já foi respondido por você em {atual}. "
        f"Volte em {proxima} para uma nova avaliação."
    )


def _opcoes(pares: tuple[tuple[str, str], ...]) -> list[dict]:
    return [{"id": codigo, "rotulo": rotulo} for codigo, rotulo in pares]


def perguntas_da_vila(rotulo_vila: str) -> list[dict]:
    vila = (rotulo_vila or "").strip()
    perguntas = []
    for codigo, tema in _TEMAS_VILA:
        perguntas.append(
            {
                "id": codigo,
                "grupo": "vila",
                "texto": f"Como você avalia {tema} da {vila}?",
                "opcoes": _opcoes(OPCOES_VILA),
            }
        )
    for codigo, tema in _TEMAS_PESSOA:
        perguntas.append(
            {
                "id": codigo,
                "grupo": "pessoa",
                "texto": f"Como você avalia {tema}?",
                "opcoes": _opcoes(OPCOES_PESSOA),
            }
        )
    return perguntas


def ids_perguntas() -> tuple[str, ...]:
    return tuple(item[0] for item in _TEMAS_VILA + _TEMAS_PESSOA)


def opcoes_validas(pergunta_id: str) -> set[str]:
    temas_vila = {codigo for codigo, _tema in _TEMAS_VILA}
    if pergunta_id in temas_vila:
        return {codigo for codigo, _rotulo in OPCOES_VILA}
    return {codigo for codigo, _rotulo in OPCOES_PESSOA}


def validar_respostas(respostas: dict | None) -> str | None:
    if not isinstance(respostas, dict):
        return "Responda todas as perguntas."
    for pergunta_id in ids_perguntas():
        valor = str(respostas.get(pergunta_id) or "").strip()
        if valor not in opcoes_validas(pergunta_id):
            return "Responda todas as perguntas antes de enviar."
    extras = set(respostas) - set(ids_perguntas())
    if extras:
        return "Há uma resposta que não faz parte desta avaliação."
    return None


def normalizar_sugestoes(texto: str | None) -> str:
    limpo = " ".join((texto or "").split())
    return limpo[:SUGESTOES_MAX]
