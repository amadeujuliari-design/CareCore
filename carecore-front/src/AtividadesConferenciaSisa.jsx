import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton } from './components/PremiumUI';
import { useAuth } from './context/AuthContext';
import {
  conferirAtividadesSisa,
  excluirHistoricoConferenciaSisa,
  listarAtividades,
  listarHistoricoConferenciasSisa,
  obterHistoricoConferenciaSisa,
} from './services/atividadesService';
import { usuarioSomenteLeituraAtividades } from './config/atividadesConfig';
import { API_BASE_URL } from './config/apiBase';
import {
  exportarConferenciaSisaXlsx,
  montarDadosExportacaoConferenciaSisa,
} from './utils/exportarAtividadesXlsx';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
} from './utils/relatorioIdentidadePrint';

function formatarData(valor) {
  if (!valor) return '-';
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR');
}

function formatarDataHora(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '-';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function classeStatus(status) {
  if (status === 'conferida') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'divergencia_quantidade') return 'bg-amber-50 text-amber-800 border-amber-100';
  if (status === 'sem_ocorrencia_carecore') return 'bg-orange-50 text-orange-800 border-orange-100';
  if (status === 'somente_carecore') return 'bg-blue-50 text-blue-800 border-blue-100';
  return 'bg-gray-50 text-gray-700 border-gray-200';
}

function rotuloStatus(status) {
  const mapa = {
    conferida: 'Conferida',
    divergencia_quantidade: 'Divergência de quantidade',
    sem_vinculo: 'Sem vínculo',
    sem_ocorrencia_carecore: 'Sem sessão no CareCore+',
    somente_carecore: 'Só no CareCore+',
  };
  return mapa[status] || status;
}

function vinculosDePayload(lista = []) {
  const mapa = {};
  lista.forEach((item) => {
    if (item?.chave && item?.atividade_id) mapa[item.chave] = item.atividade_id;
  });
  return mapa;
}

function formatarVariacao(valor, invertido = false) {
  if (!valor) return { texto: '0', classe: 'text-gray-500' };
  const melhorou = invertido ? valor < 0 : valor > 0;
  const piorou = invertido ? valor > 0 : valor < 0;
  const sinal = valor > 0 ? '+' : '';
  return {
    texto: `${sinal}${valor}`,
    classe: melhorou ? 'text-emerald-700' : piorou ? 'text-amber-700' : 'text-gray-500',
  };
}

