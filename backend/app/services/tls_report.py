"""SSL/TLS report for the SSL Checker page."""
import base64
import threading
import time

from ..detectors.certs import CT_LOG_LIST, ct_matches_for, find_ca
from ..net import tlsinfo
from ..net.fetcher import fetch_json
from ..util import clamp, now_iso, to_iso

_lock = threading.Lock()
_log_names: dict = {}
_loaded_at = 0.0
LOG_LIST_TTL = 6 * 3600


def _log_directory() -> dict:
    global _log_names, _loaded_at
    with _lock:
        if not _log_names or time.time() - _loaded_at > LOG_LIST_TTL:
            listing = fetch_json(CT_LOG_LIST, timeout=8)
            if isinstance(listing, dict):
                names = {}
                for operator in listing.get("operators", []):
                    for entry in operator.get("logs", []) + operator.get("tiled_logs", []):
                        names[base64.b64decode(entry["log_id"]).hex()] = (entry.get("description", "Unknown log"), operator.get("name", "Unknown"))
                _log_names, _loaded_at = names, time.time()
        return _log_names


def summarize(ctx) -> dict:
    """Grade the handshake and certificate. Shared with the full scan."""
    def compute():
        tls = ctx.tls
        leaf = tls["leaf"]
        key = leaf["key"]
        score = 100
        if not tls["valid"]:
            score -= 45
        if not tlsinfo.hostname_matches(ctx.host, leaf["sans"]):
            score -= 40
        if leaf["days_remaining"] < 0:
            score -= 45
        elif leaf["days_remaining"] < 21:
            score -= 8
        if tls["protocol"] != "TLS 1.3":
            score -= 8
        if key["algorithm"] == "RSA" and key["size"] < 2048:
            score -= 35
        if len(leaf["scts"]) < 2:
            score -= 10
        if not (leaf["ocsp_urls"] or leaf["crl_urls"]):
            score -= 8
        if (leaf["signature_hash"] or "").lower() in ("md5", "sha1"):
            score -= 30
        score = int(clamp(score, 0, 99))
        grade = "A+" if score > 92 else "A" if score > 85 else "B" if score > 76 else "C" if score > 62 else "D" if score > 40 else "F"
        return {"score": score, "grade": grade}

    return ctx.once("tls_summary", compute)


