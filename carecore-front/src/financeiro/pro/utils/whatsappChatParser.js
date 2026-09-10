/**
 * Parser do export TXT do WhatsApp (Cashback Claudio & Léo).
 * Endurecido contra digitação irregular vista no histórico real.
 */

const DATE_RE = /\[?(\d{2})\/(\d{2})\/(\d{4})\]?/;
const AUTHOR_RE = /\]\s*([^:\n]+):\s*(.*)$/;

/** Nome + deve + (Nx) + valor no início (padrão principal). */
const DEBT_VALUE_FIRST_RE =
  /(L[ée]o|Ledo|Cl[aá]udio|Claydio|Renato|Eu|Voc[êe])\s+deve\s*(?:(\d+)[xX]\s*)?(?:R\$)?\s*((?:\d{1,3}\.)*\d+,\d{2}|\d+,\d{2}|\d+\.\d{2})\s*(.*)$/i;

/** Nome + deve + texto + valor no final (digitação invertida). */
const DEBT_VALUE_LAST_RE =
  /(L[ée]o|Ledo|Cl[aá]udio|Claydio|Renato|Eu|Voc[êe])\s+deve\s+(?:(\d+)[xX]\s+)?(.+?)\s+((?:\d{1,3}\.)*\d+,\d{2}|\d+,\d{2})\s*$/i;

/** "Deve valor…" sem responsável (infere pelo autor da mensagem). */
const DEBT_BARE_RE =
  /(?:^|:\s*)Deve\s*(?:(\d+)[xX]\s*)?(?:R\$)?\s*((?:\d{1,3}\.)*\d+,\d{2}|\d+,\d{2})\s*(.*)$/i;

const CHATTER_RE =
  /deve\s+pagar|saldo\s+q|saldo\s+que|últimos\s+acertos|ultimos\s+acertos|zerado\s+n|comprovante|abertura\s+de\s+novas/i;

/**
 * @param {unknown} raw
 * @returns {number}
 */
