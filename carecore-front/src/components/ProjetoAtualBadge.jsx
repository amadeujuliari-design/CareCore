import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ProjetoAtualBadge() {
  const { usuario, isGlobal, instituicaoId } = useAuth();
  const nomeProjetoSessao = usuario?.projeto_nome || '';
  const [nomeProjeto, setNomeProjeto] = useState(nomeProjetoSessao);

  useEffect(() => {
    let ativo = true;

    api.get('/api/organizacao/projeto-atual')
      .then((response) => {
        if (ativo) {
          setNomeProjeto(response.data?.nome_fantasia || nomeProjetoSessao);
        }
      })
      .catch(() => {
        if (ativo) {
          setNomeProjeto(nomeProjetoSessao);
        }
      });

    return () => {
      ativo = false;
    };
  }, [instituicaoId, nomeProjetoSessao]);

  if (!nomeProjeto) {
    return null;
  }

  const conteudo = (
    <span
      className={`inline-flex max-w-[310px] items-center gap-2 rounded-full border px-3 py-2 text-xs font-black shadow-sm ${
        isGlobal
          ? 'border-violet-100 bg-violet-50 text-violet-950'
          : 'border-blue-100 bg-blue-50 text-blue-900'
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${isGlobal ? 'bg-violet-500' : 'bg-blue-500'}`} />
      {isGlobal && (
        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-700">
          Global
        </span>
      )}
      <span className={isGlobal ? 'text-violet-700' : 'text-blue-600'}>Projeto:</span>
      <span className="truncate" title={nomeProjeto}>{nomeProjeto}</span>
    </span>
  );

  if (!isGlobal) {
    return conteudo;
  }

  return (
    <Link to="/organizacao" title="Trocar projeto">
      {conteudo}
    </Link>
  );
}
