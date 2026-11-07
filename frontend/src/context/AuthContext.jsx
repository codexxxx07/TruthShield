import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStorage, removeStorage, sleep, writeStorage } from '../lib/utils';

/**
 * FRONTEND-ONLY MOCK SESSION.
 * Real credential verification, MFA and session tokens belong on a server.
 * Everything here is a local UI demo — no password ever leaves the browser.
 */
const AuthContext = createContext(null);

const DEMO_USER = {
  id: 'usr_demo_01',
  name: 'Aarav Mehta',
  email: 'analyst@truthshield.demo',
  org: 'Northline Security',
  role: 'Security Analyst',
  plan: 'Enterprise trial',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStorage('truthshield:session', null));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) writeStorage('truthshield:session', user);
    else removeStorage('truthshield:session');
  }, [user]);

  const login = useCallback(async ({ email, remember }) => {
    setBusy(true);
    await sleep(900);
    const name = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    const session = { ...DEMO_USER, name: name || DEMO_USER.name, email, remember: Boolean(remember) };
    setUser(session);
    setBusy(false);
    return session;
  }, []);

  const signup = useCallback(async ({ name, email, org }) => {
    setBusy(true);
    await sleep(1100);
    const session = { ...DEMO_USER, name, email, org: org || 'Personal workspace', plan: 'Free workspace' };
    setUser(session);
    setBusy(false);
    return session;
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const value = useMemo(() => ({ user, busy, login, signup, logout, isAuthenticated: Boolean(user) }), [user, busy, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
