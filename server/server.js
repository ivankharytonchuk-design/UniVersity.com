'use strict';

/**
 * UniVersity — Stripe Elite subscription backend.
 *
 *  • Serves the existing static site from ../design
 *  • POST /api/checkout            → creates a Stripe Checkout Session (subscription)
 *  • POST /api/portal              → opens the Stripe Customer Portal
 *  • GET  /api/subscription/status → current Elite status for a user (from DB)
 *  • GET  /api/elite/content       → example Elite-only protected route
 *  • POST /webhook                 → verified Stripe webhook receiver (source of truth)
 *  • GET  /api/config              → publishable key for the frontend
 *
 * The DB is the source of truth; it is only mutated by verified webhook events
 * and the checkout bootstrap. The frontend is never trusted for payment state.
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const {
  upsertUser, getUserById, getUserByEmail, getUserByCustomer, setCustomerId, setManualElite,
  upsertSubscription, getLatestSubByUser, getActiveSubByUser,
  setSetting, getSetting,
} = require('./db');

// ── Config / env validation ───────────────────────────────────
const {
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_ID,
} = process.env;

const PORT = parseInt(process.env.PORT || '4242', 10);
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

if (!STRIPE_SECRET_KEY) {
  console.error('FATAL: STRIPE_SECRET_KEY is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
if (!STRIPE_WEBHOOK_SECRET) {
  console.warn('WARNING: STRIPE_WEBHOOK_SECRET is not set — /webhook will reject all events until you set it.');
}

const stripe = require('stripe')(STRIPE_SECRET_KEY);

const ELITE_STATUSES = ['active', 'trialing'];

// Accounts that are always Elite (granted manually, no Stripe needed).
// Match is case-insensitive against the user's email OR username.
const ELITE_ACCOUNTS = (process.env.ELITE_ACCOUNTS || 'vanyochek')
  .split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);

function isGrantedAccount(user) {
  if (!user) return false;
  return (user.email && ELITE_ACCOUNTS.indexOf(user.email.toLowerCase()) !== -1) ||
         (user.username && ELITE_ACCOUNTS.indexOf(user.username.toLowerCase()) !== -1);
}

// True Elite = active Stripe subscription OR a persisted manual grant.
function userIsElite(userId) {
  const sub = getLatestSubByUser(userId);
  if (sub && ELITE_STATUSES.indexOf(sub.status) !== -1) return true;
  const user = getUserById(userId);
  return !!(user && user.manual_elite);
}

// ── Helpers ───────────────────────────────────────────────────
const log = (...a) => console.log(new Date().toISOString(), ...a);
const errlog = (...a) => console.error(new Date().toISOString(), ...a);
// A stray rejected promise (a dropped fetch, a DB hiccup) must not take the whole
// server down — Node exits on unhandled rejections by default.
process.on('unhandledRejection', (e) => errlog('unhandled rejection:', (e && (e.stack || e.message)) || e));

/** Ensure a recurring €15/year Price exists; create + remember it if needed. */
let cachedPriceId = null;
async function ensurePrice() {
  if (cachedPriceId) return cachedPriceId;

  let priceId = STRIPE_PRICE_ID || getSetting('price_id');
  if (priceId) {
    try {
      const p = await stripe.prices.retrieve(priceId);
      if (p && p.active) { cachedPriceId = priceId; return priceId; }
    } catch (e) {
      errlog('Configured STRIPE_PRICE_ID invalid, will recreate:', e.message);
    }
  }

  const product = await stripe.products.create({
    name: 'UniVersity Elite',
    description: 'UniVersity Elite — full access to every destination, advanced tools and Elite status.',
    metadata: { app: 'uniscout', plan: 'elite' },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: 'eur',
    unit_amount: 1500,               // €15.00
    recurring: { interval: 'year' }, // yearly billing
    metadata: { app: 'uniscout', plan: 'elite' },
  });
  setSetting('price_id', price.id);
  cachedPriceId = price.id;
  log('Created Elite product/price:', product.id, price.id, '(€15/year)');
  return price.id;
}

/** Read the card / billing details attached to a subscription. */
async function getBillingFor(sub) {
  let pm = sub.default_payment_method;
  if (pm && typeof pm === 'string') pm = await stripe.paymentMethods.retrieve(pm);
  if (!pm) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const cust = await stripe.customers.retrieve(customerId);
    const defPm = cust && cust.invoice_settings && cust.invoice_settings.default_payment_method;
    if (defPm) pm = await stripe.paymentMethods.retrieve(defPm);
  }
  if (pm && pm.card) {
    return {
      card_brand: pm.card.brand,
      card_last4: pm.card.last4,
      billing_name: pm.billing_details && pm.billing_details.name,
      billing_email: pm.billing_details && pm.billing_details.email,
    };
  }
  return { card_brand: null, card_last4: null, billing_name: null, billing_email: null };
}

/** Work out which app user a subscription belongs to. */
function resolveUserId(sub) {
  if (sub.metadata && sub.metadata.userId) return sub.metadata.userId;
  const customerId = typeof sub.customer === 'string' ? sub.customer : (sub.customer && sub.customer.id);
  const u = getUserByCustomer(customerId);
  return u ? u.id : null;
}

/** Fetch a subscription from Stripe and persist its full state to our DB. */
async function syncSubscription(subscriptionId) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method'],
  });
  const userId = resolveUserId(sub);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

  // Keep the user <-> customer link fresh
  if (userId && customerId) {
    const u = getUserById(userId);
    if (u && !u.stripe_customer_id) setCustomerId(userId, customerId);
  }

  const billing = await getBillingFor(sub);
  upsertSubscription({
    id: sub.id,
    user_id: userId,
    customer_id: customerId,
    status: sub.status,
    price_id: sub.items.data[0] && sub.items.data[0].price.id,
    current_period_end: sub.current_period_end,
    cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
    ...billing,
  });
  log(`Synced subscription ${sub.id} → ${sub.status} (user ${userId || 'unknown'})`);
}

