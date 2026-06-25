import AuthenticatedImage from '../AuthenticatedImage';
import ProntuarioFamilia from './ProntuarioFamilia';
import { EQUIPAMENTO_ANTERIOR_OUTROS } from '../../config/piaFichaConfig';
import { calcularIdade } from '../../utils/conviventesUtils';

function valorSelectOrigemPrincipal(formData = {}) {
  if (formData.origem_encaminhamento_id === EQUIPAMENTO_ANTERIOR_OUTROS) return EQUIPAMENTO_ANTERIOR_OUTROS;
  if (formData.origem_encaminhamento_id) return formData.origem_encaminhamento_id;
  if ((formData.origem_encaminhamento_outros || '').trim()) return EQUIPAMENTO_ANTERIOR_OUTROS;
  return '';
}

function alterarOrigemPrincipal(setFormData, valor) {
  if (valor === EQUIPAMENTO_ANTERIOR_OUTROS) {
    setFormData((prev) => ({
      ...prev,
      origem_encaminhamento_id: EQUIPAMENTO_ANTERIOR_OUTROS,
      origem_encaminhamento_outros: prev.origem_encaminhamento_outros || '',
    }));
    return;
  }
  setFormData((prev) => ({
    ...prev,
    origem_encaminhamento_id: valor,
    origem_encaminhamento_outros: '',
  }));
}

