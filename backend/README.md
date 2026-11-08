# TruthShield backend

FastAPI, MongoDB and scikit-learn service behind the TruthShield frontend. It scans URLs, domains and UPI payment links with 13 detection modules and combines them into one explainable verdict.

## Run it

Requires Python 3.14 and MongoDB. Without MongoDB the API still starts, on an in-memory database that is erased when it stops.

```bash
# MongoDB: pick one
brew tap mongodb/brew && brew install mongodb-community && brew services start mongodb-community
# or create a free Atlas cluster and put its connection string in .env as MONGO_URI

cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m playwright install chromium
cp .env.example .env    # set JWT_SECRET for anything beyond local use
.venv/bin/uvicorn app.main:app --port 8000
```

Then start the frontend with `npm run dev` in `frontend/`. Vite proxies `/api` to port 8000. If the API is down, the pages fall back to their simulated data and say so.

Check the setup at `GET /api/health`, which reports whether real MongoDB is in use. Interactive docs are at `/docs`.

The demo login is `analyst@truthshield.demo` / `truthshield-demo`. Set `SEED_DEMO_DATA=false` to remove it and the sample threat records.

## Modules

| Module | Slug | How it works |
|---|---|---|
| Certificate Transparency | `certificate-transparency` | Searches issued certificates through Certspotter (crt.sh as fallback). A background worker tails live CT logs and alerts on lookalikes of monitored brands and watchlisted domains. |
| CA reputation | `ca-reputation` | Scores the issuing CA from a curated incident and distrust database, plus its roots in the Mozilla store. |
| Certificate anomalies | `certificate-anomalies` | Real TLS handshake and X.509 parsing: key size, lifetime, hostname match, revocation data, SCTs, signature hash. |
| Visual similarity | `visual-similarity` | Screenshots the page in headless Chromium and compares perceptual hash, edge layout, colour, fonts and form shape with stored brand references. |
| Typosquatting and homoglyphs | `typosquatting` | Generates lookalike domains and resolves them. Detects Unicode, ASCII and misspelt-keyword tricks such as `sbi-onIine.com`. |
| Security configuration | `security-configuration` | Checks headers, legacy TLS, exposed admin and metadata paths, cookies and outdated software. Exposure needs content evidence, so catch-all sites are not flagged. |
| Redirect chain | `redirect-chain` | Follows HTTP, meta-refresh and script redirects, then scores the final landing page. |
| Cloaking | `cloaking` | Compares desktop, mobile and Googlebot views, subtracting the page's natural variation. A bot block is not treated as cloaking. |
| Phishing kits | `phishing-kits` | Matches page structure against kit signatures and earlier flagged pages, tracks shared assets, and groups campaigns with DBSCAN. |
| Favicon and logo hash | `favicon-logo-hash` | MurmurHash and perceptual hash matching against real brand icons, checked against domain ownership. |
| JavaScript behaviour | `javascript-behaviour` | Runtime hooks in a sandboxed browser, static patterns and an obfuscation classifier. Covers keyloggers, clipboard swapping, right-click and devtools blocking, and exfiltration. |
| Hosting fingerprint | `hosting-fingerprint` | DNS, ASN attribution, free hosting, sanctioned hosts, fast flux across resolvers and history, and IPs shared with flagged sites. |
| UPI link and QR | `upi-qr` | Parses `upi://` links and EMV/BharatQR codes, decodes QR images, and flags mismatched names, impersonation, lure wording and reported IDs. |

## Machine learning

- **URL classifier** (`app/ml/`): logistic regression over character n-grams and 30 lexical features, averaged with gradient-boosted trees. Trained on real phishing URLs from OpenPhish and the Phishing.Database project against the Tranco top sites.
- **JavaScript obfuscation classifier**: a random forest over 20 code features. It learns from real libraries, full and minified, and those same files passed through six obfuscation transforms.
- **Campaign clustering**: DBSCAN over hashed page-structure vectors links related scam sites.

`GET /api/ml/models` returns each model's dataset and held-out metrics. Holdouts are split by registrable domain or source file so nothing leaks between train and test. Retrain with `.venv/bin/python -m app.ml.train`.

The final score combines every signal with a noisy-OR in `app/services/scan.py`. The URL model has a noticeable false-positive rate on bare homepages of small sites, so scores between 0.5 and 0.75 count for little and it cannot produce a malicious verdict alone: without a second signal the score is capped at suspicious.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/scan` | Full URL scan: `{url, modules?, fresh?}` |
| GET | `/api/scan/{id}` | Stored report |
| POST | `/api/detect/{slug}` | One module: `{target, fresh?}` |
| POST | `/api/ssl`, `/api/assessment` | SSL report and security assessment: `{target}` |
| POST | `/api/upi/qr`, `/api/upi/report` | QR image upload; report a scam UPI ID |
| POST | `/api/reports` | Submit a threat report (multipart) |
| GET | `/api/threats`, `/api/dashboard` | Threat database and workspace statistics |
| POST | `/api/auth/signup`, `/api/auth/login` | Accounts, returns a JWT |
| GET, POST, DELETE | `/api/watchlist` | Domains for the CT watcher (signed in) |
| GET | `/api/health`, `/api/ml/models` | Status and model metrics |

Results are cached for `CACHE_TTL_SECONDS`; send `fresh: true` to bypass.

## What it cannot do

- **UPI ownership:** there is no public NPCI or bank lookup, so the real account holder, account age and merchant registration are not knowable. Checks use the payment intent, provider handle and community reports.
- **Brand references** come from `scripts/capture_brands.py`, which captured 35 of the 46 brands. Sites with bot protection, such as PayPal and eBay, refuse headless capture and are matched by name and URL only until another source is added.
- **Phishing kit signatures** in `data/kits.json` are a small hand-written starter set. Real coverage needs samples from a kit feed; the system improves as flagged pages accumulate.
- **Reference tables** (`ca_db.json`, `software.json`, `hosting.json`) are curated and need occasional updates.
- **Shared-IP counts** only cover domains TruthShield has itself scanned.

## Running behind a corporate firewall

Firewalls that inspect TLS (FortiGate, Zscaler and similar) replace site certificates and may substitute block pages for known bad sites. TruthShield recognises this, skips the certificate scoring and says so in the report, but certificate-based and page-content results from that network will be incomplete. Use an unfiltered connection for the most complete scans.

## Security notes

Scanning means visiting hostile sites and sending requests to third parties.

- Every outbound connection is validated at connect time against non-public addresses, including redirects and DNS rebinding (`app/net/fetcher.py`).
- Each browser render runs in a separate process that is killed at a hard deadline.
- Before exposing this publicly, run the scanner on an isolated network, put it behind real rate limiting and only probe sites you are permitted to test. The security configuration module requests paths such as `/admin/` and `/.env`, and the hosting module connects to ports 22 and 3306.

## Tests

`.venv/bin/python -m pytest tests -q` checks API output against the shape the React pages expect (`tests/fixtures/contract.json`), plus SSRF blocks, authentication and the UPI flow. Set `LIVE_TARGET=off` to skip tests that need internet access.
