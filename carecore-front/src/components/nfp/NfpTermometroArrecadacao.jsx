import { moneyRelatorioNfp } from '../../utils/relatorioNfpUtils';

const LEGENDA = [
  { key: 'parte_agente', label: 'Parte agente', className: 'bg-teal-500' },
  { key: 'parte_aeb_rateio', label: 'Parte AEB (rateio)', className: 'bg-sky-500' },
  { key: 'doador_auto', label: 'Doador automático', className: 'bg-amber-500' },
  { key: 'direto_aeb', label: 'Direto AEB', className: 'bg-violet-500' },
];

const ORIGENS_NAO_AGENTE = new Set(['AEB', 'DIRETO_AEB', 'DOADOR_AUTOMATICO_AEB', 'SEM_CAPTADOR']);

function formatarCompetenciaCurta(competencia) {
  const [ano, mes] = String(competencia || '').split('-');
  if (!ano || !mes) return competencia || '—';
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const idx = Number(mes) - 1;
  return `${nomes[idx] || mes}/${String(ano).slice(-2)}`;
}

function montarSegmentos(item) {
  const parteAgente = Number(item.parte_agente || 0);
  const parteAebTotal = Number(item.parte_aeb || 0);
  const doadorAuto = Number(item.doador_auto || 0);
  const diretoAeb = Number(item.direto_aeb || 0);
  const parteAebRateio = Math.max(0, parteAebTotal - doadorAuto - diretoAeb);

  return {
    parte_agente: parteAgente,
    parte_aeb_rateio: parteAebRateio,
    doador_auto: doadorAuto,
    direto_aeb: diretoAeb,
    total: Number(item.total_creditos || 0),
  };
}

function variacaoEntre(atual, anterior) {
  const a = Number(atual || 0);
  const b = Number(anterior || 0);
  if (b <= 0) {
    return a > 0 ? { pct: 100, sentido: 'alta', sinal: '+' } : null;
  }
  const pct = ((a - b) / b) * 100;
  return {
    pct: Math.abs(pct),
    sentido: pct > 0.05 ? 'alta' : pct < -0.05 ? 'baixa' : 'neutro',
    sinal: pct >= 0 ? '+' : '−',
  };
}

function moneyCurto(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function rankingSomenteAgentes(ranking = []) {
  return ranking.filter((item) => {
    const codigo = String(item.agente || '').trim().toUpperCase();
    if (!codigo) return false;
    if (ORIGENS_NAO_AGENTE.has(codigo)) return false;
    if (codigo.startsWith('DOADOR_AUTOMATICO_')) return false;
    return true;
  });
}

export default function NfpTermometroArrecadacao({
  serie = [],
  ranking = [],
  totais = {},
  agenteFiltro = '',
  onChangeAgenteFiltro,
  agentes = [],
  meses = 12,
  onChangeMeses,
  loading = false,
}) {
  const maxTotal = Math.max(1, ...serie.map((item) => Number(item.total_creditos || 0)));
  const rankingAgentes = rankingSomenteAgentes(ranking);

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">
            Termômetro de arrecadação
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">
            Evolução dos créditos por competência
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Cada competência tem seu termômetro (altura vs pico do período) com a composição do rateio.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={agenteFiltro}
            onChange={(e) => onChangeAgenteFiltro?.(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            title="Filtro do gráfico"
          >
            <option value="">Visão geral</option>
            {agentes.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={meses}
            onChange={(e) => onChangeMeses?.(Number(e.target.value))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Carregando série de arrecadação...</p>
      ) : !serie.length ? (
        <p className="mt-6 text-sm text-slate-500">
          Sem rateio no período. Calcule o rateio das competências para ver o termômetro.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-3">
            {LEGENDA.map((item) => (
              <span key={item.key} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span className={`h-2.5 w-2.5 rounded-full ${item.className}`} />
                {item.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
              Altura = % do pico do período
            </span>
          </div>

          <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
            {serie.map((item, index) => {
              const segmentos = montarSegmentos(item);
              const alturaPct = Math.max(8, (segmentos.total / maxTotal) * 100);
              const anterior = index > 0 ? serie[index - 1] : null;
              const mom = anterior
                ? variacaoEntre(segmentos.total, anterior.total_creditos)
                : null;
              const ehUltimo = index === serie.length - 1;
              const ehPico = segmentos.total >= maxTotal && segmentos.total > 0;

              return (
                <article
                  key={item.competencia}
                  className={`flex min-w-[120px] flex-1 flex-col items-center rounded-2xl border p-3 ${
                    ehUltimo
                      ? 'border-teal-200 bg-teal-50/70'
                      : 'border-slate-100 bg-slate-50/70'
                  }`}
                  title={`${item.competencia}: ${moneyRelatorioNfp(segmentos.total)}`}
                >
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${
                    ehUltimo ? 'text-teal-700' : 'text-slate-500'
                  }`}
                  >
                    {formatarCompetenciaCurta(item.competencia)}
                    {ehPico ? ' · pico' : ''}
                  </p>
                  <p className="mt-1 text-center text-sm font-bold text-slate-900">
                    {moneyCurto(segmentos.total)}
                  </p>
                  {mom ? (
                    <p className={`mt-1 text-[10px] font-semibold ${
                      mom.sentido === 'alta'
                        ? 'text-emerald-700'
                        : mom.sentido === 'baixa'
                          ? 'text-rose-700'
                          : 'text-slate-500'
                    }`}
                    >
                      {mom.sentido === 'neutro'
                        ? 'estável'
                        : `${mom.sinal}${mom.pct.toFixed(0)}%`}
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-400">—</p>
                  )}

                  <div className="mt-3 flex h-44 w-full items-end justify-center">
                    <div
                      className="relative flex w-11 flex-col justify-end overflow-hidden rounded-full border border-slate-200 bg-white shadow-inner"
                      style={{ height: `${alturaPct}%`, minHeight: '36px' }}
                    >
                      {LEGENDA.slice().reverse().map((leg) => {
                        const valor = Number(segmentos[leg.key] || 0);
                        if (valor <= 0 || segmentos.total <= 0) return null;
                        const pct = (valor / segmentos.total) * 100;
                        return (
                          <div
                            key={leg.key}
                            className={leg.className}
                            style={{ height: `${Math.max(3, pct)}%` }}
                            title={`${leg.label}: ${moneyRelatorioNfp(valor)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais do período</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ['Total créditos', moneyRelatorioNfp(totais.total_creditos)],
                  ['Parte agente', moneyRelatorioNfp(totais.parte_agente)],
                  ['Parte AEB', moneyRelatorioNfp(totais.parte_aeb)],
                  ['Doador automático', moneyRelatorioNfp(totais.doador_auto)],
                ].map(([label, valor]) => (
                  <div key={label}>
                    <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                    <p className="text-sm font-bold text-slate-900">{valor}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ranking de agentes no período
              </p>
              {!rankingAgentes.length ? (
                <p className="mt-3 text-sm text-slate-500">Sem ranking de agentes para o filtro atual.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {rankingAgentes.slice(0, 5).map((item) => {
                    const maxRank = Math.max(1, ...rankingAgentes.map((r) => Number(r.total_creditos || 0)));
                    const largura = Math.max(4, (Number(item.total_creditos || 0) / maxRank) * 100);
                    return (
                      <div key={item.agente}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-700">{item.agente}</span>
                          <span className="font-bold text-slate-900">{moneyRelatorioNfp(item.total_creditos)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-teal-500" style={{ width: `${largura}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          </div>
        </>
      )}
    </section>
  );
}
