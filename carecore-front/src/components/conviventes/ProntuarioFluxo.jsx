export default function ProntuarioFluxo({
  editandoId,
  loadingHistoricoFluxo,
  historicoFluxo,
}) {
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

  if (loadingHistoricoFluxo) {
    return (
      <div className="space-y-5">
        <div className="flex justify-center p-8">
          <p className="text-emerald-600 font-bold animate-pulse text-sm">
            Carregando histórico de fluxo...
          </p>
        </div>
      </div>
    );
  }

  if (historicoFluxo.length === 0) {
    return (
      <div className="space-y-5">
        <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
          <p className="text-gray-500 text-sm font-medium">
            Nenhum registro de fluxo encontrado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
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
                      ${
                        registro.tipo_registro === 'Entrada'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : registro.tipo_registro === 'Saída'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                      }
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
          </div>
        ))}
      </div>
    </div>
  );
}
