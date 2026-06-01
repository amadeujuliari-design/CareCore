/** Regras comerciais CareCore+ — conviventes + usuários (todos os cadastros). */

export const PRECIFICACAO = {
  blocoCadastros: 100,
  valorBloco: 500,
  tetoDesconto: 1000,
  descontoPercentual: 0.15,
  valorBlocoComDesconto: 425,
};

export function calcularMensalidade(totalCadastros) {
  const total = Math.max(0, Math.floor(Number(totalCadastros) || 0));

  if (total === 0) {
    return 0;
  }

  if (total <= PRECIFICACAO.tetoDesconto) {
    return Math.ceil(total / PRECIFICACAO.blocoCadastros) * PRECIFICACAO.valorBloco;
  }

  const blocosExtras = Math.ceil((total - PRECIFICACAO.tetoDesconto) / PRECIFICACAO.blocoCadastros);
  const baseAteMil = (PRECIFICACAO.tetoDesconto / PRECIFICACAO.blocoCadastros) * PRECIFICACAO.valorBloco;

  return baseAteMil + blocosExtras * PRECIFICACAO.valorBlocoComDesconto;
}

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Linhas principais da tabela comercial (total = conviventes + usuários). */
export function gerarLinhasTabelaPrecos() {
  const marcos = [
    100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
    1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000,
  ];

  return marcos.map((ate) => ({
    faixa: ate <= 100 ? `1 a ${ate}` : `${ate - 99} a ${ate}`,
    totalCadastros: ate,
    mensalidade: calcularMensalidade(ate),
    observacao:
      ate <= PRECIFICACAO.tetoDesconto
        ? `${Math.ceil(ate / PRECIFICACAO.blocoCadastros)} blocos × R$ 500`
        : ate === 1100
          ? 'R$ 5.000 (até 1.000) + 1 bloco com 15% de desconto'
          : `R$ 5.000 (até 1.000) + ${Math.ceil((ate - PRECIFICACAO.tetoDesconto) / PRECIFICACAO.blocoCadastros)} blocos com 15% de desconto`,
  }));
}
