/* ════════════════════════════════════════════════════════════════════
   uselect.js — replaces the native browser <select> dropdown popup with a
   custom, animated, theme-aware menu on EVERY <select> on the page.

   Design: the native <select> stays in the DOM and keeps its original
   styling (so the closed control looks identical); we only intercept the
   open gesture and render our own option list. The native element remains
   the single source of truth — we set `selectedIndex` and fire a real
   `change` event, so all existing listeners keep working unchanged.

   Opt out on a specific select with `data-no-usel="1"`.
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    var menu = null;        // shared popup element
    var current = null;     // <select> the menu is currently bound to
    var items = [];         // {el, index} for keyboard nav
    var active = -1;        // highlighted item in items[]

    function eligible(sel) {
        return sel && sel.tagName === 'SELECT' && !sel.multiple &&
               !sel.disabled && sel.dataset.noUsel !== '1';
    }

    function buildMenu() {
        menu = document.createElement('div');
        menu.className = 'usel-menu';
        menu.setAttribute('role', 'listbox');
        document.body.appendChild(menu);
        // Keep focus on the trigger; don't let clicks steal it before we act.
        menu.addEventListener('mousedown', function (e) { e.preventDefault(); });
    }

    function close() {
        if (!menu) return;
        menu.classList.remove('open');
        current = null; items = []; active = -1;
        document.removeEventListener('mousedown', onDocDown, true);
        window.removeEventListener('resize', close);
        window.removeEventListener('scroll', close, true);
    }

    function commit(sel, index) {
        if (index != null && index > -1 && sel.selectedIndex !== index) {
            sel.selectedIndex = index;
            sel.dispatchEvent(new Event('input',  { bubbles: true }));
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        close();
        try { sel.focus(); } catch (e) {}
    }

    function render(sel, filter) {
        menu.innerHTML = '';
        items = []; active = -1;
        var opts = sel.options, q = (filter || '').trim().toLowerCase(), shown = 0, lastGroup = null;

        if (sel.options.length > 10) {
            var f = document.createElement('input');
            f.className = 'usel-menu__filter';
            f.type = 'text';
            f.placeholder = 'Search…';
            f.value = filter || '';
            f.addEventListener('input', function () { render(sel, f.value); f.focus(); moveActive(1); });
            f.addEventListener('keydown', navKey);
            menu.appendChild(f);
            setTimeout(function () { try { f.focus(); } catch (e) {} }, 0);
        }

        for (var i = 0; i < opts.length; i++) {
            var o = opts[i];
            if (o.hidden) continue;
            var txt = o.textContent;
            if (q && txt.toLowerCase().indexOf(q) === -1) continue;

            var grp = o.parentNode && o.parentNode.tagName === 'OPTGROUP' ? o.parentNode.label : null;
            if (grp && grp !== lastGroup) {
                var gl = document.createElement('div');
                gl.className = 'usel-opt__empty';
                gl.style.textAlign = 'left';
                gl.style.fontWeight = '800';
                gl.style.textTransform = 'uppercase';
                gl.style.letterSpacing = '.04em';
                gl.style.padding = '8px 12px 4px';
                gl.textContent = grp;
                menu.appendChild(gl);
                lastGroup = grp;
            }

            var it = document.createElement('div');
            it.className = 'usel-opt' + (i === sel.selectedIndex ? ' selected' : '') + (o.disabled ? ' disabled' : '');
            it.setAttribute('role', 'option');
            it.textContent = txt;
            if (!o.disabled) {
                (function (idx, node) {
                    node.addEventListener('click', function () { commit(sel, idx); });
                    node.addEventListener('mouseenter', function () { setActive(items.indexOf(itemRef)); });
                    var itemRef = { el: node, index: idx };
                    items.push(itemRef);
                    if (idx === sel.selectedIndex) active = items.length - 1;
                })(i, it);
            }
            menu.appendChild(it);
            shown++;
        }

        if (!shown) {
            var empty = document.createElement('div');
            empty.className = 'usel-opt__empty';
            empty.textContent = 'No matches';
            menu.appendChild(empty);
        }
        highlight();
    }

    function position(sel) {
        var r = sel.getBoundingClientRect();
        var vw = window.innerWidth, vh = window.innerHeight;
        menu.style.width = Math.max(r.width, 160) + 'px';
        menu.style.left = Math.min(r.left, vw - Math.max(r.width, 160) - 10) + 'px';
        // measure height, decide flip
        menu.style.top = '-9999px';
        menu.classList.add('open');
        var mh = menu.offsetHeight;
        var below = vh - r.bottom - 8;
        if (below < mh && r.top > below) {
            menu.classList.add('flip');
            menu.style.top = Math.max(8, r.top - mh - 6) + 'px';
        } else {
            menu.classList.remove('flip');
            menu.style.top = (r.bottom + 6) + 'px';
        }
    }

    function open(sel) {
        if (!menu) buildMenu();
        if (current === sel) { close(); return; }
        current = sel;
        render(sel, '');
        position(sel);
        document.addEventListener('mousedown', onDocDown, true);
        window.addEventListener('resize', close);
        window.addEventListener('scroll', close, true);
    }

    /* ── highlight / keyboard ── */
    function highlight() {
        for (var i = 0; i < items.length; i++) items[i].el.classList.toggle('active', i === active);
        if (active > -1 && items[active]) {
            var el = items[active].el, mt = menu.scrollTop, mb = mt + menu.clientHeight;
            if (el.offsetTop < mt) menu.scrollTop = el.offsetTop - 4;
            else if (el.offsetTop + el.offsetHeight > mb) menu.scrollTop = el.offsetTop + el.offsetHeight - menu.clientHeight + 4;
        }
    }
    function setActive(i) { if (i > -1) { active = i; highlight(); } }
    function moveActive(dir) {
        if (!items.length) return;
        active = (active + dir + items.length) % items.length;
        highlight();
    }
    function navKey(e) {
        if (!current) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) commit(current, items[active].index); }
        else if (e.key === 'Escape') { e.preventDefault(); var s = current; close(); try { s.focus(); } catch (x) {} }
    }

    function onDocDown(e) { if (menu && !menu.contains(e.target) && e.target !== current) close(); }

    /* ── open gestures (delegated, so dynamically-added selects work too) ── */
    document.addEventListener('mousedown', function (e) {
        var sel = e.target.closest ? e.target.closest('select') : null;
        if (!eligible(sel)) return;
        e.preventDefault();              // block the native popup
        try { sel.focus(); } catch (x) {}
        open(sel);
    }, true);

    document.addEventListener('keydown', function (e) {
        if (current) { navKey(e); return; }
        var sel = document.activeElement;
        if (!eligible(sel) || sel.tagName !== 'SELECT') return;
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            open(sel);
            moveActive(e.key === 'ArrowUp' ? -1 : 0);
        }
    }, true);
}());
