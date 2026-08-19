import NfpEnderecoFields from './nfp/NfpEnderecoFields';
import { CampoSelect, CampoTexto } from './UsuariosCampos';
import { PremiumButton } from './PremiumUI';
import { formatarTelefoneInputCompras, telefoneComprasValido } from '../utils/comprasTelefoneUtils';
import { formatarCNPJ } from '../utils/nfpCadastroUtils';
import { rotuloCategoria } from '../utils/comprasCategoriaUtils';

export default function ModalFormFornecedor({
  form,
  erros = {},
  salvando = false,
  categorias = [],
  unidades = [],
  onAtualizar,
  onErroChange,
  onAlternarGeral,
  onAlternarProjeto,
  onSalvar,
  onCancelar,
}) {
  const editando = Boolean(form?.id);
  const opcoesCategoria = categorias.map((c) => ({ value: c.id, label: rotuloCategoria(c) }));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-fornecedor-titulo"
      onClick={onCancelar}
    >
      <form
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSalvar}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cadastro
            </p>
            <h2 id="form-fornecedor-titulo" className="mt-1 text-lg font-bold text-slate-900">
              {editando ? 'Editar fornecedor' : 'Novo fornecedor'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Identificação
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <CampoTexto
                label="Nome / razão social"
                value={form.nome}
                onChange={(valor) => onAtualizar('nome', valor)}
                required
                erro={erros.nome}
                className="md:col-span-2"
              />
              <CampoTexto
                label="CNPJ"
                value={form.cnpj}
                onChange={(valor) => onAtualizar('cnpj', formatarCNPJ(valor))}
                erro={erros.cnpj}
                placeholder="00.000.000/0000-00"
              />
              <CampoSelect
                label="Categoria (cotação)"
                value={form.categoria_id}
                onChange={(valor) => onAtualizar('categoria_id', valor)}
                options={opcoesCategoria}
                placeholder="Opcional"
              />
              <CampoTexto
                label="Segmento / tipo de serviço"
                value={form.segmento}
                onChange={(valor) => onAtualizar('segmento', valor)}
                placeholder="Ex.: Alimentação seca, Material elétrico"
                className="md:col-span-2"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Contato
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <CampoTexto
                label="Representante"
                value={form.contato}
                onChange={(valor) => onAtualizar('contato', valor)}
                placeholder="Nome da pessoa de contato"
              />
              <CampoTexto
                label="Telefone"
                value={form.telefone}
                onChange={(valor) => onAtualizar('telefone', formatarTelefoneInputCompras(valor))}
                onBlur={() => {
                  if (form.telefone && !telefoneComprasValido(form.telefone)) {
                    onErroChange('telefone', 'Telefone inválido.');
                  }
                }}
                erro={erros.telefone}
                placeholder="(11) 99999-9999"
              />
              <CampoTexto
                label="E-mail do representante"
                value={form.email}
                onChange={(valor) => onAtualizar('email', valor)}
                type="email"
                erro={erros.email}
              />
              <CampoTexto
                label="E-mail da empresa"
                value={form.email_empresa}
                onChange={(valor) => onAtualizar('email_empresa', valor)}
                type="email"
                erro={erros.email_empresa}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <NfpEnderecoFields
              form={form}
              erros={erros}
              onChange={onAtualizar}
              onErroChange={onErroChange}
            />
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Projetos e status
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <p className="mb-2 text-sm font-medium text-slate-700">Projetos atendidos</p>
                <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    checked={Boolean(form.atende_geral)}
                    onChange={(e) => onAlternarGeral(e.target.checked)}
                  />
                  <span className="text-sm text-slate-800">
                    <strong>GERAL</strong> — atende toda a organização (qualquer unidade pode cotar)
                  </span>
                </label>
                {!form.atende_geral && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    {unidades.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Nenhum projeto cadastrado. Use GERAL ou cadastre unidades em Organização.
                      </p>
                    ) : (
                      <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                        {unidades.map((unidade) => (
                          <label
                            key={unidade.id}
                            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-violet-200"
                          >
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                              checked={form.projeto_ids.includes(unidade.id)}
                              onChange={() => onAlternarProjeto(unidade.id)}
                            />
                            <span>{unidade.nome}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {erros.projeto_ids && (
                  <p className="mt-1 text-xs text-red-600">{erros.projeto_ids}</p>
                )}
              </div>
              <CampoSelect
                label="Status"
                value={form.bloqueado ? 'bloqueado' : (form.ativo ? 'ativo' : 'inativo')}
                onChange={(valor) => {
                  if (valor === 'bloqueado') {
                    onAtualizar('bloqueado', true);
                    onAtualizar('ativo', false);
                    return;
                  }
                  onAtualizar('bloqueado', false);
                  onAtualizar('ativo', valor === 'ativo');
                }}
                options={[
                  { value: 'ativo', label: 'Ativo' },
                  { value: 'inativo', label: 'Inativo' },
                  { value: 'bloqueado', label: 'Bloqueado' },
                ]}
              />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Observações</label>
                <textarea
                  value={form.observacao}
                  onChange={(e) => onAtualizar('observacao', e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <PremiumButton type="button" variant="secondary" onClick={onCancelar}>
            Cancelar
          </PremiumButton>
          <PremiumButton type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : (editando ? 'Salvar alterações' : 'Incluir fornecedor')}
          </PremiumButton>
        </div>
      </form>
    </div>
  );
}
