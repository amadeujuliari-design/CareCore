import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, RefreshCw, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

import Sidebar from './Sidebar';
import BannerConferenciaNfpPrazo from './components/BannerConferenciaNfpPrazo';
import BannerSomenteLeituraGlobal from './components/BannerSomenteLeituraGlobal';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea, SectionCard } from './components/PremiumUI';
import { CARECORE_VERSAO } from './config/versao';
import {
  nfpConferenciaBatimento,
  nfpConferenciaReenfileirar,
  nfpConferenciaResumo,
} from './services/nfpService';
import { erroApiNfp } from './utils/nfpCadastroUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { usuarioPodeGestaoNfp, usuarioSomenteLeituraNfp } from './utils/rbacUtils';

const PASSOS = [
  { id: 1, titulo: 'Contexto' },
  { id: 2, titulo: 'Importar Pedidos' },
  { id: 3, titulo: 'Batimento' },
  { id: 4, titulo: 'Reenfileirar' },
];

function formatarValor(centavos) {
  if (centavos == null || centavos === '') return '—';
  return Number(centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function classeSituacao(situacao) {
  const s = String(situacao || '');
  if (s.startsWith('OK')) return 'text-emerald-700 bg-emerald-50';
  if (s.startsWith('AGUARDANDO')) return 'text-amber-800 bg-amber-50';
  if (s.startsWith('DUVIDOSO')) return 'text-orange-800 bg-orange-50';
  return 'text-rose-800 bg-rose-50';
}

export default function NfpConferenciaSefaz() {
  const usuario = useMemo(() => {
    try {
      const token = localStorage.getItem('@CareCore:token');
      return token ? decodificarPayloadJwt(token) : null;
    } catch {
      return null;
    }
  }, []);

  const podeVer = usuarioPodeGestaoNfp(usuario);
  const somenteConsultaGlobal = usuarioSomenteLeituraNfp(usuario);

  const [passo, setPasso] = useState(1);
  const [resumo, setResumo] = useState(null);
  const [arquivo, setArquivo] = useState(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [batimento, setBatimento] = useState(null);
  const [selecionados, setSelecionados] = useState({});
  const [loading, setLoading] = useState(true);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregarResumo = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await nfpConferenciaResumo({
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
      });
      setResumo(data);
    } catch (error) {
      setResumo(null);
      setErro(erroApiNfp(error, 'Não foi possível carregar o resumo da conferência.'));
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => {
    if (podeVer) carregarResumo();
  }, [carregarResumo, podeVer]);

  const itensDuvidosos = useMemo(() => {
    const lista = batimento?.itens || [];
    return lista.filter((item) => {
      const s = String(item.situacao || '');
      return s.startsWith('NAO ENCONTRADO') || s.startsWith('DUVIDOSO');
    });
  }, [batimento]);

  const rodarBatimento = async () => {
    if (!arquivo) {
      setErro('Selecione o CSV de Pedidos SEFAZ (tipo CADASTRO).');
      return;
    }
    setTrabalhando(true);
    setErro('');
    setSucesso('');
    try {
      const fd = new FormData();
      fd.append('arquivo', arquivo);
      if (dataInicio) fd.append('data_inicio', dataInicio);
      if (dataFim) fd.append('data_fim', dataFim);
      fd.append('status_cupom', 'enviado');
      const data = await nfpConferenciaBatimento(fd);
      setBatimento(data);
      const sel = {};
      (data.chaves_reenfileiraveis || []).forEach((ch) => {
        sel[ch] = true;
      });
      setSelecionados(sel);
      setPasso(3);
      setSucesso(`Batimento concluído: ${data.cupons_analisados} cupom(ns) analisados.`);
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao executar o batimento.'));
    } finally {
      setTrabalhando(false);
    }
  };

  const reenfileirar = async () => {
    const chaves = Object.entries(selecionados)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!chaves.length) {
      setErro('Marque ao menos um cupom para reenfileirar.');
      return;
    }
    if (!window.confirm(`Reenfileirar ${chaves.length} cupom(ns) como pendente?`)) return;
    setTrabalhando(true);
    setErro('');
    setSucesso('');
    try {
      const data = await nfpConferenciaReenfileirar({ chaves });
      setSucesso(`${data.atualizados} cupom(ns) reenfileirados. ${data.ignorados} ignorado(s).`);
      setPasso(4);
      await carregarResumo();
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao reenfileirar cupons.'));
    } finally {
      setTrabalhando(false);
    }
  };

  if (!podeVer) {
    return (
      <AppShell>
        <Sidebar versao={CARECORE_VERSAO} />
        <MainShell>
          <p className="p-8 text-sm text-slate-600">Acesso restrito a ADM Global NFP e Manutenção.</p>
        </MainShell>
      </AppShell>
    );
  }

  const contagens = resumo?.contagens || {};
  const aviso = resumo?.aviso || {};

  return (
    <AppShell>
      <Sidebar versao={CARECORE_VERSAO} />
      <MainShell>
        <ScrollArea>
          {somenteConsultaGlobal && <BannerSomenteLeituraGlobal />}

          <PageHeader
            title="Conferência pré-prazo SEFAZ"
            subtitle="Batimento Pedidos × cupons antes do dia 20. Cruza CNPJ + número SAT + valor quando disponível."
          />

          <BannerConferenciaNfpPrazo aviso={aviso} usuario={usuario} />

          <div className="mb-6 flex flex-wrap gap-2">
            {PASSOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPasso(p.id)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  passo === p.id ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {p.id}. {p.titulo}
              </button>
            ))}
          </div>

          {erro && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {erro}
            </div>
          )}
          {sucesso && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {sucesso}
            </div>
          )}

          {passo === 1 && (
            <SectionCard title="1. Contexto e prioridades">
              {loading ? (
                <p className="text-sm text-slate-500">Carregando…</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">Pendentes</div>
                    <div className="text-2xl font-bold text-slate-900">{contagens.pendente || 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">Reservados</div>
                    <div className="text-2xl font-bold text-slate-900">{contagens.reservado || 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">Enviados</div>
                    <div className="text-2xl font-bold text-slate-900">{contagens.enviado || 0}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold uppercase text-slate-500">Com metadados SEFAZ</div>
                    <div className="text-2xl font-bold text-slate-900">{resumo?.enviados_com_metadados_sefaz || 0}</div>
                  </div>
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Enviados a partir de</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Enviados antes de</span>
                  <input
                    type="date"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <PremiumButton type="button" onClick={() => setPasso(2)}>
                  Próximo: importar Pedidos
                </PremiumButton>
                <PremiumButton type="button" variant="secondary" onClick={carregarResumo}>
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </PremiumButton>
              </div>
            </SectionCard>
          )}

          {passo === 2 && (
            <SectionCard title="2. Importar Pedidos SEFAZ (CADASTRO)">
              <p className="mb-4 text-sm text-slate-600">
                Baixe no portal NFP o export <strong>Pedidos</strong> (tipo CADASTRO) e envie o CSV aqui.
                O batimento usa CNPJ + número da nota + valor; quando o robô gravou metadados da tela, usa o número SAT.
              </p>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6">
                <FileUp className="h-8 w-8 text-sky-700" />
                <span className="text-sm text-slate-700">
                  {arquivo ? arquivo.name : 'Clique para escolher o CSV de Pedidos'}
                </span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => setArquivo(e.target.files?.[0] || null)}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <PremiumButton type="button" disabled={trabalhando} onClick={rodarBatimento}>
                  Executar batimento
                </PremiumButton>
                <PremiumButton type="button" variant="secondary" onClick={() => setPasso(1)}>
                  Voltar
                </PremiumButton>
              </div>
            </SectionCard>
          )}

          {passo === 3 && batimento && (
            <SectionCard title="3. Resultado do batimento">
              <div className="mb-4 grid gap-3 md:grid-cols-4">
                {Object.entries(batimento.totais || {}).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div className="text-xs uppercase text-slate-500">{k.replace(/_/g, ' ')}</div>
                    <div className="text-lg font-bold">{v}</div>
                  </div>
                ))}
              </div>
              <p className="mb-3 text-sm text-slate-600">
                Pedidos CADASTRO: {batimento.pedidos_cadastro} · Cupons analisados: {batimento.cupons_analisados}
              </p>
              <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Sel.</th>
                      <th className="px-3 py-2">Situação</th>
                      <th className="px-3 py-2">CNPJ</th>
                      <th className="px-3 py-2">Nº SAT</th>
                      <th className="px-3 py-2">Valor</th>
                      <th className="px-3 py-2">Chave (fim)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batimento.itens || []).map((item) => {
                      const reenfileiravel =
                        String(item.situacao || '').startsWith('NAO') ||
                        String(item.situacao || '').startsWith('DUVIDOSO');
                      return (
                        <tr key={item.chave} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            {reenfileiravel ? (
                              <input
                                type="checkbox"
                                checked={!!selecionados[item.chave]}
                                onChange={(e) =>
                                  setSelecionados((atual) => ({
                                    ...atual,
                                    [item.chave]: e.target.checked,
                                  }))
                                }
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className={`px-3 py-2 font-medium ${classeSituacao(item.situacao)}`}>
                            {item.situacao}
                          </td>
                          <td className="px-3 py-2">{item.cnpj || '—'}</td>
                          <td className="px-3 py-2">{item.numero_nota_sefaz || item.numero || '—'}</td>
                          <td className="px-3 py-2">{formatarValor(item.valor_cent)}</td>
                          <td className="px-3 py-2 font-mono">…{String(item.chave || '').slice(-8)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <PremiumButton type="button" disabled={trabalhando || !itensDuvidosos.length} onClick={reenfileirar}>
                  Reenfileirar selecionados ({Object.values(selecionados).filter(Boolean).length})
                </PremiumButton>
                <PremiumButton type="button" variant="secondary" onClick={() => setPasso(2)}>
                  Novo batimento
                </PremiumButton>
              </div>
            </SectionCard>
          )}

          {passo === 4 && (
            <SectionCard title="4. Próximo passo — robô">
              <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Cupons reenfileirados voltaram para a fila pendente.</p>
                  <p className="mt-1">
                    Use <strong>Envio contínuo (noite)</strong> no agente local para esgotar a fila sem parar a cada 100 cupons.
                  </p>
                  <Link
                    to="/nfp/envio-sefaz"
                    className="mt-3 inline-flex items-center gap-2 font-semibold text-sky-800 underline"
                  >
                    <Send className="h-4 w-4" />
                    Abrir Envio SEFAZ
                  </Link>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Após o robô, baixe um Pedidos novo e rode o batimento de novo para validar os totais finais.
                </p>
              </div>
            </SectionCard>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
