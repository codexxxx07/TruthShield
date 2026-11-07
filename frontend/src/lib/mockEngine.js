/**
 * SIMULATED ANALYSIS ENGINE
 * ------------------------------------------------------------------
 * The frontend has no backend yet, so every "scan" here is generated
 * locally from a deterministic seed. Results are stable per target and
 * are always rendered with a "simulated data" label in the UI.
 *
 * When a real API lands, replace the exported functions with fetch
 * calls that return the same shapes — no page component needs to change.
 */
import { createRng, hashString, clamp } from './utils';

export const VERDICT_META = {
  safe: { label: 'Safe', tone: 'safe', description: 'No meaningful risk signals detected' },
  suspicious: { label: 'Suspicious', tone: 'medium', description: 'Signals require caution before use' },
  malicious: { label: 'Malicious', tone: 'critical', description: 'Multiple high-confidence threat signals' },
};

const RISK_KEYWORDS = [
  'login', 'signin', 'verify', 'verification', 'secure', 'account', 'update', 'confirm',
  'bank', 'kyc', 'wallet', 'gift', 'prize', 'claim', 'support', 'invoice', 'unlock',
  'recovery', 'password', 'billing', 'refund', 'delivery', 'reward', 'bonus', 'alert',
];

const RISKY_TLDS = ['zip', 'top', 'xyz', 'click', 'shop', 'info', 'live', 'work', 'rest', 'buzz', 'support'];
const REGISTRARS = [
  'NameCheap, Inc.', 'GoDaddy.com, LLC', 'Tucows Domains Inc.', 'Gandi SAS',
  'Cloudflare, Inc.', 'Hostinger Operations UAB', 'Dynadot LLC', 'Sav.com, LLC',
];
const HOSTS = [
  { asn: 'AS13335', org: 'Cloudflare, Inc.', country: 'United States', countryCode: 'US' },
  { asn: 'AS16509', org: 'Amazon.com, Inc.', country: 'United States', countryCode: 'US' },
  { asn: 'AS14061', org: 'DigitalOcean, LLC', country: 'Netherlands', countryCode: 'NL' },
  { asn: 'AS47583', org: 'Hostinger International Ltd.', country: 'Lithuania', countryCode: 'LT' },
  { asn: 'AS210644', org: 'AEZA International Ltd.', country: 'Russia', countryCode: 'RU' },
  { asn: 'AS9009', org: 'M247 Europe SRL', country: 'Romania', countryCode: 'RO' },
  { asn: 'AS63949', org: 'Akamai Connected Cloud', country: 'Singapore', countryCode: 'SG' },
];
const NAMESERVERS = ['ns1.dns-parking.com', 'ns2.dns-parking.com', 'dns1.registrar-servers.com', 'ns-cloud-a1.googledomains.com', 'elle.ns.cloudflare.com', 'ns1.hostinger.com'];
const ISSUERS = [
  { name: "Let's Encrypt", short: 'R3', tier: 'DV', trust: 86 },
  { name: 'DigiCert Inc', short: 'DigiCert TLS RSA SHA256 2020 CA1', tier: 'OV', trust: 96 },
  { name: 'Sectigo Limited', short: 'Sectigo RSA Domain Validation', tier: 'DV', trust: 78 },
  { name: 'GlobalSign nv-sa', short: 'GlobalSign RSA OV SSL CA 2018', tier: 'OV', trust: 92 },
  { name: 'ZeroSSL', short: 'ZeroSSL RSA Domain Secure Site CA', tier: 'DV', trust: 64 },
];
const INTEL_SOURCES = [
  'Global Blocklist Exchange',
  'PhishWatch Community Feed',
  'Certificate Watch Graph',
  'Domain Reputation Mesh',
  'Malware URL Corpus',
];

const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
const daysAhead = (days) => new Date(Date.now() + days * 86400000).toISOString();
const testIp = (rng) => `${rng.pick(['192.0.2', '198.51.100', '203.0.113'])}.${rng.int(2, 250)}`;

function domainTraits(domain) {
  const labels = domain.split('.');
  const core = labels.slice(0, -1).join('.');
  const tld = labels[labels.length - 1];
  const keywords = RISK_KEYWORDS.filter((word) => core.includes(word));
  return {
    core,
    tld,
    keywords,
    hyphens: (core.match(/-/g) || []).length,
    digits: (core.match(/\d/g) || []).length,
    length: core.length,
    subdomains: labels.length - 2,
    riskyTld: RISKY_TLDS.includes(tld),
  };
}

function scoreFromTraits(domain, rng) {
  const traits = domainTraits(domain);
  let score = rng.int(4, 24);
  score += Math.min(30, traits.keywords.length * 13);
  score += Math.min(16, traits.hyphens * 5);
  score += Math.min(10, traits.digits * 3);
  if (traits.length > 18) score += 7;
  if (traits.riskyTld) score += 14;
  if (traits.subdomains >= 2) score += 8;
  if (traits.tld === 'gov' || traits.tld === 'edu') score -= 12;
  if (['google', 'github', 'microsoft', 'apple', 'amazon', 'wikipedia'].includes(traits.core)) score -= 20;
  return clamp(Math.round(score), 2, 97);
}

export function verdictFor(score) {
  if (score >= 65) return 'malicious';
  if (score >= 33) return 'suspicious';
  return 'safe';
}

