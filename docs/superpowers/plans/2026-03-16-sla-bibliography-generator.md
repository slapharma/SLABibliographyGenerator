# SLA Bibliography Generator — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack internal web app for SLA Pharma that searches 8 clinical literature databases simultaneously, manages named bibliography collections, and exports results to CSV/Excel — deployed automatically from GitHub to Netlify.

**Architecture:** React + Vite SPA on Netlify static hosting, calling Netlify Functions (serverless Node.js) as the API layer, with Netlify DB (Neon/Postgres) for persistent storage. All 8 source adapters run in parallel inside a single `search` function using `Promise.allSettled`, so a slow or failing source never blocks the others.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS v4, React Router v6, Netlify Functions v2, Neon serverless Postgres (`@neondatabase/serverless`), Drizzle ORM, Vitest, xlsx (SheetJS)

---

## Source API Reference

| Source | Base URL | Auth | Notes |
|--------|----------|------|-------|
| PubMed | `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/` | None (key optional, raises rate limit) | E-search + E-fetch |
| Europe PMC | `https://www.ebi.ac.uk/europepmc/webservices/rest/` | None | `search` endpoint |
| ClinicalTrials.gov | `https://clinicaltrials.gov/api/v2/studies` | None | v2 REST API |
| Semantic Scholar | `https://api.semanticscholar.org/graph/v1/` | None (key optional) | `paper/search` |
| CrossRef | `https://api.crossref.org/works` | None | `mailto` polite pool |
| OpenAlex | `https://api.openalex.org/works` | None | `mailto` polite pool |
| Lens.org | `https://api.lens.org/scholarly/search` | **API key required** — free at lens.org | Bearer token |
| Google Scholar | n/a | **SerpAPI key required** — free tier available | Env var `SERPAPI_KEY` |

> **Env vars needed in Netlify dashboard:**
> - `DATABASE_URL` — auto-injected by Netlify DB (enable in dashboard)
> - `LENS_API_KEY` — free from lens.org/user/subscriptions
> - `SERPAPI_KEY` — optional, free tier at serpapi.com; if absent, Google Scholar tab is hidden

---

## File Structure

```
SLABibliographyGenerator/
├── netlify.toml                        # Build config + API redirect rules
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── index.html
│
├── src/
│   ├── main.tsx                        # React root mount
│   ├── App.tsx                         # Router + Layout shell
│   ├── index.css                       # Tailwind v4 + global tokens
│   │
│   ├── types/
│   │   └── index.ts                    # All shared TS interfaces (Paper, Bibliography, SavedSearch, HistoryEntry)
│   │
│   ├── lib/
│   │   ├── api.ts                      # Typed fetch helpers wrapping /api/* endpoints
│   │   └── export.ts                   # CSV and Excel (xlsx) export utilities
│   │
│   ├── components/
│   │   ├── Layout.tsx                  # Sidebar nav + main content area
│   │   ├── SourceSelector.tsx          # 4×2 grid of toggleable source chips
│   │   ├── SearchForm.tsx              # Search inputs form (uses SourceSelector)
│   │   ├── ResultCard.tsx              # Single result card with add-to-bib action
│   │   ├── ResultsList.tsx             # Results list with per-source tally header
│   │   ├── BibliographyCard.tsx        # Card in the bibliographies grid
│   │   ├── NewBibliographyModal.tsx    # Create/edit bibliography dialog
│   │   ├── PaperRow.tsx                # Paper row inside bibliography detail
│   │   ├── SavedSearchCard.tsx         # Saved search row with Load & Run action
│   │   └── HistoryRow.tsx              # Search history row with Re-run action
│   │
│   └── pages/
│       ├── SearchPage.tsx              # Main search + results page
│       ├── BibliographiesPage.tsx      # Grid of all bibliography collections
│       ├── BibliographyDetailPage.tsx  # Papers inside one collection + export
│       ├── SavedSearchesPage.tsx       # List of saved search templates
│       └── HistoryPage.tsx             # Auto-logged search history
│
└── netlify/
    └── functions/
        ├── _db.ts                      # Neon client + Drizzle schema + migrate()
        ├── _sources/
        │   ├── types.ts                # SourceResult interface shared by all adapters
        │   ├── pubmed.ts
        │   ├── europepmc.ts
        │   ├── clinicaltrials.ts
        │   ├── semanticscholar.ts
        │   ├── crossref.ts
        │   ├── openalex.ts
        │   ├── lens.ts
        │   └── scholar.ts              # Google Scholar via SerpAPI (no-ops if key absent)
        ├── search.ts                   # POST /api/search — fans out to all enabled sources
        ├── bibliographies.ts           # GET/POST /api/bibliographies
        ├── bibliography.ts             # GET/PATCH/DELETE /api/bibliography?id=
        ├── bibliography-papers.ts      # POST/DELETE /api/bibliography-papers
        ├── saved-searches.ts           # GET/POST/DELETE /api/saved-searches
        └── history.ts                  # GET/POST/DELETE /api/history

tests/
├── unit/
│   ├── sources/
│   │   ├── pubmed.test.ts
│   │   ├── europepmc.test.ts
│   │   ├── semanticscholar.test.ts
│   │   ├── crossref.test.ts
│   │   └── openalex.test.ts
│   └── export.test.ts
└── integration/
    └── db.test.ts
```

---

## Chunk 1: Project Scaffold & Config

### Task 1: Initialise the repo and toolchain

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `netlify.toml`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/index.css`

- [ ] **Step 1: Install dependencies**

```bash
cd SLABibliographyGenerator
npm create vite@latest . -- --template react-ts --yes
npm install react-router-dom @neondatabase/serverless drizzle-orm xlsx
npm install -D @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest @vitest/ui drizzle-kit @netlify/functions
```

- [ ] **Step 2: Configure Vite**

Replace `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 3: Configure Netlify**

Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

- [ ] **Step 4: Add scripts to package.json**

Add to `scripts`:
```json
{
  "dev": "netlify dev",
  "build": "vite build",
  "test": "vitest run",
  "test:watch": "vitest",
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push"
}
```

- [ ] **Step 5: Set up Tailwind CSS v4**

Replace `src/index.css`:
```css
@import "tailwindcss";

@theme {
  --color-navy-900: #1a2a4a;
  --color-navy-800: #1a3a6b;
  --color-navy-700: #1a4a8a;
  --color-gold-500: #c8a84b;
  --color-gold-400: #d4b86a;
  --font-display: "Playfair Display", Georgia, serif;
  --font-body: "Inter", system-ui, sans-serif;
}
```

Add to `index.html` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: scaffold project — Vite + React + Tailwind v4 + Netlify config"
```

---

### Task 2: TypeScript types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write the types**

```ts
// src/types/index.ts

export type Source =
  | 'pubmed'
  | 'europepmc'
  | 'clinicaltrials'
  | 'semanticscholar'
  | 'crossref'
  | 'openalex'
  | 'lens'
  | 'scholar'

export interface Paper {
  id: string              // source:externalId  e.g. "pubmed:38123456"
  source: Source
  title: string
  authors: string[]
  journal?: string
  year?: number
  doi?: string
  url: string
  abstract?: string
  type?: string           // "RCT", "Review", "Patent", etc.
  citationCount?: number  // Semantic Scholar only
}

export interface SearchParams {
  indication: string
  keywords: string
  paperType: string
  dateFrom: string
  dateTo: string
  sources: Source[]
}

export interface SourceResult {
  source: Source
  papers: Paper[]
  error?: string
}

export interface SearchResponse {
  results: SourceResult[]
  totalCount: number
}

export interface Bibliography {
  id: number
  name: string
  description: string
  createdAt: string
  updatedAt: string
  paperCount: number
}

export interface BibliographyPaperRow {
  rowId: number   // bibliography_papers.id — needed for DELETE
  paper: Paper
}

export interface BibliographyWithPapers extends Bibliography {
  papers: BibliographyPaperRow[]
}

export interface SavedSearch {
  id: number
  name: string
  params: SearchParams
  createdAt: string
}

