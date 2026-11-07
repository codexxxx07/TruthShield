/** Report-threat form options and community submission feed (simulated). */

export const REPORT_CATEGORIES = [
  { id: 'phishing', label: 'Phishing', description: 'Credential or OTP harvesting page' },
  { id: 'fake-banking', label: 'Fake Banking Website', description: 'Imitation of a bank or payment portal' },
  { id: 'fake-recruitment', label: 'Fake Recruitment Portal', description: 'Job offer or onboarding scam' },
  { id: 'payment-fraud', label: 'Payment Fraud', description: 'Fake checkout, UPI or refund flow' },
  { id: 'brand-impersonation', label: 'Brand Impersonation', description: 'Cloned brand, logo or support channel' },
  { id: 'malware', label: 'Malware', description: 'Malicious download or drive-by payload' },
  { id: 'suspicious-redirect', label: 'Suspicious Redirect', description: 'Unexpected hop to an unrelated site' },
  { id: 'other', label: 'Other', description: 'Anything that does not fit above' },
];

export const REPORT_STATUSES = [
  { id: 'submitted', label: 'Submitted', description: 'Report received and queued', tone: 'low' },
  { id: 'triaged', label: 'Triaged', description: 'Analyst confirmed the submission format', tone: 'medium' },
  { id: 'review', label: 'Under review', description: 'Signals are being validated against feeds', tone: 'high' },
  { id: 'confirmed', label: 'Confirmed', description: 'Threat added to the public indicator set', tone: 'critical' },
];

export const RECENT_COMMUNITY_REPORTS = [
  { id: 'RPT-8841', target: 'sbi-reward-points.example', category: 'Phishing', status: 'review', time: '12 min ago', reporter: 'sentinel_07' },
  { id: 'RPT-8838', target: 'kyc-verify-01.example', category: 'Fake Banking Website', status: 'confirmed', time: '1 hr ago', reporter: 'phish_hunter' },
  { id: 'RPT-8834', target: 'careers-google-apply.example', category: 'Fake Recruitment Portal', status: 'confirmed', time: '3 hrs ago', reporter: 'netwatch' },
  { id: 'RPT-8829', target: 'upi-cashback-offer.example', category: 'Payment Fraud', status: 'triaged', time: '6 hrs ago', reporter: 'cipher_sam' },
  { id: 'RPT-8822', target: 'parcel-redelivery-track.example', category: 'Suspicious Redirect', status: 'submitted', time: '9 hrs ago', reporter: 'anon_report' },
];

export const REPORT_IMPACT = [
  { label: 'Reports triaged in 24h', value: '96%' },
  { label: 'Median confirmation time', value: '3h 20m' },
  { label: 'Indicators published weekly', value: '412' },
];
