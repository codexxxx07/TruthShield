"""Modules 9 and 11: phishing-kit fingerprinting and JavaScript behaviour analysis."""
import hashlib
import math
import re
from urllib.parse import urljoin, urlsplit

import mmh3
import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.feature_extraction.text import HashingVectorizer

from ..db import get_db
from ..ml.model import score_js
from ..net.fetcher import fetch
from ..util import clamp, load_json, now_iso, registrable
from .common import base, indicator, official_brand, signal

KITS = load_json("kits.json")
MAX_ASSETS = 14
SHARED_THRESHOLD = 0.75
_vectorizer = HashingVectorizer(n_features=2 ** 18, analyzer=lambda tokens: tokens, alternate_sign=False, norm="l2")
COMMON_CDN = ("googleapis.com", "gstatic.com", "cloudflare.com", "jsdelivr.net", "unpkg.com", "bootstrapcdn.com", "jquery.com", "fontawesome.com", "cloudfront.net")
LURE_PHRASES = (
    "kyc", "otp", "one time password", "net banking", "pan card", "aadhaar", "atm pin", "account blocked", "mpin", "card number", "cvv", "expiry date",
    "billing address", "seed phrase", "recovery phrase", "connect wallet", "12 word", "airdrop", "sign in to your account", "microsoft", "office 365",
    "stay signed in", "parcel", "redelivery", "delivery fee", "customs", "tracking number", "antibots",
)


def page_tokens(ctx) -> list[str]:
    """Structural tokens for a page: tag shingles, form shape, asset names and lure phrases."""
    soup = ctx.soup
    tokens = []
    tags = [tag.name for tag in soup.find_all(True)][:1500]
    tokens += [f"dom:{a}>{b}>{c}" for a, b, c in zip(tags, tags[1:], tags[2:])]
    for form in soup.find_all("form"):
        action = (form.get("action") or "").split("?")[0].lower()
        if action:
            tokens.append(f"action:{action.rsplit('/', 1)[-1]}")
            tokens += [f"action:{word}" for word in re.findall(r"[a-z]{3,}", action)]
    for field in soup.find_all("input"):
        kind = (field.get("type") or "text").lower()
        name = (field.get("name") or field.get("id") or "").lower()
        tokens.append(f"input:{kind}")
        if name:
            tokens.append(f"input:{name}")
            tokens += [f"input:{word}" for word in re.findall(r"[a-z]{3,}", name)]
    for tag in soup.find_all(["script", "link", "img"]):
        source = tag.get("src") or tag.get("href") or ""
        name = urlsplit(source).path.rsplit("/", 1)[-1].lower()
        if name:
            tokens.append(f"file:{name}")
            tokens += [f"file:{word}" for word in re.findall(r"[a-z]{4,}", name)]
    if len(soup.find_all("form")) == 1:
        tokens.append("structure:single-form")
    text = " ".join(soup.get_text(" ").lower().split())[:30000]
    tokens += [f"text:{phrase}" for phrase in LURE_PHRASES if phrase in text]
    source = " ".join(script["content"][:150000] for script in ctx.scripts).lower()
    for marker in ("api.telegram.org/bot", "sendmessage?chat_id", "chat_id", "discord.com/api/webhooks", "eth_sendtransaction", "setapprovalforall", "wallet_requestpermissions", "aadcdn"):
        if marker in source:
            tokens.append(f"js:{marker}")
    return tokens


def _vector(tokens: list[str]):
    return _vectorizer.transform([tokens]).tocsr()


def _encode(vector) -> dict:
    return {"i": [int(value) for value in vector.indices], "v": [round(float(value), 5) for value in vector.data]}


def _cosine(first: dict, second: dict) -> float:
    left = dict(zip(first["i"], first["v"]))
    return float(sum(left.get(index, 0) * value for index, value in zip(second["i"], second["v"])))


