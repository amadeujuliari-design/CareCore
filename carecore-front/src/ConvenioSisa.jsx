import { useEffect, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ReportActionButton, ScrollArea } from './components/PremiumUI';
import AuthenticatedImage from './components/AuthenticatedImage';
import DireitosReservadosAviso from './components/DireitosReservadosAviso';
import { PaginacaoSisa, ResumoCard, Td, Th } from './components/convenio-sisa/ConvenioSisaUI';
import { ImportacoesSisa } from './components/convenio-sisa/ImportacoesSisa';
import logoCarecore from './assets/logo.PNG';
import { abrirPreviewHtml } from './utils/imprimirRelatorio';
import {
  atualizarTratativaDivergenciaSisa,
  buscarDetalheImportacaoSisa,
  buscarFechamentosSisa,
  buscarRelatorioDiarioSisa,
  buscarRelatorioMensalSisa,
  excluirImportacaoSisa,
  exportarMensalSisaXlsx,
  fecharMesSisa,
  importarPlanilhaConvenioSisa,
  listarImportacoesSisa,
  listarDivergenciasImportacaoSisa,
  previsualizarImportacaoConvenioSisa,
  reabrirMesSisa,
} from './services/convenioSisaService';
import {
  FILTROS_ATENDIMENTO_SISA,
  FILTROS_DIVERGENCIA_PADRAO,
  IMPORTACOES_POR_PAGINA_SISA,
  DIVERGENCIAS_POR_PAGINA_SISA,
  EXPORT_DIVERGENCIAS_SISA_LIMITE,
  montarParamsDivergenciasSisaApi,
  calcularResumoDiarioSisa,
  calcularResumoMensalSisa,
  dataLocalISO,
  descreverFiltrosDivergencias,
  escaparHtml,
  filtrarItensAtendimentoSisa,
  formatarDataPt,
  formatarTipoDivergencia,
  montarResumoCardsDiariosSisa,
  paginarItensSisa,
} from './utils/convenioSisaUtils';
import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from './utils/direitosReservados';
import {
  buscarIdentidadeRelatorios,
  obterLogoRelatorioDataUrl,
  obterLogoRelatorioSrc,
} from './utils/relatorioIdentidadePrint';
import { decodificarPayloadJwt } from './utils/jwtUtils';

