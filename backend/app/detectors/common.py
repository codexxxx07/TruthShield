"""Shared detector helpers, and the lookalike engine used by several modules."""
import unicodedata
from functools import lru_cache

from ..util import load_json, now_iso, registrable, split_domain, to_unicode_host, tranco_ranks

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
BRANDS = load_json("brands.json")
_OFFICIAL_INDEX = {domain: brand for brand in BRANDS for domain in brand["official"]}

LURE_TOKENS = {
    "login", "signin", "logon", "verify", "verification", "secure", "security", "account", "update", "confirm", "bank", "banking",
    "netbanking", "kyc", "wallet", "gift", "prize", "claim", "support", "help", "helpdesk", "invoice", "unlock", "recovery", "password",
    "billing", "refund", "delivery", "reward", "rewards", "bonus", "alert", "online", "service", "services", "auth", "portal", "pay",
    "payment", "offer", "cashback", "otp", "official", "customer", "care", "app", "web", "id",
}
# Longer words that attackers misspell next to a brand name, as in sbi-onIine.
FUZZY_LURES = sorted(word for word in LURE_TOKENS if len(word) >= 5)

# Visual confusables. Target is the ASCII letter a reader would see.
CONFUSABLES = {
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "һ": "h", "ԁ": "d", "ԛ": "q", "ԝ": "w",
    "ɡ": "g", "ⅼ": "l", "ӏ": "l", "ı": "i", "ο": "o", "α": "a", "ν": "v", "τ": "t", "ρ": "p", "κ": "k", "ѵ": "v", "ո": "n", "ս": "u", "ց": "g", "օ": "o",
}
ASCII_LOOKALIKES = {"0": "o", "1": "l", "3": "e", "5": "s", "7": "t", "4": "a", "8": "b", "$": "s", "|": "l"}
CONFUSABLE_NAMES = [("а", "a"), ("о", "o"), ("е", "e"), ("р", "p"), ("с", "c"), ("і", "i"), ("ⅼ", "l"), ("ӏ", "l")]


def findings_sorted(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda item: SEVERITY_ORDER.get(item.get("severity", "info"), 4))


def base(ctx, target: str | None = None) -> dict:
    return {"target": target or ctx.domain or ctx.host, "generatedAt": now_iso(), "live": True}


def signal(risk: float, category: str, indicators: list[dict] | None = None, positives: list[str] | None = None, evaluated: bool = True) -> dict:
    """Internal summary a detector contributes to the fused full-scan verdict."""
    return {"risk": max(0.0, min(100.0, float(risk))), "category": category, "indicators": indicators or [], "positives": positives or [], "evaluated": evaluated}


def indicator(id_: str, severity: str, label: str, detail: str, evidence: str) -> dict:
    return {"id": id_, "severity": severity, "label": label, "detail": detail, "evidence": str(evidence)[:300]}


def levenshtein(first: str, second: str, limit: int = 4) -> int:
    if abs(len(first) - len(second)) > limit:
        return limit + 1
    previous = list(range(len(second) + 1))
    for row, left in enumerate(first, 1):
        current = [row]
        for column, right in enumerate(second, 1):
            current.append(min(previous[column] + 1, current[column - 1] + 1, previous[column - 1] + (left != right)))
        previous = current
    return previous[-1]


def skeleton(label: str) -> str:
    """Map a label to what a reader sees: unify confusables, digits and multi-letter tricks."""
    decomposed = unicodedata.normalize("NFKD", label)
    plain = "".join(char for char in decomposed if not unicodedata.combining(char))
    mapped = "".join(CONFUSABLES.get(char, char) for char in plain.lower())
    mapped = "".join(ASCII_LOOKALIKES.get(char, char) for char in mapped)
    return mapped.replace("rn", "m").replace("vv", "w").replace("cl", "d")


def script_of(char: str) -> str:
    try:
        return unicodedata.name(char).split(" ")[0]
    except ValueError:
        return "UNKNOWN"


def official_brand(host: str) -> dict | None:
    domain = registrable(host)
    if domain in _OFFICIAL_INDEX:
        return _OFFICIAL_INDEX[domain]
    return _OFFICIAL_INDEX.get(split_domain(host)[1]) if not split_domain(host)[2] else None


@lru_cache(maxsize=1)
def _common_labels() -> frozenset:
    """Ordinary words one edit from a brand (finance/binance, email/gmail) are not typos of it."""
    return frozenset({domain.split(".")[0] for domain in tranco_ranks()} | {"cloud", "email", "finance", "room", "phase", "apply", "abode", "goggle", "telegraph"})


