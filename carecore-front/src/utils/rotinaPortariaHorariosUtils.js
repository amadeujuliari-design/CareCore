import { obterPortariaConfig } from '../config/configOperacionalDefaults';

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

export function obterLimitesHorarioPortaria(convivente = {}, configOperacional = null) {
  const portaria = obterPortariaConfig(configOperacional);
  const motivosExcecao = portaria.motivos_excecao || ['estudante', 'trabalho', 'saude', 'eventual'];
  const motivo = String(convivente.portaria_excecao_motivo || '').trim().toLowerCase();
  if (motivosExcecao.includes(motivo)) {
    return {
      saidaAte: convivente.portaria_excecao_saida_ate || portaria.hora_saida_padrao,
      entradaAte: convivente.portaria_excecao_entrada_ate || portaria.hora_entrada_padrao,
      comExcecao: true,
    };
  }
  return {
    saidaAte: portaria.hora_saida_padrao,
    entradaAte: portaria.hora_entrada_padrao,
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
  configOperacional = null,
}) {
  if (!['Entrada', 'Saída'].includes(tipoRegistro)) {
    return null;
  }

  const portaria = obterPortariaConfig(configOperacional);
  const minChars = portaria.min_caracteres_justificativa || MIN_CARACTERES_JUSTIFICATIVA_HORARIO;
  const horaEntradaPernoiteFora = portaria.hora_entrada_apos_pernoite_fora;
  const horaMovimentoPernoiteDentro = portaria.hora_movimento_pernoite_dentro;
  const minutosAtuais = horaAtualMinutos(momento);
  const justificativa = String(justificativaHorario || '').trim();

  if (pernoitouFora(ultimoMovimento, momento) && tipoRegistro === 'Entrada') {
    const limite = parseHora(horaEntradaPernoiteFora);
    if (minutosAtuais < limite) {
      if (justificativa.length < minChars) {
        return {
          bloqueado: true,
          exigeJustificativa: true,
          mensagem:
            `Este convivente pernoitou fora da unidade. A entrada antes das ${horaEntradaPernoiteFora} exige justificativa de no mínimo ${minChars} caracteres.`,
          limiteHorario: horaEntradaPernoiteFora,
        };
      }
      return { bloqueado: false, justificativaHorario: justificativa };
    }
  }

  if (pernoitouDentro(ultimoMovimento, momento)) {
    const limite = parseHora(horaMovimentoPernoiteDentro);
    if (minutosAtuais < limite) {
      if (justificativa.length < minChars) {
        return {
          bloqueado: true,
          exigeJustificativa: true,
          mensagem:
            `Este convivente pernoitou dentro da unidade. Movimentação antes das ${horaMovimentoPernoiteDentro} exige justificativa de no mínimo ${minChars} caracteres.`,
          limiteHorario: horaMovimentoPernoiteDentro,
        };
      }
      return { bloqueado: false, justificativaHorario: justificativa };
    }
  }

  const { saidaAte, entradaAte } = obterLimitesHorarioPortaria(convivente, configOperacional);

  if (tipoRegistro === 'Saída' && minutosAtuais > parseHora(saidaAte)) {
    if (justificativa.length < minChars) {
      return {
        bloqueado: true,
        exigeJustificativa: true,
        mensagem: `Saída após ${saidaAte} exige justificativa de no mínimo ${minChars} caracteres.`,
        limiteHorario: saidaAte,
      };
    }
    return { bloqueado: false, justificativaHorario: justificativa };
  }

  if (tipoRegistro === 'Entrada' && minutosAtuais > parseHora(entradaAte)) {
    if (justificativa.length < minChars) {
      return {
        bloqueado: true,
        exigeJustificativa: true,
        mensagem: `Entrada após ${entradaAte} exige justificativa de no mínimo ${minChars} caracteres.`,
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
    && (
      texto.includes('saída após') || texto.includes('saida apos')
      || texto.includes('entrada após') || texto.includes('entrada apos')
      || texto.includes('entrada antes') || texto.includes('entrada antes')
      || texto.includes('movimentação antes') || texto.includes('movimentacao antes')
      || texto.includes('pernoitou fora') || texto.includes('pernoitou dentro')
    )
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
