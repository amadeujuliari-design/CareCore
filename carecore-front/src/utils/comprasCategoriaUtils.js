const STOP = new Set(['E', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'COM', 'PARA', 'A', 'O', 'AS', 'OS']);

function semAcento(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function tokensNomeCadastro(nome) {
  const t = semAcento(nome).toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
  return new Set(t.split(/\s+/).filter((tok) => tok && !STOP.has(tok)));
}

function tokensCompativeis(a, b) {
  if (a === b) return true;
  const [menor, maior] = a.length <= b.length ? [a, b] : [b, a];
  return menor.length >= 3 && maior.startsWith(menor);
}

function conjuntoCoberto(menor, maior) {
  if (!menor.size || !maior.size) return false;
  const usados = new Set();
  for (const tok of menor) {
    let achou = false;
    for (const cand of maior) {
      if (usados.has(cand)) continue;
      if (tokensCompativeis(tok, cand)) {
        usados.add(cand);
        achou = true;
        break;
      }
    }
    if (!achou) return false;
  }
  return true;
}

export function nomesSaoSemelhantes(a, b) {
  const ta = tokensNomeCadastro(a);
  const tb = tokensNomeCadastro(b);
  if (!ta.size || !tb.size) return false;
  if (ta.size === tb.size && [...ta].every((tok) => tb.has(tok))) return true;
  return conjuntoCoberto(ta, tb) || conjuntoCoberto(tb, ta);
}

export function nomesCadastroSemelhantes(nome, existentes = [], { ignorar = '' } = {}) {
  const alvo = String(nome || '').trim();
  if (!alvo) return [];
  const ignorarNorm = String(ignorar || '').trim().toLowerCase();
  const vistos = new Set();
  const saida = [];
  existentes.forEach((bruto) => {
    const atual = String(bruto || '').trim();
    if (!atual) return;
    const chave = atual.toLowerCase();
    if (chave === ignorarNorm || chave === alvo.toLowerCase() || vistos.has(chave)) return;
    if (nomesSaoSemelhantes(alvo, atual)) {
      vistos.add(chave);
      saida.push(atual);
    }
  });
  return saida;
}

export function conflitosNomeCadastro(nome, existentes = [], { ignorar = '' } = {}) {
  const alvo = String(nome || '').trim().toLowerCase();
  if (!alvo) return [];
  const ignorarNorm = String(ignorar || '').trim().toLowerCase();
  const exato = existentes
    .map((item) => String(item || '').trim())
    .find((item) => item && item.toLowerCase() !== ignorarNorm && item.toLowerCase() === alvo);
  if (exato) return [exato];
  return nomesCadastroSemelhantes(nome, existentes, { ignorar });
}

export function rotuloCategoria(cat) {
  const nome = cat?.nome || '';
  if (!nome) return '';
  const qtd = Number(cat?.qtd_itens) || 0;
  return `${nome} (${qtd})`;
}
