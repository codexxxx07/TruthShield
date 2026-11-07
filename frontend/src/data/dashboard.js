/** Simulated workspace data for the dashboard, scans and activity feeds. */

const now = Date.now();
const hoursAgo = (hours) => new Date(now - hours * 3600000).toISOString();
const daysAgo = (days) => new Date(now - days * 86400000).toISOString();

export const OVERVIEW_STATS = [
  { id: 'scanned', label: 'Total URLs Scanned', value: 18429, delta: 12.4, trend: 'up', hint: 'vs. previous 30 days', spark: [22, 30, 26, 38, 34, 44, 40, 52, 48, 60, 57, 68] },
  { id: 'malicious', label: 'Malicious Websites Detected', value: 742, delta: 8.1, trend: 'up', hint: 'confirmed threats', tone: 'critical', spark: [12, 18, 14, 22, 19, 26, 24, 31, 28, 34, 30, 38] },
  { id: 'suspicious', label: 'Suspicious Websites', value: 1386, delta: -3.6, trend: 'down', hint: 'require review', tone: 'medium', spark: [40, 36, 42, 38, 34, 36, 30, 32, 28, 31, 26, 27] },
  { id: 'safe', label: 'Safe Websites', value: 16301, delta: 13.2, trend: 'up', hint: '88.5% of total', tone: 'safe', spark: [30, 38, 34, 46, 42, 52, 48, 58, 54, 66, 62, 74] },
  { id: 'reported', label: 'Reported Threats', value: 318, delta: 5.4, trend: 'up', hint: 'submitted by your team', tone: 'low', spark: [8, 12, 10, 15, 13, 18, 17, 21, 19, 24, 22, 26] },
];

export const DAILY_DETECTIONS = [
  { day: 'Oct 26', safe: 512, suspicious: 64, malicious: 31 },
  { day: 'Oct 27', safe: 486, suspicious: 58, malicious: 27 },
  { day: 'Oct 28', safe: 604, suspicious: 71, malicious: 38 },
  { day: 'Oct 29', safe: 578, suspicious: 52, malicious: 24 },
  { day: 'Oct 30', safe: 642, suspicious: 66, malicious: 41 },
  { day: 'Oct 31', safe: 521, suspicious: 48, malicious: 22 },
  { day: 'Nov 01', safe: 438, suspicious: 41, malicious: 19 },
  { day: 'Nov 02', safe: 596, suspicious: 63, malicious: 34 },
  { day: 'Nov 03', safe: 671, suspicious: 74, malicious: 46 },
  { day: 'Nov 04', safe: 712, suspicious: 58, malicious: 32 },
  { day: 'Nov 05', safe: 688, suspicious: 61, malicious: 36 },
  { day: 'Nov 06', safe: 734, suspicious: 55, malicious: 29 },
  { day: 'Nov 07', safe: 702, suspicious: 68, malicious: 43 },
  { day: 'Nov 08', safe: 418, suspicious: 34, malicious: 21 },
];

export const THREAT_DISTRIBUTION = [
  { label: 'Phishing', value: 32, color: 'var(--critical)' },
  { label: 'Impersonation', value: 24, color: 'var(--high)' },
  { label: 'Payment fraud', value: 18, color: 'var(--medium)' },
  { label: 'Malware', value: 14, color: 'var(--low)' },
  { label: 'Other', value: 12, color: 'var(--ink-3)' },
];

export const RISK_BREAKDOWN = [
  { label: 'Critical', value: 268, total: 18429, tone: 'critical' },
  { label: 'High', value: 474, total: 18429, tone: 'high' },
  { label: 'Medium', value: 1386, total: 18429, tone: 'medium' },
  { label: 'Low', value: 2412, total: 18429, tone: 'low' },
  { label: 'Clean', value: 13889, total: 18429, tone: 'safe' },
];

