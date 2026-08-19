import { CampoSelect, CampoTexto } from './UsuariosCampos';
import { PremiumButton } from './PremiumUI';
import {
  PATRIMONIO_ORIGEM,
  PATRIMONIO_PROPRIEDADE,
  PATRIMONIO_SITUACAO,
} from '../utils/comprasPatrimonioUtils';

export default function ModalFormPatrimonio({
  form,
  erros = {},
  salvando = false,
  sede = false,
  unidades = [],
  onAtualizar,
  onSalvar,
  onCancelar,
}) {
  const editando = Boolean(form?.id);
  const opcoesUnidade = unidades.map((u) => ({ value: u.id, label: u.nome }));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="form-patrimonio-titulo"
      onClick={onCancelar}
    >
      <form
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSalvar}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cadastro</p>
            <h2 id="form-patrimonio-titulo" className="mt-1 text-lg font-bold text-slate-900">
              {editando ? 'Editar bem' : 'Novo bem'}
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
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Vínculo</p>
            {sede ? (
              <div className="grid gap-3 md:grid-cols-2">
                <CampoSelect
                  label="Destino"
                  value={form.escopo_unidade}
                  onChange={(valor) => {
                    onAtualizar('escopo_unidade', valor);
                    if (valor === 'sede') onAtualizar('instituicao_id', '');
                  }}
                  options={[
                    { value: 'sede', label: 'Sede' },
                    { value: 'projeto', label: 'Unidade / projeto' },
                  ]}
                  placeholder="Selecione"
                  required
                />
                {form.escopo_unidade === 'projeto' && (
                  <CampoSelect
                    label="Projeto"
                    value={form.instituicao_id}
                    onChange={(valor) => onAtualizar('instituicao_id', valor)}
                    options={opcoesUnidade}
                    placeholder="Selecione o projeto"
                    required
                  />
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Este bem fica vinculado ao seu projeto.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Identificação</p>
            <div className="grid gap-3 md:grid-cols-2">
              <CampoTexto
                label="Descrição"
                value={form.descricao}
                onChange={(valor) => onAtualizar('descricao', valor)}
                required
                erro={erros.descricao}
                className="md:col-span-2"
              />
              <CampoTexto
                label="Nº da etiqueta"
                value={form.numero_etiqueta}
                onChange={(valor) => onAtualizar('numero_etiqueta', valor)}
              />
              <CampoTexto
                label="Localização"
                value={form.localizacao}
                onChange={(valor) => onAtualizar('localizacao', valor)}
                placeholder="Sala, ADM, cozinha…"
              />
              <CampoTexto
                label="Departamento"
                value={form.departamento}
                onChange={(valor) => onAtualizar('departamento', valor)}
              />
              <CampoSelect
                label="Propriedade"
                value={form.propriedade}
                onChange={(valor) => onAtualizar('propriedade', valor)}
                options={PATRIMONIO_PROPRIEDADE}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Aquisição e estado</p>
            <div className="grid gap-3 md:grid-cols-2">
              <CampoSelect
                label="Origem"
                value={form.origem}
                onChange={(valor) => onAtualizar('origem', valor)}
                options={PATRIMONIO_ORIGEM}
              />
              <CampoSelect
                label="Conservação"
                value={form.situacao}
                onChange={(valor) => onAtualizar('situacao', valor)}
                options={PATRIMONIO_SITUACAO}
              />
              <CampoTexto
                label="Data da aquisição"
                value={form.data_aquisicao}
                onChange={(valor) => onAtualizar('data_aquisicao', valor)}
                type="date"
              />
              <CampoTexto
                label="Documento (NF / recibo)"
                value={form.documento_nf}
                onChange={(valor) => onAtualizar('documento_nf', valor)}
              />
              <CampoTexto
                label="Valor (R$)"
                value={form.valor_reais}
                onChange={(valor) => onAtualizar('valor_reais', valor)}
                placeholder="0,00"
                erro={erros.valor_reais}
              />
              <CampoTexto
                label="Forma da aquisição"
                value={form.forma_aquisicao}
                onChange={(valor) => onAtualizar('forma_aquisicao', valor)}
                placeholder="Compra, doação, transferência…"
              />
              {form.situacao === 'baixado' && (
                <>
                  <CampoTexto
                    label="Data da baixa"
                    value={form.data_baixa}
                    onChange={(valor) => onAtualizar('data_baixa', valor)}
                    type="date"
                  />
                  <CampoTexto
                    label="Motivo da baixa"
                    value={form.motivo_baixa}
                    onChange={(valor) => onAtualizar('motivo_baixa', valor)}
                  />
                </>
              )}
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
            {salvando ? 'Salvando…' : (editando ? 'Salvar alterações' : 'Incluir bem')}
          </PremiumButton>
        </div>
      </form>
    </div>
  );
}
