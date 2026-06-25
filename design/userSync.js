/* ────────────────────────────────────────────────────────────────────────────
   UserSync — transparent localStorage ⇄ server sync.

   Load this BEFORE any other app script on a page. It wraps localStorage so that
   every write to an app-data key is mirrored to the server automatically. This
   means ANY feature — including pages/data you add in the future — is saved to
   the user's server account with zero extra wiring, as long as it uses
   localStorage with the app's `us_*` / `uniscout_*` key convention.

   Design:
     • Write-through: localStorage.setItem/removeItem on a syncable key → debounced
       PUT/DELETE /api/data/:key.
     • Hydrate / merge on login: pull the account's data down; server wins on
       conflicts; local-only keys are pushed up (so existing data migrates).
     • Safe fallback: with no session token (logged out, server down, or accounts
       disabled) it's a pure pass-through — the app behaves exactly as before.
   ──────────────────────────────────────────────────────────────────────────── */
(function () {
  var API = (function () {
    if (location.protocol === 'file:') return 'http://localhost:4242';
    var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (isLocal && location.port !== '4242') return 'http://localhost:4242';
    return location.origin;
  })();

  var TOKEN_KEY = 'us_session_token';
  // Keys that must never sync (auth / session / device-local / legacy local-auth).
  var DENY = [TOKEN_KEY, 'uniscout_session', 'uniscout_users',
              'uniscout_admin_session', 'uniscout_admin_pw', 'uniscout_admin_server_token'];

  var nativeSet = window.localStorage.setItem.bind(window.localStorage);
  var nativeRemove = window.localStorage.removeItem.bind(window.localStorage);
  var nativeGet = window.localStorage.getItem.bind(window.localStorage);

  function token() { return nativeGet(TOKEN_KEY) || ''; }
  function authHeaders(json) {
    var h = { 'authorization': 'Bearer ' + token() };
    if (json) h['content-type'] = 'application/json';
    return h;
  }
  function syncable(key) {
    if (!key || DENY.indexOf(key) !== -1) return false;
    if (key.indexOf('us_reset_') === 0) return false;
    return key.indexOf('us_') === 0 || key.indexOf('uniscout_') === 0;
  }
  function parseMaybe(v) { try { return JSON.parse(v); } catch (e) { return v; } }

  // ── Write-through (debounced) ──────────────────────────────────────────────
  var dirty = {}, timer = null, hydrating = false;
  function schedule() { if (!timer) timer = setTimeout(flush, 800); }
  function flush() {
    timer = null;
    if (!token()) { dirty = {}; return; }
    var keys = Object.keys(dirty); dirty = {};
    keys.forEach(function (k) {
      var v = nativeGet(k);
      if (v === null) {
        fetch(API + '/api/data/' + encodeURIComponent(k), { method: 'DELETE', headers: authHeaders() }).catch(function () {});
      } else {
        fetch(API + '/api/data/' + encodeURIComponent(k), {
          method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ value: parseMaybe(v) }),
        }).catch(function () {});
      }
    });
  }
  window.localStorage.setItem = function (k, v) {
    nativeSet(k, v);
    if (!hydrating && token() && syncable(k)) { dirty[k] = 1; schedule(); }
  };
  window.localStorage.removeItem = function (k) {
    nativeRemove(k);
    if (!hydrating && token() && syncable(k)) { dirty[k] = 1; schedule(); }
  };

  // ── Merge on login: server wins, push local-only keys up ───────────────────
  function mergeOnLogin() {
    if (!token()) return Promise.resolve(false);
    return fetch(API + '/api/data', { headers: authHeaders() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) {
        var server = (res && res.data) || {};
        var pushes = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (!syncable(k) || (k in server)) continue;   // server wins; only push gaps
          var v = nativeGet(k);
          pushes.push(fetch(API + '/api/data/' + encodeURIComponent(k), {
            method: 'PUT', headers: authHeaders(true), body: JSON.stringify({ value: parseMaybe(v) }),
          }).catch(function () {}));
        }
        hydrating = true;
        try {
          Object.keys(server).forEach(function (k) {
            var val = server[k];
            nativeSet(k, typeof val === 'string' ? val : JSON.stringify(val));
          });
        } finally { hydrating = false; }
        return Promise.all(pushes).then(function () { return true; });
      }).catch(function () { return false; });
  }

  // ── Auth API ───────────────────────────────────────────────────────────────
  function parse(r) { return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; }); }
  function register(email, username, password) {
    return fetch(API + '/api/account/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email, username: username, password: password }),
    }).then(parse);
  }
  function login(identifier, password) {
    return fetch(API + '/api/account/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: identifier, password: password }),
    }).then(parse);
  }
  function logout() {
    var t = token();
    nativeRemove(TOKEN_KEY);
    if (t) fetch(API + '/api/account/logout', { method: 'POST', headers: { 'authorization': 'Bearer ' + t } }).catch(function () {});
  }

  window.UserSync = {
    api: API,
    enabled: function () { return !!token(); },
    token: token,
    setToken: function (t) { if (t) nativeSet(TOKEN_KEY, t); },
    clearToken: function () { nativeRemove(TOKEN_KEY); },
    syncable: syncable,
    mergeOnLogin: mergeOnLogin,
    register: register,
    login: login,
    logout: logout,
  };
})();
