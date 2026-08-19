export const PATRIMONIO_PROPRIEDADE = [
  { value: 'aeb', label: 'AEB' },
  { value: 'publico', label: 'Público (Prefeitura)' },
];

export const PATRIMONIO_ORIGEM = [
  { value: 'compra', label: 'Compra' },
  { value: 'doacao', label: 'Doação' },
  { value: 'inventario', label: 'Inventário' },
  { value: 'outros', label: 'Outros' },
];

export const PATRIMONIO_SITUACAO = [
  { value: 'bom', label: 'Bom' },
  { value: 'regular', label: 'Regular' },
  { value: 'ruim', label: 'Ruim' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'baixado', label: 'Baixado' },
];

export function rotuloOpcao(lista, valor) {
  return lista.find((item) => item.value === valor)?.label || valor || '—';
}

export function reaisParaCentavos(valor) {
  if (valor == null || valor === '') return null;
  const texto = String(valor).replace(/R\$/g, '').trim();
  if (!texto) return null;
  let normal = texto;
  if (texto.includes(',') && texto.includes('.')) {
    normal = texto.replace(/\./g, '').replace(',', '.');
  } else if (texto.includes(',')) {
    normal = texto.replace(',', '.');
  }
  const n = Number(normal);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

export function centavosParaInput(centavos) {
  if (centavos == null || centavos === '') return '';
  return (Number(centavos) / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
