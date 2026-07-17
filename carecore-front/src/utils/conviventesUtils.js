import { dataLocalDeIso } from './dataBrasilUtils.js';

export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return '';
  const nascimento = dataLocalDeIso(dataNascimento) || new Date(dataNascimento);
  if (Number.isNaN(nascimento.getTime())) return '';
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return idade;
}

export function formatarCPF(v) {
  return v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
}

export function formatarCEP(v) {
  return v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);
}

export function validarEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function validarCPF(cpf) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0, r;
  for (let i = 1; i <= 9; i++) s += parseInt(c.substring(i - 1, i)) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c.substring(9, 10))) return false;
  s = 0;
  for (let i = 1; i <= 10; i++) s += parseInt(c.substring(i - 1, i)) * (12 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c.substring(10, 11));
}

export function validarCEP(cep) {
  return cep.replace(/\D/g, '').length === 8;
}

export function validarTelefone(tel) {
  const num = tel.replace(/\D/g, '');
  return num.length >= 10 && num.length <= 11;
}

export function formatarTelefone(v) {
  let num = v.replace(/\D/g, '');
  if (!num) return '';
  if (num.length <= 2) return `(${num}`;
  if (num.length <= 6) return `(${num.slice(0, 2)}) ${num.slice(2)}`;
  if (num.length <= 10) return `(${num.slice(0, 2)}) ${num.slice(2, 6)}-${num.slice(6, 10)}`;
  return `(${num.slice(0, 2)}) ${num.slice(2, 7)}-${num.slice(7, 11)}`;
}
