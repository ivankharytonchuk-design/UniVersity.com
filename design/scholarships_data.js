/* ════════════════════════════════════════════════════════════════════
   Scholarships — card data (one record = one card)

   Every record summarises a real programme. Figures (amounts, number of
   awards, deadlines) come from the official pages and were checked on
   2026-09-26; anything we couldn't confirm is left out or marked
   "reported" (third-party figure). Always confirm on the official page.

   Scholarship
   ├── id, name, category ('academic'|'need'|'leadership'|'research'), levels[]
   ├── provider        who runs it, when it isn't the university itself
   ├── difficulty      { score: 1–10, basis }  ← UniScout ESTIMATE, not an
   │                     official figure. Rule of thumb:
   │                       known success rate ≤2% → 10 · ≤5% → 9 · ≤10% → 8
   │                       small fixed number of awards for a large pool → 8–10
   │                       large share of students funded → 3–5
   │                       automatic if you qualify (income-based) → 1–2
   │                     `basis` is shown on the card so students see why.
   ├── awarded         { big, small, reported }  how many were given recently
   ├── gives[]         what you get — short lines
   ├── takes[]         every requirement — short lines
   ├── how             { method: 'automatic'|'separate'|'course-form'|'aid-forms'|'varies', steps[] }
   ├── when            { text, short, deadlines: [{ date: 'YYYY-MM-DD', label }], cycle }
   │                     short = 1–2 words for compact tiles (e.g. 'Dec–Jan')
   │                     deadlines are only listed when confirmed for `cycle`
   └── url             official page
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var OX_UG = 'https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding';
    var CAM_UG = 'https://www.undergraduate.study.cam.ac.uk/fees-and-finance';

    var UNIVERSITIES = {
        /* ── United Kingdom ─────────────────────────────────────────── */
        'gb:oxford': {
            aidUrl: OX_UG,
            scholarships: [
                {
                    id: 'ox-clarendon', name: 'Clarendon Scholarship', category: 'academic', levels: ['master', 'phd'],
                    provider: 'Clarendon Fund, University of Oxford',
                    difficulty: { score: 9, basis: 'Around 230 new awards a year, picked on academic merit from all eligible Oxford graduate applicants.' },
                    awarded: { big: '230+', small: 'new awards in 2025/26' },
                    gives: ['All course fees', 'A grant for living costs', 'For the whole fee-paying length of your course'],
                    takes: ['Academic excellence and potential', 'Any nationality', 'An eligible Oxford graduate course (DPhil or most master’s)', 'Apply by your course’s December or January deadline'],
                    how: { method: 'automatic', steps: ['Apply to an eligible Oxford graduate course', 'You’re considered automatically — no extra form', 'Awards are confirmed after admission'] },
                    when: { text: 'Your course’s December or January application deadline', short: 'Dec–Jan' },
                    url: 'https://www.ox.ac.uk/clarendon'
                },
                {
                    id: 'ox-rhodes', name: 'Rhodes Scholarship', category: 'leadership', levels: ['master', 'phd'],
                    provider: 'Rhodes Trust',
                    difficulty: { score: 10, basis: 'About 1% win — e.g. 32 US scholars from almost 2,800 applicants (2025).' },
                    awarded: { big: '100+', small: 'a year worldwide' },
                    gives: ['All Oxford university & college fees', '£20,400 a year stipend (2025–26)', 'For 2–3 years'],
                    takes: ['Citizen of an eligible Rhodes country or region', 'A completed bachelor’s degree before you start', 'Academic excellence, character, leadership and service', 'Age and residency limits set by your country', 'Admission to a full-time Oxford postgraduate course'],
                    how: { method: 'separate', steps: ['Apply on the Rhodes portal for your country', 'Interview if shortlisted', 'Also apply to your Oxford course'] },
                    when: { text: 'Between June and October, depending on your country', short: 'Jun–Oct' },
                    url: 'https://www.rhodeshouse.ox.ac.uk/scholarships/'
                },
                {
                    id: 'ox-reach', name: 'Reach Oxford Scholarship', category: 'need', levels: ['bachelor'],
                    difficulty: { score: 10, basis: 'Only a handful of awards a year across the whole university.' },
                    awarded: { big: '2–3', small: 'a year', reported: true },
                    gives: ['All university & college fees', 'A grant for living costs', 'Help with travel costs', 'Renewed each year with good progress'],
                    takes: ['Citizen of an eligible low-income country (list on the official page)', 'Can’t study in your home country (political or financial reasons, or no suitable course)', 'Can’t afford Oxford without support', 'Meet your Oxford course’s entry requirements'],
                    how: { method: 'separate', steps: ['Apply for your course through UCAS', 'Fill in the separate Reach Oxford application'] },
                    when: { text: 'Usually February, after your UCAS application', short: 'Usually Feb' },
                    url: 'https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/oxford-bursaries-and-scholarships/reach-oxford'
                },
                {
                    id: 'ox-bursary', name: 'Oxford Bursary', category: 'need', levels: ['bachelor'],
                    difficulty: { score: 2, basis: 'Automatic for UK students whose household income qualifies — getting into Oxford is the hard part.' },
                    awarded: { big: '1 in 4', small: 'UK undergraduates get one' },
                    gives: ['Yearly cash you don’t pay back', 'Amount depends on household income'],
                    takes: ['UK (Home) fee status', 'Household income below the published limit'],
                    how: { method: 'automatic', steps: ['Apply for UK student finance', 'Agree to share your household income', 'Oxford pays it automatically'] },
                    when: { text: 'No separate deadline — it comes through Student Finance', short: 'No deadline' },
                    url: 'https://www.ox.ac.uk/admissions/undergraduate/fees-and-funding/oxford-bursaries-and-scholarships'
                }
            ]
        },
        'gb:cambridge': {
            aidUrl: CAM_UG,
            scholarships: [
                {
                    id: 'cam-gates', name: 'Gates Cambridge Scholarship', category: 'academic', levels: ['master', 'phd'],
                    provider: 'Gates Cambridge Trust',
                    difficulty: { score: 10, basis: 'Around 70 awards a year for applicants from every country outside the UK.' },
                    awarded: { big: '~70', small: 'a year (+25 extra in 2025)' },
                    gives: ['Full tuition', '£23,152 a year for living costs (2026–27)', 'Flights at the start and end', 'Visa costs + UK health surcharge'],
                    takes: ['Citizen of any country outside the UK', 'A full-time postgraduate course at Cambridge (PhD, MPhil, MSc…)', 'Academic excellence', 'Leadership potential', 'Commitment to improving the lives of others'],
                    how: { method: 'course-form', steps: ['Apply to your Cambridge course', 'Tick Gates and add the Gates statement + reference in the same form', 'Interview if shortlisted'] },
                    when: {
                        cycle: '2027/28',
                        deadlines: [
                            { date: '2026-10-14', label: 'US citizens living in the US' },
                            { date: '2026-12-08', label: 'Everyone else — earlier courses' },
                            { date: '2027-01-06', label: 'Everyone else — later courses' }
                        ]
                    },
                    url: 'https://www.gatescambridge.org/apply/timeline/'
                },
                {
                    id: 'cam-trust', name: 'Cambridge Trust Scholarships', category: 'academic', levels: ['master', 'phd'],
                    provider: 'Cambridge Trust',
                    difficulty: { score: 8, basis: 'About 350 new awards a year across all subjects — competitive, but five times more awards than Gates.' },
                    awarded: { big: '350', small: 'new awards a year' },
                    gives: ['Full or partial funding — depends on the award', 'Some awards include living costs'],
                    takes: ['Academic excellence', 'Nationality and subject rules differ per award', 'Some awards also look at financial need'],
                    how: { method: 'course-form', steps: ['Apply to your Cambridge course by its funding deadline', 'Fill in the funding section of the same form', 'You’re matched to the awards you qualify for'] },
                    when: { text: 'Your course’s funding deadline — usually December or early January', short: 'Dec–Jan' },
                    url: 'https://www.cambridgetrust.org/scholarships'
                },
                {
                    id: 'cam-bursary', name: 'Cambridge Bursary', category: 'need', levels: ['bachelor'],
                    difficulty: { score: 2, basis: 'Automatic for UK students whose household income qualifies.' },
                    awarded: { big: '3,300+', small: 'a year — 1 in 3 UK undergraduates' },
                    gives: ['Up to £3,500 a year, non-repayable', 'The full £3,500 if household income is £25,000 or less'],
                    takes: ['UK (Home) fee status', 'Household income below the limit (assessed by Student Finance)'],
                    how: { method: 'automatic', steps: ['Apply for UK student finance', 'Agree to share your household income', 'Cambridge pays it automatically'] },
                    when: { text: 'No separate deadline — it comes through Student Finance', short: 'No deadline' },
                    url: 'https://www.cambridgestudents.cam.ac.uk/fees-and-funding/cambridge-bursary-scheme'
                }
            ]
        },
        'gb:imperial': {
            aidUrl: 'https://www.imperial.ac.uk/study/fees-and-funding/',
            scholarships: [
                {
                    id: 'imp-presidents-phd', name: 'President’s PhD Scholarships', category: 'research', levels: ['phd'],
                    difficulty: { score: 9, basis: '50 scholarships a year across the whole of Imperial.' },
                    awarded: { big: '50', small: 'a year' },
                    gives: ['Full tuition fees', 'A living stipend (e.g. £22,780 a year, 2025–26 London rate)', '£2,000 a year for research costs', 'For 3.5 years'],
                    takes: ['An outstanding academic record', 'A PhD place and supervisor at Imperial', 'Any nationality'],
                    how: { method: 'varies', steps: ['Find a supervisor and apply for a PhD place', 'Follow the application route on the official page'] },
                    when: { text: 'Set each year — check the official page', short: 'Set yearly' },
                    url: 'https://www.imperial.ac.uk/study/fees-and-funding/postgraduate-doctoral/grants-scholarships/presidents-phd/'
                },
                {
                    id: 'imp-bursary', name: 'Imperial Bursary', category: 'need', levels: ['bachelor'],
                    difficulty: { score: 1, basis: 'Every Home undergraduate with household income under £70,000 gets it automatically.' },
                    awarded: { big: 'All', small: 'eligible students — it’s automatic' },
                    gives: ['£1,000–£5,000 a year, non-repayable', '£5,000 if household income is £16,000 or less (2025 entry)'],
                    takes: ['UK (Home) fee status', 'Household income under £70,000'],
                    how: { method: 'automatic', steps: ['Apply for UK student finance', 'Agree to share your household income', 'Imperial pays it automatically'] },
                    when: { text: 'No separate deadline — it comes through Student Finance', short: 'No deadline' },
                    url: 'https://www.imperial.ac.uk/study/fees-and-funding/undergraduate/bursaries-grants-scholarships/imperial-bursary/'
                }
            ]
        },

        /* ── United States ──────────────────────────────────────────── */
        'us:stanford': {
            aidUrl: 'https://financialaid.stanford.edu/',
            scholarships: [
                {
                    id: 'stan-kh', name: 'Knight-Hennessy Scholars', category: 'leadership', levels: ['master', 'phd'],
                    difficulty: { score: 10, basis: '87 scholars from 5,144 eligible applications for 2026 — under 2%.' },
                    awarded: { big: '87', small: 'from 9,223 applications (2026)' },
                    gives: ['Full tuition for any Stanford graduate degree', 'A stipend for living and study costs', 'Up to 3 years', 'A leadership development programme'],
                    takes: ['A bachelor’s degree earned within the eligibility window', 'Admission to your Stanford graduate programme (applied for separately)', 'Independent thinking, purposeful leadership, civic mindset', 'Any nationality'],
                    how: { method: 'separate', steps: ['Submit the Knight-Hennessy application', 'Apply to your Stanford programme separately', 'Finalists are invited to an interview weekend'] },
                    when: { cycle: '2027 cohort', deadlines: [{ date: '2026-10-06', label: '1 pm Pacific time' }] },
                    url: 'https://knight-hennessy.stanford.edu/admission'
                },
                {
                    id: 'stan-aid', name: 'Stanford Financial Aid', category: 'need', levels: ['bachelor'],
                    difficulty: { score: 3, basis: 'Admitted students get aid that meets their need — but aid for international students is limited.' },
                    awarded: { big: '46%', small: 'of undergrads get a Stanford scholarship' },
                    gives: ['No tuition if your family earns under $150,000 (typical assets)', 'No tuition, room or board under $100,000', 'Above that: aid based on your family’s need'],
                    takes: ['Admission to Stanford', 'Financial need, shown on the aid forms', 'A separate, more limited policy for international students'],
                    how: { method: 'aid-forms', steps: ['Send the financial aid forms (e.g. CSS Profile) with your application', 'Stanford works out your need and sends an aid offer'] },
                    when: { text: 'With your admission application (early or regular round)', short: 'With application' },
                    url: 'https://financialaid.stanford.edu/'
                }
            ]
        },
        'us:harvard': {
            aidUrl: 'https://college.harvard.edu/financial-aid',
            scholarships: [
                {
                    id: 'harv-aid', name: 'Harvard College Financial Aid', category: 'need', levels: ['bachelor'],
                    difficulty: { score: 2, basis: 'If you’re admitted and have financial need, you get aid — same policy for international students.' },
                    awarded: { big: '55%', small: 'of undergrads get need-based aid' },
                    gives: ['Free — tuition, housing and food — if your family earns $100,000 or less', 'No tuition if your family earns $200,000 or less', 'Grants you don’t pay back'],
                    takes: ['Admission to Harvard College', 'Financial need, shown on the aid forms', 'No merit or sports scholarships — aid is need-based only'],
                    how: { method: 'aid-forms', steps: ['Send the financial aid forms (e.g. CSS Profile) when you apply', 'Your aid offer arrives with your admission decision'] },
                    when: { text: 'With your admission application (early or regular round)', short: 'With application' },
                    url: 'https://college.harvard.edu/financial-aid'
                }
            ]
        },
        'us:mit': {
            aidUrl: 'https://sfs.mit.edu/',
            scholarships: [
                {
                    id: 'mit-scholarship', name: 'MIT Scholarship', category: 'need', levels: ['bachelor'],
                    difficulty: { score: 2, basis: 'Given to every admitted student with financial need.' },
                    awarded: { big: '57%', small: 'of undergrads (2024–25)' },
                    gives: ['No tuition if your family earns under $200,000 (typical assets)', 'Everything covered under $100,000 — tuition, housing, food, books', 'A grant, not a loan'],
                    takes: ['Admission to MIT', 'Financial need, shown on the aid forms', 'No merit or sports scholarships at MIT'],
                    how: { method: 'aid-forms', steps: ['Send the financial aid forms (e.g. CSS Profile) when you apply', 'MIT works out your need and sends an aid offer'] },
                    when: { text: 'With your admission application (early or regular round)', short: 'With application' },
                    url: 'https://sfs.mit.edu/undergraduate-students/the-cost-of-attendance/making-mit-affordable/'
                }
            ]
        },

        /* ── Switzerland ────────────────────────────────────────────── */
        'ch:eth-zurich': {
            aidUrl: 'https://ethz.ch/en/studies/financial.html',
            scholarships: [
                {
                    id: 'eth-esop', name: 'Excellence Scholarship & Opportunity Programme (ESOP)', category: 'academic', levels: ['master'],
                    difficulty: { score: 9, basis: 'About 60 awards for all ETH Master’s applicants — aimed at the very top of the class.' },
                    awarded: { big: '~60', small: 'for 2027/28 entry' },
                    gives: ['Full tuition waiver', 'CHF 12,000 per semester for living and study (CHF 13,500 from autumn 2027)', 'For the regular length of the Master’s'],
                    takes: ['Excellent Bachelor’s results — top of your class', 'Applying to an ETH Zurich Master’s programme', 'Any nationality'],
                    how: { method: 'separate', steps: ['Apply for an ETH Master’s in the autumn window', 'Submit the ESOP application with it'] },
                    when: { text: 'With your Master’s application — usually by mid-December', short: 'Mid-Dec' },
                    url: 'https://ethz.ch/students/en/studies/financial/scholarships/excellencescholarship.html'
                }
            ]
        },
        'ch:epfl': {
            aidUrl: 'https://www.epfl.ch/education/master/',
            scholarships: [
                {
                    id: 'epfl-excellence', name: 'EPFL Excellence Fellowships', category: 'academic', levels: ['master'],
                    difficulty: { score: 8, basis: 'A limited number per section for top students; EPFL doesn’t publish how many.' },
                    awarded: { big: '—', small: 'number not published' },
                    gives: ['CHF 10,000 per semester', 'For the standard length of the Master’s (max. 4 semesters)'],
                    takes: ['Excellent Bachelor’s results', 'Applying to an EPFL Master’s programme', 'Any nationality'],
                    how: { method: 'course-form', steps: ['Apply for an EPFL Master’s programme', 'Request the fellowship in the same application'] },
                    when: { text: 'With your Master’s application — usually the December round', short: 'December' },
                    url: 'https://www.epfl.ch/education/master/master-excellence-fellowships'
                }
            ]
        },

        /* ── Netherlands ────────────────────────────────────────────── */
        'nl:tud': {
            aidUrl: 'https://www.tudelft.nl/en/education/study-programme-orientation/practical-matters/scholarships',
            scholarships: [
                {
                    id: 'tud-vaneffen', name: 'Justus & Louise van Effen Excellence Scholarship', category: 'academic', levels: ['master'],
                    difficulty: { score: 9, basis: 'At least 16 a year (2 per faculty), aimed at the top 10% of graduates.' },
                    awarded: { big: '16+', small: 'a year — 2 per faculty' },
                    gives: ['Full tuition fees', 'A contribution to living costs'],
                    takes: ['International applicant (check the official definition)', 'Top 10% of your previous programme', 'Previous study relevant to the MSc', 'Admission to a TU Delft MSc'],
                    how: { method: 'separate', steps: ['Apply for your TU Delft MSc before the early deadline', 'Submit the scholarship application in the window TU Delft announces'] },
                    when: { text: 'MSc application usually by 1 December; the scholarship window follows', short: 'From Dec' },
                    url: 'https://www.tudelft.nl/en/education/study-programme-orientation/practical-matters/scholarships'
                }
            ]
        },
        'nl:uva': {
            aidUrl: 'https://www.uva.nl/en/education/fees-and-funding/masters-scholarships-and-loans/scholarships-and-loans.html',
            scholarships: [
                {
                    id: 'uva-ams', name: 'Amsterdam Merit Scholarship', category: 'academic', levels: ['master'],
                    difficulty: { score: 8, basis: 'Few awards per faculty — e.g. 12 from 150 applicants in Business Administration.' },
                    awarded: { big: 'Few', small: 'per faculty — e.g. 12 of 150' },
                    gives: ['€25,900 for most programmes (2026–27)', 'Amount varies by faculty'],
                    takes: ['Non-EU/EEA student', 'Excellent academic results', 'Admission to an eligible UvA Master’s'],
                    how: { method: 'separate', steps: ['Apply for an eligible UvA Master’s', 'Submit the scholarship application before its deadline'] },
                    when: { text: 'Usually January', short: 'January' },
                    url: 'https://www.uva.nl/en/education/fees-and-funding/masters-scholarships-and-loans/amsterdam-merit-scholarship/amsterdam-merit-scholarship.html'
                }
            ]
        },

        /* ── Sweden ─────────────────────────────────────────────────── */
        'se:kth': {
            aidUrl: 'https://www.kth.se/en/studies/master/admissions/scholarships',
            scholarships: [
                {
                    id: 'kth-scholarship', name: 'KTH Scholarship', category: 'academic', levels: ['master'],
                    difficulty: { score: 8, basis: '65 of 803 eligible applicants were nominated in 2025 — about 8%.' },
                    awarded: { big: '65', small: 'of 803 applicants (2025)' },
                    gives: ['Your full tuition fee', 'Year 2 too, if your first-year results are good', 'Tuition only — no living costs'],
                    takes: ['Fee-paying student (from outside the EU/EEA and Switzerland)', 'KTH Master’s as your first choice', 'Application fee paid', 'Academic excellence + drive to contribute to sustainable development'],
                    how: { method: 'separate', steps: ['Apply to a KTH Master’s in the national round', 'Submit the KTH Scholarship application'] },
                    when: { text: 'Usually mid-January, with the Master’s application', short: 'Mid-Jan' },
                    url: 'https://www.kth.se/en/studies/master/admissions/scholarships/kth-scholarship-1.72827'
                }
            ]
        },
        'se:lu': {
            aidUrl: 'https://www.lunduniversity.lu.se/admissions/bachelors-and-masters-studies/scholarships-and-awards',
            scholarships: [
                {
                    id: 'lu-global', name: 'Lund University Global Scholarship', category: 'academic', levels: ['bachelor', 'master'],
                    difficulty: { score: 7, basis: 'Lund shares about SEK 26 million a year across partial and full waivers; the number of awards isn’t published.' },
                    awarded: { big: 'SEK 26M', small: 'given out a year in total' },
                    gives: ['Part or all of your tuition fee', 'Tuition only — no living costs'],
                    takes: ['Citizen of a country outside the EU/EEA and Switzerland', 'Lund programme as your first choice', 'A Master’s (or selected Bachelor’s) programme', 'A motivation letter (max. 600 words)'],
                    how: { method: 'separate', steps: ['Apply to your programme at universityadmissions.se', 'Apply on the Lund scholarship portal with your motivation letter'] },
                    when: { text: 'Usually opens early February (closed 16 February in 2026)', short: 'Feb' },
                    url: 'https://www.lunduniversity.lu.se/study/admission-degree-studies/scholarships-and-awards/lund-university-global-scholarship'
                }
            ]
        },

        /* ── Spain ──────────────────────────────────────────────────── */
        'es:ie': {
            aidUrl: 'https://www.ie.edu/financial-aid/',
            scholarships: [
                {
                    id: 'ie-foundation', name: 'IE Foundation Scholarships', category: 'need', levels: ['bachelor', 'master'],
                    provider: 'IE Foundation',
                    difficulty: { score: 4, basis: 'About 35% of IE students get a scholarship every year.' },
                    awarded: { big: '35%', small: 'of students a year (3,500)' },
                    gives: ['A partial tuition discount', 'Amount varies — based on merit, need and diversity'],
                    takes: ['Admission to an IE programme', 'Merit awards: a strong academic profile', 'Need-based awards: proof of financial need'],
                    how: { method: 'separate', steps: ['Get admitted to your IE programme', 'Submit the scholarship application for your admission round'] },
                    when: { text: 'Rolling — tied to your admission round', short: 'Rolling' },
                    url: 'https://www.ie.edu/financial-aid/'
                }
            ]
        }
    };

    /* National / EU programmes — shown only when a university has no profile. */
    function ext(name, provider, level, url) { return { name: name, provider: provider, level: level, url: url }; }
    var EXTERNAL = {
        gb: [ext('Chevening Scholarships', 'UK Government', 'Master’s', 'https://www.chevening.org/')],
        de: [ext('DAAD Scholarships', 'German Academic Exchange Service', 'Master’s & PhD', 'https://www.daad.de/en/')],
        fr: [ext('Eiffel Excellence Scholarship', 'French Government', 'Master’s & PhD', 'https://www.campusfrance.org/en/eiffel-scholarship-program-of-excellence')],
        nl: [ext('Holland Scholarship', 'Dutch Ministry of Education', 'Bachelor’s & Master’s', 'https://www.studyinholland.nl/finances/holland-scholarship')],
        se: [ext('SI Scholarship for Global Professionals', 'Swedish Institute', 'Master’s', 'https://si.se/en/apply/scholarships/')],
        ch: [ext('Swiss Government Excellence Scholarships', 'Swiss Confederation', 'PhD & research', 'https://www.sbfi.admin.ch/scholarships_eng')],
        us: [ext('Fulbright Foreign Student Program', 'U.S. Department of State', 'Graduate', 'https://foreign.fulbrightonline.org/')],
        ie: [ext('Government of Ireland International Education Scholarships', 'Higher Education Authority', 'Various', 'https://hea.ie/policy/internationalisation/goi-ies/')],
        dk: [ext('Danish Government Scholarships', 'Danish Ministry of Higher Education', 'Full degree', 'https://studyindenmark.dk/')],
        it: [ext('Italian Government Scholarships', 'Italian Ministry of Foreign Affairs', 'Various', 'https://studyinitaly.esteri.it/')],
        es: [ext('Becas del Ministerio', 'Spanish Ministry of Education', 'Bachelor’s & Master’s', 'https://www.becaseducacion.gob.es/')],
        eu: [ext('Erasmus Mundus Joint Master’s Scholarships', 'European Commission', 'Master’s', 'https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en')]
    };
    var EU_COUNTRIES = ['be', 'de', 'dk', 'es', 'fi', 'fr', 'ie', 'it', 'nl', 'pt', 'se'];

    window.SCHOLARSHIP_DATA = { checked: '2026-09-26', universities: UNIVERSITIES, external: EXTERNAL };

    /* ── Data access layer ────────────────────────────────────────────
       The ONLY way the page reads scholarship data. Going live: call
       ScholarshipSource.configure({ endpoint }) and return
           GET {endpoint}?university=<country>:<id>  →  { aidUrl, scholarships, external } */
    var config = { endpoint: null };
    function key(uni) { return String(uni.cc || '').toLowerCase() + ':' + uni.id; }
    function externalFor(cc) {
        var list = (EXTERNAL[cc] || []).slice();
        if (EU_COUNTRIES.indexOf(cc) !== -1) list = list.concat(EXTERNAL.eu);
        return list;
    }

    window.ScholarshipSource = {
        configure: function (opts) { for (var k in opts) config[k] = opts[k]; },
        key: key,
        hasProfile: function (uni) { return !config.endpoint && !!UNIVERSITIES[key(uni)]; },
        profiledKeys: function () { return Object.keys(UNIVERSITIES); },
        /* One scholarship by university key + id (local data) — used by the Overview widget. */
        lookup: function (uniKey, id) {
            var rec = UNIVERSITIES[uniKey];
            if (!rec) return null;
            for (var i = 0; i < rec.scholarships.length; i++) if (rec.scholarships[i].id === id) return rec.scholarships[i];
            return null;
        },
        /* → Promise<{ scholarships, aidUrl, external }> */
        get: function (uni) {
            if (config.endpoint) {
                return fetch(config.endpoint + '?university=' + encodeURIComponent(key(uni)))
                    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
                    .then(function (d) { return { scholarships: d.scholarships || [], aidUrl: d.aidUrl || uni.website || null, external: d.external || externalFor(uni.cc) }; });
            }
            var rec = UNIVERSITIES[key(uni)];
            return Promise.resolve({
                scholarships: rec ? rec.scholarships : [],
                aidUrl: (rec && rec.aidUrl) || uni.website || null,
                external: externalFor(uni.cc)
            });
        }
    };
})();
