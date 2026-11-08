"""Backend responses must keep the object shapes the React pages render.

The fixture is the output of the frontend's original mock engines. Run with: pytest -q
Set LIVE_TARGET=off to skip tests that need internet access.
"""
import io
import json
import os
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

os.environ.setdefault("ALLOW_MOCK_DB", "true")
os.environ.setdefault("MONGO_URI", "mongodb://127.0.0.1:1")
os.environ["ENABLE_CT_WATCH"] = "false"
os.environ["RATE_LIMIT_PER_MINUTE"] = "1000"

from app.main import app  # noqa: E402

CONTRACT = json.loads((Path(__file__).parent / "fixtures" / "contract.json").read_text())
# Optional or data-dependent fields: a real result can legitimately be null here.
NULLABLE = {"ageDays", "created", "daysRemaining", "validFrom", "validTo", "since", "accountAgeDays", "gstin", "website", "firstSeen", "notBefore", "notAfter", "lastSeen", "curve", "value"}
TARGETS = {
    "certificate-transparency": "github.com", "ca-reputation": "github.com", "certificate-anomalies": "github.com", "visual-similarity": "https://github.com/login", "typosquatting": "github.com",
    "security-configuration": "https://github.com", "redirect-chain": "http://github.com", "cloaking": "https://github.com", "phishing-kits": "https://github.com/login", "favicon-logo-hash": "https://github.com",
    "javascript-behaviour": "https://github.com/login", "hosting-fingerprint": "github.com", "upi-qr": "upi://pay?pa=sbi.refund@ybl&pn=SBI%20Refund%20Desk&am=4999&tn=KYC%20cashback%20claim",
}
OFFLINE_TARGETS = {slug: ("https://paypal-secure-login.example/session/verify" if target.startswith("http") else ("paypal-secure-login.example" if slug != "upi-qr" else target)) for slug, target in TARGETS.items()}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def compare(expected, actual, path=""):
    errors = []
    if isinstance(expected, dict):
        if not isinstance(actual, dict):
            return [f"{path}: expected object, got {type(actual).__name__}"]
        for key, value in expected.items():
            if key not in actual:
                errors.append(f"{path}.{key}: missing")
            elif actual[key] is None:
                if key not in NULLABLE and value is not None:
                    errors.append(f"{path}.{key}: null")
            else:
                errors += compare(value, actual[key], f"{path}.{key}")
    elif isinstance(expected, list):
        if not isinstance(actual, list):
            return [f"{path}: expected array, got {type(actual).__name__}"]
        if expected and actual:
            errors += compare(expected[0], actual[0], f"{path}[0]")
    elif expected is not None and isinstance(expected, (int, float)) and not isinstance(expected, bool):
        if not isinstance(actual, (int, float)) or isinstance(actual, bool):
            errors.append(f"{path}: expected number, got {actual!r}")
    elif isinstance(expected, bool):
        if not isinstance(actual, bool):
            errors.append(f"{path}: expected boolean, got {actual!r}")
    elif isinstance(expected, str) and not isinstance(actual, str):
        errors.append(f"{path}: expected string, got {actual!r}")
    return errors


LIVE = os.getenv("LIVE_TARGET", "on") != "off"


@pytest.mark.parametrize("slug", sorted(OFFLINE_TARGETS))
def test_unresolvable_target_keeps_shape(client, slug):
    response = client.post(f"/api/detect/{slug}", json={"target": OFFLINE_TARGETS[slug], "fresh": True})
    assert response.status_code == 200, response.text
    assert compare(CONTRACT[slug], response.json(), slug) == []


@pytest.mark.skipif(not LIVE, reason="needs internet")
@pytest.mark.parametrize("slug", sorted(TARGETS))
def test_live_target_keeps_shape(client, slug):
    response = client.post(f"/api/detect/{slug}", json={"target": TARGETS[slug], "fresh": True})
    assert response.status_code == 200, response.text
    assert compare(CONTRACT[slug], response.json(), slug) == []


@pytest.mark.parametrize("url", ["https://paypal-secure-login.example/session/verify"] + (["https://github.com"] if LIVE else []))
def test_scan_keeps_shape(client, url):
    response = client.post("/api/scan", json={"url": url, "fresh": True})
    assert response.status_code == 200, response.text
    assert compare(CONTRACT["scan"], response.json(), "scan") == []


@pytest.mark.parametrize("target", ["paypal-secure-login.example"] + (["github.com"] if LIVE else []))
def test_ssl_and_assessment_keep_shape(client, target):
    ssl_response = client.post("/api/ssl", json={"target": target})
    assert compare(CONTRACT["ssl"], ssl_response.json(), "ssl") == []
    assessment = client.post("/api/assessment", json={"target": target})
    assert compare(CONTRACT["assessment"], assessment.json(), "assessment") == []


@pytest.mark.parametrize("target", ["http://localhost/", "http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data", "http://10.0.0.1/", "http://[::1]/", "ftp://example.com", "javascript:alert(1)", "http://corp.internal/"])
def test_private_targets_rejected(client, target):
    assert client.post("/api/scan", json={"url": target}).status_code == 422


def test_ssrf_blocked_for_public_name_with_private_answer(monkeypatch):
    from app.net import fetcher

    monkeypatch.setattr(fetcher.socket, "getaddrinfo", lambda *args, **kwargs: [(2, 1, 6, "", ("127.0.0.1", 443))])
    result = fetcher.fetch("https://rebind.test/")
    assert result.blocked and result.status == 0


