import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePenLine } from 'lucide-react';

import Sidebar from './Sidebar';
import ModalPosicionarAssinaturaOrcamento from './components/ModalPosicionarAssinaturaOrcamento';
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
  comprasAssinarOrcamentoSede,
  comprasAssinaturaDigitalStatus,
  comprasBaixarAnexo,
  comprasEscolherCotacao,
  comprasObterPedido,
  comprasPedidos,
  comprasRevogarEscolhaCotacao,
  comprasUploadAssinaturaDigital,
  moneyCentavos,
} from './services/comprasService';
import { usuarioEhAdmCompras, usuarioEhManutencao } from './utils/rbacUtils';
import { formatarDataBr } from './utils/comprasJanelaUtils';
import { rotuloTipoPedido, tipoEhCotacaoProjeto } from './utils/comprasPedidoTipos';

function usuarioSessao() {
  try {
    return JSON.parse(localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario') || '{}');
  } catch {
    return {};
  }
}

function anexosOrcamento(pedido, cotacaoId) {
  return (pedido.anexos || []).filter(
    (a) => a.cotacao_id === cotacaoId && (a.tipo === 'orcamento' || a.tipo === 'orcamento_assinado'),
  );
}

export default function ComprasAguardandoAssinatura() {
  const navigate = useNavigate();
  const usuario = useMemo(() => usuarioSessao(), []);
  const sede = usuarioEhAdmCompras(usuario) || usuarioEhManutencao(usuario);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState([]);
  const [assinandoId, setAssinandoId] = useState('');
  const [acaoId, setAcaoId] = useState('');
  const [assinatura, setAssinatura] = useState({ cadastrada: false, nome_arquivo: null });
  const [modalAssinatura, setModalAssinatura] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      if (!sede) {
        setItens([]);
        return;
      }
      const [lista, statusAssinatura] = await Promise.all([
        comprasPedidos({ status_pedido: 'aguardando_aprovacao_sede' }),
        comprasAssinaturaDigitalStatus().catch(() => ({ cadastrada: false })),
      ]);
      setAssinatura(statusAssinatura || { cadastrada: false });
      const filtrados = (lista || []).filter((p) => tipoEhCotacaoProjeto(p.tipo));
      const detalhados = await Promise.all(
        filtrados.map(async (p) => {
          try {
            return await comprasObterPedido(p.id);
          } catch {
            return p;
          }
        }),
      );
      setItens(detalhados);
    } catch (err) {
      setErro(err.response?.data?.detail || err.message || 'Não foi possível carregar a fila.');
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, [sede]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!sede) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      carregar();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [carregar, sede]);

  if (!sede) {
    return (
      <AppShell>
        <Sidebar />
        <MainShell>
          <PageHeader
            title="Aguardando assinatura"
            backTo="/compras"
            icon={<FilePenLine className="h-5 w-5" />}
          />
          <p className="p-6 text-sm text-slate-600">Somente ADM Compras (Sede) acessa esta fila.</p>
        </MainShell>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Compras · Sede"
          title="Aguardando assinatura"
          subtitle="Escolha o orçamento vencedor, assine com o seu PDF de assinatura e devolva ao projeto."
          icon={<FilePenLine className="h-5 w-5" />}
          actions={(
            <PremiumButton variant="secondary" onClick={() => carregar()}>
              Atualizar
            </PremiumButton>
          )}
        />
        <ScrollArea>
          <div className="space-y-4 p-4 md:p-6">
            {erro && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {typeof erro === 'string' ? erro : (erro?.message || JSON.stringify(erro))}
              </div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
            )}

            <SectionCard title="Sua assinatura digital">
              <p className="mb-3 text-sm text-slate-600">
                O mesmo PDF é aplicado em todos os atos de assinatura sobre o orçamento escolhido.
              </p>
              <p className="mb-3 text-sm font-medium text-slate-800">
                {assinatura.cadastrada
                  ? `Cadastrado: ${assinatura.nome_arquivo || 'PDF de assinatura'}`
                  : 'Nenhum PDF cadastrado — cadastre antes de assinar.'}
              </p>
              <label className="inline-flex cursor-pointer">
                <span className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  {assinatura.cadastrada ? 'Substituir PDF' : 'Cadastrar PDF da assinatura'}
                </span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setErro('');
                    setOk('');
                    try {
                      const res = await comprasUploadAssinaturaDigital(file);
                      setAssinatura(res);
                      setOk('Assinatura digital cadastrada.');
                    } catch (err) {
                      setErro(err.response?.data?.detail || err.message || 'Falha no upload.');
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </SectionCard>

            <SectionCard title={`Fila da Sede (${itens.length})`}>
              {carregando ? (
                <p className="text-sm text-slate-500">Carregando…</p>
              ) : itens.length === 0 ? (
                <EmptyState
                  title="Nenhum pedido aguardando assinatura"
                  subtitle="Quando o projeto anexar orçamentos (ou enviar à Sede), o pedido aparece aqui."
                />
              ) : (
                <ul className="space-y-4">
                  {itens.map((pedido) => {
                    const escolhida = (pedido.cotacoes || []).find((c) => c.escolhida);
                    const cotacoes = (pedido.cotacoes || []).filter((c) => c.ativa !== false);
                    const avisos = pedido.aviso_sede_sem_tres_orcamentos;
                    return (
                      <li
                        key={pedido.id}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {pedido.titulo ? `${pedido.titulo} · ` : ''}
                              {pedido.instituicao_nome || 'Projeto'}
                              {' · '}
                              {rotuloTipoPedido(pedido.tipo)}
                              {pedido.competencia ? ` · ${pedido.competencia}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Enviado
                              {pedido.submetido_em ? ` em ${formatarDataBr(pedido.submetido_em)}` : ''}
                              {' · '}
                              {pedido.orcamentos_com_anexo ?? cotacoes.length}
                              /
                              {pedido.min_orcamentos_recomendados || 3}
                              {' '}
                              orçamentos com anexo
                              {escolhida
                                ? ` · vencedor: ${escolhida.fornecedor_nome} (${moneyCentavos(escolhida.valor_centavos)})`
                                : ' · escolha o orçamento vencedor abaixo'}
                            </p>
                            {avisos && (
                              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                {avisos}
                              </p>
                            )}
                            <ul className="mt-3 space-y-2">
                              {cotacoes.map((c) => {
                                const anexos = anexosOrcamento(pedido, c.id);
                                return (
                                  <li key={c.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span>
                                        {c.fornecedor_nome}
                                        {' · '}
                                        {moneyCentavos(c.valor_centavos)}
                                        {c.escolhida ? ' · escolhida' : ''}
                                      </span>
                                      <div className="flex flex-wrap gap-2">
                                        {!c.escolhida && (
                                          <PremiumButton
                                            disabled={acaoId === pedido.id}
                                            onClick={async () => {
                                              setErro('');
                                              setOk('');
                                              setAcaoId(pedido.id);
                                              try {
                                                await comprasEscolherCotacao(pedido.id, c.id);
                                                setOk(`Orçamento de ${c.fornecedor_nome} marcado como vencedor.`);
                                                await carregar();
                                              } catch (err) {
                                                setErro(err.response?.data?.detail || err.message || 'Falha ao escolher.');
                                              } finally {
                                                setAcaoId('');
                                              }
                                            }}
                                          >
                                            Escolher
                                          </PremiumButton>
                                        )}
                                        {c.escolhida && (
                                          <PremiumButton
                                            variant="secondary"
                                            disabled={acaoId === pedido.id}
                                            onClick={async () => {
                                              if (!window.confirm('Revogar esta escolha e selecionar outro orçamento?')) return;
                                              setErro('');
                                              setOk('');
                                              setAcaoId(pedido.id);
                                              try {
                                                await comprasRevogarEscolhaCotacao(pedido.id);
                                                setOk('Escolha revogada.');
                                                await carregar();
                                              } catch (err) {
                                                setErro(err.response?.data?.detail || err.message || 'Falha ao revogar.');
                                              } finally {
                                                setAcaoId('');
                                              }
                                            }}
                                          >
                                            Revogar
                                          </PremiumButton>
                                        )}
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {anexos.map((anexo) => (
                                        <button
                                          key={anexo.id}
                                          type="button"
                                          className="text-xs font-semibold text-violet-700 underline"
                                          onClick={() => {
                                            comprasBaixarAnexo(pedido.id, anexo.id, anexo.nome_arquivo).catch(() => {
                                              setErro('Não foi possível abrir o anexo.');
                                            });
                                          }}
                                        >
                                          {anexo.tipo === 'orcamento_assinado' ? 'Assinado: ' : 'Orçamento: '}
                                          {anexo.nome_arquivo}
                                        </button>
                                      ))}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <PremiumButton
                              variant="secondary"
                              onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
                            >
                              Abrir pedido
                            </PremiumButton>
                            <PremiumButton
                              disabled={
                                assinandoId === pedido.id
                                || !escolhida
                                || !assinatura.cadastrada
                                || anexosOrcamento(pedido, escolhida?.id).filter((a) => a.tipo === 'orcamento').length === 0
                              }
                              onClick={() => {
                                if (!assinatura.cadastrada) {
                                  setErro('Cadastre o PDF da sua assinatura digital antes de assinar.');
                                  return;
                                }
                                const anexoOrc = anexosOrcamento(pedido, escolhida.id)
                                  .find((a) => a.tipo === 'orcamento');
                                if (!anexoOrc) {
                                  setErro('Anexe o PDF do orçamento vencedor antes de assinar.');
                                  return;
                                }
                                setErro('');
                                setOk('');
                                setModalAssinatura({
                                  pedidoId: pedido.id,
                                  anexoOrcamentoId: anexoOrc.id,
                                  fornecedorNome: escolhida.fornecedor_nome || '',
                                });
                              }}
                            >
                              {assinandoId === pedido.id ? 'Assinando…' : 'Posicionar e assinar'}
                            </PremiumButton>
                          </div>
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
              )}
            </SectionCard>
          </div>
        </ScrollArea>
      </MainShell>
      <ModalPosicionarAssinaturaOrcamento
        aberto={Boolean(modalAssinatura)}
        pedidoId={modalAssinatura?.pedidoId}
        anexoOrcamentoId={modalAssinatura?.anexoOrcamentoId}
        fornecedorNome={modalAssinatura?.fornecedorNome || ''}
        onFechar={() => {
          if (assinandoId) return;
          setModalAssinatura(null);
        }}
        onConfirmar={async (posicao) => {
          if (!modalAssinatura?.pedidoId) return;
          setAssinandoId(modalAssinatura.pedidoId);
          try {
            await comprasAssinarOrcamentoSede(modalAssinatura.pedidoId, posicao);
            setModalAssinatura(null);
            setOk('Orçamento assinado no local escolhido. Pedido aprovado — o projeto já pode seguir.');
            await carregar();
          } finally {
            setAssinandoId('');
          }
        }}
      />
    </AppShell>
  );
}
