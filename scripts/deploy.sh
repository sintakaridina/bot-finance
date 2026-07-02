#!/bin/bash
# Full deploy — backup data, build web, graceful reload (session & DB preserved)
set -e
cd "$(dirname "$0")/.."

echo "=== Finance Bot Deploy ==="

# Backup database before deploy
mkdir -p data/backups
if [ -f data/expenses.db ]; then
  BACKUP="data/backups/expenses-$(date +%Y%m%d-%H%M%S).db"
  cp -a data/expenses.db "$BACKUP"
  echo "✓ Database backed up to $BACKUP"
fi

# Session folder is never touched
if [ -d data/sessions ]; then
  echo "✓ WA sessions preserved in data/sessions/"
fi

echo "Building admin web..."
npm run build:admin

echo "Graceful reload (bot reconnects automatically, no QR rescan)..."
pm2 reload ecosystem.config.cjs --update-env

echo ""
echo "=== Deploy complete ==="
echo "• Transaction data: data/expenses.db"
echo "• WhatsApp sessions: data/sessions/"
echo "• Bot reconnects automatically in ~30 seconds"
echo ""
echo "Check status: pm2 logs finance-platform --lines 20"
