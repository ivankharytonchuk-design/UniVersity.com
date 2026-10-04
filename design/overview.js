/* ════════════════════════════════════════════════════════════════════
   Overview — a quiet home page.
     • header: one row with the destination's clock, its date and how far
       it is from you; a greeting, one sentence about what matters today,
       three counts
     • "Next up" card: the nearest deadline with a live countdown and a
       runway that fills as the day gets closer
     • your grades and your saved chances side by side
     • the destination's top ten as a simple list
     • the study-destination drawer that "Change country" slides in
   mainPage.js still owns the data and fills several ids here (heroName,
   heroStatSaved, heroStatTotal, heroFeedVal, the grades card, csGrid…);
   this file adds what's new and keeps it fresh. Hover never moves
   anything; motion is off under prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var root = document.getElementById('tabOverview');
    if (!root) return;
    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var DAY = 864e5;
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var WDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var NAMES = { es: 'Spain', gb: 'the UK', fr: 'France', de: 'Germany', it: 'Italy', pt: 'Portugal', us: 'the US', ch: 'Switzerland', ua: 'Ukraine',
        nl: 'the Netherlands', se: 'Sweden', dk: 'Denmark', be: 'Belgium', fi: 'Finland', ie: 'Ireland' };
    var TYPE = { application: 'Application', scholarship: 'Scholarship', openday: 'Open day', accommodation: 'Housing', interview: 'Interview', other: 'Reminder' };
    var TYPE_ICON = { application: 'fa-file-pen', scholarship: 'fa-award', openday: 'fa-door-open', accommodation: 'fa-house', interview: 'fa-comments', other: 'fa-bell' };

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function call(fn, d) { try { return fn(); } catch (e) { return d; } }
    function cc() { return typeof currentCountryCode !== 'undefined' ? currentCountryCode : 'es'; }
    function today0() { var t = new Date(); t.setHours(0, 0, 0, 0); return t; }
    function parseDay(iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function shortUni(n) { return String(n || '').replace(/^(University of|Universidad de|Univ\.|Universit[àa] (di|degli))\s*/i, ''); }
    function pad2(n) { return String(n).padStart(2, '0'); }

    /* ── The destination's clock, on one row with its date ───────────
       Hands turn with CSS animations started at the right angle, so they
       sweep smoothly without per-frame JavaScript. */
    var TZ = { es: 'Europe/Madrid', gb: 'Europe/London', fr: 'Europe/Paris', de: 'Europe/Berlin', it: 'Europe/Rome', pt: 'Europe/Lisbon',
        us: 'America/New_York', ch: 'Europe/Zurich', ua: 'Europe/Kyiv', nl: 'Europe/Amsterdam', se: 'Europe/Stockholm',
        dk: 'Europe/Copenhagen', be: 'Europe/Brussels', fi: 'Europe/Helsinki', ie: 'Europe/Dublin' };
    var LOCAL_TZ = call(function () { return Intl.DateTimeFormat().resolvedOptions().timeZone; }, 'UTC') || 'UTC';
    function tzParts(tz, d) {
        var o = {};
        call(function () {
            new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false })
                .formatToParts(d).forEach(function (p) { if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10) % (p.type === 'hour' ? 24 : 60); });
        });
        return { h: o.hour || 0, m: o.minute || 0, s: o.second || 0 };
    }
    function tzOffsetMin(tz, d) { var p = tzParts(tz, d), l = tzParts(LOCAL_TZ, d), diff = (p.h * 60 + p.m) - (l.h * 60 + l.m); if (diff > 720) diff -= 1440; if (diff < -720) diff += 1440; return diff; }
    function tzDate(tz, d) {
        return call(function () { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }).format(d).replace(',', ''); },
            WDAYS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3));
    }
    function cityOf(tz) { return String(tz).split('/').pop().replace(/_/g, ' '); }
    function isNight(h) { return h < 7 || h >= 20; }
    function hm(p) { return pad2(p.h) + '<i class="ov-clock__colon">:</i>' + pad2(p.m); }
    function face() {
        var t = '';
        for (var i = 0; i < 12; i++) t += '<line x1="50" y1="' + (i % 3 ? 9 : 8) + '" x2="50" y2="' + (i % 3 ? 12 : 16) + '" transform="rotate(' + i * 30 + ' 50 50)"' + (i % 3 ? '' : ' class="q"') + '/>';
        return t;
    }
    function renderClocks() {
        var box = $('ovClocks'), now = new Date();
        var tz = TZ[cc()] || LOCAL_TZ, p = tzParts(tz, now), night = isNight(p.h);
        var secs = p.h % 12 * 3600 + p.m * 60 + p.s, off = tzOffsetMin(tz, now);
        var offH = (Math.abs(off) % 60 ? (Math.abs(off) / 60).toFixed(1) : Math.abs(off) / 60) + ' h';
        var rot = function (period) { return REDUCED ? 'style="transform:rotate(' + (secs % period / period * 360).toFixed(2) + 'deg)"' : 'style="animation-delay:-' + (secs % period) + 's"'; };
        box.innerHTML =
            '<div class="ov-clock' + (night ? ' is-night' : '') + '" data-tz="' + esc(tz) + '">' +
                // each hand is its own <svg>, so turning it is a compositor layer move — no repaint, no main-thread work
                '<span class="ov-clock__dial" aria-hidden="true"><svg viewBox="0 0 100 100"><circle class="ov-clock__face" cx="50" cy="50" r="46"/><g class="ov-clock__ticks">' + face() + '</g></svg>' +
                    '<svg viewBox="0 0 100 100" class="ov-hand ov-hand--h" ' + rot(43200) + '><line x1="50" y1="54" x2="50" y2="29"/></svg>' +
                    '<svg viewBox="0 0 100 100" class="ov-hand ov-hand--m" ' + rot(3600) + '><line x1="50" y1="56" x2="50" y2="17"/></svg>' +
                    (REDUCED ? '' : '<svg viewBox="0 0 100 100" class="ov-hand ov-hand--s" ' + rot(60) + '><line x1="50" y1="62" x2="50" y2="13"/></svg>') +
                    '<svg viewBox="0 0 100 100"><circle class="ov-clock__pin" cx="50" cy="50" r="3.6"/></svg></span>' +
                '<b class="ov-clock__time" data-time>' + hm(p) + '</b>' +
                '<span class="ov-clock__item" data-city><i class="fa-solid ' + (night ? 'fa-moon' : 'fa-sun') + '" aria-hidden="true"></i>' + esc(cityOf(tz)) + '</span>' +
                '<span class="ov-clock__item" id="ovDate">' + esc(tzDate(tz, now)) + '</span>' +
                (off ? '<span class="ov-clock__item ov-clock__off">' + (off > 0 ? '+' : '−') + offH + ' <span>' + (off > 0 ? 'ahead of you' : 'behind you') + '</span></span>' : '') +
            '</div>';
    }
    var lastMin = -1, clocksFor = '';
    function tick() {
        var now = new Date();
        if (now.getMinutes() === lastMin && clocksFor === cc()) return;
        lastMin = now.getMinutes();
        var hr = now.getHours();
        $('ovGreet').textContent = hr < 5 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
        if (clocksFor !== cc() || REDUCED || now.getMinutes() === 0) { clocksFor = cc(); renderClocks(); }
        else root.querySelectorAll('.ov-clock').forEach(function (c) {
            var p = tzParts(c.getAttribute('data-tz'), now), t = c.querySelector('[data-time]');
            if (t) { t.innerHTML = hm(p); t.classList.remove('is-roll'); void t.offsetWidth; t.classList.add('is-roll'); }
            c.classList.toggle('is-night', isNight(p.h));
        });
    }

    /* ── Next deadline (same rules as the Deadlines page) ──────────── */
    var next = null;
    /* ── The greeting stays on one line: on any screen, with any name, the
       font steps down just enough to fit the column (not below 34px; past
       that the name moves to its own line) ── */
    var titleEl = $('ovTitle'), fitRaf = 0;
    function fitTitle() {
        if (!titleEl || !titleEl.clientWidth) return;
        titleEl.classList.remove('is-wrap');
        titleEl.style.fontSize = '';
        var max = parseFloat(getComputedStyle(titleEl).fontSize), w = titleEl.clientWidth, need = titleEl.scrollWidth;
        if (need <= w + 1) return;
        var fit = Math.floor(max * w / need * 0.98);
        if (fit >= 34) titleEl.style.fontSize = fit + 'px';
        else titleEl.classList.add('is-wrap');   // a phone, or a very long name: keep the size, let the name take the next line
    }
    function queueFit() { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitTitle); }
    if (titleEl) {
        if ('ResizeObserver' in window) new ResizeObserver(queueFit).observe(titleEl.parentNode);
        else window.addEventListener('resize', queueFit);
        new MutationObserver(queueFit).observe(titleEl, { childList: true, subtree: true, characterData: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueFit);
    }

    function nextDeadline() {
        var done = call(function () { return getDlDone(); }, []), pin = call(function () { return getDlPin(); }, null);
        var items = (typeof DEADLINES !== 'undefined' ? DEADLINES : []).filter(function (d) { return d.country === cc(); })
            .concat(call(function () { return getDlCustom(); }, []))
            .concat(typeof window.dtScholarshipDeadlines === 'function' ? call(window.dtScholarshipDeadlines, []) : [])
            .concat(typeof window.dtApplicationDeadlines === 'function' ? call(window.dtApplicationDeadlines, []) : []);
        items.forEach(function (d) { d._days = Math.round((parseDay(d.date) - today0()) / DAY); d._pinned = false; });
        var pinned = pin ? items.filter(function (d) { return d.id === pin && d._days >= 0; })[0] : null;
        if (pinned) { pinned._pinned = true; return pinned; }
        return items.filter(function (d) { return done.indexOf(d.id) === -1 && d._days >= 0; })
            .sort(function (a, b) { return a._days - b._days; })[0] || null;
    }
    function uniOf(d) {
        if (!d || !d.uniId) return null;
        var u = (typeof UNI !== 'undefined' ? UNI : []).filter(function (x) { return x.id === d.uniId; })[0];
        return u || (d.uniName ? { name: d.uniName, abbr: d.uniAbbr, color: d.uniColor || '#3552d8' } : null);
    }
    function nextEnd() { var end = parseDay(next.date); end.setHours(23, 59, 59, 999); return end; }
    function cdParts() {
        var ms = Math.max(0, nextEnd() - Date.now());
        return { d: Math.floor(ms / DAY), h: Math.floor(ms % DAY / 36e5), m: Math.floor(ms % 36e5 / 6e4), s: Math.floor(ms % 6e4 / 1e3) };
    }
    // Your own photo beside the countdown — same system as the Deadlines ticket
    // (mainPage.js: us_hero_<key>_<uid>, changed through window.changeHeroPic).
    var PHOTO_DEF = 'images/DemonSlayer.jpeg';
    function photoSrc() { return call(function () { return localStorage.getItem('us_hero_overview_' + user.id); }, null) || PHOTO_DEF; }
    function photo() {
        return '<div class="ovn__photo"><img class="ovn__img" src="' + esc(photoSrc()) + '" alt="" loading="lazy" decoding="async">' +
            '<button type="button" class="ovn__pic" data-ovpic title="Change photo (right-click to reset)" aria-label="Change photo"><i class="fa-solid fa-camera" aria-hidden="true"></i></button></div>';
    }
    function renderNext() {
        var box = $('ovNext');
        if (!next) {
            box.className = 'ov-next ov-next--none';
            box.innerHTML = photo() +
                '<div class="ovn__main"><div class="ovn__hd"><p class="ovn__lbl"><i class="ovn__dot" aria-hidden="true"></i>Next up</p></div>' +
                '<div class="ovn__clear"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="M15 27l7.5 7.5L37.5 19"/></svg>' +
                    '<p class="ovn__none">All clear</p><p class="ovn__meta">Add your own dates, or save a scholarship and its deadline appears here.</p></div>' +
                '<div class="ovn__acts"><button type="button" class="ovn__btn ovn__btn--ink" data-ov="tracker">Open deadlines</button></div></div>';
            return;
        }
        var d = parseDay(next.date), u = uniOf(next), p = cdParts();
        // how far along the last 30 days (longer if the date is further away) you are
        var span = next._days <= 30 ? 30 : Math.ceil((next._days + 1) / 30) * 30, fill = Math.max(0.02, Math.min(1, 1 - next._days / span));
        var crest = u && typeof uniLogo === 'function' ? call(function () { return uniLogo(u, 20); }, '') : '<i class="fa-solid ' + (TYPE_ICON[next.type] || 'fa-calendar') + '" aria-hidden="true"></i>';
        box.className = 'ov-next' + (next._days <= 7 ? ' is-hot' : '');
        box.innerHTML = photo() +
            '<div class="ovn__main">' +
                '<div class="ovn__hd"><p class="ovn__lbl"><i class="ovn__dot" aria-hidden="true"></i>' + (next._pinned ? 'Pinned' : next._days <= 7 ? 'Due soon' : 'Next up') + '</p>' +
                    '<span class="ovn__type">' + esc(TYPE[next.type] || 'Deadline') + '</span></div>' +
                '<div class="ovn__count" role="timer" aria-label="' + p.d + ' days left"><b class="ovn__days" data-u="d">' + pad2(p.d) + '</b>' +
                    '<span><small>' + (p.d === 1 ? 'day' : 'days') + '</small><span class="ovn__clock"><i data-u="h">' + pad2(p.h) + '</i>:<i data-u="m">' + pad2(p.m) + '</i>:<i data-u="s">' + pad2(p.s) + '</i></span></span></div>' +
                '<h3 class="ovn__title">' + esc(next.title) + '</h3>' +
                '<p class="ovn__meta"><span class="ovn__crest">' + crest + '</span>' + (next.uniName ? esc(shortUni(next.uniName)) + ' · ' : '') + WDAYS[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + '</p>' +
                '<div class="ovn__run" style="--f:' + fill.toFixed(3) + '" aria-hidden="true"><i></i><span></span></div>' +
                '<div class="ovn__acts"><button type="button" class="ovn__btn ovn__btn--ink" data-ov="tracker">Open deadlines</button>' +
                    '<a class="ovn__btn" href="aiReviews.html"><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Ask the AI</a></div>' +
            '</div>';
        if (typeof cmpHydrateLogos === 'function') call(function () { cmpHydrateLogos(box); });
    }
    // Every second: a digit that changes drops in.
    function renderNextClock() {
        if (!next) return;
        var p = cdParts(), box = $('ovNext');
        ['d', 'h', 'm', 's'].forEach(function (k) {
            var b = box.querySelector('[data-u="' + k + '"]');
            if (!b) return;
            var v = pad2(p[k]);
            if (b.textContent === v) return;
            b.textContent = v;
            if (!REDUCED) { b.classList.remove('is-flip'); void b.offsetWidth; b.classList.add('is-flip'); }
        });
    }
    // Change the photo (click) or reset it (right-click).
    $('ovNext').addEventListener('click', function (e) {
        if (!e.target.closest('[data-ovpic]')) return;
        e.stopPropagation();
        if (typeof window.changeHeroPic === 'function') window.changeHeroPic('overview');
    });
    $('ovNext').addEventListener('contextmenu', function (e) {
        if (!e.target.closest('[data-ovpic]')) return;
        e.preventDefault();
        if (confirm('Reset this photo to the default?') && typeof window.resetHeroPic === 'function') window.resetHeroPic('overview');
    });

    /* ── A hint for brand-new users only ───────────────────────────── */
    function renderLede() {
        var saved = (call(function () { return getSaved(); }, []) || []).length, el = $('ovLede');
        el.hidden = !!saved;
        el.textContent = saved ? '' : 'Start by saving a few universities you like — everything on this page fills in around them.';
    }

    /* ── Your chances (saved on the Chances page) ──────────────────── */
    function zone(p) { return p >= 70 ? 'safe' : p >= 40 ? 'match' : 'reach'; }
    function renderChances() {
        var el = $('ovChances'), list = typeof getInsightSaves === 'function' ? call(getInsightSaves, []) : [];
        var head = '<div class="ov-card__hd"><h3>Chances</h3><button type="button" class="ov-link" data-ov="chances">' + (list.length ? 'Check another' : 'Open Chances') + ' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></div>';
        if (!list.length) {
            el.innerHTML = head + '<div class="ov-empty"><p>Check a university on the Chances page and press “Save to Overview”. Your odds collect here.</p></div>';
            return;
        }
        el.innerHTML = head + '<ul class="ov-odds">' + list.slice(0, 4).map(function (x) {
            var p = Math.max(0, Math.min(100, +x.prob || 0)), z = zone(p);
            return '<li class="ov-odds--' + z + '" style="--p:' + p + '"><span class="ov-odds__p">' + p + '<small>%</small></span>' +
                '<span class="ov-odds__txt"><b>' + esc(x.name) + '</b><small>' + esc([x.verdict, x.grade].filter(Boolean).join(' · ')) + '</small><i class="ov-odds__bar" aria-hidden="true"></i></span>' +
                '<button type="button" class="ov-odds__x" data-rm="' + esc(x.uniId) + '" aria-label="Remove ' + esc(x.name) + '"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></li>';
        }).join('') + '</ul>';
    }

    /* ── Top ten ───────────────────────────────────────────────────── */
    function renderTable() {
        var code = cc(), box = $('ovTableList'), unis = typeof UNI !== 'undefined' ? UNI : [];
        $('rnkCountryLabel').textContent = NAMES[code] || code.toUpperCase();
        var txt = $('ovCountryTxt'); if (txt) txt.textContent = 'universities in ' + (NAMES[code] || code.toUpperCase());
        var list = (typeof RANKING_DATA !== 'undefined' && RANKING_DATA[code]) || [];
        if (!list.length && unis.length) list = unis.slice().sort(function (a, b) { return (b.diff || 0) - (a.diff || 0) || (b.ts || 0) - (a.ts || 0); }).slice(0, 10).map(function (u) { return { id: u.id }; });
        var rows = list.slice(0, 10).map(function (item, i) {
            var u = unis.filter(function (x) { return x.id === item.id; })[0];
            if (!u) return '';
            var tr = item.trend === 'up' ? ['up', 'fa-arrow-trend-up', 'Rising'] : item.trend === 'down' ? ['down', 'fa-arrow-trend-down', 'Falling'] : ['flat', 'fa-minus', 'Steady'];
            return '<li class="ov-row" style="--i:' + i + '"><button type="button" class="ov-row__btn" data-uni="' + esc(u.id) + '">' +
                '<span class="ov-row__n">' + pad2(i + 1) + '</span>' +
                '<span class="ov-row__logo">' + (typeof uniLogo === 'function' ? call(function () { return uniLogo(u, 28); }, '') : '') + '</span>' +
                '<span class="ov-row__txt"><b>' + esc(u.name) + '</b><small>' + esc([u.city, u.dl].filter(Boolean).join(' · ')) + '</small></span>' +
                '<span class="ov-row__tr ov-row__tr--' + tr[0] + '" title="' + tr[2] + '"><i class="fa-solid ' + tr[1] + '" aria-hidden="true"></i> ' + tr[2] + '</span>' +
                '<i class="fa-solid fa-chevron-right ov-row__chev" aria-hidden="true"></i></button></li>';
        }).join('');
        box.innerHTML = rows || '<li class="ov-row ov-row--none">No ranking for this country yet.</li>';
        if (typeof cmpHydrateLogos === 'function') call(function () { cmpHydrateLogos(box); });
    }

    /* ── Updates count (mainPage.js writes "N new updates") ────────── */
    function syncFeed() {
        var n = parseInt(($('heroFeedVal') || {}).textContent || '', 10);
        $('ovFeedN').textContent = isNaN(n) ? '0' : n;
        root.querySelector('.ov-stat[data-ov="feed"]').classList.toggle('is-hot', n > 0);
    }

    function render() {
        if (clocksFor !== cc()) { clocksFor = cc(); renderClocks(); }
        next = nextDeadline();
        renderNext();
        renderLede();
        renderChances();
        renderTable();
        syncFeed();
        if (countryDrawer.isOpen()) countryDrawer.refresh();
    }
    window.overviewRefresh = render;

    /* ══ Study-destination drawer ════════════════════════════════════
       Slides in from the right. The country list inside is still drawn by
       mainPage.js (renderCountryGrid → #csGrid); this adds the header, the
       "now exploring" card, each country's local time, focus handling,
       Esc / scrim to close, and the entrance/exit motion. */
    var countryDrawer = (function () {
        var el = $('csDrawer'), panel = el && el.querySelector('.csd__panel'), lastFocus = null, closeT = 0, enterT = 0, timeT = 0;
        function isOpen() { return !!el && el.classList.contains('is-open'); }
        function fillTimes() {
            if (!el) return;
            var now = new Date();
            el.querySelectorAll('[data-cs-time]').forEach(function (s) {
                var tz = TZ[s.getAttribute('data-cs-time')];
                if (!tz) { s.textContent = ''; return; }
                var p = tzParts(tz, now);
                s.innerHTML = '<i class="fa-solid ' + (isNight(p.h) ? 'fa-moon' : 'fa-sun') + '" aria-hidden="true"></i>' + pad2(p.h) + ':' + pad2(p.m) + ' local';
            });
        }
        function renderNow() {
            var box = $('csdNow');
            if (!box) return;
            var code = cc(), name = call(function () { return countryNameByCode(code); }, code.toUpperCase());
            var tz = TZ[code], p = tz ? tzParts(tz, new Date()) : null, n = (typeof UNI !== 'undefined' ? UNI : []).length;
            box.innerHTML =
                '<span class="csd__now__flag fi fi-' + esc(code) + '" aria-hidden="true"></span>' +
                '<span class="csd__now__txt"><small><i class="csd__live" aria-hidden="true"></i>Exploring now</small><b>' + esc(name) + '</b>' +
                    '<span>' + [n ? n + ' universities' : '', p ? pad2(p.h) + ':' + pad2(p.m) + ' there' : ''].filter(Boolean).join(' · ') + '</span></span>';
        }
        function refresh() { if (!el) return; renderNow(); fillTimes(); }
        function focusables() { return panel ? [].slice.call(panel.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(function (x) { return x.offsetParent !== null; }) : []; }
        function open(from) {
            if (!el || isOpen()) return;
            clearTimeout(closeT); clearTimeout(enterT);
            lastFocus = from || document.activeElement;
            refresh();
            el.classList.remove('is-closing');
            el.setAttribute('aria-hidden', 'false');
            document.documentElement.classList.add('csd-lock');
            void el.offsetWidth;
            el.classList.add('is-open', 'is-entering');
            enterT = setTimeout(function () { el.classList.remove('is-entering'); }, 1100);
            clearInterval(timeT); timeT = setInterval(function () { if (isOpen()) fillTimes(); }, 15000);
            setTimeout(function () { var a = el.querySelector('.mp__cs__country.active') || el.querySelector('.csd__x'); if (a && isOpen()) a.focus({ preventScroll: true }); }, REDUCED ? 0 : 360);
        }
        function close() {
            if (!el || !isOpen()) return;
            clearTimeout(enterT); clearInterval(timeT);
            el.classList.remove('is-open', 'is-entering');
            el.classList.add('is-closing');
            document.documentElement.classList.remove('csd-lock');
            closeT = setTimeout(function () {
                el.classList.remove('is-closing');
                el.setAttribute('aria-hidden', 'true');
                el.querySelectorAll('.is-picking').forEach(function (x) { x.classList.remove('is-picking'); });
            }, REDUCED ? 0 : 460);
            if (lastFocus && lastFocus.focus && document.body.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
        }
        if (el) {
            el.addEventListener('click', function (e) {
                if (e.target.closest('[data-csd-close]')) close();
                else if (e.target.closest('#openProModal')) close();   // pricing opens underneath
            });
            document.addEventListener('keydown', function (e) {
                if (!isOpen()) return;
                if (document.querySelector('.gm--open')) return;   // the globe picker handles its own keys
                if (e.key === 'Escape') { e.preventDefault(); close(); return; }
                if (e.key !== 'Tab') return;
                var f = focusables(); if (!f.length) return;
                var first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            });
        }
        return { open: open, close: close, refresh: refresh, isOpen: isOpen };
    }());
    window.countryDrawer = countryDrawer;

    /* ── Events ────────────────────────────────────────────────────── */
    function scrollToEl(el) { if (el) el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); }
    root.addEventListener('click', function (e) {
        var rm = e.target.closest('[data-rm]');
        if (rm && typeof getInsightSaves === 'function') {
            setInsightSaves(getInsightSaves().filter(function (x) { return x.uniId !== rm.getAttribute('data-rm'); }));
            renderChances(); return;
        }
        var ub = e.target.closest('.ov-row__btn[data-uni]');
        if (ub) { var u = (typeof UNI !== 'undefined' ? UNI : []).filter(function (x) { return x.id === ub.getAttribute('data-uni'); })[0]; if (u && typeof showUniDetail === 'function') showUniDetail(u); return; }
        var t = e.target.closest('[data-ov]');
        if (!t) return;
        var go = t.getAttribute('data-ov');
        if (go === 'tracker') showTab('tracker');
        else if (go === 'explore') showTab('explore');
        else if (go === 'chances') showTab('cityguide');
        else if (go === 'saved') scrollToEl(root.querySelector('.ov-short'));
        else if (go === 'feed') { var f = $('feedToggle'); if (f) f.click(); }
        else if (go === 'cityguide') { showTab('explore'); setTimeout(function () { scrollToEl(document.querySelector('#tabExplore .cg2__wrap')); }, 120); }
    });

    /* Sections fade up the first time they scroll into view. */
    var io = !REDUCED && 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -6% 0px' }) : null;
    root.querySelectorAll('.ov-quick, .ov-pair, .ov-sec, #budgetSection').forEach(function (s) { if (io) io.observe(s); else s.classList.add('is-in'); });

    // Keep in step with the rest of the app.
    ['updateDshWidgets', 'buildRankCarousel', 'updateStats'].forEach(function (name) {
        var orig = window[name];
        if (typeof orig !== 'function') return;
        window[name] = function () { var r = orig.apply(this, arguments); call(render); return r; };
    });
    var fv = $('heroFeedVal'); if (fv) new MutationObserver(syncFeed).observe(fv, { childList: true, characterData: true, subtree: true });
    var lastDisp = root.style.display;
    new MutationObserver(function () {
        var d = root.style.display;
        if (d === lastDisp) return;
        lastDisp = d;
        if (d !== 'none') { render(); clocksFor = ''; lastMin = -1; tick(); }
    }).observe(root, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('storage', function (e) { if (e.key && /insight|us_saved|us_dl_/.test(e.key)) call(render); });

    function visible() { return root.style.display !== 'none' && !document.hidden; }
    tick();
    setInterval(function () { if (visible()) tick(); }, 5000);
    setInterval(function () { if (visible()) renderNextClock(); }, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { clocksFor = ''; lastMin = -1; tick(); renderNextClock(); } });
    render();
    setTimeout(render, 1600);   // country data arrives asynchronously on first load
})();
