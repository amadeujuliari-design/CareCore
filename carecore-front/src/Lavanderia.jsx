import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton, ScrollArea } from './components/PremiumUI';
import api from './services/api';
import {
  cancelarLavanderia,
  listarLavanderia,
  registrarLavanderia,
  retirarLavanderia,
} from './services/rotinaOperacionalService';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
} from './utils/relatorioIdentidadePrint';
import { filtrarOrdenarConviventesPorBusca } from './utils/conviventeBuscaUtils';
import {
  criarFiltrosListagemOperacionalPadrao,
  LISTAGEM_OPERACIONAL_DIAS_PADRAO,
  REGISTROS_POR_PAGINA_PRONTUARIO,
} from './utils/prontuarioHistoricoFluxoUtils';
import LeitorCarteirinhaModal from './components/LeitorCarteirinhaModal';
import { encontrarConviventePorCodigo } from './utils/conviventeIdentificacaoUtils';

function nomeConvivente(convivente) {
  return convivente?.nome_social || convivente?.nome_completo || 'Convivente';
}

function formatarDataHora(valor) {
  if (!valor) return '-';
  return new Date(valor).toLocaleString('pt-BR');
}

function statusClasse(registro) {
  if (registro.status === 'Atrasado') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (registro.status === 'Retirado') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (registro.status === 'Retirado com divergência') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (registro.status === 'Baixa com divergência') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (registro.status === 'Cancelado') return 'bg-gray-100 text-gray-600 border-gray-200';
  return 'bg-blue-50 text-blue-700 border-blue-100';
}

function saldoPendenteLavanderia(registro) {
  const jaRetiradas = registro?.quantidade_ja_retirada ?? registro?.quantidade_retirada ?? 0;
  return Math.max(Number(registro?.quantidade_entregue || 0) - Number(jaRetiradas || 0), 0);
}

