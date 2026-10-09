import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { buscarIdentidadeRelatorios } from './utils/relatorioIdentidadePrint';
import { filtrarOrdenarConviventesPorBusca } from './utils/conviventeBuscaUtils';
import {
  colunasExportacaoAvaliacao,
  dadosExportacaoAvaliacao,
  imprimirAvaliacaoEmBranco,
  imprimirAvaliacaoParaAssinatura,
  imprimirRelatorioAvaliacaoEquipe,
  recorteDoRelatorio,
  rotuloPeriodoAvaliacao,
} from './utils/avaliacaoMensalPrint';

function dataLocalISO(data = new Date()) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function periodoPadraoMesAtual() {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  return { dataInicio: dataLocalISO(inicio), dataFim: dataLocalISO(hoje) };
}

function mensagemApi(erro) {
  const detalhe = erro?.response?.data?.detail;
  if (typeof detalhe === 'string' && detalhe.trim()) return detalhe;
  return 'Não foi possível gerar o relatório.';
}

function Campo({ rotulo, children }) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">{rotulo}</label>
      {children}
    </div>
  );
}

const classeCampo = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand';

const ROTULO_RESPOSTA = {
  otimo: 'Ótimo',
  bom: 'Bom',
  mais_ou_menos: 'Mais ou menos',
  preciso_melhorar: 'Preciso melhorar',
  ruim: 'Ruim',
};

