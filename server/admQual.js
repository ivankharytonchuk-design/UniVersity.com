'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   Admissions data — qualifications, tests and normalisation.

   Rules (deliberate):
     • Every record keeps the ORIGINAL qualification + score exactly as reported.
     • `score_num` is that same score in the qualification's OWN units (IB 38 → 38,
       Abitur 1.3 → 1.3). The only exception is A Levels, where `score_num` is the
       mean of the best three grades on the ordinal A*=6 … E=1 — an ordering of
       grades, not a conversion to another system.
     • Scores are only ever compared WITHIN the same qualification. There is no
       cross-system conversion anywhere (IB vs GPA vs Bachillerato are never put
       on one scale), because there is no official formula for most pairs.
     • "Similar score" windows (e.g. IB ±2) are comparison bands for "people like
       you", shown to the user as such — they are not conversions either.
   ──────────────────────────────────────────────────────────────────────────── */

const AL = { 'A*': 6, A: 5, B: 4, C: 3, D: 2, E: 1, U: 0 };
const AL_BACK = ['U', 'E', 'D', 'C', 'B', 'A', 'A*'];

// kind: 'points' | 'number' | 'grades' | 'class'
const QUALS = {
  ib:          { name: 'IB Diploma',                       short: 'IB',          kind: 'points', min: 0,   max: 45,  step: 1,    unit: 'points', window: 2,   axis: [24, 45] },
  a_levels:    { name: 'A Levels',                         short: 'A Levels',    kind: 'grades', min: 0,   max: 6,   step: .01,  unit: '',       window: .5,  axis: [3, 6] },
  gpa_us:      { name: 'US GPA (unweighted, 4.0)',         short: 'GPA',         kind: 'number', min: 0,   max: 4,   step: .01,  unit: '',       window: .15, axis: [2.5, 4] },
  gpa_us_w:    { name: 'US GPA (weighted, 5.0)',           short: 'Weighted GPA', kind: 'number', min: 0,  max: 5,   step: .01,  unit: '',       window: .2,  axis: [3, 5] },
  pct:         { name: 'Percentage (school average)',      short: '%',           kind: 'number', min: 0,   max: 100, step: .1,   unit: '%',      window: 4,   axis: [60, 100] },
  es_bach:     { name: 'Spanish Bachillerato (0–10)',      short: 'Bachillerato', kind: 'number', min: 5,  max: 10,  step: .01,  unit: '/10',    window: .4,  axis: [6, 10] },
  es_pau:      { name: 'Spanish PAU / EvAU (0–14)',        short: 'PAU',         kind: 'number', min: 5,   max: 14,  step: .001, unit: '/14',    window: .5,  axis: [8, 14] },
  fr_bac:      { name: 'French Baccalauréat (0–20)',       short: 'Bac',         kind: 'number', min: 10,  max: 20,  step: .01,  unit: '/20',    window: 1,   axis: [10, 20] },
  it_maturita: { name: 'Italian Maturità (60–100)',        short: 'Maturità',    kind: 'number', min: 60,  max: 100, step: 1,    unit: '/100',   window: 4,   axis: [60, 100] },
  de_abitur:   { name: 'German Abitur (1.0–4.0)',          short: 'Abitur',      kind: 'number', min: 1,   max: 4,   step: .1,   unit: '',       window: .3,  axis: [1, 3], lowerIsBetter: true },
  nl_vwo:      { name: 'Dutch VWO average (1–10)',         short: 'VWO',         kind: 'number', min: 5.5, max: 10,  step: .01,  unit: '/10',    window: .4,  axis: [6, 10] },
  ch_matura:   { name: 'Swiss Matura (1–6)',               short: 'Matura',      kind: 'number', min: 4,   max: 6,   step: .01,  unit: '/6',     window: .25, axis: [4, 6] },
  pt_sec:      { name: 'Portuguese Secundário (0–20)',     short: 'Secundário',  kind: 'number', min: 9.5, max: 20,  step: .1,   unit: '/20',    window: 1,   axis: [10, 20] },
  ie_lc:       { name: 'Irish Leaving Cert (CAO points)',  short: 'CAO',         kind: 'points', min: 0,   max: 625, step: 1,    unit: 'points', window: 25,  axis: [350, 625] },
  ua_nmt:      { name: 'Ukrainian NMT (100–200)',          short: 'NMT',         kind: 'number', min: 100, max: 200, step: .1,   unit: '',       window: 8,   axis: [130, 200] },
  p10:         { name: 'Other — out of 10',                short: '/10',         kind: 'number', min: 0,   max: 10,  step: .01,  unit: '/10',    window: .4,  axis: [6, 10] },
  p20:         { name: 'Other — out of 20',                short: '/20',         kind: 'number', min: 0,   max: 20,  step: .01,  unit: '/20',    window: 1,   axis: [10, 20] },
  uk_degree:   { name: 'UK degree classification',         short: 'UK degree',   kind: 'class',  min: 1,   max: 4,   step: 1,    unit: '',       window: 0,   axis: [1, 4], classes: { first: 4, '2:1': 3, '2:2': 2, third: 1 } },
  other:       { name: 'Other qualification',              short: 'Other',       kind: 'text' },
};

