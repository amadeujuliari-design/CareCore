export const PRESETS_IMAGEM = {
  foto_perfil: {
    tamanho: 512,
    maxLado: null,
    quadrado: true,
    qualidade: 0.85,
    nomeBase: 'foto_perfil',
  },
  documento: {
    tamanho: null,
    maxLado: 2048,
    quadrado: false,
    qualidade: 0.85,
    nomeBase: 'documento',
  },
};

function processarImagemNoCanvas(img, preset) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Não foi possível processar a imagem.');
  }

  let larguraOrigem = img.width;
  let alturaOrigem = img.height;
  let sx = 0;
  let sy = 0;

  if (preset.quadrado) {
    const lado = Math.min(larguraOrigem, alturaOrigem);
    sx = (larguraOrigem - lado) / 2;
    sy = (alturaOrigem - lado) / 2;
    larguraOrigem = lado;
    alturaOrigem = lado;
  }

  let larguraDestino = larguraOrigem;
  let alturaDestino = alturaOrigem;

  if (preset.tamanho) {
    larguraDestino = preset.tamanho;
    alturaDestino = preset.tamanho;
  } else if (preset.maxLado) {
    const maiorLado = Math.max(larguraOrigem, alturaOrigem);

    if (maiorLado > preset.maxLado) {
      const escala = preset.maxLado / maiorLado;
      larguraDestino = Math.round(larguraOrigem * escala);
      alturaDestino = Math.round(alturaOrigem * escala);
    }
  }

  canvas.width = larguraDestino;
  canvas.height = alturaDestino;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, larguraDestino, alturaDestino);
  ctx.drawImage(
    img,
    sx,
    sy,
    larguraOrigem,
    alturaOrigem,
    0,
    0,
    larguraDestino,
    alturaDestino,
  );

  return canvas;
}

function lerArquivoComoImagem(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Arquivo não informado.'));
      return;
    }

    if (!file.type?.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido.'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error('Não foi possível carregar o arquivo.'));
    reader.readAsDataURL(file);
  });
}

function canvasParaArquivo(canvas, nomeArquivo, qualidade) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar a imagem padronizada.'));
          return;
        }

        resolve(new File([blob], nomeArquivo, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      qualidade,
    );
  });
}

export async function imagemParaArquivoPadronizado(
  file,
  presetNome = 'foto_perfil',
  nomeArquivo = '',
) {
  const preset = PRESETS_IMAGEM[presetNome] || PRESETS_IMAGEM.foto_perfil;
  const img = await lerArquivoComoImagem(file);
  const canvas = processarImagemNoCanvas(img, preset);
  const nomeFinal = nomeArquivo || `${preset.nomeBase}.jpg`;

  return canvasParaArquivo(canvas, nomeFinal, preset.qualidade);
}

export function imagemParaBase64Padronizada(file, tamanho = 512, qualidade = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Arquivo não informado.'));
      return;
    }

    if (!file.type?.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem válido.'));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = processarImagemNoCanvas(img, {
            tamanho,
            maxLado: null,
            quadrado: true,
            qualidade,
          });

          resolve(canvas.toDataURL('image/jpeg', qualidade));
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error('Não foi possível carregar o arquivo.'));
    reader.readAsDataURL(file);
  });
}

export function ehArquivoImagem(file) {
  return Boolean(file?.type?.startsWith('image/'));
}

export function presetImagemPorTipoDocumento(tipoDocumento) {
  return tipoDocumento === 'Foto de Perfil' ? 'foto_perfil' : 'documento';
}
