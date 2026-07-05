/** Janelas de horário para registro de refeições (fuso operacional SP). */

import { obterJanelasRefeicao } from '../config/configOperacionalDefaults';

export const JANELAS_REFEICAO_OPERACIONAL = {
  'Café da manhã': { inicio: '06:55', fim: '08:30' },
  Almoço: { inicio: '11:50', fim: '14:30' },
  Jantar: { inicio: '17:50', fim: '20:30' },
  'Lanche noturno': { inicio: '21:00', fim: '22:30' },
};

function parseHoraMinuto(valor) {
  const [hora, minuto] = String(valor).split(':').map(Number);
  return { hora, minuto };
}

function minutosDoDia(data) {
  return data.getHours() * 60 + data.getMinutes();
}

export function validarHorarioRefeicaoOperacional(
  tipoRefeicao,
  momento = new Date(),
  configOperacional = null,
) {
  const janelas = configOperacional ? obterJanelasRefeicao(configOperacional) : JANELAS_REFEICAO_OPERACIONAL;
  const janela = janelas[tipoRefeicao];
  if (!janela) return null;

  const inicio = parseHoraMinuto(janela.inicio);
  const fim = parseHoraMinuto(janela.fim);
  const atual = minutosDoDia(momento);
  const inicioMin = inicio.hora * 60 + inicio.minuto;
  const fimMin = fim.hora * 60 + fim.minuto;

  if (atual >= inicioMin && atual <= fimMin) {
    return null;
  }

  return (
    `Registro de ${tipoRefeicao.toLowerCase()} permitido apenas entre `
    + `${janela.inicio} e ${janela.fim} (horário de Brasília).`
  );
}

export function mensagemIndicaHorarioRefeicaoForaJanela(mensagem) {
  const texto = String(mensagem || '').toLowerCase();
  return (
    texto.includes('permitido apenas entre')
    && texto.includes('horário de brasília')
  );
}
