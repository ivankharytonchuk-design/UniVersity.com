/* ════════════════════════════════════════════════════════════════════
   "What gets you in" — opened from the Probability hero (chances.js).

   Tab 1  Getting in      your grades vs the published offer as keycaps you can
                          tap to try other grades; what the university weighs
                          (US: its own Common Data Set; elsewhere its admissions
                          pages); odds by where you apply from; how admission
                          works in that country, one step at a time.
          → "What helps"  a right-hand drawer: everything that can move an
                          application at this university (sport, olympiads,
                          arts, early rounds, background…) and how much.
   Tab 2  Degree → job    the degree path the field needs in that country, and
                          when pay typically reaches the salary you drag to.

   Data: data/admit_guide.js (researched Oct 2026, every entry sourced) — loaded
   the first time the modal opens. Motion is transform/opacity only.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var API = (function () { if (location.protocol === 'file:') return 'http://localhost:4242'; return (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== '4242') ? 'http://localhost:4242' : location.origin; }());
    var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var COUNTRY = { gb: 'United Kingdom', us: 'United States', nl: 'Netherlands', de: 'Germany', ch: 'Switzerland', it: 'Italy', fr: 'France', es: 'Spain', ie: 'Ireland', se: 'Sweden', dk: 'Denmark', fi: 'Finland', be: 'Belgium', pt: 'Portugal', ua: 'Ukraine' };
    var FIELDS = [['cs', 'Computer science', 'fa-laptop-code'], ['engineering', 'Engineering', 'fa-gears'], ['finance', 'Business', 'fa-chart-line'], ['medicine', 'Medicine', 'fa-stethoscope'], ['law', 'Law', 'fa-scale-balanced'], ['science', 'Science', 'fa-flask'], ['arts', 'Arts', 'fa-palette']];
    var LV = { very: 3, important: 2, considered: 1, not: 0 };
    var LV_NAME = ['Not considered', 'Considered', 'Important', 'Very important'];
    var HOOK_LV = ['Doesn\'t count here', 'Small plus', 'Helps', 'Big plus', 'Can decide it'];
    var HOOK_CAT = { sport: ['Sport', 'fa-medal'], academic: ['Olympiads & research', 'fa-square-root-variable'], arts: ['Arts', 'fa-palette'], route: ['How you apply', 'fa-route'], background: ['Background', 'fa-people-roof'], activities: ['Activities', 'fa-people-group'] };
    var VERDICT = { bachelor: ['Bachelor\'s is enough', 'good'], master: ['Master\'s is the norm', 'warn'], regulated: ['Regulated path', 'bad'], depends: ['Depends on the role', 'mute'] };
    var LEVEL_NAME = { bachelor: 'Bachelor\'s', master: 'Master\'s', phd: 'PhD', applied: 'Applied-sciences bachelor\'s' };
    var LEVEL_BAR = {
        de: { bachelor: 'Bachelor\'s · all ages', master: 'Master\'s · all ages', phd: 'PhD · all ages' },
        fr: { bachelor: 'Bac+3/4 · early career', master: 'Bac+5 · early career' },
        it: { bachelor: 'Bachelor\'s · all ages', master: 'Master\'s · all ages' },
        es: { master: 'University graduates · all ages' },
        ch: { master: 'University degree · all ages', applied: 'Applied-sciences degree · all ages' }
    };
    var AL_ORDER = ['A*', 'A', 'B', 'C', 'D', 'E'], AL = { 'A*': 6, A: 5, B: 4, C: 3, D: 2, E: 1 };
    // the course picker — a university's own course list when we have it, otherwise these families
    var GENERIC = [['cs', 'Computer science', 'fa-laptop-code', 'cs'], ['eng', 'Engineering', 'fa-gears', 'engineering'], ['econ', 'Economics & business', 'fa-chart-line', 'finance'],
        ['med', 'Medicine', 'fa-stethoscope', 'medicine'], ['law', 'Law', 'fa-scale-balanced', 'law'], ['natsci', 'Sciences', 'fa-flask', 'science'], ['hist', 'Humanities', 'fa-scroll', 'arts']];
    var FIELD_COURSE = { cs: 'cs', engineering: 'eng', finance: 'econ', medicine: 'med', law: 'law', science: 'natsci', arts: 'hist' };
    var SHORT = { cs: 'Computer Science', maths: 'Mathematics', eng: 'Engineering', econ: 'Economics', mgmt: 'Management', ppe: 'PPE', med: 'Medicine', law: 'Law', phys: 'Physics',
        chem: 'Chemistry', bio: 'Biomedical', natsci: 'Natural Sciences', hist: 'History', psych: 'Psychology', ir: 'Int. Relations' };
    var RULE_HEAD = { course: 'In the UK the course decides', programme: 'Each programme sets its own bar', school: 'The school you apply to matters', major: 'Your major matters here', uni: 'You\'re admitted to the university' };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function num(v) { return Math.round(v).toLocaleString('en-GB'); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function pct(x) { return x && x[0] ? Math.round(x[1] / x[0] * 1000) / 10 : null; }
    function alSplit(s) { return String(s || '').toUpperCase().match(/A\*|[ABCDE]/g) || []; }
    function byBest(a, b) { return AL[b] - AL[a]; }
    function balanced(n, max) { return Math.max(1, Math.min(n, Math.ceil(n / Math.ceil(n / max)))); }   // 5 items, max 3 → 3 columns (3+2), never 4+1

    /* ── data (lazy) ─────────────────────────────────────────────────── */
    var dataP = null;
    function loadData() {
        if (window.ADMIT_GUIDE && window.ADMIT_GUIDE.hooks) return Promise.resolve(window.ADMIT_GUIDE);
        if (dataP) return dataP;
        dataP = new Promise(function (res, rej) {
            var s = document.createElement('script'); s.src = 'data/admit_guide.js?v=4'; s.async = true;
            s.onload = function () { window.ADMIT_GUIDE ? res(window.ADMIT_GUIDE) : rej(new Error('empty')); };
            s.onerror = function () { dataP = null; rej(new Error('load')); };
            document.head.appendChild(s);
        });
        return dataP;
    }
    var statsCache = {};
    function officialFor(u) {
        if (!u || !u.cc) return Promise.resolve(null);
        var k = u.cc + ':' + u.id;
        if (!statsCache[k]) statsCache[k] = fetch(API + '/api/admissions/stats?cc=' + encodeURIComponent(u.cc) + '&uniId=' + encodeURIComponent(u.id) + '&limit=1').then(function (r) { return r.json(); }).catch(function () { return null; });
        return statsCache[k];
    }

    /* ── modal shell ─────────────────────────────────────────────────── */
    var M = null, ST = null, lastFocus = null;
    function shell() {
        if (M) return M;
        M = document.createElement('div');
        M.className = 'ag'; M.id = 'agModal'; M.setAttribute('role', 'dialog'); M.setAttribute('aria-modal', 'true'); M.setAttribute('aria-labelledby', 'agTitle'); M.hidden = true;
        M.innerHTML = '<div class="ag__card" id="agCard" tabindex="-1"></div>' +
            '<div class="ag-dscrim" id="agDScrim" aria-hidden="true"></div><aside class="ag-drawer" id="agDrawer" role="dialog" aria-modal="true" aria-labelledby="agDTitle" aria-hidden="true"></aside>';
        document.body.appendChild(M);
        M.addEventListener('click', onClick);
        M.addEventListener('input', onInput);
        M.addEventListener('change', onChange);
        M.addEventListener('pointerdown', onDragStart);
        M.addEventListener('keydown', onKey);
        document.addEventListener('keydown', function (e) {
            if (!M || !M.classList.contains('is-open')) return;
            if (e.key === 'Escape') { if (M.classList.contains('has-drawer')) closeDrawer(); else if (M.querySelector('.ag-tray')) closeTray(); else close(); }
            if (e.key === 'Tab') {   // keep focus inside the dialog (or the drawer, when it's open)
                var scope = M.classList.contains('has-drawer') ? $('agDrawer') : $('agCard');
                var f = [].slice.call(scope.querySelectorAll('button, select, input, a[href], summary')).filter(function (x) { return !x.disabled && x.offsetParent; });
                if (!f.length) return; var i = f.indexOf(document.activeElement);
                if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
            }
        });
        window.addEventListener('resize', function () { if (M.classList.contains('is-open')) placePill(); });
        return M;
    }
    function close() {
        if (!M) return;
        closeDrawer(true);
        M.classList.remove('is-open'); document.documentElement.classList.remove('ag-lock');
        setTimeout(function () { if (!M.classList.contains('is-open')) M.hidden = true; }, REDUCED ? 0 : 320);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    window.openAdmitGuide = function (o) {
        o = o || {};
        lastFocus = document.activeElement;
        shell();
        var cc = String((o.uni && o.uni.cc) || o.cc || 'gb').toLowerCase();
        ST = { uni: o.uni || null, cc: COUNTRY[cc] ? cc : 'gb', jobCc: COUNTRY[cc] ? cc : 'gb', field: o.field || fieldFromUni(o.uni), degree: o.degree || 'bachelor', grade: o.grade || null,
            tab: 'in', target: null, data: null, step: 0, hookCat: 'all', hookLv: -1 };
        ST.what = whatFrom(ST.grade);
        ST.gb = gradebookIB();
        M.hidden = false; document.documentElement.classList.add('ag-lock');
        $('agCard').innerHTML = header() + '<div class="ag__body" id="agBody"><div class="ag-skel"><i></i><i></i><i></i></div></div>';
        if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos($('agCard'));
        requestAnimationFrame(function () { M.classList.add('is-open'); });
        // focus the dialog itself (not a tab) so no focus ring flashes on open; Tab moves into it
        loadData().then(function (d) { ST.data = d; ST.course = pickCourse(); if (ST.course && ST.course.fam) ST.field = ST.course.fam; render(); setTimeout(function () { $('agCard').focus({ preventScroll: true }); }, 60); })
            .catch(function () { $('agCard').querySelector('.ag__body').innerHTML = '<p class="ag-empty">Couldn\'t load the guide — check your connection and try again.</p>'; });
    };
    function uid() { try { return (window.user && window.user.id) || 'guest'; } catch (e) { return 'guest'; } }
    // the courses on offer here — the university's own list, or generic families
    function courseList() {
        var own = key() && ST.data.courses ? ST.data.courses[key()] : null;
        if (own && own.length) return own;
        return GENERIC.map(function (g) { return { id: g[0], name: g[1], ic: g[2], fam: g[3], generic: true }; });
    }
    function pickCourse() {
        var list = courseList(), saved = null;
        try { saved = JSON.parse(localStorage.getItem('us_ag_course_' + uid()) || 'null'); } catch (e) {}
        var by = function (f) { return list.filter(f)[0]; };
        return (saved && by(function (c) { return c.id === saved.id; })) ||
            (ST.field && by(function (c) { return c.id === FIELD_COURSE[ST.field]; })) ||
            (saved && by(function (c) { return c.fam === saved.fam; })) ||
            (ST.field && by(function (c) { return c.fam === ST.field; })) || list[0];
    }
    function setCourse(id) {
        var c = courseList().filter(function (x) { return x.id === id; })[0]; if (!c) return;
        ST.course = c; ST.field = c.fam || ST.field; ST.target = null;
        try { localStorage.setItem('us_ag_course_' + uid(), JSON.stringify({ id: c.id, fam: c.fam })); } catch (e) {}
    }
    // IB subjects from the Gradebook (only when it is kept on the IB scale): [{ name, hl, g }]
    function gradebookIB() {
        try {
            var gb = JSON.parse(localStorage.getItem('us_gradebook_' + uid()) || 'null');
            if (!gb || gb.scale !== 'ib' || !gb.subjects) return null;
            var out = gb.subjects.map(function (s) {
                var m = [].concat(s.sem1 || [], s.sem2 || []).filter(function (x) { return x !== '' && x != null && !isNaN(x); }).map(Number);
                var g = m.length ? m.reduce(function (a, b) { return a + b; }, 0) / m.length : s.grade != null && s.grade !== '' ? +s.grade : null;
                return { name: String(s.name || ''), hl: /\bHL\b|higher/i.test(s.name || ''), g: g == null ? null : Math.round(Math.max(1, Math.min(7, g))) };
            }).filter(function (s) { return s.g != null; });
            return out.length ? out : null;
        } catch (e) { return null; }
    }
    var SUBJ_RE = { maths: /math/i, physics: /physic/i, chemistry: /chem/i, biology: /biolog/i, history: /histor/i, english: /english/i, cs: /comput/i };
    function subjRe(name) {   // "Biology, Physics or Maths" → the regexes of every subject it names
        return Object.keys(SUBJ_RE).filter(function (k) { return new RegExp(k === 'maths' ? 'math' : k === 'cs' ? '\\bCS\\b|comput' : k.slice(0, 5), 'i').test(name); }).map(function (k) { return SUBJ_RE[k]; });
    }
    /* header scene: light through a keyhole. On open a key slides in and turns,
       the keyhole lights up and slow rays turn behind it. Transform/opacity only;
       nothing runs while the modal is hidden (display:none). */
    function door() {
        return '<span class="ag-door" aria-hidden="true"><span class="ag-door__rays"></span><span class="ag-door__glow"></span>' +
            '<svg class="ag-door__plate" viewBox="0 0 120 160"><defs><radialGradient id="agHole" cx="50%" cy="38%" r="60%"><stop offset="0" stop-color="#fff6d8"/><stop offset=".55" stop-color="#ffd166"/><stop offset="1" stop-color="#e59a2b"/></radialGradient></defs>' +
                '<rect x="6" y="6" width="108" height="148" rx="54" class="ag-door__rim"/><rect x="16" y="16" width="88" height="128" rx="44" class="ag-door__face"/>' +
                '<path class="ag-door__hole" d="M60 44a18 18 0 0 1 9.5 33.3L76 116H44l6.5-38.7A18 18 0 0 1 60 44z" fill="url(#agHole)"/></svg>' +
            '<span class="ag-door__key"><svg viewBox="0 0 120 40"><circle cx="20" cy="20" r="15" class="ag-door__bow"/><circle cx="20" cy="20" r="6.5" class="ag-door__eye"/><path class="ag-door__shaft" d="M34 16h70v8H96v8h-7v-8h-6v6h-7v-6H34z"/></svg></span></span>';
    }
    // does the Gradebook show this HL requirement? → { st: 'ok'|'low'|'missing'|null, g }
    function hlCheck(req) {
        var gb = ST.gb; if (!gb || /two |one of|1–2|more sciences|another/i.test(req[0])) return { st: null };
        var res = subjRe(req[0]); if (!res.length) return { st: null };
        var hit = gb.filter(function (s) { return s.hl && res.some(function (r) { return r.test(s.name); }); }).sort(function (a, b) { return b.g - a.g; })[0];
        if (!hit) return { st: 'missing' };
        return { st: req[1] && hit.g < req[1] ? 'low' : 'ok', g: hit.g };
    }
    function fieldFromUni(u) {
        var f = (u && u.fields || []).join(' ').toLowerCase();
        return /\bcs\b|comput/.test(f) ? 'cs' : /engineer/.test(f) ? 'engineering' : /business|financ|econom/.test(f) ? 'finance' : /medic/.test(f) ? 'medicine' : /law/.test(f) ? 'law' : /science/.test(f) ? 'science' : 'cs';
    }
    // the grades the "You" keycaps start from — what the page already knows, else a neutral AAA / IB 36
    function whatFrom(g) {
        var al = g && Array.isArray(g.al) && g.al.length === 3 ? g.al.slice().sort(byBest) : null;
        var ib = g && g.sys === 'ib' && +g.val ? Math.round(+g.val) : null;
        return { sys: g && g.sys === 'ib' ? 'ib' : 'al', al: al || ['A', 'A', 'A'], ib: ib || 36, fromPage: !!(al || ib) };
    }
    function key() { return ST.uni ? ST.uni.cc + ':' + ST.uni.id : null; }

    function header() {
        var u = ST.uni, logo = u && typeof uniLogo === 'function' ? '<span class="ag-logo">' + uniLogo({ name: u.name, abbr: (u.abbr || '').slice(0, 4), color: u.color || '#0f3d33', website: u.website }, 34) + '</span>' : '<span class="ag-logo ag-logo--ic"><i class="fa-solid fa-key"></i></span>';
        // the title rises in word by word
        var title = String(u ? u.name : 'How admission works').split(/\s+/).map(function (w, i) { return '<span class="ag-w"><i style="--w:' + i + '">' + esc(w) + '</i></span>'; }).join(' ');
        return '<header class="ag__hd"><span class="ag__grain" aria-hidden="true"></span>' + door() +
            '<button type="button" class="ag-x" data-ag-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '<div class="ag__id">' + logo + '<div><p class="ag__k">What gets you in</p><h2 id="agTitle" aria-label="' + esc(u ? u.name : 'How admission works') + '">' + title + '</h2>' +
            '<p class="ag__sub">' + esc(u ? [u.city, COUNTRY[ST.cc]].filter(Boolean).join(' · ') : 'Pick a university on the page for its own profile') + '</p></div></div>' +
            '<div class="ag-tabs" role="tablist"><button type="button" role="tab" class="ag-tab is-on" aria-selected="true" data-ag-tab="in"><i class="fa-solid fa-door-open"></i> Getting in</button>' +
            '<button type="button" role="tab" class="ag-tab" aria-selected="false" data-ag-tab="job"><i class="fa-solid fa-briefcase"></i> Degree → job → salary</button><span class="ag-tabs__pill" aria-hidden="true"></span></div></header>';
    }
    // the header was drawn on open and keeps playing its entrance — only the body is filled in
    function render() {
        var card = $('agCard');
        if (!card.querySelector('.ag__hd')) { card.innerHTML = header() + '<div class="ag__body" id="agBody"></div>'; if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(card); }
        renderBody();
    }
    // switching tabs keeps the header (the pill slides, focus stays on the tab)
    function renderBody() {
        [].forEach.call(M.querySelectorAll('[data-ag-tab]'), function (b) { var on = b.getAttribute('data-ag-tab') === ST.tab; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
        placePill();
        var body = $('agBody'); body.scrollTop = 0;
        body.innerHTML = ST.tab === 'in' ? tabIn() : tabJob();
        if (ST.tab === 'in') { fillOfficial(); chipIntoView(); } else drawJob(true);
    }
    // phones show the courses as one swipeable row — bring the chosen one into view (horizontally only)
    function chipIntoView() {
        var row = M.querySelector('.ag-cchips'), on = row && row.querySelector('.is-on');
        if (!on || row.scrollWidth <= row.clientWidth) return;
        row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
    }
    function placePill() {
        var on = M.querySelector('.ag-tab.is-on'), pill = M.querySelector('.ag-tabs__pill'); if (!on || !pill) return;
        pill.style.width = on.offsetWidth + 'px'; pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    }
    function sourcesBlock(list) {
        var seen = {}, li = (list || []).filter(function (s) { if (!s || !s.u || seen[s.u]) return false; seen[s.u] = 1; return true; });
        return li.length ? '<details class="ag-src"><summary><i class="fa-solid fa-link"></i> Sources <b>' + li.length + '</b><i class="fa-solid fa-chevron-down ag-src__chev"></i></summary><div>' +
            li.map(function (s) { return '<a href="' + esc(s.u) + '" target="_blank" rel="noopener">' + esc(s.t) + '</a>'; }).join('') + '</div></details>' : '';
    }
    function info(id, html) {
        return '<button type="button" class="ag-info" data-ag-toggle="' + id + '" aria-expanded="false" aria-controls="' + id + '"><i class="fa-solid fa-circle-info"></i> About these numbers</button><div class="ag-infobox" id="' + id + '" hidden>' + html + '</div>';
    }

    /* ═══ Tab 1 — getting in ═════════════════════════════════════════ */
    function tabIn() {
        var D = ST.data, k = key(), P = k ? D.unis[k] : null, C = D.countries[ST.cc], c = ST.course;
        var html = '<div class="ag-in">';
        html += courseStrip();
        html += '<div id="agMatch">' + matchBlock() + '</div>';
        html += c && !c.generic ? courseFacts(c) : facts(P);
        html += ruleCard();
        html += helpsCard();
        if (P && P.cds) html += weighCloud(P);
        else if (P && P.values) html += podium(P);
        else if (ST.uni) html += '<p class="ag-note"><i class="fa-solid fa-circle-info"></i>' + esc(ST.uni.name) + ' has no admissions profile we could verify yet — here\'s how admission works across ' + esc(COUNTRY[ST.cc]) + '.</p>';
        if (k && D.odds[k]) html += oddsBlock(D.odds[k]);
        if (C) html += stepper(C);
        var R = (D.courseRules || {})[ST.cc], U = (D.usSchools || {})[k];
        html += sourcesBlock((c && c.s ? [c.s] : []).concat(U && U.s ? [U.s] : []).concat(P && P.sources || []).concat(R ? R.s : []).concat(C ? C.sources : []));
        return html + '</div>';
    }

    /* what are you applying for? — the whole tab follows this choice */
    function courseStrip() {
        var list = courseList(), on = ST.course || {}, own = !list[0].generic;
        var cols = Math.min(list.length, Math.ceil(list.length / Math.ceil(list.length / 6)));   // balanced rows: 11 → 6+5, 8 → 4+4, never 6+1
        return '<section class="ag-course"><div class="ag-course__hd"><p class="ag-mini">What will you study?</p><span>' + (own ? 'Offer, subjects, test and odds follow the course' : 'No course list for this university yet — rules by subject') + '</span></div>' +
            '<div class="ag-cchips" role="radiogroup" aria-label="Course" style="--cols:' + cols + '">' + list.map(function (c, i) {
                var sel = c.id === on.id;
                return '<button type="button" role="radio" aria-checked="' + sel + '" class="ag-cchip' + (sel ? ' is-on' : '') + '" data-ag-course="' + esc(c.id) + '" title="' + esc(c.name) + '" style="--k:' + i + '"><i class="fa-solid ' + esc(c.ic) + '" aria-hidden="true"></i><span>' + esc(c.generic ? c.name : SHORT[c.id] || c.name) + '</span></button>';
            }).join('') + '</div></section>';
    }
    /* test · interview · competition for the chosen course (tap for detail) */
    function courseFacts(c) {
        var st = c.stat || {}, comp = st.ok != null ? [st.ok + '% get a place', 'About ' + st.ok + '% of applicants got a place' + (st.iv != null ? ' and ' + st.iv + '% were interviewed' : '') + ' (' + st.note + ', published by the university).']
            : st.apps != null ? [st.apps + ' per place', st.apps + ' applications for every place (' + st.note + ', published by the university).'] : ['Not published', 'The university doesn\'t publish applications per place for this course.'];
        var items = [['fa-pen-ruler', 'Test', c.test || 'None', c.test ? c.test + ' — taken before you apply or in the autumn; check the test site for dates.' : 'No admissions test for this course.'],
            ['fa-comments', 'Interview', c.iv || 'Not usual', c.iv ? 'Interview: ' + c.iv + '.' : 'Interviews aren\'t a standard part of selection for this course.'],
            ['fa-people-group', 'Competition', comp[0], comp[1]]];
        ST.facts = items.map(function (x) { return x[3]; });
        return '<div class="ag-facts" role="list">' + items.map(function (it, i) {
            return '<button type="button" role="listitem" class="ag-fact" style="--k:' + i + '" data-ag-fact="' + i + '" aria-expanded="false"><i class="fa-solid ' + it[0] + '"></i><span>' + it[1] + '</span><b>' + esc(it[2]) + '</b></button>';
        }).join('') + '</div><p class="ag-factx" id="agFactX" hidden></p>';
    }
    /* how the course changes admission in this country (US: school vs university) */
    function ruleCard() {
        var R = (ST.data.courseRules || {})[ST.cc], U = (ST.data.usSchools || {})[key()];
        if (!R && !U) return '';
        var by = U ? U.by : R.by, pts = (U ? [U.t] : []).concat(R ? R.pts.slice(U ? 1 : 0) : []);
        var head = ST.cc === 'gb' ? RULE_HEAD.course : by === 'programme' ? RULE_HEAD.programme + ' in ' + COUNTRY[ST.cc] : RULE_HEAD[by] || RULE_HEAD.programme;
        return '<section class="ag-rule ag-rule--' + by + '"><span class="ag-rule__ic" aria-hidden="true"><i class="fa-solid ' + (by === 'uni' ? 'fa-building-columns' : by === 'school' ? 'fa-door-open' : 'fa-route') + '"></i></span>' +
            '<div><p class="ag-rule__h">' + esc(head) + '</p><ul>' + pts.map(function (p, i) { return '<li style="--k:' + i + '">' + esc(p) + '</li>'; }).join('') + '</ul></div></section>';
    }

    /* grades vs offer — keycaps */
    // the offer we compare against: the chosen course's, else the older single-course offer
    function offerOf() {
        var c = ST.course;
        if (c && !c.generic && (c.al || c.ib)) return { prog: c.name, al: c.al, alLow: c.alLow, ib: c.ib, ibLow: c.ibLow, hl: c.hl, ctx: c.ctx, alReq: c.alReq || [], ibReq: c.ibReq || [], note: c.note, s: c.s };
        var k = key(), o = k && ST.data.offers ? ST.data.offers[k] || null : null;
        return o && (!c || c.generic || !ST.data.courses || !ST.data.courses[k]) ? o : null;
    }
    function keycap(g, cls, attrs) { return '<span class="ag-key ' + (cls || '') + '"' + (attrs || '') + '><b>' + esc(g) + '</b></span>'; }
    function side(cls, label, keys, sub) {   // one half of the offer-vs-you card; both halves share this exact structure
        return '<div class="ag-side ' + cls + '"><p class="ag-side__k">' + label + '</p><div class="ag-keys">' + keys + '</div><div class="ag-side__sub">' + (sub || '') + '</div></div>';
    }
    function matchBlock() {
        var o = offerOf(), w = ST.what, P = key() ? ST.data.unis[key()] : null, c = ST.course;
        if (!o) {   // no structured offer: a compact line from the profile (US: holistic, no fixed offer)
            var line = P && P.cds ? 'No fixed grade offer — US admission is holistic. GPA is rated <b>' + esc(LV_NAME[LV[P.cds['Academic GPA']] || 0].toLowerCase()) + '</b>, course rigour <b>' + esc(LV_NAME[LV[P.cds['Rigor of secondary school record']] || 0].toLowerCase()) + '</b>.'
                : P && P.grades ? esc(P.grades) : '';
            if (!line) return '';
            return '<section class="ag-match ag-match--flat"><span class="ag-match__ic"><i class="fa-solid ' + (P && P.cds ? 'fa-scale-unbalanced' : 'fa-chart-simple') + '"></i></span><div><p class="ag-mini">Grades' + (c && !c.generic ? '' : ' · whole university') + '</p><p class="ag-match__line">' + line + '</p></div></section>';
        }
        var sys = w.sys === 'ib' && o.ib ? 'ib' : o.al ? 'al' : 'ib';
        var seg = '<div class="ag-seg" role="radiogroup" aria-label="Grading system">' +
            ['al', 'ib'].map(function (k) { var has = k === 'al' ? o.al : o.ib; return '<button type="button" role="radio" aria-checked="' + (sys === k) + '" class="' + (sys === k ? 'is-on' : '') + '" data-ag-sys="' + k + '"' + (has ? '' : ' disabled title="Not published for this course"') + '>' + (k === 'al' ? 'A-levels' : 'IB') + '</button>'; }).join('') + '</div>';
        var head = '<div class="ag-match__hd"><div><p class="ag-mini">Your grades vs the offer</p><p class="ag-match__prog">' + esc(o.prog) + '</p></div>' + seg + '</div>';
        var offer, you, v, reqs = [];
        if (sys === 'al') {
            var need = alSplit(o.al).sort(byBest), low = o.alLow ? alSplit(o.alLow).sort(byBest) : null, you3 = w.al.slice().sort(byBest), bar = low || need;
            var short = 0; bar.forEach(function (g, i) { short += Math.max(0, AL[g] - AL[you3[i]]); });
            var above = need.every(function (g, i) { return AL[you3[i]] >= AL[g]; });
            v = short ? ['bad', short + ' grade' + (short > 1 ? 's' : '') + ' short'] : low ? (above ? ['good', 'Top of their range'] : ['good', 'Inside their range']) : ['good', 'You meet it'];
            offer = side('ag-side--offer', low ? 'Their range' : 'Typical offer', need.map(function (g) { return keycap(g, 'ag-key--offer'); }).join(''),
                (low ? '<span>down to</span>' + low.map(function (g) { return keycap(g, 'ag-key--mini ag-key--ghost'); }).join('') : '') +
                (o.ctx && o.ctx.al ? '<span>contextual</span>' + alSplit(o.ctx.al).map(function (g) { return keycap(g, 'ag-key--mini ag-key--ctx'); }).join('') : '') ||
                '<span>' + (o.ctx && o.ctx.ib && !o.ctx.al ? 'contextual offers exist' : 'grades in any subjects unless listed below') + '</span>');
            you = side('ag-side--you', 'You <small>tap a key</small>', you3.map(function (g, i) {
                var ok = AL[g] >= AL[bar[i]];
                return '<button type="button" class="ag-key ag-key--you ' + (ok ? 'is-ok' : 'is-low') + '" data-ag-al="' + i + '" aria-haspopup="listbox" aria-label="Grade ' + (i + 1) + ': ' + g + '. Change"><b>' + esc(g) + '</b><i class="fa-solid ' + (ok ? 'fa-check' : 'fa-arrow-up') + '" aria-hidden="true"></i></button>';
            }).join(''), '<span>' + (w.fromPage ? 'from the Chances page' : 'example grades') + ' · ↑ ↓ to step</span>');
            reqs = (o.alReq || []).map(function (r) { return { t: r[0] + (r[1] ? ' ' + r[1] : ''), opt: r[2] === 'opt' }; });
        } else {
            var needIb = o.ibLow || o.ib, yi = w.ib, gap = needIb - yi;
            v = gap > 0 ? ['bad', gap + ' point' + (gap > 1 ? 's' : '') + ' short'] : o.ibLow && yi < o.ib ? ['good', 'Inside their range'] : ['good', 'You meet it'];
            var mine = ST.gb ? ST.gb.filter(function (s) { return s.hl; }).map(function (s) { return s.g; }).sort(function (a, b) { return b - a; }).slice(0, 3) : null;
            offer = side('ag-side--offer', o.ibLow ? 'Their range' : 'Typical offer', keycap(o.ibLow ? o.ibLow + '–' + o.ib : o.ib, 'ag-key--offer ag-key--ib' + (o.ibLow ? ' ag-key--wide' : '')),
                (o.hl ? '<span>HL</span>' + o.hl.split('').map(function (g) { return keycap(g, 'ag-key--mini ag-key--ghost'); }).join('') : '') +
                (o.ctx && o.ctx.ib ? '<span>contextual</span>' + keycap(o.ctx.ib, 'ag-key--mini ag-key--ctx') : '') || '<span>points, including core</span>');
            var hlOk = mine && o.hl && mine.length === 3 ? o.hl.split('').map(Number).every(function (g, i) { return mine[i] >= g; }) : null;
            you = side('ag-side--you', 'You <small>− / +</small>', '<button type="button" class="ag-step" data-ag-ib="-1" aria-label="One point less"><i class="fa-solid fa-minus"></i></button>' +
                    '<span class="ag-key ag-key--you ag-key--ib ' + (gap > 0 ? 'is-low' : 'is-ok') + '" aria-live="polite"><b>' + yi + '</b></span>' +
                    '<button type="button" class="ag-step" data-ag-ib="1" aria-label="One point more"><i class="fa-solid fa-plus"></i></button>',
                mine && mine.length === 3 ? '<span>your HL</span>' + mine.map(function (g, i) { return keycap(g, 'ag-key--mini ' + (o.hl ? (g >= +o.hl[i] ? 'ag-key--okm' : 'ag-key--lowm') : 'ag-key--ghost')); }).join('') : '<span>' + (w.fromPage ? 'from the Chances page' : 'example score') + '</span>');
            if (hlOk === false && v[0] === 'good') v = ['warn', 'Total met · HL grades short'];
            reqs = (o.ibReq || []).map(function (r) { var ck = hlCheck(r); return { t: 'HL ' + r[0] + (r[1] ? ' ' + r[1] : ''), st: ck.st, g: ck.g }; });
        }
        var reqHtml = reqs.length || o.note ? '<div class="ag-reqs"><span class="ag-mini">Must include</span>' + reqs.map(function (r) {
            var cls = r.st === 'ok' ? ' is-ok' : r.st === 'low' || r.st === 'missing' ? ' is-low' : r.opt ? ' is-opt' : '';
            var tail = r.st === 'ok' ? '<i class="fa-solid fa-check"></i>' : r.st === 'low' ? '<em>you ' + r.g + '</em>' : r.st === 'missing' ? '<em>not in your HL</em>' : r.opt ? '<em>if offered</em>' : '';
            return '<span class="ag-req' + cls + '">' + esc(r.t) + tail + '</span>';
        }).join('') + (reqs.length ? '' : '<span class="ag-req is-opt">No set subjects</span>') + (o.note ? '<span class="ag-req ag-req--note"><i class="fa-solid fa-circle-info"></i>' + esc(o.note) + '</span>' : '') + '</div>' : '';
        if (reqs.some(function (r) { return r.st === 'low' || r.st === 'missing'; }) && v[0] === 'good') v = ['warn', 'Total met · a required subject is short'];
        return '<section class="ag-match">' + head + '<div class="ag-vs">' + offer + '<span class="ag-vs__mid" aria-hidden="true">vs</span>' + you + '</div>' +
            '<div class="ag-match__ft"><p class="ag-verdict-pill ag-verdict-pill--' + v[0] + '"><i class="fa-solid ' + (v[0] === 'good' ? 'fa-circle-check' : 'fa-triangle-exclamation') + '"></i>' + v[1] + '</p>' +
            '<a class="ag-match__src" href="' + esc(o.s.u) + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i>' + esc(o.s.t) + '</a></div>' + reqHtml + '</section>';
    }
    function openTray(btn) {
        closeTray();
        var i = +btn.getAttribute('data-ag-al'), cur = ST.what.al.slice().sort(byBest)[i];
        var t = document.createElement('div'); t.className = 'ag-tray'; t.setAttribute('role', 'listbox'); t.setAttribute('aria-label', 'Pick a grade');
        t.innerHTML = AL_ORDER.map(function (g) { return '<button type="button" role="option" aria-selected="' + (g === cur) + '" class="' + (g === cur ? 'is-on' : '') + '" data-ag-pick="' + g + '" data-ag-slot="' + i + '">' + g + '</button>'; }).join('');
        btn.parentNode.appendChild(t);
        t.style.left = (btn.offsetLeft + btn.offsetWidth / 2) + 'px';
        btn.setAttribute('aria-expanded', 'true');
        requestAnimationFrame(function () { t.classList.add('is-in'); var on = t.querySelector('.is-on') || t.firstChild; on.focus({ preventScroll: true }); });
    }
    function closeTray() { var t = M && M.querySelector('.ag-tray'); if (t) t.remove(); }
    function rerenderMatch(flipSlot) {
        $('agMatch').innerHTML = matchBlock();
        if (flipSlot != null && !REDUCED) { var k = M.querySelector('[data-ag-al="' + flipSlot + '"]') || M.querySelector('.ag-side--you .ag-key--you'); if (k) k.classList.add('is-flip'); }
    }

    /* fact strip: short chips, tap one for the full sentence */
    function facts(P) {
        if (!P) return '';
        var items = [];
        if (P.cds) {
            var tp = P.tests || {};
            items.push(['fa-pen-ruler', 'SAT / ACT', tp.policy === 'required' ? 'Required' : tp.policy === 'optional' ? 'Optional' : tp.policy === 'blind' ? 'Not used' : '—', tp.text || '']);
            items.push(['fa-comments', 'Interview', LV_NAME[LV[P.cds.Interview] || 0], 'Interview is rated "' + LV_NAME[LV[P.cds.Interview] || 0].toLowerCase() + '" in the Common Data Set.']);
            items.push(['fa-file-lines', 'Essays', LV_NAME[LV[P.cds['Application Essay']] || 0], 'Essays are rated "' + LV_NAME[LV[P.cds['Application Essay']] || 0].toLowerCase() + '".']);
            if (P.note) items.push(['fa-circle-info', 'Note', 'Read', P.note]);
        } else {
            items.push(['fa-pen-ruler', 'Tests', shortTest(P.tests), P.tests]);
            items.push(['fa-comments', 'Interview', /^yes/i.test(P.interview || '') ? 'Yes' : /^no\b|^none/i.test(P.interview || '') || !P.interview ? 'No' : 'Some', P.interview]);
            items.push(['fa-file-lines', 'Written', shortWritten(P.written), P.written]);
        }
        ST.facts = items.map(function (x) { return x[3] || ''; });
        return '<div class="ag-facts" role="list">' + items.map(function (it, i) {
            return '<button type="button" role="listitem" class="ag-fact" style="--k:' + i + '" data-ag-fact="' + i + '" aria-expanded="false"><i class="fa-solid ' + it[0] + '"></i><span>' + it[1] + '</span><b>' + esc(it[2]) + '</b></button>';
        }).join('') + '</div><p class="ag-factx" id="agFactX" hidden></p>';
    }
    function shortTest(t) {
        if (/^(some|selective|course-specific)/i.test(t || '')) return 'Some courses';
        var m = String(t || '').match(/\b(TMUA|ESAT|LNAT|UCAT|TARA|TSA|MAT|SAT|ACT|TOLC-?I?|TOL|TestAS|HPAT|CEnT-S)\b/g);
        if (m) { var u = []; m.forEach(function (x) { if (u.indexOf(x) < 0) u.push(x); }); if (u.every(function (x) { return /UCAT|LNAT|HPAT/.test(x); })) return 'Medicine / law only'; return u.slice(0, 2).join(' / '); }
        return /^no\b|rarely|^none/i.test(t || '') ? 'None' : t ? 'Some' : '—';
    }
    function shortWritten(w) { return /statement/i.test(w || '') ? 'Statement' : /essay/i.test(w || '') ? 'Essays' : w ? 'Yes' : '—'; }

    /* what they weigh — US: a cloud sized by importance */
    function weighCloud(P) {
        var D = ST.data, c7 = P.cds, rows = [3, 2, 1, 0].map(function (lv) {
            var fs = D.factors.filter(function (f) { return c7[f[0]] && LV[c7[f[0]]] === lv; });
            if (!fs.length) return '';
            return '<div class="ag-cloud__row ag-lv' + lv + '"><span class="ag-cloud__k">' + LV_NAME[lv] + '</span><div>' + fs.map(function (f, i) { return '<span class="ag-pill" style="--k:' + i + '">' + esc(f[1]) + '</span>'; }).join('') + '</div></div>';
        }).join('');
        return '<section class="ag-sec"><h3>What they weigh <small>Common Data Set ' + esc(P.cdsYear) + ' · published by the university</small></h3><div class="ag-cloud">' + rows + '</div></section>';
    }
    /* what they weigh — elsewhere: ranked, #1 biggest */
    function podium(P) {
        var c = ST.course, vals = P.values.filter(function (v) { return !(c && !c.generic && !c.test && /test/i.test(v)); });
        return '<section class="ag-sec"><h3>What they weigh most</h3><ol class="ag-pod" style="--cols:' + balanced(Math.max(1, vals.length - 1), 3) + '">' + vals.map(function (v, i) {
            return '<li class="ag-pod__i' + (i === 0 ? ' is-top' : '') + '" style="--k:' + i + '"><b>' + (i + 1) + '</b><span>' + esc(v) + '</span></li>';
        }).join('') + '</ol>' + (P.doesnt ? '<p class="ag-nope"><i class="fa-solid fa-ban"></i>' + esc(P.doesnt) + '</p>' : '') + '</section>';
    }

    /* the drawer teaser */
    function hooksFor() {
        var k = key(), own = k && ST.data.hooks ? ST.data.hooks[k] : null;
        return own && own.length ? { list: forCourse(own), own: true } : { list: (ST.data.countryHooks || {})[ST.cc] || [], own: false };
    }
    // a university's list was written for one course; the admissions-test line follows the chosen course
    function forCourse(list) {
        var c = ST.course; if (!c || c.generic) return list;
        return list.map(function (x) {
            if (!/admissions test|test score/i.test(x.t)) return x;
            if (!c.test) return null;
            return /\(/.test(x.t) ? Object.assign({}, x, { t: x.t.replace(/\(([^)]*)\)/, '(' + c.test + ')') }) : x;
        }).filter(Boolean);
    }
    function helpsCard() {
        var h = hooksFor(); if (!h.list.length) return '';
        var counts = [0, 0, 0, 0, 0]; h.list.forEach(function (x) { counts[x.lv]++; });
        var top = h.list.slice().sort(function (a, b) { return b.lv - a.lv; }).slice(0, 3);
        var name = ST.uni ? (ST.uni.abbr && ST.uni.abbr.length <= 14 ? ST.uni.abbr : ST.uni.name) : COUNTRY[ST.cc];
        return '<button type="button" class="ag-helps" data-ag-drawer aria-haspopup="dialog">' +
            '<span class="ag-helps__icons" aria-hidden="true">' + top.map(function (x, i) { return '<i class="fa-solid ' + x.ic + ' ag-hlv' + x.lv + '" style="--k:' + i + '"></i>'; }).join('') + '</span>' +
            '<span class="ag-helps__t"><b>What helps at ' + esc(name) + '</b><small>' + [[4, 'can decide it'], [3, 'big plus'], [2, 'help'], [0, 'don\'t count']].filter(function (p) { return counts[p[0]]; }).map(function (p) { return counts[p[0]] + ' ' + p[1]; }).join(' · ') + (h.own ? '' : ' · national rules') + '</small></span>' +
            '<span class="ag-helps__bar" aria-hidden="true">' + [4, 3, 2, 1, 0].map(function (lv) { return counts[lv] ? '<i class="ag-hlv' + lv + '" style="flex:' + counts[lv] + '"></i>' : ''; }).join('') + '</span>' +
            '<i class="fa-solid fa-arrow-right ag-helps__go" aria-hidden="true"></i></button>';
    }

    /* odds by where you apply from (US Common Data Set C1/C21) */
    function oddsBlock(o) {
        var rows = [['Everyone', o.all, 'all']];
        if (o.ed) rows.push(['Early Decision', o.ed, 'ed']);
        if (o.instate) { rows.push(['In-state', o.instate, 'us']); rows.push(['Out-of-state', o.outstate, 'mute']); }
        else if (o.us) rows.push(['US applicants', o.us, 'us']);
        if (o.intl) rows.push(['International', o.intl, 'intl']);
        var max = Math.max.apply(null, rows.map(function (r) { return pct(r[1]); }));
        return '<section class="ag-sec"><h3>Who gets in <small>share admitted, ' + esc(o.year) + ' · Common Data Set</small></h3><div class="ag-odds">' + rows.map(function (r, i) {
            var p = pct(r[1]);
            return '<div class="ag-odd ag-odd--' + r[2] + '" style="--k:' + i + '"><span>' + r[0] + '</span><div class="ag-odd__tr"><i style="width:' + (p / max * 100).toFixed(1) + '%"></i></div><b>' + p + '%</b><small>' + num(r[1][1]) + ' of ' + num(r[1][0]) + '</small></div>';
        }).join('') + '</div>' + (o.ed ? '<p class="ag-fine">Early pools include many recruited athletes and legacies, so the gap overstates the boost for a typical applicant.</p>' : '') + '</section>';
    }

    /* how admission works — one step at a time */
    function stepper(C) {
        var s = clamp(ST.step, 0, C.steps.length - 1);
        return '<section class="ag-sec ag-how"><h3>How it works in ' + esc(COUNTRY[ST.cc]) + ' <small>' + esc(C.system) + '</small></h3>' +
            '<div class="ag-stepper" role="tablist" aria-label="Steps">' + C.steps.map(function (x, i) {
                return '<button type="button" role="tab" aria-selected="' + (i === s) + '" class="ag-dot' + (i === s ? ' is-on' : '') + (i < s ? ' is-done' : '') + '" data-ag-step="' + i + '"><b>' + (i + 1) + '</b></button>';
            }).join('<i class="ag-stepper__ln" aria-hidden="true"></i>') + '</div>' +
            '<div class="ag-steptx" aria-live="polite"><p class="is-in">' + esc(C.steps[s]) + '</p>' +
            '<div class="ag-stepnav"><button type="button" class="ag-ghost" data-ag-step="' + (s - 1) + '"' + (s === 0 ? ' disabled' : '') + ' aria-label="Previous step"><i class="fa-solid fa-arrow-left"></i></button><span>' + (s + 1) + ' / ' + C.steps.length + '</span><button type="button" class="ag-ghost" data-ag-step="' + (s + 1) + '"' + (s === C.steps.length - 1 ? ' disabled' : '') + ' aria-label="Next step"><i class="fa-solid fa-arrow-right"></i></button></div></div>' +
            '<div class="ag-weights" style="--cols:' + balanced(C.weights.length, 3) + '">' + C.weights.map(function (w, i) { return '<span class="ag-wchip ag-lv' + (LV[w[1]] != null ? LV[w[1]] : 1) + '" style="--k:' + i + '"><i aria-hidden="true"></i>' + esc(w[0]) + '</span>'; }).join('') + '</div></section>';
    }

    // the published offer from the server (used when we have no keycap offer), compact
    function fillOfficial() {
        var u = ST.uni; if (!u || offerOf()) return;
        officialFor(u).then(function (d) {
            var box = $('agMatch'); if (!d || !d.requirements || !box || ST.tab !== 'in') return;
            var reqs = d.requirements.filter(function (r) { return r.typicalOffer || r.minScore; }).slice(0, 3);
            if (!reqs.length) return;
            box.insertAdjacentHTML('beforeend', '<div class="ag-pub"><p class="ag-mini"><i class="fa-solid fa-building-columns"></i> Published offer</p>' + reqs.map(function (r) {
                return '<p class="ag-pub__r"><b>' + esc(r.program || 'All programmes') + '</b><span>' + esc(r.typicalOffer || r.minScore) + '</span>' + (r.source && r.source.url ? '<a href="' + esc(r.source.url) + '" target="_blank" rel="noopener" aria-label="Source"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '') + '</p>';
            }).join('') + '</div>');
        });
    }

    /* ═══ Drawer — what helps at this university ═════════════════════ */
    function openDrawer() {
        var dr = $('agDrawer'); renderDrawer();
        M.classList.add('has-drawer'); dr.setAttribute('aria-hidden', 'false');
        setTimeout(function () { var x = $('agDTitle'); if (x) x.focus({ preventScroll: true }); }, REDUCED ? 0 : 120);
    }
    function closeDrawer(silent) {
        if (!M || !M.classList.contains('has-drawer')) return;
        M.classList.remove('has-drawer'); $('agDrawer').setAttribute('aria-hidden', 'true');
        if (!silent) { var b = M.querySelector('[data-ag-drawer]'); if (b) b.focus({ preventScroll: true }); }
    }
    function renderDrawer() {
        var h = hooksFor(), list = h.list, name = ST.uni ? ST.uni.name : COUNTRY[ST.cc];
        var counts = [0, 0, 0, 0, 0]; list.forEach(function (x) { counts[x.lv]++; });
        var cats = []; list.forEach(function (x) { if (cats.indexOf(x.c) < 0) cats.push(x.c); });
        var shown = list.filter(function (x) { return (ST.hookCat === 'all' || x.c === ST.hookCat) && (ST.hookLv < 0 || x.lv === ST.hookLv); });
        var groups = [4, 3, 2, 1, 0].map(function (lv) {
            var g = shown.filter(function (x) { return x.lv === lv; }); if (!g.length) return '';
            return '<div class="ag-hgroup' + (lv === 0 ? ' ag-hgroup--no' : '') + '"><p class="ag-hgroup__k"><i class="ag-hlv' + lv + '"></i>' + HOOK_LV[lv] + '</p>' + g.map(hookCard).join('') + '</div>';
        }).join('');
        $('agDrawer').innerHTML = '<header class="ag-dhd"><div><p class="ag__k">What helps</p><h3 id="agDTitle" tabindex="-1">' + esc(name) + '</h3><p class="ag-dsub">' + (h.own ? 'Researched from the university\'s own rules and data · Oct 2026' : 'No university-specific research yet — national rules for ' + esc(COUNTRY[ST.cc])) + '</p></div>' +
            '<button type="button" class="ag-dx" data-ag-dclose aria-label="Close"><i class="fa-solid fa-xmark"></i></button></header>' +
            '<div class="ag-dsum" role="group" aria-label="Filter by how much it helps" style="--cols:' + counts.filter(Boolean).length + '">' + [4, 3, 2, 1, 0].map(function (lv) {
                return counts[lv] ? '<button type="button" class="ag-dsum__b' + (ST.hookLv === lv ? ' is-on' : '') + '" data-ag-hlv="' + lv + '" aria-pressed="' + (ST.hookLv === lv) + '"><i class="ag-hlv' + lv + '"></i><b>' + counts[lv] + '</b><span>' + HOOK_LV[lv] + '</span></button>' : '';
            }).join('') + '</div>' +
            (cats.length > 1 ? '<div class="ag-dcats" role="group" aria-label="Filter by type"><button type="button" class="ag-chip' + (ST.hookCat === 'all' ? ' is-on' : '') + '" data-ag-hcat="all" aria-pressed="' + (ST.hookCat === 'all') + '">All</button>' + cats.map(function (c) {
                return '<button type="button" class="ag-chip' + (ST.hookCat === c ? ' is-on' : '') + '" data-ag-hcat="' + c + '" aria-pressed="' + (ST.hookCat === c) + '"><i class="fa-solid ' + HOOK_CAT[c][1] + '"></i> ' + HOOK_CAT[c][0] + '</button>';
            }).join('') + '</div>' : '') +
            '<div class="ag-dlist">' + (groups || '<p class="ag-empty">Nothing in this filter.</p>') + '</div>' +
            '<footer class="ag-dfoot"><i class="fa-solid fa-circle-info"></i>"Can decide it" means it can outweigh most of the rest of an application. Nothing here guarantees a place.</footer>';
    }
    function hookCard(x, i) {
        return '<details class="ag-hook ag-hookc' + x.lv + '" style="--k:' + i + '"><summary><span class="ag-hook__ic"><i class="fa-solid ' + esc(x.ic) + '"></i></span>' +
            '<span class="ag-hook__t"><b>' + esc(x.t) + '</b>' + (x.only ? '<em>' + esc(x.only) + '</em>' : '') + '</span>' +
            '<span class="ag-meter" aria-label="' + HOOK_LV[x.lv] + '">' + [1, 2, 3, 4].map(function (n) { return '<i class="' + (n <= x.lv ? 'on' : '') + '"></i>'; }).join('') + '</span></summary>' +
            '<div class="ag-hook__d"><p>' + esc(x.d) + '</p>' + (x.s && x.s.u ? '<a href="' + esc(x.s.u) + '" target="_blank" rel="noopener"><i class="fa-solid fa-link"></i> ' + esc(x.s.t) + '</a>' : '') + '</div></details>';
    }

    /* ═══ Tab 2 — degree → job → salary ══════════════════════════════ */
    function CR() { return ST.data.careers[ST.jobCc]; }
    function seriesFor() {
        var c = CR(), f = (c.fields || {})[ST.field] || {}, out = [];
        if (c.kind === 'years') ['bachelor', 'master', 'applied', 'phd'].forEach(function (lv) { if (f[lv] && f[lv].length) out.push({ lv: lv, pts: f[lv].map(function (p) { return [p[0], p[1]]; }) }); });
        return out;
    }
    function scaleOf() {
        var c = CR(), f = (c.fields || {})[ST.field] || {}, vals = [];
        seriesFor().forEach(function (s) { s.pts.forEach(function (p) { vals.push(p[1]); }); });
        if (c.kind === 'percentiles' && f.p) vals = vals.concat([f.p.p10, f.p.p90]);
        if (c.kind === 'levels') { Object.keys(c.levels || {}).forEach(function (k) { if (c.levels[k]) vals.push(c.levels[k]); }); if (f.typical) vals.push(f.typical); if (f.start) vals.push(f.start); if (c.start) vals.push(c.start); }
        if (c.kind === 'ladder') vals = vals.concat(c.ladder.map(function (l) { return l[1] * 12; }));
        if (c.eurostat && c.eurostat.values && c.eurostat.values[ST.field] && c.currency === 'EUR') { vals.push(c.eurostat.values[ST.field]); if (c.kind === 'sectorOnly' && c.eurostat.youngPct) vals.push(c.eurostat.values[ST.field] * c.eurostat.youngPct / 100); }
        if (!vals.length) vals = [20000, 80000];
        var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
        var step = hi > 200000 ? 5000 : hi > 60000 ? 1000 : 500;
        return { min: Math.max(step, Math.floor(lo * 0.6 / step) * step), max: Math.ceil(hi * 1.25 / step) * step, step: step, mid: Math.round(((lo + hi) / 2) / step) * step };
    }
    function money(v) { return CR().sym + num(v); }
    function short(v) { var c = CR(); return c.sym + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'm' : v >= 1e4 ? Math.round(v / 1000) + 'k' : num(v)); }
    function tabJob() {
        var c = CR(), sc = scaleOf();
        if (ST.target == null || ST.target < sc.min || ST.target > sc.max) ST.target = sc.mid;
        return '<div class="ag-ctl"><div class="ag-ctl__top">' +
            '<label class="ag-cc"><i class="fa-solid fa-earth-europe" aria-hidden="true"></i><span class="ag-sr">Country</span><select id="agCc">' + Object.keys(COUNTRY).filter(function (k) { return ST.data.careers[k]; }).map(function (k) { return '<option value="' + k + '"' + (k === ST.jobCc ? ' selected' : '') + '>' + COUNTRY[k] + '</option>'; }).join('') + '</select></label>' +
            '<div class="ag-target"><span class="ag-mini">Salary you want <small>' + esc(c.kind === 'ladder' ? 'net a year' : 'gross a year') + '</small></span><b id="agTargetV">' + money(ST.target) + '</b>' +
            '<input type="range" id="agTarget" min="' + sc.min + '" max="' + sc.max + '" step="' + sc.step + '" value="' + ST.target + '" aria-label="Target salary"></div></div>' +
            '<div class="ag-fields" role="radiogroup" aria-label="Field">' + FIELDS.map(function (f) { return '<button type="button" role="radio" aria-checked="' + (f[0] === ST.field) + '" class="ag-ftile' + (f[0] === ST.field ? ' is-on' : '') + '" data-ag-field="' + f[0] + '"><i class="fa-solid ' + f[2] + '"></i><span>' + f[1] + '</span></button>'; }).join('') + '</div></div>' +
            '<div class="ag-job"><article class="ag-deg" id="agDeg">' + degreeBlock() + '</article><article class="ag-reach"><div id="agReach"></div></article></div>' +
            sourcesBlock((c.sources || []).concat(c.degreeSources || []).concat(c.eurostat ? [c.eurostat.source] : []));
    }
    /* the degree path: school → degree(s) → job, drawn by verdict */
    function degreeBlock() {
        var c = CR(), deg = (c.degree || {})[ST.field], vd = deg ? VERDICT[deg.verdict] : null;
        if (!vd) return '<p class="ag-mini">The degree you\'ll need</p><p class="ag-deg__t">No verified rule for this field in ' + esc(COUNTRY[ST.jobCc]) + ' yet.</p>' + factsMore(c);
        var n = function (t, cls, ic) { return '<span class="ag-node ' + (cls || '') + '"><i class="fa-solid ' + ic + '"></i><b>' + t + '</b></span>'; }, ln = function (cls) { return '<i class="ag-link ' + (cls || '') + '" aria-hidden="true"></i>'; };
        var path = deg.verdict === 'bachelor' ? n('School', '', 'fa-school') + ln() + n('Bachelor\'s', 'is-key', 'fa-graduation-cap') + ln() + n('Job', 'is-end', 'fa-briefcase') + '<span class="ag-branch">' + n('Master\'s', 'is-opt', 'fa-layer-group') + '<small>optional</small></span>'
            : deg.verdict === 'master' ? n('School', '', 'fa-school') + ln() + n('Bachelor\'s', '', 'fa-graduation-cap') + ln() + n('Master\'s', 'is-key', 'fa-layer-group') + ln() + n('Job', 'is-end', 'fa-briefcase')
            : deg.verdict === 'regulated' ? n('School', '', 'fa-school') + ln() + n('Professional degree', 'is-key', 'fa-graduation-cap') + ln() + n('Licence / exam', 'is-key', 'fa-stamp') + ln() + n('Job', 'is-end', 'fa-briefcase')
            : n('School', '', 'fa-school') + ln() + n('Bachelor\'s', 'is-key', 'fa-graduation-cap') + ln() + n('Job', 'is-end', 'fa-briefcase') + '<span class="ag-branch">' + n('Master\'s', 'is-key', 'fa-layer-group') + '<small>for some roles</small></span>';
        return '<p class="ag-mini">The degree you\'ll need</p><p class="ag-vpill ag-vpill--' + vd[1] + '">' + vd[0] + '</p><div class="ag-path ag-path--' + deg.verdict + '">' + path + '</div><p class="ag-deg__t">' + esc(deg.text) + '</p>' + factsMore(c);
    }
    function factsMore(c) {
        return (c.facts || []).length ? '<details class="ag-more"><summary>More context <i class="fa-solid fa-chevron-down"></i></summary><ul>' + c.facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul></details>' : '';
    }
    function crossYear(pts, t) {
        if (!pts.length) return null;
        if (t <= pts[0][1]) return { at: pts[0][0], first: true };
        for (var i = 1; i < pts.length; i++) if (t <= pts[i][1]) { var a = pts[i - 1], b = pts[i]; return { at: lerp(a[0], b[0], (t - a[1]) / (b[1] - a[1])) }; }
        return null;
    }
    function ord(n) { var v = n % 100; return n + ((v > 10 && v < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'); }
    function verdictLevels(bars, t) {
        var reached = bars.filter(function (b) { return b[1] >= t; }).sort(function (a, b) { return a[1] - b[1]; })[0];
        if (!reached) return money(t) + ' is above every figure here — above-average pay for this group.';
        return money(t) + ' is at or below <b>' + esc(reached[0]) + '</b> (' + money(reached[1]) + ').';
    }
    function drawJob(anim) {
        var box = $('agReach'); if (!box) return;
        var c = CR(), f = (c.fields || {})[ST.field] || {}, t = ST.target, html = '<p class="ag-mini">Reaching <b>' + money(t) + '</b> <span class="ag-drag-hint"><i class="fa-solid fa-hand-pointer"></i> drag the line</span></p>', note = '';
        if (c.kind === 'years') {
            var ser = seriesFor();
            if (!ser.length) html += '<p class="ag-empty">No published figures for this field in ' + esc(COUNTRY[ST.jobCc]) + '.</p>';
            else {
                html += lineChart(ser, t, anim) + '<div class="ag-answers">' + ser.map(function (s, i) {
                    var x = crossYear(s.pts, t), last = s.pts[s.pts.length - 1], y = x ? Math.max(1, Math.round(x.at)) : null;
                    return '<div class="ag-ans ag-ans--' + s.lv + '" style="--k:' + i + '"><span>' + LEVEL_NAME[s.lv] + '</span><b>' + (x ? (x.first ? 'Year 1' : '~' + y + ' yr' + (y === 1 ? '' : 's')) : '10+ yrs') + '</b><small>' + (x ? (x.first ? 'from the start' : 'typical timing') : 'median ' + money(last[1]) + ' at ' + last[0] + ' yrs') + '</small></div>';
                }).join('') + '</div>';
                note = esc(c.note) + (f.label ? ' Subject: ' + esc(f.label) + '.' : '');
            }
        } else if (c.kind === 'percentiles') {
            var p = f.p; if (!p) { box.innerHTML = html + '<p class="ag-empty">No published figures.</p>'; return; }
            var marks = [[10, p.p10], [25, p.p25], [50, p.p50], [75, p.p75], [90, p.p90]], pc;
            if (t <= p.p10) pc = 'lo'; else if (t >= p.p90) pc = 'hi'; else for (var i = 1; i < marks.length; i++) if (t <= marks[i][1]) { pc = Math.round(lerp(marks[i - 1][0], marks[i][0], (t - marks[i - 1][1]) / (marks[i][1] - marks[i - 1][1]))); break; }
            var stage = t <= p.p25 ? 'new entrants' : t <= p.p50 ? 'early-to-mid career' : t <= p.p75 ? 'experienced professionals' : 'senior or top-paying roles';
            html += rangeBar(marks, t, anim) + '<div class="ag-answers"><div class="ag-ans ag-ans--bachelor"><span>' + esc(f.label) + '</span><b>' + (pc === 'hi' ? 'Top 10%' : pc === 'lo' ? '≤ 10th pct' : ord(pc) + ' pct') + '</b><small>' + stage + '</small></div>' +
                '<div class="ag-ans ag-ans--master"><span>Entry education</span><b>' + esc(String(f.education).replace(/ degree$/, '')) + '</b><small>BLS typical</small></div></div>';
            note = esc(c.note);
        } else if (c.kind === 'levels') {
            var bars = [];
            Object.keys(c.levels || {}).forEach(function (k) { if (c.levels[k]) bars.push([(LEVEL_BAR[ST.jobCc] || {})[k] || LEVEL_NAME[k] || k, c.levels[k], 'lv']); });
            if (f.start) bars.push(['Starting salary · ' + f.label, f.start, 'start']);
            if (c.start && !f.start) bars.push(['First year · all fields', c.start, 'start']);
            if (f.typical) bars.push([f.label + ' · all experience levels', f.typical, 'field']);
            html += barsChart(bars, t, anim) + '<p class="ag-big">' + verdictLevels(bars, t) + '</p>' + (c.netYears ? netTable(c) : '') + (c.tenure ? tenureLine(c) : '');
            note = [c.levelsNote, c.startNote, c.note, c.netNote, c.tenureNote].filter(Boolean).map(esc).join('<br>');
        } else if (c.kind === 'ladder') {
            if (ST.field === 'cs') { var lad = c.ladder.map(function (l) { return [l[0], l[1] * 12, 'lad']; }); html += barsChart(lad, t, anim) + '<p class="ag-big">' + verdictLevels(lad, t) + '</p>'; note = esc(c.note) + ' Shown × 12.'; }
            else html += '<p class="ag-empty">Ukraine has a reliable public pay breakdown only for IT. Pick Computer science.</p>';
        } else if (c.kind === 'sectorOnly') {
            var es = c.eurostat, sv = es && es.values[ST.field];
            if (sv) {
                var sb = [['All ages · ' + es.sectorLabel[ST.field], sv, 'field']];
                if (es.youngPct) sb.push(['Under 30 · estimate', Math.round(sv * es.youngPct / 100), 'start']);
                html += barsChart(sb, t, anim) + '<p class="ag-big">' + verdictLevels(sb, t) + '</p>';
                note = esc(COUNTRY[ST.jobCc]) + ' publishes no pay by field and experience, so this uses the EU earnings survey (2022, tertiary-educated employees, by employer sector). The under-30 bar applies the country-wide under-30 ratio (' + es.youngPct + '%) — an estimate.';
            } else html += '<p class="ag-empty">No published figures for this field.</p>';
            box.innerHTML = html + (note ? info('agNote', '<p>' + note + '</p>') : ''); return;
        }
        if (c.eurostat && c.eurostat.values && c.eurostat.values[ST.field] && c.kind !== 'sectorOnly') {
            var ev = c.eurostat.values[ST.field];
            html += '<div class="ag-eu"><i class="fa-solid fa-earth-europe" aria-hidden="true"></i><p><b>€' + num(ev) + '</b> average for graduates in ' + esc(c.eurostat.sectorLabel[ST.field]) + ' (all ages, 2022)' + (c.eurostat.youngPct ? '; under-30s earn ~' + c.eurostat.youngPct + '% of that' : '') + '.</p></div>';
        }
        box.innerHTML = html + (note ? info('agNote', '<p>' + note + '</p>') : '');
    }
    function netTable(c) {
        var y = c.netYears;
        return '<div class="ag-net"><p class="ag-mini">Net a month, early career</p><table><thead><tr><th></th>' + y.bachelor.map(function (p) { return '<th>' + p[0] + ' yr' + (p[0] > 1 ? 's' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
            ['bachelor', 'master'].map(function (lv) { return '<tr><th>' + LEVEL_NAME[lv] + '</th>' + y[lv].map(function (p) { return '<td>€' + num(p[1]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    }
    function tenureLine(c) {
        return '<div class="ag-net"><p class="ag-mini">Pay by years with the same employer</p><div class="ag-ten">' + c.tenure.map(function (p, i) {
            return '<span style="--k:' + i + ';--h:' + Math.round(p[1] / c.tenure[c.tenure.length - 1][1] * 100) + '%"><b>€' + num(p[1]) + '</b><i></i><small>' + ['<1 yr', '1–3 yrs', '4–10', '11–20', '21–29'][i] + '</small></span>';
        }).join('') + '</div></div>';
    }

    /* charts — SVG; the target can be dragged directly on them */
    var GEO = null;
    function niceStep(raw) { var p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
    function lineChart(ser, t, anim) {
        var box = $('agReach'), W = Math.round(Math.max(300, Math.min(600, (box && box.clientWidth - 40) || 560))), H = W < 420 ? 210 : 230, L = 58, R = 16, T = 14, B = 30, sc = scaleOf();
        var ymin = sc.min, ymax = sc.max, x = function (yr) { return L + (yr - 1) / 9 * (W - L - R); }, y = function (v) { return T + (1 - (v - ymin) / (ymax - ymin)) * (H - T - B); };
        GEO = { kind: 'y', H: H, T: T, B: B, lo: ymin, hi: ymax };
        var ticks = [], st = niceStep((ymax - ymin) / 4);
        for (var v = Math.ceil(ymin / st) * st; v <= ymax; v += st) ticks.push(v);
        return '<div class="ag-legend">' + ser.map(function (s) { return '<span class="ag-ans--' + s.lv + '"><i></i>' + LEVEL_NAME[s.lv] + '</span>'; }).join('') + '</div>' +
            '<svg class="ag-line' + (anim && !REDUCED ? ' is-anim' : '') + '" data-ag-drag="y" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Pay by years since graduation; drag to set your target">' +
            ticks.map(function (v) { return '<line class="ag-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' + (Math.abs(y(v) - y(t)) < 14 ? '' : '<text class="ag-ax" x="' + (L - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + short(v) + '</text>'); }).join('') +
            [1, 3, 5, 10].map(function (yr) { return '<text class="ag-ax" x="' + x(yr) + '" y="' + (H - 8) + '" text-anchor="middle">' + yr + (yr === 1 ? ' yr' : ' yrs') + '</text>'; }).join('') +
            ser.map(function (s, i) {
                var d = s.pts.map(function (p, j) { return (j ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1); }).join(' ');
                return '<path class="ag-ln ag-ln--' + s.lv + '" d="' + d + '" style="--k:' + i + '"/>' + s.pts.map(function (p, j) { return '<circle class="ag-pt ag-pt--' + s.lv + (p[1] >= t ? ' is-ok' : '') + '" cx="' + x(p[0]).toFixed(1) + '" cy="' + y(p[1]).toFixed(1) + '" r="4.5" style="--k:' + (i * 4 + j) + '"><title>' + LEVEL_NAME[s.lv] + ', ' + p[0] + ' yr: ' + money(p[1]) + '</title></circle>'; }).join('');
            }).join('') +
            '<rect class="ag-hit" x="' + L + '" y="' + T + '" width="' + (W - L - R) + '" height="' + (H - T - B) + '"/>' +
            '<g class="ag-tgt" style="transform:translateY(' + y(t).toFixed(1) + 'px)"><line x1="' + L + '" x2="' + (W - R) + '" y1="0" y2="0"/><rect x="0" y="-11" width="' + (L - 4) + '" height="22" rx="7"/><text x="' + ((L - 4) / 2) + '" y="4" text-anchor="middle">' + short(t) + '</text><circle class="ag-grip" cx="' + (W - R) + '" cy="0" r="7"/></g></svg>';
    }
    function rangeBar(marks, t, anim) {
        var lo = marks[0][1], hi = marks[4][1], span = hi - lo, pos = function (v) { return clamp((v - lo) / span * 100, 0, 100); };
        GEO = { kind: 'x', lo: lo, hi: hi };
        return '<div class="ag-range' + (anim && !REDUCED ? ' is-anim' : '') + '"><div class="ag-range__bar" data-ag-drag="x"><i class="ag-range__iqr" style="left:' + pos(marks[1][1]) + '%;width:' + (pos(marks[3][1]) - pos(marks[1][1])) + '%"></i>' +
            marks.map(function (m) { return '<span class="ag-range__m" style="left:' + pos(m[1]) + '%"><b>' + short(m[1]) + '</b><small>' + (m[0] === 50 ? 'median' : m[0] + 'th') + '</small></span>'; }).join('') +
            '<span class="ag-range__t" style="left:' + pos(clamp(t, lo, hi)) + '%"><b>' + short(t) + '</b></span></div></div>';
    }
    function barsChart(bars, t, anim) {
        var max = Math.max.apply(null, bars.map(function (b) { return b[1]; }).concat([t])) * 1.08, tx = (t / max * 100).toFixed(2);
        GEO = { kind: 'x', lo: 0, hi: max };
        return '<div class="ag-bars' + (anim && !REDUCED ? ' is-anim' : '') + '" data-ag-drag="x">' + bars.map(function (b, i) {
            return '<div class="ag-bar ag-bar--' + b[2] + (b[1] >= t ? ' is-ok' : '') + '" style="--k:' + i + '"><p><span>' + esc(b[0]) + '</span><b>' + money(b[1]) + '</b></p>' +
                '<div class="ag-bar__tr"><i style="width:' + (b[1] / max * 100).toFixed(1) + '%"></i><u style="left:' + tx + '%"></u></div></div>';
        }).join('') + '</div>';
    }
    function setTarget(v) {
        var r = $('agTarget'); if (!r) return;
        var sc = scaleOf(); v = clamp(Math.round(v / sc.step) * sc.step, sc.min, sc.max);
        if (v === ST.target) return;
        ST.target = v; r.value = v; $('agTargetV').textContent = money(v);
        cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { drawJob(false); });
    }
    var drag = null;
    function onDragStart(e) {
        var el = e.target.closest && e.target.closest('[data-ag-drag]'); if (!el || !GEO) return;
        drag = { kind: el.getAttribute('data-ag-drag'), el: el };
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        dragTo(e); e.preventDefault();
        var mv = function (ev) { if (drag) dragTo(ev); }, up = function () { drag = null; document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
        document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    }
    function dragTo(e) {
        var el = $('agReach') && $('agReach').querySelector('[data-ag-drag]'); if (!el || !GEO) return;
        var r = el.getBoundingClientRect();
        if (GEO.kind === 'y') { var py = (e.clientY - r.top) / r.height * GEO.H; setTarget(GEO.lo + (1 - (py - GEO.T) / (GEO.H - GEO.T - GEO.B)) * (GEO.hi - GEO.lo)); }
        else setTarget(GEO.lo + clamp((e.clientX - r.left) / r.width, 0, 1) * (GEO.hi - GEO.lo));
    }

    /* ── events ──────────────────────────────────────────────────────── */
    function onClick(e) {
        var t = e.target;
        if (t === M || t.closest('[data-ag-close]')) { close(); return; }
        if (t.id === 'agDScrim' || t.closest('[data-ag-dclose]')) { closeDrawer(); return; }
        if (!t.closest('.ag-tray') && !t.closest('[data-ag-al]')) closeTray();
        var b;
        if ((b = t.closest('[data-ag-tab]'))) { if (ST.tab !== b.getAttribute('data-ag-tab')) { ST.tab = b.getAttribute('data-ag-tab'); closeDrawer(true); renderBody(); } return; }
        if (t.closest('[data-ag-drawer]')) { openDrawer(); return; }
        if ((b = t.closest('[data-ag-course]'))) {   // a new course: the whole tab follows, quietly (only the offer card animates)
            var cid = b.getAttribute('data-ag-course');
            if (!ST.course || ST.course.id !== cid) {
                setCourse(cid);
                var bd = $('agBody'), y = bd.scrollTop;
                var sx = (M.querySelector('.ag-cchips') || {}).scrollLeft || 0;
                bd.innerHTML = tabIn().replace('<div class="ag-in">', '<div class="ag-in ag-in--quiet">'); fillOfficial(); bd.scrollTop = y;
                var row = M.querySelector('.ag-cchips'); if (row) row.scrollLeft = sx;
                var mc = M.querySelector('.ag-match'); if (mc && !REDUCED) mc.classList.add('is-swap');
                var f0 = M.querySelector('[data-ag-course="' + cid + '"]'); if (f0) f0.focus({ preventScroll: true });
            }
            return;
        }
        if ((b = t.closest('[data-ag-al]'))) { if (M.querySelector('.ag-tray') && b.getAttribute('aria-expanded') === 'true') closeTray(); else openTray(b); return; }
        if ((b = t.closest('[data-ag-pick]'))) {
            var slot = +b.getAttribute('data-ag-slot'), al = ST.what.al.slice().sort(byBest); al[slot] = b.getAttribute('data-ag-pick');
            ST.what.al = al.sort(byBest); ST.what.fromPage = true; closeTray();
            var at = ST.what.al.indexOf(b.getAttribute('data-ag-pick'));
            rerenderMatch(at); var k = M.querySelector('[data-ag-al="' + at + '"]'); if (k) k.focus({ preventScroll: true }); return;
        }
        if ((b = t.closest('[data-ag-ib]'))) { ST.what.ib = clamp(ST.what.ib + +b.getAttribute('data-ag-ib'), 24, 45); ST.what.fromPage = true; rerenderMatch(0); var s2 = M.querySelector('[data-ag-ib="' + b.getAttribute('data-ag-ib') + '"]'); if (s2) s2.focus({ preventScroll: true }); return; }
        if ((b = t.closest('[data-ag-sys]'))) { ST.what.sys = b.getAttribute('data-ag-sys'); rerenderMatch(); return; }
        if ((b = t.closest('[data-ag-fact]'))) {
            var i = +b.getAttribute('data-ag-fact'), x = $('agFactX'), was = b.getAttribute('aria-expanded') === 'true', data = ST.facts || [];
            [].forEach.call(M.querySelectorAll('[data-ag-fact]'), function (f) { f.setAttribute('aria-expanded', 'false'); f.classList.remove('is-on'); });
            if (was || !data[i]) { x.hidden = true; return; }
            b.setAttribute('aria-expanded', 'true'); b.classList.add('is-on'); x.textContent = data[i]; x.hidden = false; x.classList.remove('is-in'); void x.offsetWidth; x.classList.add('is-in'); return;
        }
        if ((b = t.closest('[data-ag-step]'))) {
            var C = ST.data.countries[ST.cc], n = +b.getAttribute('data-ag-step'); if (!C || n < 0 || n >= C.steps.length) return;
            var back = !!b.querySelector('.fa-arrow-left'), ghost = b.classList.contains('ag-ghost');
            ST.step = n; var sec = M.querySelector('.ag-how'); if (!sec) return;
            sec.outerHTML = stepper(C);
            var nav = ghost ? M.querySelectorAll('.ag-how .ag-ghost')[back ? 0 : 1] : null;
            (nav && !nav.disabled ? nav : M.querySelector('.ag-how .ag-dot.is-on')).focus({ preventScroll: true });
            return;
        }
        if ((b = t.closest('[data-ag-hcat]'))) { ST.hookCat = b.getAttribute('data-ag-hcat'); renderDrawer(); var f2 = $('agDrawer').querySelector('[data-ag-hcat="' + ST.hookCat + '"]'); if (f2) f2.focus({ preventScroll: true }); return; }
        if ((b = t.closest('[data-ag-hlv]'))) { var lv = +b.getAttribute('data-ag-hlv'); ST.hookLv = ST.hookLv === lv ? -1 : lv; renderDrawer(); var f3 = $('agDrawer').querySelector('[data-ag-hlv="' + lv + '"]'); if (f3) f3.focus({ preventScroll: true }); return; }
        if ((b = t.closest('[data-ag-field]'))) { ST.field = b.getAttribute('data-ag-field'); ST.target = null; var mc2 = courseList().filter(function (x) { return x.id === FIELD_COURSE[ST.field]; })[0] || courseList().filter(function (x) { return x.fam === ST.field; })[0]; if (mc2) { ST.course = mc2; try { localStorage.setItem('us_ag_course_' + uid(), JSON.stringify({ id: mc2.id, fam: mc2.fam })); } catch (e) {} } $('agBody').innerHTML = tabJob(); drawJob(true); var f4 = M.querySelector('[data-ag-field="' + ST.field + '"]'); if (f4) f4.focus({ preventScroll: true }); return; }
        if ((b = t.closest('[data-ag-toggle]'))) { var box = $(b.getAttribute('data-ag-toggle')), op = box.hidden; box.hidden = !op; b.setAttribute('aria-expanded', op); return; }
    }
    var raf = 0;
    function onInput(e) {
        if (e.target.id !== 'agTarget') return;
        ST.target = +e.target.value; $('agTargetV').textContent = money(ST.target);
        cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { drawJob(false); });
    }
    function onChange(e) { if (e.target.id === 'agCc') { ST.jobCc = e.target.value; ST.target = null; $('agBody').innerHTML = tabJob(); drawJob(true); $('agCc').focus({ preventScroll: true }); } }
    function onKey(e) {
        var t = e.target;
        if (t.hasAttribute && t.hasAttribute('data-ag-al') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {   // step a grade without opening the tray
            e.preventDefault(); closeTray();
            var i = +t.getAttribute('data-ag-al'), al = ST.what.al.slice().sort(byBest), at = AL_ORDER.indexOf(al[i]);
            al[i] = AL_ORDER[clamp(at + (e.key === 'ArrowUp' ? -1 : 1), 0, AL_ORDER.length - 1)]; var g = al[i];
            ST.what.al = al.sort(byBest); ST.what.fromPage = true; var j = ST.what.al.indexOf(g); rerenderMatch(j);
            var k = M.querySelector('[data-ag-al="' + j + '"]'); if (k) k.focus({ preventScroll: true });
        }
        if (t.closest && t.closest('.ag-tray') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            e.preventDefault(); var bs = [].slice.call(t.closest('.ag-tray').children), n = bs.indexOf(t); bs[clamp(n + (e.key === 'ArrowRight' ? 1 : -1), 0, bs.length - 1)].focus();
        }
        if (t.hasAttribute && t.hasAttribute('data-ag-drag') && (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'ArrowLeft')) {
            e.preventDefault(); setTarget(ST.target + scaleOf().step * (e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1));
        }
    }
})();
