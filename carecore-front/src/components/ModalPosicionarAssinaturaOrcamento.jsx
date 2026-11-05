import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

import { PremiumButton } from './PremiumUI';
import {
  comprasBlobAnexo,
  comprasBlobAssinaturaDigital,
} from '../services/comprasService';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function limitarNaPagina(box, metricas) {
  const width = Math.max(48, Math.min(box.width, metricas.canvasW));
  const height = Math.max(28, Math.min(box.height, metricas.canvasH));
  return {
    ...box,
    width,
    height,
    left: Math.max(0, Math.min(box.left, metricas.canvasW - width)),
    top: Math.max(0, Math.min(box.top, metricas.canvasH - height)),
  };
}

function caixaPdf(box, metricas) {
  const scaleX = metricas.pageW / metricas.canvasW;
  const scaleY = metricas.pageH / metricas.canvasH;
  return {
    page: box.page ?? 0,
    x: box.left * scaleX,
    y: metricas.pageH - ((box.top + box.height) * scaleY),
    width: box.width * scaleX,
    height: box.height * scaleY,
  };
}

function posicaoInicialRodape(metricas, page, aspect) {
  const width = Math.min(metricas.canvasW * 0.42, 280);
  const height = Math.max(36, width / Math.max(aspect, 0.5));
  return {
    page,
    left: Math.max(8, (metricas.canvasW - width) / 2),
    top: Math.max(8, metricas.canvasH - height - 28),
    width,
    height,
  };
}

async function primeiraPaginaComoDataUrl(blob) {
  const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return {
    dataUrl: canvas.toDataURL('image/png'),
    aspect: viewport.width / Math.max(viewport.height, 1),
  };
}

/**
 * Modal: mostra o orçamento inteiro e uma única assinatura arrastável entre páginas.
 * Confirma com coordenadas em pontos PDF (origem inferior esquerdo) só na página escolhida.
 */
