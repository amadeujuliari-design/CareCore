import { classesPrioridade, normalizarPrioridade } from '../utils/ocorrenciasUtils';

export function BadgePrioridadeOcorrencia({ prioridade }) {
  const p = normalizarPrioridade(prioridade);
  return (
    <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider border ${classesPrioridade(p)}`}>
      {p}
    </span>
  );
}
