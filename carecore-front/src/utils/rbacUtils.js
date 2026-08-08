const PERFIS_GESTAO = ['Gestor', 'Gestao', 'Gestão', 'Gerente'];
const PERFIS_TECNICOS = ['Técnico', 'Tecnico'];
export const PERFIL_OFICINEIRO = 'Oficineiro(a)';
export const PERFIL_ADM_GLOBAL = 'ADM Global';
export const PERFIL_ADM_PRODUCAO = 'ADM Produção';
export const PERFIS_MODULO_NFP = ['Global', 'ADM Global', 'ADM Produção', 'Manutenção'];
export const PERFIS_NFP_GESTAO = ['Global', 'ADM Global', 'Manutenção'];
export const PERFIS_NFP_LEITURA_CUPONS = ['Global', 'ADM Global', 'ADM Produção', 'Manutenção'];
export const PERFIS_NFP_ENVIO_SEFAZ = ['Global', 'ADM Global', 'Manutenção'];
export const PERFIS_NFP_OPERAR_ENVIO_SEFAZ = ['ADM Global', 'Manutenção'];

export const PERFIS_MODULO_ATIVIDADES = [
  'Gestor',
  'Técnico',
  'Orientador',
  'Administrativo',
  'Global',
  PERFIL_OFICINEIRO,
];

export function normalizarPerfilRbac(perfil) {
  const mapa = {
    Gestao: 'Gestor',
    Gestão: 'Gestor',
    Tecnico: 'Técnico',
    Manutencao: 'Manutenção',
    Oficineiro: PERFIL_OFICINEIRO,
    'Adm Global': PERFIL_ADM_GLOBAL,
    ADMGlobal: PERFIL_ADM_GLOBAL,
    'Adm Producao': PERFIL_ADM_PRODUCAO,
    'Adm Produção': PERFIL_ADM_PRODUCAO,
    ADMProducao: PERFIL_ADM_PRODUCAO,
  };
  return mapa[perfil] || perfil || '';
}

export function usuarioEhManutencao(usuario) {
  if (!usuario) return false;
  if (usuario.is_manutencao === true) return true;
  return normalizarPerfilRbac(usuario.perfil_acesso) === 'Manutenção';
}

export function usuarioPodeConfigOperacionalProjeto(usuarioOuPerfil, tokenPayload = null) {
  const perfil = typeof usuarioOuPerfil === 'string'
    ? normalizarPerfilRbac(usuarioOuPerfil)
    : normalizarPerfilRbac(usuarioOuPerfil?.perfil_acesso);
  if (['Gestor', 'Técnico', 'Global', 'Manutenção'].includes(perfil)) return true;
  if (usuarioEhManutencao(usuarioOuPerfil)) return true;
  if (tokenPayload?.is_manutencao === true) return true;
  return false;
}

export function usuarioPodeSalvarConfigOperacionalProjeto(usuarioOuPerfil, tokenPayload = null) {
  const perfil = typeof usuarioOuPerfil === 'string'
    ? normalizarPerfilRbac(usuarioOuPerfil)
    : normalizarPerfilRbac(usuarioOuPerfil?.perfil_acesso);
  if (perfil === 'Gestor' || perfil === 'Manutenção') return true;
  if (usuarioEhManutencao(usuarioOuPerfil)) return true;
  if (tokenPayload?.is_manutencao === true) return true;
  return false;
}

export function usuarioEhGestor(usuario) {
  if (!usuario) return false;
  if (usuario.is_master === true) return true;
  return PERFIS_GESTAO.includes(normalizarPerfilRbac(usuario.perfil_acesso));
}

export function usuarioEhOficineiro(usuario) {
  if (!usuario || usuarioEhManutencao(usuario)) return false;
  return normalizarPerfilRbac(usuario.perfil_acesso) === PERFIL_OFICINEIRO;
}

export function usuarioEhAdmGlobal(usuario) {
  if (!usuario || usuarioEhManutencao(usuario)) return false;
  return normalizarPerfilRbac(usuario.perfil_acesso) === PERFIL_ADM_GLOBAL;
}

export function usuarioEhAdmProducao(usuario) {
  if (!usuario || usuarioEhManutencao(usuario)) return false;
  return normalizarPerfilRbac(usuario.perfil_acesso) === PERFIL_ADM_PRODUCAO;
}

