import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import {
  listarAusenciasJustificadasPendentes,
  responderAusenciaJustificada,
} from '../services/ausenciasJustificadasService';
import ModalAlertaOk from './ModalAlertaOk';

function obterTokenLocal() {
  return localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
}

export default function AusenciaJustificadaAlerta() {
  const location = useLocation();
  const [pendencias, setPendencias] = useState([]);
  const [recolhido, setRecolhido] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [mostrandoEncerramento, setMostrandoEncerramento] = useState(false);
  const [statusAtribuido, setStatusAtribuido] = useState('Ativo');
  const [justificativa, setJustificativa] = useState('');
  const [erro, setErro] = useState('');
  const [alertaOk, setAlertaOk] = useState({ aberto: false, titulo: 'Atenção', mensagem: '' });
  const [enviando, setEnviando] = useState(false);

  const selecionado = useMemo(
    () => pendencias.find((item) => item.convivente_id === selecionadoId) || pendencias[0] || null,
    [pendencias, selecionadoId],
  );

  const carregarPendencias = useCallback(async () => {
    if (!obterTokenLocal() || location.pathname === '/' || document.hidden) return;

    try {
      const dados = await listarAusenciasJustificadasPendentes();
      setPendencias(dados);
      setSelecionadoId((idAtual) => (
        dados.some((item) => item.convivente_id === idAtual)
          ? idAtual
          : dados[0]?.convivente_id || null
      ));
      setErro('');
    } catch {
      setPendencias([]);
    }
  }, [location.pathname]);

  useEffect(() => {
    carregarPendencias();

    const intervalo = window.setInterval(carregarPendencias, 5 * 60 * 1000);
    const aoVoltarParaAba = () => {
      if (!document.hidden) carregarPendencias();
    };

    document.addEventListener('visibilitychange', aoVoltarParaAba);

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    };
  }, [carregarPendencias]);

  useEffect(() => {
    setMostrandoEncerramento(false);
    setStatusAtribuido('Ativo');
    setJustificativa('');
    setErro('');
  }, [selecionadoId]);

  async function responderContinua() {
    if (!selecionado) return;

    setEnviando(true);
    setErro('');

    try {
      await responderAusenciaJustificada(selecionado.convivente_id, {
        continua_ausente: true,
      });
      setPendencias((itens) => itens.filter((item) => item.convivente_id !== selecionado.convivente_id));
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível confirmar a ausência justificada.');
    } finally {
      setEnviando(false);
    }
  }

  async function responderEncerra() {
    if (!selecionado) return;

    if (statusAtribuido === 'Inativado' && !justificativa.trim()) {
      setErro('Informe a justificativa para inativar o convivente.');
      return;
    }

    setEnviando(true);
    setErro('');

    try {
      await responderAusenciaJustificada(selecionado.convivente_id, {
        continua_ausente: false,
        status_atribuido: statusAtribuido,
        justificativa: justificativa.trim() || null,
      });
      setPendencias((itens) => itens.filter((item) => item.convivente_id !== selecionado.convivente_id));
      setMostrandoEncerramento(false);
    } catch (error) {
      const mensagem = error?.response?.data?.detail || 'Não foi possível encerrar a ausência justificada.';
      setErro(mensagem);
      if (typeof mensagem === 'string' && mensagem.includes('ocorrência(s) em aberto')) {
        setAlertaOk({
          aberto: true,
          titulo: 'Ocorrências em aberto',
          mensagem,
        });
      }
    } finally {
      setEnviando(false);
    }
  }

  if (!pendencias.length || location.pathname === '/') return null;

  if (recolhido) {
    return (
      <div className="fixed top-3 left-1/2 z-[80] -translate-x-1/2">
        <button
          type="button"
          onClick={() => setRecolhido(false)}
          className="animate-pulse rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-xs font-black uppercase tracking-wide text-amber-900 shadow-xl"
        >
          ! Ausências justificadas: {pendencias.length}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-3 left-1/2 z-[80] w-[calc(100vw-1rem)] max-w-3xl -translate-x-1/2 rounded-2xl border border-amber-300 bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-3 rounded-t-2xl bg-amber-50 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-amber-900">
            Alerta diário de ausência justificada
          </p>
          <p className="text-xs text-amber-800">
            Confirme se a ausência continua ou encerre o status para o convivente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRecolhido(true)}
          className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold text-amber-900 hover:bg-amber-100"
        >
          Recolher
        </button>
      </div>

      <div className="grid max-h-[75vh] grid-cols-1 gap-0 overflow-hidden md:grid-cols-[240px_1fr]">
        <div className="max-h-52 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3 md:max-h-[60vh] md:border-b-0 md:border-r">
          {pendencias.map((item) => (
            <button
              key={item.convivente_id}
              type="button"
              onClick={() => setSelecionadoId(item.convivente_id)}
              className={`mb-2 w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                item.convivente_id === selecionado?.convivente_id
                  ? 'border-amber-400 bg-white text-slate-900 shadow-sm'
                  : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
              }`}
            >
              <span className="block truncate font-black">{item.nome}</span>
              <span className="block text-[11px]">
                Pront. {item.prontuario || '-'} · {item.dias_em_ausencia} dia(s)
              </span>
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-4">
          {selecionado && (
            <>
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-900">{selecionado.nome}</p>
                <p className="text-xs text-slate-600">
                  Prontuário {selecionado.prontuario || '-'} · Técnico: {selecionado.tecnico_nome || 'não definido'}
                </p>
              </div>

              <p className="mb-3 text-sm font-bold text-slate-800">
                Continua com ausência justificada?
              </p>

              {!mostrandoEncerramento ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={responderContinua}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Sim, continua
                  </button>
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={() => setMostrandoEncerramento(true)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-bold text-slate-800">Qual status devo atribuir?</p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="status-ausencia"
                        value="Ativo"
                        checked={statusAtribuido === 'Ativo'}
                        onChange={(event) => setStatusAtribuido(event.target.value)}
                      />
                      Ativo
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                      <input
                        type="radio"
                        name="status-ausencia"
                        value="Inativado"
                        checked={statusAtribuido === 'Inativado'}
                        onChange={(event) => setStatusAtribuido(event.target.value)}
                      />
                      Inativado
                    </label>
                  </div>

                  {statusAtribuido === 'Inativado' && (
                    <textarea
                      value={justificativa}
                      onChange={(event) => setJustificativa(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                      placeholder="Justifique a inativação..."
                    />
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={responderEncerra}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      Salvar resposta
                    </button>
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => setMostrandoEncerramento(false)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}

              {erro && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  {erro}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <ModalAlertaOk
        aberto={alertaOk.aberto}
        titulo={alertaOk.titulo}
        mensagem={alertaOk.mensagem}
        onFechar={() => setAlertaOk({ aberto: false, titulo: 'Atenção', mensagem: '' })}
      />
    </div>
  );
}
