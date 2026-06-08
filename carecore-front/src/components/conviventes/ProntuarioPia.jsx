export default function ProntuarioPia({
  editandoId,
  formPia,
  setFormPia,
  formularioPiaEvolucao,
  registroPiaMaisRecente,
  registrosPia,
  registrosPiaPrincipais,
  evolucoesPorRegistroPia,
  loadingPia,
  salvandoPia,
  temasEvolucaoPia,
  prepararEvolucaoPia,
  prepararNovoPiaPrincipal,
  handleSalvarRegistroPia,
  carregarRegistrosPia,
}) {
  if (!editandoId) {
    return (
      <div className="space-y-5">
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
          <h3 className="text-sm font-bold text-yellow-800">Ação Necessária</h3>
          <p className="text-xs text-yellow-700 mt-1">Salve os dados do acolhido para habilitar o PIA.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
        <h2 className="text-base font-black text-indigo-950">PIA - Plano Individual de Atendimento</h2>
        <p className="mt-1 text-xs text-indigo-700">Registre o plano principal do convivente e mantenha as evoluções no mesmo histórico.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 bg-indigo-50 p-4 rounded-xl border border-indigo-100 h-fit space-y-3">
          <div>
            <h3 className="text-sm font-black text-indigo-900">{formularioPiaEvolucao ? 'Evoluir PIA existente' : 'Novo PIA principal'}</h3>
            <p className="text-[11px] text-indigo-700 mt-1">
              {formularioPiaEvolucao
                ? 'A evolução fica vinculada ao PIA selecionado, com data, hora e responsável.'
                : 'Abra um registro principal para concentrar as evoluções futuras deste plano.'}
            </p>
          </div>

          {registroPiaMaisRecente && (
            <div className="grid grid-cols-1 gap-2">
              <button type="button" onClick={() => prepararEvolucaoPia(registroPiaMaisRecente)} className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100">
                Evoluir PIA atual
              </button>
              <button type="button" onClick={prepararNovoPiaPrincipal} className="w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 hover:bg-amber-100">
                Abrir novo PIA principal
              </button>
            </div>
          )}

          {formularioPiaEvolucao && registrosPiaPrincipais.length > 1 && (
            <select
              value={formPia.registro_pai_id}
              onChange={(e) => prepararEvolucaoPia(registrosPiaPrincipais.find(registro => registro.id === e.target.value))}
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm"
            >
              {registrosPiaPrincipais.map((registro) => (
                <option key={registro.id} value={registro.id}>
                  {registro.titulo} - {new Date(registro.data_registro).toLocaleDateString('pt-BR')}
                </option>
              ))}
            </select>
          )}

          {!formularioPiaEvolucao ? (
            <input
              type="text"
              value={formPia.titulo}
              onChange={(e) => setFormPia(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Título do PIA principal"
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm"
            />
          ) : (
            <div className="rounded-lg border border-indigo-200 bg-white p-3">
              <p className="text-[10px] font-black uppercase text-indigo-500">Título do registro</p>
              <p className="text-sm font-black text-indigo-900">Evolução</p>
            </div>
          )}

          {formularioPiaEvolucao && (
            <>
              <input
                type="text"
                list="temas-evolucao-pia"
                value={formPia.subtitulo}
                onChange={(e) => setFormPia(prev => ({ ...prev, subtitulo: e.target.value }))}
                placeholder="Subtítulo/tema da evolução"
                className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm"
              />
              <datalist id="temas-evolucao-pia">
                {temasEvolucaoPia.map((tema) => (
                  <option key={tema} value={tema} />
                ))}
              </datalist>
            </>
          )}

          <textarea
            value={formPia.descricao}
            onChange={(e) => setFormPia(prev => ({ ...prev, descricao: e.target.value }))}
            rows="4"
            placeholder={formularioPiaEvolucao ? 'Descrição da evolução do atendimento' : 'Descrição inicial do plano individual'}
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm resize-none"
          />

          <textarea
            value={formPia.objetivos}
            onChange={(e) => setFormPia(prev => ({ ...prev, objetivos: e.target.value }))}
            rows="2"
            placeholder="Objetivos/metas trabalhadas"
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm resize-none"
          />

          <textarea
            value={formPia.encaminhamentos}
            onChange={(e) => setFormPia(prev => ({ ...prev, encaminhamentos: e.target.value }))}
            rows="2"
            placeholder="Encaminhamentos e próximos passos"
            className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm resize-none"
          />

          <div>
            <label className="mb-1 block text-[11px] font-bold text-indigo-900">Status do registro</label>
            <select
              value={formPia.status}
              onChange={(e) => setFormPia(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-indigo-200 rounded-lg outline-none bg-white text-sm"
            >
              <option value="Em acompanhamento">Em acompanhamento</option>
              <option value="Pendente">Pendente</option>
              <option value="Concluído">Concluído</option>
              <option value="Revisar">Revisar</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleSalvarRegistroPia}
            disabled={salvandoPia}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-black disabled:opacity-50"
          >
            {salvandoPia ? 'Salvando...' : (formularioPiaEvolucao ? 'Salvar evolução' : 'Criar PIA principal')}
          </button>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-700 uppercase">Histórico do PIA ({registrosPia.length})</h3>
            <button type="button" onClick={() => carregarRegistrosPia(editandoId)} className="text-[11px] font-bold text-indigo-600 hover:underline">Atualizar</button>
          </div>

          {loadingPia ? (
            <div className="flex justify-center p-8"><p className="text-indigo-600 font-bold animate-pulse text-sm">Carregando PIA...</p></div>
          ) : registrosPiaPrincipais.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl">
              <p className="text-gray-500 text-sm font-medium">Nenhum PIA principal registrado até o momento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {registrosPiaPrincipais.map((registro) => {
                const evolucoes = evolucoesPorRegistroPia[registro.id] || [];

                return (
                  <article key={registro.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div>
                        <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase text-indigo-700 border border-indigo-100">
                          PIA principal
                        </span>
                        <h4 className="mt-2 text-sm font-black text-gray-900">{registro.titulo}</h4>
                      </div>
                      <div className="text-xs text-gray-500 md:text-right">
                        <p>{new Date(registro.data_registro).toLocaleString('pt-BR')}</p>
                        <p className="font-bold">{registro.usuario_nome || 'Usuário'}</p>
                      </div>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700 border border-gray-100">{registro.descricao}</p>

                    {(registro.objetivos || registro.encaminhamentos) && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {registro.objetivos && (
                          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                            <p className="font-black uppercase text-blue-700 mb-1">Objetivos</p>
                            <p className="whitespace-pre-wrap text-blue-900">{registro.objetivos}</p>
                          </div>
                        )}
                        {registro.encaminhamentos && (
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                            <p className="font-black uppercase text-emerald-700 mb-1">Encaminhamentos</p>
                            <p className="whitespace-pre-wrap text-emerald-900">{registro.encaminhamentos}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-black uppercase text-gray-600 w-fit">{registro.status}</span>
                      <button type="button" onClick={() => prepararEvolucaoPia(registro)} className="text-[11px] font-black text-indigo-600 hover:underline">
                        Evoluir este PIA
                      </button>
                    </div>

                    {evolucoes.length > 0 && (
                      <div className="mt-4 border-l-2 border-indigo-100 pl-4 space-y-3">
                        {evolucoes.map((evolucao) => (
                          <div key={evolucao.id} className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase text-indigo-500">Evolução</p>
                                <h5 className="text-sm font-black text-indigo-950">{evolucao.subtitulo || 'Sem subtítulo'}</h5>
                                <span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-gray-600 border border-indigo-100">
                                  {evolucao.status}
                                </span>
                              </div>
                              <div className="text-xs text-indigo-700 md:text-right">
                                <p>{new Date(evolucao.data_registro).toLocaleString('pt-BR')}</p>
                                <p className="font-bold">{evolucao.usuario_nome || 'Usuário'}</p>
                              </div>
                            </div>

                            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{evolucao.descricao}</p>

                            {(evolucao.objetivos || evolucao.encaminhamentos) && (
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                {evolucao.objetivos && (
                                  <div className="rounded-lg border border-blue-100 bg-white p-3">
                                    <p className="font-black uppercase text-blue-700 mb-1">Objetivos</p>
                                    <p className="whitespace-pre-wrap text-blue-900">{evolucao.objetivos}</p>
                                  </div>
                                )}
                                {evolucao.encaminhamentos && (
                                  <div className="rounded-lg border border-emerald-100 bg-white p-3">
                                    <p className="font-black uppercase text-emerald-700 mb-1">Encaminhamentos</p>
                                    <p className="whitespace-pre-wrap text-emerald-900">{evolucao.encaminhamentos}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
