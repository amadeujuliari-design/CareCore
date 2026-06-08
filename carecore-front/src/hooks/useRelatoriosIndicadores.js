import { useMemo } from 'react';

import {
  contar,
  normalizarPrioridade,
  porcentagem,
} from '../utils/relatoriosUtils';

export function useRelatoriosIndicadores({
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
  tecnicoId,
  tecnicos,
}) {
  const dados = useMemo(() => {
    const totalConviventes = conviventesFiltrados.length;
    const ativos = contar(conviventesFiltrados, (c) => c.status === 'Ativo');
    const ausenciasJustificadas = contar(conviventesFiltrados, (c) => c.status === 'Ausência justificada');
    const inativos = contar(conviventesFiltrados, (c) => c.status === 'Inativado');
    const saidasQualificadas = contar(conviventesFiltrados, (c) => c.status === 'Saída qualificada');
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

    const totalOcorrencias = resumoOcorrencias?.total ?? ocorrenciasFiltradas.length;
    const ocorrenciasPendentes = resumoOcorrencias?.pendentes ?? contar(ocorrenciasFiltradas, (o) => o.status_resolucao !== 'Resolvido');
    const ocorrenciasResolvidas = resumoOcorrencias?.resolvidas ?? contar(ocorrenciasFiltradas, (o) => o.status_resolucao === 'Resolvido');
    const ocorrenciasAltaCritica = resumoOcorrencias?.altaCriticaPendentes ?? contar(
      ocorrenciasFiltradas,
      (o) => ['Alta', 'Crítica'].includes(normalizarPrioridade(o.prioridade)) && o.status_resolucao !== 'Resolvido',
    );

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
      ausenciasJustificadas,
      inativos,
      saidasQualificadas,
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
      tecnicos: tecnicoId ? 1 : tecnicos.length,
      tecnicosComCasos,
      rotinaResumo,
      rotinaFiltradaResumo,
      auditoriaRotinaTotal: rotinaFiltradaResumo.editados + rotinaFiltradaResumo.cancelados + rotinaFiltradaResumo.retornosRapidos,
      avisosTotal: avisosFiltrados.length || resumoAvisos?.total_visiveis || 0,
      avisosNaoLidos: contar(avisosFiltrados, (a) => !a.lido),
    };
  }, [avisosFiltrados, conviventesFiltrados, historicoRotinaFiltrado, idsConviventesFiltrados, leitosAcomodacoesFiltrados, ocorrenciasFiltradas, quartos, resumoAvisos, resumoOcorrencias, rotinaOperacional, tecnicoId, tecnicos]);

  const relatoriosPorAba = useMemo(() => {
    return {
      conviventes: [
        {
          titulo: 'Relatório de conviventes',
          descricao: 'Status, técnico responsável, leito, origem e dados cadastrais relevantes.',
          status: 'pronto',
          metricas: [
            { label: 'Total', valor: dados.totalConviventes },
            { label: 'Ativos', valor: dados.ativos },
            { label: 'Ausências justificadas', valor: dados.ausenciasJustificadas },
            { label: 'Inativos', valor: dados.inativos },
            { label: 'Saídas qualificadas', valor: dados.saidasQualificadas },
          ],
        },
        {
          titulo: 'Relatório de permanência',
          descricao: 'Tempo médio na instituição, entradas, saídas, altas, transferências e evasões por período.',
          status: 'pronto',
          metricas: [
            { label: 'Ativos', valor: dados.ativos },
            { label: 'Ausências justificadas', valor: dados.ausenciasJustificadas },
            { label: 'Inativados', valor: dados.inativos },
            { label: 'Saídas qualificadas', valor: dados.saidasQualificadas },
            { label: 'Bloqueados', valor: dados.bloqueados },
          ],
        },
      ],
      rotina: [
        {
          titulo: 'Histórico da rotina',
          descricao: 'Entradas, saídas, almoços, edições, cancelamentos e retornos rápidos por filtros.',
          status: 'pronto',
          link: '/rotina/historico',
          metricas: [
            { label: 'Registros', valor: dados.rotinaFiltradaResumo.total },
            { label: 'Entradas', valor: dados.rotinaFiltradaResumo.entradas },
            { label: 'Saídas', valor: dados.rotinaFiltradaResumo.saidas },
            { label: 'Almoços', valor: dados.rotinaFiltradaResumo.almocos },
          ],
        },
        {
          titulo: 'Dashboard operacional',
          descricao: 'Situação atual dos acolhidos dentro/fora, sem movimento e auditoria do dia.',
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
          titulo: 'Relatório de ocorrências',
          descricao: 'Fila de chamados, pendências técnicas, criticidade, tipos e responsáveis.',
          status: 'pronto',
          link: '/ocorrencias',
          metricas: [
            { label: 'Total visível', valor: dados.totalOcorrencias },
            { label: 'Pendentes', valor: dados.ocorrenciasPendentes },
            { label: 'Resolvidas', valor: dados.ocorrenciasResolvidas },
            { label: 'Alta/Crítica', valor: dados.ocorrenciasAltaCritica },
          ],
        },
        {
          titulo: 'Relatório técnico por profissional',
          descricao: 'Casos do técnico, pendências, resoluções no período e tempo médio de atendimento.',
          status: 'pronto',
          metricas: [
            { label: 'Técnicos', valor: dados.tecnicos },
            { label: 'Pendências', valor: dados.ocorrenciasPendentes },
            { label: 'Resolvidas', valor: dados.ocorrenciasResolvidas },
            { label: 'Críticas', valor: dados.ocorrenciasAltaCritica },
          ],
        },
      ],
      acomodacoes: [
        {
          titulo: 'Relatório de acomodações',
          descricao: 'Quartos, leitos, ocupação, vagas livres e distribuição por acomodação.',
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
          titulo: 'Pendências de prontuário',
          descricao: 'Acolhidos sem foto, CPF, contato de emergência, número SISA, NIS ou documentação essencial.',
          status: 'pronto',
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
          titulo: 'Relatório de equipe',
          descricao: 'Usuários por perfil, técnicos ativos, carga de casos e estrutura institucional.',
          status: 'pronto',
          metricas: [
            { label: 'Técnicos', valor: dados.tecnicos },
            { label: 'Conviventes', valor: dados.totalConviventes },
            { label: 'Sem técnico', valor: dados.semTecnico },
            { label: 'Técnicos c/ casos', valor: dados.tecnicosComCasos },
          ],
        },
      ],
      auditoria: [
        {
          titulo: 'Relatório de auditoria',
          descricao: 'Eventos auditáveis da rotina: edições, cancelamentos e retornos rápidos com operador e justificativa.',
          status: 'pronto',
          metricas: [
            { label: 'Eventos', valor: dados.auditoriaRotinaTotal },
            { label: 'Editados', valor: dados.rotinaFiltradaResumo.editados },
            { label: 'Cancelados', valor: dados.rotinaFiltradaResumo.cancelados },
            { label: 'Retornos rápidos', valor: dados.rotinaFiltradaResumo.retornosRapidos },
          ],
        },
      ],
      evolucao: [
        {
          titulo: 'Evolução institucional',
          descricao: 'Gráficos leves para apresentação, impressão e análise executiva dos principais indicadores.',
          status: 'pronto',
          metricas: [
            { label: 'Atendimentos', valor: dados.rotinaFiltradaResumo.total },
            { label: 'Entradas', valor: dados.rotinaFiltradaResumo.entradas },
            { label: 'Ocorrências', valor: dados.totalOcorrencias },
            { label: 'Novos', valor: dados.totalConviventes },
          ],
        },
      ],
    };
  }, [dados]);

  const relatoriosAtuais = relatoriosPorAba[aba] || [];

  const cardsTopo = useMemo(() => {
    const cardsPorAba = {
      conviventes: [
        { label: 'Conviventes filtrados', valor: dados.totalConviventes, detalhe: `${dados.ativos} ativos` },
        { label: 'Saídas qualificadas', valor: dados.saidasQualificadas, detalhe: 'Conclusão positiva do processo' },
        { label: 'Sem técnico', valor: dados.semTecnico, detalhe: 'Pendência de vínculo técnico' },
        { label: 'Centro dia / sem leito', valor: dados.semLeitoAtivo, detalhe: 'Ativos sem acomodação fixa' },
        { label: 'Sem SISA', valor: dados.semSisa, detalhe: 'Cadastro incompleto para convênio' },
      ],
      rotina: [
        { label: 'Registros filtrados', valor: dados.rotinaFiltradaResumo.total, detalhe: 'Histórico da rotina' },
        { label: 'Entradas', valor: dados.rotinaFiltradaResumo.entradas, detalhe: `${dados.rotinaFiltradaResumo.saidas} saídas` },
        { label: 'Almoços', valor: dados.rotinaFiltradaResumo.almocos, detalhe: 'Registros de alimentação' },
        { label: 'Auditoria', valor: dados.auditoriaRotinaTotal, detalhe: 'Editados, cancelados e retornos' },
      ],
      ocorrencias: [
        { label: 'Ocorrências filtradas', valor: dados.totalOcorrencias, detalhe: 'Conforme filtros atuais' },
        { label: 'Pendentes', valor: dados.ocorrenciasPendentes, detalhe: `${dados.ocorrenciasAltaCritica} alta/crítica` },
        { label: 'Resolvidas', valor: dados.ocorrenciasResolvidas, detalhe: 'Com baixa técnica' },
        { label: 'Técnicos', valor: dados.tecnicos, detalhe: `${dados.tecnicosComCasos} com casos vinculados` },
      ],
      acomodacoes: [
        { label: 'Quartos filtrados', valor: dados.quartosAcomodacoes, detalhe: 'Conforme modalidade/público' },
        { label: 'Leitos filtrados', valor: dados.leitosAcomodacoesTotal, detalhe: `${dados.leitosAcomodacoesOcupados} ocupados` },
        { label: 'Livres', valor: dados.leitosAcomodacoesLivres, detalhe: 'Vagas disponíveis' },
        { label: 'Ocupação', valor: `${dados.taxaOcupacaoAcomodacoes}%`, detalhe: 'No recorte de acomodações' },
      ],
      documentacao: [
        { label: 'Sem foto', valor: dados.semFoto, detalhe: 'Prontuários filtrados' },
        { label: 'Sem CPF', valor: dados.semCpf, detalhe: 'Cadastro incompleto' },
        { label: 'Sem contato', valor: dados.semContato, detalhe: 'Contato de emergência' },
        { label: 'Sem SISA/NIS', valor: dados.semSisa + dados.semNis, detalhe: `${dados.semSisa} sem SISA, ${dados.semNis} sem NIS` },
      ],
      equipe: [
        { label: 'Técnicos/equipe', valor: dados.tecnicos, detalhe: 'Usuários técnicos visíveis' },
        { label: 'Com casos', valor: dados.tecnicosComCasos, detalhe: 'Técnicos vinculados a conviventes' },
        { label: 'Conviventes', valor: dados.totalConviventes, detalhe: 'No recorte atual' },
        { label: 'Sem técnico', valor: dados.semTecnico, detalhe: 'Aguardam vinculação' },
      ],
      auditoria: [
        { label: 'Eventos auditáveis', valor: dados.auditoriaRotinaTotal, detalhe: 'No recorte da rotina' },
        { label: 'Editados', valor: dados.rotinaFiltradaResumo.editados, detalhe: 'Registros corrigidos' },
        { label: 'Cancelados', valor: dados.rotinaFiltradaResumo.cancelados, detalhe: 'Cancelamentos lógicos' },
        { label: 'Retornos rápidos', valor: dados.rotinaFiltradaResumo.retornosRapidos, detalhe: 'Entradas após saída recente' },
      ],
      evolucao: [
        { label: 'Atendimentos', valor: dados.rotinaFiltradaResumo.total, detalhe: 'Registros da rotina no recorte' },
        { label: 'Entradas', valor: dados.rotinaFiltradaResumo.entradas, detalhe: `${dados.rotinaFiltradaResumo.saidas} saídas` },
        { label: 'Ocorrências', valor: dados.totalOcorrencias, detalhe: `${dados.ocorrenciasResolvidas} resolvidas` },
        { label: 'Novos acolhimentos', valor: dados.ativos, detalhe: 'Veja a evolução diária no gráfico' },
      ],
    };

    return cardsPorAba[aba] || cardsPorAba.conviventes;
  }, [aba, dados]);

  return {
    cardsTopo,
    dados,
    relatoriosAtuais,
    relatoriosPorAba,
  };
}
