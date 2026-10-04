/* ════════════════════════════════════════════════════════════════════
   UniVersity — welcome page behaviour
     • scroll choreography: sticky "pinned" sections driven by one rAF
       scroll handler (statement words light up, features slide sideways,
       the how-it-works path draws, the dark try-it section opens up),
       reveal-on-scroll, a marquee that speeds up with your scroll, count-ups
     • hero search across all 15 countries with suggestions as you type
     • try-it: top 10 per country, search, pagination, a quick-look card
     • student cities with live weather (Open-Meteo, no key needed)
   Everything reads the same data files the app uses (data/<cc>.json).
   Under prefers-reduced-motion the page is static and fully usable.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var WIDE = window.matchMedia('(min-width: 961px)');
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

    var COUNTRIES = [['gb', 'United Kingdom', 'the UK'], ['us', 'United States', 'the US'], ['de', 'Germany'], ['fr', 'France'], ['es', 'Spain'], ['it', 'Italy'],
        ['nl', 'Netherlands', 'the Netherlands'], ['ch', 'Switzerland'], ['ie', 'Ireland'], ['pt', 'Portugal'], ['se', 'Sweden'], ['dk', 'Denmark'],
        ['be', 'Belgium'], ['fi', 'Finland'], ['ua', 'Ukraine']];
    var NAME = {}, SHORT = {};
    COUNTRIES.forEach(function (c) { NAME[c[0]] = c[1]; SHORT[c[0]] = c[2] || c[1]; });
    // The app's own top-university order where it has one (data/app_data.js → RANKING_DATA).
    var RANK = {
        es: ['ucm', 'ub', 'uam', 'upf', 'upc', 'upm', 'uc3m', 'uab', 'upv', 'ie'],
        gb: ['oxford', 'cambridge', 'imperial', 'ucl', 'lse', 'kcl', 'edinburgh', 'manchester', 'warwick', 'durham'],
        fr: ['polytechnique', 'hec', 'sciencespo', 'sorbonne'], de: ['tum', 'lmu', 'heidelberg'], it: ['bocconi', 'polimi', 'sapienza'],
        pt: ['nova', 'ulisboa', 'porto'], us: ['harvard', 'mit', 'stanford', 'caltech', 'princeton', 'yale', 'columbia', 'uc-berkeley', 'carnegie-mellon', 'johns-hopkins'],
        ua: ['knu', 'kpi', 'naukma', 'karazin', 'lpnu', 'ucu'], ch: ['eth-zurich', 'epfl', 'unisg', 'uzh', 'unige', 'iheid']
    };
    var COORDS = {
        Brussels: [50.85, 4.35], Leuven: [50.88, 4.70], Ghent: [51.05, 3.72], Antwerp: [51.22, 4.40],
        Zurich: [47.38, 8.54], Geneva: [46.20, 6.14], Lausanne: [46.52, 6.63], Bern: [46.95, 7.45], Basel: [47.56, 7.59], Lugano: [46.00, 8.95], Fribourg: [46.81, 7.16],
        Berlin: [52.52, 13.40], Munich: [48.14, 11.58], Hamburg: [53.55, 9.99], Heidelberg: [49.40, 8.67], Frankfurt: [50.11, 8.68], Cologne: [50.94, 6.96], Dresden: [51.05, 13.74],
        Copenhagen: [55.68, 12.57], Aarhus: [56.16, 10.20], Odense: [55.40, 10.39], Aalborg: [57.05, 9.92],
        Madrid: [40.42, -3.70], Barcelona: [41.39, 2.17], Valencia: [39.47, -0.38], Sevilla: [37.39, -5.98], Granada: [37.18, -3.60], Bilbao: [43.26, -2.93], Salamanca: [40.97, -5.66],
        Helsinki: [60.17, 24.94], Espoo: [60.21, 24.66], Tampere: [61.50, 23.76], Turku: [60.45, 22.27],
        Paris: [48.86, 2.35], Lyon: [45.76, 4.84], Bordeaux: [44.84, -0.58], Toulouse: [43.60, 1.44], Marseille: [43.30, 5.37], Strasbourg: [48.57, 7.75], Nice: [43.70, 7.27],
        London: [51.51, -0.13], Oxford: [51.75, -1.26], Cambridge: [52.21, 0.12], Edinburgh: [55.95, -3.19], Manchester: [53.48, -2.24], Birmingham: [52.49, -1.89], Leeds: [53.80, -1.55],
        Dublin: [53.35, -6.26], Cork: [51.90, -8.47], Galway: [53.27, -9.05], Limerick: [52.66, -8.63],
        Rome: [41.90, 12.50], Milan: [45.46, 9.19], Florence: [43.77, 11.26], Bologna: [44.49, 11.34], Turin: [45.07, 7.69], Naples: [40.85, 14.27], Venice: [45.44, 12.32],
        Amsterdam: [52.37, 4.90], Rotterdam: [51.92, 4.48], Utrecht: [52.09, 5.12], Delft: [52.01, 4.36], Groningen: [53.22, 6.57], Leiden: [52.16, 4.49],
        Lisbon: [38.72, -9.14], Porto: [41.16, -8.63], Coimbra: [40.21, -8.43], Braga: [41.55, -8.42], Aveiro: [40.64, -8.65], 'Évora': [38.57, -7.91], Faro: [37.02, -7.93],
        Stockholm: [59.33, 18.07], Uppsala: [59.86, 17.64], Gothenburg: [57.71, 11.97], Lund: [55.70, 13.19], 'Linköping': [58.41, 15.62],
        Kyiv: [50.45, 30.52], Lviv: [49.84, 24.03], Kharkiv: [49.99, 36.23], Odesa: [46.48, 30.72], Dnipro: [48.46, 35.05], Zaporizhzhia: [47.84, 35.14], Vinnytsia: [49.23, 28.47],
        Boston: [42.36, -71.06], 'New York': [40.71, -74.01], 'San Francisco': [37.77, -122.42], 'Los Angeles': [34.05, -118.24], Chicago: [41.88, -87.63], Austin: [30.27, -97.74], Seattle: [47.61, -122.33]
    };

    /* ── Data ──────────────────────────────────────────────────────── */
    var cache = {};
    function load(cc) {
        if (!cache[cc]) cache[cc] = fetch('data/' + cc + '.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .then(function (d) { (d.universities || []).forEach(function (u) { u.cc = cc; }); return d; })
            .catch(function (e) { delete cache[cc]; throw e; });
        return cache[cc];
    }
    function ranked(d, cc) {
        var list = (d.universities || []).slice(), order = RANK[cc] || [];
        var pos = function (u) { var i = order.indexOf(u.id); return i === -1 ? 999 : i; };
        return list.sort(function (a, b) { return pos(a) - pos(b) || (b.diff || 0) - (a.diff || 0) || (a.founded || 9999) - (b.founded || 9999) || a.name.localeCompare(b.name); });
    }
    function domain(u) { try { return new URL(u.website).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
    function initials(u) { return String(u.abbr || u.name || '?').replace(/[^A-Za-zÀ-ÿ0-9]/g, '').slice(0, 4).toUpperCase(); }
    function logo(u, cls) {
        var d = domain(u);
        return '<span class="logo ' + (cls || '') + '" style="--c:' + esc(u.color || '#2e3cff') + '"><span class="logo__mono">' + esc(initials(u)) + '</span>' +
            (d ? '<img src="https://www.google.com/s2/favicons?domain=' + esc(d) + '&amp;sz=128" data-d="' + esc(d) + '" alt="" loading="lazy" onload="uvLogo(this)" onerror="uvLogoErr(this)">' : '') + '</span>';
    }
    // Google's favicon service has the best crests; when it only has a tiny generic icon, try icon.horse.
    window.uvLogo = function (img) {
        if (img.naturalWidth < 32 && !img.__alt) { img.__alt = 1; img.src = 'https://icon.horse/icon/' + img.getAttribute('data-d'); return; }
        img.parentNode.classList.add('has-img');
    };
    window.uvLogoErr = function (img) { if (!img.__alt) { img.__alt = 1; img.src = 'https://icon.horse/icon/' + img.getAttribute('data-d'); } else img.remove(); };
    function defaultCountry() {
        try { var saved = localStorage.getItem('uv_welcome_cc'); if (saved && NAME[saved]) return saved; } catch (e) {}
        var langs = navigator.languages || [navigator.language || 'en-GB'];
        var LANG = { de: 'de', fr: 'fr', es: 'es', it: 'it', pt: 'pt', nl: 'nl', sv: 'se', da: 'dk', fi: 'fi', uk: 'ua' };
        for (var i = 0; i < langs.length; i++) {
            var p = String(langs[i]).toLowerCase().split('-'), region = p[1];
            if (region && NAME[region === 'uk' ? 'gb' : region]) return region === 'uk' ? 'gb' : region;
            if (LANG[p[0]]) return LANG[p[0]];
        }
        return 'gb';
    }

    /* ── Small helpers used in several places ─────────────────────── */
    $('year').textContent = new Date().getFullYear();
    function daysTo(mmdd) {
        var t = new Date(); t.setHours(0, 0, 0, 0);
        var p = mmdd.split('-'), d = new Date(t.getFullYear(), +p[0] - 1, +p[1]);
        if (d < t) d.setFullYear(d.getFullYear() + 1);
        return Math.round((d - t) / 864e5);
    }
    document.querySelectorAll('[data-days-to]').forEach(function (el) { el.textContent = daysTo(el.getAttribute('data-days-to')); });
    var tagB = $('heroTagB'); if (tagB) { var n = daysTo('10-15'); tagB.innerHTML = '<i class="fa-regular fa-calendar"></i> Oxford &amp; Cambridge UCAS &middot; ' + (n === 0 ? 'today' : n + ' day' + (n === 1 ? '' : 's') + ' left'); }

    /* ── Split headings into words (they rise in on reveal) ───────── */
    document.querySelectorAll('[data-split]').forEach(function (el) {
        var i = 0;
        (function walk(node) {
            Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
                if (ch.nodeType === 3) {
                    var frag = document.createDocumentFragment();
                    ch.textContent.split(/(\s+)/).forEach(function (part) {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
                        var w = document.createElement('span'); w.className = 'w';
                        var inner = document.createElement('span'); inner.textContent = part; inner.style.setProperty('--i', i++);
                        w.appendChild(inner); frag.appendChild(w);
                    });
                    node.replaceChild(frag, ch);
                } else if (ch.nodeType === 1) walk(ch);
            });
        })(el);
        el.classList.add('split');
        el.setAttribute('data-reveal-split', '');
    });

    /* ── Reveal on scroll ─────────────────────────────────────────── */
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
        en.forEach(function (x) {
            if (!x.isIntersecting) return;
            x.target.classList.add('is-in');
            if (x.target.classList.contains('panel')) x.target.classList.add('is-on');
            if (x.target.classList.contains('num')) countUp(x.target.querySelector('[data-count]'));
            io.unobserve(x.target);
        });
    }, { rootMargin: '0px 0px -10% 0px' }) : null;
    function watch(el) { if (io && !REDUCED) io.observe(el); else { el.classList.add('is-in', 'is-on'); if (el.classList.contains('num')) countUp(el.querySelector('[data-count]')); } }
    document.querySelectorAll('[data-reveal], .split, .cities, .final').forEach(watch);
    function watchPanels() { if (!WIDE.matches || REDUCED) document.querySelectorAll('.panel').forEach(watch); }
    watchPanels();

    function countUp(el) {
        if (!el || el.__done) return;
        el.__done = 1;
        var to = +el.getAttribute('data-count'), pre = el.getAttribute('data-prefix') || '';
        if (REDUCED || !to) { el.textContent = pre + to.toLocaleString('en-GB'); return; }
        var t0 = null;
        requestAnimationFrame(function step(t) {
            if (t0 === null) t0 = t;
            var k = Math.min(1, (t - t0) / 1500), e = 1 - Math.pow(1 - k, 4);
            el.textContent = pre + Math.round(to * e).toLocaleString('en-GB');
            if (k < 1) requestAnimationFrame(step);
        });
    }

    /* ── Hero: rotating last words ────────────────────────────────── */
    var ROT = ['fits you', 'you can afford', 'you’ll get into', 'you’ll love'], rotI = 0, rotEl = $('heroRot');
    function setRot(text) { rotEl.innerHTML = text.split('').map(function (c, i) { return '<span class="ch" style="--i:' + i + '">' + (c === ' ' ? '&nbsp;' : esc(c)) + '</span>'; }).join(''); }
    setRot(ROT[0]);
    if (!REDUCED) setInterval(function () {
        if (document.hidden) return;
        rotEl.querySelectorAll('.ch').forEach(function (c) { c.classList.add('out'); });
        setTimeout(function () { rotI = (rotI + 1) % ROT.length; setRot(ROT[rotI]); }, 420);
    }, 3200);

    /* ── Hero: a fanned stack of real top universities ────────────── */
    var visual = $('heroVisual'), stackEl = $('heroStack');
    function renderStack(cc) {
        load(cc).then(function (d) {
            var top = ranked(d, cc).slice(0, 4);
            stackEl.innerHTML = top.map(function (u, k) {
                return '<article class="scard" style="--k:' + k + '"><div class="scard__top">' + logo(u, 'scard__logo') + '<span class="scard__rank">#' + (k + 1) + ' in ' + esc(SHORT[cc]) + '</span></div>' +
                    '<h3 class="scard__name">' + esc(u.name) + '</h3><p class="scard__city">' + esc(u.city) + ' &middot; ' + esc(u.type || '') + '</p>' +
                    '<div class="scard__row"><span>Tuition</span><b>' + esc(u.tuition || '—') + '</b></div>' +
                    '<div class="scard__row"><span>Entry</span><b>' + esc(u.dl || '—') + '</b></div></article>';
            }).join('');
        }).catch(function () {});
    }
    if (!REDUCED) visual.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = visual.getBoundingClientRect();
        stackEl.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3));
        stackEl.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3));
    });
    visual.addEventListener('pointerleave', function () { stackEl.style.setProperty('--mx', 0); stackEl.style.setProperty('--my', 0); });

    /* ── Hero search: every country, suggestions as you type ──────── */
    var hq = $('heroQ'), sug = $('heroSug'), index = null, indexing = null, sugItems = [], sugActive = -1;
    function buildIndex() {
        if (indexing) return indexing;
        indexing = Promise.all(COUNTRIES.map(function (c) { return load(c[0]).catch(function () { return { universities: [] }; }); }))
            .then(function (all) { index = []; all.forEach(function (d) { index = index.concat(d.universities || []); }); return index; });
        return indexing;
    }
    function match(list, q) {
        var n = norm(q).trim();
        if (!n) return [];
        return list.map(function (u) {
            var nm = norm(u.name), ab = norm(u.abbr), city = norm(u.city), f = norm((u.fields || []).join(' '));
            var s = nm.indexOf(n) === 0 || ab === n ? 0 : nm.indexOf(' ' + n) !== -1 ? 1 : city.indexOf(n) === 0 ? 2 : nm.indexOf(n) !== -1 || ab.indexOf(n) === 0 ? 3 : f.indexOf(n) !== -1 ? 4 : 9;
            return { u: u, s: s + (u.diff ? (5 - u.diff) * .05 : 0) };
        }).filter(function (x) { return x.s < 9; }).sort(function (a, b) { return a.s - b.s || a.u.name.localeCompare(b.u.name); }).map(function (x) { return x.u; });
    }
    function showSug() {
        var q = hq.value;
        if (!q.trim()) { hideSug(); return; }
        if (!index) { sug.innerHTML = '<li class="sug--load">Loading 926 universities…</li>'; sug.hidden = false; buildIndex().then(showSug); return; }
        var seenN = {};
        sugItems = match(index, q).filter(function (u) { var k = u.cc + '|' + norm(u.name); if (seenN[k]) return false; seenN[k] = 1; return true; }).slice(0, 7);
        sugActive = sugItems.length ? 0 : -1;
        sug.innerHTML = sugItems.length ? sugItems.map(function (u, i) {
            return '<li class="sug' + (i === sugActive ? ' is-on' : '') + '" role="option" id="sug' + i + '" data-i="' + i + '" aria-selected="' + (i === sugActive) + '">' + logo(u, 'sug__logo') +
                '<span><b>' + esc(u.name) + '</b><small>' + esc(u.city) + ', ' + esc(NAME[u.cc]) + '</small></span><span class="fi fi-' + esc(u.cc) + '"></span></li>';
        }).join('') : '<li class="sug--none">No university or city called “' + esc(q) + '” yet.</li>';
        sug.hidden = false; hq.setAttribute('aria-expanded', 'true');
        if (sugActive >= 0) hq.setAttribute('aria-activedescendant', 'sug0');
    }
    function hideSug() { sug.hidden = true; hq.setAttribute('aria-expanded', 'false'); hq.removeAttribute('aria-activedescendant'); }
    function moveSug(d) {
        if (!sugItems.length) return;
        sugActive = (sugActive + d + sugItems.length) % sugItems.length;
        sug.querySelectorAll('.sug').forEach(function (li, i) { li.classList.toggle('is-on', i === sugActive); li.setAttribute('aria-selected', i === sugActive); });
        hq.setAttribute('aria-activedescendant', 'sug' + sugActive);
    }
    function pickUni(u) { hideSug(); hq.blur(); goTry(u.cc, '', u.id); }
    var sugT = 0;
    hq.addEventListener('focus', function () { buildIndex(); if (hq.value.trim()) showSug(); });
    hq.addEventListener('input', function () { clearTimeout(sugT); sugT = setTimeout(showSug, 90); });
    hq.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); moveSug(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveSug(-1); }
        else if (e.key === 'Escape') hideSug();
    });
    sug.addEventListener('mousedown', function (e) { var li = e.target.closest('[data-i]'); if (li) { e.preventDefault(); pickUni(sugItems[+li.getAttribute('data-i')]); } });
    document.addEventListener('mousedown', function (e) { if (!e.target.closest('#heroSearch')) hideSug(); });
    $('heroSearch').addEventListener('submit', function (e) {
        e.preventDefault();
        var q = hq.value.trim();
        if (sugActive >= 0 && sugItems[sugActive] && !sug.hidden) { pickUni(sugItems[sugActive]); return; }
        buildIndex().then(function () {
            var m = match(index, q);
            hideSug();
            goTry(m.length ? m[0].cc : tryCC, q, null);
        });
    });

    /* ── Marquee: the world's top 10 (QS World University Rankings 2027),
       crests from Wikimedia Commons; speeds up with your scroll ─────── */
    var WM = 'https://upload.wikimedia.org/wikipedia/';
    var WORLD10 = [
        [1, 'MIT', 'us', WM + 'commons/thumb/b/b8/MIT_2023_red_logo.svg/330px-MIT_2023_red_logo.svg.png'],
        [2, 'Imperial College London', 'gb', WM + 'commons/thumb/c/c5/Shield_of_Imperial_College_London.svg/330px-Shield_of_Imperial_College_London.svg.png'],
        [2, 'Stanford', 'us', WM + 'commons/thumb/b/b5/Seal_of_Leland_Stanford_Junior_University.svg/330px-Seal_of_Leland_Stanford_Junior_University.svg.png'],
        [4, 'Oxford', 'gb', WM + 'commons/thumb/e/e4/Arms_of_University_of_Oxford.svg/330px-Arms_of_University_of_Oxford.svg.png'],
        [5, 'Harvard', 'us', WM + 'commons/thumb/c/cc/Harvard_University_coat_of_arms.svg/330px-Harvard_University_coat_of_arms.svg.png'],
        [6, 'Cambridge', 'gb', WM + 'commons/thumb/c/c3/Coat_of_Arms_of_the_University_of_Cambridge.svg/330px-Coat_of_Arms_of_the_University_of_Cambridge.svg.png'],
        [7, 'Caltech', 'us', WM + 'commons/thumb/7/75/Caltech_Logo.svg/330px-Caltech_Logo.svg.png'],
        [8, 'ETH Z\u00fcrich', 'ch', WM + 'commons/thumb/9/99/ETH_Z%C3%BCrich_Logo_black.svg/330px-ETH_Z%C3%BCrich_Logo_black.svg.png'],
        [8, 'UCL', 'gb', WM + 'en/thumb/c/c2/UCL_Logo%2C_plain_background.svg/330px-UCL_Logo%2C_plain_background.svg.png'],
        [10, 'NUS', 'sg', WM + 'en/thumb/b/b9/NUS_coat_of_arms.svg/330px-NUS_coat_of_arms.svg.png']
    ];
    var marqRow = $('marqRow');
    var marqHTML = WORLD10.map(function (u) {
        return '<span class="marq__item"><span class="marq__rank">' + (u[0] < 10 ? '0' : '') + u[0] + '</span><span class="marq__crest"><img src="' + u[3] + '" alt="" loading="lazy" onerror="this.parentNode.classList.add(\'is-missing\')"></span>' + esc(u[1]) + '</span>';
    }).join('');
    marqRow.innerHTML = marqHTML + marqHTML;
    var mx = 0, mVel = 0, mDir = 1, mLast = 0;
    function marqLoop(t) {
        var dt = mLast ? Math.min(50, t - mLast) : 16; mLast = t;
        mVel *= 0.92;
        mx -= mDir * (0.045 * dt + mVel);
        var half = marqRow.scrollWidth / 2;
        if (half) { if (mx <= -half) mx += half; if (mx > 0) mx -= half; }
        marqRow.style.transform = 'translate3d(' + mx.toFixed(1) + 'px,0,0)';
        requestAnimationFrame(marqLoop);
    }
    if (!REDUCED) requestAnimationFrame(marqLoop);

    /* ── Statement words ──────────────────────────────────────────── */
    var st = $('statement'), stWords = [];
    (function () {
        var html = st.innerHTML.replace(/&nbsp;/g, ' '), idx = 0;
        st.innerHTML = html.split(/(\s+)/).map(function (w) {
            if (!w.trim()) return w;
            return '<span class="sw' + (/^(one|place)/i.test(w.replace(/[^a-z]/gi, '')) && /one|place/i.test(w) ? ' is-mark' : '') + '">' + w + '</span>';
        }).join('');
        stWords = Array.prototype.slice.call(st.querySelectorAll('.sw'));
    })();

    var tabsBox = $('tabs'), tabEls = Array.prototype.slice.call(tabsBox.querySelectorAll('.tab'));
    if (REDUCED) tabsBox.style.setProperty('--one', 1);

    /* ── Features: sizes for the sideways scroll ──────────────────── */
    var feat = $('features'), track = $('featTrack'), panels = Array.prototype.slice.call(track.querySelectorAll('.panel')), featShift = 0;
    function sizeFeatures() {
        if (!WIDE.matches || REDUCED) { feat.style.height = ''; track.style.removeProperty('--tx'); featShift = 0; watchPanels(); return; }
        featShift = Math.max(0, track.scrollWidth - window.innerWidth);
        feat.style.height = (featShift * 1.15 + window.innerHeight) + 'px';
    }

    /* ── One scroll handler for everything scroll-linked ──────────── */
    var nav = $('nav'), navProg = $('navProgress'), lastY = window.scrollY, ticking = false;
    var how = $('how'), tryEl = $('try'), hero = $('top'), finEl = $('final');
    var darkZones = [document.querySelector('.final__in'), document.querySelector('.foot')];
    function progressOf(el) {
        var r = el.getBoundingClientRect(), span = el.offsetHeight - window.innerHeight;
        return span > 0 ? clamp(-r.top / span, 0, 1) : (r.top < 0 ? 1 : 0);
    }
    function onScroll() {
        ticking = false;
        var y = window.scrollY, vh = window.innerHeight, dy = y - lastY; lastY = y;
        // nav: solid after the top, hides going down, dark over dark sections, reading progress
        nav.classList.toggle('is-solid', y > 20);
        if (!document.querySelector('.nav__links.is-open')) nav.classList.toggle('is-hidden', dy > 4 && y > 500);
        if (dy < -4) nav.classList.remove('is-hidden');
        var dark = darkZones.some(function (z) { if (!z) return false; var r = z.getBoundingClientRect(); return r.top <= 36 && r.bottom >= 36; });
        nav.classList.toggle('is-dark', dark);
        var max = document.documentElement.scrollHeight - vh;
        navProg.style.setProperty('--sp', max > 0 ? (y / max).toFixed(4) : 0);
        if (!REDUCED) {
            mVel = clamp(mVel + Math.abs(dy) * 0.02, 0, 8); if (dy) mDir = dy > 0 ? 1 : -1;
            hero.style.setProperty('--hp', clamp(y / (vh * .9), 0, 1).toFixed(3));
            stackEl.style.setProperty('--hp', clamp(y / (vh * .9), 0, 1).toFixed(3));
            // statement: light words in reading order
            var sp = progressOf($('why')), lit = Math.round(clamp(sp * 1.25, 0, 1) * stWords.length);
            for (var i = 0; i < stWords.length; i++) stWords[i].classList.toggle('is-lit', i < lit);
            // the open tabs fly together into one card
            tabEls.forEach(function (t, k) { t.style.setProperty('--m', clamp((sp - .12 - k * .025) / .45, 0, 1).toFixed(3)); });
            tabsBox.style.setProperty('--one', clamp((sp - .6) / .25, 0, 1).toFixed(3));
            // features: slide the track sideways
            if (featShift) {
                var fp = progressOf(feat);
                track.style.setProperty('--tx', (-fp * featShift).toFixed(1) + 'px');
                $('featBar').parentNode.style.setProperty('--fp', fp.toFixed(3));
                var cur = Math.min(panels.length - 1, Math.round(fp * (panels.length - 1)));
                $('featNow').textContent = String(cur + 1).padStart(2, '0');
                panels.forEach(function (p, k) { if (Math.abs(k - fp * (panels.length - 1)) < .75) p.classList.add('is-on'); });
            }
            // how it works: path draws, steps appear
            if (WIDE.matches) {
                var hp = progressOf(how);
                how.style.setProperty('--hp', clamp(hp * 1.3, 0, 1).toFixed(3));
                how.querySelectorAll('.how__step').forEach(function (s, k) { s.classList.toggle('is-on', hp * 1.3 > k * .33 + .02); });
            }
            // try-it: the card straightens as it arrives
            var tr = tryEl.getBoundingClientRect();
            tryEl.style.setProperty('--tp', clamp((vh - tr.top) / (vh * .8), 0, 1).toFixed(3));
            // final: the orbit flies in from far away as the section scrolls up
            var fr = finEl.getBoundingClientRect();
            finEl.style.setProperty('--fp', clamp((vh - fr.top) / (vh * .9), 0, 1).toFixed(3));
        }
    }
    function requestScroll() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', function () { sizeFeatures(); requestScroll(); });
    if (WIDE.addEventListener) WIDE.addEventListener('change', function () { sizeFeatures(); requestScroll(); });
    if (REDUCED) { stWords.forEach(function (w) { w.classList.add('is-lit'); }); how.querySelectorAll('.how__step').forEach(function (s) { s.classList.add('is-on'); }); panels.forEach(function (p) { p.classList.add('is-on'); }); }

    /* ── Nav burger ───────────────────────────────────────────────── */
    var burger = $('burger'), links = $('navLinks');
    burger.addEventListener('click', function () { var open = links.classList.toggle('is-open'); burger.setAttribute('aria-expanded', open); if (open) nav.classList.remove('is-hidden'); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) { links.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); } });

    /* ── Try it: a bright, compact strip of flip cards ──────────────
       Top 10 for the chosen country (5 per page), search, and a tap
       flips a card to its details. ─────────────────────────────────── */
    var PER = 5, tryCC = defaultCountry(), tryQuery = '', tryPage = 1, tryData = null, tryFlip = null;
    var tList = $('tryList'), tPager = $('tryPager'), tQ = $('tryQ'), tSel = $('tryCountry'), tFlag = $('tryFlag');
    tSel.innerHTML = COUNTRIES.map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + '</option>'; }).join('');
    function tryList() {
        if (!tryData) return [];
        var all = ranked(tryData, tryCC);
        return tryQuery.trim() ? match(all, tryQuery) : all.slice(0, 10);
    }
    function tile(u, rank, i) {
        var facts = [['Type', u.type], ['Founded', u.founded], ['Students', u.students], ['Entry', u.dl]].filter(function (f) { return f[1]; }).slice(0, 4);
        return '<li class="tile' + (tryFlip === u.id ? ' is-flipped' : '') + '" style="--i:' + i + '"><button type="button" class="tile__btn" data-id="' + esc(u.id) + '" aria-pressed="' + (tryFlip === u.id) + '" aria-label="' + esc(u.name) + ' \u2014 show details">' +
            '<span class="tile__face tile__front">' +
                '<span class="tile__rank">' + (rank ? String(rank).padStart(2, '0') : '\u2022') + '</span>' + logo(u, 'tile__logo') +
                '<b class="tile__name">' + esc(u.name) + '</b><span class="tile__city">' + esc(u.city) + '</span>' +
                '<span class="tile__fee">' + esc(u.tuition || u.dl || '') + '</span></span>' +
            '<span class="tile__face tile__back">' +
                '<b class="tile__bname">' + esc(u.abbr && u.abbr.length <= 14 ? u.abbr : u.name) + '</b>' +
                '<span class="tile__facts">' + facts.map(function (f) { return '<span><em>' + f[0] + '</em>' + esc(f[1]) + '</span>'; }).join('') + '</span>' +
                ((u.fields || []).length ? '<span class="tile__tags">' + u.fields.slice(0, 3).map(function (f) { return '<i>' + esc(f) + '</i>'; }).join('') + '</span>' : '') +
            '</span></button>' +
            '<a class="tile__save" href="log-in.html" tabindex="' + (tryFlip === u.id ? '0' : '-1') + '">Save &amp; compare <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></li>';
    }
    function renderTry() {
        tSel.value = tryCC;
        tFlag.className = 'fi fi-' + tryCC;
        tSel.parentNode.setAttribute('data-label', NAME[tryCC]);
        var list = tryList(), pages = Math.max(1, Math.ceil(list.length / PER));
        tryPage = clamp(tryPage, 1, pages);
        var start = (tryPage - 1) * PER, rows = list.slice(start, start + PER);
        $('tryMeta').textContent = tryQuery.trim() ? list.length + ' match' + (list.length === 1 ? '' : 'es') + ' in ' + SHORT[tryCC] : 'Top 10 of ' + (tryData.universities || []).length + ' universities in ' + SHORT[tryCC];
        tList.innerHTML = rows.length ? rows.map(function (u, i) { return tile(u, tryQuery.trim() ? 0 : start + i + 1, i); }).join('')
            : '<li class="try__none">Nothing matches \u201c' + esc(tryQuery) + '\u201d in ' + esc(SHORT[tryCC]) + '. Try a city, a subject or another country.</li>';
        var btns = '';
        if (pages > 1) {
            btns += '<button type="button" data-pg="' + (tryPage - 1) + '"' + (tryPage === 1 ? ' disabled' : '') + ' aria-label="Previous page"><i class="fa-solid fa-arrow-left"></i></button>';
            for (var p = 1; p <= pages; p++) {
                if (pages > 7 && p !== 1 && p !== pages && Math.abs(p - tryPage) > 1) { if (p === 2 || p === pages - 1) btns += '<span class="pager__gap">\u2026</span>'; continue; }
                btns += '<button type="button" data-pg="' + p + '"' + (p === tryPage ? ' aria-current="page"' : '') + '>' + p + '</button>';
            }
            btns += '<button type="button" data-pg="' + (tryPage + 1) + '"' + (tryPage === pages ? ' disabled' : '') + ' aria-label="Next page"><i class="fa-solid fa-arrow-right"></i></button>';
        }
        tPager.innerHTML = btns;
    }
    function setCountry(cc, q, sel) {
        tryCC = cc; tryQuery = q || ''; tQ.value = tryQuery; tryPage = 1; tryFlip = sel || null;
        try { localStorage.setItem('uv_welcome_cc', cc); } catch (e) {}
        tSel.value = cc; tFlag.className = 'fi fi-' + cc; tSel.parentNode.setAttribute('data-label', NAME[cc]);
        tList.innerHTML = '<li class="try__none">Loading ' + esc(NAME[cc]) + '\u2026</li>';
        return load(cc).then(function (d) {
            if (tryCC !== cc) return;
            tryData = d;
            if (sel) {   // open the page that holds the chosen university
                var list = tryList(), i = list.findIndex(function (u) { return u.id === sel; });
                if (i === -1) { tryQuery = (d.universities.filter(function (u) { return u.id === sel; })[0] || {}).name || ''; tQ.value = tryQuery; list = tryList(); i = list.findIndex(function (u) { return u.id === sel; }); }
                tryPage = i >= 0 ? Math.floor(i / PER) + 1 : 1;
            }
            renderTry();
            renderCities(cc, d);
        }).catch(function () { tList.innerHTML = '<li class="try__none">Couldn\u2019t load ' + esc(NAME[cc]) + ' right now.</li>'; });
    }
    function goTry(cc, q, sel) {
        setCountry(cc, q, sel);
        $('try').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    }
    tSel.addEventListener('change', function () { setCountry(tSel.value, '', null); renderStack(tSel.value); });
    tList.addEventListener('click', function (e) {
        var b = e.target.closest('.tile__btn'); if (!b) return;
        var id = b.getAttribute('data-id');
        tryFlip = tryFlip === id ? null : id;
        tList.querySelectorAll('.tile').forEach(function (t) {
            var on = t.querySelector('.tile__btn').getAttribute('data-id') === tryFlip;
            t.classList.toggle('is-flipped', on);
            t.querySelector('.tile__btn').setAttribute('aria-pressed', on);
            t.querySelector('.tile__save').tabIndex = on ? 0 : -1;
        });
    });
    tPager.addEventListener('click', function (e) { var b = e.target.closest('[data-pg]'); if (!b || b.disabled) return; tryPage = +b.getAttribute('data-pg'); tryFlip = null; renderTry(); });
    var tqT = 0;
    tQ.addEventListener('input', function () { clearTimeout(tqT); tqT = setTimeout(function () { tryQuery = tQ.value; tryPage = 1; tryFlip = null; renderTry(); }, 120); });

    /* ── Cities with live weather ─────────────────────────────────── */
    var cityTrack = $('cityTrack');
    function sky(code, day) {
        if (code == null) return { cls: '', label: '', ic: 'fa-cloud' };
        if (code === 0 || code === 1) return day ? { cls: 'sun', label: 'Clear', ic: 'fa-sun' } : { cls: 'night', label: 'Clear night', ic: 'fa-moon' };
        if (code === 2) return day ? { cls: 'partly', label: 'Partly cloudy', ic: 'fa-cloud-sun' } : { cls: 'night', label: 'Partly cloudy', ic: 'fa-cloud-moon' };
        if (code === 3) return { cls: 'cloud', label: 'Overcast', ic: 'fa-cloud' };
        if (code <= 48) return { cls: 'fog', label: 'Fog', ic: 'fa-smog' };
        if (code <= 67 || (code >= 80 && code <= 82)) return { cls: 'rain', label: code <= 57 ? 'Drizzle' : code >= 80 ? 'Showers' : 'Rain', ic: 'fa-cloud-rain' };
        if (code <= 77 || code === 85 || code === 86) return { cls: 'snow', label: 'Snow', ic: 'fa-snowflake' };
        return { cls: 'storm', label: 'Thunderstorm', ic: 'fa-cloud-bolt' };
    }
    function scenery(cls) {
        var cloud = function (x, y, w, t, dl) { return '<i class="sky__cloud" style="--x:' + x + '%;--y:' + y + 'px;--w:' + w + 'px;--t:' + t + 's;--dl:-' + dl + 's"></i>'; };
        if (cls === 'sun') return '<i class="sky__sun"></i>';
        if (cls === 'partly') return '<i class="sky__sun"></i>' + cloud(0, 96, 90, 38, 10) + cloud(0, 126, 70, 30, 22);
        if (cls === 'cloud' || cls === 'fog') return cloud(0, 92, 110, 40, 5) + cloud(0, 116, 80, 32, 18) + cloud(0, 134, 120, 46, 30);
        if (cls === 'rain') return cloud(0, 100, 110, 40, 8) + cloud(0, 126, 90, 34, 20) + '<i class="sky__rain"></i>';
        if (cls === 'snow') return cloud(0, 104, 100, 44, 12) + '<i class="sky__snow"></i>';
        if (cls === 'storm') return cloud(0, 100, 120, 40, 8) + cloud(0, 126, 90, 34, 20) + '<i class="sky__rain"></i><i class="sky__bolt fa-solid fa-bolt"></i>';
        if (cls === 'night') return '<i class="sky__stars"></i><i class="sky__moon"></i>';
        return '';
    }
    function renderCities(cc, d) {
        var names = Object.keys(d.cities || {}).filter(function (n) { return COORDS[n]; }).slice(0, 7);
        document.querySelector('.cities .kicker').lastChild.textContent = 'Student cities · ' + NAME[cc];
        cityTrack.innerHTML = names.map(function (n, i) {
            var c = d.cities[n];
            var first = String(c.desc || '').split(/(?<=\.)\s/)[0];
            return '<article class="city" style="--i:' + i + '" data-city="' + esc(n) + '">' +
                '<div class="sky"><div class="sky__load">Checking the sky&hellip;</div></div>' +
                '<div class="city__body"><h3 class="city__name">' + esc(n) + '</h3><p class="city__region">' + esc(c.region || '') + '</p>' +
                    '<dl class="city__facts"><div><dt>Student budget</dt><dd>' + esc(c.cost || '—') + '</dd></div><div><dt>Population</dt><dd>' + esc(c.pop || '—') + '</dd></div><div><dt>Climate</dt><dd>' + esc(c.climate || '—') + '</dd></div><div><dt>Universities</dt><dd>' + (d.universities || []).filter(function (u) { return u.city === n; }).length + '</dd></div></dl>' +
                    (first ? '<p class="city__desc">' + esc(first) + '</p>' : '') +
                    '<div class="fc fc--load"></div></div></article>';
        }).join('');
        cityTrack.scrollLeft = 0;
        if (!names.length) return;
        weather(cc, names).then(function (w) {
            if (!w) { cityTrack.querySelectorAll('.sky__load').forEach(function (e) { e.textContent = 'Weather unavailable right now'; }); cityTrack.querySelectorAll('.fc--load').forEach(function (e) { e.remove(); }); return; }
            names.forEach(function (n, i) {
                var card = cityTrack.querySelector('[data-city="' + CSS.escape(n) + '"]'), x = w[i];
                if (!card || !x || !x.current) return;
                var s = sky(x.current.weather_code, x.current.is_day);
                var skyEl = card.querySelector('.sky');
                skyEl.className = 'sky' + (s.cls ? ' sky--' + s.cls : '');
                skyEl.innerHTML = scenery(REDUCED ? '' : s.cls) + '<div class="sky__now"><span class="sky__temp">' + Math.round(x.current.temperature_2m) + '<small>&deg;C</small></span><span class="sky__desc">' + esc(s.label) + '<small>right now</small></span></div>';
                var dd = x.daily || {}, days = (dd.time || []).slice(0, 5);
                card.querySelector('.fc').outerHTML = '<div class="fc">' + days.map(function (t, k) {
                    var ds = sky(dd.weather_code[k], 1), dt = new Date(t + 'T12:00:00');
                    return '<div class="fc__d" title="' + esc(ds.label) + '"><span>' + (k ? dt.toLocaleDateString('en-GB', { weekday: 'short' }) : 'Today') + '</span><i class="fa-solid ' + ds.ic + '" aria-hidden="true"></i><b>' + Math.round(dd.temperature_2m_max[k]) + '&deg;</b><small>' + Math.round(dd.temperature_2m_min[k]) + '&deg;</small></div>';
                }).join('') + '</div>';
            });
        });
    }
    function weather(cc, names) {
        var key = 'uv_wx_' + cc;
        try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 30 * 6e4 && c.n === names.join('|')) return Promise.resolve(c.w); } catch (e) {}
        var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + names.map(function (n) { return COORDS[n][0]; }).join(',') +
            '&longitude=' + names.map(function (n) { return COORDS[n][1]; }).join(',') +
            '&current=temperature_2m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5';
        return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (w) {
            w = Array.isArray(w) ? w : [w];
            try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), n: names.join('|'), w: w })); } catch (e) {}
            return w;
        }).catch(function () { return null; });
    }
    // drag to scroll the city strip with a mouse
    (function () {
        var down = false, sx = 0, sl = 0, moved = false;
        cityTrack.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = cityTrack.scrollLeft; });
        window.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; cityTrack.classList.add('is-drag'); } cityTrack.scrollLeft = sl - dx; });
        window.addEventListener('pointerup', function () { if (!down) return; down = false; cityTrack.classList.remove('is-drag'); });
        cityTrack.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    })();

    /* ── Final: crests orbiting the logo in 3D ──────────────────────
       Two tilted rings (ten crests each way) spin in opposite directions;
       crests always face you, and the whole orbit tilts with the pointer. */
    (function () {
        function ring(el, list, n) {
            el.innerHTML = list.map(function (u, i) {
                return '<span class="orbit__item" style="--a:' + (i * 360 / n).toFixed(2) + 'deg"><span class="orbit__face"><img src="' + u[3] + '" alt="" loading="lazy"></span></span>';
            }).join('');
        }
        ring($('orbitA'), WORLD10.slice(0, 5), 5);
        ring($('orbitB'), WORLD10.slice(5), 5);
        var fin = $('final'), orb = $('orbit');
        if (!REDUCED) fin.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            var r = fin.getBoundingClientRect();
            orb.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5).toFixed(3));
            orb.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5).toFixed(3));
        });
    })();

    /* ── Start ────────────────────────────────────────────────────── */
    renderStack(tryCC);
    setCountry(tryCC, '', null);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sizeFeatures(); requestScroll(); });
    sizeFeatures();
    onScroll();
})();
