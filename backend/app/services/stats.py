"""Aggregates for the dashboard and threat-intelligence pages, computed from stored records."""
from collections import Counter
from datetime import timedelta

from ..db import get_db, public
from ..detectors.certs import ct_matches_for
from ..detectors.content import cluster_campaigns
from ..util import load_json, to_iso, utcnow

DISTRIBUTION_COLORS = {"Phishing": "var(--critical)", "Brand Impersonation": "var(--high)", "Fake Banking Website": "var(--high)", "Payment Fraud": "var(--medium)", "Malware": "var(--low)"}


def _aware(value):
    return value if value.tzinfo else value.replace(tzinfo=utcnow().tzinfo)


def _scan_row(row: dict) -> dict:
    is_ip = row["domain"].replace(".", "").isdigit()
    target = row["url"].split("://", 1)[-1].rstrip("/")
    return {"id": row["scanId"], "target": target, "type": "IP" if is_ip else "URL", "verdict": row["verdict"], "score": row["riskScore"], "findings": row["findings"], "scannedAt": row["scannedAt"], "source": row.get("source", "Manual scan")}


def _delta(current: int, previous: int) -> float:
    return round((current - previous) / previous * 100, 1) if previous else (100.0 if current else 0.0)


def _spark(rows: list[dict], now, predicate=lambda row: True) -> list[int]:
    return [sum(1 for row in rows if predicate(row) and day <= (now - _aware(row["createdAt"])).days < day + 3) for day in range(33, -3, -3)]


def _overview(scans: list[dict], reports: list[dict], now) -> list[dict]:
    window = now - timedelta(days=30)
    earlier = now - timedelta(days=60)
    def count(items, predicate=lambda row: True):
        current = sum(1 for row in items if _aware(row["createdAt"]) >= window and predicate(row))
        previous = sum(1 for row in items if earlier <= _aware(row["createdAt"]) < window and predicate(row))
        return current, previous
    def stat(id_, label, items, predicate, hint, tone=None):
        current, previous = count(items, predicate)
        total = sum(1 for row in items if predicate(row))
        delta = _delta(current, previous)
        return {"id": id_, "label": label, "value": total, "delta": delta, "trend": "up" if delta >= 0 else "down", "hint": hint, "spark": _spark(items, now, predicate), **({"tone": tone} if tone else {})}
    safe_share = sum(row["verdict"] == "safe" for row in scans) / len(scans) * 100 if scans else 0
    return [
        stat("scanned", "Total URLs Scanned", scans, lambda row: True, "vs. previous 30 days"),
        stat("malicious", "Malicious Websites Detected", scans, lambda row: row["verdict"] == "malicious", "confirmed by multiple signals", "critical"),
        stat("suspicious", "Suspicious Websites", scans, lambda row: row["verdict"] == "suspicious", "require review", "medium"),
        stat("safe", "Safe Websites", scans, lambda row: row["verdict"] == "safe", f"{safe_share:.1f}% of total", "safe"),
        stat("reported", "Reported Threats", reports, lambda row: True, "submitted by the community", "low"),
    ]


def _distribution(threats: list[dict]) -> list[dict]:
    counts = Counter(row["category"] for row in threats)
    total = sum(counts.values()) or 1
    top = counts.most_common(4)
    rows = [{"label": label, "value": round(count / total * 100), "color": DISTRIBUTION_COLORS.get(label, "var(--low)")} for label, count in top]
    other = 100 - sum(row["value"] for row in rows)
    if threats and other > 0:
        rows.append({"label": "Other", "value": other, "color": "var(--ink-3)"})
    return rows


