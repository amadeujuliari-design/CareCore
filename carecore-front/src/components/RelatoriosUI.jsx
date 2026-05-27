import { Link } from 'react-router-dom';

const STATUS_CLASSES = {
  pronto: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  parcial: 'bg-blue-50 text-blue-700 border-blue-200',
  planejado: 'bg-amber-50 text-amber-700 border-amber-200',
};

export function CardMetrica({ label, valor, detalhe }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-black text-gray-900 mt-1">{valor}</p>
      {detalhe && <p className="text-xs text-gray-500 mt-1">{detalhe}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`text-[10px] font-black px-2 py-1 rounded-full border uppercase ${STATUS_CLASSES[status] || STATUS_CLASSES.planejado}`}>
      {status === 'pronto' ? 'Disponivel' : status === 'parcial' ? 'Parcial' : 'Planejado'}
    </span>
  );
}

export function RelatorioCard({ item }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-gray-900 text-base">{item.titulo}</h3>
          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.descricao}</p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(item.metricas || []).map((m) => (
          <div key={m.label} className="rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p className="text-[10px] font-black text-gray-400 uppercase">{m.label}</p>
            <p className="text-xl font-black text-gray-900">{m.valor}</p>
          </div>
        ))}
      </div>

      {item.link && (
        <Link
          to={item.link}
          className="mt-auto inline-flex w-fit items-center rounded-xl bg-brand px-4 py-2 text-xs font-black text-white hover:bg-brandDark"
        >
          Abrir relatorio detalhado
        </Link>
      )}

      {!item.link && (
        <p className="mt-auto text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Ainda precisa de implementacao especifica.
        </p>
      )}
    </div>
  );
}
