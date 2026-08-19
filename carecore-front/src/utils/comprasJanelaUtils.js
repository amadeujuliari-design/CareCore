export const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export const SEMANAS_JANELA = [
  { valor: 1, rotulo: '1ª semana', faixa: 'dias 1 a 7' },
  { valor: 2, rotulo: '2ª semana', faixa: 'dias 8 a 14' },
  { valor: 3, rotulo: '3ª semana', faixa: 'dias 15 a 21' },
  { valor: 4, rotulo: '4ª semana', faixa: 'dias 22 ao fim' },
];

export function ultimoDiaMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

export function periodoSemanaUtilMes(ano, mes, numeroSemana) {
  const semana = Number(numeroSemana);
  if (![1, 2, 3, 4].includes(semana)) {
    throw new Error('Semana deve ser 1, 2, 3 ou 4.');
  }
  const ultimo = ultimoDiaMes(ano, mes);
  const blocos = { 1: [1, 7], 2: [8, 14], 3: [15, 21], 4: [22, ultimo] };
  const [diaIni, diaFim] = blocos[semana];
  const uteis = [];
  for (let dia = diaIni; dia <= diaFim; dia += 1) {
    const data = new Date(ano, mes - 1, dia);
    const dow = (data.getDay() + 6) % 7;
    if (dow < 5) {
      uteis.push(`${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`);
    }
  }
  if (!uteis.length) {
    throw new Error(`Não há dias úteis na ${semana}ª semana de ${String(mes).padStart(2, '0')}/${ano}.`);
  }
  return { data_inicio: uteis[0], data_fim: uteis[uteis.length - 1] };
}

export function detectarSemanaUtil(competencia, dataInicio, dataFim) {
  if (!competencia || !dataInicio || !dataFim) return null;
  const [ano, mes] = competencia.split('-').map(Number);
  for (const item of SEMANAS_JANELA) {
    try {
      const periodo = periodoSemanaUtilMes(ano, mes, item.valor);
      if (periodo.data_inicio === dataInicio && periodo.data_fim === dataFim) {
        return item.valor;
      }
    } catch {
      // semana sem dias úteis neste mês
    }
  }
  return null;
}

export function rotuloSemanaJanela(numeroSemana) {
  const item = SEMANAS_JANELA.find((semana) => semana.valor === Number(numeroSemana));
  return item ? `${item.rotulo} (${item.faixa}, dias úteis)` : '';
}

export function isoParaPartes(iso) {
  const texto = String(iso || '').slice(0, 10);
  const [ano, mes, dia] = texto.split('-').map((n) => Number(n));
  if (!ano || !mes) return null;
  return { ano, mes, dia: dia || 1 };
}

export function formatarDataBr(iso) {
  const partes = isoParaPartes(iso);
  if (!partes?.dia) return iso || '—';
  return `${String(partes.dia).padStart(2, '0')}/${String(partes.mes).padStart(2, '0')}/${partes.ano}`;
}

export function formatarFaixa(inicio, fim) {
  if (!inicio || !fim) return 'Janela não publicada';
  const a = isoParaPartes(inicio);
  const b = isoParaPartes(fim);
  if (!a || !b) return `${inicio} a ${fim}`;
  return `${String(a.dia).padStart(2, '0')} a ${String(b.dia).padStart(2, '0')}/${String(b.mes).padStart(2, '0')}/${b.ano}`;
}

export function competenciaDeIso(iso) {
  return String(iso || '').slice(0, 7);
}

export function ultimoDiaCompetencia(competencia) {
  const [ano, mes] = String(competencia || '').split('-').map(Number);
  if (!ano || !mes) return '';
  const dia = new Date(ano, mes, 0).getDate();
  return `${competencia}-${String(dia).padStart(2, '0')}`;
}

export function montarDiasCalendario(ano, mes, { hoje, diasLiberados = [] } = {}) {
  const liberados = new Set(diasLiberados);
  const primeiro = new Date(ano, mes - 1, 1);
  const offset = (primeiro.getDay() + 6) % 7;
  const total = new Date(ano, mes, 0).getDate();
  const celulas = [];
  for (let i = 0; i < offset; i += 1) {
    celulas.push({ key: `vazio-${i}`, vazio: true });
  }
  for (let dia = 1; dia <= total; dia += 1) {
    const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const liberado = liberados.has(iso);
    const ehHoje = iso === hoje;
    const passado = hoje ? iso < hoje : false;
    celulas.push({
      key: iso,
      iso,
      dia,
      vazio: false,
      liberado,
      ehHoje,
      passado,
      clicavel: liberado && !passado,
    });
  }
  return celulas;
}

export function rotuloStatusJanela(status) {
  if (status === 'aberta') return 'Aberta agora';
  if (status === 'futura') return 'Ainda vai abrir';
  if (status === 'encerrada') return 'Encerrada';
  return 'Não publicada';
}

export function recadoJanela({ hoje, janela }) {
  if (!janela) return 'A Sede ainda não publicou a janela deste mês.';
  if (janela.status === 'futura') {
    return `Hoje é ${formatarDataBr(hoje)}. A janela abre em ${formatarDataBr(janela.data_inicio)} — você já pode preparar o rascunho nos dias destacados.`;
  }
  if (janela.status === 'aberta') {
    return `Janela aberta de ${formatarDataBr(janela.data_inicio)} a ${formatarDataBr(janela.data_fim)}. Clique em um dia liberado para enviar ou continuar o rascunho.`;
  }
  return `A janela de ${formatarFaixa(janela.data_inicio, janela.data_fim)} já encerrou.`;
}

export function validarPeriodoJanela(inicio, fim, competencia) {
  if (!inicio || !fim) return 'Informe o início e o fim da janela.';
  if (fim < inicio) return 'A data final não pode ser anterior à inicial.';
  if (competencia && (inicio.slice(0, 7) !== competencia || fim.slice(0, 7) !== competencia)) {
    const [ano, mes] = competencia.split('-');
    const nome = MESES_PT[Number(mes) - 1] || competencia;
    return `Início e fim precisam ser dias de ${nome} de ${ano}.`;
  }
  return '';
}
