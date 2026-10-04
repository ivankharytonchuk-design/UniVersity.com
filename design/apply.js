/* ════════════════════════════════════════════════════════════════════
   Apply — the application command centre (styles: apply.css; server:
   server/applications.js, routes /api/apps…).

   UniVersity prepares applications; the official systems (UCAS, Common App,
   Studielink, …) receive them. The page answers, at a glance:
     what applications I have · what to do next · which dates are coming ·
     how complete each one is · where to work on it · where to submit it.

   Board → detail drawer (Overview · Writing · Documents · Submit · Decision)
   → writing workspace (editor + Application Assistant + versions).
   One profile feeds every application and the assistant.
   Deadlines are produced by the server from the same records and shared with
   the Deadlines page, the Overview widget and the bell (window.dtApplicationDeadlines).
   Motion: short fades/slides on transform/opacity; none under reduced motion.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var root = document.getElementById('apx');
    if (!root) return;

    var API = (function () {
        if (location.protocol === 'file:') return 'http://localhost:4242';
        var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
        return isLocal && location.port !== '4242' ? 'http://localhost:4242' : location.origin;
    }());
    var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var UID = (window.user && window.user.id) || 'guest';
    var CACHE = 'apx_cache_' + UID;            // deliberately not "us_": local cache, not synced
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var ST = {
        planning: ['Planning', 'planning'], preparing: ['Preparing', 'preparing'], ready: ['Ready', 'ready'], submitted: ['Submitted', 'submitted'],
        interview: ['Test / Interview', 'interview'], offer: ['Offer', 'offer'], waitlisted: ['Waitlisted', 'waitlisted'], declined: ['Declined', 'declined']
    };
    var LANES = [['progress', 'In progress', ['planning', 'preparing']], ['ready', 'Ready to submit', ['ready']], ['sent', 'Submitted', ['submitted', 'interview']], ['dec', 'Decisions', ['offer', 'waitlisted', 'declined']]];
    var GROUPS = [['academic', 'Academic'], ['tests', 'Tests'], ['documents', 'Documents'], ['writing', 'Writing'], ['submission', 'Submission'], ['after', 'After you submit']];
    var DOC_KINDS = [['transcript', 'Transcript'], ['predicted', 'Predicted grades'], ['reference', 'Reference'], ['language', 'Language certificate'], ['portfolio', 'Portfolio'], ['id', 'Passport / ID'], ['award', 'Award / certificate'], ['cv', 'CV'], ['test', 'Test score report'], ['offer', 'Offer letter'], ['other', 'Other']];
    var EXP_TYPES = [['project', 'Project'], ['competition', 'Competition'], ['award', 'Award'], ['volunteering', 'Volunteering'], ['work', 'Work experience'], ['sport', 'Sport'], ['activity', 'Activity / club'], ['reading', 'Reading / course'], ['interest', 'Interest']];
    var TOOLS = [['clarity', 'Improve clarity', 1], ['concise', 'Make more concise', 1], ['structure', 'Improve structure', 1], ['natural', 'Sound more natural', 1], ['repetition', 'Remove repetition', 1], ['grammar', 'Check grammar', 1],
        ['weak', 'Why is it weak?', 0], ['unsupported', 'Find unsupported claims', 0], ['evidence', 'Suggest my evidence', 0], ['relevance', 'Relevance to the course', 0], ['requirements', 'Check against requirements', 0]];

    /* ── helpers ───────────────────────────────────────────────────── */
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function $(id) { return document.getElementById(id); }
    function token() { try { return (window.UserSync && UserSync.token && UserSync.token()) || localStorage.getItem('us_session_token') || ''; } catch (e) { return ''; } }
    function api(method, path, body, raw) {
        var h = { authorization: 'Bearer ' + token() };
        if (!raw) h['content-type'] = 'application/json';
        if (raw && raw.headers) Object.keys(raw.headers).forEach(function (k) { h[k] = raw.headers[k]; });
        return fetch(API + '/api/apps' + path, { method: method, headers: h, body: raw ? raw.body : body ? JSON.stringify(body) : undefined })
            .then(function (r) {
                if (raw && raw.blob && r.ok) return r.blob();
                return r.json().catch(function () { return {}; }).then(function (j) {
                    if (!r.ok) { var e = new Error(j.message || j.error || ('Request failed (' + r.status + ')')); e.status = r.status; e.code = j.error; e.data = j; throw e; }
                    return j;
                });
            });
    }
    function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function daysTo(d) { if (!d) return null; return Math.round((new Date(d + 'T12:00:00') - new Date(today() + 'T12:00:00')) / 864e5); }
    function fmt(d, long) { if (!d) return '—'; var x = new Date(String(d).slice(0, 10) + 'T12:00:00'); if (isNaN(x)) return '—'; var y = x.getFullYear() !== new Date().getFullYear() || long; return x.getDate() + ' ' + (long ? x.toLocaleDateString('en-GB', { month: 'long' }) : MONTHS[x.getMonth()]) + (y ? ' ' + x.getFullYear() : ''); }
    function rel(n) { return n == null ? '' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago'; }
    function dueText(d) { var n = daysTo(d); if (n == null) return 'No date'; return n < 0 ? 'Overdue · ' + fmt(d) : fmt(d) + ' · ' + rel(n); }
    function urg(d) { var n = daysTo(d); return n == null ? '' : n < 0 ? 'is-late' : n <= 7 ? 'is-soon' : n <= 30 ? 'is-near' : ''; }
    function crest(u, size) {
        size = size || 32;
        if (typeof uniLogo === 'function') return '<span class="apx-crest" style="--s:' + size + 'px">' + uniLogo({ name: u.name, abbr: (u.abbr || '').slice(0, 4), color: u.color || '#3552d8', website: u.website }, size) + '</span>';
        return '<span class="apx-crest apx-crest--mono" style="--s:' + size + 'px;background:' + esc(u.color || '#3552d8') + '">' + esc((u.abbr || u.name || '?').slice(0, 2)) + '</span>';
    }
    function hydrate(el) { if (typeof cmpHydrateLogos === 'function') try { cmpHydrateLogos(el); } catch (e) {} }
    function srcLink(s, x) {
        if (s && s.u) return '<a class="apx-src" href="' + esc(s.u) + '" target="_blank" rel="noopener" title="' + esc(s.t) + '"><i class="fa-solid fa-link" aria-hidden="true"></i> Source' + (s.checked ? ' · checked ' + fmt(s.checked) : '') + '</a>';
        if (x && x.unverified) return '<span class="apx-src apx-src--warn"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Official figure not collected yet</span>';
        return '<span class="apx-src">UniVersity step</span>';
    }
    function money(m) { if (!m || !m.amount) return '—'; var sym = { GBP: '£', USD: '$', EUR: '€', CHF: 'CHF ', SEK: 'SEK ', DKK: 'DKK ' }[m.currency] || (m.currency + ' '); var n = Number(m.amount); return sym + n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + (m.per ? ' / ' + m.per : ''); }
    function toast(msg, bad) {
        var t = document.createElement('div'); t.className = 'apx-toast' + (bad ? ' is-bad' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
        document.body.appendChild(t); requestAnimationFrame(function () { t.classList.add('is-in'); });
        setTimeout(function () { t.classList.remove('is-in'); setTimeout(function () { t.remove(); }, 300); }, 2600);
    }
    function debounce(fn, ms) { var t = 0; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }
    function wordsOf(s) { return (String(s || '').match(/[\p{L}\p{N}’'-]+/gu) || []).length; }

    /* ── state ─────────────────────────────────────────────────────── */
    var S = { apps: [], next: null, later: [], deadlines: [], loading: true, error: null, auth: true, ai: false, checked: null, open: null, tab: 'overview', detail: null, profile: null, docs: null };

    function load() {
        if (!token()) { S.loading = false; S.auth = false; render(); return Promise.resolve(); }
        return api('GET', '').then(function (d) {
            S.apps = d.apps || []; S.next = d.next; S.later = d.later || []; S.deadlines = d.deadlines || []; S.ai = !!d.aiConfigured; S.checked = d.checked;
            S.loading = false; S.error = null; S.auth = true; S.profileUpdatedAt = d.profileUpdatedAt;
            cacheDeadlines(); render();
        }).catch(function (e) {
            S.loading = false;
            if (e.status === 401) { S.auth = false; } else S.error = e.status === 503 ? e.message : 'Couldn’t reach the server — your applications will appear when it’s back.';
            render();
        });
    }
    function refresh() { return load().then(function () { if (S.open) return openApp(S.open, S.tab, true); }); }

    /* ── deadlines shared with the rest of the app ─────────────────── */
    function cacheDeadlines() {
        try { localStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), deadlines: S.deadlines, count: S.apps.length, unis: S.apps.map(function (a) { return a.uni.id; }) })); } catch (e) {}
        try { document.dispatchEvent(new CustomEvent('apply:deadlines')); } catch (e) {}
        if (typeof window.renderDeadlines === 'function' && typeof currentTab !== 'undefined' && currentTab === 'tracker') try { window.renderDeadlines(); } catch (e) {}
        paintFeed();
        var st = $('statApps'); if (st) st.textContent = S.apps.length;
    }
    function cached() { try { return JSON.parse(localStorage.getItem(CACHE) || 'null') || { deadlines: [], unis: [] }; } catch (e) { return { deadlines: [], unis: [] }; } }
    window.dtApplicationDeadlines = function () { return (S.apps.length || !S.loading ? S.deadlines : cached().deadlines).map(function (d) { return Object.assign({}, d); }); };
    window.dtApplicationUnis = function () { return S.apps.length ? S.apps.map(function (a) { return a.uni.id; }) : cached().unis || []; };
    // the bell: application dates in the next two weeks sit above the news
    function paintFeed() {
        var box = $('feedApx'); if (!box) return;
        var soon = window.dtApplicationDeadlines().filter(function (d) { var n = daysTo(d.date); return n != null && n >= 0 && n <= 14; }).slice(0, 4);
        box.hidden = !soon.length;
        box.innerHTML = soon.length ? '<p class="mp__feed__apx__k">Application dates</p>' + soon.map(function (d) {
            var n = daysTo(d.date);
            return '<button type="button" class="mp__feed__apx__row' + (n <= 3 ? ' is-soon' : '') + '" data-apx-open="' + esc(d.appId) + '"><span class="mp__feed__apx__d"><b>' + new Date(d.date + 'T12:00:00').getDate() + '</b>' + MONTHS[new Date(d.date + 'T12:00:00').getMonth()] + '</span><span class="mp__feed__apx__t"><b>' + esc(d.title) + '</b><small>' + esc(d.uniName || '') + ' · ' + rel(n) + '</small></span></button>';
        }).join('') : '';
        var dot = $('feedDot'), seen = '';
        try { seen = localStorage.getItem('apx_bell_' + UID) || ''; } catch (e) {}
        if (dot && soon.some(function (d) { return daysTo(d.date) <= 3; }) && seen !== today()) dot.style.display = 'flex';
    }
    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-apx-open]'); if (!b) return;
        try { localStorage.setItem('apx_bell_' + UID, today()); } catch (err) {}
        if (typeof closeFeed === 'function') try { closeFeed(); } catch (err) {}
        if (typeof showTab === 'function') showTab('compare');
        openApp(b.getAttribute('data-apx-open'), 'overview');
    });

    /* ── page ──────────────────────────────────────────────────────── */
    function render() {
        if (!S.auth) { root.innerHTML = gate(); return; }
        if (S.loading) { root.innerHTML = '<div class="apx-skel"><i></i><i></i><i></i></div>'; return; }
        var active = S.apps.filter(function (a) { return ['planning', 'preparing', 'ready'].indexOf(a.status) !== -1; });
        var month = S.deadlines.filter(function (d) { var n = daysTo(d.date); return n != null && n >= 0 && n <= 30; }).length;
        var offers = S.apps.filter(function (a) { return a.status === 'offer'; }).length;
        var sub = S.apps.length ? S.apps.length + ' application' + (S.apps.length === 1 ? '' : 's') + (active.length ? ' · ' + active.length + ' in progress' : '') + (month ? ' · ' + month + ' date' + (month === 1 ? '' : 's') + ' in the next 30 days' : '') : 'Everything for your university applications, in one place.';
        root.innerHTML =
            '<header class="apx-hd"><div><p class="apx-k">Apply</p><h1 class="apx-title">Applications</h1><p class="apx-sub">' + esc(sub) + '</p></div>' +
            '<div class="apx-hd__act">' + (offers >= 2 ? '<button type="button" class="apx-btn" data-act="compare"><i class="fa-solid fa-table-columns" aria-hidden="true"></i> Compare offers</button>' : '') +
                '<button type="button" class="apx-btn" data-act="profile"><i class="fa-regular fa-id-card" aria-hidden="true"></i> Profile</button>' +
                '<button type="button" class="apx-btn apx-btn--ink" data-act="add"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add application</button></div></header>' +
            (S.error ? '<p class="apx-note apx-note--bad"><i class="fa-solid fa-plug-circle-xmark" aria-hidden="true"></i> ' + esc(S.error) + '</p>' : '') +
            (S.apps.length ? top() + board() : empty()) +
            '<p class="apx-foot">UniVersity helps you prepare — you submit on each official system. Rules and dates come from official sources' + (S.checked ? ', last checked ' + fmt(S.checked, true) : '') + '; always confirm on the university’s page.</p>';
        hydrate(root);
        if (!REDUCED) requestAnimationFrame(function () { root.querySelectorAll('.apx-bar i').forEach(function (b) { b.classList.add('is-in'); }); });
        else root.querySelectorAll('.apx-bar i').forEach(function (b) { b.classList.add('is-in'); });
    }
    function gate() {
        return '<div class="apx-gate"><span class="apx-gate__ic" aria-hidden="true"><i class="fa-solid fa-lock"></i></span><h2>Sign in to keep your applications</h2>' +
            '<p>Applications, documents and drafts are saved to your account so they’re private and follow you to any device.</p>' +
            '<a class="apx-btn apx-btn--ink" href="log-in.html">Sign in</a></div>';
    }
    function top() {
        var n = S.next, html = '<div class="apx-top">';
        if (n) {
            var app = S.apps.filter(function (x) { return x.id === n.appId; })[0] || null, dl = app && app.deadline, dlDays = daysTo(dl);
            var late = n.days != null && n.days < 0, gone = dlDays != null && dlDays < 0;
            var when = !n.due ? 'No date set' : !late ? 'Do by ' + fmt(n.due) + ' · ' + rel(n.days) : gone ? 'Deadline passed ' + fmt(dl) : dl ? 'Urgent — the deadline is ' + fmt(dl) + ' (' + rel(dlDays) + ')' : 'Was due ' + fmt(n.due);
            html += '<section class="apx-next" aria-label="Next action"><p class="apx-k">Next action</p>' +
                '<h2 class="apx-next__t">' + esc(n.text) + '</h2>' +
                '<p class="apx-next__m"><span>' + esc(n.uniName) + ' · ' + esc(n.course) + '</span><span class="' + (late ? 'is-late' : '') + '">' + esc(n.system.name) + ' · ' + esc(when) + '</span></p>' +
                (n.why ? '<p class="apx-next__why">' + esc(n.why) + '</p>' : '') +
                (app && app.readiness.total ? '<div class="apx-next__prog"><span class="apx-bar apx-bar--dark" aria-hidden="true"><i style="--p:' + app.readiness.pct + '%"></i></span><span><b>' + app.readiness.pct + '%</b> ready · ' + app.readiness.done + ' of ' + app.readiness.total + ' done</span></div>' +
                    (app.left && app.left.length ? '<ul class="apx-next__left">' + app.left.slice(0, 4).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' : '') : '') +
                '<div class="apx-next__ft"><button type="button" class="apx-btn apx-btn--light" data-open="' + esc(n.appId) + '" data-tab="' + esc(n.tab === 'profile' ? 'overview' : n.tab) + '"' + (n.tab === 'profile' ? ' data-then="profile"' : '') + '>Continue application <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>' +
                (S.later.length ? '<ul class="apx-next__then">' + S.later.slice(0, 2).map(function (l) { return '<li><button type="button" data-open="' + esc(l.appId) + '" data-tab="' + esc(l.tab === 'profile' ? 'overview' : l.tab) + '"><span>Then</span> ' + (l.text.indexOf(l.uni) !== -1 ? esc(l.text) : esc(l.uni || l.uniName) + ' — ' + esc(l.text.charAt(0).toLowerCase() + l.text.slice(1))) + '</button></li>'; }).join('') + '</ul>' : '') + '</div></section>';
        } else html += '<section class="apx-next apx-next--calm"><p class="apx-k">Next action</p><h2 class="apx-next__t">Nothing urgent</h2><p class="apx-next__m"><span>Your active applications are up to date.</span></p></section>';
        var up = S.deadlines.filter(function (d) { var x = daysTo(d.date); return x != null && x >= -1; }).slice(0, 4);
        html += '<section class="apx-dates" aria-label="Upcoming dates"><p class="apx-k">Coming up</p>' + (up.length ? '<ul>' + up.map(function (d) {
            var x = new Date(d.date + 'T12:00:00');
            return '<li><button type="button" class="apx-date ' + urg(d.date) + '" data-open="' + esc(d.appId) + '"><span class="apx-date__d"><b>' + x.getDate() + '</b>' + MONTHS[x.getMonth()] + '</span><span class="apx-date__t"><b>' + esc(d.title) + '</b><small>' + esc(d.uniName || '') + '</small></span><span class="apx-date__r">' + rel(daysTo(d.date)) + '</span></button></li>';
        }).join('') + '</ul>' : '<p class="apx-dates__none">No dates yet — add an application and its deadline appears here and on the Deadlines page.</p>') +
            '<button type="button" class="apx-linkbtn" data-goto-tracker>All deadlines <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button></section></div>';
        return html;
    }
    // the board: one group per stage that has applications, cards in a grid
    function board() {
        var stages = LANES.map(function (l) { return [l, S.apps.filter(function (a) { return l[2].indexOf(a.status) !== -1; })]; });
        return '<nav class="apx-stages" aria-label="Stages">' + stages.map(function (x) { return '<span class="apx-stage' + (x[1].length ? ' is-on' : '') + '"><b>' + x[1].length + '</b> ' + esc(x[0][1]) + '</span>'; }).join('<i aria-hidden="true"></i>') + '</nav>' +
            '<div class="apx-board">' + stages.filter(function (x) { return x[1].length; }).map(function (x) {
                return '<section class="apx-group apx-group--' + x[0][0] + '" aria-label="' + esc(x[0][1]) + '"><header class="apx-group__hd"><h3>' + esc(x[0][1]) + '</h3><span>' + x[1].length + '</span></header><div class="apx-grid">' + x[1].map(card).join('') + '</div></section>';
            }).join('') + '</div>';
    }
    function card(a, i) {
        var st = ST[a.status] || ST.planning, sent = ['submitted', 'interview', 'offer', 'waitlisted', 'declined'].indexOf(a.status) !== -1;
        var prog = sent ? '<p class="apx-card__state">' + (a.decision ? decisionLabel(a.decision.decision) : 'Submitted' + (a.submittedAt ? ' ' + fmt(a.submittedAt) : '')) + '</p>'
            : '<div class="apx-card__prog"><span class="apx-bar" aria-hidden="true"><i style="--p:' + a.readiness.pct + '%"></i></span><span class="apx-card__pct"><b>' + a.readiness.pct + '%</b> ready</span></div>';
        return '<article class="apx-card" data-open="' + esc(a.id) + '" tabindex="0" role="button" aria-label="' + esc(a.uni.name + ', ' + a.course.name + ', ' + st[0]) + '" style="--k:' + (i || 0) + '">' +
            '<div class="apx-card__hd">' + crest(a.uni, 34) + '<div class="apx-card__id"><b>' + esc(a.uni.name) + '</b><span>' + esc(a.course.name) + '</span></div><span class="apx-status apx-status--' + st[1] + '">' + st[0] + '</span></div>' +
            prog + (a.next ? '<p class="apx-card__next"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i> ' + esc(a.next.text) + '</p>' : '') +
            '<div class="apx-card__ft"><span class="apx-chip">' + esc(a.system.name) + '</span>' + (a.deadline && !sent ? '<span class="apx-due ' + urg(a.deadline) + '">' + esc(dueText(a.deadline)) + '</span>' : a.decision && a.decision.data.acceptBy && !a.decision.data.choice ? '<span class="apx-due ' + urg(a.decision.data.acceptBy) + '">Reply by ' + fmt(a.decision.data.acceptBy) + '</span>' : '<span></span>') +
            '<span class="apx-card__go">Continue <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></div></article>';
    }
    function decisionLabel(d) { return { offer_conditional: 'Conditional offer', offer_unconditional: 'Unconditional offer', waitlisted: 'Waitlisted', rejected: 'Not successful', withdrawn: 'Withdrawn' }[d] || 'Decision recorded'; }
    function empty() {
        var picks = savedPicks();
        return '<section class="apx-empty"><h2>Start with the universities you’re considering</h2><p>Add a university and course. We’ll set up its checklist from official requirements, its deadline, and the writing it needs — then tell you what to do first.</p>' +
            '<div class="apx-empty__act"><button type="button" class="apx-btn apx-btn--ink" data-act="add"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add application</button></div>' +
            (picks.length ? '<div class="apx-empty__list"><p class="apx-k">From your list</p>' + picks.map(function (u) { return '<button type="button" class="apx-pick" data-add-cc="' + esc(u.cc) + '" data-add-id="' + esc(u.id) + '">' + crest(u, 24) + '<span>' + esc(u.name) + '</span><i class="fa-solid fa-plus" aria-hidden="true"></i></button>'; }).join('') + '</div>' : '') + '</section>';
    }
    function savedPicks() {
        try {
            var ids = typeof getSaved === 'function' ? getSaved() : [], cc = typeof currentCountryCode !== 'undefined' ? currentCountryCode : '';
            var list = typeof UNI !== 'undefined' ? UNI : [];
            return ids.map(function (id) { var u = list.filter(function (x) { return x.id === id; })[0]; return u ? { cc: cc, id: u.id, name: u.name, abbr: u.abbr, color: u.color, website: u.website } : null; }).filter(Boolean).slice(0, 8);
        } catch (e) { return []; }
    }

    root.addEventListener('click', function (e) {
        var t = e.target, b;
        if ((b = t.closest('[data-act="add"]'))) { openAdd(); return; }
        if ((b = t.closest('[data-act="profile"]'))) { openProfile(); return; }
        if ((b = t.closest('[data-act="compare"]'))) { openCompare(); return; }
        if ((b = t.closest('[data-add-cc]'))) { openAdd({ cc: b.getAttribute('data-add-cc'), id: b.getAttribute('data-add-id') }); return; }
        if (t.closest('[data-goto-tracker]')) { if (typeof showTab === 'function') showTab('tracker'); return; }
        if ((b = t.closest('[data-open]'))) { if (b.getAttribute('data-open')) { openApp(b.getAttribute('data-open'), b.getAttribute('data-tab') || 'overview'); if (b.getAttribute('data-then') === 'profile') openProfile(); } }
    });
    root.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.apx-card')) { e.preventDefault(); openApp(e.target.getAttribute('data-open')); } });

    /* ── layers: drawer, sheets, workspace ─────────────────────────── */
    var layers = [];
    function layer(id, cls, html, onClose) {
        var el = $(id);
        if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); }
        el.className = 'apx-layer ' + cls; el.innerHTML = '<div class="apx-layer__scrim" data-close></div>' + html;
        el.hidden = false; el._onClose = onClose || null; el._last = el._last || document.activeElement;
        if (layers.indexOf(el) === -1) layers.push(el);
        document.documentElement.classList.add('apx-lock');
        requestAnimationFrame(function () { el.classList.add('is-in'); });
        return el;
    }
    function closeLayer(el) {
        if (!el || el.hidden) return;
        el.classList.remove('is-in'); layers.splice(layers.indexOf(el), 1);
        var last = el._last; el._last = null;
        setTimeout(function () { if (!el.classList.contains('is-in')) { el.hidden = true; el.innerHTML = ''; } }, REDUCED ? 0 : 260);
        if (!layers.length) document.documentElement.classList.remove('apx-lock');
        if (el._onClose) el._onClose();
        if (last && last.focus && document.contains(last)) try { last.focus({ preventScroll: true }); } catch (e) {}
    }
    document.addEventListener('keydown', function (e) {
        if (!layers.length) return;
        var topEl = layers[layers.length - 1];
        if (e.key === 'Escape') { if (topEl.querySelector('.apx-menu.is-open')) { topEl.querySelector('.apx-menu.is-open').classList.remove('is-open'); return; } closeLayer(topEl); }
        if (e.key === 'Tab') {
            var f = [].slice.call(topEl.querySelectorAll('button, [href], input, select, textarea, [tabindex="0"]')).filter(function (x) { return !x.disabled && x.offsetParent; });
            if (!f.length) return; var i = f.indexOf(document.activeElement);
            if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
    });
    document.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('.apx-layer [data-close]'); if (c) closeLayer(c.closest('.apx-layer')); });

    /* ═══ Application detail (drawer) ═════════════════════════════════ */
    function openApp(id, tab, quiet) {
        if (!id) return Promise.resolve();
        S.open = id; S.tab = tab || S.tab || 'overview';
        var el = $('apxDrawer');
        if (!quiet || !el || el.hidden) el = layer('apxDrawer', 'apx-drawer', '<aside class="apx-dr" role="dialog" aria-modal="true" aria-label="Application"><div class="apx-skel apx-skel--dr"><i></i><i></i><i></i></div></aside>', function () { S.open = null; S.detail = null; });
        return Promise.all([api('GET', '/one/' + encodeURIComponent(id)), S.docs ? Promise.resolve(null) : api('GET', '/docs').then(function (d) { S.docs = d.docs; }), S.profile ? null : api('GET', '/profile').then(function (p) { S.profile = p.profile || {}; })])
            .then(function (r) { S.detail = r[0]; drawDrawer(); })
            .catch(function (e) { var dr = el.querySelector('.apx-dr'); if (dr) dr.innerHTML = '<div class="apx-dr__err"><p>' + esc(e.message) + '</p><button type="button" class="apx-btn" data-close>Close</button></div>'; });
    }
    function drawDrawer() {
        var el = $('apxDrawer'); if (!el || !S.detail) return;
        var D = S.detail, a = D.app, st = ST[a.status] || ST.planning, sent = ['submitted', 'interview', 'offer', 'waitlisted', 'declined'].indexOf(a.status) !== -1;
        var tabs = [['overview', 'Overview'], ['writing', 'Writing'], ['documents', 'Documents'], ['submit', sent ? 'Submission' : 'Submit'], ['decision', 'Decision']];
        var ring = Math.round(a.readiness.pct);
        var html = '<aside class="apx-dr" role="dialog" aria-modal="true" aria-labelledby="apxDrTitle">' +
            '<header class="apx-dr__hd"><button type="button" class="apx-x" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '<div class="apx-dr__id">' + crest(a.uni, 44) + '<div><p class="apx-k">' + esc(a.uni.name) + ' · ' + esc(a.uni.country || '') + '</p><h2 id="apxDrTitle">' + esc(a.course.name) + '</h2></div></div>' +
            '<div class="apx-dr__meta">' +
                '<label class="apx-stsel apx-status apx-status--' + st[1] + '"><span class="apx-sr">Status</span><span>' + st[0] + '</span><select data-f="status">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (k === a.status ? ' selected' : '') + '>' + ST[k][0] + '</option>'; }).join('') + '</select><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></label>' +
                (sent ? '' : '<span class="apx-ring" style="--p:' + ring + '" title="' + a.readiness.done + ' of ' + a.readiness.total + ' required items done"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5"/><circle cx="18" cy="18" r="15.5" pathLength="100"/></svg><b>' + ring + '%</b><span>ready · ' + a.readiness.done + '/' + a.readiness.total + '</span></span>') +
                (sent ? (a.decision && a.decision.data.acceptBy && !a.decision.data.choice ? '<span class="apx-dr__due ' + urg(a.decision.data.acceptBy) + '"><i class="fa-regular fa-calendar" aria-hidden="true"></i> Reply by ' + esc(fmt(a.decision.data.acceptBy, true)) + '</span>' : '<span class="apx-dr__due"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> Submitted' + (a.submittedAt ? ' ' + esc(fmt(a.submittedAt, true)) : '') + '</span>')
                    : a.deadline ? '<span class="apx-dr__due ' + urg(a.deadline) + '"><i class="fa-regular fa-calendar" aria-hidden="true"></i> ' + esc(fmt(a.deadline, true)) + ' · ' + esc(rel(daysTo(a.deadline))) + '</span>' : '<span class="apx-dr__due">No deadline set</span>') +
                (a.system.portal ? '<a class="apx-btn apx-btn--sm" href="' + esc(a.system.portal) + '" target="_blank" rel="noopener">' + esc(a.system.portalLabel || 'Open portal') + ' <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>' : '') +
            '</div><nav class="apx-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (t[0] === S.tab) + '" class="apx-tab' + (t[0] === S.tab ? ' is-on' : '') + '" data-dtab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</nav></header>' +
            '<div class="apx-dr__body" id="apxDrBody">' + tabBody() + '</div></aside>';
        el.innerHTML = '<div class="apx-layer__scrim" data-close></div>' + html;
        hydrate(el);
        bindDrawer(el);
    }
    function tabBody() {
        return S.tab === 'writing' ? tabWriting() : S.tab === 'documents' ? tabDocs() : S.tab === 'submit' ? tabSubmit() : S.tab === 'decision' ? tabDecision() : tabOverview();
    }
    function switchTab(t) {
        S.tab = t; var el = $('apxDrawer'); if (!el) return;
        el.querySelectorAll('[data-dtab]').forEach(function (b) { var on = b.getAttribute('data-dtab') === t; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
        var body = $('apxDrBody'); body.innerHTML = tabBody(); body.scrollTop = 0; body.classList.remove('is-swap'); void body.offsetWidth; body.classList.add('is-swap');
        hydrate(body);
    }

    /* Overview: key facts, the requirement checklist, grades vs requirements */
    function tabOverview() {
        var D = S.detail, a = D.app, sys = D.system, c = D.course;
        var fee = sys.fee ? money({ amount: sys.fee.amount, currency: sys.fee.currency }) + (sys.fee.note ? ' · ' + sys.fee.note : '') : '—';
        var facts = [['Programme', esc(a.course.name) + ' · ' + esc(cap(a.level || 'bachelor'))], ['Country', esc(a.uni.country || '')], ['Application system', esc(sys.name) + (sys.full ? ' <small>' + esc(sys.full) + '</small>' : '')],
            ['Deadline', '<input type="date" class="apx-dinput" data-deadline value="' + esc(a.deadline || '') + '" aria-label="Deadline"> <small>' + esc(a.deadline ? (a.deadlineSrc === 'user' ? 'Set by you' : (a.deadlineNote || '') + (a.deadlineSrc === 'official' ? ' · from the university' : ' · from ' + sys.name)) : 'Not published in our sources — add it from the university’s page') + '</small>' + (a.deadlineSrc === 'user' ? ' <button type="button" class="apx-linkbtn" data-reset-deadline>Use the official date</button>' : '')],
            ['Application fee', esc(fee) + (sys.fee && sys.fee.s ? ' ' + srcLink(sys.fee.s) : '')], ['Readiness', a.readiness.done + ' of ' + a.readiness.total + ' required items done']];
        var html = '<div class="apx-facts">' + facts.map(function (f) { return '<div><dt>' + f[0] + '</dt><dd>' + f[1] + '</dd></div>'; }).join('') + '</div>';
        if (D.gradeCheck && D.gradeCheck.lines.length) html += gradePanel(D.gradeCheck);
        html += '<section class="apx-sec"><h3>Requirements <small>' + esc(sys.name) + (c ? ' · ' + esc(c.name) : '') + '</small></h3>' + checklist(D.requirements) + '</section>';
        if (sys.rules && sys.rules.length) html += '<section class="apx-sec apx-rules"><h3>How ' + esc(sys.name) + ' works</h3><ul>' + sys.rules.map(function (r) { return '<li>' + esc(r.t) + ' ' + srcLink(r.s) + '</li>'; }).join('') + '</ul></section>';
        html += '<section class="apx-sec"><h3>Notes <small>only you can see these</small></h3><textarea class="apx-notes" data-f="notes" rows="3" placeholder="Course code, campus, contacts…">' + esc(D.notes || '') + '</textarea></section>';
        html += '<p class="apx-danger"><button type="button" class="apx-linkbtn apx-linkbtn--bad" data-del-app>Remove this application</button></p>';
        return html;
    }
    function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1).replace('phd', 'PhD'); }
    function gradePanel(g) {
        var title = g.basis === 'offer' ? 'Progress toward your offer conditions' : 'Your grades vs the typical offer';
        return '<section class="apx-sec apx-grades"><h3>' + title + ' <small>from your profile' + (S.profile && S.profile.gradesFrom === 'gradebook' ? ' · Gradebook' : '') + '</small></h3><ul>' + g.lines.map(function (l) {
            var t = l.st === 'ok' ? 'Meets it' : l.st === 'low' ? 'Below' : l.st === 'missing' ? 'Not in your subjects' : l.st === 'optional' ? 'If your school offers it' : l.st === 'check' ? 'Check your subjects' : 'Add your grade';
            return '<li class="is-' + l.st + '"><span class="apx-grades__l">' + esc(l.label) + '</span><span class="apx-grades__n">needs <b>' + esc(l.need) + '</b></span><span class="apx-grades__h">you <b>' + esc(l.have == null ? '—' : l.have) + '</b></span><span class="apx-grades__s">' + t + '</span></li>';
        }).join('') + '</ul>' + (g.lines.some(function (l) { return l.st === 'low'; }) ? '<p class="apx-hint">' + esc(g.lines.filter(function (l) { return l.st === 'low'; }).map(function (l) { return 'Your ' + l.label + ' grade is currently below the stated ' + (g.basis === 'offer' ? 'condition' : 'requirement') + '.'; }).join(' ')) + ' This is a guide, not a prediction of the decision.</p>' : '') +
            '<p class="apx-hint"><button type="button" class="apx-linkbtn" data-goto-gradebook>Update grades in Gradebook</button> · <button type="button" class="apx-linkbtn" data-open-profile>Edit profile</button></p></section>';
    }
    function checklist(items) {
        return GROUPS.map(function (g) {
            var list = items.filter(function (x) { return x.group === g[0]; }); if (!list.length) return '';
            return '<div class="apx-chk"><p class="apx-chk__g">' + g[1] + '</p>' + list.map(itemRow).join('') + '</div>';
        }).join('');
    }
    function itemRow(x) {
        var ic = x.state === 'done' ? ['fa-check', 'ok', 'Done'] : x.state === 'doing' ? ['fa-ellipsis', 'doing', 'In progress'] : x.state === 'na' ? ['fa-minus', 'na', 'Not needed'] : [x.required ? 'fa-xmark' : 'fa-circle', x.required ? 'miss' : 'opt', x.required ? 'Missing' : 'Optional'];
        var action = '';
        if (x.writingId) action = '<button type="button" class="apx-btn apx-btn--sm" data-write="' + esc(x.writingId) + '">' + (x.state === 'todo' ? 'Start' : 'Open') + '</button>';
        else if (x.doc && x.doc !== 'reference') action = '<button type="button" class="apx-btn apx-btn--sm" data-attach="' + esc(x.key) + '">' + (x.docId ? 'Change' : 'Attach') + '</button>';
        else if (x.key === 'academic') action = '<button type="button" class="apx-btn apx-btn--sm" data-open-profile>Profile</button>';
        var extra = '';
        if (x.test) extra = '<div class="apx-test"><label>Date <input type="date" data-test-date="' + esc(x.key) + '" value="' + esc(x.data && x.data.date || '') + '"></label><label>Score <input type="text" data-test-score="' + esc(x.key) + '" value="' + esc(x.data && x.data.score || '') + '" placeholder="when you have it" maxlength="30"></label>' + (x.url ? '<a class="apx-src" href="' + esc(x.url) + '" target="_blank" rel="noopener">Test website</a>' : '') + '</div>';
        if (x.doc === 'reference') extra += '<div class="apx-test"><label>Referee <input type="text" data-ref-who="' + esc(x.key) + '" value="' + esc(x.data && x.data.who || '') + '" placeholder="e.g. Ms Patel, Physics" maxlength="80"></label></div>';
        var stateSel = x.auto === true || x.writingId ? '' : '<label class="apx-state"><span class="apx-sr">Status of ' + esc(x.label) + '</span><select data-state="' + esc(x.key) + '">' + [['todo', 'Not started'], ['doing', x.test ? 'Booked' : x.doc === 'reference' ? 'Asked' : 'In progress'], ['done', x.test ? 'Taken' : 'Done'], ['na', 'Not needed']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === x.state ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
        return '<div class="apx-item is-' + ic[1] + '" data-key="' + esc(x.key) + '"><span class="apx-item__ic" title="' + ic[2] + '"><i class="fa-solid ' + ic[0] + '" aria-hidden="true"></i><span class="apx-sr">' + ic[2] + '</span></span>' +
            '<div class="apx-item__b"><p class="apx-item__t">' + esc(x.label) + (x.required ? '' : ' <em>optional</em>') + (x.conditional && x.required ? ' <em>if it applies</em>' : '') + '</p>' +
            (x.autoNote || x.detail ? '<p class="apx-item__d">' + esc(x.autoNote || x.detail) + (x.attached ? ' · <b>' + esc(x.attached.name) + '</b>' : '') + '</p>' : '') +
            (x.stats ? '<p class="apx-item__d">' + x.stats.chars.toLocaleString('en-GB') + ' characters · ' + x.stats.words + ' words' + (x.stats.problems.length ? ' · <b class="is-bad">' + esc(x.stats.problems[0]) + '</b>' : '') + '</p>' : '') +
            extra + '<p class="apx-item__src">' + srcLink(x.s, x) + '</p></div><div class="apx-item__a">' + action + stateSel + '</div></div>';
    }

    /* Writing: every piece this application needs (shared ones flagged) */
    function tabWriting() {
        var D = S.detail, list = D.writing;
        if (!list.length) return '<p class="apx-note">' + esc(D.system.name) + ' doesn’t use a personal statement. You can still add a question the university asks.</p>' + addQuestion();
        return '<div class="apx-wlist">' + list.map(function (w) {
            var lim = w.spec && w.spec.limit ? (w.spec.limit.chars ? w.stats.chars.toLocaleString('en-GB') + ' / ' + w.spec.limit.chars.toLocaleString('en-GB') + ' characters' : w.spec.limit.words ? w.stats.words + ' / ' + w.spec.limit.words + ' words' : w.spec.limit.wordsEach ? w.spec.limit.wordsEach + ' words each' : '') : w.stats.words + ' words';
            return '<button type="button" class="apx-wrow" data-write="' + esc(w.id) + '"><span class="apx-wrow__ic" aria-hidden="true"><i class="fa-solid fa-pen-nib"></i></span><span class="apx-wrow__b"><b>' + esc(w.title) + (w.shared ? ' <em>shared</em>' : '') + '</b><small>' + esc((w.spec && w.spec.note) || '') + '</small></span>' +
                '<span class="apx-wrow__m"><span class="apx-wst apx-wst--' + esc(w.status) + '">' + ({ draft: 'Draft', review: 'Needs review', final: 'Final' }[w.status] || 'Draft') + '</span><small>' + esc(lim) + '</small>' + (w.stats.problems.length ? '<small class="is-bad">' + esc(w.stats.problems[0]) + '</small>' : '') + '</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>';
        }).join('') + '</div>' + (list.some(function (w) { return w.shared; }) ? '<p class="apx-hint">Shared pieces are written once and sent to every application on ' + esc(D.system.name) + '.</p>' : '') + addQuestion();
    }
    function addQuestion() {
        return '<details class="apx-addq"><summary><i class="fa-solid fa-plus" aria-hidden="true"></i> Add a question from the application form</summary><div class="apx-addq__f"><label>Question or prompt<textarea data-q="prompt" rows="2" maxlength="2000" placeholder="Paste the exact wording"></textarea></label><div class="apx-row"><label>Title<input data-q="title" maxlength="120" placeholder="e.g. Why Cornell?"></label><label>Word limit<input data-q="words" type="number" min="0" max="5000"></label><label>Character limit<input data-q="chars" type="number" min="0" max="20000"></label></div><button type="button" class="apx-btn apx-btn--sm apx-btn--ink" data-addq>Add question</button></div></details>';
    }

    /* Documents: what this application needs, and the shared library */
    function tabDocs() {
        var D = S.detail, slots = D.requirements.filter(function (x) { return x.doc; }), docs = S.docs || [];
        var html = '<section class="apx-sec"><h3>Needed for this application</h3>' + (slots.length ? slots.map(itemRow).join('') : '<p class="apx-note">' + esc(D.system.name) + ' doesn’t ask you to upload documents for this course — your school or the system handles them. You can still keep files here.</p>') + '</section>';
        html += '<section class="apx-sec"><h3>Your documents <small>uploaded once, reused across applications · private to you</small></h3>' + uploader() + docList(docs, true) + '</section>';
        return html;
    }
    function uploader() {
        return '<div class="apx-upload"><label class="apx-btn apx-btn--sm apx-btn--ink"><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i> Upload<input type="file" data-upload accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" hidden></label>' +
            '<label class="apx-mini">Type <select data-upload-kind>' + DOC_KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + '</option>'; }).join('') + '</select></label><small>PDF, image, Word or text · up to 8 MB</small></div>';
    }
    function docList(docs, manage, pickFor) {
        if (!docs.length) return '<p class="apx-note">No documents yet.</p>';
        return '<ul class="apx-docs">' + docs.map(function (d) {
            var kind = (DOC_KINDS.filter(function (k) { return k[0] === d.kind; })[0] || ['', 'Other'])[1];
            return '<li class="apx-doc"><span class="apx-doc__ic" aria-hidden="true"><i class="fa-regular ' + (/pdf/.test(d.mime) ? 'fa-file-pdf' : /image/.test(d.mime) ? 'fa-file-image' : 'fa-file-lines') + '"></i></span><span class="apx-doc__b"><b>' + esc(d.name) + '</b><small>' + esc(kind) + ' · ' + Math.max(1, Math.round(d.size / 1024)) + ' KB · ' + fmt(d.created_at) + (d.used ? ' · used in ' + d.used : '') + '</small></span>' +
                '<span class="apx-doc__st apx-doc__st--' + esc(d.status) + '">' + (d.status === 'needs_review' ? 'Needs review' : 'Uploaded') + '</span>' +
                (pickFor ? '<button type="button" class="apx-btn apx-btn--sm apx-btn--ink" data-pick-doc="' + esc(d.id) + '">Use this</button>' :
                    '<span class="apx-doc__a"><button type="button" class="apx-icbtn" data-view-doc="' + esc(d.id) + '" aria-label="Open ' + esc(d.name) + '"><i class="fa-regular fa-eye"></i></button>' + (manage ? '<button type="button" class="apx-icbtn" data-review-doc="' + esc(d.id) + '" aria-label="Mark as needs review"><i class="fa-regular fa-flag"></i></button><button type="button" class="apx-icbtn" data-del-doc="' + esc(d.id) + '" aria-label="Delete ' + esc(d.name) + '"><i class="fa-regular fa-trash-can"></i></button>' : '') + '</span>') + '</li>';
        }).join('') + '</ul>';
    }

    /* Submit: application check → official portal → record it */
    function tabSubmit() {
        var D = S.detail, a = D.app, sys = D.system, sent = ['submitted', 'interview', 'offer', 'waitlisted', 'declined'].indexOf(a.status) !== -1;
        var html = '';
        if (!sent) {
            html += '<section class="apx-sec"><h3>1 · Application check</h3><p class="apx-hint">Checks every requirement we know from official sources, your writing against its limits, and your grades. ' + (S.ai ? 'Optionally the assistant reads your writing too.' : '') + '</p>' +
                '<div class="apx-row apx-row--c"><button type="button" class="apx-btn apx-btn--ink" data-run-check><i class="fa-solid fa-list-check" aria-hidden="true"></i> Run the check</button>' + (S.ai ? '<label class="apx-tick"><input type="checkbox" data-check-ai checked> Also review my writing (assistant)</label>' : '') + '</div><div id="apxCheck"></div></section>';
            html += '<section class="apx-sec"><h3>2 · Submit on ' + esc(sys.name) + '</h3><p class="apx-hint">UniVersity can’t submit for you — ' + esc(sys.name) + ' is the official system. Prepare here, then submit there.</p><ol class="apx-steps">' + (sys.submit || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
                (sys.portal ? '<a class="apx-btn apx-btn--ink" href="' + esc(sys.portal) + '" target="_blank" rel="noopener">' + esc(sys.portalLabel || 'Open the official portal') + ' <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>' : '') + '</section>';
            html += '<section class="apx-sec"><h3>3 · Record your submission</h3><div class="apx-row"><label>Submitted on<input type="date" data-sub-date value="' + today() + '" max="' + today() + '"></label><label>Reference / ID <small>(optional, private)</small><input type="text" data-sub-ref maxlength="80" autocomplete="off"></label></div><button type="button" class="apx-btn apx-btn--ink" data-mark-submitted><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> I’ve submitted it</button></section>';
        } else {
            html += '<section class="apx-sec"><h3>Submitted</h3><p class="apx-big"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Sent through ' + esc(sys.name) + (a.submittedAt ? ' on ' + esc(fmt(a.submittedAt, true)) : '') + '</p>' + (D.submissionRef ? '<p class="apx-hint">Reference: <b>' + esc(D.submissionRef) + '</b></p>' : '') +
                '<div class="apx-row apx-row--c">' + (a.status === 'submitted' ? '<button type="button" class="apx-btn" data-set-status="interview">I’ve been invited to a test / interview</button>' : '') + '<button type="button" class="apx-btn apx-btn--ink" data-dtab-go="decision">Record the decision</button>' + (sys.portal ? '<a class="apx-btn" href="' + esc(sys.portal) + '" target="_blank" rel="noopener">' + esc(sys.portalLabel) + ' <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>' : '') + '</div></section>';
        }
        return html;
    }
    function drawCheck(r) {
        var box = $('apxCheck'); if (!box) return;
        var icon = { ok: ['fa-check', 'ok'], warn: ['fa-triangle-exclamation', 'doing'], miss: ['fa-xmark', 'miss'], na: ['fa-minus', 'na'] };
        box.innerHTML = '<div class="apx-checkres"><p class="apx-checkres__sum"><b>' + r.counts.ok + '</b> done · <b>' + r.counts.warn + '</b> to review · <b>' + r.counts.miss + '</b> missing</p>' +
            (r.fixes.length ? '<div class="apx-fixes"><p class="apx-k">' + r.fixes.length + ' thing' + (r.fixes.length === 1 ? '' : 's') + ' to fix before submission</p><ol>' + r.fixes.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ol></div>' : '<p class="apx-big"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Nothing missing that we know of.</p>') +
            '<ul class="apx-checklist">' + r.checks.filter(function (c) { return c.status !== 'na'; }).map(function (c) { var i = icon[c.status]; return '<li class="is-' + i[1] + '"><i class="fa-solid ' + i[0] + '" aria-hidden="true"></i><span><b>' + esc(c.label) + '</b>' + (c.detail ? '<small>' + esc(c.detail) + '</small>' : '') + '</span></li>'; }).join('') + '</ul>' +
            (r.ai ? (r.ai.error ? '<p class="apx-note">' + esc(r.ai.error) + '</p>' : '<div class="apx-ainote"><p class="apx-k">Assistant on “' + esc(r.ai.title) + '”</p><ul>' + r.ai.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>') : '') +
            '<p class="apx-hint">' + esc(r.disclaimer) + '</p></div>';
    }

    /* Decision & offer workspace */
    function tabDecision() {
        var D = S.detail, a = D.app, dec = a.decision, d = (dec && dec.data) || {};
        var sent = ['submitted', 'interview', 'offer', 'waitlisted', 'declined'].indexOf(a.status) !== -1;
        if (!sent && !dec) return '<p class="apx-note">Once you’ve submitted this application, record the decision here — offers get a workspace with their conditions, costs and reply dates, and can be compared side by side.</p>';
        var opts = [['offer_conditional', 'Conditional offer'], ['offer_unconditional', 'Unconditional offer'], ['waitlisted', 'Waitlisted'], ['rejected', 'Not successful'], ['withdrawn', 'Withdrawn']];
        var cur = dec ? dec.decision : 'offer_conditional', isOffer = /^offer/.test(cur);
        var conds = (d.conditions && d.conditions.length ? d.conditions : [{ subject: '', grade: '' }]);
        var html = '<section class="apx-sec"><h3>Decision</h3><div class="apx-seg" role="radiogroup" aria-label="Decision">' + opts.map(function (o) { return '<button type="button" role="radio" aria-checked="' + (o[0] === cur) + '" class="' + (o[0] === cur ? 'is-on' : '') + '" data-dec="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></section>';
        html += '<div id="apxOfferForm"' + (isOffer ? '' : ' hidden') + '>' +
            '<section class="apx-sec"><h3>Offer conditions</h3><div class="apx-conds" id="apxConds">' + conds.map(condRow).join('') + '</div><button type="button" class="apx-linkbtn" data-add-cond><i class="fa-solid fa-plus" aria-hidden="true"></i> Add a condition</button>' +
            '<label class="apx-full">Other conditions (as written in the offer)<textarea data-o="conditionsText" rows="2" maxlength="1000">' + esc(d.conditionsText || '') + '</textarea></label></section>' +
            (D.gradeCheck && D.gradeCheck.basis === 'offer' && D.gradeCheck.lines.length ? gradePanel(D.gradeCheck) : '') +
            '<section class="apx-sec"><h3>Money</h3><div class="apx-row">' + moneyField('tuition', 'Tuition per year', d.tuition, D.costs.tuition ? 'Our data: ' + D.costs.tuition : '') + moneyField('scholarship', 'Scholarship per year', d.scholarship) + moneyField('living', 'Living costs per year', d.living, D.costs.living ? 'Estimate for ' + D.costs.city + ': ' + D.costs.living : '') + '</div></section>' +
            '<section class="apx-sec"><h3>Dates</h3><div class="apx-row"><label>Reply by<input type="date" data-o="acceptBy" value="' + esc(d.acceptBy || '') + '"></label><label>Deposit<input type="number" min="0" data-o="depositAmount" value="' + esc(d.deposit ? d.deposit.amount : '') + '"></label><label>Deposit due<input type="date" data-o="depositDue" value="' + esc(d.deposit && d.deposit.due || '') + '"></label><label class="apx-tick"><input type="checkbox" data-o="depositPaid"' + (d.depositPaid ? ' checked' : '') + '> Deposit paid</label></div>' +
            '<label class="apx-full">Your reply<select data-o="choice"><option value="">Not decided yet</option>' + [['firm', 'Firm / first choice'], ['insurance', 'Insurance'], ['accepted', 'Accepted'], ['declined', 'Declined']].map(function (o) { return '<option value="' + o[0] + '"' + (d.choice === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></section>' +
            '<section class="apx-sec"><h3>Next steps</h3><div class="apx-row apx-row--c"><button type="button" class="apx-btn" data-goto-housing><i class="fa-solid fa-house" aria-hidden="true"></i> Housing in ' + esc(D.costs.city || 'the city') + '</button>' + (S.apps.filter(function (x) { return x.status === 'offer'; }).length >= 2 ? '<button type="button" class="apx-btn" data-act-compare><i class="fa-solid fa-table-columns" aria-hidden="true"></i> Compare offers</button>' : '') + '</div>' +
            '<label class="apx-full">Housing notes<textarea data-o="housing" rows="2" maxlength="600">' + esc(d.housing || '') + '</textarea></label><label class="apx-full">Visa notes<textarea data-o="visa" rows="2" maxlength="600">' + esc(d.visa || '') + '</textarea></label></section></div>' +
            '<label class="apx-full">Notes<textarea data-o="notes" rows="2" maxlength="2000">' + esc(d.notes || '') + '</textarea></label>' +
            '<div class="apx-row apx-row--c"><button type="button" class="apx-btn apx-btn--ink" data-save-dec>Save decision</button>' + (dec ? '<button type="button" class="apx-linkbtn apx-linkbtn--bad" data-clear-dec>Clear decision</button>' : '') + '</div>';
        return html;
    }
    function condRow(c) { return '<div class="apx-cond"><input type="text" data-c="subject" value="' + esc(c.subject || '') + '" placeholder="Subject, e.g. Mathematics HL" maxlength="60"><input type="text" data-c="grade" value="' + esc(c.grade || '') + '" placeholder="Grade" maxlength="12"><button type="button" class="apx-icbtn" data-del-cond aria-label="Remove condition"><i class="fa-solid fa-xmark"></i></button></div>'; }
    function moneyField(k, label, m, hint) {
        m = m || {};
        return '<label>' + label + '<span class="apx-money"><select data-m="' + k + '-cur">' + ['GBP', 'EUR', 'USD', 'CHF', 'SEK', 'DKK'].map(function (c) { return '<option' + ((m.currency || defaultCur()) === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select><input type="number" min="0" step="1" data-m="' + k + '" value="' + esc(m.amount || '') + '"></span>' + (hint ? '<small>' + esc(hint) + '</small>' : '') + '</label>';
    }
    function defaultCur() { var cc = S.detail && S.detail.app.uni.cc; return cc === 'gb' ? 'GBP' : cc === 'us' ? 'USD' : cc === 'ch' ? 'CHF' : cc === 'se' ? 'SEK' : cc === 'dk' ? 'DKK' : 'EUR'; }

    function bindDrawer(el) {
        if (el._bound) return; el._bound = true;
        el.addEventListener('click', function (e) {
            var t = e.target, b;
            if ((b = t.closest('[data-dtab]'))) { switchTab(b.getAttribute('data-dtab')); return; }
            if ((b = t.closest('[data-dtab-go]'))) { switchTab(b.getAttribute('data-dtab-go')); return; }
            if ((b = t.closest('[data-write]'))) { openWriting(b.getAttribute('data-write')); return; }
            if (t.closest('[data-open-profile]')) { openProfile(); return; }
            if (t.closest('[data-goto-gradebook]')) { closeAll(); if (typeof showTab === 'function') showTab('gradebook'); return; }
            if (t.closest('[data-goto-housing]')) { closeAll(); if (typeof window.openHousing === 'function') window.openHousing(); else if (typeof showTab === 'function') showTab('housing'); return; }
            if (t.closest('[data-act-compare]')) { openCompare(); return; }
            if ((b = t.closest('[data-attach]'))) { pickDoc(b.getAttribute('data-attach')); return; }
            if ((b = t.closest('[data-view-doc]'))) { viewDoc(b.getAttribute('data-view-doc')); return; }
            if ((b = t.closest('[data-del-doc]'))) { delDoc(b.getAttribute('data-del-doc')); return; }
            if ((b = t.closest('[data-review-doc]'))) { api('PATCH', '/docs/' + b.getAttribute('data-review-doc'), { status: 'needs_review' }).then(reloadDocs); return; }
            if (t.closest('[data-run-check]')) { runCheck(); return; }
            if (t.closest('[data-mark-submitted]')) { markSubmitted(); return; }
            if ((b = t.closest('[data-set-status]'))) { patchApp({ status: b.getAttribute('data-set-status') }); return; }
            if (t.closest('[data-reset-deadline]')) { patchApp({ deadline: null }); return; }
            if (t.closest('[data-del-app]')) { delApp(); return; }
            if (t.closest('[data-addq]')) { addQ(el); return; }
            if ((b = t.closest('[data-dec]'))) { el.querySelectorAll('[data-dec]').forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', on); }); var f = $('apxOfferForm'); if (f) f.hidden = !/^offer/.test(b.getAttribute('data-dec')); return; }
            if (t.closest('[data-add-cond]')) { $('apxConds').insertAdjacentHTML('beforeend', condRow({})); return; }
            if ((b = t.closest('[data-del-cond]'))) { b.closest('.apx-cond').remove(); return; }
            if (t.closest('[data-save-dec]')) { saveDecision(el); return; }
            if (t.closest('[data-clear-dec]')) { if (confirm('Clear the recorded decision?')) api('DELETE', '/one/' + S.open + '/decision').then(refresh); return; }
        });
        el.addEventListener('change', function (e) {
            var t = e.target, k;
            if (t.matches('[data-f="status"]')) { patchApp({ status: t.value }); return; }
            if ((k = t.getAttribute('data-state'))) { putItem(k, { state: t.value }); return; }
            if (t.matches('[data-deadline]')) { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) patchApp({ deadline: t.value }); return; }
            if ((k = t.getAttribute('data-test-date')) || (k = t.getAttribute('data-test-score'))) { saveTest(k); return; }
            if ((k = t.getAttribute('data-ref-who'))) { var it = item(k); putItem(k, { state: it.state === 'todo' ? 'doing' : it.state, data: { who: t.value } }); return; }
            if (t.matches('[data-upload]')) { upload(t.files[0], (el.querySelector('[data-upload-kind]') || {}).value); t.value = ''; return; }
        });
        el.addEventListener('input', debounce(function (e) { if (e.target.matches('[data-f="notes"]')) api('PATCH', '/one/' + S.open, { notes: e.target.value }).catch(function () {}); }, 800));
    }
    function item(k) { return (S.detail.requirements.filter(function (x) { return x.key === k; })[0]) || {}; }
    function putItem(k, body) {
        var it = item(k); body.state = body.state || it.state || 'todo';
        if (body.docId === undefined && it.docId) body.docId = it.docId;
        if (!body.data && it.data) body.data = it.data;
        return api('PUT', '/one/' + S.open + '/items/' + encodeURIComponent(k), body).then(refresh).catch(function (e) { toast(e.message, true); });
    }
    function saveTest(k) {
        var el = $('apxDrawer'), d = el.querySelector('[data-test-date="' + k + '"]').value, sc = el.querySelector('[data-test-score="' + k + '"]').value.trim(), it = item(k);
        var state = sc ? 'done' : d ? (it.state === 'done' ? 'done' : 'doing') : it.state;
        putItem(k, { state: state, data: { date: d || null, score: sc } });
    }
    function patchApp(body) { return api('PATCH', '/one/' + S.open, body).then(refresh).then(function () { if (body.status) toast('Status: ' + ST[body.status][0]); }).catch(function (e) { toast(e.message, true); }); }
    function delApp() {
        if (!confirm('Remove this application? Its checklist, its own writing and its decision are deleted. Shared writing and your documents stay.')) return;
        api('DELETE', '/one/' + S.open).then(function () { closeAll(); load(); toast('Application removed'); }).catch(function (e) { toast(e.message, true); });
    }
    function addQ(el) {
        var g = function (k) { return el.querySelector('[data-q="' + k + '"]'); };
        if (!g('prompt').value.trim() && !g('title').value.trim()) { toast('Paste the question first', true); return; }
        api('POST', '/one/' + S.open + '/writing', { title: g('title').value || 'Short answer', prompt: g('prompt').value, words: +g('words').value || null, chars: +g('chars').value || null })
            .then(function (r) { return refresh().then(function () { openWriting(r.id); }); }).catch(function (e) { toast(e.message, true); });
    }
    function markSubmitted() {
        var el = $('apxDrawer'), d = el.querySelector('[data-sub-date]').value, ref = el.querySelector('[data-sub-ref]').value;
        if (S.detail.app.readiness.pct < 100 && !confirm('Some items aren’t done yet. Mark it as submitted anyway?')) return;
        api('PATCH', '/one/' + S.open, { status: 'submitted', submittedOn: d || today(), submissionRef: ref }).then(function () { S.tab = 'submit'; return refresh(); }).then(function () { toast('Recorded as submitted'); });
    }
    function runCheck() {
        var box = $('apxCheck'), ai = !!(document.querySelector('[data-check-ai]') || {}).checked;
        box.innerHTML = '<p class="apx-hint"><span class="apx-spin" aria-hidden="true"></span> Checking…</p>';
        api('POST', '/one/' + S.open + '/check', { ai: ai }).then(drawCheck).catch(function (e) { box.innerHTML = '<p class="apx-note apx-note--bad">' + esc(e.message) + '</p>'; });
    }
    function saveDecision(el) {
        var dec = (el.querySelector('[data-dec].is-on') || {}).getAttribute ? el.querySelector('[data-dec].is-on').getAttribute('data-dec') : 'offer_conditional';
        var v = function (k) { var x = el.querySelector('[data-o="' + k + '"]'); return x ? (x.type === 'checkbox' ? x.checked : x.value) : ''; };
        var m = function (k) { var a = el.querySelector('[data-m="' + k + '"]'), c = el.querySelector('[data-m="' + k + '-cur"]'); return a && +a.value > 0 ? { amount: +a.value, currency: c.value, per: 'year' } : null; };
        var conds = [].map.call(el.querySelectorAll('.apx-cond'), function (r) { return { subject: r.querySelector('[data-c="subject"]').value.trim(), grade: r.querySelector('[data-c="grade"]').value.trim() }; }).filter(function (c) { return c.subject; });
        var body = { decision: dec, conditions: conds, conditionsText: v('conditionsText'), tuition: m('tuition'), scholarship: m('scholarship'), living: m('living'), acceptBy: v('acceptBy') || null,
            deposit: +v('depositAmount') > 0 ? { amount: +v('depositAmount'), currency: defaultCur(), due: v('depositDue') || null } : null, depositPaid: v('depositPaid'), choice: v('choice') || null, housing: v('housing'), visa: v('visa'), notes: v('notes') };
        api('PUT', '/one/' + S.open + '/decision', body).then(refresh).then(function () { toast('Decision saved'); }).catch(function (e) { toast(e.message, true); });
    }
    function closeAll() { layers.slice().reverse().forEach(closeLayer); }

    /* ── documents ─────────────────────────────────────────────────── */
    function reloadDocs() { return api('GET', '/docs').then(function (d) { S.docs = d.docs; if (S.open) return refresh(); }); }
    function upload(file, kind, then) {
        if (!file) return Promise.resolve(null);
        if (file.size > 8 * 1024 * 1024) { toast('That file is over 8 MB', true); return Promise.resolve(null); }
        toast('Uploading ' + file.name + '…');
        return file.arrayBuffer().then(function (buf) {
            return api('POST', '/docs', null, { headers: { 'content-type': 'application/octet-stream', 'x-file-name': encodeURIComponent(file.name), 'x-doc-kind': kind || 'other' }, body: buf });
        }).then(function (r) { toast(r.reused ? 'Already in your documents — reused' : 'Uploaded'); return reloadDocs().then(function () { if (then) then(r.doc); return r.doc; }); })
            .catch(function (e) { toast(e.message, true); return null; });
    }
    function pickDoc(key) {
        var it = item(key);
        var el = layer('apxPick', 'apx-sheet', '<div class="apx-modal" role="dialog" aria-modal="true" aria-labelledby="apxPickT"><header class="apx-modal__hd"><h3 id="apxPickT">Attach to “' + esc(it.label) + '”</h3><button type="button" class="apx-x" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></header>' +
            '<div class="apx-modal__b">' + uploader() + docList(S.docs || [], false, true) + (it.docId ? '<p><button type="button" class="apx-linkbtn apx-linkbtn--bad" data-detach>Detach the current file</button></p>' : '') + '</div></div>');
        var kindSel = el.querySelector('[data-upload-kind]'); if (kindSel) kindSel.value = it.doc === 'reference' ? 'reference' : /portfolio/.test(key) ? 'portfolio' : /lang/.test(key) ? 'language' : 'transcript';
        el.onclick = function (e) {
            var b = e.target.closest('[data-pick-doc]');
            if (b) { putItem(key, { state: 'done', docId: b.getAttribute('data-pick-doc') }).then(function () { closeLayer(el); }); }
            if (e.target.closest('[data-detach]')) { putItem(key, { state: 'todo', docId: null }).then(function () { closeLayer(el); }); }
        };
        el.onchange = function (e) { if (e.target.matches('[data-upload]')) upload(e.target.files[0], kindSel.value, function (doc) { putItem(key, { state: 'done', docId: doc.id }).then(function () { closeLayer(el); }); }); };
    }
    function viewDoc(id) {
        api('GET', '/docs/' + id + '/file', null, { blob: true, headers: {} }).then(function (blob) {
            var url = URL.createObjectURL(blob), w = window.open(url, '_blank', 'noopener');
            if (!w) { var a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.click(); }
            setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        }).catch(function (e) { toast(e.message, true); });
    }
    function delDoc(id) { if (!confirm('Delete this document? It is removed from every application that uses it.')) return; api('DELETE', '/docs/' + id).then(reloadDocs).then(function () { toast('Document deleted'); }); }

    /* ═══ Writing workspace + Application Assistant ═══════════════════ */
    var W = null;   // { writing, versions, apps, body, saving, result, tab }
    var QUESTIONS = {
        ucas_ps: [['why', 'Why do you want to study this subject?'], ['spark', 'What first made you interested in it?'], ['school', 'Which school subjects, projects or coursework prepared you? What did you learn?'], ['project', 'Which project or piece of work outside class are you proud of? What did you do and learn?'], ['extra', 'Which activities (work, volunteering, clubs, sport) are relevant, and why?'], ['explore', 'What do you want to explore at university?'], ['goals', 'What are your goals after the degree?']],
        commonapp_essay: [['topic', 'Which prompt are you answering, and what is your topic?'], ['moment', 'Describe the specific moment or situation at the centre of it.'], ['action', 'What did you do, think or decide?'], ['change', 'What changed in you, and what did you learn?'], ['now', 'How does it show up in your life now?']],
        uc_piq: [['q1', 'Which four questions are you answering?'], ['story1', 'For the first: what happened and what did you do?'], ['story2', 'For the second: what happened and what did you do?'], ['impact', 'What impact did it have on you or others?']],
        motivation: [['why', 'Why this programme?'], ['whyuni', 'Why this university specifically (courses, people, approach)?'], ['prep', 'How have you prepared (subjects, projects, reading)?'], ['skills', 'Which skills or experiences show you will do well?'], ['goals', 'What do you want to do after it?']],
        pfm: [['why', 'Pourquoi cette formation ?'], ['prep', 'Qu’avez-vous fait pour vous y préparer ?'], ['qual', 'Quelles qualités montrent que vous réussirez ?'], ['projet', 'Quel est votre projet après ?']],
        short: [['answer', 'What is your honest, specific answer?'], ['example', 'Which example or detail proves it?'], ['link', 'How does it connect to this university or course?']],
        supplement: [['answer', 'What is your honest, specific answer?'], ['example', 'Which example or detail proves it?'], ['link', 'How does it connect to this college?']]
    };
    function openWriting(wid) {
        var el = layer('apxWs', 'apx-ws', '<div class="apx-wsx" role="dialog" aria-modal="true" aria-label="Writing workspace"><div class="apx-skel"><i></i><i></i><i></i></div></div>', function () { if (W && W.dirty) saveWorking(true); W = null; if (S.open) refresh(); });
        Promise.all([api('GET', '/writing/' + wid), S.profile ? null : api('GET', '/profile').then(function (p) { S.profile = p.profile || {}; }), api('GET', '/ai/quota').catch(function () { return null; })])
            .then(function (r) { W = { writing: r[0].writing, versions: r[0].versions, apps: r[0].apps, body: JSON.parse(JSON.stringify(r[0].writing.working || {})), result: null, tab: 'build', quota: r[2] && r[2].quota, ai: r[2] ? r[2].configured : S.ai }; drawWs(); })
            .catch(function (e) { el.querySelector('.apx-wsx').innerHTML = '<div class="apx-dr__err"><p>' + esc(e.message) + '</p><button class="apx-btn" data-close>Close</button></div>'; });
    }
    function spec() { return W.writing.spec || {}; }
    function parts() { var sp = spec(); return sp.parts ? (W.body.parts || sp.parts.map(function () { return ''; })) : [W.body.text || '']; }
    function liveStats() {
        var sp = spec(), ps = parts(), chars = ps.reduce(function (n, p) { return n + p.length; }, 0), words = wordsOf(ps.join(' ')), probs = [], warns = [];
        var lim = sp.limit || {};
        if (lim.chars && chars > lim.chars) probs.push('Over the limit by ' + (chars - lim.chars).toLocaleString('en-GB') + ' characters.');
        if (lim.words && words > lim.words) probs.push('Over the limit by ' + (words - lim.words) + ' words.');
        if (lim.minWords && words && words < lim.minWords) warns.push('Under the ' + lim.minWords + '-word minimum.');
        (sp.parts || []).forEach(function (p, i) { var t = ps[i] || ''; if (p.min && t.length < p.min) warns.push('Answer ' + (i + 1) + ': at least ' + p.min + ' characters (' + t.length + ' now).'); if (p.maxWords && wordsOf(t) > p.maxWords) probs.push('Answer ' + (i + 1) + ' is over ' + p.maxWords + ' words.'); });
        [[/ever since i was (young|little|a child)/i], [/from a young age/i], [/\bpassion(ate)?\b/i], [/sparked my (interest|passion|curiosity)/i], [/solid foundation/i], [/\bdelve\b/i], [/\btapestry\b/i]].forEach(function (r) { var m = ps.join(' ').match(r[0]); if (m) warns.push('Generic phrase: “' + m[0] + '”'); });
        return { chars: chars, words: words, problems: probs, warnings: warns };
    }
    function limitLine(st) {
        var lim = spec().limit || {};
        if (lim.chars) return '<b class="' + (st.chars > lim.chars ? 'is-bad' : '') + '">' + st.chars.toLocaleString('en-GB') + '</b> / ' + lim.chars.toLocaleString('en-GB') + ' characters · ' + st.words + ' words';
        if (lim.words) return '<b class="' + (st.words > lim.words ? 'is-bad' : '') + '">' + st.words + '</b> / ' + lim.words + ' words · ' + st.chars.toLocaleString('en-GB') + ' characters';
        return st.words + ' words · ' + st.chars.toLocaleString('en-GB') + ' characters';
    }
    function drawWs() {
        var el = $('apxWs'); if (!el || !W) return;
        var w = W.writing, sp = spec(), st = liveStats();
        var editor = sp.parts ? sp.parts.map(function (p, i) {
            var t = parts()[i] || '';
            return '<div class="apx-part"><label for="apxP' + i + '"><span>' + (i + 1) + '</span>' + esc(p.q) + '</label><textarea id="apxP' + i + '" data-part="' + i + '" spellcheck="true">' + esc(t) + '</textarea><p class="apx-part__c" data-pc="' + i + '">' + partCount(p, t) + '</p></div>';
        }).join('') : '<div class="apx-part">' + (!sp.shared && !sp.prompts ? promptBox(w, sp) : w.prompt ? '<p class="apx-prompt">' + esc(w.prompt) + '</p>' : sp.prompts ? '<details class="apx-prompts"><summary>The prompts</summary><ol>' + sp.prompts.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ol></details>' : '') + '<textarea id="apxP0" data-part="text" class="apx-one" spellcheck="true">' + esc(parts()[0]) + '</textarea></div>';
        el.innerHTML = '<div class="apx-layer__scrim"></div><div class="apx-wsx" role="dialog" aria-modal="true" aria-labelledby="apxWsT">' +
            '<header class="apx-ws__hd"><button type="button" class="apx-btn apx-btn--sm" data-close><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Back</button>' +
            '<div class="apx-ws__id"><h2 id="apxWsT">' + esc(w.title) + '</h2><p>' + (w.shared ? 'Shared by ' + W.apps.length + ' application' + (W.apps.length === 1 ? '' : 's') + ': ' : 'For ') + esc(W.apps.map(function (a) { return a.uni_name.replace(/^(The )?University (of|College) /, ''); }).join(', ') || '—') + '</p></div>' +
            '<div class="apx-ws__act"><span class="apx-saved" id="apxSaved">' + (W.dirty ? 'Unsaved' : 'Saved') + '</span>' +
                '<label class="apx-mini">Status <select data-wstatus><option value="draft"' + (w.status === 'draft' ? ' selected' : '') + '>Draft</option><option value="review"' + (w.status === 'review' ? ' selected' : '') + '>Needs review</option><option value="final"' + (w.status === 'final' ? ' selected' : '') + '>Final</option></select></label>' +
                '<div class="apx-menu-wrap"><button type="button" class="apx-btn apx-btn--sm" data-menu="vers" aria-haspopup="true">Versions · ' + W.versions.length + ' <i class="fa-solid fa-chevron-down" aria-hidden="true"></i></button><div class="apx-menu" id="apxVers">' + versMenu() + '</div></div>' +
                '<button type="button" class="apx-btn apx-btn--sm apx-btn--ink" data-save-ver>Save version</button></div></header>' +
            '<div class="apx-ws__main"><section class="apx-ed" aria-label="Your text">' + (sp.note ? '<p class="apx-rule"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> ' + esc(sp.note) + (sp.s && sp.s.u ? ' ' + srcLink(sp.s) : '') + '</p>' : '') + editor +
                '<p class="apx-total" id="apxTotal">' + limitLine(st) + '</p></section>' +
            '<aside class="apx-as" aria-label="Application Assistant">' + assistant() + '</aside></div></div>';
        autosize(el); bindWs(el);
    }
    // pieces set by one university (supplements, motivation letters): the student pastes the exact question and limit
    function promptBox(w, sp) {
        var lim = sp.limit || {};
        return '<div class="apx-promptbox"><label>The question, exactly as the application asks it<textarea data-wprompt rows="2" maxlength="2000" placeholder="Paste the prompt from the application form">' + esc(w.prompt || '') + '</textarea></label>' +
            '<div class="apx-row"><label>Word limit<input type="number" min="0" max="5000" data-wlim="words" value="' + esc(lim.words || '') + '"></label><label>Character limit<input type="number" min="0" max="20000" data-wlim="chars" value="' + esc(lim.chars || '') + '"></label></div></div>';
    }
    function partCount(p, t) { var w = wordsOf(t); return t.length + ' characters' + (p.min ? ' · min ' + p.min : '') + ' · ' + w + ' words' + (p.maxWords ? ' / ' + p.maxWords : ''); }
    function versMenu() {
        if (!W.versions.length) return '<p class="apx-menu__none">No saved versions yet. “Save version” keeps a snapshot — nothing is ever overwritten.</p>';
        return '<ul>' + W.versions.slice().reverse().map(function (v) { return '<li><span><b>' + esc(v.label) + '</b><small>' + v.words + ' words · ' + v.chars.toLocaleString('en-GB') + ' chars · ' + fmt(v.created_at) + (v.origin !== 'student' ? ' · from assistant' : '') + '</small></span><button type="button" class="apx-linkbtn" data-restore="' + v.n + '">Open as new draft</button></li>'; }).join('') + '</ul>' +
            (W.versions.length >= 2 ? '<button type="button" class="apx-btn apx-btn--sm" data-compare-vers>Compare versions</button>' : '');
    }
    function knows() {
        var p = S.profile || {}, L = [];
        if (p.qualification && (p.qualification.label || p.qualification.total)) L.push((p.qualification.label || p.qualification.sys || '').toString() + (p.qualification.total ? ' · ' + p.qualification.total + (p.qualification.predicted ? ' predicted' : '') : ''));
        var hl = (p.grades || []).slice(0, 3).map(function (g) { return g.name.replace(/ (HL|SL)$/, '') + ' ' + g.grade; });
        if (hl.length) L.push(hl.join(' · '));
        W.apps.forEach(function (a) { L.push(a.uni_name.replace(/^(The )?University (of|College) /, '') + ' · ' + a.course_name); });
        var lim = spec().limit || {}; if (lim.chars) L.push('Limit ' + lim.chars.toLocaleString('en-GB') + ' characters'); else if (lim.words) L.push('Limit ' + lim.words + ' words');
        L.push((p.experiences || []).length + ' experience' + ((p.experiences || []).length === 1 ? '' : 's') + ' in your profile');
        return L;
    }
    function assistant() {
        var q = W.quota, left = q ? Math.max(0, q.limit - q.used) : null;
        var html = '<div class="apx-as__hd"><p class="apx-k">Application Assistant</p>' + (left != null ? '<span class="apx-as__q">' + left + ' of ' + q.limit + ' left today</span>' : '') + '</div>' +
            '<div class="apx-knows"><p>Already knows</p><ul>' + knows().map(function (k) { return '<li>' + esc(k) + '</li>'; }).join('') + '</ul><button type="button" class="apx-linkbtn" data-open-profile>Review profile</button></div>' +
            '<div class="apx-as__tabs" role="tablist">' + [['build', 'Build'], ['improve', 'Improve'], ['check', 'Check']].map(function (t) { return '<button type="button" role="tab" aria-selected="' + (W.tab === t[0]) + '" class="' + (W.tab === t[0] ? 'is-on' : '') + '" data-astab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
            '<div class="apx-as__b" id="apxAsB">' + asBody() + '</div>';
        return html;
    }
    function asBody() {
        if (!W.ai && W.tab !== 'check') return '<p class="apx-note">The assistant needs an AI key on the server. Your writing, counts and checks still work.</p>' + (W.tab === 'build' ? buildQs(true) : '');
        if (W.tab === 'improve') return '<p class="apx-hint">Each tool works on your current text. Rewrites come back as a suggestion — you decide whether to keep it as a new version.</p><div class="apx-tools">' +
            TOOLS.map(function (t) { return '<button type="button" class="apx-tool' + (t[2] ? '' : ' apx-tool--read') + '" data-tool="' + t[0] + '">' + esc(t[1]) + '</button>'; }).join('') + '</div><div id="apxRes">' + resultHTML() + '</div>';
        if (W.tab === 'check') { var st = liveStats(); return '<ul class="apx-checklist">' + (st.problems.length || st.warnings.length ? st.problems.map(function (p) { return '<li class="is-miss"><i class="fa-solid fa-xmark" aria-hidden="true"></i><span>' + esc(p) + '</span></li>'; }).join('') + st.warnings.map(function (p) { return '<li class="is-doing"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span>' + esc(p) + '</span></li>'; }).join('') : '<li class="is-ok"><i class="fa-solid fa-check" aria-hidden="true"></i><span>Within the limits, no generic phrases found.</span></li>') + '</ul>' +
            '<p class="apx-hint">Counts include spaces, as the official systems count them. For a full read, use Improve → “Check against requirements”.</p>'; }
        return buildQs(false) + '<div id="apxRes">' + resultHTML() + '</div>';
    }
    function buildQs(off) {
        var iv = W.writing.interview || {}, qs = QUESTIONS[W.writing.kind] || QUESTIONS.short, ex = (S.profile && S.profile.experiences) || [];
        return '<p class="apx-hint">Answer in your own words — short notes are fine. The draft is built only from what you write here and your profile; nothing is invented.</p>' +
            (ex.length ? '<p class="apx-hint">From your profile: ' + ex.slice(0, 4).map(function (x) { return '<span class="apx-tag">' + esc(x.title) + '</span>'; }).join(' ') + '</p>' : '') +
            '<div class="apx-qs">' + qs.map(function (q) { return '<label><span>' + esc(q[1]) + '</span><textarea data-iv="' + q[0] + '" rows="2" maxlength="1500">' + esc(iv[q[0]] || '') + '</textarea></label>'; }).join('') + '</div>' +
            (off ? '' : '<button type="button" class="apx-btn apx-btn--ink apx-btn--full" data-draft><i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i> Create a draft from my answers</button>');
    }
    function resultHTML() {
        var r = W.result; if (!r) return '';
        if (r.loading) return '<p class="apx-hint"><span class="apx-spin" aria-hidden="true"></span> ' + esc(r.loading) + '</p>';
        if (r.error) return '<p class="apx-note apx-note--bad">' + esc(r.error) + '</p>';
        var html = '<div class="apx-res">' + (r.summary ? '<p class="apx-res__sum">' + esc(r.summary) + '</p>' : '');
        if (r.points && r.points.length) html += '<ol class="apx-points">' + r.points.map(function (p) { return '<li>' + (p.quote ? '<q>' + esc(p.quote) + '</q>' : '') + '<p><b>' + esc(p.issue) + '</b></p>' + (p.fix ? '<p>' + esc(p.fix) + '</p>' : '') + '</li>'; }).join('') + '</ol>';
        if (r.unused && r.unused.length) html += '<div class="apx-unused"><p class="apx-k">In your profile, not in this text</p>' + r.unused.map(function (x) { return '<p>You listed <b>' + esc(x.title) + '</b>. Would it help here? <button type="button" class="apx-linkbtn" data-tool="evidence">See where it fits</button></p>'; }).join('') + '</div>';
        if (r.missing && r.missing.length) html += '<div class="apx-unused"><p class="apx-k">To make it stronger, tell us</p><ul>' + r.missing.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>';
        if (r.suggestion) {
            var sp = spec(), cur = parts(), sug = sp.parts ? r.suggestion.parts : [r.suggestion.text];
            html += '<div class="apx-sug"><p class="apx-k">Suggested ' + (r.kind === 'draft' ? 'draft' : 'revision') + ' · ' + (r.stats ? r.stats.chars.toLocaleString('en-GB') + ' characters · ' + r.stats.words + ' words' : '') + '</p>' +
                sug.map(function (t, i) { return (sp.parts ? '<p class="apx-sug__q">' + (i + 1) + '. ' + esc(sp.parts[i].q) + '</p>' : '') + '<div class="apx-diff">' + (r.kind === 'draft' && !cur.join('').trim() ? esc(t) : diffHTML(cur[i] || '', t)) + '</div>'; }).join('') +
                (r.stats && r.stats.problems.length ? '<p class="apx-note apx-note--bad">' + esc(r.stats.problems.join(' ')) + '</p>' : '') +
                '<div class="apx-row apx-row--c"><button type="button" class="apx-btn apx-btn--ink apx-btn--sm" data-accept>Keep as a new version</button><button type="button" class="apx-btn apx-btn--sm" data-discard>Discard</button></div><p class="apx-hint">Your current text stays as it is unless you keep this. Read it and make it yours — change anything that doesn’t sound like you.</p></div>';
        }
        return html + '</div>';
    }
    function autosize(el) { el.querySelectorAll('.apx-part textarea').forEach(function (t) { t.style.height = 'auto'; t.style.height = Math.max(t.classList.contains('apx-one') ? 360 : 140, t.scrollHeight + 2) + 'px'; }); }
    var saveWorking = function (now) {
        if (!W) return Promise.resolve();
        var w = W, body = JSON.parse(JSON.stringify(W.body));
        var p = api('PUT', '/writing/' + w.writing.id, { working: body }).then(function (r) { w.dirty = false; var s = $('apxSaved'); if (s) s.textContent = 'Saved'; return r; }).catch(function () { var s = $('apxSaved'); if (s) s.textContent = 'Not saved — retrying'; });
        return now ? p : p;
    };
    var saveSoon = debounce(function () { saveWorking(); }, 1200);
    var saveIv = debounce(function () { if (W) api('PUT', '/writing/' + W.writing.id, { interview: W.writing.interview }).catch(function () {}); }, 900);
    function bindWs(el) {
        if (el._bound) return; el._bound = true;
        el.addEventListener('input', function (e) {
            var t = e.target;
            if (t.hasAttribute('data-part')) {
                var k = t.getAttribute('data-part');
                if (k === 'text') W.body.text = t.value; else { W.body.parts = parts().slice(); W.body.parts[+k] = t.value; var pc = el.querySelector('[data-pc="' + k + '"]'); if (pc) pc.textContent = partCount(spec().parts[+k], t.value); }
                t.style.height = 'auto'; t.style.height = Math.max(t.classList.contains('apx-one') ? 360 : 140, t.scrollHeight + 2) + 'px';
                $('apxTotal').innerHTML = limitLine(liveStats()); W.dirty = true; var s = $('apxSaved'); if (s) s.textContent = 'Saving…';
                if (W.tab === 'check') $('apxAsB').innerHTML = asBody();
                saveSoon();
            }
            if (t.hasAttribute('data-iv')) { W.writing.interview = W.writing.interview || {}; W.writing.interview[t.getAttribute('data-iv')] = t.value; saveIv(); }
        });
        el.addEventListener('change', function (e) {
            if (e.target.matches('[data-wprompt]') || e.target.matches('[data-wlim]')) {
                var box = e.target.closest('.apx-promptbox'), pr = box.querySelector('[data-wprompt]').value, wl = +box.querySelector('[data-wlim="words"]').value || null, cl = +box.querySelector('[data-wlim="chars"]').value || null;
                W.writing.prompt = pr; W.writing.spec = Object.assign({}, W.writing.spec, { limit: { words: wl, chars: cl } });
                api('PUT', '/writing/' + W.writing.id, { prompt: pr, limit: { words: wl, chars: cl } }).then(function () { $('apxTotal').innerHTML = limitLine(liveStats()); toast('Question saved'); }).catch(function (er) { toast(er.message, true); });
                return;
            }
            if (e.target.matches('[data-wstatus]')) {
                var v = e.target.value;
                if (v === 'final' && liveStats().problems.length) toast('Fix the limit problems first — final pieces count as done only within the limits.', true);
                saveWorking().then(function () { return api('PUT', '/writing/' + W.writing.id, { status: v }); }).then(function () { W.writing.status = v; toast(v === 'final' ? 'Marked as final' : 'Status updated'); });
            }
        });
        el.addEventListener('click', function (e) {
            var t = e.target, b;
            if ((b = t.closest('[data-astab]'))) { W.tab = b.getAttribute('data-astab'); el.querySelectorAll('[data-astab]').forEach(function (x) { var on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-selected', on); }); $('apxAsB').innerHTML = asBody(); return; }
            if ((b = t.closest('[data-menu]'))) { $('apxVers').classList.toggle('is-open'); return; }
            if (!t.closest('.apx-menu')) { var m = $('apxVers'); if (m) m.classList.remove('is-open'); }
            if (t.closest('[data-save-ver]')) { saveVersion({}); return; }
            if ((b = t.closest('[data-restore]'))) { restore(+b.getAttribute('data-restore')); return; }
            if (t.closest('[data-compare-vers]')) { compareVersions(); return; }
            if (t.closest('[data-open-profile]')) { openProfile(); return; }
            if (t.closest('[data-draft]')) { aiDraft(); return; }
            if ((b = t.closest('[data-tool]'))) { aiTool(b.getAttribute('data-tool')); return; }
            if (t.closest('[data-accept]')) { acceptSuggestion(); return; }
            if (t.closest('[data-discard]')) { W.result = null; $('apxRes').innerHTML = ''; return; }
        });
    }
    function saveVersion(opts) {
        return saveWorking().then(function () {
            return api('POST', '/writing/' + W.writing.id + '/versions', Object.assign({ body: W.body }, opts || {}));
        }).then(function (r) { W.versions.push(Object.assign({ created_at: new Date().toISOString() }, r.version)); toast(r.version.label + ' saved'); var m = $('apxVers'); if (m) m.innerHTML = versMenu(); var btn = document.querySelector('[data-menu="vers"]'); if (btn) btn.innerHTML = 'Versions · ' + W.versions.length + ' <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>'; return r; })
            .catch(function (e) { toast(e.message, true); });
    }
    function restore(n) {
        api('GET', '/writing/' + W.writing.id + '/versions/' + n).then(function (r) {
            if (!confirm('Open “' + r.version.label + '” as a new draft? Your current text is saved as a version first, so nothing is lost.')) return;
            return saveVersion({ label: 'Before restoring ' + r.version.label }).then(function () { W.body = r.version.body; return saveVersion({ label: 'Restored from ' + r.version.label }); }).then(function () { drawWs(); });
        }).catch(function (e) { toast(e.message, true); });
    }
    function acceptSuggestion() {
        var r = W.result; if (!r || !r.suggestion) return;
        var cur = parts(), sug = r.suggestion.parts || [r.suggestion.text];
        if (sug.some(function (t, i) { return !String(t || '').trim() && String(cur[i] || '').trim(); })) { toast('This suggestion leaves an answer empty, so it wasn’t kept. Try again.', true); return; }
        saveVersion({ label: 'Before ' + (r.kind === 'draft' ? 'assistant draft' : 'revision') }).then(function () {
            W.body = r.suggestion; W.result = null;
            return saveVersion({ origin: r.kind === 'draft' ? 'ai_draft' : 'ai_accepted', label: r.kind === 'draft' ? 'Assistant draft' : 'Revision (' + r.tool + ')' });
        }).then(function () { drawWs(); toast('Kept as a new version — the previous text is saved too'); });
    }
    function setResult(r) { W.result = r; var box = $('apxRes'); if (box) box.innerHTML = resultHTML(); }
    function quotaFrom(r) { if (r && r.quota) { W.quota = r.quota; var q = document.querySelector('.apx-as__q'); if (q) q.textContent = Math.max(0, r.quota.limit - r.quota.used) + ' of ' + r.quota.limit + ' left today'; } }
    function aiDraft() {
        if (W.tab !== 'build') return;
        setResult({ loading: 'Building a draft from your answers…' });
        api('PUT', '/writing/' + W.writing.id, { interview: W.writing.interview || {} }).then(function () { return api('POST', '/ai/draft/' + W.writing.id); })
            .then(function (r) { quotaFrom(r); setResult({ kind: 'draft', suggestion: r.suggestion, stats: r.stats, missing: r.missing, summary: r.notes || '' }); })
            .catch(function (e) { quotaFrom(e.data); setResult({ error: e.message }); });
    }
    function aiTool(tool) {
        if (W.tab !== 'improve') { W.tab = 'improve'; drawWs(); }
        setResult({ loading: (TOOLS.filter(function (t) { return t[0] === tool; })[0] || ['', 'Working'])[1] + '…' });
        saveWorking().then(function () { return api('POST', '/ai/tool/' + W.writing.id, { tool: tool, body: W.body }); })
            .then(function (r) { quotaFrom(r); setResult({ kind: 'tool', tool: tool, summary: r.summary, points: r.points, suggestion: r.revised, stats: r.revisedStats, unused: r.unusedExperiences }); })
            .catch(function (e) { quotaFrom(e.data); setResult({ error: e.message }); });
    }
    // word-level diff (LCS) — additions underlined, removals struck through
    function diffHTML(a, b) {
        var A = String(a).split(/(\s+)/), B = String(b).split(/(\s+)/);
        if (A.length * B.length > 900000) return esc(b);
        var n = A.length, m = B.length, dp = new Array(n + 1);
        for (var i = 0; i <= n; i++) { dp[i] = new Uint16Array(m + 1); }
        for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        var out = '', x = 0, y = 0;
        var sp = function () { if (out && !/\s$/.test(out.replace(/<[^>]+>/g, ''))) out += ' '; };   // keep removed words apart
        while (x < n && y < m) { if (A[x] === B[y]) { out += esc(A[x]); x++; y++; } else if (dp[x + 1][y] >= dp[x][y + 1]) { if (A[x].trim()) out += '<del>' + esc(A[x]) + '</del>'; else sp(); x++; } else { out += B[y].trim() ? '<ins>' + esc(B[y]) + '</ins>' : esc(B[y]); y++; } }
        while (x < n) { if (A[x].trim()) out += '<del>' + esc(A[x]) + '</del>'; else sp(); x++; }
        while (y < m) { out += B[y].trim() ? '<ins>' + esc(B[y]) + '</ins>' : esc(B[y]); y++; }
        return out;
    }
    function compareVersions() {
        var vs = W.versions, opt = function (sel) { return vs.map(function (v) { return '<option value="' + v.n + '"' + (v.n === sel ? ' selected' : '') + '>' + esc(v.label) + ' · ' + v.words + ' words</option>'; }).join(''); };
        var el = layer('apxDiffL', 'apx-sheet apx-sheet--wide', '<div class="apx-modal" role="dialog" aria-modal="true" aria-labelledby="apxDiffT"><header class="apx-modal__hd"><h3 id="apxDiffT">Compare versions</h3><button type="button" class="apx-x" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></header>' +
            '<div class="apx-modal__b"><div class="apx-row"><label>From<select data-va>' + opt(vs[vs.length - 2].n) + '</select></label><label>To<select data-vb>' + opt(vs[vs.length - 1].n) + '</select></label></div><div id="apxDiffOut" class="apx-diffout"></div></div></div>');
        function go() {
            var a = +el.querySelector('[data-va]').value, b = +el.querySelector('[data-vb]').value;
            Promise.all([api('GET', '/writing/' + W.writing.id + '/versions/' + a), api('GET', '/writing/' + W.writing.id + '/versions/' + b)]).then(function (r) {
                var sp = spec(), pa = r[0].version.body, pb = r[1].version.body, A = pa.parts || [pa.text || ''], B = pb.parts || [pb.text || ''];
                $('apxDiffOut').innerHTML = '<p class="apx-hint">' + esc(r[0].version.label) + ': ' + r[0].version.words + ' words, ' + r[0].version.chars.toLocaleString('en-GB') + ' characters → ' + esc(r[1].version.label) + ': ' + r[1].version.words + ' words, ' + r[1].version.chars.toLocaleString('en-GB') + ' characters</p>' +
                    B.map(function (t, i) { return (sp.parts ? '<p class="apx-sug__q">' + (i + 1) + '. ' + esc(sp.parts[i].q) + '</p>' : '') + '<div class="apx-diff">' + diffHTML(A[i] || '', t) + '</div>'; }).join('');
            });
        }
        el.onchange = go; go();
    }

    /* ═══ Profile: entered once, used everywhere ═══════════════════════ */
    function localPrefill() {
        var out = { grades: [], languages: [], tests: [], experiences: [], gradesFrom: 'manual' };
        try {
            var gb = JSON.parse(localStorage.getItem('us_gradebook_' + UID) || 'null');
            if (gb && gb.subjects && gb.subjects.length) {
                out.grades = gb.subjects.map(function (s) {
                    var m = [].concat(s.sem1 || [], s.sem2 || []).filter(function (x) { return x !== '' && x != null && !isNaN(x); }).map(Number);
                    var g = m.length ? m.reduce(function (a, b) { return a + b; }, 0) / m.length : s.grade;
                    var lvl = /\bHL\b/.test(s.name) ? 'HL' : /\bSL\b/.test(s.name) ? 'SL' : '';
                    return { name: String(s.name || '').trim(), level: lvl, grade: g == null || g === '' ? '' : String(gb.scale === 'ib' ? Math.round(+g) : Math.round(+g * 10) / 10), predicted: true };
                }).filter(function (g) { return g.name; });
                out.gradesFrom = 'gradebook';
                if (gb.scale === 'ib') { var six = out.grades.map(function (g) { return +g.grade || 0; }).sort(function (a, b) { return b - a; }).slice(0, 6); out.qualification = { sys: 'ib', label: 'IB Diploma', total: six.reduce(function (a, b) { return a + b; }, 0) || null, predicted: true }; }
            }
            var ch = JSON.parse(localStorage.getItem('us_ch_state_' + UID) || 'null');
            if (ch && !out.qualification) {
                if (ch.sys === 'ib' && ch.val) out.qualification = { sys: 'ib', label: 'IB Diploma', total: +ch.val, predicted: true };
                else if (ch.sys === 'alevels' && ch.al) out.qualification = { sys: 'al', label: 'A-levels ' + ch.al.join(''), total: null, predicted: true };
            }
            var p = JSON.parse(localStorage.getItem('us_profile_' + UID) || '{}');
            if (p.country) out.country = p.country;
        } catch (e) {}
        return out;
    }
    function openProfile() {
        var el = layer('apxProf', 'apx-drawer apx-drawer--left', '<aside class="apx-dr apx-prof" role="dialog" aria-modal="true" aria-label="Application profile"><div class="apx-skel apx-skel--dr"><i></i><i></i></div></aside>');
        (S.profile ? Promise.resolve({ profile: S.profile }) : api('GET', '/profile')).then(function (r) {
            var p = r.profile || {}, fresh = !p.updatedAt, pre = localPrefill();
            if (fresh) p = Object.assign({}, pre, p);
            S.profile = p; drawProfile(el, p, fresh, pre);
        }).catch(function (e) { el.querySelector('.apx-dr').innerHTML = '<div class="apx-dr__err"><p>' + esc(e.message) + '</p><button class="apx-btn" data-close>Close</button></div>'; });
    }
    function drawProfile(el, p, fresh, pre) {
        var q = p.qualification || {};
        var row = function (g) { return '<div class="apx-grow"><input data-g="name" value="' + esc(g.name || '') + '" placeholder="Subject" maxlength="60"><input data-g="level" value="' + esc(g.level || '') + '" placeholder="HL / SL / A-level" maxlength="16"><input data-g="grade" value="' + esc(g.grade || '') + '" placeholder="Grade" maxlength="8"><label class="apx-tick"><input type="checkbox" data-g="predicted"' + (g.predicted ? ' checked' : '') + '> predicted</label><button type="button" class="apx-icbtn" data-del-row aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></div>'; };
        var lrow = function (l) { return '<div class="apx-grow"><input data-l="name" value="' + esc(l.name || '') + '" placeholder="Language" maxlength="40"><input data-l="level" value="' + esc(l.level || '') + '" placeholder="native / C1 …" maxlength="20"><input data-l="cert" value="' + esc(l.cert || '') + '" placeholder="Certificate (IELTS…)" maxlength="40"><input data-l="score" value="' + esc(l.score || '') + '" placeholder="Score" maxlength="20"><button type="button" class="apx-icbtn" data-del-row aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></div>'; };
        var trow = function (t) { return '<div class="apx-grow"><input data-t="name" value="' + esc(t.name || '') + '" placeholder="Test (SAT, TMUA…)" maxlength="30"><input data-t="score" value="' + esc(t.score || '') + '" placeholder="Score" maxlength="30"><input type="date" data-t="date" value="' + esc(t.date || '') + '"><button type="button" class="apx-icbtn" data-del-row aria-label="Remove"><i class="fa-solid fa-xmark"></i></button></div>'; };
        el.innerHTML = '<div class="apx-layer__scrim" data-close></div><aside class="apx-dr apx-prof" role="dialog" aria-modal="true" aria-labelledby="apxProfT">' +
            '<header class="apx-dr__hd"><button type="button" class="apx-x" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button><p class="apx-k">Application profile</p><h2 id="apxProfT">Enter it once, use it everywhere</h2>' +
            '<p class="apx-hint">Every application and the assistant use this. ' + (fresh ? '<b>We filled in what UniVersity already knows' + (pre.gradesFrom === 'gradebook' ? ' from your Gradebook' : '') + ' — check it and save.</b>' : 'Last saved ' + fmt(p.updatedAt) + '.') + '</p></header>' +
            '<div class="apx-dr__body apx-prof__b">' +
            '<section class="apx-sec"><h3>Qualification</h3><div class="apx-row"><label>System<select data-q="sys">' + [['ib', 'IB Diploma'], ['al', 'A-levels'], ['ap', 'AP / US high school'], ['other', 'Other']].map(function (o) { return '<option value="' + o[0] + '"' + (q.sys === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label><label>Name<input data-q="label" value="' + esc(q.label || '') + '" maxlength="80"></label><label>Total (if any)<input data-q="total" type="number" min="0" max="100" value="' + esc(q.total || '') + '"></label><label class="apx-tick"><input type="checkbox" data-q="predicted"' + (q.predicted ? ' checked' : '') + '> predicted</label></div></section>' +
            '<section class="apx-sec"><h3>Subjects & grades <small>' + (p.gradesFrom === 'gradebook' ? 'from Gradebook' : 'entered by you') + ' · <button type="button" class="apx-linkbtn" data-import-gb>Import from Gradebook</button></small></h3><div class="apx-rows" data-list="grades">' + (p.grades || []).map(row).join('') + '</div><button type="button" class="apx-linkbtn" data-add-row="grades"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add subject</button></section>' +
            '<section class="apx-sec"><h3>Languages</h3><label>First language<input data-p="firstLanguage" value="' + esc(p.firstLanguage || '') + '" maxlength="40"></label><div class="apx-rows" data-list="languages">' + (p.languages || []).map(lrow).join('') + '</div><button type="button" class="apx-linkbtn" data-add-row="languages"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add language</button></section>' +
            '<section class="apx-sec"><h3>Tests</h3><div class="apx-rows" data-list="tests">' + (p.tests || []).map(trow).join('') + '</div><button type="button" class="apx-linkbtn" data-add-row="tests"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add test</button></section>' +
            '<section class="apx-sec"><h3>Experiences <small>projects, competitions, awards, volunteering, work, sport, activities</small></h3><p class="apx-hint">Be specific and true — the assistant only uses what is here and never adds achievements.</p><div class="apx-exps" id="apxExps">' + (p.experiences || []).map(expRow).join('') + '</div><button type="button" class="apx-btn apx-btn--sm" data-add-exp><i class="fa-solid fa-plus" aria-hidden="true"></i> Add experience</button></section>' +
            '<section class="apx-sec"><h3>Interests & goals</h3><label>Interests in your subject (reading, topics, questions)<textarea data-p="interests" rows="3" maxlength="1500">' + esc(p.interests || '') + '</textarea></label><label>Goals after university<textarea data-p="goals" rows="2" maxlength="1500">' + esc(p.goals || '') + '</textarea></label><div class="apx-row"><label>Country you live in<input data-p="country" value="' + esc(p.country || '') + '" maxlength="40"></label><label>Nationality<input data-p="nationality" value="' + esc(p.nationality || '') + '" maxlength="40"></label></div></section>' +
            '</div><footer class="apx-dr__ft"><button type="button" class="apx-btn" data-close>Cancel</button><button type="button" class="apx-btn apx-btn--ink" data-save-prof>Save profile</button></footer></aside>';
        el.onclick = function (e) {
            var t = e.target, b;
            if ((b = t.closest('[data-add-row]'))) { var k = b.getAttribute('data-add-row'); el.querySelector('[data-list="' + k + '"]').insertAdjacentHTML('beforeend', k === 'grades' ? row({}) : k === 'languages' ? lrow({}) : trow({})); return; }
            if ((b = t.closest('[data-del-row]'))) { b.closest('.apx-grow').remove(); return; }
            if (t.closest('[data-add-exp]')) { $('apxExps').insertAdjacentHTML('beforeend', expRow({ id: 'x' + Date.now().toString(36), type: 'project' }, true)); return; }
            if ((b = t.closest('[data-del-exp]'))) { b.closest('.apx-exp').remove(); return; }
            if (t.closest('[data-import-gb]')) { var pr = localPrefill(); if (!pr.grades.length) { toast('No subjects in your Gradebook yet', true); return; } el.querySelector('[data-list="grades"]').innerHTML = pr.grades.map(row).join(''); p.gradesFrom = 'gradebook'; if (pr.qualification) { el.querySelector('[data-q="sys"]').value = pr.qualification.sys; el.querySelector('[data-q="label"]').value = pr.qualification.label; el.querySelector('[data-q="total"]').value = pr.qualification.total || ''; } toast('Imported ' + pr.grades.length + ' subjects'); return; }
            if (t.closest('[data-save-prof]')) { saveProfile(el, p); return; }
        };
    }
    function expRow(x, open) {
        return '<details class="apx-exp"' + (open ? ' open' : '') + ' data-id="' + esc(x.id) + '"><summary><span class="apx-tag">' + esc((EXP_TYPES.filter(function (t) { return t[0] === x.type; })[0] || ['', 'Experience'])[1]) + '</span><b>' + esc(x.title || 'New experience') + '</b><small>' + esc([x.org, x.when].filter(Boolean).join(' · ')) + '</small></summary>' +
            '<div class="apx-exp__f"><div class="apx-row"><label>Type<select data-x="type">' + EXP_TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === x.type ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select></label><label>Title<input data-x="title" value="' + esc(x.title || '') + '" maxlength="120"></label></div>' +
            '<div class="apx-row"><label>Organisation<input data-x="org" value="' + esc(x.org || '') + '" maxlength="80"></label><label>When<input data-x="when" value="' + esc(x.when || '') + '" placeholder="2025 – now" maxlength="40"></label></div>' +
            '<label>What you did (facts, numbers)<textarea data-x="what" rows="2" maxlength="1200">' + esc(x.what || '') + '</textarea></label><label>What you learned<textarea data-x="learned" rows="2" maxlength="800">' + esc(x.learned || '') + '</textarea></label>' +
            '<label>Link (optional)<input data-x="link" value="' + esc(x.link || '') + '" maxlength="300"></label><button type="button" class="apx-linkbtn apx-linkbtn--bad" data-del-exp>Remove</button></div></details>';
    }
    function saveProfile(el, base) {
        var val = function (sel) { var x = el.querySelector(sel); return x ? (x.type === 'checkbox' ? x.checked : x.value) : ''; };
        var rows = function (list, attr, keys) { return [].map.call(el.querySelectorAll('[data-list="' + list + '"] .apx-grow'), function (r) { var o = {}; keys.forEach(function (k) { var i = r.querySelector('[data-' + attr + '="' + k + '"]'); o[k] = i.type === 'checkbox' ? i.checked : i.value.trim(); }); return o; }); };
        var p = {
            qualification: { sys: val('[data-q="sys"]'), label: val('[data-q="label"]'), total: +val('[data-q="total"]') || null, predicted: val('[data-q="predicted"]') },
            grades: rows('grades', 'g', ['name', 'level', 'grade', 'predicted']), gradesFrom: base.gradesFrom || 'manual',
            languages: rows('languages', 'l', ['name', 'level', 'cert', 'score']), firstLanguage: val('[data-p="firstLanguage"]'),
            tests: rows('tests', 't', ['name', 'score', 'date']),
            experiences: [].map.call(el.querySelectorAll('.apx-exp'), function (d) { var o = { id: d.getAttribute('data-id') }; ['type', 'title', 'org', 'when', 'what', 'learned', 'link'].forEach(function (k) { o[k] = d.querySelector('[data-x="' + k + '"]').value.trim(); }); return o; }),
            interests: val('[data-p="interests"]'), goals: val('[data-p="goals"]'), country: val('[data-p="country"]'), nationality: val('[data-p="nationality"]')
        };
        api('PUT', '/profile', p).then(function (r) { S.profile = Object.assign({ updatedAt: new Date().toISOString() }, r.profile); toast('Profile saved'); closeLayer(el); refresh(); if (W) drawWs(); })
            .catch(function (e) { toast(e.message, true); });
    }

    /* ═══ Add an application ═══════════════════════════════════════════ */
    function openAdd(pre) {
        var el = layer('apxAdd', 'apx-sheet', '<div class="apx-modal" role="dialog" aria-modal="true" aria-labelledby="apxAddT"><header class="apx-modal__hd"><h3 id="apxAddT">Add an application</h3><button type="button" class="apx-x" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></header><div class="apx-modal__b" id="apxAddB"></div></div>');
        var picks = savedPicks();
        function stepUni() {
            $('apxAddB').innerHTML = '<label class="apx-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="apx-sr">University</span><input type="search" data-uq placeholder="Search a university or city" autocomplete="off"></label><div id="apxAddRes" class="apx-addres">' +
                (picks.length ? '<p class="apx-k">From your list</p>' + picks.map(function (u) { return '<button type="button" class="apx-pick" data-pu-cc="' + esc(u.cc) + '" data-pu-id="' + esc(u.id) + '">' + crest(u, 24) + '<span>' + esc(u.name) + '</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>'; }).join('') : '') + '</div>';
            hydrate(el); el.querySelector('[data-uq]').focus();
        }
        var search = debounce(function (v) {
            if (v.trim().length < 2) return;
            api('GET', '/catalog/search?q=' + encodeURIComponent(v)).then(function (r) {
                $('apxAddRes').innerHTML = r.unis.length ? r.unis.map(function (u) { return '<button type="button" class="apx-pick" data-pu-cc="' + esc(u.cc) + '" data-pu-id="' + esc(u.id) + '">' + crest(u, 24) + '<span>' + esc(u.name) + '<small>' + esc([u.city, u.country].filter(Boolean).join(', ')) + (u.courses ? ' · ' + u.courses + ' courses with official entry data' : '') + '</small></span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>'; }).join('') : '<p class="apx-hint">No university found. We cover the 926 universities in UniVersity’s data.</p>';
                hydrate(el);
            });
        }, 220);
        function stepCourse(cc, id) {
            $('apxAddB').innerHTML = '<div class="apx-skel"><i></i></div>';
            api('GET', '/catalog/' + cc + '/' + encodeURIComponent(id)).then(function (c) {
                var u = c.uni;
                $('apxAddB').innerHTML = '<div class="apx-addsel">' + crest(u, 36) + '<div><b>' + esc(u.name) + '</b><small>' + esc([u.city, u.country].filter(Boolean).join(', ')) + '</small></div><button type="button" class="apx-linkbtn" data-back>Change</button></div>' +
                    '<p class="apx-k">Course</p>' + (c.courses.length ? '<div class="apx-cchips">' + c.courses.map(function (x) { return '<button type="button" class="apx-cchip" data-course="' + esc(x.id) + '"><i class="fa-solid ' + esc(x.ic) + '" aria-hidden="true"></i> ' + esc(x.name) + '</button>'; }).join('') + '</div><p class="apx-hint">These courses have official entry requirements in our data. Another course? Type it below.</p>' : '') +
                    '<label class="apx-full"><span class="apx-sr">Course name</span><input data-cname maxlength="120" placeholder="Course name, e.g. Computer Science"></label>' +
                    '<div class="apx-row"><label>Level<select data-level><option value="bachelor">Bachelor’s</option><option value="master">Master’s</option><option value="phd">PhD</option></select></label>' +
                    '<label>Application system<select data-system>' + c.systems.map(function (s) { return '<option value="' + s.id + '"' + (s.id === c.system.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
                    (c.rounds.length ? '<label>Round / deadline<select data-round>' + c.rounds.map(function (r) { return '<option value="' + esc(r.id) + '"' + (/^(rd|jan|eu)$/.test(r.id) ? ' selected' : '') + '>' + esc(r.label) + ' · ' + fmt(r.date) + '</option>'; }).join('') + '</select></label>' : '') + '</div>' +
                    '<p class="apx-hint" id="apxAddSys">' + esc(c.system.summary) + '</p>' +
                    '<div class="apx-row apx-row--c"><button type="button" class="apx-btn apx-btn--ink" data-create disabled>Add application</button></div>';
                hydrate(el);
                var sel = null, chips = el.querySelectorAll('[data-course]'), name = el.querySelector('[data-cname]'), btn = el.querySelector('[data-create]');
                var ucasRound = function () { var r = el.querySelector('[data-round]'); if (!r || c.system.id !== 'ucas') return; r.value = c.ucasOct.unis.indexOf(cc + ':' + id) !== -1 || c.ucasOct.courses.indexOf(sel) !== -1 ? 'oct' : 'jan'; };
                ucasRound();
                function upd() { btn.disabled = !(sel || name.value.trim()); }
                chips.forEach(function (ch) { ch.onclick = function () { sel = sel === ch.getAttribute('data-course') ? null : ch.getAttribute('data-course'); chips.forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-course') === sel); }); if (sel) name.value = ''; ucasRound(); upd(); }; });
                name.oninput = function () { if (name.value.trim()) { sel = null; chips.forEach(function (x) { x.classList.remove('is-on'); }); } upd(); };
                el.querySelector('[data-back]').onclick = stepUni;
                btn.onclick = function () {
                    btn.disabled = true;
                    var body = { uniCc: cc, uniId: id, courseId: sel, courseName: name.value.trim(), level: el.querySelector('[data-level]').value, system: el.querySelector('[data-system]').value, round: (el.querySelector('[data-round]') || {}).value || null };
                    api('POST', '', body).then(function (r) { closeLayer(el); return load().then(function () { openApp(r.id, 'overview'); }); })
                        .catch(function (e) { btn.disabled = false; if (e.code === 'exists' && e.data.id) { closeLayer(el); openApp(e.data.id); toast('You already have this application'); } else toast(e.message, true); });
                };
                if (pre && pre.courseId) { var ch = el.querySelector('[data-course="' + pre.courseId + '"]'); if (ch) ch.click(); }
            }).catch(function (e) { $('apxAddB').innerHTML = '<p class="apx-note apx-note--bad">' + esc(e.message) + '</p>'; });
        }
        el.oninput = function (e) { if (e.target.matches('[data-uq]')) search(e.target.value); };
        el.onclick = function (e) { var b = e.target.closest('[data-pu-cc]'); if (b) stepCourse(b.getAttribute('data-pu-cc'), b.getAttribute('data-pu-id')); };
        if (pre && pre.cc && pre.id) stepCourse(pre.cc, pre.id); else stepUni();
    }

    /* ═══ Offer comparison (facts only — the choice is the student's) ═══ */
    function openCompare() {
        var offers = S.apps.filter(function (a) { return a.status === 'offer' && a.decision; });
        var rows = [['Course', function (a) { return esc(a.course.name); }], ['Where', function (a) { return esc([a.uni.city, a.uni.country].filter(Boolean).join(', ')); }],
            ['Result', function (a) { return esc(decisionLabel(a.decision.decision)); }],
            ['Conditions', function (a) { var d = a.decision.data; return (d.conditions || []).map(function (c) { return esc(c.subject + ' ' + c.grade); }).join('<br>') + (d.conditionsText ? '<small>' + esc(d.conditionsText) + '</small>' : '') || '—'; }],
            ['Tuition / year', function (a) { return money(a.decision.data.tuition); }], ['Scholarship / year', function (a) { return money(a.decision.data.scholarship); }],
            ['Living / year', function (a) { return money(a.decision.data.living); }],
            ['Total / year', function (a) { var d = a.decision.data, t = (d.tuition && d.tuition.amount || 0) - (d.scholarship && d.scholarship.amount || 0) + (d.living && d.living.amount || 0); return d.tuition ? '<b>' + money({ amount: t, currency: d.tuition.currency }) + '</b>' + (d.living ? '' : '<small>without living costs</small>') : '—'; }],
            ['Reply by', function (a) { var d = a.decision.data; return d.acceptBy ? fmt(d.acceptBy, true) : '—'; }], ['Deposit', function (a) { var d = a.decision.data; return d.deposit ? money({ amount: d.deposit.amount, currency: d.deposit.currency }) + (d.deposit.due ? ' · due ' + fmt(d.deposit.due) : '') : '—'; }],
            ['Your reply', function (a) { return esc({ firm: 'Firm', insurance: 'Insurance', accepted: 'Accepted', declined: 'Declined' }[a.decision.data.choice] || 'Not decided'); }]];
        layer('apxCmp', 'apx-sheet apx-sheet--wide', '<div class="apx-modal" role="dialog" aria-modal="true" aria-labelledby="apxCmpT"><header class="apx-modal__hd"><h3 id="apxCmpT">Compare offers</h3><button type="button" class="apx-x" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button></header>' +
            '<div class="apx-modal__b">' + (offers.length < 2 ? '<p class="apx-note">Record at least two offers to compare them.</p>' :
                '<div class="apx-cmpwrap"><table class="apx-cmp"><thead><tr><th></th>' + offers.map(function (a) { return '<th>' + crest(a.uni, 28) + '<b>' + esc(a.uni.name) + '</b></th>'; }).join('') + '</tr></thead><tbody>' +
                rows.map(function (r) { return '<tr><th>' + r[0] + '</th>' + offers.map(function (a) { return '<td>' + r[1](a) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
                '<p class="apx-hint">Amounts are what you entered from each offer (living costs may be estimates). This table doesn’t rank them — the choice is yours.</p>') + '</div></div>');
        hydrate($('apxCmp'));
    }

    /* ── public API (Chances page "Apply", bell, other pages) ───────── */
    window.UniApply = {
        add: function (u) { if (typeof showTab === 'function') showTab('compare'); setTimeout(function () { openAdd(u); }, 60); },
        open: function (id, tab) { if (typeof showTab === 'function') showTab('compare'); openApp(id, tab); },
        count: function () { return S.apps.length || (cached().count || 0); },
        reload: load
    };

    render();
    load();
    // keep the "days left" honest if the tab stays open past midnight, and pick up changes from another tab
    setInterval(function () { if (!document.hidden && !layers.length) load(); }, 10 * 60 * 1000);
}());
