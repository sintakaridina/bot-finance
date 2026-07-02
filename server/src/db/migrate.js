const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const db = require('./index');
const { seedTemplates, upgradeTemplatesToEnglish } = require('../services/templateDefaults');

const ROOT = path.join(__dirname, '../../..');
const LEGACY_AUTH = path.join(ROOT, '.wwebjs_auth');
const SESSIONS_DIR = path.join(ROOT, 'data/sessions');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    try {
      if (entry.isDirectory()) copyDir(s, d);
      else if (entry.isSymbolicLink()) {
        const link = fs.readlinkSync(s);
        try { fs.symlinkSync(link, d); } catch { /* skip */ }
      } else fs.copyFileSync(s, d);
    } catch {
      // skip broken session files
    }
  }
  return true;
}

function migrate() {
  seedTemplates(db);

  const dbVersion = db.pragma('user_version', { simple: true });
  if (dbVersion < 2) {
    upgradeTemplatesToEnglish(db);
    db.pragma('user_version = 2');
    console.log('Upgraded message templates to English (schema v2)');
  }

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
  const existingAdmin = db.prepare(`SELECT id FROM users WHERE username = ?`).get(adminUser);

  let adminId;
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPass, 10);
    const r = db.prepare(
      `INSERT INTO users (username, password_hash, role, display_name) VALUES (?, ?, 'admin', 'Administrator')`
    ).run(adminUser, hash);
    adminId = r.lastInsertRowid;
    console.log(`Admin created: ${adminUser}`);
  } else {
    adminId = existingAdmin.id;
  }

  let botInstance = db.prepare(`SELECT id FROM bot_instances WHERE user_id = ?`).get(adminId);
  let botInstanceId;

  if (!botInstance) {
    const sessionId = `user-${adminId}`;
    const sessionPath = path.join(SESSIONS_DIR, sessionId);
    if (!fs.existsSync(sessionPath) && fs.existsSync(LEGACY_AUTH)) {
      copyDir(LEGACY_AUTH, sessionPath);
      console.log('Migrated legacy WA session to', sessionPath);
    }
    const legacySession = path.join(sessionPath, 'session');
    const authSession = path.join(sessionPath, `session-${sessionId}`);
    if (fs.existsSync(legacySession) && !fs.existsSync(authSession)) {
      copyDir(legacySession, authSession);
      console.log('Migrated legacy session folder to', authSession);
    }
    const r = db.prepare(
      `INSERT INTO bot_instances (user_id, status, session_id) VALUES (?, 'disconnected', ?)`
    ).run(adminId, sessionId);
    botInstanceId = r.lastInsertRowid;
  } else {
    botInstanceId = botInstance.id;
  }

  const chatIds = db.prepare(`SELECT DISTINCT chat_id FROM expenses WHERE chat_id IS NOT NULL`).all();
  const upsertGroup = db.prepare(`
    INSERT INTO groups (bot_instance_id, chat_id, name, last_activity_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(bot_instance_id, chat_id) DO NOTHING
  `);
  for (const { chat_id } of chatIds) {
    upsertGroup.run(botInstanceId, chat_id, null);
  }

  const updated = db.prepare(
    `UPDATE expenses SET bot_instance_id = ? WHERE bot_instance_id IS NULL`
  ).run(botInstanceId);
  if (updated.changes > 0) {
    console.log(`Migration: ${updated.changes} expenses assigned to bot ${botInstanceId}`);
  }

  return { adminId, botInstanceId };
}

if (require.main === module) {
  migrate();
}

module.exports = { migrate };
