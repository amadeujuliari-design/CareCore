import {
  DIREITOS_RESERVADOS_TEXTO,
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from "./direitosReservados.js";

const encoder = new TextEncoder();
let tabelaCrc32 = null;

function escaparXml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function gerarTabelaCrc32() {
  if (tabelaCrc32) return tabelaCrc32;

  tabelaCrc32 = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let c = i;

    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    tabelaCrc32[i] = c >>> 0;
  }

  return tabelaCrc32;
}

function calcularCrc32(bytes) {
  const tabela = gerarTabelaCrc32();
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = tabela[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function uint16(valor) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, valor, true);
  return bytes;
}

function uint32(valor) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, valor, true);
  return bytes;
}

function concatenarBytes(partes) {
  const tamanhoTotal = partes.reduce((total, parte) => total + parte.length, 0);
  const resultado = new Uint8Array(tamanhoTotal);
  let offset = 0;

  for (const parte of partes) {
    resultado.set(parte, offset);
    offset += parte.length;
  }

  return resultado;
}

function textoParaBytes(texto) {
  return encoder.encode(texto);
}

function criarZipSemCompressao(arquivos) {
  const locais = [];
  const centrais = [];
  let offset = 0;

  for (const arquivo of arquivos) {
    const nomeBytes = textoParaBytes(arquivo.nome);
    const conteudoBytes = textoParaBytes(arquivo.conteudo);
    const crc = calcularCrc32(conteudoBytes);

    const cabecalhoLocal = concatenarBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(conteudoBytes.length),
      uint32(conteudoBytes.length),
      uint16(nomeBytes.length),
      uint16(0),
      nomeBytes,
    ]);

    locais.push(cabecalhoLocal, conteudoBytes);

    centrais.push(concatenarBytes([
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(conteudoBytes.length),
      uint32(conteudoBytes.length),
      uint16(nomeBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(offset),
      nomeBytes,
    ]));

    offset += cabecalhoLocal.length + conteudoBytes.length;
  }

  const diretorioCentral = concatenarBytes(centrais);
  const fimDiretorioCentral = concatenarBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(arquivos.length),
    uint16(arquivos.length),
    uint32(diretorioCentral.length),
    uint32(offset),
    uint16(0),
  ]);

  return concatenarBytes([
    ...locais,
    diretorioCentral,
    fimDiretorioCentral,
  ]);
}

function nomeColuna(indice) {
  let numero = indice + 1;
  let nome = "";

  while (numero > 0) {
    const resto = (numero - 1) % 26;
    nome = String.fromCharCode(65 + resto) + nome;
    numero = Math.floor((numero - 1) / 26);
  }

  return nome;
}

function celulaXml(valor, linha, coluna) {
  const referencia = `${nomeColuna(coluna)}${linha}`;

  if (typeof valor === "number" && Number.isFinite(valor)) {
    return `<c r="${referencia}"><v>${valor}</v></c>`;
  }

  if (typeof valor === "boolean") {
    return `<c r="${referencia}" t="b"><v>${valor ? 1 : 0}</v></c>`;
  }

  return `<c r="${referencia}" t="inlineStr"><is><t>${escaparXml(valor)}</t></is></c>`;
}

export function montarLinhasRelatorioXlsx({
  titulo = "RELATÓRIO",
  filtros = {},
  colunas = [],
  dados = [],
  dataAtual = new Date().toLocaleString("pt-BR"),
}) {
  const linhas = [];

  linhas.push([titulo]);
  linhas.push([`Gerado em: ${dataAtual}`]);
  linhas.push([]);

  if (Object.keys(filtros).length > 0) {
    linhas.push(["FILTROS"]);

    Object.entries(filtros).forEach(([chave, valor]) => {
      linhas.push([`${chave}: ${valor || "Todos"}`]);
    });

    linhas.push([]);
  }

  linhas.push(colunas);

  dados.forEach((item) => {
    linhas.push(
      colunas.map((coluna) => item[coluna] ?? "")
    );
  });

  linhas.push([]);
  linhas.push([DIREITOS_RESERVADOS_TITULO]);
  linhas.push([DIREITOS_RESERVADOS_TEXTO]);
  linhas.push([`Página pública: ${obterUrlDireitosReservados()}`]);

  return linhas;
}

export function criarArquivoXlsx(linhas, quantidadeColunas = 1) {
  const larguraColunas = Array.from(
    { length: Math.max(1, quantidadeColunas) },
    (_, indice) => `<col min="${indice + 1}" max="${indice + 1}" width="28" customWidth="1"/>`
  ).join("");

  const linhasXml = linhas.map((linha, indiceLinha) => {
    const numeroLinha = indiceLinha + 1;
    const celulas = linha.map((valor, indiceColuna) => (
      celulaXml(valor, numeroLinha, indiceColuna)
    )).join("");

    return `<row r="${numeroLinha}">${celulas}</row>`;
  }).join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${larguraColunas}</cols>
  <sheetData>${linhasXml}</sheetData>
</worksheet>`;

  const arquivos = [
    {
      nome: "[Content_Types].xml",
      conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      nome: "_rels/.rels",
      conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      nome: "xl/workbook.xml",
      conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Relatório" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      conteudo: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      nome: "xl/worksheets/sheet1.xml",
      conteudo: sheetXml,
    },
  ];

  return criarZipSemCompressao(arquivos);
}

function baixarArquivoXlsx(bytes, nomeArquivo) {
  const blob = new Blob(
    [bytes],
    { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${nomeArquivo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function exportarRelatorioXlsx({
  nomeArquivo = "relatorio",
  titulo = "RELATÓRIO",
  filtros = {},
  colunas = [],
  dados = [],
}) {
  const linhas = montarLinhasRelatorioXlsx({
    titulo,
    filtros,
    colunas,
    dados,
  });
  const bytes = criarArquivoXlsx(linhas, colunas.length);

  baixarArquivoXlsx(bytes, nomeArquivo);
}