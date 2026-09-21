import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

import { PremiumButton } from './PremiumUI';
import { comprasBaixarAnexo, comprasAbrirAnexoBlob } from '../services/comprasService';

/**
 * Modal para pré-visualizar anexo (PDF/imagem) sem baixar.
 * Outros tipos oferecem só o download.
 */
export default function ModalVisualizarAnexoCompras({
  aberto,
  pedidoId,
  anexo,
  onFechar,
  onErro,
}) {
  const [url, setUrl] = useState('');
  const [contentType, setContentType] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!aberto || !pedidoId || !anexo?.id) return undefined;
    let alive = true;
    let objectUrl = '';
    (async () => {
      setCarregando(true);
      setUrl('');
      setContentType('');
      setAviso('');
      try {
        const dados = await comprasAbrirAnexoBlob(pedidoId, anexo.id);
        if (!alive) {
          URL.revokeObjectURL(dados.url);
          return;
        }
        objectUrl = dados.url;
        setUrl(dados.url);
        setContentType(dados.contentType || '');
        const tipo = (dados.contentType || '').toLowerCase();
        const nome = anexo.nome_arquivo || '';
        const ehPdf = tipo.includes('pdf') || /\.pdf$/i.test(nome);
        // Stub pypdf ~500B = página em branco; avisa em vez de “tela vazia”.
        if (ehPdf && Number(dados.tamanho || 0) > 0 && Number(dados.tamanho) < 1200) {
          setAviso(
            'Este PDF parece vazio ou incompleto (arquivo muito pequeno). '
            + 'Use Baixar para conferir, ou anexe novamente o arquivo original.',
          );
        }
      } catch (err) {
        if (alive) onErro?.(err?.message || 'Não foi possível abrir o arquivo.');
      } finally {
        if (alive) setCarregando(false);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [aberto, pedidoId, anexo?.id]);

  if (!aberto || !anexo) return null;

  const tipo = (contentType || anexo.content_type || '').toLowerCase();
  const nome = anexo.nome_arquivo || 'anexo';
  const ehPdf = tipo.includes('pdf') || /\.pdf$/i.test(nome);
  const ehImagem = tipo.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(nome);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{nome}</p>
            <p className="text-xs text-slate-500">Pré-visualização — o arquivo não é baixado automaticamente</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <PremiumButton
              type="button"
              variant="secondary"
              onClick={() => comprasBaixarAnexo(pedidoId, anexo.id, nome).catch(() => onErro?.('Não foi possível baixar.'))}
            >
              Baixar
            </PremiumButton>
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar"
              onClick={onFechar}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="min-h-[50vh] flex-1 bg-slate-50 p-2">
          {carregando ? (
            <p className="p-8 text-center text-sm text-slate-500">Carregando…</p>
          ) : !url ? (
            <p className="p-8 text-center text-sm text-slate-500">Não foi possível pré-visualizar.</p>
          ) : (
            <>
              {aviso ? (
                <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {aviso}
                </p>
              ) : null}
              {ehPdf ? (
                <iframe title={nome} src={`${url}#toolbar=1`} className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white" />
              ) : ehImagem ? (
                <div className="flex max-h-[70vh] items-center justify-center overflow-auto p-4">
                  <img src={url} alt={nome} className="max-h-[68vh] max-w-full object-contain" />
                </div>
              ) : (
                <div className="space-y-3 p-8 text-center text-sm text-slate-600">
                  <p>Este tipo de arquivo não tem pré-visualização no navegador.</p>
                  <PremiumButton
                    type="button"
                    onClick={() => comprasBaixarAnexo(pedidoId, anexo.id, nome).catch(() => onErro?.('Não foi possível baixar.'))}
                  >
                    Baixar arquivo
                  </PremiumButton>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
