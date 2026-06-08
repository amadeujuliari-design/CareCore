import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import HistoricoLegadoRotina from './components/historico-legado/HistoricoLegadoRotina';
import { API_ROOT } from './config/apiBase';
import { criarHeadersAutenticados } from './utils/requestIdUtils';

const LIMITE_PADRAO = 10;

const filtrosIniciais = {
  busca: '',
  nome_identificado: '',
  ano: '',
  data_inicio: '',
  data_fim: '',
  arquivo_origem: '',
  tipo_sugerido: '',
  status_revisao: '',
  operador_origem: '',
};

function formatarData(data) {
  if (!data) return '-';
  return new Date(`${data}T00:00:00`).toLocaleDateString('pt-BR');
}

function textoParaCopiar(registro) {
  return [
    `Origem da informação: ${registro.origem_informacao || 'SIAT II'}`,
    `Arquivo de origem: ${registro.arquivo_origem || '-'}`,
    `Data de origem: ${formatarData(registro.data_original)}`,
    registro.nome_identificado ? `Nome/título identificado: ${registro.nome_identificado}` : null,
    registro.operador_origem ? `Operador no sistema antigo: ${registro.operador_origem}` : null,
    '',
    registro.texto_original || '',
  ].filter((linha) => linha !== null).join('\n');
}

function dataLocalInput(data) {
  if (!data) return '';
  return String(data).slice(0, 10);
}

