import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { useAuth } from './context/AuthContext';
import api from './services/api';
import {
  atualizarAcompanhamento,
  criarAcompanhamento,
  excluirAcompanhamento,
  listarAcompanhamentos,
} from './services/acompanhamentosService';
import { STATUS_FILTRO_POR_MODULO, obterModuloPorSlug } from './config/acompanhamentosConfig';
import {
  GRUPOS_NATUREZA_ACAO,
  TIPOS_ACAO_ACOMPANHAMENTO,
  obterMetadadosTipoAcao,
} from './config/tiposAcaoAcompanhamento';
import { usuarioEhGlobalPuro } from './utils/rbacUtils';
import PotEvolucoesModal from './components/acompanhamentos/PotEvolucoesModal';
import { filtrarOrdenarConviventesPorBusca } from './utils/conviventeBuscaUtils';
import { REGISTROS_POR_PAGINA_PRONTUARIO } from './utils/prontuarioHistoricoFluxoUtils';

const BUSCA_DEBOUNCE_MS = 350;

function nomeConvivente(convivente) {
  return convivente?.nome_social || convivente?.nome_completo || 'Convivente';
}

function formatarCelula(valor, tipo) {
  if (valor == null || valor === '') return '-';
  if (tipo === 'data') {
    const partes = String(valor).slice(0, 10).split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  if (tipo === 'mes') {
    const [ano, mes] = String(valor).split('-');
    if (ano && mes) return `${mes}/${ano}`;
  }
  if (tipo === 'simnao') return valor ? 'Sim' : 'Não';
  return String(valor);
}

function valorInicialFormulario(campos) {
  const inicial = { convivente_id: '' };
  campos.forEach(campo => {
    if (campo.tipo === 'checkbox') {
      inicial[campo.nome] = false;
    } else {
      inicial[campo.nome] = '';
    }
  });
  return inicial;
}

function campoVisivel(campo, form) {
  if (!campo.visivelQuando) return true;
  return form[campo.visivelQuando.campo] === campo.visivelQuando.valor;
}

function campoObrigatorio(campo, form) {
  if (!campoVisivel(campo, form)) return false;
  if (campo.obrigatorio) return true;
  if (campo.obrigatorioQuando) {
    return form[campo.obrigatorioQuando.campo] === campo.obrigatorioQuando.valor;
  }
  return false;
}

function renderOpcoesSelect(campo) {
  if (!campo.opcoesAgrupadas) {
    return campo.opcoes.map(opcao => (
      <option key={opcao} value={opcao}>{opcao}</option>
    ));
  }

  const porNatureza = {};
  TIPOS_ACAO_ACOMPANHAMENTO.forEach(tipo => {
    if (!porNatureza[tipo.natureza]) porNatureza[tipo.natureza] = [];
    porNatureza[tipo.natureza].push(tipo.valor);
  });

  return Object.entries(GRUPOS_NATUREZA_ACAO).map(([natureza, rotulo]) => (
    <optgroup key={natureza} label={rotulo}>
      {(porNatureza[natureza] || []).map(opcao => (
        <option key={opcao} value={opcao}>{opcao}</option>
      ))}
    </optgroup>
  ));
}

function preencherFormularioEdicao(registro, campos) {
  const form = { convivente_id: registro.convivente_id || '' };
  campos.forEach(campo => {
    const valor = registro[campo.nome];
    if (campo.tipo === 'checkbox') {
      form[campo.nome] = Boolean(valor);
    } else if (valor == null) {
      form[campo.nome] = '';
    } else {
      form[campo.nome] = valor;
    }
  });
  return form;
}

export default function AcompanhamentoModulo() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const { usuario } = useAuth();
  const modulo = obterModuloPorSlug(slug);
  const somenteLeitura = usuarioEhGlobalPuro(usuario);
  const conviventePrefillProcessado = useRef(false);
  const conviventeInputRef = useRef(null);
  const sentinelRef = useRef(null);
  const carregandoMaisRef = useRef(false);
  const registrosLengthRef = useRef(0);

  const [registros, setRegistros] = useState([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filtrosExtras, setFiltrosExtras] = useState({});

  const [conviventes, setConviventes] = useState([]);
  const [carregandoConviventes, setCarregandoConviventes] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [registroEdicao, setRegistroEdicao] = useState(null);
  const [form, setForm] = useState({});
  const [buscaConvivente, setBuscaConvivente] = useState('');
  const [mostrarDropdownConvivente, setMostrarDropdownConvivente] = useState(false);
  const [evolucoesModal, setEvolucoesModal] = useState(null);

  const campos = modulo?.campos || [];
  const colunas = modulo?.colunas || [];
  const statusFiltros = STATUS_FILTRO_POR_MODULO[slug];

  const conviventesElegiveis = useMemo(() => {
    if (!statusFiltros?.length) return conviventes;
    return conviventes.filter(convivente => statusFiltros.includes(convivente.status));
  }, [conviventes, statusFiltros]);

  const conviventesFiltrados = useMemo(
    () => filtrarOrdenarConviventesPorBusca(conviventesElegiveis, buscaConvivente),
    [conviventesElegiveis, buscaConvivente],
  );

  const conviventesSugeridosLista = useMemo(
    () => filtrarOrdenarConviventesPorBusca(conviventesElegiveis, busca).slice(0, 5),
    [conviventesElegiveis, busca],
  );

  const carregarConviventes = useCallback(async () => {
    try {
      setCarregandoConviventes(true);
      const response = await api.get('/api/conviventes/resumo');
      setConviventes(response.data || []);
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar a lista de conviventes.');
    } finally {
      setCarregandoConviventes(false);
    }
  }, []);

  async function carregarDados({ append = false, offset = 0 } = {}) {
    const endpoint = obterModuloPorSlug(slug)?.endpoint;
    if (!endpoint) return;

    try {
      if (!append) setLoading(true);
      else setCarregandoMais(true);
      setErro('');

      const params = { limite: REGISTROS_POR_PAGINA_PRONTUARIO, offset };
      if (buscaDebounced.trim()) params.busca = buscaDebounced.trim();
      if (dataInicio) params.data_inicio = dataInicio;
      if (dataFim) params.data_fim = dataFim;
      Object.entries(filtrosExtras).forEach(([chave, valor]) => {
        if (valor) params[chave] = valor;
      });
      const lista = await listarAcompanhamentos(endpoint, params);

      const itens = lista.items || [];
      setRegistros(prev => (append ? [...prev, ...itens] : itens));
      setTotalRegistros(lista.total || 0);
      setTemMais(Boolean(lista.has_more));
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar os registros.');
    } finally {
      setLoading(false);
      setCarregandoMais(false);
    }
  }

  useEffect(() => {
    carregandoMaisRef.current = carregandoMais;
  }, [carregandoMais]);

  useEffect(() => {
    registrosLengthRef.current = registros.length;
  }, [registros.length]);

  useEffect(() => {
    if (!temMais || loading) return undefined;

    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || carregandoMaisRef.current) return;
        carregarDados({ append: true, offset: registrosLengthRef.current });
      },
      { root: null, rootMargin: '160px', threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [temMais, loading, slug, buscaDebounced, dataInicio, dataFim, filtrosExtras, registros.length]);

  useEffect(() => {
    const timer = setTimeout(() => setBuscaDebounced(busca), BUSCA_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [busca]);

  useEffect(() => {
    carregarConviventes();
  }, [carregarConviventes]);

  useEffect(() => {
    carregarDados();
  }, [slug, buscaDebounced, dataInicio, dataFim, filtrosExtras]);

  useEffect(() => {
    conviventePrefillProcessado.current = false;
  }, [slug]);

  useEffect(() => {
    const conviventeId = searchParams.get('convivente_id');
    if (!conviventeId || conviventePrefillProcessado.current || !modulo || conviventesElegiveis.length === 0) {
      return;
    }

    const convivente = conviventesElegiveis.find(item => item.id === conviventeId);
    if (!convivente) return;

    conviventePrefillProcessado.current = true;
    const hoje = new Date();
    const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const dataHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    const inicial = {
      ...valorInicialFormulario(campos),
      convivente_id: convivente.id,
    };
    if (modulo.slug === 'suspensoes') {
      inicial.mes_referencia = mesRef;
      inicial.data_registro = dataHoje;
    }
    setRegistroEdicao(null);
    setForm(inicial);
    setBuscaConvivente(nomeConvivente(convivente));
    setModalAberto(true);
  }, [searchParams, conviventesElegiveis, modulo, campos]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(''), 3500);
    return () => clearTimeout(timer);
  }, [sucesso]);

  const abrirNovo = async () => {
    setRegistroEdicao(null);
    setForm(valorInicialFormulario(campos));
    setBuscaConvivente('');
    setMostrarDropdownConvivente(false);
    setModalAberto(true);
    await carregarConviventes();
  };

  const abrirNovoComConvivente = async (convivente) => {
    setRegistroEdicao(null);
    setForm({ ...valorInicialFormulario(campos), convivente_id: convivente.id });
    setBuscaConvivente(nomeConvivente(convivente));
    setMostrarDropdownConvivente(false);
    setModalAberto(true);
    await carregarConviventes();
  };

  const abrirEdicao = (registro) => {
    setRegistroEdicao(registro);
    setForm(preencherFormularioEdicao(registro, campos));
    setBuscaConvivente(registro.convivente_nome || '');
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setRegistroEdicao(null);
    setBuscaConvivente('');
    setMostrarDropdownConvivente(false);
    conviventeInputRef.current?.blur();
  };

  const selecionarConviventeModal = (convivente) => {
    setForm(prev => ({ ...prev, convivente_id: convivente.id }));
    setBuscaConvivente(nomeConvivente(convivente));
    setMostrarDropdownConvivente(false);
    conviventeInputRef.current?.blur();
  };

  useEffect(() => {
    if (form.convivente_id) {
      setMostrarDropdownConvivente(false);
    }
  }, [form.convivente_id]);

  const montarPayload = () => {
    const payload = {};
    if (!registroEdicao) {
      payload.convivente_id = form.convivente_id;
    }

    campos.forEach(campo => {
      if (!campoVisivel(campo, form)) return;
      let valor = form[campo.nome];
      if (campo.tipo === 'checkbox') {
        payload[campo.nome] = Boolean(valor);
      } else if (valor === '' || valor == null) {
        payload[campo.nome] = null;
      } else {
        payload[campo.nome] = valor;
      }
    });

    return payload;
  };

  const salvar = async () => {
    if (!modulo) return;

    if (!registroEdicao && !form.convivente_id) {
      setErro('Selecione um convivente.');
      return;
    }

    for (const campo of campos) {
      if (!campoObrigatorio(campo, form)) continue;
      const valor = form[campo.nome];
      if (valor === '' || valor == null) {
        setErro(`Preencha o campo "${campo.rotulo}".`);
        return;
      }
    }

    try {
      setSalvando(true);
      setErro('');
      const payload = montarPayload();

      if (!registroEdicao && modulo.usaMetadadosTipoAcao) {
        const meta = obterMetadadosTipoAcao(form.destino);
        if (meta?.sugerir_ausencia_justificada) {
          payload.marcar_ausencia_justificada = window.confirm(
            'Deseja marcar o convivente como Ausência justificada no cadastro? '
            + 'Recomendado para contatos familiares que podem ultrapassar 24h.',
          );
        } else if (meta?.sugerir_inativar) {
          payload.inativar_convivente = window.confirm(
            'Deseja inativar o convivente no cadastro após registrar esta ação/encaminhamento/saída?',
          );
        }
      } else if (!registroEdicao && modulo.confirmarInativarAoSalvar) {
        const inativar = window.confirm(
          'Deseja inativar o convivente no cadastro após registrar esta transferência/saída?',
        );
        payload.inativar_convivente = inativar;
      }

      if (registroEdicao) {
        await atualizarAcompanhamento(modulo.endpoint, registroEdicao.id, payload);
        setSucesso('Registro atualizado com sucesso.');
      } else {
        await criarAcompanhamento(modulo.endpoint, payload);
        setSucesso('Registro criado com sucesso.');
      }

      fecharModal();
      await carregarDados();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setErro(detail.map(item => item.msg || item).join(' '));
      } else {
        setErro(detail || 'Não foi possível salvar o registro.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async (registro) => {
    if (!modulo) return;
    const confirmado = window.confirm(`Excluir o registro de ${registro.convivente_nome || 'convivente'}?`);
    if (!confirmado) return;

    try {
      setErro('');
      await excluirAcompanhamento(modulo.endpoint, registro.id);
      setSucesso('Registro excluído.');
      await carregarDados();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível excluir o registro.');
    }
  };

  if (!modulo) {
    return (
      <AppShell>
        <Sidebar />
        <MainShell>
          <PageHeader title="Acompanhamento" subtitle="Módulo não encontrado." />
        </MainShell>
      </AppShell>
    );
  }

  const IconeModulo = modulo.icone;

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          title={modulo.titulo}
          subtitle={modulo.subtitulo}
          actions={!somenteLeitura ? (
            <PremiumButton onClick={abrirNovo}>
              Novo registro
            </PremiumButton>
          ) : null}
        />

        {somenteLeitura && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Perfil Global: consulta liberada. Edição e exclusão ficam restritas a Gestor e Técnico.
          </div>
        )}

        {modulo.statusFiltros?.length > 0 && (
          <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-2 text-xs text-violet-800">
            Conviventes elegíveis neste módulo: <strong>{modulo.statusFiltros.join(', ')}</strong>.
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs text-slate-500">
            Os filtros abaixo buscam <strong>registros já cadastrados</strong> nesta lista.
            Para incluir um convivente novo, use <strong>Novo registro</strong>.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Buscar nos registros</span>
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Nome, prontuário ou CPF do convivente"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Data início</span>
              <input
                type="date"
                value={dataInicio}
                onChange={(event) => setDataInicio(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">Data fim</span>
              <input
                type="date"
                value={dataFim}
                onChange={(event) => setDataFim(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            {(modulo.filtrosExtras || []).map(filtro => (
              <label key={filtro.nome} className="text-sm">
                <span className="mb-1 block font-medium text-slate-600">{filtro.rotulo}</span>
                {filtro.tipo === 'select' ? (
                  <select
                    value={filtrosExtras[filtro.nome] || ''}
                    onChange={(event) => setFiltrosExtras(prev => ({
                      ...prev,
                      [filtro.nome]: event.target.value,
                    }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Todos</option>
                    {filtro.opcoes.map(opcao => (
                      <option key={opcao} value={opcao}>{opcao}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={filtro.tipo === 'month' ? 'month' : 'text'}
                    value={filtrosExtras[filtro.nome] || ''}
                    onChange={(event) => setFiltrosExtras(prev => ({
                      ...prev,
                      [filtro.nome]: event.target.value,
                    }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                )}
              </label>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <PremiumButton variant="secondary" onClick={() => carregarDados()}>
              Aplicar filtros
            </PremiumButton>
            <PremiumButton
              variant="secondary"
              onClick={() => {
                setBusca('');
                setBuscaDebounced('');
                setDataInicio('');
                setDataFim('');
                setFiltrosExtras({});
              }}
            >
              Limpar
            </PremiumButton>
          </div>
        </div>

        {erro && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {sucesso}
          </div>
        )}

        <ScrollArea className="mt-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <IconeModulo size={18} />
                <span>{totalRegistros} registro(s)</span>
              </div>
            </div>

            {loading ? (
              <p className="p-6 text-sm text-slate-500">Carregando...</p>
            ) : registros.length === 0 ? (
              <div className="space-y-3 p-6 text-sm text-slate-600">
                <p>
                  {buscaDebounced.trim()
                    ? 'Nenhum registro encontrado com os filtros atuais.'
                    : 'Nenhum registro cadastrado nesta lista ainda.'}
                </p>
                {!buscaDebounced.trim() && (
                  <p className="text-slate-500">
                    Use <strong>Novo registro</strong> para registrar a primeira entrada neste acompanhamento.
                  </p>
                )}
                {busca.trim() && conviventesSugeridosLista.length > 0 && (
                  <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4">
                    <p className="font-medium text-violet-900">
                      Há {conviventesSugeridosLista.length} convivente(s) no cadastro com &quot;{busca.trim()}&quot;,
                      mas ainda sem registro aqui.
                    </p>
                    <ul className="mt-2 space-y-1">
                      {conviventesSugeridosLista.map(convivente => (
                        <li key={convivente.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {nomeConvivente(convivente)}
                            {convivente.numero_institucional ? ` (#${convivente.numero_institucional})` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => abrirNovoComConvivente(convivente)}
                            className="text-violet-700 hover:underline"
                          >
                            Cadastrar registro
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      {colunas.map(coluna => (
                        <th key={coluna.chave} className="px-4 py-3 font-medium">{coluna.rotulo}</th>
                      ))}
                      {!somenteLeitura && <th className="px-4 py-3 font-medium">Ações</th>}
                      {somenteLeitura && modulo.suportaEvolucoes && (
                        <th className="px-4 py-3 font-medium">Detalhes</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map(registro => (
                      <tr key={registro.id} className="border-t border-slate-100">
                        {colunas.map(coluna => (
                          <td key={coluna.chave} className="px-4 py-3 text-slate-700">
                            {formatarCelula(registro[coluna.chave], coluna.tipo)}
                          </td>
                        ))}
                        {!somenteLeitura && (
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {modulo.suportaEvolucoes && (
                                <button
                                  type="button"
                                  onClick={() => setEvolucoesModal(registro)}
                                  className="text-indigo-600 hover:underline"
                                >
                                  Evoluções
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => abrirEdicao(registro)}
                                className="text-violet-600 hover:underline"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => confirmarExclusao(registro)}
                                className="text-rose-600 hover:underline"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        )}
                        {somenteLeitura && modulo.suportaEvolucoes && (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setEvolucoesModal(registro)}
                              className="text-indigo-600 hover:underline"
                            >
                              Ver evoluções
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {temMais && (
              <div className="border-t border-slate-100 p-4 text-center">
                <div ref={sentinelRef} className="h-1 w-full" aria-hidden="true" />
                {carregandoMais ? (
                  <p className="text-sm text-slate-500">Carregando mais registros...</p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-slate-500">
                      Role a lista ou use o botão para carregar os próximos {REGISTROS_POR_PAGINA_PRONTUARIO} registros.
                    </p>
                    <PremiumButton
                      variant="secondary"
                      disabled={carregandoMais}
                      onClick={() => carregarDados({ append: true, offset: registros.length })}
                    >
                      Carregar mais
                    </PremiumButton>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {modalAberto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
              <h2 className="text-lg font-semibold text-slate-800">
                {registroEdicao ? 'Editar registro' : 'Novo registro'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{modulo.titulo}</p>

              <div className="mt-4 grid gap-3">
                {!registroEdicao && (
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-600">Convivente *</span>
                    <div className="relative">
                      <input
                        ref={conviventeInputRef}
                        type="text"
                        required={!form.convivente_id}
                        value={buscaConvivente}
                        onChange={(event) => {
                          setBuscaConvivente(event.target.value);
                          setMostrarDropdownConvivente(true);
                          setForm(prev => ({ ...prev, convivente_id: '' }));
                        }}
                        onFocus={() => {
                          if (!form.convivente_id) {
                            setMostrarDropdownConvivente(true);
                          }
                        }}
                        onBlur={() => {
                          window.setTimeout(() => setMostrarDropdownConvivente(false), 150);
                        }}
                        placeholder="Digite nome, prontuário ou CPF para buscar..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-200"
                      />

                      {mostrarDropdownConvivente && !form.convivente_id && (
                        <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                          {carregandoConviventes && (
                            <div className="p-3 text-center text-sm text-slate-500">
                              Carregando conviventes...
                            </div>
                          )}

                          {!carregandoConviventes && conviventesFiltrados.slice(0, 15).map(convivente => (
                            <button
                              key={convivente.id}
                              type="button"
                              onPointerDown={(event) => event.preventDefault()}
                              onClick={() => selecionarConviventeModal(convivente)}
                              className="block w-full border-b border-slate-50 px-3 py-3 text-left text-sm text-slate-700 hover:bg-violet-50"
                            >
                              <span className="font-semibold">{nomeConvivente(convivente)}</span>
                              <span className="mt-0.5 block text-[10px] text-slate-500">
                                Prontuário: #{convivente.numero_institucional || 'S/N'}
                                {convivente.status ? ` · ${convivente.status}` : ''}
                              </span>
                            </button>
                          ))}

                          {!carregandoConviventes && conviventesFiltrados.length === 0 && (
                            <div className="p-3 text-center text-sm text-slate-500">
                              {buscaConvivente.trim()
                                ? 'Nenhum convivente elegível encontrado.'
                                : `Nenhum convivente com status ${modulo.statusFiltros?.join(' ou ') || 'permitido'} disponível.`}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {form.convivente_id && (
                      <p className="mt-2 text-[10px] font-semibold text-emerald-600">
                        Convivente selecionado.
                      </p>
                    )}
                  </label>
                )}

                {registroEdicao && (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    Convivente: <strong>{registroEdicao.convivente_nome}</strong>
                  </div>
                )}

                {campos.map(campo => {
                  if (!campoVisivel(campo, form)) return null;

                  return (
                    <label key={campo.nome} className="text-sm">
                      <span className="mb-1 block font-medium text-slate-600">
                        {campo.rotulo}
                        {campoObrigatorio(campo, form) ? ' *' : ''}
                      </span>

                      {campo.tipo === 'select' ? (
                        <select
                          value={form[campo.nome] || ''}
                          onChange={(event) => setForm(prev => ({ ...prev, [campo.nome]: event.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                          <option value="">Selecione</option>
                          {renderOpcoesSelect(campo)}
                        </select>
                      ) : campo.tipo === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={form[campo.nome] || ''}
                          onChange={(event) => setForm(prev => ({ ...prev, [campo.nome]: event.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      ) : campo.tipo === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(form[campo.nome])}
                          onChange={(event) => setForm(prev => ({ ...prev, [campo.nome]: event.target.checked }))}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      ) : (
                        <input
                          type={campo.tipo === 'month' ? 'month' : campo.tipo === 'data' ? 'date' : 'text'}
                          value={form[campo.nome] || ''}
                          onChange={(event) => setForm(prev => ({ ...prev, [campo.nome]: event.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <PremiumButton variant="secondary" onClick={fecharModal}>
                  {somenteLeitura ? 'Fechar' : 'Cancelar'}
                </PremiumButton>
                {!somenteLeitura && (
                  <PremiumButton onClick={salvar} disabled={salvando}>
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </PremiumButton>
                )}
              </div>
            </div>
          </div>
        )}
      </MainShell>

      {evolucoesModal && modulo.modalEvolucoes === 'pot' && (
        <PotEvolucoesModal
          registro={evolucoesModal}
          somenteLeitura={somenteLeitura}
          onFechar={() => setEvolucoesModal(null)}
          onAtualizado={carregarDados}
        />
      )}

      {evolucoesModal && modulo.modalEvolucoes !== 'pot' && (
        <DiscussaoEvolucoesModal
          registro={evolucoesModal}
          somenteLeitura={somenteLeitura}
          onFechar={() => setEvolucoesModal(null)}
          onAtualizado={carregarDados}
        />
      )}
    </AppShell>
  );
}