export const SAMPLE_TARGETS = [
  { label: 'google.com', url: 'https://google.com', note: 'Trusted baseline' },
  { label: 'paypal-secure-login.example', url: 'https://paypal-secure-login.example/session/verify', note: 'Credential phishing clone' },
  { label: 'sbi-kyc-verify.example', url: 'https://sbi-kyc-verify.example/kyc/update-account', note: 'Bank impersonation' },
  { label: 'github.com', url: 'https://github.com', note: 'Developer platform' },
  { label: 'amazon-deals-outlet.example', url: 'https://amazon-deals-outlet.example/deal/iphone-17', note: 'Payment fraud' },
];

const CURATED = {
  'google.com': {
    riskScore: 3,
    verdict: 'safe',
    confidence: 99,
    summary:
      'No phishing, malware or impersonation indicators were found. The certificate chain is valid and CT-logged, transport security is current, and registration history spans more than 28 years.',
    indicators: [],
    positiveSignals: [
      'Valid certificate chain issued by Google Trust Services',
      'HSTS enabled with a two-year max-age and preload',
      'Domain registered since 1997, no ownership churn',
      'Apex domain present on all major blocklists as clean',
    ],
    categories: { phishing: 1, malware: 0, impersonation: 2, infrastructure: 4, behaviour: 2 },
    ssl: { grade: 'A+', issuer: 'Google Trust Services', protocol: 'TLS 1.3', valid: true, daysRemaining: 62 },
    domainInfo: {
      registrar: 'MarkMonitor Inc.',
      ageDays: 10643,
      ip: '192.0.2.14',
      country: 'United States',
      countryCode: 'US',
      asn: 'AS15169',
      org: 'Google LLC',
      nameservers: ['ns1.google.com', 'ns2.google.com'],
      privacy: false,
    },
    redirects: [{ step: 1, from: 'https://google.com', to: 'https://www.google.com/', status: 301, type: 'HTTP', note: 'Canonical host redirect' }],
    intel: INTEL_SOURCES.map((source) => ({ source, status: 'clean', confidence: 99, lastSeen: daysAgo(1) })),
  },
  'github.com': {
    riskScore: 6,
    verdict: 'safe',
    confidence: 97,
    summary:
      'Infrastructure and certificate posture are consistent with the verified GitHub estate. No content, redirect or brand signals were flagged across the sandbox pass.',
    indicators: [],
    positiveSignals: [
      'Certificate issued to GitHub, Inc. with matching SANs',
      'Strict-Transport-Security present with preload',
      'Consistent ASN and nameserver pair with historical records',
      'No obfuscated scripts in the first-party bundle',
    ],
    categories: { phishing: 2, malware: 1, impersonation: 3, infrastructure: 5, behaviour: 3 },
    ssl: { grade: 'A+', issuer: 'DigiCert Inc', protocol: 'TLS 1.3', valid: true, daysRemaining: 208 },
    domainInfo: {
      registrar: 'MarkMonitor Inc.',
      ageDays: 6800,
      ip: '198.51.100.22',
      country: 'United States',
      countryCode: 'US',
      asn: 'AS36459',
      org: 'GitHub, Inc.',
      nameservers: ['ns-1283.awsdns-32.org', 'ns-520.awsdns-01.net'],
      privacy: false,
    },
    redirects: [],
    intel: INTEL_SOURCES.map((source) => ({ source, status: 'clean', confidence: 96, lastSeen: daysAgo(1) })),
  },
  'paypal-secure-login.example': {
    riskScore: 94,
    verdict: 'malicious',
    confidence: 96,
    summary:
      'High-confidence credential phishing. The page clones a payment provider login form, posts credentials to a third-party endpoint, and was registered 9 days ago behind a privacy proxy on a bulletproof host.',
    indicators: [
      { id: 'brand-clone', severity: 'critical', label: 'Payment brand cloned', detail: 'Logo, palette and login form closely match a payment provider while the domain is unrelated to it.', evidence: 'Visual similarity 96% · favicon hash match' },
      { id: 'cred-post', severity: 'critical', label: 'Credentials posted off-domain', detail: 'The login form submits to a host outside the visible domain with no CSRF protection.', evidence: 'POST https://collect.example-cdn.example/api/v2/login' },
      { id: 'new-domain', severity: 'high', label: 'Domain registered 9 days ago', detail: 'Threat actors rotate infrastructure rapidly; new registrations next to a brand keyword are a strong signal.', evidence: 'Created 2026-10-30 · privacy shielded' },
      { id: 'keyword-domain', severity: 'high', label: 'Brand + lure keywords in hostname', detail: 'The hostname combines a brand with “secure” and “login”, a classic impersonation pattern.', evidence: 'paypal-secure-login.example' },
      { id: 'no-mx', severity: 'medium', label: 'No mail records on a "bank" domain', detail: 'A legitimate payment provider would publish SPF, DMARC and MX records.', evidence: 'MX: none · SPF: none · DMARC: none' },
      { id: 'obfuscated-js', severity: 'high', label: 'Obfuscated anti-analysis script', detail: 'A packed script disables right-click and devtools and blocks paste into the password field.', evidence: 'eval(function(p,a,c,k,e,d) … 14.2 KB' },
    ],
    positiveSignals: ['TLS 1.2 is enabled (certificate is domain-validated only)'],
    categories: { phishing: 96, malware: 32, impersonation: 94, infrastructure: 72, behaviour: 88 },
    ssl: { grade: 'C', issuer: 'ZeroSSL', protocol: 'TLS 1.2', valid: true, daysRemaining: 81 },
    domainInfo: {
      registrar: 'NameCheap, Inc.',
      ageDays: 9,
      ip: '203.0.113.87',
      country: 'Russia',
      countryCode: 'RU',
      asn: 'AS210644',
      org: 'AEZA International Ltd.',
      nameservers: ['ns1.dns-parking.com', 'ns2.dns-parking.com'],
      privacy: true,
    },
    redirects: [
      { step: 1, from: 'https://paypal-secure-login.example/session/verify', to: 'https://track.example-cdn.example/r/8f2a', status: 302, type: 'HTTP', note: 'Tracking gateway' },
      { step: 2, from: 'https://track.example-cdn.example/r/8f2a', to: 'https://paypal-secure-login.example/auth/login.html', status: 302, type: 'HTTP', note: 'Lure page' },
    ],
    intel: [
      { source: 'Global Blocklist Exchange', status: 'malicious', confidence: 98, lastSeen: daysAgo(0) },
      { source: 'PhishWatch Community Feed', status: 'malicious', confidence: 94, lastSeen: daysAgo(1) },
      { source: 'Certificate Watch Graph', status: 'suspicious', confidence: 72, lastSeen: daysAgo(2) },
      { source: 'Domain Reputation Mesh', status: 'malicious', confidence: 91, lastSeen: daysAgo(0) },
      { source: 'Malware URL Corpus', status: 'unrated', confidence: 0, lastSeen: null },
    ],
  },
  'sbi-kyc-verify.example': {
    riskScore: 88,
    verdict: 'malicious',
    confidence: 93,
    summary:
      'Banking impersonation targeting Indian retail customers. A fake KYC update flow requests card details, OTP and net-banking credentials, then relays them to a Telegram bot.',
    indicators: [
      { id: 'bank-clone', severity: 'critical', label: 'Bank KYC flow impersonated', detail: 'Form fields and step order reproduce a real KYC update journey, including OTP capture.', evidence: '4-step form · OTP input · card CVV' },
      { id: 'otp-capture', severity: 'critical', label: 'One-time password capture', detail: 'Legitimate banks never ask for an OTP inside a link opened from SMS or email.', evidence: '#otp sent to third-party endpoint' },
      { id: 'clone-kit', severity: 'high', label: 'Phishing kit family match', detail: 'Page templates share static assets with a known banking kit tracked since 2025.', evidence: 'Kit “KYC-Shield v3” · 91% structural match' },
      { id: 'short-lived-cert', severity: 'medium', label: 'Certificate issued 3 days ago', detail: 'Short-lived DV certificates on a financial brand are typical of disposable phishing hosts.', evidence: "Let's Encrypt · 3-day-old issuance" },
      { id: 'cloaking', severity: 'high', label: 'Crawler cloaking detected', detail: 'Search crawlers receive a harmless blog page while mobile visitors get the credential form.', evidence: 'Content divergence 94%' },
    ],
    positiveSignals: [],
    categories: { phishing: 92, malware: 18, impersonation: 90, infrastructure: 68, behaviour: 84 },
    ssl: { grade: 'B', issuer: "Let's Encrypt", protocol: 'TLS 1.2', valid: true, daysRemaining: 87 },
    domainInfo: {
      registrar: 'Hostinger Operations UAB',
      ageDays: 3,
      ip: '198.51.100.143',
      country: 'India',
      countryCode: 'IN',
      asn: 'AS47583',
      org: 'Hostinger International Ltd.',
      nameservers: ['ns1.hostinger.com', 'ns2.hostinger.com'],
      privacy: true,
    },
    redirects: [
      { step: 1, from: 'https://sbi-kyc-verify.example/kyc/update-account', to: 'https://sbi-kyc-verify.example/kyc/step-1.html', status: 200, type: 'HTML', note: 'Lure page loaded' },
    ],
    intel: [
      { source: 'Global Blocklist Exchange', status: 'suspicious', confidence: 76, lastSeen: daysAgo(0) },
      { source: 'PhishWatch Community Feed', status: 'malicious', confidence: 95, lastSeen: daysAgo(1) },
      { source: 'Certificate Watch Graph', status: 'malicious', confidence: 82, lastSeen: daysAgo(1) },
      { source: 'Domain Reputation Mesh', status: 'suspicious', confidence: 68, lastSeen: daysAgo(2) },
      { source: 'Malware URL Corpus', status: 'unrated', confidence: 0, lastSeen: null },
    ],
  },
  'amazon-deals-outlet.example': {
    riskScore: 61,
    verdict: 'suspicious',
    confidence: 81,
    summary:
      'Unverified retail offer with payment collection handled off-platform. No malware was observed, but the checkout form requests card data on a domain with no merchant identity, no policy pages and a four-week-old registration.',
    indicators: [
      { id: 'offsite-payment', severity: 'high', label: 'Payment captured off-platform', detail: 'Checkout fields are hosted on the lure domain instead of a known payment processor.', evidence: 'Card number · CVV · UPI collect request' },
      { id: 'brand-lure', severity: 'medium', label: 'Brand and discount lure', detail: 'The page uses a marketplace brand with a price 71% below the market baseline.', evidence: 'Visual similarity 68% · no brand authorisation' },
      { id: 'young-domain', severity: 'medium', label: 'Domain age under 30 days', detail: 'Seasonal shopping domains registered weeks before a sale event are frequently disposable.', evidence: 'Created 2026-10-12' },
      { id: 'no-policy', severity: 'low', label: 'Missing merchant identity', detail: 'No contact address, returns policy or company registration was found.', evidence: '0 of 4 expected policy pages' },
    ],
    positiveSignals: ['Valid DV certificate', 'No obfuscated scripts detected'],
    categories: { phishing: 58, malware: 8, impersonation: 66, infrastructure: 48, behaviour: 34 },
    ssl: { grade: 'B', issuer: 'Sectigo Limited', protocol: 'TLS 1.2', valid: true, daysRemaining: 141 },
    domainInfo: {
      registrar: 'GoDaddy.com, LLC',
      ageDays: 27,
      ip: '192.0.2.201',
      country: 'United States',
      countryCode: 'US',
      asn: 'AS13335',
      org: 'Cloudflare, Inc.',
      nameservers: ['elle.ns.cloudflare.com', 'karl.ns.cloudflare.com'],
      privacy: true,
    },
    redirects: [
      { step: 1, from: 'https://amazon-deals-outlet.example/deal/iphone-17', to: 'https://amazon-deals-outlet.example/checkout/express', status: 302, type: 'HTTP', note: 'Forced checkout' },
    ],
    intel: [
      { source: 'Global Blocklist Exchange', status: 'suspicious', confidence: 62, lastSeen: daysAgo(1) },
      { source: 'PhishWatch Community Feed', status: 'suspicious', confidence: 58, lastSeen: daysAgo(2) },
      { source: 'Certificate Watch Graph', status: 'clean', confidence: 40, lastSeen: daysAgo(4) },
      { source: 'Domain Reputation Mesh', status: 'suspicious', confidence: 71, lastSeen: daysAgo(0) },
      { source: 'Malware URL Corpus', status: 'unrated', confidence: 0, lastSeen: null },
    ],
  },
};

