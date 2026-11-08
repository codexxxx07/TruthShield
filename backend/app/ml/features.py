"""Feature extraction for the URL phishing model and the JavaScript obfuscation model."""
import ipaddress
import re
from urllib.parse import urlsplit

import numpy as np

from ..util import load_json, registrable, shannon_entropy, split_domain, to_unicode_host

LURE_WORDS = (
    "login", "signin", "verify", "verification", "secure", "account", "update", "confirm", "bank", "kyc",
    "wallet", "gift", "prize", "claim", "support", "invoice", "unlock", "recovery", "password", "billing",
    "refund", "delivery", "reward", "bonus", "alert", "webscr", "suspend", "limited", "authenticate", "otp",
)
BRAND_TOKENS = sorted({keyword for brand in load_json("brands.json") for keyword in brand["keywords"] if len(keyword) >= 4})
OFFICIAL = {domain for brand in load_json("brands.json") for domain in brand["official"]}
_hosting = load_json("hosting.json")
HIGH_ABUSE_TLDS = set(_hosting["high_abuse_tlds"])
FREE_HOSTS = tuple(_hosting["free_hosting_suffixes"])
SHORTENERS = set(_hosting["url_shorteners"])

URL_FEATURE_NAMES = [
    "host_length", "path_length", "query_length", "dot_count", "hyphens_in_host", "digits_in_host",
    "digit_ratio_host", "subdomain_depth", "path_depth", "is_ip_host", "has_at_symbol", "is_punycode",
    "host_entropy", "domain_entropy", "vowel_ratio", "lure_words_in_host", "lure_words_in_path",
    "brand_in_host_not_owned", "brand_in_path", "brand_in_subdomain", "high_abuse_tld", "free_hosting",
    "url_shortener", "query_params", "longest_digit_run", "longest_label", "non_ascii_host",
    "double_slash_in_path", "php_or_html_page", "percent_escapes",
]

# Readable explanations for the indicators list. Only features that increase risk are named.
URL_FEATURE_LABELS = {
    "host_length": "Unusually long hostname",
    "hyphens_in_host": "Many hyphens in the hostname",
    "digits_in_host": "Numeric padding in the hostname",
    "digit_ratio_host": "High share of digits in the hostname",
    "subdomain_depth": "Deeply nested subdomains",
    "path_depth": "Deeply nested URL path",
    "is_ip_host": "URL points at a raw IP address",
    "has_at_symbol": "URL contains an @ symbol that hides the real host",
    "is_punycode": "Internationalised (punycode) hostname",
    "host_entropy": "Random-looking hostname",
    "domain_entropy": "Random-looking domain label",
    "lure_words_in_host": "Lure words in the hostname",
    "lure_words_in_path": "Lure words in the URL path",
    "brand_in_host_not_owned": "A brand name appears on a domain the brand does not own",
    "brand_in_path": "A brand name appears in the URL path",
    "brand_in_subdomain": "A brand name is used as a subdomain",
    "high_abuse_tld": "Top-level domain with high abuse rates",
    "free_hosting": "Hosted on a free site builder",
    "url_shortener": "Hidden behind a URL shortener",
    "non_ascii_host": "Non-ASCII characters in the hostname",
    "double_slash_in_path": "Embedded URL inside the path",
    "php_or_html_page": "Direct script or HTML page in the path",
    "percent_escapes": "Heavily escaped URL",
    "longest_digit_run": "Long digit run in the URL",
    "longest_label": "Very long hostname label",
}


def split_url(url: str) -> tuple[str, str, str]:
    if not re.match(r"^https?://", url, re.I):
        url = f"http://{url}"
    try:
        parts = urlsplit(url)
        host = (parts.hostname or "").lower().removeprefix("www.")
        # "/" and "" are the same page; www is noise. Neither should carry signal.
        return host, "" if parts.path == "/" else parts.path, parts.query or ""
    except ValueError:
        return "", "", ""


def url_text(url: str) -> str:
    """Scheme-free text fed to the character n-gram model."""
    host, path, query = split_url(url)
    return f"{host}{path}{'?' + query if query else ''}"[:300]


