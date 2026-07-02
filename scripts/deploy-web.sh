#!/bin/bash
# Deploy web UI only — does NOT restart server/bot
set -e
cd "$(dirname "$0")/.."
echo "Building admin web..."
npm run build:admin
echo ""
echo "=== Web deploy complete ==="
echo "• Bot was NOT restarted — WA session stays active"
echo "• Transaction data is unaffected"
echo "• Refresh your browser to see UI changes"
