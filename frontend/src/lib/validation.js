/**
 * Input parsing/validation for URLs, domains, emails and UPI handles.
 * Kept UI-agnostic so it can be reused when a real API is connected.
 */

const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'file:', 'ftp:'];
const TLD_RE = /^[a-z]{2,24}$/i;
const LABEL_RE = /^(?!-)[\p{L}\p{M}\p{N}-]{1,63}(?<!-)$/iu;

export function normalizeUrl(raw = '') {
  const trimmed = String(raw).trim();
  if (!trimmed) return { ok: false, error: 'Enter a URL to scan.' };
  if (/\s/.test(trimmed)) return { ok: false, error: 'URLs cannot contain spaces.' };
  if (trimmed.length > 2048) return { ok: false, error: 'URL is too long (maximum 2048 characters).' };

  const lowered = trimmed.toLowerCase();
  if (BLOCKED_PROTOCOLS.some((protocol) => lowered.startsWith(protocol))) {
    return { ok: false, error: 'Only http:// and https:// URLs can be scanned.' };
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, error: 'That does not look like a valid URL.' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'Only http:// and https:// URLs can be scanned.' };
  }

  const host = url.hostname.replace(/\.$/, '');
  if (!host) return { ok: false, error: 'Missing a hostname.' };
  if (host === 'localhost') return { ok: false, error: 'Local addresses cannot be publicly scanned.' };

  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  if (!isIp) {
    const labels = host.split('.');
    if (labels.length < 2) return { ok: false, error: 'Enter a full domain, for example example.com.' };
    const tld = labels[labels.length - 1];
    if (!TLD_RE.test(tld)) return { ok: false, error: `“${tld}” is not a valid top-level domain.` };
    const badLabel = labels.find((label) => !LABEL_RE.test(label));
    if (badLabel !== undefined) return { ok: false, error: 'The domain contains invalid characters.' };
  }

  return {
    ok: true,
    url: url.toString(),
    domain: host.toLowerCase(),
    host,
    protocol: url.protocol.replace(':', ''),
    path: `${url.pathname}${url.search}${url.hash}`,
  };
}

export function validateDomain(raw = '') {
  const trimmed = String(raw).trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!trimmed) return { ok: false, error: 'Enter a domain name.' };
  if (/\s/.test(trimmed)) return { ok: false, error: 'Domains cannot contain spaces.' };
  if (trimmed.includes('/')) return { ok: false, error: 'Enter the domain only, without a path.' };

  const labels = trimmed.split('.');
  if (labels.length < 2) return { ok: false, error: 'Include a top-level domain, e.g. example.com.' };
  const tld = labels[labels.length - 1];
  if (!TLD_RE.test(tld)) return { ok: false, error: `“${tld}” is not a valid top-level domain.` };
  const bad = labels.find((label) => !LABEL_RE.test(label));
  if (bad !== undefined) return { ok: false, error: 'The domain contains invalid characters.' };

  return { ok: true, domain: trimmed.toLowerCase(), url: `https://${trimmed.toLowerCase()}` };
}

export function validateEmail(raw = '') {
  const value = String(raw).trim();
  if (!value) return { ok: false, error: 'Email address is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(value)) return { ok: false, error: 'Enter a valid email address.' };
  return { ok: true, value };
}

export function validatePassword(raw = '') {
  const value = String(raw);
  if (!value) return { ok: false, error: 'Password is required.' };
  if (value.length < 8) return { ok: false, error: 'Use at least 8 characters.' };
  return { ok: true, value };
}

/** 0–4 strength score with per-rule feedback. */
export function passwordStrength(value = '') {
  const checks = [
    { id: 'length', label: '8+ characters', pass: value.length >= 8 },
    { id: 'case', label: 'Upper & lowercase', pass: /[a-z]/.test(value) && /[A-Z]/.test(value) },
    { id: 'number', label: 'A number', pass: /\d/.test(value) },
    { id: 'symbol', label: 'A symbol', pass: /[^A-Za-z0-9]/.test(value) },
  ];
  const passed = checks.filter((check) => check.pass).length;
  const bonus = value.length >= 14 ? 1 : 0;
  const score = Math.min(4, passed === 0 ? 0 : passed - 1 + bonus);
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'];
  return { score, label: labels[score], checks, passed };
}

const UPI_RE = /^[a-z0-9._-]{2,256}@[a-z]{2,64}$/i;

export function validateUpi(raw = '') {
  const value = String(raw).trim().toLowerCase();
  if (!value) return { ok: false, error: 'Enter a UPI ID or paste a UPI payment link.' };

  const fromLink = value.match(/[?&](?:pa|upi|vpa)=([^&]+)/);
  const candidate = fromLink ? decodeURIComponent(fromLink[1]) : value;

  if (!UPI_RE.test(candidate)) {
    return { ok: false, error: 'A UPI ID looks like name@bank, e.g. merchant@okhdfcbank.' };
  }
  return { ok: true, vpa: candidate };
}

export function validateFile(file, { maxMb = 5, types = ['image/png', 'image/jpeg', 'image/webp'] } = {}) {
  if (!file) return { ok: false, error: 'Choose a file first.' };
  if (!types.includes(file.type)) return { ok: false, error: 'Use a PNG, JPG or WebP file.' };
  if (file.size > maxMb * 1024 * 1024) return { ok: false, error: `Keep the file under ${maxMb} MB.` };
  return { ok: true };
}
