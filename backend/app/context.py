"""Per-request scan context. Expensive lookups run once and are shared by every detector."""
import threading
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from .net import browser, dnsinfo, redirects, tlsinfo
from .net.fetcher import fetch
from .util import is_ip, normalize_domain, normalize_url, registrable, to_unicode_host

MAX_EXTERNAL_SCRIPTS = 12
MAX_SCRIPT_BYTES = 400_000


class Ctx:
    def __init__(self, url: str, host: str, raw_host: str | None = None, target: str | None = None):
        self.url = url
        self.host = host
        self.raw_host = raw_host or host
        self.target = target or url
        self.domain = registrable(host)
        self.is_ip = is_ip(host)
        self.unicode_host = to_unicode_host(host) if "xn--" in host else host
        self.limitations: list[str] = []
        self._memo: dict = {}
        self._locks: dict = {}
        self._guard = threading.Lock()

    @classmethod
    def from_url(cls, raw: str) -> "Ctx":
        url, raw_host = normalize_url(raw)
        return cls(url, urlsplit(url).hostname, raw_host, url)

    @classmethod
    def from_domain(cls, raw: str) -> "Ctx":
        host, raw_host = normalize_domain(raw)
        return cls(f"https://{host}/", host, raw_host, host)

    def once(self, key: str, compute):
        with self._guard:
            lock = self._locks.setdefault(key, threading.Lock())
        with lock:
            if key not in self._memo:
                self._memo[key] = compute()
            return self._memo[key]

    def note(self, message: str) -> None:
        with self._guard:
            if message not in self.limitations:
                self.limitations.append(message)

    @property
    def dns(self) -> dict:
        return self.once("dns", lambda: dnsinfo.lookup_records(self.host) if not self.is_ip else {
            "a": [self.host], "aaaa": [], "mx": [], "ns": [], "txt": [], "dmarc": [], "ttl": None, "resolves": True, "nxdomain": False,
        })

    @property
    def resolves(self) -> bool:
        return bool(self.dns["resolves"])

    @property
    def tls(self) -> dict:
        def compute():
            if not self.resolves:
                return {"reachable": False, "error": "The domain does not resolve in public DNS"}
            return tlsinfo.inspect_tls(self.host)

        return self.once("tls", compute)

    @property
    def rdap(self) -> dict:
        return self.once("rdap", lambda: dnsinfo.lookup_rdap(self.host) if not self.is_ip else {
            "available": False, "registrar": "Unknown", "created": None, "ageDays": None, "privacy": None, "registrant": None,
        })

    @property
    def asn(self) -> dict:
        def compute():
            addresses = self.dns["a"]
            return dnsinfo.lookup_asn(addresses[0]) if addresses else dnsinfo.lookup_asn("")

        return self.once("asn", compute) if self.dns["a"] else {
            "asn": "Unknown", "number": None, "org": "Unknown", "country": "Unknown", "countryCode": "--", "prefix": None,
        }

    @property
    def trace(self) -> dict:
        def compute():
            if not self.resolves:
                return {
                    "hops": [{"url": self.url, "status": 0, "type": "Final", "server": "None", "latency": 0, "note": "Domain does not resolve in public DNS"}],
                    "final_url": self.url, "response": None, "reachable": False, "error": "DNS did not resolve", "blocked": False, "total_ms": 0,
                }
            return redirects.trace(self.url)

        return self.once("trace", compute)

    @property
    def reachable(self) -> bool:
        return bool(self.trace["reachable"])

    @property
    def response(self):
        return self.trace["response"]

    @property
    def final_url(self) -> str:
        return self.trace["final_url"]

    @property
    def render(self) -> dict | None:
        return self.once("render", lambda: browser.render(self.final_url) if self.reachable else None)

    @property
    def html(self) -> str:
        """Prefer the rendered DOM; fall back to the raw response."""
        if self.render:
            return self.render["html"]
        return self.response.text if self.response is not None and self.response.is_html else ""

    @property
    def soup(self) -> BeautifulSoup:
        return self.once("soup", lambda: BeautifulSoup(self.html, "html.parser"))

    @property
    def scripts(self) -> list[dict]:
        def compute():
            found = []
            external = []
            for tag in self.soup.find_all("script"):
                source = tag.get("src")
                if source:
                    external.append(urljoin(self.final_url, source))
                elif tag.string and tag.string.strip():
                    found.append({"url": f"(inline #{len(found) + 1})", "content": tag.string[:MAX_SCRIPT_BYTES], "external": False})
            for script_url in list(dict.fromkeys(external))[:MAX_EXTERNAL_SCRIPTS]:
                result = fetch(script_url, max_bytes=MAX_SCRIPT_BYTES)
                if result.ok and result.status == 200:
                    found.append({"url": script_url, "content": result.text, "external": True})
            return found

        return self.once("scripts", compute)
