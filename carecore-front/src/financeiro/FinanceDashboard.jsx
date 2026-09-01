import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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

function CartaoResumo({ titulo, valor, destaque = 'padrao' }) {
  const classes = {
    padrao: 'border-gray-100 bg-white text-gray-900',
    positivo: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    negativo: 'border-rose-100 bg-rose-50 text-rose-950',
  };

  return (
    <article className={`rounded-3xl border p-5 shadow-sm ${classes[destaque] || classes.padrao}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className="mt-2 text-2xl font-black">{valor}</p>
    </article>
  );
}

export default function FinanceDashboard() {
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;

    api.get('/api/financeiro/dashboard')
      .then((response) => {
        if (ativo) setResumo(response.data);
      })
      .catch((error) => {
        if (ativo) {
          setErro(error.response?.data?.detail || 'Não foi possível carregar o dashboard financeiro.');
        }
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Finanças"
          title="Dashboard"
          subtitle="Visão consolidada das suas contas e movimentações do mês."
          icon="₢"
        />

        <ScrollArea className="pb-24">
          <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-6">
            {erro ? (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
                {erro}
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-8 text-sm text-gray-500">
                Carregando resumo financeiro...
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <CartaoResumo titulo="Saldo total" valor={formatarMoeda(resumo?.saldo_total)} destaque="padrao" />
                  <CartaoResumo titulo="Contas" valor={String(resumo?.contas_ativas || 0)} />
                  <CartaoResumo titulo="Receitas (mês)" valor={formatarMoeda(resumo?.receitas_mes)} destaque="positivo" />
                  <CartaoResumo titulo="Despesas (mês)" valor={formatarMoeda(resumo?.despesas_mes)} destaque="negativo" />
                </div>

                <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-gray-900">Movimentações recentes</h2>
                      <p className="text-sm text-gray-500">Últimas transações registradas na organização financeira.</p>
                    </div>
                    <Link
                      to="/financeiro/extrato"
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                    >
                      Ver extrato completo
                    </Link>
                  </div>

                  {!resumo?.transacoes_recentes?.length ? (
                    <p className="mt-6 text-sm text-gray-500">Nenhuma transação registrada ainda.</p>
                  ) : (
                    <ul className="mt-6 divide-y divide-gray-100">
                      {resumo.transacoes_recentes.map((item) => (
                        <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div>
                            <p className="font-bold text-gray-900">{item.descricao}</p>
                            <p className="text-xs text-gray-500">
                              {formatarDataBr(item.data)} · {item.categoria || 'Sem categoria'}
                            </p>
                          </div>
                          <span className={`text-sm font-black ${item.valor < 0 || item.tipo === 'despesa' ? 'text-rose-700' : 'text-emerald-700'}`}>
                            {formatarMoeda(item.valor)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