export default function ProntuarioPessoais({
  editandoId,
  formData,
  fotoPerfilUrl,
  listaTecnicos,
  origensEncaminhamento,
  historicoMotivos,
  statusOriginal,
  podeMudarStatus,
  errosValidacao,
  quartos,
  podeEditarLeitoPeloProntuario = true,
  handleChange,
  handleBlur,
  handleRemoverFotoPerfil,
  trocarAbaComSalvamento,
  setFormData,
  setErrosValidacao,
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row items-start gap-5 p-4 bg-gray-50 rounded-xl border border-gray-100 shadow-inner">
        <div className="relative flex-shrink-0 group">
          <div className="w-24 aspect-[3/4] bg-white border-2 border-gray-300 rounded-md shadow-sm flex items-center justify-center overflow-hidden ring-2 ring-white">
            {fotoPerfilUrl ? (
              <AuthenticatedImage caminhoOuUrl={fotoPerfilUrl} alt="Foto Oficial" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-300"><span className="text-4xl">○</span><span className="text-[9px] uppercase font-bold mt-1">Sem Foto</span></div>
            )}
          </div>
          {editandoId && (
            <div className="absolute -bottom-2 -right-2 flex gap-1">
              {fotoPerfilUrl && (
                <button
                  type="button"
                  onClick={handleRemoverFotoPerfil}
                  className="rounded-full bg-red-600 px-2 py-1 text-[10px] font-black text-white shadow transition-transform hover:scale-110 hover:bg-red-700"
                  title="Remover foto de perfil"
                >
                  Remover
                </button>
              )}
              <button type="button" onClick={() => trocarAbaComSalvamento('documentos')} className="bg-brand text-white rounded-full p-1.5 text-xs hover:bg-brandDark shadow transition-transform hover:scale-110" title="Alterar fotografia">+</button>
            </div>
          )}
        </div>

        <div className="flex-1 w-full space-y-3">
          <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome Civil Completo *</label><input type="text" required name="nome_completo" value={formData.nome_completo} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm font-medium" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome Social</label><input type="text" name="nome_social" value={formData.nome_social} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
            <div><label className="block text-xs font-bold text-brand mb-1">Técnico de Referência</label><select name="tecnico_id" value={formData.tecnico_id} onChange={handleChange} className="w-full px-3 py-1.5 border border-brand/40 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm font-medium text-gray-700"><option value="">Não Definido (Atendimento Geral)</option>{listaTecnicos.map(tec => <option key={tec.id} value={tec.id}>{tec.nome} ({tec.perfil_acesso})</option>)}</select></div>
          </div>
        </div>
      </div>

      <div className={`p-4 rounded-xl border shadow-sm transition-colors duration-500 ${formData.status === 'Ativo' ? 'bg-blue-50/50 border-blue-100' : formData.status === 'Saída qualificada' ? 'bg-emerald-50/60 border-emerald-200' : formData.status === 'Ausência justificada' ? 'bg-sky-50/70 border-sky-200' : 'bg-red-50/50 border-red-200'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className={`block text-xs font-bold mb-1 ${formData.status === 'Ativo' ? 'text-blue-900' : formData.status === 'Saída qualificada' ? 'text-emerald-900' : formData.status === 'Ausência justificada' ? 'text-sky-900' : 'text-red-900'}`}>Situação no Abrigo *</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              disabled={!podeMudarStatus}
              className={`w-full px-3 py-1.5 border border-gray-300 rounded-lg outline-none text-sm font-semibold text-gray-800 ${!podeMudarStatus ? 'bg-gray-100 cursor-not-allowed opacity-70' : 'bg-white focus:ring-2 focus:ring-brand'}`}
            >
              <option value="Ativo">Ativo (Presente)</option><option value="Em acolhimento">Em acolhimento</option><option value="Ausência justificada">Ausência justificada</option><option value="Inativado">Inativado (Evadiu/Alta)</option><option value="Saída qualificada">Saída qualificada</option><option value="Bloqueado">Bloqueado (Suspensão)</option>
            </select>
            {!podeMudarStatus && <p className="text-[9px] text-red-500 font-bold mt-1">Apenas Gestor, Técnico Responsável ou Técnico em atendimento geral podem alterar.</p>}
          </div>

          <div className="md:col-span-1">
            <label className={`block text-xs font-semibold mb-1 ${formData.status === 'Ativo' ? 'text-blue-900' : formData.status === 'Saída qualificada' ? 'text-emerald-900' : formData.status === 'Ausência justificada' ? 'text-sky-900' : 'text-red-900'}`}>Data de entrada/vinculação *</label>
            <input type="date" name="data_entrada" required value={formData.data_entrada ? formData.data_entrada.split('T')[0] : ''} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm" />
          </div>

          <div className="md:col-span-1">
            <label className={`block text-xs font-semibold mb-1 ${formData.status === 'Ativo' ? 'text-blue-900' : formData.status === 'Saída qualificada' ? 'text-emerald-900' : formData.status === 'Ausência justificada' ? 'text-sky-900' : 'text-red-900'}`}>Origem / Encaminhado por</label>
            <select
              value={valorSelectOrigemPrincipal(formData)}
              onChange={(e) => alterarOrigemPrincipal(setFormData, e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
            >
              <option value="">Não informado</option>
              {(origensEncaminhamento || []).map((origem) => (
                <option key={origem.id} value={origem.id}>{origem.descricao}</option>
              ))}
              <option value={EQUIPAMENTO_ANTERIOR_OUTROS}>Outros</option>
            </select>
            {valorSelectOrigemPrincipal(formData) === EQUIPAMENTO_ANTERIOR_OUTROS && (
              <input
                type="text"
                name="origem_encaminhamento_outros"
                placeholder="Informe origem / encaminhamento"
                value={formData.origem_encaminhamento_outros || ''}
                onChange={handleChange}
                className={`mt-1.5 w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm ${errosValidacao.origem_encaminhamento_outros ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300'}`}
              />
            )}
            {errosValidacao.origem_encaminhamento_outros && (
              <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.origem_encaminhamento_outros}</p>
            )}
          </div>

          {formData.status !== statusOriginal && formData.status !== 'Bloqueado' && (
            <div className={`md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 ${formData.status === 'Saída qualificada' ? 'border-t border-emerald-200' : 'border-t border-red-200'}`}>
              <div className="md:col-span-1">
                <label className={`block text-xs font-bold mb-1 ${formData.status === 'Saída qualificada' ? 'text-emerald-800' : 'text-red-800'}`}>Motivo Principal *</label>
                <input type="text" name="motivo_status" list="historico-motivos" value={formData.motivo_status} onChange={handleChange} placeholder="Ex: Evasão, Alta, Saída qualificada..." className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 outline-none bg-white text-sm font-medium ${formData.status === 'Saída qualificada' ? 'border-emerald-300 focus:ring-emerald-500' : 'border-red-300 focus:ring-red-500'}`} />
                <datalist id="historico-motivos">{historicoMotivos.map((motivo, idx) => <option key={idx} value={motivo} />)}</datalist>
              </div>
              <div className="md:col-span-2">
                <label className={`block text-xs font-bold mb-1 ${formData.status === 'Saída qualificada' ? 'text-emerald-800' : 'text-red-800'}`}>Relato Detalhado *</label>
                <textarea name="relato_status" value={formData.relato_status} onChange={handleChange} rows="2" placeholder={formData.status === 'Saída qualificada' ? 'Descreva a conclusão do processo/programa e as condições de retorno ao convívio social...' : 'Descreva os detalhes da alteração de status...'} className={`w-full px-3 py-1.5 border rounded-lg focus:ring-2 outline-none bg-white text-sm font-medium ${formData.status === 'Saída qualificada' ? 'border-emerald-300 focus:ring-emerald-500' : 'border-red-300 focus:ring-red-500'}`}></textarea>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Histórico institucional</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Data de inclusão</label>
            <input
              type="date"
              name="data_inclusao"
              value={formData.data_inclusao ? formData.data_inclusao.split('T')[0] : ''}
              onChange={handleChange}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
            />
            <p className="mt-1 text-[10px] text-slate-500">Primeiro cadastro no projeto. Pode ser retroativa.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Data de inativação</label>
            <input
              type="date"
              name="data_inativacao"
              value={formData.data_inativacao ? formData.data_inativacao.split('T')[0] : ''}
              onChange={handleChange}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
            />
            <p className="mt-1 text-[10px] text-slate-500">Última inativação. Atualizada ao mudar o status.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Data de nova vinculação</label>
            <input
              type="date"
              name="data_nova_vinculacao"
              value={formData.data_nova_vinculacao ? formData.data_nova_vinculacao.split('T')[0] : ''}
              onChange={handleChange}
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
            />
            <p className="mt-1 text-[10px] text-slate-500">Última reativação após inativação.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Prontuário da saúde</label>
            <input
              type="text"
              name="prontuario_saude"
              value={formData.prontuario_saude || ''}
              onChange={handleChange}
              placeholder="Número ou código alfanumérico"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Referência CAPS</label>
            <input
              type="text"
              name="acompanhamento_caps"
              value={formData.acompanhamento_caps || ''}
              onChange={handleChange}
              placeholder="Nome da referência no CAPS"
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">CPF</label><input type="text" name="cpf" value={formData.cpf} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 border rounded-lg outline-none text-sm ${errosValidacao.cpf ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand'}`} placeholder="000.000.000-00" />{errosValidacao.cpf && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.cpf}</p>}</div>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">RG</label><input type="text" name="rg" value={formData.rg} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nascimento {formData.data_nascimento && <span className="ml-1 text-brand font-bold bg-blue-50 px-1.5 py-0.5 rounded-md text-[10px]">{calcularIdade(formData.data_nascimento)} anos</span>}</label><input type="date" name="data_nascimento" value={formData.data_nascimento} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Estado Civil</label><select name="estado_civil" value={formData.estado_civil} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"><option value="">Selecione...</option><option value="Solteiro(a)">Solteiro(a)</option><option value="Casado(a)">Casado(a)</option><option value="Divorciado(a)">Divorciado(a)</option><option value="Viúvo(a)">Viúvo(a)</option><option value="União Estável">União Estável</option></select></div>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Telefone / Celular</label><input type="text" name="telefone_celular" value={formData.telefone_celular} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 border rounded-lg outline-none text-sm ${errosValidacao.telefone_celular ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand'}`} placeholder="(00) 00000-0000" />{errosValidacao.telefone_celular && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.telefone_celular}</p>}</div>
        <div className="lg:col-span-3">
          <label className="block text-xs font-bold text-brand mb-1">Alocação de Quarto / Cama</label>
          <select
            name="leito_id"
            value={formData.leito_id}
            onChange={handleChange}
            disabled={!podeEditarLeitoPeloProntuario}
            className={`w-full px-3 py-1.5 border border-brand/50 rounded-lg outline-none text-sm ${podeEditarLeitoPeloProntuario ? 'bg-white focus:ring-2 focus:ring-brand' : 'bg-gray-100 cursor-not-allowed text-gray-500'}`}
          >
            <option value="">Apenas Convivência Diurna (Sem Pernoite)</option>
            {quartos.map(q => (
              <optgroup key={q.id} label={`${q.nome} - [${q.tipo_publico} / ${q.modalidade === 'Transitorio' ? 'Transitório' : 'Fixo'}]`}>
                {q.leitos?.map(l => {
                  if (l.status === 'Livre' || l.id === formData.leito_id) {
                    return (
                      <option key={l.id} value={l.id}>
                        {q.nome} - {l.identificacao} {l.id === formData.leito_id ? '(Cama Atual)' : '(Livre)'}
                      </option>
                    );
                  }
                  return null;
                })}
              </optgroup>
            ))}
          </select>
          {!podeEditarLeitoPeloProntuario && (
            <p className="mt-1 text-[10px] font-bold text-slate-500">
              Apenas Gestor e Técnico podem alterar quarto/cama pelo módulo Acomodações.
            </p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <h3 className="text-sm font-bold text-brand mb-3">Endereço</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">CEP</label><input type="text" name="cep" value={formData.cep} onChange={handleChange} onBlur={handleBlur} className={`w-full px-3 py-1.5 border rounded-lg outline-none text-sm ${errosValidacao.cep ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand'}`} placeholder="00000-000" />{errosValidacao.cep && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{errosValidacao.cep}</p>}</div>
          <div className="md:col-span-3"><label className="block text-xs font-semibold text-gray-700 mb-1">Rua / Logradouro</label><input type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
          <div className="md:col-span-1"><label className="block text-xs font-semibold text-gray-700 mb-1">Número</label><input type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Complemento</label><input type="text" name="complemento" value={formData.complemento} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
          <div className="md:col-span-2"><label className="block text-xs font-semibold text-gray-700 mb-1">Bairro</label><input type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
          <div className="md:col-span-1"><label className="block text-xs font-semibold text-gray-700 mb-1">Cidade</label><input type="text" name="cidade" value={formData.cidade} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
          <div className="md:col-span-1"><label className="block text-xs font-semibold text-gray-700 mb-1">UF</label><select name="uf" value={formData.uf} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none bg-white text-sm"><option value="">--</option><option value="AC">AC</option><option value="AL">AL</option><option value="AP">AP</option><option value="AM">AM</option><option value="BA">BA</option><option value="CE">CE</option><option value="DF">DF</option><option value="ES">ES</option><option value="GO">GO</option><option value="MA">MA</option><option value="MT">MT</option><option value="MS">MS</option><option value="MG">MG</option><option value="PA">PA</option><option value="PB">PB</option><option value="PR">PR</option><option value="PE">PE</option><option value="PI">PI</option><option value="RJ">RJ</option><option value="RN">RN</option><option value="RS">RS</option><option value="RO">RO</option><option value="RR">RR</option><option value="SC">SC</option><option value="SP">SP</option><option value="SE">SE</option><option value="TO">TO</option></select></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Mãe</label><input type="text" name="nome_mae" value={formData.nome_mae} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
        <div><label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Pai</label><input type="text" name="nome_pai" value={formData.nome_pai} onChange={handleChange} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand outline-none text-sm" /></div>
      </div>

      <ProntuarioFamilia
        formData={formData}
        handleChange={handleChange}
        setFormData={setFormData}
        errosValidacao={errosValidacao}
        setErrosValidacao={setErrosValidacao}
      />
    </div>
  );
}