export default function Lavanderia() {
  const [registros, setRegistros] = useState([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [resumoFila, setResumoFila] = useState(null);
  const [filtrosPeriodo, setFiltrosPeriodo] = useState({ dataInicio: '', dataFim: '', busca: '' });
  const [buscaRascunho, setBuscaRascunho] = useState('');
  const [conviventes, setConviventes] = useState([]);
  const [statusFiltro, setStatusFiltro] = useState('pendentes');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [retirada, setRetirada] = useState(null);
  const [cancelamento, setCancelamento] = useState(null);
  const [buscaConvivente, setBuscaConvivente] = useState('');
  const [mostrarDropdownConvivente, setMostrarDropdownConvivente] = useState(false);
  const [scannerContexto, setScannerContexto] = useState(null);

  const [form, setForm] = useState({
    convivente_id: '',
    quantidade_entregue: '',
    observacao_entrega: '',
  });

  const conviventesAtivos = useMemo(() => {
    const ativos = (conviventes || []).filter(item => item.status === 'Ativo');
    return filtrarOrdenarConviventesPorBusca(ativos, buscaConvivente);
  }, [conviventes, buscaConvivente]);

  const dadosRelatorio = useMemo(() => registros.map(registro => ({
    'Convivente': registro.convivente_nome || '-',
    'Prontuário': registro.prontuario || 'S/N',
    'Entrega': formatarDataHora(registro.entregue_em),
    'Prazo': formatarDataHora(registro.prazo_retirada_em),
    'Peças entregues': registro.quantidade_entregue || 0,
    'Peças retiradas': registro.quantidade_retirada || '',
    'Status': registro.status,
    'Operador entrega': registro.usuario_entrega_nome || '-',
    'Operador retirada': registro.usuario_retirada_nome || '-',
    'Observação entrega': registro.observacao_entrega || '',
    'Observação retirada': registro.observacao_retirada || '',
  })), [registros]);

  const resumo = useMemo(() => {
    if (resumoFila) {
      return {
        pendentes: resumoFila.pendentes || 0,
        atrasados: resumoFila.atrasados || 0,
        pecasPendentes: resumoFila.pecas_em_aberto || 0,
      };
    }

    const pendentes = registros.filter(item => item.status === 'Em lavanderia').length;
    const atrasados = registros.filter(item => item.status === 'Atrasado').length;
    const pecasPendentes = registros
      .filter(item => ['Em lavanderia', 'Atrasado'].includes(item.status))
      .reduce((total, item) => total + Number(item.quantidade_entregue || 0), 0);

    return { pendentes, atrasados, pecasPendentes };
  }, [registros, resumoFila]);

  const montarParamsLista = useCallback(() => {
    const params = {
      limite: REGISTROS_POR_PAGINA_PRONTUARIO,
    };

    if (statusFiltro !== 'pendentes') {
      if (filtrosPeriodo.dataInicio) params.data_inicio = filtrosPeriodo.dataInicio;
      if (filtrosPeriodo.dataFim) params.data_fim = filtrosPeriodo.dataFim;
    }

    if (filtrosPeriodo.busca?.trim()) {
      params.busca = filtrosPeriodo.busca.trim();
    }

    return params;
  }, [statusFiltro, filtrosPeriodo]);

  const carregarDados = useCallback(async ({ append = false, offset = 0 } = {}) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setCarregandoMais(true);
      }
      setErro('');

      const params = { ...montarParamsLista(), offset };
      const [lista, conviventesResponse] = await Promise.all([
        listarLavanderia(statusFiltro, params),
        append ? Promise.resolve(null) : api.get('/api/conviventes/resumo'),
      ]);

      const itens = lista.items || [];
      setRegistros(prev => (append ? [...prev, ...itens] : itens));
      setTotalRegistros(lista.total || 0);
      setTemMais(Boolean(lista.has_more));
      setResumoFila(lista.resumo_fila || null);

      if (!append && conviventesResponse) {
        setConviventes(conviventesResponse.data || []);
      }
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao carregar lavanderia.');
    } finally {
      setLoading(false);
      setCarregandoMais(false);
    }
  }, [statusFiltro, montarParamsLista]);

  useEffect(() => {
    if (statusFiltro === 'pendentes') {
      setFiltrosPeriodo({ dataInicio: '', dataFim: '', busca: '' });
      setBuscaRascunho('');
      return;
    }

    const padrao = criarFiltrosListagemOperacionalPadrao();
    setFiltrosPeriodo(prev => ({
      dataInicio: padrao.dataInicio,
      dataFim: padrao.dataFim,
      busca: prev.busca,
    }));
  }, [statusFiltro]);

  useEffect(() => {
    carregarDados({ append: false, offset: 0 });
  }, [carregarDados]);

  const aplicarFiltrosLista = () => {
    setFiltrosPeriodo(prev => ({ ...prev, busca: buscaRascunho.trim() }));
  };

  const restaurarFiltrosLista = () => {
    const padrao = criarFiltrosListagemOperacionalPadrao();
    setBuscaRascunho('');
    setFiltrosPeriodo({
      dataInicio: statusFiltro === 'pendentes' ? '' : padrao.dataInicio,
      dataFim: statusFiltro === 'pendentes' ? '' : padrao.dataFim,
      busca: '',
    });
  };

  const carregarMaisRegistros = () => {
    if (!temMais || carregandoMais) return;
    carregarDados({ append: true, offset: registros.length });
  };

  useEffect(() => {
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, []);

  const atualizarCampo = (campo, valor) => {
    setForm(prev => ({ ...prev, [campo]: valor }));
  };

  const selecionarConviventeEntrega = useCallback((convivente) => {
    atualizarCampo('convivente_id', convivente.id);
    setBuscaConvivente(nomeConvivente(convivente));
    setMostrarDropdownConvivente(false);
  }, []);

  const processarCodigoCarteirinha = useCallback((codigo) => {
    const convivente = encontrarConviventePorCodigo(
      (conviventes || []).filter(item => item.status === 'Ativo'),
      codigo,
    );

    if (!convivente) return false;

    if (scannerContexto === 'retirada') {
      if (!retirada || convivente.id !== retirada.convivente_id) {
        setErro(`Carteirinha lida pertence a ${nomeConvivente(convivente)}, mas esta retirada é de ${retirada?.convivente_nome || 'outro convivente'}.`);
        return false;
      }

      setRetirada(prev => ({
        ...prev,
        carteirinha_conferida: true,
      }));
      setSucesso(`Carteirinha conferida para ${retirada.convivente_nome}.`);
      return true;
    }

    selecionarConviventeEntrega(convivente);
    setSucesso(`Convivente identificado: ${nomeConvivente(convivente)}.`);
    return true;
  }, [conviventes, retirada, scannerContexto, selecionarConviventeEntrega]);

  const exportarXlsx = () => {
    exportarRelatorioXlsx({
      nomeArquivo: `lavanderia-${new Date().toISOString().slice(0, 10)}`,
      titulo: 'Relatório de Lavanderia',
      filtros: {
        Status: statusFiltro,
        'Total filtrado': totalRegistros,
        'Exibidos na tela': registros.length,
      },
      colunas: [
        'Convivente',
        'Prontuário',
        'Entrega',
        'Prazo',
        'Peças entregues',
        'Peças retiradas',
        'Status',
        'Operador entrega',
        'Operador retirada',
        'Observação entrega',
        'Observação retirada',
      ],
      dados: dadosRelatorio,
    });
  };

  const imprimir = async () => {
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);

    imprimirRelatorio({
      titulo: 'Relatório de Lavanderia',
      subtitulo: `${totalRegistros} registro(s). Status: ${statusFiltro}.`,
      metricas: [
        { label: 'Pendentes', valor: resumo.pendentes },
        { label: 'Atrasados +48h', valor: resumo.atrasados },
        { label: 'Peças em aberto', valor: resumo.pecasPendentes },
      ],
      colunas: [
        'Convivente',
        'Prontuário',
        'Entrega',
        'Prazo',
        'Peças entregues',
        'Peças retiradas',
        'Status',
        'Operador entrega',
        'Operador retirada',
      ],
      dados: dadosRelatorio,
      identidade: {
        ...(identidadeRelatorio || {}),
        logo_src: logoRelatorioDataUrl,
      },
    });
  };

  const salvarEntrega = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');

    if (!form.convivente_id) {
      setErro('Selecione o convivente.');
      return;
    }

    const quantidade = Number(form.quantidade_entregue || 0);
    if (quantidade <= 0) {
      setErro('Informe a quantidade de peças.');
      return;
    }

    try {
      setSalvando(true);
      await registrarLavanderia({
        convivente_id: form.convivente_id,
        quantidade_entregue: quantidade,
        observacao_entrega: form.observacao_entrega.trim() || null,
      });

      setForm({ convivente_id: '', quantidade_entregue: '', observacao_entrega: '' });
      setBuscaConvivente('');
      setMostrarDropdownConvivente(false);
      setSucesso('Entrega registrada. Prazo de retirada: 48 horas.');
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao registrar entrega na lavanderia.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarRetirada = async () => {
    if (!retirada) return;

    const quantidade = Number(retirada.quantidade_retirada || 0);
    if (quantidade > 0 && !retirada.carteirinha_conferida) {
      setErro('Leia a carteirinha do convivente antes de confirmar a retirada.');
      return;
    }

    if (quantidade <= 0 && !retirada.encerrar_pendencia) {
      setErro('Informe a quantidade retirada ou marque a baixa da pendência.');
      return;
    }

    const saldoPendente = saldoPendenteLavanderia(retirada);
    if (quantidade > saldoPendente) {
      setErro(`Há apenas ${saldoPendente} peça(s) pendente(s) neste registro.`);
      return;
    }

    if (retirada.encerrar_pendencia && !retirada.motivo_baixa.trim()) {
      setErro('Informe o motivo para baixar a pendência.');
      return;
    }

    if (
      retirada.encerrar_pendencia
      && quantidade < saldoPendente
      && !retirada.observacao_retirada.trim()
    ) {
      setErro('Baixa com diferença exige observação.');
      return;
    }

    try {
      setSalvando(true);
      await retirarLavanderia(retirada.id, {
        quantidade_retirada: quantidade,
        observacao_retirada: retirada.observacao_retirada.trim() || null,
        encerrar_pendencia: retirada.encerrar_pendencia === true,
        motivo_baixa: retirada.motivo_baixa?.trim() || null,
      });

      setRetirada(null);
      setSucesso(
        retirada.encerrar_pendencia || quantidade >= saldoPendente
          ? 'Retirada registrada e pendência encerrada.'
          : 'Retirada parcial registrada. O saldo permanece pendente na lavanderia.',
      );
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao registrar retirada.');
    } finally {
      setSalvando(false);
    }
  };

  const confirmarCancelamento = async () => {
    if (!cancelamento) return;

    const motivo = cancelamento.motivo_cancelamento.trim();
    if (!motivo) {
      setErro('Informe o motivo do cancelamento.');
      return;
    }

    try {
      setSalvando(true);
      await cancelarLavanderia(cancelamento.id, { motivo_cancelamento: motivo });
      setCancelamento(null);
      setSucesso('Registro de lavanderia cancelado.');
      await carregarDados();
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao cancelar registro.');
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
          title="Lavanderia"
          subtitle="Controle de peças deixadas para lavagem/secagem, prazo de 48h e retirada conferida."
          icon="L"
          actions={(
            <>
              <ReportActionButton action="export" onClick={exportarXlsx} disabled={registros.length === 0}>
                Exportar
              </ReportActionButton>
              <ReportActionButton action="print" onClick={imprimir} disabled={registros.length === 0}>
                Imprimir
              </ReportActionButton>
              <PremiumButton type="button" variant="brand" onClick={() => carregarDados({ append: false, offset: 0 })}>
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
                <p className="text-xs font-black uppercase text-blue-700">Pendentes</p>
                <p className="mt-2 text-3xl font-black text-blue-900">{resumo.pendentes}</p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-xs font-black uppercase text-rose-700">Atrasados +48h</p>
                <p className="mt-2 text-3xl font-black text-rose-900">{resumo.atrasados}</p>
              </div>
              <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                <p className="text-xs font-black uppercase text-violet-700">Peças em aberto</p>
                <p className="mt-2 text-3xl font-black text-violet-900">{resumo.pecasPendentes}</p>
              </div>
            </div>

            <form onSubmit={salvarEntrega} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-base font-black text-gray-800">Registrar entrega na lavanderia</h2>
                <p className="mt-1 text-sm text-gray-500">
                  A partir da entrega, o sistema considera 48 horas para retirada.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr]">
                <div>
                  <label className="mb-1 block text-xs font-black uppercase text-gray-500">Convivente</label>
                  <div className="relative">
                    <input
                      type="text"
                      required={!form.convivente_id}
                      value={buscaConvivente}
                      onChange={(event) => {
                        setBuscaConvivente(event.target.value);
                        setMostrarDropdownConvivente(true);
                        atualizarCampo('convivente_id', '');
                      }}
                      onFocus={() => setMostrarDropdownConvivente(true)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand"
                      placeholder="Digite nome, prontuário ou CPF para buscar..."
                    />

                    {mostrarDropdownConvivente && (
                      <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
                        {conviventesAtivos.map(convivente => (
                          <button
                            type="button"
                            key={convivente.id}
                            onClick={() => {
                              selecionarConviventeEntrega(convivente);
                            }}
                            className="block w-full border-b border-gray-50 px-3 py-3 text-left text-sm text-gray-700 hover:bg-brand/10"
                          >
                            <span className="font-bold">{nomeConvivente(convivente)}</span>
                            <span className="mt-0.5 block text-[10px] text-gray-500">
                              Prontuário: #{convivente.numero_institucional || 'S/N'} · CPF: {convivente.cpf || 'Não informado'}
                            </span>
                          </button>
                        ))}

                        {conviventesAtivos.length === 0 && (
                          <div className="p-3 text-center text-sm text-gray-500">
                            Nenhum acolhido encontrado.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {form.convivente_id && (
                    <p className="mt-2 text-[10px] font-bold text-green-600">
                      ✓ Convivente selecionado com sucesso.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setErro('');
                      setScannerContexto('entrega');
                    }}
                    className="mt-3 min-h-11 w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white hover:bg-black md:w-auto"
                  >
                    Abrir câmera
                  </button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-black uppercase text-gray-500">Peças</label>
                  <input
                    type="number"
                    min="1"
                    value={form.quantidade_entregue}
                    onChange={(event) => atualizarCampo('quantidade_entregue', event.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold outline-none"
                    placeholder="Quantidade"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-black uppercase text-gray-500">Observação</label>
                  <textarea
                    value={form.observacao_entrega}
                    onChange={(event) => atualizarCampo('observacao_entrega', event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
                    placeholder="Ex.: roupas deixadas para secagem, volume especial, sacola identificada..."
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <PremiumButton type="submit" variant="brand" disabled={salvando}>
                  Registrar entrega
                </PremiumButton>
              </div>
            </form>

            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-gray-100 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-black text-gray-800">Registros de lavanderia</h2>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    Atrasos são calculados automaticamente pelo prazo de 48 horas.
                  </p>
                </div>
                <select
                  value={statusFiltro}
                  onChange={(event) => setStatusFiltro(event.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700"
                >
                  <option value="pendentes">Pendentes</option>
                  <option value="todos">Todos</option>
                  <option value="Retirado">Retirados</option>
                  <option value="Retirado com divergência">Retirados com divergência</option>
                  <option value="Baixa com divergência">Baixas com divergência</option>
                  <option value="Cancelado">Cancelados</option>
                </select>
              </div>

              {statusFiltro !== 'pendentes' && (
                <div className="border-b border-gray-100 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-gray-500">Filtros da listagem</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        Por padrão, últimos {LISTAGEM_OPERACIONAL_DIAS_PADRAO} dias. Amplie o período quando precisar.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="date"
                        value={filtrosPeriodo.dataInicio}
                        onChange={(event) => setFiltrosPeriodo(prev => ({ ...prev, dataInicio: event.target.value }))}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                      />
                      <input
                        type="date"
                        value={filtrosPeriodo.dataFim}
                        onChange={(event) => setFiltrosPeriodo(prev => ({ ...prev, dataFim: event.target.value }))}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                      />
                      <input
                        type="search"
                        value={buscaRascunho}
                        onChange={(event) => setBuscaRascunho(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            aplicarFiltrosLista();
                          }
                        }}
                        placeholder="Buscar convivente ou observação..."
                        className="min-w-[220px] rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                      />
                      <button
                        type="button"
                        onClick={aplicarFiltrosLista}
                        className="rounded-xl bg-brand px-4 py-2 text-sm font-black text-white"
                      >
                        Filtrar
                      </button>
                      <button
                        type="button"
                        onClick={restaurarFiltrosLista}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600"
                      >
                        Padrão
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {statusFiltro === 'pendentes' && (
                <div className="border-b border-gray-100 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <p className="text-xs font-semibold text-gray-500">
                      Fila operacional sem corte de data. Use os demais status para consultar histórico recente.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="search"
                        value={buscaRascunho}
                        onChange={(event) => setBuscaRascunho(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            aplicarFiltrosLista();
                          }
                        }}
                        placeholder="Buscar convivente ou observação..."
                        className="min-w-[220px] rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                      />
                      <button
                        type="button"
                        onClick={aplicarFiltrosLista}
                        className="rounded-xl bg-brand px-4 py-2 text-sm font-black text-white"
                      >
                        Filtrar
                      </button>
                      {filtrosPeriodo.busca && (
                        <button
                          type="button"
                          onClick={() => {
                            setBuscaRascunho('');
                            setFiltrosPeriodo(prev => ({ ...prev, busca: '' }));
                          }}
                          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600"
                        >
                          Limpar busca
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {!loading && registros.length > 0 && (
                <div className="border-b border-gray-100 px-4 py-2 text-xs font-semibold text-gray-500">
                  Exibindo {registros.length} de {totalRegistros} registro(s).
                </div>
              )}

              {loading ? (
                <div className="p-8 text-center text-sm font-semibold text-gray-500">
                  Carregando lavanderia...
                </div>
              ) : registros.length === 0 ? (
                <div className="p-8 text-center text-sm font-semibold text-gray-500">
                  Nenhum registro encontrado.
                </div>
              ) : (
                <>
                  <div className="space-y-3 p-3 md:hidden">
                    {registros.map(registro => (
                      <div key={registro.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-gray-900">{registro.convivente_nome}</p>
                            <p className="text-xs font-semibold text-gray-500">Pront. #{registro.prontuario || 'S/N'}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-black ${statusClasse(registro)}`}>
                            {registro.status}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-gray-600">
                          <div className="rounded-xl bg-gray-50 p-2">
                            <span className="block text-[10px] font-black uppercase text-gray-400">Entrega</span>
                            {formatarDataHora(registro.entregue_em)}
                          </div>
                          <div className="rounded-xl bg-gray-50 p-2">
                            <span className="block text-[10px] font-black uppercase text-gray-400">Prazo</span>
                            {formatarDataHora(registro.prazo_retirada_em)}
                          </div>
                          <div className="col-span-2 rounded-xl bg-blue-50 p-2 text-blue-900">
                            <span className="block text-[10px] font-black uppercase text-blue-500">Peças</span>
                            {registro.quantidade_entregue} entregue(s) · {registro.quantidade_retirada || 0} retirada(s) · {saldoPendenteLavanderia(registro)} pendente(s)
                          </div>
                        </div>

                        {(registro.observacao_entrega || registro.observacao_retirada) && (
                          <details className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
                            <summary className="cursor-pointer font-black text-gray-700">Observações</summary>
                            {registro.observacao_entrega && (
                              <p className="mt-2">
                                <span className="font-bold">Entrega:</span> {registro.observacao_entrega}
                              </p>
                            )}
                            {registro.observacao_retirada && (
                              <p className="mt-1 whitespace-pre-line">
                                <span className="font-bold">Retirada/baixa:</span> {registro.observacao_retirada}
                              </p>
                            )}
                          </details>
                        )}

                        {registro.status === 'Em lavanderia' || registro.status === 'Atrasado' ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setRetirada({
                                ...registro,
                                quantidade_ja_retirada: Number(registro.quantidade_retirada || 0),
                                quantidade_retirada: saldoPendenteLavanderia(registro),
                                observacao_retirada: '',
                                encerrar_pendencia: false,
                                motivo_baixa: '',
                                carteirinha_conferida: false,
                              })}
                              className="flex-1 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700"
                            >
                              Retirar
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelamento({ ...registro, motivo_cancelamento: '' })}
                              className="flex-1 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <p className="mt-3 text-xs font-semibold text-gray-400">Registro encerrado.</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-gray-50 text-xs font-black uppercase text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Convivente</th>
                        <th className="px-4 py-3 text-left">Entrega</th>
                        <th className="px-4 py-3 text-left">Prazo</th>
                        <th className="px-4 py-3 text-left">Peças</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map(registro => (
                        <tr key={registro.id} className="border-t border-gray-100">
                          <td className="px-4 py-3">
                            <p className="font-black text-gray-900">{registro.convivente_nome}</p>
                            <p className="text-xs font-semibold text-gray-500">Pront. #{registro.prontuario || 'S/N'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-700">{formatarDataHora(registro.entregue_em)}</p>
                            <p className="text-xs text-gray-500">{registro.usuario_entrega_nome || '-'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-700">{formatarDataHora(registro.prazo_retirada_em)}</p>
                            {registro.horas_restantes !== null && (
                              <p className={`text-xs font-bold ${registro.horas_restantes < 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                {registro.horas_restantes < 0
                                  ? `${Math.abs(registro.horas_restantes)}h atrasado`
                                  : `${registro.horas_restantes}h restantes`}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-black text-gray-800">
                            <p>{registro.quantidade_entregue} entregue(s)</p>
                            <p className="text-xs font-semibold text-gray-500">
                              {registro.quantidade_retirada || 0} retirada(s) · {saldoPendenteLavanderia(registro)} pendente(s)
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClasse(registro)}`}>
                              {registro.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {(registro.observacao_entrega || registro.observacao_retirada) && (
                              <details className="mb-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                <summary className="cursor-pointer font-black text-gray-700">Observações</summary>
                                {registro.observacao_entrega && (
                                  <p className="mt-2">
                                    <span className="font-bold">Entrega:</span> {registro.observacao_entrega}
                                  </p>
                                )}
                                {registro.observacao_retirada && (
                                  <p className="mt-1 whitespace-pre-line">
                                    <span className="font-bold">Retirada/baixa:</span> {registro.observacao_retirada}
                                  </p>
                                )}
                              </details>
                            )}
                            {registro.status === 'Em lavanderia' || registro.status === 'Atrasado' ? (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setRetirada({
                                    ...registro,
                                    quantidade_ja_retirada: Number(registro.quantidade_retirada || 0),
                                    quantidade_retirada: saldoPendenteLavanderia(registro),
                                    observacao_retirada: '',
                                    encerrar_pendencia: false,
                                    motivo_baixa: '',
                                    carteirinha_conferida: false,
                                  })}
                                  className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                                >
                                  Retirar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCancelamento({ ...registro, motivo_cancelamento: '' })}
                                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-gray-400">Encerrado</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>

                  {temMais && (
                    <div className="flex justify-center border-t border-gray-100 p-4">
                      <button
                        type="button"
                        onClick={carregarMaisRegistros}
                        disabled={carregandoMais}
                        className="rounded-2xl border border-blue-200 bg-white px-4 py-3 text-sm font-black text-blue-700 disabled:opacity-50"
                      >
                        {carregandoMais ? 'Carregando...' : 'Carregar mais registros'}
                      </button>
                    </div>
                  )}
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
              <h2 className="text-lg font-bold">Registrar retirada</h2>
              <p className="text-sm text-emerald-50">{retirada.convivente_nome}</p>
            </div>
            <div className="space-y-4 p-6">
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                Leia a carteirinha do convivente para confirmar que a retirada corresponde a este registro.
              </div>
              {retirada.carteirinha_conferida && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                  Carteirinha conferida com sucesso.
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setErro('');
                  setScannerContexto('retirada');
                }}
                className="min-h-11 w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-black text-white hover:bg-black"
              >
                Abrir câmera
              </button>
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Quantidade retirada agora</span>
                <input
                  type="number"
                  min="0"
                  max={saldoPendenteLavanderia(retirada)}
                  value={retirada.quantidade_retirada}
                  onChange={(event) => setRetirada(prev => ({ ...prev, quantidade_retirada: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                />
                <span className="mt-1 block text-xs font-semibold text-gray-500">
                  Entregues: {retirada.quantidade_entregue}. Já retiradas: {retirada.quantidade_ja_retirada || 0}. Saldo pendente: {saldoPendenteLavanderia(retirada)}.
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={retirada.encerrar_pendencia === true}
                  onChange={(event) => setRetirada(prev => ({
                    ...prev,
                    encerrar_pendencia: event.target.checked,
                  }))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-black">Dar baixa e encerrar pendência mesmo com saldo restante</span>
                  <span className="text-xs font-semibold">
                    Use quando as peças restantes forem descartadas, entregues por outro fluxo, perdidas, ou quando não haverá nova retirada.
                  </span>
                </span>
              </label>
              {retirada.encerrar_pendencia && (
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-gray-500">Motivo da baixa</span>
                  <input
                    value={retirada.motivo_baixa}
                    onChange={(event) => setRetirada(prev => ({ ...prev, motivo_baixa: event.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                    placeholder="Ex.: peças não retiradas, descarte autorizado, divergência conferida..."
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-black uppercase text-gray-500">Observação</span>
                <textarea
                  rows={3}
                  value={retirada.observacao_retirada}
                  onChange={(event) => setRetirada(prev => ({ ...prev, observacao_retirada: event.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Ex.: retirada parcial porque parte das peças ainda não secou."
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRetirada(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600">
                  Cancelar
                </button>
                <button type="button" onClick={confirmarRetirada} disabled={salvando} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Confirmar retirada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelamento && (
        <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="bg-red-600 p-5 text-white">
              <h2 className="text-lg font-bold">Cancelar registro</h2>
            </div>
            <div className="space-y-4 p-6">
              <textarea
                rows={4}
                value={cancelamento.motivo_cancelamento}
                onChange={(event) => setCancelamento(prev => ({ ...prev, motivo_cancelamento: event.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                placeholder="Informe o motivo do cancelamento..."
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCancelamento(null)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600">
                  Voltar
                </button>
                <button type="button" onClick={confirmarCancelamento} disabled={salvando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Confirmar cancelamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LeitorCarteirinhaModal
        aberto={Boolean(scannerContexto)}
        titulo={scannerContexto === 'retirada' ? 'Conferir carteirinha na retirada' : 'Abrir câmera'}
        subtitulo="Aponte para o QR Code ou código de barras da carteirinha do convivente."
        onCodigoLido={processarCodigoCarteirinha}
        onClose={() => setScannerContexto(null)}
      />
    </AppShell>
  );
}
