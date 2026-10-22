/* "Report a problem": a small form on the studio and the landing page.
   - Any element with data-report opens it. window.TWP_REPORT.open() does too.
   - It notes recent script errors from the moment this file loads, so load it before the studio's own scripts.
   - The report goes to POST /api/reports with the page, browser, screen size and preview device attached.
     The Admin tab lists them (Admin › Problem reports). A copy without the screenshot is kept in this browser. */
(function () {
  'use strict';
  var MAX_SHOT = 2900000; // characters of data URL; the server takes up to 3 MB
  var errors = [];
  function note(msg) {
    msg = String(msg || '').slice(0, 900);
    if (!msg || errors[errors.length - 1] === msg) return;
    errors.push(new Date().toISOString().slice(11, 19) + ' ' + msg);
    if (errors.length > 15) errors.shift();
  }
  addEventListener('error', function (e) {
    if (e.message) note(e.message + (e.filename ? ' (' + e.filename.replace(location.origin, '') + ':' + e.lineno + ')' : ''));
    else if (e.target && e.target !== window && (e.target.src || e.target.href)) note('Could not load ' + (e.target.src || e.target.href));
  }, true);
  addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    note('Unhandled: ' + (r && (r.stack || r.message) ? String(r.message || r.stack) : String(r)));
  });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ICON = {
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    check: '<path d="M20 6 9 17l-5-5"/>'
  };
  var ic = function (n, s) { return '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>'; };

  /* what the page knows about itself */
  function browserName() {
    var u = navigator.userAgent, m;
    if ((m = u.match(/Edg\/([\d.]+)/))) return 'Edge ' + m[1].split('.')[0];
    if ((m = u.match(/OPR\/([\d.]+)/))) return 'Opera ' + m[1].split('.')[0];
    if ((m = u.match(/SamsungBrowser\/([\d.]+)/))) return 'Samsung Internet ' + m[1].split('.')[0];
    if ((m = u.match(/(?:Firefox|FxiOS)\/([\d.]+)/))) return 'Firefox ' + m[1].split('.')[0];
    if ((m = u.match(/(?:Chrome|CriOS)\/([\d.]+)/))) return 'Chrome ' + m[1].split('.')[0];
    if ((m = u.match(/Version\/([\d.]+).*Safari/))) return 'Safari ' + m[1];
    return u.slice(0, 120);
  }
  function osName() {
    var u = navigator.userAgent, m;
    if ((m = u.match(/iPhone OS ([\d_]+)/))) return 'iPhone, iOS ' + m[1].replace(/_/g, '.');
    if ((m = u.match(/iPad.*OS ([\d_]+)/))) return 'iPad, iPadOS ' + m[1].replace(/_/g, '.');
    if (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) return 'iPad (desktop mode)';
    if ((m = u.match(/Android ([\d.]+)/))) return 'Android ' + m[1] + (/Mobile/.test(u) ? ' phone' : ' tablet');
    if (/Windows NT 10/.test(u)) return 'Windows 10 or 11';
    if (/Windows/.test(u)) return 'Windows';
    if ((m = u.match(/Mac OS X ([\d_]+)/))) return 'Mac, macOS ' + m[1].replace(/_/g, '.');
    if (/CrOS/.test(u)) return 'Chromebook';
    if (/Linux/.test(u)) return 'Linux';
    return '';
  }
  function where() {
    if (!$('#v-builder')) return 'landing';
    var v = document.querySelector('main > .view:not([hidden])');
    return v ? v.id.replace(/^v-/, '') : 'studio';
  }
  function preview() {
    var d = $('#device');
    if (!d || where() !== 'builder') return '';
    var on = document.querySelector('#deviceSeg .on'), mode = $('#modeBtn');
    return [(on && on.textContent.trim()) || d.getAttribute('data-device') || '', mode ? mode.textContent.trim() : ''].filter(Boolean).join(', ');
  }
  function context() {
    return {
      page: (location.pathname + location.hash).slice(0, 500),
      where: where(),
      env: {
        browser: browserName(),
        platform: osName(),
        screen: screen.width + '×' + screen.height + (devicePixelRatio > 1 ? ' @' + Math.round(devicePixelRatio * 10) / 10 + 'x' : ''),
        window: innerWidth + '×' + innerHeight,
        touch: navigator.maxTouchPoints > 0,
        language: navigator.language || '',
        preview: preview()
      },
      errors: errors.slice()
    };
  }

  /* screenshots are shrunk to at most 1600 pixels wide before sending */
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var scale = Math.min(1, 1600 / img.naturalWidth), q = 0.85, out;
        for (var i = 0; i < 4; i++) {
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.naturalWidth * scale));
          c.height = Math.max(1, Math.round(img.naturalHeight * scale));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          if (out.length <= MAX_SHOT) return resolve(out);
          scale *= 0.75; q = 0.75;
        }
        reject(new Error('That image is too large. Try a smaller screenshot.'));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That image could not be opened.')); };
      img.src = url;
    });
  }

  var box = null, shot = null, lastFocus = null, busy = false;
  function build() {
    box = document.createElement('div');
    box.className = 'rp-bg';
    box.hidden = true;
    box.innerHTML =
      '<form class="rp" role="dialog" aria-modal="true" aria-labelledby="rpTitle" novalidate>' +
      '<div class="rp-h"><h2 id="rpTitle">' + ic('flag', 18) + ' Report a problem</h2><button type="button" class="rp-x" data-rpclose aria-label="Close">' + ic('x', 18) + '</button></div>' +
      '<div class="rp-body">' +
      '<label class="rp-f"><span>What happened?</span><textarea name="what" rows="5" maxlength="5000" required placeholder="What were you doing, and what went wrong? For example: I clicked Save and nothing happened."></textarea></label>' +
      '<label class="rp-f"><span>Your email <small>(optional, so we can let you know when it’s fixed)</small></span><input name="email" type="email" maxlength="254" autocomplete="email" placeholder="you@example.com"></label>' +
      '<div class="rp-f"><span>Screenshot <small>(optional)</small></span><div class="rp-shot" tabindex="0" role="button" aria-label="Add a screenshot"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><div class="rp-shot-in">' + ic('img', 20) + '<b>Add a screenshot</b><small>Choose a picture, drag one here, or paste with Ctrl+V</small></div></div></div>' +
      '<details class="rp-ctx"><summary>Also sent with your report</summary><ul></ul></details>' +
      '<label aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden">Leave this empty <input type="text" name="company_url" tabindex="-1" autocomplete="off"></label>' +
      '<p class="rp-err" role="alert" hidden></p>' +
      '</div>' +
      '<div class="rp-f2"><button type="button" class="rp-btn" data-rpclose>Cancel</button><button type="submit" class="rp-btn pri">Send report</button></div>' +
      '</form>';
    document.body.appendChild(box);
    var form = $('form', box), pick = $('.rp-shot', box), file = $('input[type=file]', box);
    box.addEventListener('mousedown', function (e) { if (e.target === box) close(); });
    box.addEventListener('click', function (e) {
      var t = e.target;
      if (t.closest('[data-rpclose]')) { close(); return; }
      if (t.closest('[data-rpdrop]')) { e.stopPropagation(); setShot(null); return; }
      if (t.closest('.rp-shot') && !shot) file.click();
    });
    pick.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !shot) { e.preventDefault(); file.click(); } });
    file.addEventListener('change', function () { if (file.files[0]) addShot(file.files[0]); file.value = ''; });
    pick.addEventListener('dragover', function (e) { e.preventDefault(); pick.classList.add('over'); });
    pick.addEventListener('dragleave', function () { pick.classList.remove('over'); });
    pick.addEventListener('drop', function (e) { e.preventDefault(); pick.classList.remove('over'); var f = e.dataTransfer.files[0]; if (f) addShot(f); });
    box.addEventListener('paste', function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) if (items[i].type.indexOf('image/') === 0) { e.preventDefault(); addShot(items[i].getAsFile()); return; }
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') { // keep focus inside the form
        var f = form.querySelectorAll('textarea,input:not([type=file]):not([tabindex="-1"]),button,[tabindex="0"]'), a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); send(form); });
  }
  function error(msg) { var p = $('.rp-err', box); p.textContent = msg || ''; p.hidden = !msg; }
  function setShot(data) {
    shot = data;
    var pick = $('.rp-shot', box);
    pick.classList.toggle('has', !!data);
    pick.setAttribute('aria-label', data ? 'Screenshot added' : 'Add a screenshot');
    $('.rp-shot-in', pick).innerHTML = data
      ? '<img src="' + data + '" alt="Your screenshot"><button type="button" class="rp-btn sm" data-rpdrop>Remove</button>'
      : ic('img', 20) + '<b>Add a screenshot</b><small>Choose a picture, drag one here, or paste with Ctrl+V</small>';
  }
  function addShot(f) { error(''); shrink(f).then(setShot, function (err) { error(err.message); }); }
  function fillContext() {
    var c = context(), e = c.env, rows = [
      ['Page', c.page || '/'],
      ['Browser', e.browser + (e.platform ? ' on ' + e.platform : '')],
      ['Screen', e.screen + ', window ' + e.window + (e.touch ? ', touch screen' : '')],
      e.preview ? ['Studio preview', e.preview] : null,
      ['Recent errors', c.errors.length ? c.errors.length + ' noted on this page' : 'None noted']
    ].filter(Boolean);
    $('.rp-ctx ul', box).innerHTML = rows.map(function (r) { return '<li><b>' + esc(r[0]) + ':</b> ' + esc(r[1]) + '</li>'; }).join('');
  }
  function open() {
    if (!box) build();
    lastFocus = document.activeElement;
    var form = $('form', box);
    if (form.classList.contains('done')) reset();
    fillContext();
    error('');
    box.hidden = false;
    document.body.classList.add('report-open');
    requestAnimationFrame(function () { box.classList.add('in'); $('textarea', box).focus(); });
  }
  function close() {
    if (!box || box.hidden) return;
    box.classList.remove('in');
    document.body.classList.remove('report-open');
    box.hidden = true;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }
  function reset() { box.remove(); box = null; shot = null; build(); }
  function keepCopy(rec) {
    try {
      var all = JSON.parse(localStorage.getItem('twp.reports') || '[]');
      all.push(rec);
      localStorage.setItem('twp.reports', JSON.stringify(all.slice(-20)));
    } catch (e) {}
  }
  function send(form) {
    if (busy) return;
    var what = form.what.value.trim(), email = form.email.value.trim();
    if (!what) { error('Please tell us what happened.'); form.what.focus(); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { error('That email address doesn’t look right.'); form.email.focus(); return; }
    error('');
    var c = context(), btn = $('button[type=submit]', form);
    var report = { what: what, email: email, page: c.page, where: c.where, env: c.env, errors: c.errors, screenshot: shot };
    var hp = form.company_url.value.trim();
    if (hp) report.hp = hp;
    busy = true; btn.disabled = true; btn.textContent = 'Sending…';
    var go = window.TWP && TWP.fetch ? TWP.fetch : fetch;
    go('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ report: report }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.d.error || (res.status === 429 ? 'You’ve sent several reports already. Please wait a while and try again.' : 'Your report didn’t send. Please try again.'));
        var ref = String(res.d.id || '').slice(0, 8).toUpperCase();
        keepCopy({ id: res.d.id, ref: ref, at: new Date().toISOString(), what: what.slice(0, 500), email: email, page: c.page, env: c.env, errors: c.errors.length, screenshot: !!shot });
        form.classList.add('done');
        $('.rp-body', form).innerHTML = '<div class="rp-thanks">' + ic('check', 28) + '<h3>Thanks, we got it</h3><p>' + (email ? 'We’ll email ' + esc(email) + ' when it’s fixed.' : 'We’ll look into it.') + (ref ? ' Your reference is <b>' + esc(ref) + '</b>.' : '') + '</p></div>';
        $('.rp-f2', form).innerHTML = '<button type="button" class="rp-btn pri" data-rpclose>Close</button>';
        $('.rp-f2 button', form).focus();
      })
      .catch(function (err) {
        error(err && err.code === 'challenge_failed' || err && err.code === 'challenge_unavailable' ? err.message : (err && err.message && !/fetch|network/i.test(err.message) ? err.message : 'Your report didn’t send. Check your connection and try again.'));
      })
      .then(function () { busy = false; if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Send report'; } });
  }

  document.addEventListener('click', function (e) {
    var t = e.target instanceof Element ? e.target.closest('[data-report]') : null;
    if (!t) return;
    e.preventDefault();
    if (window.TWPHelp) TWPHelp.close();
    open();
  });
  window.TWP_REPORT = { open: open, close: close, context: context };
})();
