import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      // MUDANÇA: Usando 768px (padrão da indústria). 
      // Antes poderia estar 1024px, o que pegava notebooks pequenos.
      setIsMobile(window.innerWidth < 768);
    };

    // Checa ao carregar
    checkIsMobile();

    // Checa sempre que a tela mudar de tamanho
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}