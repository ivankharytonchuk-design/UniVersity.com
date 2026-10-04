/* ════════════════════════════════════════════════════════════════════
   Overview — a small 2D Satoru Gojo sitting on the end of your name.
   One flat picture (images/gojo-chibi.webp) animated like a paper
   puppet: the head and the body are two clipped copies of the same image,
   so the head can nod and turn on its own while the body breathes.
   Every 6–11 seconds he turns towards your cursor and a little "Six Eyes"
   glint flashes on the blindfold; hover him and he hops with an Infinity
   ripple. He sits exactly on the top of the last letter at any size (the
   seat is measured from the real font).
   Everything moves with CSS transforms on the compositor — no render
   loop, no WebGL. A still picture under reduced motion.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var host = document.getElementById('ovKid');
    var nameEl = document.getElementById('heroName');
    var tab = document.getElementById('tabOverview');
    if (!host || !nameEl || !tab) return;
    var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var SRC = 'images/gojo-chibi.webp';
    var RATIO = 258 / 360;               // image width / height
    var SEAT_X = .55;                    // where he sits, as a share of the image width

    host.innerHTML =
        '<span class="ov-kid__fig">' +
            '<img class="ov-kid__body" src="' + SRC + '" alt="" draggable="false">' +
            '<span class="ov-kid__head"><img src="' + SRC + '" alt="" draggable="false"><i class="ov-kid__glint"></i></span>' +
        '</span>' +
        '<i class="ov-kid__ripple"></i>';
    var fig = host.querySelector('.ov-kid__fig');

    /* ── Sitting on the name ──────────────────────────────────────── */
    var ink = document.createElement('canvas'), inkCtx = ink.getContext('2d', { willReadFrequently: true });
    var seat = { ok: false, x: 0, y: 0 }, fontPx = 58;
    // Find where to sit on the real ink of the last letter: its highest point (the peak of an A,
    // the right end of a flat top), measured by drawing the letter off-screen in the same font.
    function inkTop(ch, font, px) {
        var pad = Math.ceil(px * .3), w = Math.ceil(px * 1.4) + pad * 2, h = Math.ceil(px * 1.5), base = Math.round(px * 1.15);
        ink.width = w; ink.height = h;
        inkCtx.clearRect(0, 0, w, h); inkCtx.font = font; inkCtx.fillStyle = '#000'; inkCtx.textBaseline = 'alphabetic';
        inkCtx.fillText(ch, pad, base);
        var data = inkCtx.getImageData(0, 0, w, h).data, tops = [], best = h;
        for (var x = 0; x < w; x++) { var y = 0; while (y < h && data[(y * w + x) * 4 + 3] < 128) y++; tops.push(y); if (y < best) best = y; }
        var a = -1, b = -1;                                    // the flat run at the very top (within 2 px)
        tops.forEach(function (y, x) { if (y <= best + 2) { if (a < 0) a = x; b = x; } });
        if (a < 0) return null;
        return { x: a + (b - a) * .62 - pad, rise: base - best };   // x from the glyph origin; height of the top above the baseline
    }
    function place() {
        var text = (nameEl.textContent || '').trim();
        if (!text) { host.style.visibility = 'hidden'; seat.ok = false; return; }
        var cs = getComputedStyle(nameEl);
        fontPx = parseFloat(cs.fontSize) || 58;
        var font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        inkCtx.font = font;
        var last = inkCtx.measureText(text.slice(-1));
        var nr = nameEl.getBoundingClientRect(), wr = host.parentElement.getBoundingClientRect();
        // the baseline, read straight from layout: a zero-size inline box sits exactly on it
        var probe = host.parentElement.querySelector('.ov-kid__base');
        if (!probe) { probe = document.createElement('i'); probe.className = 'ov-kid__base'; probe.setAttribute('aria-hidden', 'true'); nameEl.after(probe); }
        var baseline = probe.getBoundingClientRect().top || nr.bottom - fontPx * .24;
        var top = inkTop(text.slice(-1), font, fontPx) || { x: last.width * .5, rise: fontPx * .72 };
        var H = Math.round(fontPx * .92), W = Math.round(H * RATIO);
        var seatX = nr.right - last.width + top.x - wr.left, seatY = baseline - top.rise - wr.top + fontPx * .025;   // sink a hair into the letter
        host.style.width = W + 'px'; host.style.height = H + 'px';
        host.style.left = (seatX - W * SEAT_X).toFixed(1) + 'px';
        host.style.top = (seatY - H).toFixed(1) + 'px';
        host.style.visibility = 'visible';
        seat = { ok: true, x: nr.right - last.width + top.x, y: baseline - top.rise - H * .6 };
    }

    /* ── Moods: idle ↔ looking at you ─────────────────────────────── */
    var pointer = { x: 0, y: 0, has: false }, lookT = 0, backT = 0;
    window.addEventListener('pointermove', function (e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.has = true; }, { passive: true });
    function live() { return tab.style.display !== 'none' && !document.hidden && seat.ok; }
    function lookAtYou() {
        clearTimeout(lookT);
        if (live()) {
            // turn the head towards the cursor (or just towards you, if it hasn't moved yet)
            var dx = pointer.has ? Math.max(-1, Math.min(1, (pointer.x - seat.x) / 420)) : 0;
            var dy = pointer.has ? Math.max(-1, Math.min(1, (pointer.y - seat.y) / 360)) : 0;
            host.style.setProperty('--look', (dx * 11).toFixed(1) + 'deg');
            host.style.setProperty('--nod', (dy * 2.5).toFixed(1) + '%');
            host.classList.remove('is-looking'); void host.offsetWidth; host.classList.add('is-looking');
            clearTimeout(backT);
            backT = setTimeout(function () { host.classList.remove('is-looking'); }, 2400 + Math.random() * 900);
        }
        lookT = setTimeout(lookAtYou, 6000 + Math.random() * 5000);
    }
    function hop() {
        if (host.classList.contains('is-hop')) return;
        host.classList.add('is-hop');
        setTimeout(function () { host.classList.remove('is-hop'); }, 900);
    }
    fig.addEventListener('pointerenter', hop);
    fig.addEventListener('click', hop);

    var pt = 0;
    function replace() { clearTimeout(pt); pt = setTimeout(place, 60); }
    new MutationObserver(replace).observe(nameEl, { childList: true, characterData: true, subtree: true });
    new MutationObserver(function () { if (tab.style.display !== 'none') replace(); }).observe(tab, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', replace);
    if ('ResizeObserver' in window) new ResizeObserver(replace).observe(host.parentElement.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
    place();
    // wait for the picture before the entrance, so he never pops in half-loaded
    var img = host.querySelector('.ov-kid__body');
    function ready() { host.classList.add('is-ready'); if (!REDUCED) lookT = setTimeout(lookAtYou, 3500 + Math.random() * 2500); }
    if (img.complete) ready(); else { img.addEventListener('load', ready); img.addEventListener('error', function () { host.remove(); }); }
})();
