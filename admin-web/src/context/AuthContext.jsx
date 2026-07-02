import { createContext, useContext, useEffect, useState } from 'react';
import { api, clearToken, setToken } from '../api/client';
import { closeSocket } from '../api/socket';
import { setCurrencyConfig } from '../utils/currency';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [botInstanceId, setBotInstanceId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/config').then((d) => setCurrencyConfig(d.currency)).catch(() => {});
  }, []);

  useEffect(() => {
    api('/auth/me')
      .then((d) => {
        setUser(d.user);
        setBotInstanceId(d.botInstanceId);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setToken(data.token);
    setUser(data.user);
    setBotInstanceId(data.botInstanceId);
    return data;
  };

  const logout = () => {
    closeSocket();
    clearToken();
    setUser(null);
    setBotInstanceId(null);
  };

  return (
    <AuthContext.Provider value={{ user, botInstanceId, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
