"""MongoDB connection. Falls back to mongomock so the API still boots without a server."""
import logging
import threading

import pymongo
from pymongo.errors import PyMongoError

from .config import settings

log = logging.getLogger("truthshield.db")

_lock = threading.Lock()
_db = None
is_mock = False


def get_db():
    global _db, is_mock
    if _db is not None:
        return _db
    with _lock:
        if _db is not None:
            return _db
        client = pymongo.MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=1500, tz_aware=True)
        try:
            client.admin.command("ping")
            log.info("Connected to MongoDB at %s", settings.mongo_uri)
        except PyMongoError as error:
            if not settings.allow_mock_db:
                raise
            import mongomock

            log.warning("=" * 72)
            log.warning("MongoDB is unreachable (%s).", type(error).__name__)
            log.warning("Using an IN-MEMORY mock database. Data is LOST when the server stops.")
            log.warning("=" * 72)
            client = mongomock.MongoClient(tz_aware=True)
            is_mock = True
        _db = client[settings.mongo_db]
        _ensure_indexes(_db)
        return _db


def _ensure_indexes(db) -> None:
    db.users.create_index("email", unique=True)
    db.scans.create_index([("createdAt", pymongo.DESCENDING)])
    db.scans.create_index("domain")
    db.detections.create_index([("slug", 1), ("target", 1)], unique=True)
    db.threats.create_index("indicator", unique=True)
    db.reports.create_index([("createdAt", pymongo.DESCENDING)])
    db.reports.create_index("domain")
    db.upi_reports.create_index("vpa")
    db.brand_assets.create_index("brand", unique=True)
    db.page_fingerprints.create_index("registrable", unique=True)
    db.page_fingerprints.create_index("assets")
    db.dns_history.create_index([("domain", 1), ("seenAt", -1)])
    db.dns_history.create_index("ips")
    db.ct_matches.create_index("cert_id", unique=True)
    db.ct_matches.create_index("brand")
    db.ct_alerts.create_index([("time", pymongo.DESCENDING)])
    db.ct_log_state.create_index("log_url", unique=True)


def public(document: dict | None) -> dict | None:
    """Drop Mongo's ObjectId so a document can be returned as JSON."""
    if document is None:
        return None
    return {key: value for key, value in document.items() if key != "_id"}
