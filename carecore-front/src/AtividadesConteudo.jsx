import { useCallback, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { useAuth } from './context/AuthContext';
import {
  listarAtividades,
  listarOcorrenciasAtividade,
  obterConteudoSessaoAtividade,
  salvarConteudoSessaoAtividade,
} from './services/atividadesService';
import { mesReferenciaAtual, usuarioSomenteLeituraAtividades } from './config/atividadesConfig';

function formatarData(valor) {
  if (!valor) return '-';
  return new Date(`${valor}T12:00:00`).toLocaleDateString('pt-BR');
}

export default function AtividadesConteudo() {
  const { usuario } = useAuth();
  const somenteLeitura = usuarioSomenteLeituraAtividades(usuario);
  const [atividades, setAtividades] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [atividadeId, setAtividadeId] = useState('');
  const [ocorrenciaId, setOcorrenciaId] = useState('');
  const [mesReferencia, setMesReferencia] = useState(mesReferenciaAtual());
  const [texto, setTexto] = useState('');
  const [loading, setLoading] = useState(true);
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
      setOcorrenciaId('');
      return;
    }
    try {
      const lista = await listarOcorrenciasAtividade(atividadeId, mesReferencia);
      setOcorrencias(lista.items || []);
      if (!lista.items?.some((item) => item.id === ocorrenciaId)) {
        setOcorrenciaId(lista.items?.[0]?.id || '');
      }
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar as sessões.');
    }
  }, [atividadeId, mesReferencia, ocorrenciaId]);

  useEffect(() => {
    carregarOcorrencias();
  }, [carregarOcorrencias]);

  const carregarConteudo = useCallback(async () => {
    if (!ocorrenciaId) {
      setTexto('');
      return;
    }
    setErro('');
    try {
      const conteudo = await obterConteudoSessaoAtividade(ocorrenciaId);
      setTexto(conteudo.acoes_realizadas || '');
    } catch (error) {
      if (error.response?.status === 404) {
        setTexto('');
        return;
      }
      setErro(error.response?.data?.detail || 'Não foi possível carregar o conteúdo da sessão.');
    }
  }, [ocorrenciaId]);

  useEffect(() => {
    carregarConteudo();
  }, [carregarConteudo]);

  const salvar = async (event) => {
    event.preventDefault();
    if (somenteLeitura || !ocorrenciaId) return;
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      await salvarConteudoSessaoAtividade(ocorrenciaId, texto);
      setSucesso('Conteúdo da sessão salvo com sucesso.');
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível salvar o conteúdo.');
    } finally {
      setSalvando(false);
    }
  };

  const ocorrenciaSelecionada = ocorrencias.find((item) => item.id === ocorrenciaId);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Conteúdo das sessões"
          subtitulo="Registre as ações realizadas em cada encontro, equivalente ao verso da planilha institucional."
        />

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <select
            value={atividadeId}
            onChange={(event) => setAtividadeId(event.target.value)}
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
            onChange={(event) => setMesReferencia(event.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={ocorrenciaId}
            onChange={(event) => setOcorrenciaId(event.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm md:col-span-2"
            disabled={!atividadeId}
          >
            <option value="">Selecione a sessão</option>
            {ocorrencias.map((item) => (
              <option key={item.id} value={item.id}>
                Sessão {item.numero_sessao_mes} · {formatarData(item.data_sessao)}
              </option>
            ))}
          </select>
        </div>

        {ocorrenciaSelecionada && (
          <p className="mb-4 text-sm text-gray-600">
            Sessão de <strong>{formatarData(ocorrenciaSelecionada.data_sessao)}</strong>
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

        <ScrollArea className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-500">Carregando...</p>
          ) : !ocorrenciaId ? (
            <p className="text-sm text-gray-500">Selecione uma sessão para registrar o conteúdo.</p>
          ) : (
            <form onSubmit={salvar} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Ações realizadas
                </label>
                <textarea
                  value={texto}
                  onChange={(event) => setTexto(event.target.value)}
                  disabled={somenteLeitura}
                  className="mt-2 min-h-[220px] w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  placeholder="Descreva o que foi desenvolvido nesta sessão..."
                />
              </div>
              {!somenteLeitura && (
                <PremiumButton type="submit" disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Salvar conteúdo'}
                </PremiumButton>
              )}
            </form>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
