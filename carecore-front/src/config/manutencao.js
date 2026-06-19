import { decodificarPayloadJwt } from '../utils/jwtUtils';

const PERFIS_LIBERADOS_MANUTENCAO = new Set(['Manutenção', 'Manutencao', 'Gestor', 'Global']);

const PERFIS_LEGADOS = {
  Gestao: 'Gestor',
  Gestão: 'Gestor',
  Gerente: 'Gestor',
  Tecnico: 'Técnico',
  Manutencao: 'Manutenção',
  Executivo: 'Global',
};

/** Ative com VITE_MAINTENANCE_MODE=true no .env local ou na Vercel. */
export function manutencaoProgramadaAtiva() {
  return String(import.meta.env.VITE_MAINTENANCE_MODE || '').toLowerCase() === 'true';
}

function normalizarPerfil(perfil) {
  if (!perfil) return '';
  return PERFIS_LEGADOS[perfil] || perfil;
}

function obterTokenLocal() {
  try {
    return localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function obterUsuarioLocal() {
  try {
    const bruto = localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario');
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

/** Perfis de equipe que podem validar o sistema durante a manutenção programada. */
export function usuarioPodeAcessarDuranteManutencao(usuario) {
  if (!usuario) return false;
  if (usuario.is_manutencao === true || usuario.is_master === true) return true;

  return PERFIS_LIBERADOS_MANUTENCAO.has(normalizarPerfil(usuario.perfil_acesso));
}

/** Usuário técnico de suporte/manutenção CareCore+ (não Gestor/Global). */
export function usuarioEhPerfilManutencao(usuario) {
  if (!usuario) return false;
  if (usuario.is_manutencao === true) return true;
  return normalizarPerfil(usuario.perfil_acesso) === 'Manutenção';
}

/** Monta objeto de usuário para UserAvatar a partir de um aviso/remetente. */
export function montarUsuarioAvatarRemetente(aviso) {
  if (!aviso) return null;

  return {
    nome: aviso.remetente_nome,
    avatar_url: aviso.remetente_avatar_url,
    perfil_acesso: aviso.remetente_perfil_acesso,
  };
}

export const MENSAGEM_LOGIN_BLOQUEADO_MANUTENCAO =
  'O CareCore+ está em manutenção programada. Neste momento, apenas a equipe de gestão/manutenção pode acessar. Tente novamente quando o sistema for liberado.';

/** Sessão JWT ainda válida (não expirada). */
export function usuarioTemSessaoAtiva() {
  const token = obterTokenLocal();
  if (!token) return false;

  try {
    const payload = decodificarPayloadJwt(token);
    if (!payload?.exp) return true;
    return Date.now() / 1000 < payload.exp;
  } catch {
    return false;
  }
}

/** Sessão válida de alguém autorizado a usar o sistema durante a manutenção. */
export function sessaoLiberadaDuranteManutencao() {
  if (!usuarioTemSessaoAtiva()) return false;
  return usuarioPodeAcessarDuranteManutencao(obterUsuarioLocal());
}

/**
 * Visitantes (ou perfis operacionais sem liberação) veem a página de manutenção.
 * A rota / permanece como login, mas o acesso após autenticação é filtrado por perfil.
 */
export function deveExibirManutencaoProgramada(pathname) {
  if (!manutencaoProgramadaAtiva()) return false;
  if (sessaoLiberadaDuranteManutencao()) return false;
  if (pathname === '/') return false;
  return true;
}
