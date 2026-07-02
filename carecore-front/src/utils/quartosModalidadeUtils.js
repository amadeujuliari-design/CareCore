export const MODALIDADES_QUARTO = {
  Fixo: 'Fixo',
  Transitorio: 'Transitorio',
  TB_Suspeita: 'TB_Suspeita',
  TB_Confirmado: 'TB_Confirmado',
};

export function rotuloModalidadeQuarto(modalidade) {
  switch (modalidade) {
    case MODALIDADES_QUARTO.Transitorio:
      return 'Transitório';
    case MODALIDADES_QUARTO.TB_Suspeita:
      return 'TB Suspeita';
    case MODALIDADES_QUARTO.TB_Confirmado:
      return 'TB Confirmado';
    default:
      return 'Fixo';
  }
}

export function modalidadeEhTb(modalidade) {
  return modalidade === MODALIDADES_QUARTO.TB_Suspeita
    || modalidade === MODALIDADES_QUARTO.TB_Confirmado;
}

export function modalidadeTbParaSituacao(modalidade) {
  if (modalidade === MODALIDADES_QUARTO.TB_Suspeita) return 'Suspeita';
  if (modalidade === MODALIDADES_QUARTO.TB_Confirmado) return 'Confirmado';
  return null;
}

export function situacaoTbParaModalidade(situacao) {
  if (situacao === 'Suspeita') return MODALIDADES_QUARTO.TB_Suspeita;
  if (situacao === 'Confirmado') return MODALIDADES_QUARTO.TB_Confirmado;
  return null;
}

export function classesQuartoPorModalidade(modalidade) {
  if (modalidade === MODALIDADES_QUARTO.TB_Suspeita) {
    return 'border-amber-300 bg-amber-50/80';
  }
  if (modalidade === MODALIDADES_QUARTO.TB_Confirmado) {
    return 'border-rose-300 bg-rose-50/80';
  }
  if (modalidade === MODALIDADES_QUARTO.Transitorio) {
    return 'border-orange-200 bg-orange-50/50';
  }
  return 'border-slate-200 bg-white';
}

export function classesLeitoReservadoTb() {
  return 'border-fuchsia-400 bg-fuchsia-50/95 hover:bg-fuchsia-100/95';
}

export function rotuloReservaTb(situacao) {
  if (situacao === 'Suspeita') return 'Reserva TB Suspeita';
  if (situacao === 'Confirmado') return 'Reserva TB Confirmado';
  return 'Reserva TB';
}

export function leitoDisponivelParaSelecao(leito, {
  leitoAtualId,
  leitoReservadoId,
  somenteTb = false,
  modalidadeEsperada = null,
} = {}) {
  if (!leito) return false;
  if (leito.id === leitoAtualId || leito.id === leitoReservadoId) return true;
  if (leito.status === 'Reservado') return false;
  if (leito.status !== 'Livre' && leito.status !== 'Ocupado') return false;
  if (leito.status === 'Ocupado' && leito.id !== leitoAtualId) return false;
  if (somenteTb && modalidadeEsperada && leito.modalidade_quarto !== modalidadeEsperada) {
    return false;
  }
  return leito.status === 'Livre';
}
