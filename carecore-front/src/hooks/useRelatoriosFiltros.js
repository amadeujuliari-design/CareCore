import { useMemo } from 'react';

import {
  campoTexto,
  dataDentroDoPeriodo,
  normalizarPrioridade,
} from '../utils/relatoriosUtils';

export function useRelatoriosFiltros({
  avisos,
  conviventes,
  equipe = [],
  filtros,
  historicoRotina,
  ocorrencias,
  ordenacaoAcomodacoes,
  quartos,
  registrosPia = [],
  tecnicos = [],
}) {
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

  const conviventesPorId = useMemo(
    () => new Map(conviventes.map((convivente) => [convivente.id, convivente])),
    [conviventes],
  );

  const usuariosPorId = useMemo(
    () => new Map([...tecnicos, ...equipe].map((usuario) => [usuario.id, usuario])),
    [equipe, tecnicos],
  );

  const ocorrenciasFiltradas = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();

    return ocorrencias.filter((ocorrencia) => {
      const convivente = conviventesPorId.get(ocorrencia.convivente_id);
      const tecnico = usuariosPorId.get(ocorrencia.tecnico_responsavel_id);

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

      if (filtros.statusConvivente !== 'Todos' && convivente?.status !== filtros.statusConvivente) {
        return false;
      }

      if (termo) {
        const texto = [
          campoTexto(ocorrencia, [
            'tipo_ocorrencia',
            'motivo',
            'descricao',
            'parecer_tecnico',
            'prioridade',
            'status_resolucao',
            'convivente_nome',
            'convivente_numero_institucional',
          ]),
          campoTexto(convivente, ['nome_completo', 'nome_social', 'cpf', 'numero_sisa', 'numero_nis']),
          campoTexto(tecnico, ['nome', 'perfil_acesso']),
        ].join(' ');

        if (!texto.includes(termo)) return false;
      }

      return true;
    });
  }, [conviventesPorId, filtros, ocorrencias, usuariosPorId]);

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

  const leitosAcomodacoesFiltrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();

    const linhas = quartos.flatMap((quarto) => {
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

    return linhas.sort((a, b) => {
      if (ordenacaoAcomodacoes === 'status') {
        return String(a.leito.status || 'Livre').localeCompare(String(b.leito.status || 'Livre'));
      }
      if (ordenacaoAcomodacoes === 'convivente') {
        const nomeA = a.convivente?.nome_social || a.convivente?.nome_completo || a.leito.convivente_nome_completo || '';
        const nomeB = b.convivente?.nome_social || b.convivente?.nome_completo || b.leito.convivente_nome_completo || '';
        return nomeA.localeCompare(nomeB);
      }
      if (ordenacaoAcomodacoes === 'modalidade') {
        return String(a.quarto.modalidade || '').localeCompare(String(b.quarto.modalidade || ''));
      }

      const quartoComparacao = String(a.quarto.nome || '').localeCompare(String(b.quarto.nome || ''));
      if (quartoComparacao !== 0) return quartoComparacao;
      return String(a.leito.identificacao || '').localeCompare(String(b.leito.identificacao || ''));
    });
  }, [conviventes, filtros, ordenacaoAcomodacoes, quartos]);

  const registrosPiaFiltrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    const tema = filtros.temaPia.trim().toLowerCase();

    return registrosPia.filter((registro) => {
      const convivente = conviventesPorId.get(registro.convivente_id);
      const tecnico = usuariosPorId.get(registro.convivente_tecnico_id || convivente?.tecnico_id);
      const usuarioRegistro = usuariosPorId.get(registro.usuario_id);
      const tipoRegistro = registro.registro_pai_id ? 'Evolução' : 'PIA principal';

      if (!dataDentroDoPeriodo(registro.data_registro, filtros.dataInicio, filtros.dataFim)) {
        return false;
      }

      if (filtros.tecnicoId && (registro.convivente_tecnico_id || convivente?.tecnico_id) !== filtros.tecnicoId) {
        return false;
      }

      if (filtros.statusConvivente !== 'Todos' && (registro.convivente_status || convivente?.status) !== filtros.statusConvivente) {
        return false;
      }

      if (filtros.tipoPia !== 'Todos' && tipoRegistro !== filtros.tipoPia) {
        return false;
      }

      if (filtros.statusPia !== 'Todos' && registro.status !== filtros.statusPia) {
        return false;
      }

      if (tema) {
        const textoTema = campoTexto(registro, ['subtitulo', 'titulo', 'descricao', 'objetivos', 'encaminhamentos']);
        if (!textoTema.includes(tema)) return false;
      }

      if (termo) {
        const texto = [
          campoTexto(registro, ['titulo', 'subtitulo', 'descricao', 'objetivos', 'encaminhamentos', 'status']),
          campoTexto(convivente, ['nome_completo', 'nome_social', 'cpf', 'numero_sisa', 'numero_nis']),
          String(registro.convivente_numero_institucional || convivente?.numero_institucional || ''),
          campoTexto(tecnico, ['nome', 'perfil_acesso']),
          campoTexto(usuarioRegistro, ['nome', 'perfil_acesso']),
          registro.usuario_nome || '',
          tipoRegistro,
        ].join(' ').toLowerCase();

        if (!texto.includes(termo)) return false;
      }

      return true;
    });
  }, [conviventesPorId, filtros, registrosPia, usuariosPorId]);

  return {
    avisosFiltrados,
    conviventesFiltrados,
    historicoRotinaFiltrado,
    idsConviventesFiltrados,
    leitosAcomodacoesFiltrados,
    ocorrenciasFiltradas,
    registrosPiaFiltrados,
  };
}
