/* =========================================================
   config.js – where the backend lives.
   When you run `npm start`, the Node server REPLACES this file with an
   automatic "same address" version, so nothing here needs editing.
   This copy is only used if the public/ folder is hosted on its own
   (for example a separate Render Static Site).
   ========================================================= */
(function () {
  // Used only when the website is hosted separately from the backend
  var PRODUCTION_API = ""; // "" = same address as the website (the Lambda serves both). Put a full https://… URL only if the site is hosted separately.

  var host = location.hostname;
  var isLan = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|.+\.local)$/.test(host) || host === "";
  // On your own computer / phone-on-Wi-Fi the backend runs on port 4000 of the same machine
  var base = (isLan ? "http://" + (host || "localhost") + ":4000" : PRODUCTION_API).replace(/\/+$/, "");

  window.AVKAS_CONFIG = {
    API_BASE_URL: base,
    API: {
      wake: base + "/api/wake",
      health: base + "/api/health",
      contact: base + "/api/contact",
      career: base + "/api/career"
    }
  };
})();
