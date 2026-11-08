"""Modules 6–8: security configuration scan, redirect-chain tracing, cloaking detection."""
import hashlib
import re
import secrets
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import parse_qs, urljoin, urlsplit

from bs4 import BeautifulSoup

from ..ml.model import score_url
from ..net import redirects as redirect_net, tlsinfo
from ..net.fetcher import CRAWLER_UA, DESKTOP_UA, MOBILE_UA, fetch
from ..util import clamp, load_json, now_iso, registrable
from .common import base, findings_sorted, indicator, signal

HEADER_BASELINE = [
    {"name": "Strict-Transport-Security", "weight": 18, "good": "max-age=63072000; includeSubDomains; preload", "risk": "Protocol downgrade and cookie hijacking become possible."},
    {"name": "Content-Security-Policy", "weight": 20, "good": "default-src 'self'; script-src 'self' 'nonce-…'", "risk": "Injected scripts can execute with full page privileges."},
    {"name": "X-Content-Type-Options", "weight": 8, "good": "nosniff", "risk": "Browsers may MIME-sniff responses into executable types."},
    {"name": "X-Frame-Options", "weight": 10, "good": "DENY", "risk": "The site can be framed for clickjacking attacks."},
    {"name": "Referrer-Policy", "weight": 8, "good": "strict-origin-when-cross-origin", "risk": "Full URLs leak to third parties through the Referer header."},
    {"name": "Permissions-Policy", "weight": 10, "good": "camera=(), microphone=(), geolocation=()", "risk": "Powerful browser features remain available to embedded content."},
    {"name": "Cross-Origin-Opener-Policy", "weight": 8, "good": "same-origin", "risk": "Cross-window references enable side-channel attacks."},
]
# Each probe needs content evidence, so a site that answers 200 to every path is not flagged.
PROBES = [
    {"path": "/admin/", "label": "Admin console", "kind": "panel", "severity": "high"},
    {"path": "/wp-admin/", "label": "WordPress admin", "kind": "panel", "severity": "medium"},
    {"path": "/phpmyadmin/", "label": "phpMyAdmin", "kind": "panel", "severity": "high"},
    {"path": "/.git/config", "label": "Git metadata", "kind": "marker", "marker": r"\[core\]|repositoryformatversion", "severity": "critical"},
    {"path": "/.env", "label": "Environment file", "kind": "marker", "marker": r"(?m)^(APP_KEY|DB_PASSWORD|DATABASE_URL|SECRET_KEY|AWS_[A-Z_]+)\s*=", "severity": "critical"},
    {"path": "/phpinfo.php", "label": "PHP info", "kind": "marker", "marker": r"phpinfo\(\)|PHP Version", "severity": "high"},
    {"path": "/server-status", "label": "Server status", "kind": "marker", "marker": r"Apache Server Status", "severity": "medium"},
]
SOFTWARE = load_json("software.json")
LIBRARY_PATTERNS = {
    "jquery": r"jquery[-.]?(\d+\.\d+(?:\.\d+)?)(?:\.min)?\.js",
    "bootstrap": r"bootstrap[-.@/]+(\d+\.\d+(?:\.\d+)?)",
    "angularjs": r"angular(?:js)?[-.@/]+(\d+\.\d+(?:\.\d+)?)",
    "moment": r"moment[-.@/]+(\d+\.\d+(?:\.\d+)?)",
    "lodash": r"lodash[-.@/]+(\d+\.\d+(?:\.\d+)?)",
    "vue": r"vue[-.@/]+(\d+\.\d+(?:\.\d+)?)",
    "react": r"react(?:-dom)?[-.@/]+(\d+\.\d+(?:\.\d+)?)",
}
SHORTENERS = set(load_json("hosting.json")["url_shorteners"])


def _version_tuple(version: str) -> tuple:
    return tuple(int(part) for part in re.findall(r"\d+", version)[:3])


def _software_row(name: str, version: str, category: str) -> dict | None:
    floor = SOFTWARE[category].get(name)
    if not floor:
        return None
    return {"name": name, "version": version, "current": f"{floor}+", "status": "outdated" if _version_tuple(version) < _version_tuple(floor) else "current"}


