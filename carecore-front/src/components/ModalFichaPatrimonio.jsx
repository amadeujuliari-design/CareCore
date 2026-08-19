import { PremiumBadge, PremiumButton } from './PremiumUI';
import {
  PATRIMONIO_ORIGEM,
  PATRIMONIO_PROPRIEDADE,
  PATRIMONIO_SITUACAO,
  rotuloOpcao,
} from '../utils/comprasPatrimonioUtils';
import { moneyCentavos } from '../services/comprasService';

function ItemFicha({ label, valor, className = '' }) {
  const texto = valor != null && String(valor).trim() !== '' ? String(valor).trim() : '—';
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{texto}</p>
    </div>
  );
}

function badgeSituacao(situacao) {
  if (situacao === 'baixado') return <PremiumBadge variant="danger">Baixado</PremiumBadge>;
  if (situacao === 'ruim') return <PremiumBadge variant="warning">Ruim</PremiumBadge>;
  if (situacao === 'manutencao') return <PremiumBadge variant="warning">Manutenção</PremiumBadge>;
  if (situacao === 'regular') return <PremiumBadge variant="info">Regular</PremiumBadge>;
  return <PremiumBadge variant="success">Bom</PremiumBadge>;
}

export default function ModalFichaPatrimonio({ item, onFechar, onEditar }) {
  if (!item) return null;
  const dataBr = (iso) => {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return d && m && a ? `${d}/${m}/${a}` : iso;
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-patrimonio-titulo"
      onClick={onFechar}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patrimônio</p>
            <h2 id="ficha-patrimonio-titulo" className="mt-1 text-xl font-bold text-slate-900">
              {item.descricao}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {badgeSituacao(item.situacao)}
              <PremiumBadge variant={item.propriedade === 'publico' ? 'info' : 'purple'}>
                {rotuloOpcao(PATRIMONIO_PROPRIEDADE, item.propriedade)}
              </PremiumBadge>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ItemFicha label="Unidade / Sede" valor={item.instituicao_nome} />
          <ItemFicha label="Nº da etiqueta" valor={item.numero_etiqueta} />
          <ItemFicha label="Localização" valor={item.localizacao} />
          <ItemFicha label="Departamento" valor={item.departamento} />
          <ItemFicha label="Origem" valor={rotuloOpcao(PATRIMONIO_ORIGEM, item.origem)} />
          <ItemFicha label="Conservação" valor={rotuloOpcao(PATRIMONIO_SITUACAO, item.situacao)} />
          <ItemFicha label="Data da aquisição" valor={dataBr(item.data_aquisicao)} />
          <ItemFicha label="Documento" valor={item.documento_nf} />
          <ItemFicha
            label="Valor"
            valor={item.valor_centavos != null ? moneyCentavos(item.valor_centavos) : ''}
          />
          <ItemFicha label="Forma da aquisição" valor={item.forma_aquisicao} />
          <ItemFicha label="Data da baixa" valor={dataBr(item.data_baixa)} />
          <ItemFicha label="Motivo da baixa" valor={item.motivo_baixa} />
          <ItemFicha label="Observações" valor={item.observacao} className="sm:col-span-2" />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <PremiumButton type="button" variant="secondary" onClick={onFechar}>
            Fechar
          </PremiumButton>
          <PremiumButton type="button" onClick={() => onEditar?.(item)}>
            Editar bem
          </PremiumButton>
        </div>
      </div>
    </div>
  );
}
