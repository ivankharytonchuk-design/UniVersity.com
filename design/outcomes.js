/* ════════════════════════════════════════════════════════════════════
   Admissions data — the front end of server/admissions.js

     • Chances page (#chReal): for the university picked there — official
         figures (with sources), what applicants reported publicly (each one
         double-checked before it appears), the score distribution in the
         qualification's OWN units, and "people like you"
     • Probability meter: one honest line comparing you with real applicants
     • University popup (#udmOutcomes): the same in one line

   Small samples say so. Nothing here estimates a probability from thin data.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var API = (function () { if (location.protocol === 'file:') return 'http://localhost:4242'; return (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== '4242') ? 'http://localhost:4242' : location.origin; }());
    var UID = (window.user && window.user.id) || 'guest';
    var DEC = { accepted: ['Accepted', 'fa-circle-check', 'good'], waitlisted: ['Waitlisted', 'fa-hourglass-half', 'warn'], rejected: ['Rejected', 'fa-circle-xmark', 'bad'],
        withdrawn: ['Withdrawn', 'fa-arrow-right-from-bracket', 'mute'], pending: ['Still waiting', 'fa-clock', 'mute'] };
    var LEVEL = { bachelor: 'Bachelor\'s', master: 'Master\'s', phd: 'PhD', other: 'Other' };
    var SRC = { official: ['Official', 'fa-building-columns'], public_self_report: ['Public', 'fa-comments'], user_reported: ['User', 'fa-user'], user_verified: ['Verified', 'fa-circle-check'] };
    var FIELD = { cs: 'Computer science', engineering: 'Engineering', finance: 'Business & finance', medicine: 'Medicine', law: 'Law', science: 'Science', arts: 'Arts & humanities' };
    var TAGS = { olympiad: 'Olympiad', research: 'Research', publication: 'Publication', competition: 'Competitions', sports: 'Sport', music_arts: 'Music & arts', volunteering: 'Volunteering',
        leadership: 'Leadership', work_internship: 'Work / internship', entrepreneurship: 'Entrepreneurship', debate_mun: 'Debate / MUN', coding_projects: 'Coding projects', other: 'Other' };
    // Qualifications (mirror of server/admQual.js — the server's /api/admissions/meta replaces this when it loads)
    var QUALS = {
        ib: { name: 'IB Diploma', short: 'IB', unit: 'points', axis: [24, 45], step: 1 }, a_levels: { name: 'A Levels', short: 'A Levels', kind: 'grades', axis: [3, 6] },
        gpa_us: { name: 'US GPA (unweighted, 4.0)', short: 'GPA', axis: [2.5, 4], step: .01 }, gpa_us_w: { name: 'US GPA (weighted, 5.0)', short: 'Weighted GPA', axis: [3, 5], step: .01 },
        pct: { name: 'Percentage (school average)', short: '%', unit: '%', axis: [60, 100], step: .1 }, es_bach: { name: 'Spanish Bachillerato (0–10)', short: 'Bachillerato', axis: [6, 10], step: .01 },
        es_pau: { name: 'Spanish PAU / EvAU (0–14)', short: 'PAU', axis: [8, 14], step: .001 }, fr_bac: { name: 'French Baccalauréat (0–20)', short: 'Bac', axis: [10, 20], step: .01 },
        it_maturita: { name: 'Italian Maturità (60–100)', short: 'Maturità', axis: [60, 100], step: 1 }, de_abitur: { name: 'German Abitur (1.0–4.0)', short: 'Abitur', axis: [1, 3], step: .1, lowerIsBetter: true },
        nl_vwo: { name: 'Dutch VWO average (1–10)', short: 'VWO', axis: [6, 10], step: .01 }, ch_matura: { name: 'Swiss Matura (1–6)', short: 'Matura', axis: [4, 6], step: .01 },
        pt_sec: { name: 'Portuguese Secundário (0–20)', short: 'Secundário', axis: [10, 20], step: .1 }, ie_lc: { name: 'Irish Leaving Cert (CAO points)', short: 'CAO', axis: [350, 625], step: 1 },
        ua_nmt: { name: 'Ukrainian NMT (100–200)', short: 'NMT', axis: [130, 200], step: .1 }, p10: { name: 'Other — out of 10', short: '/10', axis: [6, 10], step: .01 },
        p20: { name: 'Other — out of 20', short: '/20', axis: [10, 20], step: .01 }, uk_degree: { name: 'UK degree classification', short: 'UK degree', axis: [1, 4] }, other: { name: 'Other qualification', short: 'Other', kind: 'text' }
    };
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function lsJSON(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
    function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
    function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
    function day(t) { var d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    function num(v) { return Number(v).toLocaleString('en-GB'); }
    function token() { try { return localStorage.getItem('us_session_token') || ''; } catch (e) { return ''; } }
    function req(method, path, body) {
        var h = {}; if (body) h['content-type'] = 'application/json';
        var t = token(); if (t) h.authorization = 'Bearer ' + t;
        return fetch(API + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined }).then(function (r) {
            return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.message || 'That didn\'t work — try again.'); e.status = r.status; e.data = j; throw e; } return j; });
        });
    }
    fetch(API + '/api/admissions/meta').then(function (r) { return r.json(); }).then(function (m) { (m.qualifications || []).forEach(function (q) { QUALS[q.code] = q; }); }).catch(function () {});

    /* ── A-level ordinal (same as the server: mean of best three, A*=6 … E=1) ── */
    var AL = { 'A*': 6, A: 5, B: 4, C: 3, D: 2, E: 1 }, AL_BACK = ['U', 'E', 'D', 'C', 'B', 'A', 'A*'];
    function alLabel(v) { var n = Math.round(v * 3), a = Math.floor(n / 3), r = n - a * 3, g = ''; for (var i = 0; i < 3; i++) g += AL_BACK[Math.min(6, a + (i < r ? 1 : 0))]; return g; }
    function alNum(s) { var gs = String(s || '').toUpperCase().replace(/\s|,/g, '').match(/A\*|[ABCDE]/g); if (!gs || gs.length < 2) return null; var v = gs.map(function (g) { return AL[g]; }).sort(function (a, b) { return b - a; }).slice(0, 3); return v.reduce(function (a, b) { return a + b; }, 0) / v.length; }
    function scoreNum(q, s) { if (s == null || s === '') return null; if (q === 'a_levels') return alNum(s); if (q === 'uk_degree') return { first: 4, '2:1': 3, '2:2': 2, third: 1 }[String(s).toLowerCase()] || null; var v = parseFloat(String(s).replace(',', '.')); return isFinite(v) ? v : null; }
    function scoreLabel(q, s) { if (s == null || s === '') return ''; if (q === 'ib') return s + ' IB'; if (q === 'pct') return s + '%'; if (q === 'gpa_us' || q === 'gpa_us_w') return 'GPA ' + s; if (q === 'a_levels' || q === 'uk_degree' || q === 'other') return String(s); var d = QUALS[q] || {}; return (d.short || '') + ' ' + s; }
    function fmtAxis(q, v) { if (q === 'a_levels') return alLabel(v); if (q === 'uk_degree') return ['', 'Third', '2:2', '2:1', 'First'][Math.round(v)] || ''; var st = (QUALS[q] || {}).step || 1; return st >= 1 ? String(Math.round(v)) : String(Math.round(v * 100) / 100); }

    /* ═══ the grade you entered on this page ═══ */
    function chancesProfile() {
        var s = lsJSON('us_ch_state_' + UID, {});
        if (s.sys === 'alevels' && Array.isArray(s.al) && s.al.length === 3) return { qualification: 'a_levels', score: s.al.join('') };
        if (s.val == null || s.val === '' || isNaN(+s.val)) return null;
        if (s.sys === 'ib') return { qualification: 'ib', score: String(Math.round(+s.val)) };
        if (s.sys === 'gpa') return { qualification: 'gpa_us', score: (+s.val).toFixed(2) };
        if (s.sys === 'pct') return { qualification: 'pct', score: String(Math.round(+s.val * 10) / 10) };
        return null;
    }

    /* ═══ server data ══════════════════════════════════════════════ */
    var cache = {};
    function fetchStats(cc, id, o, fresh) {
        o = o || {};
        var qs = 'cc=' + encodeURIComponent(cc) + '&uniId=' + encodeURIComponent(id) + (o.level && o.level !== 'all' ? '&level=' + o.level : '') + (o.verified ? '&verified=1' : '') + '&limit=' + (o.limit || 150) + (o.offset ? '&offset=' + o.offset : '');
        var hit = cache[qs];
        if (hit && !fresh && Date.now() - hit.t < 60e3) return hit.p;
        var p = req('GET', '/api/admissions/stats?' + qs).catch(function (e) { return { ok: false, offline: true, points: [], summary: {}, official: [], requirements: [], scholarships: [], qualifications: [] }; });
        cache[qs] = { t: Date.now(), p: p };
        return p;
    }
    function bust() { cache = {}; }

    /* ═══ the chart: lanes by decision, in the qualification's own units ═══ */
    function axisFor(q, values) {
        var d = QUALS[q] || { axis: [0, 100] }, lo = d.axis[0], hi = d.axis[1];
        values.forEach(function (v) { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
        var dmin = Math.min.apply(null, values.filter(function (v) { return v != null; }).concat([d.axis[1]]));
        if (q === 'ib') { lo = Math.max(0, Math.floor(Math.min(dmin - 3, 40) / 2) * 2); hi = 45; }
        else if (q === 'pct' || q === 'it_maturita') { lo = Math.max(0, Math.floor(lo / 10) * 10 - 0); hi = 100; }
        else if (q === 'a_levels') { lo = Math.max(1, Math.floor(lo)); hi = 6; }
        return { lo: lo, hi: hi, rev: !!d.lowerIsBetter };
    }
    function ticksFor(q, ax) {
        var span = ax.hi - ax.lo, steps = q === 'a_levels' ? 1 : span <= 2 ? .25 : span <= 5 ? .5 : span <= 12 ? 1 : span <= 25 ? 2 : span <= 60 ? 5 : span <= 120 ? 10 : 50, out = [];
        for (var v = Math.ceil(ax.lo / steps) * steps; v <= ax.hi + 1e-9; v += steps) out.push(Math.round(v * 1000) / 1000);
        while (out.length > 9) out = out.filter(function (_, i) { return i % 2 === 0; });
        return out;
    }
    function chart(points, q, you, marks, opts) {
        opts = opts || {};
        var vals = points.map(function (p) { return p.s; }).concat(you != null ? [you] : []).concat((marks || []).map(function (m) { return m.v; }));
        var ax = axisFor(q, vals);
        var x = function (v) { var f = (v - ax.lo) / ((ax.hi - ax.lo) || 1); if (ax.rev) f = 1 - f; return (Math.max(0, Math.min(1, f)) * 100).toFixed(2) + '%'; };
        var lanes = opts.mini ? [['all', '']] : [['accepted', 'Accepted'], ['waitlisted', 'Waitlisted'], ['rejected', 'Rejected']];
        var html = '<div class="oc-chart' + (opts.mini ? ' oc-chart--mini' : '') + '">';
        lanes.forEach(function (ln) {
            var pts = points.filter(function (p) { return ln[0] === 'all' || p.r === ln[0]; });
            html += '<div class="oc-lane oc-lane--' + ln[0] + '">' + (ln[1] ? '<span class="oc-lane__l">' + ln[1] + ' <em>' + pts.length + '</em></span>' : '') + '<div class="oc-lane__track">' +
                pts.map(function (p, i) {
                    var dc = DEC[p.r] || DEC.accepted, j = (hash(p.id) % 60) - 30;
                    var tip = dc[0] + ' · ' + (p.sl || '') + (p.p ? ' · ' + p.p : '') + (p.yr ? ' · ' + p.yr : '') + ' · ' + (p.v ? 'verified' : p.src) + (p.c === 'low' ? ' · low confidence' : '');
                    return '<i class="oc-dot oc-dot--' + dc[2] + (p.v ? ' is-v' : '') + (p.c === 'low' ? ' is-low' : '') + '" style="left:' + x(p.s) + ';--j:' + j + '%;--k:' + Math.min(i, 30) + '" tabindex="0" data-tip="' + esc(tip) + '"></i>';
                }).join('') + '</div></div>';
        });
        html += '<div class="oc-marks">' + (marks || []).map(function (m) { return '<span class="oc-mark oc-mark--est" style="left:' + x(m.v) + '"><b>' + esc(m.label) + '</b></span>'; }).join('') +
            (you != null ? '<span class="oc-mark oc-mark--you" style="left:' + x(you) + '"><b>You · ' + esc(fmtAxis(q, you)) + '</b></span>' : '') + '</div>';
        var near = function (t) { return you != null && Math.abs(parseFloat(x(t)) - parseFloat(x(you))) < 4; };   // keep the "You" label readable
        html += '<div class="oc-axis">' + ticksFor(q, ax).filter(function (t) { return !near(t); }).map(function (t) { return '<span style="left:' + x(t) + '">' + esc(fmtAxis(q, t)) + '</span>'; }).join('') + '</div></div>';
        return html;
    }

    /* ═══ Chances page section ═════════════════════════════════════ */
    var sec = $('chReal'), ctx = { uni: null, cc: null, level: 'all', qual: null, sys: null, val: null, field: '', degree: 'bachelor', extra: [] };
    function youProfile() { var p = chancesProfile(); return p ? { qualification: p.qualification, score: p.score, num: scoreNum(p.qualification, p.score), approx: p.approx } : null; }
    function sectionShell(u, inner, officialOnly) {
        return '<header class="oc__hd"><div><p class="oc__k"><i class="fa-solid fa-users"></i> Students like you</p><h3>Real results at <em>' + esc(u.abbr && u.abbr.length < 14 ? u.abbr : u.name) + '</em></h3>' +
            '<p class="oc__sub">' + (officialOnly ? 'Official figures, as published by the university.' : 'Official figures and what real applicants reported publicly — kept apart and labelled.') + '</p></div></header>' + inner;
    }
    function officialPanel(d) {
        var f = ctx.field, rank = function (x) { return x.program && f && FIELD[f] && new RegExp(f === 'cs' ? 'comput' : f === 'finance' ? 'business|econom|financ' : f.slice(0, 5), 'i').test(x.program) ? 0 : x.program ? 1 : 2; };
        var stats = (d.official || []).slice().sort(function (a, b) { return rank(a) - rank(b); }).slice(0, 4), reqs = (d.requirements || []).slice().sort(function (a, b) { return rank(a) - rank(b); }).slice(0, 3);
        var sch = (d.scholarships || []).filter(function (s) { return s.sourceType === 'official'; }).slice(0, 2);
        if (!stats.length && !reqs.length && !sch.length) return '';
        var src = function (s) { return s && s.url ? ' <a class="oc-link" href="' + esc(s.url) + '" target="_blank" rel="noopener">source</a>' : ''; };
        var li = stats.map(function (s) {
            var bits = [];
            if (s.applications != null) bits.push(num(s.applications) + ' applications');
            if (s.offers != null) bits.push(num(s.offers) + ' offers');
            if (s.admitted != null) bits.push(num(s.admitted) + ' admitted');
            if (s.offerRate != null) bits.push('<b>' + s.offerRate + '%</b> ' + (s.offers != null ? 'offer' : 'admit') + ' rate');
            if (s.places != null) bits.push(num(s.places) + ' places');
            if (s.scoreMeasure) bits.push(esc(s.scoreMeasure) + ' middle 50%: <b>' + s.p25 + '–' + s.p75 + '</b>');
            return '<li><span><b>' + esc(s.program || 'All programmes') + '</b> · ' + esc(s.cycle || '') + '</span><span>' + bits.join(' · ') + src(s.source) + '</span></li>';
        }).concat(reqs.map(function (r) {
            var bits = [];
            if (r.typicalOffer) bits.push((QUALS[r.qualification] ? QUALS[r.qualification].short + ': ' : '') + esc(r.typicalOffer));
            if (r.tests && r.tests.length) bits.push(esc(r.tests.map(function (t) { return String(t).replace('|', ' or '); }).join(', ')) + ' required');
            if (r.language && Object.keys(r.language).length) bits.push(Object.keys(r.language).map(function (k) { return esc(k + ' ' + r.language[k]); }).join(' / '));
            if (r.deadline) bits.push('deadline ' + day(r.deadline)); else if (r.deadlineNote) bits.push(esc(r.deadlineNote));
            return '<li><span><b>' + esc(r.program || 'Entry requirements') + '</b> · requirement</span><span>' + bits.join(' · ') + src(r.source) + '</span></li>';
        })).concat(sch.map(function (s) {
            var amt = s.amountMin != null ? (s.currency || '') + ' ' + num(s.amountMin) + (s.amountMax ? '–' + num(s.amountMax) : '') : s.percentage ? s.percentage + '% of tuition' : '';
            return '<li><span><b>' + esc(s.name) + '</b> · scholarship</span><span>' + esc([amt, s.eligibility].filter(Boolean).join(' · ')) + src(s.source) + '</span></li>';
        }));
        var dates = stats.concat(reqs).map(function (x) { return x.collected; }).filter(Boolean).sort();
        return '<div class="oc-off"><div class="oc-off__hd"><span class="oc-src oc-src--official"><i class="fa-solid fa-building-columns"></i> Official</span><small>Published by the university' + (dates.length ? ' · collected ' + day(dates[dates.length - 1]) : '') + '</small></div><ul>' + li.join('') + '</ul></div>';
    }
    function statTiles(d, q) {
        var s = d.summary || {}, n = s.n || 0, a = s.accepted || 0, w = s.waitlisted || 0, r = s.rejected || 0, o = s.other || 0;
        var seg = function (v, c) { return n ? '<i class="oc-seg oc-seg--' + c + '" style="flex:' + v + '"></i>' : ''; };
        var qs = (d.qualifications || []).filter(function (x) { return x.qualification === q; })[0], acc = qs && qs.accepted;
        var range = acc && acc.p25 != null ? [fmtAxis(q, acc.p25), fmtAxis(q, acc.p75)] : acc && acc.min != null ? [fmtAxis(q, acc.min), fmtAxis(q, acc.max)] : null;
        var unit = q === 'ib' ? ' IB' : q === 'pct' ? '%' : '';
        return '<div class="oc-stats">' +
            '<div class="oc-stat"><span>Applicants in our data</span><b>' + n + '</b><div class="oc-split">' + seg(a, 'good') + seg(w, 'warn') + seg(r, 'bad') + seg(o, 'mute') + '</div><small>' + a + ' accepted · ' + r + ' rejected · ' + w + ' waitlisted' + (o ? ' · ' + o + ' other' : '') + '</small></div>' +
            '<div class="oc-stat"><span>Accepted applicants had</span><b>' + (range ? esc(range[0] === range[1] ? range[0] : range[0] + '–' + range[1]) + '<em>' + esc(unit) + '</em>' : '—') + '</b><small>' +
                (range ? (acc.p25 != null ? 'middle half of ' : 'range of ') + acc.n + ' accepted · ' + esc((QUALS[q] || {}).short || '') : q ? 'not enough ' + esc((QUALS[q] || {}).short || '') + ' results yet' : 'no scores reported yet') + '</small></div>' +
            '<div class="oc-stat"><span>Where it comes from</span><b>' + (s.public_self_report || 0) + '<em> public reports</em></b><small>from applicants\' own posts · each checked twice</small></div>' +
            '<div class="oc-stat"><span>With a scholarship</span><b>' + (s.scholarships || 0) + '</b><small>' + ((d.scholarships || []).filter(function (x) { return x.sourceType === 'official'; }).length ? (d.scholarships || []).filter(function (x) { return x.sourceType === 'official'; }).length + ' official scheme(s) listed above' : 'reported by applicants') + '</small></div></div>';
    }
    function cards(pts) {
        return '<div class="oc-cards">' + pts.slice(0, 6).map(function (p, i) {
            var dc = DEC[p.r] || DEC.accepted, src = SRC[p.st] || SRC.user_reported;
            var extra = Object.keys(p.t || {}).map(function (k) { return k + ' ' + p.t[k]; }).concat(Object.keys(p.lg || {}).map(function (k) { return k + ' ' + p.lg[k]; }));
            var ach = p.a == null ? 'Achievements: not reported' : p.a.length ? p.a.map(function (t) { return TAGS[t] || t; }).join(' · ') : 'No achievements listed';
            return '<article class="oc-card oc-card--' + dc[2] + '" style="--k:' + i + '"><div class="oc-card__top"><span class="oc-dec oc-dec--' + dc[2] + '"><i class="fa-solid ' + dc[1] + '"></i>' + dc[0] + '</span>' +
                '<span class="oc-src oc-src--' + esc(p.st) + '" title="' + esc(p.src) + '"><i class="fa-solid ' + src[1] + '"></i> ' + src[0] + '</span></div>' +
                '<b class="oc-card__g">' + (p.sl ? esc(p.sl) : '<span class="oc-card__nog">Grade not reported</span>') + (extra.length ? '<small>' + esc(extra.join(' · ')) + '</small>' : '') + '</b>' +
                '<p>' + esc([p.p, LEVEL[p.l] || '', p.y ? 'intake ' + p.y : ''].filter(Boolean).join(' · ') || 'Programme not reported') + '</p>' +
                '<small>' + esc(ach) + (p.sch === 'received' ? ' · scholarship' : '') + '</small>' +
                '<small class="oc-card__src">' + esc(p.src) + ' · ' + p.yr + (p.c === 'low' ? ' · <span class="oc-low">low confidence</span>' : '') + '</small></article>';
        }).join('') + '</div>';
    }
    // only shown when there really are comparable applicants — no "not enough data" filler
    function likeBlock(c) {
        if (!c || c.needProfile || !(c.comparable || {}).n) return '';
        var k = c.comparable || {}, rel = c.reliability;
        var tag = rel === 'ok' ? '<span class="oc-rel oc-rel--ok">Based on ' + k.n + ' applicants</span>' : rel === 'small' ? '<span class="oc-rel oc-rel--small">Small sample</span>' : '<span class="oc-rel oc-rel--none">Not enough data</span>';
        return '<div class="oc-like"><i class="fa-solid fa-user-group"></i><div><b>People similar to your profile ' + tag + '</b>' +
            '<p class="oc-like__on">' + esc(c.matchedOn.join(' · ')) + '</p>' +
            (k.n ? '<p class="oc-like__n"><b>' + k.n + '</b> applicant' + (k.n === 1 ? '' : 's') + ' in our data · <b class="g">' + k.accepted + '</b> accepted · <b class="r">' + k.rejected + '</b> rejected' + (k.waitlisted ? ' · ' + k.waitlisted + ' waitlisted' : '') + (k.other ? ' · ' + k.other + ' other' : '') + '</p>' : '') +
            (c.message ? '<p>' + esc(c.message) + '</p>' : '') +
            (c.position ? '<p>Your ' + esc(c.profile.label) + ' is higher than <b>' + c.position.pctBelow + '%</b> of the scores accepted applicants reported (' + c.position.n + ').</p>' : '') + '</div></div>';
    }
    var renderT = 0, lastCompare = null;
    function renderSection(fresh) {
        if (!sec) return;
        clearTimeout(renderT);
        renderT = setTimeout(function () {
            var u = ctx.uni;
            if (!u) { sec.hidden = false; sec.innerHTML = '<div class="oc-empty oc-empty--top"><i class="fa-solid fa-users"></i><div><b>Students like you</b><p>Pick a university above to see official figures and real admission results.</p></div></div>'; return; }
            if (!sec.querySelector('.oc__hd') || sec.getAttribute('data-for') !== ctx.cc + ':' + u.id) sec.innerHTML = sectionShell(u, '<div class="oc-skel"><i></i><i></i><i></i></div>');
            sec.setAttribute('data-for', ctx.cc + ':' + u.id);
            var you = youProfile();
            Promise.all([fetchStats(ctx.cc, u.id, { level: ctx.level }, fresh), compareFor(u, you)]).then(function (r) {
                if (!ctx.uni || ctx.uni.id !== u.id) return;
                var d = r[0], cmp = r[1];
                var all = (d.points || []).concat(ctx.extra || []);
                var quals = {}; all.forEach(function (p) { if (p.q && p.s != null && DEC[p.r] && ['accepted', 'waitlisted', 'rejected'].indexOf(p.r) !== -1) quals[p.q] = (quals[p.q] || 0) + 1; });
                var qList = Object.keys(quals).sort(function (a, b) { return quals[b] - quals[a]; });
                var q = ctx.qual && quals[ctx.qual] ? ctx.qual : you && quals[you.qualification] ? you.qualification : qList[0] || (you && you.qualification) || null;
                var pts = all.filter(function (p) { return p.q === q && p.s != null && ['accepted', 'waitlisted', 'rejected'].indexOf(p.r) !== -1; });
                var marks = (d.requirements || []).filter(function (x) { return x.qualification === q && x.minScoreNum != null; }).slice(0, 1).map(function (x) { return { v: x.minScoreNum, label: (x.typicalOffer && /typical/i.test(x.typicalOffer) === false && /minimum|entry level/i.test(x.typicalOffer) ? 'Official minimum ' : 'Typical offer ') + fmtAxis(q, x.minScoreNum) }; });
                var youV = you && you.qualification === q ? you.num : null;
                var qSeg = qList.length > 1 ? '<div class="oc-seg" role="group" aria-label="Qualification">' + qList.slice(0, 5).map(function (k) { return '<button type="button" data-oc-qual="' + k + '" class="' + (k === q ? 'is-on' : '') + '">' + esc((QUALS[k] || {}).short || k) + ' <small>' + quals[k] + '</small></button>'; }).join('') + '</div>' : '';
                var filters = '<div class="oc-filters"><div class="oc-filters__l"><div class="oc-seg" role="group" aria-label="Level">' + [['all', 'All'], ['bachelor', 'Bachelor\'s'], ['master', 'Master\'s'], ['phd', 'PhD']].map(function (o) { return '<button type="button" data-oc-level="' + o[0] + '" class="' + (ctx.level === o[0] ? 'is-on' : '') + '">' + o[1] + '</button>'; }).join('') + '</div>' + qSeg + '</div>' +
                    '</div>';
                var hint = you && q && you.qualification !== q && quals[you.qualification] ? '<p class="oc-none">Your grade is in ' + esc((QUALS[you.qualification] || {}).short) + ' — <button type="button" class="oc-link" data-oc-qual="' + you.qualification + '">compare in ' + esc((QUALS[you.qualification] || {}).short) + '</button>. Scores from different systems are never mixed.</p>' : '';
                var body;
                if (d.offline) body = '<div class="oc-empty"><i class="fa-solid fa-plug-circle-xmark"></i><div><b>Admissions data is offline</b><p>Try again in a bit.</p></div></div>';
                else if (!(d.summary || {}).n && !ctx.extra.length) {
                    // no applicant results yet: show only the official figures, or nothing at all
                    var off = officialPanel(d);
                    sec.hidden = !off;
                    sec.innerHTML = off ? sectionShell(u, off, true) : '';
                    return;
                } else {
                    body = officialPanel(d) + statTiles(d, q) + '<div class="oc-panel">' + filters + likeBlock(cmp) + hint +
                        (q ? chart(pts, q, youV, marks) : '') + (pts.length ? '' : '<p class="oc-none">No ' + esc((QUALS[q] || {}).short || '') + ' scores match these filters.</p>') + '</div>' +
                        cards(all.filter(function (p) { return ctx.level === 'all' || p.l === ctx.level; })) +
                        (d.page && d.page.more ? '<p class="oc-more"><button type="button" class="oc-btn oc-btn--ghost oc-btn--sm" data-oc-more>Load more results</button></p>' : '');
                }
                sec.hidden = false;
                sec.innerHTML = sectionShell(u, body +
                    '<p class="oc-note"><i class="fa-regular fa-circle-question"></i> Applicant results come from public posts, not official statistics. Low-confidence reports are left out of ranges; small samples can mislead.</p>');
                if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(sec);
            });
        }, 120);
    }
    // "people like you" + the meter line share one request
    var cmpCache = {};
    function compareFor(u, you) {
        if (!u) return Promise.resolve(null);
        if (!you || you.num == null) { meterLine({ needProfile: true }); return Promise.resolve({ needProfile: true }); }
        var body = { cc: ctx.cc, uniId: u.id, field: ctx.field || null, level: ctx.degree || null, profile: { qualification: you.qualification, score: you.score } };
        var k = JSON.stringify(body);
        if (!cmpCache[k] || Date.now() - cmpCache[k].t > 60e3) cmpCache[k] = { t: Date.now(), p: req('POST', '/api/admissions/compare', body).catch(function () { return null; }) };
        return cmpCache[k].p.then(function (c) { lastCompare = c; meterLine(c, you); return c; });
    }
    function meterLine(c, you) {
        var el = $('chMeterData'); if (!el) return;
        if (!c) { el.textContent = ''; return; }
        if (c.needProfile || !(c.comparable || {}).n) { el.innerHTML = ''; return; }
        var k = c.comparable || {}, decided = k.accepted + k.rejected + k.waitlisted, rng = c.matchedOn[c.matchedOn.length - 1 - (c.matchedOn[c.matchedOn.length - 1] === 'same level' ? 1 : 0)];
        el.innerHTML = '<i class="fa-solid fa-users" aria-hidden="true"></i> ' + (c.acceptedShare ? 'In our data, <b>' + c.acceptedShare.accepted + ' of ' + c.acceptedShare.decided + '</b> comparable applicants (' + esc(rng) + ') were accepted — real outcomes, not a probability.'
            : decided >= 5 ? '<b>' + decided + '</b> comparable applicants (' + esc(rng) + '): ' + k.accepted + ' accepted, ' + k.rejected + ' rejected. Small sample — read with care.'
                : 'Not enough data for a reliable estimate — ' + (k.n ? 'only ' + k.n + ' comparable applicant' + (k.n === 1 ? '' : 's') : 'no comparable applicants') + ' in our data so far.');
    }
    document.addEventListener('chances:state', function (e) {
        var d = e.detail || {}, u = d.uni;
        ctx.uni = u; ctx.cc = (d.cc || (u && u.cc) || '').toLowerCase(); ctx.sys = d.sys; ctx.val = d.val; ctx.field = d.field || ''; ctx.degree = d.degree || 'bachelor';
        renderSection(false);
    });
    if (sec) sec.addEventListener('click', function (e) {
        var l = e.target.closest('[data-oc-level]'); if (l) { ctx.level = l.getAttribute('data-oc-level'); ctx.extra = []; renderSection(false); return; }
        var qb = e.target.closest('[data-oc-qual]'); if (qb) { ctx.qual = qb.getAttribute('data-oc-qual'); renderSection(false); return; }
        if (e.target.closest('[data-oc-more]')) {
            var u = ctx.uni, have = (sec.querySelectorAll('.oc-dot').length);
            fetchStats(ctx.cc, u.id, { level: ctx.level, offset: 150 + ctx.extra.length, limit: 150 }, true).then(function (d) { ctx.extra = ctx.extra.concat(d.points || []); renderSection(false); });
            return;
        }
    });

    /* ═══ university popup: one line + a mini chart ═══════════════ */
    var udxU = null;
    function refreshMini() {
        var box = $('udmOutcomes'); if (!box || !udxU) return;
        var u = udxU, cc = String(u.country_code || u.cc || (typeof currentCountryCode !== 'undefined' ? currentCountryCode : '')).toLowerCase();
        fetchStats(cc, u.id, {}).then(function (d) {
            if (udxU !== u) return;
            box.hidden = !!d.offline; if (d.offline) return;
            var s = d.summary || {}, off = (d.official || []).filter(function (x) { return x.offerRate != null; })[0];
            var you = youProfile(), quals = {}; (d.points || []).forEach(function (p) { if (p.q && p.s != null && ['accepted', 'waitlisted', 'rejected'].indexOf(p.r) !== -1) quals[p.q] = (quals[p.q] || 0) + 1; });
            var q = you && quals[you.qualification] ? you.qualification : Object.keys(quals).sort(function (a, b) { return quals[b] - quals[a]; })[0];
            var pts = (d.points || []).filter(function (p) { return p.q === q && p.s != null && ['accepted', 'waitlisted', 'rejected'].indexOf(p.r) !== -1; });
            var parts = [];
            if (s.n) parts.push(s.n + ' applicant' + (s.n === 1 ? '' : 's') + ' in our data · ' + (s.accepted || 0) + ' accepted' + (s.verified ? ' · ' + s.verified + ' verified' : ''));
            if (off) parts.push('official: ' + off.offerRate + '% ' + (off.offers != null ? 'offer' : 'admit') + ' rate' + (off.program ? ' (' + off.program + ', ' + off.cycle + ')' : ' (' + off.cycle + ')'));
            box.innerHTML = '<div class="oc-mini__hd"><span class="oc-mini__ic"><i class="fa-solid fa-users"></i></span><div><b>Admissions data</b><small>' + esc(parts.join(' · ') || 'No applicant results yet') + '</small></div>' +
                '</div>' + (pts.length ? chart(pts, q, you && you.qualification === q ? you.num : null, [], { mini: true }) : '');
        });
    }
    if (typeof window.showUniDetail === 'function') {
        var orig = window.showUniDetail;
        window.showUniDetail = function (u) { var r = orig.apply(this, arguments); udxU = u; try { refreshMini(); } catch (e) {} return r; };
        try { showUniDetail = window.showUniDetail; } catch (e) {}
    }

    /* tooltips for the dots (keyboard too) */
    var tip = null;
    function showTip(el) {
        if (!tip) { tip = document.createElement('div'); tip.className = 'oc-tip'; document.body.appendChild(tip); }
        tip.textContent = el.getAttribute('data-tip'); var r = el.getBoundingClientRect();
        tip.style.left = Math.max(8, Math.min(innerWidth - 8 - tip.offsetWidth, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px'; tip.style.top = (r.top - tip.offsetHeight - 8) + 'px'; tip.classList.add('is-on');
    }
    document.addEventListener('mouseover', function (e) { var d = e.target.closest && e.target.closest('.oc-dot'); if (d) showTip(d); else if (tip) tip.classList.remove('is-on'); });
    document.addEventListener('focusin', function (e) { var d = e.target.closest && e.target.closest('.oc-dot'); if (d) showTip(d); });
    window.addEventListener('scroll', function () { if (tip) tip.classList.remove('is-on'); }, { passive: true });

    if (sec) renderSection(false);
})();
