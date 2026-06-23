import {
  BENEFICIOS_PIA_OPCOES,
  CORES_RACA_IBGE,
  PARENTESCOS_FAMILIARES,
  RELACAO_FAMILIAR_SITUACOES,
  SITUACOES_TRABALHO_PIA,
  SUBSTANCIAS_PIA,
  TIPOS_DOCUMENTO_CIVIL,
} from '../../config/piaFichaConfig';
import { consultarCep } from '../../services/cepService';
import { formatarCEP, formatarTelefone } from '../../utils/conviventesUtils';
import { criarFamiliarInicial } from '../../utils/conviventesProntuarioUtils';

const UFS_BRASIL = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

function campoClasse(erro = false) {
  return `w-full px-3 py-1.5 border rounded-lg outline-none text-sm focus:ring-2 ${
    erro ? 'border-red-500 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-brand bg-white'
  }`;
}

function campoData(valor) {
  if (!valor) return '';
  return String(valor).split('T')[0];
}

function SimNaoSelect({ name, value, onChange }) {
  return (
    <select name={name} value={value === null || value === undefined ? '' : value ? 'sim' : 'nao'} onChange={onChange} className={campoClasse()}>
      <option value="">—</option>
      <option value="sim">Sim</option>
      <option value="nao">Não</option>
    </select>
  );
}

function parseSimNao(e) {
  const v = e.target.value;
  return v === '' ? null : v === 'sim';
}

export function atualizarLista(setFormData, chave, indice, campo, valor) {
  setFormData((prev) => {
    const lista = [...(prev[chave] || [])];
    lista[indice] = { ...lista[indice], [campo]: valor };
    return { ...prev, [chave]: lista };
  });
}

export function atualizarFamiliarCampos(setFormData, indice, campos) {
  setFormData((prev) => {
    const lista = [...(prev.familiares || [])];
    lista[indice] = { ...lista[indice], ...campos };
    return { ...prev, familiares: lista };
  });
}

export function removerLista(setFormData, chave, indice) {
  setFormData((prev) => ({
    ...prev,
    [chave]: (prev[chave] || []).filter((_, i) => i !== indice),
  }));
}

export function adicionarLista(setFormData, chave, itemPadrao) {
  setFormData((prev) => ({
    ...prev,
    [chave]: [...(prev[chave] || []), itemPadrao],
  }));
}

export function toggleArrayItem(setFormData, chave, item) {
  setFormData((prev) => {
    const atual = prev[chave] || [];
    const existe = atual.includes(item);
    return {
      ...prev,
      [chave]: existe ? atual.filter((v) => v !== item) : [...atual, item],
    };
  });
}

