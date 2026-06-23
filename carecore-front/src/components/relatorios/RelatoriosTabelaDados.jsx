export function RelatoriosTabelaDados({
  aba,
  colunasExportacao,
  dadosDetalhados,
  fimTabela,
  inicioTabela,
  irParaPaginaTabela,
  limiteAmostraOcorrencias,
  linhasExportacao,
  linhasTabelaPaginadas,
  paginaTabelaSegura,
  totalPaginasTabela,
}) {
  return (
    <section className="mt-6 bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-gray-900">{dadosDetalhados.titulo}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {aba === 'ocorrencias'
              ? `Exibição otimizada: a tabela mostra até ${limiteAmostraOcorrencias} ocorrências recentes do recorte, com 20 por página. Os cards usam o total calculado no servidor.`
              : 'Esta é a tabela que será enviada para XLSX/PDF. Exibindo 20 registros por página na tela.'}
          </p>
        </div>

        <span className="text-xs font-black text-brand bg-blue-50 border border-blue-100 rounded-full px-3 py-1">
          {linhasExportacao.length} registro(s)
        </span>
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {linhasTabelaPaginadas.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 text-center text-sm font-semibold text-gray-500">
            Nenhum registro encontrado com os filtros atuais.
          </div>
        ) : (
          linhasTabelaPaginadas.map((linha, index) => {
            const titulo = linha[colunasExportacao[2]] || linha[colunasExportacao[1]] || linha[colunasExportacao[0]] || `${dadosDetalhados.titulo} ${index + 1}`;
            const camposResumo = colunasExportacao.filter((coluna) => linha[coluna] !== undefined);

            return (
              <article
                key={`${aba}-mobile-${inicioTabela + index}`}
                className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 shadow-sm"
              >
                <p className="truncate text-sm font-black uppercase text-gray-800">
                  {titulo}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  {camposResumo.map((coluna) => (
                    <div key={coluna} className="rounded-xl bg-white px-3 py-2">
                      <p className="text-[10px] font-black uppercase text-gray-400">{coluna}</p>
                      <p className="mt-0.5 text-xs font-bold text-gray-700">{linha[coluna] ?? '-'}</p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {colunasExportacao.map((coluna) => (
                <th key={coluna} className="text-left text-[10px] font-black uppercase tracking-wider text-gray-400 px-4 py-3">
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {linhasTabelaPaginadas.map((linha, index) => (
              <tr key={`${aba}-${inicioTabela + index}`} className="border-b border-gray-50 hover:bg-gray-50">
                {colunasExportacao.map((coluna) => (
                  <td key={coluna} className="px-4 py-3 text-xs text-gray-700 align-top">
                    {coluna === 'Pendências de cadastro' ? (
                      <span className={`inline-flex min-w-8 justify-center rounded-full px-2 py-1 text-xs font-black ${
                        Number(linha[coluna] || 0) > 0
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {linha[coluna] ?? 0}
                      </span>
                    ) : coluna === 'Quais pendências' ? (
                      <span className={`text-[11px] font-semibold ${
                        linha[coluna] === 'Completo' || linha[coluna] === 'Cadastro completo'
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                      }`}>
                        {linha[coluna] ?? '-'}
                      </span>
                    ) : (
                      linha[coluna] ?? '-'
                    )}
                  </td>
                ))}
              </tr>
            ))}

            {linhasExportacao.length === 0 && (
              <tr>
                <td colSpan={colunasExportacao.length} className="px-4 py-8 text-center text-sm text-gray-500">
                  Nenhum registro encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {linhasExportacao.length > 0 && (
        <div className="border-t border-gray-100 bg-slate-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-slate-500">
            Exibindo {inicioTabela + 1} a {Math.min(fimTabela, linhasExportacao.length)} de {linhasExportacao.length} registro(s).
          </p>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => irParaPaginaTabela(paginaTabelaSegura - 1)}
              disabled={paginaTabelaSegura <= 1}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">
              Página {paginaTabelaSegura} de {totalPaginasTabela}
            </span>
            <button
              type="button"
              onClick={() => irParaPaginaTabela(paginaTabelaSegura + 1)}
              disabled={paginaTabelaSegura >= totalPaginasTabela}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
