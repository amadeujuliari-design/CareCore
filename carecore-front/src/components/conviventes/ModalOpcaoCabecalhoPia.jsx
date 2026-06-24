import { useEffect, useState } from 'react';

import {
  MODOS_CABECALHO_PIA_EVOLUCAO,
  carregarModoCabecalhoPiaEvolucao,
  salvarModoCabecalhoPiaEvolucao,
} from '../../config/piaEvolucaoPrintConfig';

export default function ModalOpcaoCabecalhoPia({
  aberto,
  onFechar,
  onConfirmar,
  modoLote = false,
  quantidade = 1,
  nomeConvivente = '',
  numeroProntuario = '',
  descricaoFiltros = '',
  carregando = false,
  progresso = null,
}) {
  const [modoSelecionado, setModoSelecionado] = useState(() => carregarModoCabecalhoPiaEvolucao());

  useEffect(() => {
    if (!aberto) return;
    setModoSelecionado(carregarModoCabecalhoPiaEvolucao());
  }, [aberto]);

  if (!aberto) return null;

  const confirmar = () => {
    salvarModoCabecalhoPiaEvolucao(modoSelecionado);
    onConfirmar(modoSelecionado);
  };

  const rotuloBotao = carregando
    ? (progresso
      ? `Preparando impressão (${progresso.atual}/${progresso.total})…`
      : 'Gerando impressão…')
    : (modoLote
      ? `Imprimir evolução (${quantidade} convivente${quantidade === 1 ? '' : 's'})`
      : 'Imprimir evolução do PIA');

  return (
    <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="carecore-modal-panel flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 p-6 pb-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
            Impressão do PIA
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-900">
            Evolução do PIA
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Escolha o formato do cabeçalho. O corpo inclui todos os PIAs principais e suas evoluções.
          </p>

          {modoLote ? (
            <div className="mt-3 space-y-2">
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <strong>{quantidade}</strong> convivente{quantidade === 1 ? '' : 's'} no filtro atual
              </p>
              {descricaoFiltros && (
                <p className="rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-900">
                  Filtros: {descricaoFiltros}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              {nomeConvivente || 'Convivente'}
              {numeroProntuario ? (
                <span className="ml-2 font-semibold text-slate-500">
                  · Prontuário #{numeroProntuario}
                </span>
              ) : null}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="space-y-2">
            {Object.values(MODOS_CABECALHO_PIA_EVOLUCAO).map((modo) => {
              const ativo = modoSelecionado === modo.id;
              return (
                <label
                  key={modo.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    ativo ? 'border-brand/30 bg-brand/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="modo-cabecalho-pia"
                    checked={ativo}
                    disabled={carregando}
                    onChange={() => setModoSelecionado(modo.id)}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-brand focus:ring-brand"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800">{modo.label}</span>
                    <span className="mt-0.5 block text-xs font-medium text-slate-500">{modo.descricao}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2 border-t border-slate-100 p-6 pt-4">
          <button
            type="button"
            onClick={confirmar}
            disabled={carregando}
            className="rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rotuloBotao}
          </button>
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
