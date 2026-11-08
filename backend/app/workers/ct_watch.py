"""Background Certificate Transparency watcher.

Tails the newest entries of live RFC 6962 logs, extracts every certificate's domain names and records
those that impersonate a monitored brand or a watched domain.
"""
import base64
import logging
import threading
import time

from cryptography import x509

from ..db import get_db
from ..detectors.common import assess_lookalike, levenshtein
from ..net.fetcher import fetch_json
from ..net.tlsinfo import parse_certificate
from ..services import intel
from ..util import now_iso, registrable, to_iso, utcnow
from .. import detectors  # noqa: F401  (loads detector modules before the thread starts)

log = logging.getLogger("truthshield.ct")
LOG_LIST = "https://www.gstatic.com/ct/log_list/v3/log_list.json"
OPERATORS = ("Google", "Cloudflare", "DigiCert", "Sectigo")
POLL_SECONDS = 20
BATCH = 256
START_BEHIND = 512
MIN_MATCH_RISK = 80
FEED_REFRESH_SECONDS = 3600


def parse_leaf(entry: dict) -> tuple[list[str], str, object] | None:
    """Return (names, issuer, not_before) from one get-entries record."""
    leaf = base64.b64decode(entry["leaf_input"])
    entry_type = int.from_bytes(leaf[10:12], "big")
    if entry_type == 0:
        length = int.from_bytes(leaf[12:15], "big")
        der = leaf[15:15 + length]
    elif entry_type == 1:
        extra = base64.b64decode(entry["extra_data"])
        length = int.from_bytes(extra[:3], "big")
        der = extra[3:3 + length]
    else:
        return None
    try:
        parsed = parse_certificate(der)
    except (ValueError, x509.UnsupportedGeneralNameType):
        return None
    names = set(parsed["sans"])
    if parsed["subject_cn"]:
        names.add(parsed["subject_cn"])
    return sorted(name.lower().lstrip("*.") for name in names), parsed["issuer_org"] or parsed["issuer_cn"] or "Unknown", parsed["not_before"]


def match_name(name: str, watched: list[str]) -> dict | None:
    if not name or "." not in name:
        return None
    assessment = assess_lookalike(name)
    if assessment["official"]:
        return None
    if assessment["risk"] >= MIN_MATCH_RISK:
        return {"brand": assessment["brand"], "similarity": assessment["risk"], "technique": assessment["technique"], "matched_domain": None}
    domain = registrable(name)
    for item in watched:
        if domain == item:
            continue
        label, watched_label = domain.split(".")[0], item.split(".")[0]
        if len(watched_label) >= 4 and (watched_label in label or levenshtein(label, watched_label, 2) <= 1):
            return {"brand": item, "similarity": 85, "technique": "Watchlist lookalike", "matched_domain": item}
    return None


def process_entries(entries: list[dict], watched: list[str], log_name: str) -> int:
    db = get_db()
    hits = 0
    for entry in entries:
        parsed = parse_leaf(entry)
        if not parsed:
            continue
        names, issuer, not_before = parsed
        for name in names:
            match = match_name(name, watched)
            if not match:
                continue
            cert_id = f"{name}|{issuer}|{to_iso(not_before)}"
            result = db.ct_matches.update_one(
                {"cert_id": cert_id},
                {"$setOnInsert": {
                    "cert_id": cert_id, "domain": name, "brand": match["brand"], "matched_domain": match["matched_domain"], "similarity": match["similarity"], "technique": match["technique"],
                    "issuer": issuer, "issued": to_iso(not_before), "log": log_name, "seenAt": utcnow(),
                }},
                upsert=True,
            )
            if result.upserted_id is not None:
                hits += 1
                db.ct_alerts.insert_one({
                    "severity": "high", "title": f"Lookalike certificate: {name}", "detail": f"{issuer} issued a certificate for {name}, which imitates {match['brand']} ({match['technique'].lower()}).",
                    "domain": name, "brand": match["brand"], "time": now_iso(),
                })
    return hits


def _usable_logs() -> list[dict]:
    listing = fetch_json(LOG_LIST, timeout=15)
    logs = []
    if isinstance(listing, dict):
        for operator in listing.get("operators", []):
            if operator.get("name") in OPERATORS:
                usable = [item for item in operator.get("logs", []) if "usable" in item.get("state", {})]
                logs.extend({"name": item.get("description", item["url"]), "url": item["url"]} for item in usable[:1])
    return logs


def poll_log(item: dict) -> int:
    db = get_db()
    head = fetch_json(f"{item['url']}ct/v1/get-sth", timeout=8)
    if not isinstance(head, dict):
        return 0
    size = head.get("tree_size", 0)
    state = db.ct_log_state.find_one({"log_url": item["url"]})
    start = max(state["next_index"], size - START_BEHIND * 8) if state else max(0, size - START_BEHIND)
    if start >= size:
        return 0
    end = min(start + BATCH - 1, size - 1)
    data = fetch_json(f"{item['url']}ct/v1/get-entries?start={start}&end={end}", timeout=15)
    entries = data.get("entries", []) if isinstance(data, dict) else []
    if not entries:
        return 0
    watched = [row["domain"] for row in db.watchlist.find({}, {"domain": 1})]
    hits = process_entries(entries, watched, item["name"])
    db.ct_log_state.update_one(
        {"log_url": item["url"]},
        {"$set": {"log_url": item["url"], "name": item["name"], "next_index": start + len(entries), "tree_size": size, "scanned": (state or {}).get("scanned", 0) + len(entries), "updatedAt": now_iso()}},
        upsert=True,
    )
    return hits


def _loop(stop: threading.Event) -> None:
    logs = _usable_logs()
    log.info("Certificate log watcher tailing %d logs", len(logs))
    last_feed = 0.0
    while not stop.is_set():
        for item in logs:
            if stop.is_set():
                return
            try:
                poll_log(item)
            except Exception:
                log.exception("CT poll failed for %s", item["name"])
        if time.time() - last_feed > FEED_REFRESH_SECONDS:
            intel.refresh_feed()
            last_feed = time.time()
        stop.wait(POLL_SECONDS)


def start() -> threading.Event:
    stop = threading.Event()
    threading.Thread(target=_loop, args=(stop,), name="ct-watch", daemon=True).start()
    return stop