def _detect_software(ctx, response) -> list[dict]:
    rows = []
    header_text = " ".join(filter(None, (response.headers.get("server"), response.headers.get("x-powered-by"))))
    for match in re.finditer(r"(nginx|apache|php|openresty|litespeed|openssl|express|tomcat)[/ ]v?(\d+(?:\.\d+)+)", header_text, re.I):
        rows.append(_software_row(match.group(1).lower(), match.group(2), "server"))
    iis = re.search(r"Microsoft-IIS/(\d+\.\d+)", header_text)
    if iis:
        rows.append(_software_row("iis", iis.group(1), "server"))
    generator = ctx.soup.find("meta", attrs={"name": re.compile("generator", re.I)})
    if generator and generator.get("content"):
        match = re.search(r"(wordpress|drupal|joomla)[!\s]*(\d+(?:\.\d+)*)", generator["content"], re.I)
        if match:
            rows.append(_software_row(match.group(1).lower(), match.group(2), "cms"))
    script_urls = " ".join(tag.get("src", "") for tag in ctx.soup.find_all("script"))
    for name, pattern in LIBRARY_PATTERNS.items():
        match = re.search(pattern, script_urls, re.I)
        if match:
            rows.append(_software_row(name, match.group(1), "library"))
    return [row for row in rows if row]


def _soft_404_signature(ctx) -> str | None:
    probe = fetch(urljoin(ctx.final_url, f"/{secrets.token_hex(8)}"))
    if probe.ok and probe.status == 200:
        return hashlib.sha256(re.sub(rb"\s+", b"", probe.body)).hexdigest()
    return None


def _probe_paths(ctx) -> list[dict]:
    signature = ctx.once("soft404", lambda: _soft_404_signature(ctx))

    def run(probe: dict) -> dict:
        response = fetch(urljoin(ctx.final_url, probe["path"]), max_bytes=128 * 1024)
        status = response.status if response.ok else 0
        exposed = False
        if status == 200 and hashlib.sha256(re.sub(rb"\s+", b"", response.body)).hexdigest() != signature:
            if probe["kind"] == "marker":
                exposed = bool(re.search(probe["marker"], response.text))
            else:
                exposed = bool(re.search(r"type=[\"']?password", response.text, re.I))
        return {"path": probe["path"], "status": status, "label": probe["label"], "severity": probe["severity"] if exposed else "info", "exposed": exposed}

    with ThreadPoolExecutor(max_workers=7) as pool:
        return list(pool.map(run, PROBES))


def _grade(score: float) -> str:
    return "A" if score > 90 else "B" if score > 80 else "C" if score > 65 else "D" if score > 45 else "F"


def security_assessment(ctx) -> dict:
    """Full posture report. Backs both the Security Analysis page and module 6."""
    def compute():
        response = ctx.response
        tls = ctx.tls
        started = now_iso()
        versions = tlsinfo.probe_versions(ctx.host) if tls.get("reachable") else []
        if response is None:
            header_rows = [{**item, "present": False, "value": None, "retained": 0} for item in HEADER_BASELINE]
            return {
                "reachable": False, "headers": header_rows, "versions": versions, "exposed": [], "software": [], "misconfigs": [], "cookies": [],
                "mixed": 0, "https": False, "redirects_http": False, "started": started,
            }
        header_rows = []
        for item in HEADER_BASELINE:
            value = response.headers.get(item["name"].lower())
            header_rows.append({**item, "present": value is not None, "value": value[:200] if value else None, "retained": item["weight"] if value else 0})
        is_https = ctx.final_url.startswith("https:")
        redirects_http = False
        if is_https:
            plain = fetch(f"http://{ctx.host}/", timeout=5)
            redirects_http = plain.ok and 300 <= plain.status < 400 and plain.headers.get("location", "").startswith("https:")
        mixed = len(re.findall(r"<(?:script|iframe|link)[^>]+(?:src|href)=[\"']http://", ctx.html, re.I)) if is_https else 0
        cookies = []
        for cookie in response.set_cookies[:12]:
            lowered = cookie.lower()
            missing = [flag for flag, token in (("Secure", "; secure"), ("HttpOnly", "; httponly"), ("SameSite", "samesite=")) if token not in lowered]
            if missing:
                cookies.append({"name": cookie.split("=")[0], "missing": missing})
        exposed = _probe_paths(ctx)
        software = _detect_software(ctx, response)
        misconfigs = []
        if mixed:
            misconfigs.append({"severity": "high", "title": "Mixed content", "detail": f"{mixed} resources load over plain HTTP on an HTTPS page."})
        if response.headers.get("server") and re.search(r"\d", response.headers["server"]):
            misconfigs.append({"severity": "low", "title": "Server version disclosure", "detail": f"The Server header advertises {response.headers['server'][:60]}."})
        if response.headers.get("x-powered-by"):
            misconfigs.append({"severity": "low", "title": "Framework disclosure", "detail": f"X-Powered-By advertises {response.headers['x-powered-by'][:60]}."})
        if "content-security-policy-report-only" in response.headers and "content-security-policy" not in response.headers:
            misconfigs.append({"severity": "info", "title": "CSP report-only mode", "detail": "Content-Security-Policy is present but not enforced."})
        if re.search(r"<title>\s*Index of /", ctx.html, re.I):
            misconfigs.append({"severity": "medium", "title": "Directory listing enabled", "detail": "The server returns a browsable file index."})
        if not is_https:
            misconfigs.append({"severity": "high", "title": "No HTTPS on the landing page", "detail": "The page is served over unencrypted HTTP."})
        return {
            "reachable": True, "headers": header_rows, "versions": versions, "exposed": exposed, "software": software, "misconfigs": misconfigs, "cookies": cookies,
            "mixed": mixed, "https": is_https, "redirects_http": redirects_http, "started": started,
        }

    return ctx.once("assessment", compute)