export const SCAN_HISTORY = [
  { id: 'TS-9F21C4', target: 'paypal-secure-login.example/session/verify', type: 'URL', verdict: 'malicious', score: 94, findings: 6, scannedAt: hoursAgo(0.4), source: 'Manual scan' },
  { id: 'TS-2A88D1', target: 'sbi-kyc-verify.example/kyc/update-account', type: 'URL', verdict: 'malicious', score: 88, findings: 5, scannedAt: hoursAgo(1.2), source: 'Email gateway' },
  { id: 'TS-77B0E3', target: 'github.com', type: 'URL', verdict: 'safe', score: 6, findings: 0, scannedAt: hoursAgo(2.1), source: 'API' },
  { id: 'TS-4C6A90', target: 'amazon-deals-outlet.example/deal/iphone-17', type: 'URL', verdict: 'suspicious', score: 61, findings: 4, scannedAt: hoursAgo(3.6), source: 'Manual scan' },
  { id: 'TS-1D2F55', target: '192.0.2.87', type: 'IP', verdict: 'malicious', score: 81, findings: 3, scannedAt: hoursAgo(5.2), source: 'Scheduled sweep' },
  { id: 'TS-8E13A7', target: 'careers-google-apply.example', type: 'URL', verdict: 'suspicious', score: 57, findings: 3, scannedAt: hoursAgo(6.8), source: 'API' },
  { id: 'TS-3B7C42', target: 'google.com', type: 'URL', verdict: 'safe', score: 3, findings: 0, scannedAt: hoursAgo(9.4), source: 'Manual scan' },
  { id: 'TS-5F90B8', target: 'netflix-billing-refresh.example', type: 'URL', verdict: 'malicious', score: 79, findings: 4, scannedAt: hoursAgo(11), source: 'Browser extension' },
  { id: 'TS-6A04C9', target: 'microsoft.com', type: 'URL', verdict: 'safe', score: 8, findings: 0, scannedAt: hoursAgo(14), source: 'Scheduled sweep' },
  { id: 'TS-0C55D2', target: 'epfo-claim-status.example', type: 'URL', verdict: 'suspicious', score: 52, findings: 2, scannedAt: hoursAgo(18), source: 'Community report' },
  { id: 'TS-9B24E6', target: 'acmestore.example', type: 'URL', verdict: 'safe', score: 14, findings: 1, scannedAt: hoursAgo(21), source: 'API' },
  { id: 'TS-2E71F0', target: 'crypto-airdrop-claim.example', type: 'URL', verdict: 'malicious', score: 91, findings: 7, scannedAt: hoursAgo(26), source: 'Manual scan' },
  { id: 'TS-7D38A1', target: '198.51.100.19', type: 'IP', verdict: 'malicious', score: 74, findings: 2, scannedAt: hoursAgo(30), source: 'Scheduled sweep' },
  { id: 'TS-4F60B3', target: 'linkedin-jobs-verify.example', type: 'URL', verdict: 'suspicious', score: 49, findings: 2, scannedAt: hoursAgo(34), source: 'Email gateway' },
  { id: 'TS-8C12D4', target: 'wikipedia.org', type: 'URL', verdict: 'safe', score: 1, findings: 0, scannedAt: hoursAgo(38), source: 'API' },
  { id: 'TS-1A93E5', target: 'dhl-parcel-redelivery.example', type: 'URL', verdict: 'suspicious', score: 55, findings: 3, scannedAt: hoursAgo(42), source: 'Community report' },
  { id: 'TS-5B27F6', target: 'apple-id-locked.example', type: 'URL', verdict: 'malicious', score: 86, findings: 5, scannedAt: hoursAgo(48), source: 'Browser extension' },
  { id: 'TS-3C84A7', target: 'stackoverflow.com', type: 'URL', verdict: 'safe', score: 4, findings: 0, scannedAt: hoursAgo(52), source: 'Manual scan' },
  { id: 'TS-6D19B8', target: 'gst-refund-portal.example', type: 'URL', verdict: 'malicious', score: 77, findings: 4, scannedAt: hoursAgo(58), source: 'Email gateway' },
  { id: 'TS-0E52C9', target: 'telegram-premium-gift.example', type: 'URL', verdict: 'suspicious', score: 44, findings: 2, scannedAt: hoursAgo(63), source: 'API' },
  { id: 'TS-9F31D0', target: '203.0.113.42', type: 'IP', verdict: 'suspicious', score: 48, findings: 2, scannedAt: hoursAgo(70), source: 'Scheduled sweep' },
  { id: 'TS-2B70E1', target: 'npmjs.com', type: 'URL', verdict: 'safe', score: 5, findings: 0, scannedAt: hoursAgo(76), source: 'Manual scan' },
  { id: 'TS-7A45F2', target: 'facebook-account-appeal.example', type: 'URL', verdict: 'suspicious', score: 51, findings: 3, scannedAt: hoursAgo(82), source: 'Community report' },
  { id: 'TS-4E68A3', target: 'hdfc-netbanking-update.example', type: 'URL', verdict: 'malicious', score: 89, findings: 6, scannedAt: hoursAgo(90), source: 'Email gateway' },
];

