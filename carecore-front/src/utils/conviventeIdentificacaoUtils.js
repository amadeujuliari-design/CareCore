export function normalizarCodigoCarteirinha(valor) {
  return String(valor || '')
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, '');
}

export function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export const STATUS_CONVIVENTE_INATIVOS_ROTINA = new Set([
  'Inativado',
  'Bloqueado',
  'Saída qualificada',
]);

export function conviventeEstaInativoParaRotina(status) {
  return STATUS_CONVIVENTE_INATIVOS_ROTINA.has(String(status || '').trim());
}

export function encontrarConviventePorCodigo(conviventes, codigo) {
  const codigoNormalizado = normalizarCodigoCarteirinha(codigo);
  const codigoDigitos = somenteDigitos(codigoNormalizado);

  if (!codigoNormalizado) return null;

  return (conviventes || []).find((convivente) => {
    const id = String(convivente?.id || '').trim();
    const prontuario = normalizarCodigoCarteirinha(convivente?.numero_institucional);
    const cpf = somenteDigitos(convivente?.cpf);

    return (
      id === codigoNormalizado
      || (prontuario && prontuario === codigoNormalizado)
      || (cpf && codigoDigitos && cpf === codigoDigitos)
    );
  }) || null;
}
