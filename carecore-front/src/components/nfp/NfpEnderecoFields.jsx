import { useState } from 'react';

import { CampoSelect, CampoTexto } from '../UsuariosCampos';
import { consultarCep } from '../../services/cepService';
import { formatarCEP, limparMascara } from '../../utils/usuariosUtils';
import { UFS_BR } from '../../utils/nfpCadastroUtils';

export default function NfpEnderecoFields({
  form,
  erros = {},
  onChange,
  onErroChange,
  className = '',
}) {
  const [buscandoCep, setBuscandoCep] = useState(false);

  const atualizarCampo = (campo, valor) => {
    onChange(campo, valor);
    if (erros[campo] && onErroChange) {
      onErroChange(campo, '');
    }
  };

  const consultarEndereco = async (valorCep = form.cep) => {
    const cep = limparMascara(valorCep);

    if (cep.length !== 8) return;

    setBuscandoCep(true);

    try {
      const endereco = await consultarCep(cep);

      if (!endereco) {
        onErroChange?.('cep', 'CEP não encontrado.');
        return;
      }

      onErroChange?.('cep', '');
      onChange('logradouro', endereco.logradouro || form.logradouro || '');
      onChange('bairro', endereco.bairro || form.bairro || '');
      onChange('cidade', endereco.cidade || form.cidade || '');
      onChange('uf', (endereco.uf || form.uf || '').toUpperCase());
    } catch {
      onErroChange?.('cep', 'Não foi possível consultar o CEP agora.');
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleCepChange = (valor) => {
    const formatado = formatarCEP(valor);
    atualizarCampo('cep', formatado);

    if (limparMascara(formatado).length === 8) {
      consultarEndereco(formatado);
    }
  };

  return (
    <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-4 ${className}`}>
      <div className="md:col-span-2 xl:col-span-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Endereço</p>
      </div>

      <div className="flex gap-2 md:col-span-2">
        <CampoTexto
          label="CEP"
          value={form.cep}
          onChange={handleCepChange}
          onBlur={() => consultarEndereco(form.cep)}
          erro={erros.cep}
          placeholder="00000-000"
          className="flex-1"
        />
        <div className="flex items-end pb-1">
          <button
            type="button"
            disabled={buscandoCep}
            onClick={() => consultarEndereco(form.cep)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {buscandoCep ? 'Buscando...' : 'Buscar CEP'}
          </button>
        </div>
      </div>

      <CampoTexto
        label="Logradouro"
        value={form.logradouro}
        onChange={(valor) => atualizarCampo('logradouro', valor)}
        erro={erros.logradouro}
        className="md:col-span-2"
      />

      <CampoTexto
        label="Número"
        value={form.numero}
        onChange={(valor) => atualizarCampo('numero', valor)}
        erro={erros.numero}
      />

      <CampoTexto
        label="Complemento"
        value={form.complemento}
        onChange={(valor) => atualizarCampo('complemento', valor)}
        erro={erros.complemento}
      />

      <CampoTexto
        label="Bairro"
        value={form.bairro}
        onChange={(valor) => atualizarCampo('bairro', valor)}
        erro={erros.bairro}
      />

      <CampoTexto
        label="Cidade"
        value={form.cidade}
        onChange={(valor) => atualizarCampo('cidade', valor)}
        erro={erros.cidade}
      />

      <CampoSelect
        label="UF"
        value={form.uf}
        onChange={(valor) => atualizarCampo('uf', valor.toUpperCase())}
        options={UFS_BR}
        placeholder="UF"
      />
    </div>
  );
}
