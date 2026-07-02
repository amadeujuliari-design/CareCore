import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import {
  obterPainelAjustesTotaisDia,
  salvarAjustesTotaisDia,
} from './services/rotinaAjustesTotaisService';
import { dataHojeIsoLocal } from './utils/prontuarioHistoricoFluxoUtils';
import { formatarDataBr } from './utils/dataBrasilUtils';

const JUSTIFICATIVA_MIN = 30;

function dataOntemIsoLocal() {
  const data = new Date();
  data.setHours(0, 0, 0, 0);
  data.setDate(data.getDate() - 1);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export default function RotinaAjustesTotais() {
  const [dataReferencia, setDataReferencia] = useState(() => dataOntemIsoLocal());
  const [painel, setPainel] = useState(null);
  const [ajustesForm, setAjustesForm] = useState({});
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const hojeIso = useMemo(() => dataHojeIsoLocal(), []);

  const carregarPainel = useCallback(async () => {
    try {
      setLoading(true);
      setErro('');
      const dados = await obterPainelAjustesTotaisDia(dataReferencia);
      setPainel(dados);
      const mapa = {};
      (dados.itens || []).forEach((item) => {
        mapa[item.tipo_registro] = String(item.ajuste_manual || 0);
      });
      setAjustesForm(mapa);
      setJustificativa(dados.justificativa_existente || '');
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível carregar os totais do dia.');
      setPainel(null);
    } finally {
      setLoading(false);
    }
  }, [dataReferencia]);

  useEffect(() => {
    carregarPainel();
  }, [carregarPainel]);

  useEffect(() => {
    if (!sucesso) return undefined;
    const timer = setTimeout(() => setSucesso(''), 4000);
    return () => clearTimeout(timer);
  }, [sucesso]);

  const totaisPreview = useMemo(() => {
    if (!painel?.itens) return { registrados: 0, ajuste: 0, total: 0 };
    return (painel.itens || []).reduce(
      (acc, item) => {
        const ajuste = Number(ajustesForm[item.tipo_registro] || 0);
        acc.registrados += Number(item.registrados || 0);
        acc.ajuste += ajuste;
        acc.total += Number(item.registrados || 0) + ajuste;
        return acc;
      },
      { registrados: 0, ajuste: 0, total: 0 },
    );
  }, [painel, ajustesForm]);

  const handleSalvar = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');

    if (painel?.bloqueado) {
      setErro(painel.motivo_bloqueio || 'Este dia não pode ser ajustado.');
      return;
    }

    const texto = justificativa.trim();
    if (texto.length < JUSTIFICATIVA_MIN) {
      setErro(`Informe uma justificativa com pelo menos ${JUSTIFICATIVA_MIN} caracteres.`);
      return;
    }

    const ajustes = (painel?.itens || [])
      .map((item) => ({
        tipo_registro: item.tipo_registro,
        quantidade_ajuste: Math.max(0, Number(ajustesForm[item.tipo_registro] || 0)),
      }))
      .filter((item) => item.quantidade_ajuste > 0);

    if (ajustes.length === 0) {
      setErro('Informe ao menos um complemento em algum tipo de registro.');
      return;
    }

    try {
      setSalvando(true);
      const dados = await salvarAjustesTotaisDia({
        data_referencia: dataReferencia,
        justificativa: texto,
        ajustes,
      });
      setPainel(dados);
      setSucesso('Ajustes salvos. Os relatórios exibirão os totais com identificação de ajuste manual.');
      await carregarPainel();
    } catch (error) {
      setErro(error.response?.data?.detail || 'Não foi possível salvar os ajustes.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          titulo="Ajustes de Totais"
          subtitulo="Complemente contagens de rotina em dias sem registro em tempo real. Não altera presença por convivente nem auditoria SISA individual."
        />

        <ScrollArea className="p-4 md:p-6">
          <div className="mx-auto max-w-4xl space-y-5">
            <section className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-950">
              <p className="font-bold">Como funciona</p>
              <p className="mt-1 text-amber-900">
                Informe apenas o que <strong>faltou registrar</strong> no dia escolhido.
                Nos relatórios institucionais aparecerá: registrados + ajuste manual (etiqueta).
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">Dia a ajustar</label>
                  <input
                    type="date"
                    max={hojeIso}
                    value={dataReferencia}
                    onChange={(e) => setDataReferencia(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Somente dias anteriores a hoje. Bloqueado após importação SISA do mês.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-bold uppercase text-slate-500">Resumo do dia</p>
                  <p className="mt-2 font-semibold text-slate-800">{formatarDataBr(dataReferencia)}</p>
                  <p className="mt-1 text-slate-600">
                    Registrados: <strong>{totaisPreview.registrados}</strong>
                    {' · '}
                    Ajuste: <strong>{totaisPreview.ajuste}</strong>
                    {' · '}
                    Total exibido: <strong>{totaisPreview.total}</strong>
                  </p>
                  {painel?.tem_ajuste_manual && (
                    <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                      Ajuste manual
                    </span>
                  )}
                </div>
              </div>

              {painel?.bloqueado && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                  {painel.motivo_bloqueio}
                </div>
              )}

              {erro && (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                  {erro}
                </div>
              )}
              {sucesso && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  {sucesso}
                </div>
              )}
            </section>

            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500">
                Carregando totais do dia...
              </div>
            ) : (
              <form onSubmit={handleSalvar} className="space-y-4">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3 text-center">Registrados</th>
                        <th className="px-4 py-3 text-center">Complemento (faltou)</th>
                        <th className="px-4 py-3 text-center">Total exibido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(painel?.itens || []).map((item) => {
                        const complemento = Number(ajustesForm[item.tipo_registro] || 0);
                        const total = Number(item.registrados || 0) + complemento;
                        return (
                          <tr key={item.tipo_registro} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-semibold text-slate-800">{item.tipo_registro}</td>
                            <td className="px-4 py-3 text-center text-slate-600">{item.registrados}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                disabled={painel?.bloqueado}
                                value={ajustesForm[item.tipo_registro] ?? '0'}
                                onChange={(e) => setAjustesForm((prev) => ({
                                  ...prev,
                                  [item.tipo_registro]: e.target.value,
                                }))}
                                className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-900">
                              {total}
                              {complemento > 0 && (
                                <span className="ml-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">
                                  ajuste
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Justificativa do ajuste (mín. {JUSTIFICATIVA_MIN} caracteres)
                  </label>
                  <textarea
                    rows={4}
                    disabled={painel?.bloqueado}
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Ex.: Falha de energia impediu registros na portaria em 30/06/2026."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </section>

                <div className="flex justify-end">
                  <PremiumButton type="submit" disabled={salvando || painel?.bloqueado}>
                    {salvando ? 'Salvando...' : 'Salvar ajustes do dia'}
                  </PremiumButton>
                </div>
              </form>
            )}
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
