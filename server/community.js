'use strict';
/* ────────────────────────────────────────────────────────────────────────────
   UniVersity — community data + housing safety

   Admission results now live in admissions.js (the admissions data system).

   Housing scam check
      Paste a listing or the landlord's messages. A transparent rule engine
      (known scam patterns from police / university / platform guidance) and a
      model read it; the price is compared with typical rents for the city.
      Returns a 0–100 risk score, each red flag with the words that triggered
      it, and what to do next.
   ──────────────────────────────────────────────────────────────────────────── */
const crypto = require('crypto');

module.exports = function mountCommunity(app, deps) {
  const { store, synth, log, errlog } = deps;
  const DAY = 864e5;
  const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const hits = new Map();   // simple per-key rate limiting
  function limited(key, max, windowMs) {
    const now = Date.now(), h = (hits.get(key) || []).filter((t) => now - t < windowMs);
    h.push(now); hits.set(key, h);
    if (hits.size > 5000) hits.delete(hits.keys().next().value);
    return h.length > max;
  }
  const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  // Admission results moved to admissions.js (the admissions data system).

  /* ── housing scam check ──────────────────────────────────────── */
  // Patterns from police, university and platform guidance (see housing_data.js sources).
  const RULES = [
    { id: 'pay-method', w: 40, label: 'Untraceable payment', why: 'Wire transfers abroad, Western Union/MoneyGram, crypto, gift cards and “friends & family” payments can\'t be reversed — the classic way rent scammers get paid.',
      re: /\b(western union|moneygram|ria money|bitcoin|btc|usdt|crypto|gift ?cards?|paysafe|friends (and|&) family|money ?gram|wire (the|a|your) (money|deposit|rent)|wire transfer)\b/i },
    { id: 'pay-before', w: 35, label: 'Money before a viewing or contract', why: 'Real landlords let you see the place (in person or on a live video call) and sign a contract before any deposit.',
      re: /\b((pay|send|transfer|wire)( the| a| your)? (deposit|rent|money|payment)[^.]{0,60}(before|to (hold|reserve|secure|book))|(hold|reserve|secure)( the| this)? (room|flat|apartment|place)[^.]{0,40}(deposit|payment|transfer)|deposit (first|upfront|in advance)|\b(after|once|as soon as) you (have )?(pay|paid|send|sent|transfer|wire)\b)/i },
    { id: 'abroad', w: 30, label: 'Landlord is “abroad” and can\'t show it', why: 'The most common rental-fraud story: the owner lives in another country (work, mission, family) so you can\'t view it, but keys will follow after you pay.',
      re: /\b(i am|i'm|we are|currently|now) (living |working |based )?(abroad|overseas|out of the country|in (the )?(uk|usa|us|united states|england|canada|dubai|nigeria|australia))\b|\b(missionary|on a mission|offshore|oil rig|military deployment|deployed)\b|\b(can(not|'t)|unable to) (show|meet|do a viewing|view)\b|\b(i|we) (now )?(live|work|am living|am working) in [a-z]+ now\b|\bmanaged (by me )?remotely\b/i },
    { id: 'keys-post', w: 35, label: 'Keys sent by post or courier', why: 'Keys “by DHL / courier / an agent after payment” are a hallmark of fake listings — you\'ll never get them.',
      re: /\b(keys?)\b[^.]{0,60}\b(post|mail|courier|dhl|ups|fedex|deliver(ed|y)?|agent)\b|\b(courier|dhl|ups|fedex|agent|driver)\b[^.]{0,40}\b(deliver|bring|send)\w*[^.]{0,20}\bkeys?\b/i },
    { id: 'fake-escrow', w: 30, label: 'A platform name used off the platform', why: 'Scammers send their own “Airbnb / Booking.com / HousingAnywhere secure payment” links or invoices. Real platforms only take payment inside their own site or app.',
      re: /\b(airbnb|booking\.com|housinganywhere|spotahome|uniplaces)\b[^.]{0,80}\b(payment|invoice|transfer|link|hold|escrow|guarantee)\b/i },
    { id: 'urgency', w: 15, label: 'Pressure to decide fast', why: 'Urgency (“many people interested”, “first to pay gets it”) is used to stop you checking things.',
      re: /\b(many (other )?(people|students|applicants) (are )?interested|first (to pay|come,? first serve)|today only|within (the next )?(24|48) ?h|decide (now|quickly|today)|before someone else)\b/i },
    { id: 'id-early', w: 20, label: 'Asks for your passport or bank details early', why: 'A copy of your ID or bank card before a contract can be used for identity fraud.',
      re: /\b(send|need|copy of)( me)?( your)? (passport|id card|identity card|bank (card|details|statement)|card number|cvv)\b/i },
    { id: 'off-platform', w: 15, label: 'Moves you off the platform', why: 'Asking to continue on WhatsApp or private e-mail removes the platform\'s protection and its record of the conversation.',
      re: /\b(whatsapp|telegram|signal|text me|contact me (directly|at)|my (personal )?e-?mail|outside (of )?(the )?(site|app|platform))\b|@(gmail|yahoo|hotmail|outlook|proton)\./i },
    { id: 'no-contract', w: 20, label: 'No contract, or “sign later”', why: 'You should always get a written contract with the landlord\'s full name and the address before paying.',
      re: /\b(no (need for (a )?)?contract|contract (later|after|when you arrive)|don'?t need (a )?contract|without (a )?contract)\b/i },
  ];
  // typical monthly rent for a room / studio by country (local currency) — fallback when the city isn't known
  const TYPICAL = { gb: [700, 1100], us: [900, 1600], ch: [800, 1300], nl: [600, 950], se: [5000, 7500], de: [450, 700], fr: [500, 850], it: [450, 700], es: [450, 700], ie: [750, 1100], dk: [4500, 7000], fi: [450, 700], be: [450, 650], pt: [400, 600], ua: [6000, 12000] };

  app.post('/api/housing/scam-check', async (req, res) => {
    const b = req.body || {};
    const text = String(b.text || '').slice(0, 8000), url = clip(b.url, 400), price = +b.price || null, cc = clip(b.cc, 4).toLowerCase();
    if (text.trim().length < 30 && !url) return res.status(400).json({ error: 'short', message: 'Paste the listing text or the landlord\'s messages (a few sentences at least).' });
    if (limited('scam:' + ipOf(req), 30, 3600e3)) return res.status(429).json({ error: 'slow_down', message: 'Too many checks — try again in a bit.' });

    // 1. rules — transparent and always shown
    const flags = [];
    RULES.forEach((r) => { const m = text.match(r.re); if (m) flags.push({ id: r.id, w: r.w, label: r.label, why: r.why, quote: clip(m[0], 90), src: 'rule' }); });
    // price vs typical rent
    const typ = Array.isArray(b.typical) && b.typical.length === 2 ? b.typical.map(Number) : TYPICAL[cc];
    if (price && typ && typ[0]) {
      const ratio = price / typ[0];
      if (ratio < .55) flags.push({ id: 'price', w: 30, label: 'Far below the going rate', why: 'This is under half of what a room usually costs here (' + typ[0] + '–' + typ[1] + ' ' + (b.cur || '') + '). Too-cheap listings are the bait in most rental scams.', quote: String(price), src: 'rule' });
      else if (ratio < .75) flags.push({ id: 'price', w: 15, label: 'Cheaper than usual', why: 'Noticeably below typical rents here (' + typ[0] + '–' + typ[1] + ' ' + (b.cur || '') + '). Not proof of anything, but check it extra carefully.', quote: String(price), src: 'rule' });
    }
    // lookalike links
    if (url) {
      let host = ''; try { host = new URL(/^https?:/i.test(url) ? url : 'https://' + url).hostname.toLowerCase(); } catch (e) {}
      const brands = ['airbnb', 'booking', 'housinganywhere', 'spotahome', 'uniplaces', 'kamernet', 'idealista', 'rightmove', 'spareroom', 'wg-gesucht', 'daft'];
      const real = /(^|\.)(airbnb\.[a-z.]+|booking\.com|housinganywhere\.com|spotahome\.com|uniplaces\.com|kamernet\.nl|idealista\.(com|it|pt)|rightmove\.co\.uk|spareroom\.co\.uk|wg-gesucht\.de|daft\.ie)$/;
      if (host && brands.some((x) => host.indexOf(x) !== -1) && !real.test(host)) flags.push({ id: 'lookalike', w: 45, label: 'Lookalike website', why: 'The link uses a platform\'s name but isn\'t that platform\'s real address (' + host + '). Fake payment pages copy real sites to steal money and card details.', quote: host, src: 'rule' });
      if (/^http:\/\//i.test(url)) flags.push({ id: 'http', w: 10, label: 'Not a secure link', why: 'The page isn\'t served over HTTPS — never enter payment details there.', quote: url.slice(0, 60), src: 'rule' });
    }

    // 2. the model reads it like a careful friend would
    let ai = null;
    const client = await synth.getOpenAI();
    if (client && text.trim().length >= 30) {
      try {
        const r = await client.chat.completions.create({
          model: process.env.AI_PLAN_MODEL || 'openai/gpt-oss-20b', reasoning_effort: 'low', temperature: .1, max_tokens: 1400, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You help students avoid rental scams. Read the listing / messages and reply with JSON only: ' +
              '{"risk":0-100,"verdict":"likely_scam|suspicious|no_clear_red_flags","summary":"one plain sentence","flags":[{"label":"a 3-6 word name for the red flag","why":"one sentence","quote":"the exact words from the text"}],' +
              '"questions":["2-4 questions the student should ask the landlord"],"positives":["things that look legitimate, if any"]}. ' +
              'Judge only from the text. Typical scam signs: payment before viewing/contract, untraceable payment, landlord abroad, keys by post, fake platform payment links, urgency, too-good price, ID requests, moving off-platform. ' +
              'Do not invent flags; quote real words. A normal listing with no red flags should score below 25.' },
            { role: 'user', content: 'City/country: ' + clip(b.city, 60) + ' ' + cc.toUpperCase() + (price ? '\nAsked rent: ' + price + ' ' + (b.cur || '') + ' a month' : '') + (typ ? '\nTypical room rent here: ' + typ[0] + '–' + typ[1] : '') + (url ? '\nLink: ' + url : '') + '\n\nListing / messages:\n' + text },
          ],
        });
        ai = JSON.parse(r.choices[0].message.content || '{}');
      } catch (e) { errlog('scam ai:', e.message); }
    }

    // 3. combine: rules give a floor the model can't talk down
    const ruleScore = Math.min(100, flags.reduce((n, f) => n + f.w, 0));
    const aiScore = ai && isFinite(+ai.risk) ? Math.max(0, Math.min(100, +ai.risk)) : null;
    const score = Math.round(aiScore == null ? ruleScore : Math.max(ruleScore, aiScore * .7 + ruleScore * .3));
    const seen = {}; flags.forEach((f) => { seen[f.label.toLowerCase()] = 1; });
    (ai && Array.isArray(ai.flags) ? ai.flags : []).slice(0, 6).forEach((f) => {
      if (!f || !f.label || seen[String(f.label).toLowerCase()] || String(f.label).length < 4) return;
      const qq = String(f.quote || '').toLowerCase();
      if (qq && text.toLowerCase().indexOf(qq.slice(0, 40)) === -1) return;   // only flags grounded in the text
      if (qq && flags.some((g) => g.quote && (qq.indexOf(g.quote.toLowerCase()) !== -1 || g.quote.toLowerCase().indexOf(qq) !== -1))) return;   // same words a rule already caught
      flags.push({ id: 'ai', w: 0, label: clip(f.label, 60), why: clip(f.why, 220), quote: clip(f.quote, 90), src: 'ai' });
    });
    res.json({
      ok: true, score, level: score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low',
      summary: ai && ai.summary ? clip(ai.summary, 240) : (score >= 60 ? 'Several classic scam signs — don\'t send money.' : score >= 30 ? 'Some warning signs — verify before you pay anything.' : 'No classic scam signs in this text — still follow the safe steps.'),
      flags: flags.sort((a, b2) => b2.w - a.w), questions: ai && Array.isArray(ai.questions) ? ai.questions.slice(0, 4).map((q) => clip(q, 160)) : [],
      positives: ai && Array.isArray(ai.positives) ? ai.positives.slice(0, 3).map((q) => clip(q, 140)) : [], model: !!ai,
    });
  });
};
