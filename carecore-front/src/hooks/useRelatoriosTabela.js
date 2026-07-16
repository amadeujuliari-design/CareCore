import { useMemo } from 'react';

import {
  contar,
  formatarData,
  formatarDataHora,
  normalizarPrioridade,
  tecnicoIdEspecificoRelatorios,
} from '../utils/relatoriosUtils';
import { formatarCPF } from '../utils/conviventesUtils';

const COLUNAS_RESUMO_RELATORIOS = ['Relatório', 'Status', 'Métrica', 'Valor', 'Descrição'];

export function useRelatoriosTabela({
  aba,
  conviventes,
  conviventesFiltrados,
  dadosEvolucao,
  equipe = [],
  filtros,
  historicoRotinaFiltrado,
  leitosAcomodacoesFiltrados,
  ocorrenciasFiltradas,
  incluirTextoOriginalOcorrencias = false,
  paginaTabela,
  relatoriosAtuais,
  registrosPiaFiltrados = [],
  resumoPendenciasTecnicasEvolucao,
  setPaginaTabela,
  tecnicoPendenciasSelecionadoNome,
  tecnicos,
  totalNovosAcolhimentosEvolucao,
  quartos,
  itensPorPaginaTabela = 20,
}) {
  const mapaTecnicos = useMemo(() => {
    return new Map(tecnicos.map((tecnico) => [tecnico.id, tecnico.nome]));
  }, [tecnicos]);

  const mapaEquipe = useMemo(() => {
    return new Map([...tecnicos, ...equipe].map((usuario) => [usuario.id, usuario.nome]));
  }, [equipe, tecnicos]);

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

    const listarPendenciasConvivente = (convivente) => {
      const pendencias = [];

      if (!convivente.foto_url) pendencias.push('Foto');
      if (!convivente.cpf) pendencias.push('CPF');
      if (!convivente.tecnico_id) pendencias.push('Técnico');
      if (!convivente.numero_sisa) pendencias.push('SISA');

      return pendencias;
    };

    const textoLeitoConvivente = (leitoId) => {
      const texto = mapaLeitos.get(leitoId) || 'Centro dia / sem leito';
      if (texto === 'Centro dia / sem leito') return 'Centro dia';
      return texto;
    };

    const montarLinhaConvivente = (convivente) => {
      const pendencias = listarPendenciasConvivente(convivente);
      const cpfFormatado = convivente.cpf
        ? formatarCPF(String(convivente.cpf).replace(/\D/g, ''))
        : '-';

      return {
        Prontuário: convivente.numero_institucional ? `#${convivente.numero_institucional}` : 'S/N',
        Nome: convivente.nome_social || convivente.nome_completo || '-',
        Status: convivente.status || '-',
        Técnico: mapaTecnicos.get(convivente.tecnico_id) || 'Sem técnico',
        Entrada: formatarData(convivente.data_entrada),
        Leito: textoLeitoConvivente(convivente.leito_id),
        CPF: cpfFormatado,
        Cidade: convivente.cidade || '-',
        'Ocorrências pendentes': contarOcorrenciasPendentesConvivente(convivente.id),
        'Pendências de cadastro': pendencias.length,
        'Quais pendências': pendencias.length ? pendencias.join(', ') : 'Completo',
      };
    };

    if (aba === 'conviventes') {
      return {
        titulo: 'Conviventes filtrados',
        colunas: tecnicoIdEspecificoRelatorios(filtros.tecnicoId)
          ? ['Prontuário', 'Nome', 'Status', 'Entrada', 'Leito', 'CPF', 'Cidade', 'Ocorrências pendentes', 'Pendências de cadastro', 'Quais pendências']
          : ['Prontuário', 'Nome', 'Status', 'Técnico', 'Entrada', 'Leito', 'CPF', 'Cidade', 'Ocorrências pendentes', 'Pendências de cadastro', 'Quais pendências'],
        linhas: conviventesFiltrados.map(montarLinhaConvivente),
      };
    }

    if (aba === 'ocorrencias') {
      const colunas = ['Data', 'Convivente', 'Tipo', 'Motivo', 'Prioridade', 'Status', 'Técnico', 'Descrição'];
      if (incluirTextoOriginalOcorrencias) {
        colunas.push('Motivo original', 'Descrição original');
      }

      return {
        titulo: 'Ocorrências filtradas',
        colunas,
        linhas: ocorrenciasFiltradas.map((ocorrencia) => {
          const convivente = conviventes.find((c) => c.id === ocorrencia.convivente_id);

          const linha = {
            Data: formatarDataHora(ocorrencia.data_ocorrencia),
            Convivente: convivente?.nome_social || convivente?.nome_completo || '-',
            Tipo: ocorrencia.tipo_ocorrencia || '-',
            Motivo: ocorrencia.motivo || '-',
            Prioridade: normalizarPrioridade(ocorrencia.prioridade),
            Status: ocorrencia.status_resolucao || '-',
            Técnico: mapaTecnicos.get(ocorrencia.tecnico_responsavel_id) || 'Sem técnico',
            Descrição: ocorrencia.descricao || '-',
          };

          if (incluirTextoOriginalOcorrencias) {
            linha['Motivo original'] = ocorrencia.motivo_original || '-';
            linha['Descrição original'] = ocorrencia.descricao_original || '-';
          }

          return linha;
        }),
      };
    }

    if (aba === 'pia') {
      const colunas = tecnicoIdEspecificoRelatorios(filtros.tecnicoId)
        ? ['Data/Hora', 'Prontuário', 'Convivente', 'Tipo', 'Título/Tema', 'Status', 'Registrado por', 'Descrição', 'Objetivos', 'Encaminhamentos']
        : ['Data/Hora', 'Prontuário', 'Convivente', 'Técnico', 'Tipo', 'Título/Tema', 'Status', 'Registrado por', 'Descrição', 'Objetivos', 'Encaminhamentos'];

      return {
        titulo: 'Registros PIA filtrados',
        colunas,
        linhas: registrosPiaFiltrados.map((registro) => {
          const tipo = registro.registro_pai_id ? 'Evolução' : 'PIA principal';
          const linha = {
            'Data/Hora': formatarDataHora(registro.data_registro),
            Prontuário: registro.convivente_numero_institucional ? `#${registro.convivente_numero_institucional}` : 'S/N',
            Convivente: registro.convivente_nome_social || registro.convivente_nome_completo || '-',
            Tipo: tipo,
            'Título/Tema': registro.registro_pai_id ? (registro.subtitulo || '-') : (registro.titulo || '-'),
            Status: registro.status || '-',
            'Registrado por': registro.usuario_nome || mapaEquipe.get(registro.usuario_id) || '-',
            Descrição: registro.descricao || '-',
            Objetivos: registro.objetivos || '-',
            Encaminhamentos: registro.encaminhamentos || '-',
          };

          if (!tecnicoIdEspecificoRelatorios(filtros.tecnicoId)) {
            linha.Técnico = mapaEquipe.get(registro.convivente_tecnico_id) || 'Sem técnico';
          }

          return linha;
        }),
      };
    }

    if (aba === 'rotina') {
      return {
        titulo: 'Histórico da rotina filtrado',
        colunas: ['Data/Hora', 'Prontuário', 'Convivente', 'Tipo', 'Operador', 'Status', 'Retorno rápido', 'Auditoria/Observação'],
        linhas: historicoRotinaFiltrado.map((registro) => {
          const status = [
            registro.cancelado ? 'Cancelado' : 'Ativo',
            registro.foi_editado ? 'Editado' : '',
          ].filter(Boolean).join(' / ');

          return {
            'Data/Hora': formatarDataHora(registro.data_registro),
            Prontuário: registro.numero_institucional ? `#${registro.numero_institucional}` : 'S/N',
            Convivente: registro.convivente_nome || registro.convivente_nome_completo || '-',
            Tipo: registro.tipo_registro || '-',
            Operador: registro.usuario_nome || '-',
            Status: status || '-',
            'Retorno rápido': registro.retorno_rapido ? 'Sim' : 'Não',
            'Auditoria/Observação': [
              registro.justificativa_horario_portaria,
              registro.justificativa_retorno_rapido,
              registro.motivo_edicao,
              registro.motivo_cancelamento,
            ].filter(Boolean).join(' | ') || '-',
          };
        }),
      };
    }

    if (aba === 'acomodacoes') {
      const colunas = tecnicoIdEspecificoRelatorios(filtros.tecnicoId)
        ? ['Quarto', 'Modalidade', 'Público', 'Leito', 'Status leito', 'Convivente', 'Prontuário', 'Status convivente']
        : ['Quarto', 'Modalidade', 'Público', 'Leito', 'Status leito', 'Convivente', 'Prontuário', 'Status convivente', 'Técnico'];

      return {
        titulo: 'Acomodações e leitos',
        colunas,
        linhas: leitosAcomodacoesFiltrados.map(({ quarto, leito, convivente }) => {
          const linha = {
            Quarto: quarto.nome || '-',
            Modalidade: quarto.modalidade === 'Transitorio' ? 'Transitório' : quarto.modalidade || '-',
            Público: quarto.tipo_publico || '-',
            Leito: leito.identificacao || '-',
            'Status leito': leito.status || 'Livre',
            Convivente: convivente?.nome_social || convivente?.nome_completo || leito.convivente_nome_completo || leito.convivente_nome || '-',
            Prontuário: convivente?.numero_institucional || leito.numero_institucional
              ? `#${convivente?.numero_institucional || leito.numero_institucional}`
              : '-',
            'Status convivente': convivente?.status || (leito.status === 'Ocupado' ? 'Ocupado sem vinculo cadastral' : '-'),
          };

          if (!tecnicoIdEspecificoRelatorios(filtros.tecnicoId)) {
            linha.Técnico = mapaTecnicos.get(convivente?.tecnico_id) || (convivente ? 'Sem técnico' : '-');
          }

          return linha;
        }),
      };
    }

    if (aba === 'documentacao') {
      const colunas = tecnicoIdEspecificoRelatorios(filtros.tecnicoId)
        ? ['Prontuário', 'Nome', 'Status', 'N SISA', 'NIS', 'Sem foto', 'Sem CPF', 'Sem SISA']
        : ['Prontuário', 'Nome', 'Status', 'Técnico', 'N SISA', 'NIS', 'Sem foto', 'Sem CPF', 'Sem SISA'];

      return {
        titulo: 'Pendências documentais filtradas',
        colunas,
        linhas: conviventesFiltrados.map((convivente) => {
          const linha = {
            Prontuário: convivente.numero_institucional ? `#${convivente.numero_institucional}` : 'S/N',
            Nome: convivente.nome_social || convivente.nome_completo || '-',
            Status: convivente.status || '-',
            'N SISA': convivente.numero_sisa || '-',
            NIS: convivente.numero_nis || '-',
            'Sem foto': convivente.foto_url ? 'Não' : 'Sim',
            'Sem CPF': convivente.cpf ? 'Não' : 'Sim',
            'Sem SISA': convivente.numero_sisa ? 'Não' : 'Sim',
          };

          if (!tecnicoIdEspecificoRelatorios(filtros.tecnicoId)) {
            linha.Técnico = mapaTecnicos.get(convivente.tecnico_id) || 'Sem técnico';
          }

          return linha;
        }),
      };
    }

    if (aba === 'equipe') {
      const termoEquipe = filtros.busca.trim().toLowerCase();
      const equipeVisivel = termoEquipe
        ? equipe.filter((usuario) => [
          usuario.nome,
          usuario.perfil_acesso,
          usuario.email,
        ].join(' ').toLowerCase().includes(termoEquipe))
        : equipe;

      return {
        titulo: 'Equipe e carga de casos',
        colunas: ['Usuário', 'Perfil', 'Conviventes vinculados', 'Ocorrências pendentes'],
        linhas: equipeVisivel.map((usuario) => ({
          Usuário: usuario.nome || '-',
          Perfil: usuario.perfil_acesso || '-',
          'Conviventes vinculados': contar(conviventesFiltrados, (c) => c.tecnico_id === usuario.id),
          'Ocorrências pendentes': contar(ocorrenciasFiltradas, (o) => o.tecnico_responsavel_id === usuario.id && o.status_resolucao !== 'Resolvido'),
        })),
      };
    }

    if (aba === 'auditoria') {
      const colunas = tecnicoIdEspecificoRelatorios(filtros.tecnicoId)
        ? ['Data/Hora', 'Evento', 'Prontuário', 'Convivente', 'Registro', 'Operador', 'Justificativa/Motivo']
        : ['Data/Hora', 'Evento', 'Prontuário', 'Convivente', 'Técnico', 'Registro', 'Operador', 'Justificativa/Motivo'];

      const linhas = historicoRotinaFiltrado.flatMap((registro) => {
        const convivente = conviventes.find((c) => c.id === registro.convivente_id);
        const base = {
          'Data/Hora': formatarDataHora(registro.data_registro),
          Prontuário: registro.numero_institucional || convivente?.numero_institucional
            ? `#${registro.numero_institucional || convivente?.numero_institucional}`
            : 'S/N',
          Convivente: registro.convivente_nome || registro.convivente_nome_completo || convivente?.nome_social || convivente?.nome_completo || '-',
          Registro: registro.tipo_registro || '-',
          Operador: registro.usuario_nome || '-',
        };

        if (!tecnicoIdEspecificoRelatorios(filtros.tecnicoId)) {
          base.Técnico = mapaTecnicos.get(convivente?.tecnico_id) || (convivente ? 'Sem técnico' : '-');
        }

        const eventos = [];

        if (registro.foi_editado) {
          eventos.push({
            ...base,
            Evento: 'Edição',
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
            Evento: 'Retorno rápido',
            'Justificativa/Motivo': [
              registro.justificativa_horario_portaria,
              registro.justificativa_retorno_rapido,
            ].filter(Boolean).join(' | ') || '-',
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

    if (aba === 'evolucao') {
      return {
        titulo: 'Indicadores de evolução',
        colunas: ['Indicador', 'Valor', 'Observação'],
        linhas: [
          { Indicador: 'Atendimentos no período', Valor: dadosEvolucao.totalAtendimentos, Observação: `Média diária ${dadosEvolucao.mediaDiaria}, pico ${dadosEvolucao.pico}` },
          { Indicador: 'Tendência de atendimento', Valor: dadosEvolucao.tendencia, Observação: 'Comparação entre primeira e segunda metade do recorte' },
          { Indicador: 'Novos acolhimentos', Valor: totalNovosAcolhimentosEvolucao, Observação: 'Entradas cadastrais no período filtrado' },
          {
            Indicador: 'Pendências técnicas',
            Valor: resumoPendenciasTecnicasEvolucao.saldo,
            Observação: `${resumoPendenciasTecnicasEvolucao.abertas} abertas e ${resumoPendenciasTecnicasEvolucao.resolvidas} resolvidas para ${tecnicoPendenciasSelecionadoNome}`,
          },
        ],
      };
    }

    return {
      titulo: 'Resumo da aba',
      colunas: COLUNAS_RESUMO_RELATORIOS,
      linhas: relatoriosAtuais.flatMap((relatorio) =>
        (relatorio.metricas || []).map((metrica) => ({
          Relatório: relatorio.titulo,
          Status: relatorio.status,
          Métrica: metrica.label,
          Valor: metrica.valor,
          Descrição: relatorio.descricao,
        }))
      ),
    };
  }, [aba, conviventes, conviventesFiltrados, dadosEvolucao.mediaDiaria, dadosEvolucao.pico, dadosEvolucao.tendencia, dadosEvolucao.totalAtendimentos, equipe, filtros.tecnicoId, historicoRotinaFiltrado, incluirTextoOriginalOcorrencias, leitosAcomodacoesFiltrados, mapaEquipe, mapaLeitos, mapaTecnicos, ocorrenciasFiltradas, registrosPiaFiltrados, relatoriosAtuais, resumoPendenciasTecnicasEvolucao, tecnicoPendenciasSelecionadoNome, tecnicos, totalNovosAcolhimentosEvolucao]);

  const linhasResumoMetricas = relatoriosAtuais.flatMap((relatorio) =>
    (relatorio.metricas || []).map((metrica) => ({
      Relatório: relatorio.titulo,
      Status: relatorio.status,
      Métrica: metrica.label,
      Valor: metrica.valor,
      Descrição: relatorio.descricao,
    }))
  );

  const linhasExportacao = dadosDetalhados.linhas || linhasResumoMetricas;
  const colunasExportacao = dadosDetalhados.colunas || COLUNAS_RESUMO_RELATORIOS;
  const totalPaginasTabela = Math.max(1, Math.ceil(linhasExportacao.length / itensPorPaginaTabela));
  const paginaTabelaSegura = Math.min(paginaTabela, totalPaginasTabela);
  const inicioTabela = (paginaTabelaSegura - 1) * itensPorPaginaTabela;
  const fimTabela = inicioTabela + itensPorPaginaTabela;
  const linhasTabelaPaginadas = linhasExportacao.slice(inicioTabela, fimTabela);

  const irParaPaginaTabela = (novaPagina) => {
    setPaginaTabela(Math.min(Math.max(novaPagina, 1), totalPaginasTabela));
  };

  return {
    colunasExportacao,
    dadosDetalhados,
    fimTabela,
    inicioTabela,
    irParaPaginaTabela,
    linhasExportacao,
    linhasTabelaPaginadas,
    paginaTabelaSegura,
    totalPaginasTabela,
  };
}
