const db = require('../index');

function findByUserId(userId) {
  return db.prepare(`SELECT * FROM bot_instances WHERE user_id = ?`).get(userId);
}

function findById(id) {
  return db.prepare(`SELECT * FROM bot_instances WHERE id = ?`).get(id);
}

function updateStatus(id, status, phoneNumber = null) {
  if (phoneNumber) {
    db.prepare(`
      UPDATE bot_instances SET status = ?, phone_number = ?, last_connected_at = datetime('now') WHERE id = ?
    `).run(status, phoneNumber, id);
  } else {
    db.prepare(`UPDATE bot_instances SET status = ? WHERE id = ?`).run(status, id);
  }
}

function listAll() {
  return db.prepare(`
    SELECT b.*, u.username, u.display_name
    FROM bot_instances b
    JOIN users u ON u.id = b.user_id
    ORDER BY b.id
  `).all();
}

function countOnline() {
  return db.prepare(`SELECT COUNT(*) as c FROM bot_instances WHERE status = 'ready'`).get().c;
}

function listReconnectable() {
  return db.prepare(`
    SELECT b.*, u.username, u.display_name
    FROM bot_instances b
    JOIN users u ON u.id = b.user_id
    WHERE b.phone_number IS NOT NULL
    ORDER BY b.id
  `).all();
}

module.exports = { findByUserId, findById, updateStatus, listAll, listReconnectable, countOnline };
