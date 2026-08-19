"""Regras do modulo Compras (sem I/O). Fuso operacional = dias de America/Sao_Paulo."""

from __future__ import annotations

from datetime import date, datetime, timedelta
import re
import unicodedata
from typing import Optional

TIPO_CONSUMO = "consumo"
TIPO_IMOBILIZADO = "imobilizado"
TIPOS_PEDIDO = (TIPO_CONSUMO, TIPO_IMOBILIZADO)

STATUS_RASCUNHO = "rascunho"
STATUS_AGUARDANDO_COTACAO = "aguardando_cotacao"
STATUS_EM_COTACAO = "em_cotacao"
STATUS_AGUARDANDO_UNIDADE = "aguardando_aprovacao_unidade"
STATUS_AGUARDANDO_SEDE = "aguardando_aprovacao_sede"
STATUS_APROVADO = "aprovado"
STATUS_ENVIADO = "enviado_fornecedor"
STATUS_RECEBIDO = "recebido"
STATUS_CANCELADO = "cancelado"
STATUS_REPROVADO = "reprovado"

TIPO_ANEXO_ORCAMENTO = "orcamento"
TIPO_ANEXO_PEDIDO_PDF = "pedido_compra"
TIPO_ANEXO_NF_XML = "nf_xml"
TIPO_ANEXO_NF_PDF = "nf_pdf"
TIPO_ANEXO_RESPOSTA_FORNECEDOR = "resposta_fornecedor"

TIPOS_ANEXO_PEDIDO = {
    TIPO_ANEXO_ORCAMENTO,
    TIPO_ANEXO_PEDIDO_PDF,
    TIPO_ANEXO_NF_XML,
    TIPO_ANEXO_NF_PDF,
    TIPO_ANEXO_RESPOSTA_FORNECEDOR,
}

TIPO_EVENTO_PARECER = "parecer"
TIPO_EVENTO_NEGATIVA = "negativa"
TIPO_EVENTO_OBSERVACAO = "observacao"
TIPO_EVENTO_STATUS = "status"
TIPO_EVENTO_ANEXO = "anexo"
TIPO_EVENTO_EMAIL = "email"

TIPOS_EVENTO_PEDIDO = {
    TIPO_EVENTO_PARECER,
    TIPO_EVENTO_NEGATIVA,
    TIPO_EVENTO_OBSERVACAO,
    TIPO_EVENTO_STATUS,
    TIPO_EVENTO_ANEXO,
    TIPO_EVENTO_EMAIL,
}

MIN_COTACOES_RECOMENDADAS = 3

STATUS_TERMINAIS_PEDIDO = {STATUS_RECEBIDO, STATUS_CANCELADO, STATUS_REPROVADO}

ESCOPO_PROJETO = "projeto"
ESCOPO_SEDE = "sede"
ESCOPOS_UNIDADE = (ESCOPO_PROJETO, ESCOPO_SEDE)

PERFIS_PROJETO_ELEGIVEIS = frozenset({"Gestor", "Técnico", "Administrativo"})
PERFIL_ADM_COMPRAS = "ADM Global Compras"
PERFIL_ADM_PEDIDOS = "ADM Pedidos"

CATEGORIAS_PADRAO = (
    "Alimentação",
    "Carne",
    "Peixe",
    "Higiene e limpeza",
    "Higiene pessoal",
    "EPI",
    "Pedagógico",
    "Escritório",
    "Cozinha",
    "Manutenção",
    "Cama e banho",
    "Infraestrutura",
    "Outros",
)

FONTES_PADRAO = (
    "Convênio",
    "Emenda parlamentar",
    "Custo indireto",
    "Recurso próprio",
    "Doação",
    "Outros",
)

FONTE_TIPO_CONVENIO = "convenio"
FONTE_TIPO_EMENDA = "emenda"
FONTE_TIPO_CUSTO_INDIRETO = "custo_indireto"
FONTE_TIPO_PROPRIO = "proprio"
FONTE_TIPO_DOACAO = "doacao"
FONTE_TIPO_OUTROS = "outros"
FONTES_TIPOS = (
    FONTE_TIPO_CONVENIO,
    FONTE_TIPO_EMENDA,
    FONTE_TIPO_CUSTO_INDIRETO,
    FONTE_TIPO_PROPRIO,
    FONTE_TIPO_DOACAO,
    FONTE_TIPO_OUTROS,
)
CATEGORIAS_PERECIVEIS = frozenset({"alimentação", "alimentacao", "carne", "peixe"})

