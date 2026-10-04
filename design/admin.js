/* ════════════════════════════════════════════════════════════════════
   UniVersity Admin (admin.html / admin.css) — talks only to the server's
   /api/admin/* routes (server/admin.js). Sign-in is checked on the server;
   the session token lives in sessionStorage and dies with the tab or after
   30 minutes idle. Nothing here trusts the browser for who is Elite.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var API = (function () {
        if (location.protocol === 'file:') return 'http://localhost:4242';
        return (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== '4242') ? 'http://localhost:4242' : location.origin;
    }());
    var TK = 'us_admin_token';
    var token = null; try { token = sessionStorage.getItem(TK); } catch (e) {}
    var S = { people: [], overview: null, ai: null, health: null, content: null, audit: [], page: 'overview', pFilter: 'all', pSort: 'new', pPage: 1, chart: 'signups', cFilter: 'all' };
    var PAGES = {
        overview: ['Overview', 'How UniVersity is doing'], people: ['People', 'Everyone with an account or an Elite record'], elite: ['Elite', 'Paying members and manual grants'],
        ai: ['AI usage', 'Every research question, how fast and how well it went'], content: ['Content', 'The university dataset and the daily news'],
        admissions: ['Admissions data', 'Review what gets published — official figures, public reports and users\' decisions'],
        system: ['System', 'Live checks of every service the app depends on'], audit: ['Audit log', 'Every admin action — append-only'], settings: ['Settings', 'Announcements and admin security']
    };

    /* ── helpers ───────────────────────────────────────────────────── */
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function rel(t) {
        if (!t) return '—'; var s = (Date.now() - t) / 1000;
        if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago';
        if (s < 86400 * 30) return Math.round(s / 86400) + ' d ago'; return new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function when(t) { return t ? new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; }
    function hue(s) { var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
    function name(u) { return u.username || (u.email ? u.email.split('@')[0] : u.key); }
    function ava(u) { return '<span class="ava" style="--h:' + hue(u.email || u.key) + '">' + esc(name(u).charAt(0).toUpperCase()) + '</span>'; }
    function plan(u) { return u.paid ? '<span class="badge badge--paid"><i class="fa-solid fa-crown"></i> Paid</span>' : u.granted ? '<span class="badge badge--granted"><i class="fa-solid fa-gift"></i> Granted</span>' : '<span class="badge">Free</span>'; }
    function toast(msg, bad) { var t = document.createElement('div'); t.className = 'toast' + (bad ? ' is-bad' : ''); t.innerHTML = '<i class="fa-solid ' + (bad ? 'fa-triangle-exclamation' : 'fa-check') + '"></i> ' + esc(msg); $('toasts').appendChild(t); setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 300); }, 3200); }

    function api(path, opts) {
        opts = opts || {};
        var h = { 'x-admin-token': token || '' }; if (opts.body) h['content-type'] = 'application/json';
        return fetch(API + path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
            .then(function (r) {
                if (r.status === 401) { signOut('Your session ended — please sign in again.'); throw new Error('unauthorized'); }
                return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || ('HTTP ' + r.status)); e.data = j; throw e; } return j; });
            });
    }

    /* ── modal: confirm / prompt ───────────────────────────────────── */
    function ask(o) {
        return new Promise(function (resolve) {
            var card = $('modalCard');
            card.innerHTML = '<h3>' + esc(o.title) + '</h3><p>' + o.body + '</p>' + (o.input ? '<label class="fld"><span>' + esc(o.input) + '</span><input id="mIn" autocomplete="off" placeholder="' + esc(o.placeholder || '') + '"></label>' : '') +
                '<div class="modal__acts"><button class="btn btn--ghost" data-m="0">Cancel</button><button class="btn ' + (o.danger ? 'btn--bad' : 'btn--ink') + '" data-m="1">' + esc(o.ok || 'Confirm') + '</button></div>';
            $('modal').classList.add('is-open');
            var inp = $('mIn'); if (inp) setTimeout(function () { inp.focus(); }, 60);
            function done(v) { $('modal').classList.remove('is-open'); card.removeEventListener('click', onClick); document.removeEventListener('keydown', onKey); resolve(v); }
            function onClick(e) { var b = e.target.closest('[data-m]'); if (!b) return; if (b.getAttribute('data-m') === '1') { if (o.input && o.required && !inp.value.trim()) { inp.focus(); return; } done(o.input ? inp.value.trim() : true); } else done(null); }
            function onKey(e) { if (e.key === 'Escape') done(null); if (e.key === 'Enter' && o.input) card.querySelector('[data-m="1"]').click(); }
            card.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
        });
    }

    /* ── sign in / out ─────────────────────────────────────────────── */
    function showLogin(msg) { $('app').hidden = true; $('login').hidden = false; $('lgErr').textContent = msg || ''; setTimeout(function () { $('lgPw').focus(); }, 50); }
    function signOut(msg) { if (token) fetch(API + '/api/admin/logout', { method: 'POST', headers: { 'x-admin-token': token } }).catch(function () {}); token = null; try { sessionStorage.removeItem(TK); } catch (e) {} showLogin(msg); }
    $('lgEye').addEventListener('click', function () { var i = $('lgPw'); i.type = i.type === 'password' ? 'text' : 'password'; this.querySelector('i').className = i.type === 'password' ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash'; });
    $('loginForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var go = $('lgGo'); go.disabled = true; $('lgErr').textContent = '';
        fetch(API + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: $('lgUser').value, password: $('lgPw').value }) })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
                if (!x.ok) { $('lgErr').textContent = x.j.message + (x.j.left != null && x.j.left < 4 ? ' ' + x.j.left + ' tries left.' : ''); var c = $('loginForm'); c.classList.remove('is-shake'); void c.offsetWidth; c.classList.add('is-shake'); return; }
                token = x.j.token; try { sessionStorage.setItem(TK, token); } catch (e2) {}
                $('lgPw').value = ''; start();
            })
            .catch(function () { $('lgErr').textContent = 'Can\'t reach the server — is it running on :4242?'; })
            .then(function () { go.disabled = false; });
    });
    $('logoutBtn').addEventListener('click', function () { signOut(''); });

    /* ── navigation ────────────────────────────────────────────────── */
    function go(page) {
        if (!PAGES[page]) page = 'overview';
        S.page = page;
        document.querySelectorAll('#nav button').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-page') === page); });
        document.querySelectorAll('.pg').forEach(function (p) { p.hidden = p.getAttribute('data-pg') !== page; });
        $('pgTitle').textContent = PAGES[page][0]; $('pgSub').textContent = PAGES[page][1];
        if (location.hash.slice(1) !== page) history.replaceState(null, '', '#' + page);
        closeSide(); load(page);
    }
    $('nav').addEventListener('click', function (e) { var b = e.target.closest('[data-page]'); if (b) go(b.getAttribute('data-page')); });
    document.addEventListener('click', function (e) { var g = e.target.closest('[data-go]'); if (g) go(g.getAttribute('data-go')); });
    function closeSide() { $('side').classList.remove('is-open'); $('scrim').classList.remove('is-on'); }
    $('menuBtn').addEventListener('click', function () { $('side').classList.add('is-open'); $('scrim').classList.add('is-on'); });
    $('scrim').addEventListener('click', closeSide);
    window.addEventListener('scroll', function () { document.querySelector('.top').classList.toggle('is-stuck', scrollY > 4); }, { passive: true });
    $('refreshBtn').addEventListener('click', function () { load(S.page, true); });
    function stamp() { $('updated').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }

    function load(page, fresh) {
        var jobs = { overview: loadOverview, people: loadPeople, elite: loadPeople, ai: loadAI, content: loadContent, admissions: loadAdm, system: function () { return loadHealth(fresh); }, audit: loadAudit, settings: loadSettings };
        return Promise.resolve(jobs[page] && jobs[page]()).then(stamp).catch(function (e) { if (e.message !== 'unauthorized') toast(e.message, true); });
    }

    /* ── overview ──────────────────────────────────────────────────── */
    function kpi(k, icon, label, value, sub, color) { return '<div class="kpi" style="--k:' + k + ';--c:' + color + '"><div class="kpi__k"><i class="fa-solid ' + icon + '"></i>' + label + '</div><div class="kpi__v">' + value + '</div><div class="kpi__s">' + sub + '</div></div>'; }
    function loadOverview() {
        return Promise.all([api('/api/admin/overview'), loadHealth(false)]).then(function (r) {
            var o = S.overview = r[0], k = o.kpi;
            $('kpis').innerHTML =
                kpi(0, 'fa-users', 'People', k.people, '<b>+' + k.signups7 + '</b> this week · ' + k.accounts + ' with accounts', 'var(--blue)') +
                kpi(1, 'fa-bolt', 'Active · 7 days', k.active7, k.people ? Math.round(k.active7 / k.people * 100) + '% of everyone' : '—', 'var(--good)') +
                kpi(2, 'fa-crown', 'Elite', k.elite, '<b>' + k.paid + '</b> paid · ' + k.granted + ' granted', 'var(--gold)') +
                kpi(3, 'fa-euro-sign', 'Revenue / year', '€' + k.arr.toLocaleString(), (k.conversion * 100).toFixed(1) + '% on Elite', 'var(--gold)') +
                kpi(4, 'fa-wand-magic-sparkles', 'AI questions · 7 d', k.ai7, k.ai7 ? (k.aiMs / 1000).toFixed(1) + ' s avg · ' + Math.round(k.aiFail * 100) + '% failed' : 'none yet', 'var(--ai)');
            renderChart(); renderWarnings(o.warnings);
            $('recent').innerHTML = o.recent.length ? o.recent.map(function (u, i) { return '<li data-u="' + esc(u.key) + '" style="--k:' + i + '">' + ava(u) + '<span><b>' + esc(name(u)) + '</b><small>' + esc(u.email || 'no e-mail') + '</small></span>' + plan(u) + '<small>' + rel(u.created) + '</small></li>'; }).join('') : '<li class="empty">No sign-ups yet.</li>';
            $('nPeople').textContent = k.people; $('nElite').textContent = k.elite || ''; $('nAI').textContent = k.ai7 || '';
        });
    }
    function renderWarnings(list) {
        $('warns').innerHTML = (list || []).map(function (w) {
            var ic = w.tone === 'bad' ? 'fa-shield-halved' : w.tone === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info';
            return '<div class="wn wn--' + w.tone + '"><i class="fa-solid ' + ic + '"></i>' + esc(w.text) + (/password/.test(w.text) ? '<button class="btn btn--ghost" data-go="settings">Change it</button>' : '') + '</div>';
        }).join('');
    }
    function renderChart() {
        var o = S.overview; if (!o) return;
        var key = S.chart, col = key === 'signups' ? 'var(--blue)' : key === 'active' ? 'var(--good)' : 'var(--ai)';
        var max = Math.max.apply(null, o.series.map(function (d) { return d[key]; }).concat([1])), total = o.series.reduce(function (a, d) { return a + d[key]; }, 0);
        $('chart').innerHTML = o.series.map(function (d, i) {
            var v = d[key] / max, lbl = new Date(d.d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            return '<div class="chart__b' + (d[key] ? '' : ' is-zero') + '" style="--v:' + Math.max(.012, v).toFixed(3) + ';--c:' + col + ';--k:' + i + '"><i></i><b>' + d[key] + ' · ' + lbl + '</b>' + (i % 5 === 0 ? '<small>' + lbl + '</small>' : '') + '</div>';
        }).join('') + (total ? '' : '<div class="chart__empty">Nothing in the last 30 days yet.</div>');
    }
    $('chartSeg').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; S.chart = b.getAttribute('data-s'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); renderChart(); });

    /* ── people ────────────────────────────────────────────────────── */
    function loadPeople() {
        return api('/api/admin/users').then(function (r) {
            S.people = r.users || []; $('nPeople').textContent = S.people.length; $('nElite').textContent = S.people.filter(function (u) { return u.elite; }).length || '';
            $('peopleList').innerHTML = S.people.filter(function (u) { return u.email; }).map(function (u) { return '<option value="' + esc(u.email) + '">' + esc(name(u)) + '</option>'; }).join('');
            renderPeople(); renderElite();
        });
    }
    function filtered() {
        var q = ($('pSearch').value || '').trim().toLowerCase();
        var list = S.people.filter(function (u) {
            if (q && (String(u.email || '') + ' ' + String(u.username || '')).toLowerCase().indexOf(q) === -1) return false;
            return S.pFilter === 'all' || (S.pFilter === 'elite' && u.elite) || (S.pFilter === 'free' && !u.elite) || u.source === S.pFilter;
        });
        list.sort(function (a, b) { return S.pSort === 'name' ? name(a).localeCompare(name(b)) : S.pSort === 'active' ? (b.lastActive || 0) - (a.lastActive || 0) : (b.created || 0) - (a.created || 0); });
        return list;
    }
    var PER = 25;
    function renderPeople() {
        var list = filtered(), pages = Math.max(1, Math.ceil(list.length / PER)); S.pPage = Math.min(S.pPage, pages);
        var rows = list.slice((S.pPage - 1) * PER, S.pPage * PER);
        $('pTable').innerHTML = rows.length ? '<table><thead><tr><th>Person</th><th>Plan</th><th>Type</th><th>Joined</th><th>Last active</th><th class="num">Synced items</th></tr></thead><tbody>' + rows.map(function (u, i) {
            return '<tr class="is-click" data-u="' + esc(u.key) + '" style="--k:' + i + '"><td><div class="who">' + ava(u) + '<span><b>' + esc(name(u)) + '</b><small>' + esc(u.email || 'no e-mail') + '</small></span></div></td><td>' + plan(u) + '</td>' +
                '<td>' + (u.source === 'account' ? '<span class="badge badge--good"><i class="fa-solid fa-cloud"></i> Account</span>' : '<span class="badge"><i class="fa-solid fa-laptop"></i> Browser-only</span>') + '</td>' +
                '<td class="mono">' + rel(u.created) + '</td><td class="mono">' + rel(u.lastActive) + (u.sessions ? ' <span class="dot" title="signed in now"></span>' : '') + '</td><td class="num mono">' + (u.keys || '—') + '</td></tr>';
        }).join('') + '</tbody></table><div class="pager"><span>' + list.length + ' of ' + S.people.length + ' people</span><span>' +
            (pages > 1 ? '<button class="btn btn--ghost" data-pp="-1"' + (S.pPage === 1 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button> ' + S.pPage + ' / ' + pages + ' <button class="btn btn--ghost" data-pp="1"' + (S.pPage === pages ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>' : '') + '</span></div>'
            : '<div class="empty">Nobody matches.</div>';
    }
    $('pSearch').addEventListener('input', function () { S.pPage = 1; renderPeople(); });
    $('pFilter').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; S.pFilter = b.getAttribute('data-f'); S.pPage = 1; this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); renderPeople(); });
    $('pSort').addEventListener('change', function () { S.pSort = this.value; renderPeople(); });
    $('pTable').addEventListener('click', function (e) { var p = e.target.closest('[data-pp]'); if (p) { S.pPage += +p.getAttribute('data-pp'); renderPeople(); } });
    $('gSearch').addEventListener('input', function () { if (S.page !== 'people') go('people'); $('pSearch').value = this.value; S.pPage = 1; renderPeople(); });
    document.addEventListener('keydown', function (e) { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '') && !$('app').hidden) { e.preventDefault(); ($('gSearch').offsetParent ? $('gSearch') : $('pSearch')).focus(); } if (e.key === 'Escape') closeDrawer(); });
    $('csvBtn').addEventListener('click', function () {
        var rows = [['name', 'email', 'plan', 'type', 'joined', 'last_active', 'synced_items']].concat(filtered().map(function (u) { return [name(u), u.email || '', u.plan, u.source, u.created ? new Date(u.created).toISOString() : '', u.lastActive ? new Date(u.lastActive).toISOString() : '', u.keys || 0]; }));
        var csv = rows.map(function (r) { return r.map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\n');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'university-people-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
        toast('Exported ' + (rows.length - 1) + ' people');
    });

    /* ── person drawer ─────────────────────────────────────────────── */
    document.addEventListener('click', function (e) { var r = e.target.closest('[data-u]'); if (r && !e.target.closest('.drawer')) openDrawer(r.getAttribute('data-u')); });
    function closeDrawer() { $('drawer').classList.remove('is-open'); $('dscrim').classList.remove('is-on'); }
    $('dscrim').addEventListener('click', closeDrawer);
    function openDrawer(key) {
        $('drawer').classList.add('is-open'); $('dscrim').classList.add('is-on');
        $('drawerIn').innerHTML = '<div class="empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</div>';
        api('/api/admin/users/' + encodeURIComponent(key)).then(function (r) {
            var u = r.user, s = r.summary;
            var stat = function (v, l) { return '<div><b>' + (v == null ? '—' : v) + '</b><span>' + l + '</span></div>'; };
            $('drawerIn').innerHTML =
                '<div class="dh">' + ava(u) + '<div><h3>' + esc(name(u)) + '</h3><small>' + esc(u.email || 'no e-mail') + '</small><div class="row" style="margin-top:6px">' + plan(u) +
                    (u.source === 'account' ? '<span class="badge badge--good"><i class="fa-solid fa-cloud"></i> Account</span>' : '<span class="badge"><i class="fa-solid fa-laptop"></i> Browser-only</span>') + (u.cancelAtEnd ? '<span class="badge badge--warn">Cancels at period end</span>' : '') + '</div></div>' +
                    '<button class="ib" id="dClose" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
                '<div class="facts"><div><span>Joined</span><b>' + rel(u.created) + '</b></div><div><span>Last active</span><b>' + rel(u.lastActive) + '</b></div><div><span>Signed in on</span><b>' + (u.sessions || 0) + ' device' + (u.sessions === 1 ? '' : 's') + '</b></div>' +
                    (u.renews ? '<div><span>Renews</span><b>' + new Date(u.renews).toLocaleDateString('en-GB') + '</b></div>' : '') + '</div>' +
                (s ? '<div class="dstats">' + stat(s.saved, 'saved unis') + stat(s.subjects, 'subjects') + stat(s.streak ? s.streak.count : 0, 'day streak') + stat(s.aiQuestions, 'AI questions') +
                    stat(s.scholarships, 'scholarships') + stat(s.careers, 'careers') + stat(s.deadlines, 'deadlines') + stat(s.friends, 'friends') + '</div>' : '<p class="muted">Browser-only people keep their data on their device — only their Elite record lives on the server.</p>') +
                '<div class="dacts">' + (u.elite && !u.paid ? '<button class="btn btn--ghost" data-act="revoke"><i class="fa-solid fa-crown"></i> Revoke Elite</button>' : !u.elite ? '<button class="btn btn--gold" data-act="grant"><i class="fa-solid fa-crown"></i> Grant Elite</button>' : '') +
                    (u.source === 'account' ? '<button class="btn btn--ghost" data-act="signout"><i class="fa-solid fa-right-from-bracket"></i> Sign out everywhere</button>' : '') +
                    '<button class="btn btn--ghost" data-act="export"><i class="fa-solid fa-download"></i> Export data</button><button class="btn btn--bad" data-act="delete"><i class="fa-solid fa-trash"></i> Delete</button></div>' +
                (r.ai && r.ai.length ? '<article class="card"><header class="card__hd"><h3>Recent AI questions</h3></header><ul class="mini">' + r.ai.map(function (a, i) { return '<li style="--k:' + i + '"><span class="mini__ic"><i class="fa-solid fa-wand-magic-sparkles"></i></span><span><b>' + esc(a.query) + '</b><small>' + rel(a.ts) + ' · ' + (a.ms / 1000).toFixed(1) + ' s' + (a.ok ? '' : ' · failed') + '</small></span></li>'; }).join('') + '</ul></article>' : '') +
                (s && s.keys.length ? '<article class="card"><header class="card__hd"><h3>Synced data</h3><small>' + s.keys.length + ' items</small></header><ul class="dkeys">' + s.keys.map(function (k) { return '<li><span>' + esc(k.key.replace(/_(user|u|google)_[\w]+$/, '')) + '</span><span>' + (k.size > 1024 ? (k.size / 1024).toFixed(1) + ' KB' : k.size + ' B') + ' · ' + rel(new Date(k.updated).getTime()) + '</span></li>'; }).join('') + '</ul></article>' : '');
            $('dClose').addEventListener('click', closeDrawer);
            $('drawerIn').querySelector('.dacts').addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (b) act(u, b.getAttribute('data-act')); });
        }).catch(function (e) { $('drawerIn').innerHTML = '<div class="empty">' + esc(e.message) + '</div>'; });
    }
    function act(u, what) {
        var k = encodeURIComponent(u.key);
        if (what === 'grant' || what === 'revoke') {
            return ask({ title: what === 'grant' ? 'Grant Elite' : 'Revoke Elite', body: (what === 'grant' ? 'Give <b>' : 'Take Elite away from <b>') + esc(name(u)) + '</b>' + (what === 'grant' ? ' Elite for free.' : '.') + ' This is logged.', input: 'Reason', placeholder: what === 'grant' ? 'e.g. beta tester' : 'e.g. trial ended', required: true, ok: what === 'grant' ? 'Grant' : 'Revoke', danger: what === 'revoke' })
                .then(function (why) { if (!why) return; return api('/api/admin/users/' + k + '/elite', { method: 'POST', body: { on: what === 'grant', reason: why } }).then(function () { toast(what === 'grant' ? 'Elite granted to ' + name(u) : 'Elite revoked'); return loadPeople(); }).then(function () { openDrawer(u.key); }); })
                .catch(function (e) { toast(e.message, true); });
        }
        if (what === 'signout') return ask({ title: 'Sign out everywhere', body: 'End every session of <b>' + esc(name(u)) + '</b>? They\'ll sign in again next time.', ok: 'Sign out' })
            .then(function (ok) { if (ok) return api('/api/admin/users/' + k + '/signout', { method: 'POST', body: {} }).then(function () { toast('Signed out on every device'); openDrawer(u.key); }); }).catch(function (e) { toast(e.message, true); });
        if (what === 'export') return api('/api/admin/users/' + k + '/export').then(function (d) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'university-' + (u.email || u.key).replace(/[^\w.-]+/g, '_') + '.json'; a.click(); toast('Data exported'); }).catch(function (e) { toast(e.message, true); });
        if (what === 'delete') return ask({ title: 'Delete this person', body: 'This permanently removes <b>' + esc(u.email || u.key) + '</b> and all their synced data. Type the ' + (u.email ? 'e-mail' : 'id') + ' to confirm.', input: u.email ? 'E-mail' : 'Id', placeholder: u.email || u.key, required: true, ok: 'Delete forever', danger: true })
            .then(function (v) { if (!v) return; return api('/api/admin/users/' + k, { method: 'DELETE', body: { confirm: v } }).then(function () { toast('Deleted'); closeDrawer(); return loadPeople(); }); }).catch(function (e) { toast(e.message, true); });
    }

    /* ── Elite ─────────────────────────────────────────────────────── */
    function renderElite() {
        var el = S.people.filter(function (u) { return u.elite; }), paid = el.filter(function (u) { return u.paid; }), soon = paid.filter(function (u) { return u.renews && u.renews - Date.now() < 30 * 864e5; });
        $('eKpis').innerHTML = kpi(0, 'fa-crown', 'Paying', paid.length, '€' + (paid.length * 15).toLocaleString() + ' a year', 'var(--gold)') +
            kpi(1, 'fa-gift', 'Granted', el.length - paid.length, 'free Elite for partners & testers', 'var(--ai)') +
            kpi(2, 'fa-rotate', 'Renewing · 30 d', soon.length, soon.filter(function (u) { return u.cancelAtEnd; }).length + ' set to cancel', 'var(--blue)');
        $('eNote').textContent = el.length + ' member' + (el.length === 1 ? '' : 's');
        $('eTable').innerHTML = el.length ? '<table><thead><tr><th>Member</th><th>Plan</th><th>Status</th><th>Renews</th><th></th></tr></thead><tbody>' + el.map(function (u, i) {
            return '<tr class="is-click" data-u="' + esc(u.key) + '" style="--k:' + i + '"><td><div class="who">' + ava(u) + '<span><b>' + esc(name(u)) + '</b><small>' + esc(u.email || '') + '</small></span></div></td><td>' + plan(u) + '</td>' +
                '<td class="mono">' + esc(u.paid ? (u.subStatus || 'active') + (u.cancelAtEnd ? ' · cancels' : '') : 'manual grant') + '</td><td class="mono">' + (u.renews ? new Date(u.renews).toLocaleDateString('en-GB') : '—') + '</td><td><i class="fa-solid fa-chevron-right" style="color:var(--mute)"></i></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No Elite members yet.</div>';
    }
    $('grantForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var who = $('gWho').value.trim().toLowerCase(), u = S.people.find(function (x) { return String(x.email || '').toLowerCase() === who; });
        if (!u) return toast('No one with that e-mail — they need to sign up first.', true);
        if (u.elite) return toast(name(u) + ' is already Elite.', true);
        api('/api/admin/users/' + encodeURIComponent(u.key) + '/elite', { method: 'POST', body: { on: true, reason: $('gWhy').value.trim() } })
            .then(function () { toast('Elite granted to ' + name(u)); $('gWho').value = ''; $('gWhy').value = ''; return loadPeople(); }).catch(function (e2) { toast(e2.message, true); });
    });

    /* ── AI usage ──────────────────────────────────────────────────── */
    function loadAI() {
        return api('/api/admin/ai').then(function (r) {
            S.ai = r; var t = r.total || {}, n = t.n || 0;
            $('aKpis').innerHTML = kpi(0, 'fa-wand-magic-sparkles', 'Questions · 30 d', n, (t.deep || 0) + ' deep research', 'var(--ai)') +
                kpi(1, 'fa-stopwatch', 'Average time', n ? ((t.ms || 0) / 1000).toFixed(1) + ' s' : '—', 'p95 ' + (r.p95 ? (r.p95 / 1000).toFixed(1) + ' s' : '—'), 'var(--blue)') +
                kpi(2, 'fa-circle-exclamation', 'Failed', n ? Math.round((t.bad || 0) / n * 100) + '%' : '—', (t.bad || 0) + ' of ' + n, 'var(--bad)') +
                kpi(3, 'fa-layer-group', 'Sources per answer', n ? Math.round((t.reddit || 0) + (t.news || 0)) : '—', n ? Math.round(t.reddit || 0) + ' Reddit · ' + Math.round(t.news || 0) + ' news' : '', 'var(--good)');
            var max = Math.max.apply(null, (r.subjects || []).map(function (x) { return x.n; }).concat([1]));
            $('aSubjects').innerHTML = (r.subjects || []).length ? r.subjects.map(function (x) { return '<li><span>' + esc(x.subject) + '</span><b>' + x.n + '</b><i style="--v:' + (x.n / max).toFixed(3) + '"></i></li>'; }).join('') : '<li class="empty">Nothing asked yet.</li>';
            $('aTable').innerHTML = (r.rows || []).length ? '<table><thead><tr><th>When</th><th>Question</th><th>About</th><th class="num">Time</th><th class="num">Reddit · news · reviews</th><th>Result</th></tr></thead><tbody>' + r.rows.slice(0, 80).map(function (a, i) {
                return '<tr style="--k:' + i + '"><td class="mono">' + rel(a.ts) + '</td><td><div class="q" title="' + esc(a.query) + '">' + (a.deep ? '<i class="fa-solid fa-brain" style="color:var(--ai)" title="Deep research"></i> ' : '') + esc(a.query) + '</div></td><td>' + esc(a.subject || '—') + '</td>' +
                    '<td class="num mono">' + (a.ms / 1000).toFixed(1) + ' s</td><td class="num mono">' + (a.reddit || 0) + ' · ' + (a.news || 0) + ' · ' + (a.reviews || 0) + '</td><td>' + (a.ok ? '<span class="badge badge--good">OK</span>' : '<span class="badge badge--bad" title="' + esc(a.error || '') + '">' + esc(/stopped/.test(a.error || '') ? 'Stopped' : 'Failed') + '</span>') + '</td></tr>';
            }).join('') + '</tbody></table>' : '<div class="empty">No AI questions yet — they appear here as people ask.</div>';
            $('nAI').textContent = r.rows.filter(function (a) { return Date.now() - a.ts < 7 * 864e5; }).length || '';
        });
    }

    /* ── content ───────────────────────────────────────────────────── */
    function loadContent() {
        return api('/api/admin/content').then(function (r) {
            S.content = r;
            $('cTable').innerHTML = '<table><thead><tr><th>Country</th><th class="num">Universities</th><th class="num">Cities</th><th class="num">No website</th><th class="num">Duplicates</th><th>Health</th></tr></thead><tbody>' + r.countries.map(function (c, i) {
                var col = c.score >= 85 ? 'var(--good)' : c.score >= 70 ? 'var(--warn)' : 'var(--bad)';
                return '<tr style="--k:' + i + '"><td><b>' + esc(c.name) + '</b> <span class="mono">' + c.cc.toUpperCase() + '</span></td><td class="num mono">' + c.unis + '</td><td class="num mono">' + c.cities + '</td><td class="num mono">' + c.noWebsite + '</td><td class="num mono">' + (c.dupes ? '<b style="color:var(--bad)">' + c.dupes + '</b>' : 0) + '</td>' +
                    '<td><div class="score" style="--c:' + col + '"><i style="--v:' + (c.score / 100).toFixed(2) + '"></i><b>' + c.score + '</b></div></td></tr>';
            }).join('') + '</tbody></table>';
            renderIssues();
            $('cNewsAt').textContent = r.news && r.news.at ? 'built ' + rel(r.news.at) : 'not built yet';
            $('cNews').innerHTML = r.news && r.news.items.length ? r.news.items.map(function (n, i) { return '<li style="--k:' + i + '"><span class="mini__ic"><i class="fa-regular fa-newspaper"></i></span><span><b>' + esc(n.title) + '</b><small>' + esc(n.category || '') + '</small></span></li>'; }).join('') : '<li class="empty">No brief today.</li>';
        });
    }
    function renderIssues() {
        var r = S.content; if (!r) return;
        var list = r.issues.filter(function (x) { return S.cFilter === 'all' || x.kind === S.cFilter; });
        var ic = { duplicate: 'fa-clone', tuition: 'fa-euro-sign', website: 'fa-link-slash' };
        $('cIssues').innerHTML = list.length ? list.slice(0, 80).map(function (x) { return '<li><i class="fa-solid ' + (ic[x.kind] || 'fa-circle-exclamation') + '" style="color:var(--' + (x.kind === 'duplicate' ? 'bad' : 'warn') + ')"></i>' + esc(x.uni) + '<em>' + x.cc.toUpperCase() + ' · ' + esc(x.text) + '</em></li>'; }).join('') : '<li class="empty">Nothing to fix here.</li>';
    }
    $('cFilter').addEventListener('click', function (e) { var b = e.target.closest('[data-k]'); if (!b) return; S.cFilter = b.getAttribute('data-k'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); renderIssues(); });

    /* ── admissions data (server/admissions.js) ─────────────────────── */
    var ADM = { status: 'pending', type: '', q: '', rows: [], offset: 0, off: 'pending', unis: null };
    var SRCB = { official: ['badge--granted', 'fa-building-columns', 'Official'], public_self_report: ['badge--warn', 'fa-comments', 'Public report'], user_reported: ['', 'fa-user', 'User'], user_verified: ['badge--good', 'fa-circle-check', 'Verified user'] };
    var RES = { accepted: 'badge--good', rejected: 'badge--bad', waitlisted: 'badge--warn' };
    function admUnis() {
        if (ADM.unis) return ADM.unis;
        var codes = ['gb', 'us', 'ch', 'nl', 'se', 'de', 'fr', 'it', 'es', 'ie', 'dk', 'fi', 'be', 'pt', 'ua'], out = [];
        ADM.unis = Promise.all(codes.map(function (cc) { return fetch('data/' + cc + '.json').then(function (r) { return r.json(); }).then(function (d) { (d.universities || []).forEach(function (u) { out.push({ key: cc + ':' + u.id, name: u.name, label: u.name + ' (' + cc.toUpperCase() + ')' }); }); }).catch(function () {}); }))
            .then(function () { $('admUnis').innerHTML = out.map(function (u) { return '<option value="' + esc(u.label) + '"></option>'; }).join(''); return out; });
        return ADM.unis;
    }
    function uniKeyOf(label) { return admUnis().then(function (list) { var l = String(label || '').trim(), hit = list.filter(function (u) { return u.label === l || u.key === l || u.name.toLowerCase() === l.toLowerCase(); })[0]; return hit ? hit.key : null; }); }
    function loadAdm() {
        admUnis();
        return Promise.all([api('/api/admin/admissions/overview'), loadAdmRows(true), loadAdmOfficial()]).then(function (r) {
            var o = r[0], n = function (st, ty) { return o.by.filter(function (x) { return (!st || x.review_status === st) && (!ty || x.source_type === ty); }).reduce(function (a, x) { return a + x.n; }, 0); };
            var pend = n('pending'), off = o.official;
            $('admKpis').innerHTML = kpi(0, 'fa-inbox', 'Waiting for review', pend, o.flags + ' possible duplicate' + (o.flags === 1 ? '' : 's'), 'var(--warn)') +
                kpi(1, 'fa-circle-check', 'Published records', n('approved'), n('approved', 'public_self_report') + ' public · ' + (n('approved', 'user_reported') + n('approved', 'user_verified')) + ' users · ' + n('approved', 'user_verified') + ' verified', 'var(--good)') +
                kpi(2, 'fa-building-columns', 'Official items', off.stats + off.reqs + off.sch, (off.pstats + off.preqs) + ' pending · ' + off.sources + ' sources', 'var(--blue)') +
                kpi(3, 'fa-magnifying-glass', 'Research', o.research.busy ? 'Running' : 'Idle', (o.research.auto ? 'auto on' : 'auto off') + ' · web search ' + (o.research.webSearch ? 'on' : 'needs a key'), 'var(--ai)');
            $('nAdm').textContent = pend || '';
            $('admRs').textContent = o.research.busy ? 'a search is running…' : '';
            $('admJobs').innerHTML = o.jobs.length ? o.jobs.slice(0, 8).map(function (j) {
                var s = j.stats || {}, b = j.status === 'done' ? 'badge--good' : j.status === 'error' ? 'badge--bad' : 'badge--warn';
                return '<li><span class="mini__ic"><i class="fa-solid fa-magnifying-glass"></i></span><span><b>' + esc(j.name || j.uni_key) + (j.program ? ' · ' + esc(j.program) : '') + '</b><small>' + rel(new Date(j.created_at).getTime()) + ' · ' +
                    (s.candidates != null ? s.candidates + ' candidates · ' + (s.inserted || 0) + ' new · ' + (s.duplicates || 0) + ' duplicates' + (s.throttled ? ' · archive busy' : '') : esc(j.requested_by || '')) + '</small></span><span class="badge ' + b + '">' + esc(j.status) + '</span></li>';
            }).join('') : '<li class="empty">No searches yet.</li>';
        });
    }
    function loadAdmRows(fresh) {
        if (fresh) { ADM.offset = 0; ADM.rows = []; }
        var qs = '?status=' + ADM.status + (ADM.type ? '&type=' + ADM.type : '') + (ADM.q ? '&q=' + encodeURIComponent(ADM.q) : '') + '&limit=50&offset=' + ADM.offset;
        return api('/api/admin/admissions/records' + qs).then(function (r) { ADM.rows = ADM.rows.concat(r.rows); ADM.offset += r.rows.length; $('admMore').hidden = !r.page.more; renderAdm(); });
    }
    function renderAdm() {
        $('admTable').innerHTML = ADM.rows.length ? '<table><thead><tr><th>Added</th><th>University · programme</th><th>Grade</th><th>Result</th><th>Source</th><th>Confidence</th><th></th></tr></thead><tbody>' + ADM.rows.map(function (o, i) {
            var sb = SRCB[o.source_type] || SRCB.user_reported, tests = Object.keys(o.test_scores || {}).map(function (k) { return k + ' ' + o.test_scores[k]; }).concat(Object.keys(o.language_scores || {}).map(function (k) { return k + ' ' + o.language_scores[k]; }));
            return '<tr style="--k:' + Math.min(i, 20) + '"><td class="mono">' + rel(new Date(o.created_at).getTime()) + '</td>' +
                '<td><div class="adm-u"><b>' + esc(o.uni_name || o.uni_key) + '</b> <span class="mono">' + esc(o.uni_key) + '</span></div><div class="adm-p">' + esc([o.program_raw || 'programme not stated', o.level, o.intake_year].filter(Boolean).join(' · ')) + '</div>' +
                    (o.evidence ? '<div class="adm-ev">“' + esc(o.evidence) + '”</div>' : '') + (o.review_note ? '<div class="adm-note"><i class="fa-solid fa-circle-info"></i> ' + esc(o.review_note) + '</div>' : '') + (o.dup_of ? '<div class="adm-note adm-note--dup"><i class="fa-solid fa-clone"></i> may duplicate <span class="mono">' + esc(o.dup_of) + '</span></div>' : '') + '</td>' +
                '<td>' + (o.score_raw ? '<b>' + esc(o.score_raw) + '</b> <span class="mono">' + esc(o.qualification) + '</span>' : '<span class="muted">—</span>') + (tests.length ? '<div class="mono">' + esc(tests.join(' · ')) + '</div>' : '') + '</td>' +
                '<td><span class="badge ' + (RES[o.result] || '') + '">' + esc(o.result) + '</span></td>' +
                '<td><span class="badge ' + sb[0] + '"><i class="fa-solid ' + sb[1] + '"></i>' + sb[2] + '</span>' + (o.source_url ? '<div><a class="lnk" href="' + esc(o.source_url) + '" target="_blank" rel="noopener">' + esc(o.publisher || 'source') + ' <i class="fa-solid fa-arrow-up-right-from-square"></i></a></div>' : '<div class="mono">' + esc(o.source_reference || '') + '</div>') + '</td>' +
                '<td><select class="sel sel--sm" data-adm-conf="' + esc(o.id) + '">' + ['high', 'medium', 'low'].map(function (c) { return '<option' + (o.confidence === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></td>' +
                '<td class="adm-acts">' + (o.review_status !== 'approved' ? '<button class="btn btn--sm btn--ink" data-adm="approve" data-id="' + esc(o.id) + '" title="Publish"><i class="fa-solid fa-check"></i></button>' : '') +
                    (o.review_status !== 'rejected' ? '<button class="btn btn--sm btn--ghost" data-adm="reject" data-id="' + esc(o.id) + '" title="Reject"><i class="fa-solid fa-ban"></i></button>' : '') +
                    '<button class="btn btn--sm btn--ghost" data-adm="edit" data-i="' + i + '" title="Correct"><i class="fa-solid fa-pen"></i></button>' +
                    '<button class="btn btn--sm btn--ghost" data-adm="merge" data-id="' + esc(o.id) + '" data-into="' + esc(o.dup_of || '') + '" title="Merge into another record"><i class="fa-solid fa-code-merge"></i></button>' +
                    '<button class="btn btn--sm btn--bad" data-adm="remove" data-id="' + esc(o.id) + '" title="Remove"><i class="fa-solid fa-trash"></i></button></td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">Nothing here.</div>';
    }
    function loadAdmOfficial() {
        return api('/api/admin/admissions/official?status=' + ADM.off).then(function (r) {
            var rows = r.stats.map(function (s) { return { kind: 'stats', s: s, what: [s.applications != null ? s.applications + ' applications' : '', s.offers != null ? s.offers + ' offers' : '', s.admitted != null ? s.admitted + ' admitted' : '', s.places != null ? s.places + ' places' : '', s.score_measure ? s.score_measure + ' ' + s.score_p25 + '–' + s.score_p75 : ''].filter(Boolean).join(' · ') }; })
                .concat(r.requirements.map(function (s) { return { kind: 'requirements', s: s, what: [s.typical_offer || s.min_score_raw, (s.tests_required || []).join(', '), Object.keys(s.language || {}).map(function (k) { return k + ' ' + s.language[k]; }).join(' / ')].filter(Boolean).join(' · ') }; }))
                .concat(r.scholarships.map(function (s) { return { kind: 'scholarships', s: s, what: s.name + (s.amount_min != null ? ' · ' + (s.currency || '') + ' ' + s.amount_min : '') }; }));
            $('admOffTable').innerHTML = rows.length ? '<table><thead><tr><th>Kind</th><th>University · programme</th><th>Figures</th><th>Source</th><th></th></tr></thead><tbody>' + rows.map(function (x, i) {
                var s = x.s;
                return '<tr style="--k:' + Math.min(i, 20) + '"><td><span class="badge badge--granted">' + ({ stats: 'Statistic', requirements: 'Requirement', scholarships: 'Scholarship' })[x.kind] + '</span></td><td><b>' + esc(s.uni_name || s.uni_key) + '</b><div class="adm-p">' + esc([s.program_name, s.level, s.cycle].filter(Boolean).join(' · ') || 'all programmes') + '</div></td>' +
                    '<td>' + esc(x.what || '—') + (s.notes ? '<div class="adm-ev">' + esc(s.notes) + '</div>' : '') + '</td><td>' + (s.source_url ? '<a class="lnk" href="' + esc(s.source_url) + '" target="_blank" rel="noopener">' + esc(s.publisher || 'source') + ' <i class="fa-solid fa-arrow-up-right-from-square"></i></a>' : '—') + '<div class="mono">' + esc(String(s.collected_at || s.source_date || '').slice(0, 10)) + '</div></td>' +
                    '<td class="adm-acts">' + (s.review_status !== 'approved' ? '<button class="btn btn--sm btn--ink" data-off="approved" data-kind="' + x.kind + '" data-id="' + esc(s.id) + '"><i class="fa-solid fa-check"></i></button>' : '') + (s.review_status !== 'rejected' ? '<button class="btn btn--sm btn--ghost" data-off="rejected" data-kind="' + x.kind + '" data-id="' + esc(s.id) + '"><i class="fa-solid fa-ban"></i></button>' : '') + '</td></tr>';
            }).join('') + '</tbody></table>' : '<div class="empty">Nothing ' + ADM.off + '.</div>';
        });
    }
    function admPatch(id, body, msg) { return api('/api/admin/admissions/records/' + encodeURIComponent(id), { method: 'PATCH', body: body }).then(function () { toast(msg); return loadAdm(); }).catch(function (e) { toast(e.message, true); }); }
    function admEdit(o) {
        var card = $('modalCard');
        card.innerHTML = '<h3>Correct this record</h3><p>Fix the university match, programme or grade. Changes are logged.</p><div class="stack">' +
            '<label class="fld"><span>University</span><input id="aeUni" list="admUnis" value="' + esc(o.uni_name ? o.uni_name + ' (' + o.uni_key.split(':')[0].toUpperCase() + ')' : o.uni_key) + '"></label>' +
            '<div class="row"><label class="fld"><span>Programme</span><input id="aeProg" value="' + esc(o.program_raw || '') + '"></label><label class="fld"><span>Level</span><select class="sel" id="aeLevel">' + ['bachelor', 'master', 'phd', 'other'].map(function (l) { return '<option' + (o.level === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label></div>' +
            '<div class="row"><label class="fld"><span>Qualification</span><input id="aeQual" value="' + esc(o.qualification || '') + '" placeholder="ib, a_levels, gpa_us…"></label><label class="fld"><span>Score as written</span><input id="aeScore" value="' + esc(o.score_raw || '') + '"></label>' +
            '<label class="fld"><span>Result</span><select class="sel" id="aeRes">' + ['accepted', 'rejected', 'waitlisted', 'withdrawn', 'unknown'].map(function (l) { return '<option' + (o.result === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label></div>' +
            '<label class="fld"><span>Note</span><input id="aeNote" value="' + esc(o.review_note || '') + '"></label></div>' +
            '<div class="modal__acts"><button class="btn btn--ghost" data-ae="0">Cancel</button><button class="btn btn--ink" data-ae="1">Save</button></div>';
        $('modal').classList.add('is-open');
        card.onclick = function (e) {
            var b = e.target.closest('[data-ae]'); if (!b) return;
            if (b.getAttribute('data-ae') === '0') { $('modal').classList.remove('is-open'); card.onclick = null; return; }
            uniKeyOf($('aeUni').value).then(function (key) {
                if (!key) { toast('Pick a university from the list.', true); return; }
                var body = { uni_key: key, program_raw: $('aeProg').value, level: $('aeLevel').value, result: $('aeRes').value, review_note: $('aeNote').value };
                if ($('aeQual').value.trim()) { body.qualification = $('aeQual').value.trim(); body.score_raw = $('aeScore').value.trim(); }
                $('modal').classList.remove('is-open'); card.onclick = null;
                admPatch(o.id, body, 'Record corrected');
            });
        };
    }
    $('admStatus').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; ADM.status = b.getAttribute('data-s'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); loadAdmRows(true); });
    $('admOffSeg').addEventListener('click', function (e) { var b = e.target.closest('[data-s]'); if (!b) return; ADM.off = b.getAttribute('data-s'); this.querySelectorAll('button').forEach(function (x) { x.classList.toggle('is-on', x === b); }); loadAdmOfficial(); });
    $('admType').addEventListener('change', function () { ADM.type = this.value; loadAdmRows(true); });
    var admQT = 0; $('admQ').addEventListener('input', function () { var v = this.value; clearTimeout(admQT); admQT = setTimeout(function () { ADM.q = v.trim(); loadAdmRows(true); }, 300); });
    $('admMoreBtn').addEventListener('click', function () { loadAdmRows(false); });
    $('admTable').addEventListener('change', function (e) { var s = e.target.closest('[data-adm-conf]'); if (s) admPatch(s.getAttribute('data-adm-conf'), { confidence: s.value }, 'Confidence set to ' + s.value); });
    $('admTable').addEventListener('click', function (e) {
        var b = e.target.closest('[data-adm]'); if (!b) return;
        var act = b.getAttribute('data-adm'), id = b.getAttribute('data-id');
        if (act === 'approve') admPatch(id, { review_status: 'approved' }, 'Published');
        else if (act === 'reject') admPatch(id, { review_status: 'rejected' }, 'Rejected');
        else if (act === 'edit') admEdit(ADM.rows[+b.getAttribute('data-i')]);
        else if (act === 'merge') ask({ title: 'Merge as a duplicate', body: 'This record will be hidden and counted as the same applicant as the record you name.', input: 'Keep this record (id)', placeholder: 'ao_…', ok: 'Merge', required: true }).then(function (into) {
            if (!into) return; api('/api/admin/admissions/records/' + encodeURIComponent(id) + '/merge', { method: 'POST', body: { into: into } }).then(function () { toast('Merged'); loadAdm(); }).catch(function (er) { toast(er.message, true); });
        }), setTimeout(function () { var inp = $('mIn'); if (inp && b.getAttribute('data-into')) inp.value = b.getAttribute('data-into'); }, 80);
        else if (act === 'remove') ask({ title: 'Remove this record?', body: 'It disappears from every statistic. A UniVersity user\'s own copy stays private to them.', ok: 'Remove', danger: true }).then(function (ok) {
            if (ok) api('/api/admin/admissions/records/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () { toast('Removed'); loadAdm(); }).catch(function (er) { toast(er.message, true); });
        });
    });
    $('admOffTable').addEventListener('click', function (e) {
        var b = e.target.closest('[data-off]'); if (!b) return;
        api('/api/admin/admissions/official/' + b.getAttribute('data-kind') + '/' + encodeURIComponent(b.getAttribute('data-id')), { method: 'PATCH', body: { review_status: b.getAttribute('data-off') } })
            .then(function () { toast(b.getAttribute('data-off') === 'approved' ? 'Published' : 'Rejected'); loadAdm(); }).catch(function (er) { toast(er.message, true); });
    });
    $('admResearch').addEventListener('submit', function (e) {
        e.preventDefault();
        uniKeyOf($('admUni').value).then(function (key) {
            if (!key) { toast('Pick a university from the list.', true); return; }
            var p = key.split(':');
            api('/api/admin/admissions/research', { method: 'POST', body: { cc: p[0], uniId: p.slice(1).join(':'), program: $('admProg').value.trim(), force: $('admForce').checked } })
                .then(function (r) { toast(r.queued ? 'Search queued' : r.reason === 'searched_recently' ? 'Searched in the last 21 days — tick "ignore the cache" to run again' : 'Already queued'); loadAdm(); }).catch(function (er) { toast(er.message, true); });
        });
    });
    $('admOfficial').addEventListener('submit', function (e) {
        e.preventDefault();
        var btn = this.querySelector('button'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reading the page…';
        uniKeyOf($('admOffUni').value).then(function (key) {
            if (!key) { toast('Pick a university from the list.', true); return; }
            var p = key.split(':');
            return api('/api/admin/admissions/official-url', { method: 'POST', body: { cc: p[0], uniId: p.slice(1).join(':'), url: $('admOffUrl').value.trim(), program: $('admOffProg').value.trim() } })
                .then(function (r) { var f = r.found; toast('Found ' + f.stats + ' statistics, ' + f.requirements + ' requirements, ' + f.scholarships + ' scholarships' + (f.discarded ? ' (' + f.discarded + ' unquoted discarded)' : '') + ' — review below'); ADM.off = 'pending'; loadAdm(); });
        }).catch(function (er) { toast(er.message, true); }).then(function () { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-building-columns"></i> Extract for review'; });
    });

    /* ── system ────────────────────────────────────────────────────── */
    function loadHealth(fresh) {
        return api('/api/admin/health' + (fresh ? '?fresh=1' : '')).then(function (r) {
            S.health = r; var bad = r.checks.filter(function (c) { return !c.ok && !/legacy/i.test(c.name); }), warn = r.checks.filter(function (c) { return c.warn; });
            $('sysDot').className = 'side__dot ' + (bad.length ? 'bad' : warn.length ? 'warn' : 'ok');
            var st = function (c) { return c.warn ? 'warn' : c.ok ? 'ok' : /legacy/i.test(c.name) ? 'off' : 'bad'; };
            $('sysMini').innerHTML = r.checks.map(function (c) { return '<span class="is-' + st(c) + '" title="' + esc(c.detail) + '"><i></i>' + esc(c.name) + '</span>'; }).join('');
            $('health').innerHTML = r.checks.map(function (c, i) {
                var s = st(c), lbl = { warn: '<b style="color:var(--warn)">Limited</b> · ', bad: '<b style="color:var(--bad)">Failing</b> · ', off: '<b>Not used any more</b> · ', ok: '' }[s];
                return '<div class="hc hc--' + s + '" style="--k:' + i + '"><span class="hc__ic"><i class="fa-' + (c.icon === 'fa-reddit-alien' ? 'brands' : 'solid') + ' ' + c.icon + '"></i></span><div><b>' + esc(c.name) + '</b><small>' + lbl + esc(c.detail) + '</small></div><em>' + c.ms + ' ms</em></div>';
            }).join('');
            var sv = r.server, up = sv.uptime;
            $('server').innerHTML = '<div><span>Uptime</span><b>' + (up > 86400 ? Math.floor(up / 86400) + ' d ' : '') + Math.floor(up % 86400 / 3600) + ' h ' + Math.floor(up % 3600 / 60) + ' m</b></div><div><span>Memory</span><b>' + sv.rssMB + ' MB</b></div><div><span>Heap</span><b>' + sv.heapMB + ' MB</b></div><div><span>Node</span><b>' + esc(sv.node) + '</b></div><div><span>Checked</span><b>' + rel(r.at) + '</b></div>';
        });
    }

    /* ── audit ─────────────────────────────────────────────────────── */
    var ACT = { login: ['fa-right-to-bracket', 'Signed in'], login_failed: ['fa-shield-halved', 'Failed sign-in'], password_changed: ['fa-key', 'Changed password'], elite_granted: ['fa-crown', 'Granted Elite'], elite_revoked: ['fa-crown', 'Revoked Elite'],
        user_signed_out: ['fa-right-from-bracket', 'Signed a person out'], user_exported: ['fa-download', 'Exported data'], user_deleted: ['fa-trash', 'Deleted a person'], announcement_set: ['fa-bullhorn', 'Published a banner'], announcement_cleared: ['fa-bullhorn', 'Cleared the banner'] };
    function loadAudit() { return api('/api/admin/audit').then(function (r) { S.audit = r.rows || []; renderAudit(); }); }
    function renderAudit() {
        var q = ($('auSearch').value || '').toLowerCase();
        var list = S.audit.filter(function (a) { return !q || [a.action, a.actor, a.target, a.ip, a.detail].join(' ').toLowerCase().indexOf(q) !== -1; });
        $('auTable').innerHTML = list.length ? '<table><thead><tr><th>When</th><th>What</th><th>Who</th><th>On</th><th>Details</th><th>IP</th></tr></thead><tbody>' + list.map(function (a, i) {
            var m = ACT[a.action] || ['fa-circle', a.action], d = ''; try { var o = JSON.parse(a.detail || 'null'); if (o) d = Object.keys(o).map(function (k) { return k + ': ' + o[k]; }).join(' · '); } catch (e) {}
            return '<tr style="--k:' + Math.min(i, 30) + '"><td class="mono" title="' + new Date(a.ts).toISOString() + '">' + when(a.ts) + '</td><td><i class="fa-solid ' + m[0] + '" style="width:16px;color:' + (a.action === 'login_failed' || a.action === 'user_deleted' ? 'var(--bad)' : 'var(--mute)') + '"></i> ' + esc(m[1]) + '</td><td>' + esc(a.actor) + '</td><td>' + esc(a.target || '—') + '</td><td class="mono">' + esc(d || '—') + '</td><td class="mono">' + esc(String(a.ip || '').replace('::ffff:', '')) + '</td></tr>';
        }).join('') + '</tbody></table>' : '<div class="empty">No entries.</div>';
    }
    $('auSearch').addEventListener('input', renderAudit);

    /* ── settings ──────────────────────────────────────────────────── */
    function loadSettings() {
        return fetch(API + '/api/announcement').then(function (r) { return r.json(); }).then(function (r) {
            var a = r.announcement;
            if (a) { $('annText').value = a.text; $('annTone').value = a.tone; $('annLink').value = a.link || ''; }
            annPreview(a ? 'Live now' + (a.until ? ' · until ' + when(a.until) : '') : '');
        });
    }
    function annPreview(note) {
        var t = $('annText').value.trim();
        $('annPrev').className = 'ann__prev ann--' + $('annTone').value;
        $('annPrev').innerHTML = t ? '<i class="fa-solid fa-bullhorn"></i><span>' + esc(t) + '</span>' + (note ? '<span class="badge" style="margin-left:auto">' + esc(note) + '</span>' : '') : '';
    }
    ['annText', 'annTone'].forEach(function (id) { $(id).addEventListener('input', function () { annPreview(''); }); });
    $('annForm').addEventListener('submit', function (e) {
        e.preventDefault(); if (!$('annText').value.trim()) return toast('Write a message first.', true);
        api('/api/admin/announcement', { method: 'POST', body: { text: $('annText').value.trim(), tone: $('annTone').value, link: $('annLink').value.trim(), hours: $('annHours').value } })
            .then(function () { toast('Banner is live across the app'); loadSettings(); }).catch(function (e2) { toast(e2.message, true); });
    });
    $('annClear').addEventListener('click', function () { api('/api/admin/announcement', { method: 'POST', body: { text: '' } }).then(function () { $('annText').value = ''; annPreview(''); toast('Banner cleared'); }).catch(function (e) { toast(e.message, true); }); });
    $('pwNew').addEventListener('input', function () {
        var v = this.value, sc = (v.length >= 10) + (v.length >= 14) + /[A-Z]/.test(v) + /\d/.test(v) + /[^\w]/.test(v);
        var m = $('pwMeter'); m.querySelector('i').style.setProperty('--v', Math.min(1, sc / 5)); m.querySelector('i').style.setProperty('--c', sc >= 4 ? 'var(--good)' : sc >= 2 ? 'var(--warn)' : 'var(--bad)');
        m.querySelector('span').textContent = v.length < 10 ? 'At least 10 characters' : sc >= 4 ? 'Strong' : sc >= 2 ? 'OK — add numbers or symbols' : 'Weak';
    });
    $('pwForm').addEventListener('submit', function (e) {
        e.preventDefault();
        api('/api/admin/password', { method: 'POST', body: { current: $('pwCur').value, next: $('pwNew').value } })
            .then(function () { toast('Password changed — other sessions signed out'); $('pwCur').value = ''; $('pwNew').value = ''; S.overview && (S.overview.warnings = S.overview.warnings.filter(function (w) { return !/password/.test(w.text); })); renderWarnings(S.overview ? S.overview.warnings : []); })
            .catch(function (e2) { toast(e2.message, true); });
    });

    /* ── theme + boot ──────────────────────────────────────────────── */
    function theme(dark) { document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light'); $('themeBtn').querySelector('i').className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon'; try { localStorage.setItem('us_theme', dark ? 'dark' : 'light'); } catch (e) {} }
    theme(document.documentElement.getAttribute('data-theme') === 'dark');
    $('themeBtn').addEventListener('click', function () { theme(document.documentElement.getAttribute('data-theme') !== 'dark'); });
    function start() {
        $('login').hidden = true; $('app').hidden = false;
        api('/api/admin/me').then(function (m) { $('meName').textContent = m.user; }).catch(function () {});
        loadPeople().catch(function () {});
        go((location.hash || '#overview').slice(1));
    }
    if (token) api('/api/admin/me').then(start).catch(function () {}); else showLogin('');
})();
