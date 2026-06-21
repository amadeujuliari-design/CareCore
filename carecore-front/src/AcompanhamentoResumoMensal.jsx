import { useCallback, useEffect, useMemo, useState } from 'react';
import logoCarecore from './assets/logo.PNG';
import Sidebar from './Sidebar';
import AuthenticatedImage from './components/AuthenticatedImage';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { obterResumoMensalAcompanhamentos } from './services/acompanhamentosService';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
} from './utils/relatorioIdentidadePrint';
import { imprimirResumoMensalAcompanhamentos } from './utils/resumoMensalAcompanhamentosPrint';

function mesAtualReferencia() {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}`;
}

function intervaloDoMes(mesReferencia) {
  const [anoStr, mesStr] = String(mesReferencia || '').split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  if (!ano || !mes) {
    return { inicio: '', fim: '' };
  }
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const mesPad = String(mes).padStart(2, '0');
  return {
    inicio: `${ano}-${mesPad}-01`,
    fim: `${ano}-${mesPad}-${String(ultimoDia).padStart(2, '0')}`,
  };
}

function escaparCsv(valor) {
  const texto = String(valor ?? '');
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export default function AcompanhamentoResumoMensal() {
  const mesInicial = mesAtualReferencia();
  const intervaloInicial = intervaloDoMes(mesInicial);

  const [mesReferencia, setMesReferencia] = useState(mesInicial);
  const [dataInicio, setDataInicio] = useState(intervaloInicial.inicio);
  const [dataFim, setDataFim] = useState(intervaloInicial.fim);
  const [resumo, setResumo] = useState(null);
  const [observacoes, setObservacoes] = useState({});
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, []);

  const periodoPersonalizado = useMemo(() => {
    const padrao = intervaloDoMes(mesReferencia);
    return dataInicio !== padrao.inicio || dataFim !== padrao.fim;
  }, [mesReferencia, dataInicio, dataFim]);

  const nomeExibicaoRelatorio = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';

  const alterarMesReferencia = (novoMes) => {
    setMesReferencia(novoMes);
    const intervalo = intervaloDoMes(novoMes);
    setDataInicio(intervalo.inicio);
    setDataFim(intervalo.fim);
  };

  const restaurarPeriodoMes = () => {
    const intervalo = intervaloDoMes(mesReferencia);
    setDataInicio(intervalo.inicio);
    setDataFim(intervalo.fim);
  };

  const carregarResumo = useCallback(async () => {
    if (!dataInicio || !dataFim) {
      setErro('Informe o período completo (data inicial e final).');
      return;
    }
    if (dataInicio > dataFim) {
      setErro('A data inicial deve ser anterior ou igual à data final.');
      return;
    }

    try {
      setLoading(true);
      setErro('');
      const dados = await obterResumoMensalAcompanhamentos({
        mesReferencia,
        dataInicio,
        dataFim,
      });
      setResumo(dados);
      setObservacoes({});
    } catch (error) {
      setResumo(null);
      setErro(error?.response?.data?.detail || 'Não foi possível carregar o resumo mensal.');
    } finally {
      setLoading(false);
    }
  }, [mesReferencia, dataInicio, dataFim]);

  useEffect(() => {
    carregarResumo();
  }, [carregarResumo]);

  const linhasVisiveis = useMemo(() => resumo?.linhas || [], [resumo]);

  const exportarCsv = () => {
    if (!resumo) return;
    const cabecalho = ['AÇÕES', 'Qtd.', 'OBS'];
    const linhasCsv = linhasVisiveis.map(linha => [
      escaparCsv(linha.acao),
      escaparCsv(linha.total),
      escaparCsv(observacoes[linha.acao] || linha.observacoes || ''),
    ]);
    const conteudo = [cabecalho, ...linhasCsv].map(l => l.join(',')).join('\n');
    const blob = new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-mensal-acompanhamentos-${mesReferencia}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const imprimir = async () => {
    if (!resumo) return;
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
    imprimirResumoMensalAcompanhamentos({
      resumo,
      observacoes,
      identidadeRelatorio,
      logoRelatorioDataUrl,
    });
  };

  return (
    <AppShell>
      <style>
        {`
          .resumo-mensal-documento col.col-acoes { width: 58%; }
          .resumo-mensal-documento col.col-num { width: 10%; }
          .resumo-mensal-documento col.col-obs { width: 32%; }
        `}
      </style>
      <Sidebar />
      <MainShell>
        <PageHeader
          title="Resumo mensal"
          subtitle="Quadro de totais do relatório técnico. Usa a personalização de relatórios do projeto na impressão."
          actions={(
            <div className="flex flex-wrap gap-2">
              <PremiumButton variant="secondary" onClick={exportarCsv} disabled={!resumo}>
                Exportar CSV
              </PremiumButton>
              <PremiumButton variant="secondary" onClick={imprimir} disabled={!resumo}>
                Imprimir / PDF
              </PremiumButton>
            </div>
          )}
        />

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Mês de referência</span>
            <input
              type="month"
              value={mesReferencia}
              onChange={(event) => alterarMesReferencia(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Data inicial</span>
            <input
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Data final</span>
            <input
              type="date"
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <PremiumButton onClick={carregarResumo} disabled={loading}>
            Atualizar
          </PremiumButton>
          {periodoPersonalizado ? (
            <PremiumButton variant="secondary" onClick={restaurarPeriodoMes} disabled={loading}>
              Restaurar mês completo
            </PremiumButton>
          ) : null}
        </div>

        {erro ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">Carregando resumo...</p>
        ) : resumo ? (
          <ScrollArea className="resumo-mensal-documento rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="p-6">
              <div className="mb-6 flex items-start justify-between gap-6 border-b border-slate-200 pb-4">
                <div>
                  {identidadeRelatorio?.relatorio_logo_url ? (
                    <AuthenticatedImage
                      caminhoOuUrl={identidadeRelatorio.relatorio_logo_url}
                      alt={nomeExibicaoRelatorio}
                      className="h-16 w-auto max-w-[220px] object-contain"
                    />
                  ) : (
                    <img
                      src={logoCarecore}
                      alt="CARECORE+"
                      className="h-16 w-auto max-w-[220px] object-contain"
                    />
                  )}
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                    {nomeExibicaoRelatorio}
                  </p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-bold uppercase tracking-wide text-slate-900">{resumo.titulo}</h2>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Período: {resumo.periodo_rotulo}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Gerado em {new Date(resumo.gerado_em).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <table className="w-full border-collapse text-sm">
                <colgroup>
                  <col className="col-acoes" />
                  <col className="col-num" />
                  <col className="col-obs" />
                </colgroup>
                <thead>
                  <tr className="border-b-2 border-slate-800">
                    <th className="px-3 py-2 text-left font-bold uppercase">Ações</th>
                    <th className="px-3 py-2 text-center font-bold uppercase">Qtd.</th>
                    <th className="px-3 py-2 text-left font-bold uppercase">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasVisiveis.map(linha => (
                    <tr key={linha.acao} className="border-b border-slate-200">
                      <td className="px-3 py-2 align-top">{linha.acao}</td>
                      <td className="px-3 py-2 text-center align-top font-semibold">{linha.total}</td>
                      <td className="px-3 py-2 align-top">
                        <textarea
                          rows={2}
                          value={observacoes[linha.acao] ?? ''}
                          onChange={(event) => setObservacoes(prev => ({
                            ...prev,
                            [linha.acao]: event.target.value,
                          }))}
                          placeholder="Opcional"
                          className="campo-obs-relatorio w-full resize-y rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-6 text-xs text-slate-500">
                Mês de referência: {resumo.mes_rotulo}. Contagens de ações, POT e suspensões usam o período
                {' '}
                {resumo.periodo_rotulo}. P.I.A. em andamento é snapshot atual (não filtra por data).
              </p>
            </div>
          </ScrollArea>
        ) : null}
      </MainShell>
    </AppShell>
  );
}