// ── App ───────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(require('compression')());   // gzip text assets (CSS/JS/HTML) — ~80% smaller over the wire

// IMPORTANT: the webhook needs the RAW body for signature verification, so it
// must be registered BEFORE the global express.json() parser.
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET || '');
  } catch (err) {
    errlog('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        if (s.client_reference_id && s.customer) setCustomerId(s.client_reference_id, s.customer);
        if (s.subscription) await syncSubscription(s.subscription);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await syncSubscription(event.data.object.id);
        break;
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        upsertSubscription({
          id: sub.id,
          user_id: resolveUserId(sub),
          customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          status: 'canceled',
          price_id: sub.items.data[0] && sub.items.data[0].price.id,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: 0,
        });
        log(`Subscription ${sub.id} canceled`);
        break;
      }
      case 'invoice.payment_succeeded': {
        const inv = event.data.object;
        if (inv.subscription) await syncSubscription(inv.subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const inv = event.data.object;
        errlog(`Payment FAILED for customer ${inv.customer} (invoice ${inv.id})`);
        if (inv.subscription) await syncSubscription(inv.subscription);
        break;
      }
      default:
        // Unhandled event types are fine to ignore.
        break;
    }
    res.json({ received: true });
  } catch (err) {
    errlog('Webhook handler error:', err);
    // 500 tells Stripe to retry later.
    res.status(500).send('Webhook handler failed');
  }
});

// JSON parser for the rest of the API
app.use(express.json({ limit: '8mb' }));   // synced values can hold a photo (data URL) — 100kb default rejected them

// Expose the publishable key (safe) to the frontend
app.get('/api/config', (_req, res) => {
  res.json({ publishableKey: STRIPE_PUBLISHABLE_KEY || null });
});

// ── Email verification codes (for Google/Apple sign-in) ──────
const nodemailer = require('nodemailer');
const authCodes = {};   // email -> { code, expires, attempts }

// Configure an email transporter from env (e.g. a Gmail App Password).
let mailer = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  log('Email transporter configured (' + process.env.SMTP_HOST + ')');
} else {
  log('No SMTP configured — verification codes will be logged to this console (dev mode).');
}

function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

app.post('/api/auth/send-code', async (req, res) => {
  try {
    var email = (req.body && req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid_email' });

    var code = genCode();
    authCodes[email] = { code: code, expires: Date.now() + 10 * 60 * 1000, attempts: 0 };

    if (mailer) {
      await mailer.sendMail({
        from: process.env.SMTP_FROM || ('UniVersity <' + process.env.SMTP_USER + '>'),
        to: email,
        subject: 'Your UniVersity verification code',
        text: 'Your UniVersity verification code is ' + code + '. It expires in 10 minutes.',
        html: '<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto">' +
              '<h2 style="color:#d97c14">UniVersity</h2>' +
              '<p>Your verification code is:</p>' +
              '<div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#1a1d23">' + code + '</div>' +
              '<p style="color:#777;font-size:13px">This code expires in 10 minutes. If you didn’t request it, ignore this email.</p></div>',
      });
      log('Sent verification code to ' + email);
    } else {
      // Dev fallback: never returned to the browser, only the server operator sees it.
      log('DEV verification code for ' + email + ': ' + code);
    }
    // The code is NEVER sent back to the client.
    res.json({ ok: true, delivered: !!mailer });
  } catch (err) {
    errlog('send-code error:', err);
    res.status(500).json({ error: 'send_failed', message: err.message });
  }
});

app.post('/api/auth/verify-code', (req, res) => {
  var email = (req.body && req.body.email || '').trim().toLowerCase();
  var code = (req.body && req.body.code || '').trim();
  var rec = authCodes[email];
  if (!rec) return res.status(400).json({ ok: false, error: 'no_code' });
  if (Date.now() > rec.expires) { delete authCodes[email]; return res.status(400).json({ ok: false, error: 'expired' }); }
  rec.attempts++;
  if (rec.attempts > 6) { delete authCodes[email]; return res.status(429).json({ ok: false, error: 'too_many_attempts' }); }
  if (code !== rec.code) return res.status(400).json({ ok: false, error: 'incorrect' });
  delete authCodes[email];
  res.json({ ok: true });
});

// ── Subscription status (read from DB — the source of truth) ──
app.get('/api/subscription/status', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'missing_user' });
  const email = req.query.email;
  const username = req.query.username;

  // Persist the user in the DB so manual Elite grants survive logout/login.
  // The same e-mail on a second device arrives with a new local id: keep the e-mail on
  // the row that already owns it (it's UNIQUE) and look Elite up through that row.
  let user = getUserById(userId);
  const owner = email ? getUserByEmail(email) : null;
  const emailFree = !owner || owner.id === userId;
  if (email || username || !user) {
    user = upsertUser({
      id: userId,
      email: emailFree ? (email || (user && user.email) || null) : ((user && user.email) || null),
      username: username || (user && user.username),
    });
  }

  // Auto-grant Elite to configured accounts and store it in the DB.
  if (isGrantedAccount(user) && !(user && user.manual_elite)) {
    setManualElite(userId, 1);
    user = getUserById(userId);
  }

  const sub = getLatestSubByUser(userId) || (owner && owner.id !== userId ? getLatestSubByUser(owner.id) : null);
  const subActive = !!(sub && ELITE_STATUSES.includes(sub.status));
  const byMail = owner || (user && user.email ? getUserByEmail(user.email) : null);   // a grant made from the admin panel follows the e-mail
  const manual = !!((user && user.manual_elite) || (byMail && byMail.manual_elite));
  const elite = subActive || manual;

  res.json({
    elite,
    status: subActive ? sub.status : (manual ? 'granted' : (sub ? sub.status : 'none')),
    manualElite: manual,
    currentPeriodEnd: sub ? sub.current_period_end : null,
    cancelAtPeriodEnd: sub ? !!sub.cancel_at_period_end : false,
    cardBrand: sub ? sub.card_brand : null,
    cardLast4: sub ? sub.card_last4 : null,
    billingName: sub ? sub.billing_name : null,
  });
});

