import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Send } from 'lucide-react';

import Sidebar from './Sidebar';
import BannerSomenteLeituraGlobal from './components/BannerSomenteLeituraGlobal';
import { AppShell, MainShell, PageHeader, PremiumButton, ScrollArea } from './components/PremiumUI';
import { CARECORE_VERSAO } from './config/versao';
import {
  nfpEnvioSefazAbrirChrome,
  nfpEnvioSefazEnviarFila,
  nfpEnvioSefazParar,
  nfpEnvioSefazStatus,
} from './services/nfpService';
import { erroApiNfp } from './utils/nfpCadastroUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import {
  usuarioPodeOperarEnvioSefaz,
  usuarioPodeVerEnvioSefaz,
  usuarioSomenteLeituraNfp,
} from './utils/rbacUtils';

const AGENTE_EXE_URL = '/downloads/CareCore-Agente-NFP.exe';
const AGENTE_EXE_META_URL = '/downloads/CareCore-Agente-NFP.json';
const AGENTE_ZIP_URL = '/downloads/agente-nfp-robo.zip';
const AGENTE_META_URL = '/downloads/agente-nfp-robo.json';

export default function NfpEnvioSefaz() {
  const usuario = useMemo(() => {
    try {
      const token = localStorage.getItem('@CareCore:token');
      return token ? decodificarPayloadJwt(token) : null;
    } catch {
      return null;
    }
  }, []);

  const podeVer = usuarioPodeVerEnvioSefaz(usuario);
  const podeOperar = usuarioPodeOperarEnvioSefaz(usuario);
  const somenteConsultaGlobal = usuarioSomenteLeituraNfp(usuario);

  const [status, setStatus] = useState(null);
  const [fonte, setFonte] = useState('pendentes');
  const [limite, setLimite] = useState('');
  const [loading, setLoading] = useState(true);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [agenteMeta, setAgenteMeta] = useState(null);
  const [agenteExeMeta, setAgenteExeMeta] = useState(null);
  const [exeDisponivel, setExeDisponivel] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const data = await nfpEnvioSefazStatus();
      setStatus(data);
    } catch (error) {
      setStatus(null);
      setErro(erroApiNfp(error, 'Não foi possível carregar o status do Envio SEFAZ.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (podeVer) carregar();
  }, [carregar, podeVer]);

  useEffect(() => {
    if (!podeVer) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const [metaZip, metaExe, headExe] = await Promise.all([
          fetch(AGENTE_META_URL, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(AGENTE_EXE_META_URL, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          fetch(AGENTE_EXE_URL, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok).catch(() => false),
        ]);
        if (cancelado) return;
        if (metaZip) setAgenteMeta(metaZip);
        if (metaExe) setAgenteExeMeta(metaExe);
        setExeDisponivel(Boolean(headExe || metaExe));
      } catch {
        if (!cancelado) {
          setAgenteMeta(null);
          setAgenteExeMeta(null);
          setExeDisponivel(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [podeVer]);

  useEffect(() => {
    if (!podeVer) return undefined;
    const jobStatus = status?.job?.status;
    if (jobStatus !== 'running') return undefined;
    const id = setInterval(() => {
      carregar();
    }, 2500);
    return () => clearInterval(id);
  }, [carregar, podeVer, status?.job?.status]);

  const abrirChrome = async () => {
    if (!podeOperar) return;
    setTrabalhando(true);
    setErro('');
    setSucesso('');
    try {
      const data = await nfpEnvioSefazAbrirChrome();
      setSucesso(data?.mensagem || 'Chrome aberto.');
      await carregar();
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao abrir o Chrome / Fazenda.'));
    } finally {
      setTrabalhando(false);
    }
  };

  const enviarFila = async () => {
    if (!podeOperar) return;
    setTrabalhando(true);
    setErro('');
    setSucesso('');
    try {
      const limiteN = limite.trim() === '' ? null : Number(limite);
      if (limiteN !== null && (!Number.isFinite(limiteN) || limiteN < 1)) {
        setErro('Informe um limite válido (número ≥ 1) ou deixe em branco para todas.');
        setTrabalhando(false);
        return;
      }
      const data = await nfpEnvioSefazEnviarFila({
        fonte,
        limite: limiteN,
      });
      setSucesso(data?.mensagem || 'Envio iniciado.');
      await carregar();
    } catch (error) {
      setErro(erroApiNfp(error, 'Falha ao iniciar o envio da fila.'));
    } finally {
      setTrabalhando(false);
    }
  };

  const pararFila = async () => {
    if (!podeOperar) return;
    setTrabalhando(true);
    setErro('');
    setSucesso('');
    try {
      const data = await nfpEnvioSefazParar();
      setSucesso(data?.mensagem || 'Parada solicitada.');
      await carregar();
    } catch (error) {
      setErro(erroApiNfp(error, 'Não foi possível parar a rotina.'));
    } finally {
      setTrabalhando(false);
    }
  };

  if (!podeVer) {
    return (
      <AppShell>
        <Sidebar />
        <MainShell>
          <PageHeader
            eyebrow="NFP – Créditos"
            title="Envio SEFAZ"
            subtitle="Sem permissão para esta tela."
            icon={<Send className="h-5 w-5" />}
            backTo="/nfp"
            backLabel="Voltar ao dashboard"
          />
        </MainShell>
      </AppShell>
    );
  }

  const cdpOk = Boolean(status?.cdp?.ok);
  const job = status?.job || {};
  const roboOk = Boolean(status?.robo_local_habilitado);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Créditos"
          title="Envio SEFAZ"
          subtitle="No CareCore online, baixe o agente em cada PC da Sede. O Chrome e o login ficam locais; a fila/reserva vem da API."
          icon={<Send className="h-5 w-5" />}
          backTo="/nfp"
          backLabel="Voltar ao dashboard"
          actions={(
            <PremiumButton type="button" variant="secondary" disabled={loading} onClick={carregar}>
              Atualizar status
            </PremiumButton>
          )}
        />

        {(somenteConsultaGlobal || !podeOperar) && (
          <BannerSomenteLeituraGlobal modulo="o Envio SEFAZ (abrir site e rodar a fila)" />
        )}

        <ScrollArea>
          {erro && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
          )}
          {sucesso && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {sucesso}
            </div>
          )}

          <section className="mb-4 rounded-3xl border border-sky-100 bg-sky-50/70 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800">
              Instalação do agente (cada PC da Sede)
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              No ambiente online o Chrome não roda no servidor. Instale o agente em
              {' '}
              <strong>cada máquina</strong>
              {' '}
              que for enviar cupons — elas são independentes e compartilham a mesma fila do CareCore.
            </p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
              {((exeDisponivel ? agenteExeMeta?.instrucoes : null) || agenteMeta?.instrucoes || [
                'Baixe CareCore-Agente-NFP.exe. Se o Windows avisar que pode não ser seguro: OK → Propriedades → Desbloquear, ou Executar mesmo assim.',
                'Execute o .exe. Não precisa instalar Python — o pacote já traz o Python do agente. É preciso ter Google Chrome.',
                'Ao terminar, o painel abre sozinho. Faça login CareCore para sincronizar a fila online.',
                'No painel: Abrir site Fazenda → login/CAPTCHA → Enviar fila.',
                'Nas próximas vezes use o atalho na Área de Trabalho ou rode o .exe de novo.',
              ]).map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
            <p className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              Fluxo:
              {' '}
              <strong>Executar o .exe</strong>
              {' '}
              →
              {' '}
              <strong>Login CareCore no painel</strong>
              {' '}
              (sincroniza online) →
              {' '}
              <strong>Abrir site Fazenda</strong>
              {' '}
              →
              {' '}
              <strong>Enviar</strong>
              .
              O arquivo ainda não é assinado digitalmente — o alerta do Windows é esperado.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {exeDisponivel ? (
                <a
                  href={AGENTE_EXE_URL}
                  download="CareCore-Agente-NFP.exe"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                  Baixar agente NFP (.exe)
                </a>
              ) : null}
              <a
                href={AGENTE_ZIP_URL}
                download="agente-nfp-robo.zip"
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  exeDisponivel
                    ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                <Download className="h-4 w-4" />
                {exeDisponivel ? 'Baixar ZIP (alternativa)' : 'Baixar agente NFP (.zip)'}
              </a>
              <p className="text-[11px] text-slate-500">
                App
                {' '}
                v
                {(exeDisponivel ? agenteExeMeta?.versao_app : null) || agenteMeta?.versao_app || CARECORE_VERSAO}
                {(exeDisponivel ? agenteExeMeta?.gerado_em : agenteMeta?.gerado_em)
                  ? ` · pacote ${(exeDisponivel ? agenteExeMeta?.gerado_em : agenteMeta?.gerado_em)}`
                  : ''}
                {(exeDisponivel ? agenteExeMeta?.tamanho_bytes : agenteMeta?.tamanho_bytes)
                  ? ` · ${(((exeDisponivel ? agenteExeMeta?.tamanho_bytes : agenteMeta?.tamanho_bytes) || 0) / 1024 / (exeDisponivel ? 1024 : 1)).toFixed(exeDisponivel ? 1 : 0)} ${exeDisponivel ? 'MB' : 'KB'}`
                  : ''}
              </p>
            </div>
            {!roboOk && (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Esta sessão está no CareCore
                {' '}
                <strong>online</strong>
                : os botões Abrir site / Rodar fila abaixo ficam desabilitados de propósito.
                No PC da Sede baixe e execute o <strong>CareCore-Agente-NFP.exe</strong>
                {' '}
                (ou o ZIP) e use o painel local no navegador.
              </p>
            )}
          </section>

          {loading && !status ? (
            <p className="text-sm text-slate-500">Carregando status...</p>
          ) : (
            <>
              <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                <CardStatus
                  label="Robô nesta API"
                  value={roboOk ? 'Disponível (local)' : 'Indisponível (online/servidor)'}
                  ok={roboOk}
                />
                <CardStatus
                  label="Chrome / CDP"
                  value={cdpOk ? (status?.cdp?.browser || 'Ativo') : 'Não conectado'}
                  ok={cdpOk}
                />
                <CardStatus
                  label="Pendentes"
                  value={String(status?.pendentes_total ?? 0)}
                  ok={(status?.pendentes_total || 0) === 0}
                />
                <CardStatus
                  label="Reservados (em máquina)"
                  value={String(status?.reservados_total ?? 0)}
                  ok={(status?.reservados_total || 0) === 0}
                />
                <CardStatus
                  label="Executados (enviados)"
                  value={String(status?.enviados_total ?? 0)}
                  ok={(status?.enviados_total || 0) > 0}
                />
                <CardStatus
                  label="Com erro"
                  value={String(status?.erros_total ?? 0)}
                  ok={(status?.erros_total || 0) === 0}
                />
                <CardStatus
                  label="Total no CareCore"
                  value={String(status?.cupons_total ?? 0)}
                  ok={(status?.cupons_total || 0) > 0}
                />
              </section>

              <section className="mb-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800">1. Abrir site e fazer login</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Abre o Chrome do robô em {status?.url_nfp || 'nfp.fazenda.sp.gov.br'}.
                  Faça login/CAPTCHA até a tela <strong>Bem-vindo</strong> (início).
                  Não precisa abrir Doação nem escolher a AEB — isso é a rotina inicial do robô.
                </p>
                <div className="mt-4">
                  <PremiumButton
                    type="button"
                    disabled={!podeOperar || trabalhando || !roboOk}
                    onClick={abrirChrome}
                  >
                    {trabalhando ? 'Abrindo...' : 'Abrir site Fazenda'}
                  </PremiumButton>
                </div>
              </section>

              <section className="mb-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800">2. Rodar rotina / enviar fila</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Ao iniciar, o robô vai sozinho em Entidades → Doação → CNPJ AEB.
                  Reserva sempre em <strong>lotes de 100</strong> (ou o que sobrar), liberando o restante para outras máquinas.
                  Limite informado = teto da sessão; em branco = continuo até acabar ou Parar.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <label className="text-sm font-semibold text-slate-700">
                    Fonte
                    <select
                      value={fonte}
                      disabled={!podeOperar || job.status === 'running'}
                      onChange={(e) => setFonte(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                    >
                      <option value="pendentes">Pendentes do CareCore</option>
                      <option value="planilha">Planilha (Downloads)</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                    Limite da sessão (opcional)
                    <input
                      type="number"
                      min="1"
                      value={limite}
                      disabled={!podeOperar || job.status === 'running'}
                      onChange={(e) => setLimite(e.target.value)}
                      className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                      placeholder="vazio = continuo · ex.: 200, 500, 1000"
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[100, 200, 300, 500, 1000].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={!podeOperar || job.status === 'running'}
                      onClick={() => setLimite(String(n))}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!podeOperar || job.status === 'running'}
                    onClick={() => setLimite('')}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    Continuo
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <PremiumButton
                    type="button"
                    disabled={!podeOperar || trabalhando || !roboOk || job.status === 'running'}
                    onClick={enviarFila}
                  >
                    {job.status === 'running' ? 'Enviando...' : 'Rodar rotina / enviar fila'}
                  </PremiumButton>
                  <PremiumButton
                    type="button"
                    variant="secondary"
                    disabled={!podeOperar || trabalhando || job.status !== 'running'}
                    onClick={pararFila}
                  >
                    {job.cancel_solicitado ? 'Parando...' : 'Parar rotina'}
                  </PremiumButton>
                </div>
                {status?.planilha_padrao && (
                  <p className="mt-3 text-[11px] text-slate-500">Planilha: {status.planilha_padrao}</p>
                )}
              </section>

              <section className="mb-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800">Última execução</h3>
                <p className="mt-2 text-sm text-slate-700">
                  Status: <strong>{rotuloStatusJob(job.status)}</strong>
                  {job.fonte ? ` · fonte ${job.fonte}` : ''}
                </p>
                {job.mensagem && <p className="mt-1 text-sm text-slate-600">{job.mensagem}</p>}
                {job.resumo && Object.keys(job.resumo).length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <MiniResumo label="Processados" value={job.resumo.total ?? '—'} />
                    <MiniResumo
                      label="Ok (novo + já existia)"
                      value={job.resumo.ok_operacional ?? '—'}
                      destaque="ok"
                    />
                    <MiniResumo
                      label="Já existia na SEFAZ"
                      value={job.resumo.ja_existe ?? '—'}
                    />
                    <MiniResumo
                      label="Erro"
                      value={job.resumo.erro ?? '—'}
                      destaque={(job.resumo.erro || 0) > 0 ? 'erro' : undefined}
                    />
                    <MiniResumo
                      label="Atualizados no CareCore"
                      value={job.resumo.cupons_atualizados ?? '—'}
                    />
                    {job.resumo.parado_pelo_usuario ? (
                      <MiniResumo label="Parada" value="Sim (usuário)" destaque="aviso" />
                    ) : null}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-slate-500">
                  A tabela abaixo é o log da última corrida (não sobrescreve os cards de totais do banco).
                  Clique em &quot;Atualizar status&quot; para ver pendentes/enviados atuais.
                </p>
                {Array.isArray(job.itens) && job.itens.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-2 py-1">Chave</th>
                          <th className="px-2 py-1">Resultado</th>
                          <th className="px-2 py-1">No CareCore</th>
                          <th className="px-2 py-1">Mensagem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.itens.slice(0, 30).map((item) => (
                          <tr key={`${item.chave}-${item.tipo}`} className="border-t border-slate-100">
                            <td className="px-2 py-1 font-mono">{item.chave}</td>
                            <td className="px-2 py-1">{rotuloTipoItem(item.tipo)}</td>
                            <td className="px-2 py-1">{rotuloStatusCarecore(item.status_carecore)}</td>
                            <td className="px-2 py-1">{item.mensagem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {(status?.pendentes || []).length > 0 && (
                <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                  <h3 className="mb-2 text-sm font-bold text-slate-800">
                    Pendentes (amostra: {status.pendentes.length} de {status?.pendentes_total ?? 0})
                  </h3>
                  <p className="mb-3 text-xs text-slate-500">
                    A lista abaixo é só prévia. O total real está nos cards acima; a rotina usa todas as pendentes (ou o limite informado).
                  </p>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {status.pendentes.map((c) => {
                      const chave = c.chave || '';
                      const curta = chave.length >= 44
                        ? `${chave.slice(0, 8)}…${chave.slice(-8)}`
                        : (chave || '—');
                      return (
                        <li key={c.id} className="min-w-0 break-words font-mono" title={chave || undefined}>
                          {curta} · {c.captador || '—'}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          )}
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}

function CardStatus({ label, value, ok }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${ok ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-amber-50'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function MiniResumo({ label, value, destaque }) {
  const tom = destaque === 'ok'
    ? 'border-emerald-100 bg-emerald-50'
    : destaque === 'erro'
      ? 'border-red-100 bg-red-50'
      : destaque === 'aviso'
        ? 'border-amber-100 bg-amber-50'
        : 'border-slate-100 bg-slate-50';
  return (
    <div className={`rounded-xl border px-3 py-2 ${tom}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function rotuloStatusJob(status) {
  const mapa = {
    idle: 'Aguardando',
    running: 'Em andamento',
    ok: 'Concluída',
    erro: 'Com falha',
    cancelado: 'Interrompida',
  };
  return mapa[status] || status || 'Aguardando';
}

function rotuloTipoItem(tipo) {
  const mapa = {
    sucesso: 'Sucesso',
    ja_existe: 'Já existia',
    erro: 'Erro',
    sessao_caiu: 'Sessão caiu',
    inconclusivo: 'Inconclusivo (na hora)',
  };
  return mapa[tipo] || tipo || '—';
}

function rotuloStatusCarecore(status) {
  const mapa = {
    enviado: 'Enviado',
    pendente: 'Pendente',
    erro: 'Erro',
  };
  return mapa[status] || status || '—';
}
