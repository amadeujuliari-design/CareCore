import { filtrarOrdenarConviventesPorBusca } from './conviventeBuscaUtils.js';

export const TIPOS_ROTINA_REFEICOES = [
  'Café da manhã',
  'Almoço',
  'Jantar',
  'Lanche noturno',
];

export function perfilOcultaSomatoriaAlimentacao(perfil) {
  const normalizado = String(perfil || '').trim();
  return normalizado === 'Orientador' || normalizado === 'Técnico';
}

export function tipoRegistroAlimentacao(tipoRegistro) {
  return TIPOS_ROTINA_REFEICOES.includes(tipoRegistro);
}

export function filtrarContagensInteracaoSemAlimentacao(contagensPorTipo) {
  return Object.fromEntries(
    Object.entries(contagensPorTipo || {}).filter(
      ([tipo]) => !tipoRegistroAlimentacao(tipo),
    ),
  );
}

export function totalInteracoesSemAlimentacao(contagensPorTipo) {
  return Object.values(filtrarContagensInteracaoSemAlimentacao(contagensPorTipo)).reduce(
    (total, valor) => total + Number(valor || 0),
    0,
  );
}

export function obterPerfilUsuarioLogado() {
  try {
    const bruto = localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario');
    if (!bruto) return '';
    const usuario = JSON.parse(bruto);
    return usuario?.perfil_acesso || usuario?.perfil || '';
  } catch {
    return '';
  }
}

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

const TIPOS_INTERACAO_POR_GRUPO = {
  Cobertor: ['Retirada de Cobertor', 'Entrega de Cobertor'],
  Toalha: ['Retirada de Toalha', 'Entrega de Toalha'],
};

export function obterUltimaInteracaoGrupo(resumoConvivente, grupo) {
  const ultima = resumoConvivente?.ultimas_interacoes?.[grupo];
  if (ultima?.tipo_registro) {
    return ultima;
  }

  const tipos = TIPOS_INTERACAO_POR_GRUPO[grupo];
  if (!tipos) return null;

  const presencas = Array.isArray(resumoConvivente?.presencas) ? resumoConvivente.presencas : [];
  for (let indice = presencas.length - 1; indice >= 0; indice -= 1) {
    const registro = presencas[indice];
    if (tipos.includes(registro.tipo_registro)) {
      return registro;
    }
  }

  return null;
}

export function obterProximaInteracaoPar(resumoHoje, conviventeId, grupo) {
  const ultima = obterUltimaInteracaoGrupo(resumoHoje[conviventeId], grupo)?.tipo_registro || '';

  if (grupo === 'Toalha') {
    return ultima === 'Retirada de Toalha' ? 'Entrega de Toalha' : 'Retirada de Toalha';
  }

  if (grupo === 'Cobertor') {
    return ultima === 'Retirada de Cobertor' ? 'Entrega de Cobertor' : 'Retirada de Cobertor';
  }

  return null;
}

export function obterProximaMovimentacaoBagageiro(resumoHoje, conviventeId) {
  const ultima = resumoHoje[conviventeId]?.ultimas_interacoes?.Bagageiro;
  let movimentacao = String(ultima?.observacao || '').trim().toLowerCase();

  if (!movimentacao) {
    const presencas = Array.isArray(resumoHoje[conviventeId]?.presencas)
      ? resumoHoje[conviventeId].presencas
      : [];
    for (let indice = presencas.length - 1; indice >= 0; indice -= 1) {
      const registro = presencas[indice];
      if (registro.tipo_registro === 'Movimentação de Bagageiro' && registro.observacao) {
        movimentacao = String(registro.observacao).trim().toLowerCase();
        break;
      }
    }
  }

  if (movimentacao === 'entrada') {
    return 'Saída';
  }
  return 'Entrada';
}

export function obterRotuloBotaoInteracao(resumoHoje, conviventeId, interacaoSelecionada) {
  if (interacaoSelecionada === 'Cobertor') {
    const proxima = obterProximaInteracaoPar(resumoHoje, conviventeId, 'Cobertor');
    return proxima === 'Entrega de Cobertor' ? 'Entregar cobertor' : 'Retirar cobertor';
  }
  if (interacaoSelecionada === 'Toalha') {
    const proxima = obterProximaInteracaoPar(resumoHoje, conviventeId, 'Toalha');
    return proxima === 'Entrega de Toalha' ? 'Entregar toalha' : 'Retirar toalha';
  }
  if (interacaoSelecionada === 'Bagageiro') {
    const proxima = obterProximaMovimentacaoBagageiro(resumoHoje, conviventeId);
    return proxima === 'Saída' ? 'Retirar bagagem' : 'Guardar bagagem';
  }
  return 'Interação';
}

export function interacaoSelecionadaPermiteLeituraRepetida(interacaoSelecionada) {
  return ['Cobertor', 'Toalha', 'Bagageiro'].includes(interacaoSelecionada);
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
  const contagensInteracoes = Object.values(resumoHoje).reduce((acc, resumo) => {
    const presencas = Array.isArray(resumo?.presencas) ? resumo.presencas : [];
    presencas.forEach((registro) => {
      if (['Entrada', 'Saída'].includes(registro.tipo_registro)) return;
      acc[registro.tipo_registro] = (acc[registro.tipo_registro] || 0) + 1;
    });
    return acc;
  }, {});
  const totalInteracoesRotina = Object.values(contagensInteracoes).reduce(
    (total, valor) => total + Number(valor || 0),
    0,
  );

  return {
    totalAtivos,
    totalFora,
    totalDentro,
    totalAlmocos,
    totalInteracoesRotina,
    contagensInteracoes,
  };
}
