'use strict';
// Delivery step: turn the JSON report into a clean email and send via Mailjet.
const Mailjet = require('node-mailjet');
const log = require('./logger');

const APP_BASE = (process.env.APP_BASE || 'http://localhost:4242').replace(/\/$/, '');
const BRAND = '#4f46e5';          // indigo (not orange)
const BRAND2 = '#6366f1';

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// "Save to Deadlines" link → opens the app, which adds the event to the Deadlines page.
function saveLink(item, university) {
  const q = new URLSearchParams({
    dl_add: '1',
    dl_title: item.title || 'Event',
    dl_date: item.date || '',
    dl_uni: university || '',
    dl_type: item.dlType || 'other',
  });
  return APP_BASE + '/mainPage.html?' + q.toString();
}

function itemBlock(item, university) {
  const blurb = '<div style="font-size:14px;line-height:1.6;color:#33384a;margin:0 0 12px;">' + esc(item.blurb) + '</div>';
  let action;
  if (item.type === 'event' && item.date) {
    action = '<a href="' + esc(saveLink(item, university)) + '" ' +
      'style="display:inline-block;background:' + BRAND + ';color:#fff;font-size:13px;font-weight:700;' +
      'text-decoration:none;padding:10px 18px;border-radius:10px;">📅 Save to Deadlines · ' + esc(item.date) + '</a>';
  } else if (item.url) {
    action = '<a href="' + esc(item.url) + '" style="display:inline-block;color:' + BRAND + ';font-size:13px;' +
      'font-weight:700;text-decoration:none;">Read the article →</a>';
  } else {
    action = '';
  }
  return '<div style="padding:18px 0;border-top:1px solid #eef0f5;">' + blurb + action + '</div>';
}

function universityCard(f) {
  const tag = f.source === 'web'
    ? '<span style="font-size:10px;font-weight:700;color:#92400e;background:#fffbeb;padding:3px 9px;border-radius:999px;">web sources</span>'
    : '<span style="font-size:10px;font-weight:700;color:#3730a3;background:#eef2ff;padding:3px 9px;border-radius:999px;">official site</span>';
  const items = (f.items || []).map(function (it) { return itemBlock(it, f.university); }).join('');

  return '<div style="background:#ffffff;border:1px solid #e8eaf1;border-radius:16px;padding:22px 24px;margin:0 0 22px;box-shadow:0 2px 10px rgba(31,41,80,.05);">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:6px;">' +
      '<span style="font-size:17px;font-weight:800;color:#1e2235;">' + esc(f.university) + '</span>' + tag +
    '</div>' +
    items +
  '</div>';
}

function buildHtml(report) {
  const cards = (report.findings || []).filter(function (f) { return (f.items || []).length; }).map(universityCard).join('') ||
    '<p style="color:#8a90a6;text-align:center;padding:30px 0;">No recent updates found for your saved universities.</p>';
  const intro = report.summary
    ? '<p style="font-size:15px;line-height:1.6;color:#5a6072;margin:0 0 26px;">' + esc(report.summary) + '</p>' : '';
  const warnings = (report.warnings || []).length
    ? '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin:6px 0 0;">' +
        '<div style="font-size:12px;font-weight:700;color:#92400e;margin:0 0 6px;">Nothing new found for</div>' +
        '<ul style="margin:0;padding-left:18px;color:#a16207;font-size:13px;line-height:1.6;">' +
          report.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') +
        '</ul></div>' : '';

  return '' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your latest university updates from UniScout.</div>' +
    '<div style="background:#f3f4fa;padding:30px 0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">' +
      '<div style="max-width:620px;margin:0 auto;padding:0 16px;">' +
        '<div style="background:linear-gradient(135deg,' + BRAND + ',' + BRAND2 + ');color:#fff;padding:30px 28px;border-radius:20px 20px 0 0;">' +
          '<div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;opacity:.85;">UniScout</div>' +
          '<div style="font-size:22px;font-weight:900;margin-top:8px;line-height:1.3;">' + esc(report.subject) + '</div>' +
        '</div>' +
        '<div style="background:#f7f8fc;border:1px solid #e8eaf1;border-top:none;border-radius:0 0 20px 20px;padding:28px 24px;">' +
          intro + cards + warnings +
          '<p style="font-size:11px;color:#a7adc0;margin:8px 0 0;text-align:center;line-height:1.6;">' +
            'Sent by UniScout for your saved universities · summarised from the cited sources only.</p>' +
        '</div>' +
      '</div>' +
    '</div>';
}

function buildText(report) {
  var lines = [report.subject, ''];
  if (report.summary) lines.push(report.summary, '');
  (report.findings || []).forEach(function (f) {
    if (!(f.items || []).length) return;
    lines.push('— ' + f.university + ' —');
    f.items.forEach(function (it) {
      lines.push('• ' + it.blurb);
      if (it.type === 'event' && it.date) lines.push('  Save to deadlines: ' + saveLink(it, f.university));
      else if (it.url) lines.push('  Read: ' + it.url);
    });
    lines.push('');
  });
  if ((report.warnings || []).length) {
    lines.push('Nothing new found for:');
    report.warnings.forEach(function (w) { lines.push('• ' + w); });
    lines.push('');
  }
  return lines.join('\n');
}

async function sendReport(report) {
  const pub = process.env.MJ_APIKEY_PUBLIC;
  const priv = process.env.MJ_APIKEY_PRIVATE;
  const from = process.env.EMAIL_FROM;
  const to = process.env.EMAIL_TO;
  if (!pub || !priv) throw new Error('MJ_APIKEY_PUBLIC / MJ_APIKEY_PRIVATE not set');
  if (!from || !to) throw new Error('EMAIL_FROM / EMAIL_TO not set');

  const mailjet = Mailjet.apiConnect(pub, priv);
  const result = await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [{
      From: { Email: from, Name: 'UniScout' },   // must be a validated Mailjet sender
      To: [{ Email: to }],
      Subject: report.subject,
      TextPart: buildText(report),
      HTMLPart: buildHtml(report),
      Headers: { 'List-Unsubscribe': '<mailto:' + from + '?subject=unsubscribe>' },
    }],
  });
  const status = result.body && result.body.Messages && result.body.Messages[0] && result.body.Messages[0].Status;
  log.ok('Mailjet accepted email — status', status || result.response.status, '→', to);
  return status;
}

module.exports = { sendReport, buildHtml, buildText };
