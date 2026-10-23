import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Mail, Search, ShoppingCart } from 'lucide-react';

import CampoSenha from './components/CampoSenha';
import ComprasDocumentosAnexados from './components/ComprasDocumentosAnexados';
import ComprasItemTypeahead from './components/ComprasItemTypeahead';
import ModalFormItemConsumo from './components/ModalFormItemConsumo';
import ModalPosicionarAssinaturaOrcamento from './components/ModalPosicionarAssinaturaOrcamento';
import ModalPosicionarTextoNf from './components/ModalPosicionarTextoNf';
import ModalRevisarEmailCompras from './components/ModalRevisarEmailCompras';
import ModalVisualizarAnexoCompras from './components/ModalVisualizarAnexoCompras';
import Sidebar from './Sidebar';
import {
  AppShell,
  MainShell,
  PageHeader,
  PremiumBadge,
  PremiumButton,
  ScrollArea,
  SectionCard,
} from './components/PremiumUI';
import {
  comprasAnexarArquivo,
  comprasRevisarContrato,
  comprasContratoAssinado,
  comprasAprovarSede,
  comprasAssinarOrcamentoSede,
  comprasAssinaturaEletronicaGestor,
  comprasAprovarUnidade,
  comprasAtualizarRascunho,
  comprasBaixarAnexo,
  comprasCancelar,
  comprasCategorias,
  comprasComunicacao,
  comprasEditarEvento,
  comprasConfirmarEvento,
  comprasConfirmarRevisaoItens,
  comprasCotacao,
  comprasDesativarCotacao,
  comprasEnviar,
  comprasCompraDireta,
  comprasRegistrarSemContrato,
  comprasEnviarEmailFornecedor,
  comprasEscolherCotacao,
  comprasExcluirRascunho,
  comprasFornecedores,
  comprasGerarPedidoCompra,
  comprasItensConsumo,
  comprasLiberarEscolha,
  comprasObterPedido,
  comprasReceber,
  comprasDefinirPagamento,
  comprasQuitarPagamento,
  comprasReabrir,
  comprasReabrirAprovado,
  comprasAbrirAnexoBlob,
  comprasRegistrarImpressaoNf,
  comprasRegistrarNotaFiscal,
  comprasRemoverNotaFiscal,
  comprasRemoverAnexo,
  comprasRascunhoEmail,
  comprasRevogarEscolhaCotacao,
  comprasReprovar,
  comprasSalvarItemConsumo,
  comprasSalvarItens,
  comprasSolicitarCotacao,
  comprasSubmeter,
  moneyCentavos,
} from './services/comprasService';
import { usuarioEhAdmCompras, usuarioEhAdmComprasInfraestrutura, usuarioEhAdmComprasSuprimentos, usuarioEhAdmPedidos, usuarioEhGlobalPuro, usuarioEhManutencao, usuarioGlobalAssinaOrcamento, usuarioPodeCadastrarMestreCompras, usuarioPodeEnviarEmailCompras } from './utils/rbacUtils';
import { formatarDataBr } from './utils/comprasJanelaUtils';
import { formatarDataHoraBr } from './utils/dataBrasilUtils';
import { itemConsumoPeloDetalheErro, pedidoItemUnidadeConfusa, sugerirItensConsumo, unidadeParaPedido } from './utils/comprasItensConsumoUtils';
import { centavosParaInput, reaisParaCentavos } from './utils/comprasPatrimonioUtils';
import {
  rotuloStatusPedidoLista,
  statusMostraProgressoOrcamentos,
  varianteBadgeStatusPedido,
} from './utils/comprasPedidoStatus';
import {
  STEPS_COTACAO_PROJETO,
  cotacoesComEscolhidaPrimeiro,
  etapaCotacaoProjeto,
  fornecedorSemCategoria,
  fornecedoresParaCotacaoPedido,
  hortifrutiSemOrcamentoEscolhido,
  inferirFornecedorEnvioId,
  itensConsumoDoSplitPedido,
  modoEmailPedeFornecedorEnvio,
  SEGMENTO_SERVICO,
  TIPO_SERVICO,
  competenciaPadraoDoSegmento,
  rotuloSegmentoCatalogo,
  rotuloTipoPedido,
  segmentoDoTipoPedido,
  segmentoFornecedorDoTipoPedido,
  sugerirFornecedoresBusca,
  tipoEhCotacaoProjeto,
  pedidoSegueInfraestrutura,
  tipoEhCotacaoSede,
  tipoExigeJanela,
  tipoPulaAprovacaoSede,
  tipoSuprimentosAprovaEEnvia,
} from './utils/comprasPedidoTipos';