export interface HistoryEntry {
  id: number
  params: SearchParams
  resultCount: number
  searchedAt: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Chunk 2: Database Layer

### Task 3: Netlify DB schema + Drizzle client

**Files:**
- Create: `netlify/functions/_db.ts`
- Create: `drizzle.config.ts`

- [ ] **Step 0: Create drizzle.config.ts**

```ts
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './netlify/functions/_db.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config
```

> **One-time Netlify setup:** In the Netlify dashboard → your site → Integrations → Databases → Enable Netlify DB. This injects `DATABASE_URL` automatically. For local dev, copy the connection string to `.env.local`.

- [ ] **Step 1: Write failing test**

Create `tests/integration/db.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { getDb, migrate } from '../../netlify/functions/_db'

describe('database schema', () => {
  beforeAll(async () => {
    // Uses DATABASE_URL from .env.local
    await migrate()
  })

  it('creates tables without throwing', async () => {
    const db = getDb()
    // If tables don't exist, this throws
    const bibs = await db.query.bibliographies.findMany()
    expect(Array.isArray(bibs)).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

```bash
npm test tests/integration/db.test.ts
```
Expected: `Cannot find module '../../netlify/functions/_db'`

- [ ] **Step 3: Implement `_db.ts`**

```ts
// netlify/functions/_db.ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { pgTable, serial, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'

// ── Schema ───────────────────────────────────────────────
export const bibliographies = pgTable('bibliographies', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const bibliographyPapers = pgTable('bibliography_papers', {
  id: serial('id').primaryKey(),
  bibliographyId: integer('bibliography_id').notNull().references(() => bibliographies.id, { onDelete: 'cascade' }),
  paperData: jsonb('paper_data').notNull(), // stores the full Paper object
  addedAt: timestamp('added_at').defaultNow().notNull(),
})

export const savedSearches = pgTable('saved_searches', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  params: jsonb('params').notNull(), // stores SearchParams object
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const searchHistory = pgTable('search_history', {
  id: serial('id').primaryKey(),
  params: jsonb('params').notNull(),
  resultCount: integer('result_count').notNull().default(0),
  searchedAt: timestamp('searched_at').defaultNow().notNull(),
})

const schema = { bibliographies, bibliographyPapers, savedSearches, searchHistory }

// ── Client ───────────────────────────────────────────────
let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!)
    _db = drizzle(sql, { schema })
  }
  return _db
}

// ── Migrations (run once per cold start) ─────────────────
export async function migrate() {
  const db = getDb()
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bibliographies (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bibliography_papers (
      id SERIAL PRIMARY KEY,
      bibliography_id INTEGER NOT NULL REFERENCES bibliographies(id) ON DELETE CASCADE,
      paper_data JSONB NOT NULL,
      added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_searches (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      params JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    CREATE TABLE IF NOT EXISTS search_history (
      id SERIAL PRIMARY KEY,
      params JSONB NOT NULL,
      result_count INTEGER NOT NULL DEFAULT 0,
      searched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
  `)
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
npm test tests/integration/db.test.ts
```
Expected: `✓ creates tables without throwing`

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_db.ts tests/integration/db.test.ts
git commit -m "feat: add Drizzle schema + Neon DB client with auto-migrate"
```

---

## Chunk 3: Search Source Adapters

All adapters must implement:
```ts
async function search(params: SearchParams): Promise<Paper[]>
```

### Task 4: Source types + PubMed adapter

**Files:**
- Create: `netlify/functions/_sources/types.ts`
- Create: `netlify/functions/_sources/pubmed.ts`
- Create: `tests/unit/sources/pubmed.test.ts`

- [ ] **Step 1: Create shared source types**

```ts
// netlify/functions/_sources/types.ts
export type { SearchParams, Paper, Source } from '../../src/types/index'
```

- [ ] **Step 2: Write PubMed test**

```ts
// tests/unit/sources/pubmed.test.ts
import { describe, it, expect, vi } from 'vitest'
import { searchPubMed } from '../../../netlify/functions/_sources/pubmed'

// Mock fetch so tests run offline
vi.stubGlobal('fetch', vi.fn())

describe('searchPubMed', () => {
  it('returns empty array when fetch returns no results', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ esearchresult: { idlist: [] } }) } as any)

    const results = await searchPubMed({
      indication: 'hypertension', keywords: '', paperType: '',
      dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['pubmed']
    })
    expect(results).toEqual([])
  })

  it('maps PubMed fields to Paper interface correctly', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ esearchresult: { idlist: ['12345678'] } })
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            '12345678': {
              uid: '12345678',
              title: 'Test Paper Title',
              authors: [{ name: 'Smith J' }],
              fulljournalname: 'Test Journal',
              pubdate: '2023',
              articleids: [{ idtype: 'doi', value: '10.1234/test' }],
              source: 'TJ',
            }
          }
        })
      } as any)

    const results = await searchPubMed({
      indication: 'hypertension', keywords: 'ACE inhibitor', paperType: 'RCT',
      dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['pubmed']
    })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('pubmed:12345678')
    expect(results[0].source).toBe('pubmed')
    expect(results[0].title).toBe('Test Paper Title')
    expect(results[0].doi).toBe('10.1234/test')
  })
})
```

- [ ] **Step 3: Run — expect FAIL**

```bash
npm test tests/unit/sources/pubmed.test.ts
```
Expected: `Cannot find module '../../../netlify/functions/_sources/pubmed'`

- [ ] **Step 4: Implement PubMed adapter**

```ts
// netlify/functions/_sources/pubmed.ts
import type { SearchParams, Paper } from './types'

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const KEY = process.env.PUBMED_API_KEY ? `&api_key=${process.env.PUBMED_API_KEY}` : ''

export async function searchPubMed(params: SearchParams): Promise<Paper[]> {
  const query = buildQuery(params)
  const minDate = params.dateFrom.replace(/-/g, '/')
  const maxDate = params.dateTo.replace(/-/g, '/')

  const searchUrl = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=50&datetype=pdat&mindate=${minDate}&maxdate=${maxDate}&retmode=json${KEY}`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) return []
  const searchData = await searchRes.json()
  const ids: string[] = searchData.esearchresult?.idlist ?? []
  if (ids.length === 0) return []

  const fetchRes = await fetch(`${BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${KEY}`)
  if (!fetchRes.ok) return []
  const fetchData = await fetchRes.json()

  return ids.map((id): Paper => {
    const rec = fetchData.result?.[id] ?? {}
    const doi = rec.articleids?.find((a: any) => a.idtype === 'doi')?.value
    return {
      id: `pubmed:${id}`,
      source: 'pubmed',
      title: rec.title ?? 'Unknown Title',
      authors: (rec.authors ?? []).map((a: any) => a.name),
      journal: rec.fulljournalname ?? rec.source,
      year: rec.pubdate ? parseInt(rec.pubdate.slice(0, 4)) : undefined,
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      abstract: rec.abstract,
      type: params.paperType || undefined,
    }
  }).filter(p => p.title !== 'Unknown Title')
}

function buildQuery(params: SearchParams): string {
  const parts: string[] = []
  if (params.indication) parts.push(params.indication)
  if (params.keywords) parts.push(params.keywords)
  if (params.paperType) {
    const typeMap: Record<string, string> = {
      'RCT': 'randomized controlled trial[pt]',
      'Systematic Review': 'systematic review[pt]',
      'Meta-Analysis': 'meta-analysis[pt]',
      'Observational': 'observational study[pt]',
    }
    const mapped = typeMap[params.paperType]
    if (mapped) parts.push(mapped)
  }
  return parts.join(' AND ')
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
npm test tests/unit/sources/pubmed.test.ts
```
Expected: `✓ 2 tests pass`

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/_sources/ tests/unit/sources/pubmed.test.ts
git commit -m "feat: add PubMed search adapter with tests"
```

---

### Task 5: Europe PMC, Semantic Scholar, CrossRef, OpenAlex adapters

**Files:**
- Create: `netlify/functions/_sources/europepmc.ts`
- Create: `netlify/functions/_sources/semanticscholar.ts`
- Create: `netlify/functions/_sources/crossref.ts`
- Create: `netlify/functions/_sources/openalex.ts`
- Create: `tests/unit/sources/europepmc.test.ts`
- Create: `tests/unit/sources/semanticscholar.test.ts`
- Create: `tests/unit/sources/crossref.test.ts`
- Create: `tests/unit/sources/openalex.test.ts`

> Tests follow the same fetch-mock pattern as Task 4. Write one test per adapter: (a) empty result, (b) field mapping.

- [ ] **Step 1: Write the 4 tests (empty + mapping for each)**

```ts
// tests/unit/sources/europepmc.test.ts
import { describe, it, expect, vi } from 'vitest'
import { searchEuropePMC } from '../../../netlify/functions/_sources/europepmc'
vi.stubGlobal('fetch', vi.fn())
describe('searchEuropePMC', () => {
  it('returns empty array on no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ resultList: { result: [] } }) } as any)
    const r = await searchEuropePMC({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['europepmc'] })
    expect(r).toEqual([])
  })
  it('maps europepmc fields to Paper', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({
        resultList: { result: [{ id: 'PMC123', source: 'MED', title: 'EU Paper', authorString: 'Smith J, Doe A', journalTitle: 'EHJ', pubYear: '2022', doi: '10.1/eu' }] }
      })
    } as any)
    const r = await searchEuropePMC({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['europepmc'] })
    expect(r[0].id).toBe('europepmc:PMC123')
    expect(r[0].authors).toEqual(['Smith J', 'Doe A'])
  })
})
```

Write equivalent tests for `semanticscholar`, `crossref`, `openalex` following the same pattern.

- [ ] **Step 2: Run — expect FAIL × 4**

```bash
npm test tests/unit/sources/
```

- [ ] **Step 3: Implement Europe PMC**

```ts
// netlify/functions/_sources/europepmc.ts
import type { SearchParams, Paper } from './types'

