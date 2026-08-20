import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Receipt, UserRoundCog, Users } from 'lucide-react';

import Sidebar from './Sidebar';
import BannerSomenteLeituraGlobal from './components/BannerSomenteLeituraGlobal';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import NfpTermometroArrecadacao from './components/nfp/NfpTermometroArrecadacao';
import {
  nfpCalcularRateio,
  nfpDashboard,
  nfpExportarRateio,
  nfpImportarCnpjs,
  nfpImportarDoacoes,
  nfpImportarDoadores,
  nfpImportarSefaz,
  nfpListarBatimentos,
  nfpListarRateio,
} from './services/nfpService';
import { nfpRelatorioRateioConsolidado } from './services/relatorioNfpService';
import { erroApiNfp, formatarCNPJ } from './utils/nfpCadastroUtils';
import { formatarCPF } from './utils/usuariosUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { usuarioSomenteLeituraNfp } from './utils/rbacUtils';

const ABAS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'importacoes', label: 'Importações' },
  { id: 'rateio', label: 'Rateio' },
  { id: 'batimento', label: 'Lançamentos de Doadores Diretos' },
];

function money(valor) {
  const n = Number(valor || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function montarResumoImportacao(tipo, r) {
  if (!r) return null;
  if (tipo === 'sefaz') {
    return {
      titulo: 'Resumo da importação — Créditos SEFAZ',
      linhas: [
        ['Competência', r.competencia || '—'],
        ['Arquivos processados', String(r.arquivos ?? 0)],
        ['Linhas nos arquivos', String(r.linhas_arquivo ?? 0)],
        ['Créditos importados', String(r.inseridos ?? 0)],
        ['Excluídos (status Bloqueado)', String(r.ignorados_bloqueados ?? 0)],
        ['Cruzamentos (doadores diretos)', String(r.cruzamentos ?? r.batimentos ?? 0)],
        ['Doadores sincronizados', String(r.doadores_sincronizados?.criados ?? 0)],
      ],
    };
  }
  if (tipo === 'doacoes') {
    return {
      titulo: 'Resumo da importação — Pedidos (doações)',
      linhas: [
        ['Competência', r.competencia || '—'],
        ['Linhas no arquivo', String(r.linhas_arquivo ?? 0)],
        ['Doações importadas', String(r.inseridos ?? 0)],
        ['Ignorados (tipo ≠ DOACAO_AUTOMATICA)', String(r.ignorados_tipo ?? 0)],
        ['Cruzamentos (doadores diretos)', String(r.cruzamentos ?? r.batimentos ?? 0)],
        ['Doadores sincronizados', String(r.doadores_sincronizados?.criados ?? 0)],
      ],
    };
  }
  if (tipo === 'cnpjs') {
    return {
      titulo: 'Resumo da importação — CNPJs',
      linhas: [
        ['Competência', r.competencia || '—'],
        ['CNPJs na lista', String(r.vinculos_competencia ?? 0)],
        ['Novos no cadastro', String(r.inseridos ?? 0)],
        ['Comparado a', r.competencia_anterior || 'primeira lista'],
        ['Saíram', String(r.saidas ?? 0)],
        ['Entraram', String(r.entradas ?? 0)],
      ],
    };
  }
  if (tipo === 'doadores') {
    return {
      titulo: 'Resumo da importação — Doadores',
      linhas: [
        ['Inseridos', String(r.inseridos ?? 0)],
        ['Ignorados', String(r.ignorados ?? 0)],
      ],
    };
  }
  return null;
}

function CampoArquivo({ label, onChange, accept = '.xlsx,.xls,.csv', multiple = false, hint }) {
  return (
    <label className="block text-sm text-slate-700">
      <span className="mb-1 block font-semibold">{label}</span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          onChange(multiple ? files : (files[0] || null));
        }}
        className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
      />
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export default function NfpCreditos() {
  const somenteLeitura = useMemo(() => {
    try {
      const token = localStorage.getItem('@CareCore:token');
      return usuarioSomenteLeituraNfp(token ? decodificarPayloadJwt(token) : null);
    } catch {
      return false;
    }
  }, []);
  const [aba, setAba] = useState('dashboard');
  const [competencia, setCompetencia] = useState('');
  const [agente, setAgente] = useState(''); // '' = Todos
  const [resumo, setResumo] = useState(null);
  const [rateio, setRateio] = useState([]);
  const [batimentos, setBatimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [arquivoDoadores, setArquivoDoadores] = useState(null);
  const [arquivoCnpjs, setArquivoCnpjs] = useState(null);
  const [arquivoDoacoes, setArquivoDoacoes] = useState(null);
  const [arquivosSefaz, setArquivosSefaz] = useState([]);
  const [serieArrecadacao, setSerieArrecadacao] = useState([]);
  const [rankingAgentes, setRankingAgentes] = useState([]);
  const [totaisSerie, setTotaisSerie] = useState({});
  const [agenteGrafico, setAgenteGrafico] = useState('');
  const [mesesGrafico, setMesesGrafico] = useState(12);
  const [loadingGrafico, setLoadingGrafico] = useState(false);
  const [resumoImportacao, setResumoImportacao] = useState(null);

  const abasVisiveis = useMemo(
    () => (somenteLeitura ? ABAS.filter((item) => item.id !== 'importacoes') : ABAS),
    [somenteLeitura],
  );

  const agentes = useMemo(
    () => resumo?.agentes_captacao?.length ? resumo.agentes_captacao : ['DIEGO'],
    [resumo],
  );
  const visaoTodos = Boolean(resumo?.visao_todos) || !agente;
  const agenteAtivo = visaoTodos ? '' : (resumo?.agente_captacao || agente);
  const rotuloAgente = visaoTodos ? 'agentes' : agenteAtivo;
  const percentualAgente = resumo?.percentual_agente ?? resumo?.percentual_captacao ?? 50;
  const percentualAeb = Math.max(0, 100 - Number(percentualAgente || 0));

  const carregarDashboard = useCallback(async (comp, agenteSel) => {
    setLoading(true);
    setErro('');
    try {
      const data = await nfpDashboard(comp || undefined, agenteSel === undefined ? undefined : agenteSel);
      setResumo(data);
      if (data?.competencia && !comp) setCompetencia(data.competencia);
      if (data?.visao_todos) setAgente('');
      else if (data?.agente_captacao) setAgente(data.agente_captacao);
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível carregar o dashboard NFP.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDashboard();
  }, [carregarDashboard]);

  useEffect(() => {
    if (somenteLeitura && aba === 'importacoes') {
      setAba('dashboard');
    }
  }, [somenteLeitura, aba]);

  const carregarListas = useCallback(async () => {
    setErro('');
    try {
      if (aba === 'rateio' && competencia) {
        setRateio(await nfpListarRateio(competencia, { limite: 300 }));
      }
      if (aba === 'batimento' && competencia) {
        setBatimentos(await nfpListarBatimentos(competencia, { limite: 200 }));
      }
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível carregar os dados NFP.'));
    }
  }, [aba, competencia]);

  useEffect(() => {
    if (aba === 'dashboard') return undefined;
    carregarListas();
    return undefined;
  }, [aba, carregarListas]);

  const competencias = useMemo(() => resumo?.competencias || [], [resumo]);

  const carregarGrafico = useCallback(async () => {
    if (!competencias.length) {
      setSerieArrecadacao([]);
      setRankingAgentes([]);
      setTotaisSerie({});
      return;
    }

    const ordenadas = [...competencias].sort();
    const janela = ordenadas.slice(Math.max(0, ordenadas.length - Number(mesesGrafico || 12)));
    const competenciaInicio = janela[0];
    const competenciaFim = janela[janela.length - 1];
    if (!competenciaInicio || !competenciaFim) return;

    setLoadingGrafico(true);
    try {
      const dados = await nfpRelatorioRateioConsolidado({
        competencia_inicio: competenciaInicio,
        competencia_fim: competenciaFim,
        agente: agenteGrafico || undefined,
      });
      setSerieArrecadacao(dados?.por_competencia || []);
      setRankingAgentes(dados?.por_agente || []);
      setTotaisSerie(dados?.totais || {});
    } catch {
      setSerieArrecadacao([]);
      setRankingAgentes([]);
      setTotaisSerie({});
    } finally {
      setLoadingGrafico(false);
    }
  }, [agenteGrafico, competencias, mesesGrafico]);

  useEffect(() => {
    if (aba !== 'dashboard') return undefined;
    carregarGrafico();
    return undefined;
  }, [aba, carregarGrafico]);

  async function comFeedback(acao, mensagemOk, { resumoTipo } = {}) {
    setTrabalhando(true);
    setErro('');
    setSucesso('');
    try {
      const resultado = await acao();
      const texto = typeof mensagemOk === 'function' ? mensagemOk(resultado) : mensagemOk;
      setSucesso(() => texto);
      if (resumoTipo) {
        const resumoModal = montarResumoImportacao(resumoTipo, resultado);
        if (resumoModal) setResumoImportacao(resumoModal);
      }
      const compAtual = resultado?.competencia || competencia || undefined;
      await carregarDashboard(compAtual, agente);
      await carregarListas();
      await carregarGrafico();
      return resultado;
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha na operação NFP.'));
      return null;
    } finally {
      setTrabalhando(false);
    }
  }

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Créditos"
          title="Dashboard"
          subtitle="Nota Fiscal Paulista: créditos SEFAZ, doadores diretos e rateio."
          icon={<Receipt className="h-5 w-5" />}
          actions={(
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={agente}
                onChange={(e) => {
                  const novo = e.target.value;
                  setAgente(novo);
                  setAgenteGrafico(novo);
                  carregarDashboard(competencia || undefined, novo);
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                title="Agente de captação"
              >
                <option value="">Todos</option>
                {agentes.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <span className="hidden sm:inline font-semibold">Competência</span>
                <input
                  type="month"
                  value={competencia}
                  onChange={(e) => {
                    const nova = e.target.value;
                    setCompetencia(nova);
                    if (nova) carregarDashboard(nova, agente);
                  }}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  title="Competência (mês/ano)"
                />
              </label>
              <PremiumButton
                type="button"
                variant="secondary"
                disabled={trabalhando}
                onClick={() => carregarDashboard(competencia || undefined, agente)}
              >
                Atualizar
              </PremiumButton>
            </div>
          )}
        />

        {somenteLeitura && (
          <BannerSomenteLeituraGlobal modulo="o dashboard e os créditos NFP" />
        )}

        <ScrollArea>
          {erro && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}
          {sucesso && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {sucesso}
            </div>
          )}

          <div className="mb-5 flex flex-wrap gap-2">
            {abasVisiveis.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAba(item.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  aba === item.id
                    ? 'border-slate-800 bg-slate-800 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {aba === 'dashboard' && (
            <section className="space-y-4">
              {loading ? (
                <div className="py-10 text-center text-sm text-slate-500">Carregando...</div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Link
                      to="/nfp/cadastro/agentes"
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
                    >
                      <UserRoundCog className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">Agentes captadores</p>
                        <p className="text-xs text-slate-500">Cadastro e percentual de rateio</p>
                      </div>
                    </Link>
                    <Link
                      to="/nfp/cadastro/doadores"
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
                    >
                      <Users className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">Doadores</p>
                        <p className="text-xs text-slate-500">Cadastro de doadores automáticos</p>
                      </div>
                    </Link>
                    <Link
                      to="/nfp/cadastro/cnpjs"
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
                    >
                      <Building2 className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">CNPJs / CPFs Captados por Agentes</p>
                        <p className="text-xs text-slate-500">Estabelecimentos e CPFs por captador</p>
                      </div>
                    </Link>
                    <Link
                      to="/nfp/relatorios"
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400"
                    >
                      <Receipt className="h-5 w-5 text-slate-600" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">Relatórios</p>
                        <p className="text-xs text-slate-500">Consolidados e analíticos NFP</p>
                      </div>
                    </Link>
                  </div>

                  <NfpTermometroArrecadacao
                    serie={serieArrecadacao}
                    ranking={rankingAgentes}
                    totais={totaisSerie}
                    agenteFiltro={agenteGrafico}
                    onChangeAgenteFiltro={setAgenteGrafico}
                    agentes={agentes}
                    meses={mesesGrafico}
                    onChangeMeses={setMesesGrafico}
                    loading={loadingGrafico}
                  />

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Doadores diretos', resumo?.doadores],
                      ['CNPJs', resumo?.cnpjs],
                      ['CNPJs conferir', resumo?.cnpjs_conferir],
                      ['Créditos SEFAZ', resumo?.sefaz_creditos],
                      ['Doações auto', resumo?.doacoes_automaticas],
                      ['Lançamentos doadores diretos', resumo?.batimentos],
                      ['Total créditos', money(resumo?.total_creditos)],
                      ['Total AEB na competência', money(resumo?.aeb_total_competencia ?? resumo?.total_aeb)],
                    ].map(([label, valor]) => (
                      <article key={label} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{valor ?? '—'}</p>
                      </article>
                    ))}
                  </div>

                  <div className="rounded-3xl border border-teal-100 bg-teal-50/60 p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-teal-900">
                      Valores para retirada — {visaoTodos ? 'Todos os agentes' : agenteAtivo} × AEB
                    </h3>
                    <p className="mt-1 text-xs text-teal-800">
                      {visaoTodos ? (
                        <>
                          Visão consolidada de todos os agentes.
                          Use <strong>Parte agentes</strong> e <strong>Parte AEB</strong> como base de retirada deste bloco.
                          A Parte AEB já soma o rateio de cada agente + doador automático nas lojas deles.
                        </>
                      ) : (
                        <>
                          Use <strong>Parte {agenteAtivo}</strong> e <strong>Parte AEB</strong> como base de retirada deste bloco.
                          A Parte AEB já soma o rateio ({percentualAeb}%) + doador automático nas lojas do agente.
                        </>
                      )}
                    </p>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {[
                        [
                          `Bruto Lojas/CPFs`,
                          money(resumo?.bruto_lojas_cpfs_agente),
                          visaoTodos
                            ? 'Lojas + CPFs dos agentes, ainda sem separar doador AEB'
                            : 'Lojas + CPFs do agente, ainda sem separar doador AEB',
                        ],
                        [
                          'Bruto Lojas',
                          money(resumo?.bruto_lojas_somente),
                          visaoTodos
                            ? 'Só lojas (bruto, inclui doador AEB nestas lojas)'
                            : 'Só lojas (bruto, inclui doador AEB nestas lojas)',
                        ],
                        [
                          'Bruto CPF',
                          money(resumo?.bruto_cpf_agente),
                          visaoTodos
                            ? 'Só CPFs captados pelos agentes (bruto)'
                            : 'Só CPFs captados do agente (bruto)',
                        ],
                        [
                          `Doador AEB em lojas ${rotuloAgente}`,
                          money(resumo?.doador_aeb_loja_agente ?? resumo?.doador_aeb_loja_diego),
                          '100% AEB — não entra na parte do(s) agente(s)',
                        ],
                        [
                          `Parte ${rotuloAgente}`,
                          money(resumo?.parte_agente ?? resumo?.parte_agente_50 ?? resumo?.parte_diego_50 ?? resumo?.total_diego),
                          visaoTodos
                            ? 'Retirada consolidada dos agentes (conforme % de cada um)'
                            : `Retirada do agente (${percentualAgente}% do bruto de rateio)`,
                        ],
                        [
                          'Parte AEB',
                          money(resumo?.parte_aeb_consolidada_agente),
                          visaoTodos
                            ? 'Retirada AEB deste bloco (rateio AEB + doador nas lojas dos agentes)'
                            : `Retirada AEB deste bloco (${percentualAeb}% do bruto de rateio + doador)`,
                        ],
                      ].map(([label, valor, ajuda]) => (
                        <article key={label} className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{label}</p>
                          <p className="mt-2 text-2xl font-bold text-slate-900">{valor ?? '—'}</p>
                          <p className="mt-2 text-xs text-slate-500">{ajuda}</p>
                        </article>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-teal-800">
                      Direto AEB e doador automático geral (fora das lojas dos agentes) entram no card
                      {' '}
                      <strong>Total AEB na competência</strong>
                      {' '}
                      acima.
                      {' '}
                      CNPJs {visaoTodos ? 'no cadastro' : 'do agente'}: {resumo?.cnpjs_agente ?? '—'}
                      {visaoTodos ? '' : ` de ${resumo?.cnpjs ?? '—'}`}.
                    </p>
                  </div>
                </>
              )}
            </section>
          )}

          {aba === 'importacoes' && !somenteLeitura && (
            <section className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800">Importar doadores</h3>
                <CampoArquivo label="Planilha" onChange={setArquivoDoadores} />
                <PremiumButton
                  type="button"
                  disabled={trabalhando || !arquivoDoadores}
                  onClick={() => comFeedback(
                    () => nfpImportarDoadores(arquivoDoadores),
                    'Doadores importados.',
                    { resumoTipo: 'doadores' },
                  )}
                >
                  Importar
                </PremiumButton>
              </article>

              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800">Importar CNPJs (Diego / mês)</h3>
                <p className="text-xs text-slate-500">
                  A planilha define o conjunto do captador na competência do cabeçalho
                  (substitui a lista anterior daquele mês). Esse conjunto vale nos fechamentos
                  seguintes até uma nova importação.
                  {competencia ? ` Mês atual: ${competencia}.` : ' Defina a competência no cabeçalho ou importe créditos/doações antes.'}
                </p>
                <CampoArquivo label="Planilha CNPJ + LOJA" onChange={setArquivoCnpjs} />
                <PremiumButton
                  type="button"
                  disabled={trabalhando || !arquivoCnpjs || !competencia}
                  onClick={() => comFeedback(
                    () => nfpImportarCnpjs(arquivoCnpjs, agenteAtivo || 'DIEGO', competencia),
                    (r) => {
                      const base = `CNPJs: lista de ${r?.competencia || competencia} com ${r?.vinculos_competencia || 0} CNPJs (${r?.inseridos || 0} novos no cadastro).`;
                      if (!r?.competencia_anterior) return `${base} Primeira lista deste captador.`;
                      return `${base} Comparado a ${r.competencia_anterior}: ${r?.saidas || 0} saíram, ${r?.entradas || 0} entraram.`;
                    },
                    { resumoTipo: 'cnpjs' },
                  )}
                >
                  Importar
                </PremiumButton>
              </article>

              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800">Importar doações (Pedidos)</h3>
                <p className="text-xs text-slate-500">
                  Arquivo do site (CSV/XLSX). Só entra Tipo = DOACAO_AUTOMATICA. Competência = mês das notas + 4.
                </p>
                <CampoArquivo label="Planilha Pedidos" onChange={setArquivoDoacoes} />
                <PremiumButton
                  type="button"
                  disabled={trabalhando || !arquivoDoacoes}
                  onClick={() => comFeedback(
                    async () => {
                      const r = await nfpImportarDoacoes(arquivoDoacoes);
                      if (r?.competencia) setCompetencia(r.competencia);
                      return r;
                    },
                    (r) => `Doações: ${r?.inseridos || 0} (ignorados tipo: ${r?.ignorados_tipo || 0}). Competência ${r?.competencia || '—'}.`,
                    { resumoTipo: 'doacoes' },
                  )}
                >
                  Importar
                </PremiumButton>
              </article>

              <article className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-800">Importar créditos SEFAZ</h3>
                <p className="text-xs text-slate-500">
                  Selecione todos os arquivos fracionados do mês (ConsultaNFP). Competência = emissão + 4 meses.
                  Registros com status Bloqueado são excluídos automaticamente.
                </p>
                <CampoArquivo
                  label="Arquivos ConsultaNFP (vários)"
                  multiple
                  onChange={setArquivosSefaz}
                  hint={arquivosSefaz?.length ? `${arquivosSefaz.length} arquivo(s) selecionado(s)` : 'Pode selecionar vários de uma vez'}
                />
                <PremiumButton
                  type="button"
                  disabled={trabalhando || !arquivosSefaz?.length}
                  onClick={() => comFeedback(
                    async () => {
                      const r = await nfpImportarSefaz(arquivosSefaz);
                      if (r?.competencia) setCompetencia(r.competencia);
                      return r;
                    },
                    (r) => `Créditos: ${r?.inseridos || 0} importados; ${r?.ignorados_bloqueados || 0} bloqueados excluídos. Competência ${r?.competencia || '—'}.`,
                    { resumoTipo: 'sefaz' },
                  )}
                >
                  Importar
                </PremiumButton>
              </article>
            </section>
          )}

          {aba === 'rateio' && (
            <section className="space-y-4">
              <p className="text-sm text-slate-600">
                O percentual de cada agente é definido no cadastro de agentes captadores.
                Agente atual: <strong>{agenteAtivo}</strong> ({percentualAgente}%).
              </p>
              <div className="flex flex-wrap gap-2">
                {!somenteLeitura && (
                  <PremiumButton
                    type="button"
                    disabled={trabalhando || !competencia}
                    onClick={() => comFeedback(
                      () => nfpCalcularRateio(competencia),
                      'Rateio calculado.',
                    )}
                  >
                    Calcular rateio
                  </PremiumButton>
                )}
                <PremiumButton
                  type="button"
                  variant="secondary"
                  disabled={trabalhando || !competencia}
                  onClick={async () => {
                    const blob = await comFeedback(
                      () => nfpExportarRateio(competencia),
                      'Exportação gerada.',
                    );
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `nfp_rateio_${competencia}.xlsx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Exportar XLSX
                </PremiumButton>
              </div>
              <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-2">CNPJ</th>
                      <th className="px-2 py-2">Loja</th>
                      <th className="px-2 py-2">Origem</th>
                      <th className="px-2 py-2">Qtd</th>
                      <th className="px-2 py-2">Retorno</th>
                      <th className="px-2 py-2">Parte agente</th>
                      <th className="px-2 py-2">AEB</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateio.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="px-2 py-2">{formatarCNPJ(r.cnpj)}</td>
                        <td className="px-2 py-2">{r.loja}</td>
                        <td className="px-2 py-2">{r.origem}</td>
                        <td className="px-2 py-2">{r.qtd}</td>
                        <td className="px-2 py-2">{money(r.retorno)}</td>
                        <td className="px-2 py-2">{money(r.valor_diego ?? r.valor_agente)}</td>
                        <td className="px-2 py-2">{money(r.valor_aeb)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {aba === 'batimento' && (
            <section className="space-y-4">
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">Lançamentos de Doadores Diretos</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Esta lista exibe os lançamentos de doadores diretos da competência que foram
                  encontrados no cruzamento com os créditos importados do mês.
                </p>
              </div>
              <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="px-2 py-2">CPF doador</th>
                      <th className="px-2 py-2">CNPJ</th>
                      <th className="px-2 py-2">Emitente</th>
                      <th className="px-2 py-2">Nota</th>
                      <th className="px-2 py-2">Créditos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batimentos.map((b) => (
                      <tr key={b.id} className="border-t border-slate-100">
                        <td className="px-2 py-2">{formatarCPF(b.cpf_doador_cadastrador)}</td>
                        <td className="px-2 py-2">{formatarCNPJ(b.cnpj_estabelecimento)}</td>
                        <td className="px-2 py-2">{b.emitente}</td>
                        <td className="px-2 py-2">{b.numero_nota}</td>
                        <td className="px-2 py-2">{money((b.creditos_centavos || 0) / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </ScrollArea>
      </MainShell>

      {resumoImportacao ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px]"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="nfp-resumo-import-titulo"
        >
          <div className="w-full max-w-lg rounded-2xl border border-teal-100 bg-white p-5 shadow-2xl">
            <h3 id="nfp-resumo-import-titulo" className="text-lg font-semibold text-slate-900">
              {resumoImportacao.titulo}
            </h3>
            <dl className="mt-4 space-y-2">
              {resumoImportacao.linhas.map(([label, valor]) => (
                <div
                  key={label}
                  className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 text-sm last:border-0"
                >
                  <dt className="text-slate-600">{label}</dt>
                  <dd className="font-semibold text-slate-900">{valor}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 flex justify-end">
              <PremiumButton type="button" onClick={() => setResumoImportacao(null)}>
                OK
              </PremiumButton>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
