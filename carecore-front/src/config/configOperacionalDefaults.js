import {
  TERMO_COMPROMISSO_TEXTO,
  TERMO_LGPD_SUBTITULO,
  TERMO_LGPD_TEXTO,
  TERMO_LGPD_TITULO,
} from './piaTemplatesTexto';
import {
  TERMO_BAGAGEIRO_COMPROMISSO,
  TERMO_BAGAGEIRO_ITENS,
  TERMO_BAGAGEIRO_RETIRADA_SUBTITULO,
  TERMO_BAGAGEIRO_RETIRADA_TEXTO,
  TERMO_BAGAGEIRO_RETIRADA_TITULO,
  TERMO_BAGAGEIRO_TITULO,
} from './termoBagageiroTexto';
import {
  MODULOS_GENERICO,
  MODULOS_SIAT,
  TERMO_BAGAGEIRO_ITENS_GENERICO,
  TERMO_BAGAGEIRO_RETIRADA_TEXTO_GENERICO,
  TERMO_COMPROMISSO_TEXTO_GENERICO,
  TERMO_COMPROMISSO_TITULO_GENERICO,
  TERMO_LGPD_TEXTO_GENERICO,
} from './configOperacionalTextosGenerico';

export const REFEICOES_PADRAO = [
  { id: 'cafe', nome: 'Café da manhã', inicio: '06:55', fim: '08:30', ativo: true },
  { id: 'almoco', nome: 'Almoço', inicio: '11:50', fim: '14:30', ativo: true },
  { id: 'jantar', nome: 'Jantar', inicio: '17:50', fim: '20:30', ativo: true },
  { id: 'lanche', nome: 'Lanche noturno', inicio: '21:00', fim: '22:30', ativo: true },
];

export const INTERACOES_ROTINA_PADRAO = [
  { valor: 'Banho', label: 'Banho', grupo: 'simples', ativo: true },
  {
    valor: 'Cobertor',
    label: 'Cobertor (sugerir retirada/entrega)',
    grupo: 'par',
    ativo: true,
    tipo_retirada: 'Retirada de Cobertor',
    tipo_entrega: 'Entrega de Cobertor',
  },
  {
    valor: 'Toalha',
    label: 'Toalha (sugerir retirada/entrega)',
    grupo: 'par',
    ativo: true,
    tipo_retirada: 'Retirada de Toalha',
    tipo_entrega: 'Entrega de Toalha',
  },
  { valor: 'Bagageiro', label: 'Bagageiro (entrada/saída)', grupo: 'par_bagageiro', ativo: true },
  { valor: 'Bipar documentos guardados', label: 'Documentos guardados', grupo: 'observacao', ativo: true },
  { valor: 'Bipar documentos retirados', label: 'Documentos retirados', grupo: 'observacao', ativo: true },
];

export const PORTARIA_PADRAO = {
  hora_saida_padrao: '17:00',
  hora_entrada_padrao: '19:00',
  hora_entrada_apos_pernoite_fora: '11:00',
  hora_movimento_pernoite_dentro: '04:00',
  min_caracteres_justificativa: 30,
  motivos_excecao: ['estudante', 'trabalho', 'saude', 'eventual'],
};

export const MODULOS_PADRAO = { ...MODULOS_GENERICO };

function montarDocumentosPadrao(perfil = 'generico') {
  const siat = perfil === 'siat';
  return {
    termo_compromisso: {
      imprimir: true,
      titulo: siat
        ? 'TERMO DE COMPROMISSO E RESPONSABILIDADE DO CONVIVENTE NO SIAT II ARMÊNIA'
        : TERMO_COMPROMISSO_TITULO_GENERICO,
      texto: siat
        ? TERMO_COMPROMISSO_TEXTO.replace(
          /^TERMO DE COMPROMISSO E RESPONSABILIDADE DO CONVIVENTE NO SIAT II ARMÊNIA\n\n/,
          '',
        )
        : TERMO_COMPROMISSO_TEXTO_GENERICO,
    },
    termo_lgpd: {
      imprimir: true,
      titulo: TERMO_LGPD_TITULO,
      subtitulo: TERMO_LGPD_SUBTITULO,
      texto: siat ? TERMO_LGPD_TEXTO : TERMO_LGPD_TEXTO_GENERICO,
    },
    termo_bagageiro: {
      imprimir: true,
      titulo: TERMO_BAGAGEIRO_TITULO,
      itens: siat ? [...TERMO_BAGAGEIRO_ITENS] : [...TERMO_BAGAGEIRO_ITENS_GENERICO],
      compromisso: TERMO_BAGAGEIRO_COMPROMISSO,
      retirada_titulo: TERMO_BAGAGEIRO_RETIRADA_TITULO,
      retirada_subtitulo: TERMO_BAGAGEIRO_RETIRADA_SUBTITULO,
      retirada_texto: siat ? TERMO_BAGAGEIRO_RETIRADA_TEXTO : TERMO_BAGAGEIRO_RETIRADA_TEXTO_GENERICO,
      rotulo_assinatura_funcionario: 'Funcionário do projeto',
    },
  };
}

