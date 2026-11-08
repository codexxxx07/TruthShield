"""HTTP routes. Handlers are plain functions, so FastAPI runs them on its worker threads."""
import secrets
from datetime import timedelta
from urllib.parse import urlsplit

import bcrypt
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

from .. import db as database
from ..config import settings
from ..context import Ctx
from ..db import get_db, public
from ..deps import auth_rate_limit, current_user, issue_token, optional_user, public_user, rate_limit
from ..detectors import ALL_SLUGS, DOMAIN_MODULES, URL_MODULES, upi, web
from ..ml.model import model_info, score_url
from ..services import scan as scan_service, tls_report
from ..services.stats import dashboard_payload, threat_payload
from ..util import InvalidTarget, normalize_url, now_iso, registrable, utcnow

router = APIRouter(prefix="/api")
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_IMAGES = {"image/png", "image/jpeg", "image/webp"}
REPORT_CATEGORIES = {
    "phishing": "Phishing", "fake-banking": "Fake Banking Website", "fake-recruitment": "Fake Recruitment Portal", "payment-fraud": "Payment Fraud",
    "brand-impersonation": "Brand Impersonation", "malware": "Malware", "suspicious-redirect": "Suspicious Redirect", "other": "Other",
}


class TargetBody(BaseModel):
    target: str = Field(max_length=2048)
    fresh: bool = False


class ScanBody(BaseModel):
    url: str = Field(max_length=2048)
    modules: list[str] | None = None
    fresh: bool = False


class SignupBody(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    org: str | None = Field(default=None, max_length=120)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(max_length=72)


class WatchBody(BaseModel):
    domain: str = Field(max_length=253)
    brand: str | None = Field(default=None, max_length=120)


class UpiReportBody(BaseModel):
    target: str = Field(max_length=2048)
    category: str = Field(max_length=80)
    note: str | None = Field(default=None, max_length=500)


def _bad_target(error: InvalidTarget) -> HTTPException:
    return HTTPException(status_code=422, detail=str(error))


def _cached(slug: str, target: str) -> dict | None:
    row = get_db().detections.find_one({"slug": slug, "target": target})
    if not row:
        return None
    created = row["createdAt"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=utcnow().tzinfo)
    return row["result"] if utcnow() - created < timedelta(seconds=settings.cache_ttl_seconds) else None


def _remember(slug: str, target: str, result: dict) -> None:
    get_db().detections.replace_one({"slug": slug, "target": target}, {"slug": slug, "target": target, "result": result, "createdAt": utcnow()}, upsert=True)


def _finish(result: dict, ctx: Ctx | None, slug: str) -> dict:
    output = {key: value for key, value in result.items() if not key.startswith("_")}
    output["tool"] = slug
    if ctx is not None:
        output.setdefault("limitations", [])
        output["limitations"] = list(dict.fromkeys(output["limitations"] + ctx.limitations))
    return output


@router.get("/health")
def health():
    get_db()
    models = model_info()
    logs = list(get_db().ct_log_state.find())
    return {
        "status": "ok", "time": now_iso(), "database": "mock (in-memory)" if database.is_mock else "mongodb", "browserEnabled": settings.enable_browser, "ctWatchEnabled": settings.enable_ct_watch,
        "models": [model["model"] for model in models], "modules": sorted(ALL_SLUGS),
        "ctWatch": {"logsTailed": len(logs), "certificatesScanned": sum(row.get("scanned", 0) for row in logs), "lookalikesFound": get_db().ct_matches.count_documents({})},
    }


# --- Auth ------------------------------------------------------------------------------------------


@router.post("/auth/signup", dependencies=[Depends(auth_rate_limit)], status_code=201)
def signup(body: SignupBody):
    if len(body.password.encode()) > 72:
        raise HTTPException(status_code=422, detail="Use a password of at most 72 bytes.")
    user = {
        "id": f"usr_{secrets.token_hex(8)}", "name": body.name.strip(), "email": body.email.lower(), "org": (body.org or "").strip() or "Personal workspace", "role": "Member", "plan": "Free workspace",
        "password": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(), "createdAt": utcnow(),
    }
    try:
        get_db().users.insert_one(user)
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
    return {"token": issue_token(user["id"]), "user": public_user(user)}


@router.post("/auth/login", dependencies=[Depends(auth_rate_limit)])
def login(body: LoginBody):
    user = get_db().users.find_one({"email": body.email.lower()})
    # Compare against a dummy hash when the account is unknown so timing does not reveal it.
    stored = user["password"].encode() if user else bcrypt.hashpw(b"unknown-account", bcrypt.gensalt())
    if not bcrypt.checkpw(body.password.encode(), stored) or user is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"token": issue_token(user["id"]), "user": public_user(user)}


@router.get("/auth/me")
def me(user: dict = Depends(current_user)):
    return {"user": public_user(user)}


# --- Scans and detectors ---------------------------------------------------------------------------


@router.post("/scan", dependencies=[Depends(rate_limit)])
def scan(body: ScanBody, user: dict | None = Depends(optional_user)):
    try:
        url, _ = normalize_url(body.url)
        cache_key = f"{url}|{','.join(sorted(body.modules)) if body.modules is not None else 'all'}"
        if not body.fresh and (cached := _cached("scan", cache_key)):
            return cached
        report = scan_service.run_scan(url, body.modules, user)
    except InvalidTarget as error:
        raise _bad_target(error) from error
    _remember("scan", cache_key, report)
    return report


@router.get("/scan/{scan_id}")
def get_scan(scan_id: str):
    report = scan_service.get_scan(scan_id)
    if report is None:
        raise HTTPException(status_code=404, detail="No scan with that ID.")
    return report


