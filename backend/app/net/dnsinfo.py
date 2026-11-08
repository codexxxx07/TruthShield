"""DNS records, ASN attribution (Team Cymru) and RDAP registration data."""
from datetime import datetime

import dns.exception
import dns.resolver
import dns.reversename

from ..util import load_json, registrable, utcnow
from .fetcher import fetch_json, is_public_ip

COUNTRY_NAMES = {
    "US": "United States", "IN": "India", "RU": "Russia", "NL": "Netherlands", "DE": "Germany", "GB": "United Kingdom",
    "FR": "France", "SG": "Singapore", "JP": "Japan", "CN": "China", "HK": "Hong Kong", "CA": "Canada", "AU": "Australia",
    "RO": "Romania", "LT": "Lithuania", "LV": "Latvia", "UA": "Ukraine", "TR": "Turkey", "BR": "Brazil", "ID": "Indonesia",
    "VN": "Vietnam", "PA": "Panama", "SE": "Sweden", "FI": "Finland", "IE": "Ireland", "ES": "Spain", "IT": "Italy",
    "CH": "Switzerland", "BG": "Bulgaria", "PL": "Poland", "KR": "South Korea", "ZA": "South Africa", "CY": "Cyprus",
    "MD": "Moldova", "SC": "Seychelles", "BZ": "Belize", "AE": "United Arab Emirates", "NG": "Nigeria", "TH": "Thailand",
}
EMPTY = ("", 0)


def _resolver(nameserver: str | None = None, lifetime: float = 3.0) -> dns.resolver.Resolver:
    resolver = dns.resolver.Resolver(configure=nameserver is None)
    if nameserver:
        resolver.nameservers = [nameserver]
    resolver.lifetime = lifetime
    resolver.timeout = lifetime
    return resolver


def query(name: str, record: str, resolver: dns.resolver.Resolver | None = None) -> tuple[list[str], int | None, str | None]:
    """Return (values, ttl, error). error is 'nxdomain', 'timeout', or None for a normal answer."""
    try:
        answer = (resolver or _resolver()).resolve(name, record)
    except dns.resolver.NXDOMAIN:
        return [], None, "nxdomain"
    except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        return [], None, None
    except (dns.exception.Timeout, dns.exception.DNSException):
        return [], None, "timeout"
    return [item.to_text().strip('"').rstrip(".") for item in answer], answer.rrset.ttl, None


def domain_resolves(name: str) -> bool:
    ips, _, _ = query(name, "A", _resolver(lifetime=1.5))
    if ips:
        return True
    ips, _, _ = query(name, "AAAA", _resolver(lifetime=1.5))
    return bool(ips)


def lookup_records(domain: str) -> dict:
    apex = registrable(domain)
    a, a_ttl, a_error = query(domain, "A")
    aaaa, _, _ = query(domain, "AAAA")
    mx, _, _ = query(apex, "MX")
    ns, _, _ = query(apex, "NS")
    txt, _, _ = query(apex, "TXT")
    dmarc, _, _ = query(f"_dmarc.{apex}", "TXT")
    return {
        "a": a, "aaaa": aaaa, "mx": mx, "ns": ns, "txt": txt, "dmarc": dmarc, "ttl": a_ttl,
        "resolves": bool(a or aaaa), "nxdomain": a_error == "nxdomain",
    }


def resolver_views(domain: str) -> dict:
    """A records seen by independent public resolvers; disagreement can indicate fast flux."""
    return {server: query(domain, "A", _resolver(server, 2.0))[0] for server in ("8.8.8.8", "1.1.1.1", "9.9.9.9")}


def lookup_asn(ip: str) -> dict:
    empty = {"asn": "Unknown", "number": None, "org": "Unknown", "country": "Unknown", "countryCode": "--", "prefix": None}
    if ":" in ip or not is_public_ip(ip):
        return empty
    reversed_ip = ".".join(reversed(ip.split(".")))
    origin, _, _ = query(f"{reversed_ip}.origin.asn.cymru.com", "TXT", _resolver(lifetime=3))
    if not origin:
        return empty
    fields = [item.strip() for item in origin[0].split("|")]
    number = fields[0].split()[0]
    code = fields[2] if len(fields) > 2 else "--"
    detail, _, _ = query(f"AS{number}.asn.cymru.com", "TXT", _resolver(lifetime=3))
    org = detail[0].split("|")[-1].strip() if detail else "Unknown"
    org = org.split(" - ", 1)[-1].rsplit(",", 1)[0].strip() or org
    return {
        "asn": f"AS{number}", "number": number, "org": org, "country": COUNTRY_NAMES.get(code, code),
        "countryCode": code, "prefix": fields[1] if len(fields) > 1 else None,
    }


def reverse_dns(ip: str) -> str | None:
    try:
        values, _, _ = query(dns.reversename.from_address(ip).to_text(), "PTR", _resolver(lifetime=2))
    except dns.exception.DNSException:
        return None
    return values[0] if values else None


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def lookup_rdap(domain: str) -> dict:
    apex = registrable(domain)
    empty = {"available": False, "registrar": "Unknown", "created": None, "ageDays": None, "privacy": None, "registrant": None}
    data = fetch_json(f"https://rdap.org/domain/{apex}", timeout=7)
    if not isinstance(data, dict):
        return empty
    created = next((_parse_date(item.get("eventDate")) for item in data.get("events", []) if item.get("eventAction") == "registration"), None)
    registrar, registrant = None, None
    privacy = False
    markers = load_json("hosting.json")["privacy_markers"]
    for entity in data.get("entities", []):
        roles = entity.get("roles", [])
        vcard = entity.get("vcardArray", [None, []])[1] if entity.get("vcardArray") else []
        full_name = next((item[3] for item in vcard if item[0] == "fn"), None)
        org_name = next((item[3] for item in vcard if item[0] == "org"), None)
        if "registrar" in roles:
            registrar = full_name or registrar
        if "registrant" in roles:
            registrant = org_name or full_name
            text = f"{registrant or ''}".lower()
            privacy = privacy or any(marker in text for marker in markers)
    remarks = " ".join(" ".join(item.get("description", [])) for item in data.get("remarks", [])).lower()
    if not registrant and "redact" in remarks:
        privacy = True
    return {
        "available": True,
        "registrar": registrar or "Unknown",
        "created": created,
        "ageDays": (utcnow() - created).days if created else None,
        "privacy": privacy or not registrant,
        "registrant": registrant,
    }
