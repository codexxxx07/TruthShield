"""Full URL scan: run every detector, fuse their signals, and write the report."""
import logging
import re
import secrets
import time
from concurrent.futures import ThreadPoolExecutor

from ..context import Ctx
from ..db import get_db, public
from ..detectors import certs, common, content, hosting, typosquatting, upi, visual, web
from ..detectors.common import indicator, signal
from ..ml.model import score_url
from ..net import tlsinfo
from ..util import InvalidTarget, clamp, now_iso, split_domain, to_iso, utcnow
from . import intel, tls_report

log = logging.getLogger("truthshield.scan")

VERDICT_META = {
    "safe": {"label": "Safe", "tone": "safe", "description": "No meaningful risk signals detected"},
    "suspicious": {"label": "Suspicious", "tone": "medium", "description": "Signals require caution before use"},
    "malicious": {"label": "Malicious", "tone": "critical", "description": "Multiple high-confidence threat signals"},
}
# How strongly a maximal signal from each source moves the final score.
WEIGHTS = {
    "intel": 0.97, "visual": 0.85, "lookalike": 0.8, "favicon": 0.75, "kits": 0.8, "js": 0.75, "cloaking": 0.65, "payments": 0.6,
    "url_ml": 0.45, "anomalies": 0.5, "hosting": 0.5, "age": 0.35, "redirect": 0.4, "ca": 0.35, "ct": 0.25, "config": 0.2,
}
CATEGORY_MEMBERS = {
    "phishing": ("url_ml", "kits", "intel"),
    "malware": ("malware",),
    "impersonation": ("lookalike", "visual", "favicon", "ct"),
    "infrastructure": ("anomalies", "ca", "hosting", "config", "age"),
    "behaviour": ("js", "cloaking", "redirect"),
}
ML_ONLY_CAP = 58
OFFICIAL_CAP = 15
POPULAR_RANK = 50000
POPULAR_ML_DAMPING = 0.25
# Government and academic suffixes require proof of eligibility to register.
RESTRICTED_SUFFIX = re.compile(r"(^|\.)(gov|gv|gouv|gob|mil|edu|ac|nic)(\.|$)")
OPTIONAL_MODULES = {"visual": "visual", "behaviour": "js", "kit": "kits", "payments": "payments"}


def verdict_for(score: float) -> str:
    return "malicious" if score >= 65 else "suspicious" if score >= 33 else "safe"


def _ml_signal(ctx, rank: int | None) -> dict:
    scores = [(ctx.url, score_url(ctx.url))]
    if ctx.final_url != ctx.url:
        scores.append((ctx.final_url, score_url(ctx.final_url)))
    scores = [(url, item) for url, item in scores if item]
    if not scores:
        ctx.note("The URL model is not trained, so machine-learning scoring was skipped.")
        return signal(0, "phishing", evaluated=False)
    url, best = max(scores, key=lambda pair: pair[1]["probability"])
    # Homepages of small legitimate sites often land between 0.5 and 0.75, so that band counts for little.
    risk = max(0.0, best["probability"] - 0.5) * 200
    # Popularity vouches for a domain's owner, which says nothing about a free-hosting tenant.
    if rank and rank <= POPULAR_RANK and not ctx.host.endswith(hosting.FREE_SUFFIXES):
        risk *= POPULAR_ML_DAMPING
    elif RESTRICTED_SUFFIX.search(split_domain(ctx.host)[2]):
        risk *= POPULAR_ML_DAMPING
    indicators = []
    if risk >= 50:
        reasons = ", ".join(factor["label"].lower() for factor in best["factors"][:3]) or "the URL's character patterns"
        indicators.append(indicator("ml-url", "high" if risk >= 75 else "medium", f"Machine-learning model flags this URL ({best['probability']:.0%} phishing probability)",
                                    f"The URL classifier compared this address with known phishing and legitimate URLs. Main factors: {reasons}.",
                                    f"P(phishing) = {best['probability']:.2f} · {url[:120]}"))
    return signal(risk, "phishing", indicators)


