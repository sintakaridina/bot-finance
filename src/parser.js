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
    return { type: 'show', scope: 'day' };
  }

  if (lower.startsWith('show')) {
    const parts = trimmed.split(/\s*-\s*/).map((p) => p.trim());
    if (parts[0].toLowerCase() === 'show' && parts.length >= 2) {
      if (parts[1].toLowerCase() === 'all') {
        return { type: 'show', scope: 'month' };
      }
      return { type: 'error', message: 'Format: show or show - all' };
    }
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

  if (lower.startsWith('in')) {
    const parts = trimmed.split(/\s*-\s*/).map((p) => p.trim());
    if (parts[0].toLowerCase() === 'in') {
      if (parts.length < 3) {
        return {
          type: 'error',
          message: 'Format: in - category - amount - detail (detail optional)\nExample: in - salary - 5000000 - March payroll',
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
        type: 'income',
        category,
        amount,
        detail: detailParts.join(' - ').trim() || null,
      };
    }
  }

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
    '_Group finance tracker_',
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
    '💰 *RECORD INCOME*',
    LINE,
    '',
    '▸ *in - category - amount - detail*',
    '  Record money received',
    '  _(detail is optional)_',
    '',
    '  Example:',
    '  in - salary - 5000000 - March payroll',
    '',
    LINE,
    '💸 *RECORD EXPENSE*',
    LINE,
    '',
    '▸ *out - category - amount - detail*',
    '  Record money spent',
    '  _(detail is optional)_',
    '',
    '  Example:',
    '  out - snacks - 5000 - coffee',
    '',
    '  Short form (expense only):',
    '  snacks - 5000 - coffee',
    '',
    LINE,
    '📋 *VIEW & DELETE*',
    LINE,
    '',
    '▸ *show*',
    "  View today's transactions",
    '',
    '▸ *show - all*',
    '  View this month\'s transactions',
    '  _(shows ID, type, category, amount)_',
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
  return `Hi *${name}*, I'm your group finance tracker bot. Type *help* to see the command list!`;
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

function formatShortDay(dateStr) {
  const d = dayjs.tz(dateStr, TZ);
  return `${d.date()} ${MONTH_NAMES[d.month()].slice(0, 3)}`;
}

function sumTransactions(expenses) {
  let totalIn = 0;
  let totalOut = 0;
  for (const e of expenses) {
    if (e.type === 'in') totalIn += e.amount;
    else totalOut += e.amount;
  }
  return { totalIn, totalOut, net: totalIn - totalOut };
}

function formatTransactionList(expenses, { title, periodLabel, showDate = false, maxItems = 50 }) {
  if (expenses.length === 0) {
    return [
      title,
      `📅 ${periodLabel}`,
      '',
      '_No transactions yet._',
      '',
      'Record income:',
      'in - category - amount - detail',
      '',
      'Record expense:',
      'out - category - amount - detail',
    ].join('\n');
  }

  const visible = expenses.slice(0, maxItems);
  const hidden = expenses.length - visible.length;

  const lines = visible.map((e) => {
    const detail = e.detail ? `\n     📝 ${e.detail}` : '';
    const flow = e.type === 'in' ? '📥 IN' : '📤 OUT';
    const dateSuffix = showDate ? ` · ${formatShortDay(e.expense_date)}` : '';
    return `  *#${e.id}*  ${flow} · ${e.category}${dateSuffix}\n     💰 ${formatRupiah(e.amount)}${detail}`;
  });

  const { totalIn, totalOut, net } = sumTransactions(expenses);

  const parts = [
    title,
    `📅 ${periodLabel}`,
    '',
    ...lines,
  ];

  if (hidden > 0) {
    parts.push('', `_...and ${hidden} more. Download the monthly PDF with *report - YYYY/MM*._`);
  }

  parts.push(
    '',
    LINE,
    `📥 *Income:* ${formatRupiah(totalIn)}`,
    `📤 *Expenses:* ${formatRupiah(totalOut)}`,
    `💰 *Net:* ${formatRupiah(net)}`,
    '',
    '_Delete:_ delete - id',
  );

  return parts.join('\n');
}

function formatDayExpenses(expenses, dateLabel) {
  return formatTransactionList(expenses, {
    title: "📋 *Today's Transactions*",
    periodLabel: dateLabel,
    showDate: false,
  });
}

function formatMonthExpenses(expenses, monthLabel) {
  return formatTransactionList(expenses, {
    title: "📋 *This Month's Transactions*",
    periodLabel: monthLabel,
    showDate: true,
  });
}

module.exports = {
  parseMessage,
  currentYearMonth,
  currentDate,
  formatRupiah,
  formatMonthLabel,
  formatDateLabel,
  formatDayExpenses,
  formatMonthExpenses,
  formatTransactionList,
  formatHelpMessage,
  formatPingMessage,
  formatGreetingMessage,
  formatUnknownMessage,
  now,
};
