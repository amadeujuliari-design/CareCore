"""Montagem do kit mensal a partir da idade e do sexo já gravados na ficha."""
from __future__ import annotations

from datetime import date

PERFIS_PADRAO = (
    {"ordem": 1, "nome": "Bebê", "idade_min": 0, "idade_max": 1, "sexo": "qualquer"},
    {"ordem": 2, "nome": "Criança", "idade_min": 2, "idade_max": 10, "sexo": "qualquer"},
    {"ordem": 3, "nome": "Adolescente masculino", "idade_min": 11, "idade_max": 16, "sexo": "masculino"},
    {"ordem": 4, "nome": "Adolescente feminino", "idade_min": 11, "idade_max": 16, "sexo": "feminino"},
    {"ordem": 5, "nome": "Homem", "idade_min": 17, "idade_max": None, "sexo": "masculino"},
    {"ordem": 6, "nome": "Mulher", "idade_min": 17, "idade_max": None, "sexo": "feminino"},
)

SEXOS_PERFIL = ("qualquer", "masculino", "feminino")
_TETO_ABERTO = 200

# Complementos do Cruzeiro do Sul. A faixa é em meses completos, inclusive.
# Fralda até completar 3 anos, sabonete até completar 2, leite dos 6 meses até completar 6.
COMPLEMENTOS_CRUZEIRO = (
    {
        "ordem": 20,
        "nome": "Fralda",
        "papel": "complemento",
        "gatilho": "idade",
        "idade_min_meses": 0,
        "idade_max_meses": 35,
        "sexo": "qualquer",
        "descricao": "Até completar 3 anos",
        "item": "Fralda",
    },
    {
        "ordem": 21,
        "nome": "Sabonete infantil",
        "papel": "complemento",
        "gatilho": "idade",
        "idade_min_meses": 0,
        "idade_max_meses": 23,
        "sexo": "qualquer",
        "descricao": "Até completar 2 anos",
        "item": "Sabonete infantil",
    },
    {
        "ordem": 22,
        "nome": "Leite",
        "papel": "complemento",
        "gatilho": "idade",
        "idade_min_meses": 6,
        "idade_max_meses": 71,
        "sexo": "qualquer",
        "descricao": "Dos 6 meses até completar 6 anos",
        "item": "Leite",
    },
    {
        "ordem": 23,
        "nome": "Absorvente íntimo",
        "papel": "complemento",
        "gatilho": "flag",
        "idade_min_meses": None,
        "idade_max_meses": None,
        "sexo": "feminino",
        "descricao": "Absorvente íntimo",
        "item": "Absorvente",
    },
)


def normalizar_sexo(valor: str | None) -> str | None:
    texto = (valor or "").strip().casefold()
    if not texto:
        return None
    if "mulher" in texto or texto.startswith("fem") or texto == "f":
        return "feminino"
    if "homem" in texto or texto.startswith("masc") or texto in {"m", "menino"}:
        return "masculino"
    return None


def idade_em(nascimento: date | None, hoje: date) -> int | None:
    if not nascimento:
        return None
    return hoje.year - nascimento.year - ((hoje.month, hoje.day) < (nascimento.month, nascimento.day))


def idade_meses(nascimento: date | None, hoje: date) -> int | None:
    if not nascimento:
        return None
    meses = (hoje.year - nascimento.year) * 12 + (hoje.month - nascimento.month)
    if hoje.day < nascimento.day:
        meses -= 1
    return meses


def descricao_faixa(idade_min: int, idade_max: int | None, sexo: str) -> str:
    if idade_max is None:
        faixa = f"{idade_min} anos ou mais"
    elif idade_min == idade_max:
        faixa = f"{idade_min} ano" if idade_min == 1 else f"{idade_min} anos"
    elif idade_max == 1:
        faixa = f"{idade_min} a 1 ano"
    else:
        faixa = f"{idade_min} a {idade_max} anos"
    sexo_rotulo = {"masculino": "masculino", "feminino": "feminino"}.get(sexo, "qualquer sexo")
    return f"{faixa} · {sexo_rotulo}"


def _teto(perfil: dict) -> int:
    teto = perfil.get("idade_max")
    return _TETO_ABERTO if teto is None else int(teto)


def _sexos(perfil: dict) -> set[str]:
    sexo = perfil.get("sexo")
    if sexo == "qualquer":
        return {"masculino", "feminino"}
    if sexo in {"masculino", "feminino"}:
        return {sexo}
    return set()


def faixa_cruza(esquerda: dict, direita: dict) -> bool:
    if esquerda.get("idade_min") is None or direita.get("idade_min") is None:
        return False
    if _teto(esquerda) < int(direita["idade_min"]) or _teto(direita) < int(esquerda["idade_min"]):
        return False
    return bool(_sexos(esquerda) & _sexos(direita))


