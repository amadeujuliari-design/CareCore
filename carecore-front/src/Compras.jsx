import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarRange, Landmark, ListChecks, Package, ShoppingCart, Tags, Truck } from 'lucide-react';

import ComprasCategoriasFontes from './components/ComprasCategoriasFontes';
import ComprasFornecedoresCadastro from './components/ComprasFornecedoresCadastro';
import ComprasItensConsumoCadastro from './components/ComprasItensConsumoCadastro';
import ComprasJanelaCalendario from './components/ComprasJanelaCalendario';
import ComprasPatrimonioCadastro from './components/ComprasPatrimonioCadastro';
import Sidebar from './Sidebar';
import {
  AppShell,
  EmptyState,
  FilterPanel,
  MainShell,
  PageHeader,
  PremiumButton,
  ScrollArea,
  SectionCard,
} from './components/PremiumUI';
import {
  comprasAcesso,
  comprasAtivarModulo,
  comprasCategorias,
  comprasCriarPedido,
  comprasEconomia,
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
  moneyCentavos,
} from './services/comprasService';
import { usuarioEhAdmCompras, usuarioEhAdmPedidos, usuarioEhManutencao } from './utils/rbacUtils';
import { BOTOES_NOVO_PEDIDO, rotuloTipoPedido } from './utils/comprasPedidoTipos';

const STATUS_LABEL = {
  rascunho: 'Rascunho',
  aguardando_cotacao: 'Aguardando cotação',
  em_cotacao: 'Em cotação',
  aguardando_aprovacao_unidade: 'Aguardando unidade',
  aguardando_aprovacao_sede: 'Aguardando Sede',
  aprovado: 'Aprovado',
  enviado_fornecedor: 'Enviado ao fornecedor',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
};

