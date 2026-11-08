"""Train and persist both models.

    python -m app.ml.train            # uses feeds in data/training/, downloading any that are missing

URL model: logistic regression over character n-grams and lexical features, averaged with a
gradient-boosted tree model over the lexical features. Evaluated on a held-out set split by
registrable domain, so no domain appears in both train and test.

JavaScript model: a random forest separating ordinary (often minified) code from obfuscated code.
Positives are real library code passed through the obfuscation transforms attackers use.
"""
import argparse
import base64
import json
import logging
import random
import re
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path

import joblib
import numpy as np
import playwright
from scipy import sparse
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import MaxAbsScaler

from ..config import BASE_DIR, DATA_DIR, MODEL_DIR
from ..util import load_json, now_iso, registrable
from .features import JS_FEATURE_NAMES, URL_FEATURE_NAMES, js_features, split_url, url_features, url_text

log = logging.getLogger("truthshield.ml")
TRAIN_DIR = DATA_DIR / "training"
FEEDS = {
    "openphish.txt": "https://openphish.com/feed.txt",
}
TRANCO_URL = "https://tranco-list.eu/top-1m.csv.zip"

BENIGN_PATHS = [
    "/about", "/contact", "/login", "/signin", "/account", "/account/settings", "/support",
    "/help/article/{n}", "/products/{n}", "/product/{w}-{n}", "/blog/{w}-{w}", "/blog/{y}/{m}/{w}", "/news/{w}-{w}-{n}",
    "/search?q={w}", "/index.html", "/index.php?id={n}", "/en-us/{w}", "/en/{w}/{w}", "/docs/{w}/{w}", "/category/{w}",
    "/user/{w}", "/cart", "/checkout", "/verify-email", "/password/reset", "/billing/invoices", "/wp-content/uploads/{y}/{m}/{w}.jpg",
    "/articles/{n}/{w}", "/{w}/{w}.html", "/p/{n}?ref={w}", "/watch?v={w}{n}", "/dashboard", "/api/v1/{w}", "/{w}",
]
WORDS = "home store guide review travel health music sport video photo market garden school career design report city team world food style".split()
LURES = "login signin verify secure account update confirm kyc wallet support billing refund reward alert otp online netbanking".split()
TLDS = "com net org info xyz top click live shop site online in co icu cfd".split()
SYNTHETIC_PATHS = ["", "/", "/login", "/signin.php", "/verify", "/account/update", "/kyc/update", "/secure/auth.html", "/session/confirm"]


def _download(url: str, destination: Path) -> bool:
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "TruthShield-trainer/1.0"})
        with urllib.request.urlopen(request, timeout=90) as response:
            destination.write_bytes(response.read())
        return True
    except OSError as error:
        log.warning("Could not download %s: %s", url, error)
        return False


def ensure_feeds() -> None:
    TRAIN_DIR.mkdir(parents=True, exist_ok=True)
    for name, url in FEEDS.items():
        if not (TRAIN_DIR / name).exists():
            _download(url, TRAIN_DIR / name)
    tranco = TRAIN_DIR / "tranco_top100k.csv"
    if not tranco.exists():
        archive = TRAIN_DIR / "tranco.zip"
        if _download(TRANCO_URL, archive):
            with zipfile.ZipFile(BytesIO(archive.read_bytes())) as bundle:
                lines = bundle.read(bundle.namelist()[0]).decode().splitlines()[:100_000]
            tranco.write_text("\n".join(lines) + "\n")
            archive.unlink()


def _benign_url(domain: str, rng: random.Random) -> str:
    # Roots are as common here as in the phishing rows, so "no path" cannot act as the label.
    path = "/" if rng.random() < 0.3 else rng.choice(BENIGN_PATHS).format(
        n=rng.randint(1, 99999), w=rng.choice(WORDS), y=rng.randint(2015, 2026), m=rng.randint(10, 12)
    )
    host = domain if rng.random() < 0.8 else f"{rng.choice(['blog', 'shop', 'm', 'app', 'support', 'docs'])}.{domain}"
    return f"https://{host}{path}"


