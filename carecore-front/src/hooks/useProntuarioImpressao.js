import { useCallback, useState } from 'react';

import {
  listarDocumentosConvivente,
  obterConviventeProntuario,
} from '../services/conviventesProntuarioService';
import { montarHtmlFichaCompletaConvivente } from '../utils/fichaCompletaConvivente';
import { abrirPreviewHtml } from '../utils/imprimirRelatorio';
import { obterLogoRelatorioDataUrl } from '../utils/relatorioIdentidadePrint';
import { formatarDadosConviventeParaTela } from '../utils/conviventesProntuarioUtils';

export function useProntuarioImpressao({
  listaTecnicos,
  quartos,
  origensEncaminhamento = [],
}) {
  const [carteirinhaAberta, setCarteirinhaAberta] = useState(null);
  const [fotoCarteirinha, setFotoCarteirinha] = useState(null);
  const [identidadeRelatorio, setIdentidadeRelatorio] = useState(null);
  const [fichaCompletaPendente, setFichaCompletaPendente] = useState(null);
  const [imprimindoFicha, setImprimindoFicha] = useState(false);

  const abrirCarteirinha = async (convivente) => {
    setCarteirinhaAberta(convivente);
    setFotoCarteirinha(convivente?.foto_url || null);
    try {
      const documentosCarteirinha = await listarDocumentosConvivente(convivente.id);
      const fotoData = documentosCarteirinha
        .filter((doc) => doc.tipo_documento === 'Foto de Perfil')
        .sort((a, b) => new Date(b.data_upload) - new Date(a.data_upload))[0];

      if (fotoData) {
        setFotoCarteirinha(fotoData.caminho_arquivo);
      }
    } catch (error) {
      console.error('Erro ao buscar foto para a carteirinha', error);
    }
  };

  const carregarProntuarioParaFicha = useCallback(async (conviventeId) => {
    const prontuario = await obterConviventeProntuario(conviventeId);
    return formatarDadosConviventeParaTela(prontuario);
  }, []);

  const abrirFichaCompleta = async (convivente, secoesSelecionadas) => {
    if (!convivente?.id || !secoesSelecionadas?.length) return;

    setImprimindoFicha(true);
    try {
      let dados = convivente;
      try {
        dados = await carregarProntuarioParaFicha(convivente.id);
      } catch (error) {
        console.error('Erro ao buscar prontuário para ficha; usando dados em memória.', error);
      }

      const logoRelatorioDataUrl = await obterLogoRelatorioDataUrl(identidadeRelatorio);
      const html = montarHtmlFichaCompletaConvivente({
        convivente: dados,
        secoesSelecionadas,
        listaTecnicos,
        quartos,
        origensEncaminhamento,
        identidadeRelatorio,
        logoRelatorioDataUrl,
      });

      abrirPreviewHtml({
        titulo: `Ficha completa - ${dados.nome_social || dados.nome_completo || 'Convivente'}`,
        html,
      });
      setFichaCompletaPendente(null);
    } finally {
      setImprimindoFicha(false);
    }
  };

  const solicitarImpressaoFichaCompleta = async ({ id, nome_social, nome_completo, numero_institucional }) => {
    if (!id) return;

    const resumo = {
      id,
      nome_social,
      nome_completo,
      numero_institucional,
    };

    setFichaCompletaPendente({
      convivente: resumo,
      carregandoDados: true,
    });

    try {
      const prontuario = await carregarProntuarioParaFicha(id);
      setFichaCompletaPendente({
        convivente: prontuario,
        carregandoDados: false,
      });
    } catch (error) {
      console.error('Erro ao carregar prontuário para seleção da ficha', error);
      setFichaCompletaPendente({
        convivente: resumo,
        carregandoDados: false,
        erroCarregamento: true,
      });
    }
  };

  const imprimirFichaCompleta = (secoesSelecionadas) => {
    if (!fichaCompletaPendente?.convivente) return;
    abrirFichaCompleta(fichaCompletaPendente.convivente, secoesSelecionadas);
  };

  return {
    abrirCarteirinha,
    abrirFichaCompleta,
    carteirinhaAberta,
    fichaCompletaPendente,
    fotoCarteirinha,
    identidadeRelatorio,
    imprimindoFicha,
    imprimirFichaCompleta,
    setCarteirinhaAberta,
    setFichaCompletaPendente,
    setIdentidadeRelatorio,
    solicitarImpressaoFichaCompleta,
  };
}
