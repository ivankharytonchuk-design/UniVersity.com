'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   UniVersity — admin API (used by design/admin.html)

   Security (OWASP session-management / authentication guidance):
     • server-side login: username + bcrypt password hash in SQLite settings
       (default "admin" / ADMIN_PASSWORD env or "1234" — the panel nags until changed)
     • 256-bit random session tokens, stored only as SHA-256 hashes;
       30-minute idle timeout, 12-hour absolute lifetime, revoked on logout
     • login attempts rate-limited per IP (6 per 15 minutes), failures audited
     • ADMIN_TOKEN (env) still works for scripts
     • every admin action lands in an append-only audit table (SQLite triggers
       refuse UPDATE and DELETE)

   Data it reads:
     • Postgres (store.js): accounts, sessions, user_data (synced app data)
     • SQLite (db.js): Elite users (manual grants), Stripe subscriptions
     • ai_log (this file): every AI research question, latency, outcome
     • design/data/*.json: the university dataset (content health)
   ──────────────────────────────────────────────────────────────────────────── */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const IDLE_MS = 30 * 60e3, ABS_MS = 12 * 3600e3, DAY = 864e5;
const DATA_DIR = path.join(__dirname, '..', 'design', 'data');
const NEWS_FILE = path.join(__dirname, 'data', 'news-today.json');
const CODES = ['gb', 'us', 'ch', 'nl', 'se', 'de', 'fr', 'it', 'es', 'ie', 'dk', 'fi', 'be', 'pt', 'ua'];
const ELITE_PRICE_EUR = 15;