const ROTULO_EVENTO = {
  parecer: 'Parecer',
  negativa: 'Negativa',
  observacao: 'Observação',
  status: 'Status',
  anexo: 'Anexo',
  email: 'E-mail',
  itens: 'Itens',
  itens_ok: 'Itens conferidos',
  ok: 'Confirmado',
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

function mascararMoedaDigitando(texto) {
  const digitos = String(texto || '').replace(/\D/g, '');
  if (!digitos) return '';
  return centavosParaInput(Number(digitos));
}

function quandoOperacional(iso) {
  if (!iso) return '';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR');
}

function imprimirUrlAnexo(url) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.title = 'Impressão da nota fiscal';
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    iframe.src = url;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        iframe.remove();
        URL.revokeObjectURL(url);
        reject(err);
        return;
      }
      window.setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
        resolve();
      }, 400);
    };
    document.body.appendChild(iframe);
  });
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
  const infra = usuarioEhAdmComprasInfraestrutura(usuario) || usuarioEhManutencao(usuario);
  const caixaSuprimentos = usuarioEhAdmComprasSuprimentos(usuario);
  const consultaGlobal = usuarioEhGlobalPuro(usuario);
  const assinaOrcamento = usuarioGlobalAssinaOrcamento(usuario);
  const manutencao = usuarioEhManutencao(usuario);
  const podeDispararEmailCompras = usuarioPodeEnviarEmailCompras(usuario);
  const admPedidos = usuarioEhAdmPedidos(usuario);
  const podeCadastrarMestre = usuarioPodeCadastrarMestreCompras(usuario);
  const unidade = admPedidos
    || manutencao
    || ['Gestor', 'Técnico', 'Administrativo'].includes(usuario.perfil_acesso);
  const [pedido, setPedido] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [itensConsumo, setItensConsumo] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [item, setItem] = useState(ITEM_VAZIO);
  const [modalNovoItem, setModalNovoItem] = useState(null);
  const [cadastrarNoCatalogo, setCadastrarNoCatalogo] = useState(true);
  const [edicaoLinha, setEdicaoLinha] = useState({});
  const [perguntaCadastro, setPerguntaCadastro] = useState(null);
  const [desfazerItens, setDesfazerItens] = useState(null);
  const [cotacao, setCotacao] = useState({ fornecedor_id: '', valor_reais: '', fornecedor_nome: '', fornecedor_contato: '' });
  const [arqsCotacao, setArqsCotacao] = useState([]);
  const [fornecedoresCotacaoIds, setFornecedoresCotacaoIds] = useState([]);
  const [buscaFornecedorCotacao, setBuscaFornecedorCotacao] = useState('');
  const [buscaFornecedorLancamento, setBuscaFornecedorLancamento] = useState('');
  const [comunicacao, setComunicacao] = useState({ tipo: 'observacao', texto: '' });
  const [eventoEdicao, setEventoEdicao] = useState(null);
  const [nfForm, setNfForm] = useState({
    tipo_nf: 'produto', numero: '', serie: '', valor_reais: '', observacao: '',
  });
  const [arqsNf, setArqsNf] = useState([]);
  const [classeDoc, setClasseDoc] = useState('nota_fiscal');
  const [modoPagamento, setModoPagamento] = useState('avista');
  const [qtdParcelasForm, setQtdParcelasForm] = useState('2');
  const [parcelaDoc, setParcelaDoc] = useState(1);
  const [listaDocumentosAberta, setListaDocumentosAberta] = useState(false);
  const [modalTextoNf, setModalTextoNf] = useState(false);
  const [carimboNf, setCarimboNf] = useState(null);
  const [carimboAssinaturaNf, setCarimboAssinaturaNf] = useState(null);
  const [senhaAssinaturaNf, setSenhaAssinaturaNf] = useState('');
  const [assinaturaGestor, setAssinaturaGestor] = useState({ gestor: false, cadastrada: false });
  const [modalAssinatura, setModalAssinatura] = useState(null);
  const [modalEmail, setModalEmail] = useState(null);
  const [fornecedorEnvioId, setFornecedorEnvioId] = useState('');
  const [rascunhoEmail, setRascunhoEmail] = useState({
    assunto: '', corpo: '', aviso: '', carregando: false, erro: '',
  });
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [obsPedido, setObsPedido] = useState('');
  const [modalAnexo, setModalAnexo] = useState(null);

  const pedidoRef = useRef(null);
  useEffect(() => {
    pedidoRef.current = pedido;
  }, [pedido]);
  const listaItensLocal = useRef(null);
  const filaItens = useRef(Promise.resolve());
  const gravandoItens = useRef(0);
  const incluindoItem = useRef(false);
  const [salvandoItem, setSalvandoItem] = useState(false);

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (silencioso && gravandoItens.current > 0) return;
    if (!silencioso) setErro('');
    try {
      const dados = await comprasObterPedido(pedidoId);
      if (silencioso && (gravandoItens.current > 0 || listaItensLocal.current)) return;
      setPedido(dados);
      pedidoRef.current = dados;
      if (!silencioso) {
        setObsPedido(dados?.observacao || '');
        const qtd = Number(dados?.pagamento_qtd_parcelas || 0);
        if (qtd > 1) {
          setModoPagamento('parcelado');
          setQtdParcelasForm(String(qtd));
        } else {
          setModoPagamento('avista');
          setQtdParcelasForm('2');
        }
        const primeiraAberta = (dados?.pagamento_parcelas || []).find((p) => !p.paga);
        setParcelaDoc(primeiraAberta?.numero || 1);
      }
      if (!silencioso) {
        const [catalogo, cats, fornecs] = await Promise.all([
          comprasItensConsumo({ ativos: true }),
          comprasCategorias(),
          (sede || tipoEhCotacaoProjeto(dados.tipo))
            ? comprasFornecedores({ ativos: true })
            : Promise.resolve(null),
        ]);
        setItensConsumo(catalogo);
        setCategorias(cats);
        if (Array.isArray(fornecs)) setFornecedores(fornecs);
      }
    } catch (err) {
      if (!silencioso) {
        setErro(err.response?.data?.detail || 'Pedido não encontrado.');
      }
    }
  }, [pedidoId, sede]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    comprasAssinaturaEletronicaGestor()
      .then((dados) => {
        if (ativo) setAssinaturaGestor(dados || { gestor: false, cadastrada: false });
      })
      .catch(() => {
        if (ativo) setAssinaturaGestor({ gestor: false, cadastrada: false });
      });
    return () => {
      ativo = false;
    };
  }, [pedidoId]);

  useEffect(() => {
    const aoAtualizarCatalogo = (evento) => {
      if (evento.key !== 'compras-catalogo-atualizado') return;
      carregar();
    };
    window.addEventListener('storage', aoAtualizarCatalogo);
    return () => window.removeEventListener('storage', aoAtualizarCatalogo);
  }, [carregar]);

  // Autocheque leve a cada 30s (status/anexos/timeline) sem recarregar catálogos.
  useEffect(() => {
    if (!pedidoId) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      carregar({ silencioso: true });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [carregar, pedidoId]);

  const imprimirNfSuprimentos = async () => {
    const notas = (pedido?.notas_fiscais || []).filter((nf) => nf.anexo_id);
    const abertos = [];
    try {
      for (const nf of notas) {
        const aberto = await comprasAbrirAnexoBlob(pedido.id, nf.anexo_id);
        const tipo = aberto.contentType || '';
        if (tipo === 'application/pdf' || tipo.startsWith('image/')) {
          abertos.push(aberto);
        } else {
          URL.revokeObjectURL(aberto.url);
        }
      }
      if (!abertos.length) {
        setErro('Não há PDF ou imagem da nota fiscal para imprimir.');
        return;
      }
      for (const aberto of abertos) {
        await imprimirUrlAnexo(aberto.url);
      }
      if (!pedido.nf_impressa) {
        const dados = await comprasRegistrarImpressaoNf(pedido.id);
        setPedido(dados);
      }
      setErro('');
      setOk(pedido.nf_impressa
        ? 'Impressão da nota fiscal aberta novamente.'
        : 'Nota fiscal enviada para impressão.');
    } catch (err) {
      setErro(err.response?.data?.detail || err.message || 'Não foi possível imprimir a nota fiscal.');
    }
  };

  const fornecedoresCotacao = useMemo(
    () => fornecedoresParaCotacaoPedido(fornecedores, categorias, pedido?.tipo),
    [fornecedores, categorias, pedido?.tipo],
  );

  const fornecedoresCotacaoFiltrados = useMemo(
    () => sugerirFornecedoresBusca(fornecedoresCotacao, buscaFornecedorCotacao),
    [fornecedoresCotacao, buscaFornecedorCotacao],
  );

  const fornecedoresSelecionadosCotacao = useMemo(
    () => fornecedoresCotacao.filter((f) => fornecedoresCotacaoIds.includes(f.id)),
    [fornecedoresCotacao, fornecedoresCotacaoIds],
  );

  useEffect(() => {
    const idsOk = new Set(fornecedoresCotacao.map((f) => f.id));
    setFornecedoresCotacaoIds((prev) => prev.filter((id) => idsOk.has(id)));
  }, [fornecedoresCotacao]);

  const agir = async (fn, mensagemOk = '') => {
    setErro('');
    setOk('');
    try {
      await fn();
      if (mensagemOk) setOk(mensagemOk);
      await carregar();
      return true;
    } catch (err) {
      const detail = err.response?.data?.detail;
      const mensagem = typeof detail === 'string'
        ? detail
        : (detail?.message || err.message || 'Não foi possível concluir a ação.');
      setErro(mensagem);
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
  const ehRascunho = pedido.status === 'rascunho';
  const podeEditarItens = Boolean(pedido.pode_editar_itens);
  const segueInfra = Boolean(pedido.segue_infraestrutura)
    || pedidoSegueInfraestrutura(pedido.tipo, pedido.destino_compras);
  const cotacaoProjeto = tipoEhCotacaoProjeto(pedido.tipo) || segueInfra;
  const hortifrutiDireto = tipoSuprimentosAprovaEEnvia(pedido.tipo);
  const cotacaoSede = tipoEhCotacaoSede(pedido.tipo) && !hortifrutiDireto && !segueInfra;
  // Após envio ao fornecedor (ou encerrado), orçamentos ficam só leitura.
  const orcamentosTravados = ['enviado_fornecedor', 'recebido', 'cancelado', 'reprovado'].includes(pedido.status);
  const hortifrutiAberto = hortifrutiDireto && !orcamentosTravados && !terminal;
  const podeRemoverOrcamento = !orcamentosTravados && (
    Boolean(pedido.pode_substituir_orcamento)
    || (unidade && cotacaoProjeto && ['rascunho', 'em_cotacao', 'aguardando_cotacao'].includes(pedido.status))
    || hortifrutiAberto
  );
  const pulaAprovacaoSede = tipoPulaAprovacaoSede(pedido.tipo) || Boolean(pedido.pula_aprovacao_sede);
  const segmentoCotacao = segmentoFornecedorDoTipoPedido(pedido.tipo);
  const consumoProjetoEscolhe = pedido.tipo === 'consumo';
  const podeEscolherCotacao = !orcamentosTravados && (
    (sede && !consumoProjetoEscolhe
      && ['aguardando_aprovacao_sede', 'em_cotacao', 'aguardando_cotacao', 'aguardando_escolha_orcamento', 'aguardando_aprovacao_unidade'].includes(pedido.status))
    || (assinaOrcamento && cotacaoProjeto && pedido.status === 'aguardando_aprovacao_sede')
    || (unidade && consumoProjetoEscolhe && !pedidoSede
      && ['aguardando_escolha_orcamento', 'aguardando_aprovacao_unidade'].includes(pedido.status))
  );
  const podeLancarCotacao = !orcamentosTravados && (
    (sede && cotacaoSede && !terminal)
    || (unidade && cotacaoProjeto && ['rascunho', 'em_cotacao', 'aguardando_cotacao'].includes(pedido.status))
    || hortifrutiAberto
  );
  const podePedirCotacaoEmail = !orcamentosTravados && podeDispararEmailCompras && (
    (sede && cotacaoSede
      && ['aguardando_cotacao', 'em_cotacao', 'aguardando_escolha_orcamento', 'aguardando_aprovacao_unidade', 'aguardando_aprovacao_sede', 'aprovado'].includes(pedido.status))
    || (unidade && cotacaoProjeto
      && ['rascunho', 'em_cotacao', 'aguardando_cotacao'].includes(pedido.status))
  ) && !terminal;
  const podeLiberarEscolha = !orcamentosTravados
    && sede
    && cotacaoSede
    && ['aguardando_cotacao', 'em_cotacao'].includes(pedido.status)
    && Number(pedido.orcamentos_com_anexo || 0) >= 1
    && (
      pedido.tipo === 'consumo'
      || Number(pedido.orcamentos_com_anexo || 0) < Number(pedido.min_orcamentos_recomendados || 3)
    );
  const podeEncerrar = pedido.status === 'enviado_fornecedor' && (sede || (unidade && !pedidoSede));
  const podeReabrir = pedido.pode_reabrir && pedido.fechado_por_id === usuarioId;
  const podeReabrirAprovado = sede && pedido.pode_reabrir_aprovado;
  const pedidoCompra = (pedido.anexos || []).find((a) => a.tipo === 'pedido_compra');
  const emailPedidoCompraEnviado = Boolean(pedido.email_pedido_compra_enviado);
  const consumoEscolhidoAguardandoEnvio = pedido.tipo === 'consumo'
    && pedido.status === 'aguardando_aprovacao_unidade'
    && (pedido.cotacoes || []).some((c) => c.escolhida);
  const podeEnviarPedidoCompra = podeDispararEmailCompras
    && (
      ['aprovado', 'enviado_fornecedor'].includes(pedido.status)
      || (sede && consumoEscolhidoAguardandoEnvio)
    )
    && (sede || (cotacaoProjeto && unidade && !pedidoSede));
  const orcamentoAssinadoPelaSede = ['aprovado', 'enviado_fornecedor', 'recebido'].includes(pedido.status);
  const contratosPedido = (pedido.anexos || []).filter((a) => a.classe_documento === 'contrato');
  const notasFiscaisPedido = (pedido.notas_fiscais || []).filter((nf) => nf.tipo_nf !== 'boleto');
  const maiorParcelaComDocumento = Math.max(
    0,
    ...(pedido.pagamento_parcelas || []).filter((p) => p.paga).map((p) => Number(p.numero) || 0),
  );
  const mostraPassoContrato = segueInfra && (orcamentoAssinadoPelaSede || contratosPedido.length > 0);
  const passoContratoOk = !segueInfra || Boolean(pedido.compra_liberada);
  const compraJaExecutada = segueInfra && Boolean(pedido.compra_executada);
  const podeDocumentosFinais = podeEncerrar && (!segueInfra || Boolean(pedido.compra_executada));
  const podeDecidirContrato = mostraPassoContrato
    && !compraJaExecutada
    && !terminal
    && !consultaGlobal
    && (unidade || manutencao)
    && !pedido.contrato_pendente
    && !pedido.contrato_assinado;
  const fornecedoresSolicitacao = (pedido.fornecedores_solicitacao || []).filter((f) => f.id);
  const idsSolicitacao = new Set(fornecedoresSolicitacao.map((f) => f.id));
  const fornecedoresOutros = fornecedoresCotacao.filter((f) => !idsSolicitacao.has(f.id));
  const filtrarLancamento = (lista) => {
    if (!buscaFornecedorLancamento.trim()) return lista;
    const ids = new Set(sugerirFornecedoresBusca(lista, buscaFornecedorLancamento, 80).map((f) => f.id));
    return lista.filter((f) => ids.has(f.id));
  };
  const fornecedoresSolicitacaoFilt = filtrarLancamento(fornecedoresSolicitacao);
  const fornecedoresOutrosFilt = filtrarLancamento(fornecedoresOutros);

  const promptMotivo = (titulo) => {
    const valor = window.prompt(titulo);
    if (!valor?.trim()) return null;
    return valor.trim();
  };

  const fecharModalEmail = () => {
    if (enviandoEmail) return;
    setModalEmail(null);
    setRascunhoEmail({ assunto: '', corpo: '', aviso: '', carregando: false, erro: '' });
  };

  const abrirModalEmail = async (modo) => {
    setErro('');
    setOk('');
    if (hortifrutiSemOrcamentoEscolhido(pedido) && modoEmailPedeFornecedorEnvio(modo)) {
      setFornecedorEnvioId(inferirFornecedorEnvioId(fornecedoresCotacao, pedido.eventos));
    } else {
      setFornecedorEnvioId('');
    }
    setModalEmail({ modo });
    setRascunhoEmail({ assunto: '', corpo: '', aviso: '', carregando: true, erro: '' });
    try {
      const tipo = modo === 'cotacao' ? 'cotacao' : 'pedido_compra';
      const data = await comprasRascunhoEmail(pedido.id, tipo);
      setRascunhoEmail({
        assunto: data.assunto || '',
        corpo: data.corpo || '',
        aviso: data.assinatura?.aviso || '',
        carregando: false,
        erro: '',
      });
    } catch (err) {
      setRascunhoEmail({
        assunto: '',
        corpo: '',
        aviso: '',
        carregando: false,
        erro: err.response?.data?.detail || err.message || 'Não foi possível carregar o texto do e-mail.',
      });
    }
  };

  const confirmarEnvioEmail = async () => {
    if (!modalEmail?.modo || enviandoEmail) return;
    const corpo = String(rascunhoEmail.corpo || '').trim();
    if (!corpo) {
      setRascunhoEmail((prev) => ({ ...prev, erro: 'Informe o texto do e-mail.' }));
      return;
    }
    setEnviandoEmail(true);
    setRascunhoEmail((prev) => ({ ...prev, erro: '' }));
    try {
      if (modalEmail.modo === 'cotacao') {
        const res = await comprasSolicitarCotacao(pedido.id, fornecedoresCotacaoIds, corpo);
        const enviados = res.enviados || [];
        const falhas = res.falhas || [];
        if (res.pedido) setPedido(res.pedido);
        setFornecedoresCotacaoIds([]);
        setBuscaFornecedorCotacao('');
        if (!enviados.length) {
          throw new Error(falhas[0]?.erro || 'Nenhum e-mail enviado.');
        }
        const nomesOk = enviados.map((e) => e.nome).filter(Boolean);
        const de = res.remetente ? `\n\nRemetente: ${res.remetente}` : '';
        let textoAlerta = `Cotações enviadas com sucesso para:\n\n${nomesOk.map((n) => `• ${n}`).join('\n')}${de}`;
        if (falhas.length) {
          const nomesFail = falhas.map((f) => `${f.nome}${f.erro ? ` (${f.erro})` : ''}`);
          textoAlerta += `\n\nNão enviadas:\n${nomesFail.map((n) => `• ${n}`).join('\n')}`;
        }
        window.alert(textoAlerta);
        setOk(
          falhas.length
            ? `Cotações enviadas para ${nomesOk.join(', ')}. Algumas falharam — veja o aviso.`
            : `Cotações enviadas com sucesso para: ${nomesOk.join(', ')}.`,
        );
      } else {
        if (
          modalEmail.modo === 'pedido_compra'
          && (pedido.status === 'aprovado' || consumoEscolhidoAguardandoEnvio)
        ) {
          await comprasEnviar(pedido.id);
        } else if (modalEmail.modo === 'pedido_compra' && !pedidoCompra) {
          await comprasGerarPedidoCompra(pedido.id);
        }
        const semOrcamentoEscolhido = hortifrutiSemOrcamentoEscolhido(pedido);
        if (
          modoEmailPedeFornecedorEnvio(modalEmail.modo)
          && semOrcamentoEscolhido
          && !fornecedorEnvioId
        ) {
          throw new Error('Escolha o fornecedor que vai receber o pedido.');
        }
        const res = await comprasEnviarEmailFornecedor(
          pedido.id,
          corpo,
          semOrcamentoEscolhido ? fornecedorEnvioId : undefined,
        );
        if (!res?.enviado) {
          throw new Error(res?.erro || 'Falha no e-mail ao fornecedor.');
        }
        const reenvio = modalEmail.modo === 'reenvio';
        window.alert(
          `Pedido de compra ${reenvio ? 'reenviado' : 'enviado'} com sucesso para:\n\n${res.destinatario || 'fornecedor'}${
            res.orcamento_assinado_anexado
              ? '\n\nO orçamento assinado pela Sede também foi anexado.'
              : ''
          }${reenvio ? '' : '\n\nAgora você pode baixar o PDF.'}`,
        );
        setOk(reenvio ? 'E-mail reenviado com sucesso.' : 'Pedido de compra enviado com sucesso ao fornecedor.');
      }
      setModalEmail(null);
      setRascunhoEmail({ assunto: '', corpo: '', aviso: '', carregando: false, erro: '' });
      await carregar();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const mensagem = typeof detail === 'string'
        ? detail
        : (detail?.message || err.message || 'Não foi possível enviar o e-mail.');
      setRascunhoEmail((prev) => ({ ...prev, erro: mensagem }));
      setErro(mensagem);
    } finally {
      setEnviandoEmail(false);
    }
  };

  const itemAvulso = Boolean(item.descricao.trim()) && !item.catalogo_item_id;
  const itensBuscaPedido = itensConsumoDoSplitPedido(itensConsumo, pedido);
  const sugestoesItem = sugerirItensConsumo(itensBuscaPedido, item.descricao);
  const rotuloSplit = pedido.categoria_split_nome || '';
  const buscaRestritaCategoria = Boolean(pedido.grupo_split_id && rotuloSplit);

  const payloadDasLinhas = (linhas) => (linhas || []).map((linha) => ({
    id: linha.id || null,
    descricao: linha.descricao,
    quantidade: linha.quantidade,
    unidade_medida: linha.unidade_medida,
    embalagem: linha.embalagem || null,
    marca_preferencial: linha.marca_preferencial,
    categoria_id: linha.categoria_id,
    catalogo_item_id: linha.catalogo_item_id,
  }));

  const linhasItensAtuais = () => (
    listaItensLocal.current || payloadDasLinhas(pedidoRef.current?.itens || pedido.itens)
  );

  const salvarItensPedido = (linhas, mensagemOk = '') => {
    listaItensLocal.current = linhas;
    gravandoItens.current += 1;
    setSalvandoItem(true);
    const tarefa = filaItens.current.then(async () => {
      const id = pedidoRef.current?.id || pedido.id;
      const dados = await comprasSalvarItens(id, linhas);
      if (listaItensLocal.current === linhas) {
        listaItensLocal.current = null;
        setPedido(dados);
        pedidoRef.current = dados;
      }
      if (mensagemOk) setOk(mensagemOk);
      setErro('');
      return true;
    }).catch((err) => {
      if (listaItensLocal.current === linhas) listaItensLocal.current = null;
      const detail = err.response?.data?.detail;
      const mensagem = typeof detail === 'string'
        ? detail
        : (detail?.message || err.message || 'Não foi possível salvar os itens.');
      setErro(mensagem);
      setOk('');
      return false;
    }).finally(() => {
      gravandoItens.current = Math.max(0, gravandoItens.current - 1);
      if (gravandoItens.current === 0) setSalvandoItem(false);
    });
    filaItens.current = tarefa.then(() => undefined, () => undefined);
    return tarefa;
  };

  const linhasPedidoCom = (novo) => [...linhasItensAtuais(), novo];

  const marcarDesfazerItens = () => {
    setDesfazerItens({ linhas: linhasItensAtuais() });
  };

  const desfazerUltimaAlteracaoItens = async () => {
    if (!desfazerItens) return;
    const gravou = await salvarItensPedido(
      desfazerItens.linhas,
      'Última alteração nos itens foi desfeita.',
    );
    if (gravou) setDesfazerItens(null);
  };

  const retirarItem = async (itemId) => {
    marcarDesfazerItens();
    await salvarItensPedido(
      linhasItensAtuais().filter((linha) => linha.id !== itemId),
      'Item retirado do pedido.',
    );
  };

  const corrigirUnidadeItem = async (itemId) => {
    marcarDesfazerItens();
    await salvarItensPedido(
      linhasItensAtuais().map((linha) => (
        linha.id === itemId ? { ...linha, unidade_medida: 'un' } : linha
      )),
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
    const gravou = await salvarItensPedido(
      linhasItensAtuais().map((itemLinha) => (
        itemLinha.id === linha.id ? { ...itemLinha, [campo]: novo || null } : itemLinha
      )),
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
    if (linha.catalogo_item_id && novo && novo !== cadastroAtual) {
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
    if (!item.catalogo_item_id) {
      setErro('Este item não está no catálogo. Cadastre-o na lista de itens e volte a este pedido — o que já foi digitado continua aqui.');
      setOk('');
      return;
    }

    let catalogo = {
      catalogo_item_id: item.catalogo_item_id || null,
      descricao,
      unidade_medida: item.unidade_medida || null,
      embalagem: item.embalagem || null,
      marca_preferencial: item.marca_preferencial || null,
      categoria_id: item.categoria_id || null,
    };
    let mensagemOk = 'Item incluído.';

    if (!catalogo.catalogo_item_id
      && sugerirItensConsumo(itensConsumoDoSplitPedido(itensConsumo, pedido), descricao).length > 0) {
      setErro('Há itens parecidos no cadastro. Escolha um da lista para não duplicar.');
      setOk('');
      return;
    }

    if (!catalogo.catalogo_item_id && podeCadastrarMestre && cadastrarNoCatalogo) {
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

    if (incluindoItem.current) return;
    incluindoItem.current = true;
    setSalvandoItem(true);
    marcarDesfazerItens();
    let gravou;
    try {
      gravou = await salvarItensPedido(linhasPedidoCom({
        descricao: catalogo.descricao,
        quantidade: Number(item.quantidade || 1),
        unidade_medida: (item.unidade_medida || '').trim() || unidadeParaPedido(catalogo),
        embalagem: (item.embalagem || catalogo.embalagem || '').trim() || null,
        marca_preferencial: catalogo.marca_preferencial,
        categoria_id: catalogo.categoria_id,
        catalogo_item_id: catalogo.catalogo_item_id,
      }), mensagemOk);
    } finally {
      incluindoItem.current = false;
      if (gravandoItens.current === 0) setSalvandoItem(false);
    }
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
          title={pedido.titulo
            ? pedido.titulo
            : `Pedido · ${rotuloTipoPedido(pedido.tipo)}${pedido.categoria_split_nome ? ` · ${pedido.categoria_split_nome}` : ''}${pedido.grupo_codigo ? ` · ${pedido.grupo_codigo}` : ''}`}
          subtitle={[
            rotuloTipoPedido(pedido.tipo),
            rotuloStatusPedidoLista(pedido),
            pedido.competencia,
            typeof pedido.qtd_orcamentos === 'number'
              ? `${pedido.qtd_orcamentos} orçamento(s)`
              : null,
          ].filter(Boolean).join(' · ')}
          icon={<ShoppingCart className="h-5 w-5" />}
          backTo="/compras"
        />
        {pedido.fonte_custo_rotulo && (
          <div className="shrink-0 px-4 pt-3 md:px-6">
            <div
              className={`rounded-xl border px-4 py-3 ${
                pedido.fonte_custo_rotulo === 'Custo indireto'
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-sky-300 bg-sky-50 text-sky-950'
              }`}
              role="status"
            >
              <p className="text-xs font-bold uppercase tracking-wide">Fonte da verba</p>
              <p className="text-lg font-black leading-tight">{pedido.fonte_custo_rotulo}</p>
              {pedido.fonte_recurso_nome && pedido.fonte_recurso_nome !== pedido.fonte_custo_rotulo ? (
                <p className="mt-0.5 text-sm">{pedido.fonte_recurso_nome}</p>
              ) : null}
            </div>
          </div>
        )}
        {(erro || ok) && (
          <div className="shrink-0 space-y-2 px-4 pt-3 md:px-6">
            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {erro}
              </div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
                {ok}
              </div>
            )}
          </div>
        )}
        {caixaSuprimentos && pedido.status === 'recebido' && (
          <div className="shrink-0 px-4 pt-3 md:px-6">
            <div
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                pedido.nf_impressa
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-200 bg-amber-50 text-amber-950'
              }`}
              role="status"
            >
              <p>
                {pedido.nf_impressa
                  ? `A nota fiscal deste pedido já foi impressa${pedido.nf_impressa_em ? ` em ${quandoOperacional(pedido.nf_impressa_em)}` : ''}.`
                  : 'A nota fiscal deste pedido ainda não foi impressa.'}
              </p>
              <PremiumButton
                type="button"
                variant={pedido.nf_impressa ? 'secondary' : 'primary'}
                onClick={imprimirNfSuprimentos}
              >
                {pedido.nf_impressa ? 'Imprimir novamente' : 'Imprimir NF'}
              </PremiumButton>
            </div>
          </div>
        )}
        <ScrollArea>
          <div className="space-y-4 p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <PremiumBadge variant={varianteBadgeStatusPedido(pedido.status)}>
                {rotuloStatusPedidoLista(pedido)}
              </PremiumBadge>
              {(pedido.cotacao_sede || pedido.cotacao_projeto) && statusMostraProgressoOrcamentos(pedido.status) ? (
                <span className="text-xs font-semibold text-slate-500">
                  Orçamentos com PDF: {pedido.orcamentos_com_anexo ?? 0}/{pedido.min_orcamentos_recomendados || 3}
                </span>
              ) : null}
            </div>
            {podeLiberarEscolha ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3">
                <div className="min-w-0 flex-1 text-sm text-sky-950">
                  <p className="font-bold">
                    {pedido.tipo === 'consumo' ? 'Ok para o projeto escolher' : 'Liberar para escolha'}
                  </p>
                  <p className="mt-0.5 text-xs text-sky-800">
                    {pedido.tipo === 'consumo'
                      ? `Há ${pedido.orcamentos_com_anexo} orçamento(s) anexado(s). O ok libera o projeto para escolher e aprovar.`
                      : `Há ${pedido.orcamentos_com_anexo} orçamento(s) anexado(s). O ideal são ${pedido.min_orcamentos_recomendados || 3}. Se já bastam, libere para marcar o pedido como «Pronto para escolher».`}
                  </p>
                </div>
                <PremiumButton
                  type="button"
                  onClick={() => {
                    const min = pedido.min_orcamentos_recomendados || 3;
                    const n = pedido.orcamentos_com_anexo || 0;
                    if (!window.confirm(
                      pedido.tipo === 'consumo'
                        ? `Dar ok e liberar o projeto para escolher, com ${n} orçamento(s)?`
                        : `Liberar escolha com ${n} orçamento(s)? O recomendado são ${min}.`,
                    )) return;
                    agir(
                      () => comprasLiberarEscolha(pedido.id),
                      pedido.tipo === 'consumo'
                        ? 'Ok registrado. O projeto pode escolher e aprovar o orçamento.'
                        : 'Pedido pronto para escolher o orçamento.',
                    );
                  }}
                >
                  Liberar para escolha
                </PremiumButton>
              </div>
            ) : null}
            {Boolean((pedido.anexos || []).some((a) => a.tipo === 'orcamento_assinado')) && (
              <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-900">
                  Orçamento assinado pela Sede
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  A Sede escolheu o orçamento vencedor e carimbou a assinatura digital no PDF.
                  Esse arquivo também vai anexado automaticamente no e-mail do pedido de compra ao fornecedor.
                  Você pode visualizar o PDF marcado como
                  {' '}
                  <span className="font-semibold">Assinado</span>
                  {' '}
                  abaixo.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(pedido.anexos || [])
                    .filter((a) => a.tipo === 'orcamento_assinado')
                    .map((anexo) => (
                      <button
                        key={anexo.id}
                        type="button"
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                        onClick={() => setModalAnexo(anexo)}
                      >
                        Ver PDF assinado
                      </button>
                    ))}
                </div>
              </div>
            )}
            {cotacaoProjeto ? (
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-white p-3">
                {STEPS_COTACAO_PROJETO.map((step) => {
                  const atual = etapaCotacaoProjeto(pedido.status);
                  const ativo = step.n <= atual;
                  return (
                    <span
                      key={step.n}
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        ativo ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {step.n}. {step.rotulo}
                    </span>
                  );
                })}
              </div>
            ) : null}
            {cotacaoProjeto ? (
              <SectionCard title="Cabeçalho">
                <dl className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Justificativa</dt><dd>{pedido.justificativa || '—'}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Urgência</dt><dd>{pedido.urgencia || 'normal'}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Data desejada</dt><dd>{pedido.data_desejada ? formatarDataBr(pedido.data_desejada) : '—'}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase text-slate-500">Local</dt><dd>{pedido.local_texto || pedido.instituicao_nome || '—'}</dd></div>
                  {pedido.tipo === 'manutencao' ? (
                    <>
                      <div><dt className="text-xs font-semibold uppercase text-slate-500">Tipo manutenção</dt><dd>{pedido.tipo_manutencao || '—'}</dd></div>
                      <div className="md:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Defeito</dt><dd>{pedido.defeito || '—'}</dd></div>
                    </>
                  ) : null}
                  {pedido.tipo === 'servico' ? (
                    <div className="md:col-span-2"><dt className="text-xs font-semibold uppercase text-slate-500">Escopo</dt><dd>{pedido.escopo_servico || '—'}</dd></div>
                  ) : null}
                </dl>
              </SectionCard>
            ) : null}
            {segueInfra ? (
              <SectionCard title="Informações do pedido">
                <dl className="grid gap-2 text-sm text-slate-700">
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">
                      {pedido.tipo === 'imobilizado' ? 'Descrição detalhada do bem' : 'O que será comprado'}
                    </dt>
                    <dd className="whitespace-pre-wrap">{pedido.info_pedido || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Fornecedor</dt>
                    <dd>{pedido.fornecedor_pedido_nome || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase text-slate-500">Informações do fornecedor</dt>
                    <dd className="whitespace-pre-wrap">{pedido.fornecedor_pedido_info || '—'}</dd>
                  </div>
                </dl>
              </SectionCard>
            ) : null}
            {!segueInfra && (ehRascunho || Boolean((pedido.observacao || '').trim())) ? (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-wide text-amber-950">
                  Observação do pedido
                </p>
                <p className="mt-0.5 text-xs text-amber-800">
                  {pedido.categoria_split_nome
                    ? 'Texto do projeto; repetido em todos os pedidos deste grupo (por categoria).'
                    : 'Visível para a Sede em todo o grupo quando o pedido for dividido por categoria.'}
                </p>
                {ehRascunho && !consultaGlobal ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900"
                      rows={3}
                      value={obsPedido}
                      onChange={(e) => setObsPedido(e.target.value)}
                      placeholder="Ex.: entregar pela manhã; preferência de marca; restrição de fornecedor…"
                    />
                    <PremiumButton
                      type="button"
                      variant="secondary"
                      onClick={() => agir(
                        () => comprasAtualizarRascunho(pedido.id, {
                          observacao: obsPedido.trim() || null,
                        }),
                        'Observação salva.',
                      )}
                    >
                      Salvar observação
                    </PremiumButton>
                  </div>
                ) : (
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium text-amber-950">
                    {pedido.observacao}
                  </p>
                )}
              </div>
            ) : null}
            {desfazerItens && podeEditarItens && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                <span>Última alteração nos itens ainda pode ser desfeita.</span>
                <PremiumButton variant="secondary" type="button" onClick={desfazerUltimaAlteracaoItens}>
                  Desfazer
                </PremiumButton>
              </div>
            )}
            {pedido.aviso_alteracao_itens && !terminal && (
              <div
                className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                  pedido.precisa_revisar_cotacao
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <p className="min-w-0 flex-1">{pedido.aviso_alteracao_itens}</p>
                {pedido.precisa_revisar_cotacao && !consultaGlobal ? (
                  <PremiumButton
                    type="button"
                    variant="secondary"
                    onClick={() => agir(
                      () => comprasConfirmarRevisaoItens(pedido.id),
                      'Alteração de itens conferida.',
                    )}
                  >
                    Ok, conferi
                  </PremiumButton>
                ) : (
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Conferido
                  </span>
                )}
              </div>
            )}
            {pedido.aviso_cotacoes && !terminal && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {pedido.aviso_cotacoes}
              </div>
            )}

            {!segueInfra && (
            <SectionCard title="Itens">
              <div className="px-5 py-4">
              {podeEditarItens && (
                <form className="mb-4 grid gap-2 md:grid-cols-8" onSubmit={incluirItem}>
                  <label className="md:col-span-4">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Novo item</span>
                    <ComprasItemTypeahead
                      className="w-full"
                      itens={itensBuscaPedido}
                      value={item.descricao}
                      required
                      placeholder={
                        buscaRestritaCategoria
                          ? `Buscar em «${rotuloSplit}»`
                          : 'Digite o item — os resultados aparecem na hora'
                      }
                      onChange={(valor) => setItem((a) => ({ ...a, descricao: valor, catalogo_item_id: '' }))}
                      onCadastrar={(texto) => setModalNovoItem({ descricao: texto })}
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
                  </label>
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
                    <PremiumButton type="submit" className="w-full" disabled={salvandoItem}>
                      {salvandoItem ? 'Incluindo…' : 'Incluir item'}
                    </PremiumButton>
                  </div>
                  {buscaRestritaCategoria ? (
                    <p className="md:col-span-8 text-xs text-slate-500">
                      Este pedido é só de «{rotuloSplit}». Itens de outra categoria ficam no pedido do mesmo grupo.
                    </p>
                  ) : null}
                  {item.catalogo_item_id ? (
                    <p className="md:col-span-8 text-xs text-slate-500">
                      Neste pedido: {item.quantidade || 1} {item.unidade_medida || 'un'} de {item.descricao}
                      {item.embalagem ? ` (cada volume: ${item.embalagem})` : ''}.
                    </p>
                  ) : itemAvulso ? (
                    <div className="md:col-span-8 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                      <p>Este item não está no catálogo. Cadastre-o aqui — o pedido continua aberto.</p>
                      <button
                        type="button"
                        className="mt-2 text-sm font-semibold text-sky-800 underline"
                        onClick={() => setModalNovoItem({ descricao: item.descricao.trim() })}
                      >
                        Cadastrar este item
                      </button>
                    </div>
                  ) : itemAvulso && sugestoesItem.length > 0 ? (
                    <p className="md:col-span-8 text-xs text-slate-500">
                      Há itens no cadastro. Escolha um da lista para não criar outro parecido.
                    </p>
                  ) : (
                    <p className="md:col-span-8 text-xs text-slate-500">
                      Comece a digitar: o cadastro sugere na hora.
                      {podeCadastrarMestre
                        ? ' Se não existir, dá para cadastrar agora.'
                        : ' Se não existir, inclua avulso — a Sede ou ADM Pedidos cadastram no catálogo.'}
                    </p>
                  )}
                </form>
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

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {ehRascunho && podeEditarItens
                    ? 'Monte a lista abaixo. No rascunho as inclusões não entram na timeline — use Salvar e, quando estiver pronto, Enviar pedido.'
                    : podeEditarItens
                      ? 'Itens editáveis até o e-mail de compra ao fornecedor. Alterações após o envio ficam no histórico.'
                      : 'Itens bloqueados após o envio do pedido de compra ao fornecedor.'}
                </p>
                {ehRascunho && podeEditarItens ? (
                  <PremiumButton
                    type="button"
                    variant="secondary"
                    onClick={() => salvarItensPedido(linhasItensAtuais(), 'Rascunho salvo.')}
                  >
                    Salvar rascunho
                  </PremiumButton>
                ) : null}
              </div>

              {(pedido.itens || []).length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum item neste pedido.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-2 py-2">Qtd neste pedido</th>
                        <th className="px-2 py-2">Unidade</th>
                        <th className="px-2 py-2">Item</th>
                        <th className="px-2 py-2">Embalagem</th>
                        <th className="px-2 py-2">Marca</th>
                        {podeEditarItens ? <th className="px-2 py-2" /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {(pedido.itens || []).map((linha) => {
                        const confusa = podeEditarItens && pedidoItemUnidadeConfusa(linha);
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
                              {podeEditarItens ? (
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
                              ) : (
                                linha.embalagem || '—'
                              )}
                            </td>
                            <td className="px-2 py-2.5">
                              {podeEditarItens ? (
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
                                  placeholder="Opcional"
                                  className="w-full min-w-[7rem] rounded-xl border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-slate-400"
                                  aria-label={`Marca de ${linha.descricao}`}
                                />
                              ) : (
                                linha.marca_preferencial || '—'
                              )}
                            </td>
                            {podeEditarItens ? (
                              <td className="px-2 py-2.5 text-right">
                                <div className="flex flex-col items-end gap-1">
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
              </div>
            </SectionCard>
            )}

            <SectionCard title={hortifrutiDireto ? 'Cotações, Orçamentos ou Arquivos' : 'Cotações e orçamentos'}>
              <p className="mb-2 text-sm font-semibold text-slate-800">
                Orçamentos anexados: {pedido.qtd_orcamentos ?? (pedido.cotacoes || []).length}
              </p>
              {sede && cotacaoSede ? (
                <p className="mb-3 text-xs text-slate-500">
                  Pedir cotação por e-mail e registrar o orçamento que voltou (valor + PDF) são passos distintos.
                </p>
              ) : cotacaoProjeto && !sede ? (
                <p className="mb-3 text-xs text-slate-500">
                  Peça cotação por e-mail (caixa do projeto) e anexe os orçamentos recebidos (valor + PDF).
                </p>
              ) : hortifrutiDireto ? (
                <p className="mb-3 text-xs text-slate-500">
                  O projeto e a Sede podem anexar cotações, orçamentos ou outros arquivos. Os dois lados visualizam e baixam.
                </p>
              ) : !sede && cotacaoSede ? (
                <p className="mb-3 text-xs text-slate-500">
                  A Sede lança as cotações deste pedido. Aqui você acompanha quantos orçamentos já foram anexados.
                </p>
              ) : null}

              {podePedirCotacaoEmail && (
                <div className="mb-4 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                  <p className="text-sm font-semibold text-slate-800">1. Pedir cotação por e-mail</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Selecione os fornecedores (recomendado 3 ou mais). Cada um recebe um e-mail só com o endereço dele no campo Para — nunca vê os demais.
                    Lista filtrada para <strong>{rotuloSegmentoCatalogo(segmentoCotacao)}</strong>
                    {' '}(sem categoria no cadastro continua aparecendo em todos os tipos).
                  </p>
                  {cotacaoProjeto ? (
                    pedido.email_adm_compras ? (
                      <p className="mt-2 text-xs text-violet-900">
                        Remetente (caixa do projeto):{' '}
                        <span className="font-semibold">{pedido.email_adm_compras}</span>
                      </p>
                    ) : (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                        Cadastre o e-mail administrativo (Compras) em Organização → projeto antes de enviar o pedido de orçamento.
                      </p>
                    )
                  ) : (
                    <p className="mt-2 text-xs text-violet-900">
                      Remetente: caixa da Sede (Compras / suprimentos).
                    </p>
                  )}
                  {fornecedoresCotacao.length === 0 ? (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                      Nenhum fornecedor elegível para este tipo de pedido. Cadastre categorias no fornecedor ou deixe sem categoria para ele aparecer em todos.
                    </p>
                  ) : (
                  <>
                  <div className="relative mt-3">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={buscaFornecedorCotacao}
                      onChange={(e) => setBuscaFornecedorCotacao(e.target.value)}
                      placeholder="Digite o nome ou e-mail — resultados desde a 1ª letra"
                      autoComplete="off"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                    />
                  </div>
                  {fornecedoresSelecionadosCotacao.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {fornecedoresSelecionadosCotacao.map((f) => {
                        const email = (f.email || f.email_empresa || '').trim();
                        return (
                          <li key={`sel-${f.id}`} className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                            <span>
                              <span className="font-medium text-slate-800">{f.nome}</span>
                              <span className="block text-xs text-slate-500">{email || 'Sem e-mail'}</span>
                            </span>
                            <button
                              type="button"
                              className="text-xs font-semibold text-emerald-800 underline"
                              onClick={() => setFornecedoresCotacaoIds((prev) => prev.filter((id) => id !== f.id))}
                            >
                              Retirar
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto text-sm">
                    {!buscaFornecedorCotacao.trim() ? (
                      <li className="px-2 py-1.5 text-xs text-slate-500">
                        Digite para buscar entre {fornecedoresCotacao.length} fornecedor(es) elegível(is).
                      </li>
                    ) : fornecedoresCotacaoFiltrados.length === 0 ? (
                      <li className="px-2 py-1.5 text-xs text-slate-500">Nenhum fornecedor com «{buscaFornecedorCotacao.trim()}».</li>
                    ) : (
                      fornecedoresCotacaoFiltrados.map((f) => {
                        const email = (f.email || f.email_empresa || '').trim();
                        const checked = fornecedoresCotacaoIds.includes(f.id);
                        return (
                          <li key={f.id}>
                            <label className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 ${email ? 'hover:bg-white/80' : 'opacity-50'}`}>
                              <input
                                type="checkbox"
                                className="mt-1"
                                disabled={!email}
                                checked={checked}
                                onChange={() => {
                                  setFornecedoresCotacaoIds((prev) => (
                                    checked ? prev.filter((id) => id !== f.id) : [...prev, f.id]
                                  ));
                                }}
                              />
                              <span>
                                <span className="font-medium text-slate-800">{f.nome}</span>
                                <span className="block text-xs text-slate-500">
                                  {email || 'Sem e-mail cadastrado'}
                                  {fornecedorSemCategoria(f) ? ' · sem categoria (todos os tipos)' : ''}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })
                    )}
                  </ul>
                  </>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <PremiumButton
                      disabled={
                        fornecedoresCotacaoIds.length < 1
                        || (cotacaoProjeto && !pedido.email_adm_compras)
                      }
                      onClick={() => {
                        setErro('');
                        setOk('');
                        abrirModalEmail('cotacao');
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Mail size={16} />
                        Enviar pedido de cotação
                      </span>
                    </PremiumButton>
                    <span className="text-xs text-slate-500">
                      {fornecedoresCotacaoIds.length} selecionado(s). O texto do e-mail abre para revisão antes do envio.
                      {buscaFornecedorCotacao.trim()
                        ? ` · ${fornecedoresCotacaoFiltrados.length} na busca`
                        : ` · ${fornecedoresCotacao.length} elegível(is)`}
                    </span>
                  </div>
                </div>
              )}

              {(sede || cotacaoProjeto) ? (
                <p className="mb-2 text-sm font-semibold text-slate-800">
                  {podePedirCotacaoEmail ? '2. Registrar orçamentos recebidos' : 'Orçamentos lançados'}
                </p>
              ) : (
                <p className="mb-2 text-sm font-semibold text-slate-800">Orçamentos recebidos</p>
              )}
              {sede && cotacaoSede ? (
                <p className="mb-2 text-xs text-slate-500">
                  Registre o valor e os PDFs devolvidos. Pode anexar quantos arquivos forem, do mesmo fornecedor ou de vários, neste pedido.
                </p>
              ) : (
                <p className="mb-2 text-xs text-slate-500">
                  Pode anexar quantos orçamentos forem, de um ou de todos os fornecedores.
                </p>
              )}
              <ul className="mb-3 space-y-2 text-sm">
                {cotacoesComEscolhidaPrimeiro(pedido.cotacoes).map((c) => (
                  <li
                    key={c.id}
                    className={`rounded-xl border px-3 py-2 ${
                      c.escolhida ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={c.escolhida ? 'font-bold text-emerald-950' : ''}>
                        {c.fornecedor_nome} · {moneyCentavos(c.valor_centavos)}
                        {c.escolhida ? ' · Escolhida' : ''}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(podeEscolherCotacao) && !c.escolhida && (
                          <PremiumButton onClick={() => agir(() => comprasEscolherCotacao(pedido.id, c.id))}>
                            Escolher
                          </PremiumButton>
                        )}
                        {podeEscolherCotacao && c.escolhida && (
                          <PremiumButton
                            variant="secondary"
                            onClick={() => agir(() => comprasRevogarEscolhaCotacao(pedido.id), 'Escolha revogada.')}
                          >
                            Revogar escolha
                          </PremiumButton>
                        )}
                        {!terminal && podeRemoverOrcamento && (
                          <PremiumButton
                            variant="secondary"
                            onClick={async () => {
                              if (!window.confirm(`Remover o orçamento de ${c.fornecedor_nome}? Os PDFs anexados também serão removidos.`)) return;
                              const motivo = promptMotivo('Motivo da remoção (opcional):') ?? '';
                              await agir(() => comprasDesativarCotacao(pedido.id, c.id, motivo || null), 'Orçamento removido.');
                            }}
                          >
                            Remover
                          </PremiumButton>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 space-y-2">
                      {anexosDaCotacao(pedido.anexos, c.id).map((anexo) => (
                        <div
                          key={anexo.id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                            anexo.tipo === 'orcamento_assinado'
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <p className="min-w-0 truncate text-xs font-medium text-slate-800">
                            {anexo.tipo === 'orcamento_assinado' ? '✓ Assinado — ' : ''}
                            {anexo.nome_arquivo || 'Arquivo'}
                          </p>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                              onClick={() => setModalAnexo(anexo)}
                            >
                              Visualizar
                            </button>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                              onClick={() => comprasBaixarAnexo(
                                pedido.id,
                                anexo.id,
                                anexo.nome_arquivo,
                              ).catch(() => setErro('Não foi possível baixar o orçamento.'))}
                            >
                              <FileText size={14} />
                              Baixar
                            </button>
                            {!terminal && podeRemoverOrcamento && anexo.tipo !== 'orcamento_assinado' && (
                              <button
                                type="button"
                                className="rounded px-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                                title="Remover este PDF"
                                onClick={async () => {
                                  if (!window.confirm(`Remover o arquivo ${anexo.nome_arquivo}?`)) return;
                                  await agir(() => comprasRemoverAnexo(pedido.id, anexo.id), 'Anexo removido.');
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {!terminal && podeRemoverOrcamento && (sede || cotacaoProjeto || hortifrutiAberto) && (
                        <label className="inline-flex cursor-pointer text-xs font-semibold text-slate-600">
                          + Anexar PDFs
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            multiple
                            className="hidden"
                            onChange={async (e) => {
                              const files = Array.from(e.target.files || []);
                              e.target.value = '';
                              if (!files.length) return;
                              await agir(async () => {
                                for (const file of files) {
                                  const fd = new FormData();
                                  fd.append('tipo', 'orcamento');
                                  fd.append('cotacao_id', c.id);
                                  fd.append('arquivo', file);
                                  await comprasAnexarArquivo(pedido.id, fd);
                                }
                              }, files.length === 1 ? 'Orçamento anexado.' : `${files.length} orçamentos anexados.`);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {(pedido.anexos || []).some((a) => a.tipo === 'orcamento' && !a.cotacao_id) && (
                <ul className="mb-3 space-y-2">
                  {(pedido.anexos || [])
                    .filter((a) => a.tipo === 'orcamento' && !a.cotacao_id)
                    .map((anexo) => (
                      <li
                        key={anexo.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <p className="min-w-0 truncate text-xs font-medium text-slate-800">
                          {anexo.nome_arquivo || 'Arquivo'}
                        </p>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                            onClick={() => setModalAnexo(anexo)}
                          >
                            Visualizar
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                            onClick={() => comprasBaixarAnexo(pedido.id, anexo.id, anexo.nome_arquivo)
                              .catch(() => setErro('Não foi possível baixar o arquivo.'))}
                          >
                            <FileText size={14} />
                            Baixar
                          </button>
                          {!terminal && podeRemoverOrcamento && (
                            <button
                              type="button"
                              className="rounded px-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                              title="Remover este arquivo"
                              onClick={async () => {
                                if (!window.confirm(`Remover o arquivo ${anexo.nome_arquivo}?`)) return;
                                await agir(() => comprasRemoverAnexo(pedido.id, anexo.id), 'Anexo removido.');
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
              {hortifrutiAberto && (
                <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                  <FileText size={16} />
                  Anexar arquivos
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (!files.length) return;
                      await agir(async () => {
                        for (const file of files) {
                          const fd = new FormData();
                          fd.append('tipo', 'orcamento');
                          fd.append('arquivo', file);
                          await comprasAnexarArquivo(pedido.id, fd);
                        }
                      }, files.length === 1 ? 'Arquivo anexado.' : `${files.length} arquivos anexados.`);
                    }}
                  />
                </label>
              )}
              {podeLancarCotacao && (
                <form
                  className="grid gap-2 md:grid-cols-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const centavos = reaisParaCentavos(cotacao.valor_reais);
                    if (centavos == null || centavos < 0) {
                      setErro('Informe um valor válido em R$.');
                      return;
                    }
                    await agir(async () => {
                      const idsAntes = new Set((pedido.cotacoes || []).map((c) => c.id));
                      const dados = await comprasCotacao(pedido.id, {
                        fornecedor_id: segueInfra ? null : (cotacao.fornecedor_id || null),
                        fornecedor_nome: cotacao.fornecedor_nome || null,
                        fornecedor_contato: cotacao.fornecedor_contato || null,
                        valor_centavos: centavos,
                      });
                      const novaId = dados.cotacao_criada_id
                        || (dados.cotacoes || []).find((c) => !idsAntes.has(c.id))?.id;
                      if (arqsCotacao.length && !novaId) {
                        throw new Error('Orçamento registrado, mas não foi possível vincular os arquivos ao fornecedor.');
                      }
                      for (const file of arqsCotacao) {
                        const fd = new FormData();
                        fd.append('tipo', 'orcamento');
                        fd.append('cotacao_id', novaId);
                        fd.append('arquivo', file);
                        await comprasAnexarArquivo(pedido.id, fd);
                      }
                    }, arqsCotacao.length > 1
                      ? `Orçamento registrado com ${arqsCotacao.length} arquivos.`
                      : 'Orçamento registrado.');
                    setCotacao({ fornecedor_id: '', valor_reais: '', fornecedor_nome: '', fornecedor_contato: '' });
                    setArqsCotacao([]);
                  }}
                >
                  {segueInfra ? null : (
                  <input
                    value={buscaFornecedorLancamento}
                    onChange={(e) => setBuscaFornecedorLancamento(e.target.value)}
                    placeholder="Buscar na lista de fornecedores…"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-5"
                  />
                  )}
                  {segueInfra ? null : (
                  <select
                    value={cotacao.fornecedor_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const lista = [...fornecedoresSolicitacao, ...fornecedoresCotacao];
                      const escolhido = lista.find((f) => f.id === id);
                      setCotacao((a) => ({
                        ...a,
                        fornecedor_id: id,
                        fornecedor_nome: escolhido?.nome || a.fornecedor_nome,
                      }));
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                  >
                    <option value="">Fornecedor cadastrado…</option>
                    {fornecedoresSolicitacaoFilt.length > 0 && (
                      <optgroup label="Solicitados por e-mail">
                        {fornecedoresSolicitacaoFilt.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </optgroup>
                    )}
                    {fornecedoresOutrosFilt.length > 0 && (
                      <optgroup label={fornecedoresSolicitacaoFilt.length ? 'Outros cadastrados' : 'Fornecedores'}>
                        {fornecedoresOutrosFilt.map((f) => (
                          <option key={f.id} value={f.id}>{f.nome}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  )}
                  <input
                    value={cotacao.fornecedor_nome}
                    onChange={(e) => setCotacao((a) => ({ ...a, fornecedor_nome: e.target.value }))}
                    placeholder={segueInfra ? 'Nome do fornecedor' : 'Ou nome avulso'}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    required={segueInfra}
                  />
                  {segueInfra ? (
                    <input
                      value={cotacao.fornecedor_contato}
                      onChange={(e) => setCotacao((a) => ({ ...a, fornecedor_contato: e.target.value }))}
                      placeholder="Contato do fornecedor"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  ) : null}
                  <input
                    value={cotacao.valor_reais}
                    onChange={(e) => setCotacao((a) => ({ ...a, valor_reais: mascararMoedaDigitando(e.target.value) }))}
                    placeholder="R$ 0,00"
                    inputMode="numeric"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    required
                  />
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    multiple
                    onChange={(e) => setArqsCotacao(Array.from(e.target.files || []))}
                    className="text-xs"
                  />
                  <PremiumButton type="submit" className="md:col-span-5 md:max-w-xs">
                    Registrar orçamento recebido
                  </PremiumButton>
                </form>
              )}
            </SectionCard>

            {!terminal && !consultaGlobal && (
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
                {(pedido.eventos || []).map((ev) => {
                  const pendente = Boolean(ev.aguardando_confirmacao);
                  const podeOk = pendente && ev.usuario_id && ev.usuario_id !== usuarioId;
                  const suprimentos = ev.lado === 'suprimentos';
                  const editando = eventoEdicao?.id === ev.id;
                  const caixa = pendente
                    ? 'border-amber-300 bg-amber-50'
                    : (suprimentos ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white');
                  return (
                    <li key={ev.id} className={`rounded-lg border px-3 py-2 ${caixa}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold uppercase ${pendente ? 'text-amber-800' : (suprimentos || ev.lado === 'infraestrutura' ? 'text-sky-800' : 'text-slate-500')}`}>
                            {ev.lado === 'infraestrutura' ? 'Infraestrutura' : (suprimentos ? 'Suprimentos' : (ev.usuario_id ? 'Projeto' : 'Sistema'))}
                            {' · '}
                            {ROTULO_EVENTO[ev.tipo] || ev.tipo}
                            {ev.criado_em ? ` · ${formatarDataHoraBr(ev.criado_em)}` : ''}
                            {pendente ? ' · aguardando ok' : ''}
                          </p>
                          {editando ? (
                            <form
                              className="mt-2 flex flex-wrap gap-2"
                              onSubmit={async (e) => {
                                e.preventDefault();
                                await agir(
                                  () => comprasEditarEvento(pedido.id, ev.id, eventoEdicao.texto),
                                  'Texto atualizado. O anterior ficou no histórico.',
                                );
                                setEventoEdicao(null);
                              }}
                            >
                              <input
                                value={eventoEdicao.texto}
                                onChange={(e) => setEventoEdicao((atual) => ({ ...atual, texto: e.target.value }))}
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                required
                              />
                              <PremiumButton type="submit">Salvar</PremiumButton>
                              <PremiumButton type="button" variant="secondary" onClick={() => setEventoEdicao(null)}>
                                Cancelar
                              </PremiumButton>
                            </form>
                          ) : (
                            ev.texto && <p className={`mt-1 ${pendente ? 'text-amber-950' : (suprimentos ? 'text-sky-950' : 'text-slate-800')}`}>{ev.texto}</p>
                          )}
                          {(ev.revisoes || []).length > 0 && (
                            <details className="mt-2 text-xs text-slate-600">
                              <summary className="cursor-pointer font-semibold">Histórico da correção</summary>
                              <ul className="mt-1 space-y-1">
                                {ev.revisoes.map((rev) => (
                                  <li key={rev.id}>
                                    {rev.criado_em ? formatarDataHoraBr(rev.criado_em) : ''}
                                    {rev.autor_nome ? ` · ${rev.autor_nome}` : ''}
                                    {': '}
                                    {rev.texto_anterior || '(vazio)'}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          {ev.editavel && !editando && !terminal && !consultaGlobal && (
                            <PremiumButton
                              variant="secondary"
                              onClick={() => setEventoEdicao({ id: ev.id, texto: ev.texto || '' })}
                            >
                              Corrigir
                            </PremiumButton>
                          )}
                          {podeOk && !consultaGlobal && (
                            <PremiumButton
                              variant="secondary"
                              onClick={() => agir(() => comprasConfirmarEvento(pedido.id, ev.id), 'Confirmado.')}
                            >
                              Ok
                            </PremiumButton>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>

            {mostraPassoContrato && (
              <SectionCard
                title="Contrato"
                subtitle="Se existir contrato, ele é assinado antes da compra e antes do pagamento."
              >
                <p className="mb-3 text-sm text-slate-600">
                  {pedido.contrato_pendente
                    ? 'O contrato está na fila de assinatura. A compra abre só depois que a Noemi assinar.'
                    : pedido.contrato_assinado
                      ? (compraJaExecutada
                        ? 'Contrato assinado. A compra já foi executada.'
                        : 'Contrato assinado. Agora execute a compra, por e-mail ou como compra direta sem envio de e-mail.')
                      : pedido.sem_contrato
                        ? 'Não há contrato. Execute a compra para abrir boleto, nota fiscal e arquivo relacionado.'
                        : 'A Sede já assinou o orçamento. Anexe o contrato, se existir. Ele vai para a Infraestrutura e, depois do ok, para a Noemi. Se não houver contrato, registre isso para seguir com a compra.'}
                </p>
                {podeDecidirContrato && (
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                      Anexar contrato
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const arquivo = e.target.files?.[0];
                          e.target.value = '';
                          if (!arquivo) return;
                          const fd = new FormData();
                          fd.append('tipo', 'aquisicao_bem');
                          fd.append('classe_documento', 'contrato');
                          fd.append('arquivo', arquivo);
                          await agir(
                            () => comprasAnexarArquivo(pedido.id, fd),
                            'Contrato enviado para a revisão da Infraestrutura.',
                          );
                        }}
                      />
                    </label>
                    {!pedido.sem_contrato && (
                      <PremiumButton
                        onClick={() => agir(
                          () => comprasRegistrarSemContrato(pedido.id),
                          'Sem contrato. A compra pode ser executada.',
                        )}
                      >
                        Não há contrato, seguir para a compra
                      </PremiumButton>
                    )}
                  </div>
                )}
                {contratosPedido.length > 0 && (
                  <ul className="space-y-2">
                    {contratosPedido.map((anexo) => {
                      const assinado = anexo.etapa_contrato === 'assinado';
                      return (
                      <li
                        key={anexo.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                          assinado
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <p className="min-w-0 truncate text-xs font-medium text-slate-800">
                          {anexo.etapa_contrato === 'aguardando_robson' ? 'Aguardando Infraestrutura · ' : ''}
                          {anexo.etapa_contrato === 'aguardando_noemi' ? 'Aguardando Noemi · ' : ''}
                          {assinado ? '✓ Assinado — ' : ''}
                          {anexo.nome_arquivo || 'Arquivo'}
                        </p>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                            onClick={() => setModalAnexo(anexo)}
                          >
                            Visualizar
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                            onClick={() => comprasBaixarAnexo(pedido.id, anexo.id, anexo.nome_arquivo)
                              .catch(() => setErro('Não foi possível baixar o arquivo.'))}
                          >
                            <FileText size={14} />
                            Baixar
                          </button>
                          {anexo.etapa_contrato === 'aguardando_robson' && infra ? (
                            <button
                              type="button"
                              className="rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                              onClick={() => agir(
                                () => comprasRevisarContrato(pedido.id, anexo.id),
                                'Contrato enviado para a assinatura da Noemi.',
                              )}
                            >
                              Ok, enviar à Noemi
                            </button>
                          ) : null}
                          {anexo.etapa_contrato === 'aguardando_noemi' && (assinaOrcamento || manutencao) ? (
                            <label className="cursor-pointer rounded-lg px-2 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50">
                              Anexar contrato assinado
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                className="hidden"
                                onChange={async (e) => {
                                  const arquivo = e.target.files?.[0];
                                  e.target.value = '';
                                  if (!arquivo) return;
                                  const fd = new FormData();
                                  fd.append('arquivo', arquivo);
                                  await agir(
                                    () => comprasContratoAssinado(pedido.id, anexo.id, fd),
                                    'Contrato assinado. O projeto foi avisado na timeline.',
                                  );
                                }}
                              />
                            </label>
                          ) : null}
                          {!compraJaExecutada && !assinado && (unidade || manutencao) ? (
                            <button
                              type="button"
                              className="rounded px-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                              title="Remover este PDF"
                              onClick={() => {
                                if (!window.confirm(`Excluir "${anexo.nome_arquivo}"?`)) return;
                                agir(() => comprasRemoverAnexo(pedido.id, anexo.id), 'Contrato excluído.');
                              }}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            )}

            {emailPedidoCompraEnviado && pedidoCompra && (
              <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-900">
                  Pedido de compra enviado
                </p>
                <p className="mt-1 text-sm text-emerald-800">
                  E-mail enviado com sucesso ao fornecedor (pedido de compra
                  {(pedido.anexos || []).some((a) => a.tipo === 'orcamento_assinado')
                    ? ' + orçamento assinado pela Sede'
                    : ''}
                  ). Visualize ou baixe o PDF; se precisar, reenvie.
                </p>
                <ul className="mt-3 space-y-2">
                  <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-white px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">PDF do pedido de compra</p>
                      <p className="truncate text-xs text-slate-500">
                        {pedidoCompra.nome_arquivo || 'pedido-compra.pdf'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                        onClick={() => setModalAnexo(pedidoCompra)}
                      >
                        Visualizar
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                        onClick={() => comprasBaixarAnexo(
                          pedido.id,
                          pedidoCompra.id,
                          pedidoCompra.nome_arquivo,
                        ).catch(() => setErro('Não foi possível baixar o pedido de compra.'))}
                      >
                        <FileText size={14} />
                        Baixar PDF
                      </button>
                      {podeEnviarPedidoCompra && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-50"
                          onClick={() => abrirModalEmail('reenvio')}
                        >
                          <Mail size={14} />
                          Reenviar e-mail
                        </button>
                      )}
                    </div>
                  </li>
                </ul>
              </div>
            )}

            {tipoExigeJanela(pedido.tipo) && pedido.status === 'rascunho' && (
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

            {(pedido.anexos || []).some((a) => a.tipo === 'resposta_fornecedor') && (
              <SectionCard title="Respostas do fornecedor">
                <ul className="space-y-2">
                  {(pedido.anexos || [])
                    .filter((a) => a.tipo === 'resposta_fornecedor')
                    .map((anexo) => (
                      <li
                        key={anexo.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <span className="truncate text-sm text-slate-800">{anexo.nome_arquivo || 'Arquivo'}</span>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            className="text-xs font-bold text-slate-800 underline"
                            onClick={() => setModalAnexo(anexo)}
                          >
                            Visualizar
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-slate-600 underline"
                            onClick={() => comprasBaixarAnexo(pedido.id, anexo.id, anexo.nome_arquivo)
                              .catch(() => setErro('Não foi possível baixar o arquivo.'))}
                          >
                            Baixar
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              </SectionCard>
            )}

            {hortifrutiDireto && sede && pedido.status === 'enviado_fornecedor' && (
              <SectionCard title="Espelho da compra">
                <p className="mb-3 text-xs text-slate-500">
                  Anexe o espelho enviado pelo fornecedor. O projeto só volta para incluir a nota fiscal e encerrar.
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="text-xs"
                  onChange={async (e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = '';
                    if (!arquivo) return;
                    const fd = new FormData();
                    fd.append('tipo', 'espelho_compra');
                    fd.append('arquivo', arquivo);
                    await agir(() => comprasAnexarArquivo(pedido.id, fd), 'Espelho da compra anexado.');
                  }}
                />
              </SectionCard>
            )}

            {segueInfra && compraJaExecutada && !terminal && (
              <SectionCard
                title="Pagamento"
                subtitle="À vista (1 pagamento) ou parcelado. Em cada parcela anexe a NF e/ou o comprovante. O processo só encerra quando todas estiverem pagas ou quando você marcar que o valor total já foi quitado."
              >
                {!pedido.pagamento_qtd_parcelas ? (
                  <form
                    className="grid gap-3 md:grid-cols-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const qtd = modoPagamento === 'avista' ? 1 : Number(qtdParcelasForm);
                      agir(
                        () => comprasDefinirPagamento(pedido.id, qtd),
                        qtd === 1 ? 'Pagamento à vista registrado.' : `Pagamento em ${qtd} parcelas registrado.`,
                      );
                    }}
                  >
                    <label className="flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="radio"
                        name="modo_pagamento"
                        checked={modoPagamento === 'avista'}
                        onChange={() => setModoPagamento('avista')}
                      />
                      À vista (1 pagamento)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-800">
                      <input
                        type="radio"
                        name="modo_pagamento"
                        checked={modoPagamento === 'parcelado'}
                        onChange={() => setModoPagamento('parcelado')}
                      />
                      Parcelado
                    </label>
                    {modoPagamento === 'parcelado' ? (
                      <input
                        type="number"
                        min={2}
                        max={36}
                        value={qtdParcelasForm}
                        onChange={(e) => setQtdParcelasForm(e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        aria-label="Quantidade de parcelas"
                      />
                    ) : null}
                    <div className="md:col-span-3">
                      <PremiumButton type="submit">Gravar forma de pagamento</PremiumButton>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-800">
                      {Number(pedido.pagamento_qtd_parcelas) === 1
                        ? 'Pagamento à vista (1 parcela).'
                        : `Pagamento em ${pedido.pagamento_qtd_parcelas} parcelas.`}
                      {' '}
                      {pedido.pagamento_quitado
                        ? 'Todos os valores já foram marcados como pagos.'
                        : `${pedido.pagamento_parcelas_pagas || 0} de ${pedido.pagamento_qtd_parcelas} com documento.`}
                    </p>
                    {Number(pedido.pagamento_qtd_parcelas) > 1 ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {(pedido.pagamento_parcelas || []).map((parcela) => (
                          <li
                            key={parcela.numero}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              parcela.paga || pedido.pagamento_quitado
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                : 'border-slate-200 bg-white text-slate-800'
                            }`}
                          >
                            Parcela {parcela.numero}
                            {parcela.paga
                              ? ' · com documento'
                              : pedido.pagamento_quitado
                                ? ' · quitada com o restante'
                                : ' · aguardando NF ou comprovante'}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {maiorParcelaComDocumento >= 1
                      && maiorParcelaComDocumento < Number(pedido.pagamento_qtd_parcelas || 0) ? (
                        <PremiumButton
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            const qtdAtual = Number(pedido.pagamento_qtd_parcelas || 0);
                            if (!window.confirm(`O cliente pagou em ${maiorParcelaComDocumento} parcelas. Ajustar o pedido de ${qtdAtual} para ${maiorParcelaComDocumento}?`)) return;
                            agir(
                              () => comprasDefinirPagamento(pedido.id, maiorParcelaComDocumento),
                              `Pagamento ajustado para ${maiorParcelaComDocumento} parcela${maiorParcelaComDocumento === 1 ? '' : 's'}.`,
                            );
                          }}
                        >
                          Cliente pagou em {maiorParcelaComDocumento} parcela{maiorParcelaComDocumento === 1 ? '' : 's'}
                        </PremiumButton>
                      ) : null}
                    {!pedido.pagamento_completo ? (
                      <PremiumButton
                        variant="secondary"
                        onClick={() => {
                          const qtd = Number(pedido.pagamento_qtd_parcelas || 0);
                          const pagas = Number(pedido.pagamento_parcelas_pagas || 0);
                          const faltam = Math.max(0, qtd - pagas);
                          const texto = faltam > 0
                            ? `Ainda faltam ${faltam} parcela${faltam === 1 ? '' : 's'} sem NF ou comprovante.\n\nMarcar que todos os valores já foram pagos? Isso libera o encerramento sem anexar o que falta. Confirme só se não for um clique sem querer.`
                            : 'Marcar que todos os valores deste pedido já foram pagos?';
                          if (!window.confirm(texto)) return;
                          agir(() => comprasQuitarPagamento(pedido.id), 'Pagamento quitado. Você já pode encerrar o processo.');
                        }}
                      >
                        Todos os valores já foram pagos
                      </PremiumButton>
                    ) : (
                      <p className="text-xs font-semibold text-emerald-800">
                        Pagamento completo. Use Encerrar processo abaixo — as notas já anexadas bastam.
                      </p>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            <ComprasDocumentosAnexados
              pedido={pedido}
              aberto={listaDocumentosAberta}
              onToggle={() => setListaDocumentosAberta((atual) => !atual)}
              podeExcluir={Boolean(podeEncerrar && !consultaGlobal && !terminal)}
              onVisualizar={setModalAnexo}
              onExcluirNf={(notaId) => agir(() => comprasRemoverNotaFiscal(pedido.id, notaId), 'Arquivo excluído.')}
              onExcluirAnexo={(anexoId) => agir(() => comprasRemoverAnexo(pedido.id, anexoId), 'Arquivo excluído.')}
              onErro={setErro}
            />

            {podeDocumentosFinais && (
              <SectionCard
                title="Documentos do processo"
                subtitle={segueInfra
                  ? 'Em cada parcela: nota fiscal, boleto, comprovante de pagamento ou arquivo relacionado. Boleto e nota fiscal exigem a Assinatura Digital AEB.'
                  : 'Escolha o tipo: nota fiscal, boleto ou arquivo relacionado. Boleto e nota fiscal exigem a Assinatura Digital AEB.'}
              >
                <p className="mb-3 text-xs text-slate-500">
                  {segueInfra
                    ? 'Defina o pagamento acima. Numa mesma anexação dá para unir PDFs de nota; a posição do texto vale para todas as páginas. No parcelado, cada parcela pode ter a própria NF.'
                    : 'Numa mesma anexação dá para incluir quantas notas forem necessárias: o sistema junta num arquivo só e aplica o texto e a assinatura em todas as páginas. Se já existir nota, exclua antes de anexar outra.'}
                </p>
                <form
                  className="grid gap-2 md:grid-cols-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (classeDoc === 'relacionado' || classeDoc === 'comprovante') {
                      if (!arqsNf[0]) {
                        setErro(classeDoc === 'comprovante' ? 'Selecione o comprovante.' : 'Selecione o arquivo relacionado.');
                        return;
                      }
                      const fdRel = new FormData();
                      fdRel.append('tipo', 'aquisicao_bem');
                      fdRel.append('classe_documento', classeDoc);
                      fdRel.append('arquivo', arqsNf[0]);
                      if (segueInfra && pedido.pagamento_qtd_parcelas && classeDoc === 'comprovante') {
                        fdRel.append('parcela_numero', String(parcelaDoc || 1));
                      }
                      const okRel = await agir(
                        () => comprasAnexarArquivo(pedido.id, fdRel),
                        classeDoc === 'comprovante' ? 'Comprovante anexado.' : 'Arquivo relacionado anexado.',
                      );
                      if (okRel) {
                        setArqsNf([]);
                        setListaDocumentosAberta(true);
                      }
                      return;
                    }
                    const jaTemNf = notasFiscaisPedido.some((nf) => nf.anexo_id);
                    if (classeDoc === 'nota_fiscal' && jaTemNf && !segueInfra) {
                      setErro('Já existe nota fiscal anexada. Exclua o arquivo antes de anexar outra.');
                      return;
                    }
                    if (!arqsNf.length) {
                      setErro(classeDoc === 'boleto' ? 'Selecione o arquivo do boleto.' : 'Selecione o arquivo da nota fiscal.');
                      return;
                    }
                    if (!senhaAssinaturaNf.trim()) {
                      setErro('Informe a senha da assinatura eletrônica do gestor.');
                      return;
                    }
                    const ehPdfNf = arqsNf.every((arquivo) => /\.pdf$/i.test(arquivo.name) || arquivo.type === 'application/pdf');
                    if (ehPdfNf && !carimboAssinaturaNf) {
                      setErro(classeDoc === 'boleto'
                        ? 'Posicione a assinatura digital no PDF do boleto.'
                        : 'Posicione o texto e a assinatura digital no PDF da nota.');
                      setModalTextoNf(true);
                      return;
                    }
                    const fd = new FormData();
                    Object.entries(nfForm).forEach(([chave, valor]) => {
                      if (!valor || chave === 'valor_reais' || chave === 'tipo_nf') return;
                      if (classeDoc === 'boleto' && (chave === 'observacao' || chave === 'numero')) return;
                      fd.append(chave, valor);
                    });
                    if (classeDoc === 'nota_fiscal') {
                      fd.append('tipo_nf', pedido.tipo === 'servico' ? 'servico' : 'produto');
                    }
                    if (classeDoc === 'nota_fiscal' && nfForm.valor_reais) {
                      const centavos = reaisParaCentavos(nfForm.valor_reais);
                      if (centavos == null) {
                        setErro('Valor da NF inválido. Use formato como 400,00.');
                        return;
                      }
                      fd.append('valor_reais', String(centavos / 100));
                    }
                    if (carimboNf) {
                      fd.append('carimbo_pagina', String(carimboNf.page ?? 0));
                      fd.append('carimbo_x', String(carimboNf.x));
                      fd.append('carimbo_y', String(carimboNf.y));
                      fd.append('carimbo_w', String(carimboNf.width));
                      fd.append('carimbo_h', String(carimboNf.height));
                    }
                    if (carimboAssinaturaNf) {
                      fd.append('assinatura_pagina', String(carimboAssinaturaNf.page ?? 0));
                      fd.append('assinatura_x', String(carimboAssinaturaNf.x));
                      fd.append('assinatura_y', String(carimboAssinaturaNf.y));
                      fd.append('assinatura_w', String(carimboAssinaturaNf.width));
                      fd.append('assinatura_h', String(carimboAssinaturaNf.height));
                    }
                    fd.append('senha_assinatura_eletronica', senhaAssinaturaNf);
                    fd.append('classe_documento', classeDoc);
                    if (segueInfra && pedido.pagamento_qtd_parcelas) {
                      fd.append('parcela_numero', String(parcelaDoc || 1));
                    }
                    fd.append('arquivo', arqsNf[0]);
                    arqsNf.slice(1).forEach((arquivo) => fd.append('arquivos', arquivo));
                    const registrou = await agir(
                      () => comprasRegistrarNotaFiscal(pedido.id, fd),
                      classeDoc === 'boleto'
                        ? 'Boleto registrado e assinado digitalmente.'
                        : 'Nota fiscal registrada e assinada digitalmente.',
                    );
                    if (!registrou) return;
                    setListaDocumentosAberta(true);
                    setSenhaAssinaturaNf('');
                    setNfForm({ tipo_nf: 'produto', numero: '', serie: '', valor_reais: '', observacao: '' });
                    setArqsNf([]);
                    setCarimboNf(null);
                    setCarimboAssinaturaNf(null);
                  }}
                >
                  <label className="md:col-span-3 text-xs font-semibold text-slate-600">
                    Tipo de documento
                    <select
                      value={classeDoc}
                      onChange={(e) => {
                        setClasseDoc(e.target.value);
                        setArqsNf([]);
                        setCarimboNf(null);
                        setCarimboAssinaturaNf(null);
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                    >
                      <option value="nota_fiscal">Nota fiscal</option>
                      <option value="boleto">Boleto</option>
                      {segueInfra ? <option value="comprovante">Comprovante de pagamento</option> : null}
                      <option value="relacionado">Arquivo relacionado ao processo</option>
                    </select>
                  </label>
                  {segueInfra && pedido.pagamento_qtd_parcelas && classeDoc !== 'relacionado' ? (
                    <label className="md:col-span-3 text-xs font-semibold text-slate-600">
                      Parcela deste documento
                      <select
                        value={parcelaDoc}
                        onChange={(e) => setParcelaDoc(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                      >
                        {Array.from({ length: Number(pedido.pagamento_qtd_parcelas) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            Parcela {n}
                            {(pedido.pagamento_parcelas || []).find((p) => p.numero === n)?.paga ? ' · já tem documento' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {classeDoc === 'nota_fiscal' ? (
                    <>
                      <input
                        value={nfForm.numero}
                        onChange={(e) => setNfForm((a) => ({ ...a, numero: e.target.value }))}
                        placeholder="Número NF"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm md:col-span-2"
                      />
                      <input
                        value={nfForm.valor_reais}
                        onChange={(e) => setNfForm((a) => ({ ...a, valor_reais: mascararMoedaDigitando(e.target.value) }))}
                        placeholder="R$ 0,00"
                        inputMode="numeric"
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <label className="md:col-span-3 text-xs font-semibold text-slate-600">
                        Insira as informações complementares de pagamento para a impressão da NF
                        <textarea
                          value={nfForm.observacao}
                          readOnly={!segueInfra && notasFiscaisPedido.some((nf) => nf.anexo_id)}
                          onClick={() => {
                            if (!segueInfra && notasFiscaisPedido.some((nf) => nf.anexo_id)) {
                              window.alert(
                                'Para alterar o texto, exclua o arquivo anexado, importe um novo arquivo e escreva a observação de novo.',
                              );
                            }
                          }}
                          onChange={(e) => setNfForm((a) => ({ ...a, observacao: e.target.value }))}
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal"
                        />
                      </label>
                    </>
                  ) : null}
                  <input
                    type="file"
                    multiple={classeDoc === 'nota_fiscal'}
                    accept={classeDoc === 'relacionado' || classeDoc === 'comprovante' ? undefined : '.pdf,.xml,.jpg,.jpeg,.png,application/pdf'}
                    onChange={(e) => {
                      const arquivos = Array.from(e.target.files || []);
                      const primeiro = arquivos[0] || null;
                      if (classeDoc === 'relacionado' || classeDoc === 'comprovante') {
                        setArqsNf(primeiro ? [primeiro] : []);
                        return;
                      }
                      const todosPdf = arquivos.length > 0 && arquivos.every((arquivo) => (
                        /\.pdf$/i.test(arquivo.name) || arquivo.type === 'application/pdf'
                      ));
                      if (todosPdf) {
                        if (classeDoc === 'nota_fiscal' && !(nfForm.observacao || '').trim()) {
                          e.target.value = '';
                          setArqsNf([]);
                          setCarimboNf(null);
                          setCarimboAssinaturaNf(null);
                          window.alert('Escreva as informações complementares de pagamento antes de escolher o arquivo.');
                          return;
                        }
                        setErro('');
                        setArqsNf(arquivos);
                        setModalTextoNf(true);
                        return;
                      }
                      setArqsNf(primeiro ? [primeiro] : []);
                      setCarimboNf(null);
                      setCarimboAssinaturaNf(null);
                    }}
                    className="text-xs md:col-span-3"
                  />
                  {arqsNf.length ? (
                    <p className="text-xs text-slate-600 md:col-span-3">
                      {arqsNf.length === 1
                        ? `Arquivo escolhido: ${arqsNf[0].name}`
                        : `${arqsNf.length} arquivos. A posição vale para todas as páginas do PDF unido.`}
                      {carimboNf ? ' · texto posicionado' : ''}
                      {carimboAssinaturaNf ? ' · assinatura posicionada' : ''}
                    </p>
                  ) : null}
                  {classeDoc !== 'relacionado' && classeDoc !== 'comprovante' ? (
                    <div className="md:col-span-3">
                      <label className="mb-1 block text-xs font-semibold text-slate-600" htmlFor="senha-assinatura-nf">
                        Insira a senha do gestor para a assinatura eletrônica digital
                      </label>
                      <CampoSenha
                        id="senha-assinatura-nf"
                        name="senha_assinatura_nf"
                        autoComplete="off"
                        required={false}
                        value={senhaAssinaturaNf}
                        onChange={(e) => setSenhaAssinaturaNf(e.target.value)}
                        placeholder="Senha cadastrada no perfil do gestor"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Técnico e Administrativo também podem assinar, se souberem a senha do gestor.
                        No PDF, o carimbo entra no lugar escolhido, com o nome do gestor, o projeto e o cargo Gestor.
                        {assinaturaGestor.gestor && !assinaturaGestor.cadastrada
                          ? ' Cadastre essa senha em Usuários antes de anexar.'
                          : ''}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 md:col-span-3">
                      Arquivo relacionado não exige assinatura digital.
                    </p>
                  )}
                  <PremiumButton type="submit">
                    {classeDoc === 'boleto'
                      ? 'Anexar boleto assinado'
                      : classeDoc === 'relacionado'
                        ? 'Anexar arquivo relacionado'
                        : classeDoc === 'comprovante'
                          ? 'Anexar comprovante'
                          : 'Anexar NF assinada'}
                  </PremiumButton>
                </form>
              </SectionCard>
            )}

            {podeEncerrar && !terminal && !consultaGlobal ? (
              <div className="rounded-2xl border-2 border-slate-900 bg-white px-4 py-4 shadow-sm">
                <p className="mb-3 text-sm text-slate-700">
                  {segueInfra && !pedido.pagamento_completo
                    ? 'Para encerrar: anexe NF ou comprovante em cada parcela, ou marque que todos os valores já foram pagos.'
                    : !notasFiscaisPedido.length
                      ? 'Para encerrar, anexe ao menos uma nota fiscal assinada.'
                      : 'As notas anexadas já valem para encerrar. Não é preciso NF nas parcelas que o cliente deixou de usar.'}
                </p>
                <PremiumButton
                  className="w-full py-3 text-base font-black"
                  onClick={() => agir(
                    () => comprasReceber(pedido.id, { observacao: 'Recebimento confirmado.' }),
                    'Processo encerrado.',
                  )}
                  disabled={
                    !notasFiscaisPedido.length
                    || !(pedido.eventos || []).some((ev) => String(ev.texto || '').includes('Assinado Digitalmente'))
                    || (segueInfra && !pedido.pagamento_completo)
                  }
                  title={
                    segueInfra && !pedido.pagamento_completo
                      ? 'Registre cada parcela ou marque que todos os valores já foram pagos.'
                      : 'Disponível depois que a nota fiscal for assinada com a senha do gestor.'
                  }
                >
                  Encerrar processo
                </PremiumButton>
              </div>
            ) : null}

            {pedido.aviso_sede_sem_tres_orcamentos && sede && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {pedido.aviso_sede_sem_tres_orcamentos}
              </div>
            )}

            <SectionCard title="Fluxo">
              <div className="flex flex-wrap gap-2">
                {(pedido.status === 'rascunho'
                  || (cotacaoProjeto && ['em_cotacao', 'aguardando_cotacao'].includes(pedido.status))) && !consultaGlobal && (
                  <PremiumButton
                    onClick={async () => {
                      setErro('');
                      setOk('');
                      const tentar = async (confirmar) => comprasSubmeter(pedido.id, {
                        confirmarSemTresOrcamentos: confirmar,
                      });
                      try {
                        let resp;
                        try {
                          resp = await tentar(false);
                        } catch (err) {
                          const detail = err.response?.data?.detail;
                          if (err.response?.status === 409 && detail?.code === 'orcamentos_insuficientes') {
                            if (!window.confirm(detail.message)) return;
                            resp = await tentar(true);
                          } else {
                            throw err;
                          }
                        }
                        setOk(cotacaoProjeto
                          ? 'Pedido enviado à Sede para escolha e assinatura.'
                          : 'Pedido enviado.');
                        if (resp?.dividido && Array.isArray(resp.pedidos) && resp.pedidos.length > 1) {
                          const nomes = resp.pedidos
                            .map((p) => p.categoria_split_nome || 'categoria')
                            .join(', ');
                          setOk(`Pedido dividido em ${resp.pedidos.length} por categoria: ${nomes}.`);
                          if (resp.pedido?.id && resp.pedido.id !== pedido.id) {
                            navigate(`/compras/pedidos/${resp.pedido.id}`);
                            return;
                          }
                        }
                        await carregar();
                      } catch (err) {
                        const detail = err.response?.data?.detail;
                        setErro(
                          (typeof detail === 'string' ? detail : detail?.message)
                          || err.message
                          || 'Não foi possível enviar.',
                        );
                      }
                    }}
                  >
                    {cotacaoProjeto ? 'Enviar à Sede' : 'Enviar pedido'}
                  </PremiumButton>
                )}
                {pedido.status === 'aguardando_aprovacao_unidade' && unidade && !pedidoSede && (
                  <PremiumButton onClick={() => agir(
                    () => comprasAprovarUnidade(pedido.id),
                    pedido.tipo === 'consumo'
                      ? 'Orçamento aprovado. Suprimentos pode enviar o pedido ao fornecedor.'
                      : 'Unidade aprovou.',
                  )}
                  >
                    {pedido.tipo === 'consumo' ? 'Aprovar orçamento' : 'Aprovar na unidade'}
                  </PremiumButton>
                )}
                {hortifrutiDireto && sede && [
                  'aguardando_cotacao',
                  'em_cotacao',
                  'aguardando_escolha_orcamento',
                  'aguardando_aprovacao_sede',
                ].includes(pedido.status) && (
                  <PremiumButton
                    onClick={async () => {
                      const ok = await agir(
                        () => comprasAprovarSede(pedido.id),
                        'Suprimentos aprovou. Envie o pedido de compra ao fornecedor.',
                      );
                      if (ok) abrirModalEmail('pedido_compra');
                    }}
                  >
                    Aprovar e enviar ao fornecedor
                  </PremiumButton>
                )}
                {pedido.status === 'aguardando_aprovacao_sede' && !pulaAprovacaoSede && !hortifrutiDireto && (
                  cotacaoProjeto && (sede || assinaOrcamento) ? (
                    <PremiumButton
                      onClick={() => {
                        const escolhida = (pedido.cotacoes || []).find((c) => c.escolhida);
                        if (!escolhida) {
                          setErro('Escolha o orçamento vencedor antes de assinar.');
                          return;
                        }
                        const anexoOrc = (pedido.anexos || []).find(
                          (a) => a.cotacao_id === escolhida.id && a.tipo === 'orcamento',
                        );
                        if (!anexoOrc) {
                          setErro('Anexe o PDF do orçamento vencedor antes de assinar.');
                          return;
                        }
                        setErro('');
                        setModalAssinatura({
                          pedidoId: pedido.id,
                          anexoOrcamentoId: anexoOrc.id,
                          fornecedorNome: escolhida.fornecedor_nome || '',
                        });
                      }}
                    >
                      Posicionar assinatura e aprovar (Sede)
                    </PremiumButton>
                  ) : sede ? (
                    <PremiumButton onClick={() => agir(() => comprasAprovarSede(pedido.id), 'Sede aprovou.')}>
                      Aprovar na Sede
                    </PremiumButton>
                  ) : null
                )}
                {podeEnviarPedidoCompra && passoContratoOk && !compraJaExecutada && !emailPedidoCompraEnviado && !pedido.compra_direta_sem_email && (
                  <PremiumButton
                    onClick={() => abrirModalEmail('pedido_compra')}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Mail size={16} />
                      Enviar pedido de compra por e-mail
                    </span>
                  </PremiumButton>
                )}
                {podeEnviarPedidoCompra && segueInfra && passoContratoOk && !compraJaExecutada && !emailPedidoCompraEnviado && !pedido.compra_direta_sem_email && (
                  <PremiumButton
                    onClick={() => agir(
                      () => comprasCompraDireta(pedido.id),
                      'Compra direta registrada. O processo segue para a nota fiscal, sem e-mail ao fornecedor.',
                    )}
                  >
                    Compra direta sem envio de e-mail
                  </PremiumButton>
                )}
                {podeReabrir && (
                  <PremiumButton onClick={() => agir(() => comprasReabrir(pedido.id), 'Processo reaberto.')}>
                    Reabrir processo
                  </PremiumButton>
                )}
                {podeReabrirAprovado && (
                  <PremiumButton
                    variant="secondary"
                    className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                    onClick={() => {
                      const motivo = promptMotivo('Motivo da reabertura do orçamento aprovado:');
                      if (!motivo) return;
                      agir(
                        () => comprasReabrirAprovado(pedido.id, motivo),
                        'Orçamento aprovado reaberto. Escolha o vencedor e aprove de novo.',
                      );
                    }}
                  >
                    Reabrir orçamento aprovado
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
                ) : !terminal && !consultaGlobal ? (
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
                <PremiumButton variant="secondary" onClick={() => navigate(-1)}>
                  Voltar
                </PremiumButton>
              </div>
            </SectionCard>
          </div>
        </ScrollArea>
      </MainShell>
      <ModalRevisarEmailCompras
        aberto={Boolean(modalEmail)}
        titulo={
          modalEmail?.modo === 'cotacao'
            ? 'Revisar pedido de cotação'
            : modalEmail?.modo === 'reenvio'
              ? 'Revisar reenvio ao fornecedor'
              : 'Revisar pedido de compra'
        }
        assunto={rascunhoEmail.assunto}
        corpo={rascunhoEmail.corpo}
        avisoAssinatura={rascunhoEmail.aviso}
        carregando={rascunhoEmail.carregando}
        enviando={enviandoEmail}
        erro={rascunhoEmail.erro}
        onCorpoChange={(valor) => setRascunhoEmail((prev) => ({ ...prev, corpo: valor }))}
        onCancelar={fecharModalEmail}
        onConfirmar={confirmarEnvioEmail}
        fornecedoresEnvio={
          hortifrutiSemOrcamentoEscolhido(pedido)
          && modoEmailPedeFornecedorEnvio(modalEmail?.modo)
            ? fornecedoresCotacao
            : null
        }
        fornecedorEnvioId={fornecedorEnvioId}
        onFornecedorEnvioChange={setFornecedorEnvioId}
      />
      <ModalPosicionarTextoNf
        aberto={modalTextoNf}
        arquivo={arqsNf[0] || null}
        texto={nfForm.observacao}
        projeto={pedido?.instituicao_nome || ''}
        modo={classeDoc === 'boleto' ? 'boleto' : 'nota_fiscal'}
        onFechar={() => {
          setModalTextoNf(false);
          setArqsNf([]);
          setCarimboNf(null);
          setCarimboAssinaturaNf(null);
        }}
        onConfirmar={(posicao) => {
          setCarimboNf(posicao.texto);
          setCarimboAssinaturaNf(posicao.assinatura);
          setModalTextoNf(false);
          setOk(classeDoc === 'boleto'
            ? 'Assinatura posicionada. Clique em Anexar boleto assinado para gravar no arquivo.'
            : 'Texto e assinatura posicionados. Clique em Anexar NF assinada para gravar no arquivo.');
        }}
      />
      <ModalPosicionarAssinaturaOrcamento
        aberto={Boolean(modalAssinatura)}
        pedidoId={modalAssinatura?.pedidoId}
        anexoOrcamentoId={modalAssinatura?.anexoOrcamentoId}
        fornecedorNome={modalAssinatura?.fornecedorNome || ''}
        onFechar={() => setModalAssinatura(null)}
        onConfirmar={async (posicao) => {
          if (!modalAssinatura?.pedidoId) return;
          const okAssinatura = await agir(
            () => comprasAssinarOrcamentoSede(modalAssinatura.pedidoId, posicao),
            'Orçamento assinado no local escolhido e pedido aprovado na Sede.',
          );
          if (!okAssinatura) {
            throw new Error('Não foi possível assinar o orçamento.');
          }
          setModalAssinatura(null);
        }}
      />
      <ModalFormItemConsumo
        aberto={Boolean(modalNovoItem)}
        descricaoInicial={modalNovoItem?.descricao || ''}
        competenciaInicial={competenciaPadraoDoSegmento(
          pedido?.tipo === TIPO_SERVICO ? SEGMENTO_SERVICO : segmentoDoTipoPedido(pedido?.tipo),
        )}
        categorias={categorias}
        itens={itensConsumo}
        onFechar={() => setModalNovoItem(null)}
        onSalvo={async (criado) => {
          const lista = await comprasItensConsumo({ ativos: true });
          setItensConsumo(Array.isArray(lista) ? lista : []);
          if (criado?.id) {
            setItem((atual) => ({
              ...atual,
              catalogo_item_id: criado.id,
              descricao: criado.descricao || atual.descricao,
              unidade_medida: unidadeParaPedido(criado) || atual.unidade_medida,
              embalagem: criado.embalagem || '',
              marca_preferencial: criado.marca_preferencial || '',
              categoria_id: criado.categoria_id || '',
            }));
          }
          setModalNovoItem(null);
          setErro('');
          setOk('Item cadastrado. Ele já está nesta linha — confirme com Incluir item.');
        }}
      />
      <ModalVisualizarAnexoCompras
        aberto={Boolean(modalAnexo)}
        pedidoId={pedido?.id}
        anexo={modalAnexo}
        onFechar={() => setModalAnexo(null)}
        onErro={(msg) => setErro(msg)}
      />
    </AppShell>
  );
}
