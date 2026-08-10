import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, QrCode } from 'lucide-react';

import Sidebar from './Sidebar';
import BannerSomenteLeituraGlobal from './components/BannerSomenteLeituraGlobal';
import { CampoSelect } from './components/UsuariosCampos';
import { AppShell, MainShell, PageHeader, ScrollArea } from './components/PremiumUI';
import { useLeitorUsbGlobal } from './hooks/useLeitorUsbGlobal';
import {
  nfpAcesso,
  nfpGarantirAgentesPadrao,
  nfpListarAgentes,
  nfpListarCupons,
  nfpRegistrarLeituraCupom,
} from './services/nfpService';
import { erroApiNfp, opcoesAgentesCaptacao } from './utils/nfpCadastroUtils';
import {
  deveIgnorarCupomNfpJaTratado,
  deveIgnorarLeituraCodigoRepetida,
  extrairChaveNfpDeLeitura,
  registrarCupomNfpTratado,
} from './utils/leituraCodigoUtils';
import { decodificarPayloadJwt } from './utils/jwtUtils';
import { usuarioEhAdmProducao, usuarioSomenteLeituraNfp } from './utils/rbacUtils';

function chaveCurta(chave) {
  if (!chave || chave.length < 44) return chave || '—';
  return `${chave.slice(0, 8)}…${chave.slice(-8)}`;
}

function rotuloStatusCupom(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'checando') return 'Checando SEFAZ';
  if (s === 'reservado') return 'Reservado';
  if (s === 'pendente') return 'Pendente (fila)';
  if (s === 'rejeitado_cpf') return 'Rejeitado CPF';
  if (s === 'enviado') return 'Enviado';
  if (s === 'erro') return 'Erro';
  return status || '—';
}

function classeBadgeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'checando') return 'bg-amber-100 text-amber-800';
  if (s === 'reservado') return 'bg-violet-100 text-violet-800';
  if (s === 'pendente') return 'bg-sky-100 text-sky-800';
  if (s === 'rejeitado_cpf') return 'bg-rose-100 text-rose-800';
  if (s === 'enviado') return 'bg-emerald-100 text-emerald-800';
  if (s === 'erro') return 'bg-orange-100 text-orange-900';
  return 'bg-slate-100 text-slate-600';
}

function mensagemFlashLeitura(cupom, checagem) {
  const curta = chaveCurta(cupom?.chave);
  if (checagem === 'imediata_cpf' || cupom?.status === 'rejeitado_cpf') {
    return `Cupom com CPF — fora da fila · ${curta}`;
  }
  if (cupom?.status === 'checando' || checagem === 'agendada') {
    return `Lido · validando SEFAZ em segundo plano · ${curta}`;
  }
  return `Cupom lido · ${curta}`;
}

const PAGE_SIZE = 50;

