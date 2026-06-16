export default function ProntuarioCabecalho({
  abaAtual,
  editandoId,
  formData,
  perfilUsuario,
  podeGerenciarPiaConvivente,
  salvandoProntuario,
  conviventeAtual,
  abrirCarteirinha,
  solicitarImpressaoFichaCompleta,
  podeExcluirConviventeSemVinculos,
  excluirConviventeSemVinculos,
  setTelaAtual,
  trocarAbaComSalvamento,
}) {
  const podeImprimir = Boolean(editandoId && conviventeAtual);

  const classeAba = (aba, classeAtiva, classeInativa) => (
    `px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors disabled:opacity-60 ${
      abaAtual === aba ? classeAtiva : classeInativa
    }`
  );

  return (
    <>
      <div className="bg-gradient-to-r from-slate-950 via-blue-950 to-violet-950 p-5 text-white flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">
            Prontuário institucional
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight">Ficha de admissão institucional</h2>
          <p className="text-slate-300 text-xs mt-1">Dados assistenciais restritos à instituição e protegidos por perfil de acesso.</p>
        </div>

        <div className="flex items-center gap-3">
          {editandoId && (
            <>
              <button
                type="button"
                onClick={() => podeImprimir && abrirCarteirinha(conviventeAtual)}
                disabled={!podeImprimir}
                className="bg-white/10 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-white/15 transition-colors flex items-center gap-2 border border-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Imprimir ID de acesso
              </button>
              <button
                type="button"
                onClick={() => podeImprimir && solicitarImpressaoFichaCompleta({ ...conviventeAtual, ...formData, id: editandoId })}
                disabled={!podeImprimir}
                className="bg-white text-slate-800 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-100 transition-colors flex items-center gap-2 border border-white/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Imprimir ficha completa
              </button>
              {podeExcluirConviventeSemVinculos && (
                <button
                  type="button"
                  onClick={excluirConviventeSemVinculos}
                  disabled={salvandoProntuario}
                  className="bg-red-500/15 text-red-50 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-red-500/25 transition-colors flex items-center gap-2 border border-red-200/25 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Disponível apenas para cadastro criado por engano e sem vínculos operacionais."
                >
                  Excluir sem vínculos
                </button>
              )}
            </>
          )}
          <button type="button" onClick={() => setTelaAtual('lista')} className="text-slate-200 hover:text-white text-sm font-bold bg-white/10 px-4 py-2 rounded-xl border border-white/10">Fechar</button>
        </div>
      </div>

      <div className="flex border-b bg-slate-50 overflow-x-auto px-2">
        <button type="button" disabled={salvandoProntuario} onClick={() => trocarAbaComSalvamento('pessoais')} className={classeAba('pessoais', 'border-brand text-brand bg-white', 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70')}>Pessoais e status</button>
        <button type="button" disabled={salvandoProntuario} onClick={() => trocarAbaComSalvamento('social')} className={classeAba('social', 'border-brand text-brand bg-white', 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70')}>Assistência social</button>
        <button type="button" disabled={salvandoProntuario} onClick={() => trocarAbaComSalvamento('historico')} className={classeAba('historico', 'border-brand text-brand bg-white', 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70')}>Histórico</button>
        {podeGerenciarPiaConvivente && (
          <button type="button" disabled={salvandoProntuario} onClick={() => trocarAbaComSalvamento('pia')} className={classeAba('pia', 'border-indigo-500 text-indigo-600 bg-indigo-50/50', 'border-transparent text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/30')}>PIA</button>
        )}
        <button type="button" disabled={salvandoProntuario} onClick={() => trocarAbaComSalvamento('fluxo')} className={classeAba('fluxo', 'border-emerald-500 text-emerald-600 bg-white', 'border-transparent text-slate-500 hover:text-slate-700')}>Fluxo Diário</button>

        {perfilUsuario !== 'Orientador' && (
          <>
            <button type="button" disabled={salvandoProntuario} onClick={() => trocarAbaComSalvamento('saude')} className={classeAba('saude', 'border-brand text-brand bg-white', 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70')}>Saúde e cofre</button>
            <button type="button" disabled={salvandoProntuario} onClick={() => trocarAbaComSalvamento('sensiveis')} className={classeAba('sensiveis', 'border-red-500 text-red-600 bg-red-50/50', 'border-transparent text-slate-500 hover:text-red-500 hover:bg-red-50/30')}>Dados sensíveis</button>
          </>
        )}

        <button type="button" disabled={salvandoProntuario} onClick={() => trocarAbaComSalvamento('documentos')} className={classeAba('documentos', 'border-blue-500 text-blue-600 bg-blue-50/50', 'border-transparent text-slate-500 hover:text-blue-600 hover:bg-blue-50/30')}>Anexos e GED</button>
      </div>
    </>
  );
}
