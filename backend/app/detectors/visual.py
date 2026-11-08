"""Modules 4 and 10: visual similarity against brand sites, favicon and logo hash matching."""
import base64
import io
from urllib.parse import urljoin, urlsplit

import cv2
import imagehash
import mmh3
import numpy as np
from PIL import Image, UnidentifiedImageError

from ..db import get_db
from ..net.fetcher import fetch
from ..util import clamp, registrable
from .common import assess_lookalike, base, findings_sorted, indicator, official_brand, signal

MAX_ICON_BYTES = 1024 * 1024
BANDS = [("Header & navigation", 0.0, 0.16), ("Credential form", 0.16, 0.68), ("Trust badges", 0.68, 0.84), ("Footer & legal", 0.84, 1.0)]
BAND_NOTES = {
    "Header & navigation": "Top of the page, where logo and menu sit",
    "Credential form": "Main content area, where a sign-in form usually sits",
    "Trust badges": "Area below the main content",
    "Footer & legal": "Bottom of the viewport",
}
CLONE_THRESHOLD = 72
PARTIAL_THRESHOLD = 45
ICON_MATCH = 90


def _hamming_similarity(first: str, second: str) -> float:
    return 100 * (1 - (imagehash.hex_to_hash(first) - imagehash.hex_to_hash(second)) / 64)


