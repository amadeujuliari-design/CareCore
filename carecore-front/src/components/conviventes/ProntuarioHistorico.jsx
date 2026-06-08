export default function ProntuarioHistorico({
  editandoId,
  formHistoricoConvivente,
  setFormHistoricoConvivente,
  historicoEditando,
  salvandoHistoricoConvivente,
  podeCriarHistoricoConvivente,
  podeEditarHistoricoConvivente,
  loadingHistoricosConvivente,
  historicosConvivente,
  loadingHistoricoFluxo,
  historicoFluxo,
  loadingOcorrencias,
  ocorrencias,
  carregarHistoricosConvivente,
  carregarHistoricoFluxo,
  cancelarEdicaoHistoricoConvivente,
  handleSalvarHistoricoConvivente,
  iniciarEdicaoHistoricoConvivente,
  excluirHistoricoConvivente,
}) {
  if (!editandoId) {
    return (
      <div className="space-y-5">
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-center">
          <h3 className="text-sm font-bold text-yellow-800">Ação Necessária</h3>
          <p className="text-xs text-yellow-700 mt-1">Salve os dados do acolhido para habilitar a Linha do Tempo e o Histórico de Ocorrências.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-black text-blue-950">Histórico do convivente</h3>
            <p className="mt-1 text-xs font-semibold text-blue-700">
              Histórico manual digitado pela equipe, com origem e data obrigatórias. Informações do legado SIAT podem ser promovidas para cá após validação.
            </p>
          </div>
          <button
            type="button"
            onClick={() => carregarHistoricosConvivente(editandoId)}
            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-700"
          >
            Atualizar
          </button>
        </div>

        {podeCriarHistoricoConvivente ? (
          <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-white p-4 md:grid-cols-4">
            {historicoEditando && (
              <div className="md:col-span-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                Editando histórico manual. Registros oriundos de apontamentos automáticos do sistema permanecem somente leitura.
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-bold text-blue-900">Origem da informação *</label>
              <input
                type="text"
                value={formHistoricoConvivente.origem_informacao}
                onChange={(e) => setFormHistoricoConvivente(prev => ({ ...prev, origem_informacao: e.target.value }))}
                placeholder="Ex: SIAT II, entrevista, documento..."
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-blue-900">Data de origem *</label>
              <input
                type="date"
                value={formHistoricoConvivente.data_origem}
                onChange={(e) => setFormHistoricoConvivente(prev => ({ ...prev, data_origem: e.target.value }))}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold text-blue-900">Título</label>
              <input
                type="text"
                value={formHistoricoConvivente.titulo}
                onChange={(e) => setFormHistoricoConvivente(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Resumo opcional"
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="md:col-span-4">
              <label className="mb-1 block text-xs font-bold text-blue-900">Informação histórica *</label>
              <textarea
                value={formHistoricoConvivente.descricao}
                onChange={(e) => setFormHistoricoConvivente(prev => ({ ...prev, descricao: e.target.value }))}
                rows="4"
                placeholder="Cole ou digite a informação que deve compor o histórico do convivente."
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2">
              {historicoEditando && (
                <button
                  type="button"
                  onClick={cancelarEdicaoHistoricoConvivente}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600"
                >
                  Cancelar edição
                </button>
              )}
              <button
                type="button"
                onClick={handleSalvarHistoricoConvivente}
                disabled={salvandoHistoricoConvivente}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {salvandoHistoricoConvivente ? 'Salvando...' : (historicoEditando ? 'Salvar edição' : 'Salvar histórico')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs font-semibold text-slate-600">
            Seu perfil pode consultar o histórico, mas não inserir novos registros no convivente.
          </div>
        )}

        {loadingHistoricosConvivente ? (
          <div className="mt-4 flex justify-center p-6">
            <p className="text-sm font-bold text-blue-700 animate-pulse">Carregando histórico do convivente...</p>
          </div>
        ) : historicosConvivente.length === 0 ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-blue-100 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">Nenhum histórico manual registrado para este convivente.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {historicosConvivente.map((registro) => (
              <article key={registro.id} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase text-blue-700 border border-blue-100">
                      HISTÓRICO MANUAL
                    </span>
                    <span className="ml-2 rounded-full bg-slate-50 px-3 py-1 text-[10px] font-black uppercase text-slate-600 border border-slate-100">
                      {registro.origem_informacao}
                    </span>
                    <h4 className="mt-2 text-sm font-black text-slate-900">{registro.titulo || 'Histórico registrado'}</h4>
                  </div>
                  <div className="text-xs text-slate-500 md:text-right">
                    <p>Origem: {new Date(`${registro.data_origem}T00:00:00`).toLocaleDateString('pt-BR')}</p>
                    <p>Lançado por {registro.usuario_nome || 'usuário'} em {new Date(registro.criado_em).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                  {registro.descricao}
                </p>
                {podeEditarHistoricoConvivente && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => iniciarEdicaoHistoricoConvivente(registro)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => excluirHistoricoConvivente(registro)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700"
                    >
                      Excluir
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-black text-emerald-950">Registros da rotina diária</h3>
            <p className="mt-1 text-xs font-semibold text-emerald-700">
              Entrada, saída e interações registradas no controle de fluxo. Estes apontamentos são somente leitura neste histórico.
            </p>
          </div>
          <button
            type="button"
            onClick={() => carregarHistoricoFluxo(editandoId)}
            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700"
          >
            Atualizar rotina
          </button>
        </div>

        {loadingHistoricoFluxo ? (
          <div className="mt-4 flex justify-center p-6">
            <p className="text-sm font-bold text-emerald-700 animate-pulse">Carregando rotina diária...</p>
          </div>
        ) : historicoFluxo.length === 0 ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-emerald-100 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">Nenhum registro de rotina encontrado para este convivente.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {historicoFluxo.map((registro, idx) => (
              <article key={registro.id || idx} className="rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`
                          rounded-full border px-3 py-1 text-[10px] font-black uppercase
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
                        <span className="rounded-full border border-yellow-300 bg-yellow-100 px-2 py-1 text-[10px] font-black text-yellow-800">
                          EDITADO
                        </span>
                      )}

                      {registro.cancelado && (
                        <span className="rounded-full border border-red-300 bg-red-100 px-2 py-1 text-[10px] font-black text-red-700">
                          CANCELADO
                        </span>
                      )}

                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-500">
                        Sistema
                      </span>
                    </div>

                    <p className="mt-3 text-sm text-slate-700">
                      Registrado por <span className="font-bold">{registro.usuario_nome || 'usuário'}</span>
                    </p>
                    {registro.usuario_perfil && (
                      <p className="mt-1 text-xs text-slate-500">Perfil: {registro.usuario_perfil}</p>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 md:text-right">
                    <p className="font-bold text-slate-800">{new Date(registro.data_registro).toLocaleString('pt-BR')}</p>
                    <p>Registro operacional</p>
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
              </article>
            ))}
          </div>
        )}
      </section>

      {loadingOcorrencias ? (
        <div className="flex justify-center p-8"><p className="text-brand font-bold animate-pulse text-sm">Carregando linha do tempo...</p></div>
      ) : ocorrencias.length === 0 ? (
        <section className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
          <div>
            <h3 className="text-sm font-black text-violet-950">Ocorrências</h3>
            <p className="mt-1 text-xs font-semibold text-violet-700">
              Chamados e eventos técnicos registrados na central de ocorrências.
            </p>
          </div>
          <div className="mt-4 text-center py-8 bg-white border-2 border-dashed border-violet-100 rounded-xl">
            <p className="text-gray-500 text-sm font-medium">Nenhuma ocorrência registrada no prontuário até o momento.</p>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
          <div>
            <h3 className="text-sm font-black text-violet-950">Ocorrências</h3>
            <p className="mt-1 text-xs font-semibold text-violet-700">
              Chamados e eventos técnicos registrados na central de ocorrências.
            </p>
          </div>
          <div className="relative border-l-2 border-violet-200 ml-3 md:ml-6 mt-4 space-y-6">
            {ocorrencias.map((ocorrencia, idx) => (
              <div key={ocorrencia.id || idx} className="relative pl-6">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-violet-600 border-4 border-white shadow"></div>
                <div className="bg-white p-4 rounded-xl border border-violet-100 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-2">
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] font-black bg-violet-50 text-violet-700 px-2 py-1 rounded-md uppercase tracking-wider border border-violet-100">
                        OCORRÊNCIA
                      </span>
                      <span className="text-[10px] font-bold bg-blue-50 text-brand px-2 py-1 rounded-md uppercase tracking-wider">{ocorrencia.tipo_ocorrencia}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500">
                      {new Date(ocorrencia.data_ocorrencia).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-800 mb-1">{ocorrencia.motivo}</h4>
                  <p className="text-xs text-gray-600 mb-3 bg-gray-50 p-3 rounded-lg border border-gray-100">{ocorrencia.descricao}</p>
                  {ocorrencia.requer_acao_tecnica && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${ocorrencia.status_resolucao === 'Pendente' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        Técnico: {ocorrencia.status_resolucao}
                      </span>
                      {ocorrencia.parecer_tecnico && (
                        <p className="text-[11px] text-gray-500 flex-1 ml-3 truncate">Parecer: {ocorrencia.parecer_tecnico}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
