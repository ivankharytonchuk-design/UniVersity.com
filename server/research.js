'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   UniVersity AI — research pipeline (v3)

   One question → a researched, cited answer, streamed as it happens:

     1. understand  the question is matched against our own dataset (926
                    universities, their cities) and a small, fast model plans
                    the searches (what to look for, where, which subreddits).
     2. gather      in parallel, all with short timeouts and a 3-hour cache:
                      • Reddit — threads from the last ~18 months (Reddit's own
                        search + the Arctic Shift archive), then the comments in
                        the best threads (most upvoted first)
                      • news — Google News for the last 6 months, plus the
                        stories our daily news agent saved
                      • reviews — 748 real reviews from WhatUni, StudentCrowd,
                        EDUopinions and Appily (collected June 2026)
                      • facts — fees, selectivity, city costs from our dataset
     3. rank        lexical relevance × recency × upvotes, with a quota per
                    source so no single thread drowns the rest.
     4. answer      a large reasoning model weighs the evidence (recency,
                    agreement, how many independent voices, news vs opinion)
                    and writes a short answer with [n] citations and a
                    confidence line. Its reasoning streams to the page.

   No vector database and no extra keys: only the Groq/OpenAI key the app
   already uses. Every outside source is optional — if one is down the answer
   says what it could and couldn't check.
   ──────────────────────────────────────────────────────────────────────────── */
const fs = require('fs');
const path = require('path');
const synth = require('./synthesize');

const DATA_DIR = path.join(__dirname, '..', 'design', 'data');
const NEWS_DIR = path.join(__dirname, 'data', 'news');
const CORPUS = path.join(__dirname, 'data', 'comments.json');
const CODES = ['gb', 'us', 'ch', 'nl', 'se', 'de', 'fr', 'it', 'es', 'ie', 'dk', 'fi', 'be', 'pt', 'ua'];
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) UniVersityResearch/3.0' };
const DAY = 864e5;
const PLAN_MODEL = process.env.AI_PLAN_MODEL || 'openai/gpt-oss-20b';
const ANSWER_MODEL = process.env.AI_ANSWER_MODEL || null;   // null → the provider's default (gpt-oss-120b on Groq)

// where students talk, per country (the planner can add a university's own subreddit)
const COUNTRY_SUBS = {
  gb: ['UniUK'], us: ['ApplyingToCollege', 'college'], de: ['germany'], nl: ['Netherlands'], ch: ['Switzerland'],
  it: ['Italia', 'italy'], es: ['GoingToSpain'], fr: ['france'], ie: ['ireland'], se: ['sweden'], dk: ['Denmark'],
  fi: ['Finland'], be: ['belgium'], pt: ['PortugalExpats'], ua: ['ukraine'],
};
const GENERAL_SUBS = ['studyAbroad', 'InternationalStudents', 'gradadmissions'];
const STUDY_SUBS = /^(uni|study|college|grad|applying|international|student|phd|academia|ask|europe|expat|move|living|cscareer|engineering|law|med|premed)/i;

/* ── small utils ─────────────────────────────────────────────────── */
const cache = new Map();
function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.p;
  const p = Promise.resolve().then(fn).catch(function (e) { cache.delete(key); throw e; });
  cache.set(key, { t: Date.now(), p });
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return p;
}
async function getText(url, ms) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(ms || 8000) });
  if (!r.ok) { const e = new Error('HTTP ' + r.status + ' ' + (await r.text().catch(function () { return ''; })).slice(0, 80)); e.status = r.status; throw e; }
  return r.text();
}
async function getJSON(url, ms) {
  const t = await getText(url, ms);
  const j = JSON.parse(t);
  if (j && j.error && !j.data) throw new Error(String(j.error));
  return j;
}
// The free archives (Arctic Shift, PullPush) and Reddit's RSS refuse bursts —
// one queue per host: at most 2 requests in flight, spaced out, retried on "slow down".
const queues = {};
function polite(host, fn, opts) {
  opts = opts || {};
  const qu = queues[host] || (queues[host] = { busy: 0, last: 0, wait: [] });
  const gap = opts.gap || 300, conc = opts.conc || 2;
  return new Promise(function (resolve, reject) {
    qu.wait.push(async function run() {
      qu.busy++;
      const pause = Math.max(0, qu.last + gap - Date.now()); qu.last = Date.now() + pause;
      if (pause) await new Promise(function (r) { setTimeout(r, pause); });
      let err = null;
      for (let i = 0; i <= (opts.retries == null ? 2 : opts.retries); i++) {
        try { const v = await fn(); qu.busy--; next(); return resolve(v); }
        catch (e) { err = e; if (!(e.status === 429 || e.status === 422 || /slow down|timeout/i.test(e.message))) break; await new Promise(function (r) { setTimeout(r, 900 * (i + 1)); }); }
      }
      qu.busy--; next(); reject(err);
    });
    next();
  });
  function next() { while (qu.busy < conc && qu.wait.length) qu.wait.shift()(); }
}
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
    .replace(/&amp;/g, '&');
}
function stripHtml(s) { return decode(decode(s)).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }
function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function iso(d) { return new Date(d).toISOString().slice(0, 10); }
function ageDays(t) { return Math.max(0, (Date.now() - t) / DAY); }