def visual_features(png: bytes) -> dict:
    image = Image.open(io.BytesIO(png)).convert("RGB")
    array = np.array(image)
    hsv = cv2.cvtColor(array, cv2.COLOR_RGB2HSV)
    histogram = cv2.calcHist([hsv], [0, 1], None, [16, 4], [0, 180, 0, 256]).flatten()
    gray = cv2.cvtColor(array, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 80, 160)
    grid = cv2.resize(edges.astype("float32") / 255, (16, 10), interpolation=cv2.INTER_AREA).flatten()
    height = image.height
    bands = [str(imagehash.phash(image.crop((0, int(height * top), image.width, int(height * bottom))))) for _, top, bottom in BANDS]
    logo = str(imagehash.phash(image.crop((0, 0, image.width // 3, int(height * 0.16)))))
    palette = image.convert("P", palette=Image.Palette.ADAPTIVE, colors=4).convert("RGB").getcolors(maxcolors=4096) or []
    palette.sort(reverse=True)
    return {
        "phash": str(imagehash.phash(image)),
        "dhash": str(imagehash.dhash(image)),
        "hist": [round(float(value), 4) for value in histogram / max(histogram.sum(), 1)],
        "edges": [round(float(value), 4) for value in grid],
        "bands": bands,
        "logo": logo,
        "palette": ["#%02x%02x%02x" % colour for _, colour in palette[:3]],
    }


def form_profile(soup) -> dict:
    inputs = soup.find_all("input")
    return {
        "password": sum((item.get("type") or "").lower() == "password" for item in inputs),
        "text": sum((item.get("type") or "text").lower() in ("text", "email", "tel", "number") for item in inputs),
        "buttons": len(soup.find_all("button")) + sum((item.get("type") or "").lower() == "submit" for item in inputs),
    }


def _corr(first: list, second: list) -> float:
    a, b = np.asarray(first, dtype=float), np.asarray(second, dtype=float)
    if a.std() == 0 or b.std() == 0:
        return 0.0
    return float(np.corrcoef(a, b)[0, 1])


def _form_similarity(first: dict, second: dict) -> float:
    if not any(second.values()) or not any(first.values()):
        return 35.0
    gaps = abs(first["password"] - second["password"]) * 2 + abs(first["text"] - second["text"]) + abs(first["buttons"] - second["buttons"])
    return clamp(100 - gaps * 16)


def compare(features: dict, fonts: list, form: dict, reference: dict) -> dict:
    visual = reference["visual"]
    layout = 0.6 * _hamming_similarity(features["phash"], visual["phash"]) + 0.4 * clamp(_corr(features["edges"], visual["edges"]) * 100)
    colour = clamp(_corr(features["hist"], visual["hist"]) * 100)
    logo = _hamming_similarity(features["logo"], visual["logo"])
    shared = set(fonts) & set(reference.get("fonts") or [])
    typography = 100 * len(shared) / max(len(set(fonts) | set(reference.get("fonts") or [])), 1) if fonts and reference.get("fonts") else 40.0
    form_score = _form_similarity(form, reference.get("form") or {})
    score = 0.42 * layout + 0.22 * colour + 0.1 * typography + 0.1 * form_score + 0.16 * logo
    return {"score": score, "layout": layout, "colour": colour, "typography": typography, "form": form_score, "logo": logo}


def _render_kind(soup) -> str:
    return "login" if form_profile(soup)["password"] else "landing"


def visual_similarity(ctx) -> dict:
    assessment = assess_lookalike(ctx.host, ctx.raw_host)
    render = ctx.render
    result = base(ctx)
    references = list(get_db().brand_assets.find({"visual": {"$exists": True}}))
    if not render or not references:
        reason = "the target could not be rendered" if not render else "no brand references are loaded"
        ctx.note(f"Visual comparison was not run because {reason}.")
        result.update({
            "score": 0, "verdict": "distinct", "brand": assessment.get("brand") or "None",
            "legitimate": {"url": "Unavailable", "title": "No reference", "palette": ["#94a3b8", "#cbd5e1", "#f1f5f9"], "render": "landing"},
            "suspect": {"url": ctx.final_url, "title": "Not rendered", "palette": ["#94a3b8", "#cbd5e1", "#f1f5f9"], "render": "landing"},
            "similarity": [{"aspect": aspect, "value": 0} for aspect in ("Layout structure", "Colour palette", "Typography", "Form composition", "Logo geometry")],
            "regions": [{"label": label, "match": 0, "note": "Not evaluated"} for label, _, _ in BANDS],
            "findings": [{"severity": "info", "title": "Comparison not run", "detail": f"Visual comparison was skipped because {reason}."}],
        })
        result["_signal"] = signal(0, "impersonation", evaluated=False)
        return result

    features = visual_features(render["screenshot"])
    form = form_profile(ctx.soup)
    scored = [(compare(features, render["fonts"], form, reference), reference) for reference in references]
    # Prefer the brand the domain or page claims to be, unless another brand is a clearly closer match.
    title = (render["title"] or "").lower()
    def priority(item):
        scores, reference = item
        claimed = reference["brand"] == assessment.get("brand") or any(keyword in title for keyword in reference.get("keywords", []))
        return scores["score"] + (6 if claimed else 0)
    best_scores, best = max(scored, key=priority)
    host_owner = official_brand(ctx.host)
    final_owner = official_brand(registrable_host(ctx.final_url))
    owned = (host_owner or final_owner) and (host_owner or final_owner)["brand"] == best["brand"]
    raw = best_scores["score"]
    claimed = best["brand"] == assessment.get("brand") or any(keyword in title for keyword in best.get("keywords", []))
    # Generic pages look alike, so a high score only counts as a clone when the page claims the brand.
    score = int(clamp(raw if claimed or raw >= 85 else raw * 0.6))
    if owned:
        score = min(score, 10)
    verdict = "clone" if score >= CLONE_THRESHOLD else "partial" if score >= PARTIAL_THRESHOLD else "distinct"

    bands = []
    for index, (label, _, _) in enumerate(BANDS):
        bands.append({"label": label, "match": int(_hamming_similarity(features["bands"][index], best["visual"]["bands"][index])), "note": BAND_NOTES[label]})

    findings, indicators, positives = [], [], []
    if owned:
        findings.append({"severity": "info", "title": "Official brand domain", "detail": f"This page matches {best['brand']} and is hosted on a domain that brand owns."})
        positives.append(f"Page appearance is consistent with {best['brand']} on its own domain")
    elif verdict == "clone":
        findings.append({"severity": "critical", "title": f"Page closely resembles {best['brand']}", "detail": f"Rendered appearance is {score}% similar to {best['domain']}, on a domain the brand does not own."})
        if form["password"]:
            findings.append({"severity": "high", "title": "Credential form on the lookalike", "detail": "The page asks for a password while imitating another site."})
        indicators.append(indicator("visual-clone", "critical", f"Page clones {best['brand']}", f"The rendered page is {score}% similar to {best['domain']} but is hosted elsewhere.", f"Layout {int(best_scores['layout'])}% · colour {int(best_scores['colour'])}%"))
    elif verdict == "partial":
        findings.append({"severity": "medium", "title": f"Some resemblance to {best['brand']}", "detail": f"Rendered appearance is {score}% similar to {best['domain']}. This may be coincidence or light imitation."})
    else:
        findings.append({"severity": "info", "title": "No clone detected", "detail": f"The closest reference was {best['brand']} at {score}%."})

    render_kind = _render_kind(ctx.soup)
    result.update({
        "score": score,
        "verdict": verdict,
        "brand": best["brand"],
        "legitimate": {"url": best["url"], "title": best.get("title") or best["brand"], "palette": best["visual"]["palette"], "render": "login" if (best.get("form") or {}).get("password") else "landing"},
        "suspect": {"url": ctx.final_url, "title": render["title"] or "Untitled", "palette": features["palette"], "render": render_kind},
        "similarity": [
            {"aspect": "Layout structure", "value": int(best_scores["layout"])}, {"aspect": "Colour palette", "value": int(best_scores["colour"])},
            {"aspect": "Typography", "value": int(best_scores["typography"])}, {"aspect": "Form composition", "value": int(best_scores["form"])},
            {"aspect": "Logo geometry", "value": int(best_scores["logo"])},
        ],
        "regions": bands,
        "findings": findings_sorted(findings),
    })
    result["_signal"] = signal(score if verdict != "distinct" else 0, "impersonation", indicators, positives)
    return result


def registrable_host(url: str) -> str:
    return urlsplit(url).hostname or ""


# --- Favicon ---------------------------------------------------------------------------------------


def _icon_image(data: bytes) -> Image.Image | None:
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
        return None
    rgba = image.convert("RGBA")
    background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    return Image.alpha_composite(background, rgba).convert("RGB")


def icon_hashes(data: bytes) -> dict:
    image = _icon_image(data)
    output = {"mmh3": mmh3.hash(base64.encodebytes(data)), "phash": None, "dhash": None, "format": "SVG" if data.lstrip()[:5].lower() in (b"<svg ", b"<?xml") else "Unknown", "colors": []}
    if image is not None:
        output.update(phash=str(imagehash.phash(image)), dhash=str(imagehash.dhash(image)), format=Image.open(io.BytesIO(data)).format or "Unknown")
        reduced = image.convert("P", palette=Image.Palette.ADAPTIVE, colors=3).convert("RGB").getcolors(maxcolors=4096) or []
        output["colors"] = ["#%02x%02x%02x" % colour for _, colour in sorted(reduced, reverse=True)[:3]]
    return output


def locate_favicon(base_url: str, soup) -> str:
    for tag in soup.find_all("link"):
        rel = " ".join(tag.get("rel") or []).lower()
        if "icon" in rel and tag.get("href") and not tag["href"].startswith("data:"):
            return urljoin(base_url, tag["href"])
    return urljoin(base_url, "/favicon.ico")


def fetch_favicon(base_url: str, soup) -> tuple[str, bytes | None]:
    icon_url = locate_favicon(base_url, soup)
    response = fetch(icon_url, max_bytes=MAX_ICON_BYTES)
    if response.ok and response.status == 200 and response.body and not response.is_html:
        return icon_url, response.body
    fallback = urljoin(base_url, "/favicon.ico")
    if fallback != icon_url:
        response = fetch(fallback, max_bytes=MAX_ICON_BYTES)
        if response.ok and response.status == 200 and response.body and not response.is_html:
            return fallback, response.body
    return icon_url, None


def favicon_logo_hash(ctx) -> dict:
    result = base(ctx, f"https://{ctx.host}")
    tls = ctx.tls
    rdap = ctx.rdap
    certificate_org = (tls["leaf"]["subject_org"] if tls.get("reachable") else None) or "Not present (DV)"
    references = list(get_db().brand_assets.find({"favicon.phash": {"$ne": None}, "favicon": {"$exists": True}}))
    if not ctx.reachable:
        ctx.note("The favicon could not be fetched because the site is unreachable.")
        result.update({
            "score": 0,
            "favicon": {"found": False, "url": f"https://{ctx.host}/favicon.ico", "format": "None", "bytes": 0, "hash": "None", "perceptual": "None", "colors": []},
            "matches": [],
            "ownership": {"registrant": rdap["registrant"] or "Unknown", "brandOwner": "None", "aligned": True, "certificateOrg": certificate_org},
            "findings": [{"severity": "info", "title": "Not evaluated", "detail": "The site is unreachable, so no icon could be retrieved."}],
        })
        result["_signal"] = signal(0, "impersonation", evaluated=False)
        return result

    icon_url, data = fetch_favicon(ctx.final_url, ctx.soup)
    hashes = icon_hashes(data) if data else None
    matches = []
    if hashes:
        for reference in references:
            favicon = reference["favicon"]
            if hashes["mmh3"] == favicon.get("mmh3"):
                similarity = 100
            elif hashes["phash"] and favicon.get("phash"):
                similarity = int(_hamming_similarity(hashes["phash"], favicon["phash"]))
            else:
                continue
            owner = official_brand(registrable_host(ctx.final_url)) or official_brand(ctx.host)
            owned = bool(owner and owner["brand"] == reference["brand"]) or registrable(ctx.host) == reference["domain"]
            matches.append({"brand": reference["brand"], "similarity": similarity, "domain": reference["domain"], "verdict": "match" if similarity >= ICON_MATCH else "weak" if similarity >= 70 else "distinct", "owned": owned})
        matches.sort(key=lambda item: item["similarity"], reverse=True)
    top = matches[:3]
    brand_match = next((item for item in top if item["verdict"] == "match"), None)
    impersonating = bool(brand_match and not brand_match["owned"])
    findings, indicators, positives = [], [], []
    logo_note = _logo_check(ctx)
    if impersonating:
        findings.append({"severity": "critical", "title": f"Favicon matches {brand_match['brand']}", "detail": f"The icon is {brand_match['similarity']}% similar to the one on {brand_match['domain']}, but this domain is not owned by that brand."})
        indicators.append(indicator("favicon-match", "critical", f"Uses the {brand_match['brand']} icon", "The site serves a real brand's icon on a domain that brand does not own.", f"mmh3:{hashes['mmh3']} · {brand_match['similarity']}%"))
    elif brand_match:
        findings.append({"severity": "info", "title": "Assets consistent with owner", "detail": f"The favicon matches {brand_match['brand']} on a domain that brand owns."})
        positives.append(f"Favicon matches {brand_match['brand']} on its own domain")
    elif data is None:
        findings.append({"severity": "low", "title": "No favicon served", "detail": "Most maintained sites publish an icon. Disposable pages often skip it."})
    else:
        findings.append({"severity": "info", "title": "No brand match", "detail": "The favicon does not match any monitored brand."})
    if logo_note:
        findings.append(logo_note["finding"])
        if not impersonating:
            indicators.extend(logo_note["indicators"])
    score = 0
    if impersonating:
        score = brand_match["similarity"]
    elif logo_note:
        score = logo_note["similarity"]
    result.update({
        "score": int(score),
        "favicon": {
            "found": bool(data), "url": icon_url, "format": hashes["format"] if hashes else "None", "bytes": len(data or b""),
            "hash": f"mmh3:{hashes['mmh3']}" if hashes else "None", "perceptual": (hashes["phash"] or "Unavailable") if hashes else "None", "colors": hashes["colors"] if hashes else [],
        },
        "matches": top,
        "ownership": {
            "registrant": rdap["registrant"] or ("Privacy protected" if rdap["privacy"] else "Unknown"), "brandOwner": (brand_match or {}).get("brand", "None"),
            "aligned": not impersonating, "certificateOrg": certificate_org,
        },
        "findings": findings_sorted(findings),
    })
    result["_signal"] = signal(score, "impersonation", indicators, positives)
    return result


def _logo_check(ctx) -> dict | None:
    """Compare an on-page logo image against stored brand logos."""
    references = [item for item in get_db().brand_assets.find({"logo_phash": {"$ne": None, "$exists": True}})]
    if not references:
        return None
    candidate = next(
        (tag.get("src") for tag in ctx.soup.find_all("img")
         if tag.get("src") and not tag["src"].startswith("data:") and "logo" in " ".join([tag.get("src", ""), tag.get("alt", ""), " ".join(tag.get("class") or []), tag.get("id", "")]).lower()),
        None,
    )
    if not candidate:
        return None
    response = fetch(urljoin(ctx.final_url, candidate), max_bytes=MAX_ICON_BYTES)
    if not response.ok or response.status != 200:
        return None
    image = _icon_image(response.body)
    if image is None:
        return None
    logo_hash = str(imagehash.phash(image))
    similarity, reference = max(((_hamming_similarity(logo_hash, item["logo_phash"]), item) for item in references), key=lambda pair: pair[0])
    owner = official_brand(ctx.host)
    if similarity < 92 or (owner and owner["brand"] == reference["brand"]):
        return None
    return {
        "similarity": int(similarity),
        "finding": {"severity": "high", "title": f"Logo matches {reference['brand']}", "detail": f"An on-page logo is {int(similarity)}% similar to the {reference['brand']} logo."},
        "indicators": [indicator("logo-match", "high", f"Uses the {reference['brand']} logo", "An on-page logo closely matches a real brand on a domain that brand does not own.", candidate)],
    }
