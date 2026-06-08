import {
  DIREITOS_RESERVADOS_TITULO,
  obterUrlDireitosReservados,
} from '../utils/direitosReservados';

export default function DireitosReservadosAviso({ className = '' }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-white/80 px-4 py-3 text-[11px] font-bold text-slate-500 shadow-sm ${className}`}>
      <a
        href={obterUrlDireitosReservados()}
        className="text-brand underline-offset-2 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {DIREITOS_RESERVADOS_TITULO}
      </a>
    </div>
  );
}
