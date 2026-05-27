import * as XLSX from "xlsx";

export function exportarRelatorioXlsx({
  nomeArquivo = "relatorio",
  titulo = "RELATÓRIO",
  filtros = {},
  colunas = [],
  dados = [],
}) {
  const dataAtual = new Date().toLocaleString("pt-BR");

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

  const worksheet = XLSX.utils.aoa_to_sheet(linhas);

  worksheet["!cols"] = colunas.map(() => ({
    wch: 28,
  }));

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Relatório"
  );

  XLSX.writeFile(
    workbook,
    `${nomeArquivo}.xlsx`
  );
}