import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ReportActionButton, ScrollArea } from './components/PremiumUI';
import DireitosReservadosAviso from './components/DireitosReservadosAviso';
import { API_ROOT } from './config/apiBase';
import {
  REGISTROS_POR_PAGINA,
  TIPOS_REGISTRO_FILTRO,
  TIPOS_REGISTRO_EDICAO,
  classeTipoRegistroRotina,
  contarRegistrosPorTipo,
  filtrarRegistrosRotina,
  formatarDataHoraRotina,
  montarParamsFiltrosRotina,
  ordenarRegistrosRotina,
  resumirRegistrosRotina,
  rotuloTipoRegistroFiltro,
} from './utils/rotinaHistoricoUtils';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import { urlArquivoBackend } from './utils/arquivosApi';
import { criarHeadersAutenticados } from './utils/requestIdUtils';

export default function RotinaHistorico() {

  const token = localStorage.getItem('@CareCore:token');

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  // filtros
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [buscaFiltro, setBuscaFiltro] = useState('');
  const [dataInicioFiltro, setDataInicioFiltro] = useState('');
  const [dataFimFiltro, setDataFimFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [auditoriaFiltro, setAuditoriaFiltro] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const registrosPorPagina = REGISTROS_POR_PAGINA;

  // edição
  const [registroEditando, setRegistroEditando] = useState(null);
  const [novoTipoRegistro, setNovoTipoRegistro] = useState('');
  const [motivoEdicao, setMotivoEdicao] = useState('');

  // cancelamento
  const [registroCancelando, setRegistroCancelando] = useState(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  // usuário logado
  let perfilUsuario = '';

  try {

    if (token) {

      const payload = JSON.parse(
        atob(token.split('.')[1])
      );

      perfilUsuario =
        payload?.perfil_acesso || '';
    }

  } catch (error) {

    console.error(
      'Erro ao ler token:',
      error
    );
  }

  const isGestor =
    perfilUsuario === 'Gestor' ||
    perfilUsuario === 'Gestao' ||
    perfilUsuario === 'Gerente';

  // =====================================================================
  // PARAMS
  // =====================================================================

  const montarParamsFiltros = () => {
    return {
      ...montarParamsFiltrosRotina({
      tipoFiltro,
      buscaFiltro,
      dataInicioFiltro,
      dataFimFiltro,
      statusFiltro,
      auditoriaFiltro,
      }),
      limite: 500,
    };
  };

  const avisarErro = (mensagem) => {
    setSucesso('');
    setErro(mensagem);
  };

  const avisarSucesso = (mensagem) => {
    setErro('');
    setSucesso(mensagem);
  };

  const montarObservacoesAuditoriaRegistro = (registro) => {
    return [
      registro.observacao ? `Complemento: ${registro.observacao}` : '',
      registro.justificativa_retorno_rapido ? `Justificativa: ${registro.justificativa_retorno_rapido}` : '',
      registro.motivo_edicao ? `Edição: ${registro.motivo_edicao}` : '',
      registro.motivo_cancelamento ? `Cancelamento: ${registro.motivo_cancelamento}` : '',
    ].filter(Boolean).join(' | ');
  };

  // =====================================================================
  // LOAD
  // =====================================================================

  const carregarHistorico = async () => {

    try {

      setLoading(true);

      const response = await axios.get(
        `${API_ROOT}/rotina/historico`,
        {
          params: montarParamsFiltros(),
          headers: criarHeadersAutenticados(token)
        }
      );

      setRegistros(response.data);

      setPaginaAtual(1);

    } catch (error) {

      console.error(error);

      avisarErro(
        'Erro ao carregar histórico da rotina.'
      );

    } finally {

      setLoading(false);

    }
  };

  const carregarIdentidadeRelatorio = async () => {
    try {
      const response = await axios.get(
        `${API_ROOT}/organizacao/identidade-relatorios`,
        {
          headers: criarHeadersAutenticados(token)
        }
      );

      setIdentidadeRelatorio(response.data || null);
    } catch (error) {
      console.error('Erro ao carregar identidade de relatório da rotina', error);
      setIdentidadeRelatorio(null);
    }
  };

  const obterLogoRelatorioParaImpressao = async () => {
    if (!identidadeRelatorio?.relatorio_logo_url || !token) {
      return '';
    }

    try {
      const response = await fetch(
        urlArquivoBackend(identidadeRelatorio.relatorio_logo_url),
        {
          headers: criarHeadersAutenticados(token)
        }
      );

      if (!response.ok) return '';

      const blob = await response.blob();

      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Erro ao preparar logo do relatório da rotina', error);
      return '';
    }
  };

  useEffect(() => {

    carregarHistorico();
    carregarIdentidadeRelatorio();

  }, []);

  // =====================================================================
  // EDIÇÃO
  // =====================================================================

  const abrirModalEdicao = (registro) => {

    setRegistroEditando(registro);

    setNovoTipoRegistro(
      registro.tipo_registro
    );

    setMotivoEdicao('');
  };

  const salvarEdicaoRegistro = async () => {

    if (!registroEditando) return;

    if (!motivoEdicao.trim()) {

      avisarErro(
        'Informe o motivo da edição.'
      );

      return;
    }

    try {

      await axios.put(
        `${API_ROOT}/rotina/${registroEditando.id}`,
        {
          tipo_registro: novoTipoRegistro,
          motivo_edicao: motivoEdicao
        },
        {
          headers: criarHeadersAutenticados(token)
        }
      );

      setRegistroEditando(null);

      setNovoTipoRegistro('');

      setMotivoEdicao('');

      await carregarHistorico();

      avisarSucesso('Registro editado com sucesso.');

    } catch (error) {

      console.error(error);

      avisarErro(
        error.response?.data?.detail ||
        'Erro ao editar registro.'
      );
    }
  };

  // =====================================================================
  // CANCELAMENTO
  // =====================================================================

  const abrirModalCancelamento = (registro) => {

    setRegistroCancelando(registro);

    setMotivoCancelamento('');
  };

  const confirmarCancelamentoRegistro = async () => {

    if (!registroCancelando) return;

    if (!motivoCancelamento.trim()) {

      avisarErro(
        'Informe o motivo do cancelamento.'
      );

      return;
    }

    try {

      await axios.patch(
        `${API_ROOT}/rotina/${registroCancelando.id}/cancelar`,
        {
          motivo_cancelamento:
            motivoCancelamento
        },
        {
          headers: criarHeadersAutenticados(token)
        }
      );

      setRegistroCancelando(null);

      setMotivoCancelamento('');

      await carregarHistorico();

      avisarSucesso(
        'Registro cancelado com sucesso.'
      );

    } catch (error) {

      console.error(error);

      avisarErro(
        error.response?.data?.detail ||
        'Erro ao cancelar registro.'
      );
    }
  };

  // =====================================================================
  // FILTROS / RESUMO
  // =====================================================================

  const registrosFiltrados = useMemo(() => {
    return filtrarRegistrosRotina(registros, {
      tipoFiltro,
      buscaFiltro,
      dataInicioFiltro,
      dataFimFiltro,
      statusFiltro,
      auditoriaFiltro,
    });
  }, [
    registros,
    tipoFiltro,
    buscaFiltro,
    dataInicioFiltro,
    dataFimFiltro,
    statusFiltro,
    auditoriaFiltro
  ]);

  // Conjunto que ignora o filtro de Tipo: usado nos cards de resumo (totais do
  // período) e na contagem dinâmica do tipo selecionado.
  const registrosFiltradosSemTipo = useMemo(() => {
    return filtrarRegistrosRotina(registros, {
      tipoFiltro: '',
      buscaFiltro,
      dataInicioFiltro,
      dataFimFiltro,
      statusFiltro,
      auditoriaFiltro,
    });
  }, [
    registros,
    buscaFiltro,
    dataInicioFiltro,
    dataFimFiltro,
    statusFiltro,
    auditoriaFiltro
  ]);

  const registrosOrdenados = useMemo(() => {
    return ordenarRegistrosRotina(registrosFiltrados, buscaFiltro);
  }, [buscaFiltro, registrosFiltrados]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(registrosOrdenados.length / registrosPorPagina)
  );

  const registrosPaginados = registrosOrdenados.slice(
    (paginaAtual - 1) * registrosPorPagina,
    paginaAtual * registrosPorPagina
  );

  const resumo = useMemo(() => {
    return resumirRegistrosRotina(registrosFiltradosSemTipo);
  }, [registrosFiltradosSemTipo]);

  const rotuloTipoSelecionado = useMemo(
    () => rotuloTipoRegistroFiltro(tipoFiltro),
    [tipoFiltro],
  );

  const totalTipoSelecionado = useMemo(
    () => contarRegistrosPorTipo(registrosFiltradosSemTipo, tipoFiltro),
    [registrosFiltradosSemTipo, tipoFiltro],
  );

  const limparFiltros = () => {

    setTipoFiltro('');
    setBuscaFiltro('');
    setDataInicioFiltro('');
    setDataFimFiltro('');
    setStatusFiltro('');
    setAuditoriaFiltro('');
    setPaginaAtual(1);
  };

  // =====================================================================
  // EXPORTAÇÃO XLSX / IMPRESSÃO
  // =====================================================================

  const exportarXLSX = async () => {

    try {

      const response = await axios.get(
        `${API_ROOT}/rotina/historico/exportar-xlsx`,
        {
          params: montarParamsFiltros(),
          responseType: 'blob',
          headers: criarHeadersAutenticados(token)
        }
      );

      const url = window.URL.createObjectURL(
        new Blob([response.data])
      );

      const link = document.createElement('a');

      link.href = url;

      link.setAttribute(
        'download',
        `historico_rotina_${new Date().toISOString().slice(0, 10)}.xlsx`
      );

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(url);

    } catch (error) {

      console.error(error);

      avisarErro(
        'Erro ao exportar XLSX.'
      );
    }
  };

  const abrirRelatorioImpressao = async () => {
    const logoRelatorioDataUrl = await obterLogoRelatorioParaImpressao();
    const filtrosAtivos = [
      tipoFiltro ? `Tipo: ${rotuloTipoRegistroFiltro(tipoFiltro)}` : '',
      dataInicioFiltro ? `Data inicial: ${dataInicioFiltro}` : '',
      dataFimFiltro ? `Data final: ${dataFimFiltro}` : '',
      buscaFiltro.trim() ? `Busca: ${buscaFiltro.trim()}` : '',
      statusFiltro ? `Status: ${statusFiltro}` : '',
      auditoriaFiltro ? `Auditoria: ${auditoriaFiltro}` : '',
    ].filter(Boolean);

    const colunas = [
      'Data/Hora',
      'Convivente',
      'Prontuário',
      'Tipo',
      'Operador',
      'Status',
      'Observações/Auditoria',
    ];

    const dados = registrosOrdenados.map((registro) => ({
      'Data/Hora': formatarDataHoraRotina(registro.data_registro),
      Convivente: registro.convivente_nome || '-',
      Prontuário: `#${registro.numero_institucional || 'S/N'}`,
      Tipo: registro.tipo_registro || '-',
      Operador: registro.usuario_nome || '-',
      Status: `${registro.cancelado ? 'Cancelado' : 'Ativo'}${registro.foi_editado ? ' / Editado' : ''}${registro.retorno_rapido ? ' / Retorno rápido' : ''}`,
      'Observações/Auditoria': montarObservacoesAuditoriaRegistro(registro) || '-',
    }));

    imprimirRelatorio({
      titulo: 'Histórico Geral da Rotina',
      subtitulo: `${registrosOrdenados.length} registro(s) filtrado(s). Filtros: ${filtrosAtivos.join(' | ') || 'Todos'}.`,
      metricas: [
        { label: 'Total', valor: resumo.total },
        { label: 'Entradas', valor: resumo.entradas },
        { label: 'Saídas', valor: resumo.saidas },
        { label: rotuloTipoSelecionado, valor: totalTipoSelecionado },
        { label: 'Retorno rápido', valor: resumo.retornosRapidos },
        { label: 'Editados', valor: resumo.editados },
        { label: 'Cancelados', valor: resumo.cancelados },
      ],
      conteudoExtraHtml: '',
      colunas,
      dados,
      identidade: {
        ...identidadeRelatorio,
        logo_src: logoRelatorioDataUrl,
      },
    });
  };

  // =====================================================================
  // HELPERS
  // =====================================================================

  const mudarPagina = (novaPagina) => {

    if (
      novaPagina < 1 ||
      novaPagina > totalPaginas
    ) {
      return;
    }

    setPaginaAtual(novaPagina);
  };

  // =====================================================================
  // RENDER
  // =====================================================================

  return (
    <AppShell>

      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Auditoria da rotina"
          title="Histórico Geral da Rotina"
          subtitle="Entradas, saídas, refeições, enxoval, bagagem, documentos e eventos de auditoria."
          icon="H"
          actions={(
            <>
            <ReportActionButton
              action="export"
              onClick={exportarXLSX}
            >
              Exportar
            </ReportActionButton>

            <ReportActionButton
              action="print"
              onClick={abrirRelatorioImpressao}
            >
              Imprimir
            </ReportActionButton>
            </>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="w-full max-w-7xl mx-auto">
            <DireitosReservadosAviso className="mb-4" />

        {erro && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {erro}
          </div>
        )}

        {sucesso && (
          <div className="mb-5 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-700">
            {sucesso}
          </div>
        )}

        {/* RESUMO */}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3 mb-5">

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
            <p className="text-xs uppercase font-black text-gray-400">Total</p>
            <p className="text-2xl font-black text-gray-800">{resumo.total}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
            <p className="text-xs uppercase font-black text-gray-400">Entradas</p>
            <p className="text-2xl font-black text-emerald-700">{resumo.entradas}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
            <p className="text-xs uppercase font-black text-gray-400">Saídas</p>
            <p className="text-2xl font-black text-orange-700">{resumo.saidas}</p>
          </div>

          <div className="bg-violet-50 rounded-2xl border border-violet-100 shadow-sm p-3 sm:p-4">
            <p className="text-xs uppercase font-black text-violet-400 truncate" title={rotuloTipoSelecionado}>
              {rotuloTipoSelecionado}
            </p>
            <p className="text-2xl font-black text-violet-700">{totalTipoSelecionado}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
            <p className="text-xs uppercase font-black text-gray-400">Retornos</p>
            <p className="text-2xl font-black text-amber-700">{resumo.retornosRapidos}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
            <p className="text-xs uppercase font-black text-gray-400">Editados</p>
            <p className="text-2xl font-black text-purple-700">{resumo.editados}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
            <p className="text-xs uppercase font-black text-gray-400">Cancelados</p>
            <p className="text-2xl font-black text-red-700">{resumo.cancelados}</p>
          </div>

        </div>

        {/* FILTROS */}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-5">

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">

            <div className="xl:col-span-2">

              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Busca
              </label>

              <input
                type="text"
                value={buscaFiltro}
                onChange={(e) => {
                  setBuscaFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
                placeholder="Nome ou prontuário"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Data Inicial
              </label>

              <input
                type="date"
                value={dataInicioFiltro}
                onChange={(e) => {
                  setDataInicioFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Data Final
              </label>

              <input
                type="date"
                value={dataFimFiltro}
                onChange={(e) => {
                  setDataFimFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Tipo de registro
              </label>

              <select
                value={tipoFiltro}
                onChange={(e) => {
                  setTipoFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {TIPOS_REGISTRO_FILTRO.map((opcao) => (
                  <option key={opcao.valor || 'todos'} value={opcao.valor}>
                    {opcao.label}
                  </option>
                ))}
              </select>

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Status
              </label>

              <select
                value={statusFiltro}
                onChange={(e) => {
                  setStatusFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="ativos">Ativos</option>
                <option value="cancelados">Cancelados</option>
              </select>

            </div>

            <div>

              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                Auditoria
              </label>

              <select
                value={auditoriaFiltro}
                onChange={(e) => {
                  setAuditoriaFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="editados">Editados</option>
                <option value="retorno_rapido">Retorno rápido</option>
              </select>

            </div>

          </div>

          <div className="grid grid-cols-1 gap-2 mt-4 sm:flex sm:flex-wrap">

            <button
              type="button"
              onClick={carregarHistorico}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
            >
              Aplicar Filtros
            </button>

            <button
              type="button"
              onClick={limparFiltros}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              Limpar
            </button>

          </div>

        </div>

        {/* TABELA COMPACTA */}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          <div className="px-4 py-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">

            <p className="text-sm text-gray-600">
              Exibindo{' '}
              <span className="font-bold">
                {registrosPaginados.length}
              </span>
              {' '}de{' '}
              <span className="font-bold">
                {registrosOrdenados.length}
              </span>
              {' '}registros filtrados
            </p>

            <p className="text-xs text-gray-400">
              Página {paginaAtual} de {totalPaginas}
            </p>

          </div>

          <div className="space-y-3 p-3 md:hidden">
            {loading ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                Carregando histórico...
              </div>
            ) : registrosPaginados.length === 0 ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                Nenhum registro encontrado.
              </div>
            ) : (
              registrosPaginados.map(registro => (
                <article
                  key={registro.id}
                  className={`rounded-2xl border p-4 shadow-sm ${registro.cancelado ? 'border-red-100 bg-red-50/60' : 'border-gray-100 bg-gray-50/70'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black uppercase text-gray-800">
                        {registro.convivente_nome}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        Prontuário #{registro.numero_institucional || 'S/N'} · {formatarDataHoraRotina(registro.data_registro)}
                      </p>
                    </div>

                    <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${classeTipoRegistroRotina(registro.tipo_registro)}`}>
                      {registro.tipo_registro}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {!registro.cancelado && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Ativo
                      </span>
                    )}
                    {registro.cancelado && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                        Cancelado
                      </span>
                    )}
                    {registro.foi_editado && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                        Editado
                      </span>
                    )}
                    {registro.retorno_rapido && (
                      <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        Retorno rápido
                      </span>
                    )}
                  </div>

                  {montarObservacoesAuditoriaRegistro(registro) && (
                    <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs leading-relaxed text-gray-600">
                      {montarObservacoesAuditoriaRegistro(registro)}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-gray-500">
                    <span>{registro.usuario_nome || 'Usuário'}</span>
                    {isGestor && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => abrirModalEdicao(registro)}
                          disabled={registro.cancelado}
                          className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 disabled:opacity-40"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirModalCancelamento(registro)}
                          disabled={registro.cancelado}
                          className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-40"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">

            <table className="w-full min-w-[980px]">

              <thead className="bg-gray-100 border-b border-gray-200">

                <tr>

                  <th className="px-3 py-3 text-left text-xs font-black text-gray-600 uppercase w-[145px]">
                    Data/Hora
                  </th>

                  <th className="px-3 py-3 text-left text-xs font-black text-gray-600 uppercase">
                    Convivente
                  </th>

                  <th className="px-3 py-3 text-left text-xs font-black text-gray-600 uppercase w-[105px]">
                    Tipo
                  </th>

                  <th className="px-3 py-3 text-left text-xs font-black text-gray-600 uppercase">
                    Status/Auditoria
                  </th>

                  <th className="px-3 py-3 text-left text-xs font-black text-gray-600 uppercase w-[170px]">
                    Operador
                  </th>

                  {isGestor && (

                    <th className="px-3 py-3 text-right text-xs font-black text-gray-600 uppercase w-[150px]">
                      Ações
                    </th>

                  )}

                </tr>

              </thead>

              <tbody>

                {loading ? (

                  <tr>

                    <td
                      colSpan={isGestor ? 6 : 5}
                      className="text-center py-10 text-gray-500"
                    >
                      Carregando histórico...
                    </td>

                  </tr>

                ) : registrosPaginados.length === 0 ? (

                  <tr>

                    <td
                      colSpan={isGestor ? 6 : 5}
                      className="text-center py-10 text-gray-500"
                    >
                      Nenhum registro encontrado.
                    </td>

                  </tr>

                ) : (

                  registrosPaginados.map(registro => (

                    <tr
                      key={registro.id}
                      className={`
                        border-b border-gray-100 hover:bg-gray-50 transition-colors
                        ${
                          registro.cancelado
                            ? 'bg-red-50/40'
                            : ''
                        }
                      `}
                    >

                      <td className="px-3 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {formatarDataHoraRotina(
                          registro.data_registro
                        )}
                      </td>

                      <td className="px-3 py-3">

                        <p className="text-sm font-black text-gray-800 uppercase leading-tight">
                          {registro.convivente_nome}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          Prontuário #{registro.numero_institucional || 'S/N'}
                        </p>

                      </td>

                      <td className="px-3 py-3">

                        <span
                          className={`
                            text-xs font-black px-2.5 py-1 rounded-full border
                            ${classeTipoRegistroRotina(registro.tipo_registro)}
                          `}
                        >
                          {registro.tipo_registro}
                        </span>

                      </td>

                      <td className="px-3 py-3">

                        <div className="flex flex-wrap gap-1.5">

                          {!registro.cancelado && (
                            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Ativo
                            </span>
                          )}

                          {registro.cancelado && (
                            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                              Cancelado
                            </span>
                          )}

                          {registro.foi_editado && (
                            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                              Editado
                            </span>
                          )}

                          {registro.retorno_rapido && (
                            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              Retorno rápido
                            </span>
                          )}

                        </div>

                        {montarObservacoesAuditoriaRegistro(registro) && (

                          <p
                            className="text-[11px] text-gray-500 mt-1 line-clamp-2 max-w-xl"
                            title={montarObservacoesAuditoriaRegistro(registro)}
                          >
                            {montarObservacoesAuditoriaRegistro(registro)}
                          </p>

                        )}

                      </td>

                      <td className="px-3 py-3">

                        <p className="text-sm font-bold text-gray-700 leading-tight">
                          {registro.usuario_nome}
                        </p>

                        <p className="text-xs text-gray-500 mt-1">
                          {registro.usuario_perfil}
                        </p>

                      </td>

                      {isGestor && (

                        <td className="px-3 py-3 text-sm">

                          <div className="flex justify-end gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                abrirModalEdicao(registro)
                              }
                              disabled={registro.cancelado}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                abrirModalCancelamento(registro)
                              }
                              disabled={registro.cancelado}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              Cancelar
                            </button>

                          </div>

                        </td>

                      )}

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

          <div className="px-4 py-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

            <button
              type="button"
              onClick={() => mudarPagina(paginaAtual - 1)}
              disabled={paginaAtual <= 1}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>

            <span className="text-sm text-gray-600 text-center">
              Página{' '}
              <strong>{paginaAtual}</strong>
              {' '}de{' '}
              <strong>{totalPaginas}</strong>
            </span>

            <button
              type="button"
              onClick={() => mudarPagina(paginaAtual + 1)}
              disabled={paginaAtual >= totalPaginas}
              className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Próxima
            </button>

          </div>

        </div>

          </div>
        </ScrollArea>

      {/* MODAL EDIÇÃO */}

      {registroEditando && (

        <div className="carecore-modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">

          <div className="carecore-modal-panel bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">

            <h2 className="text-xl font-black text-gray-800 mb-4">
              Editar Registro
            </h2>

            <div className="space-y-4">

              <div>

                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Novo Tipo
                </label>

                <select
                  value={novoTipoRegistro}
                  onChange={(e) =>
                    setNovoTipoRegistro(e.target.value)
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3"
                >
                  {TIPOS_REGISTRO_EDICAO.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}

                </select>

              </div>

              <div>

                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Motivo da Edição
                </label>

                <textarea
                  value={motivoEdicao}
                  onChange={(e) =>
                    setMotivoEdicao(e.target.value)
                  }
                  rows={4}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3"
                />

              </div>

            </div>

            <div className="flex justify-end gap-3 mt-6">

              <button
                type="button"
                onClick={() =>
                  setRegistroEditando(null)
                }
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={salvarEdicaoRegistro}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold"
              >
                Salvar
              </button>

            </div>

          </div>

        </div>

      )}

      {/* MODAL CANCELAMENTO */}

      {registroCancelando && (

        <div className="carecore-modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">

          <div className="carecore-modal-panel bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">

            <h2 className="text-xl font-black text-gray-800 mb-4">
              Cancelar Registro
            </h2>

            <p className="text-sm text-gray-500 mb-4">
              O registro não será apagado, apenas marcado como cancelado.
            </p>

            <div>

              <label className="block text-sm font-bold text-gray-700 mb-2">
                Motivo do Cancelamento
              </label>

              <textarea
                value={motivoCancelamento}
                onChange={(e) =>
                  setMotivoCancelamento(e.target.value)
                }
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-4 py-3"
              />

            </div>

            <div className="flex justify-end gap-3 mt-6">

              <button
                type="button"
                onClick={() =>
                  setRegistroCancelando(null)
                }
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold"
              >
                Fechar
              </button>

              <button
                type="button"
                onClick={confirmarCancelamentoRegistro}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold"
              >
                Confirmar Cancelamento
              </button>

            </div>

          </div>

        </div>

      )}

      </MainShell>
    </AppShell>
  );
}