export async function searchEuropePMC(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' AND ')
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=50&fromDate=${params.dateFrom}&toDate=${params.dateTo}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.resultList?.result ?? []).map((r: any): Paper => ({
    id: `europepmc:${r.id}`,
    source: 'europepmc',
    title: r.title ?? 'Unknown',
    authors: r.authorString ? r.authorString.split(', ') : [],
    journal: r.journalTitle,
    year: r.pubYear ? parseInt(r.pubYear) : undefined,
    doi: r.doi,
    url: `https://europepmc.org/article/${r.source}/${r.id}`,
    abstract: r.abstractText,
  }))
}
```

- [ ] **Step 4: Implement Semantic Scholar**

```ts
// netlify/functions/_sources/semanticscholar.ts
import type { SearchParams, Paper } from './types'

export async function searchSemanticScholar(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=50&fields=title,authors,year,journal,externalIds,abstract,citationCount,publicationTypes`
  // API key must be sent as a request header, not a query param
  const headers: Record<string, string> = {}
  if (process.env.SEMANTIC_SCHOLAR_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_KEY
  const res = await fetch(url, { headers })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data ?? []).map((p: any): Paper => ({
    id: `semanticscholar:${p.paperId}`,
    source: 'semanticscholar',
    title: p.title ?? 'Unknown',
    authors: (p.authors ?? []).map((a: any) => a.name),
    journal: p.journal?.name,
    year: p.year,
    doi: p.externalIds?.DOI,
    url: `https://www.semanticscholar.org/paper/${p.paperId}`,
    abstract: p.abstract,
    citationCount: p.citationCount,
    type: p.publicationTypes?.[0],
  }))
}
```

- [ ] **Step 5: Implement CrossRef**

```ts
// netlify/functions/_sources/crossref.ts
import type { SearchParams, Paper } from './types'

export async function searchCrossRef(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=50&filter=from-pub-date:${params.dateFrom},until-pub-date:${params.dateTo}&mailto=info@slapharma.com`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.message?.items ?? []).map((item: any): Paper => {
    const doi = item.DOI
    const year = item.published?.['date-parts']?.[0]?.[0]
    return {
      id: `crossref:${doi}`,
      source: 'crossref',
      title: Array.isArray(item.title) ? item.title[0] : item.title ?? 'Unknown',
      authors: (item.author ?? []).map((a: any) => `${a.family ?? ''} ${a.given?.[0] ?? ''}`.trim()),
      journal: item['container-title']?.[0],
      year,
      doi,
      url: `https://doi.org/${doi}`,
      type: item.type,
    }
  })
}
```

- [ ] **Step 6: Implement OpenAlex**

```ts
// netlify/functions/_sources/openalex.ts
import type { SearchParams, Paper } from './types'

export async function searchOpenAlex(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=50&filter=publication_year:${params.dateFrom.slice(0,4)}-${params.dateTo.slice(0,4)}&mailto=info@slapharma.com`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map((w: any): Paper => ({
    id: `openalex:${w.id}`,
    source: 'openalex',
    title: w.title ?? 'Unknown',
    authors: (w.authorships ?? []).map((a: any) => a.author?.display_name ?? ''),
    journal: w.primary_location?.source?.display_name,
    year: w.publication_year,
    doi: w.doi?.replace('https://doi.org/', ''),
    url: w.primary_location?.landing_page_url ?? w.id,
    abstract: w.abstract_inverted_index ? rebuildAbstract(w.abstract_inverted_index) : undefined,
  }))
}

// OpenAlex stores abstracts as inverted index {word: [positions]}
function rebuildAbstract(inv: Record<string, number[]>): string {
  const words: string[] = []
  for (const [word, positions] of Object.entries(inv)) {
    for (const pos of positions) words[pos] = word
  }
  return words.join(' ')
}
```

- [ ] **Step 7: Run — expect PASS × 8 (4 adapters × 2 tests)**

```bash
npm test tests/unit/sources/
```

- [ ] **Step 8: Commit**

```bash
git add netlify/functions/_sources/ tests/unit/sources/
git commit -m "feat: add Europe PMC, Semantic Scholar, CrossRef, OpenAlex adapters"
```

---

### Task 6: ClinicalTrials.gov, Lens.org, Google Scholar adapters

**Files:**
- Create: `netlify/functions/_sources/clinicaltrials.ts`
- Create: `netlify/functions/_sources/lens.ts`
- Create: `netlify/functions/_sources/scholar.ts`
- Create: `tests/unit/sources/clinicaltrials.test.ts`
- Create: `tests/unit/sources/lens.test.ts`
- Create: `tests/unit/sources/scholar.test.ts`

- [ ] **Step 0: Write failing tests**

```ts
// tests/unit/sources/clinicaltrials.test.ts
import { describe, it, expect, vi } from 'vitest'
import { searchClinicalTrials } from '../../../netlify/functions/_sources/clinicaltrials'
vi.stubGlobal('fetch', vi.fn())
describe('searchClinicalTrials', () => {
  it('returns empty array on no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ studies: [] }) } as any)
    const r = await searchClinicalTrials({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['clinicaltrials'] })
    expect(r).toEqual([])
  })
  it('maps NCT fields to Paper', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({ studies: [{
        protocolSection: {
          identificationModule: { nctId: 'NCT123', briefTitle: 'Test Trial' },
          descriptionModule: { briefSummary: 'A summary' },
          statusModule: { startDateStruct: { date: '2022-01' } },
          designModule: { studyType: 'Interventional' },
          contactsLocationsModule: { overallOfficials: [{ name: 'Dr Smith' }] },
        }
      }] })
    } as any)
    const r = await searchClinicalTrials({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['clinicaltrials'] })
    expect(r[0].id).toBe('clinicaltrials:NCT123')
    expect(r[0].type).toBe('Interventional')
  })
})
```

```ts
// tests/unit/sources/lens.test.ts
import { describe, it, expect, vi } from 'vitest'
import { searchLens } from '../../../netlify/functions/_sources/lens'
vi.stubGlobal('fetch', vi.fn())
describe('searchLens', () => {
  it('returns empty array when no API key is set', async () => {
    delete process.env.LENS_API_KEY
    const r = await searchLens({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['lens'] })
    expect(r).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
  it('maps Lens fields to Paper when key is present', async () => {
    process.env.LENS_API_KEY = 'test-key'
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({ data: [{ lens_id: 'L1', title: 'Lens Paper', authors: [{ display_name: 'Jones A' }], year_published: 2021, source: { title: 'Nature' }, doi: '10.1/l', abstract: 'abs' }] })
    } as any)
    const r = await searchLens({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['lens'] })
    expect(r[0].id).toBe('lens:L1')
    expect(r[0].authors).toEqual(['Jones A'])
    delete process.env.LENS_API_KEY
  })
})
```

```ts
// tests/unit/sources/scholar.test.ts
import { describe, it, expect, vi } from 'vitest'
import { searchScholar } from '../../../netlify/functions/_sources/scholar'
vi.stubGlobal('fetch', vi.fn())
describe('searchScholar', () => {
  it('returns empty array and skips fetch when SERPAPI_KEY is absent', async () => {
    delete process.env.SERPAPI_KEY
    const r = await searchScholar({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['scholar'] })
    expect(r).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 0b: Run — expect FAIL × 3**

```bash
npm test tests/unit/sources/clinicaltrials.test.ts tests/unit/sources/lens.test.ts tests/unit/sources/scholar.test.ts
```
Expected: `Cannot find module` for all three adapters.

- [ ] **Step 1: Implement ClinicalTrials.gov**

```ts
// netlify/functions/_sources/clinicaltrials.ts
import type { SearchParams, Paper } from './types'

export async function searchClinicalTrials(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const url = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(query)}&pageSize=50&format=json`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.studies ?? []).map((s: any): Paper => {
    const p = s.protocolSection
    const id = p?.identificationModule?.nctId ?? 'unknown'
    return {
      id: `clinicaltrials:${id}`,
      source: 'clinicaltrials',
      title: p?.identificationModule?.briefTitle ?? 'Unknown Trial',
      authors: [p?.contactsLocationsModule?.overallOfficials?.[0]?.name ?? 'Unknown PI'],
      journal: 'ClinicalTrials.gov',
      year: p?.statusModule?.startDateStruct?.date
        ? parseInt(p.statusModule.startDateStruct.date.slice(0, 4))
        : undefined,
      url: `https://clinicaltrials.gov/study/${id}`,
      abstract: p?.descriptionModule?.briefSummary,
      type: p?.designModule?.studyType,
    }
  })
}
```

- [ ] **Step 2: Implement Lens.org**

```ts
// netlify/functions/_sources/lens.ts
import type { SearchParams, Paper } from './types'