export const RECENT_REPORTS = [
  { id: 'RPT-8841', target: 'sbi-reward-points.example', category: 'Phishing', status: 'under review', submittedAt: hoursAgo(1), reporter: 'You' },
  { id: 'RPT-8838', target: 'kyc-verify-01.example', category: 'Fake Banking Website', status: 'confirmed', submittedAt: hoursAgo(4), reporter: 'sentinel_07' },
  { id: 'RPT-8831', target: 'careers-google-apply.example', category: 'Fake Recruitment Portal', status: 'confirmed', submittedAt: hoursAgo(9), reporter: 'phish_hunter' },
  { id: 'RPT-8827', target: 'upi-cashback-offer.example', category: 'Payment Fraud', status: 'triaged', submittedAt: hoursAgo(15), reporter: 'You' },
  { id: 'RPT-8819', target: 'netflix-billing-refresh.example', category: 'Brand Impersonation', status: 'confirmed', submittedAt: hoursAgo(22), reporter: 'netwatch' },
  { id: 'RPT-8804', target: 'parcel-redelivery-track.example', category: 'Suspicious Redirect', status: 'rejected', submittedAt: hoursAgo(29), reporter: 'cipher_sam' },
];

export const ACTIVITY_FEED = [
  { id: 'a1', actor: 'Automated monitor', action: 'flagged a new lookalike certificate', target: 'paypal-secure-login.example', time: hoursAgo(0.2), kind: 'alert' },
  { id: 'a2', actor: 'You', action: 'submitted a threat report for', target: 'sbi-reward-points.example', time: hoursAgo(1), kind: 'report' },
  { id: 'a3', actor: 'Email gateway', action: 'blocked 14 messages linking to', target: 'sbi-kyc-verify.example', time: hoursAgo(2.4), kind: 'block' },
  { id: 'a4', actor: 'sentinel_07', action: 'confirmed your report on', target: 'upi-cashback-offer.example', time: hoursAgo(5), kind: 'confirm' },
  { id: 'a5', actor: 'Scheduled sweep', action: 'completed 220 scans across', target: '3 domains', time: hoursAgo(8), kind: 'scan' },
  { id: 'a6', actor: 'Automated monitor', action: 'detected a certificate expiring in 18 days for', target: 'acmestore.example', time: hoursAgo(12), kind: 'cert' },
  { id: 'a7', actor: 'You', action: 'added a watchlist entry for', target: 'Acme Bank brand assets', time: hoursAgo(20), kind: 'watch' },
  { id: 'a8', actor: 'API', action: 'pushed scan results for', target: 'careers-google-apply.example', time: daysAgo(1), kind: 'scan' },
];

export const WATCHLIST = [
  { domain: 'acmebank.example', brand: 'Acme Bank', alerts: 3, lookalikes: 12, status: 'protected' },
  { domain: 'acmestore.example', brand: 'Acme Store', alerts: 1, lookalikes: 4, status: 'protected' },
  { domain: 'globalpay.example', brand: 'GlobalPay', alerts: 0, lookalikes: 2, status: 'monitoring' },
];
