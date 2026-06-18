import { resumirPeriodoFiltro } from '../../utils/prontuarioHistoricoFluxoUtils';

export default function ProntuarioFiltrosLista({
  tituloResumo,
  dataInicio,
  dataFim,
  onChangeDataInicio,
  onChangeDataFim,
  busca,
  onChangeBusca,
  placeholderBusca = 'Buscar...',
  filtroExtra = null,
  totalExibido = 0,
  totalDisponivel = null,
  onAplicar,
  onLimpar,
  aplicando = false,
  children,
}) {
  const resumoTotal = totalDisponivel == null
    ? `${totalExibido} registro(s)`
    : `Mostrando ${totalExibido} de ${totalDisponivel}`;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Filtros</p>
          <p className="mt-1 text-sm font-bold text-slate-800">{tituloResumo}</p>
          <p className="text-xs font-semibold text-slate-500">
            Período: {resumirPeriodoFiltro(dataInicio, dataFim)} · {resumoTotal}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLimpar}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
          >
            Período padrão
          </button>
          <button
            type="button"
            onClick={onAplicar}
            disabled={aplicando}
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            {aplicando ? 'Aplicando...' : 'Aplicar filtros'}
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">Data inicial</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => onChangeDataInicio(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-700">Data final</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => onChangeDataFim(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          />
        </div>
        {filtroExtra}
        <div className={filtroExtra ? '' : 'md:col-span-2 xl:col-span-2'}>
          <label className="mb-1 block text-xs font-bold text-slate-700">Busca</label>
          <input
            type="text"
            value={busca}
            onChange={(e) => onChangeBusca(e.target.value)}
            placeholder={placeholderBusca}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      {children}
    </section>
  );
}