def _posture_score(ctx, data) -> tuple[int, int]:
    total = sum(item["weight"] for item in HEADER_BASELINE)
    earned = sum(item["retained"] for item in data["headers"])
    header_score = round(earned / total * 100)
    tls = ctx.tls
    score = header_score * 0.55
    score += 25 if data["https"] and tls.get("reachable") and tls["valid"] else 0
    legacy = {"TLS 1.0", "TLS 1.1"} & set(data["versions"])
    score += 0 if legacy else 10
    score += 10 if not any(item["exposed"] for item in data["exposed"]) else 0
    score -= sum(row["status"] == "outdated" for row in data["software"]) * 4
    return int(clamp(score, 0, 99)), header_score


def _tls_block(ctx, data) -> dict:
    tls = ctx.tls
    return {
        "versions": data["versions"] or ([tls["protocol"]] if tls.get("reachable") else []),
        "preferred": tls.get("protocol") or "None",
        "cipher": tls.get("cipher") or "None",
        "forwardSecrecy": bool(tls.get("forward_secrecy")),
        "ocspStapling": False,
    }


def _recommendations(data) -> list[str]:
    tips = []
    missing = [item["name"] for item in data["headers"] if not item["present"]]
    if "Content-Security-Policy" in missing:
        tips.append("Deploy a nonce-based Content-Security-Policy and report violations to a collector")
    if "Strict-Transport-Security" in missing:
        tips.append("Enforce HSTS with preload and a minimum one-year max-age")
    if {"TLS 1.0", "TLS 1.1"} & set(data["versions"]):
        tips.append("Disable TLS 1.0 and 1.1 and prefer AEAD cipher suites")
    if any(item["exposed"] for item in data["exposed"]):
        tips.append("Remove public exposure of administrative and metadata paths")
    if any(row["status"] == "outdated" for row in data["software"]):
        tips.append("Upgrade outdated server and JavaScript components and pin dependencies")
    if data["cookies"]:
        tips.append("Issue cookies with Secure, HttpOnly and SameSite attributes")
    return tips or ["Keep the current configuration and re-check after each deployment"]


