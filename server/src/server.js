require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { migrate } = require('./db/migrate');
const BotManager = require('./bot/BotManager');
const { JWT_SECRET } = require('./api/middleware/auth');

const authRoutes = require('./api/routes/auth');
const adminRoutes = require('./api/routes/admin');
const groupsRoutes = require('./api/routes/groups');
const botsRoutes = require('./api/routes/bots');
const botsRepo = require('./db/repositories/bots');
const { getCurrencyConfig } = require('../../src/currency');

const PORT = process.env.PORT || 3000;
const ADMIN_WEB = path.join(__dirname, '../../admin-web/dist');

migrate();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

const botManager = new BotManager(io);
botManager.hydrateFromDb();
app.locals.botManager = botManager;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/bots', botsRoutes);

app.get('/api/config', (req, res) => {
  res.json({ currency: getCurrencyConfig() });
});

app.get('/api/dashboard/stats', require('./api/middleware/auth').requireAuth, (req, res) => {
  const groupsRepo = require('./db/repositories/groups');
  const expensesRepo = require('./db/repositories/expenses');
  const isAdmin = req.user.role === 'admin';

  if (isAdmin) {
    return res.json({
      groups: groupsRepo.countAll(),
      expenses: expensesRepo.countAll(),
      botsOnline: botsRepo.countOnline(),
      users: require('./db/repositories/users').listAll().length,
    });
  }

  const bot = botsRepo.findByUserId(req.user.id);
  const stats = bot ? expensesRepo.statsForBot(bot.id) : { count: 0, total_in: 0, total_out: 0 };
  const groups = groupsRepo.listForUser(req.user.id, false);
  res.json({
    groups: groups.length,
    expenses: stats.count,
    totalIn: stats.total_in,
    totalOut: stats.total_out,
    netBalance: stats.total_in - stats.total_out,
    botStatus: bot?.status,
    botInstanceId: bot?.id,
  });
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.on('bot:subscribe', (instanceId) => {
    const id = parseInt(instanceId, 10);
    const instance = botsRepo.findById(id);
    if (!instance) return;
    if (socket.user.role !== 'admin' && instance.user_id !== socket.user.id) return;

    socket.join(`bot:${id}`);
    socket.emit('bot:status', { status: botManager.getStatus(id) });
    const qr = botManager.getQr(id);
    if (qr) socket.emit('bot:qr', { qr });
  });
});

app.use(express.static(ADMIN_WEB));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(ADMIN_WEB, 'index.html'), (err) => {
    if (err) res.status(404).send('Admin UI not built. Run: npm run build:admin');
  });
});

server.listen(PORT, async () => {
  console.log(`Finance Platform running on port ${PORT}`);
  setTimeout(() => botManager.startAllReady(), 3000);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down gracefully...`);
  await botManager.gracefulShutdown();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 15000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, botManager };
