/** Datas operacionais no calendário brasileiro (exibição DD/MM/AAAA). */

/**
 * Interpreta AAAA-MM-DD (ou prefixo de datetime ISO) como dia no calendário local.
 * Evita new Date('AAAA-MM-DD'), que o JS trata como UTC e atrasa 1 dia em SP.
 */
export function dataLocalDeIso(iso) {
  const texto = String(iso || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const [ano, mes, dia] = texto.split('-').map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
}

export function formatarDataBr(iso) {
  if (!iso) return '';
  const local = dataLocalDeIso(iso);
  if (local) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()}`;
  }
  const texto = String(iso);
  if (texto.includes('T') || texto.includes(' ')) {
    try {
      return new Date(texto).toLocaleDateString('pt-BR');
    } catch {
      return texto;
    }
  }
  return texto;
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
  return String(a || '').slice(0, 10).localeCompare(String(b || '').slice(0, 10));
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

/** Hoje no calendário local do browser (operacional SP na prática da equipe). */
export function hojeIsoLocal(agora = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}`;
}
