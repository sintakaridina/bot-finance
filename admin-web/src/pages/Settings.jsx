import { useState } from 'react';
import { api } from '../api/client';

export default function Settings() {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [msg, setMsg] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setMsg('Password changed successfully');
      setCurrent('');
      setNew('');
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <form className="card" style={{ maxWidth: 400 }} onSubmit={submit}>
        <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>
        {msg && <div style={{ marginBottom: '1rem', color: msg.includes('successfully') ? '#166534' : '#b91c1c' }}>{msg}</div>}
        <div className="form-group">
          <label>Current Password</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>New Password</label>
          <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} required minLength={6} />
        </div>
        <button className="btn btn-primary" type="submit">Save</button>
      </form>
    </div>
  );
}
