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
import { nfpOrigensRateio, nfpRelatorioRateioDetalhado } from './services/relatorioNfpService';
import { exportarRelatorioXlsx, montarLinhasRelatorioXlsx, nomeColuna } from './utils/exportarRelatorioXlsx';
import { buscarIdentidadeRelatoriosOrganizacao } from './utils/relatorioIdentidadePrint';
import { formatarCNPJ } from './utils/nfpCadastroUtils';
import { imprimirRelatorioNfpRateioDetalhado } from './utils/relatorioNfpPrint';
import {
  COLUNAS_RATEIO_DETALHADO,
  moneyRelatorioNfp,
  montarBlocoTotaisRateioDetalhadoXlsx,
  montarExportacaoRateioDetalhadoXlsx,
  rotuloOrigemRateio,
} from './utils/relatorioNfpUtils';

const PAGE_SIZE = 100;
const EXPORT_PAGE_SIZE = 5000;

function competenciaAtual() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}`;
}

function BarraPaginacao({ pagina, totalPaginas, total, limite, onMudar, disabled }) {
  if (!total) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
      <span>
        {total.toLocaleString('pt-BR')} registro(s) · página {pagina} de {totalPaginas}
        {' '}
        (
        {limite}
        /página)
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

export default function RelatorioNfpRateioDetalhado() {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [agente, setAgente] = useState('');
  const [origem, setOrigem] = useState('');
  const [busca, setBusca] = useState('');
  const [modo, setModo] = useState('agrupado');
  const [pagina, setPagina] = useState(1);
  const [agentes, setAgentes] = useState([]);
  const [origens, setOrigens] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingPagina, setLoadingPagina] = useState(false);
  const [trabalhandoCompleto, setTrabalhandoCompleto] = useState(false);
  const [erro, setErro] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  useEffect(() => {
    buscarIdentidadeRelatoriosOrganizacao().then(setIdentidadeRelatorio);
    nfpAcesso()
      .then((data) => setAgentes(data?.agentes_captacao || []))
      .catch(() => setAgentes([]));
  }, []);

  useEffect(() => {
    if (!competencia) {
      setOrigens([]);
      setOrigem('');
      return undefined;
    }

    let ativo = true;
    nfpOrigensRateio({
      competencia,
      agente: agente || undefined,
    })
      .then((data) => {
        if (!ativo) return;
        const lista = data?.origens || [];
        setOrigens(lista);
        setOrigem((atual) => (atual && lista.includes(atual) ? atual : ''));
      })
      .catch(() => {
        if (!ativo) return;
        setOrigens([]);
        setOrigem('');
      });

    return () => {
      ativo = false;
    };
  }, [agente, competencia]);

  const paramsBase = useMemo(() => ({
    competencia,
    agente: agente || undefined,
    origem: origem || undefined,
    busca: busca || undefined,
    modo,
  }), [agente, busca, competencia, modo, origem]);

  const carregarPagina = useCallback(async (novaPagina, { inicial = false } = {}) => {
    if (!competencia) {
      setErro('Informe a competência.');
      return;
    }
    if (inicial) setLoading(true);
    else setLoadingPagina(true);
    setErro('');
    try {
      const dados = await nfpRelatorioRateioDetalhado({
        ...paramsBase,
        limite: PAGE_SIZE,
        offset: (novaPagina - 1) * PAGE_SIZE,
      });
      setPagina(novaPagina);
      setRelatorio(dados);
    } catch (error) {
      if (inicial) setRelatorio(null);
      setErro(error?.response?.data?.detail || 'Não foi possível gerar o relatório.');
    } finally {
      setLoading(false);
      setLoadingPagina(false);
    }
  }, [competencia, paramsBase]);

  const carregar = useCallback(async () => {
    await carregarPagina(1, { inicial: true });
  }, [carregarPagina]);

  const buscarTodasLinhas = useCallback(async () => {
    const acumulado = [];
    let offset = 0;
    let total = Infinity;
    let primeiro = null;

    while (offset < total) {
      const dados = await nfpRelatorioRateioDetalhado({
        ...paramsBase,
        limite: EXPORT_PAGE_SIZE,
        offset,
        exportacao: true,
      });
      if (!primeiro) primeiro = dados;
      const lote = dados?.linhas || [];
      acumulado.push(...lote);
      total = Number(dados?.paginacao?.total ?? dados?.totais?.total_encontrado ?? acumulado.length);
      if (!lote.length) break;
      offset += lote.length;
      if (lote.length < EXPORT_PAGE_SIZE) break;
    }

    return {
      ...(primeiro || {}),
      linhas: acumulado,
      totais: {
        ...(primeiro?.totais || {}),
        qtd_linhas: acumulado.length,
        qtd_notas: acumulado.reduce((acc, item) => acc + Number(item.qtd || 0), 0),
        total_encontrado: total === Infinity ? acumulado.length : total,
        truncado: false,
      },
      paginacao: {
        total: total === Infinity ? acumulado.length : total,
        limite: acumulado.length,
        offset: 0,
        total_paginas: 1,
        pagina: 1,
      },
    };
  }, [paramsBase]);

  const linhas = relatorio?.linhas || [];
  const totais = relatorio?.totais || {};
  const pag = relatorio?.paginacao || {};
  const totalRegistros = Number(pag.total ?? totais.total_encontrado ?? 0);
  const totalPaginas = Number(pag.total_paginas || Math.max(1, Math.ceil(totalRegistros / PAGE_SIZE)));
  const modoAtual = relatorio?.modo || modo;
  const porNota = modoAtual === 'por_nota';
  const visaoTodos = !agente || Boolean(totais.visao_todos);
  const rotuloAgente = visaoTodos
    ? 'agentes'
    : (totais.rotulo_parte_agente || agente || 'agente');
  const rotuloParte = visaoTodos ? 'Parte agentes' : `Parte ${rotuloAgente}`;
  const rotuloDoador = visaoTodos
    ? 'Doador AEB em lojas agentes'
    : `Doador AEB em lojas ${rotuloAgente}`;

  const cardsRetirada = [
    ['Bruto Lojas/CPFs', moneyRelatorioNfp(totais.bruto_lojas_cpfs_agente)],
    ['Bruto Lojas', moneyRelatorioNfp(totais.bruto_lojas_somente)],
    ['Bruto CPF', moneyRelatorioNfp(totais.bruto_cpf_agente)],
    [rotuloDoador, moneyRelatorioNfp(totais.doador_aeb_loja_agente)],
    [rotuloParte, moneyRelatorioNfp(totais.parte_agente)],
    ['Parte AEB', moneyRelatorioNfp(totais.parte_aeb_consolidada_agente ?? totais.parte_aeb)],
    ['Linhas (página) / total', `${totais.qtd_linhas ?? 0} / ${totalRegistros || 0}`],
  ];

  const exportarXlsx = async () => {
    if (!relatorio) return;
    setTrabalhandoCompleto(true);
    setErro('');
    try {
      const completo = await buscarTodasLinhas();
      const dadosXlsx = montarExportacaoRateioDetalhadoXlsx(completo);
      const filtrosBase = {
        Competência: competencia,
        Agente: agente || 'Todos',
        Origem: origem ? rotuloOrigemRateio(origem) : 'Todas',
        Busca: busca || '—',
        Exibição: porNota ? 'Sem agrupar (cada lançamento)' : 'Agrupado por CNPJ',
        Registros: String(completo.linhas?.length || 0),
      };
      const montado = montarLinhasRelatorioXlsx({
        titulo: 'NFP – Rateio detalhado',
        filtros: filtrosBase,
        colunas: COLUNAS_RATEIO_DETALHADO,
        dados: dadosXlsx,
        blocoTotais: [],
      });
      const blocoTotais = montarBlocoTotaisRateioDetalhadoXlsx({
        colunas: COLUNAS_RATEIO_DETALHADO,
        primeiraLinhaDados: montado.meta.primeiraLinhaDados,
        ultimaLinhaDados: montado.meta.ultimaLinhaDados,
        totais: completo.totais,
        rotuloParte,
        rotuloDoador,
        nomeColunaFn: nomeColuna,
      });
      await exportarRelatorioXlsx({
        nomeArquivo: `nfp_rateio_detalhado_${competencia}_${porNota ? 'por_nota' : 'agrupado'}`,
        titulo: 'NFP – Rateio detalhado',
        filtros: filtrosBase,
        colunas: COLUNAS_RATEIO_DETALHADO,
        dados: dadosXlsx,
        blocoTotais,
      });
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível exportar o relatório completo.');
    } finally {
      setTrabalhandoCompleto(false);
    }
  };

  const imprimirCompleto = async () => {
    if (!relatorio) return;
    setTrabalhandoCompleto(true);
    setErro('');
    try {
      const completo = await buscarTodasLinhas();
      await imprimirRelatorioNfpRateioDetalhado({
        relatorio: completo,
        identidadeRelatorio,
      });
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível preparar a impressão completa.');
    } finally {
      setTrabalhandoCompleto(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Relatórios"
          title="Rateio detalhado"
          subtitle="Agrupado ou sem agrupar, com paginação. Exportar/Imprimir montam o relatório completo."
          icon={<FileBarChart className="h-5 w-5" />}
          backTo="/nfp/relatorios"
          backLabel="Voltar aos relatórios"
          actions={(
            <div className="flex flex-wrap gap-2">
              <ReportActionButton
                type="button"
                disabled={!relatorio || trabalhandoCompleto || loading}
                onClick={exportarXlsx}
              >
                {trabalhandoCompleto ? 'Preparando...' : 'Exportar XLSX'}
              </ReportActionButton>
              <ReportActionButton
                type="button"
                disabled={!relatorio || trabalhandoCompleto || loading}
                onClick={imprimirCompleto}
              >
                Imprimir
              </ReportActionButton>
              <PremiumButton type="button" disabled={loading || trabalhandoCompleto} onClick={carregar}>
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
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Competência *</span>
                <input
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-slate-700">
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
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Origem</span>
                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Todas</option>
                  {origens.map((item) => (
                    <option key={item} value={item}>{rotuloOrigemRateio(item)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Exibição</span>
                <select
                  value={modo}
                  onChange={(e) => {
                    setModo(e.target.value);
                    setRelatorio(null);
                    setPagina(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="agrupado">Agrupado por CNPJ</option>
                  <option value="por_nota">Sem agrupar (cada lançamento)</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs font-semibold text-slate-600">Busca loja/CNPJ</span>
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            {!origens.length && competencia ? (
              <p className="mt-3 text-xs text-slate-500">
                Nenhuma origem encontrada nesta competência (é preciso ter rateio calculado).
              </p>
            ) : null}
            {modo === 'por_nota' ? (
              <p className="mt-3 text-xs text-slate-500">
                Sem agrupar: cada crédito SEFAZ vira uma linha. A tela pagina de
                {' '}
                {PAGE_SIZE}
                {' '}
                em
                {' '}
                {PAGE_SIZE}
                ; Exportar/Imprimir buscam o conjunto completo.
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Agrupado: soma as notas do mesmo CNPJ/origem. Para ver cada lançamento, use Sem agrupar.
              </p>
            )}
          </section>

          {relatorio && (
            <>
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Exibindo página
                {' '}
                {pagina}
                {' '}
                de
                {' '}
                {totalPaginas}
                {' '}
                (
                {(totais.qtd_linhas ?? linhas.length).toLocaleString('pt-BR')}
                {' '}
                de
                {' '}
                {totalRegistros.toLocaleString('pt-BR')}
                {' '}
                registros). Os totais de retirada do dashboard são completos; Exportar XLSX e Imprimir montam o relatório inteiro.
              </div>
              <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {cardsRetirada.map(([label, valor]) => (
                  <article key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">{valor}</p>
                  </article>
                ))}
              </div>
              <p className="mb-4 text-xs text-slate-500">
                Totais de retirada iguais ao dashboard (competência + agente).
                Origem/busca filtram a tabela.
                {' '}
                Exibição:
                {' '}
                {porNota ? 'sem agrupar (cada lançamento)' : 'agrupado por CNPJ'}
                .
              </p>

              <section className="overflow-x-auto rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-2">CNPJ</th>
                      <th className="px-2 py-2">Loja</th>
                      <th className="px-2 py-2">Captador</th>
                      <th className="px-2 py-2">Origem</th>
                      <th className="px-2 py-2">Fonte</th>
                      <th className="px-2 py-2">Nº nota</th>
                      <th className="px-2 py-2">Qtd</th>
                      <th className="px-2 py-2">Retorno</th>
                      <th className="px-2 py-2">Retorno loja</th>
                      <th className="px-2 py-2">Retorno CPF</th>
                      <th className="px-2 py-2">Agente</th>
                      <th className="px-2 py-2">AEB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((item) => (
                      <tr key={`${item.id}-${item.numero_nota || 'g'}`} className="border-t border-slate-100">
                        <td className="px-2 py-2">{formatarCNPJ(item.cnpj)}</td>
                        <td className="px-2 py-2">{item.loja || '—'}</td>
                        <td className="px-2 py-2">{item.captador || '—'}</td>
                        <td className="px-2 py-2">{rotuloOrigemRateio(item.origem)}</td>
                        <td className="px-2 py-2">{item.fonte || '—'}</td>
                        <td className="px-2 py-2">{item.numero_nota || '—'}</td>
                        <td className="px-2 py-2">{item.qtd ?? 0}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.retorno)}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.retorno_loja ?? item.retorno)}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.retorno_cpf ?? 0)}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.valor_agente ?? item.valor_diego)}</td>
                        <td className="px-2 py-2">{moneyRelatorioNfp(item.valor_aeb)}</td>
                      </tr>
                    ))}
                    {!linhas.length && (
                      <tr>
                        <td colSpan={12} className="px-2 py-8 text-center text-slate-500">
                          Sem linhas de rateio para o filtro informado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <BarraPaginacao
                  pagina={pagina}
                  totalPaginas={totalPaginas}
                  total={totalRegistros}
                  limite={PAGE_SIZE}
                  disabled={loadingPagina || loading || trabalhandoCompleto}
                  onMudar={(nova) => carregarPagina(nova)}
                />
              </section>
            </>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
