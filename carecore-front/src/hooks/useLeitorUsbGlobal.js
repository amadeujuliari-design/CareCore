import { useEffect, useRef } from 'react';

import { deveIgnorarLeituraCodigoRepetida } from '../utils/leituraCodigoUtils';

const INTERVALO_MAX_SCANNER_MS = 120;

/**
 * Captura leitor USB (teclado emulado) em qualquer lugar da tela.
 * Detecta sequência rápida de caracteres + Enter típica de pistola/código de barras.
 */
export function useLeitorUsbGlobal({ ativo = false, onCodigoLido }) {
  const bufferRef = useRef('');
  const ultimaTeclaRef = useRef(0);
  const onCodigoLidoRef = useRef(onCodigoLido);
  const ultimaLeituraRef = useRef({ codigo: '', horario: 0 });
  const sequenciaRapidaRef = useRef(false);

  useEffect(() => {
    onCodigoLidoRef.current = onCodigoLido;
  }, [onCodigoLido]);

  useEffect(() => {
    if (!ativo) return undefined;

    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const agora = Date.now();
      const intervalo = agora - ultimaTeclaRef.current;
      ultimaTeclaRef.current = agora;

      const tag = event.target?.tagName?.toLowerCase();
      const emCampoTexto =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        event.target?.isContentEditable;

      if (event.key === 'Enter') {
        const codigo = bufferRef.current.trim();
        const eraScanner = sequenciaRapidaRef.current || !emCampoTexto;
        bufferRef.current = '';
        sequenciaRapidaRef.current = false;

        if (!codigo || codigo.length < 2 || !eraScanner) return;
        if (deveIgnorarLeituraCodigoRepetida(ultimaLeituraRef, codigo)) return;

        event.preventDefault();
        event.stopPropagation();
        onCodigoLidoRef.current?.(codigo);
        return;
      }

      if (event.key?.length !== 1) return;

      if (intervalo > INTERVALO_MAX_SCANNER_MS) {
        bufferRef.current = '';
        sequenciaRapidaRef.current = false;
      }

      bufferRef.current += event.key;

      if (!emCampoTexto) {
        sequenciaRapidaRef.current = true;
        event.preventDefault();
        return;
      }

      if (intervalo < INTERVALO_MAX_SCANNER_MS) {
        sequenciaRapidaRef.current = true;
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [ativo]);
}
