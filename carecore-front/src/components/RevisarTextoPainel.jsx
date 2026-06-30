import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_ROOT } from '../config/apiBase';
import { obterStatusRevisaoTexto, revisarTexto } from '../services/textoService';

export function RevisarTextoPainel({
  token,
  titulo = '',
  texto = '',
  conviventeId = null,
  contexto = null,
  exibirTitulo = true,
  onAplicar,
  className = '',
}) {
  const [status, setStatus] = useState(null);
  const [ambienteApi, setAmbienteApi] = useState('');
  const [carregandoStatus, setCarregandoStatus] = useState(true);
  const [revisando, setRevisando] = useState(false);
  const [erro, setErro] = useState('');
  const [sugestao, setSugestao] = useState(null);
  const [tituloEditado, setTituloEditado] = useState('');
  const [textoEditado, setTextoEditado] = useState('');

  useEffect(() => {
    if (!sugestao) {
      setTituloEditado('');
      setTextoEditado('');
      return;
    }
    setTituloEditado(sugestao.titulo ?? '');
    setTextoEditado(sugestao.texto ?? '');
  }, [sugestao]);

  useEffect(() => {
    let ativo = true;

    async function carregarStatus() {
      if (!token) {
        setCarregandoStatus(false);
        return;
      }

      let configurado = false;
      let dadosStatus = null;

      try {
        const health = await axios.get(`${API_ROOT}/health`, { timeout: 5000 });
        configurado = Boolean(health.data?.revisao_texto_configurada);
        if (health.data?.environment) {
          setAmbienteApi(String(health.data.environment));
        }
      } catch {
        // Mantém indicador desligado quando /health não responde.
      }

      try {
        dadosStatus = await obterStatusRevisaoTexto(token);
      } catch {
        // Mantém o indicador do /health quando o status autenticado falhar.
      }

      const configuradoFinal = Boolean(dadosStatus?.configurado ?? configurado);

      if (ativo) {
        setStatus(
          dadosStatus || {
            configurado: configuradoFinal,
            disponivel: configuradoFinal,
            limite_mensal: 100,
            usado_mes: 0,
          },
        );
        setCarregandoStatus(false);
      }
    }

    carregarStatus();
    return () => {
      ativo = false;
    };
  }, [token]);

  const configurado = Boolean(status?.configurado);
  const disponivel = Boolean(status?.configurado && status?.disponivel);

  const mensagemRevisaoIndisponivel = () => {
    const hostLocal = typeof window !== 'undefined'
      && ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const ambienteLocal = ambienteApi === 'local' || (hostLocal && import.meta.env.DEV);

    if (ambienteLocal) {
      return 'Indisponível no servidor local. Confira GEMINI_API_KEY no .env e reinicie o backend.';
    }

    return 'Revisão por IA ainda não está ativa neste ambiente. A manutenção precisa configurar GEMINI_API_KEY no backend online (Fly.io).';
  };

  async function handleRevisar() {
    const tituloAtual = (titulo || '').trim();
    const textoAtual = (texto || '').trim();

    if (!tituloAtual && !textoAtual) {
      setErro('Digite algum texto antes de revisar.');
      return;
    }

    setErro('');
    setRevisando(true);
    setSugestao(null);

    try {
      const resultado = await revisarTexto(token, {
        titulo: exibirTitulo ? tituloAtual : '',
        texto: textoAtual,
        conviventeId,
        contexto,
      });
      setSugestao(resultado);
      if (typeof status?.usado_mes === 'number') {
        setStatus((atual) => ({
          ...atual,
          usado_mes: resultado.usado_mes ?? atual?.usado_mes,
          disponivel: resultado.limite_mensal == null
            ? true
            : (resultado.usado_mes ?? 0) < (resultado.limite_mensal ?? atual?.limite_mensal ?? 0),
        }));
      }
    } catch (requestError) {
      const mensagem = requestError?.response?.data?.detail
        || 'Não foi possível revisar o texto agora.';
      setErro(typeof mensagem === 'string' ? mensagem : 'Não foi possível revisar o texto agora.');
    } finally {
      setRevisando(false);
    }
  }

  function handleAceitar() {
    if (!sugestao || typeof onAplicar !== 'function') return;

    const tituloFinal = exibirTitulo ? tituloEditado.trim() : (sugestao.titulo ?? titulo);
    const textoFinal = textoEditado.trim();

    if (exibirTitulo && !tituloFinal && !textoFinal) {
      setErro('A sugestão ficou vazia. Edite o texto ou ignore a revisão.');
      return;
    }
    if (!exibirTitulo && !textoFinal) {
      setErro('A sugestão ficou vazia. Edite o texto ou ignore a revisão.');
      return;
    }

    onAplicar({
      titulo: tituloFinal,
      texto: textoFinal,
      titulo_original: sugestao.titulo_original ?? titulo,
      texto_original: sugestao.texto_original ?? texto,
    });
    setSugestao(null);
    setErro('');
  }

  if (!token) return null;

  return (
    <div className={`rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-indigo-900">Revisão assistida por IA</p>
          <p className="text-[11px] text-indigo-700">
            {carregandoStatus && 'Verificando disponibilidade...'}
            {!carregandoStatus && configurado && disponivel
              && `Uso no mês: ${status?.usado_mes ?? 0}/${status?.limite_mensal ?? '∞'}`}
            {!carregandoStatus && configurado && !disponivel
              && 'Limite mensal de revisões atingido. Você ainda pode salvar o texto como digitou.'}
            {!carregandoStatus && !configurado
              && mensagemRevisaoIndisponivel()}
          </p>
          {!carregandoStatus && configurado && contexto === 'ocorrencia' && (
            <p className="text-[10px] text-indigo-600 mt-1">
              Para revisar, não cite nomes no texto — selecione os funcionários envolvidos no formulário.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRevisar}
          disabled={carregandoStatus || !configurado || !disponivel || revisando}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {revisando ? 'Revisando...' : 'Revisar texto'}
        </button>
      </div>

      {erro && (
        <p className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {erro}
        </p>
      )}

      {sugestao && (
        <div className="mt-3 rounded-xl border border-white bg-white p-3 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Sugestão da IA</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Revise e ajuste o texto abaixo antes de aceitar, se necessário.
          </p>
          {exibirTitulo && (
            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
                Título sugerido
              </label>
              <input
                type="text"
                value={tituloEditado}
                onChange={(e) => setTituloEditado(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}
          <div className={exibirTitulo ? 'mt-3' : 'mt-2'}>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-500">
              {exibirTitulo ? 'Texto sugerido' : 'Sugestão'}
            </label>
            <textarea
              value={textoEditado}
              onChange={(e) => setTextoEditado(e.target.value)}
              rows={Math.min(8, Math.max(3, (textoEditado.match(/\n/g) || []).length + 2))}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAceitar}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
            >
              Aceitar sugestão
            </button>
            <button
              type="button"
              onClick={() => setSugestao(null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
