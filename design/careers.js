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
        var ts = TIERF[uni.tier] || 0.5;
        // Prestige-biased employers drop steeply for less-elite universities; broad
        // recruiters (low `pre`) stay reachable — so weaker unis get realistic options.
        var prestigePenalty = 1 - (comp.pre || 0) * (1 - ts);
        var p = 90 * ts * fieldMatch(uni, comp) * (isFeeder(uni, comp) ? 1.35 : 1) * prestigePenalty * (1 - comp.sel * 0.35);
        return Math.max(2, Math.min(96, Math.round(p)));
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

    function findCompany(name) { return D.companies.find(function (c) { return c.name === name; }) || null; }
    // Real company logo via the Clearbit Logo API, with a coloured-monogram fallback.
    function logo(c, sz) {
        var style = sz ? 'width:' + sz + 'px;height:' + sz + 'px' : '';
        if (c.domain) {
            return '<span class="crs__logo crs__logo--img" data-mono="' + esc(initials(c.name)) + '" data-c="' + c.color + '" style="' + style + '">' +
                '<img src="https://logo.clearbit.com/' + c.domain + '?size=128" alt="' + esc(c.name) + '" loading="lazy" onerror="crsLogoFail(this)"></span>';
        }
        return '<span class="crs__logo crs__logo--mono" style="background:' + c.color + ';' + style + '">' + esc(initials(c.name)) + '</span>';
    }
    window.crsLogoFail = function (img) {
        var s = img.parentNode; if (!s) return;
        s.classList.remove('crs__logo--img'); s.classList.add('crs__logo--mono');
        s.style.background = s.getAttribute('data-c') || '#6c3fb0';
        s.textContent = s.getAttribute('data-mono') || '?';
    };
    function chip(txt) { return '<span class="crs__chip">' + esc(txt) + '</span>'; }
    function tierStars(t) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="fa-solid fa-star' + (i <= t ? '' : ' crs__star--off') + '"></i>'; return '<span class="crs__stars">' + s + '</span>'; }

    // ── Top-recruiters view (the current top-10 by market cap) ──
    function companiesHTML() {
        var top = D.companies.filter(function (c) { return c.rank; }).sort(function (a, b) { return a.rank - b.rank; });
        return '<div class="crs__companies">' + top.map(function (c, i) {
            return '<button class="crs__co" data-co="' + esc(c.name) + '" style="--d:' + (i * 45) + 'ms;--c:' + c.color + '">' +
                '<span class="crs__rank">#' + c.rank + '</span>' +
                '<div class="crs__co__hd">' + logo(c) + '<div class="crs__co__id"><div class="crs__co__nm">' + esc(c.name) + '</div><div class="crs__co__sec">' + esc(c.sector) + '</div></div></div>' +
                '<div class="crs__co__meta"><span><i class="fa-solid fa-location-dot"></i> ' + esc(c.city) + ', ' + esc(c.country) + '</span><span><i class="fa-solid fa-sack-dollar"></i> ' + esc(c.salary) + '</span></div>' +
                '<div class="crs__co__lbl">Usually studied</div><div class="crs__chips">' + c.degrees.slice(0, 3).map(chip).join('') + '</div>' +
                '<div class="crs__co__lbl">Top feeder universities</div><div class="crs__chips">' + c.unis.slice(0, 4).map(function (u) { var uu = resolveUni(u); return '<span class="crs__chip crs__chip--uni">' + esc(uu ? (uu.short || uu.name) : u) + '</span>'; }).join('') + '</div>' +
                '<span class="crs__co__more">Details <i class="fa-solid fa-arrow-right"></i></span>' +
            '</button>';
        }).join('') + '</div>';
    }

    // ── University-result view ──
    function resultHTML(uni) {
        // Rank ALL employers (not just the mega-caps) so every university gets
        // realistic, reachable destinations — then show the top matches.
        var ranked = D.companies.map(function (c) { return { c: c, p: prob(uni, c), feeder: isFeeder(uni, c) }; })
            .sort(function (a, b) { return b.p - a.p; }).slice(0, 10);
        var best = ranked[0];
        var rows = ranked.map(function (r, i) {
            var role = r.c.roles[0];
            return '<button class="crs__dest" data-co="' + esc(r.c.name) + '" style="--d:' + (i * 40) + 'ms;--c:' + r.c.color + '">' +
                logo(r.c, 40) +
                '<div class="crs__dest__mid"><div class="crs__dest__nm">' + esc(r.c.name) + (r.feeder ? ' <span class="crs__feeder"><i class="fa-solid fa-bolt"></i> feeder</span>' : '') + '</div>' +
                    '<div class="crs__dest__role">' + esc(role) + ' · ' + esc(r.c.sector) + '</div>' +
                    '<div class="crs__bar"><i data-w="' + r.p + '" style="background:linear-gradient(90deg,' + r.c.color + ',' + r.c.color + 'cc)"></i></div></div>' +
                '<div class="crs__dest__p" style="color:' + r.c.color + '">' + r.p + '<small>%</small></div>' +
            '</button>';
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
                    '<span class="crs__hero__bg"><span class="crs__hero__orb"></span></span>' +
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
            var co = e.target.closest('[data-co]'); if (co) { openCompany(findCompany(co.dataset.co)); return; }
            var s = e.target.closest('.crs__sug'); if (s) selectUni(s.dataset.name);
            else if (!e.target.closest('.crs__search')) hideSug();
        });
    }

    // ── Company detail modal (stacked above the careers modal) ──
    function diffLabel(sel) { return sel >= 0.85 ? 'Extremely hard' : sel >= 0.7 ? 'Very hard' : sel >= 0.55 ? 'Hard' : sel >= 0.4 ? 'Moderate' : 'Accessible'; }
    var coEl = null;
    function openCompany(c) {
        if (!c) return;
        coEl = document.createElement('div');
        coEl.className = 'crs__co__ov';
        var stat = function (ic, v, l) { return '<div class="crs__cx__stat"><i class="fa-solid ' + ic + '"></i><div><b>' + v + '</b><span>' + l + '</span></div></div>'; };
        coEl.innerHTML =
            '<div class="crs__cx" style="--c:' + c.color + '">' +
                '<button class="crs__cx__close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="crs__cx__hd">' + logo(c, 62) +
                    '<div class="crs__cx__id"><div class="crs__cx__nm">' + esc(c.name) + (c.rank ? ' <span class="crs__cx__rank">#' + c.rank + ' by value</span>' : '') + '</div>' +
                        '<div class="crs__cx__sec">' + esc(c.sector) + '</div></div>' +
                    (c.domain ? '<a class="crs__cx__site" href="https://' + c.domain + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Website</a>' : '') +
                '</div>' +
                '<div class="crs__cx__stats">' +
                    stat('fa-location-dot', esc(c.city), esc(c.country)) +
                    stat('fa-sack-dollar', esc(c.salary), 'avg early-career pay') +
                    stat('fa-gauge-high', diffLabel(c.sel), 'entry difficulty') +
                    stat('fa-user-graduate', c.degrees.length + ' fields', 'commonly hired') +
                '</div>' +
                '<div class="crs__cx__about">' + esc(c.about) + '</div>' +
                '<div class="crs__cx__lbl"><i class="fa-solid fa-thumbs-up"></i> Why students consider it</div>' +
                '<ul class="crs__cx__perks">' + (c.perks || []).map(function (p) { return '<li><i class="fa-solid fa-check"></i> ' + esc(p) + '</li>'; }).join('') + '</ul>' +
                '<div class="crs__cx__grid">' +
                    '<div><div class="crs__cx__lbl">Roles they hire</div><div class="crs__chips">' + c.roles.map(chip).join('') + '</div></div>' +
                    '<div><div class="crs__cx__lbl">Degrees they want</div><div class="crs__chips">' + c.degrees.map(chip).join('') + '</div></div>' +
                '</div>' +
                '<div class="crs__cx__lbl">Where they recruit from</div><div class="crs__chips">' + c.unis.map(function (u) { var uu = resolveUni(u); return '<span class="crs__chip crs__chip--uni">' + esc(uu ? (uu.short || uu.name) : u) + '</span>'; }).join('') + '</div>' +
                '<div class="crs__cx__note"><i class="fa-solid fa-circle-info"></i> Figures are approximate early-career averages and vary by role, country and year.</div>' +
            '</div>';
        document.body.appendChild(coEl);
        requestAnimationFrame(function () { coEl.classList.add('open'); });
        function cclose() { if (!coEl) return; coEl.classList.remove('open'); var e = coEl; setTimeout(function () { e.remove(); }, 240); coEl = null; document.removeEventListener('keydown', cKey); }
        function cKey(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); cclose(); } }
        coEl.addEventListener('mousedown', function (ev) { if (ev.target === coEl) cclose(); });
        coEl.querySelector('.crs__cx__close').addEventListener('click', cclose);
        document.addEventListener('keydown', cKey);
    }

    function onKey(e) { if (e.key === 'Escape') { if (coEl) return; close(); } }
    function close() { if (!el) return; document.removeEventListener('keydown', onKey); el.classList.remove('open'); document.body.style.overflow = ''; var e = el; setTimeout(function () { e.remove(); }, 280); el = null; curUni = null; tab = 'top'; }
    window.openCareers = open;
})();