// ── Admin: manually grant / revoke Elite (persisted in DB) ────
// Protected by ADMIN_TOKEN. Send header `x-admin-token` or body { token }.
app.post('/api/admin/grant-elite', (req, res) => {
  const token = req.headers['x-admin-token'] || (req.body && req.body.token);
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const { userId, email, username, revoke } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'missing_user' });
  upsertUser({ id: userId, email, username });
  setManualElite(userId, revoke ? 0 : 1);
  log(`Admin ${revoke ? 'revoked' : 'granted'} Elite for user ${userId}`);
  res.json({ ok: true, elite: !revoke });
});

// ── Create a Checkout Session (subscription, €15/year) ────────
app.post('/api/checkout', async (req, res) => {
  try {
    const { userId, email, username } = req.body || {};
    if (!userId || !email) return res.status(400).json({ error: 'missing_user' });

    const user = upsertUser({ id: userId, email, username });

    // Prevent duplicate subscriptions — if already active, send to the portal.
    if (getActiveSubByUser(userId)) {
      return res.status(409).json({ error: 'already_subscribed' });
    }

    // Reuse or create the Stripe customer for this user.
    let customerId = user.stripe_customer_id;
    if (customerId) {
      try { await stripe.customers.retrieve(customerId); }
      catch (_) { customerId = null; } // stale id (e.g. test data reset) → recreate
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name: username || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      setCustomerId(userId, customerId);
    }

    const priceId = await ensurePrice();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      allow_promotion_codes: true,
      subscription_data: { metadata: { userId } },
      success_url: `${APP_URL}/mainPage.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/mainPage.html?checkout=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    errlog('Checkout error:', err);
    res.status(500).json({ error: 'checkout_failed', message: err.message });
  }
});

// ── Confirm a completed Checkout Session (post-redirect) ──────
// Securely verifies the session with Stripe's API (not the frontend) and writes
// Elite status to the DB. Lets the glow appear immediately after payment without
// waiting for the webhook listener. Webhooks remain the source of truth for
// ongoing lifecycle (renewals, cancellations, failures).
app.get('/api/checkout/confirm', async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) return res.status(400).json({ error: 'missing_session' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid' || session.status === 'complete';

    if (paid) {
      if (session.client_reference_id && session.customer) {
        setCustomerId(session.client_reference_id, session.customer);
      }
      if (session.subscription) await syncSubscription(session.subscription);
    }

    const userId = session.client_reference_id;
    const sub = getLatestSubByUser(userId);
    const elite = !!(sub && ELITE_STATUSES.includes(sub.status));
    log(`Confirm session ${sessionId} → paid=${paid}, elite=${elite} (user ${userId || 'unknown'})`);
    res.json({ elite, status: sub ? sub.status : 'none', paid });
  } catch (err) {
    errlog('Confirm error:', err);
    res.status(500).json({ error: 'confirm_failed', message: err.message });
  }
});

// ── Customer Portal (manage / cancel / update card) ───────────
app.post('/api/portal', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'missing_user' });
    const user = getUserById(userId);
    if (!user || !user.stripe_customer_id) return res.status(404).json({ error: 'no_customer' });

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${APP_URL}/mainPage.html`,
    });
    res.json({ url: session.url });
  } catch (err) {
    errlog('Portal error:', err);
    res.status(500).json({ error: 'portal_failed', message: err.message });
  }
});

// ── Example protected Elite-only route ────────────────────────
function requireElite(req, res, next) {
  const userId = req.query.userId || (req.body && req.body.userId);
  if (userId && userIsElite(userId)) return next();
  return res.status(403).json({ error: 'elite_required' });
}
app.get('/api/elite/content', requireElite, (_req, res) => {
  res.json({ ok: true, secret: 'This payload is only returned to verified Elite members.' });
});

// ── UniVersity Intelligence (Qdrant retrieval + OpenAI synthesis) ────────────
const qdrant = require('./qdrant');
const synthesize = require('./synthesize');
const digest = require('./digest');
const news = require('./news');
const feeds = require('./feeds');
const store = require('./store');

// Admin panel API (admin.js): server-side login, sessions, users, Elite, AI log, health, audit.
const adminDeps = { db: require('./db'), store, stripe, ELITE_STATUSES, log };
const adminApi = require('./admin')(app, adminDeps);

// Housing scam check (community.js).
const communityDeps = { store, synth: synthesize, log, errlog };
require('./community')(app, communityDeps);
// Admissions data system: official data + public applicant self-reports found by a
// background research job (double-checked by a larger model, admin-reviewable).
const admissionsDeps = { store, log, errlog, admin: adminApi };
const admissions = require('./admissions')(app, admissionsDeps);
// Apply workspace (applications.js): applications, checklist, documents, writing
// versions, decisions/offers and the application assistant — per signed-in account.
function accountIsElite(acc) {
  try {
    if (!acc) return false;
    if (isGrantedAccount(acc)) return true;
    const u = acc.email ? getUserByEmail(acc.email) : null;
    return !!(u && (u.manual_elite || userIsElite(u.id)));
  } catch (e) { return false; }
}
const applicationsDeps = { store, synth: synthesize, log, errlog, requireAccount, isElite: accountIsElite };
require('./applications')(app, applicationsDeps);

function requireAdmin(req, res) {
  if (!adminApi.check(req)) {
    res.status(403).json({ error: 'forbidden', message: 'Admin token required' });
    return false;
  }
  return true;
}

// Public (used by the AI page): semantic search → returns real comments. NO LLM.
app.post('/api/ai/search', async (req, res) => {
  try {
    const { query, type, limit } = req.body || {};
    if (!query || !String(query).trim()) return res.status(400).json({ error: 'missing_query' });
    if (!qdrant.isConfigured()) return res.status(503).json({ error: 'not_configured', message: 'Search is not set up yet.' });
    const results = await qdrant.searchComments(String(query).trim(), { type: type, limit: Math.min(20, limit || 8) });
    res.json({ ok: true, query: query, count: results.length, results });
  } catch (e) {
    errlog('ai/search failed:', e.message);
    res.status(500).json({ error: 'search_failed', message: e.message });
  }
});

