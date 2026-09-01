import { useEffect, useState } from 'react';

import Sidebar from '../Sidebar';
import { AppShell, MainShell, PageHeader, ScrollArea } from '../components/PremiumUI';
import api from '../services/api';

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

const FORM_VAZIO = {
  nome: '',
  tipo: 'corrente',
  saldo: '0',
  rende: false,
};

export default function FinanceContas() {
  const [contas, setContas] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/financeiro/contas');
      setContas(response.data || []);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar as contas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const criarConta = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');
    setSalvando(true);

    try {
      await api.post('/api/financeiro/contas', {
        nome: form.nome.trim(),
        tipo: form.tipo,
        saldo: Number(form.saldo || 0),
        rende: Boolean(form.rende),
      });
      setForm(FORM_VAZIO);
      setSucesso('Conta cadastrada.');
      await carregar();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível cadastrar a conta.');
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
          title="Contas"
          subtitle="Cadastre contas correntes, poupança e acompanhe saldos."
          icon="₢"
        />

        <ScrollArea className="pb-24">
          <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-gray-900">Contas cadastradas</h2>

              {erro ? (
                <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{erro}</div>
              ) : null}
              {sucesso ? (
                <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">{sucesso}</div>
              ) : null}

              {loading ? (
                <p className="mt-4 text-sm text-gray-500">Carregando contas...</p>
              ) : !contas.length ? (
                <p className="mt-4 text-sm text-gray-500">Nenhuma conta cadastrada.</p>
              ) : (
                <ul className="mt-4 divide-y divide-gray-100">
                  {contas.map((conta) => (
                    <li key={conta.id} className="flex items-center justify-between gap-3 py-4">
                      <div>
                        <p className="font-bold text-gray-900">{conta.nome}</p>
                        <p className="text-xs uppercase tracking-wide text-gray-500">{conta.tipo}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-gray-900">{formatarMoeda(conta.saldo)}</p>
                        {conta.rende ? (
                          <span className="text-[10px] font-bold uppercase text-emerald-700">Rende</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-gray-900">Nova conta</h2>
              <form className="mt-4 grid gap-3" onSubmit={criarConta}>
                <label className="grid gap-1 text-sm font-bold text-gray-700">
                  Nome
                  <input
                    className="min-h-11 rounded-xl border border-gray-200 px-3"
                    value={form.nome}
                    onChange={(event) => setForm((prev) => ({ ...prev, nome: event.target.value }))}
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
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="investimento">Investimento</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-bold text-gray-700">
                  Saldo inicial
                  <input
                    type="number"
                    step="0.01"
                    className="min-h-11 rounded-xl border border-gray-200 px-3"
                    value={form.saldo}
                    onChange={(event) => setForm((prev) => ({ ...prev, saldo: event.target.value }))}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.rende}
                    onChange={(event) => setForm((prev) => ({ ...prev, rende: event.target.checked }))}
                  />
                  Conta com rendimento
                </label>
                <button
                  type="submit"
                  disabled={salvando}
                  className="mt-2 rounded-xl bg-brand px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {salvando ? 'Salvando...' : 'Cadastrar conta'}
                </button>
              </form>
            </section>
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
