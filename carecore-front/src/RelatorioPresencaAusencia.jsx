import { useCallback, useEffect, useMemo, useState } from 'react';

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
import api from './services/api';
import { buscarRelatorioPresencaPeriodo } from './services/relatorioPresencaService';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { buscarIdentidadeRelatorios } from './utils/relatorioIdentidadePrint';
import { imprimirRelatorioPresencaPeriodo } from './utils/relatorioPresencaPrint';
import {
  classeCelulaPresencaDia,
  DESCRICAO_STATUS_PRESENCA_DIA,
  formatarDiaColuna,
  formatarDiaColunaCompleto,
  montarColunasExportacaoPresenca,
  montarDadosExportacaoPresenca,
  ROTULO_STATUS_PRESENCA_DIA,
  FILTROS_SITUACAO_PRESENCA,
  FILTROS_STATUS_CONVIVENTE_PRESENCA,
  rotuloFiltroSituacaoPresenca,
  rotuloFiltroStatusConviventePresenca,
} from './utils/relatorioPresencaUtils';

function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function periodoPadraoMesAtual() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { dataInicio: dataLocalISO(inicio), dataFim: dataLocalISO(hoje) };
}

export default function RelatorioPresencaAusencia() {
  const periodoInicial = useMemo(() => periodoPadraoMesAtual(), []);
  const [dataInicio, setDataInicio] = useState(periodoInicial.dataInicio);
  const [dataFim, setDataFim] = useState(periodoInicial.dataFim);
  const [tecnicoId, setTecnicoId] = useState('');
  const [busca, setBusca] = useState('');
  const [statusConvivente, setStatusConvivente] = useState('todos');
  const [filtroSituacao, setFiltroSituacao] = useState('presenca_ou_justificada');
  const [tecnicos, setTecnicos] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  useEffect(() => {
    api.get('/api/tecnicos')
      .then((response) => setTecnicos(response.data || []))
      .catch(() => setTecnicos([]));
  }, []);

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
      const dados = await buscarRelatorioPresencaPeriodo({
        dataInicio,
        dataFim,
        tecnicoId,
        busca,
        statusConvivente,
        filtroSituacao,
      });
      setRelatorio(dados);
    } catch (error) {
      setRelatorio(null);
      setErro(error?.response?.data?.detail || 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [busca, dataFim, dataInicio, filtroSituacao, statusConvivente, tecnicoId]);

  const exportarXlsx = async () => {
    if (!relatorio?.linhas?.length) return;

    await exportarRelatorioXlsx({
      nomeArquivo: `presenca_ausencia_${relatorio.data_inicio}_a_${relatorio.data_fim}`,
      titulo: 'Relatório de presença e ausência',
      filtros: {
        Período: `${formatarDiaColunaCompleto(relatorio.data_inicio)} a ${formatarDiaColunaCompleto(relatorio.data_fim)}`,
        Situação: rotuloFiltroSituacaoPresenca(relatorio.filtro_situacao),
        'Status convivente': rotuloFiltroStatusConviventePresenca(relatorio.status_convivente),
        Conviventes: relatorio.total_conviventes,
      },
      colunas: montarColunasExportacaoPresenca(relatorio),
      dados: montarDadosExportacaoPresenca(relatorio),
    });
  };

  const imprimirRelatorio = async () => {
    if (!relatorio?.linhas?.length) return;

    const tecnicoNome = tecnicoId
      ? tecnicos.find((tecnico) => String(tecnico.id) === String(tecnicoId))?.nome
      : null;

    await imprimirRelatorioPresencaPeriodo({
      relatorio,
      identidadeRelatorio,
      tecnicoNome,
      busca,
    });
  };

  const dias = relatorio?.dias || [];
  const linhas = relatorio?.linhas || [];

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Relatórios"
          title="Presença e ausência por período"
          subtitle="Matriz diária dos conviventes com totais de presenças e ausências no intervalo escolhido."
          icon="▦"
          actions={(
            <>
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
              Período livre (até 93 dias). Presente = dentro do projeto ou ausência justificada.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Técnico</label>
                <select
                  value={tecnicoId}
                  onChange={(e) => setTecnicoId(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">Todos</option>
                  {tecnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>{tecnico.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Busca</label>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, prontuário ou SISA"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <legend className="px-2 text-xs font-black uppercase tracking-wide text-slate-600">
                  Situação no período
                </legend>
                <div className="mt-2 space-y-2">
                  {FILTROS_SITUACAO_PRESENCA.map((opcao) => (
                    <label
                      key={opcao.valor}
                      className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 ${
                        filtroSituacao === opcao.valor
                          ? 'border-brand bg-white shadow-sm'
                          : 'border-transparent bg-white/70'
                      }`}
                    >
                      <input
                        type="radio"
                        name="filtro-situacao-presenca"
                        value={opcao.valor}
                        checked={filtroSituacao === opcao.valor}
                        onChange={() => setFiltroSituacao(opcao.valor)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-sm font-bold text-slate-800">{opcao.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{opcao.descricao}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <legend className="px-2 text-xs font-black uppercase tracking-wide text-slate-600">
                  Status do convivente <span className="font-semibold normal-case text-slate-400">(opcional)</span>
                </legend>
                <div className="mt-2 space-y-2">
                  {FILTROS_STATUS_CONVIVENTE_PRESENCA.map((opcao) => (
                    <label
                      key={opcao.valor}
                      className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 ${
                        statusConvivente === opcao.valor
                          ? 'border-brand bg-white shadow-sm'
                          : 'border-transparent bg-white/70'
                      }`}
                    >
                      <input
                        type="radio"
                        name="status-convivente-presenca"
                        value={opcao.valor}
                        checked={statusConvivente === opcao.valor}
                        onChange={() => setStatusConvivente(opcao.valor)}
                        className={opcao.descricao ? 'mt-1' : undefined}
                      />
                      <span>
                        <span className="block text-sm font-bold text-slate-800">{opcao.label}</span>
                        {opcao.descricao && (
                          <span className="mt-0.5 block text-xs text-slate-500">{opcao.descricao}</span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>

          {erro && (
            <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          {relatorio && (
            <section className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <ResumoCard titulo="Conviventes" valor={relatorio.total_conviventes} />
              <ResumoCard titulo="Presenças (dias)" valor={relatorio.resumo?.presentes ?? 0} />
              <ResumoCard titulo="Ausências (dias)" valor={relatorio.resumo?.ausentes ?? 0} />
              <ResumoCard titulo="Justificados" valor={relatorio.resumo?.justificados ?? 0} />
              <ResumoCard titulo="Dias no período" valor={dias.length} />
            </section>
          )}

          <section className="mb-4 flex flex-wrap gap-3 text-xs font-semibold text-gray-600">
            <Legenda cor="bg-emerald-50 text-emerald-800 border-emerald-100" rotulo="P — Presente" />
            <Legenda cor="bg-indigo-50 text-indigo-800 border-indigo-100" rotulo="J — Ausência justificada" />
            <Legenda cor="bg-red-50 text-red-800 border-red-100" rotulo="A — Ausente" />
            <Legenda cor="bg-slate-50 text-slate-400 border-slate-100" rotulo="— — Antes da admissão" />
          </section>

          <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            {!relatorio && !loading && (
              <p className="p-8 text-center text-sm text-gray-500">
                Escolha o período e clique em Gerar relatório.
              </p>
            )}

            {loading && (
              <p className="p-8 text-center text-sm text-gray-500">Montando matriz de presenças…</p>
            )}

            {relatorio && !loading && linhas.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">Nenhum convivente encontrado para os filtros.</p>
            )}

            {relatorio && linhas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="sticky left-0 z-10 min-w-[220px] bg-gray-50 px-4 py-3 text-left font-black uppercase text-gray-500">
                        Convivente
                      </th>
                      <th className="px-3 py-3 text-left font-black uppercase text-gray-500">Técnico</th>
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
                      <th className="px-3 py-3 text-center font-black uppercase text-red-700">Aus.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha) => (
                      <tr key={linha.convivente_id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="sticky left-0 z-[1] bg-white px-4 py-3">
                          <p className="font-bold text-gray-900">{linha.nome}</p>
                          <p className="text-[11px] text-gray-500">
                            #{linha.prontuario || 'S/N'} · {linha.status}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-gray-600">{linha.tecnico_nome || '—'}</td>
                        {dias.map((dia) => {
                          const status = linha.dias?.[dia] || 'na';
                          return (
                            <td key={`${linha.convivente_id}-${dia}`} className="px-1 py-2 text-center">
                              <span
                                title={DESCRICAO_STATUS_PRESENCA_DIA[status]}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-black ${classeCelulaPresencaDia(status)}`}
                              >
                                {ROTULO_STATUS_PRESENCA_DIA[status]}
                              </span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-3 text-center font-black text-emerald-700">
                          {linha.totais?.presentes ?? 0}
                        </td>
                        <td className="px-3 py-3 text-center font-black text-red-700">
                          {linha.totais?.ausentes ?? 0}
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
