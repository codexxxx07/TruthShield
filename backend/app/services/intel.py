"""Threat-intelligence lookups across the local database, community reports and public feeds."""
import logging
import threading
import urllib.request
from urllib.parse import urlsplit

from ..config import DATA_DIR
from ..db import get_db
from ..util import now_iso, registrable, tranco_ranks

log = logging.getLogger("truthshield.intel")
OPENPHISH_URL = "https://openphish.com/feed.txt"
_feed_lock = threading.Lock()
_feed: dict = {"urls": set(), "domains": set(), "updated": None}


def _ingest(urls: list[str]) -> None:
    popular = tranco_ranks()
    domains = {registrable(urlsplit(url).hostname or "") for url in urls}
    # Phishing on a popular shared platform must not condemn the platform itself.
    domains = {domain for domain in domains if domain and popular.get(domain, 10 ** 9) > 100_000}
    with _feed_lock:
        _feed.update(urls=set(urls), domains=domains, updated=now_iso())


def load_cached_feed() -> None:
    path = DATA_DIR / "training" / "openphish.txt"
    if path.exists():
        _ingest([line.strip() for line in path.read_text(errors="ignore").splitlines() if line.startswith("http")])


def refresh_feed() -> int:
    try:
        request = urllib.request.Request(OPENPHISH_URL, headers={"User-Agent": "TruthShield/1.0"})
        with urllib.request.urlopen(request, timeout=30) as response:
            urls = [line.strip() for line in response.read().decode(errors="ignore").splitlines() if line.startswith("http")]
    except OSError as error:
        log.info("OpenPhish refresh failed: %s", error)
        return 0
    if urls:
        _ingest(urls)
    return len(urls)


def lookup(ctx) -> dict:
    db = get_db()
    candidates = list({ctx.host, ctx.domain, *ctx.dns["a"]})
    # Records created by our own verdicts are excluded, or one mistake would confirm itself on re-scan.
    threat = db.threats.find_one({"indicator": {"$in": candidates}, "source": {"$ne": "Automated crawl"}})
    reports = list(db.reports.find({"domain": ctx.domain}))
    confirmed = [row for row in reports if row.get("status") == "confirmed"]
    earlier = db.scans.find_one({"domain": ctx.domain, "verdict": {"$in": ["malicious", "suspicious"]}}, sort=[("createdAt", -1)])
    with _feed_lock:
        feed_hit = ctx.url in _feed["urls"] or ctx.domain in _feed["domains"]
        feed_ready = bool(_feed["urls"])
        feed_updated = _feed["updated"]
    rank = tranco_ranks().get(ctx.domain)

    sources = []
    if threat:
        status = "malicious" if threat.get("severity") in ("critical", "high") else "suspicious"
        sources.append({"source": "TruthShield Threat Database", "status": status, "confidence": threat.get("confidence", 70), "lastSeen": threat.get("lastSeen")})
    else:
        sources.append({"source": "TruthShield Threat Database", "status": "clean", "confidence": 60, "lastSeen": now_iso()})
    if reports:
        sources.append({"source": "Community Reports", "status": "malicious" if confirmed else "suspicious", "confidence": 90 if confirmed else min(45 + len(reports) * 10, 80), "lastSeen": reports[-1].get("submittedAt")})
    else:
        sources.append({"source": "Community Reports", "status": "unrated", "confidence": 0, "lastSeen": None})
    sources.append(
        {"source": "OpenPhish Feed", "status": "malicious" if feed_hit else ("clean" if feed_ready else "unrated"), "confidence": 95 if feed_hit else (60 if feed_ready else 0), "lastSeen": feed_updated}
    )
    if earlier:
        sources.append({"source": "Earlier TruthShield Scans", "status": earlier["verdict"], "confidence": earlier.get("riskScore", 50), "lastSeen": earlier.get("scannedAt")})
    else:
        sources.append({"source": "Earlier TruthShield Scans", "status": "unrated", "confidence": 0, "lastSeen": None})
    sources.append({"source": "Tranco Popular Sites", "status": "clean" if rank else "unrated", "confidence": 85 if rank and rank <= 20000 else (55 if rank else 0), "lastSeen": None})

    return {"sources": sources, "threat": threat, "reports": reports, "confirmed": confirmed, "feed_hit": feed_hit, "rank": rank}