def _age_signal(ctx) -> dict:
    rdap = ctx.rdap
    age = rdap["ageDays"]
    if age is None:
        return signal(0, "infrastructure", evaluated=False)
    if age < 30:
        return signal(70, "infrastructure", [indicator("new-domain", "high", f"Domain registered {age} days ago", "Very new domains are a leading phishing indicator.", to_iso(rdap["created"]))])
    if age < 180:
        return signal(35, "infrastructure", [indicator("young-domain", "medium", f"Domain is only {age} days old", "Young domains deserve extra caution.", to_iso(rdap["created"]))])
    positives = [f"Domain registered for {age // 365} years"] if age >= 730 else []
    return signal(0, "infrastructure", positives=positives)


def _intel_signal(found: dict) -> dict:
    indicators, risk = [], 0
    threat = found["threat"]
    if threat:
        severity = threat.get("severity", "medium")
        risk = {"critical": 96, "high": 86, "medium": 55, "low": 30}.get(severity, 40)
        indicators.append(indicator("intel-db", "critical" if risk >= 85 else "high", f"Listed as {threat['category']}", "This indicator is in the TruthShield threat database.", f"{threat['id']} · {threat.get('reports', 0)} reports"))
    if found["feed_hit"]:
        risk = max(risk, 97)
        indicators.append(indicator("intel-feed", "critical", "Listed on a public phishing feed", "This site is currently on the OpenPhish feed.", "OpenPhish"))
    if found["confirmed"]:
        risk = max(risk, 92)
        indicators.append(indicator("intel-reports", "critical", "Confirmed community reports", f"{len(found['confirmed'])} community reports were confirmed.", f"{len(found['reports'])} total reports"))
    elif found["reports"]:
        risk = max(risk, 38)
        indicators.append(indicator("intel-reports", "medium", "Community reports under review", f"{len(found['reports'])} reports are waiting for review.", f"{len(found['reports'])} reports"))
    positives = [f"Ranked {found['rank']:,} in the Tranco popular sites list"] if found["rank"] and found["rank"] <= POPULAR_RANK else []
    return signal(risk, "phishing", indicators, positives)


def _ct_signal(ctx) -> dict:
    matches = [row for row in certs.ct_matches_for(ctx.host) if row["domain"].endswith(ctx.domain)]
    if not matches:
        return signal(0, "impersonation")
    return signal(55, "impersonation", [indicator("ct-lookalike", "medium", "Flagged by certificate log monitoring", "A certificate for this host was caught imitating a brand in public CT logs.", matches[0]["domain"])])


def _payments_signal(ctx) -> dict:
    if not ctx.reachable:
        return signal(0, "phishing", evaluated=False)
    links = {match.group(0) for match in re.finditer(r"upi://pay\?[^\"'<>\s]+", ctx.html, re.I)}
    worst, indicators = 0, []
    for link in list(links)[:6]:
        try:
            report = upi.upi_qr(link.replace("&amp;", "&"))
        except InvalidTarget:
            continue
        worst = max(worst, report["score"])
        if report["score"] > 25:
            indicators.append(indicator("upi-link", "high" if report["score"] > 55 else "medium", f"Risky UPI payment link: {report['vpa']}", report["summary"], link[:160]))
    return signal(worst, "phishing", indicators)


def _safely(name: str, function, ctx) -> dict:
    started = time.perf_counter()
    try:
        output = function()
    except Exception:
        log.exception("Detector %s failed for %s", name, ctx.host)
        ctx.note(f"The {name} check failed and was skipped.")
        output = {"_signal": signal(0, "infrastructure", evaluated=False)}
    return {"output": output, "ms": int((time.perf_counter() - started) * 1000)}


def fuse(signals: dict) -> tuple[int, dict]:
    """Noisy-OR: each independent source reduces the chance the site is clean."""
    clean = 1.0
    for name, item in signals.items():
        clean *= 1 - WEIGHTS[name] * item["risk"] / 100
    return int(round((1 - clean) * 100)), {name: round(item["risk"]) for name, item in signals.items()}


