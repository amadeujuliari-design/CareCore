/** Regras comerciais CareCore+ — conviventes + usuários faturáveis na data de fechamento. */

export const PRECIFICACAO = {
  blocoCadastros: 100,
  valorBloco: 500,
  tetoDesconto: 1000,
  /** 1º degrau acima de 1.000 cadastros faturáveis. */
  descontoInicialPercentual: 20,
  /** +6,1111 p.p. a cada novo bloco de 100 acima de 1.000, até atingir 75%. */
  incrementoDescontoPorBloco: 55 / 9,
  /** Teto do desconto progressivo (acima deste % o bloco mantém o mesmo valor). */
  descontoMaximoPercentual: 75,
  /**
   * Inativo só deixa de entrar na conta se foi inativado há >= 15 dias antes do fechamento.
   * Inativado há 14 dias ou menos antes do fechamento ainda compõe o valor.
   */
  diasAntecedenciaExclusaoInativo: 15,
};

/**
 * @param {boolean} ativo
 * @param {Date|string|null|undefined} inativadoEm
 * @param {Date|string} dataFechamento
 */
export function cadastroContaParaFaturamento(ativo, inativadoEm, dataFechamento) {
  if (ativo) {
    return true;
  }

  if (!inativadoEm) {
    return false;
  }

  const fechamento = dataFechamento instanceof Date ? dataFechamento : new Date(dataFechamento);
  const inativacao = inativadoEm instanceof Date ? inativadoEm : new Date(inativadoEm);

  const fechamentoDia = Date.UTC(
    fechamento.getFullYear(),
    fechamento.getMonth(),
    fechamento.getDate(),
  );
  const inativacaoDia = Date.UTC(
    inativacao.getFullYear(),
    inativacao.getMonth(),
    inativacao.getDate(),
  );

  const diasAntesDoFechamento = Math.floor((fechamentoDia - inativacaoDia) / 86400000);
  return diasAntesDoFechamento < PRECIFICACAO.diasAntecedenciaExclusaoInativo;
}

/** @param {Array<{ ativo: boolean, inativadoEm?: Date|string|null }>} cadastros */
export function contarCadastrosFaturaveis(cadastros, dataFechamento) {
  return cadastros.filter((cadastro) =>
    cadastroContaParaFaturamento(cadastro.ativo, cadastro.inativadoEm ?? null, dataFechamento),
  ).length;
}

export function descontoPercentualDegrau(indiceDegrau) {
  const desconto =
    PRECIFICACAO.descontoInicialPercentual +
    (indiceDegrau - 1) * PRECIFICACAO.incrementoDescontoPorBloco;

  return Math.min(PRECIFICACAO.descontoMaximoPercentual, desconto);
}

export function valorBlocoDegrau(indiceDegrau) {
  const desconto = descontoPercentualDegrau(indiceDegrau);

  return PRECIFICACAO.valorBloco * (1 - desconto / 100);
}

export function calcularMensalidade(totalCadastrosFaturaveis) {
  const total = Math.max(0, Math.floor(Number(totalCadastrosFaturaveis) || 0));

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

/** Linhas da tabela comercial — linguagem para o comprador. */
export function gerarLinhasTabelaComercial() {
  const exemplos = [
    {
      perfil: 'Início',
      descricao: 'Primeiros acolhidos e equipe enxuta na plataforma',
      ate: 100,
    },
    {
      perfil: 'Expansão',
      descricao: 'Mais acolhidos, técnicos e rotina estruturada',
      ate: 200,
    },
    {
      perfil: 'Consolidado',
      descricao: 'Operação com dezenas de profissionais e acolhidos',
      ate: 500,
    },
    {
      perfil: 'Escala',
      descricao: 'Grande volume de cadastros e múltiplas frentes de trabalho',
      ate: 1000,
    },
    {
      perfil: 'Rede ampliada',
      descricao: 'Operação muito grande — com desconto progressivo automático',
      ate: 1500,
    },
    {
      perfil: 'Referência',
      descricao: 'Instituições de alto volume — melhor custo por pessoa cadastrada',
      ate: 2000,
    },
  ];

  return exemplos.map((exemplo) => {
    const mensalidade = calcularMensalidade(exemplo.ate);
    const porPessoa = mensalidade / exemplo.ate;

    return {
      ...exemplo,
      faixa: `até ${exemplo.ate.toLocaleString('pt-BR')} pessoas`,
      mensalidade,
      porPessoa,
    };
  });
}

/** Linhas técnicas (referência interna — não expor no site comercial). */
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
