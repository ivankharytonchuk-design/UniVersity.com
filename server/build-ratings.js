'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   UniVersity — Sentiment → Star-Rating builder

   Turns the REAL student comments in server/data/comments.json into fair,
   transparent star ratings for each university and writes a small JS file the
   frontend loads (design/data/ratings_data.js → window.UNI_RATINGS).

   Fairness model (deterministic, no LLM, no API keys):
     • Each comment is scored with a weighted positive/negative lexicon
       (the same word lists the AI-reviews page uses, extended a little).
     • A comment's polarity p ∈ [-1, 1] maps to a 1–5 star value. Review-site
       writers skew positive, so a purely neutral comment sits at 3.6, a fully
       positive one at 5.0, a fully negative one at ~2.2 — i.e. mostly-bad
       comments genuinely produce a bad score, mostly-good produce a good one.
     • A university's average = mean of its comment stars; the distribution is
       the histogram of those per-comment stars; the count = number of real
       comments. Per-category scores come from comments that mention each
       category's keywords (falling back to the overall average).

   Ratings are keyed by the FRONTEND university id so the client can look them
   up directly. Comments are matched to a frontend uni by id → abbr → name.

   Run:  node server/build-ratings.js
   ──────────────────────────────────────────────────────────────────────────── */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const COMMENTS = path.join(__dirname, 'data', 'comments.json');
const APP_DATA = path.join(__dirname, '..', 'design', 'data', 'app_data.js');
const OUT      = path.join(__dirname, '..', 'design', 'data', 'ratings_data.js');

// ── Sentiment lexicon (weighted; strong words count double) ──────────────────
var POS = {
  best: 2, love: 2, loved: 2, amazing: 2, excellent: 2, fantastic: 2, brilliant: 2,
  incredible: 2, perfect: 2, wonderful: 2, outstanding: 2, exceptional: 2,
  great: 1, good: 1, friendly: 1, beautiful: 1, enjoy: 1, enjoyed: 1, vibrant: 1,
  welcoming: 1, recommend: 1, recommended: 1, helpful: 1, supportive: 1, happy: 1,
  nice: 1, lovely: 1, impressive: 1, affordable: 1, worth: 1, solid: 1, strong: 1,
  modern: 1, clean: 1, safe: 1, inspiring: 1, passionate: 1, rewarding: 1
};
var NEG = {
  worst: 2, terrible: 2, awful: 2, dreadful: 2, hate: 2, hated: 2, horrible: 2,
  disgusting: 2, useless: 2, nightmare: 2,
  expensive: 1, bad: 1, poor: 1, disappoint: 1, disappointing: 1, disappointed: 1,
  overpriced: 1, crowded: 1, dirty: 1, noisy: 1, rude: 1, lacking: 1, lack: 1,
  problem: 1, problems: 1, struggle: 1, struggled: 1, difficult: 1, unsafe: 1,
  boring: 1, slow: 1, outdated: 1, disorganised: 1, disorganized: 1, unhelpful: 1,
  stressful: 1, mediocre: 1, frustrating: 1, frustrated: 1, broken: 1
};

