import zipfile
from io import BytesIO
from xml.sax.saxutils import escape

DIREITOS_RESERVADOS_TITULO = "© 2026 CARECORE+. Todos os direitos reservados."
DIREITOS_RESERVADOS_TEXTO = (
    "Sistema, código-fonte, banco de dados, telas, fluxos operacionais, documentação, "
    "relatórios e identidade visual protegidos pela Lei nº 9.610/1998 (Lei de Direitos Autorais), "
    "pela Lei nº 9.609/1998 (Lei do Software) e pela legislação aplicável, sem prejuízo da "
    "Lei nº 13.709/2018 (LGPD) quando houver tratamento de dados pessoais. "
    "É proibida a cópia, reprodução, engenharia reversa, distribuição, modificação, cessão, "
    "revenda ou utilização por terceiros sem autorização expressa e por escrito do titular."
)
DIREITOS_RESERVADOS_URL = "https://carecoreplus.com.br/direitos-reservados"


def _adicionar_aviso_direitos_reservados(linhas: list[list]) -> list[list]:
    return [
        *linhas,
        [],
        [DIREITOS_RESERVADOS_TITULO],
        [DIREITOS_RESERVADOS_TEXTO],
        [f"Página pública: {DIREITOS_RESERVADOS_URL}"],
    ]


def _xlsx_coluna_nome(indice: int) -> str:
    nome = ""
    while indice:
        indice, resto = divmod(indice - 1, 26)
        nome = chr(65 + resto) + nome
    return nome


def _xlsx_celula_texto(linha: int, coluna: int, valor) -> str:
    if valor is None:
        valor = ""
    valor = escape(str(valor))
    ref = f"{_xlsx_coluna_nome(coluna)}{linha}"
    return f'<c r="{ref}" t="inlineStr"><is><t>{valor}</t></is></c>'


def _xlsx_planilha(linhas: list[list]) -> str:
    linhas_xml = []
    for idx_linha, valores in enumerate(linhas, start=1):
        celulas = "".join(
            _xlsx_celula_texto(idx_linha, idx_coluna, valor)
            for idx_coluna, valor in enumerate(valores, start=1)
        )
        linhas_xml.append(f'<row r="{idx_linha}">{celulas}</row>')

    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    {"".join(linhas_xml)}
  </sheetData>
