import { useMemo } from 'react';

const PERFIS_GESTAO = ['Gestor', 'Gestao', 'Gestão', 'Gerente'];
const PERFIS_DOCUMENTOS_RESTRITOS = [...PERFIS_GESTAO, 'Master'];
const PERFIS_TECNICOS = ['Técnico', 'Tecnico'];

export function usePermissoesProntuario({
  perfilUsuario,
  idUsuarioLogado,
  editandoId,
  tecnicoId,
}) {
  return useMemo(() => {
    const usuarioPodeGerenciarDocumentosRestritos = PERFIS_DOCUMENTOS_RESTRITOS.includes(perfilUsuario);
    const usuarioEhTecnico = PERFIS_TECNICOS.includes(perfilUsuario);
    const usuarioEhGestao = PERFIS_GESTAO.includes(perfilUsuario);
    const conviventeSemTecnicoAtrelado = !tecnicoId;
    const usuarioEhTecnicoResponsavel = usuarioEhTecnico && tecnicoId === idUsuarioLogado;
    const tecnicoPodeMudarStatus = usuarioEhTecnico && (conviventeSemTecnicoAtrelado || usuarioEhTecnicoResponsavel);

    return {
      usuarioPodeGerenciarDocumentosRestritos,
      usuarioPodeEnviarDocumentosRestritos: usuarioPodeGerenciarDocumentosRestritos || usuarioEhTecnico,
      podeMudarStatus: !editandoId || usuarioEhGestao || tecnicoPodeMudarStatus,
      podeCriarHistoricoConvivente: usuarioEhGestao || usuarioEhTecnico,
      podeEditarHistoricoConvivente: usuarioEhGestao || usuarioEhTecnicoResponsavel,
      usuarioPodeImprimirSensiveisConvivente: (convivente) => (
        usuarioEhGestao ||
        (usuarioEhTecnico && convivente?.tecnico_id === idUsuarioLogado)
      ),
    };
  }, [editandoId, idUsuarioLogado, perfilUsuario, tecnicoId]);
}
