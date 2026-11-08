"""Module 5: typosquatting and homoglyph detection."""
import unicodedata
from concurrent.futures import ThreadPoolExecutor

from ..net import dnsinfo
from ..util import clamp, split_domain, to_ascii_host, to_unicode_host
from .common import CONFUSABLES, assess_lookalike, base, indicator, signal

KEYBOARD = {
    "q": "wa", "w": "qes", "e": "wrd", "r": "etf", "t": "ryg", "y": "tuh", "u": "yij", "i": "uok", "o": "ipl", "p": "ol",
    "a": "qsz", "s": "awdx", "d": "sefc", "f": "drgv", "g": "fthb", "h": "gyjn", "j": "hukm", "k": "jil", "l": "kop",
    "z": "asx", "x": "zsc", "c": "xdv", "v": "cfb", "b": "vgn", "n": "bhm", "m": "nj",
}
ASCII_SWAPS = {"o": "0", "l": "1", "i": "l", "e": "3", "a": "4", "s": "5", "m": "rn", "w": "vv", "d": "cl"}
CYRILLIC = {ascii_char: glyph for glyph, ascii_char in CONFUSABLES.items() if "CYRILLIC" in unicodedata.name(glyph, "")}
KEYWORDS = ["login", "verify", "secure", "account", "support", "online", "update", "kyc", "pay", "help"]
ALT_TLDS = ["co", "net", "org", "info", "xyz", "top", "click", "online", "site", "shop", "app", "in", "cm"]
TECHNIQUE_BASE = {
    "Cyrillic homoglyph": 90, "Digit substitution": 78, "Letter lookalike": 78, "Keyword append": 76, "Keyword prepend": 74,
    "TLD swap": 62, "Character omission": 66, "Transposition": 68, "Keyboard typo": 60, "Character duplication": 56, "Hyphen insertion": 58,
}


def generate_variants(domain: str, limit: int = 400) -> list[dict]:
    _, sld, suffix = split_domain(domain)
    variants: dict[str, tuple[str, int]] = {}

    def add(label: str, tld: str, technique: str, distance: int) -> None:
        label = label.strip("-")
        if not label or label == sld and tld == suffix:
            return
        variants.setdefault(f"{label}.{tld}", (technique, distance))

    for index, char in enumerate(sld):
        if len(sld) > 3:
            add(sld[:index] + sld[index + 1:], suffix, "Character omission", 1)
        if index < len(sld) - 1 and sld[index] != sld[index + 1]:
            add(sld[:index] + sld[index + 1] + sld[index] + sld[index + 2:], suffix, "Transposition", 2)
        add(sld[:index] + char + sld[index:], suffix, "Character duplication", 1)
        if char in ASCII_SWAPS:
            add(sld[:index] + ASCII_SWAPS[char] + sld[index + 1:], suffix, "Digit substitution" if ASCII_SWAPS[char].isdigit() else "Letter lookalike", 1)
        if char in CYRILLIC:
            add(sld[:index] + CYRILLIC[char] + sld[index + 1:], suffix, "Cyrillic homoglyph", 1)
        for neighbour in KEYBOARD.get(char, ""):
            add(sld[:index] + neighbour + sld[index + 1:], suffix, "Keyboard typo", 1)
        if 0 < index < len(sld) - 1 and char != "-":
            add(sld[:index] + "-" + sld[index:], suffix, "Hyphen insertion", 1)
    fully_cyrillic = "".join(CYRILLIC.get(char, char) for char in sld)
    if fully_cyrillic != sld:
        add(fully_cyrillic, suffix, "Cyrillic homoglyph", sum(a != b for a, b in zip(sld, fully_cyrillic)))
    for keyword in KEYWORDS:
        add(f"{sld}-{keyword}", suffix, "Keyword append", 0)
        add(f"{keyword}-{sld}", suffix, "Keyword prepend", 0)
    for tld in ALT_TLDS:
        if tld != suffix:
            add(sld, tld, "TLD swap", 0)

    output = []
    for name, (technique, distance) in variants.items():
        try:
            ascii_name = to_ascii_host(name)
        except ValueError:
            continue
        output.append({
            "domain": name, "ascii": ascii_name, "distance": distance, "technique": technique, "registered": False, "ageDays": None,
            "risk": TECHNIQUE_BASE[technique],
        })
    output.sort(key=lambda item: item["risk"], reverse=True)
    return output[:limit]


