import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function CampoSenha({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete = 'current-password',
  className = '',
  required = true,
  name,
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visivel ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required={required}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        className={`block w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm shadow-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 ${className}`}
        placeholder={placeholder}
      />

      <button
        type="button"
        onClick={() => setVisivel((atual) => !atual)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-200"
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        tabIndex={-1}
      >
        {visivel ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
