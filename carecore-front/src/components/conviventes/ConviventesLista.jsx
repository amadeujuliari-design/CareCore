import { formatarCPF } from '../../utils/conviventesUtils';
import { conviventeEhMeuCaso } from '../../hooks/useConviventesLista';
import AuthenticatedImage from '../AuthenticatedImage';
import { getFotoUrl } from '../../utils/rotinaDiariaUtils';

function FotoConviventeMini({ convivente }) {
  const fotoUrl = getFotoUrl(convivente);

  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center">
      {fotoUrl ? (
        <AuthenticatedImage
          caminhoOuUrl={fotoUrl}
          alt=""
          className="h-full w-full object-cover"
          lazy
        />
      ) : (
        <span className="text-base opacity-40">○</span>
      )}
    </div>
  );
}

export default function ConviventesLista({
  loading,
  conviventesFiltrados,
  conviventesVisiveis,
  exibindoApenasAtivos,
  termoPesquisa,
  setTermoPesquisa,
  filtroStatus,
  setFiltroStatus,
  filtroLeito,
  setFiltroLeito,
  indiceInicialConviventes,
  indiceFinalConviventes,
  paginaConviventesSegura,
  totalPaginasConviventes,
  irParaPaginaConviventes,
  idUsuarioLogado,
  usuarioTecnico,
  abrirFormulario,
  abrirParaEdicao,
  obterLocalizacaoLeito,
  statusConviventeClasse,
}) {
  return (
    <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-8 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">População Acolhida</h2>
        <button onClick={abrirFormulario} className="w-full bg-brand text-white px-6 py-2.5 rounded-xl hover:bg-brandDark font-semibold transition-all shadow-md transform hover:-translate-y-0.5 sm:w-auto">
          + Novo Acolhimento
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-gray-50/50 rounded-xl border border-gray-200 shadow-inner">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Pesquisar acolhido</label>
          <input type="text" value={termoPesquisa} onChange={(e) => setTermoPesquisa(e.target.value)} placeholder="Pesquise por prontuário, nome ou CPF..." className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Status</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-brand text-sm">
            <option value="Todos">Todos</option><option value="Ativo">Apenas Ativos</option><option value="Em acolhimento">Em acolhimento</option><option value="Ausência justificada">Ausência justificada</option><option value="Inativos">Inativos / saídas</option><option value="Saída qualificada">Saída qualificada</option><option value="Inativado">Inativado</option><option value="Bloqueado">Bloqueado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Acomodação</label>
          <select value={filtroLeito} onChange={(e) => setFiltroLeito(e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none bg-white focus:ring-2 focus:ring-brand text-sm">
            <option value="Todos">Todos</option><option value="Com Cama">Com Cama (Fixo/Trans.)</option><option value="Sem Cama">Sem Cama (Centro Dia)</option>
          </select>
        </div>
      </div>
      {exibindoApenasAtivos && (
        <p className="mb-5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2">
          Exibindo apenas acolhidos ativos. Para consultar ausências justificadas ou inativos, altere o filtro de status.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><p className="text-brand font-medium animate-pulse text-lg">Carregando acolhimentos...</p></div>
      ) : conviventesFiltrados.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl"><p className="text-gray-600 text-lg font-medium">Nenhum registro encontrado com estes filtros.</p></div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {conviventesVisiveis.map((c) => {
              const isMeuCaso = conviventeEhMeuCaso(c, idUsuarioLogado, usuarioTecnico);
              return (
                <article
                  key={c.id}
                  className={`rounded-3xl border p-4 shadow-sm ${isMeuCaso ? 'border-blue-100 bg-blue-50/70' : 'border-slate-100 bg-slate-50'}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <FotoConviventeMini convivente={c} />
                      <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-brand">
                        #{c.numero_institucional || 'Novo'}
                        {isMeuCaso && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[9px] text-white">Meu caso</span>}
                      </p>
                      <h3 className="mt-1 truncate text-base font-bold text-slate-900">
                        {c.nome_social || c.nome_completo}
                      </h3>
                      {c.nome_social && (
                        <p className="truncate text-xs text-slate-500">
                          Civil: {c.nome_completo}
                        </p>
                      )}
                      </div>
                    </div>

                    <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase ${statusConviventeClasse(c.status)}`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 rounded-2xl bg-white px-3 py-2 text-xs text-slate-600">
                    <p><strong>CPF:</strong> {c.cpf ? formatarCPF(c.cpf) : '-'}</p>
                    <p><strong>Acomodação:</strong> {obterLocalizacaoLeito(c.leito_id)}</p>
                    <p><strong>Carteirinhas impressas:</strong> {Number(c.impressoes_carteirinha_oficiais || 0)}</p>
                  </div>

                  <button
                    onClick={() => abrirParaEdicao(c)}
                    className="mt-4 min-h-11 w-full rounded-2xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm"
                  >
                    Abrir ficha
                  </button>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-800 text-sm border-b border-gray-200">
                  <th className="p-4 font-medium">Prontuário</th>
                  <th className="p-4 font-medium">Nome Completo / Social</th>
                  <th className="p-4 font-medium">CPF</th>
                  <th className="p-4 font-medium">Acomodação</th>
                  <th className="p-4 font-medium">Carteirinhas</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {conviventesVisiveis.map((c) => {
                  const isMeuCaso = conviventeEhMeuCaso(c, idUsuarioLogado, usuarioTecnico);
                  return (
                    <tr key={c.id} className={`transition-colors group border-b border-gray-100 last:border-0 ${isMeuCaso ? 'bg-blue-50/30 hover:bg-blue-50/70' : 'hover:bg-gray-50'}`}>
                      <td className="p-4 text-brand font-bold text-sm">
                        #{c.numero_institucional || 'Novo'}
                        {isMeuCaso && <span className="ml-2 text-[9px] bg-brand text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider" title="Este acolhido está sob a sua responsabilidade">Meu Caso</span>}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <FotoConviventeMini convivente={c} />
                          <div className="min-w-0">
                            <p className="text-gray-900 font-medium truncate">{c.nome_social || c.nome_completo}</p>
                            {c.nome_social && <p className="text-xs text-gray-500 mt-0.5 truncate">Civil: {c.nome_completo}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 font-mono text-sm">{c.cpf ? formatarCPF(c.cpf) : '-'}</td>
                      <td className="p-4">{obterLocalizacaoLeito(c.leito_id)}</td>
                      <td className="p-4 text-gray-600 text-sm font-semibold">
                        {Number(c.impressoes_carteirinha_oficiais || 0)}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider ${statusConviventeClasse(c.status)}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-right flex justify-end gap-2">
                        <button onClick={() => abrirParaEdicao(c)} className="text-brand hover:text-white font-semibold bg-brand/10 hover:bg-brand px-4 py-2 rounded-lg transition-all">
                          Abrir Ficha
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500">
              Exibindo {conviventesFiltrados.length === 0 ? 0 : indiceInicialConviventes + 1}
              {' '}a {Math.min(indiceFinalConviventes, conviventesFiltrados.length)}
              {' '}de {conviventesFiltrados.length} convivente{conviventesFiltrados.length === 1 ? '' : 's'}.
            </p>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => irParaPaginaConviventes(paginaConviventesSegura - 1)}
                disabled={paginaConviventesSegura <= 1}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 border border-slate-200">
                Página {paginaConviventesSegura} de {totalPaginasConviventes}
              </span>
              <button
                type="button"
                onClick={() => irParaPaginaConviventes(paginaConviventesSegura + 1)}
                disabled={paginaConviventesSegura >= totalPaginasConviventes}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