def dashboard_payload(user: dict | None) -> dict:
    db = get_db()
    now = utcnow()
    scans = list(db.scans.find({}, {"report": 0}).sort("createdAt", -1).limit(5000))
    reports = list(db.reports.find().sort("createdAt", -1).limit(1000))
    threats = list(db.threats.find())
    daily = []
    for offset in range(13, -1, -1):
        day = (now - timedelta(days=offset)).date()
        todays = [row for row in scans if _aware(row["createdAt"]).date() == day]
        daily.append({"day": day.strftime("%b %d"), "safe": sum(row["verdict"] == "safe" for row in todays), "suspicious": sum(row["verdict"] == "suspicious" for row in todays), "malicious": sum(row["verdict"] == "malicious" for row in todays)})
    total = len(scans)
    bands = [("Critical", "critical", lambda s: s >= 85), ("High", "high", lambda s: 65 <= s < 85), ("Medium", "medium", lambda s: 33 <= s < 65), ("Low", "low", lambda s: 15 <= s < 33), ("Clean", "safe", lambda s: s < 15)]
    breakdown = [{"label": label, "value": sum(test(row["riskScore"]) for row in scans), "total": total, "tone": tone} for label, tone, test in bands]
    user_id = user["id"] if user else None
    recent_reports = [
        {"id": row["id"], "target": row["target"], "category": row["category"], "status": row["status"], "submittedAt": row["submittedAt"], "reporter": "You" if user_id and row.get("userId") == user_id else row.get("reporter", "anon_report")}
        for row in reports[:8]
    ]
    activity = [{"id": row["scanId"], "actor": "You" if user_id and row.get("userId") == user_id else row.get("source", "Manual scan"), "action": f"scanned and rated {row['verdict']}", "target": row["domain"], "time": row["scannedAt"], "kind": "scan"} for row in scans[:6]]
    activity += [{"id": str(row["_id"]), "actor": "Automated monitor", "action": row["title"].split(":")[0].lower(), "target": row.get("domain", ""), "time": row["time"], "kind": "alert"} for row in db.ct_alerts.find().sort("time", -1).limit(6)]
    activity += [{"id": row["id"], "actor": "You" if user_id and row.get("userId") == user_id else row.get("reporter", "anon_report"), "action": "submitted a threat report for", "target": row["target"], "time": row["submittedAt"], "kind": "report"} for row in reports[:4]]
    activity.sort(key=lambda item: item["time"], reverse=True)
    watch = []
    if user_id:
        for row in db.watchlist.find({"userId": user_id}):
            lookalikes = ct_matches_for(row["domain"])
            watch.append({"domain": row["domain"], "brand": row["brand"], "alerts": len(lookalikes), "lookalikes": len(lookalikes), "status": "protected" if not lookalikes else "monitoring"})
    return {
        "live": True, "overviewStats": _overview(scans, reports, now), "dailyDetections": daily, "threatDistribution": _distribution(threats), "riskBreakdown": breakdown,
        "scanHistory": [_scan_row(row) for row in scans[:50]], "recentReports": recent_reports, "activityFeed": activity[:12], "watchlist": watch,
    }


def _ago(value: str | None, now) -> str:
    if not value:
        return "unknown"
    from datetime import datetime

    seconds = (now - datetime.fromisoformat(value.replace("Z", "+00:00"))).total_seconds()
    if seconds < 3600:
        return f"{max(int(seconds // 60), 1)} min ago"
    if seconds < 86400:
        return f"{int(seconds // 3600)} hrs ago"
    return f"{int(seconds // 86400)} days ago"


def threat_payload() -> dict:
    db = get_db()
    now = utcnow()
    records = [public(row) for row in db.threats.find().sort("lastSeen", -1).limit(1000)]
    reports = list(db.reports.find().sort("createdAt", -1).limit(500))
    categories = load_json("seed_threats.json")["categories"]
    counts = Counter(row.get("categoryId", "other") for row in records)
    def iso_age(row, field):
        from datetime import datetime

        return (now - datetime.fromisoformat(row[field].replace("Z", "+00:00"))).total_seconds() / 86400
    campaigns = cluster_campaigns()
    alias_counts = Counter(row.get("reporter", "anon_report") for row in reports)
    confirmed_counts = Counter(row.get("reporter", "anon_report") for row in reports if row.get("status") == "confirmed")
    leaderboard = []
    for alias, total in alias_counts.most_common(4):
        accuracy = round(confirmed_counts[alias] / total * 100)
        leaderboard.append({"alias": alias, "reports": total, "accuracy": accuracy, "badge": "Gold" if total >= 25 else "Silver" if total >= 5 else "Bronze"})
    activity = []
    for offset in range(13, -1, -1):
        day = now - timedelta(days=offset)
        window = [row for row in records if offset <= iso_age(row, "lastSeen") < offset + 1]
        activity.append({
            "date": to_iso(day), "phishing": sum("phish" in row["category"].lower() or "bank" in row["category"].lower() for row in window),
            "malware": sum(row["category"] == "Malware" for row in window), "impersonation": sum("impersonation" in row["category"].lower() for row in window),
        })
    return {
        "live": True,
        "records": records,
        "stats": {
            "totalIndicators": len(records), "totalReports": sum(row.get("reports", 0) for row in records) + len(reports), "activeCampaigns": len(campaigns),
            "takedowns7d": sum(row.get("status") == "takedown" and iso_age(row, "lastSeen") <= 7 for row in records), "reporters": len(alias_counts),
            "new24h": sum(iso_age(row, "firstSeen") <= 1 for row in records),
        },
        "categories": [{**category, "count": counts.get(category["id"], 0)} for category in categories],
        "activity14d": activity,
        "campaigns": campaigns,
        "leaderboard": leaderboard,
        "communityReports": [{"id": row["id"], "target": row["target"], "category": row["category"], "status": "review" if row["status"] == "under review" else row["status"], "time": _ago(row["submittedAt"], now), "reporter": row.get("reporter", "anon_report")} for row in reports[:5]],
    }