function buildIndicators(domain, riskScore, rng) {
  const traits = domainTraits(domain);
  const pool = [];

  if (traits.keywords.length) {
    pool.push({
      id: 'keyword',
      severity: riskScore > 55 ? 'high' : 'medium',
      label: 'Lure keywords in hostname',
      detail: `The hostname contains ${traits.keywords.map((word) => `“${word}”`).join(', ')}, commonly used to imitate account or security flows.`,
      evidence: domain,
    });
  }
  if (traits.hyphens >= 2) {
    pool.push({ id: 'hyphens', severity: 'medium', label: 'Hyphen-stuffed domain', detail: 'Multiple hyphens are used to fit brand and lure words into one label.', evidence: `${traits.hyphens} hyphens in ${traits.core}` });
  }
  if (traits.riskyTld) {
    pool.push({ id: 'tld', severity: 'high', label: `High-abuse TLD .${traits.tld}`, detail: 'This TLD appears disproportionately in abuse feeds because registrations are cheap and rarely verified.', evidence: `.${traits.tld}` });
  }
  if (traits.digits >= 3) {
    pool.push({ id: 'digits', severity: 'low', label: 'Numeric padding in hostname', detail: 'Numbered variants are used to mass-produce near-identical lure domains.', evidence: traits.core });
  }
  if (riskScore > 40) {
    pool.push({ id: 'cloak', severity: riskScore > 72 ? 'high' : 'medium', label: 'Conditional content serving', detail: 'The response body differs when requested with a crawler user agent.', evidence: 'Crawler vs. mobile DOM divergence' });
  }
  if (riskScore > 55) {
    pool.push({ id: 'form', severity: 'critical', label: 'Sensitive input fields', detail: 'The page collects passwords or payment data without transport or origin guarantees.', evidence: 'password · card number · OTP' });
    pool.push({ id: 'obfuscation', severity: 'medium', label: 'Packed JavaScript bundle', detail: 'A second-stage script is decoded at runtime, hiding its behaviour from static review.', evidence: 'eval() wrapper · 12 KB payload' });
  }
  if (riskScore > 30 && rng.chance(0.6)) {
    pool.push({ id: 'age', severity: riskScore > 65 ? 'high' : 'medium', label: 'Recent domain registration', detail: 'Newly registered domains with security-themed names are a leading phishing indicator.', evidence: `${rng.int(4, 48)} days old` });
  }
  if (rng.chance(0.5)) {
    pool.push({ id: 'headers', severity: 'low', label: 'Missing security headers', detail: 'No HSTS, CSP or frame-ancestors policy was returned with the document.', evidence: '3 of 6 headers absent' });
  }
  return pool.slice(0, 6);
}

