# Finance Bot Platform

WhatsApp expense tracker + **Web Admin** for multi-group, multi-user monitoring.

## Features

### WhatsApp Bot
- Record expenses per group (`out - category - amount - detail`)
- `show`, `delete`, monthly PDF `report`
- Smart greetings (`hi`) & unknown command responses
- Data isolated per group and per user

### Web Admin
- **Admin**: monitor all users/groups, edit bot messages, manage users, reset passwords
- **User**: own groups & expenses, connect WA via QR, download PDF reports
- Real-time status & QR via Socket.io

## Requirements

- Node.js ≥ 18
- npm
- Linux server (for production + Puppeteer Chrome)
- PM2 (production, optional)

## First-time Setup

```bash
cd finance-bot

# 1. Environment
cp .env.example .env
# Edit .env — change JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD

# 2. Install dependencies (+ Chrome for Puppeteer)
npm install

# 3. Build admin web
npm run build:admin

# 4. Run database migration (idempotent)
npm run migrate
```

## How to Start

### Development (local)

Terminal 1 — backend + bot + API:

```bash
npm run dev:server
```

Terminal 2 — admin web (hot reload):

```bash
npm run dev:admin
```

Open http://localhost:5173 (Vite dev server) or http://localhost:3000 after building.

### Production (manual)

```bash
npm run build:admin
npm start
```

Server runs on port `3000` (or `PORT` from `.env`).

### Production (PM2 — recommended)

```bash
npm run build:admin
pm2 start ecosystem.config.cjs
pm2 save
```

Check status & logs:

```bash
pm2 status
pm2 logs finance-platform --lines 50
```

Graceful restart (bot reconnects automatically, session preserved):

```bash
pm2 reload finance-platform --update-env
```

## Deploy

| Command | Purpose |
|---------|---------|
| `npm run deploy:web` | Update admin UI only — **bot does not restart** |
| `npm run deploy` | Full deploy — backup DB, build web, graceful reload |

After a full deploy, the bot reconnects automatically (~30 seconds) without rescanning QR.

## First Login

Defaults from `.env.example`:

- Username: `admin`
- Password: `admin123`

**Change these immediately** before production use.

After login, open **Connect WA** and scan the QR code to activate the bot.

## Bot Commands (WhatsApp)

| Command | Example |
|---------|---------|
| Record expense | `out - food - 50000 - lunch` |
| View today | `show` |
| Delete | `delete - 12` |
| PDF report | `report - 2026/07` |
| Help | `help` or `menu` |
| Check bot | `ping` |

## Project Structure

```
finance-bot/
├── server/src/          # Express API + BotManager + Socket.io
│   ├── server.js        # Entry point
│   ├── bot/             # WhatsApp multi-instance
│   ├── api/routes/      # REST API
│   └── db/              # SQLite schema & repositories
├── admin-web/           # React admin SPA (Vite)
├── src/                 # Command parser & PDF generator (shared)
├── scripts/
│   ├── deploy.sh        # Full deploy
│   └── deploy-web.sh    # UI-only deploy
├── data/                # LOCAL DATA — not in git
│   ├── expenses.db      # Transaction database
│   ├── sessions/        # WhatsApp sessions per user
│   └── backups/         # Auto backup on deploy
└── ecosystem.config.cjs # PM2 config
```

## Environment

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | JWT signing secret (change in production) |
| `ADMIN_USERNAME` | Initial admin username |
| `ADMIN_PASSWORD` | Initial admin password |
| `PORT` | Web server port (default `3000`) |
| `CURRENCY_CODE` | ISO 4217 currency code (default `IDR`) |
| `CURRENCY_LOCALE` | Locale for formatting (default `en-US`, e.g. `en-ID`, `id-ID`) |

## Roles

| Feature | Admin | User |
|---------|-------|------|
| Platform dashboard | Yes | Own stats |
| Manage users | Yes | No |
| Edit bot messages | Yes | No |
| All groups | Yes | Own bot groups |
| CRUD expenses | Yes | Own data |
| Connect WA (QR) | All bots | Own bot |

## Git — Do Not Push

`.gitignore` excludes sensitive data from the repository:

| Path | Contents |
|------|----------|
| `.env` | JWT secret, admin password |
| `data/` | Database, WA sessions, backups |
| `data/sessions/` | WhatsApp login (highly sensitive) |
| `data/expenses.db` | All transactions |
| `.wwebjs_auth/` | Legacy sessions |
| `.cache/` | Puppeteer Chrome |
| `node_modules/` | Dependencies |
| `admin-web/dist/` | Build output |

Safe to commit: source code, `.env.example`, `data/.gitkeep`.

Initialize git (if needed):

```bash
git init
git add .
git status   # verify .env and data/ are not listed
git commit -m "Initial commit"
```

## Nginx + SSL (Production)

```nginx
server {
    listen 443 ssl;
    server_name bot-finance.sintalabs.cloud;

    ssl_certificate /etc/letsencrypt/live/bot-finance.sintalabs.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bot-finance.sintalabs.cloud/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```
