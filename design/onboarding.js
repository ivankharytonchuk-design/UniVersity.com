/* ════════════════════════════════════════════════════════════════════
   Onboarding wizard — first-run profile capture that personalises the app.
   Self-contained: remove onboarding.js/.css includes to undo. Shows once
   (flag us_onboarded_<id>); reopen anytime via window.openOnboarding().
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    function uid() { try { return (window.user && window.user.id) || 'guest'; } catch (e) { return 'guest'; } }
    function FLAG() { return 'us_onboarded_' + uid(); }
    function getProfile() { try { return (window.getProfile && window.getProfile()) || {}; } catch (e) { return {}; } }
    function setProfile(p) { try { if (window.setProfile) window.setProfile(p); else localStorage.setItem('us_profile_' + uid(), JSON.stringify(p)); } catch (e) {} }

    var SUBJECTS = ['Mathematics','Computer Science','Engineering','Medicine','Business','Economics','Law','Physics','Biology','Chemistry','Psychology','Arts & Design','Architecture','Languages','History','Politics'];
    var PRIORITIES = ['Top academics','Affordable fees','Vibrant city life','Career prospects','Great facilities','International vibe','Strong support','Nice weather'];
    var COUNTRIES = ['United Kingdom','Spain','Germany','France','Italy','Netherlands','United States','Portugal','Sweden','Ireland'];

    var state = { name: '', level: 'Bachelor', subjects: [], country: '', budget: 12000, priorities: [] };
    var step = 0, TOTAL = 4, el = null;

    function chips(list, sel, cls) {
        return list.map(function (x) {
            return '<button type="button" class="obd__chip' + (sel.indexOf(x) !== -1 ? ' on' : '') + '" data-' + cls + '="' + x + '">' + x + '</button>';
        }).join('');
    }

    function stepHTML() {
        if (step === 0) return '<div class="obd__step">' +
            '<div class="obd__emoji">👋</div>' +
            '<h2 class="obd__h">Welcome to UniVersity</h2>' +
            '<p class="obd__p">Let’s set you up in 30 seconds so every page is tailored to you. First — what should we call you?</p>' +
            '<input class="obd__input" id="obdName" placeholder="Your first name" maxlength="40" value="' + (state.name || '') + '">' +
            '<div class="obd__seg" id="obdLevel">' + ['Bachelor','Master','PhD'].map(function (l) { return '<button type="button" class="obd__seg__btn' + (state.level === l ? ' on' : '') + '" data-level="' + l + '">' + l + '</button>'; }).join('') + '</div>' +
            '<div class="obd__seg__lbl">I’m applying for a…</div>' +
        '</div>';
        if (step === 1) return '<div class="obd__step">' +
            '<h2 class="obd__h">What do you love studying?</h2>' +
            '<p class="obd__p">Pick a few — we’ll surface universities strong in these fields.</p>' +
            '<div class="obd__chips">' + chips(SUBJECTS, state.subjects, 'subj') + '</div>' +
        '</div>';
        if (step === 2) return '<div class="obd__step">' +
            '<h2 class="obd__h">Where & how much?</h2>' +
            '<p class="obd__p">Optional — helps us match destinations to your budget.</p>' +
            '<div class="obd__seg__lbl">Dream destination</div>' +
            '<div class="obd__chips obd__chips--sm">' + chips(COUNTRIES, state.country ? [state.country] : [], 'country') + '</div>' +
            '<div class="obd__seg__lbl" style="margin-top:16px">Yearly budget: <b id="obdBudgetVal">€' + state.budget.toLocaleString() + '</b></div>' +
            '<input type="range" class="obd__range" id="obdBudget" min="1000" max="40000" step="500" value="' + state.budget + '">' +
        '</div>';
        return '<div class="obd__step">' +
            '<h2 class="obd__h">What matters most to you?</h2>' +
            '<p class="obd__p">We’ll weight your matches by what you care about.</p>' +
            '<div class="obd__chips">' + chips(PRIORITIES, state.priorities, 'prio') + '</div>' +
        '</div>';
    }

    function render() {
        el.querySelector('.obd__body').innerHTML = stepHTML();
        el.querySelectorAll('.obd__dot').forEach(function (d, i) { d.classList.toggle('on', i <= step); });
        var back = el.querySelector('.obd__back'), next = el.querySelector('.obd__next');
        back.style.visibility = step === 0 ? 'hidden' : 'visible';
        next.innerHTML = step === TOTAL - 1 ? '<i class="fa-solid fa-wand-magic-sparkles"></i> Finish' : 'Continue <i class="fa-solid fa-arrow-right"></i>';
        wireStep();
    }

    function wireStep() {
        var nameI = el.querySelector('#obdName'); if (nameI) nameI.addEventListener('input', function () { state.name = this.value.trim(); });
        el.querySelectorAll('[data-level]').forEach(function (b) { b.addEventListener('click', function () { state.level = b.dataset.level; el.querySelectorAll('[data-level]').forEach(function (x) { x.classList.toggle('on', x === b); }); }); });
        el.querySelectorAll('[data-subj]').forEach(function (b) { b.addEventListener('click', function () { toggle(state.subjects, b.dataset.subj); b.classList.toggle('on'); }); });
        el.querySelectorAll('[data-prio]').forEach(function (b) { b.addEventListener('click', function () { toggle(state.priorities, b.dataset.prio); b.classList.toggle('on'); }); });
        el.querySelectorAll('[data-country]').forEach(function (b) { b.addEventListener('click', function () { var was = b.classList.contains('on'); el.querySelectorAll('[data-country]').forEach(function (x) { x.classList.remove('on'); }); if (!was) { b.classList.add('on'); state.country = b.dataset.country; } else state.country = ''; }); });
        var bud = el.querySelector('#obdBudget'); if (bud) bud.addEventListener('input', function () { state.budget = parseInt(this.value, 10); el.querySelector('#obdBudgetVal').textContent = '€' + state.budget.toLocaleString(); });
    }
    function toggle(arr, v) { var i = arr.indexOf(v); if (i === -1) arr.push(v); else arr.splice(i, 1); }

    function finish() {
        var p = getProfile();
        p.name = state.name || p.name;
        p.level = state.level; p.subjects = state.subjects; p.country = state.country;
        p.budget = state.budget; p.priorities = state.priorities;
        setProfile(p);
        try { localStorage.setItem(FLAG(), '1'); } catch (e) {}
        close();
        try { if (window.renderGamification) window.renderGamification(); } catch (e) {}
        toast('You’re all set' + (state.name ? ', ' + state.name : '') + '! Your app is personalised. 🎉');
    }

    function toast(msg) {
        var b = document.createElement('div');
        b.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:100002;padding:13px 20px;border-radius:13px;font-family:Montserrat,sans-serif;font-size:13px;font-weight:700;color:#fff;box-shadow:0 12px 30px rgba(0,0,0,.28);background:linear-gradient(135deg,#f59220,#d97c14)';
        b.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + msg;
        document.body.appendChild(b);
        setTimeout(function () { b.style.transition = 'opacity .4s'; b.style.opacity = '0'; setTimeout(function () { b.remove(); }, 400); }, 3200);
    }

    function open() {
        var p = getProfile();
        state.name = p.name || state.name; state.level = p.level || state.level;
        state.subjects = (p.subjects || []).slice(); state.country = p.country || '';
        state.budget = p.budget || 12000; state.priorities = (p.priorities || []).slice();
        step = 0;
        el = document.createElement('div');
        el.className = 'obd__overlay';
        el.innerHTML =
            '<div class="obd__panel">' +
                '<div class="obd__side"><img src="images/logo2.png" class="obd__logo" alt=""><div class="obd__side__title">UniVersity</div>' +
                    '<div class="obd__side__sub">Your personal path to the right university — set up once, tailored everywhere.</div>' +
                    '<div class="obd__orb"></div></div>' +
                '<div class="obd__main">' +
                    '<button class="obd__skip" title="Skip">Skip</button>' +
                    '<div class="obd__dots">' + [0,1,2,3].map(function () { return '<span class="obd__dot"></span>'; }).join('') + '</div>' +
                    '<div class="obd__body"></div>' +
                    '<div class="obd__nav"><button class="obd__back" type="button"><i class="fa-solid fa-arrow-left"></i> Back</button>' +
                        '<button class="obd__next" type="button"></button></div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(el);
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(function () { el.classList.add('open'); });
        el.querySelector('.obd__skip').addEventListener('click', function () { try { localStorage.setItem(FLAG(), '1'); } catch (e) {} close(); });
        el.querySelector('.obd__back').addEventListener('click', function () { if (step > 0) { step--; render(); } });
        el.querySelector('.obd__next').addEventListener('click', function () { if (step < TOTAL - 1) { step++; render(); } else finish(); });
        render();
    }
    function close() { if (!el) return; el.classList.remove('open'); document.body.style.overflow = ''; var e = el; setTimeout(function () { e.remove(); }, 300); el = null; }

    window.openOnboarding = open;
    function boot() {
        try { if (localStorage.getItem(FLAG())) return; } catch (e) {}
        setTimeout(open, 700);
    }
    if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