export async function searchLens(params: SearchParams): Promise<Paper[]> {
  const key = process.env.LENS_API_KEY
  if (!key) return []  // silently skip if key not configured

  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const body = {
    query: {
      bool: {
        must: [{ query_string: { query } }],
        filter: [
          { range: { year_published: { gte: parseInt(params.dateFrom.slice(0, 4)), lte: parseInt(params.dateTo.slice(0, 4)) } } }
        ],
      },
    },
    size: 50,
    sort: [{ year_published: 'desc' }],
    include: ['lens_id', 'title', 'authors', 'year_published', 'source', 'doi', 'abstract', 'publication_type'],
  }
  const res = await fetch('https://api.lens.org/scholarly/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data ?? []).map((d: any): Paper => ({
    id: `lens:${d.lens_id}`,
    source: 'lens',
    title: d.title ?? 'Unknown',
    authors: (d.authors ?? []).map((a: any) => a.display_name ?? [a.last_name, a.first_name].filter(Boolean).join(' ')),
    journal: d.source?.title,
    year: d.year_published,
    doi: d.doi,
    url: `https://www.lens.org/lens/scholar/article/${d.lens_id}`,
    abstract: d.abstract,
    type: d.publication_type,
  }))
}
```

- [ ] **Step 3: Implement Google Scholar (SerpAPI, graceful no-op)**

```ts
// netlify/functions/_sources/scholar.ts
import type { SearchParams, Paper } from './types'

export async function searchScholar(params: SearchParams): Promise<Paper[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) return []  // silently skip — UI hides the chip when key absent

  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const url = `https://serpapi.com/search?engine=google_scholar&q=${encodeURIComponent(query)}&as_ylo=${params.dateFrom.slice(0,4)}&as_yhi=${params.dateTo.slice(0,4)}&api_key=${key}&num=20`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.organic_results ?? []).map((r: any): Paper => ({
    id: `scholar:${r.result_id ?? encodeURIComponent(r.title)}`,
    source: 'scholar',
    title: r.title ?? 'Unknown',
    authors: r.publication_info?.authors?.map((a: any) => a.name) ?? [],
    journal: r.publication_info?.summary?.split(' - ')[1],
    year: r.publication_info?.summary ? parseInt(r.publication_info.summary.match(/\d{4}/)?.[0] ?? '0') : undefined,
    url: r.link ?? '',
    abstract: r.snippet,
  }))
}
```

- [ ] **Step 4: Run tests — expect PASS × 5**

```bash
npm test tests/unit/sources/clinicaltrials.test.ts tests/unit/sources/lens.test.ts tests/unit/sources/scholar.test.ts
```
Expected: `✓ 5 tests pass`

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/_sources/clinicaltrials.ts netlify/functions/_sources/lens.ts netlify/functions/_sources/scholar.ts tests/unit/sources/
git commit -m "feat: add ClinicalTrials, Lens.org, Google Scholar adapters with tests"
```

---

## Chunk 4: API Functions

### Task 7: Search function (fan-out)

**Files:**
- Create: `netlify/functions/search.ts`

`★ Insight: Promise.allSettled fires all 8 source fetches simultaneously. Unlike Promise.all, a rejected promise (e.g. Lens.org timeout) does not cancel the others — each resolves independently. The UI gets all available results even if one source fails.`

- [ ] **Step 1: Implement search function**

```ts
// netlify/functions/search.ts
import type { Config, Context } from '@netlify/functions'
import { getDb, searchHistory, migrate } from './_db'
import { searchPubMed } from './_sources/pubmed'
import { searchEuropePMC } from './_sources/europepmc'
import { searchClinicalTrials } from './_sources/clinicaltrials'
import { searchSemanticScholar } from './_sources/semanticscholar'
import { searchCrossRef } from './_sources/crossref'
import { searchOpenAlex } from './_sources/openalex'
import { searchLens } from './_sources/lens'
import { searchScholar } from './_sources/scholar'
import type { SearchParams, Source, SourceResult } from '../src/types/index'

const HANDLERS: Record<Source, (p: SearchParams) => Promise<any[]>> = {
  pubmed: searchPubMed,
  europepmc: searchEuropePMC,
  clinicaltrials: searchClinicalTrials,
  semanticscholar: searchSemanticScholar,
  crossref: searchCrossRef,
  openalex: searchOpenAlex,
  lens: searchLens,
  scholar: searchScholar,
}

export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  await migrate() // idempotent — creates tables if first cold start

  const params: SearchParams = await req.json()
  const sources = params.sources.filter(s => s in HANDLERS)

  const settled = await Promise.allSettled(
    sources.map(source => HANDLERS[source](params).then(papers => ({ source, papers, error: undefined })))
  )

  const results: SourceResult[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: sources[i], papers: [], error: (r.reason as Error).message }
  )

  const totalCount = results.reduce((n, r) => n + r.papers.length, 0)

  // Log to history (fire and forget — don't block response)
  getDb().insert(searchHistory).values({
    params: params as any,
    resultCount: totalCount,
  }).catch(console.error)

  return new Response(JSON.stringify({ results, totalCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config: Config = { path: '/api/search' }
```

- [ ] **Step 2: Commit**

```bash
git add netlify/functions/search.ts
git commit -m "feat: search Netlify function — parallel fan-out to all 8 sources"
```

---

### Task 8: Bibliographies, Saved Searches, History API functions

**Files:**
- Create: `netlify/functions/bibliographies.ts`
- Create: `netlify/functions/bibliography.ts`
- Create: `netlify/functions/bibliography-papers.ts`
- Create: `netlify/functions/saved-searches.ts`
- Create: `netlify/functions/history.ts`

- [ ] **Step 1: Implement bibliographies (list + create)**

```ts
// netlify/functions/bibliographies.ts
import type { Config } from '@netlify/functions'
import { getDb, migrate, bibliographies, bibliographyPapers } from './_db'
import { eq, sql } from 'drizzle-orm'

export default async (req: Request) => {
  await migrate()
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db
      .select({
        id: bibliographies.id,
        name: bibliographies.name,
        description: bibliographies.description,
        createdAt: bibliographies.createdAt,
        updatedAt: bibliographies.updatedAt,
        paperCount: sql<number>`(SELECT COUNT(*) FROM bibliography_papers WHERE bibliography_id = ${bibliographies.id})`,
      })
      .from(bibliographies)
      .orderBy(bibliographies.updatedAt)
    return json(rows)
  }

  if (req.method === 'POST') {
    const { name, description } = await req.json()
    const [created] = await db.insert(bibliographies).values({ name, description }).returning()
    return json(created, 201)
  }

  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/bibliographies' }

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
```

- [ ] **Step 2: Implement bibliography (get one + update + delete)**

```ts
// netlify/functions/bibliography.ts
import type { Config } from '@netlify/functions'
import { getDb, migrate, bibliographies, bibliographyPapers } from './_db'
import { eq } from 'drizzle-orm'

export default async (req: Request) => {
  await migrate()
  const db = getDb()
  const id = parseInt(new URL(req.url).searchParams.get('id') ?? '0')
  if (!id) return new Response('Missing id', { status: 400 })

  if (req.method === 'GET') {
    const bib = await db.query.bibliographies.findFirst({ where: eq(bibliographies.id, id) })
    if (!bib) return new Response('Not Found', { status: 404 })
    const rows = await db.query.bibliographyPapers.findMany({ where: eq(bibliographyPapers.bibliographyId, id) })
    // Return rowId so the UI can call DELETE with the correct bibliography_papers.id
    const papers = rows.map(r => ({ rowId: r.id, paper: r.paperData }))
    return json({ ...bib, papers })
  }

  if (req.method === 'PATCH') {
    const { name, description } = await req.json()
    const [updated] = await db.update(bibliographies)
      .set({ name, description, updatedAt: new Date() })
      .where(eq(bibliographies.id, id))
      .returning()
    return json(updated)
  }

  if (req.method === 'DELETE') {
    await db.delete(bibliographies).where(eq(bibliographies.id, id))
    return new Response(null, { status: 204 })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/bibliography' }

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
```

- [ ] **Step 3: Implement bibliography-papers (add + remove)**

```ts
// netlify/functions/bibliography-papers.ts
import type { Config } from '@netlify/functions'
import { getDb, migrate, bibliographyPapers, bibliographies } from './_db'
import { eq, and } from 'drizzle-orm'

export default async (req: Request) => {
  await migrate()
  const db = getDb()
  const url = new URL(req.url)

  if (req.method === 'POST') {
    const { bibliographyId, paper } = await req.json()
    // Update bibliography updatedAt
    await db.update(bibliographies).set({ updatedAt: new Date() }).where(eq(bibliographies.id, bibliographyId))
    const [added] = await db.insert(bibliographyPapers)
      .values({ bibliographyId, paperData: paper })
      .returning()
    return json(added, 201)
  }

  if (req.method === 'DELETE') {
    const bibliographyId = parseInt(url.searchParams.get('bibliographyId') ?? '0')
    const paperId = parseInt(url.searchParams.get('paperId') ?? '0')
    await db.delete(bibliographyPapers)
      .where(and(eq(bibliographyPapers.bibliographyId, bibliographyId), eq(bibliographyPapers.id, paperId)))
    return new Response(null, { status: 204 })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/bibliography-papers' }

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
```

- [ ] **Step 4: Implement saved-searches**

