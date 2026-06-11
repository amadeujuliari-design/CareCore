import { Navigate } from 'react-router-dom';

import ChatFlutuante from '../components/ChatFlutuante';
import { useAuth } from '../context/AuthContext';

const PERFIS_LEGADOS = {
  Gestao: 'Gestor',
  Gestão: 'Gestor',
  Gerente: 'Gestor',
  Tecnico: 'Técnico',
  Executivo: 'Global',
};

function normalizarPerfil(perfil) {
  if (!perfil) {
    return '';
  }

  return PERFIS_LEGADOS[perfil] || perfil;
}

export default function ProtectedRoute({
  children,
  perfis = [],
}) {
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
    perfis.length > 0 &&
    usuario.is_manutencao !== true &&
    !perfis.map(normalizarPerfil).includes(normalizarPerfil(usuario.perfil_acesso))
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-xl border border-red-100 max-w-md text-center">
          <h1 className="text-xl font-bold text-red-600">
            Acesso negado
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            Você não possui permissão para acessar este módulo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="carecore-premium-frame">
      {children}
      <ChatFlutuante />
    </div>
  );
}