function buildRedirects(url, domain, riskScore, rng) {
  if (riskScore < 25) {
    return rng.chance(0.5)
      ? [{ step: 1, from: url, to: `https://www.${domain}/`, status: 301, type: 'HTTP', note: 'Canonical host redirect' }]
      : [];
  }
  const hops = riskScore > 65 ? 3 : 1;
  const chain = [{ step: 1, from: url, to: `https://track-${rng.int(10, 99)}.cdn-relay.example/r/${hashString(domain).toString(16).slice(0, 6)}`, status: 302, type: 'HTTP', note: 'Third-party tracking gateway' }];
  if (hops > 1) {
    chain.push({ step: 2, from: chain[0].to, to: `https://${domain}/auth/${rng.pick(['login', 'verify', 'secure', 'session'])}.html`, status: 302, type: 'HTTP', note: 'Lure page handoff' });
    chain.push({ step: 3, from: chain[1].to, to: `https://collect.darkhost.example/api/v2/ingest`, status: 200, type: 'JS', note: 'Credential exfiltration endpoint' });
  }
  return chain;
}

function buildDomainInfo(domain, riskScore, rng) {
  const host = rng.pick(HOSTS);
  const ageDays = riskScore > 60 ? rng.int(3, 40) : riskScore > 35 ? rng.int(60, 900) : rng.int(900, 6200);
  return {
    registrar: rng.pick(REGISTRARS),
    ageDays,
    created: daysAgo(ageDays),
    ip: testIp(rng),
    country: host.country,
    countryCode: host.countryCode,
    asn: host.asn,
    org: host.org,
    nameservers: rng.sample(NAMESERVERS, 2),
    privacy: riskScore > 45 ? rng.chance(0.85) : rng.chance(0.25),
  };
}

