import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { comprasFilaExtratoResumo } from '../services/comprasService';
import { obterUsuarioSessao, usuarioEhAdmCompras, usuarioEhManutencao, usuarioPodeVerCompras } from '../utils/rbacUtils';

function obterTokenLocal() {
  return localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
}

function chaveAlerta(token) {
  const sufixo = String(token || '').slice(-16) || 'sessao';
  return `carecore-alerta-fila-extrato:${sufixo}`;
}

export default function AlertaFilaExtrato() {
  const location = useLocation();
  const navigate = useNavigate();
  const [pendentes, setPendentes] = useState(0);
  const [ignorados, setIgnorados] = useState(null);

  const carregar = useCallback(async () => {
    const token = obterTokenLocal();
    const usuario = obterUsuarioSessao();
    const sede = usuarioEhAdmCompras(usuario) || usuarioEhManutencao(usuario);
    if (!token || location.pathname === '/' || document.hidden || sede || !usuarioPodeVerCompras(usuario)) {
      setPendentes(0);
      return;
    }
    const chave = chaveAlerta(token);
    const guardado = sessionStorage.getItem(chave);
    setIgnorados(guardado === null ? null : Number(guardado));
    try {
      const dados = await comprasFilaExtratoResumo();
      setPendentes(Number(dados?.pendentes) || 0);
    } catch {
      setPendentes(0);
    }
  }, [location.pathname]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const oculto = ignorados !== null && pendentes <= ignorados;
  if (!pendentes || oculto || location.pathname.startsWith('/compras/pedidos/')) return null;

  const fechar = () => {
    const token = obterTokenLocal();
    sessionStorage.setItem(chaveAlerta(token), String(pendentes));
    setIgnorados(pendentes);
  };

  const texto = pendentes === 1
    ? 'Há 1 compra de emergência com NF enviada para pagamento. Confira o extrato e encerre o pedido.'
    : `Há ${pendentes} compras de emergência com NF enviada para pagamento. Confira o extrato e encerre os pedidos.`;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 print:hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-fila-extrato-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-wide text-amber-800">Compras · Projeto</p>
        <h3 id="alerta-fila-extrato-titulo" className="mt-1 text-lg font-semibold text-slate-900">
          Conferir extrato
        </h3>
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
              navigate('/compras');
            }}
          >
            Abrir pedidos
          </button>
        </div>
      </div>
    </div>
  );
}
