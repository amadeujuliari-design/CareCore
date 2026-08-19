import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarRange, Landmark, Package, ShoppingCart, Truck } from 'lucide-react';

import ComprasCategoriasFontes from './components/ComprasCategoriasFontes';
import ComprasFornecedoresCadastro from './components/ComprasFornecedoresCadastro';
import ComprasItemTypeahead from './components/ComprasItemTypeahead';
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
import { usuarioEhAdmCompras, usuarioEhManutencao } from './utils/rbacUtils';
import { unidadeParaPedido } from './utils/comprasItensConsumoUtils';

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

function pedidoNovoVazio(sede) {
  return {
    tipo: 'consumo',
    descricao: '',
    quantidade: '1',
    unidade_medida: '',
    embalagem: '',
    marca_preferencial: '',
    categoria_id: '',
    catalogo_item_id: '',
    destino: sede ? 'sede' : 'projeto',
    instituicao_id: '',
  };
}

export default function Compras() {
  const navigate = useNavigate();
  const usuario = useMemo(() => usuarioSessao(), []);
  const sede = usuarioEhAdmCompras(usuario) || usuarioEhManutencao(usuario);
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
  const [novo, setNovo] = useState(() => pedidoNovoVazio(sede));
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
      }
    } catch (err) {
      setErro(err.response?.data?.detail || err.message || 'Não foi possível carregar Compras.');
    } finally {
      setCarregando(false);
    }
  }, [competencia, sede]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const criarPedido = async (e) => {
    e.preventDefault();
    setErro('');
    setOk('');
    try {
      const escopoUnidade = sede && novo.destino === 'sede' ? 'sede' : 'projeto';
      const instituicaoId = escopoUnidade === 'projeto'
        ? (sede ? (novo.instituicao_id || null) : null)
        : null;
      if (sede && escopoUnidade === 'projeto' && !instituicaoId) {
        setErro('Selecione a unidade do pedido ou escolha Sede (matriz).');
        return;
      }
      const criado = await comprasCriarPedido({
        tipo: novo.tipo,
        competencia,
        escopo_unidade: escopoUnidade,
        instituicao_id: instituicaoId,
        itens: novo.descricao.trim()
          ? [{
            descricao: novo.descricao.trim(),
            quantidade: Number(novo.quantidade || 1),
            unidade_medida: novo.unidade_medida || null,
            embalagem: (novo.embalagem || '').trim() || null,
            marca_preferencial: novo.marca_preferencial || null,
            categoria_id: novo.categoria_id || null,
            catalogo_item_id: novo.catalogo_item_id || null,
          }]
          : [],
      });
      setOk('Pedido criado. Complete os itens e envie.');
      setNovo(pedidoNovoVazio(sede));
      navigate(`/compras/pedidos/${criado.id}`);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Não foi possível criar o pedido.');
    }
  };

  const abas = [
    { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart },
    { id: 'janela', label: 'Janela mensal', icon: CalendarRange },
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
                  <form onSubmit={criarPedido} className="grid gap-3 md:grid-cols-8">
                    {sede && (
                      <>
                        <label className="md:col-span-4">
                          <span className="mb-1 block text-xs font-semibold text-slate-600">Destino</span>
                          <select
                            value={novo.destino}
                            onChange={(e) => setNovo((atual) => ({
                              ...atual,
                              destino: e.target.value,
                              instituicao_id: e.target.value === 'sede' ? '' : atual.instituicao_id,
                            }))}
                            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          >
                            <option value="sede">Sede (matriz / organização)</option>
                            <option value="projeto">Unidade / projeto</option>
                          </select>
                        </label>
                        {novo.destino === 'projeto' && (
                          <label className="md:col-span-4">
                            <span className="mb-1 block text-xs font-semibold text-slate-600">Unidade</span>
                            <select
                              value={novo.instituicao_id}
                              onChange={(e) => setNovo((atual) => ({ ...atual, instituicao_id: e.target.value }))}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              required
                            >
                              <option value="">Selecione a unidade…</option>
                              {unidades.map((u) => (
                                <option key={u.id} value={u.id}>{u.nome}</option>
                              ))}
                            </select>
                          </label>
                        )}
                      </>
                    )}
                    <label className="md:col-span-2">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Tipo</span>
                      <select
                        value={novo.tipo}
                        onChange={(e) => setNovo((atual) => ({ ...atual, tipo: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="consumo">Consumo (janela mensal)</option>
                        <option value="imobilizado">Imobilizado / bem</option>
                      </select>
                    </label>
                    {novo.tipo === 'consumo' ? (
                      <div className="md:col-span-3">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">Item</span>
                        <ComprasItemTypeahead
                          className="w-full"
                          itens={itensConsumo}
                          value={novo.descricao}
                          placeholder="Digite o item — os resultados aparecem na hora"
                          onChange={(valor) => setNovo((atual) => ({
                            ...atual,
                            descricao: valor,
                            catalogo_item_id: '',
                          }))}
                          onEscolher={(item) => setNovo((atual) => (item ? {
                            ...atual,
                            catalogo_item_id: item.id,
                            descricao: item.descricao,
                            unidade_medida: unidadeParaPedido(item),
                            embalagem: item.embalagem || '',
                            marca_preferencial: item.marca_preferencial || '',
                            categoria_id: item.categoria_id || '',
                          } : { ...atual, catalogo_item_id: '' }))}
                        />
                      </div>
                    ) : (
                      <label className="md:col-span-3">
                        <span className="mb-1 block text-xs font-semibold text-slate-600">Primeiro item</span>
                        <input
                          value={novo.descricao}
                          onChange={(e) => setNovo((atual) => ({ ...atual, descricao: e.target.value }))}
                          placeholder="Descrição (opcional)"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </label>
                    )}
                    <label className="md:col-span-1">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Qtd</span>
                      <input
                        value={novo.quantidade}
                        onChange={(e) => setNovo((atual) => ({ ...atual, quantidade: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="1"
                        inputMode="decimal"
                      />
                    </label>
                    <label className="md:col-span-1">
                      <span className="mb-1 block text-xs font-semibold text-slate-600">Unidade</span>
                      <input
                        value={novo.unidade_medida}
                        onChange={(e) => setNovo((atual) => ({ ...atual, unidade_medida: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        placeholder="un"
                      />
                    </label>
                    <div className="flex items-end md:col-span-2">
                      <PremiumButton type="submit" className="w-full">Criar rascunho</PremiumButton>
                    </div>
                    {novo.tipo === 'consumo' && (novo.embalagem || novo.marca_preferencial) ? (
                      <p className="md:col-span-8 text-xs text-slate-500">
                        Neste pedido: {novo.quantidade || 1} {novo.unidade_medida || 'un'} de {novo.descricao}
                        {novo.embalagem ? ` (cada volume: ${novo.embalagem})` : ''}
                        {novo.marca_preferencial ? ` · ${novo.marca_preferencial}` : ''}.
                      </p>
                    ) : null}
                  </form>
                  <p className="mt-2 text-xs text-slate-500">
                    Quantidade = volumes neste pedido. Unidade = como se conta (un, pct). Depois dá para incluir mais itens no rascunho.
                    Consumo: prepare o envio no calendário da janela, nos dias em verde. Imobilizado não depende da janela e entra no patrimônio após o recebimento.
                    {sede ? ' Pedidos da Sede aparecem nos relatórios como linha própria (como na NFP), sem cadastro de projeto fictício.' : null}
                  </p>
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
                            <th>Envio previsto</th>
                            <th>Status</th>
                            <th>Atualizado</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {pedidos.map((pedido) => (
                            <tr key={pedido.id} className="border-t border-slate-100">
                              <td className="py-2">{pedido.instituicao_nome || pedido.instituicao_id}</td>
                              <td>{pedido.tipo}</td>
                              <td>
                                {pedido.data_envio_prevista
                                  ? `${pedido.data_envio_prevista.slice(8, 10)}/${pedido.data_envio_prevista.slice(5, 7)}`
                                  : '—'}
                                {pedido.envio_automatico ? ' · auto' : ''}
                              </td>
                              <td>{STATUS_LABEL[pedido.status] || pedido.status}</td>
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

            {aba === 'cadastros' && sede && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'fornecedores', label: 'Fornecedores' },
                    { id: 'itens', label: 'Itens de consumo' },
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
