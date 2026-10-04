/* ════════════════════════════════════════════════════════════════════
   Made for you — the Elite matcher, rebuilt (styles: madeForYou.css).

   What changed from the old matcher, and why:
   · Subjects are matched through a real taxonomy onto the dataset's field
     names (CS, Engineering, Health Sciences…). The old substring test made
     "Computer Science" match every university that lists "Science".
   · Cost is one comparable number: € a year, tuition + that city's living
     costs, in the right currency (£, $, CHF, DKK, SEK, ₴ were all read as
     euros before), with EU vs non-EU fees ("Free (EU)", UK international).
   · Admission uses your grade against the university's entry bar with the
     same Safety / Match / Reach bands as the Chances page — and when you
     haven't given a grade it simply isn't counted (it used to assume 70%).
   · Only what you actually tell it is scored, and the weights always add to
     100% — no free points for being in a saved country, no ties at 99%.
   · "World ranking" is gone: the data only has national order, so it was
     comparing a UK #10 with a world top-10.
   · Everything re-ranks instantly as you change an answer (hundreds of
     universities in a few ms); the AI is an optional second opinion now,
     not a 20-second wait in front of every result.
   Mounted by applyExploreMatcherLayout() for Elite accounts via
   window.mfyMount(el). window.fyScoreUni is upgraded so the Gradebook's
   realistic options rank with the same engine.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function uid() { try { return (window.user && window.user.id) || 'guest'; } catch (e) { return 'guest'; } }
    function prefsKey() { return 'us_mfy_prefs_' + uid(); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function cc() { try { return String(currentCountryCode || 'gb').toLowerCase(); } catch (e) { return 'gb'; } }
    function cname(code) { try { return countryNameByCode(code); } catch (e) { return code.toUpperCase(); } }

    /* ── Subjects → the dataset's field names (with partial credit) ── */
    var SUBJECTS = {
        'Computer Science': { cs: 1, engineering: .45, mathematics: .5 },
        'Engineering': { engineering: 1, 'mechanical engineering': 1, cs: .4, architecture: .3 },
        'Medicine & Health': { medicine: 1, 'health sciences': .9, dentistry: .9, nursing: .8, pharmacy: .8, veterinary: .6, biology: .4 },
        'Business': { business: 1, management: 1, marketing: .9, finance: .9, economics: .7, hospitality: .3, tourism: .3 },
        'Economics & Finance': { economics: 1, finance: 1, business: .7, mathematics: .3 },
        'Law': { law: 1, 'international relations': .3, 'political science': .3 },
        'Natural Sciences': { science: 1, biology: 1, physics: 1, chemistry: 1, 'environmental science': .8, ecology: .8, mathematics: .6 },
        'Mathematics': { mathematics: 1, science: .6, cs: .5, physics: .5 },
        'Psychology': { psychology: 1, 'social science': .6, 'health sciences': .35 },
        'Politics & Society': { 'social science': 1, 'political science': 1, 'international relations': 1, 'social work': .7, economics: .4 },
        'Humanities': { humanities: 1, theology: .7, journalism: .3 },
        'Arts & Design': { arts: 1, design: 1, music: .9, architecture: .4 },
        'Architecture': { architecture: 1, design: .5, engineering: .3 },
        'Education': { education: 1 },
        'Media': { communication: 1, journalism: 1, marketing: .5, arts: .3 },
        'Tourism & Hospitality': { tourism: 1, hospitality: 1, business: .3 },
        'Environment & Agriculture': { agriculture: 1, 'environmental science': 1, ecology: 1, veterinary: .6, science: .4 }
    };
    var PRIORITIES = [
        ['prestige', 'Prestige', 'fa-crown'], ['career', 'Career', 'fa-briefcase'], ['afford', 'Low cost', 'fa-piggy-bank'],
        ['research', 'Research', 'fa-flask'], ['social', 'Social life', 'fa-champagne-glasses'], ['safety', 'Safety', 'fa-shield-heart']
    ];

    /* ── Money: everything in € a year ────────────────────────────── */
    var FX = { EUR: 1, GBP: 1.17, USD: .92, CHF: 1.05, DKK: .134, SEK: .088, UAH: .022 };
    var COUNTRY_CUR = { gb: 'GBP', us: 'USD', ch: 'CHF', dk: 'DKK', se: 'SEK', ua: 'UAH' };
    var LIVING_EUR = { es: 900, pt: 800, it: 950, fr: 1100, de: 1050, gb: 1400, ie: 1350, us: 1600, ch: 1900, ua: 600, nl: 1200, be: 1050, dk: 1300, se: 1200, fi: 1100 };
    var EU = { es: 1, pt: 1, it: 1, fr: 1, de: 1, ie: 1, nl: 1, be: 1, dk: 1, se: 1, fi: 1 };
    function curOf(str, code) {
        return /£/.test(str) ? 'GBP' : /\$/.test(str) ? 'USD' : /CHF/.test(str) ? 'CHF' : /DKK/.test(str) ? 'DKK' : /SEK/.test(str) ? 'SEK' : /₴/.test(str) ? 'UAH' : /€/.test(str) ? 'EUR' : (COUNTRY_CUR[code] || 'EUR');
    }
    function nums(str) { return (String(str).replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
    // Yearly tuition in € for this student (EU passport or not). Returns { v, est } — est = estimated.
    function tuitionEUR(u, code, eu) {
        var t = String(u.tuition || '').trim();
        var tier = { 1: 700, 2: 1200, 3: 5000, 4: 15000, 5: 25000 }[u.ts] || 5000;
        if (!t) return { v: tier, est: true };
        if (/no tuition/i.test(t)) return { v: 0, est: false };
        if (/^free\s*\(eu\)/i.test(t)) {
            if (eu && EU[code]) return { v: 0, est: false };
            t = t.split('/').slice(1).join('/');
            if (!t) return { v: tier, est: true };
        }
        if (/^free\s*\(scottish\)/i.test(t)) return { v: Math.round(24000 * FX.GBP), est: true };   // only Scots study free; others pay international fees
        var parts = t.split('·');
        if (parts.length > 1) t = parts[parts.length - 1];                                    // "(Swiss) · (international)" → international
        var n = nums(t).filter(function (x) { return x >= 50; }); if (!n.length) return { v: tier, est: true };
        var lo = Math.min.apply(null, n), hi = Math.max.apply(null, n);
        var pick = (code === 'gb' || code === 'us' || !eu || !EU[code]) ? hi : lo;          // EU students pay home fees only inside the EU
        if (/semester/i.test(t)) pick *= 2;
        return { v: Math.round(pick * (FX[curOf(t, code)] || 1)), est: false };
    }
    function popOf(str) {
        var s = String(str || '').toLowerCase(), n = nums(s)[0] || 0;
        return /million|m\b/.test(s) ? n * 1e6 : /k\b|thousand/.test(s) ? n * 1e3 : n;
    }
    function lifestyle(city) {
        var d = (typeof CG2_DATA !== 'undefined' && CG2_DATA[city]) || null, out = {};
        if (d && d.lifestyle) d.lifestyle.forEach(function (l) { out[l.label] = l.score / 100; });
        return out;
    }
    function livingEUR(city, code, cities) {
        var cur = COUNTRY_CUR[code] || 'EUR', d = (typeof CG2_DATA !== 'undefined' && CG2_DATA[city]) || null;
        if (d && d.accCosts && d.accCosts.shared) return { v: Math.round((d.accCosts.shared + (d.transport || 50) + 330) * 12 * (FX[cur] || 1)), est: false };
        var ci = (cities && cities[city]) || (typeof CITY_INFO !== 'undefined' && CITY_INFO[city]) || null;
        if (ci && ci.cost) { var n = nums(ci.cost); if (n.length) return { v: Math.round(n.reduce(function (a, b) { return a + b; }, 0) / n.length * 12 * (FX[curOf(ci.cost, code)] || 1)), est: false }; }
        return { v: (LIVING_EUR[code] || 1000) * 12, est: true };
    }

    /* ── Loading every chosen country once (cached) ───────────────── */
    var cache = {};
    function loadCountry(code) {
        if (cache[code]) return cache[code];
        cache[code] = fetch('data/' + code + '.json').then(function (r) { return r.json(); }).then(function (d) {
            var list = (d.universities || []).concat(typeof getCustomUnisForCountry === 'function' ? getCustomUnisForCountry(code) : []);
            var rank = (typeof RANKING_DATA !== 'undefined' && RANKING_DATA[code]) || [];
            return { code: code, cities: d.cities || {}, unis: list.map(function (u) { return prep(u, code, d.cities || {}, rank); }) };
        }).catch(function () {
            var list = code === cc() && typeof UNI !== 'undefined' ? UNI : [];
            return { code: code, cities: {}, unis: list.map(function (u) { return prep(u, code, {}, []); }) };
        });
        return cache[code];
    }
    // Everything that doesn't depend on the student is worked out once per university.
    function prep(u, code, cities, rank) {
        var fields = (Array.isArray(u.fields) ? u.fields : []).map(function (f) { return String(f).toLowerCase(); });
        var ci = cities[u.city] || (typeof CITY_INFO !== 'undefined' && CITY_INFO[u.city]) || {};
        var r = rank.indexOf(u.id);
        return { u: u, code: code, fields: fields, langs: (u.langs || []).map(function (l) { return String(l).toLowerCase(); }), diff: +u.diff || 3,
            pop: popOf(ci.pop), students: nums(u.students)[0] || 0, life: lifestyle(u.city), living: livingEUR(u.city, code, cities), nat: r < 0 ? 999 : r + 1 };
    }

    /* ── The score ────────────────────────────────────────────────── */
    function reqGrade(diff) { return { 5: 90, 4: 80, 3: 70, 2: 60, 1: 50 }[diff] || 70; }
    function chance(grade, diff) { return 1 / (1 + Math.exp(-(grade - reqGrade(diff)) / 5)); }
    function band(p) { return p >= .7 ? 'Safety' : p >= .4 ? 'Match' : 'Reach'; }
    function k(v) { return '€' + (v >= 10000 ? Math.round(v / 1000) : Math.round(v / 100) / 10) + 'k'; }
    function score(x, p) {
        var f = [], good = [], warn = [];
        function add(key, label, w, s, note) { f.push({ key: key, label: label, w: w, s: clamp(s, 0, 1), note: note }); }
        // subjects — coverage of what you chose
        if (p.subjects.length) {
            var tot = 0, hits = [];
            p.subjects.forEach(function (sj) {
                var map = SUBJECTS[sj] || {}, best = 0;
                x.fields.forEach(function (fl) { if (map[fl] > best) best = map[fl]; });
                tot += best; if (best >= .9) hits.push(sj);
            });
            var s = tot / p.subjects.length;
            add('subjects', 'Subjects', 30, s, hits.length ? 'Offers ' + hits.slice(0, 2).join(' & ') : s > .3 ? 'Related programmes' : 'Little overlap with your subjects');
            if (hits.length) good.push('Offers ' + hits[0]); else if (s < .3) warn.push('Not really your subjects');
        }
        // admission — your grade vs the entry bar
        if (p.grade) {
            // not "easiest wins": the best fit is a university you can get into that also
            // stretches you — its entry bar a little under your grade (a Match, not a
            // far-below Safety). Long shots still score low through the chance term.
            var c = chance(p.grade, x.diff), b = band(c), level = clamp(1 - Math.abs(p.grade - reqGrade(x.diff) - 5) / 30, 0, 1);
            add('grades', 'Your grades', 20, .6 * c + .4 * level, b + ' · about ' + Math.round(c * 100) + '% chance');
            if (b !== 'Reach') good.push(b + ' for your grades'); else warn.push('Reach for your grades');
        }
        // money — tuition + living, € a year
        var tu = tuitionEUR(x.u, x.code, p.eu), cost = tu.v + x.living.v;
        x.cost = cost; x.tuition = tu.v; x.costEst = tu.est || x.living.est;
        if (p.budget) {
            var sb = cost <= p.budget ? 1 : Math.max(0, 1 - (cost - p.budget) / (p.budget * .5));
            add('budget', 'Budget', 20, sb, k(cost) + ' a year all-in' + (cost <= p.budget ? ' — within budget' : ' — ' + k(cost - p.budget) + ' over'));
            if (cost <= p.budget) good.push(k(cost) + '/yr — within budget'); else warn.push(k(cost - p.budget) + ' over budget');
        }
        // language
        if (p.lang) {
            var want = p.lang === 'local' ? null : p.lang, taught = want ? x.langs.indexOf(want) >= 0 : true;
            add('lang', 'Language', 10, taught ? 1 : 0, taught ? 'Taught in ' + (want ? want[0].toUpperCase() + want.slice(1) : 'the local language') : 'Mainly taught in ' + (x.u.langs && x.u.langs[0] || 'the local language'));
            if (want && taught) good.push(want[0].toUpperCase() + want.slice(1) + '-taught'); else if (!taught) warn.push('Not taught in ' + want[0].toUpperCase() + want.slice(1));
        }
        // city size
        if (p.city) {
            var pop = x.pop || (x.students >= 25000 ? 1.2e6 : x.students >= 12000 ? 5e5 : 2e5);
            var big = pop >= 8e5, small = pop < 3e5, sc = p.city === 'big' ? (big ? 1 : small ? .15 : .55) : (small ? 1 : big ? .15 : .55);
            add('city', 'City', 8, sc, (big ? 'Big city' : small ? 'Smaller town' : 'Mid-sized city') + (x.pop ? ' · ' + (x.pop >= 1e6 ? (Math.round(x.pop / 1e5) / 10) + 'M people' : Math.round(x.pop / 1000) + 'k people') : ''));
            if (sc === 1) good.push(p.city === 'big' ? 'Big city' : 'Smaller town');
        }
        // what matters most
        p.prio.forEach(function (key) {
            var s = .5, note = '';
            if (key === 'prestige') { s = (x.diff - 1) / 4; note = ['', 'Open access', 'Accessible', 'Selective', 'Highly selective', 'Elite selective'][x.diff]; if (x.diff >= 5) good.push('Elite'); }
            else if (key === 'career') { var cc2 = x.life['Career Opportunities']; s = cc2 != null ? .5 * cc2 + .5 * (x.diff - 1) / 4 : (x.diff - 1) / 4; note = cc2 != null ? 'City career score ' + Math.round(cc2 * 100) : 'Based on selectivity'; if (s >= .8) good.push('Strong career city'); }
            else if (key === 'afford') { s = 1 - clamp((cost - 8000) / 40000, 0, 1); note = k(cost) + ' a year all-in'; }
            else if (key === 'research') { s = { 5: 1, 4: .8, 3: .5, 2: .3, 1: .2 }[x.diff]; note = x.diff >= 4 ? 'Research-intensive' : 'Teaching-focused'; if (x.diff >= 4) good.push('Research-intensive'); }
            else if (key === 'social') { var so = x.life['Nightlife & Social']; s = so != null ? so : clamp(x.students / 35000, .2, 1); note = so != null ? 'Nightlife & social ' + Math.round(so * 100) : 'Campus size'; if (s >= .85) good.push('Big social scene'); }
            else if (key === 'safety') { var sa = x.life['Safety']; s = sa != null ? sa : .7; note = sa != null ? 'City safety ' + Math.round(sa * 100) : 'No city data — neutral'; if (sa >= .85) good.push('Very safe city'); }
            var lbl = PRIORITIES.filter(function (q) { return q[0] === key; })[0];
            add(key, lbl ? lbl[1] : key, 8, s, note);
        });
        var W = f.reduce(function (a, b) { return a + b.w; }, 0);
        var pct = W ? Math.round(f.reduce(function (a, b) { return a + b.w * b.s; }, 0) / W * 100) : Math.round(40 + (x.diff - 1) * 12);
        return { x: x, pct: pct, factors: f, good: good.slice(0, 3), warn: warn.slice(0, 2) };
    }
    function rank(pool, p) {
        return pool.map(function (x) { return score(x, p); }).sort(function (a, b) { return b.pct - a.pct || a.x.nat - b.x.nat || b.x.diff - a.x.diff; });
    }

    /* ── Preferences ──────────────────────────────────────────────── */
    function gradebookPct() {
        try { var s = window.gbSnapshot && window.gbSnapshot(); if (s && s.avg != null && s.max) return Math.round(s.avg / s.max * 100); } catch (e) {}
        return null;
    }
    function defaults() {
        var dest = [cc()];
        return { v: 2, dest: dest, subjects: [], grade: gradebookPct(), gradeFromGb: gradebookPct() != null, budget: 0, eu: true, lang: '', city: '', prio: [] };
    }
    function loadPrefs() { try { var p = JSON.parse(localStorage.getItem(prefsKey()) || 'null'); if (p && p.v === 2) return Object.assign(defaults(), p); } catch (e) {} return defaults(); }
    function savePrefs() { try { localStorage.setItem(prefsKey(), JSON.stringify(P)); } catch (e) {} syncGb(); }
    var P = null;

    /* ── UI ───────────────────────────────────────────────────────── */
    var root = null, listEl = null, shown = 10, last = [], aiOrder = null, t0 = 0;
    function destOptions() {
        var out = [];
        try { (getFavCountries() || []).forEach(function (c) { if (DATA_COUNTRIES.some(function (d) { return d.code === c; }) && out.indexOf(c) < 0) out.push(c); }); } catch (e) {}
        if (out.indexOf(cc()) < 0) out.unshift(cc());
        P.dest.forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); });
        return out;
    }
    function chip(group, val, label, on, icon) {
        return '<button type="button" class="mfy-chip' + (on ? ' is-on' : '') + '" data-g="' + group + '" data-v="' + esc(val) + '" aria-pressed="' + on + '">' + (icon || '') + '<span>' + esc(label) + '</span></button>';
    }
    function seg(group, opts, cur) {
        var i = Math.max(0, opts.findIndex(function (o) { return o[0] === cur; }));
        return '<div class="mfy-seg" data-g="' + group + '" style="--n:' + opts.length + ';--i:' + i + '"><i class="mfy-seg__pill" aria-hidden="true"></i>' +
            opts.map(function (o, j) { return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (j === i) + '">' + o[1] + '</button>'; }).join('') + '</div>';
    }
    function panelHTML() {
        var dests = destOptions();
        return '<div class="mfy">' +
            '<aside class="mfy-you">' +
                '<header class="mfy-you__hd"><div><b>About you</b><small>Results re-rank as you answer</small></div><button type="button" class="mfy-reset" data-act="reset"><i class="fa-solid fa-rotate-left"></i> Reset</button></header>' +
                '<div class="mfy-q"><div class="mfy-q__l">Where</div><div class="mfy-chips">' + dests.map(function (c) { return chip('dest', c, cname(c), P.dest.indexOf(c) >= 0, '<span class="fi fi-' + c + '"></span>'); }).join('') + '</div></div>' +
                '<div class="mfy-q"><div class="mfy-q__l">What you want to study <span>' + (P.subjects.length ? P.subjects.length + ' picked' : 'pick any') + '</span></div><div class="mfy-chips">' + Object.keys(SUBJECTS).map(function (s) { return chip('subjects', s, s, P.subjects.indexOf(s) >= 0); }).join('') + '</div></div>' +
                '<div class="mfy-q"><div class="mfy-q__l">Your grades <span id="mfyGradeSrc">' + (P.gradeFromGb ? 'from your Gradebook' : 'average, in %') + '</span></div>' +
                    '<div class="mfy-range"><input type="range" min="40" max="100" step="1" value="' + (P.grade || 70) + '" data-r="grade" aria-label="Your average grade in percent"><output id="mfyGradeOut">' + (P.grade ? P.grade + '%' : 'Skip') + '</output></div>' +
                    (P.grade ? '' : '<button type="button" class="mfy-link" data-act="grade-on">Use my grade</button>') + '</div>' +
                '<div class="mfy-q"><div class="mfy-q__l">Budget a year <span>tuition + living</span></div>' +
                    '<div class="mfy-range"><input type="range" min="4000" max="82000" step="1000" value="' + (P.budget || 82000) + '" data-r="budget" aria-label="Yearly budget"><output id="mfyBudgetOut">' + (P.budget ? k(P.budget) : 'No limit') + '</output></div></div>' +
                '<div class="mfy-q mfy-q--two"><div><div class="mfy-q__l">Passport</div>' + seg('eu', [['1', 'EU'], ['0', 'Non-EU']], P.eu ? '1' : '0') + '</div>' +
                    '<div><div class="mfy-q__l">Taught in</div>' + seg('lang', [['', 'Any'], ['english', 'English'], ['local', 'Local']], P.lang) + '</div></div>' +
                '<div class="mfy-q"><div class="mfy-q__l">City</div>' + seg('city', [['', 'Any'], ['big', 'Big city'], ['small', 'Smaller town']], P.city) + '</div>' +
                '<div class="mfy-q"><div class="mfy-q__l">What matters most <span>up to 3</span></div><div class="mfy-chips">' + PRIORITIES.map(function (q) { return chip('prio', q[0], q[1], P.prio.indexOf(q[0]) >= 0, '<i class="fa-solid ' + q[2] + '" aria-hidden="true"></i>'); }).join('') + '</div></div>' +
                '<label class="mfy-gb"><input type="checkbox" data-act="gb"' + (gbOn() ? ' checked' : '') + '><i aria-hidden="true"></i><span>Use these answers for my Gradebook&rsquo;s realistic options</span></label>' +
            '</aside>' +
            '<div class="mfy-res">' +
                '<header class="mfy-res__hd"><div><b id="mfyTitle">Your matches</b><small id="mfyStat">Ranking…</small></div>' +
                    '<button type="button" class="mfy-ai" data-act="ai"><span class="mfy-ai__spark" aria-hidden="true"></span><span>AI second opinion</span></button></header>' +
                '<ol class="mfy-list" id="mfyList"></ol>' +
                '<button type="button" class="mfy-more" data-act="more" hidden>Show more</button>' +
            '</div>' +
        '</div>';
    }

    function card(r, i) {
        var x = r.x, u = x.u, ai = aiOrder && aiOrder[u.id];
        var why = r.good.map(function (g) { return '<span class="mfy-tag">' + esc(g) + '</span>'; }).join('') + r.warn.map(function (w) { return '<span class="mfy-tag mfy-tag--warn">' + esc(w) + '</span>'; }).join('');
        var saved = false; try { saved = getSaved().indexOf(u.id) >= 0; } catch (e) {}
        var bars = r.factors.map(function (f) {
            return '<div class="mfy-bar"><span class="mfy-bar__l">' + esc(f.label) + '</span><span class="mfy-bar__t"><i style="--s:' + f.s.toFixed(3) + '"></i></span><span class="mfy-bar__v">' + Math.round(f.s * 100) + '</span><span class="mfy-bar__n">' + esc(f.note) + '</span></div>';
        }).join('') || '<p class="mfy-empty">Answer a question on the left and we&rsquo;ll explain every match.</p>';
        var tone = r.pct >= 75 ? 'hi' : r.pct >= 55 ? 'mid' : 'lo';
        return '<li class="mfy-card" data-id="' + esc(u.id) + '" style="--i:' + (i % 10) + '">' +
            '<span class="mfy-card__n">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
            '<span class="mfy-card__crest">' + (typeof uniLogo === 'function' ? uniLogo(u, 30) : '') + '</span>' +
            '<div class="mfy-card__main">' +
                '<button type="button" class="mfy-card__name" data-act="open">' + esc(u.name) + '</button>' +
                '<div class="mfy-card__loc"><span class="fi fi-' + x.code + '"></span> ' + esc(u.city || '') + ' · ' + esc(cname(x.code)) + ' · ' + k(x.cost) + '/yr' + (x.costEst ? '<abbr title="Part of this is an estimate">*</abbr>' : '') + '</div>' +
                (ai ? '<div class="mfy-card__ai"><span class="mfy-ai__spark" aria-hidden="true"></span>' + esc(ai.reason || 'AI pick') + '</div>' : '') +
                '<div class="mfy-card__why">' + why + '</div>' +
                '<div class="mfy-card__detail" hidden>' + bars + '</div>' +
            '</div>' +
            '<div class="mfy-card__score mfy-card__score--' + tone + '"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17"/><circle cx="20" cy="20" r="17" pathLength="100" style="--p:' + r.pct + '"/></svg><b>' + r.pct + '</b></div>' +
            '<div class="mfy-card__acts">' +
                '<button type="button" data-act="save" class="' + (saved ? 'is-on' : '') + '" title="' + (saved ? 'Saved' : 'Save') + '" aria-label="Save"><i class="fa-' + (saved ? 'solid' : 'regular') + ' fa-bookmark"></i></button>' +
                '<button type="button" data-act="compare" title="Compare" aria-label="Compare"><i class="fa-solid fa-scale-balanced"></i></button>' +
                '<button type="button" data-act="why" title="Why it fits" aria-label="Why it fits" aria-expanded="false"><i class="fa-solid fa-chevron-down"></i></button>' +
            '</div>' +
        '</li>';
    }

    // Re-rank and redraw; cards glide to their new places (FLIP) instead of jumping.
    var runId = 0;
    function run() {
        var id = ++runId;
        t0 = performance.now();
        Promise.all(P.dest.map(loadCountry)).then(function (groups) {
            if (id !== runId || !root) return;
            // the dataset still has a few duplicate entries — keep the first of each name + city
            var pool = [], seen = {};
            groups.forEach(function (g) { g.unis.forEach(function (x) { var key = (x.u.name + '|' + x.u.city).toLowerCase(); if (!seen[key]) { seen[key] = 1; pool.push(x); } }); });
            var t1 = performance.now();
            last = rank(pool, P);
            if (aiOrder) last.sort(function (a, b) { var A = aiOrder[a.x.u.id], B = aiOrder[b.x.u.id]; return (A ? A.i : 999) - (B ? B.i : 999) || 0; });
            var ms = Math.max(1, Math.round(performance.now() - t1));
            var st = root.querySelector('#mfyStat');
            st.textContent = 'Ranked ' + pool.length + ' universities in ' + P.dest.length + ' countr' + (P.dest.length === 1 ? 'y' : 'ies') + ' · ' + ms + ' ms' + (aiOrder ? ' · re-ordered by AI' : '');
            root.querySelector('#mfyTitle').textContent = answered() ? 'Your matches' : 'Best known — tell us about you';
            paint();
        });
    }
    function answered() { return P.subjects.length || P.grade || P.budget || P.lang || P.city || P.prio.length; }
    function paint() {
        var before = {};
        listEl.querySelectorAll('.mfy-card').forEach(function (c) { before[c.getAttribute('data-id')] = c.getBoundingClientRect().top; });
        var open = {}; listEl.querySelectorAll('.mfy-card.is-open').forEach(function (c) { open[c.getAttribute('data-id')] = 1; });
        listEl.innerHTML = last.slice(0, shown).map(card).join('') || '<li class="mfy-none">No universities in these countries yet.</li>';
        listEl.querySelectorAll('.mfy-card').forEach(function (c) {
            var idv = c.getAttribute('data-id');
            if (open[idv]) toggleWhy(c, true);
            if (REDUCED) return;
            if (before[idv] != null) {
                c.classList.add('no-in');
                var dy = before[idv] - c.getBoundingClientRect().top;
                if (Math.abs(dy) > 2) c.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 550, easing: 'cubic-bezier(.22,1,.36,1)' });
            }
        });
        if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(listEl);
        var more = root.querySelector('[data-act="more"]'); more.hidden = last.length <= shown;
        more.textContent = 'Show ' + Math.min(10, last.length - shown) + ' more';
    }
    function toggleWhy(c, force) {
        var d = c.querySelector('.mfy-card__detail'), b = c.querySelector('[data-act="why"]'), on = force != null ? force : d.hidden;
        d.hidden = !on; c.classList.toggle('is-open', on); if (b) b.setAttribute('aria-expanded', on);
    }
    var debT = 0;
    function changed(now) { savePrefs(); aiOrder = null; clearTimeout(debT); debT = setTimeout(run, now ? 0 : 90); }

    function onClick(e) {
        var sb = e.target.closest('.mfy-seg button');
        if (sb && root.contains(sb)) {
            var sg = sb.parentNode, key = sg.getAttribute('data-g'), val = sb.getAttribute('data-v');
            var btns = [].slice.call(sg.querySelectorAll('button')); sg.style.setProperty('--i', btns.indexOf(sb));
            btns.forEach(function (b) { b.setAttribute('aria-pressed', b === sb); });
            P[key] = key === 'eu' ? val === '1' : val;
            changed(); return;
        }
        var t = e.target.closest('[data-g], [data-act]'); if (!t || !root.contains(t)) return;
        var g = t.getAttribute('data-g'), act = t.getAttribute('data-act');
        if (g && t.classList.contains('mfy-chip')) {
            var v = t.getAttribute('data-v'), arr = P[g], i = arr.indexOf(v);
            if (i >= 0) { if (g === 'dest' && arr.length === 1) return; arr.splice(i, 1); }
            else { if (g === 'prio' && arr.length >= 3) arr.shift(); arr.push(v); }
            root.querySelectorAll('.mfy-chip[data-g="' + g + '"]').forEach(function (c) { var on = P[g].indexOf(c.getAttribute('data-v')) >= 0; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', on); });
            if (g === 'subjects') { var sp = t.closest('.mfy-q').querySelector('.mfy-q__l span'); if (sp) sp.textContent = P.subjects.length ? P.subjects.length + ' picked' : 'pick any'; }
            changed(); return;
        }
        var li = t.closest('.mfy-card'), r = li && last.find(function (z) { return String(z.x.u.id) === li.getAttribute('data-id'); });
        if (act === 'reset') { var keepDest = P.dest; P = defaults(); P.dest = keepDest; mountInto(root.parentNode); changed(true); return; }
        if (act === 'more') { shown += 10; paint(); return; }
        if (act === 'grade-on') { P.grade = gradebookPct() || 70; t.remove(); root.querySelector('#mfyGradeOut').textContent = P.grade + '%'; changed(); return; }
        if (act === 'ai') { askAI(t); return; }
        if (!r) return;
        if (act === 'why') { toggleWhy(li); return; }
        if (act === 'open' && typeof showUniDetail === 'function') { showUniDetail(r.x.u); return; }
        if (act === 'save') {
            try { var s = getSaved(), j = s.indexOf(r.x.u.id); if (j >= 0) s.splice(j, 1); else s.push(r.x.u.id); setSaved(s); if (typeof renderSaved === 'function') renderSaved(); if (typeof updateStats === 'function') updateStats(); } catch (e2) {}
            var on2 = !t.classList.contains('is-on'); t.classList.toggle('is-on', on2); t.innerHTML = '<i class="fa-' + (on2 ? 'solid' : 'regular') + ' fa-bookmark"></i>';
            t.classList.remove('is-pop'); void t.offsetWidth; t.classList.add('is-pop'); return;
        }
        if (act === 'compare') {
            var slot = (typeof cmpVsSelected !== 'undefined' && cmpVsSelected.A) ? (cmpVsSelected.B ? 'A' : 'B') : 'A';
            var ob = document.getElementById('openCompareModal'); if (ob) ob.click();
            if (typeof selectVsUni === 'function') selectVsUni(slot, r.x.u);
        }
    }
    function onInput(e) {
        var r = e.target.getAttribute('data-r');
        if (r === 'grade') { P.grade = +e.target.value; P.gradeFromGb = false; root.querySelector('#mfyGradeOut').textContent = P.grade + '%'; root.querySelector('#mfyGradeSrc').textContent = 'average, in %'; var gl = root.querySelector('[data-act="grade-on"]'); if (gl) gl.remove(); paintRange(e.target); changed(); }
        else if (r === 'budget') { var v = +e.target.value; P.budget = v >= 82000 ? 0 : v; root.querySelector('#mfyBudgetOut').textContent = P.budget ? k(P.budget) : 'No limit'; paintRange(e.target); changed(); }
        else if (e.target.getAttribute('data-act') === 'gb') { setGb(e.target.checked); }
    }
    function paintRange(el) { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100).toFixed(1) + '%'); }

    /* ── optional AI second opinion (server + Groq); never blocks the list ── */
    function askAI(btn) {
        if (btn.classList.contains('is-busy')) return;
        var top = last.slice(0, 20); if (!top.length) return;
        btn.classList.add('is-busy'); btn.querySelector('span:last-child').textContent = 'Thinking…';
        var base = (typeof AI_API_BASE !== 'undefined' && AI_API_BASE) || (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== '4242' ? 'http://localhost:4242' : location.origin);
        var profile = { subjects: P.subjects, exp: P.grade || null, lang: P.lang === 'english' ? 'English' : '', budget: P.budget || null,
            vibe: P.city === 'big' ? 'big' : P.city === 'small' ? 'small' : 'any', priorities: P.prio.map(function (q) { return (PRIORITIES.filter(function (z) { return z[0] === q; })[0] || [0, q])[1]; }) };
        var cands = top.map(function (r) { var u = r.x.u; return { id: u.id, name: u.name, city: u.city || '', country: cname(r.x.code), tuition: k(r.x.tuition) + '/yr (≈ € all-in ' + k(r.x.cost) + ')', difficulty: r.x.diff, fields: (u.fields || []).slice(0, 6), langs: u.langs || [] }; });
        var done = function (msg) { btn.classList.remove('is-busy'); btn.querySelector('span:last-child').textContent = msg || 'AI second opinion'; };
        var timer = setTimeout(function () { done('AI is slow right now'); }, 25000);
        fetch(base + '/api/ai/match', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: profile, candidates: cands }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                clearTimeout(timer);
                if (!d || !d.ok || !Array.isArray(d.ranked) || !d.ranked.length) { done('AI unavailable — try later'); return; }
                aiOrder = {}; d.ranked.forEach(function (it, i) { aiOrder[it.id] = { i: i, reason: it.reason }; });
                done('AI re-ordered your top 20'); run();
            })
            .catch(function () { clearTimeout(timer); done('AI is offline right now'); });
    }

    /* ── Gradebook link (same storage the old matcher used) ───────── */
    function gbKey() { return 'us_gb_filters_on_' + uid(); }
    function gbOn() { try { return localStorage.getItem(gbKey()) === '1'; } catch (e) { return false; } }
    function setGb(on) { try { localStorage.setItem(gbKey(), on ? '1' : '0'); if (typeof setGbFilters === 'function') setGbFilters(on ? { kind: 'matcher', prefs: JSON.parse(JSON.stringify(P)) } : null); } catch (e) {} }
    function syncGb() { if (gbOn()) setGb(true); }
    // The Gradebook ranks its realistic options with this — same engine when the saved answers are new-style.
    var oldScore = window.fyScoreUni;
    window.fyScoreUni = function (u, prefs) {
        if (prefs && prefs.v === 2) { var p = Object.assign(defaults(), prefs); return score(prep(u, cc(), {}, []), p).pct; }
        return typeof oldScore === 'function' ? oldScore(u, prefs) : 0;
    };

    /* ── mount: a teaser on the page; the matcher itself opens in a modal ── */
    function mountInto(mount) {
        mount.innerHTML = panelHTML();
        root = mount.querySelector('.mfy');
        listEl = root.querySelector('#mfyList');
        root.querySelectorAll('input[type="range"]').forEach(paintRange);
        root.addEventListener('click', onClick);
        root.addEventListener('input', onInput);
        root.addEventListener('change', onInput);
    }
    var teaser = null, modal = null, deckT = 0;
    function summaryChips() {
        var out = [];
        if (P.subjects.length) out.push(P.subjects.slice(0, 2).join(' · ') + (P.subjects.length > 2 ? ' +' + (P.subjects.length - 2) : ''));
        if (P.grade) out.push(P.grade + '% grades');
        if (P.budget) out.push(k(P.budget) + ' / yr');
        if (P.lang === 'english') out.push('English-taught');
        if (P.city) out.push(P.city === 'big' ? 'Big city' : 'Smaller town');
        out.push(P.dest.length + ' countr' + (P.dest.length === 1 ? 'y' : 'ies'));
        return out.map(function (x, i) { return '<span style="--k:' + i + '">' + esc(x) + '</span>'; }).join('');
    }
    function teaserHTML() {
        return '<section class="mfy-teaser ex-scope">' +
            '<div class="mfy-teaser__glow" aria-hidden="true"><i></i><i></i></div>' +
            '<div class="mfy-teaser__txt">' +
                '<p class="mfy-teaser__k"><span class="mfy-teaser__dot" aria-hidden="true"></span>Elite · your personal ranking</p>' +
                '<h3 class="mfy-teaser__t">Universities ranked for <em>you</em></h3>' +
                '<p class="mfy-teaser__s">Tell us what you want to study, your grades, budget and what matters most — every university in your countries gets a fit score, with the reasons.</p>' +
                '<div class="mfy-teaser__sum" id="mfySum">' + summaryChips() + '</div>' +
                '<button type="button" class="mfy-teaser__go" data-mfy-open><span>' + (answered() ? 'Open my matches' : 'Find my matches') + '</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>' +
            '</div>' +
            '<div class="mfy-deck" id="mfyDeck" aria-hidden="true"></div>' +
        '</section>';
    }
    // The top three, fanned like cards; every few seconds the front card slides to the back.
    function paintDeck() {
        var deck = teaser && teaser.querySelector('#mfyDeck'); if (!deck) return;
        var top = last.slice(0, 3);
        deck.innerHTML = top.map(function (r, i) {
            var tone = r.pct >= 75 ? 'hi' : r.pct >= 55 ? 'mid' : 'lo';
            return '<div class="mfy-deck__card" data-pos="' + i + '"><span class="mfy-deck__crest">' + (typeof uniLogo === 'function' ? uniLogo(r.x.u, 28) : '') + '</span>' +
                '<span class="mfy-deck__txt"><b>' + esc(r.x.u.name) + '</b><small>' + esc(r.x.u.city || '') + ' · ' + k(r.x.cost) + '/yr</small></span>' +
                '<span class="mfy-deck__pct mfy-card__score--' + tone + '"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle cx="20" cy="20" r="17" pathLength="100" style="--p:' + r.pct + '"/></svg><b>' + r.pct + '</b></span></div>';
        }).join('');
        if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(deck);
        clearInterval(deckT);
        if (!REDUCED && top.length > 1) deckT = setInterval(function () {
            if (!teaser || !document.body.contains(teaser)) { clearInterval(deckT); return; }
            if (teaser.classList.contains('is-paused')) return;
            deck.querySelectorAll('.mfy-deck__card').forEach(function (c) { c.setAttribute('data-pos', (+c.getAttribute('data-pos') + top.length - 1) % top.length); });
        }, 3200);
    }
    // Rank quietly in the background so the teaser can show real top matches.
    function rankQuietly() {
        Promise.all(P.dest.map(loadCountry)).then(function (groups) {
            var pool = [], seen = {};
            groups.forEach(function (g) { g.unis.forEach(function (x) { var key = (x.u.name + '|' + x.u.city).toLowerCase(); if (!seen[key]) { seen[key] = 1; pool.push(x); } }); });
            last = rank(pool, P); paintDeck();
        });
    }
    function openModal() {
        if (modal) return;
        modal = document.createElement('div');
        modal.className = 'mfy-modal ex-scope';
        modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Made for you');
        modal.innerHTML = '<div class="mfy-modal__sheet"><button type="button" class="mfy-modal__x" data-mfy-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button><div class="mfy-modal__body"></div></div>';
        document.body.appendChild(modal);
        document.documentElement.classList.add('mfy-lock');
        shown = 10; aiOrder = null;
        mountInto(modal.querySelector('.mfy-modal__body'));
        run();
        requestAnimationFrame(function () { if (modal) modal.classList.add('is-open'); });
        modal.addEventListener('mousedown', function (e) { if (e.target === modal) closeModal(); });
        modal.querySelector('[data-mfy-close]').addEventListener('click', closeModal);
        document.addEventListener('keydown', escKey, true);
    }
    function escKey(e) { if (e.key === 'Escape' && modal && !document.querySelector('.udx.open, #uniDetailOverlay.open')) { e.stopPropagation(); closeModal(); } }
    function closeModal() {
        if (!modal) return;
        var m = modal; modal = null; root = null; listEl = null;
        document.removeEventListener('keydown', escKey, true);
        m.classList.remove('is-open');
        document.documentElement.classList.remove('mfy-lock');
        setTimeout(function () { m.remove(); }, REDUCED ? 0 : 380);
        refreshTeaser();
    }
    function refreshTeaser() {
        if (!teaser) return;
        var sum = teaser.querySelector('#mfySum'); if (sum) sum.innerHTML = summaryChips();
        var go = teaser.querySelector('[data-mfy-open] span'); if (go) go.textContent = answered() ? 'Open my matches' : 'Find my matches';
        paintDeck();
    }
    window.mfyMount = function (mount) {
        if (!mount) return;
        P = loadPrefs();
        P.dest = P.dest.filter(function (c) { return typeof DATA_COUNTRIES === 'undefined' || DATA_COUNTRIES.some(function (d) { return d.code === c; }); });
        if (!P.dest.length) P.dest = [cc()];
        if (P.gradeFromGb) { var g = gradebookPct(); if (g != null) P.grade = g; }
        mount.innerHTML = teaserHTML();
        teaser = mount.querySelector('.mfy-teaser');
        teaser.querySelector('[data-mfy-open]').addEventListener('click', openModal);
        if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { if (teaser) teaser.classList.toggle('is-paused', !en[0].isIntersecting); }).observe(teaser);
        rankQuietly();
    };
    window.mfyScore = function (u, prefs, code) { return score(prep(u, code || cc(), {}, []), Object.assign(defaults(), prefs || {})); };   // for testing / reuse
})();