export default function HistoricoLegado() {
  const token = localStorage.getItem('@CareCore:token');
  const location = useLocation();
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [dados, setDados] = useState({ items: [], total: 0, resumo: {}, opcoes: {} });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [registroAberto, setRegistroAberto] = useState(null);
  const [conviventes, setConviventes] = useState([]);
  const [promocaoAberta, setPromocaoAberta] = useState(null);
  const [salvandoPromocao, setSalvandoPromocao] = useState(false);
  const [configLegado, setConfigLegado] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState(location.pathname.endsWith('/rotina') ? 'rotina' : 'ocorrencias');
  const [formPromocao, setFormPromocao] = useState({
    convivente_id: '',
    origem_informacao: 'SIAT II',
    data_origem: '',
    titulo: '',
    descricao: '',
  });

  const perfilUsuario = useMemo(() => {
    try {
      if (!token) return '';
      return JSON.parse(atob(token.split('.')[1]))?.perfil_acesso || '';
    } catch {
      return '';
    }
  }, [token]);

  const podePromoverHistorico = ['Gestor', 'Gestao', 'Gestão', 'Gerente', 'Técnico', 'Tecnico'].includes(perfilUsuario);

  const headers = useMemo(() => criarHeadersAutenticados(token), [token]);

  useEffect(() => {
    setAbaAtiva(location.pathname.endsWith('/rotina') ? 'rotina' : 'ocorrencias');
  }, [location.pathname]);

  const montarParams = useCallback((offsetAtual = offset) => {
    const params = {
      limit: LIMITE_PADRAO,
      offset: offsetAtual,
    };

    Object.entries(filtros).forEach(([chave, valor]) => {
      const limpo = String(valor || '').trim();
      if (limpo) {
        params[chave] = limpo;
      }
    });

    return params;
  }, [filtros, offset]);

  const carregarHistorico = useCallback(async (offsetAtual = offset, signal) => {
    try {
      setLoading(true);
      setErro('');

      const response = await axios.get(`${API_ROOT}/historico-legado`, {
        headers,
        params: montarParams(offsetAtual),
        signal,
      });

      setDados(response.data || { items: [], total: 0, resumo: {}, opcoes: {} });
      setOffset(offsetAtual);
    } catch (error) {
      if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') return;

      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao carregar o histórico legado.');
    } finally {
      setLoading(false);
    }
  }, [headers, montarParams, offset]);

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${API_ROOT}/historico-legado/config`, { headers, signal: controller.signal })
      .then((response) => {
        setConfigLegado(response.data || { ativo: false });
        if (response.data?.ativo) {
          carregarHistorico(0, controller.signal);
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') return;
        setConfigLegado({ ativo: false });
        setLoading(false);
        setErro('Histórico legado não está habilitado para este projeto.');
      });

    return () => controller.abort();
  }, [headers]);

  const atualizarFiltro = (campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  };

  const aplicarFiltros = () => {
    carregarHistorico(0);
  };

  const limparFiltros = () => {
    setFiltros(filtrosIniciais);
    setOffset(0);
  };

  const copiarRegistro = async (registro) => {
    try {
      await navigator.clipboard.writeText(textoParaCopiar(registro));
      setSucesso('Texto copiado para a área de transferência.');
      setTimeout(() => setSucesso(''), 2500);
    } catch (error) {
      console.error(error);
      setErro('Não foi possível copiar automaticamente. Abra o registro e selecione o texto.');
    }
  };

  const atualizarRegistro = async (registro, payload) => {
    try {
      setErro('');

      const response = await axios.patch(
        `${API_ROOT}/historico-legado/${registro.id}`,
        payload,
        { headers },
      );

      const atualizado = response.data;
      setDados((prev) => ({
        ...prev,
        items: prev.items.map((item) => item.id === atualizado.id ? atualizado : item),
      }));
      setRegistroAberto((atual) => atual?.id === atualizado.id ? atualizado : atual);
      setSucesso('Registro atualizado.');
      setTimeout(() => setSucesso(''), 2500);
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao atualizar registro.');
    }
  };

  const abrirPromocao = async (registro) => {
    if (conviventes.length === 0) {
      try {
        const response = await axios.get(`${API_ROOT}/conviventes/resumo`, { headers });
        setConviventes(response.data || []);
      } catch (error) {
        console.error('Não foi possível carregar conviventes para promoção do legado', error);
        setErro('Não foi possível carregar a lista de conviventes.');
        return;
      }
    }

    setPromocaoAberta(registro);
    setFormPromocao({
      convivente_id: '',
      origem_informacao: registro.origem_informacao || 'SIAT II',
      data_origem: dataLocalInput(registro.data_original),
      titulo: registro.nome_identificado || registro.titulo_original || '',
      descricao: textoParaCopiar(registro),
    });
  };

  const salvarPromocao = async () => {
    if (!formPromocao.convivente_id) {
      setErro('Selecione o convivente que receberá este histórico.');
      return;
    }

    if (!formPromocao.origem_informacao.trim() || !formPromocao.data_origem || !formPromocao.descricao.trim()) {
      setErro('Origem, data de origem e histórico são obrigatórios.');
      return;
    }

    try {
      setSalvandoPromocao(true);
      await axios.post(
        `${API_ROOT}/conviventes/${formPromocao.convivente_id}/historicos`,
        {
          origem_informacao: formPromocao.origem_informacao,
          data_origem: formPromocao.data_origem,
          titulo: formPromocao.titulo,
          descricao: formPromocao.descricao,
          historico_legado_id: promocaoAberta?.id || null,
        },
        { headers },
      );

      if (promocaoAberta) {
        await atualizarRegistro(promocaoAberta, { status_revisao: 'Promovido' });
      }

      setPromocaoAberta(null);
      setSucesso('Histórico inserido no convivente.');
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao inserir histórico no convivente.');
    } finally {
      setSalvandoPromocao(false);
    }
  };

  const paginaAtual = Math.floor(offset / LIMITE_PADRAO) + 1;
  const totalPaginas = Math.max(1, Math.ceil((dados.total || 0) / LIMITE_PADRAO));
  const opcoes = dados.opcoes || {};
  const resumo = dados.resumo || {};
  const paginasVisiveis = Array.from({ length: totalPaginas }, (_, index) => index + 1)
    .filter((pagina) => Math.abs(pagina - paginaAtual) <= 2 || pagina === 1 || pagina === totalPaginas);

  const irParaPagina = (pagina) => {
    const paginaSegura = Math.min(Math.max(Number(pagina) || 1, 1), totalPaginas);
    carregarHistorico((paginaSegura - 1) * LIMITE_PADRAO);
  };

  const ControlesPaginacao = () => (
    <div className="flex flex-wrap items-center gap-2">
      <PremiumButton
        type="button"
        variant="soft"
        disabled={offset === 0 || loading}
        onClick={() => irParaPagina(paginaAtual - 1)}
      >
        Anterior
      </PremiumButton>

      {paginasVisiveis.map((pagina, index) => {
        const paginaAnterior = paginasVisiveis[index - 1];
        const mostrarReticencias = paginaAnterior && pagina - paginaAnterior > 1;

        return (
          <span key={pagina} className="flex items-center gap-2">
            {mostrarReticencias && <span className="text-xs font-black text-gray-400">...</span>}
            <button
              type="button"
              onClick={() => irParaPagina(pagina)}
              disabled={loading}
              className={`rounded-xl border px-3 py-2 text-xs font-black ${
                pagina === paginaAtual
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-blue-50'
              }`}
            >
              {pagina}
            </button>
          </span>
        );
      })}

      <PremiumButton
        type="button"
        variant="soft"
        disabled={!dados.has_more || loading}
        onClick={() => irParaPagina(paginaAtual + 1)}
      >
        Próxima
      </PremiumButton>
    </div>
  );

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Validação histórica"
          title="Histórico Legado SIAT"
          subtitle="Consulta isolada dos diários importados do sistema antigo, sem misturar com ocorrências, avisos ou rotina atual."
          icon="H"
          actions={(
            <PremiumButton type="button" variant="brand" onClick={() => carregarHistorico(offset)}>
              Atualizar
            </PremiumButton>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="mx-auto w-full max-w-7xl space-y-6">
            {configLegado?.ativo === false && (
              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6 text-sm font-bold text-amber-800">
                Histórico legado não está habilitado para este projeto. Este recurso é ativado apenas para projetos que receberam importação histórica específica.
              </div>
            )}

            {configLegado?.ativo === false ? null : (
            <>
            {erro && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
                {sucesso}
              </div>
            )}

            <div className="flex flex-wrap gap-2 rounded-3xl border border-gray-100 bg-white p-2 shadow-sm">
              {[
                ['ocorrencias', 'Ocorrências/Rotina'],
                ['rotina', 'Rotina Legada'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => navigate(id === 'rotina' ? '/historico-legado/rotina' : '/historico-legado')}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                    abaAtiva === id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {abaAtiva === 'ocorrencias' ? (
            <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase text-gray-400">Registros</p>
                <p className="mt-2 text-3xl font-black text-blue-900">{resumo.total || 0}</p>
              </div>
              <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
                <p className="text-xs font-black uppercase text-amber-600">Pendentes</p>
                <p className="mt-2 text-3xl font-black text-amber-700">{resumo.pendentes || 0}</p>
              </div>
              <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
                <p className="text-xs font-black uppercase text-emerald-600">Revisados</p>
                <p className="mt-2 text-3xl font-black text-emerald-700">{resumo.revisados || 0}</p>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase text-gray-400">Anos importados</p>
                <p className="mt-2 text-3xl font-black text-slate-800">{resumo.anos || 0}</p>
              </div>
            </div>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-blue-950">Filtros de validação</h2>
                  <p className="text-sm font-semibold text-gray-500">Use qualquer combinação para conferir os dados antes da integração definitiva.</p>
                </div>
                <div className="flex gap-2">
                  <PremiumButton type="button" variant="soft" onClick={limparFiltros}>Limpar</PremiumButton>
                  <PremiumButton type="button" variant="brand" onClick={aplicarFiltros}>Filtrar</PremiumButton>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <input
                  value={filtros.busca}
                  onChange={(event) => atualizarFiltro('busca', event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && aplicarFiltros()}
                  placeholder="Busca geral no texto"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                />
                <input
                  value={filtros.nome_identificado}
                  onChange={(event) => atualizarFiltro('nome_identificado', event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && aplicarFiltros()}
                  placeholder="Nome ou título identificado"
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                />
                <select
                  value={filtros.ano}
                  onChange={(event) => atualizarFiltro('ano', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                >
                  <option value="">Todos os anos</option>
                  {(opcoes.anos || []).map((ano) => <option key={ano} value={ano}>{ano}</option>)}
                </select>
                <select
                  value={filtros.arquivo_origem}
                  onChange={(event) => atualizarFiltro('arquivo_origem', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                >
                  <option value="">Todos os arquivos</option>
                  {(opcoes.arquivos || []).map((arquivo) => <option key={arquivo} value={arquivo}>{arquivo}</option>)}
                </select>
                <input
                  type="date"
                  value={filtros.data_inicio}
                  onChange={(event) => atualizarFiltro('data_inicio', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                />
                <input
                  type="date"
                  value={filtros.data_fim}
                  onChange={(event) => atualizarFiltro('data_fim', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                />
                <select
                  value={filtros.tipo_sugerido}
                  onChange={(event) => atualizarFiltro('tipo_sugerido', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                >
                  <option value="">Todos os tipos</option>
                  {(opcoes.tipos || []).map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
                <select
                  value={filtros.status_revisao}
                  onChange={(event) => atualizarFiltro('status_revisao', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold"
                >
                  <option value="">Todos os status</option>
                  {(opcoes.status || []).map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <select
                  value={filtros.operador_origem}
                  onChange={(event) => atualizarFiltro('operador_origem', event.target.value)}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold md:col-span-2"
                >
                  <option value="">Todos os operadores SIAT</option>
                  {(opcoes.operadores || []).map((operador) => <option key={operador} value={operador}>{operador}</option>)}
                </select>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-black text-blue-950">Registros importados</h2>
                  <p className="text-sm font-semibold text-gray-500">
                    Página {paginaAtual} de {totalPaginas} · {dados.total || 0} resultado(s)
                  </p>
                </div>
                <ControlesPaginacao />
              </div>

              {loading ? (
                <div className="p-8 text-center text-sm font-bold text-blue-700">Carregando histórico legado...</div>
              ) : dados.items?.length ? (
                <div className="divide-y divide-gray-100">
                  {dados.items.map((registro) => (
                    <article key={registro.id} className="p-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                              {registro.tipo_sugerido || 'Não classificado'}
                            </span>
                            <span className="rounded-full border border-gray-100 bg-gray-50 px-3 py-1 text-xs font-black text-gray-600">
                              {registro.status_revisao || 'Pendente'}
                            </span>
                            <span className="text-xs font-bold text-gray-400">
                              {registro.arquivo_origem} · pág. {registro.pagina_origem || '-'} · {formatarData(registro.data_original)}
                            </span>
                          </div>

                          <h3 className="mt-3 text-base font-black text-blue-950">
                            {registro.nome_identificado || registro.titulo_original || 'Registro sem título identificado'}
                          </h3>
                          <p className="mt-1 text-xs font-bold text-gray-500">
                            Operador SIAT: {registro.operador_origem || '-'} · Origem: {registro.origem_informacao || 'SIAT II'}
                          </p>
                          <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm font-medium leading-relaxed text-gray-700">
                            {registro.texto_original}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <PremiumButton type="button" variant="soft" onClick={() => setRegistroAberto(registro)}>
                            Abrir
                          </PremiumButton>
                          <PremiumButton type="button" variant="soft" onClick={() => copiarRegistro(registro)}>
                            Copiar
                          </PremiumButton>
                          {podePromoverHistorico && (
                            <PremiumButton type="button" variant="soft" onClick={() => abrirPromocao(registro)}>
                              Inserir no convivente
                            </PremiumButton>
                          )}
                          <PremiumButton
                            type="button"
                            variant="brand"
                            onClick={() => atualizarRegistro(registro, { status_revisao: 'Revisado' })}
                          >
                            Revisado
                          </PremiumButton>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm font-bold text-gray-500">
                  Nenhum registro legado encontrado para os filtros atuais.
                </div>
              )}

              {!loading && dados.total > LIMITE_PADRAO && (
                <div className="flex flex-col gap-3 border-t border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs font-bold text-gray-500">
                    Exibindo {offset + 1} a {Math.min(offset + LIMITE_PADRAO, dados.total)} de {dados.total} registro(s).
                  </p>
                  <ControlesPaginacao />
                </div>
              )}
            </section>
            </>
            ) : (
              <HistoricoLegadoRotina headers={headers} />
            )}
            </>
            )}
          </div>
        </ScrollArea>

        {registroAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                <div>
                  <p className="text-xs font-black uppercase text-blue-600">Registro legado</p>
                  <h2 className="mt-1 text-xl font-black text-blue-950">
                    {registroAberto.nome_identificado || registroAberto.titulo_original || 'Sem título identificado'}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    {registroAberto.arquivo_origem} · página {registroAberto.pagina_origem || '-'} · {formatarData(registroAberto.data_original)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRegistroAberto(null)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm font-black text-gray-600"
                >
                  Fechar
                </button>
              </div>

              <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-5">
                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <select
                    value={registroAberto.status_revisao || 'Pendente'}
                    onChange={(event) => atualizarRegistro(registroAberto, { status_revisao: event.target.value })}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Revisado">Revisado</option>
                    <option value="Descartado">Descartado</option>
                    <option value="Promover depois">Promover depois</option>
                  </select>
                  <input
                    value={registroAberto.tipo_sugerido || ''}
                    onChange={(event) => setRegistroAberto((prev) => ({ ...prev, tipo_sugerido: event.target.value }))}
                    onBlur={(event) => atualizarRegistro(registroAberto, { tipo_sugerido: event.target.value })}
                    className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
                    placeholder="Tipo sugerido"
                  />
                  <PremiumButton type="button" variant="brand" onClick={() => copiarRegistro(registroAberto)}>
                    Copiar texto formatado
                  </PremiumButton>
                  {podePromoverHistorico && (
                    <PremiumButton type="button" variant="soft" onClick={() => abrirPromocao(registroAberto)}>
                      Inserir no convivente
                    </PremiumButton>
                  )}
                </div>

                <textarea
                  value={registroAberto.observacoes_revisao || ''}
                  onChange={(event) => setRegistroAberto((prev) => ({ ...prev, observacoes_revisao: event.target.value }))}
                  onBlur={(event) => atualizarRegistro(registroAberto, { observacoes_revisao: event.target.value })}
                  placeholder="Observações da validação"
                  className="mb-4 min-h-24 w-full rounded-2xl border border-gray-200 p-4 text-sm font-semibold"
                />

                <pre className="whitespace-pre-wrap rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm leading-relaxed text-gray-800">
                  {textoParaCopiar(registroAberto)}
                </pre>
              </div>
            </div>
          </div>
        )}

        {promocaoAberta && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
                <div>
                  <p className="text-xs font-black uppercase text-blue-600">Inserir no histórico do convivente</p>
                  <h2 className="mt-1 text-xl font-black text-blue-950">
                    {promocaoAberta.nome_identificado || promocaoAberta.titulo_original || 'Registro legado'}
                  </h2>
                  <p className="mt-1 text-xs font-bold text-gray-500">
                    Gestores e Técnicos podem promover registros legados para o prontuário.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPromocaoAberta(null)}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm font-black text-gray-600"
                >
                  Fechar
                </button>
              </div>

              <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-black text-gray-700">Convivente *</label>
                    <select
                      value={formPromocao.convivente_id}
                      onChange={(event) => setFormPromocao((prev) => ({ ...prev, convivente_id: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
                    >
                      <option value="">Selecione o convivente</option>
                      {conviventes
                        .slice()
                        .sort((a, b) => String(a.nome_social || a.nome_completo).localeCompare(String(b.nome_social || b.nome_completo)))
                        .map((convivente) => (
                          <option key={convivente.id} value={convivente.id}>
                            #{convivente.numero_institucional || 'S/N'} - {convivente.nome_social || convivente.nome_completo}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-black text-gray-700">Origem da informação *</label>
                    <input
                      type="text"
                      value={formPromocao.origem_informacao}
                      onChange={(event) => setFormPromocao((prev) => ({ ...prev, origem_informacao: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-black text-gray-700">Data de origem *</label>
                    <input
                      type="date"
                      value={formPromocao.data_origem}
                      onChange={(event) => setFormPromocao((prev) => ({ ...prev, data_origem: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-black text-gray-700">Título</label>
                    <input
                      type="text"
                      value={formPromocao.titulo}
                      onChange={(event) => setFormPromocao((prev) => ({ ...prev, titulo: event.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-black text-gray-700">Histórico *</label>
                    <textarea
                      value={formPromocao.descricao}
                      onChange={(event) => setFormPromocao((prev) => ({ ...prev, descricao: event.target.value }))}
                      rows="10"
                      className="w-full rounded-2xl border border-gray-200 p-4 text-sm font-semibold"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <PremiumButton type="button" variant="soft" onClick={() => setPromocaoAberta(null)}>
                    Cancelar
                  </PremiumButton>
                  <PremiumButton type="button" variant="brand" disabled={salvandoPromocao} onClick={salvarPromocao}>
                    {salvandoPromocao ? 'Salvando...' : 'Inserir histórico'}
                  </PremiumButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </MainShell>
    </AppShell>
  );
}
