/* Thai Nguyen portfolio · Trust Line. Vanilla JS, no dependencies.
 * Motion runs only when <html> has .motion (set in <head>, skipped for reduced motion and ?shot). */
(function () {
  var root = document.documentElement;
  var motion = root.classList.contains("motion");
  window.__tnReady = true;

  /* ---------- theme ---------- */
  var themeBtn = document.getElementById("theme-btn");
  function isDark() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function syncThemeBtn() {
    var d = isDark();
    themeBtn.setAttribute("aria-pressed", String(d));
    themeBtn.setAttribute("aria-label", d ? "Switch to light theme" : "Switch to dark theme");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", d ? "#121522" : "#f8f9fb");
  }
  if (themeBtn) {
    syncThemeBtn();
    themeBtn.addEventListener("click", function () {
      var next = isDark() ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("tn-theme", next); } catch (e) {}
      syncThemeBtn();
    });
  }

  /* ---------- mobile menu ---------- */
  var menuBtn = document.getElementById("menu-btn");
  var sheet = document.getElementById("sheet");
  function closeSheet() { sheet.hidden = true; menuBtn.setAttribute("aria-expanded", "false"); menuBtn.textContent = "Menu"; }
  if (menuBtn && sheet) {
    menuBtn.addEventListener("click", function () {
      var open = sheet.hidden;
      sheet.hidden = !open;
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.textContent = open ? "Close" : "Menu";
    });
    sheet.addEventListener("click", function (e) { if (e.target.tagName === "A") closeSheet(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) { closeSheet(); menuBtn.focus(); } });
  }

  /* ---------- Singapore clock on the board ---------- */
  var sgt = document.getElementById("sgt");
  function tick() {
    if (!sgt) return;
    try {
      sgt.textContent = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Singapore" }).format(new Date());
    } catch (e) { sgt.textContent = ""; }
  }
  tick(); setInterval(tick, 30000);

  /* ---------- split-flap reveal on the board ---------- */
  var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789%";
  function flap(el, delay) {
    var final = el.textContent;
    if (!motion) return;
    var len = final.length, frame = 0, settle = [];
    for (var i = 0; i < len; i++) settle.push(6 + Math.floor(Math.random() * 10) + i);
    el.setAttribute("aria-label", final);
    setTimeout(function run() {
      var out = "", done = true;
      for (var i = 0; i < len; i++) {
        var c = final.charAt(i);
        if (c === " " || frame >= settle[i]) out += c;
        else { out += GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length)); done = false; }
      }
      el.textContent = out;
      frame++;
      if (!done) setTimeout(run, 38);
    }, delay);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".board [data-flap]"), function (el, i) {
    flap(el, 250 + Math.floor(i / 2) * 120);
  });

  /* ---------- autoplay real recordings only while visible ---------- */
  var vids = document.querySelectorAll("video[data-auto]");
  if (motion && "IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.preload = "auto"; e.target.play().catch(function () {}); }
        else e.target.pause();
      });
    }, { threshold: 0.3 });
    Array.prototype.forEach.call(vids, function (v) { vio.observe(v); });
  }

  /* ---------- reveal: signs, map, charts ---------- */
  Array.prototype.forEach.call(document.querySelectorAll(".map__line li"), function (li, i) { li.style.setProperty("--i", i); });
  var pending = Array.prototype.slice.call(document.querySelectorAll(".sign, .map, [data-chart]"));
  if (!motion) { pending.forEach(function (el) { el.classList.add("is-in"); }); pending = []; }

  /* ---------- stations: rail, progress, "Now at" ---------- */
  var bar = document.getElementById("nav");
  var stns = Array.prototype.slice.call(document.querySelectorAll("[data-stn]"));
  var railItems = Array.prototype.slice.call(document.querySelectorAll("#rail li"));
  var railFill = document.getElementById("rail-fill");
  var railTrack = document.querySelector(".rail__track");
  var progFill = document.getElementById("progress-fill");
  var nowCode = document.getElementById("now-code");
  var nowName = document.getElementById("now-name");
  var lastIdx = -2;

  function update() {
    var y = window.scrollY, vh = window.innerHeight, probe = y + vh * 0.4;
    bar.classList.toggle("is-scrolled", y > 8);

    /* reveal */
    pending = pending.filter(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.88) { el.classList.add("is-in"); return false; }
      return true;
    });

    /* which station are we at, and how far through it */
    var idx = -1, frac = 0;
    for (var i = 0; i < stns.length; i++) {
      var top = stns[i].offsetTop, h = stns[i].offsetHeight;
      if (probe >= top) { idx = i; frac = Math.min(1, (probe - top) / Math.max(h, 1)); }
    }
    var n = stns.length - 1;
    var pos = idx < 0 ? 0 : Math.min(1, (idx + (idx < n ? frac : 0)) / n);
    if (railFill && railTrack) {
      railFill.style.height = (pos * 100) + "%";
      railFill.style.setProperty("--rail-h", railTrack.offsetHeight + "px");
    }
    var docH = document.documentElement.scrollHeight - vh;
    if (progFill) progFill.style.width = (docH > 0 ? (y / docH) * 100 : 0) + "%";

    if (idx !== lastIdx) {
      lastIdx = idx;
      railItems.forEach(function (li, i) {
        li.classList.toggle("is-on", i === idx);
        li.classList.toggle("is-past", i < idx);
      });
      var s = stns[idx];
      var nowBox = document.querySelector(".bar__now");
      if (nowBox) nowBox.style.visibility = s ? "visible" : "hidden";
      if (s) {
        var c = s.style.getPropertyValue("--c");
        nowCode.textContent = s.getAttribute("data-code");
        nowCode.style.setProperty("--c", c);
        nowName.textContent = s.getAttribute("data-name");
        if (progFill) progFill.style.setProperty("--now", c);
      } else {
        nowCode.textContent = "TL";
        nowCode.style.setProperty("--c", "var(--ink)");
        nowName.textContent = "Trust Line";
        if (progFill) progFill.style.removeProperty("--now");
      }
    }
  }
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();

  /* ---------- skills filter ---------- */
  var filters = document.querySelectorAll(".filter");
  var rows = document.querySelectorAll("#ledger-body .row");
  var countEl = document.getElementById("skills-count");
  Array.prototype.forEach.call(filters, function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.getAttribute("data-f");
      Array.prototype.forEach.call(filters, function (b) {
        var on = b === btn;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", String(on));
      });
      var k = 0;
      Array.prototype.forEach.call(rows, function (r) {
        var show = f === "all" || r.getAttribute("data-g") === f;
        r.classList.toggle("is-hidden", !show);
        if (show) k++;
      });
      if (countEl) countEl.textContent = k + " skills shown";
    });
  });

  /* ---------- copy email ---------- */
  var copyBtn = document.getElementById("copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var v = copyBtn.getAttribute("data-copy");
      var done = function () { copyBtn.textContent = "Copied"; setTimeout(function () { copyBtn.textContent = "Copy email"; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, done);
      else done();
    });
  }
})();