PATRIMONIO_PROPRIEDADE_AEB = "aeb"
PATRIMONIO_PROPRIEDADE_PUBLICO = "publico"
PATRIMONIO_PROPRIEDADES = (PATRIMONIO_PROPRIEDADE_AEB, PATRIMONIO_PROPRIEDADE_PUBLICO)

PATRIMONIO_ORIGEM_COMPRA = "compra"
PATRIMONIO_ORIGEM_DOACAO = "doacao"
PATRIMONIO_ORIGEM_INVENTARIO = "inventario"
PATRIMONIO_ORIGEM_OUTROS = "outros"
PATRIMONIO_ORIGENS = (
    PATRIMONIO_ORIGEM_COMPRA,
    PATRIMONIO_ORIGEM_DOACAO,
    PATRIMONIO_ORIGEM_INVENTARIO,
    PATRIMONIO_ORIGEM_OUTROS,
)

PATRIMONIO_SITUACAO_BOM = "bom"
PATRIMONIO_SITUACAO_REGULAR = "regular"
PATRIMONIO_SITUACAO_RUIM = "ruim"
PATRIMONIO_SITUACAO_MANUTENCAO = "manutencao"
PATRIMONIO_SITUACAO_BAIXADO = "baixado"
PATRIMONIO_SITUACOES = (
    PATRIMONIO_SITUACAO_BOM,
    PATRIMONIO_SITUACAO_REGULAR,
    PATRIMONIO_SITUACAO_RUIM,
    PATRIMONIO_SITUACAO_MANUTENCAO,
    PATRIMONIO_SITUACAO_BAIXADO,
)


def normalizar_competencia(valor: str) -> str:
    texto = (valor or "").strip()
    if len(texto) == 7 and texto[4] == "-":
        ano, mes = texto.split("-", 1)
        if ano.isdigit() and mes.isdigit() and 1 <= int(mes) <= 12:
            return f"{int(ano):04d}-{int(mes):02d}"
    raise ValueError("Competência inválida. Use AAAA-MM.")


def competencia_de_data(dia: date) -> str:
    return f"{dia.year:04d}-{dia.month:02d}"


def data_operacional(agora: Optional[datetime] = None) -> date:
    if agora is None:
        from time_operacional import agora_operacional_naive

        agora = agora_operacional_naive()
    return agora.date() if isinstance(agora, datetime) else agora


# Cartaz institucional AEB 2026 (aba CALENDARIO / Período de compras).
PERIODO_COMPRAS_2026: dict[int, tuple[date, date]] = {
    1: (date(2026, 1, 12), date(2026, 1, 16)),
    2: (date(2026, 2, 9), date(2026, 2, 13)),
    3: (date(2026, 3, 16), date(2026, 3, 20)),
    4: (date(2026, 4, 13), date(2026, 4, 17)),
    5: (date(2026, 5, 11), date(2026, 5, 15)),
    6: (date(2026, 6, 15), date(2026, 6, 19)),
    7: (date(2026, 7, 13), date(2026, 7, 17)),
    8: (date(2026, 8, 10), date(2026, 8, 14)),
    9: (date(2026, 9, 14), date(2026, 9, 18)),
    10: (date(2026, 10, 12), date(2026, 10, 16)),
    11: (date(2026, 11, 9), date(2026, 11, 13)),
    12: (date(2026, 12, 7), date(2026, 12, 11)),
}

STATUS_JANELA_FUTURA = "futura"
STATUS_JANELA_ABERTA = "aberta"
STATUS_JANELA_ENCERRADA = "encerrada"


def janela_consumo_aberta(
    *,
    hoje: date,
    data_inicio: Optional[date],
    data_fim: Optional[date],
    liberacao_projeto: bool = False,
) -> bool:
    if liberacao_projeto:
        return True
    if data_inicio is None or data_fim is None:
        return False
    if data_fim < data_inicio:
        return False
    return data_inicio <= hoje <= data_fim


def dias_da_janela(data_inicio: Optional[date], data_fim: Optional[date]) -> list[date]:
    if data_inicio is None or data_fim is None or data_fim < data_inicio:
        return []
    dias: list[date] = []
    atual = data_inicio
    while atual <= data_fim:
        dias.append(atual)
        atual += timedelta(days=1)
    return dias


