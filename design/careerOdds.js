/* ════════════════════════════════════════════════════════════════════
   Career odds — "what are my chances of getting THIS job, at THIS company,
   for THIS salary?"  window.openCareerOdds(companyName[, {role, salary}]).

   The model is a hiring funnel, the way recruiting data is reported:
       P(offer ≥ salary) = P(CV screen) × P(interviews → offer) × P(pay ≥ target | offer)

   1. Base rates. The share of applicants a company hires falls steeply with
      how selective it is (`sel` in careers_data.js), anchored on published
      figures: Goldman Sachs took ~0.7% of 360k intern applicants in 2025,
      McKinsey ~1% of ~200k a year, big graduate schemes a few percent.
      That overall rate is split into a screen stage and an interview stage.
   2. The student's profile moves each stage by odds ratios (log-odds add up):
      – referral: referred applicants reach interview ~40% of the time vs ~3%
        for cold applications, and convert interviews to offers 16% vs 6%
        (Ashby, 2021–24) — we use a cautious ×6 / ×2;
      – interned at the company: NACE reports 62–72% of interns get a
        full-time offer, so the funnel starts from there instead;
      – grades: under 40% of employers screen on GPA, most at 3.0 (NACE Job
        Outlook 2025) — below the bar hurts a lot at selective firms, a little
        elsewhere;
      – university (target/feeder school or its tier), subject fit, degree
        level for the role, internships, full-time experience, projects,
        interview practice (more real/mock interviews → higher pass rates,
        interviewing.io / Triplebyte), visa sponsorship (US H-1B lottery
        selected 25–35% of registrations in FY24–26) and the local language.
   3. Pay. Offers for a role are spread around the company's early-career
      figure (log-normal, σ≈0.14); degree, experience and standout work shift
      it up, and negotiating adds ~5% (CMU: negotiators gained 7.4% on
      average). P(pay ≥ target) comes from that curve.
   Everything is an estimate and labelled as one. Answers are remembered per
   user (us_car_profile_<uid>); saved results (us_car_saved_<uid>) show on
   the Overview in the "Career paths" box (window.renderSavedCareers).
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var api = window.crsApi;
    if (!api) return;
    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function uid() { try { return (window.user && window.user.id) || 'guest'; } catch (e) { return 'guest'; } }
    function lsGet(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
    function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function savedKey() { return 'us_car_saved_' + uid(); }
    function profKey() { return 'us_car_profile_' + uid(); }
    function getSaved() { var a = lsGet(savedKey(), []); return Array.isArray(a) ? a : []; }
    function findSaved(name) { return getSaved().find(function (x) { return x.co === name; }) || null; }

    /* ── Money ─────────────────────────────────────────────────────── */
    var SYM = { USD: '$', EUR: '€', GBP: '£', SEK: 'SEK ', DKK: 'DKK ', CHF: 'CHF ' };
    function parsePay(str) {
        var s = String(str || ''), nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat);
        if (!nums.length) return null;
        var cur = /£/.test(s) ? 'GBP' : /€/.test(s) ? 'EUR' : /SEK/.test(s) ? 'SEK' : /DKK/.test(s) ? 'DKK' : /CHF/.test(s) ? 'CHF' : 'USD';
        var v = (nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0]) * (/k/i.test(s) ? 1000 : 1);
        if (/\/mo/.test(s)) v *= 12;                  // Danish figures are monthly
        if (/\+/.test(s)) v *= 1.05;
        return { cur: cur, v: v };
    }
    function money(v, cur) {
        var k = v / 1000;
        return (SYM[cur] || '$') + (k >= 100 ? Math.round(k) : Math.round(k * 2) / 2).toLocaleString('en') + 'k';
    }
    function niceStep(v) { var raw = v / 120, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 2 ? 1 : m < 5 ? 2 : 5) * p; }

    /* ── What kind of role is it? ──────────────────────────────────── */
    function roleKind(role) {
        var r = String(role || '');
        if (/quant|research|scientist|\bml\b|machine|deep learning|r&d|physicist|actuar/i.test(r)) return 'research';
        if (/engineer|developer|\bdev\b|devops|firmware|chip|asic|game/i.test(r)) return 'eng';
        if (/trainee|manager|buyer|store|operations/i.test(r)) return 'mgmt';
        if (/design/i.test(r)) return 'design';
        return 'biz';                                   // analyst, associate, consultant, auditor, trader…
    }
    var ROLE_PAY = { research: 1.1, eng: 1, biz: .97, mgmt: .9, design: .94 };
    var LANG = { de: 'German', fr: 'French', it: 'Italian', es: 'Spanish', pt: 'Portuguese', nl: 'Dutch', se: 'Swedish', dk: 'Danish', fi: 'Finnish', ua: 'Ukrainian', ch: 'German or French', be: 'Dutch or French', tw: 'Mandarin' };

    /* ── The model ─────────────────────────────────────────────────── */
    function logit(p) { return Math.log(p / (1 - p)); }
    function inv(x) { return 1 / (1 + Math.exp(-x)); }
    function erf(x) {                                   // Abramowitz–Stegun 7.1.26
        var s = x < 0 ? -1 : 1; x = Math.abs(x);
        var t = 1 / (1 + .3275911 * x);
        return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x));
    }
    function phi(z) { return .5 * (1 + erf(z / Math.SQRT2)); }
    var TIER_OR = { 5: 1.6, 4: 1.25, 3: 1, 2: .8, 1: .65 };

    // Odds ratios for each answer: s = CV-screen stage, i = interview stage.
    function factors(c, a, kind) {
        var sel = c.sel || .5, strict = sel >= .7, cc = api.companyCC(c), f = [];
        function add(key, label, s, i) { if ((s || 1) !== 1 || (i || 1) !== 1) f.push({ key: key, label: label, s: s || 1, i: i || 1 }); }
        if (a.ref) add('ref', 'Referral', 6, 2);
        add('intern', 'Internships', a.intern === '2' ? 2.6 : a.intern === '1' ? 1.8 : 1, a.intern === '2' ? 1.45 : a.intern === '1' ? 1.25 : 1);
        add('grades', 'Grades', { top: 1.7, strong: 1.25, solid: 1, below: strict ? .25 : .6 }[a.grades] || 1, a.grades === 'top' ? 1.1 : 1);
        var uni = a.uni ? api.resolveUni(a.uni) : null;
        if (uni) {
            var tier = TIER_OR[uni.tier] || 1, target = api.isTarget(uni, c) ? (sel >= .75 ? 2.4 : 1.6) : 0;
            add('uni', target ? 'Target school' : 'University', Math.max(tier, target), 1);
        }
        if (a.field) {
            var any = c.degrees.some(function (d) { return /any/i.test(d); }), r = api.subjectRel(c, a.field);
            add('field', 'Subject fit', any ? Math.max(1, .35 + .85 * r) : .35 + .85 * r, 1);
        }
        if (kind === 'research') add('degree', 'Degree level', { PhD: 3, Master: 1.6, Bachelor: .6 }[a.degree], { PhD: 1.3, Master: 1.1, Bachelor: 1 }[a.degree]);
        else add('degree', 'Degree level', a.degree === 'Master' ? 1.15 : a.degree === 'PhD' ? (kind === 'biz' ? .8 : 1) : 1, 1);
        add('exp', 'Work experience', a.exp === '3' ? 1.4 : a.exp === '1' ? 1.3 : 1, a.exp === '3' ? 1.15 : a.exp === '1' ? 1.1 : 1);
        add('proj', 'Projects & wins', { none: .85, some: 1.2, standout: 1.9 }[a.proj], { none: 1, some: 1.08, standout: 1.3 }[a.proj]);
        add('prep', 'Interview practice', 1, { little: .55, some: 1, serious: 1.8 }[a.prep]);
        if (a.visa) add('visa', 'Needs a visa', c.local ? .4 : cc === 'us' ? .45 : cc === 'gb' ? .75 : .7, 1);
        if (LANG[cc] && a.lang !== 'fluent') {
            var none = a.lang === 'none';
            add('lang', LANG[cc], none ? (c.local ? .4 : .75) : (c.local ? .7 : .9), none ? (c.local ? .6 : .9) : (c.local ? .8 : .95));
        }
        return f;
    }
    function payModel(c, a, kind) {
        var base = parsePay(c.salary) || { cur: 'USD', v: 60000 };
        var M = base.v * (c.roles.length > 1 ? ROLE_PAY[kind] : 1);
        var up = (a.degree === 'Master' ? .06 : a.degree === 'PhD' ? (kind === 'research' ? .2 : .1) : 0) +
                 (a.exp === '3' ? .18 : a.exp === '1' ? .08 : 0) + (a.proj === 'standout' ? .04 : 0) + (a.grades === 'top' ? .02 : 0) + (a.intern === '2' ? .03 : 0);
        var med = M * (1 + Math.min(.35, up)) * (a.nego ? 1.05 : 1), sig = .14;
        var T = a.salary || med;
        return { cur: base.cur, base: M, med: med, lo: med * Math.exp(-sig), hi: med * Math.exp(sig), target: T, p: clamp(1 - phi((Math.log(T) - Math.log(med)) / sig), .002, .995) };
    }
    function compute(c, a) {
        var kind = roleKind(a.role), sel = c.sel || .5;
        var p0 = clamp(.05 * Math.exp(-4.2 * (sel - .45)), .003, .15);          // overall hire rate for a typical applicant
        var f = factors(c, a, kind), ls = logit(Math.pow(p0, .55)), li = logit(Math.pow(p0, .45));
        f.forEach(function (x) { ls += Math.log(x.s); li += Math.log(x.i); });
        var screen = clamp(inv(ls), .001, .95), inter = clamp(inv(li), .002, .9);
        if (a.here) {                                  // a returning intern skips the screen; NACE: 62–72% get the offer
            screen = 1;
            inter = clamp(inv(logit(.66) + Math.log({ little: .75, some: 1, serious: 1.3 }[a.prep] || 1) + Math.log({ top: 1.2, strong: 1.1, solid: 1, below: .7 }[a.grades] || 1)), .25, .92);
        }
        var pay = payModel(c, a, kind);
        return { total: screen * inter * pay.p, screen: screen, inter: inter, pay: pay, factors: f, p0: p0, kind: kind };
    }
    // What would move the number most? Try each realistic improvement.
    function levers(c, a, base) {
        var tries = [];
        function t(label, patch, icon) { var b = Object.assign({}, a, patch), r = compute(c, b); tries.push({ label: label, icon: icon, d: r.total - base.total }); }
        if (!a.ref && !a.here) t('Get a referral from someone inside', { ref: true }, 'fa-handshake');
        if (a.prep !== 'serious') t('Do 5+ mock interviews', { prep: 'serious' }, 'fa-comments');
        if (!a.here && a.intern !== '2') t(a.intern === '0' ? 'Land a relevant internship' : 'Add a second internship', { intern: a.intern === '0' ? '1' : '2' }, 'fa-id-badge');
        if (a.proj !== 'standout') t(a.proj === 'none' ? 'Build a portfolio or lead a project' : 'One standout win (olympiad, research, open source)', { proj: a.proj === 'none' ? 'some' : 'standout' }, 'fa-trophy');
        if (a.grades !== 'top') t('Lift your grades one band', { grades: { below: 'solid', solid: 'strong', strong: 'top' }[a.grades] }, 'fa-graduation-cap');
        if (base.pay.target > base.pay.med * 1.02) t('Aim for ' + money(base.pay.med, base.pay.cur) + ' first', { salary: base.pay.med }, 'fa-sack-dollar');
        if (!a.nego) t('Negotiate the offer', { nego: true }, 'fa-scale-balanced');
        return tries.filter(function (x) { return x.d > .0004; }).sort(function (x, y) { return y.d - x.d; }).slice(0, 3);
    }
    function verdict(p) {
        return p >= .5 ? ['Strong odds', 'good'] : p >= .25 ? ['Realistic', 'good'] : p >= .1 ? ['A stretch', 'warm'] : p >= .03 ? ['Long shot', 'warm'] : ['Moonshot', 'hot'];
    }
    function pctText(p) { var v = p * 100; return v >= 10 ? Math.round(v) + '' : v >= 1 ? v.toFixed(1) : v.toFixed(2); }
    window.careerOddsSaved = function (name) { var s = findSaved(name); return s ? { role: s.role, pctLabel: pctText(s.pct / 100) + '%' } : null; };

    /* ── Default answers ───────────────────────────────────────────── */
    function gradesFromGradebook() {
        try {
            var s = window.gbSnapshot && window.gbSnapshot();
            if (!s || s.avg == null || !s.max) return null;
            var r = s.avg / s.max;
            return r >= .9 ? 'top' : r >= .8 ? 'strong' : r >= .65 ? 'solid' : 'below';
        } catch (e) { return null; }
    }
    function firstSavedUni() {
        try {
            var ids = lsGet('us_saved_' + uid(), []), list = window.UNI || [];
            for (var i = 0; i < ids.length; i++) { var u = list.find(function (x) { return x.id === ids[i]; }); if (u) return u.name; }
        } catch (e) {}
        return '';
    }
    function answersFor(c, pre) {
        var prof = lsGet(profKey(), {}), saved = findSaved(c.name), a = {
            degree: 'Bachelor', field: '', uni: firstSavedUni(), grades: gradesFromGradebook() || 'solid', exp: '0',
            intern: '0', proj: 'some', prep: 'some', nego: false
        };
        Object.keys(a).forEach(function (k) { if (prof[k] != null) a[k] = prof[k]; });
        a.role = c.roles[0]; a.ref = false; a.here = false; a.visa = false; a.lang = 'some'; a.salary = 0;
        if (saved && saved.ans) Object.assign(a, saved.ans);
        if (pre && pre.role && c.roles.indexOf(pre.role) >= 0) a.role = pre.role;
        if (pre && pre.salary) a.salary = pre.salary;
        if (c.roles.indexOf(a.role) < 0) a.role = c.roles[0];
        return a;
    }
    var SHARED = ['degree', 'field', 'uni', 'grades', 'exp', 'intern', 'proj', 'prep', 'nego'];
    function rememberProfile(a) { var p = lsGet(profKey(), {}); SHARED.forEach(function (k) { p[k] = a[k]; }); lsSet(profKey(), p); }

    /* ── The sheet ─────────────────────────────────────────────────── */
    var el = null, co = null, ans = null, res = null, shown = { total: 0 }, tweenRaf = 0;
    function seg(key, opts, cur) {
        var i = Math.max(0, opts.findIndex(function (o) { return String(o[0]) === String(cur); }));
        return '<div class="cod-seg" role="radiogroup" data-k="' + key + '" style="--n:' + opts.length + ';--i:' + i + '"><span class="cod-seg__pill" aria-hidden="true"></span>' +
            opts.map(function (o, j) { return '<button type="button" role="radio" aria-checked="' + (j === i) + '" data-v="' + esc(o[0]) + '">' + esc(o[1]) + (o[2] ? '<small>' + esc(o[2]) + '</small>' : '') + '</button>'; }).join('') + '</div>';
    }
    function q(label, body, hint) { return '<div class="cod-q"><div class="cod-q__l">' + label + (hint ? '<span>' + hint + '</span>' : '') + '</div>' + body + '</div>'; }
    function sheetHTML(c) {
        var cc = api.companyCC(c), pay = payModel(c, ans, roleKind(ans.role)), country = api.countryName(c);
        var step = niceStep(pay.base), lo = Math.round(pay.base * .6 / step) * step, hi = Math.round(pay.base * 1.8 / step) * step;
        if (!ans.salary) ans.salary = Math.round(pay.base / step) * step;
        ans.salary = clamp(ans.salary, lo, hi);
        var uniList = api.allUnis().map(function (u) { return '<option value="' + esc(u.name) + '">'; }).join('');
        var subjList = api.subjects.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('');
        return '<div class="cod__sheet" style="--c:' + esc(c.color) + '">' +
            '<header class="cod__hd">' +
                '<span class="cod__logo">' + api.logo(c, 34) + '</span>' +
                '<div class="cod__hd__t"><p class="cod__kicker">Your odds · estimate</p><h3>Could you get into <em>' + esc(c.name) + '</em>?</h3></div>' +
                '<button type="button" class="cod__x" data-close aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '</header>' +
            '<div class="cod__body">' +
                '<form class="cod__qs" onsubmit="return false">' +
                    '<section class="cod-grp" style="--g:0"><h4><b>01</b> The job</h4>' +
                        q('Role', '<div class="cod-roles" data-k="role">' + c.roles.map(function (r) { return '<button type="button" data-v="' + esc(r) + '" class="' + (r === ans.role ? 'is-on' : '') + '">' + esc(r) + '</button>'; }).join('') + '</div>') +
                        q('Salary you want', '<div class="cod-sal"><input type="range" data-k="salary" min="' + lo + '" max="' + hi + '" step="' + step + '" value="' + ans.salary + '" aria-label="Target salary"><output id="codSal"></output></div>', 'per year, before tax') +
                    '</section>' +
                    '<section class="cod-grp" style="--g:1"><h4><b>02</b> You</h4>' +
                        q('Degree by then', seg('degree', [['Bachelor', 'Bachelor'], ['Master', 'Master'], ['PhD', 'PhD']], ans.degree)) +
                        '<div class="cod-2">' +
                            q('Subject', '<input class="cod-in" data-k="field" list="codSubj" placeholder="e.g. Computer Science" value="' + esc(ans.field) + '"><datalist id="codSubj">' + subjList + '</datalist>') +
                            q('University', '<input class="cod-in" data-k="uni" list="codUnis" placeholder="Search…" value="' + esc(ans.uni) + '"><datalist id="codUnis">' + uniList + '</datalist>') +
                        '</div>' +
                        q('Grades', seg('grades', [['below', 'Below', '2:2 · <3.0'], ['solid', 'Solid', '2:1 · 3.0+'], ['strong', 'Strong', 'high 2:1 · 3.5+'], ['top', 'Top', 'First · 3.7+']], ans.grades), gradesFromGradebook() ? 'started from your Gradebook' : '') +
                        q('Full-time work experience', seg('exp', [['0', 'None'], ['1', '1–2 years'], ['3', '3+ years']], ans.exp)) +
                    '</section>' +
                    '<section class="cod-grp" style="--g:2"><h4><b>03</b> Your edge</h4>' +
                        q('Internships', seg('intern', [['0', 'None'], ['1', 'One'], ['2', 'Two +']], ans.intern) +
                            '<label class="cod-tg"><input type="checkbox" data-k="here"' + (ans.here ? ' checked' : '') + '><i aria-hidden="true"></i>I interned at ' + esc(c.name) + '</label>') +
                        q('Projects & wins', seg('proj', [['none', 'None yet'], ['some', 'Some', 'portfolio, club lead'], ['standout', 'Standout', 'olympiad, research']], ans.proj)) +
                        q('Interview practice', seg('prep', [['little', 'Little'], ['some', 'Some', '~20 h'], ['serious', 'Serious', '5+ mocks']], ans.prep)) +
                        '<div class="cod-2">' +
                            q('Referral', seg('ref', [['0', 'No'], ['1', 'Yes']], ans.ref ? '1' : '0')) +
                            q('Visa for ' + esc(country || c.country), seg('visa', [['0', 'Not needed'], ['1', 'Needed']], ans.visa ? '1' : '0')) +
                        '</div>' +
                        (LANG[cc] ? q(esc(LANG[cc]), seg('lang', [['none', 'None'], ['some', 'Some'], ['fluent', 'Fluent']], ans.lang)) : '') +
                        '<label class="cod-tg"><input type="checkbox" data-k="nego"' + (ans.nego ? ' checked' : '') + '><i aria-hidden="true"></i>I’ll negotiate the offer</label>' +
                    '</section>' +
                '</form>' +
                '<aside class="cod__res" aria-live="polite">' +
                    '<div class="cod-gauge"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="cod-gauge__track" cx="60" cy="60" r="52"/><circle class="cod-gauge__arc" cx="60" cy="60" r="52" pathLength="100"/></svg>' +
                        '<div class="cod-gauge__in"><b id="codPct">0</b><small>%</small></div></div>' +
                    '<p class="cod-verdict" id="codVerdict"></p>' +
                    '<p class="cod-one" id="codOne"></p>' +
                    '<ol class="cod-fun">' +
                        '<li><span>CV screen</span><i><s id="codF1"></s></i><b id="codF1v"></b></li>' +
                        '<li><span>Interviews → offer</span><i><s id="codF2"></s></i><b id="codF2v"></b></li>' +
                        '<li><span>Offer at your salary</span><i><s id="codF3"></s></i><b id="codF3v"></b></li>' +
                    '</ol>' +
                    '<p class="cod-pay" id="codPay"></p>' +
                    '<div class="cod-lev"><p class="cod-lev__t">Biggest levers</p><ul id="codLev"></ul></div>' +
                    '<button type="button" class="cod-save" id="codSave"><i class="fa-regular fa-bookmark" aria-hidden="true"></i><span>Save to Overview</span></button>' +
                    '<details class="cod-how"><summary>How this is worked out</summary>' +
                        '<p>A hiring funnel: <b>CV screen × interviews → offer × offer at your salary</b>. The starting point is how many applicants ' + esc(c.name) + '’s tier of employer hires (e.g. Goldman Sachs took ~0.7% of 360k intern applicants in 2025; McKinsey ~1%). Each answer then moves the odds of a stage by an amount taken from hiring research:</p>' +
                        '<ul><li>Referred applicants reached interview 40% of the time vs 3% cold, and offers 16% vs 6% (Ashby) — used cautiously.</li>' +
                        '<li>62–72% of interns get a full-time offer (NACE internship reports).</li>' +
                        '<li>Under 40% of employers screen on GPA, most at 3.0 (NACE Job Outlook 2025).</li>' +
                        '<li>More practice interviews → higher pass rates (interviewing.io, Triplebyte). US H-1B lottery picked 25–35% of registrations (FY24–26).</li>' +
                        '<li>Pay: offers spread ±14% around the company’s early-career figure; negotiators gained ~7% (CMU).</li></ul>' +
                        '<p class="cod-how__src">Sources: <a href="https://www.ashbyhq.com/talent-trends-report/reports/referrals" target="_blank" rel="noopener">Ashby</a> · <a href="https://www.naceweb.org/talent-acquisition/internships/intern-conversion-rate-hits-highest-mark-in-five-years" target="_blank" rel="noopener">NACE interns</a> · <a href="https://www.naceweb.org/research/reports/job-outlook/2025" target="_blank" rel="noopener">NACE Job Outlook</a> · <a href="https://finance.yahoo.com/news/record-360-000-students-applied-100000477.html" target="_blank" rel="noopener">Goldman 2025</a> · <a href="https://manifestlaw.com/blog/h1b-lottery-data" target="_blank" rel="noopener">H-1B data</a>. An estimate, not a promise.</p>' +
                    '</details>' +
                '</aside>' +
            '</div>' +
        '</div>';
    }

    function tween(to) {
        cancelAnimationFrame(tweenRaf);
        var from = shown.total, t0 = performance.now(), D = REDUCED ? 1 : 650, out = el.querySelector('#codPct');
        (function step(now) {
            var k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
            shown.total = from + (to - from) * e;
            out.textContent = pctText(shown.total);
            if (k < 1) tweenRaf = requestAnimationFrame(step);
        })(t0);
    }
    function paint() {
        res = compute(co, ans);
        var v = verdict(res.total), P = res.pay;
        tween(res.total);
        el.querySelector('.cod-gauge__arc').style.strokeDashoffset = (100 - Math.max(1.2, res.total * 100)).toFixed(2);
        el.querySelector('.cod__res').setAttribute('data-tone', v[1]);
        el.querySelector('#codVerdict').textContent = v[0];
        var n = Math.max(1, Math.round(1 / res.total));
        el.querySelector('#codOne').textContent = n <= 1 ? 'Most applicants like you get it' : 'About 1 in ' + n.toLocaleString('en') + ' applicants like you';
        [[res.screen, 1], [res.inter, 2], [P.p, 3]].forEach(function (x) {
            el.querySelector('#codF' + x[1]).style.transform = 'scaleX(' + Math.max(.015, x[0]).toFixed(3) + ')';
            el.querySelector('#codF' + x[1] + 'v').textContent = pctText(x[0]) + '%';
        });
        el.querySelector('#codSal').textContent = money(ans.salary, P.cur);
        var sl = el.querySelector('[data-k="salary"]'), sw = sl.parentNode;
        sw.style.setProperty('--p', ((ans.salary - sl.min) / (sl.max - sl.min) * 100).toFixed(1) + '%');
        var mf = clamp((P.med - sl.min) / (sl.max - sl.min), 0, 1);
        sw.style.setProperty('--m', (mf * 100).toFixed(1) + '%'); sw.style.setProperty('--mf', mf.toFixed(3));
        el.querySelector('#codPay').innerHTML = 'Typical offer for you: <b>' + money(P.med, P.cur) + '</b> <span>(' + money(P.lo, P.cur) + '–' + money(P.hi, P.cur) + ')</span>';
        el.querySelector('#codLev').innerHTML = levers(co, ans, res).map(function (l, i) {
            return '<li style="--i:' + i + '"><i class="fa-solid ' + l.icon + '" aria-hidden="true"></i><span>' + esc(l.label) + '</span><b>+' + (l.d * 100 >= 1 ? (l.d * 100).toFixed(1) : (l.d * 100).toFixed(2)) + '</b></li>';
        }).join('') || '<li class="is-none"><i class="fa-solid fa-check" aria-hidden="true"></i><span>You’ve covered the big levers.</span></li>';
        syncSave();
    }
    function syncSave() {
        var s = findSaved(co.name), same = s && s.role === ans.role && Math.abs(s.sal - ans.salary) < 1 && Math.abs(s.pct - res.total * 100) < .05;
        // update in place — replacing the button's children mid-click would swallow the click
        var b = el.querySelector('#codSave');
        b.classList.toggle('is-saved', !!same);
        b.title = same ? 'Saved — tap again to remove it from the Overview' : '';
        b.querySelector('i').className = (same ? 'fa-solid' : 'fa-regular') + ' fa-bookmark';
        b.querySelector('span').textContent = same ? 'Saved to Overview' : s ? 'Update saved odds' : 'Save to Overview';
    }
    function save() {
        var list = getSaved().filter(function (x) { return x.co !== co.name; }), s = findSaved(co.name), same = s && s.role === ans.role && Math.abs(s.pct - res.total * 100) < .05 && Math.abs(s.sal - ans.salary) < 1;
        var b = el.querySelector('#codSave');
        if (same) { lsSet(savedKey(), list); syncSave(); refreshOverview(); return; }     // tap again to remove
        list.unshift({ co: co.name, role: ans.role, sal: ans.salary, cur: res.pay.cur, pct: Math.round(res.total * 10000) / 100, t: Date.now(),
            ans: { role: ans.role, salary: ans.salary, ref: ans.ref, here: ans.here, visa: ans.visa, lang: ans.lang } });
        lsSet(savedKey(), list);
        rememberProfile(ans);
        syncSave();
        if (!REDUCED) { b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); }
        refreshOverview();
    }
    function refreshOverview() { if (window.renderSavedCareers) window.renderSavedCareers(); }

    function setAns(k, v) {
        if (k === 'salary') ans.salary = +v;
        else if (k === 'ref' || k === 'visa') ans[k] = v === '1';
        else ans[k] = v;
        if (SHARED.indexOf(k) >= 0) rememberProfile(ans);
        paint();
    }
    function onClick(e) {
        if (e.target === el || e.target.closest('[data-close]')) { close(); return; }
        var b = e.target.closest('.cod-seg button');
        if (b) {
            var g = b.parentNode, btns = [].slice.call(g.querySelectorAll('button')), i = btns.indexOf(b);
            g.style.setProperty('--i', i);
            btns.forEach(function (x, j) { x.setAttribute('aria-checked', j === i); });
            setAns(g.getAttribute('data-k'), b.getAttribute('data-v'));
            return;
        }
        var r = e.target.closest('.cod-roles button');
        if (r) {
            el.querySelectorAll('.cod-roles button').forEach(function (x) { x.classList.toggle('is-on', x === r); });
            ans.role = r.getAttribute('data-v'); paint(); return;
        }
        if (e.target.closest('#codSave')) save();
    }
    function onInput(e) {
        var k = e.target.getAttribute('data-k'); if (!k) return;
        if (e.type === 'change' && e.target.type !== 'checkbox') return;     // 'input' already handled it
        if (e.type === 'input' && e.target.type === 'checkbox') return;
        if (e.target.type === 'checkbox') setAns(k, e.target.checked);
        else if (k === 'field' || k === 'uni') { ans[k] = e.target.value.trim(); rememberProfile(ans); paint(); }
        else setAns(k, e.target.value);
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function close() {
        if (!el) return;
        var x = el; el = null; cancelAnimationFrame(tweenRaf);
        document.removeEventListener('keydown', onKey, true);
        x.classList.remove('is-open');
        setTimeout(function () { x.remove(); }, REDUCED ? 0 : 320);
        document.documentElement.classList.remove('cod-lock');
    }
    function open(name, pre) {
        var c = api.find(name);
        if (!c) return;
        if (el) close();
        co = c; ans = answersFor(c, pre); shown.total = 0;
        el = document.createElement('div');
        el.className = 'cod';
        el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Your odds at ' + c.name);
        el.innerHTML = sheetHTML(c);
        document.body.appendChild(el);
        document.documentElement.classList.add('cod-lock');
        el.addEventListener('click', onClick);
        el.addEventListener('input', onInput);
        el.addEventListener('change', onInput);
        document.addEventListener('keydown', onKey, true);
        requestAnimationFrame(function () { if (el) { el.classList.add('is-open'); paint(); } });
    }
    window.openCareerOdds = open;

    /* ── Quick save (from a company's page): company + job + salary ─── */
    // The typical early-career offer for a role, to prefill the salary box.
    window.careerOddsTypical = function (name, role) {
        var c = api.find(name); if (!c) return null;
        var P = payModel(c, { role: role, degree: 'Bachelor', exp: '0' }, roleKind(role));
        return { v: P.base, cur: P.cur, sym: SYM[P.cur] || '$', label: money(P.base, P.cur) };
    };
    // Save it straight away; the odds use the answers the student gave before (or sensible defaults).
    window.careerOddsQuickSave = function (name, role, salary) {
        var c = api.find(name); if (!c) return null;
        var a = answersFor(c, { role: role, salary: salary }), r = compute(c, a);
        var list = getSaved().filter(function (x) { return x.co !== c.name; });
        var entry = { co: c.name, role: a.role, sal: a.salary || r.pay.base, cur: r.pay.cur, pct: Math.round(r.total * 10000) / 100, t: Date.now(),
            ans: { role: a.role, salary: a.salary, ref: a.ref, here: a.here, visa: a.visa, lang: a.lang } };
        list.unshift(entry); lsSet(savedKey(), list); refreshOverview();
        return { pctLabel: pctText(entry.pct / 100) + '%', salary: money(entry.sal, entry.cur) };
    };
    window.careerOddsRemove = function (name) { lsSet(savedKey(), getSaved().filter(function (x) { return x.co !== name; })); refreshOverview(); };
    window.careerOddsSavedEntry = findSaved;

    /* ── Overview: "Career paths" box with the saved companies ─────── */
    function ring(p) {
        var v = Math.max(2, Math.min(100, p));
        return '<svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15.5" class="gmf-car__trk"/><circle cx="18" cy="18" r="15.5" pathLength="100" class="gmf-car__arc" style="stroke-dashoffset:' + (100 - v).toFixed(1) + '"/></svg>';
    }
    function renderSavedCareers(mount) {
        mount = mount || document.getElementById('gmfCar');
        if (!mount) return;
        var saved = getSaved().map(function (s) { var c = api.find(s.co); return c ? { s: s, c: c } : null; }).filter(Boolean);
        var ic = '<span class="gmf-car__ic" aria-hidden="true"><i class="fa-solid fa-briefcase"></i></span>';
        if (!saved.length) {
            mount.className = 'gmf-car gmf-car--empty';
            mount.innerHTML = ic + '<span class="gmf-car__t"><b>Career paths</b><small>Save a company, a job and the salary you want — it shows up here</small></span>' +
                '<button type="button" class="gmf-car__cta" data-car-open=""><span>Explore</span><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>';
            return;
        }
        saved.sort(function (a, b) { return b.s.pct - a.s.pct; });
        mount.className = 'gmf-car gmf-car--saved';
        mount.innerHTML = ic + '<span class="gmf-car__t"><b>Career paths</b><small>' + saved.length + ' saved · your odds</small></span>' +
            '<ul class="gmf-car__chips">' + saved.map(function (x, i) {
                var tone = verdict(x.s.pct / 100)[1];
                return '<li style="--i:' + i + '"><button type="button" class="gmf-car__rm" data-car-rm="' + esc(x.c.name) + '" aria-label="Remove ' + esc(x.c.name) + '" title="Remove"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
                    '<button type="button" class="gmf-car__chip" data-car-odds="' + esc(x.c.name) + '" style="--uc:' + esc(x.c.color) + '" title="' + esc(x.c.name + ' · ' + x.s.role + ' · ' + money(x.s.sal, x.s.cur)) + ' — tap for your odds">' +
                    '<span class="gmf-car__logo">' + api.logo(x.c, 24) + '</span>' +
                    '<span class="gmf-car__ctx"><b>' + esc(x.c.name) + '</b><small>' + esc(x.s.role) + ' · ' + money(x.s.sal, x.s.cur) + '</small></span>' +
                    '<span class="gmf-car__pct gmf-car__pct--' + tone + '">' + ring(x.s.pct) + '<em>' + pctText(x.s.pct / 100) + '<i>%</i></em></span>' +
                '</button></li>';
            }).join('') + '</ul>' +
            '<button type="button" class="gmf-car__plus" data-car-open="" aria-label="Explore more companies" title="Explore companies"><i class="fa-solid fa-plus" aria-hidden="true"></i></button>';
    }
    window.renderSavedCareers = renderSavedCareers;
    document.addEventListener('click', function (e) {
        var rm = e.target.closest && e.target.closest('[data-car-rm]');
        if (rm) { var li = rm.closest('li'); if (li && !REDUCED) { li.classList.add('is-out'); setTimeout(function () { window.careerOddsRemove(rm.getAttribute('data-car-rm')); }, 260); } else window.careerOddsRemove(rm.getAttribute('data-car-rm')); return; }
        var o = e.target.closest && e.target.closest('[data-car-odds]');
        if (o) { var s = findSaved(o.getAttribute('data-car-odds')); open(o.getAttribute('data-car-odds'), s ? { role: s.role, salary: s.sal } : null); return; }
        if (e.target.closest && e.target.closest('[data-car-open]') && window.openCareers) window.openCareers();
    });
    renderSavedCareers();
})();