export default function ModalPosicionarAssinaturaOrcamento({
  aberto,
  pedidoId,
  anexoOrcamentoId,
  fornecedorNome = '',
  onFechar,
  onConfirmar,
}) {
  const canvasRefs = useRef([]);
  const paginaRefs = useRef([]);
  const pdfRef = useRef(null);
  const dragRef = useRef(null);

  const [total, setTotal] = useState(0);
  const [metricasList, setMetricasList] = useState([]);
  const [assinaturaUrl, setAssinaturaUrl] = useState('');
  const [aspectAssinatura, setAspectAssinatura] = useState(2.5);
  const [caixa, setCaixa] = useState({ page: 0, left: 40, top: 40, width: 220, height: 88 });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !pedidoId || !anexoOrcamentoId) {
      setTotal(0);
      setMetricasList([]);
      return undefined;
    }
    let cancelado = false;
    setTotal(0);
    setMetricasList([]);
    setErro('');
    setSalvando(false);
    (async () => {
      try {
        const [orcBlob, sigBlob] = await Promise.all([
          comprasBlobAnexo(pedidoId, anexoOrcamentoId),
          comprasBlobAssinaturaDigital(),
        ]);
        if (cancelado) return;
        const sig = await primeiraPaginaComoDataUrl(sigBlob);
        if (cancelado) return;
        setAssinaturaUrl(sig.dataUrl);
        setAspectAssinatura(sig.aspect);
        const pdf = await pdfjsLib.getDocument({ data: await orcBlob.arrayBuffer() }).promise;
        if (cancelado) return;
        pdfRef.current = pdf;
        setTotal(pdf.numPages || 1);
      } catch (err) {
        if (!cancelado) setErro(err.message || 'Não foi possível carregar o PDF.');
      }
    })();
    return () => {
      cancelado = true;
      pdfRef.current = null;
    };
  }, [aberto, pedidoId, anexoOrcamentoId]);

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
          if (cancelado) return;
          lista.push({
            canvasW: viewport.width,
            canvasH: viewport.height,
            pageW: base.width,
            pageH: base.height,
          });
        }
        if (cancelado) return;
        setMetricasList(lista);
        const ultima = Math.max(0, lista.length - 1);
        setCaixa(posicaoInicialRodape(lista[ultima], ultima, aspectAssinatura));
        const el = paginaRefs.current[ultima];
        if (el) el.scrollIntoView({ block: 'nearest' });
      } catch (err) {
        if (!cancelado) setErro(err.message || 'Falha ao renderizar as páginas.');
      }
    })();
    return () => {
      cancelado = true;
      try {
        tarefa?.cancel?.();
      } catch {
        /* ignore */
      }
    };
  }, [aberto, total, aspectAssinatura]);

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
      if (drag.tipo === 'resize') {
        const metricas = metricasList[drag.origem.page] || metricasList[0];
        const width = Math.max(48, drag.origem.width + (e.clientX - drag.startX));
        const height = width / Math.max(aspectAssinatura, 0.4);
        setCaixa(limitarNaPagina({ ...drag.origem, width, height }, metricas));
        return;
      }
      const sob = paginaSobPonteiro(e.clientX, e.clientY);
      const page = sob ? sob.index : drag.origem.page;
      const metricas = metricasList[page];
      if (!metricas) return;
      const left = sob ? sob.localX - drag.offsetX : drag.origem.left + (e.clientX - drag.startX);
      const top = sob ? sob.localY - drag.offsetY : drag.origem.top + (e.clientY - drag.startY);
      setCaixa(limitarNaPagina({ ...drag.origem, page, left, top }, metricas));
    };
    const soltar = () => { dragRef.current = null; };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [aberto, metricasList, aspectAssinatura]);

  const iniciarArrasto = (box, e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = paginaRefs.current[box.page ?? 0];
    const rect = el?.getBoundingClientRect();
    dragRef.current = {
      tipo: 'mover',
      startX: e.clientX,
      startY: e.clientY,
      origem: { ...box },
      offsetX: rect ? e.clientX - rect.left - box.left : 0,
      offsetY: rect ? e.clientY - rect.top - box.top : 0,
    };
  };

  const confirmar = async () => {
    const metricas = metricasList[caixa.page ?? 0];
    if (!metricas || !onConfirmar) return;
    setSalvando(true);
    setErro('');
    try {
      await onConfirmar(caixaPdf(caixa, metricas));
    } catch (err) {
      const detail = err.response?.data?.detail;
      const mensagem = typeof detail === 'string'
        ? detail
        : (detail?.message || err.message || 'Falha ao assinar.');
      setErro(mensagem);
      setSalvando(false);
      return;
    }
    setSalvando(false);
  };

  if (!aberto) return null;

  const metricasAtual = metricasList[caixa.page ?? 0];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-3 md:p-6">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Posicionar assinatura no orçamento</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fornecedorNome ? `${fornecedorNome} · ` : ''}
            O arquivo aparece inteiro. Há uma única assinatura — comece na última página e arraste para o espaço livre na página que preferir. Ela sai só nessa página, sem repetir nas demais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
          <span className="text-xs font-semibold text-slate-600">
            Assinatura na página {(caixa.page ?? 0) + 1} de {Math.max(total, 1)}
          </span>
          {metricasAtual ? (
            <PremiumButton
              variant="secondary"
              onClick={() => setCaixa(posicaoInicialRodape(metricasAtual, caixa.page ?? 0, aspectAssinatura))}
            >
              Rodapé desta página
            </PremiumButton>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">
          {erro ? (
            <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</div>
          ) : null}
          {total === 0 && !erro ? (
            <p className="p-6 text-sm text-slate-600">Carregando orçamento do fornecedor…</p>
          ) : null}
          <div className="space-y-4">
            {Array.from({ length: total }, (_, indice) => (
              <div key={indice}>
                <p className="mb-1 text-xs font-semibold text-slate-500">
                  Página {indice + 1} de {total}
                </p>
                <div
                  ref={(el) => { paginaRefs.current[indice] = el; }}
                  className="relative mx-auto w-fit max-w-full shadow-md"
                >
                  <canvas
                    ref={(el) => { canvasRefs.current[indice] = el; }}
                    className="block max-w-full border border-slate-200 bg-white"
                  />
                  {metricasList[indice] && caixa.page === indice ? (
                    <div
                      role="presentation"
                      className="absolute z-10 cursor-move touch-none border-2 border-emerald-600 bg-emerald-500/10 shadow"
                      style={{
                        left: caixa.left,
                        top: caixa.top,
                        width: caixa.width,
                        height: caixa.height,
                      }}
                      onPointerDown={(e) => iniciarArrasto(caixa, e)}
                    >
                      {assinaturaUrl ? (
                        <img
                          src={assinaturaUrl}
                          alt="Assinatura"
                          draggable={false}
                          className="h-full w-full object-contain"
                          style={{ mixBlendMode: 'multiply' }}
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[10px] font-bold text-emerald-900">
                          Assinatura
                        </span>
                      )}
                      <button
                        type="button"
                        aria-label="Redimensionar assinatura"
                        className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-se-resize rounded-sm border border-white bg-emerald-700"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dragRef.current = {
                            tipo: 'resize',
                            startX: e.clientX,
                            startY: e.clientY,
                            origem: { ...caixa },
                          };
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <PremiumButton type="button" variant="secondary" disabled={salvando} onClick={onFechar}>
            Cancelar
          </PremiumButton>
          <PremiumButton
            type="button"
            disabled={salvando || metricasList.length === 0}
            onClick={confirmar}
          >
            {salvando ? 'Assinando…' : 'Confirmar assinatura neste local'}
          </PremiumButton>
        </div>
      </div>
    </div>
  );
}