def dias_liberados_janela(data_inicio: Optional[date], data_fim: Optional[date]) -> list[date]:
    """Dias úteis (seg–sex) entre início e fim — finais de semana não entram no calendário."""
    return [dia for dia in dias_da_janela(data_inicio, data_fim) if dia.weekday() < 5]


def _ultimo_dia_mes(ano: int, mes: int) -> int:
    if mes == 12:
        return 31
    return (date(ano, mes + 1, 1) - timedelta(days=1)).day


def periodo_semana_util_mes(ano: int, mes: int, numero_semana: int) -> tuple[date, date]:
    """1ª–4ª semana civil do mês (1–7, 8–14, 15–21, 22–fim), só dias úteis seg–sex."""
    semana = int(numero_semana)
    if semana not in (1, 2, 3, 4):
        raise ValueError("Semana deve ser 1, 2, 3 ou 4.")
    ultimo = _ultimo_dia_mes(int(ano), int(mes))
    blocos = {1: (1, 7), 2: (8, 14), 3: (15, 21), 4: (22, ultimo)}
    dia_ini, dia_fim = blocos[semana]
    uteis = [
        date(int(ano), int(mes), dia)
        for dia in range(dia_ini, dia_fim + 1)
        if date(int(ano), int(mes), dia).weekday() < 5
    ]
    if not uteis:
        raise ValueError(f"Não há dias úteis na {semana}ª semana de {mes:02d}/{ano}.")
    return uteis[0], uteis[-1]


def detectar_semana_util(competencia: str, data_inicio: date, data_fim: date) -> Optional[int]:
    competencia_n = normalizar_competencia(competencia)
    ano, mes = map(int, competencia_n.split("-"))
    for numero in (1, 2, 3, 4):
        try:
            inicio, fim = periodo_semana_util_mes(ano, mes, numero)
        except ValueError:
            continue
        if inicio == data_inicio and fim == data_fim:
            return numero
    return None


def status_janela(*, hoje: date, data_inicio: Optional[date], data_fim: Optional[date]) -> str:
    if data_inicio is None or data_fim is None:
        return STATUS_JANELA_ENCERRADA
    if hoje < data_inicio:
        return STATUS_JANELA_FUTURA
    if hoje > data_fim:
        return STATUS_JANELA_ENCERRADA
    return STATUS_JANELA_ABERTA


def validar_periodo_janela(*, competencia: str, data_inicio: date, data_fim: date) -> None:
    if data_fim < data_inicio:
        raise ValueError("A data final não pode ser anterior à inicial.")
    competencia_n = normalizar_competencia(competencia)
    if competencia_de_data(data_inicio) != competencia_n or competencia_de_data(data_fim) != competencia_n:
        raise ValueError("Início e fim precisam ser dias do mês da competência selecionada.")


def pode_criar_rascunho_consumo(
    *,
    hoje: date,
    data_inicio: Optional[date],
    data_fim: Optional[date],
    data_prevista: Optional[date],
    liberacao_projeto: bool = False,
) -> tuple[bool, str]:
    if data_prevista is None:
        return False, "Escolha no calendário o dia liberado para este rascunho."
    if data_prevista < hoje:
        return False, "Este dia já passou. Escolha um dia liberado ainda disponível."
    if data_inicio is None or data_fim is None:
        if liberacao_projeto:
            return True, ""
        return False, "A Sede ainda não publicou a janela desta competência."
    if data_inicio <= data_prevista <= data_fim:
        if data_prevista.weekday() >= 5:
            return False, "Só é possível preparar rascunho em um dia útil liberado."
        return True, ""
    if liberacao_projeto:
        return True, ""
    return False, "Só é possível preparar rascunho em um dia marcado como liberado."


def pode_enviar_consumo(
    *,
    hoje: date,
    data_inicio: Optional[date],
    data_fim: Optional[date],
    data_prevista: Optional[date] = None,
    liberacao_projeto: bool = False,
) -> tuple[bool, str]:
    if liberacao_projeto:
        return True, ""
    if data_inicio is None or data_fim is None:
        return False, "A Sede ainda não publicou a janela desta competência."
    situacao = status_janela(hoje=hoje, data_inicio=data_inicio, data_fim=data_fim)
    if situacao == STATUS_JANELA_FUTURA:
        texto = data_inicio.strftime("%d/%m/%Y")
        return False, f"A janela abre em {texto}. Você pode deixar o rascunho pronto para envio automático."
    if situacao == STATUS_JANELA_ENCERRADA:
        return False, "A janela desta competência já encerrou. Peça liberação à Sede se ainda precisar enviar."
    if data_prevista and hoje < data_prevista:
        texto = data_prevista.strftime("%d/%m/%Y")
        return False, f"O envio deste rascunho está previsto para {texto}."
    if hoje.weekday() >= 5:
        return False, "O envio só pode ocorrer em dia útil dentro da janela."
    return True, ""


