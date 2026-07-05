import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ReportActionButton, ScrollArea } from './components/PremiumUI';
import CarteirinhasLote from './components/CarteirinhasLote';
import DireitosReservadosAviso from './components/DireitosReservadosAviso';
import ModalFichaCompleta from './components/conviventes/ModalFichaCompleta';
import ModalOpcaoCabecalhoPia from './components/conviventes/ModalOpcaoCabecalhoPia';
import ModalImpressaoTermoBagageiro from './components/termoBagageiro/ModalImpressaoTermoBagageiro';
import { RelatoriosEvolucaoGraficos } from './components/relatorios/RelatoriosEvolucaoGraficos';
import { RelatoriosFiltrosPanel } from './components/relatorios/RelatoriosFiltrosPanel';
import { RelatoriosPersonalizacao } from './components/relatorios/RelatoriosPersonalizacao';
import { RelatoriosCardsAba, RelatoriosMetricasTopo } from './components/relatorios/RelatoriosResumoAba';
import { RelatoriosTabelaDados } from './components/relatorios/RelatoriosTabelaDados';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { abrirPreviewHtml, imprimirRelatorio } from './utils/imprimirRelatorio';
import { montarHtmlPiasCompletosLote } from './utils/piaCompletoPrint';
import {
  carregarConviventesParaPiaEvolucao,
  montarItensPiaEvolucaoLote,
} from './utils/piaEvolucaoPrint';
import { montarHtmlFichasCompletasLote } from './utils/fichaCompletaConvivente';
import { montarHtmlTermoBagageiro, montarHtmlTermoBagageiroLote } from './utils/termoBagageiroPrint';
import { persistirTermoBagageiroNoGed } from './utils/termoBagageiroGed';
import { formatarDadosConviventeParaTela } from './utils/conviventesProntuarioUtils';
import { gerarGraficosEvolucaoHtml } from './utils/relatoriosGraficosHtml';
import { LIMITE_FICHAS_LOTE_RELATORIOS } from './config/fichaCompletaConfig';
import api from './services/api';
import { obterConviventeProntuario } from './services/conviventesProntuarioService';
import { useRelatoriosFiltros } from './hooks/useRelatoriosFiltros';
import { useRelatoriosIndicadores } from './hooks/useRelatoriosIndicadores';
import { useRelatoriosTabela } from './hooks/useRelatoriosTabela';
import {
  LIMITE_AMOSTRA_OCORRENCIAS_RELATORIOS,
  LIMITE_EXPORT_ROTINA_RELATORIOS,
  carregarDadosRelatorios,
  carregarHistoricoRotinaRelatorio,
} from './services/relatoriosService';
import { useRelatoriosIdentidade } from './hooks/useRelatoriosIdentidade';
import { useConfigOperacional } from './hooks/useConfigOperacional';
import { lerUsuarioTextoOriginal, usuarioPodeVerTextoOriginal } from './utils/textoOriginalUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { normalizarPerfilRbac, usuarioPodeConfigOperacionalProjeto } from './utils/rbacUtils';
import {
  ABAS_RELATORIOS,
  criarFiltrosRelatoriosIniciais,
  descreverFiltrosAtivosRelatorios,
  formatarData,
} from './utils/relatoriosUtils';

