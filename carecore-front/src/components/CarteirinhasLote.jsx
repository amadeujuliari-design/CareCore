import { useMemo, useState } from 'react';
import CarteirinhaCard from './CarteirinhaCard';
import { imprimirCarteirinhasLote } from '../utils/carteirinhaPrint';

const LAYOUTS = {
  '4': { porFolha: 4, colunas: 2, orientacao: 'portrait', escala: 1, label: '4 por folha · A4 retrato' },
  '6': { porFolha: 6, colunas: 3, orientacao: 'landscape', escala: 0.88, label: '6 por folha · A4 paisagem' },
  '8': { porFolha: 8, colunas: 4, orientacao: 'landscape', escala: 0.9, label: '8 por folha · A4 paisagem' },
};

export default function CarteirinhasLote({ conviventes = [], quartos = [], tecnicos = [], identidadeRelatorio = null }) {
  const [layoutKey, setLayoutKey] = useState('4');
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [guiasCorte, setGuiasCorte] = useState(true);
  const [busca, setBusca] = useState('');

  const layout = LAYOUTS[layoutKey] || LAYOUTS['6'];

  const conviventesFiltradosBusca = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return conviventes;

    return conviventes.filter((c) => {
      const alvo = [
        c.nome_social,
        c.nome_completo,
        c.numero_institucional,
        c.numero_sisa,
        c.cpf,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return alvo.includes(termo);
    });
  }, [conviventes, busca]);

  const selecionadosLista = useMemo(
    () => conviventes.filter((c) => selecionados.has(c.id)),
    [conviventes, selecionados]
  );

  const paginas = useMemo(() => {
    const grupos = [];
    for (let i = 0; i < selecionadosLista.length; i += layout.porFolha) {
      grupos.push(selecionadosLista.slice(i, i + layout.porFolha));
    }
    return grupos;
  }, [selecionadosLista, layout.porFolha]);

  const alternarSelecionado = (id) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  };

  const selecionarTodos = () => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      conviventesFiltradosBusca.forEach((c) => novo.add(c.id));
      return novo;
    });
  };
  const limparSelecao = () => setSelecionados(new Set());

  const imprimir = async () => {
    if (selecionadosLista.length === 0) return;
    await imprimirCarteirinhasLote({
      conviventes: selecionadosLista,
      quartos,
      tecnicos,
      orientacao: layout.orientacao,
      porFolha: layout.porFolha,
      colunas: layout.colunas,
      escala: layout.escala,
      guiasCorte,
      identidadeRelatorio,
    });
  };

  const escala = layout.escala;
  const dimensoesFolha = layout.orientacao === 'landscape'
    ? { largura: '297mm', altura: '210mm' }
    : { largura: '210mm', altura: '297mm' };
  const larguraCard = `calc(70mm * ${escala})`;
  const alturaCard = `calc(100mm * ${escala})`;

  return (
    <div className="space-y-6">
      <section className="carteirinha-no-print rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-black text-gray-900">Impressão de carteirinhas em lote</h2>
          <p className="text-xs text-gray-500">
            Selecione os conviventes (a lista respeita os filtros da central), escolha quantas por folha e imprima.
            No cadastro individual a impressão continua sendo de 1 por folha.
          </p>
          <p className="text-xs font-semibold text-blue-700">
            Recomendado: 4 por folha em retrato ou 6 por folha em paisagem.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Carteirinhas por folha</label>
            <select
              value={layoutKey}
              onChange={(e) => setLayoutKey(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
            >
              {Object.entries(LAYOUTS).map(([chave, cfg]) => (
                <option key={chave} value={chave}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-end gap-3 pb-2 text-sm font-bold text-gray-700">
            <input
              type="checkbox"
              checked={guiasCorte}
              onChange={(e) => setGuiasCorte(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Mostrar guias de corte
          </label>

          <div className="flex items-end justify-start gap-2 lg:justify-end">
            <button
              type="button"
              onClick={imprimir}
              disabled={selecionadosLista.length === 0}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-black text-white hover:bg-brandDark disabled:opacity-50"
            >
              Imprimir carteirinhas
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selecionarTodos}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100"
          >
            {busca.trim()
              ? `Selecionar resultados (${conviventesFiltradosBusca.length})`
              : `Selecionar todos (${conviventes.length})`}
          </button>
          <button
            type="button"
            onClick={limparSelecao}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100"
          >
            Limpar seleção
          </button>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 border border-blue-100">
            {selecionadosLista.length} selecionado(s) · {paginas.length} folha(s)
          </span>
        </div>

        <div className="mt-4">
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar convivente por nome, prontuário, SISA ou CPF..."
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-gray-100">
          {conviventes.length === 0 ? (
            <p className="p-6 text-center text-sm font-semibold text-gray-500">
              Nenhum convivente para os filtros atuais.
            </p>
          ) : conviventesFiltradosBusca.length === 0 ? (
            <p className="p-6 text-center text-sm font-semibold text-gray-500">
              Nenhum convivente encontrado para “{busca.trim()}”.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {conviventesFiltradosBusca.map((convivente) => (
                <li key={convivente.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selecionados.has(convivente.id)}
                      onChange={() => alternarSelecionado(convivente.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-gray-800">
                        {convivente.nome_social || convivente.nome_completo}
                      </span>
                      <span className="block text-[11px] font-semibold text-gray-500">
                        Pront. #{convivente.numero_institucional || 'S/N'} · SISA {convivente.numero_sisa || 'S/N'} · {convivente.status}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="carteirinha-no-print text-center text-xs font-bold uppercase tracking-widest text-gray-400">
        Pré-visualização da impressão
      </p>

      <div className="overflow-x-auto">
        <div id="carteirinhas-print" className="mx-auto bg-gray-100 p-4 print:bg-white print:p-0">
          {paginas.length === 0 ? (
            <div className="carteirinha-no-print rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm font-semibold text-gray-500">
              Selecione ao menos um convivente para gerar a folha de carteirinhas.
            </div>
          ) : (
            paginas.map((grupo, idxFolha) => (
              <div
                key={`folha-${idxFolha}`}
                className="carteirinha-folha mb-6 bg-white shadow"
                style={{
                  width: dimensoesFolha.largura,
                  minHeight: dimensoesFolha.altura,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${layout.colunas}, ${larguraCard})`,
                  gridAutoRows: alturaCard,
                  gap: '4mm',
                  justifyContent: 'center',
                  alignContent: 'start',
                  padding: '6mm',
                }}
              >
                {grupo.map((convivente) => (
                  <div
                    key={convivente.id}
                    style={{
                      width: larguraCard,
                      height: alturaCard,
                      outline: guiasCorte ? '1px dashed #cbd5e1' : 'none',
                    }}
                  >
                    <div style={{ transformOrigin: 'top left', transform: `scale(${escala})` }}>
                      <CarteirinhaCard
                        domId={`carteirinha-${convivente.id}`}
                        convivente={convivente}
                        quartos={quartos}
                        tecnicos={tecnicos}
                        identidadeRelatorio={identidadeRelatorio}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
