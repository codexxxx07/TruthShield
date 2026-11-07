/**
 * Single source of truth for the platform's detection catalogue.
 * Icons are referenced by key and resolved in components/ui/FeatureIcon.jsx
 * so this file stays plain data (easy to serve from an API later).
 */

export const DETECTION_FEATURES = [
  {
    slug: 'certificate-transparency',
    name: 'Certificate Transparency Monitoring',
    short: 'CT log watch',
    description:
      'Stream every certificate issued for your domain from public CT logs and surface lookalike issuances before they are used.',
    category: 'Certificates',
    icon: 'logs',
    tone: 'low',
    input: 'domain',
    capabilities: ['Live CT log ingestion', 'Lookalike issuance alerts', 'Issuance timeline'],
  },
  {
    slug: 'ca-reputation',
    name: 'CA Reputation Score',
    short: 'CA reputation',
    description:
      'Score the certificate authority behind a site using incident history, trust-store coverage and historical misissuance.',
    category: 'Certificates',
    icon: 'award',
    tone: 'medium',
    input: 'domain',
    capabilities: ['Trust-store coverage', 'Incident history', 'Distrust signals'],
  },
  {
    slug: 'certificate-anomalies',
    name: 'Certificate Anomaly Checks',
    short: 'Certificate anomalies',
    description:
      'Detect weak keys, impossible lifetimes, hostname mismatches and missing revocation data in a single pass.',
    category: 'Certificates',
    icon: 'shieldAlert',
    tone: 'high',
    input: 'domain',
    capabilities: ['Weak key detection', 'Lifetime analysis', 'Revocation gaps'],
  },
  {
    slug: 'visual-similarity',
    name: 'Visual Similarity Detection',
    short: 'Visual similarity',
    description:
      'Compare a live page against protected brand templates to expose cloned login screens and pixel-level impersonation.',
    category: 'Brand Integrity',
    icon: 'eye',
    tone: 'high',
    input: 'url',
    capabilities: ['Layout fingerprinting', 'Palette comparison', 'Clone indicators'],
  },
  {
    slug: 'typosquatting',
    name: 'Typosquatting & Homoglyph Detection',
    short: 'Typosquatting',
    description:
      'Generate and score lookalike domains, including Unicode homoglyphs and keyboard-distance variants of your brand.',
    category: 'Brand Integrity',
    icon: 'type',
    tone: 'medium',
    input: 'domain',
    capabilities: ['Edit-distance variants', 'Unicode confusables', 'Registration status'],
  },
  {
    slug: 'security-configuration',
    name: 'Security Configuration Scan',
    short: 'Security configuration',
    description:
      'Audit headers, TLS posture, exposed admin surfaces and software fingerprints against hardened baselines.',
    category: 'Infrastructure',
    icon: 'sliders',
    tone: 'medium',
    input: 'url',
    capabilities: ['Header grading', 'TLS posture', 'Exposed surfaces'],
  },
  {
    slug: 'redirect-chain',
    name: 'Redirect-Chain Tracing',
    short: 'Redirect tracing',
    description:
      'Follow every hop from the first request to the final landing page, including meta-refresh and JavaScript redirects.',
    category: 'Content & Behaviour',
    icon: 'route',
    tone: 'low',
    input: 'url',
    capabilities: ['Full hop timeline', 'Cross-domain handoffs', 'Cloaked destinations'],
  },
  {
    slug: 'cloaking',
    name: 'Cloaking Detection',
    short: 'Cloaking',
    description:
      'Render the same URL as a desktop visitor, a mobile visitor and a search crawler to expose served content differences.',
    category: 'Content & Behaviour',
    icon: 'layers',
    tone: 'high',
    input: 'url',
    capabilities: ['Three-way render', 'Content diffing', 'Crawler detection'],
  },
  {
    slug: 'phishing-kits',
    name: 'Phishing-Kit Fingerprinting',
    short: 'Phishing-kit fingerprint',
    description:
      'Match page structure and bundled assets against known phishing kit families to link a site to an active campaign.',
    category: 'Content & Behaviour',
    icon: 'fingerprint',
    tone: 'critical',
    input: 'url',
    capabilities: ['Kit family matching', 'Shared asset links', 'Campaign clustering'],
  },
  {
    slug: 'favicon-logo-hash',
    name: 'Favicon & Logo Hash Matching',
    short: 'Favicon hashing',
    description:
      'Hash favicons and logo assets, then match them against brand assets to catch impersonation with copied icons.',
    category: 'Brand Integrity',
    icon: 'hash',
    tone: 'medium',
    input: 'url',
    capabilities: ['Favicon extraction', 'Perceptual hashing', 'Ownership mismatch'],
  },
  {
    slug: 'javascript-behaviour',
    name: 'JavaScript Behaviour Analysis',
    short: 'JS behaviour',
    description:
      'Execute page scripts in a sandbox to observe clipboard access, keystroke capture, obfuscation and data exfiltration.',
    category: 'Content & Behaviour',
    icon: 'code',
    tone: 'high',
    input: 'url',
    capabilities: ['Sandbox execution', 'API abuse signals', 'Obfuscation scoring'],
  },
  {
    slug: 'hosting-fingerprint',
    name: 'Hosting Fingerprint',
    short: 'Hosting fingerprint',
    description:
      'Map the ASN, IP neighbourhood and DNS posture behind a domain to find bulletproof hosts and shared abuse infrastructure.',
    category: 'Infrastructure',
    icon: 'server',
    tone: 'low',
    input: 'domain',
    capabilities: ['ASN & geo mapping', 'Neighbourhood risk', 'DNS posture'],
  },
  {
    slug: 'upi-qr',
    name: 'UPI Link & QR Checker',
    short: 'UPI & QR checker',
    description:
      'Decode UPI payment links and QR codes, verify the payee handle and screen it against reported scam accounts.',
    category: 'Payments',
    icon: 'qr',
    tone: 'critical',
    input: 'upi',
    capabilities: ['UPI link decoding', 'QR extraction', 'Scam handle matching'],
  },
];

