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
    caixa: {
      page,
      left: 24,
      top: textoTop,
      width: Math.min(320, metricas.canvasW - 48),
      height: textoH,
    },
    carimbo: {
      page,
      left: 24,
      top: carimboTop,
      width: Math.min(250 * escala, metricas.canvasW - 48),
      height: carimboH,
    },
  };
}

/**
 * Posiciona o texto complementar e o carimbo da assinatura digital sobre o PDF da NF.
 * Todas as páginas ficam visíveis; as caixas começam na última.
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
  const carimboRef = useRef(null);
  const dragRef = useRef(null);
  const [total, setTotal] = useState(0);
  const [metricasList, setMetricasList] = useState([]);
  const [caixa, setCaixa] = useState({ page: 0, left: 40, top: 40, width: 280, height: 36 });
  const [carimbo, setCarimbo] = useState({ page: 0, left: 16, top: 16, width: 220, height: 72 });
  const [erro, setErro] = useState('');
  const [linhaUnica, setLinhaUnica] = useState(false);

  useEffect(() => {
    if (!aberto || !arquivo) {
      setTotal(0);
      setMetricasList([]);
      return undefined;
    }
    let cancelado = false;
    setTotal(0);
    setMetricasList([]);
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
        const ultima = lista.length - 1;
        const inicial = posicaoInicial(lista[ultima], ultima);
        setMetricasList(lista);
        setCaixa(inicial.caixa);
        setCarimbo(inicial.carimbo);
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
  }, [aberto, total]);

  useEffect(() => {
    if (!aberto || metricasList.length === 0) return undefined;
    const id = window.requestAnimationFrame(() => {
      carimboRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [aberto, metricasList]);

  useEffect(() => {
    if (!aberto) return undefined;
    const paginaSobPonteiro = (clientX, clientY) => {
      for (let indice = 0; indice < paginaRefs.current.length; indice += 1) {
        const el = paginaRefs.current[indice];
        if (!el || !metricasList[indice]) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          return { index: indice, localX: clientX - rect.left, localY: clientY - rect.top };
        }
      }
      return null;
    };
    const mover = (e) => {
      const drag = dragRef.current;
      if (!drag || metricasList.length === 0) return;
      const aplicar = drag.alvo === 'assinatura' ? setCarimbo : setCaixa;
      if (drag.tipo === 'resize') {
        const metricas = metricasList[drag.origem.page] || metricasList[0];
        const width = Math.max(80, drag.origem.width + (e.clientX - drag.startX));
        const height = linhaUnica && drag.alvo === 'texto'
          ? drag.origem.height
          : Math.max(18, drag.origem.height + (e.clientY - drag.startY));
        aplicar(limitarNaPagina({
          ...drag.origem,
          width,
          height,
        }, metricas));
        return;
      }
      const sob = paginaSobPonteiro(e.clientX, e.clientY);
      const page = sob ? sob.index : drag.origem.page;
      const metricas = metricasList[page];
      if (!metricas) return;
      const left = sob ? sob.localX - drag.offsetX : drag.origem.left + (e.clientX - drag.startX);
      const top = sob ? sob.localY - drag.offsetY : drag.origem.top + (e.clientY - drag.startY);
      aplicar(limitarNaPagina({ ...drag.origem, page, left, top }, metricas));
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

  const confirmar = () => {
    const metricasTexto = metricasList[caixa.page ?? 0];
    const metricasAssinatura = metricasList[carimbo.page ?? 0];
    if (!metricasTexto || !metricasAssinatura) return;
    const alturaTexto = linhaUnica ? Math.max(14, caixa.height * 0.7) : caixa.height;
    onConfirmar?.({
      texto: caixaPdf(caixa, metricasTexto, alturaTexto),
      assinatura: caixaPdf(carimbo, metricasAssinatura),
    });
  };

  const iniciarArrasto = (alvo, box, e) => {
    const el = paginaRefs.current[box.page ?? 0];
    const rect = el?.getBoundingClientRect();
    dragRef.current = {
      alvo,
      tipo: 'mover',
      startX: e.clientX,
      startY: e.clientY,
      origem: { ...box },
      offsetX: rect ? e.clientX - rect.left - box.left : 0,
      offsetY: rect ? e.clientY - rect.top - box.top : 0,
    };
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 px-4 pt-4">
          <p className="text-sm font-semibold text-slate-900">
            {modo === 'boleto'
              ? 'Posicione a assinatura digital no boleto'
              : 'Posicione o texto e a assinatura na nota fiscal'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {modo === 'boleto'
              ? 'O arquivo aparece inteiro. A caixa escura é o carimbo Assinado Digitalmente. Arraste para um espaço livre, inclusive em outra página.'
              : 'O arquivo aparece inteiro. A caixa azul é o texto complementar e a caixa escura é o carimbo Assinado Digitalmente. Elas começam na última página. Arraste cada uma para um espaço livre, inclusive em outra página, para o carimbo não cobrir informação já impressa.'}
          </p>
          {erro ? <p className="mt-2 text-sm text-rose-700">{erro}</p> : null}
          {modo !== 'boleto' ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={linhaUnica}
              onChange={(e) => {
                setLinhaUnica(e.target.checked);
                if (e.target.checked) setCaixa((atual) => ({ ...atual, height: 22 }));
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
            {Array.from({ length: total }, (_, indice) => (
              <div key={indice}>
                <p className="mb-1 text-xs font-semibold text-slate-500">
                  Página {indice + 1} de {total}
                </p>
                <div
                  ref={(el) => { paginaRefs.current[indice] = el; }}
                  className="relative inline-block"
                >
                  <canvas
                    ref={(el) => { canvasRefs.current[indice] = el; }}
                    className="border border-slate-200"
                  />
                  {modo !== 'boleto' && metricasList[indice] && caixa.page === indice ? (
                    <div
                      className="absolute cursor-move overflow-hidden border border-sky-600 bg-sky-100/70 px-1 text-[11px] leading-tight text-slate-900"
                      style={{ left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height }}
                      onPointerDown={(e) => iniciarArrasto('texto', caixa, e)}
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
                            startX: e.clientX,
                            startY: e.clientY,
                            origem: { ...caixa },
                          };
                        }}
                      />
                    </div>
                  ) : null}
                  {metricasList[indice] && carimbo.page === indice ? (
                    <div
                      ref={carimboRef}
                      className="absolute z-10 cursor-move overflow-hidden rounded border border-slate-800 bg-slate-50/90 px-1.5 py-1 text-[10px] leading-tight text-slate-900"
                      style={{ left: carimbo.left, top: carimbo.top, width: carimbo.width, height: carimbo.height }}
                      onPointerDown={(e) => iniciarArrasto('assinatura', carimbo, e)}
                    >
                      <span className="block font-bold">Assinado Digitalmente</span>
                      <span className="block">Nome do gestor</span>
                      <span className="block">Nome do projeto</span>
                      <span className="block">Cargo: Gestor</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
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
