import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

import { PremiumButton } from '../PremiumUI';
import { API_ROOT } from '../../config/apiBase';
import {
  calcularDataInicioPadrao,
  dataHojeIsoLocal,
  HISTORICO_DIAS_PADRAO,
} from '../../utils/prontuarioHistoricoFluxoUtils';
import { formatarDataBr } from '../../utils/dataBrasilUtils';

const LIMITE_ROTINA = 20;

const filtrosIniciais = {
  busca: '',
  nome_convivente: '',
  numero_sisa: '',
  data_inicio: calcularDataInicioPadrao(HISTORICO_DIAS_PADRAO),
  data_fim: dataHojeIsoLocal(),
  servico_prestado: '',
  status_revisao: '',
  quarto: '',
  cama: '',
  periodo_acolhimento: '',
  usuario_origem: '',
  identificacao: '',
};

function formatarData(data) {
  if (!data) return '-';
  return formatarDataBr(data) || '-';
}

function textoDetalhado(registro) {
  return [
    `Data do serviço: ${formatarData(registro.data_servico)}`,
    `Convivente: ${registro.nome_convivente || 'Não identificado no legado'}`,
    `SISA: ${registro.numero_sisa || '-'}`,
    `Serviço: ${registro.servico_prestado || registro.atividade || '-'}`,
    `Quarto/Cama: ${registro.quarto || '-'} / ${registro.cama || '-'}`,
    `Período de acolhimento: ${registro.periodo_acolhimento || '-'}`,
    registro.data_entrada ? `Entrada no atendimento: ${formatarData(registro.data_entrada)}` : null,
    registro.data_saida ? `Saída do atendimento: ${formatarData(registro.data_saida)}` : null,
    registro.motivo_saida ? `Motivo de saída: ${registro.motivo_saida}` : null,
    `Origem: ${registro.origem_arquivo || '-'} · linha ${registro.linha_origem || '-'}`,
    `ID serviço legado: ${registro.id_as_atendimento_serv_legado || '-'}`,
    `ID atendimento legado: ${registro.id_as_atendimento_legado || '-'}`,
    registro.usuario_origem ? `Usuário origem: ${registro.usuario_origem}` : null,
    registro.observacoes ? `Observações: ${registro.observacoes}` : null,
  ].filter(Boolean).join('\n');
}

function paginasVisiveisPaginacao(paginaAtual, totalPaginas) {
  const paginas = new Set([1, totalPaginas]);

  for (let pagina = paginaAtual - 2; pagina <= paginaAtual + 2; pagina += 1) {
    if (pagina >= 1 && pagina <= totalPaginas) {
      paginas.add(pagina);
    }
  }

  return Array.from(paginas).sort((a, b) => a - b);
}

