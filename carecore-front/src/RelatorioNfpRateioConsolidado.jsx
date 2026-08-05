import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileBarChart } from 'lucide-react';

import Sidebar from './Sidebar';
import {
  AppShell,
  MainShell,
  PageHeader,
  PremiumButton,
  ReportActionButton,
  ScrollArea,
} from './components/PremiumUI';
import DireitosReservadosAviso from './components/DireitosReservadosAviso';
import { nfpAcesso } from './services/nfpService';
import { nfpRelatorioRateioConsolidado } from './services/relatorioNfpService';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { buscarIdentidadeRelatoriosOrganizacao } from './utils/relatorioIdentidadePrint';
import { imprimirRelatorioNfpRateioConsolidado } from './utils/relatorioNfpPrint';
import {
  COLUNAS_RATEIO_CONSOLIDADO_AGENTE,
  COLUNAS_RATEIO_CONSOLIDADO_COMP,
  moneyRelatorioNfp,
  montarExportacaoRateioConsolidadoAgente,
  montarExportacaoRateioConsolidadoComp,
} from './utils/relatorioNfpUtils';

function competenciaAtual() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}`;
}

export default function RelatorioNfpRateioConsolidado() {
  const [competenciaInicio, setCompetenciaInicio] = useState(competenciaAtual());
  const [competenciaFim, setCompetenciaFim] = useState(competenciaAtual());
  const [agente, setAgente] = useState('');
  const [agentes, setAgentes] = useState([]);
  const [aba, setAba] = useState('competencia');
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  useEffect(() => {
    buscarIdentidadeRelatoriosOrganizacao().then(setIdentidadeRelatorio);
    nfpAcesso()
      .then((data) => setAgentes(data?.agentes_captacao || []))
      .catch(() => setAgentes([]));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const dados = await nfpRelatorioRateioConsolidado({
        competencia_inicio: competenciaInicio || undefined,
        competencia_fim: competenciaFim || undefined,
        agente: agente || undefined,
      });
      setRelatorio(dados);
    } catch (error) {
      setRelatorio(null);
      setErro(error?.response?.data?.detail || 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [agente, competenciaFim, competenciaInicio]);

  const linhas = useMemo(
    () => (aba === 'agente' ? (relatorio?.por_agente || []) : (relatorio?.por_competencia || [])),
    [aba, relatorio],
  );
  const totais = relatorio?.totais || {};

  const exportarXlsx = async () => {
    if (!linhas.length) return;
    const dados = aba === 'agente'
      ? montarExportacaoRateioConsolidadoAgente(relatorio)
      : montarExportacaoRateioConsolidadoComp(relatorio);
    await exportarRelatorioXlsx({
      nomeArquivo: `nfp_rateio_consolidado_${competenciaInicio || 'inicio'}_${competenciaFim || 'fim'}`,
      titulo: 'NFP – Rateio consolidado',
      filtros: {
        Período: `${competenciaInicio || '—'} a ${competenciaFim || '—'}`,
        Agente: agente || 'Todos',
        Visão: aba === 'agente' ? 'Por agente' : 'Por competência',
        'Total créditos': moneyRelatorioNfp(totais.total_creditos),
      },
      colunas: aba === 'agente' ? COLUNAS_RATEIO_CONSOLIDADO_AGENTE : COLUNAS_RATEIO_CONSOLIDADO_COMP,
      dados,
    });
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Relatórios"
          title="Rateio consolidado"
          subtitle="Totais por competência e ranking por agente, com identidade visual e exportação XLSX."
          icon={<FileBarChart className="h-5 w-5" />}
          backTo="/nfp/relatorios"
          backLabel="Voltar aos relatórios"
          actions={(
            <div className="flex flex-wrap gap-2">
              <ReportActionButton type="button" disabled={!linhas.length} onClick={exportarXlsx}>
                Exportar XLSX
              </ReportActionButton>
              <ReportActionButton
                type="button"
                disabled={!linhas.length}
                onClick={() => imprimirRelatorioNfpRateioConsolidado({
                  relatorio,
                  identidadeRelatorio,
                  aba,
                })}
              >
                Imprimir
              </ReportActionButton>
              <PremiumButton type="button" disabled={loading} onClick={carregar}>
                {loading ? 'Gerando...' : 'Gerar relatório'}
              </PremiumButton>
            </div>
          )}
        />

        <ScrollArea>
          <DireitosReservadosAviso className="mb-4" />
          {erro && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          <section className="mb-5 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Competência início</span>
                <input
                  type="month"
                  value={competenciaInicio}
                  onChange={(e) => setCompetenciaInicio(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Competência fim</span>
                <input
                  type="month"
                  value={competenciaFim}
                  onChange={(e) => setCompetenciaFim(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Agente</span>
                <select
                  value={agente}
                  onChange={(e) => setAgente(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {agentes.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Usa o rateio já calculado. Se a competência estiver vazia, calcule o rateio antes.
            </p>
          </section>

          {relatorio && (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                {[
                  ['Total créditos', moneyRelatorioNfp(totais.total_creditos)],
                  ['Parte agente', moneyRelatorioNfp(totais.parte_agente)],
                  ['Parte AEB', moneyRelatorioNfp(totais.parte_aeb)],
                  ['Linhas', totais.qtd_linhas ?? 0],
                ].map(([label, valor]) => (
                  <article key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">{valor}</p>
                  </article>
                ))}
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAba('competencia')}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    aba === 'competencia'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Por competência
                </button>
                <button
                  type="button"
                  onClick={() => setAba('agente')}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    aba === 'agente'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Por agente
                </button>
              </div>

              <section className="overflow-x-auto rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-2">{aba === 'agente' ? 'Agente' : 'Competência'}</th>
                      <th className="px-2 py-2">Total</th>
                      <th className="px-2 py-2">Parte agente</th>
                      <th className="px-2 py-2">Parte AEB</th>
                      <th className="px-2 py-2">Doador auto</th>
                      <th className="px-2 py-2">Direto AEB</th>
                      <th className="px-2 py-2">Linhas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((item) => (
                      <tr key={item.competencia || item.agente} className="border-t border-slate-100">
                        <td className="px-2 py-2 font-semibold text-slate-800">
                          {item.competencia || item.agente}
                        </td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.total_creditos)}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.parte_agente)}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.parte_aeb)}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.doador_auto)}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.direto_aeb)}</td>
                        <td className="px-2 py-2">{item.qtd_linhas ?? 0}</td>
                      </tr>
                    ))}
                    {!linhas.length && (
                      <tr>
                        <td colSpan={7} className="px-2 py-8 text-center text-slate-500">
                          Sem dados de rateio para o filtro informado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            </>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
