import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

import { PremiumButton } from './PremiumUI';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function caixaPdf(box, metricas, altura) {
  const scaleX = metricas.pageW / metricas.canvasW;
  const scaleY = metricas.pageH / metricas.canvasH;
  const height = altura ?? box.height;
  return {
    page: box.page ?? 0,
    x: box.left * scaleX,
    y: metricas.pageH - ((box.top + height) * scaleY),
    width: box.width * scaleX,
    height: height * scaleY,
  };
}

function limitarNaPagina(box, metricas) {
  const width = Math.max(48, Math.min(box.width, metricas.canvasW));
  const height = Math.max(18, Math.min(box.height, metricas.canvasH));
  return {
    ...box,
    width,
    height,
    left: Math.max(0, Math.min(box.left, metricas.canvasW - width)),
    top: Math.max(0, Math.min(box.top, metricas.canvasH - height)),
  };
}

function posicaoInicial(metricas, page) {
  const escala = metricas.canvasW / metricas.pageW;
  const textoH = Math.max(52, 56 * escala);
  const textoTop = Math.max(12, metricas.canvasH - textoH - 12);
  const carimboH = Math.max(64, 68 * escala);
  const carimboTop = Math.max(12, textoTop - carimboH - 8);
  return {
    texto: {
      page,
      left: 24,
      top: textoTop,
      width: Math.min(320, metricas.canvasW - 48),
      height: textoH,
    },
    assinatura: {
      page,
      left: 24,
      top: carimboTop,
      width: Math.min(250 * escala, metricas.canvasW - 48),
      height: carimboH,
    },
  };
}

/**
 * Posiciona texto complementar e assinatura por página, de forma independente.
 * Em cada página dá para manter ou remover cada caixa; no total o documento
 * precisa ter ao menos uma assinatura. Texto complementar é obrigatório na NF
 * e opcional no boleto (quando houver texto preenchido).
 */