// Public (used by the AI page): researched answers, streamed (research.js).
// Live Reddit threads + comments, recent news, review-site opinions and our own
// dataset → a reasoning model weighs them and writes a cited answer. Streams
// newline-delimited JSON: stage / sources / thinking / delta / done / error.
const researchAI = require('./research');
app.post('/api/ai/research', async (req, res) => {
  const { query, history, deep } = req.body || {};
  const q = String(query || '').trim().slice(0, 1200);
  if (!q) return res.status(400).json({ error: 'missing_query' });
  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');   // no-transform → compression() leaves the stream alone
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();
  const ctrl = new AbortController();
  let closed = false;
  res.on('close', () => { closed = true; ctrl.abort(); });
  const emit = (evt) => { if (!closed) { res.write(JSON.stringify(evt) + '\n'); if (res.flush) res.flush(); } };
  const t0 = Date.now(), seen = { counts: {}, subject: null, error: null };
  const track = (evt) => { if (evt.type === 'done') seen.counts = evt.counts || {}; if (evt.type === 'stage' && evt.id === 'plan' && evt.state === 'done') seen.subject = String(evt.detail || '').split(' · ').pop(); if (evt.type === 'error') seen.error = evt.message; emit(evt); };
  try {
    const hist = Array.isArray(history) ? history.slice(-3).map((h) => ({ q: String(h && h.q || '').slice(0, 600), a: String(h && h.a || '').slice(0, 1500) })).filter((h) => h.q) : [];
    await researchAI.research(q, { history: hist, deep: !!deep, signal: ctrl.signal }, track);
  } catch (e) {
    seen.error = e.message;
    if (!closed) { errlog('ai/research failed:', e.message); emit({ type: 'error', message: /401|invalid api key/i.test(e.message) ? 'The AI key on the server was rejected.' : 'Research failed — ' + e.message }); }
  }
  if (adminDeps.logAI) adminDeps.logAI({ userId: req.body && req.body.userId, query: q, subject: seen.subject, ms: Date.now() - t0, ok: !seen.error && !closed, deep: !!deep,
    reddit: seen.counts.reddit, news: seen.counts.news, reviews: seen.counts.reviews, error: closed ? 'stopped by user' : seen.error });
  if (!closed) res.end();
});

// Older JSON endpoint — same pipeline, answer returned in one piece.
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { query } = req.body || {};
    if (!query || !String(query).trim()) return res.status(400).json({ error: 'missing_query' });
    const out = await researchAI.research(String(query).trim().slice(0, 1200), {});
    res.json({ ok: true, query, answer: out.answer, sources: out.sources || [], model: 'research', grounded: (out.sources || []).length });
  } catch (e) {
    errlog('ai/ask failed:', e.message);
    res.status(500).json({ error: 'ask_failed', message: e.message });
  }
});

// ── AI application assistant: draft / critique personal statements ──────────
app.post('/api/ai/essay', async (req, res) => {
  try {
    const { mode, university, program, degree, notes, draft } = req.body || {};
    const uni  = String(university || '').trim();
    const prog = String(program || '').trim();
    const deg  = String(degree || '').trim();
    const isCritique = mode === 'critique';

    if (isCritique && !String(draft || '').trim()) {
      return res.status(400).json({ error: 'missing_draft', message: 'Paste your draft to get feedback.' });
    }
    if (!isCritique && !String(notes || '').trim()) {
      return res.status(400).json({ error: 'missing_notes', message: 'Add a few notes about yourself first.' });
    }

    const system =
      'You are an expert university admissions coach and writing mentor. You help applicants write ' +
      'authentic, compelling personal statements / motivation letters. Rules: be honest and specific; ' +
      'never invent achievements or facts the student did not provide; keep an encouraging, human tone; ' +
      'avoid clichés and generic filler; write in clear, natural English. Format with short paragraphs ' +
      '(and headings/bullets only when genuinely helpful).';

    const target = [
      prog && ('Programme: ' + prog),
      deg  && ('Degree level: ' + deg),
      uni  && ('University: ' + uni)
    ].filter(Boolean).join('\n');

    let userMsg, maxTokens, temperature;
    if (isCritique) {
      userMsg =
        (target ? target + '\n\n' : '') +
        'Critique the following personal statement. Give: (1) a short overall impression, ' +
        '(2) 3–6 concrete strengths and weaknesses as bullets, (3) specific, actionable suggestions, ' +
        'and (4) one rewritten opening paragraph as an example. Be candid but constructive.\n\n' +
        '--- DRAFT ---\n' + String(draft).trim();
      maxTokens = 1100; temperature = 0.5;
    } else {
      userMsg =
        (target ? target + '\n\n' : '') +
        'Write a first-draft personal statement (~450–550 words) based ONLY on these notes about the ' +
        'applicant. Make it specific and authentic; do not fabricate awards, grades or experiences ' +
        'beyond what is given. Leave a clearly-marked [add a specific example here] placeholder where ' +
        'the student should add detail rather than inventing it.\n\n--- APPLICANT NOTES ---\n' +
        String(notes).trim();
      maxTokens = 1200; temperature = 0.75;
    }

    const out = await synthesize.chat(system, userMsg, { maxTokens, temperature });
    if (!out.text) return res.status(502).json({ error: 'empty', message: 'The AI returned an empty response. Try again.' });
    res.json({ ok: true, mode: isCritique ? 'critique' : 'draft', text: out.text, model: out.model });
  } catch (e) {
    if (e && e.code === 'not_configured') {
      return res.status(503).json({ error: 'not_configured', message: 'The AI writing assistant is not set up yet (no API key).' });
    }
    errlog('ai/essay failed:', e.message);
    res.status(500).json({ error: 'essay_failed', message: e.message });
  }
});

