import {
  BENEFICIOS_PIA_OPCOES,
  EQUIPAMENTO_ANTERIOR_OUTROS,
  SITUACOES_TRABALHO_PIA,
  TIPOS_DOCUMENTO_CIVIL,
} from '../../config/piaFichaConfig';
import {
  SimNaoSelect,
  adicionarLista,
  atualizarLista,
  campoClasse,
  parseSimNao,
  removerLista,
  toggleArrayItem,
} from './ProntuarioFamilia';

function valorSelectEquipamento(item = {}) {
  if (item.origem_encaminhamento_id === EQUIPAMENTO_ANTERIOR_OUTROS) return EQUIPAMENTO_ANTERIOR_OUTROS;
  if (item.origem_encaminhamento_id) return item.origem_encaminhamento_id;
  if ((item.descricao_outros || '').trim()) return EQUIPAMENTO_ANTERIOR_OUTROS;
  return '';
}

function alterarEquipamentoAnterior(setFormData, idx, valor) {
  if (valor === EQUIPAMENTO_ANTERIOR_OUTROS) {
    setFormData((prev) => {
      const lista = [...(prev.equipamentos_anteriores || [])];
      lista[idx] = {
        ...lista[idx],
        origem_encaminhamento_id: EQUIPAMENTO_ANTERIOR_OUTROS,
        descricao_outros: lista[idx]?.descricao_outros || '',
      };
      return { ...prev, equipamentos_anteriores: lista };
    });
    return;
  }

  setFormData((prev) => {
    const lista = [...(prev.equipamentos_anteriores || [])];
    lista[idx] = {
      ...lista[idx],
      origem_encaminhamento_id: valor,
      descricao_outros: '',
    };
    return { ...prev, equipamentos_anteriores: lista };
  });
}

