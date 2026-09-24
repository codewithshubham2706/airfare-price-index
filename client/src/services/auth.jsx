import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('apix-token') || '');
  const [booting, setBooting] = useState(Boolean(localStorage.getItem('apix-token')));

  useEffect(() => {
    if (!token) { setBooting(false); return; }
    api.me(token)
      .then((d) => setUser(d.user))
      .catch(() => { localStorage.removeItem('apix-token'); setToken(''); })
      .finally(() => setBooting(false));
  }, [token]);

  const persist = (d) => {
    localStorage.setItem('apix-token', d.token);
    setToken(d.token);
    setUser(d.user);
    return d.user;
  };

  const login = async (email, password) => {
    const d = await api.login(email, password);
    if (!d.ok) throw new Error(d.body?.error || `Login failed (${d.status})`);
    return persist(d);
  };

  const register = async (email, password, name) => {
    const d = await api.register(email, password, name);
    if (!d.ok) throw new Error(d.body?.error || `Registration failed (${d.status})`);
    return persist(d);
  };

  const logout = () => {
    localStorage.removeItem('apix-token');
    setToken('');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, booting, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
