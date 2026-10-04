/* ════════════════════════════════════════════════════════════════════
   Housing (tabHousing) — pick a university and the day you move in; the
   page works out the rest from housing_data.js (researched per country):

     • snapshot: how hard the market is, typical rent, deposit rule, countdown
     • your plan: every step dated back from your move-in day, with what to
       do now and what to do instead if a deadline has passed
     • where you could live: halls / private halls / shared rooms / studios,
       with real price ranges for the city and "on time · tight · late"
     • find rooms for your dates: live searches on trusted platforms with your
       dates filled in — marked by how safe their payment is
     • neighbourhoods, the deposit law, documents, your rights
     • scam check: paste a listing → /api/housing/scam-check (rules + model)

   We never show listings we can't verify; "offers" are live searches on the
   platforms themselves. Motion is transform/opacity; the 3D house pauses
   off-screen and honours prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var root = document.getElementById('tabHousing'), HD = window.HousingData;
    if (!root || !HD) return;
    var $ = function (id) { return document.getElementById(id); };
    var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var UID = (window.user && window.user.id) || 'guest', KEY = 'us_housing_' + UID;
    var CODES = ['gb', 'us', 'ch', 'nl', 'se', 'de', 'fr', 'it', 'es', 'ie', 'dk', 'fi', 'be', 'pt', 'ua'];
    var API = (function () { if (location.protocol === 'file:') return 'http://localhost:4242'; return (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== '4242') ? 'http://localhost:4242' : location.origin; }());
    var PICKS = [['gb', 'ucl'], ['nl', 'tud'], ['de', 'tum'], ['es', 'ucm'], ['fr', 'sorbonne'], ['it', 'bocconi'], ['pt', 'ulisboa'], ['ie', 'tcd']];
    var KIND = { protected: ['fa-shield-halved', 'Payment protected', 'Your money is held until you move in'], official: ['fa-building-columns', 'Official', 'University, public or the provider itself'],
        moderated: ['fa-user-check', 'Moderated', 'Vetted listings — you pay the landlord'], open: ['fa-triangle-exclamation', 'Open marketplace', 'Most scams start here — be careful'] };
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function lsGet() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
    function lsSet(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function addMonths(d, m) { var x = new Date(d); x.setMonth(x.getMonth() + m); return x; }
    function fmt(d, y) { return d.getDate() + ' ' + MONTHS[d.getMonth()] + (y ? ' ' + d.getFullYear() : ''); }
    function today0() { var t = new Date(); t.setHours(0, 0, 0, 0); return t; }
    function daysTo(d) { return Math.round((d - today0()) / 864e5); }
    function num(v) { var step = v >= 2000 ? 100 : 10; return (Math.round(v / step) * step).toLocaleString('en-GB'); }
    function money(v, cur) { return cur === 'kr' ? num(v) + ' kr' : cur === 'CHF' ? 'CHF ' + num(v) : cur + num(v); }
    function range(r, cur) { var a = num(r[0]), b = num(r[1]); return cur === 'kr' ? a + '–' + b + ' kr' : cur === 'CHF' ? 'CHF ' + a + '–' + b : cur + a + '–' + b; }

    /* ── universities: every country, from data/<cc>.json ───────────── */
    var unis = [], ready = null, meta = {}, cities = {};
    function load() {
        if (ready) return ready;
        ready = Promise.all(CODES.map(function (cc) {
            return fetch('data/' + cc + '.json').then(function (r) { return r.json(); }).then(function (d) {
                meta[cc] = d.meta || {}; cities[cc] = d.cities || {};
                (d.universities || []).forEach(function (u) { unis.push({ cc: cc, id: u.id, name: u.name, abbr: u.abbr, city: u.city, color: u.color, website: u.website, diff: u.diff, country: (d.meta && d.meta.name) || cc }); });
            }).catch(function () {});
        })).then(function () { return unis; });
        return ready;
    }
    function find(cc, id) { return unis.find(function (u) { return u.cc === cc && u.id === id; }) || null; }
    function logo(u, size) { return typeof uniLogo === 'function' ? uniLogo(u, size) : '<span class="hs-mono" style="background:' + esc(u.color || '#0f8f7e') + '">' + esc((u.abbr || u.name).slice(0, 2)) + '</span>'; }
    function hydrate(el) { if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(el); }

    /* ── rent for the city ─────────────────────────────────────────── */
    function rents(u) {
        var c = HD.countries[u.cc], cg = (typeof CG2_DATA !== 'undefined' && u.cc !== 'ua' && CG2_DATA[u.city]) || null, cr = HD.cityRent[u.city];
        var room, studio, src = 'city';
        if (cr) { room = cr.room; studio = cr.studio; }
        else if (cg && cg.accCosts) { var a = cg.accCosts; room = [a.shared * .88, a.shared * 1.12]; studio = [a.studio * .88, a.studio * 1.12]; }
        else {   // the country's typical city
            var vals = Object.keys(cities[u.cc] || {}).map(function (n) { return (HD.cityRent[n]) || (typeof CG2_DATA !== 'undefined' && CG2_DATA[n] && CG2_DATA[n].accCosts && { room: [CG2_DATA[n].accCosts.shared * .88, CG2_DATA[n].accCosts.shared * 1.12], studio: [CG2_DATA[n].accCosts.studio * .88, CG2_DATA[n].accCosts.studio * 1.12] }); }).filter(Boolean);
            if (u.cc === 'ua') vals = [{ room: [5000, 9000], studio: [9000, 17000] }];
            if (!vals.length) return null;
            room = [Math.min.apply(null, vals.map(function (v) { return v.room[0]; })), Math.max.apply(null, vals.map(function (v) { return v.room[1]; }))];
            studio = [Math.min.apply(null, vals.map(function (v) { return v.studio[0]; })), Math.max.apply(null, vals.map(function (v) { return v.studio[1]; }))];
            src = 'country';
        }
        return { room: room, studio: studio, pbsa: [room[1], Math.max(room[1] * 1.15, studio[1])], dorm: c.dorm, src: src, hoods: cg && cg.neighbourhoods || [] };
    }

    /* ── state ─────────────────────────────────────────────────────── */
    var st = lsGet();
    function defaultIn() { var t = today0(), y = t.getMonth() >= 6 ? t.getFullYear() + 1 : t.getFullYear(); return iso(new Date(y, 8, 1)); }
    if (!st.in || parse(st.in) < today0()) st.in = defaultIn();
    if (!st.stay) st.stay = 10;
    function dates() { var a = parse(st.in), b = addMonths(a, st.stay); b.setDate(b.getDate() - 1); return { a: a, b: b, in: iso(a), out: iso(b) }; }

    /* ── hero: search, dates, picks ────────────────────────────────── */
    var input = $('hsSearch'), list = $('hsSuggest');
    function suggest() {
        var q = input.value.trim().toLowerCase();
        if (!q) { list.hidden = true; input.setAttribute('aria-expanded', 'false'); return; }
        var hits = unis.filter(function (u) { return (u.name + ' ' + (u.abbr || '') + ' ' + (u.city || '')).toLowerCase().indexOf(q) !== -1; })
            .sort(function (a, b) { return (b.name.toLowerCase().indexOf(q) === 0) - (a.name.toLowerCase().indexOf(q) === 0) || (b.diff || 0) - (a.diff || 0); }).slice(0, 7);
        list.innerHTML = hits.length ? hits.map(function (u, i) { return '<li role="option" data-pick="' + u.cc + ':' + esc(u.id) + '" style="--k:' + i + '"><span class="hs-sug__logo">' + logo(u, 26) + '</span><span><b>' + esc(u.name) + '</b><small>' + esc(u.city + ' · ' + u.country) + '</small></span><i class="fa-solid fa-arrow-right"></i></li>'; }).join('') : '<li class="hs-sug__none">No university matches “' + esc(input.value) + '”.</li>';
        hydrate(list); list.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    input.addEventListener('input', function () { load().then(suggest); });
    input.addEventListener('focus', function () { load().then(suggest); });
    input.addEventListener('keydown', function (e) {
        var items = [].slice.call(list.querySelectorAll('[data-pick]')), cur = list.querySelector('.is-on'), i = items.indexOf(cur);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (cur) cur.classList.remove('is-on'); var n = items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]; if (n) n.classList.add('is-on'); }
        if (e.key === 'Enter') { e.preventDefault(); var t = cur || items[0]; if (t) choose(t.getAttribute('data-pick')); }
        if (e.key === 'Escape') { list.hidden = true; }
    });
    document.addEventListener('click', function (e) {
        var p = e.target.closest('[data-pick]'); if (p && root.contains(p)) { choose(p.getAttribute('data-pick')); return; }
        if (!e.target.closest('.hs-search')) list.hidden = true;
    });
    $('hsIn').value = st.in; $('hsIn').min = iso(today0());

    /* ── move-in calendar ─────────────────────────────────────────────
       A small dialog anchored to the "Move in" field. It lives on <body>
       (the hero clips its overflow) and repositions with the field.
       Shows the stay as a soft band, marks the common intake days and
       works from the keyboard: arrows, PageUp/Down, Home/End, Enter, Esc. */
    var CAL = { el: null, view: null, focus: null, dir: 0 };
    var WK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'], MONTHS_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    function calEl() {
        if (CAL.el) return CAL.el;
        var el = document.createElement('div'); el.className = 'hs-cal'; el.id = 'hsCal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Choose a move-in date'); el.hidden = true;
        document.body.appendChild(el);
        el.addEventListener('click', function (e) {
            var n = e.target.closest('[data-cal-nav]'); if (n) { calMove(+n.getAttribute('data-cal-nav')); return; }
            var d = e.target.closest('[data-d]'); if (d && !d.disabled) { calPick(d.getAttribute('data-d')); return; }
            var j = e.target.closest('[data-cal-jump]'); if (j) { CAL.focus = parse(j.getAttribute('data-cal-jump')); CAL.dir = CAL.focus > CAL.view ? 1 : -1; CAL.view = new Date(CAL.focus.getFullYear(), CAL.focus.getMonth(), 1); calRender(true); }
        });
        el.addEventListener('keydown', calKey);
        return (CAL.el = el);
    }
    function calOpen() {
        var el = calEl(), cur = parse(st.in);
        CAL.focus = cur; CAL.view = new Date(cur.getFullYear(), cur.getMonth(), 1); CAL.dir = 0;
        el.setAttribute('data-theme-cal', document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
        calRender(false); el.hidden = false; calPlace();
        requestAnimationFrame(function () { el.classList.add('is-open'); var f = el.querySelector('.hs-cal__d[tabindex="0"]'); if (f) f.focus({ preventScroll: true }); });
        $('hsInBtn').setAttribute('aria-expanded', 'true'); $('hsInBtn').classList.add('is-open');
    }
    function calClose(back) {
        if (!CAL.el || CAL.el.hidden) return;
        CAL.el.classList.remove('is-open'); $('hsInBtn').setAttribute('aria-expanded', 'false'); $('hsInBtn').classList.remove('is-open');
        var el = CAL.el; setTimeout(function () { if (!el.classList.contains('is-open')) el.hidden = true; }, REDUCED ? 0 : 260);
        if (back) $('hsInBtn').focus();
    }
    function calPlace() {
        var el = CAL.el; if (!el || el.hidden) return;
        var sheet = innerWidth < 560; el.classList.toggle('is-sheet', sheet);
        if (sheet) { el.style.left = '0px'; el.style.top = 'auto'; return; }   // phones: a bottom sheet
        var r = $('hsInBtn').getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
        var left = Math.max(12, Math.min(innerWidth - w - 12, r.left)), top = r.bottom + 8;
        if (top + h > innerHeight - 8 && r.top - h - 8 > 8) { top = r.top - h - 8; el.classList.add('is-up'); } else el.classList.remove('is-up');
        el.style.transform = ''; el.style.left = left + 'px'; el.style.top = top + 'px';
        el.style.setProperty('--ox', Math.max(18, Math.min(w - 18, r.left + 24 - left)) + 'px');
    }
    function calRender(anim) {
        var el = CAL.el, v = CAL.view, t = today0(), sel = parse(st.in), d = dates(), out = d.b;
        var first = new Date(v.getFullYear(), v.getMonth(), 1), lead = (first.getDay() + 6) % 7, start = new Date(first); start.setDate(1 - lead);
        var prevOk = new Date(v.getFullYear(), v.getMonth(), 0) >= t, cells = '';
        for (var i = 0; i < 42; i++) {
            var x = new Date(start); x.setDate(start.getDate() + i);
            var k = iso(x), inMonth = x.getMonth() === v.getMonth(), past = x < t, isSel = k === st.in, inRange = inMonth && x > sel && x <= out, end = k === iso(out);
            var intake = x.getDate() === 1 && (x.getMonth() === 8 || x.getMonth() === 1), foc = CAL.focus && k === iso(CAL.focus);
            var cls = 'hs-cal__d' + (inMonth ? '' : ' is-out') + (k === iso(t) ? ' is-today' : '') + (isSel ? ' is-sel' + ((i % 7) !== 6 ? ' is-rsel' : '') : '') + (inRange ? ' is-range' : '') + (end ? ' is-end' : '') + (intake ? ' is-intake' : '') +
                (inRange && ((i % 7) === 0 || x.getDate() === 1) ? ' is-rs' : '') + (inRange && ((i % 7) === 6 || end || new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1).getDate() === 1) ? ' is-re' : '');
            cells += '<button type="button" role="gridcell" class="' + cls + '" data-d="' + k + '" tabindex="' + (foc ? '0' : '-1') + '" aria-selected="' + isSel + '"' + (past ? ' disabled' : '') +
                ' aria-label="' + x.getDate() + ' ' + MONTHS_L[x.getMonth()] + ' ' + x.getFullYear() + (intake ? ', common intake' : '') + (isSel ? ', move-in' : '') + (end ? ', move-out' : '') + '"><span>' + x.getDate() + '</span></button>';
        }
        var intakes = [new Date(t.getMonth() >= 1 ? t.getFullYear() + 1 : t.getFullYear(), 1, 1), new Date(t.getMonth() >= 8 ? t.getFullYear() + 1 : t.getFullYear(), 8, 1)].sort(function (a, b) { return a - b; });
        el.innerHTML = '<div class="hs-cal__hd"><button type="button" class="hs-cal__nav" data-cal-nav="-1" aria-label="Previous month"' + (prevOk ? '' : ' disabled') + '><i class="fa-solid fa-chevron-left"></i></button>' +
            '<div class="hs-cal__ttl" aria-live="polite"><b>' + MONTHS_L[v.getMonth()] + '</b> ' + v.getFullYear() + '</div>' +
            '<button type="button" class="hs-cal__nav" data-cal-nav="1" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button></div>' +
            '<div class="hs-cal__wk" aria-hidden="true">' + WK.map(function (w, i) { return '<span' + (i > 4 ? ' class="is-we"' : '') + '>' + w + '</span>'; }).join('') + '</div>' +
            '<div class="hs-cal__grid' + (anim && !REDUCED ? ' is-slide' : '') + '" role="grid" style="--dir:' + (CAL.dir || 0) + '">' + cells + '</div>' +
            '<div class="hs-cal__ft"><span class="hs-cal__lg"><i></i> Common intake</span>' + intakes.map(function (x) { return '<button type="button" class="hs-cal__jump" data-cal-jump="' + iso(x) + '">' + MONTHS[x.getMonth()] + ' ' + x.getFullYear() + '</button>'; }).join('') + '</div>' +
            '<p class="hs-cal__stay"><i class="fa-solid fa-house-chimney"></i><span>' + fmt(sel, true) + ' → ' + fmt(out, true) + '<small>Your stay · ' + ({ 5: 'a semester', 10: 'an academic year', 12: '12 months' })[st.stay] + '</small></span></p>';
    }
    function calMove(m) {
        var v = new Date(CAL.view.getFullYear(), CAL.view.getMonth() + m, 1);
        if (m < 0 && new Date(v.getFullYear(), v.getMonth() + 1, 0) < today0()) return;
        CAL.dir = m; CAL.view = v;
        var f = new Date(CAL.focus); f.setMonth(f.getMonth() + m); if (f.getMonth() !== v.getMonth()) f = new Date(v.getFullYear(), v.getMonth() + 1, 0);
        CAL.focus = f < today0() ? today0() : f;
        calRender(true);
    }
    function calPick(k) {
        st.in = k; $('hsIn').value = k; lsSet(st); paintDates(); render(true);
        calRender(false);
        var s = CAL.el.querySelector('.is-sel'); if (s) s.classList.add('is-pop');
        setTimeout(function () { calClose(true); }, REDUCED ? 0 : 260);
    }
    function calKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); calClose(true); return; }
        if (e.key === 'Tab') { var f = [].slice.call(CAL.el.querySelectorAll('button:not([disabled])')).filter(function (b) { return b.tabIndex !== -1 || b.classList.contains('hs-cal__nav') || b.classList.contains('hs-cal__jump'); }); if (!f.length) return; var i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } return; }
        var cell = e.target.closest && e.target.closest('[data-d]'); if (!cell) return;
        var cur = parse(cell.getAttribute('data-d')), n = new Date(cur), map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (map[e.key] != null) n.setDate(n.getDate() + map[e.key]);
        else if (e.key === 'PageUp') n.setMonth(n.getMonth() - 1); else if (e.key === 'PageDown') n.setMonth(n.getMonth() + 1);
        else if (e.key === 'Home') n.setDate(n.getDate() - (n.getDay() + 6) % 7); else if (e.key === 'End') n.setDate(n.getDate() + (6 - (n.getDay() + 6) % 7));
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!cell.disabled) calPick(cell.getAttribute('data-d')); return; }
        else return;
        e.preventDefault();
        if (n < today0()) n = today0();
        CAL.focus = n;
        if (n.getMonth() !== CAL.view.getMonth() || n.getFullYear() !== CAL.view.getFullYear()) { CAL.dir = n > CAL.view ? 1 : -1; CAL.view = new Date(n.getFullYear(), n.getMonth(), 1); calRender(true); }
        else { CAL.el.querySelectorAll('[data-d]').forEach(function (b) { b.tabIndex = b.getAttribute('data-d') === iso(n) ? 0 : -1; }); }
        var t = CAL.el.querySelector('[data-d="' + iso(n) + '"]'); if (t) t.focus({ preventScroll: true });
    }
    $('hsInBtn').addEventListener('click', function () { if (CAL.el && !CAL.el.hidden && CAL.el.classList.contains('is-open')) calClose(false); else calOpen(); });
    $('hsInBtn').addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { e.preventDefault(); calOpen(); } });
    document.addEventListener('pointerdown', function (e) { if (CAL.el && !CAL.el.hidden && !CAL.el.contains(e.target) && !e.target.closest('#hsInBtn')) calClose(false); });
    var calRaf = 0;
    function calFollow() { if (!CAL.el || CAL.el.hidden) return; cancelAnimationFrame(calRaf); calRaf = requestAnimationFrame(function () { var r = $('hsInBtn').getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight || !$('hsInBtn').offsetParent) calClose(false); else calPlace(); }); }
    window.addEventListener('scroll', calFollow, { passive: true }); window.addEventListener('resize', calFollow);

    $('hsIn').addEventListener('change', function () { if (!this.value) return; st.in = this.value; lsSet(st); paintDates(); render(true); });
    $('hsStay').value = String(st.stay);
    $('hsStay').addEventListener('change', function () { st.stay = +this.value; lsSet(st); paintDates(); render(true); });
    root.addEventListener('click', function (e) {
        var q = e.target.closest('[data-in]'); if (q) { st.in = q.getAttribute('data-in'); $('hsIn').value = st.in; lsSet(st); paintDates(); render(true); }
    });
    function paintDates() {
        var d = dates(), n = daysTo(d.a);
        $('hsInTxt').textContent = fmt(d.a, true);
        $('hsDateNote').innerHTML = '<i class="fa-regular fa-calendar"></i> ' + fmt(d.a, true) + ' → ' + fmt(d.b, true) + ' · <b>' + (n <= 0 ? 'today' : n + ' days away') + '</b>';
        var t = today0(), y = t.getFullYear(), opts = [new Date(t.getMonth() >= 8 ? y + 1 : y, 8, 1), new Date(t.getMonth() >= 1 ? y + 1 : y, 1, 1), new Date(t.getMonth() >= 8 ? y + 2 : y + 1, 8, 1)].sort(function (a, b) { return a - b; });
        $('hsQuick').innerHTML = opts.map(function (o) { var v = iso(o); return '<button type="button" data-in="' + v + '" class="' + (v === st.in ? 'is-on' : '') + '">' + MONTHS[o.getMonth()] + ' ' + o.getFullYear() + '</button>'; }).join('');
    }
    function renderPicks() {
        load().then(function () {
            $('hsPicks').innerHTML = PICKS.map(function (p) { var u = find(p[0], p[1]); return u ? '<button type="button" class="hs-pick" data-pick="' + u.cc + ':' + esc(u.id) + '"><span>' + logo(u, 22) + '</span>' + esc(u.abbr && u.abbr.length <= 12 ? u.abbr : u.city) + '</button>' : ''; }).join('');
            hydrate($('hsPicks'));
            if (st.cc && st.id && find(st.cc, st.id)) render(false);
        });
    }
    function choose(key) {
        var p = key.split(':'), u = find(p[0], p.slice(1).join(':')); if (!u) return;
        st.cc = u.cc; st.id = u.id; lsSet(st); list.hidden = true; input.value = ''; input.blur();
        render(true);
        setTimeout(function () { var b = $('hsBody'); if (b && b.getBoundingClientRect().top > innerHeight * .7) b.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }, 120);
    }

    /* ── the 3D neighbourhood: houses and trees on a turning green ───── */
    var HUTS = [['#fffaf2', '#d8613c', 1.05], ['#e7f4ef', '#167e70', .85], ['#fff1e6', '#e08a3c', 1.2], ['#f1ecff', '#6b5bd6', .9], ['#fff7df', '#c0492e', 1.1], ['#eef6ff', '#2f6bdf', .8], ['#fdf0f3', '#cf4f78', 1], ['#f3f0e8', '#3d4a45', .95]];
    function hut(c, i) {
        var a = i * 45, face = function (side, wins) { return '<i class="hs-face hs-face--' + side + '">' + wins + '</i>'; };
        return '<div class="hs-hut" style="--a:' + a + 'deg;--s:' + c[2] + ';--wc:' + c[0] + ';--rc:' + c[1] + ';--k:' + i + '">' +
            '<i class="hs-shade"></i>' + face('front', '<span class="hs-door"></span><span class="hs-win hs-win--l"></span><span class="hs-win hs-win--r"></span>') +
            face('back', '<span class="hs-win hs-win--l"></span><span class="hs-win hs-win--r"></span>') + face('left', '<span class="hs-win hs-win--c"></span>') + face('right', '<span class="hs-win hs-win--c"></span>') +
            '<i class="hs-gable hs-gable--left"></i><i class="hs-gable hs-gable--right"></i><i class="hs-roof hs-roof--front"></i><i class="hs-roof hs-roof--back"></i></div>';
    }
    function tree(i) { return '<div class="hs-tree" style="--a:' + (i * 60 + 22) + 'deg;--s:' + (.8 + (i % 3) * .2) + '"><i></i><i></i></div>'; }
    $('hsRing').innerHTML = '<i class="hs-disc"></i>' + HUTS.map(hut).join('') + [0, 1, 2, 3, 4, 5].map(tree).join('');

    /* ── the chosen university hangs on a sign over the neighbourhood ── */
    function paintScene(u) {
        var s = $('hsSign');
        if (!u) { s.innerHTML = ''; $('hsScene').classList.remove('has-uni'); $('hsSceneCap').textContent = ''; return; }
        s.innerHTML = '<span class="hs-sign__logo">' + logo(u, 40) + '</span>'; hydrate(s);
        $('hsScene').classList.remove('has-uni'); void s.offsetWidth; $('hsScene').classList.add('has-uni');
        $('hsSceneCap').innerHTML = '<b>' + esc(u.name) + '</b><span>' + esc(u.city + ', ' + u.country) + '</span>';
    }

    /* ── body ──────────────────────────────────────────────────────── */
    function render(fresh) {
        var u = st.cc && st.id ? find(st.cc, st.id) : null;
        paintScene(u);
        var body = $('hsBody');
        if (!u) { body.innerHTML = '<div class="hs-empty"><i class="fa-solid fa-arrow-up"></i> Search for your university to see where students live, what it costs and when to apply.</div>'; return; }
        var c = HD.countries[u.cc], d = dates(), R = rents(u), monthsLeft = daysTo(d.a) / 30.44;
        body.innerHTML = snapshot(u, c, d, R) + plan(u, c, d) + routes(u, c, d, R, monthsLeft) + platforms(u, c, d) + hoods(u, c, R) + rules(c) + scam(u, c, R) + sources(c);
        hydrate(body);
        if (fresh) reveal();
        else body.querySelectorAll('.hs-rv').forEach(function (x) { x.classList.add('is-in'); });
    }
    function sec(id, icon, kicker, title, sub, inner, cls) {
        return '<section class="hs-sec hs-rv ' + (cls || '') + '" id="' + id + '"><header class="hs-sec__hd"><span class="hs-sec__ic"><i class="fa-solid ' + icon + '"></i></span><div><p class="hs-kicker">' + kicker + '</p><h3>' + title + '</h3>' + (sub ? '<p class="hs-sub">' + sub + '</p>' : '') + '</div></header>' + inner + '</section>';
    }
    function snapshot(u, c, d, R) {
        var n = daysTo(d.a), lvl = ['', 'Easy', 'Manageable', 'Takes effort', 'Tight', 'Very tight'][c.pressure];
        var bars = [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= c.pressure ? 'on' : '') + '" style="--i:' + i + '"></i>'; }).join('');
        return '<div class="hs-snap hs-rv">' +
            '<div class="hs-snap__t hs-snap__t--city"><span class="hs-snap__k">Your city</span><b>' + esc(u.city) + '</b><small>' + esc(u.country) + ' · for ' + esc(u.abbr || u.name) + '</small></div>' +
            '<div class="hs-snap__t"><span class="hs-snap__k">Finding a room</span><b>' + lvl + '</b><span class="hs-press p' + c.pressure + '">' + bars + '</span><small>' + esc(c.mood) + '</small></div>' +
            '<div class="hs-snap__t"><span class="hs-snap__k">Room in a shared flat</span><b>' + (R ? range(R.room, c.cur) : '—') + '<em>/mo</em></b><small>' + (R && R.src === 'country' ? 'Typical for ' + esc(u.country) + ' — estimate' : 'Typical in ' + esc(u.city) + ' — estimate') + '</small></div>' +
            '<div class="hs-snap__t"><span class="hs-snap__k">You move in</span><b>' + fmt(d.a, true) + '</b><span class="hs-count"><i style="--p:' + Math.max(.04, Math.min(1, 1 - n / 365)).toFixed(3) + '"></i></span><small>' + (n <= 0 ? 'Today' : n + ' days to go') + ' · until ' + fmt(d.b, true) + '</small></div>' +
            '</div>';
    }
    function stepDate(s, d) {
        if (s.on) { var p = s.on.split('-'), x = new Date(d.a.getFullYear(), +p[0] - 1, +p[1]); if (x > d.a) x = new Date(d.a.getFullYear() - 1, +p[0] - 1, +p[1]); return x; }
        return addMonths(d.a, -s.m);
    }
    function plan(u, c, d) {
        var t = today0(), steps = c.timeline.map(function (s) { return { s: s, at: stepDate(s, d) }; }).sort(function (a, b) { return a.at - b.at; });
        var nextIdx = steps.findIndex(function (x) { return x.at >= t; }); if (nextIdx === -1) nextIdx = steps.length - 1;
        var span = Math.max(1, d.a - Math.min(t, steps[0].at)), prog = Math.max(0, Math.min(1, (t - Math.min(t, steps[0].at)) / span));
        var items = steps.map(function (x, i) {
            var past = x.at < t && i < nextIdx, now = i === nextIdx, days = daysTo(x.at);
            var tag = past ? '<span class="hs-tag hs-tag--late">Passed ' + fmt(x.at) + '</span>' : now ? '<span class="hs-tag hs-tag--now">' + (days <= 0 ? 'Do it now' : 'Next · in ' + days + ' days') + '</span>' : '<span class="hs-tag">' + fmt(x.at, true) + '</span>';
            return '<li class="hs-step' + (past ? ' is-past' : '') + (now ? ' is-now' : '') + '" style="--k:' + i + '"><span class="hs-step__dot"><i class="fa-solid ' + (past ? 'fa-check' : now ? 'fa-bolt' : 'fa-circle') + '"></i></span>' +
                '<div class="hs-step__c"><div class="hs-step__top"><b>' + esc(x.s.t) + '</b>' + tag + '</div><p>' + esc(x.s.d) + '</p>' + (past && i < nextIdx ? '<p class="hs-step__miss"><i class="fa-solid fa-route"></i> Missed — see what still works below</p>' : '') + '</div></li>';
        }).join('');
        return sec('hsPlan', 'fa-route', 'Your plan', 'What to do, and when', null,
            '<ol class="hs-plan" style="--prog:' + prog.toFixed(3) + '">' + items + '</ol>');
    }
    function routes(u, c, d, R, left) {
        var cards = c.routes.map(function (r, i) {
            var pr = R ? R[r.price] : null, label = r.price === 'dorm' ? 'a month' : 'a month';
            var fit = left < 0 ? 'late' : left >= r.start ? 'ok' : left >= r.late ? 'tight' : 'late';
            var fitTxt = { ok: ['fa-circle-check', 'On time', 'Start by ' + fmt(addMonths(d.a, -r.start), true)], tight: ['fa-hourglass-half', 'Tight — start now', 'Places are going; apply this week'], late: ['fa-circle-exclamation', 'Probably too late', 'For ' + fmt(d.a) + ', look at the other options'] }[fit];
            return '<article class="hs-route hs-route--' + fit + '" style="--k:' + i + '">' +
                '<div class="hs-route__hd"><span class="hs-route__ic"><i class="fa-solid ' + r.icon + '"></i></span><div><h4>' + esc(r.name) + '</h4><span class="hs-fit hs-fit--' + fit + '"><i class="fa-solid ' + fitTxt[0] + '"></i>' + fitTxt[1] + '</span></div></div>' +
                '<div class="hs-route__price">' + (pr ? '<b>' + range(pr, c.cur) + '</b><small>/month</small>' : '<b>—</b>') + '</div>' +
                '<p class="hs-route__when"><i class="fa-regular fa-clock"></i> ' + fitTxt[2] + '</p>' +
                '<button type="button" class="hs-more" aria-expanded="false" data-more><span>How it works</span><i class="fa-solid fa-chevron-down"></i></button>' +
                '<div class="hs-fold"><div><p class="hs-route__what">' + esc(r.what) + '</p>' +
                '<div class="hs-route__more"><div><span>How</span><p>' + esc(r.how) + '</p></div><div><span>Who</span><p>' + esc(r.who) + '</p></div></div>' +
                '<div class="hs-pc"><ul class="hs-pros">' + r.pros.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><ul class="hs-cons">' + r.cons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div></div></article>';
        }).join('');
        return sec('hsRoutes', 'fa-house-chimney', 'Where you could live', 'Your options in ' + esc(u.city), null, '<div class="hs-routes">' + cards + '</div>');
    }
    function platforms(u, c, d) {
        var ids = (HD.cityPlatforms[u.city] || []).concat(c.platforms).filter(function (x, i, a) { return a.indexOf(x) === i; });
        var order = { official: 0, protected: 1, moderated: 2, open: 3 };
        var items = ids.map(function (id) { var p = HD.platforms[id]; if (!p) return null; var url = p.url({ name: u.city, cc: u.cc }, d); return url ? { id: id, p: p, url: url } : null; }).filter(Boolean)
            .sort(function (a, b) { return order[a.p.kind] - order[b.p.kind]; });
        var dated = function (p) { return /moveIn|move-in/.test(p); };
        var cards = items.map(function (x, i) {
            var k = KIND[x.p.kind];
            return '<a class="hs-plat hs-plat--' + x.p.kind + '" href="' + esc(x.url) + '" target="_blank" rel="noopener" style="--k:' + i + '" title="' + esc(x.p.note) + '">' +
                '<span class="hs-plat__logo"><img src="https://www.google.com/s2/favicons?domain=' + esc(x.p.host) + '&sz=64" alt="" loading="lazy"></span>' +
                '<span class="hs-plat__body"><b>' + esc(x.p.name) + '</b><small>' + esc(x.p.best) + '</small><span class="hs-kind hs-kind--' + x.p.kind + '"><i class="fa-solid ' + k[0] + '"></i>' + k[1] + '</span></span>' +
                '<span class="hs-plat__go">' + (dated(x.url) ? '<i class="fa-regular fa-calendar-check"></i> ' + fmt(d.a) + ' → ' + fmt(d.b) : 'Open') + ' <i class="fa-solid fa-arrow-up-right-from-square"></i></span></a>';
        }).join('');
        return sec('hsPlats', 'fa-magnifying-glass-location', 'Rooms for your dates', 'Live offers in ' + esc(u.city), 'Opens each site\'s live listings, dates filled in.',
            '<div class="hs-legend">' + Object.keys(KIND).map(function (k) { return '<span class="hs-kind hs-kind--' + k + '" title="' + esc(KIND[k][2]) + '"><i class="fa-solid ' + KIND[k][0] + '"></i>' + KIND[k][1] + '</span>'; }).join('') + '</div><div class="hs-plats">' + cards + '</div>');
    }
    function hoods(u, c, R) {
        if (!R || !R.hoods || !R.hoods.length) return '';
        var cards = R.hoods.slice(0, 6).map(function (h, i) {
            return '<article class="hs-hood" style="--k:' + i + '"><div class="hs-hood__hd"><b>' + esc(h.name) + '</b><span>' + esc(h.rent || '') + '</span></div><p>' + esc(h.vibe || '') + '</p>' +
                '<div class="hs-meter"><span>Safety</span><i style="--v:' + ((h.safety || 0) / 100).toFixed(2) + '"></i><em>' + (h.safety || '—') + '</em></div><div class="hs-meter"><span>Popular</span><i style="--v:' + ((h.popularity || 0) / 100).toFixed(2) + '"></i><em>' + (h.popularity || '—') + '</em></div>' +
                '<small><i class="fa-solid fa-route"></i> ' + esc(h.commute || '') + ' to the centre</small></article>';
        }).join('');
        return sec('hsHoods', 'fa-map-location-dot', 'Neighbourhoods', 'Where students live in ' + esc(u.city), null, '<div class="hs-hoods">' + cards + '</div>');
    }
    function rules(c) {
        var col = function (icon, t, body) { return '<article class="hs-rule"><span class="hs-rule__ic"><i class="fa-solid ' + icon + '"></i></span><h4>' + t + '</h4>' + body + '</article>'; };
        return sec('hsRules', 'fa-scale-balanced', 'Rules & paperwork', 'Deposit, documents, rights', null,
            '<div class="hs-rules">' + col('fa-piggy-bank', 'Deposit', '<p>' + esc(c.deposit) + '</p>') + col('fa-folder-open', 'Documents you\'ll need', '<ul>' + c.docs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>') +
            col('fa-gavel', 'Your rights', '<ul>' + c.rights.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>') + '</div>' +
            '<p class="hs-hot"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(c.scams) + '</p>');
    }
    function scam(u, c, R) {
        var flags = HD.redFlags.map(function (f, i) { return '<li style="--k:' + i + '" tabindex="0" title="' + esc(f[2]) + '"><i class="fa-solid ' + f[0] + '"></i><b>' + esc(f[1]) + '</b><span>' + esc(f[2]) + '</span></li>'; }).join('');
        var stats = HD.stats.map(function (s) { return '<a class="hs-stat" href="' + esc(s[2]) + '" target="_blank" rel="noopener"><b>' + esc(s[0]) + '</b><span>' + esc(s[1]) + '</span></a>'; }).join('');
        return sec('hsScam', 'fa-user-shield', 'Scam check', 'Check it before you pay', null,
            '<div class="hs-scam">' +
                '<form class="hs-scam__in" id="hsScamForm">' +
                    '<label class="hs-fld"><span>The ad or the landlord\'s messages</span><textarea id="hsScamText" rows="7" placeholder="Paste it here…"></textarea></label>' +
                    '<div class="hs-row"><label class="hs-fld"><span>Rent asked (' + esc(c.cur) + '/month)</span><input id="hsScamPrice" type="number" min="0" inputmode="decimal" placeholder="e.g. ' + (R ? Math.round(R.room[0]) : 500) + '"></label>' +
                    '<label class="hs-fld"><span>Link (optional)</span><input id="hsScamUrl" type="url" placeholder="https://…"></label></div>' +
                    '<div class="hs-row hs-row--btns"><button class="hs-btn hs-btn--ink" type="submit" id="hsScamGo"><i class="fa-solid fa-shield-halved"></i> Check this listing</button><button class="hs-btn hs-btn--ghost" type="button" id="hsScamDemo">Try an example</button></div>' +
                    '<p class="hs-fine"><i class="fa-solid fa-lock"></i> Not stored · a check can\'t prove a listing is real</p>' +
                '</form>' +
                '<div class="hs-scam__out" id="hsScamOut"><div class="hs-scam__idle"><span class="hs-shield"><i class="fa-solid fa-shield-halved"></i></span><b>Risk score appears here</b></div></div>' +
            '</div>' +
            '<div class="hs-flags"><h4>8 red flags</h4><ul>' + flags + '</ul></div>' +
            '<div class="hs-safe"><div><h4>Before you pay</h4><ol>' + HD.safeSteps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div><div class="hs-stats">' + stats + '</div></div>');
    }
    function sources(c) { return '<p class="hs-src hs-rv"><i class="fa-solid fa-book-open"></i> Researched Oct 2026: ' + c.sources.map(function (s) { return '<a href="' + esc(s[1]) + '" target="_blank" rel="noopener">' + esc(s[0]) + '</a>'; }).join(' · ') + '. Prices are typical ranges, not quotes.</p>'; }

    /* ── scam check ────────────────────────────────────────────────── */
    var DEMO = 'Hello! The room near the university is still free, 380 euro all bills included. I work abroad as a doctor so I can\'t show it, but my agent will deliver the keys after you pay the deposit and first month by Western Union. Many students want it, so please confirm today. Write me on WhatsApp.';
    root.addEventListener('click', function (e) {
        if (e.target.closest('#hsScamDemo')) { $('hsScamText').value = DEMO; var u = find(st.cc, st.id), R = u && rents(u); $('hsScamPrice').value = R ? Math.round(R.room[0] * .55) : 380; $('hsScamText').focus(); }
    });
    root.addEventListener('click', function (e) {
        var m = e.target.closest('[data-more]'); if (!m) return;
        var card = m.closest('.hs-route'), open = !card.classList.contains('is-open');
        card.classList.toggle('is-open', open); m.setAttribute('aria-expanded', open); m.querySelector('span').textContent = open ? 'Less' : 'How it works';
    });
    root.addEventListener('submit', function (e) {
        if (e.target.id !== 'hsScamForm') return;
        e.preventDefault();
        var u = find(st.cc, st.id), c = HD.countries[u.cc], R = rents(u), out = $('hsScamOut'), go = $('hsScamGo');
        var text = $('hsScamText').value.trim();
        if (text.length < 30 && !$('hsScamUrl').value.trim()) { $('hsScamText').focus(); out.innerHTML = '<div class="hs-scam__idle"><b>Paste a bit more</b><p>A few sentences of the listing or the messages are enough.</p></div>'; return; }
        go.disabled = true; go.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking…';
        out.innerHTML = '<div class="hs-scam__busy"><span class="hs-scanner"><i class="fa-solid fa-magnifying-glass"></i></span><b>Checking…</b></div>';
        fetch(API + '/api/housing/scam-check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: text, url: $('hsScamUrl').value.trim(), price: +$('hsScamPrice').value || null, cc: u.cc, city: u.city, cur: c.cur, typical: R ? R.room.map(Math.round) : null }) })
            .then(function (r) { return r.json(); })
            .then(function (j) { if (!j.ok) throw new Error(j.message || 'Check failed'); out.innerHTML = result(j); requestAnimationFrame(function () { out.querySelector('.hs-gauge').classList.add('is-in'); }); })
            .catch(function (err) { out.innerHTML = '<div class="hs-scam__idle"><b>Couldn\'t run the check</b><p>' + esc(err.message) + ' — the server may be offline. The red flags below still apply.</p></div>'; })
            .then(function () { go.disabled = false; go.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Check this listing'; });
    });
    function result(j) {
        var col = j.level === 'high' ? 'bad' : j.level === 'medium' ? 'warn' : 'good', word = { high: 'High risk', medium: 'Be careful', low: 'Low risk' }[j.level];
        return '<div class="hs-res hs-res--' + col + '">' +
            '<div class="hs-res__top"><div class="hs-gauge" style="--v:' + (j.score / 100).toFixed(3) + '"><svg viewBox="0 0 120 70" aria-hidden="true"><path class="hs-gauge__trk" d="M10 64 A50 50 0 0 1 110 64" pathLength="100"/><path class="hs-gauge__arc" d="M10 64 A50 50 0 0 1 110 64" pathLength="100"/></svg><b>' + j.score + '</b><small>/ 100</small></div>' +
                '<div><span class="hs-res__lvl">' + word + '</span><p>' + esc(j.summary) + '</p></div></div>' +
            (j.flags.length ? '<ul class="hs-res__flags">' + j.flags.map(function (f, i) { return '<li style="--k:' + i + '"><i class="fa-solid ' + (f.src === 'ai' ? 'fa-wand-magic-sparkles' : 'fa-flag') + '"></i><div><b>' + esc(f.label) + '</b><p>' + esc(f.why) + '</p>' + (f.quote ? '<q>' + esc(f.quote) + '</q>' : '') + '</div></li>'; }).join('') + '</ul>' : '<p class="hs-res__none"><i class="fa-solid fa-circle-check"></i> No classic scam patterns found in this text.</p>') +
            (j.positives && j.positives.length ? '<div class="hs-res__pos"><span>Looks legitimate</span>' + j.positives.map(function (p) { return '<p><i class="fa-solid fa-check"></i> ' + esc(p) + '</p>'; }).join('') + '</div>' : '') +
            (j.questions && j.questions.length ? '<div class="hs-res__qs"><span>Ask the landlord</span>' + j.questions.map(function (q) { return '<p><i class="fa-regular fa-comment"></i> ' + esc(q) + '</p>'; }).join('') + '</div>' : '') +
            '</div>';
    }

    /* ── reveal + scene pause ──────────────────────────────────────── */
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px' }) : null;
    function reveal() { root.querySelectorAll('.hs-rv:not(.is-in)').forEach(function (x) { if (io && !REDUCED) io.observe(x); else x.classList.add('is-in'); }); }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { $('hsScene').classList.toggle('is-paused', !en[0].isIntersecting); }).observe($('hsScene'));

    paintDates(); renderPicks(); render(false);
    window.openHousing = function (cc, id) { if (cc && id) { st.cc = cc; st.id = id; lsSet(st); } if (typeof showTab === 'function') showTab('housing'); render(true); };
})();

/* Explore → Housing teaser: open the page; float only while it's on screen */
(function () {
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-open-housing]') && typeof showTab === 'function') { showTab('housing'); scrollTo({ top: 0, behavior: 'smooth' }); } });
})();
