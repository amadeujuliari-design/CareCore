import { ChevronDown, ChevronRight, FileText, Files } from 'lucide-react';

import { PremiumButton } from './PremiumUI';
import { moneyCentavos, comprasBaixarAnexo } from '../services/comprasService';
import {
  agruparDocumentosAnexadosPedido,
  rotuloClasseDocumentoAnexado,
} from '../utils/comprasDocumentosAnexadosUtils';

function rotuloItem(item) {
  if (item.classe === 'nota_fiscal') {
    const tipo = item.tipoNf === 'servico' ? 'Serviço' : item.tipoNf === 'outro' ? 'Outro' : 'Nota fiscal';
    return [
      tipo,
      item.numero ? `NF ${item.numero}` : 'sem número',
      item.valor_centavos != null ? moneyCentavos(item.valor_centavos) : null,
    ].filter(Boolean).join(' · ');
  }
  return rotuloClasseDocumentoAnexado(item.classe);
}

export default function ComprasDocumentosAnexados({
  pedido,
  aberto,
  onToggle,
  podeExcluir,
  onVisualizar,
  onExcluirNf,
  onExcluirAnexo,
  onErro,
}) {
  const grupos = agruparDocumentosAnexadosPedido(pedido);
  const total = grupos.reduce((n, grupo) => n + grupo.itens.length, 0);
  if (!total) return null;

  const baixar = (item) => {
    if (!item.anexoId) return;
    comprasBaixarAnexo(
      pedido.id,
      item.anexoId,
      item.nomeArquivo || `${item.classe}-${item.anexoId}`,
    ).catch(() => onErro?.('Não foi possível baixar o arquivo.'));
  };

  return (
    <section>
      <PremiumButton
        type="button"
        variant="primary"
        onClick={onToggle}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-base font-black shadow-md"
      >
        <span className="inline-flex min-w-0 items-center gap-2.5">
          <Files className="h-5 w-5 shrink-0" aria-hidden />
          Documentos anexados
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold tabular-nums">
            {total === 1 ? '1 arquivo' : `${total} arquivos`}
          </span>
        </span>
        {aberto ? (
          <ChevronDown className="h-5 w-5 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
        )}
      </PremiumButton>
      {aberto ? (
        <div className="mt-2 space-y-4 rounded-2xl border-2 border-slate-900 bg-white px-4 py-3 shadow-md">
          {grupos.map((grupo) => (
            <div key={grupo.chave}>
              {grupo.titulo ? (
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {grupo.titulo}
                </p>
              ) : null}
              <ul className="space-y-2">
                {grupo.itens.map((item) => (
                  <li
                    key={item.key}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{rotuloItem(item)}</p>
                      <p className="truncate text-xs text-slate-500">
                        {item.nomeArquivo}
                        {item.xml ? ' · importado do XML' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {item.anexo ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50"
                          onClick={() => onVisualizar(item.anexo)}
                        >
                          Visualizar
                        </button>
                      ) : null}
                      {item.anexoId ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-900"
                          onClick={() => baixar(item)}
                        >
                          <FileText size={14} />
                          {item.classe === 'nota_fiscal' ? 'Baixar NF' : 'Baixar'}
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-slate-400">Sem arquivo</span>
                      )}
                      {podeExcluir && (item.notaId || item.anexoId) ? (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                          onClick={() => {
                            const nome = item.nomeArquivo || rotuloItem(item);
                            if (!window.confirm(`Excluir "${nome}"?`)) return;
                            if (item.exclusao === 'nota' && item.notaId) onExcluirNf(item.notaId);
                            else if (item.anexoId) onExcluirAnexo(item.anexoId);
                          }}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
