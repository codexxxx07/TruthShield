"""Lazy-loaded inference for the trained models."""
import logging
import threading

import joblib
import numpy as np
from scipy import sparse

from ..config import MODEL_DIR
from .features import URL_FEATURE_LABELS, URL_FEATURE_NAMES, js_features, url_features, url_text

log = logging.getLogger("truthshield.ml")
_lock = threading.Lock()
_models: dict = {}


def _load(name: str):
    if name in _models:
        return _models[name]
    with _lock:
        if name in _models:
            return _models[name]
        path = MODEL_DIR / f"{name}.joblib"
        if not path.exists():
            log.warning("%s is missing; run `python -m app.ml.train`.", path.name)
            _models[name] = None
        else:
            _models[name] = joblib.load(path)
    return _models[name]


def ensure_trained() -> None:
    """Train on first boot so a fresh clone works; later boots just load the saved files."""
    if (MODEL_DIR / "url_model.joblib").exists() and (MODEL_DIR / "js_model.joblib").exists():
        return
    from .train import train_all

    log.warning("Models not found; training now. This takes a few minutes the first time.")
    train_all()
    _models.clear()


def model_info() -> list[dict]:
    return [bundle["meta"] for bundle in (_load("url_model"), _load("js_model")) if bundle]


def score_url(url: str) -> dict | None:
    """Return phishing probability and the lexical factors that pushed it up."""
    bundle = _load("url_model")
    if not bundle:
        return None
    raw = np.asarray([url_features(url)], dtype=float)
    scaled = bundle["scaler"].transform(raw)
    matrix = sparse.hstack([bundle["vectorizer"].transform([url_text(url)]), sparse.csr_matrix(scaled)]).tocsr()
    linear = float(bundle["linear"].predict_proba(matrix)[0, 1])
    boosted = float(bundle["boosted"].predict_proba(raw)[0, 1])
    coefficients = bundle["linear"].coef_[0][-len(URL_FEATURE_NAMES):]
    # Measured against the average training URL, so always-positive features do not dominate.
    contributions = coefficients * (scaled[0] - bundle["scaled_mean"])
    ranked = sorted(zip(URL_FEATURE_NAMES, contributions), key=lambda item: item[1], reverse=True)
    factors = [
        {"feature": name, "label": URL_FEATURE_LABELS[name], "weight": round(float(weight), 3)}
        for name, weight in ranked
        if weight > 0.05 and name in URL_FEATURE_LABELS
    ][:5]
    return {
        "probability": (linear + boosted) / 2,
        "linear": linear,
        "boosted": boosted,
        "factors": factors,
    }


def score_js(source: str) -> float | None:
    """Probability that a script is deliberately obfuscated. Very short scripts are not judged."""
    bundle = _load("js_model")
    if not bundle or len(source) < 200:
        return None if not bundle else 0.0
    return float(bundle["forest"].predict_proba(np.asarray([js_features(source)], dtype=float))[0, 1])