// ── AI university matcher: a holistic recommendation from the shortlist ──────
// The browser sends the student's full profile + the deterministically-ranked
// shortlist; the LLM (Groq via the shared chat() helper — no browser key needed)
// weighs everything (grades, budget, career goals, sport/chess talents, hobbies)
// and recommends the best-fit universities *from that list only*.
app.post('/api/ai/match', async (req, res) => {
  try {
    const { profile, candidates } = req.body || {};
    const list = (Array.isArray(candidates) ? candidates : []).filter((u) => u && u.id != null).slice(0, 20);
    if (!list.length) return res.status(400).json({ error: 'missing_candidates', message: 'No shortlisted universities to analyse.' });

    const p = profile || {};
    const num = (n) => Number(n).toLocaleString();
    const profLines = [
      p.subjects && p.subjects.length ? 'Favourite subjects: ' + p.subjects.join(', ') : null,
      (p.exp || p.avg) ? 'Expected grade: ' + (p.exp || p.avg) + '%' : null,
      p.level ? 'Study level: ' + p.level : null,
      p.lang ? 'Preferred teaching language: ' + p.lang : null,
      p.budget ? 'Yearly tuition budget: up to €' + num(p.budget) : null,
      (p.maxLiving && p.maxLiving < 2500) ? 'Max monthly living cost: €' + num(p.maxLiving) : null,
      (p.vibe && p.vibe !== 'any') ? 'City vibe: ' + (p.vibe === 'big' ? 'big city' : 'smaller town') : null,
      p.hobbies && p.hobbies.length ? 'Hobbies & interests: ' + p.hobbies.join(', ') : null,
      p.sport ? ('Sport: ' + p.sport + (p.athlete ? ' (level ' + p.athlete + '/5 — may qualify for athletic support/scholarships)' : '')) : null,
      p.priorities && p.priorities.length ? 'What matters most: ' + p.priorities.join(', ') : null,
      p.minSalary ? 'Wants graduate salary at least €' + num(p.minSalary) : null,
      p.minEmployer ? 'Wants employer-recruitment match at least ' + p.minEmployer + '%' : null,
      p.rankTier ? 'Prefers a top-' + p.rankTier + ' university' : null,
    ].filter(Boolean).join('\n');

    const candText = list.map((u) =>
      '[' + u.id + '] ' + u.name + ' — ' + [u.city, u.country].filter(Boolean).join(', ') +
      '; tuition ' + (u.tuition || 'n/a') +
      '; entry difficulty ' + (u.difficulty || '?') + '/5' +
      (u.acceptance != null ? '; ~' + u.acceptance + '% acceptance' : '') +
      (u.salary ? '; ~€' + num(u.salary) + ' median graduate salary' : '') +
      (u.employer != null ? '; ' + u.employer + '% employer-recruitment match' : '') +
      (u.fields && u.fields.length ? '; fields: ' + u.fields.slice(0, 6).join(', ') : '') +
      (u.langs && u.langs.length ? '; taught in ' + u.langs.join('/') : '')
    ).join('\n');

    const limit = list.length;
    const system =
      'You are UniVersity AI, an expert university admissions advisor. You score and rank universities for a specific ' +
      'student by weighing their WHOLE profile — academic subjects and grades, tuition budget and living-cost limits, ' +
      'teaching language, career priorities (graduate salary, employer reputation, prestige), lifestyle (city vibe, ' +
      'hobbies) and any sporting or competitive talent. Student athletes, and even strong chess/esports players, often ' +
      'get scholarships, facilities, or a more flexible admissions path at certain universities — factor that in where ' +
      'it genuinely applies. Consider outside factors the raw filters miss (subject strength, city fit, talent ' +
      'pathways, career outcomes, value for money). Never invent universities or numbers. ' +
      'Be generous and realistic rather than strict: a university that meets most of what the student wants is still a ' +
      'good match, and one that misses a preference is a partial match, not a rejection. ' +
      'Give EVERY candidate a "match" percentage from 0-100: 75-100 = a real match, 55-74 = might match, below 55 = a ' +
      'stretch. Spread the scores realistically; it is normal for several to land above 75. ' +
      'Each candidate is listed as "[id] Name — details". Reply with STRICT JSON only, no prose, in exactly this ' +
      'shape: {"ranked":[{"id":"<the id exactly as inside the square brackets, without the brackets>",' +
      '"match":<integer 0-100>,"reason":"<max 12 words, why it fits or does not fit THIS student>"}]} ' +
      'Order best-first (highest match first). Include ALL ' + limit + ' candidates — never leave one out. ' +
      'Use only ids from the candidate list.';

    const userMsg =
      'STUDENT PROFILE\n' + (profLines || '(the student gave only minimal preferences)') + '\n\n' +
      'CANDIDATE UNIVERSITIES (rank only these, by their id)\n' + candText + '\n\n' +
      'Return the ranked JSON now.';

    const out = await synthesize.chat(system, userMsg, { maxTokens: 1800, temperature: 0.4, json: true });
    if (!out.text) return res.status(502).json({ error: 'empty', message: 'The AI returned an empty response.' });

    // Parse defensively: tolerate code fences / stray prose around the JSON.
    let parsed = null;
    try {
      const raw = out.text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
      const s = raw.indexOf('{'), e2 = raw.lastIndexOf('}');
      parsed = JSON.parse(s >= 0 && e2 > s ? raw.slice(s, e2 + 1) : raw);
    } catch (_) { /* fall through */ }

    // Models like to echo back decoration ("id=a", "[a]") — strip it before matching.
    const normId = (v) => String(v == null ? '' : v).trim()
      .replace(/^id\s*[:=]\s*/i, '')
      .replace(/^\[|\]$/g, '')
      .replace(/^\(|\)$/g, '')
      .trim();
    const known = new Set(list.map((u) => String(u.id)));
    const seen = new Set();
    // Accept {ranked:[...]}, a bare array, or the first array found in the object.
    let arr = null;
    if (Array.isArray(parsed)) arr = parsed;
    else if (parsed && Array.isArray(parsed.ranked)) arr = parsed.ranked;
    else if (parsed && typeof parsed === 'object') arr = Object.values(parsed).find(Array.isArray) || null;

    const clampPct = (v) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
    };
    const ranked = (arr || [])
      .map((r) => ({
        id: normId(r && r.id),
        match: clampPct(r && r.match),
        reason: String((r && r.reason) || '').slice(0, 90),
      }))
      .filter((r) => known.has(r.id) && !seen.has(r.id) && seen.add(r.id))
      .slice(0, limit);

    if (!ranked.length) {
      errlog('ai/match unparseable reply:', JSON.stringify(String(out.text).slice(0, 600)));
      return res.status(502).json({ error: 'parse_failed', message: 'The AI did not return a usable ranking.' });
    }
    res.json({ ok: true, ranked, model: out.model });
  } catch (e) {
    if (e && e.code === 'not_configured') {
      return res.status(503).json({ error: 'not_configured', message: 'The AI advisor is not set up yet (no API key).' });
    }
    errlog('ai/match failed:', e.message);
    res.status(500).json({ error: 'match_failed', message: e.message });
  }
});

