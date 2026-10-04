/* ════════════════════════════════════════════════════════════════════
   Chances (tabCityGuide) — one university, one grade, everything else
   follows:

     • a live gauge: your chance, Reach / Match / Safety, and how many points
       would move you up a zone (the grade slider shows where each zone starts)
     • your saved universities sorted into Reach / Match / Safety — cards glide
       between columns as you drag the grade
     • similar universities where your odds are better
     • what the degree pays (salary brackets) and costs (true cost & payback)

   The maths is the site's existing model (mainPage.js): ADM_PARAMS + sigmoid
   for chances, SALARY_DATA / FIELD_BONUS for salaries, and the True Cost
   helpers (tuitionMidCost, cityLivingAnnual, …) for ROI — so numbers match
   the badges on university cards. Only the presentation is new. The old
   calculator inputs are kept hidden in the page because mainPage.js wires
   listeners to them on load.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var root = document.getElementById('tabCityGuide');
    if (!root || typeof ADM_PARAMS === 'undefined' || typeof sigmoid !== 'function') return;

    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var UID = (window.user && window.user.id) || 'guest';
    var KEY = 'us_ch_state_' + UID;
    var ZONES = {
        reach:  { label: 'Reach',  color: '#ff6b5b', ink: '#d9432f' },
        match:  { label: 'Match',  color: '#ffc94a', ink: '#b07900' },
        safety: { label: 'Safety', color: '#43d19e', ink: '#138a5e' }
    };
    var SYS = {
        pct: { label: '%', min: 0, max: 100, step: 1, to: function (v) { return v; }, from: function (p) { return p; }, fmt: function (v) { return Math.round(v) + '%'; }, unit: '%' },
        gpa: { label: 'GPA', min: 0, max: 4, step: 0.05, to: function (v) { return v / 4 * 100; }, from: function (p) { return p / 100 * 4; }, fmt: function (v) { return (+v).toFixed(2); }, unit: '' },
        ib: { label: 'IB', min: 1, max: 45, step: 1, to: function (v) { return v / 45 * 100; }, from: function (p) { return p / 100 * 45; }, fmt: function (v) { return Math.round(v) + ' pts'; }, unit: ' pts' },
        alevels: { label: 'A-levels', grades: [['A*', 100], ['A', 90], ['B', 78], ['C', 65], ['D', 52], ['E', 40]] }
    };
    var FIELDS = [['', 'All fields'], ['cs', 'Computer science'], ['engineering', 'Engineering'], ['finance', 'Business & finance'], ['medicine', 'Medicine'], ['law', 'Law'], ['science', 'Science'], ['arts', 'Arts & humanities']];
    var SAL_FIELD = { cs: 'engineering', engineering: 'engineering', finance: 'finance', medicine: 'medicine', law: 'law', arts: 'arts' };
    var DEGREES = [['bachelor', 'Bachelor’s'], ['master', 'Master’s'], ['phd', 'PhD']];

    /* ── Utilities ─────────────────────────────────────────────────── */
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function lsJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function call(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function initials(t) { var w = String(t || '').replace(/[^A-Za-zÀ-ÿ ]/g, ' ').split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '?').slice(0, 2)).toUpperCase(); }
    function logo(u, size) {
        if (u && typeof uniLogo === 'function') { try { return uniLogo({ name: u.name, abbr: (u.abbr || initials(u.name)).slice(0, 4), color: u.color || '#0f3d33', website: u.website }, size); } catch (e) {} }
        return '<span class="ch-mono" style="width:' + size + 'px;height:' + size + 'px;background:' + esc((u && u.color) || '#0f3d33') + '">' + esc(initials(u && u.name)) + '</span>';
    }
    function hydrate(el) { if (el && typeof cmpHydrateLogos === 'function') cmpHydrateLogos(el); }
    function countryName(cc) { return call(function () { return typeof countryNameByCode === 'function' ? countryNameByCode(cc) : cc.toUpperCase(); }, String(cc || '').toUpperCase()); }
    function curCC() { return typeof currentCountryCode !== 'undefined' ? currentCountryCode : ''; }

    /* ── The model (same maths as the university-card badges) ───────── */
    function paramsFor(u) { return ADM_PARAMS[u && u.diff] || ADM_PARAMS[3]; }
    function chance(u, pct) { return cap(sigmoid(pct, paramsFor(u).thresh, paramsFor(u).k)); }
    function zoneOf(p) { return p >= 70 ? 'safety' : p >= 40 ? 'match' : 'reach'; }
    // Grade (0–100) where the rounded chance first reaches `p`.
    function gradeFor(u, p) { var q = paramsFor(u); return q.thresh + Math.log((p - .5) / (100 - p + .5)) / q.k; }
    // …expressed in the chosen grade system, rounded UP to a grade you can actually get.
    function needIn(sys, pctNeed) {
        var v = SYS[sys].from(pctNeed);
        return sys === 'gpa' ? Math.ceil(v * 100 - 1e-6) / 100 : Math.ceil(v - 1e-6);
    }

    /* ── State (remembered) ─────────────────────────────────────────── */
    var S = (function () {
        var d = { uniId: null, cc: null, sys: 'pct', val: null, al: null, field: '', degree: 'bachelor' };   // al: your best three A-level grades
        var s = lsJSON(KEY, {});
        for (var k in d) if (s[k] !== undefined) d[k] = s[k];
        return d;
    })();
    function save() { lsSet(KEY, S); }
    var AL_PCT = {}; SYS.alevels.grades.forEach(function (g) { AL_PCT[g[0]] = g[1]; });
    function alValid() { return Array.isArray(S.al) && S.al.length === 3 && S.al.every(function (g) { return AL_PCT[g] != null; }); }
    function alAvg(list) { return list.reduce(function (a, g) { return a + AL_PCT[g]; }, 0) / list.length; }
    function gradePct() {
        if (S.sys === 'alevels') { if (alValid()) return alAvg(S.al); }
        if (S.val == null || S.val === '' || isNaN(+S.val)) return null;
        return S.sys === 'alevels' ? +S.val : clamp(SYS[S.sys].to(+S.val), 0, 100);
    }
    function nearestGrade(p) { return SYS.alevels.grades.reduce(function (best, g) { return Math.abs(g[1] - p) < Math.abs(best[1] - p) ? g : best; })[0]; }
    // IB from the Gradebook: the six best subject grades (1–7) add up to 42 — core points (up to 3) come on top.
    function gbIB() {
        var gb = lsJSON('us_gradebook_' + UID, null);
        if (!gb || gb.scale !== 'ib' || !Array.isArray(gb.subjects)) return null;
        var vals = gb.subjects.map(function (s) {
            var marks = [];
            [s.sem1, s.sem2].forEach(function (arr) { (arr || []).forEach(function (m) { if (m != null && m !== '' && !isNaN(m)) marks.push(clamp(+m, 1, 7)); }); });
            if (marks.length) return marks.reduce(function (a, b) { return a + b; }, 0) / marks.length;
            if (s.grade != null && s.grade !== '' && !isNaN(s.grade)) return clamp(+s.grade, 1, 7);
            if (s.assessments && s.assessments.length) { var w = 0, t = 0; s.assessments.forEach(function (a) { var wt = a.weight || 1; w += wt; t += clamp(+a.grade, 1, 7) * wt; }); return w ? t / w : null; }
            return null;
        }).filter(function (v) { return v != null; }).map(Math.round).sort(function (a, b) { return b - a; });
        return vals.length >= 6 ? vals.slice(0, 6).reduce(function (a, b) { return a + b; }, 0) : null;
    }
    function gradeLabel() {
        if (gradePct() == null) return '';
        if (S.sys === 'alevels') { if (alValid()) return 'A-levels ' + S.al.join(''); var g = SYS.alevels.grades.filter(function (x) { return x[1] === +S.val; })[0]; return 'A-level ' + (g ? g[0] : ''); }
        return S.sys === 'pct' ? Math.round(S.val) + '%' : S.sys === 'gpa' ? 'GPA ' + (+S.val).toFixed(2) : Math.round(S.val) + ' IB points';
    }
    function gbAverage() { return typeof studentGradePercent === 'function' ? call(studentGradePercent, null) : null; }

    /* ── Universities: every country, indexed from data/<cc>.json (the
       browser already has these cached). Looked up by country + id, because
       the same id can exist in two countries (e.g. "ucm" in Spain and the US). ── */
    var CODES = ['be', 'ch', 'de', 'dk', 'es', 'fi', 'fr', 'gb', 'ie', 'it', 'nl', 'pt', 'se', 'ua', 'us'];
    var countryUnis = {}, indexState = 0, indexWaiters = [];
    function buildIndex(cb) {
        if (cb) indexWaiters.push(cb);
        if (indexState === 2) { flush(); return; }
        if (indexState === 1) return;
        indexState = 1;
        var left = CODES.length;
        CODES.forEach(function (cc) {
            fetch('data/' + cc + '.json').then(function (r) { return r.json(); }).then(function (d) {
                countryUnis[cc] = (d.universities || []).map(function (x) { x.cc = cc; return x; });
            }).catch(function () {}).then(function () { if (--left === 0) { indexState = 2; flush(); } });
        });
        function flush() { var q = indexWaiters; indexWaiters = []; q.forEach(function (f) { call(f); }); }
    }
    function unisOf(cc) {
        if (cc && cc === curCC() && typeof UNI !== 'undefined' && UNI.length) { UNI.forEach(function (u) { if (!u.cc) u.cc = cc; }); return UNI; }
        return countryUnis[cc] || [];
    }
    function findUni(id, cc) {
        if (!id) return null;
        var pick = function (list) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
        var hit = (cc && pick(unisOf(cc))) || pick(unisOf(curCC()));
        if (hit) return hit;
        for (var k in countryUnis) { hit = pick(countryUnis[k]); if (hit) return hit; }
        var r = lsJSON('us_uni_registry', {})[id];   // until the index has loaded: name + selectivity only
        return r ? Object.assign({}, r, { cc: cc || null }) : null;
    }
    function cur() { return findUni(S.uniId, S.cc); }
    function allUnis() {
        var cc0 = curCC(), out = unisOf(cc0).slice();
        CODES.forEach(function (cc) { if (cc !== cc0 && countryUnis[cc]) out = out.concat(countryUnis[cc]); });
        return out;
    }
    function searchUnis(q) {
        var all = allUnis(), n = norm(q).trim();
        if (!n) {
            var saved = call(getSaved, []) || [], seen = {};
            var s = all.filter(function (u) { if (saved.indexOf(u.id) === -1 || seen[u.id]) return false; seen[u.id] = 1; return true; });
            return (s.length ? s : all.filter(function (u) { return u.cc === curCC(); })).slice(0, 8);
        }
        return all.map(function (u) {
            var nm = norm(u.name), ab = norm(u.abbr), score = nm.indexOf(n) === 0 || ab === n ? 0 : nm.indexOf(' ' + n) !== -1 ? 1 : (nm.indexOf(n) !== -1 || ab.indexOf(n) !== -1 || norm(u.city).indexOf(n) !== -1) ? 2 : 9;
            return { u: u, s: score + (u.cc === curCC() ? 0 : .5) };
        }).filter(function (x) { return x.s < 9; }).sort(function (a, b) { return a.s - b.s || a.u.name.localeCompare(b.u.name); }).slice(0, 8).map(function (x) { return x.u; });
    }

    /* ── Picker (combobox) ─────────────────────────────────────────── */
    var input = $('chUniInput'), listEl = $('chUniList'), pickItems = [], active = -1;
    function showList() {
        pickItems = searchUnis(input.value);
        active = pickItems.length ? 0 : -1;
        listEl.innerHTML = pickItems.length ? pickItems.map(function (u, i) {
            return '<li role="option" id="chOpt' + i + '" class="ch-opt' + (i === active ? ' is-on' : '') + '" data-pick="' + esc(u.id) + '" data-cc="' + esc(u.cc || '') + '" aria-selected="' + (i === active) + '">' +
                '<span class="ch-opt__logo">' + logo(u, 26) + '</span><span class="ch-opt__name">' + esc(u.name) + '</span>' +
                (u.cc ? '<span class="ch-opt__cc"><span class="fi fi-' + esc(u.cc) + '"></span>' + esc(u.cc.toUpperCase()) + '</span>' : '') + '</li>';
        }).join('') : '<li class="ch-opt ch-opt--none">No university found</li>';
        listEl.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        if (active >= 0) input.setAttribute('aria-activedescendant', 'chOpt' + active);
        hydrate(listEl);
    }
    function hideList() { listEl.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); }
    function moveActive(d) {
        if (!pickItems.length) return;
        active = (active + d + pickItems.length) % pickItems.length;
        listEl.querySelectorAll('.ch-opt').forEach(function (li, i) { li.classList.toggle('is-on', i === active); li.setAttribute('aria-selected', i === active ? 'true' : 'false'); });
        input.setAttribute('aria-activedescendant', 'chOpt' + active);
        var el = $('chOpt' + active); if (el) el.scrollIntoView({ block: 'nearest' });
    }
    function choose(id, cc) {
        S.uniId = id; S.cc = cc || null; save();
        hideList();
        renderAll(true);
    }
    input.addEventListener('focus', function () { input.select(); showList(); });
    input.addEventListener('input', showList);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (listEl.hidden) showList(); else moveActive(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); var u = pickItems[active]; if (u) { choose(u.id, u.cc); input.blur(); } }
        else if (e.key === 'Escape') { hideList(); syncPicker(); input.blur(); }
    });
    input.addEventListener('blur', function () { setTimeout(function () { hideList(); syncPicker(); }, 120); });
    listEl.addEventListener('mousedown', function (e) {
        var li = e.target.closest('[data-pick]'); if (!li) return;
        e.preventDefault(); choose(li.getAttribute('data-pick'), li.getAttribute('data-cc')); input.blur();
    });
    function syncPicker() {
        var u = cur();
        if (document.activeElement !== input) input.value = u ? u.name : '';
        $('chPickLogo').innerHTML = u ? logo(u, 30) : '<i class="fa-solid fa-building-columns" aria-hidden="true"></i>';
        $('chPick').classList.toggle('has-uni', !!u);
        hydrate($('chPickLogo'));
    }

    /* Quick switch between saved universities */
    function renderQuick() {
        var el = $('chQuick'), seen = {};
        var unis = (call(getSaved, []) || []).map(function (id) { return findUni(id); }).filter(function (u) { if (!u || seen[u.id]) return false; seen[u.id] = 1; return true; }).slice(0, 6);
        if (!unis.length) { el.innerHTML = ''; return; }
        el.innerHTML = '<span class="ch-quick__lbl">Your list</span>' + unis.map(function (u) {
            var on = u.id === S.uniId;
            return '<button type="button" class="ch-qchip' + (on ? ' is-on' : '') + '" data-uni="' + esc(u.id) + '" data-cc="' + esc(u.cc || '') + '" aria-pressed="' + on + '"><span class="ch-qchip__logo">' + logo(u, 18) + '</span>' + esc(u.abbr && u.abbr.length <= 12 ? u.abbr : u.name) + '</button>';
        }).join('');
        hydrate(el);
    }

    /* ── Grade controls ────────────────────────────────────────────── */
    function renderSys() {
        $('chSys').innerHTML = ['pct', 'gpa', 'ib', 'alevels'].map(function (k) {
            var on = S.sys === k;
            return '<button type="button" role="radio" aria-checked="' + on + '" class="ch-seg__btn' + (on ? ' is-on' : '') + '" data-sys="' + k + '">' + SYS[k].label + '</button>';
        }).join('');
    }
    function renderGrade() {
        var f = $('chGradeField'), gb = gbAverage(), ib = gbIB(), u = cur();
        var gbBtn = ib != null ? '<button type="button" class="ch-gb" data-gb="ib"><i class="fa-solid fa-book-open" aria-hidden="true"></i> Use my Gradebook: IB ' + ib + ' from 6 subjects <small>+ up to 3 core points</small></button>'
            : gb != null ? '<button type="button" class="ch-gb" data-gb="1"><i class="fa-solid fa-book-open" aria-hidden="true"></i> Use my gradebook average (' + Math.round(gb) + '%)</button>' : '';
        if (S.sys === 'alevels') {
            if (!alValid()) { var g0 = nearestGrade(S.val == null || isNaN(+S.val) ? 90 : +S.val); S.al = [g0, g0, g0]; }
            var avg = alAvg(S.al), z = u ? zoneOf(chance(u, avg)) : '';
            // three keycaps, best first — tap one for a grade tray, or use ↑ / ↓ on it
            f.innerHTML = '<span class="ch-label">Your best three A-levels <small>tap a grade to change it</small></span><div class="ch-al3' + (z ? ' ch-z--' + z : '') + '">' +
                [0, 1, 2].map(function (i) {
                    return '<div class="ch-al3__slot"><button type="button" class="ch-kc' + (S.al[i] === 'A*' ? ' is-star' : '') + '" data-alk="' + i + '" aria-haspopup="listbox" aria-expanded="false" aria-label="A-level ' + (i + 1) + ': ' + S.al[i] + '. Change grade"><b>' + esc(S.al[i]) + '</b></button></div>';
                }).join('') + '<span class="ch-al3__zone" aria-live="polite">' + (z ? '<i></i><b>' + ZONES[z].label + '</b>' : '') + '</span></div>' + gbBtn;
            return;
        }
        var sy = SYS[S.sys], v = S.val == null ? '' : S.val;
        f.innerHTML =
            '<label class="ch-label" for="chGrade">Your grade <small>' + (S.sys === 'pct' ? '0–100' : S.sys === 'gpa' ? '0.0–4.0' : '1–45') + '</small></label>' +
            '<div class="ch-grade"><input id="chGrade" class="ch-grade__num" type="number" inputmode="decimal" min="' + sy.min + '" max="' + sy.max + '" step="' + sy.step + '" value="' + esc(v) + '" placeholder="' + (S.sys === 'gpa' ? 'e.g. 3.5' : S.sys === 'ib' ? 'e.g. 38' : 'e.g. 82') + '">' +
                '<div class="ch-range" id="chRange">' +
                    '<div class="ch-range__zones" id="chZones" aria-hidden="true"></div>' +
                    '<input id="chSlider" type="range" min="' + sy.min + '" max="' + sy.max + '" step="' + sy.step + '" value="' + esc(v === '' ? (sy.min + sy.max) / 2 : v) + '" aria-label="Your grade"' + (v === '' ? ' class="is-empty"' : '') + '>' +
                '</div></div>' + gbBtn;
        paintZones();
    }
    // Colour the slider track where the chosen university would be Reach / Match / Safety.
    function paintZones() {
        var z = $('chZones'), u = cur();
        if (!z || S.sys === 'alevels') return;
        var sy = SYS[S.sys], span = sy.max - sy.min;
        if (!u) { z.innerHTML = ''; z.style.background = ''; return; }
        var m = clamp(needIn(S.sys, gradeFor(u, 40)), sy.min, sy.max), s = clamp(needIn(S.sys, gradeFor(u, 70)), sy.min, sy.max);
        var pm = (m - sy.min) / span * 100, ps = (s - sy.min) / span * 100, close = ps - pm < 24;
        z.style.background = 'linear-gradient(90deg, var(--ch-reach) 0 ' + pm + '%, var(--ch-match) ' + pm + '% ' + ps + '%, var(--ch-safe) ' + ps + '% 100%)';
        // A tick where each zone starts; labels sit over their tick, or share one
        // label when the ticks are close — always kept inside the track.
        var txt = function (v) { return S.sys === 'gpa' ? v.toFixed(2) : v + (S.sys === 'pct' ? '%' : ''); };
        var showM = pm > 0.5 && pm < 99.5, showS = ps > 0.5 && ps < 99.5;
        var place = function (p) { return 'left:' + p.toFixed(1) + '%;transform:translateX(-50%)" data-c="' + p.toFixed(2); };
        var html = (showM ? '<i class="ch-ztick ch-ztick--m" style="left:' + pm.toFixed(1) + '%"></i>' : '') + (showS ? '<i class="ch-ztick ch-ztick--s" style="left:' + ps.toFixed(1) + '%"></i>' : '');
        var mL = showM ? '<b class="ch-zlab--m">Match ' + txt(m) + '</b>' : '', sL = showS ? '<b class="ch-zlab--s">Safety ' + txt(s) + '</b>' : '';
        if (close && showM && showS) html += '<span class="ch-zlabs" style="' + place((pm + ps) / 2) + '">' + mL + sL + '</span>';
        else html += (showM ? '<span class="ch-zlabs" style="' + place(pm) + '">' + mL + '</span>' : '') + (showS ? '<span class="ch-zlabs" style="' + place(ps) + '">' + sL + '</span>' : '');
        z.innerHTML = html;
        clampLabels();
    }
    // Keep the zone labels inside the track (measured, so any label length fits).
    function clampLabels() {
        var z = $('chZones'); if (!z) return;
        var W = z.offsetWidth; if (!W) return;
        z.querySelectorAll('.ch-zlabs').forEach(function (l) {
            var w = l.offsetWidth, c = parseFloat(l.getAttribute('data-c')) / 100 * W;
            l.style.transform = 'none';
            l.style.left = clamp(c - w / 2, 0, Math.max(0, W - w)).toFixed(1) + 'px';
        });
    }
    window.addEventListener('resize', function () { if (root.style.display !== 'none') clampLabels(); });

    /* ── Gauge ─────────────────────────────────────────────────────── */
    var shownProb = 0, numRaf = 0;
    function arc(cls, from, to) { return '<path class="' + cls + '" d="M 20 120 A 100 100 0 0 1 220 120" pathLength="100" style="stroke-dasharray:' + Math.max(0, to - from) + ' 200;stroke-dashoffset:' + (-from) + '"/>'; }
    function meterShell() {
        $('chMeter').innerHTML =
            '<div class="ch-gauge">' +
                '<svg viewBox="0 0 240 132" aria-hidden="true">' +
                    arc('ch-g__z ch-g__z--r', 0, 39.4) + arc('ch-g__z ch-g__z--m', 40.6, 69.4) + arc('ch-g__z ch-g__z--s', 70.6, 100) +
                    '<path class="ch-g__fill" id="chFill" d="M 20 120 A 100 100 0 0 1 220 120" pathLength="100"/>' +
                    '<g class="ch-g__ticks">' + [0, 25, 50, 75, 100].map(function (t) { var a = Math.PI * (1 - t / 100); return '<line x1="' + (120 + 84 * Math.cos(a)).toFixed(1) + '" y1="' + (120 - 84 * Math.sin(a)).toFixed(1) + '" x2="' + (120 + 78 * Math.cos(a)).toFixed(1) + '" y2="' + (120 - 78 * Math.sin(a)).toFixed(1) + '"/>'; }).join('') + '</g>' +
                    '<g class="ch-g__needle" id="chNeedle"><line x1="120" y1="120" x2="120" y2="34"/><circle cx="120" cy="120" r="9"/><circle class="ch-g__hub" cx="120" cy="120" r="3.5"/></g>' +
                '</svg>' +
                '<div class="ch-g__read"><b id="chNum">0</b><span>%</span></div>' +
                '<div class="ch-g__scale" aria-hidden="true"><span>0</span><span>100</span></div>' +
            '</div>' +
            '<div class="ch-meter__body" id="chMeterBody"></div>';
    }
    function setNeedle(p, live) {
        var n = $('chNeedle'), f = $('chFill');
        if (!n) return;
        $('chMeter').classList.toggle('is-live', !!live);
        n.style.transform = 'rotate(' + (-90 + p * 1.8).toFixed(1) + 'deg)';
        f.style.strokeDasharray = p + ' 200';
        f.style.stroke = p == null ? 'transparent' : ZONES[zoneOf(p)].color;
        countTo(p, live);
    }
    function countTo(p, live) {
        var el = $('chNum'); if (!el) return;
        cancelAnimationFrame(numRaf);
        if (REDUCED || live) { shownProb = p; el.textContent = p; return; }
        var from = shownProb, t0 = null;
        numRaf = requestAnimationFrame(function step(ts) {
            if (t0 === null) t0 = ts;
            var k = Math.min(1, (ts - t0) / 900), e = 1 - Math.pow(1 - k, 3);
            shownProb = Math.round(from + (p - from) * e); el.textContent = shownProb;
            if (k < 1) numRaf = requestAnimationFrame(step);
        });
    }
    var VERDICT = {
        safety: 'Strong odds. Your grade sits comfortably above the line for a university this selective.',
        match: 'A realistic shot. Grades put you close to the line, so the rest of your application decides it.',
        reach: 'A long shot on grades alone. Worth applying if you love it — just don’t make it your only choice.'
    };
    function renderMeter(live) {
        var u = cur(), g = gradePct(), body = $('chMeterBody');
        if (!live && $('chGuideT')) $('chGuideT').textContent = u ? 'What gets you into ' + (u.abbr && u.abbr.length <= 14 ? u.abbr : u.name) : 'What gets you in';
        if (!live) try { document.dispatchEvent(new CustomEvent('chances:state', { detail: { uni: u || null, cc: S.cc, pct: g, degree: S.degree, sys: S.sys, val: S.val, field: S.field } })); } catch (e) {}   // outcomes.js listens
        if (!$('chNeedle')) { meterShell(); body = $('chMeterBody'); }
        $('chMeter').classList.toggle('is-empty', !(u && g != null));
        if (!u || g == null) {
            setNeedle(0, true);
            $('chNum').textContent = '\u2013';
            body.innerHTML = '<p class="ch-meter__hint">' + (!u ? 'Pick a university to see your chances.' : 'Add your grade to see your chances.') + '</p>';
            $('chMeter').removeAttribute('data-zone');
            return;
        }
        var p = chance(u, g), z = zoneOf(p), sy = SYS[S.sys], saved = (call(getSaved, []) || []).indexOf(u.id) !== -1;
        setNeedle(p, live);
        $('chMeter').setAttribute('data-zone', z);
        var next = z === 'reach' ? 40 : z === 'match' ? 70 : null, move = '';
        if (next) {
            var need = gradeFor(u, next), label = next === 70 ? 'Safety' : 'Match';
            if (need > 100.01) move = 'Even full marks won’t make this a ' + label + ' — it’s that selective.';
            else if (S.sys === 'alevels') { var ag = SYS.alevels.grades.filter(function (x) { return x[1] >= need - .01; }).pop(); move = ag ? '<b>' + ag[0] + ag[0] + ag[0] + '</b> would make this a ' + label + '.' : ''; }
            else { var target = needIn(S.sys, need), gap = target - (+S.val); move = '<b>+' + (S.sys === 'gpa' ? Math.max(.01, gap).toFixed(2) : Math.max(1, Math.round(gap))) + (S.sys === 'pct' ? ' points' : S.sys === 'gpa' ? ' GPA' : ' IB points') + '</b> (' + (S.sys === 'gpa' ? target.toFixed(2) : target + (S.sys === 'pct' ? '%' : '')) + ') would make this a ' + label + '.'; }
        } else move = 'You’re in the Safety zone here.';
        body.innerHTML =
            '<p class="ch-meter__zone"><span class="ch-chip ch-chip--' + z + '">' + ZONES[z].label + '</span><span class="ch-meter__uni">' + esc(u.name) + '</span></p>' +
            '<p class="ch-meter__txt">' + VERDICT[z] + '</p>' +
            '<p class="ch-meter__move">' + move + '</p>' +
            '<p class="ch-meter__data" id="chMeterData" aria-live="polite"></p>' +
            '<div class="ch-meter__acts">' +
                '<button type="button" class="ch-btn ch-btn--cream" data-act="insight"><i class="fa-regular fa-bookmark" aria-hidden="true"></i> Save to Overview</button>' +
                '<button type="button" class="ch-btn' + (saved ? ' is-on' : '') + '" data-act="save" aria-pressed="' + saved + '"><i class="fa-' + (saved ? 'solid' : 'regular') + ' fa-star" aria-hidden="true"></i> ' + (saved ? 'On my list' : 'Add to my list') + '</button>' +
                '<button type="button" class="ch-btn" data-act="apply">Apply <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>' +
            '</div>' +
            '<details class="ch-how"><summary>How is this worked out?</summary><p>This number is an <b>estimate</b> from how selective ' + esc(u.name) + ' is in our data (' + (u.diff || 3) + ' out of 5' + (u.dl ? ', “' + esc(u.dl.toLowerCase()) + '”' : '') + ') — not an official probability. Reach is under 40%, Match 40–69%, Safety 70% and up. It can’t see essays, interviews, test scores or course quotas. The line above it compares you with real applicants in the same qualification, when we have enough of them.</p></details>';
    }

    /* ── Your list: saved universities in Reach / Match / Safety ───── */
    var boardSig = '';
    function renderBoard() {
        var el = $('chBoard'), saved = call(getSaved, []) || [], g = gradePct();
        var unis = saved.map(function (id) { return findUni(id); }).filter(Boolean);
        var head = '<header class="ch-sec__hd"><div><p class="ch-kicker ch-kicker--ink">Your list</p><h3 class="ch-sec__title" id="chBoardTitle">Reach, match &amp; safety</h3></div>';
        if (!unis.length) {
            boardSig = '';
            el.innerHTML = head + '</header><div class="ch-empty"><p>Save universities in Explore and they’ll sort themselves here by your chances.</p><button type="button" class="ch-btn ch-btn--ink" data-act="explore">Browse universities</button></div>';
            return;
        }
        if (g == null) {
            boardSig = '';
            el.innerHTML = head + '</header><div class="ch-empty"><p>Add your grade above and your ' + unis.length + ' saved universit' + (unis.length === 1 ? 'y' : 'ies') + ' will sort into Reach, Match and Safety.</p></div>';
            return;
        }
        var cols = { reach: [], match: [], safety: [] };
        unis.forEach(function (u) { var p = chance(u, g); cols[zoneOf(p)].push({ u: u, p: p }); });
        Object.keys(cols).forEach(function (k) { cols[k].sort(function (a, b) { return b.p - a.p; }); });
        var sig = ['reach', 'match', 'safety'].map(function (k) { return cols[k].map(function (x) { return x.u.id; }).join(','); }).join('|');
        if (sig === boardSig && el.querySelector('.ch-cols')) {   // same columns → just update the numbers
            ['reach', 'match', 'safety'].forEach(function (k) { cols[k].forEach(function (x) { var c = el.querySelector('[data-uni="' + x.u.id + '"]'); if (c) { c.querySelector('.ch-card__p b').textContent = x.p; c.style.setProperty('--p', x.p); } }); });
            el.querySelector('.ch-balance').innerHTML = balance(cols);
            return;
        }
        var first = {};
        el.querySelectorAll('.ch-card[data-uni]').forEach(function (c) { first[c.getAttribute('data-uni')] = c.getBoundingClientRect(); });
        boardSig = sig;
        el.innerHTML = head + '<p class="ch-balance">' + balance(cols) + '</p></header>' +
            '<div class="ch-cols">' + ['reach', 'match', 'safety'].map(function (k) {
                return '<div class="ch-col ch-col--' + k + '"><h4 class="ch-col__hd"><span class="ch-chip ch-chip--' + k + '">' + ZONES[k].label + '</span><small>' + cols[k].length + '</small></h4>' +
                    '<div class="ch-col__list">' + (cols[k].length ? cols[k].map(function (x) { return card(x.u, x.p); }).join('') : '<p class="ch-col__none">' + (k === 'safety' ? 'No safety yet' : k === 'match' ? 'No match yet' : 'None') + '</p>') + '</div></div>';
            }).join('') + '</div>';
        hydrate(el);
        if (REDUCED) return;
        el.querySelectorAll('.ch-card[data-uni]').forEach(function (c) {   // FLIP: glide from the old spot
            var a = first[c.getAttribute('data-uni')];
            if (!a) return;
            var b = c.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
            c.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 560, easing: 'cubic-bezier(.34,1.3,.64,1)' });
        });
    }
    function card(u, p) {
        return '<button type="button" class="ch-card' + (u.id === S.uniId ? ' is-sel' : '') + '" data-uni="' + esc(u.id) + '" data-cc="' + esc(u.cc || '') + '" style="--p:' + p + '">' +
            '<span class="ch-card__logo">' + logo(u, 30) + '</span>' +
            '<span class="ch-card__txt"><b>' + esc(u.name) + '</b><small>' + esc([u.city, u.cc && u.cc !== curCC() ? countryName(u.cc) : ''].filter(Boolean).join(' · ') || (u.dl || '')) + '</small></span>' +
            '<span class="ch-card__p"><b>' + p + '</b>%</span><span class="ch-card__bar" aria-hidden="true"></span></button>';
    }
    function balance(cols) {
        var r = cols.reach.length, m = cols.match.length, s = cols.safety.length, tip;
        if (!s) tip = 'Add at least one safety — somewhere you’d be happy that’s very likely to say yes.';
        else if (!m) tip = 'Add a couple of matches between your reaches and safeties.';
        else if (r + m + s < 4) tip = 'Most students apply to four to eight places. A few more would give you options.';
        else tip = 'Nicely balanced — a mix of reaches, matches and at least one safety.';
        return '<span>' + r + ' reach · ' + m + ' match · ' + s + ' safety.</span> ' + tip;
    }

    /* ── Similar universities with better odds ─────────────────────── */
    function renderAlt() {
        var el = $('chAlt'), u = cur(), g = gradePct();
        if (!u || g == null) { el.hidden = true; return; }
        var p0 = chance(u, g), fields = (u.fields || []).map(norm), saved = call(getSaved, []) || [];
        var pool = unisOf(u.cc || curCC()).filter(function (x) { return x.id !== u.id; }).map(function (x) {
            var overlap = (x.fields || []).filter(function (f) { return fields.indexOf(norm(f)) !== -1; }).length;
            return { u: x, p: chance(x, g), o: overlap };
        }).filter(function (x) { return x.p > p0 && (x.o > 0 || !fields.length); })
          .sort(function (a, b) { return (zoneOf(b.p) === 'match' ? 1 : 0) - (zoneOf(a.p) === 'match' ? 1 : 0) || b.o - a.o || b.u.diff - a.u.diff || b.p - a.p; }).slice(0, 4);
        if (!pool.length) { el.hidden = true; return; }
        el.hidden = false;
        el.innerHTML = '<header class="ch-sec__hd"><div><p class="ch-kicker ch-kicker--ink">Worth a look</p><h3 class="ch-sec__title">Similar, with better odds</h3></div><p class="ch-balance">Same subjects as ' + esc(u.name) + ', in ' + esc(countryName(u.cc || curCC())) + ', where your grade goes further.</p></header>' +
            '<div class="ch-alts">' + pool.map(function (x, i) {
                var z = zoneOf(x.p), on = saved.indexOf(x.u.id) !== -1;
                return '<article class="ch-alt__card" style="--i:' + i + '">' +
                    '<div class="ch-alt__top"><span class="ch-alt__logo">' + logo(x.u, 36) + '</span><span class="ch-chip ch-chip--' + z + '">' + ZONES[z].label + '</span></div>' +
                    '<h4>' + esc(x.u.name) + '</h4><p>' + esc([x.u.city, x.u.type].filter(Boolean).join(' · ')) + '</p>' +
                    '<div class="ch-alt__p"><b>' + x.p + '<small>%</small></b><span>vs ' + p0 + '% at ' + esc(u.abbr || u.name) + '</span></div>' +
                    '<div class="ch-alt__acts"><button type="button" class="ch-btn ch-btn--ink ch-btn--sm" data-uni="' + esc(x.u.id) + '" data-cc="' + esc(x.u.cc || u.cc || '') + '">Check it</button>' +
                    '<button type="button" class="ch-icon' + (on ? ' is-on' : '') + '" data-act="save" data-id="' + esc(x.u.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Remove from my list' : 'Add to my list') + '"><i class="fa-' + (on ? 'solid' : 'regular') + ' fa-star" aria-hidden="true"></i></button></div>' +
                '</article>';
            }).join('') + '</div>';
        hydrate(el);
    }

    /* ── What it pays and costs ────────────────────────────────────── */
    function selectHtml(id, opts, val, label) {
        return '<label class="ch-sel"><span>' + label + '</span><select id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
    }
    function salaryFor(u, field) {
        var base = (typeof SALARY_DATA !== 'undefined' && SALARY_DATA[u.id]) || ({ 1: { p3: 60, p5: 26, p10: 7, p30: 1 }, 2: { p3: 68, p5: 33, p10: 10, p30: 2 }, 3: { p3: 76, p5: 44, p10: 14, p30: 3 }, 4: { p3: 86, p5: 60, p10: 24, p30: 6 }, 5: { p3: 93, p5: 80, p10: 45, p30: 12 } })[u.diff || 3];
        var b = (typeof FIELD_BONUS !== 'undefined' && FIELD_BONUS[SAL_FIELD[field]]) || { p3: 0, p5: 0, p10: 0, p30: 0 };
        return [['3,000', 'Entry-level professional', cap(base.p3 + b.p3)], ['5,000', 'Senior or specialist', cap(base.p5 + b.p5)], ['10,000', 'Executive, high earner', cap(base.p10 + b.p10)], ['30,000', 'Top 1%', cap(base.p30 + b.p30)]];
    }
    function roiFor(u, field, degree) {
        var years = ({ bachelor: 4, master: 2, phd: 4 })[degree] || 4, cc = u.cc || curCC();
        var cur = typeof currencySymFor === 'function' ? currencySymFor(cc) : '€';
        var withCC = Object.assign({}, u, { country_code: cc });
        var tu = tuitionMidCost(withCC) * years, lv = cityLivingAnnual(withCC) * years, ex = ((typeof COUNTRY_VISA_INS !== 'undefined' && COUNTRY_VISA_INS[cc]) || 1000) * years;
        var gross = tu + lv + ex, rate = estScholarshipRate(withCC), sch = Math.round(tu * rate), net = gross - sch;
        var sal = estStartingSalary(withCC, field), pay = sal > 0 ? net / sal : 0, ten = Math.round(sal * 0.35 * 10 - net);
        return { years: years, cur: cur, tu: tu, lv: lv, ex: ex, gross: gross, rate: rate, sch: sch, net: net, sal: sal, pay: pay, ten: ten,
            verdict: pay < 2 ? ['fast', 'Excellent value'] : pay < 3.5 ? ['good', 'Good value'] : pay < 5.5 ? ['mid', 'Moderate value'] : ['slow', 'Slow to pay off'] };
    }
    function money(cur, n) { return cur + Math.round(n).toLocaleString('en-GB'); }
    function renderMoney() {
        var el = $('chMoney'), u = cur();
        var head = '<header class="ch-sec__hd"><div><p class="ch-kicker ch-kicker--ink">After you graduate</p><h3 class="ch-sec__title" id="chMoneyTitle">What it costs, what it pays</h3></div>' +
            (u ? '<div class="ch-sels">' + selectHtml('chField', FIELDS, S.field, 'Field') + selectHtml('chDegree', DEGREES, S.degree, 'Degree') + '</div>' : '') + '</header>';
        if (!u) { el.innerHTML = head + '<div class="ch-empty"><p>Pick a university above to see graduate salaries and the true cost of the degree.</p></div>'; return; }
        var sal = salaryFor(u, S.field), r = roiFor(u, S.field, S.degree), pct = function (n) { return (r.gross ? n / r.gross * 100 : 0).toFixed(1) + '%'; };
        var payPos = clamp(r.pay / 10 * 100, 0, 100);
        el.innerHTML = head +
            '<div class="ch-money__grid">' +
                '<article class="ch-panel ch-panel--sal">' +
                    '<h4 class="ch-panel__t">Chance of earning more than…</h4>' +
                    '<ol class="ch-sal">' + sal.map(function (b, i) {
                        var tone = b[2] >= 75 ? 'hi' : b[2] >= 45 ? 'mid' : b[2] >= 20 ? 'lo' : 'rare';
                        return '<li class="ch-sal--' + tone + '" style="--w:' + b[2] + '%;--i:' + i + '"><div class="ch-sal__row"><span><b>€' + b[0] + '</b> a month<small>' + b[1] + '</small></span><em>' + b[2] + '%</em></div><span class="ch-sal__bar"><i></i></span></li>';
                    }).join('') + '</ol>' +
                    '<p class="ch-panel__src">From graduate outcome surveys (INE, HESA, AlmaLaurea, CEREQ, DAAD, 2023) where we have them; otherwise estimated from how selective the university is.</p>' +
                '</article>' +
                '<article class="ch-panel ch-panel--roi ch-roi--' + r.verdict[0] + '">' +
                    '<h4 class="ch-panel__t">Pays for itself in</h4>' +
                    '<div class="ch-roi__big"><b>' + r.pay.toFixed(1) + '</b><span>years<small>' + r.verdict[1] + '</small></span></div>' +
                    '<div class="ch-track" aria-hidden="true"><span class="ch-track__fill" style="width:' + payPos.toFixed(1) + '%"></span><span class="ch-track__dot" style="left:' + payPos.toFixed(1) + '%"></span>' +
                        [0, 2, 4, 6, 8, 10].map(function (y) { return '<span class="ch-track__y" style="left:' + y * 10 + '%">' + y + (y === 10 ? '+' : '') + '</span>'; }).join('') + '</div>' +
                    '<div class="ch-cost"><div class="ch-cost__bar"><i style="width:' + pct(r.tu) + ';--c:var(--ch-tu)"></i><i style="width:' + pct(r.lv) + ';--c:var(--ch-lv)"></i><i style="width:' + pct(r.ex) + ';--c:var(--ch-ex)"></i></div>' +
                        '<ul class="ch-cost__legend"><li style="--c:var(--ch-tu)">Tuition <b>' + money(r.cur, r.tu) + '</b></li><li style="--c:var(--ch-lv)">Living <b>' + money(r.cur, r.lv) + '</b></li><li style="--c:var(--ch-ex)">Visa &amp; insurance <b>' + money(r.cur, r.ex) + '</b></li></ul></div>' +
                    '<dl class="ch-stats">' +
                        '<div><dt>Net cost, ' + r.years + ' years</dt><dd>' + money(r.cur, r.net) + '</dd></div>' +
                        '<div><dt>Starting salary</dt><dd>' + money(r.cur, r.sal) + '<small>/yr</small></dd></div>' +
                        '<div><dt>Possible scholarships</dt><dd class="is-good">−' + money(r.cur, r.sch) + '<small>~' + Math.round(r.rate * 100) + '% of tuition</small></dd></div>' +
                        '<div><dt>After 10 years</dt><dd class="' + (r.ten >= 0 ? 'is-good' : 'is-bad') + '">' + (r.ten >= 0 ? '+' : '−') + money(r.cur, Math.abs(r.ten)) + '</dd></div>' +
                    '</dl>' +
                    '<p class="ch-panel__src">Tuition and living costs are real data; salary, scholarships and visa costs are estimates. Payback = net cost ÷ starting salary.</p>' +
                '</article>' +
            '</div>';
    }

    /* ── Render ────────────────────────────────────────────────────── */
    function renderAll(fresh) {
        syncPicker();
        renderQuick();
        renderSys();
        renderGrade();
        renderMeter(false);
        renderBoard();
        renderAlt();
        renderMoney();
        if (fresh) reveal();
    }
    // Light, per-drag update (no rebuild of the controls).
    var liveRaf = 0;
    function liveUpdate() {
        if (liveRaf) return;
        liveRaf = requestAnimationFrame(function () {
            liveRaf = 0;
            renderMeter(true);
            renderBoard();
        });
    }
    var settleT = 0;
    function settle() {
        clearTimeout(settleT);
        settleT = setTimeout(function () { save(); renderMeter(false); renderAlt(); if (S.sys === 'alevels') renderGrade(); }, 220);
    }

    /* ── Events ────────────────────────────────────────────────────── */
    root.addEventListener('input', function (e) {
        var t = e.target;
        if (t.id === 'chSlider') {
            t.classList.remove('is-empty');
            S.val = S.sys === 'gpa' ? +(+t.value).toFixed(2) : +t.value;
            var num = $('chGrade'); if (num) num.value = S.val;
            liveUpdate(); settle();
        } else if (t.id === 'chGrade') {
            var v = t.value === '' ? null : +t.value, sy = SYS[S.sys];
            S.val = v == null || isNaN(v) ? null : clamp(v, sy.min, sy.max);
            var sl = $('chSlider'); if (sl && S.val != null) { sl.value = S.val; sl.classList.remove('is-empty'); }
            liveUpdate(); settle();
        }
    });
    root.addEventListener('change', function (e) {
        if (e.target.id === 'chField') { S.field = e.target.value; save(); renderMoney(); }
        if (e.target.id === 'chDegree') { S.degree = e.target.value; save(); renderMoney(); }
        if (e.target.id === 'chSlider' || e.target.id === 'chGrade') { save(); renderMeter(false); renderAlt(); }
    });
    function alSet(i, g) {   // set one A-level, keep them best-first, flip the key that moved
        S.al = S.al.slice(); S.al[i] = g;
        S.al.sort(function (a, b) { return AL_PCT[b] - AL_PCT[a]; });
        S.val = Math.round(alAvg(S.al));
        save(); renderGrade(); renderMeter(false); renderBoard(); renderAlt();
        var k = root.querySelector('[data-alk="' + S.al.indexOf(g) + '"]');
        if (k) { k.focus({ preventScroll: true }); if (!REDUCED) k.classList.add('is-flip'); }
    }
    function alTrayClose() { var t = root.querySelector('.ch-kt'); if (t) { var b = root.querySelector('[data-alk][aria-expanded="true"]'); if (b) b.setAttribute('aria-expanded', 'false'); t.remove(); } }
    function alTray(btn) {
        alTrayClose();
        var i = +btn.getAttribute('data-alk'), t = document.createElement('div');
        t.className = 'ch-kt'; t.setAttribute('role', 'listbox'); t.setAttribute('aria-label', 'Pick a grade');
        t.innerHTML = SYS.alevels.grades.map(function (g) { return '<button type="button" role="option" aria-selected="' + (g[0] === S.al[i]) + '" class="' + (g[0] === S.al[i] ? 'is-on' : '') + '" data-alpick="' + g[0] + '" data-alslot="' + i + '">' + g[0] + '</button>'; }).join('');
        btn.parentNode.appendChild(t); btn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(function () { t.classList.add('is-in'); (t.querySelector('.is-on') || t.firstChild).focus({ preventScroll: true }); });
    }
    root.addEventListener('keydown', function (e) {
        var k = e.target.closest && e.target.closest('[data-alk]');
        if (k && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault(); alTrayClose();
            var i = +k.getAttribute('data-alk'), order = SYS.alevels.grades.map(function (g) { return g[0]; }), at = order.indexOf(S.al[i]);
            alSet(i, order[clamp(at + (e.key === 'ArrowUp' ? -1 : 1), 0, order.length - 1)]);
        }
        var tb = e.target.closest && e.target.closest('.ch-kt button');
        if (tb && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); var bs = [].slice.call(tb.parentNode.children), n = bs.indexOf(tb); bs[clamp(n + (e.key === 'ArrowRight' ? 1 : -1), 0, bs.length - 1)].focus(); }
        if (e.key === 'Escape' && root.querySelector('.ch-kt')) { var ob = root.querySelector('[data-alk][aria-expanded="true"]'); alTrayClose(); if (ob) ob.focus(); }
    });
    document.addEventListener('click', function (e) { if (!e.target.closest('.ch-kt') && !e.target.closest('[data-alk]')) alTrayClose(); });
    root.addEventListener('click', function (e) {
        var ak = e.target.closest('[data-alk]');
        if (ak) { if (ak.getAttribute('aria-expanded') === 'true') alTrayClose(); else alTray(ak); return; }
        var ap = e.target.closest('[data-alpick]');
        if (ap) { var slot = +ap.getAttribute('data-alslot'); alTrayClose(); alSet(slot, ap.getAttribute('data-alpick')); return; }
        if (e.target.closest('#chGuide')) {   // admitGuide.js: what gets you in + degree → job → salary
            var gu = cur();
            if (typeof window.openAdmitGuide === 'function') window.openAdmitGuide({ uni: gu ? { cc: gu.cc || S.cc, id: gu.id, name: gu.name, abbr: gu.abbr, city: gu.city, color: gu.color, website: gu.website, diff: gu.diff, fields: gu.fields } : null,
                cc: (gu && gu.cc) || S.cc || curCC(), field: S.field, degree: S.degree, grade: { sys: S.sys, val: S.val, al: S.al, label: gradeLabel() } });
            return;
        }
        var t = e.target.closest('[data-sys],[data-gb],[data-uni],[data-act]');
        if (!t || !root.contains(t)) return;
        if (t.hasAttribute('data-sys')) {
            var k = t.getAttribute('data-sys'); if (k === S.sys) return;
            var p = gradePct();
            S.sys = k;
            if (p == null) { S.val = null; if (k === 'alevels') S.al = null; }
            else if (k === 'alevels') { var ng = nearestGrade(p); S.al = [ng, ng, ng]; S.val = AL_PCT[ng]; }
            else S.val = k === 'gpa' ? +SYS.gpa.from(p).toFixed(2) : Math.round(SYS[k].from(p));
            save(); renderSys(); renderGrade(); renderMeter(false); renderBoard(); renderAlt();
            return;
        }
        if (t.hasAttribute('data-gb')) {
            if (t.getAttribute('data-gb') === 'ib') { var ibv = gbIB(); if (ibv == null) return; S.sys = 'ib'; S.val = ibv; }
            else { var gb = gbAverage(); if (gb == null) return; S.sys = 'pct'; S.val = Math.round(gb); }
            save(); renderSys(); renderGrade(); renderMeter(false); renderBoard(); renderAlt();
            return;
        }
        if (t.hasAttribute('data-uni')) {
            choose(t.getAttribute('data-uni'), t.getAttribute('data-cc'));
            if (!t.closest('#chHero')) $('chHero').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
            return;
        }
        var act = t.getAttribute('data-act');
        if (act === 'explore') { if (typeof showTab === 'function') showTab('explore'); return; }
        if (act === 'save') {
            var id = t.getAttribute('data-id') || S.uniId, saved = call(getSaved, []) || [], i = saved.indexOf(id);
            if (i === -1) saved.push(id); else saved.splice(i, 1);
            setSaved(saved);
            ['renderSaved', 'updateStats'].forEach(function (f) { if (typeof window[f] === 'function') call(window[f]); });
            if (typeof window.renderChecklists === 'function') call(window.renderChecklists);
            renderQuick(); renderMeter(false); renderBoard(); renderAlt();
            return;
        }
        if (act === 'apply') {   // start an application on the Apply page for this university
            var au = cur();
            if (au && window.UniApply) window.UniApply.add({ cc: au.cc || S.cc, id: au.id });
            else if (typeof showTab === 'function') showTab('compare');
            return;
        }
        if (act === 'insight') {
            var u = cur(), g = gradePct(); if (!u || g == null) return;
            var pr = chance(u, g), z = zoneOf(pr);
            if (typeof getInsightSaves === 'function' && typeof setInsightSaves === 'function') {
                var list = getInsightSaves().filter(function (s) { return s.uniId !== u.id; });
                list.unshift({ uniId: u.id, name: u.name, color: u.color, prob: pr, verdict: ZONES[z].label, verdictColor: ZONES[z].ink, grade: gradeLabel() });
                setInsightSaves(list);
                window.heroInsightIdx = 0;
                if (typeof updateHeroInsight === 'function') call(updateHeroInsight);
            }
            t.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Saved to Overview';
            t.disabled = true;
        }
    });
    document.addEventListener('mousedown', function (e) { if (!listEl.hidden && !e.target.closest('#chPick')) hideList(); });

    /* Sections fade up the first time they scroll into view. */
    var io = 'IntersectionObserver' in window && !REDUCED ? new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -8% 0px' }) : null;
    function reveal() {
        root.querySelectorAll('.ch-sec, .ch-foot').forEach(function (s) { if (io && !s.classList.contains('is-in')) io.observe(s); else s.classList.add('is-in'); });
    }

    /* Grades changed in the Gradebook → refresh the "use my average" button. */
    var prevRefresh = window.refreshChanceBadges;
    window.refreshChanceBadges = function () { if (typeof prevRefresh === 'function') call(prevRefresh); if (root.style.display !== 'none') renderGrade(); };

    // First render when the tab is shown; re-render on each visit (saved list may have changed).
    var shownOnce = false;
    function onShow() {
        if (!S.uniId) {   // start with the first saved university, if any
            var sv = (call(getSaved, []) || []).map(function (id) { return findUni(id); }).filter(Boolean);
            if (sv.length) { S.uniId = sv[0].id; S.cc = sv[0].cc || null; }
        }
        if (S.val == null && gbIB() != null) { S.sys = 'ib'; S.val = gbIB(); }
        else if (S.val == null && gbAverage() != null) { S.sys = 'pct'; S.val = Math.round(gbAverage()); }
        if (!shownOnce) { shownOnce = true; root.classList.add('ch-first'); setTimeout(function () { root.classList.remove('ch-first'); }, 1600); }
        buildIndex(function () { renderAll(false); if (!listEl.hidden) showList(); });
        // Swing the needle up from zero on every visit.
        var nd = $('chNeedle');
        if (nd && !REDUCED) { $('chMeter').classList.add('no-anim'); setNeedle(0, true); void nd.getBoundingClientRect(); $('chMeter').classList.remove('no-anim'); }
        shownProb = 0;
        renderAll(true);
        requestAnimationFrame(clampLabels);
    }
    var lastDisp = root.style.display;
    new MutationObserver(function () {
        var d = root.style.display;
        if (d === lastDisp) return;
        lastDisp = d;
        if (d !== 'none') onShow(); else hideList();
    }).observe(root, { attributes: true, attributeFilter: ['style'] });
    if (root.style.display !== 'none') onShow();
    window.chancesRefresh = function () { if (root.style.display !== 'none') renderAll(false); };
})();
