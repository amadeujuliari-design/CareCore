import { useMemo, useRef, useState } from 'react';

import {
  ehArquivoImagem,
  imagemParaArquivoPadronizado,
  presetImagemPorTipoDocumento,
} from '../utils/imagemUploadUtils';
import {
  getCameraUnavailableMessage,
  getPreferredCameraConstraints,
} from './useDeviceInfo';
import {
  excluirDocumentoConvivente,
  listarDocumentosConvivente,
  obterConviventeProntuario,
  removerFotoPerfilConvivente,
  uploadDocumentoConvivente,
} from '../services/conviventesProntuarioService';

export function useProntuarioDocumentos({
  bnmpPortalUrl,
  editandoId,
  deviceInfo,
  tipoDocConsultaBnmp,
  usuarioPodeEnviarDocumentosRestritos,
  usuarioPodeGerenciarDocumentosRestritos,
  setErro,
  setSucesso,
  setFormData,
  carregarDadosIniciais,
}) {
  const [documentos, setDocumentos] = useState([]);
  const [totalDocumentos, setTotalDocumentos] = useState(0);
  const [documentosTemMais, setDocumentosTemMais] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [tipoDocumentoSelecionado, setTipoDocumentoSelecionado] = useState('');
  const [documentoSensivelSelecionado, setDocumentoSensivelSelecionado] = useState(false);
  const [salvandoConsultaBnmp, setSalvandoConsultaBnmp] = useState(false);
  const [cameraAberta, setCameraAberta] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const documentoConsultaBnmp = useMemo(
    () => documentos
      .filter((doc) => doc.tipo_documento === tipoDocConsultaBnmp)
      .sort((a, b) => new Date(b.data_upload) - new Date(a.data_upload))[0] || null,
    [documentos, tipoDocConsultaBnmp],
  );

  const fotoPerfilData = documentos
    .filter(doc => doc.tipo_documento === 'Foto de Perfil')
    .sort((a, b) => new Date(b.data_upload) - new Date(a.data_upload))[0];

  const carregarDocumentos = async (conviventeId, { append = false } = {}) => {
    setLoadingDocs(true);
    try {
      const resposta = await listarDocumentosConvivente(conviventeId, {
        limite: 30,
        deslocamento: append ? documentos.length : 0,
      });
      const documentosRecebidos = resposta.registros || [];
      setDocumentos((prev) => (append ? [...prev, ...documentosRecebidos] : documentosRecebidos));
      setTotalDocumentos(resposta.total || documentosRecebidos.length);
      setDocumentosTemMais(Boolean(resposta.has_more));
    } catch (error) {
      console.error('Erro ao carregar documentos', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const abrirCamera = async () => {
    setCameraAberta(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErro('Seu navegador não permite captura direta pela câmera. Use o botão de arquivo/câmera do celular.');
        setCameraAberta(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia(
        getPreferredCameraConstraints(deviceInfo),
      );

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play();
      }
    } catch {
      setErro(getCameraUnavailableMessage(deviceInfo, 'a câmera'));
      setCameraAberta(false);
    }
  };

  const fecharCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setCameraAberta(false);
  };

  const capturarFoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const capturaBruta = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Não foi possível capturar a foto.'));
              return;
            }

            resolve(new File([blob], 'captura.png', { type: 'image/png' }));
          },
          'image/png',
        );
      });

      const file = await imagemParaArquivoPadronizado(
        capturaBruta,
        'foto_perfil',
        `foto_perfil_${editandoId || 'novo'}.jpg`,
      );

      setArquivoSelecionado(file);
      setTipoDocumentoSelecionado('Foto de Perfil');
      setSucesso('Foto capturada e padronizada. Clique em "Fazer upload" para confirmar.');
      fecharCamera();
      setTimeout(() => setSucesso(''), 4000);
    } catch (error) {
      setErro(error?.message || 'Erro ao processar a foto capturada.');
      fecharCamera();
    }
  };

  const padronizarArquivoSelecionado = async (arquivo, tipoDocumento) => {
    if (!arquivo || !ehArquivoImagem(arquivo)) {
      return arquivo;
    }

    const preset = presetImagemPorTipoDocumento(tipoDocumento);
    const nomeBase = arquivo.name?.replace(/\.[^.]+$/, '') || preset;

    return imagemParaArquivoPadronizado(
      arquivo,
      preset,
      `${nomeBase}.jpg`,
    );
  };

  const handleUploadDocumento = async (e) => {
    e.preventDefault();
    if (!editandoId) { setErro('Atenção: Salve o prontuário primeiro.'); return; }
    if (!arquivoSelecionado) { setErro('Selecione um arquivo antes de enviar.'); return; }
    if (!tipoDocumentoSelecionado) { setErro('Selecione o tipo do documento antes de enviar.'); return; }

    setLoadingDocs(true);
    const tipoEnvio = tipoDocumentoSelecionado;

    try {
      const arquivoEnvio = await padronizarArquivoSelecionado(
        arquivoSelecionado,
        tipoEnvio,
      );

      const formUpload = new FormData();
      formUpload.append('file', arquivoEnvio);
      formUpload.append('tipo_documento', tipoEnvio);
      formUpload.append('sensivel', documentoSensivelSelecionado ? 'true' : 'false');

      await uploadDocumentoConvivente(editandoId, formUpload);

      setSucesso(
        documentoSensivelSelecionado && !usuarioPodeGerenciarDocumentosRestritos
          ? 'Documento sensível enviado com sucesso. Seu perfil não permite visualizar o arquivo após o envio.'
          : ehArquivoImagem(arquivoSelecionado)
          ? 'Arquivo padronizado e anexado com sucesso!'
          : 'Arquivo anexado com sucesso!',
      );
      setArquivoSelecionado(null);
      setTipoDocumentoSelecionado('');
      setDocumentoSensivelSelecionado(false);
      carregarDocumentos(editandoId);

      if (tipoEnvio === 'Foto de Perfil') {
        const conviventeAtualizado = await obterConviventeProntuario(editandoId);
        setFormData((prev) => ({
          ...prev,
          foto_url: conviventeAtualizado?.foto_url || prev.foto_url,
        }));
      }

      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || error?.message || 'Erro ao realizar upload do arquivo.');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleExcluirDocumento = async (documentoId) => {
    if (!window.confirm('Deseja realmente excluir este arquivo?')) return;
    try {
      await excluirDocumentoConvivente(documentoId);
      setSucesso('Arquivo excluído com sucesso.');
      carregarDocumentos(editandoId);
      setTimeout(() => setSucesso(''), 3000);
    } catch {
      setErro('Erro ao excluir o documento.');
    }
  };

  const abrirConsultaBnmp = () => {
    window.open(bnmpPortalUrl, '_blank', 'noopener,noreferrer');
  };

  const enviarPdfConsultaBnmp = async (file) => {
    if (!editandoId) {
      setErro('Salve o prontuário antes de anexar a consulta BNMP.');
      return;
    }

    if (!usuarioPodeEnviarDocumentosRestritos) {
      setErro('Apenas Gestores/Gerentes/Master e Técnicos podem salvar comprovantes restritos.');
      return;
    }

    const ehPdf = file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf');
    if (!file || !ehPdf) {
      setErro('Selecione o PDF gerado na impressão da consulta BNMP.');
      return;
    }

    setSalvandoConsultaBnmp(true);

    try {
      const formUpload = new FormData();
      formUpload.append('file', file);
      formUpload.append('tipo_documento', tipoDocConsultaBnmp);
      formUpload.append('sensivel', 'true');

      await uploadDocumentoConvivente(editandoId, formUpload);

      setSucesso(
        usuarioPodeGerenciarDocumentosRestritos
          ? 'PDF da consulta BNMP salvo com sucesso.'
          : 'PDF da consulta BNMP salvo com sucesso. Seu perfil não permite visualizar o arquivo após o envio.',
      );
      carregarDocumentos(editandoId);
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || error?.message || 'Erro ao salvar o PDF da consulta BNMP.');
    } finally {
      setSalvandoConsultaBnmp(false);
    }
  };

  const handleRemoverFotoPerfil = async () => {
    if (!editandoId) return;
    if (!window.confirm('Remover a foto de perfil deste convivente? Ele passará a aparecer como pendente de foto.')) return;

    try {
      await removerFotoPerfilConvivente(editandoId);
      setFormData(prev => ({ ...prev, foto_url: '' }));
      setDocumentos(prev => prev.filter(doc => doc.tipo_documento !== 'Foto de Perfil'));
      setSucesso('Foto de perfil removida com sucesso.');
      carregarDocumentos(editandoId);
      carregarDadosIniciais();
      setTimeout(() => setSucesso(''), 3000);
    } catch (error) {
      setErro(error.response?.data?.detail || 'Erro ao remover foto de perfil.');
    }
  };

  const resetarDocumentosProntuario = () => {
    setDocumentos([]);
    setTotalDocumentos(0);
    setDocumentosTemMais(false);
    setArquivoSelecionado(null);
    setTipoDocumentoSelecionado('');
    setDocumentoSensivelSelecionado(false);
    fecharCamera();
  };

  return {
    abrirCamera,
    abrirConsultaBnmp,
    arquivoSelecionado,
    cameraAberta,
    canvasRef,
    capturarFoto,
    carregarDocumentos,
    carregarMaisDocumentos: (conviventeId) => {
      if (!documentosTemMais) return;
      return carregarDocumentos(conviventeId, { append: true });
    },
    documentosTemMais,
    totalDocumentos,
    documentoConsultaBnmp,
    documentoSensivelSelecionado,
    documentos,
    enviarPdfConsultaBnmp,
    fecharCamera,
    fotoPerfilData,
    handleExcluirDocumento,
    handleRemoverFotoPerfil,
    handleUploadDocumento,
    loadingDocs,
    resetarDocumentosProntuario,
    salvandoConsultaBnmp,
    setArquivoSelecionado,
    setDocumentoSensivelSelecionado,
    setTipoDocumentoSelecionado,
    tipoDocumentoSelecionado,
    videoRef,
  };
}
