export function normalizarCodigo(codigo) {
  return String(codigo || '').trim();
}

export function normalizarCpf(cpf) {
  return String(cpf || '').replace(/\D/g, '');
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
  if (!dataRegistro) return false;

  const momentoRegistro = new Date(dataRegistro).getTime();

  if (Number.isNaN(momentoRegistro)) {
    return false;
  }

  return agora - momentoRegistro <= 60 * 1000;
}

export function exigeJustificativaRetornoRapidoRotina(resumoHoje, conviventeId, tipoRegistro) {
  if (tipoRegistro !== 'Entrada') return false;

  const resumo = resumoHoje[conviventeId] || {};

  if (resumo.ultimo_movimento !== 'Saída' || !resumo.ultimo_movimento_data) {
    return false;
  }

  const dataUltimaSaida = new Date(resumo.ultimo_movimento_data).getTime();

  if (Number.isNaN(dataUltimaSaida)) {
    return false;
  }

  return Date.now() - dataUltimaSaida <= 10 * 60 * 1000;
}

export function filtrarConviventesRotina(conviventes, busca) {
  const termo = busca.toLowerCase();

  return conviventes.filter((convivente) => {
    const nome = (convivente.nome_social || convivente.nome_completo || '').toLowerCase();
    const cpf = convivente.cpf || '';
    const prontuario = convivente.numero_institucional ? String(convivente.numero_institucional) : '';

    return (
      nome.includes(termo) ||
      cpf.includes(busca) ||
      prontuario.includes(busca)
    );
  });
}

export function calcularResumoRotinaDiaria(conviventes, resumoHoje) {
  const totalAtivos = conviventes.length;
  const totalFora = Object.values(resumoHoje).filter((r) => r.ultimo_movimento === 'Saída').length;
  const totalDentro = totalAtivos - totalFora;
  const totalAlmocos = Object.values(resumoHoje).filter((r) => r.almocou).length;

  return {
    totalAtivos,
    totalFora,
    totalDentro,
    totalAlmocos,
  };
}
