const db = require('../index');

function findByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
}

function findById(id) {
  return db.prepare(`SELECT id, username, role, display_name, created_at FROM users WHERE id = ?`).get(id);
}

function listAll() {
  return db.prepare(`
    SELECT u.id, u.username, u.role, u.display_name, u.created_at,
           b.id as bot_instance_id, b.status as bot_status, b.phone_number
    FROM users u
    LEFT JOIN bot_instances b ON b.user_id = u.id
    ORDER BY u.id
  `).all();
}

function create({ username, passwordHash, role, displayName }) {
  const r = db.prepare(
    `INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, ?, ?)`
  ).run(username, passwordHash, role || 'user', displayName || username);

  const sessionId = `user-${r.lastInsertRowid}`;
  db.prepare(`INSERT INTO bot_instances (user_id, session_id) VALUES (?, ?)`).run(r.lastInsertRowid, sessionId);

  return findById(r.lastInsertRowid);
}

function updatePassword(id, passwordHash) {
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(passwordHash, id);
}

function remove(id) {
  db.prepare(`DELETE FROM users WHERE id = ? AND role != 'admin'`).run(id);
}

module.exports = { findByUsername, findById, listAll, create, updatePassword, remove };
