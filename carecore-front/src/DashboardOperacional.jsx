// =====================================================================
// ARQUIVO: src/DashboardOperacional.jsx
// DASHBOARD OPERACIONAL DA ROTINA — CARECORE+
// =====================================================================
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { API_ROOT } from './config/apiBase';

export default function DashboardOperacional() {
  const token = localStorage.getItem('@CareCore:token');

  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [abaLista, setAbaLista] = useState('presentes');

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  const carregarDashboard = async () => {
    try {
      setErro('');
      setLoading(true);

      const response = await axios.get(
        `${API_ROOT}/rotina/dashboard-operacional`,
        { headers }
      );

      setDados(response.data);
    } catch (error) {
      console.error(error);
      setErro(
        error.response?.data?.detail ||
        'Erro ao carregar dashboard operacional.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDashboard();
  }, []);

  const formatarDataHora = (data) => {
    if (!data) return '-';

    return new Date(data).toLocaleString('pt-BR');
  };

  const formatarHora = (data) => {
    if (!data) return '-';

    return new Date(data).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const resumo = dados?.resumo || {};

  const listaAtual = useMemo(() => {
    if (!dados) return [];

    if (abaLista === 'presentes') return dados.presentes || [];
    if (abaLista === 'fora') return dados.fora || [];
    return dados.sem_movimento || [];
  }, [dados, abaLista]);

  const cardsPrincipais = [
    {
      label: 'Presentes agora',
      valor: resumo.presentes_agora || 0,
      detalhe: `${resumo.percentual_presentes || 0}% dos ativos / estado real`,
      classe: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    },
    {
      label: 'Fora agora',
      valor: resumo.fora_agora || 0,
      detalhe: 'saída registrada ou sem entrada',
      classe: 'bg-orange-50 text-orange-700 border-orange-100'
    },
    {
      label: 'Entradas hoje',
      valor: resumo.entradas_hoje || 0,
      detalhe: 'registros válidos',
      classe: 'bg-blue-50 text-blue-700 border-blue-100'
    },
    {
      label: 'Almoços hoje',
      valor: resumo.almocos_hoje || 0,
      detalhe: 'refeições registradas',
      classe: 'bg-indigo-50 text-indigo-700 border-indigo-100'
    }
  ];

  const cardsAuditoria = [
    {
      label: 'Saídas hoje',
      valor: resumo.saidas_hoje || 0
    },
    {
      label: 'Retornos rápidos',
      valor: resumo.retornos_rapidos_hoje || 0
    },
    {
      label: 'Cancelados',
      valor: resumo.cancelados_hoje || 0
    },
    {
      label: 'Editados',
      valor: resumo.editados_hoje || 0
    },
    {
      label: 'Ativos cadastrados',
      valor: resumo.conviventes_ativos || 0
    }
  ];

  return (
    <AppShell>

      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Rotina"
          title="Dashboard Operacional"
          subtitle="Estado real de presença, movimentação diária, refeições e alertas operacionais."
          icon=">"
          actions={(
            <>
            {dados?.atualizado_em && (
              <span className="text-xs font-bold text-gray-500 bg-white border border-gray-100 rounded-xl px-3 py-2">
                Atualizado: {formatarDataHora(dados.atualizado_em)}
              </span>
            )}

            <PremiumButton
              type="button"
              variant="brand"
              onClick={carregarDashboard}
            >
              Atualizar
            </PremiumButton>
            </>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="w-full max-w-7xl mx-auto">

        {erro && (
          <div className="mb-6 bg-red-50 border border-red-100 text-red-700 rounded-2xl p-4 text-sm font-semibold">
            {erro}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-500">
            Carregando dashboard operacional...
          </div>
        ) : (

          <>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5">

              {cardsPrincipais.map(card => (
                <div
                  key={card.label}
                  className={`rounded-2xl border p-4 sm:p-5 shadow-sm ${card.classe}`}
                >
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-wide opacity-80">
                    {card.label}
                  </p>

                  <p className="text-3xl sm:text-4xl font-black mt-2">
                    {card.valor}
                  </p>

                  <p className="text-[11px] sm:text-xs font-bold mt-2 opacity-80">
                    {card.detalhe}
                  </p>
                </div>
              ))}

            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 mb-5">

              {cardsAuditoria.map(card => (
                <div
                  key={card.label}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4"
                >
                  <p className="text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-wide">
                    {card.label}
                  </p>

                  <p className="text-xl sm:text-2xl font-black text-gray-800 mt-1">
                    {card.valor}
                  </p>
                </div>
              ))}

            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

              <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h2 className="font-black text-gray-800">
                      Situação dos conviventes
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Estado calculado pelo último movimento histórico válido.
                    </p>
                  </div>

                  <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
                    <button
                      type="button"
                      onClick={() => setAbaLista('presentes')}
                      className={`min-w-fit px-3 py-2 rounded-xl text-xs font-black border ${
                        abaLista === 'presentes'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      Presentes
                    </button>

                    <button
                      type="button"
                      onClick={() => setAbaLista('fora')}
                      className={`min-w-fit px-3 py-2 rounded-xl text-xs font-black border ${
                        abaLista === 'fora'
                          ? 'bg-orange-600 text-white border-orange-600'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      Fora agora
                    </button>

                    <button
                      type="button"
                      onClick={() => setAbaLista('sem_movimento')}
                      className={`min-w-fit px-3 py-2 rounded-xl text-xs font-black border ${
                        abaLista === 'sem_movimento'
                          ? 'bg-gray-700 text-white border-gray-700'
                          : 'bg-white text-gray-600 border-gray-200'
                      }`}
                    >
                      Sem entrada/saída
                    </button>
                  </div>
                </div>

                <div className="space-y-3 p-3 md:hidden">
                  {listaAtual.length === 0 ? (
                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                      Nenhum convivente nesta visão.
                    </div>
                  ) : (
                    listaAtual.map(item => (
                      <article
                        key={item.convivente_id}
                        className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black uppercase text-gray-800">
                              {item.convivente_nome}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-gray-500">
                              Prontuário #{item.numero_institucional || 'S/N'}
                            </p>
                          </div>

                          {item.tipo_registro ? (
                            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${
                              item.tipo_registro === 'Entrada'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-orange-50 text-orange-700 border-orange-200'
                            }`}>
                              {item.tipo_registro}
                            </span>
                          ) : (
                            <span className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-black text-gray-500">
                              Sem mov.
                            </span>
                          )}
                        </div>

                        <div className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-gray-600">
                          Último movimento: {formatarDataHora(item.data_registro)}
                        </div>
                      </article>
                    ))
                  )}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[680px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">
                          Convivente
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">
                          Prontuário
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase">
                          Horário
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {listaAtual.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="text-center py-10 text-gray-500 text-sm"
                          >
                            Nenhum convivente nesta visão.
                          </td>
                        </tr>
                      ) : (
                        listaAtual.map(item => (
                          <tr
                            key={item.convivente_id}
                            className="border-b border-gray-50 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 text-sm font-black text-gray-800 uppercase">
                              {item.convivente_nome}
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-600">
                              #{item.numero_institucional || 'S/N'}
                            </td>

                            <td className="px-4 py-3">
                              {item.tipo_registro ? (
                                <span className={`text-xs font-black px-3 py-1 rounded-full border ${
                                  item.tipo_registro === 'Entrada'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-orange-50 text-orange-700 border-orange-200'
                                }`}>
                                  {item.tipo_registro}
                                </span>
                              ) : (
                                <span className="text-xs font-black px-3 py-1 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                                  Sem entrada/saída
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatarDataHora(item.data_registro)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              <div className="space-y-6">

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-black text-gray-800">
                      Alertas operacionais
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Pontos de atenção para conferência da equipe.
                    </p>
                  </div>

                  <div className="p-4 space-y-3">
                    {(dados?.alertas || []).length === 0 ? (
                      <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl p-4">
                        Nenhum alerta operacional no momento.
                      </div>
                    ) : (
                      dados.alertas.map(alerta => (
                        <div
                          key={alerta.tipo}
                          className="border border-amber-100 bg-amber-50 rounded-xl p-4"
                        >
                          <p className="text-sm font-black text-amber-800">
                            {alerta.titulo}
                          </p>

                          <p className="text-xs font-semibold text-amber-700 mt-1">
                            {alerta.descricao}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                  <div className="p-4 border-b border-gray-100">
                    <h2 className="font-black text-gray-800">
                      Últimos registros de hoje
                    </h2>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {(dados?.ultimos_registros || []).length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">
                        Nenhum registro hoje.
                      </div>
                    ) : (
                      dados.ultimos_registros.map(registro => (
                        <div
                          key={registro.id}
                          className="p-4 hover:bg-gray-50"
                        >
                          <div className="flex items-start justify-between gap-3">

                            <div>
                              <p className="text-sm font-black text-gray-800 uppercase">
                                {registro.convivente_nome}
                              </p>

                              <p className="text-xs text-gray-500 mt-0.5">
                                #{registro.numero_institucional || 'S/N'} · {registro.usuario_nome || 'Usuário'}
                              </p>
                            </div>

                            <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${
                              registro.tipo_registro === 'Entrada'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : registro.tipo_registro === 'Saída'
                                  ? 'bg-orange-50 text-orange-700 border-orange-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}>
                              {registro.tipo_registro}
                            </span>

                          </div>

                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs text-gray-500 font-semibold">
                              {formatarHora(registro.data_registro)}
                            </span>

                            {registro.retorno_rapido && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                                RETORNO RÁPIDO
                              </span>
                            )}

                            {registro.foi_editado && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-100">
                                EDITADO
                              </span>
                            )}

                            {registro.cancelado && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">
                                CANCELADO
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                </div>

              </div>

            </div>

          </>

        )}

          </div>
        </ScrollArea>

      </MainShell>
    </AppShell>
  );
}
