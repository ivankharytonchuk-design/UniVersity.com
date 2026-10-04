'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   Admissions research — a background job that finds PUBLIC applicant
   self-reports ("I got into X with 38 IB") and turns them into reviewable
   records. Nothing it finds is published until an admin approves it.

   One job = one university (+ optional programme). Per job:
     1. search   Arctic Shift (public Reddit archive): comments + posts in the
                 communities where applicants post results, for the
                 university's names; Reddit's own search for the classic
                 combinations ("<uni> accepted IB", "<uni> rejected", …); and,
                 if BRAVE_SEARCH_API_KEY is set, the open web (blogs, forums,
                 university pages — robots.txt respected).
     2. filter   keep only text that names the university, states a decision
                 and contains a grade-like token, written in the first person.
                 Sources already processed are never fetched again.
     3. extract  a small model returns ONLY what the author explicitly wrote
                 (null when not stated) plus an exact quote. Each outcome is
                 then re-checked in code: the quote must be in the text, the
                 score must be in the text, the decision words must agree and
                 the university must resolve to our dataset.
     4. store    de-identified (no usernames, links or e-mails in quotes),
                 duplicate-checked, confidence-scored, status = pending.

   Jobs run one at a time in-process, are persisted in adm_research_jobs (a
   crash re-queues them) and a university is not re-searched within 21 days.
   ──────────────────────────────────────────────────────────────────────────── */
const crypto = require('crypto');

