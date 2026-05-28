import { useEffect, useMemo, useState } from 'react';

const getSnapshot = () => {
  if (typeof window === 'undefined') {
    return {
      width: 1280,
      height: 800,
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      isSecureCameraContext: true,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isTouchDevice = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop: width >= 1024,
    isTouchDevice,
    isSecureCameraContext: window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  };
};

export function useDeviceInfo() {
  const [snapshot, setSnapshot] = useState(getSnapshot);

  useEffect(() => {
    const atualizar = () => setSnapshot(getSnapshot());

    window.addEventListener('resize', atualizar);
    window.addEventListener('orientationchange', atualizar);

    return () => {
      window.removeEventListener('resize', atualizar);
      window.removeEventListener('orientationchange', atualizar);
    };
  }, []);

  return useMemo(() => snapshot, [snapshot]);
}

export function getPreferredCameraConstraints(deviceInfo, { square = false } = {}) {
  const preferBackCamera = deviceInfo?.isMobile || deviceInfo?.isTablet || deviceInfo?.isTouchDevice;

  return {
    video: {
      facingMode: preferBackCamera ? { ideal: 'environment' } : { ideal: 'user' },
      width: square ? { ideal: 720 } : { ideal: 1280 },
      height: square ? { ideal: 720 } : { ideal: 720 },
    },
    audio: false,
  };
}

export function getCameraUnavailableMessage(deviceInfo, tipo = 'câmera') {
  if (!deviceInfo?.isSecureCameraContext) {
    return `O navegador do celular pode bloquear ${tipo} em endereço local HTTP. Use o botão de arquivo/câmera do celular ou acesse por HTTPS quando o sistema estiver publicado.`;
  }

  return `Não foi possível acessar ${tipo}. Verifique a permissão do navegador e tente novamente.`;
}