def security_configuration(ctx) -> dict:
    data = security_assessment(ctx)
    result = base(ctx, ctx.host)
    if not data["reachable"]:
        ctx.note("The site could not be reached, so response headers and exposed paths were not checked.")
    score, _ = _posture_score(ctx, data) if data["reachable"] else (0, 0)
    exposed_count = sum(item["exposed"] for item in data["exposed"])
    present = sum(item["present"] for item in data["headers"])
    result.update({
        "score": score,
        "grade": _grade(score) if data["reachable"] else "N/A",
        "summary": (f"{present} of {len(data['headers'])} baseline headers are present. {exposed_count} exposed surface{'s' if exposed_count != 1 else ''} require attention."
                    if data["reachable"] else f"{ctx.host} could not be reached, so its configuration was not assessed."),
        "headers": [{key: item[key] for key in ("name", "present", "value", "risk")} for item in data["headers"]],
        "tls": _tls_block(ctx, data),
        "exposed": [{key: item[key] for key in ("path", "status", "label", "severity")} for item in data["exposed"]],
        "software": data["software"],
        "misconfigs": findings_sorted(data["misconfigs"]),
        "recommendations": _recommendations(data),
    })
    indicators = []
    for item in data["exposed"]:
        if item["exposed"]:
            indicators.append(indicator(f"exposed-{item['path']}", item["severity"], f"Exposed: {item['label']}", "A sensitive path is publicly reachable.", item["path"]))
    if data["reachable"] and not data["https"]:
        indicators.append(indicator("no-https", "medium", "Page served without HTTPS", "Data entered on this page travels unencrypted.", ctx.final_url))
    if {"TLS 1.0", "TLS 1.1"} & set(data["versions"]):
        indicators.append(indicator("old-tls", "low", "Legacy TLS accepted", "The server still accepts TLS 1.0 or 1.1.", ", ".join(data["versions"])))
    missing = len(data["headers"]) - present
    positives = []
    if data["reachable"] and present >= 4:
        positives.append(f"{present} of {len(data['headers'])} security headers are present")
    risk = sum(30 for item in data["exposed"] if item["exposed"]) + (30 if data["reachable"] and not data["https"] else 0) + missing * 2
    result["_signal"] = signal(risk, "infrastructure", indicators, positives, evaluated=data["reachable"])
    return result


def security_report(ctx) -> dict:
    """Payload for the Security Analysis page."""
    data = security_assessment(ctx)
    tls = ctx.tls
    findings = []
    for item in data["headers"]:
        if not item["present"]:
            severity = "high" if item["weight"] >= 18 else "medium" if item["weight"] >= 10 else "low"
            findings.append({
                "id": f"hdr-{item['name']}", "severity": severity, "title": f"Missing {item['name']}", "area": "Security headers",
                "description": f"The response does not include the {item['name']} header, so browsers cannot enforce this protection.",
                "impact": item["risk"], "evidence": f"GET {ctx.final_url} → header absent", "recommendation": f"Set {item['name']}: {item['good']}",
            })
    legacy = sorted({"TLS 1.0", "TLS 1.1"} & set(data["versions"]))
    if tls.get("reachable"):
        findings.append({
            "id": "tls-version", "severity": "medium" if legacy else "info", "title": "Legacy TLS versions negotiable" if legacy else "Modern TLS baseline in place", "area": "Transport",
            "description": f"The endpoint accepts {', '.join(legacy)} alongside modern versions." if legacy else "TLS 1.0 and 1.1 are refused.",
            "impact": "Older clients can be forced into weaker ciphers." if legacy else "No action required.", "evidence": " · ".join(filter(None, [", ".join(data["versions"]), tls.get("cipher")])),
            "recommendation": "Disable TLS 1.0/1.1 and prefer AEAD cipher suites only." if legacy else "Keep the current configuration.",
        })
    for item in data["exposed"]:
        if item["exposed"]:
            findings.append({
                "id": f"exposed-{item['path']}", "severity": item["severity"], "title": f"{item['label']} reachable publicly", "area": "Exposure",
                "description": f"{item['path']} responds with sensitive content without network restriction.", "impact": "Attackers can target this path directly.",
                "evidence": f"{item['path']} → {item['status']}", "recommendation": "Restrict by IP allowlist or SSO, add rate limiting and MFA, or remove it.",
            })
    for row in data["software"]:
        if row["status"] == "outdated":
            findings.append({
                "id": f"sw-{row['name']}", "severity": "medium", "title": f"Outdated component: {row['name']}", "area": "Software",
                "description": f"Version {row['version']} is below the supported baseline {row['current']}.", "impact": "Known vulnerabilities may be exploitable.",
                "evidence": f"{row['name']} {row['version']}", "recommendation": "Upgrade to a supported release and pin dependencies in CI.",
            })
    if data["cookies"]:
        first = data["cookies"][0]
        findings.append({
            "id": "cookies", "severity": "medium", "title": "Session cookies require hardening", "area": "Session",
            "description": f"{len(data['cookies'])} cookies are missing one or more security attributes.", "impact": "Tokens become reachable from JavaScript or cross-site requests.",
            "evidence": f"{first['name']}: missing {', '.join(first['missing'])}", "recommendation": "Issue cookies with Secure; HttpOnly; SameSite=Lax.",
        })
    for index, item in enumerate(data["misconfigs"]):
        findings.append({
            "id": f"misconfig-{index}", "severity": item["severity"], "title": item["title"], "area": "Configuration", "description": item["detail"],
            "impact": "Weakens the site's security posture.", "evidence": ctx.final_url, "recommendation": "Review the server configuration.",
        })
    findings = findings_sorted(findings)
    score, header_score = _posture_score(ctx, data) if data["reachable"] else (0, 0)
    hsts = next(item for item in data["headers"] if item["name"] == "Strict-Transport-Security")
    counts = {level: sum(finding["severity"] == level for finding in findings) for level in ("critical", "high", "medium", "low", "info")}
    return {
        "domain": ctx.host, "assessedAt": now_iso(), "live": True, "reachable": data["reachable"], "score": score, "grade": _grade(score) if data["reachable"] else "N/A",
        "headers": data["headers"], "headerScore": header_score,
        "https": {"enforced": data["redirects_http"], "hstsPreload": bool(hsts["value"] and "preload" in hsts["value"]), "redirectsHttp": data["redirects_http"], "mixedContent": data["mixed"]},
        "tls": _tls_block(ctx, data),
        "endpoints": [{key: item[key] for key in ("path", "status", "label", "severity")} for item in data["exposed"]],
        "findings": findings, "counts": counts, "recommendations": _recommendations(data), "latencyMs": ctx.trace["total_ms"],
    }


