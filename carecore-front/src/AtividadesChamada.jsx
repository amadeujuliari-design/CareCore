import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import LeitorCarteirinhaModal from './components/LeitorCarteirinhaModal';
import { useLeitorUsbGlobal } from './hooks/useLeitorUsbGlobal';
import { useAuth } from './context/AuthContext';
import {
  desfazerPresencaAtividade,
  listarAtividades,
  listarOcorrenciasAtividade,
  obterChamadaAtividade,
  registrarPresencaAtividade,
  atualizarStatusOcorrenciaAtividade,
} from './services/atividadesService';
import { mesReferenciaAtual, usuarioSomenteLeituraAtividades } from './config/atividadesConfig';
import { encontrarConviventePorCodigo } from './utils/conviventeIdentificacaoUtils';
import { registroAindaPodeSerDesfeitoRotina } from './utils/rotinaDiariaUtils';
import { filtrarOrdenarConviventesPorBusca } from './utils/conviventeBuscaUtils';
import { formatarDataBr } from './utils/dataBrasilUtils';

function formatarData(valor) {
  if (!valor) return '-';
  return formatarDataBr(valor) || '-';
}

export default function AtividadesChamada() {
  const { usuario } = useAuth();
  const somenteLeitura = usuarioSomenteLeituraAtividades(usuario);
  const [atividades, setAtividades] = useState([]);
  const [ocorrencias, setOcorrencias] = useState([]);
  const [atividadeId, setAtividadeId] = useState('');
  const [ocorrenciaId, setOcorrenciaId] = useState('');
  const [mesReferencia, setMesReferencia] = useState(mesReferenciaAtual());
  const [chamada, setChamada] = useState(null);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [scannerAberto, setScannerAberto] = useState(false);

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
        const hoje = new Date().toISOString().slice(0, 10);
        const sessaoHoje = lista.items?.find((item) => item.data_sessao === hoje);
        setOcorrenciaId(sessaoHoje?.id || lista.items?.[0]?.id || '');
      }
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar as sessões.');
    }
  }, [atividadeId, mesReferencia, ocorrenciaId]);

  useEffect(() => {
    carregarOcorrencias();
  }, [carregarOcorrencias]);

  const carregarChamada = useCallback(async () => {
    if (!ocorrenciaId) {
      setChamada(null);
      return;
    }
    setErro('');
    try {
      const dados = await obterChamadaAtividade(ocorrenciaId);
      setChamada(dados);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar a chamada.');
    }
  }, [ocorrenciaId]);

  useEffect(() => {
    carregarChamada();
  }, [carregarChamada]);

  const presencasPorConvivente = useMemo(() => {
    const mapa = new Map();
    (chamada?.presencas || []).forEach((item) => {
      mapa.set(item.convivente_id, item);
    });
    return mapa;
  }, [chamada]);

  const conviventesFiltrados = useMemo(() => {
    const lista = chamada?.conviventes_elegiveis || [];
    return filtrarOrdenarConviventesPorBusca(lista, busca);
  }, [chamada, busca]);

  const registrarPresenca = async (convivente, metodo, codigoLido = null) => {
    if (somenteLeitura || !ocorrenciaId) return;
    setSalvando(true);
    setErro('');
    setSucesso('');
    try {
      await registrarPresencaAtividade(ocorrenciaId, {
        convivente_id: convivente.id,
        metodo_leitura: metodo,
        codigo_lido: codigoLido,
      });
      setSucesso(`Presença registrada: ${convivente.nome || convivente.nome_completo}.`);
      await carregarChamada();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível registrar a presença.');
    } finally {
      setSalvando(false);
    }
  };

  const processarCodigoLido = async (codigo) => {
    const elegiveis = chamada?.conviventes_elegiveis || [];
    const convivente = encontrarConviventePorCodigo(elegiveis, codigo);
    if (!convivente) {
      setErro('Código lido, mas o convivente não está elegível para esta chamada.');
      return 'erro_tratado';
    }
    await registrarPresenca(convivente, 'QR Code', codigo);
    return true;
  };

  useLeitorUsbGlobal({
    ativo: Boolean(ocorrenciaId) && !somenteLeitura && !scannerAberto,
    onCodigoLido: async (codigo) => {
      const elegiveis = chamada?.conviventes_elegiveis || [];
      const convivente = encontrarConviventePorCodigo(elegiveis, codigo);
      if (!convivente) {
        setErro('Código lido, mas o convivente não está elegível para esta chamada.');
        return;
      }
      await registrarPresenca(convivente, 'Código de barras', codigo);
    },
  });

  const desfazerPresenca = async (presenca) => {
    if (somenteLeitura) return;
    setSalvando(true);
    setErro('');
    try {
      if (presenca.pode_desfazer) {
        await desfazerPresencaAtividade(presenca.id);
      } else if (registroAindaPodeSerDesfeitoRotina(presenca.registrado_em)) {
        await desfazerPresencaAtividade(presenca.id);
      } else {
        setErro('Prazo de desfazer expirado. Use a grade para cancelar com motivo.');
        return;
      }
      setSucesso('Presença desfeita.');
      await carregarChamada();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível desfazer a presença.');
    } finally {
      setSalvando(false);
    }
  };

  const ocorrenciaSelecionada = ocorrencias.find((item) => item.id === ocorrenciaId);

  const alternarStatusSessao = async () => {
    if (somenteLeitura || !ocorrenciaSelecionada) return;
    const proximo = ocorrenciaSelecionada.status === 'aberta' ? 'encerrada' : 'aberta';
    setSalvando(true);
    setErro('');
    try {
      await atualizarStatusOcorrenciaAtividade(ocorrenciaSelecionada.id, proximo);
      setSucesso(proximo === 'encerrada' ? 'Sessão encerrada.' : 'Sessão reaberta.');
      await carregarOcorrencias();
      await carregarChamada();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível alterar o status da sessão.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Chamada de presença"
          subtitulo="Leia a carteirinha ou marque manualmente os conviventes elegíveis da sessão."
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
                Sessão {item.numero_sessao_mes} · {formatarData(item.data_sessao)} · {item.total_presentes} presente(s)
              </option>
            ))}
          </select>
        </div>

        {ocorrenciaSelecionada && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/10 bg-brand/5 px-4 py-3 text-sm text-gray-700">
            <span>
              <strong>{chamada?.atividade?.nome}</strong> · sessão de {formatarData(ocorrenciaSelecionada.data_sessao)}
              {' · '}
              <span className="font-semibold">{chamada?.presencas?.length || 0} presente(s)</span>
              {' · '}
              Status: <strong>{ocorrenciaSelecionada.status}</strong>
            </span>
            {!somenteLeitura && (
              <PremiumButton type="button" variant="secondary" disabled={salvando} onClick={alternarStatusSessao}>
                {ocorrenciaSelecionada.status === 'aberta' ? 'Encerrar sessão' : 'Reabrir sessão'}
              </PremiumButton>
            )}
          </div>
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

        {!somenteLeitura && (
          <div className="mb-4 flex flex-wrap gap-2">
            <PremiumButton type="button" onClick={() => setScannerAberto(true)} disabled={!ocorrenciaId || salvando}>
              Ler carteirinha
            </PremiumButton>
          </div>
        )}

        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar convivente elegível..."
          className="mb-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
        />

        <ScrollArea className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Carregando...</p>
          ) : !ocorrenciaId ? (
            <p className="p-6 text-sm text-gray-500">Selecione uma atividade e uma sessão para iniciar a chamada.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {conviventesFiltrados.map((convivente) => {
                const presenca = presencasPorConvivente.get(convivente.id);
                return (
                  <div key={convivente.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{convivente.nome}</p>
                      <p className="text-sm text-gray-500">
                        Prontuário {convivente.prontuario || 'S/N'} · {convivente.status}
                      </p>
                      {presenca && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          Presente via {presenca.metodo_leitura} às {new Date(presenca.registrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    {!somenteLeitura && (
                      <div className="flex flex-wrap gap-2">
                        {!presenca ? (
                          <PremiumButton
                            type="button"
                            disabled={salvando}
                            onClick={() => registrarPresenca(convivente, 'Manual')}
                          >
                            Marcar presente
                          </PremiumButton>
                        ) : (
                          <PremiumButton
                            type="button"
                            variant="secondary"
                            disabled={salvando || !presenca.pode_desfazer}
                            onClick={() => desfazerPresenca(presenca)}
                          >
                            Desfazer
                          </PremiumButton>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <LeitorCarteirinhaModal
          aberto={scannerAberto}
          onClose={() => setScannerAberto(false)}
          onCodigoLido={processarCodigoLido}
          titulo="Ler carteirinha na atividade"
          subtitulo="A presença será registrada na sessão selecionada."
        />
      </MainShell>
    </AppShell>
  );
}
