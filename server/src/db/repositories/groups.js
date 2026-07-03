const db = require('../index');

function upsert(botInstanceId, chatId, name) {
  const existing = db.prepare(
    `SELECT id FROM groups WHERE bot_instance_id = ? AND chat_id = ?`
  ).get(botInstanceId, chatId);

  if (existing) {
    if (name) {
      db.prepare(`
        UPDATE groups SET name = ?, last_activity_at = datetime('now') WHERE id = ?
      `).run(name, existing.id);
    } else {
      db.prepare(`
        UPDATE groups SET last_activity_at = datetime('now') WHERE id = ?
      `).run(existing.id);
    }
    return existing.id;
  }

  const r = db.prepare(`
    INSERT INTO groups (bot_instance_id, chat_id, name, last_activity_at) VALUES (?, ?, ?, datetime('now'))
  `).run(botInstanceId, chatId, name || null);
  return r.lastInsertRowid;
}

function updateName(botInstanceId, chatId, name) {
  if (!name) return;
  db.prepare(`
    UPDATE groups SET name = ? WHERE bot_instance_id = ? AND chat_id = ?
  `).run(name, botInstanceId, chatId);
}

function listChatIds(botInstanceId) {
  return db.prepare(`
    SELECT chat_id FROM groups WHERE bot_instance_id = ?
  `).all(botInstanceId);
}

function resolveDisplayName(name, chatId) {
  if (!name) return null;
  const idPart = chatId?.includes('@') ? chatId.split('@')[0] : chatId;
  if (name === idPart || /^\d{10,}$/.test(name)) return null;
  return name;
}

function withDisplayName(row) {
  return { ...row, display_name: resolveDisplayName(row.name, row.chat_id) };
}

function findById(id) {
  const row = db.prepare(`
    SELECT g.*, b.user_id, u.username as owner_username
    FROM groups g
    JOIN bot_instances b ON b.id = g.bot_instance_id
    JOIN users u ON u.id = b.user_id
    WHERE g.id = ?
  `).get(id);
  return row ? withDisplayName(row) : null;
}

function listForUser(userId, isAdmin) {
  let rows;
  if (isAdmin) {
    rows = db.prepare(`
      SELECT g.*, b.user_id, u.username as owner_username, u.display_name as owner_name,
        (SELECT COUNT(*) FROM expenses e WHERE e.chat_id = g.chat_id AND e.bot_instance_id = g.bot_instance_id) as expense_count,
        (SELECT COALESCE(SUM(CASE WHEN e.type = 'in' THEN e.amount ELSE 0 END), 0) FROM expenses e WHERE e.chat_id = g.chat_id AND e.bot_instance_id = g.bot_instance_id) as total_in,
        (SELECT COALESCE(SUM(CASE WHEN e.type = 'out' THEN e.amount ELSE 0 END), 0) FROM expenses e WHERE e.chat_id = g.chat_id AND e.bot_instance_id = g.bot_instance_id) as total_out
      FROM groups g
      JOIN bot_instances b ON b.id = g.bot_instance_id
      JOIN users u ON u.id = b.user_id
      ORDER BY g.last_activity_at IS NULL, g.last_activity_at DESC
    `).all();
  } else {
    rows = db.prepare(`
      SELECT g.*, b.user_id,
        (SELECT COUNT(*) FROM expenses e WHERE e.chat_id = g.chat_id AND e.bot_instance_id = g.bot_instance_id) as expense_count,
        (SELECT COALESCE(SUM(CASE WHEN e.type = 'in' THEN e.amount ELSE 0 END), 0) FROM expenses e WHERE e.chat_id = g.chat_id AND e.bot_instance_id = g.bot_instance_id) as total_in,
        (SELECT COALESCE(SUM(CASE WHEN e.type = 'out' THEN e.amount ELSE 0 END), 0) FROM expenses e WHERE e.chat_id = g.chat_id AND e.bot_instance_id = g.bot_instance_id) as total_out
      FROM groups g
      JOIN bot_instances b ON b.id = g.bot_instance_id
      WHERE b.user_id = ?
      ORDER BY g.last_activity_at IS NULL, g.last_activity_at DESC
    `).all(userId);
  }
  return rows.map(withDisplayName);
}

function countAll() {
  return db.prepare(`SELECT COUNT(*) as c FROM groups`).get().c;
}

function canAccess(groupId, userId, isAdmin) {
  if (isAdmin) return true;
  const g = findById(groupId);
  return g && g.user_id === userId;
}

module.exports = { upsert, findById, listForUser, countAll, canAccess, updateName, listChatIds };
