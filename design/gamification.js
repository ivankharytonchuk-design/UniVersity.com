/* ════════════════════════════════════════════════════════════════════
   Gamification — daily streak + saved scholarships + saved career odds (Overview widget)
   Self-contained: remove gamification.js/.css includes to undo.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    function uid() { try { return (window.user && window.user.id) || 'guest'; } catch (e) { return 'guest'; } }
    function K(base) { return base + '_' + uid(); }
    function today() { return new Date().toISOString().slice(0, 10); }
    function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }
    function arrLen(key) { try { var a = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(a) ? a.length : 0; } catch (e) { return 0; } }

    // ── Streak ──
    function streak() {
        var s;
        try { s = JSON.parse(localStorage.getItem(K('us_streak')) || 'null'); } catch (e) { s = null; }
        if (!s || typeof s !== 'object') s = { last: null, count: 0, best: 0 };
        s.count = s.count || 0;
        s.best  = s.best || 0;
        var t = today();
        if (s.last !== t) {
            var gap = s.last ? daysBetween(s.last, t) : 999;
            if (gap === 1)      s.count = s.count + 1;   // consecutive day → extend
            else if (gap <= 0)  { /* clock skew / already-counted: keep count, don't rewind `last` */ }
            else                s.count = 1;             // a full day (or more) missed → restart at today
            // Never move `last` backwards (guards against a stale/future value).
            if (gap > 0 || !s.last) s.last = t;
            if (s.count < 1) s.count = 1;
            s.best = Math.max(s.best, s.count);
            try { localStorage.setItem(K('us_streak'), JSON.stringify(s)); } catch (e) {}
        }
        return s;
    }

    // ── Badges ──
    function gbSubjects() { try { var g = JSON.parse(localStorage.getItem(K('us_gradebook')) || 'null'); return (g && g.subjects) ? g.subjects.length : 0; } catch (e) { return 0; } }
    function aiUsed() { return (parseInt(localStorage.getItem(K('us_ai_prompts')) || '0', 10) || 0) > 0; }

    function badges(st) {
        var saved = arrLen(K('us_saved'));
        var subs = gbSubjects();
        var deadlines = arrLen(K('us_dl_cust'));
        var countries = arrLen(K('us_fav_countries'));
        return [
            { id: 'firstsave', icon: 'fa-bookmark',        name: 'First Save',    hint: 'Save your first university',           got: saved >= 1 },
            { id: 'shortlist', icon: 'fa-layer-group',     name: 'Shortlister',   hint: 'Save 5 universities',                  got: saved >= 5 },
            { id: 'scholar',   icon: 'fa-graduation-cap',  name: 'Scholar',       hint: 'Add grades in the Gradebook',          got: subs >= 1 },
            { id: 'planner',   icon: 'fa-calendar-check',  name: 'Planner',       hint: 'Add your first deadline',              got: deadlines >= 1 },
            { id: 'curious',   icon: 'fa-robot',           name: 'Curious Mind',  hint: 'Ask the AI a question',                got: aiUsed() },
            { id: 'globe',     icon: 'fa-earth-europe',    name: 'Globetrotter',  hint: 'Save a country you love',              got: countries >= 1 },
            { id: 'week',      icon: 'fa-fire',            name: 'On a Roll',     hint: 'Reach a 7-day streak',                 got: (st.best || st.count) >= 7 },
            { id: 'month',     icon: 'fa-crown',           name: 'Devoted',       hint: 'Reach a 30-day streak',                got: (st.best || st.count) >= 30 }
        ];
    }

    // The streak card: a layered flame (it grows with the streak), embers, and the last seven days
    function streakHTML(st) {
        var n = st.count || 0, best = Math.max(st.best || 0, n), days = [], d0 = new Date();
        var W = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        for (var i = 6; i >= 0; i--) { var d = new Date(d0); d.setDate(d0.getDate() - i); days.push({ l: W[d.getDay()], on: i < n, today: i === 0 }); }
        var next = [3, 7, 14, 30, 60, 100].filter(function (x) { return x > n; })[0];
        var heat = Math.min(1, n / 14);
        return '<div class="gmf__streak gst' + (n >= 7 ? ' is-hot' : '') + '" style="--heat:' + heat.toFixed(2) + '" title="Come back every day to keep it alive">' +
            '<div class="gst__fire" aria-hidden="true">' +
                '<span class="gst__glow"></span>' +
                '<span class="gst__f gst__f--1"></span><span class="gst__f gst__f--2"></span><span class="gst__f gst__f--3"></span>' +
                '<span class="gst__em" style="--x:-7px;--d:0s"></span><span class="gst__em" style="--x:6px;--d:.7s"></span><span class="gst__em" style="--x:0px;--d:1.4s"></span>' +
            '</div>' +
            '<div class="gst__meta">' +
                '<div class="gst__num"><b>' + n + '</b><span>day' + (n === 1 ? '' : 's') + ' in a row</span></div>' +
                '<ol class="gst__week">' + days.map(function (x, k) { return '<li class="' + (x.on ? 'on' : '') + (x.today ? ' today' : '') + '" style="--k:' + k + '"><i></i><small>' + x.l + '</small></li>'; }).join('') + '</ol>' +
                '<div class="gst__best"><i class="fa-solid fa-trophy"></i> Best ' + best + (next ? ' · next goal ' + next : '') + '</div>' +
            '</div></div>';
    }

    function render() {
        var host = document.getElementById('tabOverview');
        if (!host) return;
        var st = streak();
        var bs = badges(st);
        var earned = bs.filter(function (b) { return b.got; }).length;

        var mount = document.getElementById('gmfWidget');
        if (!mount) {
            mount = document.createElement('section');
            mount.className = 'mp__section gmf';
            mount.id = 'gmfWidget';
            var hero = host.querySelector('.mp__hero');
            if (hero && hero.parentNode) hero.parentNode.insertBefore(mount, hero.nextSibling);
            else host.insertBefore(mount, host.firstChild);
        }
        mount.innerHTML =
            '<div class="gmf__grid">' +
                streakHTML(st) +
                '<div class="gmf__actions">' +
                    // Saved scholarships — filled by scholarships.js (renderSavedScholarships)
                    '<section class="gmf-sch" id="gmfSch" aria-label="Saved scholarships"></section>' +
                    // Saved companies + your odds — filled by careerOdds.js (renderSavedCareers)
                    '<section class="gmf-car" id="gmfCar" aria-label="Career paths"></section>' +
                '</div>' +
            '</div>';
        if (window.renderSavedScholarships) window.renderSavedScholarships(mount.querySelector('#gmfSch'));
        if (window.renderSavedCareers) window.renderSavedCareers(mount.querySelector('#gmfCar'));
    }

    window.renderGamification = render;
    function boot() { if (document.getElementById('tabOverview')) render(); }
    if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
    // Re-check when the user returns or switches back to the overview.
    window.addEventListener('focus', function () { try { render(); } catch (e) {} });
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-tab="overview"],[data-goto="overview"]')) setTimeout(render, 60);
    });
})();