@router.post("/ssl", dependencies=[Depends(rate_limit)])
def ssl_report(body: TargetBody):
    try:
        ctx = Ctx.from_domain(body.target)
    except InvalidTarget as error:
        raise _bad_target(error) from error
    return tls_report.build(ctx)


@router.post("/assessment", dependencies=[Depends(rate_limit)])
def assessment(body: TargetBody):
    try:
        ctx = Ctx.from_domain(body.target)
    except InvalidTarget as error:
        raise _bad_target(error) from error
    return web.security_report(ctx)


@router.post("/detect/{slug}", dependencies=[Depends(rate_limit)])
def detect(slug: str, body: TargetBody):
    if slug not in ALL_SLUGS:
        raise HTTPException(status_code=404, detail="Unknown detection module.")
    target = body.target.strip()
    if not body.fresh and (cached := _cached(slug, target)):
        return cached
    try:
        if slug == "upi-qr":
            output = _finish(upi.upi_qr(target), None, slug)
        else:
            ctx = Ctx.from_url(target) if slug in URL_MODULES else Ctx.from_domain(target)
            output = _finish((URL_MODULES.get(slug) or DOMAIN_MODULES[slug])(ctx), ctx, slug)
    except InvalidTarget as error:
        raise _bad_target(error) from error
    _remember(slug, target, output)
    return output


@router.post("/upi/qr", dependencies=[Depends(rate_limit)])
def upi_qr_upload(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_IMAGES:
        raise HTTPException(status_code=415, detail="Use a PNG, JPG or WebP file.")
    data = file.file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Keep the file under 5 MB.")
    try:
        payload = upi.decode_qr(data)
        if not payload:
            raise HTTPException(status_code=422, detail="No QR code could be read from this image.")
        parsed = upi.parse_target(payload)
    except InvalidTarget as error:
        raise HTTPException(status_code=422, detail=f"This QR code is not a UPI payment code. {error}") from error
    result = _finish(upi.analyze(parsed, source="qr"), None, "upi-qr")
    result["decoded"] = {"vpa": parsed["vpa"], "format": parsed["kind"], "payloadSize": parsed["size"], "amountLocked": result["qr"]["amountLocked"]}
    return result


@router.post("/upi/report", status_code=201)
def report_upi(body: UpiReportBody):
    try:
        parsed = upi.parse_target(body.target)
    except InvalidTarget as error:
        raise _bad_target(error) from error
    report = upi.add_report(parsed["vpa"], body.category, body.note)
    return report


# --- Reports, threat feed, dashboard, watchlist ------------------------------------------------------


@router.post("/reports", status_code=201)
def submit_report(
    url: str = Form(max_length=2048), category: str = Form(max_length=40), description: str = Form(min_length=20, max_length=800), details: str = Form(default="", max_length=2000),
    email: str = Form(default="", max_length=254), evidence: UploadFile | None = File(default=None), user: dict | None = Depends(optional_user),
):
    if category not in REPORT_CATEGORIES:
        raise HTTPException(status_code=422, detail="Choose a valid category.")
    try:
        normalized, _ = normalize_url(url)
    except InvalidTarget as error:
        raise _bad_target(error) from error
    evidence_name = None
    if evidence is not None and evidence.filename:
        if evidence.content_type not in ALLOWED_IMAGES:
            raise HTTPException(status_code=415, detail="Evidence must be a PNG, JPG or WebP file.")
        if len(evidence.file.read(MAX_UPLOAD_BYTES + 1)) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Keep the file under 5 MB.")
        evidence_name = evidence.filename[:200]
    host = urlsplit(normalized).hostname
    triage = score_url(normalized)
    probability = triage["probability"] if triage else 0
    report = {
        "id": f"RPT-{secrets.token_hex(3).upper()}", "url": normalized, "target": host, "domain": registrable(host), "category": REPORT_CATEGORIES[category], "categoryId": category, "description": description, "details": details,
        "evidence": evidence_name, "email": email or None, "reporter": user["name"] if user else "anon_report", "userId": user["id"] if user else None,
        # The model only orders the review queue. A person must confirm before a report affects verdicts.
        "status": "triaged" if probability >= 0.7 else "submitted", "triageScore": round(probability * 100), "submittedAt": now_iso(), "createdAt": utcnow(),
    }
    get_db().reports.insert_one(dict(report))
    return {key: report[key] for key in ("id", "url", "category", "description", "evidence", "submittedAt", "status", "triageScore")}


@router.get("/threats")
def threats():
    return threat_payload()


@router.get("/dashboard")
def dashboard(user: dict | None = Depends(optional_user)):
    return dashboard_payload(user)


@router.get("/ml/models")
def ml_models():
    return {"models": model_info()}


@router.get("/watchlist")
def watchlist(user: dict = Depends(current_user)):
    return {"items": [public(row) for row in get_db().watchlist.find({"userId": user["id"]})]}


@router.post("/watchlist", status_code=201)
def add_watch(body: WatchBody, user: dict = Depends(current_user)):
    try:
        ctx = Ctx.from_domain(body.domain)
    except InvalidTarget as error:
        raise _bad_target(error) from error
    item = {"domain": ctx.domain, "brand": body.brand or ctx.domain, "userId": user["id"], "status": "monitoring", "createdAt": now_iso()}
    get_db().watchlist.update_one({"domain": ctx.domain, "userId": user["id"]}, {"$set": item}, upsert=True)
    return item


@router.delete("/watchlist/{domain}", status_code=204)
def remove_watch(domain: str, user: dict = Depends(current_user)):
    get_db().watchlist.delete_one({"domain": domain, "userId": user["id"]})