def _category_scores(signals: dict, found: dict) -> dict:
    malware_listed = found["threat"] and found["threat"].get("category") == "Malware"
    malware = 90 if malware_listed else (signals["js"]["risk"] * 0.4 if "js" in signals else 0)
    output = {}
    for category, members in CATEGORY_MEMBERS.items():
        if category == "malware":
            output[category] = int(malware)
            continue
        clean = 1.0
        for member in members:
            if member in signals:
                clean *= 1 - signals[member]["risk"] / 100 * 0.85
        output[category] = int(round((1 - clean) * 100))
    return output


def _recommendations(verdict: str) -> list[str]:
    if verdict == "malicious":
        return [
            "Do not enter credentials, payment details or one-time passwords on this page",
            "Block the domain at DNS, proxy or email gateway level",
            "Report the URL to CERT-In or your regional CERT, and to the impersonated brand",
            "If credentials were entered, change them now and revoke active sessions",
        ]
    if verdict == "suspicious":
        return [
            "Verify the site independently before paying or signing in",
            "Prefer an app or a bookmarked URL over a link from messages",
            "Do not share OTPs, card CVVs or net-banking passwords",
            "Re-scan later, as new sites can change quickly",
        ]
    return [
        "No action required for a standard browsing session",
        "Check the address bar before entering sensitive details",
        "Re-scan after any unexpected change to the site",
    ]


def _summary(verdict: str, ctx, indicators: list[dict], rank_cap: bool) -> str:
    reachable = ctx.reachable
    top = "; ".join(item["label"].lower() for item in indicators[:3])
    if verdict == "safe":
        text = "No phishing, malware or impersonation indicators were found across the checks that ran." if reachable else "No strong risk indicators were found, but the site could not be reached, so only its address was analysed."
    elif verdict == "suspicious":
        text = f"Several signals call for caution: {top}."
    else:
        text = f"Multiple signals point to malicious intent: {top}. Treat this page as hostile."
    if not reachable:
        text += " The site did not respond, so page content was not inspected."
    if rank_cap:
        text += " Only the URL model raised concern, so the verdict stops at suspicious until another check agrees."
    return text


def _domain_info(ctx) -> dict:
    rdap, asn, records = ctx.rdap, ctx.asn, ctx.dns
    return {
        "registrar": rdap["registrar"], "ageDays": rdap["ageDays"], "created": to_iso(rdap["created"]), "ip": (records["a"] or records["aaaa"] or ["None"])[0], "country": asn["country"],
        "countryCode": asn["countryCode"], "asn": asn["asn"], "org": asn["org"], "nameservers": records["ns"][:4], "privacy": bool(rdap["privacy"]),
    }


def _ssl_block(ctx) -> dict:
    tls = ctx.tls
    if not tls.get("reachable"):
        return {"grade": "N/A", "issuer": "Unavailable", "protocol": "None", "valid": False, "daysRemaining": None, "subject": ctx.host, "issuerMeta": {"name": "Unavailable", "short": "Unavailable", "tier": "Unknown", "trust": 0},
                "ctLogged": False, "keyType": "Unavailable", "validFrom": None, "validTo": None, "sans": []}
    leaf = tls["leaf"]
    report = tls_report.summarize(ctx)
    ca = certs.find_ca(tlsinfo.issuer_name(leaf))
    return {
        "grade": report["grade"], "issuer": tlsinfo.issuer_name(leaf), "protocol": tls["protocol"], "valid": bool(tls["valid"]), "daysRemaining": leaf["days_remaining"], "subject": leaf["subject_cn"] or ctx.host,
        "issuerMeta": {"name": tlsinfo.issuer_name(leaf), "short": leaf["issuer_cn"] or "Unknown", "tier": "OV" if leaf["subject_org"] else "DV", "trust": ca["base"] if ca else 45},
        "ctLogged": len(leaf["scts"]) > 0, "keyType": f"{leaf['key']['algorithm']} {leaf['key']['curve'] or leaf['key']['size']}", "validFrom": to_iso(leaf["not_before"]), "validTo": to_iso(leaf["not_after"]), "sans": leaf["sans"][:20],
    }


def _hop_list(ctx) -> list[dict]:
    hops = ctx.trace["hops"]
    return [
        {"step": index + 1, "from": hops[index]["url"], "to": hops[index + 1]["url"], "status": hops[index]["status"], "type": hops[index]["type"], "note": hops[index]["note"]}
        for index in range(len(hops) - 1)
    ]


