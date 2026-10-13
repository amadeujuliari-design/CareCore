import { urlArquivoBackend } from './arquivosApi';
import { criarHeadersAutenticados } from './requestIdUtils';
import { obterTokenLocal } from '../services/api';
import {
  LIMIAR_FACIAL,
  classificarCorrespondenciaFacial,
} from './reconhecimentoFacialMatch';

const MODELOS_URL = '/modelos-faciais';
const cacheDescritores = new Map();

let modelosPromise = null;

async function obterFaceApi() {
  if (!modelosPromise) {
    modelosPromise = import('@vladmandic/face-api').then(async (faceapi) => {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELOS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELOS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELOS_URL),
      ]);
      return faceapi;
    }).catch((erro) => {
      modelosPromise = null;
      throw erro;
    });
  }
  return modelosPromise;
}

function opcoesDetector(faceapi) {
  return new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 });
}

async function descritorDeBlob(faceapi, blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await faceapi.fetchImage(url);
    const deteccao = await faceapi
      .detectSingleFace(img, opcoesDetector(faceapi))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return deteccao?.descriptor || null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function baixarFoto(fotoUrl) {
  const url = urlArquivoBackend(fotoUrl);
  if (!url) return null;
  const resposta = await fetch(url, {
    headers: criarHeadersAutenticados(obterTokenLocal()),
  });
  if (!resposta.ok) return null;
  return resposta.blob();
}

export async function prepararReferenciasFaciais(conviventes, { aoProgresso, cancelado } = {}) {
  const faceapi = await obterFaceApi();
  const comFoto = (conviventes || []).filter((item) => item?.id && item?.foto_url);
  const referencias = [];
  let prontas = 0;

  for (const convivente of comFoto) {
    if (cancelado?.()) break;
    const chave = String(convivente.foto_url);
    let descritor = cacheDescritores.get(chave);
    if (!descritor) {
      try {
        const blob = await baixarFoto(chave);
        descritor = blob ? await descritorDeBlob(faceapi, blob) : null;
        if (descritor) cacheDescritores.set(chave, descritor);
      } catch {
        descritor = null;
      }
    }
    if (descritor) {
      referencias.push({ id: String(convivente.id), descriptor: descritor });
    }
    prontas += 1;
    aoProgresso?.({ prontas, total: comFoto.length, uteis: referencias.length });
  }

  return referencias;
}

export function observarRostoNaCamera({
  video,
  referencias,
  aoReconhecer,
  intervaloMs = 800,
}) {
  let parado = false;
  let ocupado = false;
  let timer = 0;
  const lista = referencias || [];

  const analisar = async () => {
    if (parado || ocupado || !lista.length || video.readyState < 2) return;
    ocupado = true;
    try {
      const faceapi = await obterFaceApi();
      const deteccao = await faceapi
        .detectSingleFace(video, opcoesDetector(faceapi))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (parado || !deteccao) return;

      const comparador = new faceapi.FaceMatcher(
        lista.map((ref) => new faceapi.LabeledFaceDescriptors(ref.id, [ref.descriptor])),
        LIMIAR_FACIAL,
      );
      const melhor = comparador.findBestMatch(deteccao.descriptor);
      if (!melhor || melhor.label === 'unknown') return;
      const nivel = classificarCorrespondenciaFacial(melhor.distance);
      if (nivel === 'nenhuma') return;
      aoReconhecer?.({ conviventeId: melhor.label, nivel });
    } catch {
      // Um quadro ruim não interrompe a câmera do QR.
    } finally {
      ocupado = false;
    }
  };

  timer = window.setInterval(() => {
    analisar();
  }, intervaloMs);

  return () => {
    parado = true;
    window.clearInterval(timer);
  };
}
