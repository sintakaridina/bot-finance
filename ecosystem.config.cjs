const path = require('path');

const root = __dirname;

module.exports = {
  apps: [
    {
      name: 'finance-platform',
      script: 'server/src/server.js',
      cwd: root,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 5000,
      kill_timeout: 15000,
      wait_ready: false,
      listen_timeout: 20000,
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Jakarta',
        PORT: '3000',
        PUPPETEER_CACHE_DIR: path.join(root, '.cache/puppeteer'),
      },
    },
  ],
};
