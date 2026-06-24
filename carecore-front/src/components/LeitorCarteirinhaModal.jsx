import { useEffect, useRef, useState } from 'react';
import { deveIgnorarLeituraCodigoRepetida } from '../utils/leituraCodigoUtils';

export default function LeitorCarteirinhaModal({
  aberto,
  titulo = 'Ler carteirinha',
  subtitulo = 'Aponte a câmera para o QR Code ou código de barras da carteirinha.',
  placeholder = 'Digite o prontuário, CPF, código de barras ou QR Code',
  erroExterno = '',
  onCodigoLido,
  onClose,
}) {
  const [erro, setErro] = useState('');
  const [codigoManual, setCodigoManual] = useState('');
  const ultimaLeituraRef = useRef({ codigo: '', horario: 0 });
  const onCodigoLidoRef = useRef(onCodigoLido);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCodigoLidoRef.current = onCodigoLido;
    onCloseRef.current = onClose;
  });

  const encaminharCodigoLido = async (codigoBruto) => {
    if (deveIgnorarLeituraCodigoRepetida(ultimaLeituraRef, codigoBruto)) {
      return 'ignorado';
    }

    const codigo = ultimaLeituraRef.current.codigo;
    const aceito = await onCodigoLidoRef.current?.(codigo);
    if (aceito === false) {
      setErro('Código lido, mas nenhum convivente correspondente foi encontrado.');
      return 'invalido';
    }
    if (aceito === 'erro_tratado') {
      return 'invalido';
    }

    onCloseRef.current?.();
    return 'aceito';
  };

  useEffect(() => {
    if (!aberto) {
      setErro('');
      setCodigoManual('');
      ultimaLeituraRef.current = { codigo: '', horario: 0 };
      return undefined;
    }

    let leitor = null;
    let ativo = true;

    const iniciarCamera = async () => {
      try {
        setErro('');

        if (!navigator.mediaDevices?.getUserMedia) {
          setErro('Este navegador não liberou acesso à câmera. Use o campo manual.');
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
        if (!ativo) return;

        const elementoLeitor = document.getElementById('leitor-carteirinha-operacional');
        if (!elementoLeitor) {
          setErro('Não foi possível preparar o leitor. Feche e tente novamente.');
          return;
        }

        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (!ativo) return;

        const cameras = await Html5Qrcode.getCameras();
        if (!cameras?.length) {
          setErro('Nenhuma câmera foi encontrada neste dispositivo.');
          return;
        }

        const cameraPreferida = cameras.find((camera) => {
          const label = String(camera.label || '').toLowerCase();
          return /back|rear|environment|traseira/.test(label);
        }) || cameras[0];

        leitor = new Html5Qrcode('leitor-carteirinha-operacional');
        await leitor.start(
          cameraPreferida.id,
          {
            fps: 10,
            qrbox: { width: 260, height: 180 },
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
            ].filter(Boolean),
          },
          async (codigoLido) => {
            if (!ativo) return;
            await encaminharCodigoLido(codigoLido);
          },
          () => {},
        );
      } catch (error) {
        console.error('Erro ao iniciar leitor de carteirinha:', error);
        const nomeErro = error?.name || '';
        const detalhe = nomeErro === 'NotAllowedError'
          ? 'A câmera foi bloqueada pelo navegador ou pelo Windows.'
          : nomeErro === 'NotReadableError'
            ? 'A câmera pode estar em uso por outro aplicativo.'
            : 'Verifique se a câmera está disponível e permitida.';
        setErro(`Não foi possível iniciar a câmera. ${detalhe}`);
      }
    };

    iniciarCamera();

    return () => {
      ativo = false;
      if (leitor) {
        try {
          leitor.stop?.();
          leitor.clear();
        } catch {
          // O leitor pode já ter sido encerrado ao fechar o modal.
        }
      }
    };
  }, [aberto]);

  if (!aberto) return null;

  const usarCodigoManual = async (event) => {
    event.preventDefault();
    const codigo = codigoManual.trim();
    if (!codigo) {
      setErro('Digite ou leia um código para continuar.');
      return;
    }

    const resultado = await encaminharCodigoLido(codigo);
    if (resultado === 'aceito') {
      setCodigoManual('');
      return;
    }

    if (resultado === 'invalido') {
      return;
    }

    setCodigoManual('');
  };

  return (
    <div className="carecore-modal-overlay fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm">
      <div className="carecore-modal-panel w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gray-900 p-5 text-white">
          <div>
            <h2 className="text-lg font-bold">{titulo}</h2>
            <p className="mt-1 text-xs text-gray-300">{subtitulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            X
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div
            id="leitor-carteirinha-operacional"
            className="min-h-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-950"
          />

          {erroExterno && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {erroExterno}
            </div>
          )}

          {erro && !erroExterno && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
              {erro}
            </div>
          )}

          <form onSubmit={usarCodigoManual} className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500">
              Alternativa manual ou leitor USB
            </label>
            <input
              value={codigoManual}
              onChange={(event) => setCodigoManual(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand"
              placeholder={placeholder}
              autoFocus
            />
            <button
              type="submit"
              className="min-h-11 w-full rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white"
            >
              Usar este código
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
