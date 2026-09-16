import { Mail } from 'lucide-react';

import { useFecharSoNoBackdrop } from '../hooks/useFecharSoNoBackdrop';
import { PremiumButton } from './PremiumUI';

const CORPO_MAX = 8000;

export default function ModalRevisarEmailCompras({
  aberto,
  titulo = 'Revisar texto do e-mail',
  assunto = '',
  corpo = '',
  avisoAssinatura = '',
  carregando = false,
  enviando = false,
  erro = '',
  onCorpoChange,
  onCancelar,
  onConfirmar,
}) {
  const { onMouseDownBackdrop, onClickBackdrop } = useFecharSoNoBackdrop(onCancelar);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="revisar-email-compras-titulo"
      onMouseDown={onMouseDownBackdrop}
      onClick={onClickBackdrop}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compras</p>
          <h2 id="revisar-email-compras-titulo" className="mt-1 text-lg font-bold text-slate-900">
            {titulo}
          </h2>
          {assunto ? (
            <p className="mt-2 text-sm text-slate-600">
              Assunto: <span className="font-medium text-slate-800">{assunto}</span>
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {carregando ? (
            <p className="text-sm text-slate-500">Carregando texto padrão…</p>
          ) : (
            <>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Texto do e-mail
              </label>
              <textarea
                value={corpo}
                onChange={(e) => onCorpoChange?.(e.target.value.slice(0, CORPO_MAX))}
                rows={12}
                maxLength={CORPO_MAX}
                disabled={enviando}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
              />
              <p className="mt-1 text-xs text-slate-500">
                {corpo.length}/{CORPO_MAX} caracteres. Altere ou acrescente o que for necessário antes de enviar.
              </p>
              {avisoAssinatura ? (
                <p className="mt-3 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-xs text-violet-900">
                  {avisoAssinatura}
                </p>
              ) : (
                <p className="mt-3 text-xs text-slate-500">
                  Envios pelo projeto usam a caixa do projeto, sem o cartão de assinatura da Sede.
                </p>
              )}
              {erro ? (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {erro}
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <PremiumButton type="button" variant="secondary" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </PremiumButton>
          <PremiumButton
            type="button"
            disabled={carregando || enviando || !String(corpo || '').trim()}
            onClick={onConfirmar}
          >
            <span className="inline-flex items-center gap-1.5">
              <Mail size={16} />
              {enviando ? 'Enviando…' : 'Enviar e-mail'}
            </span>
          </PremiumButton>
        </div>
      </div>
    </div>
  );
}
