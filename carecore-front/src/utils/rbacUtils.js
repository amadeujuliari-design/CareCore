import { usuarioOrganizacaoFinanceira } from './orgPacoteUtils.js';

const PERFIS_GESTAO = ['Gestor', 'Gestao', 'Gestão', 'Gerente'];
const PERFIS_TECNICOS = ['Técnico', 'Tecnico'];
export const PERFIL_OFICINEIRO = 'Oficineiro(a)';
export const PERFIL_ADM_GLOBAL = 'ADM Global NFP';
export const PERFIL_ADM_PRODUCAO = 'ADM Produção NFP';
export const PERFIL_ADM_COMPRAS = 'ADM Global Compras';
export const PERFIL_ADM_PEDIDOS = 'ADM Pedidos';
export const PERFIS_MODULO_NFP = ['Global', PERFIL_ADM_GLOBAL, PERFIL_ADM_PRODUCAO, 'Manutenção'];
export const PERFIS_NFP_GESTAO = ['Global', PERFIL_ADM_GLOBAL, 'Manutenção'];
export const PERFIS_NFP_LEITURA_CUPONS = ['Global', PERFIL_ADM_GLOBAL, PERFIL_ADM_PRODUCAO, 'Manutenção'];
export const PERFIS_NFP_ENVIO_SEFAZ = ['Global', PERFIL_ADM_GLOBAL, 'Manutenção'];
export const PERFIS_NFP_OPERAR_ENVIO_SEFAZ = [PERFIL_ADM_GLOBAL, 'Manutenção'];

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
    'ADM Global': PERFIL_ADM_GLOBAL,
    'Adm Producao': PERFIL_ADM_PRODUCAO,
    'Adm Produção': PERFIL_ADM_PRODUCAO,
    ADMProducao: PERFIL_ADM_PRODUCAO,
    'ADM Produção': PERFIL_ADM_PRODUCAO,
    'Adm Compras': PERFIL_ADM_COMPRAS,
    ADMCompras: PERFIL_ADM_COMPRAS,
    'ADM Compras': PERFIL_ADM_COMPRAS,
    'Adm Pedidos': PERFIL_ADM_PEDIDOS,
    ADMPedidos: PERFIL_ADM_PEDIDOS,
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

export function usuarioEhAdmCompras(usuario) {
  if (!usuario || usuarioEhManutencao(usuario)) return false;
  return normalizarPerfilRbac(usuario.perfil_acesso) === PERFIL_ADM_COMPRAS;
}

export function usuarioEhAdmPedidos(usuario) {
  if (!usuario || usuarioEhManutencao(usuario)) return false;
  return normalizarPerfilRbac(usuario.perfil_acesso) === PERFIL_ADM_PEDIDOS;
}

/** Rotulos de Sede (espelha ROTULOS_SEDE / vinculo_eh_sede do backend). */
export function vinculoEhSede(valor) {
  const n = String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[–—]/g, '-');
  if (!n) return false;
  return n === 'SEDE AEB' || n === 'SEDE' || n.startsWith('SEDE');
}

