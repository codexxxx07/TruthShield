import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken } from '../lib/api';
import { readStorage, removeStorage, writeStorage } from '../lib/utils';

/** Session state. Credentials are verified by the API, which returns a signed token. */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStorage('truthshield:session', null));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) writeStorage('truthshield:session', user);
    else removeStorage('truthshield:session');
  }, [user]);

  const beginSession = useCallback((token, profile, remember) => {
    setToken(token);
    const session = { ...profile, remember: Boolean(remember) };
    setUser(session);
    return session;
  }, []);

  const login = useCallback(async ({ email, password, remember }) => {
    setBusy(true);
    try {
      const { token, user: profile } = await api.login(email, password);
      return beginSession(token, profile, remember);
    } finally {
      setBusy(false);
    }
  }, [beginSession]);

  const signup = useCallback(async ({ name, email, password, org }) => {
    setBusy(true);
    try {
      const { token, user: profile } = await api.signup({ name, email, password, org: org || null });
      return beginSession(token, profile, true);
    } finally {
      setBusy(false);
    }
  }, [beginSession]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, busy, login, signup, logout, isAuthenticated: Boolean(user) }), [user, busy, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