def _persist(report: dict, user: dict | None, source: str) -> None:
    db = get_db()
    db.scans.insert_one({
        "scanId": report["scanId"], "url": report["url"], "domain": report["domain"], "verdict": report["verdict"], "riskScore": report["riskScore"], "findings": len(report["indicators"]), "source": source,
        "scannedAt": report["scannedAt"], "createdAt": utcnow(), "userId": user["id"] if user else None, "report": report,
    })
    if report["verdict"] == "malicious":
        top = report["indicators"][0]["label"] if report["indicators"] else "Automated detection"
        category = "Brand Impersonation" if report["categories"]["impersonation"] >= report["categories"]["phishing"] else "Phishing"
        db.threats.update_one(
            {"indicator": report["domain"]},
            {"$setOnInsert": {
                "id": f"TI-{secrets.token_hex(3).upper()}", "indicator": report["domain"], "type": "domain", "category": category, "categoryId": category.lower().replace(" ", "-"),
                "severity": "critical" if report["riskScore"] >= 85 else "high", "status": "monitoring", "reports": 0, "country": report["domainInfo"]["countryCode"], "tags": ["auto-detected"],
                "firstSeen": report["scannedAt"], "confidence": report["confidence"], "source": "Automated crawl", "firstReportedBy": "TruthShield", "lastReportedBy": "TruthShield",
                "registrar": report["domainInfo"]["registrar"], "note": top,
            }, "$set": {"lastSeen": report["scannedAt"]}},
            upsert=True,
        )


