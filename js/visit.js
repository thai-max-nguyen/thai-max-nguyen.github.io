// Visit alert: pushes a note to ntfy when a tagged link (?s=...) or a Singapore visitor opens the page.
(function () {
  if (navigator.webdriver) return;
  var TOPIC = 'https://ntfy.sh/tm-5eb3cdbfeefdf23b';
  var SCHOOL = /national university of singapore|nus\.edu|nanyang|ntu\.edu|singapore management|smu\.edu/i;
  var src = (location.search.match(/[?&]s=([\w-]+)/) || [])[1] || '';
  var t0 = Date.now(), maxScroll = 0, info = null;

  addEventListener('scroll', function () {
    var h = document.documentElement;
    var p = Math.round(100 * (h.scrollTop + innerHeight) / h.scrollHeight);
    if (p > maxScroll) maxScroll = p;
  }, { passive: true });

  function send(title, body, tags, beacon) {
    var url = TOPIC + '?title=' + encodeURIComponent(title) + '&tags=' + tags;
    if (beacon && navigator.sendBeacon) navigator.sendBeacon(url, body);
    else fetch(url, { method: 'POST', body: body, keepalive: true }).catch(function () {});
  }

  function lookup() {
    return fetch('https://ipwho.is/').then(function (r) { return r.json(); }).then(function (j) {
      if (!j.success) throw 0;
      return { ip: j.ip, cc: j.country_code, city: j.city, org: (j.connection || {}).org || '', isp: (j.connection || {}).isp || '' };
    }).catch(function () {
      return fetch('https://ipapi.co/json/').then(function (r) { return r.json(); }).then(function (j) {
        return { ip: j.ip, cc: j.country_code, city: j.city, org: j.org || '', isp: '' };
      });
    }).catch(function () { return { ip: '?', cc: '?', city: '?', org: '?', isp: '' }; });
  }

  lookup().then(function (v) {
    var net = v.org + ' ' + v.isp;
    var school = SCHOOL.test(net);
    if (!src && v.cc !== 'SG' && !school) return;
    if (sessionStorage.getItem('va')) return;
    sessionStorage.setItem('va', '1');
    info = v;
    var who = school ? 'SCHOOL NETWORK' : (src ? 'link ' + src.toUpperCase() : 'SG visitor');
    send('Portfolio: ' + who,
      'link: ' + (src || '(none)') + '\nnet: ' + v.org + (v.isp && v.isp !== v.org ? ' / ' + v.isp : '') +
      '\nwhere: ' + v.city + ', ' + v.cc + '\nip: ' + v.ip + '\nfrom: ' + (document.referrer || 'direct') +
      '\ndevice: ' + (/Mobi/.test(navigator.userAgent) ? 'mobile' : 'desktop'),
      school ? 'rotating_light' : 'eyes');
  });

  var done = false;
  function leave() {
    if (!info || done) return;
    var sec = Math.round((Date.now() - t0) / 1000);
    if (sec < 10) return;
    done = true;
    send('Portfolio: ' + (src ? src.toUpperCase() : 'SG') + ' left',
      'read ' + Math.floor(sec / 60) + 'm' + (sec % 60) + 's, scrolled ' + maxScroll + '%\nnet: ' + info.org,
      'hourglass', true);
  }
  addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') leave(); });
})();
