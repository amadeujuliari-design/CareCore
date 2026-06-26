/** Validade e avisos de carteirinha provisória (espelho do backend, fuso SP). */

export const VALIDADE_CARTEIRINHA_PROVISORIA_DIAS = 7;
export const AVISO_CARTEIRINHA_PROVISORIA_DIAS = 5;

function formatarRestanteOperacional(deltaMs) {
  const horasRestantes = Math.max(0, Math.floor(deltaMs / (1000 * 60 * 60)));
  const diasRestantes = Math.max(0, Math.floor(deltaMs / (1000 * 60 * 60 * 24)));
  if (diasRestantes > 0) {
    return `${diasRestantes} dia(s) e ${horasRestantes % 24}h`;
  }
  return `${horasRestantes}h`;
}

export function obterQuartoDoLeito(quartos = [], leitoId) {
  if (!leitoId) return null;
  for (const quarto of quartos) {
    if (quarto.leitos?.some((leito) => leito.id === leitoId)) {
      return quarto;
    }
  }
  return null;
}

export function avaliarCarteirinhaProvisoria({
  leitoProvisorioDesde,
  quartoRotativo = false,
  agora = new Date(),
} = {}) {
  if (!quartoRotativo || !leitoProvisorioDesde) {
    return {
      provisoria: false,
      bloqueada: false,
      emAviso: false,
      emTolerancia: false,
      restanteTexto: null,
    };
  }

  const inicio = new Date(leitoProvisorioDesde);
  const fimJanelaAviso = new Date(inicio);
  fimJanelaAviso.setDate(fimJanelaAviso.getDate() + AVISO_CARTEIRINHA_PROVISORIA_DIAS);

  const validadeEm = new Date(inicio);
  validadeEm.setDate(validadeEm.getDate() + VALIDADE_CARTEIRINHA_PROVISORIA_DIAS);

  const bloqueada = agora > validadeEm;
  let emAviso = false;
  let emTolerancia = false;
  let restanteTexto;

  if (bloqueada) {
    restanteTexto = 'Carteirinha provisória vencida';
  } else if (agora <= fimJanelaAviso) {
    emAviso = true;
    restanteTexto = `${formatarRestanteOperacional(fimJanelaAviso - agora)} para atualizar a carteirinha`;
  } else {
    emTolerancia = true;
    restanteTexto = `${formatarRestanteOperacional(validadeEm - agora)} até o bloqueio da carteirinha`;
  }

  return {
    provisoria: true,
    bloqueada,
    emAviso,
    emTolerancia,
    validadeEm,
    avisoLimiteEm: fimJanelaAviso,
    restanteTexto,
  };
}

export function avaliarCarteirinhaConvivente(convivente, quartos = [], agora = new Date()) {
  const quarto = obterQuartoDoLeito(quartos, convivente?.leito_id);
  const quartoRotativo = Boolean(quarto?.rotativo);

  if (quartoRotativo && convivente?.leito_id && !convivente?.leito_provisorio_desde) {
    return {
      provisoria: true,
      bloqueada: false,
      emAviso: true,
      emTolerancia: false,
      validadeEm: null,
      restanteTexto: 'validade não registrada — realoque o leito para renovar',
      preferencial: Boolean(convivente?.preferencial),
      quartoRotativo: true,
    };
  }

  const status = avaliarCarteirinhaProvisoria({
    leitoProvisorioDesde: convivente?.leito_provisorio_desde,
    quartoRotativo,
    agora,
  });

  return {
    ...status,
    preferencial: Boolean(convivente?.preferencial),
    quartoRotativo,
  };
}

export function mensagemAvisoCarteirinha(status) {
  if (!status?.provisoria || status.bloqueada) {
    return null;
  }
  return (
    `Carteirinha PROVISÓRIA: ${status.restanteTexto}. `
    + 'Realoque no quarto rotativo ou mova para quarto definitivo e reimprima.'
  );
}

export function obterAvisoCarteirinhaConvivente(convivente, quartos = [], agora = new Date()) {
  const status = avaliarCarteirinhaConvivente(convivente, quartos, agora);
  const bloqueio = mensagemBloqueioCarteirinha(status);
  if (bloqueio) {
    return { bloqueado: true, mensagem: bloqueio, status };
  }
  const aviso = mensagemAvisoCarteirinha(status);
  if (aviso) {
    return { bloqueado: false, mensagem: aviso, status };
  }
  return null;
}

export function mensagemBloqueioCarteirinha(status) {
  if (!status?.bloqueada) return null;
  return (
    'Carteirinha provisória vencida. Realoque o convivente em quarto rotativo '
    + '(retirar do leito, salvar e alocar novamente) ou mova para quarto definitivo e reimprima.'
  );
}