module.exports = function mountAdmin(app, deps) {
  const { db: D, store, stripe, ELITE_STATUSES, log } = deps;
  const sql = D.db;

  sql.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, created_at INTEGER, last_seen INTEGER, ip TEXT, ua TEXT);
    CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, actor TEXT, action TEXT, target TEXT, detail TEXT, ip TEXT);
    CREATE TABLE IF NOT EXISTS ai_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, user_id TEXT, query TEXT, subject TEXT, ms INTEGER, ok INTEGER,
      deep INTEGER, reddit INTEGER, news INTEGER, reviews INTEGER, error TEXT);
    CREATE INDEX IF NOT EXISTS idx_ai_ts ON ai_log(ts);
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON admin_audit(ts);
    CREATE TRIGGER IF NOT EXISTS admin_audit_no_update BEFORE UPDATE ON admin_audit BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS admin_audit_no_delete BEFORE DELETE ON admin_audit BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
  `);

  /* ── credentials ─────────────────────────────────────────────── */
  if (!D.getSetting('admin_user')) D.setSetting('admin_user', 'admin');
  if (!D.getSetting('admin_pw_hash')) {
    D.setSetting('admin_pw_hash', bcrypt.hashSync(process.env.ADMIN_PASSWORD || '1234', 10));
    D.setSetting('admin_pw_default', process.env.ADMIN_PASSWORD ? '0' : '1');
  }
  const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
  const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const audit = (actor, action, target, detail, ip) => {
    try { sql.prepare('INSERT INTO admin_audit (ts, actor, action, target, detail, ip) VALUES (?,?,?,?,?,?)').run(Date.now(), actor || 'admin', action, target || null, detail ? JSON.stringify(detail) : null, ip || null); } catch (e) {}
  };

  // who is calling? → 'admin' (session), 'token' (ADMIN_TOKEN) or null
  function check(req) {
    const tok = req.headers['x-admin-token'] || (req.body && req.body.token) || req.query.token;
    if (!tok) return null;
    if (process.env.ADMIN_TOKEN && tok === process.env.ADMIN_TOKEN) return 'token';
    const row = sql.prepare('SELECT * FROM admin_sessions WHERE token_hash = ?').get(sha(tok));
    if (!row) return null;
    const now = Date.now();
    if (now - row.last_seen > IDLE_MS || now - row.created_at > ABS_MS) { sql.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(row.token_hash); return null; }
    sql.prepare('UPDATE admin_sessions SET last_seen = ? WHERE token_hash = ?').run(now, row.token_hash);
    return D.getSetting('admin_user') || 'admin';
  }
  function guard(req, res) {
    const who = check(req);
    if (!who) { res.status(401).json({ error: 'unauthorized', message: 'Sign in again.' }); return null; }
    return who;
  }

  const attempts = new Map();   // ip → { n, first }
  app.post('/api/admin/login', (req, res) => {
    const ip = ipOf(req), now = Date.now(), a = attempts.get(ip) || { n: 0, first: now };
    if (now - a.first > 15 * 60e3) { a.n = 0; a.first = now; }
    if (a.n >= 6) return res.status(429).json({ error: 'locked', message: 'Too many attempts — try again in ' + Math.ceil((a.first + 15 * 60e3 - now) / 60e3) + ' min.' });
    const { username, password } = req.body || {};
    const okUser = String(username || '').trim().toLowerCase() === String(D.getSetting('admin_user') || 'admin').toLowerCase();
    const okPw = okUser && bcrypt.compareSync(String(password || ''), D.getSetting('admin_pw_hash') || '');
    if (!okPw) {
      a.n++; attempts.set(ip, a);
      audit(String(username || '?').slice(0, 40), 'login_failed', null, { attempt: a.n }, ip);
      return res.status(401).json({ error: 'bad_credentials', message: 'Wrong username or password.', left: Math.max(0, 6 - a.n) });
    }
    attempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sql.prepare('INSERT INTO admin_sessions (token_hash, created_at, last_seen, ip, ua) VALUES (?,?,?,?,?)').run(sha(token), now, now, ip, String(req.headers['user-agent'] || '').slice(0, 160));
    sql.prepare('DELETE FROM admin_sessions WHERE last_seen < ? OR created_at < ?').run(now - IDLE_MS, now - ABS_MS);
    audit(D.getSetting('admin_user'), 'login', null, null, ip);
    res.json({ ok: true, token, user: D.getSetting('admin_user'), defaultPassword: D.getSetting('admin_pw_default') === '1', idleMinutes: IDLE_MS / 60e3 });
  });
  app.post('/api/admin/logout', (req, res) => {
    const tok = req.headers['x-admin-token'];
    if (tok) sql.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(sha(tok));
    res.json({ ok: true });
  });
  app.get('/api/admin/me', (req, res) => {
    const who = guard(req, res); if (!who) return;
    res.json({ ok: true, user: who, defaultPassword: D.getSetting('admin_pw_default') === '1' });
  });
  app.post('/api/admin/password', (req, res) => {
    const who = guard(req, res); if (!who) return;
    const { current, next } = req.body || {};
    if (!bcrypt.compareSync(String(current || ''), D.getSetting('admin_pw_hash') || '')) return res.status(400).json({ error: 'wrong_current', message: 'The current password is wrong.' });
    if (String(next || '').length < 10) return res.status(400).json({ error: 'weak', message: 'Use at least 10 characters.' });
    D.setSetting('admin_pw_hash', bcrypt.hashSync(String(next), 10)); D.setSetting('admin_pw_default', '0');
    const keep = sha(req.headers['x-admin-token'] || '');
    sql.prepare('DELETE FROM admin_sessions WHERE token_hash != ?').run(keep);   // every other session is signed out
    audit(who, 'password_changed', null, null, ipOf(req));
    res.json({ ok: true });
  });

  /* ── people: Postgres accounts ⨝ SQLite Elite users ──────────── */
  async function pgRows(q, p) { try { return (await store.query(q, p)).rows; } catch (e) { return null; } }
  function latestSubs() {
    const m = {};
    sql.prepare('SELECT * FROM subscriptions ORDER BY updated_at').all().forEach((s) => { m[s.user_id] = s; });
    return m;
  }
  async function people() {
    const accounts = (await pgRows('SELECT id, email, username, created_at FROM accounts')) || [];
    const act = {};
    ((await pgRows("SELECT user_id, max(updated_at) AS last, count(*)::int AS keys FROM user_data GROUP BY user_id")) || []).forEach((r) => { act[r.user_id] = r; });
    const live = {};
    ((await pgRows('SELECT user_id, count(*)::int AS n FROM sessions WHERE expires_at > now() GROUP BY user_id')) || []).forEach((r) => { live[r.user_id] = r.n; });
    const local = sql.prepare('SELECT * FROM users').all(), subs = latestSubs();
    const byEmail = {}, out = [];
    accounts.forEach((a) => {
      const u = { key: a.id, source: 'account', email: a.email, username: a.username, created: a.created_at ? new Date(a.created_at).getTime() : null,
        lastActive: act[a.id] ? new Date(act[a.id].last).getTime() : null, keys: act[a.id] ? act[a.id].keys : 0, sessions: live[a.id] || 0, localIds: [] };
      out.push(u); if (a.email) byEmail[a.email.toLowerCase()] = u;
    });
    local.forEach((l) => {
      let u = l.email && byEmail[l.email.toLowerCase()];
      if (!u) { u = { key: 'l:' + l.id, source: 'local', email: l.email, username: l.username, created: l.created_at ? Date.parse(l.created_at + 'Z') : null, lastActive: l.updated_at ? Date.parse(l.updated_at + 'Z') : null, keys: 0, sessions: 0, localIds: [] }; out.push(u); if (l.email) byEmail[l.email.toLowerCase()] = u; }
      u.localIds.push(l.id);
      if (l.manual_elite) u.granted = true;
      const s = subs[l.id];
      if (s) { u.subStatus = s.status; u.renews = s.current_period_end ? s.current_period_end * 1000 : null; u.cancelAtEnd = !!s.cancel_at_period_end; if (ELITE_STATUSES.indexOf(s.status) !== -1) u.paid = true; }
      if (!u.username && l.username) u.username = l.username;
    });
    out.forEach((u) => { u.elite = !!(u.paid || u.granted); u.plan = u.paid ? 'paid' : u.granted ? 'granted' : 'free'; });
    return out;
  }
  async function findPerson(key) { return (await people()).find((u) => u.key === key) || null; }

  app.get('/api/admin/users', async (req, res) => {
    if (!guard(req, res)) return;
    res.json({ ok: true, db: store.enabled(), users: await people() });
  });

  // what a person has done in the app, from their synced data
  async function summary(u) {
    if (u.source !== 'account') return null;
    const rows = (await pgRows('SELECT key, value, updated_at, octet_length(value::text) AS size FROM user_data WHERE user_id = $1 ORDER BY updated_at DESC', [u.key])) || [];
    const pick = (re) => rows.filter((r) => re.test(r.key)).map((r) => r.value);
    const len = (re) => pick(re).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
    const gb = pick(/^us_gradebook_/)[0], st = pick(/^us_streak_/)[0], prof = pick(/^us_profile_/)[0];
    return {
      saved: len(/^us_saved_/), scholarships: len(/^us_sch_saved_/), careers: len(/^us_car_saved_/), deadlines: len(/^us_dl_cust_/), friends: len(/^us_friends_/),
      countries: len(/^us_fav_countries_/), subjects: gb && gb.subjects ? gb.subjects.length : 0, streak: st ? { count: st.count || 0, best: st.best || 0, last: st.last } : null,
      aiQuestions: pick(/^us_ai_prompts_/).reduce((n, v) => n + (parseInt(v, 10) || 0), 0), aiChats: len(/^us_ai_convos_/), title: prof && prof.title || null,
      keys: rows.map((r) => ({ key: r.key, size: r.size, updated: r.updated_at })),
    };
  }
  app.get('/api/admin/users/:key', async (req, res) => {
    if (!guard(req, res)) return;
    const u = await findPerson(req.params.key);
    if (!u) return res.status(404).json({ error: 'not_found' });
    const ai = u.localIds.concat(u.source === 'account' ? [u.key] : []);
    const aiRows = ai.length ? sql.prepare('SELECT ts, query, ms, ok FROM ai_log WHERE user_id IN (' + ai.map(() => '?').join(',') + ') ORDER BY ts DESC LIMIT 10').all(...ai) : [];
    res.json({ ok: true, user: u, summary: await summary(u), ai: aiRows });
  });
  app.post('/api/admin/users/:key/elite', async (req, res) => {
    const who = guard(req, res); if (!who) return;
    const u = await findPerson(req.params.key);
    if (!u) return res.status(404).json({ error: 'not_found' });
    const on = !!(req.body && req.body.on), reason = String((req.body && req.body.reason) || '').slice(0, 200);
    const ids = u.localIds.slice();
    if (!ids.length) { D.upsertUser({ id: u.key, email: u.email, username: u.username }); ids.push(u.key); }
    ids.forEach((id) => D.setManualElite(id, on));
    if (u.email) sql.prepare("UPDATE users SET manual_elite = ?, updated_at = datetime('now') WHERE lower(email) = lower(?)").run(on ? 1 : 0, u.email);
    audit(who, on ? 'elite_granted' : 'elite_revoked', u.email || u.key, { reason }, ipOf(req));
    log(`Admin ${on ? 'granted' : 'revoked'} Elite for ${u.email || u.key}`);
    res.json({ ok: true });
  });
  app.post('/api/admin/users/:key/signout', async (req, res) => {
    const who = guard(req, res); if (!who) return;
    const u = await findPerson(req.params.key);
    if (!u || u.source !== 'account') return res.status(400).json({ error: 'no_account', message: 'Only server accounts have sessions.' });
    await pgRows('DELETE FROM sessions WHERE user_id = $1', [u.key]);
    audit(who, 'user_signed_out', u.email, null, ipOf(req));
    res.json({ ok: true });
  });
  app.get('/api/admin/users/:key/export', async (req, res) => {
    const who = guard(req, res); if (!who) return;
    const u = await findPerson(req.params.key);
    if (!u) return res.status(404).json({ error: 'not_found' });
    const data = u.source === 'account' ? ((await pgRows('SELECT key, value, updated_at FROM user_data WHERE user_id = $1', [u.key])) || []) : [];
    audit(who, 'user_exported', u.email || u.key, null, ipOf(req));
    res.json({ exportedAt: new Date().toISOString(), user: u, data });
  });
  app.delete('/api/admin/users/:key', async (req, res) => {
    const who = guard(req, res); if (!who) return;
    const u = await findPerson(req.params.key);
    if (!u) return res.status(404).json({ error: 'not_found' });
    if (String((req.body && req.body.confirm) || '').trim().toLowerCase() !== String(u.email || u.key).toLowerCase()) return res.status(400).json({ error: 'confirm', message: 'Type the e-mail exactly to confirm.' });
    if (u.paid) return res.status(400).json({ error: 'paying', message: 'This person has an active subscription — cancel it in Stripe first.' });
    if (u.source === 'account') await pgRows('DELETE FROM accounts WHERE id = $1', [u.key]);
    u.localIds.forEach((id) => sql.prepare('DELETE FROM users WHERE id = ?').run(id));
    audit(who, 'user_deleted', u.email || u.key, { source: u.source }, ipOf(req));
    res.json({ ok: true });
  });

  /* ── overview ────────────────────────────────────────────────── */
  function days(n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.now() - i * DAY).toISOString().slice(0, 10)); return out; }
  app.get('/api/admin/overview', async (req, res) => {
    if (!guard(req, res)) return;
    const ppl = await people(), now = Date.now();
    const sign = {}; ppl.forEach((u) => { if (u.created && now - u.created < 30 * DAY) { const d = new Date(u.created).toISOString().slice(0, 10); sign[d] = (sign[d] || 0) + 1; } });
    const act = {}; ((await pgRows("SELECT to_char(date_trunc('day', updated_at), 'YYYY-MM-DD') AS d, count(DISTINCT user_id)::int AS n FROM user_data WHERE updated_at > now() - interval '30 days' GROUP BY 1")) || []).forEach((r) => { act[r.d] = r.n; });
    const ai = {}; sql.prepare("SELECT strftime('%Y-%m-%d', ts / 1000, 'unixepoch') AS d, count(*) AS n, sum(ok) AS ok FROM ai_log WHERE ts > ? GROUP BY 1").all(now - 30 * DAY).forEach((r) => { ai[r.d] = r; });
    const ai7 = sql.prepare('SELECT count(*) AS n, avg(ms) AS ms, sum(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS bad FROM ai_log WHERE ts > ?').get(now - 7 * DAY);
    const paid = ppl.filter((u) => u.paid).length, granted = ppl.filter((u) => u.granted && !u.paid).length;
    const active7 = ppl.filter((u) => u.lastActive && now - u.lastActive < 7 * DAY).length;
    const warnings = [];
    if (D.getSetting('admin_pw_default') === '1') warnings.push({ tone: 'bad', text: 'The admin password is still the default — change it in Settings.' });
    if (!store.enabled()) warnings.push({ tone: 'warn', text: 'Postgres (DATABASE_URL) is not configured — accounts are browser-only.' });
    if (/^sk_test_/.test(process.env.STRIPE_SECRET_KEY || '')) warnings.push({ tone: 'info', text: 'Stripe is in test mode — no real payments are being taken.' });
    res.json({
      ok: true,
      kpi: {
        people: ppl.length, accounts: ppl.filter((u) => u.source === 'account').length,
        signups7: ppl.filter((u) => u.created && now - u.created < 7 * DAY).length, signups30: ppl.filter((u) => u.created && now - u.created < 30 * DAY).length,
        active7, elite: paid + granted, paid, granted, arr: paid * ELITE_PRICE_EUR, conversion: ppl.length ? (paid + granted) / ppl.length : 0,
        ai7: ai7.n || 0, aiMs: Math.round(ai7.ms || 0), aiFail: ai7.n ? (ai7.bad || 0) / ai7.n : 0,
      },
      series: days(30).map((d) => ({ d, signups: sign[d] || 0, active: act[d] || 0, ai: ai[d] ? ai[d].n : 0 })),
      recent: ppl.filter((u) => u.created).sort((a, b) => b.created - a.created).slice(0, 6),
      warnings,
    });
  });

  /* ── AI usage ────────────────────────────────────────────────── */
  deps.logAI = function (row) {
    try {
      sql.prepare('INSERT INTO ai_log (ts, user_id, query, subject, ms, ok, deep, reddit, news, reviews, error) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
        .run(Date.now(), row.userId || null, String(row.query || '').slice(0, 400), row.subject || null, row.ms || 0, row.ok ? 1 : 0, row.deep ? 1 : 0, row.reddit || 0, row.news || 0, row.reviews || 0, row.error || null);
    } catch (e) {}
  };
  app.get('/api/admin/ai', (req, res) => {
    if (!guard(req, res)) return;
    const since = Date.now() - 30 * DAY;
    const rows = sql.prepare('SELECT * FROM ai_log ORDER BY ts DESC LIMIT 200').all();
    const tot = sql.prepare('SELECT count(*) AS n, avg(ms) AS ms, sum(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS bad, sum(deep) AS deep, avg(reddit) AS reddit, avg(news) AS news FROM ai_log WHERE ts > ?').get(since);
    const subjects = sql.prepare("SELECT subject, count(*) AS n FROM ai_log WHERE ts > ? AND subject IS NOT NULL AND subject != '' GROUP BY subject ORDER BY n DESC LIMIT 10").all(since);
    const p95 = (() => { const v = sql.prepare('SELECT ms FROM ai_log WHERE ts > ? AND ok = 1 ORDER BY ms').all(since).map((r) => r.ms); return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * .95))] : 0; })();
    res.json({ ok: true, total: tot, p95, subjects, rows });
  });

  /* ── system health (cached for a minute) ─────────────────────── */
  let healthCache = null;
  async function timed(fn) { const t = Date.now(); try { const detail = await fn(); return { ok: true, ms: Date.now() - t, detail }; } catch (e) { return { ok: !!e.warn, warn: !!e.warn, ms: Date.now() - t, detail: String(e.cause && e.cause.code || e.message).slice(0, 120) }; } }
  async function ping(url, opt) { const r = await fetch(url, Object.assign({ signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'Mozilla/5.0 UniVersityHealth/1.0' } }, opt || {})); if (!r.ok) throw new Error('HTTP ' + r.status); return 'HTTP ' + r.status; }
  app.get('/api/admin/health', async (req, res) => {
    if (!guard(req, res)) return;
    if (healthCache && Date.now() - healthCache.t < 60e3 && !req.query.fresh) return res.json(healthCache.v);
    const key = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '';
    const checks = await Promise.all([
      ['Postgres (accounts)', 'fa-database', () => store.enabled() ? store.query('SELECT 1').then(() => 'connected') : Promise.reject(new Error('DATABASE_URL not set'))],
      ['SQLite (Elite & logs)', 'fa-box-archive', async () => sql.prepare('SELECT count(*) AS n FROM users').get().n + ' Elite-table users'],
      ['AI model (Groq)', 'fa-brain', () => key ? ping('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + key } }).then(() => 'reachable · gpt-oss-120b') : Promise.reject(new Error('no API key'))],
      ['Reddit search', 'fa-reddit-alien', () => ping('https://www.reddit.com/search.rss?q=university&limit=1').catch((e) => { if (/40[39]|429/.test(e.message)) { const w = new Error('rate-limited right now — the AI falls back to the PullPush archive'); w.warn = true; throw w; } throw e; })],
      ['Arctic Shift archive', 'fa-box-open', () => ping('https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=UniUK&limit=1')],
      ['Google News', 'fa-newspaper', () => ping('https://news.google.com/rss/search?q=university&hl=en-GB&gl=GB&ceid=GB:en')],
      ['Stripe', 'fa-credit-card', async () => { await stripe.balance.retrieve(); return /^sk_live_/.test(process.env.STRIPE_SECRET_KEY || '') ? 'live mode' : 'test mode'; }],
      ['Qdrant (legacy)', 'fa-diagram-project', () => process.env.QDRANT_URL ? ping(process.env.QDRANT_URL.replace(/\/$/, '') + '/collections', { headers: { 'api-key': process.env.QDRANT_API_KEY || '' } }) : Promise.reject(new Error('not configured'))],
      ['E-mail', 'fa-envelope', async () => { if (process.env.RESEND_API_KEY) return 'Resend configured'; if (process.env.SMTP_HOST) return 'SMTP configured'; throw new Error('no provider'); }],
      ['Daily news agent', 'fa-rss', async () => { const d = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')); const age = Date.now() - new Date(d.generatedAt || d.date).getTime(); if (age > 2 * DAY) throw new Error('last brief ' + Math.round(age / DAY) + ' days old'); return 'last brief ' + Math.round(age / 3600e3) + ' h ago · ' + (d.items || []).length + ' stories'; }],
    ].map(async ([name, icon, fn]) => Object.assign({ name, icon }, await timed(fn))));
    const m = process.memoryUsage();
    const v = { ok: true, checks, server: { uptime: Math.round(process.uptime()), node: process.version, rssMB: Math.round(m.rss / 1048576), heapMB: Math.round(m.heapUsed / 1048576), pid: process.pid }, at: Date.now() };
    healthCache = { t: Date.now(), v };
    res.json(v);
  });

  /* ── content: the university dataset's health ─────────────────── */
  app.get('/api/admin/content', (req, res) => {
    if (!guard(req, res)) return;
    const countries = [], issues = [];
    CODES.forEach((cc) => {
      let d; try { d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, cc + '.json'), 'utf8')); } catch (e) { return; }
      const unis = d.universities || [], cities = Object.keys(d.cities || {}), seen = {};
      const row = { cc, name: (d.meta && d.meta.name) || cc.toUpperCase(), unis: unis.length, cities: cities.length, noWebsite: 0, noTuition: 0, dupes: 0, strayCity: 0 };
      unis.forEach((u) => {
        const n = String(u.name || '').toLowerCase().trim();
        if (!u.website) { row.noWebsite++; if (issues.length < 400) issues.push({ cc, uni: u.name, kind: 'website', text: 'No website' }); }
        if (!u.tuition) { row.noTuition++; issues.push({ cc, uni: u.name, kind: 'tuition', text: 'No tuition figure' }); }
        if (seen[n]) { row.dupes++; issues.push({ cc, uni: u.name, kind: 'duplicate', text: 'Listed twice' }); }
        if (u.city && cities.length && cities.indexOf(u.city) === -1) row.strayCity++;
        seen[n] = 1;
      });
      row.score = row.unis ? Math.round(100 * (1 - (row.noWebsite * .4 + row.noTuition + row.dupes * 2) / (row.unis * 1.4))) : 0;
      countries.push(row);
    });
    let news = null; try { const d = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')); news = { at: new Date(d.generatedAt || d.date).getTime(), items: (d.items || []).map((i) => ({ title: i.title, category: i.category })) }; } catch (e) {}
    res.json({ ok: true, countries, issues: issues.filter((i) => i.kind !== 'website').concat(issues.filter((i) => i.kind === 'website')).slice(0, 120), news });
  });

  /* ── audit log ───────────────────────────────────────────────── */
  app.get('/api/admin/audit', (req, res) => {
    if (!guard(req, res)) return;
    res.json({ ok: true, rows: sql.prepare('SELECT * FROM admin_audit ORDER BY ts DESC LIMIT 300').all() });
  });

  /* ── announcement banner (shown across the app) ───────────────── */
  function currentAnnouncement() {
    try { const a = JSON.parse(D.getSetting('announcement') || 'null'); if (a && (!a.until || a.until > Date.now())) return a; } catch (e) {}
    return null;
  }
  app.get('/api/announcement', (_req, res) => res.json({ ok: true, announcement: currentAnnouncement() }));
  app.post('/api/admin/announcement', (req, res) => {
    const who = guard(req, res); if (!who) return;
    const { text, tone, link, hours } = req.body || {};
    if (!text) { D.setSetting('announcement', 'null'); audit(who, 'announcement_cleared', null, null, ipOf(req)); return res.json({ ok: true, announcement: null }); }
    const a = { id: crypto.randomBytes(4).toString('hex'), text: String(text).slice(0, 220), tone: ['info', 'good', 'warn'].indexOf(tone) !== -1 ? tone : 'info',
      link: /^https?:\/\//.test(link || '') ? String(link).slice(0, 300) : null, at: Date.now(), until: hours ? Date.now() + Math.min(24 * 30, +hours) * 3600e3 : null };
    D.setSetting('announcement', JSON.stringify(a));
    audit(who, 'announcement_set', null, { text: a.text, hours: hours || null }, ipOf(req));
    res.json({ ok: true, announcement: a });
  });

  return { check, audit };
};
