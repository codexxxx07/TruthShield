"""Module 12: hosting fingerprint."""
import socket
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from ..db import get_db
from ..net import dnsinfo
from ..net.fetcher import BlockedTarget, is_public_ip
from ..util import clamp, load_json, now_iso, registrable, to_iso, utcnow
from .common import base, indicator, signal

HOSTING = load_json("hosting.json")
FREE_SUFFIXES = tuple(HOSTING["free_hosting_suffixes"])
PORTS = [(443, "HTTPS"), (80, "HTTP"), (22, "SSH"), (3306, "MySQL")]
HISTORY_DAYS = 7
FAST_FLUX_IPS = 5
# Above this many tenants an IP is mass hosting, so one bad neighbour says little about the rest.
MAX_MEANINGFUL_NEIGHBOURS = 25


def _port_state(ip: str, port: int, https_up: bool) -> str:
    try:
        if not is_public_ip(ip):
            raise BlockedTarget(ip)
        with socket.create_connection((ip, port), timeout=2):
            return "redirect" if port == 80 and https_up else "open"
    except TimeoutError:
        return "filtered"
    except (OSError, BlockedTarget):
        return "closed"


def _record_history(ctx, addresses: list[str], number: str | None, ttl: int | None) -> list[dict]:
    db = get_db()
    since = utcnow() - timedelta(days=HISTORY_DAYS)
    history = list(db.dns_history.find({"domain": ctx.domain, "seenAt": {"$gte": since}}))
    if addresses:
        db.dns_history.insert_one({"domain": ctx.domain, "host": ctx.host, "ips": addresses, "asn": number, "ttl": ttl, "seenAt": utcnow()})
    return history


def _neighbours(ctx, addresses: list[str], is_shared_network: bool) -> dict:
    """What TruthShield knows about other domains and indicators on the same IPs."""
    db = get_db()
    history = [row for row in db.dns_history.find({"ips": {"$in": addresses}}) if row["domain"] != ctx.domain] if addresses else []
    peers = {row["domain"] for row in history}
    # CDN addresses are shared by unrelated customers, so sharing one is not evidence of anything.
    malicious_domains = set()
    if peers and not is_shared_network and len(peers) <= MAX_MEANINGFUL_NEIGHBOURS:
        hosts = list({row["host"] for row in history})
        malicious_domains = {registrable(row["domain"]) for row in db.scans.find({"domain": {"$in": hosts}, "verdict": "malicious"})}
    direct = list(db.threats.find({"indicator": {"$in": addresses}})) if addresses else []
    categories = sorted({row["category"] for row in direct} | ({"Phishing"} if malicious_domains else set()))
    neighbour_rows = []
    prefixes = {address.rsplit(".", 1)[0] for address in addresses if ":" not in address}
    for prefix in prefixes:
        for row in db.threats.find({"type": "ip", "indicator": {"$regex": f"^{prefix.replace('.', chr(92) + '.')}\\."}}).limit(4):
            neighbour_rows.append({"ip": row["indicator"], "domains": row.get("reports", 0), "risk": row.get("severity", "medium"), "note": row.get("category", "Reported indicator")})
    for domain in sorted(malicious_domains)[:3]:
        neighbour_rows.append({"ip": addresses[0], "domains": 1, "risk": "high", "note": f"Shares this IP with {domain}"})
    return {"total": len(peers), "malicious": len(malicious_domains) + len(direct), "categories": categories, "rows": neighbour_rows[:5], "direct": direct}


