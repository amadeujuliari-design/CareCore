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
        const canvas = document.createElement('canvas');
        canvas.width = tamanho;
        canvas.height = tamanho;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }

        const lado = Math.min(img.width, img.height);
        const sx = (img.width - lado) / 2;
        const sy = (img.height - lado) / 2;

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, tamanho, tamanho);
        ctx.drawImage(
          img,
          sx,
          sy,
          lado,
          lado,
          0,
          0,
          tamanho,
          tamanho
        );

        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };

      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.src = reader.result;
    };

    reader.onerror = () => reject(new Error('Não foi possível carregar o arquivo.'));
    reader.readAsDataURL(file);
  });
}

export function dataUrlParaArquivo(dataUrl, nomeArquivo = 'foto-webcam.jpg') {
  const partes = dataUrl.split(',');
  const mime = partes[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binario = atob(partes[1]);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }

  return new File([bytes], nomeArquivo, { type: mime });
}

export function obterPayloadToken() {
  try {
    const token =
      localStorage.getItem('@CareCore:token') ||
      localStorage.getItem('token');

    if (!token) return null;

    const partes = token.split('.');

    if (partes.length !== 3) return null;

    return JSON.parse(atob(partes[1]));
  } catch {
    return null;
  }
}

export function usuarioEhGestor() {
  const payload = obterPayloadToken();

  if (!payload) return false;

  const perfil = payload.perfil_acesso;

  return (
    payload.is_master === true ||
    perfil === 'Gestor' ||
    perfil === 'Gestao' ||
    perfil === 'Gestão' ||
    perfil === 'Gerente'
  );
}

export function somenteNumeros(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function formatarCPF(valor) {
  const v = somenteNumeros(valor).slice(0, 11);

  return v
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatarTelefone(valor) {
  let v = somenteNumeros(valor).slice(0, 11);

  if (v.length <= 10) {
    v = v.replace(/^(\d{2})(\d)/, '($1) $2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
    return v;
  }

  v = v.replace(/^(\d{2})(\d)/, '($1) $2');
  v = v.replace(/(\d{5})(\d)/, '$1-$2');

  return v;
}

export function formatarCEP(valor) {
  const v = somenteNumeros(valor).slice(0, 8);

  return v.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function limparMascara(valor) {
  return somenteNumeros(valor);
}

export function dataParaInput(valor) {
  if (!valor) return '';

  return String(valor).slice(0, 10);
}

export function removerCamposVazios(objeto) {
  const limpo = {};

  Object.entries(objeto).forEach(([chave, valor]) => {
    if (valor === '' || valor === null || valor === undefined) {
      return;
    }

    limpo[chave] = valor;
  });

  return limpo;
}

export function obterMensagemErro(error) {
  const data = error?.response?.data;

  if (!data) {
    return 'Não foi possível se conectar ao servidor.';
  }

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail
      .map((item) => {
        const campo = Array.isArray(item?.loc)
          ? item.loc.filter((parte) => parte !== 'body').join('.')
          : '';

        const mensagem = item?.msg || 'Erro de validação.';

        return campo ? `${campo}: ${mensagem}` : mensagem;
      })
      .join('\n');
  }

  if (Array.isArray(data.erros) && data.erros.length > 0) {
    return data.erros
      .map((item) => item?.mensagem || 'Erro de validação.')
      .join('\n');
  }

  return 'Erro ao processar solicitação.';
}

export function cpfValido(valor) {
  const cpf = limparMascara(valor);

  if (!cpf) return true;
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let soma = 0;

  for (let i = 0; i < 9; i += 1) {
    soma += Number(cpf[i]) * (10 - i);
  }

  let digito1 = 11 - (soma % 11);
  digito1 = digito1 >= 10 ? 0 : digito1;

  soma = 0;

  for (let i = 0; i < 10; i += 1) {
    soma += Number(cpf[i]) * (11 - i);
  }

  let digito2 = 11 - (soma % 11);
  digito2 = digito2 >= 10 ? 0 : digito2;

  return cpf.endsWith(`${digito1}${digito2}`);
}

export function telefoneValido(valor) {
  const telefone = limparMascara(valor);

  if (!telefone) return true;

  return telefone.length === 10 || telefone.length === 11;
}

export function cepValido(valor) {
  const cep = limparMascara(valor);

  if (!cep) return true;

  return cep.length === 8;
}

export function emailValido(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor || '').trim());
}
