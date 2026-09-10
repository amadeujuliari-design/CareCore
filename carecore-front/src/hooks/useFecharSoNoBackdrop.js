import { useCallback, useRef } from 'react';

/**
 * Fecha modal só se o clique começar e terminar no backdrop
 * (evita fechar ao selecionar texto e soltar o mouse fora do formulário).
 */
export function useFecharSoNoBackdrop(onFechar) {
  const pressionadoNoBackdrop = useRef(false);

  const onMouseDownBackdrop = useCallback((event) => {
    pressionadoNoBackdrop.current = event.target === event.currentTarget;
  }, []);

  const onClickBackdrop = useCallback(
    (event) => {
      if (pressionadoNoBackdrop.current && event.target === event.currentTarget) {
        onFechar?.();
      }
      pressionadoNoBackdrop.current = false;
    },
    [onFechar],
  );

  return { onMouseDownBackdrop, onClickBackdrop };
}
