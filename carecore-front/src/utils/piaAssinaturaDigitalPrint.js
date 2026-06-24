const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizarCodigoCarteirinha(valor) {
  return String(valor ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function codigosCarteirinhaAceitos(convivente) {
  const cpf = String(convivente?.cpf ?? '').replace(/\D/g, '');
  const candidatos = [
    convivente?.id,
    convivente?.numero_institucional,
    cpf,
    String(convivente?.id ?? '').slice(0, 8),
  ];
  return new Set(
    candidatos
      .map((item) => normalizarCodigoCarteirinha(item))
      .filter(Boolean),
  );
}

export function montarConviventeParaValidacaoCarteirinha(
  convivente = {},
  conviventeId = '',
  numeroProntuario = '',
) {
  return {
    ...convivente,
    id: convivente?.id || conviventeId || '',
    numero_institucional: convivente?.numero_institucional ?? numeroProntuario ?? '',
  };
}

export function codigoCarteirinhaConfereComConvivente(convivente, codigoLido) {
  const bruto = String(codigoLido ?? '').trim();
  if (!bruto) return false;

  const idConvivente = String(convivente?.id ?? '').trim();
  if (idConvivente && bruto.toLowerCase() === idConvivente.toLowerCase()) {
    return true;
  }

  const normalizado = normalizarCodigoCarteirinha(codigoLido);
  if (!normalizado) return false;
  return codigosCarteirinhaAceitos(convivente).has(normalizado);
}

export function inferirMetodoLeituraCarteirinha(codigoLido) {
  const bruto = String(codigoLido ?? '').trim();
  return UUID_REGEX.test(bruto) ? 'qr_code' : 'codigo_barras';
}

export function formatarDataHoraAssinaturaPia(valor) {
  if (!valor) return '';
  try {
    return new Date(valor).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
  } catch {
    return '';
  }
}

export function montarLinhasAssinaturaDigitalImpressao(assinatura) {
  if (!assinatura) return [];

  const linhas = ['Assinado Digitalmente'];
  const metodo = assinatura.metodo_leitura || inferirMetodoLeituraCarteirinha(assinatura.codigo_lido);

  if (metodo === 'qr_code') {
    linhas.push(`Código: ${assinatura.codigo_lido}`);
    if (assinatura.numero_prontuario) {
      linhas.push(`Prontuário #${assinatura.numero_prontuario}`);
    }
  } else {
    linhas.push(`Código: ${assinatura.codigo_lido}`);
  }

  const quando = formatarDataHoraAssinaturaPia(assinatura.assinado_em);
  if (quando) linhas.push(quando);
  return linhas;
}
