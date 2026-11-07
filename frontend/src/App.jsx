import { Route, Routes } from 'react-router-dom';

import SiteLayout from './components/layout/SiteLayout';
import DetectionLayout from './components/layout/DetectionLayout';

import Home from './pages/Home';
import ScanUrl from './pages/ScanUrl';
import SecurityAnalysis from './pages/SecurityAnalysis';
import SslChecker from './pages/SslChecker';
import ThreatIntelligence from './pages/ThreatIntelligence';
import ReportThreat from './pages/ReportThreat';
import Dashboard from './pages/Dashboard';
import AdvancedDetection from './pages/AdvancedDetection';
import About from './pages/About';
import Login from './pages/Login';
import Signup from './pages/Signup';
import NotFound from './pages/NotFound';

import CertificateTransparency from './pages/advanced/CertificateTransparency';
import CaReputation from './pages/advanced/CaReputation';
import CertificateAnomalies from './pages/advanced/CertificateAnomalies';
import VisualSimilarity from './pages/advanced/VisualSimilarity';
import Typosquatting from './pages/advanced/Typosquatting';
import SecurityConfiguration from './pages/advanced/SecurityConfiguration';
import RedirectChain from './pages/advanced/RedirectChain';
import Cloaking from './pages/advanced/Cloaking';
import PhishingKits from './pages/advanced/PhishingKits';
import FaviconLogoHash from './pages/advanced/FaviconLogoHash';
import JavaScriptBehaviour from './pages/advanced/JavaScriptBehaviour';
import HostingFingerprint from './pages/advanced/HostingFingerprint';
import UpiQrChecker from './pages/advanced/UpiQrChecker';

/** Slug → page map keeps the catalogue (data/features.js) and router in sync. */
const DETECTION_ROUTES = {
  'certificate-transparency': CertificateTransparency,
  'ca-reputation': CaReputation,
  'certificate-anomalies': CertificateAnomalies,
  'visual-similarity': VisualSimilarity,
  typosquatting: Typosquatting,
  'security-configuration': SecurityConfiguration,
  'redirect-chain': RedirectChain,
  cloaking: Cloaking,
  'phishing-kits': PhishingKits,
  'favicon-logo-hash': FaviconLogoHash,
  'javascript-behaviour': JavaScriptBehaviour,
  'hosting-fingerprint': HostingFingerprint,
  'upi-qr': UpiQrChecker,
};

export default function App() {
  return (
    <Routes>
      {/* Public marketing + product surface */}
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="scan" element={<ScanUrl />} />
        <Route path="analysis" element={<SecurityAnalysis />} />
        <Route path="ssl-checker" element={<SslChecker />} />
        <Route path="threat-intelligence" element={<ThreatIntelligence />} />
        <Route path="report-threat" element={<ReportThreat />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="about" element={<About />} />

        <Route path="advanced" element={<AdvancedDetection />} />

        {/* Detection workspace: shared sidebar + module outlet */}
        <Route element={<DetectionLayout />}>
          {Object.entries(DETECTION_ROUTES).map(([slug, Page]) => (
            <Route key={slug} path={`advanced/${slug}`} element={<Page />} />
          ))}
        </Route>
      </Route>

      {/* Auth screens use their own split layout */}
      <Route path="login" element={<Login />} />
      <Route path="signup" element={<Signup />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
