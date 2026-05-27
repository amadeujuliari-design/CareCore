import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import { API_ROOT } from './config/apiBase';
import logoCarecore from './assets/logo.png';
import {
  REGISTROS_POR_PAGINA,
  classeTipoRegistroRotina,
  filtrarRegistrosRotina,
  formatarDataHoraRotina,
  montarParamsFiltrosRotina,
  ordenarRegistrosRotina,
  resumirRegistrosRotina,
} from './utils/rotinaHistoricoUtils';

export default function RotinaHistorico() {

  const token = localStorage.getItem('@CareCore:token');

  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);

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
    return montarParamsFiltrosRotina({
      tipoFiltro,
      buscaFiltro,
      dataInicioFiltro,
      dataFimFiltro,
      statusFiltro,
      auditoriaFiltro,
    });
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
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setRegistros(response.data);

      setPaginaAtual(1);

    } catch (error) {

      console.error(error);

      alert(
        'Erro ao carregar histórico da rotina.'
      );

    } finally {

      setLoading(false);

    }
  };

  useEffect(() => {

    carregarHistorico();

    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      alert(
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
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setRegistroEditando(null);

      setNovoTipoRegistro('');

      setMotivoEdicao('');

      await carregarHistorico();

      alert('Registro editado com sucesso.');

    } catch (error) {

      console.error(error);

      alert(
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

      alert(
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
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setRegistroCancelando(null);

      setMotivoCancelamento('');

      await carregarHistorico();

      alert(
        'Registro cancelado com sucesso.'
      );

    } catch (error) {

      console.error(error);

      alert(
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

  const registrosOrdenados = useMemo(() => {
    return ordenarRegistrosRotina(registrosFiltrados);
  }, [registrosFiltrados]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(registrosOrdenados.length / registrosPorPagina)
  );

  const registrosPaginados = registrosOrdenados.slice(
    (paginaAtual - 1) * registrosPorPagina,
    paginaAtual * registrosPorPagina
  );

  const resumo = useMemo(() => {
    return resumirRegistrosRotina(registrosFiltrados);
  }, [registrosFiltrados]);

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
          headers: {
            Authorization: `Bearer ${token}`
          }
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

      alert(
        'Erro ao exportar XLSX.'
      );
    }
  };

  const abrirRelatorioImpressao = () => {

    const linhas = registrosOrdenados.map(registro => `
      <tr>
        <td>${formatarDataHoraRotina(registro.data_registro)}</td>
        <td>
          <strong>${registro.convivente_nome || '-'}</strong><br/>
          <small>#${registro.numero_institucional || 'S/N'}</small>
        </td>
        <td>${registro.tipo_registro || '-'}</td>
        <td>${registro.usuario_nome || '-'}</td>
        <td>${registro.cancelado ? 'Cancelado' : 'Ativo'}${registro.foi_editado ? ' / Editado' : ''}${registro.retorno_rapido ? ' / Retorno rápido' : ''}</td>
        <td>${registro.justificativa_retorno_rapido || registro.motivo_edicao || registro.motivo_cancelamento || ''}</td>
      </tr>
    `).join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Relatório - Histórico da Rotina</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #111827;
              padding: 24px;
            }

            h1 {
              margin: 0;
              font-size: 22px;
            }

            .cabecalho {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 24px;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 16px;
              margin-bottom: 18px;
            }

            .logo {
              width: 220px;
              max-height: 84px;
              object-fit: contain;
            }

            .titulo {
              text-align: right;
            }

            .subtitulo {
              color: #6b7280;
              margin-top: 4px;
              margin-bottom: 18px;
              font-size: 12px;
            }

            .resumo {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 18px;
            }

            .card {
              border: 1px solid #e5e7eb;
              border-radius: 10px;
              padding: 10px;
            }

            .card span {
              color: #6b7280;
              display: block;
              font-size: 11px;
              text-transform: uppercase;
              font-weight: bold;
            }

            .card strong {
              font-size: 20px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }

            th,
            td {
              border: 1px solid #e5e7eb;
              padding: 7px;
              vertical-align: top;
              text-align: left;
            }

            th {
              background: #f3f4f6;
              text-transform: uppercase;
              font-size: 10px;
            }

            .assinatura {
              margin-top: 48px;
              display: flex;
              justify-content: flex-end;
            }

            .linha-assinatura {
              width: 280px;
              border-top: 1px solid #111827;
              text-align: center;
              padding-top: 8px;
              font-size: 11px;
            }

            @media print {
              body {
                padding: 8px;
              }

              button {
                display: none;
              }
            }
          </style>
        </head>

        <body>
          <button onclick="window.print()" style="margin-bottom: 16px; padding: 8px 14px; border-radius: 8px; border: 1px solid #d1d5db; background: #fff; cursor: pointer;">
            Imprimir / Salvar PDF
          </button>

          <div class="cabecalho">
            <img class="logo" src="${logoCarecore}" alt="CARECORE+" />

            <div class="titulo">
              <h1>Histórico Geral da Rotina</h1>

              <div class="subtitulo">
                Relatório operacional gerado em ${new Date().toLocaleString('pt-BR')}
              </div>
            </div>
          </div>

          <div class="resumo">
            <div class="card"><span>Total</span><strong>${resumo.total}</strong></div>
            <div class="card"><span>Entradas</span><strong>${resumo.entradas}</strong></div>
            <div class="card"><span>Saídas</span><strong>${resumo.saidas}</strong></div>
            <div class="card"><span>Almoços</span><strong>${resumo.almocos}</strong></div>
            <div class="card"><span>Retorno rápido</span><strong>${resumo.retornosRapidos}</strong></div>
            <div class="card"><span>Editados</span><strong>${resumo.editados}</strong></div>
            <div class="card"><span>Cancelados</span><strong>${resumo.cancelados}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Convivente</th>
                <th>Tipo</th>
                <th>Operador</th>
                <th>Status</th>
                <th>Observações/Auditoria</th>
              </tr>
            </thead>

            <tbody>
              ${linhas || '<tr><td colspan="6">Nenhum registro encontrado.</td></tr>'}
            </tbody>
          </table>

          <div class="assinatura">
            <div class="linha-assinatura">
              Responsável pela conferência
            </div>
          </div>
        </body>
      </html>
    `;

    const janela = window.open('', '_blank');

    if (!janela) {
      alert('Permita pop-ups para abrir o relatório de impressão.');
      return;
    }

    janela.document.open();

    janela.document.write(html);

    janela.document.close();
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
    <div className="min-h-screen bg-gray-50 flex">

      <Sidebar />

      <div className="flex-1 p-4 md:p-6 overflow-auto">

        {/* HEADER */}

        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-5">

          <div>

            <h1 className="text-2xl font-black text-gray-800">
              Histórico Geral da Rotina
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Entradas, saídas e alimentação dos conviventes
            </p>

          </div>

          <div className="flex flex-wrap gap-2">

            <button
              type="button"
              onClick={exportarXLSX}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
            >
              Exportar XLSX
            </button>

            <button
              type="button"
              onClick={abrirRelatorioImpressao}
              className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black transition-colors"
            >
              Relatório para impressão
            </button>

          </div>

        </div>

        {/* RESUMO */}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs uppercase font-black text-gray-400">Total</p>
            <p className="text-2xl font-black text-gray-800">{resumo.total}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs uppercase font-black text-gray-400">Entradas</p>
            <p className="text-2xl font-black text-emerald-700">{resumo.entradas}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs uppercase font-black text-gray-400">Saídas</p>
            <p className="text-2xl font-black text-orange-700">{resumo.saidas}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs uppercase font-black text-gray-400">Almoços</p>
            <p className="text-2xl font-black text-blue-700">{resumo.almocos}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs uppercase font-black text-gray-400">Retornos</p>
            <p className="text-2xl font-black text-amber-700">{resumo.retornosRapidos}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs uppercase font-black text-gray-400">Editados</p>
            <p className="text-2xl font-black text-purple-700">{resumo.editados}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
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
                Tipo
              </label>

              <select
                value={tipoFiltro}
                onChange={(e) => {
                  setTipoFiltro(e.target.value);
                  setPaginaAtual(1);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                <option value="Entrada">Entrada</option>
                <option value="Saída">Saída</option>
                <option value="Almoço">Almoço</option>
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

          <div className="flex flex-wrap gap-2 mt-4">

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

          <div className="overflow-x-auto">

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

                        {(registro.justificativa_retorno_rapido || registro.motivo_edicao || registro.motivo_cancelamento) && (

                          <p
                            className="text-[11px] text-gray-500 mt-1 line-clamp-2 max-w-xl"
                            title={
                              registro.justificativa_retorno_rapido ||
                              registro.motivo_edicao ||
                              registro.motivo_cancelamento
                            }
                          >
                            {registro.justificativa_retorno_rapido && (
                              <>Justificativa: {registro.justificativa_retorno_rapido}</>
                            )}

                            {!registro.justificativa_retorno_rapido && registro.motivo_edicao && (
                              <>Edição: {registro.motivo_edicao}</>
                            )}

                            {!registro.justificativa_retorno_rapido && !registro.motivo_edicao && registro.motivo_cancelamento && (
                              <>Cancelamento: {registro.motivo_cancelamento}</>
                            )}
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

      {/* MODAL EDIÇÃO */}

      {registroEditando && (

        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">

          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">

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
                  <option value="Entrada">
                    Entrada
                  </option>

                  <option value="Saída">
                    Saída
                  </option>

                  <option value="Almoço">
                    Almoço
                  </option>

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

        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">

          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">

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

    </div>
  );
}
