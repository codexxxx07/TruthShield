"""Module 13: UPI link and QR checker.

There is no public API for verifying a payee with NPCI or a bank. The checks here use only what can
be observed: the payment intent itself, the handle's format and provider, and community reports.
"""
import io
import re
import secrets
from urllib.parse import parse_qs, unquote, urlsplit

import cv2
import numpy as np
from PIL import Image, UnidentifiedImageError

from ..db import get_db
from ..util import InvalidTarget, clamp, load_json, now_iso
from .common import BRANDS, levenshtein

VPA_RE = re.compile(r"^[a-z0-9._-]{2,256}@[a-z0-9]{2,64}$", re.I)
LURES = ("cashback", "reward", "prize", "lottery", "winner", "refund", "kyc", "claim", "bonus", "gift", "offer", "lucky", "electricity", "customer care", "helpdesk", "verify", "unblock", "income tax")
MCC_NAMES = {
    "0000": "Personal", "5411": "Groceries", "5812": "Restaurants", "5814": "Fast food", "5999": "Retail", "5311": "Department stores", "5541": "Fuel", "4900": "Utilities",
    "4814": "Telecom", "6012": "Financial services", "7372": "Software", "8999": "Professional services", "5732": "Electronics", "5691": "Clothing", "5912": "Pharmacy", "4121": "Taxi",
}
HIGH_AMOUNT = 5000


def _handles() -> dict:
    return load_json("upi_handles.json")


def parse_emv(payload: str) -> dict:
    """Read an EMVCo merchant QR (BharatQR): nested tag-length-value fields."""
    def tlv(text: str) -> dict:
        fields, index = {}, 0
        while index + 4 <= len(text):
            tag, size = text[index:index + 2], text[index + 2:index + 4]
            if not size.isdigit():
                break
            fields[tag] = text[index + 4:index + 4 + int(size)]
            index += 4 + int(size)
        return fields

    fields = tlv(payload)
    vpa = None
    for tag in [f"{number:02d}" for number in range(26, 52)]:
        if tag in fields:
            for value in tlv(fields[tag]).values():
                if VPA_RE.match(value):
                    vpa = value
                    break
        if vpa:
            break
    return {"pa": vpa, "pn": fields.get("59"), "am": fields.get("54"), "mc": fields.get("52"), "tn": None, "cu": "INR" if fields.get("53") == "356" else fields.get("53")}


def parse_target(raw: str) -> dict:
    """Accept a VPA, a upi:// link, a web link carrying pa=, or an EMV QR payload."""
    value = (raw or "").strip()
    if not value:
        raise InvalidTarget("Enter a UPI ID or paste a UPI payment link.")
    if len(value) > 2048:
        raise InvalidTarget("The UPI link is too long.")
    kind, params = "VPA", {}
    if value[:6].lower() == "upi://" or re.search(r"[?&]pa=", value):
        kind = "UPI link"
        parts = urlsplit(value)
        query = parse_qs(parts.query, keep_blank_values=True)
        params = {key.lower(): items[0] for key, items in query.items()}
    elif re.match(r"^000201", value):
        kind = "EMVCo QR"
        params = {key: item for key, item in parse_emv(value).items() if item}
    else:
        params = {"pa": value}
    vpa = unquote(params.get("pa", "")).strip().lower()
    if not VPA_RE.match(vpa):
        raise InvalidTarget("A UPI ID looks like name@bank, e.g. merchant@okhdfcbank.")
    return {
        "kind": kind, "vpa": vpa, "name": unquote(params["pn"]).strip() if params.get("pn") else None, "amount": params.get("am"), "currency": params.get("cu", "INR"),
        "note": unquote(params["tn"]).strip() if params.get("tn") else None, "mcc": params.get("mc"), "reference": params.get("tr"), "size": len(value),
    }


