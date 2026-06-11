import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  limparSessaoLocal,
  salvarSessaoLocal,
} from '../services/api';
import {
  registrarAtividadeSessao,
  sessaoExpiradaPorInatividade,
} from '../utils/sessionInatividadeUtils';
import { decodificarPayloadJwt } from '../utils/jwtUtils';

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
    const payload = decodificarPayloadJwt(token);

    if (!payload) {
      return true;
    }

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

        if (
          !token ||
          !usuarioRaw ||
          tokenExpirado(token) ||
          sessaoExpiradaPorInatividade()
        ) {
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

  useEffect(() => {
    if (!usuario) {
      return undefined;
    }

    let ultimaAtualizacao = 0;

    const encerrarSeExpirada = () => {
      if (!sessaoExpiradaPorInatividade()) {
        return false;
      }

      limparSessaoLocal();
      setUsuario(null);

      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }

      return true;
    };

    const registrarAtividade = () => {
      if (encerrarSeExpirada()) {
        return;
      }

      const agora = Date.now();

      if (agora - ultimaAtualizacao < 30000) {
        return;
      }

      ultimaAtualizacao = agora;
      registrarAtividadeSessao();
    };

    const eventosAtividade = [
      'click',
      'keydown',
      'mousemove',
      'scroll',
      'touchstart',
    ];

    eventosAtividade.forEach((evento) => {
      window.addEventListener(evento, registrarAtividade, { passive: true });
    });

    const intervalo = window.setInterval(encerrarSeExpirada, 60000);

    const sincronizarEntreAbas = (event) => {
      if (
        event.key === '@CareCore:token' &&
        !event.newValue
      ) {
        setUsuario(null);
      }
    };

    window.addEventListener('storage', sincronizarEntreAbas);

    return () => {
      eventosAtividade.forEach((evento) => {
        window.removeEventListener(evento, registrarAtividade);
      });
      window.clearInterval(intervalo);
      window.removeEventListener('storage', sincronizarEntreAbas);
    };
  }, [usuario]);

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
