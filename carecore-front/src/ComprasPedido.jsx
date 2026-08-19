import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Mail, ShoppingCart } from 'lucide-react';

import ComprasItemTypeahead from './components/ComprasItemTypeahead';
import Sidebar from './Sidebar';
import { CampoSelect, CampoTexto } from './components/UsuariosCampos';
import {
  AppShell,
  MainShell,
  PageHeader,
  PremiumButton,
  ScrollArea,
  SectionCard,
} from './components/PremiumUI';
import {
  comprasAnexarArquivo,
  comprasAprovarSede,
  comprasAprovarUnidade,
  comprasAtualizarRascunho,
  comprasBaixarAnexo,
  comprasCancelar,
  comprasCategorias,
  comprasComunicacao,
  comprasCotacao,
  comprasDesativarCotacao,
  comprasEnviar,
  comprasEnviarEmailFornecedor,
  comprasEscolherCotacao,
  comprasExcluirRascunho,
  comprasFornecedores,
  comprasGerarPedidoCompra,
  comprasItensConsumo,
  comprasObterPedido,
  comprasReceber,
  comprasReabrir,
  comprasRegistrarNotaFiscal,
  comprasReprovar,
  comprasSalvarItemConsumo,
  comprasSalvarItens,
  comprasSubmeter,
  moneyCentavos,
} from './services/comprasService';
import { usuarioEhAdmCompras, usuarioEhAdmPedidos, usuarioEhManutencao } from './utils/rbacUtils';
import { formatarDataBr } from './utils/comprasJanelaUtils';
import { rotuloCategoria } from './utils/comprasCategoriaUtils';
import { itemConsumoPeloDetalheErro, pedidoItemUnidadeConfusa, sugerirItensConsumo, unidadeParaPedido } from './utils/comprasItensConsumoUtils';

const STATUS_LABEL = {
  rascunho: 'Rascunho',
  aguardando_cotacao: 'Aguardando cotação',
  em_cotacao: 'Em cotação',
  aguardando_aprovacao_unidade: 'Aguardando unidade',
  aguardando_aprovacao_sede: 'Aguardando Sede',
  aprovado: 'Aprovado',
  enviado_fornecedor: 'Enviado ao fornecedor',
  recebido: 'Encerrado',
  cancelado: 'Cancelado',
  reprovado: 'Reprovado',
};

const ROTULO_EVENTO = {
  parecer: 'Parecer',
  negativa: 'Negativa',
  observacao: 'Observação',
  status: 'Status',
  anexo: 'Anexo',
  email: 'E-mail',
};

const ITEM_VAZIO = {
  descricao: '',
  quantidade: '1',
  unidade_medida: '',
  embalagem: '',
  marca_preferencial: '',
  categoria_id: '',
  catalogo_item_id: '',
};

const ROTULO_CAMPO_PEDIDO = {
  embalagem: 'embalagem',
  marca_preferencial: 'marca preferencial',
};

