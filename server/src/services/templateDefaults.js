const {
  formatHelpMessage,
  formatGreetingMessage,
  formatUnknownMessage,
} = require('../../../src/parser');

const DEFAULTS = [
  { key: 'greeting', description: 'Greeting response (hi, hello, ...)', content: formatGreetingMessage('{name}') },
  { key: 'unknown', description: 'Unknown command', content: formatUnknownMessage() },
  { key: 'ping', description: 'Ping response ({month})', content: '🏓 *Pong!* Bot is online.\n📅 Current month: *{month}*\n\nType *help* to see all commands.' },
  { key: 'help', description: 'Full help menu', content: formatHelpMessage() },
  { key: 'expense_saved', description: 'Save confirmation ({id}, {category}, {amount}, {detail}, {month})', content: '✅ *Saved #{id}*\n\n📂 {category}\n💰 {amount}{detail_line}\n📅 {month}' },
  { key: 'delete_success', description: 'Delete confirmation ({id}, {category}, {amount}, {detail})', content: '🗑️ *Deleted #{id}*\n\n📂 {category}\n💰 {amount}{detail_line}' },
  { key: 'error_generic', description: 'Generic error', content: '❌ Something went wrong. Please try again later.' },
];

function seedTemplates(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO message_templates (key, content, description) VALUES (?, ?, ?)
  `);
  for (const t of DEFAULTS) {
    insert.run(t.key, t.content, t.description);
  }
}

function upgradeTemplatesToEnglish(db) {
  const upsert = db.prepare(`
    INSERT INTO message_templates (key, content, description) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      content = excluded.content,
      description = excluded.description,
      updated_at = datetime('now')
  `);
  for (const t of DEFAULTS) {
    upsert.run(t.key, t.content, t.description);
  }
}

module.exports = { DEFAULTS, seedTemplates, upgradeTemplatesToEnglish };
