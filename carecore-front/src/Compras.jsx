import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  Landmark,
  ListChecks,
  Package,
  ShoppingCart,
  Tags,
  Truck,
} from 'lucide-react';

import ComprasCategoriasFontes from './components/ComprasCategoriasFontes';
import ComprasFornecedoresCadastro from './components/ComprasFornecedoresCadastro';
import ComprasItensConsumoCadastro from './components/ComprasItensConsumoCadastro';
import ComprasJanelaCalendario from './components/ComprasJanelaCalendario';
import ComprasEconomiaPainel from './components/ComprasEconomiaPainel';
import ComprasPatrimonioCadastro from './components/ComprasPatrimonioCadastro';
import Sidebar from './Sidebar';
import {
  AppShell,
  EmptyState,
  FilterPanel,
  MainShell,
  PageHeader,
  PremiumButton,
  PremiumBadge,
  ScrollArea,
  SectionCard,
} from './components/PremiumUI';
import {
  comprasAcesso,
  comprasAtivarModulo,
  comprasCategorias,
  comprasCriarPedido,
  comprasExcluirJanela,
  comprasFontes,
  comprasFornecedores,
  comprasItensConsumo,
  comprasJanelas,
  comprasLiberarUnidade,
  comprasPatrimonio,
  comprasPedidos,
  comprasPublicarJanelasAno,
  comprasSalvarJanela,
  comprasUnidades,
  competenciaAtual,
} from './services/comprasService';
import { usuarioEhAdmCompras, usuarioEhAdmComprasSuprimentos, usuarioEhGlobalPuro, usuarioEhManutencao, usuarioPodeCadastrarMestreCompras } from './utils/rbacUtils';
import { BOTOES_NOVO_PEDIDO, rotuloTipoPedido } from './utils/comprasPedidoTipos';
import {
  progressoOrcamentosTexto,
  rotuloStatusPedidoLista,
  varianteBadgeStatusPedido,
} from './utils/comprasPedidoStatus';

