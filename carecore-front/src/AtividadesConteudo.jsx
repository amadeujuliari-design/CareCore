import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { useAuth } from './context/AuthContext';
import {
  listarAtividades,
  listarOcorrenciasAtividade,
  salvarConteudoSessaoAtividade,
} from './services/atividadesService';
import { mesReferenciaAtual, usuarioSomenteLeituraAtividades } from './config/atividadesConfig';
import { formatarDataBr } from './utils/dataBrasilUtils';

function formatarData(valor) {
  if (!valor) return '-';
  return formatarDataBr(valor) || '-';
}

function resumoConteudo(texto) {
  const limpo = String(texto || '').trim();
  if (!limpo) return 'Sem conteúdo registrado.';
  if (limpo.length <= 160) return limpo;
  return `${limpo.slice(0, 160)}…`;
}

export default function AtividadesConteudo() {
  const { usuario } = useAuth();
  const somenteLeitura = usuarioSomenteLeituraAtividades(usuario);
  const [atividades, setAtividades] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [atividadeId, setAtividadeId] = useState('');
  const [mesReferencia, setMesReferencia] = useState(mesReferenciaAtual());
  const [editandoId, setEditandoId] = useState('');
  const [textoEdicao, setTextoEdicao] = useState('');
  const [loading, setLoading] = useState(true);
  const [carregandoSessoes, setCarregandoSessoes] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregarAtividades = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await listarAtividades(true);
      setAtividades(lista.items || []);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar as atividades.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarAtividades();
  }, [carregarAtividades]);

  const carregarOcorrencias = useCallback(async () => {
    if (!atividadeId) {
      setOcorrencias([]);
      setEditandoId('');
      setTextoEdicao('');
      return;
    }
    setCarregandoSessoes(true);
    setErro('');
    try {
      const lista = await listarOcorrenciasAtividade(atividadeId, mesReferencia);
      const items = [...(lista.items || [])].sort((a, b) => {
        const dataCmp = String(a.data_sessao || '').localeCompare(String(b.data_sessao || ''));
        if (dataCmp !== 0) return dataCmp;
        return Number(a.numero_sessao_mes || 0) - Number(b.numero_sessao_mes || 0);
      });
      setOcorrencias(items);
      setEditandoId((atual) => (items.some((item) => item.id === atual) ? atual : ''));
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar as sessões.');
      setOcorrencias([]);
    } finally {
      setCarregandoSessoes(false);
    }
  }, [atividadeId, mesReferencia]);

  useEffect(() => {
    carregarOcorrencias();
  }, [carregarOcorrencias]);

  const abrirEdicao = (sessao) => {
    setErro('');
    setSucesso('');
    setEditandoId(sessao.id);
    setTextoEdicao(sessao.acoes_realizadas || '');
  };

  const cancelarEdicao = () => {
    setEditandoId('');
    setTextoEdicao('');
  };

  const salvar = async (event) => {
    event.preventDefault();
    if (somenteLeitura || !editandoId) return;
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      const salvo = await salvarConteudoSessaoAtividade(editandoId, textoEdicao);
      setOcorrencias((prev) => prev.map((item) => (
        item.id === editandoId
          ? {
              ...item,
              acoes_realizadas: salvo.acoes_realizadas || '',
              tem_conteudo: Boolean((salvo.acoes_realizadas || '').trim()),
            }
          : item
      )));
      setSucesso('Conteúdo da sessão salvo com sucesso.');
      setEditandoId('');
      setTextoEdicao('');
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível salvar o conteúdo.');
    } finally {
      setSalvando(false);
    }
  };

  const atividadeSelecionada = useMemo(
    () => atividades.find((item) => item.id === atividadeId),
    [atividades, atividadeId],
  );

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Conteúdo das sessões"
          subtitulo="Liste as sessões por data e registre/edite as ações realizadas em cada encontro."
        />

        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <select
            value={atividadeId}
            onChange={(event) => {
              setAtividadeId(event.target.value);
              setEditandoId('');
              setTextoEdicao('');
              setSucesso('');
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Selecione a atividade</option>
            {atividades.map((item) => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
          <input
            type="month"
            value={mesReferencia}
            onChange={(event) => {
              setMesReferencia(event.target.value);
              setEditandoId('');
              setTextoEdicao('');
              setSucesso('');
            }}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </div>

        {atividadeSelecionada && (
          <p className="mb-4 text-sm text-gray-600">
            Sessões de <strong>{atividadeSelecionada.nome}</strong> em{' '}
            <strong>{mesReferencia}</strong>, ordenadas por data.
          </p>
        )}

        {erro && (
          <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {erro}
          </div>
        )}
        {sucesso && (
          <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {sucesso}
          </div>
        )}

        <ScrollArea className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Carregando...</p>
          ) : !atividadeId ? (
            <p className="p-6 text-sm text-gray-500">Selecione uma atividade para listar as sessões.</p>
          ) : carregandoSessoes ? (
            <p className="p-6 text-sm text-gray-500">Carregando sessões...</p>
          ) : ocorrencias.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">
              Nenhuma sessão gerada para este mês. Gere as sessões no cadastro de atividades.
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {ocorrencias.map((sessao) => {
                const editando = editandoId === sessao.id;
                return (
                  <div key={sessao.id} className="p-4 md:p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-bold text-gray-900">
                          Sessão {sessao.numero_sessao_mes} · {formatarData(sessao.data_sessao)}
                          {sessao.horario_sessao ? ` · ${sessao.horario_sessao}` : ''}
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {sessao.status || 'aberta'}
                          {sessao.tem_conteudo ? ' · conteúdo registrado' : ' · sem conteúdo'}
                        </p>
                        {!editando && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                            {resumoConteudo(sessao.acoes_realizadas)}
                          </p>
                        )}
                      </div>
                      {!somenteLeitura && !editando && (
                        <PremiumButton type="button" variant="secondary" onClick={() => abrirEdicao(sessao)}>
                          Editar
                        </PremiumButton>
                      )}
                    </div>

                    {editando && (
                      <form onSubmit={salvar} className="mt-4 space-y-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
                        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">
                          Ações realizadas
                        </label>
                        <textarea
                          value={textoEdicao}
                          onChange={(event) => setTextoEdicao(event.target.value)}
                          className="min-h-[180px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                          placeholder="Descreva o que foi desenvolvido nesta sessão..."
                          autoFocus
                        />
                        <div className="flex flex-wrap gap-2">
                          <PremiumButton type="submit" disabled={salvando}>
                            {salvando ? 'Salvando...' : 'Salvar conteúdo'}
                          </PremiumButton>
                          <PremiumButton type="button" variant="secondary" onClick={cancelarEdicao} disabled={salvando}>
                            Cancelar
                          </PremiumButton>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