def _kit_similarity(tokens: list[str], kit: dict) -> int:
    present = set(tokens)
    markers = kit["markers"]
    hit = sum(weight for marker, weight in markers.items() if marker in present)
    # A kit is identified by its strongest markers, so score against a realistic share of them.
    top = sum(sorted(markers.values(), reverse=True)[:max(3, len(markers) // 2)])
    return int(clamp(hit / max(top, 1) * 100))


def _assets(ctx) -> list[dict]:
    assets, seen = [], set()
    for script in ctx.scripts:
        if script["external"]:
            assets.append({"asset": urlsplit(script["url"]).path or script["url"], "host": urlsplit(script["url"]).hostname or "", "hash": format(mmh3.hash(script["content"]) & 0xFFFFFFFF, "08x")})
    for tag in ctx.soup.find_all(["link", "img"]):
        source = tag.get("src") or tag.get("href")
        if not source or source.startswith("data:") or source in seen:
            continue
        rel = " ".join(tag.get("rel") or [])
        if tag.name == "link" and "stylesheet" not in rel and "icon" not in rel:
            continue
        seen.add(source)
        if len(assets) >= MAX_ASSETS:
            break
        full = urljoin(ctx.final_url, source)
        response = fetch(full, max_bytes=512 * 1024)
        if response.ok and response.status == 200 and response.body:
            assets.append({"asset": urlsplit(full).path, "host": urlsplit(full).hostname or "", "hash": format(mmh3.hash(response.body) & 0xFFFFFFFF, "08x")})
    return assets[:MAX_ASSETS]


def _layout_positions(count: int) -> list[tuple[int, int]]:
    return [(int(50 + 36 * math.cos(2 * math.pi * index / max(count, 1) - 2.4)), int(50 + 36 * math.sin(2 * math.pi * index / max(count, 1) - 2.4))) for index in range(count)]


def phishing_kits(ctx) -> dict:
    result = base(ctx, f"https://{ctx.host}")
    if not ctx.reachable or not ctx.html:
        ctx.note("Page structure could not be fingerprinted because no HTML was retrieved.")
        result.update({
            "score": 0, "family": "No match", "confidence": 0, "fingerprint": "None", "summary": f"{ctx.host} returned no page to fingerprint.",
            "matches": [], "sharedAssets": [],
            "cluster": {"nodes": [{"id": "root", "label": ctx.host, "type": "target", "x": 50, "y": 50, "risk": "low"}], "edges": []},
        })
        result["_signal"] = signal(0, "phishing", evaluated=False)
        return result

    tokens = page_tokens(ctx)
    vector = _encode(_vector(tokens))
    fingerprint = "fk_" + hashlib.sha256(" ".join(sorted(set(tokens))).encode()).hexdigest()[:12]
    db = get_db()
    official = official_brand(ctx.host) is not None
    assets = _assets(ctx)
    domain = registrable(urlsplit(ctx.final_url).hostname or ctx.host)
    others = [row for row in db.page_fingerprints.find({"registrable": {"$ne": domain}}).limit(3000)]

    matches = []
    for kit in KITS:
        similarity = _kit_similarity(tokens, kit)
        related = sum(row.get("family") == kit["kit"] for row in others)
        matches.append({"kit": kit["kit"], "family": kit["family"], "similarity": similarity, "firstSeen": None, "campaigns": related})
    matches.sort(key=lambda item: item["similarity"], reverse=True)
    best = matches[0]
    has_credentials = any(token in ("input:password", "input:otp", "input:cvv", "input:card") for token in tokens)
    identified = best["similarity"] >= 45 and has_credentials and not official

    neighbours = sorted(((_cosine(vector, row["vector"]), row) for row in others if row.get("vector")), key=lambda pair: pair[0], reverse=True)
    risky_neighbours = [(score, row) for score, row in neighbours if score >= SHARED_THRESHOLD and row.get("suspect")]

    shared = []
    for asset in assets:
        count = db.page_fingerprints.count_documents({"assets": asset["hash"], "registrable": {"$ne": domain}})
        common = asset["host"].endswith(COMMON_CDN)
        severity = "info" if common or count == 0 else ("critical" if count >= 3 else "high")
        shared.append({"asset": asset["asset"][:80], "hash": asset["hash"], "seenOn": count, "severity": severity})
    shared.sort(key=lambda item: item["seenOn"], reverse=True)
    linked_assets = sum(item["severity"] in ("high", "critical") for item in shared)

    similarity_to_seen = risky_neighbours[0][0] if risky_neighbours else 0
    score = 0
    if identified:
        score = int(clamp(best["similarity"] * 0.9 + min(len(risky_neighbours) * 3, 10)))
    if risky_neighbours and not official:
        score = max(score, int(similarity_to_seen * 85))
    if linked_assets and not official:
        score = max(score, min(60 + linked_assets * 8, 90))

    family = best["kit"] if identified else ("Related cluster" if score else "No match")
    db.page_fingerprints.update_one(
        {"registrable": domain},
        {"$set": {
            "registrable": domain, "host": ctx.host, "fingerprint": fingerprint, "vector": vector, "assets": [item["hash"] for item in assets],
            "family": best["kit"] if identified else None, "suspect": score >= 45, "updatedAt": now_iso(),
        }},
        upsert=True,
    )

    nodes = [{"id": "root", "label": ctx.host, "type": "target", "x": 50, "y": 50, "risk": "critical" if score >= 75 else "high" if score >= 45 else "low"}]
    edges = []
    peers = [row for _, row in risky_neighbours[:5]]
    positions = _layout_positions(len(peers) + (1 if identified else 0))
    if identified:
        x, y = positions.pop(0)
        nodes.append({"id": "kit", "label": best["kit"], "type": "kit", "x": x, "y": y, "risk": "high"})
        edges.append(["root", "kit"])
    for index, peer in enumerate(peers):
        x, y = positions[index]
        node_id = f"host{index}"
        nodes.append({"id": node_id, "label": peer.get("host", peer["registrable"]), "type": "host", "x": x, "y": y, "risk": "high"})
        edges.append(["kit" if identified and peer.get("family") == best["kit"] else "root", node_id])

    summary = (
        f"Form structure and page content match the {best['kit']} family ({best['similarity']}%)."
        + (f" {len(peers)} related site{'s' if len(peers) != 1 else ''} seen earlier share this structure." if peers else "")
        if identified else (f"This page closely resembles {len(peers)} earlier suspicious site{'s' if len(peers) != 1 else ''}." if peers else "No known phishing-kit fingerprint matched this page.")
    )
    result.update({
        "score": score, "family": family, "confidence": int(clamp(best["similarity"] * 0.95)) if identified else (int(similarity_to_seen * 100) if peers else 0),
        "fingerprint": fingerprint, "summary": summary, "matches": matches[:3], "sharedAssets": shared[:6], "cluster": {"nodes": nodes, "edges": edges},
    })
    indicators = []
    if identified:
        indicators.append(indicator("kit-match", "high", f"Phishing kit pattern: {best['kit']}", f"Form fields and page content match the {best['family'].lower()} family.", f"{best['similarity']}% structural match"))
    elif risky_neighbours:
        indicators.append(indicator("kit-cluster", "high", "Linked to earlier suspicious sites", "This page's structure closely matches sites already flagged.", peers[0].get("host", "")))
    result["_signal"] = signal(score, "phishing", indicators)
    return result


def cluster_campaigns(limit: int = 2000) -> list[dict]:
    """Group flagged pages into campaigns with DBSCAN over their structural vectors."""
    rows = [row for row in get_db().page_fingerprints.find({"suspect": True}).limit(limit) if row.get("vector")]
    if len(rows) < 2:
        return []
    size = len(rows)
    distances = np.ones((size, size))
    for left in range(size):
        distances[left, left] = 0
        for right in range(left + 1, size):
            distances[left, right] = distances[right, left] = max(0.0, 1 - _cosine(rows[left]["vector"], rows[right]["vector"]))
    labels = DBSCAN(eps=0.3, min_samples=2, metric="precomputed").fit_predict(distances)
    campaigns = []
    for label in sorted(set(labels) - {-1}):
        members = [rows[index] for index in range(size) if labels[index] == label]
        family = next((row["family"] for row in members if row.get("family")), "Unattributed cluster")
        campaigns.append({"name": family, "category": "Phishing", "growth": 0, "hosts": len(members), "status": "surging" if len(members) >= 5 else "rising", "region": "Global"})
    return sorted(campaigns, key=lambda item: item["hosts"], reverse=True)


# --- JavaScript behaviour --------------------------------------------------------------------------

OBFUSCATION_THRESHOLD = 0.7
PATTERNS = {
    "keylog": r"addEventListener\(\s*['\"]key(?:down|up|press)['\"]|\.onkey(?:down|up|press)\s*=|document\.onkey",
    "clipboard_read": r"navigator\.clipboard\.read(?:Text)?\(",
    "clipboard_write": r"navigator\.clipboard\.write(?:Text)?\(|execCommand\(\s*['\"]copy['\"]",
    "clipboard_swap": r"(?:\^?\(?bc1|\[13\]\[a-km-zA-HJ-NP-Z1-9\]|0x\[a-fA-F0-9\]\{40\}|\[a-z0-9\.\-_\]\+@)",
    "context_block": r"contextmenu['\"][^;]{0,120}(?:preventDefault|return\s+false)|oncontextmenu\s*=\s*['\"]?(?:return\s+false|\w)",
    "devtools": r"keyCode\s*={2,3}\s*123|\bdebugger\b\s*;|outerWidth\s*-\s*(?:window\.)?innerWidth|key\s*={2,3}\s*['\"]F12['\"]",
    "exfil": r"api\.telegram\.org/bot|discord(?:app)?\.com/api/webhooks",
    "paste_block": r"addEventListener\(\s*['\"]paste['\"][^;]{0,120}preventDefault|onpaste\s*=\s*['\"]?return\s+false",
    "timer_nav": r"setTimeout\([^)]{0,200}location\.(?:replace|href|assign)",
    "password_read": r"(?:input\[type=.?password|getElementById\(['\"](?:pass|pwd|password))[^;]{0,200}\.value",
}
API_NAMES = ["eval", "Function(", "atob", "btoa", "fromCharCode", "unescape", "XMLHttpRequest", "fetch(", "sendBeacon", "WebSocket", "clipboard", "addEventListener"]


def _excerpt(source: str, pattern: str, width: int = 240) -> str | None:
    match = re.search(pattern, source, re.I)
    if not match:
        return None
    start = max(0, match.start() - 60)
    return source[start:start + width].strip()


def _script_row(script: dict) -> dict:
    content = script["content"]
    probability = score_js(content)
    obfuscated = probability is not None and probability >= OBFUSCATION_THRESHOLD
    hits = [name for name in ("keylog", "clipboard_read", "clipboard_swap", "exfil", "password_read") if re.search(PATTERNS[name], content, re.I)]
    apis = [name.rstrip("(") for name in API_NAMES if name in content][:6]
    risk = "critical" if "exfil" in hits or (obfuscated and hits) else "high" if obfuscated else "medium" if hits else "info"
    size = len(content.encode())
    return {
        "url": script["url"][:140], "size": f"{size // 1024} KB" if size >= 1024 else f"{size} B", "obfuscated": obfuscated, "risk": risk, "apis": apis,
        "obfuscationProbability": round(probability, 3) if probability is not None else None,
    }


def javascript_behaviour(ctx) -> dict:
    result = base(ctx, f"https://{ctx.host}")
    render = ctx.render
    scripts = ctx.scripts if ctx.reachable else []
    if not ctx.reachable:
        ctx.note("No scripts could be collected because the site is unreachable.")
    elif not render:
        ctx.note("Runtime behaviour was not observed because the browser sandbox was unavailable; static analysis only.")
    telemetry = (render or {}).get("telemetry") or {}
    # Handlers declared as HTML attributes are invisible to script analysis.
    markup = str(ctx.soup)[:400000] if ctx.reachable else ""
    combined = "\n".join(script["content"] for script in scripts)[:2_000_000] + "\n" + markup
    rows = [_script_row(script) for script in scripts[:20]]
    rows.sort(key=lambda row: {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}[row["risk"]])
    obfuscated = [row for row in rows if row["obfuscated"]]
    off_domain_posts = (render or {}).get("off_domain_posts", [])
    has_password_field = bool(ctx.soup.find("input", attrs={"type": re.compile("password", re.I)})) if ctx.reachable else False
    official = official_brand(ctx.host) is not None

    found = {name: bool(re.search(pattern, combined, re.I)) for name, pattern in PATTERNS.items()}
    sensitive_keys = telemetry.get("sensitiveKeyListeners", 0)
    keylogger = sensitive_keys > 0 or (found["keylog"] and found["password_read"])
    clipboard_swap = (telemetry.get("clipboardWrite", 0) > 0 or found["clipboard_write"]) and found["clipboard_swap"] and (found["clipboard_read"] or telemetry.get("copyListeners", 0) > 0)
    clipboard_any = telemetry.get("clipboardRead", 0) > 0 or found["clipboard_read"] or found["paste_block"]
    anti_analysis = found["context_block"] or found["devtools"]
    exfil_bot = found["exfil"]
    credentials_leaving = bool(off_domain_posts) and has_password_field

    def row(id_, label, severity, detail, evidence):
        return {"id": id_, "label": label, "severity": severity, "detail": detail, "evidence": evidence}

    behaviours = [
        row("keylog", "Keystroke capture", "critical" if keylogger else "low" if found["keylog"] else "info",
            "Key listeners are attached to password or OTP inputs." if keylogger else ("Key listeners exist but are not tied to sensitive fields." if found["keylog"] else "No keystroke capture observed."),
            f"{sensitive_keys} sensitive listeners · {telemetry.get('keyListeners', 0)} total" if telemetry else (_excerpt(combined, PATTERNS["keylog"], 90) or "None")),
        row("clipboard", "Clipboard manipulation", "critical" if clipboard_swap else "high" if clipboard_any else "info",
            "Clipboard contents appear to be swapped, such as replacing a wallet or UPI address." if clipboard_swap else ("Clipboard is read, or paste is blocked." if clipboard_any else "No clipboard API usage observed."),
            f"read {telemetry.get('clipboardRead', 0)} · write {telemetry.get('clipboardWrite', 0)}" if telemetry else (_excerpt(combined, PATTERNS["clipboard_read"], 90) or "None")),
        row("exfil", "Off-domain exfiltration", "critical" if exfil_bot or credentials_leaving else "info",
            "Page data is sent to a chat-bot endpoint." if exfil_bot else ("Form data is posted to another domain from a page with a password field." if credentials_leaving else "No credential exfiltration observed."),
            (off_domain_posts[0][:120] if off_domain_posts else (_excerpt(combined, PATTERNS["exfil"], 90) or "None"))),
        row("anti", "Anti-analysis behaviour", "high" if found["devtools"] else "medium" if found["context_block"] else "info",
            "Code detects developer tools or blocks debugging." if found["devtools"] else ("Right-click is disabled." if found["context_block"] else "No anti-debugging code found."),
            _excerpt(combined, PATTERNS["devtools"], 90) or _excerpt(combined, PATTERNS["context_block"], 90) or "None"),
        row("redirect", "Forced navigation", "medium" if found["timer_nav"] else "info", "A timer sends visitors elsewhere." if found["timer_nav"] else "No timer-based navigation.", _excerpt(combined, PATTERNS["timer_nav"], 90) or "None"),
        row("obfuscation", "Obfuscated code", "high" if obfuscated else "info", f"The model flagged {len(obfuscated)} script{'s' if len(obfuscated) != 1 else ''} as deliberately obfuscated." if obfuscated else "No deliberately obfuscated scripts found.", obfuscated[0]["url"] if obfuscated else "None"),
    ]
    weights = {"critical": 70, "high": 34, "medium": 14, "low": 3, "info": 0}
    # Obfuscation and blocked right-click alone are common on ordinary sites; they count fully with a credential form.
    raw = sum(weights[item["severity"]] for item in behaviours if item["id"] not in ("obfuscation", "anti"))
    raw += sum(weights[item["severity"]] * (1.0 if has_password_field else 0.4) for item in behaviours if item["id"] in ("obfuscation", "anti"))
    score = int(clamp(raw) * (0.4 if official else 1))
    indicators, positives = [], []
    for item in behaviours:
        if item["severity"] in ("critical", "high") and not official:
            indicators.append(indicator(f"js-{item['id']}", item["severity"], item["label"], item["detail"], item["evidence"]))
    if ctx.reachable and not indicators:
        positives.append("No obfuscated or credential-stealing scripts observed")
    flagged = [item["label"].lower() for item in behaviours if item["severity"] in ("critical", "high")]
    snippet_pattern = next((PATTERNS[key] for key, active in (("exfil", exfil_bot), ("password_read", found["password_read"]), ("clipboard_swap", clipboard_swap), ("devtools", found["devtools"]), ("keylog", found["keylog"])) if active), None)
    snippet = (_excerpt(combined, snippet_pattern, 420) if snippet_pattern else None) or (scripts[0]["content"][:320] if scripts else "// No scripts were found on this page.")
    result.update({
        "score": score,
        "sandbox": {
            "apiCalls": telemetry.get("apiCalls", 0), "networkRequests": len((render or {}).get("requests", [])), "evalCalls": telemetry.get("evalCalls", 0), "runMs": (render or {}).get("run_ms", 0),
            "mode": "browser" if render else "static",
        },
        "summary": (f"Detected {', '.join(flagged)} across {len(scripts)} scripts." if flagged else (f"{len(scripts)} scripts were analysed with no credential access, clipboard hooks or obfuscated payloads." if ctx.reachable else f"{ctx.host} is unreachable, so no scripts were analysed.")),
        "scripts": rows[:12],
        "behaviours": behaviours,
        "snippet": snippet,
    })
    result["_signal"] = signal(score, "behaviour", indicators, positives, evaluated=ctx.reachable)
    return result

