import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'user' });
  const [tempPass, setTempPass] = useState('');

  const load = () => api('/admin/users').then(setUsers).catch(console.error);
  useEffect(load, []);

  const create = async (e) => {
    e.preventDefault();
    await api('/admin/users', { method: 'POST', body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ username: '', password: '', displayName: '', role: 'user' });
    load();
  };

  const resetPw = async (id) => {
    const r = await api(`/admin/users/${id}/reset-password`, { method: 'POST' });
    setTempPass(`Temporary password: ${r.tempPassword}`);
  };

  const remove = async (id) => {
    if (!confirm('Delete this user?')) return;
    await api(`/admin/users/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div>
      <h1 className="page-title">Manage Users</h1>
      {tempPass && <div className="card" style={{ marginBottom: '1rem' }}>{tempPass}</div>}
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New User</button>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom: '1.5rem' }} onSubmit={create}>
          <div className="form-group"><label>Username</label><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></div>
          <div className="form-group"><label>Password</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="form-group"><label>Display Name</label><input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></div>
          <div className="form-group"><label>Role</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit">Save</button>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Username</th><th>Role</th><th>Bot Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.display_name || u.username}</td>
                <td>{u.role}</td>
                <td>{u.bot_status || '-'}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => resetPw(u.id)}>Reset PW</button>{' '}
                  {u.role !== 'admin' && <button className="btn btn-sm btn-danger" onClick={() => remove(u.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