export function montarConfigOperacionalPadrao(perfil = 'generico') {
  const siat = perfil === 'siat';
  return {
    perfil_defaults: siat ? 'siat' : 'generico',
    refeicoes: {
      habilitadas: true,
      itens: REFEICOES_PADRAO.map((item) => ({ ...item })),
    },
    portaria: { ...PORTARIA_PADRAO },
    interacoes_rotina: INTERACOES_ROTINA_PADRAO.map((item) => ({ ...item })),
    modulos: { ...(siat ? MODULOS_SIAT : MODULOS_GENERICO) },
    documentos: montarDocumentosPadrao(perfil),
  };
}

export function obterInteracoesRotinaAtivas(config) {
  const base = config || montarConfigOperacionalPadrao();
  const interacoes = (base.interacoes_rotina || []).filter((item) => item.ativo);
  if (!base.refeicoes?.habilitadas) return interacoes;

  const refeicoes = (base.refeicoes.itens || []).filter((item) => item.ativo && item.nome?.trim());
  const existentes = new Set(interacoes.map((item) => item.valor));
  const refeicoesInteracao = refeicoes
    .filter((item) => !existentes.has(item.nome))
    .map((item) => ({
      valor: item.nome,
      label: item.nome,
      grupo: 'refeicao',
      ativo: true,
    }));

  return [...refeicoesInteracao, ...interacoes];
}

export function obterOpcoesInteracaoRotina(config) {
  return obterInteracoesRotinaAtivas(config).map((item) => ({
    valor: item.valor,
    label: item.label || item.valor,
    grupo: item.grupo,
    tipo_retirada: item.tipo_retirada || null,
    tipo_entrega: item.tipo_entrega || null,
  }));
}

const MAPA_PARES_INTERACAO_PADRAO = {
  Cobertor: ['Retirada de Cobertor', 'Entrega de Cobertor'],
  Toalha: ['Retirada de Toalha', 'Entrega de Toalha'],
};

export function obterMapaInteracoesPar(config) {
  const mapa = { ...MAPA_PARES_INTERACAO_PADRAO };
  (config?.interacoes_rotina || []).forEach((item) => {
    if (item.grupo === 'par' && item.tipo_retirada && item.tipo_entrega) {
      mapa[item.valor] = [item.tipo_retirada, item.tipo_entrega];
    }
  });
  return mapa;
}

export function obterJanelasRefeicao(config) {
  const base = config || montarConfigOperacionalPadrao();
  if (!base.refeicoes?.habilitadas) return {};
  const janelas = {};
  (base.refeicoes.itens || []).forEach((item) => {
    if (item.ativo && item.nome) {
      janelas[item.nome] = { inicio: item.inicio, fim: item.fim };
    }
  });
  return janelas;
}

export function obterPortariaConfig(config) {
  return { ...PORTARIA_PADRAO, ...(config?.portaria || {}) };
}

export function moduloAtivo(config, chave) {
  const modulos = { ...MODULOS_PADRAO, ...(config?.modulos || {}) };
  return modulos[chave] !== false;
}

export const MAPA_SLUG_MODULO_ACOMPANHAMENTO = {
  transferencias: 'transferencias',
  'discussoes-hospitalares': 'discussoes_hospitalares',
  tuberculose: 'tuberculose',
  pot: 'pot',
  suspensoes: 'suspensoes',
};

export function acompanhamentoAtivo(config, slug) {
  const chave = MAPA_SLUG_MODULO_ACOMPANHAMENTO[slug];
  if (!chave) return true;
  return moduloAtivo(config, chave);
}
