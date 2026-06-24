import { useMemo, useState } from 'react';
import { PremiumButton } from '../PremiumUI';
import { adicionarCatalogoSisaAtividade } from '../../services/atividadesService';

const OUTROS = '__outros__';

export default function SeletorCatalogoSisa({
  rotulo,
  tipo,
  valor,
  onChange,
  opcoes = [],
  disabled = false,
  onCatalogoAtualizado,
}) {
  const [modoOutros, setModoOutros] = useState(false);
  const [textoOutros, setTextoOutros] = useState('');
  const [salvandoOutros, setSalvandoOutros] = useState(false);
  const [erroOutros, setErroOutros] = useState('');

  const valorSelect = useMemo(() => {
    if (!valor) return '';
    const existe = opcoes.some((item) => item.valor === valor);
    if (existe) return valor;
    return modoOutros || valor ? OUTROS : '';
  }, [valor, opcoes, modoOutros]);

  const confirmarOutros = async () => {
    const texto = textoOutros.trim();
    if (!texto) {
      setErroOutros('Informe o texto.');
      return;
    }
    setSalvandoOutros(true);
    setErroOutros('');
    try {
      const catalogo = await adicionarCatalogoSisaAtividade(tipo, texto);
      onChange(texto);
      setModoOutros(false);
      setTextoOutros('');
      if (onCatalogoAtualizado) await onCatalogoAtualizado(catalogo);
    } catch (error) {
      setErroOutros(error.response?.data?.detail || 'Não foi possível salvar a opção.');
    } finally {
      setSalvandoOutros(false);
    }
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
            setTextoOutros(valor && !opcoes.some((item) => item.valor === valor) ? valor : '');
            onChange('');
            return;
          }
          setModoOutros(false);
          onChange(selecionado);
        }}
        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm normal-case"
      >
        <option value="">Selecione</option>
        {opcoes.map((item) => (
          <option key={item.valor} value={item.valor}>
            {item.valor}{item.personalizado ? ' (personalizado)' : ''}
          </option>
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
            disabled={disabled || salvandoOutros}
            placeholder="Digite o valor SISA"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          {erroOutros && <p className="text-xs font-semibold text-red-600">{erroOutros}</p>}
          <PremiumButton type="button" disabled={disabled || salvandoOutros} onClick={confirmarOutros}>
            {salvandoOutros ? 'Salvando...' : 'Salvar opção'}
          </PremiumButton>
        </div>
      )}
    </label>
  );
}