def papel_do_perfil(perfil: dict) -> str:
    return perfil.get("papel") or "base"


def complemento_aplica(perfil: dict, meses: int | None, sexo: str | None, menstrua: bool) -> bool:
    if not perfil.get("ativo", True) or papel_do_perfil(perfil) != "complemento":
        return False
    sexo_perfil = perfil.get("sexo") or "qualquer"
    if sexo_perfil not in {"qualquer", ""} and sexo_perfil != sexo:
        return False
    if perfil.get("gatilho") == "flag":
        return bool(menstrua)
    if meses is None or perfil.get("idade_min_meses") is None:
        return False
    if meses < int(perfil["idade_min_meses"]):
        return False
    teto = perfil.get("idade_max_meses")
    if teto is not None and meses > int(teto):
        return False
    return True


def perfil_compativel(perfil: dict, idade: int, sexo: str | None) -> bool:
    if perfil.get("idade_min") is None or not perfil.get("ativo", True):
        return False
    if idade < int(perfil["idade_min"]) or idade > _teto(perfil):
        return False
    if perfil.get("sexo") == "qualquer":
        return True
    return bool(sexo) and perfil.get("sexo") == sexo


def _somar_perfil(grupos, totais, regras_por_tipo, item_por_id, perfil, nome) -> None:
    grupo = grupos.setdefault(
        perfil["id"],
        {"perfil": perfil["nome"], "ordem": perfil.get("ordem") or 0, "pessoas": []},
    )
    grupo["pessoas"].append(nome)
    for regra in regras_por_tipo.get(perfil["id"], []):
        item = item_por_id.get(regra["item_id"])
        if not item:
            continue
        totais[item["nome"]] = totais.get(item["nome"], 0) + int(regra["quantidade"] or 0)


def montar_kit(
    pessoas: list[dict],
    perfis: list[dict],
    regras: list[dict],
    itens: list[dict],
    hoje: date,
    somar_complementos: bool = False,
    itens_familia: list[dict] | None = None,
) -> dict:
    ativos = [
        perfil for perfil in perfis
        if perfil.get("ativo", True)
        and perfil.get("idade_min") is not None
        and papel_do_perfil(perfil) != "complemento"
    ]
    complementos = [
        perfil for perfil in perfis
        if somar_complementos and papel_do_perfil(perfil) == "complemento" and perfil.get("ativo", True)
    ]
    item_por_id = {item["id"]: item for item in itens if item.get("ativo", True)}
    regras_por_tipo: dict[str, list[dict]] = {}
    for regra in regras:
        regras_por_tipo.setdefault(regra["tipo_id"], []).append(regra)

    totais: dict[str, int] = {}
    grupos: dict[str, dict] = {}
    pendencias = []
    for item in itens_familia or []:
        nome_item = (item.get("nome") or "").strip()
        quantidade = int(item.get("quantidade") or 0)
        if nome_item and quantidade > 0:
            totais[nome_item] = totais.get(nome_item, 0) + quantidade

    for pessoa in pessoas:
        nome = (pessoa.get("nome") or "Acolhido").strip() or "Acolhido"
        idade = idade_em(pessoa.get("nascimento"), hoje)
        if idade is None:
            pendencias.append({"nome": nome, "motivo": "Sem data de nascimento"})
            continue
        sexo = normalizar_sexo(pessoa.get("sexo"))
        compativeis = [perfil for perfil in ativos if perfil_compativel(perfil, idade, sexo)]
        if len(compativeis) > 1:
            pendencias.append({"nome": nome, "motivo": "A idade cabe em mais de um perfil"})
            continue
        if not compativeis:
            na_faixa = [
                perfil for perfil in ativos
                if int(perfil["idade_min"]) <= idade <= _teto(perfil)
            ]
            if na_faixa and not sexo:
                pendencias.append({"nome": nome, "motivo": "Sem sexo"})
            else:
                pendencias.append({"nome": nome, "motivo": "Sem perfil para esta idade"})
            continue
        perfil = compativeis[0]
        _somar_perfil(grupos, totais, regras_por_tipo, item_por_id, perfil, nome)
        if complementos:
            meses = idade_meses(pessoa.get("nascimento"), hoje)
            for complemento in complementos:
                if complemento_aplica(complemento, meses, sexo, bool(pessoa.get("menstrua"))):
                    _somar_perfil(grupos, totais, regras_por_tipo, item_por_id, complemento, nome)

    composicao = [{"nome": nome, "quantidade": quantidade} for nome, quantidade in sorted(totais.items())]
    return {
        "composicao": composicao,
        "grupos": [
            {"perfil": grupo["perfil"], "pessoas": grupo["pessoas"]}
            for grupo in sorted(grupos.values(), key=lambda item: (item["ordem"], item["perfil"]))
        ],
        "pendencias": pendencias,
        "completo": not pendencias and bool(composicao),
    }
