import { useMemo } from 'react';

import { usuarioPodeEditarAcomodacao as rbacPodeEditarAcomodacao } from '../utils/rbacUtils';

const PERFIS_GESTAO = ['Gestor', 'Gestao', 'Gestão', 'Gerente'];
const PERFIS_DOCUMENTOS_RESTRITOS = [...PERFIS_GESTAO, 'Master'];
const PERFIS_TECNICOS = ['Técnico', 'Tecnico'];
const PERFIS_MANUTENCAO = ['Manutenção', 'Manutencao'];

/** @deprecated Prefira rbacUtils.usuarioPodeEditarAcomodacao(usuario) com o objeto do token. */
export function usuarioPodeEditarAcomodacao(perfilUsuario, isMaster = false, usuario = null) {
  if (usuario) {
    return rbacPodeEditarAcomodacao(usuario);
  }

  return rbacPodeEditarAcomodacao({
    perfil_acesso: perfilUsuario,
    is_master: isMaster,
    is_manutencao: PERFIS_MANUTENCAO.includes(perfilUsuario),
  });
}

export function usePermissoesProntuario({
  perfilUsuario,
  usuario,
  idUsuarioLogado,
  editandoId,
  tecnicoId,
}) {
  return useMemo(() => {
    const usuarioRbac = usuario || { perfil_acesso: perfilUsuario };
    const usuarioPodeGerenciarDocumentosRestritos = PERFIS_DOCUMENTOS_RESTRITOS.includes(perfilUsuario);
    const usuarioEhTecnico = PERFIS_TECNICOS.includes(perfilUsuario);
    const usuarioEhGestao = PERFIS_GESTAO.includes(perfilUsuario);
    const usuarioEhManutencao = PERFIS_MANUTENCAO.includes(perfilUsuario)
      || usuarioRbac.is_manutencao === true;
    const conviventeSemTecnicoAtrelado = !tecnicoId;
    const usuarioEhTecnicoResponsavel = usuarioEhTecnico && tecnicoId === idUsuarioLogado;
    const tecnicoPodeMudarStatus = usuarioEhTecnico && (conviventeSemTecnicoAtrelado || usuarioEhTecnicoResponsavel);

    return {
      usuarioPodeGerenciarDocumentosRestritos,
      usuarioPodeEnviarDocumentosRestritos: usuarioPodeGerenciarDocumentosRestritos || usuarioEhTecnico,
      podeMudarStatus: !editandoId || usuarioEhGestao || usuarioEhManutencao || tecnicoPodeMudarStatus,
      podeCriarHistoricoConvivente: usuarioEhGestao || usuarioEhTecnico,
      podeEditarHistoricoConvivente: usuarioEhGestao || usuarioEhTecnicoResponsavel,
      podeGerenciarPiaConvivente: usuarioEhGestao || usuarioEhTecnico || usuarioEhManutencao,
      podeEditarAcomodacao: rbacPodeEditarAcomodacao(usuarioRbac),
      usuarioPodeImprimirSensiveisConvivente: (convivente) => (
        usuarioEhGestao ||
        (usuarioEhTecnico && convivente?.tecnico_id === idUsuarioLogado)
      ),
    };
  }, [editandoId, idUsuarioLogado, perfilUsuario, tecnicoId, usuario]);
}
