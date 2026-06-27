import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Sidebar from '../../Sidebar';
import {
  AppShell,
  MainShell,
  PageHeader,
  PremiumButton,
  ReportActionButton,
  ScrollArea,
} from '../PremiumUI';
import DireitosReservadosAviso from '../DireitosReservadosAviso';
import { buscarRelatorioPresencaLegado } from '../../services/relatorioPresencaLegadoService';
import { exportarRelatorioXlsx } from '../../utils/exportarRelatorioXlsx';
import { buscarIdentidadeRelatorios } from '../../utils/relatorioIdentidadePrint';
import { imprimirRelatorioPresencaLegado } from '../../utils/relatorioPresencaLegadoPrint';
import {
  classeCelulaPresencaLegadoDia,
  DESCRICAO_STATUS_PRESENCA_LEGADO_DIA,
  montarColunasExportacaoPresencaLegado,
  montarDadosExportacaoPresencaLegado,
  ROTULO_STATUS_PRESENCA_LEGADO_DIA,
} from '../../utils/relatorioPresencaLegadoUtils';
import { formatarDiaColuna, formatarDiaColunaCompleto } from '../../utils/relatorioPresencaUtils';

function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function periodoPadraoMesAtual() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { dataInicio: dataLocalISO(inicio), dataFim: dataLocalISO(hoje) };
}

export default function RelatorioPresencaLegado() {
  const periodoInicial = useMemo(() => periodoPadraoMesAtual(), []);
  const [dataInicio, setDataInicio] = useState(periodoInicial.dataInicio);
  const [dataFim, setDataFim] = useState(periodoInicial.dataFim);
  const [busca, setBusca] = useState('');
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  useEffect(() => {
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, []);

  const carregarRelatorio = useCallback(async () => {
    if (!dataInicio || !dataFim) {
      setErro('Informe a data inicial e a data final.');
      return;
    }

    setLoading(true);
    setErro('');
    try {
      const dados = await buscarRelatorioPresencaLegado({
        dataInicio,
        dataFim,
        busca,
      });
      setRelatorio(dados);
    } catch (error) {
      setRelatorio(null);
      setErro(error?.response?.data?.detail || 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [busca, dataFim, dataInicio]);

  const linhas = relatorio?.linhas || [];
  const dias = relatorio?.dias || [];

  const exportarXlsx = async () => {
    if (!relatorio?.linhas?.length) return;
    await exportarRelatorioXlsx({
      nomeArquivo: `presencas_legado_${relatorio.data_inicio}_${relatorio.data_fim}.xlsx`,
      colunas: montarColunasExportacaoPresencaLegado(relatorio),
      dados: montarDadosExportacaoPresencaLegado(relatorio),
      tituloPlanilha: 'Presenças legado',
    });
  };

  const imprimirRelatorio = async () => {
    await imprimirRelatorioPresencaLegado({
      relatorio,
      identidadeRelatorio,
      busca,
    });
  };

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Histórico Legado"
          title="Presenças no legado"
          subtitle="Matriz de presenças importadas do PDF SIAT na Rotina Legada. Mostra apenas dias com registro — não calcula ausências."
          icon="▦"
          actions={(
            <>
              <Link
                to="/historico-legado/rotina"
                className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Voltar à rotina legada
              </Link>
              <ReportActionButton action="export" onClick={exportarXlsx} disabled={!linhas.length}>
                Exportar
              </ReportActionButton>
              <ReportActionButton action="print" onClick={imprimirRelatorio} disabled={!linhas.length}>
                Imprimir
              </ReportActionButton>
              <PremiumButton type="button" variant="brand" onClick={carregarRelatorio} disabled={loading}>
                {loading ? 'Gerando…' : 'Gerar relatório'}
              </PremiumButton>
            </>
          )}
        />

        <ScrollArea className="pb-24">
          <DireitosReservadosAviso className="mb-4" />

          <section className="mb-6 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-gray-900">Filtros</h2>
            <p className="mt-1 text-xs text-gray-500">
              Período livre (até 93 dias). Fonte: importações de presença na Rotina Legada.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Data inicial</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Data final</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Busca</label>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, SISA ou prontuário"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </section>

          {erro && (
            <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          {relatorio && (
            <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <ResumoCard titulo="Pessoas" valor={relatorio.total_pessoas} />
              <ResumoCard titulo="Presenças (dias)" valor={relatorio.resumo?.presentes ?? 0} />
              <ResumoCard titulo="Dias no período" valor={dias.length} />
            </section>
          )}

          <section className="mb-4 flex flex-wrap gap-3 text-xs font-semibold text-gray-600">
            <Legenda cor="bg-emerald-50 text-emerald-800 border-emerald-100" rotulo="P — Presença no legado" />
            <Legenda cor="bg-slate-50 text-slate-300 border-slate-100" rotulo="· — Sem registro no legado" />
          </section>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">
            Célula vazia (·) não significa ausência confirmada — apenas que o PDF importado não registrou presença naquele dia.
          </p>

          <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            {!relatorio && !loading && (
              <p className="p-8 text-center text-sm text-gray-500">
                Escolha o período e clique em Gerar relatório.
              </p>
            )}

            {loading && (
              <p className="p-8 text-center text-sm text-gray-500">Montando matriz de presenças do legado…</p>
            )}

            {relatorio && !loading && linhas.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">Nenhuma presença encontrada para os filtros.</p>
            )}

            {relatorio && linhas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="sticky left-0 z-10 min-w-[200px] bg-gray-50 px-4 py-3 text-left font-black uppercase text-gray-500">
                        Convivente
                      </th>
                      <th className="min-w-[90px] px-3 py-3 text-left font-black uppercase text-gray-500">SISA</th>
                      {dias.map((dia) => (
                        <th
                          key={dia}
                          className="min-w-[44px] px-1 py-3 text-center font-black uppercase text-gray-500"
                          title={formatarDiaColunaCompleto(dia)}
                        >
                          {formatarDiaColuna(dia)}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center font-black uppercase text-emerald-700">Pres.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha) => (
                      <tr key={linha.pessoa_legado_id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="sticky left-0 z-[1] bg-white px-4 py-3">
                          <p className="font-bold text-gray-900">{linha.nome}</p>
                          <p className="text-[11px] text-gray-500">
                            #{linha.prontuario || 'S/N'}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-gray-600">{linha.numero_sisa || '—'}</td>
                        {dias.map((dia) => {
                          const status = linha.dias?.[dia] || 'sem_registro';
                          return (
                            <td key={`${linha.pessoa_legado_id}-${dia}`} className="px-1 py-2 text-center">
                              <span
                                title={DESCRICAO_STATUS_PRESENCA_LEGADO_DIA[status]}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-black ${classeCelulaPresencaLegadoDia(status)}`}
                              >
                                {ROTULO_STATUS_PRESENCA_LEGADO_DIA[status]}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center font-black text-emerald-700">
                          {linha.totais?.presentes ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}

function ResumoCard({ titulo, valor }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">{titulo}</p>
      <p className="mt-1 text-2xl font-black text-gray-900">{valor}</p>
    </div>
  );
}

function Legenda({ cor, rotulo }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${cor}`}>
      {rotulo}
    </span>
  );
}
