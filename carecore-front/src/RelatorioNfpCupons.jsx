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
import { nfpRelatorioCupons } from './services/relatorioNfpService';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { buscarIdentidadeRelatoriosOrganizacao } from './utils/relatorioIdentidadePrint';
import { imprimirRelatorioNfpCupons } from './utils/relatorioNfpPrint';
import {
  COLUNAS_CUPONS_DETALHE,
  COLUNAS_CUPONS_POR_CAPTADOR,
  STATUS_CUPONS_RELATORIO,
  montarExportacaoCuponsDetalhe,
  montarExportacaoCuponsPorCaptador,
  rotuloStatusCupomRelatorio,
} from './utils/relatorioNfpUtils';

const PAGE_SIZE = 50;

function dataLocalISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function inicioMesAtual() {
  const agora = new Date();
  return dataLocalISO(new Date(agora.getFullYear(), agora.getMonth(), 1));
}

function BarraPaginacao({ pagina, totalPaginas, total, limite, onMudar, disabled }) {
  if (!total) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>
        {total.toLocaleString('pt-BR')} registro(s) · página {pagina} de {totalPaginas}
        {' '}({limite}/página)
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={disabled || pagina <= 1}
          onClick={() => onMudar(pagina - 1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
        >
          Anterior
        </button>
        <button
          type="button"
          disabled={disabled || pagina >= totalPaginas}
          onClick={() => onMudar(pagina + 1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

export default function RelatorioNfpCupons() {
  const [dataInicio, setDataInicio] = useState(inicioMesAtual);
  const [dataFim, setDataFim] = useState(() => dataLocalISO());
  const [captador, setCaptador] = useState('');
  const [statusSel, setStatusSel] = useState([]);
  const [busca, setBusca] = useState('');
  const [eixoData, setEixoData] = useState('lido_em');
  const [captadores, setCaptadores] = useState([]);
  const [aba, setAba] = useState('captador');
  const [relatorio, setRelatorio] = useState(null);
  const [paginaDetalhe, setPaginaDetalhe] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingPagina, setLoadingPagina] = useState(false);
  const [erro, setErro] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  useEffect(() => {
    buscarIdentidadeRelatoriosOrganizacao().then(setIdentidadeRelatorio);
    nfpAcesso()
      .then((data) => {
        const lista = data?.captadores_padrao || data?.captadores || [];
        setCaptadores(Array.isArray(lista) ? lista : []);
      })
      .catch(() => setCaptadores([]));
  }, []);

  const paramsBase = useMemo(() => ({
    data_inicio: dataInicio || undefined,
    data_fim: dataFim || undefined,
    captador: captador || undefined,
    status: statusSel.length ? statusSel.join(',') : undefined,
    busca: busca.trim() || undefined,
    eixo_data: eixoData || 'lido_em',
  }), [busca, captador, dataFim, dataInicio, eixoData, statusSel]);

  const toggleStatus = (value) => {
    setStatusSel((prev) => (
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    ));
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    setPaginaDetalhe(1);
    try {
      const dados = await nfpRelatorioCupons({
        ...paramsBase,
        limite: PAGE_SIZE,
        offset: 0,
        incluir_agregados: true,
      });
      setRelatorio(dados);
      if (Array.isArray(dados?.captadores) && dados.captadores.length) {
        setCaptadores((prev) => {
          const set = new Set([...(prev || []), ...dados.captadores]);
          return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        });
      }
    } catch (error) {
      setRelatorio(null);
      setErro(error?.response?.data?.detail || 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
    }
  }, [paramsBase]);

  const carregarPaginaDetalhe = useCallback(async (novaPagina) => {
    if (!relatorio) return;
    setLoadingPagina(true);
    setErro('');
    try {
      const offset = (novaPagina - 1) * PAGE_SIZE;
      const dados = await nfpRelatorioCupons({
        ...paramsBase,
        limite: PAGE_SIZE,
        offset,
        incluir_agregados: false,
      });
      setRelatorio((prev) => ({
        ...(prev || {}),
        linhas: dados.linhas || [],
        paginacao: dados.paginacao,
        filtros: { ...(prev?.filtros || {}), ...(dados.filtros || {}) },
        linhas_truncadas: dados.linhas_truncadas,
      }));
      setPaginaDetalhe(novaPagina);
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar a página.');
    } finally {
      setLoadingPagina(false);
    }
  }, [paramsBase, relatorio]);

  const totais = relatorio?.totais || {};
  const linhasCaptador = relatorio?.por_captador || [];
  const linhasDetalhe = relatorio?.linhas || [];
  const pag = relatorio?.paginacao || {};
  const totalDetalhe = pag.total ?? totais.lidos ?? 0;
  const totalPaginas = pag.total_paginas || Math.max(1, Math.ceil(totalDetalhe / PAGE_SIZE));
  const temLinhas = aba === 'detalhe' ? linhasDetalhe.length > 0 : linhasCaptador.length > 0;

  const cards = useMemo(() => ([
    ['Lidos', totais.lidos ?? 0],
    ['Pendentes', totais.pendentes ?? 0],
    ['Reservados', totais.reservados ?? 0],
    ['Enviados', totais.enviados ?? 0],
    ['Erros', totais.erros ?? 0],
    ['Rejeitados CPF', totais.rejeitados_cpf ?? 0],
    ['Rejeitados prazo', totais.rejeitados_prazo ?? 0],
    ['Checando', totais.checando ?? 0],
  ]), [totais]);

  const exportarXlsx = async () => {
    if (aba === 'captador') {
      if (!linhasCaptador.length) return;
      await exportarRelatorioXlsx({
        nomeArquivo: `nfp_cupons_por_captador_${dataInicio || 'inicio'}_${dataFim || 'fim'}`,
        titulo: 'NFP – Cupons por captador',
        filtros: {
          Período: `${dataInicio || '—'} a ${dataFim || '—'}`,
          Captador: captador || 'Todos',
          Status: statusSel.length ? statusSel.map(rotuloStatusCupomRelatorio).join(', ') : 'Todos',
          Lidos: totais.lidos ?? 0,
        },
        colunas: COLUNAS_CUPONS_POR_CAPTADOR,
        dados: montarExportacaoCuponsPorCaptador(relatorio),
      });
      return;
    }
    // Detalhe: no maximo 2000 linhas (nao carrega 100k no browser).
    setLoading(true);
    try {
      const dados = await nfpRelatorioCupons({
        ...paramsBase,
        limite: 2000,
        offset: 0,
        incluir_agregados: false,
        exportacao: true,
      });
      const payload = { ...relatorio, linhas: dados.linhas || [] };
      await exportarRelatorioXlsx({
        nomeArquivo: `nfp_cupons_detalhe_${dataInicio || 'inicio'}_${dataFim || 'fim'}`,
        titulo: 'NFP – Cupons (detalhe, até 2.000)',
        filtros: {
          Período: `${dataInicio || '—'} a ${dataFim || '—'}`,
          Captador: captador || 'Todos',
          Status: statusSel.length ? statusSel.map(rotuloStatusCupomRelatorio).join(', ') : 'Todos',
          Observação: `Exportados ${dados.linhas?.length || 0} de ${(dados.paginacao?.total || 0).toLocaleString('pt-BR')}. Use filtros para reduzir.`,
        },
        colunas: COLUNAS_CUPONS_DETALHE,
        dados: montarExportacaoCuponsDetalhe(payload),
      });
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Falha ao exportar detalhe.');
    } finally {
      setLoading(false);
    }
  };

  const imprimir = async () => {
    if (!relatorio) return;
    if (aba === 'captador') {
      if (!linhasCaptador.length) return;
      await imprimirRelatorioNfpCupons({
        relatorio,
        identidadeRelatorio,
        aba: 'captador',
      });
      return;
    }
    // Detalhe: busca todos do filtro (mesmo teto do XLSX), nao so a pagina da tela.
    setLoading(true);
    setErro('');
    try {
      const dados = await nfpRelatorioCupons({
        ...paramsBase,
        limite: 2000,
        offset: 0,
        incluir_agregados: false,
        exportacao: true,
      });
      const totalFiltro = Number(dados?.paginacao?.total ?? 0);
      const linhas = dados?.linhas || [];
      const payload = {
        ...relatorio,
        linhas,
        paginacao: dados.paginacao || relatorio.paginacao,
        filtros: { ...(relatorio.filtros || {}), ...(dados.filtros || {}) },
      };
      if (!linhas.length) {
        setErro('Não há linhas no filtro atual para imprimir.');
        return;
      }
      await imprimirRelatorioNfpCupons({
        relatorio: payload,
        identidadeRelatorio,
        aba: 'detalhe',
        totalFiltro,
      });
      if (totalFiltro > linhas.length) {
        setErro(
          `Impressão com as primeiras ${linhas.length.toLocaleString('pt-BR')} de `
          + `${totalFiltro.toLocaleString('pt-BR')} do filtro (teto 2.000). Refine o período/status para caber tudo.`,
        );
      }
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Falha ao preparar impressão do detalhe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Relatórios"
          title="Cupons lidos / fila / enviados"
          subtitle="Totais no banco; detalhe paginado (50/página) para manter a tela fluida com alto volume."
          icon={<FileBarChart className="h-5 w-5" />}
          backTo="/nfp/relatorios"
          backLabel="Voltar aos relatórios"
          actions={(
            <div className="flex flex-wrap gap-2">
              <ReportActionButton type="button" disabled={!temLinhas || loading} onClick={exportarXlsx}>
                Exportar XLSX
              </ReportActionButton>
              <ReportActionButton
                type="button"
                disabled={!temLinhas || loading}
                onClick={imprimir}
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
                <span className="mb-1 block text-xs font-semibold text-slate-600">Data início</span>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Data fim</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Filtrar por</span>
                <select
                  value={eixoData}
                  onChange={(e) => setEixoData(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="lido_em">Data de leitura</option>
                  <option value="enviado_em">Data de envio</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Captador / unidade</span>
                <select
                  value={captador}
                  onChange={(e) => setCaptador(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  {captadores.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_CUPONS_RELATORIO.map((item) => {
                  const ativo = statusSel.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => toggleStatus(item.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                        ativo
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-3 block text-sm text-slate-700">
              <span className="mb-1 block text-xs font-semibold text-slate-600">Busca (chave, CNPJ ou mensagem)</span>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Opcional"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <p className="mt-3 text-xs text-slate-500">
              Datas no calendário de São Paulo. Consolidado por captador é leve; detalhe na tela vem página a página (50). Impressão e XLSX do detalhe buscam todos do filtro (até 2.000).
            </p>
          </section>

          {relatorio && (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                {cards.map(([label, valor]) => (
                  <article key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">{Number(valor).toLocaleString('pt-BR')}</p>
                  </article>
                ))}
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setAba('captador')}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    aba === 'captador'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Por captador
                </button>
                <button
                  type="button"
                  onClick={() => setAba('detalhe')}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    aba === 'detalhe'
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Detalhe
                </button>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white shadow-sm">
                {aba === 'captador' ? (
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {COLUNAS_CUPONS_POR_CAPTADOR.map((col) => (
                          <th key={col} className="px-4 py-3 font-semibold">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasCaptador.map((item) => (
                        <tr key={item.captador} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-900">{item.captador}</td>
                          <td className="px-4 py-3">{item.lidos ?? 0}</td>
                          <td className="px-4 py-3">{item.pendentes ?? 0}</td>
                          <td className="px-4 py-3">{item.reservados ?? 0}</td>
                          <td className="px-4 py-3">{item.enviados ?? 0}</td>
                          <td className="px-4 py-3">{item.erros ?? 0}</td>
                          <td className="px-4 py-3">{item.rejeitados_cpf ?? 0}</td>
                          <td className="px-4 py-3">{item.rejeitados_prazo ?? 0}</td>
                          <td className="px-4 py-3">{item.checando ?? 0}</td>
                        </tr>
                      ))}
                      {!linhasCaptador.length && (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                            Nenhum cupom no filtro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <>
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          {COLUNAS_CUPONS_DETALHE.map((col) => (
                            <th key={col} className="px-4 py-3 font-semibold">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loadingPagina ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                              Carregando página…
                            </td>
                          </tr>
                        ) : linhasDetalhe.map((item) => (
                          <tr key={item.id || item.chave} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-mono text-xs">{item.chave}</td>
                            <td className="px-4 py-3">{item.captador || '—'}</td>
                            <td className="px-4 py-3">{rotuloStatusCupomRelatorio(item.status)}</td>
                            <td className="px-4 py-3 font-mono text-xs">{item.cnpj_emitente || '—'}</td>
                            <td className="px-4 py-3">{item.data_emissao_ref || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.lido_em || '—'}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{item.enviado_em || '—'}</td>
                            <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={item.mensagem || ''}>
                              {item.mensagem || '—'}
                            </td>
                          </tr>
                        ))}
                        {!loadingPagina && !linhasDetalhe.length && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                              Nenhum cupom no filtro.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    <div className="border-t border-slate-100 px-4 py-3">
                      <BarraPaginacao
                        pagina={paginaDetalhe}
                        totalPaginas={totalPaginas}
                        total={totalDetalhe}
                        limite={PAGE_SIZE}
                        disabled={loadingPagina}
                        onMudar={carregarPaginaDetalhe}
                      />
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
