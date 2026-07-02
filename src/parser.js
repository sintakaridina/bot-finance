const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const { formatMoney } = require('./currency');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Jakarta';

function now() {
  return dayjs().tz(TZ);
}

function formatRupiah(amount) {
  return formatMoney(amount);
}

function parseAmount(raw) {
  const cleaned = raw.replace(/[.\s]/g, '').replace(/,/g, '');
  const amount = parseInt(cleaned, 10);
  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

function parseYearMonth(raw) {
  const match = raw.trim().match(/^(\d{4})[/-](\d{1,2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;

  return `${year}-${String(month).padStart(2, '0')}`;
}

const GREETING_PATTERN = /^(hai+|halo+|hallo+|hello+|hi+|hey+|hei+|hola+|pagi|siang|sore|malam|selamat\s+(pagi|siang|sore|malam|datang)|good\s+(morning|afternoon|evening))[\s!.,?]*$/i;

function isGreeting(text) {
  const normalized = text.trim().toLowerCase().replace(/[!.,?]+$/g, '').trim();
  return GREETING_PATTERN.test(normalized);
}

function parseMessage(text) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'ping') {
    return { type: 'ping' };
  }

  if (lower === 'show') {
    return { type: 'show' };
  }

  if (['help', 'menu', 'bantuan', '?'].includes(lower)) {
    return { type: 'help' };
  }

  if (lower.startsWith('delete') || lower.startsWith('del')) {
    const parts = trimmed.split(/\s*-\s*/).map((p) => p.trim());
    if (parts.length < 2) {
      return { type: 'error', message: 'Format: delete - <id>\nExample: delete - 3' };
    }
    const id = parseInt(parts[1], 10);
    if (Number.isNaN(id) || id <= 0) {
      return { type: 'error', message: 'Invalid ID. Example: delete - 3' };
    }
    return { type: 'delete', id };
  }

  if (lower.startsWith('report')) {
    const parts = trimmed.split(/\s*-\s*/).map((p) => p.trim());
    if (parts.length < 2) {
      return { type: 'error', message: 'Format: report - 2026/05 or report - list' };
    }

    const sub = parts[1].toLowerCase();
    if (sub === 'list') {
      return { type: 'report_list' };
    }

    const yearMonth = parseYearMonth(parts[1]);
    if (!yearMonth) {
      return { type: 'error', message: 'Invalid month format. Use: report - 2026/05' };
    }

    return { type: 'report', yearMonth };
  }

  let body = trimmed;
  if (lower.startsWith('out')) {
    const parts = trimmed.split(/\s*-\s*/).map((p) => p.trim());
    if (parts.length < 3) {
      return {
        type: 'error',
        message: 'Format: out - category - amount - detail (detail optional)\nExample: out - snacks - 5000 - coffee',
      };
    }
    const [, category, amountRaw, ...detailParts] = parts;
    const amount = parseAmount(amountRaw);
    if (!amount) {
      return { type: 'error', message: 'Invalid amount. Example: 5000 or 15000' };
    }
    if (!category) {
      return { type: 'error', message: 'Category is required.' };
    }

    return {
      type: 'expense',
      category,
      amount,
      detail: detailParts.join(' - ').trim() || null,
    };
  }

  const parts = trimmed.split(/\s*-\s*/).map((p) => p.trim());
  if (parts.length >= 2) {
    const [category, amountRaw, ...detailParts] = parts;
    const amount = parseAmount(amountRaw);
    if (amount && category) {
      return {
        type: 'expense',
        category,
        amount,
        detail: detailParts.join(' - ').trim() || null,
      };
    }
  }

  if (isGreeting(trimmed)) {
    return { type: 'greeting' };
  }

  return { type: 'unknown' };
}

const LINE = '────────────────────';

function formatHelpMessage() {
  return [
    '📒 *FINANCE BOT*',
    '_Group expense tracker_',
    '',
    LINE,
    '⚡ *GENERAL*',
    LINE,
    '',
    '▸ *ping*',
    '  Check if the bot is online',
    '',
    '▸ *help* · *menu*',
    '  Show this guide',
    '',
    LINE,
    '💸 *RECORD EXPENSE*',
    LINE,
    '',
    '▸ *out - category - amount - detail*',
    '  Record a new transaction',
    '  _(detail is optional)_',
    '',
    '  Example:',
    '  out - snacks - 5000 - coffee',
    '',
    '  Short form:',
    '  snacks - 5000 - coffee',
    '',
    LINE,
    '📋 *VIEW & DELETE*',
    LINE,
    '',
    '▸ *show*',
    "  View today's expenses",
    '  _(shows ID, category, amount)_',
    '',
    '▸ *delete - id*',
    '  Remove a transaction',
    '',
    '  Example:',
    '  delete - 3',
    '',
    LINE,
    '📊 *REPORTS*',
    LINE,
    '',
    '▸ *report - 2026/05*',
    '  Download monthly PDF',
    '',
    '▸ *report - list*',
    '  List months with data',
    '',
    LINE,
    '💡 Type *help* anytime to open this menu',
  ].join('\n');
}

function formatPingMessage(monthLabel) {
  return [
    '🏓 *Pong!* Bot is online.',
    `📅 Current month: *${monthLabel}*`,
    '',
    'Type *help* to see all commands.',
  ].join('\n');
}

function formatGreetingMessage(name) {
  return `Hi *${name}*, I'm your expense tracker bot. Type *help* to see the command list!`;
}

function formatUnknownMessage() {
  return "I didn't understand that command. Type *help* to see what I can do.";
}

function currentYearMonth() {
  return now().format('YYYY-MM');
}

function currentDate() {
  return now().format('YYYY-MM-DD');
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split('-');
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

function formatDateLabel(dateStr) {
  const d = dayjs.tz(dateStr, TZ);
  return `${d.date()} ${MONTH_NAMES[d.month()]} ${d.year()}`;
}

function formatDayExpenses(expenses, dateLabel) {
  if (expenses.length === 0) {
    return [
      "📋 *Today's Expenses*",
      `📅 ${dateLabel}`,
      '',
      '_No transactions yet._',
      '',
      'Record with:',
      'out - category - amount - detail',
    ].join('\n');
  }

  const lines = expenses.map((e) => {
    const detail = e.detail ? `\n     📝 ${e.detail}` : '';
    return `  *#${e.id}*  ${e.category}\n     💰 ${formatRupiah(e.amount)}${detail}`;
  });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return [
    "📋 *Today's Expenses*",
    `📅 ${dateLabel}`,
    '',
    ...lines,
    '',
    LINE,
    `💰 *Total:* ${formatRupiah(total)}`,
    '',
    '_Delete:_ delete - id',
  ].join('\n');
}

module.exports = {
  parseMessage,
  currentYearMonth,
  currentDate,
  formatRupiah,
  formatMonthLabel,
  formatDateLabel,
  formatDayExpenses,
  formatHelpMessage,
  formatPingMessage,
  formatGreetingMessage,
  formatUnknownMessage,
  now,
};
