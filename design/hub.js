/* ════════════════════════════════════════════════════════════════════
   Your Snapshot — a simple, useful "where am I & what's next" modal.
   One clear next step + a scannable list of your areas with live status;
   tap any row to jump straight there.
   Buttons: header pill (big screens) / in-Overview button (laptops), Settings,
   and it opens after onboarding. Remove hub.js/.css includes to undo.
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
        var g; try { g = JSON.parse(localStorage.getItem('us_gradebook_' + uid()) || 'null'); } catch (e) { g = null; }
        if (!g || !g.subjects || !g.subjects.length) return { has: false, subjects: 0 };
        var pct = (window.studentGradePercent && window.studentGradePercent());
        return { has: true, subjects: g.subjects.length, pct: pct == null ? null : Math.round(pct) };
    }
    function deadlineInfo() {
        var custom = []; try { custom = JSON.parse(localStorage.getItem('us_dl_cust_' + uid()) || '[]') || []; } catch (e) {}
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var fut = custom.filter(function (d) { return d.date && new Date(d.date) >= today; }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
        var next = fut.length ? { title: fut[0].title, days: Math.round((new Date(fut[0].date) - today) / 86400000) } : null;
        return { count: custom.length, next: next };
    }
    function chanceInfo() {
        if (!window.uniChanceInfo) return null;
        var g = window.studentGradePercent && window.studentGradePercent(); if (g == null) return null;
        var o = { safety: 0, match: 0, reach: 0 };
        saved().forEach(function (id) { var u = findUni(id); if (!u) return; var c = window.uniChanceInfo(u); if (c && o[c.cls] != null) o[c.cls]++; });
        return o;
    }
    function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

    var FACTS = [
        'Applying to 5–8 universities balances ambition with safety.',
        'Applying early genuinely lifts your odds.',
        'A focused personal statement beats a long one.',
        'Scholarships go unclaimed every year — always check funding pages.',
        'Ask teachers for reference letters weeks ahead, not days.',
        'A little progress each day beats a last-minute scramble.'
    ];
    function factOfDay() { var d = new Date(); return FACTS[Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000) % FACTS.length]; }

    function nextStep() {
        var p = prof(), gi = gradeInfo(), di = deadlineInfo();
        if (!p.name || !(p.subjects || []).length) return { t: 'Finish your 30-second setup', ic: 'fa-wand-magic-sparkles', cta: 'Set up', act: 'onboarding' };
        if (!saved().length) return { t: 'Save your first university', ic: 'fa-compass', cta: 'Explore', go: 'explore' };
        if (!gi.has) return { t: 'Add your grades to see your chances', ic: 'fa-chart-line', cta: 'Gradebook', go: 'gradebook' };
        if (di.count === 0) return { t: 'Add your key application deadlines', ic: 'fa-calendar-plus', cta: 'Deadlines', go: 'tracker' };
        return { t: 'You’re set up — start an application', ic: 'fa-file-pen', cta: 'Apply', go: 'compare' };
    }

    function row(icon, accent, label, status, muted, goTo) {
        return '<button class="hub__row" style="--a:' + accent + '" data-go="' + goTo + '">' +
            '<span class="hub__row__ic"><i class="fa-solid ' + icon + '"></i></span>' +
            '<span class="hub__row__main"><span class="hub__row__lbl">' + label + '</span>' +
                '<span class="hub__row__st' + (muted ? ' muted' : '') + '">' + status + '</span></span>' +
            '<i class="fa-solid fa-chevron-right hub__row__go"></i></button>';
    }

    function rowsHTML() {
        var sv = saved(), gi = gradeInfo(), di = deadlineInfo(), ch = chanceInfo();
        // Shortlist
        var slStat = sv.length ? '<b>' + sv.length + '</b> ' + (sv.length === 1 ? 'university' : 'universities') : 'None saved yet';
        // Grades
        var grStat = gi.has ? '<b>' + (gi.pct != null ? gi.pct + '%' : '—') + '</b> average · ' + gi.subjects + ' subject' + (gi.subjects === 1 ? '' : 's') : 'Not added yet';
        // Chances
        var chStat, chMuted = false;
        if (ch) chStat = '<b>' + ch.safety + '</b> safe · <b>' + ch.match + '</b> match · <b>' + ch.reach + '</b> reach';
        else { chStat = 'Add grades to unlock'; chMuted = true; }
        // Deadlines
        var dlStat, dlMuted = false;
        if (di.next) dlStat = 'Next: ' + esc(di.next.title) + ' · <b>' + di.next.days + 'd</b>';
        else if (di.count) dlStat = '<b>' + di.count + '</b> tracked';
        else { dlStat = 'None yet'; dlMuted = true; }
        return '<div class="hub__list">' +
            row('fa-bookmark', '#d97c14', 'Shortlist', slStat, !sv.length, 'explore') +
            row('fa-chart-line', '#2ecc71', 'Grades', grStat, !gi.has, 'gradebook') +
            row('fa-bullseye', '#4aa3ff', 'Your chances', chStat, chMuted, 'cityguide') +
            row('fa-calendar-check', '#ff5a4d', 'Deadlines', dlStat, dlMuted, 'tracker') +
        '</div>';
    }

    var el = null;
    function open() {
        var p = prof(), ns = nextStep();
        el = document.createElement('div');
        el.className = 'hub__overlay';
        el.innerHTML =
            '<div class="hub__panel">' +
                '<button class="hub__close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="hub__top"><div class="hub__title">' + greeting() + (p.name ? ', ' + esc(p.name) : '') + '</div>' +
                    '<div class="hub__sub">Where you are — and the best thing to do next.</div></div>' +
                '<button class="hub__next" ' + (ns.act ? 'data-act="' + ns.act + '"' : 'data-go="' + ns.go + '"') + '>' +
                    '<span class="hub__next__ic"><i class="fa-solid ' + ns.ic + '"></i></span>' +
                    '<span class="hub__next__tx"><small>Next step</small><b>' + ns.t + '</b></span>' +
                    '<span class="hub__next__cta">' + ns.cta + ' <i class="fa-solid fa-arrow-right"></i></span>' +
                '</button>' +
                rowsHTML() +
                '<div class="hub__tipline"><i class="fa-solid fa-lightbulb"></i> ' + factOfDay() + '</div>' +
            '</div>';
        document.body.appendChild(el);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(function () { el.classList.add('open'); });
        el.querySelectorAll('.hub__row').forEach(function (r, i) { r.style.animationDelay = (i * 45) + 'ms'; });

        el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
        el.querySelector('.hub__close').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        el.addEventListener('click', function (e) {
            var a = e.target.closest('[data-act]'); if (a) { close(); if (a.dataset.act === 'onboarding' && window.openOnboarding) setTimeout(window.openOnboarding, 200); return; }
            var g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); }
        });
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { if (!el) return; document.removeEventListener('keydown', onKey); el.classList.remove('open'); document.body.style.overflow = ''; var e = el; setTimeout(function () { e.remove(); }, 260); el = null; }
    window.openHub = open;

    // The launcher lives in the Overview gamification section (gamification.js) and
    // in Settings — no header/Overview button of our own any more.
    function wireSettings() {
        var r = document.getElementById('mpdRedoSetup'); if (r && !r.__w) { r.__w = 1; r.addEventListener('click', function () { if (window.openOnboarding) window.openOnboarding(); }); }
        var s = document.getElementById('mpdOpenSnapshot'); if (s && !s.__w) { s.__w = 1; s.addEventListener('click', open); }
    }
    function boot() { var t = 0; (function a() { wireSettings(); if ((!document.getElementById('mpdOpenSnapshot')) && t++ < 20) setTimeout(a, 250); })(); }
    if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
