'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   UniVersity — Daily Education News agent (v2).

   Every 24h it scouts the ENTIRE world of education and curates a daily brief.

   Pipeline:
     1. expandQueries()  — the LLM (Groq/OpenAI) turns a few seed topics into a
                           WIDE set of related search phrasings, so the same story
                           written in different words isn't missed (semantic reach,
                           not just fixed keywords).
     2. gather()         — pulls candidates from GDELT (real article URLs + photos)
                           with a Google-News RSS fallback. De-duplicated.
     3. curate()         — the LLM ranks the pool and keeps the 20 most interesting
                           stories of the day (the saved pool); the best 10 go live.
     4. detail()         — the LLM writes a 50-100 word deep-dive for each of the 10
                           (shown on hover).
     5. images           — real event photo (GDELT) → article og:image → a high-res
                           topical Flickr photo from an LLM-chosen visual query.
     6. archive          — each day is written to data/news/YYYY-MM-DD.json so past
                           days remain browsable; news-today.json mirrors the latest.

   Needs only the AI key the app already uses (OPENAI_API_KEY or GROQ_API_KEY).
   ════════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const synth = require('./synthesize');

const DATA_DIR = path.join(__dirname, 'data');
const NEWS_DIR = path.join(DATA_DIR, 'news');
const LATEST_FILE = path.join(DATA_DIR, 'news-today.json');
const TTL_MS = 24 * 60 * 60 * 1000;
const POOL_SIZE = 20;   // stories saved per day
const LIVE_SIZE = 10;   // stories shown in the feed

// The brief rolls over once a day at REFRESH_HOUR (local server time), NOT 24h
// after the last build — so it always lands on the same wall-clock hour (11:00).
const REFRESH_HOUR = parseInt(process.env.NEWS_REFRESH_HOUR || '11', 10);
function lastBoundary(now) {
  now = now || Date.now();
  var b = new Date(now); b.setHours(REFRESH_HOUR, 0, 0, 0);
  if (b.getTime() > now) b.setTime(b.getTime() - TTL_MS);   // before today's 11:00 → yesterday's
  return b.getTime();
}
function nextBoundary(now) { return lastBoundary(now) + TTL_MS; }

const SEED_TOPICS = [
  'university rankings and research breakthroughs', 'international student visas and immigration law',
  'tuition fees, student cost of living and housing', 'scholarships, grants and funding',
  'university admissions and application deadlines', 'study abroad and student exchange',
  'higher-education policy and reform',
];
const CATEGORIES = [
  'Scholarships', 'Visas & Law', 'Rankings', 'Research', 'Tuition & Costs',
  'Campus Life', 'Policy', 'Admissions', 'Study Abroad',
];

/* ── small utils ── */
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').trim();
}
function stripPublisher(t) { return decode(t).replace(/\s+-\s+[^-]{2,40}$/, '').trim(); }
function todayStr(d) { return new Date(d || Date.now()).toISOString().slice(0, 10); }
async function withTimeout(promise, ms) {
  let to; const t = new Promise((_, rej) => { to = setTimeout(() => rej(new Error('timeout')), ms); });
  try { return await Promise.race([promise, t]); } finally { clearTimeout(to); }
}

/* ── 1. Query expansion (semantic reach) ── */
async function expandQueries() {
  const base = [
    'university OR college (ranking OR research OR breakthrough OR award)',
    '"international students" (visa OR immigration OR "work permit" OR policy)',
    'student (tuition OR "cost of living" OR housing OR rent OR fees OR loan)',
    'scholarship OR grant OR bursary OR fellowship students',
    'university (admission OR application OR deadline OR "open day" OR enrolment)',
    '"study abroad" OR "student exchange" OR Erasmus',
    '"higher education" (policy OR reform OR funding OR law)',
  ];
  if (!synth.hasOpenAI()) return base;
  try {
    const system =
      'You expand search coverage for an education-news crawler. Given seed topics, output a JSON ' +
      'list of 14 diverse web-search queries that capture the SAME topics phrased in DIFFERENT words ' +
      '(synonyms, sub-topics, and real-world angles) so stories written with different wording are not ' +
      'missed. Keep each query short (2-6 words), varied, and global in scope. ' +
      'Return ONLY JSON {"queries":["",...]}.';
    const out = await synth.chat(system, JSON.stringify({ seeds: SEED_TOPICS }), { json: true, maxTokens: 500, temperature: 0.8 });
    const parsed = JSON.parse(out.text);
    const extra = (parsed.queries || []).filter(q => typeof q === 'string' && q.trim().length > 2);
    return base.concat(extra).slice(0, 22);
  } catch (e) { return base; }
}

