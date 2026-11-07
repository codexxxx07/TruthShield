import { createElement } from 'react';
import {
  FiActivity, FiAlertTriangle, FiAward, FiCode, FiCreditCard, FiCrosshair, FiDatabase, FiEye,
  FiEyeOff, FiGitBranch, FiGlobe, FiGrid, FiHash, FiLayers, FiLock, FiSearch, FiServer,
  FiShield, FiSliders, FiTarget, FiType,
} from 'react-icons/fi';

const ICONS = {
  logs: FiDatabase,
  award: FiAward,
  shieldAlert: FiAlertTriangle,
  eye: FiEye,
  type: FiType,
  sliders: FiSliders,
  route: FiGitBranch,
  layers: FiLayers,
  fingerprint: FiTarget,
  hash: FiHash,
  code: FiCode,
  server: FiServer,
  qr: FiGrid,
  scan: FiCrosshair,
  lock: FiLock,
  mask: FiEyeOff,
  globe: FiGlobe,
  card: FiCreditCard,
  search: FiSearch,
  shield: FiShield,
  activity: FiActivity,
};

export function iconFor(name) {
  return ICONS[name] || FiShield;
}

export default function FeatureIcon({ name, className = 'text-[16px]' }) {
  return createElement(iconFor(name), { className, 'aria-hidden': 'true' });
}