export const FEATURE_BY_SLUG = Object.fromEntries(DETECTION_FEATURES.map((feature) => [feature.slug, feature]));

export const FEATURE_CATEGORIES = [...new Set(DETECTION_FEATURES.map((feature) => feature.category))];

export const PRIMARY_NAV = [
  { label: 'Home', to: '/' },
  { label: 'Scan URL', to: '/scan' },
  { label: 'Security Analysis', to: '/analysis' },
  { label: 'SSL Checker', to: '/ssl-checker' },
  { label: 'Threat Intelligence', to: '/threat-intelligence' },
  { label: 'Report Threat', to: '/report-threat' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'About', to: '/about' },
];

export const CORE_FEATURES = [
  {
    icon: 'scan',
    title: 'Live URL inspection',
    description: 'Ten parallel checks resolve a URL into a single explainable risk verdict in seconds.',
  },
  {
    icon: 'lock',
    title: 'Certificate intelligence',
    description: 'Chain validation, CT log presence and CA reputation combined into one trust decision.',
  },
  {
    icon: 'mask',
    title: 'Brand protection',
    description: 'Visual, favicon and homoglyph matching catches clones that never touch your domain.',
  },
  {
    icon: 'globe',
    title: 'Infrastructure mapping',
    description: 'ASN, hosting neighbourhood and DNS posture reveal where abuse is being staged.',
  },
  {
    icon: 'code',
    title: 'Behaviour sandbox',
    description: 'Scripts run in an isolated browser to expose keyloggers, clipboard hooks and cloaking.',
  },
  {
    icon: 'card',
    title: 'Payment guard',
    description: 'Decode UPI links and QR codes, then screen payees against community scam reports.',
  },
];

export const SCAN_STAGES = [
  { key: 'resolve', label: 'Resolving DNS', detail: 'A, AAAA and authoritative nameservers' },
  { key: 'tls', label: 'Inspecting TLS', detail: 'Chain of trust, cipher suite and revocation' },
  { key: 'content', label: 'Rendering content', detail: 'DOM, assets and third-party scripts' },
  { key: 'signals', label: 'Extracting signals', detail: 'Headers, forms, redirects and branding' },
  { key: 'intel', label: 'Correlating intelligence', detail: 'Blocklists, CT logs and campaign graph' },
  { key: 'score', label: 'Scoring risk', detail: 'Weighted model with explainable factors' },
];