function EnderecoFamiliar({ item, idx, errosValidacao, setFormData, setErrosValidacao }) {
  const erroCep = errosValidacao[`familiares_${idx}_cep`];

  const buscarCep = async (cepBuscado) => {
    const cepLimpo = cepBuscado.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    try {
      const endereco = await consultarCep(cepLimpo);
      if (endereco) {
        atualizarFamiliarCampos(setFormData, idx, {
          logradouro: endereco.logradouro || '',
          bairro: endereco.bairro || '',
          cidade: endereco.cidade || '',
          uf: endereco.uf || '',
        });
        setErrosValidacao?.((prev) => ({ ...prev, [`familiares_${idx}_cep`]: '' }));
      } else {
        setErrosValidacao?.((prev) => ({ ...prev, [`familiares_${idx}_cep`]: 'CEP NÃO ENCONTRADO' }));
      }
    } catch {
      setErrosValidacao?.((prev) => ({ ...prev, [`familiares_${idx}_cep`]: 'NÃO FOI POSSÍVEL CONSULTAR O CEP' }));
    }
  };

  const alterarCep = (valor) => {
    const cepFormatado = formatarCEP(valor);
    atualizarLista(setFormData, 'familiares', idx, 'cep', cepFormatado);
    if (erroCep) {
      setErrosValidacao?.((prev) => ({ ...prev, [`familiares_${idx}_cep`]: '' }));
    }
    if (cepFormatado.length === 9) {
      buscarCep(cepFormatado);
    }
  };

  return (
    <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-6 gap-2 pt-1 border-t border-dashed border-gray-100">
      <div className="md:col-span-6">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Endereço do familiar</p>
      </div>
      <div className="md:col-span-2">
        <label className="block text-[10px] font-semibold text-gray-600 mb-1">CEP</label>
        <input
          type="text"
          value={item.cep || ''}
          onChange={(e) => alterarCep(e.target.value)}
          onBlur={(e) => {
            const cep = (e.target.value || '').trim();
            if (cep && cep.replace(/\D/g, '').length !== 8) {
              setErrosValidacao?.((prev) => ({ ...prev, [`familiares_${idx}_cep`]: 'CEP INCOMPLETO' }));
            }
          }}
          placeholder="00000-000"
          className={campoClasse(Boolean(erroCep))}
        />
        {erroCep && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{erroCep}</p>}
      </div>
      <div className="md:col-span-3">
        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Rua / Logradouro</label>
        <input
          type="text"
          value={item.logradouro || ''}
          onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'logradouro', e.target.value)}
          className={campoClasse()}
        />
      </div>
      <div className="md:col-span-1">
        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Número</label>
        <input
          type="text"
          value={item.numero || ''}
          onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'numero', e.target.value)}
          className={campoClasse()}
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Complemento</label>
        <input
          type="text"
          value={item.complemento || ''}
          onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'complemento', e.target.value)}
          className={campoClasse()}
        />
      </div>
      <div className="md:col-span-2">
        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Bairro</label>
        <input
          type="text"
          value={item.bairro || ''}
          onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'bairro', e.target.value)}
          className={campoClasse()}
        />
      </div>
      <div className="md:col-span-1">
        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Cidade</label>
        <input
          type="text"
          value={item.cidade || ''}
          onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'cidade', e.target.value)}
          className={campoClasse()}
        />
      </div>
      <div className="md:col-span-1">
        <label className="block text-[10px] font-semibold text-gray-600 mb-1">UF</label>
        <select
          value={item.uf || ''}
          onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'uf', e.target.value)}
          className={campoClasse()}
        >
          <option value="">--</option>
          {UFS_BRASIL.map((uf) => (
            <option key={uf} value={uf}>{uf}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function ProntuarioFamilia({ formData, handleChange, setFormData, errosValidacao = {}, setErrosValidacao }) {
  return (
    <div className="pt-4 border-t border-gray-200 space-y-4">
      <h3 className="text-sm font-bold text-brand">Relação familiar e referências</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Raça/cor</label>
          <select name="cor_raca" value={formData.cor_raca || ''} onChange={handleChange} className={campoClasse()}>
            <option value="">Selecione...</option>
            {CORES_RACA_IBGE.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Naturalidade</label>
          <input type="text" name="naturalidade" value={formData.naturalidade || ''} onChange={handleChange} className={campoClasse()} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Orientação sexual</label>
          <input type="text" name="orientacao_sexual" value={formData.orientacao_sexual || ''} onChange={handleChange} className={campoClasse()} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Possui religião?</label>
          <SimNaoSelect name="possui_religiao" value={formData.possui_religiao} onChange={(e) => setFormData((p) => ({ ...p, possui_religiao: parseSimNao(e) }))} />
        </div>
        {formData.possui_religiao && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Qual religião?</label>
            <input type="text" name="religiao_qual" value={formData.religiao_qual || ''} onChange={handleChange} className={campoClasse()} />
            {errosValidacao.religiao_qual && (
              <p className="mt-1 text-xs font-semibold text-red-600">{errosValidacao.religiao_qual}</p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
        <p className="text-xs font-bold text-gray-700">Situação familiar afetivo-social (PIA)</p>
        {RELACAO_FAMILIAR_SITUACOES.map((item) => (
          <label key={item.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="relacao_familiar_situacao"
              value={item.value}
              checked={formData.relacao_familiar_situacao === item.value}
              onChange={handleChange}
              className="mt-1"
            />
            <span>{item.label}</span>
          </label>
        ))}
        {formData.relacao_familiar_situacao === 'outra' && (
          <div>
            <input type="text" name="relacao_familiar_outra" value={formData.relacao_familiar_outra || ''} onChange={handleChange} placeholder="Especifique" className={campoClasse()} />
            {errosValidacao.relacao_familiar_outra && (
              <p className="mt-1 text-xs font-semibold text-red-600">{errosValidacao.relacao_familiar_outra}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-gray-700">Familiares e referências (exceto pai/mãe)</p>
          <button
            type="button"
            onClick={() => adicionarLista(setFormData, 'familiares', criarFamiliarInicial())}
            className="text-xs font-bold text-brand hover:underline"
          >
            + Adicionar
          </button>
        </div>
        {(formData.familiares || []).length === 0 ? (
          <p className="text-xs text-gray-500 italic">Nenhum familiar cadastrado.</p>
        ) : (
          (formData.familiares || []).map((item, idx) => {
            const erroTelefone = errosValidacao[`familiares_${idx}_telefone`];
            return (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-2 p-3 border border-gray-200 rounded-lg bg-white">
                <select value={item.parentesco || ''} onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'parentesco', e.target.value)} className={campoClasse(Boolean(errosValidacao[`familiares_${idx}_parentesco`]))}>
                  <option value="">Parentesco</option>
                  {PARENTESCOS_FAMILIARES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                {errosValidacao[`familiares_${idx}_parentesco`] && (
                  <p className="md:col-span-6 text-red-500 text-[10px] font-bold -mt-1">{errosValidacao[`familiares_${idx}_parentesco`]}</p>
                )}
                <input
                  type="text"
                  placeholder="Nome"
                  value={item.nome || ''}
                  onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'nome', e.target.value)}
                  className={`md:col-span-2 ${campoClasse(Boolean(errosValidacao[`familiares_${idx}_nome`]))}`}
                />
                {errosValidacao[`familiares_${idx}_nome`] && (
                  <p className="md:col-span-6 text-red-500 text-[10px] font-bold -mt-1">{errosValidacao[`familiares_${idx}_nome`]}</p>
                )}
                <input
                  type="number"
                  min="0"
                  placeholder="Idade"
                  value={item.idade ?? ''}
                  onChange={(e) => atualizarLista(setFormData, 'familiares', idx, 'idade', e.target.value ? Number(e.target.value) : null)}
                  className={campoClasse()}
                />
                <div>
                  <input
                    type="text"
                    placeholder="(00) 00000-0000"
                    value={item.telefone || ''}
                    onChange={(e) => {
                      atualizarLista(setFormData, 'familiares', idx, 'telefone', formatarTelefone(e.target.value));
                      if (erroTelefone) {
                        setErrosValidacao?.((prev) => ({ ...prev, [`familiares_${idx}_telefone`]: '' }));
                      }
                    }}
                    onBlur={(e) => {
                      const telefone = (e.target.value || '').trim();
                      if (telefone && telefone.replace(/\D/g, '').length < 10) {
                        setErrosValidacao?.((prev) => ({ ...prev, [`familiares_${idx}_telefone`]: 'TELEFONE INVÁLIDO' }));
                      }
                    }}
                    className={campoClasse(Boolean(erroTelefone))}
                  />
                  {erroTelefone && <p className="text-red-500 text-[10px] mt-0.5 font-bold">{erroTelefone}</p>}
                </div>
                <button type="button" onClick={() => removerLista(setFormData, 'familiares', idx)} className="text-xs font-bold text-red-600 self-start pt-2">Remover</button>

                <EnderecoFamiliar
                  item={item}
                  idx={idx}
                  errosValidacao={errosValidacao}
                  setFormData={setFormData}
                  setErrosValidacao={setErrosValidacao}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ProntuarioFamilia;

export { SimNaoSelect, parseSimNao, campoClasse, campoData, BENEFICIOS_PIA_OPCOES, SITUACOES_TRABALHO_PIA, SUBSTANCIAS_PIA, TIPOS_DOCUMENTO_CIVIL };
