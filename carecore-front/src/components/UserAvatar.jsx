export default function UserAvatar({
  usuario,
  nome,
  avatarUrl,
  size = 'md',
  className = '',
}) {
  const nomeFinal = nome || usuario?.nome || usuario?.email || 'Usuário';
  const foto = avatarUrl || usuario?.avatar_url || '';
  const inicial = (nomeFinal || 'U').slice(0, 1).toUpperCase();
  const sizes = {
    sm: 'h-9 w-9 text-xs rounded-xl',
    md: 'h-11 w-11 text-sm rounded-2xl',
    lg: 'h-16 w-16 text-lg rounded-3xl',
  };
  const sizeClass = sizes[size] || sizes.md;

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden border border-violet-100 bg-violet-50 font-black text-violet-700 ${sizeClass} ${className}`}
      title={nomeFinal}
    >
      {foto ? (
        <img
          src={foto}
          alt={nomeFinal}
          className="h-full w-full object-cover"
        />
      ) : (
        inicial
      )}
    </div>
  );
}