// ── Server-side accounts + per-user data sync (Postgres / Neon) ─────────────
function bearerToken(req) {
  const h = req.headers['authorization'] || '';
  if (h.indexOf('Bearer ') === 0) return h.slice(7);
  return (req.query && req.query.token) || (req.body && req.body.sessionToken) || null;
}
async function requireAccount(req, res) {
  const user = await store.userForToken(bearerToken(req));
  if (!user) { res.status(401).json({ error: 'unauthorized' }); return null; }
  return user;
}

app.post('/api/account/register', async (req, res) => {
  if (!store.enabled()) return res.status(503).json({ error: 'accounts_disabled' });
  try {
    const out = await store.register(req.body || {});
    try { upsertUser({ id: out.user.id, email: out.user.email, username: out.user.username }); } catch (e) {}
    res.json({ ok: true, ...out });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/account/login', async (req, res) => {
  if (!store.enabled()) return res.status(503).json({ error: 'accounts_disabled' });
  try {
    const out = await store.login(req.body || {});
    try { upsertUser({ id: out.user.id, email: out.user.email, username: out.user.username }); } catch (e) {}
    res.json({ ok: true, ...out });
  } catch (e) { res.status(401).json({ error: e.message }); }
});

app.get('/api/account/me', async (req, res) => {
  const user = await requireAccount(req, res); if (!user) return;
  res.json({ ok: true, user });
});

app.post('/api/account/logout', async (req, res) => {
  try { await store.logout(bearerToken(req)); } catch (e) {}
  res.json({ ok: true });
});

// Per-user data: each key is one JSON blob (mirrors the old localStorage keys).
// ── Student reviews (feed the star ratings) ──
const reviews = require('./reviews');
app.get('/api/reviews/:uniId', (req, res) => {
  try { res.json({ ok: true, ...reviews.getForUni(req.params.uniId, (req.query && req.query.userId) || '') }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/reviews', (req, res) => {
  try {
    const b = req.body || {};
    res.json({ ok: true, ...reviews.addReview({ uniId: b.uniId, userId: b.userId, author: b.author, rating: b.rating, text: b.text }) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/data', async (req, res) => {
  const user = await requireAccount(req, res); if (!user) return;
  try { res.json({ ok: true, data: await store.getAllData(user.id) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/data/:key', async (req, res) => {
  const user = await requireAccount(req, res); if (!user) return;
  try { res.json({ ok: true, value: await store.getData(user.id, req.params.key) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/data/:key', async (req, res) => {
  const user = await requireAccount(req, res); if (!user) return;
  try { await store.putData(user.id, req.params.key, req.body ? req.body.value : null); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/data/:key', async (req, res) => {
  const user = await requireAccount(req, res); if (!user) return;
  try { await store.deleteData(user.id, req.params.key); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Daily university-news digest ──────────────────────────────
// The browser keeps each user's saved-university list in sync here (saved unis
// live in the browser's localStorage), so the daily job knows what to look up.

// Stripe is the permanent record of every Elite buyer. We mirror each buyer's
// favourites + destination country into their subscription METADATA so the weekly
// digest can reach them with personalisation even after the (ephemeral) local DB
// is reset. Returns [{ email, universities, country }] for all Elite subscribers.
async function listEliteRecipients() {
  const out = [];
  for (const status of ELITE_STATUSES) {
    let starting_after;
    do {
      const page = await stripe.subscriptions.list({
        status, limit: 100, starting_after, expand: ['data.customer'],
      });
      for (const s of page.data) {
        const cust = (s.customer && typeof s.customer === 'object') ? s.customer : null;
        const email = (s.metadata && s.metadata.digest_email) || (cust && cust.email) || null;
        if (!email) continue;
        let universities = [];
        try { universities = JSON.parse((s.metadata && s.metadata.digest_unis) || '[]'); } catch (e) {}
        out.push({ email, universities, country: (s.metadata && s.metadata.digest_country) || null });
      }
      starting_after = page.has_more ? page.data[page.data.length - 1].id : null;
    } while (starting_after);
  }
  return out;
}

// Persist a buyer's digest preferences into their active Stripe subscription's
// metadata. Looks the subscription up straight from Stripe by email so it works
// even when the local DB has been reset. No-op for non-Elite / no subscription.
async function persistDigestPrefs(email, universities, country) {
  try {
    if (!email) return;
    const customers = await stripe.customers.list({ email: String(email).toLowerCase(), limit: 1 });
    const cust = customers.data[0];
    if (!cust) return;
    const subs = await stripe.subscriptions.list({ customer: cust.id, status: 'all', limit: 10 });
    const sub = subs.data.find(function (s) { return ELITE_STATUSES.indexOf(s.status) !== -1; });
    if (!sub) return;
    const names = (Array.isArray(universities) ? universities : [])
      .map(function (u) { return typeof u === 'string' ? u : (u && u.name) || ''; })
      .map(function (s) { return String(s).trim(); }).filter(Boolean);
    let unisJson = JSON.stringify(names.slice(0, 30));
    while (unisJson.length > 480 && names.length) { names.pop(); unisJson = JSON.stringify(names); }
    await stripe.subscriptions.update(sub.id, {
      metadata: { digest_email: email, digest_unis: unisJson, digest_country: country || '' },
    });
  } catch (e) { errlog('persistDigestPrefs failed:', e.message); }
}

// ── Daily global education-news feed (news.js agent) ──────────
// Returns today's curated top-10. Cached server-side for 24h; ?force=1 rebuilds.
app.get('/api/news', async (req, res) => {
  try {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : null;
    const data = await news.getNews({ force: req.query.force === '1', date });
    res.json({
      generatedAt: data.generatedAt || Date.now(),
      date: data.date || null,
      nextRefresh: news.nextBoundary(),
      count: (data.items || []).length,
      items: data.items || [],
    });
  } catch (e) {
    res.status(500).json({ error: 'news_failed', items: [] });
  }
});

// The days that have an archived brief (for the feed's date picker).
app.get('/api/news/dates', (req, res) => {
  try { res.json({ dates: news.availableDates() }); }
  catch (e) { res.json({ dates: [] }); }
});

// Per-university news for the Feed sidebar (the user's CURRENT saved universities).
// Served from feeds.js: kept on disk and refreshed in the background every few
// hours, so opening the feed is instant and survives restarts.
app.get('/api/uni-news', async (req, res) => {
  try {
    const names = String(req.query.unis || '').split(',').map(s => s.trim()).filter(Boolean);
    const out = await feeds.forUnis(names);
    res.json({ ok: true, news: out.news, refreshedAt: out.refreshedAt });
  } catch (e) { res.status(500).json({ error: 'uni_news_failed', news: {} }); }
});
app.get('/api/feeds/status', (req, res) => {
  try { res.json({ ok: true, ...feeds.status(), briefStale: news.isStale(), nextBrief: news.nextBoundary() }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Cron trigger to force-rebuild today's news (protected by the same token as the
// digest cron). Responds immediately, rebuilds in the background (~15-30s).
//   GET /api/news/cron?token=DIGEST_CRON_TOKEN
app.all('/api/news/cron', (req, res) => {
  const want = process.env.DIGEST_CRON_TOKEN;
  const got = (req.query && req.query.token) || req.get('x-cron-token');
  if (!want || got !== want) return res.status(403).json({ error: 'forbidden' });
  res.json({ ok: true, started: true });
  news.refresh()
    .then(d => log('news refreshed:', (d.items || []).length, 'stories'))
    .catch(e => errlog('news refresh failed:', e.message));
});

app.post('/api/digest/subscribe', (req, res) => {
  try {
    const { email, userId, universities, country } = req.body || {};
    const out = digest.subscribe({ email, userId, universities, country });
    // Durable live list (Neon) — survives restarts and beats Stripe/targets-file copies.
    store.setDigestPrefs(email, (universities || []).map(function (u) { return typeof u === 'string' ? u : (u && u.name) || ''; }).filter(Boolean), country)
      .catch(function () {});
    // Mirror into Stripe metadata (durable) — fire-and-forget, Elite users only.
    persistDigestPrefs(email, universities, country);
    store.setDigestOptOut(email, false).catch(function () {});   // opted in
    res.json({ ok: true, ...out });
  } catch (e) { res.status(400).json({ error: 'subscribe_failed', message: e.message }); }
});

// Admin: list every Elite member (from Stripe — the durable source of truth).
app.get('/api/admin/elite', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const members = await listEliteRecipients();
    res.json({ ok: true, count: members.length, members });
  } catch (e) { res.status(500).json({ error: 'list_failed', message: e.message }); }
});

app.post('/api/digest/unsubscribe', (req, res) => {
  try {
    const email = (req.body && req.body.email) || '';
    const out = digest.unsubscribe(email);
    store.setDigestOptOut(email, true).catch(function () {});   // durable opt-out (turns the weekly email off for good)
    res.json({ ok: true, ...out });
  } catch (e) { res.status(400).json({ error: 'unsubscribe_failed', message: e.message }); }
});

// Send the digest right now (on-demand / for testing). Optional { email } sends
// to just that subscriber; otherwise every subscriber.
app.post('/api/digest/run-now', async (req, res) => {
  try {
    const email = (req.body && req.body.email) || undefined;
    const results = await digest.runDigest(mailer, synthesize, email);
    res.json({ ok: true, mailer: !!mailer, results });
  } catch (e) { res.status(500).json({ error: 'run_failed', message: e.message }); }
});

// External daily trigger so a free cron pinger (cron-job.org, GitHub Actions, …)
// can fire the digest even on hosts whose in-process timer sleeps. Protect with
// ?token=DIGEST_CRON_TOKEN (or an x-cron-token header).
app.all('/api/digest/cron', async (req, res) => {
  const want = process.env.DIGEST_CRON_TOKEN;
  const got = (req.query && req.query.token) || req.get('x-cron-token');
  if (!want || got !== want) return res.status(403).json({ error: 'forbidden' });
  // Respond immediately, then send in the background. A full run (news lookups for
  // every Elite subscriber) can take minutes — longer than a free host's HTTP
  // request timeout — so we must not make the cron pinger wait for it.
  res.json({ ok: true, started: true, mailer: !!mailer });
  (async () => {
    try {
      digest.seedFromTargetsFile();   // insert-only; never overrides a synced list
      // Recipients, de-duped by email with the FIRST source winning, most-live first:
      //   1. Neon digest_state (what the app last synced — the real saved list)
      //   2. local SQLite subscribers   3. Stripe metadata (fallback after a DB reset)
      let durable = [];
      try { durable = await store.getDigestStates(); } catch (e) {}
      const seenByEmail = {};
      durable.forEach(function (d) { if (d.seen) seenByEmail[String(d.email).toLowerCase()] = d.seen; });
      let elite = [];
      try { elite = await listEliteRecipients(); }
      catch (e) { errlog('listEliteRecipients failed:', e.message); }
      // Honour the "weekly email" toggle: drop anyone who opted out (durable, Neon).
      let optouts = [];
      try { optouts = await store.getDigestOptOuts(); } catch (e) {}
      const offSet = {}; optouts.forEach(function (e) { offSet[String(e).toLowerCase()] = 1; });
      const recipients = durable.filter(function (d) { return d.universities; })
        .concat(digest._all.all(), elite)
        .filter(function (r) { return r.email && !offSet[String(r.email).toLowerCase()]; })
        .map(function (r) {
          const k = String(r.email).toLowerCase();
          return Object.assign({}, r, { seen: seenByEmail[k] != null ? seenByEmail[k] : r.seen });
        });
      const results = await digest.runDigest(mailer, synthesize, null, recipients, {
        onSeen: function (email, list) { store.setDigestSeen(email, list).catch(function () {}); },
      });
      log('Cron digest: ' + results.filter(r => r.sent).length + '/' + results.length +
          ' sent (' + elite.length + ' Elite from Stripe).');
    } catch (e) { errlog('Cron digest failed:', e.message); }
  })();
});

// Schedule the digest to run once a day at DIGEST_HOUR (local time, default 08:00).
// Wall-clock schedule: a minute tick checks whether today's run is due, so a
// Mac that slept through DIGEST_HOUR still sends once it wakes (a 24 h
// setTimeout would drift by however long the machine slept). runDigest's own
// per-person rate limit stops double sends after restarts.
function scheduleDailyDigest() {
  const HOUR = parseInt(process.env.DIGEST_HOUR || '8', 10);
  const STATE = path.join(__dirname, 'data', 'digest-schedule.json');
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  let last = ''; try { last = JSON.parse(fs.readFileSync(STATE, 'utf8')).last || ''; } catch (e) {}
  let running = false;
  function check() {
    if (running || new Date().getHours() < HOUR || last === today()) return;
    running = true; last = today();
    try { fs.writeFileSync(STATE, JSON.stringify({ last })); } catch (e) {}
    try { digest.seedFromTargetsFile(); } catch (e) {}
    digest.runDigest(mailer, synthesize)
      .then(r => log('Daily digest run:', JSON.stringify(r.map(x => ({ to: x.email, sent: !!x.sent, headlines: x.headlines, skipped: x.skipped })))))
      .catch(e => errlog('Daily digest failed:', e.message))
      .then(() => { running = false; });
  }
  setTimeout(check, 15000);
  setInterval(check, 60 * 1000);
  log('Daily digest checks every minute for ' + HOUR + ':00 local.' + (mailer ? '' : ' NOTE: no SMTP configured — emails will not send until SMTP_* is set in .env.'));
}

// Admin: status / indexed count
app.get('/api/admin/qdrant/status', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    res.json({
      ok: true, configured: qdrant.isConfigured(), collection: qdrant.COLLECTION,
      corpusSize: qdrant.loadCorpus().length,
      indexed: qdrant.isConfigured() ? await qdrant.indexedCount() : 0
    });
  } catch (e) { res.status(500).json({ error: 'status_failed', message: e.message }); }
});

// Admin: (re)index the whole corpus
app.post('/api/admin/qdrant/reindex', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try { const r = await qdrant.reindexAllComments(); log('Qdrant reindexed:', r.indexed); res.json({ ok: true, indexed: r.indexed }); }
  catch (e) { errlog('reindex failed:', e.message); res.status(500).json({ error: 'reindex_failed', message: e.message }); }
});

// Admin: test semantic search
app.post('/api/admin/qdrant/test', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try { const results = await qdrant.searchComments(String((req.body && req.body.query) || 'student life'), { limit: 5 }); res.json({ ok: true, results }); }
  catch (e) { res.status(500).json({ error: 'test_failed', message: e.message }); }
});

// Admin: configure Qdrant URL/key (persisted in settings; never exposed to users)
app.post('/api/admin/qdrant/config', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { url, apiKey } = req.body || {};
  if (url) { setSetting('qdrant_url', url); process.env.QDRANT_URL = url; }
  if (apiKey) { setSetting('qdrant_api_key', apiKey); process.env.QDRANT_API_KEY = apiKey; }
  res.json({ ok: true, configured: qdrant.isConfigured() });
});

// ── Static site (serve the existing frontend) ─────────────────
app.use(express.static(path.join(__dirname, '..', 'design')));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', 'design', 'index.html')));

// ── Boot ──────────────────────────────────────────────────────
app.listen(PORT, async () => {
  log(`UniVersity payment server listening on ${APP_URL}`);
  try { await store.init(); } catch (e) { errlog('store.init failed:', e.message); }
  // Qdrant config: .env wins; otherwise fall back to admin-saved settings.
  try {
    if (!process.env.QDRANT_URL) { const u = getSetting('qdrant_url'); if (u) process.env.QDRANT_URL = u; }
    if (!process.env.QDRANT_API_KEY) { const k = getSetting('qdrant_api_key'); if (k) process.env.QDRANT_API_KEY = k; }
    log('Qdrant configured:', qdrant.isConfigured());
  } catch (e) { /* settings optional */ }
  try {
    const priceId = await ensurePrice();
    log('Elite price ready:', priceId);
  } catch (e) {
    errlog('Could not ensure Elite price on boot (will retry on first checkout):', e.message);
  }
  if (!STRIPE_WEBHOOK_SECRET) {
    log('Reminder: run `stripe listen --forward-to localhost:' + PORT + '/webhook` and put the printed whsec_ into .env');
  }
  scheduleDailyDigest();
  feeds.start({ log, errlog });
});