def _perfil_adm_compras(perfil: str) -> str:
    texto = (perfil or "").strip()
    if texto in {"ADM Compras", "Adm Compras", "ADMCompras"}:
        return PERFIL_ADM_COMPRAS
    return texto


def usuario_ve_modulo_compras(
    *,
    perfil: str,
    compras_modulo_ativo: bool,
    is_manutencao: bool = False,
    org_compras_ativo: bool = True,
) -> bool:
    if is_manutencao:
        return True
    perfil_n = _perfil_adm_compras(perfil)
    # ADM Compras entra mesmo com o SaaS desligado — é quem liga o módulo da org.
    if perfil_n == PERFIL_ADM_COMPRAS:
        return True
    if not org_compras_ativo:
        return False
    if perfil == PERFIL_ADM_PEDIDOS:
        return True
    if perfil in PERFIS_PROJETO_ELEGIVEIS:
        return bool(compras_modulo_ativo)
    return False


def usuario_pode_pedir(
    *,
    perfil: str,
    compras_modulo_ativo: bool,
    is_manutencao: bool = False,
    org_compras_ativo: bool = True,
) -> bool:
    if not usuario_ve_modulo_compras(
        perfil=perfil,
        compras_modulo_ativo=compras_modulo_ativo,
        is_manutencao=is_manutencao,
        org_compras_ativo=org_compras_ativo,
    ):
        return False
    return perfil in {PERFIL_ADM_PEDIDOS, *PERFIS_PROJETO_ELEGIVEIS} or is_manutencao


def usuario_pode_aprovar_unidade(
    *,
    perfil: str,
    compras_modulo_ativo: bool,
    is_manutencao: bool = False,
    org_compras_ativo: bool = True,
) -> bool:
    if not usuario_ve_modulo_compras(
        perfil=perfil,
        compras_modulo_ativo=compras_modulo_ativo,
        is_manutencao=is_manutencao,
        org_compras_ativo=org_compras_ativo,
    ):
        return False
    return perfil in {PERFIL_ADM_PEDIDOS, *PERFIS_PROJETO_ELEGIVEIS} or is_manutencao


def usuario_pode_aprovar_sede(*, perfil: str, is_manutencao: bool = False) -> bool:
    return is_manutencao or _perfil_adm_compras(perfil) == PERFIL_ADM_COMPRAS


def usuario_e_sede_compras(*, perfil: str, is_manutencao: bool = False) -> bool:
    return is_manutencao or _perfil_adm_compras(perfil) == PERFIL_ADM_COMPRAS


def _norm_tipo_texto(valor: Optional[str]) -> str:
    bruto = unicodedata.normalize("NFKD", (valor or "").strip().lower())
    return "".join(ch for ch in bruto if not unicodedata.combining(ch))


def inferir_tipo_fonte(nome: Optional[str]) -> str:
    chave = _norm_tipo_texto(nome)
    if "convenio" in chave:
        return FONTE_TIPO_CONVENIO
    if "emenda" in chave:
        return FONTE_TIPO_EMENDA
    if "indireto" in chave:
        return FONTE_TIPO_CUSTO_INDIRETO
    if "proprio" in chave or "próprio" in chave:
        return FONTE_TIPO_PROPRIO
    if "doacao" in chave or "doação" in chave:
        return FONTE_TIPO_DOACAO
    return FONTE_TIPO_OUTROS


def inferir_fator_embalagem(embalagem: Optional[str]) -> Optional[float]:
    texto = (embalagem or "").strip()
    if not texto:
        return None
    achado = re.search(r"(\d+(?:[.,]\d+)?)", texto)
    if not achado:
        return None
    try:
        numero = float(achado.group(1).replace(",", "."))
    except ValueError:
        return None
    if numero <= 0 or numero > 10_000:
        return None
    return numero


def inferir_perecivel(*, categoria_nome: Optional[str] = None, descricao: Optional[str] = None) -> bool:
    blob = f"{categoria_nome or ''} {descricao or ''}"
    chave = _norm_tipo_texto(blob)
    return any(token in chave for token in CATEGORIAS_PERECIVEIS)


