/**
 * Alerta modal bloqueante (acima de outros modais) exigindo confirmação OK.
 */
export default function ModalAlertaOk({
  aberto,
  titulo = 'Atenção',
  mensagem,
  onFechar,
  rotuloBotao = 'OK',
}) {
  if (!aberto || !mensagem) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[1px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-ok-titulo"
      aria-describedby="alerta-ok-mensagem"
    >
      <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-5 shadow-2xl">
        <h3 id="alerta-ok-titulo" className="text-lg font-semibold text-slate-900">
          {titulo}
        </h3>
        <p
          id="alerta-ok-mensagem"
          className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700"
        >
          {mensagem}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            autoFocus
            onClick={onFechar}
            className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
          >
            {rotuloBotao}
          </button>
        </div>
      </div>
    </div>
  );
}
