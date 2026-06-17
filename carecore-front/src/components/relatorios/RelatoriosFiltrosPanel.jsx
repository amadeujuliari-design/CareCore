export function RelatoriosFiltrosPanel({
  aba,
  atualizarFiltro,
  filtros,
  filtrosAtivos,
  filtrosMobileAbertos,
  limparFiltros,
  ordenacaoAcomodacoes,
  setFiltrosMobileAbertos,
  setOrdenacaoAcomodacoes,
  tecnicos,
}) {
  const deveMostrarFiltrosEspecificos = ['ocorrencias', 'rotina', 'auditoria', 'pia', 'acomodacoes'].includes(aba);

  return (
    <section className="bg-white border border-gray-100 rounded-3xl shadow-sm p-5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-black text-gray-900">Filtros da central</h2>
          <p className="text-xs text-gray-500 mt-1">
            Os cards, exportações e impressão desta central usam os filtros abaixo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button
            type="button"
            onClick={() => setFiltrosMobileAbertos((valor) => !valor)}
            className="px-4 py-2 rounded-xl border border-blue-100 bg-blue-50 text-xs font-black text-blue-700 hover:bg-blue-100 md:hidden"
          >
            {filtrosMobileAbertos ? 'Ocultar filtros' : 'Mostrar filtros'}
          </button>

          <button
            type="button"
            onClick={limparFiltros}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-xs font-black text-gray-600 hover:bg-gray-50"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className={`${filtrosMobileAbertos ? 'block' : 'hidden'} md:block space-y-5`}>
        <div>
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-wide text-gray-500">Filtros gerais</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Início</label>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => atualizarFiltro('dataInicio', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Fim</label>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => atualizarFiltro('dataFim', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Técnico</label>
              <select
                value={filtros.tecnicoId}
                onChange={(e) => atualizarFiltro('tecnicoId', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="">Todos</option>
                {tecnicos.map((tecnico) => (
                  <option key={tecnico.id} value={tecnico.id}>
                    {tecnico.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status convivente</label>
              <select
                value={filtros.statusConvivente}
                onChange={(e) => atualizarFiltro('statusConvivente', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="Todos">Todos</option>
                <option value="Ativo">Ativo</option>
                <option value="Ausência justificada">Ausência justificada</option>
                <option value="Inativado">Inativado</option>
                <option value="Saída qualificada">Saída qualificada</option>
                <option value="Bloqueado">Bloqueado</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Busca geral</label>
              <input
                type="text"
                value={filtros.busca}
                onChange={(e) => atualizarFiltro('busca', e.target.value)}
                placeholder="Nome, prontuário, motivo, usuário..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {deveMostrarFiltrosEspecificos && (
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="mb-3 text-[11px] font-black uppercase tracking-wide text-gray-500">Filtros deste relatório</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {aba === 'ocorrencias' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status ocorrência</label>
                    <select
                      value={filtros.statusOcorrencia}
                      onChange={(e) => atualizarFiltro('statusOcorrencia', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      <option value="Todos">Todos</option>
                      <option value="Pendentes">Pendentes</option>
                      <option value="Resolvidas">Resolvidas</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Prioridade ocorrência</label>
                    <select
                      value={filtros.prioridadeOcorrencia}
                      onChange={(e) => atualizarFiltro('prioridadeOcorrencia', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      <option value="Todas">Todas</option>
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Crítica">Crítica</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 bg-white">
                    <input
                      type="checkbox"
                      checked={filtros.somentePendencias}
                      onChange={(e) => atualizarFiltro('somentePendencias', e.target.checked)}
                      className="w-4 h-4 text-brand rounded focus:ring-brand"
                    />
                    Somente ocorrências pendentes
                  </label>
                </>
              )}

              {['rotina', 'auditoria'].includes(aba) && (
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 bg-white">
                  <input
                    type="checkbox"
                    checked={filtros.somentePendencias}
                    onChange={(e) => atualizarFiltro('somentePendencias', e.target.checked)}
                    className="w-4 h-4 text-brand rounded focus:ring-brand"
                  />
                  Somente registros com ajuste
                </label>
              )}

              {aba === 'pia' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Tipo de registro</label>
                    <select
                      value={filtros.tipoPia}
                      onChange={(e) => atualizarFiltro('tipoPia', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      <option value="Todos">Todos</option>
                      <option value="PIA principal">PIA principal</option>
                      <option value="Evolução">Evolução</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status do PIA</label>
                    <select
                      value={filtros.statusPia}
                      onChange={(e) => atualizarFiltro('statusPia', e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    >
                      <option value="Todos">Todos</option>
                      <option value="Em acompanhamento">Em acompanhamento</option>
                      <option value="Pendente">Pendente</option>
                      <option value="Concluído">Concluído</option>
                      <option value="Revisar">Revisar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Tema da evolução</label>
                    <input
                      type="text"
                      value={filtros.temaPia}
                      onChange={(e) => atualizarFiltro('temaPia', e.target.value)}
                      placeholder="Ex: saúde, documentação..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
                    />
                  </div>
                </>
              )}

              {aba === 'acomodacoes' && (
          <>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Status do leito</label>
              <select
                value={filtros.acomodacaoStatusLeito}
                onChange={(e) => atualizarFiltro('acomodacaoStatusLeito', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="Todos">Todos</option>
                <option value="Livre">Livres</option>
                <option value="Ocupado">Ocupados</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Modalidade</label>
              <select
                value={filtros.acomodacaoModalidade}
                onChange={(e) => atualizarFiltro('acomodacaoModalidade', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="Todas">Todas</option>
                <option value="Fixo">Fixo</option>
                <option value="Transitorio">Transitório</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Público</label>
              <select
                value={filtros.acomodacaoPublico}
                onChange={(e) => atualizarFiltro('acomodacaoPublico', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="Todos">Todos</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Misto">Misto / Famílias</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Ordenar por</label>
              <select
                value={ordenacaoAcomodacoes}
                onChange={(e) => setOrdenacaoAcomodacoes(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="quarto">Quarto e leito</option>
                <option value="status">Status do leito</option>
                <option value="convivente">Convivente</option>
                <option value="modalidade">Modalidade</option>
              </select>
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 bg-white">
              <input
                type="checkbox"
                checked={filtros.somentePendencias}
                onChange={(e) => atualizarFiltro('somentePendencias', e.target.checked)}
                className="w-4 h-4 text-brand rounded focus:ring-brand"
              />
              Somente leitos livres
            </label>
          </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(filtrosAtivos.length > 0 ? filtrosAtivos : ['Sem filtros ativos']).map((filtro) => (
          <span
            key={filtro}
            className="text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100"
          >
            {filtro}
          </span>
        ))}
      </div>
    </section>
  );
}