function usuarioSessao() {
  try {
    return JSON.parse(localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario') || '{}');
  } catch {
    return {};
  }
}

function anexosDaCotacao(anexos, cotacaoId) {
  return (anexos || []).filter((item) => item.cotacao_id === cotacaoId);
}

export default function ComprasPedido() {
  const { pedidoId } = useParams();
  const navigate = useNavigate();
  const usuario = useMemo(() => usuarioSessao(), []);
  const usuarioId = usuario.id || usuario.usuario_id;
  const sede = usuarioEhAdmCompras(usuario) || usuarioEhManutencao(usuario);
  const unidade = usuarioEhAdmPedidos(usuario)
    || ['Gestor', 'Técnico', 'Administrativo'].includes(usuario.perfil_acesso);
  const [pedido, setPedido] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [itensConsumo, setItensConsumo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [item, setItem] = useState(ITEM_VAZIO);
  const [cadastrarNoCatalogo, setCadastrarNoCatalogo] = useState(true);
  const [edicaoLinha, setEdicaoLinha] = useState({});
  const [perguntaCadastro, setPerguntaCadastro] = useState(null);
  const [desfazerItens, setDesfazerItens] = useState(null);
  const [cotacao, setCotacao] = useState({ fornecedor_id: '', valor_reais: '', fornecedor_nome: '' });
  const [arqCotacao, setArqCotacao] = useState(null);
  const [comunicacao, setComunicacao] = useState({ tipo: 'observacao', texto: '' });
  const [nfForm, setNfForm] = useState({
    tipo_nf: 'produto', numero: '', serie: '', valor_reais: '', observacao: '',
  });
  const [arqNf, setArqNf] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    try {
      const dados = await comprasObterPedido(pedidoId);
      setPedido(dados);
      const [catalogo, cats, fornecs] = await Promise.all([
        comprasItensConsumo({ ativos: true }),
        comprasCategorias(),
        (sede || dados.tipo === 'imobilizado')
          ? comprasFornecedores({ ativos: true })
          : Promise.resolve(null),
      ]);
      setItensConsumo(catalogo);
      setCategorias(cats);
      if (Array.isArray(fornecs)) setFornecedores(fornecs);
    } catch (err) {
      setErro(err.response?.data?.detail || 'Pedido não encontrado.');
    }
  }, [pedidoId, sede]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const agir = async (fn, mensagemOk = '') => {
    setErro('');
    setOk('');
    try {
      await fn();
      if (mensagemOk) setOk(mensagemOk);
      await carregar();
      return true;
    } catch (err) {
      setErro(err.response?.data?.detail || err.message || 'Não foi possível concluir a ação.');
      return false;
    }
  };

  if (!pedido) {
    return (
      <AppShell>
        <Sidebar />
        <MainShell>
          <PageHeader title="Pedido" backTo="/compras" icon={<ShoppingCart className="h-5 w-5" />} />
          <p className="p-6 text-sm text-slate-600">{erro || 'Carregando…'}</p>
        </MainShell>
      </AppShell>
    );
  }

  const pedidoSede = pedido.escopo_unidade === 'sede';
  const terminal = ['recebido', 'cancelado', 'reprovado'].includes(pedido.status);
  const podeEscolherCotacaoConsumo = pedido.tipo === 'consumo' && unidade && !pedidoSede
    && ['em_cotacao', 'aguardando_aprovacao_unidade'].includes(pedido.status);
  const podeEscolherCotacaoImobilizado = pedido.tipo === 'imobilizado' && unidade && !pedidoSede
    && pedido.status === 'rascunho';
  const podeLancarCotacao = (sede && pedido.tipo === 'consumo' && !terminal)
    || (unidade && pedido.tipo === 'imobilizado' && pedido.status === 'rascunho');
  const podeEncerrar = pedido.status === 'enviado_fornecedor' && (sede || (unidade && !pedidoSede));
  const podeReabrir = pedido.pode_reabrir && pedido.fechado_por_id === usuarioId;
  const pedidoCompra = (pedido.anexos || []).find((a) => a.tipo === 'pedido_compra');

  const promptMotivo = (titulo) => {
    const valor = window.prompt(titulo);
    if (!valor?.trim()) return null;
    return valor.trim();
  };

  const itemAvulso = Boolean(item.descricao.trim()) && !item.catalogo_item_id;
  const sugestoesItem = sugerirItensConsumo(itensConsumo, item.descricao);
  const semCadastro = itemAvulso && sugestoesItem.length === 0;

  const payloadDasLinhas = (linhas) => (linhas || []).map((linha) => ({
    descricao: linha.descricao,
    quantidade: linha.quantidade,
    unidade_medida: linha.unidade_medida,
    embalagem: linha.embalagem || null,
    marca_preferencial: linha.marca_preferencial,
    categoria_id: linha.categoria_id,
    catalogo_item_id: linha.catalogo_item_id,
  }));

  const linhasPedidoCom = (novo) => [...payloadDasLinhas(pedido.itens), novo];

  const marcarDesfazerItens = () => {
    setDesfazerItens({ linhas: payloadDasLinhas(pedido.itens) });
  };

  const desfazerUltimaAlteracaoItens = async () => {
    if (!desfazerItens) return;
    const linhas = desfazerItens.linhas;
    const gravou = await agir(
      () => comprasSalvarItens(pedido.id, linhas),
      'Última alteração nos itens foi desfeita.',
    );
    if (gravou) setDesfazerItens(null);
  };

  const retirarItem = async (itemId) => {
    marcarDesfazerItens();
    await agir(
      () => comprasSalvarItens(
        pedido.id,
        payloadDasLinhas((pedido.itens || []).filter((linha) => linha.id !== itemId)),
      ),
      'Item retirado do pedido.',
    );
  };

  const corrigirUnidadeItem = async (itemId) => {
    marcarDesfazerItens();
    await agir(
      () => comprasSalvarItens(
        pedido.id,
        payloadDasLinhas((pedido.itens || []).map((linha) => (
          linha.id === itemId ? { ...linha, unidade_medida: 'un' } : linha
        ))),
      ),
      'Quantidade passou a ser em un (pacotes). A embalagem continua no cadastro.',
    );
  };

  const gravarCampoLinha = async (linha, campo, valor) => {
    const novo = String(valor || '').trim();
    const atual = String(linha[campo] || '').trim();
    const chaveEdit = `${linha.id}:${campo}`;
    if (novo === atual) {
      setEdicaoLinha((mapa) => {
        const proximo = { ...mapa };
        delete proximo[chaveEdit];
        return proximo;
      });
      return;
    }
    marcarDesfazerItens();
    const gravou = await agir(
      () => comprasSalvarItens(
        pedido.id,
        payloadDasLinhas((pedido.itens || []).map((itemLinha) => (
          itemLinha.id === linha.id ? { ...itemLinha, [campo]: novo || null } : itemLinha
        ))),
      ),
      campo === 'marca_preferencial' ? 'Marca atualizada neste pedido.' : 'Embalagem atualizada neste pedido.',
    );
    if (!gravou) return;
    setEdicaoLinha((mapa) => {
      const proximo = { ...mapa };
      delete proximo[chaveEdit];
      return proximo;
    });
    const cadastroAtual = String(
      (campo === 'marca_preferencial' ? linha.marca_cadastro : linha.embalagem_cadastro) || '',
    ).trim();
    if (sede && linha.catalogo_item_id && novo && novo !== cadastroAtual) {
      setPerguntaCadastro({
        campo,
        itemId: linha.id,
        catalogoId: linha.catalogo_item_id,
        descricao: linha.descricao,
        valor: novo,
        cadastroAtual,
      });
    }
  };

  const atualizarCampoCadastro = async () => {
    if (!perguntaCadastro) return;
    const cat = itensConsumo.find((itemCat) => itemCat.id === perguntaCadastro.catalogoId);
    if (!cat) {
      setErro('Item do cadastro não encontrado.');
      setPerguntaCadastro(null);
      return;
    }
    const gravou = await agir(
      () => comprasSalvarItemConsumo({
        descricao: cat.descricao,
        categoria_id: cat.categoria_id || null,
        unidade_medida: cat.unidade_medida || null,
        embalagem: perguntaCadastro.campo === 'embalagem' ? perguntaCadastro.valor : (cat.embalagem || null),
        marca_preferencial: perguntaCadastro.campo === 'marca_preferencial'
          ? perguntaCadastro.valor
          : (cat.marca_preferencial || null),
        observacao: cat.observacao || null,
        ativo: cat.ativo !== false,
      }, cat.id),
      `Cadastro atualizado. Os próximos pedidos já sugerem esta ${ROTULO_CAMPO_PEDIDO[perguntaCadastro.campo]}.`,
    );
    if (gravou) setPerguntaCadastro(null);
  };

  const incluirItem = async (evento) => {
    evento.preventDefault();
    const descricao = item.descricao.trim();
    if (!descricao) return;

    let catalogo = {
      catalogo_item_id: item.catalogo_item_id || null,
      descricao,
      unidade_medida: item.unidade_medida || null,
      embalagem: item.embalagem || null,
      marca_preferencial: item.marca_preferencial || null,
      categoria_id: item.categoria_id || null,
    };
    let mensagemOk = 'Item incluído.';

    if (!catalogo.catalogo_item_id && sugerirItensConsumo(itensConsumo, descricao).length > 0) {
      setErro('Há itens parecidos no cadastro. Escolha um da lista para não duplicar.');
      setOk('');
      return;
    }

    if (!catalogo.catalogo_item_id && sede && cadastrarNoCatalogo) {
      if (!item.categoria_id) {
        setErro('Selecione a categoria para cadastrar o item.');
        setOk('');
        return;
      }
      try {
        const criado = await comprasSalvarItemConsumo({
          descricao,
          categoria_id: item.categoria_id,
          unidade_medida: unidadeParaPedido({
            unidade_medida: (item.unidade_medida || '').trim(),
            embalagem: (item.embalagem || '').trim(),
          }) || null,
          embalagem: (item.embalagem || '').trim() || null,
          marca_preferencial: (item.marca_preferencial || '').trim() || null,
          ativo: true,
        });
        catalogo = {
          catalogo_item_id: criado.id,
          descricao: criado.descricao || descricao,
          unidade_medida: criado.unidade_medida || catalogo.unidade_medida,
          embalagem: criado.embalagem || catalogo.embalagem,
          marca_preferencial: criado.marca_preferencial || catalogo.marca_preferencial,
          categoria_id: criado.categoria_id || item.categoria_id,
        };
        mensagemOk = 'Item cadastrado e incluído no pedido.';
      } catch (err) {
        const detail = err.response?.data?.detail || err.message || '';
        const existente = itemConsumoPeloDetalheErro(itensConsumo, detail);
        if (!existente) {
          setErro(detail || 'Não foi possível cadastrar o item.');
          setOk('');
          return;
        }
        catalogo = {
          catalogo_item_id: existente.id,
          descricao: existente.descricao,
          unidade_medida: unidadeParaPedido(existente),
          embalagem: existente.embalagem || catalogo.embalagem,
          marca_preferencial: existente.marca_preferencial || catalogo.marca_preferencial,
          categoria_id: existente.categoria_id || catalogo.categoria_id,
        };
        mensagemOk = `Item já existia no cadastro: ${existente.descricao}. Incluído no pedido.`;
      }
    } else if (itemAvulso) {
      mensagemOk = 'Item incluído só neste pedido.';
    }

    marcarDesfazerItens();
    const gravou = await agir(
      () => comprasSalvarItens(pedido.id, linhasPedidoCom({
        descricao: catalogo.descricao,
        quantidade: Number(item.quantidade || 1),
        unidade_medida: (item.unidade_medida || '').trim() || unidadeParaPedido(catalogo),
        embalagem: (item.embalagem || catalogo.embalagem || '').trim() || null,
        marca_preferencial: catalogo.marca_preferencial,
        categoria_id: catalogo.categoria_id,
        catalogo_item_id: catalogo.catalogo_item_id,
      })),
      mensagemOk,
    );
    if (gravou) {
      setItem(ITEM_VAZIO);
      setCadastrarNoCatalogo(true);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow={pedido.instituicao_nome}
          title={`Pedido ${pedido.tipo}`}
          subtitle={`${STATUS_LABEL[pedido.status] || pedido.status} · ${pedido.competencia}`}
          icon={<ShoppingCart className="h-5 w-5" />}
          backTo="/compras"
        />
        <ScrollArea>
          <div className="space-y-4 p-4 md:p-6">
            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
            )}
            {desfazerItens && pedido.status === 'rascunho' && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <span>Última alteração nos itens ainda pode ser desfeita.</span>
                <PremiumButton variant="secondary" type="button" onClick={desfazerUltimaAlteracaoItens}>
                  Desfazer
                </PremiumButton>
              </div>
            )}
            {pedido.aviso_cotacoes && !terminal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {pedido.aviso_cotacoes}
              </div>
            )}

            <SectionCard title="Itens">
              <div className="px-5 py-4">
              {(pedido.itens || []).length === 0 ? (
                <p className="mb-3 text-sm text-slate-500">Nenhum item neste rascunho.</p>
              ) : (
                <div className="mb-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-2">Qtd neste pedido</th>
                        <th className="px-2 py-2">Unidade</th>
                        <th className="px-2 py-2">Item</th>
                        <th className="px-2 py-2">Embalagem</th>
                        <th className="px-2 py-2">Marca</th>
                        {pedido.status === 'rascunho' ? <th className="px-2 py-2" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(pedido.itens || []).map((linha) => {
                        const confusa = pedidoItemUnidadeConfusa(linha);
                        return (
                          <tr key={linha.id} className="border-t border-slate-100 align-top">
                            <td className="px-2 py-2.5 font-medium text-slate-900">{linha.quantidade}</td>
                            <td className="px-2 py-2.5">{linha.unidade_medida || 'un'}</td>
                            <td className="px-2 py-2.5">
                              <strong className="text-slate-900">{linha.descricao}</strong>
                              {confusa ? (
                                <p className="mt-1 text-xs text-amber-800">
                                  Quantidade em {linha.unidade_medida} e embalagem {linha.embalagem} se misturam.
                                  Se a intenção é o pacote, use un.
                                </p>
                              ) : null}
                            </td>
                            <td className="px-2 py-2.5">
                              {pedido.status === 'rascunho' ? (
                                <input
                                  value={edicaoLinha[`${linha.id}:embalagem`] ?? (linha.embalagem || '')}
                                  onChange={(e) => setEdicaoLinha((mapa) => ({
                                    ...mapa,
                                    [`${linha.id}:embalagem`]: e.target.value,
                                  }))}
                                  onBlur={(e) => gravarCampoLinha(linha, 'embalagem', e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                  }}
                                  placeholder="Ex.: 500 g"
                                  className="w-full min-w-[7rem] rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                                  aria-label={`Embalagem de ${linha.descricao}`}
                                />
                              ) : (linha.embalagem || '—')}
                            </td>
                            <td className="px-2 py-2.5">
                              {pedido.status === 'rascunho' ? (
                                <input
                                  value={edicaoLinha[`${linha.id}:marca_preferencial`] ?? (linha.marca_preferencial || '')}
                                  onChange={(e) => setEdicaoLinha((mapa) => ({
                                    ...mapa,
                                    [`${linha.id}:marca_preferencial`]: e.target.value,
                                  }))}
                                  onBlur={(e) => gravarCampoLinha(linha, 'marca_preferencial', e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                  }}
                                  placeholder="Marca"
                                  className="w-full min-w-[7rem] rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                                  aria-label={`Marca de ${linha.descricao}`}
                                />
                              ) : (linha.marca_preferencial || '—')}
                            </td>
                            {pedido.status === 'rascunho' ? (
                              <td className="px-2 py-2.5 text-right">
                                <div className="flex flex-wrap justify-end gap-2">
                                  {confusa ? (
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-amber-800 underline"
                                      onClick={() => corrigirUnidadeItem(linha.id)}
                                    >
                                      Usar un
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-slate-600 underline"
                                    onClick={() => retirarItem(linha.id)}
                                  >
                                    Retirar
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {perguntaCadastro ? (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                  <p className="text-sm text-amber-950">
                    A {ROTULO_CAMPO_PEDIDO[perguntaCadastro.campo]} de <strong>{perguntaCadastro.descricao}</strong> neste pedido ficou
                    {' '}
                    <strong>{perguntaCadastro.valor}</strong>
                    .
                    {perguntaCadastro.cadastroAtual
                      ? ` No cadastro está "${perguntaCadastro.cadastroAtual}".`
                      : ` No cadastro ainda não há ${ROTULO_CAMPO_PEDIDO[perguntaCadastro.campo]}.`}
                    {' '}
                    Atualizar o cadastro para os próximos pedidos?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PremiumButton type="button" variant="secondary" onClick={() => setPerguntaCadastro(null)}>
                      Só neste pedido
                    </PremiumButton>
                    <PremiumButton type="button" onClick={atualizarCampoCadastro}>
                      Sim, atualizar cadastro
                    </PremiumButton>
                  </div>
                </div>
              ) : null}
              <p className="mb-3 text-xs text-slate-500">
                Quantidade = volumes neste pedido. Embalagem e marca podem valer só nesta compra ou atualizar o cadastro.
              </p>
              {pedido.status === 'rascunho' && (
                <form className="grid gap-2 md:grid-cols-8" onSubmit={incluirItem}>
                  <ComprasItemTypeahead
                    className="md:col-span-4"
                    itens={itensConsumo}
                    value={item.descricao}
                    required
                    placeholder="Digite o item — os resultados aparecem na hora"
                    onChange={(valor) => setItem((a) => ({ ...a, descricao: valor, catalogo_item_id: '' }))}
                    onEscolher={(escolhido) => setItem((a) => (escolhido ? {
                      ...a,
                      catalogo_item_id: escolhido.id,
                      descricao: escolhido.descricao,
                      unidade_medida: unidadeParaPedido(escolhido),
                      embalagem: escolhido.embalagem || '',
                      marca_preferencial: escolhido.marca_preferencial || '',
                      categoria_id: escolhido.categoria_id || '',
                    } : { ...a, catalogo_item_id: '' }))}
                  />
                  <label className="md:col-span-1">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Qtd</span>
                    <input
                      value={item.quantidade}
                      onChange={(e) => setItem((a) => ({ ...a, quantidade: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="1"
                    />
                  </label>
                  <label className="md:col-span-1">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Unidade</span>
                    <input
                      value={item.unidade_medida}
                      onChange={(e) => setItem((a) => ({ ...a, unidade_medida: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      placeholder="un"
                    />
                  </label>
                  <div className="flex items-end md:col-span-2">
                    <PremiumButton type="submit" className="w-full">Incluir item</PremiumButton>
                  </div>
                  {item.catalogo_item_id ? (
                    <p className="md:col-span-8 text-xs text-slate-500">
                      Neste pedido: {item.quantidade || 1} {item.unidade_medida || 'un'} de {item.descricao}
                      {item.embalagem ? ` (cada volume: ${item.embalagem})` : ''}.
                    </p>
                  ) : semCadastro && sede ? (
                    <div className="md:col-span-8 space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                      <label className="flex items-start gap-2 text-sm text-amber-950">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={cadastrarNoCatalogo}
                          onChange={(e) => setCadastrarNoCatalogo(e.target.checked)}
                        />
                        <span>
                          Este item ainda não está no cadastro. Cadastrar agora para aparecer na busca dos próximos pedidos.
                        </span>
                      </label>
                      {cadastrarNoCatalogo ? (
                        <>
                          <div className="grid gap-2 md:grid-cols-2">
                            <CampoSelect
                              label="Categoria"
                              value={item.categoria_id}
                              onChange={(valor) => setItem((a) => ({ ...a, categoria_id: valor }))}
                              options={categorias.map((cat) => ({ value: cat.id, label: rotuloCategoria(cat) }))}
                              placeholder="Selecione a existente"
                              required
                            />
                            <CampoTexto
                              label="Embalagem"
                              value={item.embalagem}
                              onChange={(valor) => setItem((a) => ({ ...a, embalagem: valor }))}
                              placeholder="500 g, PCT 2 kg…"
                            />
                            <CampoTexto
                              label="Marca preferencial"
                              value={item.marca_preferencial}
                              onChange={(valor) => setItem((a) => ({ ...a, marca_preferencial: valor }))}
                              className="md:col-span-2"
                            />
                          </div>
                          <p className="text-xs text-amber-900">
                            Quantidade = quantos volumes neste pedido. Unidade = como se conta (un, pct).
                            Embalagem = o tamanho de cada volume (ex.: 500 g). Pacote de 500 g não é “1 kg”.
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-amber-900">
                          Sem cadastro, o texto fica avulso só neste pedido.
                        </p>
                      )}
                    </div>
                  ) : itemAvulso && sugestoesItem.length > 0 ? (
                    <p className="md:col-span-8 text-xs text-slate-500">
                      Há itens no cadastro. Escolha um da lista para não criar outro parecido.
                    </p>
                  ) : (
                    <p className="md:col-span-8 text-xs text-slate-500">
                      Comece a digitar: o cadastro sugere na hora.
                      {sede
                        ? ' Se não existir, dá para cadastrar agora.'
                        : ' Se não existir, inclua avulso — a Sede cadastra no catálogo.'}
                    </p>
                  )}
                </form>
              )}
              </div>
            </SectionCard>

            <SectionCard title="Cotações e orçamentos">
              <p className="mb-2 text-xs text-slate-500">
                Consumo: a Sede lança orçamentos (PDF). Imobilizado: a unidade anexa os orçamentos.
                Orçamentos podem ser substituídos enquanto o processo não encerrar.
              </p>
              <ul className="mb-3 space-y-2 text-sm">
                {(pedido.cotacoes || []).map((c) => (
                  <li key={c.id} className="rounded-xl border border-slate-100 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {c.fornecedor_nome} · {moneyCentavos(c.valor_centavos)}
                        {c.escolhida ? ' · escolhida' : ''}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(podeEscolherCotacaoConsumo || podeEscolherCotacaoImobilizado) && !c.escolhida && (
                          <PremiumButton onClick={() => agir(() => comprasEscolherCotacao(pedido.id, c.id))}>
                            Escolher
                          </PremiumButton>
                        )}
                        {!terminal && (
                          <PremiumButton
                            variant="secondary"
                            onClick={async () => {
                              const motivo = promptMotivo('Motivo da substituição (opcional):') ?? '';
                              await agir(() => comprasDesativarCotacao(pedido.id, c.id, motivo || null));
                            }}
                          >
                            Substituir
                          </PremiumButton>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {anexosDaCotacao(pedido.anexos, c.id).map((anexo) => (
                        <button
                          key={anexo.id}
                          type="button"
                          className="text-xs font-semibold text-violet-700 underline"
                          onClick={() => comprasBaixarAnexo(pedido.id, anexo.id, anexo.nome_arquivo).catch(() => setErro('Não foi possível abrir o orçamento.'))}
                        >
                          {anexo.nome_arquivo}
                        </button>
                      ))}
                      {!terminal && (
                        <label className="cursor-pointer text-xs font-semibold text-slate-600">
                          + Anexar PDF
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const fd = new FormData();
                              fd.append('tipo', 'orcamento');
                              fd.append('cotacao_id', c.id);
                              fd.append('arquivo', file);
                              await agir(() => comprasAnexarArquivo(pedido.id, fd), 'Orçamento anexado.');
                              e.target.value = '';
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {podeLancarCotacao && (
                <form
                  className="grid gap-2 md:grid-cols-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await agir(async () => {
                      const dados = await comprasCotacao(pedido.id, {
                        fornecedor_id: cotacao.fornecedor_id || null,
                        fornecedor_nome: cotacao.fornecedor_nome || null,
                        valor_reais: Number(cotacao.valor_reais || 0),
                      });
                      const nova = (dados.cotacoes || []).slice(-1)[0];
                      if (arqCotacao && nova?.id) {
                        const fd = new FormData();
                        fd.append('tipo', 'orcamento');
                        fd.append('cotacao_id', nova.id);
                        fd.append('arquivo', arqCotacao);
                        await comprasAnexarArquivo(pedido.id, fd);
                      }
                    }, 'Cotação lançada.');
                    setCotacao({ fornecedor_id: '', valor_reais: '', fornecedor_nome: '' });
                    setArqCotacao(null);
                  }}
                >
                  <select
                    value={cotacao.fornecedor_id}
                    onChange={(e) => setCotacao((a) => ({ ...a, fornecedor_id: e.target.value }))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                  >
                    <option value="">Fornecedor cadastrado…</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>{f.nome}</option>
                    ))}
                  </select>
                  <input
                    value={cotacao.fornecedor_nome}
                    onChange={(e) => setCotacao((a) => ({ ...a, fornecedor_nome: e.target.value }))}
                    placeholder="Ou nome avulso"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={cotacao.valor_reais}
                    onChange={(e) => setCotacao((a) => ({ ...a, valor_reais: e.target.value }))}
                    placeholder="Valor R$"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    required
                  />
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setArqCotacao(e.target.files?.[0] || null)}
                    className="text-xs"
                  />
                  <PremiumButton type="submit" className="md:col-span-5 md:max-w-xs">Lançar cotação</PremiumButton>
                </form>
              )}
            </SectionCard>

            {!terminal && (
              <SectionCard title="Comunicação (parecer, negativa, observação)">
                <form
                  className="grid gap-2 md:grid-cols-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await agir(
                      () => comprasComunicacao(pedido.id, comunicacao),
                      'Registro salvo na timeline.',
                    );
                    setComunicacao((atual) => ({ ...atual, texto: '' }));
                  }}
                >
                  <select
                    value={comunicacao.tipo}
                    onChange={(e) => setComunicacao((a) => ({ ...a, tipo: e.target.value }))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="observacao">Observação</option>
                    <option value="parecer">Parecer</option>
                    <option value="negativa">Negativa</option>
                  </select>
                  <input
                    value={comunicacao.texto}
                    onChange={(e) => setComunicacao((a) => ({ ...a, texto: e.target.value }))}
                    placeholder="Texto da comunicação"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                    required
                  />
                  <PremiumButton type="submit">Registrar</PremiumButton>
                </form>
                {!terminal && pedido.status === 'enviado_fornecedor' && (
                  <div className="mt-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <FileText size={16} />
                      Anexar resposta do fornecedor
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const fd = new FormData();
                          fd.append('tipo', 'resposta_fornecedor');
                          fd.append('arquivo', file);
                          await agir(() => comprasAnexarArquivo(pedido.id, fd));
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
              </SectionCard>
            )}

            <SectionCard title="Timeline do processo">
              <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
                {(pedido.eventos || []).length === 0 && (
                  <li className="text-slate-500">Nenhum evento registrado ainda.</li>
                )}
                {(pedido.eventos || []).map((ev) => (
                  <li key={ev.id} className="rounded-lg border border-slate-100 px-3 py-2">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {ROTULO_EVENTO[ev.tipo] || ev.tipo}
                      {ev.criado_em ? ` · ${formatarDataBr(ev.criado_em)}` : ''}
                    </p>
                    {ev.texto && <p className="mt-1 text-slate-800">{ev.texto}</p>}
                  </li>
                ))}
              </ul>
            </SectionCard>

            {pedidoCompra && (
              <SectionCard title="Pedido de compra gerado">
                <PremiumButton
                  variant="secondary"
                  onClick={() => comprasBaixarAnexo(pedido.id, pedidoCompra.id, pedidoCompra.nome_arquivo)}
                >
                  Abrir / imprimir pedido enviado
                </PremiumButton>
              </SectionCard>
            )}

            {pedido.tipo === 'consumo' && pedido.status === 'rascunho' && (
              <SectionCard
                title="Envio na janela"
                subtitle={pedido.data_envio_prevista
                  ? `Rascunho previsto para ${formatarDataBr(pedido.data_envio_prevista)}.`
                  : 'Escolha um dia liberado no calendário da janela mensal.'}
              >
                <div className="px-5 py-4">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                      checked={Boolean(pedido.envio_automatico)}
                      onChange={(e) => agir(() => comprasAtualizarRascunho(pedido.id, {
                        envio_automatico: e.target.checked,
                      }))}
                    />
                    <span>
                      <strong className="text-sm text-slate-900">Envio automático</strong>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Quando este dia abrir na janela, o CareCore envia o rascunho sozinho.
                      </p>
                    </span>
                  </label>
                </div>
              </SectionCard>
            )}

            {(pedido.notas_fiscais || []).length > 0 && (
              <SectionCard title="Notas fiscais">
                <ul className="space-y-2 text-sm">
                  {pedido.notas_fiscais.map((nf) => (
                    <li key={nf.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2">
                      <span>
                        {nf.tipo_nf} · NF {nf.numero || '—'}
                        {nf.valor_centavos != null ? ` · ${moneyCentavos(nf.valor_centavos)}` : ''}
                        {nf.origem_dados === 'xml' ? ' · XML' : ''}
                      </span>
                      {nf.anexo_id && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-violet-700 underline"
                          onClick={() => {
                            const anexo = (pedido.anexos || []).find((a) => a.id === nf.anexo_id);
                            comprasBaixarAnexo(pedido.id, nf.anexo_id, anexo?.nome_arquivo);
                          }}
                        >
                          Ver arquivo
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {podeEncerrar && (
              <SectionCard title="Nota fiscal e encerramento">
                <p className="mb-3 text-xs text-slate-500">
                  Anexe uma ou mais NFs (XML ou PDF). Para PDF, preencha os campos principais manualmente.
                </p>
                <form
                  className="grid gap-2 md:grid-cols-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData();
                    Object.entries(nfForm).forEach(([chave, valor]) => {
                      if (valor) fd.append(chave, valor);
                    });
                    if (arqNf) fd.append('arquivo', arqNf);
                    await agir(() => comprasRegistrarNotaFiscal(pedido.id, fd), 'Nota fiscal registrada.');
                    setNfForm({ tipo_nf: 'produto', numero: '', serie: '', valor_reais: '', observacao: '' });
                    setArqNf(null);
                  }}
                >
                  <select
                    value={nfForm.tipo_nf}
                    onChange={(e) => setNfForm((a) => ({ ...a, tipo_nf: e.target.value }))}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="produto">Produto</option>
                    <option value="servico">Serviço</option>
                    <option value="outro">Outro</option>
                  </select>
                  <input
                    value={nfForm.numero}
                    onChange={(e) => setNfForm((a) => ({ ...a, numero: e.target.value }))}
                    placeholder="Número NF"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={nfForm.valor_reais}
                    onChange={(e) => setNfForm((a) => ({ ...a, valor_reais: e.target.value }))}
                    placeholder="Valor R$ (manual se PDF)"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="file"
                    accept=".pdf,.xml,.jpg,.jpeg,.png"
                    onChange={(e) => setArqNf(e.target.files?.[0] || null)}
                    className="text-xs md:col-span-2"
                  />
                  <PremiumButton type="submit">Anexar NF</PremiumButton>
                </form>
                <div className="mt-4">
                  <PremiumButton
                    onClick={() => agir(
                      () => comprasReceber(pedido.id, { observacao: 'Recebimento confirmado.' }),
                      'Processo encerrado.',
                    )}
                    disabled={!(pedido.notas_fiscais || []).length}
                  >
                    Encerrar processo (com NF anexada)
                  </PremiumButton>
                </div>
              </SectionCard>
            )}

            <SectionCard title="Fluxo">
              <div className="flex flex-wrap gap-2">
                {pedido.status === 'rascunho' && (
                  <PremiumButton onClick={() => agir(() => comprasSubmeter(pedido.id))}>
                    Enviar pedido
                  </PremiumButton>
                )}
                {pedido.status === 'aguardando_aprovacao_unidade' && unidade && !pedidoSede && (
                  <PremiumButton onClick={() => agir(() => comprasAprovarUnidade(pedido.id))}>
                    Aprovar na unidade
                  </PremiumButton>
                )}
                {pedido.status === 'aguardando_aprovacao_sede' && sede && (
                  <PremiumButton onClick={() => agir(() => comprasAprovarSede(pedido.id))}>
                    Aprovar na Sede
                  </PremiumButton>
                )}
                {pedido.status === 'aprovado' && sede && (
                  <>
                    <PremiumButton onClick={() => agir(() => comprasGerarPedidoCompra(pedido.id), 'Pedido gerado.')}>
                      Gerar pedido de compra
                    </PremiumButton>
                    <PremiumButton onClick={() => agir(() => comprasEnviar(pedido.id), 'Marcado como enviado.')}>
                      Enviar ao fornecedor
                    </PremiumButton>
                  </>
                )}
                {['aprovado', 'enviado_fornecedor'].includes(pedido.status) && sede && (
                  <PremiumButton
                    variant="secondary"
                    onClick={() => agir(() => comprasEnviarEmailFornecedor(pedido.id), 'E-mail processado (veja timeline).')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Mail size={16} />
                      Enviar / reenviar e-mail
                    </span>
                  </PremiumButton>
                )}
                {podeReabrir && (
                  <PremiumButton onClick={() => agir(() => comprasReabrir(pedido.id), 'Processo reaberto.')}>
                    Reabrir processo
                  </PremiumButton>
                )}
                {pedido.pode_excluir ? (
                  <PremiumButton
                    variant="danger"
                    onClick={async () => {
                      if (!window.confirm(
                        'Excluir este rascunho? Ele some da lista. Só é possível enquanto a outra parte ainda não interagiu.',
                      )) return;
                      setErro('');
                      setOk('');
                      try {
                        await comprasExcluirRascunho(pedido.id);
                        navigate('/compras');
                      } catch (err) {
                        setErro(err.response?.data?.detail || err.message || 'Não foi possível excluir o rascunho.');
                      }
                    }}
                  >
                    Excluir rascunho
                  </PremiumButton>
                ) : !terminal ? (
                  <>
                    <PremiumButton
                      variant="secondary"
                      onClick={async () => {
                        const motivo = promptMotivo('Motivo da reprovação:');
                        if (!motivo) return;
                        await agir(() => comprasReprovar(pedido.id, motivo));
                      }}
                    >
                      Reprovar
                    </PremiumButton>
                    <PremiumButton
                      variant="secondary"
                      onClick={async () => {
                        const motivo = promptMotivo('Motivo do cancelamento:');
                        if (!motivo) return;
                        await agir(() => comprasCancelar(pedido.id, motivo));
                      }}
                    >
                      Cancelar
                    </PremiumButton>
                  </>
                ) : null}
                <PremiumButton variant="secondary" onClick={() => navigate('/compras')}>
                  Voltar
                </PremiumButton>
              </div>
            </SectionCard>
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