def test_lookalike_engine():
    from app.detectors.common import assess_lookalike

    assert assess_lookalike("sbi-oniine.com", "sbi-onIine.com")["brand"] == "State Bank of India"
    assert assess_lookalike("xn--pypal-4ve.com")["technique"] == "Unicode homoglyph"
    assert assess_lookalike("paypa1.com")["technique"] == "ASCII homoglyph"
    assert assess_lookalike("github.com")["official"] is True
    assert assess_lookalike("applebees.com")["risk"] == 0
    assert assess_lookalike("glthub.com")["brand"] == "GitHub"
    for ordinary in ("cloud-hosting.top", "finance-news.com", "email-tips.net"):
        assert assess_lookalike(ordinary)["brand"] is None, ordinary


def test_shared_ip_rule_ignores_cdns(client):
    from types import SimpleNamespace

    from app.db import get_db
    from app.detectors.hosting import _neighbours
    from app.util import utcnow

    db = get_db()
    db.dns_history.insert_one({"domain": "bad-site.test", "host": "www.bad-site.test", "ips": ["198.18.5.5"], "asn": "13335", "seenAt": utcnow()})
    db.scans.insert_one({"scanId": "T", "domain": "www.bad-site.test", "url": "https://www.bad-site.test/", "verdict": "malicious", "riskScore": 90, "createdAt": utcnow()})
    ctx = SimpleNamespace(domain="innocent.test")
    assert _neighbours(ctx, ["198.18.5.5"], is_shared_network=True)["malicious"] == 0
    assert _neighbours(ctx, ["198.18.5.5"], is_shared_network=False)["malicious"] == 1
    db.scans.delete_one({"scanId": "T"})
    db.dns_history.delete_one({"domain": "bad-site.test"})


def test_firewall_certificate_is_not_blamed_on_the_site():
    from types import SimpleNamespace

    from app.detectors.certs import certificate_anomalies
    from app.util import utcnow

    now = utcnow()
    leaf = {
        "issuer_org": "Fortinet", "issuer_cn": "FG4H0", "issuer_country": "US", "subject_cn": "x.test", "subject_org": None, "serial": "01", "not_before": now, "not_after": now, "lifetime_days": 90, "age_days": 1, "days_remaining": 89,
        "key": {"algorithm": "RSA", "size": 2048, "curve": None}, "signature": "sha256WithRSAEncryption", "signature_hash": "sha256", "sans": ["x.test"], "scts": [], "ocsp_urls": [], "crl_urls": [], "self_signed": False,
    }
    tls = {"reachable": True, "valid": False, "intercepted": True, "verify_error": "unable to get local issuer certificate", "leaf": leaf, "chain": [leaf]}
    notes = []
    ctx = SimpleNamespace(host="x.test", domain="x.test", tls=tls, note=notes.append)
    result = certificate_anomalies(ctx)
    assert result["_signal"]["risk"] == 0 and result["_signal"]["evaluated"] is False
    assert notes and "firewall" in notes[0]


def test_upi_scam_link_is_flagged(client):
    result = client.post("/api/detect/upi-qr", json={"target": TARGETS["upi-qr"], "fresh": True}).json()
    assert result["score"] > 55
    assert any(check["label"] == "Beneficiary name match" and check["status"] == "fail" for check in result["checks"])


def test_qr_upload_round_trip(client):
    encoder = cv2.QRCodeEncoder.create()
    matrix = encoder.encode("upi://pay?pa=merchant@okhdfcbank&pn=Merchant&mc=5411")
    enlarged = cv2.resize(matrix, None, fx=8, fy=8, interpolation=cv2.INTER_NEAREST)
    padded = cv2.copyMakeBorder(enlarged, 40, 40, 40, 40, cv2.BORDER_CONSTANT, value=255)
    buffer = io.BytesIO()
    Image.fromarray(np.uint8(padded)).save(buffer, format="PNG")
    response = client.post("/api/upi/qr", files={"file": ("qr.png", buffer.getvalue(), "image/png")})
    assert response.status_code == 200, response.text
    assert response.json()["vpa"] == "merchant@okhdfcbank"
    assert response.json()["qr"]["detected"] is True


def test_auth_flow(client):
    created = client.post("/api/auth/signup", json={"name": "Test", "email": "t@example.com", "password": "longenough1"})
    assert created.status_code == 201
    token = created.json()["token"]
    assert "password" not in created.json()["user"]
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()["user"]["email"] == "t@example.com"
    assert client.post("/api/auth/login", json={"email": "t@example.com", "password": "wrong-password"}).status_code == 401
    assert client.post("/api/auth/signup", json={"name": "Test", "email": "t@example.com", "password": "longenough1"}).status_code == 409
    assert client.get("/api/auth/me").status_code == 401


def test_report_dashboard_threats(client):
    report = client.post("/api/reports", data={"url": "https://sbi-kyc-verify.example/x", "category": "phishing", "description": "This page asked for my OTP and card details."})
    assert report.status_code == 201, report.text
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["recentReports"][0]["id"] == report.json()["id"]
    assert {"overviewStats", "dailyDetections", "riskBreakdown", "scanHistory", "activityFeed"} <= set(dashboard)
    feed = client.get("/api/threats").json()
    assert feed["records"] and all({"id", "indicator", "type", "severity"} <= set(row) for row in feed["records"])