export function buildScanReport(rawUrl) {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
  const domain = new URL(url).hostname.toLowerCase();
  const rng = createRng(domain);
  const baseScore = scoreFromTraits(domain, rng);
  const curated = CURATED[domain] || {};

  const riskScore = curated.riskScore ?? baseScore;
  const verdict = curated.verdict ?? verdictFor(riskScore);
  const domainInfo = { ...buildDomainInfo(domain, riskScore, rng), ...(curated.domainInfo || {}) };
  const issuer = rng.pick(ISSUERS);
  const sslBase = {
    valid: true,
    issuer: issuer.name,
    protocol: riskScore > 60 ? rng.pick(['TLS 1.2', 'TLS 1.2']) : rng.pick(['TLS 1.3', 'TLS 1.3', 'TLS 1.2']),
    grade: riskScore > 70 ? rng.pick(['B', 'C']) : riskScore > 40 ? rng.pick(['A', 'B+']) : 'A+',
    daysRemaining: rng.int(20, 300),
  };
  const ssl = { ...sslBase, ...(curated.ssl || {}) };
  const indicators = curated.indicators ?? buildIndicators(domain, riskScore, rng);
  const positiveSignals = curated.positiveSignals ?? (riskScore < 45
    ? [
        'Certificate chain validates against a public root store',
        riskScore < 25 ? 'HSTS present with a long max-age' : 'Modern TLS configuration detected',
        'No obfuscated first-party scripts observed',
        'Domain reputation consistent with historical records',
      ]
    : ['A valid certificate was presented (domain-validated only)']);

  const categories = curated.categories ?? {
    phishing: clamp(Math.round(riskScore * rng.float(0.8, 1.15)), 0, 100),
    malware: clamp(Math.round(riskScore * rng.float(0.2, 0.7)), 0, 100),
    impersonation: clamp(Math.round(riskScore * rng.float(0.5, 1.1)), 0, 100),
    infrastructure: clamp(Math.round(riskScore * rng.float(0.6, 1.05)), 0, 100),
    behaviour: clamp(Math.round(riskScore * rng.float(0.4, 0.95)), 0, 100),
  };

  const intel = curated.intel ?? INTEL_SOURCES.map((source, index) => {
    const signal = riskScore + rng.int(-22, 18) - index * 2;
    let status = 'clean';
    if (signal > 72) status = 'malicious';
    else if (signal > 48) status = 'suspicious';
    else if (signal < 10) status = 'unrated';
    return {
      source,
      status,
      confidence: status === 'unrated' ? 0 : clamp(Math.round(signal + rng.int(4, 18)), 20, 99),
      lastSeen: status === 'unrated' ? null : daysAgo(rng.int(0, 9)),
    };
  });

  const recommendations = riskScore >= 65
    ? [
        'Do not enter credentials, payment details or one-time passwords on this page',
        'Block the domain at DNS, proxy or email gateway level',
        'Report the URL to your regional CERT and the impersonated brand',
        'If credentials were entered, rotate them now and revoke active sessions',
      ]
    : riskScore >= 33
      ? [
          'Verify the merchant identity independently before paying',
          'Prefer an app or a bookmarked URL over a link from messages',
          'Do not share OTPs, card CVVs or net-banking passwords',
          'Re-scan from a signed-in dashboard session if this site is business critical',
        ]
      : [
          'No action required for a standard browsing session',
          'Keep certificate and header monitoring enabled for this domain',
          'Re-check after any hosting or registrar change',
        ];

  return {
    scanId: `TS-${hashString(domain).toString(36).toUpperCase().slice(0, 8)}`,
    url,
    domain,
    scannedAt: new Date().toISOString(),
    riskScore,
    verdict,
    verdictMeta: VERDICT_META[verdict],
    confidence: curated.confidence ?? clamp(Math.round(72 + Math.abs(riskScore - 50) * 0.45), 62, 98),
    summary: curated.summary ?? (
      verdict === 'safe'
        ? 'No phishing, malware or impersonation indicators were found across content, certificate and reputation checks. Standard browsing precautions apply.'
        : verdict === 'suspicious'
          ? 'Several weak-to-moderate signals were found. The site is not a confirmed threat, but it shows patterns consistent with disposable or deceptive infrastructure.'
          : 'Multiple independent high-confidence signals confirm malicious intent. Treat this page as hostile and avoid all interaction.'
    ),
    indicators,
    positiveSignals,
    categories,
    domainInfo,
    ssl: {
      ...ssl,
      subject: domain,
      issuerMeta: curated.ssl?.issuer ? { name: curated.ssl.issuer, tier: 'DV', trust: 60 } : issuer,
      ctLogged: riskScore < 75,
      keyType: riskScore > 70 ? 'RSA' : rng.pick(['ECDSA P-256', 'RSA 2048']),
      validFrom: daysAgo(rng.int(30, 200)),
      validTo: daysAhead(ssl.daysRemaining),
      sans: [domain, `www.${domain}`],
    },
    redirects: curated.redirects ?? buildRedirects(url, domain, riskScore, rng),
    intel,
    timeline: [
      { stage: 'DNS resolution', status: 'complete', ms: rng.int(18, 90), detail: `${domain} → ${domainInfo.ip}` },
      { stage: 'TLS handshake', status: 'complete', ms: rng.int(40, 180), detail: `${ssl.protocol} · ${ssl.issuer}` },
      { stage: 'Certificate transparency', status: 'complete', ms: rng.int(60, 240), detail: ssl.ctLogged ? '2 SCTs embedded' : 'No SCTs embedded' },
      { stage: 'Content render', status: 'complete', ms: rng.int(180, 680), detail: `${rng.int(14, 62)} requests · ${rng.int(2, 12)} third-party` },
      { stage: 'Behaviour sandbox', status: 'complete', ms: rng.int(220, 900), detail: `${rng.int(3, 14)} scripts executed` },
      { stage: 'Reputation correlation', status: 'complete', ms: rng.int(90, 320), detail: `${intel.filter((source) => source.status !== 'clean' && source.status !== 'unrated').length} of ${intel.length} sources returned signals` },
    ],
    recommendations,
    relationship: {
      relatedDomains: clamp(rng.int(0, 12), 0, 12),
      sharedCertificates: clamp(rng.int(0, 6), 0, 6),
      campaignLinked: riskScore > 70,
    },
  };
}

