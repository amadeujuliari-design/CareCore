export const STORAGE_KEY_CABECALHO_PIA_EVOLUCAO = '@CareCore:cabecalhoPiaEvolucao';

export const MODOS_CABECALHO_PIA_EVOLUCAO = {
  completo: {
    id: 'completo',
    label: 'Cabeçalho completo',
    descricao: 'Dados pessoais básicos e toda a aba Assistência social, seguidos do histórico narrativo do PIA.',
  },
  resumido: {
    id: 'resumido',
    label: 'Cabeçalho resumido',
    descricao: 'Identificação enxuta (prontuário, status, técnico e SISA) e histórico narrativo do PIA.',
  },
};

export const MODO_CABECALHO_PIA_EVOLUCAO_PADRAO = 'completo';

export function carregarModoCabecalhoPiaEvolucao() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY_CABECALHO_PIA_EVOLUCAO);
    if (salvo === 'resumido' || salvo === 'completo') return salvo;
  } catch {
    // ignore
  }
  return MODO_CABECALHO_PIA_EVOLUCAO_PADRAO;
}

export function salvarModoCabecalhoPiaEvolucao(modo) {
  try {
    localStorage.setItem(STORAGE_KEY_CABECALHO_PIA_EVOLUCAO, modo);
  } catch {
    // ignore
  }
}
