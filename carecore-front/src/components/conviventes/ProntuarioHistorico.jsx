import ProntuarioFiltrosLista from './ProntuarioFiltrosLista';
import ProntuarioAcompanhamentos from './ProntuarioAcompanhamentos';
import { formatarDataBr } from '../../utils/dataBrasilUtils';

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
  totalHistoricoConvivente,
  filtrosHistorico,
  setFiltrosHistorico,
  aplicarFiltrosHistorico,
  restaurarFiltrosHistoricoPadrao,
  carregarMaisHistoricosConvivente,
  carregandoMaisHistorico,
  filtrosOcorrencias,
  setFiltrosOcorrencias,
  aplicarFiltrosOcorrencias,
  restaurarFiltrosOcorrenciasPadrao,
  carregarMaisOcorrenciasConvivente,
  carregandoMaisOcorrencias,
  totalOcorrenciasConvivente,
  ocorrenciasTemMais,
  loadingOcorrencias,
  ocorrencias,
  carregarHistoricosConvivente,
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
      <ProntuarioAcompanhamentos conviventeId={editandoId} />

      <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-sm font-black text-blue-950">Histórico técnico do convivente</h3>
            <p className="mt-1 text-xs font-semibold text-blue-700">
              Registros narrativos relevantes do prontuário. Movimentações de entrada, saída, lavanderia, pertences e demais rotinas ficam na aba Fluxo Diário.
            </p>
            <p className="mt-2 text-[11px] font-semibold text-blue-800">
              Por padrão, exibimos os últimos 30 dias do histórico manual.
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

        <ProntuarioFiltrosLista
          tituloResumo="Histórico manual do convivente"
          dataInicio={filtrosHistorico.dataInicio}
          dataFim={filtrosHistorico.dataFim}
          onChangeDataInicio={(valor) => setFiltrosHistorico((prev) => ({ ...prev, dataInicio: valor }))}
          onChangeDataFim={(valor) => setFiltrosHistorico((prev) => ({ ...prev, dataFim: valor }))}
          busca={filtrosHistorico.busca}
          onChangeBusca={(valor) => setFiltrosHistorico((prev) => ({ ...prev, busca: valor }))}
          placeholderBusca="Buscar no título, descrição ou origem..."
          totalExibido={historicosConvivente.length}
          totalDisponivel={totalHistoricoConvivente}
          onAplicar={() => aplicarFiltrosHistorico(editandoId)}
          onLimpar={() => restaurarFiltrosHistoricoPadrao(editandoId)}
          aplicando={loadingHistoricosConvivente}
          filtroExtra={(
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-700">Origem da informação</label>
              <input
                type="text"
                value={filtrosHistorico.origemInformacao}
                onChange={(e) => setFiltrosHistorico((prev) => ({ ...prev, origemInformacao: e.target.value }))}
                placeholder="Ex: SIAT II, entrevista..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              />
            </div>
          )}
        />

        {loadingHistoricosConvivente && historicosConvivente.length === 0 ? (
          <div className="mt-4 flex justify-center p-6">
            <p className="text-sm font-bold text-blue-700 animate-pulse">Carregando histórico do convivente...</p>
          </div>
        ) : historicosConvivente.length === 0 ? (
          <div className="mt-4 rounded-xl border-2 border-dashed border-blue-100 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">Nenhum histórico manual encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="mt-4 max-h-[52vh] space-y-3 overflow-y-auto pr-1">
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
                    <p>Origem: {formatarDataBr(registro.data_origem) || '-'}</p>
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

        {historicosConvivente.length > 0 && historicosConvivente.length < totalHistoricoConvivente && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => carregarMaisHistoricosConvivente(editandoId)}
              disabled={carregandoMaisHistorico}
              className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-700 disabled:opacity-50"
            >
              {carregandoMaisHistorico ? 'Carregando...' : 'Carregar mais registros'}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
        <div>
          <h3 className="text-sm font-black text-violet-950">Ocorrências e pareceres</h3>
          <p className="mt-1 text-xs font-semibold text-violet-700">
            Chamados, interações e pareceres técnicos registrados na central de ocorrências.
          </p>
          <p className="mt-2 text-[11px] font-semibold text-violet-800">
            Por padrão, exibimos os últimos 7 dias. Amplie o período nos filtros quando precisar.
          </p>
        </div>

        <div className="mt-4">
          <ProntuarioFiltrosLista
            tituloResumo="Ocorrências do convivente"
            dataInicio={filtrosOcorrencias.dataInicio}
            dataFim={filtrosOcorrencias.dataFim}
            onChangeDataInicio={(valor) => setFiltrosOcorrencias((prev) => ({ ...prev, dataInicio: valor }))}
            onChangeDataFim={(valor) => setFiltrosOcorrencias((prev) => ({ ...prev, dataFim: valor }))}
            busca={filtrosOcorrencias.busca}
            onChangeBusca={(valor) => setFiltrosOcorrencias((prev) => ({ ...prev, busca: valor }))}
            placeholderBusca="Buscar no tipo, motivo ou descrição..."
            totalExibido={ocorrencias.length}
            totalDisponivel={totalOcorrenciasConvivente}
            onAplicar={() => aplicarFiltrosOcorrencias(editandoId)}
            onLimpar={() => restaurarFiltrosOcorrenciasPadrao(editandoId)}
            aplicando={loadingOcorrencias}
          />
        </div>

        {loadingOcorrencias && ocorrencias.length === 0 ? (
          <div className="mt-4 flex justify-center p-8">
            <p className="text-brand font-bold animate-pulse text-sm">Carregando ocorrências...</p>
          </div>
        ) : ocorrencias.length === 0 ? (
          <div className="mt-4 text-center py-8 bg-white border-2 border-dashed border-violet-100 rounded-xl">
            <p className="text-gray-500 text-sm font-medium">Nenhuma ocorrência encontrada para os filtros selecionados.</p>
          </div>
        ) : (
          <>
            <div className="relative border-l-2 border-violet-200 ml-3 md:ml-6 mt-4 max-h-[52vh] space-y-6 overflow-y-auto pr-1">
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
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase ${ocorrencia.status_resolucao === 'Resolvido' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        Status: {ocorrencia.status_resolucao || 'Pendente'}
                      </span>
                      {ocorrencia.prioridade && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase bg-amber-50 text-amber-700">
                          Prioridade: {ocorrencia.prioridade}
                        </span>
                      )}
                      {ocorrencia.requer_acao_tecnica && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md uppercase bg-red-50 text-red-600">
                          Requer ação técnica
                        </span>
                      )}
                    </div>

                    {ocorrencia.parecer_tecnico && (
                      <p className="mt-3 whitespace-pre-wrap rounded-lg border border-green-100 bg-green-50 p-3 text-xs text-green-800">
                        <span className="font-black uppercase">Parecer técnico: </span>{ocorrencia.parecer_tecnico}
                      </p>
                    )}

                    {ocorrencia.interacoes?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {ocorrencia.interacoes.map((interacao) => (
                          <div key={interacao.id} className="rounded-lg border border-violet-100 bg-violet-50/60 p-3 text-xs text-violet-900">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                              <span className="font-black uppercase">{interacao.tipo_interacao || 'Interação'}</span>
                              <span className="text-[11px] font-semibold text-violet-600">
                                {new Date(interacao.data_interacao).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <p className="mt-2 whitespace-pre-wrap">{interacao.mensagem}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {ocorrenciasTemMais && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => carregarMaisOcorrenciasConvivente(editandoId)}
                  disabled={carregandoMaisOcorrencias}
                  className="rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-black text-violet-700 disabled:opacity-50"
                >
                  {carregandoMaisOcorrencias ? 'Carregando...' : 'Carregar mais ocorrências'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
