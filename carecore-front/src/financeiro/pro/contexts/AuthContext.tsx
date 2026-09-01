import { useAuth as useCareCoreAuth } from '../../../context/AuthContext';

type FinanceProUser = {
  id: number | string;
  email?: string | null;
  name?: string | null;
};

export function useAuth() {
  const ctx = useCareCoreAuth();
  const usuario = ctx.usuario;

  const user: FinanceProUser | null = usuario
    ? {
        id: usuario.id ?? usuario.usuario_id,
        email: usuario.email ?? null,
        name: usuario.nome ?? usuario.name ?? null,
      }
    : null;

  return {
    ...ctx,
    user,
    signOut: ctx.logout,
  };
}
