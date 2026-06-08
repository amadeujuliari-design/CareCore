import { useState } from 'react';

import { listarDocumentosConvivente } from '../services/conviventesProntuarioService';
import { montarHtmlFichaCompletaConvivente } from '../utils/fichaCompletaConvivente';
import { abrirPreviewHtml } from '../utils/imprimirRelatorio';
import { obterLogoRelatorioDataUrl } from '../utils/relatorioIdentidadePrint';

export function useProntuarioImpressao({
  documentos,
  editandoId,
  listaTecnicos,
  quartos,
  usuarioPodeImprimirSensiveisConvivente,
}) {
  const [carteirinhaAberta, setCarteirinhaAberta] = useState(null);
  const [fotoCarteirinha, setFotoCarteirinha] = useState(null);
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [fichaSensivelPendente, setFichaSensivelPendente] = useState(null);

  const abrirCarteirinha = async (convivente) => {
    setCarteirinhaAberta(convivente);
    setFotoCarteirinha(convivente?.foto_url || null);
    try {
      const documentosCarteirinha = await listarDocumentosConvivente(convivente.id);
      const fotoData = documentosCarteirinha.filter(doc => doc.tipo_documento === 'Foto de Perfil')
        .sort((a, b) => new Date(b.data_upload) - new Date(a.data_upload))[0];

      if (fotoData) {
        setFotoCarteirinha(fotoData.caminho_arquivo);
      }
    } catch (error) {
      console.error('Erro ao buscar foto para a carteirinha', error);
    }
  };

  const abrirFichaCompleta = async (convivente, incluirDadosSensiveis = false) => {
    if (!convivente) return;

    let documentosFicha = documentos;
    if (convivente.id !== editandoId) {
      try {
        documentosFicha = await listarDocumentosConvivente(convivente.id);
      } catch {
        documentosFicha = [];
      }
    }

    const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);

    const html = montarHtmlFichaCompletaConvivente({
      convivente,
      documentosFicha,
      listaTecnicos,
      quartos,
      incluirDadosSensiveis,
      identidadeRelatorio,
      logoRelatorioDataUrl,
    });

    abrirPreviewHtml({
      titulo: `Ficha completa - ${convivente.nome_social || convivente.nome_completo || 'Convivente'}`,
      html,
    });
  };

  const solicitarImpressaoFichaCompleta = (convivente) => {
    if (!convivente) return;

    if (usuarioPodeImprimirSensiveisConvivente(convivente)) {
      setFichaSensivelPendente(convivente);
      return;
    }

    abrirFichaCompleta(convivente, false);
  };

  return {
    abrirCarteirinha,
    abrirFichaCompleta,
    carteirinhaAberta,
    fichaSensivelPendente,
    fotoCarteirinha,
    identidadeRelatorio,
    setCarteirinhaAberta,
    setFichaSensivelPendente,
    setIdentidadeRelatorio,
    solicitarImpressaoFichaCompleta,
  };
}