function dataLocalISO(data) {
  const pad = (numero) => String(numero).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function periodoInicialPorAbaRelatorios(aba) {
  const hoje = new Date();

  if (aba === 'rotina') {
    const dia = dataLocalISO(hoje);
    return { dataInicio: dia, dataFim: dia };
  }

  if (aba === 'evolucao') {
    const inicio = new Date(hoje);
    inicio.setMonth(inicio.getMonth() - 3);
    return { dataInicio: dataLocalISO(inicio), dataFim: dataLocalISO(hoje) };
  }

  return { dataInicio: '', dataFim: '' };
}

function obterNomeUsuarioLogado() {
  try {
    const bruto = localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario');
    return bruto ? JSON.parse(bruto).nome || '' : '';
  } catch {
    return '';
  }
}

export default function Relatorios() {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  const tokenPayload = token ? decodificarPayloadJwt(token) : null;
  const perfilRelatorios = tokenPayload
    ? normalizarPerfilRbac(tokenPayload.perfil_acesso)
    : '';
  const podeConfigOperacional = usuarioPodeConfigOperacionalProjeto(perfilRelatorios, tokenPayload);
  const { config: configOperacional } = useConfigOperacional();
  const usuarioTextoOriginal = useMemo(() => lerUsuarioTextoOriginal(token), [token]);
  const podeVerTextoOriginal = usuarioPodeVerTextoOriginal(usuarioTextoOriginal);
  const [incluirTextoOriginalOcorrencias, setIncluirTextoOriginalOcorrencias] = useState(false);

  const [aba, setAba] = useState('conviventes');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [conviventes, setConviventes] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [resumoOcorrencias, setResumoOcorrencias] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [registrosPia, setRegistrosPia] = useState([]);
  const [rotinaOperacional, setRotinaOperacional] = useState(null);
  const [historicoRotina, setHistoricoRotina] = useState([]);
  const [resumoRotinaPeriodo, setResumoRotinaPeriodo] = useState(null);
  const [resumoRotinaEvolucao, setResumoRotinaEvolucao] = useState([]);
  const [resumoAvisos, setResumoAvisos] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [filtros, setFiltros] = useState(criarFiltrosRelatoriosIniciais);
  const [filtrosMobileAbertos, setFiltrosMobileAbertos] = useState(false);
  const [paginaTabela, setPaginaTabela] = useState(1);
  const [ordenacaoAcomodacoes, setOrdenacaoAcomodacoes] = useState('quarto');
  const [opcoesImpressaoEvolucaoAbertas, setOpcoesImpressaoEvolucaoAbertas] = useState(false);
  const [fichaLoteModalAberto, setFichaLoteModalAberto] = useState(false);
  const [imprimindoFichasLote, setImprimindoFichasLote] = useState(false);
  const [progressoFichasLote, setProgressoFichasLote] = useState(null);
  const [piaEvolucaoModalAberto, setPiaEvolucaoModalAberto] = useState(false);
  const [imprimindoPiaEvolucao, setImprimindoPiaEvolucao] = useState(false);
  const [progressoPiaEvolucao, setProgressoPiaEvolucao] = useState(null);
  const [termoBagageiroConvivente, setTermoBagageiroConvivente] = useState(null);
  const [imprimindoTermoBagageiroLote, setImprimindoTermoBagageiroLote] = useState(false);
  const [tecnicoPendenciasEvolucaoId, setTecnicoPendenciasEvolucaoId] = useState('');
  const {
    aplicarIdentidadeRelatorio,
    atualizarCampoIdentidade,
    enviarLogoRelatorio,
    errosIdentidade,
    formIdentidade,
    identidadeRelatorio,
    mensagemIdentidade,
    obterLogoRelatorioParaImpressao,
    removerLogoRelatorio,
    salvarIdentidadeRelatorio,
    salvandoIdentidade,
    validarCampoIdentidade,
  } = useRelatoriosIdentidade(token);
  const itensPorPaginaTabela = 20;

  useEffect(() => {
    async function carregarDados() {
      if (!token) return;

      try {
        setLoading(true);
        setErro('');

        const carregarIdentidade = identidadeRelatorio === null;

        const dadosRelatorios = await carregarDadosRelatorios({
          aba,
          filtros,
          carregarIdentidade,
        });

        setConviventes(dadosRelatorios.conviventes);
        setQuartos(dadosRelatorios.quartos);
        if (Array.isArray(dadosRelatorios.ocorrencias)) {
          setOcorrencias(dadosRelatorios.ocorrencias || []);
          setResumoOcorrencias(null);
        } else {
          setOcorrencias(dadosRelatorios.ocorrencias?.items || []);
          setResumoOcorrencias(dadosRelatorios.ocorrencias?.resumo || null);
        }
        setTecnicos(dadosRelatorios.tecnicos);
        setEquipe(dadosRelatorios.equipe);
        setRegistrosPia(dadosRelatorios.registrosPia);
        if (dadosRelatorios.rotina) setRotinaOperacional(dadosRelatorios.rotina);
        if (['rotina', 'auditoria'].includes(aba)) {
          const historico = await carregarHistoricoRotinaRelatorio(filtros, {
            limite: LIMITE_EXPORT_ROTINA_RELATORIOS,
          });
          setHistoricoRotina(historico.registros || []);
          setResumoRotinaPeriodo(historico.resumo_periodo || null);
        } else {
          setHistoricoRotina([]);
          setResumoRotinaPeriodo(null);
        }
        if (dadosRelatorios.resumoRotinaEvolucao) setResumoRotinaEvolucao(dadosRelatorios.resumoRotinaEvolucao);
        if (dadosRelatorios.avisos) setAvisos(Array.isArray(dadosRelatorios.avisos) ? dadosRelatorios.avisos : []);
        if (dadosRelatorios.resumoAvisos) setResumoAvisos(dadosRelatorios.resumoAvisos || null);
        if (dadosRelatorios.identidade) {
          aplicarIdentidadeRelatorio(dadosRelatorios.identidade);
        }
      } catch (error) {
        console.error('Erro ao carregar central de relatórios', error);
        setErro('Não foi possível carregar os dados da central de relatórios.');
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [aba, filtros.busca, filtros.dataFim, filtros.dataInicio, filtros.prioridadeOcorrencia, filtros.somentePendencias, filtros.statusConvivente, filtros.statusOcorrencia, filtros.tecnicoId, identidadeRelatorio, token]);

  const filtrosAtivos = useMemo(() => {
    return descreverFiltrosAtivosRelatorios({ aba, filtros, tecnicos });
  }, [aba, filtros, tecnicos]);

  function atualizarFiltro(nome, valor) {
    setFiltros((atual) => ({
      ...atual,
      [nome]: valor,
    }));
  }

  function selecionarAba(novaAba) {
    const periodo = periodoInicialPorAbaRelatorios(novaAba);
    setFiltros((atual) => ({ ...atual, ...periodo }));
    setAba(novaAba);
  }

  function limparFiltros() {
    setFiltros(criarFiltrosRelatoriosIniciais());
  }

  useEffect(() => {
    setPaginaTabela(1);
  }, [aba, filtros, ordenacaoAcomodacoes]);

  const {
    avisosFiltrados,
    conviventesFiltrados,
    historicoRotinaFiltrado,
    idsConviventesFiltrados,
    leitosAcomodacoesFiltrados,
    ocorrenciasFiltradas,
    registrosPiaFiltrados,
  } = useRelatoriosFiltros({
    avisos,
    conviventes,
    equipe,
    filtros,
    historicoRotina,
    ocorrencias,
    ordenacaoAcomodacoes,
    quartos,
    registrosPia,
    tecnicos,
  });

  const {
    cardsTopo,
    relatoriosAtuais,
  } = useRelatoriosIndicadores({
    aba,
    avisosFiltrados,
    conviventesFiltrados,
    historicoRotinaFiltrado,
    idsConviventesFiltrados,
    leitosAcomodacoesFiltrados,
    ocorrenciasFiltradas,
    registrosPiaFiltrados,
    quartos,
    resumoAvisos,
    resumoOcorrencias,
    rotinaOperacional,
    resumoRotinaPeriodo,
    tecnicoId: filtros.tecnicoId,
    tecnicos,
    equipe,
  });

  const dadosEvolucao = useMemo(() => {
    const chaveDia = (valor) => {
      if (!valor) return null;
      const data = new Date(valor);
      if (Number.isNaN(data.getTime())) return null;
      return dataLocalISO(data);
    };

    const rotuloDia = (chave) => {
      if (!chave) return '-';
      const [, mes, dia] = chave.split('-');
      return `${dia}/${mes}`;
    };

    const chaves = new Set();
    const usarResumoAgregadoRotina = Array.isArray(resumoRotinaEvolucao) && resumoRotinaEvolucao.length > 0;
    if (usarResumoAgregadoRotina) {
      resumoRotinaEvolucao.forEach((registro) => {
        const chave = chaveDia(registro.data);
        if (chave) chaves.add(chave);
      });
    } else {
      historicoRotinaFiltrado.forEach((registro) => {
        const chave = chaveDia(registro.data_registro);
        if (chave) chaves.add(chave);
      });
    }
    ocorrenciasFiltradas.forEach((ocorrencia) => {
      const chave = chaveDia(ocorrencia.data_ocorrencia);
      if (chave) chaves.add(chave);
      if (ocorrencia.status_resolucao === 'Resolvido') {
        const chaveResolucao = chaveDia(ocorrencia.data_resolucao || ocorrencia.atualizado_em || ocorrencia.data_ocorrencia);
        if (chaveResolucao) chaves.add(chaveResolucao);
      }
    });
    conviventesFiltrados.forEach((convivente) => {
      const chave = chaveDia(convivente.data_entrada);
      if (chave) chaves.add(chave);
    });

    const chavesOrdenadas = Array.from(chaves).sort();
    const chavesLimitadas = chavesOrdenadas.slice(-31);

    const basePorDia = Object.fromEntries(
      chavesLimitadas.map((chave) => [
        chave,
        {
          chave,
          rotulo: rotuloDia(chave),
          atendimentos: 0,
          entradas: 0,
          entradasRegistradas: 0,
          ajusteEntradas: 0,
          saidas: 0,
          saidasRegistradas: 0,
          ajusteSaidas: 0,
          almocos: 0,
          almocosRegistrados: 0,
          ajusteAlmocos: 0,
          temAjusteManual: false,
          ocorrencias: 0,
          resolvidas: 0,
          pendenciasAbertas: 0,
          pendenciasResolvidas: 0,
          saldoPendencias: 0,
          novos: 0,
        },
      ]),
    );

    if (usarResumoAgregadoRotina) {
      resumoRotinaEvolucao.forEach((registro) => {
        const chave = chaveDia(registro.data);
        const item = basePorDia[chave];
        if (!item) return;
        item.atendimentos += Number(registro.atendimentos_total ?? (registro.atendimentos || 0));
        item.entradas += Number(registro.entradas_total ?? (registro.entradas || 0));
        item.entradasRegistradas += Number(registro.entradas || 0);
        item.ajusteEntradas += Number(registro.ajuste_entradas || 0);
        item.saidas += Number(registro.saidas_total ?? (registro.saidas || 0));
        item.saidasRegistradas += Number(registro.saidas || 0);
        item.ajusteSaidas += Number(registro.ajuste_saidas || 0);
        item.almocos += Number(registro.almocos_total ?? (registro.almocos || 0));
        item.almocosRegistrados += Number(registro.almocos || 0);
        item.ajusteAlmocos += Number(registro.ajuste_refeicoes || 0);
        item.temAjusteManual = item.temAjusteManual || Boolean(registro.tem_ajuste_manual);
      });
    } else {
      historicoRotinaFiltrado.forEach((registro) => {
        const chave = chaveDia(registro.data_registro);
        const item = basePorDia[chave];
        if (!item) return;
        item.atendimentos += 1;
        if (registro.tipo_registro === 'Entrada') item.entradas += 1;
        if (registro.tipo_registro === 'Saída') item.saidas += 1;
        if (registro.tipo_registro === 'Almoço') item.almocos += 1;
      });
    }

    ocorrenciasFiltradas.forEach((ocorrencia) => {
      const chave = chaveDia(ocorrencia.data_ocorrencia);
      const item = basePorDia[chave];
      if (item) {
        item.ocorrencias += 1;
        item.pendenciasAbertas += 1;
      }

      if (ocorrencia.status_resolucao === 'Resolvido') {
        const chaveResolucao = chaveDia(ocorrencia.data_resolucao || ocorrencia.atualizado_em || ocorrencia.data_ocorrencia);
        const itemResolucao = basePorDia[chaveResolucao];
        if (itemResolucao) {
          itemResolucao.resolvidas += 1;
          itemResolucao.pendenciasResolvidas += 1;
        }
      }
    });

    conviventesFiltrados.forEach((convivente) => {
      const chave = chaveDia(convivente.data_entrada);
      const item = basePorDia[chave];
      if (!item) return;
      item.novos += 1;
    });

    const serie = Object.values(basePorDia);
    let saldoPendencias = 0;
    serie.forEach((item) => {
      saldoPendencias = Math.max(
        0,
        saldoPendencias + item.pendenciasAbertas - item.pendenciasResolvidas,
      );
      item.saldoPendencias = saldoPendencias;
    });
    const totalAtendimentos = serie.reduce((total, item) => total + item.atendimentos, 0);
    const mediaDiaria = serie.length ? Math.round(totalAtendimentos / serie.length) : 0;
    const pico = serie.reduce((maior, item) => Math.max(maior, item.atendimentos), 0);
    const primeiraMetade = serie.slice(0, Math.floor(serie.length / 2));
    const segundaMetade = serie.slice(Math.floor(serie.length / 2));
    const totalPrimeira = primeiraMetade.reduce((total, item) => total + item.atendimentos, 0);
    const totalSegunda = segundaMetade.reduce((total, item) => total + item.atendimentos, 0);
    const tendencia = totalSegunda > totalPrimeira ? 'Alta' : totalSegunda < totalPrimeira ? 'Queda' : 'Estável';
    const diasComAjusteManual = serie.filter((item) => item.temAjusteManual);

    return {
      serie,
      totalAtendimentos,
      mediaDiaria,
      pico,
      tendencia,
      diasComAjusteManual,
    };
  }, [conviventesFiltrados, historicoRotinaFiltrado, ocorrenciasFiltradas, resumoRotinaEvolucao]);

  const tecnicoPendenciasSelecionadoId = filtros.tecnicoId || tecnicoPendenciasEvolucaoId;

  const tecnicoPendenciasSelecionadoNome = useMemo(() => {
    if (!tecnicoPendenciasSelecionadoId) return 'todos os técnicos';
    return tecnicos.find((tecnico) => tecnico.id === tecnicoPendenciasSelecionadoId)?.nome || 'técnico selecionado';
  }, [tecnicoPendenciasSelecionadoId, tecnicos]);

  const tecnicosComPendenciasEvolucao = useMemo(() => {
    const idsComOcorrencias = new Set(
      ocorrenciasFiltradas
        .map((ocorrencia) => ocorrencia.tecnico_responsavel_id)
        .filter(Boolean),
    );

    return tecnicos.filter((tecnico) => idsComOcorrencias.has(tecnico.id));
  }, [ocorrenciasFiltradas, tecnicos]);

  const dadosPendenciasTecnicasEvolucao = useMemo(() => {
    const chaveDia = (valor) => {
      if (!valor) return null;
      const data = new Date(valor);
      if (Number.isNaN(data.getTime())) return null;
      return dataLocalISO(data);
    };

    const rotuloDia = (chave) => {
      if (!chave) return '-';
      const [, mes, dia] = chave.split('-');
      return `${dia}/${mes}`;
    };

    const ocorrenciasDoTecnico = tecnicoPendenciasSelecionadoId
      ? ocorrenciasFiltradas.filter((ocorrencia) => ocorrencia.tecnico_responsavel_id === tecnicoPendenciasSelecionadoId)
      : ocorrenciasFiltradas;

    const chaves = new Set();
    ocorrenciasDoTecnico.forEach((ocorrencia) => {
      const chaveAbertura = chaveDia(ocorrencia.data_ocorrencia);
      if (chaveAbertura) chaves.add(chaveAbertura);
      if (ocorrencia.status_resolucao === 'Resolvido') {
        const chaveResolucao = chaveDia(ocorrencia.data_resolucao || ocorrencia.atualizado_em || ocorrencia.data_ocorrencia);
        if (chaveResolucao) chaves.add(chaveResolucao);
      }
    });

    const chavesLimitadas = Array.from(chaves).sort().slice(-31);
    const basePorDia = Object.fromEntries(
      chavesLimitadas.map((chave) => [
        chave,
        {
          chave,
          rotulo: rotuloDia(chave),
          pendenciasAbertas: 0,
          pendenciasResolvidas: 0,
          saldoPendencias: 0,
        },
      ]),
    );

    ocorrenciasDoTecnico.forEach((ocorrencia) => {
      const chaveAbertura = chaveDia(ocorrencia.data_ocorrencia);
      if (basePorDia[chaveAbertura]) {
        basePorDia[chaveAbertura].pendenciasAbertas += 1;
      }

      if (ocorrencia.status_resolucao === 'Resolvido') {
        const chaveResolucao = chaveDia(ocorrencia.data_resolucao || ocorrencia.atualizado_em || ocorrencia.data_ocorrencia);
        if (basePorDia[chaveResolucao]) {
          basePorDia[chaveResolucao].pendenciasResolvidas += 1;
        }
      }
    });

    const serie = Object.values(basePorDia);
    let saldoPendencias = 0;
    serie.forEach((item) => {
      saldoPendencias = Math.max(
        0,
        saldoPendencias + item.pendenciasAbertas - item.pendenciasResolvidas,
      );
      item.saldoPendencias = saldoPendencias;
    });

    return serie;
  }, [ocorrenciasFiltradas, tecnicoPendenciasSelecionadoId]);

  const resumoPendenciasTecnicasEvolucao = useMemo(() => {
    const abertas = dadosPendenciasTecnicasEvolucao.reduce(
      (total, item) => total + Number(item.pendenciasAbertas || 0),
      0,
    );
    const resolvidas = dadosPendenciasTecnicasEvolucao.reduce(
      (total, item) => total + Number(item.pendenciasResolvidas || 0),
      0,
    );
    const saldo = dadosPendenciasTecnicasEvolucao.at(-1)?.saldoPendencias || 0;

    return { abertas, resolvidas, saldo };
  }, [dadosPendenciasTecnicasEvolucao]);

  const totalNovosAcolhimentosEvolucao = useMemo(
    () => dadosEvolucao.serie.reduce((total, item) => total + Number(item.novos || 0), 0),
    [dadosEvolucao.serie],
  );

  const cardsTopoEvolucao = useMemo(() => [
    {
      label: 'Atendimentos',
      valor: dadosEvolucao.totalAtendimentos,
      detalhe: 'Registros da rotina no período filtrado',
    },
    {
      label: 'Média diária',
      valor: dadosEvolucao.mediaDiaria,
      detalhe: `${dadosEvolucao.pico} no dia de maior movimento`,
    },
    {
      label: 'Pendências técnicas',
      valor: resumoPendenciasTecnicasEvolucao.saldo,
      detalhe: `${resumoPendenciasTecnicasEvolucao.abertas} abertas, ${resumoPendenciasTecnicasEvolucao.resolvidas} resolvidas`,
    },
    {
      label: 'Novos acolhimentos',
      valor: totalNovosAcolhimentosEvolucao,
      detalhe: 'Entradas cadastrais no período filtrado',
    },
  ], [dadosEvolucao.mediaDiaria, dadosEvolucao.pico, dadosEvolucao.totalAtendimentos, resumoPendenciasTecnicasEvolucao, totalNovosAcolhimentosEvolucao]);

  const cardsTopoVisiveis = aba === 'evolucao' ? cardsTopoEvolucao : cardsTopo;
  const relatoriosAtuaisVisiveis = useMemo(() => {
    if (aba !== 'evolucao') return relatoriosAtuais;

    return relatoriosAtuais.map((relatorio) => ({
      ...relatorio,
      metricas: cardsTopoEvolucao.map((card) => ({
        label: card.label,
        valor: card.valor,
      })),
    }));
  }, [aba, cardsTopoEvolucao, relatoriosAtuais]);

  const {
    colunasExportacao,
    dadosDetalhados,
    fimTabela,
    inicioTabela,
    irParaPaginaTabela,
    linhasExportacao,
    linhasTabelaPaginadas,
    paginaTabelaSegura,
    totalPaginasTabela,
  } = useRelatoriosTabela({
    aba,
    conviventes,
    conviventesFiltrados,
    dadosEvolucao,
    equipe,
    filtros,
    historicoRotinaFiltrado,
    itensPorPaginaTabela,
    leitosAcomodacoesFiltrados,
    ocorrenciasFiltradas,
    incluirTextoOriginalOcorrencias,
    paginaTabela,
    quartos,
    registrosPiaFiltrados,
    relatoriosAtuais,
    resumoPendenciasTecnicasEvolucao,
    setPaginaTabela,
    tecnicoPendenciasSelecionadoNome,
    tecnicos,
    totalNovosAcolhimentosEvolucao,
  });

  function exportarAbaAtual() {
    const filtrosExportacao = {
      Aba: ABAS_RELATORIOS.find((a) => a.id === aba)?.label || aba,
      'Relatórios listados': relatoriosAtuais.length,
      Período: filtros.dataInicio || filtros.dataFim
        ? `${filtros.dataInicio ? formatarData(filtros.dataInicio) : 'início'} a ${filtros.dataFim ? formatarData(filtros.dataFim) : 'hoje'}`
        : 'Todos',
      Técnico: tecnicos.find((t) => t.id === filtros.tecnicoId)?.nome || 'Todos',
      'Status convivente': filtros.statusConvivente,
      Busca: filtros.busca || '-',
    };

    if (aba === 'ocorrencias') {
      filtrosExportacao['Status ocorrência'] = filtros.statusOcorrencia;
      filtrosExportacao.Prioridade = filtros.prioridadeOcorrencia;
      filtrosExportacao['Somente ocorrências pendentes'] = filtros.somentePendencias ? 'Sim' : 'Não';
    }

    if (['rotina', 'auditoria'].includes(aba)) {
      filtrosExportacao['Somente registros com ajuste'] = filtros.somentePendencias ? 'Sim' : 'Não';
    }

    if (aba === 'pia') {
      filtrosExportacao['Tipo PIA'] = filtros.tipoPia;
      filtrosExportacao['Status PIA'] = filtros.statusPia;
      filtrosExportacao['Tema PIA'] = filtros.temaPia || '-';
    }

    if (aba === 'acomodacoes') {
      filtrosExportacao['Status leito'] = filtros.acomodacaoStatusLeito;
      filtrosExportacao['Modalidade acomodação'] = filtros.acomodacaoModalidade;
      filtrosExportacao['Público acomodação'] = filtros.acomodacaoPublico;
      filtrosExportacao['Somente leitos livres'] = filtros.somentePendencias ? 'Sim' : 'Não';
    }

    exportarRelatorioXlsx({
      nomeArquivo: `central-relatorios-${aba}-${new Date().toISOString().slice(0, 10)}`,
      titulo: `Central de Relatórios - ${ABAS_RELATORIOS.find((a) => a.id === aba)?.label || aba}`,
      filtros: filtrosExportacao,
      colunas: colunasExportacao,
      dados: linhasExportacao,
    });
  }

  function solicitarImpressaoPiaEvolucaoFiltrada() {
    const conviventeIdsSelecionados = Array.from(
      new Set(registrosPiaFiltrados.map((registro) => registro.convivente_id).filter(Boolean)),
    );

    if (conviventeIdsSelecionados.length === 0) {
      setErro('Nenhum convivente com PIA foi encontrado nos filtros atuais.');
      return;
    }

    setPiaEvolucaoModalAberto(true);
  }

  async function imprimirPiaEvolucaoFiltrada(modoCabecalho) {
    const conviventeIdsSelecionados = Array.from(
      new Set(registrosPiaFiltrados.map((registro) => registro.convivente_id).filter(Boolean)),
    );

    if (conviventeIdsSelecionados.length === 0) {
      setErro('Nenhum convivente com PIA foi encontrado nos filtros atuais.');
      return;
    }

    if (conviventeIdsSelecionados.length > 25) {
      const confirmado = window.confirm(
        `Você está prestes a imprimir a evolução do PIA de ${conviventeIdsSelecionados.length} conviventes. Deseja continuar?`,
      );

      if (!confirmado) return;
    }

    setImprimindoPiaEvolucao(true);
    setProgressoPiaEvolucao({ atual: 0, total: conviventeIdsSelecionados.length });

    try {
      const [origensRes, logoRelatorioDataUrl] = await Promise.all([
        api.get('/api/origens-encaminhamento').catch(() => ({ data: [] })),
        obterLogoRelatorioParaImpressao(),
      ]);
      const origensEncaminhamento = origensRes.data || [];

      const conviventesPorId = await carregarConviventesParaPiaEvolucao({
        conviventeIds: conviventeIdsSelecionados,
        conviventesResumo: conviventes,
        modoCabecalho,
        onProgress: setProgressoPiaEvolucao,
      });

      const itens = montarItensPiaEvolucaoLote({
        conviventeIds: conviventeIdsSelecionados,
        registrosPia,
        registrosPiaFiltrados,
        conviventesPorId,
        conviventesResumo: conviventes,
      });

      const html = montarHtmlPiasCompletosLote({
        itens,
        listaTecnicos: tecnicos,
        origensEncaminhamento,
        identidadeRelatorio,
        logoRelatorioDataUrl,
        descricaoFiltros: filtrosAtivos.join(' | ') || 'Todos os filtros',
        modoCabecalho,
      });

      abrirPreviewHtml({
        titulo: `Evolução do PIA filtrada (${itens.length})`,
        html,
        orientacaoInicial: 'portrait',
      });
      setPiaEvolucaoModalAberto(false);
    } catch (error) {
      console.error('Erro ao imprimir evolução do PIA filtrada', error);
      setErro('Não foi possível gerar a impressão da evolução do PIA.');
    } finally {
      setImprimindoPiaEvolucao(false);
      setProgressoPiaEvolucao(null);
    }
  }

  function solicitarImpressaoFichasCompletasLote() {
    if (conviventesFiltrados.length === 0) {
      setErro('Nenhum convivente encontrado com os filtros atuais.');
      return;
    }
    setFichaLoteModalAberto(true);
  }

  function solicitarImpressaoTermoBagageiroFiltrado() {
    if (conviventesFiltrados.length === 0) {
      setErro('Nenhum convivente encontrado com os filtros atuais.');
      return;
    }
    if (conviventesFiltrados.length === 1) {
      setTermoBagageiroConvivente(conviventesFiltrados[0]);
      return;
    }
    imprimirTermoBagageiroLote(conviventesFiltrados);
  }

  async function executarImpressaoTermoBagageiroRelatorio({ assinaturaDigital }) {
    const convivente = termoBagageiroConvivente;
    if (!convivente) return;

    const logoRelatorioDataUrl = await obterLogoRelatorioParaImpressao();
    const html = montarHtmlTermoBagageiro({
      convivente,
      identidadeRelatorio,
      logoRelatorioDataUrl,
      assinaturaDigital,
      nomeFuncionario: obterNomeUsuarioLogado(),
      configOperacional,
    });

    abrirPreviewHtml({
      titulo: `Termo do bagageiro — ${convivente.nome_social || convivente.nome_completo || 'Convivente'}`,
      html,
      orientacaoInicial: 'portrait',
    });

    const resultadoGed = await persistirTermoBagageiroNoGed(convivente, html);
    if (resultadoGed?.ok) {
      setErro('');
    } else if (resultadoGed?.mensagem) {
      setErro(`Termo impresso, mas não foi salvo no GED: ${resultadoGed.mensagem}`);
    }

    setTermoBagageiroConvivente(null);
  }

  async function imprimirTermoBagageiroLote(lista) {
    const conviventesOrdenados = [...lista].sort((a, b) => (
      String(a.nome_social || a.nome_completo || '').localeCompare(
        String(b.nome_social || b.nome_completo || ''),
        'pt-BR',
      )
    ));

    setImprimindoTermoBagageiroLote(true);
    try {
      const logoRelatorioDataUrl = await obterLogoRelatorioParaImpressao();
      const html = montarHtmlTermoBagageiroLote({
        conviventes: conviventesOrdenados,
        identidadeRelatorio,
        logoRelatorioDataUrl,
        nomeFuncionario: obterNomeUsuarioLogado(),
        configOperacional,
      });

      abrirPreviewHtml({
        titulo: `Termo do bagageiro (${conviventesOrdenados.length})`,
        html,
        orientacaoInicial: 'portrait',
      });
    } finally {
      setImprimindoTermoBagageiroLote(false);
    }
  }

  async function imprimirFichasCompletasFiltradas(secoesSelecionadas) {
    const conviventesOrdenados = [...conviventesFiltrados].sort((a, b) => (
      String(a.nome_social || a.nome_completo || '').localeCompare(
        String(b.nome_social || b.nome_completo || ''),
        'pt-BR',
      )
    ));

    if (conviventesOrdenados.length > LIMITE_FICHAS_LOTE_RELATORIOS) {
      setErro(`Refine o filtro para no máximo ${LIMITE_FICHAS_LOTE_RELATORIOS} conviventes por impressão.`);
      return;
    }

    setImprimindoFichasLote(true);
    setProgressoFichasLote({ atual: 0, total: conviventesOrdenados.length });

    try {
      const [origensRes, logoRelatorioDataUrl] = await Promise.all([
        api.get('/api/origens-encaminhamento').catch(() => ({ data: [] })),
        obterLogoRelatorioParaImpressao(),
      ]);
      const origensEncaminhamento = origensRes.data || [];

      const prontuarios = [];
      const tamanhoLote = 5;

      for (let indice = 0; indice < conviventesOrdenados.length; indice += tamanhoLote) {
        const pedaco = conviventesOrdenados.slice(indice, indice + tamanhoLote);
        const resultados = await Promise.all(
          pedaco.map(async (resumo) => {
            try {
              const completo = await obterConviventeProntuario(resumo.id);
              return formatarDadosConviventeParaTela(completo);
            } catch (erroCarregamento) {
              console.error(`Erro ao carregar prontuário #${resumo.id}`, erroCarregamento);
              return formatarDadosConviventeParaTela(resumo);
            }
          }),
        );
        prontuarios.push(...resultados);
        setProgressoFichasLote({ atual: prontuarios.length, total: conviventesOrdenados.length });
      }

      const html = montarHtmlFichasCompletasLote({
        conviventes: prontuarios,
        secoesSelecionadas,
        listaTecnicos: tecnicos,
        quartos,
        origensEncaminhamento,
        identidadeRelatorio,
        logoRelatorioDataUrl,
        descricaoFiltros: filtrosAtivos.join(' | ') || 'Todos os filtros',
      });

      abrirPreviewHtml({
        titulo: `Fichas completas filtradas (${prontuarios.length})`,
        html,
        orientacaoInicial: 'portrait',
      });
      setFichaLoteModalAberto(false);
    } catch (erroImpressao) {
      console.error('Erro ao gerar fichas completas em lote', erroImpressao);
      setErro('Não foi possível gerar as fichas completas. Tente novamente com um filtro menor.');
    } finally {
      setImprimindoFichasLote(false);
      setProgressoFichasLote(null);
    }
  }

  async function imprimirAbaAtual({ incluirGraficos = null } = {}) {
    if (aba === 'evolucao' && incluirGraficos === null) {
      setOpcoesImpressaoEvolucaoAbertas(true);
      return;
    }

    setOpcoesImpressaoEvolucaoAbertas(false);
    const metricasImpressao = aba === 'evolucao'
      ? cardsTopoEvolucao.map((card) => ({
        label: card.label,
        valor: card.valor,
        detalhe: card.detalhe,
      }))
      : cardsTopo.map((card) => ({
        label: card.label,
        valor: card.valor,
        detalhe: card.detalhe,
      }));

    const logoRelatorioDataUrl = await obterLogoRelatorioParaImpressao();

    imprimirRelatorio({
      titulo: `${dadosDetalhados.titulo} - ${ABAS_RELATORIOS.find((a) => a.id === aba)?.label || aba}`,
      subtitulo: `${linhasExportacao.length} registros filtrados para impressão. Filtros: ${filtrosAtivos.join(' | ') || 'Todos'}.`,
      metricas: metricasImpressao,
      conteudoExtraHtml: aba === 'evolucao' && incluirGraficos === true
        ? gerarGraficosEvolucaoHtml({
          dadosEvolucao,
          dadosPendenciasTecnicasEvolucao,
          tecnicoPendenciasSelecionadoNome,
        })
        : '',
      colunas: colunasExportacao,
      dados: linhasExportacao,
      orientacao: ['conviventes', 'documentacao', 'pia', 'auditoria', 'rotina'].includes(aba)
        ? 'landscape'
        : null,
      identidade: {
        ...identidadeRelatorio,
        logo_src: logoRelatorioDataUrl,
      },
    });
  }

  async function imprimirModeloIdentidadeRelatorio() {
    const logoRelatorioDataUrl = await obterLogoRelatorioParaImpressao();
    imprimirRelatorio({
      titulo: 'Modelo de Relatório Personalizado',
      subtitulo: 'Pré-visualização da identidade visual configurada para este projeto.',
      metricas: [
        { label: 'Exemplo', valor: '123', detalhe: 'Indicador demonstrativo' },
        { label: 'Período', valor: 'Mês atual', detalhe: 'Texto de apoio' },
      ],
      colunas: ['Campo', 'Valor'],
      dados: [
        { Campo: 'Nome exibido', Valor: formIdentidade.relatorio_nome_exibicao || '-' },
        { Campo: 'Rodapé linha 1', Valor: formIdentidade.relatorio_rodape_linha1 || '-' },
        { Campo: 'Rodapé linha 2', Valor: formIdentidade.relatorio_rodape_linha2 || '-' },
      ],
      identidade: {
        ...identidadeRelatorio,
        ...formIdentidade,
        logo_src: logoRelatorioDataUrl,
      },
    });
  }

  return (
    <AppShell>
      <Sidebar />

      <MainShell>
        <PageHeader
          eyebrow="Gestão e auditoria"
          title="Central de Relatórios"
          subtitle="Relatórios operacionais, gerenciais e de prestação de contas do CARECORE+."
          icon="▥"
          actions={['carteirinhas', 'personalizacao'].includes(aba) ? null : (
            <>
              {aba === 'ocorrencias' && podeVerTextoOriginal && (
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={incluirTextoOriginalOcorrencias}
                    onChange={(event) => setIncluirTextoOriginalOcorrencias(event.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Incluir texto original
                </label>
              )}
              <ReportActionButton
                action="export"
                onClick={exportarAbaAtual}
                disabled={loading || linhasExportacao.length === 0}
              >
                Exportar
              </ReportActionButton>

              <ReportActionButton
                action="print"
                onClick={imprimirAbaAtual}
                disabled={loading || linhasExportacao.length === 0}
              >
                Imprimir
              </ReportActionButton>

              {aba === 'pia' && (
                <ReportActionButton
                  action="print"
                  onClick={solicitarImpressaoPiaEvolucaoFiltrada}
                  disabled={loading || registrosPiaFiltrados.length === 0}
                >
                  Imprimir evolução do PIA
                </ReportActionButton>
              )}

              {['conviventes', 'documentacao'].includes(aba) && (
                <ReportActionButton
                  action="print"
                  onClick={solicitarImpressaoFichasCompletasLote}
                  disabled={loading || imprimindoFichasLote || conviventesFiltrados.length === 0}
                >
                  Imprimir fichas completas
                </ReportActionButton>
              )}

              {aba === 'documentacao' && (
                <ReportActionButton
                  action="print"
                  onClick={solicitarImpressaoTermoBagageiroFiltrado}
                  disabled={loading || imprimindoTermoBagageiroLote || conviventesFiltrados.length === 0}
                >
                  Termo do bagageiro
                </ReportActionButton>
              )}
            </>
          )}
        />

        <ScrollArea className="pb-24">
          <div className="w-full max-w-7xl mx-auto">
          <DireitosReservadosAviso className="mb-4" />

          {erro && (
            <div className="mb-6 bg-red-50 text-red-700 border border-red-100 rounded-2xl p-4 text-sm font-bold">
              {erro}
            </div>
          )}

          <RelatoriosFiltrosPanel
            aba={aba}
            atualizarFiltro={atualizarFiltro}
            filtros={filtros}
            filtrosAtivos={filtrosAtivos}
            filtrosMobileAbertos={filtrosMobileAbertos}
            limparFiltros={limparFiltros}
            ordenacaoAcomodacoes={ordenacaoAcomodacoes}
            setFiltrosMobileAbertos={setFiltrosMobileAbertos}
            setOrdenacaoAcomodacoes={setOrdenacaoAcomodacoes}
            tecnicos={tecnicos}
          />

          <RelatoriosMetricasTopo aba={aba} cardsTopoVisiveis={cardsTopoVisiveis} />

          <section className="bg-white border border-gray-100 rounded-3xl shadow-sm p-4 mb-6">
            <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
              {ABAS_RELATORIOS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => selecionarAba(item.id)}
                  className={`min-w-fit px-4 py-2 rounded-xl text-xs font-black border transition-colors ${
                    aba === item.id
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              {podeConfigOperacional && (
                <Link
                  to="/relatorios/config-operacional"
                  className="min-w-fit px-4 py-2 rounded-xl text-xs font-black border transition-colors bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                >
                  Config. operacional
                </Link>
              )}
            </div>
          </section>

          {loading ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-brand font-black animate-pulse">
              Carregando central de relatórios...
            </div>
          ) : aba === 'personalizacao' ? (
            <>
              {podeConfigOperacional && (
                <div className="mb-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-black text-gray-900">Configuração operacional</h2>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        Refeições, portaria, módulos e textos de documentos do projeto.
                      </p>
                    </div>
                    <Link
                      to="/relatorios/config-operacional"
                      className="inline-flex items-center rounded-xl bg-brand px-4 py-2 text-xs font-black text-white hover:bg-brand-dark"
                    >
                      Abrir configuração operacional
                    </Link>
                  </div>
                </div>
              )}
              <RelatoriosPersonalizacao
              atualizarCampoIdentidade={atualizarCampoIdentidade}
              enviarLogoRelatorio={enviarLogoRelatorio}
              errosIdentidade={errosIdentidade}
              formIdentidade={formIdentidade}
              identidadeRelatorio={identidadeRelatorio}
              imprimirModeloIdentidadeRelatorio={imprimirModeloIdentidadeRelatorio}
              mensagemIdentidade={mensagemIdentidade}
              removerLogoRelatorio={removerLogoRelatorio}
              salvarIdentidadeRelatorio={salvarIdentidadeRelatorio}
              salvandoIdentidade={salvandoIdentidade}
              validarCampoIdentidade={validarCampoIdentidade}
            />
            </>
          ) : aba === 'carteirinhas' ? (
            <CarteirinhasLote
              conviventes={conviventesFiltrados}
              quartos={quartos}
              tecnicos={tecnicos}
              identidadeRelatorio={identidadeRelatorio}
              token={token}
            />
          ) : (
            <>
              <RelatoriosCardsAba relatoriosAtuaisVisiveis={relatoriosAtuaisVisiveis} />

              {aba === 'evolucao' && dadosEvolucao.diasComAjusteManual?.length > 0 && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-bold">Totais com ajuste manual de rotina</p>
                  <p className="mt-1">
                    {dadosEvolucao.diasComAjusteManual.length} dia(s) no período incluem complementos lançados pelo Gestor
                    (falha de registro em tempo real). Os gráficos exibem registrados + ajuste; presença por convivente e SISA individual não são alterados.
                  </p>
                </div>
              )}

              {aba === 'evolucao' && (
                <RelatoriosEvolucaoGraficos
                  dadosEvolucao={dadosEvolucao}
                  dadosPendenciasTecnicasEvolucao={dadosPendenciasTecnicasEvolucao}
                  filtros={filtros}
                  setTecnicoPendenciasEvolucaoId={setTecnicoPendenciasEvolucaoId}
                  tecnicoPendenciasSelecionadoId={tecnicoPendenciasSelecionadoId}
                  tecnicoPendenciasSelecionadoNome={tecnicoPendenciasSelecionadoNome}
                  tecnicosComPendenciasEvolucao={tecnicosComPendenciasEvolucao}
                />
              )}

              <RelatoriosTabelaDados
                aba={aba}
                colunasExportacao={colunasExportacao}
                dadosDetalhados={dadosDetalhados}
                fimTabela={fimTabela}
                inicioTabela={inicioTabela}
                irParaPaginaTabela={irParaPaginaTabela}
                limiteAmostraOcorrencias={LIMITE_AMOSTRA_OCORRENCIAS_RELATORIOS}
                linhasExportacao={linhasExportacao}
                linhasTabelaPaginadas={linhasTabelaPaginadas}
                paginaTabelaSegura={paginaTabelaSegura}
                totalPaginasTabela={totalPaginasTabela}
              />
            </>
          )}
          </div>
        </ScrollArea>
      </MainShell>

      {opcoesImpressaoEvolucaoAbertas && (
        <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="carecore-modal-panel w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
              Impressão da evolução
            </p>
            <h2 className="mt-2 text-xl font-black text-slate-900">
              Incluir gráficos no relatório?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Você pode gerar o PDF com os gráficos visuais da aba Evolução ou manter apenas os indicadores e a tabela.
            </p>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => imprimirAbaAtual({ incluirGraficos: true })}
                className="rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brandDark"
              >
                Imprimir com gráficos
              </button>
              <button
                type="button"
                onClick={() => imprimirAbaAtual({ incluirGraficos: false })}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
              >
                Imprimir sem gráficos
              </button>
              <button
                type="button"
                onClick={() => setOpcoesImpressaoEvolucaoAbertas(false)}
                className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-black text-slate-500 hover:bg-slate-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {fichaLoteModalAberto && (
        <ModalFichaCompleta
          modoLote
          fichaPendente={{ aberta: true }}
          quantidadeLote={conviventesFiltrados.length}
          descricaoFiltrosLote={filtrosAtivos.join(' | ') || 'Todos os filtros'}
          imprimirFichaCompleta={imprimirFichasCompletasFiltradas}
          carregando={imprimindoFichasLote}
          progressoLote={progressoFichasLote}
          onFechar={() => setFichaLoteModalAberto(false)}
        />
      )}

      <ModalOpcaoCabecalhoPia
        aberto={piaEvolucaoModalAberto}
        onFechar={() => !imprimindoPiaEvolucao && setPiaEvolucaoModalAberto(false)}
        onConfirmar={imprimirPiaEvolucaoFiltrada}
        modoLote
        quantidade={new Set(registrosPiaFiltrados.map((registro) => registro.convivente_id).filter(Boolean)).size}
        descricaoFiltros={filtrosAtivos.join(' | ') || 'Todos os filtros'}
        carregando={imprimindoPiaEvolucao}
        progresso={progressoPiaEvolucao}
      />

      {termoBagageiroConvivente && (
        <ModalImpressaoTermoBagageiro
          aberto={Boolean(termoBagageiroConvivente)}
          conviventeId={termoBagageiroConvivente.id}
          convivente={termoBagageiroConvivente}
          nomeConvivente={termoBagageiroConvivente.nome_social || termoBagageiroConvivente.nome_completo}
          numeroProntuario={termoBagageiroConvivente.numero_institucional}
          tituloContexto="Termo do bagageiro"
          descricaoContexto="Imprima o termo de guarda de volumes com assinatura digital ou manual."
          onFechar={() => setTermoBagageiroConvivente(null)}
          onConfirmar={executarImpressaoTermoBagageiroRelatorio}
        />
      )}
    </AppShell>
  );
}
