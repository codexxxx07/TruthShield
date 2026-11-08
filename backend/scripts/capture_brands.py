"""Fingerprint real brand sites into data/brand_assets.json.

Run from backend/ with: .venv/bin/python -m scripts.capture_brands
Only hashes and colour features are stored, never the screenshots themselves.
"""
import json
import logging
from concurrent.futures import ThreadPoolExecutor

from bs4 import BeautifulSoup

from app.config import DATA_DIR
from app.detectors.visual import fetch_favicon, form_profile, icon_hashes, visual_features
from app.net import browser
from app.util import load_json, registrable
from urllib.parse import urlsplit

log = logging.getLogger("capture")


def capture(brand: dict) -> dict | None:
    render = browser.render(brand["url"])
    if not render or render["status"] >= 400:
        log.warning("%s: render failed (%s)", brand["brand"], render and render["status"])
        return None
    soup = BeautifulSoup(render["html"], "html.parser")
    _, icon = fetch_favicon(render["url"], soup)
    record = {
        "brand": brand["brand"], "domain": registrable(urlsplit(render["url"]).hostname), "url": render["url"], "title": render["title"], "keywords": brand["keywords"],
        "visual": visual_features(render["screenshot"]), "fonts": render["fonts"], "form": form_profile(soup),
    }
    if icon:
        record["favicon"] = {key: value for key, value in icon_hashes(icon).items() if key in ("mmh3", "phash", "dhash")}
    log.info("%s: captured", brand["brand"])
    return record


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    path = DATA_DIR / "brand_assets.json"
    existing = {item["brand"]: item for item in json.loads(path.read_text())} if path.exists() else {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        for record in pool.map(capture, load_json("brands.json")):
            if record:
                existing[record["brand"]] = record
    path.write_text(json.dumps(list(existing.values()), indent=0, ensure_ascii=False))
    print(f"{len(existing)} brands saved to {path}")


if __name__ == "__main__":
    main()
