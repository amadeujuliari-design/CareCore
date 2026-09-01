import { useEffect, useState } from 'react';

import Sidebar from '../Sidebar';
import { AppShell, MainShell, PageHeader, ScrollArea } from '../components/PremiumUI';
import api from '../services/api';
import { formatarDataBr } from '../utils/dataBrasilUtils';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function hojeISO() {
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}

const FORM_VAZIO = {
  descricao: '',
  valor: '',
  tipo: 'despesa',
  categoria: '',
  data: hojeISO(),
  conta_id: '',
};

export default function FinanceExtrato() {
  const [transacoes, setTransacoes] = useState([]);
  const [contas, setContas] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const [transResp, contasResp] = await Promise.all([
        api.get('/api/financeiro/transacoes'),
        api.get('/api/financeiro/contas'),
      ]);
      setTransacoes(transResp.data || []);
      setContas(contasResp.data || []);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar o extrato.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const criarTransacao = async (event) => {
    event.preventDefault();
    setErro('');
    setSalvando(true);

    try {
      const valorNumerico = Number(form.valor);
      const valorFinal = form.tipo === 'despesa' ? -Math.abs(valorNumerico) : Math.abs(valorNumerico);

      await api.post('/api/financeiro/transacoes', {
        descricao: form.descricao.trim(),
        valor: valorFinal,
        tipo: form.tipo,
        categoria: form.categoria.trim() || null,
        data: form.data,
        conta_id: form.conta_id || null,
        pago: true,
      });

      setForm({ ...FORM_VAZIO, data: hojeISO(), conta_id: form.conta_id });
      await carregar();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível registrar a transação.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Finanças"
          title="Extrato"
          subtitle="Registre despesas e receitas vinculadas às suas contas."
          icon="₢"
        />

        <ScrollArea className="pb-24">
          <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-gray-900">Movimentações</h2>

              {erro ? (
                <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</div>
              ) : null}

              {loading ? (
                <p className="mt-4 text-sm text-gray-500">Carregando extrato...</p>
              ) : !transacoes.length ? (
                <p className="mt-4 text-sm text-gray-500">Nenhuma movimentação registrada.</p>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100">
                  {transacoes.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div>
                        <p className="font-bold text-gray-900">{item.descricao}</p>
                        <p className="text-xs text-gray-500">
                          {formatarDataBr(item.data)} · {item.categoria || 'Sem categoria'}
                        </p>
                      </div>
                      <span className={`text-sm font-black ${item.valor < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {formatarMoeda(item.valor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-gray-900">Nova movimentação</h2>
              <form className="mt-4 grid gap-3" onSubmit={criarTransacao}>
                <label className="grid gap-1 text-sm font-bold text-gray-700">
                  Descrição
                  <input
                    className="min-h-11 rounded-xl border border-gray-200 px-3"
                    value={form.descricao}
                    onChange={(event) => setForm((prev) => ({ ...prev, descricao: event.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold text-gray-700">
                  Valor
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="min-h-11 rounded-xl border border-gray-200 px-3"
                    value={form.valor}
                    onChange={(event) => setForm((prev) => ({ ...prev, valor: event.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold text-gray-700">
                  Tipo
                  <select
                    className="min-h-11 rounded-xl border border-gray-200 px-3"
                    value={form.tipo}
                    onChange={(event) => setForm((prev) => ({ ...prev, tipo: event.target.value }))}
                  >
                    <option value="despesa">Despesa</option>
                    <option value="receita">Receita</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold text-gray-700">
                  Categoria
                  <input
                    className="min-h-11 rounded-xl border border-gray-200 px-3"
                    value={form.categoria}
                    onChange={(event) => setForm((prev) => ({ ...prev, categoria: event.target.value }))}
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold text-gray-700">
                  Data
                  <input
                    type="date"
                    className="min-h-11 rounded-xl border border-gray-200 px-3"
                    value={form.data}
                    onChange={(event) => setForm((prev) => ({ ...prev, data: event.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold text-gray-700">
                  Conta
                  <select
                    className="min-h-11 rounded-xl border border-gray-200 px-3"
                    value={form.conta_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, conta_id: event.target.value }))}
                  >
                    <option value="">Sem conta vinculada</option>
                    {contas.map((conta) => (
                      <option key={conta.id} value={conta.id}>{conta.nome}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={salvando}
                  className="mt-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Registrar'}
                </button>
              </form>
            </section>
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