def decode_qr(image_bytes: bytes) -> str | None:
    try:
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise InvalidTarget("That file is not a readable image.") from error
    array = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    detector = cv2.QRCodeDetector()
    attempts = [array, cv2.resize(array, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)]
    grayscale = cv2.cvtColor(array, cv2.COLOR_BGR2GRAY)
    attempts.append(cv2.threshold(grayscale, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1])
    for attempt in attempts:
        data, _, _ = detector.detectAndDecode(attempt)
        if data:
            return data
    return None


def _words(text: str) -> set[str]:
    return {word for word in re.findall(r"[a-z]{3,}", text.lower())}


def _name_matches_handle(name: str, handle: str) -> bool:
    handle_clean = re.sub(r"[^a-z]", "", handle)
    if not handle_clean:
        return False
    for word in _words(name):
        if word in handle_clean or handle_clean in word or levenshtein(word, handle_clean, 2) <= 2:
            return True
    return False


def _claimed_brand(name: str | None, note: str | None) -> dict | None:
    text = f" {name or ''} {note or ''} ".lower()
    for brand in BRANDS:
        if any(re.search(rf"\b{re.escape(keyword)}\b", text) for keyword in brand["keywords"]):
            return brand
    return None


def _format_amount(value: str | None) -> str:
    try:
        return f"₹{float(value):,.0f}" if value not in (None, "") else "Not set"
    except ValueError:
        return "Invalid"


def _load_reports(vpa: str) -> list[dict]:
    db = get_db()
    rows = list(db.upi_reports.find({"vpa": vpa}).sort("date", -1).limit(20))
    return [{"id": row["id"], "category": row["category"], "date": row["date"], "status": row["status"]} for row in rows]


