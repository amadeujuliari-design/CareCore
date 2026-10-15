import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

import { PremiumButton } from './PremiumUI';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function caixaPdf(box, metricas, altura) {
  const scaleX = metricas.pageW / metricas.canvasW;
  const scaleY = metricas.pageH / metricas.canvasH;
  const height = altura ?? box.height;
  return {
    page: 0,
    x: box.left * scaleX,
    y: metricas.pageH - ((box.top + height) * scaleY),
    width: box.width * scaleX,
    height: height * scaleY,
  };
}

/**
 * Posiciona o texto complementar e o carimbo da assinatura digital sobre o PDF da NF.
 */
export default function ModalPosicionarTextoNf({
  aberto,
  arquivo,
  texto,
  onFechar,
  onConfirmar,
}) {
  const canvasRef = useRef(null);
  const carimboRef = useRef(null);
  const dragRef = useRef(null);
  const [metricas, setMetricas] = useState(null);
  const [caixa, setCaixa] = useState({ left: 40, top: 40, width: 280, height: 36 });
  const [carimbo, setCarimbo] = useState({ left: 16, top: 16, width: 220, height: 72 });
  const [erro, setErro] = useState('');
  const [linhaUnica, setLinhaUnica] = useState(false);

  useEffect(() => {
    if (!aberto || !arquivo) return undefined;
    let cancelado = false;
    (async () => {
      try {
        const bytes = await arquivo.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(720 / base.width, 1.35);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelado) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const m = {
          canvasW: viewport.width,
          canvasH: viewport.height,
          pageW: base.width,
          pageH: base.height,
        };
        setMetricas(m);
        const escala = m.canvasW / m.pageW;
        const textoTop = Math.max(12, m.canvasH - 64);
        const carimboH = Math.max(64, 68 * escala);
        const carimboTop = Math.max(12, textoTop - carimboH - 8);
        setCaixa({
          left: 24,
          top: textoTop,
          width: Math.min(320, m.canvasW - 48),
          height: 36,
        });
        setCarimbo({
          left: 24,
          top: carimboTop,
          width: Math.min(250 * escala, m.canvasW - 48),
          height: carimboH,
        });
        setErro('');
      } catch (err) {
        if (!cancelado) setErro(err.message || 'Não foi possível abrir o PDF.');
      }
    })();
    return () => { cancelado = true; };
  }, [aberto, arquivo]);

  useEffect(() => {
    if (!aberto || !metricas) return undefined;
    const id = window.requestAnimationFrame(() => {
      carimboRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [aberto, metricas]);

  useEffect(() => {
    if (!aberto) return undefined;
    const mover = (e) => {
      const drag = dragRef.current;
      if (!drag || !metricas) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const aplicar = drag.alvo === 'assinatura' ? setCarimbo : setCaixa;
      if (drag.tipo === 'mover') {
        aplicar({
          ...drag.origem,
          left: Math.max(0, Math.min(drag.origem.left + dx, metricas.canvasW - drag.origem.width)),
          top: Math.max(0, Math.min(drag.origem.top + dy, metricas.canvasH - drag.origem.height)),
        });
      } else {
        const width = Math.max(80, drag.origem.width + dx);
        const height = linhaUnica ? drag.origem.height : Math.max(18, drag.origem.height + dy);
        aplicar({
          ...drag.origem,
          width: Math.min(width, metricas.canvasW - drag.origem.left),
          height: Math.min(height, metricas.canvasH - drag.origem.top),
        });
      }
    };
    const soltar = () => { dragRef.current = null; };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
    };
  }, [aberto, metricas, linhaUnica]);

  if (!aberto) return null;

  const confirmar = () => {
    if (!metricas) return;
    const alturaTexto = linhaUnica ? Math.max(14, caixa.height * 0.7) : caixa.height;
    onConfirmar?.({
      texto: caixaPdf(caixa, metricas, alturaTexto),
      assinatura: caixaPdf(carimbo, metricas),
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-4 shadow-xl">
        <p className="text-sm font-semibold text-slate-900">Posicione o texto e a assinatura na nota fiscal</p>
        <p className="mt-1 text-xs text-slate-500">
          A caixa azul é o texto complementar. A caixa escura é o carimbo Assinado Digitalmente.
          Arraste cada uma para um espaço livre, para o carimbo não cobrir informação já impressa.
        </p>
        {erro ? <p className="mt-2 text-sm text-rose-700">{erro}</p> : null}
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
        <div className="relative mt-3 inline-block">
          <canvas ref={canvasRef} className="max-w-full border border-slate-200" />
          {metricas ? (
            <div
              className="absolute cursor-move overflow-hidden border border-sky-600 bg-sky-100/70 px-1 text-[11px] leading-tight text-slate-900"
              style={{ left: caixa.left, top: caixa.top, width: caixa.width, height: caixa.height }}
              onPointerDown={(e) => {
                dragRef.current = {
                  alvo: 'texto', tipo: 'mover', startX: e.clientX, startY: e.clientY, origem: { ...caixa },
                };
              }}
            >
              {texto}
              <button
                type="button"
                aria-label="Redimensionar texto"
                className="absolute bottom-0 right-0 h-3 w-3 cursor-se-resize bg-sky-700"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragRef.current = {
                    alvo: 'texto', tipo: 'resize', startX: e.clientX, startY: e.clientY, origem: { ...caixa },
                  };
                }}
              />
            </div>
          ) : null}
          {metricas ? (
            <div
              ref={carimboRef}
              className="absolute z-10 cursor-move overflow-hidden rounded border border-slate-800 bg-slate-50/90 px-1.5 py-1 text-[10px] leading-tight text-slate-900"
              style={{ left: carimbo.left, top: carimbo.top, width: carimbo.width, height: carimbo.height }}
              onPointerDown={(e) => {
                dragRef.current = {
                  alvo: 'assinatura', tipo: 'mover', startX: e.clientX, startY: e.clientY, origem: { ...carimbo },
                };
              }}
            >
              <span className="block font-bold">Assinado Digitalmente</span>
              <span className="block">Nome do gestor</span>
              <span className="block">Nome do projeto</span>
              <span className="block">Cargo: Gestor</span>
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <PremiumButton type="button" variant="secondary" onClick={onFechar}>Cancelar</PremiumButton>
          <PremiumButton type="button" onClick={confirmar}>Confirmar posição</PremiumButton>
        </div>
      </div>
    </div>
  );
}
