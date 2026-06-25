'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   UniVersity — daily student news brief.

   For each subscriber's saved universities the agent pulls recent news, then
   CURATES it down to what a prospective student actually cares about — events,
   application/scholarship deadlines, notable achievements, real happenings — and
   drops generic PR / routine reposts. If a saved university has nothing worth
   reporting, it says so plainly and falls back to interesting news from across
   the subscriber's destination country (other universities OR cities), giving at
   least a couple of items so the email is never empty.

   News source: Google News RSS (no key). Curation/wording: OpenAI or Groq
   (optional — there's a keyword heuristic fallback). Delivery: Resend or SMTP.
   ──────────────────────────────────────────────────────────────────────────── */
const fs = require('fs');
const path = require('path');
const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS digest_subs (
    email        TEXT PRIMARY KEY,
    user_id      TEXT,
    universities TEXT,                -- JSON array of names
    country      TEXT,                -- destination country (code or name)
    last_sent    TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );
`);
try { db.exec('ALTER TABLE digest_subs ADD COLUMN country TEXT'); } catch (e) { /* already there */ }

const _upsert = db.prepare(`
  INSERT INTO digest_subs (email, user_id, universities, country)
  VALUES (@email, @user_id, @universities, @country)
  ON CONFLICT(email) DO UPDATE SET user_id = @user_id, universities = @universities, country = @country
`);
const _all = db.prepare(`SELECT * FROM digest_subs`);
const _one = db.prepare(`SELECT * FROM digest_subs WHERE email = ?`);
const _markSent = db.prepare(`UPDATE digest_subs SET last_sent = datetime('now') WHERE email = ?`);
const _delete = db.prepare(`DELETE FROM digest_subs WHERE email = ?`);

function unsubscribe(email) {
  email = String(email || '').trim().toLowerCase();
  _delete.run(email);
  return { email, unsubscribed: true };
}

/* Save / update a subscriber: their saved universities + destination country. */
function subscribe({ email, userId, universities, country }) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');
  const names = (Array.isArray(universities) ? universities : [])
    .map(u => (typeof u === 'string' ? u : (u && u.name) || ''))
    .map(s => String(s).trim()).filter(Boolean);
  _upsert.run({
    email, user_id: String(userId || ''),
    universities: JSON.stringify([...new Set(names)]),
    country: country ? String(country) : null,
  });
  return { email, count: names.length, country: country || null };
}

const COUNTRY_NAMES = {
  gb: 'the United Kingdom', uk: 'the United Kingdom', us: 'the United States', usa: 'the United States',
  de: 'Germany', fr: 'France', es: 'Spain', it: 'Italy', nl: 'the Netherlands', se: 'Sweden',
  ch: 'Switzerland', pt: 'Portugal', ua: 'Ukraine', be: 'Belgium', dk: 'Denmark', fi: 'Finland', ie: 'Ireland',
};
function countryName(c) {
  if (!c) return null;
  const k = String(c).toLowerCase().trim();
  return COUNTRY_NAMES[k] || c;   // accepts a 2-letter code or an already-spelled name
}

function decode(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/<[^>]+>/g, '').trim();
}

/* Recent real news from Google News RSS. `days` uses Google's when:Nd recency. */
async function fetchNews(query, max = 12, days = 30) {
  const q = encodeURIComponent(query + (days ? ' when:' + days + 'd' : ''));
  const url = 'https://news.google.com/rss/search?q=' + q + '&hl=en-US&gl=US&ceid=US:en';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (UniVersity digest)' } });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
    while ((m = re.exec(xml)) !== null && items.length < max) {
      const b = m[1];
      const title = (b.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
      const link = (b.match(/<link>([\s\S]*?)<\/link>/) || [])[1];
      const date = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
      if (title) items.push({ title: decode(title), link: decode(link || ''), date: decode(date || '') });
    }
    return items;
  } catch (e) { return []; }
}
async function fetchUniNews(name, max = 6) { return fetchNews('"' + name + '"', max); }   // back-compat

/* ── LLM helpers (OpenAI or Groq, optional) ── */
function llmConfig() {
  const key = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (!key) return null;
  const isGroq = key.indexOf('gsk_') === 0 || !!process.env.GROQ_API_KEY;
  return {
    key, baseURL: isGroq ? 'https://api.groq.com/openai/v1' : (process.env.OPENAI_BASE_URL || undefined),
    model: process.env.OPENAI_MODEL || (isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
  };
}
function hasLLM() { return !!llmConfig(); }
async function llmChat(messages, opts = {}) {
  const cfg = llmConfig(); if (!cfg) return null;
  const OpenAI = (await import('openai')).default;
  const client = new OpenAI({ apiKey: cfg.key, baseURL: cfg.baseURL });
  const c = await client.chat.completions.create({
    model: cfg.model,
    temperature: opts.temperature != null ? opts.temperature : 0.4,
    max_tokens: opts.max_tokens || 700,
    response_format: opts.json ? { type: 'json_object' } : undefined,
    messages,
  });
  return (c.choices && c.choices[0] && c.choices[0].message && c.choices[0].message.content) || '';
}

// Fallback keyword filter for "is this actually interesting to a student?"
const INTERESTING_RE = /\b(open day|openday|application|apply|deadline|admission|clearing|scholarship|bursary|funding|grant|enrol|enroll|registration|ucas|results day|ranking|ranked|league table|award|wins|won|prize|nobel|breakthrough|new (course|campus|building|programme|program|scholarship)|opens|launch|festival|fair|conference|open lecture|strike|tuition|fees|housing|accommodation|graduation)\b/i;
function heuristicType(t) {
  if (/deadline|application|apply|scholarship|admission|clearing|ucas|enrol|registration|funding|bursary/i.test(t)) return 'deadline';
  if (/open day|event|fair|festival|conference|lecture|ceremony|graduation/i.test(t)) return 'event';
  return 'news';
}

/* Curate raw news into the few genuinely interesting items, rewritten + typed.
   context = { kind:'university'|'country', name }. Returns [] if nothing qualifies. */
async function curate(context, raw, max = 4) {
  if (!raw.length) return [];
  if (hasLLM()) {
    try {
      const payload = raw.slice(0, 12).map((r, i) => ({ i, title: r.title }));
      const isCountry = context.kind === 'country';
      const audience = isCountry ? ('a student considering studying in ' + context.name) : ('a student interested in ' + context.name);
      const sys =
        'You curate a short student news brief. From the given news items, KEEP only the ones genuinely interesting or useful to ' + audience + ': ' +
        'real events (open days, fairs, talks), application or scholarship DEADLINES and admissions news, notable achievements (rankings, awards, research breakthroughs), ' +
        'or real happenings in university/city life. DISCARD routine PR, internal staff notices, sports recaps, opinion/blog pieces, listicles, and anything not clearly relevant. ' +
        'Rewrite each kept item as ONE short, friendly sentence' + (isCountry ? ' that names the university or city it is about' : '') + '. ' +
        'Classify each: "deadline" (a date/window to act on), "event" (something to attend), or "news" (a notable happening). ' +
        'Return ONLY JSON {"items":[{"blurb":"","type":"deadline|event|news","i":<index from input>}]}, at most ' + max + ' items. If NONE qualify, return {"items":[]}.';
      const out = await llmChat(
        [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(payload) }],
        { json: true, max_tokens: 600 }
      );
      const parsed = JSON.parse(out);
      return (parsed.items || []).slice(0, max).map(it => {
        const src = raw[it.i] || {};
        return {
          blurb: String(it.blurb || '').trim(),
          type: ['deadline', 'event', 'news'].includes(it.type) ? it.type : 'news',
          url: src.link || '', title: src.title || '',
        };
      }).filter(x => x.blurb);
    } catch (e) { /* fall through to heuristic */ }
  }
  return raw.filter(r => INTERESTING_RE.test(r.title)).slice(0, max).map(r => ({
    blurb: r.title, type: heuristicType(r.title), url: r.link, title: r.title,
  }));
}

/* Country fallback: interesting news about ANY university or city in the country. */
async function fetchCountryNews(country) {
  const name = countryName(country);
  const queries = [
    'universities in ' + name + ' (open day OR application OR deadline OR scholarship OR clearing OR ranking OR research OR award)',
    'student city ' + name + ' (event OR festival OR housing OR rent OR transport OR opening)',
  ];
  const seen = {}; const all = [];
  for (const q of queries) {
    const items = await fetchNews(q, 8, 30);
    for (const it of items) { const k = it.link || it.title; if (k && !seen[k]) { seen[k] = 1; all.push(it); } }
  }
  return all;
}

/* A short, warm opener (LLM if available, else a sensible default). */
async function introLine(total, uniCount, hasCountry) {
  if (!hasLLM()) {
    return total
      ? "Here's what's worth knowing this week."
      : "It's been quiet at your saved universities — here's a look around for anything useful.";
  }
  try {
    const out = await llmChat([{
      role: 'user',
      content: 'Write ONE short, warm, casual sentence (max 16 words) to open a student news email that rounds up ' +
        total + ' curated update(s) about ' + uniCount + ' saved universities' +
        (hasCountry ? ' plus a few from around their destination country' : '') +
        '. No greeting like "Hi", no quotes. Just the sentence.'
    }], { temperature: 0.7, max_tokens: 50 });
    return (out || '').trim().replace(/^["']|["']$/g, '') || "Here's what's worth knowing this week.";
  } catch (e) { return "Here's what's worth knowing this week."; }
}

/* ── Email rendering ── */
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const TYPE_BADGE = {
  deadline: '<span style="font-size:10px;font-weight:700;color:#9a3412;background:#fff3e6;padding:2px 8px;border-radius:999px">⏰ DEADLINE</span>',
  event:    '<span style="font-size:10px;font-weight:700;color:#3730a3;background:#eef2ff;padding:2px 8px;border-radius:999px">📅 EVENT</span>',
  news:     '<span style="font-size:10px;font-weight:700;color:#166534;background:#ecfdf3;padding:2px 8px;border-radius:999px">📰 NEWS</span>',
};
function itemHtml(it) {
  return '<div style="padding:11px 0;border-top:1px solid #f0f0ee">' +
    (TYPE_BADGE[it.type] || TYPE_BADGE.news) +
    '<div style="font-size:14px;line-height:1.55;color:#33384a;margin:7px 0 0">' + esc(it.blurb) + '</div>' +
    (it.url ? '<a href="' + esc(it.url) + '" style="font-size:12.5px;font-weight:600;color:#d97c14;text-decoration:none">Read more →</a>' : '') +
  '</div>';
}
function uniCardHtml(b) {
  const head = '<div style="font-weight:800;font-size:16px;color:#1e2235;margin:0 0 4px">' + esc(b.name) + '</div>';
  if (!b.items.length) {
    return '<div style="margin:0 0 18px">' + head +
      '<div style="font-size:13.5px;color:#8a909c;font-style:italic">Nothing new in the world of ' + esc(b.name) + ' right now.</div></div>';
  }
  return '<div style="margin:0 0 20px">' + head + b.items.map(itemHtml).join('') + '</div>';
}
function buildHtml({ intro, uniBlocks, countryBlock, nudge }) {
  const cards = uniBlocks.map(uniCardHtml).join('');
  const nudgeBox = nudge
    ? '<div style="margin:0 0 20px;padding:14px 16px;background:#fff3e3;border:1px solid #ffe0bd;border-radius:12px;font-size:13.5px;color:#9a5b2c;line-height:1.55">' +
        '⭐ <b>Make this yours.</b> Open UniVersity and bookmark the universities you care about — your next brief will feature news tailored to them.' +
      '</div>'
    : '';
  const country = countryBlock
    ? '<div style="margin:24px 0 0;padding:18px 18px 6px;background:#faf9f5;border:1px solid #eee;border-radius:14px">' +
        '<div style="font-size:13px;font-weight:800;color:#8a6d3b;text-transform:uppercase;letter-spacing:.5px;margin:0 0 4px">Meanwhile, around ' + esc(countryBlock.country) + '</div>' +
        '<div style="font-size:12.5px;color:#8a909c;margin:0 0 6px">Worth a look from other universities &amp; cities in your destination.</div>' +
        countryBlock.items.map(itemHtml).join('') +
      '</div>'
    : '';
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;background:#faf9f5;padding:0">' +
    '<div style="background:linear-gradient(135deg,#d97c14,#f59220);padding:22px 24px;border-radius:14px 14px 0 0">' +
      '<div style="color:#fff;font-size:20px;font-weight:800">UniVersity · Daily Brief</div>' +
      '<div style="color:rgba(255,255,255,.9);font-size:13px;margin-top:4px">Events, deadlines &amp; news worth your time</div>' +
    '</div>' +
    '<div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px">' +
      '<p style="font-size:14.5px;color:#4a5160;line-height:1.6;margin:0 0 20px">' + esc(intro) + '</p>' +
      nudgeBox + cards + country +
      '<div style="border-top:1px solid #eee;margin-top:18px;padding-top:14px;font-size:11.5px;color:#8a909c">' +
        'Curated for your saved universities — only the interesting bits, not every press release.' +
      '</div>' +
    '</div></div>';
}

/* Build + send the brief for one subscriber. */
async function sendOne(mailer, synth, sub) {
  let names = [];
  try { names = JSON.parse(sub.universities || '[]'); } catch (e) {}
  const country = sub.country || null;
  // Elite buyers who haven't picked favourites yet still get a useful email — the
  // destination country/city news plus a nudge to personalise it. Only skip if we
  // have nothing at all to show them (no favourites AND no destination country).
  const nudge = !names.length;
  if (nudge && !country) return { email: sub.email, skipped: 'no_unis_no_country' };

  const uniBlocks = []; let quiet = 0; let total = 0;
  for (const name of names.slice(0, 10)) {
    const raw = await fetchNews('"' + name + '"', 12, 30);
    const items = await curate({ kind: 'university', name }, raw, 4);
    total += items.length;
    uniBlocks.push({ name, items });
    if (!items.length) quiet++;
  }

  // Always include news from the destination country & its cities — it's frequent
  // and relevant (e.g. a UK destination gets UK university + city news), not just a
  // fallback for when a university was quiet.
  let countryBlock = null;
  if (country) {
    const raw = await fetchCountryNews(country);
    const items = await curate({ kind: 'country', name: countryName(country) }, raw, 5);
    if (items.length) { countryBlock = { country: countryName(country), items }; total += items.length; }
  }

  const intro = await introLine(total, names.length, !!countryBlock);
  const html = buildHtml({ intro, uniBlocks, countryBlock, nudge });
  const subject = total
    ? 'Your student brief — ' + total + ' update' + (total === 1 ? '' : 's')
    : 'Your student brief — quiet week';

  // Preferred: Resend HTTP API (no SMTP / app-passwords / IP blocks).
  if (process.env.RESEND_API_KEY) {
    const from = process.env.RESEND_FROM || 'UniVersity <onboarding@resend.dev>';
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [sub.email], subject, html }),
    });
    if (!r.ok) { const t = await r.text(); throw new Error('Resend ' + r.status + ': ' + t.slice(0, 200)); }
    _markSent.run(sub.email);
    return { email: sub.email, sent: true, headlines: total, via: 'resend' };
  }

  if (!mailer) { return { email: sub.email, sent: false, reason: 'no_email_provider', headlines: total, html }; }
  await mailer.sendMail({
    from: process.env.SMTP_FROM || ('UniVersity <' + process.env.SMTP_USER + '>'),
    to: sub.email, subject, html,
  });
  _markSent.run(sub.email);
  return { email: sub.email, sent: true, headlines: total, via: 'smtp' };
}

/* Run the brief. With `subsOverride` (an explicit [{email,universities,country}]
   list, e.g. built from Stripe) it emails those; otherwise every stored subscriber
   (or just one, for testing). De-duplicated by email. */
async function runDigest(mailer, synth, onlyEmail, subsOverride) {
  let subs;
  if (onlyEmail) subs = [_one.get(String(onlyEmail).toLowerCase())].filter(Boolean);
  else if (Array.isArray(subsOverride)) subs = subsOverride;
  else subs = _all.all();
  const seen = {};
  subs = subs.filter(function (s) {
    if (!s || !s.email) return false;
    const k = String(s.email).toLowerCase();
    if (seen[k]) return false; seen[k] = 1; return true;
  });
  const results = [];
  for (const sub of subs) {
    try { results.push(await sendOne(mailer, synth, sub)); }
    catch (e) { results.push({ email: sub.email, error: e.message }); }
  }
  return results;
}

/* Seed subscribers from a committed digest-targets.json (for cloud hosts whose
   disk is ephemeral / that don't share the app's live SQLite). */
function seedFromTargetsFile() {
  const p = path.join(__dirname, 'digest-targets.json');
  if (!fs.existsSync(p)) return 0;
  try {
    const t = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = Array.isArray(t) ? t : [t];
    let n = 0;
    list.forEach(s => { if (s && s.email) { try { subscribe(s); n++; } catch (e) {} } });
    return n;
  } catch (e) { return 0; }
}

module.exports = { subscribe, unsubscribe, runDigest, sendOne, fetchUniNews, fetchNews, curate, seedFromTargetsFile, _all };
