import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { comprasFilaAssinaturaResumo } from '../services/comprasService';
import {
  obterUsuarioSessao,
  usuarioEhAdmCompras,
  usuarioEhManutencao,
  usuarioGlobalAssinaOrcamento,
} from '../utils/rbacUtils';

function obterTokenLocal() {
  return localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
}

function chaveAlerta(token) {
  const sufixo = String(token || '').slice(-16) || 'sessao';
  return `carecore-alerta-fila-assinatura:${sufixo}`;
}

function usuarioVeFila(usuario) {
  return usuarioGlobalAssinaOrcamento(usuario)
    || usuarioEhAdmCompras(usuario)
    || usuarioEhManutencao(usuario);
}

export default function AlertaFilaAssinatura() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendentes, setPendentes] = useState(0);
  const [ignorados, setIgnorados] = useState(null);

  const carregar = useCallback(async () => {
    const token = obterTokenLocal();
    const usuario = obterUsuarioSessao();
    if (!token || location.pathname === '/' || document.hidden || !usuarioVeFila(usuario)) {
      setPendentes(0);
      return;
    }
    const chave = chaveAlerta(token);
    const guardado = sessionStorage.getItem(chave);
    setIgnorados(guardado === null ? null : Number(guardado));
    try {
      const dados = await comprasFilaAssinaturaResumo();
      setPendentes(Number(dados?.pendentes) || 0);
    } catch {
      setPendentes(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const naFila = location.pathname === '/compras/aguardando-assinatura';
  const oculto = ignorados !== null && pendentes <= ignorados;
  if (!pendentes || naFila || oculto) return null;

  const fechar = () => {
    const token = obterTokenLocal();
    sessionStorage.setItem(chaveAlerta(token), String(pendentes));
    setIgnorados(pendentes);
  };

  const texto = pendentes === 1
    ? 'Há 1 pedido de bem/imobilizado ou prestação de serviço aguardando a sua assinatura.'
    : `Há ${pendentes} pedidos de bem/imobilizado ou prestação de serviço aguardando a sua assinatura.`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 print:hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-fila-assinatura-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-wide text-amber-800">Compras · Sede</p>
        <h3 id="alerta-fila-assinatura-titulo" className="mt-1 text-lg font-semibold text-slate-900">
          Fila aguardando assinatura
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{texto}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={fechar}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Agora não
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              fechar();
              navigate('/compras/aguardando-assinatura');
            }}
            className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Abrir fila
          </button>
        </div>
      </div>
    </div>
  );
}
