import { useEffect, useState } from 'react';
import { Fingerprint, Trash2, X } from 'lucide-react';

import {
  criarOpcoesRegistroPasskey,
  listarPasskeys,
  removerPasskey,
  verificarRegistroPasskey,
} from '../services/passkeysService';
import {
  criarCredencialPasskey,
  passkeysDisponiveis,
} from '../utils/passkeysUtils';

function nomePadraoDispositivo() {
  const userAgent = navigator.userAgent || '';

  if (/iphone|ipad/i.test(userAgent)) return 'iPhone / iPad';
  if (/android/i.test(userAgent)) return 'Android';
  if (/windows/i.test(userAgent)) return 'Windows Hello';
  if (/macintosh|mac os/i.test(userAgent)) return 'Mac / Touch ID';

  return 'Este aparelho';
}

function formatarData(valor) {
  if (!valor) return 'Ainda não usado';

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Ainda não usado';

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PasskeysModal({ onClose }) {
  const [passkeys, setPasskeys] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  async function carregarPasskeys() {
    try {
      setCarregando(true);
      setErro('');
      setPasskeys(await listarPasskeys());
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível carregar os acessos biométricos.');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarPasskeys();
  }, []);

  async function ativarNesteAparelho() {
    try {
      setProcessando(true);
      setErro('');
      setSucesso('');

      const opcoes = await criarOpcoesRegistroPasskey();
      const credential = await criarCredencialPasskey(opcoes.publicKey);
      await verificarRegistroPasskey({
        credential,
        challenge_token: opcoes.challenge_token,
        nome_dispositivo: nomePadraoDispositivo(),
      });

      setSucesso('Acesso biométrico ativado neste aparelho.');
      await carregarPasskeys();
    } catch (error) {
      setErro(
        error?.response?.data?.detail ||
        error?.message ||
        'Não foi possível ativar o acesso biométrico neste aparelho.'
      );
    } finally {
      setProcessando(false);
    }
  }

  async function removerDispositivo(passkeyId) {
    try {
      setProcessando(true);
      setErro('');
      setSucesso('');
      await removerPasskey(passkeyId);
      setSucesso('Acesso biométrico removido.');
      await carregarPasskeys();
    } catch (error) {
      setErro(error?.response?.data?.detail || 'Não foi possível remover este acesso biométrico.');
    } finally {
      setProcessando(false);
    }
  }

  const suporte = passkeysDisponiveis();

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-teal-600 via-sky-500 to-amber-400 p-5 text-white">
          <div>
            <div className="flex items-center gap-2">
              <Fingerprint size={22} />
              <h2 className="text-lg font-black">Acesso biométrico</h2>
            </div>
            <p className="mt-1 text-sm font-semibold text-white/85">
              Ative Face ID, digital, PIN ou passkey neste aparelho.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-white/85 hover:bg-white/15 hover:text-white"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!suporte && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              Este navegador ou conexão não suporta passkeys. Use HTTPS e um aparelho com bloqueio de tela ativo.
            </div>
          )}

          {erro && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {erro}
            </div>
          )}

          {sucesso && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
              {sucesso}
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            A biometria fica protegida pelo aparelho. O CareCore+ armazena apenas uma chave pública segura para reconhecer este dispositivo.
          </div>

          <button
            type="button"
            onClick={ativarNesteAparelho}
            disabled={!suporte || processando}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Fingerprint size={18} />
            {processando ? 'Processando...' : 'Ativar neste aparelho'}
          </button>

          <section>
            <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
              Aparelhos autorizados
            </h3>

            {carregando ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm font-bold text-slate-400">
                Carregando...
              </div>
            ) : passkeys.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm font-bold text-slate-400">
                Nenhum aparelho autorizado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {passkeys.map((passkey) => (
                  <div
                    key={passkey.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">
                        {passkey.nome_dispositivo || 'Aparelho autorizado'}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        Último uso: {formatarData(passkey.ultimo_uso_em)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerDispositivo(passkey.id)}
                      disabled={processando}
                      className="shrink-0 rounded-full p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Remover acesso biométrico"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
