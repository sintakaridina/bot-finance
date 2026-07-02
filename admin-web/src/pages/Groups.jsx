import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../utils/currency';

export default function Groups() {
  const { isAdmin } = useAuth();
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    api('/groups').then(setGroups).catch(console.error);
  }, []);

  return (
    <div>
      <h1 className="page-title">WhatsApp Groups</h1>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Group Name</th>
              {isAdmin && <th>Owner</th>}
              <th>Transactions</th>
              <th>Total</th>
              <th>Last Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td>{g.display_name || 'WhatsApp Group'}</td>
                {isAdmin && <td>{g.owner_name || g.owner_username}</td>}
                <td>{g.expense_count}</td>
                <td>{formatMoney(g.total_amount)}</td>
                <td>{g.last_activity_at ? new Date(g.last_activity_at).toLocaleString('en-US') : '-'}</td>
                <td><Link to={`/groups/${g.id}`} className="btn btn-sm btn-secondary">Details</Link></td>
              </tr>
            ))}
            {!groups.length && (
              <tr><td colSpan={isAdmin ? 6 : 5} style={{ textAlign: 'center', color: '#94a3b8' }}>No groups yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
