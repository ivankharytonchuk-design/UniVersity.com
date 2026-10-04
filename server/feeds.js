'use strict';
/* ════════════════════════════════════════════════════════════════════════════
   Feeds that are ready BEFORE anyone opens the page.

   • The daily education brief (news.js) is rebuilt as soon as it goes stale
     (11:00 local), not when the first visitor happens to ask for it.
   • Every watched university's news (the Feed sidebar) is refreshed in the
     background every UNI_TTL and kept on disk (data/uni-feed.json), so a
     restart or a crash never empties it and /api/uni-news answers instantly.
     "Watched" = any university a visitor's saved list asked for in the last
     WATCH_DAYS, plus the email-digest subscribers' universities.
   • Each story keeps the time WE first found it and its published date, so the
     timeline is the same on every device.

   Scheduling is wall-clock based: one tick a minute compares the real time with
   what's due. Long setTimeouts stall while a Mac sleeps (Node's timers use a
   clock that stops during sleep); a minute tick simply catches up after wake.
   ════════════════════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const news = require('./news');
const digest = require('./digest');

const FILE = path.join(__dirname, 'data', 'uni-feed.json');
const UNI_TTL = 6 * 60 * 60 * 1000;          // refresh each university every 6 h
const WATCH_DAYS = 45;                        // stop watching unis nobody asked for in 45 days
const KEEP = 40;                              // stories kept per university
const GAP_MS = 2500;                          // spacing between background fetches (Google News + LLM limits)

let state = { unis: {}, brief: {} };
let log = (...a) => console.log(new Date().toISOString(), ...a);
let errlog = (...a) => console.error(new Date().toISOString(), ...a);

function load() {
    try { const s = JSON.parse(fs.readFileSync(FILE, 'utf8')); if (s && s.unis) state = s; } catch (e) { /* first run */ }
    state.brief = state.brief || {};
}
// Load at require time, not in start(): requests can arrive before the server's
// boot sequence calls start(), and saving an empty state then would wipe the file.
load();
let saveT = null;
function save() {   // debounced, atomic (write + rename) so a crash can't leave half a file
    clearTimeout(saveT);
    saveT = setTimeout(() => {
        try { const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state)); fs.renameSync(tmp, FILE); }
        catch (e) { errlog('[feeds] save failed:', e.message); }
    }, 300);
}

const clean = (n) => String(n || '').trim().slice(0, 120);
function storyKey(it) {
    const t = String(it.title || it.blurb || '').toLowerCase().replace(/\s+-\s+[^-]{2,60}$/, '').replace(/[^a-z0-9]+/g, ' ').trim();
    return t.slice(0, 90) || String(it.url || '');
}
function entry(name) {
    const e = state.unis[name] || (state.unis[name] = { asked: 0, fetched: 0, items: [] });
    e.items = e.items || [];
    return e;
}

/* ── one university ── */
const inflight = {};
async function refreshUni(name) {
    if (inflight[name]) return inflight[name];
    inflight[name] = (async () => {
        const e = entry(name);
        try {
            const raw = await digest.fetchNews('"' + name + '"', 12, 21);
            if (!raw.length) { const first = !e.fetched; e.fetched = Date.now(); if (first) save(); return 0; }
            const picked = await digest.curate({ kind: 'university', name }, raw, 5);
            const byLink = {}; raw.forEach((r) => { byLink[r.link] = r; });
            const have = {}; e.items.forEach((x) => { have[x.key] = 1; });
            const now = Date.now();
            let added = 0;
            picked.forEach((it, i) => {
                const key = storyKey(it);
                if (!key || have[key]) return;
                const src = byLink[it.url] || {};
                const pub = Date.parse(src.date || '') || null;
                e.items.push({ key, blurb: it.blurb, type: it.type, url: it.url, title: it.title, published: pub, found: now + i });
                have[key] = 1; added++;
            });
            e.items.sort((a, b) => b.found - a.found);
            e.items = e.items.slice(0, KEEP);
            const first = !e.fetched;
            e.fetched = now;
            if (added || first) save();   // nothing new → no disk write
            return added;
        } catch (err) { errlog('[feeds] ' + name + ':', err.message); return 0; }
        finally { delete inflight[name]; }
    })();
    return inflight[name];
}

