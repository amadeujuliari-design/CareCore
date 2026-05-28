import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { API_ROOT } from './config/apiBase';
import logoCarecore from './assets/logo.png';

export default function ConvenioSisa() {
  const token = localStorage.getItem('@CareCore:token');
  let perfilUsuario = '';
  let usuarioMaster = false;

  try {
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      perfilUsuario = payload.perfil_acesso || '';
      usuarioMaster = Boolean(payload.is_master);
    }
  } catch (error) {
    console.error('Erro ao ler token no Convênio/SISA', error);
  }

  const podeFecharOuReabrirMes =
    usuarioMaster ||
    ['Gestor', 'Gestao', 'Gestão', 'Gerente'].includes(perfilUsuario);

  const hoje = new Date();
  const dataHoje = hoje.toISOString().slice(0, 10);

  const [aba, setAba] = useState('mensal');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const [dataDiaria, setDataDiaria] = useState(dataHoje);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  const [diario, setDiario] = useState({ resumo: {}, items: [] });
  const [mensal, setMensal] = useState({ resumo: {}, items: [] });

  const [observacoesFechamento, setObservacoesFechamento] = useState('');
  const [fechamentoAtual, setFechamentoAtual] = useState(null);
  const [filtroLancamento, setFiltroLancamento] = useState('todos');

  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`
  }), [token]);

  const avisarErro = (mensagem) => {
    setSucesso('');
    setErro(mensagem);
  };

  const avisarSucesso = (mensagem) => {
    setErro('');
    setSucesso(mensagem);
  };

  const carregarDiario = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `${API_ROOT}/convenio-sisa/diario`,
        {
          headers,
          params: {
            data: dataDiaria
          }
        }
      );

      setDiario(response.data);
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao carregar relatório diário.'
      );
    } finally {
      setLoading(false);
    }
  };

  const carregarFechamentoAtual = async () => {
    try {
      const response = await axios.get(
        `${API_ROOT}/convenio-sisa/fechamentos`,
        {
          headers
        }
      );

      const encontrado = (response.data || []).find(item =>
        Number(item.ano) === Number(ano) &&
        Number(item.mes) === Number(mes)
      );

      setFechamentoAtual(encontrado || null);

      return encontrado || null;
    } catch (error) {
      console.error(error);
      setFechamentoAtual(null);
      return null;
    }
  };

  const carregarMensal = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `${API_ROOT}/convenio-sisa/mensal`,
        {
          headers,
          params: {
            ano,
            mes
          }
        }
      );

      setMensal(response.data);

      await carregarFechamentoAtual();
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao carregar relatório mensal.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDiario();
    carregarMensal();
  }, []);

  const formatarDataHora = (valor) => {
    if (!valor) return '-';

    return new Date(valor).toLocaleString('pt-BR');
  };

  const exportarMensalXlsx = async () => {
    try {
      const response = await axios.get(
        `${API_ROOT}/convenio-sisa/mensal/exportar-xlsx`,
        {
          headers,
          params: {
            ano,
            mes
          },
          responseType: 'blob'
        }
      );

      const blob = new Blob(
        [response.data],
        {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `relatorio_sisa_convenio_${ano}_${String(mes).padStart(2, '0')}.xlsx`;
      link.click();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      avisarErro('Erro ao exportar XLSX.');
    }
  };

  const imprimir = () => {
    const tituloOriginal = document.title;
    document.title = `Relatório Convênio SISA - ${aba === 'mensal' ? `${String(mes).padStart(2, '0')}/${ano}` : dataDiaria}`;
    setTimeout(() => {
      window.print();
      document.title = tituloOriginal;
    }, 100);
  };

  const fecharMes = async () => {
    if (mensal.resumo?.fechado) {
      avisarErro('Este mês já está fechado.');
      return;
    }

    const confirmado = window.confirm(
      `Confirma o fechamento do mês ${String(mes).padStart(2, '0')}/${ano}?`
    );

    if (!confirmado) return;

    try {
      await axios.post(
        `${API_ROOT}/convenio-sisa/fechar-mes`,
        {
          ano: Number(ano),
          mes: Number(mes),
          observacoes: observacoesFechamento
        },
        {
          headers
        }
      );

      setObservacoesFechamento('');
      await carregarMensal();

      avisarSucesso('Mês fechado com sucesso.');
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao fechar mês.'
      );
    }
  };

  const reabrirMes = async () => {
    const fechamentoId = resumoMensal.fechamento_id || fechamentoAtual?.id;

    if (!resumoMensal.fechado) {
      avisarErro('Este mês não está fechado.');
      return;
    }

    if (!fechamentoId) {
      avisarErro('Não foi possível localizar o fechamento deste mês. Atualize a tela e tente novamente.');
      await carregarMensal();
      return;
    }

    const motivo = window.prompt(
      `Informe o motivo da reabertura do mês ${String(mes).padStart(2, '0')}/${ano}:`
    );

    if (motivo === null) return;

    if (!motivo.trim()) {
      avisarErro('Informe o motivo da reabertura.');
      return;
    }

    const confirmado = window.confirm(
      'Confirma a reabertura deste mês? Após reabrir, alterações e lançamentos SISA voltarão a ser permitidos.'
    );

    if (!confirmado) return;

    try {
      await axios.patch(
        `${API_ROOT}/convenio-sisa/fechamentos/${fechamentoId}/reabrir`,
        {
          motivo_reabertura: motivo.trim()
        },
        {
          headers
        }
      );

      await carregarMensal();

      avisarSucesso('Mês reaberto com sucesso.');
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao reabrir mês.'
      );
    }
  };

  const marcarLancadoSisa = async (item) => {
    if (mensal.resumo?.fechado) {
      avisarErro('Este mês já está fechado.');
      return;
    }

    const observacoes = window.prompt(
      `Observações do lançamento SISA para ${item.nome} (opcional):`,
      item.observacoes_lancamento_sisa || ''
    );

    if (observacoes === null) return;

    try {
      await axios.post(
        `${API_ROOT}/convenio-sisa/lancamentos`,
        {
          ano: Number(ano),
          mes: Number(mes),
          convivente_id: item.convivente_id,
          observacoes
        },
        { headers }
      );

      await carregarMensal();
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao marcar lançamento no SISA.'
      );
    }
  };

  const desfazerLancamentoSisa = async (item) => {
    if (mensal.resumo?.fechado) {
      avisarErro('Este mês já está fechado.');
      return;
    }

    if (!item.lancamento_sisa_id) return;

    const confirmado = window.confirm(
      `Desfazer marcação de lançamento SISA de ${item.nome}?`
    );

    if (!confirmado) return;

    try {
      await axios.delete(
        `${API_ROOT}/convenio-sisa/lancamentos/${item.lancamento_sisa_id}`,
        { headers }
      );

      await carregarMensal();
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao desfazer lançamento no SISA.'
      );
    }
  };

  const resumoMensal = mensal.resumo || {};
  const resumoDiario = diario.resumo || {};

  const itensMensaisFiltrados = (mensal.items || []).filter(item => {
    if (filtroLancamento === 'lancados') return item.lancado_sisa;
    if (filtroLancamento === 'pendentes') return !item.lancado_sisa;
    return true;
  });

  return (
    <AppShell>

      <style>
        {`
          @media print {
            @page {
              size: A4 landscape;
              margin: 10mm;
            }

            html,
            body,
            #root {
              background: #ffffff !important;
              width: 100% !important;
              min-height: auto !important;
              overflow: visible !important;
            }

            body * {
              visibility: hidden !important;
            }

            .sisa-print-area,
            .sisa-print-area * {
              visibility: visible !important;
            }

            .sisa-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              background: #ffffff !important;
              overflow: visible !important;
            }

            .print\\:hidden,
            .sisa-no-print,
            aside {
              display: none !important;
              visibility: hidden !important;
            }

            .bg-gray-50,
            .bg-white {
              background: #ffffff !important;
            }

            .rounded-2xl,
            .rounded-xl {
              border-radius: 0 !important;
            }

            .shadow-sm {
              box-shadow: none !important;
            }

            .overflow-x-auto {
              overflow: visible !important;
            }

            table {
              width: 100% !important;
              min-width: 0 !important;
              border-collapse: collapse !important;
              font-size: 10px !important;
            }

            thead {
              display: table-header-group !important;
            }

            tr {
              page-break-inside: avoid !important;
            }

            th,
            td {
              border: 1px solid #d1d5db !important;
              padding: 4px 6px !important;
              color: #111827 !important;
              vertical-align: top !important;
            }

            h1,
            h2,
            h3,
            p {
              color: #111827 !important;
            }
          }
        `}
      </style>

      <Sidebar />

      <MainShell>
        <div className="print:hidden">
          <PageHeader
            eyebrow="Prestação de contas"
            title="Convênio / SISA"
            subtitle="Relatórios operacionais para conferência, digitação manual e fechamento mensal."
            icon="▤"
            actions={(
              <>
            <PremiumButton
              type="button"
              variant="secondary"
              onClick={imprimir}
            >
              Imprimir / PDF
            </PremiumButton>

            <PremiumButton
              type="button"
              onClick={exportarMensalXlsx}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Exportar XLSX
            </PremiumButton>
              </>
            )}
          />
        </div>

        <ScrollArea className="sisa-print-area">

        <div className="hidden print:flex print:items-center print:justify-between print:gap-6 print:border-b print:border-gray-200 print:pb-4 print:mb-5">
          <img
            src={logoCarecore}
            alt="CARECORE+"
            className="w-56 max-h-20 object-contain"
          />

          <div className="text-right">
            <h1 className="text-xl font-black text-gray-900">
              Relatório Convênio / SISA
            </h1>
            <p className="text-sm text-gray-700">
              {aba === 'mensal'
                ? `Relatório mensal — ${String(mes).padStart(2, '0')}/${ano}`
                : `Relatório diário — ${dataDiaria}`}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Gerado em {new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        {erro && (
          <div className="print:hidden mb-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="print:hidden mb-6 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
            {sucesso}
          </div>
        )}

        <div className="print:hidden bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setAba('mensal')}
              className={`px-4 py-2 rounded-xl text-sm font-black ${
                aba === 'mensal'
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Relatório Mensal
            </button>

            <button
              onClick={() => setAba('diario')}
              className={`px-4 py-2 rounded-xl text-sm font-black ${
                aba === 'diario'
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Relatório Diário
            </button>
          </div>

          {aba === 'mensal' ? (

            <div className="flex flex-wrap gap-4 items-end">

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Ano
                </label>

                <input
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Mês
                </label>

                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }).map((_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {String(index + 1).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={carregarMensal}
                className="px-4 py-2 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brandDark"
              >
                Atualizar
              </button>

            </div>

          ) : (

            <div className="flex flex-wrap gap-4 items-end">

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Data
                </label>

                <input
                  type="date"
                  value={dataDiaria}
                  onChange={(e) => setDataDiaria(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={carregarDiario}
                className="px-4 py-2 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brandDark"
              >
                Atualizar
              </button>

            </div>

          )}

        </div>

        {loading && (
          <div className="mb-4 text-sm text-gray-500 font-bold">
            Carregando dados...
          </div>
        )}

        {aba === 'mensal' ? (

          <>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">

              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

                <div>
                  <h2 className="text-lg font-black text-gray-800">
                    Relatório Mensal — {String(mes).padStart(2, '0')}/{ano}
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Base para prestação de contas e digitação manual no SISA.
                  </p>
                </div>

                <div className="text-left md:text-right">
                  {resumoMensal.fechado ? (
                    <div className="inline-flex flex-col items-start md:items-end gap-1 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
                      <span className="text-xs font-black text-emerald-700 uppercase">
                        Mês fechado
                      </span>
                      <span className="text-xs text-emerald-700">
                        Protocolo: {resumoMensal.protocolo}
                      </span>
                    </div>
                  ) : resumoMensal.status_fechamento === 'Reaberto' ? (
                    <div className="inline-flex flex-col items-start md:items-end gap-1 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
                      <span className="text-xs font-black text-blue-700 uppercase">
                        Mês reaberto
                      </span>
                      <span className="text-xs text-blue-700">
                        Alterações liberadas
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2">
                      <span className="text-xs font-black text-yellow-700 uppercase">
                        Mês aberto
                      </span>
                    </div>
                  )}
                </div>

              </div>

              <div className="grid grid-cols-2 md:grid-cols-7 gap-2 sm:gap-3 mt-5">

                <ResumoCard titulo="Atendimentos" valor={resumoMensal.total_atendimentos || 0} />
                <ResumoCard titulo="Almoços" valor={resumoMensal.total_almocos || 0} />
                <ResumoCard titulo="Entradas" valor={resumoMensal.total_entradas || 0} />
                <ResumoCard titulo="Saídas" valor={resumoMensal.total_saidas || 0} />
                <ResumoCard titulo="Retornos rápidos" valor={resumoMensal.total_retornos_rapidos || 0} />
                <ResumoCard titulo="Lançados SISA" valor={resumoMensal.lancados_sisa || 0} />
                <ResumoCard titulo="Pendentes SISA" valor={resumoMensal.pendentes_sisa || 0} />

              </div>

            </div>

            <div className="print:hidden bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                <h3 className="text-sm font-black text-gray-700 uppercase">
                  Fechamento mensal
                </h3>

                {resumoMensal.fechado && (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                    Fechado — reabertura exige motivo
                  </span>
                )}
              </div>

              <div className="flex flex-col md:flex-row gap-3">

                {podeFecharOuReabrirMes ? (
                  <textarea
                    value={observacoesFechamento}
                    onChange={(e) => setObservacoesFechamento(e.target.value)}
                    disabled={resumoMensal.fechado}
                    placeholder="Observações do fechamento, se houver..."
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm min-h-[70px]"
                  />
                ) : (
                  <div className="flex-1 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-4">
                    Fechamento e reabertura do mês são ações restritas à gestão.
                  </div>
                )}

                {podeFecharOuReabrirMes && (
                  <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-row">
                    <button
                      onClick={fecharMes}
                      disabled={resumoMensal.fechado}
                      className="px-5 py-3 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 disabled:opacity-50"
                    >
                      Fechar mês
                    </button>

                    {resumoMensal.fechado && (
                      <button
                        onClick={reabrirMes}
                        className="px-5 py-3 rounded-xl bg-yellow-500 text-white font-black text-sm hover:bg-yellow-600"
                      >
                        Reabrir mês
                      </button>
                    )}
                  </div>
                )}

              </div>

            </div>

            <div className="print:hidden bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-gray-800 uppercase">
                    Controle de lançamento SISA
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Marque cada convivente após lançar manualmente no SISA.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                    Status de lançamento
                  </label>
                  <select
                    value={filtroLancamento}
                    onChange={(e) => setFiltroLancamento(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="todos">Todos</option>
                    <option value="pendentes">Pendentes</option>
                    <option value="lancados">Lançados</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              <div className="space-y-3 p-3 md:hidden">
                {itensMensaisFiltrados.length === 0 ? (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                    Nenhum convivente encontrado para este filtro.
                  </div>
                ) : (
                  itensMensaisFiltrados.map(item => (
                    <article
                      key={item.convivente_id}
                      className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black uppercase text-gray-800">
                            {item.nome}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            Pront. #{item.prontuario || 'S/N'} · SISA {item.numero_sisa || '-'}
                          </p>
                        </div>

                        {item.lancado_sisa ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                            Lançado
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-yellow-50 px-3 py-1 text-xs font-black text-yellow-700">
                            Pendente
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Dias</p>
                          <p className="text-lg font-black text-gray-800">{item.dias_presentes}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Atend.</p>
                          <p className="text-lg font-black text-gray-800">{item.total_atendimentos}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Almoços</p>
                          <p className="text-lg font-black text-gray-800">{item.almocos}</p>
                        </div>
                      </div>

                      {item.lancado_sisa && (
                        <p className="mt-3 text-xs font-semibold text-gray-500">
                          {item.lancado_por_nome || '-'} · {formatarDataHora(item.lancado_em)}
                        </p>
                      )}

                      <div className="mt-3">
                        {item.lancado_sisa ? (
                          <button
                            onClick={() => desfazerLancamentoSisa(item)}
                            disabled={resumoMensal.fechado}
                            className="print:hidden min-h-11 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 disabled:opacity-50"
                          >
                            Desfazer lançamento
                          </button>
                        ) : (
                          <button
                            onClick={() => marcarLancadoSisa(item)}
                            disabled={resumoMensal.fechado}
                            className="print:hidden min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                          >
                            Marcar lançado no SISA
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">

                <table className="w-full min-w-[1150px]">

                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <Th>Pront.</Th>
                      <Th>Nº SISA</Th>
                      <Th>Convivente</Th>
                      <Th>Dias</Th>
                      <Th>Atend.</Th>
                      <Th>Almoços</Th>
                      <Th>Entradas</Th>
                      <Th>Saídas</Th>
                      <Th>Retornos</Th>
                      <Th>Status SISA</Th>
                      <Th>Ação</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {itensMensaisFiltrados.map(item => (
                      <tr key={item.convivente_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <Td>#{item.prontuario || 'S/N'}</Td>
                        <Td>{item.numero_sisa || '-'}</Td>
                        <Td destaque>{item.nome}</Td>
                        <Td>{item.dias_presentes}</Td>
                        <Td>{item.total_atendimentos}</Td>
                        <Td>{item.almocos}</Td>
                        <Td>{item.entradas}</Td>
                        <Td>{item.saidas}</Td>
                        <Td>{item.retornos_rapidos}</Td>
                        <Td>
                          {item.lancado_sisa ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex w-fit text-xs font-black px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                                Lançado
                              </span>
                              <span className="text-[11px] text-gray-500">
                                {item.lancado_por_nome || '-'} · {formatarDataHora(item.lancado_em)}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex text-xs font-black px-2 py-1 rounded-full bg-yellow-50 text-yellow-700">
                              Pendente
                            </span>
                          )}
                        </Td>
                        <Td>
                          {item.lancado_sisa ? (
                            <button
                              onClick={() => desfazerLancamentoSisa(item)}
                              disabled={resumoMensal.fechado}
                              className="print:hidden px-3 py-1 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              Desfazer
                            </button>
                          ) : (
                            <button
                              onClick={() => marcarLancadoSisa(item)}
                              disabled={resumoMensal.fechado}
                              className="print:hidden px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                            >
                              Marcar lançado
                            </button>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>

                </table>

              </div>

            </div>

          </>

        ) : (

          <>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">

              <h2 className="text-lg font-black text-gray-800">
                Relatório Diário — {dataDiaria}
              </h2>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-3 mt-5">
                <ResumoCard titulo="Ativos" valor={resumoDiario.conviventes_ativos || 0} />
                <ResumoCard titulo="Presentes" valor={resumoDiario.presentes || 0} />
                <ResumoCard titulo="Ausentes" valor={resumoDiario.ausentes || 0} />
                <ResumoCard titulo="Almoços" valor={resumoDiario.almocos || 0} />
                <ResumoCard titulo="Entradas" valor={resumoDiario.entradas || 0} />
                <ResumoCard titulo="Saídas" valor={resumoDiario.saidas || 0} />
              </div>

            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              <div className="space-y-3 p-3 md:hidden">
                {(diario.items || []).length === 0 ? (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                    Nenhum registro diário encontrado.
                  </div>
                ) : (
                  (diario.items || []).map(item => (
                    <article
                      key={item.convivente_id}
                      className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black uppercase text-gray-800">
                            {item.nome}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            Pront. #{item.prontuario || 'S/N'} · SISA {item.numero_sisa || '-'}
                          </p>
                        </div>

                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${
                          item.presenca === 'Sim'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.presenca === 'Sim' ? 'Presente' : 'Ausente'}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Entrada</p>
                          <p className="text-xs font-bold text-gray-800">{formatarDataHora(item.entrada)}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Saída</p>
                          <p className="text-xs font-bold text-gray-800">{formatarDataHora(item.saida)}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Almoço</p>
                          <p className="text-xs font-bold text-gray-800">{item.almoco}</p>
                        </div>
                      </div>

                      {item.observacoes && (
                        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-gray-600">
                          {item.observacoes}
                        </p>
                      )}
                    </article>
                  ))
                )}
              </div>

              <div className="hidden overflow-x-auto md:block">

                <table className="w-full min-w-[950px]">

                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <Th>Pront.</Th>
                      <Th>Nº SISA</Th>
                      <Th>Convivente</Th>
                      <Th>Presença</Th>
                      <Th>Entrada</Th>
                      <Th>Saída</Th>
                      <Th>Almoço</Th>
                      <Th>Observações</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {(diario.items || []).map(item => (
                      <tr key={item.convivente_id} className="border-b border-gray-100 hover:bg-gray-50">
                        <Td>#{item.prontuario || 'S/N'}</Td>
                        <Td>{item.numero_sisa || '-'}</Td>
                        <Td destaque>{item.nome}</Td>
                        <Td>
                          <span className={`text-xs font-black px-2 py-1 rounded-full ${
                            item.presenca === 'Sim'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {item.presenca}
                          </span>
                        </Td>
                        <Td>{formatarDataHora(item.entrada)}</Td>
                        <Td>{formatarDataHora(item.saida)}</Td>
                        <Td>{item.almoco}</Td>
                        <Td>{item.observacoes || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>

                </table>

              </div>

            </div>

          </>

        )}

        </ScrollArea>

      </MainShell>
    </AppShell>
  );
}

function ResumoCard({ titulo, valor }) {
  return (
    <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide">
        {titulo}
      </p>
      <p className="text-2xl font-black text-gray-800 mt-1">
        {valor}
      </p>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase">
      {children}
    </th>
  );
}

function Td({ children, destaque = false }) {
  return (
    <td className={`px-4 py-3 text-sm ${destaque ? 'font-bold text-gray-800 uppercase' : 'text-gray-700'}`}>
      {children}
    </td>
  );
}
