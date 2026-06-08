export default function ModalFichaSensivel({
  fichaSensivelPendente,
  setFichaSensivelPendente,
  abrirFichaCompleta,
}) {
  if (!fichaSensivelPendente) return null;

  return (
    <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="carecore-modal-panel w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-500">
          Impressão de ficha
        </p>
        <h2 className="mt-2 text-xl font-black text-slate-900">
          Incluir dados sensíveis?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Esta ficha pode ser impressa com ou sem dados sensíveis. Senhas do cofre não serão exibidas em texto aberto.
        </p>
        <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
          {fichaSensivelPendente.nome_social || fichaSensivelPendente.nome_completo}
        </p>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={() => {
              const convivente = fichaSensivelPendente;
              setFichaSensivelPendente(null);
              abrirFichaCompleta(convivente, true);
            }}
            className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-700"
          >
            Imprimir com dados sensíveis
          </button>
          <button
            type="button"
            onClick={() => {
              const convivente = fichaSensivelPendente;
              setFichaSensivelPendente(null);
              abrirFichaCompleta(convivente, false);
            }}
            className="rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brandDark"
          >
            Imprimir sem dados sensíveis
          </button>
          <button
            type="button"
            onClick={() => setFichaSensivelPendente(null)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            Cancelar impressão
          </button>
        </div>
      </div>
    </div>
  );
}
