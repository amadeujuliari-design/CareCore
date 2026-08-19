import { formatarCEP } from './usuariosUtils';

export function formatarEnderecoFornecedor(fornecedor = {}) {
  const partes = [];
  const log = (fornecedor.logradouro || '').trim();
  const num = (fornecedor.numero || '').trim();
  if (log) partes.push(num ? `${log}, ${num}` : log);
  if (fornecedor.bairro) partes.push(String(fornecedor.bairro).trim());
  const cidade = (fornecedor.cidade || '').trim();
  const uf = (fornecedor.uf || '').trim();
  if (cidade) partes.push(uf ? `${cidade}/${uf}` : cidade);
  else if (uf) partes.push(uf);
  const cep = String(fornecedor.cep || '').replace(/\D/g, '');
  if (cep.length === 8) partes.push(formatarCEP(cep));
  return partes.join(' · ');
}

export function rotuloProjetosFornecedor(fornecedor = {}) {
  if (fornecedor.atende_geral) return 'GERAL';
  if (Array.isArray(fornecedor.projetos) && fornecedor.projetos.length) {
    return fornecedor.projetos.map((p) => p.nome).join(', ');
  }
  return fornecedor.projetos_atendidos || '';
}

export function resumoLocalFornecedor(fornecedor = {}) {
  const endereco = formatarEnderecoFornecedor(fornecedor);
  if (endereco) return endereco;
  const cidade = (fornecedor.cidade || '').trim();
  const uf = (fornecedor.uf || '').trim();
  if (cidade) return uf ? `${cidade}/${uf}` : cidade;
  return '';
}
