import { SUBSTANCIAS_PIA } from '../../config/piaFichaConfig';
import {
  SimNaoSelect,
  adicionarLista,
  atualizarLista,
  campoClasse,
  parseSimNao,
  removerLista,
} from './ProntuarioFamilia';

export default function ProntuarioSaude({
  formData,
  errosValidacao,
  handleChange,
  handleBlur,
  setFormData,
}) {
  const substanciasUsadas = (formData.substancias || []).map((s) => s.tipo).filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-brand border-b pb-2 mb-3">Emergência</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Contato de Emergência (Nome)</label><input type="text" name="contato_emergencia_nome" value={formData.contato_emergencia_nome} onChange={handleChange} className={campoClasse()} /></div>
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Telefone de Emergência</label><input type="text" name="contato_emergencia_telefone" value={formData.contato_emergencia_telefone} onChange={handleChange} onBlur={handleBlur} className={`${campoClasse()} ${errosValidacao.contato_emergencia_telefone ? 'border-red-500 bg-red-50' : ''}`} />{errosValidacao.contato_emergencia_telefone && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.contato_emergencia_telefone}</p>}</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-brand border-b pb-2">Saúde (PIA seção 6)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold mb-1">Histórico de doença na família?</label><SimNaoSelect name="saude_hist_familia" value={formData.saude_hist_familia} onChange={(e) => setFormData((p) => ({ ...p, saude_hist_familia: parseSimNao(e) }))} /></div>
          {formData.saude_hist_familia && <div><label className="block text-xs font-semibold mb-1">Qual?</label><input type="text" name="saude_hist_familia_qual" value={formData.saude_hist_familia_qual || ''} onChange={handleChange} className={campoClasse()} /></div>}
          <div><label className="block text-xs font-semibold mb-1">Problema de saúde atual?</label><SimNaoSelect name="saude_problema" value={formData.saude_problema} onChange={(e) => setFormData((p) => ({ ...p, saude_problema: parseSimNao(e) }))} /></div>
          {formData.saude_problema && <div><label className="block text-xs font-semibold mb-1">Qual?</label><input type="text" name="saude_problema_qual" value={formData.saude_problema_qual || ''} onChange={handleChange} className={campoClasse()} /></div>}
          <div><label className="block text-xs font-semibold mb-1">Possui laudo médico?</label><SimNaoSelect name="saude_laudo" value={formData.saude_laudo} onChange={(e) => setFormData((p) => ({ ...p, saude_laudo: parseSimNao(e) }))} /></div>
          {formData.saude_laudo && <div><label className="block text-xs font-semibold mb-1">CID</label><input type="text" name="saude_cid" value={formData.saude_cid || ''} onChange={handleChange} className={campoClasse()} /></div>}
          <div><label className="block text-xs font-semibold mb-1">Trata em outro equipamento?</label><SimNaoSelect name="saude_outro_equipamento" value={formData.saude_outro_equipamento} onChange={(e) => setFormData((p) => ({ ...p, saude_outro_equipamento: parseSimNao(e) }))} /></div>
          {formData.saude_outro_equipamento && <div><label className="block text-xs font-semibold mb-1">Onde?</label><input type="text" name="saude_outro_equipamento_onde" value={formData.saude_outro_equipamento_onde || ''} onChange={handleChange} className={campoClasse()} /></div>}
        </div>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Observações médicas gerais</label><textarea name="observacoes_saude" value={formData.observacoes_saude} onChange={handleChange} rows="2" className={campoClasse()} /></div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-800">Medicamentos de uso contínuo</h4><button type="button" onClick={() => adicionarLista(setFormData, 'medicamentos', { nome: '', tempo_uso: '', modo_uso: '' })} className="text-xs font-bold text-brand">+ Adicionar</button></div>
        {(formData.medicamentos || []).map((med, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border rounded-lg">
            <input type="text" placeholder="Medicamento" value={med.nome || ''} onChange={(e) => atualizarLista(setFormData, 'medicamentos', idx, 'nome', e.target.value)} className={campoClasse()} />
            <input type="text" placeholder="Há quanto tempo" value={med.tempo_uso || ''} onChange={(e) => atualizarLista(setFormData, 'medicamentos', idx, 'tempo_uso', e.target.value)} className={campoClasse()} />
            <input type="text" placeholder="Como utiliza" value={med.modo_uso || ''} onChange={(e) => atualizarLista(setFormData, 'medicamentos', idx, 'modo_uso', e.target.value)} className={campoClasse()} />
            <button type="button" onClick={() => removerLista(setFormData, 'medicamentos', idx)} className="text-xs font-bold text-red-600">Remover</button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-800">Internações / desintoxicação</h4><button type="button" onClick={() => adicionarLista(setFormData, 'internacoes', { onde: '', periodo: '', quem_encaminhou: '' })} className="text-xs font-bold text-brand">+ Adicionar</button></div>
        {(formData.internacoes || []).map((int, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border rounded-lg">
            <input type="text" placeholder="Onde" value={int.onde || ''} onChange={(e) => atualizarLista(setFormData, 'internacoes', idx, 'onde', e.target.value)} className={campoClasse()} />
            <input type="text" placeholder="Período" value={int.periodo || ''} onChange={(e) => atualizarLista(setFormData, 'internacoes', idx, 'periodo', e.target.value)} className={campoClasse()} />
            <input type="text" placeholder="Quem encaminhou" value={int.quem_encaminhou || ''} onChange={(e) => atualizarLista(setFormData, 'internacoes', idx, 'quem_encaminhou', e.target.value)} className={campoClasse()} />
            <button type="button" onClick={() => removerLista(setFormData, 'internacoes', idx)} className="text-xs font-bold text-red-600">Remover</button>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center"><h4 className="text-xs font-bold text-gray-800">Substâncias (cadastrou = faz uso)</h4><button type="button" onClick={() => adicionarLista(setFormData, 'substancias', { tipo: '', desde_quando: '', quantidade: '' })} className="text-xs font-bold text-brand">+ Adicionar substância</button></div>
        {(formData.substancias || []).map((sub, idx) => (
          <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2 p-3 border rounded-lg bg-amber-50/30">
            <select value={sub.tipo || ''} onChange={(e) => atualizarLista(setFormData, 'substancias', idx, 'tipo', e.target.value)} className={campoClasse()}>
              <option value="">Substância</option>
              {SUBSTANCIAS_PIA.filter((t) => !substanciasUsadas.includes(t) || t === sub.tipo).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="text" placeholder="Desde quando" value={sub.desde_quando || ''} onChange={(e) => atualizarLista(setFormData, 'substancias', idx, 'desde_quando', e.target.value)} className={campoClasse()} />
            <input type="text" placeholder="Quantidade" value={sub.quantidade || ''} onChange={(e) => atualizarLista(setFormData, 'substancias', idx, 'quantidade', e.target.value)} className={campoClasse()} />
            <button type="button" onClick={() => removerLista(setFormData, 'substancias', idx)} className="text-xs font-bold text-red-600">Remover</button>
          </div>
        ))}
      </div>
    </div>
  );
}