const TESTS = { SAT: [400, 1600], ACT: [1, 36], TMUA: [1, 9], ESAT: [1, 9], MAT: [0, 100], LNAT: [0, 42], UCAT: [900, 3600], GRE: [260, 340], GMAT: [200, 805], TOLC: [0, 100] };
const LANG = { IELTS: [0, 9], TOEFL: [0, 120], Duolingo: [10, 160], Cambridge: [80, 230], PTE: [10, 90] };

const RESULTS = ['accepted', 'rejected', 'waitlisted', 'withdrawn', 'pending', 'unknown'];
const DECIDED = ['accepted', 'rejected', 'waitlisted'];
const SOURCE_TYPES = ['official', 'public_self_report', 'user_reported', 'user_verified'];
const VERIFICATION = ['unverified', 'self_reported', 'document_verified', 'official_source'];
const CONFIDENCE = ['high', 'medium', 'low'];
const LEVELS = ['bachelor', 'master', 'phd', 'other'];

// Achievements are stored as tags only — free text could name a person or school.
const TAGS = {
  olympiad: /olympiad|\b(imo|ipho|icho|ibo|ioi)\b/i,
  research: /research|lab\b|laboratory|extended essay|\bee\b.*\b(a|b)\b|paper with/i,
  publication: /publish|publication|journal|conference paper/i,
  competition: /competition|contest|hackathon|science fair|\bisef\b|award|prize|finalist|medal/i,
  sports: /sport|athlet|varsity|football|soccer|basketball|tennis|swim|rowing|chess/i,
  music_arts: /music|orchestra|piano|violin|band|theat(re|er)|drama|art portfolio|painting|dance|choir/i,
  volunteering: /volunteer|charity|community service|\bcas\b|ngo|non-profit|nonprofit/i,
  leadership: /president|captain|founder|lead(er|ership)?\b|head (boy|girl|student)|student council|prefect/i,
  work_internship: /intern(ship)?|part-time job|work experience|job at|worked (at|as)/i,
  entrepreneurship: /startup|start-up|business i (ran|started)|entrepreneur|own company/i,
  debate_mun: /debate|model un|\bmun\b|public speaking/i,
  coding_projects: /coding|programming|github|app i (built|made)|website i (built|made)|software project/i,
};
const TAG_LABEL = { olympiad: 'Olympiad', research: 'Research', publication: 'Publication', competition: 'Competitions', sports: 'Sport', music_arts: 'Music & arts',
  volunteering: 'Volunteering', leadership: 'Leadership', work_internship: 'Work / internship', entrepreneurship: 'Entrepreneurship', debate_mun: 'Debate / MUN', coding_projects: 'Coding projects', other: 'Other' };

