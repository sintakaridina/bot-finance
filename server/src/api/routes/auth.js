const express = require('express');
const bcrypt = require('bcryptjs');
const usersRepo = require('../../db/repositories/users');
const botsRepo = require('../../db/repositories/bots');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = usersRepo.findByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signToken(user);
  const bot = botsRepo.findByUserId(user.id);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, displayName: user.display_name },
    botInstanceId: bot?.id,
  });
});

router.get('/me', requireAuth, (req, res) => {
  const bot = botsRepo.findByUserId(req.user.id);
  res.json({
    user: req.user,
    botInstanceId: bot?.id,
    botStatus: bot?.status,
  });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const full = usersRepo.findByUsername(req.user.username);
  if (!bcrypt.compareSync(currentPassword, full.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  usersRepo.updatePassword(req.user.id, bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
});

module.exports = router;