def check_registered(variants: list[dict], limit: int = 150) -> list[dict]:
    """Resolve the most dangerous candidates; a name that resolves is treated as registered."""
    subset = variants[:limit]
    with ThreadPoolExecutor(max_workers=24) as pool:
        for variant, resolved in zip(subset, pool.map(lambda item: dnsinfo.domain_resolves(item["ascii"]), subset)):
            variant["registered"] = resolved
    return [variant for variant in subset if variant["registered"]]


def _rate(variant: dict) -> None:
    if variant["registered"]:
        age = variant["ageDays"]
        boost = 8 + (12 if age is not None and age < 90 else 0) - (14 if age is not None and age > 1825 else 0)
        variant["risk"] = int(clamp(variant["risk"] + boost, 0, 99))
    else:
        variant["risk"] = int(variant["risk"] * 0.55)


def _unicode_table(decoded: str) -> list[dict]:
    present = {char for char in decoded if char in CONFUSABLES}
    table = []
    for glyph, ascii_char in list(CONFUSABLES.items())[:14]:
        table.append({"char": glyph, "name": unicodedata.name(glyph, "UNKNOWN"), "codepoint": f"U+{ord(glyph):04X}", "looksLike": ascii_char, "used": glyph in present})
    table.sort(key=lambda row: not row["used"])
    return table[:8]


def self_assessment(ctx) -> dict:
    return ctx.once("lookalike", lambda: assess_lookalike(ctx.host, ctx.raw_host))


def signal_from_lookalike(assessment: dict, ctx) -> dict:
    indicators, positives = [], []
    if assessment["official"]:
        positives.append(f"The domain belongs to {assessment['brand']}")
    elif assessment["technique"]:
        severity = "critical" if assessment["risk"] >= 88 else "high"
        indicators.append(indicator("lookalike", severity, f"Impersonates {assessment['brand']}: {assessment['technique'].lower()}", assessment["detail"], ctx.unicode_host))
    return signal(assessment["risk"], "impersonation", indicators, positives)


def typosquatting(ctx) -> dict:
    domain = ctx.domain
    assessment = self_assessment(ctx)
    all_variants = generate_variants(domain)
    registered = check_registered(all_variants)
    registered.sort(key=lambda item: item["risk"], reverse=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        for variant, rdap in zip(registered[:6], pool.map(lambda item: dnsinfo.lookup_rdap(item["ascii"]), registered[:6])):
            variant["ageDays"] = rdap["ageDays"]
    for variant in all_variants:
        _rate(variant)
    registered_count = len(registered)
    high_risk = sum(item["risk"] > 70 for item in registered)

    # Show every registered lookalike first, then the most dangerous names still open to attackers.
    ordered = sorted(registered, key=lambda item: item["risk"], reverse=True)[:18]
    ordered += sorted((item for item in all_variants if not item["registered"]), key=lambda item: item["risk"], reverse=True)[: 24 - len(ordered)]
    decoded = to_unicode_host(domain)
    exposure = clamp(high_risk * 12 + registered_count * 2, 0, 90)
    risk_score = int(max(assessment["risk"], exposure if not assessment["official"] else min(exposure, 60)))

    if assessment["technique"]:
        lead = f"{ctx.unicode_host} itself looks like an impersonation of {assessment['brand']} ({assessment['technique'].lower()}). {assessment['detail']}"
    elif assessment["official"]:
        lead = f"{domain} is an official {assessment['brand']} domain."
    else:
        lead = f"{domain} does not resemble a monitored brand."
    result = base(ctx, domain)
    result.update({
        "riskScore": risk_score,
        "permutations": {"total": len(all_variants), "registered": registered_count, "highRisk": high_risk, "monitored": min(len(all_variants), 150)},
        "variants": [{key: item[key] for key in ("domain", "distance", "technique", "registered", "ageDays", "risk")} for item in ordered],
        "unicode": _unicode_table(decoded),
        "summary": f"{lead} {registered_count} of the {min(len(all_variants), 150)} closest lookalikes currently resolve in DNS.",
        "assessment": {key: assessment.get(key) for key in ("official", "brand", "technique", "risk", "detail", "mixedScript")},
    })
    result["_signal"] = signal_from_lookalike(assessment, ctx)
    return result
