const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { Client, LocalAuth } = require('whatsapp-web.js');
const botsRepo = require('../db/repositories/bots');
const { createMessageHandler } = require('./messageHandler');
const { syncGroupNames } = require('./syncGroups');
const { resolveChromePath } = require('./chrome');

const SESSIONS_DIR = path.join(__dirname, '../../../data/sessions');

class BotManager {
  constructor(io) {
    this.io = io;
    this.clients = new Map();
    this.qrCodes = new Map();
    this.statuses = new Map();
    this.shuttingDown = false;
    this.stoppingInstances = new Set();
  }

  getStatus(instanceId) {
    const live = this.statuses.get(instanceId);
    if (live) return live;
    const inst = botsRepo.findById(instanceId);
    return inst?.status || 'disconnected';
  }

  getQr(instanceId) {
    return this.qrCodes.get(instanceId) || null;
  }

  emit(instanceId, event, data) {
    this.io?.to(`bot:${instanceId}`).emit(event, data);
  }

  isChromeRunning(sessionId) {
    try {
      const count = execSync(
        `pgrep -cf "data/sessions/${sessionId}/session" || true`,
        { encoding: 'utf8' }
      ).trim();
      return parseInt(count, 10) > 0;
    } catch {
      return false;
    }
  }

  killStaleChrome(sessionId) {
    if (!this.isChromeRunning(sessionId)) return;
    try {
      execSync(`pkill -f "data/sessions/${sessionId}/session" || true`, { stdio: 'ignore' });
    } catch { /* ignore */ }
  }

  async resetSession(instanceId) {
    const instance = botsRepo.findById(instanceId);
    if (!instance) throw new Error('Bot instance not found');

    await this.stopInstance(instanceId, { updateDb: true });
    this.killStaleChrome(instance.session_id);
    await new Promise((r) => setTimeout(r, 2000));

    const base = path.join(SESSIONS_DIR, instance.session_id);
    for (const dir of ['session', `session-${instance.session_id}`]) {
      const full = path.join(base, dir);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    }

    botsRepo.updateStatus(instanceId, 'disconnected');
    this.statuses.set(instanceId, 'disconnected');
    this.qrCodes.delete(instanceId);
    this.emit(instanceId, 'bot:status', { status: 'disconnected' });
  }