# --- Redirect chain --------------------------------------------------------------------------------


def _domain_of(url: str) -> str:
    return registrable(urlsplit(url).hostname or "")


def redirect_chain(ctx) -> dict:
    trace = ctx.trace
    hops = trace["hops"]
    result = base(ctx, ctx.url)
    domains = list(dict.fromkeys(_domain_of(hop["url"]) for hop in hops))
    flags, indicators, positives = [], [], []
    if not trace["reachable"]:
        ctx.note(f"The URL could not be followed: {trace['error']}.")
    moves = [(hops[index], hops[index + 1]) for index in range(len(hops) - 1)]
    crossings = sum(_domain_of(a["url"]) != _domain_of(b["url"]) for a, b in moves)
    if crossings >= 2:
        flags.append({"severity": "high", "title": "Multiple cross-domain handoffs", "detail": f"The chain leaves one registrable domain for another {crossings} times before landing."})
    elif crossings == 1:
        flags.append({"severity": "medium", "title": "Cross-domain redirect", "detail": f"The link hands off from {_domain_of(moves[0][0]['url'])} to a different domain."})
    if any(hop["type"] in ("JavaScript", "Meta refresh", "Refresh header") for hop in hops):
        flags.append({"severity": "medium", "title": "Client-side redirect", "detail": "At least one hop uses script or a meta refresh, which hides the destination from simple link scanners."})
    if any(_domain_of(hop["url"]) in SHORTENERS for hop in hops):
        flags.append({"severity": "medium", "title": "URL shortener in the chain", "detail": "A shortener hides the real destination of this link."})
    if any(a["url"].startswith("https:") and b["url"].startswith("http:") for a, b in moves):
        flags.append({"severity": "high", "title": "Downgrade to plain HTTP", "detail": "The chain drops from HTTPS to unencrypted HTTP."})
    if len(hops) >= 5:
        flags.append({"severity": "medium", "title": "Long redirect chain", "detail": f"{len(hops) - 1} redirects before the final page."})
    if len(hops) > 1:
        before, after = parse_qs(urlsplit(ctx.url).query), parse_qs(urlsplit(trace["final_url"]).query)
        added = [key for key in after if key not in before]
        if len(added) >= 3:
            flags.append({"severity": "low", "title": "Parameter injection", "detail": f"Parameters were added along the way: {', '.join(added[:6])}."})
    if trace["blocked"]:
        flags.append({"severity": "critical", "title": "Redirect to a private address", "detail": "The chain points at an internal network address, and following stopped there."})

    landing_score = score_url(trace["final_url"])
    landing = {"url": trace["final_url"], "domain": _domain_of(trace["final_url"]), "mlRisk": round(landing_score["probability"] * 100) if landing_score else None, "changed": _domain_of(ctx.url) != _domain_of(trace["final_url"])}
    if landing["changed"] and landing["mlRisk"] is not None and landing["mlRisk"] >= 60:
        flags.append({"severity": "high", "title": "Landing page looks like phishing", "detail": f"The URL model rates the final page {landing['mlRisk']}/100, regardless of the link that was clicked."})
    weights = {"critical": 90, "high": 42, "medium": 20, "low": 6, "info": 0}
    risk = clamp(sum(weights[flag["severity"]] for flag in flags))
    for flag in flags:
        if flag["severity"] in ("high", "critical"):
            indicators.append(indicator(f"redirect-{flag['title']}", flag["severity"], flag["title"], flag["detail"], trace["final_url"]))
    if not flags and trace["reachable"]:
        flags.append({"severity": "info", "title": "No suspicious redirect behaviour", "detail": "The link reaches its destination directly or through ordinary same-site redirects."})
        positives.append("Redirect chain is short and stays on the same site")
    count = len(hops) - 1
    result.update({
        "hops": hops,
        "final": trace["final_url"],
        "score": int(risk),
        "totalMs": trace["total_ms"],
        "domainsCrossed": len(domains),
        "flags": findings_sorted(flags),
        "summary": (f"The URL passes through {count} redirect{'s' if count != 1 else ''} across {len(domains)} registrable domain{'s' if len(domains) != 1 else ''} before landing on {trace['final_url']}."
                    if trace["reachable"] else f"The URL could not be followed to a landing page: {trace['error']}."),
        "landing": landing,
    })
    result["_signal"] = signal(risk, "behaviour", indicators, positives, evaluated=trace["reachable"])
    return result