// Broad fields — same keys as the Probability page's field filter.
const FIELDS = {
  cs: /computer|informatic|software|data science|artificial intelligence|\bai\b|comput|cyber|machine learning/i,
  engineering: /engineer|aerospace|aeronaut|mechanic|electric|electronic|civil|chemical eng|robotic|mechatronic|industrial design|technical/i,
  medicine: /medicine|medical|mbbs|\bmd\b|dentist|dental|pharma|nursing|biomedical|veterinar/i,
  law: /\blaw\b|\bllb\b|\bllm\b|legal|jurisprudence/i,
  finance: /business|econom|finance|management|accounting|marketing|commerce|\bbba\b|\bmba\b|\bpe\b.*\b(economics)|\bppe\b/i,
  science: /physic|chemistry|biology|math|natural science|earth|geolog|astronom|neuro|statistic|psycholog|environment/i,
  arts: /history|philosoph|literature|english|language|\barts?\b|design|music|architect|sociology|politic|international relations|media|film|anthropolog|classics/i,
};
const FIELD_LABEL = { cs: 'Computer science', engineering: 'Engineering', finance: 'Business & finance', medicine: 'Medicine', law: 'Law', science: 'Science', arts: 'Arts & humanities' };

function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function round(v, d) { const f = Math.pow(10, d || 0); return Math.round(v * f) / f; }

function parseALevels(raw) {
  const s = String(raw || '').toUpperCase().replace(/STAR/g, '*').replace(/[\s,;/+-]+/g, '');
  if (!/^(A\*|[ABCDEU])+$/.test(s)) return null;
  const gs = s.match(/A\*|[ABCDEU]/g);
  if (!gs || gs.length < 2 || gs.length > 6) return null;
  const vals = gs.map((g) => AL[g]).sort((a, b) => b - a);
  const best = vals.slice(0, 3);
  return { raw: gs.join(''), num: round(best.reduce((a, b) => a + b, 0) / best.length, 3) };
}

// → { raw, num } in the qualification's own units, or null if it doesn't parse/fit.
function parseScore(qual, raw) {
  const q = QUALS[qual]; if (!q || raw == null || raw === '') return null;
  let s = String(raw).trim();
  if (q.kind === 'text') return { raw: s.slice(0, 40), num: null };
  if (q.kind === 'grades') return parseALevels(s);
  if (q.kind === 'class') {
    const k = norm(s).replace(/\s+/g, '').replace(/class$/, '');
    const map = { first: 4, '1st': 4, firstclass: 4, '2:1': 3, '2.1': 3, upper2nd: 3, uppersecond: 3, '2:2': 2, '2.2': 2, lower2nd: 2, lowersecond: 2, third: 1, '3rd': 1 };
    const v = map[k]; return v ? { raw: ['', 'Third', '2:2', '2:1', 'First'][v], num: v } : null;
  }
  const lode = qual === 'it_maturita' && /lode/i.test(s);
  s = s.replace(',', '.');
  const m = s.match(/-?\d+(\.\d+)?/); if (!m) return null;
  let v = +m[0];
  if (!isFinite(v) || v < q.min || v > q.max) return null;
  if (q.kind === 'points') v = Math.round(v);
  return { raw: (q.kind === 'points' ? String(v) : String(+v.toFixed(3))) + (lode ? ' e lode' : ''), num: v };
}
function scoreLabel(qual, raw) {
  const q = QUALS[qual]; if (!q || raw == null || raw === '') return '';
  if (qual === 'ib') return raw + ' IB';
  if (qual === 'a_levels') return raw;
  if (qual === 'pct') return raw + '%';
  if (qual === 'gpa_us' || qual === 'gpa_us_w') return 'GPA ' + raw;
  if (qual === 'uk_degree') return raw;
  if (qual === 'other') return raw;
  return q.short + ' ' + raw + (q.unit && q.unit.charAt(0) === '/' ? q.unit : '');
}
// Axis label for an ordinal A-level mean (e.g. 5.33 → "A*AA"-ish band label)
function aLevelLabel(num) {
  const n = Math.round(num * 3), a = Math.floor(n / 3), r = n - a * 3;
  const g = [];
  for (let i = 0; i < 3; i++) g.push(AL_BACK[Math.min(6, a + (i < r ? 1 : 0))]);
  return g.join('');
}

