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
import { buscarRelatorioCadastrosNovos } from './services/relatorioCadastrosNovosService';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { buscarIdentidadeRelatorios } from './utils/relatorioIdentidadePrint';
import { imprimirRelatorioCadastrosNovos } from './utils/relatorioCadastrosNovosPrint';
import {
  COLUNAS_EXPORTACAO_CADASTROS_NOVOS,
  CRITERIOS_CADASTROS_NOVOS,
  formatarDataRelatorio,
  montarDadosExportacaoCadastrosNovos,
  rotuloCriterioCadastrosNovos,
  rotulosStatusFiltroCadastrosNovos,
  rotuloStatusConviventeCadastrosNovos,
  STATUS_CADASTROS_NOVOS_PADRAO,
  STATUS_CONVIVENTE_CADASTROS_NOVOS,
  alternarStatusFiltroCadastrosNovos,
} from './utils/relatorioCadastrosNovosUtils';

function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function periodoPadraoMesAtual() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { dataInicio: dataLocalISO(inicio), dataFim: dataLocalISO(hoje) };
}

export default function RelatorioCadastrosNovos() {
  const periodoInicial = useMemo(() => periodoPadraoMesAtual(), []);
  const [dataInicio, setDataInicio] = useState(periodoInicial.dataInicio);
  const [dataFim, setDataFim] = useState(periodoInicial.dataFim);
  const [tecnicoId, setTecnicoId] = useState('');
  const [busca, setBusca] = useState('');
  const [criterio, setCriterio] = useState('inclusoes');
  const [statusFiltro, setStatusFiltro] = useState(() => [...STATUS_CADASTROS_NOVOS_PADRAO]);
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
      const dados = await buscarRelatorioCadastrosNovos({
        dataInicio,
        dataFim,
        criterio,
        statusFiltro,
        tecnicoId,
        busca,
      });
      setRelatorio(dados);
    } catch (error) {
      setRelatorio(null);
      setErro(error?.response?.data?.detail || 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [busca, criterio, dataFim, dataInicio, statusFiltro, tecnicoId]);

  const linhas = relatorio?.linhas || [];

  const exportarXlsx = async () => {
    if (!linhas.length) return;

    await exportarRelatorioXlsx({
      nomeArquivo: `cadastros_novos_${relatorio.data_inicio}_a_${relatorio.data_fim}`,
      titulo: 'Cadastros novos por período',
      filtros: {
        Período: `${formatarDataRelatorio(relatorio.data_inicio)} a ${formatarDataRelatorio(relatorio.data_fim)}`,
        Critério: rotuloCriterioCadastrosNovos(relatorio.criterio),
        'Situação no abrigo': rotulosStatusFiltroCadastrosNovos(relatorio.status_filtro),
        Total: relatorio.total_cadastros,
      },
      colunas: COLUNAS_EXPORTACAO_CADASTROS_NOVOS,
      dados: montarDadosExportacaoCadastrosNovos(relatorio),
    });
  };

  const imprimirRelatorio = async () => {
    if (!linhas.length) return;

    const tecnicoNome = tecnicoId
      ? tecnicos.find((tecnico) => String(tecnico.id) === String(tecnicoId))?.nome
      : null;

    await imprimirRelatorioCadastrosNovos({
      relatorio,
      identidadeRelatorio,
      tecnicoNome,
      busca,
    });
  };

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Relatórios"
          title="Cadastros novos por período"
          subtitle="Liste novas inclusões, novas vinculações ou ambas no intervalo escolhido."
          icon="⊕"
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
              Período máximo de 366 dias. Escolha o critério de busca abaixo.
            </p>

            <fieldset className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <legend className="px-2 text-xs font-black uppercase tracking-wide text-slate-600">
                O que listar no período
              </legend>
              <div className="mt-2 space-y-2">
                {CRITERIOS_CADASTROS_NOVOS.map((opcao) => (
                  <label
                    key={opcao.valor}
                    className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 ${
                      criterio === opcao.valor
                        ? 'border-brand bg-white shadow-sm'
                        : 'border-transparent bg-white/70'
                    }`}
                  >
                    <input
                      type="radio"
                      name="criterio-cadastros-novos"
                      value={opcao.valor}
                      checked={criterio === opcao.valor}
                      onChange={() => setCriterio(opcao.valor)}
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

            <fieldset className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <legend className="px-2 text-xs font-black uppercase tracking-wide text-slate-600">
                Situação no abrigo
              </legend>
              <p className="mt-1 px-2 text-xs text-slate-500">
                Marque uma ou mais situações. Por padrão: ativos, em acolhimento e ausência justificada.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {STATUS_CONVIVENTE_CADASTROS_NOVOS.map((opcao) => {
                  const marcado = statusFiltro.includes(opcao.valor);
                  return (
                    <label
                      key={opcao.valor}
                      className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 ${
                        marcado
                          ? 'border-brand bg-white shadow-sm'
                          : 'border-transparent bg-white/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => setStatusFiltro(
                          (atual) => alternarStatusFiltroCadastrosNovos(atual, opcao.valor),
                        )}
                        className="mt-0.5"
                      />
                      <span className="text-sm font-semibold text-slate-800">{opcao.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

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
                  placeholder="Nome, mãe ou prontuário"
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
            <section className="mb-4">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Total de cadastros</p>
                <p className="mt-1 text-3xl font-black text-gray-900">{relatorio.total_cadastros}</p>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            {!relatorio && !loading && (
              <p className="p-8 text-center text-sm text-gray-500">
                Escolha o período e clique em Gerar relatório.
              </p>
            )}

            {loading && (
              <p className="p-8 text-center text-sm text-gray-500">Buscando cadastros…</p>
            )}

            {relatorio && !loading && linhas.length === 0 && (
              <p className="p-8 text-center text-sm text-gray-500">
                Nenhum registro encontrado para o critério, situação e período escolhidos.
              </p>
            )}

            {relatorio && linhas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-left text-[10px] font-black uppercase text-gray-500">
                      <th className="px-4 py-3">Nome</th>
                      <th className="px-4 py-3">Nome da mãe</th>
                      <th className="px-4 py-3">Prontuário da saúde</th>
                      <th className="px-4 py-3">Data de inclusão</th>
                      <th className="px-4 py-3">Nova vinculação</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((linha) => (
                      <tr key={linha.convivente_id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-semibold text-gray-900">{linha.nome}</td>
                        <td className="px-4 py-3 text-gray-700">{linha.nome_mae || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{linha.prontuario_saude || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{formatarDataRelatorio(linha.data_inclusao)}</td>
                        <td className="px-4 py-3 text-gray-700">{formatarDataRelatorio(linha.data_nova_vinculacao)}</td>
                        <td className="px-4 py-3 text-gray-700">{rotuloStatusConviventeCadastrosNovos(linha.status)}</td>
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
