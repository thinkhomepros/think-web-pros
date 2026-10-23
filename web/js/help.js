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
    chev: '<path d="m9 6 6 6-6 6"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'
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
      '<div class="hp-acts"><button type="button" class="hp-act pri" data-tourstart>' + ic('play', 16) + ' Take the tour</button><button type="button" class="hp-act" data-report>' + ic('flag', 16) + ' Report a problem</button></div>' +
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

  /* ---------- tutorial: dims the studio and spotlights the real controls one at a time ---------- */
  var OPEN_TOUR = null;
  var tap = function () { return device() === 'pc' ? 'Click' : 'Tap'; };
  var side = function () { return document.body.classList.contains('dock-side'); };
  /* each step points at real studio elements; the first visible match wins, none means a centered card */
  var STEPS = [
    { title: 'Welcome to your design studio', bang: true,
      text: function () { return 'Here is a quick tour of where everything is. It takes about a minute, and you can skip it anytime.'; } },
    { at: ['#site .es-card.kit-start', '#site .sec h1', '#site h1', '#canvas'], title: 'This is your website',
      text: function () {
        var pick = !!$('#site .es-card.kit-start');
        return 'Everything here is your real page. ' + tap() + ' any words to type over them, or a photo spot to add your own.' + (pick ? ' Start by picking your type of business, then a layout.' : '');
      } },
    { at: ['#tglInsp'], title: 'The Design panel',
      text: function () {
        var d = device(), where = side() ? 'docks on the right' : d === 'ph' ? 'slides up from the bottom' : 'opens along the bottom';
        return (d === 'ph' ? 'Tap the palette' : tap() + ' Design') + ' for your business info, logo, styles, colors and fonts. It ' + where + ' so your page stays in view.' +
          (d === 'pc' ? '' : ' Swipe sideways to move between its cards.');
      } },
    { at: ['#tglLib'], dev: ['pc', 'tab'], title: 'Sections',
      text: function () { return 'Add new parts to your page, like a menu, reviews or a map, and drag them into order. ' + tap() + ' a section\'s name tag on the page to move, hide or delete it.'; } },
    { at: ['#obMore'], dev: ['ph'], title: 'More',
      text: function () { return 'Sections, Redo, preview sizes, the dark version and saving options are tucked in here.'; } },
    { at: ['#obPage'], title: 'Pages and your menu',
      text: function () { return 'Switch pages, add a page, or open Pages & menu to rename and reorder them and pick a menu style.'; } },
    { at: ['#deviceSeg', '#obMore'], dev: ['pc', 'tab'], title: 'See it on every screen',
      text: function () { return $('#deviceSeg') && $('#deviceSeg').offsetParent ? 'Preview your site as a computer, tablet or phone while you keep editing.' : 'Preview your site as a computer, tablet or phone from here, along with saving options.'; } },
    { at: ['.prevbar .hist-grp'], title: 'Undo and save',
      text: function () { return 'Made a mistake? Undo it. Save keeps your design in My designs, and a pink dot means there are unsaved changes.'; } },
    { at: ['.prevbar .next-btn'], title: 'Launch when you love it',
      text: function () { return 'Designing is free. When you are ready, this takes you to plans and services like booking or an online store.'; } },
    { at: ['#helpBtn', '#obApp'], title: 'Help is always here', bang: true,
      text: function () {
        var b = $('#helpBtn');
        return (b && b.offsetParent ? 'Search tips for anything, or replay this tour, from Help. You can also press ? anytime.' : 'Help & tutorial lives in this main menu. Search tips for anything, or replay this tour.') + ' Have fun building your site!';
      } }
  ];
  function steps() { var d = device(); return STEPS.filter(function (s) { return !s.dev || s.dev.indexOf(d) > -1; }); }
  function visible(el) {
    if (!el || !el.getClientRects().length) return false;
    var r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  }
  function findTarget(s) {
    if (!s.at) return null;
    for (var i = 0; i < s.at.length; i++) {
      var el = $(s.at[i]);
      if (el && el.getClientRects().length) {
        if (el.closest('#canvas') && !visible(el)) el.scrollIntoView({ block: 'center' });
        if (visible(el)) return el;
      }
    }
    return null;
  }
  function tourHtml(i, list) {
    var s = list[i], n = list.length, last = i === n - 1;
    return '<div class="ct-top"><span class="ct-step">' + (i + 1) + ' of ' + n + '</span><button type="button" class="ct-skip" data-tourskip>Skip tour</button></div>' +
      '<h2 id="ctT">' + esc(s.title) + (s.bang ? '<span class="ct-bang">!</span>' : '') + '</h2>' +
      '<p id="ctP">' + esc(s.text()) + '</p>' +
      '<div class="ct-bar" aria-hidden="true"><i style="width:' + Math.round((i + 1) / n * 100) + '%"></i></div>' +
      '<div class="ct-foot">' +
        '<label class="ct-never"><input type="checkbox" id="twNever"' + (OPEN_TOUR.never ? ' checked' : '') + '> Don\'t show this again</label>' +
        '<div class="ct-nav">' + (i ? '<button type="button" class="ct-btn" data-tourgo="' + (i - 1) + '" aria-label="Back">' + ic('left', 16) + '</button>' : '') +
        '<button type="button" class="ct-btn pri" ' + (last ? 'data-tourdone' : 'data-tourgo="' + (i + 1) + '"') + '>' + (last ? 'Start designing' : i ? 'Next' : 'Show me around') + ' ' + ic('chev', 16) + '</button></div>' +
      '</div>';
  }
  /* put the spotlight on the target and the card next to it, kept on screen */
  function place() {
    var t = OPEN_TOUR;
    if (!t) return;
    var hole = t.hole, tip = t.tip, el = t.target, vw = innerWidth, vh = innerHeight, gap = 12, pad = 6;
    var narrow = vw <= 600, tw = Math.min(narrow ? vw - 24 : 380, vw - 24);
    tip.style.width = tw + 'px';
    var th = tip.offsetHeight;
    if (!el || !visible(el)) {
      hole.classList.add('none');
      hole.style.cssText = 'left:' + vw / 2 + 'px;top:' + vh / 2 + 'px;width:0;height:0';
      tip.style.left = Math.round((vw - tw) / 2) + 'px';
      tip.style.top = Math.round(narrow ? vh - th - 16 : (vh - th) / 2) + 'px';
      tip.removeAttribute('data-side');
      return;
    }
    hole.classList.remove('none');
    var r = el.getBoundingClientRect();
    var x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
    var w = Math.min(vw - 4, r.right + pad) - x, h = Math.min(vh - 4, r.bottom + pad) - y;
    hole.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';
    var left, top, sideName;
    if (y + h + gap + th <= vh - 8) { top = y + h + gap; sideName = 'below'; }
    else if (y - gap - th >= 8) { top = y - gap - th; sideName = 'above'; }
    else { top = vh - th - 12; sideName = 'over'; }
    left = narrow ? 12 : Math.max(12, Math.min(x + w / 2 - tw / 2, vw - tw - 12));
    tip.style.left = Math.round(left) + 'px';
    tip.style.top = Math.round(top) + 'px';
    tip.setAttribute('data-side', sideName);
    /* the little pointer lines up with the middle of the target */
    tip.style.setProperty('--ax', Math.round(Math.max(18, Math.min(x + w / 2 - left, tw - 18))) + 'px');
  }
  function showStep(i) {
    if (!OPEN_TOUR) return;
    var list = steps();
    OPEN_TOUR.i = Math.max(0, Math.min(list.length - 1, i));
    OPEN_TOUR.target = findTarget(list[OPEN_TOUR.i]);
    OPEN_TOUR.tip.innerHTML = tourHtml(OPEN_TOUR.i, list);
    place();
    var next = OPEN_TOUR.tip.querySelector('.ct-btn.pri');
    if (next) next.focus({ preventScroll: true });
  }
  function onMove() { if (OPEN_TOUR && !OPEN_TOUR.raf) OPEN_TOUR.raf = requestAnimationFrame(function () { if (OPEN_TOUR) { OPEN_TOUR.raf = 0; place(); } }); }
  function onResize() {
    /* a rotate or resize can swap which controls are showing, so pick the target again */
    if (!OPEN_TOUR) return;
    clearTimeout(OPEN_TOUR.rt);
    OPEN_TOUR.rt = setTimeout(function () { if (OPEN_TOUR) showStep(Math.min(OPEN_TOUR.i, steps().length - 1)); }, 150);
  }
  function openTour(auto) {
    if (OPEN_TOUR || !inStudio()) return;
    closeHelp();
    /* close open menus so they don't sit on top of the tour */
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    var el = document.createElement('div');
    el.className = 'ct';
    el.innerHTML = '<div class="ct-block"></div><div class="ct-hole none"></div><div class="ct-tip" role="dialog" aria-modal="true" aria-labelledby="ctT" aria-describedby="ctP"></div>';
    document.body.appendChild(el);
    OPEN_TOUR = { el: el, hole: el.querySelector('.ct-hole'), tip: el.querySelector('.ct-tip'), i: 0, auto: auto, never: false, focus: document.activeElement };
    document.body.classList.add('tour-open');
    showStep(0);
    requestAnimationFrame(function () { el.classList.add('in'); });
    addEventListener('scroll', onMove, true);
    addEventListener('resize', onResize);
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
    removeEventListener('scroll', onMove, true);
    removeEventListener('resize', onResize);
    t.el.classList.remove('in');
    document.body.classList.remove('tour-open');
    setTimeout(function () { t.el.remove(); }, 220);
    if (t.focus && t.focus.focus) try { t.focus.focus(); } catch (e) {}
  }
  function maybeAutoTour() {
    if (OPEN_TOUR || !inStudio()) return;
    if (store.get('tour') === 'off' || session.get('tourseen')) return;
    if (/[?&]tour=0\b/.test(location.search)) return;
    // someone who came from a pay link or back from checkout is here to pay, not to tour
    if (window.TWP && window.TWP.payScreen) return;
    session.set('tourseen', '1');
    setTimeout(function () { if (inStudio()) openTour(true); }, 600);
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
        var f = OPEN_TOUR.tip.querySelectorAll('button,input'), a = f[0], z = f[f.length - 1];
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
