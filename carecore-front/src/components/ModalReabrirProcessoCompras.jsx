import { useEffect, useState } from 'react';

import { PremiumButton } from './PremiumUI';

/**
 * Sede escolhe a fase do fluxo e informa o motivo para reabrir o pedido.
 */
export default function ModalReabrirProcessoCompras({
  aberto,
  fases = [],
  salvando = false,
  onCancelar,
  onConfirmar,
}) {
  const [fase, setFase] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (!aberto) return;
    setFase(fases[0]?.id || '');
    setMotivo('');
  }, [aberto, fases]);

  if (!aberto) return null;

  const faseAtual = fases.find((item) => item.id === fase) || null;
  const motivoOk = motivo.trim().length >= 3;
  const podeConfirmar = Boolean(fase) && motivoOk && !salvando;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reabrir-processo-titulo"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h3 id="reabrir-processo-titulo" className="text-lg font-semibold text-slate-900">
          Reabrir processo
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Escolha até qual fase o pedido deve voltar. O status e os marcadores do processo
          serão atualizados; a timeline registra o motivo. O pedido sai de concluídos.
        </p>

        {fases.length === 0 ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Não há fases disponíveis para reabrir neste pedido.
          </p>
        ) : (
          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-semibold text-slate-800">Fase</legend>
            {fases.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                  fase === item.id
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="fase-reabertura"
                  className="mt-1"
                  checked={fase === item.id}
                  onChange={() => setFase(item.id)}
                  disabled={salvando}
                />
                <span>
                  <span className="block font-semibold text-slate-900">{item.rotulo}</span>
                  {item.ajuda ? (
                    <span className="mt-0.5 block text-xs text-slate-600">{item.ajuda}</span>
                  ) : null}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {faseAtual?.ajuda ? (
          <p className="mt-3 text-xs text-slate-500 sm:hidden">{faseAtual.ajuda}</p>
        ) : null}

        <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="motivo-reabertura">
          Motivo da reabertura
        </label>
        <textarea
          id="motivo-reabertura"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={3}
          disabled={salvando}
          placeholder="Descreva o erro a corrigir (obrigatório)"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
        />

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <PremiumButton type="button" variant="secondary" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </PremiumButton>
          <PremiumButton
            type="button"
            disabled={!podeConfirmar}
            onClick={() => onConfirmar({ fase, motivo: motivo.trim() })}
          >
            {salvando ? 'Reabrindo…' : 'Confirmar reabertura'}
          </PremiumButton>
        </div>
      </div>
    </div>
  );
}
