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

    // ── Geography ──────────────────────────────────────────────────────
    // Companies carry a `cc` (or one is inferred from their HQ country). A
    // university's country comes from the curated map below, or (for the app's
    // own universities) from the currently-selected study destination. Local
    // employers only surface at home; global ones stay reachable everywhere.
    var COMPANY_CC = { 'USA': 'us', 'UK': 'gb', 'United Kingdom': 'gb', 'Ireland': 'ie', 'Netherlands': 'nl', 'Germany': 'de', 'France': 'fr', 'Switzerland': 'ch', 'Sweden': 'se', 'Spain': 'es', 'Italy': 'it', 'Portugal': 'pt', 'Denmark': 'dk', 'Finland': 'fi', 'Belgium': 'be', 'Ukraine': 'ua', 'Taiwan': 'tw' };
    function companyCC(c) { return (c.cc || COMPANY_CC[c.country] || '').toLowerCase(); }
    // Curated (globally-famous) universities → their country code.
    var UNI_CC = {
        'universityofoxford': 'gb', 'universityofcambridge': 'gb', 'imperialcollegelondon': 'gb', 'londonschoolofeconomics': 'gb', 'lse': 'gb', 'universityofwarwick': 'gb', 'universityofmanchester': 'gb', 'universityofnottingham': 'gb', 'londonbusinessschool': 'gb', 'lbs': 'gb',
        'mit': 'us', 'stanforduniversity': 'us', 'harvarduniversity': 'us', 'carnegiemellonuniversity': 'us', 'ucberkeley': 'us', 'ucla': 'us', 'universityofpennsylvania': 'us', 'newyorkuniversity': 'us', 'universityofwashington': 'us', 'georgiatech': 'us', 'purdueuniversity': 'us', 'universityofmichigan': 'us',
        'ethzurich': 'ch', 'bocconiuniversity': 'it', 'insead': 'fr', 'hecparis': 'fr', 'isaesupaero': 'fr', 'tumunich': 'de', 'rwthaachen': 'de', 'universityofmannheim': 'de', 'ieuniversity': 'es', 'ktroyalinstitute': 'se', 'kthroyalinstitute': 'se', 'tudelft': 'nl',
        'universityofwaterloo': 'ca', 'universityoftoronto': 'ca', 'tsinghuauniversity': 'cn', 'nationaltaiwanuniversity': 'tw', 'kaist': 'kr', 'iitbombay': 'in', 'iitdelhi': 'in', 'technion': 'il', 'universityofhongkong': 'hk'
    };
    function curCC() { try { return String(window.currentCountryCode || '').toLowerCase(); } catch (e) { return ''; } }
    function uniCC(uni) {
        if (uni.cc) return uni.cc;
        // App universities belong to the destination currently loaded.
        if (uni.fromApp) return uni.country_code || uni.cc || curCC();
        return UNI_CC[norm(uni.name)] || (uni.short ? UNI_CC[norm(uni.short)] : '') || '';
    }
    // How reachable is company `c` for a student in country `ucc`?
    //   same country → strong boost; a national-only employer abroad → hidden;
    //   a global recruiter abroad → still reachable, modestly downweighted.
    function locFactor(ucc, c) {
        var ccc = companyCC(c);
        if (!ucc) return c.local ? 0.5 : 1;          // unknown uni country: stay neutral
        if (ccc && ccc === ucc) return 1.75;         // home-country employer — recruit here first
        return c.local ? 0.05 : 0.5;                 // abroad: national-only firms vanish, globals stay reachable but secondary
    }
    // Display names for the app's study destinations.
    var CC_NAME = { be: 'Belgium', ch: 'Switzerland', de: 'Germany', dk: 'Denmark', es: 'Spain', fi: 'Finland', fr: 'France', gb: 'the United Kingdom', ie: 'Ireland', it: 'Italy', nl: 'the Netherlands', pt: 'Portugal', se: 'Sweden', ua: 'Ukraine', us: 'the United States' };
    function currentCountry() { var cc = curCC(); return { cc: cc, name: CC_NAME[cc] || 'your destination' }; }

    // Broad subject groups → the specific subjects inside them. Subjects reuse the
    // company `degrees` vocabulary so a picked subject actually matches employers.
    var GROUPS = {
        'Science': ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Statistics', 'Data Science', 'Geoscience', 'Materials Science', 'Environmental Science', 'Neuroscience', 'Astronomy'],
        'Engineering': ['Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering', 'Computer Engineering', 'Aerospace Engineering', 'Software Engineering', 'Telecommunications Engineering', 'Energy Engineering', 'Materials Science', 'Biomedical Engineering', 'Industrial Engineering'],
        'Computer Science': ['Software Engineering', 'Machine Learning', 'Data Science', 'Cybersecurity', 'Artificial Intelligence', 'Computer Engineering', 'Information Systems'],
        'Business': ['Finance', 'Economics', 'Marketing', 'Management', 'Accounting', 'Supply Chain', 'Business Analytics', 'Human Resources', 'Entrepreneurship'],
        'Law': ['Corporate Law', 'Commercial Law', 'International Law', 'Tax Law', 'Criminal Law', 'Intellectual Property', 'Law'],
        'Medicine & Health': ['Medicine', 'Pharmacy', 'Dentistry', 'Nursing', 'Public Health', 'Biomedical Science', 'Veterinary Medicine'],
        'Social Sciences': ['Economics', 'Politics', 'Psychology', 'Sociology', 'International Relations', 'Anthropology', 'Geography'],
        'Humanities': ['History', 'Philosophy', 'Literature', 'Linguistics', 'Languages', 'Theology', 'Classics'],
        'Arts & Design': ['Design', 'Architecture', 'Media', 'Fine Arts', 'Music', 'Film', 'Fashion']
    };
    // Every university offers the full set — the student picks what THEY studied,
    // not a shortlist tied to the university's headline fields.
    var CANON = ['Science', 'Engineering', 'Computer Science', 'Business', 'Law', 'Medicine & Health', 'Social Sciences', 'Humanities', 'Arts & Design'];
    // Flat, de-duplicated catalogue (broad groups + every specific subject) for the search box.
    var ALL_SUBJECTS = (function () {
        var seen = {}, out = [];
        CANON.forEach(function (g) { if (!seen[norm(g)]) { seen[norm(g)] = 1; out.push(g); } (GROUPS[g] || []).forEach(function (s) { if (!seen[norm(s)]) { seen[norm(s)] = 1; out.push(s); } }); });
        return out.sort(function (a, b) { return a < b ? -1 : 1; });
    })();
    var GALIAS = { sciences: 'Science', science: 'Science', naturalsciences: 'Science', cs: 'Computer Science', computerscience: 'Computer Science', informatics: 'Computer Science', businessinformatics: 'Computer Science', engineering: 'Engineering', business: 'Business', humanities: 'Humanities', arts: 'Arts & Design', artsdesign: 'Arts & Design', design: 'Arts & Design', socialsciences: 'Social Sciences', healthsciences: 'Medicine & Health', health: 'Medicine & Health', medicine: 'Medicine & Health', law: 'Law' };
    function groupKey(field) { return GROUPS[field] ? field : (GALIAS[norm(field)] || null); }
    function groupSubjects(field) { var k = groupKey(field); return k ? GROUPS[k] : null; }

    // Match against the chosen subjects (array). Empty → fall back to all uni fields.
    // curSubjects entries are { s: subjectName, level: 'Bachelor'|'Master'|'PhD' } (or a bare string).
    function subjName(x) { return (typeof x === 'string') ? x : (x && x.s) || ''; }
    function subjLevel(x) { return (typeof x === 'string') ? null : (x && x.level) || null; }
    function degMatch1(comp, name) {   // one subject vs a company's degree list
        var b = String(name).toLowerCase(); if (!b) return 0.32;
        return comp.degrees.some(function (d) { if (/any/i.test(d)) return true; var a = d.toLowerCase(); return a.indexOf(b) !== -1 || b.indexOf(a) !== -1; }) ? 1 : 0.32;
    }
    function fieldMatch(uni, comp, subs) {
        var fs = (subs && subs.length) ? subs.map(subjName) : (uni.fields || []);
        return fs.some(function (n) { return degMatch1(comp, n) === 1; }) ? 1 : 0.32;
    }
    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
    function isResearchCo(comp) { return /AI|Semiconduct|Pharma|Data|Research|Quant|Deep|Machine|Biotech/i.test(comp.sector || '') || (comp.pre || 0) >= 0.82; }
    function groupOfSubject(name) { var b = norm(name); for (var g in GROUPS) { if (GROUPS.hasOwnProperty(g) && GROUPS[g].some(function (s) { return norm(s) === b; })) return g; } return groupKey(name); }

    // ── Scoring factor #1: Subject Relevance ──
    // How central the student's subject is to the company's PREFERRED subjects
    // (its `degrees` list). Primary preferred subject > secondary > any-field > related group.
    function subjectRel1(comp, name) {
        if (!name) return 0;
        var b = name.toLowerCase(), strong = 0, generic = 0, hasAny = false;
        for (var k = 0; k < comp.degrees.length; k++) {
            var d = comp.degrees[k]; if (/any/i.test(d)) { hasAny = true; continue; }
            var a = d.toLowerCase();
            if (a === b) strong = Math.max(strong, k === 0 ? 1.0 : 0.9);          // exact preferred discipline
            else if (a.indexOf(b) !== -1) strong = Math.max(strong, 0.85);         // degree names the discipline specifically
            else if (b.indexOf(a) !== -1) generic = Math.max(generic, 0.48);       // degree is only a generic umbrella ("Engineering" ⊂ "Aerospace Engineering")
        }
        if (strong) return strong;
        if (generic) return generic;
        if (hasAny) return 0.38;   // hires any discipline — recruits everyone, specialises in no one
        var g = groupOfSubject(name);
        if (g && GROUPS[g] && GROUPS[g].some(function (s) { var c = s.toLowerCase(); return comp.degrees.some(function (dd) { if (/any/i.test(dd)) return false; var a = dd.toLowerCase(); return a === c || a.indexOf(c) !== -1 || c.indexOf(a) !== -1; }); })) return 0.2;   // adjacent field only (Chemical Eng ≠ Aerospace Eng)
        return 0.05;
    }
    // Relevance leans on COVERAGE (the average across the chosen subjects) rather
    // than a single lucky match — so an employer must recruit MOST of a student's
    // disciplines to score high. Matching just one of five ranks it modestly.
    function subjectMatch(comp, subs) {
        var best = 0, bestLevel = null, matches = 0, sum = 0, list = (subs && subs.length) ? subs : [];
        list.forEach(function (x) { var r = subjectRel1(comp, subjName(x)); sum += r; if (r >= 0.5) matches++; if (r > best) { best = r; bestLevel = subjLevel(x); } });
        var mean = list.length ? sum / list.length : 0;
        return { relevance: 0.4 * best + 0.6 * mean, level: bestLevel || 'None', matches: matches };
    }
    // ── Scoring factor #2: Employer Presence at the university ──
    // Reads the recruitment database: verified graduate reports → target-school
    // lists → country presence. (Extend with explicit per-uni data here later.)
    function presence(uni, comp, srcRec) {
        if (isVerified(srcRec || sourceFor(uni), comp)) return 1.0;   // named in the university's own graduate report
        if (isTarget(uni, comp)) return 0.72;                          // documented target school
        if (companyCC(comp) === uniCC(uni)) return 0.5;                // operates in the same country
        return comp.local ? 0.08 : 0.3;                                // global recruiter reachable, national-only firm not
    }
    // ── Scoring factor #3: University Reputation for the subject ──
    function uniStrongIn(uni, name) {
        var b = name.toLowerCase();
        return (uni.fields || []).some(function (f) { var a = String(f).toLowerCase(); if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return true; var g = groupKey(f); return g && GROUPS[g] && GROUPS[g].some(function (s) { return s.toLowerCase() === b; }); });
    }
    function reputation(uni, subs) {
        var t = TIERF[uni.tier] || 0.5;
        var strong = (subs && subs.length) ? subs.some(function (x) { return uniStrongIn(uni, subjName(x)); }) : true;
        return t * (strong ? 1.0 : 0.72);
    }
    // ── Scoring factor #4: Degree Level fit ──
    // "None" = the student took the subject but holds no degree in it → the
    // degree factor contributes little; a real degree (BSc/MSc/PhD) counts fully.
    function degreeScore(comp, level) {
        if (!level || level === 'None') return 0.4;
        var research = isResearchCo(comp);
        if (level === 'PhD') return research ? 1.0 : 0.65;
        if (level === 'Master') return research ? 0.82 : 0.95;
        return research ? 0.6 : 0.9;   // Bachelor
    }
    // A documented target-school link: this company is publicly known to recruit
    // from this university (the "Suits → Harvard" kind of correlation). Curated
    // from public target-school reputation; swap for measured data when available.
    function isTarget(uni, comp) { return (comp.unis || []).some(function (n) { return norm(n) === norm(uni.name) || (uni.short && norm(n) === norm(uni.short)); }); }
    var isFeeder = isTarget;   // back-compat alias

    // ── Employer Recruitment Match Score (modular) ──
    // Not the student's personal odds — it rates how strongly each employer
    // recruits <subject> graduates from <university>. To add a factor later, push
    // one object here (value fn returns 0..1) and keep the weights summing to 100;
    // the engine, cards, bars and tooltip all pick it up automatically.
    var SCORE_FACTORS = [
        { key: 'subject',    label: 'Subject relevance',     weight: 40, fn: function (x) { return x.subj.relevance; } },
        { key: 'presence',   label: 'Employer presence',     weight: 30, fn: function (x) { return presence(x.uni, x.comp, x.srcRec); } },
        { key: 'reputation', label: 'University reputation',  weight: 20, fn: function (x) { return reputation(x.uni, x.subs); } },
        { key: 'degree',     label: 'Degree level',          weight: 10, fn: function (x) { return degreeScore(x.comp, x.subj.level); } }
    ];
    function matchScore(uni, comp, subs, srcRec) {
        var ctx = { uni: uni, comp: comp, subs: subs, srcRec: srcRec, subj: subjectMatch(comp, subs) };
        var total = 0, parts = [];
        SCORE_FACTORS.forEach(function (f) { var pts = Math.round(clamp01(f.fn(ctx)) * f.weight); total += pts; parts.push({ label: f.label, pts: pts, max: f.weight }); });   // total = sum of shown parts (tooltip always adds up)
        return { score: Math.max(2, Math.min(100, total)), relevance: ctx.subj.relevance, parts: parts };
    }

    // ── VERIFIED correlations from real graduate-outcome reports (D.sources) ──
    function nameMatch(a, b) { a = norm(a); b = norm(b); if (!a || !b) return false; if (a === b) return true; var sh = a.length < b.length ? a : b, lo = a.length < b.length ? b : a; return sh.length >= 5 && lo.indexOf(sh) !== -1; }
    function sourceFor(uni) {   // the report backing this university, if any
        var recs = (D.sources || []);
        for (var i = 0; i < recs.length; i++) {
            if ((recs[i].unis || []).some(function (n) { return nameMatch(n, uni.name) || (uni.short && nameMatch(n, uni.short)); })) return recs[i];
        }
        return null;
    }
    function isVerified(rec, comp) { return !!(rec && (rec.employers || []).some(function (n) { return norm(n) === norm(comp.name); })); }

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
    // Real brand logos via Simple Icons (crisp SVG, official brand colour). Only
    // brands the library actually carries are mapped; anything else (and any load
    // failure) falls back to a clean lettermark — never a generic globe.
    var SI = {
        'NVIDIA': 'nvidia', 'Apple': 'apple', 'Alphabet (Google)': 'google', 'Microsoft': 'microsoft', 'Amazon': 'amazon',
        'Broadcom': 'broadcom', 'Tesla': 'tesla', 'Meta Platforms': 'meta',
        'IBM': 'ibm', 'Intel': 'intel', 'Oracle': 'oracle', 'SAP': 'sap', 'Salesforce': 'salesforce', 'Adobe': 'adobe',
        'Palantir': 'palantir', 'Stripe': 'stripe', 'Spotify': 'spotify', 'Booking.com': 'bookingdotcom',
        'Siemens': 'siemens', 'Bosch': 'bosch', 'BMW Group': 'bmw', 'Airbus': 'airbus', 'Shell': 'shell',
        'Accenture': 'accenture', 'HSBC': 'hsbc', 'Barclays': 'barclays',
        'Unilever': 'unilever', 'Nestlé': 'nestle', 'L’Oréal': 'loreal',
        // ── National / regional employers (added with the per-country dataset).
        //    Only slugs the Simple Icons library actually still carries are
        //    listed; every other company falls back to a clean colour monogram. ──
        'EPAM Systems': 'epam', 'Grammarly': 'grammarly',
        'Inditex (Zara)': 'zara', 'Telefónica': 'telefonica', 'Glovo': 'glovo',
        'GSK': 'gsk', 'Rolls-Royce': 'rollsroyce', 'ARM': 'arm', 'Vodafone': 'vodafone',
        'Volkswagen Group': 'volkswagen', 'Deutsche Bank': 'deutschebank', 'Adidas': 'adidas', 'Deutsche Telekom': 'deutschetelekom', 'Deutsche Post DHL': 'dhl',
        'Schneider Electric': 'schneiderelectric', 'Renault Group': 'renault',
        'Ferrari': 'ferrari', 'ABB': 'abb', 'Adyen': 'adyen', 'NXP Semiconductors': 'nxp',
        'Ericsson': 'ericsson', 'IKEA': 'ikea', 'Volvo Cars': 'volvo', 'H&M': 'handm', 'Klarna': 'klarna',
        'Ryanair': 'ryanair', 'Intercom': 'intercom',
        'Nokia': 'nokia', 'Supercell': 'supercell',
        'Boeing': 'boeing', 'Cisco': 'cisco', 'AMD': 'amd', 'Qualcomm': 'qualcomm', 'Netflix': 'netflix', 'Visa': 'visa'
    };
    // Real logos for EVERY company: crisp Simple Icons for major brands, else the
    // company's actual site logo via icon.horse, falling back to DuckDuckGo — and
    // only a monogram in the (near-impossible) case every image 404s.
    function iconHorse(c) { return c.domain ? 'https://icon.horse/icon/' + c.domain : ''; }
    function ddgIcon(c) { return c.domain ? 'https://icons.duckduckgo.com/ip3/' + c.domain + '.ico' : ''; }
    function logo(c, sz) {
        var style = sz ? 'width:' + sz + 'px;height:' + sz + 'px' : '';
        var slug = SI[c.name];
        var primary = slug ? 'https://cdn.simpleicons.org/' + slug : iconHorse(c);
        if (primary) {
            return '<span class="crs__logo crs__logo--img" data-icon="' + esc(iconHorse(c)) + '" data-ddg="' + esc(ddgIcon(c)) + '" data-mono="' + esc(initials(c.name)) + '" data-c="' + c.color + '" style="' + style + '">' +
                '<img' + (slug ? '' : ' crossorigin="anonymous"') + ' src="' + primary + '" alt="' + esc(c.name) + ' logo" loading="lazy" onload="crsLogoCheck(this)" onerror="crsLogoFail(this)"></span>';
        }
        return '<span class="crs__logo crs__logo--mono" style="background:' + c.color + ';' + style + '">' + esc(initials(c.name)) + '</span>';
    }
    // Exposed so other features (e.g. the Compare modal's Companies tab) render the
    // exact same real logos with the same Simple Icons → icon.horse → DDG fallback.
    window.crsLogo = logo;
    // icon.horse sends a grey letter tile for sites it doesn't know (Citadel was a grey "C") — skip it.
    function swapSrc(img, url) { if (url.indexOf('icon.horse') !== -1) img.crossOrigin = 'anonymous'; else img.removeAttribute('crossorigin'); img.src = url; }
    window.crsLogoCheck = function (img) { if (typeof window.isIconPlaceholder === 'function' && window.isIconPlaceholder(img)) (img.closest('.crs__cx__product') ? window.crsHeroFail : window.crsLogoFail)(img); };
    window.crsLogoFail = function (img) {
        var s = img.parentNode; if (!s) return;
        var src = img.getAttribute('src') || '', icon = s.getAttribute('data-icon'), ddg = s.getAttribute('data-ddg');
        if (src.indexOf('simpleicons') !== -1 && icon) { swapSrc(img, icon); return; }   // crisp logo missing → real site logo
        if (src.indexOf('icon.horse') !== -1 && ddg) { swapSrc(img, ddg); return; }      // → DuckDuckGo favicon
        s.classList.remove('crs__logo--img'); s.classList.add('crs__logo--mono');       // absolute last resort
        s.style.background = s.getAttribute('data-c') || '#6c3fb0';
        s.textContent = s.getAttribute('data-mono') || '?';
    };
    // Large "product / brand" showcase for the detail modal hero. Uses the real
    // brand logo on a glossy card (the inspirational product shot); falls back to
    // a big brand-gradient monogram tile when no logo is available.
    function heroVisual(c) {
        var slug = SI[c.name];
        var primary = slug ? 'https://cdn.simpleicons.org/' + slug : iconHorse(c);
        if (primary) {
            return '<div class="crs__cx__product" data-icon="' + esc(iconHorse(c)) + '" data-ddg="' + esc(ddgIcon(c)) + '"><img' + (slug ? '' : ' crossorigin="anonymous"') + ' src="' + primary + '" alt="' + esc(c.name) + '" loading="lazy" data-mono="' + esc(initials(c.name)) + '" data-c="' + c.color + '" onload="crsLogoCheck(this)" onerror="crsHeroFail(this)"></div>';
        }
        return '<div class="crs__cx__product crs__cx__product--mono" style="background:linear-gradient(140deg,' + c.color + ',color-mix(in srgb,' + c.color + ' 55%,#141018))">' + esc(initials(c.name)) + '</div>';
    }
    window.crsHeroFail = function (img) {
        var p = img.parentNode; if (!p) return;
        var src = img.getAttribute('src') || '', icon = p.getAttribute('data-icon'), ddg = p.getAttribute('data-ddg');
        if (src.indexOf('simpleicons') !== -1 && icon) { swapSrc(img, icon); return; }
        if (src.indexOf('icon.horse') !== -1 && ddg) { swapSrc(img, ddg); return; }
        p.classList.add('crs__cx__product--mono');
        p.style.background = 'linear-gradient(140deg,' + (img.getAttribute('data-c') || '#6c3fb0') + ',#241a3a)';
        p.textContent = img.getAttribute('data-mono') || '?';
    };
    function chip(txt) { return '<span class="crs__chip">' + esc(txt) + '</span>'; }
    function tierStars(t) { var s = ''; for (var i = 1; i <= 5; i++) s += '<i class="fa-solid fa-star' + (i <= t ? '' : ' crs__star--off') + '"></i>'; return '<span class="crs__stars">' + s + '</span>'; }

    // Shared company card (used by both the global and per-country top-10 grids).
    function coCard(c, badge, i) {
        return '<button class="crs__co" data-co="' + esc(c.name) + '" style="--i:' + Math.min(i, 9) + ';--c:' + c.color + '">' +
            '<span class="crs__rank">' + badge + '</span>' +
            '<div class="crs__co__hd">' + logo(c) + '<div class="crs__co__id"><div class="crs__co__nm">' + esc(c.name) + '</div><div class="crs__co__sec">' + esc(c.sector) + '</div></div></div>' +
            '<div class="crs__co__meta"><span><i class="fa-solid fa-location-dot"></i> ' + esc(c.city) + '</span><span class="crs__co__pay"><i class="fa-solid fa-sack-dollar"></i> ' + esc(c.salary) + '</span></div>' +
            '<div class="crs__co__row" title="Usually studied"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i><div class="crs__chips">' + c.degrees.slice(0, 3).map(chip).join('') + '</div></div>' +
            '<div class="crs__co__row" title="Top feeder universities"><i class="fa-solid fa-building-columns" aria-hidden="true"></i><div class="crs__chips">' + c.unis.slice(0, 4).map(function (u) { var uu = resolveUni(u); return '<span class="crs__chip crs__chip--uni">' + esc(uu ? (uu.short || uu.name) : u) + '</span>'; }).join('') + '</div></div>' +
            '<span class="crs__co__more" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>' +
        '</button>';
    }

    // ── Global top-10 (largest companies by market cap) ──
    function companiesHTML() {
        var top = D.companies.filter(function (c) { return c.rank; }).sort(function (a, b) { return a.rank - b.rank; });
        return '<div class="crs__companies">' + top.map(function (c, i) { return coCard(c, '#' + c.rank, i); }).join('') + '</div>';
    }

    // ── Top-10 employers in the current study destination ──
    function countryTop10HTML() {
        var ctry = currentCountry();
        var list = D.companies.filter(function (c) { return companyCC(c) === ctry.cc; })
            .sort(function (a, b) { return (b.pre || 0) - (a.pre || 0) || (a.name < b.name ? -1 : 1); }).slice(0, 10);
        if (!list.length) return '<div class="crs__hint"><i class="fa-solid fa-city"></i> No employers are listed for ' + esc(ctry.name) + ' yet.</div>';
        return '<div class="crs__companies">' + list.map(function (c, i) { return coCard(c, '#' + (i + 1), i); }).join('') + '</div>';
    }

    // ── University-result view (level + subject picker) ──
    function subjSelected(s) { return curSubjects.some(function (x) { return norm(subjName(x)) === norm(s); }); }
    function chipx(x) {
        var lv = subjLevel(x);
        var badge = (lv && lv !== 'None') ? '<span class="crs__chipx__lv">' + esc(lv) + '</span> ' : '';
        return '<span class="crs__chipx" data-rm="' + esc(subjName(x)) + '">' + badge + esc(subjName(x)) + ' <i class="fa-solid fa-xmark"></i></span>';
    }

    // Level control with a sliding active indicator — lives inside the drawer and
    // applies to the NEXT subject the student picks.
    function lvlHTML() {
        var idx = Math.max(0, LEVELS.indexOf(curLevel));
        return '<div class="crs__lvl" style="--i:' + idx + '"><span class="crs__lvl__ind"></span>' +
            LEVELS.map(function (l) { return '<button class="crs__lvl__b' + (curLevel === l ? ' on' : '') + '" data-level="' + l + '">' + l + '</button>'; }).join('') +
        '</div>';
    }
    function addLabel() { return curSubjects.length ? (curSubjects.length + (curSubjects.length === 1 ? ' subject' : ' subjects')) : 'Add your subjects'; }
    function subsumHTML() { return curSubjects.length ? curSubjects.map(chipx).join('') : ''; }
    // Filtered subject buttons (rebuilt as the user types).
    function subjItemsHTML(q) {
        var nq = norm(q);
        var items = ALL_SUBJECTS.filter(function (s) { return !nq || norm(s).indexOf(nq) !== -1; });
        if (!items.length) return '<div class="crs__sp__empty">No subject matches “' + esc(q) + '”.</div>';
        return items.map(function (s) { var on = subjSelected(s); return '<button class="crs__subj' + (on ? ' on' : '') + '" data-subj="' + esc(s) + '"><i class="fa-solid fa-' + (on ? 'circle-check' : 'circle') + '"></i> ' + esc(s) + '</button>'; }).join('');
    }
    // Sidebar drawer content: search + (selected + quick picks + logo footer) or live results.
    var QUICK = ['Mathematics', 'Computer Science', 'Finance', 'Law', 'Medicine'];
    function dwBodyHTML(q) {
        if (norm(q)) return '<div class="crs__dw__list">' + subjItemsHTML(q) + '</div>';
        var sel = curSubjects.length
            ? '<div class="crs__dw__lbl">Selected — with their degree</div><div class="crs__dw__sel">' + curSubjects.map(chipx).join('') + '</div>'
            : '';
        var quick = QUICK.map(function (s) { var on = subjSelected(s); return '<button class="crs__qk' + (on ? ' on' : '') + '" data-subj="' + esc(s) + '"><i class="fa-solid fa-' + (on ? 'circle-check' : 'plus') + '"></i> ' + esc(s) + '</button>'; }).join('');
        return sel +
            '<div class="crs__dw__lbl">Quick picks</div><div class="crs__dw__quick">' + quick + '</div>';
    }
    function dwHTML() {
        return '<div class="crs__dw__hd"><span><i class="fa-solid fa-graduation-cap"></i> Your subjects</span><button class="crs__dw__x" data-spx title="Close"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="crs__dw__lv"><span class="crs__dw__lvlbl">Degree</span>' + lvlHTML() + '</div>' +
            '<div class="crs__dw__srch"><i class="fa-solid fa-magnifying-glass"></i><input id="crsSubSearch" type="text" placeholder="Search a subject…" autocomplete="off"></div>' +
            '<div class="crs__dw__body" id="crsDwBody">' + dwBodyHTML('') + '</div>';
    }
    function pickerHTML() {
        return '<button class="crs__add" id="crsAdd" type="button" data-add><i class="fa-solid fa-sliders"></i> <span id="crsAddT">' + addLabel() + '</span></button>';
    }
    function mineHTML(uni) {
        return '<div class="crs__result">' +
            '<div class="crs__uni">' +
                '<div class="crs__uni__ab">' + esc(initials(uni.name)) + '</div>' +
                '<div class="crs__uni__meta"><div class="crs__uni__nm">' + esc(uni.name) + '</div>' + tierStars(uni.tier) + '</div>' +
                pickerHTML() +
                '<div class="crs__subsum" id="crsSubsum">' + subsumHTML() + '</div>' +
            '</div>' +
            '<div class="crs__out" id="crsOut"></div>' +
        '</div>';
    }
    // The results portion (recomputed on every level/subject change). Cards show
    // the Employer Recruitment Match Score with a breakdown tooltip on hover.
    function resultsHTML(uni) {
        if (!curSubjects.length) {
            return '<div class="crs__rez"><button type="button" class="crs__pick" data-add>' +
                '<img class="crs__pick__logo" src="images/logo2.png" alt="">' +
                '<span class="crs__pick__tx"><b>Pick your subjects</b><span>See where graduates go</span></span>' +
                '<span class="crs__pick__go" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>' +
                '<span class="crs__pick__might" aria-hidden="true"></span>' +
            '</button></div>';
        }
        var srcRec = sourceFor(uni);
        var ranked = D.companies.map(function (c) { var m = matchScore(uni, c, curSubjects, srcRec); return { c: c, score: m.score, parts: m.parts, rel: m.relevance, target: isTarget(uni, c), verified: isVerified(srcRec, c) }; })
            .filter(function (r) { return r.rel >= 0.35; })   // drop employers that don't recruit these disciplines
            .sort(function (a, b) { return b.score - a.score; }).slice(0, 10);
        if (!ranked.length) {
            return '<div class="crs__rez"><div class="crs__pick crs__pick--static"><img class="crs__pick__logo" src="images/logo2.png" alt="">' +
                '<span class="crs__pick__tx"><b>Few big employers recruit these subjects</b><span>Graduates usually go into specialist practice</span></span></div></div>';
        }
        var rows = ranked.map(function (r, i) {
            var roles = (r.c.roles || []).slice(0, 2).map(esc).join(' · ') + (r.c.roles.length > 2 ? ' +' + (r.c.roles.length - 2) : '');
            var cls = r.verified ? ' crs__dest--verified' : (r.target ? ' crs__dest--target' : '');
            var badge = r.verified ? ' <span class="crs__vpill"><i class="fa-solid fa-circle-check"></i> Verified</span>'
                : (r.target ? ' <span class="crs__tpill"><i class="fa-solid fa-bullseye"></i> Target</span>' : '');
            var tip = '<div class="crs__tip">' + r.parts.map(function (p) {
                return '<div class="crs__tip__row"><span>' + esc(p.label) + '</span><b>' + p.pts + '/' + p.max + '</b></div>' +
                    '<div class="crs__tip__bar"><i style="width:' + Math.round(p.pts / p.max * 100) + '%;background:' + r.c.color + '"></i></div>';
            }).join('') + '<div class="crs__tip__tot"><span>Match score</span><b style="color:' + r.c.color + '">' + r.score + '/100</b></div></div>';
            return '<button class="crs__dest' + cls + '" data-co="' + esc(r.c.name) + '" style="--i:' + i + ';--c:' + r.c.color + '">' +
                logo(r.c, 40) +
                '<div class="crs__dest__mid"><div class="crs__dest__nm">' + esc(r.c.name) + badge + '</div>' +
                    '<div class="crs__dest__role"><i class="fa-solid fa-user-tie"></i> ' + roles + '</div>' +
                '</div>' +
                '<span class="crs__dest__sal" title="Typical early-career pay"><i class="fa-solid fa-sack-dollar"></i> ' + esc(r.c.salary) + '</span>' +
                '<span class="crs__score" style="--n:' + r.score + '" aria-label="Match ' + r.score + ' out of 100">' +
                    '<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="crs__score__t" cx="18" cy="18" r="15.5" pathLength="100"/><circle class="crs__score__b" cx="18" cy="18" r="15.5" pathLength="100"/></svg>' +
                    '<b>' + r.score + '</b>' + tip +
                '</span>' +
            '</button>';
        }).join('');
        renderScene(curUni, ranked.slice(0, 5).map(function (r) { return r.c; }));
        return '<div class="crs__rez">' +
            '<div class="crs__dest__lbl"><i class="fa-solid fa-bolt"></i> Employer match</div>' +
            '<div class="crs__dests">' + rows + '</div>' +
            (srcRec
                ? '<div class="crs__src"><i class="fa-solid fa-book-open"></i> Data incl. <a href="' + esc(srcRec.url) + '" target="_blank" rel="noopener">' + esc(srcRec.src) + '</a></div>'
                : '') +
            '<div class="crs__disc"><img class="crs__disc__logo" src="images/logo2.png" alt=""> <span>Match = subject 40 · employer presence 30 · reputation 20 · degree 10 — not your personal odds.</span></div>' +
        '</div>';
    }

    function revealBars(root) {
        requestAnimationFrame(function () { requestAnimationFrame(function () {
            root.querySelectorAll('.crs__bar i').forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; });
        }); });
    }

    var BUBBLES = [[-88, -50, 5.2], [70, -62, 6.1], [100, 26, 5.6], [52, 88, 6.6], [-98, 38, 5.9]];
    function topCompanies(uni) {
        if (!uni) return D.companies.filter(function (c) { return c.rank; }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 5);
        var src = sourceFor(uni);
        return D.companies.map(function (c) { return { c: c, p: presence(uni, c, src) }; })
            .sort(function (a, b) { return b.p - a.p || (b.c.pre || 0) - (a.c.pre || 0); }).slice(0, 5).map(function (x) { return x.c; });
    }
    var sceneSig = '';
    function renderScene(uni, list) {
        if (!el) return;
        var sc = el.querySelector('#crsScene'); if (!sc) return;
        list = list && list.length ? list : topCompanies(uni);
        var sig = (uni ? uni.name : '') + '|' + list.map(function (c) { return c.name; }).join(',');
        if (sig === sceneSig) return;
        var coreChange = sceneSig.split('|')[0] !== (uni ? uni.name : '') || !sceneSig;
        sceneSig = sig;
        var core = sc.querySelector('.crs__core');
        if (coreChange) {
            core.innerHTML = uni ? '<b>' + esc(initials(uni.name)) + '</b>' : '<i class="fa-solid fa-briefcase"></i>';
            core.classList.toggle('is-uni', !!uni);
            core.classList.remove('is-pop'); void core.offsetWidth; core.classList.add('is-pop');
        }
        sc.querySelectorAll('.crs__bub').forEach(function (b, i) {
            var c = list[i];
            b.style.visibility = c ? '' : 'hidden';
            if (!c) return;
            b.style.setProperty('--c', c.color);
            b.title = c.name;
            b.innerHTML = logo(c, 30);
            b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop');
        });
    }
    function movePill() {
        if (!el) return;
        var on = el.querySelector('.crs__tab.on'), pill = el.querySelector('.crs__tabs__pill');
        if (!on || !pill) return;
        pill.style.width = on.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    }

    var LEVELS = ['None', 'Bachelor', 'Master', 'PhD'];   // "None" = just studied the subject (no degree)
    var el = null, tab = 'top', curUni = null, curLevel = 'None', curSubjects = [], panelOpen = false;
    function setTab(t) {
        tab = t;
        var c = el.querySelector('#crsContent');
        el.querySelectorAll('.crs__tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'); });
        movePill();
        renderScene(t === 'mine' ? curUni : null);
        if (t === 'top') { c.innerHTML = companiesHTML(); }
        else if (curUni) { c.innerHTML = mineHTML(curUni); refreshResults(); }
        else { c.innerHTML = countryTop10HTML(); }
    }
    function selectUni(name) {
        var u = resolveUni(name); if (!u) return;
        if (uniCC(u) !== curCC()) return;   // only universities in the current study destination
        curUni = u; curSubjects = []; panelOpen = false; curLevel = 'None';   // fresh pick (no degree by default — just the subject)
        var inp = el.querySelector('#crsSearch'); if (inp) inp.value = u.name;
        hideSug();
        setTab('mine');
    }
    // Recompute only the results area — the picker (and its search box) stays put.
    function refreshResults() { var out = el.querySelector('#crsOut'); if (!out) return; out.innerHTML = resultsHTML(curUni); if (curSubjects.length) revealBars(out); }
    function updatePicker() {
        var t = el.querySelector('#crsAddT'); if (t) t.textContent = addLabel();
        // While the drawer is open, don't touch the chips under the bar — that would
        // change the modal's height and make the fixed drawer look like it resized.
        if (!panelOpen) { var s = el.querySelector('#crsSubsum'); if (s) s.innerHTML = subsumHTML(); }
    }
    function updateLvlUI() {
        var lv = el.querySelector('.crs__lvl'); if (lv) lv.style.setProperty('--i', Math.max(0, LEVELS.indexOf(curLevel)));
        el.querySelectorAll('.crs__lvl__b').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-level') === curLevel); });
    }
    function setLevel(l) { curLevel = l; updateLvlUI(); }   // sets the degree for the NEXT subject (no live results while drawer open)
    // ── Subject sidebar drawer (slides in over ~40% of the modal) ──
    var dwEl = null, bdEl = null;
    function positionDrawer() {
        if (!dwEl || !bdEl) return;
        var panel = el.querySelector('.crs__panel'); if (!panel) return;
        var r = panel.getBoundingClientRect();
        var w = r.width <= 560 ? Math.round(r.width * 0.84) : Math.max(300, Math.round(r.width * 0.4));
        bdEl.style.top = r.top + 'px'; bdEl.style.left = r.left + 'px'; bdEl.style.width = r.width + 'px'; bdEl.style.height = r.height + 'px';
        dwEl.style.top = r.top + 'px'; dwEl.style.height = r.height + 'px'; dwEl.style.width = w + 'px'; dwEl.style.left = (r.right - w) + 'px';
    }
    function openPanel() {
        if (panelOpen) return;
        panelOpen = true;
        var add = el.querySelector('#crsAdd'); if (add) add.classList.add('on');
        bdEl = document.createElement('div'); bdEl.className = 'crs__bd';
        dwEl = document.createElement('aside'); dwEl.className = 'crs__dw'; dwEl.innerHTML = dwHTML();
        el.appendChild(bdEl); el.appendChild(dwEl);
        positionDrawer();
        requestAnimationFrame(function () { if (bdEl) bdEl.classList.add('on'); if (dwEl) dwEl.classList.add('on'); });
        var si = dwEl.querySelector('#crsSubSearch'); if (si) setTimeout(function () { si.focus(); }, 60);
    }
    function closePanel() {
        if (!panelOpen) return;
        panelOpen = false;
        var add = el.querySelector('#crsAdd'); if (add) add.classList.remove('on');
        var d = dwEl, b = bdEl; dwEl = null; bdEl = null;
        if (b) b.classList.remove('on'); if (d) d.classList.remove('on');
        setTimeout(function () { if (d) d.remove(); if (b) b.remove(); }, 340);
        updatePicker();     // now sync the chips under the bar (deferred while open)
        refreshResults();   // reveal the employer list only now, once the drawer closes
    }
    function togglePanel() { if (panelOpen) closePanel(); else openPanel(); }
    function refreshDrawer() { var body = el.querySelector('#crsDwBody'); if (!body) return; var si = el.querySelector('#crsSubSearch'); body.innerHTML = dwBodyHTML(si ? si.value : ''); }
    function toggleSubject(s) {
        var i = -1; for (var k = 0; k < curSubjects.length; k++) { if (norm(subjName(curSubjects[k])) === norm(s)) { i = k; break; } }
        if (i >= 0) { curSubjects.splice(i, 1); }
        else { curSubjects.push({ s: s, level: curLevel }); curLevel = 'None'; updateLvlUI(); }   // capture this subject's degree, then reset to "None"
        updatePicker();
        refreshDrawer();
        if (!panelOpen) refreshResults();   // while the drawer is open, keep the list hidden until it closes
    }
    function filterSubjects(q) { refreshDrawer(); }

    var sugBox;
    function showSug(q) {
        var nq = norm(q); if (!nq) { hideSug(); return; }
        var cc = curCC();
        var matches = allUnis().filter(function (u) {
            if (uniCC(u) !== cc) return false;   // restrict to the current study destination
            return norm(u.name).indexOf(nq) !== -1 || (u.short && norm(u.short).indexOf(nq) !== -1);
        }).slice(0, 7);
        if (!matches.length) { hideSug(); return; }
        sugBox.innerHTML = matches.map(function (u) { return '<button class="crs__sug" data-name="' + esc(u.name) + '"><i class="fa-solid fa-graduation-cap"></i> ' + esc(u.name) + (u.fromApp ? '' : ' <span class="crs__sug__t">tier ' + u.tier + '</span>') + '</button>'; }).join('');
        sugBox.style.display = 'block';
    }
    function hideSug() { if (sugBox) sugBox.style.display = 'none'; }

    function open(preUni) {
        el = document.createElement('div');
        el.className = 'crs__overlay';
        el.innerHTML =
            '<div class="crs__panel" role="dialog" aria-modal="true" aria-label="Career paths">' +
                '<button class="crs__close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="crs__hero">' +
                    '<span class="crs__hero__bg"><span class="crs__hero__orb"></span><span class="crs__hero__orb crs__hero__orb--2"></span><span class="crs__hero__grid"></span></span>' +
                    '<div class="crs__hero__in"><div class="crs__eyebrow"><i class="fa-solid fa-briefcase"></i> Career paths</div>' +
                    '<h2 class="crs__title">Where can your degree take you?</h2>' +
                    '<div class="crs__search"><i class="fa-solid fa-magnifying-glass"></i>' +
                        '<input id="crsSearch" type="text" placeholder="Search your university…" autocomplete="off">' +
                        '<div class="crs__sugs" id="crsSugs"></div></div>' +
                    '</div>' +
                    '<div class="crs__scene" id="crsScene" aria-hidden="true">' +
                        '<span class="crs__halo"></span><span class="crs__ring"></span><span class="crs__ring crs__ring--2"></span>' +
                        '<div class="crs__core"></div>' +
                        BUBBLES.map(function (b, i) { return '<span class="crs__bub" style="--x:' + b[0] + 'px;--y:' + b[1] + 'px;--dur:' + b[2] + 's;--dl:' + (-i * 1.3) + 's"></span>'; }).join('') +
                    '</div>' +
                '</div>' +
                '<div class="crs__tabs" role="tablist"><span class="crs__tabs__pill" aria-hidden="true"></span>' +
                    '<button class="crs__tab on" data-tab="top" role="tab" aria-selected="true"><i class="fa-solid fa-earth-americas"></i> Top 10</button>' +
                    '<button class="crs__tab" data-tab="mine" role="tab" aria-selected="false"><i class="fa-solid fa-location-dot"></i> Top 10 · ' + esc(currentCountry().name.replace(/^the /, '')) + '</button></div>' +
                '<div class="crs__content" id="crsContent"></div>' +
            '</div>';
        sceneSig = '';
        document.body.appendChild(el);
        document.body.style.overflow = 'hidden';
        sugBox = el.querySelector('#crsSugs');
        requestAnimationFrame(function () { el.classList.add('open'); movePill(); });
        setTab('top');

        el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
        el.querySelector('.crs__close').addEventListener('click', close);
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onWinResize);   // keep the drawer aligned to the modal
        el.querySelectorAll('.crs__tab').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); }); });
        var inp = el.querySelector('#crsSearch');
        inp.addEventListener('input', function () { showSug(inp.value); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var f = sugBox.querySelector('.crs__sug'); if (f) selectUni(f.dataset.name); else selectUni(inp.value); } });
        // Search inside the open subject panel.
        el.addEventListener('input', function (e) { if (e.target && e.target.id === 'crsSubSearch') filterSubjects(e.target.value); });
        el.addEventListener('click', function (e) {
            if (e.target.closest('.crs__bd')) { closePanel(); return; }   // click the blurred backdrop closes the drawer
            var lv = e.target.closest('[data-level]'); if (lv) { setLevel(lv.getAttribute('data-level')); return; }
            var add = e.target.closest('[data-add]'); if (add) { togglePanel(); return; }
            var spx = e.target.closest('[data-spx]'); if (spx) { closePanel(); return; }
            var subj = e.target.closest('[data-subj]'); if (subj) { toggleSubject(subj.getAttribute('data-subj')); return; }
            var rm = e.target.closest('[data-rm]'); if (rm) { toggleSubject(rm.getAttribute('data-rm')); return; }
            var co = e.target.closest('[data-co]'); if (co) { openCompany(findCompany(co.dataset.co)); return; }
            var s = e.target.closest('.crs__sug'); if (s) { selectUni(s.dataset.name); return; }
            if (!e.target.closest('.crs__search')) hideSug();
        });

        // Optional: open straight onto a given university, ready to pick subjects.
        if (preUni) {
            var pu = (typeof preUni === 'string') ? resolveUni(preUni)
                : { name: preUni.name, short: preUni.short || preUni.abbr || '', tier: preUni.tier || preUni.diff || 3, fields: preUni.fields || [], cc: preUni.cc || preUni.country_code, fromApp: true };
            if (pu) { curUni = pu; curSubjects = []; curLevel = 'None'; panelOpen = false; var si = el.querySelector('#crsSearch'); if (si) si.value = pu.name; hideSug(); setTab('mine'); }
        }
    }
    function onWinResize() { if (panelOpen) positionDrawer(); movePill(); }

    // Top employers that recruit from a university (regardless of subject) — for
    // the saved-university cards. Returns [{ name, color, logo(html) }].
    window.crsUniRecruiters = function (uniLike, n) {
        var uni = (typeof uniLike === 'string') ? resolveUni(uniLike)
            : { name: uniLike.name, short: uniLike.short || uniLike.abbr || '', tier: uniLike.tier || uniLike.diff || 3, fields: uniLike.fields || [], cc: uniLike.cc || uniLike.country_code, fromApp: true };
        if (!uni) return [];
        var srcRec = sourceFor(uni);
        return D.companies.map(function (c) { return { c: c, p: presence(uni, c, srcRec) }; })
            .sort(function (a, b) { return b.p - a.p || (b.c.pre || 0) - (a.c.pre || 0); })
            .slice(0, n || 3)
            .map(function (x) { return { name: x.c.name, color: x.c.color, logo: logo(x.c, 30) }; });
    };

    // ── Company detail modal (stacked above the careers modal) ──
    function diffLabel(sel) { return sel >= 0.85 ? 'Extremely hard' : sel >= 0.7 ? 'Very hard' : sel >= 0.55 ? 'Hard' : sel >= 0.4 ? 'Moderate' : 'Accessible'; }

    // Ranks (computed once, cached). Global = market-cap top-10 first, then by
    // prominence; country = standing among the employers we list for that country.
    var _globalOrder = null, _countryOrder = {};
    function globalRank(c) {
        if (!_globalOrder) _globalOrder = D.companies.slice().sort(function (a, b) {
            var ra = a.rank || 999, rb = b.rank || 999;
            return ra !== rb ? ra - rb : (b.pre || 0) - (a.pre || 0);
        }).map(function (x) { return x.name; });
        var i = _globalOrder.indexOf(c.name); return i < 0 ? null : i + 1;
    }
    function countryRank(c) {
        var cc = companyCC(c); if (!cc) return null;
        if (!_countryOrder[cc]) _countryOrder[cc] = D.companies.filter(function (x) { return companyCC(x) === cc; })
            .sort(function (a, b) { return (b.pre || 0) - (a.pre || 0) || (a.name < b.name ? -1 : 1); }).map(function (x) { return x.name; });
        var i = _countryOrder[cc].indexOf(c.name); return i < 0 ? null : i + 1;
    }
    // Header identity widgets (founded · people · world # · country #), uni-style.
    function factsHTML(c) {
        var f = (D.facts || {})[c.name] || [];
        var ctry = currentCountry(), gr = globalRank(c), cr = countryRank(c);
        var w = [];
        if (f[0]) w.push(['fa-flag-checkered', f[0], 'founded']);
        if (f[1]) w.push(['fa-users', f[1], 'employees']);
        if (gr) w.push(['fa-earth-americas', '#' + gr, 'in the world']);
        if (cr && CC_NAME[companyCC(c)]) w.push(['fa-location-dot', '#' + cr, 'in ' + CC_NAME[companyCC(c)].replace(/^the /, '')]);
        if (!w.length) return '';
        return '<div class="crs__cx__facts">' + w.map(function (x) {
            return '<div class="crs__cx__fact"><i class="fa-solid ' + x[0] + '"></i><div><b>' + esc(String(x[1])) + '</b><span>' + esc(x[2]) + '</span></div></div>';
        }).join('') + '</div>';
    }
    var coEl = null;
    function openCompany(c) {
        if (!c) return;
        coEl = document.createElement('div');
        coEl.className = 'crs__co__ov';
        coEl.setAttribute('role', 'dialog'); coEl.setAttribute('aria-modal', 'true'); coEl.setAttribute('aria-label', c.name);
        var stat = function (ic, v, l) { return '<div class="crs__cx__stat"><i class="fa-solid ' + ic + '"></i><div><b>' + v + '</b><span>' + l + '</span></div></div>'; };
        var site = c.domain ? '<a class="crs__cx__site" href="https://' + c.domain + '" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Visit website</a>' : '';
        coEl.innerHTML =
            '<div class="crs__cx" style="--c:' + c.color + '">' +
                '<div class="crs__cx__hero">' +
                    '<span class="crs__cx__mesh"></span><span class="crs__cx__orb"></span>' +
                    '<button class="crs__cx__close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
                    '<div class="crs__cx__hero__in">' +
                        '<div class="crs__cx__eyebrow"><i class="fa-solid fa-briefcase"></i> ' + esc(c.sector) + (c.rank ? ' · #' + c.rank + ' worldwide' : '') + '</div>' +
                        '<div class="crs__cx__nmrow"><h3 class="crs__cx__nm">' + esc(c.name) + '</h3>' + factsHTML(c) + '</div>' +
                        '<div class="crs__cx__loc"><i class="fa-solid fa-location-dot"></i> ' + esc(c.city) + ', ' + esc(c.country) + '</div>' +
                        site +
                    '</div>' +
                    heroVisual(c) +
                '</div>' +
                '<div class="crs__cx__body">' +
                    '<div class="crs__cx__stats">' +
                        '<div class="crs__cx__stat crs__cx__stat--pay"><i class="fa-solid fa-sack-dollar"></i><b>' + esc(c.salary) + '</b></div>' +
                        stat('fa-gauge-high', diffLabel(c.sel), 'entry difficulty') +
                        stat('fa-user-graduate', c.degrees.length + ' fields', 'commonly hired') +
                        stat('fa-briefcase', c.roles.length + ' roles', 'they hire for') +
                    '</div>' +
                    (window.careerOddsQuickSave ? saveJobHTML(c) : '') +
                    (window.openCareerOdds ? '<button type="button" class="crs__cx__odds" data-odds>' +
                        '<span class="crs__cx__odds__ic" aria-hidden="true"><i class="fa-solid fa-bullseye"></i></span>' +
                        '<span class="crs__cx__odds__t"><b>What are my odds?</b><small>' + esc(oddsLine(c)) + '</small></span>' +
                        '<i class="fa-solid fa-arrow-right crs__cx__odds__go" aria-hidden="true"></i></button>' : '') +
                    '<div class="crs__cx__lbl"><i class="fa-solid fa-thumbs-up"></i> Why students consider it</div>' +
                    '<ul class="crs__cx__perks">' + (c.perks || []).map(function (p) { return '<li><span class="crs__cx__pk"><i class="fa-solid fa-check"></i></span> ' + esc(p) + '</li>'; }).join('') + '</ul>' +
                    '<div class="crs__cx__grid">' +
                        '<div><div class="crs__cx__lbl"><i class="fa-solid fa-briefcase"></i> Roles they hire</div><div class="crs__chips">' + c.roles.map(chip).join('') + '</div></div>' +
                        '<div><div class="crs__cx__lbl"><i class="fa-solid fa-graduation-cap"></i> Degrees they want</div><div class="crs__chips">' + c.degrees.map(chip).join('') + '</div></div>' +
                    '</div>' +
                    '<div class="crs__cx__lbl"><i class="fa-solid fa-building-columns"></i> Where they recruit from</div><div class="crs__chips">' + c.unis.map(function (u) { var uu = resolveUni(u); return '<span class="crs__chip crs__chip--uni">' + esc(uu ? (uu.short || uu.name) : u) + '</span>'; }).join('') + '</div>' +
                    '<div class="crs__cx__note"><i class="fa-solid fa-circle-info"></i> Approximate figures · pay is an early-career estimate.</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(coEl);
        requestAnimationFrame(function () { coEl.classList.add('open'); });
        function cclose() { if (!coEl) return; coEl.classList.remove('open'); var e = coEl; setTimeout(function () { e.remove(); }, 240); coEl = null; document.removeEventListener('keydown', cKey); }
        function cKey(ev) { if (ev.key === 'Escape') { ev.stopPropagation(); cclose(); } }
        coEl.addEventListener('mousedown', function (ev) { if (ev.target === coEl) cclose(); });
        coEl.querySelector('.crs__cx__close').addEventListener('click', cclose);
        var od = coEl.querySelector('[data-odds]'); if (od) od.addEventListener('click', function () {
            var sj = coEl && coEl.querySelector('.crs__sj'), r = sj && sj.querySelector('.crs__sj__role.on'), v = sj && +sj.querySelector('.crs__sj__in').value;
            window.openCareerOdds(c.name, r ? { role: r.getAttribute('data-role'), salary: v ? v * 1000 : 0 } : null);
        });
        bindSaveJob(coEl, c);
        document.addEventListener('keydown', cKey);
    }
    // "Save this job": pick the role, set the salary you want, save it to the Overview
    // (company + job + salary, with your odds worked out from your saved answers).
    function saveJobHTML(c) {
        var saved = window.careerOddsSavedEntry ? window.careerOddsSavedEntry(c.name) : null;
        var role = saved && c.roles.indexOf(saved.role) >= 0 ? saved.role : c.roles[0];
        var typ = window.careerOddsTypical(c.name, role) || { v: 50000, sym: '$', label: '' };
        var k = Math.round((saved ? saved.sal : typ.v) / 1000);
        return '<section class="crs__sj" aria-label="Save this job">' +
            '<div class="crs__sj__hd"><b>Save this job</b><small>It shows up on your Overview next to your scholarships</small></div>' +
            '<div class="crs__sj__roles" role="radiogroup" aria-label="Job">' + c.roles.map(function (r) {
                return '<button type="button" class="crs__sj__role' + (r === role ? ' on' : '') + '" role="radio" aria-checked="' + (r === role) + '" data-role="' + esc(r) + '">' + esc(r) + '</button>';
            }).join('') + '</div>' +
            '<div class="crs__sj__row">' +
                '<label class="crs__sj__sal"><span class="crs__sj__cur">' + esc(typ.sym.trim()) + '</span>' +
                    '<input class="crs__sj__in" type="number" inputmode="numeric" min="1" max="9999" step="1" value="' + k + '" aria-label="Salary you want, in thousands">' +
                    '<span class="crs__sj__k">k / year</span></label>' +
                '<span class="crs__sj__typ">typical <b>' + esc(typ.label) + '</b></span>' +
                '<button type="button" class="crs__sj__btn' + (saved ? ' is-saved' : '') + '"><i class="fa-' + (saved ? 'solid' : 'regular') + ' fa-bookmark" aria-hidden="true"></i><span>' + (saved ? 'Saved' : 'Save') + '</span></button>' +
            '</div>' +
        '</section>';
    }
    function bindSaveJob(root, c) {
        var sj = root.querySelector('.crs__sj'); if (!sj) return;
        var input = sj.querySelector('.crs__sj__in'), btn = sj.querySelector('.crs__sj__btn'), typEl = sj.querySelector('.crs__sj__typ b'), edited = false;
        function dirty() { btn.classList.remove('is-saved'); btn.querySelector('i').className = 'fa-regular fa-bookmark'; btn.querySelector('span').textContent = window.careerOddsSavedEntry(c.name) ? 'Update' : 'Save'; }
        sj.addEventListener('click', function (e) {
            var r = e.target.closest('.crs__sj__role');
            if (r) {
                sj.querySelectorAll('.crs__sj__role').forEach(function (x) { var on = x === r; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
                var t = window.careerOddsTypical(c.name, r.getAttribute('data-role'));
                if (t) { typEl.textContent = t.label; if (!edited) input.value = Math.round(t.v / 1000); }
                dirty(); return;
            }
            if (e.target.closest('.crs__sj__btn')) {
                var role = sj.querySelector('.crs__sj__role.on').getAttribute('data-role'), k = Math.max(1, +input.value || 0);
                var res = window.careerOddsQuickSave(c.name, role, k * 1000);
                if (!res) return;
                btn.classList.add('is-saved'); btn.querySelector('i').className = 'fa-solid fa-bookmark'; btn.querySelector('span').textContent = 'Saved · ' + res.pctLabel;
                btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop');
                var ol = root.querySelector('.crs__cx__odds__t small'); if (ol) ol.textContent = oddsLine(c);
            }
        });
        input.addEventListener('input', function () { edited = true; dirty(); });
    }
    // One line under "What are my odds?": the saved result if there is one.
    function oddsLine(c) {
        var s = window.careerOddsSaved ? window.careerOddsSaved(c.name) : null;
        return s ? 'Saved · ' + s.role + ' · ' + s.pctLabel + ' chance' : 'Pick a role and salary, answer a few questions, get your chance';
    }

    function onKey(e) { if (e.key === 'Escape') { if (coEl) return; if (panelOpen) { closePanel(); return; } close(); } }
    function close() { if (!el) return; document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onWinResize); panelOpen = false; dwEl = null; bdEl = null; el.classList.remove('open'); document.body.style.overflow = ''; var e = el; setTimeout(function () { e.remove(); }, 280); el = null; curUni = null; tab = 'top'; }
    window.openCareers = open;
    // Shared with the career-odds calculator (careerOdds.js).
    window.crsApi = {
        companies: D.companies, find: findCompany, logo: logo, resolveUni: resolveUni, allUnis: allUnis,
        isTarget: isTarget, subjectRel: subjectRel1, subjects: ALL_SUBJECTS, companyCC: companyCC,
        countryName: function (c) { return (CC_NAME[companyCC(c)] || c.country || '').replace(/^the /, ''); },
        isOpen: function () { return !!coEl; }
    };
    // University cards render before this file loads — repaint so their recruiter
    // logos appear now that crsUniRecruiters exists.
    try { if (typeof window.renderSaved === 'function') window.renderSaved(); } catch (e) {}
    try { if (typeof window.renderBudgetPage === 'function') window.renderBudgetPage(); } catch (e) {}
})();
