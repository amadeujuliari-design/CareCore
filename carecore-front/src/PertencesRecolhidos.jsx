import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton, ScrollArea } from './components/PremiumUI';
import api from './services/api';
import {
  baixarPertencesRecolhidosAdministrativo,
  listarPertencesRecolhidos,
  registrarPertencesRecolhidos,
  retirarPertencesRecolhidos,
} from './services/rotinaOperacionalService';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
} from './utils/relatorioIdentidadePrint';
import { filtrarOrdenarConviventesPorBusca } from './utils/conviventeBuscaUtils';
import LeitorCarteirinhaModal from './components/LeitorCarteirinhaModal';
import { encontrarConviventePorCodigo } from './utils/conviventeIdentificacaoUtils';

function formatarDataHora(valor) {
  if (!valor) return '-';
  return new Date(valor).toLocaleString('pt-BR');
}

function nomeConvivente(convivente) {
  return convivente?.nome_social || convivente?.nome_completo || 'Convivente';
}

function statusClasse(status) {
  if (status === 'Com saldo') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (status === 'Esgotado') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (status === 'Baixa administrativa') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-gray-100 text-gray-600 border-gray-200';
}

export default function PertencesRecolhidos() {
  const [registros, setRegistros] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [conviventes, setConviventes] = useState([]);
  const [statusFiltro, setStatusFiltro] = useState('abertos');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [retirada, setRetirada] = useState(null);
  const [erroRetirada, setErroRetirada] = useState('');
  const [buscaConviventeRetirada, setBuscaConviventeRetirada] = useState('');
  const [mostrarDropdownRetirada, setMostrarDropdownRetirada] = useState(false);
  const [scannerRetiradaAberto, setScannerRetiradaAberto] = useState(false);
  const [baixaAdmin, setBaixaAdmin] = useState(null);
  const [erroBaixaAdmin, setErroBaixaAdmin] = useState('');

  const [form, setForm] = useState({
    quarto_id: '',
    quantidade_recolhida: '',
    observacao: '',
  });

  const conviventesPorId = useMemo(
    () => new Map((conviventes || []).map(item => [item.id, item])),
    [conviventes],
  );

  const conviventesPorQuarto = useMemo(() => {
    const mapa = new Map();

    quartos.forEach(quarto => {
      const ids = new Set(
        (quarto.leitos || [])
          .map(leito => leito.convivente_id)
          .filter(Boolean),
      );

      mapa.set(
        quarto.id,
        [...ids]
          .map(id => conviventesPorId.get(id))
          .filter(convivente => convivente?.status === 'Ativo'),
      );
    });

    return mapa;
  }, [quartos, conviventesPorId]);

  const conviventesRetiradaFiltrados = useMemo(() => {
    if (!retirada) return [];

    return filtrarOrdenarConviventesPorBusca(
      conviventesPorQuarto.get(retirada.quarto_id) || [],
      buscaConviventeRetirada,
    );
  }, [retirada, conviventesPorQuarto, buscaConviventeRetirada]);

  const dadosRelatorio = useMemo(() => registros.map(registro => ({
    'Quarto': registro.quarto_nome || '-',
    'Recolha': formatarDataHora(registro.recolhido_em),
    'Recolhidos': registro.quantidade_recolhida || 0,
    'Disponíveis': registro.quantidade_disponivel || 0,
    'Status': registro.status,
    'Operador': registro.usuario_recolha_nome || '-',
    'Observação': registro.observacao || '',
    'Baixas': (registro.baixas || [])
      .map(baixa => `${baixa.quantidade} item(ns) - ${baixa.convivente_nome || baixa.tipo_baixa}`)
      .join('; '),
  })), [registros]);

  const resumo = useMemo(() => {
    const abertos = registros.filter(item => Number(item.quantidade_disponivel || 0) > 0).length;
    const itensDisponiveis = registros.reduce(
      (total, item) => total + Number(item.quantidade_disponivel || 0),
      0,
    );
    const itensRecolhidos = registros.reduce(
      (total, item) => total + Number(item.quantidade_recolhida || 0),
      0,
    );

    return { abertos, itensDisponiveis, itensRecolhidos };
  }, [registros]);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      setErro('');

      const [registrosDados, quartosResponse, conviventesResponse] = await Promise.all([
        listarPertencesRecolhidos(statusFiltro),
        api.get('/api/quartos'),
        api.get('/api/conviventes'),
      ]);

      setRegistros(registrosDados);
      setQuartos(quartosResponse.data || []);
      setConviventes(conviventesResponse.data || []);
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao carregar pertences recolhidos.');
    } finally {
      setLoading(false);
    }
  }, [statusFiltro]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, []);

  const atualizarCampo = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const selecionarConviventeRetirada = useCallback((convivente, carteirinhaConferida = false) => {
    setErroRetirada('');
    setRetirada(prev => ({
      ...prev,
      convivente_id: convivente.id,
      carteirinha_conferida: carteirinhaConferida,
    }));
    setBuscaConviventeRetirada(nomeConvivente(convivente));
    setMostrarDropdownRetirada(false);
  }, []);

  const processarCodigoRetirada = useCallback((codigo) => {
    if (!retirada) return false;

    const conviventesDoQuarto = conviventesPorQuarto.get(retirada.quarto_id) || [];
    const convivente = encontrarConviventePorCodigo(conviventesDoQuarto, codigo);

    if (!convivente) {
      setErroRetirada('Carteirinha não encontrada entre os conviventes atualmente alocados neste quarto.');
      return false;
    }

    selecionarConviventeRetirada(convivente, true);
    return true;
  }, [conviventesPorQuarto, retirada, selecionarConviventeRetirada]);

  const exportarXlsx = () => {
    exportarRelatorioXlsx({
      nomeArquivo: `pertences-recolhidos-${new Date().toISOString().slice(0, 10)}`,
      titulo: 'Relatório de Pertences Recolhidos',
      filtros: {
        Status: statusFiltro,
        'Total filtrado': registros.length,
      },
      colunas: [
        'Quarto',
        'Recolha',
        'Recolhidos',
        'Disponíveis',
        'Status',
        'Operador',
        'Observação',
        'Baixas',
      ],
      dados: dadosRelatorio,
    });
  };

  const imprimir = async () => {
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);

    imprimirRelatorio({
      titulo: 'Relatório de Pertences Recolhidos',
      subtitulo: `${registros.length} registro(s). Status: ${statusFiltro}.`,
      metricas: [
        { label: 'Recolhas abertas', valor: resumo.abertos },
        { label: 'Itens disponíveis', valor: resumo.itensDisponiveis },
        { label: 'Itens no recorte', valor: resumo.itensRecolhidos },
      ],
      colunas: [
        'Quarto',
        'Recolha',
        'Recolhidos',
        'Disponíveis',
        'Status',
        'Operador',
        'Observação',
        'Baixas',
      ],
      dados: dadosRelatorio,
      identidade: {
        ...(identidadeRelatorio || {}),
        logo_src: logoRelatorioDataUrl,
      },
    });
  };

  const salvarRecolha = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');

    if (!form.quarto_id) {
      setErro('Selecione o quarto.');
      return;
    }

    const quantidade = Number(form.quantidade_recolhida || 0);
    if (quantidade <= 0) {
      setErro('Informe a quantidade de itens recolhidos.');
      return;
    }

    try {
      setSalvando(true);
      await registrarPertencesRecolhidos({
        quarto_id: form.quarto_id,
        quantidade_recolhida: quantidade,
        observacao: form.observacao.trim() || null,
      });

      setForm({ quarto_id: '', quantidade_recolhida: '', observacao: '' });
      setSucesso('Pertences recolhidos registrados para o quarto.');
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao registrar recolha.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirRetirada = (registro) => {
    setErro('');
    setErroRetirada('');
    setBuscaConviventeRetirada('');
    setMostrarDropdownRetirada(false);
    setRetirada({
      ...registro,
      convivente_id: '',
      quantidade: '',
      justificativa: '',
      carteirinha_conferida: false,
    });
  };

  const confirmarRetirada = async () => {
    if (!retirada) return;

    const quantidade = Number(retirada.quantidade || 0);
    if (!retirada.convivente_id) {
      setErroRetirada('Selecione o convivente que está retirando os pertences.');
      return;
    }
    if (!retirada.carteirinha_conferida) {
      setErroRetirada('Leia a carteirinha do convivente antes de confirmar a retirada.');
      return;
    }
    if (quantidade <= 0) {
      setErroRetirada('Informe a quantidade retirada.');
      return;
    }
    if (quantidade > Number(retirada.quantidade_disponivel || 0)) {
      setErroRetirada(`Há apenas ${retirada.quantidade_disponivel} item(ns) disponível(is) para este quarto. Confira com os conviventes antes de prosseguir.`);
      return;
    }

    try {
      setErroRetirada('');
      setSalvando(true);
      await retirarPertencesRecolhidos(retirada.id, {
        convivente_id: retirada.convivente_id,
        quantidade,
        justificativa: retirada.justificativa.trim() || null,
      });

      setRetirada(null);
      setBuscaConviventeRetirada('');
      setMostrarDropdownRetirada(false);
      setSucesso('Retirada registrada e saldo do quarto atualizado.');
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErroRetirada(error.response?.data?.detail || 'Erro ao registrar retirada.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirBaixaAdministrativa = (registro) => {
    setErro('');
    setErroBaixaAdmin('');
    setBaixaAdmin({
      ...registro,
      quantidade: registro.quantidade_disponivel,
      justificativa: '',
      destino: '',
    });
  };

  const confirmarBaixaAdministrativa = async () => {
    if (!baixaAdmin) return;

    const quantidade = Number(baixaAdmin.quantidade || 0);
    if (quantidade <= 0) {
      setErroBaixaAdmin('Informe a quantidade para baixa.');
      return;
    }
    if (quantidade > Number(baixaAdmin.quantidade_disponivel || 0)) {
      setErroBaixaAdmin(`Há apenas ${baixaAdmin.quantidade_disponivel} item(ns) disponível(is) para baixa.`);
      return;
    }
    if (!baixaAdmin.justificativa.trim() || !baixaAdmin.destino.trim()) {
      setErroBaixaAdmin('Baixa administrativa exige justificativa e destino.');
      return;
    }

    try {
      setErroBaixaAdmin('');
      setSalvando(true);
      await baixarPertencesRecolhidosAdministrativo(baixaAdmin.id, {
        quantidade,
        justificativa: baixaAdmin.justificativa.trim(),
        destino: baixaAdmin.destino.trim(),
      });

      setBaixaAdmin(null);
      setSucesso('Baixa administrativa registrada.');
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErroBaixaAdmin(error.response?.data?.detail || 'Erro ao registrar baixa administrativa.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="Rotina Diária"
          title="Pertences Recolhidos"
          subtitle="Controle por quarto dos objetos esquecidos, com saldo e retirada por conviventes do próprio quarto."
          icon="P"
          actions={(
            <>
              <ReportActionButton action="export" onClick={exportarXlsx} disabled={registros.length === 0}>
                Exportar
              </ReportActionButton>
              <ReportActionButton action="print" onClick={imprimir} disabled={registros.length === 0}>
                Imprimir
              </ReportActionButton>
              <PremiumButton type="button" variant="brand" onClick={carregarDados}>
                Atualizar
              </PremiumButton>
            </>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="mx-auto w-full max-w-7xl space-y-5">
            {erro && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
                {erro}
              </div>
            )}

            {sucesso && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                {sucesso}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-black uppercase text-blue-700">Recolhas abertas</p>
                <p className="mt-2 text-3xl font-black text-blue-900">{resumo.abertos}</p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase text-amber-700">Itens disponíveis</p>
                <p className="mt-2 text-3xl font-black text-amber-900">{resumo.itensDisponiveis}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-xs font-black uppercase text-violet-700">Itens no recorte</p>
                <p className="mt-2 text-3xl font-black text-violet-900">{resumo.itensRecolhidos}</p>
              </div>
            </div>

            <form onSubmit={salvarRecolha} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-black text-gray-800">Registrar recolha do quarto</h2>
                <p className="mt-1 text-sm text-gray-500">
                  O registro nasce vinculado apenas ao quarto. A retirada será feita por conviventes atualmente alocados nele.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase text-gray-500">Quarto</label>
                  <select
                    value={form.quarto_id}
                    onChange={(event) => atualizarCampo('quarto_id', event.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none"
                  >
                    <option value="">Selecione...</option>
                    {quartos.map(quarto => (
                      <option key={quarto.id} value={quarto.id}>
                        {quarto.nome} - {quarto.tipo_publico} / {quarto.modalidade}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-black uppercase text-gray-500">Itens recolhidos</label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantidade_recolhida}
                    onChange={(event) => atualizarCampo('quantidade_recolhida', event.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none"
                    placeholder="Quantidade"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-black uppercase text-gray-500">Observação</label>
                  <textarea
                    value={form.observacao}
                    onChange={(event) => atualizarCampo('observacao', event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
                    placeholder="Ex.: recolha após café, sacola identificada pelo quarto, objetos diversos..."
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <PremiumButton type="submit" variant="brand" disabled={salvando}>
                  Registrar recolha
                </PremiumButton>
              </div>
            </form>

            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-black text-gray-800">Saldos por quarto</h2>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    Retiradas são limitadas ao saldo disponível da recolha.
                  </p>
                </div>
                <select
                  value={statusFiltro}
                  onChange={(event) => setStatusFiltro(event.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700"
                >
                  <option value="abertos">Abertos</option>
                  <option value="todos">Todos</option>
                  <option value="Esgotado">Esgotados</option>
                  <option value="Baixa administrativa">Baixa administrativa</option>
                </select>
              </div>

              {loading ? (
                <div className="p-8 text-center text-sm font-semibold text-gray-500">
                  Carregando pertences recolhidos...
                </div>
              ) : registros.length === 0 ? (
                <div className="p-8 text-center text-sm font-semibold text-gray-500">
                  Nenhuma recolha encontrada.
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-3 md:hidden">
                    {registros.map(registro => (
                      <div key={registro.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-gray-900">{registro.quarto_nome}</p>
                            <p className="text-xs font-semibold text-gray-500">ID {registro.quarto_id.slice(0, 8)}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black ${statusClasse(registro.status)}`}>
                            {registro.status}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600">
                          <div className="rounded-xl bg-gray-50 p-2">
                            <span className="block text-[10px] font-black uppercase text-gray-400">Recolha</span>
                            {formatarDataHora(registro.recolhido_em)}
                          </div>
                          <div className="rounded-xl bg-blue-50 p-2 text-blue-900">
                            <span className="block text-[10px] font-black uppercase text-blue-500">Saldo</span>
                            {registro.quantidade_disponivel} de {registro.quantidade_recolhida}
                          </div>
                        </div>

                        {registro.observacao && (
                          <details className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            <summary className="cursor-pointer font-black text-gray-700">Observação da recolha</summary>
                            <p className="mt-2">{registro.observacao}</p>
                          </details>
                        )}

                        {registro.baixas?.length ? (
                          <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2">
                            <p className="text-[10px] font-black uppercase text-gray-400">Últimas baixas</p>
                            {registro.baixas.slice(0, 2).map(baixa => (
                              <p key={baixa.id} className="mt-1 text-xs font-semibold text-gray-600">
                                {baixa.quantidade} item(ns) · {baixa.convivente_nome || baixa.tipo_baixa}
                              </p>
                            ))}
                          </div>
                        ) : null}

                        {Number(registro.quantidade_disponivel || 0) > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => abrirRetirada(registro)}
                              className="flex-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
                            >
                              Retirar
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirBaixaAdministrativa(registro)}
                              className="flex-1 rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700"
                            >
                              Baixa admin.
                            </button>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs font-semibold text-gray-400">Sem saldo disponível.</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[1000px] text-sm">
                    <thead className="bg-gray-50 text-xs font-black uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Quarto</th>
                        <th className="px-4 py-3 text-left">Recolha</th>
                        <th className="px-4 py-3 text-left">Quantidade</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Últimas baixas</th>
                        <th className="px-4 py-3 text-left">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map(registro => (
                        <tr key={registro.id} className="border-t border-gray-100">
                          <td className="px-4 py-3">
                            <p className="font-black text-gray-900">{registro.quarto_nome}</p>
                            <p className="text-xs font-semibold text-gray-500">ID {registro.quarto_id.slice(0, 8)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-700">{formatarDataHora(registro.recolhido_em)}</p>
                            <p className="text-xs text-gray-500">{registro.usuario_recolha_nome || '-'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-black text-gray-900">{registro.quantidade_disponivel} disponíveis</p>
                            <p className="text-xs font-semibold text-gray-500">{registro.quantidade_recolhida} recolhidos</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasse(registro.status)}`}>
                              {registro.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {registro.baixas?.length ? (
                              <div className="space-y-1">
                                {registro.baixas.slice(0, 2).map(baixa => (
                                  <p key={baixa.id} className="text-xs font-semibold text-gray-600">
                                    {baixa.quantidade} item(ns) · {baixa.convivente_nome || baixa.tipo_baixa}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-gray-400">Sem baixas</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {Number(registro.quantidade_disponivel || 0) > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => abrirRetirada(registro)}
                                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                >
                                  Retirar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => abrirBaixaAdministrativa(registro)}
                                  className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-700 hover:bg-amber-100"
                                >
                                  Baixa admin.
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-gray-400">Sem saldo</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </ScrollArea>
      </MainShell>

      {retirada && (
        <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-emerald-600 p-5 text-white">
              <h2 className="text-lg font-bold">Retirar pertences</h2>
              <p className="text-sm text-emerald-50">
                {retirada.quarto_nome} · saldo {retirada.quantidade_disponivel}
              </p>
            </div>
            <div className="space-y-4 p-6">
              {erroRetirada && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {erroRetirada}
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Convivente do quarto</span>
                <div className="relative">
                  <input
                    type="text"
                    required={!retirada.convivente_id}
                    value={buscaConviventeRetirada}
                    onChange={(event) => {
                      setErroRetirada('');
                      setBuscaConviventeRetirada(event.target.value);
                      setMostrarDropdownRetirada(true);
                      setRetirada(prev => ({ ...prev, convivente_id: '' }));
                    }}
                    onFocus={() => setMostrarDropdownRetirada(true)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-brand"
                    placeholder="Digite nome, prontuário ou CPF para buscar..."
                  />

                  {mostrarDropdownRetirada && (
                    <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                      {conviventesRetiradaFiltrados.map(convivente => (
                        <button
                          type="button"
                          key={convivente.id}
                          onClick={() => {
                            selecionarConviventeRetirada(convivente);
                          }}
                          className="block w-full border-b border-gray-50 px-3 py-3 text-left text-sm text-gray-700 hover:bg-brand/10"
                        >
                          <span className="font-bold">{nomeConvivente(convivente)}</span>
                          <span className="mt-0.5 block text-[10px] text-gray-500">
                            Prontuário: #{convivente.numero_institucional || 'S/N'} · CPF: {convivente.cpf || 'Não informado'}
                          </span>
                        </button>
                      ))}

                      {conviventesRetiradaFiltrados.length === 0 && (
                        <div className="p-3 text-center text-sm text-gray-500">
                          Nenhum acolhido deste quarto encontrado.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {retirada.convivente_id && (
                  <span className={`mt-2 block text-[10px] font-bold ${retirada.carteirinha_conferida ? 'text-green-600' : 'text-amber-600'}`}>
                    {retirada.carteirinha_conferida
                      ? '✓ Convivente selecionado e carteirinha conferida.'
                      : 'Convivente selecionado. Leia a carteirinha para confirmar a retirada.'}
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Quantidade retirada</span>
                <input
                  type="number"
                  min="1"
                  max={retirada.quantidade_disponivel}
                  value={retirada.quantidade}
                  onChange={(event) => {
                    setErroRetirada('');
                    setRetirada(prev => ({ ...prev, quantidade: event.target.value }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold ${
                    erroRetirada ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                />
                <span className="mt-1 block text-xs font-semibold text-gray-500">
                  Saldo disponível para este quarto: {retirada.quantidade_disponivel} item(ns).
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Observação</span>
                <textarea
                  rows={3}
                  value={retirada.justificativa}
                  onChange={(event) => {
                    setErroRetirada('');
                    setRetirada(prev => ({ ...prev, justificativa: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Opcional: conferência com o convivente, descrição dos itens..."
                />
              </label>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => {
                  setErroRetirada('');
                  setBuscaConviventeRetirada('');
                  setMostrarDropdownRetirada(false);
                  setScannerRetiradaAberto(false);
                  setRetirada(null);
                }} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErroRetirada('');
                    setScannerRetiradaAberto(true);
                  }}
                  className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                >
                  Abrir câmera
                </button>
                <button type="button" onClick={confirmarRetirada} disabled={salvando} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Confirmar retirada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {baixaAdmin && (
        <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-amber-600 p-5 text-white">
              <h2 className="text-lg font-bold">Baixa administrativa</h2>
              <p className="text-sm text-amber-50">
                {baixaAdmin.quarto_nome} · saldo {baixaAdmin.quantidade_disponivel}
              </p>
            </div>
            <div className="space-y-4 p-6">
              {erroBaixaAdmin && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                  {erroBaixaAdmin}
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Quantidade</span>
                <input
                  type="number"
                  min="1"
                  max={baixaAdmin.quantidade_disponivel}
                  value={baixaAdmin.quantidade}
                  onChange={(event) => {
                    setErroBaixaAdmin('');
                    setBaixaAdmin(prev => ({ ...prev, quantidade: event.target.value }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold ${
                    erroBaixaAdmin ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                />
                <span className="mt-1 block text-xs font-semibold text-gray-500">
                  Saldo disponível para baixa: {baixaAdmin.quantidade_disponivel} item(ns).
                </span>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Destino</span>
                <input
                  value={baixaAdmin.destino}
                  onChange={(event) => {
                    setErroBaixaAdmin('');
                    setBaixaAdmin(prev => ({ ...prev, destino: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                  placeholder="Ex.: guarda, descarte, doação, achados e perdidos..."
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Justificativa</span>
                <textarea
                  rows={4}
                  value={baixaAdmin.justificativa}
                  onChange={(event) => {
                    setErroBaixaAdmin('');
                    setBaixaAdmin(prev => ({ ...prev, justificativa: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Explique por que os itens estão sendo baixados sem retirada por convivente."
                />
              </label>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => {
                  setErroBaixaAdmin('');
                  setBaixaAdmin(null);
                }} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600">
                  Cancelar
                </button>
                <button type="button" onClick={confirmarBaixaAdministrativa} disabled={salvando} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Confirmar baixa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LeitorCarteirinhaModal
        aberto={scannerRetiradaAberto}
        titulo="Abrir câmera"
        subtitulo="A leitura só aceita conviventes atualmente alocados no quarto da recolha."
        onCodigoLido={processarCodigoRetirada}
        onClose={() => setScannerRetiradaAberto(false)}
      />
    </AppShell>
  );
}
