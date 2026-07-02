const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { runSchema } = require('./schema');

const DATA_DIR = path.join(__dirname, '../../../data');
const DB_PATH = path.join(DATA_DIR, 'expenses.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

runSchema(db);

module.exports = db;
