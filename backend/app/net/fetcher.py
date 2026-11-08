"""HTTP client for untrusted targets.

Every outbound connection goes through SafeBackend, which resolves the host and refuses non-public
addresses at connect time. That covers redirects and DNS rebinding, since no earlier check is trusted.
"""
import ipaddress
import json
import socket
import ssl
import threading
import time
from dataclasses import dataclass, field

import httpcore
import httpx

from ..config import settings

DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"
MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1"
CRAWLER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
ALLOWED_PORTS = {80, 443, 8080, 8443}


class BlockedTarget(Exception):
    """The destination resolves to an address that must not be contacted."""


def is_public_ip(value: str) -> bool:
    address = ipaddress.ip_address(value.split("%")[0])
    mapped = getattr(address, "ipv4_mapped", None)
    if mapped is not None:
        address = mapped
    return address.is_global and not address.is_multicast


def resolve_public(host: str, port: int = 443) -> list[str]:
    """Resolve a host, raising BlockedTarget if any answer is non-public."""
    try:
        answers = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as error:
        raise httpx.ConnectError(f"DNS did not resolve: {host}") from error
    addresses = list(dict.fromkeys(item[4][0] for item in answers))
    blocked = [address for address in addresses if not is_public_ip(address)]
    if blocked or not addresses:
        raise BlockedTarget(f"{host} resolves to a non-public address")
    return addresses


class SafeBackend(httpcore.SyncBackend):
    def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        if port not in ALLOWED_PORTS:
            raise BlockedTarget(f"Port {port} is not allowed")
        address = resolve_public(host, port)[0]
        return super().connect_tcp(address, port, timeout, local_address, socket_options)


def _unverified_context() -> ssl.SSLContext:
    # Phishing sites often have invalid certificates and must still be fetched. Validity is
    # reported separately by net.tlsinfo.
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


_client_lock = threading.Lock()
_client: httpx.Client | None = None


def _get_client() -> httpx.Client:
    global _client
    with _client_lock:
        if _client is None:
            context = _unverified_context()
            transport = httpx.HTTPTransport(verify=context)
            transport._pool = httpcore.ConnectionPool(
                ssl_context=context,
                max_connections=64,
                max_keepalive_connections=0,
                network_backend=SafeBackend(),
            )
            _client = httpx.Client(transport=transport, follow_redirects=False, timeout=settings.fetch_timeout)
        return _client


@dataclass
class FetchResult:
    url: str
    status: int = 0
    headers: dict = field(default_factory=dict)
    set_cookies: list = field(default_factory=list)
    body: bytes = b""
    elapsed_ms: int = 0
    error: str | None = None
    blocked: bool = False

    @property
    def ok(self) -> bool:
        return self.error is None and self.status > 0

    @property
    def text(self) -> str:
        charset = "utf-8"
        content_type = self.headers.get("content-type", "")
        if "charset=" in content_type:
            charset = content_type.split("charset=")[-1].split(";")[0].strip() or "utf-8"
        try:
            return self.body.decode(charset, errors="replace")
        except LookupError:
            return self.body.decode("utf-8", errors="replace")

    @property
    def is_html(self) -> bool:
        content_type = self.headers.get("content-type", "").lower()
        return "html" in content_type or (not content_type and b"<html" in self.body[:2000].lower())


def fetch(url: str, ua: str = DESKTOP_UA, headers: dict | None = None, max_bytes: int | None = None,
          method: str = "GET", content: bytes | None = None, timeout: float | None = None) -> FetchResult:
    """Fetch a single URL without following redirects, capping the body size."""
    limit = max_bytes or settings.max_body_bytes
    request_headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        **(headers or {}),
    }
    started = time.perf_counter()
    result = FetchResult(url=url)
    try:
        with _get_client().stream(method, url, headers=request_headers, content=content, timeout=timeout or settings.fetch_timeout) as response:
            result.status = response.status_code
            result.headers = {key.lower(): value for key, value in response.headers.items()}
            result.set_cookies = response.headers.get_list("set-cookie")
            chunks, size = [], 0
            for chunk in response.iter_bytes():
                chunks.append(chunk)
                size += len(chunk)
                if size >= limit:
                    break
            result.body = b"".join(chunks)[:limit]
    except BlockedTarget as error:
        result.error = str(error)
        result.blocked = True
    except httpx.ConnectError as error:
        result.error = str(error) or "Connection failed"
    except httpx.TimeoutException:
        result.error = "Timed out"
    except (httpx.HTTPError, httpcore.TimeoutException, httpcore.NetworkError, httpcore.ProtocolError, ValueError, OSError, ssl.SSLError) as error:
        result.error = f"{type(error).__name__}: {error}"[:200]
    result.elapsed_ms = int((time.perf_counter() - started) * 1000)
    return result


def fetch_json(url: str, timeout: float = 10, headers: dict | None = None):
    """Fetch JSON from a trusted public API. Returns None on any failure."""
    result = fetch(url, ua="TruthShield/1.0", headers={"Accept": "application/json,application/rdap+json", **(headers or {})},
                   max_bytes=8 * 1024 * 1024, timeout=timeout)
    for _ in range(3):
        if result.status in (301, 302, 303, 307, 308) and result.headers.get("location"):
            result = fetch(str(httpx.URL(url).join(result.headers["location"])), ua="TruthShield/1.0",
                           headers={"Accept": "application/json,application/rdap+json", **(headers or {})},
                           max_bytes=8 * 1024 * 1024, timeout=timeout)
        else:
            break
    if not result.ok or result.status != 200:
        return None
    try:
        return json.loads(result.body)
    except ValueError:
        return None
