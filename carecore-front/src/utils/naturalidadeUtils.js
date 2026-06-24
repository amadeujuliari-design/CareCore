export function parseNaturalidade(valor) {
  const texto = String(valor || '').trim();
  if (!texto) {
    return { cidade: '', uf: '' };
  }

  const matchSeparador = texto.match(/^(.+?)\s*(?:\/|-)\s*([A-Za-z]{2})$/);
  if (matchSeparador) {
    return {
      cidade: matchSeparador[1].trim(),
      uf: matchSeparador[2].toUpperCase(),
    };
  }

  const matchVirgula = texto.match(/^(.+?),\s*([A-Za-z]{2})$/);
  if (matchVirgula) {
    return {
      cidade: matchVirgula[1].trim(),
      uf: matchVirgula[2].toUpperCase(),
    };
  }

  return { cidade: texto, uf: '' };
}

export function montarNaturalidade(cidade, uf) {
  const cidadeTexto = String(cidade || '').trim();
  const ufTexto = String(uf || '').trim().toUpperCase();
  if (cidadeTexto && ufTexto) return `${cidadeTexto}/${ufTexto}`;
  return cidadeTexto || null;
}
