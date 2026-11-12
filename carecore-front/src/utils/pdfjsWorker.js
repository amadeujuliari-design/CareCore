import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Worker local do Vite — evita CDN (unpkg) e prévia em branco em redes bloqueadas. */
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export { pdfjsLib };

/** Espera os canvas das páginas montarem no DOM antes de renderizar. */
export async function esperarCanvasPaginas(canvasRefs, total, cancelado) {
  const qtd = Math.max(0, Number(total) || 0);
  if (qtd < 1) return false;
  for (let tentativa = 0; tentativa < 60; tentativa += 1) {
    if (cancelado?.()) return false;
    let prontos = true;
    for (let i = 0; i < qtd; i += 1) {
      if (!canvasRefs.current?.[i]) {
        prontos = false;
        break;
      }
    }
    if (prontos) return true;
    await new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }
  return false;
}
