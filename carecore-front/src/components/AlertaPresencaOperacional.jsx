import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import api from '../services/api';

const CHAVE_ALERTA_FECHADO = 'carecore-alerta-operacional-fechado-total';

function obterTokenLocal() {
  return localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
}

export default function AlertaPresencaOperacional() {
  const location = useLocation();
  const [dados, setDados] = useState(null);
  const [totalIgnorado, setTotalIgnorado] = useState(() => {
    const valor = sessionStorage.getItem(CHAVE_ALERTA_FECHADO);
    return valor ? Number(valor) : null;
  });

  const carregar = useCallback(async () => {
    if (!obterTokenLocal() || location.pathname === '/' || document.hidden) return;

    try {
      const response = await api.get('/api/rotina/dashboard-operacional', {
        params: { limite_listas: 5 },
      });
      setDados(response.data);
    } catch {
      setDados(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    carregar();
    const intervalo = window.setInterval(carregar, 5 * 60 * 1000);
    const aoVoltarParaAba = () => {
      if (!document.hidden) carregar();
    };
    document.addEventListener('visibilitychange', aoVoltarParaAba);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
    };
  }, [carregar]);

  const semInteracao = dados?.listas_totais?.sem_interacao_24h ?? 0;
  const ausentes = dados?.listas_totais?.ausentes_operacionais ?? 0;
  const total = semInteracao + ausentes;

  const fecharAlerta = () => {
    setTotalIgnorado(total);
    sessionStorage.setItem(CHAVE_ALERTA_FECHADO, String(total));
  };

  const alertaOculto = totalIgnorado !== null && total <= totalIgnorado;

  const nomesSemInteracao = useMemo(
    () => (dados?.sem_interacao_24h || []).slice(0, 3).map((item) => item.convivente_nome).filter(Boolean),
    [dados],
  );

  const nomesAusentes = useMemo(
    () => (dados?.ausentes_operacionais || []).slice(0, 3).map((item) => item.convivente_nome).filter(Boolean),
    [dados],
  );

  if (!total || location.pathname === '/rotina/dashboard' || alertaOculto) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[55] max-w-md print:hidden">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 shadow-xl">
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-wide text-amber-800">Alerta operacional</p>
            <div className="mt-2 space-y-2 text-sm text-amber-950">
              {semInteracao > 0 && (
                <p>
                  <strong>{semInteracao}</strong> dentro do projeto sem interação nas últimas 24h
                  {nomesSemInteracao.length ? `: ${nomesSemInteracao.join(', ')}` : ''}.
                </p>
              )}
              {ausentes > 0 && (
                <p>
                  <strong>{ausentes}</strong> ausente(s) — saída ontem sem retorno hoje
                  {nomesAusentes.length ? `: ${nomesAusentes.join(', ')}` : ''}.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={fecharAlerta}
            aria-label="Fechar alerta operacional"
            className="shrink-0 rounded-lg border border-amber-200 bg-white px-2 py-1 text-sm font-bold leading-none text-amber-800 hover:bg-amber-100"
          >
            ×
          </button>
        </div>
        <div className="border-t border-amber-200 px-4 py-3">
          <Link
            to="/rotina/dashboard"
            className="text-xs font-black text-amber-900 underline"
          >
            Ver dashboard operacional
          </Link>
        </div>
      </div>
    </div>
  );
}