def url_features(url: str) -> list[float]:
    host, path, query = split_url(url)
    sub, sld, suffix = split_domain(host) if host else ("", "", "")
    domain = registrable(host) if host else ""
    try:
        ipaddress.ip_address(host)
        ip_host = 1.0
    except ValueError:
        ip_host = 0.0
    lowered_path = path.lower()
    host_for_words = host.replace(domain, sld) if domain else host
    owned = domain in OFFICIAL
    labels = host.split(".") if host else [""]
    decoded = to_unicode_host(host) if "xn--" in host else host
    digit_runs = re.findall(r"\d+", host + path)
    return [
        len(host),
        len(path),
        len(query),
        host.count("."),
        host.count("-"),
        sum(char.isdigit() for char in host),
        sum(char.isdigit() for char in host) / max(len(host), 1),
        len(sub.split(".")) if sub else 0,
        path.count("/"),
        ip_host,
        1.0 if "@" in url else 0.0,
        1.0 if "xn--" in host else 0.0,
        shannon_entropy(host),
        shannon_entropy(sld),
        sum(char in "aeiou" for char in sld) / max(len(sld), 1),
        sum(word in host_for_words for word in LURE_WORDS),
        sum(word in lowered_path for word in LURE_WORDS),
        1.0 if not owned and any(token in host for token in BRAND_TOKENS) else 0.0,
        1.0 if not owned and any(token in lowered_path for token in BRAND_TOKENS) else 0.0,
        1.0 if not owned and any(token in sub for token in BRAND_TOKENS) else 0.0,
        1.0 if suffix.rsplit(".", 1)[-1] in HIGH_ABUSE_TLDS else 0.0,
        1.0 if host.endswith(FREE_HOSTS) else 0.0,
        1.0 if domain in SHORTENERS else 0.0,
        query.count("=") + 0.0,
        max((len(run) for run in digit_runs), default=0),
        max(len(label) for label in labels),
        1.0 if not decoded.isascii() else 0.0,
        1.0 if "//" in path else 0.0,
        1.0 if re.search(r"\.(php|html?|asp|aspx)$", lowered_path) else 0.0,
        url.count("%"),
    ]


JS_FEATURE_NAMES = [
    "log_size", "entropy", "whitespace_ratio", "symbol_ratio", "digit_ratio", "mean_line_length",
    "hex_escapes_per_kb", "unicode_escapes_per_kb", "hex_identifiers_per_kb", "hex_literals_per_kb",
    "eval_per_kb", "atob_per_kb", "charcode_per_kb", "unescape_per_kb", "bracket_strings_per_kb",
    "string_share", "long_string_share", "packer_signature", "mean_identifier_length", "short_identifier_share",
]

_string_re = re.compile(r"\"(?:[^\"\\\n]|\\.){0,4000}\"|'(?:[^'\\\n]|\\.){0,4000}'")
_ident_re = re.compile(r"\b[A-Za-z_$][\w$]*\b")


def js_features(source: str) -> list[float]:
    source = source[:400_000]
    size = max(len(source), 1)
    kb = size / 1024
    strings = [match.group(0) for match in _string_re.finditer(source)]
    string_chars = sum(len(item) for item in strings)
    identifiers = _ident_re.findall(source)
    lines = source.count("\n") + 1
    return [
        float(np.log1p(size)),
        shannon_entropy(source[:100_000]),
        sum(char.isspace() for char in source[:100_000]) / min(size, 100_000),
        sum(not char.isalnum() and not char.isspace() for char in source[:100_000]) / min(size, 100_000),
        sum(char.isdigit() for char in source[:100_000]) / min(size, 100_000),
        size / lines,
        len(re.findall(r"\\x[0-9a-fA-F]{2}", source)) / kb,
        len(re.findall(r"\\u[0-9a-fA-F]{4}", source)) / kb,
        len(re.findall(r"\b_0x[0-9a-f]{3,}", source)) / kb,
        len(re.findall(r"\b0x[0-9a-fA-F]+\b", source)) / kb,
        source.count("eval(") / kb,
        source.count("atob(") / kb,
        source.count("fromCharCode") / kb,
        source.count("unescape(") / kb,
        len(re.findall(r"\[\s*['\"][^'\"]{1,40}['\"]\s*\]", source)) / kb,
        string_chars / size,
        sum(len(item) for item in strings if len(item) > 200) / size,
        1.0 if re.search(r"eval\(function\(p,a,c,k,e,[dr]\)", source) else 0.0,
        float(np.mean([len(item) for item in identifiers])) if identifiers else 0.0,
        sum(len(item) <= 2 for item in identifiers) / max(len(identifiers), 1),
    ]
