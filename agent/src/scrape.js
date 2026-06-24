'use strict';
// Website step: HTTP scraping (no Claude here). Fetches a university's news/site
// and extracts recent headline-like items. Returns ONLY what was actually found.
const cheerio = require('cheerio');
const log = require('./logger');

const UA = 'Mozilla/5.0 (compatible; UniScoutNewsAgent/1.0; +https://uniscout.app)';
const TIMEOUT_MS = 15000;
const NEWS_PATHS = ['', '/news', '/news-events', '/news-and-events', '/en/news', '/about/news', '/media', '/press', '/newsroom'];

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (ct.indexOf('html') === -1) return null;
    return await r.text();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function abs(href, base) {
  try { return new URL(href, base).href; } catch (e) { return null; }
}

const JUNK = /(cookie|privacy|terms|login|sign in|search|menu|skip to|accessibility|contact|newsletter|subscribe|©|all rights)/i;
const DATE_RE = /\b(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})\b/i;

// Pull headline-like links, preferring news/article containers.
function extractNews(html, baseUrl) {
  const $ = cheerio.load(html);
  const items = [];
  const seen = {};

  function consider(el) {
    const $a = $(el);
    const title = $a.text().replace(/\s+/g, ' ').trim();
    const href = $a.attr('href');
    if (!href || !title) return;
    if (title.length < 22 || title.length > 200) return;
    if (JUNK.test(title)) return;
    if (title.indexOf('|') !== -1) return;        // page-title / site-name links
    if ((title.match(/\s/g) || []).length < 2) return;  // need at least 3 words
    const url = abs(href, baseUrl);
    if (!url || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (seen[url]) return;
    seen[url] = 1;
    // try to find a date near the link
    var date = null;
    var ctx = $a.closest('article,li,div').text();
    var m = (ctx || '').match(DATE_RE);
    if (m) date = m[0];
    items.push({ title: title, url: url, date: date });
  }

  // 1) Strong signals: articles / news cards
  $('article a, [class*="news" i] a, [class*="article" i] a, [class*="story" i] a, [class*="card" i] a, [class*="teaser" i] a, [class*="post" i] a, h2 a, h3 a')
    .each(function () { if (items.length < 14) consider(this); });

  // 2) Fallback: any reasonable link if we found little
  if (items.length < 4) {
    $('a').each(function () { if (items.length < 14) consider(this); });
  }

  return items.slice(0, 8);
}

// Scrape one university. Tries provided news URL, then common paths, then homepage.
async function scrapeUniversity(uni) {
  const candidates = [];
  if (uni.news) candidates.push(uni.news);
  if (uni.website) NEWS_PATHS.forEach(function (p) { candidates.push(uni.website.replace(/\/$/, '') + p); });

  for (const url of candidates) {
    log.info('scraping', uni.name, '→', url);
    const html = await fetchHtml(url);
    if (!html) continue;
    const items = extractNews(html, url);
    if (items.length) {
      log.ok('found', items.length, 'items for', uni.name, 'at', url);
      return { university: uni.name, sourceType: 'official', sourceUrl: url, items: items };
    }
  }
  log.warn('no news scraped from official site for', uni.name);
  return { university: uni.name, sourceType: 'official', sourceUrl: uni.website || null, items: [] };
}

module.exports = { scrapeUniversity, fetchHtml, extractNews };