const STOP = new Set(('a an the and or but of in on at to for from with about into over under is are was were be been being do does did have has had ' +
  'i me my we our you your it its they them their this that these those what which who whom how why when where whats is there any some ' +
  'can could should would will shall may might must more most very really just also than then so if as by not no yes good bad best ' +
  'like get got go going want need think know tell say says said people student students uni university universities study studying').split(' '));
function tokens(s) { return norm(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !STOP.has(w); }); }

/* ── our dataset: universities + cities, with aliases ─────────────── */
let INDEX = null;
const UNI_WORDS = /\b(university|universit[aeyà]?|universidad|universidade|universita|universitat|universiteit|universite|college|institute|institut|school|polytechnic|politecnico|polytechnique|technical|technology|technische|hochschule|national|state|royal|federal|catholic|business|sciences?|studies|higher|education|academy|of|the|and|for|de|di|del|della|do|da|der|und|fur)\b/g;
function loadIndex() {
  if (INDEX) return INDEX;
  const unis = [], cities = [], countries = {};
  CODES.forEach(function (cc) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, cc + '.json'), 'utf8')); } catch (e) { return; }
    const meta = d.meta || {};
    countries[cc] = { cc, name: meta.name || cc.toUpperCase(), cur: meta.currencySymbol || '', about: meta.aboutStudying || '' };
    (d.universities || []).forEach(function (u) { unis.push(Object.assign({ cc, country: countries[cc].name }, u)); });
    Object.keys(d.cities || {}).forEach(function (n) { cities.push(Object.assign({ name: n, cc, country: countries[cc].name }, d.cities[n])); });
  });
  const seen = {};
  const GENERIC = new Set(('city open arts art design music central global international american european new free west east north south middle king kings queen queens ' +
    'union capital health medical medicine law management economics film fashion media sport sports british french german italian spanish swiss dutch irish catholic royal ' +
    'national federal technical technology science sciences business applied graduate research studies modern digital creative liberal public private institute academy ' +
    'conservatory polytechnic school college campus student students international').split(' '));
  function clean(x) { return norm(x).replace(UNI_WORDS, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  unis.forEach(function (u) {
    const city = norm(u.city), al = {};   // alias → weight bonus
    function add(x, bonus) { x = norm(x).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); if (x.length >= 3 && !GENERIC.has(x) && x !== city) al[x] = Math.max(al[x] || 0, bonus); }
    add(u.name, 2);
    String(u.name).split(/\s+[–—-]\s+/).forEach(function (part) { add(part, 1.5); const c = clean(part); if (c.length >= 4) add(c, 0); });
    const core = clean(u.name), noCity = core.replace(new RegExp('\\b' + esc(city) + '\\b', 'g'), ' ').replace(/\s+/g, ' ').trim();
    if (core.length >= 4) add(core, 0);
    if (noCity.length >= 4 && noCity !== core) add(noCity, 0);
    if (u.abbr && !/\d/.test(u.abbr) && u.abbr.length >= 3) add(u.abbr, 1);
    const tu = norm(u.name).match(/^(technical university( of)?|technische universitat) ([a-z]+)$/);
    if (tu) add('tu ' + tu[3], 1);
    u._al = Object.keys(al).map(function (k) { return [k, al[k]]; });
  });
  cities.forEach(function (c) { c._al = [norm(c.name)]; });
  INDEX = { unis, cities, countries };
  return INDEX;
}
function hit(q, alias) {
  if (!alias || alias.length < 3) return 0;
  return new RegExp('(^|[^a-z0-9])' + esc(alias) + '($|[^a-z0-9])').test(q) ? alias.length : 0;
}
// universities/cities named in the question (most specific first)
function detect(question) {
  const ix = loadIndex(), q = ' ' + norm(question).replace(/\s+/g, ' ') + ' ';
  const unis = [], cities = [];
  ix.unis.forEach(function (u) { let s = 0; u._al.forEach(function (a) { const h = hit(q, a[0]); if (h) s = Math.max(s, h + a[1]); }); if (s) unis.push({ u, s: s + (u.diff || 0) * .01 }); });
  const WORDY = /^(nice|bath|reading|cork|derby|split|mobile|florence|lincoln|march|deal|wells|bristol bay)$/;
  ix.cities.forEach(function (c) {
    const s = hit(q, c._al[0]); if (!s) return;
    if (WORDY.test(c._al[0]) && !new RegExp('\\b' + esc(c.name) + '\\b').test(question)) return;   // "nice" the word, not Nice the city
    cities.push({ c, s });
  });
  // "Manchester" alone names the city; "Manchester uni" (or the full name) names the university called after it
  const uniWord = /\b(uni|university|college|campus|course|degree|programme|program|faculty|lecturers?|professors?|admissions?|offer|entry|tuition)\b/.test(q);
  if (uniWord) cities.forEach(function (c) {
    ix.unis.forEach(function (u) {
      const core = norm(u.name).replace(UNI_WORDS, ' ').replace(/[^a-z0-9 ]+/g, ' ').trim();
      if (u.cc === c.c.cc && core === norm(c.c.name) && !unis.some(function (x) { return x.u === u; })) unis.push({ u, s: c.s - .5 });
    });
  });
  unis.sort(function (a, b) { return b.s - a.s; });
  const outU = [], used = {};
  const SUB = /(faculty|business school|school of management|campus|department)/i;
  unis.forEach(function (x) {
    if (used[x.u.name] || outU.length >= 3) return;
    // a faculty / business school only when its parent university didn't match too
    if (SUB.test(x.u.name) && unis.some(function (y) { return y !== x && y.u.city === x.u.city && !SUB.test(y.u.name) && y.s >= x.s - 1; })) return;
    used[x.u.name] = 1; outU.push(x.u);
  });
  const outC = cities.sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.c; })
    .filter(function (c, i, a) { return a.findIndex(function (y) { return y.name === c.name; }) === i; }).slice(0, 3);
  const cc = (outU[0] && outU[0].cc) || (outC[0] && outC[0].cc) || null;
  return { unis: outU, cities: outC, cc };
}

