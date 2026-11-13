/* =========================================================
   fx.js – scroll effects, floating balls, physics pills
   ========================================================= */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var hasIO = "IntersectionObserver" in window;

  /* ---------- 1. scroll progress bar ---------- */
  var bar = document.createElement("div");
  bar.id = "fxProgress"; bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  /* ---------- word-by-word heading reveal ---------- */
  var heads = $$("main h2").filter(function (h) { return !h.children.length && h.textContent.trim() && !h.closest(".ev-dialog"); });
  heads.forEach(function (h) {
    var words = h.textContent.trim().split(/\s+/);
    h.setAttribute("aria-label", words.join(" "));
    h.innerHTML = words.map(function (w, i) {
      return '<span class="w" aria-hidden="true"><span style="--i:' + i + '">' + w.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "</span></span>";
    }).join(" ");
    h.classList.add("fx-split");
  });
  if (hasIO && !reduce) {
    var hio = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("fx-in"); hio.unobserve(e.target); } });
    }, { threshold: 0.4, rootMargin: "0px 0px -6% 0px" });
    heads.forEach(function (h) { hio.observe(h); });
  } else heads.forEach(function (h) { h.classList.add("fx-in"); });

  /* stagger + scale variants on grids */
  $$(".card-grid > .reveal, .member-grid > .reveal, .ev-grid > .ev-card").forEach(function (el, i) {
    if (el.classList.contains("reveal")) el.classList.add("fx-scale");
  });

  /* ---------- parallax images + progress (one rAF scroll loop) ---------- */
  // Touch screens / small screens skip the image parallax: it re-styles many images on every scroll frame
  // and is the main thing that makes scrolling feel heavy on phones.
  var lite = window.matchMedia("(pointer: coarse), (max-width: 767px)").matches;
  var pars = lite ? [] : $$(".thumb img, .ev-img img");
  pars.forEach(function (img) { img.classList.add("fx-par"); img.style.transform = "scale(1.12)"; });
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(scrollY / max, 1) : 0) + ")";
      if (reduce || !pars.length) return;
      var vh = innerHeight, todo = [];
      for (var i = 0; i < pars.length; i++) {            // 1) read all positions
        var r = pars[i].parentNode.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 50) continue;
        todo.push([pars[i], ((r.top + r.height / 2) / vh - 0.5) * -22]);
      }
      for (var j = 0; j < todo.length; j++)              // 2) then write all transforms
        todo[j][0].style.transform = "translate3d(0," + todo[j][1].toFixed(1) + "px,0) scale(1.12)";
    });
  }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* run a callback only while an element is on screen */
  function whenVisible(el, on, off) {
    if (!hasIO) { on(); return; }
    new IntersectionObserver(function (en) { en[0].isIntersecting ? on() : off && off(); }, { rootMargin: "120px" }).observe(el);
  }

  /* ---------- 2. Let's talk: floating balls ---------- */
  var box = $("#talkBalls");
  if (box) {
    var cfg = [
      { x: .06, y: .62, s: 44, d: .9, k: "ring", c: "#f08a1c" },
      { x: .14, y: .22, s: 30, d: .5, k: "solid", c: "#1260a8" },
      { x: .2,  y: .72, s: 62, d: 1.1, k: "soft", icon: "fa-chart-line" },
      { x: .27, y: .34, s: 40, d: .7, k: "solid", c: "#18a574" },
      { x: .34, y: .8,  s: 26, d: .4, k: "ring", c: "#1260a8" },
      { x: .4,  y: .18, s: 56, d: 1.0, k: "solid", c: "#f08a1c" },
      { x: .47, y: .55, s: 34, d: .6, k: "soft", icon: "fa-receipt" },
      { x: .56, y: .26, s: 28, d: .5, k: "ring", c: "#18a574" },
      { x: .62, y: .74, s: 58, d: 1.1, k: "solid", c: "#0e3a5c" },
      { x: .69, y: .36, s: 38, d: .8, k: "solid", c: "#1260a8" },
      { x: .76, y: .8,  s: 30, d: .5, k: "solid", c: "#d8c27a" },
      { x: .82, y: .2,  s: 60, d: 1.0, k: "soft", icon: "fa-landmark" },
      { x: .89, y: .62, s: 36, d: .7, k: "solid", c: "#18a574" },
      { x: .95, y: .28, s: 26, d: .4, k: "ring", c: "#f08a1c" }
    ];
    var balls = cfg.map(function (b, n) {
      var el = document.createElement("span");
      el.className = "ball " + b.k; el.setAttribute("aria-hidden", "true");
      var i = document.createElement("i");
      i.style.setProperty("--d", (n * 0.06) + "s");
      if (b.c) i.style.background = b.k === "solid" ? "radial-gradient(circle at 32% 28%, rgba(255,255,255,.55), " + b.c + " 60%)" : b.c;
      if (b.c && b.k === "ring") i.style.borderColor = b.c;
      if (b.icon) i.innerHTML = '<span class="fa-solid ' + b.icon + '" style="font-size:' + b.s * .36 + 'px"></span>';
      el.appendChild(i); box.appendChild(el);
      return { el: el, i: i, c: b, ox: 0, oy: 0, ph: Math.random() * 6.28, sp: .5 + Math.random() * .6 };
    });
    var mouse = { x: -999, y: -999, in: false }, W = 0, H = 0, running = false, raf;
    function size() {
      W = box.clientWidth; H = box.clientHeight;
      var k = Math.max(.6, Math.min(1, W / 900));
      balls.forEach(function (b) { b.sz = b.c.s * k; b.i.style.width = b.i.style.height = b.sz + "px"; });
    }
    size(); addEventListener("resize", size);
    box.parentNode.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;   // fingers scroll the page; only a mouse repels the balls
      var r = box.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.in = true;
    });
    box.parentNode.addEventListener("pointerleave", function () { mouse.in = false; });
    function frame(t) {
      var r = box.getBoundingClientRect(), sc = (r.top / innerHeight - .4);
      balls.forEach(function (b) {
        var bx = (.08 + b.c.x * .84) * W, by = (.12 + b.c.y * .76) * H;
        var fx = Math.sin(t * .0008 * b.sp + b.ph) * 14 * b.c.d, fy = Math.cos(t * .0007 * b.sp + b.ph) * 18 * b.c.d;
        var tx = 0, ty = sc * b.c.d * 70;
        if (mouse.in) {
          var dx = bx + fx - mouse.x, dy = by + fy - mouse.y, d = Math.hypot(dx, dy) || 1;
          tx += ((mouse.x / W) - .5) * -26 * b.c.d;
          if (d < 140) { var p = (140 - d) / 140; tx += dx / d * p * 70; ty += dy / d * p * 70; }
        }
        b.ox += (tx - b.ox) * .08; b.oy += (ty - b.oy) * .08;
        var px = Math.max(0, Math.min(W - b.sz, bx + fx + b.ox - b.sz / 2));   // never outside the box = never wider than the screen
        b.el.style.transform = "translate3d(" + px.toFixed(1) + "px," + (by + fy + b.oy - b.sz / 2).toFixed(1) + "px,0)";
      });
      raf = requestAnimationFrame(frame);
    }
    if (reduce) {
      balls.forEach(function (b) { b.el.style.transform = "translate3d(" + ((.08 + b.c.x * .84) * W - b.sz / 2) + "px," + ((.12 + b.c.y * .76) * H - b.sz / 2) + "px,0)"; });
      box.classList.add("in");
    } else whenVisible(box, function () {
      box.classList.add("in");
      if (!running) { running = true; raf = requestAnimationFrame(frame); }
    }, function () { running = false; cancelAnimationFrame(raf); });
  }

  /* ---------- 3. Taking Brands Further: physics pills ---------- */
  var stage = $("#pillStage");
  function initPills() {
    var M = window.Matter;
    if (!stage || !M || reduce) return;
    var pills = $$(".pill", stage), engine, bodies = [], sizes = [], raf = 0, started = false, visible = false, drag = null, timers = [], lastW = 0;
    var cur = document.createElement("div"); cur.className = "drag-cursor"; cur.innerHTML = "<span>Drag</span>"; stage.parentNode.insertBefore(cur, stage); 
    stage.parentNode.style.position = "relative";

    function teardown() {
      timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); raf = 0;
      if (engine) { M.World.clear(engine.world, false); M.Engine.clear(engine); }
      bodies = []; drag = null;
    }
    function build() {
      teardown();
      stage.classList.remove("is-physics");
      sizes = pills.map(function (p) { return { w: p.offsetWidth, h: p.offsetHeight }; });
      stage.classList.add("is-physics");
      var W = stage.clientWidth, H = stage.clientHeight; lastW = W;
      engine = M.Engine.create({ positionIterations: 10, velocityIterations: 8 }); engine.gravity.y = 1.15;
      var T = 400, wall = { isStatic: true };
      var add = [
        M.Bodies.rectangle(W / 2, H + T / 2, W + T * 2, T, wall),
        M.Bodies.rectangle(-T / 2, H / 2 - 1500, T, H + 3000, wall),
        M.Bodies.rectangle(W + T / 2, H / 2 - 1500, T, H + 3000, wall)
      ];
      var bins = [[0, W]];
      if (W >= 900) {
        add.push(M.Bodies.rectangle(W * .5, H / 2 - 1500 + 0, W * .24, H + 3000, wall));
        bins = [[0, W * .38], [W * .62, W]];
      }
      M.World.add(engine.world, add);
      pills.forEach(function (p) { p.style.visibility = "hidden"; });
      engine._bins = bins; engine._W = W;
      if (started) spawn();
    }
    function spawn() {
      var bins = engine._bins;
      pills.forEach(function (p, i) {
        timers.push(setTimeout(function () {
          var s = sizes[i], bin = bins[i % bins.length], span = Math.max(bin[1] - bin[0] - s.w, 0);
          var x = bin[0] + s.w / 2 + Math.random() * span;
          var b = M.Bodies.rectangle(x, -s.h - 30, s.w, s.h, { chamfer: { radius: s.h / 2 }, restitution: .25, friction: .35, frictionAir: .012, density: .002, angle: (Math.random() - .5) * 1.2 });
          M.Body.setAngularVelocity(b, (Math.random() - .5) * .08);
          bodies[i] = b; M.World.add(engine.world, b); p.style.visibility = "visible";
        }, i * 170));
      });
    }
    function tick() {
      M.Engine.update(engine, 1000 / 60);
      for (var i = 0; i < pills.length; i++) {
        var b = bodies[i]; if (!b) continue;
        pills[i].style.transform = "translate3d(" + (b.position.x - sizes[i].w / 2).toFixed(1) + "px," + (b.position.y - sizes[i].h / 2).toFixed(1) + "px,0) rotate(" + b.angle.toFixed(4) + "rad)";
      }
      raf = requestAnimationFrame(tick);
    }

    /* dragging */
    pills.forEach(function (p, i) {
      p.addEventListener("pointerdown", function (e) {
        var b = bodies[i]; if (!b || e.button > 0) return;
        e.preventDefault(); p.setPointerCapture(e.pointerId);
        var r = stage.getBoundingClientRect(), pt = { x: e.clientX - r.left, y: e.clientY - r.top };
        var local = M.Vector.rotate(M.Vector.sub(pt, b.position), -b.angle);
        var c = M.Constraint.create({ pointA: pt, bodyB: b, pointB: local, stiffness: .22, damping: .12, length: 0 });
        M.World.add(engine.world, c);
        drag = { i: i, c: c, sx: e.clientX, sy: e.clientY, moved: 0 }; p.classList.add("dragging");
      });
      p.addEventListener("pointermove", function (e) {
        if (!drag || drag.i !== i) return;
        var r = stage.getBoundingClientRect();
        drag.c.pointA = { x: Math.max(0, Math.min(e.clientX - r.left, r.width)), y: Math.max(-40, Math.min(e.clientY - r.top, r.height)) };
        drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
      });
      var end = function () {
        if (!drag || drag.i !== i) return;
        M.World.remove(engine.world, drag.c); p.dataset.moved = drag.moved > 6 ? "1" : ""; drag = null; p.classList.remove("dragging");
      };
      p.addEventListener("pointerup", end); p.addEventListener("pointercancel", end);
      p.addEventListener("click", function (e) { if (p.dataset.moved) { e.preventDefault(); p.dataset.moved = ""; } });
      p.addEventListener("dragstart", function (e) { e.preventDefault(); });
    });

    /* "Drag" cursor */
    stage.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      var r = stage.parentNode.getBoundingClientRect();
      cur.style.transform = "translate3d(" + (e.clientX - r.left) + "px," + (e.clientY - r.top) + "px,0)";
      cur.classList.add("on"); cur.classList.toggle("big", !!e.target.closest(".pill"));
    });
    stage.addEventListener("pointerleave", function () { cur.classList.remove("on", "big"); });
    cur.style.top = "0"; cur.style.left = "0";

    build();
    whenVisible(stage, function () {
      visible = true;
      if (!started) { started = true; spawn(); }
      if (!raf) raf = requestAnimationFrame(tick);
    }, function () { visible = false; cancelAnimationFrame(raf); raf = 0; });
    var rt; addEventListener("resize", function () {
      clearTimeout(rt); rt = setTimeout(function () { if (Math.abs(stage.clientWidth - lastW) > 30) { build(); if (visible && !raf) raf = requestAnimationFrame(tick); } }, 250);
    });
  }
  if (window.Matter) initPills(); else addEventListener("load", initPills);
})();