var CATEGORIES = [
  { key: 'academic',      name: 'Academic Quality',        kw: ['academic', 'research', 'rigorous', 'curriculum', 'syllabus', 'quality of education', 'knowledge', 'intellectual', 'degree', 'programme', 'program', 'course content'] },
  { key: 'teaching',      name: 'Teaching Quality',        kw: ['teaching', 'lecturer', 'lecture', 'professor', 'teacher', 'tutor', 'taught', 'staff', 'feedback', 'seminar', 'classes'] },
  { key: 'campus',        name: 'Campus Life',             kw: ['campus', 'social', 'nightlife', 'society', 'societies', 'atmosphere', 'vibe', 'fun', 'party', 'community', 'friends', 'events', 'sport', 'club'] },
  { key: 'facilities',    name: 'Facilities',              kw: ['facilities', 'library', 'lab', 'labs', 'building', 'equipment', 'gym', 'wifi', 'classroom', 'infrastructure', 'canteen'] },
  { key: 'international',  name: 'International Experience', kw: ['international', 'erasmus', 'exchange', 'foreign', 'abroad', 'english-taught', 'diversity', 'diverse', 'global', 'expat'] },
  { key: 'career',        name: 'Career Opportunities',    kw: ['career', 'job', 'jobs', 'employ', 'employment', 'employable', 'internship', 'placement', 'industry', 'graduate', 'salary', 'prospects', 'network'] },
  { key: 'support',       name: 'Student Support',         kw: ['support', 'help', 'helped', 'admin', 'administration', 'service', 'advisor', 'welfare', 'wellbeing', 'mental health', 'guidance'] },
  { key: 'housing',       name: 'Housing',                 kw: ['housing', 'accommodation', 'dorm', 'halls', 'residence', 'rent', 'flat', 'apartment', 'living', 'dormitory'] },
  { key: 'value',         name: 'Value for Money',         kw: ['cost', 'price', 'fee', 'fees', 'tuition', 'expensive', 'cheap', 'affordable', 'value', 'money', 'worth', 'scholarship'] }
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round1(v) { return Math.round(v * 10) / 10; }

// Map one comment → a star value in [1,5] from its weighted polarity.
function scoreComment(text) {
  var t = (' ' + String(text).toLowerCase() + ' ').replace(/[^a-z\s]/g, ' ');
  var pos = 0, neg = 0;
  for (var w in POS) if (t.indexOf(' ' + w) !== -1) pos += POS[w];
  for (var n in NEG) if (t.indexOf(' ' + n) !== -1) neg += NEG[n];
  if (pos === 0 && neg === 0) return { star: 3.6, pol: 0, hits: 0 };  // neutral baseline
  var pol = (pos - neg) / (pos + neg);                                 // [-1, 1]
  return { star: clamp(round1(3.6 + pol * 1.4), 1, 5), pol: pol, hits: pos + neg };
}

// ── Load EVERY frontend university across all country data files ──────────────
// app_data.js holds the default (Spain) set; the rest live in per-country JSON
// files ({be,ch,de,...}.json) loaded dynamically by the client.
function loadUNI() {
  var all = [];

  // Default set from app_data.js (var UNI = [...]).
  try {
    var src = fs.readFileSync(APP_DATA, 'utf8');
    var ctx = { window: {}, document: {}, console: console };
    vm.createContext(ctx);
    try { vm.runInContext(src, ctx, { timeout: 5000 }); } catch (e) { /* tolerate trailing refs */ }
    var U = ctx.UNI || (ctx.window && ctx.window.UNI) || [];
    all = all.concat(U);
  } catch (e) { console.warn('app_data.js:', e.message); }

  // Per-country JSON files.
  var dataDir = path.join(__dirname, '..', 'design', 'data');
  fs.readdirSync(dataDir).filter(function (f) {
    return /^[a-z]{2}\.json$/.test(f);                 // be.json, gb.json, us.json, …
  }).forEach(function (f) {
    try {
      var d = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
      if (d && Array.isArray(d.universities)) all = all.concat(d.universities);
    } catch (e) { console.warn(f + ':', e.message); }
  });

  return all;
}

function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function main() {
  var comments = JSON.parse(fs.readFileSync(COMMENTS, 'utf8'));
  var UNI = loadUNI();
  console.log('Loaded', UNI.length, 'frontend universities,', comments.length, 'comments');

  // Build lookup: normalized id / abbr / name → frontend id
  var byKey = {};
  UNI.forEach(function (u) {
    [u.id, u.abbr, u.name].forEach(function (k) { if (k) byKey[norm(k)] = u.id; });
  });

  // Group university comments by the frontend id they resolve to.
  var groups = {};   // frontId → [comment, ...]
  var unmatched = {};
  comments.forEach(function (c) {
    if (c.type !== 'university') return;
    var fid = byKey[norm(c.entityId)] || byKey[norm(c.name)];
    if (!fid) { unmatched[c.entityId] = (unmatched[c.entityId] || 0) + 1; return; }
    (groups[fid] = groups[fid] || []).push(c);
  });

  // Pre-score every comment once, and compute the global prior mean used for
  // Bayesian smoothing (so a uni with 1 glowing comment can't beat one with 30).
  var scored = {};      // fid → [{star, text}]
  var allStars = [];
  Object.keys(groups).forEach(function (fid) {
    scored[fid] = groups[fid].map(function (c) {
      var s = scoreComment(c.text);
      allStars.push(s.star);
      return { star: s.star, text: c.text };
    });
  });
  var PRIOR = round1(allStars.reduce(function (a, b) { return a + b; }, 0) / (allStars.length || 1));
  var C = 8;            // pseudo-reviews of weight toward the prior (avg)
  var CC = 4;           // lighter smoothing for per-category scores
  console.log('Global prior mean:', PRIOR, '(smoothing C=' + C + ')');

  var out = {};
  Object.keys(scored).forEach(function (fid) {
    var cs = scored[fid];
    var stars = [], dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    var catAcc = {};
    CATEGORIES.forEach(function (c) { catAcc[c.key] = []; });

    cs.forEach(function (c) {
      stars.push(c.star);
      dist[clamp(Math.round(c.star), 1, 5)]++;
      var lower = String(c.text).toLowerCase();
      CATEGORIES.forEach(function (cat) {
        for (var i = 0; i < cat.kw.length; i++) {
          if (lower.indexOf(cat.kw[i]) !== -1) { catAcc[cat.key].push(c.star); break; }
        }
      });
    });

    var sumStars = stars.reduce(function (a, b) { return a + b; }, 0);
    var total = cs.length;
    var avg = round1((C * PRIOR + sumStars) / (C + total));   // Bayesian-smoothed
    var distPct = {};
    [1, 2, 3, 4, 5].forEach(function (k) { distPct[k] = Math.round(dist[k] / total * 100); });
    // Fix rounding so percentages total 100.
    var sum = [1, 2, 3, 4, 5].reduce(function (a, k) { return a + distPct[k]; }, 0);
    if (sum !== 100 && total) {
      var top = [5, 4, 3, 2, 1].sort(function (a, b) { return dist[b] - dist[a]; })[0];
      distPct[top] += (100 - sum);
    }

    var cats = CATEGORIES.map(function (cat) {
      var arr = catAcc[cat.key];
      var s = arr.reduce(function (a, b) { return a + b; }, 0);
      var v = (CC * avg + s) / (CC + arr.length);        // smoothed toward this uni's avg
      return { key: cat.key, name: cat.name, value: round1(clamp(v, 1, 5)), n: arr.length };
    });

    out[fid] = { avg: avg, count: total, dist: distPct, cats: cats, real: true };
  });

  var matched = Object.keys(out).length;
  var topUnmatched = Object.keys(unmatched).sort(function (a, b) { return unmatched[b] - unmatched[a]; }).slice(0, 12);
  console.log('Matched ratings for', matched, 'universities.');
  console.log('Unmatched comment sources (top):', topUnmatched.join(', '));

  var banner = '/* AUTO-GENERATED by server/build-ratings.js — do not edit by hand.\n' +
               '   Fair star ratings derived from ' + comments.length + ' real student comments.\n' +
               '   Generated ' + new Date().toISOString() + ' */\n';
  fs.writeFileSync(OUT, banner + 'window.UNI_RATINGS = ' + JSON.stringify(out) + ';\n');
  console.log('Wrote', OUT);
}

main();
