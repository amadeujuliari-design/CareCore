export function decodificarPayloadJwt(token) {
  if (!token) {
    return null;
  }

  const partes = token.split('.');

  if (partes.length !== 3) {
    return null;
  }

  const payloadBase64 = partes[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(partes[1].length / 4) * 4, '=');

  return JSON.parse(atob(payloadBase64));
}
