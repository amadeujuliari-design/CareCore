import ProntuarioFiltrosLista from './ProntuarioFiltrosLista';
import { TIPOS_REGISTRO_FLUXO_PRONTUARIO } from '../../utils/prontuarioHistoricoFluxoUtils';

export default function ProntuarioFluxo({
  editandoId,
  loadingHistoricoFluxo,
  historicoFluxo,
  filtrosFluxo,
  setFiltrosFluxo,
  aplicarFiltrosFluxo,
  restaurarFiltrosFluxoPadrao,
  carregarMaisHistoricoFluxo,
  fluxoTemMais,
  carregandoMaisFluxo,
}) {
  const classeBadgeTipo = (tipo) => {
    if (tipo === 'Entrada') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (tipo === 'Saída') {
      return 'bg-orange-50 text-orange-700 border-orange-200';
    }
    if (tipo?.startsWith('Lavanderia')) {
      return 'bg-violet-50 text-violet-700 border-violet-200';
    }
    if (tipo?.startsWith('Pertences recolhidos')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  if (!editandoId) {
    return (
      <div className="space-y-5">
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
          <h3 className="text-sm font-bold text-yellow-800">
            Ação Necessária
          </h3>

          <p className="text-xs text-yellow-700 mt-1">
            Salve os dados do acolhido para habilitar o histórico de fluxo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
        <h2 className="text-base font-black text-emerald-950">Fluxo Diário</h2>
        <p className="mt-1 text-xs font-semibold text-emerald-700">
          Movimentações operacionais do convivente: entradas, saídas, alimentação, lavanderia, pertences recolhidos e demais rotinas do dia.
        </p>
        <p className="mt-2 text-[11px] font-semibold text-emerald-800">
          Por padrão, exibimos os últimos 7 dias. Amplie o período nos filtros quando precisar.
        </p>
      </section>

      <ProntuarioFiltrosLista
        tituloResumo="Registros de rotina do convivente"
        dataInicio={filtrosFluxo.dataInicio}
        dataFim={filtrosFluxo.dataFim}
        onChangeDataInicio={(valor) => setFiltrosFluxo((prev) => ({ ...prev, dataInicio: valor }))}
        onChangeDataFim={(valor) => setFiltrosFluxo((prev) => ({ ...prev, dataFim: valor }))}
        busca={filtrosFluxo.busca}
        onChangeBusca={(valor) => setFiltrosFluxo((prev) => ({ ...prev, busca: valor }))}
        placeholderBusca="Buscar na observação ou tipo..."
        totalExibido={historicoFluxo.length}
        onAplicar={() => aplicarFiltrosFluxo(editandoId)}
        onLimpar={() => restaurarFiltrosFluxoPadrao(editandoId)}
        aplicando={loadingHistoricoFluxo}
        filtroExtra={(
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-700">Tipo de registro</label>
            <select
              value={filtrosFluxo.tipoRegistro}
              onChange={(e) => setFiltrosFluxo((prev) => ({ ...prev, tipoRegistro: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            >
              {TIPOS_REGISTRO_FLUXO_PRONTUARIO.map((tipo) => (
                <option key={tipo.valor || 'todos'} value={tipo.valor}>{tipo.label}</option>
              ))}
            </select>
          </div>
        )}
      />

      {loadingHistoricoFluxo && historicoFluxo.length === 0 ? (
        <div className="flex justify-center p-8">
          <p className="text-emerald-600 font-bold animate-pulse text-sm">
            Carregando histórico de fluxo...
          </p>
        </div>
      ) : historicoFluxo.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
          <p className="text-gray-500 text-sm font-medium">
            Nenhum registro de fluxo encontrado para os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
          {historicoFluxo.map((registro, idx) => (
            <div
              key={registro.id || idx}
              className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`
                        px-3 py-1 rounded-full text-xs font-black border
                        ${classeBadgeTipo(registro.tipo_registro)}
                      `}
                    >
                      {registro.tipo_registro}
                    </span>

                    {registro.foi_editado && (
                      <span className="px-2 py-1 rounded-full text-[10px] font-black bg-yellow-100 text-yellow-800 border border-yellow-300">
                        EDITADO
                      </span>
                    )}

                    {registro.cancelado && (
                      <span className="px-2 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-300">
                        CANCELADO
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-700 mt-3">
                    Registrado por:
                    <span className="font-bold ml-1">
                      {registro.usuario_nome}
                    </span>
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    Perfil: {registro.usuario_perfil}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-gray-800">
                    {new Date(registro.data_registro).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {registro.observacao && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                  {registro.observacao}
                </p>
              )}

              {(registro.motivo_edicao || registro.motivo_cancelamento || registro.justificativa_retorno_rapido) && (
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-3">
                  {registro.justificativa_retorno_rapido && (
                    <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-800">
                      <p className="font-black uppercase">Retorno rápido</p>
                      <p className="mt-1 whitespace-pre-wrap">{registro.justificativa_retorno_rapido}</p>
                    </div>
                  )}
                  {registro.motivo_edicao && (
                    <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-3 text-yellow-800">
                      <p className="font-black uppercase">Motivo da edição</p>
                      <p className="mt-1 whitespace-pre-wrap">{registro.motivo_edicao}</p>
                    </div>
                  )}
                  {registro.motivo_cancelamento && (
                    <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-red-800">
                      <p className="font-black uppercase">Motivo do cancelamento</p>
                      <p className="mt-1 whitespace-pre-wrap">{registro.motivo_cancelamento}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {fluxoTemMais && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => carregarMaisHistoricoFluxo(editandoId)}
            disabled={carregandoMaisFluxo}
            className="rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-black text-emerald-700 disabled:opacity-50"
          >
            {carregandoMaisFluxo ? 'Carregando...' : 'Carregar mais registros'}
          </button>
        </div>
      )}
    </div>
  );
}
