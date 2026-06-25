'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   Standalone daily-digest runner — decoupled from the web server.

   Run it from ANY scheduler (a cloud cron, GitHub Actions, a VPS crontab, macOS
   launchd, or a Claude scheduled routine):

       node digest-cron.js

   It needs:
     • SMTP_USER + SMTP_PASS in the environment (.env or host secrets) to send.
     • Subscribers. It uses the SQLite subscribers the app synced AND, for hosts
       that don't share that DB, an optional committed `digest-targets.json`:
           [ { "email": "you@gmail.com",
               "universities": ["Harvard University", "University of Oxford"] } ]
   ──────────────────────────────────────────────────────────────────────────── */
require('dotenv').config();
const nodemailer = require('nodemailer');
const digest = require('./digest');
const synthesize = require('./synthesize');

let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

(async () => {
  const hasResend = !!process.env.RESEND_API_KEY;
  const seeded = digest.seedFromTargetsFile();
  const results = await digest.runDigest(mailer, synthesize);
  const sentCount = results.filter(r => r.sent).length;
  console.log(JSON.stringify({
    ranAt: new Date().toISOString(),
    provider: hasResend ? 'resend' : (mailer ? 'smtp' : 'none'),
    seededFromFile: seeded,
    subscribers: results.length,
    sentCount,
    sent: results.map(r => ({ to: r.email, sent: !!r.sent, headlines: r.headlines, reason: r.reason || r.skipped || r.error || null })),
  }, null, 2));

  // Fail LOUDLY (non-zero exit → red ❌ in GitHub Actions) so a broken digest is
  // visible instead of silently "succeeding" while sending nothing.
  if (!hasResend && !mailer) {
    console.error('\n[!] No email provider configured. Set RESEND_API_KEY (preferred) — or SMTP_USER + SMTP_PASS — as environment variables / GitHub Actions secrets.');
    process.exit(1);
  }
  if (results.length === 0) {
    console.error('\n[!] No subscribers. Add your email to server/digest-targets.json (and commit it) so the cloud runner knows who to email.');
    process.exit(1);
  }
  if (sentCount === 0) {
    console.error('\n[!] 0 emails sent — see each recipient\'s "reason" above. Common cause: Resend rejecting the "onboarding@resend.dev" sender (it can only deliver to your own Resend account email until you verify a domain).');
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('digest-cron failed:', e); process.exit(1); });
