import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import Sidebar from './Sidebar';
import { API_ROOT } from './config/apiBase';
import { CardMetrica, RelatorioCard } from './components/RelatoriosUI';
import { exportarRelatorioXlsx } from './utils/exportarRelatorioXlsx';
import { imprimirRelatorio } from './utils/imprimirRelatorio';
import { listarMeusAvisos, obterResumoAvisos } from './services/avisosService';
import {
  ABAS_RELATORIOS,
  campoTexto,
  contar,
  criarFiltrosRelatoriosIniciais,
  dataDentroDoPeriodo,
  descreverFiltrosAtivosRelatorios,
  formatarData,
  formatarDataHora,
  normalizarPrioridade,
  porcentagem,
} from './utils/relatoriosUtils';

export default function Relatorios() {
  const token = localStorage.getItem('@CareCore:token') || localStorage.getItem('token');

  const [aba, setAba] = useState('geral');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [conviventes, setConviventes] = useState([]);
  const [quartos, setQuartos] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [rotinaOperacional, setRotinaOperacional] = useState(null);
  const [historicoRotina, setHistoricoRotina] = useState([]);
  const [sisaMensal, setSisaMensal] = useState({ resumo: {}, items: [] });
  const [resumoAvisos, setResumoAvisos] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [filtros, setFiltros] = useState(criarFiltrosRelatoriosIniciais);

  useEffect(() => {
    async function carregarDados() {
      if (!token) return;

      try {
        setLoading(true);
        setErro('');

        const headers = { Authorization: `Bearer ${token}` };

        const [
          resConviventes,
          resQuartos,
          resOcorrencias,
          resTecnicos,
          resRotina,
          resHistoricoRotina,
          resSisaMensal,
          resAvisos,
          resResumoAvisos,
        ] = await Promise.all([
          axios.get(`${API_ROOT}/conviventes`, { headers }),
          axios.get(`${API_ROOT}/quartos`, { headers }),
          axios.get(`${API_ROOT}/ocorrencias`, { headers }),
          axios.get(`${API_ROOT}/tecnicos`, { headers }),
          axios.get(`${API_ROOT}/rotina/dashboard-operacional`, { headers }).catch(() => ({ data: null })),
          axios.get(`${API_ROOT}/rotina/historico`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_ROOT}/convenio-sisa/mensal`, {
            headers,
            params: {
              ano: filtros.sisaAno,
              mes: filtros.sisaMes,
            },
          }).catch(() => ({ data: { resumo: {}, items: [] } })),
          listarMeusAvisos(token, { limite: 50 }).catch(() => []),
          obterResumoAvisos(token).catch(() => null),
        ]);

        setConviventes(resConviventes.data || []);
        setQuartos(resQuartos.data || []);
        setOcorrencias(resOcorrencias.data || []);
        setTecnicos(resTecnicos.data || []);
        setRotinaOperacional(resRotina.data || null);
        setHistoricoRotina(resHistoricoRotina.data || []);
        setSisaMensal(resSisaMensal.data || { resumo: {}, items: [] });
        setAvisos(Array.isArray(resAvisos) ? resAvisos : []);
        setResumoAvisos(resResumoAvisos || null);
      } catch (error) {
        console.error('Erro ao carregar central de relatorios', error);
        setErro('Nao foi possivel carregar os dados da central de relatorios.');
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [filtros.sisaAno, filtros.sisaMes, token]);

  const filtrosAtivos = useMemo(() => {
    return descreverFiltrosAtivosRelatorios({ aba, filtros, tecnicos });
  }, [aba, filtros, tecnicos]);

  function atualizarFiltro(nome, valor) {
    setFiltros((atual) => ({
      ...atual,
      [nome]: valor,
    }));
  }

  function limparFiltros() {
    setFiltros(criarFiltrosRelatoriosIniciais());
  }

  const conviventesFiltrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();

    return conviventes.filter((convivente) => {
      if (filtros.statusConvivente !== 'Todos' && convivente.status !== filtros.statusConvivente) {
        return false;
      }

      if (filtros.tecnicoId && convivente.tecnico_id !== filtros.tecnicoId) {
        return false;
      }

      if (!dataDentroDoPeriodo(convivente.data_entrada, filtros.dataInicio, filtros.dataFim)) {
        return false;
      }

      if (termo) {
        const texto = campoTexto(convivente, [
          'nome_completo',
          'nome_social',
          'cpf',
          'numero_sisa',
          'numero_nis',
          'cidade',
          'bairro',
        ]);

        if (!texto.includes(termo)) return false;
      }

      return true;
    });
  }, [conviventes, filtros]);

  const idsConviventesFiltrados = useMemo(
    () => new Set(conviventesFiltrados.map((convivente) => convivente.id)),
    [conviventesFiltrados],
  );

  const ocorrenciasFiltradas = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();

    return ocorrencias.filter((ocorrencia) => {
      if (filtros.tecnicoId && ocorrencia.tecnico_responsavel_id !== filtros.tecnicoId) {
        return false;
      }

      if (filtros.statusOcorrencia === 'Pendentes' && ocorrencia.status_resolucao === 'Resolvido') {
        return false;
      }

      if (filtros.statusOcorrencia === 'Resolvidas' && ocorrencia.status_resolucao !== 'Resolvido') {
        return false;
      }

      if (filtros.somentePendencias && ocorrencia.status_resolucao === 'Resolvido') {
        return false;
      }

      if (
        filtros.prioridadeOcorrencia !== 'Todas' &&
        normalizarPrioridade(ocorrencia.prioridade) !== filtros.prioridadeOcorrencia
      ) {
        return false;
      }

      if (!dataDentroDoPeriodo(ocorrencia.data_ocorrencia, filtros.dataInicio, filtros.dataFim)) {
        return false;
      }

      if (filtros.statusConvivente !== 'Todos' && !idsConviventesFiltrados.has(ocorrencia.convivente_id)) {
        return false;
      }

      if (termo) {
        const texto = campoTexto(ocorrencia, [
          'tipo_ocorrencia',
          'motivo',
          'descricao',
          'parecer_tecnico',
        ]);

        if (!texto.includes(termo)) return false;
      }

      return true;
    });
  }, [filtros, idsConviventesFiltrados, ocorrencias]);

  const historicoRotinaFiltrado = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();

    return historicoRotina.filter((registro) => {
      if (!dataDentroDoPeriodo(registro.data_registro, filtros.dataInicio, filtros.dataFim)) {
        return false;
      }

      if (filtros.tecnicoId && !idsConviventesFiltrados.has(registro.convivente_id)) {
        return false;
      }

      if (filtros.statusConvivente !== 'Todos' && !idsConviventesFiltrados.has(registro.convivente_id)) {
        return false;
      }

      if (filtros.somentePendencias && !registro.cancelado && !registro.foi_editado && !registro.retorno_rapido) {
        return false;
      }

      if (termo) {
        const texto = campoTexto(registro, [
          'convivente_nome',
          'convivente_nome_completo',
          'tipo_registro',
          'usuario_nome',
          'motivo_edicao',
          'motivo_cancelamento',
          'justificativa_retorno_rapido',
        ]);

        if (!texto.includes(termo)) return false;
      }

      return true;
    });
  }, [filtros, historicoRotina, idsConviventesFiltrados]);

  const avisosFiltrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();

    return avisos.filter((aviso) => {
      const dataAviso = aviso.criado_em || aviso.data_criacao || aviso.created_at || aviso.valido_ate;

      if ((filtros.dataInicio || filtros.dataFim) && !dataDentroDoPeriodo(dataAviso, filtros.dataInicio, filtros.dataFim)) {
        return false;
      }

      if (filtros.somentePendencias && aviso.lido) {
        return false;
      }

      if (termo) {
        const texto = campoTexto(aviso, ['titulo', 'mensagem', 'classificacao', 'prioridade']);
        if (!texto.includes(termo)) return false;
      }

      return true;
    });
  }, [avisos, filtros]);

  const anosSisa = useMemo(() => {
    const anoAtual = new Date().getFullYear();
    return [anoAtual - 1, anoAtual, anoAtual + 1];
  }, []);

  const sisaItensFiltrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();

    return (sisaMensal.items || []).filter((item) => {
      if (filtros.sisaStatusLancamento === 'lancados' && !item.lancado_sisa) {
        return false;
      }

      if (filtros.sisaStatusLancamento === 'pendentes' && item.lancado_sisa) {
        return false;
      }

      if (filtros.tecnicoId) {
        const convivente = conviventes.find((c) => c.id === item.convivente_id);
        if (convivente?.tecnico_id !== filtros.tecnicoId) return false;
      }

      if (filtros.statusConvivente !== 'Todos' && !idsConviventesFiltrados.has(item.convivente_id)) {
        return false;
      }

      if (termo) {
        const texto = [
          item.nome,
          item.nome_completo,
          item.prontuario,
          item.numero_sisa,
          item.lancado_por_nome,
          item.observacoes_lancamento_sisa,
        ].join(' ').toLowerCase();

        if (!texto.includes(termo)) return false;
      }

      return true;
    });
  }, [conviventes, filtros, idsConviventesFiltrados, sisaMensal.items]);

  const leitosAcomodacoesFiltrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();

    return quartos.flatMap((quarto) => {
      if (filtros.acomodacaoModalidade !== 'Todas' && quarto.modalidade !== filtros.acomodacaoModalidade) {
        return [];
      }

      if (filtros.acomodacaoPublico !== 'Todos' && quarto.tipo_publico !== filtros.acomodacaoPublico) {
        return [];
      }

      return (quarto.leitos || [])
        .map((leito) => ({
          quarto,
          leito,
          convivente: conviventes.find((conv) => conv.id === leito.convivente_id),
        }))
        .filter(({ quarto: q, leito, convivente }) => {
          const statusLeito = leito.status || 'Livre';

          if (filtros.acomodacaoStatusLeito !== 'Todos' && statusLeito !== filtros.acomodacaoStatusLeito) {
            return false;
          }

          if (filtros.tecnicoId) {
            if (!convivente || convivente.tecnico_id !== filtros.tecnicoId) return false;
          }

          if (filtros.statusConvivente !== 'Todos') {
            if (!convivente || convivente.status !== filtros.statusConvivente) return false;
          }

          if (filtros.somentePendencias && statusLeito !== 'Livre') {
            return false;
          }

          if (termo) {
            const texto = [
              q.nome,
              q.modalidade,
              q.tipo_publico,
              leito.identificacao,
              leito.status,
              leito.convivente_nome,
              leito.convivente_nome_completo,
              leito.cpf,
              convivente?.nome_completo,
              convivente?.nome_social,
              convivente?.cpf,
            ].join(' ').toLowerCase();

            if (!texto.includes(termo)) return false;
          }

          return true;
        });
    });
  }, [conviventes, filtros, quartos]);

  const dados = useMemo(() => {
    const totalConviventes = conviventesFiltrados.length;
    const ativos = contar(conviventesFiltrados, (c) => c.status === 'Ativo');
    const inativos = contar(conviventesFiltrados, (c) => c.status === 'Inativado');
    const bloqueados = contar(conviventesFiltrados, (c) => c.status === 'Bloqueado');
    const semTecnico = contar(conviventesFiltrados, (c) => !c.tecnico_id);
    const semLeitoAtivo = contar(conviventesFiltrados, (c) => c.status === 'Ativo' && !c.leito_id);
    const semFoto = contar(conviventesFiltrados, (c) => !c.foto_url);
    const semCpf = contar(conviventesFiltrados, (c) => !c.cpf);
    const semContato = contar(conviventesFiltrados, (c) => !c.contato_emergencia_nome || !c.contato_emergencia_telefone);
    const semSisa = contar(conviventesFiltrados, (c) => !c.numero_sisa);
    const semNis = contar(conviventesFiltrados, (c) => !c.numero_nis);

    const leitos = quartos.flatMap((q) => q.leitos || []);
    const totalLeitos = leitos.length;
    const leitosOcupados = contar(leitos, (l) => idsConviventesFiltrados.has(l.convivente_id));
    const leitosLivres = contar(leitos, (l) => l.status === 'Livre');
    const quartosAcomodacoes = new Set(leitosAcomodacoesFiltrados.map(({ quarto }) => quarto.id)).size;
    const leitosAcomodacoesOcupados = contar(
      leitosAcomodacoesFiltrados,
      ({ leito }) => leito.status === 'Ocupado',
    );
    const leitosAcomodacoesLivres = contar(
      leitosAcomodacoesFiltrados,
      ({ leito }) => (leito.status || 'Livre') === 'Livre',
    );

    const totalOcorrencias = ocorrenciasFiltradas.length;
    const ocorrenciasPendentes = contar(ocorrenciasFiltradas, (o) => o.status_resolucao !== 'Resolvido');
    const ocorrenciasResolvidas = contar(ocorrenciasFiltradas, (o) => o.status_resolucao === 'Resolvido');
    const ocorrenciasAltaCritica = contar(ocorrenciasFiltradas, (o) => ['Alta', 'Crítica'].includes(normalizarPrioridade(o.prioridade)) && o.status_resolucao !== 'Resolvido');

    const rotinaResumo = rotinaOperacional?.resumo || {};
    const rotinaFiltradaResumo = {
      total: historicoRotinaFiltrado.length,
      entradas: contar(historicoRotinaFiltrado, (r) => r.tipo_registro === 'Entrada'),
      saidas: contar(historicoRotinaFiltrado, (r) => r.tipo_registro === 'Saída'),
      almocos: contar(historicoRotinaFiltrado, (r) => r.tipo_registro === 'Almoço'),
      retornosRapidos: contar(historicoRotinaFiltrado, (r) => r.retorno_rapido),
      editados: contar(historicoRotinaFiltrado, (r) => r.foi_editado),
      cancelados: contar(historicoRotinaFiltrado, (r) => r.cancelado),
    };
    const tecnicosComCasos = new Set(
      conviventesFiltrados
        .map((convivente) => convivente.tecnico_id)
        .filter(Boolean),
    ).size;

    return {
      totalConviventes,
      ativos,
      inativos,
      bloqueados,
      semTecnico,
      semLeitoAtivo,
      semFoto,
      semCpf,
      semContato,
      semSisa,
      semNis,
      quartos: quartos.length,
      totalLeitos,
      leitosOcupados,
      leitosLivres,
      taxaOcupacao: porcentagem(leitosOcupados, totalLeitos),
      quartosAcomodacoes,
      leitosAcomodacoesTotal: leitosAcomodacoesFiltrados.length,
      leitosAcomodacoesOcupados,
      leitosAcomodacoesLivres,
      taxaOcupacaoAcomodacoes: porcentagem(leitosAcomodacoesOcupados, leitosAcomodacoesFiltrados.length),
      totalOcorrencias,
      ocorrenciasPendentes,
      ocorrenciasResolvidas,
      ocorrenciasAltaCritica,
      tecnicos: filtros.tecnicoId ? 1 : tecnicos.length,
      tecnicosComCasos,
      rotinaResumo,
      rotinaFiltradaResumo,
      auditoriaRotinaTotal: rotinaFiltradaResumo.editados + rotinaFiltradaResumo.cancelados + rotinaFiltradaResumo.retornosRapidos,
      avisosTotal: avisosFiltrados.length || resumoAvisos?.total_visiveis || 0,
      avisosNaoLidos: contar(avisosFiltrados, (a) => !a.lido),
      sisaLancados: contar(sisaItensFiltrados, (item) => item.lancado_sisa),
      sisaPendentes: contar(sisaItensFiltrados, (item) => !item.lancado_sisa),
      sisaTotal: sisaItensFiltrados.length,
    };
  }, [avisosFiltrados, conviventesFiltrados, filtros.tecnicoId, historicoRotinaFiltrado, idsConviventesFiltrados, leitosAcomodacoesFiltrados, ocorrenciasFiltradas, quartos, resumoAvisos, rotinaOperacional, sisaItensFiltrados, tecnicos]);

  const relatoriosPorAba = useMemo(() => {
    return {
      geral: [
        {
          titulo: 'Resumo executivo institucional',
          descricao: 'Painel consolidado com acolhidos, ocupacao, ocorrencias, rotina e comunicacao interna.',
          status: 'parcial',
          link: '/dashboard',
          metricas: [
            { label: 'Conviventes ativos', valor: dados.ativos },
            { label: 'Ocupacao', valor: `${dados.taxaOcupacao}%` },
            { label: 'Pendencias', valor: dados.ocorrenciasPendentes },
            { label: 'Avisos nao lidos', valor: dados.avisosNaoLidos },
          ],
        },
      ],
      conviventes: [
        {
          titulo: 'Relatorio de conviventes',
          descricao: 'Status, tecnico responsavel, leito, origem e dados cadastrais relevantes.',
          status: 'planejado',
          metricas: [
            { label: 'Total', valor: dados.totalConviventes },
            { label: 'Ativos', valor: dados.ativos },
            { label: 'Inativos', valor: dados.inativos },
            { label: 'Sem tecnico', valor: dados.semTecnico },
          ],
        },
        {
          titulo: 'Relatorio de permanencia',
          descricao: 'Tempo medio na instituicao, entradas, saidas, altas, transferencias e evasoes por periodo.',
          status: 'planejado',
          metricas: [
            { label: 'Ativos', valor: dados.ativos },
            { label: 'Inativados', valor: dados.inativos },
            { label: 'Bloqueados', valor: dados.bloqueados },
            { label: 'Centro dia', valor: dados.semLeitoAtivo },
          ],
        },
      ],
      rotina: [
        {
          titulo: 'Historico da rotina',
          descricao: 'Entradas, saidas, almocos, edicoes, cancelamentos e retornos rapidos por filtros.',
          status: 'pronto',
          link: '/rotina/historico',
          metricas: [
            { label: 'Registros', valor: dados.rotinaFiltradaResumo.total },
            { label: 'Entradas', valor: dados.rotinaFiltradaResumo.entradas },
            { label: 'Saidas', valor: dados.rotinaFiltradaResumo.saidas },
            { label: 'Almocos', valor: dados.rotinaFiltradaResumo.almocos },
          ],
        },
        {
          titulo: 'Dashboard operacional',
          descricao: 'Situacao atual dos acolhidos dentro/fora, sem movimento e auditoria do dia.',
          status: 'pronto',
          link: '/rotina/dashboard',
          metricas: [
            { label: 'Retornos', valor: dados.rotinaFiltradaResumo.retornosRapidos },
            { label: 'Editados', valor: dados.rotinaFiltradaResumo.editados },
            { label: 'Cancelados', valor: dados.rotinaFiltradaResumo.cancelados },
            { label: 'Presentes agora', valor: dados.rotinaResumo.presentes_agora || 0 },
          ],
        },
      ],
      ocorrencias: [
        {
          titulo: 'Relatorio de ocorrencias',
          descricao: 'Fila de chamados, pendencias tecnicas, criticidade, tipos e responsaveis.',
          status: 'pronto',
          link: '/ocorrencias',
          metricas: [
            { label: 'Total visivel', valor: dados.totalOcorrencias },
            { label: 'Pendentes', valor: dados.ocorrenciasPendentes },
            { label: 'Resolvidas', valor: dados.ocorrenciasResolvidas },
            { label: 'Alta/Critica', valor: dados.ocorrenciasAltaCritica },
          ],
        },
        {
          titulo: 'Relatorio tecnico por profissional',
          descricao: 'Casos do tecnico, pendencias, resolucoes no periodo e tempo medio de atendimento.',
          status: 'planejado',
          metricas: [
            { label: 'Tecnicos', valor: dados.tecnicos },
            { label: 'Pendencias', valor: dados.ocorrenciasPendentes },
            { label: 'Resolvidas', valor: dados.ocorrenciasResolvidas },
            { label: 'Criticas', valor: dados.ocorrenciasAltaCritica },
          ],
        },
      ],
      sisa: [
        {
          titulo: 'Relatorio SISA mensal e diario',
          descricao: 'Conferencia diaria, mensal, fechamento, lancamentos e exportacao XLSX.',
          status: 'pronto',
          link: '/convenio-sisa',
          metricas: [
            { label: 'Registros', valor: dados.sisaTotal },
            { label: 'Lancados', valor: dados.sisaLancados },
            { label: 'Pendentes', valor: dados.sisaPendentes },
            { label: 'Periodo', valor: `${String(filtros.sisaMes).padStart(2, '0')}/${filtros.sisaAno}` },
          ],
        },
      ],
      acomodacoes: [
        {
          titulo: 'Relatorio de acomodacoes',
          descricao: 'Quartos, leitos, ocupacao, vagas livres e distribuicao por acomodacao.',
          status: 'pronto',
          link: '/quartos',
          metricas: [
            { label: 'Quartos', valor: dados.quartosAcomodacoes },
            { label: 'Leitos', valor: dados.leitosAcomodacoesTotal },
            { label: 'Ocupados', valor: dados.leitosAcomodacoesOcupados },
            { label: 'Livres', valor: dados.leitosAcomodacoesLivres },
          ],
        },
      ],
      documentacao: [
        {
          titulo: 'Pendencias de prontuario',
          descricao: 'Acolhidos sem foto, CPF, contato de emergencia, numero SISA, NIS ou documentacao essencial.',
          status: 'planejado',
          metricas: [
            { label: 'Sem foto', valor: dados.semFoto },
            { label: 'Sem CPF', valor: dados.semCpf },
            { label: 'Sem contato', valor: dados.semContato },
            { label: 'Sem SISA', valor: dados.semSisa },
            { label: 'Sem NIS', valor: dados.semNis },
          ],
        },
      ],
      equipe: [
        {
          titulo: 'Relatorio de equipe',
          descricao: 'Usuarios por perfil, tecnicos ativos, carga de casos e estrutura institucional.',
          status: 'planejado',
          metricas: [
            { label: 'Tecnicos', valor: dados.tecnicos },
            { label: 'Conviventes', valor: dados.totalConviventes },
            { label: 'Sem tecnico', valor: dados.semTecnico },
            { label: 'Tecnicos c/ casos', valor: dados.tecnicosComCasos },
          ],
        },
      ],
      auditoria: [
        {
          titulo: 'Relatorio de auditoria',
          descricao: 'Eventos auditaveis da rotina: edicoes, cancelamentos e retornos rapidos com operador e justificativa.',
          status: 'pronto',
          metricas: [
            { label: 'Eventos', valor: dados.auditoriaRotinaTotal },
            { label: 'Editados', valor: dados.rotinaFiltradaResumo.editados },
            { label: 'Cancelados', valor: dados.rotinaFiltradaResumo.cancelados },
            { label: 'Retornos rapidos', valor: dados.rotinaFiltradaResumo.retornosRapidos },
          ],
        },
      ],
    };
  }, [dados, filtros.sisaAno, filtros.sisaMes]);

  const relatoriosAtuais = relatoriosPorAba[aba] || [];

  const mapaTecnicos = useMemo(() => {
    return new Map(tecnicos.map((tecnico) => [tecnico.id, tecnico.nome]));
  }, [tecnicos]);

  const mapaLeitos = useMemo(() => {
    const mapa = new Map();

    quartos.forEach((quarto) => {
      (quarto.leitos || []).forEach((leito) => {
        mapa.set(leito.id, `${quarto.nome} - ${leito.identificacao}`);
      });
    });

    return mapa;
  }, [quartos]);

  const dadosDetalhados = useMemo(() => {
    const contarOcorrenciasPendentesConvivente = (conviventeId) =>
      contar(
        ocorrenciasFiltradas,
        (ocorrencia) =>
          ocorrencia.convivente_id === conviventeId &&
          ocorrencia.status_resolucao !== 'Resolvido',
      );

    const pendenciasConvivente = (convivente) => {
      const pendencias = [];

      if (!convivente.foto_url) pendencias.push('Foto');
      if (!convivente.cpf) pendencias.push('CPF');
      if (!convivente.contato_emergencia_nome || !convivente.contato_emergencia_telefone) pendencias.push('Contato');
      if (!convivente.tecnico_id) pendencias.push('Tecnico');
      if (!convivente.numero_sisa) pendencias.push('SISA');

      return pendencias.length ? pendencias.join(', ') : 'Sem pendencias principais';
    };

    const montarLinhaConvivente = (convivente) => ({
      Prontuario: convivente.numero_institucional ? `#${convivente.numero_institucional}` : 'S/N',
      Nome: convivente.nome_social || convivente.nome_completo || '-',
      Status: convivente.status || '-',
      Tecnico: mapaTecnicos.get(convivente.tecnico_id) || 'Sem tecnico',
      Entrada: formatarData(convivente.data_entrada),
      Leito: mapaLeitos.get(convivente.leito_id) || 'Centro dia / sem leito',
      CPF: convivente.cpf || '-',
      Cidade: convivente.cidade || '-',
      'Ocorrencias pendentes': contarOcorrenciasPendentesConvivente(convivente.id),
      Pendencias: pendenciasConvivente(convivente),
    });

    if (aba === 'geral') {
      const colunas = filtros.tecnicoId
        ? ['Prontuario', 'Nome', 'Status', 'Entrada', 'Leito', 'Ocorrencias pendentes', 'Pendencias']
        : ['Prontuario', 'Nome', 'Status', 'Tecnico', 'Entrada', 'Leito', 'Ocorrencias pendentes', 'Pendencias'];

      return {
        titulo: 'Base nominal filtrada',
        colunas,
        linhas: conviventesFiltrados.map((convivente) => {
          const linha = montarLinhaConvivente(convivente);

          const base = {
            Prontuario: linha.Prontuario,
            Nome: linha.Nome,
            Status: linha.Status,
            Entrada: linha.Entrada,
            Leito: linha.Leito,
            'Ocorrencias pendentes': linha['Ocorrencias pendentes'],
            Pendencias: linha.Pendencias,
          };

          if (!filtros.tecnicoId) {
            base.Tecnico = linha.Tecnico;
          }

          return base;
        }),
      };
    }

    if (aba === 'conviventes') {
      return {
        titulo: 'Conviventes filtrados',
        colunas: filtros.tecnicoId
          ? ['Prontuario', 'Nome', 'Status', 'Entrada', 'Leito', 'CPF', 'Cidade', 'Ocorrencias pendentes', 'Pendencias']
          : ['Prontuario', 'Nome', 'Status', 'Tecnico', 'Entrada', 'Leito', 'CPF', 'Cidade', 'Ocorrencias pendentes', 'Pendencias'],
        linhas: conviventesFiltrados.map(montarLinhaConvivente),
      };
    }

    if (aba === 'ocorrencias') {
      return {
        titulo: 'Ocorrencias filtradas',
        colunas: ['Data', 'Convivente', 'Tipo', 'Motivo', 'Prioridade', 'Status', 'Tecnico'],
        linhas: ocorrenciasFiltradas.map((ocorrencia) => {
          const convivente = conviventes.find((c) => c.id === ocorrencia.convivente_id);

          return {
            Data: formatarDataHora(ocorrencia.data_ocorrencia),
            Convivente: convivente?.nome_social || convivente?.nome_completo || '-',
            Tipo: ocorrencia.tipo_ocorrencia || '-',
            Motivo: ocorrencia.motivo || '-',
            Prioridade: normalizarPrioridade(ocorrencia.prioridade),
            Status: ocorrencia.status_resolucao || '-',
            Tecnico: mapaTecnicos.get(ocorrencia.tecnico_responsavel_id) || 'Sem tecnico',
          };
        }),
      };
    }

    if (aba === 'rotina') {
      return {
        titulo: 'Historico da rotina filtrado',
        colunas: ['Data/Hora', 'Prontuario', 'Convivente', 'Tipo', 'Operador', 'Status', 'Retorno rapido', 'Auditoria/Observacao'],
        linhas: historicoRotinaFiltrado.map((registro) => {
          const status = [
            registro.cancelado ? 'Cancelado' : 'Ativo',
            registro.foi_editado ? 'Editado' : '',
          ].filter(Boolean).join(' / ');

          return {
            'Data/Hora': formatarDataHora(registro.data_registro),
            Prontuario: registro.numero_institucional ? `#${registro.numero_institucional}` : 'S/N',
            Convivente: registro.convivente_nome || registro.convivente_nome_completo || '-',
            Tipo: registro.tipo_registro || '-',
            Operador: registro.usuario_nome || '-',
            Status: status || '-',
            'Retorno rapido': registro.retorno_rapido ? 'Sim' : 'Nao',
            'Auditoria/Observacao': registro.justificativa_retorno_rapido || registro.motivo_edicao || registro.motivo_cancelamento || '-',
          };
        }),
      };
    }

    if (aba === 'acomodacoes') {
      const colunas = filtros.tecnicoId
        ? ['Quarto', 'Modalidade', 'Publico', 'Leito', 'Status leito', 'Convivente', 'Prontuario', 'Status convivente']
        : ['Quarto', 'Modalidade', 'Publico', 'Leito', 'Status leito', 'Convivente', 'Prontuario', 'Status convivente', 'Tecnico'];

      return {
        titulo: 'Acomodacoes e leitos',
        colunas,
        linhas: leitosAcomodacoesFiltrados.map(({ quarto, leito, convivente }) => {
          const linha = {
            Quarto: quarto.nome || '-',
            Modalidade: quarto.modalidade === 'Transitorio' ? 'Transitorio' : quarto.modalidade || '-',
            Publico: quarto.tipo_publico || '-',
            Leito: leito.identificacao || '-',
            'Status leito': leito.status || 'Livre',
            Convivente: convivente?.nome_social || convivente?.nome_completo || leito.convivente_nome_completo || leito.convivente_nome || '-',
            Prontuario: convivente?.numero_institucional || leito.numero_institucional
              ? `#${convivente?.numero_institucional || leito.numero_institucional}`
              : '-',
            'Status convivente': convivente?.status || (leito.status === 'Ocupado' ? 'Ocupado sem vinculo cadastral' : '-'),
          };

          if (!filtros.tecnicoId) {
            linha.Tecnico = mapaTecnicos.get(convivente?.tecnico_id) || (convivente ? 'Sem tecnico' : '-');
          }

          return linha;
        }),
      };
    }

    if (aba === 'documentacao') {
      const colunas = filtros.tecnicoId
        ? ['Prontuario', 'Nome', 'Status', 'N SISA', 'NIS', 'Sem foto', 'Sem CPF', 'Sem contato']
        : ['Prontuario', 'Nome', 'Status', 'Tecnico', 'N SISA', 'NIS', 'Sem foto', 'Sem CPF', 'Sem contato'];

      return {
        titulo: 'Pendencias documentais filtradas',
        colunas,
        linhas: conviventesFiltrados.map((convivente) => {
          const linha = {
            Prontuario: convivente.numero_institucional ? `#${convivente.numero_institucional}` : 'S/N',
            Nome: convivente.nome_social || convivente.nome_completo || '-',
            Status: convivente.status || '-',
            'N SISA': convivente.numero_sisa || '-',
            NIS: convivente.numero_nis || '-',
            'Sem foto': convivente.foto_url ? 'Nao' : 'Sim',
            'Sem CPF': convivente.cpf ? 'Nao' : 'Sim',
            'Sem contato': convivente.contato_emergencia_nome && convivente.contato_emergencia_telefone ? 'Nao' : 'Sim',
          };

          if (!filtros.tecnicoId) {
            linha.Tecnico = mapaTecnicos.get(convivente.tecnico_id) || 'Sem tecnico';
          }

          return linha;
        }),
      };
    }

    if (aba === 'sisa') {
      return {
        titulo: `Relatorio Convenio SISA - ${String(filtros.sisaMes).padStart(2, '0')}/${filtros.sisaAno}`,
        colunas: ['Prontuario', 'N SISA', 'Convivente', 'Dias', 'Atend.', 'Almocos', 'Entradas', 'Saidas', 'Retornos', 'Status SISA', 'Lancado por'],
        linhas: sisaItensFiltrados.map((item) => ({
          Prontuario: item.prontuario ? `#${item.prontuario}` : 'S/N',
          'N SISA': item.numero_sisa || '-',
          Convivente: item.nome || item.nome_completo || '-',
          Dias: item.dias_presentes ?? 0,
          'Atend.': item.total_atendimentos ?? 0,
          Almocos: item.almocos ?? 0,
          Entradas: item.entradas ?? 0,
          Saidas: item.saidas ?? 0,
          Retornos: item.retornos_rapidos ?? 0,
          'Status SISA': item.lancado_sisa ? 'Lancado' : 'Pendente',
          'Lancado por': item.lancado_sisa
            ? `${item.lancado_por_nome || '-'} (${formatarDataHora(item.lancado_em)})`
            : '-',
        })),
      };
    }

    if (aba === 'equipe') {
      return {
        titulo: 'Equipe tecnica e carga de casos',
        colunas: ['Tecnico', 'Perfil', 'Conviventes vinculados', 'Ocorrencias pendentes'],
        linhas: tecnicos.map((tecnico) => ({
          Tecnico: tecnico.nome || '-',
          Perfil: tecnico.perfil_acesso || '-',
          'Conviventes vinculados': contar(conviventesFiltrados, (c) => c.tecnico_id === tecnico.id),
          'Ocorrencias pendentes': contar(ocorrenciasFiltradas, (o) => o.tecnico_responsavel_id === tecnico.id && o.status_resolucao !== 'Resolvido'),
        })),
      };
    }

    if (aba === 'auditoria') {
      const colunas = filtros.tecnicoId
        ? ['Data/Hora', 'Evento', 'Prontuario', 'Convivente', 'Registro', 'Operador', 'Justificativa/Motivo']
        : ['Data/Hora', 'Evento', 'Prontuario', 'Convivente', 'Tecnico', 'Registro', 'Operador', 'Justificativa/Motivo'];

      const linhas = historicoRotinaFiltrado.flatMap((registro) => {
        const convivente = conviventes.find((c) => c.id === registro.convivente_id);
        const base = {
          'Data/Hora': formatarDataHora(registro.data_registro),
          Prontuario: registro.numero_institucional || convivente?.numero_institucional
            ? `#${registro.numero_institucional || convivente?.numero_institucional}`
            : 'S/N',
          Convivente: registro.convivente_nome || registro.convivente_nome_completo || convivente?.nome_social || convivente?.nome_completo || '-',
          Registro: registro.tipo_registro || '-',
          Operador: registro.usuario_nome || '-',
        };

        if (!filtros.tecnicoId) {
          base.Tecnico = mapaTecnicos.get(convivente?.tecnico_id) || (convivente ? 'Sem tecnico' : '-');
        }

        const eventos = [];

        if (registro.foi_editado) {
          eventos.push({
            ...base,
            Evento: 'Edicao',
            'Justificativa/Motivo': registro.motivo_edicao || '-',
          });
        }

        if (registro.cancelado) {
          eventos.push({
            ...base,
            Evento: 'Cancelamento',
            'Justificativa/Motivo': registro.motivo_cancelamento || '-',
          });
        }

        if (registro.retorno_rapido) {
          eventos.push({
            ...base,
            Evento: 'Retorno rapido',
            'Justificativa/Motivo': registro.justificativa_retorno_rapido || '-',
          });
        }

        return eventos;
      });

      return {
        titulo: 'Eventos de auditoria filtrados',
        colunas,
        linhas,
      };
    }

    return {
      titulo: 'Resumo da aba',
      colunas: ['Relatorio', 'Status', 'Metrica', 'Valor', 'Descricao'],
      linhas: relatoriosAtuais.flatMap((relatorio) =>
        (relatorio.metricas || []).map((metrica) => ({
          Relatorio: relatorio.titulo,
          Status: relatorio.status,
          Metrica: metrica.label,
          Valor: metrica.valor,
          Descricao: relatorio.descricao,
        }))
      ),
    };
  }, [aba, conviventes, conviventesFiltrados, filtros.sisaAno, filtros.sisaMes, filtros.tecnicoId, historicoRotinaFiltrado, leitosAcomodacoesFiltrados, mapaLeitos, mapaTecnicos, ocorrenciasFiltradas, relatoriosAtuais, sisaItensFiltrados, tecnicos]);

  const linhasResumoMetricas = relatoriosAtuais.flatMap((relatorio) =>
    (relatorio.metricas || []).map((metrica) => ({
      Relatorio: relatorio.titulo,
      Status: relatorio.status,
      Metrica: metrica.label,
      Valor: metrica.valor,
      Descricao: relatorio.descricao,
    }))
  );

  const linhasExportacao = dadosDetalhados.linhas || linhasResumoMetricas;
  const colunasExportacao = dadosDetalhados.colunas || ['Relatorio', 'Status', 'Metrica', 'Valor', 'Descricao'];

  function exportarAbaAtual() {
    exportarRelatorioXlsx({
      nomeArquivo: `central-relatorios-${aba}-${new Date().toISOString().slice(0, 10)}`,
      titulo: `Central de Relatorios - ${ABAS_RELATORIOS.find((a) => a.id === aba)?.label || aba}`,
      filtros: {
        Aba: ABAS_RELATORIOS.find((a) => a.id === aba)?.label || aba,
        'Relatorios listados': relatoriosAtuais.length,
        Periodo: filtros.dataInicio || filtros.dataFim
          ? `${filtros.dataInicio || 'inicio'} a ${filtros.dataFim || 'hoje'}`
          : 'Todos',
        Tecnico: tecnicos.find((t) => t.id === filtros.tecnicoId)?.nome || 'Todos',
        'Status convivente': filtros.statusConvivente,
        'Status ocorrencia': filtros.statusOcorrencia,
        Prioridade: filtros.prioridadeOcorrencia,
        Pendencias: filtros.somentePendencias ? 'Sim' : 'Nao',
        'Status leito': filtros.acomodacaoStatusLeito,
        'Modalidade acomodacao': filtros.acomodacaoModalidade,
        'Publico acomodacao': filtros.acomodacaoPublico,
        'SISA periodo': `${String(filtros.sisaMes).padStart(2, '0')}/${filtros.sisaAno}`,
        'Lancamento SISA': filtros.sisaStatusLancamento,
        Busca: filtros.busca || '-',
      },
      colunas: colunasExportacao,
      dados: linhasExportacao,
    });
  }

  function imprimirAbaAtual() {
    imprimirRelatorio({
      titulo: `${dadosDetalhados.titulo} - ${ABAS_RELATORIOS.find((a) => a.id === aba)?.label || aba}`,
      subtitulo: `${linhasExportacao.length} registros. Filtros: ${filtrosAtivos.join(' | ') || 'Todos'}.`,
      colunas: colunasExportacao,
      dados: linhasExportacao,
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <header className="bg-white shadow-sm border-b px-8 py-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-black text-gray-900">Central de Relatorios</h1>
            <p className="text-xs text-gray-500 mt-1">
              Relatorios operacionais, gerenciais e de prestacao de contas do CARECORE+.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportarAbaAtual}
              disabled={loading || linhasExportacao.length === 0}
              className="px-4 py-2 rounded-xl bg-brand text-white text-xs font-black hover:bg-brandDark disabled:opacity-50"
            >
              Exportar aba
            </button>
            <button
              onClick={imprimirAbaAtual}
              disabled={loading || linhasExportacao.length === 0}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-50 disabled:opacity-50"
            >
              Imprimir aba
            </button>
          </div>
        </header>

        <main className="flex-1 p-8 w-full max-w-7xl mx-auto">
          {erro && (
            <div className="mb-6 bg-red-50 text-red-700 border border-red-100 rounded-2xl p-4 text-sm font-bold">
              {erro}
            </div>
          )}

          <section className="bg-white border border-gray-100 rounded-3xl shadow-sm p-5 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-black text-gray-900">Filtros da central</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Os cards, exportacoes e impressao desta central usam os filtros abaixo.
                </p>
              </div>

              <button
                type="button"
                onClick={limparFiltros}
                className="w-fit px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-600 hover:bg-gray-50"
              >
                Limpar filtros
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Inicio</label>
                <input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => atualizarFiltro('dataInicio', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Fim</label>
                <input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => atualizarFiltro('dataFim', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Tecnico</label>
                <select
                  value={filtros.tecnicoId}
                  onChange={(e) => atualizarFiltro('tecnicoId', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="">Todos</option>
                  {tecnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>
                      {tecnico.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Busca geral</label>
                <input
                  type="text"
                  value={filtros.busca}
                  onChange={(e) => atualizarFiltro('busca', e.target.value)}
                  placeholder="Nome, CPF, motivo, aviso..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status convivente</label>
                <select
                  value={filtros.statusConvivente}
                  onChange={(e) => atualizarFiltro('statusConvivente', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="Todos">Todos</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativado">Inativado</option>
                  <option value="Bloqueado">Bloqueado</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status ocorrencia</label>
                <select
                  value={filtros.statusOcorrencia}
                  onChange={(e) => atualizarFiltro('statusOcorrencia', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="Todos">Todos</option>
                  <option value="Pendentes">Pendentes</option>
                  <option value="Resolvidas">Resolvidas</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Prioridade ocorrencia</label>
                <select
                  value={filtros.prioridadeOcorrencia}
                  onChange={(e) => atualizarFiltro('prioridadeOcorrencia', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                >
                  <option value="Todas">Todas</option>
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Media</option>
                  <option value="Alta">Alta</option>
                  <option value="Crítica">Critica</option>
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 bg-gray-50">
                <input
                  type="checkbox"
                  checked={filtros.somentePendencias}
                  onChange={(e) => atualizarFiltro('somentePendencias', e.target.checked)}
                  className="w-4 h-4 text-brand rounded focus:ring-brand"
                />
                Somente pendencias
              </label>

              {aba === 'sisa' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Mes SISA</label>
                    <select
                      value={filtros.sisaMes}
                      onChange={(e) => atualizarFiltro('sisaMes', Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((mes) => (
                        <option key={mes} value={mes}>
                          {String(mes).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Ano SISA</label>
                    <select
                      value={filtros.sisaAno}
                      onChange={(e) => atualizarFiltro('sisaAno', Number(e.target.value))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      {anosSisa.map((ano) => (
                        <option key={ano} value={ano}>
                          {ano}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Lancamento SISA</label>
                    <select
                      value={filtros.sisaStatusLancamento}
                      onChange={(e) => atualizarFiltro('sisaStatusLancamento', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      <option value="todos">Todos</option>
                      <option value="pendentes">Nao lancados / pendentes</option>
                      <option value="lancados">Lancados</option>
                    </select>
                  </div>
                </>
              )}

              {aba === 'acomodacoes' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status do leito</label>
                    <select
                      value={filtros.acomodacaoStatusLeito}
                      onChange={(e) => atualizarFiltro('acomodacaoStatusLeito', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      <option value="Todos">Todos</option>
                      <option value="Livre">Livres</option>
                      <option value="Ocupado">Ocupados</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Modalidade</label>
                    <select
                      value={filtros.acomodacaoModalidade}
                      onChange={(e) => atualizarFiltro('acomodacaoModalidade', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      <option value="Todas">Todas</option>
                      <option value="Fixo">Fixo</option>
                      <option value="Transitorio">Transitorio</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Publico</label>
                    <select
                      value={filtros.acomodacaoPublico}
                      onChange={(e) => atualizarFiltro('acomodacaoPublico', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      <option value="Todos">Todos</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Misto">Misto / Familias</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(filtrosAtivos.length > 0 ? filtrosAtivos : ['Sem filtros ativos']).map((filtro) => (
                <span
                  key={filtro}
                  className="text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
                >
                  {filtro}
                </span>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            <CardMetrica label="Conviventes ativos" valor={dados.ativos} detalhe={`${dados.totalConviventes} cadastrados no total`} />
            <CardMetrica label="Taxa de ocupacao" valor={`${dados.taxaOcupacao}%`} detalhe={`${dados.leitosOcupados}/${dados.totalLeitos} leitos ocupados`} />
            <CardMetrica label="Ocorrencias pendentes" valor={dados.ocorrenciasPendentes} detalhe={`${dados.ocorrenciasAltaCritica} alta/critica`} />
            <CardMetrica label="Avisos nao lidos" valor={dados.avisosNaoLidos} detalhe={`${dados.avisosTotal} avisos visiveis`} />
          </section>

          <section className="bg-white border border-gray-100 rounded-3xl shadow-sm p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              {ABAS_RELATORIOS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setAba(item.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-black border transition-colors ${
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
              Carregando central de relatorios...
            </div>
          ) : (
            <>
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {relatoriosAtuais.map((item) => (
                  <RelatorioCard key={item.titulo} item={item} />
                ))}
              </section>

              <section className="mt-6 bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <h2 className="text-base font-black text-gray-900">{dadosDetalhados.titulo}</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Esta é a tabela que será enviada para XLSX/PDF. Exibindo ate 30 registros na tela.
                    </p>
                  </div>

                  <span className="text-xs font-black text-brand bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
                    {linhasExportacao.length} registro(s)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {colunasExportacao.map((coluna) => (
                          <th key={coluna} className="text-left text-[10px] font-black uppercase tracking-wider text-gray-400 px-4 py-3">
                            {coluna}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {linhasExportacao.slice(0, 30).map((linha, index) => (
                        <tr key={`${aba}-${index}`} className="border-b border-gray-50 hover:bg-gray-50">
                          {colunasExportacao.map((coluna) => (
                            <td key={coluna} className="px-4 py-3 text-xs text-gray-700 align-top">
                              {linha[coluna] ?? '-'}
                            </td>
                          ))}
                        </tr>
                      ))}

                      {linhasExportacao.length === 0 && (
                        <tr>
                          <td colSpan={colunasExportacao.length} className="px-4 py-8 text-center text-sm text-gray-500">
                            Nenhum registro encontrado com os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