export default function NfpLeituraCupons() {
  const sessao = useMemo(() => {
    try {
      const token = localStorage.getItem('@CareCore:token');
      return token ? decodificarPayloadJwt(token) : null;
    } catch {
      return null;
    }
  }, []);
  const somenteLeitura = useMemo(() => usuarioSomenteLeituraNfp(sessao), [sessao]);
  const ehAdmProducao = useMemo(() => usuarioEhAdmProducao(sessao), [sessao]);
  const [captador, setCaptador] = useState('SEDE AEB');
  const [opcoesCaptador, setOpcoesCaptador] = useState([]);
  const [vinculoFixo, setVinculoFixo] = useState('');
  const [forcarVinculo, setForcarVinculo] = useState(ehAdmProducao);
  const [itens, setItens] = useState([]);
  const [totalLista, setTotalLista] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [loadingLista, setLoadingLista] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [cameraAtiva, setCameraAtiva] = useState(!somenteLeitura);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');
  const [sucessoFlash, setSucessoFlash] = useState('');
  const [ultimoIdLido, setUltimoIdLido] = useState('');
  const [chaveManual, setChaveManual] = useState('');
  const emVooRef = useRef(new Set());
  const captadorRef = useRef(captador);
  const paginaRef = useRef(1);
  const filtroStatusRef = useRef('');
  const cameraRootRef = useRef(null);
  const leitorRef = useRef(null);
  const processarLeituraRef = useRef(null);
  const ultimaLeituraRef = useRef({ codigo: '', horario: 0 });
  const chavesTratadasRef = useRef(new Set());
  const listaTopoRef = useRef(null);

  useEffect(() => {
    captadorRef.current = captador;
  }, [captador]);
  useEffect(() => {
    paginaRef.current = pagina;
  }, [pagina]);
  useEffect(() => {
    filtroStatusRef.current = filtroStatus;
  }, [filtroStatus]);

  const carregarLista = useCallback(async ({
    silencioso = false,
    paginaAlvo = null,
    statusAlvo = null,
  } = {}) => {
    if (!silencioso) setLoadingLista(true);
    const paginaUsar = paginaAlvo ?? paginaRef.current;
    const statusUsar = statusAlvo !== null ? statusAlvo : filtroStatusRef.current;
    try {
      const data = await nfpListarCupons({
        limite: PAGE_SIZE,
        offset: (paginaUsar - 1) * PAGE_SIZE,
        status: statusUsar || undefined,
      });
      setItens(Array.isArray(data?.itens) ? data.itens : []);
      setTotalLista(Number(data?.paginacao?.total ?? data?.total ?? 0));
      if (paginaAlvo != null) setPagina(paginaAlvo);
    } catch (error) {
      if (!silencioso) {
        setErro(erroApiNfp(error, 'Não foi possível carregar a lista de cupons.'));
      }
    } finally {
      if (!silencioso) setLoadingLista(false);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const acesso = await nfpAcesso();
        const vinculo = (acesso?.nfp_captador_vinculo || '').trim();
        const admProd = Boolean(acesso?.somente_leitura_cupons) || ehAdmProducao;
        if (!cancelado) setForcarVinculo(admProd);
        if (!cancelado && vinculo) {
          setVinculoFixo(vinculo);
          setCaptador(vinculo);
        }
        if (!somenteLeitura && !admProd) {
          await nfpGarantirAgentesPadrao();
          const agentes = await nfpListarAgentes({ limite: 300, ativo: true });
          const lista = Array.isArray(agentes) ? agentes : [];
          if (!cancelado) {
            const ops = opcoesAgentesCaptacao(lista);
            setOpcoesCaptador(ops);
            if (!vinculo) {
              if (ops.some((o) => o.value === 'SEDE AEB')) {
                setCaptador('SEDE AEB');
              } else if (ops[0]?.value) {
                setCaptador(ops[0].value);
              }
            }
          }
        } else if (!cancelado && admProd && !vinculo) {
          setErro('Seu usuário ainda não tem vínculo com projeto/Sede. Peça ao ADM Global, Global ou Manutenção para configurar.');
        }
      } catch (error) {
        if (!cancelado) {
          const status = error?.response?.status;
          if (!(somenteLeitura && status === 403)) {
            setErro(erroApiNfp(error, 'Não foi possível carregar o acesso NFP.'));
          }
        }
      }
      if (!cancelado) await carregarLista();
    })();
    return () => {
      cancelado = true;
    };
  }, [carregarLista, somenteLeitura, ehAdmProducao]);

  const temChecando = useMemo(
    () => itens.some((i) => String(i.status || '').toLowerCase() === 'checando'),
    [itens],
  );

  useEffect(() => {
    if (!temChecando) return undefined;
    const id = window.setInterval(() => {
      carregarLista({ silencioso: true });
    }, 2500);
    return () => window.clearInterval(id);
  }, [temChecando, carregarLista]);

  const processarLeitura = useCallback(async (codigoBruto) => {
    if (somenteLeitura) return;
    const bruto = String(codigoBruto || '').trim();
    if (!bruto) return;
    // Mesmo cuidado da rotina de conviventes: repeticao acidental fica silenciosa.
    if (deveIgnorarLeituraCodigoRepetida(ultimaLeituraRef, bruto)) return;
    if (deveIgnorarCupomNfpJaTratado(chavesTratadasRef, bruto)) return;

    const chaveLocal = extrairChaveNfpDeLeitura(bruto) || bruto;
    if (emVooRef.current.has(chaveLocal)) return;

    const destino = (captadorRef.current || '').trim();
    if (!destino) {
      setErro(
        forcarVinculo
          ? 'Seu usuário não tem vínculo NFP configurado.'
          : 'Selecione o captador / unidade antes de ler.',
      );
      return;
    }

    emVooRef.current.add(chaveLocal);
    setProcessando(emVooRef.current.size > 0);
    setErro('');
    setSucessoFlash('');
    // Nao limpa aviso aqui: evita piscar "já lido" a cada frame da webcam.

    try {
      const data = await nfpRegistrarLeituraCupom({
        codigo_ou_qr: bruto,
        captador: destino,
      });
      const cupom = data?.cupom;
      if (cupom) {
        registrarCupomNfpTratado(chavesTratadasRef, cupom.chave || bruto);
        setAviso('');
        setPagina(1);
        setItens((prev) => [cupom, ...prev.filter((i) => i.id !== cupom.id)].slice(0, PAGE_SIZE));
        setTotalLista((t) => t + 1);
        setUltimoIdLido(cupom.id);
        setSucessoFlash(mensagemFlashLeitura(cupom, data?.checagem));
        requestAnimationFrame(() => {
          listaTopoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    } catch (error) {
      const status = error?.response?.status;
      const msg = erroApiNfp(error, 'Leitura recusada.');
      const chaveResp = error?.response?.data?.detail?.cupom?.chave
        || error?.response?.data?.detail?.chave
        || extrairChaveNfpDeLeitura(bruto);
      if (status === 409) {
        registrarCupomNfpTratado(chavesTratadasRef, chaveResp || bruto);
        // Primeira vez: avisa claro. Repeticoes seguintes ficam silenciosas (Set).
        setAviso(msg || 'Este cupom já foi lido anteriormente — a leitura foi reconhecida.');
        setErro('');
      } else {
        setErro(msg);
      }
    } finally {
      emVooRef.current.delete(chaveLocal);
      setProcessando(emVooRef.current.size > 0);
    }
  }, [somenteLeitura, forcarVinculo]);

  useEffect(() => {
    processarLeituraRef.current = processarLeitura;
  }, [processarLeitura]);

  useLeitorUsbGlobal({
    ativo: !somenteLeitura,
    onCodigoLido: processarLeitura,
  });

  useEffect(() => {
    if (somenteLeitura || !cameraAtiva) {
      return undefined;
    }

    let ativo = true;
    let leitor = null;
    let iniciarPromise = Promise.resolve();

    const pararLeitor = async (instancia) => {
      if (!instancia) return;
      try {
        // stop() precisa terminar antes do clear(), senao o html5-qrcode lanca.
        if (typeof instancia.isScanning === 'boolean' ? instancia.isScanning : true) {
          await instancia.stop();
        }
      } catch {
        // ja parado / nao iniciado
      }
      try {
        instancia.clear();
      } catch {
        // ignore
      }
    };

    const iniciar = async () => {
      try {
        setAviso('');
        if (!navigator.mediaDevices?.getUserMedia) {
          setAviso('Câmera indisponível neste navegador. Use o leitor USB.');
          return;
        }
        await new Promise((r) => setTimeout(r, 120));
        if (!ativo || !cameraRootRef.current) return;

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (!ativo) return;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras?.length) {
          setAviso('Nenhuma câmera encontrada. Use o leitor USB.');
          return;
        }

        leitor = new Html5Qrcode(cameraRootRef.current.id);
        leitorRef.current = leitor;
        const cameraId = cameras.find((c) => /back|rear|traseira|environment/i.test(c.label))?.id
          || cameras[0].id;

        const configCamera = {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const lado = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72);
            const tamanho = Math.max(220, Math.min(lado, 320));
            return { width: tamanho, height: tamanho };
          },
          aspectRatio: 1.333,
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
          disableFlip: false,
        };

        await leitor.start(
          cameraId,
          configCamera,
          (decoded) => {
            processarLeituraRef.current?.(decoded);
          },
          () => {},
        );

        if (!ativo) {
          await pararLeitor(leitor);
          leitor = null;
          leitorRef.current = null;
        }
      } catch (err) {
        if (ativo) {
          const msg = String(err?.message || err || '');
          if (!/clear while scan/i.test(msg)) {
            setAviso(msg || 'Não foi possível iniciar a câmera. Use o leitor USB.');
          }
        }
      }
    };

    iniciarPromise = iniciar();

    return () => {
      ativo = false;
      const instancia = leitor;
      void (async () => {
        try {
          await iniciarPromise;
        } catch {
          // ignore
        }
        await pararLeitor(instancia || leitorRef.current);
        if (leitorRef.current === instancia) {
          leitorRef.current = null;
        }
      })();
    };
  }, [cameraAtiva, somenteLeitura]);

  useEffect(() => {
    if (!sucessoFlash) return undefined;
    const t = setTimeout(() => setSucessoFlash(''), 4500);
    return () => clearTimeout(t);
  }, [sucessoFlash]);

  useEffect(() => {
    if (!ultimoIdLido) return undefined;
    const t = setTimeout(() => setUltimoIdLido(''), 5000);
    return () => clearTimeout(t);
  }, [ultimoIdLido]);

  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <PageHeader
          eyebrow="NFP – Créditos"
          title="Leitura de Cupons"
          subtitle="Bipe o QR (câmera ou leitor). Validamos na SEFAZ e só entram cupons sem CPF do consumidor."
          icon={<QrCode className="h-5 w-5" />}
          backTo="/nfp"
        />
        <ScrollArea>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pb-10 pt-2">
            {somenteLeitura && (
              <BannerSomenteLeituraGlobal modulo="a leitura de cupons NFP" />
            )}
            {sucessoFlash ? (
              <div
                role="status"
                className="sticky top-0 z-20 flex items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-950 shadow-md"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div>
                  <p className="font-semibold">Leitura realizada com sucesso</p>
                  <p className="mt-0.5 font-normal text-emerald-900">{sucessoFlash}</p>
                </div>
              </div>
            ) : null}
            {erro ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {erro}
              </div>
            ) : null}
            {aviso ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {aviso}
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start">
              {!somenteLeitura && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {forcarVinculo ? (
                  <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                      Vínculo do usuário
                    </p>
                    <p className="mt-1 text-sm font-bold text-sky-950">
                      {vinculoFixo || captador || '— sem vínculo —'}
                    </p>
                    <p className="mt-1 text-[11px] text-sky-800">
                      As leituras deste login vão sempre para este projeto/Sede.
                    </p>
                  </div>
                ) : (
                  <CampoSelect
                    label="Captador / unidade"
                    value={captador}
                    onChange={setCaptador}
                    options={opcoesCaptador}
                    placeholder="Selecione…"
                  />
                )}
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={cameraAtiva}
                    onChange={(e) => setCameraAtiva(e.target.checked)}
                  />
                  Câmera ligada
                </label>
                <p className="mt-2 text-xs text-slate-500">
                  Leitor USB funciona com a tela aberta. Webcam de notebook: aproxime o cupom e mantenha firme.
                  Bips seguidos não esperam a SEFAZ — a validação roda em segundo plano.
                  {processando ? ' Gravando leitura…' : ''}
                  {temChecando ? ' Há cupom(ns) checando SEFAZ…' : ''}
                </p>
                {cameraAtiva ? (
                  <div
                    id="nfp-leitor-cupom-camera"
                    ref={cameraRootRef}
                    className="nfp-leitor-camera mt-3 mx-auto max-h-[340px] max-w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-slate-950"
                  />
                ) : null}
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-600">
                    Inserção manual (QR ilegível)
                    <input
                      type="text"
                      value={chaveManual}
                      onChange={(e) => setChaveManual(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const valor = chaveManual.trim();
                          if (valor) {
                            processarLeitura(valor).then(() => setChaveManual(''));
                          }
                        }
                      }}
                      placeholder="Chave 44 dígitos ou URL"
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-slate-400"
                      disabled={somenteLeitura}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={somenteLeitura || !chaveManual.trim()}
                    onClick={async () => {
                      const valor = chaveManual.trim();
                      if (!valor) return;
                      await processarLeitura(valor);
                      setChaveManual('');
                    }}
                    className="mt-2 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Inserir
                  </button>
                </div>
              </div>
              )}

              <div
                ref={listaTopoRef}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-800">
                    Lista ({totalLista.toLocaleString('pt-BR')})
                  </h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs text-slate-600">
                      Status
                      <select
                        value={filtroStatus}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFiltroStatus(v);
                          carregarLista({ paginaAlvo: 1, statusAlvo: v });
                        }}
                        className="ml-2 rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      >
                        <option value="">Todos</option>
                        <option value="checando">Checando</option>
                        <option value="pendente">Pendente</option>
                        <option value="reservado">Reservado</option>
                        <option value="enviado">Enviado</option>
                        <option value="erro">Erro</option>
                        <option value="rejeitado_cpf">Rejeitado CPF</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="text-sm text-slate-600 underline"
                      onClick={async () => {
                        try {
                          const data = await nfpListarCupons({
                            status: 'pendente',
                            limite: 200,
                            offset: 0,
                          });
                          const pendentes = Array.isArray(data?.itens) ? data.itens : [];
                          const blob = new Blob(
                            [JSON.stringify({
                              chaves: pendentes.map((p) => p.chave),
                              total_api: data?.paginacao?.total ?? pendentes.length,
                              exportados: pendentes.length,
                              observacao: 'Máximo 200 nesta exportação rápida da tela.',
                            }, null, 2)],
                            { type: 'application/json' },
                          );
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'nfp-cupons-pendentes.json';
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (error) {
                          setErro(erroApiNfp(error, 'Falha ao exportar pendentes.'));
                        }
                      }}
                    >
                      Exportar pendentes
                    </button>
                    <button
                      type="button"
                      className="text-sm text-slate-600 underline"
                      onClick={() => carregarLista()}
                    >
                      Atualizar
                    </button>
                  </div>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  <strong>checando</strong> = validando SEFAZ · <strong>pendente</strong> = na fila do robô ·{' '}
                  <strong>rejeitado_cpf</strong> = fora da fila. Lista paginada ({PAGE_SIZE}/página) para não travar com alto volume.
                </p>
                {loadingLista ? (
                  <p className="text-sm text-slate-500">Carregando…</p>
                ) : itens.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma leitura ainda.</p>
                ) : (
                  <>
                    <ul className="max-h-[min(70vh,560px)] divide-y divide-slate-100 overflow-y-auto">
                      {itens.map((item) => {
                        const destaque = item.id === ultimoIdLido;
                        return (
                          <li
                            key={item.id}
                            className={`flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm ${
                              destaque
                                ? 'rounded-xl bg-emerald-50 px-2 ring-2 ring-emerald-300'
                                : ''
                            }`}
                          >
                            <div>
                              {destaque ? (
                                <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                  Novo
                                </span>
                              ) : null}
                              <span className="font-mono text-slate-800">{item.chave}</span>
                              <span className="ml-2 text-slate-500">{item.captador}</span>
                            </div>
                            <div className="text-slate-500">
                              <span
                                className={`mr-2 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${classeBadgeStatus(item.status)}`}
                                title={item.mensagem || ''}
                              >
                                {rotuloStatusCupom(item.status)}
                              </span>
                              {item.lido_em || '—'}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    {(() => {
                      const totalPaginas = Math.max(1, Math.ceil(totalLista / PAGE_SIZE));
                      if (totalLista <= PAGE_SIZE) return null;
                      return (
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                          <span>
                            Página {pagina} de {totalPaginas}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={pagina <= 1 || loadingLista}
                              onClick={() => carregarLista({ paginaAlvo: pagina - 1 })}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                            >
                              Anterior
                            </button>
                            <button
                              type="button"
                              disabled={pagina >= totalPaginas || loadingLista}
                              onClick={() => carregarLista({ paginaAlvo: pagina + 1 })}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold disabled:opacity-40"
                            >
                              Próxima
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </MainShell>
      <style>{`
        .nfp-leitor-camera video,
        .nfp-leitor-camera canvas {
          max-height: 340px !important;
          width: 100% !important;
          object-fit: cover;
        }
        .nfp-leitor-camera #qr-shaded-region {
          border-width: 3px !important;
        }
      `}</style>
    </AppShell>
  );
}
