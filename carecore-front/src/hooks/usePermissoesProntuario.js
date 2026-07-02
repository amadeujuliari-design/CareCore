import { useMemo } from 'react';

import {
  usuarioEhGlobalPuro,
  usuarioPodeEditarAcomodacao as rbacPodeEditarAcomodacao,
} from '../utils/rbacUtils';

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
    const somenteLeitura = usuarioEhGlobalPuro(usuarioRbac);
    const usuarioPodeGerenciarDocumentosRestritos = PERFIS_DOCUMENTOS_RESTRITOS.includes(perfilUsuario);
    const usuarioEhTecnico = PERFIS_TECNICOS.includes(perfilUsuario);
    const usuarioEhGestao = PERFIS_GESTAO.includes(perfilUsuario);
    const usuarioEhManutencao = PERFIS_MANUTENCAO.includes(perfilUsuario)
      || usuarioRbac.is_manutencao === true;
    const conviventeSemTecnicoAtrelado = !tecnicoId;
    const usuarioEhTecnicoResponsavel = usuarioEhTecnico && tecnicoId === idUsuarioLogado;
    const tecnicoPodeMudarStatus = usuarioEhTecnico && (conviventeSemTecnicoAtrelado || usuarioEhTecnicoResponsavel);

    return {
      somenteLeitura,
      usuarioPodeGerenciarDocumentosRestritos: somenteLeitura
        ? false
        : usuarioPodeGerenciarDocumentosRestritos,
      usuarioPodeEnviarDocumentosRestritos: somenteLeitura
        ? false
        : (usuarioPodeGerenciarDocumentosRestritos || usuarioEhTecnico),
      podeMudarStatus: somenteLeitura
        ? false
        : (!editandoId || usuarioEhGestao || usuarioEhManutencao || tecnicoPodeMudarStatus),
      podeCriarHistoricoConvivente: somenteLeitura ? false : (usuarioEhGestao || usuarioEhTecnico),
      podeEditarHistoricoConvivente: somenteLeitura
        ? false
        : (usuarioEhGestao || usuarioEhTecnicoResponsavel),
      podeGerenciarPiaConvivente: somenteLeitura
        ? false
        : (usuarioEhGestao || usuarioEhTecnico || usuarioEhManutencao),
      podeEditarAcomodacao: somenteLeitura ? false : rbacPodeEditarAcomodacao(usuarioRbac),
      usuarioPodeImprimirSensiveisConvivente: (convivente) => (
        !somenteLeitura && (
          usuarioEhGestao ||
          (usuarioEhTecnico && convivente?.tecnico_id === idUsuarioLogado)
        )
      ),
    };
  }, [editandoId, idUsuarioLogado, perfilUsuario, tecnicoId, usuario]);
}
