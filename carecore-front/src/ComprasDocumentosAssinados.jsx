import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive } from 'lucide-react';

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
  comprasDocumentosAssinados,
  comprasSubstituirContratoAssinado,
} from './services/comprasService';
import { formatarDataHoraBr } from './utils/dataBrasilUtils';

export default function ComprasDocumentosAssinados() {
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [itens, setItens] = useState([]);
  const [trocandoId, setTrocandoId] = useState('');
  const [modalAnexo, setModalAnexo] = useState(null);

  const carregar = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const dados = await comprasDocumentosAssinados();
      setItens(Array.isArray(dados) ? dados : []);
    } catch (err) {
      setErro(err.response?.data?.detail || err.message || 'Não foi possível carregar os documentos.');
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Compras · Representante legal"
          title="Documentos assinados"
          subtitle="Se o PDF assinado foi o arquivo errado, substitua por aqui. O anterior sai e o novo permanece no processo."
          icon={<Archive className="h-5 w-5" />}
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
                {typeof erro === 'string' ? erro : (erro?.message || 'Não foi possível concluir.')}
              </div>
            )}
            {ok && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{ok}</div>
            )}
            <SectionCard title={`Contratos assinados (${itens.length})`}>
              {carregando ? (
                <p className="text-sm text-slate-500">Carregando…</p>
              ) : itens.length === 0 ? (
                <EmptyState
                  title="Nenhum contrato assinado"
                  subtitle="Quando um contrato for assinado no gov.br, ele aparece aqui para consulta ou substituição."
                />
              ) : (
                <ul className="space-y-3">
                  {itens.map((item) => (
                    <li key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        {[item.titulo, item.projeto, 'Contrato'].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.nome_arquivo}
                        {item.assinado_em ? ` · ${formatarDataHoraBr(item.assinado_em)}` : ''}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <PremiumButton
                          variant="secondary"
                          onClick={() => setModalAnexo({
                            pedidoId: item.pedido_id,
                            anexo: { id: item.id, nome_arquivo: item.nome_arquivo },
                          })}
                        >
                          Visualizar
                        </PremiumButton>
                        <PremiumButton
                          variant="secondary"
                          onClick={() => {
                            comprasBaixarAnexo(item.pedido_id, item.id, item.nome_arquivo).catch(() => {
                              setErro('Não foi possível baixar o contrato.');
                            });
                          }}
                        >
                          Baixar
                        </PremiumButton>
                        <Link
                          to={`/compras/pedidos/${item.pedido_id}`}
                          className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-slate-400"
                        >
                          Abrir pedido
                        </Link>
                        {item.pode_substituir ? (
                          <label className="inline-flex cursor-pointer items-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                            {trocandoId === item.id ? 'Enviando…' : 'Substituir arquivo'}
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              className="sr-only"
                              disabled={trocandoId === item.id}
                              onChange={async (event) => {
                                const arquivo = event.target.files?.[0];
                                event.target.value = '';
                                if (!arquivo) return;
                                if (!window.confirm('Substituir o contrato assinado por este arquivo? O PDF atual deixa de valer.')) return;
                                setErro('');
                                setOk('');
                                setTrocandoId(item.id);
                                try {
                                  await comprasSubstituirContratoAssinado(item.pedido_id, item.id, arquivo);
                                  setOk('Contrato assinado substituído. O arquivo novo fica no processo.');
                                  await carregar();
                                } catch (err) {
                                  setErro(err.response?.data?.detail || err.message || 'Não foi possível substituir o contrato.');
                                } finally {
                                  setTrocandoId('');
                                }
                              }}
                            />
                          </label>
                        ) : (
                          <span className="text-xs text-slate-500">Processo encerrado. O arquivo não pode mais ser trocado.</span>
                        )}
                      </div>
                    </li>
                  ))}
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