def _synthetic_phish(rng: random.Random, brands: list[str]) -> str:
    brand, a, b = rng.choice(brands), rng.choice(LURES), rng.choice(LURES)
    host = rng.choice([
        f"{brand}-{a}-{b}", f"{a}-{brand}", f"{brand}-{a}", f"{brand}{a}", f"{a}-{brand}-{rng.randint(1, 999)}",
        f"{brand}.{a}-{b}", f"{brand.replace('o', '0')}-{a}", f"{brand.replace('l', '1')}-{a}",
    ])
    return f"http{'s' * rng.randint(0, 1)}://{host}.{rng.choice(TLDS)}{rng.choice(SYNTHETIC_PATHS)}"


def build_url_dataset(max_benign: int, seed: int = 7) -> tuple[list[str], np.ndarray, dict]:
    rng = random.Random(seed)
    phish: dict[str, None] = {}
    sources = {}
    for name in ("openphish.txt", "phishing_database.txt"):
        path = TRAIN_DIR / name
        if path.exists():
            rows = [line.strip() for line in path.read_text(errors="ignore").splitlines() if line.startswith("http")]
            phish.update(dict.fromkeys(rows))
            sources[name] = len(rows)
    popular = set()
    tranco = TRAIN_DIR / "tranco_top100k.csv"
    domains: list[str] = []
    if tranco.exists():
        domains = [line.split(",", 1)[1].strip() for line in tranco.read_text().splitlines() if "," in line]
        popular = set(domains[:20000])
    else:
        log.warning("Tranco list missing; benign class will be limited to curated official domains.")
    official = sorted({domain for brand in load_json("brands.json") for domain in brand["official"] if "." in domain})
    phish_rows = [url for url in phish if split_url(url)[0]]
    brands = sorted({k for brand in load_json("brands.json") for k in brand["keywords"]})
    synthetic = [_synthetic_phish(rng, brands) for _ in range(max(3000, len(phish_rows) // 8))]
    # Feeds skew toward long paths; dropping some keeps "has a path" from acting as the label.
    for index, url in enumerate(phish_rows):
        if rng.random() < 0.3:
            host = split_url(url)[0]
            phish_rows[index] = f"http://{host}/"
    rng.shuffle(domains)
    benign_domains = domains[:max_benign] + official
    benign = []
    for domain in benign_domains:
        benign.append(_benign_url(domain, rng))
    for domain in official:
        benign.extend(_benign_url(domain, rng) for _ in range(6))
    urls = phish_rows + synthetic + benign
    labels = np.array([1] * (len(phish_rows) + len(synthetic)) + [0] * len(benign))
    info = {
        "feeds": sources,
        "phishing_real": len(phish_rows),
        "phishing_synthetic": len(synthetic),
        "benign": len(benign),
        "popular_overlap": sum(registrable(split_url(url)[0]) in popular for url in phish_rows),
    }
    return urls, labels, info


def _metrics(y_true, probability, threshold: float = 0.5) -> dict:
    predicted = (probability >= threshold).astype(int)
    return {
        "accuracy": round(float(accuracy_score(y_true, predicted)), 4),
        "precision": round(float(precision_score(y_true, predicted, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, predicted, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, predicted, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, probability)), 4),
        "false_positive_rate": round(float(((predicted == 1) & (y_true == 0)).sum() / max((y_true == 0).sum(), 1)), 4),
    }


def _fit_url(urls, labels):
    texts = [url_text(url) for url in urls]
    numeric = np.asarray([url_features(url) for url in urls], dtype=float)
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=5, max_features=60000, sublinear_tf=True)
    text_matrix = vectorizer.fit_transform(texts)
    scaler = MaxAbsScaler().fit(numeric)
    combined = sparse.hstack([text_matrix, sparse.csr_matrix(scaler.transform(numeric))]).tocsr()
    linear = LogisticRegression(C=4.0, max_iter=400, class_weight="balanced")
    linear.fit(combined, labels)
    boosted = HistGradientBoostingClassifier(max_iter=220, learning_rate=0.08, class_weight="balanced", random_state=7)
    boosted.fit(numeric, labels)
    return {"vectorizer": vectorizer, "scaler": scaler, "linear": linear, "boosted": boosted, "scaled_mean": scaler.transform(numeric).mean(axis=0)}


def predict_url_bundle(bundle, urls) -> np.ndarray:
    numeric = np.asarray([url_features(url) for url in urls], dtype=float)
    matrix = sparse.hstack(
        [bundle["vectorizer"].transform([url_text(url) for url in urls]), sparse.csr_matrix(bundle["scaler"].transform(numeric))]
    ).tocsr()
    return (bundle["linear"].predict_proba(matrix)[:, 1] + bundle["boosted"].predict_proba(numeric)[:, 1]) / 2


def train_url_model(max_benign: int = 40000) -> dict:
    urls, labels, info = build_url_dataset(max_benign)
    groups = np.array([registrable(split_url(url)[0]) or url for url in urls])
    openphish = TRAIN_DIR / "openphish.txt"
    feed_hosts = {split_url(line)[0] for line in openphish.read_text(errors="ignore").split()} if openphish.exists() else set()
    from_feed = (labels == 1) & np.array([split_url(url)[0] in feed_hosts for url in urls])
    # Every host in the OpenPhish feed is withheld from the evaluation model, as an unseen test set.
    rest = np.flatnonzero(~from_feed)
    split = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=7).split(rest, labels[rest], groups[rest])
    train_index, test_index = (rest[part] for part in next(split))
    train_urls = [urls[i] for i in train_index]
    test_urls = [urls[i] for i in test_index]
    holdout = _fit_url(train_urls, labels[train_index])
    metrics = _metrics(labels[test_index], predict_url_bundle(holdout, test_urls))
    # The same held-out benign domains reduced to their bare homepage, the most common real query.
    roots = [f"https://{groups[i]}/" for i in test_index if labels[i] == 0 and "." in groups[i]]
    metrics["homepage_false_positive_rate"] = round(float((predict_url_bundle(holdout, roots) >= 0.5).mean()), 4)
    independent = [urls[i] for i in np.flatnonzero(from_feed)]
    if independent:
        metrics["withheld_openphish_host_recall"] = round(float((predict_url_bundle(holdout, independent) >= 0.5).mean()), 4)
        metrics["withheld_openphish_host_samples"] = len(independent)
    log.info("URL model holdout: %s", metrics)
    final = _fit_url(urls, labels)
    final["feature_names"] = URL_FEATURE_NAMES
    meta = {
        "model": "url-phishing",
        "algorithm": "LogisticRegression(char n-grams + lexical) averaged with HistGradientBoosting(lexical)",
        "trainedAt": now_iso(),
        "dataset": info,
        "samples": len(urls),
        "holdout": metrics,
        "split": "20% holdout grouped by registrable domain",
    }
    final["meta"] = meta
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump(final, MODEL_DIR / "url_model.joblib", compress=3)
    return meta


# --- JavaScript obfuscation model ------------------------------------------------------------------


def _hex_strings(code: str, rng) -> str:
    def encode(match):
        body = match.group(0)[1:-1]
        return '"' + "".join(f"\\x{ord(char):02x}" for char in body if ord(char) < 256) + '"'

    return re.sub(r"\"[^\"\\\n]{2,60}\"|'[^'\\\n]{2,60}'", encode, code)


def _rename_identifiers(code: str, rng) -> str:
    names = list(dict.fromkeys(re.findall(r"\b(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)", code)))
    mapping = {name: f"_0x{rng.randint(0x1000, 0xfffff):x}" for name in names}
    if not mapping:
        return code
    pattern = re.compile(r"\b(" + "|".join(map(re.escape, mapping)) + r")\b")
    return pattern.sub(lambda match: mapping[match.group(1)], code)


def _base64_eval(code: str, rng) -> str:
    return f"eval(atob('{base64.b64encode(code.encode()).decode()}'));"


def _charcode(code: str, rng) -> str:
    sample = code[:20000]
    return "eval(String.fromCharCode(" + ",".join(str(ord(char) % 65535) for char in sample) + "));"


def _packer(code: str, rng) -> str:
    words = code.split()
    table = "|".join(dict.fromkeys(words))
    body = re.sub(r"\S+", lambda _: format(rng.randint(0, 35), "x"), code)
    body = body.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
    return f"eval(function(p,a,c,k,e,d){{while(c--)if(k[c])p=p.replace(new RegExp('\\\\b'+c.toString(a)+'\\\\b','g'),k[c]);return p}}('{body}',36,{len(words)},'{table}'.split('|'),0,{{}}));"


def _string_array(code: str, rng) -> str:
    strings = list(dict.fromkeys(re.findall(r"\"([^\"\\\n]{2,40})\"", code)))
    if not strings:
        return _rename_identifiers(code, rng)
    name = f"_0x{rng.randint(0x1000, 0xfffff):x}"
    index = {value: i for i, value in enumerate(strings)}
    replaced = re.sub(r"\"([^\"\\\n]{2,40})\"", lambda match: f"{name}[0x{index[match.group(1)]:x}]", code)
    return f"var {name}=[" + ",".join(json.dumps(item) for item in strings) + "];" + _rename_identifiers(replaced, rng)


OBFUSCATORS = [_hex_strings, _rename_identifiers, _base64_eval, _charcode, _packer, _string_array]
JS_LIBRARIES = [
    "jquery@3.7.1/dist/jquery.js", "jquery@3.7.1/dist/jquery.min.js", "jquery@2.2.4/dist/jquery.min.js", "lodash@4.17.21/lodash.js", "lodash@4.17.21/lodash.min.js",
    "bootstrap@5.3.3/dist/js/bootstrap.bundle.js", "bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js", "bootstrap@4.6.2/dist/js/bootstrap.min.js",
    "react@18.3.1/umd/react.development.js", "react@18.3.1/umd/react.production.min.js", "react-dom@18.3.1/umd/react-dom.production.min.js",
    "vue@3.4.38/dist/vue.global.js", "vue@3.4.38/dist/vue.global.prod.js", "vue@2.7.16/dist/vue.min.js", "angular@1.8.3/angular.min.js", "axios@1.7.7/dist/axios.js", "axios@1.7.7/dist/axios.min.js",
    "moment@2.30.1/moment.js", "moment@2.30.1/min/moment.min.js", "d3@7.9.0/dist/d3.js", "d3@7.9.0/dist/d3.min.js", "chart.js@4.4.4/dist/chart.umd.js", "three@0.160.0/build/three.js", "three@0.160.0/build/three.min.js",
    "underscore@1.13.7/underscore-umd.js", "underscore@1.13.7/underscore-umd-min.js", "backbone@1.6.0/backbone.js", "backbone@1.6.0/backbone-min.js", "alpinejs@3.14.1/dist/cdn.js", "alpinejs@3.14.1/dist/cdn.min.js",
    "gsap@3.12.5/dist/gsap.js", "gsap@3.12.5/dist/gsap.min.js", "swiper@11.1.14/swiper-bundle.js", "swiper@11.1.14/swiper-bundle.min.js", "leaflet@1.9.4/dist/leaflet-src.js", "leaflet@1.9.4/dist/leaflet.js",
    "sweetalert2@11.14.0/dist/sweetalert2.all.js", "sweetalert2@11.14.0/dist/sweetalert2.all.min.js", "hammerjs@2.0.8/hammer.js", "hammerjs@2.0.8/hammer.min.js", "dayjs@1.11.13/dayjs.min.js", "htmx.org@2.0.3/dist/htmx.js", "htmx.org@2.0.3/dist/htmx.min.js",
    "immutable@4.3.7/dist/immutable.js", "immutable@4.3.7/dist/immutable.min.js", "rxjs@7.8.1/dist/bundles/rxjs.umd.js", "rxjs@7.8.1/dist/bundles/rxjs.umd.min.js", "crypto-js@4.2.0/crypto-js.js", "crypto-js@4.2.0/crypto-js.min.js",
    "socket.io-client@4.8.0/dist/socket.io.js", "socket.io-client@4.8.0/dist/socket.io.min.js", "popper.js@1.16.1/dist/umd/popper.js", "popper.js@1.16.1/dist/umd/popper.min.js", "mathjs@13.2.0/lib/browser/math.js", "pdfjs-dist@3.11.174/build/pdf.js", "pdfjs-dist@3.11.174/build/pdf.min.js",
]
BUILTIN_SCRIPTS = [
    "document.querySelector('#menu').addEventListener('click', function () { this.classList.toggle('open'); });",
    "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());",
    "const form = document.getElementById('newsletter');\nform.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  await fetch('/api/subscribe', {method: 'POST', body: new FormData(form)});\n});",
    "function formatPrice(value){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(value)}",
    "!function(e,t){\"object\"==typeof exports?module.exports=t():e.lib=t()}(this,function(){var e={};return e.version=\"1.0.0\",e});",
]


def _benign_corpus(rng: random.Random, limit: int = 1800) -> list[str]:
    cache = TRAIN_DIR / "js_corpus"
    cache.mkdir(parents=True, exist_ok=True)
    for library in JS_LIBRARIES:
        target = cache / library.replace("/", "__")
        if not target.exists():
            _download(f"https://cdn.jsdelivr.net/npm/{library}", target)
    files = list(cache.iterdir())
    # Playwright ships a large real-world JavaScript tree, and node_modules adds more when installed.
    roots = [BASE_DIR.parent / "frontend" / "node_modules", Path(playwright.__file__).parent / "driver" / "package" / "lib"]
    for root in roots:
        if root.exists():
            files.extend(
                path for path in root.rglob("*.js")
                if 400 < path.stat().st_size < 900_000 and "test" not in path.name
            )
    rng.shuffle(files)
    corpus = []
    for path in files[:limit]:
        try:
            corpus.append(path.read_text(errors="ignore"))
        except OSError:
            continue
    corpus.extend(BUILTIN_SCRIPTS)
    return corpus


def _crude_minify(code: str) -> str:
    code = re.sub(r"/\*.*?\*/", "", code, flags=re.S)
    code = re.sub(r"(?m)^\s*//.*$", "", code)
    return re.sub(r"\s*\n\s*", "", re.sub(r"[ \t]+", " ", code))


def train_js_model() -> dict:
    rng = random.Random(11)
    corpus = _benign_corpus(rng)
    samples, labels, groups = [], [], []
    for index, source in enumerate(corpus):
        chunk_start = rng.randint(0, max(0, len(source) - 60000))
        code = source[chunk_start:chunk_start + 60000]
        samples.append(code)
        labels.append(0)
        groups.append(index)
        samples.append(_crude_minify(code))
        labels.append(0)
        groups.append(index)
        transform = rng.choice(OBFUSCATORS)
        samples.append(transform(code, rng))
        labels.append(1)
        groups.append(index)
        layered = rng.choice(OBFUSCATORS)(rng.choice(OBFUSCATORS[:2])(_crude_minify(code), rng), rng)
        samples.append(layered)
        labels.append(1)
        groups.append(index)
    matrix = np.asarray([js_features(sample) for sample in samples], dtype=float)
    labels = np.asarray(labels)
    groups = np.asarray(groups)
    train_index, test_index = next(GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=11).split(matrix, labels, groups))
    holdout = RandomForestClassifier(n_estimators=160, class_weight="balanced", n_jobs=-1, random_state=11, min_samples_leaf=2)
    holdout.fit(matrix[train_index], labels[train_index])
    metrics = _metrics(labels[test_index], holdout.predict_proba(matrix[test_index])[:, 1])
    log.info("JS model holdout: %s", metrics)
    final = RandomForestClassifier(n_estimators=160, class_weight="balanced", n_jobs=-1, random_state=11, min_samples_leaf=2)
    final.fit(matrix, labels)
    meta = {
        "model": "js-obfuscation",
        "algorithm": "RandomForest over 20 static code features",
        "trainedAt": now_iso(),
        "samples": int(len(samples)),
        "dataset": {"benign_source_files": len(corpus), "positives": "same files passed through 6 obfuscation transforms"},
        "holdout": metrics,
        "split": "20% holdout grouped by source file",
    }
    MODEL_DIR.mkdir(exist_ok=True)
    joblib.dump({"forest": final, "feature_names": JS_FEATURE_NAMES, "meta": meta}, MODEL_DIR / "js_model.joblib", compress=3)
    return meta


def train_all(max_benign: int = 40000) -> list[dict]:
    ensure_feeds()
    return [train_url_model(max_benign), train_js_model()]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-benign", type=int, default=40000)
    arguments = parser.parse_args()
    for result in train_all(arguments.max_benign):
        print(json.dumps(result, indent=2))
