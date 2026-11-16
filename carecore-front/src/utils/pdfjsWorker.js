import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Worker local do Vite — evita CDN (unpkg) e prévia em branco em redes bloqueadas. */
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Pasta pública com jbig2.wasm etc. (copiada no build a partir de pdfjs-dist/wasm).
 * Sem isso, notas escaneadas em CCITTFax ficam em branco na prévia.
 */
export function pdfjsWasmUrl() {
  const base = import.meta.env.BASE_URL || '/';
  const raiz = base.endsWith('/') ? base : `${base}/`;
  return `${raiz}pdfjs/wasm/`;
}

/** Abre PDF com WASM para decodificar imagens CCITT/JBIG2/JPEG2000. */
export function abrirDocumentoPdf(data) {
  return pdfjsLib.getDocument({
    data,
    wasmUrl: pdfjsWasmUrl(),
  }).promise;
}

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
