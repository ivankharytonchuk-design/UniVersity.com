/* ════════════════════════════════════════════════════════════════════
   Application plan export — a branded, printable "roadmap" (Save as PDF).
   Self-contained: remove plan-export.js include to undo (it injects its own
   button into the Saved Universities section on the Overview).
   ════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    function uid() { try { return (window.user && window.user.id) || 'guest'; } catch (e) { return 'guest'; } }
    function ls(key, def) { try { return JSON.parse(localStorage.getItem(key + '_' + uid()) || def); } catch (e) { try { return JSON.parse(def); } catch (_) { return null; } } }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }
    function findUni(id) { try { return (window.UNI || []).find(function (u) { return u.id === id; }) || null; } catch (e) { return null; } }

    function gradeAvg() {
        var g = ls('us_gradebook', 'null'); if (!g || !g.subjects || !g.subjects.length) return null;
        var max = ({ pct: 100, p10: 10, p9: 9, p8: 8, p5: 5, gpa: 4 })[g.scale] || 100;
        var vals = g.subjects.map(function (s) {
            var marks = [].concat(s.sem1 || [], s.sem2 || []).filter(function (m) { return m != null && m !== '' && !isNaN(m); }).map(Number);
            if (marks.length) return marks.reduce(function (a, b) { return a + b; }, 0) / marks.length;
            if (s.grade != null && s.grade !== '') return +s.grade;
            if (s.assessments && s.assessments.length) { var w = 0, t = 0; s.assessments.forEach(function (a) { var wt = a.weight || 1; w += wt; t += (+a.grade) * wt; }); return w ? t / w : null; }
            return null;
        }).filter(function (v) { return v != null; });
        if (!vals.length) return null;
        return { avg: Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length * 10) / 10, max: max, n: g.subjects.length };
    }

    function fmtDate(d) { try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } }

    function buildReport() {
        var p = (window.getProfile && window.getProfile()) || {};
        var saved = ls('us_saved', '[]') || [];
        var customDl = (ls('us_dl_cust', '[]') || []).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
        var ga = gradeAvg();
        var name = p.name || 'Your';
        var when = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

        var uniRows = saved.map(function (id, i) {
            var u = findUni(id);
            if (!u) return '<tr><td>' + (i + 1) + '</td><td colspan="4">' + esc(id) + '</td></tr>';
            return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(u.name) + '</b></td><td>' + esc(u.city || '') + '</td><td>' + esc(u.type || '') + '</td><td>' + esc(u.tuition || u.dl || '') + '</td></tr>';
        }).join('') || '<tr><td colspan="5" class="muted">No saved universities yet — save some in Explore.</td></tr>';

        var dlRows = customDl.slice(0, 20).map(function (d) {
            return '<tr><td>' + esc(fmtDate(d.date)) + '</td><td><b>' + esc(d.title) + '</b></td><td>' + esc(d.uniName || 'Personal reminder') + '</td></tr>';
        }).join('') || '<tr><td colspan="3" class="muted">No deadlines added yet.</td></tr>';

        var chips = function (arr) { return (arr && arr.length) ? arr.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') : '<span class="muted">—</span>'; };

        var actions = [
            saved.length ? null : 'Save a few universities in Explore to build your shortlist.',
            ga ? null : 'Add your grades in the Gradebook to see your admission chances.',
            customDl.length ? null : 'Add your key application deadlines so nothing slips.',
            (p.subjects && p.subjects.length) ? null : 'Complete your profile so matches are tailored to you.',
            'Draft your personal statement early and get it reviewed.',
            'Check visa & funding requirements for your destination.'
        ].filter(Boolean);

        return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(name) + ' — Application Plan</title>' +
            '<style>' +
            '@page{margin:16mm}*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1409;margin:0;padding:0 4px}' +
            'h1{font-size:26px;margin:0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#d97c14;margin:26px 0 8px;border-bottom:2px solid #f0d9b5;padding-bottom:5px}' +
            '.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #d97c14;padding-bottom:12px;margin-bottom:6px}' +
            '.brand{font-weight:800;color:#d97c14;font-size:13px;letter-spacing:.1em}.sub{color:#5c4a28;font-size:12px;margin-top:4px}' +
            'table{width:100%;border-collapse:collapse;font-size:12px;margin-top:4px}th,td{text-align:left;padding:7px 9px;border-bottom:1px solid #eee}th{background:#fff5e8;color:#8a6a2e;font-size:10px;text-transform:uppercase;letter-spacing:.05em}' +
            '.muted{color:#9e7d45}.chip{display:inline-block;background:#fff5e8;border:1px solid #f0d9b5;border-radius:99px;padding:3px 10px;font-size:11px;margin:3px 4px 0 0;color:#5c4a28}' +
            '.stats{display:flex;gap:12px;margin-top:6px}.stat{flex:1;border:1px solid #f0d9b5;border-radius:12px;padding:12px}.stat b{font-size:22px;color:#d97c14}.stat span{display:block;font-size:11px;color:#5c4a28;margin-top:2px}' +
            'ol{font-size:12.5px;line-height:1.7;color:#3a2c14;padding-left:18px}.foot{margin-top:26px;font-size:10px;color:#9e7d45;text-align:center}' +
            '</style></head><body>' +
            '<div class="head"><div><div class="brand">UNIVERSITY · APPLICATION PLAN</div><h1>' + esc(name) + '’s roadmap</h1>' +
                '<div class="sub">' + esc(p.level || 'Bachelor') + ' applicant' + (p.country ? ' · aiming for ' + esc(p.country) : '') + '</div></div>' +
                '<div class="sub">Generated ' + esc(when) + '</div></div>' +
            '<div class="stats"><div class="stat"><b>' + saved.length + '</b><span>Shortlisted universities</span></div>' +
                '<div class="stat"><b>' + customDl.length + '</b><span>Tracked deadlines</span></div>' +
                '<div class="stat"><b>' + (ga ? ga.avg + ' <small style="font-size:12px">/' + ga.max + '</small>' : '—') + '</b><span>Average grade' + (ga ? ' (' + ga.n + ' subjects)' : '') + '</span></div></div>' +
            '<h2>Your profile</h2><div><b>Subjects:</b> ' + chips(p.subjects) + '</div><div style="margin-top:6px"><b>Priorities:</b> ' + chips(p.priorities) + '</div>' +
                (p.budget ? '<div style="margin-top:6px"><b>Budget:</b> <span class="chip">≈ €' + Number(p.budget).toLocaleString() + '/yr</span></div>' : '') +
            '<h2>Shortlist</h2><table><thead><tr><th>#</th><th>University</th><th>City</th><th>Type</th><th>Tuition / entry</th></tr></thead><tbody>' + uniRows + '</tbody></table>' +
            '<h2>Key deadlines</h2><table><thead><tr><th>Date</th><th>What</th><th>University</th></tr></thead><tbody>' + dlRows + '</tbody></table>' +
            '<h2>Next actions</h2><ol>' + actions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ol>' +
            '<div class="foot">Made with UniVersity · This plan is a personal guide, not official advice.</div>' +
            '<script>window.onload=function(){setTimeout(function(){window.print();},350);};<\/script>' +
            '</body></html>';
    }

    function exportPlan() {
        var w = window.open('', '_blank');
        if (!w) { alert('Please allow pop-ups to export your plan.'); return; }
        w.document.open(); w.document.write(buildReport()); w.document.close();
    }
    window.exportApplicationPlan = exportPlan;

    // Inject the launcher button into the Saved Universities section header.
    function injectBtn() {
        if (document.getElementById('planExportBtn')) return;
        var hd = document.querySelector('#tabOverview .mp__section .mp__section__hd');
        if (!hd) return;
        var btn = document.createElement('button');
        btn.id = 'planExportBtn';
        btn.className = 'mp__section__action plan__export__btn';
        btn.innerHTML = '<i class="fa-solid fa-file-arrow-down"></i> Export plan (PDF) <span class="plan__elite">Elite</span>';
        btn.addEventListener('click', exportPlan);
        var actionsWrap = hd.querySelector('.mp__section__action');
        if (actionsWrap && actionsWrap.parentNode) actionsWrap.parentNode.insertBefore(btn, actionsWrap);
        else hd.appendChild(btn);
    }
    function boot() { injectBtn(); }
    if (document.readyState !== 'loading') boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
