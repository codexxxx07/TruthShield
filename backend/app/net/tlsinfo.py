"""TLS handshake inspection and X.509 parsing."""
import socket
import ssl
from datetime import timezone

import certifi
import httpx
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed448, ed25519, rsa
from cryptography.x509.ocsp import OCSPCertStatus, OCSPRequestBuilder, OCSPResponseStatus, load_der_ocsp_response
from cryptography.x509.oid import AuthorityInformationAccessOID, ExtensionOID, NameOID

from ..util import to_iso, utcnow
from .fetcher import BlockedTarget, fetch, resolve_public

CONNECT_TIMEOUT = 6
PROTOCOLS = [
    ("TLS 1.3", ssl.TLSVersion.TLSv1_3),
    ("TLS 1.2", ssl.TLSVersion.TLSv1_2),
    ("TLS 1.1", ssl.TLSVersion.TLSv1_1),
    ("TLS 1.0", ssl.TLSVersion.TLSv1),
]
PROTOCOL_LABELS = {"TLSv1.3": "TLS 1.3", "TLSv1.2": "TLS 1.2", "TLSv1.1": "TLS 1.1", "TLSv1": "TLS 1.0"}
# Corporate firewalls re-sign traffic with their own CA. Such a certificate says nothing about the site.
INTERCEPTION_ISSUERS = (
    "fortinet", "fortigate", "zscaler", "palo alto", "paloalto", "netskope", "sophos", "cisco umbrella", "blue coat", "bluecoat", "forcepoint",
    "websense", "check point", "checkpoint", "barracuda", "mcafee web", "kaspersky", "securly", "lightspeed", "untangle",
)


def _attr(name: x509.Name, oid) -> str | None:
    values = name.get_attributes_for_oid(oid)
    return str(values[0].value) if values else None


def _ext(cert: x509.Certificate, oid):
    try:
        return cert.extensions.get_extension_for_oid(oid).value
    except (x509.ExtensionNotFound, ValueError, x509.DuplicateExtension):
        return None


def _key_info(cert: x509.Certificate) -> dict:
    try:
        key = cert.public_key()
    except (ValueError, TypeError):
        return {"algorithm": "Unknown", "size": 0, "curve": None}
    if isinstance(key, rsa.RSAPublicKey):
        return {"algorithm": "RSA", "size": key.key_size, "curve": None}
    if isinstance(key, ec.EllipticCurvePublicKey):
        return {"algorithm": "ECDSA", "size": key.key_size, "curve": key.curve.name}
    if isinstance(key, (ed25519.Ed25519PublicKey, ed448.Ed448PublicKey)):
        return {"algorithm": "EdDSA", "size": 256, "curve": type(key).__name__}
    return {"algorithm": type(key).__name__, "size": 0, "curve": None}


def _signature_name(cert: x509.Certificate) -> str:
    return cert.signature_algorithm_oid._name


