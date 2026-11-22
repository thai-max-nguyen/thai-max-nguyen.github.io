// Visit log: every real visit goes to ntfy as a small JSON event (arrive, engaged, leave).
// A private poller turns these into visits.csv rows and mails only the high-signal ones.
// Each event is also published with delays (ntfy holds scheduled messages up to 3 days),
// so a late poller still finds it. No cookies, no third-party tracker; IP is truncated.
// Owner opt-out: open the site once with ?me=1 (undo with ?me=0).
(function () {
  try {
    // storage can be blocked (cookies off, private mode): fall back to memory, never drop the visit
    var mem = {};
    function store(kind) {
      var st = null;
      try { st = window[kind]; st.setItem('tm_t', '1'); st.removeItem('tm_t'); } catch (e) { st = null; }
      return {
        ok: !!st,
        get: function (k) { try { return st ? st.getItem(k) : (mem[kind + k] || null); } catch (e) { return null; } },
        set: function (k, v) { try { if (st) st.setItem(k, v); else mem[kind + k] = v; } catch (e) {} },
        del: function (k) { try { if (st) st.removeItem(k); } catch (e) {} }
      };
    }
    var LS = store('localStorage'), SS = store('sessionStorage');
    var q = location.search;
    var me = (q.match(/[?&]me=([01])/) || [])[1];
    if (me === '1') { LS.set('tm_me', '1'); return; }
    if (me === '0') LS.del('tm_me');
    if (LS.get('tm_me') === '1') return;
    if (navigator.webdriver) return;
    if (/bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly/i.test(navigator.userAgent)) return;
    if (SS.get('tm_sid')) return; // one visit per tab session; reloads are not new visits

    var TOPIC = 'https://ntfy.sh/tm-5eb3cdbfeefdf23b';
    // ntfy caches 12 h; arrive + engaged also go out with delays, so a poller gap up to 56 h loses
    // nothing. leave is sent once (read-time detail only). 11 msgs per visit vs ntfy cap 250/IP/day.
    var DELAYS = [0, 11, 22, 33, 44];
    var rid = function () { return Math.random().toString(36).slice(2, 10); };
    var sid = rid();
    SS.set('tm_sid', sid);
    var vid = LS.ok ? LS.get('tm_vid') : 'nostore';
    var visits = +(LS.get('tm_n') || 0);
    if (!vid) { vid = rid(); LS.set('tm_vid', vid); }
    LS.set('tm_n', String(visits + 1));

    var tag = ((q.match(/[?&]s=([\w-]{1,40})/) || [])[1] || '').toLowerCase();
    var ref = '';
    try { if (document.referrer) { var r = new URL(document.referrer); ref = r.host === location.host ? '' : r.host + r.pathname; } } catch (e) {}
    var ua = navigator.userAgent;
    var base = {
      v: 2, vid: vid, sid: sid, tag: tag,
      page: location.pathname + location.hash,
      ref: ref.slice(0, 120),
      dev: (/Mobi|Android|iPhone|iPad/.test(ua) ? 'mobile' : 'desktop') + '/' +
        (/iPhone|iPad|Mac OS/.test(ua) ? (/iPhone|iPad/.test(ua) ? 'ios' : 'mac') : /Android/.test(ua) ? 'android' : /Windows/.test(ua) ? 'win' : /Linux/.test(ua) ? 'linux' : 'other') + '/' +
        (/Edg\//.test(ua) ? 'edge' : /Chrome\//.test(ua) ? 'chrome' : /Safari\//.test(ua) ? 'safari' : /Firefox\//.test(ua) ? 'firefox' : 'other'),
      lang: (navigator.language || '').slice(0, 10),
      scr: screen.width + 'x' + screen.height,
      ret: visits > 0 ? 1 : 0, n: visits + 1,
      t0: new Date().toISOString(),
      cc: '?', city: '', org: '', ip: ''
    };

    var t0 = Date.now(), maxScroll = 0, engaged = false, left = false, arrived = false, visMs = 0, visFrom = t0;

    function send(ev, extra, beacon) {
      try {
        var o = {}, k;
        for (k in base) o[k] = base[k];
        for (k in extra || {}) o[k] = extra[k];
        o.ev = ev; o.k = sid + ':' + ev; o.at = new Date().toISOString();
        var title = 'Portfolio ' + ev + (tag ? ' ' + tag.toUpperCase() : '') + ' ' + (o.cc || '?');
        var copies = ev === 'leave' ? 1 : DELAYS.length;
        for (var i = 0; i < copies; i++) {
          o.dl = DELAYS[i]; // hours this copy is held back; lets the poller recover the real time
          var body = JSON.stringify(o);
          var url = TOPIC + '?title=' + encodeURIComponent(title) + (DELAYS[i] ? '&delay=' + DELAYS[i] + 'h' : '');
          if (beacon && navigator.sendBeacon && navigator.sendBeacon(url, body)) continue;
          if (window.fetch) fetch(url, { method: 'POST', body: body, keepalive: true }).catch(function () {});
        }
      } catch (e) {}
    }

    function mask(ip) {
      if (!ip) return '';
      if (ip.indexOf(':') > -1) {
        var g = ip.split('::')[0].split(':');
        while (g.length < 3) g.push('0');
        return g.slice(0, 3).join(':') + '::/48';
      }
      var p = ip.split('.'); return p.length === 4 ? p[0] + '.' + p[1] + '.' + p[2] + '.0/24' : '';
    }

    function getJSON(url, ms) {
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
      return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(timer); return r.json(); });
    }

    function lookup() {
      return getJSON('https://ipwho.is/', 3500).then(function (j) {
        if (!j || !j.success) throw 0;
        var c = j.connection || {};
        return { cc: j.country_code, city: j.city, org: (c.org || '') + (c.isp && c.isp !== c.org ? ' / ' + c.isp : ''), ip: j.ip };
      }).catch(function () {
        return getJSON('https://ipapi.co/json/', 3500).then(function (j) {
          if (!j || j.error || !j.country_code) throw 0;
          return { cc: j.country_code, city: j.city, org: j.org || '', ip: j.ip };
        });
      });
    }

    function arrive(v, beacon) {
      if (arrived) return;
      arrived = true;
      try { if (v) { base.cc = String(v.cc || '?'); base.city = String(v.city || '').slice(0, 40); base.org = String(v.org || '').slice(0, 120); base.ip = mask(String(v.ip || '')); } } catch (e) {}
      send('arrive', {}, beacon);
      if (engaged) send('engaged', stats()); // engaged before the lookup finished
    }

    function stats() {
      var vis = visMs + (document.visibilityState === 'visible' ? Date.now() - visFrom : 0);
      return { sec: Math.round(vis / 1000), scroll: maxScroll };
    }

    function checkEngaged() {
      if (engaged) return;
      var s = stats();
      // scroll needs 10 s too: a deep link (#contact) lands past 50% at once
      if ((s.scroll >= 50 && s.sec >= 10) || s.sec >= 30) { engaged = true; if (arrived) send('engaged', s); }
    }

    // Never drop a visit: lookup blocked, failed or slow -> log with country unknown.
    var fallback = setTimeout(function () { arrive(null); }, 8000);
    try {
      lookup().then(function (v) { clearTimeout(fallback); arrive(v); }, function () { clearTimeout(fallback); arrive(null); });
    } catch (e) { clearTimeout(fallback); arrive(null); }

    addEventListener('scroll', function () {
      var h = document.documentElement;
      var p = h.scrollHeight ? Math.min(100, Math.round(100 * (h.scrollTop + innerHeight) / h.scrollHeight)) : 0;
      if (p > maxScroll) maxScroll = p;
      checkEngaged();
    }, { passive: true });
    var tick = setInterval(function () { checkEngaged(); if (engaged) clearInterval(tick); }, 5000);

    function leave() {
      if (left) return;
      if (!arrived) { clearTimeout(fallback); arrive(null, true); } // closed before the lookup ended: still log it
      var s = stats();
      if (s.sec < 5 && !engaged) return; // bounce under 5 s: arrive row is enough
      left = true;
      s.engaged = engaged ? 1 : 0;
      send('leave', s, true);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { visMs += Date.now() - visFrom; leave(); }
      else visFrom = Date.now();
    });
    addEventListener('pagehide', function () {
      if (document.visibilityState === 'visible') { visMs += Date.now() - visFrom; visFrom = Date.now(); }
      leave();
    });
  } catch (e) {}
})();
