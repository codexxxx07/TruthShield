/**
 * Input parsing/validation for URLs, domains, emails and UPI handles.
 * Kept UI-agnostic so it can be reused when a real API is connected.
 */

const BLOCKED_PROTOCOLS = ['javascript:', 'data:', 'file:', 'ftp:'];
const TLD_RE = /^[a-z]{2,24}$/i;
const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Loopback, private, link-local and reserved hosts must never be treated as
 * public scan targets. A real scanning backend must enforce this again after
 * DNS resolution, but rejecting them here keeps them out of the UI and logs.
 */
function isBlockedHost(host = '') {
  const name = String(host).replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!name) return true;
  if (
    name === 'localhost'
    || name.endsWith('.localhost')
    || name.endsWith('.local')
    || name.endsWith('.internal')
    || name.endsWith('.home.arpa')
  ) return true;
  if (name === '::' || name === '::1' || name === '0.0.0.0') return true;
  if (/^(fc|fd)[0-9a-f]{2}:/i.test(name)) return true; // IPv6 unique-local
  if (/^fe[89ab][0-9a-f]:/i.test(name)) return true; // IPv6 link-local
  if (!IPV4_RE.test(name)) return false;
  const octets = name.split('.').map(Number);
  if (octets.some((octet) => octet > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 0 || b === 168))
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
  );
}

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

  if (url.username || url.password) {
    return { ok: false, error: 'Remove the username and password from this URL before scanning.' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'Only http:// and https:// URLs can be scanned.' };
  }

  const host = url.hostname.replace(/\.$/, '');
  if (!host) return { ok: false, error: 'Missing a hostname.' };
  if (isBlockedHost(host)) return { ok: false, error: 'Private and local addresses cannot be publicly scanned.' };

  const isIp = IPV4_RE.test(host);
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
  if (isBlockedHost(trimmed)) return { ok: false, error: 'Private and local addresses cannot be publicly assessed.' };

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
  if (value.length > 254) return { ok: false, error: 'Email address is too long.' };
  const atIndex = value.lastIndexOf('@');
  if (atIndex < 1 || atIndex > 64) return { ok: false, error: 'Enter a valid email address.' };
  if (!EMAIL_RE.test(value)) return { ok: false, error: 'Enter a valid email address.' };
  const tld = value.slice(atIndex + 1).split('.').pop();
  if (!tld || !TLD_RE.test(tld)) return { ok: false, error: 'Enter a valid email address.' };
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
  if (value.length > 2048) return { ok: false, error: 'That payment link is too long.' };

  const fromLink = value.match(/[?&](?:pa|upi|vpa)=([^&]+)/);
  let candidate = value;
  if (fromLink) {
    try {
      candidate = decodeURIComponent(fromLink[1]);
    } catch {
      return { ok: false, error: 'That payment link contains an invalid encoded address.' };
    }
  }

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
