const PERFIS_GESTAO = ['Gestor', 'Gestao', 'Gestão', 'Gerente'];
const PERFIS_TECNICOS = ['Técnico', 'Tecnico'];
export const PERFIL_OFICINEIRO = 'Oficineiro(a)';

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

export function rotaInicialPosLogin(usuario) {
  if (usuarioEhOficineiro(usuario)) {
    return '/atividades/chamada';
  }
  return '/dashboard';
}

export function rotaEhModuloAtividades(pathname) {
  return pathname === '/atividades' || pathname.startsWith('/atividades/');
}

/**
 * Global puro = visão ampla, sem operar no projeto (diferente de Manutenção/Gestor).
 */
export function usuarioEhGlobalPuro(usuario) {
  if (!usuario) return false;
  if (usuarioEhManutencao(usuario)) return false;
  if (usuarioEhGestor(usuario)) return false;
  if (usuario.is_global === true) return true;
  return normalizarPerfilRbac(usuario.perfil_acesso) === 'Global';
}

/** Pode editar/salvar dados operacionais do projeto. */
export function usuarioPodeOperarProjeto(usuario) {
  return !usuarioEhGlobalPuro(usuario);
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