def normalizar_tipo_fonte(valor: Optional[str], *, nome: Optional[str] = None) -> str:
    texto = (valor or "").strip().lower()
    if texto in FONTES_TIPOS:
        return texto
    return inferir_tipo_fonte(nome or texto)


def exige_tres_cotacoes(tipo: str) -> bool:
    return (tipo or "").strip().lower() == TIPO_IMOBILIZADO


def pedido_pronto_para_aprovacao_unidade(tipo: str, qtd_cotacoes: int, tem_escolhida: bool) -> bool:
    tipo_n = (tipo or "").strip().lower()
    if not tem_escolhida or qtd_cotacoes < 1:
        return False
    if tipo_n == TIPO_IMOBILIZADO:
        return qtd_cotacoes >= 1
    return qtd_cotacoes >= 1


def aviso_cotacoes_insuficientes(qtd_cotacoes: int) -> Optional[str]:
    if qtd_cotacoes >= MIN_COTACOES_RECOMENDADAS:
        return None
    faltam = MIN_COTACOES_RECOMENDADAS - qtd_cotacoes
    return f"Ainda faltam {faltam} orçamento(s). O ideal são {MIN_COTACOES_RECOMENDADAS} cotações, mas o processo pode continuar."


def pedido_escopo_sede(escopo_unidade: Optional[str]) -> bool:
    return (escopo_unidade or ESCOPO_PROJETO).strip().lower() == ESCOPO_SEDE


def normalizar_escopo_unidade(valor: Optional[str]) -> str:
    escopo = (valor or ESCOPO_PROJETO).strip().lower()
    if escopo not in ESCOPOS_UNIDADE:
        raise ValueError("Escopo inválido. Use projeto ou sede.")
    return escopo


def rotulo_sede_relatorio(organizacao_nome: Optional[str]) -> str:
    org = (organizacao_nome or "").strip()
    return f"Sede – {org}" if org else "Sede"


def rotulo_unidade_relatorio(
    *,
    escopo_unidade: Optional[str],
    instituicao_nome: Optional[str],
    organizacao_nome: Optional[str],
) -> str:
    if pedido_escopo_sede(escopo_unidade):
        return rotulo_sede_relatorio(organizacao_nome)
    return (instituicao_nome or "").strip() or "Projeto"


def ambos_aprovados(aprovado_unidade: bool, aprovado_sede: bool) -> bool:
    return bool(aprovado_unidade) and bool(aprovado_sede)


def sugerir_segunda_semana_util(ano: int, mes: int) -> tuple[date, date]:
    """Segunda-feira da 2ª semana do mês até sexta (calendário operacional AEB)."""
    primeiro = date(int(ano), int(mes), 1)
    offset = (0 - primeiro.weekday()) % 7
    primeira_segunda = primeiro + timedelta(days=offset)
    inicio = primeira_segunda + timedelta(days=7)
    fim = inicio + timedelta(days=4)
    return inicio, fim


def sugerir_janela_competencia(ano: int, mes: int) -> tuple[date, date]:
    if int(ano) == 2026 and int(mes) in PERIODO_COMPRAS_2026:
        return PERIODO_COMPRAS_2026[int(mes)]
    return sugerir_segunda_semana_util(ano, mes)


def economia_centavos(valores: list[int], escolhida_centavos: Optional[int]) -> dict:
    limpos = [int(v) for v in valores if v is not None]
    if not limpos or escolhida_centavos is None:
        return {"economia_vs_maior_centavos": 0, "economia_vs_media_centavos": 0}
    maior = max(limpos)
    media = int(round(sum(limpos) / len(limpos)))
    escolhida = int(escolhida_centavos)
    return {
        "economia_vs_maior_centavos": max(0, maior - escolhida),
        "economia_vs_media_centavos": max(0, media - escolhida),
    }


def pedido_rascunho_pode_excluir(
    *,
    status: str,
    qtd_cotacoes: int,
    qtd_anexos: int,
    qtd_eventos: int,
    qtd_notas: int,
) -> bool:
    """Rascunho sem tramitação da outra parte: some da lista, sem cancelar com motivo."""
    return (
        status == STATUS_RASCUNHO
        and int(qtd_cotacoes or 0) == 0
        and int(qtd_anexos or 0) == 0
        and int(qtd_eventos or 0) == 0
        and int(qtd_notas or 0) == 0
    )