/* launches: tabs (all panels stay visible without JS) */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tabs__b"));
  if (!tabs.length) return;
  function show(id, focus) {
    tabs.forEach(function (t) {
      var on = t.getAttribute("aria-controls") === id;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      if (on && focus) t.focus();
    });
  }
  show(tabs[0].getAttribute("aria-controls"));
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { show(t.getAttribute("aria-controls")); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { var n = tabs[(i + d + tabs.length) % tabs.length]; show(n.getAttribute("aria-controls"), true); }
    });
  });
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#p-"]');
    if (!a) return;
    show(a.getAttribute("href").slice(1));
  });
  if (/^#p-/.test(location.hash)) show(location.hash.slice(1));
})();

/* v8r: tap feedback. Flags pop with a small burst, the phone buzzes. Vibration where the device supports it. */
(() => {
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };
  const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove(cls), 700); };
  const burst = (host, colors) => {
    if (calm) return;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement("i");
      s.className = "tapbit";
      const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const d = 46 + Math.random() * 38;
      s.style.setProperty("--x", Math.cos(a) * d + "px");
      s.style.setProperty("--y", Math.sin(a) * d + "px");
      s.style.setProperty("--k", colors[i % colors.length]);
      host.appendChild(s);
      setTimeout(() => s.remove(), 800);
    }
  };
  document.querySelectorAll(".flag").forEach((f) => {
    const vn = f.classList.contains("flag--vn");
    f.setAttribute("tabindex", "0");
    const go = () => { buzz([18, 40, 18]); replay(f, "is-tapped"); burst(f, vn ? ["#DA251D", "#FFCD00"] : ["#EF3340", "#FFFFFF", "#EF3340"]); };
    f.addEventListener("click", go);
    f.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });
  const ph = document.querySelector(".zart > img");
  if (ph) ph.addEventListener("click", () => { ph.classList.add("is-in"); buzz([30, 50, 30, 50, 30]); replay(ph, "is-buzz"); });
})();

