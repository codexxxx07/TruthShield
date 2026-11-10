# TruthShield

**Trust nothing. Verify everything.**

TruthShield is a website trust and threat-intelligence platform. It inspects any link across
certificates, hosting, content and behaviour, then returns a single, **explainable** risk
verdict an analyst can act on before anyone clicks.

> This repository currently ships a **complete, frontend-only product** built on a deterministic
> simulated data layer. No live scanner or backend is connected — every result is generated
> locally and clearly labelled as demo data. The result shapes are designed to be swapped for
> real API responses without touching a single page component.

---

## Table of contents

- [Highlights](#highlights)
- [Core tools](#core-tools)
- [Detection modules](#detection-modules)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Routes](#routes)
- [Getting started](#getting-started)
- [How the simulation works](#how-the-simulation-works)
- [Design system](#design-system)
- [Accessibility](#accessibility)
- [Roadmap](#roadmap)
- [Disclaimer](#disclaimer)

---

## Highlights

- **13 detection modules** covering certificates, brand integrity, infrastructure, content
  behaviour and payments.
- **Explainable risk scoring** — every verdict decomposes into weighted, timestamped factors with
  sources and confidence, not a black-box number.
- **Single scan surface** — a URL, domain or UPI handle resolves into one combined report spanning
  DNS, TLS, headers, redirects, content and reputation.
- **Analyst dashboard** — SOC-style overview with stats, detection timelines, threat distribution
  and a report queue (all simulated).
- **Community threat reporting** — a submission flow with categories, statuses and a live-style feed.
- **Frontend-only demo auth** with themed login/signup screens (no credentials leave the browser).
- **Light & dark themes** with dark as the primary operational mode, persisted to `localStorage`.
- **Custom SVG visualisations** — no charting dependency.

---

## Core tools

| Tool | Route | What it does |
| --- | --- | --- |
| URL Scanner | `/scan` | Runs ten parallel checks and resolves a URL into one risk verdict. |
| Security Analysis | `/analysis` | Deep dive on headers, TLS posture and exposed surfaces. |
| SSL Checker | `/ssl-checker` | Chain validation, CT-log presence and CA reputation for a domain. |
| Threat Intelligence | `/threat-intelligence` | Category browse + stats over the simulated indicator corpus. |
| Report Threat | `/report-threat` | Submit a phishing/fraud site to the community queue. |
| Dashboard | `/dashboard` | SOC-style overview: stats, timelines, distribution, queue. |
| Advanced Detection | `/advanced` | Catalogue of all 13 detection modules. |

---

## Detection modules

Each module lives under `/advanced/:slug` inside a shared detection workspace (sidebar + module
outlet) and is driven by a dedicated simulated engine builder.

| Category | Module | Slug |
| --- | --- | --- |
| Certificates | Certificate Transparency Monitoring | `certificate-transparency` |
| Certificates | CA Reputation Score | `ca-reputation` |
| Certificates | Certificate Anomaly Checks | `certificate-anomalies` |
| Brand Integrity | Visual Similarity Detection | `visual-similarity` |
| Brand Integrity | Typosquatting & Homoglyph Detection | `typosquatting` |
| Brand Integrity | Favicon & Logo Hash Matching | `favicon-logo-hash` |
| Infrastructure | Security Configuration Scan | `security-configuration` |
| Infrastructure | Hosting Fingerprint | `hosting-fingerprint` |
| Content & Behaviour | Redirect-Chain Tracing | `redirect-chain` |
| Content & Behaviour | Cloaking Detection | `cloaking` |
| Content & Behaviour | Phishing-Kit Fingerprinting | `phishing-kits` |
| Content & Behaviour | JavaScript Behaviour Analysis | `javascript-behaviour` |
| Payments | UPI Link & QR Checker | `upi-qr` |

The catalogue is defined once in
[`src/data/features.js`](frontend/src/data/features.js) and consumed by the router, the sidebar
navigation, the footer and the marketing pages, so adding a module means adding one entry plus its
page.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| UI | React 19 (function components, hooks, context) |
| Build | Vite 8 (`@vitejs/plugin-react`) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` (no CDN, no runtime JIT) |
| Routing | React Router 7 (nested layouts) |
| Icons | `react-icons` (Feather set) |
| Charts | Hand-built SVG components (no dependency) |
| Data | Deterministic seeded mock layer (no backend) |
| Lint | ESLint 9 + `eslint-plugin-react` / `react-hooks` / `react-refresh` |

---

## Project structure

```
TruthShield/
├─ frontend/
│  ├─ index.html                 # HTML shell + pre-paint theme script
│  ├─ vite.config.js             # React + Tailwind v4 plugins
│  ├─ eslint.config.js
│  ├─ package.json
│  ├─ public/                    # favicon.svg, icons.svg
│  └─ src/
│     ├─ main.jsx                # Providers: Router → Theme → Auth → Toast
│     ├─ App.jsx                 # Route table (marketing, auth, detection)
│     ├─ index.css               # Design tokens + style imports
│     ├─ components/
│     │  ├─ layout/              # Site, Auth & Detection layouts, Navbar, Footer…
│     │  ├─ detection/           # DetectionWorkbench (shared module shell)
│     │  └─ ui/                  # Buttons, Cards, Charts, Tables, Terminal, …
│     ├─ context/                # AuthContext, ThemeContext, ToastContext
│     ├─ data/                   # features, dashboard, threats, reports (catalogue + demo data)
│     ├─ hooks/                  # useCountUp
│     ├─ lib/
│     │  ├─ mockEngine.js        # Simulated scan / SSL / security-assessment engine
│     │  ├─ detectionEngine.js   # One simulated builder per advanced module
│     │  ├─ validation.js        # URL / domain / email / UPI input parsing
│     │  └─ utils.js             # Seeded RNG, hashing, formatting, storage helpers
│     ├─ pages/
│     │  ├─ Home, ScanUrl, SecurityAnalysis, SslChecker, ThreatIntelligence,
│     │  │  ReportThreat, Dashboard, AdvancedDetection, About, Login, Signup, NotFound
│     │  └─ advanced/            # 13 detection module pages
│     └─ styles/                 # base.css, components.css, animations.css
└─ .freebuff/                    # tooling metadata
```

---

## Routes

**Public / product surface** (rendered inside `SiteLayout`)

`/` · `/scan` · `/analysis` · `/ssl-checker` · `/threat-intelligence` · `/report-threat` ·
`/dashboard` · `/about` · `/advanced` · `/advanced/:slug` (13 modules, inside `DetectionLayout`)

**Auth** (own split layout)

`/login` · `/signup`

**Fallback**

`*` → not-found page

---

## Getting started

**Requirements:** Node.js 18+ and npm.

```bash
cd frontend
npm install
```

Run the dev server:

```bash
npm run dev
```

Other scripts:

```bash
npm run build     # production build → dist/
npm run preview   # preview the production build
npm run lint      # run ESLint
```

---

## How the simulation works

There is no backend yet, so results are **generated locally and deterministically**:

- [`lib/utils.js`](frontend/src/lib/utils.js) provides an **FNV-1a hash** plus a **mulberry32**
  seeded PRNG. Seeding on the target (`${slug}:${target}`) means the *same input always yields the
  same output* — useful for demos, screenshots and tests.
- [`lib/mockEngine.js`](frontend/src/lib/mockEngine.js) builds the main scan report, the SSL/certificate
  report and the website security assessment. A small curated set (e.g. `google.com`,
  `sbi-kyc-verify.example`) returns hand-written, high-fidelity results; everything else is derived
  from domain traits (lure keywords, risky TLDs, hyphens, digits, subdomains).
- [`lib/detectionEngine.js`](frontend/src/lib/detectionEngine.js) holds **one builder per advanced
  module**, each returning a feature-specific shape.

**Swapping in a real API:** both engines export plain functions (`buildScanReport`, `buildSslReport`,
`buildSecurityAssessment`, `runDetection`) whose return contracts are the page-level data shapes.
Replace their bodies with `fetch` calls and no page component needs to change.

Every simulated surface is labelled in the UI (demo badges, "simulated output" notices) so demo
data is never mistaken for live telemetry.

---

## Design system

The visual identity is defined once in
[`src/index.css`](frontend/src/index.css) as semantic tokens (`--bg`, `--surface`, `--line`,
`--ink`, `--critical`, `--brand`, …). Components reference **intent** rather than raw colours, so
light/dark theming and rebranding are centralised.

- **Fonts:** Chakra Petch (display), Inter (body), JetBrains Mono (code/telemetry).
- **Theming:** `ThemeContext` toggles the `dark` class and persists to `localStorage`; a small
  inline script in [`index.html`](frontend/index.html) applies the stored theme **before first
  paint** to avoid a flash.
- **Effects:** aurora gradients, grid/circuit backdrops, HUD corners and neon accents live in
  `styles/animations.css` and `styles/components.css`.

---

## Accessibility

- Semantic landmarks and labelled navigation (`aria-label`, `aria-current`).
- Live regions (`aria-live`) for scan progress and results.
- Keyboard-accessible controls, visible focus rings, and `aria-invalid` on invalid inputs.
- Responsive from mobile up, with a dedicated mobile module switcher in the detection workspace.

---

## Roadmap

| Phase | Status | Focus |
| --- | --- | --- |
| Now | Shipped | Complete frontend workspace — all routes, 13 modules and report flows on simulated data. |
| Next | Planned | Live scanning API — server-side collectors for DNS, TLS, headers and rendering behind the same result contracts. |
| Later | Exploring | Team intelligence graph — shared campaign clustering, RBAC, audit log and takedown automation. |

---

## Disclaimer

TruthShield is a **demonstration** application. All scans, reports, statistics, threat feeds, host
records and payment data are **simulated and illustrative** — they are not live telemetry and must
not be used for real security decisions. Authentication is a frontend-only mock; no credentials
ever leave the browser. Real credential verification, MFA, session tokens and scanning logic belong
on a server.
