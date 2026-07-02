import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import ChatFlutuante from '../components/ChatFlutuante';
import { useAuth } from '../context/AuthContext';
import {
  manutencaoProgramadaAtiva,
  MENSAGEM_LOGIN_BLOQUEADO_MANUTENCAO,
  usuarioPodeAcessarDuranteManutencao,
} from '../config/manutencao';
import {
  normalizarPerfilRbac,
  rotaEhModuloAtividades,
  rotaInicialPosLogin,
  usuarioEhOficineiro,
} from '../utils/rbacUtils';

const PERFIS_LEGADOS = {
  Gestao: 'Gestor',
  Gestão: 'Gestor',
  Gerente: 'Gestor',
  Tecnico: 'Técnico',
  Executivo: 'Global',
  Oficineiro: 'Oficineiro(a)',
};

function normalizarPerfil(perfil) {
  if (!perfil) {
    return '';
  }

  return PERFIS_LEGADOS[perfil] || normalizarPerfilRbac(perfil);
}

export default function ProtectedRoute({
  children,
  perfis = [],
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const {
    usuario,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100">
          <div className="animate-pulse text-gray-600 text-sm">
            Validando sessão...
          </div>
        </div>
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  if (
    manutencaoProgramadaAtiva()
    && !usuarioPodeAcessarDuranteManutencao(usuario)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow-xl border border-amber-100 max-w-md text-center">
          <h1 className="text-xl font-bold text-amber-700">
            Manutenção programada
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {MENSAGEM_LOGIN_BLOQUEADO_MANUTENCAO}
          </p>
        </div>
      </div>
    );
  }

  if (usuarioEhOficineiro(usuario) && !rotaEhModuloAtividades(pathname)) {
    return <Navigate to="/atividades/chamada" replace />;
  }

  if (
    perfis.length > 0 &&
    usuario.is_manutencao !== true &&
    !perfis.map(normalizarPerfil).includes(normalizarPerfil(usuario.perfil_acesso))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow-xl border border-red-100 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600">
            Acesso negado
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            Você não possui permissão para acessar este módulo.
          </p>

          <button
            type="button"
            onClick={() => navigate(rotaInicialPosLogin(usuario))}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brandDark transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="carecore-premium-frame">
      {children}
      {!usuarioEhOficineiro(usuario) && <ChatFlutuante />}
    </div>
  );
}
