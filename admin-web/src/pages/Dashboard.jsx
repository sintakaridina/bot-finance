import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../utils/currency';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api('/dashboard/stats').then(setStats).catch(console.error);
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <div className="cards">
        {isAdmin ? (
          <>
            <div className="card"><div className="label">Users</div><div className="value">{stats.users}</div></div>
            <div className="card"><div className="label">Groups</div><div className="value">{stats.groups}</div></div>
            <div className="card"><div className="label">Transactions</div><div className="value">{stats.expenses}</div></div>
            <div className="card"><div className="label">Bots Online</div><div className="value">{stats.botsOnline}</div></div>
          </>
        ) : (
          <>
            <div className="card"><div className="label">My Groups</div><div className="value">{stats.groups}</div></div>
            <div className="card"><div className="label">Transactions This Month</div><div className="value">{stats.expenses}</div></div>
            <div className="card"><div className="label">Income This Month</div><div className="value" style={{ fontSize: '1.1rem', color: '#15803d' }}>{formatMoney(stats.totalIn)}</div></div>
            <div className="card"><div className="label">Expenses This Month</div><div className="value" style={{ fontSize: '1.1rem', color: '#b91c1c' }}>{formatMoney(stats.totalOut)}</div></div>
            <div className="card"><div className="label">Net Balance</div><div className="value" style={{ fontSize: '1.2rem' }}>{formatMoney(stats.netBalance)}</div></div>
            <div className="card"><div className="label">Bot Status</div><div className="value" style={{ fontSize: '1rem' }}>{stats.botStatus || 'offline'}</div></div>
          </>
        )}
      </div>
      <div className="toolbar">
        <Link to="/groups" className="btn btn-primary">View Groups</Link>
        <Link to="/bot" className="btn btn-secondary">Connect WhatsApp</Link>
      </div>
    </div>
  );
}