/* ── the background queue (one at a time, spaced) ── */
const queue = [];
let pumping = false;
function enqueue(name) { if (queue.indexOf(name) === -1 && !inflight[name]) queue.push(name); pump(); }
async function pump() {
    if (pumping) return;
    pumping = true;
    try {
        while (queue.length) {
            const n = queue.shift();
            const added = await refreshUni(n);
            if (added) log('[feeds] ' + n + ': +' + added + ' stories');
            await new Promise((r) => setTimeout(r, GAP_MS));
        }
    } finally { pumping = false; }
}

function digestUnis() {
    const out = [];
    try { (digest._all.all() || []).forEach((s) => { try { JSON.parse(s.universities || '[]').forEach((u) => out.push(clean(u))); } catch (e) {} }); } catch (e) {}
    return out.filter(Boolean);
}

/* ── the minute tick ── */
let lastTick = Date.now(), briefRunning = false, briefTried = 0;
function tick() {
    const now = Date.now();
    if (now - lastTick > 3 * 60 * 1000) log('[feeds] woke up after ' + Math.round((now - lastTick) / 60000) + ' min — catching up');
    lastTick = now;

    // 1) the daily brief — rebuilt the moment it's stale, so the first visitor never waits
    if (!briefRunning && news.isStale() && now - briefTried > 15 * 60 * 1000) {   // retry a failed build every 15 min, not every minute
        briefRunning = true; briefTried = now;
        news.refresh()
            .then((d) => { state.brief.at = Date.now(); state.brief.stories = (d.items || []).length; save(); log('[feeds] daily brief ready: ' + (d.items || []).length + ' stories'); })
            .catch((e) => errlog('[feeds] daily brief failed:', e.message))
            .then(() => { briefRunning = false; });
    }

    // 2) every watched university whose news is older than UNI_TTL
    digestUnis().forEach((n) => { const e = entry(n); e.asked = Math.max(e.asked || 0, now - 1); });
    let pruned = false;
    Object.keys(state.unis).forEach((n) => {
        const e = state.unis[n];
        if (now - (e.asked || 0) > WATCH_DAYS * 86400000) { delete state.unis[n]; pruned = true; return; }
        if (now - (e.fetched || 0) > UNI_TTL) enqueue(n);
    });
    if (pruned) save();
}

/* ── API used by /api/uni-news ── */
// Answers from disk at once. A university we've never fetched is fetched now
// (first visit only); stale ones are refreshed in the background.
async function forUnis(names) {
    names = names.map(clean).filter(Boolean).slice(0, 15);
    // Reading never writes to disk: "asked" is kept in memory and saved with the next real change.
    // (A write per request made dev servers that watch the project — VS Code Live Server —
    // reload the page, which requested again: an endless refresh loop.)
    const now = Date.now(), fresh = [];
    names.forEach((n) => { const e = entry(n); e.asked = now; if (!e.fetched) fresh.push(n); else if (now - e.fetched > UNI_TTL) enqueue(n); });
    if (fresh.length) await Promise.race([Promise.all(fresh.map(refreshUni)), new Promise((r) => setTimeout(r, 25000))]);
    const out = {};
    names.forEach((n) => {
        out[n] = (state.unis[n].items || []).map((x) => ({ blurb: x.blurb, type: x.type, url: x.url, title: x.title, published: x.published, found: x.found }));
    });
    return { news: out, refreshedAt: Math.max(0, ...names.map((n) => state.unis[n].fetched || 0)) };
}

function status() {
    const unis = Object.keys(state.unis);
    return {
        watched: unis.length, queued: queue.length,
        oldest: unis.length ? new Date(Math.min(...unis.map((n) => state.unis[n].fetched || 0))).toISOString() : null,
        brief: state.brief,
    };
}

function start(opts) {
    opts = opts || {};
    if (opts.log) log = opts.log;
    if (opts.errlog) errlog = opts.errlog;
    setTimeout(tick, 4000);
    setInterval(tick, 60 * 1000);
    log('[feeds] watching ' + Object.keys(state.unis).length + ' universities; brief ' + (news.isStale() ? 'stale → building now' : 'fresh'));
}

module.exports = { start, forUnis, status, refreshUni };
