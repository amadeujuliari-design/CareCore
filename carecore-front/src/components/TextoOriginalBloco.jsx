import { possuiTextoOriginalRegistro, usuarioPodeVerTextoOriginal } from '../utils/textoOriginalUtils';

export function TextoOriginalBloco({
  usuario,
  tituloOriginal,
  textoOriginal,
  motivoOriginal,
  descricaoOriginal,
  mensagemOriginal,
  className = '',
}) {
  if (!usuarioPodeVerTextoOriginal(usuario)) return null;

  const linhas = [];

  if (motivoOriginal?.trim()) {
    linhas.push({ rotulo: 'Título original', valor: motivoOriginal });
  } else if (tituloOriginal?.trim()) {
    linhas.push({ rotulo: 'Título original', valor: tituloOriginal });
  }

  if (descricaoOriginal?.trim()) {
    linhas.push({ rotulo: 'Texto original', valor: descricaoOriginal });
  } else if (mensagemOriginal?.trim()) {
    linhas.push({ rotulo: 'Texto original', valor: mensagemOriginal });
  } else if (textoOriginal?.trim()) {
    linhas.push({ rotulo: 'Texto original', valor: textoOriginal });
  }

  if (!possuiTextoOriginalRegistro({
    tituloOriginal,
    textoOriginal,
    motivoOriginal,
    descricaoOriginal,
    mensagemOriginal,
  })) {
    return null;
  }

  return (
    <div className={`mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 ${className}`}>
      {linhas.map((linha) => (
        <div key={linha.rotulo} className={linha.rotulo === 'Texto original' && linhas.length > 1 ? 'mt-3' : ''}>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{linha.rotulo}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm italic text-slate-600">{linha.valor}</p>
        </div>
      ))}
    </div>
  );
}