/* ------------------------------------------------------------------
   SSL / certificate report
------------------------------------------------------------------ */
export function buildSslReport(rawDomain) {
  const domain = rawDomain.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  const rng = createRng(`ssl:${domain}`);
  const curated = CURATED[domain]?.ssl || {};
  const risk = scoreFromTraits(domain, rng);
  const issuer = rng.pick(ISSUERS);
  const daysRemaining = rng.int(6, 320);
  const isWeak = risk > 65;
  const keyType = isWeak ? 'RSA' : rng.pick(['ECDSA', 'RSA']);
  const keySize = keyType === 'RSA' ? (isWeak ? 2048 : rng.pick([2048, 4096])) : 256;
  const score = clamp(
    (curated.grade === 'A+' ? 96 : curated.grade === 'C' ? 58 : 78) + rng.int(-6, 6),
    40,
    99,
  );

  return {
    domain,
    checkedAt: new Date().toISOString(),
    score,
    grade: curated.grade ?? (score > 92 ? 'A+' : score > 85 ? 'A' : score > 76 ? 'B' : score > 62 ? 'C' : 'D'),
    health: score > 88 ? 'healthy' : score > 70 ? 'attention' : 'at-risk',
    subject: {
      commonName: domain,
      organisation: isWeak ? 'Domain privacy protected' : rng.pick(['Cloudflare, Inc.', 'GitHub, Inc.', 'DigitalOcean, LLC', 'Acme Commerce Ltd.']),
      organisationalUnit: isWeak ? '—' : rng.pick(['Security', 'Platform Engineering', 'Infrastructure']),
      locality: rng.pick(['San Francisco', 'Amsterdam', 'Singapore', 'Mumbai', 'Frankfurt']),
      country: rng.pick(['US', 'NL', 'SG', 'IN', 'DE']),
      sans: [`${domain}`, `www.${domain}`, `api.${domain}`],
    },
    issuer: {
      name: curated.issuer ?? issuer.name,
      commonName: issuer.short,
      organisation: curated.issuer ?? issuer.name,
      tier: issuer.tier,
      trust: issuer.trust,
      country: 'US',
    },
    validity: {
      notBefore: daysAgo(rng.int(20, 240)),
      notAfter: daysAhead(daysRemaining),
      daysRemaining,
      lifetimeDays: rng.int(90, 400),
      status: daysRemaining > 21 ? 'valid' : 'expiring',
    },
    protocol: curated.protocol ?? (risk > 60 ? 'TLS 1.2' : rng.pick(['TLS 1.3', 'TLS 1.2'])),
    cipher: rng.pick(['TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256', 'ECDHE-RSA-AES128-GCM-SHA256']),
    key: { algorithm: keyType, size: keySize, curve: keyType === 'ECDSA' ? 'prime256v1' : null, strength: keyType === 'RSA' && keySize >= 2048 ? 'strong' : 'adequate' },
    signature: rng.pick(['sha256WithRSAEncryption', 'ecdsa-with-SHA384']),
    chain: [
      { level: 'Leaf', name: domain, issuer: curated.issuer ?? issuer.name, validTo: daysAhead(daysRemaining), status: 'valid', algorithm: 'SHA-256' },
      { level: 'Intermediate', name: issuer.short, issuer: issuedBy(issuer.name), validTo: daysAhead(rng.int(400, 1400)), status: 'valid', algorithm: 'SHA-384' },
      { level: 'Root', name: rootFor(issuer.name), issuer: rootFor(issuer.name), validTo: daysAhead(rng.int(1800, 4000)), status: 'trusted', algorithm: 'SHA-384' },
    ],
    ct: {
      logged: score > 55,
      sctCount: score > 55 ? rng.int(2, 4) : 0,
      logs: score > 55
        ? [
            { name: 'Cloudflare Nimbus 2026', operator: 'Cloudflare', loggedAt: daysAgo(rng.int(5, 40)), status: 'included' },
            { name: 'Google Argon 2026', operator: 'Google', loggedAt: daysAgo(rng.int(5, 40)), status: 'included' },
            { name: 'Sectigo Sabre 2026', operator: 'Sectigo', loggedAt: daysAgo(rng.int(5, 40)), status: 'included' },
          ].slice(0, Math.max(2, rng.int(2, 3)))
        : [],
      lookalikes: rng.chance(0.35) ? rng.int(1, 6) : 0,
    },
    revocation: {
      method: rng.pick(['OCSP + CRL', 'OCSP stapling', 'CRL only']),
      status: score > 60 ? 'good' : 'unknown',
      ocspResponder: `ocsp.${issuer.name.toLowerCase().replace(/[^a-z]/g, '')}.example`,
      checkedAt: new Date().toISOString(),
      mustStaple: score > 80,
    },
    findings: [
      ...(daysRemaining < 21 ? [{ severity: 'high', label: 'Certificate expires soon', detail: `Only ${daysRemaining} days remain. Renewal automation may be broken.` }] : []),
      ...(keySize === 2048 ? [{ severity: 'info', label: 'RSA 2048-bit key', detail: 'Acceptable today; 3072-bit or ECDSA P-256 is preferred for long-lived certificates.' }] : []),
      ...(score > 55
        ? [{ severity: 'low', label: 'CT logging verified', detail: `${score > 55 ? rng.int(2, 4) : 0} signed certificate timestamps found in public logs.` }]
        : [{ severity: 'high', label: 'No CT log entries', detail: 'Unlogged certificates evade monitoring and are typical of disposable infrastructure.' }]),
      ...(curated.grade === 'C'
        ? [{ severity: 'critical', label: 'Weak transport configuration', detail: 'Legacy TLS settings and a domain-validated certificate on a financial brand are a high-risk combination.' }]
        : []),
      { severity: 'info', label: 'Chain order correct', detail: 'Leaf → intermediate → root resolves to a trusted public root store.' },
    ],
  };
}

