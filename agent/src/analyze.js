'use strict';
// Reasoning step: rephrase the scraped items into short, clear, human language and
// classify each as an "event" (attend / prepare for / has a date) or an "article"
// (just news to read). Uses OpenAI (ChatGPT) when OPENAI_API_KEY is set; otherwise a
// deterministic heuristic. Never invents — only works from the scraped titles/urls.
const log = require('./logger');

const OPENAI_KEY = process.env.OPENAI_API_KEY;
// Auto-detect Groq from a gsk_ key (OpenAI-compatible, free + fast); else OpenAI.
const IS_GROQ = (OPENAI_KEY || '').indexOf('gsk_') === 0;
const OPENAI_BASE = (process.env.OPENAI_BASE_URL ||
  (IS_GROQ ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1')).replace(/\/$/, '');
const OPENAI_MODEL = process.env.OPENAI_MODEL || (IS_GROQ ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');
const DL_TYPES = ['application', 'scholarship', 'openday', 'accommodation', 'interview', 'other'];
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function pad(n) { return n < 10 ? '0' + n : '' + n; }

// Pull a YYYY-MM-DD date out of a title if one is present.
function extractDate(t) {
  if (!t) return null;
  var m = t.match(/(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})/i);
  if (m) return m[3] + '-' + pad(MONTHS[m[2].toLowerCase().slice(0, 3)]) + '-' + pad(+m[1]);
  m = t.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
  if (m) return m[3] + '-' + pad(MONTHS[m[1].toLowerCase().slice(0, 3)]) + '-' + pad(+m[2]);
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return null;
}

function cleanTitle(t) {
  return String(t || '').replace(/\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s*$/i, '').trim();
}

var EVENT_RE = /\b(open day|openday|webinar|seminar|conference|workshop|info(rmation)? session|session|fair|festival|ceremony|exhibition|masterclass|taster|visit day|deadline|appl(y|ication)|admission|enrol|register|registration|scholarship|bursary|funding|interview|assessment|hackathon|summer school|tour)\b/i;

function dlTypeFor(title) {
  if (/scholarship|bursary|funding|grant/i.test(title)) return 'scholarship';
  if (/open day|visit day|taster|tour/i.test(title)) return 'openday';
  if (/interview|assessment/i.test(title)) return 'interview';
  if (/accommodation|housing|residence|halls/i.test(title)) return 'accommodation';
  if (/deadline|appl(y|ication)|admission|enrol|register|ucas/i.test(title)) return 'application';
  return 'other';
}

// ── No-key heuristic (works offline; basic phrasing, real classification) ──
function buildReportHeuristic(evidence) {
  var findings = evidence.filter(function (e) { return e.items.length; }).map(function (ev) {
    var items = ev.items.slice(0, 6).map(function (it) {
      var title = cleanTitle(it.title);
      var date = extractDate(it.title) || extractDate(title);
      var isEvent = EVENT_RE.test(title) && !!date;   // only an actionable event if we have a date
      return {
        title: title,
        blurb: isEvent ? (title + (date ? ' (' + date + ')' : '')) : ('New from ' + ev.university + ': "' + title + '" — want to read it?'),
        type: isEvent ? 'event' : 'article',
        dlType: dlTypeFor(title),
        date: date || null,
        url: it.url || ev.sourceUrl || '',
      };
    });
    return { university: ev.university, source: ev.sourceType || 'official', url: ev.sourceUrl || '', items: items };
  });
  return {
    subject: 'UniVersity — Latest from your saved universities',
    summary: 'Here are the newest updates from the universities you saved.',
    findings: findings,
  };
}

function normalize(parsed, evidence) {
  var report = parsed && typeof parsed === 'object' ? parsed : {};
  report.subject = report.subject || 'UniVersity — Latest from your saved universities';
  report.summary = report.summary || 'Here are the newest updates from your saved universities.';
  report.findings = Array.isArray(report.findings) ? report.findings : [];
  report.findings = report.findings.map(function (f) {
    return {
      university: f.university || '',
      source: f.source || 'official',
      url: f.url || '',
      items: (Array.isArray(f.items) ? f.items : []).map(function (i) {
        var type = i.type === 'event' && i.date ? 'event' : (i.type === 'event' ? 'event' : 'article');
        // an event needs a date to be saveable; without one, treat as article
        if (type === 'event' && !i.date) type = 'article';
        return {
          title: i.title || '',
          blurb: i.blurb || i.title || '',
          type: type,
          dlType: DL_TYPES.indexOf(i.dlType) !== -1 ? i.dlType : dlTypeFor(i.title || ''),
          date: i.date || null,
          url: i.url || f.url || '',
        };
      }),
    };
  });
  return report;
}

// ── OpenAI (ChatGPT) rephrasing + classification ──
async function rephraseWithOpenAI(evidence) {
  var payload = evidence.filter(function (e) { return e.items.length; }).map(function (e) {
    return { university: e.university, source: e.sourceType, url: e.sourceUrl, items: e.items.slice(0, 6).map(function (i) { return { title: i.title, url: i.url }; }) };
  });

  var system =
    'You are UniVersity\'s news assistant. You receive scraped news items (titles + URLs) for a student\'s ' +
    'saved universities. Rewrite each item in SHORT, CLEAR, friendly human language (max ~1 sentence). ' +
    'Classify each item:\n' +
    '- "event": something the student can ATTEND or PREPARE FOR (open days, application/scholarship deadlines, ' +
    'webinars, interviews, info sessions). For events extract "date" as YYYY-MM-DD if the date is present (else null) ' +
    'and pick "dlType" from [application, scholarship, openday, accommodation, interview, other].\n' +
    '- "article": general news/research. For articles, phrase the blurb as an invitation, e.g. ' +
    '"New article from X about Y — want to read it?".\n' +
    'STRICT: use ONLY the given titles/urls; do NOT invent facts, dates, or items. Keep the best ~5 items per university. ' +
    'Return ONLY JSON: {"subject":"","summary":"","findings":[{"university":"","source":"official|web","url":"",' +
    '"items":[{"title":"","blurb":"","type":"event|article","dlType":"","date":"YYYY-MM-DD|null","url":""}]}]}';

  var res = await fetch(OPENAI_BASE + '/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + OPENAI_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(payload) }],
    }),
  });
  if (!res.ok) { var t = await res.text(); throw new Error('OpenAI ' + res.status + ': ' + t.slice(0, 200)); }
  var data = await res.json();
  var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return normalize(JSON.parse(content), evidence);
}

async function writeReport(evidence) {
  var provider = IS_GROQ ? 'Groq' : 'OpenAI';
  var report = null;
  if (OPENAI_KEY) {
    try { log.info('rephrasing with ' + provider + ' (' + OPENAI_MODEL + ')…'); report = await rephraseWithOpenAI(evidence); }
    catch (e) { log.error(provider + ' failed — using heuristic instead:', e.message); }
  } else {
    log.warn('OPENAI_API_KEY not set — using basic heuristic phrasing (add an OpenAI/Groq key for nicer wording).');
  }
  if (!report) report = buildReportHeuristic(evidence);
  // Honest "couldn't find anything" list — universities whose official site had no news.
  var noNews = evidence.filter(function (e) { return !e.items.length; }).map(function (e) { return e.university; });
  report.warnings = noNews.map(function (n) { return n + ' — no recent news found on its official site.'; });
  return report;
}

module.exports = { writeReport };
