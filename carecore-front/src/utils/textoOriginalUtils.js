import { decodificarPayloadJwt } from './jwtUtils';

export function usuarioPodeVerTextoOriginal(usuario) {
  if (!usuario) return false;

  if (usuario.is_manutencao === true) return true;

  const perfil = String(usuario.perfil || usuario.perfil_acesso || '').toLowerCase();
  return ['gestor', 'gestora', 'gerente'].includes(perfil) || Boolean(usuario.isMaster);
}

export function lerUsuarioTextoOriginal(token) {
  if (!token) {
    return { token: null, perfil: '', isMaster: false, is_manutencao: false };
  }

  try {
    const payload = decodificarPayloadJwt(token) || {};
    return {
      token,
      perfil: payload.perfil_acesso || payload.perfil || '',
      isMaster: Boolean(payload.is_master),
      is_manutencao: Boolean(payload.is_manutencao),
    };
  } catch {
    return { token, perfil: '', isMaster: false, is_manutencao: false };
  }
}

export function possuiTextoOriginalRegistro({
  tituloOriginal,
  textoOriginal,
  motivoOriginal,
  descricaoOriginal,
  mensagemOriginal,
} = {}) {
  return Boolean(
    (tituloOriginal && tituloOriginal.trim())
    || (textoOriginal && textoOriginal.trim())
    || (motivoOriginal && motivoOriginal.trim())
    || (descricaoOriginal && descricaoOriginal.trim())
    || (mensagemOriginal && mensagemOriginal.trim()),
  );
}
