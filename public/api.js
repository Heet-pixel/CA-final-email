/* =========================================================
   api.js – talks to the backend
   1) wakeBackend()   background request that wakes a sleeping Render server
   2) newSubmissionId() unique id so a retried form can never send two emails
   3) postForm()      POST with limited retries + exponential back-off
   ========================================================= */
(function () {
  var API = window.AVKAS_CONFIG.API;

  /* ---------- 1. background wake-up (never awaited, never blocks, never throws) ---------- */
  var WAKE_TIMEOUT_MS = 6000;
  var WAKE_MIN_GAP_MS = 60000;
  var lastWake = 0;

  function wakeBackend(force) {
    var now = Date.now();
    if (!force && now - lastWake < WAKE_MIN_GAP_MS) return;
    lastWake = now;
    try {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, WAKE_TIMEOUT_MS) : null;
      fetch(API.wake, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        signal: ctrl ? ctrl.signal : undefined
      })
        .catch(function () {})
        .then(function () { if (timer) clearTimeout(timer); });
    } catch (e) { /* the website must never depend on the backend */ }
  }

  // Fire once after the page has fully loaded, so it can never compete with the page's own files.
  if (document.readyState === "complete") setTimeout(function () { wakeBackend(); }, 0);
  else window.addEventListener("load", function () { wakeBackend(); }, { once: true });

  /* ---------- 2. submission id ---------- */
  function newSubmissionId() {
    var c = window.crypto;
    if (c && c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b);
    else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  }

  /* ---------- 3. POST with cold-start handling ---------- */
  var MAX_ATTEMPTS = 3;            // attempt 1 -> wait -> attempt 2 -> wait -> attempt 3
  var ATTEMPT_TIMEOUT_MS = 45000;  // a cold Render start can take ~50 s
  var BACKOFF_BASE_MS = 2000;      // 2 s, then 4 s
  var GENERIC = "We could not send your message right now. Please try again, or call us on +91 84019 89798.";
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  async function postForm(url, body, onRetry) {
    var lastError = GENERIC;
    for (var attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ATTEMPT_TIMEOUT_MS) : null;
      try {
        var res = await fetch(url, {
          method: "POST",
          body: body, // multipart/form-data – the browser sets the boundary itself
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          signal: ctrl ? ctrl.signal : undefined
        });
        if (timer) clearTimeout(timer);

        var isJson = (res.headers.get("content-type") || "").indexOf("application/json") !== -1;
        var data = isJson ? await res.json().catch(function () { return null; }) : null;

        // success ONLY when the backend confirms Amazon SES accepted the email
        if (res.ok && data && data.status === "sent") return { ok: true };

        // definite answers – retrying cannot help
        if (res.status === 429) return { ok: false, error: (data && data.error) || "Too many requests. Please try again in a few minutes." };
        if ([400, 403, 413, 415, 422].indexOf(res.status) !== -1) return { ok: false, error: (data && data.error) || GENERIC };

        // 5xx, Render's HTML "spinning up" page, anything unexpected -> retry
        lastError = (data && data.error) || GENERIC;
      } catch (e) {
        // network error, CORS-less spin-up response, or our own timeout -> retry
        if (timer) clearTimeout(timer);
        lastError = "We could not reach our server. Please check your connection and try again.";
      }
      if (attempt < MAX_ATTEMPTS) {
        if (onRetry) onRetry(attempt + 1, MAX_ATTEMPTS);
        await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt - 1) + Math.random() * 400);
      }
    }
    return { ok: false, error: lastError };
  }

  window.AvkasApi = { wakeBackend: wakeBackend, newSubmissionId: newSubmissionId, postForm: postForm };
})();