def analyze(parsed: dict, source: str = "input") -> dict:
    vpa, name, note, amount = parsed["vpa"], parsed["name"], parsed["note"], parsed["amount"]
    handle, provider = vpa.split("@", 1)
    handles = _handles()
    known_provider = provider in handles
    is_phone = bool(re.fullmatch(r"(?:\+?91)?[6-9]\d{9}", handle))
    is_merchant_code = parsed["mcc"] not in (None, "", "0000")
    reports = _load_reports(vpa)
    confirmed = sum(row["status"] == "confirmed" for row in reports)
    text = " ".join(filter(None, [name, note, handle.replace(".", " ").replace("-", " ").replace("_", " ")])).lower()
    lures = sorted({word for word in LURES if word in text})
    brand = _claimed_brand(name, note) or _claimed_brand(handle.replace(".", " ").replace("_", " ").replace("-", " "), None)
    brand_in_handle = bool(brand and any(keyword in handle for keyword in brand["keywords"]))
    name_mismatch = bool(name) and not _name_matches_handle(name, handle) and not is_phone
    brand_mismatch = bool(brand) and (is_phone or not brand_in_handle or not is_merchant_code)
    try:
        amount_value = float(amount) if amount not in (None, "") else None
    except ValueError:
        amount_value = None
    fixed_amount = amount_value is not None and amount_value > 0

    risk = 0
    if confirmed:
        risk += 70 + min(confirmed - 1, 3) * 8
    elif reports:
        risk += 35
    if not known_provider:
        risk += 40
    if brand_mismatch:
        risk += 45
    if name_mismatch and not brand_mismatch:
        risk += 14
    risk += min(len(lures), 2) * 22
    if fixed_amount and lures:
        risk += 15
    if fixed_amount and amount_value >= HIGH_AMOUNT and not is_merchant_code:
        risk += 10
    score = int(clamp(risk))
    verdict = "high-risk" if score > 55 else "medium-risk" if score > 25 else "low-risk"
    payee_type = "Merchant" if is_merchant_code else "Individual"

    def check(label, status, detail):
        return {"label": label, "status": status, "detail": detail}

    checks = [
        check("Handle format", "pass", f"Valid UPI ID on {handles[provider]}." if known_provider else "Valid format."),
        check("Payment provider", "pass" if known_provider else "fail", f"@{provider} is a known UPI provider." if known_provider else f"@{provider} is not a recognised UPI provider handle."),
        check("Merchant code", "pass" if is_merchant_code else "warn", f"Carries merchant category {parsed['mcc']}." if is_merchant_code else "No merchant category code. Payment goes to an individual-style account."),
        check("Scam report history", "fail" if confirmed else "warn" if reports else "pass", f"{len(reports)} community report{'s' if len(reports) != 1 else ''}, {confirmed} confirmed." if reports else "No community reports for this ID."),
        check("Beneficiary name match", "fail" if brand_mismatch else "warn" if name_mismatch or not name else "pass",
              f"Claims to be {brand['brand']} but the ID does not belong to a merchant of that name." if brand_mismatch else (f"Display name “{name}” does not match the ID “{handle}”." if name_mismatch else ("The link does not state a payee name." if not name else "Display name is consistent with the ID."))),
        check("Lure language", "fail" if lures else "pass", f"Uses scam wording: {', '.join(lures)}." if lures else "No common scam wording."),
        check("Collect amount", "warn" if fixed_amount else "pass", f"The amount is pre-filled at {_format_amount(amount)}. Paying is the only way to complete it, and no one receives money by scanning." if fixed_amount else "No fixed amount in the request."),
    ]
    indicators = []
    if confirmed:
        indicators.append(f"{confirmed} confirmed scam report{'s' if confirmed != 1 else ''}")
    if brand_mismatch:
        indicators.append(f"Claims to be {brand['brand']} without matching identity")
    if lures:
        indicators.append(f"Scam wording: {', '.join(lures)}")
    if not known_provider:
        indicators.append(f"Unknown provider handle @{provider}")
    if name_mismatch:
        indicators.append("Display name differs from the UPI ID")
    if fixed_amount:
        indicators.append(f"Fixed amount {_format_amount(amount)}")
    if not indicators:
        indicators = ["No scam reports", "Known UPI provider"] if known_provider else ["No scam reports"]

    display = name or " ".join(part.capitalize() for part in re.split(r"[._-]", handle) if part)
    if score > 55:
        summary = f"This payment shows strong scam signals: {'; '.join(item.lower() for item in indicators[:3])}."
    elif score > 25:
        summary = f"Be careful with this payment: {'; '.join(item.lower() for item in indicators[:3])}."
    else:
        summary = f"No scam signals were found for {vpa}. TruthShield cannot confirm the account owner, so check the name your UPI app shows before paying."
    result = {
        "target": vpa, "generatedAt": now_iso(), "live": True, "vpa": vpa,
        "payee": {"name": display, "handle": handle, "bank": handles.get(provider, provider.upper()), "type": payee_type, "verified": False, "accountAgeDays": None},
        "merchant": {"registered": is_merchant_code, "gstin": None, "category": MCC_NAMES.get(parsed["mcc"] or "", "Unregistered" if not is_merchant_code else f"MCC {parsed['mcc']}"), "website": None},
        "amount": _format_amount(amount), "note": note or "None", "score": score, "verdict": verdict, "summary": summary, "checks": checks, "reports": reports,
        "qr": {"detected": source == "qr", "format": parsed["kind"], "payloadSize": parsed["size"], "amountLocked": fixed_amount},
        "indicators": indicators,
        "limitations": ["There is no public NPCI or bank lookup, so the true account holder, age and merchant registration cannot be verified."],
    }
    return result


def upi_qr(raw: str) -> dict:
    return analyze(parse_target(raw))


def add_report(vpa: str, category: str, note: str | None = None) -> dict:
    report = {"id": f"UPI-{secrets.token_hex(3).upper()}", "vpa": vpa, "category": category, "note": note, "date": now_iso(), "status": "under review"}
    get_db().upi_reports.insert_one(dict(report))
    return report

