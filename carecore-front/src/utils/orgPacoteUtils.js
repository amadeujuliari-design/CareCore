import { decodificarPayloadJwt } from './jwtUtils.js';

export const ROTULO_MENU_ORGS_PROJETOS = 'ONGs/Projetos';

export const TIPO_PACOTE_ASSISTENCIAL = 'assistencial';
export const TIPO_PACOTE_FINANCEIRO_PESSOAL = 'financeiro_pessoal';

export function normalizarTipoPacote(valor) {
  const tipo = String(valor || TIPO_PACOTE_ASSISTENCIAL).trim().toLowerCase();
  if (tipo === TIPO_PACOTE_FINANCEIRO_PESSOAL) {
    return TIPO_PACOTE_FINANCEIRO_PESSOAL;
  }
  return TIPO_PACOTE_ASSISTENCIAL;
}

export function obterCamposPacoteDaSessao(usuario, token = null) {
  const tokenLocal = token
    || (typeof localStorage !== 'undefined'
      ? (localStorage.getItem('@CareCore:token') || localStorage.getItem('token'))
      : null);

  let payload = null;
  try {
    if (tokenLocal) {
      payload = decodificarPayloadJwt(tokenLocal);
    }
  } catch {
    payload = null;
  }

  return {
    organizacao_tipo_pacote: normalizarTipoPacote(
      usuario?.organizacao_tipo_pacote || payload?.organizacao_tipo_pacote,
    ),
    organizacao_nome: usuario?.organizacao_nome || payload?.organizacao_nome || null,
    projeto_nome: usuario?.projeto_nome || payload?.projeto_nome || null,
  };
}

export function usuarioOrganizacaoFinanceira(usuario, token = null) {
  if (!usuario && !token) return false;
  const campos = obterCamposPacoteDaSessao(usuario, token);
  return campos.organizacao_tipo_pacote === TIPO_PACOTE_FINANCEIRO_PESSOAL;
}

export function rotaEhFinanceiro(pathname) {
  return String(pathname || '').startsWith('/financeiro');
}

export function rotuloTipoPacote(tipoPacote) {
  if (normalizarTipoPacote(tipoPacote) === TIPO_PACOTE_FINANCEIRO_PESSOAL) {
    return 'Finanças';
  }
  return 'Assistencial';
}

export function enriquecerUsuarioSessaoComPacote(usuario, token = null) {
  if (!usuario) return usuario;
  const campos = obterCamposPacoteDaSessao(usuario, token);
  return {
    ...usuario,
    ...campos,
  };
}