module.exports = function createResearch(ctx) {
  const { q, T, log, errlog, ingest, upsertSource, UNI, Q, scrub } = ctx;
  const R = require('./research');
  const { polite, getJSON, getText, cached, decode, stripHtml } = R.net;
  const DAY = 864e5;
  const MODEL = process.env.AI_PLAN_MODEL || 'openai/gpt-oss-20b';
  const AUTO = process.env.ADM_AUTO_RESEARCH !== '0';
  const AUTO_PUBLISH = process.env.ADM_AUTO_PUBLISH !== '0';   // clean, double-checked reports go live without waiting for an admin
  const JUDGE_MODEL = process.env.AI_JUDGE_MODEL || 'openai/gpt-oss-120b';
  const BRAVE = process.env.BRAVE_SEARCH_API_KEY || '';
  const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; UniVersityResearch/3.0; admissions data)' };
  const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const hid = (p) => p + crypto.randomBytes(8).toString('hex');
  const iso = (t) => new Date(t).toISOString().slice(0, 10);

  // where applicants post results
  const SUBS = {
    gb: ['6thForm', 'UniUK', 'IBO'], us: ['collegeresults', 'ApplyingToCollege', 'IBO'], nl: ['TUDelft', 'Netherlands', 'IBO'],
    de: ['germany', 'IBO', 'studyAbroad'], ch: ['ETHZurich', 'EPFL', 'IBO'], it: ['bocconi', 'italy', 'IBO'], es: ['GoingToSpain', 'IBO'],
    fr: ['france', 'IBO'], ie: ['LeavingCert', 'ireland', 'IBO'], se: ['sweden', 'IBO'], dk: ['Denmark', 'IBO'], fi: ['Finland', 'IBO'],
    be: ['belgium', 'IBO'], pt: ['portugal', 'IBO'], ua: ['ukraine', 'IBO'],
  };
  const GRAD_SUBS = ['gradadmissions', 'MBA'];
  const DEC_RX = /\b(accepted|admitted|admission offer|got (in|into|an offer|a place)|offer(s|ed)? (from|at|for)|(received|got) (an |my )?offer|rejected|rejection|denied|waitlist(ed)?|wait-?list(ed)?|reserve list|unsuccessful|deferred|got a place)\b/i;
  const SCORE_RX = /(\b[1-4]\d\b[^.\n]{0,24}\b(ib|points|pts)\b|\b\d{2}\s*(\/\s*45|points|pts)\b|\bib\b\s*:?\s*\d{2}\b|\b\d{2}\s*ib\b|predicted\s*\d{2}|a\*|\b[a-e]{3}\b|\bgpa\b|\b[1-4]\.\d{1,2}\b|\b\d{2,3}(\.\d)?\s*%|\b\d{1,2}([.,]\d{1,2})?\s*\/\s*(10|20)\b|\bsat\b|\babitur\b|\bvwo\b|\bcao\b|leaving cert|maturit|selectividad|\bevau\b|\bpau\b|\bnmt\b)/i;
  const FIRST_RX = /\b(i|i'm|im|i've|ive|i got|my|me)\b/i;
  const ACCEPT_RX = /accept|admit|offer|got (in|into|a place)|place at|\bin at\b|got into/i, REJECT_RX = /reject|denied|unsuccessful|didn'?t get|did not get|not (be )?offered|no offer/i, WAIT_RX = /wait-?list|reserve list|deferred/i;

  /* ── names to search for ─────────────────────────────────────────── */
  function terms(u) {
    const out = [];
    const add = (t) => { t = clip(t, 60); if (t.length >= 2 && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t); };
    // a proper acronym ("UCL", "TU Delft") first; a nickname ("Cantab") only after the plain name
    const acro = u.abbr && /^[A-Za-z][A-Za-z .&'/-]{1,12}$/.test(u.abbr) && !/^(UNI|UNIV|U)$/i.test(u.abbr) ? u.abbr : null;
    const core = String(u.name).split(/\s+[–—-]\s+/)[0].replace(/\b(the|university|universit[aeyà]|universidad|universidade|universiteit|université|universität|of|technology|college|institute|school|di|de|del|degli|studi|und|für)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (acro && (/^[A-Z/]{2,6}$/.test(acro.replace(/\s/g, '')) || /\s/.test(acro))) add(acro);
    if (core.length >= 4 && core.split(' ').length <= 3) add(core);
    if (acro) add(acro);
    (u._al || []).filter((a) => a[1] >= 1 && a[0].length <= 30).forEach((a) => add(a[0]));
    add(u.name);
    return out.slice(0, 4);
  }
  function termRx(list) { return new RegExp('(^|[^a-z0-9])(' + list.map((t) => t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')($|[^a-z0-9])', 'i'); }

  /* ── fetchers ────────────────────────────────────────────────────── */
  const AFTER = () => iso(Date.now() - 3 * 365 * DAY);
  const MAX_AGE = 5 * 365 * DAY;   // admissions change — older posts are ignored
  // The archive throttles bursts ("Timeout. Maybe slow down a bit"): one request at a time, ~2.5 s apart,
  // long back-off, and after 3 throttles in a row the job stops asking and is marked partial.
  let throttled = 0;
  async function arctic(url) {
    if (throttled >= 3) { const e = new Error('throttled'); e.throttled = true; throw e; }
    try { const j = await polite('arctic-adm', () => getJSON(url, 20000), { gap: 2500, conc: 1, retries: 0 }); throttled = 0; return j; }
    catch (e) {
      if (!(e.status === 422 || e.status === 429 || /slow down|timeout/i.test(e.message))) throw e;
      throttled++; await new Promise((r) => setTimeout(r, 15000 * throttled));
      if (throttled >= 3) { e.throttled = true; throw e; }
      return arctic(url);
    }
  }
  async function arcticComments(sub, term) {
    const url = 'https://arctic-shift.photon-reddit.com/api/comments/search?subreddit=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(term) + '&after=' + AFTER() + '&limit=100';
    const j = await cached('adm:c:' + sub + ':' + term, 12 * 3600e3, () => arctic(url));
    return (j.data || []).filter((c) => c.body && !/^\[(removed|deleted)\]$/.test(c.body) && c.author !== 'AutoModerator').map((c) => ({
      id: 'c_' + c.id, kind: 'comment', sub: c.subreddit, t: c.created_utc * 1000, title: '', text: clip(decode(c.body), 3000),
      url: 'https://www.reddit.com' + (c.permalink || ('/comments/' + String(c.link_id || '').replace(/^t3_/, '') + '/_/' + c.id)),
    }));
  }
  async function arcticPosts(sub, term) {
    const url = 'https://arctic-shift.photon-reddit.com/api/posts/search?subreddit=' + encodeURIComponent(sub) + '&query=' + encodeURIComponent(term) + '&after=' + AFTER() + '&limit=100';
    const j = await cached('adm:p:' + sub + ':' + term, 12 * 3600e3, () => arctic(url));
    return (j.data || []).map((p) => ({ id: 'p_' + p.id, kind: 'post', sub: p.subreddit, t: p.created_utc * 1000, title: decode(p.title || ''),
      text: clip(decode(p.title || '') + '\n' + decode(p.selftext || '').replace(/\[(removed|deleted)\]/g, ''), 4000), url: 'https://www.reddit.com' + (p.permalink || '/comments/' + p.id) }));
  }
  // PullPush — a second public archive, used when Arctic Shift is throttling us
  const PP_AFTER = () => Math.floor((Date.now() - 3 * 365 * DAY) / 1000);
  async function pullpushComments(sub, term) {
    const url = 'https://api.pullpush.io/reddit/search/comment/?q=' + encodeURIComponent(term) + '&subreddit=' + encodeURIComponent(sub) + '&size=100&after=' + PP_AFTER();
    const j = await cached('adm:ppc:' + sub + ':' + term, 12 * 3600e3, () => polite('pullpush', () => getJSON(url, 15000), { conc: 1, gap: 1500, retries: 1 }));
    return (j.data || []).filter((c) => c.body && !/^\[(removed|deleted)\]$/.test(c.body) && c.author !== 'AutoModerator').map((c) => ({
      id: 'c_' + c.id, kind: 'comment', sub: c.subreddit, t: c.created_utc * 1000, title: '', text: clip(decode(c.body), 3000),
      url: 'https://www.reddit.com' + (c.permalink || ('/comments/' + String(c.link_id || '').replace(/^t3_/, '') + '/_/' + c.id)) }));
  }
  async function pullpushPosts(sub, term) {
    const url = 'https://api.pullpush.io/reddit/search/submission/?q=' + encodeURIComponent(term) + '&subreddit=' + encodeURIComponent(sub) + '&size=100&after=' + PP_AFTER();
    const j = await cached('adm:ppp:' + sub + ':' + term, 12 * 3600e3, () => polite('pullpush', () => getJSON(url, 15000), { conc: 1, gap: 1500, retries: 1 }));
    return (j.data || []).map((p) => ({ id: 'p_' + p.id, kind: 'post', sub: p.subreddit, t: p.created_utc * 1000, title: decode(p.title || ''),
      text: clip(decode(p.title || '') + '\n' + decode(p.selftext || '').replace(/\[(removed|deleted)\]/g, ''), 4000), url: 'https://www.reddit.com' + (p.permalink || '/comments/' + p.id) }));
  }
  async function redditSearch(query) {
    const url = 'https://www.reddit.com/search.rss?q=' + encodeURIComponent(query) + '&sort=relevance&t=all&type=link&limit=25';
    const xml = await cached('adm:rss:' + query, 12 * 3600e3, () => polite('reddit', () => getText(url, 9000), { conc: 1, gap: 1500, retries: 1 }));
    return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)).map((m) => {
      const e = m[1], link = ((e.match(/<link href="([^"]+)"/) || [])[1] || '').replace(/&amp;/g, '&');
      const id = (link.match(/\/comments\/([a-z0-9]+)\//) || [])[1]; if (!id) return null;
      const title = stripHtml((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      return { id: 'p_' + id, kind: 'post', sub: (e.match(/<category term="([^"]+)"/) || [])[1] || '', t: Date.parse((e.match(/<published>(.*?)<\/published>/) || e.match(/<updated>(.*?)<\/updated>/) || [])[1]) || 0,
        title, text: clip(title + '\n' + stripHtml((e.match(/<content type="html">([\s\S]*?)<\/content>/) || [])[1]).replace(/submitted by\s+\/u\/\S+.*$/i, ''), 4000), url: link };
    }).filter(Boolean);
  }

  // robots.txt (open-web pages only) — longest matching Allow/Disallow rule for "*"
  async function allowed(url) {
    let u; try { u = new URL(url); } catch (e) { return false; }
    const rules = await cached('robots:' + u.host, DAY, async () => {
      try {
        const txt = await getText(u.origin + '/robots.txt', 6000), out = []; let on = false, seen = false;
        txt.split(/\r?\n/).forEach((line) => {
          const m = line.replace(/#.*/, '').match(/^\s*([A-Za-z-]+)\s*:\s*(.*)\s*$/); if (!m) return;
          const k = m[1].toLowerCase(), v = m[2];
          if (k === 'user-agent') { if (seen) { on = false; seen = false; } on = on || v === '*' || /universityresearch/i.test(v); }
          else if (on && (k === 'allow' || k === 'disallow')) { seen = true; if (v) out.push({ allow: k === 'allow', path: v }); }
        });
        return out;
      } catch (e) { return e.status === 404 ? [] : [{ allow: false, path: '/' }]; }
    });
    const p = u.pathname + u.search; let best = null;
    rules.forEach((r) => { const pre = r.path.replace(/\*.*$/, '').replace(/\$$/, ''); if (p.indexOf(pre) === 0 && (!best || pre.length > best.len)) best = { len: pre.length, allow: r.allow }; });
    return !best || best.allow;
  }
  async function fetchPage(url) {
    if (!(await allowed(url))) { const e = new Error('robots.txt disallows'); e.blocked = true; throw e; }
    const host = new URL(url).host;
    return polite('web:' + host, async () => {
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
      const type = r.headers.get('content-type') || '';
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 4 * 1024 * 1024) throw new Error('page too large');
      if (/pdf/.test(type) || /\.pdf($|\?)/i.test(url)) { const pdf = require('pdf-parse/lib/pdf-parse.js'); const o = await pdf(buf, { max: 40 }); return { type: 'pdf', text: String(o.text || '') }; }
      const html = buf.toString('utf8');
      const title = stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
      const text = decode(html.replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/(td|th)>/gi, ' | ').replace(/<\/(p|div|li|tr|h\d|section|article|br)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
        .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
      return { type: 'html', title, text };
    }, { conc: 1, gap: 1500, retries: 1 });
  }
  async function webSearch(query) {
    if (!BRAVE) return [];
    const j = await cached('brave:' + query, DAY, () => polite('brave', async () => {
      const r = await fetch('https://api.search.brave.com/res/v1/web/search?count=10&q=' + encodeURIComponent(query), { headers: { Accept: 'application/json', 'X-Subscription-Token': BRAVE }, signal: AbortSignal.timeout(10000) });
      if (!r.ok) { const e = new Error('brave HTTP ' + r.status); e.status = r.status; throw e; }
      return r.json();
    }, { conc: 1, gap: 1100 }));
    return ((j.web && j.web.results) || []).map((x) => ({ url: x.url, title: x.title }));
  }

  /* ── extraction ──────────────────────────────────────────────────── */
  const PROMPT = 'You extract university admission OUTCOMES that an AUTHOR reports about THEMSELVES in public posts. ' +
    'Return JSON {"items":[{"id":string,"outcomes":[...]}]} with one item per snippet id (outcomes may be empty). ' +
    'Only include an outcome when the author explicitly states THEIR OWN result at a named university. Never include questions ("will I get in?"), predictions, plans, other people\'s results, rankings or general advice. ' +
    'Copy fields ONLY when explicitly written; use null when not stated. NEVER guess or infer. Outcome fields: ' +
    '{"university": string (as written), "program": string|null, "level": "bachelor"|"master"|"phd"|null, ' +
    '"qualification": "ib"|"a_levels"|"gpa_us"|"gpa_us_w"|"pct"|"es_bach"|"es_pau"|"fr_bac"|"it_maturita"|"de_abitur"|"nl_vwo"|"ch_matura"|"pt_sec"|"ie_lc"|"ua_nmt"|"uk_degree"|"other"|null, ' +
    '"score": string|null (exactly as written, e.g. "38", "A*A*A", "3.85"), "score_is_predicted": boolean, ' +
    '"tests": {"SAT"?:number,"ACT"?:number,"TMUA"?:number,"ESAT"?:number,"MAT"?:number,"LNAT"?:number,"UCAT"?:number,"GRE"?:number,"GMAT"?:number}, ' +
    '"language": {"IELTS"?:number,"TOEFL"?:number,"Duolingo"?:number}, "achievements": [string]|null (short phrases as written; null if not mentioned), ' +
    '"result": "accepted"|"rejected"|"waitlisted"|"withdrawn", "scholarship": {"status":"received"|"none"|"unknown","name":string|null,"amount":number|null,"currency":string|null}, ' +
    '"intake_year": number|null, "quote": string (an EXACT substring of the snippet, max 200 characters, that states the result)}. ' +
    'A conditional or unconditional offer is "accepted". Ignore usernames.';
  let client = null;
  async function llm(messages) {
    if (!client) client = await require('./synthesize').getOpenAI();
    const r = await client.chat.completions.create({ model: MODEL, messages, temperature: 0, max_tokens: 2400, response_format: { type: 'json_object' }, reasoning_effort: 'low' });
    return JSON.parse(String((r.choices[0].message || {}).content || '{}'));
  }
  const flat = (s) => String(s || '').toLowerCase().replace(/[*_`>~#\\]/g, '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  function scoreInText(qual, raw, text) {
    if (!raw) return true;
    if (qual === 'a_levels') return flat(text).replace(/[\s,]+/g, '').toUpperCase().indexOf(String(raw).toUpperCase()) !== -1;
    const n = String(raw).replace(/ e lode$/, '');
    return new RegExp('(^|[^0-9.])' + n.replace('.', '[.,]') + '($|[^0-9])').test(text);
  }
  function resultAgrees(result, text) {
    const t = flat(text);
    if (result === 'accepted') return ACCEPT_RX.test(t);
    if (result === 'rejected') return REJECT_RX.test(t);
    if (result === 'waitlisted') return WAIT_RX.test(t);
    return /withdr/.test(t);
  }
  // A quote has to stand on its own: it states the decision, in the first person, and names the university.
  const THIRD_RX = /\b(my|our|a|his|her|their)\s+(best\s+)?(friend|friends|brother|sister|cousin|classmate|mate|son|daughter|kid)s?\b|\b(he|she|they)\s+(got|was|were|has been|have been)\b/i;
  function quoteProblem(o, quote, c, uk) {
    if (!resultAgrees(o.result, quote)) return 'quote does not state the result';
    if (THIRD_RX.test(quote)) return 'about someone else';
    const title = c.title ? flat(c.title) : '';
    if (!FIRST_RX.test(quote) && !(c.kind === 'post' && title && flat(quote).indexOf(title.slice(0, 24)) === 0)) return 'not first-person';
    const u = UNI.get(uk);
    if (!(u && termRx(terms(u)).test(quote)) && !R.detect(quote).unis.some((x) => x.cc + ':' + x.id === uk)) return 'university not named in the quote';
    if (o.result === 'accepted' && u) {   // "Oxford interview" next to the name is an interview, not an offer
      const names = terms(u).map((t) => t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      if (new RegExp('(' + names + ')\\W{1,3}interview|interview(s|ed)?\\W+((at|with|for)\\W+)?(' + names + ')(\\W|$)', 'i').test(quote) && !/\boffer\b/i.test(quote)) return 'interview is not a decision';
    }
    return null;
  }
  function resolveUni(name, snippet, target) {
    const hit = name ? R.detect(name).unis : [];
    if (target && hit.some((u) => u.cc + ':' + u.id === target)) return target;
    if (hit.length === 1) return hit[0].cc + ':' + hit[0].id;
    if (target && !hit.length) {   // the model kept the short name (e.g. "Delft") — accept if it is one of the target's search names
      const u = UNI.get(target); if (u && name && termRx(terms(u)).test(name)) return target;
    }
    return null;
  }

  /* ── second opinion before anything goes live ──────────────────────
     A larger model re-reads the post next to what was extracted and must
     confirm every field; anything it doubts stays pending for an admin. */
  const JUDGE = 'You check one extracted admission record against the public post it came from. Reply JSON only: {"ok": boolean, "problems": [string]}. ' +
    'ok=true ONLY if ALL hold: (1) the author states THEIR OWN result (not a friend\'s, not hypothetical, not a question); (2) the result (accepted/rejected/waitlisted/withdrawn) is explicitly stated for THIS university; ' +
    '(3) the score and qualification, if given, are the author\'s and match the post exactly; (4) the programme and level, if given, are what the post says. Interviews, shortlists or invitations to interview are NOT acceptances.';
  async function judge(rec, text, uniName) {
    try {
      if (!client) client = await require('./synthesize').getOpenAI();
      const r = await client.chat.completions.create({ model: JUDGE_MODEL, temperature: 0, max_tokens: 1200, response_format: { type: 'json_object' }, reasoning_effort: 'low',
        messages: [{ role: 'system', content: JUDGE }, { role: 'user', content: 'University: ' + uniName + '\nExtracted: ' + JSON.stringify({ result: rec.result, qualification: rec.qualification, score: rec.score_raw, programme: rec.program_raw, level: rec.level }) +
          '\nQuote: "' + rec.evidence + '"\nPost:\n<<<\n' + clip(text, 2500) + '\n>>>' }] });
      const j = JSON.parse(String((r.choices[0].message || {}).content || '{}'));
      return { ok: j.ok === true, problems: (j.problems || []).slice(0, 3).map((x) => clip(x, 120)) };
    } catch (e) { return { ok: false, problems: ['check failed: ' + clip(e.message, 60)] }; }
  }
  async function decide(id, rec, text) {
    if (!AUTO_PUBLISH || rec.confidence !== 'medium') return 'pending';
    const u = UNI.get(rec.uni_key), v = await judge(rec, text, u ? u.name : rec.uni_key);
    if (v.ok) { await q(`UPDATE ${T('adm_outcomes')} SET review_status='approved', reviewed_at=now(), reviewed_by='auto-check', review_note=COALESCE(review_note || ' · ', '') || 'double-checked by a second model' WHERE id=$1 AND review_status='pending' AND NOT dup_flag`, [id]); return 'approved'; }
    await q(`UPDATE ${T('adm_outcomes')} SET review_note=COALESCE(review_note || ' · ', '') || $2 WHERE id=$1`, [id, 'second check: ' + (v.problems.join('; ') || 'not confirmed')]);
    return 'pending';
  }

  /* ── one job ─────────────────────────────────────────────────────── */
  async function runJob(job, opt) {   // opt.snippets: run extraction on given text (tests) instead of searching
    const u = UNI.get(job.uni_key); if (!u) throw new Error('unknown university');
    const st = { searched: 0, candidates: 0, extracted: 0, inserted: 0, duplicates: 0, flagged: 0, rejected: 0, skippedSeen: 0, errors: 0, blocked: 0, throttled: false, tooOld: 0 };
    throttled = 0;
    const names = terms(u), rx = termRx(names), prog = job.program || '';
    const subs = Array.from(new Set((SUBS[u.cc] || ['IBO']).concat(['studyAbroad']).concat(/master|msc|phd|mba/i.test(prog) ? GRAD_SUBS : [])));
    const queries = [];
    const tasks = [];
    // Arctic Shift first; when it throttles, the same search goes to PullPush
    const archive = (kind, sb, nm) => async () => {
      try { return kind === 'c' ? await arcticComments(sb, nm) : await arcticPosts(sb, nm); }
      catch (e) { if (!e.throttled) throw e; st.fallback = (st.fallback || 0) + 1; return kind === 'c' ? pullpushComments(sb, nm) : pullpushPosts(sb, nm); }
    };
    names.slice(0, 2).forEach((nm) => subs.forEach((sb) => { queries.push('archive comments r/' + sb + ' "' + nm + '"'); tasks.push(archive('c', sb, nm)); }));
    names.slice(0, 2).forEach((nm) => subs.slice(0, 3).forEach((sb) => { queries.push('archive posts r/' + sb + ' "' + nm + '"'); tasks.push(archive('p', sb, nm)); }));
    const main = names[0];
    ['"' + main + '" ' + (prog ? prog + ' ' : '') + 'accepted IB', '"' + main + '" ' + (prog ? prog + ' ' : '') + 'rejected', '"' + main + '" offer A*', '"' + main + '" admitted GPA', '"' + main + '" applicant profile']
      .forEach((s) => { queries.push('reddit search ' + s); tasks.push(() => redditSearch(s)); });
    const webQ = BRAVE ? [main + ' ' + prog + ' accepted with IB points', main + ' ' + prog + ' admission results applicant profile', main + ' acceptance student profile GPA'] : [];
    webQ.forEach((s) => queries.push('web ' + s));
    await q(`UPDATE ${T('adm_research_jobs')} SET queries=$2 WHERE id=$1`, [job.id, JSON.stringify(queries)]);

    const raw = opt && opt.snippets ? opt.snippets.slice() : [];
    if (opt && opt.snippets) tasks.length = 0, webQ.length = 0;
    for (const t of tasks) { try { raw.push.apply(raw, await t()); st.searched++; } catch (e) { if (e.throttled) st.throttled = true; else st.errors++; } }
    for (const s of webQ) {
      try {
        for (const hit of (await webSearch(s)).slice(0, 6)) {
          try {
            const pg = await fetchPage(hit.url);
            pg.text.split(/\n/).map((p) => p.trim()).filter((p) => p.length > 60 && p.length < 2500).forEach((p, i) => raw.push({ id: 'w_' + crypto.createHash('sha1').update(hit.url + i).digest('hex').slice(0, 12), kind: 'web', sub: '', t: 0, title: pg.title || hit.title, text: p, url: hit.url }));
          } catch (e) { if (e.blocked) st.blocked++; else st.errors++; }
        }
        st.searched++;
      } catch (e) { st.errors++; }
    }
    // filter → unique → not seen before
    const seenIds = new Set(), cand = [];
    raw.forEach((c) => {
      if (seenIds.has(c.id)) return; seenIds.add(c.id);
      if (c.t && Date.now() - c.t > MAX_AGE) { st.tooOld++; return; }
      const t = c.text;
      if (!rx.test(t) || !DEC_RX.test(t) || !SCORE_RX.test(t) || !FIRST_RX.test(t)) return;
      if (/\?\s*$/.test(t.trim()) && t.length < 220) return;   // short questions
      cand.push(c);
    });
    const urls = cand.map((c) => c.url);
    const done = urls.length ? new Set((await q(`SELECT url FROM ${T('adm_sources')} WHERE url = ANY($1) AND status IN ('extracted','no_outcome')`, [urls])).rows.map((r) => r.url)) : new Set();
    const todo = cand.filter((c) => { if (done.has(c.url)) { st.skippedSeen++; return false; } return true; })
      .sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, 48);
    st.candidates = todo.length;

    for (let i = 0; i < todo.length; i += 4) {
      const batch = todo.slice(i, i + 4);
      let out;
      try {
        out = await llm([{ role: 'system', content: PROMPT }, { role: 'user', content: 'Target university: ' + u.name + ' (' + u.city + ', ' + u.country + '). Snippets:\n' +
          batch.map((c) => '### id=' + c.id + '\n' + c.text.replace(/\bu\/[A-Za-z0-9_-]+/g, '[user]')).join('\n\n') }]);
      } catch (e) { st.errors++; continue; }
      for (const c of batch) {
        const item = (out.items || []).find((x) => x && x.id === c.id) || { outcomes: [] };
        const kept = [];
        for (const o of (item.outcomes || []).slice(0, 12)) {
          if (!o || ['accepted', 'rejected', 'waitlisted', 'withdrawn'].indexOf(o.result) === -1) { st.rejected++; continue; }
          const quote = clip(o.quote, 260);
          if (!quote || flat(c.text).indexOf(flat(quote)) === -1) { st.rejected++; continue; }               // must be verbatim
          const uk = resolveUni(o.university, c.text, job.uni_key); if (!uk) { st.rejected++; continue; }
          if (quoteProblem(o, quote, c, uk)) { st.rejected++; continue; }
          const qual = Q.QUALS[o.qualification] ? o.qualification : null;
          let sc = qual && o.score ? Q.parseScore(qual, o.score) : null;
          if (sc && !scoreInText(qual, sc.raw, c.text)) sc = null;                                          // score must be in the text
          const level = Q.LEVELS.indexOf(o.level) !== -1 ? o.level : null;
          const tests = Q.parseTests(o.tests, Q.TESTS), lang = Q.parseTests(o.language, Q.LANG);
          Object.keys(tests).forEach((k) => { if (!new RegExp('\\b' + tests[k] + '\\b').test(c.text)) delete tests[k]; });
          Object.keys(lang).forEach((k) => { if (!new RegExp('\\b' + String(lang[k]).replace('.', '[.,]') + '\\b').test(c.text)) delete lang[k]; });
          const ach = o.achievements === null || o.achievements === undefined ? null : Array.isArray(o.achievements) && !o.achievements.length ? [] : Q.tagAchievements(o.achievements);
          const sch = o.scholarship && o.scholarship.status === 'received' ? { status: 'received', name: clip(o.scholarship.name, 80) || null, amount: +o.scholarship.amount > 0 ? +o.scholarship.amount : null, currency: o.scholarship.currency ? clip(o.scholarship.currency, 4).toUpperCase() : null } : o.scholarship && o.scholarship.status === 'none' ? { status: 'none' } : null;
          let program = clip(o.program, 120) || null;
          if (program) { const pu = UNI.get(uk); if (pu && (Q.programNorm(program) === Q.programNorm(pu.name) || termRx(terms(pu)).test(program) && Q.programNorm(program).split(' ').length <= 3 && !Q.fieldOf(program))) program = null; }   // the model put the university in the programme field
          const conf = sc && (program || level) ? 'medium' : 'low';
          kept.push({ uni_key: uk, program_raw: program, level, intake_year: +o.intake_year >= 2010 && +o.intake_year <= new Date().getFullYear() + 2 ? +o.intake_year : null,
            qualification: sc ? qual : null, score_raw: sc ? sc.raw : null, test_scores: tests, language_scores: lang, achievements: ach, result: o.result, scholarship: sch,
            source_type: 'public_self_report', verification_status: 'unverified', confidence: conf, review_status: 'pending',
            source_reference: c.kind === 'web' ? 'web:' + new URL(c.url).host : 'reddit:r/' + c.sub, evidence: scrub(quote), predicted: !!o.score_is_predicted, reported_at: c.t ? iso(c.t) : null });
        }
        const srcId = await upsertSource({ url: c.url, kind: c.kind === 'web' ? 'public_web' : 'public_forum', publisher: c.kind === 'web' ? new URL(c.url).host : 'Reddit · r/' + c.sub,
          title: c.title ? scrub(c.title) : null, status: kept.length ? 'extracted' : 'no_outcome', published_at: c.t || null,
          content_hash: crypto.createHash('sha1').update(c.text).digest('hex').slice(0, 20) });
        for (const k of kept) {
          st.extracted++;
          const note = k.predicted ? 'score is predicted' : null; delete k.predicted;
          const r = await ingest(Object.assign(k, { source_id: srcId }));
          if (r.id) {
            st.inserted++; if (r.flagged) st.flagged++;
            if (note) await q(`UPDATE ${T('adm_outcomes')} SET review_note=$2 WHERE id=$1`, [r.id, note]);
            if (!r.flagged && (await decide(r.id, k, c.text)) === 'approved') st.published = (st.published || 0) + 1;
          }
          else if (r.duplicate) st.duplicates++; else st.rejected++;
        }
      }
      await q(`UPDATE ${T('adm_research_jobs')} SET stats=$2 WHERE id=$1`, [job.id, JSON.stringify(st)]);
    }
    return st;
  }

  /* ── official page → pending stats / requirements / scholarships ── */
  const OFF_PROMPT = 'You read an OFFICIAL university or statistics page and extract admissions facts EXACTLY as printed. Reply JSON only: ' +
    '{"stats":[{"program":string|null,"level":"bachelor"|"master"|"phd"|null,"cycle":string|null,"applications":number|null,"offers":number|null,"admitted":number|null,"enrolled":number|null,"score_measure":string|null,"p25":number|null,"p50":number|null,"p75":number|null,"quote":string}],' +
    '"requirements":[{"program":string|null,"level":string|null,"qualification":"ib"|"a_levels"|"gpa_us"|"pct"|"de_abitur"|"fr_bac"|"it_maturita"|"es_bach"|"nl_vwo"|"other"|null,"min_score":string|null,"typical_offer":string|null,"required_subjects":string|null,"tests_required":[string],"language":{"IELTS"?:number,"TOEFL"?:number},"application_fee":{"amount":number,"currency":string}|null,"deadline":"YYYY-MM-DD"|null,"quote":string}],' +
    '"scholarships":[{"name":string,"program":string|null,"eligibility":string|null,"amount_min":number|null,"amount_max":number|null,"percentage":number|null,"currency":string|null,"academic_requirements":string|null,"deadline":string|null,"quote":string}]}. ' +
    'Only facts printed on the page; numbers exactly as printed; null when absent; "quote" must be an exact substring of the page. No guesses, no outside knowledge.';
  async function extractOfficial(uniKey, url, program) {
    const pg = await fetchPage(url);
    const text = clip(pg.text, 28000);
    const srcId = await upsertSource({ url, kind: 'official', publisher: new URL(url).host, title: pg.title || null, status: 'extracted', content_hash: crypto.createHash('sha1').update(pg.text).digest('hex').slice(0, 20) });
    if (!client) client = await require('./synthesize').getOpenAI();
    const r = await client.chat.completions.create({ model: process.env.AI_OFFICIAL_MODEL || 'openai/gpt-oss-120b', temperature: 0, max_tokens: 6000, response_format: { type: 'json_object' }, reasoning_effort: 'medium',
      messages: [{ role: 'system', content: OFF_PROMPT }, { role: 'user', content: 'University: ' + (UNI.get(uniKey) || {}).name + (program ? '\nFocus programme: ' + program : '') + '\nPage:\n"""\n' + text + '\n"""' }] });
    const j = JSON.parse(String((r.choices[0].message || {}).content || '{}'));
    const page = flat(text), digits = text.replace(/[,\s]/g, '');
    const inPage = (x) => x && page.indexOf(flat(x)) !== -1;
    const numOk = (v) => v == null || digits.indexOf(String(v)) !== -1 || digits.indexOf(String(v).replace('.', ',')) !== -1;
    const found = { stats: 0, requirements: 0, scholarships: 0, discarded: 0 }, today = iso(Date.now()), id = () => hid('ox');
    for (const s of (j.stats || []).slice(0, 60)) {
      if (!inPage(s.quote) || ![s.applications, s.offers, s.admitted, s.enrolled, s.p25, s.p50, s.p75].every(numOk)) { found.discarded++; continue; }
      await q(`INSERT INTO ${T('adm_official_stats')} (id, uni_key, program_name, level, cycle, applications, offers, admitted, enrolled, offer_rate, score_measure, score_p25, score_p50, score_p75, notes, source_id, collected_at, review_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'pending')`, [id(), uniKey, clip(s.program, 120) || null, s.level || null, clip(s.cycle, 40) || null, s.applications ?? null, s.offers ?? null, s.admitted ?? null, s.enrolled ?? null,
        s.applications && (s.offers ?? s.admitted) != null ? Math.round((s.offers ?? s.admitted) / s.applications * 1000) / 10 : null, clip(s.score_measure, 30) || null, s.p25 ?? null, s.p50 ?? null, s.p75 ?? null, 'Quote: ' + clip(s.quote, 240), srcId, today]);
      found.stats++;
    }
    for (const s of (j.requirements || []).slice(0, 40)) {
      if (!inPage(s.quote)) { found.discarded++; continue; }
      const ms = s.qualification && s.min_score ? Q.parseScore(s.qualification, s.min_score) : null;
      await q(`INSERT INTO ${T('adm_requirements')} (id, uni_key, program_name, level, qualification, min_score_raw, min_score_num, typical_offer, required_subjects, tests_required, language, application_fee, deadline, notes, source_id, collected_at, review_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'pending')`, [id(), uniKey, clip(s.program, 120) || null, s.level || null, s.qualification || null, ms ? ms.raw : null, ms ? ms.num : null,
        clip(s.typical_offer, 120) || null, clip(s.required_subjects, 200) || null, JSON.stringify((s.tests_required || []).map((x) => clip(x, 20)).slice(0, 6)), JSON.stringify(Q.parseTests(s.language, Q.LANG)),
        s.application_fee && numOk(s.application_fee.amount) ? JSON.stringify({ amount: +s.application_fee.amount, currency: clip(s.application_fee.currency, 4).toUpperCase() }) : null,
        /^\d{4}-\d{2}-\d{2}$/.test(s.deadline || '') ? s.deadline : null, 'Quote: ' + clip(s.quote, 240), srcId, today]);
      found.requirements++;
    }
    for (const s of (j.scholarships || []).slice(0, 30)) {
      if (!inPage(s.quote) || !s.name || ![s.amount_min, s.amount_max, s.percentage].every(numOk)) { found.discarded++; continue; }
      await q(`INSERT INTO ${T('adm_scholarships')} (id, uni_key, program_name, name, eligibility, amount_min, amount_max, percentage, currency, academic_requirements, deadline, source_type, source_id, source_date, review_status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'official',$12,$13,'pending')`, [id(), uniKey, clip(s.program, 120) || null, clip(s.name, 120), clip(s.eligibility, 300) || null, s.amount_min ?? null, s.amount_max ?? null, s.percentage ?? null,
        s.currency ? clip(s.currency, 4).toUpperCase() : null, clip(s.academic_requirements, 300) || null, clip(s.deadline, 60) || null, srcId, today]);
      found.scholarships++;
    }
    return { found, pending: true, source: url };
  }

  /* ── queue ───────────────────────────────────────────────────────── */
  let busy = false, timer = null, current = null;
  async function enqueue(uniKey, program, by, force) {
    if (!UNI.has(uniKey)) throw new Error('unknown university');
    if (!force) {
      const recent = (await q(`SELECT id, status, created_at FROM ${T('adm_research_jobs')} WHERE uni_key=$1 AND COALESCE(program,'')=COALESCE($2,'')
        AND (status IN ('queued','running') OR (status='done' AND created_at > now() - interval '21 days') OR (status IN ('partial','error') AND created_at > now() - interval '1 day')) ORDER BY created_at DESC LIMIT 1`, [uniKey, program])).rows[0];
      if (recent) return { queued: false, reason: recent.status === 'done' ? 'searched_recently' : 'already_queued', job: recent };
    }
    const id = hid('aj_');
    await q(`INSERT INTO ${T('adm_research_jobs')} (id, uni_key, program, status, requested_by) VALUES ($1,$2,$3,'queued',$4)`, [id, uniKey, program, by]);
    kick();
    return { queued: true, id };
  }
  async function maybeAuto(uniKey) {
    if (!AUTO) return;
    const r = (await q(`SELECT (SELECT count(*) FROM ${T('adm_research_jobs')} WHERE requested_by='auto' AND created_at > now() - interval '1 day')::int today,
      (SELECT count(*) FROM ${T('adm_research_jobs')} WHERE uni_key=$1 AND (status IN ('queued','running','done') AND created_at > now() - interval '30 days' OR created_at > now() - interval '1 day'))::int recent`, [uniKey])).rows[0];
    if (r.recent || r.today >= 25) return;
    await enqueue(uniKey, null, 'auto', false);
  }
  function kick() { clearTimeout(timer); timer = setTimeout(loop, 500); }
  async function loop() {
    if (busy) return; busy = true;
    try {
      for (;;) {
        const job = (await q(`UPDATE ${T('adm_research_jobs')} SET status='running', started_at=now() WHERE id = (SELECT id FROM ${T('adm_research_jobs')} WHERE status='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`)).rows[0];
        if (!job) break;
        current = job.id;
        try {
          const st = await runJob(job);
          await q(`UPDATE ${T('adm_research_jobs')} SET status=$3, stats=$2, finished_at=now() WHERE id=$1`, [job.id, JSON.stringify(st), st.throttled ? 'partial' : 'done']);
          log('[admissions] research ' + job.uni_key + ': ' + st.candidates + ' candidates, ' + st.inserted + ' new for review, ' + st.duplicates + ' duplicates');
        } catch (e) {
          errlog('[admissions] research failed', job.uni_key, e.message);
          await q(`UPDATE ${T('adm_research_jobs')} SET status='error', error=$2, finished_at=now() WHERE id=$1`, [job.id, clip(e.message, 300)]);
        }
        current = null;
      }
    } catch (e) { errlog('[admissions] queue:', e.message); }
    busy = false;
  }
  // Steady background coverage: one selective university at a time, most selective first,
  // skipping anything searched recently; capped per day so the archives aren't hammered.
  const PRIORITY = Array.from(UNI.values()).filter((u) => (u.diff || 0) >= 4).sort((a, b) => (b.diff || 0) - (a.diff || 0) || String(a.name).localeCompare(b.name)).map((u) => u.cc + ':' + u.id);
  async function scheduleNext() {
    if (!AUTO || busy) return;
    try {
      const r = (await q(`SELECT (SELECT count(*) FROM ${T('adm_research_jobs')} WHERE status IN ('queued','running'))::int open,
        (SELECT count(*) FROM ${T('adm_research_jobs')} WHERE requested_by IN ('auto','schedule') AND created_at > now() - interval '1 day')::int today`)).rows[0];
      if (r.open || r.today >= 40) return;
      const recent = new Set((await q(`SELECT DISTINCT uni_key FROM ${T('adm_research_jobs')} WHERE (status='done' AND created_at > now() - interval '21 days') OR created_at > now() - interval '1 day'`)).rows.map((x) => x.uni_key));
      const next = PRIORITY.find((k) => !recent.has(k));
      if (next) await enqueue(next, null, 'schedule', false);
    } catch (e) { errlog('[admissions] schedule:', e.message); }
  }
  async function start() {
    try { await q(`UPDATE ${T('adm_research_jobs')} SET status='queued' WHERE status='running'`); } catch (e) {}   // crash recovery
    kick();
    setInterval(kick, 10 * 60e3).unref();
    setInterval(scheduleNext, 15 * 60e3).unref();
    setTimeout(scheduleNext, 60e3).unref();
  }
  function status() { return { busy, current, auto: AUTO, autoPublish: AUTO_PUBLISH, webSearch: !!BRAVE, model: MODEL, judge: JUDGE_MODEL, coverage: PRIORITY.length }; }

  // re-run today's checks over records still waiting for review (after the rules get stricter)
  async function recheckPending() {
    const rows = (await q(`SELECT o.id, o.uni_key, o.result, o.evidence, o.confidence, o.dup_flag, o.review_note, o.qualification, o.score_raw, o.program_raw, o.level, src.title
      FROM ${T('adm_outcomes')} o LEFT JOIN ${T('adm_sources')} src ON src.id=o.source_id WHERE o.review_status='pending' AND o.source_type='public_self_report'`)).rows;
    let n = 0, pub = 0;
    for (const r of rows) {
      const why = quoteProblem({ result: r.result }, r.evidence || '', { kind: r.title ? 'post' : 'comment', title: r.title || '' }, r.uni_key);
      if (why) { n++; await q(`UPDATE ${T('adm_outcomes')} SET review_status='rejected', review_note=$2, reviewed_at=now(), reviewed_by='auto-check' WHERE id=$1`, [r.id, 'auto-check: ' + why]); }
      else if (r.confidence === 'medium' && !r.dup_flag && !/second check/.test(r.review_note || '')) { if ((await decide(r.id, r, r.evidence || '')) === 'approved') pub++; }
    }
    return { checked: rows.length, rejected: n, published: pub };
  }

  return { enqueue, maybeAuto, start, status, extractOfficial, runJob, terms, recheckPending };
};
