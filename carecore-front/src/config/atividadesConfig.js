export const CATEGORIAS_ATIVIDADE = [
  { valor: 'oficina', rotulo: 'Oficina' },
  { valor: 'esporte', rotulo: 'Esporte' },
  { valor: 'reuniao_tecnica', rotulo: 'Reunião técnica' },
  { valor: 'noturna', rotulo: 'Noturna' },
  { valor: 'cultural', rotulo: 'Cultural' },
  { valor: 'outra', rotulo: 'Outra' },
];

export const TIPOS_FREQUENCIA_ATIVIDADE = [
  { valor: 'diaria', rotulo: 'Diária' },
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'bisemanal', rotulo: '2x na semana' },
  { valor: 'dias_mes', rotulo: 'Dias específicos no mês' },
];

export const DIAS_SEMANA_ATIVIDADE = [
  { valor: 0, rotulo: 'Seg' },
  { valor: 1, rotulo: 'Ter' },
  { valor: 2, rotulo: 'Qua' },
  { valor: 3, rotulo: 'Qui' },
  { valor: 4, rotulo: 'Sex' },
  { valor: 5, rotulo: 'Sáb' },
  { valor: 6, rotulo: 'Dom' },
];

export const PONTOS_POR_PRESENCA_ATIVIDADE = 1;

export function mesReferenciaAtual() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

export function rotuloCategoriaAtividade(valor) {
  return CATEGORIAS_ATIVIDADE.find((item) => item.valor === valor)?.rotulo || valor;
}

export function rotuloFrequenciaAtividade(valor) {
  return TIPOS_FREQUENCIA_ATIVIDADE.find((item) => item.valor === valor)?.rotulo || valor;
}

import { vigenciaPadraoMesAtual } from '../utils/dataBrasilUtils';

export const HORARIOS_SISA_PADRAO = [
  '09:00 às 11:00',
  '09:00 às 16:00',
  '14:00 às 16:00',
  '19:00 às 21:00',
];

const CHAVE_HORARIOS_SISA_LS = 'carecore_horarios_sisa_personalizados';

export function lerHorariosSisaPersonalizados() {
  try {
    const bruto = localStorage.getItem(CHAVE_HORARIOS_SISA_LS);
    const lista = JSON.parse(bruto || '[]');
    return Array.isArray(lista) ? lista.filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function salvarHorarioSisaPersonalizado(horario) {
  const texto = String(horario || '').trim();
  if (!texto) return;
  const atual = lerHorariosSisaPersonalizados();
  const chave = texto.toLowerCase();
  if (atual.some((item) => item.toLowerCase() === chave)) return;
  localStorage.setItem(CHAVE_HORARIOS_SISA_LS, JSON.stringify([...atual, texto]));
}

export function criarFormAtividadeInicial() {
  const vigencia = vigenciaPadraoMesAtual();
  return {
    nome: '',
    categoria: 'oficina',
    responsavel_usuario_id: '',
    tipo_frequencia: 'semanal',
    configuracao_agenda: {
      dias_semana: [],
      datas_especificas: [],
      somente_dias_uteis: false,
      max_sessoes_mes: 21,
    },
    vigencia_inicio: vigencia.inicio,
    vigencia_fim: vigencia.fim,
    sisa_descricao_atividade: '',
    sisa_descricao_tema: '',
    sisa_horario_padrao: '',
    ativo: true,
  };
}

/** Somente leitura para Global puro — Manutenção e Gestor operam no projeto. */
export { usuarioSomenteLeituraAtividades } from '../utils/rbacUtils';

/** Espelho do catálogo padrão SISA (Relatório Resumo de Atividades). */
export const SISA_CATALOGO_TIPOS_PADRAO = [
  'ATIVIDADE EM GRUPO',
  'OFICINAS',
];

export const SISA_CATALOGO_TEMAS_PADRAO = [
  'ASSEMBLEIA OU REUNIAO COM PARTICIPANTES',
  'GERACOES DE RENDA',
  'ESPORTE COLETIVO',
  'ANIVERSARIANTE DO MES',
  'OCUPACIONAIS',
];

function normalizarChaveCatalogoSisa(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function catalogoSisaPadraoFrontend() {
  return {
    descricao_atividade: SISA_CATALOGO_TIPOS_PADRAO.map((valor) => ({
      valor,
      personalizado: false,
    })),
    descricao_tema: SISA_CATALOGO_TEMAS_PADRAO.map((valor) => ({
      valor,
      personalizado: false,
    })),
  };
}

export function mesclarCatalogoSisaComPadrao(catalogoApi) {
  const base = catalogoSisaPadraoFrontend();
  const resultado = {
    descricao_atividade: [...base.descricao_atividade],
    descricao_tema: [...base.descricao_tema],
  };

  ['descricao_atividade', 'descricao_tema'].forEach((chave) => {
    const vistos = new Set(
      resultado[chave].map((item) => normalizarChaveCatalogoSisa(item.valor)),
    );
    (catalogoApi?.[chave] || []).forEach((item) => {
      const valor = item?.valor;
      if (!valor) return;
      const norm = normalizarChaveCatalogoSisa(valor);
      if (vistos.has(norm)) return;
      vistos.add(norm);
      resultado[chave].push({
        valor,
        personalizado: Boolean(item.personalizado),
      });
    });
    resultado[chave].sort((a, b) => a.valor.localeCompare(b.valor, 'pt-BR'));
  });

  return resultado;
}