export default function RelatorioAvaliacaoMensal() {
  const periodoInicial = useMemo(() => periodoPadraoMesAtual(), []);
  const [dataInicio, setDataInicio] = useState(periodoInicial.dataInicio);
  const [dataFim, setDataFim] = useState(periodoInicial.dataFim);
  const [busca, setBusca] = useState('');
  const [tecnicoId, setTecnicoId] = useState('');
  const [perguntaId, setPerguntaId] = useState('');
  const [respostaId, setRespostaId] = useState('');
  const [sugestoesFiltro, setSugestoesFiltro] = useState('');
  const [statusCadastro, setStatusCadastro] = useState('');
  const [tecnicos, setTecnicos] = useState([]);
  const [moradores, setMoradores] = useState([]);
  const [buscaManual, setBuscaManual] = useState('');
  const [moradorManual, setMoradorManual] = useState(null);
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aberta, setAberta] = useState(null);
  const [marcadas, setMarcadas] = useState([]);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [filtroAplicado, setFiltroAplicado] = useState(null);
  const primeira = useRef(true);
  const linkPublico = useMemo(() => `${window.location.origin}/avaliacao`, []);

  useEffect(() => {
    api.get('/api/tecnicos')
      .then((resposta) => setTecnicos(resposta.data || []))
      .catch(() => setTecnicos([]));
    api.get('/api/conviventes/resumo', { params: { status: 'Ativo' } })
      .then((resposta) => setMoradores(resposta.data || []))
      .catch(() => setMoradores([]));
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, []);

  const carregar = useCallback(async () => {
    if (!dataInicio || !dataFim) {
      setErro('Informe a data inicial e a data final.');
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const resposta = await api.get('/api/avaliacao-mensal/relatorio', {
        params: {
          data_inicio: dataInicio,
          data_fim: dataFim,
          busca: busca.trim() || undefined,
          tecnico_id: tecnicoId || undefined,
          pergunta_id: perguntaId || undefined,
          resposta_id: respostaId || undefined,
          sugestoes_filtro: sugestoesFiltro || undefined,
          status_cadastro: statusCadastro || undefined,
        },
      });
      setFiltroAplicado({
        dataInicio,
        dataFim,
        respostaId,
        rotuloResposta: ROTULO_RESPOSTA[respostaId] || '',
        perguntaId,
        busca: busca.trim(),
        tecnicoId,
        sugestoesFiltro,
        statusCadastro,
      });
      setRelatorio(resposta.data);
      setAberta(null);
      setMarcadas([]);
    } catch (falha) {
      setRelatorio(null);
      setErro(mensagemApi(falha));
    } finally {
      setCarregando(false);
    }
  }, [busca, dataFim, dataInicio, perguntaId, respostaId, statusCadastro, sugestoesFiltro, tecnicoId]);

  useEffect(() => {
    if (!primeira.current) return;
    primeira.current = false;
    carregar();
  }, [carregar]);

  const visao = useMemo(
    () => recorteDoRelatorio(relatorio, filtroAplicado || {}),
    [filtroAplicado, relatorio],
  );
  const pessoas = visao?.pessoas || [];
  const perguntas = visao?.perguntas || [];
  const catalogoPerguntas = relatorio?.perguntas || [];
  const opcoesFiltro = relatorio?.opcoes_filtro || [
    { id: 'otimo', rotulo: 'Ótimo' },
    { id: 'bom', rotulo: 'Bom' },
    { id: 'mais_ou_menos', rotulo: 'Mais ou menos' },
    { id: 'preciso_melhorar', rotulo: 'Preciso melhorar' },
    { id: 'ruim', rotulo: 'Ruim' },
  ];

  function subtituloFiltros() {
    const aplicado = filtroAplicado || {};
    const tecnicoNome = aplicado.tecnicoId
      ? tecnicos.find((tecnico) => String(tecnico.id) === String(aplicado.tecnicoId))?.nome
      : '';
    const pergunta = catalogoPerguntas.find((item) => item.id === aplicado.perguntaId);
    return [
      visao ? `Período: ${rotuloPeriodoAvaliacao(visao)}` : '',
      relatorio?.projeto,
      tecnicoNome ? `Técnico: ${tecnicoNome}` : '',
      aplicado.busca ? `Busca: ${aplicado.busca}` : '',
      pergunta ? `Pergunta: ${pergunta.texto}` : '',
      aplicado.rotuloResposta ? `Resposta: ${aplicado.rotuloResposta}` : '',
      aplicado.sugestoesFiltro === 'com' ? 'Com sugestões' : '',
      aplicado.sugestoesFiltro === 'sem' ? 'Sem sugestões' : '',
      aplicado.statusCadastro === 'ativo' ? 'Cadastro ativo' : '',
      aplicado.statusCadastro === 'nao_ativo' ? 'Cadastro não ativo' : '',
    ].filter(Boolean).join(' · ');
  }

  async function exportarXlsx() {
    if (!pessoas.length) return;
    await exportarRelatorioXlsx({
      nomeArquivo: `avaliacao_mensal_${visao.data_inicio}_a_${visao.data_fim}`,
      titulo: 'Avaliação mensal',
      filtros: {
        Período: rotuloPeriodoAvaliacao(visao),
        Projeto: visao.projeto,
        Total: visao.total,
        ...(visao.somenteResposta ? { Resposta: visao.somenteResposta } : {}),
      },
      colunas: colunasExportacaoAvaliacao(visao),
      dados: dadosExportacaoAvaliacao(visao),
    });
  }

  async function imprimirEquipe() {
    if (!pessoas.length) return;
    await imprimirRelatorioAvaliacaoEquipe({
      relatorio: visao,
      identidadeRelatorio,
      subtitulo: subtituloFiltros(),
    });
  }

  async function imprimirAssinatura(lista) {
    const escolhidas = lista?.length ? lista : pessoas;
    if (!escolhidas.length) return;
    await imprimirAvaliacaoParaAssinatura({
      pessoas: escolhidas,
      relatorio,
      identidadeRelatorio,
      subtitulo: subtituloFiltros(),
    });
  }

  function alternarMarcada(id) {
    setMarcadas((atual) => (
      atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]
    ));
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(linkPublico);
      setLinkCopiado(true);
    } catch {
      setLinkCopiado(false);
    }
  }

  const pessoasAssinatura = marcadas.length
    ? pessoas.filter((pessoa) => marcadas.includes(pessoa.id))
    : pessoas;

  const sugestoesManuais = useMemo(
    () => (buscaManual.trim() ? filtrarOrdenarConviventesPorBusca(moradores, buscaManual).slice(0, 8) : []),
    [buscaManual, moradores],
  );

  function nomeMorador(morador) {
    return (morador?.nome_social || morador?.nome_completo || '').trim();
  }

  function tecnicoDoMorador(morador) {
    return tecnicos.find((tecnico) => String(tecnico.id) === String(morador?.tecnico_id))?.nome || 'Sem técnico';
  }

  function mesDaFolha() {
    const partes = String(dataInicio || '').split('-');
    const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const indice = Number(partes[1]) - 1;
    if (!partes[0] || indice < 0 || indice > 11) return '';
    return `${nomes[indice]} de ${partes[0]}`;
  }

  async function imprimirEmBranco() {
    if (!moradorManual || !catalogoPerguntas.length) return;
    await imprimirAvaliacaoEmBranco({
      pessoa: {
        nome: nomeMorador(moradorManual),
        numero_prontuario: moradorManual.numero_institucional,
        tecnico: tecnicoDoMorador(moradorManual),
      },
      perguntas: catalogoPerguntas,
      mes: mesDaFolha(),
      identidadeRelatorio,
      subtitulo: relatorio?.projeto || '',
    });
  }

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Relatórios"
          title="Avaliação mensal"
          subtitle="Pesquisa completa para o morador assinar e o consolidado da equipe."
          icon="☑"
          actions={(
            <>
              <ReportActionButton action="export" onClick={exportarXlsx} disabled={!pessoas.length}>
                Exportar
              </ReportActionButton>
              <ReportActionButton action="print" onClick={imprimirEquipe} disabled={!pessoas.length}>
                Imprimir
              </ReportActionButton>
              <ReportActionButton
                action="print"
                onClick={() => imprimirAssinatura(pessoasAssinatura)}
                disabled={!pessoasAssinatura.length}
              >
                {marcadas.length ? 'Assinatura das marcadas' : 'Para assinatura'}
              </ReportActionButton>
              <PremiumButton type="button" variant="brand" onClick={carregar} disabled={carregando}>
                {carregando ? 'Gerando…' : 'Gerar relatório'}
              </PremiumButton>
            </>
          )}
        />
        <ScrollArea className="pb-24">
          <DireitosReservadosAviso className="mb-4" />
          <section className="mb-6 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-gray-900">Filtros</h2>
            <p className="mt-1 text-xs text-gray-500">
              Período de até 366 dias. A busca aceita nome ou número de prontuário.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Campo rotulo="Data inicial">
                <input type="date" value={dataInicio} onChange={(evento) => setDataInicio(evento.target.value)} className={classeCampo} />
              </Campo>
              <Campo rotulo="Data final">
                <input type="date" value={dataFim} onChange={(evento) => setDataFim(evento.target.value)} className={classeCampo} />
              </Campo>
              <Campo rotulo="Técnico responsável">
                <select value={tecnicoId} onChange={(evento) => setTecnicoId(evento.target.value)} className={classeCampo}>
                  <option value="">Todos</option>
                  {tecnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>{tecnico.nome}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Convivente">
                <input
                  type="search"
                  value={busca}
                  onChange={(evento) => setBusca(evento.target.value)}
                  placeholder="Nome ou prontuário"
                  className={classeCampo}
                />
              </Campo>
              <Campo rotulo="Pergunta">
                <select value={perguntaId} onChange={(evento) => setPerguntaId(evento.target.value)} className={classeCampo}>
                  <option value="">Todas</option>
                  {catalogoPerguntas.map((pergunta, ordem) => (
                    <option key={pergunta.id} value={pergunta.id}>{ordem + 1}. {pergunta.texto}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Tipo de resposta">
                <select value={respostaId} onChange={(evento) => setRespostaId(evento.target.value)} className={classeCampo}>
                  <option value="">Todas</option>
                  {opcoesFiltro.map((opcao) => (
                    <option key={opcao.id} value={opcao.id}>{opcao.rotulo}</option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Sugestões">
                <select value={sugestoesFiltro} onChange={(evento) => setSugestoesFiltro(evento.target.value)} className={classeCampo}>
                  <option value="">Todas</option>
                  <option value="com">Somente com texto</option>
                  <option value="sem">Somente sem texto</option>
                </select>
              </Campo>
              <Campo rotulo="Situação no cadastro">
                <select value={statusCadastro} onChange={(evento) => setStatusCadastro(evento.target.value)} className={classeCampo}>
                  <option value="">Todas</option>
                  <option value="ativo">Ativo</option>
                  <option value="nao_ativo">Não ativo</option>
                </select>
              </Campo>
            </div>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">Link para o morador</p>
              <p className="break-all">{linkPublico}</p>
              <button type="button" onClick={copiarLink} className="mt-2 h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white">
                {linkCopiado ? 'Link copiado' : 'Copiar link'}
              </button>
            </div>
          </section>

          <section className="mb-6 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-base font-black text-gray-900">Formulário para preencher à mão</h2>
            <p className="mt-1 text-xs text-gray-500">
              Escolha o morador. A folha sai com o nome, o prontuário e o técnico, e as perguntas em branco para marcar.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <Campo rotulo="Morador">
                <input
                  type="search"
                  value={buscaManual}
                  onChange={(evento) => {
                    setBuscaManual(evento.target.value);
                    setMoradorManual(null);
                  }}
                  placeholder="Nome ou prontuário"
                  className={classeCampo}
                />
              </Campo>
              <button
                type="button"
                onClick={imprimirEmBranco}
                disabled={!moradorManual || !catalogoPerguntas.length}
                className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Imprimir formulário
              </button>
            </div>
            {!moradorManual && sugestoesManuais.length ? (
              <ul className="mt-2 overflow-hidden rounded-2xl border border-slate-200">
                {sugestoesManuais.map((morador) => (
                  <li key={morador.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setMoradorManual(morador);
                        setBuscaManual(`${morador.numero_institucional} · ${nomeMorador(morador)}`);
                      }}
                    >
                      <span className="font-semibold text-slate-900">
                        {morador.numero_institucional} · {nomeMorador(morador)}
                      </span>
                      <span className="text-slate-500">{tecnicoDoMorador(morador)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {moradorManual ? (
              <p className="mt-3 text-sm text-slate-600">
                Folha de {nomeMorador(moradorManual)}, prontuário {moradorManual.numero_institucional}, {tecnicoDoMorador(moradorManual)}.
              </p>
            ) : null}
          </section>

          {erro ? (
            <p className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erro}</p>
          ) : null}

          {!relatorio && !carregando ? (
            <p className="p-8 text-center text-sm text-gray-500">Escolha os filtros e clique em Gerar relatório.</p>
          ) : null}

          {relatorio && !carregando ? (
            <>
              <section className="mb-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{relatorio.projeto}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {visao.total} {visao.total === 1 ? 'resposta' : 'respostas'}
                  {visao.somenteResposta ? ` com ${visao.somenteResposta}` : ''}
                </p>
                <p className="text-sm text-slate-500">{rotuloPeriodoAvaliacao(visao)}</p>
              </section>

              <div className="mb-4 grid gap-3">
                {perguntas.map((pergunta, ordem) => (
                  <article key={pergunta.id} className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-900">{ordem + 1}. {pergunta.texto}</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {pergunta.opcoes.map((opcao) => (
                        <p key={opcao.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          <span>{opcao.rotulo}</span>
                          <span className="font-bold text-slate-900">{opcao.total}</span>
                        </p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>

              <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <h2 className="text-lg font-bold text-slate-900">Quem respondeu</h2>
                  {pessoas.length ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-teal-800"
                      onClick={() => setMarcadas(
                        marcadas.length === pessoas.length ? [] : pessoas.map((pessoa) => pessoa.id),
                      )}
                    >
                      {marcadas.length === pessoas.length ? 'Desmarcar' : 'Marcar todas'}
                    </button>
                  ) : null}
                </div>
                {pessoas.length === 0 ? (
                  <p className="p-6 text-sm text-slate-500">Nenhuma resposta com esses filtros.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {pessoas.map((pessoa) => {
                      const abertaEsta = aberta === pessoa.id;
                      return (
                        <li key={pessoa.id} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={marcadas.includes(pessoa.id)}
                              onChange={() => alternarMarcada(pessoa.id)}
                              aria-label={`Marcar ${pessoa.nome}`}
                            />
                            <button
                              type="button"
                              onClick={() => setAberta(abertaEsta ? null : pessoa.id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <span className="block font-semibold text-slate-900">
                                {pessoa.numero_prontuario} · {pessoa.nome}
                              </span>
                              <span className="text-sm text-slate-500">
                                {pessoa.tecnico} · {pessoa.respondido_em}
                              </span>
                              {pessoa.marcadas?.length ? (
                                <span className="mt-1 block text-sm text-slate-600">
                                  {pessoa.marcadas.map((item) => item.pergunta).join(' · ')}
                                </span>
                              ) : null}
                            </button>
                            <button
                              type="button"
                              onClick={() => imprimirAssinatura([pessoa])}
                              className="h-10 shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"
                            >
                              Assinatura
                            </button>
                          </div>
                          {abertaEsta ? (
                            <div className="mt-3 space-y-2 pl-7 text-sm text-slate-700">
                              {pessoa.respostas.map((item) => (
                                <p key={item.id}>
                                  <span className="font-semibold">{item.pergunta}</span>
                                  {' '}
                                  {item.resposta}
                                </p>
                              ))}
                              {pessoa.sugestoes ? (
                                <p className="rounded-xl bg-slate-50 p-3">
                                  <span className="font-semibold">Sugestões e elogios: </span>
                                  {pessoa.sugestoes}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
