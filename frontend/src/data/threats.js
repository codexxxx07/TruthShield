/** Simulated threat intelligence corpus. Clearly demo data — no live feed. */

export const THREAT_CATEGORIES = [
  { id: 'phishing', label: 'Phishing', count: 4128 },
  { id: 'fake-banking', label: 'Fake Banking Website', count: 1864 },
  { id: 'fake-recruitment', label: 'Fake Recruitment Portal', count: 742 },
  { id: 'payment-fraud', label: 'Payment Fraud', count: 1290 },
  { id: 'brand-impersonation', label: 'Brand Impersonation', count: 2314 },
  { id: 'malware', label: 'Malware', count: 968 },
  { id: 'suspicious-redirect', label: 'Suspicious Redirect', count: 1187 },
  { id: 'other', label: 'Other', count: 412 },
];

export const THREAT_STATS = {
  totalIndicators: 12895,
  activeCampaigns: 47,
  takedowns7d: 183,
  reporters: 12480,
  new24h: 312,
};

const RAW = [
  ['paypal-secure-login.example', 'url', 'Brand Impersonation', 'critical', 'active', 38, 'RU', ['credential-harvest', 'payment-brand']],
  ['sbi-kyc-verify.example', 'domain', 'Fake Banking Website', 'critical', 'active', 26, 'IN', ['kyc', 'otp-theft']],
  ['amazon-deals-outlet.example', 'url', 'Payment Fraud', 'high', 'active', 19, 'US', ['fake-store', 'upi-collect']],
  ['hdfc-netbanking-update.example', 'domain', 'Fake Banking Website', 'critical', 'takedown', 44, 'IN', ['netbanking', 'credential-harvest']],
  ['careers-google-apply.example', 'url', 'Fake Recruitment Portal', 'high', 'active', 12, 'NG', ['job-lure', 'documents']],
  ['icloud-find-my-device.example', 'domain', 'Phishing', 'critical', 'active', 31, 'PA', ['icloud', 'sms-lure']],
  ['sbi-reward-points.example', 'url', 'Phishing', 'medium', 'monitoring', 8, 'IN', ['rewards', 'upi']],
  ['netflix-billing-refresh.example', 'domain', 'Brand Impersonation', 'high', 'active', 22, 'NL', ['subscription-lure']],
  ['192.0.2.87', 'ip', 'Malware', 'critical', 'active', 57, 'RU', ['c2', 'loader']],
  ['203.0.113.42', 'ip', 'Suspicious Redirect', 'medium', 'monitoring', 6, 'RO', ['traffic-distribution']],
  ['irctc-tatkal-helper.example', 'url', 'Payment Fraud', 'high', 'active', 17, 'IN', ['booking-lure', 'upi-collect']],
  ['linkedin-jobs-verify.example', 'domain', 'Fake Recruitment Portal', 'medium', 'monitoring', 9, 'LT', ['job-lure']],
  ['whatsapp-gold-badge.example', 'url', 'Phishing', 'medium', 'active', 14, 'SG', ['messaging-lure']],
  ['apple-id-locked.example', 'domain', 'Brand Impersonation', 'critical', 'takedown', 68, 'US', ['apple-id', 'credential-harvest']],
  ['epfo-claim-status.example', 'url', 'Phishing', 'high', 'active', 11, 'IN', ['pf-claim', 'documents']],
  ['crypto-airdrop-claim.example', 'domain', 'Payment Fraud', 'critical', 'active', 29, 'CY', ['wallet-drainer']],
  ['microsoft-teams-invite.example', 'url', 'Phishing', 'high', 'active', 21, 'DE', ['teams-lure', 'oauth-consent']],
  ['198.51.100.19', 'ip', 'Malware', 'high', 'monitoring', 13, 'BR', ['staging']],
  ['bank-of-india-kyc.example', 'domain', 'Fake Banking Website', 'critical', 'active', 34, 'IN', ['kyc', 'otp-theft']],
  ['flipkart-big-billion.example', 'url', 'Payment Fraud', 'high', 'active', 16, 'IN', ['sale-lure']],
  ['dhl-parcel-redelivery.example', 'domain', 'Phishing', 'medium', 'monitoring', 7, 'PA', ['delivery-lure']],
  ['gst-refund-portal.example', 'url', 'Phishing', 'high', 'takedown', 25, 'IN', ['tax-lure']],
  ['secure-chase-verify.example', 'domain', 'Fake Banking Website', 'critical', 'active', 41, 'US', ['credential-harvest']],
  ['telegram-premium-gift.example', 'url', 'Suspicious Redirect', 'low', 'monitoring', 4, 'LV', ['redirect-chain']],
  ['adobe-license-renewal.example', 'domain', 'Brand Impersonation', 'medium', 'active', 10, 'GB', ['software-lure']],
  ['gov-subsidy-register.example', 'url', 'Other', 'high', 'active', 18, 'IN', ['subsidy-lure', 'documents']],
  ['binance-withdrawal-help.example', 'domain', 'Payment Fraud', 'critical', 'active', 23, 'SG', ['exchange-lure']],
  ['facebook-account-appeal.example', 'url', 'Phishing', 'medium', 'monitoring', 6, 'US', ['social-lure']],
];

const now = Date.now();
const iso = (days, hours = 0) => new Date(now - days * 86400000 - hours * 3600000).toISOString();

export const THREAT_RECORDS = RAW.map(([indicator, type, category, severity, status, reports, country, tags], index) => ({
  id: `TI-${(4820 + index * 37).toString()}`,
  indicator,
  type,
  category,
  severity,
  status,
  reports,
  country,
  tags,
  firstSeen: iso(30 + (index % 22) * 9, index % 12),
  lastSeen: iso(index % 5, index % 20),
  confidence: 62 + ((index * 13) % 36),
  source: index % 3 === 0 ? 'Community report' : index % 3 === 1 ? 'Automated crawl' : 'Partner feed',
}));

export const THREAT_ACTIVITY_14D = Array.from({ length: 14 }, (_, i) => {
  const base = 210 + ((i * 37) % 150);
  return {
    date: new Date(now - (13 - i) * 86400000).toISOString(),
    phishing: base + ((i * 11) % 40),
    malware: Math.round(base * 0.28) + ((i * 7) % 18),
    impersonation: Math.round(base * 0.44) + ((i * 5) % 24),
  };
});

export const EMERGING_CAMPAIGNS = [
  { name: 'KYC-Shield v3', category: 'Fake Banking', growth: 64, hosts: 38, status: 'surging', region: 'IN' },
  { name: 'Parcel-Redelivery', category: 'Phishing', growth: 31, hosts: 22, status: 'rising', region: 'EU' },
  { name: 'OAuth-Consent-Abuse', category: 'Credential theft', growth: 27, hosts: 19, status: 'rising', region: 'US' },
  { name: 'Wallet-Drainer-JS', category: 'Payment Fraud', growth: -12, hosts: 14, status: 'declining', region: 'APAC' },
];

export const REPORTER_LEADERBOARD = [
  { alias: 'sentinel_07', reports: 412, accuracy: 96, badge: 'Platinum' },
  { alias: 'phish_hunter', reports: 388, accuracy: 94, badge: 'Gold' },
  { alias: 'netwatch', reports: 271, accuracy: 91, badge: 'Gold' },
  { alias: 'cipher_sam', reports: 196, accuracy: 89, badge: 'Silver' },
];
