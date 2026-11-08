/**
 * Client for the TruthShield API. When the backend cannot be reached, callers fall
 * back to the simulated engines so the interface still works as a standalone demo.
 */
import { useEffect, useState } from 'react';
import { buildScanReport, buildSecurityAssessment, buildSslReport } from './mockEngine';
import { readStorage, removeStorage, writeStorage } from './utils';

const TOKEN_KEY = 'truthshield:token';
const REQUEST_TIMEOUT_MS = 180000;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export class BackendUnavailable extends Error {
  constructor() {
    super('The TruthShield server could not be reached. Check that the backend is running.');
  }
}

export const getToken = () => readStorage(TOKEN_KEY, null);
export const setToken = (token) => (token ? writeStorage(TOKEN_KEY, token) : removeStorage(TOKEN_KEY));

function detailMessage(data, status) {
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg.replace(/^Value error, /, '');
  return `The request failed (${status}).`;
}

async function request(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (failure) {
    if (failure.name === 'TimeoutError') throw new ApiError('The analysis took too long. Please try again.', 504);
    throw new BackendUnavailable();
  }
  const isJson = response.headers.get('content-type')?.includes('application/json');
  // The dev proxy answers with a bodiless 5xx when nothing is listening behind it.
  if (response.status >= 500 && !isJson) throw new BackendUnavailable();
  const data = isJson ? await response.json() : null;
  if (!response.ok) throw new ApiError(detailMessage(data, response.status), response.status);
  return data;
}

export const api = {
  health: () => request('/health'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  scan: (url, options = {}) => request('/scan', { method: 'POST', body: { url, ...options } }),
  ssl: (target) => request('/ssl', { method: 'POST', body: { target } }),
  assessment: (target) => request('/assessment', { method: 'POST', body: { target } }),
  detect: (slug, target, { fresh = false } = {}) => request(`/detect/${slug}`, { method: 'POST', body: { target, fresh } }),
  uploadQr: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('/upi/qr', { method: 'POST', form });
  },
  report: (form) => request('/reports', { method: 'POST', form }),
  threats: () => request('/threats'),
  dashboard: () => request('/dashboard'),
};

export async function withFallback(call, simulate) {
  try {
    return await call();
  } catch (error) {
    if (error instanceof BackendUnavailable) return simulate();
    throw error;
  }
}

export const runScan = (url, options) => withFallback(() => api.scan(url, options), () => buildScanReport(url));
export const fetchSslReport = (domain) => withFallback(() => api.ssl(domain), () => buildSslReport(domain));
export const fetchAssessment = (domain) => withFallback(() => api.assessment(domain), () => buildSecurityAssessment(domain));

let healthCheck;

/** True once the API has answered, false if it cannot be reached, null while checking. */
export function useLiveBackend() {
  const [live, setLive] = useState(null);
  useEffect(() => {
    let active = true;
    healthCheck ??= api.health().then(() => true, () => false);
    healthCheck.then((value) => {
      if (active) setLive(value);
      if (!value) healthCheck = undefined;
    });
    return () => {
      active = false;
    };
  }, []);
  return live;
}