/* ── 2. Sources ── */
async function fromGdelt(query) {
  const q = encodeURIComponent(query + ' sourcelang:english');
  const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + q +
              '&mode=ArtList&maxrecords=25&format=json&timespan=1d&sort=hybridrel';
  try {
    const r = await withTimeout(fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (UniVersity news)' } }), 9000);
    if (!r.ok) return [];
    const j = JSON.parse(await r.text());
    return (j.articles || []).map(a => ({
      title: decode(a.title || ''), url: a.url || '', source: a.domain || '',
      image: a.socialimage || '', date: a.seendate || '',
    })).filter(x => x.title && x.url);
  } catch (e) { return []; }
}
async function fromGoogle(query) {
  const q = encodeURIComponent(query + ' when:1d');
  const url = 'https://news.google.com/rss/search?q=' + q + '&hl=en-US&gl=US&ceid=US:en';
  try {
    const r = await withTimeout(fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (UniVersity news)' } }), 9000);
    if (!r.ok) return [];
    const xml = await r.text(); const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
    while ((m = re.exec(xml)) !== null && items.length < 20) {
      const b = m[1];
      const title = (b.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
      const link = (b.match(/<link>([\s\S]*?)<\/link>/) || [])[1];
      const source = (b.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1];
      if (title) items.push({ title: stripPublisher(title), url: decode(link || ''), source: decode(source || ''), image: '', date: '' });
    }
    return items;
  } catch (e) { return []; }
}
async function gather(queries) {
  const seen = {}, all = [];
  const push = list => (list || []).forEach(it => {
    const key = (it.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (key && !seen[key]) { seen[key] = 1; all.push(it); }
  });
  // Probe GDELT once (5s). If it's unreachable from this host, skip it entirely
  // instead of eating a timeout on every query. All fetches run in PARALLEL.
  let gdeltOk = false;
  try { const probe = await withTimeout(fromGdelt('education students'), 5000); gdeltOk = probe.length > 0; push(probe); } catch (e) {}
  if (gdeltOk) (await Promise.all(queries.slice(0, 14).map(q => fromGdelt(q).catch(() => [])))).forEach(push);
  // Google News always runs (primary when GDELT is down, supplement otherwise).
  if (all.length < 60) (await Promise.all(queries.map(q => fromGoogle(q).catch(() => [])))).forEach(push);
  return all;
}

/* ── 3 & 4. Curate to 20, then detail the top 10 ── */
async function curate(pool) {
  if (!pool.length) return [];
  if (synth.hasOpenAI()) {
    try {
      const payload = pool.slice(0, 70).map((r, i) => ({ i, title: r.title, source: r.source }));
      const system =
        'You are UniVersity AI, editor of today\'s global education brief for students. From the given ' +
        'headlines choose the ' + POOL_SIZE + ' MOST interesting and useful to students anywhere: university news ' +
        '(rankings, research, awards), student visas & immigration law, tuition, cost of living & housing, ' +
        'scholarships & funding, admissions & deadlines, study-abroad and education policy. Rank BEST first, ' +
        'maximise topic variety, and discard PR fluff, sports and opinion pieces. For each, write: ' +
        '"title" = elegant headline (max 68 chars, no outlet name), ' +
        '"subtitle" = one warm sentence why it matters to a student (max 120 chars), ' +
        '"category" = one of: ' + CATEGORIES.join(', ') + ', ' +
        '"imageQuery" = 2-3 comma-separated CONCRETE visual keywords for a photo (a place/object/scene, no abstract words). ' +
        'Return ONLY JSON {"items":[{"i":<index>,"title":"","subtitle":"","category":"","imageQuery":""}]} best-first, up to ' + POOL_SIZE + '.';
      const out = await synth.chat(system, JSON.stringify(payload), { json: true, maxTokens: 2600, temperature: 0.5 });
      const parsed = JSON.parse(out.text);
      return (parsed.items || []).slice(0, POOL_SIZE).map(it => {
        const src = pool[it.i] || {};
        return {
          title: String(it.title || src.title || '').trim(),
          subtitle: String(it.subtitle || '').trim(),
          category: CATEGORIES.includes(it.category) ? it.category : 'Campus Life',
          imageQuery: String(it.imageQuery || it.category || 'university,campus').trim(),
          url: src.url || '', source: src.source || '', srcImage: src.image || '', date: src.date || '',
        };
      }).filter(x => x.title && x.url);
    } catch (e) { /* fall through */ }
  }
  return pool.slice(0, POOL_SIZE).map((r, i) => ({
    title: r.title, subtitle: r.source ? ('Via ' + r.source) : 'Latest in education',
    category: CATEGORIES[i % CATEGORIES.length], imageQuery: 'university,campus',
    url: r.url, source: r.source, srcImage: r.image || '', date: r.date,
  }));
}
async function addDetails(items) {
  if (!items.length || !synth.hasOpenAI()) {
    items.forEach(it => { it.detail = it.subtitle; });
    return items;
  }
  try {
    const payload = items.map((it, i) => ({ i, title: it.title, subtitle: it.subtitle }));
    const system =
      'For each education news item, write "detail": a vivid 50-100 word explainer for a student — what happened, ' +
      'why it matters, and what to do or watch next. Plain, warm English; no headings; do not repeat the title verbatim. ' +
      'Return ONLY JSON {"details":[{"i":<index>,"detail":""}]} covering every item.';
    const out = await synth.chat(system, JSON.stringify(payload), { json: true, maxTokens: 2200, temperature: 0.6 });
    const map = {}; (JSON.parse(out.text).details || []).forEach(d => { map[d.i] = String(d.detail || '').trim(); });
    items.forEach((it, i) => { it.detail = map[i] || it.subtitle; });
  } catch (e) { items.forEach(it => { it.detail = it.subtitle; }); }
  return items;
}

/* ── 5. Images: real event photo → og:image → high-res topical Flickr ── */
async function ogImage(url) {
  if (!url || /news\.google\.com/.test(url)) return '';
  try {
    const r = await withTimeout(fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (UniVersity news)' } }), 6000);
    if (!r.ok) return '';
    const html = (await r.text()).slice(0, 200000);
    const m = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)
           || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
           || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const src = m ? decode(m[1]) : '';
    return /googleusercontent|gstatic|\/favicon|logo|sprite/i.test(src) ? '' : src;   // reject placeholders/logos
  } catch (e) { return ''; }
}
function flickr(imageQuery, seed) {
  const kw = String(imageQuery || 'university,campus').split(',').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 3).join(',');
  return 'https://loremflickr.com/1200/800/' + encodeURIComponent(kw) + '?lock=' + (Math.abs(seed) % 9000 + 1);
}
async function resolveImage(it, idx) {
  if (it.srcImage && /^https?:\/\//.test(it.srcImage)) return it.srcImage;   // GDELT real event photo
  const og = await ogImage(it.url);
  if (og) return og;
  return flickr(it.imageQuery, idx * 131 + (it.title || '').length);
}

/* ── build one day ── */
async function build() {
  const queries = await expandQueries();
  const pool = await gather(queries);
  const ranked = await curate(pool);                 // up to 20, best-first
  const live = ranked.slice(0, LIVE_SIZE);           // best 10 go on the feed
  await addDetails(live);
  await Promise.all(live.map(async (it, i) => { it.image = await resolveImage(it, i); }));
  const now = Date.now();
  return {
    generatedAt: now, date: todayStr(now),
    items: live,
    pool: ranked.map(({ title, category, url, source }) => ({ title, category, url, source })), // the 20 saved
  };
}

/* ── storage / archive ── */
function ensureDirs() { try { fs.mkdirSync(NEWS_DIR, { recursive: true }); } catch (e) {} }
function writeDay(data) {
  ensureDirs();
  try {
    fs.writeFileSync(path.join(NEWS_DIR, data.date + '.json'), JSON.stringify(data));
    fs.writeFileSync(LATEST_FILE, JSON.stringify(data));
  } catch (e) { /* non-fatal */ }
}
function readDay(dateStr) {
  try { return JSON.parse(fs.readFileSync(path.join(NEWS_DIR, dateStr + '.json'), 'utf8')); } catch (e) { return null; }
}
function readLatest() { try { return JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8')); } catch (e) { return null; } }
function availableDates() {
  try { return fs.readdirSync(NEWS_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map(f => f.slice(0, 10)).sort().reverse(); }
  catch (e) { const l = readLatest(); return l && l.date ? [l.date] : []; }
}
function isFresh(c) { return !!(c && c.items && c.items.length && c.generatedAt >= lastBoundary()); }

let _building = null;
async function getNews(opts) {
  opts = opts || {};
  // A specific past day → serve its archive as-is (never rebuild history).
  if (opts.date && opts.date !== todayStr()) {
    return readDay(opts.date) || { generatedAt: Date.now(), date: opts.date, items: [], note: 'no_archive' };
  }
  const latest = readLatest();
  if (!opts.force && isFresh(latest)) return latest;
  if (!synth.hasOpenAI() && !opts.force) return latest || { generatedAt: Date.now(), date: todayStr(), items: [], note: 'no_llm' };
  if (_building) { await _building; return readLatest() || latest || { generatedAt: Date.now(), items: [] }; }
  _building = build().then(built => { if (built.items && built.items.length) writeDay(built); _building = null; return built; })
                     .catch(e => { _building = null; throw e; });
  try { const built = await _building; return (built.items && built.items.length) ? built : (latest || built); }
  catch (e) { return latest || { generatedAt: Date.now(), date: todayStr(), items: [], note: 'build_failed' }; }
}

function isStale() { return !isFresh(readLatest()); }

module.exports = { getNews, build, refresh: () => getNews({ force: true }), isStale, availableDates, TTL_MS, nextBoundary };
