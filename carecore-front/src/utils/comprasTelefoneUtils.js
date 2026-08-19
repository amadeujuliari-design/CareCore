/**
 * Telefones do módulo Compras — DDD 11 (SP) quando ausente.
 */

const DDD_PADRAO = '11';

function soDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function formatarExibicao(digitos) {
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  return digitos;
}

function montarComDdd(ddd, local) {
  if (local.length === 8) return `${ddd}${local}`;
  if (local.length === 9 && local.startsWith('9')) return `${ddd}${local}`;
  return null;
}

function normalizarBloco(bloco, dddPadrao = DDD_PADRAO) {
  const texto = String(bloco || '').trim();
  if (!texto) return null;

  let dddExplicito = null;
  const matchDdd = texto.match(/\(\s*(\d{2})\s*\)/);
  if (matchDdd) dddExplicito = matchDdd[1];
  else if (/^\d{2}\s/.test(texto)) dddExplicito = texto.slice(0, 2);

  let digitos = soDigitos(texto);
  if (!digitos) return null;

  while (digitos.startsWith('55') && digitos.length > 11) {
    digitos = digitos.slice(2);
  }
  digitos = digitos.replace(/^0+/, '');

  let candidato = null;
  if (dddExplicito) {
    if (digitos.startsWith(dddExplicito)) {
      const local = digitos.slice(dddExplicito.length);
      if (local.length === 8 || local.length === 9) {
        candidato = montarComDdd(dddExplicito, local);
      } else {
        candidato = null;
      }
    } else if (digitos.length === 8 || digitos.length === 9) {
      candidato = montarComDdd(dddExplicito, digitos);
    } else if (digitos.length === 10 || digitos.length === 11) {
      candidato = digitos;
    }
  } else if (digitos.length === 8) {
    candidato = montarComDdd(dddPadrao, digitos);
  } else if (digitos.length === 9 && digitos.startsWith('9')) {
    candidato = montarComDdd(dddPadrao, digitos);
  } else if (digitos.length === 10 || digitos.length === 11) {
    candidato = digitos;
  } else if (digitos.length > 11) {
    candidato = digitos.slice(-11);
    if (candidato.length !== 11) candidato = digitos.slice(-10);
  }

  if (!candidato || (candidato.length !== 10 && candidato.length !== 11)) return null;
  return candidato;
}

export function extrairTelefonesCompras(valor, dddPadrao = DDD_PADRAO) {
  if (!valor || !String(valor).trim()) return [];

  const texto = String(valor).trim();
  let blocos = texto.split(/[/|,;]+|\s{2,}/);
  if (blocos.length === 1) blocos = texto.split(/\s+-\s+(?=[A-Za-z])/);
  if (blocos.length === 1) blocos = [texto];

  const encontrados = [];
  blocos.forEach((bloco) => {
    const limpo = bloco.trim();
    if (!limpo || /^[A-Za-zÀ-ú\s.]+$/u.test(limpo)) return;
    const normalizado = normalizarBloco(limpo, dddPadrao);
    if (normalizado && !encontrados.includes(normalizado)) encontrados.push(normalizado);
  });
  if (encontrados.length === 0) {
    const fallback = normalizarBloco(texto, dddPadrao);
    if (fallback) encontrados.push(fallback);
  }
  return encontrados;
}

export function sanitizarTelefoneCompras(valor, dddPadrao = DDD_PADRAO) {
  const telefones = extrairTelefonesCompras(valor, dddPadrao);
  if (!telefones.length) return { principal: null, extras: [] };
  return { principal: telefones[0], extras: telefones.slice(1) };
}

export function formatarTelefoneInputCompras(valor) {
  const digitos = soDigitos(valor).slice(0, 11);
  if (!digitos) return '';

  let trabalho = digitos;
  if (trabalho.length <= 9 && (trabalho.length === 8 || trabalho.startsWith('9'))) {
    trabalho = `11${trabalho}`.slice(0, 11);
  }

  if (trabalho.length <= 10) {
    return trabalho
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return trabalho
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function formatarTelefoneCompras(valor, dddPadrao = DDD_PADRAO) {
  const { principal, extras } = sanitizarTelefoneCompras(valor, dddPadrao);
  if (!principal) return String(valor || '').trim();
  return [formatarExibicao(principal), ...extras.map(formatarExibicao)].join(' / ');
}

export function telefoneComprasValido(valor) {
  if (!valor || !String(valor).trim()) return true;
  const { principal } = sanitizarTelefoneCompras(valor);
  return Boolean(principal);
}

export function normalizarTelefoneComprasParaSalvar(valor, dddPadrao = DDD_PADRAO) {
  const { principal } = sanitizarTelefoneCompras(valor, dddPadrao);
  return principal;
}
