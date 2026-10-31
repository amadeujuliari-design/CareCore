import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Eye, FilePenLine } from 'lucide-react';

import Sidebar from './Sidebar';
import ModalPosicionarAssinaturaOrcamento from './components/ModalPosicionarAssinaturaOrcamento';
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
  comprasArquivarOrcamentoGovBr,
  comprasAssinarOrcamentoSede,
  comprasAssinaturaDigitalStatus,
  comprasBaixarAnexo,
  comprasContratoAssinado,
  comprasEnviarFilaRepresentante,
  comprasEscolherCotacao,
  comprasFilaAssinatura,
  comprasRevisarContrato,
  comprasRevogarEscolhaCotacao,
  comprasUploadAssinaturaDigital,
  moneyCentavos,
} from './services/comprasService';
import { usuarioEhAdmCompras, usuarioEhManutencao, usuarioGlobalAssinaOrcamento } from './utils/rbacUtils';
import { formatarDataHoraBr } from './utils/dataBrasilUtils';
import { agruparFilaAssinaturaPorUnidade } from './utils/comprasFilaAssinaturaUtils';
import { anexoOrcamentoParaAssinar, CLASSE_LINHA_ORCAMENTO, cotacoesComEscolhidaPrimeiro, ehOrcamentoUnificado, rotuloTipoPedido } from './utils/comprasPedidoTipos';

