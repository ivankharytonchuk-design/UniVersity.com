/* ════════════════════════════════════════════════════════════════════
   UniVersity · Premium Star Rating System  ·  window.UniRating
   --------------------------------------------------------------------
   Vanilla adaptation of a Next.js/Framer-Motion spec for this stack.
   Deterministic per-university ratings (stable across renders), a
   compact card chip, and an interactive breakdown modal with
   progressive-fill stars, count-up numbers, animated distribution
   bars, category averages, and a rewarding rate-it interaction.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    // ── Custom rounded "premium" star path + shared gradient (injected once)
    // Crisp, refined 5-point star (slightly rounded joins via CSS) — not blobby.
    var STAR_PATH = 'M12 2.6l2.74 5.55 6.12.89-4.43 4.32 1.05 6.1L12 16.66' +
        'l-5.47 2.8 1.05-6.1L3.15 9.04l6.12-.89z';

    function injectDefs() {
        if (document.getElementById('ur-svg-defs')) return;
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.id = 'ur-svg-defs';
        svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        svg.innerHTML =
            '<defs>' +
                '<linearGradient id="ur-grad" x1="0" y1="0" x2="0.35" y2="1">' +
                    '<stop offset="0" stop-color="#f7a83a"/>' +
                    '<stop offset="1" stop-color="#d97c14"/>' +
                '</linearGradient>' +
                '<symbol id="ur-star" viewBox="0 0 24 24"><path d="' + STAR_PATH + '"/></symbol>' +
            '</defs>';
        document.body.appendChild(svg);
    }

    var STAR_SVG = '<svg class="ur-star" viewBox="0 0 24 24" aria-hidden="true"><use href="#ur-star"/></svg>';
    function fiveStars() { return STAR_SVG + STAR_SVG + STAR_SVG + STAR_SVG + STAR_SVG; }

    // ── Deterministic pseudo-random (so a university's rating never shifts)
    function hash(str) {
        str = String(str);
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    var CATEGORIES = [
        { name: 'Academic Quality',          icon: 'fa-solid fa-graduation-cap' },
        { name: 'Teaching Quality',          icon: 'fa-solid fa-chalkboard-user' },
        { name: 'Campus Life',               icon: 'fa-solid fa-people-roof' },
        { name: 'Facilities',                icon: 'fa-solid fa-building-columns' },
        { name: 'International Experience',   icon: 'fa-solid fa-earth-americas' },
        { name: 'Career Opportunities',      icon: 'fa-solid fa-briefcase' },
        { name: 'Student Support',           icon: 'fa-solid fa-hands-holding-child' },
        { name: 'Housing',                   icon: 'fa-solid fa-house-chimney' },
        { name: 'Value for Money',           icon: 'fa-solid fa-coins' }
    ];

    var SCALE_LABELS = ['', 'Poor', 'Below Average', 'Good', 'Excellent', 'Outstanding'];
    function avgLabel(v) {
        if (v >= 4.6) return 'Outstanding';
        if (v >= 4.0) return 'Excellent';
        if (v >= 3.0) return 'Good';
        if (v >= 2.0) return 'Below Average';
        return 'Poor';
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function round1(v) { return Math.round(v * 10) / 10; }

    // Deterministic fallback for universities with no collected reviews yet —
    // stable per id so a card never changes between renders.
    var CACHE = {};
    function fallbackProfile(id) {
        if (CACHE[id]) return CACHE[id];
        var r = mulberry32(hash(id));
        var w = [0.5 + r() * 5, 1 + r() * 7, 2 + r() * 15, 10 + r() * 24, 40 + r() * 46];
        var tot = w[0] + w[1] + w[2] + w[3] + w[4];
        var exact = w.map(function (v) { return v / tot * 100; });
        var pct = exact.map(Math.floor);
        var rem = 100 - pct.reduce(function (a, b) { return a + b; }, 0);
        var order = exact.map(function (v, i) { return { i: i, f: v - Math.floor(v) }; })
                         .sort(function (a, b) { return b.f - a.f; });
        for (var k = 0; k < rem; k++) pct[order[k].i]++;
        var avg = round1((pct[0] + 2 * pct[1] + 3 * pct[2] + 4 * pct[3] + 5 * pct[4]) / 100);
        var count = Math.floor(18 + r() * 240);
        var cats = CATEGORIES.map(function (c) {
            return { name: c.name, icon: c.icon, value: round1(clamp(avg + (r() - 0.5) * 0.9, 3.2, 5)) };
        });
        return (CACHE[id] = {
            id: id, avg: avg, count: count, real: false,
            dist: { 1: pct[0], 2: pct[1], 3: pct[2], 4: pct[3], 5: pct[4] }, cats: cats
        });
    }

    // Base profile: REAL sentiment-derived ratings (window.UNI_RATINGS, built
    // from genuine student comments) when available, else deterministic.
    function baseProfile(id) {
        var real = (typeof window !== 'undefined') && window.UNI_RATINGS && window.UNI_RATINGS[id];
        if (real) {
            var byName = {};
            (real.cats || []).forEach(function (c) { byName[c.name] = c.value; });
            var cats = CATEGORIES.map(function (c) {
                return { name: c.name, icon: c.icon, value: byName[c.name] != null ? byName[c.name] : real.avg };
            });
            return { id: id, avg: real.avg, count: real.count, real: true, dist: real.dist, cats: cats };
        }
        return fallbackProfile(id);
    }

    // View = base ratings with the user's OWN rating folded in (counted in the
    // total and blended into the average) so rating actually moves the numbers.
    function view(id) {
        var b = baseProfile(id);
        var mine = getMine(id);
        var count = b.count + (mine ? 1 : 0);
        var avg = mine ? round1((b.avg * b.count + mine) / count) : b.avg;
        return { avg: avg, count: count, mine: mine, base: b };
    }

    // Back-compat alias used by external callers / tests.
    function profile(id) { return baseProfile(id); }

    // ── Stars markup (progressive fill via clipped overlay) ──────────
    function starsHTML(value, size, gap) {
        var pctFill = clamp(value / 5 * 100, 0, 100);
        return '<span class="ur-stars" style="--s:' + size + 'px;--gap:' + (gap == null ? 2 : gap) + 'px">' +
            '<span class="ur-stars__bg">' + fiveStars() + '</span>' +
            '<span class="ur-stars__fg" data-fill="' + pctFill + '">' + fiveStars() + '</span>' +
        '</span>';
    }

    function fmt(n) { return n.toLocaleString('en-US'); }

    // ── Compact chip for cards ───────────────────────────────────────
    function compactInner(id) {
        var v = view(id);
        return starsHTML(v.avg, 14, 2) +
            '<span class="ur-compact__val">' + v.avg.toFixed(1) + '</span>' +
            '<span class="ur-compact__count">(' + fmt(v.count) + ')</span>';
    }
    // Accepts a university object OR an id; stores name for the modal.
    function compact(uOrId) {
        var u = (typeof uOrId === 'object' && uOrId) ? uOrId : { id: uOrId };
        var v = view(u.id);
        var name = (u.name || '').replace(/"/g, '&quot;');
        return '<button type="button" class="ur-compact" data-ur-open="' + u.id + '"' +
            ' data-ur-name="' + name + '"' +
            ' aria-label="Rated ' + v.avg + ' out of 5 from ' + fmt(v.count) + ' student reviews. View breakdown and rate">' +
            compactInner(u.id) +
        '</button>';
    }

    // Re-render every chip for a university so a new user rating shows instantly.
    function updateChips(id) {
        var chips = document.querySelectorAll('.ur-compact[data-ur-open="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
        chips.forEach(function (chip) {
            chip.innerHTML = compactInner(id);
            var v = view(id);
            chip.setAttribute('aria-label', 'Rated ' + v.avg + ' out of 5 from ' + fmt(v.count) + ' student reviews. View breakdown and rate');
        });
        revealCompacts();
    }

    // ── Animation helpers ────────────────────────────────────────────
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function countUp(el, target, decimals) {
        if (reduceMotion) { el.textContent = target.toFixed(decimals); return; }
        var dur = 900, start = performance.now();
        (function tick(now) {
            var t = clamp((now - start) / dur, 0, 1);
            var e = 1 - Math.pow(1 - t, 3);            // easeOutCubic
            el.textContent = (target * e).toFixed(decimals);
            if (t < 1) requestAnimationFrame(tick);
            else el.textContent = target.toFixed(decimals);
        })(start);
    }

    function revealFills(root) {
        // Trigger CSS width transitions on the next frame.
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                root.querySelectorAll('.ur-stars__fg').forEach(function (el) {
                    el.style.width = el.getAttribute('data-fill') + '%';
                });
                root.querySelectorAll('.ur-dist__fill').forEach(function (el) {
                    el.style.width = el.getAttribute('data-fill') + '%';
                });
            });
        });
    }

    // ── User's own rating persistence ────────────────────────────────
    function myKey(id) { return 'ur_my_' + id; }
    function getMine(id) { try { return parseInt(localStorage.getItem(myKey(id)) || '0', 10) || 0; } catch (e) { return 0; } }
    function setMine(id, v) { try { localStorage.setItem(myKey(id), String(v)); } catch (e) {} }

    // ── Particle burst (celebratory click feedback) ──────────────────
    function burst(layer, x, y) {
        if (reduceMotion) return;
        var colors = ['#ffd66b', '#f5b41e', '#f59220', '#ffe9b0'];
        for (var i = 0; i < 16; i++) {
            var p = document.createElement('span');
            p.className = 'ur-particle';
            var ang = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
            var dist = 26 + Math.random() * 46;
            p.style.left = x + 'px';
            p.style.top = y + 'px';
            p.style.background = colors[i % colors.length];
            p.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
            p.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
            p.style.setProperty('--rot', (Math.random() * 360 - 180) + 'deg');
            p.style.animationDelay = (Math.random() * 0.04) + 's';
            layer.appendChild(p);
            (function (node) { setTimeout(function () { node.remove(); }, 820); })(p);
        }
    }

    // ── Modal ────────────────────────────────────────────────────────
    var modalEl = null, lastFocus = null;

    function distRow(stars, pct) {
        return '<div class="ur-dist__row">' +
            '<span class="ur-dist__lbl">' + stars + '<i class="fa-solid fa-star"></i></span>' +
            '<span class="ur-dist__track"><span class="ur-dist__fill" data-fill="' + pct + '"></span></span>' +
            '<span class="ur-dist__pct">' + pct + '%</span>' +
        '</div>';
    }

    function catCard(c) {
        return '<div class="ur-cat">' +
            '<span class="ur-cat__icon"><i class="' + c.icon + '"></i></span>' +
            '<span class="ur-cat__body">' +
                '<span class="ur-cat__name">' + c.name + '</span>' +
                '<span class="ur-cat__row">' + starsHTML(c.value, 12, 1) +
                    '<span class="ur-cat__val">' + c.value.toFixed(1) + '</span>' +
                '</span>' +
            '</span>' +
        '</div>';
    }

    function rateStarsHTML(mine) {
        var out = '';
        for (var i = 1; i <= 5; i++) {
            out += '<button type="button" class="ur-rate__btn' + (i <= mine ? ' on' : '') + '"' +
                ' data-v="' + i + '" role="radio" aria-checked="' + (i === mine ? 'true' : 'false') + '"' +
                ' aria-label="' + i + ' star' + (i > 1 ? 's' : '') + ' — ' + SCALE_LABELS[i] + '"' +
                ' tabindex="' + (i === (mine || 1) ? '0' : '-1') + '">' +
                '<svg class="ur-star" viewBox="0 0 24 24" aria-hidden="true"><use href="#ur-star"/></svg>' +
            '</button>';
        }
        return out;
    }

    function open(id, name) {
        injectDefs();
        var v = view(id);
        var p = v.base;          // distribution + categories come from the base
        var mine = v.mine;
        lastFocus = document.activeElement;

        var overlay = document.createElement('div');
        overlay.className = 'ur-modal';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Ratings for ' + (name || 'this university'));

        overlay.innerHTML =
            '<div class="ur-panel" role="document">' +
                '<button type="button" class="ur-close" aria-label="Close ratings"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="ur-panel__eyebrow">Student Ratings</div>' +
                '<h2 class="ur-panel__title">' + (name || 'University Ratings') + '</h2>' +

                '<div class="ur-hero">' +
                    '<div><div class="ur-hero__num" data-count="' + v.avg + '">0.0</div>' +
                        '<div class="ur-stars" style="--s:18px;--gap:3px;margin-top:6px">' +
                            '<span class="ur-stars__bg">' + fiveStars() + '</span>' +
                            '<span class="ur-stars__fg" data-fill="' + (v.avg / 5 * 100) + '">' + fiveStars() + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ur-hero__meta">' +
                        '<span class="ur-hero__label" data-label>' + avgLabel(v.avg) + '</span>' +
                        '<div class="ur-hero__count">Based on <b data-count-int="' + v.count + '">0</b> student reviews</div>' +
                        '<div class="ur-hero__src">' + (p.real
                            ? '<i class="fa-solid fa-circle-check"></i> From real student reviews'
                            : '<i class="fa-solid fa-chart-simple"></i> Estimated — awaiting verified reviews') + '</div>' +
                    '</div>' +
                '</div>' +

                '<div class="ur-h">Rating Distribution</div>' +
                '<div class="ur-dist">' +
                    distRow(5, p.dist[5]) + distRow(4, p.dist[4]) + distRow(3, p.dist[3]) +
                    distRow(2, p.dist[2]) + distRow(1, p.dist[1]) +
                '</div>' +

                '<div class="ur-h">Category Averages</div>' +
                '<div class="ur-cats">' + p.cats.map(catCard).join('') + '</div>' +

                '<div class="ur-rate">' +
                    '<div class="ur-rate__title">' + (mine ? 'Your rating' : 'Rate this university') + '</div>' +
                    '<div class="ur-rate__stars" role="radiogroup" aria-label="Your rating, 1 to 5 stars">' +
                        rateStarsHTML(mine) +
                        '<span class="ur-burst"></span>' +
                    '</div>' +
                    '<div class="ur-rate__label">' + (mine ? SCALE_LABELS[mine] : 'Tap a star to rate') + '</div>' +
                    '<div class="ur-rate__thanks' + (mine ? ' show' : '') + '">' +
                        '<i class="fa-solid fa-circle-check"></i> Thanks — your rating helps fellow students!' +
                    '</div>' +
                    '<div class="ur-review">' +
                        '<textarea class="ur-review__ta" id="urReviewText" maxlength="1000" placeholder="Optional — share a sentence about your experience (helps other students)"></textarea>' +
                        '<button type="button" class="ur-review__post" id="urReviewPost"><i class="fa-solid fa-paper-plane"></i> Post review</button>' +
                    '</div>' +
                '</div>' +

                '<div class="ur-community" id="urCommunity" style="display:none">' +
                    '<div class="ur-h">Community reviews <span class="ur-community__count" id="urCommCount"></span></div>' +
                    '<div class="ur-community__list" id="urCommList"></div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';
        modalEl = overlay;

        // Open transition + animations.
        requestAnimationFrame(function () { overlay.classList.add('is-open'); });
        var numEl = overlay.querySelector('[data-count]');
        var intEl = overlay.querySelector('[data-count-int]');
        countUp(numEl, v.avg, 1);
        countUp(intEl, v.count, 0);
        revealFills(overlay);

        // Stagger category cards in.
        var cats = overlay.querySelectorAll('.ur-cat');
        cats.forEach(function (c, i) {
            setTimeout(function () { c.classList.add('in'); }, 120 + i * 45);
        });

        wireRate(overlay, id);
        wireClose(overlay);
        wireReviews(overlay, id, v);
    }

    // ── Community reviews (server-backed) ────────────────────────────
    function apiBase() {
        if (location.protocol === 'file:') return 'http://localhost:4242';
        var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
        if (isLocal && location.port !== '4242') return 'http://localhost:4242';
        return location.origin;
    }
    function currentUser() {
        try { return (window.user && window.user.id) ? window.user : { id: 'guest', username: 'Student' }; }
        catch (e) { return { id: 'guest', username: 'Student' }; }
    }
    function timeAgo(iso) {
        try {
            var d = Date.now() - new Date(String(iso).replace(' ', 'T') + 'Z').getTime();
            var days = Math.floor(d / 86400000);
            if (days <= 0) return 'today';
            if (days === 1) return 'yesterday';
            if (days < 30) return days + ' days ago';
            if (days < 365) return Math.floor(days / 30) + ' mo ago';
            return Math.floor(days / 365) + ' yr ago';
        } catch (e) { return ''; }
    }
    function reviewCardHTML(r) {
        var pct = clamp(r.rating / 5 * 100, 0, 100);
        return '<div class="ur-comm">' +
            '<div class="ur-comm__top">' +
                '<span class="ur-comm__who"><i class="fa-solid fa-circle-user"></i> ' + (r.author || 'Student') + '</span>' +
                '<span class="ur-stars" style="--s:12px;--gap:1px"><span class="ur-stars__bg">' + fiveStars() + '</span>' +
                    '<span class="ur-stars__fg" data-fill="' + pct + '" style="width:' + pct + '%">' + fiveStars() + '</span></span>' +
                '<span class="ur-comm__ago">' + timeAgo(r.date) + '</span>' +
            '</div>' +
            (r.text ? '<div class="ur-comm__text">' + String(r.text).replace(/[<>]/g, '') + '</div>' : '') +
        '</div>';
    }
    function wireReviews(overlay, id, v) {
        var box = overlay.querySelector('#urCommunity');
        var list = overlay.querySelector('#urCommList');
        var cnt = overlay.querySelector('#urCommCount');
        var ta = overlay.querySelector('#urReviewText');
        var post = overlay.querySelector('#urReviewPost');
        var base = apiBase();

        function blendHero(agg) {
            if (!agg || !agg.count) return;
            var b = v.base;
            var totalCount = b.count + agg.count;
            var blended = round1((b.avg * b.count + agg.avg * agg.count) / totalCount);
            var numEl = overlay.querySelector('[data-count]');
            var intEl = overlay.querySelector('[data-count-int]');
            var heroFg = overlay.querySelector('.ur-hero .ur-stars__fg');
            var label = overlay.querySelector('[data-label]');
            if (numEl) numEl.textContent = blended.toFixed(1);
            if (intEl) intEl.textContent = fmt(totalCount);
            if (heroFg) heroFg.style.width = (blended / 5 * 100) + '%';
            if (label) label.textContent = avgLabel(blended);
        }
        function render(agg) {
            if (agg && agg.mine && agg.mine.text && ta && !ta.value) ta.value = agg.mine.text;
            if (agg && agg.items && agg.items.length) {
                box.style.display = '';
                cnt.textContent = agg.count + (agg.count === 1 ? ' review' : ' reviews');
                list.innerHTML = agg.items.map(reviewCardHTML).join('');
                revealFills(list);
                blendHero(agg);
            }
        }
        fetch(base + '/api/reviews/' + encodeURIComponent(id) + '?userId=' + encodeURIComponent(currentUser().id))
            .then(function (r) { return r.json(); }).then(render).catch(function () {});

        if (post) post.addEventListener('click', function () {
            var mine = getMine(id);
            if (!mine) { post.classList.add('ur-review__post--nudge'); setTimeout(function () { post.classList.remove('ur-review__post--nudge'); }, 600); return; }
            var u = currentUser();
            post.disabled = true; post.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Posting…';
            fetch(base + '/api/reviews', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ uniId: id, userId: u.id, author: u.username || 'Student', rating: mine, text: ta ? ta.value : '' })
            }).then(function (r) { return r.json(); }).then(function (agg) {
                post.disabled = false; post.innerHTML = '<i class="fa-solid fa-circle-check"></i> Posted!';
                setTimeout(function () { post.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Update review'; }, 1600);
                render(agg);
            }).catch(function () {
                post.disabled = false; post.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Post review';
            });
        });
    }

    function wireClose(overlay) {
        function close() {
            overlay.classList.remove('is-open');
            document.body.style.overflow = '';
            setTimeout(function () {
                overlay.remove();
                if (modalEl === overlay) modalEl = null;
                if (lastFocus && lastFocus.focus) lastFocus.focus();
            }, 360);
            document.removeEventListener('keydown', onKey);
        }
        function onKey(e) {
            if (e.key === 'Escape') { close(); return; }
            if (e.key === 'Tab') {                       // focus trap
                var f = overlay.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
                if (!f.length) return;
                var first = f[0], last = f[f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
        overlay.querySelector('.ur-close').addEventListener('click', close);
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey);
        setTimeout(function () { overlay.querySelector('.ur-close').focus(); }, 60);
    }

    function wireRate(overlay, id) {
        var wrap = overlay.querySelector('.ur-rate__stars');
        var btns = Array.prototype.slice.call(wrap.querySelectorAll('.ur-rate__btn'));
        var labelEl = overlay.querySelector('.ur-rate__label');
        var thanksEl = overlay.querySelector('.ur-rate__thanks');
        var titleEl = overlay.querySelector('.ur-rate__title');
        var burstLayer = overlay.querySelector('.ur-burst');
        var locked = getMine(id);

        function paint(n) {
            btns.forEach(function (b, i) { b.classList.toggle('on', i < n); });
            labelEl.textContent = n ? SCALE_LABELS[n] : 'Tap a star to rate';
        }
        function commit(n, fromBtn) {
            locked = n;
            setMine(id, n);
            paint(n);
            btns.forEach(function (b, i) {
                b.setAttribute('aria-checked', (i + 1) === n ? 'true' : 'false');
                b.setAttribute('tabindex', (i + 1) === n ? '0' : '-1');
            });
            titleEl.textContent = 'Your rating';
            thanksEl.classList.add('show');

            // Fold the new rating into the headline average + review count live.
            var vv = view(id);
            var numEl = overlay.querySelector('[data-count]');
            var intEl = overlay.querySelector('[data-count-int]');
            var labelHero = overlay.querySelector('[data-label]');
            var heroFg = overlay.querySelector('.ur-hero .ur-stars__fg');
            if (numEl) numEl.textContent = vv.avg.toFixed(1);
            if (intEl) intEl.textContent = fmt(vv.count);
            if (labelHero) labelHero.textContent = avgLabel(vv.avg);
            if (heroFg) heroFg.style.width = (vv.avg / 5 * 100) + '%';
            updateChips(id);     // every card chip updates instantly

            // Celebratory lock + particle burst centred on the chosen star.
            var target = btns[n - 1];
            target.classList.remove('locked'); void target.offsetWidth; target.classList.add('locked');
            var wrapRect = wrap.getBoundingClientRect();
            var bRect = target.getBoundingClientRect();
            burst(burstLayer, bRect.left - wrapRect.left + bRect.width / 2,
                             bRect.top - wrapRect.top + bRect.height / 2);
        }

        btns.forEach(function (b, i) {
            var v = i + 1;
            b.addEventListener('mouseenter', function () { paint(v); });
            b.addEventListener('focus', function () { paint(v); });
            b.addEventListener('click', function () { commit(v, b); });
            b.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                    e.preventDefault(); var n = Math.min(5, v + 1); btns[n - 1].focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                    e.preventDefault(); var m = Math.max(1, v - 1); btns[m - 1].focus();
                } else if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault(); commit(v, b);
                }
            });
        });
        wrap.addEventListener('mouseleave', function () { paint(locked); });
    }

    // ── Global click delegation for compact chips ────────────────────
    // Capture phase: intercept before the card's own click handler (which
    // opens the university detail) gets a chance to fire.
    document.addEventListener('click', function (e) {
        var chip = e.target.closest && e.target.closest('[data-ur-open]');
        if (!chip) return;
        e.preventDefault();
        e.stopPropagation();
        open(chip.getAttribute('data-ur-open'), chip.getAttribute('data-ur-name'));
    }, true);

    // Reveal fills for any compact chips that get added to the page.
    function revealCompacts(root) { revealFills(root || document); }

    // Cards are re-rendered as HTML strings throughout the app; watch the DOM
    // so freshly-inserted chips animate their fill without per-render hooks.
    var revealQueued = false;
    function queueReveal() {
        if (revealQueued) return;
        revealQueued = true;
        requestAnimationFrame(function () { revealQueued = false; revealCompacts(); });
    }
    function startObserver() {
        if (!window.MutationObserver) { revealCompacts(); return; }
        new MutationObserver(function (muts) {
            for (var i = 0; i < muts.length; i++) {
                if (muts[i].addedNodes && muts[i].addedNodes.length) { queueReveal(); return; }
            }
        }).observe(document.body, { childList: true, subtree: true });
        revealCompacts();
    }

    injectDefs();
    if (document.readyState !== 'loading') startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver);

    window.UniRating = {
        compact: compact,
        starsHTML: starsHTML,
        profile: profile,
        open: open,
        reveal: revealCompacts
    };
})();
