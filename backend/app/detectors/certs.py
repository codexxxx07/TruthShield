"""Modules 1–3: Certificate Transparency monitoring, CA reputation, certificate anomaly checks."""
from datetime import datetime

import certifi
from cryptography import x509

from ..config import settings
from ..db import get_db, public
from ..net.fetcher import fetch_json
from ..net import tlsinfo
from ..util import clamp, load_json, now_iso, registrable, to_iso, utcnow
from .common import assess_lookalike, base, indicator, signal
from .typosquatting import check_registered, generate_variants

CERTSPOTTER = "https://api.certspotter.com/v1/issuances"
CT_LOG_LIST = "https://www.gstatic.com/ct/log_list/v3/log_list.json"
LOG_OPERATORS = ("Google", "Cloudflare", "DigiCert", "Sectigo")
MAX_VARIANT_LOOKUPS = 4
INTERCEPTED_NOTE = "A firewall on this network ({issuer}) replaced the site's certificate, so its real certificate could not be checked."


def _parse_time(value: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None
    except ValueError:
        return None


def _issuances(domain: str, subdomains: bool = True) -> list[dict] | None:
    """Certificates for a domain from Certspotter, or crt.sh when it is unavailable."""
    headers = {"Authorization": f"Bearer {settings.certspotter_api_key}"} if settings.certspotter_api_key else None
    url = f"{CERTSPOTTER}?domain={domain}&include_subdomains={'true' if subdomains else 'false'}&expand=dns_names&expand=issuer&expand=revocation"
    data = fetch_json(url, timeout=8, headers=headers)
    if isinstance(data, list):
        return [
            {
                "names": item.get("dns_names") or [],
                "issuer": (item.get("issuer") or {}).get("friendly_name") or (item.get("issuer") or {}).get("name") or "Unknown",
                "not_before": _parse_time(item.get("not_before")),
                "not_after": _parse_time(item.get("not_after")),
                "revoked": bool((item.get("revocation") or {}).get("time")),
                "serial": str(item.get("tbs_sha256") or item.get("id"))[:16],
            }
            for item in data
        ]
    fallback = fetch_json(f"https://crt.sh/?q={domain}&output=json&exclude=expired", timeout=10)
    if isinstance(fallback, list):
        return [
            {
                "names": (item.get("name_value") or "").split("\n"),
                "issuer": item.get("issuer_name", "Unknown").split("O=")[-1].split(",")[0].strip('"'),
                "not_before": _parse_time((item.get("not_before") or "") + "+00:00"),
                "not_after": _parse_time((item.get("not_after") or "") + "+00:00"),
                "revoked": False,
                "serial": str(item.get("serial_number", ""))[:16],
            }
            for item in fallback[:200]
        ]
    return None


def _status(cert: dict) -> str:
    if cert["revoked"]:
        return "revoked"
    return "expired" if cert["not_after"] and cert["not_after"] < utcnow() else "active"


def _ct_logs() -> list[dict]:
    """Live state of the main RFC 6962 logs: entry count and how far behind the signed head is."""
    listing = fetch_json(CT_LOG_LIST, timeout=8)
    logs = []
    if not isinstance(listing, dict):
        return logs
    for operator in listing.get("operators", []):
        if operator.get("name") not in LOG_OPERATORS:
            continue
        usable = [item for item in operator.get("logs", []) if "usable" in item.get("state", {})]
        for item in usable[:1]:
            head = fetch_json(f"{item['url']}ct/v1/get-sth", timeout=5)
            if not isinstance(head, dict):
                continue
            lag = max(0, int(utcnow().timestamp() - head.get("timestamp", 0) / 1000))
            logs.append({
                "name": item.get("description", item["url"]), "operator": operator["name"], "entries": head.get("tree_size", 0),
                "lag": f"{lag // 60} min" if lag >= 60 else f"{lag} sec",
            })
    return logs


def _store_alert(severity: str, title: str, detail: str, domain: str, brand: str | None) -> None:
    get_db().ct_alerts.update_one(
        {"title": title, "domain": domain},
        {"$setOnInsert": {"severity": severity, "title": title, "detail": detail, "domain": domain, "brand": brand, "time": now_iso()}},
        upsert=True,
    )


def ct_matches_for(domain: str) -> list[dict]:
    """Lookalike certificates that the background log watcher has already recorded."""
    assessment = assess_lookalike(domain)
    keys = [assessment["brand"]] if assessment.get("brand") else []
    query = {"$or": [{"matched_domain": registrable(domain)}, {"brand": {"$in": keys}}]} if keys else {"matched_domain": registrable(domain)}
    return [public(row) for row in get_db().ct_matches.find(query).sort("seenAt", -1).limit(50)]


def certificate_transparency(ctx) -> dict:
    domain = ctx.domain
    certs = _issuances(domain)
    available = certs is not None
    certs = certs or []
    if not available:
        ctx.note("Certificate log search services were unavailable; only certificates seen by the log watcher are shown.")

    lookalikes, seen = [], set()
    for row in ct_matches_for(domain):
        if row["domain"] in seen or registrable(row["domain"]) == domain:
            continue
        seen.add(row["domain"])
        lookalikes.append({"domain": row["domain"], "issuer": row["issuer"], "issued": row["issued"], "similarity": row["similarity"], "status": "active"})

    variants = generate_variants(domain, limit=60)
    registered = check_registered(variants, limit=40)
    for variant in sorted(registered, key=lambda item: item["risk"], reverse=True)[:MAX_VARIANT_LOOKUPS]:
        for cert in (_issuances(variant["ascii"], subdomains=False) or [])[:2]:
            name = variant["ascii"]
            if name in seen:
                continue
            seen.add(name)
            lookalikes.append({
                "domain": name, "issuer": cert["issuer"], "issued": to_iso(cert["not_before"]), "similarity": variant["risk"], "status": _status(cert),
            })

    flagged_names = {item["domain"] for item in lookalikes}
    certs.sort(key=lambda cert: cert["not_before"] or utcnow(), reverse=True)
    timeline, previous_names = [], set()
    for cert in reversed(certs[:40]):
        names = tuple(sorted(cert["names"]))
        kind = "revoked" if cert["revoked"] else ("renewed" if names in previous_names else "issued")
        previous_names.add(names)
        timeline.append({
            "date": to_iso(cert["not_before"]), "commonName": (cert["names"] or [domain])[0], "issuer": cert["issuer"], "type": kind,
            "flagged": any(name in flagged_names for name in cert["names"]), "serial": ":".join(cert["serial"][i:i + 2] for i in range(0, 8, 2)),
        })
    timeline.reverse()
    timeline = timeline[:10]

    alerts = []
    recent = [item for item in lookalikes if item["status"] == "active" and (_parse_time(item["issued"]) or utcnow()) > utcnow().replace(year=utcnow().year - 1)]
    for item in recent[:4]:
        title = f"Lookalike certificate: {item['domain']}"
        detail = f"{item['domain']} holds a certificate from {item['issuer']} and is {item['similarity']}% similar to {domain}."
        alerts.append({"severity": "high", "title": title, "time": item["issued"], "detail": detail})
        _store_alert("high", title, detail, item["domain"], domain)
    if not alerts:
        alerts.append({
            "severity": "info", "title": "No lookalike certificates" if available else "Log search unavailable", "time": now_iso(),
            "detail": f"{len(certs)} certificates for {domain} were reviewed." if available else "The log search services did not respond. Try again shortly.",
        })

    logs = _ct_logs()
    active = sum(item["status"] == "active" for item in lookalikes)
    summary = (
        f"{len(lookalikes)} lookalike certificate{'s' if len(lookalikes) != 1 else ''} found for {domain}, {active} still active."
        if lookalikes else f"No lookalike certificates were found across {len(variants)} high-similarity names. {len(certs)} certificates for {domain} were reviewed."
    )
    result = base(ctx, domain)
    result.update({
        "summary": summary,
        "stats": {"certificates": len(certs), "lookalikes": len(lookalikes), "alerts": sum(a["severity"] != "info" for a in alerts), "monitors": len(logs), "lastScan": now_iso()},
        "lookalikes": lookalikes[:20],
        "timeline": timeline,
        "alerts": alerts,
        "logs": logs,
    })
    result["_signal"] = signal(min(40, active * 10), "impersonation", evaluated=available)
    return result


# --- CA reputation ---------------------------------------------------------------------------------


def _mozilla_roots() -> list[x509.Certificate]:
    with open(certifi.where(), "rb") as handle:
        return x509.load_pem_x509_certificates(handle.read())


_ROOTS: list | None = None


def _roots_for(terms: list[str]) -> tuple[int, int | None]:
    """Count Mozilla-trusted roots belonging to this CA, from the bundled certifi store."""
    global _ROOTS
    if _ROOTS is None:
        _ROOTS = _mozilla_roots()
    matched = [root for root in _ROOTS if any(term in root.subject.rfc4514_string().lower() for term in terms)]
    return len(matched), min((root.not_valid_before_utc.year for root in matched), default=None)


def find_ca(issuer: str) -> dict | None:
    lowered = issuer.lower()
    return next((ca for ca in get_db().ca_db.find() if any(term in lowered for term in ca["match"])), None)


def _grade(score: float) -> str:
    return "AAA" if score > 90 else "AA" if score > 80 else "A" if score > 70 else "BBB" if score > 55 else "BB" if score > 40 else "C"


def ca_reputation(ctx) -> dict:
    tls = ctx.tls
    result = base(ctx)
    issuer = tlsinfo.issuer_name(tls["leaf"]) if tls.get("reachable") else None
    ca = find_ca(issuer) if issuer else None
    if issuer is None:
        ctx.note("No certificate could be retrieved, so there is no issuing CA to score.")
    roots, root_since = _roots_for(ca["match"]) if ca else (0, None)
    mozilla_included = roots > 0

    if ca:
        score = ca["base"]
        recent_penalty = sum({"critical": 10, "high": 6, "medium": 3, "low": 1}.get(item["severity"], 0) for item in ca["incidents"] if item["year"] >= utcnow().year - 3)
        score = clamp(score - recent_penalty, 0, 99)
    else:
        # A chain that validates means the CA is publicly trusted, just not profiled here.
        score = (62 if tls.get("valid") else 30) if issuer else 0
    if tls.get("reachable") and tls["leaf"]["self_signed"]:
        score = 5

    stores = [{"store": "Mozilla", "status": "included" if mozilla_included else "not included", "since": root_since}]
    for store, status in (ca["stores"].items() if ca else ()):
        stores.append({"store": store, "status": status, "since": None})
    distrusted = ca.get("distrusted") if ca else None
    display = ca["name"] if ca else (issuer or "Unavailable")
    tier = (ca["tier"] if ca else "Unknown")
    if tls.get("reachable") and tls["leaf"]["subject_org"]:
        tier = "Organisation Validated"
    elif tls.get("reachable"):
        tier = "Domain Validated"

    signals = [
        {"label": "Root program membership", "value": f"{roots} root{'s' if roots != 1 else ''} in the Mozilla store" if roots else "Not found in the Mozilla store", "tone": "safe" if roots else "high"},
        {"label": "Browser trust status", "value": f"Distrusted by {distrusted['by']} ({distrusted['year']})" if distrusted else ("No distrust on record" if ca else "Unknown CA"), "tone": "critical" if distrusted else ("safe" if ca else "medium")},
        {"label": "Revocation SLA", "value": ca["revocation_sla"] if ca else "Unknown", "tone": "safe" if ca and "24" in ca["revocation_sla"] else "medium"},
        {"label": "Validation level", "value": tier, "tone": "safe" if tier.startswith("Organisation") else "low"},
        {"label": "CT enforcement", "value": f"{len(tls['leaf']['scts'])} embedded SCTs" if tls.get("reachable") else "Unknown", "tone": "safe" if tls.get("reachable") and tls["leaf"]["scts"] else "medium"},
    ]
    incident_load = sum({"critical": 40, "high": 22, "medium": 10, "low": 4}.get(item["severity"], 0) for item in (ca["incidents"] if ca else []))
    base_score = ca["base"] if ca else (45 if issuer else 0)
    dimensions = [
        {"label": "Incident response", "value": int(clamp(100 - incident_load))},
        {"label": "Audit compliance", "value": int(clamp(base_score + 4))},
        {"label": "Revocation speed", "value": int(clamp(92 if ca and "24" in ca["revocation_sla"] else 55))},
        {"label": "Validation rigour", "value": int(clamp(base_score + (6 if tier.startswith("Organisation") else -6)))},
    ]
    verdict = "trusted" if score > 72 and not distrusted else "monitor"
    summary_parts = [f"{display} issued the certificate for {ctx.host}." if issuer else f"No certificate is available for {ctx.host}."]
    if distrusted:
        summary_parts.append(f"{distrusted['note']}")
    elif ca and ca["incidents"]:
        summary_parts.append(f"{len(ca['incidents'])} public incident{'s' if len(ca['incidents']) != 1 else ''} on record.")
    elif ca:
        summary_parts.append("No major public incidents on record.")
    elif issuer:
        summary_parts.append("Its chain validates, but this CA has no profile in the reputation database." if tls.get("valid") else "This issuer is not publicly trusted.")
    if ca and ca.get("abuse_note"):
        summary_parts.append(ca["abuse_note"])

    result.update({
        "score": int(score),
        "grade": _grade(score),
        "ca": {
            "name": display, "since": ca["since"] if ca else None, "type": ca["type"] if ca else "Unknown", "roots": roots, "tier": tier,
            "country": ca["country"] if ca else ((tls["leaf"]["issuer_country"] or "Unknown") if tls.get("reachable") else "Unknown"),
        },
        "summary": " ".join(summary_parts),
        "trustStores": stores,
        "signals": signals,
        "dimensions": dimensions,
        "incidents": ca["incidents"] if ca else [],
        "verdict": verdict,
    })
    indicators = []
    if distrusted:
        indicators.append(indicator("ca-distrusted", "high", f"Certificate from a distrusted CA: {display}", distrusted["note"], f"{display} · {distrusted['year']}"))
    elif issuer and not ca and not tls.get("valid"):
        indicators.append(indicator("ca-unknown", "medium", "Certificate from an untrusted issuer", "The certificate chain does not lead to a publicly trusted authority.", issuer))
    risk = (100 - score) * (0.9 if distrusted or (issuer and not ca and not tls.get("valid")) else 0.25) if issuer else 0
    if tls.get("intercepted"):
        ctx.note(INTERCEPTED_NOTE.format(issuer=issuer))
        result["_signal"] = signal(0, "infrastructure", evaluated=False)
        return result
    result["_signal"] = signal(risk, "infrastructure", indicators, evaluated=bool(issuer))
    return result


# --- Certificate anomalies -------------------------------------------------------------------------


def _check(id_, title, severity, status, detail, expected, actual):
    return {"id": id_, "title": title, "severity": severity, "status": status, "detail": detail, "expected": expected, "actual": actual}


def _key_label(key: dict) -> str:
    return f"{key['algorithm']} {key['curve'] or key['size']}"


def certificate_anomalies(ctx) -> dict:
    domain = ctx.host
    tls = ctx.tls
    result = base(ctx, domain)
    if not tls.get("reachable"):
        reason = tls.get("error", "No TLS service responded")
        ctx.note(f"Certificate could not be retrieved: {reason}")
        checks = [_check(id_, title, sev, "warn", f"Not evaluated. {reason}.", expected, "Unavailable") for id_, title, sev, expected in [
            ("key", "Key strength", "high", "≥ 2048-bit RSA or ≥ 256-bit ECDSA"), ("expiry", "Validity window", "medium", "More than 21 days remaining"),
            ("mismatch", "Hostname match", "critical", f"SAN contains {domain}"), ("lifetime", "Certificate lifetime", "medium", "30–398 days"),
            ("revocation", "Revocation information", "medium", "OCSP or CRL endpoint"), ("ct", "CT log presence", "high", "≥ 2 SCTs"),
            ("sig", "Signature algorithm", "high", "SHA-256 or stronger"), ("wildcard", "Wildcard scope", "low", "Scoped SANs preferred"),
        ]]
        result.update({
            "score": 0, "summary": f"No certificate could be retrieved for {domain}. {reason}.",
            "cert": {"subject": domain, "issuer": "Unavailable", "serial": "Unavailable", "validFrom": None, "validTo": None, "lifetime": 0, "key": "Unavailable", "sans": []},
            "checks": checks, "failed": len(checks),
        })
        result["_signal"] = signal(0, "infrastructure", evaluated=False)
        return result

    leaf = tls["leaf"]
    key = leaf["key"]
    weak = (key["algorithm"] == "RSA" and key["size"] < 2048) or (key["algorithm"] == "ECDSA" and key["size"] < 256) or key["size"] == 0
    match = tlsinfo.hostname_matches(domain, leaf["sans"])
    remaining = leaf["days_remaining"]
    expired = remaining < 0
    lifetime = leaf["lifetime_days"]
    # Sub-30-day certificates are normal only from ACME CAs; six-day profiles exist since 2025.
    short = lifetime < 30
    very_new = leaf["age_days"] <= 7
    has_revocation = bool(leaf["ocsp_urls"] or leaf["crl_urls"])
    sct_count = len(leaf["scts"])
    weak_hash = (leaf["signature_hash"] or "").lower() in ("md5", "sha1")
    wildcard = any(name.startswith("*.") for name in leaf["sans"])
    checks = [
        _check("key", "Key strength", "high", "fail" if weak else "pass", "The public key is too small to be safe." if weak else f"{_key_label(key)} meets current guidance.", "≥ 2048-bit RSA or ≥ 256-bit ECDSA", _key_label(key)),
        _check("expiry", "Validity window", "medium", "fail" if expired else ("warn" if remaining <= 21 else "pass"), f"The certificate expired {-remaining} days ago." if expired else f"Certificate expires in {remaining} days.", "More than 21 days remaining", f"{remaining} days"),
        _check("mismatch", "Hostname match", "critical", "pass" if match else "fail", "The SAN list covers the visited host." if match else "The certificate was not issued for the visited host.", f"SAN contains {domain}", ", ".join(leaf["sans"][:4]) or "No SANs"),
        _check("lifetime", "Certificate lifetime", "medium", "warn" if short else "pass", f"Issued for {lifetime} days, {leaf['age_days']} days ago." + (" Very recently issued." if very_new else ""), "30–398 days", f"{lifetime} days"),
        _check("revocation", "Revocation information", "medium", "pass" if has_revocation else "warn", "Revocation endpoints are published." if has_revocation else "No OCSP URL or CRL distribution point is embedded.", "OCSP or CRL endpoint", " + ".join(filter(None, ["OCSP" if leaf["ocsp_urls"] else "", "CRL" if leaf["crl_urls"] else ""])) or "None"),
        _check("ct", "CT log presence", "high", "pass" if sct_count >= 2 else "warn", f"{sct_count} signed certificate timestamps embedded.", "≥ 2 SCTs", f"{sct_count} SCTs"),
        _check("sig", "Signature algorithm", "high", "fail" if weak_hash else "pass", "A broken hash protects this signature." if weak_hash else f"Signed with {leaf['signature']}.", "SHA-256 or stronger", leaf["signature"]),
        _check("wildcard", "Wildcard scope", "low", "warn" if wildcard else "pass", "A wildcard covers every host under this domain." if wildcard else "No wildcard coverage on the leaf.", "Scoped SANs preferred", next((name for name in leaf["sans"] if name.startswith("*.")), "Explicit SANs")),
    ]
    if not tls["valid"]:
        checks.insert(0, _check("chain", "Chain validation", "critical", "fail", tls["verify_error"] or "The chain does not validate against public roots.", "Valid chain to a trusted root", "Invalid"))
    penalties = {"critical": 40, "high": 24, "medium": 12, "low": 3}
    score = 100 - sum(penalties[check["severity"]] * (1 if check["status"] == "fail" else 0.45) for check in checks if check["status"] != "pass")
    failed = sum(check["status"] != "pass" for check in checks)
    problems = [check["title"].lower() for check in checks if check["status"] != "pass"]
    result.update({
        "score": int(clamp(score)),
        "summary": f"{failed} of {len(checks)} checks need attention: {', '.join(problems)}." if failed else f"All {len(checks)} anomaly checks passed.",
        "cert": {
            "subject": leaf["subject_cn"] or domain, "issuer": tlsinfo.issuer_name(leaf), "serial": leaf["serial"], "validFrom": to_iso(leaf["not_before"]),
            "validTo": to_iso(leaf["not_after"]), "lifetime": lifetime, "key": _key_label(key), "sans": leaf["sans"][:30],
        },
        "checks": checks,
        "failed": failed,
    })
    indicators, positives = [], []
    if not match:
        indicators.append(indicator("cert-mismatch", "high", "Certificate is for a different domain", "The certificate presented does not cover the visited host.", ", ".join(leaf["sans"][:3])))
    if expired:
        indicators.append(indicator("cert-expired", "high", "Expired certificate", "Browsers warn about expired certificates, and a maintained site would renew it.", f"{-remaining} days ago"))
    elif not tls["valid"] and match:
        indicators.append(indicator("cert-invalid", "high", "Certificate chain is not trusted", tls["verify_error"] or "The chain does not validate.", tlsinfo.issuer_name(leaf)))
    if weak:
        indicators.append(indicator("cert-weak", "high", "Weak certificate key", "The key is below current minimum size.", _key_label(key)))
    if very_new:
        indicators.append(indicator("cert-new", "low", f"Certificate issued {leaf['age_days']} days ago", "Very new certificates are common on disposable phishing hosts, though routine renewals look the same.", tlsinfo.issuer_name(leaf)))
    if tls["valid"]:
        positives.append(f"Certificate chain validates, issued by {tlsinfo.issuer_name(leaf)}")
    # Age and lifetime alone are normal under ACME renewal, so only structural faults carry risk.
    if tls.get("intercepted"):
        ctx.note(INTERCEPTED_NOTE.format(issuer=tlsinfo.issuer_name(leaf)))
        result["_signal"] = signal(0, "infrastructure", evaluated=False)
        return result
    risk = (0 if match else 70) + (55 if expired else 0) + (45 if not tls["valid"] and match and not expired else 0) + (45 if weak else 0) + (35 if weak_hash else 0)
    result["_signal"] = signal(risk, "infrastructure", indicators, positives)
    return result
