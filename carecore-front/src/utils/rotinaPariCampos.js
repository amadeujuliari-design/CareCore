export const DIAS_TRABALHO = [
  ['seg', 'Seg'],
  ['ter', 'Ter'],
  ['qua', 'Qua'],
  ['qui', 'Qui'],
  ['sex', 'Sex'],
  ['sab', 'Sáb'],
  ['dom', 'Dom'],
];

const ORDEM_DIA = Object.fromEntries(DIAS_TRABALHO.map(([codigo], indice) => [codigo, indice]));

const DIAS_SEG_SEX = ['seg', 'ter', 'qua', 'qui', 'sex'];
const DIAS_SEG_SAB = [...DIAS_SEG_SEX, 'sab'];
const DIAS_SEMANA = [...DIAS_SEG_SAB, 'dom'];

export const ESCALAS_TRABALHO = [
  ['', 'Não informado'],
  ['seg-sex', 'Segunda a sexta'],
  ['seg-sab', 'Segunda a sábado'],
  ['seg-dom', 'Segunda a domingo'],
  ['todos', 'Todos os dias'],
  ['5x2', '5x2'],
  ['6x1', '6x1'],
  ['12x36', '12x36'],
  ['dias', 'Dias específicos'],
  ['sem_escala', 'Sem escala fixa'],
];

const DIAS_POR_ESCALA = {
  'seg-sex': DIAS_SEG_SEX,
  'seg-sab': DIAS_SEG_SAB,
  'seg-dom': DIAS_SEMANA,
  todos: DIAS_SEMANA,
  '5x2': [],
  '6x1': [],
  '12x36': [],
  sem_escala: [],
};

const ESCALAS_COM_DIAS_LIVRES = new Set(['5x2', '6x1', '12x36', 'sem_escala']);

const ROTULO_DIA = {
  seg: 'segunda',
  ter: 'terça',
  qua: 'quarta',
  qui: 'quinta',
  sex: 'sexta',
  sab: 'sábado',
  dom: 'domingo',
};

const ROTULO_ESCALA = Object.fromEntries(ESCALAS_TRABALHO.filter(([codigo]) => codigo));

export const ETAPAS_ESCOLARES = [
  ['', 'Não informado'],
  ['nao_frequenta', 'Não frequenta'],
  ['creche', 'Creche'],
  ['jardim', 'Jardim de infância'],
  ['pre_escola', 'Pré-escola'],
  ['ef1', '1º ano do Fundamental'],
  ['ef2', '2º ano do Fundamental'],
  ['ef3', '3º ano do Fundamental'],
  ['ef4', '4º ano do Fundamental'],
  ['ef5', '5º ano do Fundamental'],
  ['ef6', '6º ano do Fundamental'],
  ['ef7', '7º ano do Fundamental'],
  ['ef8', '8º ano do Fundamental'],
  ['ef9', '9º ano do Fundamental'],
  ['em1', '1º ano do Ensino Médio'],
  ['em2', '2º ano do Ensino Médio'],
  ['em3', '3º ano do Ensino Médio'],
  ['eja_fundamental', 'EJA — Fundamental'],
  ['eja_medio', 'EJA — Médio'],
  ['superior', 'Ensino superior'],
  ['ead', 'EAD'],
  ['curso', 'Curso'],
  ['concluido', 'Concluído'],
];

export const TURNOS_ESCOLARES = [
  ['', 'Turno não informado'],
  ['manha', 'Manhã'],
  ['tarde', 'Tarde'],
  ['noite', 'Noite'],
  ['integral', 'Integral'],
];

const ROTULO_ETAPA = Object.fromEntries(ETAPAS_ESCOLARES.filter(([codigo]) => codigo));
const ROTULO_TURNO = Object.fromEntries(TURNOS_ESCOLARES.filter(([codigo]) => codigo));

export function listaDias(valor) {
  return String(valor || '')
    .split(',')
    .map((dia) => dia.trim())
    .filter((dia) => ORDEM_DIA[dia] !== undefined);
}

export function diasDaEscala(escala) {
  if (!Object.prototype.hasOwnProperty.call(DIAS_POR_ESCALA, escala)) return undefined;
  return DIAS_POR_ESCALA[escala];
}

export function escalaDosDias(dias, escalaAtual = '') {
  if (ESCALAS_COM_DIAS_LIVRES.has(escalaAtual)) return escalaAtual;
  const chave = [...dias].sort((a, b) => ORDEM_DIA[a] - ORDEM_DIA[b]).join(',');
  if (!chave) return '';
  const diasAtuais = DIAS_POR_ESCALA[escalaAtual];
  if (diasAtuais && diasAtuais.join(',') === chave) return escalaAtual;
  const preset = Object.entries(DIAS_POR_ESCALA).find(([, lista]) => lista.length > 0 && lista.join(',') === chave);
  if (preset) return preset[0];
  return 'dias';
}

function faixaHorario(inicio, fim) {
  const a = String(inicio || '').trim();
  const b = String(fim || '').trim();
  if (a && b) return `${a}–${b}`;
  return a || b || '';
}

function textoDias(valor) {
  const dias = listaDias(valor).map((dia) => ROTULO_DIA[dia]);
  if (dias.length <= 1) return dias[0] || '';
  if (dias.length === 2) return `${dias[0]} e ${dias[1]}`;
  return `${dias.slice(0, -1).join(', ')} e ${dias.at(-1)}`;
}

export function linhasRotinaPari(convivente = {}) {
  const linhas = [];
  const ocupacao = String(convivente.ocupacao_trabalho || '').trim();
  if (ocupacao) linhas.push({ rotulo: 'Trabalho / ocupação', valor: ocupacao });

  const escala = ROTULO_ESCALA[convivente.escala_trabalho] || '';
  const dias = textoDias(convivente.dias_trabalho);
  let escalaTexto = escala;
  if (dias && escala && !['Segunda a sexta', 'Segunda a sábado', 'Segunda a domingo', 'Todos os dias'].includes(escala)) {
    escalaTexto = `${escala} (${dias})`;
  } else if (!escala) {
    escalaTexto = dias;
  }
  if (escalaTexto) linhas.push({ rotulo: 'Escala', valor: escalaTexto });

  const jornada = faixaHorario(convivente.trabalho_inicio, convivente.trabalho_fim);
  if (jornada) linhas.push({ rotulo: 'Jornada', valor: jornada });

  const parcerias = String(convivente.parcerias || '').trim();
  if (parcerias) linhas.push({ rotulo: 'Parcerias', valor: parcerias });

  let etapa = ROTULO_ETAPA[convivente.etapa_escolar] || '';
  const curso = String(convivente.curso_escolar || '').trim();
  if (convivente.etapa_escolar === 'curso' && curso) etapa = `Curso: ${curso}`;
  if (etapa) linhas.push({ rotulo: 'Escolar', valor: etapa });

  const turno = ROTULO_TURNO[convivente.turno_escolar] || '';
  if (turno) linhas.push({ rotulo: 'Turno escolar', valor: turno });

  const aula = faixaHorario(convivente.escolar_inicio, convivente.escolar_fim);
  if (aula) linhas.push({ rotulo: 'Horário escolar', valor: aula });

  return linhas;
}

export function textoRotinaLista(convivente = {}) {
  const partes = linhasRotinaPari(convivente).map((item) => `${item.rotulo}: ${item.valor}`);
  const aviso = String(convivente.observacao_operacional || '').trim();
  if (aviso) partes.push(`Avisos/Alertas: ${aviso}`);
  return partes.join(' | ');
}
