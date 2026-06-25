export const ORIGEM_PIA_LABELS = {
  discussao_hospitalar: {
    rotulo: 'Discussão hospitalar',
    classe: 'bg-violet-50 text-violet-800 border-violet-200',
  },
  tuberculose: {
    rotulo: 'Tuberculose',
    classe: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  pot: {
    rotulo: 'POT',
    classe: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
};

export function rotuloOrigemPia(origemModulo) {
  return ORIGEM_PIA_LABELS[origemModulo]?.rotulo || null;
}

export function classeOrigemPia(origemModulo) {
  return ORIGEM_PIA_LABELS[origemModulo]?.classe || 'bg-slate-50 text-slate-700 border-slate-200';
}
