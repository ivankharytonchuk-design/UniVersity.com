'use strict';
// Orchestrator: load saved universities → scrape their official sites →
// the model rephrases the scraped items into a structured JSON report → Mailjet sends it.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const log = require('./logger');
const { scrapeUniversity } = require('./scrape');
const { writeReport } = require('./analyze');
const { sendReport } = require('./email');

const DRY_RUN = String(process.env.DRY_RUN) === 'true';

function loadWatchlist() {
  const p = path.join(__dirname, '..', 'config', 'watchlist.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const unis = (data.universities || []).filter(function (u) { return u && u.name; });
  if (!unis.length) throw new Error('watchlist.json has no universities');
  return unis;
}

function requireEnv() {
  const missing = [];
  if (!DRY_RUN) ['MJ_APIKEY_PUBLIC', 'MJ_APIKEY_PRIVATE', 'EMAIL_FROM', 'EMAIL_TO'].forEach(function (k) { if (!process.env[k]) missing.push(k); });
  if (missing.length) throw new Error('Missing env vars: ' + missing.join(', ') + ' (see .env.example)');
  if (!process.env.OPENAI_API_KEY) log.warn('OPENAI_API_KEY not set — using basic phrasing (add it for ChatGPT-rephrased, human-language updates).');
}

async function main() {
  log.info('UniScout News Agent starting' + (DRY_RUN ? ' [DRY RUN]' : ''));
  requireEnv();

  const unis = loadWatchlist();
  log.info('watching', unis.length, 'saved universities:', unis.map(function (u) { return u.name; }).join(', '));

  // 1) Scrape each official site (sequential — polite + simpler logs)
  const evidence = [];
  for (const uni of unis) {
    let ev;
    try { ev = await scrapeUniversity(uni); }
    catch (e) { log.error('scrape error for', uni.name, '-', e.message); ev = { university: uni.name, sourceType: 'official', sourceUrl: uni.website || null, items: [] }; }
    evidence.push(ev);
  }

  const totalItems = evidence.reduce(function (n, e) { return n + e.items.length; }, 0);
  log.info('collected', totalItems, 'items across', evidence.length, 'universities');

  // 2) Rephrase + classify into a clean, human report
  const report = await writeReport(evidence);

  // 4) Structured JSON output (stdout) + saved copy
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  try {
    const out = path.join(__dirname, '..', 'output', 'report-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    log.ok('report saved →', out);
  } catch (e) { log.warn('could not save report file:', e.message); }

  // 5) Send via Mailjet
  if (DRY_RUN) { log.warn('DRY_RUN — email NOT sent'); return; }
  await sendReport(report);
  log.ok('done.');
}

main().catch(function (err) {
  log.error('FATAL:', err && err.message ? err.message : err);
  if (err && err.response && err.response.body) log.error('Mailjet:', JSON.stringify(err.response.body));
  process.exit(1);
});