export default function ConvenioSisa() {
  const token = localStorage.getItem('@CareCore:token');
  let perfilUsuario = '';
  let usuarioMaster = false;

  try {
    if (token) {
      const payload = decodificarPayloadJwt(token) || {};
      perfilUsuario = payload.perfil_acesso || '';
      usuarioMaster = Boolean(payload.is_master);
    }
  } catch (error) {
    console.error('Erro ao ler token no Convênio/SISA', error);
  }

  const podeFecharOuReabrirMes =
    usuarioMaster ||
    ['Gestor', 'Gestao', 'Gestão', 'Gerente'].includes(perfilUsuario);
  const podeExcluirImportacoesSisa =
    usuarioMaster ||
    ['Gestor', 'Gestao', 'Gestão', 'Gerente', 'Manutenção', 'Manutencao'].includes(perfilUsuario);

  const hoje = new Date();
  const dataHoje = dataLocalISO(hoje);

  const [aba, setAba] = useState('relatorio');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);

  const [dataInicio, setDataInicio] = useState(dataHoje);
  const [dataFim, setDataFim] = useState(dataHoje);
  const [dataDiaria, setDataDiaria] = useState(dataHoje);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);

  const [diario, setDiario] = useState({ resumo: {}, items: [] });
  const [mensal, setMensal] = useState({ resumo: {}, items: [] });
  const [importacoes, setImportacoes] = useState([]);
  const [totalImportacoes, setTotalImportacoes] = useState(0);
  const [importacoesTemMais, setImportacoesTemMais] = useState(false);
  const [importacaoSelecionada, setImportacaoSelecionada] = useState(null);
  const [divergenciasSisa, setDivergenciasSisa] = useState([]);
  const [totalDivergenciasSisa, setTotalDivergenciasSisa] = useState(0);
  const [divergenciasSisaTemMais, setDivergenciasSisaTemMais] = useState(false);
  const [resumoDivergenciasSisa, setResumoDivergenciasSisa] = useState({
    pendencias: 0,
    alertas_criticos: 0,
    dias_perdidos_filtrados: 0,
  });
  const [carregandoDivergenciasSisa, setCarregandoDivergenciasSisa] = useState(false);
  const [arquivoSisa, setArquivoSisa] = useState(null);
  const [previaImportacaoSisa, setPreviaImportacaoSisa] = useState(null);
  const [selecoesPreviaSisa, setSelecoesPreviaSisa] = useState({
    criar_ativos: [],
    criar_inativos: [],
    inativar_existentes: [],
    mesclar_duplicidades: [],
    reativar_existentes: [],
  });
  const [importandoSisa, setImportandoSisa] = useState(false);
  const [excluindoImportacaoId, setExcluindoImportacaoId] = useState('');
  const [filtrosDivergencia, setFiltrosDivergencia] = useState(FILTROS_DIVERGENCIA_PADRAO);
  const arquivoSisaInputRef = useRef(null);

  const [observacoesFechamento, setObservacoesFechamento] = useState('');
  const [fechamentoAtual, setFechamentoAtual] = useState(null);
  const [filtroAtendimento, setFiltroAtendimento] = useState('com_presenca');
  const [paginaMensal, setPaginaMensal] = useState(1);
  const [paginaDiaria, setPaginaDiaria] = useState(1);
  const itensPorPaginaSisa = 20;

  const avisarErro = (mensagem) => {
    setSucesso('');
    setErro(mensagem);
  };

  const avisarSucesso = (mensagem) => {
    setErro('');
    setSucesso(mensagem);
  };

  const carregarDiario = async (dataReferencia = dataDiaria) => {
    try {
      setLoading(true);

      const dados = await buscarRelatorioDiarioSisa({ data: dataReferencia });

      setDiario(dados);
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

  const carregarFechamentoAtual = async (anoReferencia = ano, mesReferencia = mes) => {
    try {
      const { items: fechamentos } = await buscarFechamentosSisa();

      const encontrado = (fechamentos || []).find(item =>
        Number(item.ano) === Number(anoReferencia) &&
        Number(item.mes) === Number(mesReferencia)
      );

      setFechamentoAtual(encontrado || null);

      return encontrado || null;
    } catch (error) {
      console.error(error);
      setFechamentoAtual(null);
      return null;
    }
  };

  const carregarMensal = async ({ inicioPeriodo = dataInicio, fimPeriodo = dataFim } = {}) => {
    try {
      setLoading(true);

      const dataBase = new Date(`${inicioPeriodo}T00:00:00`);
      const anoPeriodo = dataBase.getFullYear();
      const mesPeriodo = dataBase.getMonth() + 1;

      const dados = await buscarRelatorioMensalSisa({
        ano: anoPeriodo,
        mes: mesPeriodo,
        dataInicio: inicioPeriodo,
        dataFim: fimPeriodo,
      });

      setMensal(dados);
      setAno(anoPeriodo);
      setMes(mesPeriodo);

      await carregarFechamentoAtual(anoPeriodo, mesPeriodo);
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

  const carregarRelatorioPeriodo = async () => {
    if (!dataInicio || !dataFim) {
      avisarErro('Informe a data inicial e a data final.');
      return;
    }

    if (dataInicio > dataFim) {
      avisarErro('A data inicial não pode ser maior que a data final.');
      return;
    }

    const inicio = new Date(`${dataInicio}T00:00:00`);
    const fim = new Date(`${dataFim}T00:00:00`);
    const mesmoMes = (
      inicio.getFullYear() === fim.getFullYear() &&
      inicio.getMonth() === fim.getMonth()
    );

    if (!mesmoMes) {
      avisarErro('Por enquanto, selecione um período dentro do mesmo mês.');
      return;
    }

    setErro('');
    setDataDiaria(dataInicio);

    if (dataInicio === dataFim) {
      await carregarDiario(dataInicio);
      return;
    }

    await carregarMensal({ inicioPeriodo: dataInicio, fimPeriodo: dataFim });
  };

  const carregarImportacoes = async ({ append = false } = {}) => {
    try {
      const resposta = await listarImportacoesSisa({
        limit: IMPORTACOES_POR_PAGINA_SISA,
        offset: append ? importacoes.length : 0,
      });
      const importacoesSisa = resposta.items || [];

      setImportacoes((prev) => (append ? [...prev, ...importacoesSisa] : importacoesSisa));
      setTotalImportacoes(resposta.total ?? importacoesSisa.length);
      setImportacoesTemMais(Boolean(resposta.has_more));

      if (!append && importacoesSisa.length > 0 && !importacaoSelecionada) {
        await carregarDetalheImportacao(importacoesSisa[0].id);
      }
    } catch (error) {
      console.error(error);
      avisarErro('Erro ao carregar importações SISA.');
    }
  };

  const carregarDivergenciasImportacao = async (
    importacaoId,
    { append = false, filtros = filtrosDivergencia, limite = DIVERGENCIAS_POR_PAGINA_SISA } = {},
  ) => {
    if (!importacaoId) return;

    try {
      if (!append) {
        setCarregandoDivergenciasSisa(true);
      }

      const resposta = await listarDivergenciasImportacaoSisa(
        importacaoId,
        montarParamsDivergenciasSisaApi(filtros, {
          limit: limite,
          offset: append ? divergenciasSisa.length : 0,
        }),
      );
      const itens = resposta.items || [];

      setDivergenciasSisa((prev) => (append ? [...prev, ...itens] : itens));
      setTotalDivergenciasSisa(resposta.total ?? itens.length);
      setDivergenciasSisaTemMais(Boolean(resposta.has_more));
      setResumoDivergenciasSisa(resposta.resumo || {
        pendencias: 0,
        alertas_criticos: 0,
        dias_perdidos_filtrados: 0,
      });
    } catch (error) {
      console.error(error);
      avisarErro('Erro ao carregar divergências da importação SISA.');
    } finally {
      setCarregandoDivergenciasSisa(false);
    }
  };

  const carregarDetalheImportacao = async (importacaoId) => {
    if (!importacaoId) return;

    try {
      const detalhe = await buscarDetalheImportacaoSisa(importacaoId);

      setImportacaoSelecionada(detalhe);
      setDivergenciasSisa([]);
    } catch (error) {
      console.error(error);
      avisarErro('Erro ao carregar detalhes da importação SISA.');
    }
  };

  const atualizarArquivoSisa = (arquivo) => {
    setArquivoSisa(arquivo);
    setPreviaImportacaoSisa(null);
    setSelecoesPreviaSisa({
      criar_ativos: [],
      criar_inativos: [],
      inativar_existentes: [],
      mesclar_duplicidades: [],
      reativar_existentes: [],
    });
  };

  const previsualizarPlanilhaSisa = async () => {
    if (!arquivoSisa) {
      avisarErro('Selecione a planilha .xls ou .xlsx exportada do SISA.');
      return;
    }

    try {
      setImportandoSisa(true);
      const formData = new FormData();
      formData.append('arquivo', arquivoSisa);

      const previa = await previsualizarImportacaoConvenioSisa(formData);

      setPreviaImportacaoSisa(previa);
      setSelecoesPreviaSisa({
        criar_ativos: (previa.criar_ativos || []).map((item) => item.numero_sisa),
        criar_inativos: (previa.criar_inativos || []).map((item) => item.numero_sisa),
        inativar_existentes: (previa.inativar_existentes || []).map((item) => item.convivente_id).filter(Boolean),
        mesclar_duplicidades: (previa.possiveis_duplicidades || [])
          .filter((item) => item.convivente_id)
          .map((item) => `${item.numero_sisa}:${item.convivente_id}`),
        reativar_existentes: (previa.reativar_existentes || []).map((item) => item.convivente_id).filter(Boolean),
      });
      avisarSucesso('Prévia SISA gerada. Revise as ações sugeridas antes de confirmar.');
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao analisar planilha SISA.'
      );
    } finally {
      setImportandoSisa(false);
    }
  };

  const alternarSelecaoPreviaSisa = (grupo, id) => {
    setSelecoesPreviaSisa((atual) => {
      const selecionados = new Set(atual[grupo] || []);
      if (selecionados.has(id)) {
        selecionados.delete(id);
      } else {
        selecionados.add(id);
      }

      return {
        ...atual,
        [grupo]: Array.from(selecionados),
      };
    });
  };

  const obterIdAcaoPreviaSisa = (item, grupo) => {
    if (grupo === 'inativar_existentes') return item.convivente_id;
    if (grupo === 'reativar_existentes') return item.convivente_id;
    if (grupo === 'mesclar_duplicidades') return `${item.numero_sisa}:${item.convivente_id}`;
    return item.numero_sisa;
  };

  const selecionarTodosPreviaSisa = (grupo, itens = []) => {
    const ids = itens
      .map((item) => obterIdAcaoPreviaSisa(item, grupo))
      .filter(Boolean);

    setSelecoesPreviaSisa((atual) => ({
      ...atual,
      [grupo]: ids,
    }));
  };

  const limparSelecaoPreviaSisa = (grupo) => {
    setSelecoesPreviaSisa((atual) => ({
      ...atual,
      [grupo]: [],
    }));
  };

  const confirmarImportacaoSisa = async () => {
    if (!arquivoSisa || !previaImportacaoSisa) {
      avisarErro('Gere a prévia da planilha antes de confirmar a importação.');
      return;
    }

    try {
      setImportandoSisa(true);
      const formData = new FormData();
      formData.append('arquivo', arquivoSisa);
      formData.append('acoes_json', JSON.stringify(selecoesPreviaSisa));

      const importacao = await importarPlanilhaConvenioSisa(formData);

      atualizarArquivoSisa(null);
      if (arquivoSisaInputRef.current) {
        arquivoSisaInputRef.current.value = '';
      }
      await carregarImportacoes();
      await carregarDetalheImportacao(importacao.id);
      avisarSucesso('Planilha SISA importada, conferida e ações selecionadas aplicadas com sucesso.');
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao importar planilha SISA.'
      );
    } finally {
      setImportandoSisa(false);
    }
  };

  const renderLinhaPreviaSisa = (item, grupo, selecionavel = true) => {
    const id = obterIdAcaoPreviaSisa(item, grupo);
    const selecionado = (selecoesPreviaSisa[grupo] || []).includes(id);

    return (
      <label
        key={`${grupo}-${id || item.numero_sisa}`}
        className={`flex gap-3 rounded-xl border p-3 text-sm ${
          selecionavel ? 'cursor-pointer border-gray-200 bg-white hover:bg-gray-50' : 'border-amber-100 bg-amber-50'
        }`}
      >
        {selecionavel && (
          <input
            type="checkbox"
            checked={selecionado}
            onChange={() => alternarSelecaoPreviaSisa(grupo, id)}
            className="mt-1 h-4 w-4 rounded border-gray-300"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-gray-900">{item.nome || item.convivente_nome}</strong>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-600">
              SISA {item.numero_sisa || '-'}
            </span>
            {item.status_sugerido && (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase text-brand">
                {item.status_sugerido}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            Nasc.: {formatarDataPt(item.data_nascimento)} · Vinc.: {formatarDataPt(item.data_vinculacao)} · Deslig.: {formatarDataPt(item.data_desligamento)}
          </p>
          {item.motivo && (
            <p className="mt-1 text-xs font-semibold text-gray-600">{item.motivo}</p>
          )}
          {grupo === 'mesclar_duplicidades' && item.convivente_nome && (
            <p className="mt-1 text-xs font-black text-emerald-700">
              Mesclar com: {item.convivente_nome}
            </p>
          )}
        </div>
      </label>
    );
  };

  const renderGrupoPreviaSisa = ({ titulo, descricao, itens, grupo, selecionavel = true }) => {
    if (!itens?.length) return null;

    const selecionados = selecionavel
      ? itens.filter((item) => {
        const id = obterIdAcaoPreviaSisa(item, grupo);
        return (selecoesPreviaSisa[grupo] || []).includes(id);
      }).length
      : 0;

    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-black uppercase text-gray-700">{titulo}</h4>
            <p className="text-xs font-semibold text-gray-500">{descricao}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700">
              {selecionavel ? `${selecionados}/${itens.length} selecionado(s)` : `${itens.length} para revisão`}
            </span>
            {selecionavel && (
              <>
                <button
                  type="button"
                  onClick={() => selecionarTodosPreviaSisa(grupo, itens)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase text-gray-600 hover:bg-gray-50"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => limparSelecaoPreviaSisa(grupo)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-[11px] font-black uppercase text-gray-600 hover:bg-gray-50"
                >
                  Limpar
                </button>
              </>
            )}
          </div>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {itens.map((item) => renderLinhaPreviaSisa(item, grupo, selecionavel))}
        </div>
      </section>
    );
  };

  const atualizarStatusDivergencia = async (divergenciaId, novoStatus) => {
    try {
      const divergenciaAtualizada = await atualizarTratativaDivergenciaSisa(divergenciaId, novoStatus);

      setDivergenciasSisa((prev) => (prev || []).map((item) =>
        item.id === divergenciaId ? { ...item, ...divergenciaAtualizada } : item
      ));
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao atualizar a tratativa da divergência.'
      );
    }
  };

  const excluirImportacaoSelecionada = async (importacao) => {
    if (!importacao?.id) return;

    const confirmado = window.confirm(
      `Excluir a importação SISA de ${formatarDataPt(importacao.data_referencia)}?\n\n` +
      'Esta ação remove a conferência importada, suas presenças e divergências vinculadas. ' +
      'Os cadastros de conviventes e lançamentos manuais do CareCore+ não serão alterados.'
    );

    if (!confirmado) return;

    try {
      setExcluindoImportacaoId(importacao.id);
      await excluirImportacaoSisa(importacao.id);

      const respostaImportacoes = await listarImportacoesSisa();
      const importacoesAtualizadas = respostaImportacoes.items || [];
      setImportacoes(importacoesAtualizadas);
      setTotalImportacoes(respostaImportacoes.total ?? importacoesAtualizadas.length);
      setImportacoesTemMais(Boolean(respostaImportacoes.has_more));

      if (importacoesAtualizadas.length > 0) {
        await carregarDetalheImportacao(importacoesAtualizadas[0].id);
      } else {
        setImportacaoSelecionada(null);
        setDivergenciasSisa([]);
        setTotalDivergenciasSisa(0);
        setDivergenciasSisaTemMais(false);
      }

      avisarSucesso('Importação SISA excluída com sucesso.');
    } catch (error) {
      console.error(error);
      avisarErro(
        error.response?.data?.detail ||
        'Erro ao excluir importação SISA.'
      );
    } finally {
      setExcluindoImportacaoId('');
    }
  };

  useEffect(() => {
    carregarRelatorioPeriodo();
    carregarImportacoes();
    buscarIdentidadeRelatorios().then(setIdentidadeRelatorio);
  }, []);

  useEffect(() => {
    if (!importacaoSelecionada?.id || aba !== 'importacoes') return;
    carregarDivergenciasImportacao(importacaoSelecionada.id, { append: false });
  }, [importacaoSelecionada?.id, filtrosDivergencia, aba]);

  useEffect(() => {
    setPaginaMensal(1);
    setPaginaDiaria(1);
  }, [aba, dataInicio, dataFim, filtroAtendimento]);

  const formatarDataHora = (valor) => {
    if (!valor) return '-';

    return new Date(valor).toLocaleString('pt-BR');
  };

  const formatarRefeicaoRelatorio = (valorSimNao, quantidade = 0, extras = 0) => {
    const total = Number(quantidade || 0);
    const totalExtras = Number(extras || Math.max(total - 1, 0));

    if (total <= 0 && valorSimNao !== 'Sim') return valorSimNao || '-';
    if (total <= 1) return 'Sim';

    return `Sim (${total}, ${totalExtras} extra${totalExtras === 1 ? '' : 's'})`;
  };

  const exportarMensalXlsx = async () => {
    try {
      const dataBase = new Date(`${dataInicio}T00:00:00`);
      const dataFinalBase = new Date(`${dataFim}T00:00:00`);

      if (dataInicio > dataFim) {
        avisarErro('A data inicial não pode ser maior que a data final.');
        return;
      }

      if (
        dataBase.getFullYear() !== dataFinalBase.getFullYear() ||
        dataBase.getMonth() !== dataFinalBase.getMonth()
      ) {
        avisarErro('Por enquanto, exporte períodos dentro do mesmo mês.');
        return;
      }

      const arquivo = await exportarMensalSisaXlsx({
        ano: dataBase.getFullYear(),
        mes: dataBase.getMonth() + 1,
        tipoAtendimento: filtroAtendimento,
        dataInicio,
        dataFim,
      });

      const blob = new Blob(
        [arquivo],
        {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      );

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `relatorio_sisa_convenio_${dataInicio}_a_${dataFim}.xlsx`;
      link.click();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      avisarErro('Erro ao exportar XLSX.');
    }
  };


  const imprimir = async () => {
    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
    const logoRelatorioSrc = obterLogoRelatorioSrc(logoRelatorioDataUrl);
    const nomeExibicaoRelatorio = identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+';
    const rodapeRelatorioItens = [
      identidadeRelatorio?.relatorio_rodape_linha1,
      identidadeRelatorio?.relatorio_rodape_linha2,
      identidadeRelatorio?.relatorio_telefone ? `Telefone: ${identidadeRelatorio.relatorio_telefone}` : '',
      identidadeRelatorio?.relatorio_email ? `E-mail: ${identidadeRelatorio.relatorio_email}` : '',
      identidadeRelatorio?.relatorio_site ? `Site: ${identidadeRelatorio.relatorio_site}` : '',
    ].filter(Boolean);
    const rodapeRelatorioHtml = `
      <footer class="rodape-relatorio">
        ${
          rodapeRelatorioItens.length
            ? rodapeRelatorioItens.map(item => `<div>${escaparHtml(item)}</div>`).join('')
            : '<div>Relatório gerado pelo CareCore+</div>'
        }
        <div class="direitos-reservados">
          <a href="${escaparHtml(obterUrlDireitosReservados())}" target="_blank" rel="noopener noreferrer">
            ${escaparHtml(DIREITOS_RESERVADOS_TITULO)}
          </a>
        </div>
      </footer>
    `;

    if (aba === 'importacoes') {
      const importacao = importacaoSelecionada;
      let divergencias = divergenciasSisa;

      if (importacao?.id) {
        const respostaCompleta = await listarDivergenciasImportacaoSisa(
          importacao.id,
          montarParamsDivergenciasSisaApi(filtrosDivergencia, {
            limit: EXPORT_DIVERGENCIAS_SISA_LIMITE,
            offset: 0,
          }),
        );
        divergencias = respostaCompleta.items || [];
      }

      const alertasCriticos = divergencias.filter(item => item.tipo === 'SISA_MENOR' || item.prioridade === 'Crítica');
      const pendencias = divergencias.filter(item => !['OK', 'SEM_BASE_ANTERIOR'].includes(item.tipo));
      const subtituloFiltros = descreverFiltrosDivergencias(filtrosDivergencia);
      const titulo = importacao
        ? `Conferência de Importação SISA - ${formatarDataPt(importacao.data_referencia)}`
        : 'Conferência de Importação SISA';
      const cards = [
        { titulo: 'Registros filtrados', valor: divergencias.length },
        { titulo: 'Pendências', valor: pendencias.length },
        { titulo: 'Alertas críticos', valor: alertasCriticos.length },
        { titulo: 'Total de linhas', valor: importacao?.total_linhas || 0 },
      ];
      const cardsHtml = cards.map(card => `
        <div class="card">
          <span>${escaparHtml(card.titulo)}</span>
          <strong>${Number(card.valor || 0).toLocaleString('pt-BR')}</strong>
        </div>
      `).join('');
      const corpo = divergencias.length
        ? divergencias.map(item => `
          <tr class="${item.tipo === 'SISA_MENOR' ? 'critico' : ''}">
            <td><strong>${escaparHtml(item.nome_convivente)}</strong><br><small>SISA ${escaparHtml(item.numero_sisa)}</small></td>
            <td>${escaparHtml(formatarTipoDivergencia(item.tipo))}</td>
            <td>${escaparHtml(item.prioridade || '-')}</td>
            <td>${escaparHtml(item.data_inicio ? `${formatarDataPt(item.data_inicio)} a ${formatarDataPt(item.data_fim)}` : formatarDataPt(item.data_fim))}</td>
            <td>${escaparHtml(item.dias_sisa_delta ?? item.dias_sisa_atual)}</td>
            <td>${escaparHtml(item.dias_carecore)}</td>
            <td>${escaparHtml(item.diferenca ?? '-')}</td>
            <td>${escaparHtml(item.status || 'Pendente')}</td>
          </tr>
          <tr class="detalhe ${item.tipo === 'SISA_MENOR' ? 'critico' : ''}">
            <td colspan="8">${escaparHtml(item.mensagem || '-')}</td>
          </tr>
        `).join('')
        : '<tr><td colspan="8">Nenhuma divergência para os filtros aplicados.</td></tr>';
      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${escaparHtml(titulo)}</title>
            <style>
              body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
              header { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 18px; }
              .logo { width: 220px; max-height: 84px; object-fit: contain; }
              .titulo { text-align: right; }
              .identidade-nome { margin-top: 6px; color: #374151; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
              h1 { margin: 0; font-size: 22px; }
              p { margin: 4px 0; color: #6b7280; font-size: 12px; }
              .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
              .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px; background: #f9fafb; }
              .card span { display: block; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; }
              .card strong { display: block; margin-top: 3px; font-size: 20px; }
              table { width: 100%; border-collapse: collapse; font-size: 10px; }
              th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: top; }
              th { background: #f3f4f6; text-transform: uppercase; font-size: 9px; }
              small { color: #6b7280; font-weight: 700; }
              .critico td { background: #fef2f2; }
              .detalhe td { color: #374151; font-size: 9px; }
              .rodape-relatorio { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 8px; text-align: center; color: #6b7280; font-size: 10px; line-height: 1.4; }
              .direitos-reservados { margin-top: 5px; font-size: 9px; font-weight: 700; }
              .direitos-reservados a { color: #4f46e5; text-decoration: none; }
              @media print { body { padding: 8px; } .cards { grid-template-columns: repeat(4, 1fr); } }
            </style>
          </head>
          <body>
            <header>
              <div>
                <img class="logo" src="${logoRelatorioSrc}" alt="${escaparHtml(nomeExibicaoRelatorio)}" />
                <div class="identidade-nome">${escaparHtml(nomeExibicaoRelatorio)}</div>
              </div>
              <div class="titulo">
                <h1>${escaparHtml(titulo)}</h1>
                <p>${escaparHtml(importacao?.nome_arquivo || 'Sem arquivo selecionado')}</p>
                <p>Filtros: ${escaparHtml(subtituloFiltros)}</p>
                <p>${divergencias.length} registro(s). Gerado em ${escaparHtml(new Date().toLocaleString('pt-BR'))}</p>
              </div>
            </header>
            <section class="cards">${cardsHtml}</section>
            <table>
              <thead>
                <tr>
                  <th>Convivente</th>
                  <th>Tipo</th>
                  <th>Prioridade</th>
                  <th>Período</th>
                  <th>SISA</th>
                  <th>CareCore+</th>
                  <th>Dif.</th>
                  <th>Tratativa</th>
                </tr>
              </thead>
              <tbody>${corpo}</tbody>
            </table>
            ${rodapeRelatorioHtml}
          </body>
        </html>
      `;

      abrirPreviewHtml({ titulo, html, orientacaoInicial: 'landscape' });
      return;
    }

    const titulo = `Relatório Convênio / SISA - ${periodoLabel}`;
    const subtitulo = `Período: ${periodoLabel} · Recorte SISA: ${filtroAtendimentoLabel}`;
    const cards = !periodoEhDia
      ? [
        { titulo: 'Conviventes', valor: resumoMensalFiltrado.conviventes },
        { titulo: 'Presenças', valor: resumoMensalFiltrado.total_atendimentos },
        { titulo: 'Justificativas', valor: resumoMensalFiltrado.total_justificativas },
        { titulo: 'Entradas', valor: resumoMensalFiltrado.total_entradas },
        { titulo: 'Saídas', valor: resumoMensalFiltrado.total_saidas },
        { titulo: 'Cafés', valor: resumoMensalFiltrado.total_cafes },
        { titulo: 'Almoços', valor: resumoMensalFiltrado.total_almocos },
        { titulo: 'Jantares', valor: resumoMensalFiltrado.total_jantares },
        { titulo: 'Lanches', valor: resumoMensalFiltrado.total_lanches },
        { titulo: 'Extras', valor: resumoMensalFiltrado.total_refeicoes_extras },
        { titulo: 'Banhos', valor: resumoMensalFiltrado.total_banhos },
      ]
      : resumoCardsDiarios;
    const colunas = !periodoEhDia
      ? ['Pront.', 'Nº SISA', 'Convivente', 'Presenças', 'Justificativas', 'Entradas', 'Saídas', 'Cafés', 'Almoços', 'Jantares', 'Lanches', 'Extras', 'Banhos']
      : ['Pront.', 'Nº SISA', 'Convivente', 'Presença', 'Justificativa', 'Entrada', 'Saída', 'Café', 'Almoço', 'Jantar', 'Lanche', 'Extras', 'Banho', 'Observações'];
    const linhas = !periodoEhDia
      ? itensMensaisFiltrados.map(item => [
        `#${item.prontuario || 'S/N'}`,
        item.numero_sisa || '-',
        item.nome || '-',
        item.total_atendimentos ?? item.dias_presentes ?? 0,
        item.dias_justificados ?? 0,
        item.entradas ?? 0,
        item.saidas ?? 0,
        item.cafes ?? 0,
        item.almocos ?? 0,
        item.jantares ?? 0,
        item.lanches ?? 0,
        item.refeicoes_extras ?? 0,
        item.banhos ?? 0,
      ])
      : itensDiariosFiltrados.map(item => [
        `#${item.prontuario || 'S/N'}`,
        item.numero_sisa || '-',
        item.nome || '-',
        item.presenca || '-',
        item.presenca_por_justificativa || 'Não',
        formatarDataHora(item.entrada),
        formatarDataHora(item.saida),
        formatarRefeicaoRelatorio(item.cafe, item.cafes, item.cafes_extras),
        formatarRefeicaoRelatorio(item.almoco, item.almocos, item.almocos_extras),
        formatarRefeicaoRelatorio(item.jantar, item.jantares, item.jantares_extras),
        formatarRefeicaoRelatorio(item.lanche, item.lanches, item.lanches_extras),
        item.refeicoes_extras || 0,
        item.banho || '-',
        item.observacoes || '-',
      ]);
    const cardsHtml = cards.map(card => `
      <div class="card">
        <span>${escaparHtml(card.titulo)}</span>
        <strong>${Number(card.valor || 0).toLocaleString('pt-BR')}</strong>
        ${card.detalhe ? `<small>${escaparHtml(card.detalhe)}</small>` : ''}
      </div>
    `).join('');
    const cabecalho = colunas.map(coluna => `<th>${escaparHtml(coluna)}</th>`).join('');
    const corpo = linhas.length
      ? linhas.map(linha => `<tr>${linha.map(valor => `<td>${escaparHtml(valor)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${colunas.length}">Nenhum registro encontrado para este filtro.</td></tr>`;
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escaparHtml(titulo)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; padding: 28px; }
            header { display: flex; align-items: center; justify-content: space-between; gap: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 18px; }
            .logo { width: 220px; max-height: 84px; object-fit: contain; }
            .titulo { text-align: right; }
            .identidade-nome { margin-top: 6px; color: #374151; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
            h1 { margin: 0; font-size: 22px; }
            p { margin: 4px 0; color: #6b7280; font-size: 12px; }
            .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 18px; }
            .card { border: 1px solid #d1d5db; border-radius: 10px; padding: 10px; background: #f9fafb; }
            .card span { display: block; color: #6b7280; font-size: 10px; font-weight: 800; text-transform: uppercase; }
            .card strong { display: block; margin-top: 3px; font-size: 20px; }
            .card small { display: block; margin-top: 2px; color: #6b7280; font-size: 10px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 5px 6px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; text-transform: uppercase; font-size: 9px; }
            tr:nth-child(even) { background: #f9fafb; }
            .rodape-relatorio { margin-top: 18px; border-top: 1px solid #e5e7eb; padding-top: 8px; text-align: center; color: #6b7280; font-size: 10px; line-height: 1.4; }
            .direitos-reservados { margin-top: 5px; font-size: 9px; font-weight: 700; }
            .direitos-reservados a { color: #4f46e5; text-decoration: none; }
            @media print { body { padding: 8px; } .cards { grid-template-columns: repeat(4, 1fr); } }
          </style>
        </head>
        <body>
          <header>
            <div>
              <img class="logo" src="${logoRelatorioSrc}" alt="${escaparHtml(nomeExibicaoRelatorio)}" />
              <div class="identidade-nome">${escaparHtml(nomeExibicaoRelatorio)}</div>
            </div>
            <div class="titulo">
              <h1>${escaparHtml(titulo)}</h1>
              <p>${escaparHtml(subtitulo)}</p>
              <p>${linhas.length} registro(s) filtrado(s). Gerado em ${escaparHtml(new Date().toLocaleString('pt-BR'))}</p>
            </div>
          </header>
          <section class="cards">${cardsHtml}</section>
          <table>
            <thead><tr>${cabecalho}</tr></thead>
            <tbody>${corpo}</tbody>
          </table>
          ${rodapeRelatorioHtml}
        </body>
      </html>
    `;

    abrirPreviewHtml({
      titulo,
      html,
      orientacaoInicial: 'landscape',
    });
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
      await fecharMesSisa({
        ano: Number(ano),
        mes: Number(mes),
        observacoes: observacoesFechamento,
      });

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
      await reabrirMesSisa({
        fechamentoId,
        motivoReabertura: motivo.trim(),
      });

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

  const resumoMensal = mensal.resumo || {};
  const filtroAtendimentoLabel = FILTROS_ATENDIMENTO_SISA.find(
    opcao => opcao.valor === filtroAtendimento
  )?.label || 'Todos os ativos';

  const itensMensaisFiltrados = filtrarItensAtendimentoSisa(mensal.items, filtroAtendimento);
  const itensDiariosFiltrados = filtrarItensAtendimentoSisa(diario.items, filtroAtendimento);

  const {
    fim: fimMensal,
    inicio: inicioMensal,
    itensPaginados: itensMensaisPaginados,
    paginaSegura: paginaMensalSegura,
    totalPaginas: totalPaginasMensal,
  } = paginarItensSisa(itensMensaisFiltrados, paginaMensal, itensPorPaginaSisa);

  const {
    fim: fimDiario,
    inicio: inicioDiario,
    itensPaginados: itensDiariosPaginados,
    paginaSegura: paginaDiariaSegura,
    totalPaginas: totalPaginasDiaria,
  } = paginarItensSisa(itensDiariosFiltrados, paginaDiaria, itensPorPaginaSisa);

  const irParaPaginaMensal = (novaPagina) => {
    setPaginaMensal(Math.min(Math.max(novaPagina, 1), totalPaginasMensal));
  };

  const irParaPaginaDiaria = (novaPagina) => {
    setPaginaDiaria(Math.min(Math.max(novaPagina, 1), totalPaginasDiaria));
  };

  const resumoMensalFiltrado = calcularResumoMensalSisa(itensMensaisFiltrados);
  const resumoDiarioFiltrado = calcularResumoDiarioSisa(itensDiariosFiltrados);

  const periodoEhDia = dataInicio === dataFim;
  const periodoLabel = periodoEhDia
    ? dataInicio.split('-').reverse().join('/')
    : `${dataInicio.split('-').reverse().join('/')} a ${dataFim.split('-').reverse().join('/')}`;
  const dataDiariaFormatada = dataDiaria
    ? dataDiaria.split('-').reverse().join('/')
    : '-';
  const resumoCardsDiarios = montarResumoCardsDiariosSisa(
    resumoDiarioFiltrado,
    dataDiariaFormatada,
    filtroAtendimentoLabel,
  );

  const aplicarPeriodo = (inicio, fim) => {
    setDataInicio(inicio);
    setDataFim(fim);
  };

  const aplicarPeriodoHoje = () => aplicarPeriodo(dataHoje, dataHoje);

  const aplicarPeriodoOntem = () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const dataOntem = dataLocalISO(ontem);
    aplicarPeriodo(dataOntem, dataOntem);
  };

  const aplicarPeriodoEsteMes = () => {
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    aplicarPeriodo(dataLocalISO(inicioMes), dataHoje);
  };

  const aplicarPeriodoMesAnterior = () => {
    const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    aplicarPeriodo(dataLocalISO(inicioMesAnterior), dataLocalISO(fimMesAnterior));
  };

  return (
    <AppShell>

      <style>
        {`
          .sisa-print-row {
            display: none;
          }

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

            .sisa-mobile-list,
            .sisa-diario-mobile-list {
              display: none !important;
            }

            .sisa-table-wrap,
            .sisa-diario-table-wrap {
              display: block !important;
              overflow: visible !important;
            }

            .sisa-screen-row {
              display: none !important;
            }

            .sisa-print-row {
              display: table-row !important;
            }

            .sisa-resumo-diario {
              gap: 6px !important;
              margin-top: 10px !important;
            }

            .sisa-resumo-diario > div {
              padding: 8px 10px !important;
              border: 1px solid #d1d5db !important;
              background: #ffffff !important;
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
              padding: 3px 5px !important;
              color: #111827 !important;
              vertical-align: middle !important;
              line-height: 1.25 !important;
            }

            .sisa-diario-table-wrap th,
            .sisa-diario-table-wrap td {
              font-size: 9px !important;
              padding: 3px 4px !important;
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
            <ReportActionButton
              action="export"
              onClick={exportarMensalXlsx}
            >
              Exportar
            </ReportActionButton>

            <ReportActionButton
              action="print"
              onClick={imprimir}
            >
              Imprimir
            </ReportActionButton>
              </>
            )}
          />
        </div>

        <ScrollArea className="sisa-print-area">
        <div className="print:hidden">
          <DireitosReservadosAviso className="mb-4" />
        </div>

        <div className="hidden print:flex print:items-center print:justify-between print:gap-6 print:border-b print:border-gray-200 print:pb-4 print:mb-5">
          <div>
            {identidadeRelatorio?.relatorio_logo_url ? (
              <AuthenticatedImage
                caminhoOuUrl={identidadeRelatorio.relatorio_logo_url}
                alt={identidadeRelatorio?.relatorio_nome_exibicao || 'Projeto'}
                className="w-56 max-h-20 object-contain"
              />
            ) : (
              <img
                src={logoCarecore}
                alt="CARECORE+"
                className="w-56 max-h-20 object-contain"
              />
            )}
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-700">
              {identidadeRelatorio?.relatorio_nome_exibicao || 'CARECORE+'}
            </p>
          </div>

          <div className="text-right">
            <h1 className="text-xl font-black text-gray-900">
              Relatório Convênio / SISA
            </h1>
            <p className="text-sm text-gray-700">
              Relatório de presenças — {periodoLabel}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Recorte SISA: {filtroAtendimentoLabel}
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
              onClick={() => setAba('relatorio')}
              className={`px-4 py-2 rounded-xl text-sm font-black ${
                aba === 'relatorio'
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Relatório de presenças
            </button>

            <button
              onClick={() => setAba('importacoes')}
              className={`px-4 py-2 rounded-xl text-sm font-black ${
                aba === 'importacoes'
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Importações SISA
            </button>
          </div>

          {aba === 'relatorio' ? (

            <div className="flex flex-wrap gap-4 items-end">

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Data inicial
                </label>

                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Data final
                </label>

                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={carregarRelatorioPeriodo}
                className="px-4 py-2 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brandDark"
              >
                Atualizar período
              </button>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={aplicarPeriodoHoje} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">Hoje</button>
                <button type="button" onClick={aplicarPeriodoOntem} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">Ontem</button>
                <button type="button" onClick={aplicarPeriodoEsteMes} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">Este mês</button>
                <button type="button" onClick={aplicarPeriodoMesAnterior} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50">Mês anterior</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Tipo / presença
                </label>
                <select
                  value={filtroAtendimento}
                  onChange={(e) => setFiltroAtendimento(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  {FILTROS_ATENDIMENTO_SISA.map(opcao => (
                    <option key={opcao.valor} value={opcao.valor}>
                      {opcao.label}
                    </option>
                  ))}
                </select>
              </div>

            </div>

          ) : (
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[260px]">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                  Planilha exportada do SISA
                </label>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  ref={arquivoSisaInputRef}
                  onChange={(e) => atualizarArquivoSisa(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={() => arquivoSisaInputRef.current?.click()}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Escolher arquivo
                  </button>
                  <span className="min-w-0 truncate rounded-lg bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-600">
                    {arquivoSisa?.name || 'Nenhum arquivo selecionado'}
                  </span>
                </div>
              </div>

              <button
                onClick={previsualizarPlanilhaSisa}
                disabled={importandoSisa || !arquivoSisa}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {importandoSisa ? 'Analisando...' : 'Analisar planilha'}
              </button>

              <button
                onClick={carregarImportacoes}
                className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800"
              >
                Atualizar histórico
              </button>
            </div>
          )}

          {aba === 'importacoes' && previaImportacaoSisa && (
            <section className="mt-5 space-y-4 rounded-3xl border border-brand/20 bg-brand/5 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-black text-gray-900">Prévia inteligente da importação SISA</h3>
                  <p className="mt-1 text-sm font-semibold text-gray-600">
                    Recorte {formatarDataPt(previaImportacaoSisa.data_inicio_referencia)} a {formatarDataPt(previaImportacaoSisa.data_referencia)} · {previaImportacaoSisa.total_linhas} linha(s) lida(s) · {previaImportacaoSisa.vinculados} já vinculadas.
                  </p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">
                    Revise as sugestões abaixo. Apenas os itens marcados serão aplicados quando você confirmar a importação.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviaImportacaoSisa(null)}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar prévia
                  </button>
                  <button
                    type="button"
                    onClick={confirmarImportacaoSisa}
                    disabled={importandoSisa}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-black text-white hover:bg-brandDark disabled:opacity-50"
                  >
                    {importandoSisa ? 'Confirmando...' : 'Confirmar importação'}
                  </button>
                </div>
              </div>

              {renderGrupoPreviaSisa({
                titulo: 'Criar como ativos',
                descricao: 'Encontrados no SISA, ainda não existem no CareCore+ e não possuem desligamento.',
                itens: previaImportacaoSisa.criar_ativos,
                grupo: 'criar_ativos',
              })}

              {renderGrupoPreviaSisa({
                titulo: 'Criar como inativados',
                descricao: 'Encontrados no SISA, ainda não existem no CareCore+ e já possuem data de desligamento.',
                itens: previaImportacaoSisa.criar_inativos,
                grupo: 'criar_inativos',
              })}

              {renderGrupoPreviaSisa({
                titulo: 'Reativar existentes',
                descricao: 'Já existem no CareCore+, aparecem no SISA sem desligamento, mas estão inativos no sistema.',
                itens: previaImportacaoSisa.reativar_existentes,
                grupo: 'reativar_existentes',
              })}

              {renderGrupoPreviaSisa({
                titulo: 'Inativar existentes',
                descricao: 'Ativos no CareCore+ com número SISA, mas ausentes na planilha atual. Nada é apagado fisicamente.',
                itens: previaImportacaoSisa.inativar_existentes,
                grupo: 'inativar_existentes',
              })}

              {renderGrupoPreviaSisa({
                titulo: 'Possíveis duplicidades',
                descricao: 'Mesmo nome e nascimento de um cadastro existente. Se houver um alvo único, você pode mesclar o número SISA ao cadastro existente.',
                itens: (previaImportacaoSisa.possiveis_duplicidades || []).filter((item) => item.convivente_id),
                grupo: 'mesclar_duplicidades',
                selecionavel: true,
              })}

              {renderGrupoPreviaSisa({
                titulo: 'Duplicidades para revisão manual',
                descricao: 'Há mais de um cadastro possível. Revise manualmente antes de vincular ou criar qualquer novo cadastro.',
                itens: (previaImportacaoSisa.possiveis_duplicidades || []).filter((item) => !item.convivente_id),
                grupo: 'possiveis_duplicidades',
                selecionavel: false,
              })}
            </section>
          )}

        </div>

        {loading && (
          <div className="mb-4 text-sm text-gray-500 font-bold">
            Carregando dados...
          </div>
        )}

        {aba === 'relatorio' && !periodoEhDia ? (

          <>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">

              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

                <div>
                  <h2 className="text-lg font-black text-gray-800">
                    Relatório de Presenças — {periodoLabel}
                  </h2>

                  <p className="text-sm text-gray-500 mt-1">
                    Resumo consolidado para prestação de contas e digitação manual no SISA.
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

              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-10 gap-2 sm:gap-3 mt-5">

                <ResumoCard titulo="Conviventes" valor={resumoMensalFiltrado.conviventes} />
                <ResumoCard titulo="Presenças" valor={resumoMensalFiltrado.total_atendimentos} />
                <ResumoCard titulo="Justificativas" valor={resumoMensalFiltrado.total_justificativas} />
                <ResumoCard titulo="Entradas" valor={resumoMensalFiltrado.total_entradas} />
                <ResumoCard titulo="Saídas" valor={resumoMensalFiltrado.total_saidas} />
                <ResumoCard titulo="Cafés" valor={resumoMensalFiltrado.total_cafes} />
                <ResumoCard titulo="Almoços" valor={resumoMensalFiltrado.total_almocos} />
                <ResumoCard titulo="Jantares" valor={resumoMensalFiltrado.total_jantares} />
                <ResumoCard titulo="Lanches" valor={resumoMensalFiltrado.total_lanches} />
                <ResumoCard titulo="Extras" valor={resumoMensalFiltrado.total_refeicoes_extras} detalhe="Refeições repetidas" />
                <ResumoCard titulo="Banhos" valor={resumoMensalFiltrado.total_banhos} />

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

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              <div className="sisa-mobile-list space-y-3 p-3 md:hidden">
                {itensMensaisFiltrados.length === 0 ? (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                    Nenhum convivente encontrado para este filtro.
                  </div>
                ) : (
                  itensMensaisPaginados.map(item => (
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

                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Presenças</p>
                          <p className="text-lg font-black text-gray-800">{item.total_atendimentos ?? item.dias_presentes ?? 0}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Justif.</p>
                          <p className="text-lg font-black text-gray-800">{item.dias_justificados || 0}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Entradas</p>
                          <p className="text-lg font-black text-gray-800">{item.entradas}</p>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Saídas</p>
                          <p className="text-lg font-black text-gray-800">{item.saidas}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Aliment.</p>
                          <p className="text-lg font-black text-gray-800">{Number(item.cafes || 0) + Number(item.almocos || 0) + Number(item.jantares || 0) + Number(item.lanches || 0)}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Extras</p>
                          <p className="text-lg font-black text-amber-700">{Number(item.refeicoes_extras || 0)}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Banhos</p>
                          <p className="text-lg font-black text-gray-800">{Number(item.banhos || 0)}</p>
                        </div>
                      </div>

                    </article>
                  ))
                )}
              </div>

              <div className="sisa-table-wrap hidden overflow-x-auto md:block">

                <table className="w-full min-w-[1150px]">

                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <Th>Pront.</Th>
                      <Th>Nº SISA</Th>
                      <Th>Convivente</Th>
                      <Th>Presenças</Th>
                      <Th>Justificativas</Th>
                      <Th>Entradas</Th>
                      <Th>Saídas</Th>
                      <Th>Cafés</Th>
                      <Th>Almoços</Th>
                      <Th>Jantares</Th>
                      <Th>Lanches</Th>
                      <Th>Extras</Th>
                      <Th>Banhos</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {itensMensaisPaginados.map(item => (
                      <tr key={item.convivente_id} className="sisa-screen-row border-b border-gray-100 hover:bg-gray-50">
                        <Td>#{item.prontuario || 'S/N'}</Td>
                        <Td>{item.numero_sisa || '-'}</Td>
                        <Td destaque>{item.nome}</Td>
                        <Td>{item.total_atendimentos ?? item.dias_presentes ?? 0}</Td>
                        <Td>{item.dias_justificados || 0}</Td>
                        <Td>{item.entradas}</Td>
                        <Td>{item.saidas}</Td>
                        <Td>{item.cafes || 0}</Td>
                        <Td>{item.almocos}</Td>
                        <Td>{item.jantares || 0}</Td>
                        <Td>{item.lanches || 0}</Td>
                        <Td>{item.refeicoes_extras || 0}</Td>
                        <Td>{item.banhos || 0}</Td>
                      </tr>
                    ))}
                    {itensMensaisFiltrados.map(item => (
                      <tr key={`print-${item.convivente_id}`} className="sisa-print-row border-b border-gray-100">
                        <Td>#{item.prontuario || 'S/N'}</Td>
                        <Td>{item.numero_sisa || '-'}</Td>
                        <Td destaque>{item.nome}</Td>
                        <Td>{item.total_atendimentos ?? item.dias_presentes ?? 0}</Td>
                        <Td>{item.dias_justificados || 0}</Td>
                        <Td>{item.entradas}</Td>
                        <Td>{item.saidas}</Td>
                        <Td>{item.cafes || 0}</Td>
                        <Td>{item.almocos}</Td>
                        <Td>{item.jantares || 0}</Td>
                        <Td>{item.lanches || 0}</Td>
                        <Td>{item.refeicoes_extras || 0}</Td>
                        <Td>{item.banhos || 0}</Td>
                      </tr>
                    ))}
                  </tbody>

                </table>

              </div>

            </div>

            <PaginacaoSisa
              totalItens={itensMensaisFiltrados.length}
              inicio={inicioMensal}
              fim={fimMensal}
              paginaAtual={paginaMensalSegura}
              totalPaginas={totalPaginasMensal}
              onAnterior={() => irParaPaginaMensal(paginaMensalSegura - 1)}
              onProxima={() => irParaPaginaMensal(paginaMensalSegura + 1)}
              rotuloSingular="convivente"
              rotuloPlural="conviventes"
            />

          </>

        ) : aba === 'relatorio' && periodoEhDia ? (

          <>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-6">

              <h2 className="text-lg font-black text-gray-800">
                Relatório de Presenças — {periodoLabel}
              </h2>

              <div className="sisa-resumo-diario mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
                {resumoCardsDiarios.map(card => (
                  <ResumoCard
                    key={card.titulo}
                    titulo={card.titulo}
                    valor={card.valor}
                    detalhe={card.detalhe}
                  />
                ))}
              </div>

            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

              <div className="sisa-diario-mobile-list space-y-3 p-3 md:hidden">
                {itensDiariosFiltrados.length === 0 ? (
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
                    Nenhum registro diário encontrado para este filtro.
                  </div>
                ) : (
                  itensDiariosPaginados.map(item => (
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
                          item.presenca_por_justificativa === 'Sim'
                            ? 'bg-sky-50 text-sky-700'
                            : item.presenca === 'Sim'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {item.presenca_por_justificativa === 'Sim'
                            ? 'Justificada'
                            : item.presenca === 'Sim' ? 'Presente' : 'Ausente'}
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
                          <p className="text-xs font-bold text-gray-800">
                            {formatarRefeicaoRelatorio(item.almoco, item.almocos, item.almocos_extras)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Extras</p>
                          <p className="text-xs font-bold text-amber-700">{item.refeicoes_extras || 0}</p>
                        </div>
                        <div className="rounded-xl bg-white px-2 py-2">
                          <p className="text-[10px] font-black uppercase text-gray-400">Banho</p>
                          <p className="text-xs font-bold text-gray-800">{item.banho || 'Não'}</p>
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

              <div className="sisa-diario-table-wrap hidden overflow-x-auto md:block">

                <table className="w-full min-w-[1050px]">

                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <Th>Pront.</Th>
                      <Th>Nº SISA</Th>
                      <Th>Convivente</Th>
                      <Th>Presença</Th>
                      <Th>Justificativa</Th>
                      <Th>Entrada</Th>
                      <Th>Saída</Th>
                      <Th>Café</Th>
                      <Th>Almoço</Th>
                      <Th>Jantar</Th>
                      <Th>Lanche</Th>
                      <Th>Extras</Th>
                      <Th>Banho</Th>
                      <Th>Observações</Th>
                    </tr>
                  </thead>

                  <tbody>
                    {itensDiariosPaginados.map(item => (
                      <tr key={item.convivente_id} className="sisa-screen-row border-b border-gray-100 hover:bg-gray-50">
                        <Td>#{item.prontuario || 'S/N'}</Td>
                        <Td>{item.numero_sisa || '-'}</Td>
                        <Td destaque>{item.nome}</Td>
                        <Td>
                          <span className={`text-xs font-black px-2 py-1 rounded-full ${
                            item.presenca_por_justificativa === 'Sim'
                              ? 'bg-sky-50 text-sky-700'
                              : item.presenca === 'Sim'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {item.presenca}
                          </span>
                        </Td>
                        <Td>{item.presenca_por_justificativa || 'Não'}</Td>
                        <Td>{formatarDataHora(item.entrada)}</Td>
                        <Td>{formatarDataHora(item.saida)}</Td>
                        <Td>{formatarRefeicaoRelatorio(item.cafe, item.cafes, item.cafes_extras)}</Td>
                        <Td>{formatarRefeicaoRelatorio(item.almoco, item.almocos, item.almocos_extras)}</Td>
                        <Td>{formatarRefeicaoRelatorio(item.jantar, item.jantares, item.jantares_extras)}</Td>
                        <Td>{formatarRefeicaoRelatorio(item.lanche, item.lanches, item.lanches_extras)}</Td>
                        <Td>{item.refeicoes_extras || 0}</Td>
                        <Td>{item.banho || '-'}</Td>
                        <Td>{item.observacoes || '-'}</Td>
                      </tr>
                    ))}
                    {itensDiariosFiltrados.map(item => (
                      <tr key={`print-${item.convivente_id}`} className="sisa-print-row border-b border-gray-100">
                        <Td>#{item.prontuario || 'S/N'}</Td>
                        <Td>{item.numero_sisa || '-'}</Td>
                        <Td destaque>{item.nome}</Td>
                        <Td>
                          <span className={`text-xs font-black px-2 py-1 rounded-full ${
                            item.presenca_por_justificativa === 'Sim'
                              ? 'bg-sky-50 text-sky-700'
                              : item.presenca === 'Sim'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {item.presenca}
                          </span>
                        </Td>
                        <Td>{item.presenca_por_justificativa || 'Não'}</Td>
                        <Td>{formatarDataHora(item.entrada)}</Td>
                        <Td>{formatarDataHora(item.saida)}</Td>
                        <Td>{formatarRefeicaoRelatorio(item.cafe, item.cafes, item.cafes_extras)}</Td>
                        <Td>{formatarRefeicaoRelatorio(item.almoco, item.almocos, item.almocos_extras)}</Td>
                        <Td>{formatarRefeicaoRelatorio(item.jantar, item.jantares, item.jantares_extras)}</Td>
                        <Td>{formatarRefeicaoRelatorio(item.lanche, item.lanches, item.lanches_extras)}</Td>
                        <Td>{item.refeicoes_extras || 0}</Td>
                        <Td>{item.banho || '-'}</Td>
                        <Td>{item.observacoes || '-'}</Td>
                      </tr>
                    ))}
                  </tbody>

                </table>

              </div>

            </div>

            <PaginacaoSisa
              totalItens={itensDiariosFiltrados.length}
              inicio={inicioDiario}
              fim={fimDiario}
              paginaAtual={paginaDiariaSegura}
              totalPaginas={totalPaginasDiaria}
              onAnterior={() => irParaPaginaDiaria(paginaDiariaSegura - 1)}
              onProxima={() => irParaPaginaDiaria(paginaDiariaSegura + 1)}
              rotuloSingular="registro"
              rotuloPlural="registros"
            />

          </>

        ) : (
          <ImportacoesSisa
            importacoes={importacoes}
            totalImportacoes={totalImportacoes}
            importacoesTemMais={importacoesTemMais}
            onCarregarMaisImportacoes={() => carregarImportacoes({ append: true })}
            importacaoSelecionada={importacaoSelecionada}
            podeExcluirImportacoes={podeExcluirImportacoesSisa}
            excluindoImportacaoId={excluindoImportacaoId}
            onSelecionarImportacao={carregarDetalheImportacao}
            onExcluirImportacao={excluirImportacaoSelecionada}
            filtros={filtrosDivergencia}
            onAlterarFiltros={setFiltrosDivergencia}
            divergencias={divergenciasSisa}
            totalDivergencias={totalDivergenciasSisa}
            divergenciasTemMais={divergenciasSisaTemMais}
            carregandoDivergencias={carregandoDivergenciasSisa}
            resumoDivergencias={resumoDivergenciasSisa}
            onCarregarMaisDivergencias={() => {
              if (!importacaoSelecionada?.id) return;
              carregarDivergenciasImportacao(importacaoSelecionada.id, { append: true });
            }}
            onAtualizarStatus={atualizarStatusDivergencia}
          />
        )}

        <footer className="hidden print:block mt-6 border-t border-gray-200 pt-2 text-center text-[10px] font-semibold text-gray-500">
          {[
            identidadeRelatorio?.relatorio_rodape_linha1,
            identidadeRelatorio?.relatorio_rodape_linha2,
            identidadeRelatorio?.relatorio_telefone ? `Telefone: ${identidadeRelatorio.relatorio_telefone}` : '',
            identidadeRelatorio?.relatorio_email ? `E-mail: ${identidadeRelatorio.relatorio_email}` : '',
            identidadeRelatorio?.relatorio_site ? `Site: ${identidadeRelatorio.relatorio_site}` : '',
          ].filter(Boolean).map((linha) => (
            <div key={linha}>{linha}</div>
          ))}
          <a
            href={obterUrlDireitosReservados()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-[9px] font-black text-indigo-600 no-underline"
          >
            {DIREITOS_RESERVADOS_TITULO}
          </a>
        </footer>

        </ScrollArea>

      </MainShell>
    </AppShell>
  );
}