export default function AtividadesConferenciaSisa() {
  const { isGlobal, usuario } = useAuth();
  const somenteLeitura = usuarioSomenteLeituraAtividades(usuario, isGlobal);
  const arquivoInputRef = useRef(null);
  const detalheConferenciaRef = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [nomeArquivoExibicao, setNomeArquivoExibicao] = useState('');
  const [atividades, setAtividades] = useState([]);
  const [vinculos, setVinculos] = useState({});
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [historicoSelecionadoId, setHistoricoSelecionadoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [carregandoHistoricoId, setCarregandoHistoricoId] = useState('');
  const [excluindoHistoricoId, setExcluindoHistoricoId] = useState('');
  const [erro, setErro] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  const carregarHistorico = useCallback(async () => {
    try {
      const dados = await listarHistoricoConferenciasSisa(24, 0);
      setHistorico(dados.items || []);
    } catch {
      setHistorico([]);
    }
  }, []);

  const carregarBase = useCallback(async () => {
    setLoading(true);
    try {
      const [atividadesResp, identidade] = await Promise.all([
        listarAtividades(false),
        buscarIdentidadeRelatorios(),
      ]);
      setAtividades(atividadesResp.items || []);
      setIdentidadeRelatorio(identidade);
      await carregarHistorico();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar dados da conferência SISA.');
    } finally {
      setLoading(false);
    }
  }, [carregarHistorico]);

  useEffect(() => {
    carregarBase();
  }, [carregarBase]);

  const aplicarResultadoConferencia = (dados, vinculosPayload = [], opcoes = {}) => {
    setResultado(dados);
    setHistoricoSelecionadoId(opcoes.historicoId || dados.historico_id || '');
    setNomeArquivoExibicao(opcoes.nomeArquivo || dados.nome_arquivo || '');

    const vinculosAtualizados = { ...vinculosDePayload(vinculosPayload) };
    (dados.linhas || []).forEach((linha) => {
      if (linha.atividade_id) vinculosAtualizados[linha.chave] = linha.atividade_id;
      else if (linha.sugestao_atividade_id && !vinculosAtualizados[linha.chave]) {
        vinculosAtualizados[linha.chave] = linha.sugestao_atividade_id;
      }
    });
    setVinculos(vinculosAtualizados);

    if (opcoes.rolarParaDetalhe !== false) {
      requestAnimationFrame(() => {
        detalheConferenciaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  };

  const montarVinculosPayload = () => Object.entries(vinculos)
    .filter(([, atividadeId]) => atividadeId)
    .map(([chave, atividade_id]) => ({ chave, atividade_id }));

  const executarConferencia = async (arquivoEnvio = arquivo) => {
    if (!arquivoEnvio) {
      setErro('Selecione o arquivo exportado do SISA.');
      return;
    }
    setProcessando(true);
    setErro('');
    try {
      const dados = await conferirAtividadesSisa(arquivoEnvio, montarVinculosPayload(), true, true);
      aplicarResultadoConferencia(dados, montarVinculosPayload(), {
        historicoId: dados.historico_id,
        nomeArquivo: arquivoEnvio.name,
      });
      await carregarHistorico();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível conferir a planilha SISA.');
      setResultado(null);
    } finally {
      setProcessando(false);
    }
  };

  const abrirHistorico = async (historicoId) => {
    if (!historicoId) return;
    setCarregandoHistoricoId(historicoId);
    setErro('');
    try {
      const detalhe = await obterHistoricoConferenciaSisa(historicoId);
      aplicarResultadoConferencia(detalhe.resultado, detalhe.vinculos, {
        historicoId: detalhe.id,
        nomeArquivo: detalhe.nome_arquivo,
      });
      setArquivo(null);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível abrir o histórico salvo.');
    } finally {
      setCarregandoHistoricoId('');
    }
  };

  const limparConferenciaAtual = () => {
    setResultado(null);
    setVinculos({});
    setHistoricoSelecionadoId('');
    setNomeArquivoExibicao('');
    setArquivo(null);
    setFiltroSomenteSemVinculo(false);
  };

  const excluirHistorico = async (item) => {
    if (!item?.id || somenteLeitura) return;

    const confirmado = window.confirm(
      `Excluir a importação "${item.nome_arquivo}"?\n\n`
      + `Período: ${formatarData(item.data_inicio_referencia)} a ${formatarData(item.data_fim_referencia)}.\n\n`
      + 'Esta ação remove apenas o registro salvo desta conferência. '
      + 'Vínculos já memorizados, catálogo SISA e presenças no CareCore+ não serão alterados.',
    );
    if (!confirmado) return;

    setExcluindoHistoricoId(item.id);
    setErro('');
    try {
      await excluirHistoricoConferenciaSisa(item.id);
      if (historicoSelecionadoId === item.id) {
        limparConferenciaAtual();
      }
      await carregarHistorico();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível excluir a importação.');
    } finally {
      setExcluindoHistoricoId('');
    }
  };

  const aoSelecionarArquivo = async (event) => {
    const selecionado = event.target.files?.[0];
    setArquivo(selecionado || null);
    setResultado(null);
    setVinculos({});
    setHistoricoSelecionadoId('');
    setNomeArquivoExibicao('');
    if (selecionado) {
      await executarConferencia(selecionado);
    }
  };

  const linhasVisiveis = useMemo(() => {
    if (!resultado?.linhas?.length) return [];
    return resultado.linhas;
  }, [resultado]);

  const linhasSemVinculo = useMemo(
    () => linhasVisiveis.filter((linha) => linha.status === 'sem_vinculo'),
    [linhasVisiveis],
  );

  const [filtroSomenteSemVinculo, setFiltroSomenteSemVinculo] = useState(false);

  const linhasExibidas = useMemo(() => {
    if (!filtroSomenteSemVinculo) return linhasVisiveis;
    return linhasSemVinculo;
  }, [filtroSomenteSemVinculo, linhasVisiveis, linhasSemVinculo]);

  const podeExportarImprimir = Boolean(
    resultado && ((resultado.linhas?.length ?? 0) > 0 || (resultado.somente_carecore?.length ?? 0) > 0),
  );

  const evolucaoResumo = useMemo(() => {
    if (historico.length < 2) return null;
    const atual = historico[0];
    const anterior = historico[1];
    const diff = (campo) => (atual.resumo?.[campo] ?? 0) - (anterior.resumo?.[campo] ?? 0);
    return {
      atual,
      anterior,
      divergencias: diff('divergencias_quantidade'),
      conferidas: diff('conferidas'),
      semVinculo: diff('sem_vinculo'),
      somenteCarecore: diff('somente_carecore'),
    };
  }, [historico]);

  const apiAmbienteLocal = useMemo(() => {
    try {
      const host = new URL(API_BASE_URL).hostname;
      return host === 'localhost' || host === '127.0.0.1';
    } catch {
      return false;
    }
  }, []);

  const exportarXlsx = () => {
    if (!podeExportarImprimir) return;
    exportarConferenciaSisaXlsx(resultado, { vinculos, atividades });
  };

  const imprimirConferencia = async () => {
    if (!podeExportarImprimir) return;

    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
    const { colunas, dados } = montarDadosExportacaoConferenciaSisa(resultado, { vinculos, atividades });
    const subtitulo = [
      `Período SISA: ${formatarData(resultado.data_inicio_referencia)} a ${formatarData(resultado.data_fim_referencia)}`,
      resultado.servico ? `Serviço: ${resultado.servico}` : null,
      nomeArquivoExibicao ? `Arquivo: ${nomeArquivoExibicao}` : null,
      historicoSelecionadoId ? 'Registro histórico salvo' : null,
    ].filter(Boolean).join(' · ');

    imprimirRelatorio({
      titulo: 'Conferência SISA — Atividades',
      subtitulo,
      metricas: [
        { label: 'Conferidas', valor: resultado.resumo?.conferidas ?? 0 },
        { label: 'Divergências', valor: resultado.resumo?.divergencias_quantidade ?? 0 },
        { label: 'Sem vínculo', valor: resultado.resumo?.sem_vinculo ?? 0 },
        { label: 'Só CareCore+', valor: resultado.resumo?.somente_carecore ?? 0 },
      ],
      colunas,
      dados,
      identidade: {
        ...(identidadeRelatorio || {}),
        logo_src: logoRelatorioDataUrl || undefined,
      },
      orientacao: 'landscape',
    });
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Conferência SISA"
          subtitulo="Importe o Relatório Resumo de Atividades do SISA e compare com as presenças do CareCore+. Cada conferência fica salva para acompanhar a evolução."
          actions={(
            <>
              <ReportActionButton
                action="export"
                onClick={exportarXlsx}
                disabled={!podeExportarImprimir}
              >
                Exportar XLSX
              </ReportActionButton>
              <ReportActionButton
                action="print"
                onClick={imprimirConferencia}
                disabled={!podeExportarImprimir}
              >
                Imprimir
              </ReportActionButton>
            </>
          )}
        />

        {apiAmbienteLocal && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Ambiente local detectado</strong> — esta tela está usando a API em{' '}
            <code className="rounded bg-white/80 px-1">{API_BASE_URL}</code>.
            {' '}O histórico, vínculos e catálogo SISA são gravados no <strong>SQLite desta máquina</strong>,
            não no PostgreSQL de produção (Supabase). Para operação real e evolução entre meses no ambiente online,
            use <strong>app.carecoreplus.com.br</strong> após publicar o módulo e aplicar as migrations no banco online.
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm text-gray-600">
            Exporte no SISA o relatório <strong>Resumo de Atividades</strong> (.xls) e envie aqui.
            A comparação usa <strong>data + horário + tipo/tema SISA</strong>.
            Cada importação ou reconferência gera um registro no histórico abaixo.
          </p>
          <input
            ref={arquivoInputRef}
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            onChange={aoSelecionarArquivo}
          />
          <div className="flex flex-wrap gap-2">
            <PremiumButton type="button" onClick={() => arquivoInputRef.current?.click()} disabled={processando}>
              {arquivo ? 'Trocar arquivo' : 'Selecionar arquivo SISA'}
            </PremiumButton>
            {arquivo && (
              <ReportActionButton type="button" onClick={() => executarConferencia()} disabled={processando}>
                {processando ? 'Conferindo...' : 'Atualizar conferência'}
              </ReportActionButton>
            )}
          </div>
          {nomeArquivoExibicao && (
            <p className="mt-2 text-xs font-semibold text-gray-500">
              Arquivo: {nomeArquivoExibicao}
              {historicoSelecionadoId ? ' · visualizando registro salvo' : ''}
            </p>
          )}
        </div>

        {erro && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {erro}
          </div>
        )}

        {resultado && (
          <>
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              {[
                ['Conferidas', resultado.resumo?.conferidas],
                ['Divergências', resultado.resumo?.divergencias_quantidade],
                ['Sem vínculo', resultado.resumo?.sem_vinculo],
                ['Só CareCore+', resultado.resumo?.somente_carecore],
              ].map(([rotulo, valor]) => (
                <div key={rotulo} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{rotulo}</p>
                  <p className="mt-2 text-2xl font-black text-gray-900">{valor ?? 0}</p>
                </div>
              ))}
            </div>

            <div className="mb-4 rounded-2xl border border-brand/10 bg-brand/5 px-4 py-3 text-sm text-gray-700">
              <strong>Período SISA:</strong> {formatarData(resultado.data_inicio_referencia)} a {formatarData(resultado.data_fim_referencia)}
              {resultado.servico ? <> · <strong>Serviço:</strong> {resultado.servico}</> : null}
            </div>
          </>
        )}

        <div
          ref={detalheConferenciaRef}
          className="mb-4 rounded-2xl border border-gray-100 bg-white shadow-sm"
        >
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Carregando...</p>
          ) : !resultado ? (
            <p className="p-6 text-sm text-gray-500">
              Envie uma planilha SISA para iniciar a conferência ou abra um registro do histórico abaixo.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    Vínculos por sessão SISA ({linhasVisiveis.length})
                  </p>
                  <p className="text-xs text-gray-500">
                    Escolha a atividade CareCore+ correspondente a cada linha do SISA.
                    {linhasSemVinculo.length > 0 ? ` ${linhasSemVinculo.length} aguardando vínculo.` : ''}
                  </p>
                </div>
                {linhasSemVinculo.length > 0 && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                    <input
                      type="checkbox"
                      checked={filtroSomenteSemVinculo}
                      onChange={(event) => setFiltroSomenteSemVinculo(event.target.checked)}
                    />
                    Mostrar só sem vínculo
                  </label>
                )}
              </div>

              <div className="max-h-[min(62vh,720px)] overflow-y-auto divide-y divide-gray-100">
                {linhasExibidas.length === 0 ? (
                  <p className="p-6 text-sm text-gray-500">Nenhuma linha neste filtro.</p>
                ) : (
                  linhasExibidas.map((linha) => (
                    <div key={linha.chave} className="grid gap-3 p-4 lg:grid-cols-[1fr_220px]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${classeStatus(linha.status)}`}>
                            {rotuloStatus(linha.status)}
                          </span>
                          <span className="text-sm font-bold text-gray-900">{formatarData(linha.data_sessao)} · {linha.horario}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">
                          {linha.descricao_atividade} · <strong>{linha.descricao_tema}</strong>
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          SISA: <strong>{linha.participacoes_sisa}</strong>
                          {' · '}
                          CareCore: <strong>{linha.participacoes_carecore}</strong>
                          {linha.delta != null && linha.delta !== 0 ? ` · Δ ${linha.delta > 0 ? '+' : ''}${linha.delta}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{linha.mensagem}</p>
                      </div>
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                        Atividade CareCore+
                        <select
                          value={vinculos[linha.chave] || linha.atividade_id || linha.sugestao_atividade_id || ''}
                          onChange={(event) => setVinculos({ ...vinculos, [linha.chave]: event.target.value })}
                          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm normal-case"
                        >
                          <option value="">Selecione</option>
                          {atividades.map((item) => (
                            <option key={item.id} value={item.id}>{item.nome}</option>
                          ))}
                        </select>
                        {linha.sugestao_atividade_id && !vinculos[linha.chave] && !linha.atividade_id && (
                          <p className="mt-1 text-[11px] font-semibold normal-case text-indigo-700">
                            Sugestão automática pré-selecionada quando disponível.
                          </p>
                        )}
                      </label>
                    </div>
                  ))
                )}

                {resultado.somente_carecore?.length > 0 && (
                  <div className="bg-gray-50 p-4">
                    <p className="mb-3 text-sm font-bold text-gray-800">Sessões só no CareCore+</p>
                    <div className="space-y-2">
                      {resultado.somente_carecore.map((linha) => (
                        <div key={linha.chave} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm">
                          <strong>{linha.atividade_nome}</strong> · {formatarData(linha.data_sessao)} · {linha.horario}
                          {' · '}
                          {linha.participacoes_carecore} presença(s)
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {resultado && (
          <div className="mb-4 flex flex-wrap justify-end gap-2">
            {arquivo ? (
              <PremiumButton type="button" onClick={() => executarConferencia()} disabled={processando}>
                {processando ? 'Aplicando vínculos...' : 'Reconferir com vínculos selecionados'}
              </PremiumButton>
            ) : (
              <PremiumButton type="button" onClick={() => arquivoInputRef.current?.click()} disabled={processando}>
                Reenviar planilha para aplicar vínculos
              </PremiumButton>
            )}
            {!somenteLeitura && historicoSelecionadoId && (
              <PremiumButton
                type="button"
                variant="secondary"
                disabled={excluindoHistoricoId === historicoSelecionadoId}
                onClick={() => {
                  const item = historico.find((registro) => registro.id === historicoSelecionadoId);
                  if (item) excluirHistorico(item);
                }}
                className="!border-red-200 !text-red-700 hover:!bg-red-50"
              >
                {excluindoHistoricoId === historicoSelecionadoId ? 'Excluindo...' : 'Excluir esta importação'}
              </PremiumButton>
            )}
          </div>
        )}

        {historico.length > 0 && (
          <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-gray-900">Histórico e evolução</p>
                <p className="text-xs text-gray-500">Compare importações ao longo do tempo para ver se as divergências estão diminuindo.</p>
              </div>
              {evolucaoResumo && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-3 py-2 text-xs text-gray-700">
                  <span className="font-bold text-indigo-900">Última vs anterior:</span>
                  {' '}
                  Conferidas {formatarVariacao(evolucaoResumo.conferidas).texto}
                  {' · '}
                  Divergências {formatarVariacao(evolucaoResumo.divergencias, true).texto}
                  {' · '}
                  Sem vínculo {formatarVariacao(evolucaoResumo.semVinculo, true).texto}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <th className="px-2 py-2">Importado em</th>
                    <th className="px-2 py-2">Período SISA</th>
                    <th className="px-2 py-2">Arquivo</th>
                    <th className="px-2 py-2 text-center">Conferidas</th>
                    <th className="px-2 py-2 text-center">Divergências</th>
                    <th className="px-2 py-2 text-center">Sem vínculo</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {historico.map((item) => {
                    const selecionado = item.id === historicoSelecionadoId;
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-gray-50 ${selecionado ? 'bg-brand/5' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-2 py-2 whitespace-nowrap">{formatarDataHora(item.importado_em)}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
                          {formatarData(item.data_inicio_referencia)} a {formatarData(item.data_fim_referencia)}
                        </td>
                        <td className="px-2 py-2 max-w-[180px] truncate" title={item.nome_arquivo}>{item.nome_arquivo}</td>
                        <td className="px-2 py-2 text-center font-semibold">{item.resumo?.conferidas ?? 0}</td>
                        <td className="px-2 py-2 text-center font-semibold text-amber-800">{item.resumo?.divergencias_quantidade ?? 0}</td>
                        <td className="px-2 py-2 text-center font-semibold">{item.resumo?.sem_vinculo ?? 0}</td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <PremiumButton
                              type="button"
                              variant="secondary"
                              disabled={carregandoHistoricoId === item.id || excluindoHistoricoId === item.id}
                              onClick={() => abrirHistorico(item.id)}
                            >
                              {carregandoHistoricoId === item.id ? 'Abrindo...' : 'Abrir'}
                            </PremiumButton>
                            {!somenteLeitura && (
                              <PremiumButton
                                type="button"
                                variant="secondary"
                                disabled={excluindoHistoricoId === item.id || carregandoHistoricoId === item.id}
                                onClick={() => excluirHistorico(item)}
                                className="!border-red-200 !text-red-700 hover:!bg-red-50"
                              >
                                {excluindoHistoricoId === item.id ? 'Excluindo...' : 'Excluir'}
                              </PremiumButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </MainShell>
    </AppShell>
  );
}
