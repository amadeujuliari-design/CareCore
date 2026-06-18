import { Sparkles, ShieldCheck, Gauge, HeartHandshake } from 'lucide-react';

import logoCarecore from './assets/logo.PNG';

const ETAPAS = [
  { icone: Gauge, titulo: 'Performance', detalhe: 'Rotinas mais leves e rápidas' },
  { icone: ShieldCheck, titulo: 'Confiabilidade', detalhe: 'Base sólida para o dia a dia' },
  { icone: HeartHandshake, titulo: 'Experiência', detalhe: 'Cuidado em cada detalhe da tela' },
];

export default function ManutencaoProgramada() {
  return (
    <div className="manutencao-programada relative min-h-screen overflow-hidden bg-[#071326] text-white">
      <div className="manutencao-programada__orb manutencao-programada__orb--blue" aria-hidden="true" />
      <div className="manutencao-programada__orb manutencao-programada__orb--teal" aria-hidden="true" />
      <div className="manutencao-programada__orb manutencao-programada__orb--gold" aria-hidden="true" />
      <div className="manutencao-programada__grid" aria-hidden="true" />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="manutencao-programada__logo-wrap">
          <img
            src={logoCarecore}
            alt="CareCore+"
            className="h-16 w-auto object-contain sm:h-20"
          />
        </div>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-teal-100 backdrop-blur">
          <Sparkles className="h-4 w-4 text-amber-200" aria-hidden="true" />
          Manutenção programada
        </div>

        <h1 className="mt-8 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">
          Estamos elevando o que já era bom
          <span className="block bg-gradient-to-r from-teal-200 via-sky-200 to-amber-200 bg-clip-text text-transparent">
            para algo ainda melhor.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-base font-medium leading-relaxed text-slate-300 sm:text-lg">
          Em busca da excelência, nossa equipe está aprimorando o CareCore+ com foco em desempenho,
          estabilidade e uma experiência ainda mais clara para quem cuida de pessoas.
        </p>

        <p className="mt-4 max-w-xl text-sm font-semibold text-teal-100/90 sm:text-base">
          Em breve o CareCore+ estará de volta — mais preparado para apoiar sua rotina assistencial.
        </p>

        <div className="mt-10 w-full max-w-md">
          <div className="manutencao-programada__progress-track" aria-hidden="true">
            <div className="manutencao-programada__progress-bar" />
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Evolução em andamento
          </p>
        </div>

        <div className="mt-12 grid w-full max-w-3xl gap-4 sm:grid-cols-3">
          {ETAPAS.map(({ icone: Icone, titulo, detalhe }) => (
            <article
              key={titulo}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-left backdrop-blur-md"
            >
              <div className="inline-flex rounded-xl bg-white/10 p-2.5 text-teal-200">
                <Icone className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-sm font-black uppercase tracking-wide text-white">{titulo}</h2>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-400">{detalhe}</p>
            </article>
          ))}
        </div>

        <footer className="mt-14 text-xs font-semibold text-slate-500">
          CARECORE+ · Tecnologia que cuida
        </footer>
      </main>
    </div>
  );
}
