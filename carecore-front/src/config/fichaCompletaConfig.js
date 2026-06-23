/** Seções disponíveis na impressão da ficha completa do convivente. */
export const FICHA_COMPLETA_SECOES = [
  {
    id: 'identificacao',
    label: 'Identificação e situação no serviço',
    padrao: true,
  },
  {
    id: 'contato',
    label: 'Contato e endereço',
    padrao: true,
  },
  {
    id: 'familia',
    label: 'Família e rede de apoio',
    padrao: true,
  },
  {
    id: 'documentos_civis',
    label: 'Documentação civil',
    padrao: true,
  },
  {
    id: 'escolaridade_trabalho',
    label: 'Escolaridade e trabalho',
    padrao: true,
  },
  {
    id: 'beneficios',
    label: 'Benefícios, renda e CadÚnico',
    padrao: true,
  },
  {
    id: 'trajetoria',
    label: 'Trajetória / vida na rua',
    padrao: false,
  },
  {
    id: 'saude',
    label: 'Saúde',
    padrao: true,
  },
  {
    id: 'judiciario',
    label: 'Judiciário, egresso e dados sensíveis',
    padrao: false,
    requerConfirmacao: true,
  },
];

export const STORAGE_KEY_FICHA_SECOES = 'carecore_ficha_completa_secoes_v1';

/** Limite por operação na Central de Relatórios (evita travar o navegador). */
export const LIMITE_FICHAS_LOTE_RELATORIOS = 50;

/** Acima deste número, pede confirmação explícita antes de gerar. */
export const CONFIRMAR_FICHAS_LOTE_ACIMA_DE = 10;

export function obterSecoesPadraoFicha() {
  return FICHA_COMPLETA_SECOES.filter((s) => s.padrao).map((s) => s.id);
}

export function carregarSecoesSalvasFicha() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FICHA_SECOES);
    if (!raw) return obterSecoesPadraoFicha();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return obterSecoesPadraoFicha();
    const validos = new Set(FICHA_COMPLETA_SECOES.map((s) => s.id));
    const filtrados = parsed.filter((id) => validos.has(id));
    return filtrados.length ? filtrados : obterSecoesPadraoFicha();
  } catch {
    return obterSecoesPadraoFicha();
  }
}

export function salvarSecoesFicha(secoes) {
  try {
    localStorage.setItem(STORAGE_KEY_FICHA_SECOES, JSON.stringify(secoes));
  } catch {
    /* ignore quota */
  }
}
