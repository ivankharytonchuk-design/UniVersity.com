/* ════════════════════════════════════════════════════════════════════
   City guide (styles: cityGuide.css).
   · Postcards with a live scene: the sky as it is in that city right now
     (dawn / day / golden hour / dusk / night by its real local time), the
     sun or moon on its arc, drifting clouds, stars and lit windows at night,
     and a skyline of its own. Cards tilt in 3D towards the pointer.
   · Pick one and it morphs (View Transitions) into the city: local time,
     live weather, a personal "Fit for you" from your Made-for-you answers.
   · Sections each have their own colour and motion; details fold away
     behind buttons (scores, next 7 days, all neighbourhoods, tips, visa).
   · "A day here" is a real student day, weekday or weekend, at the budget
     you choose (save / balanced / treat): real places from the city's data,
     typical local prices (Numbeo 2025–26 levels, subsidised student canteens
     such as France's €1 CROUS meals and Germany's Mensa), and a sun that
     travels its arc through the day.
   Data: data/<cc>.json + CG2_DATA / CITY_INFO / CITY_COORDS_MAP / UNI.
   Motion is transform/opacity (and one-off SVG strokes); loops pause
   off-screen; nothing moves under prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var host = document.getElementById('cityGuide');
    if (!host) return;
    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function cc() { try { return String(currentCountryCode || 'gb').toLowerCase(); } catch (e) { return 'gb'; } }
    function uid() { try { return (window.user && window.user.id) || 'guest'; } catch (e) { return 'guest'; } }
    function nums(s) { return (String(s || '').replace(/(\d),(?=\d{3})/g, '$1').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
    function seeded(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }

    var TZ = { gb: 'Europe/London', es: 'Europe/Madrid', de: 'Europe/Berlin', fr: 'Europe/Paris', it: 'Europe/Rome', pt: 'Europe/Lisbon', nl: 'Europe/Amsterdam', se: 'Europe/Stockholm',
        ch: 'Europe/Zurich', dk: 'Europe/Copenhagen', be: 'Europe/Brussels', fi: 'Europe/Helsinki', ie: 'Europe/Dublin', ua: 'Europe/Kyiv', us: 'America/New_York' };
    var US_TZ = { 'San Francisco': 'America/Los_Angeles', 'Los Angeles': 'America/Los_Angeles', 'Seattle': 'America/Los_Angeles', 'Chicago': 'America/Chicago', 'Austin': 'America/Chicago' };
    var FX = { EUR: 1, GBP: 1.17, USD: .92, CHF: 1.05, DKK: .134, SEK: .088, UAH: .022 };
    var WX = { 0: ['Clear', 'fa-sun'], 1: ['Mostly clear', 'fa-sun'], 2: ['Partly cloudy', 'fa-cloud-sun'], 3: ['Cloudy', 'fa-cloud'], 45: ['Fog', 'fa-smog'], 48: ['Fog', 'fa-smog'],
        51: ['Drizzle', 'fa-cloud-rain'], 53: ['Drizzle', 'fa-cloud-rain'], 55: ['Drizzle', 'fa-cloud-rain'], 61: ['Light rain', 'fa-cloud-rain'], 63: ['Rain', 'fa-cloud-showers-heavy'], 65: ['Heavy rain', 'fa-cloud-showers-heavy'],
        71: ['Snow', 'fa-snowflake'], 73: ['Snow', 'fa-snowflake'], 75: ['Heavy snow', 'fa-snowflake'], 80: ['Showers', 'fa-cloud-sun-rain'], 81: ['Showers', 'fa-cloud-sun-rain'], 82: ['Storm showers', 'fa-cloud-showers-heavy'], 95: ['Thunderstorm', 'fa-cloud-bolt'], 96: ['Thunderstorm', 'fa-cloud-bolt'], 99: ['Thunderstorm', 'fa-cloud-bolt'] };
    var DONUT = ['#10b981', '#f59e0b', '#ec4899', '#0ea5e9'];
    // Typical prices in local money (Numbeo 2025–26 levels; student canteens where subsidised).
    // c coffee · p pastry · m cheap restaurant meal · s student lunch · b beer · t transit ticket · mu museum (student) · g gym visit · gr a home-cooked meal
    var PRICES = {
        gb: { c: 3.8, p: 2.5, m: 17, s: 4, b: 6, t: 2.8, mu: 0, g: 8, gr: 3, canteen: 'a supermarket meal deal (~£4)', freeMu: 'UK national museums are free' },
        es: { c: 2.2, p: 1.8, m: 14, s: 6, b: 3, t: 1.5, mu: 5, g: 8, gr: 2.5, canteen: 'the campus cafeteria’s menú' },
        de: { c: 3.5, p: 2.5, m: 15, s: 3.5, b: 4.5, t: 3.5, mu: 8, g: 10, gr: 3, canteen: 'the Mensa, with your student card' },
        fr: { c: 3.3, p: 1.5, m: 16, s: 1, b: 7, t: 2.1, mu: 0, g: 10, gr: 3, canteen: 'a CROUS canteen — €1 for students', freeMu: 'national museums are free for under-26s living in the EU' },
        it: { c: 1.7, p: 1.5, m: 16, s: 4, b: 5, t: 1.7, mu: 10, g: 10, gr: 3, canteen: 'the university mensa' },
        pt: { c: 1.4, p: 1.2, m: 11, s: 2.9, b: 2.5, t: 1.8, mu: 6, g: 7, gr: 2.5, canteen: 'the university cantina' },
        nl: { c: 3.8, p: 2.5, m: 18, s: 5, b: 6, t: 3.4, mu: 15, g: 10, gr: 3.5, canteen: 'the campus canteen' },
        se: { c: 45, p: 30, m: 150, s: 85, b: 80, t: 42, mu: 0, g: 120, gr: 35, canteen: 'a student lunch', freeMu: 'many state museums are free' },
        ch: { c: 5, p: 4, m: 25, s: 9, b: 8, t: 3.5, mu: 12, g: 25, gr: 6, canteen: 'the Mensa' },
        dk: { c: 45, p: 30, m: 140, s: 50, b: 60, t: 24, mu: 90, g: 90, gr: 30, canteen: 'the campus canteen' },
        be: { c: 3, p: 2, m: 18, s: 5, b: 5, t: 2.6, mu: 10, g: 10, gr: 3, canteen: 'the university resto' },
        fi: { c: 4, p: 2.5, m: 14, s: 3.1, b: 8, t: 3.2, mu: 12, g: 10, gr: 3, canteen: 'a student restaurant (Unicafe)' },
        ie: { c: 4, p: 3, m: 18, s: 6, b: 7, t: 2, mu: 0, g: 10, gr: 3.5, canteen: 'the campus canteen', freeMu: 'national museums are free' },
        ua: { c: 60, p: 50, m: 350, s: 150, b: 80, t: 15, mu: 100, g: 250, gr: 80, canteen: 'the university canteen' },
        us: { c: 5, p: 4, m: 20, s: 11, b: 7, t: 2.9, mu: 20, g: 0, gr: 5, canteen: 'the dining hall' }
    };

    /* ── data ─────────────────────────────────────────────────────── */
    var countryCache = {};
    function loadCountry(code) {
        if (!countryCache[code]) countryCache[code] = fetch('data/' + code + '.json').then(function (r) { return r.json(); }).catch(function () { return { cities: {}, meta: {} }; });
        return countryCache[code];
    }
    function cityData(name, info) {
        var d = (typeof CG2_DATA !== 'undefined' && CG2_DATA[name]) || null;
        if (d) return d;
        return { gradient: 'linear-gradient(135deg,#1f2937,#4b5563)', studentPop: '', vibe: info.desc || '', lifestyle: [], accCosts: null, transport: 0, neighbourhoods: [],
            hotspots: (info.highlights || []).slice(0, 6).map(function (h) { return { type: 'Highlight', name: h.split('—')[0].trim(), icon: 'fa-star' }; }), dayTimeline: [], testimonials: [], weather: null };
    }
    var state = { code: '', meta: {}, cities: {}, cards: {}, city: null };
    // one real photo per city (data/city_photos.js — Wikimedia Commons, credited on the city hero)
    var photosP = null;
    function loadPhotos() {
        if (window.CITY_PHOTOS) return Promise.resolve(window.CITY_PHOTOS);
        if (!photosP) photosP = new Promise(function (res) {
            var sc = document.createElement('script'); sc.src = 'data/city_photos.js?v=2'; sc.async = true;
            sc.onload = function () { res(window.CITY_PHOTOS || {}); }; sc.onerror = function () { photosP = null; res({}); };
            document.head.appendChild(sc);
        });
        return photosP;
    }
    function photoOf(name) { var P = window.CITY_PHOTOS; return P ? P[state.code + '/' + name] || null : null; }
    function photoImg(src, cls) { return '<img class="' + cls + '" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" onload="this.classList.add(\'is-in\')" onerror="var h=this.closest(\'.has-photo\');if(h)h.classList.remove(\'has-photo\');this.remove()">'; }
    function cur() { return state.meta.currency || 'EUR'; }
    function sym() { return state.meta.currencySymbol || '€'; }
    // CG2 costs are local money except Ukraine's, which are kept in euros.
    function moneySym() { return state.code === 'ua' ? '€' : sym(); }
    function moneyCur() { return state.code === 'ua' ? 'EUR' : cur(); }
    function tzOf(city) { return (state.code === 'us' && US_TZ[city]) || TZ[state.code] || undefined; }
    function hourIn(city) {
        try { var p = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tzOf(city) }).formatToParts(new Date()); var h = 0, m = 0; p.forEach(function (x) { if (x.type === 'hour') h = +x.value; if (x.type === 'minute') m = +x.value; }); return h + m / 60; }
        catch (e) { return new Date().getHours(); }
    }
    function phaseOf(h) { return h < 5.5 || h >= 21 ? 'night' : h < 8 ? 'dawn' : h < 17 ? 'day' : h < 19.5 ? 'golden' : 'dusk'; }
    function firstColor(g) { var m = String(g || '').match(/#[0-9a-f]{3,8}/gi); return m ? m[m.length - 1] : '#334155'; }

    /* ── postcards with a live sky ────────────────────────────────── */
    function skyline(name, lit) {
        var rnd = seeded(name), x = 0, W = 200, d = 'M0 60', wins = '';
        while (x < W) {
            var bw = 8 + rnd() * 20, bh = 12 + rnd() * 30; if (rnd() < .14) bh += 16 + rnd() * 10;
            var top = 60 - bh;
            if (rnd() < .18) { d += ' L' + x.toFixed(1) + ' ' + top.toFixed(1) + ' L' + (x + bw / 2).toFixed(1) + ' ' + (top - 8 - rnd() * 8).toFixed(1) + ' L' + (x + bw).toFixed(1) + ' ' + top.toFixed(1); }
            else d += ' L' + x.toFixed(1) + ' ' + top.toFixed(1) + ' L' + (x + bw).toFixed(1) + ' ' + top.toFixed(1);
            if (lit) for (var wy = top + 4; wy < 56; wy += 6) for (var wx = x + 2; wx < x + bw - 3; wx += 5) if (rnd() < .28) wins += '<rect x="' + wx.toFixed(1) + '" y="' + wy.toFixed(1) + '" width="1.8" height="2.4"/>';
            x += bw; if (rnd() < .35) { d += ' L' + x.toFixed(1) + ' 60'; x += 2 + rnd() * 5; d += ' L' + x.toFixed(1) + ' 60'; }
        }
        return '<svg class="cty-sky__city" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden="true"><path d="' + d + ' L200 60 Z"/>' + (lit ? '<g class="cty-sky__win">' + wins + '</g>' : '') + '</svg>';
    }
    function orbPos(h) {   // along a flat arc: rises ~6:00 (left), sets ~20:00 (right); the moon takes the night
        var day = h >= 6 && h < 20, f = day ? (h - 6) / 14 : ((h + 24 - 20) % 24) / 10, a = Math.PI * (1 - clamp(f, 0, 1));
        return { x: 50 + Math.cos(a) * 42, y: 78 - Math.sin(a) * 58, moon: !day };
    }
    function cardHTML(n, i) {
        var inf = state.cities[n], cd = cityData(n, inf), card = state.cards[n] || {}, grad = card.gradient || cd.gradient;
        var icon = (typeof CITY_PILL_ICONS !== 'undefined' && CITY_PILL_ICONS[n]) || cd.icon || 'fa-location-dot';
        var h = hourIn(n), ph = phaseOf(h), o = orbPos(h), t = '';
        try { t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tzOf(n) }).format(new Date()); } catch (e) {}
        var ph0 = photoOf(n);
        return '<button type="button" class="cty-card is-' + ph + (ph0 ? ' has-photo' : '') + '" role="listitem" data-city="' + esc(n) + '" style="--g:' + esc(grad) + ';--cc:' + esc(firstColor(grad)) + ';--i:' + i + ';--ox:' + o.x.toFixed(1) + '%;--oy:' + o.y.toFixed(1) + '%">' +
            '<span class="cty-sky" aria-hidden="true">' + (ph0 ? photoImg(ph0.s, 'cty-sky__photo') : '') + '<span class="cty-sky__stars"></span><span class="cty-sky__orb' + (o.moon ? ' is-moon' : '') + '"></span>' +
                '<span class="cty-sky__cloud"></span><span class="cty-sky__cloud cty-sky__cloud--2"></span>' + skyline(n, ph === 'night' || ph === 'dusk') + '</span>' +
            '<span class="cty-card__top"><i class="fa-solid ' + esc(icon.replace(/^fa-(solid|brands) /, '')) + ' cty-card__ic" aria-hidden="true"></i><span class="cty-card__time"><i class="fa-solid ' + (o.moon ? 'fa-moon' : ph === 'golden' || ph === 'dawn' ? 'fa-cloud-sun' : 'fa-sun') + '" aria-hidden="true"></i>' + esc(t) + '</span></span>' +
            '<span class="cty-card__txt"><small>' + esc(inf.region || '') + '</small><b>' + esc(n) + '</b><em>' + esc(inf.cost || '') + '</em></span>' +
            '<span class="cty-card__go" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>' +
        '</button>';
    }
    function render() {
        var code = cc();
        // photos are a nice-to-have: wait for them briefly, never block the cards on them
        Promise.all([loadCountry(code), Promise.race([loadPhotos(), new Promise(function (r) { setTimeout(r, 1500); })])]).then(function (all) {
            var d = all[0];
            if (code !== cc()) return;
            state.code = code; state.meta = d.meta || {}; state.cities = d.cities || {}; state.cards = {};
            (d.cityCards || []).forEach(function (c) { state.cards[c.city] = c; });
            var names = Object.keys(state.cities);
            host.innerHTML = '<div class="cty-rail" role="list" style="--n:' + names.length + '">' + names.map(cardHTML).join('') + '</div>' +
                '<div class="cty-stage" id="ctyStage">' + emptyHTML() + '</div>';
            state.city = null; balance();
        });
    }
    function balance() {   // even rows: 7 cards → one row of 7, 9 → 5 + 4, never 6 + 1
        var rail = host.querySelector('.cty-rail'); if (!rail) return;
        var n = rail.children.length, w = rail.clientWidth, max = Math.max(2, Math.floor((w + 14) / (164 + 14)));
        rail.style.setProperty('--cols', Math.ceil(n / Math.ceil(n / max)));
    }
    var balT = 0; window.addEventListener('resize', function () { clearTimeout(balT); balT = setTimeout(balance, 120); });
    function emptyHTML() {
        return '<div class="cty-empty"><span class="cty-empty__hand" aria-hidden="true"><i class="fa-solid fa-hand-pointer"></i></span>' +
            '<p><b>Tap a city</b> — each card shows the sky there right now. Inside: costs, weather, a real student day, neighbourhoods and the universities.</p></div>';
    }
    // 3D tilt towards the pointer (one rAF at a time)
    var tiltRaf = 0, tiltEv = null;
    host.addEventListener('pointermove', function (e) {
        if (REDUCED || e.pointerType === 'touch') return;
        tiltEv = e; if (tiltRaf) return;
        tiltRaf = requestAnimationFrame(function () {
            tiltRaf = 0; var c = tiltEv.target.closest && tiltEv.target.closest('.cty-card'); if (!c) return;
            var r = c.getBoundingClientRect(), mx = (tiltEv.clientX - r.left) / r.width - .5, my = (tiltEv.clientY - r.top) / r.height - .5;
            c.style.setProperty('--rx', (my * -10).toFixed(2) + 'deg'); c.style.setProperty('--ry', (mx * 12).toFixed(2) + 'deg'); c.style.setProperty('--mx', mx.toFixed(3));
        });
    });
    host.addEventListener('pointerout', function (e) { var c = e.target.closest && e.target.closest('.cty-card'); if (c && !c.contains(e.relatedTarget)) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); c.style.setProperty('--mx', '0'); } });

    /* ── personal fit (from the Made-for-you answers, if any) ─────── */
    function prefs() { try { return JSON.parse(localStorage.getItem('us_mfy_prefs_' + uid()) || 'null'); } catch (e) { return null; } }
    function popOf(str) { var s = String(str || '').toLowerCase(), n = nums(s)[0] || 0; return /million/.test(s) ? n * 1e6 : n; }
    function fitFor(inf, cd) {
        var P = prefs(), life = {}; (cd.lifestyle || []).forEach(function (l) { life[l.label] = l.score / 100; });
        var parts = [], note = [];
        function add(w, s, why) { if (s == null || isNaN(s)) return; parts.push([w, clamp(s, 0, 1)]); if (why) note.push(why); }
        var mEur = monthlyCost(cd, inf, 'shared', 250, 100).eur;
        if (P && P.budget) { var share = mEur * 12 / P.budget; add(3, 1 - clamp((share - .45) / .5, 0, 1), share <= .55 ? 'living costs fit your budget' : 'living costs are heavy for your budget'); }
        else add(1.5, life['Cost of Living'], null);
        if (P && P.city) { var pop = popOf(inf.pop), big = pop >= 8e5, small = pop < 3e5; add(2, P.city === 'big' ? (big ? 1 : small ? .2 : .6) : (small ? 1 : big ? .2 : .6), (big ? 'a big city' : small ? 'a smaller town' : 'mid-sized')); }
        var prio = (P && P.prio) || [], W = { social: ['Nightlife & Social', 'the social life'], safety: ['Safety', 'safety'], career: ['Career Opportunities', 'careers'], afford: ['Cost of Living', 'costs'] };
        Object.keys(W).forEach(function (k2) { var v = life[W[k2][0]]; if (v == null) return; var on = prio.indexOf(k2) >= 0; add(on ? 3 : 1, v, on && v >= .8 ? 'strong for ' + W[k2][1] : null); });
        add(1, life['Study Environment'], null); add(1, life['Public Transport'], null);
        var tw = parts.reduce(function (a, b) { return a + b[0]; }, 0);
        return { pct: tw ? Math.round(parts.reduce(function (a, b) { return a + b[0] * b[1]; }, 0) / tw * 100) : null, personal: !!(P && (P.budget || P.city || prio.length)), note: note.slice(0, 2) };
    }
    function monthlyCost(cd, inf, acc, food, fun) {
        var rent = cd.accCosts ? cd.accCosts[acc] : null;
        if (rent == null) { var n = nums(inf.cost); rent = n.length ? Math.round(n[0] * .55) : 600; }
        var tr = cd.transport || 50, total = rent + food + fun + tr;
        return { rent: rent, food: food, fun: fun, tr: tr, total: total, eur: total * (FX[moneyCur()] || 1) };
    }

    /* ── a real student day ───────────────────────────────────────── */
    function cityFactor(name) {   // pricier cities (by rent) cost a bit more than the country's average
        var cd = (typeof CG2_DATA !== 'undefined' && CG2_DATA[name]) || null; if (!cd || !cd.accCosts) return 1;
        var rents = Object.keys(state.cities).map(function (c) { var d = CG2_DATA[c]; return d && d.accCosts ? d.accCosts.shared : null; }).filter(Boolean);
        var mean = rents.length ? rents.reduce(function (a, b) { return a + b; }, 0) / rents.length : cd.accCosts.shared;
        return clamp(Math.sqrt(cd.accCosts.shared / mean), .82, 1.3);
    }
    function places(name, cd) {
        var hs = cd.hotspots || [];
        function pick(types, fb, skip) { for (var i = 0; i < hs.length; i++) { var t = String(hs[i].type || '').toLowerCase(); if (skip && skip.indexOf(hs[i].name) >= 0) continue; if (types.some(function (x) { return t.indexOf(x) >= 0; })) return hs[i].name; } return fb; }
        var hoods = (cd.neighbourhoods || []).map(function (h) { return h.name; });
        // the day is spent at a university IN the city: one named after it wins (some data files file nearby towns —
        // e.g. St Andrews — under the closest city), then the most selective
        var inName = function (u) { return String(u.name || '').toLowerCase().indexOf(String(name).toLowerCase()) !== -1 ? 1 : 0; };
        var uni = (typeof UNI !== 'undefined' ? UNI : []).filter(function (u) { return u.city === name; }).sort(function (a, b) { return inName(b) - inName(a) || (+b.diff || 0) - (+a.diff || 0); })[0];
        return {
            cafe: pick(['café', 'coffee'], 'a café near campus'), market: pick(['market', 'food'], 'a food market'), library: pick(['library'], 'the university library'),
            park: pick(['park', 'garden', 'nature', 'lake', 'river', 'beach'], 'the nearest park'), museum: pick(['museum', 'gallery', 'art', 'science'], 'a city museum'),
            view: pick(['view', 'belvedere', 'hill', 'tower', 'bridge', 'harbour', 'beach', 'river'], 'a viewpoint over the city'), bar: pick(['bar', 'pub', 'beer', 'brewery', 'wine'], 'a student bar'),
            club: pick(['club', 'venue', 'music', 'concert', 'flamenco', 'opera'], 'a live-music venue'), gym: pick(['gym', 'swimming', 'activity'], 'a local studio'),
            sight: pick(['cathedral', 'monument', 'castle', 'palace', 'church', 'square', 'piazza', 'old town', 'architecture', 'plaza'], 'the old town'),
            hood: hoods[0] || 'the student quarter', hood2: hoods[1] || hoods[0] || 'the city centre', uni: uni ? (uni.abbr && uni.name.length > 28 ? uni.abbr : uni.name) : 'campus'
        };
    }
    function money(v) {
        var s = sym(), big = /SEK|DKK|UAH/.test(cur());
        if (!v) return 'Free';
        var r = big ? Math.round(v) : Math.round(v * 2) / 2;
        return s + (r % 1 ? r.toFixed(2) : r.toLocaleString('en'));
    }
    var CAT = { food: ['#f97316', 'food'], travel: ['#0ea5e9', 'getting around'], study: ['#6366f1', 'study'], culture: ['#ec4899', 'culture'], move: ['#10b981', 'active'], night: ['#8b5cf6', 'evening'], free: ['#14b8a6', 'free time'] };
    function plan(name, cd, inf, kind, tier) {
        var P = PRICES[state.code] || PRICES.es, f = cityFactor(name), pl = places(name, cd);
        function c(v) { return v * f; }
        var pick = function (a, b, d) { return tier === 'save' ? a : tier === 'mid' ? b : d; };
        var transportTip = String(inf.transport || '').split(/(?<=\.)\s/)[0];
        var dinner = pick({ i: 'fa-kitchen-set', t: 'Cook with flatmates', w: 'your flat', cost: c(P.gr * 1.4), tip: 'Big-batch cooking is how students eat well for little' },
            { i: 'fa-bowl-food', t: 'Cheap eats', w: pl.hood, cost: c(P.m * .8), tip: 'Look for student discounts — many places do 10–20% with a student card' },
            { i: 'fa-utensils', t: 'Dinner out', w: pl.hood2, cost: c(P.m * 1.7), tip: 'Book ahead on Fridays and Saturdays' });
        var night = pick({ i: 'fa-dice', t: kind === 'week' ? 'Student night or pub quiz' : 'Film or board-game night', w: kind === 'week' ? 'the students’ union' : 'at a friend’s', cost: c(P.b), tip: 'Unions run cheap events most nights of the week' },
            { i: 'fa-champagne-glasses', t: 'Drinks with friends', w: pl.bar, cost: c(P.b * 2), tip: 'Happy hours usually end around 20:00' },
            { i: 'fa-music', t: 'Live music or a club', w: pl.club, cost: c(P.b * 3 + P.m * .6), tip: 'Student lists and early entry are often cheaper' });
        var items = kind === 'week' ? [
            ['07:45', 'food'].concat([pick({ i: 'fa-bowl-rice', t: 'Breakfast at home', w: 'your flat', cost: c(P.gr * .5), tip: 'Oats, fruit and coffee — the cheapest start' },
                { i: 'fa-mug-hot', t: 'Coffee & a pastry', w: pl.cafe, cost: c(P.c + P.p), tip: 'Bring a reusable cup — many cafés knock something off' },
                { i: 'fa-egg', t: 'Brunch', w: pl.cafe, cost: c(P.m * .9 + P.c), tip: 'A slow start before a late lecture' })]),
            ['08:30', 'travel'].concat([pick({ i: 'fa-person-walking', t: 'Walk or cycle to campus', w: 'to ' + pl.uni, cost: 0, tip: 'A second-hand bike pays for itself in weeks' },
                { i: 'fa-train-subway', t: 'Public transport to campus', w: 'to ' + pl.uni, cost: c(P.t * 2), tip: transportTip || 'Get the student travel card in week one' },
                { i: 'fa-train-subway', t: 'Public transport to campus', w: 'to ' + pl.uni, cost: c(P.t * 2), tip: transportTip || 'Get the student travel card in week one' })]),
            ['09:00', 'study', { i: 'fa-chalkboard-user', t: 'Lectures & seminars', w: pl.uni, cost: 0, tip: 'Sit near the front in week one — lecturers remember faces' }],
            ['12:30', 'food'].concat([pick({ i: 'fa-burger', t: 'Student lunch', w: P.canteen, cost: P.s, tip: 'The cheapest proper meal of the day' },
                { i: 'fa-store', t: 'Lunch at the market', w: pl.market, cost: c(P.m * .6), tip: 'Go just before closing for the best deals' },
                { i: 'fa-utensils', t: 'Sit-down lunch', w: pl.hood, cost: c(P.m * 1.1), tip: 'Lunch menus are often cheaper than dinner' })]),
            ['14:00', 'study'].concat([pick({ i: 'fa-book', t: 'Study session', w: pl.library, cost: 0, tip: 'Libraries are warm, quiet and free' },
                { i: 'fa-book-open', t: 'Study with a coffee', w: pl.library, cost: c(P.c), tip: 'Pomodoro: 25 minutes on, 5 off' },
                { i: 'fa-mug-saucer', t: 'Study in a café', w: pl.cafe, cost: c(P.c + P.p), tip: 'Pick one with plugs and wifi' })]),
            ['16:30', 'culture'].concat([pick({ i: 'fa-tree', t: 'Walk in the park', w: pl.park, cost: 0, tip: 'Fresh air between study blocks helps it stick' },
                { i: 'fa-landmark', t: 'An hour at a museum', w: pl.museum, cost: c(P.mu * .6), tip: P.freeMu || 'Bring your student ID for a discount' },
                { i: 'fa-camera', t: 'Golden hour at a viewpoint', w: pl.view, cost: c(P.b), tip: 'A drink with a view before dinner' })]),
            ['18:00', 'move'].concat([pick({ i: 'fa-person-running', t: 'Run or home workout', w: pl.park, cost: 0, tip: 'Free running clubs meet in most cities' },
                { i: 'fa-dumbbell', t: 'Uni gym or a society', w: pl.uni + ' sports centre', cost: c(P.g * .3), tip: 'Student memberships cost a fraction of city gyms' },
                { i: 'fa-person-swimming', t: 'A class', w: pl.gym, cost: c(P.g), tip: 'Try-a-class passes are the cheap way in' })]),
            ['19:30', 'food', dinner],
            ['21:30', 'night', night]
        ] : [
            ['10:00', 'food'].concat([pick({ i: 'fa-bowl-rice', t: 'Slow breakfast at home', w: 'your flat', cost: c(P.gr * .6), tip: 'Weekend pancakes for the flat' },
                { i: 'fa-mug-hot', t: 'Coffee & pastry at the market', w: pl.market, cost: c(P.c + P.p), tip: 'Markets are busiest late morning' },
                { i: 'fa-egg', t: 'Brunch', w: pl.hood, cost: c(P.m + P.c), tip: 'Queue early for the good places' })]),
            ['11:30', 'culture'].concat([pick({ i: 'fa-monument', t: 'Walk the old town', w: pl.sight, cost: 0, tip: 'Free walking tours run most weekends (tip what you like)' },
                { i: 'fa-landmark', t: 'Museum morning', w: pl.museum, cost: c(P.mu * .6), tip: P.freeMu || 'Bring your student ID for a discount' },
                { i: 'fa-ticket', t: 'Museum + guided tour', w: pl.museum, cost: c(P.mu * 1.5 + 6), tip: 'Guides bring the place to life' })]),
            ['13:30', 'food'].concat([pick({ i: 'fa-basket-shopping', t: 'Picnic', w: pl.park, cost: c(P.gr), tip: 'Supermarket picnic, city view' },
                { i: 'fa-store', t: 'Street food', w: pl.market, cost: c(P.m * .6), tip: 'Share a few plates and try more' },
                { i: 'fa-utensils', t: 'A long lunch', w: pl.hood, cost: c(P.m * 1.3), tip: 'The weekend’s best meal' })]),
            ['15:00', 'free'].concat([pick({ i: 'fa-person-walking', t: 'Wander ' + pl.hood2, w: pl.hood2, cost: 0, tip: 'The best parts of a city are free' },
                { i: 'fa-person-walking', t: 'Wander ' + pl.hood2, w: pl.hood2, cost: c(P.c), tip: 'Vintage shops, murals and a coffee' },
                { i: 'fa-bag-shopping', t: 'Explore ' + pl.hood2, w: pl.hood2, cost: c(P.c + P.p + 10), tip: 'Local shops over chains' })]),
            ['17:30', 'culture'].concat([pick({ i: 'fa-sun', t: 'Sunset', w: pl.view, cost: 0, tip: 'Check the sunset time and get there 20 min early' },
                { i: 'fa-sun', t: 'Sunset drink', w: pl.view, cost: c(P.b), tip: 'The golden hour is the best free show in town' },
                { i: 'fa-champagne-glasses', t: 'Sunset drinks', w: pl.view, cost: c(P.b * 2), tip: 'Rooftops fill up fast on sunny days' })]),
            ['19:30', 'food', dinner],
            ['22:00', 'night', night]
        ];
        return items.map(function (x) { var o = x[2]; return { time: x[0], cat: x[1], icon: o.i, title: o.t, where: o.w, cost: o.cost, tip: o.tip }; });
    }
    function hourOf(t) { var p = t.split(':'); return +p[0] + (+p[1] || 0) / 60; }
    function dayHTML() {
        return '<div class="cty-dayx" data-i="0">' +
            '<div class="cty-dayx__scene"><span class="cty-dayx__sky" aria-hidden="true"></span><svg class="cty-dayx__arc" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M8 78 A42 58 0 0 1 92 78"/></svg>' +
                '<span class="cty-dayx__orb" aria-hidden="true"></span>' + skyline(state.city + 'day', false).replace('cty-sky__city', 'cty-dayx__city') +
                '<div class="cty-dayx__now" id="ctyNow"></div></div>' +
            '<div class="cty-dayx__side"><ol class="cty-dayx__list" id="ctyDayList"></ol></div>' +
        '</div>' +
        '<footer class="cty-dayx__foot"><div id="ctyDayTotal"></div><small>Typical local prices (Numbeo 2025–26 levels; subsidised student canteens) — estimates, not quotes.</small></footer>';
    }
    var day = { kind: 'week', tier: 'mid', i: 0, items: [] };
    function paintDay() {
        var wrap = stageEl && stageEl.querySelector('.cty-dayx'); if (!wrap) return;
        var inf = state.cities[state.city] || {}, cd = cityData(state.city, inf);
        day.items = plan(state.city, cd, inf, day.kind, day.tier);
        var total = day.items.reduce(function (a, b) { return a + (b.cost || 0); }, 0);
        stageEl.querySelector('#ctyDayList').innerHTML = day.items.map(function (it, i) {
            var cat = CAT[it.cat] || CAT.free;
            return '<li style="--k:' + i + ';--ac:' + cat[0] + '"><button type="button" data-day="' + i + '"><time>' + it.time + '</time><span class="cty-dayx__ic"><i class="fa-solid ' + it.icon + '" aria-hidden="true"></i></span>' +
                '<span class="cty-dayx__txt"><b>' + esc(it.title) + '</b><small>' + esc(it.where) + '</small></span><em>' + money(it.cost) + '</em></button></li>';
        }).join('');
        var perMonthAllowance = (monthState.food + monthState.fun) / 30;
        stageEl.querySelector('#ctyDayTotal').innerHTML = '<b>' + money(total) + '</b> for this day' +
            ' <span>· ≈ ' + money(Math.round(total * 30)) + ' a month if every day looked like this' + (state.code !== 'ua' && perMonthAllowance ? ' · “Your month” below budgets ≈ ' + money(perMonthAllowance) + ' a day for food & fun' : '') + '</span>';
        setDay(Math.min(day.i, day.items.length - 1));
    }
    function setDay(i) {
        var wrap = stageEl && stageEl.querySelector('.cty-dayx'); if (!wrap || !day.items[i]) return;
        day.i = i; wrap.setAttribute('data-i', i);
        var it = day.items[i], h = hourOf(it.time), o = orbPos(h), ph = phaseOf(h), cat = CAT[it.cat] || CAT.free;
        wrap.className = 'cty-dayx is-' + ph; wrap.style.setProperty('--ox', o.x.toFixed(1) + '%'); wrap.style.setProperty('--oy', o.y.toFixed(1) + '%');
        wrap.querySelector('.cty-dayx__orb').classList.toggle('is-moon', o.moon);
        wrap.querySelectorAll('[data-day]').forEach(function (b) { var on = +b.getAttribute('data-day') === i; b.setAttribute('aria-pressed', on); b.parentNode.classList.toggle('is-past', +b.getAttribute('data-day') < i); });
        wrap.style.setProperty('--prog', (i / Math.max(1, day.items.length - 1)).toFixed(3));
        var now = wrap.querySelector('#ctyNow');
        now.innerHTML = '<span class="cty-dayx__chip" style="--ac:' + cat[0] + '">' + it.time + ' · ' + cat[1] + '</span><b>' + esc(it.title) + '</b><small><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + esc(it.where) + '</small>' +
            '<p>' + esc(it.tip) + '</p><em>' + money(it.cost) + '</em>';
        now.classList.remove('is-swap'); void now.offsetWidth; now.classList.add('is-swap');
    }
    var dayT = 0;
    function autoDay() {
        clearTimeout(dayT);
        dayT = setTimeout(function () {
            var wrap = stageEl && stageEl.querySelector('.cty-dayx');
            if (!wrap || REDUCED) return;
            if (!wrap.matches(':hover') && visible && !document.hidden) setDay((day.i + 1) % day.items.length);
            autoDay();
        }, 4200);
    }

    /* ── the city stage ───────────────────────────────────────────── */
    var ACCENT = { life: ['#7c3aed', 'fa-heart-pulse'], money: ['#059669', 'fa-wallet'], climate: ['#0284c7', 'fa-cloud-sun'], day: ['#ea580c', 'fa-sun'], hoods: ['#e11d48', 'fa-house-chimney'],
        unis: ['#4f46e5', 'fa-building-columns'], spots: ['#0d9488', 'fa-map-pin'], tips: ['#ca8a04', 'fa-lightbulb'], visa: ['#475569', 'fa-passport'] };
    function box(k, t, s, body, action) {
        var a = ACCENT[k] || ['#111', 'fa-circle'];
        return '<section class="cty-box cty-box--' + k + '" style="--ac:' + a[0] + '"><header class="cty-box__hd"><span class="cty-box__ic" aria-hidden="true"><i class="fa-solid ' + a[1] + '"></i></span>' +
            '<div class="cty-box__t"><h4>' + t + '</h4><p>' + s + '</p></div>' + (action || '') + '</header>' + body + '</section>';
    }
    function foldBtn(target, closedTxt, openTxt) { return '<button type="button" class="cty-fold" data-fold="' + target + '" data-a="' + esc(closedTxt) + '" data-b="' + esc(openTxt) + '" aria-expanded="false"><span>' + esc(closedTxt) + '</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button>'; }
    function foldBody(id, html) { return '<div class="cty-collapse" id="' + id + '"><div>' + html + '</div></div>'; }
    function stat(l, v) { return '<div class="cty-stat"><dt>' + l + '</dt><dd>' + esc(v) + '</dd></div>'; }
    function stageHTML(name) {
        var inf = state.cities[name] || {}, cd = cityData(name, inf), card = state.cards[name] || {}, grad = card.gradient || cd.gradient;
        var fit = fitFor(inf, cd), country = (state.meta.name || '').replace(/^the /, '');
        var letters = name.split('').map(function (ch, i) { return '<span style="--l:' + i + '">' + (ch === ' ' ? '&nbsp;' : esc(ch)) + '</span>'; }).join('');
        var hoods = cd.neighbourhoods || [], unis = (typeof UNI !== 'undefined' ? UNI : []).filter(function (u) { return u.city === name; }), spots = cd.hotspots || [];
        var ph = photoOf(name), phase = phaseOf(hourIn(name));
        return '<article class="cty-city" style="--g:' + esc(grad) + '">' +
            '<header class="cty-hero is-' + phase + (ph ? ' has-photo' : '') + '">' +
                '<div class="cty-hero__bg" aria-hidden="true">' + (ph ? photoImg(ph.l, 'cty-hero__photo') : '') + '<i></i><i></i><i></i></div>' +
                (ph ? '<a class="cty-credit" href="https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(ph.f.replace(/ /g, '_')) + '" target="_blank" rel="noopener" title="Photo on Wikimedia Commons">Photo: ' + esc(ph.by) + (ph.lic ? ' · ' + esc(ph.lic) : '') + '</a>' : '') +
                '<button type="button" class="cty-close" data-act="close" aria-label="Close city"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="cty-hero__txt"><p class="cty-kicker">' + esc([inf.region, country].filter(Boolean).join(' · ')) + '</p>' +
                    '<h3 class="cty-name" aria-label="' + esc(name) + '">' + letters + '</h3>' +
                    '<p class="cty-vibe">' + esc(cd.vibe || inf.desc || '') + '</p>' +
                    '<div class="cty-tags">' + (inf.tags || []).slice(0, 4).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div></div>' +
                '<div class="cty-live">' +
                    '<div class="cty-live__row"><span>Local time</span><b id="ctyTime">—</b></div>' +
                    '<div class="cty-live__row"><span>Right now</span><b id="ctyWx"><i class="fa-solid fa-cloud"></i> …</b></div>' +
                    (fit.pct != null ? '<div class="cty-fit"><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19"/><circle cx="22" cy="22" r="19" pathLength="100" style="--p:' + fit.pct + '"/></svg><b>' + fit.pct + '</b>' +
                        '<div><span>Fit for you</span><small>' + esc(fit.personal ? (fit.note.join(', ') || 'from your answers') : 'from the city’s scores — answer “Made for you” to personalise') + '</small></div></div>' : '') +
                '</div>' +
                '<dl class="cty-stats">' + stat('People', inf.pop || '—') + stat('Students', cd.studentPop || '—') + stat('Living', inf.cost ? inf.cost.replace('/mo', '') + ' /mo' : '—') + stat('Climate', inf.climate || '—') + '</dl>' +
            '</header>' +
            '<div class="cty-bento">' +
                box('day', 'A day here', 'A real student day — pick the day and your budget', dayHTML(),
                    '<div class="cty-box__ctl"><div class="cty-seg" data-g="kind" style="--n:2;--i:0"><i class="cty-seg__pill" aria-hidden="true"></i><button type="button" data-v="week" aria-pressed="true">Weekday</button><button type="button" data-v="weekend" aria-pressed="false">Weekend</button></div>' +
                    '<div class="cty-seg" data-g="tier" style="--n:3;--i:1"><i class="cty-seg__pill" aria-hidden="true"></i><button type="button" data-v="save" aria-pressed="false">Save</button><button type="button" data-v="mid" aria-pressed="true">Balanced</button><button type="button" data-v="treat" aria-pressed="false">Treat</button></div></div>') +
                (cd.lifestyle && cd.lifestyle.length ? box('life', 'Life here', 'How the city scores for students', radarHTML(cd.lifestyle) + foldBody('ctyScores', scoresHTML(cd.lifestyle)), foldBtn('ctyScores', 'Scores', 'Hide')) : '') +
                box('money', 'Your month', 'Pick how you’d live — the total updates', moneyHTML(cd)) +
                (cd.weather ? box('climate', 'Climate', esc(cd.weather.summary || inf.climate || ''), climateHTML(cd.weather) + foldBody('ctyWeekF', '<div class="cty-week" id="ctyWeek"><span class="cty-week__load">Loading the next 7 days…</span></div>'), foldBtn('ctyWeekF', 'Next 7 days', 'Hide forecast')) : '') +
                (hoods.length ? box('hoods', 'Where students live', 'Rent, commute, safety', hoodsHTML(hoods.slice(0, 2), 0) + (hoods.length > 2 ? foldBody('ctyHoods', hoodsHTML(hoods.slice(2), 2)) : ''), hoods.length > 2 ? foldBtn('ctyHoods', 'All ' + hoods.length, 'Fewer') : '') : '') +
                box('unis', 'Universities here', unis.length ? unis.length + ' in ' + esc(name) + ' — tap for details' : 'None from our list yet', unisHTML(unis.slice(0, 4)) + (unis.length > 4 ? foldBody('ctyUnis', unisHTML(unis.slice(4, 16))) : ''), unis.length > 4 ? foldBtn('ctyUnis', 'All ' + Math.min(unis.length, 16), 'Fewer') : '') +
                (spots.length ? box('spots', 'Don’t miss', 'Places students actually go', spotsHTML(spots.slice(0, 4), 0) + foldBody('ctySpots', spotsHTML(spots.slice(4, 8), 4) + highlightsHTML(inf)), foldBtn('ctySpots', 'More', 'Less')) : '') +
                (tipsHTML(cd, inf) ? box('tips', 'Good to know', 'Tap a topic', tipsHTML(cd, inf)) : '') +
                box('visa', 'Visa & paperwork', 'For studying in ' + esc(country), '<div class="cty-visa__sum" id="ctyVisaSum"></div>' + foldBody('ctyVisa', '<div class="cty-visa__slot"></div>'), foldBtn('ctyVisa', 'Details', 'Hide')) +
            '</div>' +
        '</article>';
    }
    function radarHTML(items) {
        var list = items.slice(0, 8), n = list.length, R = 92, cx = 130, cy = 120;
        function pt(i, r) { var a = -Math.PI / 2 + i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
        var rings = [.25, .5, .75, 1].map(function (f) { return '<polygon class="cty-radar__ring" points="' + list.map(function (_, i) { return pt(i, R * f).map(function (v) { return v.toFixed(1); }).join(','); }).join(' ') + '"/>'; }).join('');
        var axes = list.map(function (_, i) { var p = pt(i, R); return '<line class="cty-radar__axis" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; }).join('');
        var shape = list.map(function (l, i) { return pt(i, R * clamp(l.score / 100, .05, 1)).map(function (v) { return v.toFixed(1); }).join(','); }).join(' ');
        var dots = list.map(function (l, i) { var p = pt(i, R * clamp(l.score / 100, .05, 1)); return '<circle class="cty-radar__dot" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5"/>'; }).join('');
        var labels = list.map(function (l, i) { var p = pt(i, R + 22), anchor = Math.abs(p[0] - cx) < 8 ? 'middle' : p[0] > cx ? 'start' : 'end';
            return '<text class="cty-radar__lbl" x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="' + anchor + '">' + esc(l.label.replace(' & Social', '').replace('Public ', '').replace(' Opportunities', '').replace(' Environment', '')) + ' <tspan>' + l.score + '</tspan></text>'; }).join('');
        return '<svg class="cty-radar" viewBox="0 0 260 245" role="img" aria-label="Lifestyle scores">' + rings + axes + '<g class="cty-radar__shape"><polygon points="' + shape + '"/>' + dots + '</g>' + labels + '</svg>';
    }
    function scoresHTML(items) {
        return '<ul class="cty-scores">' + items.map(function (l) { return '<li><i class="fa-solid ' + esc(l.icon || 'fa-circle') + '" aria-hidden="true"></i><span>' + esc(l.label) + '</span><em><s style="--v:' + (l.score / 100) + '"></s></em><b>' + l.score + '</b></li>'; }).join('') + '</ul>';
    }
    function moneyHTML(cd) {
        return '<div class="cty-money">' +
            '<div class="cty-donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="cty-donut__track" cx="60" cy="60" r="46"/><g id="ctyDonut"></g></svg><div class="cty-donut__c"><b id="ctyTotal">—</b><small>a month</small></div></div>' +
            '<div class="cty-money__ctl">' +
                (cd.accCosts ? '<div class="cty-seg" data-g="acc" style="--n:3;--i:0"><i class="cty-seg__pill" aria-hidden="true"></i><button type="button" data-v="shared" aria-pressed="true">Shared</button><button type="button" data-v="studio" aria-pressed="false">Studio</button><button type="button" data-v="private" aria-pressed="false">Own flat</button></div>' : '') +
                '<label class="cty-sl"><span>Food <b id="ctyFoodV"></b></span><input type="range" min="120" max="600" step="10" value="250" data-r="food"></label>' +
                '<label class="cty-sl"><span>Going out <b id="ctyFunV"></b></span><input type="range" min="30" max="450" step="10" value="120" data-r="fun"></label>' +
                '<ul class="cty-legend" id="ctyLegend"></ul><p class="cty-money__year" id="ctyYear"></p>' +
            '</div></div>';
    }
    function climateHTML(w) {
        var t = w.temps || [], r = w.rain || [], m = w.months || ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
        var lo = Math.min.apply(null, t) - 3, hi = Math.max.apply(null, t) + 3, W = 360, H = 150, step = W / 12, y = function (v) { return 12 + (1 - (v - lo) / (hi - lo)) * (H - 44); };
        var maxR = Math.max.apply(null, r.concat([1])), nowM = new Date().getMonth();
        var bars = r.map(function (v, i) { var h = v / maxR * 42; return '<rect class="cty-clim__rain" x="' + (i * step + step * .28).toFixed(1) + '" y="' + (H - 18 - h).toFixed(1) + '" width="' + (step * .44).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" style="--k:' + i + '"/>'; }).join('');
        var path = t.map(function (v, i) { return (i ? 'L' : 'M') + (i * step + step / 2).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
        var pts = t.map(function (v, i) { return '<g class="cty-clim__pt' + (i === nowM ? ' is-now' : '') + '"><circle cx="' + (i * step + step / 2).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3"/><text x="' + (i * step + step / 2).toFixed(1) + '" y="' + (y(v) - 9).toFixed(1) + '" text-anchor="middle">' + v + '°</text></g>'; }).join('');
        var labels = m.map(function (l, i) { return '<text class="cty-clim__m' + (i === nowM ? ' is-now' : '') + '" x="' + (i * step + step / 2).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle">' + l + '</text>'; }).join('');
        return '<svg class="cty-clim" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Average temperature and rain by month"><defs><linearGradient id="ctyTempG" x1="0" x2="1"><stop offset="0" stop-color="#0ea5e9"/><stop offset=".5" stop-color="#f97316"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient></defs>' +
            bars + '<path class="cty-clim__line" d="' + path + '" pathLength="100"/>' + pts + labels + '</svg>' +
            '<p class="cty-clim__key"><span><i class="cty-clim__k1"></i>Average high</span><span><i class="cty-clim__k2"></i>Rain</span></p>';
    }
    function hoodsHTML(list, off) {
        return '<div class="cty-hoods">' + list.map(function (h, i) {
            return '<div class="cty-hood" style="--k:' + (i + off) + '"><b>' + esc(h.name) + '</b><p>' + esc(h.vibe) + '</p>' +
                '<div class="cty-hood__m"><span>Safety</span><i style="--v:' + (h.safety / 100) + '"></i><em>' + h.safety + '</em></div>' +
                '<div class="cty-hood__m"><span>Popular</span><i style="--v:' + (h.popularity / 100) + '"></i><em>' + h.popularity + '</em></div>' +
                '<div class="cty-hood__f"><span><i class="fa-solid fa-house" aria-hidden="true"></i> ' + esc(h.rent) + '</span><span><i class="fa-solid fa-route" aria-hidden="true"></i> ' + esc(h.commute) + '</span></div></div>';
        }).join('') + '</div>';
    }
    function unisHTML(list) {
        if (!list.length) return '<p class="cty-none">No universities from our list here yet.</p>';
        return '<ul class="cty-unis">' + list.map(function (u, i) {
            return '<li style="--k:' + i + '"><button type="button" data-uni="' + esc(u.id) + '"><span class="cty-unis__crest">' + (typeof uniLogo === 'function' ? uniLogo(u, 26) : '') + '</span><span><b>' + esc(u.name) + '</b><small>' + esc([u.type, u.dl].filter(Boolean).join(' · ')) + '</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></li>';
        }).join('') + '</ul>';
    }
    var SPOT_TINT = ['#f97316', '#0ea5e9', '#10b981', '#ec4899', '#8b5cf6', '#eab308', '#14b8a6', '#6366f1'];
    function spotsHTML(list, off) {
        return '<ul class="cty-spots">' + list.map(function (h, i) { return '<li style="--k:' + (i + off) + ';--tc:' + SPOT_TINT[(i + off) % SPOT_TINT.length] + '"><i class="fa-solid ' + esc(h.icon || 'fa-star') + '" aria-hidden="true"></i><span><b>' + esc(h.name) + '</b><small>' + esc(h.type || '') + '</small></span></li>'; }).join('') + '</ul>';
    }
    function highlightsHTML(inf) {
        return (inf.highlights || []).length ? '<ul class="cty-hl">' + inf.highlights.slice(0, 4).map(function (h) { var p = h.split('—'); return '<li><b>' + esc(p[0].trim()) + '</b>' + (p[1] ? ' — ' + esc(p.slice(1).join('—').trim()) : '') + '</li>'; }).join('') + '</ul>' : '';
    }
    function tipsHTML(cd, inf) {
        var groups = [];
        var tips = (cd.testimonials || []).map(function (t) { return t.advice; }).filter(Boolean).slice(0, 3);
        if (inf.transport) groups.push(['fa-train-subway', 'Getting around', '<p>' + esc(inf.transport) + '</p>']);
        if (inf.studentLife) groups.push(['fa-user-graduate', 'Student life', '<p>' + esc(inf.studentLife) + '</p>']);
        if (inf.nightlife) groups.push(['fa-moon', 'Going out', '<p>' + esc(inf.nightlife) + '</p>']);
        if ((inf.pros || []).length) groups.push(['fa-heart', 'Why students love it', '<ul>' + inf.pros.slice(0, 4).map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>']);
        if (tips.length) groups.push(['fa-lightbulb', 'Insider tips', '<ul>' + tips.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>']);
        if (!groups.length) return '';
        var TINT = ['#0ea5e9', '#6366f1', '#8b5cf6', '#ec4899', '#ca8a04'];
        return '<div class="cty-tabs"><div class="cty-tabs__nav" role="tablist">' + groups.map(function (g, i) {
            return '<button type="button" role="tab" data-tip="' + i + '" aria-selected="' + (i === 0) + '" style="--k:' + i + ';--tc:' + TINT[i % TINT.length] + '"><i class="fa-solid ' + g[0] + '" aria-hidden="true"></i><span>' + g[1] + '</span><i class="fa-solid fa-arrow-right cty-tabs__go" aria-hidden="true"></i></button>';
        }).join('') + '</div><div class="cty-tabs__panes">' + groups.map(function (g, i) {
            return '<div class="cty-tabs__pane' + (i === 0 ? ' is-on' : '') + '" role="tabpanel" data-pane="' + i + '" style="--tc:' + TINT[i % TINT.length] + '"><i class="fa-solid ' + g[0] + ' cty-tabs__mark" aria-hidden="true"></i><h5>' + g[1] + '</h5>' + g[2] + '</div>';
        }).join('') + '</div></div>';
    }

    /* ── behaviour once a city is open ────────────────────────────── */
    var monthState = { acc: 'shared', food: 250, fun: 120 }, clockT = 0, stageEl = null;
    function paintMoney() {
        var inf = state.cities[state.city] || {}, cd = cityData(state.city, inf), m = monthlyCost(cd, inf, monthState.acc, monthState.food, monthState.fun), s = moneySym();
        var parts = [['Housing', m.rent], ['Food', m.food], ['Going out', m.fun], ['Transport', m.tr]], off = 0;
        stageEl.querySelector('#ctyDonut').innerHTML = parts.map(function (p, i) {
            var len = p[1] / m.total * 100, l2 = Math.max(0, len - 1.2), el = '<circle cx="60" cy="60" r="46" pathLength="100" stroke="' + DONUT[i] + '" style="stroke-dasharray:' + l2.toFixed(2) + ' ' + (100 - l2).toFixed(2) + ';stroke-dashoffset:' + (-off).toFixed(2) + '"/>';
            off += len; return el;
        }).join('');
        stageEl.querySelector('#ctyTotal').textContent = s + Math.round(m.total).toLocaleString('en');
        stageEl.querySelector('#ctyFoodV').textContent = s + monthState.food;
        stageEl.querySelector('#ctyFunV').textContent = s + monthState.fun;
        stageEl.querySelector('#ctyLegend').innerHTML = parts.map(function (p, i) { return '<li><i style="background:' + DONUT[i] + '"></i>' + p[0] + '<b>' + s + Math.round(p[1]).toLocaleString('en') + '</b></li>'; }).join('');
        var P = prefs(), yearEur = m.eur * 12;
        stageEl.querySelector('#ctyYear').innerHTML = '≈ <b>' + s + Math.round(m.total * 12).toLocaleString('en') + '</b> a year' + (P && P.budget ? ' · ' + (yearEur <= P.budget ? 'fits' : 'is over') + ' your €' + Math.round(P.budget / 1000) + 'k budget before tuition' : '');
        stageEl.querySelectorAll('.cty-money input[type=range]').forEach(function (r) { r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100).toFixed(1) + '%'); });
    }
    function tick() {
        var el = stageEl && stageEl.querySelector('#ctyTime'); if (!el) return;
        try { el.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tzOf(state.city) }).format(new Date()); } catch (e) { el.textContent = '—'; }
    }
    function weather(name) {
        var co = (typeof CITY_COORDS_MAP !== 'undefined' && CITY_COORDS_MAP[name]) || null, wxEl = stageEl.querySelector('#ctyWx');
        var go = function (lat, lon) {
            fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7')
                .then(function (r) { return r.json(); }).then(function (d) {
                    if (state.city !== name || !stageEl) return;
                    var c = d.current || {}, w = WX[c.weather_code] || ['—', 'fa-cloud'], ic = c.is_day === 0 && /sun/.test(w[1]) ? 'fa-moon' : w[1];
                    if (wxEl) wxEl.innerHTML = '<i class="fa-solid ' + ic + ' cty-wxic" aria-hidden="true"></i> ' + Math.round(c.temperature_2m) + '° <small>' + w[0] + '</small>';
                    var wk = stageEl.querySelector('#ctyWeek');
                    if (wk && d.daily) wk.innerHTML = d.daily.time.map(function (t, i) {
                        var ww = WX[d.daily.weather_code[i]] || ['', 'fa-cloud'], dn = new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(new Date(t));
                        return '<div style="--k:' + i + '"><span>' + (i ? dn : 'Today') + '</span><i class="fa-solid ' + ww[1] + '" aria-hidden="true"></i><b>' + Math.round(d.daily.temperature_2m_max[i]) + '°</b><small>' + Math.round(d.daily.temperature_2m_min[i]) + '°</small></div>';
                    }).join('');
                }).catch(function () { if (wxEl) wxEl.textContent = 'Offline'; var wk = stageEl && stageEl.querySelector('#ctyWeek'); if (wk) wk.innerHTML = '<span class="cty-week__load">Live forecast unavailable right now.</span>'; });
        };
        if (co) go(co.lat, co.lon);
        else fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(name)).then(function (r) { return r.json(); })
            .then(function (g) { var x = g.results && g.results[0]; if (x) go(x.latitude, x.longitude); else throw 0; }).catch(function () { if (wxEl) wxEl.textContent = '—'; });
    }
    var visible = true, io = null;
    function reveal() {
        if (!('IntersectionObserver' in window) || REDUCED) { stageEl.querySelectorAll('.cty-box').forEach(function (b) { b.classList.add('is-in'); }); return; }
        if (io) io.disconnect();
        io = new IntersectionObserver(function (en) { en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
        stageEl.querySelectorAll('.cty-box').forEach(function (b) { io.observe(b); });
    }
    function setFold(btn, open) {
        var id = btn.getAttribute('data-fold'), body = stageEl.querySelector('#' + id); if (!body) return;
        open = open != null ? open : !body.classList.contains('is-open');
        body.classList.toggle('is-open', open); btn.setAttribute('aria-expanded', open);
        btn.querySelector('span').textContent = open ? btn.getAttribute('data-b') : btn.getAttribute('data-a');
        if (open && typeof cmpHydrateLogos === 'function') cmpHydrateLogos(body);
    }
    function openCity(name, card) {
        var stage = host.querySelector('#ctyStage'); if (!stage) return;
        var swap = function () {
            state.city = name; monthState = { acc: 'shared', food: 250, fun: 120 }; day = { kind: 'week', tier: 'mid', i: 0, items: [] };
            host.querySelectorAll('.cty-card').forEach(function (c) { c.classList.toggle('is-on', c.getAttribute('data-city') === name); c.style.viewTransitionName = ''; });
            stage.innerHTML = stageHTML(name);
            stageEl = stage;
            var visa = document.getElementById('cgVisaGuide'), slot = stage.querySelector('.cty-visa__slot'), sum = stage.querySelector('#ctyVisaSum');
            if (visa && slot && visa.innerHTML.trim()) {
                slot.appendChild(visa); visa.style.display = '';
                var facts = [].slice.call(visa.querySelectorAll('.visa2__fact')).slice(0, 3);
                if (sum) sum.innerHTML = facts.map(function (f, i) { var l = f.querySelector('.visa2__fact__lbl'), v = f.querySelector('.visa2__fact__val'); return l && v ? '<div style="--k:' + i + '"><span>' + esc(l.textContent) + '</span><b>' + esc(v.textContent) + '</b></div>' : ''; }).join('');
            } else if (slot) slot.closest('.cty-box').remove();
            if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(stage);
            paintMoney(); paintDay(); tick(); clearInterval(clockT); clockT = setInterval(tick, 20000);
            weather(name); autoDay(); reveal();
        };
        var heroName = function () { var h = stage.querySelector('.cty-hero'); if (h) h.style.viewTransitionName = 'cty-hero'; };
        if (document.startViewTransition && !REDUCED && card) {
            card.style.viewTransitionName = 'cty-hero';
            var vt = document.startViewTransition(function () { card.style.viewTransitionName = ''; swap(); heroName(); });
            vt.finished.then(function () { var h = stage.querySelector('.cty-hero'); if (h) h.style.viewTransitionName = ''; });
        } else swap();
        setTimeout(function () { var r = stage.getBoundingClientRect(); if (r.top > innerHeight * .55 || r.top < 0) window.scrollTo({ top: scrollY + r.top - 90, behavior: REDUCED ? 'auto' : 'smooth' }); }, REDUCED ? 0 : 380);
    }
    function closeCity() {
        var visa = document.getElementById('cgVisaGuide'), old = document.getElementById('cg2Panel');
        if (visa && old && !old.contains(visa)) old.insertBefore(visa, old.children[2] || null);
        clearInterval(clockT); clearTimeout(dayT);
        state.city = null; stageEl = null;
        host.querySelectorAll('.cty-card').forEach(function (c) { c.classList.remove('is-on'); });
        var stage = host.querySelector('#ctyStage'); if (stage) stage.innerHTML = emptyHTML();
    }

    host.addEventListener('click', function (e) {
        var card = e.target.closest('.cty-card');
        if (card) { if (!card.classList.contains('is-on')) openCity(card.getAttribute('data-city'), card); return; }
        if (e.target.closest('[data-act="close"]')) { closeCity(); return; }
        var sb = e.target.closest('.cty-seg button');
        if (sb) {
            var sg = sb.parentNode, g = sg.getAttribute('data-g'), btns = [].slice.call(sg.querySelectorAll('button'));
            sg.style.setProperty('--i', btns.indexOf(sb)); btns.forEach(function (b) { b.setAttribute('aria-pressed', b === sb); });
            if (g === 'acc') { monthState.acc = sb.getAttribute('data-v'); paintMoney(); paintDay(); }
            else if (g === 'kind') { day.kind = sb.getAttribute('data-v'); day.i = 0; paintDay(); autoDay(); }
            else if (g === 'tier') { day.tier = sb.getAttribute('data-v'); paintDay(); autoDay(); }
            return;
        }
        var fb = e.target.closest('[data-fold]'); if (fb) { setFold(fb); return; }
        var tb = e.target.closest('[data-tip]');
        if (tb) { var tabs = tb.closest('.cty-tabs'), k = tb.getAttribute('data-tip');
            tabs.querySelectorAll('[data-tip]').forEach(function (b) { b.setAttribute('aria-selected', b === tb); });
            tabs.querySelectorAll('.cty-tabs__pane').forEach(function (p) { p.classList.toggle('is-on', p.getAttribute('data-pane') === k); });
            var nav = tb.parentNode; if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: tb.offsetLeft - nav.offsetLeft - 18, behavior: REDUCED ? 'auto' : 'smooth' }); return; }
        var d = e.target.closest('[data-day]'); if (d) { setDay(+d.getAttribute('data-day')); autoDay(); return; }
        var u = e.target.closest('[data-uni]');
        if (u) { var x = (typeof UNI !== 'undefined' ? UNI : []).find(function (z) { return String(z.id) === u.getAttribute('data-uni'); }); if (x && typeof showUniDetail === 'function') showUniDetail(x); }
    });
    host.addEventListener('input', function (e) { var r = e.target.getAttribute('data-r'); if (!r || !state.city) return; monthState[r] = +e.target.value; paintMoney(); paintDay(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; host.classList.toggle('is-paused', !visible); }).observe(host);

    var tab = document.getElementById('tabExplore'), tag = document.getElementById('expHeroTag'), builtFor = '';
    function maybe() { if (tab && tab.style.display !== 'none' && builtFor !== cc()) { builtFor = cc(); render(); } }
    if (tab) new MutationObserver(maybe).observe(tab, { attributes: true, attributeFilter: ['style'] });
    if (tag) new MutationObserver(function () { builtFor = ''; closeCity(); maybe(); }).observe(tag, { childList: true, characterData: true, subtree: true });
    // keep each postcard's sky in step with the real time (every few minutes)
    setInterval(function () {
        if (!visible || document.hidden || !state.code) return;
        host.querySelectorAll('.cty-card').forEach(function (c) {
            var n = c.getAttribute('data-city'), h = hourIn(n), o = orbPos(h), t = c.querySelector('.cty-card__time');
            c.style.setProperty('--ox', o.x.toFixed(1) + '%'); c.style.setProperty('--oy', o.y.toFixed(1) + '%');
            ['night', 'dawn', 'day', 'golden', 'dusk'].forEach(function (p) { c.classList.toggle('is-' + p, phaseOf(h) === p); });
            if (t) try { t.textContent = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tzOf(n) }).format(new Date()); } catch (e) {}
        });
    }, 120000);
    maybe();
})();
