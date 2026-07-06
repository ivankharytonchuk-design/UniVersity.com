/* ════════════════════════════════════════════════════════════════════
   Your Snapshot — a visual, low-text summary of the student's progress.
   Two modes: a welcoming "get started" version for brand-new users, and a
   data-dense progress dashboard once they've done things.
   Opens from a header button (big screens) / an Overview button (laptops),
   from Settings, and right after onboarding.
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
    function gcol(p) { return p >= 85 ? '#27ae60' : p >= 70 ? '#8dc63f' : p >= 55 ? '#f0a500' : p >= 40 ? '#e07020' : '#c0392b'; }

    function gb() { try { return JSON.parse(localStorage.getItem('us_gradebook_' + uid()) || 'null'); } catch (e) { return null; } }
    function gradeInfo() {
        var g = gb(); if (!g || !g.subjects || !g.subjects.length) return { has: false, subjects: 0 };
        var pct = (window.studentGradePercent && window.studentGradePercent());
        return { has: true, subjects: g.subjects.length, pct: pct == null ? null : Math.round(pct) };
    }
    function subjectBars() {
        var g = gb(); if (!g || !g.subjects) return [];
        var max = ({ pct: 100, p10: 10, p9: 9, p8: 8, p5: 5, gpa: 4 })[g.scale] || 100;
        return g.subjects.slice(0, 9).map(function (s) {
            var m = [].concat(s.sem1 || [], s.sem2 || []).filter(function (x) { return x != null && x !== '' && !isNaN(x); }).map(Number);
            var v = m.length ? m.reduce(function (a, b) { return a + b; }, 0) / m.length : (s.grade != null && s.grade !== '' ? +s.grade : null);
            var pct = v == null ? null : Math.max(10, Math.min(100, v / max * 100));
            return { pct: pct };
        });
    }
    function deadlineInfo() {
        var n = function (id) { var el = document.getElementById(id); return el ? (parseInt(el.textContent, 10) || 0) : 0; };
        var custom = []; try { custom = JSON.parse(localStorage.getItem('us_dl_cust_' + uid()) || '[]') || []; } catch (e) {}
        return { overdue: n('dlCntOverdue'), soon: n('dlCntSoon'), month: n('dlCntMonth'), done: n('dlCntDone'), custom: custom.length, list: custom };
    }
    function nextDeadline() {
        var di = deadlineInfo(); var today = new Date(); today.setHours(0, 0, 0, 0);
        var fut = (di.list || []).filter(function (d) { return d.date && new Date(d.date) >= today; }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
        if (!fut.length) return null;
        return { title: fut[0].title, days: Math.round((new Date(fut[0].date) - today) / 86400000) };
    }
    function chanceInfo() {
        if (!window.uniChanceInfo) return null;
        var g = window.studentGradePercent && window.studentGradePercent(); if (g == null) return null;
        var out = { safety: 0, match: 0, reach: 0 };
        saved().forEach(function (id) { var u = findUni(id); if (!u) return; var c = window.uniChanceInfo(u); if (c && out[c.cls] != null) out[c.cls]++; });
        return out;
    }
    function suggestions() {
        var subs = (prof().subjects || []).map(function (s) { return String(s).toLowerCase(); });
        var sv = saved();
        var list = (window.UNI || []).filter(function (u) { return sv.indexOf(u.id) === -1; });
        list.forEach(function (u) { var sc = 0; (u.fields || []).forEach(function (f) { var fl = String(f).toLowerCase(); if (subs.some(function (s) { return fl.indexOf(s) !== -1 || s.indexOf(fl) !== -1; })) sc += 3; }); if ((u.ts || 3) <= 2) sc += 1; u.__s = sc; });
        list.sort(function (a, b) { return (b.__s - a.__s) || (a.ts - b.ts); });
        return list.slice(0, 3);
    }
    function streakCount() { try { var s = JSON.parse(localStorage.getItem('us_streak_' + uid()) || 'null'); return s ? (s.count || 0) : 0; } catch (e) { return 0; } }
    function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }

    var FACTS = [
        'Applying to 5–8 universities balances ambition with safety.',
        'Applying early genuinely lifts your odds — many courses admit on a rolling basis.',
        'A focused personal statement beats a long one — show fit, not a list.',
        'An upward grade trend can impress admissions as much as the average.',
        'Scholarships go unclaimed every year — check each uni’s funding page.',
        'Tracking deadlines cuts missed applications to almost zero.',
        'Ask teachers for reference letters weeks ahead, not days.',
        'Living costs vary hugely by city — budget for more than tuition.',
        'A little progress each day beats a last-minute scramble.'
    ];
    function factOfDay() { var d = new Date(); return FACTS[Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000) % FACTS.length]; }

    function isNew() {
        var p = prof();
        return saved().length === 0 && !gradeInfo().has && deadlineInfo().custom === 0 && !(p.subjects && p.subjects.length);
    }
    function completeness() {
        var p = prof(), gi = gradeInfo(), di = deadlineInfo();
        var checks = [!!p.name, (p.subjects || []).length > 0, saved().length > 0, gi.has, di.custom > 0, (p.priorities || []).length > 0];
        var done = checks.filter(Boolean).length;
        return { pct: Math.round(done / checks.length * 100), done: done, total: checks.length };
    }
    function nextStep() {
        var p = prof(), gi = gradeInfo(), di = deadlineInfo();
        if (!p.name || !(p.subjects || []).length) return { t: 'Finish your 30-second setup.', cta: 'Set up', act: 'onboarding' };
        if (!saved().length) return { t: 'Save your first university.', cta: 'Explore', go: 'explore' };
        if (!gi.has) return { t: 'Add your grades to unlock chances.', cta: 'Gradebook', go: 'gradebook' };
        if (di.custom === 0) return { t: 'Add your key deadlines.', cta: 'Deadlines', go: 'tracker' };
        return { t: 'Foundations set — start an application.', cta: 'Apply', go: 'compare' };
    }

    // ── Square builder ──
    function sq(cls, accent, icon, title, badge, bodyHTML, goTo) {
        return '<button class="hub__sq" style="--a:' + accent + '" ' + (goTo ? 'data-go="' + goTo + '"' : '') + '>' +
            '<div class="hub__sq__hd"><span class="hub__sq__ic"><i class="fa-solid ' + icon + '"></i></span>' +
                '<span class="hub__sq__t">' + title + '</span>' + (badge ? '<span class="hub__sq__badge">' + badge + '</span>' : '') +
                '<i class="fa-solid fa-arrow-right hub__sq__go"></i></div>' +
            '<div class="hub__sq__body">' + bodyHTML + '</div>' +
        '</button>';
    }

    function progressSquares() {
        var sv = saved(), gi = gradeInfo(), di = deadlineInfo(), ch = chanceInfo(), nd = nextDeadline();

        // Shortlist
        var chips = sv.slice(0, 6).map(function (id) { var u = findUni(id); return '<span class="hub__chip" style="background:' + ((u && u.color) || '#d97c14') + '">' + esc(((u && (u.abbr || u.name)) || '?').toUpperCase().slice(0, 3)) + '</span>'; }).join('');
        var shortlist = sq('sl', '#d97c14', 'fa-bookmark', 'Shortlist', sv.length ? null : 'empty', sv.length
            ? '<div class="hub__num">' + sv.length + '<small>saved</small></div><div class="hub__chips">' + chips + (sv.length > 6 ? '<span class="hub__chip hub__chip--more">+' + (sv.length - 6) + '</span>' : '') + '</div>'
            : '<div class="hub__empty2"><i class="fa-regular fa-bookmark"></i> Save unis in Explore</div>', 'explore');

        // Grades
        var bars = subjectBars();
        var grades = sq('gr', '#2ecc71', 'fa-chart-line', 'Grades', gi.has ? gi.subjects + ' subj' : null, gi.has
            ? '<div class="hub__num" style="color:' + (gi.pct != null ? gcol(gi.pct) : 'inherit') + '">' + (gi.pct != null ? gi.pct : '—') + '<small>avg</small></div>' +
              '<div class="hub__bars">' + bars.map(function (b) { return '<span class="hub__bar" style="height:' + (b.pct == null ? 12 : b.pct) + '%;--bc:' + (b.pct == null ? '#ccc' : gcol(b.pct)) + '"></span>'; }).join('') + '</div>'
            : '<div class="hub__empty2"><i class="fa-solid fa-file-arrow-up"></i> Add grades to track your average</div>', 'gradebook');

        // Chances
        var chances;
        if (ch) {
            var tot = ch.safety + ch.match + ch.reach || 1;
            chances = '<div class="hub__seg">' +
                '<span style="width:' + (ch.safety / tot * 100) + '%;background:#2ecc71"></span>' +
                '<span style="width:' + (ch.match / tot * 100) + '%;background:#4aa3ff"></span>' +
                '<span style="width:' + (ch.reach / tot * 100) + '%;background:#ff9f43"></span></div>' +
                '<div class="hub__legend"><span><b style="color:#2ecc71">' + ch.safety + '</b> Safe</span><span><b style="color:#4aa3ff">' + ch.match + '</b> Match</span><span><b style="color:#ff9f43">' + ch.reach + '</b> Reach</span></div>';
        } else chances = '<div class="hub__empty2"><i class="fa-solid fa-bullseye"></i> Add grades to see your odds</div>';
        var chancesSq = sq('ch', '#4aa3ff', 'fa-bullseye', 'Chances', null, chances, 'cityguide');

        // Deadlines
        var dl = nd
            ? '<div class="hub__dl"><span class="hub__dl__days' + (nd.days <= 7 ? ' urgent' : '') + '">' + nd.days + '<small>d</small></span><span class="hub__dl__t">' + esc(nd.title) + '</span></div>' +
              '<div class="hub__legend"><span><b>' + di.overdue + '</b> overdue</span><span><b>' + di.soon + '</b> week</span><span><b>' + di.done + '</b> done</span></div>'
            : '<div class="hub__empty2"><i class="fa-regular fa-calendar-plus"></i> Add a deadline reminder</div>';
        var deadlines = sq('dl', '#ff5a4d', 'fa-calendar-check', 'Deadlines', di.overdue ? di.overdue + ' overdue' : null, dl, 'tracker');

        return '<div class="hub__grid">' + shortlist + grades + chancesSq + deadlines + '</div>';
    }

    function journeyHTML() {
        var gi = gradeInfo(), di = deadlineInfo();
        var steps = [
            { l: 'Research', i: 'fa-compass', done: true },
            { l: 'Shortlist', i: 'fa-bookmark', done: saved().length > 0 },
            { l: 'Grades', i: 'fa-chart-line', done: gi.has },
            { l: 'Deadlines', i: 'fa-calendar-check', done: di.custom > 0 },
            { l: 'Apply', i: 'fa-file-pen', done: false }
        ];
        var cur = steps.findIndex(function (s) { return !s.done; }); if (cur < 0) cur = steps.length - 1;
        return '<div class="hub__journey">' + steps.map(function (s, i) {
            var st = s.done ? 'done' : (i === cur ? 'cur' : 'todo');
            return '<div class="hub__jstep hub__jstep--' + st + '"><span class="hub__jdot"><i class="fa-solid ' + (s.done ? 'fa-check' : s.i) + '"></i></span><span class="hub__jl">' + s.l + '</span></div>';
        }).join('<span class="hub__jline"></span>') + '</div>';
    }

    // ── New-user welcome squares ──
    function startSquares() {
        var cards = [
            { a: '#d97c14', i: 'fa-compass', t: 'Explore', d: 'Find universities worldwide', go: 'explore' },
            { a: '#6c63ff', i: 'fa-wand-magic-sparkles', t: 'Set up', d: 'Tailor the app to you', act: 'onboarding' },
            { a: '#2ecc71', i: 'fa-chart-line', t: 'Grades', d: 'Track your average & chances', go: 'gradebook' },
            { a: '#ff5a4d', i: 'fa-calendar-check', t: 'Deadlines', d: 'Never miss an application', go: 'tracker' }
        ];
        return '<div class="hub__grid hub__grid--start">' + cards.map(function (c) {
            return '<button class="hub__start" style="--a:' + c.a + '" ' + (c.act ? 'data-act="' + c.act + '"' : 'data-go="' + c.go + '"') + '>' +
                '<span class="hub__start__ic"><i class="fa-solid ' + c.i + '"></i></span>' +
                '<span class="hub__start__t">' + c.t + '</span><span class="hub__start__d">' + c.d + '</span>' +
                '<span class="hub__start__go"><i class="fa-solid fa-arrow-right"></i></span></button>';
        }).join('') + '</div>';
    }

    var el = null;
    function open() {
        var p = prof(), newUser = isNew();
        el = document.createElement('div');
        el.className = 'hub__overlay';
        var body;
        if (newUser) {
            body = '<div class="hub__welcome"><div class="hub__welcome__emoji">🚀</div>' +
                '<div class="hub__title">Welcome' + (p.name ? ', ' + esc(p.name) : '') + '!</div>' +
                '<div class="hub__sub">Let’s find your future university. Start anywhere:</div></div>' +
                startSquares() +
                '<div class="hub__tip"><span class="hub__tip__ic"><i class="fa-solid fa-lightbulb"></i></span><div>' + factOfDay() + '</div></div>';
        } else {
            var comp = completeness(), ns = nextStep();
            body =
                '<div class="hub__hero"><div class="hub__hero__main"><span class="hub__head__badge"><i class="fa-solid fa-grip"></i></span>' +
                    '<div><div class="hub__title">' + greeting() + (p.name ? ', ' + esc(p.name) : '') + '</div>' +
                    '<div class="hub__sub">Your progress at a glance.</div></div></div>' +
                    '<div class="hub__prog"><div class="hub__prog__top"><span>' + comp.pct + '% set up</span><span>' + comp.done + '/' + comp.total + '</span></div>' +
                    '<div class="hub__prog__bar"><i style="width:' + comp.pct + '%"></i></div></div></div>' +
                '<div class="hub__kpis">' +
                    kpi('fa-bookmark', saved().length, 'Saved', '#d97c14') +
                    kpi('fa-chart-line', gradeInfo().pct != null ? gradeInfo().pct + '%' : '—', 'Average', '#2ecc71') +
                    kpi('fa-calendar-check', deadlineInfo().overdue + deadlineInfo().soon, 'Due soon', '#ff9f43') +
                    kpi('fa-fire', streakCount(), 'Streak', '#ff5a4d') +
                '</div>' +
                journeyHTML() +
                progressSquares() +
                '<div class="hub__foot"><div class="hub__tip"><span class="hub__tip__ic"><i class="fa-solid fa-lightbulb"></i></span><div>' + factOfDay() + '</div></div>' +
                    '<button class="hub__next__cta" ' + (ns.act ? 'data-act="' + ns.act + '"' : 'data-go="' + ns.go + '"') + '><b>Next:</b> ' + ns.cta + ' <i class="fa-solid fa-arrow-right"></i></button></div>';
        }
        el.innerHTML = '<div class="hub__panel hub__panel--full">' +
            '<button class="hub__close" title="Close"><i class="fa-solid fa-xmark"></i></button>' + body + '</div>';
        document.body.appendChild(el);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(function () { el.classList.add('open'); });
        el.querySelectorAll('.hub__sq, .hub__start').forEach(function (s, i) { s.style.animationDelay = (i * 55) + 'ms'; });

        el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
        el.querySelector('.hub__close').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        el.addEventListener('click', function (e) {
            var a = e.target.closest('[data-act]'); if (a) { close(); if (a.dataset.act === 'onboarding' && window.openOnboarding) setTimeout(window.openOnboarding, 200); return; }
            var g = e.target.closest('[data-go]'); if (g) { go(g.dataset.go); return; }
        });
    }
    function kpi(ic, val, lbl, c) { return '<div class="hub__kpi"><span class="hub__kpi__ic" style="color:' + c + ';background:' + c + '1f"><i class="fa-solid ' + ic + '"></i></span><div><div class="hub__kpi__v">' + val + '</div><div class="hub__kpi__l">' + lbl + '</div></div></div>'; }
    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() { if (!el) return; document.removeEventListener('keydown', onKey); el.classList.remove('open'); document.body.style.overflow = ''; var e = el; setTimeout(function () { e.remove(); }, 300); el = null; }
    window.openHub = open;

    // ── Buttons: header (big screens) + Overview (laptops) ──
    function headerBtn() {
        if (document.getElementById('hubHdrBtn')) return true;
        var right = document.querySelector('.mp__header__right'); if (!right) return false;
        var b = document.createElement('button');
        b.id = 'hubHdrBtn'; b.className = 'hub__hdr__btn'; b.title = 'Your snapshot';
        b.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Snapshot</span>';
        b.addEventListener('click', open);
        right.insertBefore(b, right.firstChild);
        return true;
    }
    function overviewBtn() {
        var host = document.getElementById('tabOverview'); if (!host || document.getElementById('hubBar')) return !!host;
        var bar = document.createElement('div'); bar.id = 'hubBar'; bar.className = 'hub__bar';
        bar.innerHTML = '<button class="hub__btn hub__btn--primary" id="hubOpenBtn"><i class="fa-solid fa-wand-magic-sparkles"></i> Your snapshot</button>';
        var gmf = document.getElementById('gmfWidget'), hero = host.querySelector('.mp__hero'), anchor = gmf || hero;
        if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(bar, anchor.nextSibling); else host.insertBefore(bar, host.firstChild);
        bar.querySelector('#hubOpenBtn').addEventListener('click', open);
        return true;
    }
    function wireSettings() {
        var r = document.getElementById('mpdRedoSetup'); if (r && !r.__w) { r.__w = 1; r.addEventListener('click', function () { if (window.openOnboarding) window.openOnboarding(); }); }
        var s = document.getElementById('mpdOpenSnapshot'); if (s && !s.__w) { s.__w = 1; s.addEventListener('click', open); }
    }
    function boot() { var t = 0; (function a() { var ok = overviewBtn() & headerBtn(); wireSettings(); if (!ok && t++ < 20) setTimeout(a, 250); })(); }
    if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
