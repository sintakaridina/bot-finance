const { MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const groupsRepo = require('../db/repositories/groups');
const expensesRepo = require('../db/repositories/expenses');
const { render } = require('../services/templateRenderer');
const {
  parseMessage,
  currentYearMonth,
  currentDate,
  formatRupiah,
  formatMonthLabel,
  formatDateLabel,
  formatDayExpenses,
  formatMonthExpenses,
} = require('../../../src/parser');

async function getDisplayName(msg) {
  try {
    const contact = await msg.getContact();
    return contact.pushname || contact.name || contact.shortName || 'there';
  } catch {
    return 'there';
  }
}

function detailLine(detail) {
  return detail ? `\n📝 ${detail}` : '';
}

function flowLabel(type) {
  return type === 'in' ? 'IN' : 'OUT';
}

function createMessageHandler({ botInstanceId, getClient }) {
  return async function handleMessage(msg) {
    const text = msg.body?.trim();
    if (!text) return;

    const chat = await msg.getChat();
    const chatId = chat.id._serialized;
    if (chat.isGroup && chat.name) {
      groupsRepo.upsert(botInstanceId, chatId, chat.name);
    } else {
      groupsRepo.upsert(botInstanceId, chatId, null);
    }

    const parsed = parseMessage(text);
    const client = getClient();

    switch (parsed.type) {
      case 'ping': {
        const month = formatMonthLabel(currentYearMonth());
        const body = render('ping', { month }) || `🏓 Pong! ${month}`;
        await msg.reply(body);
        break;
      }

      case 'greeting': {
        const name = await getDisplayName(msg);
        const body = render('greeting', { name }) || `Hi ${name}!`;
        await msg.reply(body);
        break;
      }

      case 'unknown': {
        await msg.reply(render('unknown') || 'Type *help* for commands.');
        break;
      }

      case 'expense': {
        const yearMonth = currentYearMonth();
        const expenseDate = currentDate();
        const expense = expensesRepo.create({
          botInstanceId,
          chatId,
          type: 'out',
          category: parsed.category,
          amount: parsed.amount,
          detail: parsed.detail,
          expenseDate,
          yearMonth,
        });
        const body = render('expense_saved', {
          id: expense.id,
          category: parsed.category,
          amount: formatRupiah(parsed.amount),
          detail_line: detailLine(parsed.detail),
          month: formatMonthLabel(yearMonth),
        });
        await msg.reply(body || `✅ Saved #${expense.id}`);
        break;
      }

      case 'income': {
        const yearMonth = currentYearMonth();
        const expenseDate = currentDate();
        const income = expensesRepo.create({
          botInstanceId,
          chatId,
          type: 'in',
          category: parsed.category,
          amount: parsed.amount,
          detail: parsed.detail,
          expenseDate,
          yearMonth,
        });
        const body = render('income_saved', {
          id: income.id,
          category: parsed.category,
          amount: formatRupiah(parsed.amount),
          detail_line: detailLine(parsed.detail),
          month: formatMonthLabel(yearMonth),
        });
        await msg.reply(body || `✅ Saved #${income.id}`);
        break;
      }

      case 'show': {
        if (parsed.scope === 'month') {
          const yearMonth = currentYearMonth();
          const expenses = expensesRepo.getMonthExpenses(chatId, botInstanceId, yearMonth);
          await msg.reply(formatMonthExpenses(expenses, formatMonthLabel(yearMonth)));
        } else {
          const expenseDate = currentDate();
          const expenses = expensesRepo.getDayExpenses(chatId, botInstanceId, expenseDate);
          await msg.reply(formatDayExpenses(expenses, formatDateLabel(expenseDate)));
        }
        break;
      }

      case 'delete': {
        const deleted = expensesRepo.deleteByChat(chatId, botInstanceId, parsed.id);
        if (!deleted) {
          await msg.reply(`⚠️ ID *#${parsed.id}* not found.\n\nCheck the list with *show*`);
          break;
        }
        const body = render('delete_success', {
          id: deleted.id,
          flow: flowLabel(deleted.type),
          category: deleted.category,
          amount: formatRupiah(deleted.amount),
          detail_line: detailLine(deleted.detail),
        });
        await msg.reply(body || `🗑️ Deleted #${deleted.id}`);
        break;
      }

      case 'report_list': {
        const months = expensesRepo.listMonths(chatId, botInstanceId);
        if (months.length === 0) {
          await msg.reply([
            '📊 *Available Months*', '', '_No data yet._', '',
            'Record income: in - category - amount - detail',
            'Record expense: out - category - amount - detail',
          ].join('\n'));
          break;
        }
        const lines = months.map((m) => {
          const label = formatMonthLabel(m.year_month);
          const net = m.total_in - m.total_out;
          return [
            `▸ *${label}*`,
            `  ${m.count} transactions`,
            `  📥 ${formatRupiah(m.total_in)} · 📤 ${formatRupiah(m.total_out)} · 💰 Net ${formatRupiah(net)}`,
          ].join('\n');
        });
        await msg.reply(['📊 *Available Months*', '', ...lines, '', 'report - YYYY/MM'].join('\n'));
        break;
      }

      case 'report': {
        const expenses = expensesRepo.getMonthExpenses(chatId, botInstanceId, parsed.yearMonth);
        if (!expenses.length) {
          await msg.reply(`No data for *${formatMonthLabel(parsed.yearMonth)}*.`);
          break;
        }
        await msg.reply(`⏳ Generating report for ${formatMonthLabel(parsed.yearMonth)}...`);
        const { generateReport } = require('../../../src/report');
        const pdfPath = await generateReport({ chatId, yearMonth: parsed.yearMonth, expenses });
        const media = MessageMedia.fromFilePath(pdfPath);
        const { totalIn, totalOut, net } = expensesRepo.sumTotals(expenses);
        await client.sendMessage(chatId, media, {
          caption: [
            `📊 *Report ${formatMonthLabel(parsed.yearMonth)}*`,
            `${expenses.length} transactions`,
            `📥 Income ${formatRupiah(totalIn)} · 📤 Expenses ${formatRupiah(totalOut)}`,
            `💰 Net ${formatRupiah(net)}`,
          ].join('\n'),
        });
        fs.unlink(pdfPath, () => {});
        break;
      }

      case 'error':
        await msg.reply(`⚠️ ${parsed.message}`);
        break;

      case 'help':
        await msg.reply(render('help') || 'Type: in/out - category - amount');
        break;

      default:
        break;
    }
  };
}

module.exports = { createMessageHandler };
