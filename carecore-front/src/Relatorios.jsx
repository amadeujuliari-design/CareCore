import { useEffect, useMemo, useState } from 'react';

import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, ReportActionButton, ScrollArea } from './components/PremiumUI';
import CarteirinhasLote from './components/CarteirinhasLote';
import DireitosReservadosAviso from './components/DireitosReservadosAviso';
import { RelatoriosEvolucaoGraficos } from './components/relatorios/RelatoriosEvolucaoGraficos';
import { RelatoriosFiltrosPanel } from './components/relatorios/RelatoriosFiltrosPanel';
import { RelatoriosPersonalizacao } from './components/relatorios/RelatoriosPersonalizacao';
import { RelatoriosCardsAba, RelatoriosMetricasTopo } from './components/relatorios/RelatoriosResumoAba';
import { RelatoriosTabelaDados } from './components/relatorios/RelatoriosTabelaDados';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import { gerarGraficosEvolucaoHtml } from './utils/relatoriosGraficosHtml';
import { useRelatoriosFiltros } from './hooks/useRelatoriosFiltros';
import { useRelatoriosIndicadores } from './hooks/useRelatoriosIndicadores';
import { useRelatoriosTabela } from './hooks/useRelatoriosTabela';
import {
  LIMITE_AMOSTRA_OCORRENCIAS_RELATORIOS,
  carregarDadosRelatorios,
} from './services/relatoriosService';
import { useRelatoriosIdentidade } from './hooks/useRelatoriosIdentidade';
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

export default function Relatorios() {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');

  const [aba, setAba] = useState('conviventes');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [conviventes, setConviventes] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [resumoOcorrencias, setResumoOcorrencias] = useState(null);
  const [tecnicos, setTecnicos] = useState([]);
  const [rotinaOperacional, setRotinaOperacional] = useState(null);
  const [historicoRotina, setHistoricoRotina] = useState([]);
  const [resumoRotinaEvolucao, setResumoRotinaEvolucao] = useState([]);
  const [resumoAvisos, setResumoAvisos] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [filtros, setFiltros] = useState(criarFiltrosRelatoriosIniciais);
  const [filtrosMobileAbertos, setFiltrosMobileAbertos] = useState(false);
  const [paginaTabela, setPaginaTabela] = useState(1);
  const [ordenacaoAcomodacoes, setOrdenacaoAcomodacoes] = useState('quarto');
  const [opcoesImpressaoEvolucaoAbertas, setOpcoesImpressaoEvolucaoAbertas] = useState(false);
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
        if (dadosRelatorios.rotina) setRotinaOperacional(dadosRelatorios.rotina);
        if (dadosRelatorios.historicoRotina) setHistoricoRotina(dadosRelatorios.historicoRotina);
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
  } = useRelatoriosFiltros({
    avisos,
    conviventes,
    filtros,
    historicoRotina,
    ocorrencias,
    ordenacaoAcomodacoes,
    quartos,
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
    quartos,
    resumoAvisos,
    resumoOcorrencias,
    rotinaOperacional,
    tecnicoId: filtros.tecnicoId,
    tecnicos,
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
          saidas: 0,
          almocos: 0,
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
        item.atendimentos += Number(registro.atendimentos || 0);
        item.entradas += Number(registro.entradas || 0);
        item.saidas += Number(registro.saidas || 0);
        item.almocos += Number(registro.almocos || 0);
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

    return {
      serie,
      totalAtendimentos,
      mediaDiaria,
      pico,
      tendencia,
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
    filtros,
    historicoRotinaFiltrado,
    itensPorPaginaTabela,
    leitosAcomodacoesFiltrados,
    ocorrenciasFiltradas,
    paginaTabela,
    quartos,
    relatoriosAtuais,
    resumoPendenciasTecnicasEvolucao,
    setPaginaTabela,
    tecnicoPendenciasSelecionadoNome,
    tecnicos,
    totalNovosAcolhimentosEvolucao,
  });

  function exportarAbaAtual() {
    exportarRelatorioXlsx({
      nomeArquivo: `central-relatorios-${aba}-${new Date().toISOString().slice(0, 10)}`,
      titulo: `Central de Relatórios - ${ABAS_RELATORIOS.find((a) => a.id === aba)?.label || aba}`,
      filtros: {
        Aba: ABAS_RELATORIOS.find((a) => a.id === aba)?.label || aba,
        'Relatórios listados': relatoriosAtuais.length,
        Período: filtros.dataInicio || filtros.dataFim
          ? `${filtros.dataInicio ? formatarData(filtros.dataInicio) : 'início'} a ${filtros.dataFim ? formatarData(filtros.dataFim) : 'hoje'}`
          : 'Todos',
        Técnico: tecnicos.find((t) => t.id === filtros.tecnicoId)?.nome || 'Todos',
        'Status convivente': filtros.statusConvivente,
        'Status ocorrência': filtros.statusOcorrencia,
        Prioridade: filtros.prioridadeOcorrencia,
        Pendências: filtros.somentePendencias ? 'Sim' : 'Não',
        'Status leito': filtros.acomodacaoStatusLeito,
        'Modalidade acomodação': filtros.acomodacaoModalidade,
        'Público acomodação': filtros.acomodacaoPublico,
        Busca: filtros.busca || '-',
      },
      colunas: colunasExportacao,
      dados: linhasExportacao,
    });
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
            </div>
          </section>

          {loading ? (
            <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-brand font-black animate-pulse">
              Carregando central de relatórios...
            </div>
          ) : aba === 'personalizacao' ? (
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
          ) : aba === 'carteirinhas' ? (
            <CarteirinhasLote
              conviventes={conviventesFiltrados}
              quartos={quartos}
              tecnicos={tecnicos}
              identidadeRelatorio={identidadeRelatorio}
            />
          ) : (
            <>
              <RelatoriosCardsAba relatoriosAtuaisVisiveis={relatoriosAtuaisVisiveis} />

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
    </AppShell>
  );
}
