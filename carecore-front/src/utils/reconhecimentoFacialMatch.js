/** Distância do face-api: menor é mais parecido. Acima do limiar não registra. */
export const LIMIAR_FACIAL = 0.55;

/** Até aqui a Entrada/Saída segue sozinha, como a leitura do QR. */
export const LIMIAR_FACIAL_ALTA = 0.42;

export function classificarCorrespondenciaFacial(
  distancia,
  limiar = LIMIAR_FACIAL,
  limiarAlta = LIMIAR_FACIAL_ALTA,
) {
  const valor = Number(distancia);
  if (!Number.isFinite(valor)) return 'nenhuma';
  if (valor <= limiarAlta) return 'alta';
  if (valor <= limiar) return 'moderada';
  return 'nenhuma';
}