export default function ModalPosicionarTextoNf({
  aberto,
  arquivo,
  texto,
  projeto = '',
  modo = 'nota_fiscal',
  onFechar,
  onConfirmar,
}) {
  const canvasRefs = useRef([]);
  const paginaRefs = useRef([]);
  const pdfRef = useRef(null);
  const scrollAlvoRef = useRef(null);
  const dragRef = useRef(null);
  const [total, setTotal] = useState(0);
  const [metricasList, setMetricasList] = useState([]);
  /** @type {[Record<number, object|null>, Function]} */
  const [textos, setTextos] = useState({});
  /** @type {[Record<number, object|null>, Function]} */
  const [assinaturas, setAssinaturas] = useState({});
  const [erro, setErro] = useState('');
  const [linhaUnica, setLinhaUnica] = useState(false);
  const temTextoAdicional = Boolean(String(texto || '').trim());
  const usaCaixaTexto = modo !== 'boleto' || temTextoAdicional;

  useEffect(() => {
    if (!aberto || !arquivo) {
      setTotal(0);
      setMetricasList([]);
      setTextos({});
      setAssinaturas({});
      return undefined;
    }
    let cancelado = false;
    setTotal(0);
    setMetricasList([]);
    setTextos({});
    setAssinaturas({});
    setErro('');
    (async () => {
      try {
        const bytes = await arquivo.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        if (cancelado) return;
        pdfRef.current = pdf;
        setTotal(pdf.numPages || 1);
      } catch (err) {
        if (!cancelado) setErro(err.message || 'Não foi possível abrir o PDF.');
      }
    })();
    return () => {
      cancelado = true;
      pdfRef.current = null;
    };
  }, [aberto, arquivo]);

  useEffect(() => {
    if (!aberto || !pdfRef.current || total < 1) return undefined;
    let cancelado = false;
    let tarefa = null;
    (async () => {
      try {
        const lista = [];
        for (let indice = 0; indice < total; indice += 1) {
          const canvas = canvasRefs.current[indice];
          const pdf = pdfRef.current;
          if (!canvas || !pdf || cancelado) return;
          const page = await pdf.getPage(indice + 1);
          const base = page.getViewport({ scale: 1 });
          const scale = Math.min(720 / base.width, 1.35);
          const viewport = page.getViewport({ scale });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          tarefa = page.render({ canvasContext: canvas.getContext('2d'), viewport });
          await tarefa.promise;
          lista.push({
            canvasW: viewport.width,
            canvasH: viewport.height,
            pageW: base.width,
            pageH: base.height,
          });
        }
        if (cancelado || lista.length !== total) return;
        const iniTexto = {};
        const iniAssinatura = {};
        lista.forEach((metricas, indice) => {
          const inicial = posicaoInicial(metricas, indice);
          if (usaCaixaTexto) iniTexto[indice] = inicial.texto;
          iniAssinatura[indice] = inicial.assinatura;
        });
        setMetricasList(lista);
        setTextos(iniTexto);
        setAssinaturas(iniAssinatura);
        setErro('');
      } catch (err) {
        if (cancelado || err?.name === 'RenderingCancelledException') return;
        setErro(err.message || 'Não foi possível abrir o PDF.');
      }
    })();
    return () => {
      cancelado = true;
      tarefa?.cancel?.();
    };
  }, [aberto, total, modo, usaCaixaTexto]);

  useEffect(() => {
    if (!aberto || metricasList.length === 0) return undefined;
    const id = window.requestAnimationFrame(() => {
      scrollAlvoRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [aberto, metricasList]);

  useEffect(() => {
    if (!aberto) return undefined;
    const mover = (e) => {
      const drag = dragRef.current;
      if (!drag || metricasList.length === 0) return;
      const page = drag.page;
      const metricas = metricasList[page];
      if (!metricas) return;
      const aplicar = drag.alvo === 'assinatura' ? setAssinaturas : setTextos;
      if (drag.tipo === 'resize') {
        const width = Math.max(80, drag.origem.width + (e.clientX - drag.startX));
        const height = linhaUnica && drag.alvo === 'texto'
          ? drag.origem.height
          : Math.max(18, drag.origem.height + (e.clientY - drag.startY));
        const proximo = limitarNaPagina({
          ...drag.origem,
          page,
          width,
          height,
        }, metricas);
        aplicar((atual) => ({ ...atual, [page]: proximo }));
        return;
      }
      const left = drag.origem.left + (e.clientX - drag.startX);
      const top = drag.origem.top + (e.clientY - drag.startY);
      const proximo = limitarNaPagina({ ...drag.origem, page, left, top }, metricas);
      aplicar((atual) => ({ ...atual, [page]: proximo }));
    };
    const soltar = () => { dragRef.current = null; };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [aberto, metricasList, linhaUnica]);

  if (!aberto) return null;

  const listaTextos = Object.values(textos).filter(Boolean);
  const listaAssinaturas = Object.values(assinaturas).filter(Boolean);

  const confirmar = () => {
    if (listaAssinaturas.length < 1) {
      setErro('Mantenha a assinatura em pelo menos uma página.');
      return;
    }
    if (usaCaixaTexto && listaTextos.length < 1) {
      setErro(modo === 'boleto'
        ? 'Com informações adicionais preenchidas, posicione o texto em pelo menos uma página.'
        : 'O documento precisa de dados adicionais e assinatura em pelo menos uma página cada.');
      return;
    }
    const textosPdf = listaTextos.map((box) => {
      const metricas = metricasList[box.page ?? 0];
      const alturaTexto = linhaUnica ? Math.max(14, box.height * 0.7) : box.height;
      return caixaPdf(box, metricas, alturaTexto);
    });
    const assinaturasPdf = listaAssinaturas.map((box) => {
      const metricas = metricasList[box.page ?? 0];
      return caixaPdf(box, metricas);
    });
    onConfirmar?.({
      textos: textosPdf,
      assinaturas: assinaturasPdf,
      // Compatível com quem ainda lê um único carimbo.
      texto: textosPdf[0] || null,
      assinatura: assinaturasPdf[0] || null,
    });
  };

  const iniciarArrasto = (alvo, box, e) => {
    e.preventDefault();
    dragRef.current = {
      alvo,
      tipo: 'mover',
      page: box.page ?? 0,
      startX: e.clientX,
      startY: e.clientY,
      origem: { ...box },
    };
  };

  const incluirTexto = (indice) => {
    const metricas = metricasList[indice];
    if (!metricas) return;
    const inicial = posicaoInicial(metricas, indice);
    setTextos((atual) => ({ ...atual, [indice]: inicial.texto }));
    setErro('');
  };

  const incluirAssinatura = (indice) => {
    const metricas = metricasList[indice];
    if (!metricas) return;
    const inicial = posicaoInicial(metricas, indice);
    setAssinaturas((atual) => ({ ...atual, [indice]: inicial.assinatura }));
    setErro('');
  };

  const removerTexto = (indice) => {
    const restantes = listaTextos.filter((box) => (box.page ?? 0) !== indice);
    if (usaCaixaTexto && restantes.length < 1) {
      setErro('Não é possível remover os dados adicionais de todas as páginas.');
      return;
    }
    setTextos((atual) => ({ ...atual, [indice]: null }));
    setErro('');
  };

  const removerAssinatura = (indice) => {
    const restantes = listaAssinaturas.filter((box) => (box.page ?? 0) !== indice);
    if (restantes.length < 1) {
      setErro('Não é possível remover a assinatura de todas as páginas.');
      return;
    }
    setAssinaturas((atual) => ({ ...atual, [indice]: null }));
    setErro('');
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 px-4 pt-4">
          <p className="text-sm font-semibold text-slate-900">
            {modo === 'boleto'
              ? (usaCaixaTexto
                ? 'Posicione o texto e a assinatura no boleto'
                : 'Posicione a assinatura digital no boleto')
              : 'Posicione o texto e a assinatura na nota fiscal'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {modo === 'boleto'
              ? (usaCaixaTexto
                ? 'Cada página tem posição própria de dados adicionais (azul) e assinatura (escura). Arraste na página desejada. O boleto precisa manter assinatura em pelo menos uma página e o texto em pelo menos uma.'
                : 'Cada página tem a própria assinatura. Arraste na página desejada. Dá para remover de uma página, mas o boleto precisa ficar com assinatura em pelo menos uma. Se quiser texto no boleto, preencha as informações adicionais antes de escolher o PDF.')
              : 'Cada página tem posição própria de dados adicionais (azul) e assinatura (escura). Ajuste página a página. Pode remover de uma página, mas o documento precisa manter ao menos um texto e uma assinatura.'}
          </p>
          {erro ? <p className="mt-2 text-sm text-rose-700">{erro}</p> : null}
          {usaCaixaTexto ? (
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={linhaUnica}
                onChange={(e) => {
                  setLinhaUnica(e.target.checked);
                  if (e.target.checked) {
                    setTextos((atual) => {
                      const proximo = { ...atual };
                      Object.keys(proximo).forEach((chave) => {
                        if (proximo[chave]) proximo[chave] = { ...proximo[chave], height: 22 };
                      });
                      return proximo;
                    });
                  }
                }}
              />
              Uma linha só
            </label>
          ) : null}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-auto px-4 pb-2">
          {total === 0 && !erro ? (
            <p className="text-sm text-slate-500">Abrindo as páginas da nota…</p>
          ) : null}
          <div className="space-y-4">
            {Array.from({ length: total }, (_, indice) => {
              const caixaTexto = textos[indice] || null;
              const caixaAssinatura = assinaturas[indice] || null;
              const ultimaComAssinatura = listaAssinaturas.length
                ? Math.max(...listaAssinaturas.map((b) => b.page ?? 0))
                : total - 1;
              return (
                <div key={indice}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-slate-500">
                      Página {indice + 1} de {total}
                    </p>
                    {usaCaixaTexto ? (
                      caixaTexto ? (
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                          onClick={() => removerTexto(indice)}
                        >
                          Remover dados adicionais
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100"
                          onClick={() => incluirTexto(indice)}
                        >
                          Incluir dados adicionais
                        </button>
                      )
                    ) : null}
                    {caixaAssinatura ? (
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => removerAssinatura(indice)}
                      >
                        Remover assinatura
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                        onClick={() => incluirAssinatura(indice)}
                      >
                        Incluir assinatura
                      </button>
                    )}
                  </div>
                  <div
                    ref={(el) => { paginaRefs.current[indice] = el; }}
                    className="relative inline-block"
                  >
                    <canvas
                      ref={(el) => { canvasRefs.current[indice] = el; }}
                      className="border border-slate-200"
                    />
                    {usaCaixaTexto && metricasList[indice] && caixaTexto ? (
                      <div
                        className="absolute cursor-move overflow-hidden border border-sky-600 bg-sky-100/70 px-1 text-[11px] leading-tight text-slate-900"
                        style={{
                          left: caixaTexto.left,
                          top: caixaTexto.top,
                          width: caixaTexto.width,
                          height: caixaTexto.height,
                        }}
                        onPointerDown={(e) => iniciarArrasto('texto', caixaTexto, e)}
                      >
                        <span className="block whitespace-pre-wrap">
                          {String(projeto || '').trim() ? (
                            <span className="block text-[14px] font-bold leading-tight">{projeto}</span>
                          ) : null}
                          {String(texto || '').trim() ? (
                            <span className="block">{texto}</span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          aria-label="Redimensionar texto"
                          className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-sky-700"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            dragRef.current = {
                              alvo: 'texto',
                              tipo: 'resize',
                              page: indice,
                              startX: e.clientX,
                              startY: e.clientY,
                              origem: { ...caixaTexto },
                            };
                          }}
                        />
                      </div>
                    ) : null}
                    {metricasList[indice] && caixaAssinatura ? (
                      <div
                        ref={indice === ultimaComAssinatura ? scrollAlvoRef : undefined}
                        className="absolute z-10 cursor-move overflow-hidden rounded border border-slate-800 bg-slate-50/90 px-1.5 py-1 text-[10px] leading-tight text-slate-900"
                        style={{
                          left: caixaAssinatura.left,
                          top: caixaAssinatura.top,
                          width: caixaAssinatura.width,
                          height: caixaAssinatura.height,
                        }}
                        onPointerDown={(e) => iniciarArrasto('assinatura', caixaAssinatura, e)}
                      >
                        <span className="block font-bold">Assinado Digitalmente</span>
                        <span className="block">Nome do gestor</span>
                        <span className="block">Nome do projeto</span>
                        <span className="block">Cargo: Gestor</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <PremiumButton type="button" variant="secondary" onClick={onFechar}>Cancelar</PremiumButton>
          <PremiumButton type="button" onClick={confirmar} disabled={metricasList.length === 0}>
            Confirmar posição
          </PremiumButton>
        </div>
      </div>
    </div>
  );
}