  async startInstance(instanceId, { killChrome = true } = {}) {
    const instance = botsRepo.findById(instanceId);
    if (!instance) throw new Error('Bot instance not found');

    const isReconnect = !!(instance.phone_number && this.hasSession(instance));

    if (this.clients.has(instanceId)) {
      const status = this.getStatus(instanceId);
      if (status === 'ready') return;
      await this.stopInstance(instanceId, { updateDb: false });
    }

    if (killChrome || this.isChromeRunning(instance.session_id)) {
      this.killStaleChrome(instance.session_id);
      await new Promise((r) => setTimeout(r, 1500));
    }

    const sessionPath = path.join(SESSIONS_DIR, instance.session_id);
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: instance.session_id, dataPath: sessionPath }),
      authTimeoutMs: 120000,
      qrMaxRetries: 15,
      takeoverOnConflict: true,
      puppeteer: {
        headless: true,
        executablePath: resolveChromePath(),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      },
    });

    const getClient = () => client;
    const handler = createMessageHandler({ botInstanceId: instanceId, getClient });

    client.on('qr', (qr) => {
      this.qrCodes.set(instanceId, qr);
      this.statuses.set(instanceId, 'qr_pending');
      botsRepo.updateStatus(instanceId, 'qr_pending');
      if (isReconnect) {
        console.warn(`Bot ${instanceId}: QR during reconnect — session may be expired, rescan required`);
      } else {
        console.log(`Bot instance ${instanceId} QR generated`);
      }
      this.emit(instanceId, 'bot:qr', { qr });
      this.emit(instanceId, 'bot:status', { status: 'qr_pending' });
    });

    client.on('authenticated', () => {
      this.statuses.set(instanceId, 'authenticated');
      this.emit(instanceId, 'bot:status', { status: 'authenticated' });
    });

    client.on('ready', async () => {
      this.qrCodes.delete(instanceId);
      this.statuses.set(instanceId, 'ready');
      const info = client.info;
      botsRepo.updateStatus(instanceId, 'ready', info?.wid?.user || null);
      this.emit(instanceId, 'bot:status', { status: 'ready', phone: info?.wid?.user });
      console.log(`Bot instance ${instanceId} ready`);
      await syncGroupNames(instanceId, client);
    });

    client.on('auth_failure', () => {
      this.statuses.set(instanceId, 'auth_failure');
      botsRepo.updateStatus(instanceId, 'auth_failure');
      this.emit(instanceId, 'bot:status', { status: 'auth_failure' });
    });

    client.on('disconnected', (reason) => {
      if (this.shuttingDown || this.stoppingInstances.has(instanceId)) return;

      this.clients.delete(instanceId);
      this.qrCodes.delete(instanceId);

      if (reason === 'LOGOUT') {
        this.statuses.set(instanceId, 'disconnected');
        botsRepo.updateStatus(instanceId, 'disconnected');
        this.emit(instanceId, 'bot:status', { status: 'disconnected', reason });
        return;
      }

      const inst = botsRepo.findById(instanceId);
      if (inst?.phone_number && this.hasSession(inst)) {
        console.log(`Bot ${instanceId} disconnected (${reason}), reconnecting...`);
        this.statuses.set(instanceId, 'connecting');
        this.emit(instanceId, 'bot:status', { status: 'connecting' });
        setTimeout(() => {
          if (!this.clients.has(instanceId) && !this.shuttingDown) {
            this.startInstance(instanceId, { killChrome: false }).catch((err) => {
              console.error(`Bot ${instanceId} reconnect failed:`, err.message);
            });
          }
        }, 5000);
      } else {
        this.statuses.set(instanceId, 'disconnected');
        botsRepo.updateStatus(instanceId, 'disconnected');
        this.emit(instanceId, 'bot:status', { status: 'disconnected', reason });
      }
    });

    client.on('message', async (msg) => {
      try {
        if (msg.fromMe) return;
        await handler(msg);
      } catch (err) {
        console.error(`Bot ${instanceId} message error:`, err);
        try {
          await msg.reply('❌ Something went wrong. Please try again later.');
        } catch { /* ignore */ }
      }
    });

    this.clients.set(instanceId, client);
    this.statuses.set(instanceId, 'connecting');
    if (!isReconnect) {
      botsRepo.updateStatus(instanceId, 'connecting');
    }
    this.emit(instanceId, 'bot:status', { status: 'connecting' });

    try {
      await client.initialize();
    } catch (err) {
      console.error(`Bot ${instanceId} initialize failed:`, err.message);
      await this.stopInstance(instanceId, { updateDb: false });
      throw err;
    }
  }

  async stopInstance(instanceId, { updateDb = true } = {}) {
    const client = this.clients.get(instanceId);
    this.stoppingInstances.add(instanceId);
    if (client) {
      try {
        await client.destroy();
      } catch { /* ignore */ }
      this.clients.delete(instanceId);
    }
    this.stoppingInstances.delete(instanceId);
    this.qrCodes.delete(instanceId);

    if (updateDb) {
      this.statuses.set(instanceId, 'disconnected');
      botsRepo.updateStatus(instanceId, 'disconnected');
      this.emit(instanceId, 'bot:status', { status: 'disconnected' });
    } else {
      this.statuses.delete(instanceId);
    }
  }

  hydrateFromDb() {
    for (const inst of botsRepo.listAll()) {
      if (inst.phone_number || inst.status === 'ready') {
        this.statuses.set(inst.id, inst.status === 'ready' ? 'ready' : 'disconnected');
      }
    }
  }

  async gracefulShutdown() {
    this.shuttingDown = true;
    console.log('Graceful shutdown: stopping bot clients (sessions preserved)...');
    const ids = [...this.clients.keys()];
    for (const id of ids) {
      await this.stopInstance(id, { updateDb: false });
    }
  }

  async startAllReady() {
    const instances = botsRepo.listReconnectable();
    const targets = instances.filter((inst) => this.hasSession(inst));

    if (!targets.length) return;

    console.log(`Auto-reconnecting ${targets.length} bot(s) with saved sessions...`);
    for (const inst of targets) {
      try {
        await this.startInstance(inst.id, { killChrome: false });
        await new Promise((r) => setTimeout(r, 5000));
      } catch (err) {
        console.error(`Failed to reconnect bot ${inst.id}:`, err.message);
      }
    }
  }

  hasSession(inst) {
    const base = path.join(SESSIONS_DIR, inst.session_id);
    const authDir = path.join(base, `session-${inst.session_id}`);
    if (!fs.existsSync(authDir)) return false;
    try {
      return fs.readdirSync(authDir).length > 0;
    } catch {
      return false;
    }
  }
}

module.exports = BotManager;
