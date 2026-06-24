# UniScout News Agent

A small backend agent (no chat UI — run it, get an email) that:

1. **Scrapes** the official websites of your **saved universities** (HTTP + Cheerio, no browser). It extracts only what's actually on the page — headline-like links, with dates when present.
2. **Rephrases** those scraped items into short, friendly language and classifies each as an **event** (something to attend / a deadline, with a date) or an **article** (news to read). This uses **OpenAI or Groq** — and only ever sees the scraped titles + URLs, so it can't invent news. Without a key it falls back to built-in phrasing.
3. **Emails** the report to you via **Mailjet**, with “Save to Deadlines” buttons for dated events.

> ℹ️ This is the standalone, official-site-scraper agent. UniScout also has an
> integrated, always-on digest in `../server` (Google News + your live saved list +
> a profile toggle + cron deploy). Use **one** of them so you don't get double emails.

```
agent/
├── config/watchlist.json   ← the universities to monitor (your saved favourites)
├── src/
│   ├── index.js            ← orchestrator
│   ├── scrape.js           ← HTTP scraping (Cheerio) — no model here
│   ├── analyze.js          ← OpenAI/Groq rephrase + event/article classification
│   ├── email.js            ← Mailjet delivery + HTML/text
│   └── logger.js
├── output/                 ← saved JSON reports
├── .env.example
└── package.json
```

## 1. Install
```
cd agent
npm install            # cheerio, dotenv, node-mailjet
```

## 2. Environment
```
cp .env.example .env
```
| Variable | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | optional | OpenAI (`sk-…`) **or** Groq (`gsk_…`) key. Without it, the agent still runs with built-in phrasing. |
| `OPENAI_MODEL` | optional | Defaults: OpenAI → `gpt-4o-mini`. A `gsk_` key auto-selects `llama-3.3-70b-versatile`. |
| `OPENAI_BASE_URL` | optional | Auto-set for Groq (`https://api.groq.com/openai/v1`). Override only for custom endpoints. |
| `MJ_APIKEY_PUBLIC` | ✅ (to send) | Mailjet **public** key — Account → REST API → API Key Management. |
| `MJ_APIKEY_PRIVATE` | ✅ (to send) | Mailjet **private** key. |
| `EMAIL_FROM` | ✅ (to send) | Must be a **validated Mailjet sender** (see step 3). |
| `EMAIL_TO` | ✅ (to send) | e.g. `ivan.kharytonchuk10@gmail.com` |
| `APP_BASE` | optional | Base URL the “Save to Deadlines” buttons open (your app). |
| `DRY_RUN` | optional | `true` = build + print the report but **don't** send. |

> This agent uses **Mailjet**, not SendGrid, and **OpenAI/Groq**, not Claude.
> Never commit `.env`.

## 3. Mailjet sender validation (one-time, required to send)
Mailjet rejects mail from an unvalidated address. In Mailjet:
**Senders & Domains → Add a sender** → enter `EMAIL_FROM` → click the link in the confirmation email Mailjet sends. (For production, validate a whole domain instead.)

## 4. Choose which universities
The agent only looks at the universities in [`config/watchlist.json`](config/watchlist.json). Replace the sample list with your saved favourites. To see your saved IDs from the app, open UniScout logged in and run in the browser console:
```js
const s = JSON.parse(localStorage.getItem('uniscout_session'));
console.log(JSON.parse(localStorage.getItem('us_saved_' + s.id) || '[]'));
```
Then add each as `{ "name": "…", "website": "https://…" }`. `news` is optional — the agent probes common `/news` paths automatically.

## 5. Run
```
npm run dry      # build + print the JSON report, DON'T email (testing)
npm start        # build + email it via Mailjet
```
You get the structured JSON on stdout, a copy in `output/`, and (unless dry) an email to `EMAIL_TO`.

## Report shape
```json
{
  "subject": "…",
  "summary": "…",
  "findings": [
    { "university": "…", "source": "official", "url": "…",
      "items": [ { "title": "…", "blurb": "…", "type": "event|article",
                   "dlType": "application|scholarship|openday|accommodation|interview|other",
                   "date": "YYYY-MM-DD|null", "url": "…" } ] }
  ],
  "warnings": [ "University X — no recent news found on its official site." ]
}
```

## How "no invented data" is enforced
- The scrape step is pure HTTP + Cheerio — the model never fetches the site.
- The model is handed **only** the scraped titles + URLs and told to use just those.
- Universities whose official site had no parseable news are listed honestly under `warnings` (not padded with guesses).

## Troubleshooting
- **Missing env vars …** → fill `.env` (Mailjet keys + `EMAIL_FROM`/`EMAIL_TO` are required to send).
- **Mailjet 403 / sender not validated** → validate `EMAIL_FROM` (step 3).
- **401 / invalid api key** from the model → bad/empty `OPENAI_API_KEY` (or wrong `OPENAI_BASE_URL` for your key type). The agent will fall back to built-in phrasing.
- **A university shows under `warnings`** → its official site had no parseable news (there's no web fallback in this version).
- Run `npm run dry` first to confirm the report looks right before sending.
