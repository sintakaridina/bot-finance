const db = require('../db/index');

let cache = null;
let cacheAt = 0;
const TTL = 5000;

function loadTemplates() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL) return cache;
  const rows = db.prepare(`SELECT key, content FROM message_templates`).all();
  cache = Object.fromEntries(rows.map((r) => [r.key, r.content]));
  cacheAt = now;
  return cache;
}

function invalidateCache() {
  cache = null;
  cacheAt = 0;
}

function render(key, vars = {}) {
  const templates = loadTemplates();
  let content = templates[key];
  if (!content) return null;

  for (const [k, v] of Object.entries(vars)) {
    content = content.replaceAll(`{${k}}`, v ?? '');
  }
  return content;
}

module.exports = { render, invalidateCache, loadTemplates };