</worksheet>'''


def _gerar_workbook_duas_abas(
    nome_primeira_aba: str,
    linhas_primeira_aba: list[list],
    nome_segunda_aba: str,
    linhas_segunda_aba: list[list],
) -> bytes:
    buffer = BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as arquivo:
        arquivo.writestr("[Content_Types].xml", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>''')

        arquivo.writestr("_rels/.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>''')

        arquivo.writestr("xl/workbook.xml", f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="{escape(nome_primeira_aba)}" sheetId="1" r:id="rId1"/>
    <sheet name="{escape(nome_segunda_aba)}" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>''')

        arquivo.writestr("xl/_rels/workbook.xml.rels", '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>''')

        arquivo.writestr("xl/worksheets/sheet1.xml", _xlsx_planilha(linhas_primeira_aba))
        arquivo.writestr("xl/worksheets/sheet2.xml", _xlsx_planilha(linhas_segunda_aba))

    buffer.seek(0)
    return buffer.read()


def gerar_xlsx_historico(linhas_historico: list[dict]) -> bytes:
    cabecalho = [
        "Data/Hora",
        "Convivente",
        "Prontuário",
        "Tipo",
        "Registrado por",
        "Perfil",
        "Status",
        "Complemento",
        "Retorno rápido",
        "Justificativa retorno rápido",
        "Editado",
        "Data edição",
        "Motivo edição",
        "Cancelado",
        "Data cancelamento",
        "Motivo cancelamento"
    ]

    dados = [cabecalho]

    for item in linhas_historico:
        data_registro = item.get("data_registro")
        editado_em = item.get("editado_em")
        cancelado_em = item.get("cancelado_em")

        dados.append([
            data_registro.strftime("%d/%m/%Y %H:%M:%S") if data_registro else "",
            item.get("convivente_nome") or "",
            item.get("numero_institucional") or "",
            item.get("tipo_registro") or "",
            item.get("usuario_nome") or "",
            item.get("usuario_perfil") or "",
            "Cancelado" if item.get("cancelado") else "Ativo",
            item.get("observacao") or "",
            "Sim" if item.get("retorno_rapido") else "Não",
            item.get("justificativa_retorno_rapido") or "",
            "Sim" if item.get("foi_editado") else "Não",
            editado_em.strftime("%d/%m/%Y %H:%M:%S") if editado_em else "",
            item.get("motivo_edicao") or "",
            "Sim" if item.get("cancelado") else "Não",
            cancelado_em.strftime("%d/%m/%Y %H:%M:%S") if cancelado_em else "",
            item.get("motivo_cancelamento") or ""
        ])

    resumo = {
        "Entradas": sum(1 for item in linhas_historico if item.get("tipo_registro") == "Entrada"),
        "Saídas": sum(1 for item in linhas_historico if item.get("tipo_registro") == "Saída"),
        "Almoços": sum(1 for item in linhas_historico if item.get("tipo_registro") == "Almoço"),
        "Retornos rápidos": sum(1 for item in linhas_historico if item.get("retorno_rapido")),
        "Editados": sum(1 for item in linhas_historico if item.get("foi_editado")),
        "Cancelados": sum(1 for item in linhas_historico if item.get("cancelado")),
        "Total filtrado": len(linhas_historico)
    }

    linhas_resumo = [["Indicador", "Quantidade"]]
    linhas_resumo.extend([[chave, valor] for chave, valor in resumo.items()])

    return _gerar_workbook_duas_abas(
        "Historico",
        _adicionar_aviso_direitos_reservados(dados),
        "Resumo",
        _adicionar_aviso_direitos_reservados(linhas_resumo),
    )


def gerar_xlsx_convenio_sisa_mensal(dados: dict) -> bytes:
    resumo = dados["resumo"]
    items = dados["items"]

    linhas_resumo = [
        ["Indicador", "Valor"],
        ["Ano", resumo.get("ano")],
        ["Mês", resumo.get("mes")],
        ["Conviventes ativos", resumo.get("conviventes_ativos")],
        ["Total atendimentos", resumo.get("total_atendimentos")],
        ["Total cafés", resumo.get("total_cafes")],
        ["Total almoços", resumo.get("total_almocos")],
        ["Total jantares", resumo.get("total_jantares")],
        ["Total lanches", resumo.get("total_lanches")],
        ["Total refeições extras", resumo.get("total_refeicoes_extras")],
        ["Total banhos", resumo.get("total_banhos")],
        ["Total entradas", resumo.get("total_entradas")],
        ["Total saídas", resumo.get("total_saidas")],
        ["Retornos rápidos", resumo.get("total_retornos_rapidos")],
        ["Lançados no SISA", resumo.get("lancados_sisa")],
        ["Pendentes SISA", resumo.get("pendentes_sisa")],
        ["Fechado", "Sim" if resumo.get("fechado") else "Não"],
        ["Protocolo", resumo.get("protocolo") or ""]
    ]

    linhas_mensal = [[
        "Prontuário",
        "Nº SISA",
        "Nome",
        "Dias presentes",
        "Total atendimentos",
        "Cafés",
        "Almoços",
        "Jantares",
        "Lanches",
        "Refeições extras",
        "Banhos",
        "Entradas",
        "Saídas",
        "Retornos rápidos",
        "Status SISA",
        "Lançado por",
        "Lançado em",
        "Observações lançamento",
        "Dias"
    ]]

    for item in items:
        linhas_mensal.append([
            item.get("prontuario") or "",
            item.get("numero_sisa") or "",
            item.get("nome") or "",
            item.get("dias_presentes") or 0,
            item.get("total_atendimentos") or 0,
            item.get("cafes") or 0,
            item.get("almocos") or 0,
            item.get("jantares") or 0,
            item.get("lanches") or 0,
            item.get("refeicoes_extras") or 0,
            item.get("banhos") or 0,
            item.get("entradas") or 0,
            item.get("saidas") or 0,
            item.get("retornos_rapidos") or 0,
            "Lançado" if item.get("lancado_sisa") else "Pendente",
            item.get("lancado_por_nome") or "",
            item.get("lancado_em").strftime("%d/%m/%Y %H:%M:%S") if item.get("lancado_em") else "",
            item.get("observacoes_lancamento_sisa") or "",
            ", ".join(item.get("dias_presentes_lista") or [])
        ])

    return _gerar_workbook_duas_abas(
        "Mensal",
        _adicionar_aviso_direitos_reservados(linhas_mensal),
        "Resumo",
        _adicionar_aviso_direitos_reservados(linhas_resumo),
    )
