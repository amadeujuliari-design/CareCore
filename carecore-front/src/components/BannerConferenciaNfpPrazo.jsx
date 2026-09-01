import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

import { nfpConferenciaAviso } from '../services/nfpService';
import { usuarioPodeGestaoNfp } from '../utils/rbacUtils';

export default function BannerConferenciaNfpPrazo({ aviso: avisoProp = null, usuario = null }) {
  const [aviso, setAviso] = useState(avisoProp);

  useEffect(() => {
    if (avisoProp) {
      setAviso(avisoProp);
      return undefined;
    }
    if (!usuarioPodeGestaoNfp(usuario)) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const data = await nfpConferenciaAviso();
        if (!cancelado) setAviso(data);
      } catch {
        if (!cancelado) setAviso(null);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [avisoProp, usuario]);

  if (!aviso?.ativo) return null;

  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-semibold">Conferência NFP — prazo SEFAZ até {aviso.fim_janela?.split('-').reverse().join('/')}</p>
          <p className="mt-1 text-amber-900">
            {aviso.mensagem}
            {aviso.cupons_prioridade > 0
              ? ` ${aviso.cupons_prioridade} cupom(ns) com emissão na janela que fecha neste mês.`
              : ''}
          </p>
        </div>
      </div>
      <Link
        to="/nfp/conferencia-sefaz"
        className="shrink-0 rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
      >
        Abrir wizard
      </Link>
    </div>
  );
}
