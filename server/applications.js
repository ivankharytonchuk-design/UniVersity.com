'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   Apply — the student's application command centre (design/apply.js).

   UniVersity is NOT an official application portal. This module keeps
   everything a student prepares (applications, checklist progress, documents,
   writing with versions, decisions/offers, their application profile) and
   works out what they still need — but submission always happens on the
   official system (UCAS, Common App, Studielink, …); the student records it here.

   Reference data (never invented here):
     • server/data/app_systems.json  — application systems, tests, Common App
       college rows (deadlines, fees, recommendations, test policy). Each rule has
       its official source and the date it was checked (tools/apply/build_systems.py).
     • design/data/admit_guide.js    — per-course offers, required subjects, tests,
       interviews and competition for UK universities, all sourced (tools/admit-guide).
     • server/data/admissions_official.json — university-specific deadlines, fees,
       language and test requirements collected from official pages.
     • research.loadIndex()          — the 926 universities the site knows.

   Security: every route needs a signed-in account (Bearer session token); every
   query is scoped to that account's id; documents are only ever streamed back to
   their owner; ids are random. Nothing personal is logged.
   ════════════════════════════════════════════════════════════════════════════ */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const express = require('express');

module.exports = function mountApplications(app, deps) {
  const { store, synth, log, errlog, requireAccount } = deps;
  const isElite = deps.isElite || (() => false);
  const S = deps.schema || 'public';                 // tests use a separate schema
  const T = (n) => '"' + S + '".' + n;
  const P = deps.prefix || '/api/apps';
  const q = (sql, params) => store.query(sql, params);
  const DAY = 864e5;
  const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const clipText = (s, n) => String(s == null ? '' : s).replace(/\r\n/g, '\n').slice(0, n);
  const rid = (p) => p + crypto.randomBytes(9).toString('hex');
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d == null ? null : d instanceof Date ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : String(d).slice(0, 10);
  const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const today = () => ymd(new Date());
  const daysTo = (d) => d ? Math.round((new Date(d + 'T12:00:00') - new Date(today() + 'T12:00:00')) / DAY) : null;
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return ymd(x); };

  /* ── reference data ──────────────────────────────────────────────── */
  const SYS = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'app_systems.json'), 'utf8'));
  const OFFICIAL = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'admissions_official.json'), 'utf8')); } catch (e) { return { requirements: [], sources: [] }; } })();
  const OSRC = {}; (OFFICIAL.sources || []).forEach((s) => { OSRC[s.id] = { t: s.title, u: s.url, checked: OFFICIAL.collected || null }; });
  const GUIDE = (() => {
    try {
      const src = fs.readFileSync(path.join(__dirname, '..', 'design', 'data', 'admit_guide.js'), 'utf8');
      const ctx = { window: {} }; vm.runInNewContext(src, ctx, { timeout: 3000 });
      return ctx.window.ADMIT_GUIDE || {};
    } catch (e) { errlog('[apps] admit guide not loaded:', e.message); return {}; }
  })();
  const IDX = require('./research').loadIndex();
  const UNI = new Map(IDX.unis.map((u) => [u.cc + ':' + u.id, u]));
  const CITY = new Map(IDX.cities.map((c) => [c.cc + ':' + c.name, c]));
  const COUNTRY = { gb: 'United Kingdom', us: 'United States', nl: 'Netherlands', de: 'Germany', ch: 'Switzerland', it: 'Italy', fr: 'France', es: 'Spain', ie: 'Ireland', se: 'Sweden', dk: 'Denmark', fi: 'Finland', be: 'Belgium', pt: 'Portugal', ua: 'Ukraine' };
  const ENGLISH_TAUGHT = new Set(['gb', 'us', 'ie']);
  const STATUSES = ['planning', 'preparing', 'ready', 'submitted', 'interview', 'offer', 'waitlisted', 'declined'];
  const ACTIVE = new Set(['planning', 'preparing', 'ready']);
  const DECISIONS = ['offer_conditional', 'offer_unconditional', 'waitlisted', 'rejected', 'withdrawn'];
  const DOC_KINDS = ['transcript', 'predicted', 'reference', 'language', 'portfolio', 'id', 'award', 'cv', 'test', 'offer', 'other'];

  function uniInfo(cc, id) {
    const u = UNI.get(cc + ':' + id);
    if (!u) return null;
    return { cc, id, name: u.name, abbr: u.abbr || '', color: u.color || '#3552d8', city: u.city || '', country: COUNTRY[cc] || u.country || cc.toUpperCase(), website: u.website || '', tuition: u.tuition || '', langs: u.langs || [] };
  }
  function coursesFor(cc, id) { return ((GUIDE.courses || {})[cc + ':' + id] || []); }
  function courseOf(a) { return a.course_id ? coursesFor(a.uni_cc, a.uni_id).filter((c) => c.id === a.course_id)[0] || null : null; }
  function officialFor(a) {
    const rows = (OFFICIAL.requirements || []).filter((r) => r.uni === a.uni_cc + ':' + a.uni_id);
    const prog = rows.filter((r) => r.program && a.course_name && r.program.toLowerCase() === a.course_name.toLowerCase());
    return prog.length ? prog : rows.filter((r) => !r.program);
  }
  function systemFor(cc, id) { return SYS.uniSystem[cc + ':' + id] || SYS.countryDefault[cc] || 'portal'; }
  function sysOf(a) { return SYS.systems[a.system] || SYS.systems.portal; }
  function college(a) { return (SYS.colleges || {})[a.uni_cc + ':' + a.uni_id] || null; }

  // the deadline we can stand behind: official university date → system round → none (the student sets it)
  function defaultDeadline(a) {
    const off = officialFor(a).filter((r) => r.deadline)[0];
    if (off) return { date: off.deadline, src: 'official', note: off.deadline_note || '', s: OSRC[off.source] || null, round: null };
    const sys = sysOf(a), col = college(a);
    if (a.system === 'commonapp' && col && col.rounds.length) {
      const r = col.rounds.filter((x) => x.id === a.round)[0] || col.rounds.filter((x) => x.id === 'rd')[0] || col.rounds[col.rounds.length - 1];
      return { date: r.date, src: 'system', note: r.label, s: r.s, round: r.id };
    }
    if (a.system === 'ucas') {
      const oct = SYS.ucasOct.unis.indexOf(a.uni_cc + ':' + a.uni_id) !== -1 || SYS.ucasOct.courses.indexOf(a.course_id) !== -1;
      const r = sys.rounds.filter((x) => x.id === (a.round || (oct ? 'oct' : 'jan')))[0];
      return { date: r.date, src: 'system', note: r.label + ' · ' + r.time, s: r.s, round: r.id };
    }
    if (sys.rounds && sys.rounds.length) {
      const r = sys.rounds.filter((x) => x.id === a.round)[0] || sys.rounds[sys.rounds.length - 1];
      return { date: r.date, src: 'system', note: r.label + (r.time ? ' · ' + r.time : ''), s: r.s, round: r.id };
    }
    return { date: null, src: null, note: '', s: null, round: null };
  }

  /* ── schema ──────────────────────────────────────────────────────── */
  let ready = null;
  function init() {
    if (ready) return ready;
    if (!store.enabled()) return (ready = Promise.resolve(false));
    const fk = deps.fkAccounts === false ? '' : ' REFERENCES ' + (S === 'public' ? 'accounts' : T('accounts')) + '(id) ON DELETE CASCADE';
    ready = q(`
      CREATE SCHEMA IF NOT EXISTS "${S}";
      CREATE TABLE IF NOT EXISTS ${T('app_applications')} (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL${fk},
        uni_cc TEXT NOT NULL, uni_id TEXT NOT NULL, uni_name TEXT NOT NULL,
        course_id TEXT, course_name TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'bachelor',
        system TEXT NOT NULL, round TEXT, status TEXT NOT NULL DEFAULT 'planning',
        deadline DATE, deadline_src TEXT, deadline_note TEXT, portal_url TEXT,
        submitted_at TIMESTAMPTZ, submission_ref TEXT, notes TEXT, position INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
      CREATE INDEX IF NOT EXISTS app_applications_user ON ${T('app_applications')}(user_id);
      CREATE TABLE IF NOT EXISTS ${T('app_items')} (
        app_id TEXT NOT NULL REFERENCES ${T('app_applications')}(id) ON DELETE CASCADE, key TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'todo', doc_id TEXT, data JSONB, updated_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (app_id, key));
      CREATE TABLE IF NOT EXISTS ${T('app_documents')} (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL${fk}, kind TEXT NOT NULL, name TEXT NOT NULL,
        mime TEXT, size INT, sha256 TEXT, status TEXT DEFAULT 'uploaded', body BYTEA, created_at TIMESTAMPTZ DEFAULT now());
      CREATE INDEX IF NOT EXISTS app_documents_user ON ${T('app_documents')}(user_id);
      CREATE TABLE IF NOT EXISTS ${T('app_writing')} (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL${fk}, scope TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL,
        prompt TEXT, spec JSONB, interview JSONB, working JSONB, status TEXT DEFAULT 'draft',
        updated_at TIMESTAMPTZ DEFAULT now(), UNIQUE (user_id, scope, kind, title));
      CREATE TABLE IF NOT EXISTS ${T('app_writing_versions')} (
        id TEXT PRIMARY KEY, writing_id TEXT NOT NULL REFERENCES ${T('app_writing')}(id) ON DELETE CASCADE,
        n INT NOT NULL, label TEXT, body JSONB, words INT, chars INT, origin TEXT, feedback JSONB, created_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE IF NOT EXISTS ${T('app_decisions')} (
        app_id TEXT PRIMARY KEY REFERENCES ${T('app_applications')}(id) ON DELETE CASCADE,
        decision TEXT, data JSONB, updated_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE IF NOT EXISTS ${T('app_profile')} (
        user_id TEXT PRIMARY KEY${fk}, data JSONB, updated_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE IF NOT EXISTS ${T('app_ai_usage')} (
        user_id TEXT NOT NULL, day DATE NOT NULL, n INT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day));
    `).then(() => true).catch((e) => { errlog('[apps] schema:', e.message); ready = null; return false; });
    return ready;
  }
  init().then((ok) => { if (ok) log('[apps] ready (schema ' + S + ')'); });

  // every route: a signed-in account and a ready schema
  function route(handler) {
    return async (req, res) => {
      try {
        if (!(await init())) return res.status(503).json({ error: 'unavailable', message: 'Applications need the database — it isn’t configured right now.' });
        const user = await requireAccount(req, res); if (!user) return;
        await handler(req, res, user);
      } catch (e) {
        errlog('[apps] ' + req.method + ' ' + req.path + ':', e.message);
        if (!res.headersSent) res.status(500).json({ error: 'server_error' });
      }
    };
  }
  async function ownApp(user, id) {
    const r = await q(`SELECT * FROM ${T('app_applications')} WHERE id=$1 AND user_id=$2`, [String(id || ''), user.id]);
    return r.rows[0] || null;
  }

  /* ── profile ─────────────────────────────────────────────────────── */
  async function getProfile(userId) {
    const r = await q(`SELECT data, updated_at FROM ${T('app_profile')} WHERE user_id=$1`, [userId]);
    return r.rows[0] ? Object.assign({ updatedAt: r.rows[0].updated_at }, r.rows[0].data || {}) : {};
  }
  function cleanProfile(b) {
    const out = {};
    const arr = (v, n) => (Array.isArray(v) ? v : []).slice(0, n);
    out.qualification = b.qualification && typeof b.qualification === 'object' ? { sys: clip(b.qualification.sys, 12), label: clip(b.qualification.label, 80), total: +b.qualification.total || null, predicted: !!b.qualification.predicted } : null;
    out.grades = arr(b.grades, 20).map((g) => ({ name: clip(g.name, 60), level: clip(g.level, 16), grade: clip(g.grade, 8), predicted: !!g.predicted })).filter((g) => g.name);
    out.gradesFrom = clip(b.gradesFrom, 20) || 'manual';
    out.languages = arr(b.languages, 8).map((l) => ({ name: clip(l.name, 40), level: clip(l.level, 20), cert: clip(l.cert, 40), score: clip(l.score, 20) })).filter((l) => l.name);
    out.firstLanguage = clip(b.firstLanguage, 40);
    out.tests = arr(b.tests, 12).map((t) => ({ name: clip(t.name, 30), score: clip(t.score, 30), date: isDate(t.date) ? t.date : '' })).filter((t) => t.name);
    out.experiences = arr(b.experiences, 40).map((x) => ({ id: clip(x.id, 24) || rid('x'), type: clip(x.type, 20), title: clip(x.title, 120), org: clip(x.org, 80), when: clip(x.when, 40), what: clipText(x.what, 1200), learned: clipText(x.learned, 800), link: clip(x.link, 300) })).filter((x) => x.title);
    out.interests = clipText(b.interests, 1500);
    out.goals = clipText(b.goals, 1500);
    out.country = clip(b.country, 40);
    out.nationality = clip(b.nationality, 40);
    return out;
  }

  /* ── requirements engine ─────────────────────────────────────────── */
  // Turns system rules + course data + official data into the checklist for ONE
  // application, merged with the student's progress. Nothing is added without a
  // source; anything conditional says so.
  function testNames(str) {
    const s = String(str || ''), out = [];
    Object.keys(SYS.tests).forEach((t) => { if (new RegExp('(^|[^A-Z])' + t.replace('/', '\\/') + '([^A-Z]|$)').test(s)) out.push(t); });
    return out;
  }
  function gradeCheck(a, profile, conditions) {
    const c = courseOf(a), lines = [];
    const g = (profile && profile.grades) || [], qual = (profile && profile.qualification) || {};
    const find = (name) => { const re = subjectRe(name); return re ? g.filter((x) => re.test(x.name)) : []; };
    if (conditions && conditions.length) {
      conditions.forEach((cd) => {
        const hit = find(cd.subject)[0];
        const need = String(cd.grade || ''), have = hit ? String(hit.grade) : null;
        lines.push({ label: cd.subject, need, have, st: have == null ? 'unknown' : cmpGrade(have, need) >= 0 ? 'ok' : 'low', kind: 'condition' });
      });
      return { lines, basis: 'offer' };
    }
    if (!c) return { lines, basis: null };
    if (qual.sys === 'ib' && c.ib) {
      const need = c.ibLow || c.ib, have = +qual.total || null;
      lines.push({ label: 'IB total', need: String(c.ibLow ? c.ibLow + '–' + c.ib : c.ib), have: have ? String(have) : null, st: have == null ? 'unknown' : have >= need ? 'ok' : 'low' });
      (c.ibReq || []).forEach((r) => {
        if (/two |one of|1–2|more sciences|another/i.test(r[0])) { lines.push({ label: 'HL ' + r[0], need: r[1] ? String(r[1]) : 'HL', have: null, st: 'check' }); return; }
        const hit = find(r[0]).filter((x) => /HL|higher/i.test(x.level + ' ' + x.name)).sort((x, y) => (+y.grade || 0) - (+x.grade || 0))[0];
        lines.push({ label: 'HL ' + r[0], need: r[1] ? String(r[1]) : 'at HL', have: hit ? String(hit.grade) : null, st: !hit ? 'missing' : r[1] && +hit.grade < r[1] ? 'low' : 'ok' });
      });
    } else if (qual.sys === 'al' && c.al) {
      const need = String(c.al).match(/A\*|[ABCDE]/g) || [], have = g.filter((x) => /A\*|^[ABCDE]$/.test(x.grade)).map((x) => x.grade).sort(cmpAl).slice(0, need.length);
      lines.push({ label: 'A-level grades', need: c.al + (c.alLow ? ' (range down to ' + c.alLow + ')' : ''), have: have.length ? have.join('') : null, st: have.length < need.length ? 'unknown' : have.every((x, i) => cmpGrade(x, (String(c.alLow || c.al).match(/A\*|[ABCDE]/g) || need)[i]) >= 0) ? 'ok' : 'low' });
      (c.alReq || []).forEach((r) => {
        if (/two |one of|1–2|more sciences|another/i.test(r[0])) return;
        const hit = find(r[0])[0];
        lines.push({ label: r[0], need: r[1] || 'required', have: hit ? String(hit.grade) : null, st: !hit ? (r[2] === 'opt' ? 'optional' : 'missing') : r[1] ? (cmpGrade(hit.grade, r[1]) >= 0 ? 'ok' : 'low') : 'ok' });
      });
    }
    return { lines, basis: 'typical', s: c.s };
  }
  // "Maths or Further Maths" → /math/; "Physics" → /physic/ … matched against Gradebook subject names
  const SUBJECTS = [[/math/i, /math/i], [/physic/i, /physic/i], [/chem/i, /chem/i], [/biolog/i, /biolog/i], [/histor/i, /histor/i], [/english/i, /english/i], [/comput|\bcs\b/i, /comput|\bcs\b/i], [/econom/i, /econom/i], [/psycholog/i, /psycholog/i], [/geograph/i, /geograph/i]];
  function subjectRe(name) { const hit = SUBJECTS.filter((p) => p[0].test(String(name || '')))[0]; return hit ? hit[1] : null; }
  const AL_RANK = { 'A*': 6, A: 5, B: 4, C: 3, D: 2, E: 1 };
  function cmpAl(x, y) { return (AL_RANK[y] || 0) - (AL_RANK[x] || 0); }
  function cmpGrade(have, need) {   // ≥ 0 when "have" meets "need"; works for A-level letters and numbers
    const h = String(have).trim().toUpperCase(), n = String(need).trim().toUpperCase();
    if (AL_RANK[h] && AL_RANK[n]) return AL_RANK[h] - AL_RANK[n];
    if (!isNaN(+h) && !isNaN(+n)) return +h - +n;
    return h === n ? 0 : -1;
  }

  function requirementsFor(a, ctx) {
    const sys = sysOf(a), course = courseOf(a), col = college(a), off = officialFor(a), prof = ctx.profile || {};
    const items = [];
    const add = (it) => { if (!items.some((x) => x.key === it.key)) items.push(Object.assign({ required: true, conditional: false, after: false }, it)); };
    // academic record
    const sysAcad = (sys.items || []).filter((x) => x.key === 'academic')[0];
    let acadDetail = '';
    if (course) acadDetail = [course.al ? 'A-levels ' + course.al + (course.alLow ? ' (range down to ' + course.alLow + ')' : '') : '', course.ib ? 'IB ' + (course.ibLow ? course.ibLow + '–' : '') + course.ib + (course.hl ? ' with HL ' + course.hl : '') : '']
      .filter(Boolean).join(' · ') + ((course.alReq || []).length ? ' · must include ' + course.alReq.map((r) => r[0] + (r[1] ? ' ' + r[1] : '') + (r[2] === 'opt' ? ' (if offered)' : '')).join(', ') : '');
    else if (off.some((r) => r.typical_offer)) acadDetail = off.filter((r) => r.typical_offer).map((r) => r.typical_offer).join(' · ');
    add({ key: 'academic', group: 'academic', label: sysAcad ? sysAcad.label : 'Grades and qualifications ready', detail: acadDetail || (sysAcad ? sysAcad.why : 'Your school results, as the university asks for them.'),
      s: course ? course.s : (off[0] && OSRC[off[0].source]) || (sysAcad && sysAcad.s) || null, auto: true });
    // tests
    const tests = [];
    if (course && course.test) {
      const names = testNames(course.test), optional = /encouraged/i.test(course.test);
      if (/ or /i.test(course.test) && names.length > 1) tests.push({ name: names[0], label: course.test, optional });
      else if (names.length) names.forEach((n) => tests.push({ name: n, label: n, optional }));
      else tests.push({ name: null, label: course.test, optional: /some colleges/i.test(course.test) });
    }
    off.forEach((r) => (r.tests_required || []).forEach((t) => { const n = t.replace('|', '/'); if (!tests.some((x) => x.name === n)) tests.push({ name: SYS.tests[n] ? n : null, label: t.replace('|', ' or '), optional: false, s: OSRC[r.source] }); }));
    if (a.system === 'commonapp' && col && col.testPolicy) {
      if (col.testPolicy === 'required') tests.push({ name: 'SAT/ACT', label: 'SAT or ACT', optional: false, s: col.s });
      else if (col.testPolicy === 'flexible' || col.testPolicy === 'sometimes required') tests.push({ name: 'SAT/ACT', label: 'SAT or ACT (' + col.testPolicy + ')', optional: true, s: col.s });
    }
    const dlStr = a.deadline ? ymd(a.deadline) : null;
    const validSitting = (z) => !dlStr || !z.start || z.start <= addDays(dlStr, 7);   // a sitting after the deadline doesn't count for this application
    tests.forEach((t) => {
      const ref0 = t.name ? SYS.tests[t.name] : null, ref = ref0 ? Object.assign({}, ref0, { sittings: ref0.sittings.filter(validSitting) }) : null;
      add({ key: 'test:' + (t.name || t.label).replace(/\W+/g, '_').toLowerCase(), group: 'tests', label: t.label, required: !t.optional, test: t.name,
        detail: ref ? ref.full + (ref.sittings.length ? ' · ' + ref.sittings.map((s) => s.label + ': ' + s.dates + (s.bookBy ? ' (book by ' + s.bookBy + ')' : '')).join(' · ') : '') : '',
        s: t.s || (course && course.s) || (ref && ref.s) || null, sittings: ref ? ref.sittings : [], url: ref ? ref.url : null });
    });
    // English language: an official figure when we have one; otherwise a conditional reminder
    const offLang = off.filter((r) => r.language)[0];
    const engTest = (prof.languages || []).filter((l) => /english/i.test(l.name) && l.cert && l.score)[0] || (prof.tests || []).filter((x) => /ielts|toefl|duolingo|cambridge|pte/i.test(x.name) && x.score)[0] || null;
    const engLabel = engTest ? ((engTest.cert || engTest.name) + ' ' + engTest.score) : '';
    const native = /english/i.test(prof.firstLanguage || '') || (prof.languages || []).some((l) => /english/i.test(l.name) && /native|first/i.test(l.level));
    if (offLang) {
      const need = offLang.language, have = engTest ? String(engTest.cert || engTest.name).toUpperCase() : '', min = Object.keys(need).filter((k) => have.indexOf(k.toUpperCase()) !== -1)[0];
      const meets = engTest && min ? parseFloat(engTest.score) >= +need[min] : null;
      add({ key: 'lang', group: 'tests', label: 'English test: ' + Object.keys(need).map((k) => k + ' ' + need[k]).join(' or '), required: !native, conditional: true, detail: 'Needed if English is not your first language.', s: OSRC[offLang.source],
        auto: engTest ? { state: meets === false ? 'doing' : 'done', note: engLabel + (meets === false ? ' in your profile is below ' + min + ' ' + need[min] : ' in your profile' + (meets ? ' meets it' : '')) } : null });
    }
    else if (!native && (ENGLISH_TAUGHT.has(a.uni_cc) || /english/i.test(((uniInfo(a.uni_cc, a.uni_id) || {}).langs || []).join(' ')))) {
      add({ key: 'lang', group: 'tests', label: 'English language test (if English isn’t your first language)', conditional: true, unverified: true,
        detail: 'The score is set by the university for this course — we don’t have the official figure yet. Check the course page.', s: null,
        auto: engTest ? { state: 'done', note: engLabel + ' in your profile — confirm it meets this course’s figure' } : null });
    }
    // documents (only those the system or college actually asks for)
    (sys.items || []).filter((x) => x.group === 'documents').forEach((x) => {
      if (x.byCollege === 'TE' && col) { if (!col.TE) return; add({ key: x.key, group: 'documents', label: col.TE === 1 ? '1 teacher recommendation' : col.TE + ' teacher recommendations', detail: x.why, s: col.s, lead: x.lead, doc: 'reference' }); return; }
      if (x.byCollege === 'CR' && col) { if (!col.CR) return; add({ key: x.key, group: 'documents', label: x.label, detail: x.why, s: col.s, lead: x.lead, doc: 'reference' }); return; }
      add({ key: x.key, group: 'documents', label: x.label, detail: x.why, s: x.s, lead: x.lead, doc: /reference|rec/.test(x.key) ? 'reference' : 'transcript' });
    });
    if (col && col.portfolio) add({ key: 'portfolio', group: 'documents', label: 'Portfolio (only for majors that ask for one)', required: false, detail: col.portfolio === 'SR' ? 'Collected through SlideRoom inside Common App.' : 'Collected through the college’s own system.', s: col.s, doc: 'portfolio' });
    // writing
    (sys.writing || []).forEach((w) => {
      const conditional = w.scope === 'app' && /^(motivation|supplement|short)$/.test(w.kind) && a.system !== 'parcoursup';
      add({ key: 'write:' + w.kind, group: 'writing', label: w.title + (conditional ? ' (if asked)' : ''), conditional, detail: w.note, s: w.s, writingKind: w.kind });
    });
    if (course && course.note && /written work/i.test(course.note)) add({ key: 'write:written_work', group: 'writing', label: 'Written work', detail: course.note, s: course.s });
    // submission
    (sys.items || []).filter((x) => x.group === 'submission').forEach((x) => add({ key: x.key, group: 'submission', label: x.label, detail: x.why, s: x.s }));
    add({ key: 'review', group: 'submission', label: 'Application checked and reviewed', detail: 'Run the application check and read everything once more before you submit.', s: null });
    // after submission
    if (course && course.iv) add({ key: 'interview', group: 'after', label: 'Interview (' + course.iv.toLowerCase() + ')', required: false, after: true, detail: 'Shortlisted applicants are invited; prepare once you hear.', s: course.s });

    // merge progress
    items.forEach((it) => {
      const st = ctx.items[it.key] || null;
      it.state = st ? st.state : 'todo';
      it.data = st ? st.data || null : null;
      it.docId = st ? st.doc_id || null : null;
      if (it.docId && it.state !== 'na') { it.state = 'done'; const d = ctx.docs[it.docId]; it.attached = d ? { id: d.id, name: d.name, kind: d.kind } : null; }
      if (it.auto && typeof it.auto === 'object' && (!st || !st.data || !st.data.manual) && it.state !== 'na') { it.state = it.auto.state; it.autoNote = it.auto.note; }
      if (it.key === 'academic' && (!st || !st.data || !st.data.manual)) {
        const has = (prof.grades || []).length >= 3 || (prof.qualification && prof.qualification.total);
        if (it.state !== 'na') it.state = has ? 'done' : (it.state === 'doing' ? 'doing' : 'todo');
        it.autoNote = has ? 'From your application profile' : 'Add your grades to your profile';
      }
      if (it.writingKind) {
        const w = ctx.writing.filter((x) => x.kind === it.writingKind)[0];
        if (w) {
          it.writingId = w.id;
          if (it.state !== 'na') it.state = w.status === 'final' && w.stats && !w.stats.problems.length ? 'done' : w.stats && w.stats.chars > 0 ? 'doing' : (st && st.state === 'done' ? 'done' : 'todo');
          it.stats = w.stats;
        }
      }
      it.counts = it.required && !it.after && it.state !== 'na';
    });
    return items;
  }
  function readinessOf(items) {
    const counted = items.filter((x) => x.counts), done = counted.filter((x) => x.state === 'done').length;
    return { done, total: counted.length, pct: counted.length ? Math.round(done / counted.length * 100) : 0 };
  }

  /* ── next action ─────────────────────────────────────────────────── */
  const SHORT = (a) => { const u = uniInfo(a.uni_cc, a.uni_id); return (u && u.abbr && u.abbr.length <= 8 ? u.abbr : a.uni_name.replace(/^(The )?University (of|College) /, '')); };
  function nextFor(a, items, dec) {
    const sys = sysOf(a), dl = a.deadline ? ymd(a.deadline) : null, cands = [];
    const push = (text, due, tab, key, why, order) => cands.push({ text, due, tab, key: key || null, why: why || '', order: order || 5, days: daysTo(due) });
    if (a.status === 'offer' && dec) {
      const d = dec.data || {};
      if (d.acceptBy && !d.choice) push('Reply to your ' + SHORT(a) + ' offer', d.acceptBy, 'decision', null, 'Offers lapse if you miss the reply date.', 1);
      if (d.deposit && d.deposit.due && !d.depositPaid) push('Pay the ' + SHORT(a) + ' deposit', d.deposit.due, 'decision', null, '', 2);
      if (dec.decision === 'offer_conditional') push('Check your ' + SHORT(a) + ' offer conditions', addDays(today(), 30), 'decision', null, 'See how close your grades are to the conditions.', 6);
    }
    if (a.status === 'submitted' || a.status === 'interview') {
      const iv = items.filter((x) => x.key === 'interview' && x.state !== 'done' && x.state !== 'na')[0];
      if (a.status === 'interview' && iv) push('Prepare for your ' + SHORT(a) + ' interview', iv.data && iv.data.date || addDays(today(), 14), 'checklist', 'interview', '', 3);
      push('Record the decision from ' + SHORT(a) + ' when it arrives', addDays(today(), 60), 'decision', null, '', 9);
    }
    if (ACTIVE.has(a.status)) {
      items.filter((x) => x.counts && x.state !== 'done').forEach((x) => {
        let due = dl, text = '', tab = 'checklist';
        if (x.group === 'tests' && x.test) {
          const s = (x.sittings || []).filter((z) => z.bookBy && z.bookBy >= today())[0];
          if (x.state === 'todo' && s) { text = 'Book the ' + x.test; due = s.bookBy; }
          else if (x.state === 'todo' && (x.sittings || []).some((z) => z.bookBy && z.bookBy < today())) { const last = x.sittings.filter((z) => z.bookBy).slice(-1)[0]; text = 'Check your ' + x.test + ' booking — booking closed ' + last.bookBy; due = today(); }
          else if (x.state === 'todo') { text = 'Record your ' + x.label + ' date or score'; due = dl ? addDays(dl, -14) : null; }
          else { text = 'Add your ' + x.label + ' result'; due = dl; }
        } else if (x.group === 'tests') { text = x.key === 'lang' ? 'Add your English test result' : 'Sort out the ' + x.label; due = dl ? addDays(dl, -14) : null; }
        else if (x.doc === 'reference') {
          text = x.key === 'counselor' ? (x.state === 'doing' ? 'Check your counselor has sent the school report' : 'Ask your counselor for the recommendation and school report')
            : x.key === 'teacher_recs' ? (x.state === 'doing' ? 'Check your teacher recommendations are in' : 'Ask your teachers for recommendations')
            : x.state === 'doing' ? 'Check your reference has been added' : 'Ask your teacher for a reference';
          due = dl ? addDays(dl, -(x.lead || 21)) : null;
        }
        else if (x.group === 'documents') { text = 'Upload your ' + x.label.toLowerCase().replace(/ uploaded.*$/, ''); due = dl ? addDays(dl, -7) : null; tab = 'documents'; }
        else if (x.key === 'academic') { text = 'Add your grades and qualifications'; due = dl ? addDays(dl, -14) : null; tab = 'profile'; }
        else if (x.writingKind) { text = (x.state === 'doing' ? 'Finish your ' : 'Start your ') + (x.writingKind === 'ucas_ps' ? 'UCAS personal statement' : x.writingKind === 'commonapp_essay' ? 'Common App essay' : SHORT(a) + ' ' + x.label.replace(/ \(if asked\)/, '').toLowerCase()); due = dl ? addDays(dl, -10) : null; tab = 'writing'; }
        else if (x.key === 'fee') { text = 'Pay the ' + sys.name + ' fee'; due = dl ? addDays(dl, -2) : null; tab = 'submit'; }
        else if (x.key === 'review') { text = 'Review your ' + SHORT(a) + ' application'; due = dl ? addDays(dl, -3) : null; tab = 'submit'; }
        else if (x.key === 'enrol') { text = 'Submit your enrolment request in Studielink'; due = dl; tab = 'submit'; }
        else { text = x.label; due = dl ? addDays(dl, -7) : null; }
        const order = { tests: 1, documents: 2, academic: 3, writing: 4, submission: 6 }[x.group] || 5;
        push(text, due, tab, x.key, x.detail || '', order);
      });
      if (!items.some((x) => x.counts && x.state !== 'done')) push('Submit through ' + sys.name, dl || addDays(today(), 7), 'submit', null, 'Everything on the checklist is done.', 0);
    }
    if (!cands.length) return null;
    cands.sort((x, y) => ((x.days == null ? 999 : x.days) - (y.days == null ? 999 : y.days)) || x.order - y.order);
    const n = cands[0];
    return Object.assign(n, { uni: SHORT(a) });
  }

  /* ── loading one application with everything around it ───────────── */
  async function loadCtx(user, appRows) {
    const ids = appRows.map((a) => a.id);
    const [items, docs, writing, decs, profile] = await Promise.all([
      ids.length ? q(`SELECT * FROM ${T('app_items')} WHERE app_id = ANY($1)`, [ids]) : { rows: [] },
      q(`SELECT id, kind, name, mime, size, status, created_at FROM ${T('app_documents')} WHERE user_id=$1 ORDER BY created_at DESC`, [user.id]),
      q(`SELECT w.id, w.scope, w.kind, w.title, w.status, w.spec, w.working, w.updated_at FROM ${T('app_writing')} w WHERE w.user_id=$1`, [user.id]),
      ids.length ? q(`SELECT * FROM ${T('app_decisions')} WHERE app_id = ANY($1)`, [ids]) : { rows: [] },
      getProfile(user.id),
    ]);
    const docMap = {}; docs.rows.forEach((d) => { docMap[d.id] = d; });
    const decMap = {}; decs.rows.forEach((d) => { decMap[d.app_id] = d; });
    writing.rows.forEach((w) => { w.stats = statsFor(w.working, w.spec); });
    return {
      profile, docs: docMap, docList: docs.rows, decisions: decMap,
      itemsFor: (id) => { const m = {}; items.rows.filter((r) => r.app_id === id).forEach((r) => { m[r.key] = r; }); return m; },
      writingFor: (a) => writing.rows.filter((w) => w.scope === 'system:' + a.system || w.scope === 'app:' + a.id),
      writingAll: writing.rows,
    };
  }
  function summarize(a, C) {
    const items = requirementsFor(a, { profile: C.profile, items: C.itemsFor(a.id), docs: C.docs, writing: C.writingFor(a) });
    const dec = C.decisions[a.id] || null, sys = sysOf(a), u = uniInfo(a.uni_cc, a.uni_id) || { cc: a.uni_cc, id: a.uni_id, name: a.uni_name, country: COUNTRY[a.uni_cc] || '' };
    const readiness = readinessOf(items);
    return {
      id: a.id, uni: u, course: { id: a.course_id, name: a.course_name }, level: a.level,
      system: { id: a.system, name: sys.name, portal: a.portal_url || sys.portal || u.website || null, portalLabel: sys.portalLabel },
      status: a.status, round: a.round, deadline: a.deadline ? ymd(a.deadline) : null, deadlineSrc: a.deadline_src, deadlineNote: a.deadline_note,
      readiness, next: nextFor(a, items, dec),
      missing: items.filter((x) => x.counts && x.state === 'todo').length,
      left: items.filter((x) => x.counts && x.state !== 'done').map((x) => x.label.replace(/ \(if asked\)$/, '')).slice(0, 5),
      decision: dec ? { decision: dec.decision, data: dec.data || {} } : null,
      submittedAt: a.submitted_at, updatedAt: a.updated_at, position: a.position,
      _items: items,
    };
  }
  function deadlinesOf(apps) {
    const out = [];
    apps.forEach((s) => {
      const base = { uniId: s.uni.id, uniCc: s.uni.cc, uniName: s.uni.name, uniAbbr: s.uni.abbr, uniColor: s.uni.color, appId: s.id, source: 'apply' };
      if (s.deadline && ACTIVE.has(s.status)) out.push(Object.assign({ id: 'app_' + s.id, title: s.system.name + ' deadline — ' + s.course.name, date: s.deadline, type: 'application', notes: s.deadlineNote || null }, base));
      if (ACTIVE.has(s.status)) s._items.filter((x) => x.test && x.state === 'todo').forEach((x) => {
        const st = (x.sittings || []).filter((z) => z.bookBy && z.bookBy >= today())[0];
        if (st) out.push(Object.assign({ id: 'app_' + s.id + '_' + x.key, title: 'Book the ' + x.test + ' (' + st.label + ' sitting)', date: st.bookBy, type: 'other', notes: st.dates }, base));
      });
      const d = s.decision && s.decision.data;
      if (d && d.acceptBy && !d.choice) out.push(Object.assign({ id: 'app_' + s.id + '_reply', title: 'Reply to your offer — ' + s.course.name, date: d.acceptBy, type: 'application' }, base));
      if (d && d.deposit && d.deposit.due && !d.depositPaid) out.push(Object.assign({ id: 'app_' + s.id + '_deposit', title: 'Deposit due — ' + s.course.name, date: d.deposit.due, type: 'application' }, base));
    });
    // one shared date for several applications (e.g. 13 Jan for every UCAS choice) stays one row per application — the Deadlines page groups by day
    return out.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  }
  function publicSummary(s) { const o = Object.assign({}, s); delete o._items; return o; }

  /* ── writing: counts and deterministic checks ────────────────────── */
  const CLICHES = [/ever since i was (young|little|a child)/i, /from a young age/i, /sparked my (interest|passion|curiosity)/i, /solid foundation/i, /i have always been (fascinated|passionate|interested)/i, /\bpassion(ate)?\b/i, /since the dawn of time/i, /in today'?s (fast-paced )?world/i, /dictionary defines/i, /\bmyriad\b/i, /\btapestry\b/i, /\bdelve\b/i, /\bunwavering\b/i, /\bembark(ed)? on (a|this) journey\b/i];
  function partsOf(body) { if (!body) return []; if (Array.isArray(body.parts)) return body.parts.map((p) => String(p || '')); return [String(body.text || '')]; }
  function statsFor(body, spec) {
    spec = spec || {}; const parts = partsOf(body), all = parts.join('\n\n');
    const chars = parts.reduce((n, p) => n + p.length, 0), words = (all.match(/[\p{L}\p{N}’'-]+/gu) || []).length;
    const problems = [], warnings = [];
    const lim = spec.limit || {};
    if (lim.chars && chars > lim.chars) problems.push('Over the limit: ' + chars.toLocaleString('en-GB') + ' / ' + lim.chars.toLocaleString('en-GB') + ' characters.');
    if (lim.words && words > lim.words) problems.push('Over the limit: ' + words + ' / ' + lim.words + ' words.');
    if (lim.minWords && words > 0 && words < lim.minWords) warnings.push('Under the minimum of ' + lim.minWords + ' words.');
    (spec.parts || []).forEach((p, i) => {
      const t = parts[i] || '', w = (t.match(/[\p{L}\p{N}’'-]+/gu) || []).length;
      if (p.min && t.length < p.min) (chars ? problems : warnings).push('Answer ' + (i + 1) + ' needs at least ' + p.min + ' characters (now ' + t.length + ').');
      if (p.maxWords && w > p.maxWords) problems.push('Answer ' + (i + 1) + ' is over ' + p.maxWords + ' words (' + w + ').');
    });
    CLICHES.forEach((re) => { const m = all.match(re); if (m) warnings.push('Generic phrase: “' + m[0] + '”'); });
    return { chars, words, problems, warnings, parts: parts.map((p) => ({ chars: p.length, words: (p.match(/[\p{L}\p{N}’'-]+/gu) || []).length })) };
  }
  function specFor(sysId, kind) {
    const sys = SYS.systems[sysId] || SYS.systems.portal;
    return (sys.writing || []).filter((w) => w.kind === kind)[0] || null;
  }
  async function ensureWriting(user, a) {
    const sys = sysOf(a);
    for (const w of sys.writing || []) {
      const scope = w.scope === 'system' ? 'system:' + a.system : 'app:' + a.id;
      const spec = { kind: w.kind, parts: w.parts || null, limit: w.limit || null, prompts: w.prompts || null, note: w.note || '', s: w.s || null, shared: !!w.shared, system: a.system };
      await q(`INSERT INTO ${T('app_writing')} (id, user_id, scope, kind, title, spec, working) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id, scope, kind, title) DO NOTHING`,
        [rid('w_'), user.id, scope, w.kind, w.title, spec, w.parts ? { parts: w.parts.map(() => '') } : { text: '' }]);
    }
  }
  async function ownWriting(user, id) {
    const r = await q(`SELECT * FROM ${T('app_writing')} WHERE id=$1 AND user_id=$2`, [String(id || ''), user.id]);
    return r.rows[0] || null;
  }
  function cleanBody(body, spec) {
    if (spec && spec.parts) return { parts: spec.parts.map((p, i) => clipText(body && body.parts ? body.parts[i] : '', 12000)) };
    return { text: clipText(body && body.text != null ? body.text : (body && body.parts ? body.parts.join('\n\n') : ''), 30000) };
  }

  /* ── routes: applications ────────────────────────────────────────── */
  app.get(P, route(async (req, res, user) => {
    const r = await q(`SELECT * FROM ${T('app_applications')} WHERE user_id=$1 ORDER BY position, created_at`, [user.id]);
    const C = await loadCtx(user, r.rows);
    const sums = r.rows.map((a) => summarize(a, C));
    const actives = sums.filter((s) => s.next).sort((x, y) => ((x.next.days == null ? 999 : x.next.days) - (y.next.days == null ? 999 : y.next.days)) || x.next.order - y.next.order);
    const next = actives[0] ? Object.assign({ appId: actives[0].id, course: actives[0].course.name, uniName: actives[0].uni.name, system: actives[0].system }, actives[0].next) : null;
    const later = actives.slice(1, 4).map((s) => Object.assign({ appId: s.id, uniName: s.uni.name }, s.next));
    res.json({ ok: true, apps: sums.map(publicSummary), next, later, deadlines: deadlinesOf(sums), profileUpdatedAt: C.profile.updatedAt || null, checked: SYS.checked, aiConfigured: synth.hasOpenAI() });
  }));

  app.post(P, route(async (req, res, user) => {
    const b = req.body || {};
    const cc = clip(b.uniCc, 4).toLowerCase(), id = clip(b.uniId, 80), u = uniInfo(cc, id);
    if (!u) return res.status(400).json({ error: 'unknown_university', message: 'Pick a university from the list.' });
    const course = b.courseId ? coursesFor(cc, id).filter((c) => c.id === b.courseId)[0] : null;
    const courseName = clip(course ? course.name : b.courseName, 120);
    if (!courseName) return res.status(400).json({ error: 'course_required', message: 'Add the course you are applying for.' });
    const count = await q(`SELECT count(*)::int AS n FROM ${T('app_applications')} WHERE user_id=$1`, [user.id]);
    if (count.rows[0].n >= 60) return res.status(400).json({ error: 'too_many', message: 'That’s a lot of applications — remove some first.' });
    const dup = await q(`SELECT id FROM ${T('app_applications')} WHERE user_id=$1 AND uni_cc=$2 AND uni_id=$3 AND lower(course_name)=lower($4)`, [user.id, cc, id, courseName]);
    if (dup.rows[0]) return res.status(409).json({ error: 'exists', id: dup.rows[0].id, message: 'You already have this application.' });
    const system = SYS.systems[b.system] ? b.system : systemFor(cc, id);
    const a = { id: rid('ap_'), user_id: user.id, uni_cc: cc, uni_id: id, uni_name: u.name, course_id: course ? course.id : null, course_name: courseName, level: ['bachelor', 'master', 'phd'].indexOf(b.level) !== -1 ? b.level : 'bachelor', system, round: clip(b.round, 12) || null };
    const dl = isDate(b.deadline) ? { date: b.deadline, src: 'user', note: 'Set by you', round: a.round } : defaultDeadline(a);
    a.round = a.round || dl.round || null;
    await q(`INSERT INTO ${T('app_applications')} (id, user_id, uni_cc, uni_id, uni_name, course_id, course_name, level, system, round, deadline, deadline_src, deadline_note, position)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, (SELECT coalesce(max(position),0)+1 FROM ${T('app_applications')} WHERE user_id=$2))`,
      [a.id, a.user_id, cc, id, u.name, a.course_id, courseName, a.level, system, a.round, dl.date, dl.src, dl.note]);
    await ensureWriting(user, a);
    res.json({ ok: true, id: a.id });
  }));

  app.get(P + '/catalog/search', route(async (req, res) => {
    const term = String(req.query.q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    if (term.length < 2) return res.json({ unis: [] });
    const words = term.split(/\s+/);
    const hits = IDX.unis.filter((u) => { const n = (u.name + ' ' + (u.abbr || '') + ' ' + (u.city || '')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return words.every((w) => n.indexOf(w) !== -1); })
      .slice(0, 12).map((u) => ({ cc: u.cc, id: u.id, name: u.name, abbr: u.abbr || '', city: u.city || '', country: COUNTRY[u.cc] || '', color: u.color || '#3552d8', courses: coursesFor(u.cc, u.id).length }));
    res.json({ unis: hits });
  }));
  app.get(P + '/catalog/:cc/:id', route(async (req, res) => {
    const u = uniInfo(String(req.params.cc).toLowerCase(), req.params.id);
    if (!u) return res.status(404).json({ error: 'not_found' });
    const sysId = systemFor(u.cc, u.id), sys = SYS.systems[sysId], col = (SYS.colleges || {})[u.cc + ':' + u.id] || null;
    res.json({ uni: u, courses: coursesFor(u.cc, u.id).map((c) => ({ id: c.id, name: c.name, fam: c.fam, ic: c.ic })), system: { id: sysId, name: sys.name, summary: sys.summary },
      systems: Object.keys(SYS.systems).map((k) => ({ id: k, name: SYS.systems[k].name })),
      rounds: sysId === 'commonapp' && col ? col.rounds : (sys.rounds || []), ucasOct: SYS.ucasOct });
  }));
  app.get(P + '/meta/systems', route(async (req, res) => { res.json({ checked: SYS.checked, systems: SYS.systems, tests: SYS.tests }); }));

  app.get(P + '/one/:id', route(async (req, res, user) => {
    const a = await ownApp(user, req.params.id); if (!a) return res.status(404).json({ error: 'not_found' });
    await ensureWriting(user, a);
    const C = await loadCtx(user, [a]);
    const s = summarize(a, C), sys = sysOf(a), course = courseOf(a), col = college(a);
    const dec = C.decisions[a.id];
    const conditions = dec && dec.data && Array.isArray(dec.data.conditions) ? dec.data.conditions : null;
    const u = s.uni, city = CITY.get(a.uni_cc + ':' + (u.city || '')) || null;
    res.json({ ok: true, app: publicSummary(s), requirements: s._items,
      writing: C.writingFor(a).map((w) => ({ id: w.id, kind: w.kind, title: w.title, status: w.status, shared: w.scope.indexOf('system:') === 0, stats: w.stats, spec: w.spec, updatedAt: w.updated_at })),
      documents: C.docList, gradeCheck: gradeCheck(a, C.profile, conditions && conditions.length ? conditions : null),
      system: { id: a.system, name: sys.name, full: sys.full || '', summary: sys.summary, rules: sys.rules || [], submit: sys.submit || [], fee: col && col.fee ? col.fee : sys.fee || null, limits: sys.limits || null, rounds: a.system === 'commonapp' && col ? col.rounds : (sys.rounds || []), portal: s.system.portal, portalLabel: sys.portalLabel },
      course: course ? { name: course.name, al: course.al, alLow: course.alLow, ib: course.ib, ibLow: course.ibLow, hl: course.hl, ctx: course.ctx, test: course.test, iv: course.iv, stat: course.stat, note: course.note, s: course.s } : null,
      costs: { tuition: u.tuition || '', living: city ? city.cost || '' : '', city: u.city || '' },
      notes: a.notes || '', submissionRef: a.submission_ref || '', checked: SYS.checked });
  }));

  app.patch(P + '/one/:id', route(async (req, res, user) => {
    const a = await ownApp(user, req.params.id); if (!a) return res.status(404).json({ error: 'not_found' });
    const b = req.body || {}, set = [], vals = [];
    const put = (col, v) => { vals.push(v); set.push(col + '=$' + vals.length); };
    if (b.status && STATUSES.indexOf(b.status) !== -1) { put('status', b.status); if (b.status === 'submitted' && !a.submitted_at) put('submitted_at', isDate(b.submittedOn) ? b.submittedOn : new Date()); }
    if (b.submittedOn && isDate(b.submittedOn)) put('submitted_at', b.submittedOn);
    if (b.deadline !== undefined) { if (b.deadline === null) { const d = defaultDeadline(Object.assign({}, a, { round: b.round || a.round })); put('deadline', d.date); put('deadline_src', d.src); put('deadline_note', d.note); } else if (isDate(b.deadline)) { put('deadline', b.deadline); put('deadline_src', 'user'); put('deadline_note', 'Set by you'); } }
    if (b.round !== undefined && b.deadline === undefined) { const d = defaultDeadline(Object.assign({}, a, { round: clip(b.round, 12) })); put('round', clip(b.round, 12) || null); if (a.deadline_src !== 'user' && a.deadline_src !== 'official') { put('deadline', d.date); put('deadline_src', d.src); put('deadline_note', d.note); } }
    if (b.courseName) put('course_name', clip(b.courseName, 120));
    if (b.notes !== undefined) put('notes', clipText(b.notes, 4000));
    if (b.portalUrl !== undefined) put('portal_url', /^https:\/\//.test(b.portalUrl || '') ? clip(b.portalUrl, 400) : null);
    if (b.submissionRef !== undefined) put('submission_ref', clip(b.submissionRef, 80));
    if (b.position !== undefined && Number.isFinite(+b.position)) put('position', Math.round(+b.position));
    if (b.system && SYS.systems[b.system] && b.system !== a.system) { put('system', b.system); }
    if (!set.length) return res.json({ ok: true });
    vals.push(a.id, user.id);
    await q(`UPDATE ${T('app_applications')} SET ${set.join(', ')}, updated_at=now() WHERE id=$${vals.length - 1} AND user_id=$${vals.length}`, vals);
    if (b.system && SYS.systems[b.system]) await ensureWriting(user, Object.assign({}, a, { system: b.system }));
    res.json({ ok: true });
  }));

  app.delete(P + '/one/:id', route(async (req, res, user) => {
    const a = await ownApp(user, req.params.id); if (!a) return res.status(404).json({ error: 'not_found' });
    await q(`DELETE FROM ${T('app_writing')} WHERE user_id=$1 AND scope=$2`, [user.id, 'app:' + a.id]);
    await q(`DELETE FROM ${T('app_applications')} WHERE id=$1 AND user_id=$2`, [a.id, user.id]);
    res.json({ ok: true });
  }));

  app.put(P + '/one/:id/items/:key', route(async (req, res, user) => {
    const a = await ownApp(user, req.params.id); if (!a) return res.status(404).json({ error: 'not_found' });
    const key = clip(req.params.key, 60), b = req.body || {};
    const state = ['todo', 'doing', 'done', 'na'].indexOf(b.state) !== -1 ? b.state : 'todo';
    let docId = b.docId ? clip(b.docId, 40) : null;
    if (docId) { const d = await q(`SELECT id FROM ${T('app_documents')} WHERE id=$1 AND user_id=$2`, [docId, user.id]); if (!d.rows[0]) docId = null; }
    const data = b.data && typeof b.data === 'object' ? { date: isDate(b.data.date) ? b.data.date : null, score: clip(b.data.score, 30), who: clip(b.data.who, 80), note: clip(b.data.note, 300), manual: !!b.data.manual } : null;
    await q(`INSERT INTO ${T('app_items')} (app_id, key, state, doc_id, data, updated_at) VALUES ($1,$2,$3,$4,$5,now())
             ON CONFLICT (app_id, key) DO UPDATE SET state=EXCLUDED.state, doc_id=EXCLUDED.doc_id, data=EXCLUDED.data, updated_at=now()`, [a.id, key, state, docId, data]);
    await autoAdvance(user, a);
    res.json({ ok: true });
  }));
  // planning → preparing → ready follow the checklist; later stages are the student's call
  async function autoAdvance(user, a) {
    if (!ACTIVE.has(a.status)) return;
    const C = await loadCtx(user, [a]); const s = summarize(a, C);
    const want = s.readiness.pct >= 100 ? 'ready' : s.readiness.done > 0 || C.writingFor(a).some((w) => w.stats.chars > 0) ? 'preparing' : a.status;
    if (want !== a.status) await q(`UPDATE ${T('app_applications')} SET status=$1, updated_at=now() WHERE id=$2 AND user_id=$3`, [want, a.id, user.id]);
  }

  /* ── profile ─────────────────────────────────────────────────────── */
  app.get(P + '/profile', route(async (req, res, user) => { res.json({ ok: true, profile: await getProfile(user.id) }); }));
  app.put(P + '/profile', route(async (req, res, user) => {
    const p = cleanProfile(req.body || {});
    await q(`INSERT INTO ${T('app_profile')} (user_id, data, updated_at) VALUES ($1,$2,now()) ON CONFLICT (user_id) DO UPDATE SET data=EXCLUDED.data, updated_at=now()`, [user.id, p]);
    const apps = await q(`SELECT * FROM ${T('app_applications')} WHERE user_id=$1`, [user.id]);
    for (const a of apps.rows) await autoAdvance(user, a);
    res.json({ ok: true, profile: p });
  }));

  /* ── documents (stored in Postgres, served only to their owner) ─── */
  const MIME = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain' };
  function sniff(buf, ext) {
    if (buf.slice(0, 4).toString() === '%PDF') return 'application/pdf';
    if (buf[0] === 0x89 && buf.slice(1, 4).toString() === 'PNG') return 'image/png';
    if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
    if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
    if (ext === 'docx' && buf[0] === 0x50 && buf[1] === 0x4b) return MIME.docx;
    if (ext === 'doc' && buf[0] === 0xd0 && buf[1] === 0xcf) return MIME.doc;
    if (ext === 'txt' && !buf.slice(0, 2000).includes(0)) return MIME.txt;
    return null;
  }
  const uploadLimit = new Map();
  app.post(P + '/docs', express.raw({ type: () => true, limit: '8mb' }), route(async (req, res, user) => {
    const now = Date.now(), h = (uploadLimit.get(user.id) || []).filter((t) => now - t < 3600e3); h.push(now); uploadLimit.set(user.id, h);
    if (h.length > 40) return res.status(429).json({ error: 'slow_down', message: 'Too many uploads in an hour — try again later.' });
    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || !buf.length) return res.status(400).json({ error: 'empty' });
    let name = ''; try { name = decodeURIComponent(String(req.get('x-file-name') || '')); } catch (e) { name = ''; }
    name = clip(name.replace(/[\\/:*?"<>|]+/g, '_'), 120) || 'document';
    const ext = (name.split('.').pop() || '').toLowerCase(), mime = sniff(buf, ext);
    if (!mime) return res.status(415).json({ error: 'type', message: 'Upload a PDF, image (PNG/JPG/WebP), Word document or text file.' });
    const kind = DOC_KINDS.indexOf(req.get('x-doc-kind')) !== -1 ? req.get('x-doc-kind') : 'other';
    const used = await q(`SELECT coalesce(sum(size),0)::bigint AS n, count(*)::int AS c FROM ${T('app_documents')} WHERE user_id=$1`, [user.id]);
    if (+used.rows[0].n + buf.length > 150 * 1024 * 1024 || used.rows[0].c >= 200) return res.status(400).json({ error: 'quota', message: 'Your document storage is full — remove old files first.' });
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    const same = await q(`SELECT id, kind, name, mime, size, status, created_at FROM ${T('app_documents')} WHERE user_id=$1 AND sha256=$2`, [user.id, sha]);
    if (same.rows[0]) return res.json({ ok: true, doc: same.rows[0], reused: true });
    const id = rid('doc_');
    await q(`INSERT INTO ${T('app_documents')} (id, user_id, kind, name, mime, size, sha256, body) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [id, user.id, kind, name, mime, buf.length, sha, buf]);
    res.json({ ok: true, doc: { id, kind, name, mime, size: buf.length, status: 'uploaded', created_at: new Date() } });
  }));
  app.get(P + '/docs', route(async (req, res, user) => {
    const r = await q(`SELECT d.id, d.kind, d.name, d.mime, d.size, d.status, d.created_at,
        (SELECT count(*)::int FROM ${T('app_items')} i JOIN ${T('app_applications')} a ON a.id=i.app_id WHERE i.doc_id=d.id AND a.user_id=$1) AS used
      FROM ${T('app_documents')} d WHERE d.user_id=$1 ORDER BY d.created_at DESC`, [user.id]);
    res.json({ ok: true, docs: r.rows });
  }));
  app.get(P + '/docs/:id/file', route(async (req, res, user) => {
    const r = await q(`SELECT name, mime, body FROM ${T('app_documents')} WHERE id=$1 AND user_id=$2`, [String(req.params.id), user.id]);
    const d = r.rows[0]; if (!d) return res.status(404).json({ error: 'not_found' });
    res.set({ 'Content-Type': d.mime || 'application/octet-stream', 'Content-Disposition': 'inline; filename*=UTF-8\'\'' + encodeURIComponent(d.name), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(d.body);
  }));
  app.patch(P + '/docs/:id', route(async (req, res, user) => {
    const b = req.body || {}, set = [], vals = [];
    if (b.kind && DOC_KINDS.indexOf(b.kind) !== -1) { vals.push(b.kind); set.push('kind=$' + vals.length); }
    if (b.name) { vals.push(clip(String(b.name).replace(/[\\/:*?"<>|]+/g, '_'), 120)); set.push('name=$' + vals.length); }
    if (b.status && ['uploaded', 'needs_review'].indexOf(b.status) !== -1) { vals.push(b.status); set.push('status=$' + vals.length); }
    if (!set.length) return res.json({ ok: true });
    vals.push(String(req.params.id), user.id);
    const r = await q(`UPDATE ${T('app_documents')} SET ${set.join(', ')} WHERE id=$${vals.length - 1} AND user_id=$${vals.length}`, vals);
    res.json({ ok: r.rowCount > 0 });
  }));
  app.delete(P + '/docs/:id', route(async (req, res, user) => {
    const id = String(req.params.id);
    const r = await q(`DELETE FROM ${T('app_documents')} WHERE id=$1 AND user_id=$2`, [id, user.id]);
    if (r.rowCount) await q(`UPDATE ${T('app_items')} SET doc_id=NULL, state='todo', updated_at=now() WHERE doc_id=$1 AND app_id IN (SELECT id FROM ${T('app_applications')} WHERE user_id=$2)`, [id, user.id]);
    res.json({ ok: r.rowCount > 0 });
  }));

  /* ── writing ─────────────────────────────────────────────────────── */
  app.get(P + '/writing/:wid', route(async (req, res, user) => {
    const w = await ownWriting(user, req.params.wid); if (!w) return res.status(404).json({ error: 'not_found' });
    const v = await q(`SELECT id, n, label, words, chars, origin, feedback, created_at FROM ${T('app_writing_versions')} WHERE writing_id=$1 ORDER BY n`, [w.id]);
    const apps = w.scope.indexOf('app:') === 0 ? await q(`SELECT id, uni_name, course_name, system FROM ${T('app_applications')} WHERE id=$1 AND user_id=$2`, [w.scope.slice(4), user.id])
      : await q(`SELECT id, uni_name, course_name, system FROM ${T('app_applications')} WHERE user_id=$1 AND system=$2`, [user.id, w.scope.slice(7)]);
    res.json({ ok: true, writing: { id: w.id, kind: w.kind, title: w.title, prompt: w.prompt || '', spec: w.spec || {}, interview: w.interview || {}, working: w.working || {}, status: w.status, stats: statsFor(w.working, w.spec), updatedAt: w.updated_at, shared: w.scope.indexOf('system:') === 0 },
      versions: v.rows, apps: apps.rows });
  }));
  app.put(P + '/writing/:wid', route(async (req, res, user) => {
    const w = await ownWriting(user, req.params.wid); if (!w) return res.status(404).json({ error: 'not_found' });
    const b = req.body || {}, set = [], vals = [];
    const put = (c, v) => { vals.push(v); set.push(c + '=$' + vals.length); };
    if (b.working) put('working', cleanBody(b.working, w.spec));
    if (b.interview && typeof b.interview === 'object') { const iv = {}; Object.keys(b.interview).slice(0, 20).forEach((k) => { iv[clip(k, 30)] = clipText(b.interview[k], 1500); }); put('interview', iv); }
    if (b.status && ['draft', 'review', 'final'].indexOf(b.status) !== -1) put('status', b.status);
    if (b.prompt !== undefined) put('prompt', clipText(b.prompt, 2000));
    if (b.title) put('title', clip(b.title, 120));
    if (b.limit && w.spec && !w.spec.parts) { const sp = Object.assign({}, w.spec, { limit: { chars: +b.limit.chars || null, words: +b.limit.words || null } }); put('spec', sp); }
    if (!set.length) return res.json({ ok: true });
    vals.push(w.id, user.id);
    await q(`UPDATE ${T('app_writing')} SET ${set.join(', ')}, updated_at=now() WHERE id=$${vals.length - 1} AND user_id=$${vals.length}`, vals);
    if (b.status || b.working) await advanceFor(user, w);
    const fresh = await ownWriting(user, w.id);
    res.json({ ok: true, stats: statsFor(fresh.working, fresh.spec), status: fresh.status });
  }));
  async function advanceFor(user, w) {
    const r = w.scope.indexOf('app:') === 0 ? await q(`SELECT * FROM ${T('app_applications')} WHERE id=$1 AND user_id=$2`, [w.scope.slice(4), user.id])
      : await q(`SELECT * FROM ${T('app_applications')} WHERE user_id=$1 AND system=$2`, [user.id, w.scope.slice(7)]);
    for (const a of r.rows) await autoAdvance(user, a);
  }
  // a new piece for one application (e.g. a college's supplement question)
  app.post(P + '/one/:id/writing', route(async (req, res, user) => {
    const a = await ownApp(user, req.params.id); if (!a) return res.status(404).json({ error: 'not_found' });
    const b = req.body || {}, title = clip(b.title, 120) || 'Short answer';
    const spec = { kind: 'short', limit: { words: +b.words || null, chars: +b.chars || null }, note: 'Added by you from the application form.', s: null, system: a.system };
    const id = rid('w_');
    await q(`INSERT INTO ${T('app_writing')} (id, user_id, scope, kind, title, prompt, spec, working) VALUES ($1,$2,$3,'short',$4,$5,$6,$7)`, [id, user.id, 'app:' + a.id, title, clipText(b.prompt, 2000), spec, { text: '' }]);
    res.json({ ok: true, id });
  }));
  app.delete(P + '/writing/:wid', route(async (req, res, user) => {
    const w = await ownWriting(user, req.params.wid); if (!w || w.kind !== 'short') return res.status(400).json({ error: 'not_allowed', message: 'Only pieces you added yourself can be deleted.' });
    await q(`DELETE FROM ${T('app_writing')} WHERE id=$1 AND user_id=$2`, [w.id, user.id]);
    res.json({ ok: true });
  }));
  // versions are snapshots: saving never overwrites an older one
  app.post(P + '/writing/:wid/versions', route(async (req, res, user) => {
    const w = await ownWriting(user, req.params.wid); if (!w) return res.status(404).json({ error: 'not_found' });
    const b = req.body || {}, body = cleanBody(b.body || w.working, w.spec), st = statsFor(body, w.spec);
    const nRow = await q(`SELECT coalesce(max(n),0)+1 AS n FROM ${T('app_writing_versions')} WHERE writing_id=$1`, [w.id]);
    const n = nRow.rows[0].n, label = b.final ? 'Final' : clip(b.label, 40) || 'Draft ' + n;
    const id = rid('v_'), origin = ['student', 'ai_accepted', 'ai_draft'].indexOf(b.origin) !== -1 ? b.origin : 'student';
    await q(`INSERT INTO ${T('app_writing_versions')} (id, writing_id, n, label, body, words, chars, origin, feedback) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, w.id, n, label, body, st.words, st.chars, origin, b.feedback && typeof b.feedback === 'object' ? b.feedback : null]);
    if (b.makeWorking !== false) await q(`UPDATE ${T('app_writing')} SET working=$1, status=$2, updated_at=now() WHERE id=$3`, [body, b.final ? 'final' : w.status === 'final' ? 'draft' : w.status, w.id]);
    res.json({ ok: true, version: { id, n, label, words: st.words, chars: st.chars, origin } });
  }));
  app.get(P + '/writing/:wid/versions/:n', route(async (req, res, user) => {
    const w = await ownWriting(user, req.params.wid); if (!w) return res.status(404).json({ error: 'not_found' });
    const r = await q(`SELECT id, n, label, body, words, chars, origin, feedback, created_at FROM ${T('app_writing_versions')} WHERE writing_id=$1 AND n=$2`, [w.id, +req.params.n || 0]);
    if (!r.rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true, version: r.rows[0] });
  }));

  /* ── decisions & offers ──────────────────────────────────────────── */
  app.put(P + '/one/:id/decision', route(async (req, res, user) => {
    const a = await ownApp(user, req.params.id); if (!a) return res.status(404).json({ error: 'not_found' });
    const b = req.body || {}, decision = DECISIONS.indexOf(b.decision) !== -1 ? b.decision : null;
    if (!decision) return res.status(400).json({ error: 'decision_required' });
    const money = (m) => m && +m.amount > 0 ? { amount: Math.round(+m.amount * 100) / 100, currency: clip(m.currency, 4).toUpperCase() || 'EUR', per: clip(m.per, 20) || 'year', name: clip(m.name, 80) } : null;
    const data = {
      conditions: (Array.isArray(b.conditions) ? b.conditions : []).slice(0, 12).map((c) => ({ subject: clip(c.subject, 60), grade: clip(c.grade, 12) })).filter((c) => c.subject),
      conditionsText: clipText(b.conditionsText, 1000), tuition: money(b.tuition), scholarship: money(b.scholarship), living: money(b.living),
      acceptBy: isDate(b.acceptBy) ? b.acceptBy : null, deposit: b.deposit && +b.deposit.amount > 0 ? Object.assign(money(b.deposit), { due: isDate(b.deposit.due) ? b.deposit.due : null }) : null,
      depositPaid: !!b.depositPaid, choice: ['firm', 'insurance', 'accepted', 'declined'].indexOf(b.choice) !== -1 ? b.choice : null,
      housing: clipText(b.housing, 600), visa: clipText(b.visa, 600), notes: clipText(b.notes, 2000), receivedOn: isDate(b.receivedOn) ? b.receivedOn : today(),
    };
    await q(`INSERT INTO ${T('app_decisions')} (app_id, decision, data, updated_at) VALUES ($1,$2,$3,now()) ON CONFLICT (app_id) DO UPDATE SET decision=EXCLUDED.decision, data=EXCLUDED.data, updated_at=now()`, [a.id, decision, data]);
    const status = /^offer/.test(decision) ? 'offer' : decision === 'waitlisted' ? 'waitlisted' : 'declined';
    await q(`UPDATE ${T('app_applications')} SET status=$1, submitted_at=coalesce(submitted_at, now()), updated_at=now() WHERE id=$2 AND user_id=$3`, [status, a.id, user.id]);
    res.json({ ok: true });
  }));
  app.delete(P + '/one/:id/decision', route(async (req, res, user) => {
    const a = await ownApp(user, req.params.id); if (!a) return res.status(404).json({ error: 'not_found' });
    await q(`DELETE FROM ${T('app_decisions')} WHERE app_id=$1`, [a.id]);
    await q(`UPDATE ${T('app_applications')} SET status='submitted', updated_at=now() WHERE id=$1 AND user_id=$2`, [a.id, user.id]);
    res.json({ ok: true });
  }));

  /* ── AI application assistant ────────────────────────────────────── */
  // Not a chat: every call is one specific task with the student's real context
  // attached (profile, grades, the exact course, system rules and limits, the draft).
  const AI_LIMIT = { free: 12, elite: 150 };
  async function spend(user) {
    const limit = isElite(user) ? AI_LIMIT.elite : AI_LIMIT.free;
    const r = await q(`INSERT INTO ${T('app_ai_usage')} (user_id, day, n) VALUES ($1, CURRENT_DATE, 1) ON CONFLICT (user_id, day) DO UPDATE SET n = ${T('app_ai_usage')}.n + 1 RETURNING n`, [user.id]);
    return { ok: r.rows[0].n <= limit, used: r.rows[0].n, limit };
  }
  async function quota(user) {
    const limit = isElite(user) ? AI_LIMIT.elite : AI_LIMIT.free;
    const r = await q(`SELECT n FROM ${T('app_ai_usage')} WHERE user_id=$1 AND day=CURRENT_DATE`, [user.id]);
    return { used: r.rows[0] ? r.rows[0].n : 0, limit };
  }
  // Models sometimes return one combined block for a multi-part text. Repair it from
  // "ANSWER n:" markers or paragraphs; if that's impossible, report it instead of
  // handing back a suggestion that silently empties an answer.
  function normParts(arr, n, tidy) {
    let a = Array.isArray(arr) ? arr.map((x) => tidy(x)) : typeof arr === 'string' ? [tidy(arr)] : [];
    a = a.map((x) => x.replace(/^\s*(ANSWER|Answer|Question)\s*\d+\s*[:.)-]\s*/, ''));
    if (a.length === n && a.every((x) => x.trim())) return a;
    const all = a.join('\n\n');
    const marked = all.split(/\n?\s*(?:ANSWER|Answer|Question)\s*\d+\s*[:.)-]\s*/).map((x) => x.trim()).filter(Boolean);
    if (marked.length === n) return marked;
    const paras = all.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    if (paras.length === n) return paras;
    return null;
  }
  function parseJSON(text) {
    try { return JSON.parse(text); } catch (e) {}
    const m = String(text || '').match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
    return null;
  }
  const VOICE = 'Write like a real, thoughtful 17–18-year-old applicant: plain words, specific details, short clear sentences, first person. ' +
    'No clichés ("ever since I was young", "from a young age", "passion", "sparked my interest", "solid foundation", "rigorous", "I am excited", "tapestry", "delve", "embark on a journey", "in today\'s world"), no grand claims, no corporate tone, no fake emotional storytelling, no fancy vocabulary the student would not use.';
  const HONEST = 'NEVER invent achievements, awards, competitions, grades, scores, projects, jobs, volunteering, books, people, places, numbers or motivations. Use ONLY facts given in STUDENT FACTS, ANSWERS or the DRAFT. If something is missing, do not fill it in — say what is missing.';
  function factsBlock(prof) {
    const L = [];
    if (prof.qualification) L.push('Qualification: ' + [prof.qualification.label, prof.qualification.total ? 'total ' + prof.qualification.total + (prof.qualification.predicted ? ' (predicted)' : '') : ''].filter(Boolean).join(', '));
    if ((prof.grades || []).length) L.push('Subjects & grades: ' + prof.grades.map((g) => g.name + (g.level ? ' ' + g.level : '') + ': ' + g.grade + (g.predicted ? ' (pred.)' : '')).join('; '));
    if ((prof.languages || []).length) L.push('Languages: ' + prof.languages.map((l) => l.name + (l.level ? ' (' + l.level + ')' : '') + (l.cert ? ' ' + l.cert + ' ' + (l.score || '') : '')).join('; '));
    if ((prof.tests || []).length) L.push('Tests: ' + prof.tests.map((t) => t.name + ' ' + t.score).join('; '));
    (prof.experiences || []).forEach((x) => L.push('[' + x.id + '] ' + (x.type || 'experience') + ': ' + x.title + (x.org ? ' — ' + x.org : '') + (x.when ? ' (' + x.when + ')' : '') + (x.what ? '. What: ' + x.what : '') + (x.learned ? '. Learned: ' + x.learned : '')));
    if (prof.interests) L.push('Interests: ' + prof.interests);
    if (prof.goals) L.push('Goals: ' + prof.goals);
    return L.length ? L.join('\n') : '(nothing in the profile yet)';
  }
  function targetsBlock(apps) {
    return apps.map((a) => '- ' + a.uni_name + ' — ' + a.course_name + ' (' + (SYS.systems[a.system] || {}).name + (a.deadline ? ', deadline ' + ymd(a.deadline) : '') + ')').join('\n') || '(none)';
  }
  function specBlock(w) {
    const sp = w.spec || {}, L = ['Piece: ' + w.title + ' (' + (SYS.systems[sp.system] || {}).name + ')'];
    if (sp.parts) sp.parts.forEach((p, i) => L.push('Question ' + (i + 1) + ': ' + p.q + (p.min ? ' (min ' + p.min + ' characters)' : '') + (p.maxWords ? ' (max ' + p.maxWords + ' words)' : '')));
    if (w.prompt) L.push('Prompt: ' + w.prompt);
    const lim = sp.limit || {};
    if (lim.chars) L.push('Limit: ' + lim.chars + ' characters in total, including spaces.');
    if (lim.words) L.push('Limit: ' + lim.words + ' words' + (lim.minWords ? ' (minimum ' + lim.minWords + ')' : '') + '.');
    if (lim.wordsEach) L.push('Limit: ' + lim.wordsEach + ' words per answer.');
    if (sp.note) L.push('Rule: ' + sp.note);
    return L.join('\n');
  }
  function countsLine(body, spec) {   // models can't count characters reliably — give them the real numbers
    const st = statsFor(body, spec);
    return 'COUNTS (computed exactly — trust these, only mention them if they show a problem): ' + (spec && spec.parts ? st.parts.map((p, i) => 'answer ' + (i + 1) + ' ' + p.chars + ' characters / ' + p.words + ' words').join('; ') + '; total ' : 'total ') + st.chars + ' characters, ' + st.words + ' words.' + (st.problems.length ? ' Problems: ' + st.problems.join(' ') : '');
  }
  function bodyText(body, spec) {
    const parts = partsOf(body);
    if (spec && spec.parts) return parts.map((p, i) => 'ANSWER ' + (i + 1) + ':\n' + p).join('\n\n');
    return parts.join('\n\n');
  }
  async function writingCtx(user, w) {
    const prof = await getProfile(user.id);
    const apps = w.scope.indexOf('app:') === 0
      ? (await q(`SELECT * FROM ${T('app_applications')} WHERE id=$1 AND user_id=$2`, [w.scope.slice(4), user.id])).rows
      : (await q(`SELECT * FROM ${T('app_applications')} WHERE user_id=$1 AND system=$2`, [user.id, w.scope.slice(7)])).rows;
    const others = (await q(`SELECT title FROM ${T('app_writing')} WHERE user_id=$1 AND id<>$2`, [user.id, w.id])).rows.map((r) => r.title);
    const courseLines = apps.map((a) => { const c = courseOf(a); return c ? a.uni_name + ' ' + c.name + ': typical offer ' + [c.al, c.ib ? 'IB ' + c.ib : ''].filter(Boolean).join(' / ') + (c.test ? '; test ' + c.test : '') : ''; }).filter(Boolean);
    return { prof, apps, others, courseLines };
  }
  function unusedExperiences(prof, text) {
    const t = String(text || '').toLowerCase();
    return (prof.experiences || []).filter((x) => { const words = x.title.toLowerCase().split(/\W+/).filter((z) => z.length > 4); return words.length && !words.some((z) => t.indexOf(z) !== -1); }).map((x) => ({ id: x.id, title: x.title, type: x.type }));
  }
  async function aiGuard(req, res, user) {
    if (!synth.hasOpenAI()) { res.status(503).json({ error: 'ai_not_configured', message: 'The assistant needs an AI key on the server (GROQ_API_KEY or OPENAI_API_KEY).' }); return false; }
    const s = await spend(user);
    if (!s.ok) { res.status(429).json({ error: 'quota', message: 'You’ve used today’s ' + s.limit + ' assistant actions' + (isElite(user) ? '' : ' — Elite raises the limit') + '. It resets tomorrow.', quota: { used: s.limit, limit: s.limit } }); return false; }
    return s;
  }

  app.get(P + '/ai/quota', route(async (req, res, user) => { res.json({ ok: true, quota: await quota(user), configured: synth.hasOpenAI() }); }));

  // Guided questions → a first draft built only from the student's own answers and profile
  app.post(P + '/ai/draft/:wid', route(async (req, res, user) => {
    const w = await ownWriting(user, req.params.wid); if (!w) return res.status(404).json({ error: 'not_found' });
    const iv = w.interview || {}, answered = Object.keys(iv).filter((k) => String(iv[k] || '').trim().length > 15);
    if (answered.length < 3) return res.status(400).json({ error: 'need_answers', message: 'Answer at least three of the questions first — the draft is built only from what you tell us.' });
    const s = await aiGuard(req, res, user); if (!s) return;
    const C = await writingCtx(user, w), sp = w.spec || {};
    const sys = 'You help a student turn THEIR OWN answers into a first draft of an application text. ' + HONEST + ' ' + VOICE +
      ' Structure it so each part answers its question directly. Keep within the limits; use the space only when there is real material — never pad. ' +
      'If the draft would be under about 80% of the limit, "missing" MUST hold 2–5 short questions about details the student could add. ' +
      (sp.parts ? '"parts" MUST be a JSON array of exactly ' + sp.parts.length + ' strings — one answer per question, in order, each answering only its own question. ' : '') +
      'Return ONLY JSON: {"' + (sp.parts ? 'parts":["answer 1","answer 2","answer 3"' + (sp.parts.length > 3 ? ',"answer 4"' : '') + ']' : 'text":"the draft"') + ',"used":["fact ids or short labels you used"],"missing":["specific questions to ask the student to make it stronger"],"notes":"one or two sentences on what to do next"}';
    const user1 = 'STUDENT FACTS:\n' + factsBlock(C.prof) + '\n\nAPPLYING TO:\n' + targetsBlock(C.apps) + (C.courseLines.length ? '\n' + C.courseLines.join('\n') : '') +
      '\n\nTASK:\n' + specBlock(w) + '\n\nANSWERS (the student\'s own words):\n' + Object.keys(iv).map((k) => k + ': ' + iv[k]).join('\n');
    try {
      const out = await synth.chat(sys, user1, { json: true, temperature: 0.45, maxTokens: 3200 });
      const j = parseJSON(out.text);
      if (!j) return res.status(502).json({ error: 'ai_bad_output', message: 'The assistant returned something unreadable — try again.' });
      const tidy = (t) => clipText(String(t || '').replace(/[ \t]{2,}/g, ' ').replace(/\u2011/g, '-'), 12000);
      const np = sp.parts ? normParts(j.parts, sp.parts.length, tidy) : null;
      if (sp.parts && !np) return res.status(502).json({ error: 'ai_bad_output', message: 'The assistant didn’t return one answer per question — try again.' });
      const body = sp.parts ? { parts: np } : { text: tidy(j.text) };
      res.json({ ok: true, suggestion: body, stats: statsFor(body, sp), used: (j.used || []).slice(0, 20), missing: (j.missing || []).slice(0, 8), notes: clip(j.notes, 600), quota: { used: s.used, limit: s.limit } });
    } catch (e) { errlog('[apps] ai draft:', e.message); res.status(502).json({ error: 'ai_failed', message: 'The assistant is unavailable right now — try again in a minute.' }); }
  }));

  // One focused tool on the current draft. Rewrites come back as a SUGGESTION — never saved automatically.
  const TOOLS = {
    clarity: { rewrite: true, ask: 'Improve clarity: make each sentence easy to follow. Keep every fact and the student\'s voice; do not add anything new.' },
    concise: { rewrite: true, ask: 'Make it more concise: cut filler, repetition and weak sentences so it fits comfortably within the limit. Keep every real fact and the student\'s voice.' },
    structure: { rewrite: true, ask: 'Improve the structure: order and paragraph the existing material so each part answers its question and flows. Do not add facts.' },
    natural: { rewrite: true, ask: 'Make it sound natural, like the student talking clearly — remove stiff, over-sophisticated or AI-sounding phrasing. Keep facts and meaning.' },
    repetition: { rewrite: true, ask: 'Remove repetition of words, ideas and sentence openings. Keep facts and voice.' },
    grammar: { rewrite: true, ask: 'Fix grammar, spelling and punctuation only. Change as little as possible; do not restyle.' },
    weak: { rewrite: false, ask: 'Explain which paragraphs or sentences are weak and exactly why (vague, generic, unsupported, irrelevant to the course, telling not showing). Quote them.' },
    unsupported: { rewrite: false, ask: 'Find claims in the draft that are NOT supported by STUDENT FACTS (achievements, numbers, experiences, awards, motivations stated as fact). Quote each and say what evidence is missing. Do not judge style.' },
    requirements: { rewrite: false, ask: 'Check the draft against the TASK: does each part answer its question, is it relevant to the course(s), is anything required missing, and is it within the limits? Be specific.' },
    evidence: { rewrite: false, ask: 'Suggest which of the student\'s OWN listed experiences (by id) would make the draft stronger and where they fit. Only suggest facts that exist in STUDENT FACTS.' },
    relevance: { rewrite: false, ask: 'Judge how well each paragraph supports an application for this course. Point out parts that are less relevant (e.g. general hobbies) and how to connect or cut them.' },
  };
  app.post(P + '/ai/tool/:wid', route(async (req, res, user) => {
    const w = await ownWriting(user, req.params.wid); if (!w) return res.status(404).json({ error: 'not_found' });
    const tool = TOOLS[req.body && req.body.tool]; if (!tool) return res.status(400).json({ error: 'unknown_tool' });
    const sp = w.spec || {}, body = cleanBody((req.body && req.body.body) || w.working, sp), text = bodyText(body, sp);
    if (partsOf(body).join('').trim().length < 80) return res.status(400).json({ error: 'too_short', message: 'Write a little more first — the tools work on your draft.' });
    const s = await aiGuard(req, res, user); if (!s) return;
    const C = await writingCtx(user, w);
    const shape = tool.rewrite ? (sp.parts ? '"revised":{"parts":["…","…","…"' + (sp.parts.length > 3 ? ',"…"' : '') + ']}' : '"revised":{"text":"…"}') : '"revised":null';
    const sys = 'You are an application-writing coach for one specific student. ' + HONEST + ' ' + VOICE +
      ' Task: ' + tool.ask + (tool.rewrite && sp.parts ? ' "revised.parts" MUST be an array of exactly ' + sp.parts.length + ' strings, one per answer, in order — never merge answers.' : '') + ' Return ONLY JSON: {"summary":"two sentences max","points":[{"quote":"exact words from the draft or empty","issue":"what is wrong","fix":"what to do"}],' + shape + '}. At most 8 points.';
    const user1 = 'STUDENT FACTS:\n' + factsBlock(C.prof) + '\n\nAPPLYING TO:\n' + targetsBlock(C.apps) + (C.courseLines.length ? '\n' + C.courseLines.join('\n') : '') + '\n\nTASK:\n' + specBlock(w) + '\n\n' + countsLine(body, sp) + '\n\nDRAFT:\n' + text;
    try {
      const out = await synth.chat(sys, user1, { json: true, temperature: tool.rewrite ? 0.35 : 0.2, maxTokens: tool.rewrite ? 3400 : 1800 });
      const j = parseJSON(out.text);
      if (!j) return res.status(502).json({ error: 'ai_bad_output', message: 'The assistant returned something unreadable — try again.' });
      let revised = null;
      const tidy = (t) => clipText(String(t || '').replace(/[ \t]{2,}/g, ' ').replace(/\u2011/g, '-'), 12000);
      if (tool.rewrite && j.revised) {
        if (sp.parts) {
          const np = normParts(j.revised.parts, sp.parts.length, tidy), had = partsOf(body);
          // keep the student's own text for any answer the model left out
          revised = np ? { parts: np } : { parts: sp.parts.map((p, i) => tidy((j.revised.parts || [])[i]) || had[i] || '') };
        } else revised = { text: tidy(j.revised.text) || partsOf(body)[0] };
      }
      res.json({ ok: true, tool: req.body.tool, summary: clip(j.summary, 500), points: (Array.isArray(j.points) ? j.points : []).slice(0, 8).map((p) => ({ quote: clip(p.quote, 300), issue: clip(p.issue, 300), fix: clip(p.fix, 400) })),
        revised, revisedStats: revised ? statsFor(revised, sp) : null, unusedExperiences: unusedExperiences(C.prof, text).slice(0, 5), quota: { used: s.used, limit: s.limit } });
    } catch (e) { errlog('[apps] ai tool:', e.message); res.status(502).json({ error: 'ai_failed', message: 'The assistant is unavailable right now — try again in a minute.' }); }
  }));

  // Deterministic checks (always) + an AI read of the writing (when configured and wanted)
  app.post(P + '/one/:id/check', route(async (req, res, user) => {
    const a = await ownApp(user, req.params.id); if (!a) return res.status(404).json({ error: 'not_found' });
    await ensureWriting(user, a);
    const C = await loadCtx(user, [a]), s = summarize(a, C), items = s._items, checks = [], fixes = [];
    items.filter((x) => !x.after).forEach((x) => {
      const status = x.state === 'na' ? 'na' : x.state === 'done' ? 'ok' : x.state === 'doing' || !x.required ? 'warn' : 'miss';
      const wDetail = x.writingKind ? (x.stats && x.stats.problems.length ? x.stats.problems[0] : x.state === 'doing' ? 'In progress — mark it Final in the writing workspace when you’re happy with it.' : 'Not started yet.') : null;
      checks.push({ key: x.key, group: x.group, label: x.label, status, required: x.required,
        detail: x.state === 'done' ? (x.attached ? 'Attached: ' + x.attached.name : x.data && x.data.who ? 'Referee: ' + x.data.who : x.autoNote || '') : wDetail || x.detail || '' });
    });
    C.writingFor(a).forEach((w) => {
      w.stats.problems.forEach((p) => checks.push({ key: 'write-limit', group: 'writing', label: w.title, status: 'miss', detail: p }));
      w.stats.warnings.slice(0, 3).forEach((p) => checks.push({ key: 'write-warn', group: 'writing', label: w.title, status: 'warn', detail: p }));
    });
    const conditions = C.decisions[a.id] && C.decisions[a.id].data ? C.decisions[a.id].data.conditions : null;
    const gc = gradeCheck(a, C.profile, conditions && conditions.length ? conditions : null);
    gc.lines.filter((l) => l.st === 'low' || l.st === 'missing').forEach((l) => checks.push({ key: 'grade', group: 'academic', label: l.label, status: 'warn', detail: l.st === 'missing' ? 'Not in your profile — the course asks for ' + l.need + '.' : 'Your current grade (' + l.have + ') is below the stated ' + (gc.basis === 'offer' ? 'offer condition' : 'requirement') + ' (' + l.need + '). Typical offers are a guide, not a guarantee either way.' }));
    if (s.deadline) { const d = daysTo(s.deadline); if (d != null && d < 0 && ACTIVE.has(a.status)) checks.push({ key: 'deadline', group: 'submission', label: 'Deadline', status: 'miss', detail: 'The deadline (' + s.deadline + ') has passed.' }); else if (d != null && d <= 7 && ACTIVE.has(a.status)) checks.push({ key: 'deadline', group: 'submission', label: 'Deadline', status: 'warn', detail: d + ' day' + (d === 1 ? '' : 's') + ' left.' }); }
    const GO = { tests: 0, documents: 1, writing: 2, academic: 3, submission: 4 };
    const byImp = (x, y) => (GO[x.group] == null ? 5 : GO[x.group]) - (GO[y.group] == null ? 5 : GO[y.group]);
    const gaps = checks.filter((c) => c.group !== 'submission'), final = checks.filter((c) => c.group === 'submission');
    gaps.filter((c) => c.status === 'miss').sort(byImp).concat(gaps.filter((c) => c.status === 'warn' && c.required !== false).sort(byImp)).concat(final.filter((c) => c.status === 'miss'))
      .slice(0, 3).forEach((c) => fixes.push(c.label + (c.detail ? ' — ' + c.detail : '')));
    let ai = null, quotaOut = null;
    const mainW = C.writingFor(a).filter((w) => w.stats.chars > 200)[0];
    if (req.body && req.body.ai && mainW && synth.hasOpenAI()) {
      const sp = await spend(user); quotaOut = { used: sp.used, limit: sp.limit };
      if (sp.ok) {
        try {
          const w = await ownWriting(user, mainW.id), Cw = await writingCtx(user, w);
          const out = await synth.chat('You review a student\'s application text before submission. ' + HONEST + ' Be specific and brief. Never say an application will be accepted. Return ONLY JSON: {"notes":["up to 5 concrete issues, each one sentence, most important first"]}',
            'STUDENT FACTS:\n' + factsBlock(Cw.prof) + '\n\nAPPLYING TO:\n' + targetsBlock(Cw.apps) + '\n\nTASK:\n' + specBlock(w) + '\n\n' + countsLine(w.working, w.spec) + '\n\nTEXT:\n' + bodyText(w.working, w.spec), { json: true, temperature: 0.2, maxTokens: 1400 });
          const j = parseJSON(out.text); ai = j && Array.isArray(j.notes) ? { title: mainW.title, notes: j.notes.slice(0, 5).map((n) => clip(n, 300)) } : null;
        } catch (e) { ai = { error: 'The assistant could not review the writing right now.' }; }
      } else ai = { error: 'Today’s assistant limit is used up — the checks above still apply.' };
    }
    const counts = { ok: checks.filter((c) => c.status === 'ok').length, warn: checks.filter((c) => c.status === 'warn').length, miss: checks.filter((c) => c.status === 'miss').length };
    res.json({ ok: true, checks, fixes, counts, readiness: s.readiness, ai, quota: quotaOut, disclaimer: 'This check covers the requirements we know about from official sources. It can’t predict a decision — no tool can guarantee an offer.' });
  }));

  return { init };
};