def hosting_fingerprint(ctx) -> dict:
    records = ctx.dns
    asn = ctx.asn
    addresses = records["a"] + records["aaaa"]
    result = base(ctx, ctx.host)
    if not records["resolves"]:
        ctx.note("The domain does not resolve in public DNS, so hosting could not be fingerprinted.")
    primary = records["a"][0] if records["a"] else (records["aaaa"][0] if records["aaaa"] else "None")
    number = asn["number"]
    history = _record_history(ctx, addresses, number, records["ttl"])
    views = dnsinfo.resolver_views(ctx.host) if records["resolves"] else {}
    seen_ips = set(addresses) | {ip for row in history for ip in row["ips"]} | {ip for ips in views.values() for ip in ips}
    seen_asns = {row.get("asn") for row in history if row.get("asn")} | ({number} if number else set())
    is_cdn = number in HOSTING["cdn_asns"]
    low_ttl = records["ttl"] is not None and records["ttl"] < 300
    # Fast flux means many unrelated addresses. Large CDNs rotate IPs too, inside a single network.
    fast_flux = not is_cdn and ((len(seen_ips) >= FAST_FLUX_IPS and low_ttl) or len(seen_asns) >= 3)
    abuse_flag = HOSTING["abuse_flagged_asns"].get(number or "")
    free_hosting = ctx.host.endswith(FREE_SUFFIXES)
    cheap_vps = number in HOSTING["cheap_vps_asns"]
    parked = any(any(marker in server for marker in HOSTING["parking_nameservers"]) for server in records["ns"])
    tld = ctx.domain.rsplit(".", 1)[-1]
    high_abuse_tld = tld in HOSTING["high_abuse_tlds"]
    neighbours = _neighbours(ctx, addresses, is_cdn)
    reverse = dnsinfo.reverse_dns(primary) if primary != "None" else None
    ports = []
    if records["a"]:
        https_up = ctx.tls.get("reachable", False)
        with ThreadPoolExecutor(max_workers=4) as pool:
            states = list(pool.map(lambda item: _port_state(primary, item[0], https_up), PORTS))
        ports = [{"port": port, "service": service, "state": state} for (port, service), state in zip(PORTS, states)]

    tags, indicators, positives = [], [], []
    risk = 0
    if abuse_flag:
        tags.append("Sanctioned hosting provider")
        risk += 75
        indicators.append(indicator("abuse-host", "critical", f"Hosted with {abuse_flag['org']}", abuse_flag["basis"], asn["asn"]))
    if free_hosting:
        tags.append("Free hosting platform")
        risk += 30
        indicators.append(indicator("free-host", "medium", "Hosted on a free platform", "Free site builders let anyone publish a page quickly without verification.", ctx.host))
    if fast_flux:
        tags.append("Rapidly changing DNS")
        risk += 55
        indicators.append(indicator("fast-flux", "high", "Rapidly changing DNS", f"{len(seen_ips)} addresses across {len(seen_asns)} networks were observed for this domain.", ", ".join(sorted(seen_ips)[:4])))
    if neighbours["malicious"]:
        tags.append("Shares IP with flagged sites")
        risk += min(70, 35 + neighbours["malicious"] * 10)
        indicators.append(indicator("shared-ip", "high", "IP shared with known malicious sites", f"{neighbours['malicious']} flagged indicator{'s' if neighbours['malicious'] != 1 else ''} share this address.", primary))
    if parked:
        tags.append("Parked nameservers")
        risk += 12
    if high_abuse_tld:
        tags.append(f"High-abuse TLD .{tld}")
        risk += 16
        indicators.append(indicator("abuse-tld", "medium", f"High-abuse TLD .{tld}", "This top-level domain appears disproportionately in abuse feeds.", f".{tld}"))
    if cheap_vps:
        tags.append("Low-cost VPS network")
        risk += 8
    if is_cdn:
        tags.append(f"{HOSTING['cdn_asns'][number]} network")
    if not tags:
        tags.append("No notable hosting signals")
    if records["resolves"] and records["mx"]:
        positives.append("Domain publishes mail records")
    risk = clamp(risk)

    earliest = min((row["seenAt"] for row in history), default=None)
    db = get_db()
    report_count = db.reports.count_documents({"domain": ctx.domain, "createdAt": {"$gte": utcnow() - timedelta(days=30)}})
    summary_bits = [f"{ctx.host} resolves to {primary} on {asn['org']} ({asn['asn']})." if records["resolves"] else f"{ctx.host} does not resolve in public DNS."]
    if records["resolves"]:
        summary_bits.append(f"{neighbours['total']} other scanned domain{'s' if neighbours['total'] != 1 else ''} share this address, {neighbours['malicious']} flagged.")
    result.update({
        "ip": primary,
        "asn": asn["asn"],
        "org": asn["org"],
        "geo": {"country": asn["country"], "city": "Unknown", "region": asn["countryCode"]},
        "reverse": reverse or "None",
        "dns": {key: records[key] for key in ("a", "aaaa", "mx", "ns", "txt")},
        "shared": {"totalDomains": neighbours["total"], "malicious": neighbours["malicious"], "categories": neighbours["categories"]},
        "neighbours": neighbours["rows"],
        "reputation": {"score": int(risk), "tags": tags, "firstSeen": to_iso(earliest) or now_iso(), "reports30d": report_count},
        "ports": ports,
        "summary": " ".join(summary_bits),
        "fastFlux": {"detected": fast_flux, "addressesSeen": len(seen_ips), "networksSeen": len(seen_asns), "ttl": records["ttl"], "resolverViews": [{"resolver": server, "addresses": ips} for server, ips in views.items()]},
    })
    result["_signal"] = signal(risk, "infrastructure", indicators, positives, evaluated=records["resolves"])
    return result
