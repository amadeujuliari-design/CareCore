// =====================================================================
// ARQUIVO: src/DashboardOperacional.jsx
// DASHBOARD OPERACIONAL DA ROTINA — CARECORE+
// =====================================================================
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { API_ROOT } from './config/apiBase';
import { criarHeadersAutenticados } from './utils/requestIdUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { perfilOcultaSomatoriaAlimentacao } from './utils/rotinaDiariaUtils';

const METRICAS_LABEL = {
  dentro_projeto: 'Dentro do projeto',
  fora_projeto: 'Fora do projeto',
  conviventes_ativos: 'Conviventes ativos',
  sem_interacao_24h: 'Sem interação 24h',
  ausentes_operacionais: 'Ausentes operacionais',
  total_interacoes_hoje: 'Total de interações',
  total_registros_hoje: 'Total de registros',
  retornos_rapidos_hoje: 'Retornos rápidos',
  cancelados_hoje: 'Cancelados',
  editados_hoje: 'Editados',
  'interacao:Entrada': 'Entradas',
  'interacao:Saída': 'Saídas',
  'interacao:Café da manhã': 'Café da manhã',
  'interacao:Almoço': 'Almoço',
  'interacao:Jantar': 'Jantar',
  'interacao:Lanche noturno': 'Lanche noturno',
};

const METRICAS_PADRAO = [
  'dentro_projeto',
  'fora_projeto',
  'total_interacoes_hoje',
];

const CORES_SERIE = {
  dentro_projeto: '#059669',
  fora_projeto: '#ea580c',
  'interacao:Entrada': '#2563eb',
  'interacao:Saída': '#e11d48',
  total_interacoes_hoje: '#7c3aed',
  conviventes_ativos: '#334155',
  sem_interacao_24h: '#d97706',
  ausentes_operacionais: '#dc2626',
  total_registros_hoje: '#0f766e',
  retornos_rapidos_hoje: '#db2777',
  cancelados_hoje: '#991b1b',
  editados_hoje: '#a16207',
};

const PALETA_INTERACOES = [
  '#0891b2', '#4f46e5', '#16a34a', '#d97706', '#db2777',
  '#0d9488', '#7c3aed', '#b45309', '#0369a1', '#be123c',
];

function labelMetrica(chave) {
  if (METRICAS_LABEL[chave]) return METRICAS_LABEL[chave];
  if (String(chave).startsWith('interacao:')) {
    return String(chave).slice('interacao:'.length);
  }
  return chave;
}

function corSerie(chave) {
  if (CORES_SERIE[chave]) return CORES_SERIE[chave];
  const texto = String(chave);
  let hash = 0;
  for (let i = 0; i < texto.length; i += 1) {
    hash = ((hash << 5) - hash) + texto.charCodeAt(i);
    hash |= 0;
  }
  return PALETA_INTERACOES[Math.abs(hash) % PALETA_INTERACOES.length];
}

