/* ════════════════════════════════════════════════════════════════════
   Explore — the motion layer for the redesigned page (styles: explore.css).
   · the headline's last word rotates: university → city → course → future
   · the search placeholder cycles through real examples from this country
   · live counts under the search (universities, cities, public, fields)
   · the country's best universities orbit your photo (click one to open it)
   · the photo tilts a little towards the pointer
   · "/" jumps to the search; sections fade up as they scroll in
   Everything is transform/opacity; loops pause when the hero is off-screen
   or the tab is hidden, and none of it runs under reduced motion.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var tab = document.getElementById('tabExplore');
    var hero = tab && tab.querySelector('.exp__hero');
    if (!tab || !hero) return;
    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function unis() { try { return (typeof UNI !== 'undefined' && UNI) || []; } catch (e) { return []; } }
    function cc() { try { return String(currentCountryCode || '').toLowerCase(); } catch (e) { return ''; } }
    function shown() { return tab.style.display !== 'none' && !document.hidden; }
    function list(v) { if (Array.isArray(v)) return v; try { return JSON.parse(String(v).replace(/'/g, '"')); } catch (e) { return []; } }

    /* ── rotating headline word ────────────────────────────────────── */
    var rot = document.getElementById('exhRot'), WORDS = ['university', 'city', 'course', 'future'], wi = 0, wordT = 0;
    function nextWord() {
        clearTimeout(wordT);
        wordT = setTimeout(nextWord, 2800);
        if (!rot || !shown() || !heroSeen) return;
        var cur = rot.querySelector('.exh__word.is-on');
        wi = (wi + 1) % WORDS.length;
        var nx = document.createElement('span');
        nx.className = 'exh__word';
        nx.textContent = WORDS[wi];
        rot.appendChild(nx);
        void nx.offsetWidth;
        nx.classList.add('is-on');
        if (cur) { cur.classList.remove('is-on'); cur.classList.add('is-out'); setTimeout(function () { cur.remove(); }, 800); }
    }

    /* ── search placeholder with real examples ─────────────────────── */
    var input = document.getElementById('nsInput'), phT = 0, phI = 0;
    function examples() {
        var u = unis();
        if (!u.length) return ['Search a university, a city or a subject…'];
        var top = u.slice().sort(function (a, b) { return (+b.diff || 0) - (+a.diff || 0); });
        var cities = []; u.forEach(function (x) { if (x.city && cities.indexOf(x.city) < 0) cities.push(x.city); });
        return ['Try “' + (top[0].abbr || top[0].name) + '”', 'Try “Medicine in ' + (cities[0] || 'the capital') + '”', 'Try “' + (cities[1] || cities[0] || 'Engineering') + '”',
            'Try “' + (top[2] ? (top[2].abbr || top[2].name) : 'Law') + '”', 'Try “Public engineering”'];
    }
    function nextPlaceholder() {
        clearTimeout(phT);
        phT = setTimeout(nextPlaceholder, 3200);
        if (!input || !shown() || document.activeElement === input || input.value) return;
        var ex = examples();
        input.classList.add('is-swap');
        setTimeout(function () { input.placeholder = ex[phI++ % ex.length]; input.classList.remove('is-swap'); }, 300);
    }

    /* ── counts under the search ───────────────────────────────────── */
    var statsEl = document.getElementById('exhStats'), statsFor = '';
    function renderStats() {
        var u = unis(); if (!statsEl || !u.length) return;
        var key = cc() + ':' + u.length; if (key === statsFor) return; statsFor = key;
        var cities = {}, fields = {}, pub = 0;
        u.forEach(function (x) { if (x.city) cities[x.city] = 1; if (x.type === 'Public') pub++; list(x.fields).forEach(function (f) { fields[f] = 1; }); });
        var rows = [['Universities', u.length], ['Cities', Object.keys(cities).length], ['Public', Math.round(pub / u.length * 100), '%'], ['Fields', Object.keys(fields).length]];
        statsEl.innerHTML = rows.map(function (r) { return '<div class="exh__stat"><dt>' + r[0] + '</dt><dd data-to="' + r[1] + '" data-suf="' + (r[2] || '') + '">0' + (r[2] || '') + '</dd></div>'; }).join('');
        countUp();
    }
    function countUp() {
        var els = statsEl.querySelectorAll('dd');
        if (REDUCED) { els.forEach(function (d) { d.textContent = d.getAttribute('data-to') + d.getAttribute('data-suf'); }); return; }
        var t0 = performance.now(), D = 1300;
        (function step(now) {
            var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 4);
            els.forEach(function (d) { d.textContent = Math.round(+d.getAttribute('data-to') * e) + d.getAttribute('data-suf'); });
            if (k < 1) requestAnimationFrame(step);
        })(t0);
    }

    /* ── the orbit of top universities ─────────────────────────────── */
    var orbit = document.getElementById('exhOrbit'), orbitFor = '';
    function renderOrbit() {
        var u = unis(); if (!orbit || !u.length) return;
        var key = cc() + ':' + u.length; if (key === orbitFor) return; orbitFor = key;
        var ids = (typeof RANKING_DATA !== 'undefined' && RANKING_DATA[cc()]) || [];
        var pick = ids.map(function (id) { return u.find(function (x) { return x.id === id; }); }).filter(Boolean);
        if (pick.length < 8) u.slice().sort(function (a, b) { return (+b.diff || 0) - (+a.diff || 0); }).forEach(function (x) { if (pick.length < 8 && pick.indexOf(x) < 0) pick.push(x); });
        pick = pick.slice(0, 8);
        orbit.innerHTML = pick.map(function (x, k) {
            var a = (k / pick.length * 360 - 90).toFixed(1);
            return '<div class="exh__sat" style="--a:' + a + 'deg;--k:' + k + '"><span data-id="' + x.id + '" title="' + String(x.name).replace(/"/g, '&quot;') + '">' + (typeof uniLogo === 'function' ? uniLogo(x, 30) : '') + '</span></div>';
        }).join('');
        if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(orbit);
    }
    if (orbit) orbit.addEventListener('click', function (e) {
        var s = e.target.closest('[data-id]'); if (!s) return;
        var x = unis().find(function (u) { return u.id === s.getAttribute('data-id'); });
        if (x && typeof showUniDetail === 'function') showUniDetail(x);
    });

    /* ── photo tilt ────────────────────────────────────────────────── */
    var stage = document.getElementById('exhStage'), tiltRaf = 0, tiltEv = null;
    if (stage && !REDUCED && window.matchMedia('(hover: hover)').matches) {
        hero.addEventListener('pointermove', function (e) {
            tiltEv = e;
            if (tiltRaf) return;
            tiltRaf = requestAnimationFrame(function () {
                tiltRaf = 0;
                var r = stage.getBoundingClientRect();
                stage.style.setProperty('--rx', (((tiltEv.clientX - r.left) / r.width - .5) * 10).toFixed(2) + 'deg');
                stage.style.setProperty('--ry', (((tiltEv.clientY - r.top) / r.height - .5) * -8).toFixed(2) + 'deg');
            });
        });
        hero.addEventListener('pointerleave', function () { stage.style.setProperty('--rx', '0deg'); stage.style.setProperty('--ry', '0deg'); });
    }

    /* ── "/" focuses the search ────────────────────────────────────── */
    document.addEventListener('keydown', function (e) {
        if (e.key !== '/' || !shown() || !input) return;
        var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        e.preventDefault(); input.focus();
    });

    /* ── pause the hero's loops off-screen; reveal sections on scroll ─ */
    var heroSeen = true;
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { heroSeen = en[0].isIntersecting; hero.classList.toggle('is-paused', !heroSeen); }).observe(hero);
        var rev = new IntersectionObserver(function (en) {
            en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); rev.unobserve(x.target); } });
        }, { rootMargin: '0px 0px -8% 0px' });
        tab.querySelectorAll('.exp__break, .exp__filter__card').forEach(function (el) { rev.observe(el); });
    }

    /* ── search mode: while you search, the big hero folds into a compact
       search bar so the list of universities sits right under it, in view
       (on a laptop screen it used to start below the fold) ─────────── */
    var results = document.getElementById('nsResults'), searching = false;
    function syncSearch() {
        var on = !!(input && input.value.trim());
        if (on === searching) { if (on) keepInView(); return; }
        searching = on;
        hero.classList.toggle('is-searching', on);
        if (on) keepInView();
    }
    function keepInView() {
        requestAnimationFrame(function () {
            var hdr = 72, r = hero.getBoundingClientRect();
            // bring the search bar near the top so the first results are visible straight away
            if (r.top < hdr - 4 || r.top > 160) window.scrollTo({ top: window.scrollY + r.top - hdr - 12, behavior: REDUCED ? 'auto' : 'smooth' });
        });
    }
    if (input) input.addEventListener('input', syncSearch);
    tab.addEventListener('click', function (e) { if (e.target.closest('.exp__qt, #expClear')) setTimeout(syncSearch, 0); });

    /* ── lifecycle ─────────────────────────────────────────────────── */
    function refresh() { renderStats(); renderOrbit(); }
    new MutationObserver(function () { if (shown()) { statsFor = ''; refresh(); } }).observe(tab, { attributes: true, attributeFilter: ['style'] });
    var tag = document.getElementById('expHeroTag');
    if (tag) new MutationObserver(refresh).observe(tag, { childList: true, characterData: true, subtree: true });   // the country changed
    refresh();
    if (!REDUCED) { wordT = setTimeout(nextWord, 2800); phT = setTimeout(nextPlaceholder, 2400); }
})();
