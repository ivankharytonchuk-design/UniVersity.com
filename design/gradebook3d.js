/* ════════════════════════════════════════════════════════════════════
   Gradebook 3D — your subjects as a small skyline on a turntable.
   Each subject is a CSS 3D block whose height is its mark; a see-through
   "goal plane" floats at the mark your dream university asks for, so the
   blocks poking through it are the subjects already good enough. Blocks
   whose top clears the plane light up lime. It turns slowly on its own;
   drag to spin it. Pure CSS 3D (preserve-3d) — heights ease via the
   registered --h property. Motion stops off-screen and under
   prefers-reduced-motion (then it sits still at a fixed angle).
   Data comes from mainPage.js through window.gbSnapshot().
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var stage = document.getElementById('gkStage');
    var tab = document.getElementById('tabGradebook');
    if (!stage || !tab) return;
    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var FLOOR = 150, H = 86, GAP = 10;
    var GHOST = [0.55, 0.8, 0.45, 0.7, 0.62];

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

    stage.innerHTML =
        '<div class="gk-tilt"><div class="gk-spin" id="gkSpin">' +
            '<div class="gk-floor"></div><div class="gk-bars" id="gkBars"></div><div class="gk-goal" id="gkGoal"></div>' +
        '</div></div>' +
        '<p class="gk-stage__cap" id="gkCap"></p>';
    var spin = document.getElementById('gkSpin'), barsEl = document.getElementById('gkBars'), goal = document.getElementById('gkGoal'), cap = document.getElementById('gkCap');

    /* ── Layout: bars in a small grid, centred on the floor ─────────── */
    function layout(n) {
        var cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n)))), rows = Math.ceil(n / cols);
        var size = Math.max(18, Math.min(34, Math.floor((FLOOR - 24 - GAP * (cols - 1)) / cols)));
        var w = cols * size + (cols - 1) * GAP, d = rows * size + (rows - 1) * GAP;
        var ox = (FLOOR - w) / 2, oy = (FLOOR - d) / 2;
        var out = [];
        for (var i = 0; i < n; i++) {
            var r = Math.floor(i / cols), c = i % cols;
            var inRow = r === rows - 1 ? n - r * cols : cols, shift = (cols - inRow) * (size + GAP) / 2;   // centre a short last row
            out.push({ x: ox + shift + c * (size + GAP), y: oy + r * (size + GAP), s: size });
        }
        return out;
    }
    function bar(p, i, color, ghost) {
        return '<div class="gk-bar' + (ghost ? ' is-ghost' : '') + '" style="left:' + p.x + 'px;top:' + p.y + 'px;width:' + p.s + 'px;height:' + p.s + 'px;--c:' + esc(color) + ';--i:' + i + '">' +
            '<i class="gk-f gk-f--t"></i><i class="gk-f gk-f--n"></i><i class="gk-f gk-f--s"></i><i class="gk-f gk-f--e"></i><i class="gk-f gk-f--w"></i></div>';
    }

    /* ── Render / update ─────────────────────────────────────────────── */
    var lastKey = '';
    function render() {
        var snap = typeof window.gbSnapshot === 'function' ? window.gbSnapshot() : null;
        var subs = snap ? snap.subjects.filter(function (s) { return s.avg != null; }).slice(0, 12) : [];
        var ghost = !subs.length;
        var key = ghost ? 'ghost' : subs.map(function (s) { return s.id; }).join(',');
        var list = ghost ? GHOST.map(function (v, i) { return { id: 'g' + i, avg: v, color: '#8ea0d8' }; }) : subs;
        var max = ghost ? 1 : snap.max;
        if (key !== lastKey) {
            lastKey = key;
            var pos = layout(list.length);
            barsEl.innerHTML = list.map(function (s, i) { return bar(pos[i], i, s.color || '#8ea0d8', ghost); }).join('');
            barsEl.querySelectorAll('.gk-bar').forEach(function (b) { b.style.setProperty('--h', '0px'); });
            void barsEl.offsetWidth;   // start from the floor, then rise
        }
        var req = !ghost && snap.req != null ? Math.max(0, Math.min(1, snap.req / max)) : null;
        barsEl.querySelectorAll('.gk-bar').forEach(function (b, i) {
            var s = list[i]; if (!s) return;
            var v = Math.max(0, Math.min(1, s.avg / max));
            b.style.setProperty('--h', Math.max(4, Math.round(v * H)) + 'px');
            b.classList.toggle('is-met', req != null && v >= req - 1e-9);
            b.title = ghost ? '' : s.name + ' · ' + Math.round(s.avg * 10) / 10 + ' ' + snap.hint;
        });
        goal.hidden = req == null;
        if (req != null) goal.style.setProperty('--gh', Math.round(req * H) + 'px');
        if (ghost) cap.innerHTML = 'Your subjects appear here in 3D.';
        else if (req != null) {
            var met = barsEl.querySelectorAll('.gk-bar.is-met').length;
            cap.innerHTML = '<i class="gk-cap__plane" aria-hidden="true"></i>' + esc(snap.aim) + ' bar · <b>' + met + '/' + subs.length + '</b> subjects clear it';
        } else cap.textContent = subs.length + ' subject' + (subs.length === 1 ? '' : 's') + ' · drag to turn';
    }
    window.gb3dRender = render;

    /* ── Turntable: slow auto-spin + drag ────────────────────────────── */
    var angle = -32, dragging = false, lastX = 0, vel = 0, raf = 0, last = 0, visible = true;
    function apply() { spin.style.transform = 'rotateZ(' + angle.toFixed(2) + 'deg)'; }
    function loop(t) {
        raf = 0;
        var dt = last ? Math.min(64, t - last) : 16; last = t;
        if (!dragging) { vel *= 0.94; angle += (Math.abs(vel) > 0.02 ? vel : 0) + dt * 0.009; }
        apply();
        if (visible && tab.style.display !== 'none' && !document.hidden) raf = requestAnimationFrame(loop); else last = 0;
    }
    function start() { if (!REDUCED && !raf) raf = requestAnimationFrame(loop); }
    stage.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; vel = 0; stage.setPointerCapture(e.pointerId); stage.classList.add('is-drag'); });
    stage.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dx = e.clientX - lastX; lastX = e.clientX;
        angle += dx * 0.5; vel = dx * 0.5; apply();
    });
    function end() { dragging = false; stage.classList.remove('is-drag'); start(); }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }).observe(stage);
    document.addEventListener('visibilitychange', start);
    new MutationObserver(function () { if (tab.style.display !== 'none') { render(); start(); } }).observe(tab, { attributes: true, attributeFilter: ['style'] });

    apply();
    render();
    start();
})();
