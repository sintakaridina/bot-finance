const db = require('../index');

function listByGroup(group, { month, date } = {}) {
  let sql = `SELECT * FROM expenses WHERE chat_id = ? AND bot_instance_id = ?`;
  const params = [group.chat_id, group.bot_instance_id];

  if (month) {
    sql += ` AND year_month = ?`;
    params.push(month);
  }
  if (date) {
    sql += ` AND expense_date = ?`;
    params.push(date);
  }
  sql += ` ORDER BY expense_date DESC, id DESC`;
  return db.prepare(sql).all(...params);
}

function findById(id) {
  return db.prepare(`SELECT * FROM expenses WHERE id = ?`).get(id);
}

function create({ botInstanceId, chatId, category, amount, detail, expenseDate, yearMonth }) {
  const r = db.prepare(`
    INSERT INTO expenses (bot_instance_id, chat_id, category, amount, detail, expense_date, year_month)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(botInstanceId, chatId, category, amount, detail || null, expenseDate, yearMonth);
  return findById(r.lastInsertRowid);
}

function update(id, { category, amount, detail, expenseDate, yearMonth }) {
  db.prepare(`
    UPDATE expenses SET category = ?, amount = ?, detail = ?, expense_date = ?, year_month = ?
    WHERE id = ?
  `).run(category, amount, detail || null, expenseDate, yearMonth, id);
  return findById(id);
}

function remove(id) {
  db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id);
}

function getMonthExpenses(chatId, botInstanceId, yearMonth) {
  return db.prepare(`
    SELECT id, category, amount, detail, expense_date, created_at
    FROM expenses WHERE chat_id = ? AND bot_instance_id = ? AND year_month = ?
    ORDER BY expense_date ASC, id ASC
  `).all(chatId, botInstanceId, yearMonth);
}

function getDayExpenses(chatId, botInstanceId, expenseDate) {
  return db.prepare(`
    SELECT id, category, amount, detail, expense_date, created_at
    FROM expenses WHERE chat_id = ? AND bot_instance_id = ? AND expense_date = ?
    ORDER BY id ASC
  `).all(chatId, botInstanceId, expenseDate);
}

function listMonths(chatId, botInstanceId) {
  return db.prepare(`
    SELECT year_month, COUNT(*) as count, SUM(amount) as total
    FROM expenses WHERE chat_id = ? AND bot_instance_id = ?
    GROUP BY year_month ORDER BY year_month DESC
  `).all(chatId, botInstanceId);
}

function deleteByChat(chatId, botInstanceId, id) {
  const row = db.prepare(
    `SELECT * FROM expenses WHERE id = ? AND chat_id = ? AND bot_instance_id = ?`
  ).get(id, chatId, botInstanceId);
  if (!row) return null;
  db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id);
  return row;
}

function countAll() {
  return db.prepare(`SELECT COUNT(*) as c FROM expenses`).get().c;
}

function statsForBot(botInstanceId) {
  return db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total
    FROM expenses WHERE bot_instance_id = ? AND year_month = strftime('%Y-%m', 'now')
  `).get(botInstanceId);
}

module.exports = {
  listByGroup, findById, create, update, remove,
  getMonthExpenses, getDayExpenses, listMonths, deleteByChat,
  countAll, statsForBot,
};
