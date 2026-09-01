// ARQUIVO: src/utils/formatters.ts

export const formatCurrency = (value: number | undefined) => {
  if (value === undefined || value === null || isNaN(value)) return "R$ 0,00";
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const formatDateBR = (isoDate: string) => {
  if (!isoDate) return "-";
  try {
    const parts = isoDate.split('T')[0].split('-');
    if(parts.length < 3) return isoDate;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  } catch(e) { return isoDate; }
};