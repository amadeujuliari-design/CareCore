import { salvarTermoBagageiroDocumentoGed } from '../services/termoBagageiroService';
import { obterMensagemErro } from './usuariosUtils';

function montarNomeArquivoTermoBagageiro(convivente) {
  const prontuario = convivente?.numero_institucional || 'sem_prontuario';
  const data = new Date().toISOString().slice(0, 10);
  return `termo_bagageiro_${prontuario}_${data}.html`;
}

export async function persistirTermoBagageiroNoGed(convivente, html) {
  if (!convivente?.id || !html) return null;

  const nomeArquivo = montarNomeArquivoTermoBagageiro(convivente);
  const blob = new Blob([html], { type: 'text/html' });
  const formData = new FormData();
  formData.append('file', blob, nomeArquivo);

  try {
    const resposta = await salvarTermoBagageiroDocumentoGed(convivente.id, formData);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carecore:documentos-convivente-atualizar', {
        detail: { conviventeId: convivente.id },
      }));
    }
    return { ok: true, documento: resposta };
  } catch (error) {
    return {
      ok: false,
      mensagem: obterMensagemErro(error, 'Não foi possível salvar o termo no GED do convivente.'),
    };
  }
}