function usuarioSessao() {
  try {
    return JSON.parse(localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario') || '{}');
  } catch {
    return {};
  }
}

const URL_ASSINADOR_GOVBR = 'https://assinador.iti.br/';

function GovBrAssinatura({ pedido, escolhida, enviando, onErro, onOk, onEnviando, onArquivado, onVisualizar }) {
  const anexo = anexoOrcamentoParaAssinar(pedido.anexos, escolhida.id);
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">Assinar no portal gov.br</p>
      <p className="mt-1 text-xs text-slate-600">
        A assinatura é feita no site do governo, com conta prata ou ouro. Ao enviar o PDF assinado, o CareCore arquiva o arquivo e aprova o pedido.
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed">
        <li>Baixe o orçamento vencedor.</li>
        <li>Abra o Assinador gov.br e entre com CPF e senha.</li>
        <li>Em Assinatura de documento, envie esse PDF, marque o lugar da assinatura e confirme com o código do aplicativo gov.br.</li>
        <li>Baixe o arquivo assinado pelo botão de download do site. Esse arquivo já é o PDF com a assinatura. Não use Imprimir nem “Salvar como PDF”: isso cria uma cópia sem a assinatura digital.</li>
        <li>Envie o PDF assinado aqui. O pedido é aprovado nesse momento.</li>
      </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
        <PremiumButton
          variant="secondary"
          disabled={!anexo}
          onClick={() => {
            if (!anexo) {
              onErro('Este orçamento ainda não tem PDF para visualizar.');
              return;
            }
            onVisualizar?.(anexo);
          }}
        >
          Visualizar
        </PremiumButton>
        <PremiumButton
          variant="secondary"
          disabled={!anexo}
          onClick={() => {
            if (!anexo) {
              onErro('Este orçamento ainda não tem PDF para baixar.');
              return;
            }
            comprasBaixarAnexo(pedido.id, anexo.id, anexo.nome_arquivo).catch(() => {
              onErro('Não foi possível baixar o orçamento.');
            });
          }}
        >
          Baixar orçamento
        </PremiumButton>
        <a
          href={URL_ASSINADOR_GOVBR}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-slate-400"
        >
          Abrir Assinador gov.br
        </a>
        <label className="inline-flex cursor-pointer items-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
          {enviando ? 'Enviando…' : 'Enviar PDF assinado'}
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            disabled={enviando}
            onChange={async (event) => {
              const arquivo = event.target.files?.[0];
              event.target.value = '';
              if (!arquivo) return;
              onErro('');
              onOk('');
              onEnviando(true);
              try {
                await comprasArquivarOrcamentoGovBr(pedido.id, arquivo);
                onOk('PDF assinado no gov.br arquivado. Pedido aprovado.');
                await onArquivado();
              } catch (err) {
                onErro(err.response?.data?.detail || err.message || 'Não foi possível arquivar o PDF.');
              } finally {
                onEnviando(false);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

function dataHoraOuTraco(valor) {
  return formatarDataHoraBr(valor) || '—';
}

function AnexoFila({ pedidoId, anexo, rotulo, onVisualizar, onErro }) {
  if (!anexo) return null;
  const quando = formatarDataHoraBr(anexo.criado_em);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PremiumButton
        variant="secondary"
        onClick={() => onVisualizar?.(anexo)}
      >
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Visualizar
        </span>
      </PremiumButton>
      <button
        type="button"
        className="text-xs font-semibold text-violet-700 underline"
        onClick={() => {
          comprasBaixarAnexo(pedidoId, anexo.id, anexo.nome_arquivo).catch(() => {
            onErro?.('Não foi possível baixar o arquivo.');
          });
        }}
      >
        {rotulo}
        {anexo.nome_arquivo ? `: ${anexo.nome_arquivo}` : ''}
      </button>
      {quando ? (
        <span className="text-[11px] tabular-nums text-slate-500">{quando}</span>
      ) : null}
    </div>
  );
}

function ContratoFila({ pedido, modo, enviando, onErro, onOk, onEnviando, onPronto, onVisualizar }) {
  const contrato = pedido.contrato || {};
  const titulo = [pedido.titulo, pedido.instituicao_nome || 'Projeto', 'Contrato'].filter(Boolean).join(' · ');
  return (
    <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm font-semibold text-slate-900">{titulo}</p>
      <p className="mt-1 text-xs text-slate-500">
        {contrato.nome_arquivo || 'Contrato'}
        {' · Anexado em '}
        {dataHoraOuTraco(contrato.criado_em)}
        {' · Atualizado em '}
        {dataHoraOuTraco(pedido.atualizado_em)}
      </p>
      <div className="mt-3">
        <AnexoFila
          pedidoId={pedido.id}
          anexo={contrato.id ? contrato : null}
          rotulo="Contrato"
          onVisualizar={onVisualizar}
          onErro={onErro}
        />
      </div>
      {modo === 'infra' ? (
        <div className="mt-3">
          <PremiumButton
            disabled={enviando}
            onClick={async () => {
              onErro('');
              onOk('');
              onEnviando(true);
              try {
                await comprasRevisarContrato(pedido.id, contrato.id);
                onOk('Contrato enviado para a fila da Noemi.');
                await onPronto();
              } catch (err) {
                onErro(err.response?.data?.detail || err.message || 'Não foi possível enviar o contrato.');
              } finally {
                onEnviando(false);
              }
            }}
          >
            Ok, enviar à Noemi
          </PremiumButton>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Assinar no portal gov.br</p>
          <p className="mt-1 text-xs text-slate-600">
            Baixe o contrato, assine no Assinador gov.br e envie aqui o PDF que o site devolve.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PremiumButton
              variant="secondary"
              onClick={() => {
                comprasBaixarAnexo(pedido.id, contrato.id, contrato.nome_arquivo).catch(() => {
                  onErro('Não foi possível baixar o contrato.');
                });
              }}
            >
              Baixar contrato
            </PremiumButton>
            <a
              href={URL_ASSINADOR_GOVBR}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-slate-400"
            >
              Abrir Assinador gov.br
            </a>
            <label className="inline-flex cursor-pointer items-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
              {enviando ? 'Enviando…' : 'Enviar PDF assinado'}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                disabled={enviando}
                onChange={async (event) => {
                  const arquivo = event.target.files?.[0];
                  event.target.value = '';
                  if (!arquivo) return;
                  onErro('');
                  onOk('');
                  onEnviando(true);
                  try {
                    const fd = new FormData();
                    fd.append('arquivo', arquivo);
                    await comprasContratoAssinado(pedido.id, contrato.id, fd);
                    onOk('Contrato assinado. O projeto foi avisado na timeline.');
                    await onPronto();
                  } catch (err) {
                    onErro(err.response?.data?.detail || err.message || 'Não foi possível arquivar o contrato.');
                  } finally {
                    onEnviando(false);
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}
    </li>
  );
}

function anexosOrcamento(pedido, cotacaoId) {
  return (pedido.anexos || []).filter(
    (a) => a.cotacao_id === cotacaoId && (a.tipo === 'orcamento' || a.tipo === 'orcamento_assinado'),
  );
}

function PedidoFila({
  pedido,
  modo,
  assinatura,
  assinandoId,
  acaoId,
  painelGovId,
  enviandoGovId,
  onErro,
  onOk,
  onAcao,
  onAssinar,
  onPainelGov,
  onEnviandoGov,
  onArquivado,
  onVisualizar,
  onCarregar,
  navigate,
}) {
  const escolhida = (pedido.cotacoes || []).find((c) => c.escolhida);
  const cotacoes = (pedido.cotacoes || []).filter((c) => c.ativa !== false);
  const avisos = pedido.aviso_sede_sem_tres_orcamentos;
  const enviadoEm = pedido.submetido_em || pedido.aprovado_unidade_em;
  return (
    <li className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
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
            Enviado em {dataHoraOuTraco(enviadoEm)}
            {' · Atualizado em '}
            {dataHoraOuTraco(pedido.atualizado_em)}
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
            {cotacoesComEscolhidaPrimeiro(cotacoes).map((c) => {
              const anexos = anexosOrcamento(pedido, c.id);
              return (
                <li
                  key={c.id}
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    c.escolhida ? 'border-emerald-400 bg-emerald-50' : 'border-slate-100'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={c.escolhida ? 'text-emerald-950' : 'text-slate-900'}>
                      <span className={CLASSE_LINHA_ORCAMENTO}>
                        {c.fornecedor_nome}
                        {' · '}
                        {moneyCentavos(c.valor_centavos)}
                        {c.escolhida ? ' · Escolhida' : ''}
                      </span>
                      {c.criado_em ? (
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          · {dataHoraOuTraco(c.criado_em)}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {modo === 'infra' && !c.escolhida && (
                        <PremiumButton
                          disabled={acaoId === pedido.id}
                          onClick={async () => {
                            onErro('');
                            onOk('');
                            onAcao(pedido.id);
                            try {
                              await comprasEscolherCotacao(pedido.id, c.id);
                              onOk(`Orçamento de ${c.fornecedor_nome} marcado como vencedor.`);
                              await onCarregar();
                            } catch (err) {
                              onErro(err.response?.data?.detail || err.message || 'Falha ao escolher.');
                            } finally {
                              onAcao('');
                            }
                          }}
                        >
                          Escolher
                        </PremiumButton>
                      )}
                      {modo === 'infra' && c.escolhida && (
                        <PremiumButton
                          variant="secondary"
                          disabled={acaoId === pedido.id}
                          onClick={async () => {
                            if (!window.confirm('Revogar esta escolha e selecionar outro orçamento?')) return;
                            onErro('');
                            onOk('');
                            onAcao(pedido.id);
                            try {
                              await comprasRevogarEscolhaCotacao(pedido.id);
                              onOk('Escolha revogada.');
                              await onCarregar();
                            } catch (err) {
                              onErro(err.response?.data?.detail || err.message || 'Falha ao revogar.');
                            } finally {
                              onAcao('');
                            }
                          }}
                        >
                          Revogar
                        </PremiumButton>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-col gap-2">
                    {anexos.map((anexo) => (
                      <AnexoFila
                        key={anexo.id}
                        pedidoId={pedido.id}
                        anexo={anexo}
                        rotulo={
                          anexo.tipo === 'orcamento_assinado'
                            ? 'Assinado'
                            : ehOrcamentoUnificado(anexo)
                              ? 'Pacote unificado'
                              : 'Orçamento'
                        }
                        onVisualizar={onVisualizar}
                        onErro={onErro}
                      />
                    ))}
                    {anexos.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum PDF anexado neste orçamento.</p>
                    ) : null}
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
          {modo === 'infra' ? (
            <>
              <PremiumButton
                disabled={
                  assinandoId === pedido.id
                  || !escolhida
                  || !assinatura.cadastrada
                  || anexosOrcamento(pedido, escolhida?.id).filter((a) => a.tipo === 'orcamento').length === 0
                }
                onClick={() => {
                  if (!assinatura.cadastrada) {
                    onErro('Cadastre o PDF da sua assinatura digital antes de assinar.');
                    return;
                  }
                  const anexoOrc = anexoOrcamentoParaAssinar(pedido.anexos, escolhida.id);
                  if (!anexoOrc) {
                    onErro('Anexe o PDF do orçamento vencedor antes de assinar.');
                    return;
                  }
                  onErro('');
                  onOk('');
                  onAssinar({
                    pedidoId: pedido.id,
                    anexoOrcamentoId: anexoOrc.id,
                    fornecedorNome: escolhida.fornecedor_nome || '',
                  });
                }}
              >
                {assinandoId === pedido.id ? 'Assinando…' : 'Posicionar e assinar'}
              </PremiumButton>
              <PremiumButton
                disabled={acaoId === pedido.id || !escolhida}
                onClick={async () => {
                  onErro('');
                  onOk('');
                  onAcao(pedido.id);
                  try {
                    await comprasEnviarFilaRepresentante(pedido.id);
                    onOk('Orçamento enviado para a fila da Noemi.');
                    await onCarregar();
                  } catch (err) {
                    onErro(err.response?.data?.detail || err.message || 'Não foi possível enviar à Noemi.');
                  } finally {
                    onAcao('');
                  }
                }}
              >
                Enviar para a fila do representante legal
              </PremiumButton>
            </>
          ) : (
            <PremiumButton
              disabled={!escolhida}
              onClick={() => {
                onErro('');
                onPainelGov((atual) => (atual === pedido.id ? '' : pedido.id));
              }}
            >
              Assinar com gov.br
            </PremiumButton>
          )}
        </div>
      </div>
      {modo === 'representante' && painelGovId === pedido.id && escolhida && (
        <GovBrAssinatura
          pedido={pedido}
          escolhida={escolhida}
          enviando={enviandoGovId === pedido.id}
          onErro={onErro}
          onOk={onOk}
          onEnviando={(ativo) => onEnviandoGov(ativo ? pedido.id : '')}
          onArquivado={onArquivado}
          onVisualizar={onVisualizar}
        />
      )}
      <p className="mt-2 text-xs text-slate-500">
        <Link className="font-semibold text-violet-700 underline" to={`/compras/pedidos/${pedido.id}`}>
          Ver itens e timeline
        </Link>
      </p>
    </li>
  );
}

export default function ComprasAguardandoAssinatura() {
  const navigate = useNavigate();
  const usuario = useMemo(() => usuarioSessao(), []);
  const sede = usuarioEhAdmCompras(usuario) || usuarioEhManutencao(usuario) || usuarioGlobalAssinaOrcamento(usuario);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [fila, setFila] = useState({
    ver_infra: false,
    ver_representante: false,
    orcamentos_infra: [],
    orcamentos_representante: [],
    contratos_infra: [],
    contratos_representante: [],
  });
  const [assinandoId, setAssinandoId] = useState('');
  const [painelGovId, setPainelGovId] = useState('');
  const [enviandoGovId, setEnviandoGovId] = useState('');
  const [acaoId, setAcaoId] = useState('');
  const [assinatura, setAssinatura] = useState({ cadastrada: false, nome_arquivo: null });
  const [modalAssinatura, setModalAssinatura] = useState(null);
  const [modalAnexo, setModalAnexo] = useState(null);
  const [unidadeExpandida, setUnidadeExpandida] = useState('');
  const ocupadoRef = useRef(false);
  useEffect(() => {
    ocupadoRef.current = Boolean(modalAssinatura || modalAnexo || painelGovId || enviandoGovId || acaoId || assinandoId);
  }, [modalAssinatura, modalAnexo, painelGovId, enviandoGovId, acaoId, assinandoId]);

  const carregar = useCallback(async ({ silencioso = false } = {}) => {
    if (!silencioso) {
      setErro('');
      setCarregando(true);
    }
    try {
      if (!sede) {
        return;
      }
      const [dados, statusAssinatura] = await Promise.all([
        comprasFilaAssinatura(),
        comprasAssinaturaDigitalStatus().catch(() => ({ cadastrada: false })),
      ]);
      setAssinatura(statusAssinatura || { cadastrada: false });
      setFila({
        ver_infra: Boolean(dados?.ver_infra),
        ver_representante: Boolean(dados?.ver_representante),
        orcamentos_infra: dados?.orcamentos_infra || [],
        orcamentos_representante: dados?.orcamentos_representante || [],
        contratos_infra: dados?.contratos_infra || [],
        contratos_representante: dados?.contratos_representante || [],
      });
    } catch (err) {
      if (!silencioso) {
        setErro(err.response?.data?.detail || err.message || 'Não foi possível carregar a fila.');
      }
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, [sede]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!sede) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || ocupadoRef.current) return;
      carregar({ silencioso: true });
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
          subtitle={fila.ver_representante && !fila.ver_infra
            ? 'Contratos e orçamentos enviados pela Infraestrutura, para assinatura no gov.br.'
            : 'A Infraestrutura posiciona e assina, ou envia o orçamento ao representante legal. O contrato passa pelo ok dela e depois vai para a Noemi.'}
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

            {fila.ver_infra && (
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
            )}

            {[
              fila.ver_infra ? {
                chave: 'infra',
                titulo: 'Fila da Infraestrutura',
                orcamentos: fila.orcamentos_infra,
                contratos: fila.contratos_infra,
                modo: 'infra',
                vazio: 'Nenhum orçamento ou contrato aguardando a Infraestrutura.',
              } : null,
              fila.ver_representante ? {
                chave: 'representante',
                titulo: 'Fila do representante legal',
                orcamentos: fila.orcamentos_representante,
                contratos: fila.contratos_representante,
                modo: 'representante',
                vazio: 'Nenhum contrato ou orçamento aguardando a Noemi.',
              } : null,
            ].filter(Boolean).map((bloco) => (
            <SectionCard
              key={bloco.chave}
              title={`${bloco.titulo} (${bloco.orcamentos.length + bloco.contratos.length})`}
              subtitle={
                (bloco.orcamentos.length + bloco.contratos.length) > 0
                  ? 'Agrupado por unidade — clique na linha para expandir os pedidos daquele projeto.'
                  : undefined
              }
            >
              {carregando ? (
                <p className="text-sm text-slate-500">Carregando…</p>
              ) : (bloco.orcamentos.length + bloco.contratos.length) === 0 ? (
                <EmptyState
                  title="Nenhum item nesta fila"
                  subtitle={bloco.vazio}
                />
              ) : (
                <ul className="space-y-2">
                  {agruparFilaAssinaturaPorUnidade(bloco.orcamentos, bloco.contratos).map((grupo) => {
                    const chaveExp = `${bloco.chave}:${grupo.chave}`;
                    const aberto = unidadeExpandida === chaveExp;
                    return (
                      <li key={chaveExp} className="overflow-hidden rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          className="flex w-full flex-wrap items-center justify-between gap-3 bg-slate-50/80 px-4 py-3 text-left hover:bg-slate-100/80"
                          onClick={() => setUnidadeExpandida((atual) => (atual === chaveExp ? '' : chaveExp))}
                        >
                          <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-slate-900">
                            {aberto ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                            )}
                            <span className="truncate">{grupo.nome}</span>
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-700">
                              {grupo.qtd}
                              {grupo.qtd === 1 ? ' item' : ' itens'}
                            </span>
                          </span>
                          <span className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                            <span>{grupo.tiposRotulo || '—'}</span>
                            <span className="tabular-nums">
                              Atualizado em {dataHoraOuTraco(grupo.atualizado)}
                            </span>
                            <span className="font-semibold text-slate-700">
                              {aberto ? 'Recolher' : 'Expandir'}
                            </span>
                          </span>
                        </button>
                        {aberto ? (
                          <ul className="space-y-3 border-t border-slate-100 bg-white p-3">
                            {grupo.itens.map((pedido) => (
                              pedido._filaKind === 'contrato' ? (
                                <ContratoFila
                                  key={pedido.contrato?.id || `contrato-${pedido.id}`}
                                  pedido={pedido}
                                  modo={bloco.modo}
                                  enviando={acaoId === pedido.id}
                                  onErro={setErro}
                                  onOk={setOk}
                                  onEnviando={(ativo) => setAcaoId(ativo ? pedido.id : '')}
                                  onPronto={() => carregar()}
                                  onVisualizar={(anexo) => setModalAnexo({ pedidoId: pedido.id, anexo })}
                                />
                              ) : (
                                <PedidoFila
                                  key={pedido.id}
                                  pedido={pedido}
                                  modo={bloco.modo}
                                  assinatura={assinatura}
                                  assinandoId={assinandoId}
                                  acaoId={acaoId}
                                  painelGovId={painelGovId}
                                  enviandoGovId={enviandoGovId}
                                  onErro={setErro}
                                  onOk={setOk}
                                  onAcao={setAcaoId}
                                  onAssinar={setModalAssinatura}
                                  onPainelGov={setPainelGovId}
                                  onEnviandoGov={setEnviandoGovId}
                                  onArquivado={carregar}
                                  onVisualizar={(anexo) => setModalAnexo({ pedidoId: pedido.id, anexo })}
                                  onCarregar={carregar}
                                  navigate={navigate}
                                />
                              )
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
            ))}
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
