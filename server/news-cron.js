'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   Standalone daily education-news refresher — decoupled from the web server.

   Run it from ANY scheduler (a cloud cron, GitHub Actions, a VPS crontab, macOS
   launchd, Render/Railway cron, or a Claude scheduled routine), once every 24h:

       node news-cron.js

   It rebuilds data/news-today.json so the /api/news endpoint always serves a
   fresh top-10 — even while the web server (and your PC) is off, as long as the
   scheduler runs somewhere. Needs OPENAI_API_KEY or GROQ_API_KEY in the env for
   the AI curation (the same key the app already uses); without it, it will still
   fetch headlines but with a plain extractive fallback.
   ──────────────────────────────────────────────────────────────────────────── */
require('dotenv').config();
const news = require('./news');

(async () => {
  const data = await news.getNews(true);
  const count = (data.items || []).length;
  console.log(JSON.stringify({ ranAt: new Date().toISOString(), stories: count }, null, 2));
  if (!count) {
    console.error('\n[!] 0 stories built. Check network access to news.google.com and that OPENAI_API_KEY / GROQ_API_KEY is set.');
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('news-cron failed:', e); process.exit(1); });
