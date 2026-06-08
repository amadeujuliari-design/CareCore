export default function ProntuarioSocial({ formData, handleChange }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Número NIS</label><input type="text" name="numero_nis" value={formData.numero_nis} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm" /></div>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Número SISA</label><input type="text" name="numero_sisa" value={formData.numero_sisa} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm" /></div>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Status CadÚnico</label><select name="status_cadunico" value={formData.status_cadunico} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none bg-white text-sm"><option value="">Selecione...</option><option value="Atualizado">Atualizado</option><option value="Desatualizado">Desatualizado</option><option value="Não Possui">Não Possui</option></select></div>
        <div className="md:col-span-3"><label className="block text-xs font-semibold text-gray-700 mb-1">Programas / Benefícios Ativos</label><textarea name="programas_beneficios" value={formData.programas_beneficios} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" placeholder="Ex: Bolsa Família, BPC..."></textarea></div>
        <div className="md:col-span-3 p-3 bg-green-50 rounded-lg border border-green-100 flex flex-col md:flex-row items-center gap-4"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="possui_renda" checked={formData.possui_renda} onChange={handleChange} className="w-4 h-4 text-brand rounded focus:ring-brand" /><span className="text-sm font-semibold text-green-900">Possui Renda Fixa/Mensal?</span></label>{formData.possui_renda && (<div className="flex-1 w-full"><label className="block text-[10px] font-bold text-green-800 uppercase mb-1">Valor da Renda (R$)</label><input type="number" name="renda_mensal" value={formData.renda_mensal} onChange={handleChange} className="w-full md:w-1/3 px-3 py-1.5 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-sm" placeholder="0.00" /></div>)}</div>
      </div>
    </div>
  );
}