function issuedBy(name) {
  const map = {
    "Let's Encrypt": 'ISRG Root X1',
    'DigiCert Inc': 'DigiCert Global Root G2',
    'Sectigo Limited': 'USERTrust RSA Certification Authority',
    'GlobalSign nv-sa': 'GlobalSign Root CA',
    ZeroSSL: 'USERTrust RSA Certification Authority',
    'Google Trust Services': 'GTS Root R1',
  };
  return map[name] || 'Public Root CA';
}

function rootFor(name) {
  return issuedBy(name);
}

/* ------------------------------------------------------------------
   Website security assessment
------------------------------------------------------------------ */
const HEADER_BASELINE = [
  { name: 'Strict-Transport-Security', weight: 18, good: 'max-age=63072000; includeSubDomains; preload', risk: 'Protocol downgrade and cookie hijacking become possible.' },
  { name: 'Content-Security-Policy', weight: 20, good: "default-src 'self'; script-src 'self' 'nonce-…'", risk: 'Injected scripts can execute with full page privileges.' },
  { name: 'X-Content-Type-Options', weight: 8, good: 'nosniff', risk: 'Browsers may MIME-sniff responses into executable types.' },
  { name: 'X-Frame-Options', weight: 10, good: 'DENY', risk: 'The site can be framed for clickjacking attacks.' },
  { name: 'Referrer-Policy', weight: 8, good: 'strict-origin-when-cross-origin', risk: 'Full URLs leak to third parties through the Referer header.' },
  { name: 'Permissions-Policy', weight: 10, good: 'camera=(), microphone=(), geolocation=()', risk: 'Powerful browser features remain available to embedded content.' },
  { name: 'Cross-Origin-Opener-Policy', weight: 8, good: 'same-origin', risk: 'Cross-window references enable side-channel attacks.' },
];

