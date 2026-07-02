import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Finance Bot</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/groups">Groups</NavLink>
          <NavLink to="/bot">Connect WA</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          {isAdmin && <NavLink to="/users">Users</NavLink>}
          {isAdmin && <NavLink to="/templates">Bot Messages</NavLink>}
        </nav>
        <div className="sidebar-foot">
          <span>{user?.username} ({user?.role})</span>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
