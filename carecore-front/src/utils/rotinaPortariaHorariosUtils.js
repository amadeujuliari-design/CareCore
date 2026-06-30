export const HORA_SAIDA_PADRAO = '17:00';
export const HORA_ENTRADA_PADRAO = '19:00';
export const HORA_ENTRADA_APOS_PERNOITE_FORA = '11:00';
export const HORA_MOVIMENTO_PERNOITE_DENTRO = '04:00';
export const MIN_CARACTERES_JUSTIFICATIVA_HORARIO = 30;

export const MOTIVOS_EXCECAO_PORTARIA = [
  { valor: '', rotulo: 'Sem exceção (regra padrão)' },
  { valor: 'estudante', rotulo: 'Estudante' },
  { valor: 'trabalho', rotulo: 'Trabalho' },
  { valor: 'saude', rotulo: 'Saúde' },
  { valor: 'eventual', rotulo: 'Eventual' },
];

function parseHora(valor) {
  if (!valor) return null;
  const partes = String(valor).trim().split(':');
  if (partes.length < 2) return null;
  const hora = Number(partes[0]);
  const minuto = Number(partes[1]);
  if (Number.isNaN(hora) || Number.isNaN(minuto)) return null;
  return hora * 60 + minuto;
}

function horaAtualMinutos(data = new Date()) {
  return data.getHours() * 60 + data.getMinutes();
}

export function obterLimitesHorarioPortaria(convivente = {}) {
  const motivo = String(convivente.portaria_excecao_motivo || '').trim().toLowerCase();
  if (['estudante', 'trabalho', 'saude', 'eventual'].includes(motivo)) {
    return {
      saidaAte: convivente.portaria_excecao_saida_ate || HORA_SAIDA_PADRAO,
      entradaAte: convivente.portaria_excecao_entrada_ate || HORA_ENTRADA_PADRAO,
      comExcecao: true,
    };
  }
  return {
    saidaAte: HORA_SAIDA_PADRAO,
    entradaAte: HORA_ENTRADA_PADRAO,
    comExcecao: false,
  };
}

export function pernoitouFora(ultimoMovimento, momento = new Date()) {
  if (!ultimoMovimento || ultimoMovimento.tipo_registro !== 'Saída') return false;
  const dataUltimo = new Date(ultimoMovimento.data_registro);
  return (
    dataUltimo.getFullYear() < momento.getFullYear()
    || dataUltimo.getMonth() < momento.getMonth()
    || dataUltimo.getDate() < momento.getDate()
  );
}

export function pernoitouDentro(ultimoMovimento, momento = new Date()) {
  if (!ultimoMovimento || ultimoMovimento.tipo_registro !== 'Entrada') return false;
  const dataUltimo = new Date(ultimoMovimento.data_registro);
  return (
    dataUltimo.getFullYear() < momento.getFullYear()
    || dataUltimo.getMonth() < momento.getMonth()
    || dataUltimo.getDate() < momento.getDate()
  );
}

export function validarHorarioPortaria({
  tipoRegistro,
  convivente,
  ultimoMovimento,
  justificativaHorario = '',
  momento = new Date(),
}) {
  if (!['Entrada', 'Saída'].includes(tipoRegistro)) {
    return null;
  }

  const minutosAtuais = horaAtualMinutos(momento);
  const justificativa = String(justificativaHorario || '').trim();

  if (pernoitouFora(ultimoMovimento, momento) && tipoRegistro === 'Entrada') {
    const limite = parseHora(HORA_ENTRADA_APOS_PERNOITE_FORA);
    if (minutosAtuais < limite) {
      return {
        bloqueado: true,
        exigeJustificativa: false,
        mensagem:
          'Este convivente pernoitou fora da unidade. A entrada só pode ser registrada a partir das 11:00.',
      };
    }
  }

  if (pernoitouDentro(ultimoMovimento, momento)) {
    const limite = parseHora(HORA_MOVIMENTO_PERNOITE_DENTRO);
    if (minutosAtuais < limite) {
      return {
        bloqueado: true,
        exigeJustificativa: false,
        mensagem:
          'Este convivente pernoitou dentro da unidade. Saída e entrada só podem ser registradas a partir das 04:00.',
      };
    }
  }

  const { saidaAte, entradaAte } = obterLimitesHorarioPortaria(convivente);

  if (tipoRegistro === 'Saída' && minutosAtuais > parseHora(saidaAte)) {
    if (justificativa.length < MIN_CARACTERES_JUSTIFICATIVA_HORARIO) {
      return {
        bloqueado: true,
        exigeJustificativa: true,
        mensagem: `Saída após ${saidaAte} exige justificativa de no mínimo ${MIN_CARACTERES_JUSTIFICATIVA_HORARIO} caracteres.`,
        limiteHorario: saidaAte,
      };
    }
    return { bloqueado: false, justificativaHorario: justificativa };
  }

  if (tipoRegistro === 'Entrada' && minutosAtuais > parseHora(entradaAte)) {
    if (justificativa.length < MIN_CARACTERES_JUSTIFICATIVA_HORARIO) {
      return {
        bloqueado: true,
        exigeJustificativa: true,
        mensagem: `Entrada após ${entradaAte} exige justificativa de no mínimo ${MIN_CARACTERES_JUSTIFICATIVA_HORARIO} caracteres.`,
        limiteHorario: entradaAte,
      };
    }
    return { bloqueado: false, justificativaHorario: justificativa };
  }

  return null;
}

export function mensagemIndicaJustificativaHorarioPortaria(mensagem) {
  const texto = String(mensagem || '').toLowerCase();
  return (
    texto.includes('justificativa')
    && (texto.includes('saída após') || texto.includes('saida apos') || texto.includes('entrada após') || texto.includes('entrada apos'))
  );
}

export function mensagemIndicaPortariaBloqueadaSemJustificativa(mensagem) {
  const texto = String(mensagem || '').toLowerCase();
  if (mensagemIndicaJustificativaHorarioPortaria(mensagem)) {
    return false;
  }
  return (
    texto.includes('pernoitou fora da unidade')
    || texto.includes('pernoitou dentro da unidade')
  );
}
