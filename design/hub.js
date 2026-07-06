/* ════════════════════════════════════════════════════════════════════
   Your Snapshot — a personalised hub modal (squares) pulling live data from
   across the app. Opens from a button on the Overview, from Settings, and
   automatically right after onboarding (so the setup choices "do something").
   Self-contained: remove hub.js/.css includes to undo.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    function uid() { try { return (window.user && window.user.id) || 'guest'; } catch (e) { return 'guest'; } }
    function prof() { try { return (window.getProfile && window.getProfile()) || {}; } catch (e) { return {}; } }
    function saved() { try { return (window.getSaved && window.getSaved()) || []; } catch (e) { try { return JSON.parse(localStorage.getItem('us_saved_' + uid()) || '[]'); } catch (_) { return []; } } }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
    function findUni(id) { try { return (window.UNI || []).find(function (u) { return u.id === id; }) || null; } catch (e) { return null; } }
    function go(tab) { close(); try { if (window.showTab) window.showTab(tab); } catch (e) {} }

    function gradeInfo() {
        try {
            var g = JSON.parse(localStorage.getItem('us_gradebook_' + uid()) || 'null');
            if (!g || !g.subjects || !g.subjects.length) return { has: false, subjects: 0 };
            var pct = (window.studentGradePercent && window.studentGradePercent());
            return { has: true, subjects: g.subjects.length, pct: pct == null ? null : Math.round(pct) };
        } catch (e) { return { has: false, subjects: 0 }; }
    }
    function deadlineInfo() {
        var get = function (id) { var el = document.getElementById(id); return el ? (parseInt(el.textContent, 10) || 0) : 0; };
        var custom = 0; try { custom = (JSON.parse(localStorage.getItem('us_dl_cust_' + uid()) || '[]') || []).length; } catch (e) {}
        return { overdue: get('dlCntOverdue'), soon: get('dlCntSoon'), month: get('dlCntMonth'), done: get('dlCntDone'), custom: custom };
    }
    function chanceInfo() {
        if (!(window.uniChanceInfo)) return null;
        var g = window.studentGradePercent && window.studentGradePercent();
        if (g == null) return null;
        var out = { safety: 0, match: 0, reach: 0 };
        saved().forEach(function (id) { var u = findUni(id); if (!u) return; var c = window.uniChanceInfo(u); if (c) out[c.cls] = (out[c.cls] || 0) + 1; });
        return out;
    }
    function suggestions() {
        var subs = (prof().subjects || []).map(function (s) { return String(s).toLowerCase(); });
        var sv = saved();
        var list = (window.UNI || []).filter(function (u) { return sv.indexOf(u.id) === -1; });
        list.forEach(function (u) {
            var score = 0;
            (u.fields || []).forEach(function (f) { var fl = String(f).toLowerCase(); if (subs.some(function (s) { return fl.indexOf(s) !== -1 || s.indexOf(fl) !== -1; })) score += 3; });
            if ((u.ts || 3) <= 2) score += 1;               // gently prefer affordable
            u.__score = score;
        });
        list.sort(function (a, b) { return (b.__score - a.__score) || (a.ts - b.ts); });
        return list.slice(0, 3);
    }

    function square(cls, icon, title, bodyHTML, ctaLabel, onClickAttr) {
        return '<div class="hub__sq hub__sq--' + cls + '">' +
            '<div class="hub__sq__hd"><span class="hub__sq__ic"><i class="fa-solid ' + icon + '"></i></span><span class="hub__sq__t">' + title + '</span></div>' +
            '<div class="hub__sq__body">' + bodyHTML + '</div>' +
            (ctaLabel ? '<button class="hub__sq__cta" ' + onClickAttr + '>' + ctaLabel + ' <i class="fa-solid fa-arrow-right"></i></button>' : '') +
        '</div>';
    }

    function buildSquares() {
        var p = prof(), sv = saved(), gi = gradeInfo(), di = deadlineInfo(), ch = chanceInfo();

        // Suggestions
        var sug = suggestions();
        var sugBody = sug.length ? '<div class="hub__unis">' + sug.map(function (u) {
            return '<button class="hub__uni" data-uni="' + u.id + '"><span class="hub__uni__ab" style="background:' + (u.color || '#d97c14') + '">' + esc((u.abbr || u.name.slice(0, 2)).toUpperCase()) + '</span>' +
                '<span class="hub__uni__meta"><b>' + esc(u.name) + '</b><small>' + esc(u.city || '') + (u.type ? ' · ' + esc(u.type) : '') + '</small></span></button>';
        }).join('') + '</div>' : '<p class="hub__muted">Tell us your favourite subjects (in setup) and we’ll suggest universities you’ll love.</p>';

        // Chances
        var chBody;
        if (ch) chBody = '<div class="hub__pills"><span class="hub__pill hub__pill--g">' + ch.safety + ' Safety</span><span class="hub__pill hub__pill--b">' + ch.match + ' Match</span><span class="hub__pill hub__pill--o">' + ch.reach + ' Reach</span></div>' +
            '<p class="hub__muted">Based on your grades vs each saved university’s selectivity.</p>';
        else chBody = '<p class="hub__muted">Add your grades to see your real admission chances across your shortlist, with % odds per university.</p>';

        // Gradebook
        var gbBody = gi.has
            ? '<div class="hub__big">' + (gi.pct != null ? gi.pct + '<span>%</span>' : '—') + '</div><p class="hub__muted">' + gi.subjects + ' subject' + (gi.subjects === 1 ? '' : 's') + ' tracked · average grade</p>'
            : '<p class="hub__muted">You haven’t added anything yet. Upload a grades PDF or add subjects — then track your average, trend and readiness for your target unis.</p>';

        // Deadlines
        var dlBody = (di.overdue + di.soon + di.month + di.custom) > 0
            ? '<div class="hub__pills"><span class="hub__pill hub__pill--r">' + di.overdue + ' overdue</span><span class="hub__pill hub__pill--o">' + di.soon + ' this week</span><span class="hub__pill hub__pill--b">' + di.month + ' this month</span></div><p class="hub__muted">Deadlines gather your applications, scholarships & open days in one timeline.</p>'
            : '<p class="hub__muted">Deadlines keep every application, scholarship and open day in one place — add your first reminder so nothing slips.</p>';

        // Saved
        var svBody = sv.length ? '<div class="hub__big">' + sv.length + '<span>saved</span></div><p class="hub__muted">Your shortlist — compare them side by side any time.</p>'
            : '<p class="hub__muted">Bookmark universities in Explore to build your shortlist.</p>';

        return '<div class="hub__grid">' +
            square('sug',    'fa-wand-magic-sparkles', 'Suggested for you', sugBody, 'Browse Explore', 'data-go="explore"') +
            square('chance', 'fa-bullseye',            'Your chances',      chBody,  (ch ? 'See probability' : 'Check my chances'), 'data-go="cityguide"') +
            square('grade',  'fa-chart-line',          'Gradebook',         gbBody,  (gi.has ? 'Open Gradebook' : 'Add my grades'), 'data-go="gradebook"') +
            square('dl',     'fa-calendar-check',      'Deadlines',         dlBody,  'Open Deadlines', 'data-go="tracker"') +
            square('apply',  'fa-file-pen',            'Ready to apply?',   '<p class="hub__muted">When your shortlist is set, start and track your applications here — with a guided form per university.</p>', 'Go to Apply', 'data-go="compare"') +
            square('saved',  'fa-bookmark',            'Your shortlist',    svBody,  'Manage shortlist', 'data-go="explore"') +
        '</div>';
    }

    var el = null;
    function open() {
        var p = prof();
        el = document.createElement('div');
        el.className = 'hub__overlay';
        el.innerHTML =
            '<div class="hub__panel">' +
                '<button class="hub__close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="hub__head"><span class="hub__head__badge"><i class="fa-solid fa-grip"></i></span>' +
                    '<div><div class="hub__title">Your snapshot' + (p.name ? ', ' + esc(p.name) : '') + '</div>' +
                    '<div class="hub__sub">Everything that matters, in one place — tap any card to dive in.</div></div></div>' +
                buildSquares() +
            '</div>';
        document.body.appendChild(el);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(function () { el.classList.add('open'); });
        var sqs = el.querySelectorAll('.hub__sq');
        sqs.forEach(function (s, i) { s.style.animationDelay = (i * 55) + 'ms'; });

        el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
        el.querySelector('.hub__close').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        el.addEventListener('click', function (e) {
            var g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
            var u = e.target.closest('[data-uni]');
            if (u) { var uni = findUni(u.dataset.uni); close(); try { if (uni && window.showUniDetail) window.showUniDetail(uni); else if (window.showTab) window.showTab('explore'); } catch (er) {} }
        });
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { if (!el) return; document.removeEventListener('keydown', onKey); el.classList.remove('open'); document.body.style.overflow = ''; var e = el; setTimeout(function () { e.remove(); }, 300); el = null; }
    window.openHub = open;

    // ── Quick-actions bar on the Overview (Snapshot + Export plan) ──
    function injectBar() {
        var host = document.getElementById('tabOverview');
        if (!host || document.getElementById('hubBar')) return true;
        var bar = document.createElement('div');
        bar.id = 'hubBar';
        bar.className = 'hub__bar';
        bar.innerHTML =
            '<button class="hub__btn hub__btn--primary" id="hubOpenBtn"><i class="fa-solid fa-wand-magic-sparkles"></i> Your snapshot</button>' +
            '<button class="hub__btn hub__btn--ghost" id="hubExportBtn"><i class="fa-solid fa-file-arrow-down"></i> Export plan (PDF) <span class="hub__elite">Elite</span></button>';
        var gmf = document.getElementById('gmfWidget');
        var hero = host.querySelector('.mp__hero');
        var anchor = gmf || hero;
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling);
        else host.insertBefore(bar, host.firstChild);
        bar.querySelector('#hubOpenBtn').addEventListener('click', open);
        bar.querySelector('#hubExportBtn').addEventListener('click', function () {
            if (window.exportApplicationPlan) window.exportApplicationPlan();
        });
        return true;
    }
    // Settings buttons (added in the header dropdown).
    function wireSettings() {
        var redo = document.getElementById('mpdRedoSetup');
        if (redo && !redo.__w) { redo.__w = 1; redo.addEventListener('click', function () { if (window.openOnboarding) window.openOnboarding(); }); }
        var snap = document.getElementById('mpdOpenSnapshot');
        if (snap && !snap.__w) { snap.__w = 1; snap.addEventListener('click', open); }
    }
    function boot() {
        var tries = 0;
        (function attempt() { var ok = injectBar(); wireSettings(); if (!ok && tries++ < 20) setTimeout(attempt, 250); })();
    }
    if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
