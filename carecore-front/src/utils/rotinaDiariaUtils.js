import { filtrarOrdenarConviventesPorBusca } from './conviventeBuscaUtils.js';

export function normalizarCodigo(codigo) {
  return String(codigo || '').trim();
}

export function normalizarCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
}

export function obterCodigoCarteirinhaConvivente(convivente) {
  if (!convivente) return '';

  if (convivente.numero_institucional) {
    return String(convivente.numero_institucional);
  }

  if (convivente.cpf) {
    return normalizarCpf(convivente.cpf);
  }

  return String(convivente.id || '').substring(0, 8);
}

export function tocarBeep() {
  try {
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch {
    // Alguns navegadores bloqueiam áudio automático.
  }
}

export function getFotoUrl(convivente) {
  if (!convivente?.foto_url) return null;
  return convivente.foto_url;
}

export function criarItemHistoricoLeitura({
  convivente,
  tipo,
  status = 'Sucesso',
  mensagem = '',
  registroId = null,
  retornoRapido = false,
  dataRegistro = null,
  desfazerExpiraEm = null,
}) {
  return {
    id: `${Date.now()}-${Math.random()}`,
    nome: convivente?.nome_social || convivente?.nome_completo || 'Acolhido',
    prontuario: convivente?.numero_institucional || 'S/N',
    tipo,
    status,
    mensagem,
    registroId,
    retornoRapido,
    dataRegistro,
    desfazerExpiraEm,
    horario: new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function definirAcaoAutomaticaRotina(resumoHoje, conviventeId) {
  const resumo = resumoHoje[conviventeId] || {};
  const isFora = resumo.ultimo_movimento === 'Saída';
  return isFora ? 'Entrada' : 'Saída';
}

export function registroAindaPodeSerDesfeitoRotina(dataRegistro, agora = Date.now()) {
  if (typeof dataRegistro === 'number') {
    return agora <= dataRegistro;
  }

  if (!dataRegistro) return false;

  const momentoRegistro = new Date(dataRegistro).getTime();

  if (Number.isNaN(momentoRegistro)) {
    return false;
  }

  return agora - momentoRegistro <= 60 * 1000;
}

export function exigeJustificativaRetornoRapidoRotina(resumoHoje, conviventeId, tipoRegistro) {
  if (!['Entrada', 'Saída'].includes(tipoRegistro)) return false;

  const resumo = resumoHoje[conviventeId] || {};

  if (
    !['Entrada', 'Saída'].includes(resumo.ultimo_movimento) ||
    resumo.ultimo_movimento === tipoRegistro ||
    !resumo.ultimo_movimento_data
  ) {
    return false;
  }

  const dataUltimaSaida = new Date(resumo.ultimo_movimento_data).getTime();

  if (Number.isNaN(dataUltimaSaida)) {
    return false;
  }

  return Date.now() - dataUltimaSaida <= 10 * 60 * 1000;
}

export function filtrarConviventesRotina(conviventes, busca) {
  return filtrarOrdenarConviventesPorBusca(conviventes, busca);
}

export function calcularResumoRotinaDiaria(conviventes, resumoHoje) {
  const totalAtivos = conviventes.length;
  const totalFora = Object.values(resumoHoje).filter((r) => r.ultimo_movimento === 'Saída').length;
  const totalDentro = totalAtivos - totalFora;
  const totalAlmocos = Object.values(resumoHoje).reduce((total, resumo) => {
    const almoco = resumo?.refeicoes?.Almoço;
    const registros = Array.isArray(almoco?.registros) ? almoco.registros : [];
    const quantidade = Number(almoco?.quantidade ?? registros.length);

    if (quantidade > 0) {
      return total + quantidade;
    }

    const presencas = Array.isArray(resumo?.presencas) ? resumo.presencas : [];
    return total + presencas.filter((registro) => registro.tipo_registro === 'Almoço').length;
  }, 0);
  const totalInteracoesRotina = Object.values(resumoHoje).reduce((total, resumo) => {
    const presencas = Array.isArray(resumo?.presencas) ? resumo.presencas : [];
    return total + presencas.filter((registro) => !['Entrada', 'Saída'].includes(registro.tipo_registro)).length;
  }, 0);

  return {
    totalAtivos,
    totalFora,
    totalDentro,
    totalAlmocos,
    totalInteracoesRotina,
  };
}
