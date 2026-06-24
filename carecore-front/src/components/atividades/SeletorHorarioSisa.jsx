import { useMemo, useState } from 'react';
import { PremiumButton } from '../PremiumUI';
import { HORARIOS_SISA_PADRAO, lerHorariosSisaPersonalizados, salvarHorarioSisaPersonalizado } from '../../config/atividadesConfig';

const OUTROS = '__outros__';

export default function SeletorHorarioSisa({
  valor,
  onChange,
  disabled = false,
  rotulo = 'Horário padrão SISA',
}) {
  const [modoOutros, setModoOutros] = useState(false);
  const [textoOutros, setTextoOutros] = useState('');
  const [erroOutros, setErroOutros] = useState('');
  const [personalizados, setPersonalizados] = useState(() => lerHorariosSisaPersonalizados());

  const opcoes = useMemo(() => {
    const vistos = new Set();
    const lista = [];
    [...HORARIOS_SISA_PADRAO, ...personalizados].forEach((item) => {
      const chave = item.trim().toLowerCase();
      if (!item || vistos.has(chave)) return;
      vistos.add(chave);
      lista.push(item);
    });
    if (valor && !lista.includes(valor)) lista.push(valor);
    return lista.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [personalizados, valor]);

  const valorSelect = useMemo(() => {
    if (!valor) return '';
    if (opcoes.includes(valor)) return valor;
    return modoOutros || valor ? OUTROS : '';
  }, [valor, opcoes, modoOutros]);

  const confirmarOutros = () => {
    const texto = textoOutros.trim();
    if (!texto) {
      setErroOutros('Informe o horário.');
      return;
    }
    salvarHorarioSisaPersonalizado(texto);
    setPersonalizados(lerHorariosSisaPersonalizados());
    onChange(texto);
    setModoOutros(false);
    setTextoOutros('');
    setErroOutros('');
  };

  return (
    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
      {rotulo}
      <select
        value={valorSelect}
        disabled={disabled}
        onChange={(event) => {
          const selecionado = event.target.value;
          if (selecionado === OUTROS) {
            setModoOutros(true);
            setTextoOutros(valor && !opcoes.includes(valor) ? valor : '');
            onChange('');
            return;
          }
          setModoOutros(false);
          onChange(selecionado);
        }}
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm normal-case"
      >
        <option value="">Selecione o horário</option>
        {opcoes.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
        <option value={OUTROS}>Outros…</option>
      </select>

      {(modoOutros || (valor && valorSelect === OUTROS)) && (
        <div className="mt-2 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
          <input
            value={modoOutros ? textoOutros : valor}
            onChange={(event) => {
              setModoOutros(true);
              setTextoOutros(event.target.value);
            }}
            disabled={disabled}
            placeholder="Ex.: 09:00 às 11:00"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm normal-case"
          />
          {erroOutros && <p className="text-xs font-semibold text-red-600">{erroOutros}</p>}
          <PremiumButton type="button" disabled={disabled} onClick={confirmarOutros}>
            Salvar horário
          </PremiumButton>
        </div>
      )}
    </label>
  );
}
