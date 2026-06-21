import { useMemo } from 'react';

const PERFIS_GESTAO = ['Gestor', 'Gestao', 'Gestão', 'Gerente'];
const PERFIS_DOCUMENTOS_RESTRITOS = [...PERFIS_GESTAO, 'Master'];
const PERFIS_TECNICOS = ['Técnico', 'Tecnico'];
const PERFIS_MANUTENCAO = ['Manutenção', 'Manutencao'];

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
    const usuarioEhManutencao = PERFIS_MANUTENCAO.includes(perfilUsuario);
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
      usuarioPodeImprimirSensiveisConvivente: (convivente) => (
        usuarioEhGestao ||
        (usuarioEhTecnico && convivente?.tecnico_id === idUsuarioLogado)
      ),
    };
  }, [editandoId, idUsuarioLogado, perfilUsuario, tecnicoId]);
}