/* ── 1. understand: plan the searches ─────────────────────────────── */
async function plan(question, history, found) {
  const today = iso(Date.now());
  const named = found.unis.map(function (u) { return u.name + ' (' + u.city + ', ' + u.country + ')'; })
    .concat(found.cities.map(function (c) { return c.name + ' (city, ' + c.country + ')'; }));
  const prev = (history || []).slice(-2).map(function (h) { return 'Q: ' + clip(h.q, 200) + '\nA: ' + clip(h.a, 300); }).join('\n');
  const fallback = heuristicPlan(question, found);
  const client = await synth.getOpenAI();
  if (!client) return fallback;
  try {
    const r = await client.chat.completions.create({
      model: PLAN_MODEL, reasoning_effort: 'low', response_format: { type: 'json_object' }, max_tokens: 900, temperature: 0.2,
      messages: [
        { role: 'system', content:
          'You plan web research for a study-abroad assistant. Today is ' + today + '. Reply with JSON only:\n' +
          '{"in_scope":bool,"topic":"3-6 words","subject":"the main university/city/country in plain words or empty",' +
          '"keywords":["1-3 short words that must appear in a relevant Reddit post title, e.g. Manchester, ETH, Bocconi"],' +
          '"reddit_query":"what a student would type into Reddit search (no years)","subreddits":["0-3 subreddit names without r/, e.g. a university\'s own subreddit like UoM, ethz, TUM, oxforduni"],' +
          '"news_query":"Google News query (quote multi-word names, no years)","needs_news":bool,"standalone_question":"the question rewritten to stand alone using the conversation"}\n' +
          'in_scope is false only for things unrelated to universities, studying, student life, cities to live in, visas, careers after study or applications.' },
        { role: 'user', content: (prev ? 'Conversation so far:\n' + prev + '\n\n' : '') + 'Question: ' + question + (named.length ? '\nRecognised in our database: ' + named.join('; ') : '') },
      ],
    });
    const j = JSON.parse(r.choices[0].message.content || '{}');
    return {
      in_scope: j.in_scope !== false,
      topic: clip(j.topic || fallback.topic, 60),
      subject: clip(j.subject || fallback.subject, 80),
      keywords: (Array.isArray(j.keywords) ? j.keywords : []).map(String).filter(function (k) { return k && k.length <= 30; }).slice(0, 3),
      reddit_query: clip(j.reddit_query || fallback.reddit_query, 120),
      subreddits: (Array.isArray(j.subreddits) ? j.subreddits : []).map(function (s) { return String(s).replace(/^\/?r\//, '').replace(/[^A-Za-z0-9_]/g, ''); }).filter(Boolean).slice(0, 3),
      news_query: clip(j.news_query || fallback.news_query, 120),
      needs_news: j.needs_news !== false,
      standalone: clip(j.standalone_question || question, 300),
    };
  } catch (e) {
    return fallback;
  }
}
function heuristicPlan(question, found) {
  const subj = (found.unis[0] && found.unis[0].name) || (found.cities[0] && found.cities[0].name) || '';
  const kw = found.unis.map(function (u) { const c = norm(u.name).replace(UNI_WORDS, ' ').trim().split(/\s+/)[0]; return c || u.city; })
    .concat(found.cities.map(function (c) { return c.name; })).filter(Boolean);
  return { in_scope: true, topic: clip(question, 60), subject: subj, keywords: kw.slice(0, 3), reddit_query: clip(question, 120), subreddits: [],
    news_query: subj ? '"' + subj + '"' : clip(question, 80), needs_news: true, standalone: question };
}

/* ── 2. gather ───────────────────────────────────────────────────── */
// Reddit's own search (RSS) — good at relevance
async function redditSearch(q) {
  const url = 'https://www.reddit.com/search.rss?q=' + encodeURIComponent(q) + '&sort=relevance&t=year&type=link&limit=25';
  const xml = await cached('rss:' + q, 3 * 3600e3, function () { return polite('reddit', function () { return getText(url, 7000); }, { conc: 1, gap: 1200, retries: 1 }); });
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)).map(function (m) {
    const e = m[1], link = ((e.match(/<link href="([^"]+)"/) || [])[1] || '').replace(/&amp;/g, '&');
    const id = (link.match(/\/comments\/([a-z0-9]+)\//) || [])[1];
    if (!id) return null;
    return { id, title: stripHtml((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]), sub: (e.match(/<category term="([^"]+)"/) || [])[1] || '',
      t: Date.parse((e.match(/<published>(.*?)<\/published>/) || e.match(/<updated>(.*?)<\/updated>/) || [])[1]) || 0,
      text: clip(stripHtml((e.match(/<content type="html">([\s\S]*?)<\/content>/) || [])[1]).replace(/submitted by\s+\/u\/\S+.*$/i, ''), 600),
      url: link, score: null, via: 'reddit' };
  }).filter(Boolean);
}
// Arctic Shift archive — the newest posts in a subreddit whose title mentions a keyword
async function arcticPosts(sub, kw) {
  const after = iso(Date.now() - 540 * DAY);
  const url = 'https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=' + encodeURIComponent(sub) + '&title=' + encodeURIComponent(kw) + '&after=' + after + '&limit=20&sort=desc';
  const j = await cached('ap:' + sub + ':' + kw, 3 * 3600e3, function () { return polite('arctic', function () { return getJSON(url, 8000); }); });
  return (j.data || []).map(function (p) {
    return { id: p.id, title: decode(p.title), sub: p.subreddit, t: p.created_utc * 1000, text: clip(decode(p.selftext || '').replace(/\[(removed|deleted)\]/g, ''), 600),
      url: 'https://www.reddit.com' + (p.permalink || '/comments/' + p.id), score: p.score, comments: p.num_comments, via: 'arctic' };
  });
}
// PullPush — a second archive, used when Reddit's own search is rate-limited
async function pullpushPosts(q) {
  const after = Math.floor((Date.now() - 540 * DAY) / 1000);
  const url = 'https://api.pullpush.io/reddit/search/submission/?q=' + encodeURIComponent(q) + '&size=40&after=' + after;
  const j = await cached('pp:' + q, 3 * 3600e3, function () { return polite('pullpush', function () { return getJSON(url, 9000); }, { conc: 1 }); });
  return (j.data || []).map(function (p) {
    return { id: p.id, title: decode(p.title), sub: p.subreddit, t: p.created_utc * 1000, text: clip(decode(p.selftext || '').replace(/\[(removed|deleted)\]/g, ''), 600),
      url: 'https://www.reddit.com' + (p.permalink || '/comments/' + p.id), score: p.score, comments: p.num_comments, via: 'pullpush' };
  });
}
// the comments under one thread (Arctic Shift), flattened, best first
async function threadComments(id) {
  const url = 'https://arctic-shift.photon-reddit.com/api/comments/tree?link_id=t3_' + id + '&limit=80';
  const j = await cached('tree:' + id, 3 * 3600e3, function () { return polite('arctic', function () { return getJSON(url, 9000); }); });
  const out = [];
  (function walk(list, depth) {
    (list || []).forEach(function (x) {
      const d = x && x.data; if (!d) return;
      if (d.body && !/^\[(removed|deleted)\]$/.test(d.body) && d.author !== 'AutoModerator') {
        out.push({ id: d.id, text: clip(decode(d.body).replace(/\s+/g, ' '), 650), t: d.created_utc * 1000, score: d.score || 0, depth,
          url: 'https://www.reddit.com' + (d.permalink || ''), sub: d.subreddit });
      }
      if (d.replies && d.replies.data) walk(d.replies.data.children, depth + 1);
    });
  })(j.data, 0);
  return out;
}
async function gatherReddit(p, found, emit) {
  // short, distinctive words to look for in titles: abbreviations first (ETH, TUM, UCL), then names
  const abbr = found.unis.map(function (u) { return /^[A-Za-z]{2,6}$/.test((u.abbr || '').replace(/ .*/, '')) ? u.abbr.replace(/ .*/, '') : null; }).filter(Boolean);
  const kws = Array.from(new Set(p.keywords.concat(abbr).concat(heuristicPlan('', found).keywords))).filter(Boolean).slice(0, 4);
  const subs = Array.from(new Set(p.subreddits.concat(COUNTRY_SUBS[found.cc] || []).concat(found.cc ? [] : GENERAL_SUBS.slice(0, 1)))).slice(0, 3);
  const jobs = [within(redditSearch(p.reddit_query), 5000, null)];
  subs.forEach(function (s, i) { const k = kws[i % Math.max(1, kws.length)] || tokens(p.reddit_query)[0]; if (k) jobs.push(within(arcticPosts(s, k), 5500, [])); });
  const lists = await Promise.all(jobs);
  if (!lists[0] || !lists[0].length) lists.push(await within(pullpushPosts(p.reddit_query), 4000, []));
  lists[0] = lists[0] || [];
  const byId = {};
  lists.forEach(function (l) { l.forEach(function (x) { if (!byId[x.id]) byId[x.id] = x; else if (x.score != null) Object.assign(byId[x.id], { score: x.score, comments: x.comments }); }); });
  const qTok = tokens(p.standalone + ' ' + p.reddit_query);
  const kwN = Array.from(new Set(kws.map(norm).concat(kws.map(norm).join(' ').split(/\s+/)))).filter(function (k) { return k.length >= 3 && !STOP.has(k); });
  let posts = Object.keys(byId).map(function (k) { return byId[k]; }).filter(function (x) {
    const hay = ' ' + norm(x.title + ' ' + x.text).replace(/[^a-z0-9]+/g, ' ') + ' ';
    if (kwN.length && !kwN.some(function (k) { return hay.indexOf(' ' + k + ' ') !== -1; })) return false;
    return !x.sub || STUDY_SUBS.test(x.sub) || subs.map(norm).indexOf(norm(x.sub)) !== -1 || kwN.some(function (k) { return norm(x.sub).indexOf(k) !== -1; }) || x.via === 'reddit';
  });
  posts.forEach(function (x) {
    const lex = overlap(qTok, tokens(x.title + ' ' + x.text));
    x.rank = lex * 2 + Math.exp(-ageDays(x.t) / 300) + Math.log1p(x.comments || x.score || 0) / 6 + (x.via === 'reddit' ? .3 : 0);
  });
  posts.sort(function (a, b) { return b.rank - a.rank; });
  posts = posts.slice(0, 8);
  emit({ type: 'stage', id: 'reddit', state: 'run', detail: posts.length ? 'Reading ' + Math.min(3, posts.length) + ' threads' : 'No recent threads found' });
  const top = posts.slice(0, 3);
  const trees = await Promise.all(top.map(function (x) { return within(threadComments(x.id), 6000, []); }));
  const comments = [];
  trees.forEach(function (list, i) {
    const post = top[i];
    list.filter(function (c) { return c.text.length >= 35; })
      .sort(function (a, b) { return (b.score - a.score) || (b.t - a.t); }).slice(0, 7)
      .forEach(function (c) { comments.push(Object.assign(c, { thread: post.title, sub: c.sub || post.sub })); });
  });
  return { posts, comments };
}
function within(p, ms, fallback) {   // whatever isn't back in time is skipped
  return Promise.race([p.catch(function () { return fallback; }), new Promise(function (r) { setTimeout(function () { r(fallback); }, ms); })]);
}
function overlap(q, d) {
  if (!q.length || !d.length) return 0;
  const set = new Set(d); let n = 0;
  q.forEach(function (w) { if (set.has(w)) n++; });
  return n / Math.sqrt(q.length * Math.max(4, set.size) / 4);
}
async function gatherNews(p, found) {
  const out = [];
  const q = p.news_query || p.subject;
  if (q) {
    try {
      const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:180d') + '&hl=en-GB&gl=GB&ceid=GB:en';
      const xml = await cached('gn:' + q, 3 * 3600e3, function () { return getText(url, 7000); });
      Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).slice(0, 30).forEach(function (m) {
        const it = m[1], title = stripHtml((it.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
        const src = stripHtml((it.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1]);
        out.push({ title: src ? title.replace(new RegExp('\\s+-\\s+' + esc(src) + '$'), '') : title, site: src || 'News', t: Date.parse((it.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1]) || 0,
          url: decode((it.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim(), text: '' });
      });
    } catch (e) { /* offline or blocked — the answer will say news wasn't checked */ }
  }
  // stories our daily agent already curated (with summaries)
  try {
    const files = fs.readdirSync(NEWS_DIR).filter(function (f) { return /\.json$/.test(f); }).sort().slice(-14);
    const keys = (p.keywords || []).concat(found.unis.map(function (u) { return u.name; })).concat(found.cities.map(function (c) { return c.name; })).map(norm).filter(function (k) { return k.length >= 3; });
    if (keys.length) files.forEach(function (f) {
      const d = JSON.parse(fs.readFileSync(path.join(NEWS_DIR, f), 'utf8'));
      (d.items || []).concat(d.pool || []).forEach(function (s) {
        const hay = norm(s.title + ' ' + (s.subtitle || '') + ' ' + (s.detail || ''));
        if (keys.some(function (k) { return hay.indexOf(k) !== -1; })) out.push({ title: s.title, site: s.source || 'UniVersity news', t: Date.parse(s.date || d.date) || Date.parse(f.slice(0, 10)), url: s.url || null, text: clip(s.detail || s.subtitle || '', 400) });
      });
    });
  } catch (e) { /* no archive yet */ }
  const qTok = tokens(p.standalone + ' ' + q), seen = {};
  return out.filter(function (n) { const k = norm(n.title).slice(0, 60); if (seen[k]) return false; seen[k] = 1; return n.title; })
    .map(function (n) { n.rank = overlap(qTok, tokens(n.title + ' ' + n.text)) * 2 + Math.exp(-ageDays(n.t) / 90); return n; })
    .sort(function (a, b) { return b.rank - a.rank; }).slice(0, 7);
}
let CORPUS_CACHE = null;
function gatherReviews(p, found) {
  if (!CORPUS_CACHE) { try { CORPUS_CACHE = JSON.parse(fs.readFileSync(CORPUS, 'utf8')); } catch (e) { CORPUS_CACHE = []; } }
  const names = found.unis.map(function (u) { return norm(u.name); }).concat(found.cities.map(function (c) { return norm(c.name); }));
  const kws = (p.keywords || []).map(norm);
  const qTok = tokens(p.standalone);
  let pool = CORPUS_CACHE.filter(function (c) {
    const n = norm(c.name);
    return names.some(function (x) { return x === n || n.indexOf(x) !== -1 || x.indexOf(n) !== -1; }) || kws.some(function (k) { return k.length >= 4 && n.indexOf(k) !== -1; });
  });
  if (!pool.length && !names.length) pool = CORPUS_CACHE;   // a general question: search everything
  return pool.map(function (c) { return { text: clip(c.text, 520), site: c.source || 'Review', name: c.name, url: c.url || null, rank: overlap(qTok, tokens(c.text)) + Math.random() * .01 }; })
    .sort(function (a, b) { return b.rank - a.rank; }).slice(0, 8);
}
function gatherFacts(found) {
  const ix = loadIndex(), out = [];
  found.unis.forEach(function (u) {
    out.push(u.name + ' — ' + u.city + ', ' + u.country + ' · ' + (u.type || '') + ' · ' + (u.dl || '') + ' · tuition ' + (u.tuition || 'n/a') +
      (u.students ? ' · ' + u.students + ' students' : '') + (u.founded ? ' · founded ' + u.founded : '') + (u.fields ? ' · strong in ' + [].concat(u.fields).slice(0, 5).join(', ') : '') +
      (u.desc ? ' · ' + clip(u.desc, 220) : ''));
  });
  const cityNames = found.cities.map(function (c) { return c.name; });
  found.unis.forEach(function (u) { if (cityNames.indexOf(u.city) === -1 && cityNames.length < 3) { const c = ix.cities.find(function (x) { return x.name === u.city && x.cc === u.cc; }); if (c) { found.cities.push(c); cityNames.push(c.name); } } });
  found.cities.forEach(function (c) {
    out.push(c.name + ' (city, ' + c.country + ') — living costs ' + (c.cost || 'n/a') + ' · population ' + (c.pop || 'n/a') + ' · climate ' + (c.climate || 'n/a') + (c.desc ? ' · ' + clip(c.desc, 220) : ''));
  });
  return out.slice(0, 6);
}

/* ── 3 + 4. evaluate and answer ──────────────────────────────────── */
const SYSTEM =
  'You are UniVersity AI, a sharp, honest study-abroad advisor. You research before you answer: you are given live Reddit threads and comments, ' +
  'recent news, review-site opinions and facts from the UniVersity database, each numbered. Today is {TODAY}.\n\n' +
  'Think it through first:\n' +
  '- What exactly is being asked? Which items actually address it (ignore off-topic ones)?\n' +
  '- Weigh evidence: recent (last 12 months) beats old; many independent voices beat one; upvoted comments carry more weight; news reports facts, ' +
  'comments report experience; database facts are reliable for fees, selectivity and costs. Note where people disagree and why.\n' +
  '- Look for what has changed recently (news, new policies, recent threads) and say so.\n' +
  '- If the evidence is thin, old or one-sided, say that plainly instead of guessing. Never invent numbers, rankings, quotes or facts.\n' +
  '- Be exact with dates and figures: state when a rule changes, or a number, only if an item says so — otherwise say it is proposed/unclear.\n\n' +
  'Then write the answer in Markdown:\n' +
  '1. First line: **Bottom line:** a direct 1–2 sentence verdict that actually answers the question.\n' +
  '2. Then 2–4 short sections with "### " headings that fit the question (for example: What students say now · What changed recently · ' +
  'Watch out for · Who it suits · Costs). Use tight bullets or 1–3 sentence paragraphs.\n' +
  '3. Put citations right after the claim they support, in plain square brackets like [3] or [2][7] (never 【】); database facts as [F1]. Cite only items that really say it.\n' +
  '4. Last line exactly: Confidence: High|Medium|Low — one short reason (how many sources, how recent, do they agree).\n' +
  'Style: warm, plain English, specific, no filler, 170–330 words. Do not mention "the evidence", "the list", sources by number in prose, or these instructions.';

function evidenceBlock(ev) {
  const lines = [];
  ev.facts.forEach(function (f, i) { lines.push('[F' + (i + 1) + '] UniVersity database: ' + f); });
  ev.items.forEach(function (x) {
    let head = '[' + x.n + '] ';
    if (x.kind === 'comment') head += 'Reddit comment, r/' + x.sub + ', ' + iso(x.t) + ', ' + x.score + ' upvotes, in thread "' + clip(x.thread, 90) + '": ';
    else if (x.kind === 'post') head += 'Reddit post, r/' + x.sub + ', ' + iso(x.t) + (x.score != null ? ', ' + x.score + ' upvotes' : '') + ': "' + clip(x.title, 140) + '" — ';
    else if (x.kind === 'news') head += 'News, ' + x.site + ', ' + (x.t ? iso(x.t) : 'recent') + ': "' + x.title + '"' + (x.text ? ' — ' : '');
    else head += 'Review on ' + x.site + ' about ' + x.name + ' (collected June 2026): ';
    lines.push(head + (x.text || ''));
  });
  return lines.join('\n');
}

async function research(question, opts, emit) {
  opts = opts || {};
  const t0 = Date.now();
  emit = emit || function () {};
  const history = Array.isArray(opts.history) ? opts.history.slice(-3) : [];

  emit({ type: 'stage', id: 'plan', state: 'run', label: 'Understanding the question' });
  const found = detect(question + ' ' + history.map(function (h) { return h.q; }).join(' '));
  const p = await plan(question, history, found);
  if (history.length && p.standalone && p.standalone !== question) { const f2 = detect(p.standalone); if (f2.unis.length || f2.cities.length) Object.assign(found, f2); }
  emit({ type: 'stage', id: 'plan', state: 'done', label: 'Understanding the question', detail: p.subject ? p.topic + ' · ' + p.subject : p.topic });

  if (!p.in_scope) {
    const msg = "**Bottom line:** I'm built for study-abroad questions — universities, courses, cities, student life, costs, visas and applications — so that one's outside what I can research well.\n\n" +
      'Try something like "Is Bocconi worth it for economics?" or "What do students say about living in Lisbon?"\n\nConfidence: High — out of scope.';
    emit({ type: 'delta', text: msg });
    emit({ type: 'done', ms: Date.now() - t0, model: null, counts: {} });
    return { answer: msg, sources: [] };
  }

  emit({ type: 'stage', id: 'reddit', state: 'run', label: 'Reading Reddit — last 18 months' });
  emit({ type: 'stage', id: 'news', state: 'run', label: 'Scanning news — last 6 months' });
  emit({ type: 'stage', id: 'reviews', state: 'run', label: 'Checking student reviews' });
  const [rd, news] = await Promise.all([
    gatherReddit(p, found, emit).catch(function () { return { posts: [], comments: [], failed: true }; }),
    p.needs_news ? gatherNews(p, found).catch(function () { return []; }) : Promise.resolve([]),
  ]);
  const reviews = gatherReviews(p, found);
  const facts = gatherFacts(found);
  emit({ type: 'stage', id: 'reddit', state: 'done', label: 'Reading Reddit — last 18 months',
    detail: rd.failed ? 'Reddit unreachable right now' : (rd.comments.length + ' comments from ' + Math.min(3, rd.posts.length) + ' threads' + (rd.posts.length ? ' · newest ' + rel(Math.max.apply(null, rd.posts.map(function (x) { return x.t; }))) : '')) });
  emit({ type: 'stage', id: 'news', state: 'done', label: 'Scanning news — last 6 months', detail: p.needs_news ? news.length + ' stories' : 'Not needed' });
  emit({ type: 'stage', id: 'reviews', state: 'done', label: 'Checking student reviews', detail: reviews.length + ' reviews' + (facts.length ? ' · ' + facts.length + ' facts from our data' : '') });

  // pick the evidence: quotas per source, best first
  const qTok = tokens(p.standalone + ' ' + p.topic);
  const cmts = rd.comments.map(function (c) { c.rank = overlap(qTok, tokens(c.text)) + Math.log1p(Math.max(0, c.score)) / 3 + Math.exp(-ageDays(c.t) / 365) - c.depth * .08; return c; })
    .sort(function (a, b) { return b.rank - a.rank; }).slice(0, 16);
  const items = [];
  rd.posts.slice(0, 4).forEach(function (x) { items.push({ kind: 'post', title: x.title, text: clip(x.text, 380), sub: x.sub, t: x.t, score: x.score, url: x.url }); });
  cmts.forEach(function (c) { items.push({ kind: 'comment', text: c.text, sub: c.sub, t: c.t, score: c.score, url: c.url, thread: c.thread }); });
  news.forEach(function (n) { items.push({ kind: 'news', title: n.title, text: n.text, site: n.site, t: n.t, url: n.url }); });
  reviews.forEach(function (r) { items.push({ kind: 'review', text: r.text, site: r.site, name: r.name, url: r.url }); });
  items.forEach(function (x, i) { x.n = i + 1; });
  const sources = items.map(function (x) {
    return { n: x.n, kind: x.kind, title: x.kind === 'comment' ? clip(x.text, 140) : x.kind === 'review' ? clip(x.text, 140) : x.title,
      where: x.kind === 'news' ? x.site : x.kind === 'review' ? x.site + ' · ' + x.name : 'r/' + x.sub, date: x.t ? iso(x.t) : null, score: x.score != null ? x.score : null, url: x.url || null };
  });
  emit({ type: 'sources', items: sources, facts: facts });

  const client = await synth.getOpenAI();
  if (!client) {
    const msg = '**Bottom line:** The AI model isn\'t configured on the server, so here is what I found without a summary.\n\n' +
      items.slice(0, 8).map(function (x) { return '- ' + clip(x.title || x.text, 200) + ' [' + x.n + ']'; }).join('\n') + '\n\nConfidence: Low — no model to weigh the evidence.';
    emit({ type: 'delta', text: msg }); emit({ type: 'done', ms: Date.now() - t0, model: null, counts: counts() });
    return { answer: msg, sources };
  }
  function counts() { return { reddit: rd.comments.length + Math.min(4, rd.posts.length), news: news.length, reviews: reviews.length, facts: facts.length }; }

  emit({ type: 'stage', id: 'think', state: 'run', label: 'Weighing the evidence' });
  const provider = synth.resolveProvider();
  const model = ANSWER_MODEL || (provider && provider.model) || synth.MODEL;
  const prev = history.map(function (h) { return [{ role: 'user', content: clip(h.q, 400) }, { role: 'assistant', content: clip(h.a, 900) }]; }).reduce(function (a, b) { return a.concat(b); }, []);
  const user = 'Question: ' + question + (p.standalone !== question ? '\n(Meaning: ' + p.standalone + ')' : '') + '\n\n' +
    (items.length || facts.length ? 'Research results:\n' + evidenceBlock({ items, facts }) :
      'Research results: nothing relevant was found on Reddit, in the news or in the reviews.') +
    (rd.failed ? '\n(Reddit could not be reached for this question.)' : '') +
    '\n\nAnswer now.';
  const params = {
    model, stream: true, temperature: 0.4, max_tokens: 12000,
    messages: [{ role: 'system', content: SYSTEM.replace('{TODAY}', iso(Date.now())) }].concat(prev).concat([{ role: 'user', content: user }]),
  };
  if (/gpt-oss/.test(model)) params.reasoning_effort = opts.deep ? 'high' : 'medium';
  let answer = '', thinking = '', thinkStart = Date.now(), wrote = false, lastFlush = 0, buf = '';
  async function run(prm) {
    const stream = await client.chat.completions.create(prm, opts.signal ? { signal: opts.signal } : undefined);
    for await (const ch of stream) {
      const d = (ch.choices && ch.choices[0] && ch.choices[0].delta) || {};
      if (d.reasoning) {
        thinking += d.reasoning; buf += d.reasoning;
        if (Date.now() - lastFlush > 120) { emit({ type: 'thinking', text: buf }); buf = ''; lastFlush = Date.now(); }
      }
      if (d.content) {
        if (!wrote) {
          wrote = true;
          if (buf) { emit({ type: 'thinking', text: buf }); buf = ''; }
          emit({ type: 'stage', id: 'think', state: 'done', label: 'Weighing the evidence', detail: 'Thought for ' + Math.max(1, Math.round((Date.now() - thinkStart) / 1000)) + 's' });
          emit({ type: 'stage', id: 'write', state: 'run', label: 'Writing the answer' });
        }
        answer += d.content;
        emit({ type: 'delta', text: d.content });
      }
    }
  }
  await run(params);
  if (!answer.trim()) {
    // it thought itself out of room — answer again, briefly, from the same research
    emit({ type: 'thinking', text: '\n\n— wrapping up —\n' });
    await run(Object.assign({}, params, { reasoning_effort: /gpt-oss/.test(model) ? 'low' : undefined, max_tokens: 3000 }));
  }
  emit({ type: 'stage', id: 'write', state: 'done', label: 'Writing the answer' });
  emit({ type: 'done', ms: Date.now() - t0, model, counts: counts(), thoughtMs: wrote ? null : Date.now() - thinkStart });
  return { answer: answer.trim().replace(/【([^】]{1,6})】/g, '[$1]'), sources, facts, thinking };
}
function rel(t) {
  const d = Math.round(ageDays(t));
  return d <= 1 ? 'today' : d < 14 ? d + ' days ago' : d < 60 ? Math.round(d / 7) + ' weeks ago' : Math.round(d / 30) + ' months ago';
}

module.exports = { research, detect, plan, loadIndex, net: { polite, getJSON, getText, cached, decode, stripHtml } };