/* v8w: start the Circular 40 check run only while the card is on screen */
(() => {
  const c = document.getElementById("ex-compliance");
  if (!c || !("IntersectionObserver" in window)) return;
  new IntersectionObserver((es) => es.forEach((e) => c.classList.toggle("is-live", e.isIntersecting)), { threshold: 0.35 }).observe(c);
})();

/* v9e: tap "Vietnam" to show the flag (touch has no hover) */
(function () {
  var w = document.querySelector(".vnw");
  if (!w) return;
  /* v9ac: grow once and hold: on hover, tap, or after it sits in view */
  function toggle() {
    if (w.classList.contains("is-on")) return;
    w.classList.add("is-on");
    if (navigator.vibrate) navigator.vibrate([18, 40, 18]);
  }
  w.addEventListener("click", toggle);
  w.addEventListener("mouseenter", toggle);
  if ("IntersectionObserver" in window) {
    var t, io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        clearTimeout(t);
        if (e.isIntersecting) t = setTimeout(function () { toggle(); io.disconnect(); }, 1600);
      });
    }, { threshold: 1 });
    io.observe(w);
  } else { toggle(); }
  w.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
})();

/* v9g: firefighter reveal: scroll sweeps the divider until the visitor drags it */
(function () {
  var f = document.querySelector(".ffx");
  if (!f) return;
  var r = f.querySelector(".ffx__r"), used = false;
  function set(v) { f.style.setProperty("--x", v + "%"); r.value = Math.round(v); }
  r.addEventListener("input", function () {
    if (!used) { used = true; f.classList.add("is-used"); }
    set(+r.value);
  });
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  function onScroll() {
    if (used) return window.removeEventListener("scroll", onScroll);
    var b = f.getBoundingClientRect(), vh = window.innerHeight;
    var t = (vh - b.top) / (vh + b.height);
    if (t < 0 || t > 1) return;
    set(92 - Math.min(1, Math.max(0, (t - 0.15) / 0.55)) * 72);
  }
})();

/* v9h: draw the 1x to 4x line and count up when it comes into view */
(function () {
  var c = document.querySelector(".x4");
  if (!c) return;
  var n = c.querySelector(".x4__n");
  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function run() {
    if (still) { n.textContent = "4"; return; }
    c.classList.remove("is-in"); void c.offsetWidth; c.classList.add("is-in");
    var t0 = performance.now();
    (function tick(t) {
      var k = Math.min(1, (t - t0) / 1400);
      n.textContent = String(Math.max(1, Math.round(1 + 3 * k * k * (3 - 2 * k))));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }
  if (!("IntersectionObserver" in window)) return run();
  new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting && e.boundingClientRect.width > 0) run(); });
  }, { threshold: 0.5 }).observe(c);
})();

/* v9p: start at 50%, no scroll sweep; the helmet appears once the head is on the firefighter side */
(function () {
  var f = document.querySelector(".ffx");
  if (!f) return;
  var r = f.querySelector(".ffx__r");
  function hat() { f.classList.toggle("has-hat", +r.value < 36); }
  r.addEventListener("input", hat);
  window.addEventListener("load", function () { r.value = 50; f.style.setProperty("--x", "50%"); hat(); });
})();

/* v9u: tools flows step in when the section is seen */
(function () {
  var s = document.getElementById("side");
  if (!s) return;
  if (!("IntersectionObserver" in window)) { s.classList.add("is-in"); return; }
  var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { s.classList.add("is-in"); io.disconnect(); } }); }, { threshold: 0.15 });
  io.observe(s);
})();
