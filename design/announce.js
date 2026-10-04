/* Site-wide announcement from the admin panel (Settings → Announcement banner).
   A small bar floats at the bottom of the app; dismissing it hides that
   announcement for good on this device. */
(function () {
    'use strict';
    var API = (function () {
        if (location.protocol === 'file:') return 'http://localhost:4242';
        return (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port !== '4242') ? 'http://localhost:4242' : location.origin;
    }());
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    fetch(API + '/api/announcement').then(function (r) { return r.json(); }).then(function (d) {
        var a = d && d.announcement; if (!a) return;
        try { if (localStorage.getItem('us_ann_seen') === a.id) return; } catch (e) {}
        var col = { info: '#2f6bff', good: '#148a56', warn: '#b7791f' }[a.tone] || '#2f6bff';
        var css = document.createElement('style');
        css.textContent = '.us-ann{position:fixed;z-index:9000;left:50%;bottom:18px;display:flex;align-items:center;gap:12px;max-width:min(680px,calc(100vw - 24px));padding:10px 10px 10px 14px;border-radius:16px;background:#fff;color:#161512;' +
            'font:500 13.5px/1.4 "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 18px 40px -16px rgba(0,0,0,.4);transform:translate(-50%,0);animation:usAnn .6s cubic-bezier(.3,1.3,.5,1) .8s backwards}' +
            '.us-ann i.us-ann__ic{width:30px;height:30px;flex-shrink:0;display:grid;place-items:center;border-radius:10px;background:var(--c);color:#fff;font-size:13px;box-shadow:0 6px 14px -6px var(--c)}' +
            '.us-ann a{color:var(--c);font-weight:700;text-decoration:none;white-space:nowrap}.us-ann button{width:30px;height:30px;flex-shrink:0;border:0;border-radius:9px;background:rgba(0,0,0,.05);color:inherit;cursor:pointer}' +
            '[data-theme="dark"] .us-ann{background:#262522;color:#f3efe6}[data-theme="dark"] .us-ann button{background:rgba(255,255,255,.08)}' +
            '@keyframes usAnn{from{opacity:0;transform:translate(-50%,24px)}}@media (prefers-reduced-motion:reduce){.us-ann{animation:none}}';
        document.head.appendChild(css);
        var bar = document.createElement('div');
        bar.className = 'us-ann'; bar.setAttribute('role', 'status'); bar.style.setProperty('--c', col);
        bar.innerHTML = '<i class="fa-solid fa-bullhorn us-ann__ic" aria-hidden="true"></i><span>' + esc(a.text) + '</span>' + (a.link ? '<a href="' + esc(a.link) + '" target="_blank" rel="noopener">Learn more →</a>' : '') +
            '<button type="button" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
        bar.querySelector('button').addEventListener('click', function () { try { localStorage.setItem('us_ann_seen', a.id); } catch (e) {} bar.remove(); });
        document.body.appendChild(bar);
    }).catch(function () {});
})();