export function buildSecurityAssessment(rawDomain) {
  const domain = rawDomain.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  const rng = createRng(`assess:${domain}`);
  const curated = CURATED[domain];
  const baseRisk = curated?.riskScore ?? scoreFromTraits(domain, rng);
  const secure = baseRisk < 35;

  const headers = HEADER_BASELINE.map((header) => {
    const present = secure ? true : rng.chance(0.55 - baseRisk / 400);
    return {
      ...header,
      present,
      value: present ? header.good : null,
      retained: present ? Math.round(header.weight * rng.float(0.8, 1)) : 0,
    };
  });

  const earned = headers.reduce((sum, header) => sum + header.retained, 0);
  const totalWeight = HEADER_BASELINE.reduce((sum, header) => sum + header.weight, 0);
  const headerScore = Math.round((earned / totalWeight) * 100);
  const score = clamp(Math.round(headerScore * 0.62 + (100 - baseRisk) * 0.38), 8, 99);

  const findings = [];
  headers.filter((header) => !header.present).forEach((header) => {
    findings.push({
      id: `hdr-${header.name}`,
      severity: header.weight >= 18 ? 'high' : header.weight >= 10 ? 'medium' : 'low',
      title: `Missing ${header.name}`,
      area: 'Security headers',
      description: `The response does not include the ${header.name} header, so browsers cannot enforce this protection.`,
      impact: header.risk,
      evidence: `GET https://${domain}/ → header absent`,
      recommendation: `Set ${header.name}: ${header.good}`,
    });
  });

  findings.push({
    id: 'tls-version',
    severity: secure ? 'info' : 'medium',
    title: secure ? 'Modern TLS baseline in place' : 'Legacy TLS versions negotiable',
    area: 'Transport',
    description: secure
      ? 'TLS 1.3 is preferred and TLS 1.0/1.1 are refused.'
      : 'The endpoint still accepts TLS 1.0 and 1.1 handshakes alongside modern suites.',
    impact: secure ? 'No action required.' : 'Older clients can be forced into weaker ciphers with known weaknesses.',
    evidence: secure ? 'TLS 1.3 · AEAD cipher suite' : 'TLS 1.0 accepted · CBC cipher suites offered',
    recommendation: secure ? 'Keep the current configuration.' : 'Disable TLS 1.0/1.1 and prefer AEAD cipher suites only.',
  });

  if (!secure) {
    findings.push({
      id: 'panel',
      severity: 'high',
      title: 'Administrative panel reachable publicly',
      area: 'Exposure',
      description: 'A login panel responds with HTTP 200 on a predictable path without network restriction.',
      impact: 'Credential stuffing and brute-force attempts can target the panel directly.',
      evidence: `https://${domain}/admin/login → 200 OK`,
      recommendation: 'Restrict by IP allowlist or SSO, add rate limiting and MFA.',
    });
    findings.push({
      id: 'software',
      severity: 'medium',
      title: 'Outdated JavaScript library detected',
      area: 'Software',
      description: 'A bundled library version is two minor releases behind the current patch level.',
      impact: 'Known prototype-pollution issues may be exploitable through user input.',
      evidence: 'jquery 3.4.1 · latest 3.7.1',
      recommendation: 'Upgrade to the latest patched release and pin dependencies in CI.',
    });
  }

  findings.push({
    id: 'cookies',
    severity: secure ? 'low' : 'medium',
    title: 'Session cookies require hardening',
    area: 'Session',
    description: 'Session cookies are missing one or more of Secure, HttpOnly or SameSite attributes.',
    impact: 'Session tokens become reachable from JavaScript or cross-site requests.',
    evidence: 'Set-Cookie: session=…; Path=/',
    recommendation: 'Issue cookies with Secure; HttpOnly; SameSite=Lax.',
  });

  const severityRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const endpoints = [
    { path: '/admin/login', status: secure ? 403 : 200, label: 'Admin panel', severity: secure ? 'info' : 'high' },
    { path: '/.env', status: 404, label: 'Environment file', severity: 'info' },
    { path: '/api/v1/users', status: secure ? 401 : 200, label: 'User API', severity: secure ? 'info' : 'critical' },
    { path: '/server-status', status: secure ? 404 : 200, label: 'Server status', severity: secure ? 'info' : 'medium' },
    { path: '/backup.zip', status: 404, label: 'Backup archive', severity: 'info' },
  ];

  return {
    domain,
    assessedAt: new Date().toISOString(),
    score,
    grade: score > 90 ? 'A' : score > 80 ? 'B' : score > 65 ? 'C' : score > 45 ? 'D' : 'F',
    headers,
    headerScore,
    https: {
      enforced: secure || rng.chance(0.6),
      hstsPreload: secure,
      redirectsHttp: true,
      mixedContent: !secure && rng.chance(0.5) ? 2 : 0,
    },
    tls: {
      versions: secure ? ['TLS 1.3', 'TLS 1.2'] : ['TLS 1.3', 'TLS 1.2', 'TLS 1.1', 'TLS 1.0'],
      preferred: secure ? 'TLS 1.3' : 'TLS 1.2',
      cipher: secure ? 'TLS_AES_256_GCM_SHA384' : 'ECDHE-RSA-AES128-SHA',
      forwardSecrecy: secure,
      ocspStapling: secure,
    },
    endpoints,
    findings,
    counts: {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
      info: findings.filter((f) => f.severity === 'info').length,
    },
    recommendations: [
      'Deploy a nonce-based Content-Security-Policy and report violations to a collector',
      'Enforce HSTS with preload and a minimum one-year max-age',
      'Remove public exposure of administrative paths',
      'Pin and patch third-party JavaScript dependencies',
      'Add MFA and rate limiting to every authentication surface',
    ],
    latencyMs: rng.int(1200, 2900),
  };
}
