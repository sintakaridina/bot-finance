const express = require('express');
const botsRepo = require('../../db/repositories/bots');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function canAccessBot(req, instance) {
  if (!instance) return false;
  if (req.user.role === 'admin') return true;
  return instance.user_id === req.user.id;
}

router.get('/:instanceId/status', (req, res) => {
  const instance = botsRepo.findById(parseInt(req.params.instanceId, 10));
  if (!canAccessBot(req, instance)) return res.status(403).json({ error: 'Forbidden' });
  const manager = req.app.locals.botManager;
  const qr = manager?.getQr(instance.id);
  res.json({
    ...instance,
    liveStatus: manager?.getStatus(instance.id) || instance.status,
    hasQr: !!qr,
    qr: qr || undefined,
  });
});

router.post('/:instanceId/connect', async (req, res) => {
  const instance = botsRepo.findById(parseInt(req.params.instanceId, 10));
  if (!canAccessBot(req, instance)) return res.status(403).json({ error: 'Forbidden' });
  const manager = req.app.locals.botManager;
  const liveStatus = manager.getStatus(instance.id);

  if (liveStatus === 'ready') {
    return res.json({ ok: true, status: 'ready' });
  }
  if (liveStatus === 'qr_pending' && manager.getQr(instance.id)) {
    return res.json({ ok: true, status: 'qr_pending', qr: manager.getQr(instance.id) });
  }
  if (liveStatus === 'connecting' || liveStatus === 'authenticated') {
    return res.json({ ok: true, status: liveStatus });
  }

  try {
    await manager.startInstance(instance.id);
    res.json({ ok: true, status: 'connecting' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:instanceId/reset', async (req, res) => {
  const instance = botsRepo.findById(parseInt(req.params.instanceId, 10));
  if (!canAccessBot(req, instance)) return res.status(403).json({ error: 'Forbidden' });
  const manager = req.app.locals.botManager;
  try {
    await manager.resetSession(instance.id);
    await manager.startInstance(instance.id);
    res.json({ ok: true, status: 'connecting' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:instanceId/disconnect', async (req, res) => {
  const instance = botsRepo.findById(parseInt(req.params.instanceId, 10));
  if (!canAccessBot(req, instance)) return res.status(403).json({ error: 'Forbidden' });
  const manager = req.app.locals.botManager;
  await manager.stopInstance(instance.id);
  res.json({ ok: true });
});

module.exports = router;