def build(ctx) -> dict:
    tls = ctx.tls
    lookalikes = len([row for row in ct_matches_for(ctx.host) if not row["domain"].endswith(ctx.domain)])
    if not tls.get("reachable"):
        reason = tls.get("error", "No TLS service responded")
        return {
            "domain": ctx.host, "checkedAt": now_iso(), "live": True, "reachable": False, "score": 0, "grade": "N/A", "health": "at-risk",
            "subject": {"commonName": ctx.host, "organisation": "Unavailable", "organisationalUnit": "—", "locality": "—", "country": "—", "sans": []},
            "issuer": {"name": "Unavailable", "commonName": "Unavailable", "organisation": "Unavailable", "tier": "Unknown", "trust": 0, "country": "—"},
            "validity": {"notBefore": None, "notAfter": None, "daysRemaining": 0, "lifetimeDays": 0, "status": "unavailable"},
            "protocol": "None", "cipher": "None", "key": {"algorithm": "None", "size": 0, "curve": None, "strength": "unknown"}, "signature": "None", "chain": [],
            "ct": {"logged": False, "sctCount": 0, "logs": [], "lookalikes": lookalikes},
            "revocation": {"method": "None", "status": "unknown", "ocspResponder": "None", "checkedAt": now_iso(), "mustStaple": False},
            "findings": [{"severity": "high", "label": "No certificate retrieved", "detail": str(reason)[:240]}],
        }
    leaf = tls["leaf"]
    summary = summarize(ctx)
    key = leaf["key"]
    issuer = tlsinfo.issuer_name(leaf)
    ca = find_ca(issuer)
    remaining = leaf["days_remaining"]
    match = tlsinfo.hostname_matches(ctx.host, leaf["sans"])
    weak = key["algorithm"] == "RSA" and key["size"] < 2048
    directory = _log_directory()
    logs = []
    for sct in leaf["scts"]:
        name, operator = directory.get(sct["log_id"], ("Unknown log", "Unknown"))
        logs.append({"name": name, "operator": operator, "loggedAt": to_iso(sct["timestamp"]), "status": "included"})
    methods = list(filter(None, ["OCSP" if leaf["ocsp_urls"] else None, "CRL" if leaf["crl_urls"] else None]))
    revocation_status = tlsinfo.check_ocsp(tls)

    findings = []
    if tls.get("intercepted"):
        findings.append({"severity": "high", "label": "Certificate replaced by a network firewall", "detail": f"{issuer} re-signed this connection, so the details below describe the firewall's certificate, not the site's. Run the check from an unfiltered network."})
    elif not tls["valid"]:
        findings.append({"severity": "critical", "label": "Chain does not validate", "detail": tls["verify_error"] or "The chain does not reach a trusted root."})
    if not match:
        findings.append({"severity": "critical", "label": "Hostname mismatch", "detail": f"The certificate does not cover {ctx.host}."})
    if remaining < 0:
        findings.append({"severity": "critical", "label": "Certificate expired", "detail": f"Expired {-remaining} days ago."})
    elif remaining < 21:
        findings.append({"severity": "high", "label": "Certificate expires soon", "detail": f"Only {remaining} days remain. Renewal automation may be broken."})
    if revocation_status == "revoked":
        findings.append({"severity": "critical", "label": "Certificate revoked", "detail": "The issuer's OCSP responder reports this certificate as revoked."})
    if weak:
        findings.append({"severity": "critical", "label": "Weak RSA key", "detail": f"{key['size']} bits is below the 2048-bit minimum."})
    elif key["algorithm"] == "RSA" and key["size"] == 2048:
        findings.append({"severity": "info", "label": "RSA 2048-bit key", "detail": "Acceptable today; 3072-bit or ECDSA P-256 is preferred for long-lived certificates."})
    if leaf["scts"]:
        findings.append({"severity": "low", "label": "CT logging verified", "detail": f"{len(leaf['scts'])} signed certificate timestamps are embedded."})
    else:
        findings.append({"severity": "high", "label": "No embedded CT timestamps", "detail": "Unlogged certificates evade monitoring, although some servers deliver timestamps by other means."})
    if not methods:
        findings.append({"severity": "medium", "label": "No revocation information", "detail": "The certificate has neither an OCSP URL nor a CRL distribution point."})
    if tls["valid"] and len(tls["chain"]) >= 2:
        findings.append({"severity": "info", "label": "Chain order correct", "detail": "Leaf and intermediates resolve to a trusted public root."})

    levels = ["Leaf"] + ["Intermediate"] * (len(tls["chain"]) - 2) + (["Root"] if len(tls["chain"]) > 1 else [])
    chain = []
    for level, cert in zip(levels, tls["chain"]):
        chain.append({
            "level": level, "name": cert["subject_cn"] or cert["subject_org"] or "Unknown", "issuer": cert["issuer_cn"] or cert["issuer_org"] or "Unknown", "validTo": to_iso(cert["not_after"]),
            "status": "trusted" if level == "Root" and tls["valid"] else ("valid" if cert["days_remaining"] >= 0 else "expired"), "algorithm": (cert["signature_hash"] or "Unknown").upper(),
        })
    score = summary["score"]
    return {
        "domain": ctx.host, "checkedAt": now_iso(), "live": True, "reachable": True, "score": score, "grade": summary["grade"], "health": "healthy" if score > 88 else "attention" if score > 70 else "at-risk",
        "subject": {"commonName": leaf["subject_cn"] or ctx.host, "organisation": leaf["subject_org"] or "Not stated (domain validated)", "organisationalUnit": leaf["subject_ou"] or "—", "locality": leaf["subject_locality"] or "—", "country": leaf["subject_country"] or "—", "sans": leaf["sans"][:30]},
        "issuer": {"name": issuer, "commonName": leaf["issuer_cn"] or "Unknown", "organisation": leaf["issuer_org"] or issuer, "tier": "OV" if leaf["subject_org"] else "DV", "trust": ca["base"] if ca else 45, "country": leaf["issuer_country"] or "—"},
        "validity": {"notBefore": to_iso(leaf["not_before"]), "notAfter": to_iso(leaf["not_after"]), "daysRemaining": remaining, "lifetimeDays": leaf["lifetime_days"], "status": "expired" if remaining < 0 else ("expiring" if remaining <= 21 else "valid")},
        "protocol": tls["protocol"], "cipher": tls["cipher"],
        "key": {"algorithm": key["algorithm"], "size": key["size"], "curve": key["curve"], "strength": "weak" if weak else ("strong" if key["algorithm"] != "RSA" or key["size"] >= 2048 else "adequate")},
        "signature": leaf["signature"], "chain": chain,
        "ct": {"logged": bool(leaf["scts"]), "sctCount": len(leaf["scts"]), "logs": logs, "lookalikes": lookalikes},
        "revocation": {"method": " + ".join(methods) or "None", "status": revocation_status, "ocspResponder": leaf["ocsp_urls"][0] if leaf["ocsp_urls"] else "None", "checkedAt": now_iso(), "mustStaple": leaf["must_staple"]},
        "findings": findings,
    }
