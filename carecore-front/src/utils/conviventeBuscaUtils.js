export function normalizarTextoBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function textoTemPalavraIniciandoCom(texto, termo) {
  return normalizarTextoBusca(texto)
    .split(/\s+/)
    .some(parte => parte.startsWith(termo));
}

export function pontuarConviventeBusca(convivente, termoNormalizado) {
  if (!termoNormalizado) return 0;

  const nomePreferencial = normalizarTextoBusca(convivente?.nome_social || convivente?.nome_completo);
  const nomeCompleto = normalizarTextoBusca(convivente?.nome_completo);
  const prontuario = normalizarTextoBusca(convivente?.numero_institucional);
  const sisa = normalizarTextoBusca(convivente?.numero_sisa);
  const cpf = normalizarTextoBusca(convivente?.cpf).replace(/\D/g, '');
  const termoNumerico = termoNormalizado.replace(/\D/g, '');

  if (nomePreferencial.startsWith(termoNormalizado)) return 0;
  if (nomeCompleto.startsWith(termoNormalizado)) return 1;
  if (textoTemPalavraIniciandoCom(convivente?.nome_social, termoNormalizado)) return 2;
  if (textoTemPalavraIniciandoCom(convivente?.nome_completo, termoNormalizado)) return 3;
  if (termoNumerico && prontuario.startsWith(termoNumerico)) return 4;
  if (termoNumerico && sisa.startsWith(termoNumerico)) return 5;
  if (termoNumerico && cpf.includes(termoNumerico)) return 6;
  if (nomePreferencial.includes(termoNormalizado) || nomeCompleto.includes(termoNormalizado)) return 7;

  return 99;
}

export function conviventeCorrespondeBusca(convivente, termo = '') {
  const termoNormalizado = normalizarTextoBusca(termo);
  return !termoNormalizado || pontuarConviventeBusca(convivente, termoNormalizado) < 99;
}

export function compararConviventesPorBusca(a, b, termo = '') {
  const termoNormalizado = normalizarTextoBusca(termo);
  const nomeA = normalizarTextoBusca(a?.nome_social || a?.nome_completo);
  const nomeB = normalizarTextoBusca(b?.nome_social || b?.nome_completo);

  return (
    pontuarConviventeBusca(a, termoNormalizado) - pontuarConviventeBusca(b, termoNormalizado) ||
    nomeA.localeCompare(nomeB, 'pt-BR')
  );
}

export function filtrarOrdenarConviventesPorBusca(conviventes = [], termo = '') {
  const termoNormalizado = normalizarTextoBusca(termo);

  return [...(conviventes || [])]
    .map((convivente) => ({
      convivente,
      pontuacao: pontuarConviventeBusca(convivente, termoNormalizado),
      nomeOrdenacao: normalizarTextoBusca(convivente?.nome_social || convivente?.nome_completo),
    }))
    .filter(item => !termoNormalizado || item.pontuacao < 99)
    .sort((a, b) => (
      a.pontuacao - b.pontuacao ||
      a.nomeOrdenacao.localeCompare(b.nomeOrdenacao, 'pt-BR')
    ))
    .map(item => item.convivente);
}
