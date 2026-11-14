/* =========================================================
   script.js – page behaviour (header, animations, filters)
   ========================================================= */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- keep hyphenated words whole ----------
     A compound such as "high-caliber" or "12–15%" must never be split across two lines
     (no dangling "high-"). Wrap each one in a no-wrap span so it moves to the next line intact. */
  (function keepWordsWhole() {
    var re = /[\p{L}\p{N}%]+(?:[\-\u2010\u2011\u2013][\p{L}\p{N}%]+)+/gu;
    var skip = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, TITLE: 1, SVG: 1, CODE: 1, PRE: 1 };
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var el = n.parentElement;
        if (!el || /flex|grid/.test(getComputedStyle(el).display) || skip[el.tagName.toUpperCase()] || el.closest(".fx-split, .pill, .nw, svg")) return NodeFilter.FILTER_REJECT;
        re.lastIndex = 0;
        return re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      var text = node.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var sp = document.createElement("span");
        sp.className = "nw"; sp.textContent = m[0];
        frag.appendChild(sp);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  })();

  /* ---------- footer year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- header: compact "pill only" state after scrolling ---------- */
  var header = $("#siteHeader");
  if (header) {
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 70); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- reveal on scroll ---------- */
  var reveals = $$(".reveal");
  if (reveals.length) {
    if (!("IntersectionObserver" in window) || reduce) {
      reveals.forEach(function (el) { el.classList.add("in"); });
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
        });
      }, { threshold: 0.12 });
      reveals.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- count-up numbers (stats card) ---------- */
  var stats = $("#stats");
  if (stats) {
    var counters = $$("[data-count]", stats);
    var pad = function (n, d) { var s = String(n); while (s.length < d) s = "0" + s; return s; };
    counters.forEach(function (el) { el.textContent = pad(0, el.getAttribute("data-count").length); });
    var runCount = function () {
      counters.forEach(function (el) {
        var to = parseInt(el.getAttribute("data-count"), 10), digits = String(to).length;
        if (reduce) { el.textContent = pad(to, digits); return; }
        var start = performance.now(), dur = 1600;
        (function tick(t) {
          var p = Math.min((t - start) / dur, 1);
          el.textContent = pad(Math.round(to * (1 - Math.pow(1 - p, 3))), digits);
          if (p < 1) requestAnimationFrame(tick);
        })(start);
      });
    };
    if ("IntersectionObserver" in window) {
      var sio = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { runCount(); sio.disconnect(); }
      }, { threshold: 0.3 });
      sio.observe(stats);
    } else runCount();
  }

  /* ---------- rotating hero headline ---------- */
  var rot = $("#heroRot");
  if (rot && !reduce) {
    var words = ["Trusted Governance", "Future-Ready Advisory"], i = 0;
    setInterval(function () {
      rot.classList.add("out");
      setTimeout(function () { i = (i + 1) % words.length; rot.textContent = words[i]; rot.classList.remove("out"); }, 350);
    }, 3800);
  }

  /* ---------- hero video: play only while visible ---------- */
  var vid = $("#heroVideo");
  if (vid) {
    var ready = function () { vid.classList.add("is-ready"); };
    if (vid.readyState >= 3) ready(); else { vid.addEventListener("canplay", ready, { once: true }); setTimeout(ready, 2500); }
    if (reduce) vid.pause();
    else if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { var p = vid.play(); if (p && p.catch) p.catch(function () {}); } else vid.pause();
      }, { threshold: 0.05 }).observe(vid);
    }
  }

  /* ---------- "Why we exists": tap a card to read the full details ---------- */
  $$(".why-card").forEach(function (card) {
    var btn = $(".why-btn", card), wrap = card.parentElement;
    if (!btn) return;
    var poke = function () { window.dispatchEvent(new Event("resize")); };   // lets the stacking effect re-measure
    btn.addEventListener("click", function () {
      var open = card.getAttribute("data-open") !== "true";
      card.setAttribute("data-open", open ? "true" : "false");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      wrap.classList.toggle("is-open", open);
      poke(); setTimeout(poke, 450);
    });
  });

  /* ---------- "Why we exists": cards stack while scrolling ---------- */
  var wraps = $$(".why-wrap");
  if (wraps.length && !reduce) {
    var raf = 0;
    var update = function () {
      raf = 0;
      var vh = window.innerHeight, stick = window.innerWidth >= 768 ? 110 : 70;
      // 1) read everything first ...
      var tops = wraps.map(function (w) { return w.getBoundingClientRect().top; });
      var heights = wraps.map(function (w) { return w.firstElementChild.offsetHeight; });
      // 2) ... then write everything (no layout is forced between reads and writes = smoother scrolling)
      wraps.forEach(function (w, idx) {
        var card = w.firstElementChild;
        if (card.getAttribute("data-open") === "true") { card.style.opacity = "1"; card.style.transform = "none"; return; }   // an opened card stays crisp while it is being read
        var enter = Math.min(1, Math.max(0, (vh * 0.96 - tops[idx]) / (vh * 0.5)));   // fades in while rising into view
        var cover = 0;
        if (wraps[idx + 1]) cover = Math.min(1, Math.max(0, 1 - (tops[idx + 1] - stick) / (heights[idx] * 0.95)));  // fades back + shrinks as the next card slides over
        card.style.opacity = String((0.18 + 0.82 * enter) * (1 - 0.7 * cover));
        card.style.transform = "scale(" + (1 - 0.05 * cover) + ")";
      });
    };
    var onWhy = function () { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onWhy, { passive: true });
    window.addEventListener("resize", onWhy);
  }

  /* ---------- blog category filter ---------- */
  var filters = $(".filters");
  if (filters) {
    var cards = $$(".post-card[data-cat]");
    $$("button", filters).forEach(function (b) {
      b.addEventListener("click", function () {
        var cat = b.getAttribute("data-cat");
        $$("button", filters).forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        cards.forEach(function (c) { c.hidden = !(cat === "All" || c.getAttribute("data-cat") === cat); });
      });
    });
  }

  /* ---------- quietly preload the main pages so navigation feels instant ---------- */
  var idle = window.requestIdleCallback || function (cb) { return setTimeout(cb, 1500); };
  idle(function () {
    ["index.html", "about.html", "services.html", "events.html", "careers.html", "reach-us.html", "blog.html"].forEach(function (h, n) {
      setTimeout(function () {
        var l = document.createElement("link");
        l.rel = "prefetch"; l.href = h; l.as = "document";
        document.head.appendChild(l);
      }, n * 120);
    });
  }, { timeout: 3000 });

  /* ---------- smooth wheel scrolling ----------
     Desktop mice only. Phones and tablets keep the browser's own momentum scrolling (already smooth and what
     people expect on touch). Lenis is bundled in /vendor, so there is no extra CDN request. */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine && !reduce) {
    var ls = document.createElement("script");
    ls.src = "vendor/lenis.min.js";
    ls.async = true;
    ls.onload = function () {
      if (!window.Lenis) return;
      window.avkasLenis = new window.Lenis({
        autoRaf: true,            // runs its own animation frame loop
        lerp: 0.09,               // glide: lower = silkier, higher = snappier
        smoothWheel: true,
        anchors: { offset: -90 }, // in-page links (e.g. "Get in Touch") glide and stop below the fixed header
        allowNestedScroll: true   // textareas / the events pop-up still scroll normally
      });
    };
    document.head.appendChild(ls);
  }
})();
