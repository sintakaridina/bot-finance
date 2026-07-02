const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const usersRepo = require('../../db/repositories/users');
const botsRepo = require('../../db/repositories/bots');
const groupsRepo = require('../../db/repositories/groups');
const expensesRepo = require('../../db/repositories/expenses');
const templatesRepo = require('../../db/repositories/templates');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/stats', (req, res) => {
  res.json({
    users: usersRepo.listAll().length,
    groups: groupsRepo.countAll(),
    expenses: expensesRepo.countAll(),
    botsOnline: botsRepo.countOnline(),
  });
});

router.get('/users', (req, res) => {
  res.json(usersRepo.listAll());
});

router.post('/users', (req, res) => {
  const { username, password, displayName, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (usersRepo.findByUsername(username)) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  const user = usersRepo.create({
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: role === 'admin' ? 'admin' : 'user',
    displayName: displayName || username,
  });
  res.status(201).json(user);
});

router.post('/users/:id/reset-password', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const temp = crypto.randomBytes(4).toString('hex');
  usersRepo.updatePassword(id, bcrypt.hashSync(temp, 10));
  res.json({ tempPassword: temp });
});

router.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  usersRepo.remove(id);
  res.json({ ok: true });
});

router.get('/message-templates', (req, res) => {
  res.json(templatesRepo.listAll());
});

router.patch('/message-templates/:key', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content is required' });
  const updated = templatesRepo.update(req.params.key, content);
  if (!updated) return res.status(404).json({ error: 'Template not found' });
  res.json(updated);
});

module.exports = router;
