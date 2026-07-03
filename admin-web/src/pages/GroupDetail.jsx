import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, downloadPdf } from '../api/client';
import { formatMoney } from '../utils/currency';

function flowBadge(type) {
  const isIn = type === 'in';
  return (
    <span style={{
      fontSize: '0.75rem',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: 4,
      color: isIn ? '#15803d' : '#b91c1c',
      background: isIn ? '#dcfce7' : '#fee2e2',
    }}>
      {isIn ? 'IN' : 'OUT'}
    </span>
  );
}

export default function GroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [month, setMonth] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const load = () => {
    api(`/groups/${id}`).then(setGroup).catch(console.error);
    const q = month ? `?month=${month}` : '';
    api(`/groups/${id}/expenses${q}`).then(setExpenses).catch(console.error);
  };

  useEffect(load, [id, month]);

  const totals = expenses.reduce((acc, e) => {
    if (e.type === 'in') acc.in += e.amount;
    else acc.out += e.amount;
    return acc;
  }, { in: 0, out: 0 });
  totals.net = totals.in - totals.out;

  const openAdd = () => {
    const today = new Date().toISOString().slice(0, 10);
    setForm({ type: 'out', category: '', amount: '', detail: '', expenseDate: today, yearMonth: today.slice(0, 7) });
    setModal('add');
  };

  const openEdit = (e) => {
    setForm({
      id: e.id,
      type: e.type || 'out',
      category: e.category,
      amount: e.amount,
      detail: e.detail || '',
      expenseDate: e.expense_date,
      yearMonth: e.year_month,
    });
    setModal('edit');
  };

  const save = async () => {
    const payload = {
      type: form.type,
      category: form.category,
      amount: parseInt(form.amount, 10),
      detail: form.detail,
      expenseDate: form.expenseDate,
      yearMonth: form.yearMonth,
    };
    if (modal === 'add') {
      await api(`/groups/${id}/expenses`, { method: 'POST', body: JSON.stringify(payload) });
    } else {
      await api(`/groups/${id}/expenses/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    }
    setModal(null);
    load();
  };

  const remove = async (expenseId) => {
    if (!confirm('Delete this transaction?')) return;
    await api(`/groups/${id}/expenses/${expenseId}`, { method: 'DELETE' });
    load();
  };

  const pdf = async (ym) => {
    await downloadPdf(`/groups/${id}/reports/${ym}.pdf`, `report-${ym}.pdf`);
  };

  if (!group) return <div>Loading...</div>;

  return (
    <div>
      <Link to="/groups" style={{ color: '#64748b', fontSize: '0.9rem' }}>← Back</Link>
      <h1 className="page-title">{group.display_name || group.name || 'WhatsApp Group'}</h1>

      <div className="toolbar">
        <select value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">All months</option>
          {group.months?.map((m) => (
            <option key={m.year_month} value={m.year_month}>
              {m.year_month} ({m.count}) · Net {formatMoney((m.total_in || 0) - (m.total_out || 0))}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={openAdd}>+ Add</button>
        {month && <button className="btn btn-secondary" onClick={() => pdf(month)}>Download PDF</button>}
      </div>

      {expenses.length > 0 && (
        <div className="cards" style={{ marginBottom: '1rem' }}>
          <div className="card"><div className="label">Income</div><div className="value" style={{ color: '#15803d', fontSize: '1.1rem' }}>{formatMoney(totals.in)}</div></div>
          <div className="card"><div className="label">Expenses</div><div className="value" style={{ color: '#b91c1c', fontSize: '1.1rem' }}>{formatMoney(totals.out)}</div></div>
          <div className="card"><div className="label">Net Balance</div><div className="value" style={{ fontSize: '1.1rem' }}>{formatMoney(totals.net)}</div></div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Type</th><th>Date</th><th>Category</th><th>Detail</th><th>Amount</th><th></th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>#{e.id}</td>
                <td>{flowBadge(e.type)}</td>
                <td>{e.expense_date}</td>
                <td>{e.category}</td>
                <td>{e.detail || '-'}</td>
                <td style={{ color: e.type === 'in' ? '#15803d' : '#b91c1c' }}>{formatMoney(e.amount)}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(e)}>Edit</button>{' '}
                  <button className="btn btn-sm btn-danger" onClick={() => remove(e.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!expenses.length && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modal === 'add' ? 'Add Transaction' : 'Edit Transaction'}</h3>
            <div className="form-group">
              <label>Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="out">Expense (OUT)</option>
                <option value="in">Income (IN)</option>
              </select>
            </div>
            <div className="form-group"><label>Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div className="form-group"><label>Amount</label><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="form-group"><label>Detail</label><input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></div>
            <div className="form-group"><label>Date</label><input type="date" value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value, yearMonth: e.target.value.slice(0, 7) })} /></div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