export function usuarioEhAdmNfpOrg(usuario) {
  return usuarioEhAdmGlobal(usuario) || usuarioEhAdmProducao(usuario);
}

export function usuarioPodeAcessarNfp(usuario) {
  if (!usuario) return false;
  if (usuarioEhManutencao(usuario) || usuarioEhAdmNfpOrg(usuario)) return true;
  if (usuario.is_global === true) return true;
  return normalizarPerfilRbac(usuario.perfil_acesso) === 'Global';
}

export function usuarioPodeGestaoNfp(usuario) {
  if (!usuario) return false;
  if (usuarioEhManutencao(usuario) || usuarioEhAdmGlobal(usuario)) return true;
  if (usuario.is_global === true) return true;
  return normalizarPerfilRbac(usuario.perfil_acesso) === 'Global';
}

/** Tela Envio SEFAZ (consulta): Global, ADM Global, Manutenção. */
export function usuarioPodeVerEnvioSefaz(usuario) {
  return usuarioPodeGestaoNfp(usuario);
}

/** Operar robô (abrir Chrome / enviar fila): só ADM Global e Manutenção. */
export function usuarioPodeOperarEnvioSefaz(usuario) {
  if (!usuario) return false;
  return usuarioEhManutencao(usuario) || usuarioEhAdmGlobal(usuario);
}

/** Global consulta NFP; edição/importação/rateio só ADM Global, Manutenção (e não Global puro). */
export function usuarioSomenteLeituraNfp(usuario) {
  return usuarioEhGlobalPuro(usuario);
}

export function usuarioPodeEditarNfp(usuario) {
  return usuarioPodeGestaoNfp(usuario) && !usuarioEhGlobalPuro(usuario);
}

export function rotaInicialPosLogin(usuario) {
  if (usuarioEhAdmProducao(usuario)) {
    return '/nfp/leitura-cupons';
  }
  if (usuarioEhAdmGlobal(usuario)) {
    return '/nfp';
  }
  if (usuarioEhOficineiro(usuario)) {
    return '/atividades/chamada';
  }
  return '/dashboard';
}

export function rotaEhModuloAtividades(pathname) {
  return pathname === '/atividades' || pathname.startsWith('/atividades/');
}

export function rotaEhModuloNfp(pathname) {
  return pathname === '/nfp' || pathname.startsWith('/nfp/');
}

export function rotaEhLeituraCuponsNfp(pathname) {
  return pathname === '/nfp/leitura-cupons' || pathname.startsWith('/nfp/leitura-cupons/');
}

/**
 * Global puro = visão ampla, sem operar no projeto (diferente de Manutenção/Gestor).
 */
export function usuarioEhGlobalPuro(usuario) {
  if (!usuario) return false;
  if (usuarioEhManutencao(usuario) || usuarioEhAdmNfpOrg(usuario)) return false;
  if (usuarioEhGestor(usuario)) return false;
  if (usuario.is_global === true) return true;
  return normalizarPerfilRbac(usuario.perfil_acesso) === 'Global';
}

/** Pode editar/salvar dados operacionais do projeto. */
export function usuarioPodeOperarProjeto(usuario) {
  return !usuarioEhGlobalPuro(usuario) && !usuarioEhAdmNfpOrg(usuario);
}

/** Alias usado nas telas operacionais (conviventes, rotina). */
export function usuarioSomenteLeituraProjeto(usuario) {
  return usuarioEhGlobalPuro(usuario);
}

/** Visão multi-projeto (seletor de projeto, menus globalOnly). */
export function usuarioTemVisaoGlobal(usuario) {
  if (!usuario) return false;
  return usuario.is_global === true || usuarioEhManutencao(usuario);
}

export function usuarioPodeEditarAcomodacao(usuario) {
  if (!usuario) return false;
  if (usuarioEhGestor(usuario) || usuarioEhManutencao(usuario)) return true;
  return PERFIS_TECNICOS.includes(normalizarPerfilRbac(usuario.perfil_acesso));
}

export function usuarioSomenteLeituraAtividades(usuario) {
  return usuarioEhGlobalPuro(usuario);
}

export function usuarioPodeGerenciarAdmGlobalOrg(usuario) {
  if (!usuario) return false;
  return usuarioEhManutencao(usuario) || usuario.is_global === true
    || normalizarPerfilRbac(usuario.perfil_acesso) === 'Global';
}
