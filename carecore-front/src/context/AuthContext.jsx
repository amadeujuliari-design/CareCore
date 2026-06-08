import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { limparSessaoLocal, salvarSessaoLocal } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_TOKEN_KEY = '@CareCore:token';
const STORAGE_USER_KEY = '@CareCore:user';

function obterSessaoLocal() {
  const token =
    localStorage.getItem(STORAGE_TOKEN_KEY) ||
    localStorage.getItem('token');

  const usuarioRaw =
    localStorage.getItem(STORAGE_USER_KEY) ||
    localStorage.getItem('usuario');

  return {
    token,
    usuarioRaw,
  };
}

function tokenExpirado(token) {
  try {
    const partes = token.split('.');

    if (partes.length !== 3) {
      return true;
    }

    const payload = JSON.parse(atob(partes[1]));

    if (!payload.exp) {
      return false;
    }

    const agora = Date.now() / 1000;

    return agora > payload.exp;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarSessao = () => {
      try {
        const { token, usuarioRaw } = obterSessaoLocal();

        if (!token || !usuarioRaw || tokenExpirado(token)) {
          limparSessaoLocal();
          setUsuario(null);
          return;
        }

        const usuarioParseado = JSON.parse(usuarioRaw);

        localStorage.setItem(STORAGE_TOKEN_KEY, token);
        localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(usuarioParseado));

        setUsuario(usuarioParseado);
      } catch {
        limparSessaoLocal();
        setUsuario(null);
      } finally {
        setLoading(false);
      }
    };

    carregarSessao();
  }, []);

  const login = ({ token, usuario }) => {
    salvarSessaoLocal(token, usuario);
    setUsuario(usuario);
  };

  const logout = () => {
    limparSessaoLocal();
    setUsuario(null);
    window.location.href = '/';
  };

  const value = useMemo(() => {
    return {
      usuario,
      setUsuario,
      loading,

      login,
      logout,

      isAuthenticated: !!usuario,
      isMaster: usuario?.is_master === true,
      isGlobal: usuario?.is_global === true,
      perfil: usuario?.perfil_acesso || null,
      instituicaoId: usuario?.instituicao_id || null,
      organizacaoId: usuario?.organizacao_id || null,
    };
  }, [usuario, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
