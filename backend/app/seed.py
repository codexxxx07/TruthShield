"""Load reference data into MongoDB at startup."""
import logging
from datetime import timedelta

import bcrypt

from .config import DATA_DIR, settings
from .db import get_db
from .util import load_json, to_iso, utcnow

log = logging.getLogger("truthshield.seed")
DEMO_EMAIL = "analyst@truthshield.demo"
DEMO_PASSWORD = "truthshield-demo"


def seed() -> None:
    db = get_db()
    # Reference tables are replaced on each boot so edits to the JSON files take effect.
    for row in load_json("ca_db.json"):
        db.ca_db.replace_one({"key": row["key"]}, row, upsert=True)
    if (DATA_DIR / "brand_assets.json").exists():
        for row in load_json("brand_assets.json"):
            db.brand_assets.replace_one({"brand": row["brand"]}, row, upsert=True)
    else:
        log.warning("data/brand_assets.json is missing. Run `python -m scripts.capture_brands` to enable visual and favicon matching.")
    if not settings.seed_demo_data:
        return
    if db.threats.count_documents({}) == 0:
        now = utcnow()
        for index, row in enumerate(load_json("seed_threats.json")["records"]):
            row = dict(row)
            row.update(
                firstSeen=to_iso(now - timedelta(days=30 + (index % 22) * 9, hours=index % 12)),
                lastSeen=to_iso(now - timedelta(days=index % 5, hours=index % 20)),
                demo=True,
            )
            db.threats.insert_one(row)
    if db.users.count_documents({"email": DEMO_EMAIL}) == 0:
        db.users.insert_one({
            "id": "usr_demo_01", "name": "Demo Analyst", "email": DEMO_EMAIL, "org": "TruthShield Demo", "role": "Security Analyst", "plan": "Demo workspace",
            "password": bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode(), "createdAt": utcnow(),
        })
