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
  const [loading, setLoading] = useState(false);
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

  const toggleStatus = (value) => {
    setStatusSel((prev) => (
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    ));
  };

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const dados = await nfpRelatorioCupons({
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        captador: captador || undefined,
        status: statusSel.length ? statusSel.join(',') : undefined,
        busca: busca.trim() || undefined,
        eixo_data: eixoData || 'lido_em',
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
  }, [busca, captador, dataFim, dataInicio, eixoData, statusSel]);

  const totais = relatorio?.totais || {};
  const linhasCaptador = relatorio?.por_captador || [];
  const linhasDetalhe = relatorio?.linhas || [];
  const temLinhas = aba === 'detalhe' ? linhasDetalhe.length > 0 : linhasCaptador.length > 0;

  const cards = useMemo(() => ([
    ['Lidos', totais.lidos ?? 0],
    ['Pendentes', totais.pendentes ?? 0],
    ['Reservados', totais.reservados ?? 0],
    ['Enviados', totais.enviados ?? 0],
    ['Erros', totais.erros ?? 0],
    ['Rejeitados CPF', totais.rejeitados_cpf ?? 0],
    ['Checando', totais.checando ?? 0],
  ]), [totais]);

  const exportarXlsx = async () => {
    if (!temLinhas) return;
    const dados = aba === 'detalhe'
      ? montarExportacaoCuponsDetalhe(relatorio)
      : montarExportacaoCuponsPorCaptador(relatorio);
    await exportarRelatorioXlsx({
      nomeArquivo: `nfp_cupons_${dataInicio || 'inicio'}_${dataFim || 'fim'}`,
      titulo: 'NFP – Cupons lidos / fila / enviados',
      filtros: {
        Período: `${dataInicio || '—'} a ${dataFim || '—'}`,
        'Eixo data': eixoData === 'enviado_em' ? 'Enviado em' : 'Lido em',
        Captador: captador || 'Todos',
        Status: statusSel.length
          ? statusSel.map(rotuloStatusCupomRelatorio).join(', ')
          : 'Todos',
        Busca: busca.trim() || '—',
        Visão: aba === 'detalhe' ? 'Detalhe' : 'Por captador',
        Lidos: totais.lidos ?? 0,
        Pendentes: totais.pendentes ?? 0,
        Enviados: totais.enviados ?? 0,
      },
      colunas: aba === 'detalhe' ? COLUNAS_CUPONS_DETALHE : COLUNAS_CUPONS_POR_CAPTADOR,
      dados,
    });
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Relatórios"
          title="Cupons lidos / fila / enviados"
          subtitle="Acompanhe leituras, fila do robô e envios por período e captador/unidade."
          icon={<FileBarChart className="h-5 w-5" />}
          backTo="/nfp/relatorios"
          backLabel="Voltar aos relatórios"
          actions={(
            <div className="flex flex-wrap gap-2">
              <ReportActionButton type="button" disabled={!temLinhas} onClick={exportarXlsx}>
                Exportar XLSX
              </ReportActionButton>
              <ReportActionButton
                type="button"
                disabled={!temLinhas}
                onClick={() => imprimirRelatorioNfpCupons({
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
              Datas no calendário de São Paulo. Sem status selecionado = todos. Captador é a unidade da leitura (ex.: SEDE AEB), não o agente de rateio.
            </p>
          </section>

          {relatorio && (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
                {cards.map(([label, valor]) => (
                  <article key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-2 text-xl font-bold text-slate-900">{valor}</p>
                  </article>
                ))}
              </div>

              {relatorio.linhas_truncadas && (
                <p className="mb-3 text-xs text-amber-700">
                  Detalhe limitado às {linhasDetalhe.length} linhas mais recentes do filtro. Use exportação por captador para o consolidado completo.
                </p>
              )}

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
                          <td className="px-4 py-3">{item.checando ?? 0}</td>
                        </tr>
                      ))}
                      {!linhasCaptador.length && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                            Nenhum cupom no filtro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {COLUNAS_CUPONS_DETALHE.map((col) => (
                          <th key={col} className="px-4 py-3 font-semibold">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasDetalhe.map((item) => (
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
                      {!linhasDetalhe.length && (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                            Nenhum cupom no filtro.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
