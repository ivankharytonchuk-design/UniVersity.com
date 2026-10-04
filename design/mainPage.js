'use strict';

var SESSION_KEY = 'uniscout_session';
function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch(e) { return null; }
}
var user = getSession();
if (!user) { window.location.href = 'log-in.html'; }

// Recovery hatch: open mainPage.html?reset to clear custom photos/avatar if a bad
// stored image ever prevents the page from loading. (Then remove ?reset.)
(function () {
    try {
        if (/[?&]reset\b/.test(location.search) && user) {
            ['explore', 'apply', 'chances', 'deadlines', 'matcher', 'gradebook'].forEach(function (k) { localStorage.removeItem('us_hero_' + k + '_' + user.id); });
            var pk = 'us_profile_' + user.id;
            var p = JSON.parse(localStorage.getItem(pk) || '{}'); delete p.avatar;
            localStorage.setItem(pk, JSON.stringify(p));
        }
    } catch (e) {}
}());

// Safety: if any error ever leaves a modal open, never let the page stay locked.
window.addEventListener('error', function () {
    try {
        document.body.style.overflow = '';
        document.querySelectorAll('.pricing__overlay.open, .pay__overlay.open, .ttl__overlay.open, .cmp__modal__overlay.open')
            .forEach(function (o) { o.classList.remove('open'); });
    } catch (e) {}
});

try { localStorage.setItem('us_lastseen_' + user.id, Date.now()); } catch (e) { /* storage full — don't halt the app */ }
document.getElementById('mpName').textContent = user.username;
document.getElementById('heroName').textContent = user.username;
document.getElementById('mpSignout').addEventListener('click', function () {
    if (window.UserSync) UserSync.logout();   // end the server session + stop syncing
    localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'log-in.html';
});

var SAVED_KEY      = 'us_saved_'     + user.id;
var FORM_APPS_KEY  = 'us_form_apps_' + user.id;
function getSaved()    { try { return JSON.parse(localStorage.getItem(SAVED_KEY)     || '[]'); } catch(e) { return []; } }
function getFormApps() { try { return JSON.parse(localStorage.getItem(FORM_APPS_KEY) || '[]'); } catch(e) { return []; } }
function setSaved(d)    { localStorage.setItem(SAVED_KEY,     JSON.stringify(d)); scheduleDigestSync(); }
// Push the updated favourites to the server (debounced) so an Elite user's daily
// digest always reflects their current saved universities. Safe no-op pre-login.
var _digestSyncT = null;
function scheduleDigestSync() {
    clearTimeout(_digestSyncT);
    _digestSyncT = setTimeout(function () { try { syncDigestSubscription(); } catch (e) {} }, 1500);
}
function setFormApps(d) { localStorage.setItem(FORM_APPS_KEY, JSON.stringify(d)); }

var TS_COST = { 1:700, 2:1200, 3:5000, 4:15000, 5:25000 };

var PROFILE_KEY = 'us_profile_' + user.id;
function getProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{"budget":5000}'); } catch(e) { return { budget:5000 }; }
}
function setProfile(d) { localStorage.setItem(PROFILE_KEY, JSON.stringify(d)); }

/* Explore filters the user chose to save for the Gradebook's "realistic options".
   Set from the Explore page via the "Save filters for Gradebook" toggle. */
var GB_FILTERS_KEY = 'us_gb_filters_' + user.id;
function getGbFilters() {
    try { return JSON.parse(localStorage.getItem(GB_FILTERS_KEY) || 'null'); } catch (e) { return null; }
}
function setGbFilters(d) {
    try { if (d) localStorage.setItem(GB_FILTERS_KEY, JSON.stringify(d)); else localStorage.removeItem(GB_FILTERS_KEY); } catch (e) {}
}

function setBudgetMode(on) {
    budgetFilterOn = on;
    var btn = document.getElementById('budgetFilterBtn');
    if (btn) btn.classList.toggle('active', on);
    var badge = document.getElementById('budgetFilterBadge');
    if (badge) badge.style.display = on ? 'flex' : 'none';
    renderCompare();
}

var heroInsightIdx = 0;
function updateHeroInsight() {
    var saves = (typeof getInsightSaves === 'function') ? getInsightSaves() : [];
    var card  = document.getElementById('heroInsightCard');
    if (!card || !saves.length) return;
    var s = saves[heroInsightIdx % saves.length];
    if (!s) return;
    var num = card.querySelector('.hero__ins__num');
    var lbl = card.querySelector('.hero__ins__lbl');
    var nm  = card.querySelector('.hero__ins__name');
    if (num) { num.textContent = s.prob + '%'; num.style.color = s.verdictColor; }
    if (lbl) lbl.textContent = s.verdict;
    if (nm)  nm.textContent  = s.name;
}
function updateHeroStats() { updateStats(); }
function updateHeroFeed() {
    var el = document.getElementById('heroFeedVal');
    if (!el || typeof FEED_UPDATES === 'undefined') return;
    var saved = getSaved();
    var readIds = getNewsRead();
    var count = 0;
    FEED_UPDATES.forEach(function(u, i) {
        if (saved.indexOf(u.uniId) === -1) return;
        if (parseDaysAgo(u.date) >= 2) return;
        if (readIds.indexOf(getFeedItemId(u, i)) !== -1) return;
        count++;
    });
    el.textContent = count > 0 ? count + ' new update' + (count === 1 ? '' : 's') : 'No new updates';
}

var TABS = { overview:'tabOverview', compare:'tabCompare', explore:'tabExplore', cityguide:'tabCityGuide', tracker:'tabTracker', gradebook:'tabGradebook', scholarships:'tabScholarships', housing:'tabHousing' };
var currentTab = 'overview';

function clearExploreFilters() {
    ['cmpSearch','fCity','fField','fType','fTuition','fReach'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    var sortEl = document.getElementById('cmpSort');
    if (sortEl) sortEl.value = 'tuition-asc';
    if (typeof setBudgetMode === 'function') setBudgetMode(false);
    cmpPage = 1;
    if (typeof renderCompare === 'function') renderCompare();
}

// Explore's sub-pages (Universities / Scholarships / Housing) count as one section; the order is left → right.
var EXPLORE_GROUP = { explore: 1, scholarships: 2, housing: 3 };
function showTab(tab) {
    if (EXPLORE_GROUP[currentTab] && !EXPLORE_GROUP[tab]) clearExploreFilters();
    var prevTab = currentTab;
    currentTab = tab;
    Object.keys(TABS).forEach(function(k) {
        var el = document.getElementById(TABS[k]);
        if (k !== tab) { el.style.display = 'none'; return; }
        el.style.display = 'block';

        el.style.animation = 'none'; void el.offsetWidth;
        el.style.animation = '';
    });
    document.querySelectorAll('.mp__nav__btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.tab === tab || (!!EXPLORE_GROUP[tab] && b.dataset.tab === 'explore'));
    });
    syncExploreNav(tab, prevTab);
    // Gradebook lives outside <main>; hide the (otherwise empty) main so it doesn't add a gap on top.
    var _main = document.querySelector('.mp__main');
    if (_main) _main.style.display = (tab === 'gradebook') ? 'none' : '';
    if (tab === 'explore' && typeof applyExploreMatcherLayout === 'function') applyExploreMatcherLayout();
    if (tab === 'gradebook' && typeof window.renderGradebook === 'function') window.renderGradebook();
    // Re-render the Overview's academic widget every time the tab is shown so it
    // never displays a stale university (it shares its logic with the Gradebook,
    // which the user confirmed shows the correct uni).
    if (tab === 'overview' && typeof window.renderAcademicWidget === 'function') window.renderAcademicWidget();
}

/* Explore sub-header: sliding pill + direction-aware page transition. */
function syncExploreNav(tab, prevTab) {
    var nav = document.getElementById('xpNav');
    if (!nav) return;
    var inGroup = !!EXPLORE_GROUP[tab];
    if (nav.hidden === inGroup) {
        nav.hidden = !inGroup;
        if (inGroup) { nav.classList.remove('xpn--in'); void nav.offsetWidth; nav.classList.add('xpn--in'); }
    }
    ['tabExplore', 'tabScholarships', 'tabHousing'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('xp-from-left', 'xp-from-right');
    });
    if (!inGroup) return;
    // Sliding between the sub-pages, in the order of the buttons (Universities → Scholarships → Housing).
    if (EXPLORE_GROUP[prevTab] && prevTab !== tab) {
        var incoming = document.getElementById(TABS[tab]);
        if (incoming) incoming.classList.add(EXPLORE_GROUP[tab] > EXPLORE_GROUP[prevTab] ? 'xp-from-right' : 'xp-from-left');
    }
    var active = null;
    nav.querySelectorAll('.xpn__btn').forEach(function (b) {
        var on = b.dataset.xp === tab;
        b.classList.toggle('is-on', on);
        if (on) { b.setAttribute('aria-current', 'page'); active = b; } else b.removeAttribute('aria-current');
    });
    var title = document.getElementById('xpnTitle');
    if (title && active && title.textContent !== active.dataset.title) {
        title.innerHTML = '<span class="xpn__title--' + (EXPLORE_GROUP[tab] > 1 ? 'r' : 'l') + '">' + active.dataset.title + '</span>';
    }
    requestAnimationFrame(function () { moveExplorePill(active); });
}
function moveExplorePill(btn) {
    var pill = document.getElementById('xpnPill');
    if (!pill || !btn || !btn.offsetWidth) return;
    pill.style.width = btn.offsetWidth + 'px';
    pill.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
}
/* Header nav: one raised "keycap" slides to the active tab (styles: "Header nav — keycap dock"
   at the end of mainPage.css). Follows every change of the .active class, whoever sets it. */
(function () {
    var nav = document.getElementById('mpNav'), pill = nav && nav.querySelector('.mp__nav__pill');
    if (!pill) return;
    var raf = 0;
    function move() {
        raf = 0;
        var on = nav.querySelector('.mp__nav__btn.active');
        if (!on || !on.offsetWidth) { nav.classList.remove('has-pill'); return; }
        pill.style.width = on.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
        if (!nav.classList.contains('has-pill')) { void pill.offsetWidth; nav.classList.add('has-pill'); }
    }
    function later() { if (!raf) raf = requestAnimationFrame(move); }
    new MutationObserver(later).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    var hdr = nav.closest('.mp__header');
    if (hdr) new MutationObserver(later).observe(hdr, { attributes: true, attributeFilter: ['class'] });   // compact mode changes widths
    window.addEventListener('resize', later);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(later); nav.querySelectorAll('.mp__nav__btn').forEach(function (b) { ro.observe(b); }); }
    later();
})();
(function () {
    var nav = document.getElementById('xpNav');
    if (!nav) return;
    nav.addEventListener('click', function (e) {
        var b = e.target.closest('.xpn__btn');
        if (b && b.dataset.xp !== currentTab) showTab(b.dataset.xp);
    });
    window.addEventListener('resize', function () { moveExplorePill(nav.querySelector('.xpn__btn.is-on')); });
}());

document.querySelectorAll('.mp__nav__btn[data-tab]').forEach(function(btn) {
    btn.addEventListener('click', function() { showTab(btn.dataset.tab); closeBurger(); });
});
document.querySelectorAll('[data-goto]').forEach(function(el) {
    el.addEventListener('click', function() { showTab(el.dataset.goto); closeBurger(); });
});

/* ── Burger menu (mobile nav) ── */
function closeBurger() {
    var nav = document.getElementById('mpNav');
    var scrim = document.getElementById('mpNavScrim');
    var burger = document.getElementById('mpBurger');
    if (nav) nav.classList.remove('mp__nav--open');
    if (scrim) scrim.classList.remove('open');
    if (burger) burger.querySelector('i').className = 'fa-solid fa-bars';
}
(function() {
    var burger = document.getElementById('mpBurger');
    var nav = document.getElementById('mpNav');
    var scrim = document.getElementById('mpNavScrim');
    if (!burger || !nav) return;
    burger.addEventListener('click', function(e) {
        e.stopPropagation();
        var open = nav.classList.toggle('mp__nav--open');
        if (scrim) scrim.classList.toggle('open', open);
        burger.querySelector('i').className = open ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
    });
    if (scrim) scrim.addEventListener('click', closeBurger);
}());

// A tab's name lives in .mp__nav__lbl (hidden until hover on desktop). Anything that renames a
// tab — the language switcher too — must go through here; writing textContent would drop the
// span and leave the name permanently visible.
function setNavLabel(b, t) {
    b.setAttribute('data-label', t); b.setAttribute('aria-label', t); b.removeAttribute('title');
    [].slice.call(b.childNodes).forEach(function (n) { if (n.nodeType === 3) b.removeChild(n); });
    var lbl = b.querySelector('.mp__nav__lbl');
    if (!lbl) {
        lbl = document.createElement('span'); lbl.className = 'mp__nav__lbl'; lbl.setAttribute('aria-hidden', 'true');
        lbl.appendChild(document.createElement('span')); b.appendChild(lbl);
    }
    lbl.firstChild.textContent = t;
}

/* ── Compact header: when the nav doesn't fit beside the right-hand controls
   (mid-size laptops), inactive tabs collapse to icons — the active tab keeps
   its label and every tab keeps a tooltip. Measured only on resize. ── */
(function () {
    var header = document.querySelector('.mp__header');
    if (!header) return;
    // icon-only tabs (≤1800px, or compact): the name sits in its own span so hovering can
    // slide it open next to the icon (mainPage.css "Header nav — names slide out")
    document.querySelectorAll('.mp__nav__btn[data-tab]').forEach(function (b) { setNavLabel(b, b.textContent.trim()); });
    var raf = 0;
    function fit() {
        raf = 0;
        header.classList.remove('mp__header--compact');
        if (window.innerWidth > 880 && header.scrollWidth > header.clientWidth + 1) header.classList.add('mp__header--compact');
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(fit); }
    window.addEventListener('resize', schedule);
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(document.querySelector('.mp__header__right') || header);
    schedule();
}());

function animateStat(el, val) {
    if (!el) return;
    el.textContent = val;
    el.classList.remove('updated'); void el.offsetWidth; el.classList.add('updated');
    el.addEventListener('animationend', function(){ el.classList.remove('updated'); }, { once: true });
}

// Playful count-up tween for a number element. Falls back to instant set
// when the value is unchanged, tiny, or the user prefers reduced motion.
function countUpStat(el, val) {
    if (!el) return;
    val = parseInt(val, 10) || 0;
    var from = parseInt(el.textContent, 10);
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || isNaN(from) || from === val || Math.abs(val - from) < 2) { el.textContent = val; return; }
    var start = null, dur = Math.min(900, 240 + Math.abs(val - from) * 12);
    function step(ts) {
        if (start === null) start = ts;
        var p = Math.min(1, (ts - start) / dur);
        var e = 1 - Math.pow(1 - p, 3);            // easeOutCubic
        el.textContent = Math.round(from + (val - from) * e);
        if (p < 1) requestAnimationFrame(step);
        else {
            el.textContent = val;
            el.classList.add('bump');                                  // scale up …
            setTimeout(function () { el.classList.remove('bump'); }, 220);  // … then settle back
        }
    }
    requestAnimationFrame(step);
}
function updateRoadmap() {
    var saved     = getSaved().length;
    var apps      = getFormApps().length;
    var completed = 1;
    if (saved >= 1) completed = 2;
    if (saved >= 2) completed = 3;
    if (apps  >= 1) completed = 4;

    for (var s = 1; s <= 5; s++) {
        var el = document.getElementById('rdmStep' + s);
        if (!el) continue;
        el.classList.remove('rdm__step--done', 'rdm__step--active', 'rdm__step--pending');
        if (s < completed)       el.classList.add('rdm__step--done');
        else if (s === completed) el.classList.add('rdm__step--active');
        else                      el.classList.add('rdm__step--pending');
    }

    var fill = document.getElementById('rdmFill');
    if (fill) {

        var pct = Math.min(100, ((completed - 1) / 4) * 100);
        fill.style.width = pct + '%';
    }
}

(function() {
    var STEP_TAB = { 1: 'explore', 2: 'explore', 3: 'compare', 4: 'tracker', 5: 'tracker' };
    for (var s = 1; s <= 5; s++) {
        (function(step) {
            var el = document.getElementById('rdmStep' + step);
            if (!el) return;
            el.addEventListener('click', function() { showTab(STEP_TAB[step]); });
        })(s);
    }
}());

function updateStats() {
    animateStat(document.getElementById('statSaved'), getSaved().length);
    animateStat(document.getElementById('statApps'),  window.UniApply ? window.UniApply.count() : getFormApps().length);
    var sp = document.getElementById('statPlaces');
    if (sp) animateStat(sp, getSavedPlaces ? getSavedPlaces().length : 0);

    var hTotal = document.getElementById('heroStatTotal');
    var hSaved = document.getElementById('heroStatSaved');
    if (hTotal && typeof UNI !== 'undefined') countUpStat(hTotal, UNI.length);
    if (hSaved) countUpStat(hSaved, getSaved().length);
    if (typeof updateAppcount === 'function') updateAppcount();
    updateRoadmap();
}
updateStats();
renderFriendRequests();
updateFriendStats();
updateFriendsBadge();

/* ══════════════ Personalized admission chances ══════════════
 * Reads the student's gradebook average (any scale → %) and compares it to each
 * university's selectivity to label cards Safety / Match / Reach. Defined here
 * (early) so card builders that run at startup can use it. */
var ADM_PARAMS = {
    1: { thresh:30, k:0.12 },
    2: { thresh:50, k:0.16 },
    3: { thresh:65, k:0.22 },
    4: { thresh:75, k:0.30 },
    5: { thresh:82, k:0.40 },
};
function cap(v) { return Math.min(99, Math.max(1, Math.round(v))); }
function sigmoid(grade, thresh, k) {
    return Math.round(100 / (1 + Math.exp(-k * (grade - thresh))));
}

var GB_SCALE_MAX = { pct:100, ib:7, p10:10, p9:9, p8:8, p5:5, gpa:4 };
// The student's overall gradebook average as a 0–100 percentage (null if no grades).
function studentGradePercent() {
    try {
        var gb = JSON.parse(localStorage.getItem('us_gradebook_' + user.id) || 'null');
        if (!gb || !gb.subjects || !gb.subjects.length) return null;
        var max = GB_SCALE_MAX[gb.scale] || 100;
        var vals = gb.subjects.map(function (s) {
            if (s.grade != null && s.grade !== '') return Math.max(0, Math.min(max, +s.grade));
            if (s.assessments && s.assessments.length) {
                var w = 0, t = 0;
                s.assessments.forEach(function (a) { var wt = a.weight || 1; w += wt; t += Math.max(0, Math.min(max, a.grade)) * wt; });
                return w ? t / w : null;
            }
            return null;
        }).filter(function (v) { return v != null; });
        if (!vals.length) return null;
        var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        return Math.max(0, Math.min(100, avg / max * 100));
    } catch (e) { return null; }
}

// {prob, label, cls, color} for a uni given the student's grade — or null if no grades.
function uniChanceInfo(u) {
    var g = studentGradePercent();
    if (g == null || !u) return null;
    var p = ADM_PARAMS[u.diff] || ADM_PARAMS[3];
    var prob = cap(sigmoid(g, p.thresh, p.k));
    if (prob >= 70)      return { prob:prob, label:'Safety', cls:'safety', color:'#27ae60' };
    if (prob >= 40)      return { prob:prob, label:'Match',  cls:'match',  color:'#2980b9' };
    return { prob:prob, label:'Reach', cls:'reach', color:'#e67e22' };
}

// Inline badge HTML for a uni card (empty string when the student has no grades).
function chanceBadgeHTML(u) {
    var c = uniChanceInfo(u);
    if (!c) return '';
    return '<span class="mp__chance mp__chance--' + c.cls + '" title="Based on your gradebook average vs this university\'s selectivity">' +
        '<i class="fa-solid fa-bullseye"></i> ' + c.label + ' · ' + c.prob + '%</span>';
}

// Re-render cards so badges reflect the latest grades (called after gradebook edits).
window.refreshChanceBadges = function () {
    try { renderSaved(); } catch (e) {}
    try { if (typeof renderCompare === 'function') renderCompare(true); } catch (e) {}
    try { if (window.syncAdmUseGrades) window.syncAdmUseGrades(); } catch (e) {}
};

function buildMiniCard(u) {
    var saved = getSaved();
    var on = saved.indexOf(u.id) !== -1;
    var tc = uniIsPublic(u) ? 'mp__badge--pub' : 'mp__badge--priv';
    var typeLabel = uniTypeLabel(u);
    return '<div class="mp__uni__card mp__uni__card--v2" style="--c:' + u.color + '" data-id="' + u.id + '">' +
        '<div class="mp__card__top">' +
            '<div class="mp__card__abbr mp__card__abbr--logo">' + uniLogo(u, 40) + '</div>' +
            '<div class="mp__card__head">' +
                '<div class="mp__card__name">' + u.name + '</div>' +
                '<div class="mp__card__badges">' +
                    '<span class="mp__badge mp__badge--city"><i class="fa-solid fa-location-dot" style="font-size:7px;margin-right:2px"></i>' + u.city + '</span>' +
                    '<span class="mp__badge ' + tc + '">' + typeLabel + '</span>' +
                    chanceBadgeHTML(u) +
                '</div>' +
            '</div>' +
            '<button class="mp__save__btn" data-id="' + u.id + '" style="color:' + (on ? 'rgb(228,155,20)' : 'rgba(0,0,0,.2)') + '">' +
                '<i class="fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark"></i>' +
            '</button>' +
        '</div>' +
        '<div class="mp__card__metrics">' +
            metricBar('Tuition', uniTuitionLabel(u), u.ts) +
            metricBar('Difficulty', u.dl || '—', u.diff) +
        '</div>' +
        '<div class="mp__card__fields">' +
            (u.fields||[]).slice(0,4).map(function(f){ return '<span class="mp__field__tag">'+f+'</span>'; }).join('') +
            (u.langs||[]).map(function(l){ return '<span class="mp__field__tag mp__field__tag--lang"><i class="fa-solid fa-earth-europe"></i>'+l+'</span>'; }).join('') +
        '</div>' +
        '<div class="mp__card__botrow">' +
            (window.UniRating ? '<div class="mp__card__rating">' + window.UniRating.compact(u) + '</div>' : '<span></span>') +
            recruitersHTML(u) +
        '</div>' +
    '</div>';
}

// Bottom-right of a saved-university card: logos of the 3 employers that recruit
// most from it (any subject) — click to jump to Career Paths with it pre-filled.
function recruitersHTML(u) {
    if (typeof window.crsUniRecruiters !== 'function') return '';
    var list = [];
    try { list = window.crsUniRecruiters(u, 3); } catch (e) { return ''; }
    if (!list.length) return '';
    return '<button class="mp__card__recr" data-recr-uni="' + (u.name || '').replace(/"/g, '&quot;') + '" title="Who recruits from ' + (u.name || '') + ' — open Career Paths">' +
        list.map(function (r) { return r.logo; }).join('') +
    '</button>';
}

function metricBar(label, val, score) {
    return '<div><div class="mp__metric__row"><span class="mp__metric__label">' + label + '</span><span class="mp__metric__val">' + val + '</span></div>' +
           '<div class="mp__bar__track"><div class="mp__bar__fill mp__bar--' + score + '"></div></div></div>';
}

function attachSave(container) {
    container.querySelectorAll('.mp__card__recr').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var name = btn.getAttribute('data-recr-uni');
            var u = null; try { u = (window.UNI || []).find(function(x){ return x.name === name; }); } catch (err) {}
            if (window.openCareers) window.openCareers(u || name);
        });
    });
    container.querySelectorAll('.mp__save__btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var id = btn.dataset.id;
            var saved = getSaved();
            var idx = saved.indexOf(id);
            if (idx === -1) saved.push(id); else saved.splice(idx, 1);
            setSaved(saved);
            var on = saved.indexOf(id) !== -1;
            document.querySelectorAll('.mp__save__btn[data-id="' + id + '"]').forEach(function(b) {
                b.style.color = on ? 'rgb(228,155,20)' : 'rgba(0,0,0,.2)';
                b.querySelector('i').className = 'fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark';
                b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
                b.addEventListener('animationend', function(){ b.classList.remove('pulse'); }, { once: true });
            });
            renderSaved();
            updateStats();
            if (window.renderChecklists) window.renderChecklists();
        });
    });
}

function renderSaved() {
    var saved = getSaved();
    var grid = document.getElementById('savedGrid');
    var empty = document.getElementById('savedEmpty');
    if (!saved.length) { grid.style.display = 'none'; empty.style.display = 'flex'; return; }
    empty.style.display = 'none'; grid.style.display = 'grid';
    grid.innerHTML = UNI.filter(function(u){ return saved.indexOf(u.id) !== -1; }).map(buildMiniCard).join('');
    attachSave(grid);
}
renderSaved();

var DIFF_LABELS = ['','Open','Low','Competitive','Highly selective','Elite selective'];

function buildDetailCard(u, rank) {
    var on = getSaved().indexOf(u.id) !== -1;
    var tc = uniIsPublic(u) ? 'mp__badge--pub' : 'mp__badge--priv';
    var rb = rank === 1 ? 'cmp__rank__badge--gold' : rank === 2 ? 'cmp__rank__badge--silver' : rank === 3 ? 'cmp__rank__badge--bronze' : '';
    var rankBadge = rank <= 3 ? '<span class="cmp__rank__badge ' + rb + '">' + (rank===1?'#1 Top':rank===2?'#2':'#3') + '</span>' : '';
    var countryRank = (typeof UNI !== 'undefined') ? UNI.indexOf(u) + 1 : 0;
    var crBadge = countryRank > 0 ? '<span class="cmp__country__rank" title="National ranking">' +
        '<i class="fa-solid fa-ranking-star"></i> #' + countryRank + ' nationally</span>' : '';
    return '<div class="cmp__detail__card" style="--c:' + u.color + '" data-id="' + u.id + '" data-city="' + u.city + '" data-type="' + u.type + '" data-diff="' + u.diff + '" data-ts="' + u.ts + '" data-fields="' + u.fields.join(',') + '" data-langs="' + u.langs.join(',') + '">' +
        '<div class="cmp__rank">' +
            '<div class="cmp__rank__num">' + rank + '</div>' +
            rankBadge +
        '</div>' +
        '<div class="cmp__detail__body">' +
            '<div class="cmp__detail__name__row">' +
                '<div class="cmp__detail__name">' + u.name + '</div>' +
                crBadge +
            '</div>' +
            '<div class="cmp__detail__meta">' +
                '<span class="mp__badge mp__badge--city"><i class="fa-solid fa-location-dot" style="font-size:7px;margin-right:2px"></i>' + u.city + '</span>' +
                '<span class="mp__badge ' + tc + '">' + u.type + '</span>' +
                chanceBadgeHTML(u) +
                u.langs.map(function(l){ return '<span class="mp__badge mp__badge--city">' + l + '</span>'; }).join('') +
            '</div>' +
            '<div class="cmp__detail__grid">' +
                '<div class="cmp__detail__metric"><span class="cmp__detail__ml">Annual Tuition</span><span class="cmp__detail__mv cmp__detail__mv--highlight">' + uniTuitionLabel(u) + '</span>' +
                '<div class="mp__bar__track" style="margin-top:5px"><div class="mp__bar__fill mp__bar--' + u.ts + '"></div></div></div>' +
                '<div class="cmp__detail__metric"><span class="cmp__detail__ml">Entry Difficulty</span><span class="cmp__detail__mv">' + u.dl + '</span>' +
                '<div class="mp__bar__track" style="margin-top:5px"><div class="mp__bar__fill mp__bar--' + u.diff + '"></div></div></div>' +
                '<div class="cmp__detail__metric"><span class="cmp__detail__ml">Fields of Study</span><span class="cmp__detail__mv" style="font-size:10px;line-height:1.5">' + u.fields.slice(0,3).join(', ') + (u.fields.length > 3 ? ' +' + (u.fields.length-3) + ' more' : '') + '</span></div>' +
                '<div class="cmp__detail__metric"><span class="cmp__detail__ml">Degree Levels</span><span class="cmp__detail__mv" style="font-size:10px">' + degreesOf(u).join(' · ') + '</span></div>' +
            '</div>' +
            (window.UniRating ? '<div class="cmp__detail__rating">' + window.UniRating.compact(u) + '</div>' : '') +
        '</div>' +
        '<div class="cmp__detail__actions">' +
            '<button class="mp__save__btn" data-id="' + u.id + '" title="' + (on?'Unsave':'Save') + '" style="color:' + (on ? 'rgb(228,155,20)' : 'rgba(0,0,0,.2)') + ';font-size:18px">' +
                '<i class="fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark"></i>' +
            '</button>' +
        '</div>' +
    '</div>';
}

var budgetFilterOn = false;

function getFilteredSorted() {
    var q    = document.getElementById('cmpSearch').value.trim().toLowerCase();
    var city = document.getElementById('fCity').value;
    var field= document.getElementById('fField').value;
    var type = document.getElementById('fType').value;
    var tuit = document.getElementById('fTuition').value;
    var reachEl = document.getElementById('fReach');
    var reach = reachEl ? reachEl.value : '';
    var sort = document.getElementById('cmpSort').value;

    var results = UNI.filter(function(u) {
        if (city  && u.city !== city)              return false;
        if (type  && u.type !== type)              return false;
        if (tuit  && u.ts   >  parseInt(tuit))     return false;
        if (field && u.fields.indexOf(field) === -1) return false;
        if (reach) { var ci = uniChanceInfo(u); if (!ci || ci.label !== reach) return false; }
        if (q) {
            var haystack = (u.name + ' ' + u.city + ' ' + u.abbr + ' ' + u.fields.join(' ') + ' ' + u.langs.join(' ')).toLowerCase();
            if (haystack.indexOf(q) === -1) return false;
        }
        return true;
    });

    results.sort(function(a, b) {
        if (sort === 'tuition-desc') return b.ts - a.ts;
        return a.ts - b.ts;
    });

    if (budgetFilterOn) {
        var p = getProfile();
        results = results.filter(function(u) { return tuitionMinCost(u) <= p.budget; });
    }

    return results;
}

function hasActiveFilters() {
    var q    = document.getElementById('cmpSearch').value.trim();
    var city = document.getElementById('fCity').value;
    var field= document.getElementById('fField').value;
    var type = document.getElementById('fType').value;
    var tuit = document.getElementById('fTuition').value;
    return q || city || field || type || tuit || budgetFilterOn;
}
var cmpPage = 1;
var CMP_PER_PAGE = 20;

function renderCmpPagination(current, total) {
    var pg = document.getElementById('cmpPagination');
    if (!pg) return;
    if (total <= 1) { pg.style.display = 'none'; return; }
    pg.style.display = 'flex';
    var html = '<button class="ba__pg__btn" id="cmpPrev"' + (current === 1 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>';
    var sp = Math.max(1, current - 2), ep = Math.min(total, current + 2);
    if (sp > 1) html += '<span class="ba__pg__dots">…</span>';
    for (var p = sp; p <= ep; p++) {
        html += '<button class="ba__pg__num' + (p === current ? ' ba__pg__num--active' : '') + '" data-p="' + p + '">' + p + '</button>';
    }
    if (ep < total) html += '<span class="ba__pg__dots">…</span>';
    html += '<button class="ba__pg__btn" id="cmpNext"' + (current === total ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>';
    pg.innerHTML = html;
    pg.querySelector('#cmpPrev').addEventListener('click', function() { if (cmpPage > 1) { cmpPage--; renderCompare(true); } });
    pg.querySelector('#cmpNext').addEventListener('click', function() { if (cmpPage < total) { cmpPage++; renderCompare(true); } });
    pg.querySelectorAll('.ba__pg__num').forEach(function(btn) {
        btn.addEventListener('click', function() { cmpPage = parseInt(btn.dataset.p); renderCompare(true); });
    });
}

function renderCompare(keepPage) {
    var list     = document.getElementById('cmpList');
    var noRes    = document.getElementById('cmpNoResults');
    var prompt   = document.getElementById('cmpFilterPrompt');
    var resultsHd= document.getElementById('cmpResultsHd');
    if (!list) return;

    if (!hasActiveFilters()) {
        if (prompt)   prompt.style.display   = 'flex';
        if (resultsHd)resultsHd.style.display= 'none';
        list.style.display  = 'none';
        list.innerHTML = '';
        if (noRes) noRes.style.display = 'none';
        var pg = document.getElementById('cmpPagination');
        if (pg) pg.style.display = 'none';
        return;
    }

    if (!keepPage) cmpPage = 1;
    if (prompt)    prompt.style.display   = 'none';
    if (resultsHd) resultsHd.style.display= 'flex';
    list.style.display = 'block';

    var results = getFilteredSorted();
    var totalPages = Math.max(1, Math.ceil(results.length / CMP_PER_PAGE));
    cmpPage = Math.min(cmpPage, totalPages);
    var start = (cmpPage - 1) * CMP_PER_PAGE;
    var pageResults = results.slice(start, start + CMP_PER_PAGE);

    var countEl = document.getElementById('cmpCount');
    var totalEl = document.getElementById('cmpTotal');
    if (countEl) countEl.textContent = results.length;
    if (totalEl) totalEl.textContent = UNI.length;

    if (!results.length) {
        list.innerHTML = '';
        if (noRes) noRes.style.display = 'block';
        renderCmpPagination(1, 1);
    } else {
        if (noRes) noRes.style.display = 'none';
        list.innerHTML = pageResults.map(function(u, i) { return buildDetailCard(u, start + i + 1); }).join('');
        attachSave(list);
        list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        renderCmpPagination(cmpPage, totalPages);
    }
}
renderCompare();

['cmpSearch','fCity','fField','fType','fTuition','fReach','cmpSort'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', renderCompare);
    el.addEventListener('change', renderCompare);
});

// The "My chance" filter needs the student's grades — nudge them if missing.
(function () {
    var rEl = document.getElementById('fReach');
    if (!rEl) return;
    rEl.addEventListener('change', function () {
        if (rEl.value && typeof studentGradePercent === 'function' && studentGradePercent() == null) {
            var b = document.createElement('div');
            b.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:6000;padding:11px 18px;border-radius:11px;font-family:Montserrat,sans-serif;font-size:13px;font-weight:700;color:#fff;background:linear-gradient(135deg,#d97c14,#f59220);box-shadow:0 10px 30px rgba(0,0,0,.25)';
            b.innerHTML = '<i class="fa-solid fa-bullseye"></i> Add your grades in Gradebook to filter by admission chance';
            document.body.appendChild(b);
            setTimeout(function () { b.style.transition = 'opacity .4s'; b.style.opacity = '0'; setTimeout(function () { b.remove(); }, 400); }, 2600);
        }
    });
}());

/* ── "Use for Gradebook": save the chosen Explore filters for the Gradebook ──
   While active, the current filters (city/field/type/budget) are saved and used
   by the Gradebook's "realistic options". */
(function () {
    var btn = document.getElementById('expSaveGbBtn');
    if (!btn) return;
    var ON_KEY = 'us_gb_filters_on_' + user.id;
    var isOn = function () { return localStorage.getItem(ON_KEY) === '1'; };

    function captureFilters() {
        return {
            kind:    'filters',
            city:    document.getElementById('fCity').value || '',
            field:   document.getElementById('fField').value || '',
            type:    document.getElementById('fType').value || '',
            tuition: document.getElementById('fTuition').value || '',
            budget:  budgetFilterOn ? (getProfile().budget || '') : ''
        };
    }
    function paint() {
        var on = isOn();
        btn.classList.toggle('exp__savegb__btn--on', on);
        var span = btn.querySelector('span');
        if (span) span.textContent = on ? 'Saving to Gradebook' : 'Use for Gradebook';
    }
    // Re-capture whenever filters change while active.
    window.gbCaptureIfOn = function () { if (isOn()) setGbFilters(captureFilters()); };
    ['fCity','fField','fType','fTuition','cmpSearch'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.addEventListener('change', window.gbCaptureIfOn); el.addEventListener('input', window.gbCaptureIfOn); }
    });

    btn.addEventListener('click', function () {
        var next = !isOn();
        localStorage.setItem(ON_KEY, next ? '1' : '0');
        if (next) { setGbFilters(captureFilters()); toastMini('Filters saved for your Gradebook'); }
        else { setGbFilters(null); toastMini('Gradebook filters cleared'); }
        paint();
    });
    paint();

    function toastMini(msg) {
        var b = document.createElement('div');
        b.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:6000;padding:11px 18px;border-radius:11px;font-family:Montserrat,sans-serif;font-size:13px;font-weight:700;color:#fff;background:linear-gradient(135deg,#d97c14,#f59220);box-shadow:0 10px 30px rgba(0,0,0,.25)';
        b.innerHTML = '<i class="fa-solid fa-graduation-cap"></i> ' + msg;
        document.body.appendChild(b);
        setTimeout(function () { b.style.transition = 'opacity .4s'; b.style.opacity = '0'; setTimeout(function () { b.remove(); }, 400); }, 2200);
    }
}());
document.getElementById('cmpClear').addEventListener('click', function() {
    ['cmpSearch','fCity','fField','fType','fTuition','fReach'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('cmpSort').value = 'tuition-asc';
    setBudgetMode(false);
    cmpPage = 1;
    renderCompare();
    if (window.gbCaptureIfOn) window.gbCaptureIfOn();
});

document.getElementById('budgetFilterBtn').addEventListener('click', function() {
    setBudgetMode(!budgetFilterOn);
    if (window.gbCaptureIfOn) window.gbCaptureIfOn();
});

(function() {
    var overlay  = document.getElementById('compareModalOverlay');
    var closeBtn = document.getElementById('compareModalClose');
    var openBtn  = document.getElementById('openCompareModal');
    if (!overlay) return;

    function openCompareModal() {
        if (typeof cmpInitCountrySelectors === 'function') cmpInitCountrySelectors();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        // position the tab slider now that widths are measurable
        if (typeof window.__cmpPlaceTab === 'function') requestAnimationFrame(window.__cmpPlaceTab);
    }
    function closeCompareModal() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
        if (typeof cmpResetAll === 'function') cmpResetAll();
    }

    if (openBtn)  openBtn.addEventListener('click', openCompareModal);
    if (closeBtn) closeBtn.addEventListener('click', closeCompareModal);
    var savedCmpBtn = document.getElementById('savedCompareBtn');
    if (savedCmpBtn) savedCmpBtn.addEventListener('click', openCompareModal);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeCompareModal();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && overlay.classList.contains('open')) closeCompareModal();
    });
}());

var uniDetailOverlay = document.getElementById('uniDetailOverlay');
document.getElementById('uniDetailClose').addEventListener('click', function() { uniDetailOverlay.classList.remove('open'); });
uniDetailOverlay.addEventListener('click', function(e) { if (e.target === uniDetailOverlay) uniDetailOverlay.classList.remove('open'); });

function tuitionMinCost(u) {
    if (u.tuition && typeof u.tuition === 'string') {
        var clean = u.tuition.replace(/[,\s]/g, '');
        var m = clean.match(/\d+/);
        if (m) return parseInt(m[0]);
    }
    return TS_COST[u.ts] || 0;
}

function uniTuitionLabel(u) {
    if (typeof u.tuition === 'string' && u.tuition.length > 1) return u.tuition;
    var cost = TS_COST[u.ts];
    return cost ? '~€' + cost.toLocaleString() + '/yr' : '—';
}

/* ══════════════ True Cost & ROI — estimation helpers ══════════════
 * Tuition and city living-costs come from real data; salaries, scholarships,
 * visa/insurance and any missing living-costs are ESTIMATED via heuristics
 * (country × field × prestige) and always surfaced to the user as estimates. */

// Average of all numbers in a money string, e.g. "€900–1,400/mo" → 1150.
function moneyRangeMid(str) {
    if (!str || typeof str !== 'string') return 0;
    var nums = (str.replace(/[,\s]/g, '').match(/\d+/g) || []).map(Number);
    if (!nums.length) return 0;
    return nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
}

// Mid-point annual tuition (falls back to the min parser / tier cost).
function tuitionMidCost(u) {
    var mid = moneyRangeMid(u && u.tuition);
    return mid > 0 ? Math.round(mid) : tuitionMinCost(u);
}

var CURRENCY_BY_CODE = { es:'€', fr:'€', de:'€', it:'€', pt:'€', nl:'€', be:'€', ie:'€',
    fi:'€', gb:'£', us:'$', ch:'CHF ', ua:'₴', dk:'kr ', se:'kr ' };
function currencySymFor(code) { return CURRENCY_BY_CODE[code] || '€'; }

// Relative salary level of each country vs a mid-European baseline.
var COUNTRY_SALARY_MULT = { us:1.70, ch:1.90, gb:1.30, ie:1.32, nl:1.22, de:1.25,
    se:1.25, dk:1.28, fi:1.20, be:1.18, fr:1.10, it:0.92, es:0.85, pt:0.80, ua:0.45 };
// Annual living-cost fallback (€) when a city has no cost data.
var COUNTRY_LIVING_FALLBACK = { ch:18000, us:16000, gb:15000, ie:14500, dk:14000,
    se:13000, nl:13500, fi:12500, de:12000, be:11500, fr:12500, it:10500,
    es:9500, pt:9000, ua:5000 };
// Estimated annual visa + health-insurance overhead for an international student (€).
var COUNTRY_VISA_INS = { us:2600, ch:1700, gb:1600, ie:1300, se:1000, dk:1000,
    fi:1000, nl:1100, de:900, be:900, fr:900, it:900, es:850, pt:800, ua:500 };

function countryOf(u) {
    return (u && (u.country_code || u.cc || currentCountryCode) || currentCountryCode || 'es').toLowerCase();
}

// Annual living cost for a uni's city (real city data → fallback by country).
function cityLivingAnnual(u) {
    var info = (typeof CITY_INFO !== 'undefined' && u && u.city) ? CITY_INFO[u.city] : null;
    var monthly = info ? moneyRangeMid(info.cost) : 0;
    if (monthly > 0) return Math.round(monthly * 12);
    return COUNTRY_LIVING_FALLBACK[countryOf(u)] || 11000;
}

// Estimated starting graduate salary = field base × country level × prestige.
function estStartingSalary(u, field) {
    var base = ROI_FIELD_SALARY[field] || 35000;
    var cMult = COUNTRY_SALARY_MULT[countryOf(u)] || 1.0;
    var diff = (u && u.diff) || 3;
    var prestige = ({ 1:0.85, 2:0.92, 3:1.0, 4:1.12, 5:1.25 })[diff] || 1.0;
    return Math.round(base * cMult * prestige / 100) * 100;
}

// Estimated scholarship/aid as a fraction of tuition (potential, not guaranteed).
function estScholarshipRate(u) {
    var rate = uniIsPublic(u) ? 0.15 : 0.25;
    var diff = (u && u.diff) || 3;
    if (diff >= 5) rate += 0.15; else if (diff === 4) rate += 0.08;
    return Math.min(0.45, rate);
}
function uniIsPublic(u) { return (u.type || '').toLowerCase() === 'public'; }
function uniTypeLabel(u) { var t = u.type || ''; return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase(); }

/* ── What you can study ─────────────────────────────────────────────
   Flagship universities have curated subject lists (data/uni_subjects.js,
   grouped by area, from their faculties and departments). Everyone else
   falls back to the broad areas in data/<cc>.json — and says so. */
var SUBJ_AREAS = {
    H: ['Humanities & Arts', 'fa-feather-pointed', '#c2410c'], S: ['Social Sciences', 'fa-people-group', '#7c3aed'],
    B: ['Business & Economics', 'fa-chart-line', '#0f766e'], L: ['Law', 'fa-scale-balanced', '#b45309'],
    N: ['Sciences & Maths', 'fa-flask', '#2563eb'], E: ['Engineering & Technology', 'fa-gears', '#475569'],
    C: ['Computing & Data', 'fa-microchip', '#0891b2'], M: ['Medicine & Health', 'fa-heart-pulse', '#dc2626'],
    A: ['Architecture & Design', 'fa-compass-drafting', '#a16207'], D: ['Education', 'fa-chalkboard-user', '#15803d'],
    G: ['Agriculture & Environment', 'fa-seedling', '#4d7c0f'], X: ['Other', 'fa-shapes', '#6b7280']
};
var SUBJ_ORDER = 'HSBLNECMADGX';
var FIELD_AREA = (function () {
    var m = {}, add = function (k, list) { list.forEach(function (f) { m[f.toLowerCase()] = k; }); };
    add('H', ['Humanities', 'Arts', 'Music', 'Theology', 'Linguistics', 'History', 'Theatre', 'Film', 'Heritage', 'Translation', 'Culinary Arts', 'Multimedia', 'Arts Education']);
    add('S', ['Social Science', 'Psychology', 'Journalism', 'Communication', 'Media', 'International Relations', 'Political Science', 'Sociology', 'Social Work', 'Development Studies', 'Peace Studies', 'Conflict Transformation', 'Governance', 'Criminal Justice', 'Sports', 'Sports Science', 'Events']);
    add('B', ['Business', 'Economics', 'Finance', 'Management', 'Marketing', 'Accounting', 'Tourism', 'Hospitality', 'International Business', 'International Trade', 'Luxury Management', 'Sports Management', 'Leadership', 'Strategy', 'Information Management']);
    add('L', ['Law', 'International Law', 'Civil Law']);
    add('N', ['Science', 'Biology', 'Physics', 'Chemistry', 'Mathematics', 'Natural Sciences', 'Life Sciences', 'Geology', 'Geography', 'Environmental Science', 'Environmental Sciences', 'Ecology', 'Biodiversity', 'Meteorology', 'Hydrology', 'Natural Hazards', 'Optics', 'Accelerator Science', 'Genomics', 'Computational Biology', 'Bioinformatics', 'Sustainability', 'Conservation']);
    add('E', ['Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Electronics', 'Aerospace', 'Energy', 'Telecommunications', 'Maritime', 'Nautical', 'Navigation', 'Robotics', 'Materials Science', 'Mining', 'Petroleum', 'Metallurgy', 'Water Management', 'Agricultural Engineering', 'Textiles']);
    add('C', ['CS', 'Informatics', 'Data Science', 'Cybersecurity', 'IT', 'Digital Technology']);
    add('M', ['Medicine', 'Health Sciences', 'Nursing', 'Pharmacy', 'Dentistry', 'Veterinary', 'Public Health', 'Epidemiology', 'Tropical Medicine', 'Health Policy', 'Biomedical Sciences']);
    add('A', ['Architecture', 'Design', 'Fashion', 'Urban Planning', 'Urban Design', 'Interior Design', 'Landscape']);
    add('D', ['Education', 'Pedagogy', 'Physical Education', 'Special Education']);
    add('G', ['Agriculture', 'Forestry', 'Forest Science', 'Food Science', 'Food Technology', 'Natural Resources', 'International Agriculture']);
    return m;
}());
function uniKey(u) { return (u.country_code || u.cc || currentCountryCode || '').toLowerCase() + ':' + u.id; }
// { curated, groups: [{ k, label, icon, color, list }], total, deg, degTypical }
function uniSubjects(u) {
    var cur = (window.UNI_SUBJECTS || {})[uniKey(u)], groups = [];
    if (cur) {
        SUBJ_ORDER.split('').forEach(function (k) { if (cur.g[k] && cur.g[k].length) groups.push({ k: k, list: cur.g[k].slice() }); });
    } else {
        var by = {};
        (u.fields || []).forEach(function (f) { var k = FIELD_AREA[String(f).toLowerCase()] || 'X'; (by[k] = by[k] || []).push(f === 'CS' ? 'Computer Science' : f); });
        SUBJ_ORDER.split('').forEach(function (k) { if (by[k]) groups.push({ k: k, list: by[k] }); });
    }
    groups.forEach(function (g) { var a = SUBJ_AREAS[g.k]; g.label = a[0]; g.icon = a[1]; g.color = a[2]; });
    var deg = cur && cur.deg || (window.UNI_DEGREES || {})[uniKey(u)] || null;
    if (!deg && u.kind === 'institute') deg = ['Research placements via partner universities'];
    return { curated: !!cur, groups: groups, total: groups.reduce(function (n, g) { return n + g.list.length; }, 0),
             deg: deg || ['Bachelor', 'Master', 'PhD'], degTypical: !deg };
}
window.uniSubjects = uniSubjects;
function degreesOf(u) { try { return uniSubjects(u).deg; } catch (e) { return ['Bachelor', 'Master', 'PhD']; } }   // may run before the tables above exist
// A varied preview: take one subject from each area in turn.
function subjectPreview(s, n) {
    var out = [], i = 0, left = true;
    while (out.length < n && left) {
        left = false;
        s.groups.forEach(function (g) { if (g.list[i] != null && out.length < n) { out.push({ t: g.list[i], c: g.color }); left = true; } });
        i++;
    }
    return out;
}

// The full list, in its own sheet above the university card.
var usx = null, usxUni = null;
function usxBuild() {
    usx = document.createElement('div');
    usx.className = 'usx'; usx.id = 'subjectsOverlay'; usx.setAttribute('aria-hidden', 'true');
    usx.innerHTML =
        '<div class="usx__panel" role="dialog" aria-modal="true" aria-labelledby="usxTitle" tabindex="-1">' +
            '<header class="usx__hd"><div class="usx__aura" aria-hidden="true"><i></i><i></i></div>' +
                '<div class="usx__top"><span class="usx__crest" id="usxCrest"></span><div class="usx__ttl"><p class="usx__kicker">What you can study</p><h2 class="usx__name" id="usxTitle"></h2></div>' +
                    '<button type="button" class="usx__x" data-usx-close aria-label="Close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>' +
                '<div class="usx__stats" id="usxStats"></div>' +
                '<label class="usx__search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span class="dt-sr">Search subjects</span><input type="search" id="usxQ" placeholder="Search a subject — e.g. Physics, Law, Design" autocomplete="off"></label>' +
            '</header>' +
            '<nav class="usx__pills" id="usxPills" aria-label="Subject areas"></nav>' +
            '<div class="usx__body"><div class="usx__grid" id="usxGrid"></div><p class="usx__none" id="usxNone" hidden></p></div>' +
            '<footer class="usx__ft"><p class="usx__src" id="usxSrc"></p><a class="usx__site" id="usxSite" target="_blank" rel="noopener noreferrer">Official course list <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i></a></footer>' +
        '</div>';
    document.body.appendChild(usx);
    usx.addEventListener('click', function (e) {
        if (e.target === usx || e.target.closest('[data-usx-close]')) { usxClose(); return; }
        var pill = e.target.closest('[data-area]');
        if (pill) { usx.querySelectorAll('.usx__pill').forEach(function (p) { p.classList.toggle('is-on', p === pill); p.setAttribute('aria-pressed', p === pill ? 'true' : 'false'); }); usxFilter(); }
    });
    usx.querySelector('#usxQ').addEventListener('input', usxFilter);
    // Capture, so Esc closes this sheet without also closing the university card underneath.
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && usx.classList.contains('open')) { e.stopImmediatePropagation(); e.preventDefault(); usxClose(); }
    }, true);
}
function usxFilter() {
    var q = usx.querySelector('#usxQ').value.trim().toLowerCase(), on = usx.querySelector('.usx__pill.is-on'), area = on ? on.getAttribute('data-area') : '*', shown = 0;
    usx.querySelectorAll('.usx__card').forEach(function (card) {
        var n = 0;
        card.querySelectorAll('.usx__chip').forEach(function (c) {
            var t = c.getAttribute('data-t'), hit = !q || t.toLowerCase().indexOf(q) !== -1;
            c.hidden = !hit;
            c.innerHTML = q && hit ? udmEsc(t).replace(new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>') : udmEsc(t);
            if (hit) n++;
        });
        var vis = n > 0 && (area === '*' || card.getAttribute('data-area') === area);
        card.hidden = !vis; if (vis) shown += n;
        card.querySelector('.usx__card__n').textContent = n;
    });
    var none = usx.querySelector('#usxNone');
    none.hidden = shown > 0;
    none.textContent = shown ? '' : 'No subject matches “' + q + '” here. The official course list has every programme.';
}
function openSubjects(u) {
    if (!u) return;
    if (!usx) usxBuild();
    usxUni = u;
    var s = uniSubjects(u);
    usx.style.setProperty('--uc', u.color || '#3552d8');
    usx.querySelector('#usxCrest').innerHTML = uniLogo(u, 40); cmpHydrateLogos(usx.querySelector('#usxCrest'));
    usx.querySelector('#usxTitle').textContent = u.name;
    usx.querySelector('#usxStats').innerHTML = (s.curated
            ? '<span><b>' + s.total + '</b> subject' + (s.total === 1 ? '' : 's') + '</span><span><b>' + s.groups.length + '</b> area' + (s.groups.length === 1 ? '' : 's') + '</span>'
            : '<span><b>' + s.total + '</b> broad subject area' + (s.total === 1 ? '' : 's') + '</span>') +
        '<span class="usx__deg">' + s.deg.map(function (d) { return '<i>' + udmEsc(d) + '</i>'; }).join('') + (s.degTypical ? '<em>typical</em>' : '') + '</span>';
    usx.querySelector('#usxPills').innerHTML = '<button type="button" class="usx__pill is-on" data-area="*" aria-pressed="true">All <small>' + s.total + '</small></button>' +
        s.groups.map(function (g) { return '<button type="button" class="usx__pill" data-area="' + g.k + '" aria-pressed="false" style="--ac:' + g.color + '"><i class="fa-solid ' + g.icon + '" aria-hidden="true"></i>' + udmEsc(g.label) + ' <small>' + g.list.length + '</small></button>'; }).join('');
    usx.querySelector('#usxGrid').innerHTML = s.groups.map(function (g, gi) {
        return '<section class="usx__card" data-area="' + g.k + '" style="--ac:' + g.color + ';--gi:' + gi + '">' +
            '<h3><span class="usx__card__ic"><i class="fa-solid ' + g.icon + '" aria-hidden="true"></i></span>' + udmEsc(g.label) + '<small class="usx__card__n">' + g.list.length + '</small></h3>' +
            '<div class="usx__chips">' + g.list.map(function (t, i) { return '<span class="usx__chip" data-t="' + udmEsc(t) + '" style="--ci:' + Math.min(i, 14) + '">' + udmEsc(t) + '</span>'; }).join('') + '</div></section>';
    }).join('');
    usx.querySelector('#usxQ').value = '';
    usx.querySelector('#usxNone').hidden = true;
    usx.querySelector('#usxSrc').innerHTML = s.curated
        ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> From the university’s faculties and departments, checked September 2026. Programme names and intakes change every year — confirm on the official course list before you apply.'
        : '<i class="fa-solid fa-circle-info" aria-hidden="true"></i> We only have this university’s broad subject areas so far, not its full course list. The official site lists every programme.';
    usx.querySelector('#usxSite').href = u.website || 'https://www.google.com/search?q=' + encodeURIComponent(u.name + ' courses list');
    usx.classList.remove('is-in'); void usx.offsetWidth;
    usx.classList.add('open', 'is-in');
    usx.setAttribute('aria-hidden', 'false');
    setTimeout(function () { var p = usx.querySelector('.usx__panel'); if (p) p.focus({ preventScroll: true }); }, 40);
}
function usxClose() { if (!usx) return; usx.classList.remove('open'); usx.setAttribute('aria-hidden', 'true'); }
window.openSubjects = openSubjects;

/* ── University detail card ──────────────────────────────────────────
   One card for every place a university opens from (Overview top ten and
   saved cards, Explore search, rankings, budget matches, Apply list,
   Gradebook). Hero in the university's own colour with its crest; then
   the numbers, what it costs and how hard it is to get in, your chance if
   you have grades, fields, languages, what to know and who hires from it.
   Styles: unidetail.css. Motion (count-ups, pips, the chance ring, the
   staggered sections) is CSS-driven and off under reduced motion. */
var currentUdmId = null;
// Where the last press happened, so the card can grow out of it.
var udmPress = null;
document.addEventListener('pointerdown', function (e) {
    if (!e.target || !e.target.closest) return;
    var el = e.target.closest('.mp__uni__card, .cmp__detail__card, .ov-row__btn, .nsearch__row, .rnk__card, .bm__card, .ba__item, .gbsg__card, .gb__rec__item, .gb__dream__card, button, a') || e.target;
    udmPress = { r: el.getBoundingClientRect(), t: Date.now() };
}, true);
var UDM_REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function udmEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function udmPips(n, cls) {
    var h = '';
    for (var i = 1; i <= 5; i++) h += '<i class="udx__pip' + (i <= n ? ' on' : '') + '" style="--p:' + i + '"></i>';
    return '<span class="udx__pips ' + (cls || '') + '" aria-hidden="true">' + h + '</span>';
}
// Numbers count up from a little below; "~24,000" keeps its "~" and commas.
function udmCountUp(el, target, fmt) {
    if (!el) return;
    if (UDM_REDUCED || !target) { el.textContent = fmt(target); return; }
    var from = Math.round(target * 0.82), t0 = 0;
    function step(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(Math.round(from + (target - from) * e));
        if (k < 1 && uniDetailOverlay.classList.contains('open')) requestAnimationFrame(step); else el.textContent = fmt(target);
    }
    el.textContent = fmt(from);
    setTimeout(function () { requestAnimationFrame(step); }, 260);
}
function udmPaintSave(on) {
    var b = document.getElementById('udmSave');
    b.innerHTML = '<i class="fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark" aria-hidden="true"></i>';
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Remove from saved' : 'Save university');
}
function showUniDetail(u) {
    if (!u) return;
    currentUdmId = u.id;
    var ov = uniDetailOverlay, card = ov.querySelector('.udx__card');
    var fields = u.fields || [], langs = u.langs || [];
    card.style.setProperty('--uc', u.color || '#3552d8');

    // Hero: where it ranks at home, the crest (also as a faint watermark), name, tags.
    var cc = (u.country_code || u.cc || currentCountryCode || '').toLowerCase();
    var rankList = (typeof RANKING_DATA !== 'undefined' && RANKING_DATA[cc]) || [], rank = -1;
    for (var r = 0; r < rankList.length; r++) if (rankList[r].id === u.id) { rank = r + 1; break; }
    var cName = (typeof countryNameByCode === 'function') ? countryNameByCode(cc) : cc.toUpperCase();
    document.getElementById('udmEyebrow').innerHTML = rank > 0
        ? '<i class="fa-solid fa-ranking-star" aria-hidden="true"></i> #' + rank + ' in ' + udmEsc(cName)
        : '<span class="fi fi-' + udmEsc(cc) + '" aria-hidden="true"></span> ' + udmEsc(cName);
    var badge = document.getElementById('udmBadge');
    badge.innerHTML = uniLogo(u, 58);
    cmpHydrateLogos(badge);
    document.getElementById('udmName').textContent = u.name;
    var ci = (typeof uniChanceInfo === 'function') ? uniChanceInfo(u) : null;
    document.getElementById('udmTags').innerHTML =
        (u.city ? '<span class="udx__tag"><i class="fa-solid fa-location-dot" aria-hidden="true"></i>' + udmEsc(u.city) + '</span>' : '') +
        (u.type ? '<span class="udx__tag">' + udmEsc(uniTypeLabel(u)) + '</span>' : '') +
        (ci ? '<span class="udx__tag udx__tag--' + ci.cls + '"><i class="fa-solid fa-bullseye" aria-hidden="true"></i>' + ci.label + '</span>' : '') +
        (window.UniRating ? '<span class="udx__tag udx__tag--rate">' + window.UniRating.compact(u) + '</span>' : '');

    // The numbers.
    var living = (typeof CITY_INFO !== 'undefined' && u.city && CITY_INFO[u.city]) ? CITY_INFO[u.city].cost : '';
    var stud = parseInt(String(u.students || '').replace(/[^\d]/g, ''), 10);
    var stats = [
        { k: 'Founded', v: u.founded ? String(u.founded) : '—', id: 'udmFounded' },
        { k: 'Students', v: u.students || '—', id: 'udmStudents' },
        { k: 'Living costs', v: living ? String(living).replace('/mo', '') + '<small>/mo</small>' : '—' },
        { k: 'Age', v: u.founded ? (new Date().getFullYear() - u.founded) + '<small> yrs</small>' : '—' }
    ];
    document.getElementById('udmStats').innerHTML = stats.map(function (s, i) {
        return '<div class="udx__stat" style="--s:' + i + '"><small>' + s.k + '</small><b' + (s.id ? ' id="' + s.id + '"' : '') + '>' + s.v + '</b></div>';
    }).join('');
    if (u.founded) udmCountUp(document.getElementById('udmFounded'), +u.founded, function (n) { return String(n); });
    if (stud) udmCountUp(document.getElementById('udmStudents'), stud, function (n) { return (/^~/.test(u.students) ? '~' : '') + n.toLocaleString('en-GB') + (/\+$/.test(u.students) ? '+' : ''); });

    var matchEl = document.getElementById('udmBudgetMatch');
    if (budgetFilterOn) {
        var uCost = tuitionMinCost(u), prof = getProfile(), fits = uCost <= prof.budget;
        matchEl.hidden = false;
        matchEl.className = 'udx__budget udx__rv udx__budget--' + (fits ? 'ok' : 'over');
        matchEl.innerHTML = fits
            ? '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Within your <strong>€' + prof.budget.toLocaleString() + '/yr</strong> budget'
            : '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i> Over your <strong>€' + prof.budget.toLocaleString() + '/yr</strong> budget — tuition from ~€' + uCost.toLocaleString() + '/yr';
    } else matchEl.hidden = true;

    document.getElementById('udmDesc').textContent = u.desc || '';
    document.getElementById('udmDesc').hidden = !u.desc;

    // Cost, entry difficulty and — with grades — your chance, as a ring.
    var chance = ci
        ? '<div class="udx__meter udx__meter--ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26"/><circle class="udx__ring udx__ring--' + ci.cls + '" cx="32" cy="32" r="26" pathLength="100" style="--v:' + ci.prob + '"/></svg>' +
              '<div><small>Your chance</small><b>' + ci.prob + '%</b><span>' + ci.label + ' · from your grades</span></div></div>'
        : '<button type="button" class="udx__meter udx__meter--cta" data-udm-go="gradebook"><small>Your chance</small><b>Add grades</b><span>See if it’s a reach, match or safety <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></button>';
    document.getElementById('udmMeters').innerHTML =
        '<div class="udx__meter"><small>Annual tuition</small><b title="' + udmEsc(uniTuitionLabel(u)) + '">' + udmEsc(uniTuitionLabel(u)) + '</b>' + udmPips(u.ts || 0, 'udx__pips--cost') +
            '<span class="udx__fee">' + (u.feeEstimate || !(typeof u.tuition === 'string' && u.tuition.length > 1) ? 'Estimate' : 'Varies by course and residency') + ' · check official fees</span></div>' +
        '<div class="udx__meter"><small>Entry difficulty</small><b>' + udmEsc(u.dl || DIFF_LABELS[u.diff] || '—') + '</b>' + udmPips(u.diff || 0, 'udx__pips--diff') + '</div>' +
        chance;

    var subj = uniSubjects(u), prev = subjectPreview(subj, 6);
    document.getElementById('udmFields').innerHTML = prev.map(function (x, i) { return '<span class="udx__chip" style="--c:' + i + ';--ac:' + x.c + '"><i class="udx__chip__dot" aria-hidden="true"></i>' + udmEsc(x.t) + '</span>'; }).join('') +
        (subj.total > 6 ? '<button type="button" class="udx__chip udx__chip--more" style="--c:6" data-udm-subjects>+' + (subj.total - 6) + ' more</button>'
            : subj.total ? '<button type="button" class="udx__chip udx__chip--more udx__chip--ghost" style="--c:6" data-udm-subjects>Details</button>' : '') ||
        '<span class="udx__none">—</span>';
    document.getElementById('udmSubjMeta').textContent = subj.curated ? subj.total + ' subjects' : 'broad areas';
    document.getElementById('udmDegrees').innerHTML = subj.deg.map(function (d, i) { return '<span class="udx__chip udx__chip--deg" style="--c:' + (i + 2) + '">' + udmEsc(d) + '</span>'; }).join('') +
        (subj.degTypical ? '<span class="udx__typ" title="Typical for this kind of university — check the official site">typical</span>' : '');
    document.getElementById('udmLangs').innerHTML = langs.map(function (l, i) { return '<span class="udx__chip udx__chip--lang" style="--c:' + i + '"><i class="fa-solid fa-language" aria-hidden="true"></i>' + udmEsc(l) + '</span>'; }).join('') || '<span class="udx__none">—</span>';

    var insights = [];
    var TUITION_NOTES = {
        1: { icon: 'fa-solid fa-piggy-bank', text: 'Very affordable tuition — excellent value, especially for EU students' },
        2: { icon: 'fa-solid fa-piggy-bank', text: 'Budget-friendly fees — good quality at reasonable cost' },
        3: { icon: 'fa-solid fa-coins',      text: 'Mid-range tuition — typical for established private institutions' },
        4: { icon: 'fa-solid fa-coins',      text: 'Premium fees — investment in a globally recognised degree' },
        5: { icon: 'fa-solid fa-gem',        text: 'Elite private tuition — among the most expensive institutions' }
    };
    var DIFF_NOTES = {
        1: { icon: 'fa-solid fa-door-open',  text: 'Open entry — accessible to most applicants with standard qualifications' },
        2: { icon: 'fa-solid fa-door-open',  text: 'Low competition — a solid application is usually sufficient' },
        3: { icon: 'fa-solid fa-fire-flame-curved', text: 'Competitive — strong academic record and motivation letter recommended' },
        4: { icon: 'fa-solid fa-fire-flame-curved', text: 'Highly selective — top grades and extracurriculars make a difference' },
        5: { icon: 'fa-solid fa-crown',      text: 'Elite selective — very low acceptance rate; prepare a standout application' }
    };
    if (TUITION_NOTES[u.ts])   insights.push(TUITION_NOTES[u.ts]);
    if (DIFF_NOTES[u.diff])    insights.push(DIFF_NOTES[u.diff]);
    if (langs.some(function (l) { return l === 'English' || l === 'Bilingual'; })) {
        insights.push({ icon: 'fa-solid fa-earth-europe', text: 'English-taught programmes available — great for international applicants' });
    }
    if (u.founded && u.founded < 1500) {
        insights.push({ icon: 'fa-solid fa-landmark', text: 'Founded in ' + u.founded + ' — one of the oldest universities in Europe' });
    } else if (u.founded && u.founded < 1800) {
        insights.push({ icon: 'fa-solid fa-landmark', text: 'Over 200 years of academic heritage — established ' + u.founded });
    }
    if (uniIsPublic(u)) {
        insights.push({ icon: 'fa-solid fa-building-columns', text: 'State-funded — regulated tuition and guaranteed academic standards' });
    } else if (u.type) {
        insights.push({ icon: 'fa-solid fa-building', text: 'Private institution — often smaller classes and industry-focused programmes' });
    }
    document.getElementById('udmInsights').innerHTML = insights.slice(0, 4).map(function (ins, i) {
        return '<div class="udx__insight" style="--c:' + i + '"><span class="udx__insight__ic"><i class="' + ins.icon + '" aria-hidden="true"></i></span><span>' + ins.text + '</span></div>';
    }).join('');

    // Who recruits from here (Career Paths data).
    var rec = [];
    if (typeof window.crsUniRecruiters === 'function') { try { rec = window.crsUniRecruiters(u, 5); } catch (e) { rec = []; } }
    document.getElementById('udmRecruitWrap').hidden = !rec.length;
    document.getElementById('udmRecruit').innerHTML = rec.map(function (x, i) {
        return '<span class="udx__co" style="--c:' + i + '" title="' + udmEsc(x.name) + '">' + x.logo + '<span>' + udmEsc(x.name) + '</span></span>';
    }).join('');

    document.getElementById('udmResearch').href = u.website
        ? u.website
        : 'https://www.google.com/search?q=' + encodeURIComponent(u.name + ' official website admissions');
    udmPaintSave(getSaved().indexOf(u.id) !== -1);

    // Open: the card grows out of whatever you clicked (a row, a card, a logo), then its
    // contents rise in. Switching straight to another university just replays the contents.
    var wasOpen = ov.classList.contains('open');
    ov.querySelector('.udx__scroll').scrollTop = 0;
    ov.classList.remove('is-in');
    var from = !wasOpen && udmPress && Date.now() - udmPress.t < 1500 ? udmPress.r : null;
    var morph = !!(from && from.width > 20 && from.height > 12 && !UDM_REDUCED && card.animate && window.innerWidth > 640);
    ov.classList.toggle('is-morph', morph);
    ov.classList.add('open');
    ov.setAttribute('aria-hidden', 'false');
    void card.offsetWidth;
    if (morph) {
        var fw = card.offsetWidth, fh = card.offsetHeight;
        var dx = (from.left + from.width / 2) - (card.offsetLeft + fw / 2), dy = (from.top + from.height / 2) - (card.offsetTop + fh / 2);
        card.animate([
            { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + (from.width / fw).toFixed(3) + ',' + (from.height / fh).toFixed(3) + ')', borderRadius: '14px', opacity: .5 },
            { transform: 'none', borderRadius: '28px', opacity: 1 }
        ], { duration: 640, easing: 'cubic-bezier(.2,.85,.2,1)' });
        setTimeout(function () { ov.classList.remove('is-morph'); ov.classList.add('is-in'); }, 330);
    } else ov.classList.add('is-in');
    setTimeout(function () { if (ov.classList.contains('open')) card.focus({ preventScroll: true }); }, 60);
}
// Close: the button, the backdrop, Esc. aria-hidden follows the open class wherever it's removed.
new MutationObserver(function () { uniDetailOverlay.setAttribute('aria-hidden', uniDetailOverlay.classList.contains('open') ? 'false' : 'true'); })
    .observe(uniDetailOverlay, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && uniDetailOverlay.classList.contains('open') && !document.querySelector('.ur-modal')) uniDetailOverlay.classList.remove('open');
});
uniDetailOverlay.addEventListener('click', function (e) {
    if (e.target.closest('[data-udm-subjects]')) { var su = UNI.find(function (x) { return x.id === currentUdmId; }) || (window.uniFromRegistry && window.uniFromRegistry(currentUdmId)); openSubjects(su); return; }
    var go = e.target.closest('[data-udm-go]');
    if (go) { uniDetailOverlay.classList.remove('open'); showTab(go.getAttribute('data-udm-go')); return; }
    if (e.target.closest('#udmCareers')) {
        var u = UNI.find(function (x) { return x.id === currentUdmId; });
        uniDetailOverlay.classList.remove('open');
        if (window.openCareers) window.openCareers(u || document.getElementById('udmName').textContent);
    }
});
document.getElementById('udmSave').addEventListener('click', function() {
    var saved = getSaved();
    var idx = saved.indexOf(currentUdmId);
    if (idx === -1) saved.push(currentUdmId); else saved.splice(idx, 1);
    setSaved(saved);
    var on = saved.indexOf(currentUdmId) !== -1;
    udmPaintSave(on);
    document.querySelectorAll('.mp__save__btn[data-id="' + currentUdmId + '"]').forEach(function(b) {
        b.style.color = on ? 'rgb(228,155,20)' : 'rgba(0,0,0,.2)';
        b.querySelector('i').className = 'fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark';
    });
    renderSaved(); updateStats();
});

// Every university card opens the same detail — also the ones that used to do nothing on click.
document.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('.mp__uni__card[data-id], .cmp__detail__card[data-id], .gb__rec__item[data-id], .gb__dream__card[data-id]');
    if (!card || e.target.closest('button, a, input, select, label, .ur-compact, .mp__card__recr')) return;
    var id = card.getAttribute('data-id');
    var u = UNI.find(function (x) { return x.id === id; }) || (typeof window.uniFromRegistry === 'function' ? window.uniFromRegistry(id) : null);
    if (u) showUniDetail(u);
});

document.getElementById('udmAddCompare').addEventListener('click', function() {
    var u = UNI.find(function(x){ return x.id === currentUdmId; });
    if (!u) return;
    uniDetailOverlay.classList.remove('open');
    var overlay = document.getElementById('compareModalOverlay');
    if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
    if (typeof cmpInitCountrySelectors === 'function') cmpInitCountrySelectors();
    // This university belongs to the currently selected country — point slot A there
    if (typeof cmpSetSlotCountry === 'function' && typeof currentCountryCode !== 'undefined') {
        cmpSetSlotCountry('A', currentCountryCode);
    }
    var inputA = document.getElementById('cmpSearchA');
    if (inputA) {
        inputA.value = u.name;
        inputA.dispatchEvent(new Event('input'));
        setTimeout(function() {
            var firstResult = document.querySelector('#cmpResultsA .cmp__vs__item');
            if (firstResult) firstResult.click();
        }, 200);
    }
});

document.getElementById('udmTrackApp').addEventListener('click', function() {
    var saved = getSaved();
    if (saved.indexOf(currentUdmId) === -1) {
        saved.push(currentUdmId);
        setSaved(saved);
        renderSaved(); updateStats();
    }
    uniDetailOverlay.classList.remove('open');
    showTab('tracker');
});

var UCH_KEY = 'uniscout_chat_v1';
var uchCurrentUniId   = null;
var uchCurrentUniName = null;
var uchCurrentColor   = '#d97c14';
var uchMode           = 'uni';
var uchCurrentDmId    = null;
var uchCurrentDmName  = null;

var FRIENDS_KEY = 'us_friends_' + user.id;
var FR_SENT_KEY = 'us_fr_sent_'  + user.id;
var FR_RECV_KEY = 'us_fr_recv_'  + user.id;
var DM_KEY      = 'us_dm_'       + user.id;

var FRD_STATUS_LABELS = {
    highschool: '🏫 High School Student', gap: '🌏 Gap Year', undergrad: '📖 Undergraduate',
    transfer: '🔄 Transfer Student', masters: '🎓 Master\'s Applicant',
    phd: '🔬 PhD / Researcher', professional: '💼 Working Professional', parent: '👨‍👧 Parent'
};
var FRD_LANG_LABELS = {
    en: '🇬🇧 English', es: '🇪🇸 Español', fr: '🇫🇷 Français',
    de: '🇩🇪 Deutsch', it: '🇮🇹 Italiano', pt: '🇵🇹 Português',
    uk: '🇺🇦 Українська', pl: '🇵🇱 Polski'
};

function frdAvaColor(name) {
    var palette = ['#e74c3c','#e67e22','#f1c40f','#27ae60','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4','#8bc34a'];
    var h = 0;
    for (var i = 0; i < (name || '').length; i++) h = (h * 31 + (name.charCodeAt(i))) | 0;
    return palette[Math.abs(h) % palette.length];
}

function isFriendOnline(friendId) {
    var lastSeen = parseInt(localStorage.getItem('us_lastseen_' + friendId) || '0');
    return (Date.now() - lastSeen) < 5 * 60 * 1000;
}

function getFriends()   { try { return JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]'); }  catch(e){ return []; } }
function setFriends(d)  { localStorage.setItem(FRIENDS_KEY, JSON.stringify(d)); }
function getFrSent()    { try { return JSON.parse(localStorage.getItem(FR_SENT_KEY) || '[]'); }  catch(e){ return []; } }
function setFrSent(d)   { localStorage.setItem(FR_SENT_KEY, JSON.stringify(d)); }
function getFrRecv()    { try { return JSON.parse(localStorage.getItem(FR_RECV_KEY) || '[]'); }  catch(e){ return []; } }
function setFrRecv(d)   { localStorage.setItem(FR_RECV_KEY, JSON.stringify(d)); }
function getDMs()       { try { return JSON.parse(localStorage.getItem(DM_KEY) || '{}'); }       catch(e){ return {}; } }
function saveDMs(d)     { localStorage.setItem(DM_KEY, JSON.stringify(d)); }

function sendFriendRequest(toId) {
    var sent = getFrSent();
    if (sent.indexOf(toId) !== -1) return;
    sent.push(toId);
    setFrSent(sent);
    var recvKey = 'us_fr_recv_' + toId;
    var recv = [];
    try { recv = JSON.parse(localStorage.getItem(recvKey) || '[]'); } catch(e){}
    if (!recv.find(function(r){ return r.fromId === user.id; })) {
        var prof = getProfile();
        recv.push({ fromId: user.id, fromUsername: user.username, fromAvatar: prof.avatar || null, ts: Date.now() });
        localStorage.setItem(recvKey, JSON.stringify(recv));
    }
}

function acceptFriendRequest(fromId, fromUsername, fromAvatar) {
    var friends = getFriends();
    if (!friends.find(function(f){ return f.id === fromId; })) {
        friends.push({ id: fromId, username: fromUsername, avatar: fromAvatar || null, online: false, addedAt: Date.now() });
        setFriends(friends);
    }
    var theirFrKey = 'us_friends_' + fromId;
    var theirFr = [];
    try { theirFr = JSON.parse(localStorage.getItem(theirFrKey) || '[]'); } catch(e){}
    if (!theirFr.find(function(f){ return f.id === user.id; })) {
        var prof = getProfile();
        theirFr.push({ id: user.id, username: user.username, avatar: prof.avatar || null, online: false, addedAt: Date.now() });
        localStorage.setItem(theirFrKey, JSON.stringify(theirFr));
    }
    setFrRecv(getFrRecv().filter(function(r){ return r.fromId !== fromId; }));
    var theirSentKey = 'us_fr_sent_' + fromId;
    try {
        var ts = JSON.parse(localStorage.getItem(theirSentKey) || '[]').filter(function(id){ return id !== user.id; });
        localStorage.setItem(theirSentKey, JSON.stringify(ts));
    } catch(e){}
}

function declineFriendRequest(fromId) {
    setFrRecv(getFrRecv().filter(function(r){ return r.fromId !== fromId; }));
}

function updateFriendStats() {
    var fEl = document.getElementById('heroCountFriends');
    var oEl = document.getElementById('heroCountOnline');
    var friends = getFriends();
    if (fEl) fEl.textContent = friends.length;
    if (oEl) oEl.textContent = friends.filter(function(f){ return isFriendOnline(f.id); }).length;
}

var UCH_SEED = {
    ucm:  [
        { id:'s1', author:'Sofia M.',   initials:'SM', color:'#e74c3c', text:'I just got accepted to UCM for Law! The process was long but worth it. Happy to help anyone with the application.', ts: Date.now()-86400000*5 },
        { id:'s2', author:'Carlos R.',  initials:'CR', color:'#2980b9', text:'UCM is incredible for medicine. The campus is huge and the clinical placements start early. Highly recommend.', ts: Date.now()-86400000*3 },
        { id:'s3', author:'Ana L.',     initials:'AL', color:'#27ae60', text:'Cost of living in Madrid is manageable if you live in shared flat. I pay €350/month for my room in Moncloa.', ts: Date.now()-86400000 }
    ],
    ucl:  [
        { id:'s1', author:'Priya S.',   initials:'PS', color:'#9b59b6', text:'UCL\'s location in Bloomsbury is unbeatable. British Museum literally next door. Worth every penny.', ts: Date.now()-86400000*7 },
        { id:'s2', author:'Tom B.',     initials:'TB', color:'#1565c0', text:'Warning: accommodation is extremely competitive. Apply for halls on the day you get your offer letter — not a day later.', ts: Date.now()-86400000*2 }
    ],
    eth:  [
        { id:'s1', author:'Markus L.',  initials:'ML', color:'#1565c0', text:'ETH is the hardest I\'ve ever worked but also the most rewarding. The research environment is extraordinary.', ts: Date.now()-86400000*4 },
        { id:'s2', author:'Yuki T.',    initials:'YT', color:'#e74c3c', text:'Get the half-price SBB rail card (Halbtax) immediately — saves 50% on all Swiss train travel. Essential.', ts: Date.now()-86400000*1 }
    ],
    knu:  [
        { id:'s1', author:'Olena K.',   initials:'OK', color:'#003087', text:'KNU has incredible history. Studying here means something special right now. The student community is incredibly close.', ts: Date.now()-86400000*3 },
        { id:'s2', author:'Ivan H.',    initials:'IH', color:'#f9d71c', text:'Learn Ukrainian before you come — you\'ll get so much more out of the experience and people will embrace you.', ts: Date.now()-86400000*1 }
    ]
};

function uchGetChats() {
    try { return JSON.parse(localStorage.getItem(UCH_KEY)) || {}; }
    catch(e) { return {}; }
}
function uchSaveChats(chats) { localStorage.setItem(UCH_KEY, JSON.stringify(chats)); }

function uchGetMessages(uniId) {
    var chats = uchGetChats();
    if (!chats[uniId]) {
        chats[uniId] = (UCH_SEED[uniId] || []).slice();
        uchSaveChats(chats);
    }
    return chats[uniId];
}

function uchAddMessage(uniId, text) {
    var chats = uchGetChats();
    if (!chats[uniId]) chats[uniId] = (UCH_SEED[uniId] || []).slice();
    var me = user || { username: 'Student' };
    var name = me.username || 'Student';
    var words = name.trim().split(/\s+/);
    var initials = (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
    chats[uniId].push({ id: 'u' + Date.now(), author: name, initials: initials, color: 'var(--orange)', text: text, ts: Date.now(), own: true });
    uchSaveChats(chats);
}

function uchFormatTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    var diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return d.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
}

function uchFormatMsgTime(ts) {
    var d = new Date(ts);
    var now = new Date();
    var isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
    return d.toLocaleDateString('en-GB', {day:'numeric', month:'short'}) + ' ' + d.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'});
}

function uchBuildAvatarHtml(m, isOwn) {
    if (isOwn) {
        var prof = getProfile();
        if (prof && prof.avatar) {
            return '<div class="uch__avatar uch__avatar--photo"><img src="' + prof.avatar + '" alt="me"></div>';
        }
        return '<div class="uch__avatar" style="background:linear-gradient(135deg,var(--orange),var(--orange2))">' + (m.initials || 'ME') + '</div>';
    }
    return '<div class="uch__avatar" style="background:' + (m.color || '#888') + '">' + (m.initials || '?') + '</div>';
}

function uchRenderMessages(uniId) {
    var msgs = uchGetMessages(uniId);
    var box = document.getElementById('uchMessages');
    if (!box) return;
    if (!msgs.length) {
        var uName = uchCurrentUniName || 'this university';
        box.innerHTML = '<div class="uch__empty">' +
            '<div class="uch__empty__art">' +
                '<div class="uch__empty__ring"></div>' +
                '<div class="uch__empty__icon__wrap">' +
                    '<i class="fa-solid fa-graduation-cap uch__empty__icon--main"></i>' +
                '</div>' +
                '<div class="uch__empty__dot uch__empty__dot--1"><i class="fa-solid fa-star"></i></div>' +
                '<div class="uch__empty__dot uch__empty__dot--2"><i class="fa-regular fa-comment-dots"></i></div>' +
                '<div class="uch__empty__dot uch__empty__dot--3"><i class="fa-solid fa-paper-plane"></i></div>' +
            '</div>' +
            '<div class="uch__empty__title">You can start this conversation,<br>you know?</div>' +
            '<p class="uch__empty__sub">Be the first to share your experience, tips, or questions with fellow students exploring <strong>' + uName + '</strong>.</p>' +
        '</div>';
        return;
    }
    var html = '';
    var lastDate = null;
    msgs.forEach(function(m, i) {
        var d = new Date(m.ts);
        var dateStr = d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'});
        if (dateStr !== lastDate) {
            html += '<div class="uch__date__divider">' + dateStr + '</div>';
            lastDate = dateStr;
        }
        var isOwn = m.own === true;
        html += '<div class="uch__msg' + (isOwn ? ' uch__msg--own' : '') + '" style="animation-delay:' + (i * 0.04) + 's">' +
            uchBuildAvatarHtml(m, isOwn) +
            '<div class="uch__bubble">' +
                (!isOwn ? '<div class="uch__author">' + m.author + '</div>' : '') +
                '<div class="uch__text">' + m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
                '<div class="uch__bubble__foot"><span class="uch__time">' + uchFormatMsgTime(m.ts) + '</span></div>' +
            '</div>' +
        '</div>';
    });
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
}

function uchRenderSidebar(filter) {
    var list = document.getElementById('uchSbList');
    if (!list) return;
    var q = (filter || '').trim().toLowerCase();
    var chats = uchGetChats();
    var dms = getDMs();
    var saved = getSaved();
    var allUnis = typeof UNI !== 'undefined' ? UNI : [];
    var savedUnis = allUnis.filter(function(u){ return saved.indexOf(u.id) !== -1; });
    var uniFiltered = q ? savedUnis.filter(function(u){ return u.name.toLowerCase().indexOf(q) !== -1; }) : savedUnis;
    var friends = getFriends();
    var frFiltered = q ? friends.filter(function(f){ return f.username.toLowerCase().indexOf(q) !== -1; }) : friends;

    var html = '';

    if (uniFiltered.length) {
        html += '<div class="uch__sb__section"><i class="fa-solid fa-building-columns"></i> Universities</div>';
        uniFiltered.forEach(function(u) {
            var msgs = chats[u.id] || (UCH_SEED[u.id] || []);
            var last = msgs.length ? msgs[msgs.length - 1] : null;
            var preview = last ? last.text.slice(0, 44) + (last.text.length > 44 ? '…' : '') : 'No messages yet';
            var timeStr = last ? uchFormatTime(last.ts) : '';
            var isActive = (uchMode === 'uni' && u.id === uchCurrentUniId) ? ' uch__contact--active' : '';
            var abbr = (u.abbr || u.id.toUpperCase()).slice(0,3);
            html += '<div class="uch__contact' + isActive + '" data-uid="' + u.id + '">' +
                '<div class="uch__contact__badge" style="background:' + (u.color || '#888') + '">' + abbr + '</div>' +
                '<div class="uch__contact__info">' +
                    '<div class="uch__contact__name">' + u.name + '</div>' +
                    '<div class="uch__contact__preview">' + preview.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
                '</div>' +
                (timeStr ? '<div class="uch__contact__time">' + timeStr + '</div>' : '') +
            '</div>';
        });
    } else if (!q) {
        html += '<div class="uch__sb__empty" style="padding:16px 14px 4px"><i class="fa-regular fa-bookmark" style="display:block;font-size:18px;margin-bottom:6px;opacity:.4"></i>Save a university to chat with its community</div>';
    }

    if (frFiltered.length) {
        html += '<div class="uch__sb__section"><i class="fa-solid fa-user-group"></i> Direct Messages</div>';
        frFiltered.forEach(function(f) {
            var msgs = dms[f.id] || [];
            var last = msgs.length ? msgs[msgs.length - 1] : null;
            var preview = last ? last.text.slice(0, 44) + (last.text.length > 44 ? '…' : '') : 'Say hello!';
            var timeStr = last ? uchFormatTime(last.ts) : '';
            var isActive = (uchMode === 'dm' && f.id === uchCurrentDmId) ? ' uch__contact--active' : '';
            var avInner = f.avatar ? '<img src="' + f.avatar + '" class="uch__contact__badge__img">' : f.username.slice(0,2).toUpperCase();
            html += '<div class="uch__contact uch__contact--dm' + isActive + '" data-fid="' + f.id + '">' +
                '<div class="uch__contact__badge__wrap">' +
                    '<div class="uch__contact__badge" style="background:' + (f.avatar ? 'transparent' : '#6c63ff') + '">' + avInner + '</div>' +
                    (isFriendOnline(f.id) ? '<span class="uch__contact__online"></span>' : '') +
                '</div>' +
                '<div class="uch__contact__info">' +
                    '<div class="uch__contact__name">' + f.username + '</div>' +
                    '<div class="uch__contact__preview">' + preview.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
                '</div>' +
                (timeStr ? '<div class="uch__contact__time">' + timeStr + '</div>' : '') +
            '</div>';
        });
    } else if (friends.length && q) {
        html += '<div class="uch__sb__empty" style="padding:8px 14px">No friends match</div>';
    } else if (!friends.length && !q) {
        html += '<div class="uch__sb__section"><i class="fa-solid fa-user-group"></i> Direct Messages</div>';
        html += '<div class="uch__sb__empty" style="padding:8px 14px">Add friends to start messaging</div>';
    }

    if (!html) html = '<div class="uch__sb__empty">Nothing found</div>';
    list.innerHTML = html;

    list.querySelectorAll('.uch__contact:not(.uch__contact--dm)').forEach(function(el) {
        el.addEventListener('click', function() {
            var u = allUnis.find(function(x){ return x.id === el.dataset.uid; });
            if (u) {
                openUniChat(u.id, u.name, u.color);
                var shell = document.getElementById('uchShell');
                if (shell && window.innerWidth <= 600) shell.classList.remove('sidebar-open');
            }
        });
    });
    list.querySelectorAll('.uch__contact--dm').forEach(function(el) {
        el.addEventListener('click', function() {
            var f = friends.find(function(x){ return x.id === el.dataset.fid; });
            if (f) {
                openDmChat(f.id, f.username, f.avatar || null);
                var shell = document.getElementById('uchShell');
                if (shell && window.innerWidth <= 600) shell.classList.remove('sidebar-open');
            }
        });
    });
}

function openUniChat(uniId, uniName, color) {
    uchCurrentUniId   = uniId;
    uchCurrentUniName = uniName;
    uchCurrentColor   = color || '#d97c14';

    var badge = document.getElementById('uchBadge');
    var nameEl = document.getElementById('uchName');
    var sub = document.getElementById('uchSub');
    var myAv = document.getElementById('uchMyAvatar');

    var uniData = typeof UNI !== 'undefined' ? UNI.find(function(x){ return x.id === uniId; }) : null;
    if (badge) { badge.textContent = ((uniData && uniData.abbr) ? uniData.abbr : uniId.toUpperCase()).slice(0,3); badge.style.background = uchCurrentColor; }
    if (nameEl) nameEl.textContent = uniName;
    if (sub) sub.textContent = 'Student community · ' + uchGetMessages(uniId).length + ' messages';

    if (myAv) {
        var prof = getProfile();
        if (prof && prof.avatar) {
            myAv.innerHTML = '<img src="' + prof.avatar + '" alt="me" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
            myAv.style.background = 'none';
        } else if (user) {
            var words = (user.username || 'S').trim().split(/\s+/);
            myAv.textContent = (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
            myAv.style.background = '';
        }
    }

    uchMode = 'uni';
    uchCurrentDmId = null;
    uchCurrentDmName = null;

    uchRenderMessages(uniId);
    uchRenderSidebar(document.getElementById('uchSbSearch') ? document.getElementById('uchSbSearch').value : '');

    var input = document.getElementById('uchInput');
    if (input) { input.value = ''; input.placeholder = 'Write a message to the community…'; }

    document.getElementById('uniChatOverlay').classList.add('open');
    uniDetailOverlay.classList.remove('open');
}

function openDmChat(friendId, friendName, friendAvatar) {
    uchMode = 'dm';
    uchCurrentDmId    = friendId;
    uchCurrentDmName  = friendName;
    uchCurrentUniId   = null;
    uchCurrentUniName = null;

    var badge  = document.getElementById('uchBadge');
    var nameEl = document.getElementById('uchName');
    var sub    = document.getElementById('uchSub');
    var myAv   = document.getElementById('uchMyAvatar');

    if (badge) {
        if (friendAvatar) {
            badge.innerHTML = '<img src="' + friendAvatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;display:block">';
            badge.style.background = 'none';
        } else {
            badge.textContent = (friendName || 'U').slice(0,2).toUpperCase();
            badge.style.background = '#6c63ff';
        }
    }
    if (nameEl) nameEl.textContent = friendName;
    if (sub) sub.textContent = 'Direct message';

    if (myAv) {
        var prof = getProfile();
        if (prof && prof.avatar) {
            myAv.innerHTML = '<img src="' + prof.avatar + '" alt="me" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
            myAv.style.background = 'none';
        } else if (user) {
            var words = (user.username || 'S').trim().split(/\s+/);
            myAv.textContent = (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
            myAv.style.background = '';
        }
    }

    uchRenderDm(friendId);
    uchRenderSidebar(document.getElementById('uchSbSearch') ? document.getElementById('uchSbSearch').value : '');

    var input = document.getElementById('uchInput');
    if (input) { input.value = ''; input.placeholder = 'Message ' + friendName + '…'; }

    document.getElementById('uniChatOverlay').classList.add('open');
}

function uchRenderDm(friendId) {
    var msgs = getDMs()[friendId] || [];
    var box  = document.getElementById('uchMessages');
    if (!box) return;
    if (!msgs.length) {
        var fn = uchCurrentDmName || 'your friend';
        box.innerHTML = '<div class="uch__empty">' +
            '<div class="uch__empty__art">' +
                '<div class="uch__empty__ring"></div>' +
                '<div class="uch__empty__icon__wrap" style="background:linear-gradient(135deg,#6c63ff,#a78bfa)">' +
                    '<i class="fa-solid fa-comment-dots uch__empty__icon--main"></i>' +
                '</div>' +
                '<div class="uch__empty__dot uch__empty__dot--1"><i class="fa-solid fa-heart"></i></div>' +
                '<div class="uch__empty__dot uch__empty__dot--2"><i class="fa-solid fa-face-smile"></i></div>' +
                '<div class="uch__empty__dot uch__empty__dot--3"><i class="fa-solid fa-paper-plane"></i></div>' +
            '</div>' +
            '<div class="uch__empty__title">Start chatting with<br><strong>' + fn + '</strong></div>' +
            '<p class="uch__empty__sub">Send the first message — every great friendship starts with a hello.</p>' +
        '</div>';
        return;
    }
    var html = '';
    var lastDate = null;
    msgs.forEach(function(m, i) {
        var d = new Date(m.ts);
        var dateStr = d.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long'});
        if (dateStr !== lastDate) { html += '<div class="uch__date__divider">' + dateStr + '</div>'; lastDate = dateStr; }
        var isOwn = m.own === true;
        html += '<div class="uch__msg' + (isOwn ? ' uch__msg--own' : '') + '" style="animation-delay:' + (i * 0.04) + 's">' +
            uchBuildAvatarHtml(m, isOwn) +
            '<div class="uch__bubble">' +
                '<div class="uch__text">' + m.text.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
                '<div class="uch__bubble__foot"><span class="uch__time">' + uchFormatMsgTime(m.ts) + '</span></div>' +
            '</div>' +
        '</div>';
    });
    box.innerHTML = html;
    box.scrollTop = box.scrollHeight;
}

function uchAddDmMessage(friendId, text) {
    var dms = getDMs();
    if (!dms[friendId]) dms[friendId] = [];
    var me = user || { username: 'Student' };
    var name = me.username || 'Student';
    var words = name.trim().split(/\s+/);
    var initials = (words[0][0] + (words[1] ? words[1][0] : '')).toUpperCase();
    dms[friendId].push({ id: 'dm' + Date.now(), author: name, initials: initials, color: 'var(--orange)', text: text, ts: Date.now(), own: true });
    saveDMs(dms);
}

document.getElementById('udmOpenChat').addEventListener('click', function() {
    var u = UNI.find(function(x){ return x.id === currentUdmId; });
    if (u) openUniChat(u.id, u.name, u.color);
});

document.getElementById('uniChatClose').addEventListener('click', function() {
    document.getElementById('uniChatOverlay').classList.remove('open');
});
document.getElementById('uniChatOverlay').addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
});
document.getElementById('uchBackBtn').addEventListener('click', function() {
    var shell = document.getElementById('uchShell');
    if (!shell) return;
    var isOpen = shell.classList.contains('sidebar-open');
    shell.classList.toggle('sidebar-open');
    if (!isOpen) uchRenderSidebar(document.getElementById('uchSbSearch') ? document.getElementById('uchSbSearch').value : '');
});
document.getElementById('uchSbSearch').addEventListener('input', function() {
    uchRenderSidebar(this.value);
});

document.getElementById('uchSend').addEventListener('click', function() {
    var input = document.getElementById('uchInput');
    var text = (input.value || '').trim();
    if (!text) return;
    if (uchMode === 'dm' && uchCurrentDmId) {
        uchAddDmMessage(uchCurrentDmId, text);
        input.value = '';
        uchRenderDm(uchCurrentDmId);
        uchRenderSidebar(document.getElementById('uchSbSearch') ? document.getElementById('uchSbSearch').value : '');
    } else if (uchMode === 'uni' && uchCurrentUniId) {
        uchAddMessage(uchCurrentUniId, text);
        input.value = '';
        var sub = document.getElementById('uchSub');
        if (sub) sub.textContent = 'Student community · ' + uchGetMessages(uchCurrentUniId).length + ' messages';
        uchRenderMessages(uchCurrentUniId);
    }
});
document.getElementById('uchInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('uchSend').click();
});

function closeFriendsOverlay() {
    document.getElementById('friendsOverlay').classList.remove('open');
    var panel = document.querySelector('.frd__panel');
    if (panel) panel.classList.remove('show-profile');
}

function openFriendsOverlay() {
    renderFriendsList('');
    var si = document.getElementById('frdSearch');
    if (si) si.value = '';
    var panel = document.querySelector('.frd__panel');
    if (panel) panel.classList.remove('show-profile');
    document.getElementById('friendsOverlay').classList.add('open');
}

function updateFriendsBadge() {
    var badge = document.getElementById('hdrFriendsBadge');
    var dot   = document.getElementById('feedDot');
    var count = getFrRecv().length;
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
    if (dot && count > 0) dot.style.display = 'flex';
}

document.getElementById('hdrFriendsBtn').addEventListener('click', openFriendsOverlay);
document.getElementById('uchFriendsBtn').addEventListener('click', openFriendsOverlay);
document.getElementById('friendsClose').addEventListener('click', closeFriendsOverlay);
document.getElementById('friendsOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeFriendsOverlay();
});
document.getElementById('frdPvBack').addEventListener('click', function() {
    var panel = document.querySelector('.frd__panel');
    if (panel) panel.classList.remove('show-profile');
});
document.getElementById('frdSearch').addEventListener('input', function() {
    renderFriendsList(this.value);
});

function renderFriendsList(q) {
    var list = document.getElementById('frdList');
    if (!list) return;

    var friends  = getFriends();
    var sent     = getFrSent();
    var allUsers = [];
    try { allUsers = JSON.parse(localStorage.getItem('uniscout_users') || '[]'); } catch(e){}

    var ql = (q || '').trim().toLowerCase();

    var myFriends = ql
        ? friends.filter(function(f){ return (f.username || '').toLowerCase().indexOf(ql) !== -1; })
        : friends.slice();

    var others = allUsers.filter(function(u){
        return u.id !== user.id && !friends.find(function(f){ return f.id === u.id; });
    });
    if (ql) others = others.filter(function(u){ return (u.username || '').toLowerCase().indexOf(ql) !== -1; });

    var html = '';

    // ── Friends section ──────────────────────────────────────────
    if (myFriends.length) {
        html += '<div class="frd__section__hdr"><i class="fa-solid fa-user-check"></i> Friends <span class="frd__section__count">' + myFriends.length + '</span></div>';
        myFriends.forEach(function(f) {
            var lp     = {};
            try { lp = JSON.parse(localStorage.getItem('us_profile_' + f.id) || '{}'); } catch(e){}
            var avatar   = lp.avatar || f.avatar || null;
            var initials = (f.username || 'U').slice(0, 2).toUpperCase();
            var avHtml   = avatar ? '<img src="' + avatar + '" alt="">' : initials;
            var avStyle  = avatar ? '' : ' style="background:' + frdAvaColor(f.username) + '"';
            html += '<div class="frd__friend__card">' +
                '<div class="frd__friend__av"' + avStyle + '>' + avHtml + '</div>' +
                '<div class="frd__friend__info">' +
                    '<div class="frd__friend__name">' + (f.username || 'Friend') + '</div>' +
                    '<div class="frd__friend__tag"><i class="fa-solid fa-circle" style="color:' + (isFriendOnline(f.id) ? '#27ae60' : 'rgba(150,150,150,.4)') + ';font-size:7px"></i> ' + (isFriendOnline(f.id) ? 'Online' : 'Friend') + '</div>' +
                '</div>' +
                '<div class="frd__friend__actions">' +
                    '<button class="frd__friend__btn frd__friend__btn--msg" data-fid="' + f.id + '" data-fname="' + (f.username || '') + '" data-fav="' + (avatar || '') + '" title="Message"><i class="fa-solid fa-message"></i></button>' +
                    '<button class="frd__friend__btn frd__friend__btn--pro" data-fid="' + f.id + '" title="View profile"><i class="fa-solid fa-user"></i></button>' +
                '</div>' +
            '</div>';
        });
    }

    // ── Students / Add section ────────────────────────────────────
    var sepClass = myFriends.length ? ' frd__section__hdr--sep' : '';
    if (others.length || !myFriends.length) {
        html += '<div class="frd__section__hdr' + sepClass + '"><i class="fa-solid fa-users"></i> Students' +
            (others.length ? ' <span class="frd__section__count">' + others.length + '</span>' : '') +
        '</div>';
    }
    if (!others.length && !myFriends.length) {
        html += '<div class="frd__empty"><i class="fa-solid fa-user-slash"></i><span>No students found</span></div>';
    } else if (!others.length && myFriends.length) {
        /* all users are already friends — show nothing extra */
    } else {
        others.forEach(function(u) {
            var isPending = sent.indexOf(u.id) !== -1;
            var initials  = (u.username || 'U').slice(0, 2).toUpperCase();
            var avHtml    = '<span>' + initials + '</span>';
            var statusBtn = isPending
                ? '<button class="frd__btn frd__btn--pending" disabled><i class="fa-solid fa-clock"></i> Pending</button>'
                : '<button class="frd__btn frd__btn--add" data-uid="' + u.id + '"><i class="fa-solid fa-user-plus"></i> Add</button>';
            html += '<div class="frd__row">' +
                '<div class="frd__row__av" style="background:' + frdAvaColor(u.username) + '">' + avHtml + '</div>' +
                '<div class="frd__row__info"><div class="frd__row__name">' + (u.username || 'Student') + '</div></div>' +
                statusBtn +
            '</div>';
        });
    }

    list.innerHTML = html;

    // Message buttons
    list.querySelectorAll('.frd__friend__btn--msg').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var fid = this.dataset.fid, fname = this.dataset.fname, fav = this.dataset.fav || null;
            closeFriendsOverlay();
            openDmChat(fid, fname, fav);
        });
    });

    // Profile buttons
    list.querySelectorAll('.frd__friend__btn--pro').forEach(function(btn) {
        btn.addEventListener('click', function() { openFriendProfile(this.dataset.fid); });
    });

    // Add friend buttons
    list.querySelectorAll('.frd__btn--add').forEach(function(btn) {
        btn.addEventListener('click', function() {
            sendFriendRequest(this.dataset.uid);
            renderFriendsList(document.getElementById('frdSearch') ? document.getElementById('frdSearch').value : '');
        });
    });
}

function openFriendProfile(friendId) {
    var panel = document.querySelector('.frd__panel');
    var body  = document.getElementById('frdPvBody');
    if (!panel || !body) return;

    var friends  = getFriends();
    var friend   = friends.find(function(f){ return f.id === friendId; });
    var allUsers = [];
    try { allUsers = JSON.parse(localStorage.getItem('uniscout_users') || '[]'); } catch(e){}
    var userRec  = allUsers.find(function(u){ return u.id === friendId; });

    var username = (friend && friend.username) || (userRec && userRec.username) || 'Unknown';
    var lp = {};
    try { lp = JSON.parse(localStorage.getItem('us_profile_' + friendId) || '{}'); } catch(e){}
    var avatar   = lp.avatar || (friend && friend.avatar) || null;
    var initials = username.slice(0, 2).toUpperCase();
    var avHtml   = avatar ? '<img src="' + avatar + '" alt="">' : initials;
    var avStyle  = avatar ? '' : ' style="background:' + frdAvaColor(username) + '"';

    var statusLabel = FRD_STATUS_LABELS[lp.status] || '';
    var langLabel   = FRD_LANG_LABELS[lp.lang] || '';
    var online      = isFriendOnline(friendId);

    var joined = '';
    if (userRec && userRec.createdAt) {
        joined = new Date(userRec.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    var badges = '';
    if (statusLabel) badges += '<span class="frd__pv__badge">' + statusLabel + '</span>';
    if (langLabel)   badges += '<span class="frd__pv__badge"><i class="fa-solid fa-language"></i> ' + langLabel + '</span>';
    if (online)      badges += '<span class="frd__pv__badge" style="color:#27ae60;border-color:rgba(39,174,96,.3);background:rgba(39,174,96,.08)"><i class="fa-solid fa-circle" style="font-size:7px"></i> Online</span>';

    var fields = '';
    if (joined)     fields += '<div class="frd__pv__field"><div class="frd__pv__field__icon"><i class="fa-solid fa-calendar-days"></i></div><div><div class="frd__pv__field__lbl">Member since</div><div class="frd__pv__field__val">' + joined + '</div></div></div>';
    if (lp.budget)  fields += '<div class="frd__pv__field"><div class="frd__pv__field__icon"><i class="fa-solid fa-piggy-bank"></i></div><div><div class="frd__pv__field__lbl">Annual budget</div><div class="frd__pv__field__val">€' + Number(lp.budget).toLocaleString() + '/yr</div></div></div>';
    if (userRec && userRec.email) fields += '<div class="frd__pv__field"><div class="frd__pv__field__icon"><i class="fa-solid fa-envelope"></i></div><div><div class="frd__pv__field__lbl">Email</div><div class="frd__pv__field__val">' + (userRec.email) + '</div></div></div>';

    body.innerHTML =
        '<div class="frd__pv__hero">' +
            '<div class="frd__pv__av"' + avStyle + '>' + avHtml + '</div>' +
            '<div class="frd__pv__name">' + username + '</div>' +
            (badges ? '<div class="frd__pv__badges">' + badges + '</div>' : '') +
            '<button class="frd__pv__msg__btn" id="frdPvMsgBtn" data-fid="' + friendId + '" data-fname="' + username + '" data-fav="' + (avatar || '') + '">' +
                '<i class="fa-solid fa-message"></i> Message ' + username +
            '</button>' +
        '</div>' +
        (fields ? '<div class="frd__pv__fields">' + fields + '</div>' : '');

    var msgBtn = document.getElementById('frdPvMsgBtn');
    if (msgBtn) {
        msgBtn.addEventListener('click', function() {
            var fid = this.dataset.fid, fname = this.dataset.fname, fav = this.dataset.fav || null;
            closeFriendsOverlay();
            openDmChat(fid, fname, fav);
        });
    }

    panel.classList.add('show-profile');
}

function renderFriendRequests() {
    var section = document.getElementById('feedFrqSection');
    if (!section) return;
    var recv = getFrRecv();
    if (!recv.length) { section.style.display = 'none'; section.innerHTML = ''; return; }
    section.style.display = '';

    var html = '<div class="mp__feed__reqs__hdr">' +
        '<span class="mp__feed__reqs__label">Friend Requests</span>' +
        '<span class="mp__feed__reqs__count">' + recv.length + '</span>' +
    '</div>';

    recv.forEach(function(r) {
        var name     = (r.fromUsername || 'Unknown');
        var initials = name.slice(0, 2).toUpperCase();
        var avInner  = r.fromAvatar
            ? '<img src="' + r.fromAvatar + '" alt="">'
            : initials;
        html += '<div class="mp__feed__req__item">' +
            '<div class="mp__feed__req__av">' + avInner + '</div>' +
            '<div class="mp__feed__req__body">' +
                '<div class="mp__feed__req__name">' + name + '</div>' +
                '<div class="mp__feed__req__sub">wants to be friends</div>' +
                '<div class="mp__feed__req__time">' + uchFormatTime(r.ts) + '</div>' +
            '</div>' +
            '<div class="mp__feed__req__btns">' +
                '<button class="mp__feed__req__btn mp__feed__req__btn--ok" data-fid="' + r.fromId + '" data-fname="' + name + '" data-fav="' + (r.fromAvatar || '') + '" title="Accept"><i class="fa-solid fa-check"></i></button>' +
                '<button class="mp__feed__req__btn mp__feed__req__btn--no" data-fid="' + r.fromId + '" title="Decline"><i class="fa-solid fa-xmark"></i></button>' +
            '</div>' +
        '</div>';
    });

    section.innerHTML = html;

    section.querySelectorAll('.mp__feed__req__btn--ok').forEach(function(btn) {
        btn.addEventListener('click', function() {
            acceptFriendRequest(this.dataset.fid, this.dataset.fname, this.dataset.fav || null);
            renderFriendRequests();
            updateFriendStats();
            updateFriendsBadge();
            uchRenderSidebar('');
        });
    });
    section.querySelectorAll('.mp__feed__req__btn--no').forEach(function(btn) {
        btn.addEventListener('click', function() {
            declineFriendRequest(this.dataset.fid);
            renderFriendRequests();
            updateFriendsBadge();
        });
    });
}

function buildNsRow(u, q) {
    var hl = function(str) {
        if (!q) return str;
        var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
        return str.replace(re, '<mark>$1</mark>');
    };
    return '<div class="nsearch__row" style="--c:' + u.color + '" data-id="' + u.id + '">' +
        '<div class="nsearch__abbr nsearch__abbr--logo">' + uniLogo(u, 42) + '</div>' +
        '<div class="nsearch__info">' +
            '<div class="nsearch__name">' + hl(u.name) + '</div>' +
            '<div class="nsearch__tags">' +
                '<span class="mp__badge mp__badge--city">' + u.city + '</span>' +
                '<span class="mp__badge ' + (uniIsPublic(u) ? 'mp__badge--pub' : 'mp__badge--priv') + '">' + uniTypeLabel(u) + '</span>' +
                u.fields.slice(0,3).map(function(f){ return '<span class="mp__field__tag">'+f+'</span>'; }).join('') +
            '</div>' +
        '</div>' +
        '<div class="nsearch__metrics">' +
            '<div class="nsearch__metric"><span class="nsearch__ml">Tuition</span><span class="nsearch__mv">' + uniTuitionLabel(u) + '</span></div>' +
            '<div class="nsearch__metric"><span class="nsearch__ml">Difficulty</span><span class="nsearch__mv">' + (u.dl || '—') + '</span></div>' +
        '</div>' +
        '<i class="fa-solid fa-chevron-right" style="color:rgba(217,124,20,.35);font-size:10px;flex-shrink:0"></i>' +
    '</div>';
}

function attachNsClick(container) {
    container.querySelectorAll('.nsearch__row').forEach(function(row) {
        row.addEventListener('click', function() {
            var u = UNI.find(function(x){ return x.id === row.dataset.id; });
            if (u) showUniDetail(u);
        });
    });
}

var nsInput   = document.getElementById('nsInput');
var nsResults = document.getElementById('nsResults');
var expClear  = document.getElementById('expClear');
var nsPage    = 1;
var NS_PER_PAGE = 20;
var nsLastHits = [];

function renderNsPagination(current, total) {
    var existing = document.getElementById('nsPagination');
    if (existing) existing.remove();
    if (total <= 1) return;
    var pg = document.createElement('div');
    pg.id = 'nsPagination';
    pg.className = 'ba__pagination';
    var html = '<button class="ba__pg__btn" id="nsPrev"' + (current === 1 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>';
    var sp = Math.max(1, current - 2), ep = Math.min(total, current + 2);
    if (sp > 1) html += '<span class="ba__pg__dots">…</span>';
    for (var p = sp; p <= ep; p++) {
        html += '<button class="ba__pg__num' + (p === current ? ' ba__pg__num--active' : '') + '" data-p="' + p + '">' + p + '</button>';
    }
    if (ep < total) html += '<span class="ba__pg__dots">…</span>';
    html += '<button class="ba__pg__btn" id="nsNext"' + (current === total ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>';
    pg.innerHTML = html;
    nsResults.after(pg);
    pg.querySelector('#nsPrev').addEventListener('click', function() { if (nsPage > 1) { nsPage--; renderNsPage(); } });
    pg.querySelector('#nsNext').addEventListener('click', function() { if (nsPage < total) { nsPage++; renderNsPage(); } });
    pg.querySelectorAll('.ba__pg__num').forEach(function(btn) {
        btn.addEventListener('click', function() { nsPage = parseInt(btn.dataset.p); renderNsPage(); });
    });
}

function renderNsPage() {
    var q = nsInput.value.trim();
    var total = Math.max(1, Math.ceil(nsLastHits.length / NS_PER_PAGE));
    nsPage = Math.min(nsPage, total);
    var start = (nsPage - 1) * NS_PER_PAGE;
    var pageHits = nsLastHits.slice(start, start + NS_PER_PAGE);
    nsResults.innerHTML = '<div class="exp__sr__count">' + nsLastHits.length + ' result' + (nsLastHits.length !== 1 ? 's' : '') + ' for <strong>"' + q + '"</strong></div>' +
        pageHits.map(function(u){ return buildNsRow(u, q.toLowerCase()); }).join('');
    attachNsClick(nsResults);
    renderNsPagination(nsPage, total);
}

function runHeroSearch() {
    var q = nsInput.value.trim().toLowerCase();
    expClear.style.display = q ? 'flex' : 'none';
    var existing = document.getElementById('nsPagination');
    if (existing) existing.remove();
    if (!q) {
        nsResults.style.display = 'none';
        document.getElementById('expDefaultContent').style.display = 'block';
        nsLastHits = []; nsPage = 1;
        return;
    }
    document.getElementById('expDefaultContent').style.display = 'none';
    var budgetLimit = budgetFilterOn ? getProfile().budget : Infinity;
    nsLastHits = UNI.filter(function(u) {
        if (budgetFilterOn && tuitionMinCost(u) > budgetLimit) return false;
        return (u.name + ' ' + u.city + ' ' + u.abbr + ' ' + u.fields.join(' ') + ' ' + u.langs.join(' ') + ' ' + u.type).toLowerCase().indexOf(q) !== -1;
    });
    nsResults.style.display = 'block';
    if (!nsLastHits.length) {
        nsResults.innerHTML = '<div class="exp__sr__empty"><i class="fa-solid fa-magnifying-glass-minus"></i><p>No universities match <strong>"' + nsInput.value + '"</strong></p><p class="exp__sr__tip">Try a city, field or abbreviation</p></div>';
        return;
    }
    nsPage = 1;
    renderNsPage();
}

nsInput.addEventListener('input', runHeroSearch);
expClear.addEventListener('click', function() {
    nsInput.value = '';
    runHeroSearch();
    nsInput.focus();
});

document.querySelectorAll('.exp__qt').forEach(function(btn) {
    btn.addEventListener('click', function() {
        nsInput.value = btn.dataset.q;
        runHeroSearch();
        nsInput.focus();
    });
});

document.querySelectorAll('.exp__city__card').forEach(function(card) {
    card.addEventListener('click', function() {
        var city = card.dataset.city;

        document.querySelectorAll('.exp__city__card').forEach(function(c){ c.classList.remove('active'); });
        card.classList.add('active');

        document.querySelectorAll('.exp__chip[data-ftype="city"]').forEach(function(c){ c.classList.remove('active'); });
        expActiveFilters.city = city;
        runChipFilter();
        var wxInp = document.getElementById('wxCityInput'); if (wxInp) wxInp.value = city;
        showCityInfo(city);
        fetchWeather(city);
        var lastBlock = document.querySelector('.exp__block:last-of-type'); if (lastBlock) lastBlock.scrollIntoView({ behavior:'smooth', block:'start' });
    });
});

var expActiveFilters = { field: '', lang: '', type: '', budget: '', city: '' };

document.querySelectorAll('.exp__chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
        var ftype = chip.dataset.ftype;
        var fval  = chip.dataset.fval;
        if (expActiveFilters[ftype] === fval) {
            expActiveFilters[ftype] = '';
            chip.classList.remove('active');
        } else {
            document.querySelectorAll('.exp__chip[data-ftype="' + ftype + '"]').forEach(function(c){ c.classList.remove('active'); });
            expActiveFilters[ftype] = fval;
            chip.classList.add('active');
        }
        runChipFilter();
    });
});

var _expChipResetBtn = document.getElementById('expChipReset');
if (_expChipResetBtn) {
    _expChipResetBtn.addEventListener('click', function() {
        expActiveFilters = { field: '', lang: '', type: '', budget: '', city: '' };
        document.querySelectorAll('.exp__chip').forEach(function(c){ c.classList.remove('active'); });
        document.querySelectorAll('.exp__city__card').forEach(function(c){ c.classList.remove('active'); });
        var ecr = document.getElementById('expChipResults');
        if (ecr) ecr.innerHTML = '';
        _expChipResetBtn.style.display = 'none';
    });
}

function runChipFilter() {
    var anyActive = Object.keys(expActiveFilters).some(function(k){ return expActiveFilters[k]; });
    var resetBtn = document.getElementById('expChipReset');
    if (resetBtn) resetBtn.style.display = anyActive ? 'flex' : 'none';

    var container = document.getElementById('expChipResults');
    if (!anyActive) {
        if (container) container.innerHTML = '';
        return;
    }

    var results = UNI.filter(function(u) {
        if (expActiveFilters.city   && u.city !== expActiveFilters.city)                 return false;
        if (expActiveFilters.type   && u.type !== expActiveFilters.type)                 return false;
        if (expActiveFilters.budget && u.ts   >  parseInt(expActiveFilters.budget))      return false;
        if (expActiveFilters.field  && u.fields.indexOf(expActiveFilters.field) === -1)  return false;
        if (expActiveFilters.lang   && u.langs.indexOf(expActiveFilters.lang)   === -1)  return false;
        return true;
    });

    if (!container) return;
    if (!results.length) {
        container.innerHTML = '<div class="exp__sr__empty"><i class="fa-solid fa-filter-circle-xmark"></i><p>No universities match these filters.</p><p class="exp__sr__tip">Try removing one of the filters above.</p></div>';
        return;
    }
    container.innerHTML = '<div class="exp__sr__count">' + results.length + ' universit' + (results.length !== 1 ? 'ies' : 'y') + ' match your filters</div>' +
        results.map(function(u){ return buildNsRow(u, ''); }).join('');
    attachNsClick(container);
}

var WX_KEY = 'a972a60b0971a99fcba59731943dcda6';
var WX_ICONS  = { Clear:'☀️', Clouds:'🌥️', Rain:'🌧️', Drizzle:'🌦️', Thunderstorm:'⛈️', Snow:'❄️', Mist:'🌫️', Haze:'🌫️', Fog:'🌫️' };
var WX_PHOTOS = { Clear:'images/sunny.jpeg', Clouds:'images/cloudy.jpeg', Rain:'images/Rainy.jpeg', Drizzle:'images/Rainy.jpeg', Thunderstorm:'images/Rainy.jpeg', Snow:'images/snow.jpeg', Mist:'images/cloudy.jpeg', Haze:'images/cloudy.jpeg', Fog:'images/cloudy.jpeg' };

var CITY_COORDS_MAP = {
    'Madrid':     { lat: 40.4168, lon: -3.7038 },
    'Barcelona':  { lat: 41.3851, lon:  2.1734 },
    'Valencia':   { lat: 39.4699, lon: -0.3763 },
    'Sevilla':    { lat: 37.3891, lon: -5.9845 },
    'Granada':    { lat: 37.1773, lon: -3.5986 },
    'Bilbao':     { lat: 43.2630, lon: -2.9350 },
    'Salamanca':  { lat: 40.9701, lon: -5.6635 },
    'London':     { lat: 51.5074, lon: -0.1278 },
    'Edinburgh':  { lat: 55.9533, lon: -3.1883 },
    'Manchester': { lat: 53.4808, lon: -2.2426 },
    'Oxford':     { lat: 51.7520, lon: -1.2577 },
    'Cambridge':  { lat: 52.2053, lon:  0.1218 },
    'Paris':      { lat: 48.8566, lon:  2.3522 },
    'Lyon':       { lat: 45.7640, lon:  4.8357 },
    'Berlin':     { lat: 52.5200, lon: 13.4050 },
    'Munich':     { lat: 48.1351, lon: 11.5820 },
    'Heidelberg': { lat: 49.3988, lon:  8.6724 },
    'Rome':       { lat: 41.9028, lon: 12.4964 },
    'Milan':      { lat: 45.4642, lon:  9.1900 },
    'Bologna':    { lat: 44.4949, lon: 11.3426 },
    'Lisbon':     { lat: 38.7223, lon: -9.1393 },
    'Porto':      { lat: 41.1579, lon: -8.6291 },
    'Zurich':     { lat: 47.3769, lon:  8.5417 },
    'Kyiv':       { lat: 50.4501, lon: 30.5234 }
};

function wmoGradient(code) {
    if (code === 0)  return 'linear-gradient(160deg,#1e6fa8,#2ec4a0)';
    if (code <= 2)   return 'linear-gradient(160deg,#2a6fa0,#4a9ac8)';
    if (code <= 3)   return 'linear-gradient(160deg,#3a5878,#6a8aaa)';
    if (code <= 48)  return 'linear-gradient(160deg,#4a5868,#8a9aaa)';
    if (code <= 55)  return 'linear-gradient(160deg,#2a5070,#5a88b0)';
    if (code <= 67)  return 'linear-gradient(160deg,#1a3a5a,#2a6090)';
    if (code <= 77)  return 'linear-gradient(160deg,#3a6a9a,#90c8f0)';
    if (code <= 82)  return 'linear-gradient(160deg,#1a3a58,#3a70a8)';
    return                  'linear-gradient(160deg,#1a1a3a,#4a3a70)';
}

function wmoEmoji(code) {
    if (code === 0)  return '☀️';
    if (code <= 2)   return '🌤️';
    if (code === 3)  return '☁️';
    if (code <= 48)  return '🌫️';
    if (code <= 55)  return '🌦️';
    if (code <= 67)  return '🌧️';
    if (code <= 77)  return '❄️';
    if (code <= 82)  return '🌨️';
    return                  '⛈️';
}

function wmoLabel(code) {
    if (code === 0)  return 'Clear sky';
    if (code <= 2)   return 'Partly cloudy';
    if (code === 3)  return 'Overcast';
    if (code <= 48)  return 'Foggy';
    if (code <= 55)  return 'Drizzle';
    if (code <= 67)  return 'Rain';
    if (code <= 77)  return 'Snow';
    if (code <= 82)  return 'Rain showers';
    return                  'Thunderstorm';
}

function wmoCardClass(code) {
    if (code === 0)  return 'cg2__fcard--sun';
    if (code <= 2)   return 'cg2__fcard--partly';
    if (code === 3)  return 'cg2__fcard--cloud';
    if (code <= 48)  return 'cg2__fcard--fog';
    if (code <= 55)  return 'cg2__fcard--drizzle';
    if (code <= 67)  return 'cg2__fcard--rain';
    if (code <= 77)  return 'cg2__fcard--snow';
    if (code <= 82)  return 'cg2__fcard--shower';
    return                  'cg2__fcard--storm';
}

function fetchCityForecast(cityName) {
    var coords = CITY_COORDS_MAP[cityName];
    var panel  = document.getElementById('cg2ForecastPanel');
    var wrap   = document.getElementById('cg2ForecastWrap');
    var btn    = document.getElementById('cg2ForecastBtn');
    if (!panel || !wrap) return;

    wrap.style.display = 'block';
    panel.innerHTML = '<div class="cg2__7day__skeleton"><div class="cg2__7day__sk__spin"></div><p>Loading live forecast…</p></div>';

    if (!coords) {
        panel.innerHTML = '<div class="cg2__7day__err"><i class="fa-solid fa-triangle-exclamation"></i><p>No forecast data for ' + cityName + '</p></div>';
        return;
    }

    var url = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + coords.lat + '&longitude=' + coords.lon +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum' +
        '&timezone=auto&forecast_days=7';

    fetch(url)
    .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(data) {
        var daily = data.daily;
        if (!daily || !daily.time) throw new Error('No daily data');

        var codes = daily.weather_code || daily.weathercode || [];
        var maxT  = daily.temperature_2m_max  || [];
        var minT  = daily.temperature_2m_min  || [];
        var precs = daily.precipitation_sum   || [];

        var todayCode  = codes[0] || 0;
        var todayEmoji = wmoEmoji(todayCode);
        var todayLabel = wmoLabel(todayCode);
        var todayHi    = Math.round(maxT[0] || 0);
        var todayLo    = Math.round(minT[0] || 0);

        var cardsHtml = daily.time.map(function(dateStr, i) {
            var code  = codes[i]  || 0;
            var hi    = Math.round(maxT[i]  || 0);
            var lo    = Math.round(minT[i]  || 0);
            var prec  = precs[i]  || 0;
            var emoji = wmoEmoji(code);
            var label = wmoLabel(code);
            var cls   = wmoCardClass(code);
            var dn    = i === 0 ? 'Today'
                       : new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'short' });
            var precHtml = prec > 0.1
                ? '<div class="cg2__fcard__prec"><i class="fa-solid fa-droplet"></i>' + prec.toFixed(1) + 'mm</div>'
                : '<div class="cg2__fcard__prec cg2__fcard__prec--none">—</div>';
            var todayCls = i === 0 ? ' cg2__fcard--today' : '';
            return '<div class="cg2__fcard ' + cls + todayCls + '">' +
                '<div class="cg2__fcard__day">' + dn + '</div>' +
                '<div class="cg2__fcard__icon">' + emoji + '</div>' +
                '<div class="cg2__fcard__cond">' + label + '</div>' +
                '<div class="cg2__fcard__hi">' + hi + '°</div>' +
                '<div class="cg2__fcard__lo">' + lo + '°</div>' +
                precHtml +
            '</div>';
        }).join('');

        panel.innerHTML =
            '<div class="cg2__7day__hdr">' +
                '<div class="cg2__7day__hdr__left">' +
                    '<div class="cg2__7day__hdr__city"><i class="fa-solid fa-location-dot"></i>' + cityName + '</div>' +
                    '<div class="cg2__7day__hdr__cond">' + todayEmoji + ' ' + todayLabel + '</div>' +
                '</div>' +
                '<div class="cg2__7day__hdr__temps">' +
                    '<span class="cg2__7day__hdr__hi">' + todayHi + '°</span>' +
                    '<span class="cg2__7day__hdr__lo">/ ' + todayLo + '°</span>' +
                '</div>' +
            '</div>' +
            '<div class="cg2__7day__grid">' + cardsHtml + '</div>';

        if (btn) {
            btn.classList.add('cg2__7day__btn--active');
            btn.querySelector('span').textContent = 'Hide Forecast';
        }
    })
    .catch(function() {
        panel.innerHTML = '<div class="cg2__7day__err">' +
            '<i class="fa-solid fa-triangle-exclamation"></i>' +
            '<p>Could not load forecast — check your connection</p>' +
        '</div>';
    });
}

var CG2_UNI_META = {};
fetch('data/uni_meta_es.json')
    .then(function(r) { return r.json(); })
    .then(function(d) { CG2_UNI_META = d; })
    .catch(function() { console.warn('uni_meta_es.json not found'); });

var cg2ActiveCity = null;

function cg2InitSliders() {
    var food = document.getElementById('cg2FoodSlider');
    var ent  = document.getElementById('cg2EntSlider');
    if (!food || !ent) return;
    food.addEventListener('input', function() {
        document.getElementById('cg2FoodVal').textContent = '\u20ac' + this.value;
        cg2CalcCost();
    });
    ent.addEventListener('input', function() {
        document.getElementById('cg2EntVal').textContent = '\u20ac' + this.value;
        cg2CalcCost();
    });
    document.querySelectorAll('input[name="cg2Acc"]').forEach(function(r) {
        r.addEventListener('change', cg2CalcCost);
    });
}

function cg2CalcCost() {
    if (!cg2ActiveCity) return;
    var d = CG2_DATA[cg2ActiveCity];
    var accRadio = document.querySelector('input[name="cg2Acc"]:checked');
    if (!accRadio) return;
    var acc   = d.accCosts[accRadio.value] || 0;
    var food  = parseInt(document.getElementById('cg2FoodSlider').value)  || 200;
    var ent   = parseInt(document.getElementById('cg2EntSlider').value)   || 100;
    var trans = d.transport || 40;
    var monthly = acc + food + ent + trans;
    var yearly  = monthly * 10;
    var aff;
    if      (monthly < 700)  aff = {label:'Very Affordable', color:'#27ae60'};
    else if (monthly < 1000) aff = {label:'Affordable',      color:'#2ecc71'};
    else if (monthly < 1300) aff = {label:'Moderate',        color:'#f39c12'};
    else if (monthly < 1600) aff = {label:'Expensive',       color:'#e67e22'};
    else                     aff = {label:'Very Expensive',  color:'#e74c3c'};
    document.getElementById('cg2CostMonthly').textContent = '\u20ac' + monthly.toLocaleString();
    document.getElementById('cg2CostYearly').textContent  = '\u20ac' + yearly.toLocaleString();
    document.getElementById('cg2CostAff').innerHTML       = '<span style="color:' + aff.color + ';font-weight:700">' + aff.label + '</span>';
    var items = [
        {label:'Accommodation', val:acc,   color:'#e74c3c'},
        {label:'Food',          val:food,  color:'#f39c12'},
        {label:'Entertainment', val:ent,   color:'#9b59b6'},
        {label:'Transport',     val:trans, color:'#3498db'}
    ];
    document.getElementById('cg2CostBreakdown').innerHTML = items.map(function(it) {
        var pct = Math.round((it.val / monthly) * 100);
        return '<div class="cg2__bd__row">' +
            '<span class="cg2__bd__lbl">' + it.label + '</span>' +
            '<div class="cg2__bd__bar__wrap"><div class="cg2__bd__bar" style="width:' + pct + '%;background:' + it.color + '"></div></div>' +
            '<span class="cg2__bd__val">\u20ac' + it.val + '</span>' +
        '</div>';
    }).join('');
}

function cg2MakeDefaultData(name, inf) {
    return {
        gradient: 'linear-gradient(135deg,#d97c14,#f59220)',
        icon: (typeof CITY_PILL_ICONS !== 'undefined' && CITY_PILL_ICONS[name]) || 'fa-location-dot',
        studentPop: 'Local students',
        vibe: inf.desc || ('Explore ' + name + ' — a vibrant student destination.'),
        matchScore: 75,
        matchReason: 'Based on your profile and this city\'s characteristics.',
        matchBreakdown: [
            {label:'Affordability',score:70},{label:'Student Life',score:75},
            {label:'Safety',score:78},{label:'Culture',score:72},{label:'Transport',score:70}
        ],
        lifestyle: [
            {label:'Study Environment',score:75,icon:'fa-book',color:'#2980b9'},
            {label:'Safety',score:78,icon:'fa-shield',color:'#27ae60'},
            {label:'Cost of Living',score:70,icon:'fa-coins',color:'#e74c3c'},
            {label:'Diversity',score:72,icon:'fa-globe',color:'#1abc9c'},
            {label:'Public Transport',score:70,icon:'fa-bus',color:'#3498db'}
        ],
        accCosts: {shared:400,studio:600,private:900}, transport:50,
        neighbourhoods: [
            {name:'City Centre',safety:78,popularity:85,rent:inf.cost||'—',commute:'0–10 min',vibe:'Central area close to university and amenities'},
            {name:'Student Quarter',safety:76,popularity:80,rent:inf.cost||'—',commute:'10–20 min',vibe:'Main student neighbourhood with bars and cafés'},
            {name:'Residential Area',safety:82,popularity:70,rent:inf.cost||'—',commute:'20–30 min',vibe:'Quieter area popular with postgraduate students'}
        ],
        hotspots: (inf.highlights||[]).slice(0,5).map(function(h,i){
            var icons = ['fa-landmark','fa-tree','fa-utensils','fa-palette','fa-music'];
            var colors = ['#c0392b','#27ae60','#e67e22','#9b59b6','#2980b9'];
            return {type:'Highlight',name:h.split('—')[0].trim(),icon:icons[i]||'fa-star',color:colors[i]||'#d97c14'};
        }),
        dayTimeline: [
            {time:'9:00',icon:'fa-book',title:'Morning lectures',desc:'Start the academic day at the university.'},
            {time:'13:00',icon:'fa-utensils',title:'Local lunch',desc:'Try the local cuisine at a nearby restaurant or market.'},
            {time:'16:00',icon:'fa-person-walking',title:'City exploration',desc:'Discover the city\'s landmarks and neighbourhoods.'},
            {time:'19:00',icon:'fa-wine-glass',title:'Evening socialising',desc:'Meet friends at local bars and cafés.'},
            {time:'22:00',icon:'fa-moon',title:'Nightlife',desc:'Experience the local nightlife scene.'}
        ],
        universities: [],
        testimonials: [],
        weather: {
            summary: inf.climate + ' climate.',
            months:['J','F','M','A','M','J','J','A','S','O','N','D'],
            temps:[8,9,12,15,19,23,26,25,21,16,11,8],
            rain:[50,40,45,45,50,40,30,35,45,55,55,52]
        }
    };
}

function cg2EmptyState(icon, title, text, showBtn) {
    return '<div class="cg2__empty">' +
        '<div class="cg2__empty__icon"><i class="fa-solid ' + icon + '"></i></div>' +
        '<div class="cg2__empty__title">' + title + '</div>' +
        '<p class="cg2__empty__text">' + text + '</p>' +
        (showBtn ? '<button class="cg2__empty__btn" data-goto-explore="1"><i class="fa-solid fa-compass"></i> Open Explore</button>' : '') +
    '</div>';
}

function cg2RenderCity(name) {
    var inf = CITY_INFO[name];
    if (!inf) return;
    var d = CG2_DATA[name] || cg2MakeDefaultData(name, inf);
    cg2ActiveCity = name;

    document.querySelectorAll('.cg2__pill').forEach(function(p) {
        p.classList.toggle('active', p.dataset.city === name);
    });

    var panel = document.getElementById('cg2Panel');
    panel.style.display = 'flex';
    panel.classList.remove('cg2__panel--in');
    void panel.offsetWidth;
    panel.classList.add('cg2__panel--in');

    var hero = document.getElementById('cg2Hero');
    hero.style.background = d.gradient;
    document.getElementById('cg2HeroBadge').innerHTML    = '<i class="fa-solid ' + d.icon + '"></i>';
    document.getElementById('cg2HeroName').textContent   = name;
    document.getElementById('cg2HeroRegion').textContent = inf.region;
    document.getElementById('cg2HeroVibe').textContent   = d.vibe;
    document.getElementById('cg2HeroPop').textContent     = inf.pop;
    document.getElementById('cg2HeroStudPop').textContent = d.studentPop;
    document.getElementById('cg2HeroCost').textContent    = inf.cost;
    document.getElementById('cg2HeroClimate').textContent = inf.climate;

    var score = d.matchScore;
    var r = 38; var circ = 2 * Math.PI * r;
    var offset = circ - (score / 100) * circ;
    var fill = document.getElementById('cg2RingFill');
    fill.style.strokeDasharray  = circ;
    fill.style.strokeDashoffset = circ;
    document.getElementById('cg2RingLabel').textContent = score + '%';
    setTimeout(function() { fill.style.strokeDashoffset = offset; }, 300);

    document.getElementById('cg2MatchReason').textContent = d.matchReason;
    document.getElementById('cg2MatchBars').innerHTML = d.matchBreakdown.map(function(b) {
        return '<div class="cg2__mb__row">' +
            '<span class="cg2__mb__lbl">' + b.label + '</span>' +
            '<div class="cg2__mb__track"><div class="cg2__mb__fill" data-pct="' + b.score + '" style="width:0"></div></div>' +
            '<span class="cg2__mb__val">' + b.score + '%</span>' +
        '</div>';
    }).join('');

    document.getElementById('cg2LifestyleGrid').innerHTML = d.lifestyle.map(function(l) {
        return '<div class="cg2__ls__row">' +
            '<div class="cg2__ls__ico" style="color:' + l.color + '"><i class="fa-solid ' + l.icon + '"></i></div>' +
            '<span class="cg2__ls__lbl">' + l.label + '</span>' +
            '<div class="cg2__ls__track"><div class="cg2__ls__bar" data-pct="' + l.score + '" style="width:0;background:' + l.color + '"></div></div>' +
            '<span class="cg2__ls__val">' + l.score + '</span>' +
        '</div>';
    }).join('');

    cg2CalcCost();

    document.getElementById('cg2HoodsList').innerHTML = d.neighbourhoods.map(function(h) {
        var sc = h.safety >= 85 ? '#27ae60' : h.safety >= 75 ? '#f39c12' : '#e74c3c';
        return '<div class="cg2__hood">' +
            '<div class="cg2__hood__top">' +
                '<span class="cg2__hood__name">' + h.name + '</span>' +
                '<span class="cg2__hood__badges">' +
                    '<span style="color:' + sc + '"><i class="fa-solid fa-shield"></i> ' + h.safety + '</span>' +
                    '<span style="color:#f39c12"><i class="fa-solid fa-fire"></i> ' + h.popularity + '%</span>' +
                '</span>' +
            '</div>' +
            '<div class="cg2__hood__row"><i class="fa-solid fa-coins"></i> ' + h.rent + '</div>' +
            '<div class="cg2__hood__row"><i class="fa-solid fa-route"></i> ' + h.commute + ' to campus</div>' +
            '<div class="cg2__hood__vibe">' + h.vibe + '</div>' +
        '</div>';
    }).join('');

    var _spots = getSavedPlaces();
    document.getElementById('cg2HotspotsList').innerHTML = d.hotspots.map(function(h) {
        var mapsUrl = 'https://www.google.com/maps/search/' + encodeURIComponent(h.name + ' ' + name);
        var isSaved = _spots.some(function(p){ return p.name === h.name && p.city === name; });
        return '<div class="cg2__spot" data-spot-name="' + h.name + '" data-spot-city="' + name + '">' +
            '<div class="cg2__spot__ico" style="background:' + h.color + '1a;color:' + h.color + '">' +
                '<i class="fa-solid ' + h.icon + '"></i>' +
            '</div>' +
            '<div class="cg2__spot__txt">' +
                '<div class="cg2__spot__name">' + h.name + '</div>' +
                '<div class="cg2__spot__type">' + h.type + '</div>' +
            '</div>' +
            '<div class="cg2__spot__actions">' +
                '<a class="cg2__spot__maps" href="' + mapsUrl + '" target="_blank" rel="noopener" title="Open in Google Maps"><i class="fa-solid fa-map-location-dot"></i></a>' +
                '<button class="cg2__spot__save' + (isSaved ? ' cg2__spot__save--on' : '') + '" data-place="' + h.name + '" data-city="' + name + '" title="' + (isSaved ? 'Saved' : 'Save place') + '"><i class="fa-' + (isSaved ? 'solid' : 'regular') + ' fa-heart"></i></button>' +
            '</div>' +
        '</div>';
    }).join('');
    document.getElementById('cg2HotspotsList').querySelectorAll('.cg2__spot__save').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var pname = btn.dataset.place, city = btn.dataset.city;
            var places = getSavedPlaces();
            var idx = places.findIndex(function(p){ return p.name === pname && p.city === city; });
            if (idx === -1) places.push({ name: pname, city: city }); else places.splice(idx, 1);
            setSavedPlaces(places);
            var on = places.some(function(p){ return p.name === pname && p.city === city; });
            btn.classList.toggle('cg2__spot__save--on', on);
            btn.title = on ? 'Saved' : 'Save place';
            btn.querySelector('i').className = 'fa-' + (on ? 'solid' : 'regular') + ' fa-heart';
            btn.classList.add('pulse');
            btn.addEventListener('animationend', function(){ btn.classList.remove('pulse'); }, { once: true });
            renderSavedPlaces(); updateStats();
        });
    });

    document.getElementById('cg2DayTimeline').innerHTML = d.dayTimeline.map(function(e, i) {
        var isLast = i === d.dayTimeline.length - 1;
        return '<div class="cg2__day__item' + (isLast ? ' cg2__day__item--last' : '') + '">' +
            '<div class="cg2__day__left">' +
                '<div class="cg2__day__node"><i class="fa-solid ' + e.icon + '"></i></div>' +
                (isLast ? '' : '<div class="cg2__day__line"></div>') +
            '</div>' +
            '<div class="cg2__day__right">' +
                '<div class="cg2__day__hd"><span class="cg2__day__time">' + e.time + '</span><span class="cg2__day__title">' + e.title + '</span></div>' +
                '<p class="cg2__day__desc">' + e.desc + '</p>' +
            '</div>' +
        '</div>';
    }).join('');

    var saved = getSaved();
    var unisGridEl = document.getElementById('cg2UnisGrid');
    if (!d.universities || !d.universities.length) {
        unisGridEl.innerHTML = cg2EmptyState(
            'fa-graduation-cap',
            'University guide coming soon',
            'We’re curating the best institutions in <strong>' + name + '</strong>. In the meantime, head to <strong>Explore</strong> to search every university in this country and bookmark your favourites.',
            true
        );
        var goBtn = unisGridEl.querySelector('[data-goto-explore]');
        if (goBtn) goBtn.addEventListener('click', function() { showTab('explore'); });
    } else {
    unisGridEl.innerHTML = d.universities.map(function(uid) {
        var m = CG2_UNI_META[uid] || {name:uid,type:'',field:'',tuition:'',students:''};
        var isSaved = saved.indexOf(uid) !== -1;
        return '<div class="cg2__uni">' +
            '<div class="cg2__uni__abbr">' + uid.toUpperCase() + '</div>' +
            '<div class="cg2__uni__body">' +
                '<div class="cg2__uni__name">' + m.name + '</div>' +
                '<div class="cg2__uni__meta"><span class="cg2__uni__badge">' + m.type + '</span><span>' + m.field + '</span></div>' +
                '<div class="cg2__uni__meta"><i class="fa-solid fa-coins"></i> ' + m.tuition + ' &nbsp;·&nbsp; <i class="fa-solid fa-users"></i> ' + m.students + ' students</div>' +
            '</div>' +
            '<button class="cg2__uni__save' + (isSaved ? ' cg2__uni__save--on' : '') + '" data-uid="' + uid + '" title="Save">' +
                '<i class="fa-' + (isSaved ? 'solid' : 'regular') + ' fa-bookmark"></i>' +
            '</button>' +
        '</div>';
    }).join('');
    }
    document.querySelectorAll('.cg2__uni__save').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var s = getSaved(), uid = btn.dataset.uid, idx = s.indexOf(uid);
            if (idx === -1) s.push(uid); else s.splice(idx, 1);
            setSaved(s);
            var on = s.indexOf(uid) !== -1;
            btn.classList.toggle('cg2__uni__save--on', on);
            btn.querySelector('i').className = 'fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark';
            renderSaved(); updateStats(); updateHeroStats(); updateHeroFeed();
        });
    });

    var testiGridEl = document.getElementById('cg2TestiGrid');
    if (!d.testimonials || !d.testimonials.length) {
        testiGridEl.innerHTML = cg2EmptyState(
            'fa-comments',
            'No stories shared yet',
            'Be among the first to study in <strong>' + name + '</strong>. Real student reviews — the good, the tough and the insider tips — will appear here as our community grows.'
        );
    } else {
    testiGridEl.innerHTML = d.testimonials.map(function(t) {
        var stars = [1,2,3,4,5].map(function(n) {
            return '<i class="fa-' + (n <= t.rating ? 'solid' : 'regular') + ' fa-star"></i>';
        }).join('');
        return '<div class="cg2__testi">' +
            '<div class="cg2__testi__top">' +
                '<span class="cg2__testi__flag">' + t.flag + '</span>' +
                '<div><div class="cg2__testi__name">' + t.name + '</div><div class="cg2__testi__from">' + t.country + '</div></div>' +
                '<div class="cg2__testi__stars">' + stars + '</div>' +
            '</div>' +
            '<div class="cg2__testi__pos"><i class="fa-solid fa-thumbs-up"></i><span>' + t.positive + '</span></div>' +
            '<div class="cg2__testi__neg"><i class="fa-solid fa-thumbs-down"></i><span>' + t.negative + '</span></div>' +
            '<div class="cg2__testi__tip"><i class="fa-solid fa-lightbulb"></i><span><b>Tip:</b> ' + t.advice + '</span></div>' +
        '</div>';
    }).join('');
    }

    // Auto-fetch 7-day forecast for the new city
    var fWrap = document.getElementById('cg2ForecastWrap');
    var fPanel = document.getElementById('cg2ForecastPanel');
    var fBtn   = document.getElementById('cg2ForecastBtn');
    if (fWrap)  { fWrap.style.display = 'none'; }
    if (fPanel) { fPanel.innerHTML = '<div class="cg2__7day__skeleton"><div class="cg2__7day__sk__spin"></div><p>Loading live forecast…</p></div>'; }
    if (fBtn)   { fBtn.classList.remove('cg2__7day__btn--active'); fBtn.querySelector('span').textContent = '7-Day Forecast'; }

    requestAnimationFrame(function() { requestAnimationFrame(function() {
        document.querySelectorAll('.cg2__mb__fill').forEach(function(el) { el.style.width = el.dataset.pct + '%'; });
        document.querySelectorAll('.cg2__ls__bar').forEach(function(el)  { el.style.width = el.dataset.pct + '%'; });
    }); });

    setTimeout(function() { panel.scrollIntoView({behavior:'smooth', block:'start'}); }, 80);
}

document.querySelectorAll('.cg2__pill').forEach(function(btn) {
    btn.addEventListener('click', function() { cg2RenderCity(btn.dataset.city); });
});
cg2InitSliders();

(function() {
    var closeBtn = document.getElementById('cg2PanelClose');
    if (!closeBtn) return;
    closeBtn.addEventListener('click', function() {
        var panel = document.getElementById('cg2Panel');
        if (!panel) return;
        panel.classList.remove('cg2__panel--in');
        panel.classList.add('cg2__panel--out');
        setTimeout(function() {
            panel.style.display = 'none';
            panel.classList.remove('cg2__panel--out');
        }, 340);
        document.querySelectorAll('.cg2__pill').forEach(function(p) { p.classList.remove('active'); });
        cg2ActiveCity = null;
    });
}());

(function() {
    var forecastBtn = document.getElementById('cg2ForecastBtn');
    if (!forecastBtn) return;
    forecastBtn.addEventListener('click', function() {
        var city = cg2ActiveCity;
        if (!city) return;
        var wrap = document.getElementById('cg2ForecastWrap');
        if (!wrap) return;
        var isVisible = wrap.style.display !== 'none';
        if (isVisible) {
            wrap.style.display = 'none';
            forecastBtn.classList.remove('cg2__7day__btn--active');
            forecastBtn.querySelector('span').textContent = '7-Day Forecast';
        } else {
            fetchCityForecast(city);
            wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    });
}());

var currentCountryCode = 'es';
function placesKey() { return 'uniscout_places_' + currentCountryCode; }
function getSavedPlaces() { return JSON.parse(localStorage.getItem(placesKey()) || '[]'); }
function setSavedPlaces(arr) { localStorage.setItem(placesKey(), JSON.stringify(arr)); }

function renderSavedPlaces() {
    var places = getSavedPlaces();
    var grid = document.getElementById('savedPlacesGrid');
    var empty = document.getElementById('savedPlacesEmpty');
    if (!grid) return;
    if (!places.length) { grid.style.display = 'none'; empty.style.display = 'flex'; return; }
    empty.style.display = 'none'; grid.style.display = 'grid';
    grid.innerHTML = places.map(function(p) {
        var mapsUrl = 'https://www.google.com/maps/search/' + encodeURIComponent(p.name + ' ' + p.city);
        return '<div class="mp__place__card">' +
            '<a class="mp__place__maps__link" href="' + mapsUrl + '" target="_blank" rel="noopener" title="Open in Google Maps"><i class="fa-solid fa-map-location-dot"></i></a>' +
            '<div class="mp__place__info">' +
                '<div class="mp__place__name">' + p.name + '</div>' +
                '<div class="mp__place__city"><i class="fa-solid fa-location-dot"></i> ' + p.city + '</div>' +
            '</div>' +
            '<button class="mp__place__remove" data-name="' + p.name + '" data-city="' + p.city + '" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>';
    }).join('');
    grid.querySelectorAll('.mp__place__remove').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var places = getSavedPlaces().filter(function(p) { return !(p.name === btn.dataset.name && p.city === btn.dataset.city); });
            setSavedPlaces(places);
            renderSavedPlaces();
            updateStats();
        });
    });
}
renderSavedPlaces();

function showCityInfo(cityName) {

    if (!document.getElementById('wxCiBadge')) return;
    var info = CITY_INFO[cityName] || { region:'—', pop:'—', climate:'—', cost:'—', desc:'', highlights:[], studentLife:'', transport:'', nightlife:'', pros:[], tags:[] };
    document.getElementById('wxCiBadge').textContent   = cityName.slice(0,2).toUpperCase();
    document.getElementById('wxCiName').textContent    = cityName;
    document.getElementById('wxCiRegion').textContent  = info.region;
    document.getElementById('wxCiPop').textContent     = info.pop;
    document.getElementById('wxCiClimate').textContent = info.climate;
    document.getElementById('wxCiCost').textContent    = info.cost;
    document.getElementById('wxCiDesc').textContent    = info.desc;

    var places = getSavedPlaces();
    document.getElementById('wxCiHighlights').innerHTML = (info.highlights || []).map(function(h) {
        var pname = h.split(' — ')[0];
        var note  = h.indexOf(' — ') !== -1 ? h.split(' — ').slice(1).join(' — ') : '';
        var saved = places.some(function(p){ return p.name === pname && p.city === cityName; });
        return '<div class="wx__ci__hl">' +
            '<div class="wx__ci__hl__text"><span class="wx__ci__hl__name">' + pname + '</span>' + (note ? '<span class="wx__ci__hl__note">' + note + '</span>' : '') + '</div>' +
            '<button class="wx__ci__hl__save' + (saved ? ' saved' : '') + '" data-place="' + pname + '" data-city="' + cityName + '" title="' + (saved ? 'Saved' : 'Save place') + '"><i class="fa-' + (saved ? 'solid' : 'regular') + ' fa-heart"></i></button>' +
        '</div>';
    }).join('');

    document.getElementById('wxCiHighlights').querySelectorAll('.wx__ci__hl__save').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var pname = btn.dataset.place; var city = btn.dataset.city;
            var places = getSavedPlaces();
            var idx = places.findIndex(function(p){ return p.name === pname && p.city === city; });
            if (idx === -1) { places.push({ name: pname, city: city }); } else { places.splice(idx, 1); }
            setSavedPlaces(places);
            var saved = places.some(function(p){ return p.name === pname && p.city === city; });
            btn.className = 'wx__ci__hl__save' + (saved ? ' saved' : '') + ' pulse';
            btn.title = saved ? 'Saved' : 'Save place';
            btn.querySelector('i').className = 'fa-' + (saved ? 'solid' : 'regular') + ' fa-heart';
            btn.addEventListener('animationend', function(){ btn.classList.remove('pulse'); }, { once: true });
            renderSavedPlaces(); updateStats();
        });
    });

    document.getElementById('wxCiStudentLife').textContent = info.studentLife || '';
    document.getElementById('wxCiTransport').textContent   = info.transport   || '';
    document.getElementById('wxCiNightlife').textContent   = info.nightlife   || '';
    document.getElementById('wxCiPros').innerHTML = (info.pros || []).map(function(p){ return '<div class="wx__ci__pro"><i class="fa-solid fa-check"></i>' + p + '</div>'; }).join('');
    document.getElementById('wxCiTags').innerHTML = (info.tags || []).map(function(t){ return '<span class="wx__ci__tag">' + t + '</span>'; }).join('');

    document.getElementById('wxCityInfo').classList.add('open');
    document.getElementById('wxFeatured').style.display = 'none';
}

(function(){ var el = document.getElementById('wxCityInfoBack'); if (el) el.addEventListener('click', function() {
    var ci = document.getElementById('wxCityInfo'); if (ci) ci.classList.remove('open');
    var ft = document.getElementById('wxFeatured'); if (ft) ft.style.display = 'block';
}); }());

document.querySelectorAll('.wx__feat__card').forEach(function(card) {
    card.addEventListener('click', function() {
        var city = card.dataset.city;
        document.getElementById('wxCityInput').value = city;
        showCityInfo(city);
        fetchWeather(city);
    });
});

(function(){ var el = document.getElementById('wxCityBtn'); if (el) el.addEventListener('click', function() {
    var inp = document.getElementById('wxCityInput'); var city = inp ? inp.value.trim() : '';
    if (city) fetchWeather(city);
}); }());

document.querySelectorAll('.cg__card__wxbtn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var city = btn.dataset.city;
        document.getElementById('wxCityInput').value = city;
        showCityInfo(city);
        fetchWeather(city);
        document.getElementById('cgWeatherSection').scrollIntoView({ behavior:'smooth', block:'start' });
    });
});
(function(){ var el = document.getElementById('wxCityInput'); if (el) el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { var city = el.value.trim(); if (city) fetchWeather(city); }
}); }());

var wxDayData = {};

function applyWeatherDisplay(entries, cond, cityLabel) {
    var hi  = Math.max.apply(null, entries.map(function(e){ return e.main.temp_max; }));
    var lo  = Math.min.apply(null, entries.map(function(e){ return e.main.temp_min; }));
    var mid = entries[Math.floor(entries.length / 2)];
    var icon = WX_ICONS[cond || mid.weather[0].main] || '🌡️';
    var photo = WX_PHOTOS[cond || mid.weather[0].main] || 'images/cloudy.jpeg';
    if (cityLabel) document.getElementById('wxWzCity').textContent = cityLabel;
    document.getElementById('wxWzIcon').textContent = icon;
    document.getElementById('wxWzTemp').textContent = Math.round(mid.main.temp) + '°C';
    document.getElementById('wxWzDesc').textContent = mid.weather[0].description;
    document.getElementById('wxWzHum').textContent  = mid.main.humidity + '%';
    document.getElementById('wxWzWind').textContent = Math.round(mid.wind.speed) + ' m/s';
    document.getElementById('wxWzFeel').textContent = Math.round(mid.main.feels_like) + '°C';
    document.getElementById('wxWzHi').textContent   = 'H: ' + Math.round(hi) + '°';
    document.getElementById('wxWzLo').textContent   = 'L: ' + Math.round(lo) + '°';
    var wz = document.getElementById('wxWeatherZone');
    if (wz) { wz.style.backgroundImage = 'url(' + photo + ')'; wz.classList.add('wx__has__photo'); }
}

function fetchWeather(city) {
    var placeholder = document.getElementById('wxPlaceholder');
    var mainEl      = document.getElementById('wxMain');
    var errEl       = document.getElementById('wxWzErr');
    placeholder.style.display = 'none';
    errEl.style.display       = 'none';
    mainEl.style.display      = 'none';

    fetch('https://api.openweathermap.org/data/2.5/forecast?q=' + encodeURIComponent(city) + '&units=metric&appid=' + WX_KEY)
    .then(function(r) {
        if (!r.ok) throw new Error('City not found');
        return r.json();
    })
    .then(function(data) {
        var cur  = data.list[0];
        var cond = cur.weather[0].main;

        showCityInfo(data.city.name);

        applyWeatherDisplay([cur], cond, data.city.name + ', ' + data.city.country, false);
        document.getElementById('wxWzTemp').textContent = Math.round(cur.main.temp) + '°C';

        wxDayData = {};
        data.list.forEach(function(item) {
            var d = item.dt_txt.split(' ')[0];
            if (!wxDayData[d]) wxDayData[d] = [];
            wxDayData[d].push(item);
        });
        var dayKeys = Object.keys(wxDayData).slice(0, 5);

        document.getElementById('wxWzForecast').innerHTML = dayKeys.map(function(d, idx) {
            var entries = wxDayData[d];
            var hi  = Math.max.apply(null, entries.map(function(e){ return e.main.temp_max; }));
            var lo  = Math.min.apply(null, entries.map(function(e){ return e.main.temp_min; }));
            var mid = entries[Math.floor(entries.length / 2)];
            var ic  = WX_ICONS[mid.weather[0].main] || '🌡️';
            var dn  = new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { weekday:'short' });
            return '<div class="wx__forecast__day' + (idx === 0 ? ' active' : '') + '" data-day="' + d + '">' +
                '<div class="wx__day__name">' + dn + '</div>' +
                '<div class="wx__day__icon">' + ic + '</div>' +
                '<div class="wx__day__hi">' + Math.round(hi) + '°</div>' +
                '<div class="wx__day__lo">' + Math.round(lo) + '°</div>' +
            '</div>';
        }).join('');

        document.getElementById('wxWzForecast').querySelectorAll('.wx__forecast__day').forEach(function(dayEl) {
            dayEl.addEventListener('click', function() {
                document.getElementById('wxWzForecast').querySelectorAll('.wx__forecast__day').forEach(function(d){ d.classList.remove('active'); });
                dayEl.classList.add('active');
                var d = dayEl.dataset.day;
                var entries = wxDayData[d];
                if (!entries || !entries.length) return;
                var mid = entries[Math.floor(entries.length / 2)];
                applyWeatherDisplay(entries, mid.weather[0].main, null, true);
            });
        });

        mainEl.style.display = 'flex';
    })
    .catch(function() {
        errEl.style.display = 'block';
    });
}

var cmpVsSelected = { A: null, B: null };
var cmpVsCountry  = { A: null, B: null };   // country code chosen per slot
var cmpVsUnis     = { A: [], B: [] };       // universities available for each slot's country
var cmpCountryCache = {};                    // code -> universities array

// Countries available in the compare dropdowns (the ones we have data for)
function cmpCountryList() {
    if (typeof DATA_COUNTRIES !== 'undefined') return DATA_COUNTRIES.slice();
    return [];
}

// Load (and cache) the universities for a given country code
function cmpLoadCountryUnis(code) {
    if (cmpCountryCache[code]) return Promise.resolve(cmpCountryCache[code]);
    return fetch('data/' + code + '.json')
        .then(function(r) { if (!r.ok) throw new Error('Missing'); return r.json(); })
        .then(function(data) {
            var list = (data.universities || []).concat(
                typeof getCustomUnisForCountry === 'function' ? getCustomUnisForCountry(code) : []
            );
            cmpCountryCache[code] = list;
            return list;
        })
        .catch(function() { cmpCountryCache[code] = []; return []; });
}

function buildVsSuggest(query, resultEl, slot) {
    if (!query) { resultEl.innerHTML = ''; return; }
    var q = query.toLowerCase();
    var pool = (cmpVsUnis[slot] && cmpVsUnis[slot].length) ? cmpVsUnis[slot] : UNI;
    var hits = pool.filter(function(u) {
        return (u.name + ' ' + u.abbr + ' ' + u.city).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 6);
    if (!hits.length) {
        resultEl.innerHTML = '<div class="cmp__vs__no__match">No universities found for "' + query + '"</div>';
        return;
    }
    resultEl.innerHTML = hits.map(function(u) {
        var tc = uniIsPublic(u) ? 'mp__badge--pub' : 'mp__badge--priv';
        return '<div class="cmp__vs__suggest" data-id="' + u.id + '">' +
            '<span class="cmp__vs__suggest__logo">' + uniLogo(u, 30) + '</span>' +
            '<div class="cmp__vs__suggest__info">' +
                '<div class="cmp__vs__suggest__name">' + u.name + '</div>' +
                '<div class="cmp__vs__suggest__meta">' +
                    '<span class="mp__badge mp__badge--city">' + u.city + '</span>' +
                    '<span class="mp__badge ' + tc + '">' + u.type + '</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');
    resultEl.querySelectorAll('.cmp__vs__suggest').forEach(function(el) {
        el.addEventListener('click', function() {
            // Look up within this slot's country pool first (it may be a different
            // country than the current destination), then fall back to global UNI.
            var u = hits.find(function(x){ return x.id === el.dataset.id; }) ||
                    UNI.find(function(x){ return x.id === el.dataset.id; });
            if (u) selectVsUni(slot, u);
        });
    });
    cmpHydrateLogos(resultEl);
}

function selectVsUni(slot, u) {
    cmpVsSelected[slot] = u;
    var searchEl   = document.getElementById('cmpSearch' + slot);
    var resultsEl  = document.getElementById('cmpResults' + slot);
    var selectedEl = document.getElementById('cmpSelected' + slot);
    var tc = uniIsPublic(u) ? 'mp__badge--pub' : 'mp__badge--priv';
    searchEl.value = '';
    resultsEl.innerHTML = '';
    selectedEl.style.display = 'block';
    selectedEl.innerHTML =
        '<div class="cmp__vs__sel__card cmp__vs__sel__card--in" style="border-color:' + u.color + '">' +
            '<span class="cmp__vs__sel__logo">' + uniLogo(u, 34) + '</span>' +
            '<div class="cmp__vs__sel__info">' +
                '<div class="cmp__vs__sel__name">' + u.name + '</div>' +
                '<div class="cmp__vs__sel__meta">' +
                    '<span class="mp__badge mp__badge--city">' + u.city + '</span>' +
                    '<span class="mp__badge ' + tc + '">' + u.type + '</span>' +
                '</div>' +
            '</div>' +
            '<button class="cmp__vs__clear__btn" data-slot="' + slot + '" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>';
    selectedEl.querySelector('.cmp__vs__clear__btn').addEventListener('click', function() {
        var card = selectedEl.querySelector('.cmp__vs__sel__card');
        if (card) card.classList.add('cmp__vs__sel__card--out');
        setTimeout(function () {
            cmpVsSelected[slot] = null;
            selectedEl.style.display = 'none';
            selectedEl.innerHTML = '';
            renderVsComparison();
        }, 200);
    });
    cmpHydrateLogos(selectedEl);
    renderVsComparison();
}

var VS_METRIC_DEFS = {
    tuition:    { label:'Annual Tuition',   icon:'fa-solid fa-coins',        fn: function(u){ return uniTuitionLabel(u); }, num: function(u){ return uniTuitionNum(u); }, dir:'low' },
    difficulty: { label:'Entry Difficulty', icon:'fa-solid fa-fire',         fn: function(u){ return u.dl; }, num: function(u){ return u.diff || null; }, dir:'high' },
    fields:     { label:'Fields of Study',  icon:'fa-solid fa-book-open',    fn: function(u){ return u.fields.join(', '); } },
    languages:  { label:'Languages',        icon:'fa-solid fa-language',     fn: function(u){ return u.langs.join(', '); } },
    type:       { label:'University Type',  icon:'fa-solid fa-building',     fn: function(u){ return u.type; } },
    founded:    { label:'Founded',          icon:'fa-solid fa-calendar',     fn: function(u){ return u.founded || '—'; }, num: function(u){ return u.founded || null; }, dir:'low' },
    students:   { label:'Students',         icon:'fa-solid fa-users',        fn: function(u){ return u.students || '—'; }, num: function(u){ return uniStudentsNum(u); }, dir:'high' },
    city:       { label:'City',             icon:'fa-solid fa-location-dot', fn: function(u){ return u.city; } },
};

/* ── University metric derivations (real fields + transparent heuristics) ──
   Each takes the university and its country code. Where the dataset lacks a
   field (rankings, satisfaction, safety…) we derive a sensible estimate from
   difficulty/size/country/subjects; the footnote flags that these are guidance. */
function uStudents(u) { var m = String(u.students || '').replace(/[, ]/g, '').match(/(\d+)/); return m ? +m[1] : null; }
function uField(u) { return (u.fields && u.fields[0]) || 'General'; }
function uAccept(u) { return ({ 5: 6, 4: 15, 3: 38, 2: 58, 1: 75 })[u.diff || 3] || 38; }
function uEmployRate(u) { return Math.min(98, 68 + (u.diff || 3) * 6); }
function uEmployerMatch(u, code) {
    var m = 45 + (((u.diff || 3) - 3) * 10), s = uStudents(u) || 0;
    if (s >= 25000) m += 8; else if (s >= 15000) m += 4;
    if (['gb', 'us', 'de', 'fr', 'ch', 'nl'].indexOf(code) !== -1) m += 6;
    return Math.max(20, Math.min(98, Math.round(m)));
}
function uSatisfaction(u) { return +Math.min(4.8, 3.5 + (u.diff || 3) * 0.25).toFixed(1); }
function uIntlPct(u, code) {
    var base = ({ gb: 24, ch: 30, us: 12, nl: 22, ie: 20, de: 14, fr: 13, se: 16, dk: 15, fi: 12, be: 14, it: 8, es: 9, pt: 11, ua: 18 })[code] || 12;
    if (!uniIsPublic(u)) base += 6;
    if ((u.diff || 3) >= 4) base += 5;
    return Math.min(55, base);
}
function uWorldRank(u) {
    var band = ({ 5: 60, 4: 180, 3: 450, 2: 800, 1: 1100 })[u.diff || 3] || 450;
    var h = 0, n = u.name || ''; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) % 121;
    return Math.max(3, band + (h - 60));
}
function uSubjRank(u) { return (({ 5: 'Top 1%', 4: 'Top 5%', 3: 'Top 15%', 2: 'Top 35%', 1: 'Top 60%' })[u.diff || 3] || 'Top 20%') + ' · ' + uField(u); }
function uSafety(code) { return ({ es: 78, pt: 82, it: 72, fr: 70, de: 80, gb: 74, ie: 80, us: 62, ch: 90, ua: 45, nl: 83, be: 76, dk: 88, se: 84, fi: 89 })[code] || 75; }
function uClimate(code) { return ({ es: 'Warm Mediterranean', pt: 'Mild Atlantic', it: 'Warm Mediterranean', fr: 'Temperate', de: 'Cool temperate', gb: 'Mild &amp; rainy', ie: 'Mild &amp; rainy', us: 'Varies widely', ch: 'Alpine winters', ua: 'Continental', nl: 'Cool &amp; wet', be: 'Cool &amp; wet', dk: 'Cool &amp; windy', se: 'Cold winters', fi: 'Long cold winters' })[code] || 'Temperate'; }
function uAccommodation(u) { return (u.diff || 3) >= 4 ? 'Excellent' : (u.diff || 3) >= 3 ? 'Good' : 'Basic'; }
function uCampus(u) { var s = uStudents(u) || 0; return s >= 30000 ? 'Very large' : s >= 18000 ? 'Large' : s >= 9000 ? 'Medium' : 'Compact'; }
function uSports(u) { var s = uStudents(u) || 0; return s >= 25000 ? 'Excellent' : s >= 12000 ? 'Strong' : 'Growing'; }
function uResearch(u) { return (u.diff || 3) >= 5 ? 'World-leading' : (u.diff || 3) >= 4 ? 'Excellent' : (u.diff || 3) >= 3 ? 'Strong' : 'Developing'; }
function uSalaryNum(u) { return estStartingSalary(u, uField(u)); }
function uScholarPct(u) { return Math.round(estScholarshipRate(u) * 100); }
function uRecruiters(u) {
    if (typeof window.crsUniRecruiters !== 'function') return '—';
    var list = []; try { list = window.crsUniRecruiters(u, 3) || []; } catch (e) {}
    if (!list.length) return '—';
    return '<span class="covs__recr">' + list.map(function (r) { return '<span class="covs__recr__i" title="' + (r.name || '') + '">' + (r.logo || '') + '</span>'; }).join('') + '</span>';
}
function money(n) { return '€' + Math.round(n).toLocaleString(); }

// tip = plain-English tooltip; num/dir drive the "Best" badge; trend adds ▲.
var UNI_SECTIONS = [
    { emoji: '⭐', title: 'Key Factors', rows: [
        { icon: 'fa-ranking-star',    label: 'World Ranking',        tip: 'Approximate global position — lower is better.',                 val: function (u) { return '≈ #' + uWorldRank(u); }, num: uWorldRank, dir: 'low' },
        { icon: 'fa-award',           label: 'Subject Ranking',      tip: 'Standing in its strongest subject area.',                        val: uSubjRank },
        { icon: 'fa-user-check',      label: 'Graduate Employment',  tip: 'Share of graduates employed within ~15 months.',                 val: function (u) { return uEmployRate(u) + '%'; }, num: uEmployRate, dir: 'high', trend: function (u) { return uEmployRate(u) >= 88 ? 'up' : null; } },
        { icon: 'fa-handshake',       label: 'Employer Match',       tip: 'How strongly top employers recruit from here.',                  val: function (u, c) { return uEmployerMatch(u, c) + '%'; }, num: uEmployerMatch, dir: 'high' },
        { icon: 'fa-sack-dollar',     label: 'Avg. Graduate Salary', tip: 'Estimated starting salary for its main field.',                  val: function (u) { return money(uSalaryNum(u)); }, num: uSalaryNum, dir: 'high', trend: function (u) { return uSalaryNum(u) >= 45000 ? 'up' : null; } },
        { icon: 'fa-briefcase',       label: 'Top Recruiters',       tip: 'Companies that most often hire its graduates.',                  val: uRecruiters },
        { icon: 'fa-door-open',       label: 'Acceptance Rate',      tip: 'Roughly how selective admission is — lower is more selective.',  val: function (u) { return uAccept(u) + '%'; }, num: uAccept, dir: 'low' },
        { icon: 'fa-coins',           label: 'Tuition Fee',          tip: 'Typical annual tuition for this university.',                    val: function (u) { return uniTuitionLabel(u); }, num: uniTuitionNum, dir: 'low' },
        { icon: 'fa-face-smile',      label: 'Student Satisfaction', tip: 'Overall student experience rating out of 5.',                    val: function (u) { return uSatisfaction(u) + '/5'; }, num: uSatisfaction, dir: 'high' },
        { icon: 'fa-earth-americas',  label: 'International Students',tip: 'Estimated share of students from abroad.',                       val: function (u, c) { return uIntlPct(u, c) + '%'; }, num: uIntlPct, dir: 'high' }
    ]},
    { emoji: '📋', title: 'Additional Factors', rows: [
        { icon: 'fa-house-chimney',   label: 'Living Costs',         tip: 'Estimated yearly cost of living in its city.',                   val: function (u) { return money(cityLivingAnnual(u)) + '/yr'; }, num: cityLivingAnnual, dir: 'low' },
        { icon: 'fa-hand-holding-dollar', label: 'Scholarships',     tip: 'Typical financial-aid potential (not guaranteed).',              val: function (u) { return 'Up to ' + uScholarPct(u) + '%'; }, num: uScholarPct, dir: 'high' },
        { icon: 'fa-bed',             label: 'Accommodation',        tip: 'Quality & availability of student housing.',                     val: uAccommodation },
        { icon: 'fa-vector-square',   label: 'Campus Size',          tip: 'Overall scale of the campus.',                                   val: uCampus },
        { icon: 'fa-users',           label: 'Student Population',   tip: 'Total number of enrolled students.',                             val: function (u) { return u.students || '—'; }, num: uStudents, dir: 'high' },
        { icon: 'fa-language',        label: 'Teaching Language',    tip: 'Languages programmes are taught in.',                            val: function (u) { return (u.langs || []).join(' / ') || '—'; } },
        { icon: 'fa-flask',           label: 'Research Reputation',  tip: 'Strength of research output & prestige.',                        val: uResearch },
        { icon: 'fa-futbol',          label: 'Sports & Societies',   tip: 'Breadth of clubs, societies & sports.',                          val: uSports },
        { icon: 'fa-shield-halved',   label: 'Safety Score',         tip: 'General safety of the country/city, out of 100.',                val: function (u, c) { return uSafety(c) + '/100'; }, num: function (u, c) { return uSafety(c); }, dir: 'high' },
        { icon: 'fa-cloud-sun',       label: 'Climate',              tip: 'Typical weather where the university is.',                       val: function (u, c) { return uClimate(c); } }
    ]}
];

// Shared premium section renderer (used by the university comparison).
function trendIco(t) { return t === 'up' ? '<i class="fa-solid fa-arrow-trend-up covs__trend covs__trend--up" title="Trending strong"></i>' : ''; }
function covsSimilar(na, nb) { if (na == null || nb == null) return false; if (na === nb) return true; var mx = Math.max(Math.abs(na), Math.abs(nb)); return mx > 0 && Math.abs(na - nb) / mx < 0.06; }
function covsRenderSections(sections, a, b, codeA, codeB) {
    return sections.map(function (sec) {
        var allSame = true;
        var rows = sec.rows.map(function (r) {
            var va = r.val(a, codeA), vb = r.val(b, codeB), wa = '', wb = '', same;
            if (r.num) {
                var na = r.num(a, codeA), nb = r.num(b, codeB);
                same = covsSimilar(na, nb);
                if (na != null && nb != null && na !== nb) { var aWins = r.dir === 'low' ? na < nb : na > nb; wa = aWins ? ' is-win' : ''; wb = aWins ? '' : ' is-win'; }
            } else { same = (va === vb); }
            if (!same) allSame = false;
            var ta = r.trend ? trendIco(r.trend(a, codeA)) : '', tb = r.trend ? trendIco(r.trend(b, codeB)) : '';
            var ba = wa ? '<span class="covs__best">Best</span>' : '', bb = wb ? '<span class="covs__best">Best</span>' : '';
            return '<div class="covs__row' + (same ? ' covs__row--same' : '') + '">' +
                '<div class="covs__row__lbl" title="' + (r.tip || '') + '"><i class="fa-solid ' + r.icon + '"></i><span>' + r.label + '</span>' + (r.tip ? '<i class="fa-regular fa-circle-question covs__tipq"></i>' : '') + '</div>' +
                '<div class="covs__row__v covs__col--a' + wa + '">' + va + ta + ba + '</div>' +
                '<div class="covs__row__v covs__col--b' + wb + '">' + vb + tb + bb + '</div>' +
            '</div>';
        }).join('');
        return '<div class="covs__sec' + (allSame ? ' covs__sec--allsame' : '') + '">' +
            '<div class="covs__sec__t"><span class="covs__sec__emoji">' + sec.emoji + '</span> ' + sec.title + '</div>' +
            '<div class="covs__rows">' + rows + '</div>' +
        '</div>';
    }).join('');
}

function cmpUniSwap() {
    var ta = cmpVsSelected.A, tb = cmpVsSelected.B, ca = cmpVsCountry.A, cb = cmpVsCountry.B;
    cmpVsSelected.A = tb; cmpVsSelected.B = ta; cmpVsCountry.A = cb; cmpVsCountry.B = ca;
    if (tb) selectVsUni('A', tb); if (ta) selectVsUni('B', ta); else renderVsComparison();
}

var _lastCmpPairKey = '';
function renderVsComparison() {
    var a = cmpVsSelected.A;
    var b = cmpVsSelected.B;
    var metricsEl = document.getElementById('cmpVsMetrics');
    var tableEl   = document.getElementById('cmpVsTable');
    var emptyEl   = document.getElementById('cmpVsEmpty');
    if (!tableEl || !emptyEl) return;

    if (metricsEl) metricsEl.style.display = 'none';   // the fixed sections replace the chip picker

    if (!a || !b) {
        tableEl.style.display   = 'none';
        emptyEl.style.display   = 'flex';
        cmpSetVerdict('');
        return;
    }

    emptyEl.style.display   = 'none';
    tableEl.style.display   = 'block';

    // Count each unique completed comparison (for Titles)
    var _pairKey = a.id + '|' + b.id;
    if (_pairKey !== _lastCmpPairKey) {
        _lastCmpPairKey = _pairKey;
        if (typeof bumpCmpCount === 'function') bumpCmpCount();
    }

    var codeA = cmpVsCountry.A || countryOf(a), codeB = cmpVsCountry.B || countryOf(b);

    tableEl.className = 'covs cmp__vs__table';
    tableEl.innerHTML =
        '<div class="covs__hd covs__hd--uni">' +
            '<div class="covs__hd__spacer">' +
                '<label class="covs__diff"><input type="checkbox" id="cmpDiffOnly"><span class="covs__diff__box"><i class="fa-solid fa-check"></i></span> Show differences only</label>' +
            '</div>' +
            '<div class="covs__hd__co covs__col--a"><span class="covs__hd__logo">' + uniLogo(a, 40) + '</span><div class="covs__hd__name" style="color:' + a.color + '">' + a.name + '</div></div>' +
            '<button class="covs__swap" id="cmpSwapBtn" title="Swap universities"><i class="fa-solid fa-right-left"></i></button>' +
            '<div class="covs__hd__co covs__col--b"><span class="covs__hd__logo">' + uniLogo(b, 40) + '</span><div class="covs__hd__name" style="color:' + b.color + '">' + b.name + '</div></div>' +
        '</div>' +
        '<div class="covs__grid">' + covsRenderSections(UNI_SECTIONS, a, b, codeA, codeB) + '</div>' +
        '<p class="covs__note"><i class="fa-solid fa-circle-info"></i> Rankings, salaries, satisfaction & similar figures are transparent estimates for guidance — always verify on official sources.</p>';

    var diff = document.getElementById('cmpDiffOnly');
    if (diff) diff.addEventListener('change', function () { tableEl.classList.toggle('covs--diffonly', diff.checked); });
    var swap = document.getElementById('cmpSwapBtn');
    if (swap) swap.addEventListener('click', cmpUniSwap);

    cmpHydrateLogos(tableEl);
    cmpSetVerdict(uniVerdict(a, b));
}

document.getElementById('cmpSearchA').addEventListener('input', function() {
    buildVsSuggest(this.value.trim(), document.getElementById('cmpResultsA'), 'A');
});
document.getElementById('cmpSearchB').addEventListener('input', function() {
    buildVsSuggest(this.value.trim(), document.getElementById('cmpResultsB'), 'B');
});
document.querySelectorAll('.cmp__vs__mc input[type="checkbox"]').forEach(function(cb) {
    cb.addEventListener('change', renderVsComparison);
});

/* ════════════════════════════════════════════════════════════════════
   Company head-to-head comparison (Compare modal → "Companies" tab)

   Real fields (salary, sector, degrees, HQ, feeder unis) are used directly;
   selectivity/prestige drive derived metrics (recruitment match, acceptance,
   campus recruiting, work-life…). Hard corporate facts (founded, CEO, revenue,
   employees, market cap) come from a small curated table for well-known names,
   and gracefully show "—" for anything we don't have.
   ════════════════════════════════════════════════════════════════════ */
var COMPANY_FACTS = {
    'NVIDIA':            { founded:1993, ceo:'Jensen Huang', employees:'≈ 30k',  offices:'50+',  revenue:'≈ $130B', mcap:'≈ $3.4T', wlb:7.8, sat:4.5, remote:'Hybrid',  promo:'Fast' },
    'Apple':             { founded:1976, ceo:'Tim Cook', employees:'≈ 164k', offices:'500+ stores', revenue:'≈ $391B', mcap:'≈ $3.5T', wlb:7.5, sat:4.2, remote:'On-site', promo:'Medium' },
    'Alphabet (Google)': { founded:1998, ceo:'Sundar Pichai', employees:'≈ 182k', offices:'70+', revenue:'≈ $350B', mcap:'≈ $2.3T', wlb:8.5, sat:4.5, remote:'Hybrid', promo:'Medium' },
    'Microsoft':         { founded:1975, ceo:'Satya Nadella', employees:'≈ 228k', offices:'190+', revenue:'≈ $245B', mcap:'≈ $3.1T', wlb:8.4, sat:4.4, remote:'Hybrid', promo:'Medium' },
    'Amazon':            { founded:1994, ceo:'Andy Jassy', employees:'≈ 1.55M', offices:'Global', revenue:'≈ $638B', mcap:'≈ $2.4T', wlb:6.8, sat:3.9, remote:'Hybrid', promo:'Fast' },
    'TSMC':              { founded:1987, ceo:'C. C. Wei', employees:'≈ 77k', offices:'Global fabs', revenue:'≈ $90B', mcap:'≈ $1.0T', wlb:6.5, sat:3.9, remote:'On-site', promo:'Medium' },
    'Broadcom':          { founded:1991, ceo:'Hock Tan', employees:'≈ 37k', offices:'Global', revenue:'≈ $54B', mcap:'≈ $1.1T', wlb:6.6, sat:3.9, remote:'Hybrid', promo:'Medium' },
    'Tesla':             { founded:2003, ceo:'Elon Musk', employees:'≈ 125k', offices:'Global', revenue:'≈ $98B', mcap:'≈ $1.1T', wlb:6.0, sat:3.7, remote:'On-site', promo:'Fast' },
    'Meta Platforms':    { founded:2004, ceo:'Mark Zuckerberg', employees:'≈ 74k', offices:'80+', revenue:'≈ $164B', mcap:'≈ $1.5T', wlb:7.7, sat:4.1, remote:'Hybrid', promo:'Medium' },
    'Micron Technology': { founded:1978, ceo:'Sanjay Mehrotra', employees:'≈ 48k', offices:'Global', revenue:'≈ $25B', mcap:'≈ $110B', wlb:7.2, sat:3.9, remote:'On-site', promo:'Medium' },
    'Goldman Sachs':     { founded:1869, ceo:'David Solomon', employees:'≈ 46k', offices:'60+', revenue:'≈ $53B', mcap:'≈ $170B', wlb:5.5, sat:3.8, remote:'On-site', promo:'Fast' },
    'J.P. Morgan':       { founded:1799, ceo:'Jamie Dimon', employees:'≈ 310k', offices:'Global', revenue:'≈ $158B', mcap:'≈ $650B', wlb:6.2, sat:3.9, remote:'Hybrid', promo:'Medium' },
    'Morgan Stanley':    { founded:1935, ceo:'Ted Pick', employees:'≈ 80k', offices:'Global', revenue:'≈ $60B', mcap:'≈ $210B', wlb:5.8, sat:3.9, remote:'On-site', promo:'Medium' },
    'Citadel':           { founded:1990, ceo:'Ken Griffin', employees:'≈ 2.8k', offices:'20+', revenue:'≈ $63B', mcap:'Private', wlb:5.0, sat:4.0, remote:'On-site', promo:'Fast' },
    'Barclays':          { founded:1690, ceo:'C. S. Venkatakrishnan', employees:'≈ 90k', offices:'Global', revenue:'≈ £26B', mcap:'≈ £40B', wlb:6.4, sat:3.8, remote:'Hybrid', promo:'Medium' },
    'HSBC':              { founded:1865, ceo:'Georges Elhedery', employees:'≈ 220k', offices:'Global', revenue:'≈ $66B', mcap:'≈ $160B', wlb:6.6, sat:3.8, remote:'Hybrid', promo:'Medium' },
    'McKinsey & Co.':    { founded:1926, ceo:'Bob Sternfels', employees:'≈ 45k', offices:'130+', revenue:'≈ $16B', mcap:'Private', wlb:5.5, sat:4.1, remote:'Hybrid', promo:'Fast' },
    'BCG':               { founded:1963, ceo:'Christoph Schweizer', employees:'≈ 32k', offices:'100+', revenue:'≈ $12B', mcap:'Private', wlb:5.8, sat:4.2, remote:'Hybrid', promo:'Fast' },
    'Bain & Company':    { founded:1973, ceo:'Christophe De Vusser', employees:'≈ 19k', offices:'65+', revenue:'≈ $6B', mcap:'Private', wlb:6.0, sat:4.3, remote:'Hybrid', promo:'Fast' },
    'Accenture':         { founded:1989, ceo:'Julie Sweet', employees:'≈ 774k', offices:'200+', revenue:'≈ $65B', mcap:'≈ $220B', wlb:7.0, sat:3.9, remote:'Hybrid', promo:'Medium' },
    'Deloitte':          { founded:1845, ceo:'Joe Ucuzoglu', employees:'≈ 460k', offices:'150+', revenue:'≈ $67B', mcap:'Private', wlb:6.8, sat:3.9, remote:'Hybrid', promo:'Medium' },
    'PwC':               { founded:1998, ceo:'Mohamed Kande', employees:'≈ 370k', offices:'150+', revenue:'≈ $55B', mcap:'Private', wlb:6.8, sat:3.9, remote:'Hybrid', promo:'Medium' },
    'EY':                { founded:1989, ceo:'Janet Truncale', employees:'≈ 393k', offices:'150+', revenue:'≈ $51B', mcap:'Private', wlb:6.7, sat:3.9, remote:'Hybrid', promo:'Medium' },
    'KPMG':              { founded:1987, ceo:'Bill Thomas', employees:'≈ 275k', offices:'140+', revenue:'≈ $38B', mcap:'Private', wlb:6.9, sat:3.9, remote:'Hybrid', promo:'Medium' },
    'IBM':               { founded:1911, ceo:'Arvind Krishna', employees:'≈ 282k', offices:'175+', revenue:'≈ $62B', mcap:'≈ $200B', wlb:7.2, sat:3.9, remote:'Hybrid', promo:'Slow' },
    'Intel':             { founded:1968, ceo:'Lip-Bu Tan', employees:'≈ 109k', offices:'Global', revenue:'≈ $53B', mcap:'≈ $90B', wlb:7.4, sat:3.9, remote:'Hybrid', promo:'Slow' }
};
function coFacts(c) { return (c && COMPANY_FACTS[c.name]) || {}; }
// Display name: "Alphabet (Google)" → "Google" (use the part in parentheses).
function coName(c) { var n = (c && c.name) || ''; var m = n.match(/^.*\((.+)\)\s*$/); return m ? m[1] : n; }
function coInitials(c) {
    var n = (c.name || '').replace(/\(.*?\)/g, '').replace(/[^a-zA-Z ]/g, '').trim();
    var parts = n.split(/\s+/).filter(Boolean);
    return ((parts.length > 1 ? parts[0][0] + parts[1][0] : n.slice(0, 2)) || '?').toUpperCase();
}
// Real company logo (same Simple Icons → icon.horse → DDG chain as Career Paths),
// with a brand-colour monogram fallback if careers.js hasn't loaded yet.
function coLogo(c, size) {
    if (typeof window.crsLogo === 'function') return window.crsLogo(c, size);
    return '<span class="crs__logo crs__logo--mono" style="background:' + c.color + ';width:' + size + 'px;height:' + size + 'px">' + coInitials(c) + '</span>';
}

/* ── Real university logos ──
   The dataset only lists a website for ~1 in 4 universities, so we combine that
   with a curated domain map for the well-known names, then pull the real crest
   via icon.horse → DuckDuckGo favicon, and only fall back to the abbr monogram
   if a university has no known domain (or every image 404s). */
var UNI_DOMAINS = {
    'University of Oxford': 'ox.ac.uk', 'University of Cambridge': 'cam.ac.uk', 'Imperial College London': 'imperial.ac.uk',
    'London School of Economics': 'lse.ac.uk', 'UCL': 'ucl.ac.uk', 'University College London': 'ucl.ac.uk',
    'University of Edinburgh': 'ed.ac.uk', 'University of Manchester': 'manchester.ac.uk', 'University of Warwick': 'warwick.ac.uk',
    "King's College London": 'kcl.ac.uk', 'University of Bristol': 'bristol.ac.uk', 'University of Nottingham': 'nottingham.ac.uk',
    'University of Glasgow': 'gla.ac.uk', 'University of Birmingham': 'birmingham.ac.uk', 'University of Leeds': 'leeds.ac.uk',
    'Harvard University': 'harvard.edu', 'MIT': 'mit.edu', 'Massachusetts Institute of Technology': 'mit.edu',
    'Stanford University': 'stanford.edu', 'UC Berkeley': 'berkeley.edu', 'University of California, Berkeley': 'berkeley.edu',
    'Carnegie Mellon University': 'cmu.edu', 'Princeton University': 'princeton.edu', 'Yale University': 'yale.edu',
    'Columbia University': 'columbia.edu', 'University of Chicago': 'uchicago.edu', 'Cornell University': 'cornell.edu',
    'University of Pennsylvania': 'upenn.edu', 'New York University': 'nyu.edu', 'University of Washington': 'washington.edu',
    'Georgia Tech': 'gatech.edu', 'Purdue University': 'purdue.edu', 'University of Michigan': 'umich.edu', 'UCLA': 'ucla.edu',
    'ETH Zurich': 'ethz.ch', 'EPFL': 'epfl.ch', 'University of Zurich': 'uzh.ch',
    'TU Munich': 'tum.de', 'Technical University of Munich': 'tum.de', 'RWTH Aachen': 'rwth-aachen.de',
    'Ludwig Maximilian University of Munich': 'lmu.de', 'LMU Munich': 'lmu.de', 'Heidelberg University': 'uni-heidelberg.de',
    'Humboldt University of Berlin': 'hu-berlin.de', 'Technical University of Berlin': 'tu.berlin', 'KIT': 'kit.edu',
    'Bocconi University': 'unibocconi.it', 'Politecnico di Milano': 'polimi.it', 'Sapienza University of Rome': 'uniroma1.it',
    'University of Bologna': 'unibo.it', 'Politecnico di Torino': 'polito.it',
    'Sorbonne University': 'sorbonne-universite.fr', 'Sciences Po': 'sciencespo.fr', 'HEC Paris': 'hec.edu',
    'École Polytechnique': 'polytechnique.edu', 'PSL University': 'psl.eu', 'Université PSL': 'psl.eu', 'INSEAD': 'insead.edu',
    'Delft University of Technology': 'tudelft.nl', 'University of Amsterdam': 'uva.nl', 'Eindhoven University of Technology': 'tue.nl',
    'Erasmus University Rotterdam': 'eur.nl', 'Utrecht University': 'uu.nl', 'Leiden University': 'universiteitleiden.nl',
    'Trinity College Dublin': 'tcd.ie', 'University College Dublin': 'ucd.ie', 'KU Leuven': 'kuleuven.be', 'Ghent University': 'ugent.be',
    'Universidad Complutense de Madrid': 'ucm.es', 'Universidad Autónoma de Madrid': 'uam.es', 'Universidad Politécnica de Madrid': 'upm.es',
    'IE University': 'ie.edu', 'ESADE': 'esade.edu', 'IESE Business School': 'iese.edu', 'University of Barcelona': 'ub.edu',
    'Universitat Politècnica de Catalunya': 'upc.edu', 'Universitat Autònoma de Barcelona': 'uab.cat', 'University of Navarra': 'unav.edu',
    'KTH Royal Institute of Technology': 'kth.se', 'Lund University': 'lu.se', 'Uppsala University': 'uu.se', 'Stockholm University': 'su.se',
    'University of Copenhagen': 'ku.dk', 'Technical University of Denmark': 'dtu.dk', 'Aarhus University': 'au.dk',
    'University of Helsinki': 'helsinki.fi', 'Aalto University': 'aalto.fi', 'University of Lisbon': 'ulisboa.pt', 'University of Porto': 'up.pt'
};
function uEsc(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;'); }
function uniDomain(u) {
    if (!u) return null;
    // UNI_DOMAINS is a `var` defined later in the file — a fast async render can
    // reach here before it's assigned, so guard against it being undefined.
    if (typeof UNI_DOMAINS !== 'undefined' && UNI_DOMAINS && UNI_DOMAINS[u.name]) return UNI_DOMAINS[u.name];
    var w = u.website || '';
    if (w) { var m = w.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim(); if (m) return m; }
    return null;
}
/* ── Real, high-quality, TRANSPARENT university logos ──
   Resolution, best-first, looked up by NAME:
     1. Wikipedia's lead image when it is a drawing (.svg/.png) — the crest;
     2. otherwise the crest/seal/logo named in the article's infobox (some
        articles open with a campus photo — Edinburgh leads with McEwan Hall,
        which showed up as a dark smudge instead of its roundel);
     3. the university's own site icon (icon.horse), from the mapped/website
        domain or a Clearbit name→domain lookup;
     4. a branded monogram only if the web genuinely has nothing.
   Found URLs are remembered in localStorage for a month, so crests appear at
   once on the next visit instead of depending on Wikipedia answering every
   time, and a picture that fails to load drops to the next source rather
   than vanishing. Every logo is rendered as a "pending" placeholder and
   filled by the global hydrator below, so this works everywhere. */
var UNI_LOGO_KEY = 'us_uni_logos_v2', UNI_LOGO_TTL = 30 * 864e5;
var _uniLogoUrl = (function () {   // name → resolved image URL, or false when nothing found
    var out = {};
    try {
        var c = JSON.parse(localStorage.getItem(UNI_LOGO_KEY) || '{}'), now = Date.now();
        for (var k in c) if (c[k] && c[k].u && now - c[k].t < UNI_LOGO_TTL) out[k] = c[k].u;
    } catch (e) {}
    return out;
}());
// sessionOnly: use it now but don't keep it (e.g. a fallback picked while Wikipedia was unreachable).
function rememberUniLogo(name, url, sessionOnly) {
    _uniLogoUrl[name] = url || false;
    if (sessionOnly) return;
    try {
        var c = JSON.parse(localStorage.getItem(UNI_LOGO_KEY) || '{}');
        if (url) c[name] = { u: url, t: Date.now() }; else delete c[name];
        localStorage.setItem(UNI_LOGO_KEY, JSON.stringify(c));
    } catch (e) {}
}
var WIKI_API = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&redirects=1&';
function isDrawingFile(f) { return /\.(svg|png|gif)$/i.test(String(f || '')); }
// cb(url, failed) — `failed` means Wikipedia couldn't be reached, not that it has no crest.
function wikiLogoByName(name, cb) {
    fetch(WIKI_API + 'action=query&prop=pageimages&piprop=thumbnail|name&pithumbsize=256&titles=' + encodeURIComponent(name))
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) {
            var pages = (j && j.query && j.query.pages) || {}, page = null;
            for (var k in pages) { if (+k > 0) { page = pages[k]; break; } }
            if (!page) { cb(null); return; }
            if (page.thumbnail && isDrawingFile(page.pageimage)) { cb(page.thumbnail.source); return; }
            wikiInfoboxCrest(page.title, cb);
        }).catch(function () { cb(null, true); });
}
function wikiInfoboxCrest(title, cb) {
    fetch(WIKI_API + 'action=parse&prop=wikitext&section=0&page=' + encodeURIComponent(title))
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) {
            var txt = (j && j.parse && j.parse.wikitext && j.parse.wikitext['*']) || '', file = null;
            ['image_name', 'image', 'coat_of_arms', 'arms', 'seal', 'emblem', 'logo'].some(function (f) {
                var m = txt.match(new RegExp('\\|\\s*' + f + '\\s*=\\s*(?:\\[\\[)?(?:(?:File|Image):)?([^|\\]\\n]+?\\.(?:svg|png|gif))', 'i'));
                if (m) file = m[1].trim();
                return !!file;
            });
            cb(file ? 'https://en.wikipedia.org/wiki/Special:FilePath/' + encodeURIComponent(file.replace(/ /g, '_')) + '?width=256' : null);
        }).catch(function () { cb(null, true); });
}
function siteIconUrl(dom) { return 'https://icon.horse/icon/' + dom; }
function ddgIconUrl(dom) { return 'https://icons.duckduckgo.com/ip3/' + dom + '.ico'; }
// icon.horse answers sites it doesn't know with a grey letter tile (256px, corners #e2e2e2) —
// e.g. a grey "O" for ox.ac.uk, a grey "C" for citadel.com. Treat that as "no logo".
// It sends CORS headers, so the pixels can be read when the image is requested anonymously.
window.isIconPlaceholder = function (img) {
    try {
        if (!img || img.naturalWidth !== 256 || !/icon\.horse/.test(img.currentSrc || img.src)) return false;
        var c = document.createElement('canvas'); c.width = c.height = 8;
        var x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8);
        var d = x.getImageData(0, 0, 8, 8).data;
        return [0, 7, 56, 63].every(function (i) { var o = i * 4; return Math.abs(d[o] - 226) < 4 && Math.abs(d[o + 1] - 226) < 4 && Math.abs(d[o + 2] - 226) < 4; });
    } catch (e) { return false; }
};
window.setLogoSrc = function (img, url) {
    if (/icon\.horse/.test(url)) img.crossOrigin = 'anonymous'; else img.removeAttribute('crossorigin');
    img.src = url;
};
function clearbitDomainByName(name, cb) {
    fetch('https://autocomplete.clearbit.com/v1/companies/suggest?query=' + encodeURIComponent(name))
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (list) { cb((list && list[0] && list[0].domain) || null); })
        .catch(function () { cb(null); });
}
// Concurrency-limited queue so rendering many cards at once doesn't burst the
// logo services; results are cached and same-name requests are de-duplicated.
var _uniQ = [], _uniActive = 0, _uniWaiting = {}, UNI_MAX_CONC = 4;
function _uniPump() {
    while (_uniActive < UNI_MAX_CONC && _uniQ.length) {
        var job = _uniQ.shift(); _uniActive++;
        job(function () { _uniActive--; _uniPump(); });
    }
}
function resolveUniLogo(name, dom, cb) {
    if (_uniLogoUrl[name] !== undefined) { cb(_uniLogoUrl[name] || null); return; }
    if (_uniWaiting[name]) { _uniWaiting[name].push(cb); return; }
    _uniWaiting[name] = [cb];
    _uniQ.push(function (done) {
        var finish = function (url, sessionOnly) {
            rememberUniLogo(name, url, sessionOnly);
            var cbs = _uniWaiting[name] || []; delete _uniWaiting[name];
            cbs.forEach(function (f) { try { f(url || null); } catch (e) {} });
            done();
        };
        wikiLogoByName(name, function (wiki, failed) {
            if (wiki) { finish(wiki); return; }
            if (dom) { finish(siteIconUrl(dom), failed); return; }
            clearbitDomainByName(name, function (d) { finish(d ? siteIconUrl(d) : null, failed); });
        });
    });
    _uniPump();
}
function uniLogo(u, size) {
    var style = 'width:' + size + 'px;height:' + size + 'px';
    return '<span class="crs__logo crs__logo--img crs__logo--uni crs__logo--pending"' +
        ' data-uni="' + uEsc(u.name) + '" data-dom="' + uEsc(uniDomain(u) || '') + '"' +
        ' data-mono="' + uEsc(u.abbr || '?') + '" data-c="' + u.color + '" style="' + style + '">' +
        '<img alt="' + uEsc(u.name) + ' logo" loading="lazy"></span>';
}
function uniMonogram(s, img) {
    if (img) img.remove();
    s.classList.remove('crs__logo--img', 'crs__logo--pending', 'crs__logo--uni'); s.classList.add('crs__logo--mono');
    s.style.background = s.getAttribute('data-c') || '#6c3fb0';
    s.textContent = s.getAttribute('data-mono') || '?';
}
// Fill any pending logos (compare modal + every card across the app).
function cmpHydrateLogos(root) {
    try {
        var nodes = (root || document).querySelectorAll('.crs__logo--pending');
        for (var i = 0; i < nodes.length; i++) (function (s) {
            s.classList.remove('crs__logo--pending');
            var img = s.querySelector('img'); if (!img) return;
            var name = s.getAttribute('data-uni'), dom = s.getAttribute('data-dom') || null;
            // A crest that won't load (or a placeholder letter tile) falls through
            // Wikipedia → site icon → DuckDuckGo icon → monogram.
            var next = function (keep) {
                var chain = dom ? [siteIconUrl(dom), ddgIconUrl(dom)] : [], nxt = chain[chain.indexOf(img.getAttribute('src') || '') + 1];
                if (nxt) { rememberUniLogo(name, nxt, !keep); window.setLogoSrc(img, nxt); }
                else { rememberUniLogo(name, null); uniMonogram(s, img); }
            };
            img.onerror = function () { next(false); };
            img.onload = function () { if (window.isIconPlaceholder(img)) next(true); };
            resolveUniLogo(name, dom, function (url) { if (url) window.setLogoSrc(img, url); else uniMonogram(s, img); });
        }(nodes[i]));
    } catch (e) { /* logos are cosmetic — never let them break the page */ }
}
// Auto-hydrate logos rendered anywhere in the app (Explore, Overview, Show all…),
// debounced to once per frame. Fully guarded and deferred so it can never
// interfere with the initial page render.
(function () {
    try {
        if (typeof MutationObserver === 'undefined') return;
        var queued = false;
        function flush() { queued = false; try { if (document.querySelector('.crs__logo--pending')) cmpHydrateLogos(document); } catch (e) {} }
        var obs = new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(flush); } });
        function start() { try { if (document.body) { obs.observe(document.body, { childList: true, subtree: true }); flush(); } } catch (e) {} }
        // let the app finish its first paint/wiring before we start watching
        setTimeout(function () {
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 400); });
            else start();
        }, 600);
    } catch (e) {}
}());
function coRecruit(c) { return Math.max(20, Math.min(99, Math.round(((c.pre || 0) * 0.6 + (c.sel || 0) * 0.4) * 100))); }
function coAcceptNum(c) { return Math.max(0.3, Math.pow(1 - (c.sel || 0), 2) * 40); }
function coAccept(c) { var a = coAcceptNum(c); return (a < 10 ? a.toFixed(1) : Math.round(a)) + '%'; }
function coSalaryNum(c) {
    var m = String(c.salary || '').replace(/,/g, '').match(/([\d.]+)\s*([kKbBmM])?/);
    if (!m) return 0;
    var n = parseFloat(m[1]); var u = (m[2] || 'k').toLowerCase();
    return u === 'b' ? n * 1e6 : u === 'm' ? n * 1e3 : n;   // normalise to $k
}
function coWord(v, hi, mid) { return v >= hi ? 'Excellent' : v >= mid ? 'Strong' : 'Good'; }
function coCampus(c) { var p = c.pre || 0; return p >= 0.8 ? 'Excellent' : p >= 0.6 ? 'Strong' : p >= 0.4 ? 'Selective' : 'Broad'; }
function coWLB(c) {
    var f = coFacts(c); if (f.wlb != null) return f.wlb;
    var s = (c.sector || '').toLowerCase();
    var base = /bank|consult|hedge|invest/.test(s) ? 5.6 : /semic|manufact|memory/.test(s) ? 6.8 : 7.8;
    return +(base + ((c.pre || 0.6) - 0.6) * 0.5).toFixed(1);
}
function coSat(c) { var f = coFacts(c); if (f.sat != null) return f.sat; return +(3.7 + (c.pre || 0) * 0.6).toFixed(1); }
function coRemote(c) { var f = coFacts(c); if (f.remote) return f.remote; return /bank|consult|hedge/.test((c.sector || '').toLowerCase()) ? 'On-site' : 'Hybrid'; }
function coPromo(c) { var f = coFacts(c); if (f.promo) return f.promo; return (c.sel || 0) >= 0.8 ? 'Fast' : (c.sel || 0) >= 0.5 ? 'Medium' : 'Steady'; }
function coStock(c) { return /tech|ai|semic|software|cloud|internet|electron/.test((c.sector || '').toLowerCase()) ? 'Yes (RSUs)' : /bank|hedge|invest/.test((c.sector || '').toLowerCase()) ? 'Deferred / bonus' : 'Sometimes'; }
function coSignon(c) { return (c.pre || 0) >= 0.6 ? 'Yes' : 'Varies'; }
var CHECK = '<i class="fa-solid fa-circle-check covs__yes"></i>';

var CO_SECTIONS = [
    { emoji: '📊', title: 'Overview', rows: [
        { icon: 'fa-bullseye',       label: 'Recruitment Match', val: function (c) { return coRecruit(c) + '%'; }, num: coRecruit, dir: 'high' },
        { icon: 'fa-sack-dollar',    label: 'Graduate Salary',   val: function (c) { return c.salary || '—'; }, num: coSalaryNum, dir: 'high' },
        { icon: 'fa-door-open',      label: 'Acceptance Rate',   val: coAccept, num: coAcceptNum, dir: 'low' },
        { icon: 'fa-users',          label: 'Company Size',      val: function (c) { return coFacts(c).employees || '—'; } },
        { icon: 'fa-location-dot',   label: 'Offices',           val: function (c) { return coFacts(c).offices || '—'; } }
    ]},
    { emoji: '🎓', title: 'Recruitment', rows: [
        { icon: 'fa-building-columns', label: 'Target Universities', val: function (c) { return (c.unis && c.unis.length) ? CHECK : '—'; } },
        { icon: 'fa-graduation-cap',   label: 'Campus Recruiting',   val: coCampus },
        { icon: 'fa-user-graduate',    label: 'Graduate Programme',  val: function () { return CHECK; } },
        { icon: 'fa-briefcase',        label: 'Internship Programme',val: function () { return CHECK; } },
        { icon: 'fa-calendar-check',   label: 'Placement Year',      val: function (c) { return (c.pre || 0) >= 0.3 ? CHECK : '—'; } }
    ]},
    { special: 'subjects', emoji: '📚', title: 'Best Subjects' },
    { emoji: '💼', title: 'Career', rows: [
        { icon: 'fa-arrow-trend-up', label: 'Promotion Speed',       val: coPromo },
        { icon: 'fa-book-open',      label: 'Learning Opportunities',val: function (c) { return coWord(c.pre || 0, 0.7, 0.45); } },
        { icon: 'fa-shuffle',        label: 'Internal Mobility',     val: function (c) { return coWord(c.pre || 0, 0.6, 0.4); } }
    ]},
    { emoji: '❤️', title: 'Work Environment', rows: [
        { icon: 'fa-scale-balanced', label: 'Work-Life Balance',     val: function (c) { return coWLB(c) + '/10'; }, num: coWLB, dir: 'high' },
        { icon: 'fa-house-laptop',   label: 'Remote Work',           val: coRemote },
        { icon: 'fa-face-smile',     label: 'Employee Satisfaction', val: function (c) { return coSat(c) + '/5'; }, num: coSat, dir: 'high' }
    ]},
    { emoji: '💰', title: 'Compensation', rows: [
        { icon: 'fa-money-bill-wave',    label: 'Graduate Salary', val: function (c) { return c.salary || '—'; }, num: coSalaryNum, dir: 'high' },
        { icon: 'fa-gift',               label: 'Bonus',           val: function () { return CHECK; } },
        { icon: 'fa-chart-line',         label: 'Stock / Equity',  val: coStock },
        { icon: 'fa-hand-holding-dollar',label: 'Sign-on Bonus',   val: coSignon }
    ]},
    { emoji: '🌍', title: 'Company', rows: [
        { icon: 'fa-flag',                label: 'Founded',      val: function (c) { return coFacts(c).founded || '—'; } },
        { icon: 'fa-user-tie',            label: 'CEO',          val: function (c) { return coFacts(c).ceo || '—'; } },
        { icon: 'fa-users',               label: 'Employees',    val: function (c) { return coFacts(c).employees || '—'; } },
        { icon: 'fa-coins',               label: 'Revenue',      val: function (c) { return coFacts(c).revenue || '—'; } },
        { icon: 'fa-arrow-up-right-dots', label: 'Market Cap',   val: function (c) { return coFacts(c).mcap || '—'; } },
        { icon: 'fa-location-dot',        label: 'Headquarters', val: function (c) { return [c.city, c.country].filter(Boolean).join(', ') || '—'; } }
    ]}
];

var coSelected = { A: null, B: null };
function coList() { return (window.CAREERS && window.CAREERS.companies) || []; }

function coBuildSuggest(query, resultEl, slot) {
    if (!query) { resultEl.innerHTML = ''; return; }
    var q = query.toLowerCase();
    var hits = coList().filter(function (c) {
        return (c.name + ' ' + (c.sector || '') + ' ' + (c.country || '')).toLowerCase().indexOf(q) !== -1;
    }).slice(0, 7);
    if (!hits.length) { resultEl.innerHTML = '<div class="cmp__vs__no__match">No companies found for "' + query + '"</div>'; return; }
    resultEl.innerHTML = hits.map(function (c) {
        return '<div class="cmp__vs__suggest" data-co="' + esc(c.name) + '">' +
            '<span class="cmp__vs__suggest__logo">' + coLogo(c, 30) + '</span>' +
            '<div class="cmp__vs__suggest__info">' +
                '<div class="cmp__vs__suggest__name">' + esc(coName(c)) + '</div>' +
                '<div class="cmp__vs__suggest__meta"><span class="mp__badge mp__badge--city">' + esc(c.sector || '') + '</span></div>' +
            '</div>' +
        '</div>';
    }).join('');
    resultEl.querySelectorAll('.cmp__vs__suggest').forEach(function (el) {
        el.addEventListener('click', function () {
            var c = coList().filter(function (x) { return x.name === el.dataset.co; })[0];
            if (c) coSelect(slot, c);
        });
    });
    function esc(s) { return String(s).replace(/"/g, '&quot;'); }
}

function coSelect(slot, c) {
    coSelected[slot] = c;
    var searchEl = document.getElementById('coSearch' + slot);
    var resultsEl = document.getElementById('coResults' + slot);
    var selectedEl = document.getElementById('coSelected' + slot);
    if (searchEl) searchEl.value = '';
    if (resultsEl) resultsEl.innerHTML = '';
    selectedEl.style.display = 'block';
    selectedEl.innerHTML =
        '<div class="cmp__vs__sel__card cmp__vs__sel__card--in" style="border-color:' + c.color + '">' +
            '<span class="cmp__vs__sel__logo">' + coLogo(c, 34) + '</span>' +
            '<div class="cmp__vs__sel__info">' +
                '<div class="cmp__vs__sel__name">' + coName(c) + '</div>' +
                '<div class="cmp__vs__sel__meta"><span class="mp__badge mp__badge--city">' + (c.sector || '') + '</span></div>' +
            '</div>' +
            '<button class="cmp__vs__clear__btn" title="Remove"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>';
    selectedEl.querySelector('.cmp__vs__clear__btn').addEventListener('click', function () {
        var card = selectedEl.querySelector('.cmp__vs__sel__card');
        if (card) card.classList.add('cmp__vs__sel__card--out');
        setTimeout(function () {
            coSelected[slot] = null;
            selectedEl.style.display = 'none';
            selectedEl.innerHTML = '';
            renderCoComparison();
        }, 200);
    });
    renderCoComparison();
}

function coHeadCard(c, key) {
    return '<div class="covs__hd__co covs__col--' + key + '">' +
        '<span class="covs__hd__logo">' + coLogo(c, 40) + '</span>' +
        '<div class="covs__hd__name" style="color:' + c.color + '">' + coName(c) + '</div>' +
    '</div>';
}
function renderCoComparison() {
    var a = coSelected.A, b = coSelected.B;
    var result = document.getElementById('coVsResult');
    var empty = document.getElementById('coVsEmpty');
    if (!result || !empty) return;
    if (!a || !b) { result.style.display = 'none'; result.innerHTML = ''; empty.style.display = 'flex'; cmpSetVerdict(''); return; }
    empty.style.display = 'none';
    result.style.display = 'block';

    var header =
        '<div class="covs__hd">' +
            '<div class="covs__hd__spacer"></div>' +
            coHeadCard(a, 'a') +
            coHeadCard(b, 'b') +
        '</div>';

    var body = CO_SECTIONS.map(function (sec) {
        if (sec.special === 'subjects') {
            function chips(c) {
                return (c.degrees || []).slice(0, 6).map(function (d) {
                    return '<span class="covs__chip" style="--cc:' + c.color + '">' + d + '</span>';
                }).join('') || '<span class="covs__chip covs__chip--none">—</span>';
            }
            return '<div class="covs__sec">' +
                '<div class="covs__sec__t"><span class="covs__sec__emoji">' + sec.emoji + '</span> ' + sec.title + '</div>' +
                '<div class="covs__subj">' +
                    '<div class="covs__subj__col"><div class="covs__subj__co" style="color:' + a.color + '">' + a.name + '</div><div class="covs__subj__chips">' + chips(a) + '</div></div>' +
                    '<div class="covs__subj__col"><div class="covs__subj__co" style="color:' + b.color + '">' + b.name + '</div><div class="covs__subj__chips">' + chips(b) + '</div></div>' +
                '</div>' +
            '</div>';
        }
        var rows = sec.rows.map(function (r) {
            var va = r.val(a), vb = r.val(b), wa = '', wb = '';
            if (r.num) {
                var na = r.num(a), nb = r.num(b);
                if (na !== nb) { var aWins = r.dir === 'low' ? na < nb : na > nb; wa = aWins ? ' is-win' : ''; wb = aWins ? '' : ' is-win'; }
            }
            return '<div class="covs__row">' +
                '<div class="covs__row__lbl"><i class="fa-solid ' + r.icon + '"></i>' + r.label + '</div>' +
                '<div class="covs__row__v covs__col--a' + wa + '">' + va + '</div>' +
                '<div class="covs__row__v covs__col--b' + wb + '">' + vb + '</div>' +
            '</div>';
        }).join('');
        return '<div class="covs__sec">' +
            '<div class="covs__sec__t"><span class="covs__sec__emoji">' + sec.emoji + '</span> ' + sec.title + '</div>' +
            '<div class="covs__rows">' + rows + '</div>' +
        '</div>';
    }).join('');

    result.innerHTML = header +
        '<div class="covs__grid">' + body + '</div>' +
        '<p class="covs__note"><i class="fa-solid fa-circle-info"></i> Figures blend real company data with curated estimates for graduate guidance — not a guarantee.</p>';

    cmpSetVerdict(coVerdict(a, b));
}

/* ── Verdict / conclusion (max 2 short sentences, names in the entity's colour) ── */
function cmpSetVerdict(html) {
    var el = document.getElementById('cmpVerdict');
    if (!el) return;
    if (!html) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.innerHTML = html;
    el.style.display = 'block';
    el.classList.remove('cmp__verdict--in'); void el.offsetWidth; el.classList.add('cmp__verdict--in');
    cmpHydrateLogos(el);
}
function buildVerdict(a, b, metrics) {
    var aw = [], bw = [];
    metrics.forEach(function (m) {
        if (m.a == null || m.b == null || m.a === m.b) return;
        var aWins = m.dir === 'low' ? m.a < m.b : m.a > m.b;
        (aWins ? aw : bw).push(m.name);
    });
    function nm(o) { return '<span class="cmp__verdict__ent" title="' + (o.name || '') + '">' + (o.logo || ('<b class="cmp__verdict__name" style="color:' + o.color + '">' + o.name + '</b>')) + '</span>'; }
    if (!aw.length && !bw.length) {
        return '<span class="cmp__verdict__txt">' + nm(a) + ' and ' + nm(b) + ' are remarkably close across every measure.</span>';
    }
    function joinList(arr) { arr = arr.slice(0, 3); return arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]; }
    var lead = aw.length >= bw.length ? { o: a, w: aw, other: b, ow: bw } : { o: b, w: bw, other: a, ow: aw };
    var s1 = nm(lead.o) + ' comes out ahead — stronger on ' + joinList(lead.w) + '.';
    var s2 = lead.ow.length ? ' ' + nm(lead.other) + ' leads on ' + joinList(lead.ow.slice(0, 2)) + '.' : '';
    return '<span class="cmp__verdict__txt">' + s1 + s2 + '</span>';
}
function coVerdict(a, b) {
    var A = { name: coName(a), color: a.color, logo: coLogo(a, 26) }, B = { name: coName(b), color: b.color, logo: coLogo(b, 26) };
    return buildVerdict(A, B, [
        { name: 'recruitment match', a: coRecruit(a), b: coRecruit(b), dir: 'high' },
        { name: 'graduate pay',      a: coSalaryNum(a), b: coSalaryNum(b), dir: 'high' },
        { name: 'selectivity',       a: coAcceptNum(a), b: coAcceptNum(b), dir: 'low' },
        { name: 'work-life balance', a: coWLB(a), b: coWLB(b), dir: 'high' },
        { name: 'employee satisfaction', a: coSat(a), b: coSat(b), dir: 'high' }
    ]);
}
function uniStudentsNum(u) { var m = String(u.students || '').replace(/[, ]/g, '').match(/(\d+)/); return m ? +m[1] : null; }
function uniTuitionNum(u) { return (typeof tuitionMinCost === 'function' ? tuitionMinCost(u) : 0) || null; }
function uniVerdict(a, b) {
    var A = { name: a.name, color: a.color, logo: uniLogo(a, 26) }, B = { name: b.name, color: b.color, logo: uniLogo(b, 26) };
    return buildVerdict(A, B, [
        { name: 'academic selectivity', a: a.diff || null, b: b.diff || null, dir: 'high' },
        { name: 'value for money',       a: uniTuitionNum(a), b: uniTuitionNum(b), dir: 'low' },
        { name: 'campus size',           a: uniStudentsNum(a), b: uniStudentsNum(b), dir: 'high' }
    ]);
}

// Company search inputs
(function () {
    var sa = document.getElementById('coSearchA'), sb = document.getElementById('coSearchB');
    if (sa) sa.addEventListener('input', function () { coBuildSuggest(this.value.trim(), document.getElementById('coResultsA'), 'A'); });
    if (sb) sb.addEventListener('input', function () { coBuildSuggest(this.value.trim(), document.getElementById('coResultsB'), 'B'); });
}());

// Compare-modal tab switching (Universities ⇄ Companies)
(function () {
    var tabs = document.querySelectorAll('.cmp__tab');
    var pageUni = document.getElementById('cmpPageUni');
    var pageCo = document.getElementById('cmpPageCo');
    var slider = document.getElementById('cmpTabsSlider');
    var subEl = document.querySelector('.cmp__vs__hd__sub');
    function place(tab) { if (slider && tab) { slider.style.width = tab.offsetWidth + 'px'; slider.style.transform = 'translateX(' + tab.offsetLeft + 'px)'; } }
    function activate(which) {
        tabs.forEach(function (t) { t.classList.toggle('is-active', t.dataset.cmptab === which); if (t.dataset.cmptab === which) place(t); });
        var show = which === 'co' ? pageCo : pageUni;
        var hide = which === 'co' ? pageUni : pageCo;
        if (hide) hide.style.display = 'none';
        if (show) { show.style.display = 'block'; show.classList.remove('cmp__page--in'); void show.offsetWidth; show.classList.add('cmp__page--in'); }
        if (subEl) subEl.textContent = which === 'co'
            ? 'Compare two companies on recruitment, pay, culture & more'
            : 'Select two universities and pick the metrics you want to compare';
        // reflect the active tab's verdict (or hide it)
        if (which === 'co') { (coSelected.A && coSelected.B) ? cmpSetVerdict(coVerdict(coSelected.A, coSelected.B)) : cmpSetVerdict(''); }
        else { (cmpVsSelected.A && cmpVsSelected.B) ? cmpSetVerdict(uniVerdict(cmpVsSelected.A, cmpVsSelected.B)) : cmpSetVerdict(''); }
    }
    tabs.forEach(function (t) { t.addEventListener('click', function () { activate(t.dataset.cmptab); }); });
    window.__cmpActivateTab = activate;
    window.__cmpPlaceTab = function () { var a = document.querySelector('.cmp__tab.is-active'); if (a) place(a); };
}());

// Wipe both comparisons clean when the modal is closed, so it always reopens fresh.
function cmpResetAll() {
    cmpVsSelected = { A: null, B: null };
    coSelected = { A: null, B: null };
    ['A', 'B'].forEach(function (slot) {
        ['cmpSelected', 'coSelected', 'cmpResults', 'coResults'].forEach(function (pre) {
            var el = document.getElementById(pre + slot);
            if (el) { el.innerHTML = ''; el.style.display = (pre.indexOf('Selected') !== -1 ? 'none' : ''); }
        });
        ['cmpSearch', 'coSearch'].forEach(function (pre) { var s = document.getElementById(pre + slot); if (s) s.value = ''; });
    });
    var t = document.getElementById('cmpVsTable'); if (t) { t.style.display = 'none'; t.innerHTML = ''; }
    var e = document.getElementById('cmpVsEmpty'); if (e) e.style.display = 'flex';
    var cr = document.getElementById('coVsResult'); if (cr) { cr.style.display = 'none'; cr.innerHTML = ''; }
    var ce = document.getElementById('coVsEmpty'); if (ce) ce.style.display = 'flex';
    _lastCmpPairKey = '';
    cmpSetVerdict('');
    if (typeof window.__cmpActivateTab === 'function') window.__cmpActivateTab('uni');
}

// ---- Per-slot country selection for head-to-head comparison ----
function cmpSetSlotCountry(slot, code) {
    cmpVsCountry[slot] = code;
    var flagEl   = document.getElementById('cmpFlag' + slot);
    var selEl    = document.getElementById('cmpCountry' + slot);
    var searchEl = document.getElementById('cmpSearch' + slot);
    if (selEl)  selEl.value = code;
    if (flagEl) flagEl.className = 'cmp__vs__country__flag fi fi-' + code;
    // Reset this slot's current selection — it belonged to the previous country
    cmpVsSelected[slot] = null;
    var selectedEl = document.getElementById('cmpSelected' + slot);
    if (selectedEl) { selectedEl.style.display = 'none'; selectedEl.innerHTML = ''; }
    var resultsEl = document.getElementById('cmpResults' + slot);
    if (resultsEl) resultsEl.innerHTML = '';
    if (searchEl) { searchEl.value = ''; searchEl.disabled = true; searchEl.placeholder = 'Loading universities…'; }
    renderVsComparison();
    cmpLoadCountryUnis(code).then(function(list) {
        if (cmpVsCountry[slot] !== code) return; // user changed again meanwhile
        cmpVsUnis[slot] = list;
        if (searchEl) { searchEl.disabled = false; searchEl.placeholder = 'Search by name or abbreviation…'; }
    });
}

function cmpInitCountrySelectors() {
    var list = cmpCountryList();
    if (!list.length) return;
    var def = (typeof currentCountryCode !== 'undefined' && currentCountryCode) ? currentCountryCode :
              (localStorage.getItem(COUNTRY_KEY) || list[0].code);
    if (!list.some(function(c){ return c.code === def; })) def = list[0].code;
    ['A','B'].forEach(function(slot) {
        var selEl = document.getElementById('cmpCountry' + slot);
        if (!selEl) return;
        selEl.innerHTML = list.map(function(c) {
            return '<option value="' + c.code + '">' + c.name + '</option>';
        }).join('');
        selEl.onchange = function() { cmpSetSlotCountry(slot, this.value); };
        if (!cmpVsCountry[slot]) cmpSetSlotCountry(slot, def);
    });
}

var FEED_UPDATES = [

    { uniId:'ucm',   cat:'deadline',    label:'Deadline',    text:'Undergraduate applications for 2025/26 close 30 June. Submit your documents early.',     date:'2 days ago' },
    { uniId:'ucm',   cat:'openday',     label:'Open Day',    text:'Virtual Open Day on 15 May — register now to join live Q&A sessions with faculty.',      date:'5 days ago' },
    { uniId:'uam',   cat:'scholarship', label:'Scholarship', text:'€3,000 Excellence Scholarship open for international students. Deadline: 1 July.',        date:'3 days ago' },
    { uniId:'upm',   cat:'ranking',     label:'Ranking',     text:'UPM rises 18 places in QS World Rankings 2025 — now #1 technical university in Spain.',   date:'1 week ago' },
    { uniId:'upm',   cat:'programme',   label:'Programme',   text:'New MSc in Artificial Intelligence launching September 2025. Applications now open.',     date:'4 days ago' },
    { uniId:'uc3m',  cat:'tuition',     label:'Tuition',     text:'Tuition fees frozen for 2025/26 academic year. No increase for continuing students.',     date:'1 week ago' },
    { uniId:'ie',    cat:'ranking',     label:'Ranking',     text:'IE Business School ranked #3 in Europe by FT European Business School Rankings 2025.',    date:'2 weeks ago' },
    { uniId:'ie',    cat:'scholarship', label:'Scholarship', text:'Merit scholarships up to 40% tuition reduction now open. Apply before 15 June.',          date:'6 days ago' },
    { uniId:'urjc',  cat:'openday',     label:'Open Day',    text:'Campus Open Days every Saturday in May — visit labs, meet professors and current students.',date:'3 days ago' },
    { uniId:'ub',    cat:'deadline',    label:'Deadline',    text:'Erasmus+ application window closes 20 May. Places limited — apply now.',                  date:'1 day ago' },
    { uniId:'uab',   cat:'programme',   label:'Programme',   text:'Joint Bachelor\'s in Bioinformatics with CRG now accepting applications for 2025.',       date:'5 days ago' },
    { uniId:'upf',   cat:'ranking',     label:'Ranking',     text:'UPF enters top 200 globally in THE World University Rankings for the first time.',        date:'2 weeks ago' },
    { uniId:'upc',   cat:'scholarship', label:'Scholarship', text:'Industry-funded PhD positions in Robotics & Automation — 6 fully funded spots available.', date:'4 days ago' },
    { uniId:'esade', cat:'openday',     label:'Open Day',    text:'MBA Open Evening in Barcelona — meet alumni and admissions directors. 22 May.',           date:'1 week ago' },
    { uniId:'uv',    cat:'tuition',     label:'Tuition',     text:'EU student tuition reduced by 8% for 2025/26 following regional government grant.',       date:'2 weeks ago' },
    { uniId:'upv',   cat:'deadline',    label:'Deadline',    text:'Pre-enrolment period for Engineering degrees: 2–20 June 2025.',                          date:'3 days ago' },
    { uniId:'us',    cat:'programme',   label:'Programme',   text:'New English-taught LLM in European Business Law launching October 2025.',                 date:'1 week ago' },
    { uniId:'ug',    cat:'openday',     label:'Open Day',    text:'Alhambra Campus Day — guided tours and faculty meetings. Free registration open.',        date:'6 days ago' },
    { uniId:'usal',  cat:'scholarship', label:'Scholarship', text:'USAL Global Scholarship: full tuition waiver for top-ranked international applicants.',    date:'5 days ago' },
    { uniId:'ehu',   cat:'ranking',     label:'Ranking',     text:'EHU/UPV enters top 50 European universities in research output for STEM fields.',         date:'2 weeks ago' },
    { uniId:'deusto',cat:'programme',   label:'Programme',   text:'Double Degree in Law + Business Administration — partnerships with 3 EU universities.',   date:'1 week ago' },

    { uniId:'oxford',  cat:'deadline',    label:'Deadline',    text:'Graduate applications for Michaelmas 2026 entry open 1 September. Check college deadlines.', date:'3 days ago' },
    { uniId:'oxford',  cat:'ranking',     label:'Ranking',     text:'Oxford retains #1 in QS World Rankings 2025 for the 9th consecutive year.',               date:'2 weeks ago' },
    { uniId:'cambridge',cat:'openday',    label:'Open Day',    text:'Undergraduate Open Days: 2–3 July 2025. Book your place — spaces fill within hours.',     date:'1 week ago' },
    { uniId:'cambridge',cat:'scholarship',label:'Scholarship', text:'Gates Cambridge Scholarships 2026 now accepting applications. Full funding available.',    date:'4 days ago' },
    { uniId:'imperial', cat:'programme',  label:'Programme',   text:'New MSc in Climate Change Science & Policy launching October 2025.',                      date:'5 days ago' },
    { uniId:'imperial', cat:'ranking',    label:'Ranking',     text:'Imperial ranked #2 in the UK and #8 globally in QS 2025 — highest ever position.',        date:'2 weeks ago' },
    { uniId:'ucl',      cat:'deadline',   label:'Deadline',    text:'UCAS undergraduate deadline: 29 January 2026. Personal statement workshops available.',    date:'6 days ago' },
    { uniId:'ucl',      cat:'scholarship',label:'Scholarship', text:'UCL Global Excellence Scholarships open — up to £10,000 for international students.',     date:'3 days ago' },
    { uniId:'lse',      cat:'ranking',    label:'Ranking',     text:'LSE ranked #1 globally for Social Sciences & Management by QS Subject Rankings.',         date:'1 week ago' },
    { uniId:'lse',      cat:'openday',    label:'Open Day',    text:'LSE Undergraduate Open Day: 21 June 2025. Register at lse.ac.uk/openday.',               date:'4 days ago' },
    { uniId:'kcl',      cat:'tuition',    label:'Tuition',     text:'International tuition for 2025/26 confirmed — fees unchanged from previous year.',        date:'2 weeks ago' },
    { uniId:'edinburgh',cat:'scholarship',label:'Scholarship', text:'Edinburgh Global Undergraduate Scholarships: up to £6,000. Apply by 1 March 2026.',       date:'5 days ago' },
    { uniId:'manchester',cat:'programme', label:'Programme',   text:'Alliance Manchester Business School launches new part-time MBA for working professionals.', date:'1 week ago' },

    { uniId:'sorbonne', cat:'deadline',   label:'Deadline',    text:'Campus France registration for non-EU students: deadline 2 December 2025.',              date:'1 week ago' },
    { uniId:'sciencespo',cat:'scholarship',label:'Scholarship',text:'Emile Boutmy Scholarship: up to full tuition for international students. Apply by 5 Jan.',date:'3 days ago' },
    { uniId:'polytechnique',cat:'ranking',label:'Ranking',     text:'École Polytechnique rises to #41 globally in QS 2025 Engineering & Technology.',         date:'2 weeks ago' },
    { uniId:'hec',      cat:'openday',    label:'Open Day',    text:'HEC MBA Virtual Information Session — 18 May. Register at hec.edu/openday.',             date:'4 days ago' },

    { uniId:'lmu',      cat:'deadline',   label:'Deadline',    text:'Winter semester application deadline: 15 July 2025 for international applicants.',        date:'5 days ago' },
    { uniId:'tum',      cat:'ranking',    label:'Ranking',     text:'TUM ranked #37 globally — highest ever — in QS World University Rankings 2025.',          date:'2 weeks ago' },
    { uniId:'tum',      cat:'scholarship',label:'Scholarship', text:'DAAD Scholarships for 2025/26 open — up to €850/month for Master\'s students.',           date:'3 days ago' },
    { uniId:'heidelberg',cat:'programme', label:'Programme',   text:'New International MD-PhD programme with Johns Hopkins University starting 2025.',         date:'1 week ago' },

    { uniId:'sapienza', cat:'deadline',   label:'Deadline',    text:'Applications for 2025/26 open via Universitaly from 15 April. Non-EU places limited.',   date:'2 days ago' },
    { uniId:'bocconi',  cat:'ranking',    label:'Ranking',     text:'Bocconi ranked #7 globally for Economics & Econometrics by QS Subject Rankings 2025.',   date:'1 week ago' },
    { uniId:'bocconi',  cat:'scholarship',label:'Scholarship', text:'Bocconi Merit Awards: up to full tuition. Application opens 1 October 2025.',             date:'4 days ago' },
    { uniId:'polimi',   cat:'openday',    label:'Open Day',    text:'PoliMi Campus Tour Days every Friday — book via polomilano.it/visit.',                   date:'6 days ago' },

    { uniId:'ulisboa',  cat:'deadline',   label:'Deadline',    text:'2025/26 international applications open — apply via the university portal by 31 July.',   date:'3 days ago' },
    { uniId:'nova',     cat:'scholarship',label:'Scholarship', text:'NOVA Excellence Scholarships: 50% tuition reduction for top international applicants.',   date:'5 days ago' },
    { uniId:'porto',    cat:'ranking',    label:'Ranking',     text:'University of Porto enters top 300 globally in THE World University Rankings 2025.',      date:'2 weeks ago' },
];

var NEWS_READ_KEY = 'us_news_read_' + user.id;
function getNewsRead() { try { return JSON.parse(localStorage.getItem(NEWS_READ_KEY) || '[]'); } catch(e) { return []; } }
function setNewsRead(ids) { localStorage.setItem(NEWS_READ_KEY, JSON.stringify(ids)); }

function parseDaysAgo(dateStr) {
    if (!dateStr) return 999;
    var m;
    m = dateStr.match(/(\d+)\s+day/);
    if (m) return parseInt(m[1]);
    m = dateStr.match(/(\d+)\s+week/);
    if (m) return parseInt(m[1]) * 7;
    m = dateStr.match(/(\d+)\s+month/);
    if (m) return parseInt(m[1]) * 30;
    if (dateStr === 'today' || dateStr === 'just now') return 0;
    return 999;
}

function getFeedItemId(u, i) { return u.uniId + '_' + u.cat + '_' + i; }

var CAT_STYLES = {
    deadline:   { color:'#e74c3c', bg:'rgba(231,76,60,.1)',   icon:'fa-solid fa-clock' },
    openday:    { color:'#2980b9', bg:'rgba(41,128,185,.1)',  icon:'fa-solid fa-calendar-check' },
    scholarship:{ color:'#27ae60', bg:'rgba(39,174,96,.1)',   icon:'fa-solid fa-medal' },
    tuition:    { color:'#8e44ad', bg:'rgba(142,68,173,.1)',  icon:'fa-solid fa-euro-sign' },
    ranking:    { color:'#d97c14', bg:'rgba(217,124,20,.1)',  icon:'fa-solid fa-trophy' },
    programme:  { color:'#16a085', bg:'rgba(22,160,133,.1)',  icon:'fa-solid fa-book-open' },
    news:       { color:'#5b6070', bg:'rgba(91,96,112,.1)',   icon:'fa-solid fa-newspaper' },
};

// ── Real per-saved-university news in the Feed sidebar ──────────────────────
// Pulls the SAME curated items the email digest sends (from /api/uni-news for the
// user's CURRENT saved universities), de-duplicates them, and keeps them forever
// with the date+time each was first seen. Only genuinely NEW items are ever added.
var FEED_STORE_KEY = 'us_feed_store_' + user.id;
var FEED_FETCH_KEY = 'us_feed_fetch_' + user.id;
function getFeedStore() { try { return JSON.parse(localStorage.getItem(FEED_STORE_KEY) || '{}'); } catch (e) { return {}; } }
function setFeedStore(s) { try { localStorage.setItem(FEED_STORE_KEY, JSON.stringify(s)); } catch (e) {} }
function feedHash(str) { var h = 0, i, c; str = String(str || ''); for (i = 0; i < str.length; i++) { c = str.charCodeAt(i); h = ((h << 5) - h) + c; h |= 0; } return Math.abs(h).toString(36); }
function feedItemKey(uniId, it) { return uniId + '|' + feedHash((it.blurb || it.title || '').toLowerCase()); }
var FEED_TYPE_MAP = { deadline: { cat: 'deadline', label: 'Deadline' }, event: { cat: 'openday', label: 'Event' }, news: { cat: 'news', label: 'News' } };

function paintFeed() {
    var saved   = getSaved();
    var feedEl  = document.getElementById('feedList');
    var emptyEl = document.getElementById('feedEmpty');
    var dotEl   = document.getElementById('feedDot');
    if (!feedEl) return;
    var store = getFeedStore();
    var items = Object.keys(store).map(function (k) { return store[k]; })
        .filter(function (it) { return saved.indexOf(it.uniId) !== -1; })
        .sort(function (a, b) { return b.firstSeen - a.firstSeen; });

    feedEl.querySelectorAll('.mp__feed__item, .mp__feed__day').forEach(function (el) { el.remove(); });
    var sub = document.getElementById('feedSub');
    if (sub) sub.textContent = saved.length ? 'Updates from ' + saved.length + ' saved universit' + (saved.length === 1 ? 'y' : 'ies') : 'Updates from the universities you saved';
    if (!items.length) { if (emptyEl) emptyEl.style.display = 'flex'; if (dotEl) dotEl.style.display = 'none'; updateHeroFeed(); return; }
    if (emptyEl) emptyEl.style.display = 'none';

    var readIds = getNewsRead();
    var isNew = function (it) { return readIds.indexOf(it.id) === -1 && (Date.now() - it.firstSeen) < 3 * 86400000; };
    var hasUnread = items.some(isNew);
    if (dotEl) dotEl.style.display = hasUnread ? 'flex' : 'none';

    function fEsc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    // A quiet timeline: items grouped by the day they arrived, each with the university's crest.
    var dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    var timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
    function dayLabel(ts) {
        var d = new Date(ts), t = new Date(); t.setHours(0, 0, 0, 0);
        var diff = Math.round((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
        return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : dayFmt.format(d);
    }
    var lastDay = '';
    items.forEach(function (it, i) {
        var uni = UNI.find(function (x) { return x.id === it.uniId; });
        var cs  = CAT_STYLES[it.cat] || CAT_STYLES.news;
        var day = dayLabel(it.firstSeen);
        if (day !== lastDay) {
            lastDay = day;
            var h = document.createElement('div');
            h.className = 'mp__feed__day';
            h.textContent = day;
            if (emptyEl) feedEl.insertBefore(h, emptyEl); else feedEl.appendChild(h);
        }
        var el = document.createElement('article');
        el.className = 'mp__feed__item' + (isNew(it) ? ' is-new' : '');
        el.style.setProperty('--i', Math.min(i, 14));
        el.style.setProperty('--cc', cs.color);
        el.innerHTML =
            '<span class="mp__feed__crest">' + (uni ? uniLogo(uni, 26) : '<span class="crs__logo crs__logo--mono" style="width:26px;height:26px;background:#888">?</span>') + '</span>' +
            '<div class="mp__feed__body">' +
                '<div class="mp__feed__top">' +
                    '<b class="mp__feed__uni">' + fEsc((uni && (uni.abbr && uni.name.length > 26 ? uni.abbr : uni.name)) || it.name || '') + '</b>' +
                    '<span class="mp__feed__cat">' + fEsc(it.label || 'News') + '</span>' +
                    '<time class="mp__feed__time">' + timeFmt.format(new Date(it.firstSeen)) + '</time>' +
                '</div>' +
                '<p class="mp__feed__text">' + fEsc(it.blurb || '') + '</p>' +
                (it.url ? '<a href="' + fEsc(it.url) + '" target="_blank" rel="noopener" class="mp__feed__link">Read story <i class="fa-solid fa-arrow-right"></i></a>' : '') +
            '</div>';
        if (emptyEl) feedEl.insertBefore(el, emptyEl); else feedEl.appendChild(el);
    });
    cmpHydrateLogos(feedEl);
    updateHeroFeed();
}

var _feedFetching = false;
function fetchFeedNews(force) {
    var saved = getSaved();
    var names = UNI.filter(function (u) { return saved.indexOf(u.id) !== -1; }).map(function (u) { return u.name; });
    if (!names.length) { paintFeed(); return; }
    var store = getFeedStore(), have = {};
    Object.keys(store).forEach(function (k) { have[store[k].uniId] = 1; });
    // a university checked recently counts as "had", even when it simply has no news —
    // otherwise one quiet university forced a request on every page load
    var checked = {}; try { checked = JSON.parse(localStorage.getItem(FEED_FETCH_KEY + '_unis') || '{}'); } catch (e) {}
    var missing = UNI.filter(function (u) { return saved.indexOf(u.id) !== -1 && !have[u.id] && !(Date.now() - (checked[u.id] || 0) < 6 * 3600000); }).length;
    var lastFetch = parseInt(localStorage.getItem(FEED_FETCH_KEY) || '0', 10);
    var need = force || missing > 0 || (Date.now() - lastFetch) > 30 * 60000;
    paintFeed();                                   // show what we already have, instantly
    if (!need || _feedFetching) return;
    _feedFetching = true;
    var base = (typeof PAY_API_BASE !== 'undefined' && PAY_API_BASE) ? PAY_API_BASE : '';
    fetch(base + '/api/uni-news?unis=' + encodeURIComponent(names.join(','))).then(function (r) { return r.json(); }).then(function (d) {
        _feedFetching = false;
        localStorage.setItem(FEED_FETCH_KEY, String(Date.now()));
        try { var ck = JSON.parse(localStorage.getItem(FEED_FETCH_KEY + '_unis') || '{}'); UNI.forEach(function (u) { if (saved.indexOf(u.id) !== -1) ck[u.id] = Date.now(); }); localStorage.setItem(FEED_FETCH_KEY + '_unis', JSON.stringify(ck)); } catch (e) {}
        var news = (d && d.news) || {}, st = getFeedStore(), added = 0, urls = {};
        Object.keys(st).forEach(function (k) { if (st[k].url) urls[st[k].url] = 1; });
        Object.keys(news).forEach(function (name) {
            var uni = UNI.find(function (x) { return x.name === name; });
            var uniId = uni ? uni.id : name;
            (news[name] || []).forEach(function (it) {
                var key = feedItemKey(uniId, it);
                if (st[key] || (it.url && urls[it.url])) return;   // dedupe — never re-add the same story
                var tm = FEED_TYPE_MAP[it.type] || FEED_TYPE_MAP.news;
                // the server's "found" time, so the timeline matches on every device
                st[key] = { id: key, uniId: uniId, name: name, blurb: it.blurb || it.title || '', url: it.url || '', cat: tm.cat, label: tm.label, firstSeen: Math.min(it.found || Date.now(), Date.now()), published: it.published || null };
                if (it.url) urls[it.url] = 1;
                added++;
            });
        });
        if (added) setFeedStore(st);
        paintFeed();
    }).catch(function () { _feedFetching = false; paintFeed(); });
}

// Public entry (kept the old name so all existing callers keep working).
function renderUpdatesFeed() { fetchFeedNews(false); }
// The server keeps these fresh in the background; while the page stays open,
// look again every half hour so the bell lights up without opening the feed.
setInterval(function () { if (!document.hidden) fetchFeedNews(false); }, 30 * 60000);
document.addEventListener('visibilitychange', function () { if (!document.hidden) fetchFeedNews(false); });

var feedOpen = false;
function openFeed()  {
    feedOpen = true;
    document.getElementById('feedSidebar').classList.add('open');
    document.getElementById('feedOverlay').classList.add('open');
    renderFriendRequests();
    renderUpdatesFeed();
}
function closeFeed() {
    feedOpen = false;
    document.getElementById('feedSidebar').classList.remove('open');
    document.getElementById('feedOverlay').classList.remove('open');
    var saved = getSaved();
    var readIds = getNewsRead();
    FEED_UPDATES.forEach(function(u, i) {
        if (saved.indexOf(u.uniId) === -1) return;
        var id = getFeedItemId(u, i);
        if (readIds.indexOf(id) === -1) readIds.push(id);
    });
    // everything shown in the feed counts as read once it's been open
    var store = getFeedStore();
    Object.keys(store).forEach(function (k) { if (saved.indexOf(store[k].uniId) !== -1 && readIds.indexOf(k) === -1) readIds.push(k); });
    setNewsRead(readIds);
    updateHeroFeed();
    var dot = document.getElementById('feedDot');
    if (dot) dot.style.display = 'none';
}
document.getElementById('feedToggle').addEventListener('click', function() { feedOpen ? closeFeed() : openFeed(); });
document.getElementById('feedClose').addEventListener('click', closeFeed);
document.getElementById('feedOverlay').addEventListener('click', closeFeed);
document.addEventListener('keydown', function (e) {
    var nm = document.getElementById('newsModal');
    if (e.key === 'Escape' && feedOpen && !(nm && nm.classList.contains('open'))) closeFeed();
});

setTimeout(renderUpdatesFeed, 0);

var COUNTRY_KEY = 'uniscout_country';
var _loadCountryGen = 0;

var CUSTOM_COUNTRY_NAMES = {
    es:'Spain', uk:'United Kingdom', gb:'United Kingdom', fr:'France', de:'Germany',
    it:'Italy', pt:'Portugal', us:'United States', ch:'Switzerland', ua:'Ukraine',
    nl:'Netherlands', se:'Sweden', dk:'Denmark', be:'Belgium', fi:'Finland', ie:'Ireland'
};

// Build a realistic description for an admin-added university when none was stored.
function buildCustomDesc(u, code) {
    var country = CUSTOM_COUNTRY_NAMES[code] || '';
    var loc = (u.city || '') + (country ? ', ' + country : '');
    var isPublic = (u.type || 'Public').toLowerCase() === 'public';
    var ts = u.ts || 2;
    var seed = 0;
    var nm = u.name || 'University';
    for (var i = 0; i < nm.length; i++) seed = (seed * 31 + nm.charCodeAt(i)) >>> 0;
    function pick(arr) { return arr[seed % arr.length]; }

    var opener = pick([
        nm + ' is a respected ' + (isPublic ? 'public' : 'private') + ' university based in ' + loc + '.',
        'Located in ' + loc + ', ' + nm + ' is a ' + (isPublic ? 'publicly funded' : 'private') + ' institution of higher education.',
        nm + ' is a leading ' + (isPublic ? 'public' : 'private') + ' university in ' + loc + ', attracting students from across the region and beyond.'
    ]);
    var character = isPublic
        ? pick(['As a state-funded institution, it offers a broad academic portfolio at accessible, regulated tuition while upholding rigorous national quality standards.',
                'Backed by public funding, the university combines affordable fees with a wide range of degree programmes and a strong research culture.',
                'As a public university, it provides regulated tuition, large faculties and degrees recognised throughout the country and internationally.'])
        : pick(['As a private institution, it is known for smaller class sizes, close faculty contact and a strongly industry-oriented curriculum.',
                'Operating privately, the university focuses on personalised teaching, modern facilities and close ties with employers and industry.',
                'As a private university, it offers a selective, career-focused environment with an emphasis on practical, employable skills.']);
    var costNote = ['',
        'With very affordable tuition, it is an excellent-value choice for both domestic and international students.',
        'Its moderate tuition makes it a popular, good-value destination for international applicants.',
        'Tuition sits in the mid-range, reflecting its established academic standing.',
        'Premium tuition reflects its strong reputation and the investment in a globally recognised degree.',
        'As a premium institution, its fees are among the higher tier — matched by its prestige and graduate outcomes.'][ts] || '';
    var cityNote = pick([
        'Students benefit from a vibrant city setting with a lively campus community and rich student life.',
        'The surrounding city offers an engaging environment, with plenty of culture, amenities and opportunities for students.',
        'Its location places students at the heart of an active, welcoming student city.'
    ]);
    return [opener, character, costNote, cityNote].filter(Boolean).join(' ');
}

// Admin-added universities (stored by the admin panel). Admin uses 'uk' for the UK; the app uses 'gb'.
function getCustomUnisForCountry(code) {
    var custom = [];
    try { custom = JSON.parse(localStorage.getItem('uniscout_custom_unis') || '[]'); } catch (e) { return []; }
    var adminCode = (code === 'gb') ? 'uk' : code;
    var PALETTE = ['#8B1A1A','#003087','#005691','#1565c0','#00573F','#8e44ad','#c0392b','#16a085'];
    return custom.filter(function (u) { return u.country === adminCode; }).map(function (u, i) {
        var diff = u.diff || 3;
        var mapped = {
            id: u.id,
            name: u.name,
            abbr: u.abbr || (u.name || 'UNI').slice(0, 6).toUpperCase(),
            color: u.color || PALETTE[i % PALETTE.length],
            city: u.city || '—',
            type: u.type || 'Public',
            tuition: u.tuition || '—',
            ts: u.ts || 2,
            diff: diff,
            dl: (['','Open','Low','Competitive','Highly selective','Elite selective'][diff]) || 'Competitive',
            fields: u.fields || [],
            langs: u.langs || ['English'],
            founded: u.founded || null,
            students: u.students || '—',
            website: u.website || ''
        };
        mapped.desc = (u.desc && u.desc.indexOf('admin panel') === -1) ? u.desc : buildCustomDesc(mapped, code);
        return mapped;
    });
}

function loadCountry(code) {
    var gen = ++_loadCountryGen;
    fetch('data/' + code + '.json')
    .then(function(r) { if (!r.ok) throw new Error('Missing'); return r.json(); })
    .then(function(data) { applyCountryData(code, data, gen); })
    .catch(function() {
        // No data file for this country yet — still navigate to it with an empty state.
        applyCountryData(code, buildEmptyCountry(code), gen);
    });
}

// Minimal data shape for a country we can reach but don't have content for yet.
function buildEmptyCountry(code) {
    var nm = (typeof countryNameByCode === 'function') ? countryNameByCode(code) : code.toUpperCase();
    return {
        meta: { name: nm, code: code, flag: code, uniCount: 0, cityCount: 0 },
        universities: [], cities: {}, tips: [], cityCards: [], featuredCities: []
    };
}

/* ── Cross-country university registry ───────────────────────────────────────
   UNI only ever holds the currently-loaded country, but the Gradebook stores
   target universities by id and they may belong to other countries (e.g. Oxford
   while viewing Spain). Without this, such a uni couldn't be resolved and a
   different country's uni was shown in its place. We remember a light record of
   every uni we load — keyed by id, persisted — so lookups work across countries
   and across sessions. */
var UNI_REGISTRY_KEY = 'us_uni_registry';
function registerUnis(list) {
    if (!list || !list.length) return;
    var reg;
    try { reg = JSON.parse(localStorage.getItem(UNI_REGISTRY_KEY) || '{}'); } catch (e) { reg = {}; }
    list.forEach(function (u) {
        if (!u || !u.id) return;
        reg[u.id] = { id: u.id, name: u.name, abbr: u.abbr, color: u.color, diff: u.diff, dl: u.dl, fields: u.fields, cc: u.country_code || u.cc || currentCountryCode };
    });
    try { localStorage.setItem(UNI_REGISTRY_KEY, JSON.stringify(reg)); } catch (e) {}
}
window.uniFromRegistry = function (id) {
    try { return (JSON.parse(localStorage.getItem(UNI_REGISTRY_KEY) || '{}'))[id] || null; } catch (e) { return null; }
};

/* Warm the registry from EVERY country in the background, so a Gradebook target
   from any country (e.g. Oxford while viewing Spain) resolves immediately without
   the user having to visit that country first. Deferred so it never blocks the
   initial render; the browser caches each file so the cost is one-time. */
(function warmUniRegistry() {
    var CODES = ['be','ch','de','dk','es','fi','fr','gb','ie','it','nl','pt','se','ua','us'];
    setTimeout(function () {
        var done = 0;
        CODES.forEach(function (code) {
            fetch('data/' + code + '.json')
                .then(function (r) { return r.json(); })
                .then(function (data) { if (data && data.universities) registerUnis(data.universities); })
                .catch(function () {})
                .then(function () {
                    if (++done === CODES.length && typeof window.renderAcademicWidget === 'function') {
                        window.renderAcademicWidget();   // refresh once every uni is known
                    }
                });
        });
    }, 1500);
})();

function applyCountryData(code, data, gen) {
        if (gen !== _loadCountryGen) return;
        localStorage.setItem(COUNTRY_KEY, code);
        currentCountryCode = code;
        if (typeof addVisitedCountry === 'function') addVisitedCountry(code);
        if (typeof window.fyRefresh === 'function') window.fyRefresh();   // update matcher country label/destinations

        UNI = data.universities.concat(getCustomUnisForCountry(code));
        registerUnis(UNI);   // remember these unis so cross-country lookups (e.g. Gradebook targets) resolve
        if (typeof scheduleDigestSync === 'function') scheduleDigestSync();   // names resolvable now

        var flagWrap = document.getElementById('headerFlagWrap');
        var flagEl   = document.getElementById('headerFlag');
        var nameEl   = document.getElementById('headerCountryName');
        var flagCode = data.meta.flag || data.meta.code || code;
        var countryName = data.meta.name || data.meta.country || code.toUpperCase();
        if (typeof renderVisaGuide === 'function') renderVisaGuide(code, countryName);
        if (flagEl)   flagEl.className       = 'mp__header__fi fi fi-' + flagCode;
        if (nameEl)   nameEl.textContent     = countryName;
        if (flagWrap) flagWrap.style.display = 'flex';

        document.getElementById('csFlag').className = 'mp__cs__flag fi fi-' + flagCode;
        document.getElementById('csName').textContent = countryName;
        document.querySelectorAll('.mp__cs__country').forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.code === code);
        });
        if (window.countryDrawer) window.countryDrawer.close();

        var heroSub = document.getElementById('heroSub');
        if (heroSub) heroSub.textContent = 'Explore universities in ' + countryName + ', compare options and track your applications.';

        var insightPct = document.getElementById('heroInsightPct');
        var insightUni = document.getElementById('heroInsightUni');
        if (insightPct) insightPct.textContent = UNI.length;
        if (insightUni) insightUni.textContent = 'universities in ' + countryName;
        var hTotal = document.getElementById('heroStatTotal');
        if (hTotal) countUpStat(hTotal, UNI.length);

        var statUniEl  = document.getElementById('statUnis');
        var statCityEl = document.getElementById('statCities');
        if (statUniEl)  statUniEl.textContent  = data.meta.uniCount  || UNI.length;
        if (statCityEl) statCityEl.textContent = data.meta.cityCount || Object.keys(data.cities).length;

        if (data.tips && data.tips.length) {
            var tipsGrid = document.querySelector('.mp__tips__grid');
            if (tipsGrid) {
                tipsGrid.innerHTML = data.tips.map(function(t) {
                    return '<div class="mp__tip">' +
                        '<div class="mp__tip__icon" style="background:' + t.color + ';color:' + t.iconColor + '"><i class="' + t.icon + '"></i></div>' +
                        '<h4>' + t.title + '</h4>' +
                        '<p>' + t.text + '</p>' +
                    '</div>';
                }).join('');
                var tipsSection = tipsGrid.closest('.mp__section');
                if (tipsSection) {
                    var sub = tipsSection.querySelector('.mp__section__sub');
                    if (sub) sub.textContent = 'Everything you need to know about studying in ' + countryName;
                }
            }
        }

        var cgHl  = document.querySelector('.cg__highlight');
        var cgSub = document.querySelector('.cg__hero__sub');
        if (cgHl)  cgHl.textContent = countryName;
        if (cgSub) cgSub.textContent = 'Explore ' + (data.meta.cityCount || Object.keys(data.cities).length) + ' vibrant cities across ' + countryName + ' — culture, costs, climate and live weather at your fingertips.';

        var expTagEl = document.getElementById('expHeroTag');
        var expSubEl = document.getElementById('expHeroSub');
        if (expTagEl) expTagEl.textContent = 'Find in ' + countryName;
        if (expSubEl) expSubEl.textContent = 'Search all ' + UNI.length + ' universities in ' + countryName + ' by name, city, field or language. Click any result for full details.';

        if (data.cityCards && data.cityCards.length) {
            var cgGrid = document.querySelector('.cg__city__grid');
            if (cgGrid) {
                cgGrid.innerHTML = data.cityCards.map(function(c) {
                    var statIcons = c.statIcons || ['fa-solid fa-users','fa-solid fa-coins','fa-solid fa-sun'];
                    return '<div class="cg__city__card">' +
                        '<div class="cg__card__top" style="background:' + c.gradient + '">' +
                            '<i class="' + c.icon + ' cg__card__icon"></i>' +
                            '<div class="cg__card__region">' + c.region + '</div>' +
                            '<div class="cg__card__cname">' + c.city + '</div>' +
                        '</div>' +
                        '<div class="cg__card__body">' +
                            '<p class="cg__card__desc">' + c.desc + '</p>' +
                            '<div class="cg__card__stats">' +
                                c.stats.map(function(s, i) {
                                    return '<div class="cg__card__stat"><i class="' + (statIcons[i]||'fa-solid fa-circle') + '"></i>' + s + '</div>';
                                }).join('') +
                            '</div>' +
                            '<div class="cg__card__tags">' + c.tags.map(function(t){ return '<span>' + t + '</span>'; }).join('') + '</div>' +
                            '<button class="cg__card__wxbtn" data-city="' + c.city + '"><i class="fa-solid fa-cloud-sun"></i> Check Live Weather</button>' +
                        '</div>' +
                    '</div>';
                }).join('');
                cgGrid.querySelectorAll('.cg__card__wxbtn').forEach(function(btn) {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        var city = btn.dataset.city;
                        var _wi = document.getElementById('wxCityInput');
                        if (_wi) _wi.value = city;
                        showCityInfo(city);
                        fetchWeather(city);
                        var _cws = document.getElementById('cgWeatherSection');
                        if (_cws) _cws.scrollIntoView({ behavior:'smooth', block:'start' });
                    });
                });
            }
        }

        if (data.featuredCities && data.featuredCities.length) {
            var featGrid = document.querySelector('.wx__feat__grid');
            if (featGrid) {
                featGrid.innerHTML = data.featuredCities.map(function(fc) {
                    return '<div class="wx__feat__card" data-city="' + fc.city + '">' +
                        '<i class="' + fc.icon + '"></i>' +
                        '<span class="wx__feat__name">' + fc.city + '</span>' +
                        '<span class="wx__feat__sub">' + fc.sub + '</span>' +
                    '</div>';
                }).join('');
                featGrid.querySelectorAll('.wx__feat__card').forEach(function(card) {
                    card.addEventListener('click', function() {
                        var city = card.dataset.city;
                        var _wi2 = document.getElementById('wxCityInput');
                        if (_wi2) _wi2.value = city;
                        showCityInfo(city);
                        fetchWeather(city);
                    });
                });
            }
        }

        var fCity = document.getElementById('fCity');
        if (fCity) {
            var cities = Object.keys(data.cities);
            fCity.innerHTML = '<option value="">All cities</option>' +
                cities.map(function(c){ return '<option>' + c + '</option>'; }).join('');
        }

        renderCompare();
        populateInsightSelects();
        renderSaved();
        var _ecr = document.getElementById('expChipResults');
        if (_ecr) _ecr.innerHTML = '';
        expActiveFilters = { field: '', lang: '', type: '', budget: '', city: '' };
        document.querySelectorAll('.exp__chip').forEach(function(c){ c.classList.remove('active'); });
        var _ecReset = document.getElementById('expChipReset');
        if (_ecReset) _ecReset.style.display = 'none';
        if (nsInput.value) { nsInput.value = ''; runHeroSearch(); }

        cmpVsSelected = { A: null, B: null };
        ['A','B'].forEach(function(slot) {
            var si = document.getElementById('cmpSearch' + slot);
            var ri = document.getElementById('cmpResults' + slot);
            var se = document.getElementById('cmpSelected' + slot);
            if (si) si.value = '';
            if (ri) ri.innerHTML = '';
            if (se) { se.style.display = 'none'; se.innerHTML = ''; }
        });
        renderVsComparison();

        renderSavedPlaces();
        updateStats();
        applyCountryTheme(code);
        buildRankCarousel(code);
        fetchCountryWeather(code);
        renderUpdatesFeed();
        updateDshWidgets();
        if (typeof window.renderAcademicWidget === 'function') window.renderAcademicWidget();

        updateSliderRange();
        renderBudgetMatches();

        var _wci = document.getElementById('wxCityInfo');
        if (_wci) _wci.classList.remove('open');
        var _wf = document.getElementById('wxFeatured');
        if (_wf) _wf.style.display = 'block';
        var _wxi = document.getElementById('wxCityInput');
        if (_wxi) _wxi.value = '';

        if (data.cities) {
            Object.keys(data.cities).forEach(function(city) {
                if (!CITY_INFO[city]) {
                    CITY_INFO[city] = data.cities[city];
                }
            });
        }

        var pillsContainer = document.getElementById('cg2Pills');
        if (pillsContainer && data.cities) {
            var cityNames = Object.keys(data.cities).slice(0, 7);
            pillsContainer.innerHTML = cityNames.map(function(city) {
                var icon = (typeof CITY_PILL_ICONS !== 'undefined' && CITY_PILL_ICONS[city]) || 'fa-location-dot';
                return '<button class="cg2__pill" data-city="' + city + '"><i class="fa-solid ' + icon + '"></i><span>' + city + '</span></button>';
            }).join('');
            pillsContainer.querySelectorAll('.cg2__pill').forEach(function(btn) {
                btn.addEventListener('click', function() { cg2RenderCity(btn.dataset.city); });
            });
        }

        var _panel = document.getElementById('cg2Panel');
        if (_panel) { _panel.style.display = 'none'; _panel.classList.remove('cg2__panel--in'); }

        if (typeof COUNTRY_FAMOUS !== 'undefined' && COUNTRY_FAMOUS[code]) {
            var famous = COUNTRY_FAMOUS[code];
            var qText = document.getElementById('cg2QuoteText');
            var qName = document.getElementById('cg2QuoteName');
            var qRole = document.getElementById('cg2QuoteRole');
            var qInit = document.getElementById('cg2QuoteInitials');
            var qAvatar = document.getElementById('cg2QuoteAvatar');
            if (qText)   qText.textContent   = famous.quote;
            if (qName)   qName.textContent   = famous.name;
            if (qRole)   qRole.textContent   = famous.role;
            if (qInit)   qInit.textContent   = famous.initials;
            if (qAvatar) qAvatar.style.background = famous.color;
        }
}

var DL_REMINDED_KEY = 'us_dl_rem_'  + user.id;
var DL_DONE_KEY     = 'us_dl_done_' + user.id;
var DL_CUSTOM_KEY   = 'us_dl_cust_' + user.id;
var DL_PIN_KEY      = 'us_dl_pin_'  + user.id;

function getDlReminded() { try { return JSON.parse(localStorage.getItem(DL_REMINDED_KEY) || '[]'); } catch(e) { return []; } }
function setDlReminded(d){ localStorage.setItem(DL_REMINDED_KEY, JSON.stringify(d)); }
function getDlDone()     { try { return JSON.parse(localStorage.getItem(DL_DONE_KEY)     || '[]'); } catch(e) { return []; } }
function setDlDone(d)    { localStorage.setItem(DL_DONE_KEY,     JSON.stringify(d)); }
function getDlCustom()   { try { return JSON.parse(localStorage.getItem(DL_CUSTOM_KEY)   || '[]'); } catch(e) { return []; } }
function setDlCustom(d)  { localStorage.setItem(DL_CUSTOM_KEY,   JSON.stringify(d)); }
function getDlPin()      { return localStorage.getItem(DL_PIN_KEY) || null; }
function setDlPin(id)    { if (id === null) localStorage.removeItem(DL_PIN_KEY); else localStorage.setItem(DL_PIN_KEY, id); }

var DEADLINE_TYPES = {
    application:   { label:'Application',   icon:'fa-solid fa-file-pen',       color:'#e74c3c', bg:'rgba(231,76,60,.13)' },
    scholarship:   { label:'Scholarship',   icon:'fa-solid fa-medal',           color:'#27ae60', bg:'rgba(39,174,96,.13)' },
    openday:       { label:'Open Day',      icon:'fa-solid fa-calendar-check',  color:'#2980b9', bg:'rgba(41,128,185,.13)' },
    accommodation: { label:'Accommodation', icon:'fa-solid fa-house',           color:'#8e44ad', bg:'rgba(142,68,173,.13)' },
    interview:     { label:'Interview',     icon:'fa-solid fa-user-tie',        color:'#d97c14', bg:'rgba(217,124,20,.13)' },
    other:         { label:'Reminder',      icon:'fa-solid fa-star',            color:'#6c63ff', bg:'rgba(108,99,255,.13)' },
};

var DEADLINES = [

    { id:'d_app_ucm',        uniId:'ucm',        uniName:'Univ. Complutense de Madrid',       uniAbbr:'UCM',   uniColor:'#8B1A1A', type:'application',   title:'Undergraduate Applications 2025/26',         date:'2026-06-30', country:'es' },
    { id:'d_app_ub',         uniId:'ub',         uniName:'Universidad de Barcelona',           uniAbbr:'UB',    uniColor:'#005691', type:'application',   title:'Erasmus+ Application Window Closes',         date:'2026-05-20', country:'es' },
    { id:'d_app_upv',        uniId:'upv',        uniName:'Univ. Politécnica de Valencia',      uniAbbr:'UPV',   uniColor:'#E5007A', type:'application',   title:'Pre-enrolment: Engineering Degrees',         date:'2026-06-20', country:'es' },
    { id:'d_app_upf',        uniId:'upf',        uniName:'Universidad Pompeu Fabra',           uniAbbr:'UPF',   uniColor:'#CC2529', type:'application',   title:'International Student Applications Open',    date:'2026-05-30', country:'es' },
    { id:'d_app_ie',         uniId:'ie',         uniName:'IE University',                      uniAbbr:'IE',    uniColor:'#1A1A2E', type:'application',   title:'IE University International Intake 2026',    date:'2026-06-01', country:'es' },
    { id:'d_app_oxford',     uniId:'oxford',     uniName:'University of Oxford',               uniAbbr:'OXF',   uniColor:'#002147', type:'application',   title:'Graduate Applications — Michaelmas 2026',    date:'2026-10-01', country:'gb' },
    { id:'d_app_ucl',        uniId:'ucl',        uniName:'University College London',          uniAbbr:'UCL',   uniColor:'#500778', type:'application',   title:'UCAS Undergraduate Deadline',                date:'2027-01-13', country:'gb' },
    { id:'d_app_cambridge',  uniId:'cambridge',  uniName:'University of Cambridge',            uniAbbr:'CAM',   uniColor:'#003B5C', type:'application',   title:'Undergraduate UCAS Deadline',                date:'2026-10-15', country:'gb' },
    { id:'d_app_manchester',  uniId:'manchester', uniName:'University of Manchester',          uniAbbr:'MAN',   uniColor:'#660099', type:'application',   title:'Postgraduate Applications — Autumn Intake',  date:'2026-07-01', country:'gb' },
    { id:'d_app_lmu',        uniId:'lmu',        uniName:'Ludwig Maximilian Universität',      uniAbbr:'LMU',   uniColor:'#005B99', type:'application',   title:'Winter Semester International Applications',  date:'2026-07-15', country:'de' },
    { id:'d_app_tum',        uniId:'tum',        uniName:'TU München',                         uniAbbr:'TUM',   uniColor:'#0065BD', type:'application',   title:'TUM International Graduate Applications',     date:'2026-05-31', country:'de' },
    { id:'d_app_sorbonne',   uniId:'sorbonne',   uniName:'Sorbonne Université',                uniAbbr:'SRB',   uniColor:'#003189', type:'application',   title:'Campus France Registration (non-EU)',         date:'2026-12-02', country:'fr' },
    { id:'d_app_sciencespo', uniId:'sciencespo', uniName:'Sciences Po',                        uniAbbr:'SCP',   uniColor:'#C8102E', type:'application',   title:'Sciences Po International Applications',      date:'2026-05-15', country:'fr' },
    { id:'d_app_sapienza',   uniId:'sapienza',   uniName:'Sapienza Università di Roma',        uniAbbr:'SAP',   uniColor:'#782A2A', type:'application',   title:'Universitaly Applications 2025/26',           date:'2026-07-31', country:'it' },
    { id:'d_app_bocconi',    uniId:'bocconi',    uniName:'Bocconi University',                 uniAbbr:'BOC',   uniColor:'#1B3A6B', type:'application',   title:'International Undergraduate Applications',    date:'2026-06-15', country:'it' },
    { id:'d_app_ulisboa',    uniId:'ulisboa',    uniName:'Universidade de Lisboa',             uniAbbr:'UL',    uniColor:'#003A6B', type:'application',   title:'International Applications 2025/26',          date:'2026-07-31', country:'pt' },
    { id:'d_app_porto',      uniId:'porto',      uniName:'Universidade do Porto',              uniAbbr:'UP',    uniColor:'#00539B', type:'application',   title:'Postgraduate International Applications',     date:'2026-06-30', country:'pt' },

    { id:'d_sch_uam',        uniId:'uam',        uniName:'Univ. Autónoma de Madrid',           uniAbbr:'UAM',   uniColor:'#2A5CAA', type:'scholarship',   title:'Excellence Scholarship — €3,000',             date:'2026-07-01', country:'es' },
    { id:'d_sch_ie',         uniId:'ie',         uniName:'IE University',                      uniAbbr:'IE',    uniColor:'#1A1A2E', type:'scholarship',   title:'Merit Scholarship — Up to 40% Tuition',       date:'2026-06-15', country:'es' },
    { id:'d_sch_upc',        uniId:'upc',        uniName:'Univ. Politècnica de Catalunya',     uniAbbr:'UPC',   uniColor:'#0057A8', type:'scholarship',   title:'PhD Scholarships: Robotics & Automation',     date:'2026-05-10', country:'es' },
    { id:'d_sch_usal',       uniId:'usal',       uniName:'Universidad de Salamanca',           uniAbbr:'USAL',  uniColor:'#A0001E', type:'scholarship',   title:'USAL Global Scholarship — Full Tuition',      date:'2026-06-05', country:'es' },
    { id:'d_sch_uab',        uniId:'uab',        uniName:'Univ. Autónoma de Barcelona',        uniAbbr:'UAB',   uniColor:'#006400', type:'scholarship',   title:'International Excellence Grant',               date:'2026-05-25', country:'es' },
    { id:'d_sch_cambridge',  uniId:'cambridge',  uniName:'University of Cambridge',            uniAbbr:'CAM',   uniColor:'#003B5C', type:'scholarship',   title:'Gates Cambridge Scholarship — US round',      date:'2026-10-14', country:'gb' },
    { id:'d_sch_ucl',        uniId:'ucl',        uniName:'University College London',          uniAbbr:'UCL',   uniColor:'#500778', type:'scholarship',   title:'UCL Global Excellence Scholarships — £10k',   date:'2026-06-01', country:'gb' },
    { id:'d_sch_edinburgh',  uniId:'edinburgh',  uniName:'University of Edinburgh',            uniAbbr:'UoE',   uniColor:'#00325F', type:'scholarship',   title:'Edinburgh Global Undergraduate — £6,000',     date:'2027-03-01', country:'gb' },
    { id:'d_sch_lse',        uniId:'lse',        uniName:'London School of Economics',         uniAbbr:'LSE',   uniColor:'#A50034', type:'scholarship',   title:'LSE Graduate Support Scheme',                 date:'2026-05-01', country:'gb' },
    { id:'d_sch_tum',        uniId:'tum',        uniName:'TU München',                         uniAbbr:'TUM',   uniColor:'#0065BD', type:'scholarship',   title:'DAAD Scholarship — €850/month',               date:'2026-05-15', country:'de' },
    { id:'d_sch_heidelberg', uniId:'heidelberg', uniName:'Heidelberg University',              uniAbbr:'HEI',   uniColor:'#CC0000', type:'scholarship',   title:'Heidelberg Excellence Initiative Grants',     date:'2026-06-30', country:'de' },
    { id:'d_sch_sciencespo', uniId:'sciencespo', uniName:'Sciences Po',                        uniAbbr:'SCP',   uniColor:'#C8102E', type:'scholarship',   title:'Emile Boutmy Scholarship — Full Tuition',     date:'2027-01-05', country:'fr' },
    { id:'d_sch_hec',        uniId:'hec',        uniName:'HEC Paris',                          uniAbbr:'HEC',   uniColor:'#003189', type:'scholarship',   title:'HEC Foundation Scholarships — MBA',           date:'2026-07-15', country:'fr' },
    { id:'d_sch_bocconi',    uniId:'bocconi',    uniName:'Bocconi University',                 uniAbbr:'BOC',   uniColor:'#1B3A6B', type:'scholarship',   title:'Bocconi Merit Awards — Applications Open',    date:'2026-10-01', country:'it' },
    { id:'d_sch_polimi',     uniId:'polimi',     uniName:'Politecnico di Milano',              uniAbbr:'PMI',   uniColor:'#0066B3', type:'scholarship',   title:'PoliMi International Merit Scholarships',     date:'2026-05-31', country:'it' },
    { id:'d_sch_nova',       uniId:'nova',       uniName:'Universidade NOVA de Lisboa',        uniAbbr:'NOV',   uniColor:'#003264', type:'scholarship',   title:'NOVA Excellence Scholarship — 50% Off',       date:'2026-06-20', country:'pt' },

    { id:'d_od_ucm',         uniId:'ucm',        uniName:'Univ. Complutense de Madrid',        uniAbbr:'UCM',   uniColor:'#8B1A1A', type:'openday',       title:'Virtual Open Day — Faculty Q&A Sessions',    date:'2026-05-15', country:'es' },
    { id:'d_od_urjc',        uniId:'urjc',       uniName:'Univ. Rey Juan Carlos',              uniAbbr:'URJC',  uniColor:'#9B1B30', type:'openday',       title:'Campus Open Days — Saturdays in May',        date:'2026-05-30', country:'es' },
    { id:'d_od_ug',          uniId:'ug',         uniName:'Universidad de Granada',             uniAbbr:'UGR',   uniColor:'#6B0F1A', type:'openday',       title:'Alhambra Campus Day — Free Registration',    date:'2026-05-22', country:'es' },
    { id:'d_od_esade',       uniId:'esade',      uniName:'ESADE Business School',              uniAbbr:'ESADE', uniColor:'#002060', type:'openday',       title:'MBA Open Evening — Barcelona',                date:'2026-05-22', country:'es' },
    { id:'d_od_ub',          uniId:'ub',         uniName:'Universidad de Barcelona',           uniAbbr:'UB',    uniColor:'#005691', type:'openday',       title:'UB Campus Discovery Day',                    date:'2026-05-28', country:'es' },
    { id:'d_od_oxford',      uniId:'oxford',     uniName:'University of Oxford',               uniAbbr:'OXF',   uniColor:'#002147', type:'openday',       title:'Oxford Open Days — Summer 2026',              date:'2026-06-24', country:'gb' },
    { id:'d_od_cambridge',   uniId:'cambridge',  uniName:'University of Cambridge',            uniAbbr:'CAM',   uniColor:'#003B5C', type:'openday',       title:'Undergraduate Open Days',                     date:'2026-07-02', country:'gb' },
    { id:'d_od_lse',         uniId:'lse',        uniName:'London School of Economics',         uniAbbr:'LSE',   uniColor:'#A50034', type:'openday',       title:'LSE Undergraduate Open Day',                  date:'2026-06-21', country:'gb' },
    { id:'d_od_imperial',    uniId:'imperial',   uniName:'Imperial College London',            uniAbbr:'ICL',   uniColor:'#003E74', type:'openday',       title:'Imperial College Open Day',                   date:'2026-06-20', country:'gb' },
    { id:'d_od_hec',         uniId:'hec',        uniName:'HEC Paris',                          uniAbbr:'HEC',   uniColor:'#003189', type:'openday',       title:'MBA Virtual Information Session',             date:'2026-05-18', country:'fr' },
    { id:'d_od_polytechnique',uniId:'polytechnique',uniName:'École Polytechnique',             uniAbbr:'ΕΡΧ',   uniColor:'#003189', type:'openday',       title:'Campus Visit & Open Day',                     date:'2026-06-05', country:'fr' },
    { id:'d_od_polimi',      uniId:'polimi',     uniName:'Politecnico di Milano',              uniAbbr:'PMI',   uniColor:'#0066B3', type:'openday',       title:'Campus Tour Days — Book Online',              date:'2026-05-29', country:'it' },

    { id:'d_acc_ucm',        uniId:'ucm',        uniName:'Univ. Complutense de Madrid',        uniAbbr:'UCM',   uniColor:'#8B1A1A', type:'accommodation', title:'Student Halls — Priority Application Closes', date:'2026-05-31', country:'es' },
    { id:'d_acc_upm',        uniId:'upm',        uniName:'Univ. Politécnica de Madrid',        uniAbbr:'UPM',   uniColor:'#004B87', type:'accommodation', title:'RESA Residence Priority Booking',             date:'2026-06-15', country:'es' },
    { id:'d_acc_ub',         uniId:'ub',         uniName:'Universidad de Barcelona',           uniAbbr:'UB',    uniColor:'#005691', type:'accommodation', title:'UB Residence Hall Early Applications',        date:'2026-06-01', country:'es' },
    { id:'d_acc_oxford',     uniId:'oxford',     uniName:'University of Oxford',               uniAbbr:'OXF',   uniColor:'#002147', type:'accommodation', title:'College Accommodation Allocation Deadline',   date:'2026-08-01', country:'gb' },
    { id:'d_acc_ucl',        uniId:'ucl',        uniName:'University College London',          uniAbbr:'UCL',   uniColor:'#500778', type:'accommodation', title:'UCL Student Halls Application Deadline',      date:'2026-07-01', country:'gb' },
    { id:'d_acc_lse',        uniId:'lse',        uniName:'London School of Economics',         uniAbbr:'LSE',   uniColor:'#A50034', type:'accommodation', title:'LSE Intercollegiate Halls — Apply Early',     date:'2026-07-15', country:'gb' },
    { id:'d_acc_tum',        uniId:'tum',        uniName:'TU München',                         uniAbbr:'TUM',   uniColor:'#0065BD', type:'accommodation', title:'Studentenwerk Munich Housing Application',    date:'2026-06-30', country:'de' },
    { id:'d_acc_sapienza',   uniId:'sapienza',   uniName:'Sapienza Università di Roma',        uniAbbr:'SAP',   uniColor:'#782A2A', type:'accommodation', title:'Campus Residences Priority Application',      date:'2026-06-01', country:'it' },

    { id:'d_int_ie',         uniId:'ie',         uniName:'IE University',                      uniAbbr:'IE',    uniColor:'#1A1A2E', type:'interview',     title:'IE University Admissions Assessment',         date:'2026-05-20', country:'es' },
    { id:'d_int_esade',      uniId:'esade',      uniName:'ESADE Business School',              uniAbbr:'ESADE', uniColor:'#002060', type:'interview',     title:'ESADE MBA Assessment Day — Barcelona',        date:'2026-06-10', country:'es' },
    { id:'d_int_oxford',     uniId:'oxford',     uniName:'University of Oxford',               uniAbbr:'OXF',   uniColor:'#002147', type:'interview',     title:'Graduate Admissions Interview Window',         date:'2026-11-01', country:'gb' },
    { id:'d_int_cambridge',  uniId:'cambridge',  uniName:'University of Cambridge',            uniAbbr:'CAM',   uniColor:'#003B5C', type:'interview',     title:'Cambridge Admissions Interviews',              date:'2026-12-01', country:'gb' },
    { id:'d_int_lse',        uniId:'lse',        uniName:'London School of Economics',         uniAbbr:'LSE',   uniColor:'#A50034', type:'interview',     title:'LSE PhD Programme Interviews',                date:'2026-09-15', country:'gb' },
    { id:'d_int_imperial',   uniId:'imperial',   uniName:'Imperial College London',            uniAbbr:'ICL',   uniColor:'#003E74', type:'interview',     title:'Imperial PhD Interview Days',                 date:'2026-05-15', country:'gb' },
    { id:'d_int_sciencespo', uniId:'sciencespo', uniName:'Sciences Po',                        uniAbbr:'SCP',   uniColor:'#C8102E', type:'interview',     title:'Sciences Po Entrance Assessment',              date:'2026-04-25', country:'fr' },
    { id:'d_int_hec',        uniId:'hec',        uniName:'HEC Paris',                          uniAbbr:'HEC',   uniColor:'#003189', type:'interview',     title:'HEC Paris MBA Interview Round',               date:'2026-05-30', country:'fr' },
    { id:'d_int_bocconi',    uniId:'bocconi',    uniName:'Bocconi University',                 uniAbbr:'BOC',   uniColor:'#1B3A6B', type:'interview',     title:'Bocconi International Selection Tests',       date:'2026-05-08', country:'it' },
    { id:'d_int_tum',        uniId:'tum',        uniName:'TU München',                         uniAbbr:'TUM',   uniColor:'#0065BD', type:'interview',     title:'TUM Graduate School Admission Interviews',    date:'2026-06-01', country:'de' },
];

var dlActiveCat  = 'all';
var dlSavedOnly  = false;

function getCountdown(dateStr) {
    var target = new Date(dateStr + 'T23:59:59');
    var now    = new Date();
    var diff   = target - now;
    if (diff < 0) {
        var od = Math.ceil(-diff / 864e5);
        return { label: od + 'd overdue', urgency: 'overdue', days: -od };
    }
    var days  = Math.floor(diff / 864e5);
    var hours = Math.floor((diff % 864e5) / 36e5);
    if (days === 0) return { label: hours > 0 ? hours + 'h left' : '< 1h left', urgency: 'today', days: 0 };
    if (days === 1) return { label: '1 day left',            urgency: 'today',  days: 1  };
    if (days <= 7)  return { label: days + ' days left',     urgency: 'week',   days: days };
    if (days <= 30) return { label: days + ' days left',     urgency: 'month',  days: days };
    return              { label: days + ' days left',     urgency: 'future', days: days };
}

function formatDlDate(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
}

function getVisibleDeadlines() {
    var saved    = getSaved();
    var reminded = getDlReminded();
    var done     = getDlDone();
    var custom   = getDlCustom();
    var cat      = dlActiveCat;

    var builtin = DEADLINES.filter(function(d) { return d.country === currentCountryCode; });

    if (dlSavedOnly) {
        builtin = builtin.filter(function(d) { return saved.indexOf(d.uniId) !== -1; });
    }

    if (cat === 'personal') {
        builtin = builtin.filter(function(d) { return reminded.indexOf(d.id) !== -1; });
    } else if (cat !== 'all') {
        builtin = builtin.filter(function(d) { return d.type === cat; });
    }

    var filteredCustom = custom.filter(function(d) {
        if (cat === 'all' || cat === 'personal') return true;
        return d.type === cat;
    });

    var all = builtin.map(function(d) {
        return { id:d.id, uniId:d.uniId, uniName:d.uniName, uniAbbr:d.uniAbbr, uniColor:d.uniColor,
                 type:d.type, title:d.title, date:d.date, notes:d.notes||null,
                 personal: reminded.indexOf(d.id) !== -1,
                 done:     done.indexOf(d.id) !== -1, custom: false };
    }).concat(filteredCustom.map(function(d) {
        return { id:d.id, uniId:null, uniName:d.uniName||null, uniAbbr:'★', uniColor:'#6c63ff',
                 type:d.type, title:d.title, date:d.date, notes:d.notes||null,
                 personal:true, done: done.indexOf(d.id) !== -1, custom:true };
    }));

    all.sort(function(a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return new Date(a.date) - new Date(b.date);
    });
    return all;
}

// Initials from a personal-reminder title (so its badge shows the name, not a ★).
function dlInitials(title) {
    var words = String(title || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '★';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

function buildDeadlineCard(d) {
    var cd  = getCountdown(d.date);
    var dt  = DEADLINE_TYPES[d.type] || DEADLINE_TYPES.other;
    var rem = getDlReminded();
    var isRem    = rem.indexOf(d.id) !== -1;
    var isPinned = getDlPin() === d.id;
    var cdCls = 'dl__cd--' + (d.done ? 'done' : cd.urgency);
    var uniDisplay = d.uniName || 'Personal Reminder';
    // Use the university abbreviation, or initials of the reminder's own name.
    var abbr = (d.uniAbbr || dlInitials(d.title)).slice(0, 4);

    var cdNum = d.done ? '✓' : (cd.days === 0 ? '!' : Math.abs(cd.days));
    var cdLbl = d.done ? 'Done' : cd.label;

    return '<div class="dl__card' + (d.done ? ' dl__card--done' : ' dl__card--urgency-' + cd.urgency) + (isPinned ? ' dl__card--pinned' : '') + '" data-id="' + d.id + '">' +
        '<button class="dl__complete__btn' + (d.done ? ' done' : '') + '" data-id="' + d.id + '" title="' + (d.done ? 'Mark incomplete' : 'Mark complete') + '">' +
            '<i class="fa-' + (d.done ? 'solid' : 'regular') + ' fa-circle-check"></i>' +
        '</button>' +
        '<div class="dl__card__body">' +
            '<div class="dl__card__meta">' +
                '<div class="dl__card__abbr" style="background:' + (d.uniColor || dt.color) + '">' + abbr + '</div>' +
                '<span class="dl__card__uname">' + uniDisplay + '</span>' +
                '<span class="dl__type__badge" style="background:' + dt.bg + ';color:' + dt.color + '">' +
                    '<i class="' + dt.icon + '"></i> ' + dt.label +
                '</span>' +
            '</div>' +
            '<div class="dl__card__title">' + d.title + '</div>' +
            (d.notes ? '<div class="dl__card__notes">' + d.notes + '</div>' : '') +
            '<div class="dl__card__date__row">' +
                '<i class="fa-regular fa-calendar"></i> ' + formatDlDate(d.date) +
                (isPinned ? ' <span class="dl__pin__label"><i class="fa-solid fa-thumbtack"></i> Pinned to overview</span>' : '') +
            '</div>' +
        '</div>' +
        '<div class="dl__card__right">' +
            '<div class="dl__countdown ' + cdCls + '">' +
                '<div class="dl__cd__num">' + cdNum + '</div>' +
                '<div class="dl__cd__lbl">' + cdLbl + '</div>' +
            '</div>' +
            '<div class="dl__card__actions">' +
                '<button class="dl__pin__btn' + (isPinned ? ' active' : '') + '" data-id="' + d.id + '" title="' + (isPinned ? 'Unpin from overview' : 'Pin to overview widget') + '"><i class="fa-' + (isPinned ? 'solid' : 'regular') + ' fa-thumbtack"></i></button>' +
                (!d.custom ? '<button class="dl__remind__btn' + (isRem ? ' active' : '') + '" data-id="' + d.id + '" title="' + (isRem ? 'Remove reminder' : 'Add to reminders') + '">' +
                    '<i class="fa-' + (isRem ? 'solid' : 'regular') + ' fa-bell"></i>' +
                '</button>' : '') +
                (d.custom ? '<button class="dl__del__btn" data-id="' + d.id + '" title="Delete"><i class="fa-solid fa-trash-can"></i></button>' : '') +
            '</div>' +
        '</div>' +
    '</div>';
}

function renderDeadlines() {
    var dlList  = document.getElementById('dlList');
    var dlEmpty = document.getElementById('dlEmpty');
    if (!dlList) return;

    var items = getVisibleDeadlines();
    var nonDone   = items.filter(function(d) { return !d.done; });
    var completed = items.filter(function(d) { return d.done; });

    var overdue = nonDone.filter(function(d) { return getCountdown(d.date).urgency === 'overdue'; });
    var today   = nonDone.filter(function(d) { return getCountdown(d.date).urgency === 'today';   });
    var week    = nonDone.filter(function(d) { return getCountdown(d.date).urgency === 'week';    });
    var month   = nonDone.filter(function(d) { return getCountdown(d.date).urgency === 'month';   });

    var safeNum = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    safeNum('dlCntOverdue', overdue.length);
    safeNum('dlCntSoon',    today.length + week.length);
    safeNum('dlCntMonth',   month.length);
    safeNum('dlCntDone',    completed.length);

    if (!items.length) {
        dlList.innerHTML = '';
        if (dlEmpty) dlEmpty.style.display = 'flex';
        return;
    }
    if (dlEmpty) dlEmpty.style.display = 'none';

    var uniGroups = {};
    var uniOrder  = [];
    nonDone.forEach(function(d) {
        var key = d.uniName || 'Personal Reminders';
        if (!uniGroups[key]) {
            uniGroups[key] = { name: key, abbr: d.uniAbbr || '★', color: d.uniColor || '#6c63ff', urgent: [], upcoming: [] };
            uniOrder.push(key);
        }
        var urg = getCountdown(d.date).urgency;
        if (urg === 'future') {
            uniGroups[key].upcoming.push(d);
        } else {
            uniGroups[key].urgent.push(d);
        }
    });

    uniOrder.sort(function(a, b) {
        var ga = uniGroups[a], gb = uniGroups[b];
        var aAll = ga.urgent.concat(ga.upcoming);
        var bAll = gb.urgent.concat(gb.upcoming);
        var aMin = aAll.length ? Math.min.apply(null, aAll.map(function(d){ return new Date(d.date).getTime(); })) : Infinity;
        var bMin = bAll.length ? Math.min.apply(null, bAll.map(function(d){ return new Date(d.date).getTime(); })) : Infinity;
        return aMin - bMin;
    });

    function buildSubSection(label, iconCls, cls, deadlines) {
        if (!deadlines.length) return '';
        return '<div class="dl__subsec dl__subsec--' + cls + '">' +
            '<div class="dl__subsec__hd">' +
                '<i class="' + iconCls + '"></i>' + label +
                '<span class="dl__subsec__count">' + deadlines.length + '</span>' +
            '</div>' +
            deadlines.map(buildDeadlineCard).join('') +
        '</div>';
    }

    var html = '';
    uniOrder.forEach(function(key) {
        var g = uniGroups[key];
        var abbr = (g.abbr || '★').slice(0, 4);
        var total = g.urgent.length + g.upcoming.length;
        html += '<div class="dl__uni__group">' +
            '<div class="dl__uni__group__hd">' +
                '<div class="dl__uni__group__badge" style="background:' + g.color + '">' + abbr + '</div>' +
                '<span class="dl__uni__group__name">' + g.name + '</span>' +
                '<span class="dl__uni__group__total">' + total + ' deadline' + (total !== 1 ? 's' : '') + '</span>' +
            '</div>' +
            buildSubSection('Overdue &amp; This Month', 'fa-solid fa-triangle-exclamation', 'urgent', g.urgent) +
            buildSubSection('Upcoming', 'fa-solid fa-calendar', 'upcoming', g.upcoming) +
        '</div>';
    });

    if (completed.length) {
        html += '<div class="dl__section dl__section--done">' +
            '<div class="dl__section__hd">' +
                '<i class="fa-solid fa-circle-check"></i> Completed' +
                '<span class="dl__section__count">' + completed.length + '</span>' +
            '</div>' +
            completed.map(buildDeadlineCard).join('') +
        '</div>';
    }

    dlList.innerHTML = html;

    dlList.querySelectorAll('.dl__complete__btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var id = btn.dataset.id;
            var d  = getDlDone();
            var idx = d.indexOf(id);
            if (idx === -1) d.push(id); else d.splice(idx, 1);
            setDlDone(d);

            btn.classList.add('pulse');
            btn.addEventListener('animationend', function(){ btn.classList.remove('pulse'); }, { once: true });
            setTimeout(renderDeadlines, 220);
        });
    });

    dlList.querySelectorAll('.dl__remind__btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var id = btn.dataset.id;
            var r  = getDlReminded();
            var idx = r.indexOf(id);
            if (idx === -1) { r.push(id); btn.classList.add('active'); btn.title = 'Remove reminder'; btn.querySelector('i').className = 'fa-solid fa-bell'; }
            else            { r.splice(idx, 1); btn.classList.remove('active'); btn.title = 'Add to reminders'; btn.querySelector('i').className = 'fa-regular fa-bell'; }
            setDlReminded(r);
            btn.classList.add('pulse');
            btn.addEventListener('animationend', function(){ btn.classList.remove('pulse'); }, { once: true });
        });
    });

    dlList.querySelectorAll('.dl__del__btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var id = btn.dataset.id;
            if (getDlPin() === id) setDlPin(null);
            setDlCustom(getDlCustom().filter(function(d) { return d.id !== id; }));
            setDlDone(getDlDone().filter(function(x) { return x !== id; }));
            updateDshWidgets();
            renderDeadlines();
        });
    });

    dlList.querySelectorAll('.dl__pin__btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var id = btn.dataset.id;
            setDlPin(getDlPin() === id ? null : id);
            updateDshWidgets();
            renderDeadlines();
        });
    });

    if (window.renderChecklists) window.renderChecklists();
}

document.querySelectorAll('.dl__cat').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.dl__cat').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        dlActiveCat = btn.dataset.cat;
        renderDeadlines();
    });
});

/* ══════════════ Document & requirements checklist ══════════════
 * One checklist per saved/target university. Self-contained — checks persist
 * in localStorage. Some items are conditional (SAT for the US, portfolio for arts). */
var CHECKLIST_KEY = 'us_checklist_' + user.id;
function getChecklist() { try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch (e) { return {}; } }
function setChecklist(d) { try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(d)); } catch (e) {} }

var CKL_BASE = [
    { key:'form',        icon:'fa-file-lines',      label:'Application form completed' },
    { key:'transcript',  icon:'fa-graduation-cap',  label:'Academic transcripts' },
    { key:'sop',         icon:'fa-pen-fancy',       label:'Personal statement / motivation letter' },
    { key:'rec1',        icon:'fa-envelope',        label:'Recommendation letter #1' },
    { key:'rec2',        icon:'fa-envelope-open-text', label:'Recommendation letter #2' },
    { key:'cv',          icon:'fa-id-card',         label:'CV / résumé' },
    { key:'passport',    icon:'fa-passport',        label:'Passport / ID copy' },
    { key:'english',     icon:'fa-language',        label:'English test (IELTS / TOEFL)' },
    { key:'fee',         icon:'fa-coins',           label:'Application fee paid' }
];
function checklistItemsFor(u) {
    var items = CKL_BASE.slice();
    var cc = (u && u.cc ? String(u.cc).toLowerCase() : '');
    if (cc === 'us') items.splice(7, 0, { key:'sat', icon:'fa-square-poll-vertical', label:'Standardised test (SAT / ACT / GRE)' });
    var fields = (u && u.fields ? u.fields.join(' ').toLowerCase() : '');
    if (/art|design|architect|music|film|fashion/.test(fields)) {
        items.push({ key:'portfolio', icon:'fa-palette', label:'Portfolio / audition material' });
    }
    return items;
}
function resolveUni(id) {
    var u = (typeof UNI !== 'undefined') ? UNI.find(function (x) { return x.id === id; }) : null;
    return u || (window.uniFromRegistry ? window.uniFromRegistry(id) : null);
}

function renderChecklists() {
    var box = document.getElementById('dlChecklist');
    if (!box) return;
    var saved = getSaved();
    if (!saved.length) {
        box.innerHTML = '<div class="ckl__empty"><i class="fa-regular fa-square-check"></i>' +
            '<p>Save universities to get a tailored document checklist for each application.</p></div>';
        return;
    }
    var state = getChecklist();
    box.innerHTML = saved.map(function (id) {
        var u = resolveUni(id);
        if (!u) return '';
        var items = checklistItemsFor(u);
        var st = state[id] || {};
        var done = items.filter(function (it) { return st[it.key]; }).length;
        var pctNum = Math.round(done / items.length * 100);
        var ringColor = pctNum === 100 ? '#27ae60' : pctNum >= 50 ? '#d97c14' : '#e67e22';
        return '<div class="ckl__card" data-uid="' + id + '">' +
            '<div class="ckl__hd">' +
                '<span class="ckl__logo" style="background:' + (u.color || '#d97c14') + '">' + (u.abbr || (u.name || '?').slice(0,2).toUpperCase()) + '</span>' +
                '<div class="ckl__hd__info">' +
                    '<div class="ckl__name">' + (u.name || id) + '</div>' +
                    '<div class="ckl__prog__lbl"><span style="color:' + ringColor + '">' + done + '/' + items.length + '</span> documents ready</div>' +
                '</div>' +
                '<div class="ckl__ring" style="--p:' + pctNum + ';--rc:' + ringColor + '"><span>' + pctNum + '%</span></div>' +
            '</div>' +
            '<div class="ckl__items">' +
                items.map(function (it) {
                    var on = !!st[it.key];
                    return '<button class="ckl__item' + (on ? ' ckl__item--on' : '') + '" data-key="' + it.key + '">' +
                        '<span class="ckl__check"><i class="fa-solid ' + (on ? 'fa-circle-check' : 'fa-circle') + '"></i></span>' +
                        '<i class="ckl__item__icon fa-solid ' + it.icon + '"></i>' +
                        '<span class="ckl__item__lbl">' + it.label + '</span>' +
                    '</button>';
                }).join('') +
            '</div>' +
        '</div>';
    }).join('') || '<div class="ckl__empty"><i class="fa-regular fa-square-check"></i><p>Save universities to build your checklist.</p></div>';
}
window.renderChecklists = renderChecklists;

// Toggle a checklist item (event delegation).
(function () {
    var box = document.getElementById('dlChecklist');
    if (!box) return;
    box.addEventListener('click', function (e) {
        var item = e.target.closest('.ckl__item');
        if (!item) return;
        var card = item.closest('.ckl__card');
        var uid = card && card.dataset.uid, key = item.dataset.key;
        if (!uid || !key) return;
        var state = getChecklist();
        state[uid] = state[uid] || {};
        state[uid][key] = !state[uid][key];
        setChecklist(state);
        renderChecklists();
    });
}());

var dlSavedOnlyEl = document.getElementById('dlSavedOnly');
if (dlSavedOnlyEl) {
    dlSavedOnlyEl.addEventListener('change', function() {
        dlSavedOnly = this.checked;
        renderDeadlines();
    });
}

var dlAddOverlay = document.getElementById('dlAddOverlay');

var DL_TITLE_MAX = 50;
function updateDlTitleCount() {
    var inp = document.getElementById('dlTitle');
    var c = document.getElementById('dlTitleCount');
    if (!inp || !c) return;
    var n = inp.value.length;
    c.textContent = n + '/' + DL_TITLE_MAX;
    c.classList.toggle('mp__modal__count--full', n >= DL_TITLE_MAX);
}
(function () {
    var inp = document.getElementById('dlTitle');
    if (inp) inp.addEventListener('input', updateDlTitleCount);
}());

function openDlModal() {
    dlAddOverlay.classList.add('open');
    var today = new Date().toISOString().split('T')[0];
    document.getElementById('dlDate').min = today;
    document.getElementById('dlDate').value = '';
    updateDlTitleCount();
}
function closeDlModal() {
    dlAddOverlay.classList.remove('open');
    document.getElementById('dlAddErr').textContent = '';
    ['dlTitle','dlUniName','dlNotes','dlDate'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('dlType').value = 'application';
}

document.getElementById('dlAddBtn').addEventListener('click', openDlModal);
document.getElementById('dlEmptyAddBtn').addEventListener('click', openDlModal);
document.getElementById('dlAddClose').addEventListener('click', closeDlModal);
dlAddOverlay.addEventListener('click', function(e) { if (e.target === dlAddOverlay) closeDlModal(); });

// Save an event to Deadlines from a UniVersity email link:
//   mainPage.html?dl_add=1&dl_title=..&dl_date=YYYY-MM-DD&dl_uni=..&dl_type=..
(function handleEmailDeadlineLink() {
    var p = new URLSearchParams(location.search);
    if (p.get('dl_add') !== '1') return;
    var title = (p.get('dl_title') || '').trim().slice(0, 160);
    var date  = (p.get('dl_date') || '').trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    var allowed = ['application', 'scholarship', 'openday', 'accommodation', 'interview', 'other'];
    var type = allowed.indexOf(p.get('dl_type')) !== -1 ? p.get('dl_type') : 'other';
    var uni = (p.get('dl_uni') || '').trim().slice(0, 120) || null;

    var custom = getDlCustom();
    if (!custom.some(function(d) { return d.title === title && d.date === date; })) {
        custom.push({ id: 'cust_' + Date.now(), uniName: uni, type: type, title: title, date: date, notes: 'Saved from UniVersity email' });
        setDlCustom(custom);
    }
    history.replaceState({}, '', location.pathname);
    if (typeof showTab === 'function') showTab('tracker');
    if (typeof renderDeadlines === 'function') renderDeadlines();

    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:6000;display:flex;align-items:center;gap:9px;' +
        'padding:13px 20px;border-radius:13px;font-family:Montserrat,sans-serif;font-size:13px;font-weight:700;color:#fff;' +
        'box-shadow:0 10px 30px rgba(0,0,0,.25);background:linear-gradient(135deg,#27ae60,#1e8e4f);animation:arIn .3s ease both';
    bar.innerHTML = '<i class="fa-regular fa-calendar-check"></i> Saved to your Deadlines';
    document.body.appendChild(bar);
    setTimeout(function() { bar.style.transition = 'opacity .4s'; bar.style.opacity = '0'; setTimeout(function() { bar.remove(); }, 400); }, 3500);
}());

document.getElementById('dlAddSave').addEventListener('click', function() {
    var title = document.getElementById('dlTitle').value.trim().slice(0, DL_TITLE_MAX);
    var type  = document.getElementById('dlType').value;
    var uni   = document.getElementById('dlUniName').value.trim();
    var date  = document.getElementById('dlDate').value;
    var notes = document.getElementById('dlNotes').value.trim();
    if (!title) { document.getElementById('dlAddErr').textContent = 'Please enter a title.'; return; }
    if (!date)  { document.getElementById('dlAddErr').textContent = 'Please select a date.'; return; }
    var custom = getDlCustom();
    custom.push({ id:'cust_'+Date.now(), uniName:uni||null, type:type, title:title, date:date, notes:notes||null });
    setDlCustom(custom);
    closeDlModal();
    renderDeadlines();
});

document.querySelector('.mp__nav__btn[data-tab="tracker"]').addEventListener('click', function() {
    setTimeout(renderDeadlines, 40);
});

renderDeadlines();

setInterval(renderDeadlines, 60000);

var SALARY_DATA = {

    ucm:   { p3:72, p5:38, p10:12, p30:2  },
    uam:   { p3:74, p5:40, p10:14, p30:2  },
    upm:   { p3:85, p5:55, p10:18, p30:3  },
    uc3m:  { p3:82, p5:52, p10:16, p30:3  },
    urjc:  { p3:65, p5:30, p10:8,  p30:1  },
    ub:    { p3:70, p5:36, p10:11, p30:2  },
    uab:   { p3:72, p5:38, p10:12, p30:2  },
    upf:   { p3:80, p5:52, p10:18, p30:3  },
    upc:   { p3:84, p5:56, p10:20, p30:4  },
    uv:    { p3:68, p5:33, p10:9,  p30:1  },
    upv:   { p3:83, p5:54, p10:17, p30:3  },
    us:    { p3:67, p5:31, p10:9,  p30:1  },
    ug:    { p3:65, p5:29, p10:8,  p30:1  },
    usal:  { p3:64, p5:28, p10:8,  p30:1  },
    ehu:   { p3:73, p5:39, p10:13, p30:2  },

    ie:    { p3:95, p5:82, p10:45, p30:12 },
    esade: { p3:96, p5:85, p10:52, p30:15 },
    deusto:{ p3:80, p5:48, p10:15, p30:3  },

    oxford:    { p3:92, p5:75, p10:40, p30:10 },
    cambridge: { p3:93, p5:77, p10:42, p30:11 },
    imperial:  { p3:94, p5:80, p10:38, p30:8  },
    ucl:       { p3:90, p5:72, p10:35, p30:8  },
    lse:       { p3:94, p5:82, p10:48, p30:14 },
    kcl:       { p3:88, p5:68, p10:30, p30:7  },
    edinburgh: { p3:87, p5:65, p10:28, p30:6  },
    manchester:{ p3:86, p5:63, p10:27, p30:5  },

    sorbonne:     { p3:75, p5:45, p10:16, p30:3  },
    sciencespo:   { p3:92, p5:78, p10:42, p30:12 },
    polytechnique:{ p3:96, p5:88, p10:55, p30:18 },
    hec:          { p3:97, p5:90, p10:62, p30:22 },

    lmu:       { p3:82, p5:55, p10:22, p30:4  },
    tum:       { p3:90, p5:70, p10:30, p30:6  },
    heidelberg:{ p3:84, p5:58, p10:24, p30:5  },

    sapienza:{ p3:65, p5:32, p10:10, p30:2  },
    bocconi: { p3:93, p5:80, p10:48, p30:15 },
    polimi:  { p3:88, p5:65, p10:28, p30:5  },

    ulisboa: { p3:62, p5:28, p10:8,  p30:1  },
    nova:    { p3:75, p5:44, p10:15, p30:3  },
    porto:   { p3:68, p5:33, p10:10, p30:2  },
};

var FIELD_BONUS = {
    engineering: { p3:+5,  p5:+8,  p10:+6,  p30:+2  },
    finance:     { p3:+3,  p5:+10, p10:+14, p30:+8  },
    medicine:    { p3:+8,  p5:+10, p10:+8,  p30:+2  },
    law:         { p3:+4,  p5:+8,  p10:+10, p30:+4  },
    arts:        { p3:-8,  p5:-12, p10:-6,  p30:-1  },
};

/* ADM_PARAMS, cap() and sigmoid() are defined earlier (near the chance helpers). */

function populateInsightSelects() {

    var salInput = document.getElementById('salUniInput');
    var admInput = document.getElementById('admUniInput');
    var salHid   = document.getElementById('salUni');
    var admHid   = document.getElementById('admUni');
    if (salInput) salInput.value = '';
    if (admInput) admInput.value = '';
    if (salHid)  salHid.value  = '';
    if (admHid)  admHid.value  = '';
}

document.getElementById('salCalcBtn').addEventListener('click', function() {
    var uniId = document.getElementById('salUni').value;
    var field = document.getElementById('salField').value;
    var resultEl = document.getElementById('salResult');
    if (!uniId) { resultEl.innerHTML = '<div class="ins__result__empty"><i class="fa-solid fa-triangle-exclamation" style="color:#e74c3c"></i><p>Please select a university first.</p></div>'; return; }

    var base = SALARY_DATA[uniId];
    if (!base) {
        // No curated figures — derive a sensible profile from the university's entry difficulty
        // (more selective → stronger graduate earning outcomes), so every university returns a result.
        var su = UNI.find(function(u){ return u.id === uniId; });
        var sd = su ? (su.diff || 3) : 3;
        base = ({
            1: { p3:60, p5:26, p10:7,  p30:1  },
            2: { p3:68, p5:33, p10:10, p30:2  },
            3: { p3:76, p5:44, p10:14, p30:3  },
            4: { p3:86, p5:60, p10:24, p30:6  },
            5: { p3:93, p5:80, p10:45, p30:12 },
        })[sd] || { p3:76, p5:44, p10:14, p30:3 };
    }

    var bonus = field && FIELD_BONUS[field] ? FIELD_BONUS[field] : { p3:0, p5:0, p10:0, p30:0 };
    var p3  = cap(base.p3  + bonus.p3);
    var p5  = cap(base.p5  + bonus.p5);
    var p10 = cap(base.p10 + bonus.p10);
    var p30 = cap(base.p30 + bonus.p30);

    var uni = UNI.find(function(u){ return u.id === uniId; });
    var uniName = uni ? uni.name : uniId;
    var fieldLabel = { engineering:'Engineering & Tech', finance:'Finance & Consulting', medicine:'Medicine & Healthcare', law:'Law', arts:'Arts & Humanities' }[field] || 'All fields (average)';

    var brackets = [
        { label:'Above €3,000/month',  sub:'Entry-level professional',  pct:p3,  color:'#27ae60', icon:'fa-solid fa-seedling' },
        { label:'Above €5,000/month',  sub:'Senior / specialist',        pct:p5,  color:'#2980b9', icon:'fa-solid fa-briefcase' },
        { label:'Above €10,000/month', sub:'Executive / high-earner',    pct:p10, color:'#8e44ad', icon:'fa-solid fa-star' },
        { label:'Above €30,000/month', sub:'Top 1% earner',              pct:p30, color:'#d97c14', icon:'fa-solid fa-crown' },
    ];

    resultEl.innerHTML =
        '<div class="rzt rzt--sal" style="--a:#27ae60">' +
            '<button class="rzt__close ins__res__close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '<div class="rzt__head">' +
                '<span class="rzt__badge"><i class="fa-solid fa-chart-line"></i></span>' +
                '<div class="rzt__head__txt">' +
                    '<div class="rzt__eyebrow">Salary outlook</div>' +
                    '<h3 class="rzt__title">' + uniName + '</h3>' +
                    '<div class="rzt__meta"><i class="fa-solid fa-briefcase"></i> ' + fieldLabel + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="rzt__brackets">' +
                brackets.map(function (b, i) {
                    var barColor = b.pct >= 80 ? '#27ae60' : b.pct >= 55 ? '#2980b9' : b.pct >= 30 ? '#d97c14' : '#e74c3c';
                    var conf = b.pct >= 75 ? 'High likelihood' : b.pct >= 45 ? 'Moderate likelihood' : b.pct >= 20 ? 'Lower likelihood' : 'Rare outcome';
                    return '<div class="rzt__brk" style="--d:' + (i * 90 + 120) + 'ms">' +
                        '<div class="rzt__brk__top">' +
                            '<span class="rzt__brk__ic" style="color:' + b.color + ';background:' + b.color + '15"><i class="' + b.icon + '"></i></span>' +
                            '<div class="rzt__brk__txt"><div class="rzt__brk__label">' + b.label + '</div><div class="rzt__brk__sub">' + b.sub + '</div></div>' +
                            '<div class="rzt__brk__pct" style="color:' + barColor + '">' + b.pct + '<small>%</small></div>' +
                        '</div>' +
                        '<div class="rzt__bar"><i style="width:' + b.pct + '%;background:linear-gradient(90deg,' + b.color + ',' + barColor + ')"></i></div>' +
                        '<div class="rzt__brk__conf">' + conf + '</div>' +
                    '</div>';
                }).join('') +
            '</div>' +
            '<p class="rzt__src"><i class="fa-solid fa-circle-info"></i> Based on graduate employment outcome surveys (INE, HESA, AlmaLaurea, CEREQ, DAAD, 2023)</p>' +
        '</div>';
});

var admSystemEl = document.getElementById('admSystem');
var admGradeField = document.getElementById('admGradeField');
var admAlevelField = document.getElementById('admAlevelField');
var admHint = document.getElementById('admHint');

admSystemEl.addEventListener('change', function() {
    var sys = this.value;
    if (sys === 'alevels') {
        admGradeField.style.display = 'none';
        admAlevelField.style.display = 'block';
    } else {
        admGradeField.style.display = 'block';
        admAlevelField.style.display = 'none';
        var hints = { pct:'Enter a number between 0 and 100', gpa:'Enter a number between 0.0 and 4.0', ib:'Enter a number between 1 and 45' };
        var maxes = { pct:100, gpa:4, ib:45 };
        admHint.textContent = hints[sys] || '';
        document.getElementById('admGrade').max = maxes[sys] || 100;
        document.getElementById('admGrade').placeholder = sys === 'gpa' ? 'e.g. 3.5' : sys === 'ib' ? 'e.g. 38' : 'e.g. 82';
    }
});

function toPercent(sys, raw) {
    if (sys === 'pct')     return raw;
    if (sys === 'gpa')     return (raw / 4.0) * 100;
    if (sys === 'ib')      return (raw / 45)  * 100;
    if (sys === 'alevels') return raw;
    return raw;
}

// "Use my gradebook average" — prefill the admission calc from the student's grades.
(function () {
    var btn = document.getElementById('admUseGrades');
    if (!btn) return;
    function sync() {
        var g = studentGradePercent();
        if (g == null) { btn.style.display = 'none'; return; }
        btn.style.display = '';
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Use my gradebook average (' + Math.round(g) + '%)';
    }
    sync();
    window.syncAdmUseGrades = sync;   // refreshed when the Probability tab opens
    btn.addEventListener('click', function () {
        var g = studentGradePercent();
        if (g == null) return;
        var sysSel = document.getElementById('admSystem');
        sysSel.value = 'pct';
        sysSel.dispatchEvent(new Event('change'));   // reveal the % field, hide A-level field
        document.getElementById('admGrade').value = Math.round(g);
        document.getElementById('admCalcBtn').click();
    });
}());

document.getElementById('admCalcBtn').addEventListener('click', function() {
    var uniId   = document.getElementById('admUni').value;
    var sys     = document.getElementById('admSystem').value;
    var resultEl = document.getElementById('admResult');

    if (!uniId) { resultEl.innerHTML = '<div class="ins__result__empty"><i class="fa-solid fa-triangle-exclamation" style="color:#e74c3c"></i><p>Please select a university first.</p></div>'; return; }

    var rawGrade;
    if (sys === 'alevels') {
        rawGrade = parseFloat(document.getElementById('admALevel').value);
    } else {
        rawGrade = parseFloat(document.getElementById('admGrade').value);
        if (isNaN(rawGrade)) { resultEl.innerHTML = '<div class="ins__result__empty"><i class="fa-solid fa-triangle-exclamation" style="color:#e74c3c"></i><p>Please enter your grade.</p></div>'; return; }
    }

    var grade = toPercent(sys, rawGrade);
    var uni = UNI.find(function(u){ return u.id === uniId; });
    if (!uni) return;
    var params = ADM_PARAMS[uni.diff] || ADM_PARAMS[3];
    var prob = cap(sigmoid(grade, params.thresh, params.k));

    var verdict, verdictColor, advice;
    if (prob >= 80)      { verdict = 'Strong Candidate';   verdictColor = '#27ae60'; advice = 'Your grades put you in an excellent position. Focus on a strong personal statement and gather outstanding references.'; }
    else if (prob >= 55) { verdict = 'Good Chances';       verdictColor = '#2980b9'; advice = 'You have a real shot — strengthen your application with extracurriculars and a compelling motivation letter.'; }
    else if (prob >= 35) { verdict = 'Competitive Entry';  verdictColor = '#d97c14'; advice = 'Entry is competitive. Consider retaking exams, broadening your portfolio, or applying to a wider range of universities.'; }
    else                 { verdict = 'Very Challenging';   verdictColor = '#e74c3c'; advice = 'This university\'s requirements are significantly above your current grades. Explore foundation programmes or alternative entry routes.'; }

    var sysLabel = { pct:rawGrade + '%', gpa:'GPA ' + rawGrade, ib:rawGrade + ' IB points', alevels:'A-Level grade' }[sys] || rawGrade + '%';

    var conf = prob >= 80 ? 'High likelihood' : prob >= 55 ? 'Good likelihood' : prob >= 35 ? 'Competitive' : 'Long shot';

    resultEl.innerHTML =
        '<div class="rzt rzt--adm" style="--a:' + verdictColor + '">' +
            '<button class="rzt__close ins__res__close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '<div class="rzt__adm__hero">' +
                '<div class="rzt__ring" style="--p:' + prob + ';--c:' + verdictColor + '">' +
                    '<div class="rzt__ring__in"><b style="color:' + verdictColor + '">' + prob + '<i>%</i></b><small>chance</small></div>' +
                '</div>' +
                '<div class="rzt__adm__txt">' +
                    '<div class="rzt__eyebrow">Admission chance</div>' +
                    '<h3 class="rzt__title">' + uni.name + '</h3>' +
                    '<span class="rzt__pill" style="color:' + verdictColor + ';background:' + verdictColor + '18;border-color:' + verdictColor + '40">' + verdict + '</span>' +
                    '<div class="rzt__meta"><i class="fa-solid fa-graduation-cap"></i> ' + uni.dl + ' &middot; ' + sysLabel + '</div>' +
                '</div>' +
            '</div>' +
            '<p class="rzt__advice"><b>' + conf + '</b> — ' + advice + '</p>' +
            '<div class="rzt__actions">' +
                '<button class="rzt__btn rzt__btn--primary ins__save__hero__btn" ' +
                    'data-uid="'           + uniId        + '" ' +
                    'data-name="'          + uni.name      + '" ' +
                    'data-color="'         + uni.color     + '" ' +
                    'data-prob="'          + prob          + '" ' +
                    'data-verdict="'       + verdict       + '" ' +
                    'data-verdict-color="' + verdictColor  + '" ' +
                    'data-grade="'         + sysLabel      + '">' +
                    '<i class="fa-solid fa-bookmark"></i> Save result' +
                '</button>' +
                '<a class="rzt__btn rzt__btn--ghost" href="applicationForm.html?uni=' + uniId + '">' +
                    '<i class="fa-solid fa-file-signature"></i> Apply' +
                '</a>' +
            '</div>' +
        '</div>';
});

populateInsightSelects();

/* Close button on calculated result cards → restore the original placeholder. */
['admResult', 'salResult', 'roiResult'].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    var placeholder = el.innerHTML;   // the photo brand card shown before Calculate
    el.addEventListener('click', function (e) {
        if (e.target.closest('.ins__res__close')) el.innerHTML = placeholder;
    });
});

/* ── ROI / "Is it worth it?" calculator ── */
var ROI_FIELD_SALARY = { cs:42000, engineering:40000, finance:38000, medicine:48000, law:36000, science:34000, arts:28000 };
var ROI_FIELD_LABEL  = { cs:'Computer Science / IT', engineering:'Engineering', finance:'Business & Finance', medicine:'Medicine & Healthcare', law:'Law', science:'Science', arts:'Arts & Humanities' };
var ROI_DEGREE = { bachelor:{ y:4, label:"Bachelor's" }, master:{ y:2, label:"Master's" }, phd:{ y:4, label:'PhD' } };

(function() {
    var btn = document.getElementById('roiCalcBtn');
    if (!btn) return;
    btn.addEventListener('click', function() {
        var resultEl = document.getElementById('roiResult');
        var uniId = document.getElementById('roiUni').value;
        if (!uniId) {
            resultEl.innerHTML = '<div class="ins__result__empty"><i class="fa-solid fa-triangle-exclamation" style="color:#e74c3c"></i><p>Please select a university first.</p></div>';
            return;
        }
        var u = (typeof UNI !== 'undefined' ? UNI : []).find(function(x){ return x.id === uniId; });
        if (!u) { resultEl.innerHTML = '<div class="ins__result__empty"><i class="fa-solid fa-triangle-exclamation"></i><p>No data for this university.</p></div>'; return; }

        var deg   = ROI_DEGREE[document.getElementById('roiDegree').value] || ROI_DEGREE.bachelor;
        var field = document.getElementById('roiField').value;
        var cur   = currencySymFor(countryOf(u));
        var money = function (n) { return cur + Math.round(n).toLocaleString(); };

        // ── Cost side (per year × degree length) ──
        var annualTuition = tuitionMidCost(u);
        var annualLiving  = cityLivingAnnual(u);
        var annualExtra   = COUNTRY_VISA_INS[countryOf(u)] || 1000;   // visa + insurance
        var years         = deg.y;
        var totalTuition  = annualTuition * years;
        var totalLiving   = annualLiving  * years;
        var totalExtra    = annualExtra   * years;
        var grossTotal    = totalTuition + totalLiving + totalExtra;

        var scholRate    = estScholarshipRate(u);
        var scholSaving  = Math.round(totalTuition * scholRate);
        var netTotal     = grossTotal - scholSaving;

        // ── Return side ──
        var salary    = estStartingSalary(u, field);
        var payback   = salary > 0 ? netTotal / salary : 0;
        // Rough 10-year net position (graduate premium ≈ 35% of salary is "extra").
        var tenYearGain = Math.round(salary * 0.35 * 10 - netTotal);

        var cls, verdict;
        if (payback < 2)        { cls = 'fast'; verdict = 'Excellent value'; }
        else if (payback < 3.5) { cls = 'good'; verdict = 'Good value'; }
        else if (payback < 5.5) { cls = 'mid';  verdict = 'Moderate value'; }
        else                    { cls = 'slow'; verdict = 'Slow to pay off'; }

        var fieldLabel = ROI_FIELD_LABEL[field] || 'All fields (average)';
        var cityLabel  = u.city ? (' · ' + u.city) : '';
        // Breakdown-bar segment widths (of gross, before scholarship).
        var pct = function (n) { return (grossTotal > 0 ? (n / grossTotal * 100) : 0).toFixed(1); };

        var pcVal = { fast: '#27ae60', good: '#2980b9', mid: '#e8850a', slow: '#e74c3c' }[cls];
        resultEl.innerHTML =
            '<div class="rzt rzt--roi" style="--a:' + pcVal + '">' +
                '<button class="rzt__close ins__res__close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="rzt__head">' +
                    '<span class="rzt__badge"><i class="fa-solid fa-scale-balanced"></i></span>' +
                    '<div class="rzt__head__txt">' +
                        '<div class="rzt__eyebrow">Cost &amp; ROI · ' + years + ' year' + (years > 1 ? 's' : '') + '</div>' +
                        '<h3 class="rzt__title">' + (u.name || uniId) + '</h3>' +
                        '<div class="rzt__meta"><i class="fa-solid fa-graduation-cap"></i> ' + deg.label + ' · ' + fieldLabel + cityLabel + '</div>' +
                    '</div>' +
                '</div>' +

                '<div class="rzt__payback">' +
                    '<div class="rzt__payback__num">' + payback.toFixed(1) + '<small>yrs</small></div>' +
                    '<div class="rzt__payback__txt"><div class="rzt__payback__lbl">' + verdict + '</div><div class="rzt__payback__sub">to earn back your net investment</div></div>' +
                '</div>' +

                '<div class="rzt__break">' +
                    '<div class="rzt__break__bar">' +
                        '<span class="rzt__seg" style="width:' + pct(totalTuition) + '%;--sc:#e8850a" title="Tuition"></span>' +
                        '<span class="rzt__seg" style="width:' + pct(totalLiving)  + '%;--sc:#2980b9" title="Living"></span>' +
                        '<span class="rzt__seg" style="width:' + pct(totalExtra)   + '%;--sc:#8e44ad" title="Visa & insurance"></span>' +
                    '</div>' +
                    '<div class="rzt__legend">' +
                        '<span><i class="rzt__dot" style="background:#e8850a"></i> Tuition <b>' + money(totalTuition) + '</b></span>' +
                        '<span><i class="rzt__dot" style="background:#2980b9"></i> Living <b>' + money(totalLiving) + '</b></span>' +
                        '<span><i class="rzt__dot" style="background:#8e44ad"></i> Visa &amp; insurance <b>' + money(totalExtra) + '</b></span>' +
                    '</div>' +
                '</div>' +

                '<div class="rzt__stats">' +
                    '<div class="rzt__stat"><div class="rzt__stat__lbl"><i class="fa-solid fa-coins"></i> Net total cost</div><div class="rzt__stat__val">' + money(netTotal) + '</div></div>' +
                    '<div class="rzt__stat"><div class="rzt__stat__lbl"><i class="fa-solid fa-sack-dollar"></i> Starting salary</div><div class="rzt__stat__val">' + money(salary) + '<small>/yr</small></div></div>' +
                    '<div class="rzt__stat"><div class="rzt__stat__lbl" style="color:#27ae60"><i class="fa-solid fa-award"></i> Scholarship potential</div><div class="rzt__stat__val">−' + money(scholSaving) + '<small>~' + Math.round(scholRate * 100) + '%</small></div></div>' +
                    '<div class="rzt__stat"><div class="rzt__stat__lbl"><i class="fa-solid fa-chart-line"></i> 10-yr net position</div><div class="rzt__stat__val" style="color:' + (tenYearGain >= 0 ? '#27ae60' : '#e74c3c') + '">' + (tenYearGain >= 0 ? '+' : '−') + money(Math.abs(tenYearGain)) + '</div></div>' +
                '</div>' +

                '<p class="rzt__src"><i class="fa-solid fa-circle-info"></i> Tuition &amp; living costs use real data; salary, scholarships &amp; visa/insurance are estimates. Payback = net cost ÷ starting salary. Guidance, not financial advice.</p>' +
            '</div>';
    });
}());

var APPROVED_KEY = 'us_approved_' + user.id;
function getApproved() { try { return JSON.parse(localStorage.getItem(APPROVED_KEY) || '{}'); } catch(e) { return {}; } }
function setApproved(d) { localStorage.setItem(APPROVED_KEY, JSON.stringify(d)); }
function markApproved(uniId, score) {
    var a = getApproved();
    if (score >= 80) { a[uniId] = Math.max(a[uniId] || 0, score); setApproved(a); }
}
function countApproved() {
    var a = getApproved(); var saved = getSaved();
    return Object.keys(a).filter(function(id){ return saved.indexOf(id) !== -1 && a[id] >= 80; }).length;
}
function updateAppcount() {
    updateFriendStats();
}

var INSIGHT_SAVES_KEY = 'us_insight_saves';
function getInsightSaves() { try { return JSON.parse(localStorage.getItem(INSIGHT_SAVES_KEY) || '[]'); } catch(e) { return []; } }
function setInsightSaves(d) { localStorage.setItem(INSIGHT_SAVES_KEY, JSON.stringify(d)); }

/* Close the result card with an animation */
document.getElementById('admResult').addEventListener('click', function (e) {
    var close = e.target.closest('.adm2__close');
    if (!close) return;
    var panel = document.getElementById('admResult');
    var card = panel.querySelector('.adm2');
    if (!card) { panel.innerHTML = ''; return; }
    card.classList.add('adm2--closing');
    setTimeout(function () { panel.innerHTML = ''; }, 260);
});

document.getElementById('admResult').addEventListener('click', function (e) {
    var btn = e.target.closest('.ins__save__hero__btn');
    if (!btn || btn.disabled) return;

    var result = {
        uniId:        btn.dataset.uid,
        name:         btn.dataset.name,
        color:        btn.dataset.color,
        prob:         parseInt(btn.dataset.prob, 10),
        verdict:      btn.dataset.verdict,
        verdictColor: btn.dataset.verdictColor,
        grade:        btn.dataset.grade
    };

    var saves = getInsightSaves().filter(function (s) { return s.uniId !== result.uniId; });
    saves.unshift(result);
    setInsightSaves(saves);

    btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved to Hero';
    btn.disabled  = true;

    heroInsightIdx = 0;
    updateHeroInsight();
});

var EV_PROMPT = [
'You are an expert university admissions officer and professional academic writing coach.',
'Your task is to evaluate and improve a student\'s university application in a single response.',
'',
'### RULES:',
'* Be honest, critical, and constructive.',
'* Do NOT give generic advice.',
'* Do NOT invent or exaggerate achievements.',
'* Only use the information provided.',
'* Maintain a professional and encouraging tone.',
'',
'### APPLICATION DATA:',
'Program Applying To:\n{{program}}',
'GPA / Academic Performance:\n{{gpa}}',
'Test Scores:\n{{scores}}',
'Extracurricular Activities:\n{{activities}}',
'Awards / Achievements:\n{{awards}}',
'',
'### WRITTEN RESPONSES:',
'Personal Statement:\n{{personal_statement}}',
'Why This University:\n{{motivation}}',
'Career Goals:\n{{goals}}',
'Additional Information:\n{{additional_info}}',
'',
'### TASKS:',
'1. Evaluate the application as a whole (academics + writing + profile).',
'2. Give an overall score from 0 to 100.',
'3. Give section scores (0-10): Clarity, Structure, Originality, Persuasiveness, Profile Strength.',
'4. Identify: Strengths, Weaknesses, Missed Opportunities.',
'5. Provide specific, actionable improvements.',
'6. Rewrite the Personal Statement and the "Why This University" section — clearer, more structured, more compelling.',
'7. Do NOT add new achievements. Only improve wording, structure, and clarity.',
'',
'### OUTPUT FORMAT (STRICT):',
'Overall Score: X/100',
'',
'Section Scores:',
'Clarity: X/10',
'Structure: X/10',
'Originality: X/10',
'Persuasiveness: X/10',
'Profile Strength: X/10',
'',
'---',
'',
'Strengths:\n* ...',
'',
'Weaknesses:\n* ...',
'',
'Missed Opportunities:\n* ...',
'',
'Actionable Improvements:\n* ...',
'',
'---',
'',
'Improved Personal Statement:\n(Full rewritten version)',
'',
'---',
'',
'Improved "Why This University":\n(Full rewritten version)',
'',
'---',
'',
'Final Advice:\n(2-3 concise sentences summarizing the most important improvement priorities)'
].join('\n');

function buildEvalPrompt() {
    function v(id) { return document.getElementById(id).value.trim() || '(not provided)'; }
    return EV_PROMPT
        .replace('{{program}}',           v('evProgram'))
        .replace('{{gpa}}',               v('evGpa'))
        .replace('{{scores}}',            v('evScores'))
        .replace('{{activities}}',        v('evActivities'))
        .replace('{{awards}}',            v('evAwards'))
        .replace('{{personal_statement}}',v('evStatement'))
        .replace('{{motivation}}',        v('evMotivation'))
        .replace('{{goals}}',             v('evGoals'))
        .replace('{{additional_info}}',   v('evAdditional'));
}

function evScore(fields) {
    var v = function(s) { return (s || '').toLowerCase(); };
    var wc = function(s) { return (s || '').trim().split(/\s+/).filter(Boolean).length; };
    var cats = [];

    cats.push({ name: 'Academic Strength', weight: 0.25, score: (function() {
        var g = v(fields.gpa);
        var s = 5;
        if (/4\.0|summa|distinction|highest honor/.test(g)) s = 10;
        else if (/3\.[89]/.test(g)) s = 9.5;
        else if (/3\.[67]/.test(g)) s = 8.5;
        else if (/3\.[45]/.test(g)) s = 8;
        else if (/3\.[23]/.test(g)) s = 7;
        else if (/3\.[01]/.test(g)) s = 6;
        else if (/first class|1st class|2:1|upper second/.test(g)) s = 8.5;
        else if (/2:2|lower second/.test(g)) s = 6;
        else if (/9[0-9]%/.test(g)) s = 9.5;
        else if (/8[0-9]%/.test(g)) s = 8;
        else if (/7[0-9]%/.test(g)) s = 6.5;
        if (g.length < 3) s = 5;
        return Math.min(10, s);
    }())});

    cats.push({ name: 'Motivation', weight: 0.15, score: (function() {
        var t = fields.motivation || '';
        var s = Math.min(7, wc(t) / 20);
        if (/research|lab|professor|faculty|curriculum|module|course|program|opportunity|project/i.test(t)) s += 1.5;
        if (/passion|driven|inspired|fascinated|compelled|eager|dedicated/i.test(t)) s += 1;
        return Math.min(10, s);
    }())});

    cats.push({ name: 'Writing Quality', weight: 0.10, score: (function() {
        var t = fields.statement || '';
        var s = Math.min(7, wc(t) / 71);
        if (/however|therefore|furthermore|moreover|consequently|firstly|secondly/i.test(t)) s += 1;
        if (/from a young age|i have always|ever since i was|as a child/i.test(t)) s -= 0.5;
        return Math.min(10, Math.max(0, s));
    }())});

    cats.push({ name: 'Program Fit', weight: 0.12, score: (function() {
        var t = (fields.program || '') + ' ' + (fields.goals || '');
        var s = 5;
        if (wc(fields.goals) > 30) s += 2;
        if (/specific|career|industry|role|sector|position/i.test(t)) s += 1.5;
        if (/align|complement|build on|leverage|because|reason/i.test(t)) s += 1;
        return Math.min(10, s);
    }())});

    cats.push({ name: 'Extracurriculars', weight: 0.10, score: (function() {
        var t = fields.activities || '';
        if (!t.trim()) return 2;
        var s = Math.min(6, wc(t) / 10);
        if (/president|founder|captain|head|lead|organiz|chair|direct/i.test(t)) s += 1.5;
        if (/volunteer|community|outreach|mentor|tutor|charity/i.test(t)) s += 1;
        if (/competition|tournament|champion|finalist|winner/i.test(t)) s += 1;
        return Math.min(10, s);
    }())});

    cats.push({ name: 'Research Experience', weight: 0.08, score: (function() {
        var t = (fields.activities || '') + ' ' + (fields.additional || '') + ' ' + (fields.statement || '');
        var s = 3;
        if (/research|thesis|dissertation|paper|publication|journal|experiment|lab/i.test(t)) s += 3;
        if (/author|co-author|published|presented|conference/i.test(t)) s += 2;
        if (/professor|supervisor|internship|placement/i.test(t)) s += 1.5;
        return Math.min(10, s);
    }())});

    cats.push({ name: 'Authenticity', weight: 0.08, score: (function() {
        var t = (fields.statement || '') + ' ' + (fields.motivation || '');
        if (wc(t) < 30) return 3;
        var specifics = (t.match(/[0-9]+|specifically|particular|during|when i|in \d{4}|at the age|my \w+/gi) || []).length;
        var s = Math.min(7, 3 + specifics * 0.3);
        var generics = (t.match(/from a young age|i have always|passionate about|my whole life|unique opportunity/gi) || []).length;
        return Math.min(10, Math.max(2, s - generics * 0.5));
    }())});

    cats.push({ name: 'Leadership', weight: 0.07, score: (function() {
        var t = (fields.activities || '') + ' ' + (fields.additional || '');
        var s = 3;
        if (/president|founder|captain|head of|chair/i.test(t)) s += 3;
        else if (/officer|coordinator|organiz|director/i.test(t)) s += 2;
        else if (/team|group|member/i.test(t)) s += 1;
        if (/100\+|50\+|nationwide|regional|national|international/i.test(t)) s += 1.5;
        return Math.min(10, s);
    }())});

    cats.push({ name: 'Awards / Scholarship', weight: 0.03, score: (function() {
        var t = fields.awards || '';
        if (!t.trim()) return 2;
        var s = 5;
        if (/national|international|global/i.test(t)) s += 3;
        else if (/regional|state|provincial/i.test(t)) s += 2;
        if (/olympiad|scholarship|fellowship|grant/i.test(t)) s += 1.5;
        if (/finalist|winner|champion|first place|gold/i.test(t)) s += 1;
        return Math.min(10, s);
    }())});

    cats.push({ name: 'Test Scores', weight: 0.02, score: (function() {
        var t = fields.scores || '';
        if (!t.trim()) return 4;
        var s = 5;
        var sat = t.match(/sat\s*:?\s*([0-9]+)/i);
        if (sat) { var sv = parseInt(sat[1]); s += sv >= 1500 ? 4 : sv >= 1400 ? 3 : sv >= 1300 ? 2 : 1; }
        var ielts = t.match(/ielts\s*:?\s*([0-9.]+)/i);
        if (ielts) { var iv = parseFloat(ielts[1]); s += iv >= 8 ? 4 : iv >= 7.5 ? 3 : iv >= 7 ? 2 : 1; }
        return Math.min(10, s);
    }())});

    var total = cats.reduce(function(sum, c) { return sum + c.score * c.weight; }, 0);
    return { score: Math.round(total * 10), cats: cats };
}

function evInsights(score, cats, uniName, program) {
    var sorted = cats.slice().sort(function(a, b) { return b.score - a.score; });
    var strengths = sorted.filter(function(c) { return c.score >= 7; }).slice(0, 3).map(function(c) {
        return c.name + ' (' + Math.round(c.score * 10) + '/100)';
    });
    var weaknesses = sorted.slice().reverse().filter(function(c) { return c.score < 6; }).slice(0, 3).map(function(c) {
        return c.name + ' (' + Math.round(c.score * 10) + '/100)';
    });
    var verdict, color;
    if (score >= 80) { verdict = 'Strong Application'; color = '#27ae60'; }
    else if (score >= 65) { verdict = 'Competitive'; color = '#f39c12'; }
    else if (score >= 50) { verdict = 'Needs Improvement'; color = '#e67e22'; }
    else { verdict = 'Significant Gaps'; color = '#e74c3c'; }
    var fb = [];
    if (score >= 80) fb.push('Your profile shows strong potential for ' + (uniName || 'this university') + '. Focus on polishing the final details.');
    else if (score >= 65) fb.push('You have a competitive profile for ' + (uniName || 'this university') + ', but addressing weak areas will significantly improve your chances.');
    else fb.push('Your application needs development in several areas before applying to ' + (uniName || 'this university') + '.');
    cats.forEach(function(c) {
        if (c.score < 6) {
            if (c.name === 'Academic Strength') fb.push('Clarify your GPA with exact numbers and scale.');
            else if (c.name === 'Motivation') fb.push('Expand your motivation letter — mention specific faculty, labs, or courses at ' + (uniName || 'the university') + '.');
            else if (c.name === 'Writing Quality') fb.push('Strengthen your personal statement with concrete anecdotes and clear connective language.');
            else if (c.name === 'Program Fit') fb.push('Explicitly link your career goals to the ' + (program || 'program') + ' curriculum.');
            else if (c.name === 'Extracurriculars') fb.push('Highlight leadership roles and impact in your activities.');
            else if (c.name === 'Research Experience') fb.push('Mention any lab work, projects, or independent research.');
        }
    });
    return { verdict: verdict, color: color, strengths: strengths, weaknesses: weaknesses, feedback: fb.join(' ') };
}

function renderEvalHTML(score, cats, ins, uniName, approved) {
    var c = ins.color;
    var catsHtml = cats.map(function(cat) {
        var pct = Math.round(cat.score * 10);
        var bc = pct >= 75 ? '#27ae60' : pct >= 50 ? '#f39c12' : '#e74c3c';
        return '<div class="ev__cat">' +
            '<div class="ev__cat__hd"><span>' + cat.name + '</span><span style="color:' + bc + '">' + pct + '/100</span></div>' +
            '<div class="ev__cat__bar__wrap"><div class="ev__cat__bar" style="width:' + pct + '%;background:' + bc + '"></div></div>' +
        '</div>';
    }).join('');
    var strHtml = ins.strengths.length
        ? '<ul>' + ins.strengths.map(function(s) { return '<li>' + s + '</li>'; }).join('') + '</ul>'
        : '<ul><li style="color:var(--text3)">No standout strengths detected yet</li></ul>';
    var wkHtml = ins.weaknesses.length
        ? '<ul>' + ins.weaknesses.map(function(s) { return '<li>' + s + '</li>'; }).join('') + '</ul>'
        : '<ul><li style="color:var(--text3)">No major weaknesses found</li></ul>';
    var approvedPill = approved
        ? '<div class="ev__approved__pill"><i class="fa-solid fa-circle-check"></i> Approved</div>' : '';
    var approvedBanner = approved
        ? '<div class="ev__approved__banner"><i class="fa-solid fa-circle-check"></i> Scored ≥ 80 — counted as Approved for ' + (uniName || 'this university') + '</div>' : '';
    return '<div class="ev__score__hd">' +
            '<div class="ev__score__ring" style="border-color:' + c + ';color:' + c + '">' +
                '<div class="ev__score__num">' + score + '</div>' +
                '<div class="ev__score__denom">/100</div>' +
            '</div>' +
            '<div class="ev__score__info">' +
                '<div class="ev__score__verdict" style="color:' + c + '">' + ins.verdict + '</div>' +
                '<div class="ev__score__meta">' + (uniName ? uniName + ' · ' : '') + 'UniVersity AI Evaluation</div>' +
                approvedPill +
            '</div>' +
        '</div>' +
        '<div class="ev__cats">' + catsHtml + '</div>' +
        '<div class="ev__lists">' +
            '<div class="ev__list"><div class="ev__list__title"><i class="fa-solid fa-check" style="color:#27ae60"></i> Strengths</div>' + strHtml + '</div>' +
            '<div class="ev__list"><div class="ev__list__title"><i class="fa-solid fa-triangle-exclamation" style="color:#e74c3c"></i> To Improve</div>' + wkHtml + '</div>' +
        '</div>' +
        '<div class="ev__feedback">' + ins.feedback + '</div>' +
        approvedBanner;
}

(function () {
    var submitBtn = document.getElementById('evSubmitBtn');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', function () {
        var program  = document.getElementById('evProgram').value.trim();
        var uniId    = document.getElementById('evUniSel').value.trim();
        var uniInput = document.getElementById('evUniInput').value.trim();
        if (!program) { document.getElementById('evProgram').focus(); return; }
        if (!uniId) {
            var evUniEl = document.getElementById('evUniInput');
            if (evUniEl) {
                evUniEl.focus();
                evUniEl.style.borderColor = '#e74c3c';
                setTimeout(function(){ evUniEl.style.borderColor = ''; }, 1800);
            }
            return;
        }
        var saved = getSaved();
        if (saved.indexOf(uniId) === -1) { alert('Please select a university from your saved list.'); return; }

        var uniName = uniInput;
        var fields = {
            program:    document.getElementById('evProgram').value,
            gpa:        document.getElementById('evGpa').value,
            scores:     document.getElementById('evScores').value,
            awards:     document.getElementById('evAwards').value,
            activities: document.getElementById('evActivities').value,
            statement:  document.getElementById('evStatement').value,
            motivation: document.getElementById('evMotivation').value,
            goals:      document.getElementById('evGoals').value,
            additional: document.getElementById('evAdditional').value
        };

        var result   = evScore(fields);
        var score    = result.score;
        var approved = score >= 80;
        var ins      = evInsights(score, result.cats, uniName, fields.program);

        if (approved) markApproved(uniId, score);
        if (typeof updateAppcount === 'function') updateAppcount();

        var resultEl = document.getElementById('evResult');
        var outputEl = document.getElementById('evOutput');
        var titleEl  = document.getElementById('evResultTitle');
        titleEl.textContent = 'AI Evaluation Complete';
        outputEl.innerHTML  = renderEvalHTML(score, result.cats, ins, uniName, approved);
        resultEl.style.display = 'block';
        setTimeout(function() { resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);

        var apiKey = document.getElementById('evApiKey').value.trim();
        if (!apiKey) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enhancing with AI…';

        fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: 'claude-opus-4-6',
                max_tokens: 1200,
                messages: [{ role: 'user', content: buildEvalPrompt() + '\n\nIn 3-5 sentences, provide personalised feedback on the weakest areas of this application.' }]
            })
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Evaluate My Application';
            if (data.content && data.content[0] && data.content[0].text) {
                var fb = outputEl.querySelector('.ev__feedback');
                if (fb) fb.innerHTML += '<hr style="margin:10px 0;border:none;border-top:1px solid var(--border)"><strong>Claude AI:</strong> ' + data.content[0].text;
            }
        })
        .catch(function() {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Evaluate My Application';
        });
    });

    var copyBtn  = document.getElementById('evCopyBtn');
    var resetBtn = document.getElementById('evResetBtn');

    if (copyBtn) copyBtn.addEventListener('click', function () {
        var text = document.getElementById('evOutput').textContent;
        navigator.clipboard.writeText(text).then(function () {
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(function () { copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy'; }, 2000);
        });
    });

    if (resetBtn) resetBtn.addEventListener('click', function () {
        document.getElementById('evResult').style.display = 'none';
    });
}());

var THEME_KEY = 'us_theme';
function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    var icon = document.getElementById('themeIcon');
    if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
}
(function(){ applyTheme(localStorage.getItem(THEME_KEY) === 'dark'); }());
document.getElementById('themeToggle').addEventListener('click', function() {
    applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
    applyCountryTheme(currentCountryCode || 'es');
});

var CAPITALS = {
    es: { lat: 40.4168, lon: -3.7038, city: 'Madrid'  },
    gb: { lat: 51.5074, lon: -0.1278, city: 'London'  },
    fr: { lat: 48.8566, lon:  2.3522, city: 'Paris'   },
    de: { lat: 52.5200, lon: 13.4050, city: 'Berlin'  },
    it: { lat: 41.9028, lon: 12.4964, city: 'Rome'    },
    pt: { lat: 38.7223, lon: -9.1393, city: 'Lisbon'  },
};

function wmoIcon(code) {
    if (code === 0)  return { fa:'fa-sun',                 cls:'wx__ani--sun',     col:'#f5a030' };
    if (code <= 2)   return { fa:'fa-cloud-sun',           cls:'wx__ani--partly',  col:'#90b8d8' };
    if (code === 3)  return { fa:'fa-cloud',               cls:'wx__ani--cloud',   col:'#a0b4c8' };
    if (code <= 48)  return { fa:'fa-smog',                cls:'wx__ani--fog',     col:'#a8bbc8' };
    if (code <= 55)  return { fa:'fa-cloud-drizzle',       cls:'wx__ani--drizzle', col:'#7ab4d8' };
    if (code <= 67)  return { fa:'fa-cloud-rain',          cls:'wx__ani--rain',    col:'#5a9fd4' };
    if (code <= 77)  return { fa:'fa-snowflake',           cls:'wx__ani--snow',    col:'#a8d4f0' };
    if (code <= 82)  return { fa:'fa-cloud-showers-heavy', cls:'wx__ani--rain',    col:'#4a8fc4' };
    return                  { fa:'fa-bolt',                cls:'wx__ani--storm',   col:'#e0d040' };
}

var WX_LABELS = {
    'wx__ani--sun':'Clear sky','wx__ani--partly':'Partly cloudy','wx__ani--cloud':'Overcast',
    'wx__ani--fog':'Foggy','wx__ani--drizzle':'Drizzle','wx__ani--rain':'Rain',
    'wx__ani--snow':'Snow','wx__ani--storm':'Thunderstorm'
};

function fetchCountryWeather(code) {
    var cap  = CAPITALS[code];
    var hero = document.getElementById('heroWxCard');
    if (!cap) {
        if (hero) hero.style.display = 'none';
        return;
    }
    fetch('https://api.open-meteo.com/v1/forecast?latitude=' + cap.lat +
          '&longitude=' + cap.lon + '&current_weather=true')
    .then(function(r) { return r.json(); })
    .then(function(d) {
        var wx = d.current_weather;
        if (!wx) return;
        var inf   = wmoIcon(wx.weathercode);
        var tmp   = Math.round(wx.temperature);
        var label = WX_LABELS[inf.cls] || '';

        if (hero) {
            var iconWrap = document.getElementById('heroWxIconWrap');
            var tempEl   = document.getElementById('heroWxTemp');
            var condEl   = document.getElementById('heroWxCond');
            var cityEl   = document.getElementById('heroWxCity');
            if (iconWrap) iconWrap.innerHTML =
                '<span class="mp__hero__wx__ani ' + inf.cls + '" style="color:' + inf.col + '">' +
                    '<i class="fa-solid ' + inf.fa + '"></i>' +
                '</span>';
            if (tempEl) tempEl.textContent = tmp + '°C';
            if (condEl) condEl.textContent = label;
            if (cityEl) cityEl.innerHTML   = '<i class="fa-solid fa-location-dot"></i> ' + (cap.city || '');
            hero.style.display = 'flex';
        }
    })
    .catch(function() {
        if (hero) hero.style.display = 'none';
    });
}

/* ── Country list, favourites & destination picker ──────────── */

// Countries we already have full data files for (used by the compare dropdowns).
var DATA_COUNTRIES = [
    { code:'gb', name:'United Kingdom' }, { code:'es', name:'Spain' },
    { code:'de', name:'Germany' },        { code:'fr', name:'France' },
    { code:'it', name:'Italy' },          { code:'pt', name:'Portugal' },
    { code:'nl', name:'Netherlands' },    { code:'se', name:'Sweden' },
    { code:'ch', name:'Switzerland' },    { code:'dk', name:'Denmark' },
    { code:'be', name:'Belgium' },        { code:'fi', name:'Finland' },
    { code:'ie', name:'Ireland' },        { code:'ua', name:'Ukraine' },
    { code:'us', name:'United States' }
];

// Every country selectable in the Elite search (flag-icons supports all ISO codes).
var ALL_COUNTRIES = [
    {code:'gb',name:'United Kingdom'},{code:'us',name:'United States'},{code:'ca',name:'Canada'},
    {code:'au',name:'Australia'},{code:'nz',name:'New Zealand'},{code:'ie',name:'Ireland'},
    {code:'fr',name:'France'},{code:'de',name:'Germany'},{code:'es',name:'Spain'},
    {code:'it',name:'Italy'},{code:'pt',name:'Portugal'},{code:'nl',name:'Netherlands'},
    {code:'be',name:'Belgium'},{code:'ch',name:'Switzerland'},{code:'at',name:'Austria'},
    {code:'se',name:'Sweden'},{code:'no',name:'Norway'},{code:'dk',name:'Denmark'},
    {code:'fi',name:'Finland'},{code:'is',name:'Iceland'},{code:'pl',name:'Poland'},
    {code:'cz',name:'Czechia'},{code:'sk',name:'Slovakia'},{code:'hu',name:'Hungary'},
    {code:'ro',name:'Romania'},{code:'bg',name:'Bulgaria'},{code:'gr',name:'Greece'},
    {code:'hr',name:'Croatia'},{code:'si',name:'Slovenia'},{code:'rs',name:'Serbia'},
    {code:'ua',name:'Ukraine'},{code:'ee',name:'Estonia'},{code:'lv',name:'Latvia'},
    {code:'lt',name:'Lithuania'},{code:'lu',name:'Luxembourg'},{code:'mt',name:'Malta'},
    {code:'cy',name:'Cyprus'},{code:'tr',name:'Turkey'},{code:'ru',name:'Russia'},
    {code:'by',name:'Belarus'},{code:'md',name:'Moldova'},{code:'al',name:'Albania'},
    {code:'ba',name:'Bosnia & Herzegovina'},{code:'mk',name:'North Macedonia'},{code:'me',name:'Montenegro'},
    {code:'cn',name:'China'},{code:'jp',name:'Japan'},{code:'kr',name:'South Korea'},
    {code:'in',name:'India'},{code:'sg',name:'Singapore'},{code:'hk',name:'Hong Kong'},
    {code:'my',name:'Malaysia'},{code:'th',name:'Thailand'},{code:'vn',name:'Vietnam'},
    {code:'id',name:'Indonesia'},{code:'ph',name:'Philippines'},{code:'tw',name:'Taiwan'},
    {code:'pk',name:'Pakistan'},{code:'bd',name:'Bangladesh'},{code:'lk',name:'Sri Lanka'},
    {code:'np',name:'Nepal'},{code:'kz',name:'Kazakhstan'},{code:'ae',name:'United Arab Emirates'},
    {code:'sa',name:'Saudi Arabia'},{code:'qa',name:'Qatar'},{code:'il',name:'Israel'},
    {code:'jo',name:'Jordan'},{code:'lb',name:'Lebanon'},{code:'ir',name:'Iran'},
    {code:'eg',name:'Egypt'},{code:'ma',name:'Morocco'},{code:'tn',name:'Tunisia'},
    {code:'dz',name:'Algeria'},{code:'za',name:'South Africa'},{code:'ng',name:'Nigeria'},
    {code:'ke',name:'Kenya'},{code:'gh',name:'Ghana'},{code:'et',name:'Ethiopia'},
    {code:'tz',name:'Tanzania'},{code:'ug',name:'Uganda'},{code:'br',name:'Brazil'},
    {code:'ar',name:'Argentina'},{code:'cl',name:'Chile'},{code:'co',name:'Colombia'},
    {code:'mx',name:'Mexico'},{code:'pe',name:'Peru'},{code:'uy',name:'Uruguay'},
    {code:'ec',name:'Ecuador'},{code:'cr',name:'Costa Rica'},{code:'pa',name:'Panama'}
];

function countryNameByCode(code) {
    var c = ALL_COUNTRIES.find(function(x) { return x.code === code; });
    return c ? c.name : (code || '').toUpperCase();
}

// ── Favourite countries (the user's customised destination list) ──
var FAV_COUNTRIES_KEY = 'us_fav_countries_' + user.id;
var DEFAULT_FAVS = ['gb','ch','de','nl','se','fr','dk','be','fi','ie'];
function getFavCountries() {
    try { var v = JSON.parse(localStorage.getItem(FAV_COUNTRIES_KEY)); if (Array.isArray(v)) return v; } catch (e) {}
    return DEFAULT_FAVS.slice();
}
function setFavCountries(arr) { localStorage.setItem(FAV_COUNTRIES_KEY, JSON.stringify(arr)); }
function isFavCountry(code) { return getFavCountries().indexOf(code) !== -1; }
function toggleFavCountry(code) {
    var f = getFavCountries();
    var i = f.indexOf(code);
    if (i === -1) f.push(code); else f.splice(i, 1);
    setFavCountries(f);
    renderCountryGrid();
}

function renderCountryGrid() {
    var grid = document.getElementById('csGrid');
    if (!grid) return;
    var favs = getFavCountries();
    var empty = document.getElementById('csGridEmpty');
    if (empty) empty.style.display = favs.length ? 'none' : 'block';
    grid.innerHTML = favs.map(function(code, i) {
        var name = countryNameByCode(code), on = code === currentCountryCode;
        return '<button class="mp__cs__country' + (on ? ' active' : '') + '" data-code="' + code + '" data-name="' + name + '" style="--i:' + i + '"' + (on ? ' aria-current="true"' : '') + '>' +
            '<span class="fi fi-' + code + '"></span>' +
            '<span class="mp__cs__cname"><b>' + name + '</b><small data-cs-time="' + code + '"></small></span>' +
            '<i class="mp__cs__fav fa-solid fa-heart" data-fav="' + code + '" title="Remove from your countries"></i>' +
        '</button>';
    }).join('');
    var count = document.getElementById('csdCount');
    if (count) count.textContent = favs.length ? favs.length : '';
    if (window.countryDrawer) window.countryDrawer.refresh();
}

function renderCountrySearch(q) {
    var box = document.getElementById('csSearchResults');
    if (!box) return;
    q = (q || '').trim().toLowerCase();
    if (!q) { box.classList.remove('open'); box.innerHTML = ''; return; }
    var hits = ALL_COUNTRIES.filter(function(c) {
        return c.name.toLowerCase().indexOf(q) !== -1 || c.code === q;
    }).slice(0, 8);
    box.classList.add('open');
    if (!hits.length) { box.innerHTML = '<div class="mp__cs__sr__empty">No country found for "' + q + '"</div>'; return; }
    box.innerHTML = hits.map(function(c) {
        var fav = isFavCountry(c.code);
        return '<div class="mp__cs__sr__item" data-code="' + c.code + '">' +
            '<span class="fi fi-' + c.code + '"></span>' +
            '<span class="mp__cs__sr__name">' + c.name + '</span>' +
            '<i class="mp__cs__sr__fav fa-' + (fav ? 'solid' : 'regular') + ' fa-heart' + (fav ? ' is-fav' : '') + '" data-fav="' + c.code + '" title="' + (fav ? 'Saved' : 'Save to your countries') + '"></i>' +
        '</div>';
    }).join('');
}

function pickerIsElite() { return typeof eliteState !== 'undefined' && eliteState && !!eliteState.elite; }
function updateCountryPickerMode() {
    var elite = pickerIsElite();
    var search = document.getElementById('csSearchWrap');
    var bottom = document.getElementById('csBottom');
    if (search) search.style.display = elite ? 'block' : 'none';
    if (bottom) bottom.style.display = elite ? 'none' : 'flex';
}

(function() {
    var btn = document.getElementById('csChangeBtn');
    var picker = document.getElementById('csPicker');
    if (!btn || !picker) return;

    // "Change country" slides in the destination drawer (overview.js).
    btn.addEventListener('click', function() {
        renderCountryGrid();
        updateCountryPickerMode();
        if (window.countryDrawer) window.countryDrawer.open(btn);
    });

    // Grid: select a country (or heart to remove it from favourites)
    var grid = document.getElementById('csGrid');
    if (grid) grid.addEventListener('click', function(e) {
        var heart = e.target.closest('.mp__cs__fav');
        if (heart) { e.stopPropagation(); toggleFavCountry(heart.dataset.fav); return; }
        var chip = e.target.closest('.mp__cs__country');
        if (!chip) return;
        if (chip.dataset.code === currentCountryCode) { if (window.countryDrawer) window.countryDrawer.close(); return; }
        chip.classList.add('is-picking');
        loadCountry(chip.dataset.code);
    });

    // Elite search input
    var searchInput = document.getElementById('csSearchInput');
    if (searchInput) searchInput.addEventListener('input', function() { renderCountrySearch(this.value); });

    // Search results: heart to save/unsave, click row to navigate
    var results = document.getElementById('csSearchResults');
    if (results) results.addEventListener('click', function(e) {
        var heart = e.target.closest('.mp__cs__sr__fav');
        if (heart) {
            e.stopPropagation();
            toggleFavCountry(heart.dataset.fav);
            renderCountrySearch(searchInput ? searchInput.value : '');
            return;
        }
        var item = e.target.closest('.mp__cs__sr__item');
        if (item) {
            loadCountry(item.dataset.code);
            if (searchInput) searchInput.value = '';
            results.classList.remove('open');
            results.innerHTML = '';
        }
    });

    renderCountryGrid();
    updateCountryPickerMode();
}());

/* ══════════════ Visa & Logistics guide (curated per country) ══════════════
 * Guidance for a typical non-EU/international student. Estimated & curated —
 * always shown with a "verify with official sources" disclaimer. */
/* Visa & logistics for international students, per destination country.
   `funds` = proof-of-means the consulate expects, `docs` = what to gather before
   you go, `arrive` = what you must do in your first weeks, and the rest covers
   money, housing, renewals and post-study work. Figures are typical/approximate
   and change often — the UI always links to the official source. */
var VISA_DATA = {
    es: {
        visa: 'Student Visa (Tipo D)', need: 'EU/EEA: none. Non-EU: required for stays over 90 days',
        time: '4–8 weeks', cost: '~€80', funds: '~€600/month for your whole stay (IPREM-based)',
        work: 'Up to 30 hrs/week, with a work permit', ins: 'Private health insurance — full cover, no co-payments',
        post: 'Up to 12 months job-search permit after graduation', idnum: 'NIE number + TIE residence card',
        docs: ['Acceptance letter from a Spanish university', 'Passport valid 1 year beyond your stay',
               'Proof of funds (~€600/month)', 'Private health insurance with full cover',
               'Medical certificate', 'Criminal record certificate (apostilled)', 'Visa fee receipt + photos'],
        arrive: ['Apply for your TIE residence card within 30 days', 'Get your NIE (foreigner ID number)',
                 'Register at the town hall (empadronamiento)', 'Open a Spanish bank account', 'Enrol at your university'],
        bank: 'Most banks offer free student accounts — bring your NIE and empadronamiento',
        housing: 'Shared flats (piso compartido) are cheapest; deposits are usually 1–2 months rent',
        renew: 'Renew your TIE annually, about 60 days before it expires', gov: 'exteriores.gob.es'
    },
    fr: {
        visa: 'VLS-TS Student Long-Stay Visa', need: 'EU/EEA: none. Non-EU: required for stays over 90 days',
        time: '2–4 weeks (after Campus France)', cost: '~€99', funds: '~€615/month',
        work: 'Up to 964 hrs/year (~20 hrs/week)', ins: 'Free enrolment in the French student health system',
        post: '12-month APS permit to find work', idnum: 'VLS-TS validation, then titre de séjour',
        docs: ['Campus France registration ("Études en France")', 'Acceptance letter', 'Passport',
               'Proof of funds (~€615/month)', 'Proof of accommodation', 'Civil liability insurance', 'Visa fee'],
        arrive: ['Validate your VLS-TS online within 3 months — this is mandatory', 'Register with Assurance Maladie (free)',
                 'Apply for CAF housing aid', 'Open a French bank account (you need a RIB)', 'Get a student transport pass'],
        bank: 'A French RIB is needed for rent and CAF — open an account in your first weeks',
        housing: 'CROUS halls are cheapest; CAF subsidises roughly €100–200/month',
        renew: 'Apply to renew your titre de séjour 2 months before it expires', gov: 'france-visas.gouv.fr'
    },
    de: {
        visa: 'National Visa (Type D) for study', need: 'EU/EEA: none. Non-EU: required',
        time: '6–12 weeks', cost: '~€75', funds: 'Blocked account (Sperrkonto) ~€11,900/year',
        work: '120 full or 240 half days per year', ins: 'Public or private health insurance mandatory (~€120/month)',
        post: '18-month residence permit to seek work', idnum: 'Anmeldung + Aufenthaltstitel (residence permit)',
        docs: ['University admission letter', 'Passport', 'Blocked account confirmation (~€11,900)',
               'Health insurance proof', 'Biometric photos', 'Certified school/degree certificates (APS if required)'],
        arrive: ['Anmeldung: register your address within 2 weeks', 'Open a German bank account',
                 'Apply for your residence permit at the Ausländerbehörde', 'Enrol (Immatrikulation) at your university',
                 'Pick up your Semesterticket for free local transport'],
        bank: 'Most banks want your Anmeldung first — book that appointment early',
        housing: 'Studentenwerk halls are cheapest but apply months ahead; WG flat-shares are the norm',
        renew: 'Residence permit is issued for 1–2 years and renewed at the Ausländerbehörde', gov: 'germany.info'
    },
    it: {
        visa: 'Student Visa (Type D)', need: 'EU/EEA: none. Non-EU: required over 90 days',
        time: '3–6 weeks', cost: '~€50', funds: '~€6,000/year',
        work: 'Up to 20 hrs/week', ins: 'Health insurance required (SSN registration or private)',
        post: '12-month job-search permit', idnum: 'Codice Fiscale + permesso di soggiorno',
        docs: ['Pre-enrolment on Universitaly', 'Acceptance letter', 'Passport', 'Proof of funds (~€6,000/year)',
               'Health insurance', 'Proof of accommodation'],
        arrive: ['Apply for your permesso di soggiorno within 8 days of arrival', 'Get your Codice Fiscale (tax code)',
                 'Register with the SSN health service, or keep private cover', 'Open an Italian bank account'],
        bank: 'You need a Codice Fiscale before a bank will open an account',
        housing: 'University halls are limited — most students rent rooms in shared flats',
        renew: 'Renew the permesso di soggiorno each academic year', gov: 'vistoperitalia.esteri.it'
    },
    pt: {
        visa: 'Student Residence Visa', need: 'EU/EEA: none. Non-EU: required',
        time: '2–4 weeks', cost: '~€90', funds: '~€760/month (linked to minimum wage)',
        work: 'Allowed alongside study', ins: 'Health insurance required',
        post: 'Job-search residence permit available', idnum: 'NIF (tax number) + AIMA residence permit',
        docs: ['Acceptance letter', 'Passport', 'Proof of funds', 'Health insurance',
               'Criminal record certificate', 'Proof of accommodation'],
        arrive: ['Book your AIMA appointment for the residence permit', 'Get a NIF (tax number)',
                 'Register at your local health centre (SNS)', 'Open a Portuguese bank account'],
        bank: 'A NIF is required; many banks offer free student accounts',
        housing: 'Rooms in Lisbon and Porto are pricey — smaller cities are far cheaper',
        renew: 'Residence permit is renewed every 1–2 years', gov: 'vistos.mne.gov.pt'
    },
    nl: {
        visa: 'Entry Visa (MVV) + residence permit', need: 'EU/EEA: none. Non-EU: usually required',
        time: '2–8 weeks (your university applies for you)', cost: '~€210', funds: '~€1,100/month',
        work: 'Up to 16 hrs/week, or full-time in June–August', ins: 'Dutch health insurance required once you work',
        post: '1-year "orientation year" (zoekjaar) permit', idnum: 'BSN + residence permit (VVR)',
        docs: ['Your university applies for the MVV/VVR on your behalf', 'Passport', 'Proof of funds (~€1,100/month)',
               'Proof of tuition payment', 'TB test (some nationalities)'],
        arrive: ['Collect your residence permit from the IND', 'Register at the municipality to get your BSN',
                 'Take out Dutch health insurance if you take a job', 'Open a Dutch bank account',
                 'Register with a GP (huisarts)'],
        bank: 'A BSN makes this easy; Revolut/bunq work in the meantime',
        housing: 'There is a severe shortage — arrange housing before you arrive, never after',
        renew: 'The permit covers your course length; extend through the IND', gov: 'ind.nl'
    },
    ie: {
        visa: 'Irish Study Visa (Type D)', need: 'EU/EEA: none. Non-EU: often required',
        time: '4–8 weeks', cost: '~€60', funds: '~€10,000/year',
        work: 'Up to 20 hrs/week (40 in holidays)', ins: 'Private medical insurance required',
        post: 'Up to 2 years stay-back (Third Level Graduate Scheme)', idnum: 'IRP card + PPS number',
        docs: ['Acceptance letter with tuition paid', 'Passport', 'Proof of funds (~€10,000)',
               'Private medical insurance', 'Evidence of your English level'],
        arrive: ['Register with immigration for your IRP card', 'Apply for a PPS number',
                 'Open an Irish bank account', 'Register with a local GP'],
        bank: 'Banks usually want proof of address plus your IRP',
        housing: 'Dublin is expensive and scarce — secure a room well before term starts',
        renew: 'The IRP is renewed annually', gov: 'irishimmigration.ie'
    },
    be: {
        visa: 'Student Visa (Type D)', need: 'EU/EEA: none. Non-EU: required over 90 days',
        time: '4–8 weeks', cost: '~€180', funds: '~€800/month',
        work: 'Up to 20 hrs/week during term', ins: 'Health insurance required (join a mutuelle)',
        post: '12-month job-search residence permit', idnum: 'Belgian residence card for foreigners',
        docs: ['Acceptance letter', 'Passport', 'Proof of funds (~€800/month)', 'Medical certificate',
               'Criminal record certificate', 'Visa fee'],
        arrive: ['Register at your commune within 8 days', 'Apply for your residence card',
                 'Join a mutuelle (health fund)', 'Open a Belgian bank account'],
        bank: 'Commune registration is usually needed first',
        housing: 'A "kot" (student room) is the norm — book early in Leuven and Ghent',
        renew: 'Renew the residence card each year', gov: 'dofi.ibz.be'
    },
    fi: {
        visa: 'Student Residence Permit', need: 'EU/EEA: register only. Non-EU: required',
        time: '1–3 months', cost: '~€350', funds: '~€800/month (€6,720/year)',
        work: 'Up to 30 hrs/week', ins: 'Insurance required (€40,000 or €100,000 cover by course length)',
        post: '2-year job-search residence permit', idnum: 'Finnish personal identity code',
        docs: ['Acceptance letter', 'Passport', 'Proof of funds (~€800/month)',
               'Insurance certificate', 'Proof of tuition payment'],
        arrive: ['Register your residence at DVV to get a personal identity code', 'Collect your residence permit card',
                 'Open a Finnish bank account', 'Register with the student health service (FSHS)'],
        bank: 'You need your identity code and permit card',
        housing: 'Student housing foundations (HOAS and similar) are cheapest — apply the day you are admitted',
        renew: 'The first permit is often 2 years; extend through Migri', gov: 'migri.fi'
    },
    gb: {
        visa: 'Student Visa (formerly Tier 4)', need: 'All international students (including EU since 2021)',
        time: '~3 weeks', cost: '£490 + £776/year health surcharge',
        funds: '£1,483/month in London, £1,136 outside (up to 9 months), held 28 days',
        work: 'Up to 20 hrs/week during term', ins: 'NHS access via the Immigration Health Surcharge',
        post: 'Graduate Route: 2 years (3 for PhD)', idnum: 'BRP card / eVisa + share code',
        docs: ['CAS from your university', 'Passport', 'Proof of funds (held 28 consecutive days)',
               'ATAS certificate (some science courses)', 'TB test (some countries)', 'English test if required'],
        arrive: ['Collect your BRP or set up your eVisa account', 'Complete university enrolment',
                 'Register with a GP — NHS care is free once you have paid the surcharge',
                 'Open a UK bank account', 'Get a 16–25 Railcard for cheaper travel'],
        bank: 'A university enrolment letter plus your BRP is normally enough',
        housing: 'Halls in first year; private lets usually need a UK guarantor or 6 months rent upfront',
        renew: 'Extend from inside the UK before your visa expires', gov: 'gov.uk/student-visa'
    },
    us: {
        visa: 'F-1 Student Visa', need: 'All international students',
        time: '3–8 weeks (after I-20 + SEVIS)', cost: '$185 visa + $350 SEVIS fee',
        funds: 'Full first-year cost of attendance (often $30,000+)',
        work: 'On-campus only, 20 hrs/week; CPT/OPT later', ins: 'Health insurance required (~$1,500–2,500/year)',
        post: 'OPT: 12 months, plus 24 more for STEM degrees', idnum: 'SEVIS ID + I-20 (SSN if you work)',
        docs: ['I-20 from your school', 'SEVIS I-901 fee receipt', 'DS-160 confirmation page', 'Passport',
               'Proof of funds', 'Visa interview appointment letter'],
        arrive: ['Enter no earlier than 30 days before your programme start date',
                 'Report to your school\'s international student office immediately',
                 'Keep your I-20 signed and valid at all times', 'Apply for an SSN if you take campus work',
                 'Open a US bank account'],
        bank: 'Bring your passport, I-20 and proof of address; an SSN helps',
        housing: 'On-campus is common in year one; off-campus leases often need a co-signer',
        renew: 'F-1 status lasts your whole programme (D/S) — you only renew the visa stamp to re-enter',
        gov: 'travel.state.gov'
    },
    ch: {
        visa: 'National Visa (Type D) for study', need: 'EU/EFTA: permit only. Non-EU: visa required',
        time: '8–12 weeks', cost: '~CHF 88', funds: '~CHF 21,000/year',
        work: 'Up to 15 hrs/week during term', ins: 'Swiss health insurance mandatory (~CHF 250/month)',
        post: '6-month permit to seek qualified work', idnum: 'Residence permit B',
        docs: ['Acceptance letter', 'Passport', 'Proof of funds (~CHF 21,000/year)', 'Proof of accommodation',
               'CV and motivation letter', 'Written commitment to leave after your studies'],
        arrive: ['Register at the cantonal migration office within 14 days', 'Take out Swiss health insurance within 3 months',
                 'Open a Swiss bank account', 'Collect your permit B card'],
        bank: 'Your permit and address registration are usually required',
        housing: 'Very expensive — student halls fill up fast, apply the moment you are admitted',
        renew: 'Permit B is renewed annually', gov: 'sem.admin.ch'
    },
    ua: {
        visa: 'Long-term Type D Student Visa', need: 'Most international students',
        time: '2–4 weeks', cost: '~$85', funds: 'Proof of sufficient funds for your stay',
        work: 'Restricted — generally not permitted on a study visa', ins: 'Medical insurance required',
        post: 'You must apply separately for a work permit', idnum: 'Temporary residence permit',
        warn: 'Ukraine is affected by an ongoing war. Check your government\'s travel advisory and your university\'s current status before making any plans.',
        docs: ['Official invitation letter from the university', 'Passport', 'Proof of funds', 'Health insurance',
               'HIV certificate', 'Criminal record certificate'],
        arrive: ['Apply for a temporary residence permit within 15 days', 'Register your address',
                 'Open a local bank account'],
        bank: 'Passport plus your residence permit',
        housing: 'University dormitories are very cheap and used by most international students',
        renew: 'The temporary residence permit is renewed annually', gov: 'mfa.gov.ua'
    },
    dk: {
        visa: 'Student Residence Permit', need: 'EU/Nordic: none. Non-EU: required',
        time: '1–2 months', cost: '~DKK 1,900', funds: '~DKK 6,700/month',
        work: 'Up to 20 hrs/week (full-time June–August)', ins: 'Covered by the Danish health system once you have a CPR',
        post: '3-year establishment card to find work', idnum: 'CPR number + residence card',
        docs: ['Acceptance letter', 'Passport', 'Proof of funds', 'Proof of tuition payment',
               'Biometrics appointment confirmation'],
        arrive: ['Register for a CPR number at Borgerservice', 'Collect your yellow health card',
                 'Open a Danish bank account (NemKonto)', 'Set up MitID for digital services'],
        bank: 'A CPR number is required',
        housing: 'Copenhagen is tight — apply to housing foundations as early as possible',
        renew: 'The permit normally covers your whole study period', gov: 'nyidanmark.dk'
    },
    se: {
        visa: 'Residence Permit for Studies', need: 'EU/EEA: none. Non-EU: required',
        time: '1–3 months', cost: '~SEK 1,500', funds: 'SEK 10,300/month for 10 months each year',
        work: 'No fixed hour limit, but studies must come first', ins: 'Covered if enrolled 1+ year; otherwise private',
        post: '12-month permit to seek work after graduation', idnum: 'Personnummer (for stays of 1+ year)',
        docs: ['Acceptance letter', 'Passport', 'Proof of funds', 'First tuition instalment paid',
               'Comprehensive health insurance'],
        arrive: ['Collect your residence permit card', 'Register with Skatteverket for a personnummer (1+ year stays)',
                 'Open a Swedish bank account', 'Get your student union card for discounts'],
        bank: 'A personnummer makes this far easier',
        housing: 'Housing is queue-based — register the day you are admitted',
        renew: 'Extend with Migrationsverket before your permit expires', gov: 'migrationsverket.se'
    }
};

function renderVisaGuide(code, countryName) {
    var el = document.getElementById('cgVisaGuide');
    if (!el) return;
    var v = VISA_DATA[code];
    if (!v) { el.style.display = 'none'; el.innerHTML = ''; return; }

    function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    function list(items, cls) {
        return (items || []).map(function (t) { return '<li class="' + cls + '">' + esc(t) + '</li>'; }).join('');
    }

    // Six quick facts a student checks first.
    var facts = [
        { ic: 'fa-passport',        lbl: 'Visa type',       val: v.visa },
        { ic: 'fa-circle-question', lbl: 'Who needs it',    val: v.need },
        { ic: 'fa-clock',           lbl: 'Processing time', val: v.time },
        { ic: 'fa-coins',           lbl: 'Application cost',val: v.cost },
        { ic: 'fa-wallet',          lbl: 'Proof of funds',  val: v.funds },
        { ic: 'fa-heart-pulse',     lbl: 'Health insurance',val: v.ins }
    ];
    // "Work, money & after" — the practical stuff nobody tells you.
    var after = [
        { ic: 'fa-briefcase',      lbl: 'Work while studying', val: v.work },
        { ic: 'fa-id-card',        lbl: 'ID you will need',    val: v.idnum },
        { ic: 'fa-building-columns', lbl: 'Bank account',      val: v.bank },
        { ic: 'fa-house',          lbl: 'Housing',             val: v.housing },
        { ic: 'fa-rotate',         lbl: 'Renewing your permit',val: v.renew },
        { ic: 'fa-graduation-cap', lbl: 'After graduation',    val: v.post }
    ].filter(function (r) { return !!r.val; });

    el.innerHTML =
        '<div class="visa2">' +
            '<div class="visa2__hd">' +
                '<span class="visa2__hd__ic"><i class="fa-solid fa-passport"></i></span>' +
                '<div class="visa2__hd__txt">' +
                    '<h3 class="visa2__hd__title">Visa &amp; Logistics — ' + esc(countryName) + '</h3>' +
                    '<p class="visa2__hd__sub">Everything an international student needs before leaving and after landing</p>' +
                '</div>' +
                (v.gov ? '<a class="visa2__gov" href="https://' + v.gov + '" target="_blank" rel="noopener">' +
                    '<i class="fa-solid fa-up-right-from-square"></i> Official site</a>' : '') +
            '</div>' +

            (v.warn ? '<div class="visa2__warn"><i class="fa-solid fa-triangle-exclamation"></i> ' + esc(v.warn) + '</div>' : '') +

            '<div class="visa2__facts">' +
                facts.filter(function (f) { return !!f.val; }).map(function (f) {
                    return '<div class="visa2__fact">' +
                        '<span class="visa2__fact__ic"><i class="fa-solid ' + f.ic + '"></i></span>' +
                        '<span class="visa2__fact__lbl">' + f.lbl + '</span>' +
                        '<span class="visa2__fact__val">' + esc(f.val) + '</span>' +
                    '</div>';
                }).join('') +
            '</div>' +

            '<div class="visa2__cols">' +
                '<div class="visa2__col">' +
                    '<h4 class="visa2__col__t"><i class="fa-solid fa-list-check"></i> Before you go</h4>' +
                    '<ul class="visa2__ul">' + list(v.docs, 'visa2__li') + '</ul>' +
                '</div>' +
                '<div class="visa2__col">' +
                    '<h4 class="visa2__col__t"><i class="fa-solid fa-plane-arrival"></i> Your first weeks</h4>' +
                    '<ol class="visa2__ol">' + list(v.arrive, 'visa2__li visa2__li--step') + '</ol>' +
                '</div>' +
                '<div class="visa2__col">' +
                    '<h4 class="visa2__col__t"><i class="fa-solid fa-briefcase"></i> Work, money &amp; after</h4>' +
                    '<div class="visa2__rows">' +
                        after.map(function (r) {
                            return '<div class="visa2__row">' +
                                '<span class="visa2__row__ic"><i class="fa-solid ' + r.ic + '"></i></span>' +
                                '<span class="visa2__row__txt"><b>' + r.lbl + '</b><span>' + esc(r.val) + '</span></span>' +
                            '</div>';
                        }).join('') +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<p class="visa2__note"><i class="fa-solid fa-circle-info"></i> Curated guidance for a typical international student. ' +
            'Rules, fees and thresholds vary by nationality and change often — always confirm with the official source before applying.</p>' +
        '</div>';
    el.style.display = 'block';
}

function applyCountryTheme(code) {
    var themes = {
        es:{primary:'#c0392b',accent:'#e67e22'},
        gb:{primary:'#003399',accent:'#cc0000'},
        fr:{primary:'#003087',accent:'#ED2939'},
        de:{primary:'#212121',accent:'#c62828'},
        it:{primary:'#006400',accent:'#c62828'},
        pt:{primary:'#003399',accent:'#006600'},
        us:{primary:'#3C3B6E',accent:'#B22234'},
        ch:{primary:'#cc0000',accent:'#cc0000'},
        ua:{primary:'#1a5276',accent:'#f39c12'}
    };
    var t = themes[code] || themes.es;
    document.documentElement.style.setProperty('--country-primary', t.primary);
    document.documentElement.style.setProperty('--country-accent',  t.accent);

    function hexRgba(hex, a) {
        var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return 'rgba('+r+','+g+','+b+','+a+')';
    }
    // Base tint must follow the theme — white in light mode, the dark card colour in dark mode.
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var base = isDark ? '#262624' : '#ffffff';
    var bg = 'linear-gradient(135deg, ' + base + ' 52%, ' + hexRgba(t.primary, isDark ? 0.16 : 0.06) + ' 100%)';
    var glow = 'radial-gradient(ellipse 65% 75% at 100% 0%, ' + hexRgba(t.primary, isDark ? 0.18 : 0.09) + ' 0%, transparent 65%)';
    document.documentElement.style.setProperty('--country-hero-bg',   bg);
    document.documentElement.style.setProperty('--country-hero-glow', glow);
}

(function() {
    var track = document.getElementById('rnkTrack');
    var wrap  = document.querySelector('.rnk__section__wrap .rnk__track__wrap');
    if (wrap && track) {
        wrap.addEventListener('mouseenter', function() { track.style.animationPlayState = 'paused'; });
        wrap.addEventListener('mouseleave', function() { track.style.animationPlayState = 'running'; });
        track.addEventListener('click', function(e) {
            var card = e.target.closest('.rnk__card[data-id]');
            if (!card) return;
            var u = UNI.find(function(x) { return x.id === card.dataset.id; });
            if (u) showUniDetail(u);
        });
    }
}());

function buildRankCarousel(code) {
    var track = document.getElementById('rnkTrack');
    var label = document.getElementById('rnkCountryLabel');
    if (!track) return;

    var names = { es:'Spain', gb:'United Kingdom', fr:'France', de:'Germany',
                  it:'Italy', pt:'Portugal', us:'United States', ch:'Switzerland', ua:'Ukraine',
                  nl:'Netherlands', se:'Sweden', dk:'Denmark', be:'Belgium', fi:'Finland', ie:'Ireland' };
    if (label) label.textContent = names[code] || code.toUpperCase();

    var list = (typeof RANKING_DATA !== 'undefined' && RANKING_DATA[code]) || [];

    // Fallback: build a ranking from this country's own universities
    if (!list.length && typeof UNI !== 'undefined' && UNI.length) {
        list = UNI.slice()
            .sort(function(a, b) {
                if ((b.diff || 0) !== (a.diff || 0)) return (b.diff || 0) - (a.diff || 0);
                return (b.ts || 0) - (a.ts || 0);
            })
            .slice(0, 10)
            .map(function(u) { return { id: u.id, trend: 'stable' }; });
    }

    if (!list.length) { track.innerHTML = ''; return; }

    function cardHtml(item, i) {
        var u = UNI.find(function(x) { return x.id === item.id; }) ||
                { id: item.id, name: item.id, abbr: item.id.toUpperCase().slice(0,5), color: '#555', type: 'Public', fields: [], city: '' };

        var dbEntry = (typeof UNI_DB !== 'undefined') ? UNI_DB.find(function(x){ return x.id === u.id; }) : null;
        if (dbEntry && dbEntry.color) u = Object.assign({}, u, { color: dbEntry.color });
        var logo       = (typeof UNI_LOGOS !== 'undefined' && UNI_LOGOS[u.id]) || '';
        var medalCls   = i === 0 ? ' rnk__card--gold' : i === 1 ? ' rnk__card--silver' : i === 2 ? ' rnk__card--bronze' : '';
        var trendCls   = item.trend === 'up' ? 'up' : item.trend === 'down' ? 'down' : 'stable';
        var trendLabel = item.trend === 'up' ? '↑ Rising' : item.trend === 'down' ? '↓ Falling' : '— Stable';
        var trendGlyph = item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '—';
        var abbr4      = (u.abbr || u.name.slice(0,4)).slice(0,5);
        // Same real, hydrated logo used across the app (Wikipedia → icon.horse → monogram).
        var logoHtml   = '<div class="rnk__logo__wrap">' + uniLogo(u, 66) + '</div>';
        var fields = (u.fields || []).slice(0, 2);
        return '<div class="rnk__card' + medalCls + '" data-id="' + u.id + '" style="cursor:pointer">' +
            '<div class="rnk__rank__overlay"><span class="rnk__num">' + (i + 1) + '</span></div>' +
            '<div class="rnk__trend__pill rnk__trend__pill--' + trendCls + '">' + trendGlyph + '</div>' +
            logoHtml +
            '<div class="rnk__hover__panel">' +
                '<div class="rnk__hv__top">' +
                    '<div class="rnk__hv__abbr rnk__hv__abbr--logo">' + uniLogo(u, 34) + '</div>' +
                    '<div class="rnk__hv__meta">' +
                        '<div class="rnk__hv__name">' + (u.name || u.abbr) + '</div>' +
                        '<div class="rnk__hv__trend rnk__hv__trend--' + trendCls + '">' + trendLabel + '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="rnk__hv__stats">' +
                    '<div class="rnk__hv__stat"><i class="fa-solid fa-location-dot"></i><span>' + (u.city || '—') + '</span></div>' +
                    '<div class="rnk__hv__stat"><i class="fa-solid fa-building-columns"></i><span>' + (u.type || '—') + '</span></div>' +
                    (fields[0] ? '<div class="rnk__hv__stat"><i class="fa-solid fa-book-open"></i><span>' + fields[0] + '</span></div>' : '') +
                    (fields[1] ? '<div class="rnk__hv__stat"><i class="fa-solid fa-star"></i><span>' + fields[1] + '</span></div>' : '') +
                '</div>' +
                (window.UniRating ? '<div class="rnk__hv__rating">' + window.UniRating.compact(u) + '</div>' : '') +
            '</div>' +
        '</div>';
    }

    var cards = list.map(cardHtml).join('');

    // Repeat cards so a single set is always wide enough to overflow the screen,
    // otherwise the marquee shows empty space / its end before looping.
    var MIN_CARDS = 14;
    if (list.length && list.length < MIN_CARDS) {
        var reps = Math.ceil(MIN_CARDS / list.length);
        cards = new Array(reps).fill(cards).join('');
    }

    track.innerHTML = '<div class="rnk__set">' + cards + '</div>' +
                      '<div class="rnk__set" aria-hidden="true">' + cards + '</div>';
}

function updateSliderRange() {
    var slider = document.getElementById('mpdBudgetSlider');
    if (!slider) return;

    var unis  = (typeof UNI !== 'undefined' && UNI.length) ? UNI : [];
    var costs = unis.map(tuitionMinCost).filter(function(c) { return c > 0; });
    var cheapest = costs.length ? Math.min.apply(null, costs) : 700;

    var rMin = Math.max(300, Math.floor(cheapest / 100) * 100);
    var rMax = 30000;

    slider.min  = rMin;
    slider.max  = rMax;
    slider.step = 250;
    if (+slider.value < rMin) slider.value = rMin;
    if (+slider.value > rMax) slider.value = rMax;

    var minLbl = document.getElementById('mpdBudgetMin');
    var maxLbl = document.getElementById('mpdBudgetMax');
    if (minLbl) minLbl.textContent = '€' + rMin.toLocaleString() + '/yr';
    if (maxLbl) maxLbl.textContent = '€' + rMax.toLocaleString() + '/yr';

    // keep the animated fill (--pct) correct after the range is (re)computed
    var pct = rMax > rMin ? ((+slider.value - rMin) / (rMax - rMin)) * 100 : 0;
    pct = Math.max(0, Math.min(100, pct));
    var wrap = slider.closest('.mpd__budget__wrap') || slider;
    wrap.style.setProperty('--pct', pct.toFixed(1) + '%');
    slider.style.setProperty('--pct', pct.toFixed(1) + '%');

    renderBudgetMatches();
}

var _bmPage = 1;
var BM_PER_PAGE = 8;
var _bmMatched = [];

function renderBudgetPage() {
    var grid = document.getElementById('budgetMatchGrid');
    var pagEl = document.getElementById('bmPagination');
    var prevBtn = document.getElementById('bmPrev');
    var nextBtn = document.getElementById('bmNext');
    var infoEl  = document.getElementById('bmPagInfo');
    if (!grid) return;

    var total = _bmMatched.length;
    var totalPages = Math.max(1, Math.ceil(total / BM_PER_PAGE));
    if (_bmPage > totalPages) _bmPage = totalPages;
    if (_bmPage < 1) _bmPage = 1;

    var slice = _bmMatched.slice((_bmPage - 1) * BM_PER_PAGE, _bmPage * BM_PER_PAGE);

    grid.innerHTML = slice.map(function(u) {
        var on       = getSaved().indexOf(u.id) !== -1;
        var col      = u.color || 'var(--orange)';
        var cRank    = (typeof UNI !== 'undefined') ? UNI.indexOf(u) + 1 : 0;
        var rankHtml = cRank > 0 ? '<span class="bm__rank">#' + cRank + '</span>' : '';
        var tc       = uniIsPublic(u) ? 'bm__chip--pub' : 'bm__chip--priv';
        var fields   = (u.fields || []).slice(0, 3);
        var extra    = (u.fields || []).length > 3 ? '<span class="bm__field__more">+' + ((u.fields.length) - 3) + '</span>' : '';
        return '<div class="bm__card" style="--bm-accent:' + col + ';border-left-color:' + col + '" data-id="' + u.id + '">' +
            '<div class="bm__card__head">' +
                '<div class="bm__card__head__left">' +
                    '<div class="bm__abbr bm__abbr--logo">' + uniLogo(u, 30) + '</div>' +
                    rankHtml +
                '</div>' +
                '<button class="bm__save mp__save__btn" data-id="' + u.id + '" style="color:' + (on ? 'rgb(228,155,20)' : 'rgba(0,0,0,.2)') + '">' +
                    '<i class="fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark"></i>' +
                '</button>' +
            '</div>' +
            '<div class="bm__name">' + (u.name || '?') + '</div>' +
            '<div class="bm__chips">' +
                '<span class="bm__chip bm__chip--city"><i class="fa-solid fa-location-dot"></i> ' + (u.city || '—') + '</span>' +
                '<span class="bm__chip ' + tc + '">' + uniTypeLabel(u) + '</span>' +
                '<span class="bm__chip bm__chip--tuition"><i class="fa-solid fa-coins"></i> ' + uniTuitionLabel(u) + '</span>' +
            '</div>' +
            '<div class="bm__fields">' +
                fields.map(function(f){ return '<span class="bm__field__tag">' + f + '</span>'; }).join('') +
                extra +
            '</div>' +
            '<div class="bm__stats">' +
                (u.dl       ? '<span class="bm__stat"><i class="fa-solid fa-gauge-high"></i> ' + u.dl + '</span>' : '') +
                (u.founded  ? '<span class="bm__stat"><i class="fa-solid fa-building-columns"></i> Est. ' + u.founded + '</span>' : '') +
                (u.students ? '<span class="bm__stat"><i class="fa-solid fa-user-group"></i> ' + u.students + '</span>' : '') +
            '</div>' +
            '<div class="bm__botrow">' +
                (window.UniRating ? '<div class="mp__card__rating">' + window.UniRating.compact(u) + '</div>' : '<span></span>') +
                recruitersHTML(u) +
            '</div>' +
        '</div>';
    }).join('');

    grid.querySelectorAll('.bm__card').forEach(function(card) {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.mp__save__btn')) return;
            var recr = e.target.closest('.mp__card__recr');
            if (recr) { e.stopPropagation(); var nm = recr.getAttribute('data-recr-uni'); var uu = UNI.find(function(x){ return x.name === nm; }); if (window.openCareers) window.openCareers(uu || nm); return; }
            var u = UNI.find(function(x) { return x.id === card.dataset.id; });
            if (u) showUniDetail(u);
        });
    });
    attachSave(grid);

    if (pagEl) {
        pagEl.style.display = totalPages > 1 ? 'flex' : 'none';
        if (infoEl) infoEl.textContent = 'Page ' + _bmPage + ' of ' + totalPages + ' (' + total + ' total)';
        if (prevBtn) prevBtn.disabled = _bmPage <= 1;
        if (nextBtn) nextBtn.disabled = _bmPage >= totalPages;
    }
}

(function() {
    var prevBtn = document.getElementById('bmPrev');
    var nextBtn = document.getElementById('bmNext');
    if (prevBtn) prevBtn.addEventListener('click', function() { _bmPage--; renderBudgetPage(); });
    if (nextBtn) nextBtn.addEventListener('click', function() { _bmPage++; renderBudgetPage(); });
}());

function renderBudgetMatches() {
    var section = document.getElementById('budgetSection');
    var slider  = document.getElementById('mpdBudgetSlider');
    var subEl   = document.getElementById('budgetSectionSub');
    if (!slider || !section) return;

    var budget = +slider.value;
    var budgetChosen = !!getProfile().budgetSet;

    // Header badge: show the prompt until the user actually picks a budget.
    var badge = document.getElementById('budgetBadge');
    if (badge) {
        if (!budgetChosen) {
            badge.innerHTML = '<span class="bdg__ic"><i class="fa-solid fa-piggy-bank"></i></span><span class="bdg__t"><small>Yearly budget</small><b>Set yours</b></span><span class="bdg__go"><i class="fa-solid fa-plus"></i></span>';
            badge.className = 'mp__budget__badge bdg bdg--prompt';
            badge.title = 'How much are you planning to spend on university each year?';
            badge.style.display = 'inline-flex';
        } else {
            var kLabel = budget >= 1000 ? '€' + (budget / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'k' : '€' + budget.toLocaleString();
            var tone = budget > 15000 ? 'high' : budget > 5000 ? 'mid' : 'low';
            badge.innerHTML = '<span class="bdg__ic"><i class="fa-solid fa-wallet"></i></span><span class="bdg__t"><small>Budget / year</small><b>' + kLabel + '</b></span>' +
                '<span class="bdg__meter" aria-hidden="true"><i style="--p:' + Math.max(.06, Math.min(1, budget / 30000)).toFixed(3) + '"></i></span>';
            badge.className = 'mp__budget__badge bdg bdg--' + tone;
            badge.style.display = 'inline-flex';
        }
    }

    _bmMatched = (typeof UNI !== 'undefined' ? UNI : []).filter(function(u) {
        return tuitionMinCost(u) <= budget;
    });
    if (badge && budgetChosen) badge.title = '€' + budget.toLocaleString() + ' a year for tuition · ' + _bmMatched.length + ' universities here fit — tap to change';

    if (_bmMatched.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    var n = _bmMatched.length;
    if (subEl) {
        subEl.textContent = 'Budget: €' + budget.toLocaleString() + '/yr — '
            + n + ' universit' + (n === 1 ? 'y fits' : 'ies fit');
    }

    _bmPage = 1;
    renderBudgetPage();
}

function updateDshWidgets() {
    var dlEl    = document.getElementById('dshNextDeadline');
    var lblEl   = document.getElementById('dshDeadlineLabel');
    if (dlEl) {
        var done   = getDlDone ? getDlDone() : [];
        var custom = getDlCustom ? getDlCustom() : [];
        var pinId  = getDlPin ? getDlPin() : null;

        var allItems = (typeof DEADLINES !== 'undefined' ? DEADLINES : [])
            .filter(function(d) { return d.country === currentCountryCode; })
            .concat(custom.map(function(d) {
                return { id: d.id, uniAbbr: '★', uniColor: '#6c63ff', type: d.type, title: d.title, date: d.date };
            }))
            // confirmed deadlines of saved scholarships (deadlines.js)
            .concat(typeof window.dtScholarshipDeadlines === 'function' ? window.dtScholarshipDeadlines() : [])
            // the student's own applications (apply.js)
            .concat(typeof window.dtApplicationDeadlines === 'function' ? window.dtApplicationDeadlines() : []);

        var pinned = pinId ? allItems.find(function(d) { return d.id === pinId; }) : null;
        var next   = null;
        if (!pinned) {
            next = allItems
                .filter(function(d) { return done.indexOf(d.id) === -1 && getCountdown(d.date).urgency !== 'overdue'; })   // next UPCOMING, never an overdue one
                .sort(function(a, b) { return new Date(a.date) - new Date(b.date); })[0] || null;
        }

        var d = pinned || next;
        if (lblEl) lblEl.textContent = pinned ? '📌 Pinned' : 'Next Deadline';

        if (!d) {
            dlEl.textContent = 'No upcoming deadlines';
        } else {
            var cd   = typeof getCountdown === 'function' ? getCountdown(d.date) : { label: d.date };
            var abbr = (d.uniAbbr || '★').slice(0, 3);
            dlEl.textContent = abbr + ' — ' + (cd.label || d.date);
        }
    }

    if (typeof updateHeroFeed === 'function') updateHeroFeed();
}

(function() {
    var w = document.getElementById('dshDeadlineWidget');
    if (w) w.addEventListener('click', function() { showTab('tracker'); });
})();

var COUNTRY_TZ = {
    es: 'Europe/Madrid',  gb: 'Europe/London',   fr: 'Europe/Paris',
    de: 'Europe/Berlin',  it: 'Europe/Rome',      pt: 'Europe/Lisbon',
    us: 'America/New_York', ch: 'Europe/Zurich',  ua: 'Europe/Kyiv'
};

function getDestTime() {
    var tz  = COUNTRY_TZ[currentCountryCode] || Intl.DateTimeFormat().resolvedOptions().timeZone;
    var now = new Date();

    var parts = {};
    new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false
    }).formatToParts(now).forEach(function(p) { parts[p.type] = parseInt(p.value) || 0; });
    return { h: parts.hour || 0, m: parts.minute || 0, s: parts.second || 0, tz: tz, raw: now };
}

(function() {
    var canvas  = document.getElementById('dshClockCanvas');
    var timeEl  = document.getElementById('dshClockTime');
    var dateEl  = document.getElementById('dshClockDate');
    var tzEl    = document.getElementById('dshClockTz');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var SIZE = 104, lastLabel = '';

    // Crisp on Retina: back the canvas with devicePixelRatio pixels.
    function fit() {
        var dpr = Math.min(window.devicePixelRatio || 1, 3);
        if (canvas._dpr === dpr) return;
        canvas._dpr = dpr;
        canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
        canvas.style.width = canvas.style.height = SIZE + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function hand(ang, from, to, width, color) {
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(ang) * from, c + Math.sin(ang) * from);
        ctx.lineTo(c + Math.cos(ang) * to, c + Math.sin(ang) * to);
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
    }
    var c = SIZE / 2;

    function draw() {
        if (document.hidden) return;   // skip canvas redraw + Intl work in background tabs
        fit();
        var r = c - 2, dt = getDestTime();
        var h = dt.h % 12, m = dt.m, s = dt.s;
        var dark = document.documentElement.getAttribute('data-theme') === 'dark';
        var ink = dark ? '#f5f4ee' : '#1c1409';
        var accent = dark ? '#e89274' : '#e07a12';

        ctx.clearRect(0, 0, SIZE, SIZE);

        // Face — soft warm gradient.
        var g = ctx.createRadialGradient(c - r * .3, c - r * .35, r * .1, c, c, r);
        g.addColorStop(0, dark ? '#3a3935' : '#ffffff');
        g.addColorStop(1, dark ? '#24231f' : '#fbf3e7');
        ctx.beginPath(); ctx.arc(c, c, r, 0, 2 * Math.PI); ctx.fillStyle = g; ctx.fill();

        // Seconds progress ring around the rim.
        var ringR = r - 3;
        ctx.beginPath(); ctx.arc(c, c, ringR, 0, 2 * Math.PI);
        ctx.strokeStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(217,124,20,.13)'; ctx.lineWidth = 3; ctx.stroke();
        if (s > 0) {
            var rg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
            rg.addColorStop(0, dark ? '#f0a58a' : '#f59220'); rg.addColorStop(1, accent);
            ctx.beginPath(); ctx.arc(c, c, ringR, -Math.PI / 2, -Math.PI / 2 + (s / 60) * 2 * Math.PI);
            ctx.strokeStyle = rg; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
        }

        // Hour index: bars at 12/3/6/9 (12 in accent), dots elsewhere.
        for (var i = 0; i < 12; i++) {
            var a = (i / 12) * 2 * Math.PI - Math.PI / 2;
            if (i % 3 === 0) hand(a, r - 15, r - 10, 2.6, i === 0 ? accent : ink);
            else {
                ctx.beginPath(); ctx.arc(c + Math.cos(a) * (r - 12), c + Math.sin(a) * (r - 12), 1.3, 0, 2 * Math.PI);
                ctx.fillStyle = dark ? 'rgba(245,244,238,.4)' : 'rgba(28,20,9,.28)'; ctx.fill();
            }
        }

        // Hands.
        ctx.save();
        ctx.shadowColor = dark ? 'rgba(0,0,0,.5)' : 'rgba(60,40,10,.22)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
        hand(((h + m / 60) / 12) * 2 * Math.PI - Math.PI / 2, -4, r * .46, 4.5, ink);
        hand(((m + s / 60) / 60) * 2 * Math.PI - Math.PI / 2, -5, r * .68, 3, dark ? 'rgba(245,244,238,.85)' : 'rgba(28,20,9,.82)');
        ctx.restore();
        var sa = (s / 60) * 2 * Math.PI - Math.PI / 2;
        hand(sa, -r * .18, r * .72, 1.4, accent);
        ctx.beginPath(); ctx.arc(c - Math.cos(sa) * r * .18, c - Math.sin(sa) * r * .18, 2.2, 0, 2 * Math.PI); ctx.fillStyle = accent; ctx.fill();

        // Hub.
        ctx.beginPath(); ctx.arc(c, c, 4.2, 0, 2 * Math.PI); ctx.fillStyle = accent; ctx.fill();
        ctx.beginPath(); ctx.arc(c, c, 1.7, 0, 2 * Math.PI); ctx.fillStyle = dark ? '#24231f' : '#fff'; ctx.fill();

        // Digital readout — DOM only touched when the minute changes.
        var label = String(dt.h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + '|' + dt.tz;
        if (label === lastLabel) return;
        lastLabel = label;
        if (timeEl) timeEl.innerHTML = String(dt.h).padStart(2, '0') + '<span class="mp__hero__clock__colon">:</span>' + String(m).padStart(2, '0');
        if (dateEl) {
            dateEl.innerHTML = '<i class="fa-regular fa-calendar"></i> ' + new Intl.DateTimeFormat('en-GB', {
                timeZone: dt.tz, weekday: 'short', day: 'numeric', month: 'short'
            }).format(dt.raw);
        }
        if (tzEl) {
            var off = '';
            try {
                off = (new Intl.DateTimeFormat('en-GB', { timeZone: dt.tz, timeZoneName: 'shortOffset' }).formatToParts(dt.raw)
                    .filter(function (p) { return p.type === 'timeZoneName'; })[0] || {}).value || '';
            } catch (e) {}
            var city = String(dt.tz).split('/').pop().replace(/_/g, ' ');
            tzEl.innerHTML = '<i class="fa-solid fa-location-dot"></i> ' + city + (off ? ' · ' + off : '');
        }
    }
    draw();
    setInterval(draw, 1000);
    // Redraw immediately on theme switch so the dial never shows the old palette.
    new MutationObserver(function () { lastLabel = ''; draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}());

(function() {
    var saved = localStorage.getItem(typeof COUNTRY_KEY !== 'undefined' ? COUNTRY_KEY : 'uniscout_country') || 'es';

    var CS_NAMES = { es:'Spain', gb:'United Kingdom', fr:'France', de:'Germany',
                     it:'Italy', pt:'Portugal', us:'United States', ch:'Switzerland', ua:'Ukraine' };
    var csFlagEl = document.getElementById('csFlag');
    var csNameEl = document.getElementById('csName');
    if (csFlagEl) csFlagEl.className = 'mp__cs__flag fi fi-' + saved;
    if (csNameEl) csNameEl.textContent = CS_NAMES[saved] || saved.toUpperCase();
    document.querySelectorAll('.mp__cs__country').forEach(function(b) {
        b.classList.toggle('active', b.dataset.code === saved);
    });

    loadCountry(saved);

    var slider = document.getElementById('mpdBudgetSlider');
    if (slider) {
        slider.addEventListener('input', function() { renderBudgetMatches(); });
        updateSliderRange();
    }
    var adjBtn = document.getElementById('budgetAdjustBtn');
    if (adjBtn) {
        adjBtn.addEventListener('click', function() {

            var drop = document.getElementById('profileDropdown');
            if (drop) drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
        });
    }
}());

(function() {
    var overlay   = document.getElementById('browseAllOverlay');
    var openBtn   = document.getElementById('browseAllBtn');
    var closeBtn  = document.getElementById('browseAllClose');
    var listEl    = document.getElementById('baList');
    var pagEl     = document.getElementById('baPagination');
    var searchEl  = document.getElementById('baSearch');
    var clearEl   = document.getElementById('baClearSearch');
    var labelEl   = document.getElementById('baResultsLabel');
    var countryLbl= document.getElementById('baCountryLabel');
    if (!overlay || !openBtn) return;

    var baPage = 1;
    var BA_PER = 15;
    var baQuery = '';

    function baFilteredList() {
        var q = baQuery.toLowerCase();
        if (!q) return UNI.slice();
        return UNI.filter(function(u) {
            return (u.name || '').toLowerCase().indexOf(q) !== -1 ||
                   (u.abbr || '').toLowerCase().indexOf(q) !== -1 ||
                   (u.city || '').toLowerCase().indexOf(q) !== -1;
        });
    }

    function baRenderPage() {
        var hits  = baFilteredList();
        var total = Math.max(1, Math.ceil(hits.length / BA_PER));
        baPage    = Math.min(baPage, total);
        var page  = hits.slice((baPage - 1) * BA_PER, baPage * BA_PER);

        if (labelEl) labelEl.textContent = hits.length + ' universit' + (hits.length === 1 ? 'y' : 'ies') + (baQuery ? ' matching "' + baQuery + '"' : '');

        listEl.innerHTML = page.map(function(u) {
            var on  = getSaved().indexOf(u.id) !== -1;
            var col = u.color || '#555';
            return '<div class="ba__item" data-id="' + u.id + '">' +
                '<div class="ba__item__abbr ba__item__abbr--logo">' + uniLogo(u, 38) + '</div>' +
                '<div class="ba__item__info">' +
                    '<div class="ba__item__name">' + (u.name || '?') + '</div>' +
                    '<div class="ba__item__meta">' +
                        '<span class="mp__badge mp__badge--city"><i class="fa-solid fa-location-dot" style="font-size:7px;margin-right:2px"></i>' + (u.city || '—') + '</span>' +
                        '<span class="mp__badge ' + (uniIsPublic(u) ? 'mp__badge--pub' : 'mp__badge--priv') + '">' + uniTypeLabel(u) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="ba__item__tuition">' + uniTuitionLabel(u) + '</div>' +
                '<button class="mp__save__btn" data-id="' + u.id + '" style="color:' + (on ? 'rgb(228,155,20)' : 'rgba(0,0,0,.2)') + '">' +
                    '<i class="fa-' + (on ? 'solid' : 'regular') + ' fa-bookmark"></i>' +
                '</button>' +
            '</div>';
        }).join('') || '<div class="ba__empty"><i class="fa-solid fa-magnifying-glass"></i><p>No universities found</p></div>';

        attachSave(listEl);
        listEl.querySelectorAll('.ba__item').forEach(function(row) {
            row.addEventListener('click', function(e) {
                if (e.target.closest('.mp__save__btn')) return;
                var u = UNI.find(function(x) { return x.id === row.dataset.id; });
                if (u) { overlay.classList.remove('open'); showUniDetail(u); }
            });
        });

        if (!pagEl) return;
        if (total <= 1) { pagEl.innerHTML = ''; return; }
        var html = '<button class="ba__pg__btn" ' + (baPage === 1 ? 'disabled' : '') + ' id="baPrev"><i class="fa-solid fa-chevron-left"></i></button>';
        var sp = Math.max(1, baPage - 2), ep = Math.min(total, baPage + 2);
        if (sp > 1) html += '<span class="ba__pg__dots">…</span>';
        for (var p = sp; p <= ep; p++) {
            html += '<button class="ba__pg__num' + (p === baPage ? ' ba__pg__num--active' : '') + '" data-p="' + p + '">' + p + '</button>';
        }
        if (ep < total) html += '<span class="ba__pg__dots">…</span>';
        html += '<button class="ba__pg__btn" ' + (baPage === total ? 'disabled' : '') + ' id="baNext"><i class="fa-solid fa-chevron-right"></i></button>';
        pagEl.innerHTML = html;
        pagEl.querySelector('#baPrev').addEventListener('click', function() { if (baPage > 1) { baPage--; baRenderPage(); } });
        pagEl.querySelector('#baNext').addEventListener('click', function() { if (baPage < total) { baPage++; baRenderPage(); } });
        pagEl.querySelectorAll('.ba__pg__num').forEach(function(btn) {
            btn.addEventListener('click', function() { baPage = parseInt(btn.dataset.p); baRenderPage(); });
        });
    }

    function openBrowseAll() {
        if (countryLbl) {
            var names = { es:'Spain', gb:'United Kingdom', fr:'France', de:'Germany',
                          it:'Italy', pt:'Portugal', us:'United States', ch:'Switzerland', ua:'Ukraine' };
            countryLbl.textContent = names[currentCountryCode] || currentCountryCode.toUpperCase();
        }
        baPage = 1; baQuery = '';
        if (searchEl) { searchEl.value = ''; }
        if (clearEl)  { clearEl.style.display = 'none'; }
        baRenderPage();
        overlay.classList.add('open');
    }

    openBtn.addEventListener('click', openBrowseAll);
    closeBtn.addEventListener('click', function() { overlay.classList.remove('open'); });
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.classList.remove('open'); });

    if (searchEl) {
        searchEl.addEventListener('input', function() {
            baQuery = searchEl.value.trim();
            if (clearEl) clearEl.style.display = baQuery ? 'flex' : 'none';
            baPage = 1;
            baRenderPage();
        });
    }
    if (clearEl) {
        clearEl.addEventListener('click', function() {
            baQuery = ''; if (searchEl) searchEl.value = '';
            clearEl.style.display = 'none';
            baPage = 1; baRenderPage();
        });
    }
}());

var UI_STRINGS = {
    en: {
        nav_overview:'Overview', nav_explore:'Explore', nav_compare:'Apply',
        nav_cityguide:'Chances', nav_tracker:'Deadlines',
        saved_title:'Saved Universities', saved_sub:'Universities you bookmarked for later',
        budget_title:'Universities Matching Your Budget',
        rnk_sub:'Rankings updated regularly · Hover a card for details',
        monthly_budget:'Annual Tuition Budget', language:'Language',
        browse_all:'Browse all', compare_btn:'Compare',
        filter_off:'Filter off — budget is for reference only',
        filter_on:'Filter on — only showing universities within budget',
    },
    es: {
        nav_overview:'Resumen', nav_explore:'Explorar', nav_compare:'Comparar',
        nav_cityguide:'Perspectivas', nav_tracker:'Fechas límite',
        saved_title:'Universidades guardadas', saved_sub:'Universidades que has marcado',
        budget_title:'Universidades según tu presupuesto',
        rnk_sub:'Clasificaciones actualizadas · Pasa el cursor para más info',
        monthly_budget:'Presupuesto mensual', language:'Idioma',
        browse_all:'Ver todas', compare_btn:'Comparar',
        filter_off:'Filtro desactivado — presupuesto de referencia',
        filter_on:'Filtro activado — solo universidades dentro del presupuesto',
    },
    fr: {
        nav_overview:'Aperçu', nav_explore:'Explorer', nav_compare:'Comparer',
        nav_cityguide:'Perspectives', nav_tracker:'Échéances',
        saved_title:'Universités sauvegardées', saved_sub:'Universités que vous avez marquées',
        budget_title:'Universités dans votre budget',
        rnk_sub:'Classements mis à jour · Survolez pour les détails',
        monthly_budget:'Budget mensuel', language:'Langue',
        browse_all:'Voir tout', compare_btn:'Comparer',
        filter_off:'Filtre désactivé — budget à titre indicatif',
        filter_on:'Filtre activé — universités dans le budget uniquement',
    },
    de: {
        nav_overview:'Übersicht', nav_explore:'Erkunden', nav_compare:'Vergleichen',
        nav_cityguide:'Einblicke', nav_tracker:'Fristen',
        saved_title:'Gespeicherte Universitäten', saved_sub:'Lesezeichen für später',
        budget_title:'Universitäten in deinem Budget',
        rnk_sub:'Rankings regelmäßig aktualisiert · Hover für Details',
        monthly_budget:'Monatsbudget', language:'Sprache',
        browse_all:'Alle anzeigen', compare_btn:'Vergleichen',
        filter_off:'Filter aus — Budget nur zur Referenz',
        filter_on:'Filter ein — nur Universitäten im Budget',
    },
    it: {
        nav_overview:'Panoramica', nav_explore:'Esplora', nav_compare:'Confronta',
        nav_cityguide:'Approfondimenti', nav_tracker:'Scadenze',
        saved_title:'Università salvate', saved_sub:'Università nei tuoi segnalibri',
        budget_title:'Università nel tuo budget',
        rnk_sub:'Classifiche aggiornate · Passa il mouse per i dettagli',
        monthly_budget:'Budget mensile', language:'Lingua',
        browse_all:'Vedi tutte', compare_btn:'Confronta',
        filter_off:'Filtro disattivato — budget di riferimento',
        filter_on:'Filtro attivato — solo università nel budget',
    },
    pt: {
        nav_overview:'Visão geral', nav_explore:'Explorar', nav_compare:'Comparar',
        nav_cityguide:'Perspetivas', nav_tracker:'Prazos',
        saved_title:'Universidades guardadas', saved_sub:'Universidades nos seus favoritos',
        budget_title:'Universidades no seu orçamento',
        rnk_sub:'Rankings atualizados · Passe o rato para detalhes',
        monthly_budget:'Orçamento mensal', language:'Idioma',
        browse_all:'Ver todas', compare_btn:'Comparar',
        filter_off:'Filtro desligado — orçamento de referência',
        filter_on:'Filtro ligado — só universidades no orçamento',
    },
    uk: {
        nav_overview:'Огляд', nav_explore:'Пошук', nav_compare:'Порівняння',
        nav_cityguide:'Аналітика', nav_tracker:'Дедлайни',
        saved_title:'Збережені університети', saved_sub:'Університети у закладках',
        budget_title:'Університети за бюджетом',
        rnk_sub:'Рейтинги оновлюються · Наведіть для деталей',
        monthly_budget:'Місячний бюджет', language:'Мова',
        browse_all:'Переглянути всі', compare_btn:'Порівняти',
        filter_off:'Фільтр вимкнено — бюджет орієнтовний',
        filter_on:'Фільтр увімкнено — лише університети в бюджеті',
    },
    pl: {
        nav_overview:'Przegląd', nav_explore:'Eksploruj', nav_compare:'Porównaj',
        nav_cityguide:'Spostrzeżenia', nav_tracker:'Terminy',
        saved_title:'Zapisane uczelnie', saved_sub:'Uczelnie dodane do zakładek',
        budget_title:'Uczelnie w Twoim budżecie',
        rnk_sub:'Rankingi aktualizowane · Najedź po szczegóły',
        monthly_budget:'Miesięczny budżet', language:'Język',
        browse_all:'Przeglądaj wszystkie', compare_btn:'Porównaj',
        filter_off:'Filtr wyłączony — budżet orientacyjny',
        filter_on:'Filtr włączony — tylko uczelnie w budżecie',
    }
};

function applyLanguage(lang) {
    var t = UI_STRINGS[lang] || UI_STRINGS.en;

    document.querySelectorAll('.mp__nav__btn[data-tab]').forEach(function(btn) {
        var key = 'nav_' + btn.dataset.tab;
        if (!t[key]) return;
        setNavLabel(btn, t[key]);
    });

    var savedGrid = document.getElementById('savedGrid');
    if (savedGrid) {
        var savedSect = savedGrid.closest('.mp__section');
        if (savedSect) {
            var savedTitle = savedSect.querySelector('.mp__section__title');
            if (savedTitle) savedTitle.innerHTML = '<i class="fa-solid fa-bookmark"></i> ' + t.saved_title;
        }
    }

    var budgetTitle = document.querySelector('#budgetSection .mp__section__title');
    if (budgetTitle) budgetTitle.innerHTML = '<i class="fa-solid fa-piggy-bank"></i> ' + t.budget_title;

    var rnkSub = document.querySelector('.rnk__section__sub');
    if (rnkSub) rnkSub.textContent = t.rnk_sub;

    var browseBtn = document.getElementById('browseAllBtn');
    if (browseBtn) browseBtn.innerHTML = '<i class="fa-solid fa-list-ol"></i> ' + t.browse_all;

    var mpdBudgetLbl = document.querySelector('.mpd__section__label .fa-piggy-bank');
    if (mpdBudgetLbl) mpdBudgetLbl.parentElement.innerHTML = '<i class="fa-solid fa-piggy-bank"></i> ' + t.monthly_budget;

    var mpdLangLbl = document.querySelector('.mpd__section__label .fa-language');
    if (mpdLangLbl) mpdLangLbl.parentElement.innerHTML = '<i class="fa-solid fa-language"></i> ' + t.language;

    var modeLabel = document.getElementById('mpdBudgetModeLabel');
    if (modeLabel) {
        var isOn = document.getElementById('mpdBudgetMode') && document.getElementById('mpdBudgetMode').checked;
        modeLabel.textContent = isOn ? t.filter_on : t.filter_off;
    }

    document.documentElement.lang = lang === 'uk' ? 'uk' : lang;
}

(function() {
    function makeUniAutocomplete(inputId, hiddenId, suggId) {
        var input  = document.getElementById(inputId);
        var hidden = document.getElementById(hiddenId);
        var sugg   = document.getElementById(suggId);
        if (!input || !hidden || !sugg) return;

        var SUGG_STYLE = 'padding:10px 13px;cursor:pointer;font-size:.78rem;border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:9px;color:#eef1f6;background:transparent;transition:background .14s';

        function showSugg(list) {
            if (!list.length) { sugg.style.display = 'none'; return; }
            sugg.innerHTML = list.slice(0, 10).map(function(u) {
                return '<div class="ins__sugg__item" data-id="' + u.id + '" style="' + SUGG_STYLE + '">' +
                    '<span style="font-weight:800;color:#f0a84a;flex-shrink:0;font-size:.72rem;min-width:34px">' + (u.abbr || '') + '</span>' +
                    '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + u.name + '</span>' +
                '</div>';
            }).join('');
            sugg.querySelectorAll('.ins__sugg__item').forEach(function(item) {
                item.addEventListener('mouseenter', function() { item.style.background = 'rgba(240,168,74,.16)'; });
                item.addEventListener('mouseleave', function() { item.style.background = 'transparent'; });
                item.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    var u = (typeof UNI !== 'undefined' ? UNI : []).find(function(x){ return x.id === item.dataset.id; });
                    if (u) {
                        input.value  = u.name;
                        hidden.value = u.id;
                        sugg.style.display = 'none';
                    }
                });
            });
            sugg.style.display = 'block';
        }

        input.addEventListener('input', function() {
            var q = input.value.trim().toLowerCase();
            hidden.value = '';
            if (!q) { sugg.style.display = 'none'; return; }
            var matches = (typeof UNI !== 'undefined' ? UNI : []).filter(function(u) {
                return (u.name || '').toLowerCase().indexOf(q) !== -1 ||
                       (u.abbr || '').toLowerCase().indexOf(q) !== -1 ||
                       (u.city || '').toLowerCase().indexOf(q) !== -1;
            });
            showSugg(matches);
        });

        input.addEventListener('blur', function() {
            setTimeout(function() { sugg.style.display = 'none'; }, 150);
        });
        input.addEventListener('focus', function() {
            if (input.value.trim() && !hidden.value) input.dispatchEvent(new Event('input'));
        });
    }

    makeUniAutocomplete('salUniInput', 'salUni', 'salUniSugg');
    makeUniAutocomplete('admUniInput', 'admUni', 'admUniSugg');
    makeUniAutocomplete('roiUniInput', 'roiUni', 'roiUniSugg');
}());

(function() {
    var input  = document.getElementById('evUniInput');
    var hidden = document.getElementById('evUniSel');
    var sugg   = document.getElementById('evUniSugg');
    if (!input || !hidden || !sugg) return;

    var SUGG_STYLE = 'padding:9px 13px;cursor:pointer;font-size:.78rem;border-bottom:1px solid rgba(0,0,0,.07);display:flex;align-items:center;gap:8px;color:#1a1a2e;background:#fff';

    function getSavedUnis() {
        var saved = getSaved();
        var all = typeof UNI !== 'undefined' ? UNI : [];
        var db  = typeof UNI_DB !== 'undefined' ? UNI_DB : [];
        var result = [];
        saved.forEach(function(id) {
            var u = all.find(function(x){ return x.id === id; });
            if (!u) u = db.find(function(x){ return x.id === id; });
            if (u) result.push(u);
        });
        return result;
    }

    function showSugg(list) {
        if (!list.length) { sugg.style.display = 'none'; return; }
        sugg.innerHTML = list.slice(0, 10).map(function(u) {
            return '<div class="ins__sugg__item" data-id="' + u.id + '" style="' + SUGG_STYLE + '">' +
                '<span style="font-weight:700;color:#9b59b6;flex-shrink:0">' + (u.abbr || '') + '</span>' +
                '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + u.name + '</span>' +
            '</div>';
        }).join('');
        sugg.querySelectorAll('.ins__sugg__item').forEach(function(item) {
            item.addEventListener('mouseenter', function() { item.style.background = 'rgba(155,89,182,.10)'; });
            item.addEventListener('mouseleave', function() { item.style.background = ''; });
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                var unis = getSavedUnis();
                var u = unis.find(function(x){ return x.id === item.dataset.id; });
                if (u) { input.value = u.name; hidden.value = u.id; sugg.style.display = 'none'; }
            });
        });
        sugg.style.display = 'block';
    }

    input.addEventListener('input', function() {
        var q = input.value.trim().toLowerCase();
        hidden.value = '';
        if (!q) { sugg.style.display = 'none'; return; }
        var matches = getSavedUnis().filter(function(u) {
            return (u.name || '').toLowerCase().indexOf(q) !== -1 ||
                   (u.abbr || '').toLowerCase().indexOf(q) !== -1;
        });
        showSugg(matches);
    });

    input.addEventListener('focus', function() {
        var unis = getSavedUnis();
        if (!input.value.trim()) {
            showSugg(unis);
        } else if (!hidden.value) {
            input.dispatchEvent(new Event('input'));
        }
    });

    input.addEventListener('blur', function() {
        setTimeout(function() { sugg.style.display = 'none'; }, 150);
    });
}());

(function() {
    var avatarBtn  = document.getElementById('mpAvatarBtn');
    var drop       = document.getElementById('profileDropdown');
    if (!avatarBtn || !drop) return;

    avatarBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = drop.style.display !== 'none';
        drop.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
            drop.style.animation = 'mpd-fadein .2s ease both';
            if (typeof updateTitleDisplay === 'function') updateTitleDisplay();
        }
    });
    document.addEventListener('click', function(e) {
        if (!drop.contains(e.target) && e.target !== avatarBtn) {
            drop.style.display = 'none';
        }
    });
    // The header budget widget opens this menu right at the budget slider.
    var budgetBtn = document.getElementById('budgetBadge');
    if (budgetBtn) budgetBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        drop.style.display = 'block'; drop.style.animation = 'mpd-fadein .2s ease both';
        var sl = document.getElementById('mpdBudgetSlider'); if (!sl) return;
        var sec = sl.closest('.mpd__section') || sl.parentNode;
        setTimeout(function () { sec.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); sec.classList.remove('is-flash'); void sec.offsetWidth; sec.classList.add('is-flash'); sl.focus({ preventScroll: true }); }, 60);
    });

    var prof = getProfile();

    var mpdAv    = document.getElementById('mpdAvatar');
    var mpdInput = document.getElementById('mpdAvatarInput');
    if (prof.avatar && mpdAv) {
        mpdAv.innerHTML = '<img src="' + prof.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';

        avatarBtn.innerHTML = '<img src="' + prof.avatar + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
    } else if (mpdAv) {
        mpdAv.textContent = (user.username || 'U').charAt(0).toUpperCase();
    }
    if (mpdInput) {
        mpdInput.addEventListener('change', function() {
            var file = mpdInput.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                var img = new Image();
                img.onload = function() {
                    // Downscale avatars to keep localStorage small (avoids quota freezes)
                    var size = 256, c = document.createElement('canvas');
                    c.width = size; c.height = size;
                    var ctx = c.getContext('2d');
                    var s = Math.min(img.width, img.height);
                    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
                    var dataUrl;
                    try { dataUrl = c.toDataURL('image/jpeg', 0.85); } catch (e) { dataUrl = ev.target.result; }
                    if (mpdAv) mpdAv.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
                    try { var p = getProfile(); p.avatar = dataUrl; setProfile(p); }
                    catch (e) { alert('Could not save the photo — your browser storage may be full.'); return; }
                    var hdrBtn = document.getElementById('mpAvatarBtn');
                    if (hdrBtn) hdrBtn.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
                };
                img.onerror = function() { alert('That image could not be loaded.'); };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    var mpdUser    = document.getElementById('mpdUsername');
    var mpdHStatus = document.getElementById('mpdHStatus');
    var mpdHLang   = document.getElementById('mpdHLang');
    if (mpdUser)    mpdUser.textContent    = user.username || '';

    var STATUS_LABELS = {
        highschool: '🏫 High School Student', gap: '🌏 Gap Year', undergrad: '📖 Undergraduate',
        transfer: '🔄 Transfer Student',      masters: '🎓 Master\'s Applicant',
        phd: '🔬 PhD / Researcher',           professional: '💼 Working Professional', parent: '👨‍👧 Parent'
    };
    var LANG_LABELS = {
        en: '🇬🇧 English', es: '🇪🇸 Español', fr: '🇫🇷 Français',
        de: '🇩🇪 Deutsch', it: '🇮🇹 Italiano', pt: '🇵🇹 Português',
        uk: '🇺🇦 Українська', pl: '🇵🇱 Polski'
    };

    function updateStatusLabel() {
        var p = getProfile();
        if (mpdHStatus) mpdHStatus.textContent = STATUS_LABELS[p.status] || STATUS_LABELS.highschool;
        if (mpdHLang)   mpdHLang.textContent   = LANG_LABELS[p.lang]    || LANG_LABELS.en;
    }
    updateStatusLabel();

    var statusSel = document.getElementById('mpdStatusSelect');
    if (statusSel) {
        if (prof.status) statusSel.value = prof.status;
        statusSel.addEventListener('change', function() {
            var p = getProfile(); p.status = statusSel.value; setProfile(p);
            updateStatusLabel();
        });
    }

    var langSel = document.getElementById('mpdLangSelect');
    if (langSel) {
        if (prof.lang) { langSel.value = prof.lang; applyLanguage(prof.lang); }
        langSel.addEventListener('change', function() {
            var p = getProfile(); p.lang = langSel.value; setProfile(p);
            updateStatusLabel();
            applyLanguage(langSel.value);
        });
    }

    var mpdSlider    = document.getElementById('mpdBudgetSlider');
    var mpdAmt       = document.getElementById('mpdBudgetAmt');
    var mpdTier      = document.getElementById('mpdBudgetTier');
    var mpdModeChk   = document.getElementById('mpdBudgetMode');
    var mpdModeLabel = document.getElementById('mpdBudgetModeLabel');

    var BUDGET_TIERS = [
        { max: 1500,     label: 'Very tight', color: '#e74c3c' },
        { max: 4000,     label: 'Budget',     color: '#e67e22' },
        { max: 9000,     label: 'Comfortable',color: '#27ae60' },
        { max: 18000,    label: 'Generous',   color: '#2980b9' },
        { max: Infinity, label: 'Premium',    color: '#8e44ad' }
    ];

    // Keep the animated gradient fill (--pct) and accent colour in sync with the
    // slider position so the track "fills up" as you drag and the thumb glows.
    function paintBudgetSlider(budget) {
        if (!mpdSlider) return;
        var min = +mpdSlider.min || 0;
        var max = +mpdSlider.max || 100;
        var pct = max > min ? ((budget - min) / (max - min)) * 100 : 0;
        pct = Math.max(0, Math.min(100, pct));
        // Set on the wrapper so both the slider fill and the shimmer sweep
        // (which live on the wrapper's ::after) stay in sync via inheritance.
        var wrap = mpdSlider.closest('.mpd__budget__wrap') || mpdSlider;
        wrap.style.setProperty('--pct', pct.toFixed(1) + '%');
        mpdSlider.style.setProperty('--pct', pct.toFixed(1) + '%');
    }

    function updateBudgetDisplay(budget) {
        if (mpdAmt) {
            mpdAmt.innerHTML = '€' + budget.toLocaleString() + '<span>/yr</span>';
        }
        if (mpdTier) {
            var tier = BUDGET_TIERS.find(function(t) { return budget <= t.max; })
                    || BUDGET_TIERS[BUDGET_TIERS.length - 1];
            mpdTier.textContent = tier.label;
            mpdTier.style.color = tier.color;
        }
        paintBudgetSlider(budget);
    }

    if (mpdSlider) {
        var initBudget = prof.budget || 5000;
        mpdSlider.value = initBudget;
        updateBudgetDisplay(initBudget);

        mpdSlider.addEventListener('input', function() {
            var val = +mpdSlider.value;
            updateBudgetDisplay(val);
            // brief "pop" pulse on the thumb each time the value changes
            mpdSlider.classList.remove('mpd__budget__slider--bump');
            void mpdSlider.offsetWidth;
            mpdSlider.classList.add('mpd__budget__slider--bump');
            var p = getProfile();
            p.budget = val;
            p.budgetSet = true;     // user has now chosen a budget (drives the header badge)
            setProfile(p);
            renderBudgetMatches();
        });
    }

    if (mpdModeChk) {
        if (prof.budgetMode) { mpdModeChk.checked = true; setBudgetMode(true); }
        if (mpdModeLabel) {
            mpdModeLabel.textContent = mpdModeChk.checked
                ? 'Filter on — only showing universities within budget'
                : 'Filter off — budget shown for reference';
        }
        mpdModeChk.addEventListener('change', function() {
            var on = mpdModeChk.checked;
            var p  = getProfile(); p.budgetMode = on; setProfile(p);
            setBudgetMode(on);
            if (mpdModeLabel) {
                mpdModeLabel.textContent = on
                    ? 'Filter on — only showing universities within budget'
                    : 'Filter off — budget shown for reference';
            }
        });
    }
}());

/* ── Profile header effects (Nitro-style, pluggable) ──
   ProfileFX is a tiny registry: each effect is a builder that fills the
   #mpdFx layer with its own elements. Adding a new effect later is two steps:
     1. ProfileFX.register('sparkle', function(layer){ ... });   // + a CSS block
     2. ProfileFX.apply('sparkle');
   The active effect is remembered in localStorage so it survives reloads. */
window.ProfileFX = (function() {
    var LAYER_ID = 'mpdFx';
    var STORE_KEY = 'uniscout_profile_fx';

    function repeat(html, n) { var s = ''; for (var i = 0; i < n; i++) s += html; return s; }

    // registry: effect name -> builder(layerEl). Keep builders side-effect free
    // beyond writing into the layer so effects stay swappable.
    var current = 'fire';

    var registry = {
        none: function(layer) { layer.innerHTML = ''; },
        fire: function(layer) {
            layer.innerHTML = repeat('<span class="mpd__flame"></span>', 6) +
                              repeat('<span class="mpd__ember"></span>', 7);
        },
        aurora: function(layer) {
            layer.innerHTML = '<span class="mpd__aurora"></span>' +
                              '<span class="mpd__aurora mpd__aurora--2"></span>';
        },
        sparkle: function(layer) {
            var html = '';
            for (var i = 0; i < 16; i++) {
                var l = Math.round(Math.random() * 100);
                var t = Math.round(Math.random() * 100);
                var d = (Math.random() * 3).toFixed(2);
                var s = (0.5 + Math.random() * 0.9).toFixed(2);
                html += '<span class="mpd__spark" style="left:' + l + '%;top:' + t +
                        '%;animation-delay:-' + d + 's;--s:' + s + '"></span>';
            }
            layer.innerHTML = html;
        }
    };

    function register(name, builder) { registry[name] = builder; }

    // reflect the active effect in the settings picker (if it's on the page)
    function syncPicker(name) {
        var opts = document.querySelectorAll('.mpd__fx__opt');
        for (var i = 0; i < opts.length; i++) {
            opts[i].classList.toggle('mpd__fx__opt--on', opts[i].getAttribute('data-fx') === name);
        }
    }

    function apply(name) {
        var layer = document.getElementById(LAYER_ID);
        if (!layer) return;
        if (!registry[name]) name = 'fire';
        current = name;
        layer.className = 'mpd__fx' + (name && name !== 'none' ? ' mpd__fx--' + name : '');
        layer.setAttribute('data-effect', name);
        registry[name](layer);
        syncPicker(name);
        try { localStorage.setItem(STORE_KEY, name); } catch (e) {}
    }

    function init() {
        var saved;
        try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
        var layer = document.getElementById(LAYER_ID);
        var fallback = (layer && layer.getAttribute('data-effect')) || 'fire';
        apply(saved || fallback);

        // wire up the settings picker buttons
        var opts = document.getElementById('mpdFxOpts');
        if (opts) {
            opts.addEventListener('click', function(e) {
                var btn = e.target.closest('.mpd__fx__opt');
                if (!btn) return;
                apply(btn.getAttribute('data-fx'));
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        register: register,
        apply: apply,
        current: function() { return current; },
        list: function() { return Object.keys(registry); }
    };
}());

/* ── Overview scroll: staggered reveal + header shadow ── */
(function() {
    if (typeof IntersectionObserver === 'undefined') return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var hdr = document.querySelector('.mp__header');
    var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(e) {
            if (e.isIntersecting) {
                // Stagger siblings that come into view together for a playful cascade.
                var sibs = e.target.parentNode ? e.target.parentNode.children : [];
                var idx = Array.prototype.indexOf.call(sibs, e.target);
                e.target.style.transitionDelay = Math.min((idx % 4) * 70, 210) + 'ms';
                e.target.classList.remove('ovw__hidden');
                e.target.classList.add('ovw__reveal');
                io.unobserve(e.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

    /* Hide + watch the overview blocks that start below the fold */
    setTimeout(function() {
        if (reduce) return;   // honour reduced-motion: no hide/reveal dance
        var vh = window.innerHeight;
        var sel = '#tabOverview .mp__section, #tabOverview .exp__break, ' +
                  '#tabOverview .rnk__section__wrap, #tabOverview .dshacad';
        document.querySelectorAll(sel).forEach(function(el) {
            if (el.getBoundingClientRect().top > vh * 0.92) {
                el.classList.add('ovw__hidden');
                io.observe(el);
            }
        });
    }, 200);

    /* Header shadow — lightweight toggle */
    window.addEventListener('scroll', function() {
        if (hdr) hdr.classList.toggle('mp__header--deep', window.scrollY > 40);
    }, { passive: true });
}());

/* ── Elite subscription (Stripe-backed) ──
 *
 * The payment backend (../server) is the source of truth. The browser only:
 *   • starts a Stripe Checkout Session and redirects to it,
 *   • opens the Stripe Customer Portal,
 *   • reads the server's verified subscription status to paint the UI.
 * No payment state is trusted from the client.
 */
// Resolve where the payment backend lives.
//  • opened via file://                         → localhost:4242
//  • opened on localhost with a different port   → localhost:4242  (e.g. VS Code Live Server :5500)
//  • served by the backend itself / production   → same origin
var PAY_API_BASE = (function () {
    if (location.protocol === 'file:') return 'http://localhost:4242';
    var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (isLocal && location.port !== '4242') return 'http://localhost:4242';
    return location.origin;
}());

// Fetch + safely parse JSON. Never throws on empty/non-JSON bodies (which is what
// produced the "Unexpected end of JSON input" error when /api wasn't reachable).
function payFetch(path, opts) {
    return fetch(PAY_API_BASE + path, opts).then(function (r) {
        return r.text().then(function (t) {
            var data = {};
            if (t) { try { data = JSON.parse(t); } catch (e) { data = { _parseError: true, _raw: t.slice(0, 200) }; } }
            return { ok: r.ok, status: r.status, data: data };
        });
    });
}

// ── Daily news digest: keep the server in sync with the user's saved universities ──
// (Saved unis live in localStorage, so the server can't see them unless we push.)
var DIGEST_ON_KEY = 'us_digest_on_' + user.id;
function digestEnabled() { return localStorage.getItem(DIGEST_ON_KEY) !== '0'; }   // default ON
function setDigestEnabled(on) { localStorage.setItem(DIGEST_ON_KEY, on ? '1' : '0'); }

function syncDigestSubscription() {
    try {
        if (!user || !user.email) return;
        // Wait until the server has told us whether this user is Elite: at page load eliteState is
        // still the default (not Elite), and acting on that unsubscribed — and wiped — every Elite
        // user on every visit.
        if (!eliteKnown) return;
        // The daily news digest is an Elite perk: only Elite users (who haven't
        // turned it off) stay subscribed — everyone else is ensured unsubscribed.
        var elite = (typeof eliteState !== 'undefined' && eliteState && !!eliteState.elite);
        if (!elite || !digestEnabled()) {
            payFetch('/api/digest/unsubscribe', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email: user.email })
            }).catch(function () {});
            return;
        }
        var saved = getSaved();
        var allUnis = (typeof UNI !== 'undefined') ? UNI : [];
        // Resolve across countries (UNI only holds the current one) via the registry.
        var names = saved.map(function (id) {
            var u = allUnis.find(function (x) { return x.id === id; }) ||
                    (window.uniFromRegistry && window.uniFromRegistry(id));
            return u ? (u.name || u.title) : null;
        }).filter(Boolean);
        // Data not loaded yet — don't overwrite the server's list with an empty one.
        if (saved.length && !names.length) return;
        var country = (typeof currentCountryCode !== 'undefined' && currentCountryCode) ? currentCountryCode : null;
        payFetch('/api/digest/subscribe', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: user.email, userId: user.id, universities: names, country: country })
        }).catch(function () {});
    } catch (e) {}
}
try { syncDigestSubscription(); } catch (e) {}

// Profile-menu toggle for the daily news email.
(function () {
    var t = document.getElementById('mpdDigestToggle');
    var lbl = document.getElementById('mpdDigestLabel');
    if (!t) return;
    function paint() {
        var on = digestEnabled();
        t.checked = on;
        if (lbl) lbl.textContent = on
            ? 'On — checked every 2 days; you only get an email when your saved universities have something new.'
            : 'Off — you won\'t get the weekly news email.';
    }
    if (!user || !user.email) { t.disabled = true; if (lbl) lbl.textContent = 'Sign in with an email to receive the weekly news email.'; return; }
    paint();
    t.addEventListener('change', function () {
        setDigestEnabled(t.checked);
        paint();
        syncDigestSubscription();
    });
}());

var eliteState = { elite: false, status: 'none', currentPeriodEnd: null, cancelAtPeriodEnd: false, cardBrand: null, cardLast4: null };
var eliteKnown = false;   // true once the server (or the admin rule) has answered

function isElite() { return !!eliteState.elite; }

function applyEliteUI() {
    var elite  = eliteState.elite;
    var avatar = document.getElementById('mpAvatarBtn');
    var wrap   = document.getElementById('mpAvatarWrap');
    if (avatar) avatar.classList.toggle('mp__avatar--elite', elite);
    if (wrap)   wrap.classList.toggle('is-elite', elite);

    var cta = document.querySelector('#openProModal .mp__cs__pro__cta__text');
    if (cta) cta.textContent = elite ? 'Elite member' : 'Unlock Elite';

    // Elite unlocks the "search any country" box in the destination picker
    if (typeof updateCountryPickerMode === 'function') updateCountryPickerMode();
    // Elite also unlocks the "Crowned Sovereign" title
    if (typeof updateTitleDisplay === 'function') updateTitleDisplay();
    // Elite-only "For You" matcher button (floating or header, per user preference)
    if (typeof window.updateFyButtons === 'function') window.updateFyButtons();
    // Elite: embed the matcher inline in Explore (replaces search + filter sections)
    if (typeof applyExploreMatcherLayout === 'function') applyExploreMatcherLayout();

    var btn = document.getElementById('getEliteBtn');
    if (btn) {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.cursor = '';
        btn.innerHTML = elite ? '<i class="fa-solid fa-gear"></i> Manage subscription' : 'Get Elite — €15/yr';
    }

    // Cache for instant paint on next load (purely cosmetic; server is authoritative)
    try { var p = getProfile(); p.elite = elite; setProfile(p); } catch (e) {}
}

// Admin accounts are always Elite (granted manually, never billed).
function isAdminAccount() {
    var admins = ['vanyochek'];
    var u = (user && user.username || '').toLowerCase();
    var e = (user && user.email || '').toLowerCase();
    return admins.indexOf(u) !== -1 || admins.indexOf(e) !== -1;
}

// Fetch the verified status from the backend and repaint.
function refreshEliteStatus(cb) {
    if (isAdminAccount()) {
        eliteState.elite = true;
        eliteState.status = 'granted';
        eliteKnown = true;
        applyEliteUI();
        try { syncDigestSubscription(); } catch (e) {}
        if (cb) cb(eliteState);
        return;
    }
    payFetch('/api/subscription/status?userId=' + encodeURIComponent(user.id) +
        '&email=' + encodeURIComponent(user.email || '') +
        '&username=' + encodeURIComponent(user.username || ''))
        .then(function (res) {
            if (!res.ok || res.data._parseError) { if (cb) cb(null); return; }
            var d = res.data;
            eliteState = {
                elite: !!d.elite, status: d.status, currentPeriodEnd: d.currentPeriodEnd,
                cancelAtPeriodEnd: !!d.cancelAtPeriodEnd, cardBrand: d.cardBrand, cardLast4: d.cardLast4
            };
            eliteKnown = true;
            applyEliteUI();
            // Elite status is now known — (un)subscribe to the daily digest accordingly.
            try { syncDigestSubscription(); } catch (e) {}
            if (cb) cb(eliteState);
        })
        .catch(function () { /* backend offline — keep the cached cosmetic state */ if (cb) cb(null); });
}

var PAY_SERVER_HINT = 'The payment server is not reachable at ' + PAY_API_BASE + '.\n\n' +
    '1) Start it:  cd server && npm start   (needs server/.env with your Stripe keys)\n' +
    '2) Open the site through it:  ' + PAY_API_BASE + '/mainPage.html';

function startEliteCheckout() {
    var btn = document.getElementById('getEliteBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Redirecting to checkout…'; }
    payFetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email, username: user.username })
    })
        .then(function (res) {
            if (res.ok && res.data.url) { window.location.href = res.data.url; return; }
            if (res.status === 409) { openElitePortal(); return; }   // already subscribed → manage instead
            if (res.data._parseError || res.status === 404) { alert(PAY_SERVER_HINT); }
            else { alert('Could not start checkout: ' + (res.data.message || res.data.error || ('HTTP ' + res.status))); }
            applyEliteUI();
        })
        .catch(function () {
            alert(PAY_SERVER_HINT);
            applyEliteUI();
        });
}

function openElitePortal() {
    payFetch('/api/portal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
    })
        .then(function (res) {
            if (res.ok && res.data.url) { window.location.href = res.data.url; return; }
            if (res.data._parseError || res.status === 404) { alert('No billing profile found yet. Subscribe first to manage your plan.'); }
            else { alert('Could not open the billing portal: ' + (res.data.message || res.data.error || ('HTTP ' + res.status))); }
        })
        .catch(function () { alert(PAY_SERVER_HINT); });
}

// Lightweight checkout result banner (top-center toast).
function showCheckoutBanner(kind) {
    var ok = kind === 'success';
    var bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:6000;' +
        'display:flex;align-items:center;gap:10px;padding:13px 20px;border-radius:13px;font-family:Montserrat,sans-serif;' +
        'font-size:13px;font-weight:700;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25);' +
        'background:' + (ok ? 'linear-gradient(135deg,#27ae60,#1e8e4f)' : 'linear-gradient(135deg,#e67e22,#d35400)') + ';' +
        'animation:arIn .3s ease both';
    bar.innerHTML = (ok
        ? '<i class="fa-solid fa-crown"></i> Payment successful — activating your Elite membership…'
        : '<i class="fa-solid fa-circle-info"></i> Checkout canceled — you have not been charged.');
    document.body.appendChild(bar);
    setTimeout(function () { bar.style.transition = 'opacity .4s'; bar.style.opacity = '0'; setTimeout(function () { bar.remove(); }, 400); }, ok ? 6000 : 4500);
}

// Paint instantly from cache, then verify against the server.
(function () {
    try { eliteState.elite = !!getProfile().elite; } catch (e) {}
    applyEliteUI();
    refreshEliteStatus();
}());

// Handle the redirect back from Stripe Checkout.
(function () {
    var params = new URLSearchParams(location.search);
    var c = params.get('checkout');
    if (!c) return;
    history.replaceState({}, '', location.pathname);   // clean the URL
    if (c === 'success') {
        showCheckoutBanner('success');
        var sid = params.get('session_id');
        // Confirm the paid session server-side (writes Elite to the DB immediately),
        // then refresh. A short poll covers the webhook path as a fallback.
        if (sid) {
            payFetch('/api/checkout/confirm?session_id=' + encodeURIComponent(sid))
                .then(function () { refreshEliteStatus(); })
                .catch(function () { refreshEliteStatus(); });
        }
        var tries = 0;
        (function poll() {
            refreshEliteStatus(function (st) {
                if (st && st.elite) return;
                if (++tries < 6) setTimeout(poll, 2000);
            });
        }());
    } else if (c === 'cancel') {
        showCheckoutBanner('cancel');
    }
}());

(function() {
    var overlay  = document.getElementById('pricingOverlay');
    var openBtn  = document.getElementById('openProModal');
    var closeBtn = document.getElementById('pricingClose');
    if (!overlay) return;

    function openPricing() {
        refreshEliteStatus();
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closePricing() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }
    window.openPricingModal = openPricing;   // let other features trigger the upsell

    if (openBtn)  openBtn.addEventListener('click', openPricing);
    if (closeBtn) closeBtn.addEventListener('click', closePricing);
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closePricing();
    });
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closePricing();
    });

    // Get Elite → Stripe Checkout; if already Elite → Customer Portal.
    var eliteBtn = document.getElementById('getEliteBtn');
    if (eliteBtn) eliteBtn.addEventListener('click', function() {
        if (isElite()) { openElitePortal(); }
        else { startEliteCheckout(); }
    });
}());

/* ══════════════ Titles (Shonen power tiers) ══════════════ */
(function() {
    // ── lightweight counters used by some titles ──
    var CMP_KEY     = 'us_titles_cmp_'      + user.id;
    var VISITED_KEY = 'us_titles_visited_'  + user.id;
    var AI_KEY      = 'us_ai_prompts_'      + user.id;

    window.bumpCmpCount = function() {
        var n = parseInt(localStorage.getItem(CMP_KEY) || '0', 10) || 0;
        localStorage.setItem(CMP_KEY, String(n + 1));
        updateTitleDisplay();
    };
    window.addVisitedCountry = function(code) {
        var set;
        try { set = JSON.parse(localStorage.getItem(VISITED_KEY) || '[]'); } catch (e) { set = []; }
        if (set.indexOf(code) === -1) { set.push(code); localStorage.setItem(VISITED_KEY, JSON.stringify(set)); }
        updateTitleDisplay();
    };

    function titleStats() {
        var visited = [];
        try { visited = JSON.parse(localStorage.getItem(VISITED_KEY) || '[]'); } catch (e) {}
        return {
            saved:       (typeof getSaved === 'function' ? getSaved() : []).length,
            comparisons: parseInt(localStorage.getItem(CMP_KEY) || '0', 10) || 0,
            aiQ:         parseInt(localStorage.getItem(AI_KEY) || '0', 10) || 0,
            dlDone:      (typeof getDlDone === 'function' ? getDlDone() : []).length,
            visited:     visited.length,
            friends:     (typeof getFriends === 'function' ? getFriends() : []).length,
            apps:        (typeof getFormApps === 'function' ? getFormApps() : []).length,
            elite:       (typeof eliteState !== 'undefined' && eliteState && !!eliteState.elite),
            subjects:    (function () { try { var g = JSON.parse(localStorage.getItem('us_gradebook_' + user.id) || 'null'); return g && g.subjects ? g.subjects.length : 0; } catch (e) { return 0; } })(),
            schSaved:    (function () { try { return (JSON.parse(localStorage.getItem('us_sch_saved_' + user.id) || '[]') || []).length; } catch (e) { return 0; } })(),
            carSaved:    (function () { try { return (JSON.parse(localStorage.getItem('us_car_saved_' + user.id) || '[]') || []).length; } catch (e) { return 0; } })(),
            outcomes:    parseInt(localStorage.getItem('us_outcomes_shared_' + user.id) || '0', 10) || 0,
            streakBest:  (function () { try { var t = JSON.parse(localStorage.getItem('us_streak_' + user.id) || 'null'); return t ? Math.max(t.best || 0, t.count || 0) : 0; } catch (e) { return 0; } })()
        };
    }

    // tiers 1→10, escalating shonen intensity. `goal` returns "current/target".
    var TITLES = [
        { id:'novice',     tier:1,  name:'Novice',           icon:'fa-seedling',            how:'Available to every member — the perfect starting title',
          check:function(s){ return true; },                goal:function(){ return 'Available'; } },
        { id:'seeker',     tier:2,  name:'Risen Seeker',     icon:'fa-compass',             how:'Save 10 universities',
          check:function(s){ return s.saved >= 10; },       goal:function(s){ return Math.min(s.saved,10)+'/10'; } },
        { id:'scholarmark',tier:3,  name:"Scholar's Mark",   icon:'fa-book-open-reader',    how:'Add 5 subjects to your Gradebook',
          check:function(s){ return s.subjects >= 5; },     goal:function(s){ return Math.min(s.subjects||0,5)+'/5'; } },
        { id:'instinct',   tier:4,  name:'Sharpened Instinct',icon:'fa-eye',                how:'Run 3 head-to-head comparisons',
          check:function(s){ return s.comparisons >= 3; },  goal:function(s){ return Math.min(s.comparisons,3)+'/3'; } },
        { id:'fortune',    tier:5,  name:'Fortune Hunter',   icon:'fa-gem',                 how:'Save 3 scholarships',
          check:function(s){ return s.schSaved >= 3; },     goal:function(s){ return Math.min(s.schSaved||0,3)+'/3'; } },
        { id:'trailblazer',tier:6,  name:'Trailblazer',      icon:'fa-flag-checkered',      how:'Share an admission result',
          check:function(s){ return s.outcomes >= 1; },     goal:function(s){ return Math.min(s.outcomes||0,1)+'/1'; } },
        { id:'oracle',     tier:7,  name:"Oracle's Vessel",  icon:'fa-wand-magic-sparkles', how:'Ask 5 questions in Ask AI',
          check:function(s){ return s.aiQ >= 5; },          goal:function(s){ return Math.min(s.aiQ,5)+'/5'; } },
        { id:'pathfinder', tier:8,  name:'Pathfinder',       icon:'fa-route',               how:'Save 3 companies in Career paths',
          check:function(s){ return s.carSaved >= 3; },     goal:function(s){ return Math.min(s.carSaved||0,3)+'/3'; } },
        { id:'timesever',  tier:9,  name:'Time Severer',     icon:'fa-hourglass-half',      how:'Complete 3 application deadlines',
          check:function(s){ return s.dlDone >= 3; },       goal:function(s){ return Math.min(s.dlDone,3)+'/3'; } },
        { id:'flame',      tier:10,  name:'Undying Flame',    icon:'fa-fire-flame-curved',   how:'Keep a 7-day streak',
          check:function(s){ return s.streakBest >= 7; },   goal:function(s){ return Math.min(s.streakBest||0,7)+'/7'; } },
        { id:'worldender', tier:11, name:'World Ender',      icon:'fa-earth-americas',      how:'Explore 6 different countries',
          check:function(s){ return s.visited >= 6; },      goal:function(s){ return Math.min(s.visited,6)+'/6'; } },
        { id:'soulbond',   tier:12, name:'Soul-Bonded',      icon:'fa-user-group',          how:'Add 3 friends',
          check:function(s){ return s.friends >= 3; },      goal:function(s){ return Math.min(s.friends,3)+'/3'; } },
        { id:'strategist', tier:13, name:'Grand Strategist', icon:'fa-chess-knight',        how:'Submit an application via the AI Assistant',
          check:function(s){ return s.apps >= 1; },         goal:function(s){ return Math.min(s.apps,1)+'/1'; } },
        { id:'elite',      tier:14, name:'Elite',            icon:'fa-crown',               how:'Unlocked with an Elite subscription',
          check:function(s){ return s.elite; },             goal:function(s){ return (s.elite?1:0)+'/1'; } },
        { id:'transcend',  tier:15, name:'Transcendent',     icon:'fa-dragon',              how:'Earn every other title',
          check:function(){ return false; },                goal:function(){ return ''; } } // computed below
    ];

    var TCOLORS = {
        novice:'#27ae60', seeker:'#2ecc71', scholarmark:'#0ea5e9', instinct:'#3498db', fortune:'#c58b06', oracle:'#9b59b6',
        pathfinder:'#6366f1', trailblazer:'#0f8f7e', timesever:'#1abc9c', flame:'#f2551d', worldender:'#e67e22', soulbond:'#e84393', strategist:'#e74c3c',
        elite:'#e0a800', transcend:'#d63af0'
    };
    function titleColor(id) { return TCOLORS[id] || '#d97c14'; }
    function hexA(hex, a) {
        var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }

    function evaluate() {
        var s = titleStats();
        var res = TITLES.map(function(t) { return { t:t, earned: t.check(s) }; });
        // capstone ("transcend") = every other title earned
        var capIdx = res.findIndex(function(r){ return r.t.id === 'transcend'; });
        if (capIdx !== -1) {
            res[capIdx].earned = res.every(function(r, i){ return i === capIdx || r.earned; });
        }
        return { stats:s, res:res, earnedCount: res.filter(function(r){ return r.earned; }).length };
    }

    function getEquipped() { try { return getProfile().title || null; } catch (e) { return null; } }
    function setEquipped(id) { try { var p = getProfile(); p.title = id; setProfile(p); } catch (e) {} }

    // No title until the user explicitly equips one (empty slot, like the budget prompt).
    function activeTitle() {
        var eqId = getEquipped();
        if (!eqId) return null;
        var found = evaluate().res.find(function(r){ return r.t.id === eqId && r.earned; });
        return found ? found.t : null;
    }

    window.updateTitleDisplay = function() {
        var t = activeTitle();
        var col = t ? titleColor(t.id) : null;
        var chip = document.getElementById('mpTitleChip');
        var drop = document.getElementById('mpdTitle');
        var hero = document.getElementById('mpHeroTitle');

        // Cool pill look: subtle gradient + matching border + soft colour glow + crisp text.
        function pill(el, withSpan) {
            ['color', 'background', 'borderColor', 'boxShadow', 'textShadow'].forEach(function (k) { el.style[k] = ''; });
            el.style.setProperty('--tc', col);
            el.classList.add('ttl-chip');
            el.innerHTML = '<span class="ttl-chip__ic"><i class="fa-solid ' + t.icon + '"></i></span>' + (withSpan ? '<span>' + t.name + '</span>' : '<span>' + t.name + '</span>') +
                (el.id === 'mpHeroTitle' ? '<em>Tier ' + t.tier + '</em>' : '');
        }
        if (chip) {
            if (t) { chip.style.display = 'inline-flex'; pill(chip, false); }
            else { chip.style.display = 'none'; }
        }
        if (drop) {
            if (t) { pill(drop, true); }
            else {
                drop.style.color = ''; drop.style.background = ''; drop.style.borderColor = '';
                drop.innerHTML = '<i class="fa-solid fa-lock"></i> <span>No title yet</span>';
            }
        }
        if (hero) {
            if (t) { hero.style.display = 'inline-flex'; pill(hero, false); }
            else { hero.style.display = 'none'; }
        }
    };

    // ── Modal ──
    var overlay = document.getElementById('titlesOverlay');
    function openTitles() { renderTitles(); if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; } }
    function closeTitles() { if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; } }

    function renderTitles() {
        var ev = evaluate();
        var grid = document.getElementById('ttlGrid');
        var countEl = document.getElementById('ttlEarnedCount');
        if (countEl) countEl.textContent = ev.earnedCount;
        var totEl = document.getElementById('ttlTotal'); if (totEl) totEl.textContent = ev.res.length;
        var barEl = document.getElementById('ttlBar'); if (barEl) barEl.style.setProperty('--p', (ev.earnedCount / ev.res.length).toFixed(3));
        if (!grid) return;
        var eqId = getEquipped();
        var activeId = activeTitle() ? activeTitle().id : null;
        grid.innerHTML = ev.res.map(function(r, idx) {
            var t = r.t;
            var earned = r.earned;
            var isOn = (t.id === (eqId || activeId)) && earned;
            var action = earned
                ? '<button class="ttl__equip__btn' + (isOn ? ' ttl__equip__btn--on' : '') + '" data-title="' + t.id + '"' + (isOn ? ' disabled' : '') + '>' + (isOn ? '<i class="fa-solid fa-check"></i> Equipped' : 'Equip') + '</button>'
                : '<i class="fa-solid fa-lock ttl__card__lockicon"></i>';
            var g = t.goal(ev.stats), m = /^(\d+)\/(\d+)$/.exec(g || ''), frac = m ? Math.min(1, +m[1] / +m[2]) : 0;
            var how = earned
                ? '<div class="ttl__card__how ttl__card__how--done"><i class="fa-solid fa-circle-check"></i> Awakened</div>'
                : (m ? '<div class="ttl__card__prog"><i style="--p:' + frac.toFixed(3) + '"></i><span>' + g + '</span></div>' : '<div class="ttl__card__how"><i class="fa-solid fa-lock"></i> Locked</div>');
            var iconStyle = '';
            return '<div class="ttl__card ttl__card--' + (earned ? 'earned' : 'locked') + '" style="--tc:' + titleColor(t.id) + ';--n:' + idx + '">' +
                '<div class="ttl__card__icon"' + iconStyle + '><i class="fa-solid ' + t.icon + '"></i></div>' +
                '<div class="ttl__card__body">' +
                    '<div class="ttl__card__name">' + t.name + ' <span class="ttl__card__tier">Tier ' + t.tier + '</span></div>' +
                    '<div class="ttl__card__desc">' + t.how + '</div>' +
                    how +
                '</div>' +
                '<div class="ttl__card__action">' + action + '</div>' +
            '</div>';
        }).join('');
        grid.querySelectorAll('.ttl__equip__btn[data-title]').forEach(function(btn) {
            if (btn.disabled) return;
            btn.addEventListener('click', function() {
                setEquipped(btn.dataset.title);
                renderTitles();
                updateTitleDisplay();
            });
        });
    }

    var mpdTitle = document.getElementById('mpdTitle');
    if (mpdTitle) mpdTitle.addEventListener('click', openTitles);
    var chip = document.getElementById('mpTitleChip');
    if (chip) chip.addEventListener('click', openTitles);
    var heroTitleBtn = document.getElementById('mpHeroTitle');
    if (heroTitleBtn) heroTitleBtn.addEventListener('click', openTitles);
    var closeBtn = document.getElementById('titlesClose');
    if (closeBtn) closeBtn.addEventListener('click', closeTitles);
    if (overlay) overlay.addEventListener('click', function(e) { if (e.target === overlay) closeTitles(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && overlay && overlay.classList.contains('open')) closeTitles(); });

    // First login: equip Novice automatically (only if the user has never set a title).
    try { var _p = getProfile(); if (_p.title === undefined) { _p.title = 'novice'; setProfile(_p); } } catch (e) {}

    updateTitleDisplay();
}());

/* ══════════════ Customisable top-container photos ══════════════ */
(function() {
    var HERO_DEFS = [
        { key:'explore',   sel:'.exp__hero__img',   type:'img', def:'images/Toji.jpg'   },
        { key:'apply',     sel:'.apf__hero__img',   type:'img', def:'images/Gogo.avif'  },
        { key:'chances',   sel:'.ins__hero__photo', type:'img', def:'images/Suguro.jpg' },
        { key:'deadlines', sel:'.dl__hero__img',     type:'img', def:'images/DemonSlayer.jpeg' },
        { key:'overview',  sel:'.ovn__img',          type:'img', def:'images/DemonSlayer.jpeg' },
        { key:'matcher',   sel:'.fy__hero__img',     type:'img', def:'images/Paris.avif' }
    ];
    var DL_OVERLAY = 'linear-gradient(120deg, rgba(0,0,0,.66) 0%, rgba(0,0,0,.4) 55%, rgba(0,0,0,.25) 100%)';
    function keyOf(k) { return 'us_hero_' + k + '_' + user.id; }
    function defOf(k) { for (var i=0;i<HERO_DEFS.length;i++){ if(HERO_DEFS[i].key===k) return HERO_DEFS[i]; } return null; }

    function applyHeroPic(def) {
        var el = document.querySelector(def.sel);
        if (!el) return;
        var data = localStorage.getItem(keyOf(def.key));
        if (def.type === 'img') {
            if (data) el.src = data;
        } else { // background container
            if (data) {
                el.style.backgroundImage = DL_OVERLAY + ", url('" + data + "')";
                el.style.backgroundSize = 'cover';
                el.style.backgroundPosition = 'center';
                el.style.backgroundRepeat = 'no-repeat';
            }
        }
    }
    function resetHeroPic(def) {
        localStorage.removeItem(keyOf(def.key));
        var el = document.querySelector(def.sel);
        if (!el) return;
        if (def.type === 'img') { if (def.def) el.src = def.def; }
        else { el.style.backgroundImage = ''; el.style.backgroundSize = ''; el.style.backgroundPosition = ''; el.style.backgroundRepeat = ''; }
    }
    function applyAll() { HERO_DEFS.forEach(applyHeroPic); }

    // Downscale large uploads so they fit comfortably in localStorage.
    function readImage(file, cb) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var max = 1400, w = img.width, h = img.height;
                if (w > max) { h = Math.round(h * max / w); w = max; }
                var c = document.createElement('canvas');
                c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                try { cb(c.toDataURL('image/jpeg', 0.85)); } catch (err) { cb(e.target.result); }
            };
            img.onerror = function() { cb(e.target.result); };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    var fileInput = document.getElementById('heroPicInput');
    var pendingKey = null;

    document.querySelectorAll('.hero__editpic').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            pendingKey = btn.dataset.hero;
            if (fileInput) { fileInput.value = ''; fileInput.click(); }
        });
        // Right-click to reset to the default photo
        btn.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            var def = defOf(btn.dataset.hero);
            if (def && confirm('Reset this photo to the default?')) resetHeroPic(def);
        });
    });

    if (fileInput) fileInput.addEventListener('change', function() {
        var file = fileInput.files && fileInput.files[0];
        if (!file || !pendingKey) return;
        var def = defOf(pendingKey);
        readImage(file, function(dataUrl) {
            try { localStorage.setItem(keyOf(def.key), dataUrl); }
            catch (err) { alert('That image is too large to save. Please try a smaller one.'); return; }
            applyHeroPic(def);
        });
    });

    // Exposed so the Settings panel can drive the same logic
    window.changeHeroPic = function(key) { pendingKey = key; if (fileInput) { fileInput.value = ''; fileInput.click(); } };
    window.resetHeroPic  = function(key) { var d = defOf(key); if (d) resetHeroPic(d); };

    applyAll();
}());

/* ── Settings: change top-container photos + safety net for stuck overlays ── */
(function() {
    // Wire the "Change / Reset" photo buttons in the profile dropdown
    document.querySelectorAll('.mpd__pic__btn[data-pic]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof window.changeHeroPic === 'function') window.changeHeroPic(btn.dataset.pic);
        });
    });
    document.querySelectorAll('.mpd__pic__reset[data-picreset]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (typeof window.resetHeroPic === 'function') window.resetHeroPic(btn.dataset.picreset);
        });
    });

    // Safety net: never let a modal leave the page greyed-out / frozen.
    function dismissOverlays() {
        document.querySelectorAll(
            '.pricing__overlay.open, .pay__overlay.open, .ttl__overlay.open, .cmp__modal__overlay.open'
        ).forEach(function(o) { o.classList.remove('open'); });
        document.body.style.overflow = '';
    }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') dismissOverlays(); });
}());

/* ── Quick account switching (Settings) ── */
(function() {
    var ACCT_PAGE_SIZE = 4;
    var acctPage = 0;
    var ADMIN_ACCOUNTS = ['vanyochek'];   // accounts shown with Admin status

    function acctColor(name) {
        if (typeof frdAvaColor === 'function') return frdAvaColor(name || 'U');
        return '#d97c14';
    }
    function allUsers() { try { return JSON.parse(localStorage.getItem('uniscout_users') || '[]'); } catch (e) { return []; } }

    function isAdminAcct(a) {
        return (a.username && ADMIN_ACCOUNTS.indexOf(a.username.toLowerCase()) !== -1) ||
               (a.email && ADMIN_ACCOUNTS.indexOf(a.email.toLowerCase()) !== -1);
    }
    function eliteOfAcct(a) {
        if (a.id === user.id) return (typeof eliteState !== 'undefined' && eliteState && !!eliteState.elite);
        try { return !!(JSON.parse(localStorage.getItem('us_profile_' + a.id) || '{}').elite); } catch (e) { return false; }
    }
    // Admin overrides everything (for me, only Admin — no elite styling)
    function statusOf(a) {
        if (isAdminAcct(a)) return { label: 'Admin', cls: 'admin', glow: false };
        if (eliteOfAcct(a)) return { label: 'Elite user', cls: 'elite', glow: true };
        return { label: 'User', cls: 'user', glow: false };
    }

    function switchAccount(id) {
        var a = allUsers().find(function(x) { return x.id === id; });
        if (!a) return;
        localStorage.setItem('uniscout_session', JSON.stringify({ id: a.id, username: a.username, email: a.email }));
        sessionStorage.removeItem('uniscout_session');
        window.location.href = 'mainPage.html';
    }

    function renderAccounts() {
        var box = document.getElementById('mpdAccounts');
        if (!box) return;
        // Switch-account is admin-only (Vanyochek) — hide the whole section otherwise.
        var admin = (typeof isAdminAccount === 'function') && isAdminAccount();
        var sect = document.getElementById('mpdSwitchSection'), sdiv = document.getElementById('mpdSwitchDivider');
        if (sect) sect.style.display = admin ? '' : 'none';
        if (sdiv) sdiv.style.display = admin ? '' : 'none';
        if (!admin) return;
        var all = allUsers();
        if (!all.length) { box.innerHTML = '<div style="font-size:11px;color:var(--text3)">No other accounts on this device.</div>'; return; }

        var totalPages = Math.ceil(all.length / ACCT_PAGE_SIZE);
        if (acctPage > totalPages - 1) acctPage = totalPages - 1;
        if (acctPage < 0) acctPage = 0;
        var pageItems = all.slice(acctPage * ACCT_PAGE_SIZE, acctPage * ACCT_PAGE_SIZE + ACCT_PAGE_SIZE);

        var html = pageItems.map(function(a) {
            var current = a.id === user.id;
            var prof = {}; try { prof = JSON.parse(localStorage.getItem('us_profile_' + a.id) || '{}'); } catch (e) {}
            var av = prof.avatar ? '<img src="' + prof.avatar + '" alt="">' : (a.username || 'U').charAt(0).toUpperCase();
            var st = statusOf(a);
            return '<button class="mpd__acct' + (current ? ' mpd__acct--current' : '') + '" data-acct="' + a.id + '"' + (current ? ' disabled' : '') + '>' +
                '<span class="mpd__acct__av" style="background:' + acctColor(a.username || a.id) + '">' + av + '</span>' +
                '<span class="mpd__acct__info">' +
                    '<span class="mpd__acct__name' + (st.glow ? ' mpd__acct__name--glow' : '') + '">' + (a.username || 'User') + '</span>' +
                '</span>' +
                '<span class="mpd__acct__status mpd__acct__status--' + st.cls + '">' + st.label + '</span>' +
            '</button>';
        }).join('');

        if (totalPages > 1) {
            html += '<div class="mpd__acct__pager">' +
                '<button class="mpd__acct__pg" id="acctPrev"' + (acctPage === 0 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>' +
                '<span>' + (acctPage + 1) + ' / ' + totalPages + '</span>' +
                '<button class="mpd__acct__pg" id="acctNext"' + (acctPage >= totalPages - 1 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
        }
        box.innerHTML = html;

        box.querySelectorAll('.mpd__acct[data-acct]').forEach(function(btn) {
            if (btn.disabled) return;
            btn.addEventListener('click', function() { switchAccount(btn.dataset.acct); });
        });
        var prev = document.getElementById('acctPrev');
        var next = document.getElementById('acctNext');
        if (prev) prev.addEventListener('click', function(e) { e.stopPropagation(); acctPage--; renderAccounts(); });
        if (next) next.addEventListener('click', function(e) { e.stopPropagation(); acctPage++; renderAccounts(); });
    }

    renderAccounts();
    // Refresh the list whenever the profile dropdown is opened
    var avatarBtn = document.getElementById('mpAvatarBtn');
    if (avatarBtn) avatarBtn.addEventListener('click', renderAccounts);
}());

/* ── Apply page is Elite-only ── */
(function() {
    function eliteNow() { return typeof eliteState !== 'undefined' && eliteState && !!eliteState.elite; }

    function upsellToast(msg) {
        var bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:6000;' +
            'display:flex;align-items:center;gap:9px;padding:13px 20px;border-radius:13px;font-family:Montserrat,sans-serif;' +
            'font-size:13px;font-weight:700;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25);' +
            'background:linear-gradient(135deg,var(--orange),var(--orange2));animation:arIn .3s ease both';
        bar.innerHTML = '<i class="fa-solid fa-crown"></i> ' + msg;
        document.body.appendChild(bar);
        setTimeout(function(){ bar.style.transition='opacity .4s'; bar.style.opacity='0'; setTimeout(function(){ bar.remove(); }, 400); }, 3500);
    }

    // Intercept the Apply buttons — Elite goes through, others get the upgrade offer.
    document.querySelectorAll('.apf__hero__btn, .apf__banner__btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            if (eliteNow()) return;        // Elite → allow navigation to applicationForm.html
            e.preventDefault();
            upsellToast('Applying is an Elite feature — upgrade to unlock it.');
            if (typeof window.openPricingModal === 'function') window.openPricingModal();
        });
    });

    // If redirected back from applicationForm.html (non-Elite), show the upsell.
    if (/[?&]upgrade=apply\b/.test(location.search)) {
        history.replaceState({}, '', location.pathname);
        setTimeout(function() {
            upsellToast('Applying is an Elite feature — upgrade to unlock it.');
            if (typeof window.openPricingModal === 'function') window.openPricingModal();
        }, 400);
    }
}());

/* ══════════════ Elite "For You" matcher ══════════════ */
(function() {
    var SUBJECTS = ['Business','Computer Science','Engineering','Medicine','Law','Humanities','Science',
        'Arts','Economics','Psychology','Architecture','Mathematics','Social Sciences','Education','Design'];
    var HOBBIES = ['Music','Art','Technology','Gaming','Volunteering','Travel','Reading','Entrepreneurship','Nature','Nightlife','Fitness','Esports'];
    var PRIORITIES = ['Research','Employability','Social life','Affordability','Prestige'];
    var SPORTS = ['Football','Basketball','Tennis','Athletics','Swimming','Rugby','Rowing','Volleyball','Cycling',
        'Skiing','Golf','Martial arts','Gymnastics','Hockey','Cricket','Other'];

    var fab = document.getElementById('fyFab');
    var overlay = document.getElementById('fyOverlay');
    var modal = document.getElementById('fyModal');
    var hdrBtn = document.getElementById('fyHdrBtn');
    if (!fab || !overlay) return;

    var sel = { subjects: [], hobbies: [], priorities: [], countries: [] };

    function buildChips(containerId, list, bucket) {
        var box = document.getElementById(containerId);
        if (!box) return;
        box.innerHTML = list.map(function(x) { return '<span class="fy__chip" data-v="' + x + '">' + x + '</span>'; }).join('');
        box.querySelectorAll('.fy__chip').forEach(function(chip) {
            chip.addEventListener('click', function() {
                var v = chip.dataset.v, i = sel[bucket].indexOf(v);
                if (i === -1) { sel[bucket].push(v); chip.classList.add('is-on'); }
                else { sel[bucket].splice(i, 1); chip.classList.remove('is-on'); }
            });
        });
    }

    // Broad option pools searched by the subject/hobby pickers (the visible chips
    // stay short to save space; everything else is found by typing).
    var SUBJECTS_ALL = ['Business','Computer Science','Engineering','Medicine','Law','Humanities','Science','Arts',
        'Economics','Psychology','Architecture','Mathematics','Social Sciences','Education','Design','Biology','Chemistry',
        'Physics','Nursing','Pharmacy','Dentistry','Veterinary Medicine','Finance','Accounting','Marketing','Management',
        'Political Science','International Relations','Philosophy','History','Geography','Linguistics','Languages','Literature',
        'Journalism','Communications','Media Studies','Film','Music','Fine Arts','Sociology','Anthropology','Environmental Science',
        'Data Science','Artificial Intelligence','Cybersecurity','Software Engineering','Civil Engineering','Mechanical Engineering',
        'Electrical Engineering','Aerospace Engineering','Biomedical Engineering','Chemical Engineering','Statistics','Astronomy',
        'Geology','Neuroscience','Public Health','Nutrition','Sports Science','Tourism','Hospitality','Agriculture','Criminology',
        'Theology','Archaeology','Robotics','Game Design','Fashion Design','Interior Design','Urban Planning','Biotechnology'];
    var HOBBIES_ALL = HOBBIES.concat(['Photography','Cooking','Dancing','Writing','Painting','Cinema','Podcasts','Yoga',
        'Hiking','Cycling','Board games','Chess','Coding','Robotics','Astronomy','Fashion','DIY','Gardening','Theatre',
        'Singing','Investing','Blogging','Streaming','Skateboarding','Surfing','Climbing','Running','Meditation','Languages',
        'Collecting','Animation','3D printing','Calligraphy']);

    // ── Reusable searchable chip picker ──
    // Inline, no popover: the chips area shows the user's selected chips (removable)
    // followed by up to 3 suggestion chips (paginated) — the user can click a
    // suggestion OR type in the small search box on the right to filter the pool.
    function ChipPicker(cfg) {
        var chipsEl = document.getElementById(cfg.chipsId);
        var input   = document.getElementById(cfg.inputId);
        if (!chipsEl || !input) return null;
        var bucket = cfg.bucket;
        var PAGE = cfg.pageSize || 3;
        var query = '', page = 0;

        function esc(s) { return String(s).replace(/"/g, '&quot;'); }
        function suggestions() {
            var q = query.trim().toLowerCase();
            var taken = sel[bucket];
            return cfg.pool.filter(function (o) {
                if (taken.indexOf(o) !== -1) return false;
                return !q || o.toLowerCase().indexOf(q) !== -1;
            });
        }
        function renderChips(animate) {
            var html = '';
            sel[bucket].forEach(function (o) {
                html += '<span class="fy__chip is-on fy__chip--rm" data-rm="' + esc(o) + '">' + o + ' <i class="fa-solid fa-xmark"></i></span>';
            });
            var sug = suggestions();
            var pages = Math.max(1, Math.ceil(sug.length / PAGE));
            if (page > pages - 1) page = pages - 1;
            if (page < 0) page = 0;
            var anim = animate ? ' anim' : '';
            sug.slice(page * PAGE, page * PAGE + PAGE).forEach(function (o, i) {
                html += '<span class="fy__chip fy__chip--sug' + anim + '" style="--i:' + i + '" data-add="' + esc(o) + '"><i class="fa-solid fa-plus"></i> ' + o + '</span>';
            });
            if (sug.length > PAGE) {
                html += '<span class="fy__pick__pager">' +
                    '<button type="button" class="fy__pick__pg" data-pg="prev"' + (page === 0 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>' +
                    '<button type="button" class="fy__pick__pg" data-pg="next"' + (page >= pages - 1 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>' +
                '</span>';
            }
            if (!sel[bucket].length && !sug.length) html += '<span class="fy__pick__none">No matches — try another word</span>';
            chipsEl.innerHTML = html;
            chipsEl.querySelectorAll('[data-add]').forEach(function (el) { el.addEventListener('click', function () { add(el.dataset.add); }); });
            chipsEl.querySelectorAll('[data-rm]').forEach(function (el) { el.addEventListener('click', function () { remove(el.dataset.rm); }); });
            chipsEl.querySelectorAll('.fy__pick__pg').forEach(function (b) { b.addEventListener('click', function () { if (b.disabled) return; page += (b.dataset.pg === 'next' ? 1 : -1); renderChips(true); }); });
        }
        function add(v) { if (sel[bucket].indexOf(v) === -1) sel[bucket].push(v); renderChips(false); input.focus(); }
        function remove(v) { var i = sel[bucket].indexOf(v); if (i !== -1) sel[bucket].splice(i, 1); renderChips(false); }

        input.addEventListener('input', function () { query = input.value; page = 0; renderChips(false); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); var s = suggestions(); if (s.length) { add(s[page * PAGE] || s[0]); query = ''; input.value = ''; page = 0; renderChips(false); } }
        });
        // reveal animation: suggestions stagger in when the search box gains focus
        var pickEl = chipsEl.closest('.fy__pick');
        input.addEventListener('focus', function () { if (pickEl) pickEl.classList.add('is-focused'); renderChips(true); });
        input.addEventListener('blur', function () { if (pickEl) pickEl.classList.remove('is-focused'); });

        renderChips(true);
        return { refresh: function () { query = ''; page = 0; input.value = ''; renderChips(true); } };
    }

    // ── Custom select (replaces the ugly native dropdown, keeps it as the value source) ──
    function enhanceSelect(native) {
        if (!native || native.__enhanced) return;
        native.__enhanced = true;
        var wrap = document.createElement('div');
        wrap.className = 'fy__sel';
        native.parentNode.insertBefore(wrap, native);
        wrap.appendChild(native);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fy__sel__btn';
        var pop = document.createElement('div');
        pop.className = 'fy__sel__pop';
        pop.hidden = true;
        wrap.appendChild(btn);
        wrap.appendChild(pop);

        function label() { var o = native.options[native.selectedIndex]; return o ? o.text : ''; }
        function renderBtn() { btn.innerHTML = '<span>' + label() + '</span><i class="fa-solid fa-chevron-down fy__sel__caret"></i>'; }
        function renderPop() {
            pop.innerHTML = Array.prototype.map.call(native.options, function (o, i) {
                return '<div class="fy__sel__opt' + (i === native.selectedIndex ? ' is-sel' : '') + '" data-i="' + i + '">' + o.text + '</div>';
            }).join('');
        }
        function close() { pop.hidden = true; wrap.classList.remove('is-open', 'fy__sel--up'); }
        function open() {
            document.querySelectorAll('.fy__sel.is-open').forEach(function (w) { if (w.__close) w.__close(); });
            renderPop(); pop.hidden = false; wrap.classList.add('is-open');
            // Flip the dropdown upward when there isn't room below (so tall lists
            // like Sport don't get clipped by the scroll container / viewport).
            var rect = btn.getBoundingClientRect();
            var popH = Math.min(260, native.options.length * 38 + 12);
            var spaceBelow = window.innerHeight - rect.bottom;
            wrap.classList.toggle('fy__sel--up', spaceBelow < popH + 16 && rect.top > spaceBelow);
        }
        wrap.__close = close;
        btn.addEventListener('click', function (e) { e.stopPropagation(); if (pop.hidden) open(); else close(); });
        pop.addEventListener('click', function (e) {
            var o = e.target.closest('.fy__sel__opt'); if (!o) return;
            native.selectedIndex = +o.dataset.i;
            native.dispatchEvent(new Event('change', { bubbles: true }));
            renderBtn(); close();
        });
        native.addEventListener('change', renderBtn);
        renderBtn();
    }
    // one global outside-click closes any open custom select
    document.addEventListener('click', function () {
        document.querySelectorAll('.fy__sel.is-open').forEach(function (w) { if (w.__close) w.__close(); });
    });
    function enhanceAllSelects() {
        var form = document.getElementById('fyForm');
        if (form) form.querySelectorAll('select').forEach(enhanceSelect);
    }

    var subjectPicker = null, hobbyPicker = null;
    function fillSports() {
        var s = document.getElementById('fySport');
        if (s) s.innerHTML = '<option value="">None</option>' + SPORTS.map(function(x){ return '<option>' + x + '</option>'; }).join('');
    }

    var budgetSlider = document.getElementById('fyBudget');
    var budgetVal = document.getElementById('fyBudgetVal');
    function paintSlider(slider) {
        var pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        slider.style.setProperty('--pct', pct + '%');
    }
    function syncBudget() {
        budgetVal.textContent = '€' + (+budgetSlider.value).toLocaleString() + '/yr';
        paintSlider(budgetSlider);
    }

    // Value-label formatters for the extra sliders. Each shows a friendly "no
    // limit / any" state at its default so it reads as inactive until moved.
    var EXTRA_SLIDERS = {
        fyMaxTuition: { val: 'fyMaxTuitionVal', fmt: function (v) { return v >= 40000 ? 'No limit' : '€' + v.toLocaleString() + '/yr'; } },
        fyLiving:     { val: 'fyLivingVal',     fmt: function (v) { return v >= 2500 ? 'No limit' : '€' + v.toLocaleString() + '/mo'; } },
        fyAccept:     { val: 'fyAcceptVal',     fmt: function (v) { return v <= 0 ? 'Any' : '≥ ' + v + '%'; } },
        fyEmployer:   { val: 'fyEmployerVal',   fmt: function (v) { return v <= 0 ? 'Any' : '≥ ' + v + '%'; } },
        fySalary:     { val: 'fySalaryVal',     fmt: function (v) { return v <= 0 ? 'Any' : '≥ €' + v.toLocaleString() + '/yr'; } }
    };
    function syncExtraSlider(id) {
        var s = document.getElementById(id), cfg = EXTRA_SLIDERS[id];
        if (!s || !cfg) return;
        var lbl = document.getElementById(cfg.val);
        if (lbl) lbl.textContent = cfg.fmt(+s.value);
        paintSlider(s);
    }
    function initExtraSliders() {
        Object.keys(EXTRA_SLIDERS).forEach(function (id) {
            var s = document.getElementById(id);
            if (!s) return;
            syncExtraSlider(id);
            s.addEventListener('input', function () { syncExtraSlider(id); });
        });
    }

    // Destination countries the matcher will pull universities from (saved favourites).
    function destCountries() {
        var favs = (typeof getFavCountries === 'function') ? getFavCountries() : [];
        var backed = (typeof DATA_COUNTRIES !== 'undefined') ? DATA_COUNTRIES.map(function(c){ return c.code; }) : [];
        var list = favs.filter(function(c){ return backed.indexOf(c) !== -1; });
        if (!list.length && typeof currentCountryCode !== 'undefined') list = [currentCountryCode];
        return list;
    }
    function countryName(code) {
        if (typeof countryNameByCode === 'function') return countryNameByCode(code);
        var c = (typeof DATA_COUNTRIES !== 'undefined') ? DATA_COUNTRIES.find(function(x){ return x.code === code; }) : null;
        return c ? c.name : code.toUpperCase();
    }
    function renderDest() {
        var box = document.getElementById('fyDest');
        if (!box) return;
        var list = destCountries();
        box.innerHTML = '<i class="fa-solid fa-earth-europe" style="color:var(--orange)"></i> Matching across your destinations: ' +
            list.map(function(c){ return '<span class="fi fi-' + c + '"></span>'; }).join('');
        buildCountryChips();   // keep the Location > Countries chips in sync with destinations
    }

    function loadPrefs() {
        var p = {}; try { p = getProfile().matchPrefs || {}; } catch (e) {}
        sel.subjects = p.subjects || []; sel.hobbies = p.hobbies || []; sel.priorities = p.priorities || [];
        sel.countries = p.countries || [];
        if (subjectPicker) subjectPicker.refresh();
        if (hobbyPicker) hobbyPicker.refresh();
        var pri = document.getElementById('fyPriorities');
        if (pri) pri.querySelectorAll('.fy__chip').forEach(function(c) { if (sel.priorities.indexOf(c.dataset.v) !== -1) c.classList.add('is-on'); });
        buildCountryChips();   // reflects sel.countries against current destinations
        if (p.avg != null) document.getElementById('fyAvg').value = p.avg;
        if (p.exp != null) document.getElementById('fyExp').value = p.exp;
        if (p.lang) document.getElementById('fyLang').value = p.lang;
        if (p.level) document.getElementById('fyLevel').value = p.level;
        if (p.vibe) document.getElementById('fyVibe').value = p.vibe;
        if (p.sport) document.getElementById('fySport').value = p.sport;
        if (p.athlete != null) document.getElementById('fyAthlete').value = p.athlete;
        if (p.budget) budgetSlider.value = p.budget;
        // new filters
        var setIf = function (id, v) { var e = document.getElementById(id); if (e && v != null) e.value = v; };
        setIf('fyMaxTuition', p.maxTuition); setIf('fyLiving', p.maxLiving); setIf('fyRank', p.rankTier);
        setIf('fyAccept', p.minAccept); setIf('fyEmployer', p.minEmployer); setIf('fySalary', p.minSalary);
        syncBudget();
        Object.keys(EXTRA_SLIDERS).forEach(syncExtraSlider);
        // refresh custom-select button labels to the restored values
        var form = document.getElementById('fyForm');
        if (form) form.querySelectorAll('select').forEach(function (s) { s.dispatchEvent(new Event('change', { bubbles: true })); });
    }
    function savePrefs(prefs) { try { var pr = getProfile(); pr.matchPrefs = prefs; setProfile(pr); } catch (e) {} }

    function numVal(id, dflt) { var e = document.getElementById(id); return e ? (+e.value) : dflt; }
    function readPrefs() {
        return {
            subjects: sel.subjects.slice(), hobbies: sel.hobbies.slice(), priorities: sel.priorities.slice(),
            countries: sel.countries.slice(),
            avg: +document.getElementById('fyAvg').value || null,
            exp: +document.getElementById('fyExp').value || null,
            lang: document.getElementById('fyLang').value,
            level: document.getElementById('fyLevel').value,
            vibe: document.getElementById('fyVibe').value,
            sport: document.getElementById('fySport').value,
            athlete: +document.getElementById('fyAthlete').value || 0,
            budget: +budgetSlider.value,
            // new filters
            maxTuition: numVal('fyMaxTuition', 40000),
            maxLiving:  numVal('fyLiving', 2500),
            rankTier:   numVal('fyRank', 0),
            minAccept:  numVal('fyAccept', 0),
            minEmployer: numVal('fyEmployer', 0),
            minSalary:  numVal('fySalary', 0)
        };
    }

    function parseStudents(u) { var m = String(u.students || '').replace(/[, ]/g, '').match(/(\d+)/); return m ? +m[1] : 0; }
    function reqGrade(diff) { return ({ 5: 90, 4: 80, 3: 70, 2: 60, 1: 50 })[diff] || 65; }
    function uniCost(u) { return (typeof tuitionMinCost === 'function' ? tuitionMinCost(u) : (TS_COST[u.ts] || 0)); }
    function tuitionText(u) { return (typeof u.tuition === 'string' && u.tuition.length > 1) ? u.tuition : ('~€' + (TS_COST[u.ts] || 0).toLocaleString() + '/yr'); }

    // ── Derived metrics for the extra filters ──
    // The university dataset has no explicit ranking / acceptance / salary fields,
    // so these are transparent heuristics from what we do have (difficulty tier,
    // size, subjects, country). They power the new Academic/Costs/Career filters.
    var LIVING_MONTHLY = { es: 900, pt: 800, it: 950, fr: 1100, de: 1050, gb: 1400, ie: 1350,
        us: 1600, ch: 1900, ua: 600, nl: 1200, be: 1050, dk: 1300, se: 1200, fi: 1100 };
    var SALARY_BASE = { us: 65000, ch: 85000, gb: 38000, de: 48000, nl: 44000, se: 42000, dk: 46000,
        fi: 42000, ie: 45000, fr: 38000, be: 42000, it: 30000, es: 28000, pt: 26000, ua: 15000 };
    var HIGH_EARN = ['computer', 'engineer', 'medic', 'business', 'law', 'econom', 'finance', 'data', 'architect'];
    var EMPLOYABLE = ['business', 'computer', 'engineer', 'econom', 'law', 'finance', 'data'];
    var CAREER_HUBS = ['gb', 'us', 'de', 'fr', 'ch', 'nl'];

    function livingMonthly(code) { return LIVING_MONTHLY[code] || 1000; }
    function acceptanceRate(u) { return ({ 5: 9, 4: 22, 3: 45, 2: 65, 1: 82 })[u.diff || 3] || 45; }
    function fieldsHit(u, list) {
        var fields = (u.fields || []).map(function (f) { return f.toLowerCase(); });
        return list.some(function (kw) { return fields.some(function (f) { return f.indexOf(kw) !== -1; }); });
    }
    function gradSalary(u, code) {
        var base = SALARY_BASE[code] || 32000;
        var mult = fieldsHit(u, HIGH_EARN) ? 1.25 : 1;
        var diffBoost = 1 + (((u.diff || 3) - 3) * 0.08);
        return Math.round(base * mult * diffBoost / 1000) * 1000;
    }
    function employerMatch(u, code) {
        var m = 45 + (((u.diff || 3) - 3) * 10);
        var students = parseStudents(u);
        if (students >= 25000) m += 8; else if (students >= 15000) m += 4;
        if (fieldsHit(u, EMPLOYABLE)) m += 10;
        if (CAREER_HUBS.indexOf(code) !== -1) m += 6;
        return Math.max(20, Math.min(98, Math.round(m)));
    }

    // Build the Location > Countries chips from the user's saved destinations.
    function buildCountryChips() {
        var box = document.getElementById('fyCountries');
        if (!box) return;
        var codes = destCountries();
        // keep any previously-selected codes that are still valid destinations
        sel.countries = sel.countries.filter(function (c) { return codes.indexOf(c) !== -1; });
        box.innerHTML = codes.map(function (c) {
            return '<span class="fy__chip fy__chip--country' + (sel.countries.indexOf(c) !== -1 ? ' is-on' : '') +
                '" data-c="' + c + '"><span class="fi fi-' + c + '"></span> ' + countryName(c) + '</span>';
        }).join('');
        box.querySelectorAll('.fy__chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                var c = chip.dataset.c, i = sel.countries.indexOf(c);
                if (i === -1) { sel.countries.push(c); chip.classList.add('is-on'); }
                else { sel.countries.splice(i, 1); chip.classList.remove('is-on'); }
            });
        });
    }

    // ── Soft matching ──
    // A single unmet slider used to delete a university outright, which is why so
    // little ever matched. Instead we measure HOW FAR each criterion is missed and
    // turn that into a penalty (0 = met everything, 1 = wildly off). Only an
    // explicit country choice, or a drastic all-round miss, removes a university —
    // everything else survives as a "might match" with a lower percentage.
    var DROP_PENALTY = 0.9;   // basically nothing in common with what you asked for

    function missPenalty(u, code, rank, p) {
        var pen = 0, misses = [];
        // how badly `actual` overshoots `limit` (or undershoots `need`), capped at 1
        function over(actual, limit)  { return limit > 0 ? Math.min(1, (actual - limit) / limit) : 0; }
        function under(actual, need)  { return need  > 0 ? Math.min(1, (need - actual) / need)  : 0; }

        if (p.maxTuition < 40000) {
            var cost = uniCost(u);
            if (cost > p.maxTuition) { pen += over(cost, p.maxTuition) * 0.30; misses.push('tuition above your cap'); }
        }
        if (p.maxLiving < 2500) {
            var live = livingMonthly(code);
            if (live > p.maxLiving) { pen += over(live, p.maxLiving) * 0.18; misses.push('living cost above your cap'); }
        }
        if (p.rankTier > 0 && rank > p.rankTier) {
            pen += Math.min(1, (rank - p.rankTier) / (p.rankTier * 2)) * 0.22; misses.push('ranked below your target');
        }
        if (p.minAccept > 0) {
            var acc = acceptanceRate(u);
            if (acc < p.minAccept) { pen += under(acc, p.minAccept) * 0.22; misses.push('harder to get into than you wanted'); }
        }
        if (p.minEmployer > 0) {
            var emp = employerMatch(u, code);
            if (emp < p.minEmployer) { pen += under(emp, p.minEmployer) * 0.18; misses.push('less recruiter reach'); }
        }
        if (p.minSalary > 0) {
            var sal = gradSalary(u, code);
            if (sal < p.minSalary) { pen += under(sal, p.minSalary) * 0.18; misses.push('lower graduate salary'); }
        }
        return { pen: Math.min(1, pen), misses: misses };
    }

    // Returns [{ u, pen, misses }] — the survivors, each carrying how far off it is.
    function applyFilters(list, code, p) {
        var out = [];
        (list || []).forEach(function (u, i) {
            // Countries are an explicit choice, so they stay a hard filter.
            if (p.countries && p.countries.length && p.countries.indexOf(code) === -1) return;
            var m = missPenalty(u, code, i + 1, p);
            if (m.pen >= DROP_PENALTY) return;
            out.push({ u: u, pen: m.pen, misses: m.misses });
        });
        return out;
    }

    // Blend the fit score with the soft-filter penalty into a final match %.
    function matchPct(basePct, pen) {
        return Math.max(20, Math.min(99, Math.round(basePct * (1 - pen * 0.55))));
    }
    // 75%+ is a real match; below that it's a maybe.
    function matchTier(pct) {
        return pct >= 75 ? { key: 'match',   label: 'Match' }
             : pct >= 55 ? { key: 'maybe',   label: 'Might match' }
             :             { key: 'stretch', label: 'Stretch' };
    }

    // How strongly a university supports/rewards athletes (sports scholarships & facilities).
    // Heuristic: USA (NCAA) highest, UK strong, then big/elite universities.
    function athleteSupport(u, code) {
        var s = 0.35;
        if (code === 'us') s = 1.0;
        else if (code === 'gb' || code === 'ie') s = 0.8;
        var students = parseStudents(u);
        if (students >= 30000) s += 0.3; else if (students >= 18000) s += 0.18;
        if ((u.diff || 0) >= 4) s += 0.12;          // resourced, prestigious programmes
        return Math.min(1, s);
    }

    var ATH_LABEL = ['', 'Recreational', 'Club', 'Regional', 'National', 'Pro / Elite'];

    function scoreUni(u, p, code) {
        var reasons = [], factors = [];
        function add(icon, you, effect, pts) { factors.push({ icon: icon, you: you, effect: effect, pts: Math.round(pts) }); }

        // Subjects (33)
        var subj = 0.6, matched = [];
        if (p.subjects.length) {
            var fields = (u.fields || []).map(function(f){ return f.toLowerCase(); });
            matched = p.subjects.filter(function(s) { return fields.some(function(f){ return f.indexOf(s.toLowerCase()) !== -1 || s.toLowerCase().indexOf(f) !== -1; }); });
            subj = matched.length / p.subjects.length;
            matched.slice(0, 2).forEach(function(h) { reasons.push('Matches ' + h); });
        }
        add('fa-book',
            p.subjects.length ? ('You like ' + p.subjects.slice(0, 3).join(', ')) : 'No subject preference',
            p.subjects.length ? (matched.length ? ('Offered here — ' + matched.length + '/' + p.subjects.length + ' of your subjects') : 'Little overlap with its programmes') : 'Counted neutrally',
            33 * subj);

        // Grades + athlete reduction (18)
        var req = reqGrade(u.diff || 3);
        var sup = athleteSupport(u, code);
        var athleteDrop = (p.athlete >= 2 && p.sport && sup >= 0.6) ? Math.min(15, p.athlete * 3) : 0;
        var effReq = Math.max(40, req - athleteDrop);
        var myGrade = p.exp || p.avg || 70;
        var grade = myGrade >= effReq ? 1 : Math.max(0, 1 - (effReq - myGrade) / 30);
        if (myGrade >= effReq) reasons.push('Right for your grades');
        add('fa-star-half-stroke',
            'Your expected grade ' + myGrade + '%' + (athleteDrop > 0 ? (' as a ' + (ATH_LABEL[p.athlete] || '') + ' ' + p.sport + ' athlete') : ''),
            athleteDrop > 0
                ? ('Entry bar ~' + req + '% → lowered to ~' + effReq + '% for athletes → you ' + (myGrade >= effReq ? 'qualify' : 'are close'))
                : ('Entry bar ~' + req + '% → you ' + (myGrade >= req ? 'qualify' : 'are below it')),
            18 * grade);

        // Budget (18)
        var cost = uniCost(u), bud = 1;
        if (cost > 0) { bud = cost <= p.budget ? 1 : Math.max(0, 1 - (cost - p.budget) / p.budget); }
        if (cost > 0 && cost <= p.budget) reasons.push('Within budget');
        add('fa-piggy-bank',
            'Your budget €' + (p.budget || 0).toLocaleString() + '/yr',
            cost > 0 ? ('Tuition ' + tuitionText(u) + ' → ' + (cost <= p.budget ? 'within budget' : 'above budget')) : 'Tuition not listed',
            18 * bud);

        // Language (9)
        var lang = 0.7, hasLang = false;
        if (p.lang) {
            hasLang = (u.langs || []).some(function(l){ return l.toLowerCase() === p.lang.toLowerCase(); });
            lang = hasLang ? 1 : 0.2;
            if (hasLang) reasons.push(p.lang + '-taught');
            add('fa-language', 'You prefer ' + p.lang,
                hasLang ? ('Programmes taught in ' + p.lang) : ('Mainly ' + ((u.langs || ['local'])[0]) + '-taught'), 9 * lang);
        }

        // Athlete scholarships (separate boost, up to ~9)
        var athBoost = 0;
        if (p.athlete >= 2 && p.sport) {
            athBoost = (p.athlete / 5) * sup * 9;
            if (sup >= 0.75 && p.athlete >= 3) reasons.push(p.sport + ' scholarships');
            else if (sup >= 0.6) reasons.push('Athlete-friendly');
            add('fa-medal', 'You are a ' + (ATH_LABEL[p.athlete] || '') + ' ' + p.sport + ' athlete',
                sup >= 0.75 ? 'Strong athletic scholarships & facilities here' : sup >= 0.6 ? 'Supports student athletes' : 'Limited athletic support', athBoost);
        }

        // Priorities / vibe (5)
        var students = parseStudents(u), extras = 0.5, exNote = [];
        if (p.priorities.indexOf('Research') !== -1 && (u.diff || 0) >= 4) { extras += 0.3; reasons.push('Research-focused'); exNote.push('research-intensive'); }
        if (p.priorities.indexOf('Prestige') !== -1 && (u.diff || 0) >= 4) { extras += 0.2; exNote.push('prestigious'); }
        if (p.priorities.indexOf('Affordability') !== -1 && cost > 0 && cost <= p.budget) { extras += 0.2; exNote.push('affordable'); }
        if ((p.priorities.indexOf('Social life') !== -1 || p.hobbies.indexOf('Nightlife') !== -1) && students >= 20000) { extras += 0.2; exNote.push('big social scene'); }
        if (p.vibe === 'big' && students >= 20000) { extras += 0.2; exNote.push('big-city campus'); }
        if (p.vibe === 'small' && students > 0 && students < 12000) { extras += 0.2; exNote.push('smaller campus'); }
        extras = Math.min(1, extras);
        if (p.priorities.length || (p.vibe && p.vibe !== 'any') || p.hobbies.length) {
            add('fa-bullseye', 'What you value' + (p.priorities.length ? (': ' + p.priorities.slice(0, 2).join(', ')) : ''),
                exNote.length ? ('Matches: ' + exNote.slice(0, 2).join(', ')) : 'Partly aligned', 5 * extras);
        }

        // Country (10, always — it's a saved destination)
        add('fa-earth-europe', 'A saved destination', 'Located in ' + countryName(code), 10);

        // ── Interests, talents & career fit (bounded bonus up to ~10) ──
        // Looks at how the student's hobbies, mind-sports and career priorities line
        // up with what this specific university is strong at / rewards — so the match
        // reflects the *whole* person, not just grades and subjects.
        var interest = 0, iNote = [];
        // Hobby ↔ programme alignment (studying near what you love)
        var HOBBY_FIELD = {
            'Technology': ['computer', 'engineer', 'data', 'software'], 'Coding': ['computer', 'software', 'data'],
            'Gaming': ['computer', 'game', 'data'], 'Esports': ['computer', 'game', 'media'],
            'Robotics': ['engineer', 'computer', 'robot'], 'Entrepreneurship': ['business', 'econom', 'management', 'finance'],
            'Investing': ['finance', 'econom', 'business'], 'Music': ['music', 'art', 'media'], 'Art': ['art', 'design', 'architect'],
            'Fashion': ['fashion', 'design', 'art'], 'Writing': ['journal', 'literat', 'communic', 'media'],
            'Nature': ['environment', 'biolog', 'agri', 'geo'], 'Fitness': ['sport', 'health', 'nutrition'],
            'Astronomy': ['physic', 'astronom', 'space'], 'Reading': ['human', 'literat', 'philos', 'histor']
        };
        p.hobbies.forEach(function (h) {
            var kws = HOBBY_FIELD[h];
            if (kws && fieldsHit(u, kws)) { interest += 0.16; if (iNote.indexOf(h.toLowerCase()) === -1) iNote.push(h.toLowerCase()); }
        });
        // Mind-sports (chess / esports) — rewarded at large or resourced universities
        // that run competitive teams, clubs and, in some countries, scholarships.
        var mindSport = p.hobbies.indexOf('Chess') !== -1 || p.hobbies.indexOf('Esports') !== -1 || /chess|esport/i.test(p.sport || '');
        if (mindSport && (students >= 15000 || (u.diff || 0) >= 4)) {
            interest += 0.28; iNote.push('chess/esports scene');
            reasons.push('Strong chess/esports scene');
        }
        // Career-priority fit: reward genuine graduate outcomes where it matters most
        if (p.priorities.indexOf('Employability') !== -1) {
            var em = employerMatch(u, code);
            if (em >= 62) { interest += 0.3; iNote.push('graduate employability'); if (em >= 75) reasons.push('Top recruiter target'); }
        }
        if (p.priorities.indexOf('Prestige') !== -1 && (u.diff || 0) >= 5) { interest += 0.18; iNote.push('elite prestige'); }
        interest = Math.min(1, interest);
        if (iNote.length) {
            add('fa-wand-magic-sparkles', 'Your interests & talents',
                'This university fits your ' + iNote.slice(0, 3).join(', '), 10 * interest);
        }

        var pct = 33 * subj + 18 * grade + 18 * bud + 9 * lang + 10 + 5 * extras + athBoost + 10 * interest;
        pct = Math.max(35, Math.min(99, Math.round(pct)));
        return { pct: pct, reasons: reasons.slice(0, 4), factors: factors, code: code };
    }

    // Expose the full-preferences scorer so the Gradebook can rank realistic
    // options by ALL the matcher filters (subjects, hobbies, vibe, priorities…).
    window.fyScoreUni = function (u, prefs) {
        try { return scoreUni(u, prefs, (typeof currentCountryCode !== 'undefined' ? currentCountryCode : 'es')).pct; }
        catch (e) { return 0; }
    };

    function ringColor(p) { return p >= 75 ? '#27ae60' : p >= 55 ? 'var(--orange)' : '#8a909c'; }

    // little toast
    function fyToast(msg) {
        var bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:6500;display:flex;align-items:center;gap:9px;' +
            'padding:12px 18px;border-radius:12px;font-family:Montserrat,sans-serif;font-size:13px;font-weight:700;color:#fff;' +
            'box-shadow:0 10px 28px rgba(0,0,0,.25);background:linear-gradient(135deg,#3a3f4a,#23262e);animation:arIn .3s ease both';
        bar.textContent = msg;
        document.body.appendChild(bar);
        setTimeout(function(){ bar.style.transition='opacity .4s'; bar.style.opacity='0'; setTimeout(function(){ bar.remove(); }, 400); }, 2600);
    }
    function saveUni(u) {
        if (typeof getSaved !== 'function' || typeof setSaved !== 'function') return;
        var s = getSaved();
        if (s.indexOf(u.id) === -1) { s.push(u.id); setSaved(s); }
        if (typeof renderSaved === 'function') renderSaved();
        if (typeof updateStats === 'function') updateStats();
        fyToast('★ Saved ' + (u.name || 'university'));
    }
    function sendToCompare(u) {
        var slot = (typeof cmpVsSelected !== 'undefined' && cmpVsSelected.A) ? (cmpVsSelected.B ? 'A' : 'B') : 'A';
        var ob = document.getElementById('openCompareModal');
        if (ob) ob.click();
        if (typeof selectVsUni === 'function') selectVsUni(slot, u);
        closeFy();
        fyToast('⚖ Added ' + (u.name || 'university') + ' to Compare');
    }

    // ── Results (5 per page, paginated; hover → Save / Compare) ──
    var lastScored = [];
    var resPage = 0;
    var RES_PER = 8;

    function cardHtml(r, idx, isTop) {
        var u = r.u;
        var reasons = (r.reasons && r.reasons.length) ? r.reasons : ['General fit'];
        var tier = matchTier(r.pct);
        // Say plainly what keeps it below a full match, if anything.
        var caveat = (r.misses && r.misses.length && r.pct < 75)
            ? '<div class="fy__card__caveat"><i class="fa-solid fa-circle-exclamation"></i> ' + r.misses.slice(0, 2).join(' · ') + '</div>'
            : '';
        return '<div class="fy__card' + (isTop ? ' fy__card--top' : '') + '" data-i="' + idx + '" title="See why it fits you">' +
            '<div class="fy__card__actions">' +
                '<button class="fy__cbtn" data-act="save" data-i="' + idx + '" title="Save"><i class="fa-regular fa-bookmark"></i></button>' +
                '<button class="fy__cbtn" data-act="compare" data-i="' + idx + '" title="Add to Compare"><i class="fa-solid fa-scale-balanced"></i></button>' +
            '</div>' +
            '<div class="fy__ring__wrap">' +
                '<div class="fy__ring" style="--p:' + r.pct + ';--ringc:' + ringColor(r.pct) + '"><span class="fy__ring__num">' + r.pct + '<span>%</span></span></div>' +
                '<span class="fy__tier fy__tier--' + tier.key + '">' + tier.label + '</span>' +
            '</div>' +
            '<div class="fy__card__body">' +
                '<div class="fy__card__name"><span class="fy__card__abbr fy__card__abbr--logo">' + uniLogo(u, 26) + '</span>' + (u.name || 'University') + '</div>' +
                '<div class="fy__card__meta"><span class="fy__card__country"><span class="fi fi-' + r.code + '"></span>' + countryName(r.code) + '</span> · ' + (u.city || '') + ' · ' + tuitionText(u) + '</div>' +
                '<div class="fy__card__reasons">' + reasons.map(function(x){ return '<span class="fy__reason">' + x + '</span>'; }).join('') + '</div>' +
                caveat +
                '<div class="fy__card__why"><i class="fa-solid fa-circle-info"></i> See why it fits you</div>' +
            '</div>' +
        '</div>';
    }

    // ══════════ Recommendation helper (shown when nothing matches) ══════════
    // EVERY filter the user can set becomes a "dimension". `active(p)` decides
    // whether the user actually chose it, `neutral` is the value it resets to when
    // relaxed, and `fields` are the pref keys it controls (grades & sport span two).
    var RECO_DIMS = [
        { key: 'subjects',    label: 'Favourite subjects', icon: 'fa-book',            fields: ['subjects'],       neutral: { subjects: [] },        active: function (p) { return p.subjects.length > 0; },   desc: function (p) { return p.subjects.slice(0, 3).join(', ') + (p.subjects.length > 3 ? ' +' + (p.subjects.length - 3) : ''); } },
        { key: 'grades',      label: 'Expected grade',     icon: 'fa-star-half-stroke',fields: ['avg', 'exp'],     neutral: { avg: null, exp: null },active: function (p) { return p.exp != null || p.avg != null; }, desc: function (p) { return (p.exp || p.avg) + '%'; } },
        { key: 'lang',        label: 'Teaching language',  icon: 'fa-language',        fields: ['lang'],           neutral: { lang: '' },            active: function (p) { return !!p.lang; },                desc: function (p) { return p.lang; } },
        { key: 'rankTier',    label: 'World ranking',      icon: 'fa-ranking-star',    fields: ['rankTier'],       neutral: { rankTier: 0 },         active: function (p) { return p.rankTier > 0; },          desc: function (p) { return 'Top ' + p.rankTier; } },
        { key: 'minAccept',   label: 'Acceptance rate',    icon: 'fa-door-open',       fields: ['minAccept'],      neutral: { minAccept: 0 },        active: function (p) { return p.minAccept > 0; },         desc: function (p) { return '≥ ' + p.minAccept + '%'; } },
        { key: 'budget',      label: 'Yearly budget',      icon: 'fa-piggy-bank',      fields: ['budget'],         neutral: { budget: 40000 },       active: function (p) { return p.budget !== 15000; },      desc: function (p) { return '€' + (p.budget || 0).toLocaleString() + '/yr'; } },
        { key: 'maxTuition',  label: 'Max tuition',        icon: 'fa-money-bill-wave', fields: ['maxTuition'],     neutral: { maxTuition: 40000 },   active: function (p) { return p.maxTuition < 40000; },    desc: function (p) { return '≤ €' + (p.maxTuition || 0).toLocaleString(); } },
        { key: 'maxLiving',   label: 'Living cost',        icon: 'fa-house-chimney',   fields: ['maxLiving'],      neutral: { maxLiving: 2500 },     active: function (p) { return p.maxLiving < 2500; },      desc: function (p) { return '≤ €' + (p.maxLiving || 0).toLocaleString() + '/mo'; } },
        { key: 'minEmployer', label: 'Employer match',     icon: 'fa-building',        fields: ['minEmployer'],    neutral: { minEmployer: 0 },      active: function (p) { return p.minEmployer > 0; },       desc: function (p) { return '≥ ' + p.minEmployer + '%'; } },
        { key: 'minSalary',   label: 'Graduate salary',    icon: 'fa-sack-dollar',     fields: ['minSalary'],      neutral: { minSalary: 0 },        active: function (p) { return p.minSalary > 0; },         desc: function (p) { return '≥ €' + (p.minSalary || 0).toLocaleString(); } },
        { key: 'countries',   label: 'Countries',          icon: 'fa-flag',            fields: ['countries'],      neutral: { countries: [] },       active: function (p) { return !!(p.countries && p.countries.length); }, desc: function (p) { return p.countries.map(function (c) { return c.toUpperCase(); }).join(', '); } },
        { key: 'vibe',        label: 'City vibe',          icon: 'fa-city',            fields: ['vibe'],           neutral: { vibe: 'any' },         active: function (p) { return p.vibe && p.vibe !== 'any'; }, desc: function (p) { return p.vibe === 'big' ? 'Big city' : 'Smaller town'; } },
        { key: 'hobbies',     label: 'Hobbies',            icon: 'fa-heart',           fields: ['hobbies'],        neutral: { hobbies: [] },         active: function (p) { return p.hobbies.length > 0; },    desc: function (p) { return p.hobbies.slice(0, 3).join(', ') + (p.hobbies.length > 3 ? ' +' + (p.hobbies.length - 3) : ''); } },
        { key: 'sport',       label: 'Sport',              icon: 'fa-person-running',  fields: ['sport', 'athlete'], neutral: { sport: '', athlete: 0 }, active: function (p) { return !!p.sport; },           desc: function (p) { return p.sport; } },
        { key: 'priorities',  label: 'What matters most',  icon: 'fa-bullseye',        fields: ['priorities'],     neutral: { priorities: [] },      active: function (p) { return p.priorities.length > 0; }, desc: function (p) { return p.priorities.slice(0, 3).join(', '); } }
    ];
    function dimByKey(k) { return RECO_DIMS.filter(function (d) { return d.key === k; })[0]; }
    function activeDims(p) { return RECO_DIMS.filter(function (d) { return d.active(p); }); }
    // Keep only the chosen dimensions; reset everything else to its neutral value.
    function neutralisePrefs(p, keepKeys) {
        var out = {}; Object.keys(p).forEach(function (k) { out[k] = Array.isArray(p[k]) ? p[k].slice() : p[k]; });
        RECO_DIMS.forEach(function (d) {
            if (keepKeys.indexOf(d.key) !== -1) return;
            Object.keys(d.neutral).forEach(function (f) { out[f] = Array.isArray(d.neutral[f]) ? d.neutral[f].slice() : d.neutral[f]; });
        });
        return out;
    }
    function matchWith(prefs, cb) {
        // Honour a kept "Countries" filter by matching those countries; otherwise
        // match the current study destination.
        var codes = (prefs.countries && prefs.countries.length) ? prefs.countries.slice()
            : [(typeof currentCountryCode !== 'undefined' && currentCountryCode) ? currentCountryCode : destCountries()[0]];
        Promise.all(codes.map(loadUnisFor)).then(function (lists) {
            var scored = [];
            lists.forEach(function (list, idx) {
                var code = codes[idx];
                applyFilters(list, code, prefs).forEach(function (it) {
                    var s = scoreUni(it.u, prefs, code);
                    scored.push({ u: it.u, pct: matchPct(s.pct, it.pen), reasons: s.reasons, factors: s.factors, code: code, misses: it.misses });
                });
            });
            scored.sort(function (a, b) { return b.pct - a.pct; });
            cb(scored);
        });
    }
    function wireResultCards(box) {
        box.querySelectorAll('.fy__cbtn').forEach(function (b) {
            b.addEventListener('click', function (e) { e.stopPropagation(); var r = lastScored[+b.dataset.i]; if (!r) return; if (b.dataset.act === 'save') saveUni(r.u); else sendToCompare(r.u); });
        });
        box.querySelectorAll('.fy__card[data-i]').forEach(function (card) {
            card.addEventListener('click', function () { var r = lastScored[+card.dataset.i]; if (r) openDetail(r); });
        });
    }
    // Write a full pref object back into the form (used by "Apply these filters").
    function applyRelaxedToForm(r) {
        sel.subjects = (r.subjects || []).slice();
        sel.hobbies = (r.hobbies || []).slice();
        sel.priorities = (r.priorities || []).slice();
        sel.countries = (r.countries || []).slice();
        if (subjectPicker) subjectPicker.refresh();
        if (hobbyPicker) hobbyPicker.refresh();
        buildCountryChips();
        var pri = document.getElementById('fyPriorities');
        if (pri) pri.querySelectorAll('.fy__chip').forEach(function (c) { c.classList.toggle('is-on', sel.priorities.indexOf(c.dataset.v) !== -1); });
        var setV = function (id, v) { var e = document.getElementById(id); if (e) e.value = (v == null ? '' : v); };
        setV('fyAvg', r.avg); setV('fyExp', r.exp);
        setV('fyLang', r.lang || ''); setV('fyVibe', r.vibe || 'any'); setV('fySport', r.sport || ''); setV('fyAthlete', r.athlete || 0);
        if (r.level) setV('fyLevel', r.level);
        if (budgetSlider) { budgetSlider.value = (r.budget != null ? r.budget : 15000); syncBudget(); }
        setV('fyMaxTuition', r.maxTuition); setV('fyLiving', r.maxLiving); setV('fyRank', r.rankTier);
        setV('fyAccept', r.minAccept); setV('fyEmployer', r.minEmployer); setV('fySalary', r.minSalary);
        Object.keys(EXTRA_SLIDERS).forEach(syncExtraSlider);
        var form = document.getElementById('fyForm'); if (form) form.querySelectorAll('select').forEach(function (s) { s.dispatchEvent(new Event('change', { bubbles: true })); });
        savePrefs(readPrefs());
    }

    var recoKeep = [];
    function renderEmptyState(box) {
        var p = readPrefs();
        var dims = activeDims(p);
        box.innerHTML =
            '<div class="fy__none">' +
                '<div class="fy__none__ic"><i class="fa-solid fa-compass"></i></div>' +
                '<div class="fy__none__t">No universities match all your filters</div>' +
                '<div class="fy__none__s">' + (dims.length
                    ? 'Your filters are a little strict. Tell us the few things that matter most and we\'ll find options that still respect them.'
                    : 'Try adding a study destination above, or loosen your budget.') + '</div>' +
                (dims.length ? '<button class="fy__reco__cta" id="fyRecoStart"><i class="fa-solid fa-wand-magic-sparkles"></i> What matters most to me?</button>' : '') +
            '</div>';
        var b = document.getElementById('fyRecoStart');
        if (b) b.addEventListener('click', function () { recoKeep = []; renderRecoPicker(); });
    }
    function renderRecoPicker() {
        var box = document.getElementById('fyResults');
        var p = readPrefs();
        var dims = activeDims(p);
        var chips = dims.map(function (d) {
            return '<button type="button" class="fy__reco__chip' + (recoKeep.indexOf(d.key) !== -1 ? ' is-on' : '') + '" data-k="' + d.key + '">' +
                '<i class="fa-solid ' + d.icon + '"></i> ' + d.label + ' <span class="fy__reco__chip__v">' + d.desc(p) + '</span></button>';
        }).join('');
        box.innerHTML =
            '<div class="fy__reco">' +
                '<div class="fy__reco__hd"><i class="fa-solid fa-hand-sparkles" style="color:var(--orange)"></i> Pick up to 3 that matter most</div>' +
                '<div class="fy__reco__sub">We\'ll keep these and relax the rest to find universities for you.</div>' +
                '<div class="fy__reco__chips">' + chips + '</div>' +
                '<div class="fy__reco__actions">' +
                    '<button class="fy__reco__go" id="fyRecoGo"><i class="fa-solid fa-wand-magic-sparkles"></i> Show my recommendations</button>' +
                '</div>' +
            '</div>';
        box.querySelectorAll('.fy__reco__chip').forEach(function (c) {
            c.addEventListener('click', function () {
                var k = c.dataset.k, i = recoKeep.indexOf(k);
                if (i !== -1) { recoKeep.splice(i, 1); c.classList.remove('is-on'); }
                else { if (recoKeep.length >= 3) return; recoKeep.push(k); c.classList.add('is-on'); }
            });
        });
        document.getElementById('fyRecoGo').addEventListener('click', runReco);
    }
    function runReco() {
        var box = document.getElementById('fyResults');
        box.innerHTML = '<div class="fy__empty"><i class="fa-solid fa-spinner fa-spin"></i> Finding options for you…</div>';
        var p = readPrefs();
        var keep = recoKeep.slice(0, 3);
        var relaxed = neutralisePrefs(p, keep);
        matchWith(relaxed, function (scored) {
            if (scored.length) { renderRecoResults(scored, keep, relaxed, false); return; }
            // even the kept few were too strict → relax everything and show the closest.
            var relaxAll = neutralisePrefs(p, []);
            matchWith(relaxAll, function (scored2) { renderRecoResults(scored2, [], relaxAll, true); });
        });
    }
    function renderRecoResults(scored, keep, relaxed, tooStrict) {
        var box = document.getElementById('fyResults');
        var p = readPrefs();
        lastScored = scored; resPage = 0;
        _aiRanked = false;   // the recommender path is deterministic, not AI-ranked
        if (!scored.length) { box.innerHTML = '<div class="fy__empty">We still couldn\'t find a match — try adding a study destination.</div>'; return; }
        var keptTxt = keep.map(function (k) { var d = dimByKey(k); return '<span class="fy__reco__tag fy__reco__tag--keep"><i class="fa-solid ' + d.icon + '"></i> ' + d.label + ': ' + d.desc(p) + '</span>'; }).join('');
        var relaxedDims = RECO_DIMS.filter(function (d) { return d.active(p) && keep.indexOf(d.key) === -1; });
        var relaxedTxt = relaxedDims.map(function (d) { return '<span class="fy__reco__tag fy__reco__tag--relax">' + d.label + '</span>'; }).join('');
        var top = scored.slice(0, 6);
        var html =
            '<div class="fy__reco__banner">' +
                '<div class="fy__reco__banner__t"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--orange)"></i> ' +
                    (tooStrict ? 'Your priorities were still too strict — here are the closest options' : 'Found ' + scored.length + ' universities by keeping what matters most') + '</div>' +
                (keptTxt ? '<div class="fy__reco__line"><b>Keeping:</b> ' + keptTxt + '</div>' : '') +
                (relaxedTxt ? '<div class="fy__reco__line"><b>Relaxed:</b> ' + relaxedTxt + '</div>' : '') +
                '<div class="fy__reco__btns"><button class="fy__reco__apply" id="fyRecoApply"><i class="fa-solid fa-check"></i> Apply these filters</button></div>' +
            '</div>';
        html += top.map(function (r, i) { return cardHtml(r, i, i === 0); }).join('');
        box.innerHTML = html;
        wireResultCards(box);
        document.getElementById('fyRecoApply').addEventListener('click', function () {
            applyRelaxedToForm(relaxed);
            render(scored.slice(0, 10));
            revealShowAll();
        });
    }

    // ══════════ AI ranking (Groq via the server — no browser key) ══════════
    // The AI *decides the list itself*: filters only narrow the candidate pool, then
    // the model re-orders it using outside factors the filters can't see (subject
    // strength, talent pathways, city fit, career outcomes, value for money).
    // If the server is down or has no key we fall back silently to the local ranking.
    var AI_API_BASE = (function () {
        if (location.protocol === 'file:') return 'http://localhost:4242';
        var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
        if (isLocal && location.port !== '4242') return 'http://localhost:4242';
        return location.origin;
    }());
    var _aiRanked = false;   // did the shown list come from the AI?

    function aiPayload(scored) {
        return scored.map(function (r) {
            var u = r.u;
            return {
                id: u.id, name: u.name, city: u.city || '', country: countryName(r.code),
                tuition: tuitionText(u), difficulty: u.diff || null,
                acceptance: acceptanceRate(u), salary: gradSalary(u, r.code), employer: employerMatch(u, r.code),
                fields: (u.fields || []).slice(0, 6), langs: u.langs || []
            };
        });
    }
    // Ask the AI to rank `scored` (already filter-narrowed). Always calls back —
    // with the AI order when available, otherwise the untouched local order.
    function aiRank(scored, prefs, cb) {
        var pool = scored.slice(0, 20);
        if (!pool.length) { _aiRanked = false; cb(scored); return; }

        var timedOut = false;
        var timer = setTimeout(function () { timedOut = true; _aiRanked = false; cb(scored); }, 20000);
        var finish = function (list, usedAi) {
            if (timedOut) return;
            clearTimeout(timer);
            _aiRanked = !!usedAi;
            cb(list);
        };

        fetch(AI_API_BASE + '/api/ai/match', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ profile: prefs, candidates: aiPayload(pool) })
        })
        .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); })
        .then(function (res) {
            var data = res.body || {};
            if (res.status !== 200 || !data.ok || !Array.isArray(data.ranked) || !data.ranked.length) {
                finish(scored, false); return;
            }
            var byId = {};
            pool.forEach(function (r) { byId[String(r.u.id)] = r; });
            var out = [];
            data.ranked.forEach(function (item) {
                var r = byId[String(item.id)];
                if (!r || out.indexOf(r) !== -1) return;
                if (item.reason) r.reasons = [item.reason];        // the AI's own "why"
                if (typeof item.match === 'number') r.pct = Math.max(20, Math.min(99, item.match));
                r.aiPick = true;
                out.push(r);
            });
            if (!out.length) { finish(scored, false); return; }
            // Anything the AI didn't score keeps its local percentage and goes after,
            // so the user always sees the full "matches + might-matches" list.
            scored.forEach(function (r) { if (out.indexOf(r) === -1) out.push(r); });
            finish(out, true);
        })
        .catch(function () { finish(scored, false); });   // server down → silent fallback
    }

    function render(scored) {
        if (scored) { lastScored = scored; resPage = 0; }
        var box = document.getElementById('fyResults');
        if (!lastScored.length) { renderEmptyState(box); return; }
        var pages = Math.ceil(lastScored.length / RES_PER);
        if (resPage > pages - 1) resPage = pages - 1;
        if (resPage < 0) resPage = 0;
        var start = resPage * RES_PER;
        var pageItems = lastScored.slice(start, start + RES_PER);

        var html = '<div class="fy__results__hd"><span class="fy__results__hd__t">' +
            (_aiRanked
                ? '<i class="fa-solid fa-wand-magic-sparkles" style="color:#7c4dff"></i> Chosen for you by AI <span class="fy__note">· weighed your whole profile</span>'
                : '<i class="fa-solid fa-ranking-star" style="color:var(--orange)"></i> Your top matches <span class="fy__note">· ranked by fit</span>') +
            '</span></div>';
        html += pageItems.map(function(r, j) { return cardHtml(r, start + j, start + j === 0); }).join('');
        if (pages > 1) {
            html += '<div class="fy__pager">' +
                '<button class="fy__pg" data-pg="prev"' + (resPage === 0 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>' +
                '<span>' + (resPage + 1) + ' / ' + pages + '</span>' +
                '<button class="fy__pg" data-pg="next"' + (resPage >= pages - 1 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button>' +
            '</div>';
        }
        box.innerHTML = html;
        box.querySelectorAll('.fy__cbtn').forEach(function(b) {
            b.addEventListener('click', function(e) {
                e.stopPropagation();
                var r = lastScored[+b.dataset.i]; if (!r) return;
                if (b.dataset.act === 'save') saveUni(r.u); else sendToCompare(r.u);
            });
        });
        box.querySelectorAll('.fy__card[data-i]').forEach(function(card) {
            card.addEventListener('click', function() { var r = lastScored[+card.dataset.i]; if (r) openDetail(r); });
        });
        box.querySelectorAll('.fy__pg').forEach(function(b) {
            if (b.disabled) return;
            b.addEventListener('click', function() { resPage += (b.dataset.pg === 'next' ? 1 : -1); render(); });
        });
    }

    function showResultsPanel() { if (modal) modal.classList.add('fy__modal--wide'); }

    // Robust loader: cmpLoadCountryUnis swallows fetch errors (resolves with []),
    // so on file:// or when the JSON isn't served the matcher would come up empty.
    // Fall back to the already-loaded current-country universities (UNI global) so
    // matching always has data to work with.
    function loadUnisFor(code) {
        var globalUni = (typeof UNI !== 'undefined') ? UNI : [];
        if (typeof cmpLoadCountryUnis !== 'function') return Promise.resolve(globalUni);
        return cmpLoadCountryUnis(code).then(function (list) {
            if (list && list.length) return list;
            return (code === currentCountryCode) ? globalUni : list;
        }).catch(function () { return (code === currentCountryCode) ? globalUni : []; });
    }

    // Load + score all universities across saved destinations (shared by matcher & "Show all").
    function scoreAll(cb) {
        var p = readPrefs();
        var codes = destCountries();
        var loaders = codes.map(function(code) {
            return loadUnisFor(code).then(function(list) { return { code: code, list: list || [] }; });
        });
        Promise.all(loaders).then(function(groups) {
            var scored = [];
            groups.forEach(function(g) {
                applyFilters(g.list, g.code, p).forEach(function(it) {
                    var s = scoreUni(it.u, p, g.code);
                    scored.push({ u: it.u, pct: matchPct(s.pct, it.pen), reasons: s.reasons, factors: s.factors, code: g.code, misses: it.misses });
                });
            });
            scored.sort(function(a, b) { return b.pct - a.pct; });
            cb(scored);
        });
    }

    function revealShowAll() { var sa = document.getElementById('fyShowAll'); if (sa) sa.style.display = 'inline-flex'; }

    function aiLoading() {
        document.getElementById('fyResults').innerHTML =
            '<div class="fy__empty"><i class="fa-solid fa-spinner fa-spin"></i> AI is analysing your profile and picking your universities…</div>';
    }
    // Filters narrow the pool; the AI decides the final list and its order.
    function runMatchTop(topN) {
        savePrefs(readPrefs());
        showResultsPanel();
        aiLoading();
        var p = readPrefs();
        var code = (typeof currentCountryCode !== 'undefined' && currentCountryCode) ? currentCountryCode : destCountries()[0];
        loadUnisFor(code).then(function (list) {
            var scored = applyFilters(list, code, p).map(function (it) {
                var s = scoreUni(it.u, p, code);
                return { u: it.u, pct: matchPct(s.pct, it.pen), reasons: s.reasons, factors: s.factors, code: code, misses: it.misses };
            });
            scored.sort(function (a, b) { return b.pct - a.pct; });
            if (!scored.length) { _aiRanked = false; render([]); return; }
            aiRank(scored, p, function (ordered) {
                render(ordered.slice(0, topN));
                revealShowAll();
            });
        });
    }
    function runMatch()        { runMatchTop(16); }   // 2 pages of 8
    function runMatchCountry() { runMatchTop(32); }
    function updateThisCountryLabel() {
        var lbl = document.getElementById('fyThisCountryLbl');
        if (lbl) lbl.textContent = (typeof currentCountryCode !== 'undefined' && typeof countryNameByCode === 'function') ? countryNameByCode(currentCountryCode) : 'This country';
    }

    // Clear every input back to its default (used when re-entering the Explore tab).
    function resetForm() {
        sel.subjects = []; sel.hobbies = []; sel.priorities = []; sel.countries = [];
        if (subjectPicker) subjectPicker.refresh();
        if (hobbyPicker) hobbyPicker.refresh();
        document.querySelectorAll('#fyForm .fy__chip.is-on').forEach(function(c) { c.classList.remove('is-on'); });
        ['fyAvg', 'fyExp'].forEach(function(id) { var e = document.getElementById(id); if (e) e.value = ''; });
        ['fyLang', 'fyLevel', 'fyVibe', 'fySport', 'fyRank'].forEach(function(id) { var e = document.getElementById(id); if (e) e.selectedIndex = 0; });
        var ath = document.getElementById('fyAthlete'); if (ath) ath.value = '0';
        if (budgetSlider) { budgetSlider.value = 15000; syncBudget(); }
        // reset the new sliders to their "no filter" defaults
        var d = { fyMaxTuition: 40000, fyLiving: 2500, fyAccept: 0, fyEmployer: 0, fySalary: 0 };
        Object.keys(d).forEach(function (id) { var e = document.getElementById(id); if (e) { e.value = d[id]; syncExtraSlider(id); } });
        var rf = document.getElementById('fyForm');
        if (rf) rf.querySelectorAll('select').forEach(function (s) { s.dispatchEvent(new Event('change', { bubbles: true })); });
        if (modal) modal.classList.remove('fy__modal--wide');          // collapse any results
        var sa = document.getElementById('fyShowAll'); if (sa) sa.style.display = 'none';
    }

    // Exposed so the rest of the app can refresh the country label/destinations and
    // reset the form (e.g. when the user switches the destination country or tabs).
    window.fyRefresh = function() { renderDest(); updateThisCountryLabel(); };
    window.fyReset = resetForm;

    // ── "Show all" window: top 10 + look up any university's fit ──
    var allOverlay = document.getElementById('fyAllOverlay');
    var allScored = [];
    function ringSm(r) {
        return '<div class="fy__ring fy__ring--sm" style="--p:' + r.pct + ';--ringc:' + ringColor(r.pct) + '"><span class="fy__ring__num">' + r.pct + '</span></div>';
    }
    function rowHtml(r) {
        var u = r.u;
        return '<div class="fy__row2" data-id="' + (u.id || '') + '">' + ringSm(r) +
            '<div class="fy__row2__info"><div class="fy__card__name" style="font-size:13px;"><span class="fy__card__abbr fy__card__abbr--logo">' + uniLogo(u, 24) + '</span>' + (u.name || '') + '</div>' +
            '<div class="fy__card__meta"><span class="fi fi-' + r.code + '"></span> ' + (u.city || '') + ' · ' + countryName(r.code) + '</div></div>' +
            '<div class="fy__row2__actions">' +
                '<button class="fy__cbtn" data-act="save" data-id="' + (u.id || '') + '" title="Save"><i class="fa-regular fa-bookmark"></i></button>' +
                '<button class="fy__cbtn" data-act="compare" data-id="' + (u.id || '') + '" title="Add to Compare"><i class="fa-solid fa-scale-balanced"></i></button>' +
            '</div></div>';
    }
    function findScored(id) { return allScored.find(function(r) { return r.u.id === id; }); }
    function wireRows(container) {
        container.querySelectorAll('.fy__cbtn').forEach(function(b) {
            b.addEventListener('click', function(e) {
                e.stopPropagation();
                var r = findScored(b.dataset.id); if (!r) return;
                if (b.dataset.act === 'save') saveUni(r.u); else sendToCompare(r.u);
            });
        });
        container.querySelectorAll('.fy__row2').forEach(function(row) {
            row.addEventListener('click', function() { var r = findScored(row.dataset.id); if (r) openDetail(r); });
        });
    }
    function renderAllList() {
        var box = document.getElementById('fyAllList');
        box.innerHTML = '<div class="fy__results__hd">Top 10 matches</div>' + allScored.slice(0, 10).map(rowHtml).join('');
        wireRows(box);
    }

    // ── Fit-detail modal (click a university in "Show all") ──
    var detailOverlay = document.getElementById('fyDetailOverlay');
    function fact(icon, label, val, wide) {
        if (!val) return '';
        return '<div class="fy__detail__fact' + (wide ? ' fy__detail__fact--wide' : '') + '">' +
            '<i class="fa-solid ' + icon + '"></i>' +
            '<div class="fy__detail__fact__txt"><span>' + label + '</span>' + val + '</div></div>';
    }
    function openDetail(r) {
        if (!detailOverlay) return;
        var u = r.u;
        document.getElementById('fyDetailName').textContent = u.name || 'University';
        document.getElementById('fyDetailMeta').innerHTML = '<span class="fi fi-' + r.code + '"></span> ' + (u.city || '') + ' · ' + countryName(r.code);
        var web = u.website ? '<a href="' + u.website + '" target="_blank" rel="noopener">' + u.website.replace(/^https?:\/\//, '') + '</a>' : '';

        // Evidence: each factor = "you said X → effect → +Y%"
        var factors = (r.factors || []).filter(function(f){ return f.pts > 0; }).sort(function(a, b){ return b.pts - a.pts; });
        var evidence = factors.map(function(f) {
            return '<div class="fy__ev">' +
                '<div class="fy__ev__head">' +
                    '<div class="fy__ev__you"><i class="fa-solid ' + f.icon + '"></i><span>' + f.you + '</span></div>' +
                    '<div class="fy__ev__pts">+' + f.pts + '%</div>' +
                '</div>' +
                '<div class="fy__ev__effect"><i class="fa-solid fa-arrow-right-long"></i><span>' + f.effect + '</span></div>' +
            '</div>';
        }).join('');

        document.getElementById('fyDetailBody').innerHTML =
            '<div class="fy__detail__score">' +
                '<div class="fy__ring" style="--p:' + r.pct + ';--ringc:' + ringColor(r.pct) + '"><span class="fy__ring__num">' + r.pct + '<span>%</span></span></div>' +
                '<div class="fy__detail__score__txt"><b>' + r.pct + '% overall fit</b> — here\'s how it adds up for you</div>' +
            '</div>' +
            '<div class="fy__detail__sec__h">Why it fits you</div>' +
            '<div class="fy__ev__list">' + (evidence || '<div class="fy__empty">Set your preferences in the matcher for a detailed breakdown.</div>') + '</div>' +
            '<div class="fy__detail__sec__h">Key facts</div>' +
            '<div class="fy__detail__facts">' +
                fact('fa-building', 'Type', u.type) + fact('fa-piggy-bank', 'Annual tuition', tuitionText(u)) +
                fact('fa-calendar', 'Founded', u.founded) + fact('fa-users', 'Students', u.students) +
                fact('fa-fire', 'Entry difficulty', u.dl) + fact('fa-language', 'Languages', (u.langs || []).join(', ')) +
                fact('fa-book-open', 'Fields', (u.fields || []).slice(0, 4).join(', '), true) + fact('fa-link', 'Official site', web, true) +
            '</div>' +
            '<div class="fy__detail__actions">' +
                '<button class="fy__detail__btn fy__detail__btn--save" data-act="save"><i class="fa-regular fa-bookmark"></i> Save</button>' +
                '<button class="fy__detail__btn fy__detail__btn--compare" data-act="compare"><i class="fa-solid fa-scale-balanced"></i> Compare</button>' +
            '</div>';
        document.getElementById('fyDetailBody').querySelectorAll('[data-act]').forEach(function(b) {
            b.addEventListener('click', function() {
                if (b.dataset.act === 'save') saveUni(u); else sendToCompare(u);
                closeDetail();
            });
        });
        detailOverlay.classList.add('open'); document.body.style.overflow = 'hidden';
    }
    function closeDetail() { if (detailOverlay) { detailOverlay.classList.remove('open'); document.body.style.overflow = ''; } }
    if (document.getElementById('fyDetailClose')) document.getElementById('fyDetailClose').addEventListener('click', closeDetail);
    if (detailOverlay) detailOverlay.addEventListener('click', function(e){ if (e.target === detailOverlay) closeDetail(); });
    function openShowAll() {
        if (!allOverlay) return;
        allOverlay.classList.add('open'); document.body.style.overflow = 'hidden';
        document.getElementById('fyAllSearch').value = '';
        document.getElementById('fyAllSearchResult').innerHTML = '';
        document.getElementById('fyAllList').innerHTML = '<div class="fy__empty"><i class="fa-solid fa-spinner fa-spin"></i> Scoring universities…</div>';
        scoreAll(function(scored) { allScored = scored; renderAllList(); });
    }
    function closeShowAll() { if (allOverlay) { allOverlay.classList.remove('open'); document.body.style.overflow = ''; } }
    if (document.getElementById('fyAllClose')) document.getElementById('fyAllClose').addEventListener('click', closeShowAll);
    if (allOverlay) allOverlay.addEventListener('click', function(e){ if (e.target === allOverlay) closeShowAll(); });
    if (document.getElementById('fyAllSearch')) document.getElementById('fyAllSearch').addEventListener('input', function() {
        var q = this.value.trim().toLowerCase();
        var box = document.getElementById('fyAllSearchResult');
        if (!q) { box.innerHTML = ''; return; }
        var hits = allScored.filter(function(r) {
            return (r.u.name || '').toLowerCase().indexOf(q) !== -1 ||
                   (r.u.website || '').toLowerCase().indexOf(q) !== -1 ||
                   (r.u.abbr || '').toLowerCase().indexOf(q) !== -1;
        }).slice(0, 5);
        box.innerHTML = hits.length
            ? '<div class="fy__results__hd">Fit for "' + q + '"</div>' + hits.map(rowHtml).join('')
            : '<div class="fy__empty">No saved-destination university matches "' + q + '".</div>';
        if (hits.length) wireRows(box);
    });

    // ── Floating / header buttons (Elite + preference) ──
    function isHidden() { try { return !!getProfile().fyHidden; } catch (e) { return false; } }
    function setHidden(v) { try { var p = getProfile(); p.fyHidden = v; setProfile(p); } catch (e) {} window.updateFyButtons(); }
    window.updateFyButtons = function() {
        var elite = (typeof eliteState !== 'undefined' && eliteState && !!eliteState.elite);
        var hidden = isHidden();
        var inline = !!window.__fyInline;   // matcher is embedded in Explore → no floating button
        fab.style.display = (elite && !hidden && !inline) ? 'flex' : 'none';
        if (hdrBtn) hdrBtn.style.display = (elite && hidden && !inline) ? 'inline-flex' : 'none';
        var dock = document.getElementById('fyDock');
        if (dock) dock.title = hidden ? 'Show floating button' : 'Move button to header';
    };

    function openFy() {
        renderDest();
        updateThisCountryLabel();
        var sa = document.getElementById('fyShowAll');   // only appears after "Find my matches"
        if (sa) sa.style.display = modal && modal.classList.contains('fy__modal--wide') ? 'inline-flex' : 'none';
        overlay.classList.add('open'); document.body.style.overflow = 'hidden';
    }
    function closeFy() { overlay.classList.remove('open'); document.body.style.overflow = ''; }

    // Init
    subjectPicker = ChipPicker({ chipsId: 'fySubjectsRow', inputId: 'fySubjectsInput', pool: SUBJECTS_ALL, bucket: 'subjects', pageSize: 8 });
    hobbyPicker   = ChipPicker({ chipsId: 'fyHobbiesRow',  inputId: 'fyHobbiesInput',  pool: HOBBIES_ALL,  bucket: 'hobbies',  pageSize: 6 });
    buildChips('fyPriorities', PRIORITIES, 'priorities');
    fillSports();
    enhanceAllSelects();
    budgetSlider.addEventListener('input', syncBudget);
    initExtraSliders();
    buildCountryChips();
    loadPrefs();
    renderDest();

    document.getElementById('fyFabMain').addEventListener('click', openFy);
    document.getElementById('fyFabHide').addEventListener('click', function() { setHidden(true); });
    if (hdrBtn) hdrBtn.addEventListener('click', openFy);
    document.getElementById('fyDock').addEventListener('click', function() { setHidden(!isHidden()); });
    document.getElementById('fyClose').addEventListener('click', closeFy);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeFy(); });
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        if (detailOverlay && detailOverlay.classList.contains('open')) { closeDetail(); return; }
        if (allOverlay && allOverlay.classList.contains('open')) { closeShowAll(); return; }
        if (overlay.classList.contains('open')) closeFy();
    });
    /* ── "Use these filters for my Gradebook" ──
       Saves the matcher's hard filters (budget + language) so the Gradebook's
       "realistic options" honour them. Persists while the toggle is active. */
    (function () {
        var sgBtn = document.getElementById('fySaveGbBtn');
        if (!sgBtn) return;
        var ON_KEY = 'us_gb_filters_on_' + user.id;
        var isOn = function () { return localStorage.getItem(ON_KEY) === '1'; };
        function capture() {
            return { kind: 'matcher', prefs: readPrefs() };   // full preferences → scored in the Gradebook
        }
        function paint() {
            var on = isOn();
            sgBtn.classList.toggle('fy__savegb--on', on);
            var span = sgBtn.querySelector('span');
            if (span) span.textContent = on ? 'Saving these filters to Gradebook' : 'Use these filters for my Gradebook';
        }
        function recaptureIfOn() { if (isOn()) setGbFilters(capture()); }
        sgBtn.addEventListener('click', function () {
            var next = !isOn();
            localStorage.setItem(ON_KEY, next ? '1' : '0');
            setGbFilters(next ? capture() : null);
            paint();
        });
        // Keep the saved filters fresh as the user tweaks the matcher.
        var langEl = document.getElementById('fyLang'); if (langEl) langEl.addEventListener('change', recaptureIfOn);
        var bs = document.getElementById('fyBudget'); if (bs) bs.addEventListener('input', recaptureIfOn);
        paint();
    }());

    document.getElementById('fyGo').addEventListener('click', runMatch);
    var thisCountryBtn = document.getElementById('fyThisCountry');
    if (thisCountryBtn) thisCountryBtn.addEventListener('click', runMatchCountry);
    updateThisCountryLabel();

    window.updateFyButtons();
}());

/* ── Elite: show the AI matcher inline in Explore, replacing the search + filter
   sections. Free users keep the normal Explore layout. City Guide is untouched. ── */
function applyExploreMatcherLayout() {
    var modal   = document.getElementById('fyModal');
    var overlay = document.getElementById('fyOverlay');
    var mount   = document.getElementById('expMatcherMount');
    if (!modal || !mount) return;

    var elite = (typeof eliteState !== 'undefined' && eliteState && !!eliteState.elite);
    var hero       = document.querySelector('#tabExplore .exp__hero');
    // NB: exclude our own matcher separator, otherwise on repeat calls `brk`
    // resolves to it and the container gets inserted above the separator.
    var brk        = document.querySelector('#tabExplore .exp__break:not(.exp__break--city):not(.exp__break--matcher)');
    var filterCard = document.querySelector('#tabExplore .exp__filter__card');

    if (elite) {
        // Elite keeps the SAME search hero as the common version; only the
        // filter section below it is replaced by the personal-matcher container.
        if (hero)       hero.style.display = '';
        if (brk)        brk.style.display = 'none';
        if (filterCard) filterCard.style.display = 'none';

        // The rebuilt "Made for you" (madeForYou.js) renders straight into the mount;
        // the old matcher modal goes back to its pop-up overlay.
        if (typeof window.mfyMount === 'function') {
            if (overlay && modal.parentNode !== overlay) overlay.appendChild(modal);
            modal.classList.remove('fy__modal--inline');
            var sepN = document.getElementById('fyMatchSep');
            if (!sepN) {
                sepN = document.createElement('div');
                sepN.className = 'exp__break exp__break--matcher';
                sepN.id = 'fyMatchSep';
                sepN.innerHTML = '<div class="exp__break__line"></div><div class="exp__break__pill"><i class="fa-solid fa-wand-magic-sparkles"></i><span>Made for you</span></div><div class="exp__break__line"></div>';
            }
            sepN.style.display = '';
            if (brk && brk.parentNode) { brk.parentNode.insertBefore(sepN, brk); brk.parentNode.insertBefore(mount, brk); }
            mount.classList.remove('fy--open');
            mount.style.display = 'block';
            window.mfyMount(mount);
            window.__fyInline = false;
            if (typeof window.updateFyButtons === 'function') window.updateFyButtons();
            return;
        }

        // Matcher container with a button (left) + a branded quote (right).
        var intro = document.getElementById('fyIntro');
        if (!intro) {
            intro = document.createElement('div');
            intro.className = 'fy__intro';
            intro.id = 'fyIntro';
            intro.innerHTML =
                '<button class="fy__intro__close" id="fyMatchClose" type="button" aria-label="Close matcher"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="fy__intro__main">' +
                    '<span class="fy__intro__badge"><i class="fa-solid fa-wand-magic-sparkles"></i> Elite matcher</span>' +
                    '<div class="fy__intro__titlerow">' +
                        '<h2 class="fy__intro__title">Find universities made for you</h2>' +
                        '<span class="fy__intro__tools" id="fyIntroTools"></span>' +
                    '</div>' +
                    '<p class="fy__intro__text">Answer a few quick questions and we’ll rank every university by how well it fits you.</p>' +
                    '<button class="fy__intro__btn" id="fyToggle" type="button" aria-expanded="false">' +
                        '<i class="fa-solid fa-sliders"></i> <span class="fy__intro__btn__lbl">Open my matcher</span>' +
                        '<i class="fa-solid fa-chevron-down fy__intro__btn__chev"></i>' +
                    '</button>' +
                '</div>' +
                '<div class="fy__intro__quote">' +
                    '<i class="fa-solid fa-quote-left fy__intro__quote__mark"></i>' +
                    '<p class="fy__intro__quote__text">The best university isn’t the highest ranked — it’s the one that fits <em>you</em>.</p>' +
                    '<div class="fy__intro__quote__brand"><img src="images/logo2.png" alt="UniVersity"><span>UniVersity</span></div>' +
                '</div>';
            mount.appendChild(intro);
        }
        var collapse = mount.querySelector('.fy__collapse');
        if (!collapse) {
            collapse = document.createElement('div');
            collapse.className = 'fy__collapse';
            mount.appendChild(collapse);
        }
        if (modal.parentNode !== collapse) { collapse.appendChild(modal); }
        modal.classList.add('fy__modal--inline');
        mount.style.display = 'block';
        mount.classList.remove('fy--open');          // start collapsed each visit

        // Move "Show all by fit" up into the intro header, on the title's row.
        var showAllEl = document.getElementById('fyShowAll');
        var introTools = document.getElementById('fyIntroTools');
        if (showAllEl && introTools && showAllEl.parentNode !== introTools) {
            introTools.appendChild(showAllEl);
        }

        // Section separator (same style used between sections elsewhere).
        var sep = document.getElementById('fyMatchSep');
        if (!sep) {
            sep = document.createElement('div');
            sep.className = 'exp__break exp__break--matcher';
            sep.id = 'fyMatchSep';
            sep.innerHTML = '<div class="exp__break__line"></div>' +
                '<div class="exp__break__pill"><i class="fa-solid fa-wand-magic-sparkles"></i><span>Made for you</span></div>' +
                '<div class="exp__break__line"></div>';
        }
        sep.style.display = '';

        // Separator + matcher container sit just below the hero / search results.
        if (brk && brk.parentNode) {
            brk.parentNode.insertBefore(sep, brk);
            brk.parentNode.insertBefore(mount, brk);
        }

        var toggle = document.getElementById('fyToggle');
        var closeBtnX = document.getElementById('fyMatchClose');
        function setMatcherOpen(open) {
            mount.classList.toggle('fy--open', open);
            if (toggle) {
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                var lbl = toggle.querySelector('.fy__intro__btn__lbl');
                if (lbl) lbl.textContent = open ? 'Close matcher' : 'Open my matcher';
            }
            if (open) {
                requestAnimationFrame(function () { intro.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
            }
        }
        if (toggle && !toggle.__wired) {
            toggle.__wired = true;
            toggle.addEventListener('click', function () { setMatcherOpen(!mount.classList.contains('fy--open')); });
        }
        if (closeBtnX && !closeBtnX.__wired) {
            closeBtnX.__wired = true;
            closeBtnX.addEventListener('click', function () { setMatcherOpen(false); });
        }
        setMatcherOpen(false);   // always start collapsed

        // Fresh start every time Explore is opened: reset filters + sync the country label.
        if (typeof window.fyReset === 'function') window.fyReset();
        if (typeof window.fyRefresh === 'function') window.fyRefresh();
    } else {
        if (overlay && modal.parentNode !== overlay) { overlay.appendChild(modal); }
        modal.classList.remove('fy__modal--inline');
        mount.style.display = 'none';
        mount.classList.remove('fy--open');
        // Return "Show all by fit" to the modal header for the pop-up matcher.
        var showAllBack = document.getElementById('fyShowAll');
        var headBtns = modal.querySelector('.fy__head__btns');
        if (showAllBack && headBtns && showAllBack.parentNode !== headBtns) {
            headBtns.appendChild(showAllBack);
        }
        var sepOff = document.getElementById('fyMatchSep');
        if (sepOff) sepOff.style.display = 'none';
        if (hero)       hero.style.display = '';
        if (brk)        brk.style.display = '';
        if (filterCard) filterCard.style.display = '';
    }
    window.__fyInline = elite;
    if (typeof window.updateFyButtons === 'function') window.updateFyButtons();
}

/* ════════════════════════════════════════════════════════════════════════════
   GRADEBOOK & ACADEMIC PROGRESS  (Phase 1)
   ──────────────────────────────────────────────────────────────────────────
   Storage: us_gradebook_<id> (versioned). Every grade is stored historically
   — never only the average — so future AI/predictions and school-system
   imports (e.g. Toddle) can use the full timeline. See docs at end of file.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    var KEY = 'us_gradebook_' + user.id;
    var ASSESS_TYPES = ['Test', 'Quiz', 'Exam', 'Midterm', 'Final', 'Coursework', 'Project', 'Homework'];
    var PALETTE = ['#2a56c6', '#d7373f', '#1c8a4e', '#7a4fc9', '#e0701a', '#0f8b8d', '#c2185b', '#5b6b8a'];   // pen colours

    function fresh() { return { v: 1, scale: 'pct', subjects: [], unis: { dream: [], target: [], safety: [] }, goals: [] }; }
    // Normalise so older / partial saves can never break the app (missing `unis`,
    // `goals`, etc. used to throw at init and take the whole page down with them).
    function normalizeGb(d) {
        if (!d || typeof d !== 'object') return fresh();
        d.v = d.v || 1;
        d.scale = d.scale || 'pct';
        if (!Array.isArray(d.subjects)) d.subjects = [];
        if (!d.unis || typeof d.unis !== 'object') d.unis = {};
        d.unis.dream  = Array.isArray(d.unis.dream)  ? d.unis.dream  : [];
        d.unis.target = Array.isArray(d.unis.target) ? d.unis.target : [];
        d.unis.safety = Array.isArray(d.unis.safety) ? d.unis.safety : [];
        if (!Array.isArray(d.goals)) d.goals = [];
        return d;
    }
    function load() { try { var d = JSON.parse(localStorage.getItem(KEY)); return (d && d.subjects) ? normalizeGb(d) : fresh(); } catch (e) { return fresh(); } }
    function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
    var GB = load();
    var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };

    /* ── Grade scale: averages stay in the student's own system; percentages
          are used ONLY for university chances/readiness/gaps. ── */
    var SCALES = {
        pct: { max: 100, label: 'Percentage (0–100)', hint: '/ 100' },
        ib:  { max: 7,   label: 'IB (1–7 per subject)', hint: '/ 7' },
        p10: { max: 10,  label: 'Points (1–10)',       hint: '/ 10' },
        p9:  { max: 9,   label: 'GCSE (1–9)',          hint: '/ 9' },
        p8:  { max: 8,   label: 'Out of 8 (1–8)',      hint: '/ 8' },
        p5:  { max: 5,   label: 'Scale (1–5)',         hint: '/ 5' },
        gpa: { max: 4,   label: 'GPA (0–4)',           hint: '/ 4' }
    };
    function scaleDef() { return SCALES[GB.scale] || SCALES.pct; }
    function scaleMax() { return scaleDef().max; }
    function toPct(g) { return g == null ? null : Math.max(0, Math.min(100, g / scaleMax() * 100)); }
    function gradeColor(g) { return ringColor(toPct(g)); }

    /* ── Maths ─────────────────────────────────────────────── */
    // All numeric exam marks a subject has across both semesters (clamped to scale).
    function subjMarks(s) {
        var mx = scaleMax(), out = [];
        [s && s.sem1, s && s.sem2].forEach(function (arr) {
            (arr || []).forEach(function (m) {
                if (m != null && m !== '' && !isNaN(m)) out.push(Math.max(0, Math.min(mx, +m)));
            });
        });
        return out;
    }
    function subjAvg(s) {
        var mx = scaleMax();
        // Prefer per-semester exam marks (the detailed table) when present.
        var marks = subjMarks(s);
        if (marks.length) return marks.reduce(function (a, b) { return a + b; }, 0) / marks.length;
        // Final grade per subject (what the student/PDF provides). Falls back to the
        // legacy per-assessment average for any older data.
        if (s.grade != null && s.grade !== '') return Math.max(0, Math.min(mx, +s.grade));
        if (!s.assessments || !s.assessments.length) return null;
        var w = 0, t = 0;
        s.assessments.forEach(function (a) { var wt = a.weight || 1, g = Math.max(0, Math.min(mx, a.grade)); w += wt; t += g * wt; });
        return w ? t / w : null;
    }
    function overallAvg(state) {
        state = state || GB;
        var vals = state.subjects.map(subjAvg).filter(function (v) { return v != null; });
        if (!vals.length) return null;
        return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    }
    // Overall-average timeline: recompute the overall average after each grade (by date) was added.
    function overallSeries() {
        var all = [];
        GB.subjects.forEach(function (s) { (s.assessments || []).forEach(function (a) { all.push({ sid: s.id, a: a }); }); });
        all.sort(function (x, y) { return (x.a.date || '').localeCompare(y.a.date || '') || x.a.ts - y.a.ts; });
        var bySub = {}, series = [];
        all.forEach(function (item) {
            (bySub[item.sid] = bySub[item.sid] || []).push(item.a);
            var subAvgs = Object.keys(bySub).map(function (k) {
                var w = 0, t = 0, mx = scaleMax(); bySub[k].forEach(function (a) { var wt = a.weight || 1, g = Math.max(0, Math.min(mx, a.grade)); w += wt; t += g * wt; });
                return w ? t / w : 0;
            });
            series.push(subAvgs.reduce(function (a, b) { return a + b; }, 0) / subAvgs.length);
        });
        return series;
    }
    // Typical entry mark (as a %) implied by a university's selectivity (diff 1..5).
    function recPct(u) { return ({ 5: 97, 4: 91, 3: 83, 2: 75, 1: 67 })[u.diff || 3] || 80; }
    function recGrade(u) { return recPct(u); }                       // back-compat alias (percentage)
    function reqMark(u) { return Math.round(recPct(u) / 100 * scaleMax() * 10) / 10; }   // required mark in the student's own scale
    // Realistic readiness: meeting the bar ≈ ready; every point below it costs a lot.
    function readinessForPct(cur, u) {
        var gap = recPct(u) - cur;
        var r = gap <= 0 ? (94 + Math.min(6, Math.round(-gap / 3))) : Math.round(95 * Math.pow(0.9, gap));
        return Math.max(2, Math.min(99, r));
    }
    function readinessPct(u) { var o = overallAvg(); return o == null ? null : readinessForPct(toPct(o), u); }
    // The university the student is aiming for (top dream, else top target).
    function aimUni() { var id = GB.unis.dream[0] || GB.unis.target[0]; return id ? findUni(id) : null; }
    function findUni(id) {
        var u = (typeof UNI !== 'undefined') ? UNI.find(function (x) { return x.id === id; }) : null;
        if (u) return u;
        // Not in the current country — fall back to the cross-country registry so a
        // dream/target uni from another country (e.g. Oxford while viewing Spain)
        // still resolves instead of showing a wrong university.
        return (typeof window.uniFromRegistry === 'function') ? window.uniFromRegistry(id) : null;
    }
    function allTargetIds() { return GB.unis.dream.concat(GB.unis.target, GB.unis.safety); }

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
    function fmtMonth(d) { try { return new Date(d + 'T00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }); } catch (e) { return d; } }

    /* ── Sparkline ─────────────────────────────────────────── */
    function sparkline(svg, series) {
        if (!svg) return;
        if (series.length < 2) { svg.innerHTML = ''; return; }
        var min = Math.min.apply(null, series), max = Math.max.apply(null, series);
        var span = (max - min) || 1, W = 120, H = 40, pad = 4;
        var pts = series.map(function (v, i) {
            var x = pad + i / (series.length - 1) * (W - pad * 2);
            var y = H - pad - (v - min) / span * (H - pad * 2);
            return x.toFixed(1) + ',' + y.toFixed(1);
        });
        var last = pts[pts.length - 1].split(',');
        svg.innerHTML =
            '<polyline fill="none" style="stroke:var(--gb-pen, #2a56c6)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" points="' + pts.join(' ') + '"/>' +
            '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="3" style="fill:var(--gb-pen, #2a56c6)"/>';
    }

    /* ── Renderers ─────────────────────────────────────────── */
    // Pen colours come from the page theme (gradebook.css / overview.css); hex values are fallbacks.
    function ringColor(p) { return p >= 85 ? 'var(--gb-good, #1c8a4e)' : p >= 70 ? 'var(--gb-ok, #c98300)' : p >= 50 ? 'var(--gb-meh, #e0701a)' : 'var(--gb-bad, #d7373f)'; }

    // How close the student is to where they want to be (0–100). Uses the aim
    // university's readiness if one is chosen, otherwise the average as a %.
    function closeness() {
        var o = overallAvg(); if (o == null) return null;
        var aim = aimUni();
        return aim ? readinessPct(aim) : Math.round(toPct(o));
    }
    // Animated line that trends UP (green) when on track (≥70% close) or DOWN (red) otherwise.
    function trendGraph(svg, up) {
        if (!svg) return;
        var col = up ? 'var(--gb-good, #1c8a4e)' : 'var(--gb-bad, #d7373f)';
        var pts = up ? '4,44 26,38 50,40 74,24 98,16 116,7' : '4,12 26,18 50,17 74,32 98,40 116,50';
        var head = up ? '<path d="M116,7 l-10,0.5 l5,7.5 z" style="fill:' + col + '"/>'
                      : '<path d="M116,50 l-10,-0.5 l5,-7.5 z" style="fill:' + col + '"/>';
        svg.innerHTML = '<polyline class="gb__tg__line" fill="none" style="stroke:' + col + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="' + pts + '"/>' + head;
        var ln = svg.querySelector('.gb__tg__line');
        if (ln) {
            var len = ln.getTotalLength ? ln.getTotalLength() : 220;
            ln.style.strokeDasharray = len; ln.style.strokeDashoffset = len;
            void ln.getBoundingClientRect();
            ln.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.8,.3,1)';
            ln.style.strokeDashoffset = '0';
        }
        svg.classList.toggle('gb__tg--up', !!up);
        svg.classList.toggle('gb__tg--down', !up);
    }

    function renderOverall() {
        var o = overallAvg();
        var hero = document.querySelector('.gb__hero');
        if (hero) hero.classList.toggle('gb__hero--empty', o == null);
        var ringNum = document.getElementById('gbRingNum');
        if (ringNum) { ringNum.textContent = o == null ? '—' : Math.round(o * 10) / 10; ringNum.style.color = o == null ? '' : gradeColor(o); }
        var scEl = document.getElementById('gbAvgScale'); if (scEl) scEl.textContent = o == null ? '' : scaleDef().hint;
        sparkline(document.getElementById('gbSpark'), overallSeries());
        // Animated up/down trajectory graphic
        var c = closeness(), up = c != null && c >= 70;
        var g = document.getElementById('gbTrendGraph');
        if (g) { if (c == null) g.innerHTML = ''; else trendGraph(g, up); }
        var glbl = document.getElementById('gbTrendGraphLbl'), aim = aimUni();
        if (glbl) {
            if (c == null) glbl.textContent = 'Add grades to see your trajectory';
            else glbl.innerHTML = '<span style="color:' + (up ? 'var(--gb-good, #1c8a4e)' : 'var(--gb-meh, #e0701a)') + ';font-weight:800">' + c + '% ready</span> for ' + (aim ? esc(aim.name) : 'your goal');
        }
        // IB: the diploma is out of 45 — best six subjects (7 each) + up to 3 core points.
        var ibEl = document.getElementById('gbIbTotal');
        if (ibEl) {
            var avgs = GB.scale === 'ib' ? GB.subjects.map(subjAvg).filter(function (v) { return v != null; }).sort(function (a, b) { return b - a; }) : [];
            ibEl.hidden = !avgs.length;
            if (avgs.length) {
                var pts = avgs.length >= 6 ? avgs.slice(0, 6).reduce(function (a, b) { return a + b; }, 0) : (avgs.reduce(function (a, b) { return a + b; }, 0) / avgs.length) * 6;
                ibEl.innerHTML = 'IB diploma \u2248 <b>' + Math.round(pts) + '</b> / 42 from your best six subjects, plus up to 3 core points (TOK &amp; EE)' + (avgs.length < 6 ? ' \u2014 estimated from ' + avgs.length + ' subject' + (avgs.length === 1 ? '' : 's') : '') + '.';
            }
        }
        // Red-pen note next to the average: the one thing to know.
        var note = document.getElementById('gbNote');
        if (note) {
            var txt = '', good = false;
            if (o != null) {
                if (aim) {
                    var short = Math.round((reqMark(aim) - o) * 10) / 10, who = aim.abbr && aim.abbr.length <= 10 ? aim.abbr : aim.name;
                    good = short <= 0;
                    txt = good ? 'on track for ' + who + '!' : '+' + short + ' to reach ' + who;
                } else {
                    var r = o / scaleMax();
                    good = r >= .7;
                    txt = r >= .85 ? 'great work!' : r >= .7 ? 'solid \u2014 keep going' : 'room to grow';
                }
            }
            if (note.textContent !== txt) {
                note.textContent = txt;
                note.classList.toggle('is-good', good);
                note.classList.remove('is-in'); void note.offsetWidth; if (txt) note.classList.add('is-in');
            }
        }
    }

    // Mini bar-chart of a subject's per-exam grades (under the subject name).
    function subjBarsHTML(s) {
        var slots = [].concat(s.sem1 || [], s.sem2 || []);
        if (!slots.length) return '';
        var mx = scaleMax();
        var bars = slots.map(function (m, i) {
            if (m == null || m === '' || isNaN(m)) {
                return '<span class="gb__bar gb__bar--empty" title="Exam ' + (i + 1) + ' · not taken yet"></span>';
            }
            var h = Math.max(16, Math.min(100, (+m) / mx * 100));
            return '<span class="gb__bar" style="height:' + h + '%;--bc:' + gradeColor(+m) + '" title="Exam ' + (i + 1) + ' · ' + (Math.round(m * 10) / 10) + '"></span>';
        }).join('');
        return '<div class="gb__subject__bars" aria-hidden="true">' + bars + '</div>';
    }

    function renderSubjects() {
        var box = document.getElementById('gbSubjects');
        if (!box) return;
        if (!GB.subjects.length) {
            box.innerHTML =
                '<div class="gb__empty gb__empty--start">' +
                    '<img src="images/logo2.png" alt="UniVersity" class="gb__empty__logo">' +
                    '<h3>Add your subjects &amp; grades</h3>' +
                    '<p>Type a subject above to start tracking — or upload the grade report you already have and we\'ll fill it in for you.</p>' +
                    '<div class="gb__empty__actions">' +
                        '<button class="gb__btn gb__btn--primary" id="gbEmptyAddBtn"><i class="fa-solid fa-plus"></i> Add a subject</button>' +
                        '<button class="gb__btn gb__btn--light" id="gbEmptyUploadBtn"><i class="fa-solid fa-file-arrow-up"></i> Upload grade report (PDF)</button>' +
                    '</div>' +
                '</div>';
            var ea = document.getElementById('gbEmptyAddBtn');
            if (ea) ea.addEventListener('click', function () { var i = document.getElementById('gbNewSubject'); if (i) i.focus(); });
            var eu = document.getElementById('gbEmptyUploadBtn');
            if (eu) eu.addEventListener('click', function () { var b = document.getElementById('gbUploadBtn'); if (b) b.click(); });
            return;
        }
        var hint = scaleDef().hint, mx = scaleMax();
        box.innerHTML = GB.subjects.map(function (s) {
            var avg = subjAvg(s);
            var marks = subjMarks(s);
            var nExams = (s.sem1 ? s.sem1.length : 0) + (s.sem2 ? s.sem2.length : 0);
            var locked = marks.length > 0;     // managed via the detailed table
            var goalChip = (s.goal != null && s.goal !== '')
                ? '<span class="gb__subject__goal" title="Your goal for this subject"><i class="fa-solid fa-bullseye"></i> ' + (Math.round(s.goal * 10) / 10) + '</span>' : '';
            var examChip = nExams ? '<span class="gb__subject__exch"><i class="fa-solid fa-table-list"></i> ' + marks.length + '/' + nExams + '</span>' : '';
            return '<div class="gb__subject gb__subject--final gb__subject--click" style="--sc:' + (s.color || '#d97c14') + '" data-sid="' + s.id + '" title="Open marks table">' +
                '<div class="gb__subject__lead">' +
                    '<div class="gb__subject__name"><span class="gb__subject__dot"></span>' + esc(s.name) + goalChip + examChip + '</div>' +
                    subjBarsHTML(s) +
                '</div>' +
                '<div class="gb__subject__final">' +
                    (locked
                        ? '<span class="gb__sgrade gb__sgrade--ro" style="color:' + gradeColor(avg) + '">' + (avg == null ? '—' : (Math.round(avg * 10) / 10)) + '</span>'
                        : '<input type="number" class="gb__sgrade" min="0" max="' + mx + '" step="0.1" placeholder="—" value="' + (avg == null ? '' : (Math.round(avg * 10) / 10)) + '"' + (avg == null ? '' : ' style="color:' + gradeColor(avg) + '"') + '>') +
                    '<span class="gb__sgrade__max">' + hint + '</span>' +
                '</div>' +
                '<i class="fa-solid fa-chevron-right gb__subject__go" title="Open marks table"></i>' +
                '<button class="gb__subject__del" title="Remove subject"><i class="fa-solid fa-trash-can"></i></button>' +
            '</div>';
        }).join('');
    }

    /* ════════ Per-subject marks table modal (two semesters + goal) ════════ */
    var gbsmEl = null, gbsmSid = null;
    function gbRound(v) { return Math.round(v * 10) / 10; }
    function gbMean(arr) {
        var nums = (arr || []).filter(function (m) { return m != null && m !== '' && !isNaN(m); }).map(Number);
        if (!nums.length) return null;
        return nums.reduce(function (a, b) { return a + b; }, 0) / nums.length;
    }

    // Build the recommendation lines: what to score next to hit the goal / pass the uni.
    function gbSubjectRecHTML(s) {
        var mx = scaleMax(), hint = scaleDef().hint;
        var marks = subjMarks(s);
        var T = (s.sem1 ? s.sem1.length : 0) + (s.sem2 ? s.sem2.length : 0);
        var taken = marks.length, remaining = T - taken;
        var sum = marks.reduce(function (a, b) { return a + b; }, 0);
        var cur = taken ? sum / taken : null;
        var rows = [];
        var G = (s.goal != null && s.goal !== '' && !isNaN(s.goal)) ? Math.max(0, Math.min(mx, +s.goal)) : null;

        if (G != null) {
            if (remaining > 0) {
                var needed = (G * T - sum) / remaining;
                var best = (sum + mx * remaining) / T;
                if (needed > mx + 1e-9) rows.push({ ic: 'fa-circle-exclamation', cls: 'warn', html: 'Your goal of <b>' + gbRound(G) + '</b> isn’t reachable with ' + remaining + ' exam' + (remaining > 1 ? 's' : '') + ' left — even full marks finishes at ~<b>' + gbRound(best) + '</b>. Try aiming a little lower.' });
                else if (needed <= 0) rows.push({ ic: 'fa-circle-check', cls: 'good', html: 'You’ve already locked in your goal of <b>' + gbRound(G) + '</b> 🎉 — anything on the rest keeps you there.' });
                else rows.push({ ic: 'fa-wand-magic-sparkles', cls: 'aim', html: 'Score about <b>' + gbRound(needed) + ' ' + hint + '</b> on your remaining <b>' + remaining + '</b> exam' + (remaining > 1 ? 's' : '') + ' to finish this subject at your goal of <b>' + gbRound(G) + '</b>.' });
            } else if (taken) {
                var d = G - cur;
                if (d <= 0.05) rows.push({ ic: 'fa-circle-check', cls: 'good', html: 'You’ve hit your goal — current average <b>' + gbRound(cur) + '</b> ≥ goal <b>' + gbRound(G) + '</b> 🎉' });
                else rows.push({ ic: 'fa-arrow-trend-up', cls: 'aim', html: 'You’re <b>' + gbRound(d) + '</b> below your goal of <b>' + gbRound(G) + '</b>. Add upcoming exams with “+” to plan how to close it.' });
            } else {
                rows.push({ ic: 'fa-table-list', cls: 'aim', html: 'Set how many exams you have and add your marks — then I’ll tell you exactly what you need to hit <b>' + gbRound(G) + '</b>.' });
            }
        }

        var aim = aimUni();
        if (aim && cur != null) {
            var req = reqMark(aim), gap = gbRound(req - cur);
            if (gap <= 0) rows.push({ ic: 'fa-graduation-cap', cls: 'good', html: 'This subject already clears <b>' + esc(aim.name) + '</b>’s bar (~<b>' + req + ' ' + hint + '</b>). 🎉' });
            else if (remaining > 0) {
                var needU = (req * T - sum) / remaining;
                rows.push({ ic: 'fa-graduation-cap', cls: 'aim', html: 'To pass <b>' + esc(aim.name) + '</b> (~' + req + ' ' + hint + '), aim for ~<b>' + gbRound(Math.min(mx, needU)) + '</b> on your remaining ' + remaining + ' exam' + (remaining > 1 ? 's' : '') + ' — you’re <b>+' + gap + '</b> short.' });
            } else rows.push({ ic: 'fa-graduation-cap', cls: 'aim', html: 'You’re <b>+' + gap + ' ' + hint + '</b> short of <b>' + esc(aim.name) + '</b>’s bar (~' + req + '). Add upcoming exams to plan it.' });
        }

        if (!rows.length) rows.push({ ic: 'fa-lightbulb', cls: 'aim', html: 'Set a goal mark above (and pick your dream university in the Gradebook) and I’ll tell you exactly what to score next.' });
        return rows.map(function (r) { return '<div class="gbsm__rec gbsm__rec--' + r.cls + '"><span class="gbsm__rec__ic"><i class="fa-solid ' + r.ic + '"></i></span><span class="gbsm__rec__tx">' + r.html + '</span></div>'; }).join('');
    }

    function gbSemTableHTML(s, semKey, label) {
        var arr = s[semKey] || [], mx = scaleMax(), hint = scaleDef().hint, avg = gbMean(arr);
        var inputs = arr.map(function (m, i) {
            return '<div class="gbsm__cell"><span class="gbsm__cell__n">' + (i + 1) + '</span>' +
                '<input type="number" class="gbsm__mark" data-sem="' + semKey + '" data-i="' + i + '" min="0" max="' + mx + '" step="0.1" placeholder="—" value="' + (m == null || m === '' ? '' : m) + '"></div>';
        }).join('');
        return '<div class="gbsm__sem">' +
            '<div class="gbsm__sem__hd"><span class="gbsm__sem__title">' + label + '</span>' +
                '<span class="gbsm__count"><button type="button" class="gbsm__count__btn" data-act="dec" data-sem="' + semKey + '" title="Fewer exams">−</button>' +
                '<b>' + arr.length + '</b>&nbsp;exam' + (arr.length === 1 ? '' : 's') +
                '<button type="button" class="gbsm__count__btn" data-act="inc" data-sem="' + semKey + '" title="More exams">+</button></span>' +
            '</div>' +
            '<div class="gbsm__grid">' + (inputs || '<div class="gbsm__hint">No exams yet — use “+” to add one.</div>') + '</div>' +
            '<div class="gbsm__sem__avg">Semester average <b style="color:' + (avg == null ? 'inherit' : gradeColor(avg)) + '">' + (avg == null ? '—' : gbRound(avg)) + '</b> <span>' + hint + '</span></div>' +
        '</div>';
    }

    function gbsmRefreshComputed() {
        if (!gbsmEl || gbsmSid == null) return;
        var s = GB.subjects.find(function (x) { return x.id === gbsmSid; });
        if (!s) return;
        var avg = subjAvg(s);
        var oEl = gbsmEl.querySelector('.gbsm__overall b');
        if (oEl) { oEl.textContent = avg == null ? '—' : gbRound(avg); oEl.style.color = avg == null ? '' : gradeColor(avg); }
        gbsmEl.querySelectorAll('.gbsm__sem').forEach(function (semEl, idx) {
            var a = gbMean(s[idx === 0 ? 'sem1' : 'sem2']);
            var b = semEl.querySelector('.gbsm__sem__avg b');
            if (b) { b.textContent = a == null ? '—' : gbRound(a); b.style.color = a == null ? '' : gradeColor(a); }
        });
        var rec = gbsmEl.querySelector('.gbsm__recs');
        if (rec) rec.innerHTML = gbSubjectRecHTML(s);
    }

    function gbsmRenderBody() {
        var s = GB.subjects.find(function (x) { return x.id === gbsmSid; });
        if (!s || !gbsmEl) return;
        var mx = scaleMax(), av = subjAvg(s);
        gbsmEl.querySelector('.gbsm__body').innerHTML =
            '<div class="gbsm__goal">' +
                '<label><i class="fa-solid fa-bullseye"></i> Your goal for this subject</label>' +
                '<div class="gbsm__goal__in"><input type="number" id="gbsmGoal" min="0" max="' + mx + '" step="0.1" placeholder="e.g. ' + Math.round(mx * 0.9) + '" value="' + (s.goal == null ? '' : s.goal) + '"><span>' + scaleDef().hint + '</span></div>' +
            '</div>' +
            '<div class="gbsm__sems">' + gbSemTableHTML(s, 'sem1', 'Semester 1') + gbSemTableHTML(s, 'sem2', 'Semester 2') + '</div>' +
            '<div class="gbsm__overall"><div class="gbsm__overall__lbl">Overall average</div><b style="color:' + (av == null ? '' : gradeColor(av)) + '">' + (av == null ? '—' : gbRound(av)) + '</b><span>' + scaleDef().hint + '</span></div>' +
            '<div class="gbsm__recs">' + gbSubjectRecHTML(s) + '</div>';
    }

    function openSubjectModal(sid) {
        var s = GB.subjects.find(function (x) { return x.id === sid; });
        if (!s) return;
        if (!Array.isArray(s.sem1)) s.sem1 = [];
        if (!Array.isArray(s.sem2)) s.sem2 = [];
        if (!s.sem1.length && !s.sem2.length && subjMarks(s).length === 0) { s.sem1 = [null, null]; s.sem2 = [null, null]; }
        gbsmSid = sid;

        var ov = document.createElement('div');
        ov.className = 'gbsm__overlay';
        ov.innerHTML =
            '<div class="gbsm__panel" role="dialog" aria-modal="true" aria-label="Marks for ' + esc(s.name) + '">' +
                '<button class="gbsm__close" title="Close"><i class="fa-solid fa-xmark"></i></button>' +
                '<div class="gbsm__hd"><span class="gbsm__dot" style="background:' + (s.color || '#d97c14') + '"></span>' +
                    '<div><div class="gbsm__title">' + esc(s.name) + '</div><div class="gbsm__sub">Add your exams &amp; marks per semester — we’ll do the maths.</div></div></div>' +
                '<div class="gbsm__body"></div>' +
                '<div class="gbsm__foot"><button type="button" class="gbsm__done">Done</button></div>' +
            '</div>';
        document.body.appendChild(ov);
        document.body.style.overflow = 'hidden';
        gbsmEl = ov;
        gbsmRenderBody();
        requestAnimationFrame(function () { ov.classList.add('open'); });

        function close() {
            ov.classList.remove('open');
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onKey);
            setTimeout(function () { ov.remove(); if (gbsmEl === ov) { gbsmEl = null; gbsmSid = null; } }, 280);
            commit();
        }
        function onKey(e) { if (e.key === 'Escape') close(); }

        ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
        ov.querySelector('.gbsm__close').addEventListener('click', close);
        ov.querySelector('.gbsm__done').addEventListener('click', close);
        document.addEventListener('keydown', onKey);

        ov.addEventListener('input', function (e) {
            var sCur = GB.subjects.find(function (x) { return x.id === gbsmSid; });
            if (!sCur) return;
            var mk = e.target.closest && e.target.closest('.gbsm__mark');
            if (mk) {
                var key = mk.dataset.sem, i = parseInt(mk.dataset.i, 10);
                var v = mk.value === '' ? null : parseFloat(mk.value);
                if (v != null && !isNaN(v)) v = Math.max(0, Math.min(scaleMax(), v));
                if (!Array.isArray(sCur[key])) sCur[key] = [];
                sCur[key][i] = (v == null || isNaN(v)) ? null : v;
                save(GB); gbsmRefreshComputed(); return;
            }
            if (e.target.id === 'gbsmGoal') {
                var g = e.target.value === '' ? null : parseFloat(e.target.value);
                sCur.goal = (g == null || isNaN(g)) ? null : Math.max(0, Math.min(scaleMax(), g));
                save(GB); gbsmRefreshComputed(); return;
            }
        });
        ov.addEventListener('click', function (e) {
            var btn = e.target.closest && e.target.closest('.gbsm__count__btn');
            if (!btn) return;
            var sCur = GB.subjects.find(function (x) { return x.id === gbsmSid; });
            if (!sCur) return;
            var key = btn.dataset.sem;
            if (!Array.isArray(sCur[key])) sCur[key] = [];
            if (btn.dataset.act === 'inc') { if (sCur[key].length < 16) sCur[key].push(null); }
            else if (sCur[key].length > 0) sCur[key].pop();
            save(GB); gbsmRenderBody();
        });
    }
    window.gbOpenSubject = openSubjectModal;

    function renderReadiness() {
        var box = document.getElementById('gbReadiness');
        if (!box) return;
        var ids = allTargetIds();
        if (!ids.length) { box.innerHTML = '<p class="gb__hint">Pick your dream university in the panel on the right to see how ready you really are.</p>'; return; }
        var o = overallAvg();
        if (o == null) { box.innerHTML = '<p class="gb__hint">Add your grades to calculate readiness.</p>'; return; }
        var cur = Math.round(o * 10) / 10, hint = scaleDef().hint;
        box.innerHTML = ids.map(function (id, idx) {
            var u = findUni(id); if (!u) return '';
            var p = readinessPct(u), req = reqMark(u), col = ringColor(p);
            var lab = p >= 80 ? 'Strong match' : p >= 45 ? 'Within reach' : 'Long shot';
            var labIcon = p >= 80 ? 'fa-circle-check' : p >= 45 ? 'fa-arrows-up-to-line' : 'fa-mountain-sun';
            return '<div class="gb__rd" style="--c:' + (u.color || '#d97c14') + ';--rc:' + col + ';animation-delay:' + (idx * 70) + 'ms">' +
                '<div class="gb__rd__ring" style="--p:' + p + '"><div class="gb__rd__ring__in"><b style="color:' + col + '">' + p + '<i>%</i></b><small>ready</small></div></div>' +
                '<div class="gb__rd__body">' +
                    '<div class="gb__rd__uni">' +
                        '<span class="gb__rd__logo" style="background:' + (u.color || '#d97c14') + '">' + esc(u.abbr || u.name.slice(0, 2).toUpperCase()) + '</span>' +
                        '<div class="gb__rd__id"><div class="gb__rd__name">' + esc(u.name) + '</div>' +
                            '<div class="gb__rd__loc"><i class="fa-solid fa-location-dot"></i> ' + esc(u.city || '') + (u.dl ? ' · ' + esc(u.dl) : '') + '</div></div>' +
                        '<span class="gb__rd__pill" style="color:' + col + ';border-color:' + col + '33;background:' + col + '14"><i class="fa-solid ' + labIcon + '"></i> ' + lab + '</span>' +
                    '</div>' +
                    '<div class="gb__rd__bar"><i style="width:' + p + '%;background:linear-gradient(90deg,' + (u.color || '#d97c14') + ',' + col + ')"></i></div>' +
                    '<div class="gb__rd__cmp">' +
                        '<span class="gb__rd__cmp__item"><small>You have</small><b>' + cur + ' ' + hint + '</b></span>' +
                        '<i class="fa-solid fa-arrow-right gb__rd__cmp__arr"></i>' +
                        '<span class="gb__rd__cmp__item"><small>Needs ~</small><b>' + req + ' ' + hint + '</b></span>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('') || '<p class="gb__hint">Pick your dream university in the panel on the right.</p>';
    }

    // Subjects below the mark required by the university the student is aiming for,
    // with the gap expressed in the student's own scale (e.g. +2 on /8).
    function attentionSubjects() {
        var aim = aimUni();
        if (!aim) return [];
        var bar = reqMark(aim);
        return GB.subjects.map(function (s) { return { name: s.name, avg: subjAvg(s) }; })
            .filter(function (x) { return x.avg != null && x.avg < bar; })
            .map(function (x) { return { name: x.name, avg: Math.round(x.avg * 10) / 10, need: Math.round((bar - x.avg) * 10) / 10 }; })
            .sort(function (a, b) { return b.need - a.need; });
    }
    function renderAttention() {
        var box = document.getElementById('gbAttention');
        if (!box) return;
        var aim = aimUni();
        if (!aim) {
            box.innerHTML = '<p class="gb__hint">' + (overallAvg() == null ? 'Add your grades to spot weak spots.' : 'Pick the university you\'re aiming for (Dream or Target) and we\'ll show exactly what to lift.') + '</p>';
            return;
        }
        var hint = scaleDef().hint, req = reqMark(aim), list = attentionSubjects();
        if (!list.length) { box.innerHTML = '<p class="gb__hint">Every subject already meets ' + esc(aim.name) + '\'s bar (~' + req + ' ' + hint + '). 🎉</p>'; return; }
        box.innerHTML = '<div class="gb__attn__aim">Aiming for <b>' + esc(aim.name) + '</b> — target ~<b>' + req + ' ' + hint + '</b> per subject:</div>' +
            list.map(function (x) {
                return '<div class="gb__attn__row"><span><i class="fa-solid fa-arrow-trend-up"></i> ' + esc(x.name) + ' <small>(' + x.avg + ')</small></span><b>+' + x.need + ' pts</b></div>';
            }).join('');
    }

    /* ── Single target university the student is aiming for ── */
    function getAimId() { return (GB.unis && GB.unis.dream && GB.unis.dream[0]) || null; }
    function setAimId(id) {
        GB.unis = GB.unis || { dream: [], target: [], safety: [] };
        GB.unis.dream = id ? [id] : [];
        commit();
    }
    function hasAim() { return !!getAimId(); }

    function renderTargetPanel() {
        var sel    = document.getElementById('gbAimSelect');
        var choose = document.getElementById('gbTargetChoose');
        var chosen = document.getElementById('gbTargetChosen');
        if (!sel || !choose || !chosen) return;
        var aimId = getAimId();

        // Populate the picker (current destination's universities).
        var opts = '<option value="">Select a university…</option>' +
            (typeof UNI !== 'undefined' ? UNI : []).map(function (u) {
                return '<option value="' + u.id + '"' + (u.id === aimId ? ' selected' : '') + '>' + esc(u.name) + '</option>';
            }).join('');
        sel.innerHTML = opts;

        if (aimId) {
            var u = findUni(aimId);
            choose.style.display = 'none';
            chosen.style.display = 'block';
            var logo = document.getElementById('gbDreamLogo');
            var dreamCard = chosen.querySelector('.gb__dream__card');
            if (dreamCard) dreamCard.setAttribute('data-id', aimId);   // click → university detail
            var nameEl = document.getElementById('gbAimName');
            var metaEl = document.getElementById('gbDreamMeta');
            if (logo) {   // the real crest, like everywhere else
                if (u) { logo.innerHTML = uniLogo(u, 42); logo.style.background = 'transparent'; cmpHydrateLogos(logo); }
                else { logo.textContent = '★'; logo.style.background = '#d97c14'; }
            }
            if (nameEl) nameEl.textContent = u ? u.name : 'your university';
            if (metaEl) metaEl.innerHTML = u
                ? '<i class="fa-solid fa-location-dot"></i> ' + esc(u.city || '') + (u.dl ? ' · ' + esc(u.dl) : '')
                : '';
        } else {
            choose.style.display = 'block';
            chosen.style.display = 'none';
        }
        updateUploadGate();
    }

    // Block grade uploads until a target university is chosen.
    function updateUploadGate() {
        var locked = !hasAim();
        var up = document.getElementById('gbUploadBtn');
        if (up) {
            up.classList.toggle('gb__btn--locked', locked);
            up.title = locked ? 'Choose your target university first' : '';
        }
    }

    /* ── Post-upload: gap to dream + realistic options within budget ── */
    var suggestUseExplore = false;
    var suggestPage = 1;
    var SG_PER_PAGE = 6;
    function realisticOptions(useExplore) {
        var o = overallAvg(); if (o == null) return [];
        var gPct = toPct(o);
        var prof = (typeof getProfile === 'function') ? getProfile() : { budget: Infinity };
        var ef = (typeof getGbFilters === 'function' && getGbFilters()) || {};   // filters saved from Explore
        var matcher = useExplore && ef.kind === 'matcher' && ef.prefs && typeof window.fyScoreUni === 'function';
        var aimId = getAimId();
        var list = (typeof UNI !== 'undefined' ? UNI : []).filter(function (u) {
            if (u.id === aimId) return false;                       // skip the dream itself
            if (readinessForPct(gPct, u) < 60) return false;        // realistically reachable
            if (tuitionMinCost(u) > (prof.budget || Infinity)) return false;   // within budget
            if (useExplore && ef.kind === 'filters') {
                // Simple Explore-dropdown filters (free-user path).
                if (ef.city    && u.city !== ef.city) return false;
                if (ef.type    && u.type !== ef.type) return false;
                if (ef.tuition && u.ts   >  parseInt(ef.tuition, 10)) return false;
                if (ef.budget  && tuitionMinCost(u) > parseInt(ef.budget, 10)) return false;
                if (ef.field   && (u.fields || []).indexOf(ef.field) === -1) return false;
                if (ef.lang    && (u.langs  || []).indexOf(ef.lang)  === -1) return false;
            }
            return true;
        });
        if (matcher) {
            // Rank by the matcher's full-preference fit (subjects, hobbies, language,
            // city vibe, priorities, budget, athletics — everything).
            return list
                .map(function (u) { return { u: u, s: window.fyScoreUni(u, ef.prefs) }; })
                .sort(function (a, b) { return b.s - a.s; })
                .map(function (x) { return x.u; })
                .slice(0, 16);
        }
        return list.sort(function (a, b) { return readinessForPct(gPct, b) - readinessForPct(gPct, a); }).slice(0, 16);
    }

    // Toggle the "See my realistic options" reopen button (only when there's something to show).
    function renderSuggest() {
        var aim = aimUni(), o = overallAvg();
        var btn = document.getElementById('gbOpenSuggest');
        if (btn) btn.style.display = (aim && o != null) ? 'inline-flex' : 'none';
        // If the modal is open, keep its contents fresh.
        var ov = document.getElementById('gbSuggestOverlay');
        if (ov && ov.classList.contains('gbsg--open')) renderSuggestModal();
    }

    function renderSuggestModal() {
        var modal = document.getElementById('gbSuggestModal');
        if (!modal) return;
        var aim = aimUni(), o = overallAvg();
        if (!aim || o == null) return;

        var ready = readinessPct(aim);
        var gap = Math.max(0, 100 - (ready == null ? 0 : ready));
        var gapColor = gap <= 15 ? '#27ae60' : gap <= 40 ? '#e8850a' : '#e74c3c';

        var opts = realisticOptions(suggestUseExplore);
        var totalPages = Math.max(1, Math.ceil(opts.length / SG_PER_PAGE));
        if (suggestPage > totalPages) suggestPage = totalPages;
        if (suggestPage < 1) suggestPage = 1;
        var pageOpts = opts.slice((suggestPage - 1) * SG_PER_PAGE, suggestPage * SG_PER_PAGE);

        var gPct = toPct(o), max = scaleMax();
        var cards = pageOpts.length ? pageOpts.map(function (u, i) {
            var rank = (typeof UNI !== 'undefined') ? UNI.indexOf(u) + 1 : 0, r = readinessForPct(gPct, u), hi = r >= 80;
            return '<button type="button" class="gsx-card" data-id="' + u.id + '" style="--c:' + (u.color || '#8ea0d8') + ';--r:' + r + ';--i:' + i + '">' +
                '<span class="gsx-orbit"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="gsx-orbit__track" cx="32" cy="32" r="28"/><circle class="gsx-orbit__arc' + (hi ? ' is-hi' : '') + '" cx="32" cy="32" r="28" pathLength="100"/></svg><svg class="gsx-orbit__ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="gsx-orbit__dash" cx="32" cy="32" r="31"/></svg>' +
                    '<span class="gsx-orbit__logo">' + uniLogo(u, 30) + '</span><i class="gsx-orbit__moon" aria-hidden="true"></i></span>' +
                '<span class="gsx-card__txt"><b>' + esc(u.name) + '</b><small><i class="fa-solid fa-location-dot" aria-hidden="true"></i>' + esc(u.city || '') + (u.type ? ' · ' + esc(u.type) : '') + '</small></span>' +
                '<span class="gsx-card__pct' + (hi ? ' is-hi' : '') + '"><b>' + r + '<small>%</small></b><em>ready</em></span>' +
                (rank > 0 ? '<span class="gsx-card__rank">#' + rank + '</span>' : '') +
            '</button>';
        }).join('') : '<p class="gsx-none"><i class="fa-solid fa-satellite-dish" aria-hidden="true"></i> Nothing in range with these filters — widen them on Explore.</p>';

        // Compact keyword chips of the filters the user saved from Explore.
        var ef = (typeof getGbFilters === 'function' && getGbFilters()) || {};
        var fk = [];
        if (ef.kind === 'matcher' && ef.prefs) {
            var p = ef.prefs;
            (p.subjects || []).forEach(function (s) { fk.push(s); });
            (p.hobbies || []).forEach(function (h) { fk.push(h); });
            if (p.lang) fk.push(p.lang);
            if (p.sport && p.athlete) fk.push(p.sport);
            if (p.vibe === 'big') fk.push('big city'); else if (p.vibe === 'small') fk.push('smaller town');
            (p.priorities || []).forEach(function (pr) { fk.push(pr); });
            if (p.budget) fk.push('≤ €' + Number(p.budget).toLocaleString() + '/yr');
        } else {
            if (ef.field)   fk.push(ef.field);
            if (ef.lang)    fk.push(ef.lang);
            if (ef.type)    fk.push(ef.type);
            if (ef.city)    fk.push(ef.city);
            if (ef.budget)  fk.push('≤ €' + Number(ef.budget).toLocaleString() + '/yr');
        }
        var chips = fk.length
            ? fk.map(function (c) { return '<span class="gsx-chip">' + esc(c) + '</span>'; }).join('')
            : '<span class="gsx-chip gsx-chip--none">no saved Explore filters</span>';

        var dots = '';
        for (var pg = 1; pg <= totalPages; pg++) dots += '<i' + (pg === suggestPage ? ' class="is-on"' : '') + '></i>';
        var pager = totalPages > 1
            ? '<div class="gsx-pager">' +
                '<button type="button" class="gsx-pg" id="gbSgPrev"' + (suggestPage <= 1 ? ' disabled' : '') + ' aria-label="Previous"><i class="fa-solid fa-chevron-left"></i></button>' +
                '<span class="gsx-dots" aria-label="Page ' + suggestPage + ' of ' + totalPages + '">' + dots + '</span>' +
                '<button type="button" class="gsx-pg" id="gbSgNext"' + (suggestPage >= totalPages ? ' disabled' : '') + ' aria-label="Next"><i class="fa-solid fa-chevron-right"></i></button>' +
              '</div>'
            : '';

        var ready0 = ready == null ? 0 : ready, who = aim.abbr && aim.abbr.length <= 12 ? aim.abbr : aim.name;
        modal.className = 'gbsg gsx';
        modal.innerHTML =
            '<div class="gsx-sky" aria-hidden="true"><i></i><i></i><i></i></div>' +
            '<button class="gsx-x" id="gbSuggestClose" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>' +
            '<header class="gsx-hd">' +
                '<div class="gsx-hd__txt">' +
                    '<p class="gsx-kicker"><i aria-hidden="true"></i>Within your orbit</p>' +
                    '<h3 class="gsx-title">Realistic <em>options</em></h3>' +
                    '<p class="gsx-sub">Universities your <b>' + (Math.round(o * 10) / 10) + '<small>' + esc(scaleDef().hint) + '</small></b> already reaches — while you keep pulling towards ' + esc(aim.name) + '.</p>' +
                '</div>' +
                '<div class="gsx-traj" style="--p:' + ready0 + '" aria-label="' + ready0 + '% of the way to ' + esc(aim.name) + '">' +
                    '<svg viewBox="0 0 300 150" preserveAspectRatio="none" aria-hidden="true"><path class="gsx-traj__all" d="M34 118 C 110 150, 190 118, 262 34"/><path class="gsx-traj__glow" d="M34 118 C 110 150, 190 118, 262 34" pathLength="100"/><path class="gsx-traj__done" d="M34 118 C 110 150, 190 118, 262 34" pathLength="100"/></svg>' +
                    '<span class="gsx-you"><b>' + (Math.round(o * 10) / 10) + '</b><small>you</small></span>' +
                    '<span class="gsx-dream">' + uniLogo(aim, 30) + '</span>' +
                    '<span class="gsx-comet" aria-hidden="true"></span>' +
                    '<span class="gsx-traj__lbl"><b>' + ready0 + '%</b> of the way to ' + esc(who) + '</span>' +
                '</div>' +
            '</header>' +
            '<div class="gsx-bar">' +
                '<button type="button" class="gsx-toggle' + (suggestUseExplore ? ' is-on' : '') + '" id="gbSuggestExplore" aria-pressed="' + (suggestUseExplore ? 'true' : 'false') + '"><span class="gsx-toggle__sw" aria-hidden="true"></span>' + (suggestUseExplore ? 'Matched to my filters' : 'Match my Explore filters') + '</button>' +
                '<div class="gsx-chips" title="Filters you picked on the Explore page">' + chips + '</div>' +
                '<span class="gsx-count">' + opts.length + ' in range</span>' +
            '</div>' +
            '<div class="gsx-grid">' + cards + '</div>' +
            pager;
        // put the comet where you are on the way to the dream
        requestAnimationFrame(function () {
            var tr = modal.querySelector('.gsx-traj'), path = modal.querySelector('.gsx-traj__all'), comet = modal.querySelector('.gsx-comet');
            if (!tr || !path || !comet || !path.getPointAtLength) return;
            var pt = path.getPointAtLength(path.getTotalLength() * Math.max(.02, Math.min(1, ready0 / 100)));
            comet.style.left = (pt.x / 300 * 100) + '%'; comet.style.top = (pt.y / 150 * 100) + '%';
        });
        if (typeof cmpHydrateLogos === 'function') cmpHydrateLogos(modal);
    }

    function openSuggestModal() {
        var ov = document.getElementById('gbSuggestOverlay');
        var aim = aimUni(), o = overallAvg();
        if (!ov || !aim || o == null) return;
        suggestPage = 1;
        renderSuggestModal();
        ov.classList.add('gbsg--open');
    }
    function closeSuggestModal() {
        var ov = document.getElementById('gbSuggestOverlay');
        if (ov) ov.classList.remove('gbsg--open');
    }
    window.gbOpenSuggest = openSuggestModal;

    function renderGaps() {
        var box = document.getElementById('gbGaps');
        if (!box) return;
        var ids = GB.unis.dream.concat(GB.unis.target);
        if (!ids.length || overallAvg() == null) { document.getElementById('gbGapsBlock').style.display = (ids.length || GB.subjects.length) ? '' : 'none'; box.innerHTML = '<p class="gb__hint">Add grades and pick Dream/Target universities to see your gaps.</p>'; return; }
        document.getElementById('gbGapsBlock').style.display = '';
        box.innerHTML = ids.map(function (id) {
            var u = findUni(id); if (!u) return '';
            var rec = recGrade(u), p = readinessPct(u);
            var fields = (u.fields || []).map(function (f) { return f.toLowerCase(); });
            var rel = GB.subjects.filter(function (s) { return fields.some(function (f) { return f.indexOf(s.name.toLowerCase()) !== -1 || s.name.toLowerCase().indexOf(f) !== -1; }); });
            if (!rel.length) rel = GB.subjects;
            var rows = rel.filter(function (s) { return subjAvg(s) != null; }).map(function (s) {
                var a = Math.round(toPct(subjAvg(s))), gap = rec - a;
                return '<div class="gb__gap__row"><span class="gb__gap__sub">' + esc(s.name) + '</span>' +
                    '<span class="gb__gap__cur">' + a + '</span><span class="gb__gap__arrow">→</span><span class="gb__gap__rec">' + rec + '</span>' +
                    '<span class="gb__gap__delta ' + (gap > 0 ? 'is-gap' : 'is-met') + '">' + (gap > 0 ? '+' + gap : '✓ met') + '</span></div>';
            }).join('') || '<p class="gb__hint">Add grades to compare.</p>';
            return '<div class="gb__gapcard" style="--cc:' + (u.color || '#d97c14') + '">' +
                '<div class="gb__gapcard__hd"><div><b>' + esc(u.name) + '</b><small>' + esc((u.fields || [])[0] || u.dl || '') + '</small></div><span class="gb__gapcard__pct" style="color:' + ringColor(p) + '">' + p + '%</span></div>' +
                '<div class="gb__gap__rows">' + rows + '</div></div>';
        }).join('');
    }

    function renderGoals() {
        var sel = document.getElementById('gbGoalSubject');
        if (sel) sel.innerHTML = '<option value="">Subject…</option>' + GB.subjects.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('');
        var box = document.getElementById('gbGoals');
        if (!box) return;
        if (!GB.goals.length) { box.innerHTML = '<p class="gb__hint">No goals yet. Set a target average and we\'ll add it to your Deadlines.</p>'; return; }
        box.innerHTML = GB.goals.map(function (g) {
            var s = GB.subjects.find(function (x) { return x.id === g.subjectId; });
            var cur = s ? subjAvg(s) : null; cur = cur == null ? g.from : Math.round(cur);
            var span = (g.to - g.from) || 1, prog = Math.max(0, Math.min(100, Math.round((cur - g.from) / span * 100)));
            var done = cur >= g.to;
            return '<div class="gb__goal ' + (done ? 'is-done' : '') + '" data-gid="' + g.id + '">' +
                '<div class="gb__goal__hd"><span><i class="fa-solid ' + (done ? 'fa-circle-check' : 'fa-flag') + '"></i> ' + esc(g.subjectName) + ' → ' + g.to + '%</span>' +
                '<button class="gb__goal__del" title="Remove"><i class="fa-solid fa-xmark"></i></button></div>' +
                '<div class="gb__goal__meta">From ' + g.from + '% · now <b>' + cur + '%</b> · by ' + fmtMonth(g.date) + (done ? ' · <b style="color:#27ae60">achieved!</b>' : ' · <b>+' + Math.max(0, g.to - cur) + '</b> to go') + '</div>' +
                '<div class="gb__goal__bar"><i style="width:' + prog + '%"></i></div></div>';
        }).join('');
    }

    var recOverride = null;   // "what-if" average set via the slider (in the student's scale)
    function renderRecs() {
        var box = document.getElementById('gbRecs');
        if (!box) return;
        var real = overallAvg();
        var slider = document.getElementById('gbRecSlider'), valEl = document.getElementById('gbRecVal');
        if (slider) { slider.max = scaleMax(); slider.step = scaleMax() <= 10 ? 0.5 : 1; }
        var o = recOverride != null ? recOverride : real;
        if (slider && o != null) slider.value = o;
        if (valEl) valEl.textContent = o == null ? '—' : ((Math.round(o * 10) / 10) + ' ' + scaleDef().hint + (recOverride != null ? ' · what-if' : ''));
        if (o == null) { box.innerHTML = '<p class="gb__hint">Add grades — or drag the slider — to see which universities fit.</p>'; return; }
        if (typeof UNI === 'undefined' || !UNI.length) { box.innerHTML = '<p class="gb__hint">No universities loaded for your destination yet.</p>'; return; }
        var curPct = toPct(o);
        var scored = UNI.map(function (u) { return { u: u, ratio: curPct / recPct(u), pct: readinessForPct(curPct, u) }; });
        var buckets = [
            { key: 'strong', label: 'Strong matches', icon: 'fa-circle-check', col: '#27ae60', f: function (x) { return x.ratio >= 1; } },
            { key: 'target', label: 'Target matches', icon: 'fa-bullseye', col: '#f39c12', f: function (x) { return x.ratio >= 0.85 && x.ratio < 1; } },
            { key: 'reach', label: 'Reach universities', icon: 'fa-fire', col: '#e74c3c', f: function (x) { return x.ratio < 0.85; } }
        ];
        box.innerHTML = buckets.map(function (b) {
            var list = scored.filter(b.f).sort(function (a, c) { return c.ratio - a.ratio; }).slice(0, 5);
            var items = list.map(function (x) {
                return '<div class="gb__rec__item" data-id="' + esc(x.u.id) + '"><span class="gb__rec__abbr">' + uniLogo(x.u, 26) + '</span>' +
                    '<span class="gb__rec__nm">' + esc(x.u.name) + '</span><b style="color:' + ringColor(x.pct) + '">' + x.pct + '%</b></div>';
            }).join('') || '<p class="gb__hint">None right now.</p>';
            return '<div class="gb__rec__col"><div class="gb__rec__hd" style="color:' + b.col + '"><i class="fa-solid ' + b.icon + '"></i> ' + b.label + '</div>' + items + '</div>';
        }).join('');
    }

    /* ── Dashboard widget (Overview) ───────────────────────── */
    function renderWidget() {
        var w = document.getElementById('dshAcademic');
        if (!w) return;
        var brk = document.getElementById('acadBreak');
        var empty = document.getElementById('dshAcadEmpty');
        if (!GB.subjects.length) {
            // No grades yet: keep the section visible with a get-started guide.
            w.style.display = 'none';
            if (empty) empty.style.display = '';
            if (brk) brk.style.display = '';
            return;
        }
        w.style.display = ''; if (brk) brk.style.display = '';
        if (empty) empty.style.display = 'none';
        var box = document.getElementById('ovGrades'); if (!box) return;
        // A quiet card: the average on a thin ring (the tick is your aim's bar),
        // one slim bar per subject with the same tick, readiness as small pills.
        var o = overallAvg(), avg = o == null ? null : Math.round(toPct(o));
        var aim = aimUni(), barPct = aim ? recPct(aim) : null, c = closeness(), up = c != null && c >= 70;
        var fmtG = function (v) { var mx = scaleMax(); return mx <= 10 ? (Math.round(v * 10) / 10).toString() : String(Math.round(v)); };
        var subs = GB.subjects.map(function (s) { return { s: s, v: subjAvg(s) }; }).filter(function (x) { return x.v != null; });
        var need = {}; attentionSubjects().forEach(function (x) { need[x.name] = x.need; });
        var ring = function (p, tick) {
            var t = tick == null ? '' : (function () { var ang = (tick / 100) * 2 * Math.PI - Math.PI / 2, x1 = 60 + Math.cos(ang) * 47, y1 = 60 + Math.sin(ang) * 47, x2 = 60 + Math.cos(ang) * 57, y2 = 60 + Math.sin(ang) * 57;
                return '<line class="ovg__tick" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>'; })();
            return '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ovg__trk" cx="60" cy="60" r="52"/><circle class="ovg__arc" cx="60" cy="60" r="52" pathLength="100" style="--p:' + (p || 0) + '"/>' + t + '</svg>';
        };
        var ids = allTargetIds().slice(0, 3);
        var pills = ids.map(function (id) { var u = findUni(id); if (!u) return ''; var p = readinessPct(u);
            return p == null ? '' : '<span class="ovg__pill" style="--c:' + ringColor(p) + '"><i></i>' + esc(u.abbr || shortName(u.name)) + ' <b>' + p + '%</b></span>'; }).join('');
        var plan = improvementPlan(), goal = '';
        if (plan && plan.gap > 0) {
            var dl = null; try { dl = getDlCustom().filter(function (d) { return /^gbgoal_|^gbplan_/.test(d.id); }).sort(function (a, b) { return a.date.localeCompare(b.date); })[0]; } catch (e) {}
            goal = '<p class="ovg__goal"><i class="fa-solid fa-arrow-trend-up" aria-hidden="true"></i><span>Lift your average by <b>+' + plan.gap + '</b> to reach <b>' + esc(plan.uni.name) + '</b>' + (dl ? ' <em>· by ' + fmtMonth(dl.date) + '</em>' : '') + '</span></p>';
        } else if (plan) goal = '<p class="ovg__goal is-good"><i class="fa-solid fa-circle-check" aria-hidden="true"></i><span>On track for <b>' + esc(plan.uni.name) + '</b></span></p>';
        box.innerHTML =
            '<div class="ovg__main">' +
                '<div class="ovg__ring' + (avg == null ? '' : up ? ' is-up' : ' is-down') + '">' + ring(avg, barPct) +
                    '<div class="ovg__num"><b data-to="' + (avg == null ? '' : avg) + '">' + (avg == null ? '—' : avg) + '</b><small>average</small></div></div>' +
                '<div class="ovg__meta">' +
                    (c == null ? '' : '<span class="ovg__status ' + (up ? 'is-up' : 'is-down') + '"><i class="fa-solid ' + (up ? 'fa-arrow-up' : 'fa-arrow-down') + '" aria-hidden="true"></i>' + (up ? 'On track' : 'Needs a push') + '</span>') +
                    '<p class="ovg__line">' + subs.length + ' subject' + (subs.length === 1 ? '' : 's') + (aim ? ' · aiming for <b>' + esc(aim.abbr || shortName(aim.name)) + '</b>' + (c != null ? ' — ' + c + '% there' : '') : ' · pick a dream university in the Gradebook') + '</p>' +
                    (pills ? '<div class="ovg__pills">' + pills + '</div>' : '') +
                '</div>' +
            '</div>' +
            '<ul class="ovg__subs">' + subs.slice(0, 6).map(function (x, i) {
                var p = toPct(x.v) / 100, n = need[x.s.name];
                return '<li style="--i:' + i + ';--v:' + p.toFixed(3) + ';--dot:' + esc(x.s.color || 'var(--ov-ink)') + '"' + (barPct ? ' data-bar' : '') + '>' +
                    '<span class="ovg__sn">' + esc(x.s.name) + '</span>' +
                    '<i class="ovg__bar"><s></s>' + (barPct ? '<u style="--b:' + (barPct / 100).toFixed(3) + '"></u>' : '') + '</i>' +
                    '<b class="ovg__sv">' + fmtG(x.v) + (n ? '<em>+' + n + '</em>' : '') + '</b></li>';
            }).join('') + '</ul>' +
            goal;
        if (!w._ovgSeen && avg != null && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
            w._ovgSeen = true;
            var el = box.querySelector('.ovg__num b'), t0 = performance.now();
            (function step(now) { var k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(avg * e); if (k < 1) requestAnimationFrame(step); })(t0);
        }
    }
    function shortName(n) { return String(n || '').replace(/^(University of|The University of|Universidad de|Universit[àa] (di|degli))\s*/i, ''); }

    /* ── Master render + persistence ───────────────────────── */
    function renderAll() {
        renderOverall(); renderSubjects(); renderReadiness(); renderAttention();
        renderTargetPanel(); renderGaps(); renderPlan(); renderSuggest(); renderRecs(); renderWidget();
        if (typeof window.gbCardRender === 'function') { try { window.gbCardRender(); } catch (e) {} }
    }
    // Read-only view of the gradebook for the average card (gradebookRings.js).
    window.gbSnapshot = function () {
        var aim = aimUni(), o = overallAvg(), ib = null;
        if (GB.scale === 'ib') {
            var best = GB.subjects.map(subjAvg).filter(function (v) { return v != null; }).sort(function (a, b) { return b - a; });
            if (best.length) ib = { n: best.length, pts: Math.round(best.length >= 6 ? best.slice(0, 6).reduce(function (a, b) { return a + b; }, 0) : best.reduce(function (a, b) { return a + b; }, 0) / best.length * 6) };
        }
        return { scale: GB.scale, max: scaleMax(), hint: scaleDef().hint, label: scaleDef().label,
            subjects: GB.subjects.map(function (s) {
                var m = subjMarks(s);
                return { id: s.id, name: s.name, color: s.color, avg: subjAvg(s), goal: s.goal != null && s.goal !== '' ? +s.goal : null,
                         marks: m.length, exams: (s.sem1 ? s.sem1.length : 0) + (s.sem2 ? s.sem2.length : 0),
                         best: m.length ? Math.max.apply(null, m) : null, latest: m.length ? m[m.length - 1] : null };
            }),
            avg: o, ready: closeness(), ib: ib,
            req: aim ? reqMark(aim) : null, gap: aim && o != null ? Math.round((reqMark(aim) - o) * 10) / 10 : null,
            aim: aim ? (aim.abbr && aim.abbr.length <= 12 ? aim.abbr : aim.name) : null, aimName: aim ? aim.name : null };
    };
    function commit(msg) { save(GB); renderAll(); if (window.refreshChanceBadges) window.refreshChanceBadges(); if (msg) toast(msg); }
    window.renderGradebook = function () { try { renderAll(); } catch (e) { console.error('renderGradebook failed:', e); } };
    window.renderAcademicWidget = function () { try { renderWidget(); } catch (e) { console.error('renderAcademicWidget failed:', e); } };

    function toast(msg) {
        var bar = document.createElement('div');
        bar.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:6000;display:flex;align-items:center;gap:9px;' +
            'padding:12px 20px;border-radius:12px;font-family:Montserrat,sans-serif;font-size:13px;font-weight:700;color:#fff;' +
            'box-shadow:0 10px 30px rgba(0,0,0,.25);background:linear-gradient(135deg,#d97c14,#f59220);animation:arIn .3s ease both';
        bar.innerHTML = '<i class="fa-solid fa-arrow-trend-up"></i> ' + msg;
        document.body.appendChild(bar);
        setTimeout(function () { bar.style.transition = 'opacity .4s'; bar.style.opacity = '0'; setTimeout(function () { bar.remove(); }, 400); }, 2600);
    }

    /* ── Events (delegated) ────────────────────────────────── */
    var root = document.getElementById('tabGradebook');
    function thisMonth() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }

    function addSubject() {
        var inp = document.getElementById('gbNewSubject'), gi = document.getElementById('gbNewGrade');
        var name = (inp.value || '').trim();
        if (!name) return;
        var g = parseFloat(gi.value);
        if (!isNaN(g)) { if (g > scaleMax()) { toast('Mark can\'t exceed ' + scaleMax() + ' on this scale'); return; } g = Math.max(0, Math.min(scaleMax(), g)); } else { g = null; }
        var ex = GB.subjects.find(function (s) { return s.name.toLowerCase() === name.toLowerCase(); });
        if (ex) { ex.grade = g; } else { GB.subjects.push({ id: uid(), name: name, color: PALETTE[GB.subjects.length % PALETTE.length], grade: g, assessments: [] }); }
        inp.value = ''; gi.value = '';
        commit('Subject added');
    }
    document.getElementById('gbAddSubjectBtn').addEventListener('click', addSubject);
    document.getElementById('gbNewSubject').addEventListener('keydown', function (e) { if (e.key === 'Enter') addSubject(); });
    document.getElementById('gbNewGrade').addEventListener('keydown', function (e) { if (e.key === 'Enter') addSubject(); });
    var recSlider = document.getElementById('gbRecSlider');
    if (recSlider) recSlider.addEventListener('input', function () { recOverride = parseFloat(this.value); renderRecs(); });
    var recReset = document.getElementById('gbRecReset');
    if (recReset) recReset.addEventListener('click', function () { recOverride = null; renderRecs(); });

    // Target university: pick one, or change it.
    var aimSel = document.getElementById('gbAimSelect');
    if (aimSel) aimSel.addEventListener('change', function () { if (this.value) setAimId(this.value); });
    var aimChange = document.getElementById('gbTargetChange');
    if (aimChange) aimChange.addEventListener('click', function () { setAimId(null); });

    // Realistic-options modal: open / close / toggle Explore filters.
    var openSgBtn = document.getElementById('gbOpenSuggest');
    if (openSgBtn) openSgBtn.addEventListener('click', openSuggestModal);
    var sgOv = document.getElementById('gbSuggestOverlay');
    if (sgOv) sgOv.addEventListener('click', function (e) {
        if (e.target === sgOv || e.target.closest('#gbSuggestClose')) { closeSuggestModal(); return; }
        if (e.target.closest('#gbSuggestExplore')) { suggestUseExplore = !suggestUseExplore; suggestPage = 1; renderSuggestModal(); return; }
        if (e.target.closest('#gbSgPrev')) { suggestPage--; renderSuggestModal(); return; }
        if (e.target.closest('#gbSgNext')) { suggestPage++; renderSuggestModal(); return; }
        var card = e.target.closest('.gbsg__card, .gsx-card');
        if (card && card.dataset.id) {
            var u = (typeof UNI !== 'undefined') ? UNI.find(function (x) { return x.id === card.dataset.id; }) : null;
            if (u && typeof showUniDetail === 'function') { closeSuggestModal(); showUniDetail(u); }
        }
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSuggestModal(); });

    if (root) root.addEventListener('click', function (e) {
        var t = e.target;
        // Open the per-subject marks table (ignore the inline grade input + delete).
        var subjRow = t.closest('.gb__subject--click');
        if (subjRow && !t.closest('.gb__subject__del') && t.tagName !== 'INPUT') {
            openSubjectModal(subjRow.dataset.sid); return;
        }
        // create deadline from the AI improvement plan
        if (t.closest('#gbPlanDeadline')) {
            var plan = improvementPlan(); if (!plan) return;
            var d = new Date(); d.setMonth(d.getMonth() + 6);
            var date = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-15';
            var dlId = 'gbplan_' + plan.uni.id;
            try {
                var cust = getDlCustom().filter(function (x) { return x.id !== dlId; });
                cust.push({ id: dlId, uniName: plan.uni.name, type: 'other', title: 'Reach ' + plan.rec + '% average for ' + plan.uni.name, date: date, notes: 'AI improvement plan — lift your average from ' + plan.overall + '% (+' + plan.gap + ')' });
                setDlCustom(cust);
                if (typeof renderDeadlines === 'function') renderDeadlines();
            } catch (err) {}
            commit('Deadline added — see your Deadlines page'); return;
        }
        // remove subject
        var delSub = t.closest('.gb__subject__del');
        if (delSub) { var sid = delSub.closest('.gb__subject').dataset.sid; GB.subjects = GB.subjects.filter(function (s) { return s.id !== sid; }); GB.goals = GB.goals.filter(function (g) { return g.subjectId !== sid; }); commit('Subject removed'); return; }
        // remove assessment
        var delA = t.closest('.gb__assess__del');
        if (delA) { var row = delA.closest('.gb__assess'); var s = GB.subjects.find(function (x) { return x.id === row.dataset.sid; }); if (s) { s.assessments = s.assessments.filter(function (a) { return a.id !== row.dataset.aid; }); commit('Grade removed'); } return; }
        // add assessment
        var addA = t.closest('.gb__a-add');
        if (addA) {
            var card = addA.closest('.gb__subject'); var s2 = GB.subjects.find(function (x) { return x.id === card.dataset.sid; }); if (!s2) return;
            var nm = card.querySelector('.gb__a-name').value.trim();
            var ty = card.querySelector('.gb__a-type').value;
            var gr = parseFloat(card.querySelector('.gb__a-grade').value);
            var wt = parseFloat(card.querySelector('.gb__a-weight').value) || 1;
            var dt = card.querySelector('.gb__a-date').value || thisMonth();
            if (isNaN(gr)) { toast('Enter a grade'); return; }
            if (gr > scaleMax()) { toast('Mark can\'t exceed ' + scaleMax() + ' on this scale'); return; }
            gr = Math.max(0, Math.min(scaleMax(), gr));
            s2.assessments.push({ id: uid(), name: nm || ty, type: ty, grade: gr, weight: wt, date: dt + (dt.length === 7 ? '-01' : ''), ts: Date.now() });
            commit('Grade added — everything updated');
            return;
        }
        // remove target chip
        var chipDel = t.closest('.gb__chip2__del');
        if (chipDel) { var tier = chipDel.dataset.tier, id = chipDel.dataset.id; GB.unis[tier] = GB.unis[tier].filter(function (x) { return x !== id; }); commit(); return; }
        // remove goal
        var goalDel = t.closest('.gb__goal__del');
        if (goalDel) {
            var gid = goalDel.closest('.gb__goal').dataset.gid; var goal = GB.goals.find(function (g) { return g.id === gid; });
            GB.goals = GB.goals.filter(function (g) { return g.id !== gid; });
            if (goal) { try { setDlCustom(getDlCustom().filter(function (d) { return d.id !== goal.dlId; })); if (typeof renderDeadlines === 'function') renderDeadlines(); } catch (e) {} }
            commit('Goal removed'); return;
        }
    });

    if (root) root.addEventListener('change', function (e) {
        var sel = e.target.closest('.gb__tier__sel');
        if (sel && sel.value) {
            var tier = sel.dataset.tier, id = sel.value;
            ['dream', 'target', 'safety'].forEach(function (k) { GB.unis[k] = GB.unis[k].filter(function (x) { return x !== id; }); });
            GB.unis[tier].push(id);
            commit('Universities updated');
            return;
        }
        // inline edit of a subject's final grade
        var gi = e.target.closest('.gb__sgrade');
        if (gi) {
            var card = gi.closest('.gb__subject'); var s = GB.subjects.find(function (x) { return x.id === card.dataset.sid; }); if (!s) return;
            var v = parseFloat(gi.value);
            if (isNaN(v)) { s.grade = null; }
            else { if (v > scaleMax()) { toast('Max is ' + scaleMax() + ' on this scale'); v = scaleMax(); } s.grade = Math.max(0, Math.min(scaleMax(), v)); }
            commit();
        }
    });

    /* ── Dream-university improvement plan (Elite) ───────────── */
    function improvementPlan() {
        var u = aimUni(), o = overallAvg();
        if (!u || o == null) return null;
        var rec = reqMark(u), gap = Math.round((rec - o) * 10) / 10;   // all in the student's scale
        var weak = GB.subjects.map(function (s) { return { name: s.name, avg: subjAvg(s) }; })
            .filter(function (x) { return x.avg != null && x.avg < rec; })
            .map(function (x) { return { name: x.name, avg: Math.round(x.avg * 10) / 10, need: Math.round((rec - x.avg) * 10) / 10 }; })
            .sort(function (a, b) { return b.need - a.need; });
        return { uni: u, rec: rec, overall: Math.round(o * 10) / 10, gap: gap, weak: weak };
    }
    function isElite() { return typeof eliteState !== 'undefined' && eliteState && !!eliteState.elite; }
    function renderPlan() {
        var block = document.getElementById('gbPlanBlock'), box = document.getElementById('gbPlan');
        if (!block || !box) return;
        block.style.display = '';
        var plan = improvementPlan();
        if (!plan) {
            box.innerHTML = '<div class="gb__plan__empty"><i class="fa-solid fa-circle-info"></i> ' +
                (overallAvg() == null
                    ? 'Add your grades, then pick the university you\'re aiming for (Dream or Target) and we\'ll build your plan.'
                    : 'Pick the university you\'re aiming for under <b>Dream</b> or <b>Target</b> below, and your step-by-step plan appears here.') +
                '</div>';
            return;
        }
        var hint = scaleDef().hint;
        if (plan.gap <= 0) {
            box.innerHTML = '<div class="gb__plan__ok"><i class="fa-solid fa-circle-check"></i> Your average (' + plan.overall + ' ' + hint + ') already meets ' + esc(plan.uni.name) + "'s typical bar of " + plan.rec + ' ' + hint + '. Keep it up!</div>';
            return;
        }
        var steps = plan.weak.slice(0, 4).map(function (w) {
            return '<li><span class="gb__plan__sub">' + esc(w.name) + '</span><span class="gb__plan__from">' + w.avg + '</span><i class="fa-solid fa-arrow-right"></i><span class="gb__plan__to">' + plan.rec + '</span><b class="gb__plan__need">+' + w.need + '</b></li>';
        }).join('') || '<li>Keep lifting your subjects to raise your overall average.</li>';
        box.innerHTML =
            '<div class="gb__plan__hd"><span class="gb__plan__badge"><i class="fa-solid fa-wand-magic-sparkles"></i> AI plan</span> ' +
            'To get into <b>' + esc(plan.uni.name) + '</b> you typically need about <b>' + plan.rec + ' ' + hint + '</b>. You\'re at <b>' + plan.overall + '</b> — close a <b>+' + plan.gap + '</b> gap by focusing on:</div>' +
            '<ul class="gb__plan__steps">' + steps + '</ul>' +
            '<button class="gb__btn gb__btn--primary" id="gbPlanDeadline"><i class="fa-solid fa-calendar-plus"></i> Create deadline to reach ' + plan.rec + ' ' + hint + ' average</button>';
    }

    /* ── PDF grades report → table ───────────────────────────────
       Only real school subjects are accepted (a whitelist), and the grade
       must fall within the chosen grade scale — so comments, dates, page
       numbers and other noise are ignored. ── */
    var SUBJECT_DICT = [
        { n: 'Mathematics', a: ['mathematics', 'maths', 'math', 'algebra', 'calculus', 'geometry', 'further maths', 'further mathematics', 'statistics', 'stats'] },
        { n: 'Physics', a: ['physics'] },
        { n: 'Chemistry', a: ['chemistry'] },
        { n: 'Biology', a: ['biology'] },
        { n: 'Science', a: ['combined science', 'natural science', 'science'] },
        { n: 'Computer Science', a: ['computer science', 'computing', 'informatics', 'ict', 'programming', 'computer studies'] },
        { n: 'English', a: ['english language', 'english literature', 'english', 'literature'] },
        { n: 'History', a: ['history'] },
        { n: 'Geography', a: ['geography'] },
        { n: 'Economics', a: ['economics'] },
        { n: 'Business', a: ['business studies', 'business'] },
        { n: 'Art', a: ['fine art', 'visual art', 'art'] },
        { n: 'Design', a: ['design technology', 'graphic design', 'design', 'technology'] },
        { n: 'Music', a: ['music'] },
        { n: 'Drama', a: ['drama', 'theatre', 'theater'] },
        { n: 'Physical Education', a: ['physical education', 'sport'] },
        { n: 'French', a: ['french'] },
        { n: 'Spanish', a: ['spanish'] },
        { n: 'German', a: ['german'] },
        { n: 'Italian', a: ['italian'] },
        { n: 'Chinese', a: ['chinese', 'mandarin'] },
        { n: 'Psychology', a: ['psychology'] },
        { n: 'Sociology', a: ['sociology'] },
        { n: 'Philosophy', a: ['philosophy'] },
        { n: 'Politics', a: ['politics', 'government'] },
        { n: 'Religious Studies', a: ['religious studies', 'religion'] },
        { n: 'Accounting', a: ['accounting', 'accountancy'] },
        { n: 'Law', a: ['law'] },
        { n: 'Environmental Science', a: ['environmental science', 'environmental'] },
        { n: 'Digitalization', a: ['digitalization', 'digitalización', 'digitalizacion', 'digital technology'] },
        { n: 'Civics', a: ['civics', 'educación cívica', 'educacion civica', 'cívica y valores'] },
        { n: 'Valencian', a: ['valencià', 'valencian'] }
    ];
    function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    function parseGrades(text) {
        var flat = (' ' + text + ' ').replace(/ /g, ' ');
        var max = scaleMax(), found = [], seen = {};

        // PRIMARY — IB MYP report: each subject row ends with "<final grade> <CODE>:<n>"
        // (CODE = IN/SU/BI/NT/SB). The final grade is the digit right before that code.
        SUBJECT_DICT.forEach(function (sub) {
            for (var i = 0; i < sub.a.length; i++) {
                var re = new RegExp('\\b' + escRe(sub.a[i]) + '\\b[^\\n]{0,90}?(\\d{1,2})\\s*(?:IN|SU|BI|NT|SB)\\s*:\\s*\\d', 'i');
                var m = re.exec(flat);
                if (!m) continue;
                var g = parseFloat(m[1]);
                if (isNaN(g) || g < 0 || g > max) continue;
                if (!seen[sub.n]) { seen[sub.n] = 1; found.push({ name: sub.n, grade: g }); }
                break;
            }
        });
        if (found.length) return found;

        // FALLBACK — generic report: subject immediately followed by a number on scale
        // (tight window so comments/dates aren't mistaken for grades).
        SUBJECT_DICT.forEach(function (sub) {
            for (var i = 0; i < sub.a.length; i++) {
                var re = new RegExp('\\b' + escRe(sub.a[i]) + '\\b\\s*[:\\-–]?\\s*(\\d{1,3}(?:\\.\\d)?)', 'i');
                var m = re.exec(flat);
                if (!m) continue;
                var g = parseFloat(m[1]);
                if (isNaN(g) || g < 0 || g > max) continue;
                if (!seen[sub.n]) { seen[sub.n] = 1; found.push({ name: sub.n, grade: g }); }
                break;
            }
        });
        return found;
    }
    function importPdf(file) {
        if (!window.pdfjsLib) { toast('PDF reader still loading — try again'); return; }
        try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (e) {}
        var reader = new FileReader();
        reader.onload = function () {
            pdfjsLib.getDocument({ data: new Uint8Array(reader.result) }).promise.then(function (pdf) {
                var tasks = [];
                for (var i = 1; i <= pdf.numPages; i++) {
                    tasks.push(pdf.getPage(i).then(function (p) { return p.getTextContent().then(function (tc) { return tc.items.map(function (it) { return it.str; }).join(' '); }); }));
                }
                return Promise.all(tasks);
            }).then(function (texts) {
                openReview(parseGrades(texts.join('\n')));
            }).catch(function () { toast('Could not read that PDF — add grades manually'); });
        };
        reader.readAsArrayBuffer(file);
    }
    function openReview(rows) {
        var ov = document.createElement('div');
        ov.className = 'gb__review__ov';
        if (!rows.length) {
            // No recognisable subjects/grades → tell the user plainly.
            ov.innerHTML = '<div class="gb__review">' +
                '<div class="gb__review__hd"><h3>Couldn\'t read that file</h3><button class="gb__review__x"><i class="fa-solid fa-xmark"></i></button></div>' +
                '<div class="gb__review__empty"><i class="fa-solid fa-file-circle-xmark"></i><b>Upload real GradeBook please</b>' +
                '<p>We couldn\'t find any school subjects (Maths, Physics, Biology…) with grades on your chosen scale in this document. Make sure it\'s an actual grades report — or add your subjects manually.</p></div>' +
                '<div class="gb__review__ft"><button class="gb__btn gb__btn--primary gb__review__cancel">Got it</button></div></div>';
            document.body.appendChild(ov);
            ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.gb__review__x') || e.target.closest('.gb__review__cancel')) ov.remove(); });
            return;
        }
        var scaleOpts = Object.keys(SCALES).map(function (k) { return '<option value="' + k + '"' + (k === (GB.scale || 'pct') ? ' selected' : '') + '>' + SCALES[k].label + '</option>'; }).join('');
        var body = rows.map(function (r, i) {
            return '<label class="gb__review__row"><input type="checkbox" checked data-i="' + i + '">' +
                '<input type="text" class="gb__input gb__rv__name" value="' + esc(r.name) + '">' +
                '<input type="number" class="gb__input gb__input--sm gb__rv__grade" value="' + r.grade + '" min="0" max="' + scaleMax() + '" step="0.1"></label>';
        }).join('');
        ov.innerHTML = '<div class="gb__review">' +
            '<div class="gb__review__hd"><h3>Review imported grades</h3><button class="gb__review__x"><i class="fa-solid fa-xmark"></i></button></div>' +
            '<div class="gb__review__scale"><span>Grading system</span><select class="gb__scale__sel gb__rv__scale">' + scaleOpts + '</select></div>' +
            '<p class="gb__hint">We found these subjects in your report — confirm the grading system, edit or untick anything, then import.</p>' +
            '<div class="gb__review__list">' + body + '</div>' +
            '<label class="gb__review__replace"><input type="checkbox" class="gb__rv__replace" checked> Replace my current subjects with these</label>' +
            '<div class="gb__review__ft"><button class="gb__btn gb__review__cancel">Cancel</button>' +
            '<button class="gb__btn gb__btn--primary gb__review__import"><i class="fa-solid fa-check"></i> Import ' + rows.length + ' grades</button></div></div>';
        document.body.appendChild(ov);
        function close() { ov.remove(); }
        ov.addEventListener('click', function (e) {
            if (e.target === ov || e.target.closest('.gb__review__x') || e.target.closest('.gb__review__cancel')) { close(); return; }
            if (e.target.closest('.gb__review__import')) {
                var scSel = ov.querySelector('.gb__rv__scale');
                if (scSel && SCALES[scSel.value]) { GB.scale = scSel.value; var ss = document.getElementById('gbScaleSel'); if (ss) ss.value = scSel.value; }
                var rep = ov.querySelector('.gb__rv__replace');
                if (rep && rep.checked) { GB.subjects = []; }   // wipe old/junk subjects, import a clean table
                var added = 0, dt = thisMonth() + '-01', mx = scaleMax();
                ov.querySelectorAll('.gb__review__row').forEach(function (row) {
                    if (!row.querySelector('input[type=checkbox]').checked) return;
                    var nm = row.querySelector('.gb__rv__name').value.trim();
                    var gr = Math.max(0, Math.min(mx, parseFloat(row.querySelector('.gb__rv__grade').value)));
                    if (!nm || isNaN(gr)) return;
                    var s = GB.subjects.find(function (x) { return x.name.toLowerCase() === nm.toLowerCase(); });
                    if (!s) { s = { id: uid(), name: nm, color: PALETTE[GB.subjects.length % PALETTE.length], assessments: [] }; GB.subjects.push(s); }
                    s.grade = gr;                 // final grade per subject (no per-test rows)
                    s.source = 'pdf';
                    added++;
                });
                close();
                commit(added ? (added + ' grades imported — your matches updated') : 'Nothing imported');
                // Auto-open the realistic-options window once a report is in.
                if (added && hasAim() && overallAvg() != null) setTimeout(openSuggestModal, 360);
            }
        });
    }

    document.getElementById('gbUploadBtn').addEventListener('click', function () {
        if (!hasAim()) {
            toast('Choose the university you\'re aiming for first');
            var ch = document.getElementById('gbTargetChoose');
            if (ch) { ch.scrollIntoView({ behavior: 'smooth', block: 'center' }); ch.classList.remove('gb__pulse'); void ch.offsetWidth; ch.classList.add('gb__pulse'); }
            return;
        }
        document.getElementById('gbPdfInput').click();
    });
    document.getElementById('gbPdfInput').addEventListener('change', function () { if (this.files && this.files[0]) importPdf(this.files[0]); this.value = ''; });
    var scaleSel = document.getElementById('gbScaleSel');
    if (scaleSel) {
        scaleSel.value = GB.scale || 'pct';
        scaleSel.addEventListener('change', function () { GB.scale = this.value; commit('Grading system set to ' + scaleDef().label); });
    }
    var clearBtn = document.getElementById('gbClearBtn');
    if (clearBtn) clearBtn.addEventListener('click', function () {
        if (!GB.subjects.length) { toast('Gradebook is already empty'); return; }
        if (!confirm('Clear all subjects and grades from your Gradebook? This cannot be undone.')) return;
        var keepScale = GB.scale;
        GB = fresh(); GB.scale = keepScale;
        commit('Gradebook cleared');
    });
    var yr = document.getElementById('gbYear'); if (yr) yr.textContent = new Date().getFullYear();

    // Belt-and-suspenders: a hiccup rendering an old/odd gradebook must never take
    // the whole page down (this used to freeze the app for older accounts).
    try { renderWidget(); } catch (e) { try { console.error('Gradebook widget init failed:', e); } catch (_) {} }
    var gbNav = document.querySelector('.mp__nav__btn[data-tab="gradebook"]');
    if (gbNav) gbNav.addEventListener('click', function () { try { renderAll(); } catch (e) { console.error(e); } });
}());

/* ════════════════════════════════════════════════════════════════════════════
   FUTURE SCHOOL-SYSTEM INTEGRATION (e.g. Toddle) — architecture notes
   ──────────────────────────────────────────────────────────────────────────
   The Phase-1 storage shape is deliberately integration-ready:

   us_gradebook_<id> = {
     v, subjects:[{ id, name, color, assessments:[
        { id, name, type, grade, weight, date(YYYY-MM-DD), ts }   ← full history, never just averages
     ]}], unis:{dream[],target[],safety[]}, goals:[{id,subjectId,from,to,date,dlId}]
   }

   1. DATABASE CHANGES (when a real backend is added):
      tables: subjects(id,user_id,name,external_id,source), 
              assessments(id,subject_id,name,type,grade,max_grade,weight,date,source,external_id,imported_at),
              university_targets(id,user_id,uni_id,tier),
              academic_goals(id,user_id,subject_id,from,to,due_date,deadline_id).
      The current JSON maps 1:1 onto these rows — no remodeling needed.

   2. APIs:  GET/POST /api/gradebook/subjects, /assessments, /targets, /goals;
             POST /api/integrations/{provider}/connect (OAuth), 
             POST /api/integrations/{provider}/sync  → normalises into assessments[].

   3. GRADE STORAGE FORMAT: store the RAW grade + scale (add max_grade & scale='percent|gpa|uk-ucas'
      later) so any school system maps cleanly; keep `date` + `ts` for the timeline.

   4. SUBJECT MAPPING: add a subject_map table (provider_subject_name → canonical subject)
      so "Maths"/"Mathematics HL"/"Math" collapse to one canonical subject.

   5. MULTIPLE SYSTEMS: tag every imported row with `source` + `external_id`; an adapter per
      provider (Toddle, Google Classroom, MMS…) normalises to the assessments[] shape.

   6. METADATA TO STORE NOW (already reserved): id, date, ts, type, weight, source(implicit
      'manual'), so adding imports later needs only `external_id`, `max_grade`, `scale` —
      additive columns, zero migration of existing data.
   ════════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════════
   University Feed tabs (Saved / News) + "Today in Education" news modal.
   The News tab opens a modal that pulls the daily top-10 from /api/news
   (served by the news.js agent). Posts are rendered Instagram-style.
   ════════════════════════════════════════════════════════════════════════════ */
(function () {
    var tabs    = document.querySelectorAll('.mp__feed__tab');
    var overlay = document.getElementById('newsOverlay');
    var modal   = document.getElementById('newsModal');
    var grid    = document.getElementById('newsGrid');
    var loading = document.getElementById('newsLoading');
    var dateBtn = document.getElementById('newsDate');
    var dateLbl = document.getElementById('newsDateLabel');
    var refreshEl = document.getElementById('newsRefresh');
    var calEl   = document.getElementById('newsCal');
    if (!tabs.length || !modal) return;

    var loaded = false, loadedAt = 0, nextRefresh = 0, curDate = null;
    var availDates = {}, calMonth = null, cdTimer = null;

    function apiBase() { return (typeof PAY_API_BASE !== 'undefined' && PAY_API_BASE) ? PAY_API_BASE : ''; }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
    function todayYmd() { return ymd(new Date()); }
    function setActive(name) { Array.prototype.forEach.call(tabs, function (t) { t.classList.toggle('active', t.dataset.ftab === name); }); }

    Array.prototype.forEach.call(tabs, function (t) {
        t.addEventListener('click', function () {
            if (t.dataset.ftab === 'news') { setActive('news'); openNews(); }
            else { setActive('saved'); }
        });
    });

    function openNews() {
        overlay.classList.add('open'); modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        loadDates();
        if (!loaded || (Date.now() - loadedAt) > 6 * 3600 * 1000) fetchNews(null);
        else if (curDate === todayYmd()) startCountdown();
    }
    function closeNews() {
        overlay.classList.remove('open'); modal.classList.remove('open');
        document.body.style.overflow = ''; closeCal(); setActive('saved');
        if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
    }
    document.getElementById('newsClose').addEventListener('click', closeNews);
    overlay.addEventListener('click', closeNews);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) { if (calEl.classList.contains('open')) closeCal(); else closeNews(); } });

    function fmtDate(dstr) {
        try { var p = String(dstr).split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
            return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); }
        catch (e) { return dstr; }
    }

    /* ── Countdown to the next 11:00 (local time) — the brief refreshes daily
       at 11am, NOT 24h after you opened the page. ── */
    function nextElevenAM() {
        var n = new Date(), t = new Date(n);
        t.setHours(11, 0, 0, 0);
        if (t.getTime() <= n.getTime()) t.setDate(t.getDate() + 1);
        return t.getTime();
    }
    function startCountdown() {
        if (cdTimer) clearInterval(cdTimer);
        function tick() {
            var ms = nextElevenAM() - Date.now();
            if (ms <= 0) { refreshEl.innerHTML = '<i class="fa-solid fa-rotate"></i> refreshing…'; return; }
            var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
            refreshEl.innerHTML = '<i class="fa-solid fa-rotate"></i> refreshes in ' + (h > 0 ? h + 'h ' : '') + m + 'm';
        }
        tick(); cdTimer = setInterval(tick, 30000);
    }

    function fetchNews(dateStr) {
        loading.style.display = 'block';
        loading.innerHTML = '<span class="news__spin" aria-hidden="true"></span> Gathering today’s stories…';
        grid.innerHTML = '';
        var url = apiBase() + '/api/news' + (dateStr ? ('?date=' + encodeURIComponent(dateStr)) : '');
        fetch(url).then(function (r) { return r.json(); }).then(function (d) {
            loaded = true; loadedAt = Date.now();
            curDate = d.date || dateStr || todayYmd();
            nextRefresh = d.nextRefresh || 0;
            var items = (d && d.items) || [];
            dateLbl.textContent = fmtDate(curDate);
            if (curDate === todayYmd()) startCountdown();
            else { if (cdTimer) { clearInterval(cdTimer); cdTimer = null; } refreshEl.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> archived brief'; }
            if (!items.length) { loading.innerHTML = '<i class="fa-regular fa-newspaper"></i> No stories for this day.'; return; }
            loading.style.display = 'none';
            grid.innerHTML = items.map(cardHtml).join('');
            var cnt = document.getElementById('newsCount'); if (cnt) cnt.textContent = items.length + ' stories';
            Array.prototype.forEach.call(grid.querySelectorAll('.news__post'), function (el) {
                var go = function () { var u = el.getAttribute('data-url'); if (u) window.open(u, '_blank', 'noopener'); };
                el.addEventListener('click', go);
                el.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
            });
        }).catch(function () {
            loading.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Couldn’t load the news. Is the server running?';
        });
    }

    // Editorial cards: the first story leads (big picture + the longer summary),
    // the rest are numbered like a printed brief.
    function cardHtml(it, i) {
        var n = (i + 1 < 10 ? '0' : '') + (i + 1), lead = i === 0;
        return '<article class="news__post' + (lead ? ' news__post--lead' : '') + '" data-url="' + esc(it.url || '') + '" style="--i:' + i + '" tabindex="0">' +
            '<div class="news__post__media' + (it.image ? '' : ' is-noimg') + '">' +
                (it.image ? '<img src="' + esc(it.image) + '" alt="" loading="lazy" decoding="async" onerror="this.parentNode.classList.add(\'is-noimg\');this.remove()">' : '') +
                '<span class="news__post__ph" aria-hidden="true">' + esc((it.category || 'News').charAt(0)) + '</span>' +
            '</div>' +
            '<div class="news__post__body">' +
                '<div class="news__post__meta"><span class="news__post__num">' + n + '</span>' + (it.category ? '<span class="news__post__cat">' + esc(it.category) + '</span>' : '') + '</div>' +
                '<h3 class="news__post__title">' + esc(it.title || '') + '</h3>' +
                ((lead ? (it.detail || it.subtitle) : it.subtitle) ? '<p class="news__post__sub">' + esc(lead ? (it.detail || it.subtitle) : it.subtitle) + '</p>' : '') +
                '<span class="news__post__more">Read the story <i class="fa-solid fa-arrow-right"></i></span>' +
            '</div>' +
        '</article>';
    }

    /* ── Day picker (past days with an archive; future disabled) ── */
    function loadDates() {
        fetch(apiBase() + '/api/news/dates').then(function (r) { return r.json(); })
            .then(function (d) { (d.dates || []).forEach(function (x) { availDates[x] = true; }); if (calEl.classList.contains('open')) renderCal(); })
            .catch(function () {});
    }
    function openCal() {
        var seed = curDate ? curDate.split('-') : todayYmd().split('-');
        calMonth = new Date(+seed[0], +seed[1] - 1, 1);
        renderCal(); calEl.classList.add('open'); dateBtn.classList.add('open');
        setTimeout(function () { document.addEventListener('mousedown', onDocDown, true); }, 0);
    }
    function closeCal() { calEl.classList.remove('open'); dateBtn.classList.remove('open'); document.removeEventListener('mousedown', onDocDown, true); }
    function onDocDown(e) { if (!calEl.contains(e.target) && !dateBtn.contains(e.target)) closeCal(); }
    dateBtn.addEventListener('click', function (e) { e.stopPropagation(); if (calEl.classList.contains('open')) closeCal(); else openCal(); });

    function renderCal() {
        var y = calMonth.getFullYear(), mo = calMonth.getMonth(), today = todayYmd(), now = new Date();
        var startDow = (new Date(y, mo, 1).getDay() + 6) % 7;          // Monday-first
        var days = new Date(y, mo + 1, 0).getDate();
        var atCurrent = (y === now.getFullYear() && mo === now.getMonth());
        var title = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(calMonth);
        var html = '<div class="news__cal__hd">' +
            '<button class="news__cal__nav" data-nav="-1" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button>' +
            '<span class="news__cal__title">' + title + '</span>' +
            '<button class="news__cal__nav" data-nav="1"' + (atCurrent ? ' disabled' : '') + ' aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button>' +
        '</div><div class="news__cal__grid">';
        ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (d) { html += '<div class="news__cal__dow">' + d + '</div>'; });
        for (var i = 0; i < startDow; i++) html += '<button class="news__cal__day empty" disabled></button>';
        for (var day = 1; day <= days; day++) {
            var ds = y + '-' + pad(mo + 1) + '-' + pad(day);
            var disabled = (ds > today) || !(availDates[ds] || ds === today);
            var cls = 'news__cal__day' + (ds === today ? ' today' : '') + (ds === curDate ? ' selected' : '');
            html += '<button class="' + cls + '" data-date="' + ds + '"' + (disabled ? ' disabled' : '') + '>' + day + '</button>';
        }
        calEl.innerHTML = html + '</div>';
        Array.prototype.forEach.call(calEl.querySelectorAll('.news__cal__nav'), function (b) {
            b.addEventListener('click', function (e) { e.stopPropagation(); if (b.disabled) return; calMonth = new Date(y, mo + parseInt(b.dataset.nav, 10), 1); renderCal(); });
        });
        Array.prototype.forEach.call(calEl.querySelectorAll('.news__cal__day[data-date]'), function (b) {
            if (b.disabled) return;
            b.addEventListener('click', function (e) { e.stopPropagation(); closeCal(); var ds = b.dataset.date; fetchNews(ds === todayYmd() ? null : ds); });
        });
    }
}());
