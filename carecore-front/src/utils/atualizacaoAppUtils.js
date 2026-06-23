export const INTERVALO_CHECAGEM_VERSAO_MS = 5 * 60 * 1000;

export function versaoRemotaDiferente(versaoLocal, versaoRemota) {
  const local = String(versaoLocal || '').trim();
  const remota = String(versaoRemota || '').trim();
  if (!local || !remota) {
    return false;
  }
  return local !== remota;
}

export async function buscarVersaoPublicada(baseUrl = '') {
  const sufixo = `?t=${Date.now()}`;
  const response = await fetch(`${baseUrl}/version.json${sufixo}`, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`version.json indisponível (${response.status})`);
  }

  const payload = await response.json();
  return String(payload?.versao || '').trim();
}
