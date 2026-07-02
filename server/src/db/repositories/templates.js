const db = require('../index');
const { invalidateCache } = require('../../services/templateRenderer');

function listAll() {
  return db.prepare(`SELECT key, content, description, updated_at FROM message_templates ORDER BY key`).all();
}

function findByKey(key) {
  return db.prepare(`SELECT * FROM message_templates WHERE key = ?`).get(key);
}

function update(key, content) {
  db.prepare(`
    UPDATE message_templates SET content = ?, updated_at = datetime('now') WHERE key = ?
  `).run(content, key);
  invalidateCache();
  return findByKey(key);
}

module.exports = { listAll, findByKey, update };
