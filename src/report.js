const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatMoney } = require('./currency');
const { formatMonthLabel } = require('./parser');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

const PAGE = { w: 595.28, h: 841.89, margin: 48 };
const CONTENT_W = PAGE.w - PAGE.margin * 2;

const COLORS = {
  primary: '#0f172a',
  accent: '#4f46e5',
  accentLight: '#eef2ff',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  rowAlt: '#f8fafc',
  white: '#ffffff',
  income: '#15803d',
  expense: '#b91c1c',
  net: '#0f172a',
};

const CATEGORY_PALETTE = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#64748b',
];

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function categoryColor(category, index) {
  const key = category.toLowerCase();
  const map = {
    makanan: '#ef4444',
    jajan: '#f59e0b',
    transport: '#3b82f6',
    transportasi: '#3b82f6',
    belanja: '#8b5cf6',
    tagihan: '#14b8a6',
    hiburan: '#f97316',
    kesehatan: '#10b981',
    gaji: '#15803d',
    salary: '#15803d',
  };
  return map[key] || CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

function formatAmount(amount) {
  return formatMoney(amount);
}

function formatShortDate(dateStr) {
  const [, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]}`;
}

function generatedAt() {
  return new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sumTotals(expenses) {
  let totalIn = 0;
  let totalOut = 0;
  for (const e of expenses) {
    if (e.type === 'in') totalIn += e.amount;
    else totalOut += e.amount;
  }
  return { totalIn, totalOut, net: totalIn - totalOut };
}

function groupByCategory(expenses, type) {
  const filtered = expenses.filter((e) => e.type === type);
  const byCategory = {};
  for (const exp of filtered) {
    if (!byCategory[exp.category]) byCategory[exp.category] = { total: 0, items: [] };
    byCategory[exp.category].total += exp.amount;
    byCategory[exp.category].items.push(exp);
  }
  return Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
}

function ensureSpace(doc, needed) {
  if (doc.y + needed > PAGE.h - 60) {
    addPageWithFooter(doc);
    return true;
  }
  return false;
}

function drawPageFooter(doc) {
  const y = PAGE.h - 36;
  doc.save();
  doc.strokeColor(COLORS.border).lineWidth(0.5)
    .moveTo(PAGE.margin, y).lineTo(PAGE.w - PAGE.margin, y).stroke();
  doc.fontSize(7.5).fillColor(COLORS.muted)
    .text(`Finance Bot  ·  ${generatedAt()} WIB`, PAGE.margin, y + 8, {
      width: CONTENT_W,
      align: 'center',
      lineBreak: false,
    });
  doc.restore();
}

function addPageWithFooter(doc) {
  drawPageFooter(doc);
  doc.addPage();
}

function drawHeader(doc, yearMonth, totals, txCount) {
  const headerH = 88;

  doc.save();
  doc.rect(0, 0, PAGE.w, headerH).fill(COLORS.primary);
  doc.rect(0, headerH - 4, PAGE.w, 4).fill(COLORS.accent);

  doc.fillColor(COLORS.white).fontSize(20)
    .text('Finance Report', PAGE.margin, 26, { width: CONTENT_W });

  doc.fontSize(11).fillColor('#94a3b8')
    .text(formatMonthLabel(yearMonth), PAGE.margin, 52);

  doc.fontSize(9).fillColor('#64748b')
    .text('Finance Bot', PAGE.margin, 68, { width: CONTENT_W, align: 'right' });

  doc.restore();

  doc.y = headerH + 24;

  const cardY = doc.y;
  const cardH = 62;
  const gap = 8;
  const cardW = (CONTENT_W - gap * 3) / 4;

  const stats = [
    { label: 'Income', value: formatAmount(totals.totalIn), color: COLORS.income },
    { label: 'Expenses', value: formatAmount(totals.totalOut), color: COLORS.expense },
    { label: 'Net Balance', value: formatAmount(totals.net), color: COLORS.net },
    { label: 'Transactions', value: String(txCount), color: COLORS.accent },
  ];

  stats.forEach((stat, i) => {
    const x = PAGE.margin + i * (cardW + gap);
    doc.roundedRect(x, cardY, cardW, cardH, 6)
      .fillAndStroke(COLORS.rowAlt, COLORS.border);

    doc.fontSize(7.5).fillColor(COLORS.muted)
      .text(stat.label, x + 10, cardY + 12, { width: cardW - 20 });

    doc.fontSize(stat.label === 'Transactions' ? 14 : 11).fillColor(stat.color)
      .text(stat.value, x + 10, cardY + 28, { width: cardW - 20 });
  });

  doc.y = cardY + cardH + 28;
}

function drawSectionTitle(doc, title) {
  ensureSpace(doc, 40);
  const y = doc.y;

  doc.save();
  doc.rect(PAGE.margin, y, 3, 16).fill(COLORS.accent);
  doc.fontSize(12).fillColor(COLORS.text)
    .text(title, PAGE.margin + 12, y + 1);
  doc.restore();

  doc.y = y + 28;
}

function drawCategoryBreakdown(doc, title, sortedCategories, total, barColor) {
  if (!sortedCategories.length) return;

  drawSectionTitle(doc, title);

  const labelW = 90;
  const amountW = 100;
  const barX = PAGE.margin + labelW + 8;
  const barMaxW = CONTENT_W - labelW - amountW - 16;
  const rowH = 22;

  for (let i = 0; i < sortedCategories.length; i++) {
    const [cat, data] = sortedCategories[i];
    ensureSpace(doc, rowH + 4);

    const y = doc.y;
    const pct = total > 0 ? (data.total / total) * 100 : 0;
    const barW = total > 0 ? Math.max(4, (data.total / total) * barMaxW) : 0;
    const color = categoryColor(cat, i);

    doc.fontSize(9).fillColor(COLORS.text)
      .text(cat, PAGE.margin, y + 5, { width: labelW, ellipsis: true });

    doc.roundedRect(barX, y + 4, barMaxW, 12, 3).fill(COLORS.border);
    if (barW > 0) doc.roundedRect(barX, y + 4, barW, 12, 3).fill(color);

    doc.fontSize(8.5).fillColor(barColor)
      .text(
        `${formatAmount(data.total)}  ·  ${pct.toFixed(1)}%`,
        PAGE.w - PAGE.margin - amountW,
        y + 5,
        { width: amountW, align: 'right' }
      );

    doc.y = y + rowH;
  }

  doc.y += 16;
}

function drawTableHeader(doc, y) {
  const cols = {
    no: { x: PAGE.margin, w: 24 },
    type: { x: PAGE.margin + 24, w: 28 },
    date: { x: PAGE.margin + 52, w: 48 },
    category: { x: PAGE.margin + 100, w: 72 },
    detail: { x: PAGE.margin + 172, w: 200 },
    amount: { x: PAGE.margin + 372, w: CONTENT_W - 372 },
  };

  doc.save();
  doc.rect(PAGE.margin, y, CONTENT_W, 22).fill(COLORS.primary);

  const headers = [
    ['#', cols.no],
    ['Type', cols.type],
    ['Date', cols.date],
    ['Category', cols.category],
    ['Detail', cols.detail],
    ['Amount', cols.amount],
  ];

  doc.fontSize(8).fillColor(COLORS.white);
  for (const [label, col] of headers) {
    const align = label === 'Amount' ? 'right' : 'left';
    doc.text(label, col.x + 4, y + 7, { width: col.w - 8, align });
  }
  doc.restore();

  return { cols, headerH: 22 };
}

function drawTransactionTable(doc, expenses, categoryIndex) {
  drawSectionTitle(doc, 'Transaction Details');

  const rowH = 20;
  let tableTop = doc.y;
  let { cols, headerH } = drawTableHeader(doc, tableTop);
  let rowY = tableTop + headerH;
  let rowNum = 0;

  const sorted = [...expenses].sort((a, b) => {
    if (a.expense_date !== b.expense_date) return a.expense_date.localeCompare(b.expense_date);
    return a.id - b.id;
  });

  for (const item of sorted) {
    if (rowY + rowH > PAGE.h - 60) {
      addPageWithFooter(doc);
      tableTop = PAGE.margin;
      ({ cols, headerH } = drawTableHeader(doc, tableTop));
      rowY = tableTop + headerH;
    }

    const bg = rowNum % 2 === 0 ? COLORS.white : COLORS.rowAlt;
    doc.rect(PAGE.margin, rowY, CONTENT_W, rowH).fill(bg);

    doc.strokeColor(COLORS.border).lineWidth(0.25)
      .moveTo(PAGE.margin, rowY + rowH)
      .lineTo(PAGE.margin + CONTENT_W, rowY + rowH).stroke();

    const isIncome = item.type === 'in';
    const amountColor = isIncome ? COLORS.income : COLORS.expense;
    const catIdx = categoryIndex.get(item.category) ?? 0;

    doc.fontSize(8).fillColor(COLORS.muted)
      .text(String(item.id), cols.no.x + 4, rowY + 6, { width: cols.no.w - 8 });

    doc.fillColor(amountColor)
      .text(isIncome ? 'IN' : 'OUT', cols.type.x + 4, rowY + 6, { width: cols.type.w - 8 });

    doc.fillColor(COLORS.text)
      .text(formatShortDate(item.expense_date), cols.date.x + 4, rowY + 6, { width: cols.date.w - 8 });

    doc.fillColor(categoryColor(item.category, catIdx))
      .text(item.category, cols.category.x + 4, rowY + 6, { width: cols.category.w - 8, ellipsis: true });

    doc.fillColor(COLORS.muted)
      .text(item.detail || '—', cols.detail.x + 4, rowY + 6, { width: cols.detail.w - 8, ellipsis: true });

    doc.fillColor(amountColor)
      .text(formatAmount(item.amount), cols.amount.x + 4, rowY + 6, {
        width: cols.amount.w - 8,
        align: 'right',
      });

    rowY += rowH;
    rowNum++;
  }

  const totals = sumTotals(expenses);
  doc.save();
  doc.rect(PAGE.margin, rowY, CONTENT_W, 36).fill(COLORS.accentLight);
  doc.fontSize(8.5).fillColor(COLORS.income)
    .text(`Income: ${formatAmount(totals.totalIn)}`, PAGE.margin + 12, rowY + 8);
  doc.fillColor(COLORS.expense)
    .text(`Expenses: ${formatAmount(totals.totalOut)}`, PAGE.margin + 12, rowY + 20);
  doc.fontSize(10).fillColor(COLORS.net)
    .text(`Net: ${formatAmount(totals.net)}`, cols.amount.x + 4, rowY + 12, {
      width: cols.amount.w - 8,
      align: 'right',
    });
  doc.restore();

  doc.y = rowY + 48;
}

function generateReport({ chatId, yearMonth, expenses }) {
  const filename = `report-${yearMonth}-${chatId.replace(/[^a-zA-Z0-9]/g, '')}.pdf`;
  const filepath = path.join(REPORTS_DIR, filename);

  const totals = sumTotals(expenses);
  const incomeCategories = groupByCategory(expenses, 'in');
  const expenseCategories = groupByCategory(expenses, 'out');
  const allCategories = [...incomeCategories, ...expenseCategories];
  const categoryIndex = new Map(allCategories.map(([cat], i) => [cat, i]));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
      bufferPages: true,
    });
    const stream = fs.createWriteStream(filepath);

    doc.pipe(stream);

    drawHeader(doc, yearMonth, totals, expenses.length);
    drawCategoryBreakdown(doc, 'Income by Category', incomeCategories, totals.totalIn, COLORS.income);
    drawCategoryBreakdown(doc, 'Expenses by Category', expenseCategories, totals.totalOut, COLORS.expense);
    drawTransactionTable(doc, expenses, categoryIndex);

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      drawPageFooter(doc);
    }

    doc.end();

    stream.on('finish', () => resolve(filepath));
    stream.on('error', reject);
  });
}

module.exports = { generateReport, REPORTS_DIR, sumTotals };
