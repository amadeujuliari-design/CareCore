import { PremiumBadge, PremiumButton } from './PremiumUI';
import {
  rotuloCompetenciaOrcamento,
  rotuloSegmentoCatalogo,
} from '../utils/comprasPedidoTipos';

function ItemFicha({ label, valor, className = '' }) {
  const texto = valor != null && String(valor).trim() !== '' ? String(valor).trim() : '—';
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{texto}</p>
    </div>
  );
}

export default function ModalFichaItemConsumo({ item, onFechar, onEditar }) {
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-item-consumo-titulo"
      onClick={onFechar}
    >
      <div
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catálogo de itens</p>
            <h2 id="ficha-item-consumo-titulo" className="mt-1 text-xl font-bold text-slate-900">
              {item.descricao}
            </h2>
            <div className="mt-2">
              {item.ativo
                ? <PremiumBadge variant="success">Ativo</PremiumBadge>
                : <PremiumBadge variant="warning">Inativo</PremiumBadge>}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onFechar}
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ItemFicha label="Categoria" valor={item.categoria_nome} />
          <ItemFicha label="Uso no pedido" valor={rotuloSegmentoCatalogo(item.segmento)} />
          <ItemFicha label="Competência" valor={rotuloCompetenciaOrcamento(item.competencia_orcamento)} />
          <ItemFicha label="Unidade de medida" valor={item.unidade_medida} />
          <ItemFicha label="Embalagem" valor={item.embalagem} className="sm:col-span-2" />
          <ItemFicha label="Quantidade na embalagem" valor={item.fator_embalagem} />
          <ItemFicha label="Perecível" valor={item.perecivel ? 'Sim' : 'Não'} />
          <ItemFicha label="Sinônimos" valor={item.sinonimos} className="sm:col-span-2" />
          <ItemFicha label="Marca preferencial" valor={item.marca_preferencial} className="sm:col-span-2" />
          <ItemFicha label="Observação" valor={item.observacao} className="sm:col-span-2" />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <PremiumButton type="button" variant="secondary" onClick={onFechar}>
            Fechar
          </PremiumButton>
          {onEditar ? (
            <PremiumButton type="button" onClick={() => onEditar(item)}>
              Editar item
            </PremiumButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