function usuarioSessao() {
  try {
    return JSON.parse(localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario') || '{}');
  } catch {
    return {};
  }
}

export default function Compras() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const usuario = useMemo(() => usuarioSessao(), []);
  const sede = usuarioEhAdmCompras(usuario) || usuarioEhManutencao(usuario);
  const admPedidos = usuarioEhAdmPedidos(usuario);
  const podeCadastrarMestre = sede || admPedidos;
  const [aba, setAba] = useState('pedidos');
  const [abaCadastro, setAbaCadastro] = useState('fornecedores');
  const [acesso, setAcesso] = useState(null);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [janelas, setJanelas] = useState([]);
  const [hojeOperacional, setHojeOperacional] = useState(() => {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  });
  const [unidades, setUnidades] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [fontes, setFontes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [itensConsumo, setItensConsumo] = useState([]);
  const [patrimonio, setPatrimonio] = useState([]);
  const [economia, setEconomia] = useState(null);
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [salvandoJanela, setSalvandoJanela] = useState(false);

  const carregar = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const acc = await comprasAcesso();
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
        setEconomia(null);
        setCarregando(false);
        return;
      }
      const [lista, cats, fonts, catalogo] = await Promise.all([
        comprasPedidos({ competencia }),
        comprasCategorias(),
        comprasFontes(),
        comprasItensConsumo(),
      ]);
      setPedidos(lista);
      setCategorias(cats);
      setFontes(fonts);
      setItensConsumo(catalogo);
      const janelasResp = await comprasJanelas();
      setHojeOperacional(janelasResp.hoje || '');
      setJanelas(janelasResp.itens);
      if (sede) {
        const [u, f, p, e] = await Promise.all([
          comprasUnidades(),
          comprasFornecedores(),
          comprasPatrimonio(),
          comprasEconomia(competencia),
        ]);
        setUnidades(u);
        setFornecedores(f);
        setPatrimonio(p);
        setEconomia(e);
      } else {
        setPatrimonio(await comprasPatrimonio());
        if (podeCadastrarMestre) {
          const [f, u] = await Promise.all([comprasFornecedores(), comprasUnidades()]);
          setFornecedores(f);
          setUnidades(u);
        }
      }
    } catch (err) {
      setErro(err.response?.data?.detail || err.message || 'Não foi possível carregar Compras.');
    } finally {
      setCarregando(false);
    }
  }, [competencia, podeCadastrarMestre, sede]);

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
    if (abaParam === 'fornecedores' || abaParam === 'itens' || abaParam === 'categorias') {
      if (sede) {
        setAba('cadastros');
        setAbaCadastro(abaParam === 'categorias' ? 'categorias' : abaParam);
      } else if (podeCadastrarMestre) {
        setAba(abaParam);
      }
    }
  }, [podeCadastrarMestre, searchParams, sede]);

  const abas = [
    { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
    { id: 'janela', label: 'Janela mensal', icon: CalendarRange },
    ...(podeCadastrarMestre && !sede
      ? [
        { id: 'fornecedores', label: 'Fornecedores', icon: Truck },
        { id: 'itens', label: 'Catálogo de itens', icon: ListChecks },
        { id: 'categorias', label: 'Categorias', icon: Tags },
      ]
      : []),
    ...(sede ? [{ id: 'cadastros', label: 'Cadastros', icon: Truck }] : []),
    { id: 'patrimonio', label: 'Patrimônio', icon: Package },
    ...(sede ? [{ id: 'economia', label: 'Economia', icon: Landmark }] : []),
  ];

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Organização"
          title="Compras"
          subtitle="Solicitação, cotação, dupla aprovação, pedido ao fornecedor e conferência na unidade."
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

            {aba === 'pedidos' && (
              <>
                <FilterPanel title="Filtros" subtitle="Competência operacional (AAAA-MM)">
                  <input
                    type="month"
                    value={competencia}
                    onChange={(e) => setCompetencia(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </FilterPanel>

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

                <SectionCard title="Pedidos">
                  {carregando ? (
                    <p className="text-sm text-slate-500">Carregando…</p>
                  ) : pedidos.length === 0 ? (
                    <EmptyState title="Nenhum pedido nesta competência" />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-slate-500">
                            <th className="py-2">Unidade</th>
                            <th>Tipo</th>
                            <th>Grupo</th>
                            <th>Objeto / categoria</th>
                            <th>Envio previsto</th>
                            <th>Status</th>
                            {!sede ? <th>Orçamentos</th> : null}
                            <th>Atualizado</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {pedidos.map((pedido) => (
                            <tr key={pedido.id} className="border-t border-slate-100">
                              <td className="py-2">{pedido.instituicao_nome || pedido.instituicao_id}</td>
                              <td>{pedido.tipo_rotulo || rotuloTipoPedido(pedido.tipo)}</td>
                              <td className="whitespace-nowrap font-semibold tabular-nums text-slate-800">
                                {pedido.grupo_codigo || '—'}
                              </td>
                              <td>{pedido.titulo || pedido.categoria_split_nome || '—'}</td>
                              <td>
                                {pedido.data_envio_prevista
                                  ? `${pedido.data_envio_prevista.slice(8, 10)}/${pedido.data_envio_prevista.slice(5, 7)}`
                                  : '—'}
                                {pedido.envio_automatico ? ' · auto' : ''}
                              </td>
                              <td>{STATUS_LABEL[pedido.status] || pedido.status}</td>
                              {!sede ? <td>{pedido.qtd_orcamentos ?? 0}</td> : null}
                              <td>{pedido.atualizado_em || '—'}</td>
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
                onCriarRascunho={async ({ data_envio_prevista, competencia: comp }) => {
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

            {aba === 'cadastros' && sede && (
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
                    sede={sede}
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
                    podeEditar
                    sede={sede}
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
                    podeEditar
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
                sede={sede}
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

            {aba === 'economia' && sede && economia && (
              <SectionCard title="Economia das cotações">
                <p className="text-sm">
                  Pedidos: {economia.pedidos} · Escolhidas: {moneyCentavos(economia.total_escolhida_centavos)}
                  · vs maior: {moneyCentavos(economia.economia_vs_maior_centavos)}
                  · vs média: {moneyCentavos(economia.economia_vs_media_centavos)}
                </p>
                {Array.isArray(economia.linhas) && economia.linhas.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase text-slate-500">
                          <th className="py-2">Unidade / Sede</th>
                          <th>Competência</th>
                          <th>Tipo</th>
                          <th>Valor escolhida</th>
                        </tr>
                      </thead>
                      <tbody>
                        {economia.linhas.map((linha) => (
                          <tr key={linha.pedido_id} className="border-t border-slate-100">
                            <td className="py-2">{linha.instituicao_nome}</td>
                            <td>{linha.competencia}</td>
                            <td>{linha.tipo}</td>
                            <td>{moneyCentavos(linha.valor_escolhida_centavos)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            )}
              </>
            )}
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
