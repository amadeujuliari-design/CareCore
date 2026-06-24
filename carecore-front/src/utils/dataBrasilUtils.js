/** Datas operacionais no calendário brasileiro (exibição DD/MM/AAAA). */

export function formatarDataBr(iso) {
  if (!iso) return '';
  const partes = String(iso).slice(0, 10).split('-');
  if (partes.length !== 3) return iso;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

export function parseDataIso(valor) {
  if (!valor) return null;
  const texto = String(valor).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const match = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }
  return null;
}

export function vigenciaPadraoMesAtual() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    inicio: `${ano}-${pad(mes + 1)}-01`,
    fim: `${ano}-${pad(mes + 1)}-${pad(ultimoDia)}`,
  };
}

export function compararDatasIso(a, b) {
  return String(a || '').localeCompare(String(b || ''));
}

export function dataIsoNoIntervalo(dataIso, inicioIso, fimIso) {
  if (!dataIso) return false;
  if (inicioIso && compararDatasIso(dataIso, inicioIso) < 0) return false;
  if (fimIso && compararDatasIso(dataIso, fimIso) > 0) return false;
  return true;
}

export function mesAnoDeIso(iso) {
  const partes = String(iso || '').slice(0, 10).split('-');
  if (partes.length < 2) return null;
  return { ano: Number(partes[0]), mes: Number(partes[1]) };
}

export function ultimoDiaMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}
