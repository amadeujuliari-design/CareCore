import { useEffect, useMemo, useState } from 'react';
import { PremiumButton } from '../PremiumUI';
import {
  compararDatasIso,
  dataIsoNoIntervalo,
  formatarDataBr,
  mesAnoDeIso,
  ultimoDiaMes,
} from '../../utils/dataBrasilUtils';

const ROTULOS_DIAS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function chaveMes(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

function construirGradeMes(ano, mes) {
  const primeiro = new Date(ano, mes - 1, 1);
  const offset = (primeiro.getDay() + 6) % 7;
  const totalDias = ultimoDiaMes(ano, mes);
  const celulas = [];
  for (let i = 0; i < offset; i += 1) celulas.push(null);
  for (let dia = 1; dia <= totalDias; dia += 1) {
    const mesPad = String(mes).padStart(2, '0');
    const diaPad = String(dia).padStart(2, '0');
    celulas.push(`${ano}-${mesPad}-${diaPad}`);
  }
  return celulas;
}

export default function CalendarioDatasEspecificas({
  datasSelecionadas = [],
  onChange,
  dataInicio,
  dataFim,
  disabled = false,
}) {
  const mesInicial = useMemo(() => {
    const ref = mesAnoDeIso(dataInicio) || mesAnoDeIso(dataFim);
    if (ref) return ref;
    const hoje = new Date();
    return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
  }, [dataInicio, dataFim]);

  const [mesVisivel, setMesVisivel] = useState(mesInicial);

  useEffect(() => {
    setMesVisivel(mesInicial);
  }, [mesInicial.ano, mesInicial.mes]);

  const mesesDisponiveis = useMemo(() => {
    if (!dataInicio || !dataFim) return [];
    const inicio = mesAnoDeIso(dataInicio);
    const fim = mesAnoDeIso(dataFim);
    if (!inicio || !fim) return [];

    const lista = [];
    let ano = inicio.ano;
    let mes = inicio.mes;
    while (ano < fim.ano || (ano === fim.ano && mes <= fim.mes)) {
      lista.push({ ano, mes });
      mes += 1;
      if (mes > 12) {
        mes = 1;
        ano += 1;
      }
    }
    return lista;
  }, [dataInicio, dataFim]);

  const indiceMesVisivel = mesesDisponiveis.findIndex(
    (item) => item.ano === mesVisivel.ano && item.mes === mesVisivel.mes,
  );

  const alternarData = (dataIso) => {
    if (disabled || !dataIso) return;
    if (!dataIsoNoIntervalo(dataIso, dataInicio, dataFim)) return;
    const conjunto = new Set(datasSelecionadas);
    if (conjunto.has(dataIso)) conjunto.delete(dataIso);
    else conjunto.add(dataIso);
    onChange(Array.from(conjunto).sort(compararDatasIso));
  };

  const grade = construirGradeMes(mesVisivel.ano, mesVisivel.mes);
  const nomeMes = new Date(mesVisivel.ano, mesVisivel.mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  if (!dataInicio || !dataFim) {
    return (
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Informe <strong>vigência início</strong> e <strong>vigência fim</strong> acima para escolher as datas no calendário.
      </div>
    );
  }

  if (compararDatasIso(dataInicio, dataFim) > 0) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        A vigência início não pode ser posterior à vigência fim.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Datas específicas no período ({formatarDataBr(dataInicio)} a {formatarDataBr(dataFim)})
        </p>
        <div className="flex gap-2">
          <PremiumButton
            type="button"
            variant="secondary"
            disabled={disabled || indiceMesVisivel <= 0}
            onClick={() => setMesVisivel(mesesDisponiveis[indiceMesVisivel - 1])}
          >
            ‹
          </PremiumButton>
          <PremiumButton
            type="button"
            variant="secondary"
            disabled={disabled || indiceMesVisivel < 0 || indiceMesVisivel >= mesesDisponiveis.length - 1}
            onClick={() => setMesVisivel(mesesDisponiveis[indiceMesVisivel + 1])}
          >
            ›
          </PremiumButton>
        </div>
      </div>

      <p className="text-sm font-semibold capitalize text-gray-800">{nomeMes}</p>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-gray-500">
        {ROTULOS_DIAS.map((dia) => (
          <div key={dia} className="py-1">{dia}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grade.map((dataIso, index) => {
          if (!dataIso) {
            return <div key={`vazio-${index}`} className="h-10" />;
          }
          const noIntervalo = dataIsoNoIntervalo(dataIso, dataInicio, dataFim);
          const selecionada = datasSelecionadas.includes(dataIso);
          const diaNum = Number(dataIso.slice(8, 10));
          return (
            <button
              key={dataIso}
              type="button"
              disabled={disabled || !noIntervalo}
              onClick={() => alternarData(dataIso)}
              className={`h-10 rounded-xl text-sm font-semibold transition-colors ${
                selecionada
                  ? 'bg-brand text-white'
                  : noIntervalo
                    ? 'bg-gray-50 text-gray-800 hover:bg-gray-100'
                    : 'bg-transparent text-gray-300 cursor-not-allowed'
              }`}
              title={formatarDataBr(dataIso)}
            >
              {diaNum}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          {datasSelecionadas.length} data(s) selecionada(s)
        </p>
        {datasSelecionadas.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Clique nos dias do calendário para adicionar.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {datasSelecionadas.map((dataIso) => (
              <button
                key={dataIso}
                type="button"
                disabled={disabled}
                onClick={() => alternarData(dataIso)}
                className="rounded-full border border-brand/20 bg-white px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/5"
              >
                {formatarDataBr(dataIso)} ×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