```ts
// netlify/functions/saved-searches.ts
import type { Config } from '@netlify/functions'
import { getDb, migrate, savedSearches } from './_db'
import { eq } from 'drizzle-orm'

export default async (req: Request) => {
  await migrate()
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.query.savedSearches.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] })
    return json(rows)
  }
  if (req.method === 'POST') {
    const { name, params } = await req.json()
    const [created] = await db.insert(savedSearches).values({ name, params }).returning()
    return json(created, 201)
  }
  if (req.method === 'DELETE') {
    const id = parseInt(new URL(req.url).searchParams.get('id') ?? '0')
    await db.delete(savedSearches).where(eq(savedSearches.id, id))
    return new Response(null, { status: 204 })
  }
  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/saved-searches' }

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
```

- [ ] **Step 5: Implement history**

```ts
// netlify/functions/history.ts
import type { Config } from '@netlify/functions'
import { getDb, migrate, searchHistory } from './_db'
import { eq } from 'drizzle-orm'

export default async (req: Request) => {
  await migrate()
  const db = getDb()

  if (req.method === 'GET') {
    const rows = await db.query.searchHistory.findMany({
      orderBy: (t, { desc }) => [desc(t.searchedAt)],
      limit: 100,
    })
    return json(rows)
  }
  if (req.method === 'DELETE') {
    const id = new URL(req.url).searchParams.get('id')
    if (id) {
      await db.delete(searchHistory).where(eq(searchHistory.id, parseInt(id)))
    } else {
      // Clear all
      await db.delete(searchHistory)
    }
    return new Response(null, { status: 204 })
  }
  return new Response('Method Not Allowed', { status: 405 })
}

export const config: Config = { path: '/api/history' }

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
```

- [ ] **Step 6: Commit**

```bash
git add netlify/functions/bibliographies.ts netlify/functions/bibliography.ts netlify/functions/bibliography-papers.ts netlify/functions/saved-searches.ts netlify/functions/history.ts
git commit -m "feat: add all CRUD API Netlify Functions"
```

---

## Chunk 5: Frontend — API Client & Export Utilities

### Task 9: API client + export utilities

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/lib/export.ts`
- Create: `tests/unit/export.test.ts`

- [ ] **Step 1: Write export tests**

```ts
// tests/unit/export.test.ts
import { describe, it, expect } from 'vitest'
import { papersToCSV } from '../../src/lib/export'
import type { Paper } from '../../src/types'

const mockPapers: Paper[] = [
  { id: 'pubmed:1', source: 'pubmed', title: 'Test Paper', authors: ['Smith J', 'Doe A'], journal: 'NEJM', year: 2023, doi: '10.1/test', url: 'https://pubmed.ncbi.nlm.nih.gov/1/' }
]