def run_scan(raw_url: str, modules: list[str] | None = None, user: dict | None = None, source: str = "Manual scan") -> dict:
    ctx = Ctx.from_url(raw_url)
    disabled = {OPTIONAL_MODULES[item] for item in OPTIONAL_MODULES if modules is not None and item not in modules}
    timings = {}
    started = time.perf_counter()
    records = ctx.dns
    timings["dns"] = int((time.perf_counter() - started) * 1000)
    mark = time.perf_counter()
    tls = ctx.tls
    timings["tls"] = int((time.perf_counter() - mark) * 1000)
    mark = time.perf_counter()
    _ = ctx.trace
    if "visual" not in disabled or "js" not in disabled:
        _ = ctx.render
    timings["render"] = int((time.perf_counter() - mark) * 1000)
    mark = time.perf_counter()
    found = intel.lookup(ctx)
    timings["intel"] = int((time.perf_counter() - mark) * 1000)
    assessment = typosquatting.self_assessment(ctx)
    official = assessment["official"]

    tasks = {
        "url_ml": lambda: {"_signal": _ml_signal(ctx, found["rank"])},
        "lookalike": lambda: {"_signal": typosquatting.signal_from_lookalike(assessment, ctx)},
        "visual": lambda: visual.visual_similarity(ctx),
        "favicon": lambda: visual.favicon_logo_hash(ctx),
        "kits": lambda: content.phishing_kits(ctx),
        "js": lambda: content.javascript_behaviour(ctx),
        "cloaking": lambda: web.cloaking(ctx),
        "redirect": lambda: web.redirect_chain(ctx),
        "config": lambda: web.security_configuration(ctx),
        "anomalies": lambda: certs.certificate_anomalies(ctx),
        "ca": lambda: certs.ca_reputation(ctx),
        "hosting": lambda: hosting.hosting_fingerprint(ctx),
        "ct": lambda: {"_signal": _ct_signal(ctx)},
        "age": lambda: {"_signal": _age_signal(ctx)},
        "payments": lambda: {"_signal": _payments_signal(ctx)},
    }
    tasks = {name: task for name, task in tasks.items() if name not in disabled}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {name: pool.submit(_safely, name, task, ctx) for name, task in tasks.items()}
        results = {name: future.result() for name, future in futures.items()}

    signals = {name: item["output"]["_signal"] for name, item in results.items()}
    signals["intel"] = _intel_signal(found)
    raw_score, breakdown = fuse(signals)
    corroborated = any(item["risk"] >= 40 for name, item in signals.items() if name != "url_ml")
    ml_capped = not corroborated and raw_score > ML_ONLY_CAP
    score = min(raw_score, ML_ONLY_CAP) if ml_capped else raw_score
    if official and signals["intel"]["risk"] < 80:
        score = min(score, OFFICIAL_CAP)
    verdict = verdict_for(score)

    indicators = [item for current in signals.values() for item in current["indicators"]]
    if official and verdict == "safe":
        indicators = [item for item in indicators if item["severity"] in ("critical", "high") and item["id"].startswith(("intel", "exposed"))]
    indicators = common.findings_sorted(indicators)
    positives = list(dict.fromkeys(item for current in signals.values() for item in current["positives"]))
    evaluated = sum(item["evaluated"] for item in signals.values())
    coverage = evaluated / max(len(signals), 1)
    confidence = int(clamp((58 + abs(score - 50) * 0.8) * (0.55 + 0.45 * coverage), 25, 99))

    intel_matches = sum(item["status"] in ("malicious", "suspicious") for item in found["sources"])
    redirects = _hop_list(ctx)
    categories = _category_scores(signals, found)
    report = {
        "scanId": f"TS-{secrets.token_hex(4).upper()}",
        "url": ctx.url, "domain": ctx.host, "scannedAt": now_iso(), "live": True, "riskScore": score, "verdict": verdict, "verdictMeta": VERDICT_META[verdict], "confidence": confidence,
        "summary": _summary(verdict, ctx, indicators, ml_capped), "indicators": indicators, "positiveSignals": positives[:6] or ["No specific reassuring signals were found"],
        "categories": categories, "domainInfo": _domain_info(ctx), "ssl": _ssl_block(ctx), "redirects": redirects, "intel": found["sources"],
        "timeline": [
            {"stage": "DNS resolution", "status": "complete" if records["resolves"] else "failed", "ms": timings["dns"], "detail": f"{ctx.host} → {(records['a'] or records['aaaa'] or ['no address'])[0]}"},
            {"stage": "TLS handshake", "status": "complete" if tls.get("reachable") else "failed", "ms": timings["tls"], "detail": f"{tls.get('protocol')} · {tlsinfo.issuer_name(tls['leaf'])}" if tls.get("reachable") else tls.get("error", "Unavailable")[:80]},
            {"stage": "Certificate transparency", "status": "complete", "ms": results["ct"]["ms"], "detail": f"{len(tls['leaf']['scts'])} SCTs embedded" if tls.get("reachable") else "No certificate available"},
            {"stage": "Content render", "status": "complete" if ctx.render else "skipped", "ms": timings["render"], "detail": f"{len(ctx.render['requests'])} requests" if ctx.render else "Not rendered"},
            {"stage": "Behaviour sandbox", "status": "complete" if "js" in results else "skipped", "ms": results.get("js", {}).get("ms", 0), "detail": f"{len(ctx.scripts)} scripts analysed" if ctx.reachable else "No scripts"},
            {"stage": "Reputation correlation", "status": "complete", "ms": timings["intel"], "detail": f"{intel_matches} of {len(found['sources'])} sources returned signals"},
        ],
        "recommendations": _recommendations(verdict),
        "relationship": _relationship(ctx, results, score),
        "signalBreakdown": breakdown,
        "limitations": ctx.limitations,
    }
    _persist(report, user, source)
    return report


def _relationship(ctx, results: dict, score: int) -> dict:
    db = get_db()
    host_rows = db.dns_history.find({"ips": {"$in": ctx.dns["a"]}}) if ctx.dns["a"] else []
    related = {row["domain"] for row in host_rows if row["domain"] != ctx.domain}
    cluster = results.get("kits", {}).get("output", {}).get("cluster", {"nodes": []})
    return {
        "relatedDomains": len(related),
        "sharedCertificates": max(0, len(ctx.tls["leaf"]["sans"]) - 2) if ctx.tls.get("reachable") else 0,
        "campaignLinked": score > 70 and any(node["type"] in ("kit", "host") for node in cluster["nodes"]),
    }


def get_scan(scan_id: str) -> dict | None:
    row = get_db().scans.find_one({"scanId": scan_id})
    return public(row)["report"] if row else None
