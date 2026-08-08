import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Target } from 'lucide-react';

import Sidebar from './Sidebar';
import BannerSomenteLeituraGlobal from './components/BannerSomenteLeituraGlobal';
import { AppShell, MainShell, PageHeader, PremiumButton, ReportActionButton, ScrollArea } from './components/PremiumUI';
import {
  nfpExportarMetas,
  nfpMetasConsolidado,
  nfpObterMetas,
  nfpSalvarMetas,
  nfpSugerirMetasRateio,
} from './services/nfpService';
import { erroApiNfp } from './utils/nfpCadastroUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { usuarioSomenteLeituraNfp } from './utils/rbacUtils';
import { buscarIdentidadeRelatoriosOrganizacao } from './utils/relatorioIdentidadePrint';
import {
  OPCOES_IMPRESSAO_METAS_PADRAO,
  imprimirMetasConsolidado,
  imprimirMetasMensal,
} from './utils/relatorioNfpMetasPrint';

function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function money(v) {
  const n = Number(v || 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function inteiroFmt(v) {
  return Number(v || 0).toLocaleString('pt-BR');
}

function parseMoedaBr(texto) {
  if (texto == null || texto === '') return 0;
  const s = String(texto)
    .replace(/[R$\s]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseInteiroBr(texto) {
  if (texto == null || texto === '') return 0;
  const s = String(texto).replace(/\D/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function pct(v) {
  return `${(Number(v || 0) * 100).toFixed(2)}%`;
}

/** Batimento planilha: entradas vs saidas (com Diego no rodape, como no Excel). */
function resolverBatimento(dados) {
  const calc = dados?.calculado || {};
  const head = dados?.cabecalho || {};
  const conquistado = Number(
    calc.valor_conquistado
      ?? calc.total_geral_aeb
      ?? (
        Number(head.soulcial_base || 0)
        + Number(head.f35_digitado || 0)
        + Number(head.f36_doado || 0)
        + Number(head.total_captador || 0)
      ),
  );
  const somaLinhas = (dados?.linhas || []).reduce((acc, l) => acc + Number(l.total || 0), 0);
  const g37 = Number(calc.g37_fundo ?? (Number(calc.g35_fundo || 0) + Number(calc.g36_fundo || 0)));
  const aplicado = Number(
    calc.valor_aplicado
      ?? (
        Number(calc.soulcial_rateio || 0)
        + g37
        + somaLinhas
        + Number(calc.valor_diego || 0)
      ),
  );
  const diferenca = Math.round((conquistado - aplicado) * 100) / 100;
  const ok = typeof calc.batimento_ok === 'boolean'
    ? calc.batimento_ok
    : Math.abs(diferenca) <= 0.05;
  return {
    valor_conquistado: conquistado,
    valor_aplicado: aplicado,
    batimento_diferenca: Number(calc.batimento_diferenca ?? diferenca),
    batimento_ok: ok,
  };
}

export default function NfpMetas() {
  const somenteLeitura = useMemo(() => {
    try {
      const token = localStorage.getItem('@CareCore:token');
      return usuarioSomenteLeituraNfp(token ? decodificarPayloadJwt(token) : null);
    } catch {
      return false;
    }
  }, []);

  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [aba, setAba] = useState('mensal');
  const [dados, setDados] = useState(null);
  const [consolidado, setConsolidado] = useState(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [opcoesImpressao, setOpcoesImpressao] = useState(OPCOES_IMPRESSAO_METAS_PADRAO);
  const [imprimindo, setImprimindo] = useState(false);
  const salvarTimerRef = useRef(null);
  const salvandoRef = useRef(false);
  const pendenteSalvarRef = useRef(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await nfpObterMetas(competencia);
      setDados(data);
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível carregar as metas.'));
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, [competencia]);

  const carregarConsolidado = useCallback(async () => {
    try {
      const data = await nfpMetasConsolidado();
      setConsolidado(data);
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao carregar consolidado.'));
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (aba === 'consolidado') carregarConsolidado();
  }, [aba, carregarConsolidado]);

  useEffect(() => {
    buscarIdentidadeRelatoriosOrganizacao()
      .then(setIdentidadeRelatorio)
      .catch(() => setIdentidadeRelatorio(null));
  }, []);

  useEffect(() => () => {
    if (salvarTimerRef.current) clearTimeout(salvarTimerRef.current);
  }, []);

  const atualizarOpcaoImpressao = (campo, marcado) => {
    setOpcoesImpressao((atual) => ({ ...atual, [campo]: marcado }));
  };

  const montarPayload = useCallback((snapshot) => ({
    ref_credito: snapshot.ref_credito,
    titulo: snapshot.titulo,
    data_liberacao_credito: snapshot.cabecalho?.data_liberacao_credito,
    observacoes: snapshot.cabecalho?.observacoes,
    cabecalho: snapshot.cabecalho,
    parametros: snapshot.parametros,
    linhas: (snapshot.linhas || []).map((l) => ({
      codigo_projeto: l.codigo_projeto,
      digitadas: l.digitadas,
      doadas: l.doadas,
      soulcial: l.soulcial,
      soulcial_campanhas: l.soulcial_campanhas,
    })),
  }), []);

  const persistirMetas = useCallback(async (snapshot, { silencioso = false } = {}) => {
    if (somenteLeitura || !snapshot) return;
    pendenteSalvarRef.current = { snapshot, silencioso };
    if (salvandoRef.current) return;

    salvandoRef.current = true;
    setSalvando(true);
    try {
      while (pendenteSalvarRef.current) {
        const { snapshot: atual, silencioso: quieto } = pendenteSalvarRef.current;
        pendenteSalvarRef.current = null;
        if (!quieto) {
          setErro('');
          setSucesso('');
        }
        try {
          const salvo = await nfpSalvarMetas(competencia, montarPayload(atual));
          setDados(salvo);
          setSucesso(quieto ? 'Recalculado automaticamente.' : 'Metas salvas e recalculadas.');
        } catch (error) {
          setErro(erroApiNfp(error, 'Não foi possível salvar.'));
          break;
        }
      }
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }, [competencia, montarPayload, somenteLeitura]);

  const agendarPersistencia = useCallback((snapshot) => {
    if (somenteLeitura || !snapshot) return;
    if (salvarTimerRef.current) clearTimeout(salvarTimerRef.current);
    salvarTimerRef.current = setTimeout(() => {
      persistirMetas(snapshot, { silencioso: true });
    }, 500);
  }, [persistirMetas, somenteLeitura]);

  const valorAlterou = (antes, depois) => {
    const a = Number(antes);
    const b = Number(depois);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return Math.abs(a - b) > 0.0001;
    }
    return String(antes ?? '') !== String(depois ?? '');
  };

  const atualizarCabecalho = (campo, valor) => {
    setDados((atual) => {
      if (!atual) return atual;
      if (!valorAlterou(atual.cabecalho?.[campo], valor)) return atual;
      const novo = {
        ...atual,
        cabecalho: { ...atual.cabecalho, [campo]: valor },
      };
      agendarPersistencia(novo);
      return novo;
    });
  };

  const atualizarLinha = (codigo, campo, valor) => {
    setDados((atual) => {
      if (!atual) return atual;
      const linha = (atual.linhas || []).find((l) => l.codigo_projeto === codigo);
      if (linha && !valorAlterou(linha[campo], valor)) return atual;
      const novo = {
        ...atual,
        linhas: (atual.linhas || []).map((l) => (
          l.codigo_projeto === codigo ? { ...l, [campo]: valor } : l
        )),
      };
      agendarPersistencia(novo);
      return novo;
    });
  };

  const atualizarRefCredito = (valor) => {
    setDados((atual) => {
      if (!atual) return atual;
      if ((atual.ref_credito || '') === (valor || '')) return atual;
      const novo = { ...atual, ref_credito: valor };
      agendarPersistencia(novo);
      return novo;
    });
  };

  const salvar = async () => {
    if (somenteLeitura || !dados) return;
    if (salvarTimerRef.current) clearTimeout(salvarTimerRef.current);
    await persistirMetas(dados, { silencioso: false });
  };

  const sugerir = async () => {
    if (somenteLeitura) return;
    setSalvando(true);
    setErro('');
    try {
      const data = await nfpSugerirMetasRateio(competencia, true);
      setDados(data);
      setSucesso(
        `Valores atualizados do rateio NFP (ref ${data.sugestao_origem?.ref || competencia}).`,
      );
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao sugerir do rateio.'));
    } finally {
      setSalvando(false);
    }
  };

  const exportar = async () => {
    try {
      const blob = await nfpExportarMetas(competencia);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfp-metas-${competencia}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao exportar.'));
    }
  };

  const imprimir = async () => {
    setImprimindo(true);
    setErro('');
    try {
      let ok = false;
      if (aba === 'consolidado') {
        const dataConsolidado = consolidado?.por_projeto?.length
          ? consolidado
          : await nfpMetasConsolidado();
        if (!consolidado?.por_projeto?.length) setConsolidado(dataConsolidado);
        ok = await imprimirMetasConsolidado({
          consolidado: dataConsolidado,
          identidadeRelatorio,
        });
      } else {
        ok = await imprimirMetasMensal({
          dados,
          identidadeRelatorio,
          opcoes: opcoesImpressao,
        });
      }
      if (!ok) setErro('Não há dados para imprimir nesta visão.');
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao imprimir.'));
    } finally {
      setImprimindo(false);
    }
  };

  const calc = dados?.calculado || {};
  const head = dados?.cabecalho || {};
  const batimento = useMemo(() => resolverBatimento(dados), [dados]);
  const podeImprimir = aba === 'consolidado'
    ? Boolean(consolidado?.por_projeto?.length)
    : Boolean(dados?.linhas?.length);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Créditos"
          title="Metas / Rateio mensal"
          subtitle="Competência = mês de pagamento; Ref. crédito = mês SEFAZ (em geral 4 meses antes). Campos digitáveis salvam e recalculam ao sair do campo."
          icon={<Target className="h-5 w-5" />}
          backTo="/nfp"
          backLabel="Voltar ao dashboard"
          actions={(
            <div className="flex flex-wrap gap-2">
              <ReportActionButton type="button" action="export" disabled={!dados} onClick={exportar}>
                Exportar XLSX
              </ReportActionButton>
              <ReportActionButton
                type="button"
                action="print"
                disabled={!podeImprimir || imprimindo}
                onClick={imprimir}
              >
                {imprimindo ? 'Preparando...' : 'Imprimir'}
              </ReportActionButton>
              {!somenteLeitura && (
                <>
                  <PremiumButton
                    type="button"
                    variant="secondary"
                    disabled={salvando}
                    onClick={sugerir}
                    title="Recarrega Digitadas/Doadas CPF e Total captador a partir do rateio da ref. crédito, sobrescrevendo os valores atuais"
                  >
                    Atualizar do rateio
                  </PremiumButton>
                  <PremiumButton type="button" disabled={salvando || loading} onClick={salvar}>
                    {salvando ? 'Salvando...' : 'Salvar agora'}
                  </PremiumButton>
                </>
              )}
            </div>
          )}
        />

        {somenteLeitura && (
          <BannerSomenteLeituraGlobal modulo="as metas e o rateio mensal NFP" />
        )}

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Competência (pagamento)
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Ref. crédito SEFAZ
            <input
              type="month"
              value={dados?.ref_credito || ''}
              disabled={somenteLeitura || !dados}
              onChange={(e) => atualizarRefCredito(e.target.value)}
              className="mt-1 block rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
            />
          </label>
          <div className="flex gap-2">
            <PremiumButton
              type="button"
              variant={aba === 'mensal' ? 'primary' : 'secondary'}
              onClick={() => setAba('mensal')}
            >
              Mensal
            </PremiumButton>
            <PremiumButton
              type="button"
              variant={aba === 'consolidado' ? 'primary' : 'secondary'}
              onClick={() => setAba('consolidado')}
            >
              Consolidado / ranking
            </PremiumButton>
          </div>
        </div>

        <section className="mb-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Impressão</p>
              <p className="mt-1 text-sm text-slate-700">
                Usa a personalização da <strong>ONG</strong> (Gestão Global → Personalização): logo, nome e rodapé.
                Não usa a identidade do projeto.
              </p>
            </div>
          </div>
          {aba === 'mensal' && (
            <div className="mt-3 flex flex-wrap gap-3">
              {[
                { campo: 'incluirResumo', label: 'Resumo / entradas' },
                { campo: 'incluirPercentuais', label: 'Percentuais' },
                { campo: 'incluirValoresRateio', label: 'Valores do rateio' },
                { campo: 'incluirSoulcial', label: 'Soulcial e campanhas' },
                { campo: 'incluirDiego', label: 'Coluna Diego' },
              ].map((item) => (
                <label
                  key={item.campo}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(opcoesImpressao[item.campo])}
                    onChange={(e) => atualizarOpcaoImpressao(item.campo, e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  {item.label}
                </label>
              ))}
            </div>
          )}
        </section>

        <ScrollArea>
          {erro && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
          )}
          {sucesso && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {sucesso}
            </div>
          )}

          {aba === 'mensal' && (
            <>
              {loading || !dados ? (
                <div className="py-10 text-center text-sm text-slate-500">Carregando...</div>
              ) : (
                <>
                  <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <CampoNum
                      label="Digitadas (R$) — do rateio"
                      value={head.f35_digitado}
                      moeda
                      disabled={somenteLeitura}
                      onChange={(v) => atualizarCabecalho('f35_digitado', v)}
                    />
                    <CampoNum
                      label="Doadas CPF (R$) — do rateio"
                      value={head.f36_doado}
                      moeda
                      disabled={somenteLeitura}
                      onChange={(v) => atualizarCabecalho('f36_doado', v)}
                    />
                    <CampoNum
                      label="Soulcial base — manual"
                      value={head.soulcial_base}
                      moeda
                      disabled={somenteLeitura}
                      onChange={(v) => atualizarCabecalho('soulcial_base', v)}
                    />
                    <CampoNum
                      label="Total captador — do rateio"
                      value={head.total_captador}
                      moeda
                      disabled={somenteLeitura}
                      onChange={(v) => atualizarCabecalho('total_captador', v)}
                    />
                    <CampoNum
                      label="Digitadas Diego — manual"
                      value={head.digitadas_diego}
                      inteiro
                      disabled={somenteLeitura}
                      onChange={(v) => atualizarCabecalho('digitadas_diego', v)}
                    />
                  </section>

                  <section className="mb-4 grid gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-sm shadow-sm md:grid-cols-3 xl:grid-cols-6">
                    <CardMini label="Fundo 30% (digitadas)" value={money(calc.g35_fundo)} />
                    <CardMini label="P/ projetos (digitadas)" value={money(calc.h35_projetos)} />
                    <CardMini label="Fundo 30% (doadas)" value={money(calc.g36_fundo)} />
                    <CardMini label="P/ projetos (doadas)" value={money(calc.h36_projetos)} />
                    <CardMini label="Soulcial rateio" value={money(calc.soulcial_rateio)} />
                    <CardMini label="Valor Diego 50%" value={money(calc.valor_diego)} />
                    <CardMini label="Total rateio (projetos)" value={money(calc.total_rateio_geral)} />
                    <CardMini label="Digitadas projetos" value={inteiroFmt(calc.digitadas_projetos)} />
                    <CardMini label="Digitadas geral" value={inteiroFmt(calc.digitadas_geral)} />
                  </section>

                  <section
                    className={`mb-4 rounded-2xl border p-4 shadow-sm ${
                      batimento.batimento_ok
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-600">
                          Batimento · conquistado × aplicado
                        </p>
                        <p className="mt-1 text-sm text-slate-700">
                          Conferência da planilha: entradas (Soulcial + NF + captador) versus saídas
                          (rateio Soulcial + fundo + linhas + Diego).
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ${
                          batimento.batimento_ok
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-600 text-white'
                        }`}
                      >
                        {batimento.batimento_ok ? 'Coincide' : 'Divergente'}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white/80 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Valor conquistado</p>
                        <p className="text-sm font-black text-slate-900">{money(batimento.valor_conquistado)}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Valor aplicado (saídas)</p>
                        <p className="text-sm font-black text-slate-900">{money(batimento.valor_aplicado)}</p>
                      </div>
                      <div className="rounded-xl bg-white/80 px-3 py-2">
                        <p className="text-[10px] font-bold uppercase text-slate-500">Diferença</p>
                        <p className="text-sm font-black text-slate-900">{money(batimento.batimento_diferenca)}</p>
                      </div>
                    </div>
                  </section>

                  <section className="overflow-x-auto rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-2 py-2">Projeto</th>
                          <th className="px-2 py-2">Digitadas</th>
                          <th className="px-2 py-2">%</th>
                          <th className="px-2 py-2">Doadas</th>
                          <th className="px-2 py-2">%</th>
                          <th className="px-2 py-2">Vlr digitado</th>
                          <th className="px-2 py-2">Vlr aplicativo</th>
                          <th className="px-2 py-2">Vlr total</th>
                          <th className="px-2 py-2">Soulcial</th>
                          <th className="px-2 py-2">Campanhas</th>
                          <th className="px-2 py-2">Diego</th>
                          <th className="px-2 py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(dados.linhas || []).map((l) => (
                          <tr key={l.codigo_projeto} className="border-t border-slate-100">
                            <td className="px-2 py-1.5 font-semibold text-slate-800">{l.codigo_projeto}</td>
                            <td className="px-2 py-1.5">
                              <CampoTabela
                                inteiro
                                disabled={somenteLeitura}
                                value={l.digitadas ?? 0}
                                onChange={(v) => atualizarLinha(l.codigo_projeto, 'digitadas', v)}
                                className="w-24"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-slate-500">{pct(l.pct_digitadas)}</td>
                            <td className="px-2 py-1.5">
                              <CampoTabela
                                inteiro
                                disabled={somenteLeitura}
                                value={l.doadas ?? 0}
                                onChange={(v) => atualizarLinha(l.codigo_projeto, 'doadas', v)}
                                className="w-20"
                                title="Vinculado a unidade_captador do doador"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-slate-500">{pct(l.pct_doadas)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{money(l.valor_digitado)}</td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{money(l.valor_aplicativo)}</td>
                            <td className="px-2 py-1.5 font-medium whitespace-nowrap">{money(l.valor_total)}</td>
                            <td className="px-2 py-1.5">
                              <CampoTabela
                                moeda
                                disabled={somenteLeitura}
                                value={l.soulcial ?? 0}
                                onChange={(v) => atualizarLinha(l.codigo_projeto, 'soulcial', v)}
                                className="w-28"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <CampoTabela
                                moeda
                                disabled={somenteLeitura}
                                value={l.soulcial_campanhas ?? 0}
                                onChange={(v) => atualizarLinha(l.codigo_projeto, 'soulcial_campanhas', v)}
                                className="w-28"
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{money(l.diego)}</td>
                            <td className="px-2 py-1.5 font-bold text-slate-900 whitespace-nowrap">{money(l.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-[11px] text-slate-500">
                      Doadas: preenchidas a partir do cadastro de doadores (`unidade_captador` = projeto).
                      Digitadas / Soulcial / Campanhas: manuais até haver importação automática.
                    </p>
                  </section>
                </>
              )}
            </>
          )}

          {aba === 'consolidado' && (
            <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Ranking por projeto (somas das competências salvas)</h3>
              {!consolidado ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="px-2 py-2">#</th>
                        <th className="px-2 py-2">Projeto</th>
                        <th className="px-2 py-2">Digitadas</th>
                        <th className="px-2 py-2">Doadas</th>
                        <th className="px-2 py-2">Valor total</th>
                        <th className="px-2 py-2">Total geral</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(consolidado.por_projeto || []).map((p) => (
                        <tr key={p.codigo_projeto} className="border-t border-slate-100">
                          <td className="px-2 py-2">{p.colocacao}</td>
                          <td className="px-2 py-2 font-semibold">{p.codigo_projeto}</td>
                          <td className="px-2 py-2">{inteiroFmt(p.digitadas)}</td>
                          <td className="px-2 py-2">{inteiroFmt(p.doadas)}</td>
                          <td className="px-2 py-2 whitespace-nowrap">{money(p.valor_total)}</td>
                          <td className="px-2 py-2 font-bold whitespace-nowrap">{money(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}

function CardMini({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function CampoNum({ label, value, onChange, disabled, inteiro, moeda }) {
  return (
    <label className="text-xs font-semibold text-slate-600">
      {label}
      <CampoTabela
        value={value}
        onChange={onChange}
        disabled={disabled}
        inteiro={inteiro}
        moeda={moeda}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
      />
    </label>
  );
}

function CampoTabela({
  value,
  onChange,
  disabled,
  inteiro = false,
  moeda = false,
  className = '',
  title,
}) {
  const formatarExibicao = (v = value) => {
    if (moeda) return money(v);
    if (inteiro) return inteiroFmt(v);
    return String(v ?? 0);
  };

  const [texto, setTexto] = useState(() => formatarExibicao());
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) setTexto(formatarExibicao(value));
  }, [value, moeda, inteiro, focado]);

  return (
    <input
      type="text"
      inputMode={inteiro ? 'numeric' : 'decimal'}
      disabled={disabled}
      value={texto}
      title={title}
      onFocus={() => {
        setFocado(true);
        if (moeda) {
          setTexto(Number(value || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }));
        } else if (inteiro) {
          setTexto(String(Number(value || 0)));
        }
      }}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={() => {
        setFocado(false);
        let parsed;
        if (moeda) parsed = parseMoedaBr(texto);
        else if (inteiro) parsed = parseInteiroBr(texto);
        else parsed = texto;
        const mudou = moeda || inteiro
          ? Math.abs(Number(parsed || 0) - Number(value || 0)) > 0.0001
          : String(parsed ?? '') !== String(value ?? '');
        if (mudou) onChange(parsed);
        setTexto(formatarExibicao(mudou ? parsed : value));
      }}
      className={`rounded-lg border border-slate-200 px-2 py-1 disabled:bg-slate-50 ${className}`}
    />
  );
}
