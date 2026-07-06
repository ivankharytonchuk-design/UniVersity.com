/* ════════════════════════════════════════════════════════════════════
   Gamification — daily streak + achievement badges (Overview widget)
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
        if (!s || !s.last) s = { last: null, count: 0, best: 0 };
        var t = today();
        if (s.last !== t) {
            var gap = s.last ? daysBetween(s.last, t) : 999;
            s.count = (gap === 1) ? (s.count + 1) : 1;
            s.last = t;
            s.best = Math.max(s.best || 0, s.count);
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
                '<div class="gmf__streak">' +
                    '<div class="gmf__flame' + (st.count > 0 ? ' gmf__flame--lit' : '') + '"><i class="fa-solid fa-fire"></i></div>' +
                    '<div class="gmf__streak__meta">' +
                        '<div class="gmf__streak__num">' + st.count + '<span>day' + (st.count === 1 ? '' : 's') + '</span></div>' +
                        '<div class="gmf__streak__lbl">Daily streak</div>' +
                        '<div class="gmf__streak__best"><i class="fa-solid fa-trophy"></i> Best: ' + (st.best || st.count) + ' days</div>' +
                    '</div>' +
                '</div>' +
                '<div class="gmf__actions">' +
                    '<button class="gmf__act gmf__act--snap" id="gmfSnap"><span class="gmf__act__ic"><i class="fa-solid fa-wand-magic-sparkles"></i></span>' +
                        '<span class="gmf__act__tx"><b>Your snapshot</b><small>Progress &amp; your next step</small></span><i class="fa-solid fa-arrow-right gmf__act__go"></i></button>' +
                    '<button class="gmf__act gmf__act--career" id="gmfCareer"><span class="gmf__act__ic"><i class="fa-solid fa-briefcase"></i></span>' +
                        '<span class="gmf__act__tx"><b>Career paths</b><small>Top recruiters &amp; your odds</small></span><i class="fa-solid fa-arrow-right gmf__act__go"></i></button>' +
                '</div>' +
            '</div>';
        var snap = mount.querySelector('#gmfSnap'); if (snap) snap.addEventListener('click', function () { if (window.openHub) window.openHub(); });
        var car = mount.querySelector('#gmfCareer'); if (car) car.addEventListener('click', function () { if (window.openCareers) window.openCareers(); });
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
