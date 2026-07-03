const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function chromeFromCacheDir(cacheDir) {
  const chromeRoot = path.join(cacheDir, 'chrome');
  if (!fs.existsSync(chromeRoot)) return null;

  const versions = fs.readdirSync(chromeRoot).sort().reverse();
  for (const version of versions) {
    const candidate = path.join(chromeRoot, version, 'chrome-linux64', 'chrome');
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveChromePath() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const fromCache = process.env.PUPPETEER_CACHE_DIR
    ? chromeFromCacheDir(process.env.PUPPETEER_CACHE_DIR)
    : null;
  if (fromCache) return fromCache;

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
