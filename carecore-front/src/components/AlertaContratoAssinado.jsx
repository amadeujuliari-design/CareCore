import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { comprasAlertasContratoAssinado } from '../services/comprasService';
import {
  obterUsuarioSessao,
  usuarioEhAdmComprasInfraestrutura,
  usuarioEhAdmComprasSuprimentos,
  usuarioEhAdmPedidos,
  usuarioEhGlobalPuro,
  usuarioEhManutencao,
  usuarioPodeVerCompras,
} from '../utils/rbacUtils';

const INTERVALO_MS = 15000;

function obterTokenLocal() {
  return localStorage.getItem('@CareCore:token') || localStorage.getItem('token');
}

function chaveAlerta(token) {
  const sufixo = String(token || '').slice(-16) || 'sessao';
  return `carecore-alerta-contrato-assinado:${sufixo}`;
}

function lerIgnorados(token) {
  try {
    const bruto = sessionStorage.getItem(chaveAlerta(token));
    const lista = bruto ? JSON.parse(bruto) : [];
    return new Set(Array.isArray(lista) ? lista.map(String) : []);
  } catch {
    return new Set();
  }
}

function usuarioVeAlerta(usuario) {
  if (!usuario) return false;
  if (usuarioEhManutencao(usuario) || usuarioEhAdmComprasInfraestrutura(usuario)) return true;
  if (usuarioEhAdmComprasSuprimentos(usuario) || usuarioEhGlobalPuro(usuario)) return false;
  return usuarioEhAdmPedidos(usuario) || usuarioPodeVerCompras(usuario);
}

export default function AlertaContratoAssinado() {
  const location = useLocation();
  const navigate = useNavigate();
  const [itens, setItens] = useState([]);
  const [ignorados, setIgnorados] = useState(() => lerIgnorados(obterTokenLocal()));

  const carregar = useCallback(async () => {
    const token = obterTokenLocal();
    const usuario = obterUsuarioSessao();
    if (!token || location.pathname === '/' || document.hidden || !usuarioVeAlerta(usuario)) {
      setItens([]);
      return;
    }
    setIgnorados(lerIgnorados(token));
    try {
      const dados = await comprasAlertasContratoAssinado();
      setItens(Array.isArray(dados?.itens) ? dados.itens : []);
    } catch {
      setItens([]);
    }
  }, [location.pathname]);

  useEffect(() => {
    carregar();
    const id = window.setInterval(carregar, INTERVALO_MS);
    const aoFoco = () => {
      if (!document.hidden) carregar();
    };
    document.addEventListener('visibilitychange', aoFoco);
    window.addEventListener('focus', aoFoco);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', aoFoco);
      window.removeEventListener('focus', aoFoco);
    };
  }, [carregar]);

  const visiveis = itens.filter((item) => {
    const id = String(item.pedido_id || '');
    if (!id || ignorados.has(id)) return false;
    return location.pathname !== `/compras/pedidos/${id}`;
  });
  const atual = visiveis[0];
  if (!atual) return null;

  const fechar = (pedidoId) => {
    const token = obterTokenLocal();
    const proximo = new Set(lerIgnorados(token));
    const ids = pedidoId ? [pedidoId] : visiveis.map((item) => String(item.pedido_id));
    ids.forEach((id) => proximo.add(id));
    sessionStorage.setItem(chaveAlerta(token), JSON.stringify([...proximo]));
    setIgnorados(proximo);
  };

  const tituloPedido = atual.titulo || 'Pedido';
  const projeto = atual.projeto ? ` (${atual.projeto})` : '';
  const arquivo = atual.arquivo ? ` ${atual.arquivo}` : '';
  const extras = visiveis.length > 1
    ? ` Há mais ${visiveis.length - 1} contrato(s) assinado(s) aguardando.`
    : '';

  return (
    <div
      className="fixed inset-0 z-[81] flex items-center justify-center bg-slate-950/50 p-4 print:hidden"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-contrato-assinado-titulo"
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-wide text-amber-800">Compras</p>
        <h3 id="alerta-contrato-assinado-titulo" className="mt-1 text-lg font-semibold text-slate-900">
          Contrato assinado
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          O contrato{arquivo} do pedido {tituloPedido}{projeto} foi assinado.
          O projeto pode seguir a compra.
          {extras}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => fechar()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Mais tarde
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => {
              const id = String(atual.pedido_id);
              fechar(id);
              navigate(`/compras/pedidos/${id}`);
            }}
            className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
          >
            Abrir pedido
          </button>
        </div>
      </div>
    </div>
  );
}
