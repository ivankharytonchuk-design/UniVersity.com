/* ════════════════════════════════════════════════════════════════════
   Scholarships (Explore → Scholarships)

   Deliberately simple: pick a university → see one card per scholarship:
     difficulty (our estimate, with the reason) · how many were awarded ·
     what you get · what it takes · how to get it · when
   No questions asked — the student reads the cards and decides.

   Saving: the bookmark on a card stores it under us_sch_saved_<user>
   (synced by userSync like every us_* key). Saved scholarships show up in
   the "Scholarships" container on the Overview (renderSavedScholarships).

   Data comes only through window.ScholarshipSource (scholarships_data.js).
   Performance: no permanent JS loops; motion is CSS transform/opacity and
   respects prefers-reduced-motion; the hero pauses when off-screen.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var root = document.getElementById('tabScholarships');
    var Source = window.ScholarshipSource;
    if (!root || !Source) return;

    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var CODES = ['gb', 'us', 'ch', 'nl', 'se', 'de', 'fr', 'it', 'es', 'ie', 'dk', 'fi', 'be', 'pt', 'ua'];
    var UID = (window.user && window.user.id) || 'guest';
    var LAST_KEY = 'us_sch_last';
    var SAVED_KEY = 'us_sch_saved_' + UID;
    var FEATURED = ['gb:oxford', 'gb:cambridge', 'us:stanford', 'ch:eth-zurich', 'nl:tud', 'se:kth'];
    var LEVEL = { bachelor: 'Bachelor’s', master: 'Master’s', phd: 'PhD' };
    var BADGE = { academic: 'Academic', need: 'Need-based', leadership: 'Leadership', research: 'Research' };
    var METHOD = {
        automatic: { label: 'Automatic — no extra form', tone: 'good' },
        separate: { label: 'Separate application', tone: 'warn' },
        'course-form': { label: 'Same form as your course', tone: 'info' },
        'aid-forms': { label: 'Financial aid forms', tone: 'warn' },
        varies: { label: 'See the official page', tone: 'muted' }
    };

    var state = { uni: null, data: null, status: 'empty', token: 0, focus: null };

    /* ── Utilities ─────────────────────────────────────────────────── */
    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
    function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function extLink(url, html, cls) {
        return '<a class="' + (cls || 'sch-link') + '" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + html +
            ' <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i><span class="sch-sr"> (opens in a new tab)</span></a>';
    }
    function hydrateLogos(el) { if (typeof window.cmpHydrateLogos === 'function') window.cmpHydrateLogos(el); }
    function mono(u) {
        var a = String(u.abbr || '').trim();
        if (a && a.length <= 4) return a;
        var w = String(u.name).replace(/[–—-].*$/, '').split(/\s+/).filter(function (x) { return /^[A-ZÀ-Ý]/.test(x); });
        return (w.map(function (x) { return x[0]; }).join('') || u.name.slice(0, 2)).slice(0, 3).toUpperCase();
    }
    function shortName(u) {
        if (u.name.length <= 16) return u.name;
        var m = u.name.match(/^University of (.+)$/);
        if (m && m[1].length <= 16) return m[1];
        return u.abbr && u.abbr.length <= 14 ? u.abbr : u.name;
    }
    function logo(u, size) {
        if (typeof window.uniLogo === 'function') {
            try { return window.uniLogo({ name: u.name, abbr: mono(u), color: u.color || '#d97c14', website: u.website }, size); } catch (e) {}
        }
        return '<span class="sch-mono" style="width:' + size + 'px;height:' + size + 'px;background:' + esc(u.color || '#d97c14') + '">' + esc(mono(u)) + '</span>';
    }
    function flag(cc) { return '<span class="fi fi-' + esc(cc) + ' sch-flag" aria-hidden="true"></span>'; }
    function levelsText(s) { return (s.levels || []).map(function (l) { return LEVEL[l]; }).join(' · '); }
    function fmtDate(iso) {
        var t = Date.parse(iso);
        return isNaN(t) ? esc(iso) : new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    }
    function daysLeft(iso) {
        var end = Date.parse(iso) + 864e5 - 1;   // open until the end of that day
        return Math.ceil((end - Date.now()) / 864e5) - 1;
    }

    /* ── Difficulty (our estimate) & deadlines ─────────────────────── */
    function diffLabel(n) { return n >= 9 ? 'Very hard' : n >= 7 ? 'Hard' : n >= 4 ? 'Moderate' : 'Easy to get'; }
    function diffTone(n) { return n >= 9 ? 'vhard' : n >= 7 ? 'hard' : n >= 4 ? 'mid' : 'easy'; }
    /* Next confirmed deadline that hasn't passed (or null). */
    function nextDeadline(s) {
        var dl = ((s.when || {}).deadlines || []).filter(function (d) { return daysLeft(d.date) >= 0; });
        dl.sort(function (a, b) { return Date.parse(a.date) - Date.parse(b.date); });
        return dl[0] || null;
    }
    function leftText(n) { return n === 0 ? 'Closes today' : n === 1 ? '1 day left' : n + ' days left'; }
    function countdown(n) { return '<span class="sch-cd sch-cd--' + (n <= 14 ? 'soon' : 'open') + '">' + leftText(n) + '</span>'; }
    /* Compact timing for chips/tiles: a live countdown when the date is confirmed. */
    function dueInfo(s) {
        var d = nextDeadline(s), w = s.when || {};
        if (d) { var n = daysLeft(d.date); return { tone: n <= 14 ? 'soon' : 'open', icon: 'fa-clock', text: leftText(n) }; }
        if ((w.deadlines || []).length) return { tone: 'closed', icon: 'fa-circle-xmark', text: 'Closed' };
        return { tone: 'plain', icon: 'fa-calendar', text: w.short || w.text || 'See official page' };
    }
    function dueChip(s, cls) {
        var d = dueInfo(s);
        return '<span class="' + cls + ' ' + cls + '--' + d.tone + '"><i class="fa-regular ' + d.icon + '" aria-hidden="true"></i> ' + esc(d.text) + '</span>';
    }

    /* ── Saved scholarships (synced via us_* key) ──────────────────── */
    function getSaved() { try { var a = JSON.parse(lsGet(SAVED_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function isSaved(uniKey, id) { return getSaved().some(function (x) { return x.key === uniKey && x.id === id; }); }
    function toggleSave(uniKey, s, u) {
        var saved = getSaved(), at = -1;
        saved.forEach(function (x, j) { if (x.key === uniKey && x.id === s.id) at = j; });
        if (at !== -1) saved.splice(at, 1);
        else saved.unshift({ key: uniKey, id: s.id, name: s.name, t: Date.now(),
            uni: { name: u.name, abbr: u.abbr, color: u.color, website: u.website, cc: u.cc, id: u.id } });
        lsSet(SAVED_KEY, JSON.stringify(saved));
        renderSavedScholarships();
        return at === -1;
    }

    /* ── University index (reuses the app's data/*.json — browser-cached) ── */
    var index = null, indexPromise = null;
    function loadIndex() {
        if (index) return Promise.resolve(index);
        if (indexPromise) return indexPromise;
        indexPromise = Promise.all(CODES.map(function (cc) {
            return fetch('data/' + cc + '.json')
                .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                .then(function (d) { return { cc: cc, d: d }; })
                .catch(function () { return null; });
        })).then(function (lists) {
            var out = [], seen = {};
            lists.forEach(function (x) {
                if (!x || !x.d || !x.d.universities) return;
                var meta = x.d.meta || {};
                x.d.universities.forEach(function (u) {
                    if (!u || !u.id || !u.name) return;
                    var item = {
                        id: u.id, cc: x.cc, name: u.name, abbr: u.abbr || '', city: u.city || '',
                        color: u.color || '#d97c14', website: u.website || '',
                        country: meta.name || x.cc.toUpperCase(), flag: meta.flag || x.cc
                    };
                    item.key = Source.key(item);
                    if (seen[item.key]) return;
                    seen[item.key] = 1;
                    item.n = norm(item.name); item.a = norm(item.abbr); item.c = norm(item.city);
                    item.profile = Source.hasProfile(item);
                    out.push(item);
                });
            });
            if (!out.length) throw new Error('no_universities');
            index = out;
            return index;
        }).catch(function (e) { indexPromise = null; throw e; });
        return indexPromise;
    }
    function byKey(k) {
        if (!index) return null;
        for (var i = 0; i < index.length; i++) if (index[i].key === k) return index[i];
        return null;
    }
    function search(q) {
        var t = norm(q).trim();
        if (!t || !index) return [];
        var words = t.split(/\s+/), res = [];
        for (var i = 0; i < index.length; i++) {
            var it = index[i], s = 0;
            if (it.n === t || it.a === t) s = 100;
            else if (it.n.indexOf(t) === 0 || it.a.indexOf(t) === 0) s = 80;
            else if (words.every(function (w) { return it.n.indexOf(w) !== -1 || it.a.indexOf(w) !== -1 || it.c.indexOf(w) !== -1; })) {
                s = it.n.split(/[\s\-–—()]+/).some(function (p) { return p.indexOf(words[0]) === 0; }) ? 60 : 40;
            }
            if (!s) continue;
            if (it.profile) s += 8;
            res.push({ it: it, s: s - it.n.length / 200 });
        }
        res.sort(function (a, b) { return b.s - a.s; });
        return res.slice(0, 8).map(function (r) { return r.it; });
    }
    function highlight(name, q) {
        var t = norm(q).trim(), n = norm(name);
        var i = t ? n.indexOf(t) : -1;
        if (i === -1 || n.length !== name.length) return esc(name);
        return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + t.length)) + '</mark>' + esc(name.slice(i + t.length));
    }

    /* ── Search combobox ───────────────────────────────────────────── */
    var input = $('schSearchInput'), listbox = $('schSuggest'), suggestWrap = $('schSuggestWrap'),
        suggestStatus = $('schSuggestStatus'), clearBtn = $('schSearchClear');
    var results = [], active = -1;

    function openSuggest(open) {
        suggestWrap.hidden = !open;
        input.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (!open) { active = -1; input.removeAttribute('aria-activedescendant'); }
    }
    function setActive(i) {
        var opts = listbox.querySelectorAll('[role="option"]');
        if (!opts.length) return;
        active = (i + opts.length) % opts.length;
        opts.forEach(function (o, j) { o.setAttribute('aria-selected', j === active ? 'true' : 'false'); });
        input.setAttribute('aria-activedescendant', opts[active].id);
        opts[active].scrollIntoView({ block: 'nearest' });
    }
    function renderSuggest() {
        var q = input.value;
        clearBtn.hidden = !q;
        if (!q.trim()) {
            results = Source.profiledKeys().map(byKey).filter(Boolean);
            suggestStatus.innerHTML = '<span class="sch-suggest__hint"><i class="fa-solid fa-bolt" aria-hidden="true"></i> Universities with scholarships</span>';
        } else {
            results = search(q);
            suggestStatus.innerHTML = results.length ? '' :
                '<span class="sch-suggest__hint">No university matches “' + esc(q.trim()) + '”. Try the city or a shorter name.</span>';
        }
        listbox.innerHTML = results.map(function (u, i) {
            return '<li role="option" id="schOpt' + i + '" class="sch-opt" aria-selected="false" data-i="' + i + '">' +
                '<span class="sch-opt__logo">' + logo(u, 32) + '</span>' +
                '<span class="sch-opt__txt"><span class="sch-opt__name">' + highlight(u.name, q) + '</span>' +
                '<span class="sch-opt__meta">' + flag(u.flag) + esc(u.city ? u.city + ' · ' : '') + esc(u.country) + '</span></span>' +
                (u.profile ? '<span class="sch-opt__badge"><i class="fa-solid fa-award" aria-hidden="true"></i> Scholarships</span>' : '') +
            '</li>';
        }).join('');
        active = -1;
        input.removeAttribute('aria-activedescendant');
        hydrateLogos(listbox);
        openSuggest(true);
    }
    function suggestLoading() {
        listbox.innerHTML = [0, 1, 2, 3].map(function () {
            return '<li class="sch-opt sch-opt--skel" aria-hidden="true"><span class="sch-skel sch-skel--circle"></span><span class="sch-opt__txt"><span class="sch-skel sch-skel--line" style="width:62%"></span><span class="sch-skel sch-skel--line sch-skel--sm" style="width:38%"></span></span></li>';
        }).join('');
        suggestStatus.innerHTML = '';
        openSuggest(true);
    }
    function suggestError() {
        listbox.innerHTML = '';
        suggestStatus.innerHTML = '<span class="sch-suggest__hint sch-suggest__hint--err"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> Couldn’t load the university list.</span>' +
            '<button type="button" class="sch-btn sch-btn--ghost sch-btn--sm" id="schSuggestRetry">Retry</button>';
        openSuggest(true);
    }
    var pendingRender = false;
    function refreshSuggest() {
        if (index) {
            if (pendingRender) return;
            pendingRender = true;
            requestAnimationFrame(function () { pendingRender = false; renderSuggest(); });
            return;
        }
        suggestLoading();
        loadIndex().then(renderSuggest, suggestError);
    }
    input.addEventListener('input', refreshSuggest);
    input.addEventListener('focus', refreshSuggest);
    input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); if (suggestWrap.hidden) refreshSuggest(); else setActive(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
        else if (e.key === 'Enter') {
            if (suggestWrap.hidden) return;
            e.preventDefault();
            var pick = results[active >= 0 ? active : 0];
            if (pick) selectUni(pick);
        } else if (e.key === 'Escape') {
            if (!suggestWrap.hidden) { e.preventDefault(); openSuggest(false); }
            else if (input.value) { input.value = ''; clearBtn.hidden = true; }
        }
    });
    input.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== input) openSuggest(false); }, 120); });
    listbox.addEventListener('mousedown', function (e) {
        var li = e.target.closest('[role="option"]');
        if (!li) return;
        e.preventDefault();
        selectUni(results[+li.getAttribute('data-i')]);
    });
    suggestStatus.addEventListener('mousedown', function (e) {
        if (e.target.closest('#schSuggestRetry')) { e.preventDefault(); refreshSuggest(); }
    });
    clearBtn.addEventListener('click', function () { input.value = ''; clearBtn.hidden = true; input.focus(); refreshSuggest(); });
    document.addEventListener('keydown', function (e) {
        if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
        var t = e.target;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (root.offsetParent === null) return;
        e.preventDefault();
        input.focus();
    });

    /* ── Selecting a university ────────────────────────────────────── */
    function selectUni(u, opts) {
        if (!u) return;
        opts = opts || {};
        openSuggest(false);
        input.value = '';
        clearBtn.hidden = true;
        if (!opts.keepFocus) input.blur();
        state.uni = u;
        state.focus = opts.focus || null;
        lsSet(LAST_KEY, u.key);
        load();
        if (!opts.silent && !state.focus) {
            var top = $('schBody').getBoundingClientRect().top;
            if (top > window.innerHeight - 180) window.scrollBy({ top: top - window.innerHeight * 0.42, behavior: REDUCED ? 'auto' : 'smooth' });
        }
    }
    function load() {
        var u = state.uni, token = ++state.token;
        state.status = 'loading';
        renderBody();
        var started = Date.now();
        Source.get(u).then(function (data) {
            setTimeout(function () {
                if (token !== state.token) return;
                state.data = data;
                state.status = data.scholarships.length ? 'ready' : 'none';
                renderBody();
                if (state.focus) { focusCard(state.focus); state.focus = null; }
            }, Math.max(0, 260 - (Date.now() - started)));
        }).catch(function () {
            if (token !== state.token) return;
            state.status = 'error';
            renderBody();
        });
    }
    function focusCard(id) {
        var el = $('sch-card-' + id);
        if (!el) return;
        setPage(el, 0);
        el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
        el.classList.remove('is-flash');
        void el.offsetWidth;
        el.classList.add('is-flash');
    }

    /* ── Hero: the selected university's logo floats where the coin was ── */
    var heroEl = $('schHero'), medal = $('schMedal'), sceneCap = $('schSceneCap'), nowEl = $('schNow'), sceneKey = null;
    function countText() {
        if (state.status === 'ready') { var n = state.data.scholarships.length; return n + ' scholarship' + (n === 1 ? '' : 's'); }
        return state.status === 'loading' ? 'Loading scholarships…' : state.status === 'error' ? 'Couldn’t load scholarships' : 'No scholarships listed yet';
    }
    function renderScene() {
        var u = state.uni;
        heroEl.classList.toggle('has-uni', !!u);
        if (!u) return;
        root.style.setProperty('--uc', u.color || '#d97c14');
        if (sceneKey !== u.key) {
            sceneKey = u.key;
            medal.innerHTML = '<div class="sch-medal"><span class="sch-medal__face">' + logo(u, 64) + '</span><span class="sch-medal__shine"></span></div>';
            nowEl.innerHTML = '<span class="sch-now__logo">' + logo(u, 28) + '</span><span class="sch-now__tx"><b>' + esc(u.name) + '</b><small id="schNowCount"></small></span>';
            hydrateLogos(medal); hydrateLogos(nowEl);
            if (!REDUCED) { medal.classList.remove('is-pop'); void medal.offsetWidth; medal.classList.add('is-pop'); }
        }
        sceneCap.innerHTML = '<b>' + esc(u.name) + '</b><span>' + flag(u.flag) + esc(countText()) + '</span>';
        $('schNowCount').textContent = (u.city ? u.city + ', ' : '') + u.country + ' · ' + countText();
    }

    /* ── Cards: small, glassy, paginated ───────────────────────────── */
    var PAGES = [
        { label: 'Overview', icon: 'fa-star' },
        { label: 'What you get', icon: 'fa-gift' },
        { label: 'What it takes', icon: 'fa-list-check' },
        { label: 'How to get it', icon: 'fa-route' },
        { label: 'When', icon: 'fa-calendar-days' }
    ];
    function saveBtn(s, burst) {
        var on = isSaved(state.uni.key, s.id);
        return '<button type="button" class="sch-save' + (on ? ' is-on' : '') + (burst ? ' is-burst' : '') + '" data-save="' + esc(s.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Saved to your Overview — remove ' : 'Save to your Overview: ') + esc(s.name) + '">' +
            '<i class="fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark" aria-hidden="true"></i>' +
            '<span class="sch-save__tip" aria-hidden="true">' + (on ? 'Saved to Overview' : 'Save to Overview') + '</span></button>';
    }
    function list(items, cls) {
        return '<ul class="sch-list' + (cls ? ' ' + cls : '') + '">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    }
    // "9/10" set like the Awarded number, with a 10-step meter underneath.
    function diffScore(n) {
        var steps = '';
        for (var k = 1; k <= 10; k++) steps += '<i' + (k <= n ? ' class="is-on"' : '') + '></i>';
        return '<span class="sch-diff sch-tone--' + diffTone(n) + '" role="img" aria-label="Difficulty ' + n + ' out of 10">' +
            '<b class="sch-ov__big" aria-hidden="true">' + n + '<small>/10</small></b>' +
            '<span class="sch-diff__meter" aria-hidden="true">' + steps + '</span></span>';
    }
    function whenBlock(s) {
        var w = s.when || {}, dls = w.deadlines || [];
        if (!dls.length) return '<p class="sch-when">' + esc(w.text || 'Check the official page') + '</p>';
        return '<ul class="sch-dates">' + dls.map(function (d) {
            var n = daysLeft(d.date);
            return '<li class="' + (n < 0 ? 'is-past' : '') + '"><b>' + fmtDate(d.date) + '</b>' +
                (n < 0 ? '<span class="sch-cd sch-cd--closed">Closed</span>' : countdown(n)) + '<span>' + esc(d.label) + '</span></li>';
        }).join('') + '</ul>' + (w.cycle ? '<p class="sch-when__cycle">Confirmed dates for ' + esc(w.cycle) + '</p>' : '');
    }
    function pageOverview(s) {
        var d = s.difficulty || {}, a = s.awarded || {}, m = METHOD[(s.how || {}).method] || METHOD.varies, n = d.score;
        return '<div class="sch-ov">' +
                (n ? '<div class="sch-ov__cell">' + diffScore(n) + '<span class="sch-ov__k">Difficulty</span><span class="sch-ov__v sch-ov__v--' + diffTone(n) + '">' + diffLabel(n) + '</span></div>' : '') +
                '<div class="sch-ov__cell"><b class="sch-ov__big">' + esc(a.big || '—') + '</b><span class="sch-ov__k">Awarded</span><span class="sch-ov__v">' + esc(a.small || 'not published') + (a.reported ? ' · reported' : '') + '</span></div>' +
            '</div>' +
            (d.basis ? '<p class="sch-basis"><b>Why ' + n + '/10 ·</b> ' + esc(d.basis) + '</p>' : '') +
            '<div class="sch-tags"><span class="sch-method sch-method--' + m.tone + '">' + m.label + '</span>' + dueChip(s, 'sch-due') + '</div>';
    }
    function page(i, html) {
        return '<section class="sch-page' + (i === 0 ? ' is-on' : ' is-next') + '" data-p="' + i + '" aria-label="' + PAGES[i].label + '"' + (i ? ' aria-hidden="true" inert' : '') + '>' +
            (i ? '<h4 class="sch-page__t"><i class="fa-solid ' + PAGES[i].icon + '" aria-hidden="true"></i>' + PAGES[i].label + '</h4>' : '') + html + '</section>';
    }
    function pager() {
        return '<nav class="sch-pager" aria-label="Card pages">' +
            '<button type="button" class="sch-pager__arrow" data-pg="prev" aria-label="Previous page" disabled><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>' +
            '<span class="sch-pager__dots">' + PAGES.map(function (p, i) {
                return '<button type="button" class="sch-pager__dot' + (i ? '' : ' is-on') + '" data-pg="' + i + '" title="' + p.label + '" aria-label="' + p.label + '"' + (i ? '' : ' aria-current="true"') + '><i class="fa-solid ' + p.icon + '" aria-hidden="true"></i></button>';
            }).join('') + '</span>' +
            '<button type="button" class="sch-pager__arrow" data-pg="next" aria-label="Next page"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>' +
        '</nav>';
    }
    function card(s, i) {
        var how = s.how || {}, m = METHOD[how.method] || METHOD.varies;
        return '<article class="sch-card sch-card--' + esc(s.category) + '" id="sch-card-' + esc(s.id) + '" data-id="' + esc(s.id) + '" data-page="0" style="--i:' + Math.min(i, 8) + '">' +
            '<header class="sch-card__hd">' +
                '<div class="sch-card__title">' +
                    '<p class="sch-card__kicker"><span class="sch-badge sch-badge--' + esc(s.category) + '">' + esc(BADGE[s.category] || 'Scholarship') + '</span>' + esc(levelsText(s)) + '</p>' +
                    '<h3 class="sch-card__name">' + esc(s.name) + '</h3>' +
                    (s.provider ? '<p class="sch-card__by">by ' + esc(s.provider) + '</p>' : '') +
                '</div>' + saveBtn(s) +
            '</header>' +
            '<div class="sch-pages">' +
                page(0, pageOverview(s)) +
                page(1, list(s.gives || [], 'sch-list--get')) +
                page(2, list(s.takes || [])) +
                page(3, '<p class="sch-page__lead"><span class="sch-method sch-method--' + m.tone + '">' + m.label + '</span></p>' +
                    '<ol class="sch-steps">' + (how.steps || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>') +
                page(4, whenBlock(s) + (s.url ? extLink(s.url, 'Official page', 'sch-official') : '')) +
            '</div>' + pager() +
        '</article>';
    }
    function setPage(cardEl, n) {
        var pages = cardEl.querySelectorAll('.sch-page'), max = pages.length - 1;
        n = Math.max(0, Math.min(max, n));
        pages.forEach(function (p, i) {
            p.classList.toggle('is-on', i === n);
            p.classList.toggle('is-prev', i < n);
            p.classList.toggle('is-next', i > n);
            if (i === n) { p.removeAttribute('aria-hidden'); p.removeAttribute('inert'); }
            else { p.setAttribute('aria-hidden', 'true'); p.setAttribute('inert', ''); }
        });
        cardEl.querySelectorAll('.sch-pager__dot').forEach(function (d, i) {
            d.classList.toggle('is-on', i === n);
            if (i === n) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });
        cardEl.querySelector('[data-pg="prev"]').disabled = n === 0;
        cardEl.querySelector('[data-pg="next"]').disabled = n === max;
        cardEl.setAttribute('data-page', n);
    }

    /* Float the cards only while they're on screen (no work when scrolled away). */
    var gridIO = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { en.target.classList.toggle('is-idle', !en.isIntersecting); });
    }) : null;
    function renderBody() {
        var body = $('schBody'), html;
        if (state.status === 'empty') html = '<p class="sch-empty"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i> Search for a university to see its scholarships.</p>';
        else if (state.status === 'loading') html = skeleton();
        else if (state.status === 'error') html = errorState();
        else if (state.status === 'none') html = noneState();
        else html = '<div class="sch-stage"><div class="sch-grid" id="schGrid">' + state.data.scholarships.map(card).join('') + '</div></div>' +
            '<p class="sch-foot-note"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Amounts, award numbers and deadlines come from the official pages (checked Sept 2026). Difficulty is our estimate — the reason is on each card.</p>';
        body.innerHTML = html;
        body.setAttribute('aria-busy', state.status === 'loading' ? 'true' : 'false');
        hydrateLogos(body);
        renderScene();
        if (gridIO) { gridIO.disconnect(); var g = $('schGrid'); if (g) gridIO.observe(g); }
    }
    function skeleton() {
        var c = '<div class="sch-card sch-card--skel" aria-hidden="true"><span class="sch-skel sch-skel--line sch-skel--sm" style="width:30%"></span>' +
            '<span class="sch-skel sch-skel--line sch-skel--lg" style="width:70%"></span><span class="sch-skel sch-skel--block"></span>' +
            '<span class="sch-skel sch-skel--line" style="width:80%"></span><span class="sch-skel sch-skel--line" style="width:60%"></span></div>';
        return '<div class="sch-grid" aria-hidden="true">' + c + c + c + '</div><p class="sch-sr" role="status">Loading scholarships…</p>';
    }
    function errorState() {
        return '<div class="sch-state sch-state--error" role="alert"><span class="sch-state__icon"><i class="fa-solid fa-plug-circle-exclamation" aria-hidden="true"></i></span>' +
            '<h3>Couldn’t load scholarships</h3>' +
            '<button type="button" class="sch-btn sch-btn--primary sch-btn--sm" data-act="retry"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Retry</button></div>';
    }
    function noneState() {
        var d = state.data || {}, u = state.uni, ext = d.external || [];
        return '<div class="sch-state"><span class="sch-state__icon"><i class="fa-solid fa-magnifying-glass-dollar" aria-hidden="true"></i></span>' +
            '<h3>No scholarships listed for ' + esc(u.name) + ' yet</h3>' +
            (d.aidUrl ? extLink(d.aidUrl, 'University funding page', 'sch-btn sch-btn--primary sch-btn--sm') : '') +
        '</div>' +
        (ext.length ? '<section class="sch-ext-block"><h3><i class="fa-solid fa-earth-europe" aria-hidden="true"></i> Government & EU scholarships for ' + esc(u.country) + '</h3><div class="sch-ext">' +
            ext.map(function (x) {
                return '<a class="sch-ext__it" href="' + esc(x.url) + '" target="_blank" rel="noopener noreferrer"><b>' + esc(x.name) + ' <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></b>' +
                    '<span>' + esc(x.provider) + ' · ' + esc(x.level) + '</span><span class="sch-sr"> (opens in a new tab)</span></a>';
            }).join('') + '</div></section>' : '');
    }

    /* ── Events ────────────────────────────────────────────────────── */
    $('schBody').addEventListener('click', function (e) {
        var sv = e.target.closest('[data-save]');
        if (sv) {
            var s = findScholarship(sv.getAttribute('data-save'));
            if (!s) return;
            var on = toggleSave(state.uni.key, s, state.uni);
            sv.outerHTML = saveBtn(s, on && !REDUCED);
            var fresh = root.querySelector('[data-save="' + s.id + '"]');
            if (fresh) fresh.focus({ preventScroll: true });
            return;
        }
        var pg = e.target.closest('[data-pg]');
        if (pg) {
            var c = pg.closest('.sch-card'), cur = +c.getAttribute('data-page'), v = pg.getAttribute('data-pg');
            setPage(c, v === 'prev' ? cur - 1 : v === 'next' ? cur + 1 : +v);
            return;
        }
        var t = e.target.closest('[data-act]');
        if (t && t.getAttribute('data-act') === 'retry') load();
    });
    // Arrow keys move between pages while focus is in a card's pager.
    $('schBody').addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        var nav = e.target.closest && e.target.closest('.sch-pager');
        if (!nav) return;
        e.preventDefault();
        var c = nav.closest('.sch-card');
        setPage(c, +c.getAttribute('data-page') + (e.key === 'ArrowRight' ? 1 : -1));
        var on = c.querySelector('.sch-pager__dot.is-on'); if (on) on.focus();
    });
    // Swipe between pages on touch screens.
    var swipe = null;
    $('schBody').addEventListener('pointerdown', function (e) {
        var p = e.pointerType !== 'mouse' && e.target.closest('.sch-pages');
        swipe = p ? { x: e.clientX, y: e.clientY, card: p.closest('.sch-card') } : null;
    });
    $('schBody').addEventListener('pointerup', function (e) {
        if (!swipe) return;
        var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) setPage(swipe.card, +swipe.card.getAttribute('data-page') + (dx < 0 ? 1 : -1));
        swipe = null;
    });
    $('schBody').addEventListener('pointercancel', function () { swipe = null; });
    function findScholarship(id) {
        var l = (state.data && state.data.scholarships) || [];
        for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
        return null;
    }

    /* ── Quick picks (shortlisted universities first, then featured) ── */
    function renderPicks() {
        var keys = [];
        try {
            ((typeof window.getSaved === 'function' ? window.getSaved() : []) || []).forEach(function (id) {
                var reg = window.uniFromRegistry && window.uniFromRegistry(id);
                if (reg && reg.cc) keys.push(String(reg.cc).toLowerCase() + ':' + id);
            });
        } catch (e) {}
        var savedKeys = keys.filter(function (k) { var u = byKey(k); return u && u.profile; }).slice(0, 3);
        var picks = savedKeys.concat(FEATURED.filter(function (k) { return savedKeys.indexOf(k) === -1; })).slice(0, 6);
        var html = picks.map(byKey).filter(Boolean).map(function (u) {
            var mine = savedKeys.indexOf(u.key) !== -1;
            return '<button type="button" class="sch-pick' + (mine ? ' is-mine' : '') + '" data-pick="' + esc(u.key) + '">' +
                logo(u, 22) + '<span>' + esc(shortName(u)) + '</span>' +
                (mine ? '<i class="fa-solid fa-bookmark" aria-label="In your shortlist"></i>' : '') + '</button>';
        }).join('');
        root.querySelectorAll('[data-picks]').forEach(function (el) { el.innerHTML = html; hydrateLogos(el); });
    }
    $('schPicks').addEventListener('click', function (e) {
        var b = e.target.closest('[data-pick]');
        if (b) selectUni(byKey(b.getAttribute('data-pick')));
    });

    /* ── Overview: "Scholarships" container (replaces the snapshot button) ── */
    function renderSavedScholarships(mount) {
        mount = mount || $('gmfSch');
        if (!mount) return;
        var saved = getSaved().map(function (x) {
            var s = Source.lookup(x.key, x.id);
            return s ? { x: x, s: s, next: nextDeadline(s) } : null;
        }).filter(Boolean);
        // Soonest confirmed deadline first, then most recently saved.
        saved.sort(function (a, b) {
            var da = a.next ? Date.parse(a.next.date) : Infinity, db = b.next ? Date.parse(b.next.date) : Infinity;
            return (da === db ? 0 : da < db ? -1 : 1) || b.x.t - a.x.t;
        });
        var ic = '<span class="gmf-sch__ic" aria-hidden="true"><i class="fa-solid fa-award"></i></span>';
        if (!saved.length) {
            mount.className = 'gmf-sch gmf-sch--empty';
            mount.innerHTML = ic +
                '<span class="gmf-sch__t"><b>Scholarships</b><small>Save one to track it here</small></span>' +
                '<button type="button" class="gmf-sch__cta" data-sch-open=""><span>Find</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>';
            return;
        }
        // One compact row: title · saved chips (scroll sideways) · "+"
        mount.className = 'gmf-sch gmf-sch--saved';
        mount.innerHTML = ic +
            '<span class="gmf-sch__t"><b>Scholarships</b><small>' + saved.length + ' saved</small></span>' +
            '<ul class="gmf-sch__chips">' + saved.map(function (r) {
                var u = r.x.uni || {}, n = (r.s.difficulty || {}).score;
                return '<li><button type="button" class="gmf-sch__chip" data-sch-open="' + esc(r.x.key + '|' + r.s.id) + '" style="--uc:' + esc(u.color || '#d97c14') + '" title="' + esc(r.s.name + ' — ' + (u.name || '')) + '">' +
                    '<span class="gmf-sch__logo">' + logo({ name: u.name || '', abbr: u.abbr, color: u.color, website: u.website }, 26) +
                        (n ? '<span class="gmf-sch__lvl gmf-sch__lvl--' + diffTone(n) + '" aria-label="Difficulty ' + n + ' out of 10">' + n + '</span>' : '') + '</span>' +
                    '<span class="gmf-sch__ctx"><b>' + esc(r.s.name) + '</b>' + dueChip(r.s, 'gmf-sch__due') + '</span>' +
                '</button></li>';
            }).join('') + '</ul>' +
            '<button type="button" class="gmf-sch__plus" data-sch-open="" aria-label="Find more scholarships" title="Find more"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>';
        hydrateLogos(mount);
    }
    window.renderSavedScholarships = renderSavedScholarships;
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-sch-open]');
        if (!b) return;
        var v = b.getAttribute('data-sch-open').split('|');
        window.openScholarships(v[0] || null, v[1] || null);
    });

    /* ── Hero: parallax, pause-when-hidden ─────────────────────────── */
    var hero = $('schHero'), scene = $('schScene');
    if (!REDUCED && window.matchMedia('(hover: hover)').matches) {
        var pRaf = 0, pEv = null;
        hero.addEventListener('pointermove', function (e) {
            pEv = e;
            if (pRaf) return;
            pRaf = requestAnimationFrame(function () {
                pRaf = 0;
                var r = hero.getBoundingClientRect();
                scene.style.setProperty('--rx', (((pEv.clientX - r.left) / r.width - 0.5) * 16).toFixed(2));
                scene.style.setProperty('--ry', (((pEv.clientY - r.top) / r.height - 0.5) * -12).toFixed(2));
            });
        });
        hero.addEventListener('pointerleave', function () { scene.style.setProperty('--rx', 0); scene.style.setProperty('--ry', 0); });
    }
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            entries.forEach(function (en) { hero.classList.toggle('is-paused', !en.isIntersecting); });
        }).observe(hero);
    }

    /* ── Lifecycle ─────────────────────────────────────────────────── */
    var booted = false;
    function boot() {
        if (booted) return;
        booted = true;
        renderBody();
        loadIndex().then(function () {
            renderPicks();
            var last = lsGet(LAST_KEY), u = last && byKey(last);
            if (u && state.status === 'empty' && !state.uni) selectUni(u, { silent: true, keepFocus: true });
        }).catch(function () { $('schPicks').innerHTML = ''; });
    }
    function isShown() { return root.style.display !== 'none' && root.offsetParent !== null; }
    new MutationObserver(function () {
        if (isShown()) { boot(); if (index) renderPicks(); }
    }).observe(root, { attributes: true, attributeFilter: ['style'] });
    if (isShown()) boot();
    renderSavedScholarships();

    // Deep link from anywhere: window.openScholarships('gb:oxford', 'ox-clarendon')
    window.openScholarships = function (key, id) {
        if (typeof window.showTab === 'function') window.showTab('scholarships');
        boot();
        if (!key) { window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); return; }
        loadIndex().then(function () {
            var u = byKey(key);
            if (!u) return;
            if (state.uni && state.uni.key === key && state.status === 'ready') { if (id) focusCard(id); }
            else selectUni(u, { focus: id || null });
        });
    };
})();
