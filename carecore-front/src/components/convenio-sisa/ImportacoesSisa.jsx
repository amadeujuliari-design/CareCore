import {
  DESLIGAMENTO_FILTRO,
  FILTROS_DIVERGENCIA_PADRAO,
  PRIORIDADES_DIVERGENCIA_SISA,
  STATUS_CONVIVENTE_FILTRO,
  STATUS_TRATATIVA_FILTRO,
  STATUS_TRATATIVA_SISA,
  TIPOS_DIVERGENCIA_SISA,
  descreverFiltrosDivergencias,
  formatarDataPt,
  formatarTipoDivergencia,
} from '../../utils/convenioSisaUtils';
import { FiltroSelect, ResumoCard, Td, Th } from './ConvenioSisaUI';

export function ImportacoesSisa({
  importacoes,
  importacaoSelecionada,
  podeExcluirImportacoes,
  excluindoImportacaoId,
  onSelecionarImportacao,
  onExcluirImportacao,
  filtros,
  onAlterarFiltros,
  divergenciasFiltradas,
  onAtualizarStatus,
}) {
  const divergencias = importacaoSelecionada?.divergencias || [];
  const alertasCriticos = divergencias.filter(item => item.tipo === 'SISA_MENOR' || item.prioridade === 'Crítica');
  const pendencias = divergencias.filter(item => !['OK', 'SEM_BASE_ANTERIOR'].includes(item.tipo));
  const lista = divergenciasFiltradas || [];
  const totalFiltrado = lista.length;

  const diasPerdidosFiltrados = lista.reduce(
    (acc, item) => acc + (Number(item.diferenca || 0) < 0 ? Math.abs(Number(item.diferenca || 0)) : 0),
    0,
  );

  const filtrosAtivos =
    (filtros?.busca || '').trim() !== '' ||
    filtros?.tipo !== 'todos' ||
    filtros?.prioridade !== 'todas' ||
    filtros?.statusTratativa !== 'todos' ||
    filtros?.statusConvivente !== 'todos' ||
    filtros?.desligamento !== 'todos' ||
    Boolean(filtros?.somenteDiferenca) ||
    Number(filtros?.difMinima || 0) > 0;

  const atualizarFiltro = (campo, valor) => {
    onAlterarFiltros({ ...filtros, [campo]: valor });
  };

  const limparFiltros = () => onAlterarFiltros(FILTROS_DIVERGENCIA_PADRAO);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 print:hidden">
        <h2 className="text-lg font-black text-amber-900">Importações e auditoria SISA</h2>
        <p className="mt-1 text-sm font-semibold text-amber-800">
          Importe a planilha exportada do SISA para comparar os dias reconhecidos com entradas, saídas e alimentações registradas no CareCore+.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <ResumoCard titulo="Importações" valor={importacoes.length} />
        <ResumoCard titulo="Linhas lidas" valor={importacaoSelecionada?.total_linhas || 0} />
        <ResumoCard titulo="Vinculados" valor={importacaoSelecionada?.total_vinculados || 0} />
        <ResumoCard titulo="Pendências" valor={pendencias.length} />
        <ResumoCard titulo="Alertas críticos" valor={alertasCriticos.length} />
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs font-black uppercase text-gray-600">Histórico de importações</h3>
          {importacaoSelecionada && (
            <p className="text-[11px] font-semibold text-gray-500">
              Selecionada: {formatarDataPt(importacaoSelecionada.data_referencia)} · {importacaoSelecionada.nome_arquivo}
            </p>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {importacoes.length === 0 ? (
            <p className="w-full rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3 text-sm font-semibold text-gray-500">
              Nenhuma planilha SISA importada ainda.
            </p>
          ) : (
            importacoes.map((importacao) => (
              <div
                key={importacao.id}
                className={`min-w-[220px] rounded-xl border px-3 py-2 text-left text-xs transition ${
                  importacaoSelecionada?.id === importacao.id
                    ? 'border-brand bg-brand/5'
                    : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelecionarImportacao(importacao.id)}
                  className="block w-full text-left"
                >
                  <p className="font-black text-gray-800">{formatarDataPt(importacao.data_referencia)}</p>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-gray-500">{importacao.nome_arquivo}</p>
                  <p className="mt-1 text-[10px] font-bold text-gray-500">
                    {importacao.total_vinculados} vinculados · {importacao.total_alertas_criticos} críticos
                  </p>
                </button>

                {podeExcluirImportacoes && (
                  <button
                    type="button"
                    onClick={() => onExcluirImportacao(importacao)}
                    disabled={excluindoImportacaoId === importacao.id}
                    className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[10px] font-black uppercase text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {excluindoImportacaoId === importacao.id ? 'Excluindo...' : 'Excluir importação'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="print:hidden rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs font-black uppercase text-gray-600">Filtros e relatórios</h3>
          {filtrosAtivos && (
            <button
              type="button"
              onClick={limparFiltros}
              className="self-start rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-100 sm:self-auto"
            >
              Limpar filtros
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="sm:col-span-2 xl:col-span-1">
            <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Buscar convivente / Nº SISA</label>
            <input
              type="text"
              value={filtros?.busca || ''}
              onChange={(e) => atualizarFiltro('busca', e.target.value)}
              placeholder="Nome ou número SISA"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <FiltroSelect
            label="Tipo de divergência"
            value={filtros?.tipo || 'todos'}
            onChange={(valor) => atualizarFiltro('tipo', valor)}
            opcoes={TIPOS_DIVERGENCIA_SISA}
          />

          <FiltroSelect
            label="Prioridade"
            value={filtros?.prioridade || 'todas'}
            onChange={(valor) => atualizarFiltro('prioridade', valor)}
            opcoes={PRIORIDADES_DIVERGENCIA_SISA}
          />

          <FiltroSelect
            label="Status da tratativa"
            value={filtros?.statusTratativa || 'todos'}
            onChange={(valor) => atualizarFiltro('statusTratativa', valor)}
            opcoes={STATUS_TRATATIVA_FILTRO}
          />

          <FiltroSelect
            label="Situação do convivente"
            value={filtros?.statusConvivente || 'todos'}
            onChange={(valor) => atualizarFiltro('statusConvivente', valor)}
            opcoes={STATUS_CONVIVENTE_FILTRO}
          />

          <FiltroSelect
            label="Desligamento na planilha"
            value={filtros?.desligamento || 'todos'}
            onChange={(valor) => atualizarFiltro('desligamento', valor)}
            opcoes={DESLIGAMENTO_FILTRO}
          />

          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Diferença mínima (dias)</label>
            <input
              type="number"
              min="0"
              value={filtros?.difMinima || 0}
              onChange={(e) => atualizarFiltro('difMinima', Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(filtros?.somenteDiferenca)}
              onChange={(e) => atualizarFiltro('somenteDiferenca', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Somente com diferença
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-600">
          <span className="rounded-full bg-gray-100 px-3 py-1">{totalFiltrado} de {divergencias.length} registro(s)</span>
          {diasPerdidosFiltrados > 0 && (
            <span className="rounded-full bg-red-50 px-3 py-1 font-black text-red-700">
              {diasPerdidosFiltrados} dia(s) sem reconhecimento do SISA
            </span>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-black uppercase text-gray-700">Conferência da importação</h3>
            <p className="mt-1 text-xs font-semibold text-gray-500">
              {importacaoSelecionada
                ? `Referência ${formatarDataPt(importacaoSelecionada.data_referencia)} · ${importacaoSelecionada.total_linhas} linha(s) · ${descreverFiltrosDivergencias(filtros)}`
                : 'Selecione uma importação para ver as divergências.'}
            </p>
          </div>

          {alertasCriticos.length > 0 && (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black uppercase text-red-700">
              Possível perda de repasse
            </span>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-100">
              <tr>
                <Th>Convivente</Th>
                <Th>Nº SISA</Th>
                <Th>Tipo</Th>
                <Th>Período</Th>
                <Th>SISA</Th>
                <Th>CareCore+</Th>
                <Th>Dif.</Th>
                <Th>Tratativa</Th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-6 text-sm font-semibold text-gray-500">
                    {!importacaoSelecionada
                      ? 'Sem importação selecionada.'
                      : divergencias.length === 0
                        ? 'Nenhuma divergência registrada.'
                        : 'Nenhum registro para os filtros aplicados.'}
                  </td>
                </tr>
              ) : (
                lista.map((item) => (
                  <>
                    <tr key={item.id} className={`border-t border-gray-100 ${item.tipo === 'SISA_MENOR' ? 'bg-red-50/60' : ''}`}>
                      <Td destaque>{item.nome_convivente}</Td>
                      <Td>{item.numero_sisa}</Td>
                      <Td>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                          item.tipo === 'SISA_MENOR'
                            ? 'bg-red-100 text-red-700'
                            : item.tipo === 'OK'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {formatarTipoDivergencia(item.tipo)}
                        </span>
                      </Td>
                      <Td>{item.data_inicio ? `${formatarDataPt(item.data_inicio)} a ${formatarDataPt(item.data_fim)}` : formatarDataPt(item.data_fim)}</Td>
                      <Td>{item.dias_sisa_delta ?? item.dias_sisa_atual}</Td>
                      <Td>{item.dias_carecore}</Td>
                      <Td>{item.diferenca ?? '-'}</Td>
                      <Td>
                        <select
                          value={item.status || 'Pendente'}
                          onChange={(e) => onAtualizarStatus(item.id, e.target.value)}
                          className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-semibold"
                        >
                          {STATUS_TRATATIVA_SISA.map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </Td>
                    </tr>
                    <tr key={`${item.id}-mensagem`} className={`${item.tipo === 'SISA_MENOR' ? 'bg-red-50/60' : 'bg-gray-50/70'}`}>
                      <td colSpan="8" className="px-4 pb-4 pt-0 text-xs font-semibold leading-relaxed text-gray-600">
                        <span className="font-black uppercase text-gray-500">Mensagem: </span>
                        {item.mensagem || '-'}
                      </td>
                    </tr>
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
