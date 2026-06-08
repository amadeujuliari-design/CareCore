import { useMemo } from 'react';

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
      const payload = JSON.parse(atob(token.split('.')[1]));

      return {
        payload,
        perfilUsuario: payload.perfil_acesso || payload.perfil || '',
        idUsuarioLogado: payload.sub || payload.id || payload.usuario_id || '',
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
