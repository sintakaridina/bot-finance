function runSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      display_name TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bot_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'disconnected',
      phone_number TEXT,
      session_id TEXT NOT NULL,
      last_connected_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_instance_id INTEGER NOT NULL REFERENCES bot_instances(id) ON DELETE CASCADE,
      chat_id TEXT NOT NULL,
      name TEXT,
      last_activity_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(bot_instance_id, chat_id)
    );

    CREATE TABLE IF NOT EXISTS message_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      description TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_groups_bot ON groups(bot_instance_id);
    CREATE INDEX IF NOT EXISTS idx_bot_user ON bot_instances(user_id);

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_instance_id INTEGER REFERENCES bot_instances(id),
      chat_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'out' CHECK(type IN ('out', 'in')),
      category TEXT NOT NULL,
      amount INTEGER NOT NULL,
      detail TEXT,
      expense_date TEXT NOT NULL,
      year_month TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const cols = db.prepare(`PRAGMA table_info(expenses)`).all();
  const colNames = cols.map((c) => c.name);
  if (!colNames.includes('bot_instance_id')) {
    db.exec(`ALTER TABLE expenses ADD COLUMN bot_instance_id INTEGER REFERENCES bot_instances(id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_bot ON expenses(bot_instance_id)`);
  }
  if (!colNames.includes('type')) {
    db.exec(`ALTER TABLE expenses ADD COLUMN type TEXT NOT NULL DEFAULT 'out' CHECK(type IN ('out', 'in'))`);
    db.exec(`UPDATE expenses SET type = 'out' WHERE type IS NULL`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(type)`);
  }
}

module.exports = { runSchema };
