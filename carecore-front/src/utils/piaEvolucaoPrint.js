import { obterConviventeProntuario } from '../services/conviventesProntuarioService';
import { formatarDadosConviventeParaTela } from './conviventesProntuarioUtils';

export function agruparRegistrosPiaConvivente(registrosDoConvivente = []) {
  const registrosPiaPrincipais = registrosDoConvivente
    .filter((registro) => !registro.registro_pai_id)
    .sort((a, b) => new Date(a.data_registro) - new Date(b.data_registro));

  const evolucoesPorRegistroPia = registrosDoConvivente
    .filter((registro) => registro.registro_pai_id)
    .reduce((acc, registro) => {
      const chave = registro.registro_pai_id;
      acc[chave] = [...(acc[chave] || []), registro];
      return acc;
    }, {});

  Object.keys(evolucoesPorRegistroPia).forEach((chave) => {
    evolucoesPorRegistroPia[chave].sort(
      (a, b) => new Date(a.data_registro) - new Date(b.data_registro),
    );
  });

  return { registrosPiaPrincipais, evolucoesPorRegistroPia };
}

export function montarItemPiaEvolucao(convivente, registrosDoConvivente = []) {
  const { registrosPiaPrincipais, evolucoesPorRegistroPia } = agruparRegistrosPiaConvivente(
    registrosDoConvivente,
  );

  return {
    convivente,
    registrosPiaPrincipais,
    evolucoesPorRegistroPia,
  };
}

export function montarConviventeResumoPia(registroReferencia, conviventeResumo) {
  if (conviventeResumo) {
    return formatarDadosConviventeParaTela(conviventeResumo);
  }

  return {
    id: registroReferencia?.convivente_id,
    nome_completo: registroReferencia?.convivente_nome_completo,
    nome_social: registroReferencia?.convivente_nome_social,
    numero_institucional: registroReferencia?.convivente_numero_institucional,
    status: registroReferencia?.convivente_status,
    tecnico_id: registroReferencia?.convivente_tecnico_id,
    numero_sisa: registroReferencia?.convivente_numero_sisa,
  };
}

export async function carregarConviventesParaPiaEvolucao({
  conviventeIds = [],
  conviventesResumo = [],
  modoCabecalho = 'completo',
  onProgress,
  tamanhoLote = 5,
}) {
  const mapaResumo = new Map(conviventesResumo.map((item) => [item.id, item]));
  const resultado = new Map();

  if (modoCabecalho !== 'completo') {
    conviventeIds.forEach((id) => {
      const resumo = mapaResumo.get(id);
      if (resumo) {
        resultado.set(id, formatarDadosConviventeParaTela(resumo));
      }
    });
    return resultado;
  }

  for (let indice = 0; indice < conviventeIds.length; indice += tamanhoLote) {
    const lote = conviventeIds.slice(indice, indice + tamanhoLote);
    const prontuarios = await Promise.all(
      lote.map((id) => obterConviventeProntuario(id).catch(() => mapaResumo.get(id) || null)),
    );

    prontuarios.forEach((prontuario, offset) => {
      const id = lote[offset];
      if (!prontuario) return;
      resultado.set(id, formatarDadosConviventeParaTela(prontuario));
    });

    if (onProgress) {
      onProgress({
        atual: Math.min(indice + lote.length, conviventeIds.length),
        total: conviventeIds.length,
      });
    }
  }

  return resultado;
}

export function montarItensPiaEvolucaoLote({
  conviventeIds = [],
  registrosPia = [],
  registrosPiaFiltrados = [],
  conviventesPorId = new Map(),
  conviventesResumo = [],
}) {
  const mapaResumo = new Map(conviventesResumo.map((item) => [item.id, item]));
  const registrosPorConvivente = new Map();

  registrosPia.forEach((registro) => {
    if (!conviventeIds.includes(registro.convivente_id)) return;
    const lista = registrosPorConvivente.get(registro.convivente_id) || [];
    lista.push(registro);
    registrosPorConvivente.set(registro.convivente_id, lista);
  });

  return conviventeIds
    .map((conviventeId) => {
      const registrosDoConvivente = registrosPorConvivente.get(conviventeId) || [];
      const registroReferencia = registrosPiaFiltrados.find(
        (registro) => registro.convivente_id === conviventeId,
      );
      const convivente = conviventesPorId.get(conviventeId)
        || montarConviventeResumoPia(registroReferencia, mapaResumo.get(conviventeId));

      return montarItemPiaEvolucao(convivente, registrosDoConvivente);
    })
    .sort((a, b) => String(a.convivente?.nome_social || a.convivente?.nome_completo || '').localeCompare(
      String(b.convivente?.nome_social || b.convivente?.nome_completo || ''),
      'pt-BR',
    ));
}
