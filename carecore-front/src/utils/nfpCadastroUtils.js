import { formatarCEP, limparMascara, somenteNumeros } from './usuariosUtils';

export const UFS_BR = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const FORM_ENDERECO_VAZIO = {
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

export function formatarCNPJ(valor) {
  const v = limparMascara(valor).slice(0, 14);

  return v
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function cnpjValido(valor) {
  const cnpj = limparMascara(valor);

  if (!cnpj) return true;
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcularDigito = (base) => {
    const pesos = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    const soma = base
      .split('')
      .reduce((total, digito, index) => total + Number(digito) * pesos[index], 0);
    const resto = soma % 11;

    return resto < 2 ? '0' : String(11 - resto);
  };

  const primeiroDigito = calcularDigito(cnpj.slice(0, 12));
  const segundoDigito = calcularDigito(cnpj.slice(0, 12) + primeiroDigito);

  return cnpj.endsWith(primeiroDigito + segundoDigito);
}

export function formatarNumeroCadastro(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return String(Math.trunc(n)).padStart(3, '0');
}

export function rotuloAgenteCaptacao(agente) {
  if (!agente) return '';
  const codigo = agente.codigo || '';
  const numero = formatarNumeroCadastro(agente.numero_cadastro);
  if (numero !== '—' && codigo) return `${numero} — ${codigo}`;
  return codigo || numero;
}

export function opcoesAgentesCaptacao(agentes = []) {
  return agentes
    .filter((a) => a && a.ativo !== false && a.codigo)
    .map((a) => ({
      value: a.codigo,
      label: rotuloAgenteCaptacao(a),
    }));
}

export function aplicarCepNoForm(form, enderecoApi) {
  if (!enderecoApi) return form;

  return {
    ...form,
    logradouro: enderecoApi.logradouro || form.logradouro || '',
    bairro: enderecoApi.bairro || form.bairro || '',
    cidade: enderecoApi.cidade || form.cidade || '',
    uf: (enderecoApi.uf || form.uf || '').toUpperCase(),
  };
}

export function formatarPercentual(valor) {
  const numeros = String(valor ?? '').replace(/[^\d.,]/g, '').replace(',', '.');
  if (!numeros) return '';

  const n = Math.min(100, Math.max(0, Number.parseFloat(numeros)));
  if (Number.isNaN(n)) return '';

  return String(n);
}

export function parsePercentual(valor) {
  const texto = formatarPercentual(valor);
  if (!texto) return null;

  return Number.parseFloat(texto);
}

export function percentualValido(valor, { obrigatorio = false } = {}) {
  if (valor === '' || valor === null || valor === undefined) {
    return obrigatorio ? false : true;
  }

  const n = parsePercentual(valor);
  return n !== null && n >= 0 && n <= 100;
}

export function montarEnderecoPayload(form) {
  const cep = somenteNumeros(form.cep);
  const payload = {};

  if (cep) payload.cep = cep;
  if (form.logradouro?.trim()) payload.logradouro = form.logradouro.trim();
  if (form.numero?.trim()) payload.numero = form.numero.trim();
  if (form.complemento?.trim()) payload.complemento = form.complemento.trim();
  if (form.bairro?.trim()) payload.bairro = form.bairro.trim();
  if (form.cidade?.trim()) payload.cidade = form.cidade.trim();
  if (form.uf?.trim()) payload.uf = form.uf.trim().toUpperCase();

  return payload;
}

export function enderecoDoRegistro(registro = {}) {
  return {
    cep: registro.cep ? formatarCEP(registro.cep) : '',
    logradouro: registro.logradouro || '',
    numero: registro.numero || '',
    complemento: registro.complemento || '',
    bairro: registro.bairro || '',
    cidade: registro.cidade || '',
    uf: (registro.uf || '').toUpperCase(),
  };
}

export function erroApiNfp(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return fallback;
}
