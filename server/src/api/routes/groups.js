const express = require('express');
const groupsRepo = require('../../db/repositories/groups');
const expensesRepo = require('../../db/repositories/expenses');
const { requireAuth } = require('../middleware/auth');
const { generateReport } = require('../../../../src/report');
const fs = require('fs');

const router = express.Router();
router.use(requireAuth);

function getGroupOr403(req, res) {
  const id = parseInt(req.params.id, 10);
  const group = groupsRepo.findById(id);
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return null;
  }
  if (!groupsRepo.canAccess(id, req.user.id, req.user.role === 'admin')) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return group;
}

router.get('/', (req, res) => {
  res.json(groupsRepo.listForUser(req.user.id, req.user.role === 'admin'));
});

router.get('/:id', (req, res) => {
  const group = getGroupOr403(req, res);
  if (!group) return;
  const months = expensesRepo.listMonths(group.chat_id, group.bot_instance_id);
  res.json({ ...group, months });
});

router.get('/:id/expenses', (req, res) => {
  const group = getGroupOr403(req, res);
  if (!group) return;
  res.json(expensesRepo.listByGroup(group, { month: req.query.month, date: req.query.date }));
});

router.post('/:id/expenses', (req, res) => {
  const group = getGroupOr403(req, res);
  if (!group) return;
  const { category, amount, detail, expenseDate, yearMonth, type } = req.body;
  if (!category || !amount || !expenseDate || !yearMonth) {
    return res.status(400).json({ error: 'Incomplete data' });
  }
  const expense = expensesRepo.create({
    botInstanceId: group.bot_instance_id,
    chatId: group.chat_id,
    type: type || 'out',
    category,
    amount: parseInt(amount, 10),
    detail,
    expenseDate,
    yearMonth,
  });
  res.status(201).json(expense);
});

router.patch('/:id/expenses/:expenseId', (req, res) => {
  const group = getGroupOr403(req, res);
  if (!group) return;
  const expenseId = parseInt(req.params.expenseId, 10);
  const existing = expensesRepo.findById(expenseId);
  if (!existing || existing.chat_id !== group.chat_id) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  const { category, amount, detail, expenseDate, yearMonth, type } = req.body;
  const updated = expensesRepo.update(expenseId, {
    type: type ?? existing.type ?? 'out',
    category: category ?? existing.category,
    amount: parseInt(amount ?? existing.amount, 10),
    detail: detail !== undefined ? detail : existing.detail,
    expenseDate: expenseDate ?? existing.expense_date,
    yearMonth: yearMonth ?? existing.year_month,
  });
  res.json(updated);
});

router.delete('/:id/expenses/:expenseId', (req, res) => {
  const group = getGroupOr403(req, res);
  if (!group) return;
  const expenseId = parseInt(req.params.expenseId, 10);
  const deleted = expensesRepo.deleteByChat(group.chat_id, group.bot_instance_id, expenseId);
  if (!deleted) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ ok: true });
});

router.get('/:id/reports/:yearMonth.pdf', async (req, res) => {
  const group = getGroupOr403(req, res);
  if (!group) return;
  const yearMonth = req.params.yearMonth;
  const expenses = expensesRepo.getMonthExpenses(group.chat_id, group.bot_instance_id, yearMonth);
  if (!expenses.length) return res.status(404).json({ error: 'No data found' });

  try {
    const pdfPath = await generateReport({
      chatId: group.chat_id,
      yearMonth,
      expenses,
    });
    res.download(pdfPath, `report-${yearMonth}.pdf`, () => {
      fs.unlink(pdfPath, () => {});
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
