import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { usuarioEscopoOrganizacao } from '../utils/rbacUtils';

export default function ProjetoAtualBadge() {
  const { usuario, isGlobal, instituicaoId } = useAuth();
  const escopoOrganizacao = usuarioEscopoOrganizacao(usuario);
  const nomeSessao = escopoOrganizacao
    ? (usuario?.organizacao_nome || '')
    : (usuario?.projeto_nome || '');
  const [nomeExibido, setNomeExibido] = useState(nomeSessao);

  useEffect(() => {
    let ativo = true;

    if (escopoOrganizacao) {
      setNomeExibido(nomeSessao);
      return () => {
        ativo = false;
      };
    }

    api.get('/api/organizacao/projeto-atual')
      .then((response) => {
        if (ativo) {
          setNomeExibido(response.data?.nome_fantasia || nomeSessao);
        }
      })
      .catch(() => {
        if (ativo) {
          setNomeExibido(nomeSessao);
        }
      });

    return () => {
      ativo = false;
    };
  }, [escopoOrganizacao, instituicaoId, nomeSessao]);

  if (!nomeExibido) {
    return null;
  }

  const rotulo = escopoOrganizacao ? 'Organização:' : 'Projeto:';

  const conteudo = (
    <span
      className={`inline-flex max-w-[min(310px,calc(100vw-2rem))] items-center gap-2 rounded-full border px-3 py-2 text-xs font-black shadow-sm ${
        isGlobal
          ? 'border-violet-100 bg-violet-50 text-violet-950'
          : escopoOrganizacao
            ? 'border-orange-100 bg-orange-50 text-orange-950'
            : 'border-blue-100 bg-blue-50 text-blue-900'
      }`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isGlobal ? 'bg-violet-500' : escopoOrganizacao ? 'bg-orange-500' : 'bg-blue-500'
        }`}
      />
      {isGlobal && (
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-700">
          Global
        </span>
      )}
      <span className={isGlobal ? 'text-violet-700' : escopoOrganizacao ? 'text-orange-700' : 'text-blue-600'}>
        {rotulo}
      </span>
      <span className="truncate" title={nomeExibido}>{nomeExibido}</span>
    </span>
  );

  if (!isGlobal || escopoOrganizacao) {
    return conteudo;
  }

  return (
    <Link to="/organizacao" title="Trocar projeto">
      {conteudo}
    </Link>
  );
}
