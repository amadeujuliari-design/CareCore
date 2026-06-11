import { useMemo } from 'react';
import { decodificarPayloadJwt } from '../utils/jwtUtils';

export function useTokenIdentity(token) {
  return useMemo(() => {
    if (!token) {
      return {
        payload: null,
        perfilUsuario: '',
        idUsuarioLogado: '',
      };
    }

    try {
      const payload = decodificarPayloadJwt(token);

      return {
        payload,
        perfilUsuario: payload?.perfil_acesso || payload?.perfil || '',
        idUsuarioLogado: payload?.sub || payload?.id || payload?.usuario_id || '',
      };
    } catch (error) {
      console.error('Erro ao ler dados do token', error);
      return {
        payload: null,
        perfilUsuario: '',
        idUsuarioLogado: '',
      };
    }
  }, [token]);
}
