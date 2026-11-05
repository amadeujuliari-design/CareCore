/** Navegação Voltar no NFP: volta à tela de origem como estava. */

export function nfpOrigemAtual(location) {
  return `${location?.pathname || ''}${location?.search || ''}`;
}

/** Estado ao abrir uma tela filha (encadeia snapshot do dashboard se já houver). */
export function nfpEstadoVolta(location, extra = {}) {
  const prev = location?.state || {};
  return {
    from: nfpOrigemAtual(location),
    nfpAba: extra.nfpAba ?? prev.nfpAba,
    nfpCompetencia: extra.nfpCompetencia ?? prev.nfpCompetencia,
    nfpAgente: extra.nfpAgente ?? prev.nfpAgente,
    ...extra,
  };
}

/** Destino do botão Voltar / PageHeader.backTo */
export function nfpVoltarPara(location, fallback = '/nfp') {
  const from = String(location?.state?.from || '').trim();
  if (!from.startsWith('/nfp')) return fallback;
  const atual = nfpOrigemAtual(location);
  if (from === atual) return fallback;
  return from;
}

/** State ao voltar (repassa snapshot do dashboard). */
export function nfpVoltarState(location) {
  const st = location?.state || {};
  const next = {};
  if (st.nfpAba) next.nfpAba = st.nfpAba;
  if (st.nfpCompetencia) next.nfpCompetencia = st.nfpCompetencia;
  if (st.nfpAgente != null && st.nfpAgente !== undefined) next.nfpAgente = st.nfpAgente;
  return Object.keys(next).length ? next : undefined;
}

const CHAVE_DASHBOARD = '@CareCore:nfp-dashboard-vista';

export function salvarVistaDashboardNfp(vista) {
  try {
    sessionStorage.setItem(CHAVE_DASHBOARD, JSON.stringify(vista || {}));
  } catch {
    /* ignore */
  }
}

export function lerVistaDashboardNfp() {
  try {
    const data = JSON.parse(sessionStorage.getItem(CHAVE_DASHBOARD) || 'null');
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function chaveVistaCadastroNfp(pathname) {
  return `@CareCore:nfp-cadastro-vista:${pathname || ''}`;
}

export function salvarVistaCadastroNfp(pathname, vista) {
  try {
    sessionStorage.setItem(chaveVistaCadastroNfp(pathname), JSON.stringify(vista || {}));
  } catch {
    /* ignore */
  }
}

export function lerVistaCadastroNfp(pathname) {
  try {
    const data = JSON.parse(sessionStorage.getItem(chaveVistaCadastroNfp(pathname)) || 'null');
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}
