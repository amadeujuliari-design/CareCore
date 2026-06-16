/** Regras comerciais CareCore+ — conviventes + usuários faturáveis na data de fechamento. */

export const PRECIFICACAO = {
  blocoCadastros: 100,
  valorBloco: 500,
  cadastrosSemDesconto: 500,
  cadastrosTetoDesconto: 3000,
  /** 1º bloco com desconto: 501 a 600 cadastros faturáveis. */
  descontoInicialPercentual: 5,
  /** Teto do desconto progressivo (acima deste % o bloco mantém o mesmo valor). */
  descontoMaximoPercentual: 75,
  /** Curva calibrada para 3.000 cadastros fecharem em R$ 8.875. */
  expoenteCurvaDesconto: 0.5746292138076721,
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
  if (indiceDegrau <= 0) {
    return 0;
  }

  const blocoInicioDesconto = Math.floor(PRECIFICACAO.cadastrosSemDesconto / PRECIFICACAO.blocoCadastros) + 1;
  const blocoTetoDesconto = Math.floor(PRECIFICACAO.cadastrosTetoDesconto / PRECIFICACAO.blocoCadastros);

  if (indiceDegrau < blocoInicioDesconto) {
    return 0;
  }

  if (indiceDegrau >= blocoTetoDesconto) {
    return PRECIFICACAO.descontoMaximoPercentual;
  }

  const progresso = (indiceDegrau - blocoInicioDesconto) / (blocoTetoDesconto - blocoInicioDesconto);
  const desconto =
    PRECIFICACAO.descontoInicialPercentual +
    (PRECIFICACAO.descontoMaximoPercentual - PRECIFICACAO.descontoInicialPercentual) *
      progresso ** PRECIFICACAO.expoenteCurvaDesconto;

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

  const totalBlocos = Math.ceil(total / PRECIFICACAO.blocoCadastros);
  let mensalidade = 0;

  for (let bloco = 1; bloco <= totalBlocos; bloco += 1) {
    mensalidade += valorBlocoDegrau(bloco);
  }

  return Math.round(mensalidade * 100) / 100;
}

export function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function descreverComposicaoTabela(total) {
  const totalBlocos = Math.ceil(total / PRECIFICACAO.blocoCadastros);
  const partes = [];

  for (let bloco = 1; bloco <= totalBlocos; bloco += 1) {
    const desconto = descontoPercentualDegrau(bloco);
    partes.push(
      `bloco ${bloco}: ${desconto.toFixed(2)}% → ${formatarMoeda(valorBlocoDegrau(bloco))}`,
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
      ate <= PRECIFICACAO.cadastrosSemDesconto
        ? `${Math.ceil(ate / PRECIFICACAO.blocoCadastros)} blocos × R$ 500`
        : descreverComposicaoTabela(ate),
  }));
}

/** Degraus de desconto progressivo (para exibir no site). */
export function gerarDegrausDescontoProgressivo(quantidade = 8) {
  return Array.from({ length: quantidade }, (_, index) => {
    const degrau = index + 1;
    const bloco = Math.floor(PRECIFICACAO.cadastrosSemDesconto / PRECIFICACAO.blocoCadastros) + degrau;
    const inicio = (bloco - 1) * PRECIFICACAO.blocoCadastros + 1;
    const fim = bloco * PRECIFICACAO.blocoCadastros;

    return {
      degrau,
      faixa: `${inicio.toLocaleString('pt-BR')} a ${fim.toLocaleString('pt-BR')}`,
      desconto: descontoPercentualDegrau(degrau),
      valorBloco: valorBlocoDegrau(degrau),
    };
  });
}
