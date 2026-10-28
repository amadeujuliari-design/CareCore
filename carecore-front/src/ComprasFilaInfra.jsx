import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ChevronRight, Receipt } from 'lucide-react';

import Sidebar from './Sidebar';
import ModalVisualizarAnexoCompras from './components/ModalVisualizarAnexoCompras';
import {
  AppShell,
  EmptyState,
  MainShell,
  PageHeader,
  PremiumButton,
  ScrollArea,
  SectionCard,
} from './components/PremiumUI';
import {
  comprasBaixarAnexo,
  comprasConfirmarNfPagamento,
  comprasFilaConcluidosInfra,
  comprasFilaNfPagamento,
  comprasFilaNfPagamentoSuprimentos,
  comprasOkFinalInfra,
  moneyCentavos,
} from './services/comprasService';
import { usuarioEhAdmComprasInfraestrutura, usuarioEhAdmComprasSuprimentos, usuarioEhManutencao } from './utils/rbacUtils';
import { formatarDataHoraBr } from './utils/dataBrasilUtils';
import { agruparFilaAssinaturaPorUnidade } from './utils/comprasFilaAssinaturaUtils';
import { rotuloTipoPedido } from './utils/comprasPedidoTipos';

function usuarioSessao() {
  try {
    return JSON.parse(localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario') || '{}');
  } catch {
    return {};
  }
}

function dataHoraOuTraco(valor) {
  return formatarDataHoraBr(valor) || '—';
}

function anexosPedido(pedido) {
  return (pedido?.anexos || []).filter((item) => item?.id);
}

export default function ComprasFilaInfra({ modo }) {
  const navigate = useNavigate();
  const usuario = useMemo(() => usuarioSessao(), []);
  const ehNfSuprimentos = modo === 'nf-suprimentos';
  const ehNf = modo === 'nf' || ehNfSuprimentos;
  const sede = ehNfSuprimentos
    ? (usuarioEhAdmComprasSuprimentos(usuario) || usuarioEhManutencao(usuario))
    : (usuarioEhAdmComprasInfraestrutura(usuario) || usuarioEhManutencao(usuario));
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [pedidos, setPedidos] = useState([]);
  const [acaoId, setAcaoId] = useState('');
  const [modalAnexo, setModalAnexo] = useState(null);
  const [unidadeExpandida, setUnidadeExpandida] = useState('');

  const carregar = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      if (!sede) return;
      const dados = ehNfSuprimentos
        ? await comprasFilaNfPagamentoSuprimentos()
        : ehNf
          ? await comprasFilaNfPagamento()
          : await comprasFilaConcluidosInfra();
      setPedidos(dados?.pedidos || []);
    } catch (err) {
      setErro(err.response?.data?.detail || err.message || 'Não foi possível carregar a fila.');
    } finally {
      setCarregando(false);
    }
  }, [sede, ehNf, ehNfSuprimentos]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const titulo = ehNfSuprimentos
    ? 'NFs a pagar (Suprimentos)'
    : ehNf
      ? 'NFs a pagar'
      : 'Pedidos concluídos (Infraestrutura)';
  const subtitulo = ehNf
    ? 'Compras emergência com nota fiscal pronta para pagamento. Confirme depois de enviar a NF ao financeiro.'
    : 'Pedidos que o projeto encerrou. Confira os anexos e dê o OK final para sair desta fila.';
  const eyebrow = ehNfSuprimentos ? 'Compras · Suprimentos' : 'Compras · Infraestrutura';
  const semAcesso = ehNfSuprimentos
    ? 'Somente Suprimentos acessa esta fila.'
    : 'Somente a Infraestrutura acessa esta fila.';

  if (!sede) {
    return (
      <AppShell>
        <Sidebar />
        <MainShell>
          <PageHeader title={titulo} backTo="/compras" icon={ehNf ? <Receipt className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />} />
          <p className="p-6 text-sm text-slate-600">{semAcesso}</p>
        </MainShell>
      </AppShell>
    );
  }

  const grupos = agruparFilaAssinaturaPorUnidade(pedidos, []);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow={eyebrow}
          title={titulo}
          subtitle={subtitulo}
          icon={ehNf ? <Receipt className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          actions={(
            <PremiumButton variant="secondary" onClick={() => carregar()}>
              Atualizar
            </PremiumButton>
          )}
        />
        <ScrollArea>
          <div className="space-y-4 p-4 md:p-6">
            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
            )}
            <SectionCard
              title={`${titulo} (${pedidos.length})`}
              subtitle={pedidos.length ? 'Agrupado por unidade — clique na linha para expandir.' : undefined}
            >
              {carregando ? (
                <p className="text-sm text-slate-500">Carregando…</p>
              ) : grupos.length === 0 ? (
                <EmptyState title="Nenhum item nesta fila" subtitle={ehNf ? 'Nenhuma NF de emergência aguardando pagamento.' : 'Nenhum pedido encerrado aguardando o OK final.'} />
              ) : (
                <ul className="space-y-2">
                  {grupos.map((grupo) => {
                    const aberto = unidadeExpandida === grupo.chave;
                    return (
                      <li key={grupo.chave} className="overflow-hidden rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          className="flex w-full flex-wrap items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-100/80"
                          onClick={() => setUnidadeExpandida((atual) => (atual === grupo.chave ? '' : grupo.chave))}
                        >
                          <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-slate-900">
                            {aberto ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                            <span className="truncate">{grupo.nome}</span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-700">
                              {grupo.qtd} {grupo.qtd === 1 ? 'pedido' : 'pedidos'}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span>{grupo.tiposRotulo || '—'}</span>
                            <span className="tabular-nums">Atualizado em {dataHoraOuTraco(grupo.atualizado)}</span>
                            <span className="font-semibold text-slate-700">{aberto ? 'Recolher' : 'Expandir'}</span>
                          </span>
                        </button>
                        {aberto ? (
                          <ul className="space-y-3 border-t border-slate-100 bg-white p-3">
                            {grupo.itens.map((pedido) => {
                              const anexos = anexosPedido(pedido);
                              return (
                                <li key={pedido.id} className="rounded-xl border border-slate-200 p-4">
                                  <p className="font-semibold text-slate-900">
                                    {pedido.titulo || pedido.info_pedido || rotuloTipoPedido(pedido.tipo)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-600">
                                    {rotuloTipoPedido(pedido.tipo)}
                                    {pedido.fornecedor_pedido_nome ? ` · ${pedido.fornecedor_pedido_nome}` : ''}
                                    {pedido.valor_estimado_centavos != null ? ` · ${moneyCentavos(pedido.valor_estimado_centavos)}` : ''}
                                    {pedido.recebido_em ? ` · encerrado em ${dataHoraOuTraco(pedido.recebido_em)}` : ''}
                                    {pedido.atualizado_em ? ` · atualizado em ${dataHoraOuTraco(pedido.atualizado_em)}` : ''}
                                  </p>
                                  {pedido.info_pedido ? (
                                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{pedido.info_pedido}</p>
                                  ) : null}
                                  <div className="mt-3 space-y-2">
                                    {anexos.length === 0 ? (
                                      <p className="text-xs text-slate-500">Nenhum anexo neste pedido.</p>
                                    ) : anexos.map((anexo) => (
                                      <div key={anexo.id} className="flex flex-wrap items-center gap-2">
                                        <PremiumButton
                                          variant="secondary"
                                          onClick={() => setModalAnexo({ pedidoId: pedido.id, anexo })}
                                        >
                                          Visualizar
                                        </PremiumButton>
                                        <button
                                          type="button"
                                          className="text-xs font-semibold text-violet-700 underline"
                                          onClick={() => comprasBaixarAnexo(pedido.id, anexo.id, anexo.nome_arquivo).catch(() => setErro('Não foi possível baixar o arquivo.'))}
                                        >
                                          {anexo.nome_arquivo || 'Anexo'}
                                          {anexo.criado_em ? ` · ${dataHoraOuTraco(anexo.criado_em)}` : ''}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <PremiumButton variant="secondary" onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}>
                                      Abrir pedido
                                    </PremiumButton>
                                    {ehNf ? (
                                      <PremiumButton
                                        disabled={acaoId === pedido.id}
                                        onClick={async () => {
                                          setErro('');
                                          setOk('');
                                          setAcaoId(pedido.id);
                                          try {
                                            await comprasConfirmarNfPagamento(pedido.id);
                                            setOk('NF marcada como enviada para pagamento. O projeto vai conferir o extrato.');
                                            await carregar();
                                          } catch (err) {
                                            setErro(err.response?.data?.detail || err.message || 'Não foi possível confirmar.');
                                          } finally {
                                            setAcaoId('');
                                          }
                                        }}
                                      >
                                        {acaoId === pedido.id ? 'Confirmando…' : 'Confirmar envio ao pagamento'}
                                      </PremiumButton>
                                    ) : (
                                      <PremiumButton
                                        disabled={acaoId === pedido.id}
                                        onClick={async () => {
                                          setErro('');
                                          setOk('');
                                          setAcaoId(pedido.id);
                                          try {
                                            await comprasOkFinalInfra(pedido.id);
                                            setOk('OK final registrado. O pedido saiu desta fila.');
                                            await carregar();
                                          } catch (err) {
                                            setErro(err.response?.data?.detail || err.message || 'Não foi possível registrar o OK.');
                                          } finally {
                                            setAcaoId('');
                                          }
                                        }}
                                      >
                                        {acaoId === pedido.id ? 'Registrando…' : 'OK final'}
                                      </PremiumButton>
                                    )}
                                  </div>
                                  <p className="mt-2 text-xs text-slate-500">
                                    <Link className="font-semibold text-violet-700 underline" to={`/compras/pedidos/${pedido.id}`}>
                                      Ver itens e timeline
                                    </Link>
                                  </p>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          </div>
        </ScrollArea>
      </MainShell>
      <ModalVisualizarAnexoCompras
        aberto={Boolean(modalAnexo)}
        pedidoId={modalAnexo?.pedidoId}
        anexo={modalAnexo?.anexo}
        onFechar={() => setModalAnexo(null)}
        onErro={(msg) => setErro(msg)}
      />
    </AppShell>
  );
}
