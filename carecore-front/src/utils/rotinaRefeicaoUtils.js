/** Rótulo Rep1, Rep2... para refeições extras do dia (2ª, 3ª... do mesmo tipo). */
export function rotuloRepeticaoExtraRefeicao(repeticao) {
  const numero = Number(repeticao);
  if (!Number.isFinite(numero) || numero < 1) return null;
  return `Rep${numero}`;
}

export function tipoRegistroComRepeticaoExtra(tipoRegistro, repeticaoExtra) {
  const rotulo = rotuloRepeticaoExtraRefeicao(repeticaoExtra);
  if (!rotulo) return tipoRegistro || '-';
  return `${tipoRegistro} · ${rotulo}`;
}
