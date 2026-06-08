export default function ProntuarioSaude({
  formData,
  errosValidacao,
  mostrarSenhaEmail,
  mostrarSenhaGovbr,
  setMostrarSenhaEmail,
  setMostrarSenhaGovbr,
  handleChange,
  handleBlur,
}) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-brand border-b pb-2 mb-3">Saúde & Emergência</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Contato de Emergência (Nome)</label><input type="text" name="contato_emergencia_nome" value={formData.contato_emergencia_nome} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm" /></div>
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Telefone de Emergência</label><input type="text" name="contato_emergencia_telefone" value={formData.contato_emergencia_telefone} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 border rounded-lg outline-none text-sm ${errosValidacao.contato_emergencia_telefone ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand'}`} placeholder="(00) 0000-0000" />{errosValidacao.contato_emergencia_telefone && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.contato_emergencia_telefone}</p>}</div>
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Observações Médicas</label><textarea name="observacoes_saude" value={formData.observacoes_saude} onChange={handleChange} rows="2" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm"></textarea></div>
        </div>
      </div>
      <div className="bg-gray-800 p-4 rounded-xl text-white shadow-inner">
        <h3 className="text-sm font-bold mb-3">Cofre de Senhas</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-xs text-gray-300 mb-1">E-mail Pessoal</label><input type="email" name="email_pessoal" value={formData.email_pessoal} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 bg-gray-700 border rounded-lg text-white text-sm outline-none ${errosValidacao.email_pessoal ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-brand'}`} placeholder="usuario@email.com" />{errosValidacao.email_pessoal && <p className="text-red-400 text-[10px] mt-0.5 font-bold">{errosValidacao.email_pessoal}</p>}</div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Senha E-mail</label>
            <div className="flex gap-2">
              <input type={mostrarSenhaEmail ? 'text' : 'password'} autoComplete="new-password" name="senha_email" value={formData.senha_email} onChange={handleChange} className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm" />
              <button type="button" onClick={() => setMostrarSenhaEmail(v => !v)} className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-xs font-bold text-gray-200 hover:bg-gray-600" title={mostrarSenhaEmail ? 'Ocultar senha' : 'Mostrar senha'}>{mostrarSenhaEmail ? 'Ocultar' : 'Mostrar'}</button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-blue-300 font-bold mb-1">Senha GOV.BR</label>
            <div className="flex gap-2">
              <input type={mostrarSenhaGovbr ? 'text' : 'password'} autoComplete="new-password" name="senha_govbr" value={formData.senha_govbr} onChange={handleChange} className="w-full px-3 py-1.5 bg-gray-700 border border-blue-500/50 rounded-lg text-white text-sm" />
              <button type="button" onClick={() => setMostrarSenhaGovbr(v => !v)} className="px-3 py-1.5 bg-gray-700 border border-blue-500/50 rounded-lg text-xs font-bold text-blue-100 hover:bg-gray-600" title={mostrarSenhaGovbr ? 'Ocultar senha' : 'Mostrar senha'}>{mostrarSenhaGovbr ? 'Ocultar' : 'Mostrar'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
