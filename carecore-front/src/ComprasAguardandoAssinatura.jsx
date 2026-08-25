import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FilePenLine } from 'lucide-react';

import Sidebar from './Sidebar';
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
  comprasBaixarAnexo,
  comprasObterPedido,
  comprasPedidos,
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

  const carregar = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      if (!sede) {
        setItens([]);
        return;
      }
      const lista = await comprasPedidos({ status_pedido: 'aguardando_aprovacao_sede' });
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
          subtitle="Bem, manutenção e prestação de serviço: revise o orçamento vencedor, assine e devolva ao projeto."
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
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
            )}

            <SectionCard title="Fila da Sede">
              {carregando ? (
                <p className="text-sm text-slate-500">Carregando…</p>
              ) : itens.length === 0 ? (
                <EmptyState
                  title="Nenhum pedido aguardando assinatura"
                  subtitle="Quando o projeto enviar cotação com orçamento escolhido, ele aparece aqui."
                />
              ) : (
                <ul className="space-y-3">
                  {itens.map((pedido) => {
                    const escolhida = (pedido.cotacoes || []).find((c) => c.escolhida);
                    const anexos = escolhida ? anexosOrcamento(pedido, escolhida.id) : [];
                    return (
                      <li
                        key={pedido.id}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {pedido.instituicao_nome || 'Projeto'}
                              {' · '}
                              {rotuloTipoPedido(pedido.tipo)}
                              {pedido.competencia ? ` · ${pedido.competencia}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Enviado
                              {pedido.submetido_em ? ` em ${formatarDataBr(pedido.submetido_em)}` : ''}
                              {escolhida
                                ? ` · vencedor: ${escolhida.fornecedor_nome} (${moneyCentavos(escolhida.valor_centavos)})`
                                : ' · sem orçamento escolhido'}
                            </p>
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
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <PremiumButton
                              variant="secondary"
                              onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
                            >
                              Abrir pedido
                            </PremiumButton>
                            <PremiumButton
                              disabled={assinandoId === pedido.id || !escolhida || anexos.length === 0}
                              onClick={async () => {
                                if (!window.confirm(
                                  'Assinar digitalmente o orçamento vencedor e aprovar este pedido na Sede?',
                                )) return;
                                setErro('');
                                setOk('');
                                setAssinandoId(pedido.id);
                                try {
                                  await comprasAssinarOrcamentoSede(pedido.id);
                                  setOk('Orçamento assinado e pedido aprovado. O projeto já pode baixar a folha assinada.');
                                  await carregar();
                                } catch (err) {
                                  setErro(err.response?.data?.detail || err.message || 'Falha na assinatura.');
                                } finally {
                                  setAssinandoId('');
                                }
                              }}
                            >
                              {assinandoId === pedido.id ? 'Assinando…' : 'Assinar e aprovar'}
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
    </AppShell>
  );
}
