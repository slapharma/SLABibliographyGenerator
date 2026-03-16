# SLA Bibliography Generator

Internal web app for SLA Pharma that searches **8 clinical literature databases simultaneously**, manages named bibliography collections, and exports to CSV or Excel.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS v4 · Netlify Functions · Neon Postgres (via Netlify DB)

---

## Sources

| Source | Coverage | API Key |
|--------|----------|---------|
| PubMed | 36M+ biomedical articles | Optional (raises rate limit) |
| Europe PMC | 42M records incl. EU content | None required |
| ClinicalTrials.gov | All registered clinical trials | None required |
| Semantic Scholar | 214M papers + citation data | Optional |
| CrossRef | 170M DOI records | None required |
| OpenAlex | 250M works, open access | None required |
| Lens.org | 214M articles + patents | **Required** (free) |
| Google Scholar | General web search | **Required** (SerpAPI, free tier) |

---

## Deploy to Netlify (5 minutes)

### 1. Push to GitHub

```bash
git remote add origin https://github.com/slapharma/SLABibliographyGenerator.git
git push -u origin develop
```

### 2. Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com) → **Add new site → Import from Git**
2. Select your GitHub repo
3. Build settings are auto-detected from `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. Click **Deploy site**

### 3. Enable Netlify DB

1. In Netlify dashboard → your site → **Integrations → Databases**
2. Click **Enable Netlify DB** — this provisions a Neon Postgres database and injects `DATABASE_URL` automatically
3. Redeploy the site (or it will run on the next push)

> The app runs `CREATE TABLE IF NOT EXISTS` on first cold start — no manual migration needed.

### 4. Add optional API keys (recommended)

In Netlify → **Site configuration → Environment variables**:

| Variable | Where to get it | Effect if missing |
|----------|----------------|-------------------|
| `LENS_API_KEY` | [lens.org/user/subscriptions](https://www.lens.org/lens/user/subscriptions) | Lens.org results hidden |
| `SERPAPI_KEY` | [serpapi.com](https://serpapi.com) | Google Scholar chip hidden |
| `PUBMED_API_KEY` | [ncbi.nlm.nih.gov/account](https://www.ncbi.nlm.nih.gov/account/) | PubMed rate-limited to 3 req/sec |
| `SEMANTIC_SCHOLAR_KEY` | [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api) | Semantic Scholar rate-limited |

After adding variables, **redeploy** (Deploys → Trigger deploy).

---

## Local development

```bash
# 1. Install deps
npm install

# 2. Copy env template
cp .env.example .env.local
# Edit .env.local and add your DATABASE_URL from Netlify dashboard

# 3. Start local dev server (uses Netlify CLI)
npm run dev
# → http://localhost:8888
```

> Netlify CLI proxies `/api/*` requests to your local functions automatically.

---

## Features

- **Search** — Run all 8 sources simultaneously with `Promise.allSettled` (one slow source never blocks the others)
- **Bibliographies** — Create named collections, add/remove papers, export to CSV or Excel
- **Saved searches** — Save search parameters as templates, load and re-run in one click
- **History** — Every search is auto-logged; re-run or delete entries

---

## Tests

```bash
npm test          # Run all tests once
npm run test:watch  # Watch mode
```

17 unit tests covering all source adapters and export utilities. Integration DB test requires `DATABASE_URL`.