def parse_certificate(der: bytes) -> dict:
    cert = x509.load_der_x509_certificate(der)
    san = _ext(cert, ExtensionOID.SUBJECT_ALTERNATIVE_NAME)
    names = san.get_values_for_type(x509.DNSName) if san else []
    aia = _ext(cert, ExtensionOID.AUTHORITY_INFORMATION_ACCESS)
    ocsp_urls = [item.access_location.value for item in (aia or []) if item.access_method == AuthorityInformationAccessOID.OCSP]
    issuer_urls = [item.access_location.value for item in (aia or []) if item.access_method == AuthorityInformationAccessOID.CA_ISSUERS]
    crl = _ext(cert, ExtensionOID.CRL_DISTRIBUTION_POINTS)
    crl_urls = [name.value for point in (crl or []) for name in (point.full_name or [])]
    scts = _ext(cert, ExtensionOID.PRECERT_SIGNED_CERTIFICATE_TIMESTAMPS)
    tls_feature = _ext(cert, ExtensionOID.TLS_FEATURE)
    not_before = cert.not_valid_before_utc
    not_after = cert.not_valid_after_utc
    now = utcnow()
    key = _key_info(cert)
    return {
        "subject_cn": _attr(cert.subject, NameOID.COMMON_NAME),
        "subject_org": _attr(cert.subject, NameOID.ORGANIZATION_NAME),
        "subject_ou": _attr(cert.subject, NameOID.ORGANIZATIONAL_UNIT_NAME),
        "subject_locality": _attr(cert.subject, NameOID.LOCALITY_NAME),
        "subject_country": _attr(cert.subject, NameOID.COUNTRY_NAME),
        "issuer_cn": _attr(cert.issuer, NameOID.COMMON_NAME),
        "issuer_org": _attr(cert.issuer, NameOID.ORGANIZATION_NAME),
        "issuer_country": _attr(cert.issuer, NameOID.COUNTRY_NAME),
        "serial": ":".join(f"{byte:02x}" for byte in cert.serial_number.to_bytes((cert.serial_number.bit_length() + 7) // 8 or 1, "big")),
        "not_before": not_before,
        "not_after": not_after,
        "lifetime_days": (not_after - not_before).days,
        "age_days": (now - not_before).days,
        "days_remaining": (not_after - now).days,
        "key": key,
        "signature": _signature_name(cert),
        "signature_hash": getattr(cert.signature_hash_algorithm, "name", None),
        "sans": list(names),
        "scts": [{"log_id": sct.log_id.hex(), "timestamp": sct.timestamp.replace(tzinfo=timezone.utc)} for sct in (scts or [])],
        "ocsp_urls": ocsp_urls,
        "issuer_urls": issuer_urls,
        "crl_urls": crl_urls,
        "must_staple": bool(tls_feature and x509.TLSFeatureType.status_request in list(tls_feature)),
        "self_signed": cert.issuer == cert.subject,
        "der": der,
    }


def _connect(address: str, port: int, host: str, context: ssl.SSLContext) -> ssl.SSLSocket:
    raw = socket.create_connection((address, port), timeout=CONNECT_TIMEOUT)
    try:
        return context.wrap_socket(raw, server_hostname=host)
    except Exception:
        raw.close()
        raise


def inspect_tls(host: str, port: int = 443) -> dict:
    """Return a certificate and connection report, or {"reachable": False, "error": ...}."""
    try:
        address = resolve_public(host, port)[0]
    except (BlockedTarget, httpx.ConnectError) as error:
        return {"reachable": False, "error": str(error)}

    verified, verify_error, chain_der, protocol, cipher = False, None, [], None, None
    context = ssl.create_default_context(cafile=certifi.where())
    try:
        with _connect(address, port, host, context) as sock:
            verified = True
            chain_der = list(sock.get_verified_chain())
            protocol, cipher = sock.version(), sock.cipher()[0]
    except ssl.SSLCertVerificationError as error:
        verify_error = error.verify_message
    except (ssl.SSLError, OSError) as error:
        verify_error = str(error)

    if not chain_der:
        loose = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        loose.check_hostname = False
        loose.verify_mode = ssl.CERT_NONE
        try:
            with _connect(address, port, host, loose) as sock:
                chain_der = list(sock.get_unverified_chain())
                protocol, cipher = sock.version(), sock.cipher()[0]
        except (ssl.SSLError, OSError) as error:
            return {"reachable": False, "error": str(error)[:200] or type(error).__name__}

    chain = []
    for der in chain_der:
        try:
            chain.append(parse_certificate(der))
        except ValueError:
            continue
    if not chain:
        return {"reachable": False, "error": "The certificate could not be parsed"}
    issuer_text = f"{chain[0]['issuer_org'] or ''} {chain[0]['issuer_cn'] or ''}".lower()
    return {
        "reachable": True,
        "address": address,
        "intercepted": not verified and any(marker in issuer_text for marker in INTERCEPTION_ISSUERS),
        "valid": verified,
        "verify_error": verify_error,
        "protocol": PROTOCOL_LABELS.get(protocol, protocol),
        "cipher": cipher,
        "forward_secrecy": cipher is not None and (protocol == "TLSv1.3" or "ECDHE" in cipher or "DHE" in cipher),
        "leaf": chain[0],
        "chain": chain,
    }


def probe_versions(host: str, port: int = 443) -> list[str]:
    """Report which TLS versions the server accepts, including legacy ones."""
    try:
        address = resolve_public(host, port)[0]
    except (BlockedTarget, httpx.ConnectError):
        return []
    accepted = []
    for label, version in PROTOCOLS:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        try:
            context.minimum_version = version
            context.maximum_version = version
            if version in (ssl.TLSVersion.TLSv1, ssl.TLSVersion.TLSv1_1):
                context.set_ciphers("ALL:@SECLEVEL=0")
            with _connect(address, port, host, context):
                accepted.append(label)
        except (ssl.SSLError, OSError, ValueError):
            continue
    return accepted


def check_ocsp(tls: dict) -> str:
    """Query the OCSP responder for the leaf. Returns good, revoked or unknown."""
    if not tls.get("reachable") or len(tls["chain"]) < 2 or not tls["leaf"]["ocsp_urls"]:
        return "unknown"
    try:
        leaf = x509.load_der_x509_certificate(tls["leaf"]["der"])
        issuer = x509.load_der_x509_certificate(tls["chain"][1]["der"])
        request = OCSPRequestBuilder().add_certificate(leaf, issuer, hashes.SHA1()).build()
        result = fetch(
            tls["leaf"]["ocsp_urls"][0], method="POST", ua="TruthShield/1.0", timeout=5,
            headers={"Content-Type": "application/ocsp-request", "Accept": "application/ocsp-response"},
            content=request.public_bytes(serialization.Encoding.DER), max_bytes=64 * 1024,
        )
        if not result.ok or result.status != 200:
            return "unknown"
        response = load_der_ocsp_response(result.body)
        if response.response_status != OCSPResponseStatus.SUCCESSFUL:
            return "unknown"
        return {OCSPCertStatus.GOOD: "good", OCSPCertStatus.REVOKED: "revoked"}.get(response.certificate_status, "unknown")
    except (ValueError, TypeError):
        return "unknown"


def hostname_matches(host: str, sans: list[str]) -> bool:
    host = host.lower()
    for name in sans:
        name = name.lower()
        if name == host:
            return True
        if name.startswith("*.") and host.count(".") == name.count(".") and host.endswith(name[1:]):
            return True
    return False


def issuer_name(leaf: dict) -> str:
    return leaf.get("issuer_org") or leaf.get("issuer_cn") or "Unknown"


def date_iso(value) -> str | None:
    return to_iso(value)