/** Badge e contexto de sessão: perfis ligados à organização (não a um projeto). */
export function obterUsuarioSessao() {
  try {
    const bruto = localStorage.getItem('@CareCore:user') || localStorage.getItem('usuario');
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

/** Dashboard, config operacional, ausências etc. — perfis só Compras/NFP não entram. */
export function usuarioPodeAcessarModuloOperacional(usuario) {
  if (!usuario) return false;
  if (usuarioEhManutencao(usuario)) return true;
  if (usuarioEhAdmCompras(usuario) || usuarioEhAdmPedidos(usuario)) return false;
  if (usuarioEhAdmGlobal(usuario) || usuarioEhAdmProducao(usuario)) return false;
  if (usuarioEhGlobalPuro(usuario)) return false;
  return true;
}

export function usuarioEscopoOrganizacao(usuario) {
  if (!usuario) return false;
  if (usuarioEhAdmGlobal(usuario) || usuarioEhAdmCompras(usuario)) {
    return true;
  }
  if (usuarioEhAdmProducao(usuario)) {
    return vinculoEhSede(usuario.nfp_captador_vinculo);
  }
  if (usuarioEhAdmPedidos(usuario)) {
    return vinculoEhSede(usuario.projeto_nome);
  }
  return false;
}

export function usuarioPodeVerCompras(usuario) {
  if (!usuario) return false;
  if (usuarioEhManutencao(usuario) || usuarioEhAdmCompras(usuario) || usuarioEhAdmPedidos(usuario)) {
    return true;
  }
  const perfil = normalizarPerfilRbac(usuario.perfil_acesso);
  if (['Gestor', 'Técnico', 'Administrativo'].includes(perfil)) {
    return usuario.compras_modulo_ativo === true;
  }
  return false;
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
  if (usuarioOrganizacaoFinanceira(usuario)) {
    return '/financeiro/dashboard';
  }
  if (usuarioEhAdmProducao(usuario)) {
    return '/nfp/leitura-cupons';
  }
  if (usuarioEhAdmGlobal(usuario)) {
    return '/nfp';
  }
  if (usuarioEhAdmPedidos(usuario) || usuarioEhAdmCompras(usuario)) {
    return '/compras';
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

export function rotaEhModuloCompras(pathname) {
  return pathname === '/compras' || pathname.startsWith('/compras/');
}

/** Rotas extras liberadas para ADM Global além do módulo NFP. */
export function rotaPermitidaAdmGlobal(pathname) {
  if (rotaEhModuloNfp(pathname)) return true;
  // Administração de ADM Global / ADM Produção (vínculo Sede ou projeto)
  if (pathname === '/usuarios' || pathname.startsWith('/usuarios/')) return true;
  return false;
}

export function rotaPermitidaAdmCompras(pathname) {
  if (rotaEhModuloCompras(pathname)) return true;
  if (pathname === '/usuarios' || pathname.startsWith('/usuarios/')) return true;
  return false;
}

export function rotaPermitidaAdmPedidos(pathname) {
  return rotaEhModuloCompras(pathname);
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
  return !usuarioEhGlobalPuro(usuario)
    && !usuarioEhAdmNfpOrg(usuario)
    && !usuarioEhAdmCompras(usuario)
    && !usuarioEhAdmPedidos(usuario);
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

/** E-mails autorizados a gerenciar cadastro de atividades no SIAT (além de Gestor/Manutenção). */
export const EMAILS_CADASTRO_ATIVIDADES_SIAT = Object.freeze([
  'luciana@carecore.com',
]);

export function usuarioPodeGerenciarCadastroAtividades(usuario, opcoes = {}) {
  if (!usuario) return false;
  if (usuarioEhGlobalPuro(usuario)) return false;
  if (usuarioEhManutencao(usuario)) return true;

  const perfilDefaults = String(opcoes.perfilDefaults || opcoes.perfil_defaults || '')
    .trim()
    .toLowerCase();
  const projetoSiat = perfilDefaults === 'siat' || opcoes.projetoSiat === true;
  if (!projetoSiat) {
    // Fora do SIAT: mantém regra anterior (qualquer perfil operacional, exceto Global puro).
    return true;
  }

  if (usuarioEhGestor(usuario)) return true;
  const email = String(usuario.email || '').trim().toLowerCase();
  return EMAILS_CADASTRO_ATIVIDADES_SIAT.includes(email);
}

export function usuarioPodeGerenciarAdmGlobalOrg(usuario) {
  if (!usuario) return false;
  const perfil = normalizarPerfilRbac(usuario.perfil_acesso);
  return usuarioEhManutencao(usuario) || usuario.is_global === true
    || perfil === 'Global'
    || perfil === PERFIL_ADM_GLOBAL
    || perfil === PERFIL_ADM_COMPRAS;
}
