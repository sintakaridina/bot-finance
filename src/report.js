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
  amount: '#b91c1c',
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

function drawHeader(doc, yearMonth, total, txCount, catCount) {
  const headerH = 88;

  doc.save();
  doc.rect(0, 0, PAGE.w, headerH).fill(COLORS.primary);

  doc.rect(0, headerH - 4, PAGE.w, 4).fill(COLORS.accent);

  doc.fillColor(COLORS.white).fontSize(20)
    .text('Expense Report', PAGE.margin, 26, { width: CONTENT_W });

  doc.fontSize(11).fillColor('#94a3b8')
    .text(formatMonthLabel(yearMonth), PAGE.margin, 52);

  doc.fontSize(9).fillColor('#64748b')
    .text('Finance Bot', PAGE.margin, 68, { width: CONTENT_W, align: 'right' });

  doc.restore();

  doc.y = headerH + 24;

  const cardY = doc.y;
  const cardH = 62;
  const gap = 10;
  const cardW = (CONTENT_W - gap * 2) / 3;

  const stats = [
    { label: 'Total Expenses', value: formatAmount(total), color: COLORS.amount },
    { label: 'Transactions', value: String(txCount), color: COLORS.primary },
    { label: 'Categories', value: String(catCount), color: COLORS.accent },
  ];

  stats.forEach((stat, i) => {
    const x = PAGE.margin + i * (cardW + gap);
    doc.roundedRect(x, cardY, cardW, cardH, 6)
      .fillAndStroke(COLORS.rowAlt, COLORS.border);

    doc.fontSize(8).fillColor(COLORS.muted)
      .text(stat.label, x + 12, cardY + 12, { width: cardW - 24 });

    doc.fontSize(stat.label === 'Total Expenses' ? 13 : 16).fillColor(stat.color)
      .text(stat.value, x + 12, cardY + 28, { width: cardW - 24 });
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

function drawCategoryBreakdown(doc, sortedCategories, total) {
  drawSectionTitle(doc, 'Summary by Category');

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

    doc.roundedRect(barX, y + 4, barMaxW, 12, 3)
      .fill(COLORS.border);

    if (barW > 0) {
      doc.roundedRect(barX, y + 4, barW, 12, 3).fill(color);
    }

    doc.fontSize(8.5).fillColor(COLORS.muted)
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
    no: { x: PAGE.margin, w: 28 },
    date: { x: PAGE.margin + 28, w: 52 },
    category: { x: PAGE.margin + 80, w: 80 },
    detail: { x: PAGE.margin + 160, w: 230 },
    amount: { x: PAGE.margin + 390, w: CONTENT_W - 390 },
  };

  doc.save();
  doc.rect(PAGE.margin, y, CONTENT_W, 22).fill(COLORS.primary);

  const headers = [
    ['#', cols.no],
    ['Date', cols.date],
    ['Category', cols.category],
    ['Detail', cols.detail],
    ['Amount', cols.amount],
  ];

  doc.fontSize(8).fillColor(COLORS.white);
  for (const [label, col] of headers) {
    const align = label === 'Amount' ? 'right' : 'left';
    doc.text(label, col.x + 6, y + 7, { width: col.w - 12, align });
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

    const catIdx = categoryIndex.get(item.category) ?? 0;
    const catColor = categoryColor(item.category, catIdx);

    doc.fontSize(8).fillColor(COLORS.muted)
      .text(String(item.id), cols.no.x + 6, rowY + 6, { width: cols.no.w - 12 });

    doc.fillColor(COLORS.text)
      .text(formatShortDate(item.expense_date), cols.date.x + 6, rowY + 6, { width: cols.date.w - 12 });

    doc.fillColor(catColor)
      .text(item.category, cols.category.x + 6, rowY + 6, { width: cols.category.w - 12, ellipsis: true });

    doc.fillColor(COLORS.muted)
      .text(item.detail || '—', cols.detail.x + 6, rowY + 6, { width: cols.detail.w - 12, ellipsis: true });

    doc.fillColor(COLORS.amount)
      .text(formatAmount(item.amount), cols.amount.x + 6, rowY + 6, {
        width: cols.amount.w - 12,
        align: 'right',
      });

    rowY += rowH;
    rowNum++;
  }

  doc.save();
  doc.rect(PAGE.margin, rowY, CONTENT_W, 24).fill(COLORS.accentLight);
  doc.fontSize(9).fillColor(COLORS.primary)
    .text('TOTAL', PAGE.margin + 160, rowY + 8);
  doc.fontSize(10).fillColor(COLORS.amount)
    .text(
      formatAmount(expenses.reduce((s, e) => s + e.amount, 0)),
      cols.amount.x + 6,
      rowY + 7,
      { width: cols.amount.w - 12, align: 'right' }
    );
  doc.restore();

  doc.y = rowY + 36;
}

function generateReport({ chatId, yearMonth, expenses }) {
  const filename = `report-${yearMonth}-${chatId.replace(/[^a-zA-Z0-9]/g, '')}.pdf`;
  const filepath = path.join(REPORTS_DIR, filename);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const byCategory = {};
  for (const exp of expenses) {
    if (!byCategory[exp.category]) {
      byCategory[exp.category] = { total: 0, items: [] };
    }
    byCategory[exp.category].total += exp.amount;
    byCategory[exp.category].items.push(exp);
  }

  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
  const categoryIndex = new Map(sortedCategories.map(([cat], i) => [cat, i]));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
      bufferPages: true,
    });
    const stream = fs.createWriteStream(filepath);

    doc.pipe(stream);

    drawHeader(doc, yearMonth, total, expenses.length, sortedCategories.length);
    drawCategoryBreakdown(doc, sortedCategories, total);
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

module.exports = { generateReport, REPORTS_DIR };
