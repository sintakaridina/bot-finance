const fs = require('fs');
const puppeteer = require('puppeteer');

function resolveChromePath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const bundled = puppeteer.executablePath();
  if (bundled && fs.existsSync(bundled)) return bundled;

  const candidates = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error(
    'Chrome/Chromium not found. Run: npx puppeteer browsers install chrome'
  );
}

module.exports = { resolveChromePath };