export default function ProntuarioSocial({
  formData,
  handleChange,
  setFormData,
  origensEncaminhamento = [],
}) {
  const tiposDocumentoUsados = (formData.documentos_civis || []).map((d) => d.tipo).filter(Boolean);

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-brand border-b pb-2">Cadastro social (NIS / SISA / CadÚnico)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Número NIS</label><input type="text" name="numero_nis" value={formData.numero_nis} onChange={handleChange} className={campoClasse()} /></div>
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Número SISA</label><input type="text" name="numero_sisa" value={formData.numero_sisa} onChange={handleChange} className={campoClasse()} /></div>
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Status CadÚnico</label><select name="status_cadunico" value={formData.status_cadunico} onChange={handleChange} className={campoClasse()}><option value="">Selecione...</option><option value="Atualizado">Atualizado</option><option value="Desatualizado">Desatualizado</option><option value="Não Possui">Não Possui</option></select></div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-bold text-brand border-b pb-2">Situação escolar (PIA seção 3)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Alfabetizado?</label><SimNaoSelect name="alfabetizado" value={formData.alfabetizado} onChange={(e) => setFormData((p) => ({ ...p, alfabetizado: parseSimNao(e) }))} /></div>
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Interesse em EJA?</label><SimNaoSelect name="interesse_eja" value={formData.interesse_eja} onChange={(e) => setFormData((p) => ({ ...p, interesse_eja: parseSimNao(e) }))} /></div>
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Estuda atualmente?</label><SimNaoSelect name="estuda_atualmente" value={formData.estuda_atualmente} onChange={(e) => setFormData((p) => ({ ...p, estuda_atualmente: parseSimNao(e) }))} /></div>
        </div>
        {formData.estuda_atualmente && (
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Curso atual</label><input type="text" name="estuda_curso" value={formData.estuda_curso || ''} onChange={handleChange} className={campoClasse()} /></div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 p-3 border rounded-lg"><p className="text-xs font-bold">Ensino Fundamental</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={formData.ef_concluido || false} onChange={(e) => setFormData((p) => ({ ...p, ef_concluido: e.target.checked, ef_incompleto: e.target.checked ? false : p.ef_incompleto }))} /> Concluído</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={formData.ef_incompleto || false} onChange={(e) => setFormData((p) => ({ ...p, ef_incompleto: e.target.checked, ef_concluido: e.target.checked ? false : p.ef_concluido }))} /> Incompleto</label>{formData.ef_incompleto && <input type="text" placeholder="Qual série" value={formData.ef_incompleto_serie || ''} onChange={(e) => setFormData((p) => ({ ...p, ef_incompleto_serie: e.target.value }))} className={campoClasse()} />}</div>
          <div className="space-y-2 p-3 border rounded-lg"><p className="text-xs font-bold">Ensino Médio</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={formData.em_concluido || false} onChange={(e) => setFormData((p) => ({ ...p, em_concluido: e.target.checked, em_incompleto: e.target.checked ? false : p.em_incompleto }))} /> Concluído</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={formData.em_incompleto || false} onChange={(e) => setFormData((p) => ({ ...p, em_incompleto: e.target.checked, em_concluido: e.target.checked ? false : p.em_concluido }))} /> Incompleto</label>{formData.em_incompleto && <input type="text" placeholder="Qual série" value={formData.em_incompleto_serie || ''} onChange={(e) => setFormData((p) => ({ ...p, em_incompleto_serie: e.target.value }))} className={campoClasse()} />}</div>
          <div className="space-y-2 p-3 border rounded-lg"><p className="text-xs font-bold">Ensino Superior</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={formData.es_concluido || false} onChange={(e) => setFormData((p) => ({ ...p, es_concluido: e.target.checked, es_incompleto: e.target.checked ? false : p.es_incompleto }))} /> Concluído</label><label className="flex gap-2 text-sm"><input type="checkbox" checked={formData.es_incompleto || false} onChange={(e) => setFormData((p) => ({ ...p, es_incompleto: e.target.checked, es_concluido: e.target.checked ? false : p.es_concluido }))} /> Incompleto</label>{formData.es_incompleto && <input type="text" placeholder="Qual período" value={formData.es_incompleto_periodo || ''} onChange={(e) => setFormData((p) => ({ ...p, es_incompleto_periodo: e.target.value }))} className={campoClasse()} />}</div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-bold text-brand border-b pb-2">Trabalho e benefícios (PIA seção 4)</h3>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Profissão</label><input type="text" name="profissao" value={formData.profissao || ''} onChange={handleChange} className={campoClasse()} /></div>
        <div className="flex flex-wrap gap-2">
          {SITUACOES_TRABALHO_PIA.map((item) => (
            <label key={item} className="flex items-center gap-1 text-xs border rounded-lg px-2 py-1 bg-white">
              <input type="checkbox" checked={(formData.situacoes_trabalho || []).includes(item)} onChange={() => toggleArrayItem(setFormData, 'situacoes_trabalho', item)} />
              {item}
            </label>
          ))}
        </div>
        {(formData.situacoes_trabalho || []).includes('Exerce atividade não remunerada') && (
          <input type="text" name="trabalho_nao_remunerada_qual" value={formData.trabalho_nao_remunerada_qual || ''} onChange={handleChange} placeholder="Qual atividade não remunerada?" className={campoClasse()} />
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs font-semibold mb-1">Já participou de curso?</label><SimNaoSelect name="trabalho_cursos_participou" value={formData.trabalho_cursos_participou} onChange={(e) => setFormData((p) => ({ ...p, trabalho_cursos_participou: parseSimNao(e) }))} /></div>
          <div><label className="block text-xs font-semibold mb-1">Tem certificados?</label><SimNaoSelect name="trabalho_certificados" value={formData.trabalho_certificados} onChange={(e) => setFormData((p) => ({ ...p, trabalho_certificados: parseSimNao(e) }))} /></div>
          <div><label className="block text-xs font-semibold mb-1">Pretende fazer curso?</label><SimNaoSelect name="trabalho_pretende_curso" value={formData.trabalho_pretende_curso} onChange={(e) => setFormData((p) => ({ ...p, trabalho_pretende_curso: parseSimNao(e) }))} /></div>
        </div>
        {formData.trabalho_cursos_participou && <textarea name="trabalho_cursos_quais" value={formData.trabalho_cursos_quais || ''} onChange={handleChange} rows="2" placeholder="Quais cursos?" className={campoClasse()} />}
        {formData.trabalho_certificados && <textarea name="trabalho_certificados_quais" value={formData.trabalho_certificados_quais || ''} onChange={handleChange} rows="2" placeholder="Quais certificados?" className={campoClasse()} />}
        {formData.trabalho_pretende_curso && <textarea name="trabalho_pretende_curso_quais" value={formData.trabalho_pretende_curso_quais || ''} onChange={handleChange} rows="2" placeholder="Quais cursos pretende?" className={campoClasse()} />}

        <div className="rounded-xl border border-green-100 bg-green-50/50 p-4 space-y-3">
          <p className="text-xs font-bold text-green-900">Benefícios</p>
          {BENEFICIOS_PIA_OPCOES.map((opt) => {
            const ativo = Boolean(formData.beneficios_pia?.[opt.key]?.ativo);
            return (
              <div key={opt.key} className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ativo}
                    onChange={(e) => setFormData((p) => ({
                      ...p,
                      beneficios_pia: {
                        ...(p.beneficios_pia || {}),
                        [opt.key]: { ...(p.beneficios_pia?.[opt.key] || {}), ativo: e.target.checked },
                      },
                    }))}
                  />
                  {opt.label}
                </label>
                {ativo && opt.temValor && (
                  <input
                    type="number"
                    placeholder="R$"
                    value={formData.beneficios_pia?.[opt.key]?.valor || ''}
                    onChange={(e) => setFormData((p) => ({
                      ...p,
                      beneficios_pia: {
                        ...(p.beneficios_pia || {}),
                        [opt.key]: { ...(p.beneficios_pia?.[opt.key] || {}), ativo: true, valor: e.target.value },
                      },
                    }))}
                    className="w-32 px-2 py-1 border rounded text-sm"
                  />
                )}
                {ativo && opt.temTexto && (
                  <input
                    type="text"
                    placeholder="Qual(is)?"
                    value={formData.beneficios_pia?.[opt.key]?.texto || ''}
                    onChange={(e) => setFormData((p) => ({
                      ...p,
                      beneficios_pia: {
                        ...(p.beneficios_pia || {}),
                        [opt.key]: { ...(p.beneficios_pia?.[opt.key] || {}), ativo: true, texto: e.target.value },
                      },
                    }))}
                    className={`flex-1 ${campoClasse()}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-green-50 rounded-lg border border-green-100 flex flex-col md:flex-row items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="possui_renda" checked={formData.possui_renda} onChange={handleChange} className="w-4 h-4 text-brand rounded" /><span className="text-sm font-semibold text-green-900">Possui Renda Fixa/Mensal?</span></label>
          {formData.possui_renda && (<div className="flex-1 w-full"><label className="block text-[10px] font-bold text-green-800 uppercase mb-1">Valor da Renda (R$)</label><input type="number" name="renda_mensal" value={formData.renda_mensal} onChange={handleChange} className="w-full md:w-1/3 px-3 py-1.5 border border-green-300 rounded-lg text-sm" /></div>)}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-brand border-b pb-2 flex-1">Documentação civil (PIA seção 5)</h3><button type="button" onClick={() => adicionarLista(setFormData, 'documentos_civis', { tipo: '', numero: '', orientacoes: '' })} className="text-xs font-bold text-brand">+ Adicionar documento</button></div>
        {(formData.documentos_civis || []).map((doc, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border rounded-lg bg-white">
            <select value={doc.tipo || ''} onChange={(e) => atualizarLista(setFormData, 'documentos_civis', idx, 'tipo', e.target.value)} className={campoClasse()}>
              <option value="">Tipo</option>
              {TIPOS_DOCUMENTO_CIVIL.filter((t) => t === 'Outros' || !tiposDocumentoUsados.includes(t) || t === doc.tipo).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" placeholder="Número" value={doc.numero || ''} onChange={(e) => atualizarLista(setFormData, 'documentos_civis', idx, 'numero', e.target.value)} className={campoClasse()} />
            <input type="text" placeholder="Orientações / encaminhamento" value={doc.orientacoes || ''} onChange={(e) => atualizarLista(setFormData, 'documentos_civis', idx, 'orientacoes', e.target.value)} className={`md:col-span-2 ${campoClasse()}`} />
            <button type="button" onClick={() => removerLista(setFormData, 'documentos_civis', idx)} className="text-xs font-bold text-red-600">Remover</button>
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-bold text-brand border-b pb-2">Vida na rua / trajetória (PIA seção 7)</h3>
        <div><label className="block text-xs font-semibold mb-1">Em situação de via pública desde</label><input type="text" name="rua_desde" value={formData.rua_desde || ''} onChange={handleChange} className={campoClasse()} /></div>
        <div><label className="block text-xs font-semibold mb-1">Relato (como veio parar na rua)</label><textarea name="rua_relato" value={formData.rua_relato || ''} onChange={handleChange} rows="4" className={campoClasse()} /></div>
        <div className="space-y-2">
          <div className="flex justify-between items-center"><p className="text-xs font-bold">Centros / projetos anteriores</p><button type="button" onClick={() => adicionarLista(setFormData, 'equipamentos_anteriores', { origem_encaminhamento_id: '', descricao_outros: '' })} className="text-xs font-bold text-brand">+ Adicionar</button></div>
          {(formData.equipamentos_anteriores || []).map((eq, idx) => {
            const selecionado = valorSelectEquipamento(eq);
            const ehOutros = selecionado === EQUIPAMENTO_ANTERIOR_OUTROS;
            return (
              <div key={idx} className="flex flex-wrap gap-2 items-start p-3 border border-gray-200 rounded-lg bg-white">
                <select
                  value={selecionado}
                  onChange={(e) => alterarEquipamentoAnterior(setFormData, idx, e.target.value)}
                  className={`min-w-[220px] flex-1 ${campoClasse()}`}
                >
                  <option value="">Selecione equipamento</option>
                  {(origensEncaminhamento || []).map((o) => (
                    <option key={o.id} value={o.id}>{o.descricao}</option>
                  ))}
                  <option value={EQUIPAMENTO_ANTERIOR_OUTROS}>Outros</option>
                </select>
                {ehOutros && (
                  <input
                    type="text"
                    placeholder="Informe qual equipamento / centro"
                    value={eq.descricao_outros || ''}
                    onChange={(e) => atualizarLista(setFormData, 'equipamentos_anteriores', idx, 'descricao_outros', e.target.value)}
                    className={`min-w-[220px] flex-1 ${campoClasse()}`}
                  />
                )}
                <button type="button" onClick={() => removerLista(setFormData, 'equipamentos_anteriores', idx)} className="text-xs font-bold text-red-600 pt-2">Remover</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
