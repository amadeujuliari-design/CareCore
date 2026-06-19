import AuthenticatedImage from './AuthenticatedImage';
import logoEmblemaCarecore from '../assets/logo-emblema.png';
import { usuarioEhPerfilManutencao } from '../config/manutencao';

export default function UserAvatar({
  usuario,
  nome,
  avatarUrl,
  size = 'md',
  className = '',
}) {
  const nomeFinal = nome || usuario?.nome || usuario?.email || 'Usuário';
  const foto = avatarUrl || usuario?.avatar_url || '';
  const fotoEhUpload = /^\/?uploads\//i.test(foto);
  const exibirEmblemaCarecore = !foto && usuarioEhPerfilManutencao(usuario);
  const inicial = (nomeFinal || 'U').slice(0, 1).toUpperCase();
  const sizes = {
    sm: 'h-9 w-9 text-xs rounded-xl',
    md: 'h-11 w-11 text-sm rounded-2xl',
    lg: 'h-16 w-16 text-lg rounded-3xl',
  };
  const sizeClass = sizes[size] || sizes.md;
  const temaClass = exibirEmblemaCarecore
    ? 'border-slate-200 bg-white'
    : 'border-violet-100 bg-violet-50 text-violet-700';

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border font-black ${temaClass} ${sizeClass} ${className}`}
      title={nomeFinal}
    >
      {fotoEhUpload ? (
        <AuthenticatedImage
          caminhoOuUrl={foto}
          alt={nomeFinal}
          className="h-full w-full object-cover"
        />
      ) : foto ? (
        <img
          src={foto}
          alt={nomeFinal}
          className="h-full w-full object-cover"
        />
      ) : exibirEmblemaCarecore ? (
        <img
          src={logoEmblemaCarecore}
          alt={nomeFinal}
          className="h-full w-full object-contain p-1"
          draggable={false}
        />
      ) : (
        inicial
      )}
    </div>
  );
}
