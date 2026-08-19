import { PremiumBadge, PremiumButton } from './PremiumUI';
import { formatarEnderecoFornecedor, rotuloProjetosFornecedor } from '../utils/comprasFornecedorUtils';
import { formatarTelefoneCompras } from '../utils/comprasTelefoneUtils';
import { cnpjValido, formatarCNPJ } from '../utils/nfpCadastroUtils';
import { formatarCEP } from '../utils/usuariosUtils';

function ItemFicha({ label, valor, className = '' }) {
  const texto = valor != null && String(valor).trim() !== '' ? String(valor).trim() : '—';
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{texto}</p>
    </div>
  );
}

function statusFornecedor(fornecedor) {
  if (fornecedor.bloqueado) return <PremiumBadge variant="danger">Bloqueado</PremiumBadge>;
  if (fornecedor.ativo) return <PremiumBadge variant="success">Ativo</PremiumBadge>;
  return <PremiumBadge variant="warning">Inativo</PremiumBadge>;
}

export default function ModalFichaFornecedor({
  fornecedor,
  categoriaNome = '',
  onFechar,
  onEditar,
}) {
  if (!fornecedor) return null;

  const endereco = formatarEnderecoFornecedor(fornecedor);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-fornecedor-titulo"
      onClick={onFechar}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</p>
            <h2 id="ficha-fornecedor-titulo" className="mt-1 text-xl font-bold text-slate-900">
              {fornecedor.nome}
            </h2>
            <div className="mt-2">{statusFornecedor(fornecedor)}</div>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
            Identificação
          </p>
          <ItemFicha
            label="CNPJ"
            valor={fornecedor.cnpj && cnpjValido(fornecedor.cnpj) ? formatarCNPJ(fornecedor.cnpj) : fornecedor.cnpj}
          />
          <ItemFicha label="Categoria (cotação)" valor={categoriaNome} />
          <ItemFicha label="Segmento / tipo de serviço" valor={fornecedor.segmento} className="sm:col-span-2" />

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
            Contato
          </p>
          <ItemFicha label="Representante" valor={fornecedor.contato} />
          <ItemFicha
            label="Telefone"
            valor={fornecedor.telefone ? formatarTelefoneCompras(fornecedor.telefone) : ''}
          />
          <ItemFicha label="E-mail do representante" valor={fornecedor.email} />
          <ItemFicha label="E-mail da empresa" valor={fornecedor.email_empresa} />

          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
            Endereço
          </p>
          <ItemFicha
            label="CEP"
            valor={fornecedor.cep ? formatarCEP(fornecedor.cep) : ''}
          />
          <ItemFicha label="Logradouro" valor={fornecedor.logradouro} />
          <ItemFicha label="Número" valor={fornecedor.numero} />
          <ItemFicha label="Complemento" valor={fornecedor.complemento} />
          <ItemFicha label="Bairro" valor={fornecedor.bairro} />
          <ItemFicha label="Cidade" valor={fornecedor.cidade} />
          <ItemFicha label="UF" valor={fornecedor.uf} />
          {endereco && (
            <ItemFicha label="Endereço completo" valor={endereco} className="sm:col-span-2" />
          )}

          <ItemFicha
            label="Projetos atendidos"
            valor={rotuloProjetosFornecedor(fornecedor)}
            className="sm:col-span-2"
          />
          <ItemFicha label="Observações" valor={fornecedor.observacao} className="sm:col-span-2" />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <PremiumButton type="button" variant="secondary" onClick={onFechar}>
            Fechar
          </PremiumButton>
          <PremiumButton type="button" onClick={() => onEditar?.(fornecedor)}>
            Editar fornecedor
          </PremiumButton>
        </div>
      </div>
    </div>
  );
}
