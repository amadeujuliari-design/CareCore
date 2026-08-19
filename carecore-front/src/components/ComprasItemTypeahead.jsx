import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { sugerirItensConsumo } from '../utils/comprasItensConsumoUtils';

export default function ComprasItemTypeahead({
  itens = [],
  value = '',
  onChange,
  onEscolher,
  placeholder = 'Digite para buscar no cadastro',
  required = false,
  disabled = false,
  className = 'md:col-span-2',
}) {
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const caixa = useRef(null);

  const sugestoes = useMemo(() => sugerirItensConsumo(itens, value), [itens, value]);

  useEffect(() => {
    setDestaque(0);
  }, [value]);

  useEffect(() => {
    const aoClicar = (evento) => {
      if (caixa.current && !caixa.current.contains(evento.target)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', aoClicar);
    return () => document.removeEventListener('mousedown', aoClicar);
  }, []);

  const escolher = (item) => {
    onEscolher?.(item);
    setAberto(false);
  };

  const usarDigitado = () => {
    onEscolher?.(null);
    setAberto(false);
  };

  return (
    <div ref={caixa} className={`relative ${className}`}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        required={required}
        disabled={disabled}
        autoComplete="off"
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
        onFocus={() => setAberto(Boolean(value.trim()))}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onKeyDown={(e) => {
          if (!aberto || sugestoes.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setDestaque((atual) => Math.min(atual + 1, sugestoes.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDestaque((atual) => Math.max(atual - 1, 0));
          } else if (e.key === 'Enter' && sugestoes[destaque]) {
            e.preventDefault();
            escolher(sugestoes[destaque]);
          } else if (e.key === 'Escape') {
            setAberto(false);
          }
        }}
      />
      {aberto && value.trim() && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {sugestoes.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">
              Nenhum item no cadastro. Inclua e cadastre agora, se for o caso.
              {' '}
              <button type="button" className="font-semibold text-slate-800 underline" onClick={usarDigitado}>
                Usar o texto digitado
              </button>
            </li>
          ) : (
            sugestoes.map((item, idx) => (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === destaque}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    idx === destaque ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  onMouseEnter={() => setDestaque(idx)}
                  onClick={() => escolher(item)}
                >
                  <strong className="block text-slate-900">{item.descricao}</strong>
                  <span className="text-xs text-slate-500">
                    {[item.categoria_nome, item.unidade_medida, item.embalagem, item.marca_preferencial].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