# --- Cloaking --------------------------------------------------------------------------------------

# Below this many words, ordinary page differences swamp any text comparison.
MIN_COMPARABLE_WORDS = 120


def _profile(html: str, status: int) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    scripts = soup.find_all("script")
    forms = soup.find_all("form")
    password = soup.find("input", attrs={"type": re.compile("password", re.I)}) is not None
    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    origins = {urlsplit(tag.get("src", "")).hostname for tag in scripts if tag.get("src", "").startswith(("http", "//"))}
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = " ".join(soup.get_text(" ").split())
    return {
        "status": status, "words": len(text.split()), "scripts": len(scripts), "forms": len(forms), "password": password, "title": title[:90],
        "origins": len(origins), "tokens": set(re.findall(r"[a-z]{3,}", text.lower())),
        "hash": hashlib.sha256(text.encode()).hexdigest()[:6],
    }


def _similarity(first: dict, second: dict) -> float:
    if not first["tokens"] and not second["tokens"]:
        return 1.0
    return len(first["tokens"] & second["tokens"]) / max(len(first["tokens"] | second["tokens"]), 1)


def _form_label(profile: dict) -> str:
    if not profile["forms"]:
        return "None"
    return "Login form" if profile["password"] else f"{profile['forms']} form{'s' if profile['forms'] != 1 else ''}"


