/** Janela para ignorar leitura acidental repetida da mesma carteirinha/código. */
export const JANELA_IGNORAR_LEITURA_REPETIDA_MS = 7000;

export function normalizarCodigoLeitura(codigo) {
  return String(codigo || '').trim();
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