@lru_cache(maxsize=2048)
def _assess(host: str, typed: str) -> tuple:
    decoded = to_unicode_host(host) if "xn--" in host else host
    sub, sld, suffix = split_domain(decoded)
    tokens = [token for token in sld.split("-") if token]
    sub_tokens = [token for part in sub.split(".") for token in part.split("-") if token]
    scripts = {script_of(char) for char in sld if char.isalpha()}
    mixed = len(scripts) > 1
    non_latin = bool(scripts - {"LATIN"})
    typed_sld = split_domain(typed)[1] if typed else sld
    # Uppercase I standing in for lowercase l only exists in the typed form; DNS folds case.
    capital_i = "I" in typed_sld and any(char.islower() for char in typed_sld)

    best = None
    def consider(brand, keyword, technique, score, detail):
        nonlocal best
        if best is None or score > best[3]:
            best = (brand["brand"], keyword, technique, score, detail)

    lures = [token for token in tokens + sub_tokens if token in LURE_TOKENS]
    misspelt_lures = sorted({lure for token in tokens + sub_tokens if token not in LURE_TOKENS and len(token) >= 5
                             for lure in FUZZY_LURES if levenshtein(skeleton(token).replace("i", "l"), lure.replace("i", "l"), 1) <= 1 or levenshtein(token, lure, 1) == 1})
    joined_sk = skeleton(sld.replace("-", ""))

    for brand in BRANDS:
        for keyword in brand["keywords"]:
            word = keyword.lower()
            sk_word = skeleton(word)
            if non_latin and (skeleton(sld) == sk_word or any(skeleton(token) == sk_word for token in tokens)):
                consider(brand, word, "Unicode homoglyph", 97, f"The label renders as “{word}” but uses {'mixed scripts' if mixed else 'non-Latin characters'}.")
            exact_token = word in tokens
            if exact_token or sld == word:
                score = 88 if lures else 62
                if misspelt_lures:
                    score = 92
                    consider(brand, word, "Brand with misspelt keyword", score, f"Uses “{word}” with a misspelling of “{misspelt_lures[0]}”.")
                consider(brand, word, "Brand with lure keyword" if lures else "Brand name on unrelated domain", score,
                         f"Uses “{word}” on a domain the brand does not own." + (f" Paired with “{lures[0]}”." if lures else ""))
            if word in sub_tokens or (sub and any(part == word for part in sub.split("."))):
                consider(brand, word, "Brand as subdomain", 86, f"“{word}” is used as a subdomain of an unrelated domain.")
            if len(word) >= 5 and word in sld.replace("-", "") and not exact_token:
                remainder = sld.replace("-", "").replace(word, "", 1)
                if any(lure in remainder for lure in LURE_TOKENS if len(lure) >= 3):
                    consider(brand, word, "Brand joined with lure keyword", 84, f"Combines “{word}” with “{remainder}”.")
            if len(word) >= 4:
                for candidate in tokens + [sld.replace("-", "")]:
                    if candidate == word:
                        continue
                    if skeleton(candidate) == sk_word:
                        consider(brand, word, "ASCII homoglyph", 93, f"“{candidate}” looks like “{word}” once similar characters are unified.")
                    elif candidate not in _common_labels():
                        allowed = 1 if len(word) < 8 else 2
                        distance = levenshtein(candidate, word, allowed)
                        if 0 < distance <= allowed:
                            consider(brand, word, "Typosquat", 90 if lures else 82, f"“{candidate}” is {distance} edit{'s' if distance > 1 else ''} from “{word}”.")
            elif len(word) == 3 and joined_sk == sk_word and sld != word:
                consider(brand, word, "ASCII homoglyph", 88, f"“{sld}” looks like “{word}”.")
    return best, tuple(lures), tuple(misspelt_lures), mixed, non_latin, capital_i


def assess_lookalike(host: str, typed: str | None = None) -> dict:
    """Decide whether a hostname impersonates a known brand, without any network access."""
    official = official_brand(host)
    if official:
        return {"official": True, "brand": official["brand"], "keyword": None, "technique": None, "risk": 0, "detail": None,
                "lures": [], "misspeltLures": [], "mixedScript": False, "nonLatin": False}
    best, lures, misspelt, mixed, non_latin, capital_i = _assess(host, typed or host)
    risk = best[3] if best else 0
    if best is None and non_latin and mixed:
        risk = 70
    result = {
        "official": False, "brand": best[0] if best else None, "keyword": best[1] if best else None, "technique": best[2] if best else None,
        "risk": risk, "detail": best[4] if best else None, "lures": list(lures), "misspeltLures": list(misspelt),
        "mixedScript": mixed, "nonLatin": non_latin, "capitalI": capital_i and bool(best),
    }
    if result["capitalI"]:
        result["risk"] = max(result["risk"], 92)
        result["detail"] = f"{result['detail']} The address uses a capital I where a lowercase l would be expected."
    return result
