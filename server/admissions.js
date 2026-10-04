'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   UniVersity — admissions data system

   Collects REAL admission outcomes and keeps their origin visible all the way
   to the screen:

     official            university / statistical publications (hand-collected
                         with URL + date, or extracted from an official page an
                         admin submits — reviewed before publishing)
     public_self_report  what applicants wrote publicly (Reddit archive today;
                         any web search provider with a key) — found by a
                         background job; a second, larger model double-checks
                         each one and only clean, medium-confidence reports are
                         published automatically — everything else waits for an
                         admin in Admin → Admissions data

   (Users reporting their own decision was removed in Oct 2026 — the site isn't
   big enough for that to produce meaningful data.)

   adm_outcomes holds de-identified rows only: no usernames, links or e-mails in
   quotes, no free text beyond the short verbatim quote admins review. Every
   statistic is computed from stored rows, shows its sample size, and small
   samples say so. Scores are only compared within the same qualification.
   ──────────────────────────────────────────────────────────────────────────── */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const Q = require('./admQual');

module.exports = function mountAdmissions(app, deps) {
  const { store, log, errlog } = deps;
  const S = deps.schema || 'public';                 // tests use a separate schema
  const T = (n) => '"' + S + '".' + n;
  const P = deps.prefix || '/api';                   // route prefix (tests mount their own)
  const idx = require('./research').loadIndex();    // 926 universities + aliases
  const UNI = new Map(idx.unis.map((u) => [u.cc + ':' + u.id, u]));
  const DAY = 864e5;
  const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const hid = (p) => p + crypto.randomBytes(8).toString('hex');
  const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
  const q = (sql, params) => store.query(sql, params);
  // pg hands DATE columns back as local-midnight Date objects — format them in local time
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const ymd = (d) => d == null ? null : d instanceof Date ? d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) : String(d).slice(0, 10);

  /* ── schema ──────────────────────────────────────────────────────── */
  let ready = null;
  function init() {
    if (ready) return ready;
    if (!store.enabled()) return (ready = Promise.resolve(false));
    ready = q(`
      CREATE SCHEMA IF NOT EXISTS "${S}";
      CREATE TABLE IF NOT EXISTS ${T('adm_universities')} (
        uni_key TEXT PRIMARY KEY, cc TEXT NOT NULL, uni_id TEXT NOT NULL, name TEXT NOT NULL, city TEXT, country TEXT,
        website TEXT, diff INT, synced_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE IF NOT EXISTS ${T('adm_qualifications')} (
        code TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT, min_score REAL, max_score REAL, unit TEXT,
        lower_is_better BOOLEAN DEFAULT false, compare_window REAL, conversion_note TEXT);
      CREATE TABLE IF NOT EXISTS ${T('adm_programs')} (
        id TEXT PRIMARY KEY, uni_key TEXT NOT NULL, name TEXT NOT NULL, name_norm TEXT NOT NULL, level TEXT,
        field TEXT, origin TEXT, created_at TIMESTAMPTZ DEFAULT now(), UNIQUE (uni_key, name_norm, level));
      CREATE TABLE IF NOT EXISTS ${T('adm_sources')} (
        id TEXT PRIMARY KEY, url TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, publisher TEXT, title TEXT,
        content_hash TEXT, status TEXT DEFAULT 'candidate', records INT DEFAULT 0, note TEXT,
        published_at TIMESTAMPTZ, fetched_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE IF NOT EXISTS ${T('adm_outcomes')} (
        id TEXT PRIMARY KEY,
        uni_key TEXT NOT NULL, program_id TEXT, program_raw TEXT, field TEXT, level TEXT, intake_year INT,
        qualification TEXT, score_raw TEXT, score_num REAL,
        test_scores JSONB DEFAULT '{}'::jsonb, language_scores JSONB DEFAULT '{}'::jsonb,
        achievements JSONB,                         -- null = not reported; [] = reported none; else tags
        home_cc TEXT,                                -- aggregate filters only, never returned per record
        result TEXT NOT NULL, scholarship JSONB,
        source_type TEXT NOT NULL, verification_status TEXT NOT NULL, confidence TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'pending',
        source_id TEXT, source_reference TEXT, evidence TEXT, text_hash TEXT, fingerprint TEXT,
        dup_of TEXT, dup_flag BOOLEAN DEFAULT false, review_note TEXT,
        created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), reviewed_at TIMESTAMPTZ, reviewed_by TEXT);
      CREATE INDEX IF NOT EXISTS adm_o_uni ON ${T('adm_outcomes')} (uni_key, review_status);
      CREATE INDEX IF NOT EXISTS adm_o_prog ON ${T('adm_outcomes')} (program_id);
      CREATE INDEX IF NOT EXISTS adm_o_qual ON ${T('adm_outcomes')} (uni_key, qualification, score_num);
      CREATE INDEX IF NOT EXISTS adm_o_result ON ${T('adm_outcomes')} (result);
      CREATE INDEX IF NOT EXISTS adm_o_review ON ${T('adm_outcomes')} (review_status, created_at DESC);
      CREATE INDEX IF NOT EXISTS adm_o_fp ON ${T('adm_outcomes')} (fingerprint);
      CREATE INDEX IF NOT EXISTS adm_o_text ON ${T('adm_outcomes')} (text_hash);
      CREATE TABLE IF NOT EXISTS ${T('adm_official_stats')} (
        id TEXT PRIMARY KEY, uni_key TEXT NOT NULL, program_id TEXT, program_name TEXT, level TEXT, cycle TEXT,
        applications INT, offers INT, admitted INT, enrolled INT, offer_rate REAL,
        score_measure TEXT, score_p25 REAL, score_p50 REAL, score_p75 REAL, notes TEXT,
        source_id TEXT, collected_at DATE, review_status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now());
      CREATE INDEX IF NOT EXISTS adm_os_uni ON ${T('adm_official_stats')} (uni_key, review_status);

      CREATE TABLE IF NOT EXISTS ${T('adm_requirements')} (
        id TEXT PRIMARY KEY, uni_key TEXT NOT NULL, program_id TEXT, program_name TEXT, level TEXT,
        qualification TEXT, min_score_raw TEXT, min_score_num REAL, typical_offer TEXT, required_subjects TEXT,
        tests_required JSONB, language JSONB, application_fee JSONB, deadline DATE, deadline_note TEXT, notes TEXT,
        source_id TEXT, collected_at DATE, review_status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now());
      CREATE INDEX IF NOT EXISTS adm_r_uni ON ${T('adm_requirements')} (uni_key, review_status);
      CREATE TABLE IF NOT EXISTS ${T('adm_scholarships')} (
        id TEXT PRIMARY KEY, uni_key TEXT NOT NULL, program_name TEXT, name TEXT NOT NULL, eligibility TEXT,
        amount_min REAL, amount_max REAL, percentage REAL, currency TEXT, academic_requirements TEXT, deadline TEXT,
        source_type TEXT NOT NULL, source_id TEXT, source_date DATE, review_status TEXT DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now());
      CREATE INDEX IF NOT EXISTS adm_s_uni ON ${T('adm_scholarships')} (uni_key, review_status);
      CREATE TABLE IF NOT EXISTS ${T('adm_research_jobs')} (
        id TEXT PRIMARY KEY, uni_key TEXT NOT NULL, program TEXT, status TEXT NOT NULL, requested_by TEXT,
        queries JSONB, stats JSONB, error TEXT, created_at TIMESTAMPTZ DEFAULT now(), started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ);
      CREATE INDEX IF NOT EXISTS adm_j_uni ON ${T('adm_research_jobs')} (uni_key, created_at DESC);
      ALTER TABLE ${T('adm_official_stats')} ADD COLUMN IF NOT EXISTS places INT;
      ALTER TABLE ${T('adm_scholarships')} ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE ${T('adm_outcomes')} ADD COLUMN IF NOT EXISTS reported_at DATE;
      DROP TABLE IF EXISTS ${T('adm_verifications')};   -- "report your decision" was removed: these held no rows
      DROP TABLE IF EXISTS ${T('adm_applications')};
    `).then(syncReference).then(seedOfficial).then(() => true)
      .catch((e) => { errlog('admissions schema:', e.message); ready = null; return false; });
    return ready;
  }

  async function syncReference() {
    const rows = Array.from(UNI.values());
    await q(`INSERT INTO ${T('adm_universities')} (uni_key, cc, uni_id, name, city, country, website, diff)
      SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::int[])
      ON CONFLICT (uni_key) DO UPDATE SET name=EXCLUDED.name, city=EXCLUDED.city, country=EXCLUDED.country, website=EXCLUDED.website, diff=EXCLUDED.diff, synced_at=now()`,
    [rows.map((u) => u.cc + ':' + u.id), rows.map((u) => u.cc), rows.map((u) => u.id), rows.map((u) => u.name), rows.map((u) => u.city || null),
      rows.map((u) => u.country || null), rows.map((u) => u.website || null), rows.map((u) => u.diff || null)]);
    const codes = Object.keys(Q.QUALS);
    await q(`INSERT INTO ${T('adm_qualifications')} (code, name, kind, min_score, max_score, unit, lower_is_better, compare_window, conversion_note)
      SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::real[], $5::real[], $6::text[], $7::bool[], $8::real[], $9::text[])
      ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, kind=EXCLUDED.kind, min_score=EXCLUDED.min_score, max_score=EXCLUDED.max_score, unit=EXCLUDED.unit,
        lower_is_better=EXCLUDED.lower_is_better, compare_window=EXCLUDED.compare_window, conversion_note=EXCLUDED.conversion_note`,
    [codes, codes.map((c) => Q.QUALS[c].name), codes.map((c) => Q.QUALS[c].kind), codes.map((c) => Q.QUALS[c].min == null ? null : Q.QUALS[c].min),
      codes.map((c) => Q.QUALS[c].max == null ? null : Q.QUALS[c].max), codes.map((c) => Q.QUALS[c].unit || null), codes.map((c) => !!Q.QUALS[c].lowerIsBetter),
      codes.map((c) => Q.QUALS[c].window == null ? null : Q.QUALS[c].window),
      codes.map((c) => c === 'a_levels' ? 'Stored as written; score_num = mean of best three grades on A*=6…E=1 (ordering only).' : 'Stored as written; compared only with the same qualification. No cross-system conversion.')]);
  }

  /* ── hand-collected official data (data/admissions_official.json) ── */
  async function seedOfficial() {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'admissions_official.json'), 'utf8')); } catch (e) { return; }
    const src = {};
    for (const s of d.sources || []) src[s.id] = await upsertSource({ url: s.url, kind: 'official', publisher: s.publisher, title: s.title, status: 'extracted', note: 'hand-collected ' + (s.collected || d.collected) }, s.collected || d.collected);
    const nat = (o) => sha([o.uni, o.program || '', o.level || '', o.cycle || o.name || o.qualification || '', o.source].join('|')).slice(0, 24);
    for (const o of d.stats || []) {
      if (!UNI.has(o.uni)) continue;
      const pid = o.program ? await upsertProgram(o.uni, o.program, o.level, 'official') : null;
      await q(`INSERT INTO ${T('adm_official_stats')} (id, uni_key, program_id, program_name, level, cycle, applications, offers, admitted, enrolled, offer_rate, score_measure, score_p25, score_p50, score_p75, notes, source_id, collected_at, places, review_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'approved')
        ON CONFLICT (id) DO UPDATE SET applications=$7, offers=$8, admitted=$9, enrolled=$10, offer_rate=$11, score_measure=$12, score_p25=$13, score_p50=$14, score_p75=$15, notes=$16, source_id=$17, collected_at=$18, places=$19`,
      ['os_' + nat(o), o.uni, pid, o.program || null, o.level || null, o.cycle || null, o.applications ?? null, o.offers ?? null, o.admitted ?? null, o.enrolled ?? null,
        o.offer_rate ?? (o.applications && (o.offers ?? o.admitted) != null ? Math.round((o.offers ?? o.admitted) / o.applications * 1000) / 10 : null),
        o.score_measure || null, o.score_p25 ?? null, o.score_p50 ?? null, o.score_p75 ?? null, o.notes || null, src[o.source] || null, o.collected || d.collected, o.places ?? null]);
    }
    for (const o of d.requirements || []) {
      if (!UNI.has(o.uni)) continue;
      const pid = o.program ? await upsertProgram(o.uni, o.program, o.level, 'official') : null;
      const ms = o.qualification && o.min_score != null ? Q.parseScore(o.qualification, o.min_score) : null;
      await q(`INSERT INTO ${T('adm_requirements')} (id, uni_key, program_id, program_name, level, qualification, min_score_raw, min_score_num, typical_offer, required_subjects, tests_required, language, application_fee, deadline, deadline_note, notes, source_id, collected_at, review_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'approved')
        ON CONFLICT (id) DO UPDATE SET qualification=$6, min_score_raw=$7, min_score_num=$8, typical_offer=$9, required_subjects=$10, tests_required=$11, language=$12, application_fee=$13, deadline=$14, deadline_note=$15, notes=$16, source_id=$17, collected_at=$18`,
      ['or_' + nat(o), o.uni, pid, o.program || null, o.level || null, o.qualification || null, ms ? ms.raw : null, ms ? ms.num : null, o.typical_offer || null,
        o.required_subjects || null, JSON.stringify(o.tests_required || []), JSON.stringify(o.language || {}), o.application_fee ? JSON.stringify(o.application_fee) : null,
        o.deadline || null, o.deadline_note || null, o.notes || null, src[o.source] || null, o.collected || d.collected]);
    }
    for (const o of d.scholarships || []) {
      if (!UNI.has(o.uni)) continue;
      await q(`INSERT INTO ${T('adm_scholarships')} (id, uni_key, program_name, name, eligibility, amount_min, amount_max, percentage, currency, academic_requirements, deadline, source_type, source_id, source_date, notes, review_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'official',$12,$13,$14,'approved')
        ON CONFLICT (id) DO UPDATE SET eligibility=$5, amount_min=$6, amount_max=$7, percentage=$8, currency=$9, academic_requirements=$10, deadline=$11, source_id=$12, source_date=$13, notes=$14`,
      ['osc_' + nat(o), o.uni, o.program || null, o.name, o.eligibility || null, o.amount_min ?? null, o.amount_max ?? null, o.percentage ?? null, o.currency || null,
        o.academic_requirements || null, o.deadline || null, src[o.source] || null, o.collected || d.collected, o.notes || null]);
    }
  }

  /* ── shared helpers (also used by the research job) ──────────────── */
  async function upsertSource(s, fetchedAt) {
    const id = 'as_' + sha(s.url).slice(0, 20);
    await q(`INSERT INTO ${T('adm_sources')} (id, url, kind, publisher, title, content_hash, status, note, published_at, fetched_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::timestamptz, now()))
      ON CONFLICT (url) DO UPDATE SET status=COALESCE($7, ${T('adm_sources')}.status), publisher=COALESCE($4, ${T('adm_sources')}.publisher),
        title=COALESCE($5, ${T('adm_sources')}.title), content_hash=COALESCE($6, ${T('adm_sources')}.content_hash), note=COALESCE($8, ${T('adm_sources')}.note)`,
    [id, s.url, s.kind, clip(s.publisher, 80) || null, clip(s.title, 200) || null, s.content_hash || null, s.status || null, clip(s.note, 300) || null,
      s.published_at ? new Date(s.published_at).toISOString() : null, fetchedAt || null]);
    return id;
  }
  // "aerospace engineering" ≈ "aerospace engineering with management"? Same programme when the
  // words overlap strongly, so small naming differences don't split the data.
  function similarProgram(a, b) {
    const ta = new Set(a.split(' ').filter((w) => w.length > 2 && w !== 'and')), tb = new Set(b.split(' ').filter((w) => w.length > 2 && w !== 'and'));
    if (!ta.size || !tb.size) return false;
    let n = 0; ta.forEach((w) => { if (tb.has(w)) n++; });
    const small = Math.min(ta.size, tb.size);
    return n / (ta.size + tb.size - n) >= 0.75 || (small >= 2 && n === small && Math.max(ta.size, tb.size) - small <= 1);
  }
  async function matchProgram(uniKey, nn, level) {
    const rows = (await q(`SELECT id, name_norm FROM ${T('adm_programs')} WHERE uni_key=$1${level ? ' AND level=$2' : ''}`, level ? [uniKey, level] : [uniKey])).rows;
    const hit = rows.find((r) => r.name_norm === nn) || rows.find((r) => similarProgram(r.name_norm, nn));
    return hit ? hit.id : null;
  }
  async function upsertProgram(uniKey, name, level, origin) {
    const nn = Q.programNorm(name); if (!nn) return null;
    const lv = Q.LEVELS.indexOf(level) !== -1 ? level : (Q.levelOf(name) || 'other');
    const existing = await matchProgram(uniKey, nn, lv); if (existing) return existing;
    const id = 'ap_' + sha(uniKey + '|' + nn + '|' + lv).slice(0, 20);
    await q(`INSERT INTO ${T('adm_programs')} (id, uni_key, name, name_norm, level, field, origin) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (uni_key, name_norm, level) DO NOTHING`,
      [id, uniKey, clip(name, 120), nn, lv, Q.fieldOf(name), origin || 'user']);
    return id;
  }
  function fingerprint(r) { return sha([r.uni_key, Q.programNorm(r.program_raw), r.level || '', r.qualification || '', String(r.score_raw || '').toLowerCase(), r.result].join('|')).slice(0, 32); }
  function shingles(t) { const w = Q.norm(t).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean), out = new Set(); for (let i = 0; i < w.length - 2; i++) out.add(w[i] + ' ' + w[i + 1] + ' ' + w[i + 2]); return out; }
  function jaccard(a, b) { if (!a.size || !b.size) return 0; let n = 0; a.forEach((x) => { if (b.has(x)) n++; }); return n / (a.size + b.size - n); }
  function textHash(t) { const n = Q.norm(t).replace(/[^a-z0-9]+/g, ''); return n.length >= 40 ? sha(n).slice(0, 32) : null; }
  function scrub(t) {   // quotes from public posts: drop handles, e-mails, phone numbers, links
    return clip(String(t || '').replace(/\bu\/[A-Za-z0-9_-]+/g, '[user]').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
      .replace(/\+?\d[\d\s().-]{8,}\d/g, (m) => /\d{4}-\d{2}-\d{2}/.test(m) ? m : '[number]').replace(/https?:\/\/\S+/g, '[link]'), 320);
  }
  // Duplicate check — the same person often posts the same story twice.
  //   sure duplicate: same text, or same facts from the same source, or same facts + very similar wording
  //   possible duplicate: same facts, different wording → kept, flagged for review
  async function findDuplicate(r) {
    if (r.text_hash) {
      const t = await q(`SELECT id FROM ${T('adm_outcomes')} WHERE text_hash=$1 AND uni_key=$2 LIMIT 1`, [r.text_hash, r.uni_key]);
      if (t.rows.length) return { id: t.rows[0].id, sure: true };
    }
    const f = await q(`SELECT id, evidence, source_id FROM ${T('adm_outcomes')} WHERE fingerprint=$1 AND dup_of IS NULL LIMIT 25`, [r.fingerprint]);
    const mine = r.evidence ? shingles(r.evidence) : null;
    for (const row of f.rows) {
      if (r.source_id && row.source_id === r.source_id) return { id: row.id, sure: true };
      if (mine && row.evidence && jaccard(mine, shingles(row.evidence)) >= 0.55) return { id: row.id, sure: true };
    }
    return f.rows.length && r.source_type === 'public_self_report' ? { id: f.rows[0].id, sure: false } : null;
  }
  // Insert one de-identified outcome (research / official / admin). Returns {id} | {duplicate} | {rejected}
  async function ingest(rec) {
    if (!UNI.has(rec.uni_key)) return { rejected: 'unknown_university' };
    if (Q.RESULTS.indexOf(rec.result) === -1) return { rejected: 'bad_result' };
    const sc = rec.qualification && rec.score_raw != null ? Q.parseScore(rec.qualification, rec.score_raw) : null;
    const r = Object.assign({}, rec, {
      program_raw: clip(rec.program_raw, 120) || null,
      level: Q.LEVELS.indexOf(rec.level) !== -1 ? rec.level : (Q.levelOf(rec.program_raw) || null),
      qualification: sc ? rec.qualification : (rec.qualification && Q.QUALS[rec.qualification] ? rec.qualification : null),
      score_raw: sc ? sc.raw : null, score_num: sc ? sc.num : null,
      evidence: rec.evidence ? scrub(rec.evidence) : null,
    });
    r.field = rec.field || Q.fieldOf(r.program_raw);
    r.fingerprint = fingerprint(r);
    r.text_hash = r.evidence ? textHash(r.evidence) : null;
    const dup = await findDuplicate(r);
    if (dup && dup.sure) return { duplicate: dup.id };
    r.program_id = r.program_raw ? await upsertProgram(r.uni_key, r.program_raw, r.level, rec.source_type === 'official' ? 'official' : 'research') : null;
    const id = hid('ao_');
    await q(`INSERT INTO ${T('adm_outcomes')} (id, uni_key, program_id, program_raw, field, level, intake_year, qualification, score_raw, score_num, test_scores, language_scores,
        achievements, home_cc, result, scholarship, source_type, verification_status, confidence, review_status, source_id, source_reference, evidence, text_hash, fingerprint, dup_of, dup_flag, reported_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
    [id, r.uni_key, r.program_id, r.program_raw, r.field, r.level, r.intake_year || null, r.qualification, r.score_raw, r.score_num,
      JSON.stringify(Q.parseTests(r.test_scores, Q.TESTS)), JSON.stringify(Q.parseTests(r.language_scores, Q.LANG)),
      r.achievements == null ? null : JSON.stringify(Q.cleanTags(r.achievements)), r.home_cc || null, r.result,
      r.scholarship ? JSON.stringify(r.scholarship) : null, r.source_type, r.verification_status, r.confidence, r.review_status || 'pending',
      r.source_id || null, clip(r.source_reference, 160) || null, r.evidence, r.text_hash, r.fingerprint, dup ? dup.id : null, !!dup, /^\d{4}-\d{2}-\d{2}$/.test(r.reported_at || '') ? r.reported_at : null]);
    bust(r.uni_key);
    return { id, flagged: !!dup };
  }

  /* ── who is asking (private data only) ───────────────────────────── */
  const hits = new Map();
  function limited(key, max, ms) {
    const now = Date.now(), h = (hits.get(key) || []).filter((t) => now - t < ms);
    h.push(now); hits.set(key, h); if (hits.size > 5000) hits.delete(hits.keys().next().value);
    return h.length > max;
  }
  const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  function uniOf(cc, id) { return UNI.get(String(cc || '').toLowerCase() + ':' + String(id || '')); }

  /* ── stats cache (busted on every write for that university) ───── */
  const statCache = new Map();
  function bust(uniKey) { for (const k of statCache.keys()) if (k.indexOf(uniKey + '|') === 0) statCache.delete(k); }
  const PUBLIC_WHERE = `review_status='approved' AND dup_of IS NULL`;
  const PUBLISHER = (row) => row.source_type === 'official' ? 'Official' : row.source_type === 'public_self_report' ? (row.publisher || 'Public post') : 'UniVersity';
  const RELIABILITY = (n) => n >= 20 ? 'ok' : n >= 5 ? 'small' : 'none';

  function filters(o, params) {   // optional level / field / program / verified / source filters
    let w = '';
    if (o.level && Q.LEVELS.indexOf(o.level) !== -1) { params.push(o.level); w += ' AND level=$' + params.length; }
    if (o.field && Q.FIELD_LABEL[o.field]) { params.push(o.field); w += ' AND field=$' + params.length; }
    if (o.programId) { params.push(o.programId); w += ' AND program_id=$' + params.length; }
    if (o.verified) w += ` AND verification_status IN ('document_verified','official_source')`;
    if (o.source && Q.SOURCE_TYPES.indexOf(o.source) !== -1) { params.push(o.source); w += ' AND source_type=$' + params.length; }
    return w;
  }
  async function programIdFor(uniKey, name, level) {
    const nn = Q.programNorm(name); if (!nn) return null;
    return matchProgram(uniKey, nn, level || null);
  }
  function dist(row) {   // gate what can be said by sample size
    if (!row) return null;
    const n = row.n, o = { n };
    if (n >= 3) { o.min = row.min; o.max = row.max; }
    if (n >= 5) { o.p25 = row.p25; o.p50 = row.p50; o.p75 = row.p75; }
    if (n >= 10) o.mean = Math.round(row.mean * 100) / 100;
    return o;
  }

  async function stats(uni, o) {
    const key = uni.cc + ':' + uni.id + '|' + JSON.stringify(o);
    const hit = statCache.get(key); if (hit && Date.now() - hit.t < 60e3) return hit.v;
    const uk = uni.cc + ':' + uni.id, base = [uk];
    if (o.program) o.programId = await programIdFor(uk, o.program, o.level);
    if (o.program && !o.programId) o.programMissing = true;
    const w = o.programMissing ? '' : filters(o, base);
    const sum = (await q(`SELECT count(*)::int n,
        count(*) FILTER (WHERE result='accepted')::int accepted, count(*) FILTER (WHERE result='rejected')::int rejected,
        count(*) FILTER (WHERE result='waitlisted')::int waitlisted, count(*) FILTER (WHERE result NOT IN ('accepted','rejected','waitlisted'))::int other,
        count(*) FILTER (WHERE source_type='official')::int official, count(*) FILTER (WHERE source_type='public_self_report')::int public_self_report,
        count(*) FILTER (WHERE source_type='user_reported')::int user_reported, count(*) FILTER (WHERE source_type='user_verified')::int user_verified,
        count(*) FILTER (WHERE verification_status IN ('document_verified','official_source'))::int verified,
        count(*) FILTER (WHERE confidence='low')::int low,
        count(*) FILTER (WHERE scholarship->>'status'='received')::int scholarships
      FROM ${T('adm_outcomes')} WHERE uni_key=$1 AND ${PUBLIC_WHERE}${o.programMissing ? ' AND false' : w}`, base)).rows[0];
    const byQ = (await q(`SELECT qualification, result, count(*)::int n, min(score_num) min, max(score_num) max, avg(score_num) mean,
        percentile_cont(0.25) WITHIN GROUP (ORDER BY score_num) p25, percentile_cont(0.5) WITHIN GROUP (ORDER BY score_num) p50, percentile_cont(0.75) WITHIN GROUP (ORDER BY score_num) p75
      FROM ${T('adm_outcomes')} WHERE uni_key=$1 AND ${PUBLIC_WHERE} AND confidence<>'low' AND score_num IS NOT NULL AND result IN ('accepted','rejected','waitlisted')${o.programMissing ? ' AND false' : w}
      GROUP BY qualification, result`, base)).rows;
    const quals = {};
    byQ.forEach((r) => {
      const x = quals[r.qualification] || (quals[r.qualification] = { qualification: r.qualification, name: (Q.QUALS[r.qualification] || {}).name, n: 0 });
      x.n += r.n; x[r.result] = dist(r);
    });
    Object.values(quals).forEach((x) => { x.reliability = RELIABILITY(x.n); });
    const off = (await q(`SELECT s.*, src.url, src.publisher, src.title FROM ${T('adm_official_stats')} s LEFT JOIN ${T('adm_sources')} src ON src.id=s.source_id
      WHERE s.uni_key=$1 AND s.review_status='approved' ORDER BY s.cycle DESC NULLS LAST, s.program_name NULLS FIRST LIMIT 40`, [uk])).rows;
    const req = (await q(`SELECT r.*, src.url, src.publisher FROM ${T('adm_requirements')} r LEFT JOIN ${T('adm_sources')} src ON src.id=r.source_id
      WHERE r.uni_key=$1 AND r.review_status='approved' ORDER BY r.program_name NULLS FIRST LIMIT 40`, [uk])).rows;
    const sch = (await q(`SELECT s.*, src.url, src.publisher FROM ${T('adm_scholarships')} s LEFT JOIN ${T('adm_sources')} src ON src.id=s.source_id
      WHERE s.uni_key=$1 AND s.review_status='approved' ORDER BY s.name LIMIT 20`, [uk])).rows;
    const job = (await q(`SELECT status, finished_at, created_at FROM ${T('adm_research_jobs')} WHERE uni_key=$1 ORDER BY created_at DESC LIMIT 1`, [uk])).rows[0] || null;
    const v = {
      uni: { key: uk, name: uni.name, city: uni.city, country: uni.country },
      summary: Object.assign(sum, { reliability: RELIABILITY(sum.n - sum.low) }),
      qualifications: Object.values(quals).sort((a, b) => b.n - a.n),
      official: off.map((s) => ({ program: s.program_name, level: s.level, cycle: s.cycle, applications: s.applications, offers: s.offers, admitted: s.admitted, enrolled: s.enrolled,
        offerRate: s.offer_rate, places: s.places, scoreMeasure: s.score_measure, p25: s.score_p25, p50: s.score_p50, p75: s.score_p75, notes: s.notes, source: { url: s.url, publisher: s.publisher, title: s.title }, collected: ymd(s.collected_at) })),
      requirements: req.map((r) => ({ program: r.program_name, level: r.level, qualification: r.qualification, minScore: r.min_score_raw, minScoreNum: r.min_score_num, typicalOffer: r.typical_offer,
        subjects: r.required_subjects, tests: r.tests_required || [], language: r.language || {}, fee: r.application_fee, deadline: ymd(r.deadline), deadlineNote: r.deadline_note, notes: r.notes,
        source: { url: r.url, publisher: r.publisher }, collected: ymd(r.collected_at) })),
      scholarships: sch.map((s) => ({ name: s.name, program: s.program_name, eligibility: s.eligibility, amountMin: s.amount_min, amountMax: s.amount_max, percentage: s.percentage, currency: s.currency,
        requirements: s.academic_requirements, deadline: s.deadline, notes: s.notes, sourceType: s.source_type, source: { url: s.url, publisher: s.publisher }, collected: ymd(s.source_date) })),
      research: job ? { status: job.status, at: job.finished_at || job.created_at } : null,
      programMissing: !!o.programMissing,
    };
    statCache.set(key, { t: Date.now(), v });
    if (statCache.size > 500) statCache.delete(statCache.keys().next().value);
    return v;
  }
  async function points(uni, o, limit, offset) {
    const params = [uni.cc + ':' + uni.id];
    if (o.program) { o.programId = await programIdFor(params[0], o.program, o.level); if (!o.programId) return []; }
    const w = filters(o, params);
    if (o.qual && Q.QUALS[o.qual]) { params.push(o.qual); }
    params.push(limit, offset);
    const r = await q(`SELECT o.id, o.qualification, o.score_raw, o.score_num, o.result, o.level, o.intake_year, o.source_type, o.verification_status, o.confidence, o.field,
        COALESCE(p.name, o.program_raw) program, o.scholarship, o.achievements, o.test_scores, o.language_scores, o.created_at, o.reported_at, src.publisher
      FROM ${T('adm_outcomes')} o LEFT JOIN ${T('adm_programs')} p ON p.id=o.program_id LEFT JOIN ${T('adm_sources')} src ON src.id=o.source_id
      WHERE o.uni_key=$1 AND o.${PUBLIC_WHERE.replace(' AND dup_of', ' AND o.dup_of')}${w.replace(/ AND (\w+)/g, ' AND o.$1')}${o.qual && Q.QUALS[o.qual] ? ' AND o.qualification=$' + (params.length - 2) : ''}
      ORDER BY o.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return r.rows.map((x) => ({
      id: x.id.slice(-10), q: x.qualification, s: x.score_num, sr: x.score_raw, sl: x.qualification ? Q.scoreLabel(x.qualification, x.score_raw) : null,
      r: x.result, l: x.level, y: x.intake_year, st: x.source_type, v: x.verification_status === 'document_verified' || x.verification_status === 'official_source',
      c: x.confidence, f: x.field, p: clip(x.program, 80) || null, sch: x.scholarship ? (x.scholarship.status || null) : null,
      a: x.achievements, t: x.test_scores || {}, lg: x.language_scores || {}, src: PUBLISHER(x), yr: x.reported_at ? +ymd(x.reported_at).slice(0, 4) : new Date(x.created_at).getFullYear(),
    }));
  }

  /* ── "people like you" ───────────────────────────────────────────── */
  async function compare(uni, body) {
    const p = body.profile || {}, qual = p.qualification;
    const sc = qual && Q.QUALS[qual] ? Q.parseScore(qual, p.score) : null;
    if (!sc || sc.num == null) return { needProfile: true };
    const def = Q.QUALS[qual], win = def.window;
    const lo = sc.num - win, hi = sc.num + win, uk = uni.cc + ':' + uni.id;
    const level = Q.LEVELS.indexOf(body.level) !== -1 ? body.level : null;
    const programId = body.program ? await programIdFor(uk, body.program, level) : null;
    const field = Q.FIELD_LABEL[body.field] ? body.field : Q.fieldOf(body.program);
    const scopes = [];
    if (programId) scopes.push({ scope: 'program', label: clip(body.program, 60), where: ' AND program_id=$5' , arg: programId });
    if (field) scopes.push({ scope: 'field', label: Q.FIELD_LABEL[field], where: ' AND field=$5', arg: field });
    scopes.push({ scope: 'university', label: 'all programmes', where: '', arg: null });
    let chosen = null;
    for (const s of scopes) {
      const params = [uk, qual, lo, hi]; if (s.arg) params.push(s.arg);
      let w = s.where; if (level) { params.push(level); w += ' AND level=$' + params.length; }
      const r = (await q(`SELECT result, count(*)::int n FROM ${T('adm_outcomes')} WHERE uni_key=$1 AND qualification=$2 AND score_num BETWEEN $3 AND $4
        AND ${PUBLIC_WHERE} AND confidence<>'low'${w} GROUP BY result`, params)).rows;
      const c = { scope: s.scope, label: s.label, n: 0, accepted: 0, rejected: 0, waitlisted: 0, other: 0 };
      r.forEach((x) => { c.n += x.n; if (c[x.result] != null && x.result !== 'n') c[x.result] += x.n; else c.other += x.n; });
      if (!chosen) chosen = c;
      if (c.n >= 5) { chosen = c; break; }
    }
    const decided = chosen.accepted + chosen.rejected + chosen.waitlisted;
    const out = {
      profile: { qualification: qual, qualificationName: def.name, score: sc.raw, label: Q.scoreLabel(qual, sc.raw) },
      window: { lo: Math.round(lo * 100) / 100, hi: Math.round(hi * 100) / 100, size: win, unit: def.unit || '' },
      matchedOn: ['same university', chosen.scope === 'program' ? 'same programme' : chosen.scope === 'field' ? 'same field (' + chosen.label + ')' : 'any programme', 'same qualification (' + def.short + ')',
        def.short + ' ' + (qual === 'a_levels' ? Q.aLevelLabel(Math.max(1, lo)) + '–' + Q.aLevelLabel(Math.min(6, hi)) : (Math.round(lo * 100) / 100) + '–' + (Math.round(hi * 100) / 100))].concat(level ? ['same level'] : []),
      comparable: chosen, reliability: RELIABILITY(decided),
      message: chosen.n === 0 ? 'No comparable applications in our data yet.' : chosen.n < 5 ? 'Only ' + chosen.n + ' comparable application' + (chosen.n === 1 ? '' : 's') + ' found. More data is needed.' : null,
    };
    if (decided >= 20) out.acceptedShare = { accepted: chosen.accepted, decided, note: 'Share of comparable applicants in our data who reported an acceptance — not an official probability.' };
    // where the score sits among accepted applicants' reported scores (same uni + qualification)
    const acc = (await q(`SELECT score_num FROM ${T('adm_outcomes')} WHERE uni_key=$1 AND qualification=$2 AND result='accepted' AND ${PUBLIC_WHERE} AND confidence<>'low' AND score_num IS NOT NULL${level ? ' AND level=$3' : ''}`,
      level ? [uk, qual, level] : [uk, qual])).rows.map((x) => x.score_num);
    if (acc.length >= 5) {
      const below = acc.filter((v) => def.lowerIsBetter ? v > sc.num : v < sc.num).length, same = acc.filter((v) => v === sc.num).length;
      out.position = { n: acc.length, pctBelow: Math.round((below + same / 2) / acc.length * 100), note: 'Compared with the reported scores of ' + acc.length + ' accepted applicants.' };
    }
    return out;
  }

  /* ── application-list planner ────────────────────────────────────── */
  const research = require('./admResearch')({ q, T, log, errlog, ingest, upsertSource, UNI, Q, scrub });

  /* ════════════════ routes ════════════════ */
  const offline = (res) => res.status(503).json({ ok: false, offline: true, message: 'Admissions data is offline right now.' });
  const wrap = (fn) => async (req, res) => {
    try { if (!(await init())) return offline(res); await fn(req, res); }
    catch (e) { errlog('admissions:', e.message); res.status(e.code && e.code < 600 ? e.code : 500).json({ ok: false, error: e.code ? 'bad_request' : 'server_error', message: e.code ? e.message : 'Something went wrong.' }); }
  };

  app.get(P + '/admissions/meta', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ ok: true, qualifications: Object.keys(Q.QUALS).map((k) => Object.assign({ code: k }, Q.QUALS[k], { classes: undefined })), tests: Object.keys(Q.TESTS), language: Object.keys(Q.LANG),
      tags: Q.TAG_LABEL, fields: Q.FIELD_LABEL, results: Q.RESULTS, sourceTypes: Q.SOURCE_TYPES });
  });

  app.get(P + '/admissions/stats', wrap(async (req, res) => {
    const uni = uniOf(req.query.cc, req.query.uniId); if (!uni) return res.status(404).json({ ok: false, error: 'unknown_university' });
    const o = { level: req.query.level, field: req.query.field, program: clip(req.query.program, 120) || null, verified: req.query.verified === '1', source: req.query.source };
    const limit = Math.max(1, Math.min(300, +req.query.limit || 150)), offset = Math.max(0, +req.query.offset || 0);
    const [s, pts] = await Promise.all([stats(uni, Object.assign({}, o)), points(uni, Object.assign({}, o, { qual: req.query.qual }), limit, offset)]);
    research.maybeAuto(uni.cc + ':' + uni.id).catch(() => {});
    res.json(Object.assign({ ok: true }, s, { points: pts, page: { limit, offset, more: pts.length === limit } }));
  }));

  app.get(P + '/admissions/summary', wrap(async (req, res) => {
    const keys = String(req.query.keys || '').split(',').map((k) => k.trim().toLowerCase()).filter((k) => UNI.has(k)).slice(0, 60);
    if (!keys.length) return res.json({ ok: true, rows: {} });
    const r = await q(`SELECT uni_key, count(*)::int n, count(*) FILTER (WHERE result='accepted')::int accepted,
        count(*) FILTER (WHERE verification_status IN ('document_verified','official_source'))::int verified
      FROM ${T('adm_outcomes')} WHERE uni_key = ANY($1) AND ${PUBLIC_WHERE} GROUP BY uni_key`, [keys]);
    const o = (await q(`SELECT DISTINCT uni_key FROM ${T('adm_official_stats')} WHERE uni_key = ANY($1) AND review_status='approved'
      UNION SELECT DISTINCT uni_key FROM ${T('adm_requirements')} WHERE uni_key = ANY($1) AND review_status='approved'`, [keys])).rows.map((x) => x.uni_key);
    const rows = {}; keys.forEach((k) => { rows[k] = { n: 0, accepted: 0, verified: 0, official: o.indexOf(k) !== -1 }; });
    r.rows.forEach((x) => { rows[x.uni_key] = Object.assign(rows[x.uni_key], { n: x.n, accepted: x.accepted, verified: x.verified }); });
    res.json({ ok: true, rows });
  }));

  app.post(P + '/admissions/compare', wrap(async (req, res) => {
    const b = req.body || {}, uni = uniOf(b.cc, b.uniId); if (!uni) return res.status(404).json({ ok: false, error: 'unknown_university' });
    if (limited('cmp:' + ipOf(req), 120, 60e3)) return res.status(429).json({ ok: false, message: 'Slow down a little.' });
    res.json(Object.assign({ ok: true }, await compare(uni, b)));
  }));

  const adm = (fn) => wrap(async (req, res) => {
    const who = deps.admin && deps.admin.check(req); if (!who) return res.status(401).json({ error: 'unauthorized' });
    await fn(req, res, who);
  });
  const audit = (who, action, target, detail, req) => { try { deps.admin.audit(who, action, target, detail || null, ipOf(req)); } catch (e) {} };

  app.get(P + '/admin/admissions/overview', adm(async (_req, res) => {
    const by = (await q(`SELECT review_status, source_type, count(*)::int n FROM ${T('adm_outcomes')} GROUP BY 1, 2`)).rows;
    const flags = (await q(`SELECT count(*)::int n FROM ${T('adm_outcomes')} WHERE dup_flag AND review_status='pending'`)).rows[0].n;
    const off = (await q(`SELECT (SELECT count(*) FROM ${T('adm_official_stats')})::int stats, (SELECT count(*) FROM ${T('adm_requirements')})::int reqs, (SELECT count(*) FROM ${T('adm_scholarships')})::int sch,
      (SELECT count(*) FROM ${T('adm_official_stats')} WHERE review_status='pending')::int pstats, (SELECT count(*) FROM ${T('adm_requirements')} WHERE review_status='pending')::int preqs,
      (SELECT count(*) FROM ${T('adm_sources')})::int sources`)).rows[0];
    const jobs = (await q(`SELECT j.*, u.name FROM ${T('adm_research_jobs')} j LEFT JOIN ${T('adm_universities')} u ON u.uni_key=j.uni_key ORDER BY j.created_at DESC LIMIT 25`)).rows;
    res.json({ ok: true, by, flags, official: off, jobs, research: research.status() });
  }));

  app.get(P + '/admin/admissions/records', adm(async (req, res) => {
    const params = [], w = [];
    const st = String(req.query.status || 'pending');
    if (st === 'flagged') w.push(`o.dup_flag AND o.review_status='pending'`);
    else if (['pending', 'approved', 'rejected', 'duplicate'].indexOf(st) !== -1) { params.push(st); w.push('o.review_status=$' + params.length); }
    if (req.query.type && Q.SOURCE_TYPES.indexOf(req.query.type) !== -1) { params.push(req.query.type); w.push('o.source_type=$' + params.length); }
    if (req.query.uni) { params.push(String(req.query.uni).toLowerCase()); w.push('o.uni_key=$' + params.length); }
    if (req.query.q) { params.push('%' + clip(req.query.q, 60).toLowerCase() + '%'); w.push(`(lower(u.name) LIKE $${params.length} OR lower(o.program_raw) LIKE $${params.length} OR lower(o.evidence) LIKE $${params.length})`); }
    const limit = Math.max(1, Math.min(100, +req.query.limit || 50)), offset = Math.max(0, +req.query.offset || 0);
    params.push(limit, offset);
    const r = await q(`SELECT o.*, u.name uni_name, src.url source_url, src.publisher, src.title source_title FROM ${T('adm_outcomes')} o
      LEFT JOIN ${T('adm_universities')} u ON u.uni_key=o.uni_key LEFT JOIN ${T('adm_sources')} src ON src.id=o.source_id
      ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY o.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ ok: true, rows: r.rows.map((x) => Object.assign(x, { reported_at: ymd(x.reported_at) })), page: { limit, offset, more: r.rows.length === limit } });
  }));

  app.patch(P + '/admin/admissions/records/:id', adm(async (req, res, who) => {
    const b = req.body || {}, cur = (await q(`SELECT * FROM ${T('adm_outcomes')} WHERE id=$1`, [req.params.id])).rows[0];
    if (!cur) return res.status(404).json({ ok: false });
    const set = {}, changes = {};
    if (b.review_status && ['pending', 'approved', 'rejected'].indexOf(b.review_status) !== -1) set.review_status = b.review_status;
    if (b.confidence && Q.CONFIDENCE.indexOf(b.confidence) !== -1) set.confidence = b.confidence;
    if (b.result && Q.RESULTS.indexOf(b.result) !== -1) set.result = b.result;
    if (b.level && Q.LEVELS.indexOf(b.level) !== -1) set.level = b.level;
    if (b.uni_key) { if (!UNI.has(b.uni_key)) return res.status(400).json({ ok: false, message: 'Unknown university key (cc:id).' }); set.uni_key = b.uni_key; }
    if (b.program_raw != null) { set.program_raw = clip(b.program_raw, 120) || null; set.field = Q.fieldOf(set.program_raw); }
    if (b.qualification || b.score_raw != null) {
      const qual = b.qualification || cur.qualification, sc = Q.parseScore(qual, b.score_raw != null ? b.score_raw : cur.score_raw);
      if (!sc) return res.status(400).json({ ok: false, message: 'That score doesn\'t fit the qualification.' });
      set.qualification = qual; set.score_raw = sc.raw; set.score_num = sc.num;
    }
    if (b.review_note != null) set.review_note = clip(b.review_note, 300);
    if ('uni_key' in set || 'program_raw' in set || 'level' in set) set.program_id = (set.program_raw || cur.program_raw) ? await upsertProgram(set.uni_key || cur.uni_key, set.program_raw || cur.program_raw, set.level || cur.level, 'admin') : null;
    if (set.review_status === 'approved') { set.dup_flag = false; set.dup_of = null; }   // reviewed: not a duplicate after all
    const merged = Object.assign({}, cur, set); set.fingerprint = fingerprint(merged);
    const cols = Object.keys(set); cols.forEach((c) => { if (c !== 'fingerprint' && String(cur[c]) !== String(set[c])) changes[c] = set[c]; });
    await q(`UPDATE ${T('adm_outcomes')} SET ${cols.map((c, i) => c + '=$' + (i + 2)).join(', ')}, reviewed_at=now(), reviewed_by=$${cols.length + 2}, updated_at=now() WHERE id=$1`, [cur.id].concat(cols.map((c) => set[c]), [who]));
    bust(cur.uni_key); if (set.uni_key) bust(set.uni_key);
    audit(who, 'admissions_record_' + (set.review_status || 'edited'), cur.id, changes, req);
    res.json({ ok: true });
  }));

  app.post(P + '/admin/admissions/records/:id/merge', adm(async (req, res, who) => {
    const into = String((req.body || {}).into || '');
    const a = (await q(`SELECT id, uni_key FROM ${T('adm_outcomes')} WHERE id=$1`, [req.params.id])).rows[0], b = (await q(`SELECT id FROM ${T('adm_outcomes')} WHERE id=$1`, [into])).rows[0];
    if (!a || !b || a.id === b.id) return res.status(400).json({ ok: false, message: 'Pick two different records.' });
    await q(`UPDATE ${T('adm_outcomes')} SET dup_of=$2, dup_flag=false, review_status='duplicate', reviewed_at=now(), reviewed_by=$3 WHERE id=$1`, [a.id, b.id, who]);
    bust(a.uni_key); audit(who, 'admissions_record_merged', a.id, { into: b.id }, req);
    res.json({ ok: true });
  }));

  app.delete(P + '/admin/admissions/records/:id', adm(async (req, res, who) => {
    const a = (await q(`DELETE FROM ${T('adm_outcomes')} WHERE id=$1 RETURNING uni_key, source_type`, [req.params.id])).rows[0];
    if (!a) return res.status(404).json({ ok: false });
    bust(a.uni_key); audit(who, 'admissions_record_removed', req.params.id, { type: a.source_type }, req);
    res.json({ ok: true });
  }));

  app.get(P + '/admin/admissions/official', adm(async (req, res) => {
    const st = ['pending', 'approved', 'rejected'].indexOf(req.query.status) !== -1 ? req.query.status : null;
    const w = st ? ' WHERE x.review_status=$1' : '', p = st ? [st] : [];
    const join = (t) => `SELECT x.*, u.name uni_name, src.url source_url, src.publisher FROM ${T(t)} x LEFT JOIN ${T('adm_universities')} u ON u.uni_key=x.uni_key LEFT JOIN ${T('adm_sources')} src ON src.id=x.source_id${w} ORDER BY x.created_at DESC LIMIT 200`;
    const [s, r, sc] = await Promise.all([q(join('adm_official_stats'), p), q(join('adm_requirements'), p), q(join('adm_scholarships'), p)]);
    const dates = (x) => Object.assign(x, { collected_at: ymd(x.collected_at), source_date: ymd(x.source_date), deadline: x.deadline instanceof Date ? ymd(x.deadline) : x.deadline });
    res.json({ ok: true, stats: s.rows.map(dates), requirements: r.rows.map(dates), scholarships: sc.rows.map(dates) });
  }));

  app.patch(P + '/admin/admissions/official/:kind/:id', adm(async (req, res, who) => {
    const t = { stats: 'adm_official_stats', requirements: 'adm_requirements', scholarships: 'adm_scholarships' }[req.params.kind];
    const st = (req.body || {}).review_status;
    if (!t || ['pending', 'approved', 'rejected'].indexOf(st) === -1) return res.status(400).json({ ok: false });
    const r = (await q(`UPDATE ${T(t)} SET review_status=$2 WHERE id=$1 RETURNING uni_key`, [req.params.id, st])).rows[0];
    if (!r) return res.status(404).json({ ok: false });
    bust(r.uni_key); audit(who, 'admissions_official_' + st, req.params.id, { kind: req.params.kind }, req);
    res.json({ ok: true });
  }));

  app.get(P + '/admin/admissions/sources', adm(async (req, res) => {
    const limit = Math.max(1, Math.min(100, +req.query.limit || 50)), offset = Math.max(0, +req.query.offset || 0);
    const r = await q(`SELECT * FROM ${T('adm_sources')} ORDER BY fetched_at DESC LIMIT $1 OFFSET $2`, [limit, offset]);
    res.json({ ok: true, rows: r.rows, page: { limit, offset, more: r.rows.length === limit } });
  }));

  app.post(P + '/admin/admissions/research', adm(async (req, res, who) => {
    const b = req.body || {}, uni = uniOf(b.cc, b.uniId); if (!uni) return res.status(400).json({ ok: false, message: 'Pick a university.' });
    const job = await research.enqueue(uni.cc + ':' + uni.id, clip(b.program, 80) || null, 'admin:' + who, !!b.force);
    audit(who, 'admissions_research_queued', uni.cc + ':' + uni.id, { program: b.program || null }, req);
    res.json(Object.assign({ ok: true }, job));
  }));

  app.post(P + '/admin/admissions/official-url', adm(async (req, res, who) => {
    const b = req.body || {}, uni = uniOf(b.cc, b.uniId); if (!uni) return res.status(400).json({ ok: false, message: 'Pick a university.' });
    if (!/^https:\/\//.test(b.url || '')) return res.status(400).json({ ok: false, message: 'Paste an https:// link to an official page.' });
    const out = await research.extractOfficial(uni.cc + ':' + uni.id, String(b.url), clip(b.program, 120) || null);
    audit(who, 'admissions_official_extracted', uni.cc + ':' + uni.id, { url: b.url, found: out.found }, req);
    res.json(Object.assign({ ok: true }, out));
  }));

  init().then((ok) => { if (ok) { log('[admissions] ready (schema ' + S + ')'); research.recheckPending().then((r) => { if (r.rejected || r.published) log('[admissions] re-check of ' + r.checked + ' pending reports: ' + r.rejected + ' rejected, ' + r.published + ' published after a second check'); }).catch((e) => errlog('[admissions] recheck:', e.message)); research.start(); } });
  return { init, ingest, stats, compare, research };
};