function parseTests(obj, table) {
  const out = {};
  Object.keys(obj || {}).forEach((k) => {
    const key = Object.keys(table).find((t) => t.toLowerCase() === String(k).toLowerCase());
    if (!key) return;
    const v = +String(obj[k]).replace(',', '.');
    if (isFinite(v) && v >= table[key][0] && v <= table[key][1]) out[key] = v;
  });
  return out;
}
// Free text such as "SAT 1450, ACT 33" → { SAT: 1450, ACT: 33 }
function testsFromText(text, table) {
  const out = {};
  Object.keys(table).forEach((k) => {
    const m = String(text || '').match(new RegExp('\\b' + k + '\\b\\s*[:=]?\\s*(\\d{1,4}(?:[.,]\\d)?)', 'i'));
    if (m) { const v = +m[1].replace(',', '.'); if (v >= table[k][0] && v <= table[k][1]) out[k] = v; }
  });
  return out;
}
function tagAchievements(list) {
  const text = Array.isArray(list) ? list.join(' · ') : String(list || '');
  if (!text.trim()) return null;   // null = not reported
  const tags = Object.keys(TAGS).filter((k) => TAGS[k].test(text));
  return tags.length ? tags : ['other'];
}
function cleanTags(tags) {
  if (tags == null) return null;
  const ok = (Array.isArray(tags) ? tags : []).filter((t) => TAG_LABEL[t]);
  return ok.length ? Array.from(new Set(ok)).slice(0, 8) : [];
}
function fieldOf(program) {
  const p = String(program || '');
  if (!p.trim()) return null;
  for (const k of ['cs', 'medicine', 'law', 'engineering', 'finance', 'science', 'arts']) if (FIELDS[k].test(p)) return k;
  return null;
}
// Common short names → one canonical programme name (so "CS", "Computing" and
// "Informatics" at the same university are counted together).
const PROGRAM_ALIASES = [
  [/^(cs|compsci|comp sci|computing|computer sciences?|informatics|informatica|informatik|computer science and engineering|cse)$/, 'computer science'],
  [/^(econ|econs|economic|economics and finance)$/, 'economics'], [/^(maths?|mathematical sciences)$/, 'mathematics'],
  [/^(eee|electrical and electronics? engineering|electrical & electronic engineering|electronic and electrical engineering)$/, 'electrical and electronic engineering'],
  [/^(ee|electrical eng)$/, 'electrical engineering'], [/^(meche|mech eng|mechanical eng|mechanical)$/, 'mechanical engineering'],
  [/^(aero|aerospace|aeronautical engineering|aeronautics)$/, 'aerospace engineering'], [/^(chem eng|chemeng|chemical eng)$/, 'chemical engineering'],
  [/^(ppe|philosophy politics & economics)$/, 'philosophy politics and economics'], [/^(med|medicine and surgery|mbbs|mbchb)$/, 'medicine'],
  [/^(ba|business|business admin|business administration and management)$/, 'business administration'], [/^(ibeb)$/, 'international bachelor economics and business economics'],
];
// "BSc (Hons) Aerospace Engineering" → "aerospace engineering"
function programNorm(p) {
  const raw = norm(p).replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(bba|mba)$/.test(raw)) return 'business administration';
  const n = programNormBase(p);
  for (const [rx, to] of PROGRAM_ALIASES) if (rx.test(n)) return to;
  return n;
}
function programNormBase(p) {
  return norm(p)
    .replace(/\((hons?|honours)\)/g, ' ')
    .replace(/\b(bsc|ba|bs|beng|meng|msc|ma|ms|mphil|mres|llb|llm|mba|phd|dphil|bba|mmath|mphys|mchem|integrated masters?)\b\.?/g, ' ')
    .replace(/\b(bachelor|master)('?s)?\b( of( science| arts| engineering)?)?( in)?/g, ' ')
    .replace(/\b(degree|programme|program|course|hons?|honours)\b/g, ' ')
    .replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(in|of) /, '');
}
function levelOf(text) {
  const t = norm(text);
  if (/\b(phd|dphil|doctor)/.test(t)) return 'phd';
  if (/\b(msc|ma|ms|meng|mphil|mres|llm|mba|master)/.test(t)) return 'master';
  if (/\b(bsc|ba|bs|beng|llb|bba|bachelor|undergrad)/.test(t)) return 'bachelor';
  return null;
}

module.exports = {
  QUALS, TESTS, LANG, RESULTS, DECIDED, SOURCE_TYPES, VERIFICATION, CONFIDENCE, LEVELS, TAG_LABEL, FIELD_LABEL,
  parseScore, scoreLabel, aLevelLabel, parseTests, testsFromText, tagAchievements, cleanTags, fieldOf, programNorm, levelOf, norm,
};
