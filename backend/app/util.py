"""Small helpers shared across detectors: time, target normalisation, domain splitting."""
import ipaddress
import json
import math
import re
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
from urllib.parse import urlsplit, urlunsplit

import tldextract

from .config import DATA_DIR

_extract = tldextract.TLDExtract(cache_dir=None, suffix_list_urls=(), fallback_to_snapshot=True)

BLOCKED_NAMES = {"localhost", "localhost.localdomain", "ip6-localhost", "metadata.google.internal"}
LOCAL_SUFFIXES = (".local", ".internal", ".intranet", ".lan", ".home", ".corp", ".localhost")


class InvalidTarget(ValueError):
    """The submitted target cannot be scanned; the message is shown to the user."""


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def now_iso() -> str:
    return utcnow().isoformat().replace("+00:00", "Z")


def to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counts = Counter(text)
    total = len(text)
    return -sum(count / total * math.log2(count / total) for count in counts.values())


def is_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host.strip("[]"))
        return True
    except ValueError:
        return False


def split_domain(host: str) -> tuple[str, str, str]:
    """Return (subdomain, second-level label, public suffix), including for reserved TLDs."""
    host = host.lower().rstrip(".")
    if is_ip(host):
        return "", host, ""
    result = _extract(host)
    if result.suffix and result.domain:
        return result.subdomain, result.domain, result.suffix
    parts = host.split(".")
    if len(parts) >= 2:
        return ".".join(parts[:-2]), parts[-2], parts[-1]
    return "", host, ""


def registrable(host: str) -> str:
    _, sld, suffix = split_domain(host)
    return f"{sld}.{suffix}" if suffix else sld


def to_ascii_host(host: str) -> str:
    host = host.strip().rstrip(".")
    if host.isascii():
        return host.lower()
    try:
        return host.encode("idna").decode("ascii").lower()
    except UnicodeError as error:
        raise InvalidTarget("The domain contains invalid characters.") from error


def to_unicode_host(host: str) -> str:
    try:
        return host.encode("ascii").decode("idna")
    except UnicodeError:
        return host


def _check_host(host: str) -> None:
    if not host:
        raise InvalidTarget("Missing a hostname.")
    lowered = host.lower()
    if lowered in BLOCKED_NAMES or lowered.endswith(LOCAL_SUFFIXES):
        raise InvalidTarget("Local addresses cannot be publicly scanned.")
    if is_ip(lowered):
        address = ipaddress.ip_address(lowered.strip("[]"))
        # Documentation ranges are allowed through: they appear in the demo threat feed and never route.
        documentation = any(
            address in ipaddress.ip_network(net)
            for net in ("192.0.2.0/24", "198.51.100.0/24", "203.0.113.0/24", "2001:db8::/32")
        )
        if not address.is_global and not documentation:
            raise InvalidTarget("Local addresses cannot be publicly scanned.")
        return
    if "." not in lowered:
        raise InvalidTarget("Enter a full domain, for example example.com.")


def normalize_url(raw: str) -> tuple[str, str]:
    """Return (url, raw_host), keeping the host's original case for homoglyph checks."""
    value = (raw or "").strip()
    if not value:
        raise InvalidTarget("Enter a URL to scan.")
    if len(value) > 2048:
        raise InvalidTarget("URL is too long (maximum 2048 characters).")
    if re.search(r"\s", value):
        raise InvalidTarget("URLs cannot contain spaces.")
    if not re.match(r"^https?://", value, re.I):
        if re.match(r"^[a-z][a-z0-9+.-]*:(?!\d)", value, re.I):
            raise InvalidTarget("Only http:// and https:// URLs can be scanned.")
        value = f"https://{value}"
    try:
        parts = urlsplit(value)
        raw_host = parts.hostname or ""
        port = parts.port
    except ValueError as error:
        raise InvalidTarget("That does not look like a valid URL.") from error
    # urlsplit lowercases .hostname; recover the typed spelling from the netloc.
    typed = parts.netloc.rsplit("@", 1)[-1]
    typed = typed.rsplit(":", 1)[0] if ":" in typed and not typed.endswith("]") else typed
    if typed.lower() == raw_host:
        raw_host = typed
    ascii_host = to_ascii_host(raw_host)
    _check_host(ascii_host)
    if port not in (None, 80, 443, 8080, 8443):
        raise InvalidTarget("Only standard web ports can be scanned.")
    netloc = ascii_host if port is None else f"{ascii_host}:{port}"
    return urlunsplit((parts.scheme.lower(), netloc, parts.path or "/", parts.query, "")), raw_host


def normalize_domain(raw: str) -> tuple[str, str]:
    """Return (ascii domain, raw_host) from a domain or a URL."""
    value = (raw or "").strip()
    if not value:
        raise InvalidTarget("Enter a domain name.")
    value = re.sub(r"^https?://", "", value, flags=re.I).split("/")[0].split(":")[0]
    if re.search(r"\s", value):
        raise InvalidTarget("Domains cannot contain spaces.")
    ascii_host = to_ascii_host(value)
    _check_host(ascii_host)
    return ascii_host, value


@lru_cache(maxsize=None)
def load_json(name: str):
    with open(DATA_DIR / name, encoding="utf-8") as handle:
        return json.load(handle)


@lru_cache(maxsize=1)
def tranco_ranks() -> dict[str, int]:
    """Popular registrable domains, used as a reputation prior. Empty if the list is absent."""
    ranks: dict[str, int] = {}
    for path in (DATA_DIR / "tranco_top100k.csv", DATA_DIR / "training" / "tranco_top100k.csv"):
        if path.exists():
            with open(path, encoding="utf-8") as handle:
                for line in handle:
                    rank, _, domain = line.strip().partition(",")
                    if domain:
                        ranks[domain] = int(rank)
            break
    return ranks