function dataLocalISO(diasAtras = 0) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - diasAtras);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatarDataCurta(iso) {
  if (!iso) return '-';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function GraficoMultiSerie({ series, metricasAtivas, onSelecionar }) {
  const chaves = metricasAtivas.filter((k) => Array.isArray(series?.[k]) && series[k].length);
  const datas = chaves.length
    ? (series[chaves[0]] || []).map((p) => p.data)
    : [];
  const largura = 680;
  const altura = 240;
  const padX = 40;
  const padY = 30;

  const todosValores = chaves.flatMap((k) => (series[k] || []).map((p) => Number(p.valor) || 0));
  const maxValor = Math.max(...todosValores, 1);
  const span = maxValor || 1;

  if (!datas.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm font-semibold text-gray-500">
        Ainda não há retratos 22:00 neste período.
      </div>
    );
  }

  const xDe = (i) => padX + (datas.length <= 1 ? 0 : (i / (datas.length - 1)) * (largura - padX * 2));
  const yDe = (v) => altura - padY - ((Number(v) || 0) / span) * (altura - padY * 2);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${largura} ${altura}`} className="min-w-[560px] w-full h-auto" role="img" aria-label="Evolução dos totais diários">
        <line x1={padX} y1={altura - padY} x2={largura - padX} y2={altura - padY} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={padX} y1={padY} x2={padX} y2={altura - padY} stroke="#e5e7eb" strokeWidth="1" />
        <text x={padX - 8} y={padY + 4} textAnchor="end" className="fill-gray-400" fontSize="10" fontWeight="700">{maxValor}</text>
        <text x={padX - 8} y={altura - padY} textAnchor="end" className="fill-gray-400" fontSize="10" fontWeight="700">0</text>

        {chaves.map((chave) => {
          const pontos = series[chave] || [];
          const path = pontos
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xDe(i).toFixed(1)} ${yDe(p.valor).toFixed(1)}`)
            .join(' ');
          const cor = corSerie(chave);
          return (
            <g key={chave}>
              <path d={path} fill="none" stroke={cor} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              {pontos.map((p, i) => (
                <circle
                  key={`${chave}-${p.data}`}
                  cx={xDe(i)}
                  cy={yDe(p.valor)}
                  r="3.5"
                  fill="#fff"
                  stroke={cor}
                  strokeWidth="1.8"
                  className="cursor-pointer"
                  onClick={() => onSelecionar?.(p.data)}
                >
                  <title>{`${labelMetrica(chave)} · ${formatarDataCurta(p.data)}: ${p.valor}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {datas.map((data, idx) => (
          (datas.length <= 12 || idx % Math.ceil(datas.length / 8) === 0) ? (
            <text key={data} x={xDe(idx)} y={altura - 8} textAnchor="middle" className="fill-gray-400" fontSize="9" fontWeight="700">
              {formatarDataCurta(data).slice(0, 5)}
            </text>
          ) : null
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 justify-center">
        {chaves.map((chave) => (
          <span key={chave} className="inline-flex items-center gap-1.5 text-[11px] font-black text-gray-600">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: corSerie(chave) }} />
            {labelMetrica(chave)}
          </span>
        ))}
      </div>
      <p className="mt-1 text-center text-[11px] font-bold text-gray-400">
        Clique em um ponto para abrir o retrato daquele dia
      </p>
    </div>
  );
}

export default function DashboardOperacional() {
  const token = localStorage.getItem('@CareCore:token');

  let perfilUsuario = '';
  try {
    if (token) {
      const payload = decodificarPayloadJwt(token) || {};
      perfilUsuario = payload?.perfil_acesso || '';
    }
  } catch {
    perfilUsuario = '';
  }

  const ocultarSomatoriaAlimentacao = perfilOcultaSomatoriaAlimentacao(perfilUsuario);

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [abaLista, setAbaLista] = useState('presentes');

  const [histDataInicio, setHistDataInicio] = useState(() => dataLocalISO(29));
  const [histDataFim, setHistDataFim] = useState(() => dataLocalISO(0));
  const [histSeries, setHistSeries] = useState({});
  const [histItems, setHistItems] = useState([]);
  const [histMetricas, setHistMetricas] = useState(Object.keys(METRICAS_LABEL));
  const [metricasAtivas, setMetricasAtivas] = useState(METRICAS_PADRAO);
  const [histLoading, setHistLoading] = useState(false);
  const [histErro, setHistErro] = useState('');
  const [retrato, setRetrato] = useState(null);
  const [retratoLoading, setRetratoLoading] = useState(false);

  const headers = useMemo(() => criarHeadersAutenticados(token), [token]);

  const carregarDashboard = useCallback(async (signal) => {
    try {
      setErro('');
      setLoading(true);

      const response = await axios.get(
        `${API_ROOT}/rotina/dashboard-operacional`,
        {
          headers,
          params: { limite_listas: 80 },
          signal,
        }
      );

      setDados(response.data);
    } catch (error) {
      if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') {
        return;
      }

      console.error(error);
      setErro(
        error.response?.data?.detail ||
        'Erro ao carregar dashboard operacional.'
      );
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const carregarHistorico = useCallback(async (signal) => {
    try {
      setHistErro('');
      setHistLoading(true);
      const response = await axios.get(
        `${API_ROOT}/rotina/dashboard-operacional/snapshots`,
        {
          headers,
          params: {
            data_inicio: histDataInicio,
            data_fim: histDataFim,
            limite: 60,
          },
          signal,
        }
      );
      setHistSeries(response.data?.series || {});
      setHistItems(response.data?.items || []);
      if (Array.isArray(response.data?.metricas_disponiveis) && response.data.metricas_disponiveis.length) {
        setHistMetricas(response.data.metricas_disponiveis);
      }
    } catch (error) {
      if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error(error);
      setHistErro(
        error.response?.data?.detail ||
        'Erro ao carregar histórico de retratos.'
      );
    } finally {
      setHistLoading(false);
    }
  }, [headers, histDataInicio, histDataFim]);

  const carregarRetrato = useCallback(async (dataRef) => {
    if (!dataRef) return;
    const dataNorm = String(dataRef).slice(0, 10);
    try {
      setRetratoLoading(true);
      setHistErro('');
      const response = await axios.get(
        `${API_ROOT}/rotina/dashboard-operacional/snapshots/${dataNorm}`,
        { headers }
      );
      setRetrato(response.data);
    } catch (error) {
      console.error(error);
      const local = histItems.find((item) => item.data_referencia === dataNorm);
      if (local) {
        setRetrato(local);
        setHistErro('');
        return;
      }
      setHistErro(
        error.response?.data?.detail ||
        'Retrato não encontrado para esta data.'
      );
      setRetrato(null);
    } finally {
      setRetratoLoading(false);
    }
  }, [headers, histItems]);

  useEffect(() => {
    const controller = new AbortController();
    carregarDashboard(controller.signal);
    return () => controller.abort();
  }, [carregarDashboard]);

  useEffect(() => {
    const controller = new AbortController();
    carregarHistorico(controller.signal);
    return () => controller.abort();
  }, [carregarHistorico]);

  const formatarDataHora = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleString('pt-BR');
  };

  const formatarHora = (data) => {
    if (!data) return '-';
    return new Date(data).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatarTempoDesde = (data) => {
    if (!data) return 'Sem registro anterior';
    const dataRegistro = new Date(data).getTime();
    if (Number.isNaN(dataRegistro)) return 'Sem registro anterior';
    const diferencaMs = Math.max(Date.now() - dataRegistro, 0);
    const minutos = Math.floor(diferencaMs / (60 * 1000));
    if (minutos < 1) return 'agora há pouco';
    if (minutos < 60) return `há ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `há ${horas} h`;
    const dias = Math.floor(horas / 24);
    return `há ${dias} dia${dias === 1 ? '' : 's'}`;
  };

  const resumo = dados?.resumo || {};
  const interacoesHoje = dados?.interacoes_hoje || {};
  const limiteListaOperacional = 80;
  const resumoRetrato = retrato?.resumo || {};
  const interacoesRetrato = retrato?.interacoes_hoje || {};

  const listaAtual = useMemo(() => {
    if (!dados) return [];
    if (abaLista === 'presentes') return dados.presentes || [];
    if (abaLista === 'fora') return dados.fora || [];
    if (abaLista === 'ausentes') return dados.ausentes_operacionais || [];
    return dados.sem_interacao_24h || dados.sem_movimento || [];
  }, [dados, abaLista]);

  const totalListaAtual = useMemo(() => {
    if (abaLista === 'presentes') return dados?.listas_totais?.presentes ?? listaAtual.length;
    if (abaLista === 'fora') return dados?.listas_totais?.fora ?? listaAtual.length;
    if (abaLista === 'ausentes') {
      return dados?.listas_totais?.ausentes_operacionais ?? listaAtual.length;
    }
    return dados?.listas_totais?.sem_interacao_24h
      ?? dados?.listas_totais?.sem_movimento
      ?? listaAtual.length;
  }, [abaLista, dados, listaAtual.length]);

  const listaAtualVisivel = useMemo(() => {
    return listaAtual.slice(0, limiteListaOperacional);
  }, [listaAtual]);

  const metricasSelect = useMemo(() => {
    const vistas = new Set();
    return histMetricas.filter((chave) => {
      const rotulo = labelMetrica(chave).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (vistas.has(rotulo)) return false;
      vistas.add(rotulo);

      if (!ocultarSomatoriaAlimentacao) return true;
      return !(
        rotulo.includes('cafe')
        || rotulo.includes('almoco')
        || rotulo.includes('jantar')
        || rotulo.includes('lanche')
      );
    });
  }, [histMetricas, ocultarSomatoriaAlimentacao]);

  const alternarMetrica = (chave) => {
    setMetricasAtivas((atual) => {
      if (atual.includes(chave)) {
        if (atual.length === 1) return atual;
        return atual.filter((item) => item !== chave);
      }
      return [...atual, chave];
    });
  };

  const cardsPrincipais = [
    {
      label: 'Dentro do projeto',
      valor: resumo.dentro_projeto ?? resumo.presentes_agora ?? 0,
      detalhe: `${resumo.percentual_presentes || 0}% dos ativos sem saída vigente`,
      classe: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    },
    {
      label: 'Fora do projeto',
      valor: resumo.fora_projeto ?? resumo.fora_agora ?? 0,
      detalhe: 'último fluxo confirmado como saída',
      classe: 'bg-orange-50 text-orange-700 border-orange-100'
    },
    {
      label: 'Entradas hoje',
      valor: resumo.entradas_hoje || 0,
      detalhe: 'registros válidos',
      classe: 'bg-blue-50 text-blue-700 border-blue-100'
    },
    {
      label: 'Saídas hoje',
      valor: resumo.saidas_hoje || 0,
      detalhe: 'registros válidos',
      classe: 'bg-rose-50 text-rose-700 border-rose-100'
    }
  ];

  const cardsSecundarios = [
    ...(!ocultarSomatoriaAlimentacao
      ? [
        { label: 'Cafés da manhã hoje', valor: resumo.cafes_hoje || 0 },
        { label: 'Almoços hoje', valor: resumo.almocos_hoje || 0 },
        { label: 'Jantares hoje', valor: resumo.jantares_hoje || 0 },
        { label: 'Lanches noturnos hoje', valor: resumo.lanches_noturnos_hoje || 0 },
      ]
      : []),
    { label: 'Total de conviventes ativos', valor: resumo.conviventes_ativos || 0 },
    { label: 'Total de interações hoje', valor: resumo.total_interacoes_hoje || 0 },
    { label: 'Total de registros hoje', valor: resumo.total_registros_hoje || 0 },
    { label: 'Sem interação 24h', valor: resumo.sem_interacao_24h ?? resumo.sem_movimento ?? 0 },
    { label: 'Ausentes (saída ontem)', valor: resumo.ausentes_operacionais || 0 }
  ];

  const cardsRetratoPrincipais = [
    {
      label: 'Dentro do projeto',
      valor: resumoRetrato.dentro_projeto ?? resumoRetrato.presentes_agora ?? 0,
      classe: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    },
    {
      label: 'Fora do projeto',
      valor: resumoRetrato.fora_projeto ?? resumoRetrato.fora_agora ?? 0,
      classe: 'bg-orange-50 text-orange-700 border-orange-100'
    },
    {
      label: 'Entradas',
      valor: resumoRetrato.entradas_hoje || 0,
      classe: 'bg-blue-50 text-blue-700 border-blue-100'
    },
    {
      label: 'Saídas',
      valor: resumoRetrato.saidas_hoje || 0,
      classe: 'bg-sky-50 text-sky-700 border-sky-100'
    },
  ];

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Rotina"
          title="Dashboard Operacional"
          subtitle="Estado ao vivo e retratos diários às 22:00 (São Paulo), com totais de dentro/fora do projeto e interações."
          icon=">"
          actions={(
            <>
              {dados?.atualizado_em && (
                <span className="text-xs font-bold text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2">
                  Atualizado: {formatarDataHora(dados.atualizado_em)}
                </span>
              )}
              <PremiumButton
                type="button"
                variant="brand"
                onClick={() => {
                  carregarDashboard();
                  carregarHistorico();
                }}
              >
                Atualizar
              </PremiumButton>
            </>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="w-full max-w-7xl mx-auto">

            {erro && (
              <div className="mb-6 bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4 text-sm font-semibold">
                {erro}
              </div>
            )}

            {loading ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-500">
                Carregando dashboard operacional...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5">
                  {cardsPrincipais.map((card) => (
                    <div
                      key={card.label}
                      className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${card.classe}`}
                    >
                      <p className="text-[10px] sm:text-xs font-black uppercase tracking-wide opacity-80">
                        {card.label}
                      </p>
                      <p className="text-3xl sm:text-4xl font-black mt-2">
                        {card.valor}
                      </p>
                      <p className="text-[11px] sm:text-xs font-bold mt-2 opacity-80">
                        {card.detalhe}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3 mb-5">
                  {cardsSecundarios.map((card) => (
                    <div
                      key={card.label}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4"
                    >
                      <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-wide">
                        {card.label}
                      </p>
                      <p className="text-xl sm:text-2xl font-black text-gray-800 mt-1">
                        {card.valor}
                      </p>
                    </div>
                  ))}
                </div>

                {Object.keys(interacoesHoje).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
                    <h2 className="font-black text-gray-800">Interações de hoje (por tipo)</h2>
                    <p className="text-xs text-gray-500 mt-1 mb-3">
                      Totais do dia — também entram no retrato das 22:00.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(interacoesHoje).map(([tipo, qtd]) => (
                        <span
                          key={tipo}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-black text-gray-700"
                        >
                          {tipo}
                          <span className="rounded-lg bg-white px-2 py-0.5 text-sm text-teal-800 border border-teal-100">
                            {qtd}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
                  <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="font-black text-gray-800">Histórico — retrato 22:00 (São Paulo)</h2>
                      <p className="text-xs text-gray-500 mt-1">
                        Um retrato por projeto/dia. Não sobrescreve. Inclui totais de dentro/fora e interações.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                      <label className="text-[11px] font-black text-gray-500 uppercase">
                        De
                        <input
                          type="date"
                          value={histDataInicio}
                          onChange={(e) => setHistDataInicio(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700"
                        />
                      </label>
                      <label className="text-[11px] font-black text-gray-500 uppercase">
                        Até
                        <input
                          type="date"
                          value={histDataFim}
                          onChange={(e) => setHistDataFim(e.target.value)}
                          className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {metricasSelect.map((chave) => {
                      const ativa = metricasAtivas.includes(chave);
                      return (
                        <button
                          key={chave}
                          type="button"
                          onClick={() => alternarMetrica(chave)}
                          className={`rounded-xl border px-3 py-1.5 text-[11px] font-black ${
                            ativa
                              ? 'border-teal-600 bg-teal-600 text-white'
                              : 'border-gray-200 bg-white text-gray-600'
                          }`}
                        >
                          {labelMetrica(chave)}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setMetricasAtivas(METRICAS_PADRAO.filter((k) => metricasSelect.includes(k)))}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-[11px] font-black text-gray-600"
                    >
                      Resetar (dentro/fora/interações)
                    </button>
                  </div>
                  <p className="mb-3 text-[11px] font-semibold text-gray-400">
                    Padrão: dentro, fora e total de interações (sem entrada/saída). Ative Entradas, Saídas, Banho, Bagageiro e demais tipos conforme precisar.
                  </p>

                  {histErro && (
                    <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                      {histErro}
                    </div>
                  )}

                  {histLoading ? (
                    <div className="py-8 text-center text-sm text-gray-500">Carregando histórico...</div>
                  ) : (
                    <GraficoMultiSerie
                      series={histSeries}
                      metricasAtivas={metricasAtivas}
                      onSelecionar={carregarRetrato}
                    />
                  )}

                  {histItems.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {histItems.slice(0, 14).map((item) => (
                        <button
                          key={item.id || item.data_referencia}
                          type="button"
                          onClick={() => carregarRetrato(item.data_referencia)}
                          className={`rounded-xl border px-3 py-2 text-xs font-black ${
                            retrato?.data_referencia === item.data_referencia
                              ? 'border-teal-600 bg-teal-600 text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-teal-300'
                          }`}
                        >
                          {formatarDataCurta(item.data_referencia)}
                          <span className="ml-2 opacity-80">
                            D {item.resumo?.dentro_projeto ?? '-'} · F {item.resumo?.fora_projeto ?? '-'}
                          </span>
                          {item.ajustes_manuais?.tem_ajuste ? (
                            <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                              +ajuste
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}

                  {(retrato || retratoLoading) && (
                    <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div>
                          <h3 className="font-black text-teal-900">
                            Retrato de {formatarDataCurta(retrato?.data_referencia)}
                          </h3>
                          <p className="text-xs font-semibold text-teal-800/80">
                            Capturado em {formatarDataHora(retrato?.capturado_em)}
                          </p>
                          {retrato?.ajustes_manuais?.tem_ajuste && (
                            <p className="mt-1 text-xs font-bold text-amber-800">
                              Inclui ajuste manual (+{retrato.ajustes_manuais.total_complemento || 0})
                              {retrato.ajustes_manuais.por_tipo
                                ? ` · ${Object.entries(retrato.ajustes_manuais.por_tipo)
                                  .map(([tipo, qtd]) => `${tipo} +${qtd}`)
                                  .join(', ')}`
                                : ''}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setRetrato(null)}
                          className="rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-black text-teal-800"
                        >
                          Fechar retrato
                        </button>
                      </div>

                      {retratoLoading ? (
                        <p className="text-sm text-teal-800">Carregando retrato...</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
                            {cardsRetratoPrincipais.map((card) => (
                              <div key={card.label} className={`rounded-xl border p-3 ${card.classe}`}>
                                <p className="text-[10px] font-black uppercase opacity-80">{card.label}</p>
                                <p className="text-2xl font-black mt-1">{card.valor}</p>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                            {[
                              ['Ativos', resumoRetrato.conviventes_ativos],
                              ['Interações', resumoRetrato.total_interacoes_hoje],
                              ['Sem interação 24h', resumoRetrato.sem_interacao_24h ?? resumoRetrato.sem_movimento],
                              ['Ausentes', resumoRetrato.ausentes_operacionais],
                              ...(!ocultarSomatoriaAlimentacao
                                ? [
                                  ['Cafés', resumoRetrato.cafes_hoje],
                                  ['Almoços', resumoRetrato.almocos_hoje],
                                  ['Jantares', resumoRetrato.jantares_hoje],
                                  ['Lanches', resumoRetrato.lanches_noturnos_hoje],
                                ]
                                : []),
                            ].map(([label, valor]) => (
                              <div key={label} className="rounded-xl border border-white bg-white/80 p-3">
                                <p className="text-[10px] font-black uppercase text-gray-400">{label}</p>
                                <p className="text-lg font-black text-gray-800">{valor ?? 0}</p>
                              </div>
                            ))}
                          </div>
                          {Object.keys(interacoesRetrato).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(interacoesRetrato).map(([tipo, qtd]) => (
                                <span
                                  key={tipo}
                                  className="inline-flex items-center gap-2 rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-black text-teal-900"
                                >
                                  {tipo}
                                  <span className="text-sm">{qtd}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <h2 className="font-black text-gray-800">
                          Situação dos conviventes
                        </h2>
                        <p className="text-xs text-gray-500 mt-1">
                          Ativos sem saída registrada são considerados dentro do projeto.
                        </p>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                        <button
                          type="button"
                          onClick={() => setAbaLista('presentes')}
                          className={`min-w-fit px-3 py-2 rounded-xl text-xs font-black border ${
                            abaLista === 'presentes'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          Dentro do projeto
                        </button>
                        <button
                          type="button"
                          onClick={() => setAbaLista('fora')}
                          className={`min-w-fit px-3 py-2 rounded-xl text-xs font-black border ${
                            abaLista === 'fora'
                              ? 'bg-orange-600 text-white border-orange-600'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          Fora do projeto
                        </button>
                        <button
                          type="button"
                          onClick={() => setAbaLista('sem_interacao')}
                          className={`min-w-fit px-3 py-2 rounded-xl text-xs font-black border ${
                            abaLista === 'sem_interacao'
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          Sem interação 24h
                        </button>
                        <button
                          type="button"
                          onClick={() => setAbaLista('ausentes')}
                          className={`min-w-fit px-3 py-2 rounded-xl text-xs font-black border ${
                            abaLista === 'ausentes'
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-white text-gray-600 border-gray-200'
                          }`}
                        >
                          Ausentes
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 p-3 md:hidden">
                      {listaAtual.length === 0 ? (
                        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                          Nenhum convivente nesta visão.
                        </div>
                      ) : (
                        listaAtualVisivel.map((item) => (
                          <article
                            key={item.convivente_id}
                            className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black uppercase text-gray-800">
                                  {item.convivente_nome}
                                </p>
                                <p className="mt-1 text-xs font-semibold text-gray-500">
                                  Prontuário #{item.numero_institucional || 'S/N'}
                                </p>
                              </div>
                              {abaLista !== 'sem_interacao' && item.tipo_registro ? (
                                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${
                                  item.tipo_registro === 'Entrada'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-orange-50 text-orange-700 border-orange-200'
                                }`}>
                                  {item.tipo_registro}
                                </span>
                              ) : (
                                <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-black text-gray-500">
                                  {abaLista === 'presentes'
                                    ? 'Dentro do projeto'
                                    : abaLista === 'ausentes'
                                      ? 'Ausente operacional'
                                      : 'Fora do projeto'}
                                </span>
                              )}
                            </div>
                            <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-600">
                              {abaLista === 'sem_interacao'
                                ? `Último registro: ${formatarDataHora(item.data_registro)} (${formatarTempoDesde(item.data_registro)})`
                                : `Último fluxo: ${formatarDataHora(item.data_registro)}`}
                            </div>
                          </article>
                        ))
                      )}
                      {totalListaAtual > listaAtualVisivel.length && (
                        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-center text-xs font-bold text-blue-700">
                          Exibindo os primeiros {listaAtualVisivel.length} de {totalListaAtual}. Use os filtros da rotina para uma lista completa.
                        </div>
                      )}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full min-w-[680px]">
                        <thead className="bg-gray-50 border-b border-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Convivente</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Prontuário</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Estado</th>
                            <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">Último registro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {listaAtual.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="text-center py-10 text-gray-500 text-sm">
                                Nenhum convivente nesta visão.
                              </td>
                            </tr>
                          ) : (
                            listaAtualVisivel.map((item) => (
                              <tr key={item.convivente_id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-black text-gray-800 uppercase">
                                  {item.convivente_nome}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  #{item.numero_institucional || 'S/N'}
                                </td>
                                <td className="px-4 py-3">
                                  {abaLista !== 'sem_interacao' && item.tipo_registro ? (
                                    <span className={`text-xs font-black px-3 py-1 rounded-full border ${
                                      item.tipo_registro === 'Entrada'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}>
                                      {item.tipo_registro}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-black px-3 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                                      {abaLista === 'presentes' ? 'Ativo sem saída' : 'Sem movimentação hoje'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  <span className="font-semibold">{formatarDataHora(item.data_registro)}</span>
                                  {abaLista === 'sem_interacao' && (
                                    <span className="ml-2 text-xs font-bold text-gray-400">
                                      {formatarTempoDesde(item.data_registro)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                          {totalListaAtual > listaAtualVisivel.length && (
                            <tr>
                              <td colSpan={4} className="px-4 py-4 text-center text-xs font-bold text-blue-700 bg-blue-50">
                                Exibindo os primeiros {listaAtualVisivel.length} de {totalListaAtual}. Use os filtros da rotina para uma lista completa.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-gray-100">
                        <h2 className="font-black text-gray-800">Alertas operacionais</h2>
                        <p className="text-xs text-gray-500 mt-1">
                          Pontos de atenção para conferência da equipe.
                        </p>
                      </div>
                      <div className="p-4 space-y-3">
                        {(dados?.alertas || []).length === 0 ? (
                          <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl p-4">
                            Nenhum alerta operacional no momento.
                          </div>
                        ) : (
                          dados.alertas.map((alerta) => (
                            <div
                              key={alerta.tipo}
                              className="border border-amber-100 bg-amber-50 rounded-xl p-4"
                            >
                              <p className="text-sm font-black text-amber-800">{alerta.titulo}</p>
                              <p className="text-xs font-semibold text-amber-700 mt-1">{alerta.descricao}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="p-4 border-b border-gray-100">
                        <h2 className="font-black text-gray-800">Últimos registros de hoje</h2>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {(dados?.ultimos_registros || []).length === 0 ? (
                          <div className="p-4 text-sm text-gray-500">Nenhum registro hoje.</div>
                        ) : (
                          dados.ultimos_registros.map((registro) => (
                            <div key={registro.id} className="p-4 hover:bg-gray-50">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black text-gray-800 uppercase">
                                    {registro.convivente_nome}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    #{registro.numero_institucional || 'S/N'} · {registro.usuario_nome || 'Usuário'}
                                  </p>
                                </div>
                                <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${
                                  registro.tipo_registro === 'Entrada'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : registro.tipo_registro === 'Saída'
                                      ? 'bg-orange-50 text-orange-700 border-orange-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {registro.tipo_registro}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className="text-xs text-gray-500 font-semibold">
                                  {formatarHora(registro.data_registro)}
                                </span>
                                {registro.retorno_rapido && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                                    RETORNO RÁPIDO
                                  </span>
                                )}
                                {registro.foi_editado && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-100">
                                    EDITADO
                                  </span>
                                )}
                                {registro.cancelado && (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                                    CANCELADO
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
