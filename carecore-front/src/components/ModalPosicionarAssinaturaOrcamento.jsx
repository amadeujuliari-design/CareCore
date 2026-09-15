import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

import { PremiumButton } from './PremiumUI';
import {
  comprasBlobAnexo,
  comprasBlobAssinaturaDigital,
} from '../services/comprasService';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

async function renderPaginaPdf(pdf, pageNumber, canvas, maxWidth = 720) {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / base.width, 1.35);
  const viewport = page.getViewport({ scale });
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return {
    canvasW: viewport.width,
    canvasH: viewport.height,
    pageW: base.width,
    pageH: base.height,
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
 * Modal: posiciona/redimensiona a assinatura sobre o PDF do orçamento.
 * Confirma com coordenadas em pontos PDF (origem inferior esquerdo).
 */
export default function ModalPosicionarAssinaturaOrcamento({
  aberto,
  pedidoId,
  anexoOrcamentoId,
  fornecedorNome = '',
  onFechar,
  onConfirmar,
}) {
  const canvasRef = useRef(null);
  const areaRef = useRef(null);
  const pdfRef = useRef(null);
  const dragRef = useRef(null);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [metricas, setMetricas] = useState(null);
  const [assinaturaUrl, setAssinaturaUrl] = useState('');
  const [aspectAssinatura, setAspectAssinatura] = useState(2.5);
  const [caixa, setCaixa] = useState({ left: 40, top: 40, width: 220, height: 88 });
  const [salvando, setSalvando] = useState(false);

  const aplicarPaginaPadrao = useCallback((m, aspect) => {
    if (!m) return;
    const width = Math.min(m.canvasW * 0.42, 280);
    const height = Math.max(36, width / Math.max(aspect, 0.5));
    setCaixa({
      left: Math.max(8, (m.canvasW - width) / 2),
      top: Math.max(8, m.canvasH - height - 28),
      width,
      height,
    });
  }, []);

  useEffect(() => {
    if (!aberto || !pedidoId || !anexoOrcamentoId) return undefined;
    let cancelado = false;
    (async () => {
      setCarregando(true);
      setErro('');
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
        setTotalPaginas(pdf.numPages);
        const paginaInicial = pdf.numPages;
        setPagina(paginaInicial);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const m = await renderPaginaPdf(pdf, paginaInicial, canvas);
        if (cancelado) return;
        setMetricas(m);
        aplicarPaginaPadrao(m, sig.aspect);
      } catch (err) {
        if (!cancelado) setErro(err.message || 'Não foi possível carregar o PDF.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
      pdfRef.current = null;
    };
  }, [aberto, pedidoId, anexoOrcamentoId, aplicarPaginaPadrao]);

  useEffect(() => {
    if (!aberto || !pdfRef.current || carregando) return undefined;
    let cancelado = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const m = await renderPaginaPdf(pdfRef.current, pagina, canvas);
        if (cancelado) return;
        setMetricas(m);
        setCaixa((prev) => ({
          ...prev,
          left: Math.min(prev.left, Math.max(0, m.canvasW - prev.width)),
          top: Math.min(prev.top, Math.max(0, m.canvasH - prev.height)),
        }));
      } catch (err) {
        if (!cancelado) setErro(err.message || 'Falha ao renderizar a página.');
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [aberto, pagina, carregando]);

  const limitarCaixa = (next, m) => {
    if (!m) return next;
    const width = Math.max(48, Math.min(next.width, m.canvasW));
    const height = Math.max(28, Math.min(next.height, m.canvasH));
    return {
      width,
      height,
      left: Math.max(0, Math.min(next.left, m.canvasW - width)),
      top: Math.max(0, Math.min(next.top, m.canvasH - height)),
    };
  };

  const iniciarArrasto = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      tipo: 'mover',
      startX: e.clientX,
      startY: e.clientY,
      origem: { ...caixa },
    };
  };

  const iniciarRedimensionar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      tipo: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origem: { ...caixa },
    };
  };

  useEffect(() => {
    if (!aberto) return undefined;
    const onMove = (e) => {
      const drag = dragRef.current;
      if (!drag || !metricas) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (drag.tipo === 'mover') {
        setCaixa(limitarCaixa({
          ...drag.origem,
          left: drag.origem.left + dx,
          top: drag.origem.top + dy,
        }, metricas));
      } else {
        const width = drag.origem.width + dx;
        const height = width / Math.max(aspectAssinatura, 0.4);
        setCaixa(limitarCaixa({
          ...drag.origem,
          width,
          height,
        }, metricas));
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [aberto, metricas, aspectAssinatura]);

  const confirmar = async () => {
    if (!metricas || !onConfirmar) return;
    const scaleX = metricas.pageW / metricas.canvasW;
    const scaleY = metricas.pageH / metricas.canvasH;
    const width = caixa.width * scaleX;
    const height = caixa.height * scaleY;
    const x = caixa.left * scaleX;
    const y = metricas.pageH - ((caixa.top + caixa.height) * scaleY);
    setSalvando(true);
    setErro('');
    try {
      await onConfirmar({
        page: pagina - 1,
        x,
        y,
        width,
        height,
      });
    } catch (err) {
      setErro(err.response?.data?.detail || err.message || 'Falha ao assinar.');
      setSalvando(false);
      return;
    }
    setSalvando(false);
  };

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-3 md:p-6">
      <div className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-bold text-slate-900">Posicionar assinatura no orçamento</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {fornecedorNome ? `${fornecedorNome} · ` : ''}
            Arraste a assinatura e use o canto para redimensionar. Confirme só quando estiver no lugar certo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
          <PremiumButton
            variant="secondary"
            disabled={pagina <= 1 || carregando}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
          >
            Página anterior
          </PremiumButton>
          <span className="text-xs font-semibold text-slate-600">
            Página {pagina} de {totalPaginas}
          </span>
          <PremiumButton
            variant="secondary"
            disabled={pagina >= totalPaginas || carregando}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
          >
            Próxima página
          </PremiumButton>
          {metricas && (
            <PremiumButton
              variant="secondary"
              onClick={() => aplicarPaginaPadrao(metricas, aspectAssinatura)}
            >
              Rodapé (padrão)
            </PremiumButton>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">
          {erro && (
            <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</div>
          )}
          {carregando && (
            <p className="p-6 text-sm text-slate-600">Carregando orçamento do fornecedor…</p>
          )}
          <div
            ref={areaRef}
            className={`relative mx-auto w-fit max-w-full shadow-md ${carregando ? 'hidden' : ''}`}
          >
            <canvas ref={canvasRef} className="block max-w-full bg-white" />
            {!carregando && metricas && (
              <div
                role="presentation"
                className="absolute cursor-move touch-none border-2 border-emerald-600 bg-emerald-500/10 shadow"
                style={{
                  left: caixa.left,
                  top: caixa.top,
                  width: caixa.width,
                  height: caixa.height,
                }}
                onPointerDown={iniciarArrasto}
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
                  onPointerDown={iniciarRedimensionar}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3">
          <PremiumButton variant="secondary" disabled={salvando} onClick={onFechar}>
            Cancelar
          </PremiumButton>
          <PremiumButton disabled={carregando || salvando || !metricas} onClick={confirmar}>
            {salvando ? 'Assinando…' : 'Confirmar assinatura neste local'}
          </PremiumButton>
        </div>
      </div>
    </div>
  );
}
