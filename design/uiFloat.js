/* ════════════════════════════════════════════════════════════════════
   Ambient float — every card on every page drifts and tilts a little in
   place, each with its own tempo, amplitude and phase so nothing moves in
   lockstep. It runs as a Web Animation on the separate `translate` and
   `rotate` properties, so it layers on top of each card's own entrance
   animation and hover transforms instead of replacing them. A card holds
   still while the pointer is on it (so reading and clicking are easy).
   Cards that contain a position:fixed element (a modal/overlay) are
   skipped, because an animated card would trap that element inside it.
   A card only floats while it can be seen: off-screen cards, cards in
   hidden tabs and everything under an open modal/drawer hold still, so the
   browser isn't recalculating (and re-blurring behind glass overlays)
   motion nobody can see.
   Off under prefers-reduced-motion. Remove this script's include to undo.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!document.body || !document.body.animate) return;

    var SELECTORS = [
        // Overview
        '#countryStrip', '.ov-next', '.ov-clock', '.ov-card', '.ov-list', '.gmf__streak', '.gmf-sch', '.gmf-car',
        '#savedGrid .mp__uni__card', '#savedPlacesGrid > *', '.rdm__wrap', '.bm__card', '.dsh__widget',
        // Explore / Apply / City guide
        '.exp__hero', '.exp__filter__card', '.cg2__card', '.apf__hero', '.apf__banner', '.cmp__detail__card', '.rnk__section__wrap',
        // Chances
        '.ch-hero', '.ch-panel', '.ch-card', '.ch-alt', '.ch-cost', '.ch-sal',
        // Deadlines
        '.dt-ticket', '.dt-ruler', '.dt-list',
        // Gradebook
        '.gk-card', '.gk-panel', '.gb__gapcard', '.gb__plan', '.gb__rec__col', '.gk-whatif',
        // Careers + Scholarships (their cards have their own hover motion, so only sections float)
        '.crs__hero', '.crs__panel', '.sch-empty', '.sch-ext-block',
        // older layouts still in use in places
        '.mp__hero', '.ins__hero', '.ins__section', '.dlx__hero', '.dlx__stat', '.rzt__stat'
    ].join(',');

    // Never float anything inside a modal/overlay, the drawer or the page chrome.
    var EXCLUDE = '.mp__overlay, [role="dialog"], .csd, .usx, .gbsg, .fy__modal, .mp__header, nav';

    function rand(a, b) { return a + Math.random() * (b - a); }
    function hasFixedInside(el) {
        var all = el.getElementsByTagName('*');
        for (var i = 0; i < all.length; i++) if (getComputedStyle(all[i]).position === 'fixed') return true;
        return false;
    }

    function apply(el) {
        if (el.__fx) return;
        el.__fx = 1;
        if (el.closest(EXCLUDE) || hasFixedInside(el)) return;
        // Bigger blocks move a little less so they stay calm; small cards a bit more.
        var big = el.offsetHeight > 360 || el.offsetWidth > 900;
        var x = big ? rand(1, 1.8) : rand(1.6, 2.8), y = big ? rand(1.8, 2.8) : rand(2.6, 4.4), r = big ? rand(.25, .45) : rand(.5, 1), dur = rand(7, 12) * 1000;
        var anim;
        try {
            anim = el.animate([
                { translate: '0px 0px', rotate: '1 0 0 0deg' },
                { translate: (-x).toFixed(2) + 'px ' + (-y).toFixed(2) + 'px', rotate: '1 -1 0 ' + r.toFixed(2) + 'deg' },
                { translate: x.toFixed(2) + 'px ' + (-y * .4).toFixed(2) + 'px', rotate: '-1 1 0 ' + r.toFixed(2) + 'deg' },
                { translate: (x * .5).toFixed(2) + 'px ' + y.toFixed(2) + 'px', rotate: '1 1 0 ' + (r * .6).toFixed(2) + 'deg' },
                { translate: '0px 0px', rotate: '1 0 0 0deg' }
            ], { duration: dur, iterations: Infinity, easing: 'ease-in-out', delay: -rand(0, dur) });
        } catch (e) { return; }
        // Real depth for the tilt: perspective on the parent, unless the parent
        // holds a fixed-position element (perspective would trap it too).
        var p = el.parentElement;
        if (p && !p.__fxP) { p.__fxP = 1; if (!hasFixedInside(p)) p.style.perspective = '1400px'; }
        el.classList.add('fx-drift');
        // Hold still while the user is on it, while it's out of sight, and under a modal.
        var st = { anim: anim, hover: false, seen: !io };
        el.__fxs = st; floats.push(st); sync(st);
        if (io) io.observe(el);
        el.addEventListener('pointerenter', function () { st.hover = true; sync(st); });
        el.addEventListener('pointerleave', function () { st.hover = false; sync(st); });
        el.addEventListener('focusin', function () { st.hover = true; sync(st); });
        el.addEventListener('focusout', function (e) { if (!el.contains(e.relatedTarget)) { st.hover = false; sync(st); } });
    }

    var floats = [], covered = false;
    function sync(st) {
        var run = st.seen && !st.hover && !covered;
        if (run && st.anim.playState !== 'running') st.anim.play();
        else if (!run && st.anim.playState === 'running') st.anim.pause();
    }
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (en) {
        en.forEach(function (e) { var st = e.target.__fxs; if (st) { st.seen = e.isIntersecting; sync(st); } });
    }, { rootMargin: '120px' }) : null;
        // Is a full-screen overlay (modal, drawer, sheet) on top? Hit-test the middle of
    // the viewport and look for a fixed ancestor that covers it. Cheap, and works for
    // every modal without each one having to announce itself.
    function overlayOpen() {
        var n = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
        for (; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
            if (getComputedStyle(n).position !== 'fixed') continue;
            var r = n.getBoundingClientRect();
            if (r.width >= innerWidth * .85 && r.height >= innerHeight * .85) return true;
        }
        return false;
    }
    setInterval(function () {
        if (document.hidden) return;
        var c = overlayOpen();
        if (c !== covered) { covered = c; floats.forEach(sync); }
    }, 400);

    function scan(root) { (root || document).querySelectorAll(SELECTORS).forEach(apply); }
    var pending = false;
    function schedule() {
        if (pending) return;
        pending = true;
        var run = function () { pending = false; scan(); };
        if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: 600 });
        else setTimeout(run, 300);
    }
    function start() {
        scan();
        // Tabs/cards are rendered dynamically — pick up new ones as they appear.
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
