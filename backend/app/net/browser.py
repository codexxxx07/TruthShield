"""Headless Chromium render: screenshot, final DOM and behaviour telemetry from page scripts.

Each render runs in its own process. A hostile page can wedge the browser in ways Playwright's own
timeouts do not catch, so the parent enforces a hard deadline and kills the whole process group.
"""
import base64
import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from urllib.parse import urlsplit

import httpx

from ..config import BASE_DIR, settings
from ..util import registrable
from .fetcher import ALLOWED_PORTS, BlockedTarget, DESKTOP_UA, resolve_public

log = logging.getLogger("truthshield.browser")
# Chromium launches are heavy; limit how many run at once.
_slots = threading.BoundedSemaphore(3)
HARD_TIMEOUT_SECONDS = 40

TELEMETRY_SCRIPT = r"""
(() => {
  const t = { apiCalls: 0, evalCalls: 0, keyListeners: 0, sensitiveKeyListeners: 0, clipboardRead: 0, clipboardWrite: 0,
              copyListeners: 0, pasteListeners: 0, contextMenuBlocks: 0, sendBeacons: 0, forcedNavigation: 0 };
  Object.defineProperty(window, '__tsTelemetry', { value: () => JSON.stringify(t), configurable: false, writable: false });
  const count = (key) => { t[key] += 1; t.apiCalls += 1; };
  const sensitive = (el) => el && el.matches && el.matches('input[type=password],input[name*=otp i],input[name*=pin i],input[name*=cvv i],input[autocomplete*=cc-]');
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, options) {
    t.apiCalls += 1;
    if (['keydown', 'keypress', 'keyup'].includes(type)) { t.keyListeners += 1; if (sensitive(this)) t.sensitiveKeyListeners += 1; }
    if (type === 'copy' || type === 'cut') t.copyListeners += 1;
    if (type === 'paste') t.pasteListeners += 1;
    if (type === 'contextmenu') t.contextMenuBlocks += 1;
    return add.call(this, type, fn, options);
  };
  const realEval = window.eval;
  window.eval = function (code) { count('evalCalls'); return realEval(code); };
  const RealFunction = window.Function;
  window.Function = new Proxy(RealFunction, { construct(target, args) { count('evalCalls'); return new target(...args); }, apply(target, self, args) { count('evalCalls'); return target(...args); } });
  if (navigator.clipboard) {
    for (const [name, key] of [['readText', 'clipboardRead'], ['read', 'clipboardRead'], ['writeText', 'clipboardWrite'], ['write', 'clipboardWrite']]) {
      const original = navigator.clipboard[name];
      if (original) navigator.clipboard[name] = function (...args) { count(key); return original.apply(this, args); };
    }
  }
  const exec = document.execCommand;
  document.execCommand = function (name, ...rest) { if (String(name).toLowerCase() === 'copy') count('clipboardWrite'); return exec.call(this, name, ...rest); };
  const beacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  if (beacon) navigator.sendBeacon = function (...args) { count('sendBeacons'); return beacon(...args); };
})();
"""

FONT_SCRIPT = r"""
() => {
  const out = new Set();
  for (const el of Array.from(document.querySelectorAll('h1,h2,p,a,button,input,label')).slice(0, 120)) {
    const family = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
    if (family) out.add(family);
  }
  return Array.from(out).slice(0, 12);
}
"""


def _host_allowed(url: str, cache: dict) -> bool:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https", "data", "blob", "about"):
        return False
    if parts.scheme in ("data", "blob", "about"):
        return True
    if parts.port not in (None, *ALLOWED_PORTS):
        return False
    host = parts.hostname or ""
    if host not in cache:
        try:
            resolve_public(host)
            cache[host] = True
        except (BlockedTarget, httpx.ConnectError):
            cache[host] = False
    return cache[host]


def render(url: str, ua: str = DESKTOP_UA, viewport=(1280, 800)) -> dict | None:
    """Render a page in a throwaway browser. Returns None when the browser or page is unavailable."""
    if not settings.enable_browser:
        return None
    request = json.dumps({"url": url, "ua": ua, "viewport": list(viewport)})
    with _slots:
        worker = subprocess.Popen(
            [sys.executable, "-m", "app.net.browser", request], cwd=BASE_DIR, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, start_new_session=True,
        )
        try:
            output, _ = worker.communicate(timeout=HARD_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            log.warning("Render exceeded %ss and was killed: %s", HARD_TIMEOUT_SECONDS, url)
            os.killpg(worker.pid, signal.SIGKILL)
            worker.communicate()
            return None
    if worker.returncode != 0 or not output:
        return None
    result = json.loads(output)
    result["screenshot"] = base64.b64decode(result["screenshot"])
    return result


def _render_in_process(url: str, ua: str, viewport: list[int]) -> dict | None:
    try:
        from playwright.sync_api import Error as PlaywrightError, sync_playwright
    except ImportError:
        return None
    started = time.perf_counter()
    allowed: dict = {}
    requests: list[dict] = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(args=["--force-webrtc-ip-handling-policy=disable_non_proxied_udp"])
            try:
                context = browser.new_context(
                    user_agent=ua, viewport={"width": viewport[0], "height": viewport[1]}, ignore_https_errors=True,
                    accept_downloads=False, service_workers="block", java_script_enabled=True,
                )
                page = context.new_page()
                page.set_default_timeout(15000)
                page.add_init_script(TELEMETRY_SCRIPT)

                def guard(route):
                    request = route.request
                    if _host_allowed(request.url, allowed):
                        requests.append({"url": request.url[:500], "method": request.method, "type": request.resource_type})
                        route.continue_()
                    else:
                        route.abort()

                context.route("**/*", guard)
                page.route_web_socket("**", lambda socket: socket.close())
                response = page.goto(url, wait_until="load", timeout=15000)
                page.wait_for_timeout(1500)
                title = page.title()
                html = page.content()[: settings.max_body_bytes]
                fonts = page.evaluate(FONT_SCRIPT)
                screenshot = page.screenshot(type="png", full_page=False)
                try:
                    telemetry = json.loads(page.evaluate("window.__tsTelemetry()"))
                    telemetry = {key: int(value) for key, value in telemetry.items()}
                except (PlaywrightError, ValueError, TypeError):
                    telemetry = {}
                final_url = page.url
                return {
                    "url": final_url,
                    "status": response.status if response else 0,
                    "title": title[:300],
                    "html": html,
                    "fonts": fonts,
                    "screenshot": base64.b64encode(screenshot).decode(),
                    "telemetry": telemetry,
                    "requests": requests[:400],
                    "off_domain_posts": [
                        item["url"] for item in requests
                        if item["method"] == "POST" and registrable(urlsplit(item["url"]).hostname or "") != registrable(urlsplit(final_url).hostname or "")
                    ][:20],
                    "run_ms": int((time.perf_counter() - started) * 1000),
                }
            finally:
                browser.close()
    except PlaywrightError as error:
        log.info("Render failed for %s: %s", url, str(error)[:200])
        return None


if __name__ == "__main__":
    arguments = json.loads(sys.argv[1])
    rendered = _render_in_process(arguments["url"], arguments["ua"], arguments["viewport"])
    if rendered is None:
        sys.exit(1)
    sys.stdout.write(json.dumps(rendered))
