import { useCallback, useEffect, useMemo, useState } from 'react';
import { listarLogImpressoesCarteirinha } from '../services/carteirinhaImpressaoService';

const LIMITE_PAGINA = 50;

function dataInputHoje() {
  return new Date().toISOString().slice(0, 10);
}

function dataInputTrintaDiasAtras() {
  const data = new Date();
  data.setDate(data.getDate() - 30);
  return data.toISOString().slice(0, 10);
}

function formatarDataHora(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function rotuloOrigem(origem) {
  if (origem === 'lote') return 'Central / lote';
  return 'Cadastro (unitária)';
}

export default function LogImpressoesCarteirinha({ token, recarregarChave = 0 }) {
  const [dataInicio, setDataInicio] = useState(dataInputTrintaDiasAtras);
  const [dataFim, setDataFim] = useState(dataInputHoje);
  const [busca, setBusca] = useState('');
  const [deslocamento, setDeslocamento] = useState(0);
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!token) return;
    setCarregando(true);
    setErro('');
    try {
      const resultado = await listarLogImpressoesCarteirinha(token, {
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        busca: busca.trim() || undefined,
        limite: LIMITE_PAGINA,
        deslocamento,
      });
      setDados(resultado);
    } catch (error) {
      setDados(null);
      const status = error.response?.status;
      if (status === 404) {
        setErro(
          'Log de impressões indisponível neste backend. Reinicie o servidor local (reiniciar_local.bat) '
          + 'ou aguarde o deploy da versão com o módulo de carteirinha.',
        );
      } else {
        setErro(error.response?.data?.detail || 'Não foi possível carregar o log de impressões.');
      }
    } finally {
      setCarregando(false);
    }
  }, [token, dataInicio, dataFim, busca, deslocamento]);

  useEffect(() => {
    carregar();
  }, [carregar, recarregarChave]);

  const paginaAtual = useMemo(
    () => Math.floor(deslocamento / LIMITE_PAGINA) + 1,
    [deslocamento],
  );
  const totalPaginas = useMemo(() => {
    const total = Number(dados?.total || 0);
    return Math.max(1, Math.ceil(total / LIMITE_PAGINA));
  }, [dados?.total]);

  const resumo = dados?.resumo || {
    total_eventos: 0,
    total_carteirinhas: 0,
    conviventes_distintos: 0,
  };

  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-black text-gray-900">Log de impressões de carteirinha</h2>
        <p className="text-xs text-gray-500">
          Histórico de impressões oficiais: convivente, operador, quantidade e origem (cadastro ou lote).
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-blue-600">Eventos</p>
          <p className="mt-1 text-2xl font-black text-blue-900">{resumo.total_eventos}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-600">Carteirinhas</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{resumo.total_carteirinhas}</p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-violet-600">Conviventes</p>
          <p className="mt-1 text-2xl font-black text-violet-900">{resumo.conviventes_distintos}</p>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={() => {
              setDeslocamento(0);
              carregar();
            }}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
          >
            Atualizar log
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">De</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => {
              setDeslocamento(0);
              setDataInicio(e.target.value);
            }}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Até</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => {
              setDeslocamento(0);
              setDataFim(e.target.value);
            }}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-[10px] font-black uppercase text-gray-400">Buscar convivente</label>
          <input
            type="text"
            value={busca}
            onChange={(e) => {
              setDeslocamento(0);
              setBusca(e.target.value);
            }}
            placeholder="Nome, prontuário ou SISA..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      {erro && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erro}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Data/hora</th>
              <th className="px-4 py-3">Convivente</th>
              <th className="px-4 py-3">Prontuário</th>
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Qtd.</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Total no cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {carregando ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center font-semibold text-gray-500">
                  Carregando log...
                </td>
              </tr>
            ) : (dados?.items || []).length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center font-semibold text-gray-500">
                  Nenhuma impressão registrada no período.
                </td>
              </tr>
            ) : (
              dados.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-700">
                    {formatarDataHora(item.impresso_em)}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">{item.convivente_nome || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {item.numero_institucional ? `#${item.numero_institucional}` : 'S/N'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.usuario_nome || '—'}</td>
                  <td className="px-4 py-3 font-black text-gray-900">{item.quantidade}</td>
                  <td className="px-4 py-3 text-gray-600">{rotuloOrigem(item.origem)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-700">{item.total_acumulado_convivente}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-500">
          {dados?.total || 0} registro(s) no período
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={deslocamento <= 0 || carregando}
            onClick={() => setDeslocamento((valor) => Math.max(0, valor - LIMITE_PAGINA))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-xs font-bold text-gray-500">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <button
            type="button"
            disabled={!dados?.has_more || carregando}
            onClick={() => setDeslocamento((valor) => valor + LIMITE_PAGINA)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </section>
  );
}
