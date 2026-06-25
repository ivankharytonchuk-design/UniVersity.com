'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   Persistent app store on Postgres (Neon).

   Holds the things that MUST survive restarts and follow a user across devices:
     • accounts   – server-side user accounts (email + bcrypt password hash)
     • sessions   – opaque session tokens
     • user_data  – per-user JSON blobs (saved unis, gradebook, deadlines, …),
                    keyed exactly like the old localStorage keys, so the whole
                    client data model maps across with no per-feature schema.

   If DATABASE_URL is unset, every function no-ops / reports disabled, so the
   server still boots (e.g. for local Stripe-only work).
   ──────────────────────────────────────────────────────────────────────────── */
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const RAW = process.env.DATABASE_URL || '';
// Strip query params (sslmode/channel_binding) — SSL is set explicitly below,
// which also avoids node-postgres' sslmode-alias deprecation warning.
const CONN = RAW.split('?')[0];
const pool = RAW ? new Pool({ connectionString: CONN, ssl: { rejectUnauthorized: false } }) : null;

const SESSION_DAYS = 60;
const norm = (e) => String(e || '').trim().toLowerCase();
const newId = () => 'u_' + crypto.randomBytes(9).toString('hex');
const newToken = () => crypto.randomBytes(32).toString('hex');

function enabled() { return !!pool; }

async function init() {
  if (!pool) { console.warn('[store] DATABASE_URL not set — server-side accounts disabled.'); return; }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      username      TEXT,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT now(),
      updated_at    TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_data (
      user_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      key        TEXT NOT NULL,
      value      JSONB,
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, key)
    );
  `);
  console.log('[store] Postgres schema ready.');
}

async function startSession(userId) {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)', [token, userId, expires]);
  return token;
}

async function register({ email, username, password }) {
  email = norm(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid_email');
  if (!password || String(password).length < 6) throw new Error('weak_password');
  const exists = await pool.query('SELECT id FROM accounts WHERE email=$1', [email]);
  if (exists.rows.length) throw new Error('email_taken');
  const id = newId();
  const hash = await bcrypt.hash(String(password), 10);
  await pool.query('INSERT INTO accounts (id,email,username,password_hash) VALUES ($1,$2,$3,$4)',
    [id, email, username || null, hash]);
  const token = await startSession(id);
  return { token, user: { id, email, username: username || null } };
}

async function login({ email, password }) {
  email = norm(email);
  const r = await pool.query('SELECT * FROM accounts WHERE email=$1', [email]);
  const acc = r.rows[0];
  if (!acc) throw new Error('no_such_user');
  const ok = await bcrypt.compare(String(password || ''), acc.password_hash);
  if (!ok) throw new Error('bad_password');
  await pool.query('UPDATE accounts SET updated_at=now() WHERE id=$1', [acc.id]);
  const token = await startSession(acc.id);
  return { token, user: { id: acc.id, email: acc.email, username: acc.username } };
}

async function userForToken(token) {
  if (!token || !pool) return null;
  const r = await pool.query(
    'SELECT a.id, a.email, a.username FROM sessions s JOIN accounts a ON a.id = s.user_id WHERE s.token=$1 AND s.expires_at > now()',
    [token]);
  return r.rows[0] || null;
}

async function logout(token) { if (token && pool) await pool.query('DELETE FROM sessions WHERE token=$1', [token]); }

async function getData(userId, key) {
  const r = await pool.query('SELECT value FROM user_data WHERE user_id=$1 AND key=$2', [userId, key]);
  return r.rows.length ? r.rows[0].value : null;
}
async function getAllData(userId) {
  const r = await pool.query('SELECT key, value FROM user_data WHERE user_id=$1', [userId]);
  const out = {};
  r.rows.forEach((row) => { out[row.key] = row.value; });
  return out;
}
async function putData(userId, key, value) {
  await pool.query(
    'INSERT INTO user_data (user_id,key,value,updated_at) VALUES ($1,$2,$3,now()) ' +
    'ON CONFLICT (user_id,key) DO UPDATE SET value=$3, updated_at=now()',
    [userId, String(key), JSON.stringify(value === undefined ? null : value)]);
}
async function deleteData(userId, key) {
  await pool.query('DELETE FROM user_data WHERE user_id=$1 AND key=$2', [userId, String(key)]);
}

module.exports = {
  enabled, init, register, login, userForToken, logout,
  getData, getAllData, putData, deleteData,
};
