export function FiltroSelect({ label, value, onChange, opcoes }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        {opcoes.map(opcao => (
          <option key={opcao.valor} value={opcao.valor}>{opcao.label}</option>
        ))}
      </select>
    </div>
  );
}

export function ResumoCard({ titulo, valor, detalhe = '' }) {
  return (
    <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide">
        {titulo}
      </p>
      <p className="text-2xl font-black text-gray-800 mt-1">
        {Number(valor || 0).toLocaleString('pt-BR')}
      </p>
      {detalhe && (
        <p className="mt-1 text-[11px] font-semibold text-gray-500">
          {detalhe}
        </p>
      )}
    </div>
  );
}

export function PaginacaoSisa({
  totalItens,
  inicio,
  fim,
  paginaAtual,
  totalPaginas,
  onAnterior,
  onProxima,
  rotuloSingular,
  rotuloPlural,
}) {
  if (totalItens <= 0) return null;

  return (
    <div className="print:hidden mt-4 mb-6 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-semibold text-slate-500">
        Exibindo {inicio + 1} a {Math.min(fim, totalItens)} de {totalItens} {totalItens === 1 ? rotuloSingular : rotuloPlural}.
      </p>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          onClick={onAnterior}
          disabled={paginaAtual <= 1}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
          Página {paginaAtual} de {totalPaginas}
        </span>
        <button
          type="button"
          onClick={onProxima}
          disabled={paginaAtual >= totalPaginas}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

export function Th({ children }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-black text-gray-600 uppercase">
      {children}
    </th>
  );
}

export function Td({ children, destaque = false }) {
  return (
    <td className={`px-4 py-3 text-sm ${destaque ? 'font-bold text-gray-800 uppercase' : 'text-gray-700'}`}>
      {children}
    </td>
  );
}