describe('papersToCSV', () => {
  it('includes header row', () => {
    const csv = papersToCSV(mockPapers)
    expect(csv).toMatch(/Title,Authors/)
  })
  it('includes paper data', () => {
    const csv = papersToCSV(mockPapers)
    expect(csv).toMatch(/Test Paper/)
    expect(csv).toMatch(/Smith J; Doe A/)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test tests/unit/export.test.ts
```

- [ ] **Step 3: Implement export utilities**

```ts
// src/lib/export.ts
import * as XLSX from 'xlsx'
import type { Paper } from '../types'

export function papersToCSV(papers: Paper[]): string {
  const headers = ['Title', 'Authors', 'Journal', 'Year', 'DOI', 'Source', 'URL', 'Abstract']
  const rows = papers.map(p => [
    `"${(p.title ?? '').replace(/"/g, '""')}"`,
    `"${(p.authors ?? []).join('; ').replace(/"/g, '""')}"`,
    `"${(p.journal ?? '').replace(/"/g, '""')}"`,
    p.year ?? '',
    p.doi ?? '',
    p.source,
    p.url,
    `"${(p.abstract ?? '').replace(/"/g, '""')}"`,
  ])
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

export function downloadCSV(papers: Paper[], filename: string) {
  const csv = papersToCSV(papers)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadExcel(papers: Paper[], filename: string) {
  const rows = papers.map(p => ({
    Title: p.title,
    Authors: (p.authors ?? []).join('; '),
    Journal: p.journal ?? '',
    Year: p.year ?? '',
    DOI: p.doi ?? '',
    Source: p.source,
    URL: p.url,
    Abstract: p.abstract ?? '',
    Citations: p.citationCount ?? '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Bibliography')
  XLSX.writeFile(wb, filename)
}
```

- [ ] **Step 4: Implement API client**

```ts
// src/lib/api.ts
import type { SearchParams, SearchResponse, Bibliography, BibliographyWithPapers, SavedSearch, HistoryEntry, Paper } from '../types'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options)
  if (res.status === 204) return undefined as T
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`)
  return res.json()
}

// Search
export const search = (params: SearchParams): Promise<SearchResponse> =>
  request('/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) })

// Bibliographies
export const getBibliographies = (): Promise<Bibliography[]> => request('/api/bibliographies')
export const createBibliography = (name: string, description: string): Promise<Bibliography> =>
  request('/api/bibliographies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) })
export const getBibliography = (id: number): Promise<BibliographyWithPapers> => request(`/api/bibliography?id=${id}`)
// removePaper uses the bibliography_papers row id (NOT the array index)

export const updateBibliography = (id: number, name: string, description: string): Promise<Bibliography> =>
  request(`/api/bibliography?id=${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) })
export const deleteBibliography = (id: number): Promise<void> => request(`/api/bibliography?id=${id}`, { method: 'DELETE' })

// Bibliography papers
export const addPaper = (bibliographyId: number, paper: Paper): Promise<void> =>
  request('/api/bibliography-papers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bibliographyId, paper }) })
export const removePaper = (bibliographyId: number, paperId: number): Promise<void> =>
  request(`/api/bibliography-papers?bibliographyId=${bibliographyId}&paperId=${paperId}`, { method: 'DELETE' })

// Saved searches
export const getSavedSearches = (): Promise<SavedSearch[]> => request('/api/saved-searches')
export const createSavedSearch = (name: string, params: SearchParams): Promise<SavedSearch> =>
  request('/api/saved-searches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, params }) })
export const deleteSavedSearch = (id: number): Promise<void> =>
  request(`/api/saved-searches?id=${id}`, { method: 'DELETE' })

// History
export const getHistory = (): Promise<HistoryEntry[]> => request('/api/history')
export const deleteHistoryEntry = (id: number): Promise<void> =>
  request(`/api/history?id=${id}`, { method: 'DELETE' })
export const clearHistory = (): Promise<void> => request('/api/history', { method: 'DELETE' })
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm test tests/unit/export.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/ tests/unit/export.test.ts
git commit -m "feat: add API client and CSV/Excel export utilities"
```

---

## Chunk 6: Frontend — Components & Pages

### Task 10: Layout + routing shell

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Create: `src/components/Layout.tsx`

- [ ] **Step 1: Set up router in main.tsx**

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 2: Set up routes in App.tsx**

```tsx
// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import SearchPage from './pages/SearchPage'
import BibliographiesPage from './pages/BibliographiesPage'
import BibliographyDetailPage from './pages/BibliographyDetailPage'
import SavedSearchesPage from './pages/SavedSearchesPage'
import HistoryPage from './pages/HistoryPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/search" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/bibliographies" element={<BibliographiesPage />} />
        <Route path="/bibliographies/:id" element={<BibliographyDetailPage />} />
        <Route path="/saved-searches" element={<SavedSearchesPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Routes>
    </Layout>
  )
}
```

- [ ] **Step 3: Build Layout component**

```tsx
// src/components/Layout.tsx
import { NavLink } from 'react-router-dom'

const NAV = [
  { to: '/search', icon: '🔍', label: 'Search' },
  { to: '/bibliographies', icon: '📚', label: 'Bibliographies' },
  { to: '/saved-searches', icon: '⭐', label: 'Saved Searches' },
  { to: '/history', icon: '🕐', label: 'History' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#f4f6fb] font-body">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-navy-900 flex flex-col">
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="font-display text-lg font-bold text-white leading-tight">
            SLA Bibliography<br />Generator
          </div>
          <div className="text-[11px] text-gold-500 uppercase tracking-widest mt-1">
            Clinical Literature
          </div>
          <div className="w-9 h-0.5 bg-gold-500 mt-3 rounded" />
        </div>
        <nav className="p-3 flex-1">
          <div className="text-[10px] uppercase tracking-widest text-white/30 px-2.5 mb-2 mt-2">
            Navigation
          </div>
          {NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg mb-1 text-sm font-medium transition-colors
                 ${isActive ? 'bg-white/15 text-white' : 'text-blue-200/70 hover:bg-white/10 hover:text-white'}`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-white/10 text-[12px] text-white/25">
          SLA Pharma Group
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/
git commit -m "feat: add routing shell and sidebar layout"
```

---

### Task 11: Search page — form + results

**Files:**
- Create: `src/components/SourceSelector.tsx`
- Create: `src/components/SearchForm.tsx`
- Create: `src/components/ResultCard.tsx`
- Create: `src/components/ResultsList.tsx`
- Create: `src/pages/SearchPage.tsx`

- [ ] **Step 1: SourceSelector component**

```tsx
// src/components/SourceSelector.tsx
import type { Source } from '../types'

const SOURCES: { id: Source; label: string; isNew?: boolean }[] = [
  { id: 'pubmed', label: 'PubMed' },
  { id: 'europepmc', label: 'Europe PMC', isNew: true },
  { id: 'clinicaltrials', label: 'ClinicalTrials.gov' },
  { id: 'semanticscholar', label: 'Semantic Scholar', isNew: true },
  { id: 'scholar', label: 'Google Scholar' },
  { id: 'crossref', label: 'CrossRef', isNew: true },
  { id: 'lens', label: 'Lens.org', isNew: true },
  { id: 'openalex', label: 'OpenAlex', isNew: true },
]

interface Props {
  selected: Source[]
  onChange: (sources: Source[]) => void
}

export default function SourceSelector({ selected, onChange }: Props) {
  const toggle = (id: Source) =>
    selected.includes(id)
      ? onChange(selected.filter(s => s !== id))
      : onChange([...selected, id])

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
        Sources <span className="normal-case text-slate-400 font-normal">({selected.length} selected)</span>
      </label>
      <div className="grid grid-cols-4 gap-2">
        {SOURCES.map(({ id, label, isNew }) => {
          const active = selected.includes(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
                ${active
                  ? 'border-gold-500 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'}`}
            >
              <span className={`w-3.5 h-3.5 rounded flex-shrink-0 border text-[10px] flex items-center justify-center
                ${active ? 'border-gold-500 bg-gold-500 text-white' : 'border-slate-300'}`}>
                {active ? '✓' : ''}
              </span>
              <span className="truncate">{label}</span>
              {isNew && <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-1 rounded font-bold">NEW</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: SearchForm component**

```tsx
// src/components/SearchForm.tsx
import { useState } from 'react'
import SourceSelector from './SourceSelector'
import type { SearchParams, Source } from '../types'

const PAPER_TYPES = ['', 'RCT', 'Systematic Review', 'Meta-Analysis', 'Observational', 'Case Study', 'Review']
const ALL_SOURCES: Source[] = ['pubmed', 'europepmc', 'clinicaltrials', 'semanticscholar', 'scholar', 'crossref', 'lens', 'openalex']

interface Props {
  onSearch: (params: SearchParams) => void
  onSave: (params: SearchParams) => void
  onLoadSaved: () => void
  isLoading: boolean
  initialParams?: Partial<SearchParams>
}

export default function SearchForm({ onSearch, onSave, onLoadSaved, isLoading, initialParams }: Props) {
  const [form, setForm] = useState<SearchParams>({
    indication: initialParams?.indication ?? '',
    keywords: initialParams?.keywords ?? '',
    paperType: initialParams?.paperType ?? '',
    dateFrom: initialParams?.dateFrom ?? '2020-01-01',
    dateTo: initialParams?.dateTo ?? new Date().toISOString().slice(0, 10),
    sources: initialParams?.sources ?? ALL_SOURCES,
  })

  const set = (k: keyof SearchParams) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 shadow-sm">
      <h3 className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-5">Search Parameters</h3>
      <div className="grid grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Indication / Condition</label>
          <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-navy-800"
            value={form.indication} onChange={set('indication')} placeholder="e.g. hypertension" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Keywords</label>
          <input className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-navy-800"
            value={form.keywords} onChange={set('keywords')} placeholder="e.g. ACE inhibitor treatment" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Paper Type</label>
          <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-navy-800"
            value={form.paperType} onChange={set('paperType')}>
            {PAPER_TYPES.map(t => <option key={t} value={t}>{t || 'Any Type'}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Date Range</label>
          <div className="flex gap-2">
            <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-navy-800"
              value={form.dateFrom} onChange={set('dateFrom')} />
            <input type="date" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-navy-800"
              value={form.dateTo} onChange={set('dateTo')} />
          </div>
        </div>
      </div>
      <SourceSelector selected={form.sources} onChange={sources => setForm(f => ({ ...f, sources }))} />
      <div className="flex gap-3 mt-5 flex-wrap items-center">
        <button onClick={() => onSearch(form)} disabled={isLoading}
          className="bg-navy-800 text-white px-6 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-navy-700 disabled:opacity-60 transition-colors">
          {isLoading ? '⏳ Searching...' : '⚡ Run Search'}
        </button>
        <button onClick={() => onSave(form)}
          className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:border-slate-300 transition-colors">
          💾 Save Search
        </button>
        <button onClick={onLoadSaved}
          className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-1.5 hover:border-slate-300 transition-colors">
          📂 Load Saved
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: ResultCard component**

```tsx
// src/components/ResultCard.tsx
import { useState } from 'react'
import type { Paper, Bibliography } from '../types'
import * as api from '../lib/api'

const SOURCE_COLORS: Record<string, string> = {
  pubmed: 'bg-blue-100 text-blue-700',
  europepmc: 'bg-sky-100 text-sky-700',
  clinicaltrials: 'bg-emerald-100 text-emerald-700',
  semanticscholar: 'bg-orange-100 text-orange-700',
  crossref: 'bg-green-100 text-green-700',
  openalex: 'bg-violet-100 text-violet-700',
  lens: 'bg-red-100 text-red-700',
  scholar: 'bg-purple-100 text-purple-700',
}

interface Props {
  paper: Paper
  bibliographies: Bibliography[]
  onPaperAdded?: () => void
}

export default function ResultCard({ paper, bibliographies, onPaperAdded }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [selectedBib, setSelectedBib] = useState('')
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const addToBib = async () => {
    if (!selectedBib) return
    setAdding(true)
    await api.addPaper(parseInt(selectedBib), paper)
    setAdded(true)
    setAdding(false)
    onPaperAdded?.()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 mb-3 shadow-sm hover:border-amber-300 transition-colors">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h4 className="text-[15px] text-slate-800 font-semibold mb-1.5 leading-snug">{paper.title}</h4>
          <p className="text-[13px] text-slate-400 mb-2">
            {paper.authors?.slice(0, 3).join(', ')}{paper.authors?.length > 3 ? ' et al.' : ''}
            {paper.journal ? ` · ${paper.journal}` : ''}
            {paper.year ? ` · ${paper.year}` : ''}
            {paper.doi ? ` · DOI: ${paper.doi}` : ''}
          </p>
          {paper.abstract && (
            <p className="text-[13px] text-slate-500 leading-relaxed mb-3">
              {expanded ? paper.abstract : paper.abstract.slice(0, 200) + (paper.abstract.length > 200 ? '…' : '')}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span className={`text-[12px] px-2.5 py-0.5 rounded-full font-semibold ${SOURCE_COLORS[paper.source] ?? 'bg-slate-100 text-slate-600'}`}>
              {paper.source}
            </span>
            {paper.type && <span className="text-[12px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500">{paper.type}</span>}
            {paper.citationCount != null && <span className="text-[12px] text-slate-400">{paper.citationCount} citations</span>}
          </div>
          <div className="flex gap-2 mt-3 items-center flex-wrap">
            <a href={paper.url} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-[13px] border border-slate-200 text-blue-700 font-medium hover:bg-slate-50">
              View Source
            </a>
            {paper.abstract && (
              <button onClick={() => setExpanded(!expanded)}
                className="px-3 py-1.5 rounded-lg text-[13px] border border-slate-200 text-slate-600 font-medium hover:bg-slate-50">
                {expanded ? 'Hide Abstract' : 'Full Abstract'}
              </button>
            )}
            {bibliographies.length > 0 && !added && (
              <div className="flex gap-1.5 items-center ml-1">
                <select value={selectedBib} onChange={e => setSelectedBib(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[13px] text-slate-500">
                  <option value="">Add to bibliography…</option>
                  {bibliographies.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button onClick={addToBib} disabled={!selectedBib || adding}
                  className="bg-gold-500 text-white px-3 py-1.5 rounded-lg text-[13px] font-semibold disabled:opacity-50 hover:bg-gold-400 transition-colors">
                  {adding ? '…' : '+ Add'}
                </button>
              </div>
            )}
            {added && <span className="text-[13px] text-emerald-600 font-medium">✓ Added</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: ResultsList component**

```tsx
// src/components/ResultsList.tsx
import type { SourceResult, Bibliography } from '../types'
import ResultCard from './ResultCard'
import { downloadCSV, downloadExcel } from '../lib/export'

const TALLY_COLORS: Record<string, string> = {
  pubmed: 'bg-blue-100 text-blue-700',
  europepmc: 'bg-sky-100 text-sky-700',
  clinicaltrials: 'bg-emerald-100 text-emerald-700',
  semanticscholar: 'bg-orange-100 text-orange-700',
  crossref: 'bg-green-100 text-green-700',
  openalex: 'bg-violet-100 text-violet-700',
  lens: 'bg-red-100 text-red-700',
  scholar: 'bg-purple-100 text-purple-700',
}

interface Props {
  results: SourceResult[]
  bibliographies: Bibliography[]
  onPaperAdded: () => void
}

export default function ResultsList({ results, bibliographies, onPaperAdded }: Props) {
  const allPapers = results.flatMap(r => r.papers)
  const totalCount = allPapers.length

  return (
    <div>
      <div className="flex justify-between items-start mb-4 flex-wrap gap-3">
        <div>
          <p className="text-sm text-slate-500"><strong className="text-slate-800 text-base">{totalCount} results</strong> across {results.length} sources</p>
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {results.filter(r => r.papers.length > 0).map(r => (
              <span key={r.source} className={`text-[12px] px-2.5 py-0.5 rounded-full font-medium ${TALLY_COLORS[r.source] ?? 'bg-slate-100 text-slate-600'}`}>
                {r.source} {r.papers.length}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => downloadCSV(allPapers, 'sla-results.csv')}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-slate-300">
            ⬇ Export CSV
          </button>
          <button onClick={() => downloadExcel(allPapers, 'sla-results.xlsx')}
            className="bg-gold-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors">
            ⬇ Export Excel
          </button>
        </div>
      </div>
      {allPapers.map(paper => (
        <ResultCard key={paper.id} paper={paper} bibliographies={bibliographies} onPaperAdded={onPaperAdded} />
      ))}
      {results.filter(r => r.error).map(r => (
        <div key={r.source} className="text-[13px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-2 mb-2">
          ⚠ {r.source}: {r.error}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: SearchPage**

```tsx
// src/pages/SearchPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import SearchForm from '../components/SearchForm'
import ResultsList from '../components/ResultsList'
import type { SearchParams, SourceResult, Bibliography } from '../types'
import * as api from '../lib/api'

export default function SearchPage() {
  const [results, setResults] = useState<SourceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [bibs, setBibs] = useState<Bibliography[]>([])
  const [saveModal, setSaveModal] = useState<{ open: boolean; params?: SearchParams }>({ open: false })
  const [saveName, setSaveName] = useState('')
  const navigate = useNavigate()

  const loadBibs = useCallback(async () => {
    const data = await api.getBibliographies()
    setBibs(data)
  }, [])

  useEffect(() => { loadBibs() }, [loadBibs])

  const handleSearch = async (params: SearchParams) => {
    setLoading(true)
    try {
      const data = await api.search(params)
      setResults(data.results)
      setHasSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = (params: SearchParams) => {
    setSaveModal({ open: true, params })
    setSaveName('')
  }

  const confirmSave = async () => {
    if (!saveModal.params || !saveName) return
    await api.createSavedSearch(saveName, saveModal.params)
    setSaveModal({ open: false })
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="font-display text-[26px] font-bold text-slate-900 mb-1">Literature Search</h1>
      <p className="text-[14px] text-slate-400 mb-7">Search 8 clinical and academic databases simultaneously</p>

      <SearchForm
        onSearch={handleSearch}
        onSave={handleSave}
        onLoadSaved={() => navigate('/saved-searches')}
        isLoading={loading}
      />

      {hasSearched && (
        <ResultsList results={results} bibliographies={bibs} onPaperAdded={loadBibs} />
      )}

      {/* Save Search Modal */}
      {saveModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-7 w-[420px] shadow-xl">
            <h3 className="font-display text-xl font-bold mb-4">Save Search</h3>
            <input className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm mb-4 focus:outline-none focus:border-navy-800"
              placeholder="Search name (e.g. Hypertension ACE Inhibitor RCTs)"
              value={saveName} onChange={e => setSaveName(e.target.value)} autoFocus />
            <div className="flex gap-3 justify-end">
              <button onClick={() => setSaveModal({ open: false })} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">Cancel</button>
              <button onClick={confirmSave} disabled={!saveName} className="bg-gold-500 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/pages/SearchPage.tsx
git commit -m "feat: search page with form, source selector, results list"
```

---

### Task 12: Bibliographies pages

**Files:**
- Create: `src/components/BibliographyCard.tsx`
- Create: `src/components/NewBibliographyModal.tsx`
- Create: `src/components/PaperRow.tsx`
- Create: `src/pages/BibliographiesPage.tsx`
- Create: `src/pages/BibliographyDetailPage.tsx`

- [ ] **Step 1: BibliographyCard**

```tsx
// src/components/BibliographyCard.tsx
import { useNavigate } from 'react-router-dom'
import type { Bibliography } from '../types'

export default function BibliographyCard({ bib }: { bib: Bibliography }) {
  const nav = useNavigate()
  return (
    <div onClick={() => nav(`/bibliographies/${bib.id}`)}
      className="bg-white border border-slate-200 rounded-xl p-5 cursor-pointer hover:border-gold-500 hover:shadow-md transition-all">
      <h3 className="font-display text-lg text-slate-900 mb-2 leading-snug">{bib.name}</h3>
      <p className="text-[13px] text-slate-400 mb-4 leading-relaxed">{bib.description || 'No description'}</p>
      <div className="flex justify-between items-center pt-3.5 border-t border-slate-100">
        <span className="text-[14px] text-navy-800 font-semibold">{bib.paperCount} papers</span>
        <span className="text-[12px] text-slate-400">
          Updated {new Date(bib.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: NewBibliographyModal**

```tsx
// src/components/NewBibliographyModal.tsx
import { useState } from 'react'

interface Props { onSave: (name: string, description: string) => void; onClose: () => void }

export default function NewBibliographyModal({ onSave, onClose }: Props) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-7 w-[440px] shadow-xl">
        <h3 className="font-display text-xl font-bold mb-5">New Bibliography</h3>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Name</label>
        <input className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm mb-4 focus:outline-none focus:border-navy-800"
          placeholder="e.g. Q1 2026 Hypertension Review" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Description (optional)</label>
        <textarea className="w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm mb-5 focus:outline-none focus:border-navy-800 resize-none"
          rows={3} placeholder="What is this bibliography for?" value={desc} onChange={e => setDesc(e.target.value)} />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600">Cancel</button>
          <button onClick={() => onSave(name, desc)} disabled={!name}
            className="bg-navy-800 text-white px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-navy-700">
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: BibliographiesPage**

```tsx
// src/pages/BibliographiesPage.tsx
import { useState, useEffect } from 'react'
import BibliographyCard from '../components/BibliographyCard'
import NewBibliographyModal from '../components/NewBibliographyModal'
import type { Bibliography } from '../types'
import * as api from '../lib/api'

export default function BibliographiesPage() {
  const [bibs, setBibs] = useState<Bibliography[]>([])
  const [showModal, setShowModal] = useState(false)

  const load = async () => setBibs(await api.getBibliographies())
  useEffect(() => { load() }, [])

  const create = async (name: string, description: string) => {
    await api.createBibliography(name, description)
    setShowModal(false)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-7">
        <div>
          <h1 className="font-display text-[26px] font-bold text-slate-900 mb-1">Bibliographies</h1>
          <p className="text-[14px] text-slate-400">Your named collections of clinical literature</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-navy-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-navy-700 transition-colors">
          + New Bibliography
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bibs.map(b => <BibliographyCard key={b.id} bib={b} />)}
        <div onClick={() => setShowModal(true)}
          className="border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center min-h-[140px] cursor-pointer hover:border-slate-300 transition-colors text-slate-400">
          <div className="text-center">
            <div className="text-3xl mb-2 text-slate-300">+</div>
            <div className="text-sm font-medium">New Bibliography</div>
          </div>
        </div>
      </div>
      {showModal && <NewBibliographyModal onSave={create} onClose={() => setShowModal(false)} />}
    </div>
  )
}
```

- [ ] **Step 4: BibliographyDetailPage**

```tsx
// src/pages/BibliographyDetailPage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import type { BibliographyWithPapers } from '../types'
import * as api from '../lib/api'
import { downloadCSV, downloadExcel } from '../lib/export'

export default function BibliographyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [bib, setBib] = useState<BibliographyWithPapers | null>(null)

  const load = async () => setBib(await api.getBibliography(parseInt(id!)))
  useEffect(() => { load() }, [id])

  if (!bib) return <div className="p-8 text-slate-400">Loading…</div>

  const remove = async (rowId: number) => {
    await api.removePaper(bib.id, rowId)   // rowId = bibliography_papers.id, not array index
    load()
  }

  const deleteBib = async () => {
    if (!confirm(`Delete "${bib.name}"?`)) return
    await api.deleteBibliography(bib.id)
    nav('/bibliographies')
  }

  return (
    <div className="p-8">
      <button onClick={() => nav('/bibliographies')} className="text-[14px] text-slate-400 mb-5 flex items-center gap-1.5 font-medium hover:text-slate-600">
        ← Back to Bibliographies
      </button>
      <h1 className="font-display text-[30px] font-bold text-slate-900 mb-1">{bib.name}</h1>
      <p className="text-[14px] text-slate-400 mb-6">
        {bib.papers.length} papers · Created {new Date(bib.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <div className="flex gap-3 mb-6 items-center flex-wrap">
        <button onClick={() => downloadCSV(bib.papers.map(r => r.paper), `${bib.name}.csv`)}
          className="bg-gold-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors">
          ⬇ Export CSV
        </button>
        <button onClick={() => downloadExcel(bib.papers.map(r => r.paper), `${bib.name}.xlsx`)}
          className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:border-slate-300">
          ⬇ Export Excel
        </button>
        <button onClick={deleteBib}
          className="ml-auto bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
          ✕ Delete Bibliography
        </button>
      </div>
      {bib.papers.length === 0 && (
        <p className="text-[14px] text-slate-400 py-12 text-center">No papers yet — add some from the Search page.</p>
      )}
      {bib.papers.map(({ rowId, paper }) => (
        <div key={rowId} className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-2.5 flex justify-between items-start gap-4 shadow-sm">
          <div>
            <p className="text-[15px] text-slate-800 font-semibold mb-1.5 leading-snug">{paper.title}</p>
            <p className="text-[13px] text-slate-400 flex items-center gap-2 flex-wrap">
              {paper.authors?.slice(0, 2).join(', ')}{paper.authors?.length > 2 ? ' et al.' : ''}
              {paper.journal && <span>· {paper.journal}</span>}
              {paper.year && <span>· {paper.year}</span>}
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">{paper.source}</span>
            </p>
          </div>
          <button onClick={() => remove(rowId)}
            className="flex-shrink-0 bg-red-50 border border-red-200 text-red-600 px-3.5 py-1.5 rounded-lg text-[13px] font-medium hover:bg-red-100">
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/BibliographyCard.tsx src/components/NewBibliographyModal.tsx src/pages/BibliographiesPage.tsx src/pages/BibliographyDetailPage.tsx
git commit -m "feat: bibliographies list and detail pages"
```

---

### Task 13: Saved Searches + History pages

**Files:**
- Create: `src/pages/SavedSearchesPage.tsx`
- Create: `src/pages/HistoryPage.tsx`

- [ ] **Step 1: SavedSearchesPage**

```tsx
// src/pages/SavedSearchesPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SavedSearch } from '../types'
import * as api from '../lib/api'

export default function SavedSearchesPage() {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const nav = useNavigate()

  const load = async () => setSearches(await api.getSavedSearches())
  useEffect(() => { load() }, [])

  const deleteSearch = async (id: number) => {
    await api.deleteSavedSearch(id)
    load()
  }

  const runSearch = (s: SavedSearch) =>
    nav('/search', { state: { params: s.params } })

  return (
    <div className="p-8">
      <h1 className="font-display text-[26px] font-bold text-slate-900 mb-1">Saved Searches</h1>
      <p className="text-[14px] text-slate-400 mb-7">Reusable search templates — load one to pre-fill the search form</p>
      {searches.length === 0 && (
        <p className="text-[14px] text-slate-400 py-12 text-center">No saved searches yet — save one from the Search page.</p>
      )}
      {searches.map(s => (
        <div key={s.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-2.5 flex justify-between items-center gap-4 shadow-sm">
          <div>
            <p className="text-[15px] text-slate-800 font-semibold mb-1">{s.name}</p>
            <p className="text-[13px] text-slate-400">
              {[s.params.indication, s.params.keywords, s.params.paperType].filter(Boolean).join(' · ')}
              {' · '}{s.params.dateFrom.slice(0,4)}–{s.params.dateTo.slice(0,4)}
              {' · '}{s.params.sources.length} sources
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => runSearch(s)}
              className="bg-gold-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors">
              ▶ Load & Run
            </button>
            <button onClick={() => deleteSearch(s.id)}
              className="bg-red-50 border border-red-200 text-red-600 px-3.5 py-2 rounded-lg text-sm font-medium hover:bg-red-100">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: HistoryPage**

```tsx
// src/pages/HistoryPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { HistoryEntry } from '../types'
import * as api from '../lib/api'

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const nav = useNavigate()

  const load = async () => setHistory(await api.getHistory())
  useEffect(() => { load() }, [])

  const clearAll = async () => {
    if (!confirm('Clear all search history?')) return
    await api.clearHistory()
    load()
  }

  const rerun = (entry: HistoryEntry) =>
    nav('/search', { state: { params: entry.params } })

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-7">
        <div>
          <h1 className="font-display text-[26px] font-bold text-slate-900 mb-1">Search History</h1>
          <p className="text-[14px] text-slate-400">Every search is automatically logged</p>
        </div>
        <button onClick={clearAll}
          className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
          Clear History
        </button>
      </div>
      {history.length === 0 && (
        <p className="text-[14px] text-slate-400 py-12 text-center">No searches yet.</p>
      )}
      {history.map(entry => (
        <div key={entry.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4 mb-2.5 flex justify-between items-center gap-4 shadow-sm">
          <div>
            <p className="text-[15px] text-slate-800 font-semibold mb-1">
              {[entry.params.indication, entry.params.keywords, entry.params.paperType].filter(Boolean).join(' · ')}
            </p>
            <p className="text-[13px] text-slate-400">
              {new Date(entry.searchedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              {' · '}{entry.params.sources.length} sources
            </p>
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            <span className="text-[14px] text-slate-600 font-semibold bg-slate-100 px-3 py-1.5 rounded-full">
              {entry.resultCount} results
            </span>
            <button onClick={() => rerun(entry)}
              className="bg-gold-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold-400 transition-colors">
              ↻ Re-run
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Connect saved search loading in SearchPage**

In `src/pages/SearchPage.tsx`, add `useLocation` and wire the `key` prop so React remounts `SearchForm` when new params arrive (since `useState` initialiser only runs once):

```tsx
import { useLocation } from 'react-router-dom'

// Inside SearchPage component:
const location = useLocation()
const preloadParams = location.state?.params

// In the JSX — the key prop forces remount when preloadParams changes:
<SearchForm
  key={preloadParams ? JSON.stringify(preloadParams) : 'default'}
  onSearch={handleSearch}
  onSave={handleSave}
  onLoadSaved={() => navigate('/saved-searches')}
  isLoading={loading}
  initialParams={preloadParams}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/SavedSearchesPage.tsx src/pages/HistoryPage.tsx src/pages/SearchPage.tsx
git commit -m "feat: saved searches and history pages; wire up re-run navigation"
```

---

## Chunk 7: Final Assembly & Deployment

### Task 14: Full test run + local smoke test

- [ ] **Step 1: Run all tests**

```bash
npm test
```
Expected: all unit tests pass (integration tests require DATABASE_URL — skip if not configured locally)

- [ ] **Step 2: Start local dev server**

```bash
# Requires: netlify CLI installed globally (npm i -g netlify-cli)
# Ensure .env.local has: DATABASE_URL=<your Netlify DB connection string>
#                        LENS_API_KEY=<your key>
netlify dev
```
Open `http://localhost:8888`. Verify:
- [ ] Search form loads with 8 source chips
- [ ] A test search (e.g. "hypertension") returns results
- [ ] A result can be added to a bibliography
- [ ] Export CSV and Excel both download

- [ ] **Step 3: Fix any issues found, commit**

```bash
git add .
git commit -m "fix: resolve any local smoke test issues"
```

---

### Task 15: Netlify deployment

- [ ] **Step 1: Enable Netlify DB (one-time, 30 seconds)**

1. Go to `app.netlify.com` → your site
2. Integrations → Databases → **Enable Netlify DB**
3. DATABASE_URL is now auto-injected into all functions

- [ ] **Step 2: Add remaining env vars in Netlify dashboard**

Site settings → Environment variables → Add:
- `LENS_API_KEY` = your Lens.org API key
- `SERPAPI_KEY` = your SerpAPI key (optional)

- [ ] **Step 3: Connect GitHub repo**

1. Netlify dashboard → Add new site → Import from Git → GitHub
2. Select `slapharma/SLABibliographyGenerator`
3. Build command: `npm run build` · Publish dir: `dist`
4. Deploy

- [ ] **Step 4: Verify live deployment**

Visit the Netlify URL. Confirm all 5 features work end-to-end.

- [ ] **Step 5: Final commit with README**

Update `README.md` with:
- What the app does
- Local dev instructions (`netlify dev`)
- Env vars required
- How to deploy

```bash
git add README.md
git commit -m "docs: add setup and deployment instructions"
git push origin main
```

---

## Summary of all tasks

| # | Task | Chunk | Est. time |
|---|------|-------|-----------|
| 1 | Project scaffold & config | 1 | 15 min |
| 2 | TypeScript types | 1 | 5 min |
| 3 | DB schema + Drizzle client | 2 | 20 min |
| 4 | PubMed adapter + test | 3 | 20 min |
| 5 | 4 more source adapters | 3 | 30 min |
| 6 | ClinicalTrials, Lens, Scholar | 3 | 20 min |
| 7 | Search Netlify function | 4 | 15 min |
| 8 | All CRUD API functions | 4 | 30 min |
| 9 | API client + export utils | 5 | 20 min |
| 10 | Layout + routing | 6 | 15 min |
| 11 | Search page | 6 | 40 min |
| 12 | Bibliographies pages | 6 | 30 min |
| 13 | Saved searches + history | 6 | 20 min |
| 14 | Test run + smoke test | 7 | 20 min |
| 15 | Netlify deployment | 7 | 15 min |
| | **Total** | | **~5.5 hours** |
