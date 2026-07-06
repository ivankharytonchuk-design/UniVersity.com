'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   Student reviews — real, verified-user ratings that feed the star system.

   One review per user per university (re-submitting updates it). Stored in the
   app's SQLite DB. Exposes a small aggregate (count + average + recent texts)
   the frontend blends into the sentiment-derived base ratings.

   Self-contained: remove server/reviews.js + its two routes in server.js to undo.
   ──────────────────────────────────────────────────────────────────────────── */
const { db } = require('./db');

db.exec(`
  CREATE TABLE IF NOT EXISTS uni_reviews (
    uni_id     TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    author     TEXT,
    rating     REAL NOT NULL,
    text       TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uni_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_uni_reviews ON uni_reviews(uni_id);
`);

const _upsert = db.prepare(`
  INSERT INTO uni_reviews (uni_id, user_id, author, rating, text, created_at)
  VALUES (@uni_id, @user_id, @author, @rating, @text, datetime('now'))
  ON CONFLICT(uni_id, user_id) DO UPDATE SET
    author = @author, rating = @rating, text = @text, created_at = datetime('now')
`);
const _forUni = db.prepare(`SELECT author, rating, text, created_at FROM uni_reviews WHERE uni_id = ? ORDER BY created_at DESC`);
const _mine   = db.prepare(`SELECT rating, text FROM uni_reviews WHERE uni_id = ? AND user_id = ?`);

function clampRating(r) { r = Number(r); if (isNaN(r)) return null; return Math.max(1, Math.min(5, Math.round(r * 10) / 10)); }

function addReview({ uniId, userId, author, rating, text }) {
  uniId = String(uniId || '').trim();
  userId = String(userId || '').trim();
  const r = clampRating(rating);
  if (!uniId || !userId || r == null) throw new Error('invalid_review');
  const t = String(text || '').trim().slice(0, 1000);
  _upsert.run({ uni_id: uniId, user_id: userId, author: String(author || 'Student').slice(0, 60), rating: r, text: t });
  return getForUni(uniId, userId);
}

function getForUni(uniId, userId) {
  uniId = String(uniId || '').trim();
  const rows = _forUni.all(uniId);
  const count = rows.length;
  const avg = count ? Math.round((rows.reduce((a, b) => a + b.rating, 0) / count) * 10) / 10 : null;
  const items = rows.filter(r => r.text).slice(0, 12)
    .map(r => ({ author: r.author || 'Student', rating: r.rating, text: r.text, date: r.created_at }));
  const mine = userId ? _mine.get(uniId, String(userId)) : null;
  return { uniId, count, avg, items, mine: mine || null };
}

module.exports = { addReview, getForUni };
