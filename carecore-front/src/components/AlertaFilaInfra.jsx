import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { comprasFilaConcluidosInfraResumo, comprasFilaNfPagamentoResumo } from '../services/comprasService';
import {
  obterUsuarioSessao,
  usuarioEhAdmComprasInfraestrutura,
  usuarioEhManutencao,
} from '../utils/rbacUtils';

function obterTokenLocal() {
  return localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
}

function chaveAlerta(token, fila) {
  const sufixo = String(token || '').slice(-16) || 'sessao';
  return `carecore-alerta-fila-${fila}:${sufixo}`;
}

function usuarioVeFila(usuario) {
  return usuarioEhAdmComprasInfraestrutura(usuario) || usuarioEhManutencao(usuario);
}

export default function AlertaFilaInfra() {
  const location = useLocation();
  const navigate = useNavigate();
  const [nfPendentes, setNfPendentes] = useState(0);
  const [concluidosPendentes, setConcluidosPendentes] = useState(0);
  const [ignorarNf, setIgnorarNf] = useState(null);
  const [ignorarConcluidos, setIgnorarConcluidos] = useState(null);

  const carregar = useCallback(async () => {
    const token = obterTokenLocal();
    const usuario = obterUsuarioSessao();
    if (!token || location.pathname === '/' || document.hidden || !usuarioVeFila(usuario)) {
      setNfPendentes(0);
      setConcluidosPendentes(0);
      return;
    }
    setIgnorarNf(sessionStorage.getItem(chaveAlerta(token, 'nf')) == null
      ? null
      : Number(sessionStorage.getItem(chaveAlerta(token, 'nf'))));
    setIgnorarConcluidos(sessionStorage.getItem(chaveAlerta(token, 'concluidos')) == null
      ? null
      : Number(sessionStorage.getItem(chaveAlerta(token, 'concluidos'))));
    try {
      const [nf, concluidos] = await Promise.all([
        comprasFilaNfPagamentoResumo(),
        comprasFilaConcluidosInfraResumo(),
      ]);
      setNfPendentes(Number(nf?.pendentes) || 0);
      setConcluidosPendentes(Number(concluidos?.pendentes) || 0);
    } catch {
      setNfPendentes(0);
      setConcluidosPendentes(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const naFilaNf = location.pathname === '/compras/fila-nf-pagamento';
  const naFilaConcluidos = location.pathname === '/compras/fila-concluidos-infra';
  const mostrarNf = nfPendentes > 0 && !naFilaNf && !(ignorarNf !== null && nfPendentes <= ignorarNf);
  const mostrarConcluidos = concluidosPendentes > 0 && !naFilaConcluidos && !(ignorarConcluidos !== null && concluidosPendentes <= ignorarConcluidos);

  if (!mostrarNf && !mostrarConcluidos) return null;

  const fila = mostrarNf ? 'nf' : 'concluidos';
  const pendentes = fila === 'nf' ? nfPendentes : concluidosPendentes;
  const titulo = fila === 'nf' ? 'Fila de NFs a pagar' : 'Fila de pedidos concluídos';
  const texto = fila === 'nf'
    ? (pendentes === 1
      ? 'Há 1 nota fiscal de Compras emergência aguardando o envio para pagamento.'
      : `Há ${pendentes} notas fiscais de Compras emergência aguardando o envio para pagamento.`)
    : (pendentes === 1
      ? 'Há 1 pedido encerrado aguardando o OK final da Infraestrutura.'
      : `Há ${pendentes} pedidos encerrados aguardando o OK final da Infraestrutura.`);
  const destino = fila === 'nf' ? '/compras/fila-nf-pagamento' : '/compras/fila-concluidos-infra';

  const fechar = () => {
    const token = obterTokenLocal();
    sessionStorage.setItem(chaveAlerta(token, fila), String(pendentes));
    if (fila === 'nf') setIgnorarNf(pendentes);
    else setIgnorarConcluidos(pendentes);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 print:hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-fila-infra-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-wide text-amber-800">Compras · Infraestrutura</p>
        <h3 id="alerta-fila-infra-titulo" className="mt-1 text-lg font-semibold text-slate-900">{titulo}</h3>
        <p className="mt-2 text-sm text-slate-700">{texto}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
            onClick={fechar}
          >
            Agora não
          </button>
          <button
            type="button"
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
            onClick={() => {
              fechar();
              navigate(destino);
            }}
          >
            Abrir fila
          </button>
        </div>
      </div>
    </div>
  );
}