export function parseWhatsappMoney(raw) {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let c = String(raw).trim().replace(/[R$\s"US]/g, '');
  if (!c) return 0;
  if (c.includes(',') && c.includes('.')) {
    return c.indexOf('.') < c.indexOf(',')
      ? parseFloat(c.replace(/\./g, '').replace(',', '.'))
      : parseFloat(c.replace(/,/g, ''));
  }
  if (c.includes(',') && !c.includes('.')) return parseFloat(c.replace(',', '.'));
  // milhar BR sem centavos explícitos raros: 11.755
  if (/^\d{1,3}(\.\d{3})+$/.test(c)) return parseFloat(c.replace(/\./g, ''));
  return parseFloat(c);
}

/**
 * @param {string | null | undefined} rawName
 * @param {string | null | undefined} authorHint
 * @returns {'Léo' | 'Claudio' | 'Desconhecido'}
 */
export function resolveWhatsappResponsible(rawName, authorHint) {
  const name = String(rawName || '').trim();
  if (/L[ée]o|Ledo|^Eu$/i.test(name)) return 'Léo';
  if (/Cl[aá]udio|Claydio|Renato|Voc[êe]/i.test(name)) return 'Claudio';

  const author = String(authorHint || '').toLowerCase();
  if (/claudio|aclaudio|claydio/.test(author)) return 'Léo';
  if (/leo|léo|leandro/.test(author)) return 'Claudio';
  return 'Desconhecido';
}

/**
 * @param {string} line
 * @returns {{ date: Date | null, author: string | null, body: string }}
 */
export function splitWhatsappLine(line) {
  const clean = String(line || '').replace(/[\u200e\u200f]/g, '');
  const dateMatch = clean.match(DATE_RE);
  let date = null;
  if (dateMatch) {
    date = new Date(
      parseInt(dateMatch[3], 10),
      parseInt(dateMatch[2], 10) - 1,
      parseInt(dateMatch[1], 10),
    );
  }
  const authorMatch = clean.match(AUTHOR_RE);
  if (authorMatch) {
    return {
      date,
      author: authorMatch[1].trim(),
      body: authorMatch[2].trim(),
    };
  }
  return { date, author: null, body: clean.trim() };
}

/**
 * @param {string} body
 * @param {string | null | undefined} authorHint
 * @returns {{ responsible: string, installments: number, amount: number, description: string } | null}
 */
export function parseWhatsappDebtBody(body, authorHint) {
  const text = String(body || '').trim();
  if (!text || !/deve/i.test(text)) return null;
  if (CHATTER_RE.test(text)) return null;

  /** @type {string} */
  let rawName;
  /** @type {string} */
  let installmentsStr;
  /** @type {string} */
  let amountStr;
  /** @type {string} */
  let description;

  const first = text.match(DEBT_VALUE_FIRST_RE);
  if (first) {
    rawName = first[1];
    installmentsStr = first[2] || '';
    amountStr = first[3];
    description = (first[4] || '').trim();
  } else {
    const last = text.match(DEBT_VALUE_LAST_RE);
    if (last) {
      rawName = last[1];
      installmentsStr = last[2] || '';
      description = (last[3] || '').replace(/:\s*$/, '').trim();
      amountStr = last[4];
    } else {
      const bare = text.match(DEBT_BARE_RE);
      if (!bare) return null;
      rawName = '';
      installmentsStr = bare[1] || '';
      amountStr = bare[2];
      description = (bare[3] || '').trim();
    }
  }

  const amount = parseWhatsappMoney(amountStr);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const installments = installmentsStr ? parseInt(installmentsStr, 10) : 1;
  if (!Number.isFinite(installments) || installments < 1 || installments > 60) return null;

  // Evita resumos tipo "Léo deve 3.578,31" sem descrição em bloco de acerto
  // (já filtrados por CHATTER / split do zerado; aqui só rejeita valor absurdo sem desc se > 50k sem texto)
  if (!description && amount > 50000) return null;

  return {
    responsible: resolveWhatsappResponsible(rawName, authorHint),
    installments,
    amount,
    description: description.replace(/\s*‎?<Mensagem editada>\s*/gi, ' ').trim(),
  };
}

/**
 * @param {Date} base
 * @param {number} months
 * @returns {Date}
 */
function addMonthsLocal(base, months) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * @param {Date} d
 * @returns {string} YYYY-MM-DD (calendário local)
 */
export function toLocalIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Conteúdo após o último "Zerado nessa/nesta data", com data semente do marcador.
 * @param {string} fileContent
 * @returns {{ text: string, seedDate: Date | null }}
 */
export function contentAfterLastZerado(fileContent) {
  const content = String(fileContent || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lower = content.toLowerCase();
  let splitIndex = -1;
  for (const v of ['zerado nessa data', 'zerado nesta data']) {
    const idx = lower.lastIndexOf(v);
    if (idx > splitIndex) splitIndex = idx;
  }
  if (splitIndex === -1) return { text: content, seedDate: null };

  const lineStart = content.lastIndexOf('\n', splitIndex) + 1;
  const lineEnd = content.indexOf('\n', splitIndex);
  const zline = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const dm = zline.match(DATE_RE);
  let seedDate = null;
  if (dm) {
    seedDate = new Date(
      parseInt(dm[3], 10),
      parseInt(dm[2], 10) - 1,
      parseInt(dm[1], 10),
    );
  }
  const nextNl = content.indexOf('\n', splitIndex);
  const text = nextNl === -1 ? '' : content.slice(nextNl + 1);
  return { text, seedDate };
}

/**
 * @typedef {object} WhatsappImportDraft
 * @property {string} description
 * @property {number} amount
 * @property {'expense'} type
 * @property {string} category
 * @property {string} responsible
 * @property {string} date
 * @property {boolean} is_paid
 * @property {'WHATSAPP_IMPORT'} origin_file
 * @property {boolean} is_projected
 * @property {string} whatsapp_cycle_key
 * @property {string} [user_id]
 */

/**
 * Converte export do chat em lançamentos do ciclo aberto.
 * @param {string} fileContent
 * @param {{ userId?: string }} [opts]
 * @returns {WhatsappImportDraft[]}
 */
export function parseWhatsappChatImport(fileContent, opts = {}) {
  const { text, seedDate } = contentAfterLastZerado(fileContent);
  const lines = text.split('\n');
  /** @type {WhatsappImportDraft[]} */
  const batch = [];
  let lastValidDate = seedDate;
  let lastAuthor = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const { date, author, body } = splitWhatsappLine(line);
    if (date) lastValidDate = date;
    if (author) lastAuthor = author;
    if (!lastValidDate || !/deve/i.test(body)) continue;

    const debt = parseWhatsappDebtBody(body, author || lastAuthor);
    if (!debt) continue;
    if (debt.responsible === 'Desconhecido') continue;

    for (let i = 0; i < debt.installments; i += 1) {
      const installmentDate = addMonthsLocal(lastValidDate, i);
      const iso = toLocalIsoDate(installmentDate);
      const suffix = debt.installments > 1 ? ` (${i + 1}/${debt.installments})` : '';
      batch.push({
        user_id: opts.userId,
        description: `${debt.description}${suffix}`.trim() || 'Sem descrição',
        amount: debt.amount,
        type: 'expense',
        category: 'Outros',
        responsible: debt.responsible,
        date: iso,
        is_paid: false,
        origin_file: 'WHATSAPP_IMPORT',
        is_projected: i > 0,
        whatsapp_cycle_key: `${installmentDate.getFullYear()}-${String(installmentDate.getMonth() + 1).padStart(2, '0')}`,
      });
    }
  }

  return batch;
}

/**
 * Contagens úteis para UI de fechamento.
 * @param {Array<{ is_paid?: boolean, is_projected?: boolean, date?: string }>} whatsappTransactions
 * @param {string} cutoffDate YYYY-MM-DD
 */
export function summarizeWhatsappCycle(whatsappTransactions, cutoffDate) {
  const list = Array.isArray(whatsappTransactions) ? whatsappTransactions : [];
  const openReal = list.filter(
    (t) => !t.is_paid && !t.is_projected && String(t.date || '') <= cutoffDate,
  );
  const openProjected = list.filter((t) => !t.is_paid && t.is_projected);
  return {
    totalHistorico: list.length,
    itensNoCiclo: openReal.length,
    parcelasProjetadasAbertas: openProjected.length,
  };
}
