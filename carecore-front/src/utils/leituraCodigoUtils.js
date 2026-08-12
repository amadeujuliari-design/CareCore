/** Janela para ignorar leitura acidental repetida da mesma carteirinha/código. */
export const JANELA_IGNORAR_LEITURA_REPETIDA_MS = 7000;

export function normalizarCodigoLeitura(codigo) {
  return String(codigo || '').trim();
}

/**
 * Extrai chave NFe/NFC-e de 44 digitos de URL SEFAZ ou digitacao.
 * Espelha a logica leve de nfp_cupom_utils.extrair_chave_de_leitura.
 */
export function extrairChaveNfpDeLeitura(bruto) {
  const texto = String(bruto || '').trim();
  if (!texto) return '';

  // Pistola USB às vezes remove /, ? e //: ...qrcodep=CHAVE|2|1
  const pDireto = texto.match(/(?:[?&/]|^|[^=])p=(\d{44})/i);
  if (pDireto?.[1]) return pDireto[1];

  const paramP = texto.match(/p=([^&\s]+)/i);
  if (paramP?.[1]) {
    const parte = decodeURIComponent(paramP[1]).split('|')[0] || '';
    const digitosP = parte.replace(/\D/g, '');
    if (digitosP.length >= 44) return digitosP.slice(0, 44);
  }

  const soDigitos = texto.replace(/\D/g, '');
  if (soDigitos.length === 44) return soDigitos;

  // Preferir chave SP (35…) se houver dígitos extras concatenados
  const matchSp = soDigitos.match(/35\d{42}/);
  if (matchSp) return matchSp[0];

  const match44 = soDigitos.match(/\d{44}/);
  return match44 ? match44[0] : '';
}

/**
 * Retorna true quando a leitura deve ser ignorada (mesmo código em menos de 7s).
 * Códigos diferentes passam na sequência, mesmo dentro da janela.
 */
export function deveIgnorarLeituraCodigoRepetida(ultimaLeituraRef, codigoBruto) {
  const codigo = normalizarCodigoLeitura(codigoBruto);
  if (!codigo) return true;

  const agora = Date.now();
  const ultima = ultimaLeituraRef.current || {};

  if (
    ultima.codigo === codigo &&
    agora - (ultima.horario || 0) < JANELA_IGNORAR_LEITURA_REPETIDA_MS
  ) {
    return true;
  }

  ultimaLeituraRef.current = { codigo, horario: agora };
  return false;
}

/**
 * Evita registro operacional duplicado do mesmo convivente em sequência rápida
 * (ex.: pistola + QR da mesma carteirinha com strings diferentes).
 */
export function deveIgnorarLeituraConviventeRepetida(ultimaConviventeRef, conviventeId) {
  const id = String(conviventeId || '').trim();
  if (!id) return false;

  const agora = Date.now();
  const ultima = ultimaConviventeRef.current || {};

  if (
    ultima.conviventeId === id &&
    agora - (ultima.horario || 0) < JANELA_IGNORAR_LEITURA_REPETIDA_MS
  ) {
    return true;
  }

  ultimaConviventeRef.current = { conviventeId: id, horario: agora };
  return false;
}

/**
 * Sessao de camera/USB NFP: apos sucesso ou 409, ignora o mesmo cupom
 * (URL ou digitos) enquanto a webcam continuar apontando para o papel.
 * Espelha o silencio da rotina de conviventes apos leitura ja tratada.
 */
export function deveIgnorarCupomNfpJaTratado(chavesTratadasRef, codigoBruto) {
  const chave = extrairChaveNfpDeLeitura(codigoBruto);
  if (!chave) return false;
  const set = chavesTratadasRef.current;
  return Boolean(set && typeof set.has === 'function' && set.has(chave));
}

export function registrarCupomNfpTratado(chavesTratadasRef, chaveOuCodigo) {
  const chave = extrairChaveNfpDeLeitura(chaveOuCodigo) || String(chaveOuCodigo || '').replace(/\D/g, '');
  if (!chave || chave.length !== 44) return;
  if (!chavesTratadasRef.current || typeof chavesTratadasRef.current.add !== 'function') {
    chavesTratadasRef.current = new Set();
  }
  chavesTratadasRef.current.add(chave);
}
