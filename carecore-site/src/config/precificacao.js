/** Regras comerciais CareCore+ — conviventes + usuários (todos os cadastros). */

export const PRECIFICACAO = {
  blocoCadastros: 100,
  valorBloco: 500,
  tetoDesconto: 1000,
  /** 1º degrau acima de 1.000 cadastros. */
  descontoInicialPercentual: 15,
  /** +5 p.p. a cada novo bloco de 100 acima de 1.000. */
  incrementoDescontoPorBloco: 5,
};

export function descontoPercentualDegrau(indiceDegrau) {
  const desconto =
    PRECIFICACAO.descontoInicialPercentual +
    (indiceDegrau - 1) * PRECIFICACAO.incrementoDescontoPorBloco;

  return Math.min(100, desconto);
}

export function valorBlocoDegrau(indiceDegrau) {
  const desconto = descontoPercentualDegrau(indiceDegrau);

  return PRECIFICACAO.valorBloco * (1 - desconto / 100);
}

export function calcularMensalidade(totalCadastros) {
  const total = Math.max(0, Math.floor(Number(totalCadastros) || 0));

  if (total === 0) {
    return 0;
  }

  if (total <= PRECIFICACAO.tetoDesconto) {
    return Math.ceil(total / PRECIFICACAO.blocoCadastros) * PRECIFICACAO.valorBloco;
  }

  const blocosExtras = Math.ceil((total - PRECIFICACAO.tetoDesconto) / PRECIFICACAO.blocoCadastros);
  const baseAteMil =
    (PRECIFICACAO.tetoDesconto / PRECIFICACAO.blocoCadastros) * PRECIFICACAO.valorBloco;

  let extras = 0;

  for (let degrau = 1; degrau <= blocosExtras; degrau += 1) {
    extras += valorBlocoDegrau(degrau);
  }

  return baseAteMil + extras;
}

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function descreverComposicaoAcimaMil(total) {
  const blocosExtras = Math.ceil((total - PRECIFICACAO.tetoDesconto) / PRECIFICACAO.blocoCadastros);
  const partes = [`R$ 5.000 (até 1.000)`];

  for (let degrau = 1; degrau <= blocosExtras; degrau += 1) {
    const desconto = descontoPercentualDegrau(degrau);
    partes.push(
      `bloco ${degrau}: ${desconto}% → ${formatarMoeda(valorBlocoDegrau(degrau))}`,
    );
  }

  return partes.join(' + ');
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
        : descreverComposicaoAcimaMil(ate),
  }));
}

/** Degraus de desconto progressivo (para exibir no site). */
export function gerarDegrausDescontoProgressivo(quantidade = 8) {
  return Array.from({ length: quantidade }, (_, index) => {
    const degrau = index + 1;
    const inicio = PRECIFICACAO.tetoDesconto + (degrau - 1) * PRECIFICACAO.blocoCadastros + 1;
    const fim = PRECIFICACAO.tetoDesconto + degrau * PRECIFICACAO.blocoCadastros;

    return {
      degrau,
      faixa: `${inicio.toLocaleString('pt-BR')} a ${fim.toLocaleString('pt-BR')}`,
      desconto: descontoPercentualDegrau(degrau),
      valorBloco: valorBlocoDegrau(degrau),
    };
  });
}
