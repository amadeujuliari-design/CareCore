import { useAtualizacaoApp } from '../hooks/useAtualizacaoApp.js';

export default function AtualizacaoAppBanner() {
  const {
    atualizacaoDisponivel,
    versaoAtual,
    versaoRemota,
    recarregarApp,
  } = useAtualizacaoApp();

  if (!atualizacaoDisponivel) {
    return null;
  }

  const detalheVersao = versaoRemota && versaoRemota !== versaoAtual
    ? ` (${versaoAtual} → v${versaoRemota})`
    : '';

  return (
    <div
      className="fixed inset-x-0 top-0 z-[120] border-b border-amber-200 bg-amber-50 px-4 py-3 shadow-md"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-amber-950">
          <p className="font-bold">Nova versão do CareCore+ disponível{detalheVersao}</p>
          <p className="text-xs text-amber-800">
            Atualize a página para carregar as mudanças mais recentes do sistema.
          </p>
        </div>

        <button
          type="button"
          onClick={recarregarApp}
          className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-amber-700"
        >
          Atualizar agora
        </button>
      </div>
    </div>
  );
}