def cloaking(ctx) -> dict:
    result = base(ctx, f"https://{ctx.host}")
    if not ctx.resolves:
        ctx.note("Cloaking could not be tested because the domain does not resolve.")

    def load(ua, referer=None):
        traced = redirect_net.trace(ctx.url, ua=ua, referer=referer) if ctx.resolves else {"response": None, "final_url": ctx.url}
        response = traced["response"]
        return _profile(response.text if response is not None and response.is_html else "", response.status if response is not None else 0), traced["final_url"]

    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {
            "desktop": pool.submit(load, DESKTOP_UA), "mobile": pool.submit(load, MOBILE_UA), "crawler": pool.submit(load, CRAWLER_UA),
            # A second desktop load measures how much the page changes on its own, such as rotating content.
            "baseline": pool.submit(load, DESKTOP_UA), "referred": pool.submit(load, MOBILE_UA, "https://www.google.com/"),
        }
        pages = {key: future.result() for key, future in futures.items()}
    desktop, mobile, crawler = pages["desktop"][0], pages["mobile"][0], pages["crawler"][0]
    noise = 1 - _similarity(desktop, pages["baseline"][0])
    # Sites commonly refuse a spoofed Googlebot from a non-Google address. That is not cloaking.
    crawler_blocked = desktop["status"] == 200 and crawler["status"] != 200
    def gap(first, second):
        if min(first["words"], second["words"]) < MIN_COMPARABLE_WORDS:
            return 0.0
        return max(0.0, 1 - _similarity(first, second) - noise)
    gap_crawler = 0.0 if crawler_blocked else gap(desktop, crawler)
    gap_referred = gap(mobile, pages["referred"][0])
    final_hosts = {_domain_of(pages[key][1]) for key in ("desktop", "mobile", "crawler") if pages[key][1]}
    login_only_for_users = (desktop["password"] or mobile["password"]) and not crawler["password"] and not crawler_blocked
    enough_text = max(desktop["words"], mobile["words"], crawler["words"]) >= 20
    redirect_split = len(final_hosts) > 1
    # Responsive sites differ a little by device. Only large gaps or a form hidden from bots count.
    detected = enough_text and desktop["status"] > 0 and (gap_crawler > 0.55 or login_only_for_users or redirect_split or gap_referred > 0.6)
    score = 0
    findings, indicators, positives = [], [], []
    if detected:
        score = int(clamp(45 + max(gap_crawler, gap_referred) * 45 + (20 if login_only_for_users else 0) + (20 if redirect_split else 0)))
        if login_only_for_users:
            findings.append({"severity": "critical", "title": "Login form hidden from search bots", "detail": "Human visitors see a password form, while the crawler receives a page without one."})
        if gap_crawler > 0.55:
            findings.append({"severity": "high", "title": "Crawler-specific content", "detail": f"Googlebot receives a page that differs from a desktop browser's by {int(gap_crawler * 100)}%."})
        if redirect_split:
            findings.append({"severity": "high", "title": "Different destination by visitor type", "detail": f"Visitors are sent to different domains: {', '.join(sorted(final_hosts))}."})
        if gap_referred > 0.6:
            findings.append({"severity": "medium", "title": "Referrer-gated content", "detail": "Content changes depending on whether the visit comes from a search engine."})
        indicators.append(indicator("cloaking", "high", "Conditional content serving", "The page shows different content to search bots than to real visitors.", f"Crawler divergence {int(gap_crawler * 100)}%"))
    elif crawler_blocked:
        findings.append({"severity": "info", "title": "Crawler was refused", "detail": f"The site answered {crawler['status']} to the crawler user agent, most likely bot protection. This is not treated as cloaking."})
    elif not ctx.resolves or desktop["status"] == 0:
        findings.append({"severity": "info", "title": "Not evaluated", "detail": "The site did not respond, so no comparison was possible."})
    else:
        findings.append({"severity": "info", "title": "Consistent rendering", "detail": "All visitor profiles received equivalent content."})
        if enough_text:
            positives.append("Content is consistent across desktop, mobile and crawler visits")
    variants = [
        {"label": "Desktop visitor", "agent": "Chrome 141 · 1440×900", **{key: desktop[key] for key in ("status", "words", "scripts", "hash")}, "verdict": "content"},
        {"label": "Mobile visitor", "agent": "iPhone · Safari 18", **{key: mobile[key] for key in ("status", "words", "scripts", "hash")}, "verdict": "content"},
        {"label": "Search crawler", "agent": "Googlebot 2.1", **{key: crawler[key] for key in ("status", "words", "scripts", "hash")}, "verdict": "blocked" if crawler_blocked else ("benign" if detected else "content")},
    ]
    def row(aspect, getter):
        return {"aspect": aspect, "desktop": getter(desktop), "mobile": getter(mobile), "crawler": getter(crawler)}
    result.update({
        "score": score,
        "cloakingDetected": bool(detected),
        "summary": (f"Visitors and crawlers receive materially different pages (crawler divergence {int(gap_crawler * 100)}%, natural page variation {int(noise * 100)}%)."
                    if detected else "No conditional serving was observed across desktop, mobile and crawler visits."),
        "variants": variants,
        "diffs": [
            row("Document title", lambda page: page["title"] or "None"), row("Primary form", _form_label), row("Third-party scripts", lambda page: str(page["origins"])),
            row("Inline and external scripts", lambda page: str(page["scripts"])), row("Visible words", lambda page: f"{page['words']:,}"),
        ],
        "findings": findings_sorted(findings),
    })
    # Text differences alone have many innocent causes; a hidden login or split destination does not.
    fused = score if login_only_for_users or redirect_split else min(score, 35)
    result["_signal"] = signal(fused, "behaviour", indicators if fused >= 40 else [], positives, evaluated=desktop["status"] > 0 and enough_text)
    return result

