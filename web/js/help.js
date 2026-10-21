/* Think Web Pros Studio: Help panel (searchable articles) and the first-time tutorial.
   Content lives in help-content.js. This file only touches the DOM, so it stays independent of app.js. */
(function () {
  'use strict';
  var H = window.TWP_HELP;
  if (!H) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ICON = {
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17v.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>'
  };
  var ic = function (n, s) { return '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>'; };

  /* which set of instructions and screenshots fits this screen */
  var device = function () { return innerWidth <= 600 ? 'ph' : innerWidth <= 1020 ? 'tab' : 'pc'; };
  var inStudio = function () { var v = $('#v-builder'); return !!v && !v.hidden; };

  /* remembered choices: localStorage first, a cookie as a backup for browsers that clear one but not the other */
  var store = {
    get: function (k) {
      try { var v = localStorage.getItem('twp.' + k); if (v != null) return v; } catch (e) {}
      var m = document.cookie.match(new RegExp('(?:^|; )twp_' + k + '=([^;]*)'));
      return m ? decodeURIComponent(m[1]) : null;
    },
    set: function (k, v) {
      try { localStorage.setItem('twp.' + k, v); } catch (e) {}
      try { document.cookie = 'twp_' + k + '=' + encodeURIComponent(v) + ';max-age=157680000;path=/;SameSite=Lax'; } catch (e) {}
    }
  };
  var session = {
    get: function (k) { try { return sessionStorage.getItem('twp.' + k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem('twp.' + k, v); } catch (e) {} }
  };

  /* ---------- Help panel ---------- */
  var panel = null, lastFocus = null;
  function articleHtml(a, open) {
    return '<details class="hp-a" data-hpid="' + a.id + '"' + (open ? ' open' : '') + '><summary>' + esc(a.title) + ic('chev', 14) + '</summary><div class="hp-body">' + a.body + '</div></details>';
  }
  function renderList(q) {
    var list = $('#hpList'), cat = panel.getAttribute('data-cat') || '';
    if (!list) return;
    var html = '';
    if (q) {
      var hits = H.search(q);
      html = hits.length
        ? '<p class="hp-count">' + hits.length + ' result' + (hits.length > 1 ? 's' : '') + '</p>' + hits.map(function (a, i) { return articleHtml(a, i === 0); }).join('')
        : '<div class="hp-empty"><b>No matches for "' + esc(q) + '"</b><p>Try fewer or different words, like <button type="button" data-hpq="logo">logo</button>, <button type="button" data-hpq="add page">add page</button> or <button type="button" data-hpq="colors">colors</button>.</p></div>';
    } else {
      H.cats.forEach(function (c) {
        if (cat && c[0] !== cat) return;
        var items = H.articles.filter(function (a) { return a.cat === c[0]; });
        html += '<h3 class="hp-cat">' + esc(c[1]) + '</h3>' + items.map(function (a) { return articleHtml(a, false); }).join('');
      });
    }
    list.innerHTML = html;
  }
  function buildPanel() {
    panel = document.createElement('aside');
    panel.id = 'helpPanel';
    panel.className = 'hp';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'hpTitle');
    panel.hidden = true;
    panel.innerHTML =
      '<div class="hp-h"><h2 id="hpTitle">' + ic('help', 18) + ' Help</h2><button type="button" class="hp-x" data-helpclose aria-label="Close help">' + ic('x', 18) + '</button></div>' +
      '<label class="hp-search">' + ic('search', 17) + '<input id="hpQ" type="search" placeholder="Search help: logo, colors, add page…" autocomplete="off" aria-label="Search help"></label>' +
      '<div class="hp-acts"><button type="button" class="hp-act pri" data-tourstart>' + ic('play', 16) + ' Take the tour</button><a class="hp-act" href="/guide" target="_blank" rel="noopener">' + ic('book', 16) + ' Full guide</a></div>' +
      '<div class="hp-chips" role="group" aria-label="Topics"><button type="button" class="on" data-hpcat="">All</button>' + H.cats.map(function (c) { return '<button type="button" data-hpcat="' + c[0] + '">' + esc(c[1].replace(/,.*| and .*/, '')) + '</button>'; }).join('') + '</div>' +
      '<div class="hp-list" id="hpList" data-dev="' + device() + '"></div>';
    document.body.appendChild(panel);
    var q = $('#hpQ', panel), t;
    q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { renderList(q.value.trim()); }, 120); });
  }
  function openHelp(query) {
    if (!panel) buildPanel();
    if (OPEN_TOUR) closeTour(false);
    lastFocus = document.activeElement;
    $('#hpList', panel).setAttribute('data-dev', device());
    panel.hidden = false;
    document.body.classList.add('help-open');
    var q = $('#hpQ', panel);
    if (query != null) q.value = query;
    renderList(q.value.trim());
    requestAnimationFrame(function () { panel.classList.add('in'); if (device() !== 'ph') q.focus(); });
  }
  function closeHelp() {
    if (!panel || panel.hidden) return;
    panel.classList.remove('in');
    document.body.classList.remove('help-open');
    setTimeout(function () { panel.hidden = true; }, 180);
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }

  /* ---------- tutorial ---------- */
  var OPEN_TOUR = null;
  function tourHtml(i) {
    var s = H.tour[i], d = device(), n = H.tour.length, last = i === n - 1;
    return '<div class="tw-card" role="dialog" aria-modal="true" aria-labelledby="twT" aria-describedby="twP">' +
      '<div class="tw-shot tw-' + d + '"><img src="/img/guide/' + d + '-' + s.img + '.webp" alt="" decoding="async"></div>' +
      '<div class="tw-body">' +
        '<div class="tw-top"><span class="tw-step">Step ' + (i + 1) + ' of ' + n + '</span><button type="button" class="tw-skip" data-tourskip>Skip</button></div>' +
        '<h2 id="twT">' + esc(s.title) + (last ? '<span class="tw-bang">!</span>' : '') + '</h2>' +
        '<p id="twP">' + esc(s.text[d]) + '</p>' +
        '<div class="tw-dots" role="group" aria-label="Steps">' + H.tour.map(function (x, j) { return '<button type="button" data-tourgo="' + j + '" class="' + (j === i ? 'on' : '') + '" aria-label="Step ' + (j + 1) + ': ' + esc(x.title) + '"' + (j === i ? ' aria-current="step"' : '') + '></button>'; }).join('') + '</div>' +
        '<div class="tw-foot">' +
          '<label class="tw-never"><input type="checkbox" id="twNever"' + (OPEN_TOUR && OPEN_TOUR.never ? ' checked' : '') + '> Don\'t show this again</label>' +
          '<div class="tw-nav">' + (i ? '<button type="button" class="tw-btn" data-tourgo="' + (i - 1) + '" aria-label="Back">' + ic('left', 16) + '</button>' : '') +
          '<button type="button" class="tw-btn pri" ' + (last ? 'data-tourdone' : 'data-tourgo="' + (i + 1) + '"') + '>' + (last ? 'Start designing' : 'Next') + ' ' + ic('chev', 16) + '</button></div>' +
        '</div>' +
      '</div></div>';
  }
  function showStep(i) {
    if (!OPEN_TOUR) return;
    OPEN_TOUR.i = Math.max(0, Math.min(H.tour.length - 1, i));
    OPEN_TOUR.el.innerHTML = tourHtml(OPEN_TOUR.i);
    var next = OPEN_TOUR.el.querySelector('.tw-btn.pri');
    if (next) next.focus({ preventScroll: true });
    /* warm the next screenshot so Next feels instant */
    var s = H.tour[OPEN_TOUR.i + 1];
    if (s) { var im = new Image(); im.src = '/img/guide/' + device() + '-' + s.img + '.webp'; }
  }
  function openTour(auto) {
    if (OPEN_TOUR) return;
    closeHelp();
    var el = document.createElement('div');
    el.className = 'tw-bg';
    document.body.appendChild(el);
    OPEN_TOUR = { el: el, i: 0, auto: auto, never: false, focus: document.activeElement };
    document.body.classList.add('tour-open');
    showStep(0);
    requestAnimationFrame(function () { el.classList.add('in'); });
    /* the tour covers what the one-line tip says, so the tip steps aside */
    var tip = $('[data-coachoff]'); if (tip && auto && tip.offsetParent) tip.click();
  }
  /* finished: the tour won't open by itself again. skipped: hidden for this visit, and after two skipped visits it stops asking */
  function closeTour(finished) {
    if (!OPEN_TOUR) return;
    var t = OPEN_TOUR, never = t.never || finished;
    OPEN_TOUR = null;
    if (never) store.set('tour', 'off');
    else if (t.auto) {
      var n = (+store.get('tourskips') || 0) + 1;
      store.set('tourskips', String(n));
      if (n >= 2) store.set('tour', 'off');
    }
    session.set('tourseen', '1');
    t.el.classList.remove('in');
    document.body.classList.remove('tour-open');
    setTimeout(function () { t.el.remove(); }, 200);
    if (t.focus && t.focus.focus) try { t.focus.focus(); } catch (e) {}
  }
  function maybeAutoTour() {
    if (OPEN_TOUR || !inStudio()) return;
    if (store.get('tour') === 'off' || session.get('tourseen')) return;
    if (/[?&]tour=0\b/.test(location.search)) return;
    session.set('tourseen', '1');
    setTimeout(function () { if (inStudio()) openTour(true); }, 450);
  }

  /* ---------- wiring ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target instanceof Element ? e.target : null, el;
    if (!t) return;
    if ((el = t.closest('[data-helpopen]'))) { e.preventDefault(); if (panel && !panel.hidden && el.id === 'helpBtn') closeHelp(); else openHelp(); return; }
    if (t.closest('[data-helpclose]')) { closeHelp(); return; }
    if (t.closest('[data-tourstart]')) { openTour(false); return; }
    if ((el = t.closest('[data-hpcat]'))) {
      panel.setAttribute('data-cat', el.getAttribute('data-hpcat'));
      Array.prototype.forEach.call(panel.querySelectorAll('[data-hpcat]'), function (b) { b.classList.toggle('on', b === el); });
      $('#hpQ', panel).value = ''; renderList(''); $('#hpList', panel).scrollTop = 0; return;
    }
    if ((el = t.closest('[data-hpq]'))) { var q = $('#hpQ', panel); q.value = el.getAttribute('data-hpq'); renderList(q.value); return; }
    if (OPEN_TOUR) {
      if ((el = t.closest('[data-tourgo]'))) { showStep(+el.getAttribute('data-tourgo')); return; }
      if (t.closest('[data-tourdone]')) { closeTour(true); return; }
      if (t.closest('[data-tourskip]')) { closeTour(false); return; }
      if (t === OPEN_TOUR.el) { closeTour(false); return; }
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'twNever' && OPEN_TOUR) OPEN_TOUR.never = e.target.checked;
  });
  document.addEventListener('keydown', function (e) {
    if (OPEN_TOUR) {
      if (e.key === 'Escape') { e.stopPropagation(); closeTour(false); }
      else if (e.key === 'ArrowRight' && !(e.target instanceof HTMLInputElement)) showStep(OPEN_TOUR.i + 1);
      else if (e.key === 'ArrowLeft' && !(e.target instanceof HTMLInputElement)) showStep(OPEN_TOUR.i - 1);
      else if (e.key === 'Tab') {
        /* keep keyboard focus inside the tutorial */
        var f = OPEN_TOUR.el.querySelectorAll('button,input'), a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
      return;
    }
    if (e.key === 'Escape' && panel && !panel.hidden) { closeHelp(); return; }
    var typing = e.target instanceof Element && e.target.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""]');
    if (e.key === '?' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); if (panel && !panel.hidden) closeHelp(); else openHelp(); }
  }, true);

  /* open the tour when someone first lands in the designer; app.js switches views by un-hiding #v-builder */
  function watch() {
    var v = $('#v-builder');
    if (!v) return;
    new MutationObserver(function () { if (!v.hidden) maybeAutoTour(); }).observe(v, { attributes: true, attributeFilter: ['hidden'] });
    maybeAutoTour();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();

  window.TWPHelp = { open: openHelp, close: closeHelp, tour: function () { openTour(false); } };
})();
