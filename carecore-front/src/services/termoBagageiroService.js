import api from './api';

export async function consultarTermoBagageiro(conviventeId) {
  const response = await api.get(`/api/conviventes/${conviventeId}/termo-bagageiro/assinatura-digital`);
  return response.data;
}

export async function registrarAssinaturaTermoBagageiro(conviventeId, payload) {
  const response = await api.post(
    `/api/conviventes/${conviventeId}/termo-bagageiro/assinatura-digital`,
    payload,
  );
  return response.data;
}

export async function registrarImpressaoTermoBagageiroSemAssinatura(conviventeId) {
  const response = await api.post(
    `/api/conviventes/${conviventeId}/termo-bagageiro/impressao-sem-assinatura`,
  );
  return response.data;
}

export async function registrarReimpressaoTermoBagageiroAssinado(conviventeId) {
  const response = await api.post(
    `/api/conviventes/${conviventeId}/termo-bagageiro/reimpressao-assinada`,
    {},
  );
  return response.data;
}

export async function salvarTermoBagageiroDocumentoGed(conviventeId, formData) {
  const response = await api.post(
    `/api/conviventes/${conviventeId}/termo-bagageiro/documento-ged`,
    formData,
  );
  return response.data;
}
