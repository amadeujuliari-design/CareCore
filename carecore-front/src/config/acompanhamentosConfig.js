import {
  ArrowRightLeft,
  ClipboardList,
  FileBarChart,
  Hospital,
  PauseCircle,
  ShieldPlus,
  Stethoscope,
  UserRound,
} from 'lucide-react';

import { HOSPITAIS_SAOPAULO_SUS } from './hospitaisSaoPauloSus';
import { DESTINOS_TRANSFERENCIA } from './tiposAcaoAcompanhamento';

export const SITUACOES_TB = [
  'Suspeita',
  'Confirmado',
  'Em tratamento',
  'Alta',
];

export const STATUS_EVOLUCAO_DISCUSSAO = [
  'Internado',
  'Alta',
  'Encerrado',
];

/** Status permitidos na busca de convivente por módulo. */
export const STATUS_FILTRO_POR_MODULO = {
  transferencias: ['Ativo', 'Ausência justificada'],
  'discussoes-hospitalares': ['Ativo', 'Em acolhimento'],
  tuberculose: ['Ativo'],
  pot: ['Ativo'],
  suspensoes: ['Ativo'],
};

export const MODULOS_ACOMPANHAMENTO = {
  transferencias: {
    slug: 'transferencias',
    titulo: 'Encaminhamentos, saídas e ações',
    menuLabelLinhas: ['Encaminhamentos', 'saídas e ações'],
    subtitulo:
      'Registre ações do relatório mensal: contatos familiares, encaminhamentos, transferências SIAT/rede e saídas autônomas.',
    endpoint: 'transferencias',
    icone: ArrowRightLeft,
    statusFiltros: STATUS_FILTRO_POR_MODULO.transferencias,
    usaMetadadosTipoAcao: true,
    colunas: [
      { chave: 'convivente_nome', rotulo: 'Convivente' },
      { chave: 'prontuario', rotulo: 'Prontuário' },
      { chave: 'destino_exibicao', rotulo: 'Tipo de ação' },
      { chave: 'data_discussao', rotulo: 'Discussão', tipo: 'data' },
      { chave: 'data_visita', rotulo: 'Visita/saída', tipo: 'data' },
      { chave: 'data_transferencia', rotulo: 'Transferência', tipo: 'data' },
      { chave: 'registrado_por_nome', rotulo: 'Registrado por' },
    ],
    campos: [
      {
        nome: 'destino',
        rotulo: 'Tipo de ação',
        tipo: 'select',
        opcoes: DESTINOS_TRANSFERENCIA,
        opcoesAgrupadas: true,
        obrigatorio: true,
      },
      {
        nome: 'destino_outro',
        rotulo: 'Especificar ação',
        tipo: 'texto',
        visivelQuando: { campo: 'destino', valor: 'Outros' },
        obrigatorioQuando: { campo: 'destino', valor: 'Outros' },
      },
      { nome: 'data_discussao', rotulo: 'Data da discussão', tipo: 'data' },
      { nome: 'data_visita', rotulo: 'Data da visita/saída (portão)', tipo: 'data' },
      { nome: 'data_transferencia', rotulo: 'Data da transferência/efetivação', tipo: 'data' },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
    ],
    filtrosExtras: [
      { nome: 'destino', rotulo: 'Tipo de ação', tipo: 'select', opcoes: DESTINOS_TRANSFERENCIA },
    ],
  },
  'discussoes-hospitalares': {
    slug: 'discussoes-hospitalares',
    titulo: 'Discussões hospitalares',
    menuLabel: 'Discussões hosp.',
    subtitulo: 'Previsões de internação e discussões com hospitais SUS (São Paulo). Registre evoluções: Internado, Alta ou Encerrado.',
    endpoint: 'discussoes-hospitalares',
    icone: Hospital,
    statusFiltros: STATUS_FILTRO_POR_MODULO['discussoes-hospitalares'],
    suportaEvolucoes: true,
    colunas: [
      { chave: 'convivente_nome', rotulo: 'Convivente' },
      { chave: 'prontuario', rotulo: 'Prontuário' },
      { chave: 'hospital_exibicao', rotulo: 'Hospital' },
      { chave: 'situacao_atual', rotulo: 'Situação' },
      { chave: 'data_discussao', rotulo: 'Discussão', tipo: 'data' },
      { chave: 'data_prevista_entrada', rotulo: 'Previsão entrada', tipo: 'data' },
      { chave: 'registrado_por_nome', rotulo: 'Registrado por' },
    ],
    campos: [
      {
        nome: 'nome_hospital',
        rotulo: 'Hospital (SUS São Paulo)',
        tipo: 'select',
        opcoes: HOSPITAIS_SAOPAULO_SUS,
        obrigatorio: true,
      },
      {
        nome: 'hospital_outro',
        rotulo: 'Nome do hospital',
        tipo: 'texto',
        visivelQuando: { campo: 'nome_hospital', valor: 'Outros' },
        obrigatorioQuando: { campo: 'nome_hospital', valor: 'Outros' },
      },
      { nome: 'data_discussao', rotulo: 'Data da discussão', tipo: 'data' },
      { nome: 'data_prevista_entrada', rotulo: 'Previsão de entrada', tipo: 'data' },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
    ],
  },
  tuberculose: {
    slug: 'tuberculose',
    titulo: 'Tuberculose (TB)',
    menuLabel: 'TB',
    subtitulo: 'Acompanhamento de casos de tuberculose.',
    endpoint: 'tuberculose',
    icone: Stethoscope,
    statusFiltros: STATUS_FILTRO_POR_MODULO.tuberculose,
    colunas: [
      { chave: 'convivente_nome', rotulo: 'Convivente' },
      { chave: 'prontuario', rotulo: 'Prontuário' },
      { chave: 'situacao', rotulo: 'Situação' },
      { chave: 'data_inicio', rotulo: 'Início', tipo: 'data' },
      { chave: 'data_fim', rotulo: 'Alta/fim', tipo: 'data' },
      { chave: 'registrado_por_nome', rotulo: 'Registrado por' },
    ],
    campos: [
      { nome: 'situacao', rotulo: 'Situação', tipo: 'select', opcoes: SITUACOES_TB },
      { nome: 'data_inicio', rotulo: 'Data de início', tipo: 'data' },
      { nome: 'data_fim', rotulo: 'Data de alta/fim', tipo: 'data' },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
    ],
    filtrosExtras: [
      { nome: 'situacao', rotulo: 'Situação', tipo: 'select', opcoes: SITUACOES_TB },
    ],
  },
  pot: {
    slug: 'pot',
    titulo: 'POT',
    subtitulo: 'Programa de Orientação ao Trabalho.',
    endpoint: 'pot',
    icone: ShieldPlus,
    statusFiltros: STATUS_FILTRO_POR_MODULO.pot,
    colunas: [
      { chave: 'convivente_nome', rotulo: 'Convivente' },
      { chave: 'prontuario', rotulo: 'Prontuário' },
      { chave: 'data_insercao', rotulo: 'Inserção', tipo: 'data' },
      { chave: 'data_desligamento', rotulo: 'Desligamento', tipo: 'data' },
      { chave: 'congelamento_ativo', rotulo: 'Congelamento', tipo: 'simnao' },
      { chave: 'registrado_por_nome', rotulo: 'Registrado por' },
    ],
    campos: [
      { nome: 'data_insercao', rotulo: 'Data de inserção', tipo: 'data' },
      { nome: 'data_desligamento', rotulo: 'Data de desligamento', tipo: 'data' },
      { nome: 'congelamento_ativo', rotulo: 'Congelamento ativo', tipo: 'checkbox' },
      { nome: 'congelamento_inicio', rotulo: 'Início congelamento', tipo: 'data', visivelQuando: { campo: 'congelamento_ativo', valor: true } },
      { nome: 'congelamento_fim', rotulo: 'Fim congelamento', tipo: 'data', visivelQuando: { campo: 'congelamento_ativo', valor: true } },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
    ],
  },
  suspensoes: {
    slug: 'suspensoes',
    titulo: 'Suspensão provisória',
    menuLabel: 'Suspensão',
    subtitulo: 'Registro de suspensão/bloqueio. Atualiza automaticamente o status do convivente no cadastro.',
    endpoint: 'suspensoes-provisorias',
    icone: PauseCircle,
    statusFiltros: STATUS_FILTRO_POR_MODULO.suspensoes,
    colunas: [
      { chave: 'convivente_nome', rotulo: 'Convivente' },
      { chave: 'prontuario', rotulo: 'Prontuário' },
      { chave: 'mes_referencia', rotulo: 'Mês ref.', tipo: 'mes' },
      { chave: 'data_registro', rotulo: 'Data registro', tipo: 'data' },
      { chave: 'motivo', rotulo: 'Motivo' },
      { chave: 'status_aplicado', rotulo: 'Status aplicado' },
      { chave: 'registrado_por_nome', rotulo: 'Registrado por' },
    ],
    campos: [
      { nome: 'mes_referencia', rotulo: 'Mês de referência', tipo: 'month', obrigatorio: true },
      { nome: 'data_registro', rotulo: 'Data do registro', tipo: 'data', obrigatorio: true },
      { nome: 'motivo', rotulo: 'Motivo (obrigatório)', tipo: 'textarea', obrigatorio: true },
      { nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea' },
    ],
    filtrosExtras: [
      { nome: 'mes_referencia', rotulo: 'Mês referência', tipo: 'month' },
    ],
  },
};

export const MENU_ACOMPANHAMENTOS = {
  path: '/conviventes/acompanhamentos',
  icon: ClipboardList,
  label: 'Acompanhamentos',
  perfis: ['Gestor', 'Técnico', 'Global'],
  children: [
    ...Object.values(MODULOS_ACOMPANHAMENTO).map(modulo => ({
      path: `/conviventes/acompanhamentos/${modulo.slug}`,
      icon: modulo.icone,
      label: modulo.menuLabel
        || (modulo.menuLabelLinhas ? modulo.menuLabelLinhas.join(' · ') : modulo.titulo),
      menuLabelLinhas: modulo.menuLabelLinhas,
      labelTitle: modulo.titulo,
      perfis: ['Gestor', 'Técnico', 'Global'],
    })),
    {
      path: '/conviventes/acompanhamentos/resumo-mensal',
      icon: FileBarChart,
      label: 'Resumo mensal',
      perfis: ['Gestor', 'Técnico', 'Global'],
    },
  ],
};

export const MENU_CONVIVENTES = {
  path: '/conviventes',
  icon: UserRound,
  label: 'Cadastro',
  perfis: ['Gestor', 'Técnico', 'Orientador', 'Administrativo'],
};

export function obterModuloPorSlug(slug) {
  return Object.values(MODULOS_ACOMPANHAMENTO).find(item => item.slug === slug) || null;
}
