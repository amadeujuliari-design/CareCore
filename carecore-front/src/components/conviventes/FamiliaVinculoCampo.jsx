import { useMemo, useState } from 'react';

function nomesDaFamilia(familia, conviventeId) {
  return (familia?.membros || [])
    .filter((membro) => membro.id !== conviventeId)
    .map((membro) => membro.nome)
    .filter(Boolean);
}

export default function FamiliaVinculoCampo({
  valor,
  onChange,
  familias,
  proximoCodigo,
  conviventeId,
}) {
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const atual = familias.find((familia) => familia.id === valor);

  const encontradas = useMemo(() => {
    if (!termo) return [];
    return familias.filter((familia) => {
      const nomes = (familia.membros || []).map((membro) => membro.nome).join(' ');
      return `${familia.codigo} ${nomes}`.toLowerCase().includes(termo);
    }).slice(0, 8);
  }, [familias, termo]);

  const outros = nomesDaFamilia(atual, conviventeId);

  return (
    <div className="rounded-xl border border-brand/30 bg-brand/5 p-3">
      <label className="block text-xs font-bold text-brand mb-1">Vínculo familiar</label>
      <p className="mb-2 text-xs text-slate-600">
        Escolha a família dos outros integrantes ou crie uma nova. O código (F001, F002…) é do sistema.
        No acolhimento seguinte, busque esse código para vincular o próximo.
      </p>
      <div className="mb-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange('')}
          className={`rounded-full px-3 py-1 text-xs font-bold ${valor === '' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
        >
          Sem vínculo
        </button>
        <button
          type="button"
          onClick={() => onChange('nova')}
          className={`rounded-full px-3 py-1 text-xs font-bold ${valor === 'nova' ? 'bg-brand text-white' : 'bg-white text-brand border border-brand/30'}`}
        >
          Nova família{proximoCodigo ? ` (${proximoCodigo})` : ''}
        </button>
      </div>
      {valor === 'nova' && (
        <p className="text-sm font-semibold text-slate-800">
          Ao salvar, esta pessoa abre a família {proximoCodigo || 'nova'}.
        </p>
      )}
      {atual && (
        <p className="text-sm font-semibold text-slate-800">
          Família {atual.codigo}
          {outros.length ? ` · ${outros.slice(0, 4).join(', ')}${outros.length > 4 ? ` e mais ${outros.length - 4}` : ''}` : ' · ainda sem outros integrantes'}
        </p>
      )}
      <input
        type="text"
        value={busca}
        onChange={(event) => setBusca(event.target.value)}
        placeholder="Busque pelo código ou pelo nome de um integrante"
        className="mt-2 w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm bg-white"
      />
      {termo && (
        <div className="mt-2 flex flex-col gap-1">
          {encontradas.map((familia) => {
            const nomes = nomesDaFamilia(familia, conviventeId);
            return (
              <button
                key={familia.id}
                type="button"
                onClick={() => {
                  onChange(familia.id);
                  setBusca('');
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:border-brand"
              >
                <span className="font-black text-brand">{familia.codigo}</span>
                <span className="text-slate-600"> · {nomes.slice(0, 3).join(', ') || 'sem integrantes'}</span>
              </button>
            );
          })}
          {encontradas.length === 0 && (
            <p className="text-xs text-slate-500">Nenhuma família encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
