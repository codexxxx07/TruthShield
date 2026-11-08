import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { sleep } from '../lib/utils';
import { validateEmail } from '../lib/validation';

/**
 * FRONTEND-ONLY MOCK SESSION.
 * Real credential verification, MFA and session tokens belong on a server.
 * Everything here is a local UI demo — no password ever leaves the browser.
 *
 * Only a validated profile is persisted: a remembered session expires after
 * 30 days, and an unremembered one lives in sessionStorage for this tab only.
 */
const AuthContext = createContext(null);

const SESSION_KEY = 'truthshield:session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const DEMO_USER = {
  id: 'usr_demo_01',
  name: 'Aarav Mehta',
  email: 'analyst@truthshield.demo',
  org: 'Northline Security',
  role: 'Security Analyst',
  plan: 'Enterprise trial',
};

function storageFor(remember) {
  try {
    return remember ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function clearStoredSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Trust only a well-formed session. Identity, role and plan always come from
 * the demo profile, so a tampered storage entry cannot change privileges.
 */
function sanitizeSessionUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const email = typeof raw.email === 'string' ? raw.email.trim().slice(0, 254) : '';
  if (!validateEmail(email).ok) return null;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 80) : '';
  const org = typeof raw.org === 'string' ? raw.org.trim().slice(0, 120) : '';
  return {
    ...DEMO_USER,
    name: name || DEMO_USER.name,
    email,
    org: org || DEMO_USER.org,
  };
}

function readStoredSession() {
  const areas = [
    { storage: storageFor(false), remember: false },
    { storage: storageFor(true), remember: true },
  ];

  for (const { storage, remember } of areas) {
    if (!storage) continue;
    let record;
    try {
      const raw = storage.getItem(SESSION_KEY);
      if (!raw) continue;
      record = JSON.parse(raw);
    } catch {
      try {
        storage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
      continue;
    }

    const user = record && typeof record === 'object' ? sanitizeSessionUser(record.user) : null;
    const expiresAt = record && Number.isFinite(record.expiresAt) ? record.expiresAt : null;
    if (!user || (expiresAt !== null && Date.now() > expiresAt)) {
      try {
        storage.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
      continue;
    }
    return { ...user, remember: remember && expiresAt !== null };
  }
  return null;
}

function writeStoredSession(session) {
  const remember = Boolean(session?.remember);
  clearStoredSession();
  const storage = storageFor(remember);
  if (!storage) return;
  try {
    storage.setItem(SESSION_KEY, JSON.stringify({
      version: 1,
      expiresAt: remember ? Date.now() + SESSION_TTL_MS : null,
      user: session,
    }));
  } catch {
    /* storage unavailable — non critical */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredSession);
  const [busy, setBusy] = useState(false);

  const login = useCallback(async ({ email, remember }) => {
    setBusy(true);
    await sleep(900);
    const safeEmail = String(email || '').trim().slice(0, 254);
    const name = safeEmail.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).slice(0, 80);
    const session = { ...DEMO_USER, name: name || DEMO_USER.name, email: safeEmail, remember: Boolean(remember) };
    writeStoredSession(session);
    setUser(session);
    setBusy(false);
    return session;
  }, []);

  const signup = useCallback(async ({ name, email, org }) => {
    setBusy(true);
    await sleep(1100);
    const safeEmail = String(email || '').trim().slice(0, 254);
    const safeName = String(name || '').trim().slice(0, 80) || DEMO_USER.name;
    const safeOrg = String(org || '').trim().slice(0, 120) || 'Personal workspace';
    const session = {
      ...DEMO_USER,
      name: safeName,
      email: safeEmail,
      org: safeOrg,
      plan: 'Free workspace',
      remember: true,
    };
    writeStoredSession(session);
    setUser(session);
    setBusy(false);
    return session;
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
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
