/* ════════════════════════════════════════════════════════════════════
   Career Paths — top graduate recruiters + a "where can my university take
   me?" explorer with estimated destination probabilities.
   window.openCareers(). Remove careers_* includes to undo.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var D = window.CAREERS || { companies: [], universities: [] };
    function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
    function initials(n) { var w = String(n).replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean); return (w.length === 1 ? w[0].slice(0, 2) : (w[0][0] + w[1][0])).toUpperCase(); }
    var TIERF = { 5: 1.0, 4: 0.82, 3: 0.62, 2: 0.45, 1: 0.3 };

    function fieldMatch(uni, comp) {
        var fs = uni.fields || [];
        return comp.degrees.some(function (d) {
            if (/any/i.test(d)) return true;
            return fs.some(function (f) { var a = f.toLowerCase(), b = d.toLowerCase(); return a.indexOf(b) !== -1 || b.indexOf(a) !== -1; });
        }) ? 1 : 0.32;
    }
    function isFeeder(uni, comp) { return (comp.unis || []).some(function (n) { return norm(n) === norm(uni.name) || (uni.short && norm(n) === norm(uni.short)); }); }
    function prob(uni, comp) {
        var p = 80 * (TIERF[uni.tier] || 0.5) * fieldMatch(uni, comp) * (isFeeder(uni, comp) ? 1.35 : 1) * (1 - comp.sel * 0.45);
        return Math.max(3, Math.min(94, Math.round(p)));
    }

    // Resolve a typed name to a uni object (curated first, then the app's UNI list).
    function allUnis() {
        var out = D.universities.slice();
        try {
            (window.UNI || []).forEach(function (u) {
                if (out.some(function (x) { return norm(x.name) === norm(u.name); })) return;
                out.push({ name: u.name, short: u.abbr || '', tier: Math.max(1, Math.min(5, u.diff || 3)), fields: u.fields || [], fromApp: true });
            });
        } catch (e) {}
        return out;
    }
    function resolveUni(name) {
        var n = norm(name), list = allUnis();
        return list.find(function (u) { return norm(u.name) === n || (u.short && norm(u.short) === n); }) ||
               list.find(function (u) { return norm(u.name).indexOf(n) !== -1 || (u.short && norm(u.short).indexOf(n) !== -1); }) || null;
    }

    function logo(c, sz) {
        var cls = 'crs__logo' + (c.icon ? '' : ' crs__logo--mono');
        return '<span class="' + cls + '" style="background:' + c.color + (sz ? ';width:' + sz + 'px;height:' + sz + 'px' : '') + '">' +
            (c.icon ? '<i class="fa-brands ' + c.icon + '"></i>' : esc(initials(c.name))) + '</span>';
    }
    function chip(txt) { return '<span class="crs__chip">' + esc(txt) + '</span>'; }
    function tierStars(t) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="fa-solid fa-star' + (i <= t ? '' : ' crs__star--off') + '"></i>'; return '<span class="crs__stars">' + s + '</span>'; }

    // ── Top-recruiters view ──
    function companiesHTML() {
        return '<div class="crs__companies">' + D.companies.map(function (c, i) {
            return '<div class="crs__co" style="--d:' + (i * 45) + 'ms;--c:' + c.color + '">' +
                '<div class="crs__co__hd">' + logo(c) + '<div><div class="crs__co__nm">' + esc(c.name) + '</div><div class="crs__co__sec">' + esc(c.sector) + '</div></div>' +
                    '<span class="crs__co__hard" title="Selectivity">' + Math.round(c.sel * 100) + '%<small>bar</small></span></div>' +
                '<div class="crs__co__lbl">Usually studied</div><div class="crs__chips">' + c.degrees.slice(0, 3).map(chip).join('') + '</div>' +
                '<div class="crs__co__lbl">Top feeder universities</div><div class="crs__chips">' + c.unis.slice(0, 4).map(function (u) { var uu = resolveUni(u); return '<span class="crs__chip crs__chip--uni">' + esc(uu ? (uu.short || uu.name) : u) + '</span>'; }).join('') + '</div>' +
            '</div>';
        }).join('') + '</div>';
    }

    // ── University-result view ──
    function resultHTML(uni) {
        var ranked = D.companies.map(function (c) { return { c: c, p: prob(uni, c), feeder: isFeeder(uni, c) }; }).sort(function (a, b) { return b.p - a.p; });
        var best = ranked[0];
        var rows = ranked.map(function (r, i) {
            var role = r.c.roles[0];
            return '<div class="crs__dest" style="--d:' + (i * 40) + 'ms;--c:' + r.c.color + '">' +
                logo(r.c, 40) +
                '<div class="crs__dest__mid"><div class="crs__dest__nm">' + esc(r.c.name) + (r.feeder ? ' <span class="crs__feeder"><i class="fa-solid fa-bolt"></i> feeder</span>' : '') + '</div>' +
                    '<div class="crs__dest__role">' + esc(role) + ' · ' + esc(r.c.sector) + '</div>' +
                    '<div class="crs__bar"><i data-w="' + r.p + '" style="background:linear-gradient(90deg,' + r.c.color + ',' + r.c.color + 'cc)"></i></div></div>' +
                '<div class="crs__dest__p" style="color:' + r.c.color + '">' + r.p + '<small>%</small></div>' +
            '</div>';
        }).join('');
        return '<div class="crs__result">' +
            '<div class="crs__uni">' +
                '<div class="crs__uni__ab">' + esc(initials(uni.name)) + '</div>' +
                '<div class="crs__uni__meta"><div class="crs__uni__nm">' + esc(uni.name) + '</div>' +
                    tierStars(uni.tier) + '<div class="crs__chips" style="margin-top:8px">' + (uni.fields || []).slice(0, 5).map(chip).join('') + '</div></div>' +
            '</div>' +
            '<div class="crs__headline"><i class="fa-solid fa-arrow-trend-up"></i> Best shot: <b>' + esc(best.c.name) + '</b> (' + best.c.roles[0] + ') — around <b style="color:' + best.c.color + '">' + best.p + '%</b></div>' +
            '<div class="crs__dest__lbl">Where graduates from here tend to land <span>· estimated, by field &amp; prestige</span></div>' +
            '<div class="crs__dests">' + rows + '</div>' +
        '</div>';
    }

    function revealBars(root) {
        requestAnimationFrame(function () { requestAnimationFrame(function () {
            root.querySelectorAll('.crs__bar i').forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; });
        }); });
    }

    var el = null, tab = 'top', curUni = null;
    function setTab(t) {
        tab = t;
        var c = el.querySelector('#crsContent');
        el.querySelectorAll('.crs__tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
        if (t === 'top') { c.innerHTML = companiesHTML(); }
        else { c.innerHTML = curUni ? resultHTML(curUni) : '<div class="crs__hint"><i class="fa-solid fa-magnifying-glass"></i> Search your university above to see where it can take you.</div>'; if (curUni) revealBars(c); }
    }
    function selectUni(name) {
        var u = resolveUni(name); if (!u) return;
        curUni = u;
        var inp = el.querySelector('#crsSearch'); if (inp) inp.value = u.name;
        hideSug();
        setTab('mine');
    }

    var sugBox;
    function showSug(q) {
        var nq = norm(q); if (!nq) { hideSug(); return; }
        var matches = allUnis().filter(function (u) { return norm(u.name).indexOf(nq) !== -1 || (u.short && norm(u.short).indexOf(nq) !== -1); }).slice(0, 7);
        if (!matches.length) { hideSug(); return; }
        sugBox.innerHTML = matches.map(function (u) { return '<button class="crs__sug" data-name="' + esc(u.name) + '"><i class="fa-solid fa-graduation-cap"></i> ' + esc(u.name) + (u.fromApp ? '' : ' <span class="crs__sug__t">tier ' + u.tier + '</span>') + '</button>'; }).join('');
        sugBox.style.display = 'block';
    }
    function hideSug() { if (sugBox) sugBox.style.display = 'none'; }

    function open() {
        el = document.createElement('div');
        el.className = 'crs__overlay';
        el.innerHTML =
            '<div class="crs__panel">' +
                '<button class="crs__close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="crs__hero">' +
                    '<span class="crs__hero__orb"></span>' +
                    '<div class="crs__hero__in"><div class="crs__eyebrow"><i class="fa-solid fa-briefcase"></i> Career paths</div>' +
                    '<h2 class="crs__title">Where can your degree take you?</h2>' +
                    '<p class="crs__sub">See who the world’s top employers recruit — then search your university to see your likely destinations.</p>' +
                    '<div class="crs__search"><i class="fa-solid fa-magnifying-glass"></i>' +
                        '<input id="crsSearch" type="text" placeholder="Search your university… e.g. Oxford, MIT, Bocconi" autocomplete="off">' +
                        '<div class="crs__sugs" id="crsSugs"></div></div>' +
                    '</div>' +
                '</div>' +
                '<div class="crs__tabs"><button class="crs__tab on" data-tab="top"><i class="fa-solid fa-trophy"></i> Top recruiters</button>' +
                    '<button class="crs__tab" data-tab="mine"><i class="fa-solid fa-location-arrow"></i> My university</button></div>' +
                '<div class="crs__content" id="crsContent"></div>' +
            '</div>';
        document.body.appendChild(el);
        document.body.style.overflow = 'hidden';
        sugBox = el.querySelector('#crsSugs');
        requestAnimationFrame(function () { el.classList.add('open'); });
        setTab('top');

        el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
        el.querySelector('.crs__close').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        el.querySelectorAll('.crs__tab').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
        var inp = el.querySelector('#crsSearch');
        inp.addEventListener('input', function () { showSug(inp.value); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = sugBox.querySelector('.crs__sug'); if (f) selectUni(f.dataset.name); else selectUni(inp.value); } });
        el.addEventListener('click', function (e) {
            var s = e.target.closest('.crs__sug'); if (s) selectUni(s.dataset.name);
            else if (!e.target.closest('.crs__search')) hideSug();
        });
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { if (!el) return; document.removeEventListener('keydown', onKey); el.classList.remove('open'); document.body.style.overflow = ''; var e = el; setTimeout(function () { e.remove(); }, 280); el = null; curUni = null; tab = 'top'; }
    window.openCareers = open;
})();
