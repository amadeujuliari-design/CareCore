import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import api from './services/api';

export default function CobrancasAdmin() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [atuandoId, setAtuandoId] = useState(null);

  async function carregarPainel() {
    setErro('');
    try {
      setCarregando(true);
      const response = await api.get('/api/cobrancas/admin/operacao');
      setDados(response.data);
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar a operação financeira.');
    } finally {
      setCarregando(false);
    }
  }

  async function liberarTemporariamente(organizacao, dias) {
    const motivo = window.prompt(
      `Informe o motivo para liberar ${organizacao.organizacao_nome} por ${dias} dia(s):`
    );
    if (!motivo?.trim()) return;

    setErro('');
    try {
      setAtuandoId(organizacao.organizacao_id);
      await api.post(`/api/cobrancas/admin/organizacoes/${organizacao.organizacao_id}/liberacao-temporaria`, {
        dias,
        motivo: motivo.trim(),
      });
      await carregarPainel();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível liberar temporariamente a organização.');
    } finally {
      setAtuandoId(null);
    }
  }

  async function revogarLiberacao(liberacao) {
    if (!liberacao?.id) return;
    const motivo = window.prompt('Informe o motivo da revogação:', 'Revogação manual pela manutenção.');
    if (!motivo?.trim()) return;

    setErro('');
    try {
      setAtuandoId(liberacao.id);
      await api.post(`/api/cobrancas/admin/liberacoes/${liberacao.id}/revogar`, {
        motivo: motivo.trim(),
      });
      await carregarPainel();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível revogar a liberação.');
    } finally {
      setAtuandoId(null);
    }
  }

  useEffect(() => {
    carregarPainel();
  }, []);

  const itensFiltrados = useMemo(() => {
    const itens = dados?.itens || [];
    if (filtro === 'todos') return itens;
    return itens.filter((item) => item.status_operacao?.status === filtro);
  }, [dados, filtro]);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Manutenção"
          title="Operação Financeira"
          subtitle="Acompanhe organizações, faturas, alertas, bloqueios e liberações temporárias."
          icon={<ShieldCheck size={19} />}
        />
        <ScrollArea>
          <section className="mx-auto flex max-w-7xl flex-col gap-6">
            {erro ? (
              <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                <span>{erro}</span>
              </div>
            ) : null}

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <KpiCard titulo="Organizações" valor={dados?.totais?.organizacoes ?? '-'} />
              <KpiCard titulo="Em dia" valor={dados?.totais?.em_dia ?? '-'} tone="green" />
              <KpiCard titulo="Pendentes" valor={dados?.totais?.pendentes ?? '-'} tone="slate" />
              <KpiCard titulo="Alertas" valor={dados?.totais?.alertas ?? '-'} tone="amber" />
              <KpiCard titulo="Bloqueadas" valor={dados?.totais?.bloqueadas ?? '-'} tone="red" />
              <KpiCard titulo="Liberadas" valor={dados?.totais?.liberadas_temporariamente ?? '-'} tone="blue" />
            </section>

            <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm font-semibold text-blue-800 shadow-sm">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-500">Automação de cobranças</p>
                  <p className="mt-1 font-black text-blue-950">
                    Preparada, mas {dados?.automacao?.fechamento_automatico_ativo ? 'ativa' : 'desligada'}
                  </p>
                </div>
                <div className="text-xs font-bold text-blue-700">
                  <p>Fechamento automático: {dados?.automacao?.fechamento_automatico_ativo ? 'ativo' : 'desligado'}</p>
                  <p>Geração Asaas automática: {dados?.automacao?.geracao_asaas_automatica ? 'ativa' : 'desligada'}</p>
                  <p>Dia previsto: {dados?.automacao?.dia_fechamento || 25}</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Organizações e Cobranças</h2>
                  <p className="mt-1 text-sm font-medium text-slate-500">
                    Valor pendente total: {formatarMoeda(dados?.totais?.valor_total_pendente)}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    value={filtro}
                    onChange={(event) => setFiltro(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                  >
                    <option value="todos">Todos os status</option>
                    <option value="Em dia">Em dia</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Perto do vencimento">Perto do vencimento</option>
                    <option value="Em alerta">Em alerta</option>
                    <option value="Bloqueada">Bloqueada</option>
                    <option value="Liberada temporariamente">Liberada temporariamente</option>
                  </select>
                  <button
                    type="button"
                    onClick={carregarPainel}
                    disabled={carregando}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <RefreshCw className={carregando ? 'animate-spin' : ''} size={16} />
                    Atualizar
                  </button>
                </div>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
                <div className="overflow-x-auto">
                  <table className="min-w-[1180px] divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">Organização</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Projetos</th>
                        <th className="px-4 py-3 text-right">Faturas</th>
                        <th className="px-4 py-3 text-right">Pendente</th>
                        <th className="px-4 py-3 text-left">Ciclo atual</th>
                        <th className="px-4 py-3 text-left">Liberação</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {itensFiltrados.map((item) => (
                        <tr key={item.organizacao_id}>
                          <td className="px-4 py-3 align-top">
                            <p className="font-black text-slate-900">{item.organizacao_nome}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{item.cnpj || 'CNPJ não informado'}</p>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <StatusBadge status={item.status_operacao?.status} tone={item.status_operacao?.tone} />
                            <p className="mt-2 max-w-xs text-xs font-semibold text-slate-500">{item.status_operacao?.motivo}</p>
                          </td>
                          <td className="px-4 py-3 text-right align-top font-bold text-slate-700">
                            {item.projetos_ativos}/{item.projetos_total}
                          </td>
                          <td className="px-4 py-3 text-right align-top text-xs font-bold text-slate-600">
                            <p>Pagas: {item.faturas?.pagas ?? 0}</p>
                            <p>Pend.: {item.faturas?.pendentes ?? 0}</p>
                            <p>Venc.: {item.faturas?.vencidas ?? 0}</p>
                          </td>
                          <td className="px-4 py-3 text-right align-top font-black text-slate-900">
                            {formatarMoeda(item.faturas?.valor_pendente)}
                          </td>
                          <td className="px-4 py-3 align-top text-xs font-semibold text-slate-600">
                            {item.ciclo_atual ? (
                              <>
                                <p>{formatarData(item.ciclo_atual.data_fechamento)} · {item.ciclo_atual.status_pagamento}</p>
                                <p className="mt-1 font-black text-slate-900">{formatarMoeda(item.ciclo_atual.valor_total_mensalidade)}</p>
                              </>
                            ) : (
                              'Sem ciclo fechado'
                            )}
                          </td>
                          <td className="px-4 py-3 align-top text-xs font-semibold text-slate-600">
                            {item.liberacao_temporaria?.ativo ? (
                              <>
                                <p className="font-black text-blue-700">Até {formatarDataHora(item.liberacao_temporaria.liberado_ate)}</p>
                                <p className="mt-1 max-w-xs">{item.liberacao_temporaria.motivo}</p>
                              </>
                            ) : (
                              'Sem liberação ativa'
                            )}
                          </td>
                          <td className="px-4 py-3 text-right align-top">
                            <div className="flex flex-col items-end gap-2">
                              <button
                                type="button"
                                onClick={() => liberarTemporariamente(item, 7)}
                                disabled={atuandoId === item.organizacao_id}
                                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-300"
                              >
                                Liberar 7 dias
                              </button>
                              <button
                                type="button"
                                onClick={() => liberarTemporariamente(item, 15)}
                                disabled={atuandoId === item.organizacao_id}
                                className="rounded-xl border border-blue-100 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-50 disabled:text-slate-400"
                              >
                                Liberar 15 dias
                              </button>
                              {item.liberacao_temporaria?.ativo ? (
                                <button
                                  type="button"
                                  onClick={() => revogarLiberacao(item.liberacao_temporaria)}
                                  disabled={atuandoId === item.liberacao_temporaria.id}
                                  className="rounded-xl border border-red-100 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-50 disabled:text-slate-400"
                                >
                                  Revogar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!itensFiltrados.length ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center font-semibold text-slate-500">
                            Nenhuma organização encontrada para o filtro selecionado.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </section>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}

function KpiCard({ titulo, valor, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-100 bg-white text-slate-900',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    red: 'border-red-100 bg-red-50 text-red-800',
    blue: 'border-blue-100 bg-blue-50 text-blue-800',
  };

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">{titulo}</p>
      <p className="mt-2 text-2xl font-black">{valor}</p>
    </div>
  );
}

function StatusBadge({ status, tone = 'slate' }) {
  const tones = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${tones[tone] || tones.slate}`}>
      {status || 'Sem status'}
    </span>
  );
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '-';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(valor) {
  if (!valor) return '-';
  const [ano, mes, dia] = valor.split('-');
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(valor) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