export default function HistoricoLegadoRotina({ headers }) {
  const [filtros, setFiltros] = useState(filtrosIniciais);
  const [dados, setDados] = useState({ items: [], total: 0, resumo: {}, opcoes: {} });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [registroAberto, setRegistroAberto] = useState(null);

  const montarParams = useCallback((offsetAtual = offset) => {
    const params = { limit: LIMITE_ROTINA, offset: offsetAtual };

    Object.entries(filtros).forEach(([chave, valor]) => {
      const limpo = String(valor || '').trim();
      if (limpo) params[chave] = limpo;
    });

    return params;
  }, [filtros, offset]);

  const carregarRotina = useCallback(async (offsetAtual = offset, signal) => {
    try {
      setLoading(true);
      setErro('');

      const response = await axios.get(`${API_ROOT}/historico-legado/rotina`, {
        headers,
        params: montarParams(offsetAtual),
        signal,
      });

      setDados(response.data || { items: [], total: 0, resumo: {}, opcoes: {} });
      setOffset(offsetAtual);
    } catch (error) {
      if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') return;
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao carregar a rotina legada.');
    } finally {
      setLoading(false);
    }
  }, [headers, montarParams, offset]);

  const carregarMeta = useCallback(async (signal) => {
    try {
      setLoadingMeta(true);
      const response = await axios.get(`${API_ROOT}/historico-legado/rotina/meta`, {
        headers,
        signal,
      });

      setDados((prev) => ({
        ...prev,
        resumo: response.data?.resumo || prev.resumo || {},
        opcoes: response.data?.opcoes || prev.opcoes || {},
      }));
    } catch (error) {
      if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') return;
      console.error(error);
    } finally {
      setLoadingMeta(false);
    }
  }, [headers]);

  useEffect(() => {
    const controller = new AbortController();
    carregarRotina(0, controller.signal);
    carregarMeta(controller.signal);
    return () => controller.abort();
  }, []);

  const resumo = dados.resumo || {};
  const opcoes = dados.opcoes || {};
  const paginaAtual = Math.floor(offset / LIMITE_ROTINA) + 1;
  const totalPaginas = Math.max(1, Math.ceil((dados.total || 0) / LIMITE_ROTINA));
  const paginasVisiveis = useMemo(
    () => paginasVisiveisPaginacao(paginaAtual, totalPaginas),
    [paginaAtual, totalPaginas],
  );

  const atualizarFiltro = (campo, valor) => {
    setFiltros((prev) => ({ ...prev, [campo]: valor }));
  };

  const aplicarFiltros = () => carregarRotina(0);

  const limparFiltros = () => {
    setFiltros(filtrosIniciais);
    setOffset(0);
  };

  const irParaPagina = (pagina) => {
    const paginaSegura = Math.min(Math.max(Number(pagina) || 1, 1), totalPaginas);
    carregarRotina((paginaSegura - 1) * LIMITE_ROTINA);
  };

  const copiarRegistro = async (registro) => {
    try {
      await navigator.clipboard.writeText(textoDetalhado(registro));
      setSucesso('Rotina legada copiada para a área de transferência.');
      setTimeout(() => setSucesso(''), 2500);
    } catch (error) {
      console.error(error);
      setErro('Não foi possível copiar automaticamente.');
    }
  };

  const atualizarRegistro = async (registro, payload) => {
    try {
      setErro('');
      const response = await axios.patch(
        `${API_ROOT}/historico-legado/rotina/${registro.id}`,
        payload,
        { headers },
      );
      const atualizado = response.data;
      setDados((prev) => ({
        ...prev,
        items: prev.items.map((item) => item.id === atualizado.id ? atualizado : item),
      }));
      setRegistroAberto((atual) => atual?.id === atualizado.id ? atualizado : atual);
      setSucesso('Registro de rotina atualizado.');
      setTimeout(() => setSucesso(''), 2500);
    } catch (error) {
      console.error(error);
      setErro(error.response?.data?.detail || 'Erro ao atualizar rotina legada.');
    }
  };

  const ControlesPaginacao = () => (
    <div className="flex flex-wrap items-center gap-2">
      <PremiumButton type="button" variant="soft" disabled={offset === 0 || loading} onClick={() => irParaPagina(paginaAtual - 1)}>
        Anterior
      </PremiumButton>
      {paginasVisiveis.map((pagina, index) => {
        const paginaAnterior = paginasVisiveis[index - 1];
        const mostrarReticencias = paginaAnterior && pagina - paginaAnterior > 1;
        return (
          <span key={pagina} className="flex items-center gap-2">
            {mostrarReticencias && <span className="text-xs font-black text-gray-400">...</span>}
            <button
              type="button"
              onClick={() => irParaPagina(pagina)}
              disabled={loading}
              className={`rounded-xl border px-3 py-2 text-xs font-black ${
                pagina === paginaAtual
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-blue-50'
              }`}
            >
              {pagina}
            </button>
          </span>
        );
      })}
      <PremiumButton type="button" variant="soft" disabled={!dados.has_more || loading} onClick={() => irParaPagina(paginaAtual + 1)}>
        Próxima
      </PremiumButton>
    </div>
  );

  return (
    <div className="space-y-6">
      {erro && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
          {sucesso}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-gray-400">Registros</p>
          <p className="mt-2 text-3xl font-black text-blue-900">{resumo.total || 0}</p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-emerald-600">Com vínculo</p>
          <p className="mt-2 text-3xl font-black text-emerald-700">{loadingMeta ? '...' : (resumo.com_vinculo || 0)}</p>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-amber-600">Pendentes</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{loadingMeta ? '...' : (resumo.pendentes || 0)}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-gray-400">Sem identificação</p>
          <p className="mt-2 text-3xl font-black text-slate-800">{loadingMeta ? '...' : (resumo.sem_identificacao || 0)}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-blue-950">Filtros de rotina legada</h2>
            <p className="text-sm font-semibold text-gray-500">A consulta é paginada no servidor e exibe 20 registros por página.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/historico-legado/rotina/presencas"
              className="inline-flex items-center rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 hover:bg-blue-100"
            >
              Relatório de presenças
            </Link>
            <PremiumButton type="button" variant="soft" onClick={limparFiltros}>Limpar</PremiumButton>
            <PremiumButton type="button" variant="brand" onClick={aplicarFiltros}>Filtrar</PremiumButton>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <input value={filtros.busca} onChange={(event) => atualizarFiltro('busca', event.target.value)} onKeyDown={(event) => event.key === 'Enter' && aplicarFiltros()} placeholder="Busca geral" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" />
          <input value={filtros.nome_convivente} onChange={(event) => atualizarFiltro('nome_convivente', event.target.value)} onKeyDown={(event) => event.key === 'Enter' && aplicarFiltros()} placeholder="Nome do convivente" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" />
          <input value={filtros.numero_sisa} onChange={(event) => atualizarFiltro('numero_sisa', event.target.value)} onKeyDown={(event) => event.key === 'Enter' && aplicarFiltros()} placeholder="Número SISA" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" />
          <select value={filtros.servico_prestado} onChange={(event) => atualizarFiltro('servico_prestado', event.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold">
            <option value="">Todos os serviços</option>
            {(opcoes.servicos || []).map((servico) => <option key={servico} value={servico}>{servico}</option>)}
          </select>
          <input type="date" value={filtros.data_inicio} onChange={(event) => atualizarFiltro('data_inicio', event.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" />
          <input type="date" value={filtros.data_fim} onChange={(event) => atualizarFiltro('data_fim', event.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" />
          <select value={filtros.quarto} onChange={(event) => atualizarFiltro('quarto', event.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold">
            <option value="">Todos os quartos</option>
            {(opcoes.quartos || []).map((quarto) => <option key={quarto} value={quarto}>{quarto}</option>)}
          </select>
          <input value={filtros.cama} onChange={(event) => atualizarFiltro('cama', event.target.value)} onKeyDown={(event) => event.key === 'Enter' && aplicarFiltros()} placeholder="Cama" className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold" />
          <select value={filtros.periodo_acolhimento} onChange={(event) => atualizarFiltro('periodo_acolhimento', event.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold">
            <option value="">Todos os períodos</option>
            {(opcoes.periodos || []).map((periodo) => <option key={periodo} value={periodo}>{periodo}</option>)}
          </select>
          <select value={filtros.status_revisao} onChange={(event) => atualizarFiltro('status_revisao', event.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold">
            <option value="">Todos os status</option>
            {(opcoes.status || []).map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={filtros.usuario_origem} onChange={(event) => atualizarFiltro('usuario_origem', event.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold md:col-span-2">
            <option value="">Todos os usuários origem</option>
            {(opcoes.usuarios || []).map((usuario) => <option key={usuario} value={usuario}>{usuario}</option>)}
          </select>
          <select value={filtros.identificacao} onChange={(event) => atualizarFiltro('identificacao', event.target.value)} className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold md:col-span-2">
            <option value="">Todos, inclusive sem identificação</option>
            <option value="identificados">Somente identificados por nome, SISA ou vínculo</option>
            <option value="vinculados">Somente vinculados ao cadastro</option>
            <option value="sem_identificacao">Somente sem identificação</option>
          </select>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-black text-blue-950">Rotinas importadas</h2>
            <p className="text-sm font-semibold text-gray-500">
              Página {paginaAtual} de {totalPaginas} · {dados.total || 0} resultado(s)
            </p>
          </div>
          <ControlesPaginacao />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm font-bold text-blue-700">Carregando rotina legada...</div>
        ) : dados.items?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-black uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Convivente</th>
                  <th className="px-4 py-3">Serviço</th>
                  <th className="px-4 py-3">Quarto/Cama</th>
                  <th className="px-4 py-3">SISA</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dados.items.map((registro) => (
                  <tr key={registro.id} className="align-top hover:bg-blue-50/40">
                    <td className="px-4 py-3 font-bold text-gray-700">{formatarData(registro.data_servico)}</td>
                    <td className="px-4 py-3">
                      <p className="font-black text-blue-950">{registro.nome_convivente || 'Não identificado no legado'}</p>
                      <p className="text-xs font-bold text-gray-400">
                        {registro.nome_convivente
                          ? (registro.periodo_acolhimento || 'Período não informado')
                          : `Não identificado no legado · ID atendimento ${registro.id_as_atendimento_legado || '-'}`}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-700">{registro.servico_prestado || registro.atividade || '-'}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{registro.quarto || '-'} / {registro.cama || '-'}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{registro.numero_sisa || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-600">{registro.status_revisao || 'Pendente'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <PremiumButton type="button" variant="soft" onClick={() => setRegistroAberto(registro)}>Abrir</PremiumButton>
                        <PremiumButton type="button" variant="soft" onClick={() => copiarRegistro(registro)}>Copiar</PremiumButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-sm font-bold text-gray-500">Nenhuma rotina legada encontrada para os filtros atuais.</div>
        )}

        {!loading && dados.total > LIMITE_ROTINA && (
          <div className="flex flex-col gap-3 border-t border-gray-100 p-5 md:flex-row md:items-center md:justify-between">
            <p className="text-xs font-bold text-gray-500">
              Exibindo {offset + 1} a {Math.min(offset + LIMITE_ROTINA, dados.total)} de {dados.total} registro(s).
            </p>
            <ControlesPaginacao />
          </div>
        )}
      </section>

      {registroAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
              <div>
                <p className="text-xs font-black uppercase text-blue-600">Rotina legada</p>
                <h2 className="mt-1 text-xl font-black text-blue-950">{registroAberto.nome_convivente || 'Não identificado no legado'}</h2>
                <p className="mt-1 text-xs font-bold text-gray-500">
                  {formatarData(registroAberto.data_servico)} · {registroAberto.servico_prestado || registroAberto.atividade || '-'}
                </p>
              </div>
              <button type="button" onClick={() => setRegistroAberto(null)} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-black text-gray-600">
                Fechar
              </button>
            </div>
            <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-5">
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <select
                  value={registroAberto.status_revisao || 'Pendente'}
                  onChange={(event) => atualizarRegistro(registroAberto, { status_revisao: event.target.value })}
                  className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-bold"
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Revisado">Revisado</option>
                  <option value="Descartado">Descartado</option>
                </select>
                <PremiumButton type="button" variant="brand" onClick={() => copiarRegistro(registroAberto)}>
                  Copiar texto formatado
                </PremiumButton>
              </div>
              <textarea
                value={registroAberto.observacoes || ''}
                onChange={(event) => setRegistroAberto((prev) => ({ ...prev, observacoes: event.target.value }))}
                onBlur={(event) => atualizarRegistro(registroAberto, { observacoes: event.target.value })}
                placeholder="Observações da validação"
                className="mb-4 min-h-24 w-full rounded-2xl border border-gray-200 p-4 text-sm font-semibold"
              />
              <pre className="whitespace-pre-wrap rounded-2xl border border-gray-100 bg-gray-50 p-5 text-sm leading-relaxed text-gray-800">
                {textoDetalhado(registroAberto)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
