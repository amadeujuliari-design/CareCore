import { useEffect, useState } from 'react';

import {
  CONFIRMAR_FICHAS_LOTE_ACIMA_DE,
  FICHA_COMPLETA_SECOES,
  LIMITE_FICHAS_LOTE_RELATORIOS,
  carregarSecoesSalvasFicha,
  obterSecoesPadraoFicha,
  salvarSecoesFicha,
} from '../../config/fichaCompletaConfig';
import { avaliarSecoesComDadosFicha } from '../../utils/fichaCompletaConvivente';

export default function ModalFichaCompleta({
  fichaPendente,
  setFichaPendente,
  imprimirFichaCompleta,
  carregando = false,
  modoLote = false,
  quantidadeLote = 0,
  descricaoFiltrosLote = '',
  progressoLote = null,
  limiteLote = LIMITE_FICHAS_LOTE_RELATORIOS,
  onFechar,
}) {
  const [secoesMarcadas, setSecoesMarcadas] = useState(() => carregarSecoesSalvasFicha());
  const [confirmouJudiciario, setConfirmouJudiciario] = useState(false);
  const [erro, setErro] = useState('');

  const convivente = fichaPendente?.convivente;
  const secoesComDados = convivente && !modoLote ? avaliarSecoesComDadosFicha(convivente) : {};
  const quantidade = modoLote ? quantidadeLote : 1;
  const excedeLimite = modoLote && quantidadeLote > limiteLote;

  useEffect(() => {
    if (!fichaPendente) return;
    setSecoesMarcadas(carregarSecoesSalvasFicha());
    setConfirmouJudiciario(false);
    setErro('');
  }, [fichaPendente]);

  if (!fichaPendente) return null;
  if (modoLote && quantidadeLote <= 0) return null;

  const nomeExibicao = convivente?.nome_social || convivente?.nome_completo || 'Convivente';
  const judiciarioMarcado = secoesMarcadas.includes('judiciario');

  const alternarSecao = (id) => {
    setErro('');
    setSecoesMarcadas((atual) => {
      if (atual.includes(id)) {
        if (id === 'judiciario') setConfirmouJudiciario(false);
        return atual.filter((item) => item !== id);
      }
      return [...atual, id];
    });
  };

  const marcarTodas = () => {
    setErro('');
    setSecoesMarcadas(FICHA_COMPLETA_SECOES.map((s) => s.id));
  };

  const desmarcarTodas = () => {
    setErro('');
    setConfirmouJudiciario(false);
    setSecoesMarcadas([]);
  };

  const restaurarPadrao = () => {
    setErro('');
    setConfirmouJudiciario(false);
    setSecoesMarcadas(obterSecoesPadraoFicha());
  };

  const fechar = () => {
    if (carregando) return;
    if (onFechar) {
      onFechar();
      return;
    }
    setFichaPendente(null);
  };

  const confirmarImpressao = () => {
    if (excedeLimite) {
      setErro(`O filtro retornou ${quantidadeLote} conviventes. Refine os filtros para no máximo ${limiteLote} fichas por impressão.`);
      return;
    }
    if (!secoesMarcadas.length) {
      setErro('Selecione ao menos uma seção para imprimir.');
      return;
    }
    if (judiciarioMarcado && !confirmouJudiciario) {
      setErro('Marque a confirmação para incluir dados sensíveis na impressão.');
      return;
    }
    if (
      modoLote
      && quantidadeLote > CONFIRMAR_FICHAS_LOTE_ACIMA_DE
      && !window.confirm(
        `Gerar ${quantidadeLote} fichas completas com as seções selecionadas? Isso pode levar alguns minutos.`,
      )
    ) {
      return;
    }
    salvarSecoesFicha(secoesMarcadas);
    imprimirFichaCompleta(secoesMarcadas);
  };

  const tituloModal = modoLote ? 'Fichas completas do filtro' : 'Ficha completa do convivente';
  const rotuloBotao = carregando
    ? (progressoLote
      ? `Carregando prontuários (${progressoLote.atual}/${progressoLote.total})…`
      : 'Gerando impressão…')
    : (excedeLimite
      ? `Limite de ${limiteLote} fichas — refine o filtro`
      : (modoLote ? `Imprimir ${quantidade} ficha${quantidade === 1 ? '' : 's'}` : 'Imprimir ficha'));

  return (
    <div className="carecore-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="carecore-modal-panel flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 p-6 pb-4">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
            Impressão de ficha
          </p>
          <h2 className="mt-2 text-xl font-black text-slate-900">
            {tituloModal}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Escolha as seções do cadastro a incluir. Anexos GED, cofre e termos do PIA não entram nesta impressão.
          </p>

          {modoLote ? (
            <div className="mt-3 space-y-2">
              <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                <strong>{quantidadeLote}</strong> convivente{quantidadeLote === 1 ? '' : 's'} no filtro atual
              </p>
              {descricaoFiltrosLote && (
                <p className="rounded-xl bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-900">
                  Filtros: {descricaoFiltrosLote}
                </p>
              )}
              {excedeLimite && (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900">
                  Limite de {limiteLote} fichas por vez. Use técnico, status ou busca para reduzir o conjunto antes de imprimir.
                </p>
              )}
              {quantidadeLote > CONFIRMAR_FICHAS_LOTE_ACIMA_DE && !excedeLimite && (
                <p className="text-xs font-semibold text-slate-500">
                  Será solicitada confirmação antes de gerar {quantidadeLote} fichas.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
              {nomeExibicao}
              {convivente?.numero_institucional ? (
                <span className="ml-2 font-semibold text-slate-500">
                  · Prontuário #{convivente.numero_institucional}
                </span>
              ) : null}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={marcarTodas}
              disabled={carregando}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Marcar tudo
            </button>
            <button
              type="button"
              onClick={desmarcarTodas}
              disabled={carregando}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Desmarcar tudo
            </button>
            <button
              type="button"
              onClick={restaurarPadrao}
              disabled={carregando}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Padrão
            </button>
          </div>

          <div className="space-y-2">
            {FICHA_COMPLETA_SECOES.map((secao) => {
              const marcada = secoesMarcadas.includes(secao.id);
              const temDados = secoesComDados[secao.id];
              return (
                <label
                  key={secao.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    marcada ? 'border-brand/30 bg-brand/5' : 'border-slate-200 bg-white hover:bg-slate-50'
                  } ${secao.requerConfirmacao ? 'border-red-100' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    disabled={carregando}
                    onChange={() => alternarSecao(secao.id)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800">{secao.label}</span>
                    {!modoLote && !temDados && (
                      <span className="mt-0.5 block text-xs font-semibold text-amber-700">
                        Sem dados registrados nesta seção
                      </span>
                    )}
                    {secao.requerConfirmacao && marcada && (
                      <span className="mt-1 block text-xs text-red-700">
                        Inclui egresso, judiciário e e-mail cadastrado (sem senhas do cofre).
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>

          {judiciarioMarcado && (
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <input
                type="checkbox"
                checked={confirmouJudiciario}
                disabled={carregando}
                onChange={(e) => {
                  setConfirmouJudiciario(e.target.checked);
                  if (e.target.checked) setErro('');
                }}
                className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-sm font-semibold text-red-900">
                Confirmo que esta impressão contém dados sensíveis e será utilizada conforme a política institucional de sigilo.
              </span>
            </label>
          )}

          {erro && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {erro}
            </p>
          )}

          {fichaPendente?.carregandoDados && (
            <p className="mt-4 text-sm font-semibold text-slate-500">
              Carregando dados atualizados do prontuário…
            </p>
          )}
        </div>

        <div className="grid gap-2 border-t border-slate-100 p-6 pt-4">
          <button
            type="button"
            onClick={confirmarImpressao}
            disabled={carregando || fichaPendente?.carregandoDados || excedeLimite}
            className="rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white hover:bg-brandDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {rotuloBotao}
          </button>
          <button
            type="button"
            onClick={fechar}
            disabled={carregando}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