function usuarioSessao() {
  try {
    return JSON.parse(localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario') || '{}');
  } catch {
    return {};
  }
}

const COLUNAS_ORDENACAO_PEDIDOS = [
  { id: 'unidade', rotulo: 'Unidade' },
  { id: 'tipo', rotulo: 'Tipo' },
  { id: 'categoria', rotulo: 'Objeto / categoria' },
  { id: 'status', rotulo: 'Status' },
  { id: 'orcamentos', rotulo: 'Orçamentos' },
  { id: 'atualizado', rotulo: 'Atualizado' },
];

function valorOrdenacaoPedido(pedido, coluna) {
  switch (coluna) {
    case 'unidade':
      return String(pedido.instituicao_nome || pedido.instituicao_id || '').trim();
    case 'tipo':
      return String(pedido.tipo_rotulo || rotuloTipoPedido(pedido.tipo) || pedido.tipo || '').trim();
    case 'categoria':
      return String(pedido.titulo || pedido.categoria_split_nome || '').trim();
    case 'status':
      return String(rotuloStatusPedidoLista(pedido) || pedido.status || '').trim();
    case 'orcamentos': {
      if (pedido.cotacao_sede || pedido.cotacao_projeto) {
        return Number(pedido.orcamentos_com_anexo ?? 0);
      }
      return Number(pedido.qtd_orcamentos ?? 0);
    }
    case 'atualizado':
      return String(pedido.atualizado_em || '');
    default:
      return '';
  }
}

function compararPedidosOrdenacao(a, b, coluna, direcao) {
  const va = valorOrdenacaoPedido(a, coluna);
  const vb = valorOrdenacaoPedido(b, coluna);
  let cmp;
  if (coluna === 'orcamentos') {
    cmp = Number(va) - Number(vb);
  } else if (coluna === 'atualizado') {
    cmp = String(va).localeCompare(String(vb), 'pt-BR');
  } else {
    cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base', numeric: true });
  }
  if (cmp === 0) {
    cmp = String(a.id || '').localeCompare(String(b.id || ''));
  }
  return direcao === 'asc' ? cmp : -cmp;
}

function SeloFonteVerba({ pedido }) {
  if (!pedido?.fonte_custo_rotulo) return null;
  const indireto = pedido.fonte_custo_rotulo === 'Custo indireto';
  return (
    <span
      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${
        indireto ? 'bg-amber-100 text-amber-950' : 'bg-sky-100 text-sky-950'
      }`}
    >
      {pedido.fonte_custo_rotulo}
    </span>
  );
}

function SeloCaixaSuprimentos({ lida }) {
  if (lida) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        Lida
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-900">
      Não lida
    </span>
  );
}

function chaveUnidadePedido(pedido) {
  if (pedido.escopo_unidade === 'sede' && !pedido.instituicao_id) {
    return 'sede';
  }
  return String(pedido.instituicao_id || pedido.instituicao_nome || 'sem-unidade');
}

function nomeUnidadePedido(pedido) {
  if (pedido.escopo_unidade === 'sede' && !pedido.instituicao_id) {
    return 'Sede';
  }
  return pedido.instituicao_nome || pedido.instituicao_id || 'Sem unidade';
}

function resumoStatusGrupo(itens) {
  const contagem = new Map();
  for (const p of itens) {
    const rotulo = rotuloStatusPedidoLista(p) || p.status || '—';
    contagem.set(rotulo, (contagem.get(rotulo) || 0) + 1);
  }
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rotulo, qtd]) => (qtd > 1 ? `${qtd}× ${rotulo}` : rotulo))
    .slice(0, 3)
    .join(' · ');
}

function agruparPedidosPorUnidade(lista, ordem) {
  const mapa = new Map();
  for (const pedido of lista) {
    const chave = chaveUnidadePedido(pedido);
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        nome: nomeUnidadePedido(pedido),
        itens: [],
      });
    }
    mapa.get(chave).itens.push(pedido);
  }
  const grupos = [...mapa.values()].map((g) => {
    const atualizado = g.itens
      .map((p) => p.atualizado_em || '')
      .filter(Boolean)
      .sort()
      .at(-1) || '';
    const tipos = [...new Set(g.itens.map((p) => p.tipo_rotulo || rotuloTipoPedido(p.tipo) || p.tipo).filter(Boolean))];
    const orcamentos = g.itens.reduce((acc, p) => {
      if (p.cotacao_sede || p.cotacao_projeto) return acc + Number(p.orcamentos_com_anexo ?? 0);
      return acc + Number(p.qtd_orcamentos ?? 0);
    }, 0);
    return {
      ...g,
      qtd: g.itens.length,
      tiposRotulo: tipos.length <= 2 ? tipos.join(', ') : `${tipos.length} tipos`,
      statusResumo: resumoStatusGrupo(g.itens),
      orcamentos,
      atualizado,
    };
  });
  const { coluna, direcao } = ordem;
  grupos.sort((a, b) => {
    let cmp;
    if (coluna === 'unidade') {
      cmp = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    } else if (coluna === 'tipo') {
      cmp = a.tiposRotulo.localeCompare(b.tiposRotulo, 'pt-BR', { sensitivity: 'base' });
    } else if (coluna === 'status') {
      cmp = a.statusResumo.localeCompare(b.statusResumo, 'pt-BR', { sensitivity: 'base' });
    } else if (coluna === 'orcamentos') {
      cmp = a.orcamentos - b.orcamentos;
    } else if (coluna === 'atualizado') {
      cmp = String(a.atualizado).localeCompare(String(b.atualizado), 'pt-BR');
    } else {
      cmp = a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    }
    if (cmp === 0) cmp = a.chave.localeCompare(b.chave);
    return direcao === 'asc' ? cmp : -cmp;
  });
  return grupos;
}

const CHAVE_VISTA_COMPRAS = '@CareCore:compras-vista';

/** Sobrevive ao Voltar: a lista volta na hora e a API atualiza por trás. */
const cacheListaCompras = { chave: '' };

function chaveListaCompras(usuarioId, competencia, statusGrupo) {
  return `${usuarioId || ''}|${competencia || ''}|${statusGrupo}`;
}

function lerVistaCompras(visaoConcluidos) {
  try {
    const data = JSON.parse(sessionStorage.getItem(CHAVE_VISTA_COMPRAS) || 'null');
    if (!data || Boolean(data.visaoConcluidos) !== Boolean(visaoConcluidos)) return null;
    return data;
  } catch {
    return null;
  }
}

export default function Compras() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const visaoConcluidos = (searchParams.get('visao') || '').trim().toLowerCase() === 'concluidos';
  const usuario = useMemo(() => usuarioSessao(), []);
  const sede = usuarioEhAdmCompras(usuario) || usuarioEhManutencao(usuario);
  const caixaSuprimentos = visaoConcluidos && usuarioEhAdmComprasSuprimentos(usuario);
  const consultaGlobal = usuarioEhGlobalPuro(usuario);
  const visaoOrganizacao = sede || consultaGlobal;
  const podeCadastrarMestre = usuarioPodeCadastrarMestreCompras(usuario);
  const vistaInicial = useMemo(() => lerVistaCompras(visaoConcluidos), [visaoConcluidos]);
  const competenciaInicial = typeof vistaInicial?.competencia === 'string'
    ? vistaInicial.competencia
    : (visaoConcluidos ? competenciaAtual() : '');
  const statusGrupoPedidos = visaoConcluidos ? 'terminais' : 'abertos';
  const cacheVista = cacheListaCompras.chave === chaveListaCompras(
    usuario?.id,
    competenciaInicial,
    statusGrupoPedidos,
  )
    ? cacheListaCompras
    : null;
  const [aba, setAba] = useState(() => vistaInicial?.aba || 'pedidos');
  const [abaCadastro, setAbaCadastro] = useState('fornecedores');
  const [acesso, setAcesso] = useState(() => cacheVista?.acesso || null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(!cacheVista);
  const [pedidos, setPedidos] = useState(() => cacheVista?.pedidos || []);
  const [janelas, setJanelas] = useState(() => cacheVista?.janelas || []);
  const [hojeOperacional, setHojeOperacional] = useState(() => {
    if (cacheVista?.hoje) return cacheVista.hoje;
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  });
  const [unidades, setUnidades] = useState(() => cacheVista?.unidades || []);
  const [categorias, setCategorias] = useState(() => cacheVista?.categorias || []);
  const [fontes, setFontes] = useState(() => cacheVista?.fontes || []);
  const [fornecedores, setFornecedores] = useState(() => cacheVista?.fornecedores || []);
  const [itensConsumo, setItensConsumo] = useState(() => cacheVista?.itensConsumo || []);
  const [patrimonio, setPatrimonio] = useState(() => cacheVista?.patrimonio || []);
  const [competencia, setCompetencia] = useState(competenciaInicial);
  const [salvandoJanela, setSalvandoJanela] = useState(false);
  const [ordemPedidos, setOrdemPedidos] = useState(() => {
    const salva = vistaInicial?.ordemPedidos;
    if (!salva || salva.coluna === 'grupo' || salva.coluna === 'envio') {
      return { coluna: 'atualizado', direcao: 'desc' };
    }
    return salva;
  });
  const [agruparPorUnidade, setAgruparPorUnidade] = useState(
    () => (typeof vistaInicial?.agruparPorUnidade === 'boolean' ? vistaInicial.agruparPorUnidade : !visaoConcluidos),
  );
  const [unidadeExpandida, setUnidadeExpandida] = useState(() => vistaInicial?.unidadeExpandida || null);
  const [visaoCalendario, setVisaoCalendario] = useState(() => vistaInicial?.calendario || null);

  const visaoAnterior = useRef(visaoConcluidos);
  const cargaSeq = useRef(0);
  useEffect(() => {
    if (visaoAnterior.current === visaoConcluidos) return;
    visaoAnterior.current = visaoConcluidos;
    setCompetencia(visaoConcluidos ? competenciaAtual() : '');
    setAgruparPorUnidade(!visaoConcluidos);
    setUnidadeExpandida(null);
    setAba('pedidos');
  }, [visaoConcluidos]);

  useEffect(() => {
    sessionStorage.setItem(CHAVE_VISTA_COMPRAS, JSON.stringify({
      visaoConcluidos,
      competencia,
      aba,
      ordemPedidos,
      agruparPorUnidade,
      unidadeExpandida,
      calendario: visaoCalendario,
    }));
  }, [visaoConcluidos, competencia, aba, ordemPedidos, agruparPorUnidade, unidadeExpandida, visaoCalendario]);

  const pedidosOrdenados = useMemo(() => {
    const lista = [...(pedidos || [])];
    const { coluna, direcao } = ordemPedidos;
    lista.sort((a, b) => {
      if (caixaSuprimentos) {
        const la = a.suprimentos_lida ? 1 : 0;
        const lb = b.suprimentos_lida ? 1 : 0;
        if (la !== lb) return la - lb;
      }
      return compararPedidosOrdenacao(a, b, coluna, direcao);
    });
    return lista;
  }, [pedidos, ordemPedidos, caixaSuprimentos]);

  const gruposPorUnidade = useMemo(() => {
    if (!agruparPorUnidade) return [];
    return agruparPedidosPorUnidade(pedidosOrdenados, ordemPedidos);
  }, [agruparPorUnidade, pedidosOrdenados, ordemPedidos]);

  const alternarOrdenacao = (coluna) => {
    setOrdemPedidos((atual) => {
      if (atual.coluna === coluna) {
        return { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
      }
      const padraoDesc = coluna === 'atualizado' || coluna === 'envio' || coluna === 'orcamentos';
      return { coluna, direcao: padraoDesc ? 'desc' : 'asc' };
    });
  };

  const alternarAgrupamento = () => {
    setAgruparPorUnidade((atual) => {
      const proximo = !atual;
      if (!proximo) setUnidadeExpandida(null);
      return proximo;
    });
  };

  const alternarExpansaoUnidade = (chave) => {
    setUnidadeExpandida((atual) => (atual === chave ? null : chave));
  };

  const carregar = useCallback(async () => {
    const seq = cargaSeq.current + 1;
    cargaSeq.current = seq;
    const chave = chaveListaCompras(usuario?.id, competencia, statusGrupoPedidos);
    const temCache = cacheListaCompras.chave === chave;
    setErro('');
    if (!temCache) setCarregando(true);
    try {
      const acc = await comprasAcesso();
      if (seq !== cargaSeq.current) return;
      setAcesso(acc);
      if (!acc?.compras_ativo) {
        setPedidos([]);
        setJanelas([]);
        setUnidades([]);
        setCategorias([]);
        setFontes([]);
        setFornecedores([]);
        setItensConsumo([]);
        setPatrimonio([]);
        cacheListaCompras.chave = '';
        return;
      }
      const [lista, cats, fonts, catalogo, janelasResp, pacoteSede, patrimonioProjeto, pacoteMestre] = await Promise.all([
        comprasPedidos({ competencia, status_grupo: statusGrupoPedidos }),
        comprasCategorias(),
        comprasFontes(),
        comprasItensConsumo(),
        comprasJanelas(),
        visaoOrganizacao
          ? Promise.all([
            comprasUnidades(),
            comprasFornecedores(),
            comprasPatrimonio(),
          ])
          : null,
        visaoOrganizacao ? null : comprasPatrimonio(),
        !visaoOrganizacao && podeCadastrarMestre
          ? Promise.all([comprasFornecedores(), comprasUnidades()])
          : null,
      ]);
      if (seq !== cargaSeq.current) return;
      const hoje = janelasResp.hoje || '';
      const janelasItens = janelasResp.itens;
      const unidadesNovas = pacoteSede?.[0] || pacoteMestre?.[1] || [];
      const fornecedoresNovos = pacoteSede?.[1] || pacoteMestre?.[0] || [];
      const patrimonioNovo = pacoteSede?.[2] || patrimonioProjeto || [];
      setPedidos(lista);
      setCategorias(cats);
      setFontes(fonts);
      setItensConsumo(catalogo);
      setHojeOperacional(hoje);
      setJanelas(janelasItens);
      setUnidades(unidadesNovas);
      setFornecedores(fornecedoresNovos);
      setPatrimonio(patrimonioNovo);
      Object.assign(cacheListaCompras, {
        chave,
        acesso: acc,
        pedidos: lista,
        categorias: cats,
        fontes: fonts,
        itensConsumo: catalogo,
        hoje,
        janelas: janelasItens,
        unidades: unidadesNovas,
        fornecedores: fornecedoresNovos,
        patrimonio: patrimonioNovo,
      });
    } catch (err) {
      if (seq !== cargaSeq.current) return;
      setErro(err.response?.data?.detail || err.message || 'Não foi possível carregar Compras.');
    } finally {
      if (seq === cargaSeq.current) setCarregando(false);
    }
  }, [competencia, podeCadastrarMestre, statusGrupoPedidos, usuario?.id, visaoOrganizacao]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Ao abrir o catálogo, recarrega os itens (evita lista antiga/curta na sessão).
  useEffect(() => {
    const vendoItens = aba === 'itens' || (aba === 'cadastros' && abaCadastro === 'itens');
    if (!vendoItens || !acesso?.compras_ativo) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const catalogo = await comprasItensConsumo();
        if (!cancelado) setItensConsumo(catalogo);
      } catch {
        /* carregar() já cobre o erro principal */
      }
    })();
    return () => { cancelado = true; };
  }, [aba, abaCadastro, acesso?.compras_ativo]);

  useEffect(() => {
    const abaParam = (searchParams.get('aba') || '').trim().toLowerCase();
    const visaoParam = (searchParams.get('visao') || '').trim().toLowerCase();
    if (abaParam === 'fornecedores' || abaParam === 'itens' || abaParam === 'categorias') {
      if (sede || consultaGlobal) {
        setAba('cadastros');
        setAbaCadastro(abaParam === 'categorias' ? 'categorias' : abaParam);
      } else if (podeCadastrarMestre) {
        setAba(abaParam);
      }
    } else if (abaParam === 'economia') {
      setAba('economia');
    } else if (visaoParam === 'concluidos') {
      setAba('pedidos');
    }
  }, [consultaGlobal, podeCadastrarMestre, searchParams, sede]);

  const abas = [
    { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
    { id: 'janela', label: 'Janela mensal', icon: CalendarRange },
    ...(podeCadastrarMestre && !visaoOrganizacao
      ? [
        { id: 'fornecedores', label: 'Fornecedores', icon: Truck },
        { id: 'itens', label: 'Catálogo de itens', icon: ListChecks },
        { id: 'categorias', label: 'Categorias', icon: Tags },
      ]
      : []),
    ...(visaoOrganizacao ? [{ id: 'cadastros', label: 'Cadastros', icon: Truck }] : []),
    { id: 'patrimonio', label: 'Patrimônio', icon: Package },
    { id: 'economia', label: 'Economia', icon: Landmark },
  ];

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Organização"
          title={visaoConcluidos ? 'Pedidos concluídos' : 'Compras'}
          subtitle={
            visaoConcluidos
              ? 'Pedidos encerrados, cancelados ou reprovados — histórico separado dos pedidos em andamento.'
              : 'Solicitação, cotação, dupla aprovação, pedido ao fornecedor e conferência na unidade.'
          }
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <ScrollArea>
          <div className="space-y-4 p-4 md:p-6">
            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
            )}

            {acesso && !acesso.compras_ativo && (acesso.pode_ativar || sede) && (
              <SectionCard title="Módulo inativo nesta organização">
                <p className="text-sm text-slate-600">
                  O ADM Compras precisa ativar o módulo uma vez para esta organização. Não depende das flags SIAT do projeto.
                </p>
                <PremiumButton
                  className="mt-3"
                  onClick={async () => {
                    setErro('');
                    try {
                      await comprasAtivarModulo(true);
                      setOk('Módulo Compras ativado.');
                      await carregar();
                    } catch (err) {
                      setErro(err.response?.data?.detail || 'Não foi possível ativar o módulo.');
                    }
                  }}
                >
                  Ativar módulo Compras
                </PremiumButton>
              </SectionCard>
            )}

            {acesso && !acesso.compras_ativo && !(acesso.pode_ativar || sede) && (
              <SectionCard title="Módulo ainda não ativado">
                <p className="text-sm text-slate-600">
                  Peça ao ADM Compras da Sede para ativar o módulo nesta organização.
                </p>
              </SectionCard>
            )}

            {acesso?.compras_ativo && (
              <>
            {!visaoConcluidos && (
            <div className="flex flex-wrap gap-2">
              {abas.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAba(item.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                    aba === item.id
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>
            )}

            {aba === 'pedidos' && (
              <>
                <FilterPanel
                  title="Filtros"
                  subtitle={
                    visaoConcluidos
                      ? 'Competência operacional (AAAA-MM) — só pedidos encerrados/cancelados/reprovados. Vazio mostra todos os períodos.'
                      : 'Por padrão, todos os pedidos em andamento, agrupados por unidade. Escolha um mês para ver só aquele período.'
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="month"
                      value={competencia}
                      onChange={(e) => setCompetencia(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      aria-label="Competência operacional"
                    />
                    {competencia ? (
                      <button
                        type="button"
                        onClick={() => setCompetencia('')}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
                      >
                        Todos os períodos
                      </button>
                    ) : (
                      <span className="text-sm text-slate-500">Todos os períodos</span>
                    )}
                  </div>
                </FilterPanel>

                {!visaoConcluidos && !consultaGlobal && (
                <SectionCard title="Novo pedido">
                  <p className="mb-3 text-sm text-slate-600">
                    Escolha o tipo — cada um abre a tela certa (consumo na janela; bem, manutenção e serviço com cotação pelo projeto).
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {BOTOES_NOVO_PEDIDO.map((botao) => (
                      <Link
                        key={botao.tipo}
                        to={`/compras/novo/${botao.tipo}`}
                        className="flex min-h-[7.5rem] flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-400 hover:shadow"
                      >
                        <span className="text-sm font-black text-slate-900">{botao.titulo}</span>
                        <span className="mt-2 text-xs font-medium leading-snug text-slate-500">{botao.descricao}</span>
                      </Link>
                    ))}
                  </div>
                </SectionCard>
                )}

                <SectionCard
                  title={visaoConcluidos ? 'Pedidos concluídos' : 'Pedidos em andamento'}
                  subtitle={
                    [
                      caixaSuprimentos
                        ? `${pedidos.filter((p) => !p.suprimentos_lida).length} não lida(s) · ${pedidos.filter((p) => p.suprimentos_lida).length} lida(s)`
                        : '',
                      agruparPorUnidade
                        ? 'Agrupado por unidade — clique na linha para expandir os pedidos daquele projeto.'
                        : '',
                    ].filter(Boolean).join(' · ') || undefined
                  }
                  actions={(
                    <PremiumButton
                      type="button"
                      variant="secondary"
                      onClick={alternarAgrupamento}
                      disabled={carregando || pedidos.length === 0}
                    >
                      {agruparPorUnidade ? 'Desagrupar' : 'Agrupar por unidade'}
                    </PremiumButton>
                  )}
                >
                  {carregando ? (
                    <p className="text-sm text-slate-500">Carregando…</p>
                  ) : pedidos.length === 0 ? (
                    <EmptyState
                      title={
                        visaoConcluidos
                          ? (competencia
                            ? 'Nenhum pedido concluído nesta competência'
                            : 'Nenhum pedido concluído')
                          : (competencia
                            ? 'Nenhum pedido em andamento nesta competência'
                            : 'Nenhum pedido em andamento')
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-slate-500">
                            {COLUNAS_ORDENACAO_PEDIDOS.map((col) => {
                              const ativo = ordemPedidos.coluna === col.id;
                              return (
                                <th key={col.id} className={col.id === 'unidade' ? 'py-2' : undefined}>
                                  <button
                                    type="button"
                                    onClick={() => alternarOrdenacao(col.id)}
                                    className={`inline-flex items-center gap-1 rounded-md px-0.5 py-0.5 font-semibold uppercase tracking-wide transition hover:text-slate-800 ${
                                      ativo ? 'text-slate-800' : 'text-slate-500'
                                    }`}
                                    title={`Ordenar por ${col.rotulo}`}
                                  >
                                    {col.rotulo}
                                    {ativo ? (
                                      ordemPedidos.direcao === 'asc' ? (
                                        <ArrowUp className="h-3.5 w-3.5 text-slate-700" aria-hidden />
                                      ) : (
                                        <ArrowDown className="h-3.5 w-3.5 text-slate-700" aria-hidden />
                                      )
                                    ) : (
                                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" aria-hidden />
                                    )}
                                  </button>
                                </th>
                              );
                            })}
                            {caixaSuprimentos ? <th className="py-2">Caixa</th> : null}
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {agruparPorUnidade
                            ? gruposPorUnidade.map((grupo) => {
                              const aberto = unidadeExpandida === grupo.chave;
                              return (
                                <Fragment key={grupo.chave}>
                                  <tr
                                    className="cursor-pointer border-t border-slate-200 bg-slate-50/80 hover:bg-slate-100/80"
                                    onClick={() => alternarExpansaoUnidade(grupo.chave)}
                                  >
                                    <td className="py-2.5">
                                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                                        {aberto ? (
                                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                                        )}
                                        {grupo.nome}
                                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-700">
                                          {grupo.qtd}
                                          {grupo.qtd === 1 ? ' pedido' : ' pedidos'}
                                        </span>
                                      </span>
                                    </td>
                                    <td className="text-slate-700">{grupo.tiposRotulo || '—'}</td>
                                    <td className="text-slate-500">—</td>
                                    <td className="text-xs font-medium text-slate-700">{grupo.statusResumo || '—'}</td>
                                    <td className="tabular-nums text-slate-700">{grupo.orcamentos}</td>
                                    <td>{grupo.atualizado || '—'}</td>
                                    {caixaSuprimentos ? (
                                      <td className="text-xs font-semibold text-sky-900">
                                        {grupo.itens.filter((p) => !p.suprimentos_lida).length
                                          ? `${grupo.itens.filter((p) => !p.suprimentos_lida).length} não lida(s)`
                                          : 'Lidas'}
                                      </td>
                                    ) : null}
                                    <td className="text-xs font-semibold text-slate-600">
                                      {aberto ? 'Recolher' : 'Expandir'}
                                    </td>
                                  </tr>
                                  {aberto
                                    ? grupo.itens.map((pedido) => (
                                      <tr
                                        key={pedido.id}
                                        className={`border-t border-slate-100 ${
                                          caixaSuprimentos && !pedido.suprimentos_lida
                                            ? 'bg-sky-50 font-semibold text-slate-900'
                                            : 'bg-white'
                                        }`}
                                      >
                                        <td className="py-2 pl-8 text-slate-600">
                                          <span className="text-xs text-slate-400">↳</span>
                                          {' '}
                                          {pedido.instituicao_nome || pedido.instituicao_id || grupo.nome}
                                        </td>
                                        <td>{pedido.tipo_rotulo || rotuloTipoPedido(pedido.tipo)}</td>
                                        <td>
                                          <span className="block">{pedido.titulo || pedido.categoria_split_nome || '—'}</span>
                                          <SeloFonteVerba pedido={pedido} />
                                        </td>
                                        <td>
                                          <PremiumBadge variant={varianteBadgeStatusPedido(pedido.status)}>
                                            {rotuloStatusPedidoLista(pedido)}
                                          </PremiumBadge>
                                        </td>
                                        <td className="tabular-nums text-slate-700">
                                          {(pedido.cotacao_sede || pedido.cotacao_projeto)
                                            ? (progressoOrcamentosTexto(pedido) || '—')
                                            : (pedido.qtd_orcamentos ?? 0)}
                                        </td>
                                        <td>{pedido.atualizado_em || '—'}</td>
                                        {caixaSuprimentos ? (
                                          <td><SeloCaixaSuprimentos lida={pedido.suprimentos_lida} /></td>
                                        ) : null}
                                        <td>
                                          <Link
                                            className="font-semibold text-slate-800 underline"
                                            to={`/compras/pedidos/${pedido.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Abrir
                                          </Link>
                                        </td>
                                      </tr>
                                    ))
                                    : null}
                                </Fragment>
                              );
                            })
                            : pedidosOrdenados.map((pedido) => (
                              <tr
                                key={pedido.id}
                                className={`border-t border-slate-100 ${
                                  caixaSuprimentos && !pedido.suprimentos_lida ? 'bg-sky-50 font-semibold' : ''
                                }`}
                              >
                                <td className="py-2">{pedido.instituicao_nome || pedido.instituicao_id}</td>
                                <td>{pedido.tipo_rotulo || rotuloTipoPedido(pedido.tipo)}</td>
                                <td>
                                  <span className="block">{pedido.titulo || pedido.categoria_split_nome || '—'}</span>
                                  <SeloFonteVerba pedido={pedido} />
                                </td>
                                <td>
                                  <PremiumBadge variant={varianteBadgeStatusPedido(pedido.status)}>
                                    {rotuloStatusPedidoLista(pedido)}
                                  </PremiumBadge>
                                </td>
                                <td className="tabular-nums text-slate-700">
                                  {(pedido.cotacao_sede || pedido.cotacao_projeto)
                                    ? (progressoOrcamentosTexto(pedido) || '—')
                                    : (pedido.qtd_orcamentos ?? 0)}
                                </td>
                                <td>{pedido.atualizado_em || '—'}</td>
                                {caixaSuprimentos ? (
                                  <td><SeloCaixaSuprimentos lida={pedido.suprimentos_lida} /></td>
                                ) : null}
                                <td>
                                  <Link className="font-semibold text-slate-800 underline" to={`/compras/pedidos/${pedido.id}`}>
                                    Abrir
                                  </Link>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </SectionCard>
              </>
            )}

            {aba === 'janela' && (
              <ComprasJanelaCalendario
                janelas={janelas}
                hoje={hojeOperacional}
                visaoInicial={visaoCalendario}
                onVisaoChange={setVisaoCalendario}
                pedidos={pedidos}
                unidades={unidades}
                sede={sede}
                salvando={salvandoJanela}
                onSalvarJanela={async (payload) => {
                  setSalvandoJanela(true);
                  setErro('');
                  try {
                    await comprasSalvarJanela(payload);
                    setOk('Janela publicada. Os projetos já veem o calendário.');
                    await carregar();
                  } catch (err) {
                    setErro(err.response?.data?.detail || 'Não foi possível gravar a janela.');
                    setOk('');
                  } finally {
                    setSalvandoJanela(false);
                  }
                }}
                onPublicarAno={async (ano, semana = 2) => {
                  setSalvandoJanela(true);
                  setErro('');
                  try {
                    const resultado = await comprasPublicarJanelasAno(ano, semana);
                    setOk(`Calendário de ${ano} (${resultado.semana || semana}ª semana): ${resultado.criadas} mês(es) publicados${resultado.existentes ? `, ${resultado.existentes} já existiam` : ''}.`);
                    await carregar();
                  } catch (err) {
                    setErro(err.response?.data?.detail || 'Não foi possível publicar o ano.');
                    setOk('');
                  } finally {
                    setSalvandoJanela(false);
                  }
                }}
                onLiberarUnidade={async (janelaId, payload) => {
                  setErro('');
                  try {
                    await comprasLiberarUnidade(janelaId, payload);
                    setOk('Projeto liberado fora da janela.');
                    await carregar();
                  } catch (err) {
                    setErro(err.response?.data?.detail || 'Não foi possível liberar o projeto.');
                    setOk('');
                  }
                }}
                onExcluirJanela={async (janelaId) => {
                  setSalvandoJanela(true);
                  setErro('');
                  try {
                    await comprasExcluirJanela(janelaId);
                    setOk('Janela apagada.');
                    await carregar();
                  } catch (err) {
                    setErro(err.response?.data?.detail || 'Não foi possível apagar a janela.');
                    setOk('');
                  } finally {
                    setSalvandoJanela(false);
                  }
                }}
                onCriarRascunho={consultaGlobal ? undefined : async ({ data_envio_prevista, competencia: comp }) => {
                  setErro('');
                  setOk('');
                  try {
                    const criado = await comprasCriarPedido({
                      tipo: 'consumo',
                      data_envio_prevista,
                      competencia: comp,
                      escopo_unidade: sede ? 'sede' : 'projeto',
                    });
                    setOk('Rascunho criado. Complete os itens e, se quiser, marque o envio automático.');
                    navigate(`/compras/pedidos/${criado.id}`);
                  } catch (err) {
                    setErro(err.response?.data?.detail || 'Não foi possível criar o rascunho.');
                  }
                }}
                onAbrirPedido={(id) => navigate(`/compras/pedidos/${id}`)}
              />
            )}

            {aba === 'fornecedores' && podeCadastrarMestre && !sede && (
              <ComprasFornecedoresCadastro
                fornecedores={fornecedores}
                categorias={categorias}
                sede={false}
                onRecarregar={carregar}
                onMensagem={({ ok: msgOk, erro: msgErro }) => {
                  if (msgOk) setOk(msgOk);
                  if (msgErro) setErro(msgErro);
                }}
              />
            )}

            {aba === 'itens' && podeCadastrarMestre && !sede && (
              <ComprasItensConsumoCadastro
                itens={itensConsumo}
                categorias={categorias}
                podeEditar
                abrirNovo={searchParams.get('novo') === '1'}
                sede={false}
                onRecarregar={carregar}
                onMensagem={({ ok: msgOk, erro: msgErro }) => {
                  if (msgOk) setOk(msgOk);
                  if (msgErro) setErro(msgErro);
                }}
              />
            )}

            {aba === 'categorias' && podeCadastrarMestre && !sede && (
              <ComprasCategoriasFontes
                categorias={categorias}
                fontes={fontes}
                podeEditar
                mostrarFontes={false}
                onRecarregar={carregar}
                onMensagem={({ ok: msgOk, erro: msgErro }) => {
                  if (msgOk) {
                    setOk(msgOk);
                    setErro('');
                  }
                  if (msgErro) {
                    setErro(msgErro);
                    setOk('');
                  }
                }}
              />
            )}

            {aba === 'cadastros' && visaoOrganizacao && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'fornecedores', label: 'Fornecedores' },
                    { id: 'itens', label: 'Catálogo de itens' },
                    { id: 'categorias', label: 'Categorias e fontes' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAbaCadastro(item.id)}
                      className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                        abaCadastro === item.id
                          ? 'border-slate-800 bg-slate-800 text-white'
                          : 'border-slate-200 bg-white text-slate-700'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {abaCadastro === 'fornecedores' && (
                  <ComprasFornecedoresCadastro
                    fornecedores={fornecedores}
                    categorias={categorias}
                    sede={sede || consultaGlobal}
                    podeEditar={!consultaGlobal}
                    onRecarregar={carregar}
                    onMensagem={({ ok: msgOk, erro: msgErro }) => {
                      if (msgOk) setOk(msgOk);
                      if (msgErro) setErro(msgErro);
                    }}
                  />
                )}

                {abaCadastro === 'itens' && (
                  <ComprasItensConsumoCadastro
                    itens={itensConsumo}
                    categorias={categorias}
                    podeEditar={!consultaGlobal}
                    abrirNovo={searchParams.get('novo') === '1'}
                    sede={sede || consultaGlobal}
                    onRecarregar={carregar}
                    onMensagem={({ ok: msgOk, erro: msgErro }) => {
                      if (msgOk) setOk(msgOk);
                      if (msgErro) setErro(msgErro);
                    }}
                  />
                )}

                {abaCadastro === 'categorias' && (
                  <ComprasCategoriasFontes
                    categorias={categorias}
                    fontes={fontes}
                    podeEditar={!consultaGlobal}
                    onRecarregar={carregar}
                    onMensagem={({ ok: msgOk, erro: msgErro }) => {
                      if (msgOk) {
                        setOk(msgOk);
                        setErro('');
                      }
                      if (msgErro) {
                        setErro(msgErro);
                        setOk('');
                      }
                    }}
                  />
                )}
              </div>
            )}

            {aba === 'patrimonio' && (
              <ComprasPatrimonioCadastro
                itens={patrimonio}
                unidades={unidades}
                categorias={categorias}
                sede={sede || consultaGlobal}
                podeEditar={!consultaGlobal}
                onRecarregar={carregar}
                onMensagem={({ ok: msgOk, erro: msgErro }) => {
                  if (msgOk) {
                    setOk(msgOk);
                    setErro('');
                  }
                  if (msgErro) {
                    setErro(msgErro);
                    setOk('');
                  }
                }}
              />
            )}

            {aba === 'economia' && (
              <ComprasEconomiaPainel
                visaoOrganizacao={visaoOrganizacao}
                unidades={unidades}
                nomeProjeto={usuario?.projeto_nome || ''}
              />
            )}
              </>
            )}
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
