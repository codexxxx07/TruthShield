"""Follow a URL through HTTP, meta-refresh and script redirects to its final landing page."""
import re
from urllib.parse import urljoin, urlsplit

from ..config import settings
from ..util import load_json, registrable
from .fetcher import DESKTOP_UA, fetch

META_RE = re.compile(r"<meta[^>]+http-equiv=[\"']?refresh[\"']?[^>]*content=[\"']?\s*\d+\s*;\s*url=([^\"'>\s]+)", re.I)
JS_RE = re.compile(
    r"(?:window\.|top\.|self\.|document\.)?location(?:\.href)?\s*=\s*[\"']([^\"']+)[\"']"
    r"|location\.(?:replace|assign)\(\s*[\"']([^\"']+)[\"']\s*\)",
    re.I,
)
# Larger pages are real applications; a location assignment in them is usually behind a click.
JS_REDIRECT_MAX_BYTES = 12_000
SHORTENERS = set(load_json("hosting.json")["url_shorteners"])


def _next_from_body(html: str, size: int) -> tuple[str | None, str | None]:
    match = META_RE.search(html)
    if match:
        return match.group(1).strip("'\""), "Meta refresh"
    if size <= JS_REDIRECT_MAX_BYTES:
        match = JS_RE.search(html)
        if match:
            return match.group(1) or match.group(2), "JavaScript"
    return None, None


def _note(index: int, url: str, target: str | None, kind: str) -> str:
    if target is None:
        return "Landing page"
    source_domain, target_domain = registrable(urlsplit(url).hostname or ""), registrable(urlsplit(target).hostname or "")
    if source_domain in SHORTENERS:
        return "URL shortener"
    if url.startswith("https:") and target.startswith("http:"):
        return "Downgrade from HTTPS to HTTP"
    if source_domain != target_domain:
        return "Cross-domain handoff"
    if kind != "HTTP":
        return f"{kind} redirect"
    if url.startswith("http:") and target.startswith("https:"):
        return "Upgrade to HTTPS"
    return "Entry point" if index == 0 else "Same-site redirect"


def trace(url: str, ua: str = DESKTOP_UA, referer: str | None = None) -> dict:
    hops, seen = [], set()
    current = url
    final = None
    error = None
    blocked = False
    headers = {"Referer": referer} if referer else None
    for index in range(settings.max_redirects + 1):
        if current in seen:
            error = "Redirect loop detected"
            break
        seen.add(current)
        result = fetch(current, ua=ua, headers=headers)
        if not result.ok:
            error, blocked = result.error, result.blocked
            note = "Blocked: resolves to a private address" if result.blocked else (result.error or "Unreachable")
            hops.append({"url": current, "status": 0, "type": "Final", "server": "None", "latency": result.elapsed_ms, "note": note})
            break
        next_url, kind = None, "HTTP"
        location = result.headers.get("location")
        if result.status in (301, 302, 303, 307, 308) and location:
            next_url = urljoin(current, location)
        elif "refresh" in result.headers and "url=" in result.headers["refresh"].lower():
            next_url = urljoin(current, re.split(r"url=", result.headers["refresh"], flags=re.I)[1].strip("'\" "))
            kind = "Refresh header"
        elif result.status == 200 and result.is_html:
            found, found_kind = _next_from_body(result.text, len(result.body))
            if found and not found.startswith(("#", "javascript:")):
                next_url, kind = urljoin(current, found), found_kind
        if next_url and not next_url.startswith(("http://", "https://")):
            next_url = None
        hops.append({
            "url": current,
            "status": result.status,
            "type": kind if next_url else "Final",
            "server": result.headers.get("server", "Unknown")[:60],
            "latency": result.elapsed_ms,
            "note": _note(index, current, next_url, kind),
        })
        if not next_url:
            final = result
            break
        if index == settings.max_redirects:
            error = "Too many redirects"
            break
        current = next_url
    return {
        "hops": hops,
        "final_url": hops[-1]["url"] if hops else url,
        "response": final,
        "reachable": final is not None,
        "error": error,
        "blocked": blocked,
        "total_ms": sum(hop["latency"] for hop in hops),
    }
