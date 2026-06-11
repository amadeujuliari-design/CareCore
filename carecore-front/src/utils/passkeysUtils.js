function passkeysDisponiveis() {
  return (
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    window.isSecureContext
  );
}

function base64urlParaBuffer(valor) {
  const base64 = valor
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(valor.length / 4) * 4, '=');
  const binario = window.atob(base64);
  const bytes = new Uint8Array(binario.length);

  for (let i = 0; i < binario.length; i += 1) {
    bytes[i] = binario.charCodeAt(i);
  }

  return bytes.buffer;
}

function bufferParaBase64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = '';

  bytes.forEach((byte) => {
    binario += String.fromCharCode(byte);
  });

  return window.btoa(binario)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function prepararOpcoesRegistro(publicKey) {
  return {
    ...publicKey,
    challenge: base64urlParaBuffer(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64urlParaBuffer(publicKey.user.id),
    },
    excludeCredentials: (publicKey.excludeCredentials || []).map((credential) => ({
      ...credential,
      id: base64urlParaBuffer(credential.id),
    })),
  };
}

function prepararOpcoesLogin(publicKey) {
  return {
    ...publicKey,
    challenge: base64urlParaBuffer(publicKey.challenge),
    allowCredentials: (publicKey.allowCredentials || []).map((credential) => ({
      ...credential,
      id: base64urlParaBuffer(credential.id),
    })),
  };
}

function serializarCredencialRegistro(credential) {
  return {
    id: credential.id,
    rawId: bufferParaBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bufferParaBase64url(credential.response.attestationObject),
      clientDataJSON: bufferParaBase64url(credential.response.clientDataJSON),
      transports: typeof credential.response.getTransports === 'function'
        ? credential.response.getTransports()
        : [],
    },
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
  };
}

function serializarCredencialLogin(credential) {
  return {
    id: credential.id,
    rawId: bufferParaBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferParaBase64url(credential.response.authenticatorData),
      clientDataJSON: bufferParaBase64url(credential.response.clientDataJSON),
      signature: bufferParaBase64url(credential.response.signature),
      userHandle: credential.response.userHandle
        ? bufferParaBase64url(credential.response.userHandle)
        : null,
    },
    clientExtensionResults: credential.getClientExtensionResults?.() || {},
  };
}

async function criarCredencialPasskey(publicKey) {
  if (!passkeysDisponiveis()) {
    throw new Error('Este navegador não oferece suporte a acesso biométrico/passkey.');
  }

  const credential = await navigator.credentials.create({
    publicKey: prepararOpcoesRegistro(publicKey),
  });

  if (!credential) {
    throw new Error('A criação do acesso biométrico foi cancelada.');
  }

  return serializarCredencialRegistro(credential);
}

async function obterCredencialPasskey(publicKey) {
  if (!passkeysDisponiveis()) {
    throw new Error('Este navegador não oferece suporte a acesso biométrico/passkey.');
  }

  const credential = await navigator.credentials.get({
    publicKey: prepararOpcoesLogin(publicKey),
  });

  if (!credential) {
    throw new Error('A autenticação biométrica foi cancelada.');
  }

  return serializarCredencialLogin(credential);
}

export {
  criarCredencialPasskey,
  obterCredencialPasskey,
  passkeysDisponiveis,
};
