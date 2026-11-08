"""Registry of the 13 detection modules."""
from . import certs, content, hosting, typosquatting, upi, visual, web

URL_MODULES = {
    "visual-similarity": visual.visual_similarity,
    "security-configuration": web.security_configuration,
    "redirect-chain": web.redirect_chain,
    "cloaking": web.cloaking,
    "phishing-kits": content.phishing_kits,
    "favicon-logo-hash": visual.favicon_logo_hash,
    "javascript-behaviour": content.javascript_behaviour,
}
DOMAIN_MODULES = {
    "certificate-transparency": certs.certificate_transparency,
    "ca-reputation": certs.ca_reputation,
    "certificate-anomalies": certs.certificate_anomalies,
    "typosquatting": typosquatting.typosquatting,
    "hosting-fingerprint": hosting.hosting_fingerprint,
}
ALL_SLUGS = {*URL_MODULES, *DOMAIN_MODULES, "upi-qr"}
