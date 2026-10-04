/* ════════════════════════════════════════════════════════════════════
   Deadlines (tabTracker) — a quiet planner for every date that matters on
   the way to university.

     • header: today's date, a one-line summary, four counts, and a "next up"
       ticket with a live countdown
     • a ruler of the next 100 days with a dot for every date
     • List (grouped by month) or Calendar; type tabs, search, and the
       Hide expired / Next 100 days / Saved unis switches (remembered)
     • tick the circle to mark a date done; click a row to open its details:
       what the date is for, what to have ready, a suggested plan with real
       dates, scholarship facts, calendar export, pin, reminder, delete
     • deadlines of saved scholarships are added automatically

   It replaces mainPage.js's global renderDeadlines(), so every existing
   caller (tab switch, add-date modal, the 60 s refresh) renders this page.
   Storage helpers (DEADLINES, getDlDone, getDlCustom, …) stay in mainPage.js.
   Hover never moves anything; the only motion is short fades and the sheet
   sliding in, all switched off under prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var root = document.getElementById('tabTracker');
    if (!root || typeof DEADLINES === 'undefined') return;

    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var UID = (window.user && window.user.id) || 'guest';
    var PREF_KEY = 'us_dlx_prefs_' + UID;
    var SCH_KEY = 'us_sch_saved_' + UID;
    var DAY = 864e5;
    var WINDOW_DAYS = 100;
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var WDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var WDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var TYPES = {
        application:   { label: 'Application',   color: '#e2553b' },
        scholarship:   { label: 'Scholarship',   color: '#1f8a5b' },
        openday:       { label: 'Open day',      color: '#2f6bd8' },
        accommodation: { label: 'Housing',       color: '#a8578a' },
        interview:     { label: 'Interview',     color: '#c9861a' },
        other:         { label: 'Reminder',      color: '#5d67b8' }
    };
    var TABS = [['all', 'All'], ['application', 'Applications'], ['scholarship', 'Scholarships'], ['openday', 'Open days'],
        ['accommodation', 'Housing'], ['interview', 'Interviews'], ['personal', 'My reminders']];
    var TOGGLES = [['hidePast', 'Hide expired'], ['within100', 'Next 100 days'], ['savedOnly', 'Saved unis only']];

    /* ── What a date is for ─────────────────────────────────────────
       General guidance by type, plus notes for well-known systems picked up
       from the title. Worded as guidance ("usually"), never as a promise. */
    var ABOUT = {
        application: 'The last day to send your application. Portals usually close at a set time on the day, often in the university\u2019s own time zone, and late applications are rarely considered.',
        scholarship: 'The closing date for this funding. If you miss it you normally wait a whole year for the next round, so treat it like an application deadline.',
        openday: 'A day to see the campus, go to taster talks and ask current students what it\u2019s really like. Many universities ask you to book a place first.',
        accommodation: 'The date to apply for university housing. Rooms tend to go to people who apply early, and some halls give priority to first-years and international students.',
        interview: 'An admissions interview. It\u2019s mostly about how you think through a problem and why you want the course, not about memorised facts.',
        other: 'A date you added yourself.'
    };
    var GRAD = /\b(post)?graduate\b|master|ph\.?d|doctoral/i;
    var KEYWORDS = [
        [/\bucas\b/i, 'UCAS is the UK\u2019s central admissions service: one application, up to five course choices, one personal statement and one reference. Oxford, Cambridge and most medicine, dentistry and veterinary courses close earlier, in mid-October.'],
        [/erasmus/i, 'Erasmus+ is the EU exchange programme. You apply through your home university\u2019s international office, not directly to the host university.'],
        [/pre-?enrol|preinscrip/i, 'Pre-enrolment is how Spanish public universities collect requests for places. Places are then given out by admission grade, so list your choices in order of preference.'],
        [/winter semester|wintersemester/i, 'Most German programmes start in October (the winter semester). Many ask international applicants to go through uni-assist first, which can take several weeks.'],
        [GRAD, 'This one is for master\u2019s or doctoral study. Expect to need a CV, a statement of purpose, transcripts and usually two or three academic references.']
    ];
    var OPENS = /\bopens?\b|applications open/i;
    var READY = {
        application: ['Passport or ID', 'Transcripts and certificates, translated if they\u2019re not in the course language', 'Personal statement or motivation letter', 'References \u2014 ask your referees early', 'Language test results (IELTS, TOEFL\u2026) if you need them', 'The application fee, if there is one'],
        graduate: ['CV', 'Statement of purpose', 'Research proposal, for PhDs'],
        scholarship: ['Proof you\u2019ve applied to (or been admitted by) the university', 'The scholarship essay or statement', 'References', 'Financial documents, if it\u2019s need-based'],
        openday: ['Your booking confirmation', 'Travel plan and times', 'A short list of questions for students and staff'],
        accommodation: ['Your offer or admission letter', 'Passport or ID', 'Money for the deposit', 'Guarantor details, if the halls ask for them'],
        interview: ['Your personal statement \u2014 re-read it', 'Two or three questions to ask them', 'The start time in your own time zone', 'For online interviews: a tested camera, mic and connection'],
        other: []
    };
    var PLAN = {
        application: [[-42, 'Check entry requirements and shortlist courses'], [-28, 'Write the first draft of your statement'], [-21, 'Ask your referees'], [-7, 'Proofread and fill in the form'], [-2, 'Submit \u2014 leave a buffer for portal problems']],
        scholarship: [[-42, 'Check you\u2019re eligible'], [-28, 'Draft the essays'], [-21, 'Ask for references'], [-7, 'Final read-through'], [-2, 'Submit']],
        interview: [[-14, 'Re-read your statement and the course page'], [-7, 'Do a mock interview with someone'], [-1, 'Check the time, link or address, and your documents']],
        openday: [[-14, 'Book a place if it asks you to'], [-5, 'Plan travel and write your questions']],
        accommodation: [[-28, 'Compare halls, prices and contracts'], [-14, 'Get the deposit and documents ready'], [-3, 'Apply']],
        opens: [[-7, 'Get your documents together'], [0, 'Applications open \u2014 start early']],
        other: [[-7, 'One week to go'], [-1, 'Tomorrow']]
    };

    /* ── Utilities ─────────────────────────────────────────────────── */
    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function lsJSON(k, d) { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function call(fn, dflt) { try { return typeof fn === 'function' ? fn() : dflt; } catch (e) { return dflt; } }
    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
    function parseDay(iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function isoDay(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function today0() { var t = new Date(); t.setHours(0, 0, 0, 0); return t; }
    function addDays(iso, n) { var d = parseDay(iso); d.setDate(d.getDate() + n); return d; }
    function dayDiff(iso) { return Math.round((parseDay(iso) - today0()) / DAY); }
    function when(d) {
        if (d < -1) return -d + ' days ago';
        if (d === -1) return 'Yesterday';
        if (d === 0) return 'Today';
        if (d === 1) return 'Tomorrow';
        if (d <= 13) return 'in ' + d + ' days';
        if (d <= 59) return 'in ' + Math.round(d / 7) + ' weeks';
        return 'in ' + Math.round(d / 30.4) + ' months';
    }
    function tone(it) { return it.done ? 'done' : it.days < 0 ? 'over' : it.days <= 7 ? 'hot' : it.days <= 30 ? 'warm' : 'calm'; }
    function typeOf(t) { return TYPES[t] || TYPES.other; }
    function shortDate(d) { return WDAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()]; }
    function fullDate(iso) { var d = parseDay(iso); return WDAYS_LONG[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear(); }
    function initials(t) { var w = String(t || '').replace(/[^A-Za-zÀ-ÿ ]/g, ' ').split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[1][0] : (w[0] || '\u2605').slice(0, 2)).toUpperCase(); }
    function shortUni(n) { return String(n || '').replace(/^(University of|Universidad de|Univ\.|Universit[àa] (di|degli))\s*/i, ''); }
    function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many || one + 's'); }

    /* ── Preferences (remembered) ──────────────────────────────────── */
    var P = (function () {
        var d = { view: 'timeline', cat: 'all', hidePast: true, within100: true, savedOnly: false };
        var s = lsJSON(PREF_KEY, {});
        for (var k in d) if (s[k] !== undefined) d[k] = s[k];
        return d;
    })();
    var query = '';
    function saveP() { lsSet(PREF_KEY, P); }

    /* ── Data: built-in (current destination) + custom + saved scholarships ── */
    function schRecord(x) { var S = window.ScholarshipSource; return S && S.lookup ? call(function () { return S.lookup(x.key, x.id); }, null) : null; }
    function scholarshipItems() {
        var out = [];
        lsJSON(SCH_KEY, []).forEach(function (x) {
            var s = schRecord(x), dl = s && s.when && s.when.deadlines;
            if (!dl || !dl.length) return;
            dl.forEach(function (d) {
                out.push({
                    id: 'sch_' + s.id + '_' + d.date, title: s.name + (dl.length > 1 ? ' \u2014 ' + d.label : ''), date: d.date, type: 'scholarship',
                    uniName: x.uni && x.uni.name, uniAbbr: x.uni && x.uni.abbr, uniColor: x.uni && x.uni.color, uniWebsite: x.uni && x.uni.website,
                    notes: dl.length > 1 ? null : d.label, link: s.url || null, source: 'scholarship', cycle: s.when.cycle || null, sch: { key: x.key, id: x.id }
                });
            });
        });
        return out;
    }
    window.dtScholarshipDeadlines = scholarshipItems;   // also used by the Overview "Next deadline" widget

    function collect() {
        var done = call(getDlDone, []), rem = call(getDlReminded, []), pin = call(getDlPin, null), saved = call(getSaved, []) || [];
        var cc = typeof currentCountryCode !== 'undefined' ? currentCountryCode : '';
        var out = [], seen = {};
        function add(it) {
            var k = norm(it.uniName) + '|' + it.date + '|' + it.type;
            if (it.uniName && seen[k]) return;   // same uni, same day, same kind → one entry
            seen[k] = 1; out.push(it);
        }
        scholarshipItems().forEach(add);
        // applications (apply.js) own their deadline: theirs replaces a built-in "application" date for the same university
        var appUnis = typeof window.dtApplicationUnis === 'function' ? call(window.dtApplicationUnis, []) : [];
        (typeof window.dtApplicationDeadlines === 'function' ? call(window.dtApplicationDeadlines, []) : []).forEach(function (d) { add(Object.assign({}, d, { source: 'apply' })); });
        DEADLINES.filter(function (d) { return d.country === cc && !(d.type === 'application' && appUnis.indexOf(d.uniId) !== -1); }).forEach(function (d) {
            add({ id: d.id, title: d.title, date: d.date, type: d.type, uniId: d.uniId, uniName: d.uniName, uniAbbr: d.uniAbbr, uniColor: d.uniColor,
                notes: d.notes || null, source: 'builtin', savedUni: saved.indexOf(d.uniId) !== -1 });
        });
        call(getDlCustom, []).forEach(function (d) {
            add({ id: d.id, title: d.title, date: d.date, type: d.type || 'other', uniName: d.uniName || null, notes: d.notes || null, source: 'custom' });
        });
        out.forEach(function (it) {
            it.done = done.indexOf(it.id) !== -1;
            it.reminded = rem.indexOf(it.id) !== -1 || it.source === 'custom';
            it.pinned = pin === it.id;
            it.days = dayDiff(it.date);
        });
        out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
        return out;
    }
    function matchesBase(it, ignoreCat) {
        if (P.savedOnly && it.source === 'builtin' && !it.savedUni) return false;
        if (!ignoreCat) {
            if (P.cat === 'personal') { if (!it.reminded) return false; }
            else if (P.cat !== 'all' && it.type !== P.cat) return false;
        }
        if (query) {
            var hay = norm(it.title + ' ' + (it.uniName || '') + ' ' + (it.notes || ''));
            if (hay.indexOf(norm(query)) === -1) return false;
        }
        return true;
    }
    function inWindow(it) {
        if (P.hidePast && it.days < 0) return false;
        if (P.within100 && it.days > WINDOW_DAYS) return false;
        return true;
    }
    function uniFor(it) {
        var u = it.uniId && typeof resolveUni === 'function' ? call(function () { return resolveUni(it.uniId); }, null) : null;
        if (!u && it.uniName) u = { name: it.uniName, abbr: it.uniAbbr, color: it.uniColor, website: it.uniWebsite };
        return u;
    }

    /* ── Small building blocks ─────────────────────────────────────── */
    function uniBadge(it, size) {
        var u = uniFor(it);
        if (u && typeof uniLogo === 'function') {
            try { return '<span class="dt-logo">' + uniLogo({ name: u.name, abbr: (u.abbr || initials(u.name)).slice(0, 4), color: u.color || it.uniColor || '#d97c14', website: u.website }, size) + '</span>'; } catch (e) {}
        }
        return '<span class="dt-logo dt-logo--mono" style="width:' + size + 'px;height:' + size + 'px;background:' + esc(it.uniColor || typeOf(it.type).color) + '">' + esc(initials(it.uniName || it.title)) + '</span>';
    }
    function flags(it) {
        var f = [];
        if (it.pinned) f.push('<span class="dt-flag"><i class="fa-solid fa-thumbtack" aria-hidden="true"></i> Pinned</span>');
        if (it.source === 'scholarship') f.push('<span class="dt-flag">Saved scholarship</span>');
        if (it.source === 'custom') f.push('<span class="dt-flag">Your date</span>');
        if (it.source === 'apply') f.push('<span class="dt-flag">Your application</span>');
        return f.join('');
    }
    function row(it) {
        var t = typeOf(it.type), d = parseDay(it.date), tn = tone(it);
        return '<li class="dt-row dt-row--' + tn + (it.done ? ' is-done' : '') + '" id="dt-' + esc(it.id) + '" style="--c:' + t.color + '">' +
            '<button type="button" class="dt-check' + (it.done ? ' is-on' : '') + '" data-act="done" data-id="' + esc(it.id) + '" aria-pressed="' + it.done + '" aria-label="' + (it.done ? 'Mark as not done: ' : 'Mark as done: ') + esc(it.title) + '"><i class="fa-solid fa-check" aria-hidden="true"></i></button>' +
            '<button type="button" class="dt-row__btn" data-open="' + esc(it.id) + '" aria-haspopup="dialog">' +
                '<span class="dt-row__date"><b>' + String(d.getDate()).padStart(2, '0') + '</b><small>' + WDAYS[d.getDay()] + '</small></span>' +
                '<span class="dt-row__main">' +
                    '<span class="dt-row__title">' + esc(it.title) + '</span>' +
                    '<span class="dt-row__meta">' + (it.uniName || it.source !== 'custom' ? uniBadge(it, 18) + '<span class="dt-row__uni">' + esc(it.uniName || '') + '</span>' : '') +
                        (it.notes ? '<span class="dt-row__note">' + esc(it.notes) + '</span>' : '') + flags(it) + '</span>' +
                '</span>' +
                '<span class="dt-row__type"><i aria-hidden="true"></i>' + esc(t.label) + '</span>' +
                '<span class="dt-row__cd">' + (it.done ? 'Done' : when(it.days)) + '</span>' +
                '<i class="fa-solid fa-chevron-right dt-row__chev" aria-hidden="true"></i>' +
            '</button>' +
        '</li>';
    }

    /* ── Header: date, summary line, counts, "next up" ticket ──────── */
    function nextUp(items) {
        var up = items.filter(function (it) { return !it.done && it.days >= 0; });
        return up.filter(function (it) { return it.pinned; })[0] || up[0] || null;
    }
    function clockParts(iso) {
        var end = parseDay(iso); end.setHours(23, 59, 59, 999);
        var ms = Math.max(0, end - Date.now());
        return { d: Math.floor(ms / DAY), h: Math.floor(ms % DAY / 36e5), m: Math.floor(ms % 36e5 / 6e4) };
    }
    function renderHead(items) {
        var t = new Date();
        $('dtToday').textContent = WDAYS_LONG[t.getDay()] + ', ' + t.getDate() + ' ' + MONTHS_LONG[t.getMonth()];
        var open = items.filter(function (it) { return !it.done; });
        var n30 = open.filter(function (it) { return it.days >= 0 && it.days <= 30; }).length;
        var n = nextUp(items), lede;
        if (!n) lede = 'Nothing coming up. Add your own dates, or save a scholarship and its deadlines will appear here.';
        else lede = (n30 ? plural(n30, 'date') + ' in the next 30 days. ' : 'Nothing in the next 30 days. ') +
            esc(n.uniName ? shortUni(n.uniName) : n.title) + (n.pinned ? ' is pinned' : ' is first') + ', ' + (n.days <= 1 ? when(n.days).toLowerCase() : when(n.days)) + '.';
        $('dtLede').innerHTML = lede;
        var s = [
            ['over', open.filter(function (it) { return it.days < 0; }).length, 'overdue'],
            ['hot', open.filter(function (it) { return it.days >= 0 && it.days <= 7; }).length, 'this week'],
            ['warm', open.filter(function (it) { return it.days > 7 && it.days <= 30; }).length, 'this month'],
            ['done', items.filter(function (it) { return it.done; }).length, 'done']
        ];
        $('dtStats').innerHTML = s.map(function (x) {
            return '<button type="button" class="dt-stat dt-stat--' + x[0] + (x[1] ? '' : ' is-zero') + '" data-stat="' + x[0] + '"><b>' + x[1] + '</b><span>' + x[2] + '</span></button>';
        }).join('');
        renderTicket(n);
    }
    function renderTicket(n) {
        var box = $('dtNext');
        if (!n) {
            box.removeAttribute('data-date');
            box.innerHTML = '<p class="dt-ticket__lbl">Next up</p><p class="dt-ticket__none">Nothing scheduled</p>' +
                '<div class="dt-ticket__acts"><button type="button" class="dt-tbtn dt-tbtn--solid" data-act="add">Add a date</button><button type="button" class="dt-tbtn" data-act="sch">Find scholarships</button></div>';
            return;
        }
        var c = clockParts(n.date), t = typeOf(n.type);
        box.setAttribute('data-date', n.date);
        box.className = 'dt-ticket__main dt-ticket--' + tone(n);
        box.innerHTML =
            '<p class="dt-ticket__lbl">' + (n.pinned ? 'Pinned' : 'Next up') + '<span style="--c:' + t.color + '">' + esc(t.label) + '</span></p>' +
            '<div class="dt-ticket__count"><b data-k="d">' + c.d + '</b><span>' + (c.d === 1 ? 'day' : 'days') + '<small data-k="hm">' + c.h + ' h ' + String(c.m).padStart(2, '0') + ' m</small></span></div>' +
            '<h3 class="dt-ticket__title">' + esc(n.title) + '</h3>' +
            '<p class="dt-ticket__meta">' + (n.uniName ? esc(shortUni(n.uniName)) + ' \u00b7 ' : '') + esc(shortDate(parseDay(n.date))) + (n.notes ? ' \u00b7 ' + esc(n.notes) : '') + '</p>' +
            '<div class="dt-ticket__acts">' +
                '<button type="button" class="dt-tbtn dt-tbtn--solid" data-open="' + esc(n.id) + '">Details</button>' +
                '<button type="button" class="dt-tbtn" data-act="done" data-id="' + esc(n.id) + '"><i class="fa-solid fa-check" aria-hidden="true"></i> Done</button>' +
                '<button type="button" class="dt-tbtn" data-act="cal" data-id="' + esc(n.id) + '"><i class="fa-regular fa-calendar-plus" aria-hidden="true"></i> Calendar</button>' +
            '</div>';
    }
    function tickClock() {
        var box = $('dtNext'), iso = box && box.getAttribute('data-date');
        if (!iso) return;
        var c = clockParts(iso), d = box.querySelector('[data-k="d"]'), hm = box.querySelector('[data-k="hm"]');
        if (d && d.textContent !== String(c.d)) d.textContent = c.d;
        if (hm) hm.textContent = c.h + ' h ' + String(c.m).padStart(2, '0') + ' m';
    }

    /* ── Ruler of the next 100 days ────────────────────────────────── */
    function renderRuler(items) {
        var up = items.filter(function (it) { return !it.done && it.days >= 0 && it.days <= WINDOW_DAYS; });
        var t0 = today0(), marks = '', pins = '';
        var pct = function (d) { return (d / WINDOW_DAYS * 100).toFixed(2) + '%'; };
        for (var d = 1; d <= WINDOW_DAYS; d++) {
            var dt = new Date(t0); dt.setDate(t0.getDate() + d);
            if (dt.getDate() === 1) marks += '<span class="dt-ruler__month" style="left:' + pct(d) + '">' + MONTHS[dt.getMonth()] + '</span>';
            else if (dt.getDay() === 1) marks += '<span class="dt-ruler__tick" style="left:' + pct(d) + '"></span>';
        }
        var stack = {};
        up.forEach(function (it) {
            var j = stack[it.days] = (stack[it.days] || 0) + 1, t = typeOf(it.type), p = it.days / WINDOW_DAYS;
            pins += '<button type="button" class="dt-pin' + (p < .18 ? ' dt-pin--l' : p > .82 ? ' dt-pin--r' : '') + '" data-open="' + esc(it.id) + '" style="left:' + pct(it.days) + ';--j:' + (j - 1) + ';--c:' + t.color + '" aria-label="' + esc(shortDate(parseDay(it.date)) + ': ' + it.title) + '">' +
                '<span class="dt-pin__tip" aria-hidden="true"><b>' + esc(shortDate(parseDay(it.date))) + ' \u00b7 ' + esc(when(it.days)) + '</b>' + esc(it.title) + (it.uniName ? '<small>' + esc(it.uniName) + '</small>' : '') + '</span></button>';
        });
        var end = new Date(t0); end.setDate(t0.getDate() + WINDOW_DAYS);
        $('dtRuler').innerHTML =
            '<div class="dt-ruler__hd"><span>Next 100 days</span><span>' + (up.length ? plural(up.length, 'date') : 'Nothing yet') + '</span></div>' +
            '<div class="dt-ruler__track">' +
                '<span class="dt-ruler__week" style="width:' + pct(7) + '"></span>' +
                '<span class="dt-ruler__line"></span>' + marks +
                '<span class="dt-ruler__end dt-ruler__end--a">Today</span><span class="dt-ruler__end dt-ruler__end--b">' + end.getDate() + ' ' + MONTHS[end.getMonth()] + '</span>' +
                pins +
            '</div>';
    }

    /* ── Toolbar: type tabs + switches ─────────────────────────────── */
    function renderBarControls(all) {
        var base = all.filter(function (it) { return matchesBase(it, true) && inWindow(it); });
        $('dtChips').innerHTML = TABS.map(function (c) {
            var n = c[0] === 'all' ? base.length : c[0] === 'personal' ? base.filter(function (it) { return it.reminded; }).length : base.filter(function (it) { return it.type === c[0]; }).length;
            if (!n && P.cat !== c[0] && c[0] !== 'all' && c[0] !== 'personal') return '';
            var on = P.cat === c[0];
            return '<button type="button" class="dt-tab' + (on ? ' is-on' : '') + '" data-cat="' + c[0] + '" aria-pressed="' + on + '">' + c[1] + '<sup>' + n + '</sup></button>';
        }).join('');
        $('dtToggles').innerHTML = TOGGLES.map(function (t) {
            var on = !!P[t[0]];
            return '<button type="button" class="dt-tog' + (on ? ' is-on' : '') + '" data-tog="' + t[0] + '" role="switch" aria-checked="' + on + '"><span class="dt-tog__sw" aria-hidden="true"></span>' + t[1] + '</button>';
        }).join('');
        root.querySelectorAll('.dt-view__btn').forEach(function (b) { var on = b.getAttribute('data-view') === P.view; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    }

    /* ── List, grouped by month ────────────────────────────────────── */
    function group(key, name, meta, items) {
        return '<section class="dt-month dt-month--' + key + '"><h3 class="dt-month__hd"><span class="dt-month__name">' + name + '</span><span class="dt-month__meta">' + meta + '</span></h3>' +
            '<ol class="dt-list">' + items.map(row).join('') + '</ol></section>';
    }
    function renderTimeline(all) {
        var base = all.filter(function (it) { return matchesBase(it); }), shown = base.filter(inWindow);
        var open = shown.filter(function (it) { return !it.done; }), done = shown.filter(function (it) { return it.done; });
        var hiddenPast = P.hidePast ? base.filter(function (it) { return it.days < 0 && !it.done; }).length : 0;
        var hiddenLater = P.within100 ? base.filter(function (it) { return it.days > WINDOW_DAYS && !it.done; }).length : 0;
        if (!all.length) return emptyState('No dates yet', 'Save universities or scholarships, or add your own.', [['add', 'Add a date'], ['sch', 'Find scholarships']]);
        var html = '', over = open.filter(function (it) { return it.days < 0; });
        if (over.length) html += group('over', 'Overdue', plural(over.length, 'date'), over.slice().reverse());
        var months = {}, order = [];
        open.filter(function (it) { return it.days >= 0; }).forEach(function (it) {
            var k = it.date.slice(0, 7);
            if (!months[k]) { months[k] = []; order.push(k); }
            months[k].push(it);
        });
        var thisYear = today0().getFullYear();
        order.forEach(function (k) {
            var y = +k.slice(0, 4), m = +k.slice(5, 7) - 1;
            html += group('m', MONTHS_LONG[m] + (y !== thisYear ? ' <em>' + y + '</em>' : ''), plural(months[k].length, 'date'), months[k]);
        });
        if (!open.length) html += emptyState('Nothing due' + (P.within100 ? ' in the next 100 days' : ''), 'You\u2019re all caught up.', [['add', 'Add a date']].concat(hiddenLater ? [['show-later', 'Show ' + hiddenLater + ' later']] : []));
        if (done.length) html += '<details class="dt-done"><summary>Done<sup>' + done.length + '</sup><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary><ol class="dt-list">' + done.map(row).join('') + '</ol></details>';
        var notes = [];
        if (hiddenPast) notes.push('<button type="button" class="dt-link" data-act="show-past">' + plural(hiddenPast, 'expired date') + ' hidden \u2014 show</button>');
        if (hiddenLater && open.length) notes.push('<button type="button" class="dt-link" data-act="show-later">' + plural(hiddenLater, 'date') + ' after the next 100 days \u2014 show</button>');
        return '<div class="dt-timeline">' + html + '</div>' + (notes.length ? '<div class="dt-hiddenrow">' + notes.join('') + '</div>' : '');
    }
    function emptyState(title, sub, btns) {
        return '<div class="dt-empty"><h3>' + title + '</h3><p>' + sub + '</p><div class="dt-empty__acts">' +
            btns.map(function (b, i) { return '<button type="button" class="dt-btn' + (i ? '' : ' dt-btn--ink') + '" data-act="' + b[0] + '">' + b[1] + '</button>'; }).join('') + '</div></div>';
    }

    /* ── Calendar ──────────────────────────────────────────────────── */
    var calMonth = null, calSel = null;
    function renderCalendar(all) {
        var items = all.filter(function (it) { return matchesBase(it); });
        if (!calMonth) {
            var n = nextUp(items), base = n ? parseDay(n.date) : new Date();
            calMonth = new Date(base.getFullYear(), base.getMonth(), 1);
            calSel = n ? n.date : isoDay(today0());
        }
        var byDay = {};
        items.forEach(function (it) { (byDay[it.date] = byDay[it.date] || []).push(it); });
        var first = new Date(calMonth), start = new Date(first);
        start.setDate(1 - ((first.getDay() + 6) % 7));   // Monday-first grid
        var tIso = isoDay(today0()), cells = '';
        for (var i = 0; i < 42; i++) {
            var d = new Date(start); d.setDate(start.getDate() + i);
            var iso = isoDay(d), ev = byDay[iso] || [], out = d.getMonth() !== first.getMonth();
            cells += '<button type="button" class="dt-cal__cell' + (out ? ' is-out' : '') + (iso === tIso ? ' is-today' : '') + (iso < tIso ? ' is-past' : '') + (iso === calSel ? ' is-sel' : '') + (ev.length ? ' has-ev' : '') + '" data-day="' + iso + '" aria-label="' + d.getDate() + ' ' + MONTHS_LONG[d.getMonth()] + (ev.length ? ', ' + plural(ev.length, 'deadline') : '') + '">' +
                '<span class="dt-cal__n">' + d.getDate() + '</span>' +
                '<span class="dt-cal__evs">' + ev.slice(0, 2).map(function (it) { return '<span class="dt-cal__ev' + (it.done ? ' is-done' : '') + '" style="--c:' + typeOf(it.type).color + '">' + esc(it.uniAbbr || (it.uniName ? initials(it.uniName) : '')) + '<em> ' + esc(it.title) + '</em></span>'; }).join('') +
                    (ev.length > 2 ? '<span class="dt-cal__more">+' + (ev.length - 2) + '</span>' : '') + '</span></button>';
        }
        var sel = byDay[calSel] || [];
        return '<div class="dt-cal">' +
            '<div class="dt-cal__main">' +
                '<div class="dt-cal__hd"><h3>' + MONTHS_LONG[first.getMonth()] + ' <span>' + first.getFullYear() + '</span></h3>' +
                    '<button type="button" class="dt-cal__today" data-cal="0">Today</button>' +
                    '<button type="button" class="dt-cal__nav" data-cal="-1" aria-label="Previous month"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>' +
                    '<button type="button" class="dt-cal__nav" data-cal="1" aria-label="Next month"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button></div>' +
                '<div class="dt-cal__wd">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>' +
                '<div class="dt-cal__grid">' + cells + '</div>' +
            '</div>' +
            '<aside class="dt-cal__side"><h4>' + fullDate(calSel) + '</h4>' +
                (sel.length ? '<ol class="dt-list">' + sel.map(row).join('') + '</ol>'
                    : '<div class="dt-cal__none"><p>Nothing on this day.</p><button type="button" class="dt-btn" data-act="add">Add a date</button></div>') +
            '</aside>' +
        '</div>';
    }

    /* ── Details sheet ─────────────────────────────────────────────── */
    var sheet = document.createElement('div');
    sheet.className = 'dt-sheet';
    sheet.hidden = true;
    sheet.innerHTML = '<div class="dt-sheet__scrim" data-close="1"></div><section class="dt-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="dtSheetTitle" tabindex="-1"></section>';
    document.body.appendChild(sheet);
    var panel = sheet.querySelector('.dt-sheet__panel');
    var openId = null, lastFocus = null;

    function about(it) {
        var parts = [], text = it.title + ' ' + (it.notes || '');
        if (it.type === 'application' && OPENS.test(it.title)) parts.push('This is the day applications open, not the day they close \u2014 a good moment to start.');
        else parts.push(ABOUT[it.type] || ABOUT.other);
        KEYWORDS.forEach(function (k) { if (k[0].test(text)) parts.push(k[1]); });
        return parts;
    }
    function planFor(it) {
        var key = it.type === 'application' && OPENS.test(it.title) ? 'opens' : PLAN[it.type] ? it.type : 'other';
        var steps = PLAN[key].map(function (s) { return { d: addDays(it.date, s[0]), t: s[1] }; });
        if (key !== 'opens') steps.push({ d: parseDay(it.date), t: 'Deadline', end: true });
        var t0 = today0(), nextMarked = false;
        return steps.filter(function (s) { return s.end || s.d >= addDays(it.date, -120); }).map(function (s) {
            var past = s.d < t0, next = !past && !nextMarked && !it.done;
            if (next) nextMarked = true;
            return '<li class="' + (past ? 'is-past' : '') + (next ? ' is-next' : '') + (s.end ? ' is-end' : '') + '"><time>' + shortDate(s.d) + '</time><span>' + esc(s.t) + (next && !s.end ? '<em>Next step</em>' : '') + '</span></li>';
        }).join('');
    }
    function list(items, cls) { return '<ul class="dt-sheet__list' + (cls ? ' ' + cls : '') + '">' + items.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'; }
    function block(title, body) { return body ? '<div class="dt-sheet__block"><h4>' + title + '</h4>' + body + '</div>' : ''; }
    function renderSheet() {
        var it = findItem(openId);
        if (!it) { closeSheet(); return; }
        var t = typeOf(it.type), u = uniFor(it), s = it.sch ? schRecord(it.sch) : null;
        var link = it.link || (u && u.website) || null;
        var ready = it.type === 'scholarship' && s && s.takes && s.takes.length ? null : (READY[it.type] || []).concat(it.type === 'application' && GRAD.test(it.title) ? READY.graduate : []);
        var cd = it.done ? 'Done' : it.days < 0 ? 'Passed ' + when(it.days).toLowerCase() : when(it.days);
        panel.style.setProperty('--c', t.color);
        panel.innerHTML =
            '<header class="dt-sheet__hd">' +
                '<p class="dt-sheet__kicker"><i aria-hidden="true"></i>' + esc(t.label) + (it.uniName ? ' \u00b7 ' + esc(it.uniName) : '') + '</p>' +
                '<button type="button" class="dt-sheet__x" data-close="1" aria-label="Close details"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
                '<h3 class="dt-sheet__title" id="dtSheetTitle">' + esc(it.title) + '</h3>' +
                '<p class="dt-sheet__when"><b>' + fullDate(it.date) + '</b><span class="dt-sheet__cd dt-sheet__cd--' + tone(it) + '">' + esc(cd) + '</span></p>' +
                (it.notes ? '<p class="dt-sheet__note"><i class="fa-regular fa-clock" aria-hidden="true"></i> ' + esc(it.notes) + '</p>' : '') +
                '<div class="dt-sheet__acts">' +
                    '<button type="button" class="dt-btn dt-btn--ink" data-act="done" data-id="' + esc(it.id) + '"><i class="fa-solid fa-check" aria-hidden="true"></i> ' + (it.done ? 'Mark not done' : 'Mark done') + '</button>' +
                    '<button type="button" class="dt-btn" data-act="cal" data-id="' + esc(it.id) + '"><i class="fa-regular fa-calendar-plus" aria-hidden="true"></i> Add to calendar</button>' +
                    '<button type="button" class="dt-btn' + (it.pinned ? ' is-on' : '') + '" data-act="pin" data-id="' + esc(it.id) + '" aria-pressed="' + it.pinned + '"><i class="fa-solid fa-thumbtack" aria-hidden="true"></i> ' + (it.pinned ? 'Pinned' : 'Pin to Overview') + '</button>' +
                    (it.source !== 'custom' ? '<button type="button" class="dt-btn' + (it.reminded ? ' is-on' : '') + '" data-act="remind" data-id="' + esc(it.id) + '" aria-pressed="' + it.reminded + '"><i class="fa-' + (it.reminded ? 'solid' : 'regular') + ' fa-bell" aria-hidden="true"></i> ' + (it.reminded ? 'In My reminders' : 'Remind me') + '</button>' : '') +
                '</div>' +
            '</header>' +
            '<div class="dt-sheet__body">' +
                (it.days < 0 && !it.done ? '<p class="dt-sheet__warn">This date has passed. Check the official page for late applications or the next round.</p>' : '') +
                block('What it\u2019s for', about(it).map(function (p) { return '<p>' + esc(p) + '</p>'; }).join('')) +
                (s ? schFacts(s) : '') +
                block('Have these ready', ready && ready.length ? list(ready, 'dt-sheet__list--check') : '') +
                block('Suggested plan', it.type === 'other' && it.source === 'custom' && it.days > 30 ? '' : '<ol class="dt-plan">' + planFor(it) + '</ol>') +
                (it.source === 'apply' ? '<button type="button" class="dt-link dt-sheet__ckl" data-act="apply-open" data-app="' + esc(it.appId) + '">Open this application</button>'
                    : it.type === 'application' || it.type === 'scholarship' ? '<button type="button" class="dt-link dt-sheet__ckl" data-act="checklist">Open the application checklist</button>' : '') +
            '</div>' +
            '<footer class="dt-sheet__ft">' +
                (link ? '<a class="dt-btn" href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">' + (it.link ? 'Official page' : 'University website') + ' <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a>' : '') +
                (it.source === 'custom' ? '<button type="button" class="dt-btn dt-btn--danger" data-act="del" data-id="' + esc(it.id) + '"><i class="fa-regular fa-trash-can" aria-hidden="true"></i> Delete</button>' : '') +
                '<p class="dt-sheet__src">' + (it.source === 'apply' ? 'From your application on the Apply page \u2014 the date comes from the official system or university, or from you.' : it.source === 'builtin' ? 'Built-in date \u2014 always confirm on the official page.' : it.source === 'scholarship' ? 'From your saved scholarship' + (it.cycle ? ' (' + esc(it.cycle) + ')' : '') + '.' : 'Added by you.') + '</p>' +
            '</footer>';
        if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(panel);
    }
    function schFacts(s) {
        var d = s.difficulty || {}, a = s.awarded || {}, facts = '';
        if (d.score || a.big) facts = '<div class="dt-facts">' +
            (d.score ? '<div><b>' + d.score + '<small>/10</small></b><span>Difficulty</span></div>' : '') +
            (a.big ? '<div><b>' + esc(a.big) + '</b><span>' + esc(a.small || 'awarded') + '</span></div>' : '') + '</div>';
        return block('The scholarship', facts) +
            block('What it covers', s.gives && s.gives.length ? list(s.gives) : '') +
            block('Who can apply', s.takes && s.takes.length ? list(s.takes) : '') +
            block('How to apply', s.how && s.how.steps && s.how.steps.length ? '<ol class="dt-sheet__list dt-sheet__list--num">' + s.how.steps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' : '');
    }
    function openSheet(id, from) {
        openId = id;
        lastFocus = from || document.activeElement;
        renderSheet();
        if (!openId) return;
        sheet.hidden = false;
        document.documentElement.classList.add('dt-lock');
        requestAnimationFrame(function () { sheet.classList.add('is-on'); });
        panel.scrollTop = 0;
        var x = panel.querySelector('.dt-sheet__x'); if (x) x.focus({ preventScroll: true });
    }
    function closeSheet() {
        if (sheet.hidden) return;
        openId = null;
        closeMenu();
        sheet.classList.remove('is-on');
        document.documentElement.classList.remove('dt-lock');
        setTimeout(function () { if (!openId) sheet.hidden = true; }, REDUCED ? 0 : 220);
        if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
    }

    /* ── Render (skips work when nothing changed) ──────────────────── */
    var lastSig = '', lastView = '';
    function render() {
        var all = collect();
        var sig = JSON.stringify([P, query, isoDay(today0()), calMonth && calMonth.getTime(), calSel, all.map(function (it) { return it.id + (it.done ? 1 : 0) + (it.reminded ? 1 : 0) + (it.pinned ? 1 : 0) + it.date; })]);
        if (sig === lastSig) { tickClock(); return; }
        lastSig = sig;
        var headItems = all.filter(function (it) { return matchesBase(it, true); });
        renderHead(headItems.length ? headItems : all);
        renderRuler(all.filter(function (it) { return matchesBase(it); }));
        renderBarControls(all);
        var board = $('dtBoard');
        board.innerHTML = P.view === 'calendar' ? renderCalendar(all) : renderTimeline(all);
        board.setAttribute('data-view', P.view);
        if (lastView !== P.view && !REDUCED) { board.classList.remove('is-in'); void board.offsetWidth; board.classList.add('is-in'); }
        lastView = P.view;
        [$('dtNext'), board].forEach(function (el) { if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(el); });
        if (openId) renderSheet();
        if (typeof window.renderChecklists === 'function') window.renderChecklists();
    }
    function rerender() { lastSig = ''; render(); }
    window.renderDeadlines = render;

    /* ── Add to calendar (Google link / .ics download) ─────────────── */
    function findItem(id) { var a = collect(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
    function ymd(iso) { return iso.replace(/-/g, ''); }
    function nextDayIso(iso) { return isoDay(addDays(iso, 1)); }
    function describe(it) { return [it.uniName, typeOf(it.type).label, it.notes, it.link].filter(Boolean).join(' \u00b7 ') + ' \u2014 from UniVersity'; }
    function googleUrl(it) {
        return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(it.title) +
            '&dates=' + ymd(it.date) + '/' + ymd(nextDayIso(it.date)) + '&details=' + encodeURIComponent(describe(it));
    }
    function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
    function icsFor(items) {
        var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
        var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UniVersity//Deadlines//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
        items.forEach(function (it) {
            L.push('BEGIN:VEVENT', 'UID:' + icsEsc(it.id) + '@university', 'DTSTAMP:' + stamp,
                'DTSTART;VALUE=DATE:' + ymd(it.date), 'DTEND;VALUE=DATE:' + ymd(nextDayIso(it.date)),
                'SUMMARY:' + icsEsc(it.title), 'DESCRIPTION:' + icsEsc(describe(it)),
                'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(it.title) + ' in 3 days', 'TRIGGER:-P3D', 'END:VALARM',
                'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(it.title) + ' tomorrow', 'TRIGGER:-P1D', 'END:VALARM',
                'END:VEVENT');
        });
        L.push('END:VCALENDAR');
        return L.join('\r\n');
    }
    function download(name, text) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
        a.download = name;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    var menu = document.createElement('div');
    menu.className = 'dt-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu);
    var menuFor = null;
    function openMenu(btn, it) {
        menuFor = it;
        menu.innerHTML = '<a role="menuitem" class="dt-menu__it" href="' + esc(googleUrl(it)) + '" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-google" aria-hidden="true"></i> Google Calendar</a>' +
            '<button role="menuitem" type="button" class="dt-menu__it" data-ics="1"><i class="fa-brands fa-apple" aria-hidden="true"></i> Apple / Outlook (.ics)</button>';
        menu.hidden = false;
        var r = btn.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight, vw = document.documentElement.clientWidth;
        var x = Math.max(8, Math.min(vw - w - 8, r.left)), y = r.bottom + 6;
        if (y + h > window.innerHeight - 8) y = r.top - h - 6;
        menu.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
        requestAnimationFrame(function () { menu.classList.add('is-on'); });
        var first = menu.querySelector('.dt-menu__it'); if (first) first.focus({ preventScroll: true });
    }
    function closeMenu() { if (menu.hidden) return; menu.classList.remove('is-on'); menu.hidden = true; menuFor = null; }
    menu.addEventListener('click', function (e) {
        if (e.target.closest('[data-ics]') && menuFor) download(menuFor.title.replace(/[^\w\- ]+/g, '').trim().slice(0, 60) + '.ics', icsFor([menuFor]));
        closeMenu();
    });
    document.addEventListener('mousedown', function (e) { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('[data-act="cal"]')) closeMenu(); });
    window.addEventListener('scroll', closeMenu, { passive: true, capture: true });

    /* ── Actions (page + sheet) ────────────────────────────────────── */
    function toggleIn(getter, setter, id) {
        var a = call(getter, []), i = a.indexOf(id);
        if (i === -1) a.push(id); else a.splice(i, 1);
        setter(a);
    }
    function afterChange() { if (typeof updateDshWidgets === 'function') { try { updateDshWidgets(); } catch (e) {} } rerender(); }
    function onAction(e) {
        var t = e.target.closest('[data-close],[data-open],[data-act],[data-cat],[data-tog],[data-view],[data-stat],[data-day],[data-cal]');
        if (!t) return;
        if (t.hasAttribute('data-close')) { closeSheet(); return; }
        if (t.hasAttribute('data-open')) { openSheet(t.getAttribute('data-open'), t); return; }
        if (t.hasAttribute('data-cat')) { P.cat = t.getAttribute('data-cat'); saveP(); rerender(); return; }
        if (t.hasAttribute('data-tog')) { var k = t.getAttribute('data-tog'); P[k] = !P[k]; saveP(); rerender(); return; }
        if (t.hasAttribute('data-view')) { P.view = t.getAttribute('data-view'); saveP(); rerender(); return; }
        if (t.hasAttribute('data-day')) { calSel = t.getAttribute('data-day'); var dd = parseDay(calSel); if (dd.getMonth() !== calMonth.getMonth() || dd.getFullYear() !== calMonth.getFullYear()) calMonth = new Date(dd.getFullYear(), dd.getMonth(), 1); rerender(); return; }
        if (t.hasAttribute('data-cal') && !t.hasAttribute('data-act')) {
            var step = +t.getAttribute('data-cal');
            if (!step) { var td = today0(); calMonth = new Date(td.getFullYear(), td.getMonth(), 1); calSel = isoDay(td); }
            else calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + step, 1);
            rerender(); return;
        }
        if (t.hasAttribute('data-stat')) {
            var st = t.getAttribute('data-stat');
            if (st === 'over') { P.hidePast = false; }
            P.view = 'timeline'; P.cat = 'all'; saveP(); rerender();
            var sec = st === 'done' ? root.querySelector('.dt-done') : st === 'over' ? root.querySelector('.dt-month--over') : root.querySelector('.dt-row--' + st);
            if (sec) { if (st === 'done') sec.open = true; sec.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' }); }
            return;
        }
        var act = t.getAttribute('data-act'), id = t.getAttribute('data-id');
        if (act === 'add') { closeSheet(); if (typeof openDlModal === 'function') openDlModal(); return; }
        if (act === 'sch') { if (typeof window.openScholarships === 'function') window.openScholarships(); return; }
        if (act === 'show-past') { P.hidePast = false; saveP(); rerender(); return; }
        if (act === 'show-later') { P.within100 = false; saveP(); rerender(); return; }
        if (act === 'apply-open') { closeSheet(); if (window.UniApply) window.UniApply.open(t.getAttribute('data-app')); return; }
        if (act === 'checklist') { closeSheet(); var ck = $('dlChecklist'); if (ck) ck.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); return; }
        if (act === 'cal') { var it = findItem(id); if (it) { if (menuFor && menuFor.id === id && !menu.hidden) closeMenu(); else openMenu(t, it); } return; }
        if (act === 'done') {
            var rowEl = $('dt-' + id), wasDone = call(getDlDone, []).indexOf(id) !== -1;
            toggleIn(getDlDone, setDlDone, id);
            if (rowEl && !wasDone && !REDUCED && !openId) { rowEl.classList.add('is-completing'); setTimeout(afterChange, 380); }
            else afterChange();
            return;
        }
        if (act === 'remind') { toggleIn(getDlReminded, setDlReminded, id); rerender(); return; }
        if (act === 'pin') { setDlPin(call(getDlPin, null) === id ? null : id); afterChange(); return; }
        if (act === 'del') {
            if (!confirm('Delete this date?')) return;
            if (call(getDlPin, null) === id) setDlPin(null);
            setDlCustom(call(getDlCustom, []).filter(function (d) { return d.id !== id; }));
            setDlDone(call(getDlDone, []).filter(function (x) { return x !== id; }));
            closeSheet(); afterChange();
        }
    }
    root.addEventListener('click', onAction);
    sheet.addEventListener('click', onAction);
    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        if (!menu.hidden) { closeMenu(); return; }
        if (!sheet.hidden) closeSheet();
    });
    // Keep keyboard focus inside the open sheet.
    sheet.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        var f = panel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    $('dtSearch').addEventListener('input', function () {
        query = this.value.trim();
        clearTimeout(this._t);
        this._t = setTimeout(render, 160);
    });
    $('dtIcsAll').addEventListener('click', function () {
        var items = collect().filter(function (it) { return matchesBase(it) && inWindow(it) && !it.done && it.days >= 0; });
        if (!items.length) return;
        download('UniVersity-deadlines.ics', icsFor(items));
    });

    // Keep the countdown live (cheap: only digits change).
    setInterval(function () { if (root.style.display !== 'none') tickClock(); }, 20000);
    new MutationObserver(function () { if (root.style.display !== 'none') render(); else closeSheet(); }).observe(root, { attributes: true, attributeFilter: ['style'] });
    // Saved scholarships changed in another tab → refresh.
    window.addEventListener('storage', function (e) { if (e.key === SCH_KEY) rerender(); });
    document.addEventListener('apply:deadlines', function () { if (typeof currentTab === 'undefined' || currentTab === 'tracker') rerender(); });

    render();
})();
