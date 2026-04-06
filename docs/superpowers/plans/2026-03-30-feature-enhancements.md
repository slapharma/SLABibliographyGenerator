# SLA Bibliography Generator — Feature Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 features to the SLA Bibliography Generator: paper annotations, date-added field, bibliography tags/description, inline abstract preview, formatted citation export, PDF print view, shareable read-only links, and one-click saved-search re-run with new-result highlighting.

**Architecture:** All new API endpoints follow the existing pattern — Vercel Edge Functions in `api/` that import from the shared DB module at `netlify/functions/_db.ts`. Frontend changes are isolated to the components and pages that need them. New DB columns are added via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations appended to the existing `migrate()` function.

**Tech Stack:** React 18 + Vite + TypeScript, Tailwind CSS v4 (inline styles throughout), React Router v6, Vercel Edge Functions, Neon PostgreSQL via `@neondatabase/serverless`, Drizzle ORM, `xlsx` for Excel export.

---

## Chunk 1: Database Migrations + Type Updates

### Task 1: Add DB migrations for all new columns

**Files:**
- Modify: `netlify/functions/_db.ts` (lines 91–95 — append after the existing `creator_name` migration)

- [ ] **Step 1: Add 5 new ALTER TABLE migrations inside `migrate()`**

  Open `netlify/functions/_db.ts`. After line 94 (`await db.execute('ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS creator_name...')`), add:

  ```ts
  await db.execute(`ALTER TABLE bibliography_papers ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT ''`)
  await db.execute(`ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT ''`)
  await db.execute(`ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS share_token TEXT`)
  await db.execute(`ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false`)
  await db.execute(`ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_result_ids JSONB NOT NULL DEFAULT '[]'`)
  ```

- [ ] **Step 2: Verify no syntax errors**

  Run: `cd existing-codebase && npx tsc --noEmit`
  Expected: 0 errors

- [ ] **Step 3: Commit**

  ```bash
  git add netlify/functions/_db.ts
  git commit -m "feat: add DB migrations for note, tags, share_token, is_shared, last_result_ids"
  ```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new fields to interfaces**

  In `src/types/index.ts`, make these changes:

  **`BibliographyPaperRow`** — add `note` and `addedAt`:
  ```ts
  export interface BibliographyPaperRow {
    rowId: number
    paper: Paper
    note: string        // annotation text, empty string when unset
    addedAt: string     // ISO timestamp from bibliography_papers.added_at
  }
  ```

  **`Bibliography`** — add `tags`, `shareToken`, `isShared`:
  ```ts
  export interface Bibliography {
    id: number
    name: string
    description: string
    creatorName: string
    tags: string            // comma-separated, e.g. "regulatory,ibd"
    shareToken: string | null
    isShared: boolean
    createdAt: string
    updatedAt: string
    paperCount: number
  }
  ```

  **`SavedSearch`** — add `lastResultIds`:
  ```ts
  export interface SavedSearch {
    id: number
    name: string
    params: SearchParams
    createdAt: string
    lastResultIds: string[] // DOIs or source:externalId keys from last run
  }
  ```

  **Add `CitationStyle` type** (new export):
  ```ts
  export type CitationStyle = 'vancouver' | 'apa' | 'harvard'
  ```

- [ ] **Step 2: Verify no type errors**

  Run: `npx tsc --noEmit`
  Expected: errors only in files that use the changed interfaces (they'll be fixed in later tasks). No parse errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/types/index.ts
  git commit -m "feat: add note, addedAt, tags, shareToken, isShared, lastResultIds, CitationStyle to types"
  ```

---

## Chunk 2: API Layer

### Task 3: Update `GET /api/bibliography` to return note, addedAt, tags, shareToken, isShared

**Files:**
- Modify: `api/bibliography.ts`

- [ ] **Step 1: Update the GET handler to include new fields in paper rows and bib object**

  In `api/bibliography.ts`, replace the GET handler block (lines 15–21):

  ```ts
  if (req.method === 'GET') {
    const bib = await db.query.bibliographies.findFirst({ where: eq(bibliographies.id, id) })
    if (!bib) return new Response('Not Found', { status: 404 })
    const rows = await db.query.bibliographyPapers.findMany({ where: eq(bibliographyPapers.bibliographyId, id) })
    const papers = rows.map(r => ({
      rowId: r.id,
      paper: r.paperData,
      note: (r as any).note ?? '',
      addedAt: r.addedAt?.toISOString() ?? new Date().toISOString(),
    }))
    return json({
      ...bib,
      tags: (bib as any).tags ?? '',
      shareToken: (bib as any).shareToken ?? null,
      isShared: (bib as any).isShared ?? false,
      papers,
    })
  }
  ```

  > Note: `(r as any).note` is needed because the Drizzle schema object doesn't yet have the new columns. The `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migration adds them at runtime.

- [ ] **Step 2: Update the PATCH handler to accept `tags`**

  In `api/bibliography.ts`, replace the PATCH handler (lines 23–30):

  ```ts
  if (req.method === 'PATCH') {
    const body = await req.json()
    const { name, description, creatorName, tags } = body
    const [updated] = await db.update(bibliographies)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(creatorName !== undefined ? { creatorName } : {}),
        updatedAt: new Date(),
      })
      .where(eq(bibliographies.id, id))
      .returning()
    if (!updated) return new Response('Not Found', { status: 404 })
    // tags is stored via raw SQL since Drizzle schema doesn't have it yet
    if (tags !== undefined) {
      await db.execute(`UPDATE bibliographies SET tags = '${tags.replace(/'/g, "''")}' WHERE id = ${id}`)
    }
    return json({ ...updated, tags: tags ?? (updated as any).tags ?? '' })
  }
  ```

- [ ] **Step 3: Verify no TypeScript errors**

  Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

  ```bash
  git add api/bibliography.ts
  git commit -m "feat: bibliography API returns note, addedAt, tags, shareToken, isShared"
  ```

---

### Task 4: Update `GET /api/bibliographies` to return tags, shareToken, isShared

**Files:**
- Modify: `api/bibliographies.ts`

- [ ] **Step 1: Update the bibliographies list query to include new fields**

  In `api/bibliographies.ts`, find the GET handler's SQL query and add the new columns to the SELECT:

  ```ts
  const result = await db.execute(sql`
    SELECT
      b.id,
      b.name,
      b.description,
      b.creator_name AS "creatorName",
      b.created_at AS "createdAt",
      b.updated_at AS "updatedAt",
      COALESCE(b.tags, '') AS tags,
      b.share_token AS "shareToken",
      COALESCE(b.is_shared, false) AS "isShared",
      COUNT(bp.id)::int AS "paperCount"
    FROM bibliographies b
    LEFT JOIN bibliography_papers bp ON bp.bibliography_id = b.id
    GROUP BY b.id
    ORDER BY b.updated_at DESC
  `)
  return json(result.rows)
  ```

- [ ] **Step 2: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add api/bibliographies.ts
  git commit -m "feat: bibliographies list API returns tags, shareToken, isShared"
  ```

---

### Task 5: Create `api/bibliography-paper-note.ts` (PATCH note)

**Files:**
- Create: `api/bibliography-paper-note.ts`

- [ ] **Step 1: Create the Edge function**

  ```ts
  // api/bibliography-paper-note.ts
  export const config = { runtime: 'edge' }

  import { getDb, migrate } from '../netlify/functions/_db'

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

  export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'PATCH') return new Response('Method Not Allowed', { status: 405 })

    await migrate()
    const db = getDb()
    const url = new URL(req.url)
    const rowId = parseInt(url.searchParams.get('rowId') ?? '0')
    if (!rowId) return new Response('Missing or invalid rowId', { status: 400 })

    let body: { note?: string }
    try { body = await req.json() } catch { return new Response('Invalid JSON body', { status: 400 }) }

    if (body.note === undefined) return new Response('Missing note field', { status: 400 })
    if (typeof body.note !== 'string') return new Response('note must be a string', { status: 400 })
    if (body.note.length > 2000) return new Response('note exceeds 2000 character limit', { status: 400 })

    const note = body.note.replace(/'/g, "''")  // escape single quotes for raw SQL
    const result = await db.execute(
      `UPDATE bibliography_papers SET note = '${note}' WHERE id = ${rowId} RETURNING id`
    )
    if (!result.rows.length) return new Response('Not Found', { status: 404 })

    return json({ rowId, note: body.note })
  }
  ```

- [ ] **Step 2: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add api/bibliography-paper-note.ts
  git commit -m "feat: add PATCH /api/bibliography-paper-note endpoint for paper annotations"
  ```

---

### Task 6: Create `api/bibliography-share.ts` (POST/DELETE share toggle)

**Files:**
- Create: `api/bibliography-share.ts`

- [ ] **Step 1: Create the Edge function**

  ```ts
  // api/bibliography-share.ts
  export const config = { runtime: 'edge' }

  import { getDb, migrate } from '../netlify/functions/_db'

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

  function generateUUID(): string {
    // crypto.randomUUID() is available in Vercel Edge runtime
    return crypto.randomUUID()
  }

  export default async function handler(req: Request): Promise<Response> {
    await migrate()
    const db = getDb()
    const url = new URL(req.url)
    const id = parseInt(url.searchParams.get('id') ?? '0')
    if (!id) return new Response('Missing id', { status: 400 })

    if (req.method === 'POST') {
      // Get existing bib to check for existing token
      const existing = await db.execute(`SELECT share_token FROM bibliographies WHERE id = ${id}`)
      if (!existing.rows.length) return new Response('Not Found', { status: 404 })

      const existingToken = (existing.rows[0] as any).share_token
      const token = existingToken ?? generateUUID()

      await db.execute(
        `UPDATE bibliographies SET share_token = '${token}', is_shared = true WHERE id = ${id}`
      )

      const origin = url.origin
      return json({ shareToken: token, shareUrl: `${origin}/share/${token}` })
    }

    if (req.method === 'DELETE') {
      const result = await db.execute(
        `UPDATE bibliographies SET is_shared = false WHERE id = ${id} RETURNING id`
      )
      if (!result.rows.length) return new Response('Not Found', { status: 404 })
      return json({ ok: true })
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
  ```

- [ ] **Step 2: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add api/bibliography-share.ts
  git commit -m "feat: add POST/DELETE /api/bibliography-share for shareable link toggling"
  ```

---

### Task 7: Create `api/share.ts` (public GET by token)

**Files:**
- Create: `api/share.ts`

- [ ] **Step 1: Create the public Edge function**

  ```ts
  // api/share.ts
  export const config = { runtime: 'edge' }

  import { getDb, migrate } from '../netlify/functions/_db'

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

  export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405 })

    await migrate()
    const db = getDb()
    const token = new URL(req.url).searchParams.get('token')
    if (!token) return new Response('Missing token', { status: 400 })

    // Single query: get bib where token matches AND is_shared = true
    // Returns 404 for both "not found" and "sharing disabled" — prevents token enumeration
    const bibResult = await db.execute(
      `SELECT id, name, description, creator_name AS "creatorName", tags, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM bibliographies
       WHERE share_token = '${token.replace(/'/g, "''")}' AND is_shared = true`
    )
    if (!bibResult.rows.length) return new Response('Not Found', { status: 404 })

    const bib = bibResult.rows[0] as any

    // Fetch papers — exclude note field (private)
    const papersResult = await db.execute(
      `SELECT id AS "rowId", paper_data AS paper, added_at AS "addedAt"
       FROM bibliography_papers
       WHERE bibliography_id = ${bib.id}
       ORDER BY added_at ASC`
    )

    return json({
      ...bib,
      papers: papersResult.rows.map((r: any) => ({
        rowId: r.rowId,
        paper: r.paper,
        addedAt: r.addedAt,
        // note intentionally excluded
      })),
    })
  }
  ```

- [ ] **Step 2: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add api/share.ts
  git commit -m "feat: add public GET /api/share endpoint for shared bibliography view"
  ```

---

### Task 8: Update `api/saved-searches.ts` to return and update `lastResultIds`

**Files:**
- Modify: `api/saved-searches.ts`

- [ ] **Step 1: Update GET to include `lastResultIds` and add PATCH handler**

  Replace the entire file content:

  ```ts
  export const config = { runtime: 'edge' }

  import { getDb, migrate, savedSearches } from '../netlify/functions/_db'
  import { eq } from 'drizzle-orm'

  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

  export default async function handler(req: Request): Promise<Response> {
    await migrate()
    const db = getDb()

    if (req.method === 'GET') {
      const result = await db.execute(
        `SELECT id, name, params, created_at AS "createdAt",
                COALESCE(last_result_ids, '[]'::jsonb) AS "lastResultIds"
         FROM saved_searches ORDER BY created_at DESC`
      )
      return json(result.rows)
    }

    if (req.method === 'POST') {
      const { name, params } = await req.json()
      const [created] = await db.insert(savedSearches).values({ name, params }).returning()
      return json({ ...created, lastResultIds: [] }, 201)
    }

    if (req.method === 'PATCH') {
      const id = parseInt(new URL(req.url).searchParams.get('id') ?? '0')
      if (!id) return new Response('Missing id', { status: 400 })
      const { lastResultIds } = await req.json()
      if (!Array.isArray(lastResultIds)) return new Response('lastResultIds must be an array', { status: 400 })
      const result = await db.execute(
        `UPDATE saved_searches SET last_result_ids = '${JSON.stringify(lastResultIds)}'::jsonb WHERE id = ${id} RETURNING id`
      )
      if (!result.rows.length) return new Response('Not Found', { status: 404 })
      return json({ ok: true })
    }

    if (req.method === 'DELETE') {
      const id = parseInt(new URL(req.url).searchParams.get('id') ?? '0')
      await db.delete(savedSearches).where(eq(savedSearches.id, id))
      return new Response(null, { status: 204 })
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
  ```

- [ ] **Step 2: Update `src/lib/api.ts` to add new API call functions**

  In `src/lib/api.ts`, add after the existing `deleteSavedSearch` function:

  ```ts
  export const updateSavedSearchResultIds = (id: number, lastResultIds: string[]) =>
    req<{ ok: boolean }>(`/saved-searches?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ lastResultIds }),
    })

  export const updateBibliographyNote = (rowId: number, note: string) =>
    req<{ rowId: number; note: string }>(`/bibliography-paper-note?rowId=${rowId}`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    })

  export const enableBibliographySharing = (id: number) =>
    req<{ shareToken: string; shareUrl: string }>(`/bibliography-share?id=${id}`, { method: 'POST' })

  export const disableBibliographySharing = (id: number) =>
    req<{ ok: boolean }>(`/bibliography-share?id=${id}`, { method: 'DELETE' })

  export const getSharedBibliography = (token: string) =>
    req<BibliographyWithPapers>(`/share?token=${token}`)
  ```

  Also update the `updateBibliography` function signature to accept `tags`:
  ```ts
  export const updateBibliography = (id: number, fields: { name?: string; description?: string; creatorName?: string; tags?: string }) =>
    req<Bibliography>(`/bibliography?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(fields),
    })
  ```

- [ ] **Step 3: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add api/saved-searches.ts src/lib/api.ts
  git commit -m "feat: saved-searches PATCH for lastResultIds; add new API helper functions"
  ```

---

## Chunk 3: Citation Formatter + Abstract Preview

### Task 9: Create `src/lib/citations.ts`

**Files:**
- Create: `src/lib/citations.ts`

- [ ] **Step 1: Create the citation formatter**

  ```ts
  // src/lib/citations.ts
  import type { Paper, CitationStyle } from '../types'

  // Fallback rules (from spec):
  // - authors empty → omit author segment, begin with title
  // - year missing → 'n.d.'
  // - journal missing → omit journal segment
  // - doi missing → use paper.url; if also absent, omit link
  // - title missing → '[No title]'

  function authorList(authors: string[], max = 6): string {
    if (!authors.length) return ''
    if (authors.length <= max) return authors.join(', ')
    return `${authors.slice(0, max).join(', ')} et al`
  }

  function firstAuthorLastFirst(authors: string[]): string {
    if (!authors.length) return ''
    const first = authors[0]
    const parts = first.trim().split(' ')
    if (parts.length < 2) return first
    const last = parts[parts.length - 1]
    const initials = parts.slice(0, -1).map(p => p[0] + '.').join('')
    return `${last} ${initials}`
  }

  function link(paper: Paper): string {
    if (paper.doi) return `https://doi.org/${paper.doi}`
    if (paper.url) return paper.url
    return ''
  }

  export function formatVancouver(p: Paper): string {
    const title = p.title || '[No title]'
    const year = p.year ?? 'n.d.'
    const l = link(p)

    let citation = ''
    if (p.authors?.length) {
      citation += `${authorList(p.authors)}. `
    }
    citation += `${title}. `
    if (p.journal) citation += `${p.journal}. `
    citation += `${year}`
    if (l) citation += `. Available from: ${l}`
    return citation.trim()
  }

  export function formatAPA(p: Paper): string {
    const title = p.title || '[No title]'
    const year = p.year ?? 'n.d.'
    const l = link(p)

    let citation = ''
    if (p.authors?.length) {
      const formatted = p.authors.map(a => {
        const parts = a.trim().split(' ')
        if (parts.length < 2) return a
        const last = parts[parts.length - 1]
        const initials = parts.slice(0, -1).map(pp => pp[0] + '.').join(' ')
        return `${last}, ${initials}`
      })
      citation += `${formatted.join(', ')}. `
    }
    citation += `(${year}). ${title}. `
    if (p.journal) citation += `*${p.journal}*. `
    if (l) citation += `${l}`
    return citation.trim().replace(/\.\s*$/, '.')
  }

  export function formatHarvard(p: Paper): string {
    const title = p.title || '[No title]'
    const year = p.year ?? 'n.d.'
    const l = link(p)

    let citation = ''
    if (p.authors?.length) {
      citation += `${firstAuthorLastFirst(p.authors)}`
      if (p.authors.length > 1) citation += ` et al.`
      citation += ` (${year}) `
    } else {
      citation += `(${year}) `
    }
    citation += `'${title}'`
    if (p.journal) citation += `, *${p.journal}*`
    if (l) citation += `. Available at: ${l}`
    return citation.trim().replace(/\s+\.$/, '.')
  }

  export function formatCitation(p: Paper, style: CitationStyle): string {
    switch (style) {
      case 'vancouver': return formatVancouver(p)
      case 'apa': return formatAPA(p)
      case 'harvard': return formatHarvard(p)
    }
  }
  ```

- [ ] **Step 2: Write unit tests**

  Create `src/lib/citations.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest'
  import { formatVancouver, formatAPA, formatHarvard, formatCitation } from './citations'
  import type { Paper } from '../types'

  const fullPaper: Paper = {
    id: 'pubmed:1',
    source: 'pubmed',
    title: 'Effect of Drug X on Condition Y',
    authors: ['Jane Smith', 'Bob Jones', 'Alice Brown'],
    journal: 'The Lancet',
    year: 2023,
    doi: '10.1000/xyz',
    url: 'https://pubmed.ncbi.nlm.nih.gov/1',
  }

  const minimalPaper: Paper = {
    id: 'crossref:2',
    source: 'crossref',
    title: '',
    authors: [],
    url: 'https://example.com/paper',
  }

  describe('formatVancouver', () => {
    it('formats a full paper', () => {
      const result = formatVancouver(fullPaper)
      expect(result).toContain('Smith')
      expect(result).toContain('Effect of Drug X')
      expect(result).toContain('2023')
      expect(result).toContain('The Lancet')
      expect(result).toContain('doi.org/10.1000/xyz')
    })
    it('handles missing authors — starts with title', () => {
      const result = formatVancouver({ ...fullPaper, authors: [] })
      expect(result).toMatch(/^Effect of Drug X/)
    })
    it('uses n.d. for missing year', () => {
      expect(formatVancouver({ ...fullPaper, year: undefined })).toContain('n.d.')
    })
    it('uses [No title] when title is empty', () => {
      expect(formatVancouver(minimalPaper)).toContain('[No title]')
    })
    it('falls back to url when doi is absent', () => {
      const result = formatVancouver({ ...fullPaper, doi: undefined })
      expect(result).toContain('https://pubmed.ncbi.nlm.nih.gov/1')
    })
    it('omits link entirely when both doi and url are absent', () => {
      const result = formatVancouver({ ...fullPaper, doi: undefined, url: '' })
      expect(result).not.toContain('Available from')
    })
  })

  describe('formatAPA', () => {
    it('formats a full paper', () => {
      const result = formatAPA(fullPaper)
      expect(result).toContain('(2023)')
      expect(result).toContain('Effect of Drug X')
    })
    it('handles no authors', () => {
      expect(formatAPA({ ...fullPaper, authors: [] })).toContain('(2023)')
    })
  })

  describe('formatHarvard', () => {
    it('formats a full paper', () => {
      const result = formatHarvard(fullPaper)
      expect(result).toContain('Smith')
      expect(result).toContain('(2023)')
      expect(result).toContain("'Effect of Drug X'")
    })
  })

  describe('formatCitation', () => {
    it('delegates to correct formatter', () => {
      expect(formatCitation(fullPaper, 'vancouver')).toEqual(formatVancouver(fullPaper))
      expect(formatCitation(fullPaper, 'apa')).toEqual(formatAPA(fullPaper))
      expect(formatCitation(fullPaper, 'harvard')).toEqual(formatHarvard(fullPaper))
    })
  })
  ```

- [ ] **Step 3: Run tests — expect them to pass**

  Run: `npx vitest run src/lib/citations.test.ts`
  Expected: all tests pass

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/citations.ts src/lib/citations.test.ts
  git commit -m "feat: add citation formatter (Vancouver, APA 7, Harvard) with tests"
  ```

---

### Task 10: Add inline abstract toggle to `ResultCard`

**Files:**
- Modify: `src/components/ResultCard.tsx`

The current `ResultCard` already has a "More/Less" toggle for abstracts (lines 96–103), but it shows a truncated preview by default. The spec wants a proper show/hide toggle — no preview, fully hidden by default. The existing `expanded` state (line 18) is reused.

- [ ] **Step 1: Replace the abstract section (lines 96–103) with a proper toggle**

  Replace:
  ```tsx
  {paper.abstract && (
    <div style={{ fontSize: 13, color: '#5a6a8a', lineHeight: 1.7, marginBottom: 10 }}>
      {expanded ? paper.abstract : `${paper.abstract.slice(0, 200)}...`}
      <button onClick={() => setExpanded(e => !e)} style={{ background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontSize: 13, marginLeft: 4 }}>
        {expanded ? 'Less' : 'More'}
      </button>
    </div>
  )}
  ```

  With:
  ```tsx
  {paper.abstract && (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 500 }}
      >
        {expanded ? 'Hide abstract ▲' : 'Show abstract ▼'}
      </button>
      {expanded && (
        <div style={{ marginTop: 8, padding: '10px 14px', background: '#f7f9fc', borderRadius: 8, fontSize: 13, color: '#5a6a8a', lineHeight: 1.7 }}>
          {paper.abstract}
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Step 2: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/components/ResultCard.tsx
  git commit -m "feat: replace abstract truncation with proper show/hide toggle on ResultCard"
  ```

---

## Chunk 4: PaperRow Enhancements (Notes + Date Added + Abstract + Citation Copy)

### Task 11: Rewrite `PaperRow` with notes, date added, abstract toggle, citation copy

**Files:**
- Modify: `src/components/PaperRow.tsx`

The current `PaperRow` is 39 lines. It will grow significantly with the 4 new features. It stays as one file — each responsibility (display, note editing, citation copy) is a small, focused section.

- [ ] **Step 1: Rewrite `PaperRow`**

  Replace the entire file:

  ```tsx
  import { useState } from 'react'
  import type { BibliographyPaperRow, CitationStyle } from '../types'
  import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'
  import { formatCitation } from '../lib/citations'
  import { updateBibliographyNote } from '../lib/api'

  interface Props {
    row: BibliographyPaperRow
    onRemove: (rowId: number) => void
    citationStyle: CitationStyle
  }

  export default function PaperRow({ row, onRemove, citationStyle }: Props) {
    const p = row.paper
    const color = SOURCE_COLORS[p.source] ?? { bg: '#f0f2f7', text: '#5a6a8a' }

    // Abstract toggle
    const [abstractOpen, setAbstractOpen] = useState(false)

    // Note editing
    const [noteText, setNoteText] = useState(row.note ?? '')
    const [noteEditing, setNoteEditing] = useState(false)
    const [noteSaving, setNoteSaving] = useState(false)
    const [noteError, setNoteError] = useState('')

    const saveNote = async () => {
      setNoteSaving(true)
      setNoteError('')
      try {
        await updateBibliographyNote(row.rowId, noteText)
        setNoteEditing(false)
      } catch {
        setNoteError('Failed to save note — try again')
      } finally {
        setNoteSaving(false)
      }
    }

    const handleNoteKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && e.ctrlKey) saveNote()
    }

    // Citation copy
    const [copied, setCopied] = useState(false)
    const copyCitation = () => {
      navigator.clipboard.writeText(formatCitation(p, citationStyle))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    // Date added
    const addedDate = row.addedAt
      ? new Date(row.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null

    return (
      <div style={{ background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '18px 20px', marginBottom: 10, boxShadow: '0 1px 3px rgba(26,42,74,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            {/* Title */}
            <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>{p.title}</div>

            {/* Metadata line */}
            <div style={{ fontSize: 13, color: '#7a8aaa', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {(p.authors ?? []).slice(0, 3).join(', ')}{(p.authors ?? []).length > 3 ? ' et al.' : ''}
              {p.journal && ` · ${p.journal}`}
              {p.year && ` · ${p.year}`}
              {addedDate && <span style={{ color: '#b0bccc' }}>· Added {addedDate}</span>}
              <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color.bg, color: color.text }}>
                {SOURCE_LABELS[p.source] ?? p.source}
              </span>
              {p.doi && (
                <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1a3a6b', fontSize: 12, textDecoration: 'none' }}>
                  DOI ↗
                </a>
              )}
            </div>

            {/* Abstract toggle */}
            {p.abstract && (
              <div style={{ marginBottom: 8 }}>
                <button
                  onClick={() => setAbstractOpen(o => !o)}
                  style={{ background: 'none', border: 'none', color: '#1a3a6b', cursor: 'pointer', fontSize: 12, padding: 0, fontWeight: 500 }}
                >
                  {abstractOpen ? 'Hide abstract ▲' : 'Show abstract ▼'}
                </button>
                {abstractOpen && (
                  <div style={{ marginTop: 8, padding: '10px 14px', background: '#f7f9fc', borderRadius: 8, fontSize: 13, color: '#5a6a8a', lineHeight: 1.7 }}>
                    {p.abstract}
                  </div>
                )}
              </div>
            )}

            {/* Note display */}
            {noteText && !noteEditing && (
              <div style={{ fontSize: 12, color: '#9aa5bf', fontStyle: 'italic', marginBottom: 6 }}>
                📝 {noteText}
              </div>
            )}

            {/* Note editor */}
            {noteEditing && (
              <div style={{ marginBottom: 8 }}>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onBlur={() => { if (!noteSaving) saveNote() }}
                  onKeyDown={handleNoteKeyDown}
                  rows={4}
                  maxLength={2000}
                  placeholder="Add a note about this paper..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                  autoFocus
                />
                {noteSaving && <div style={{ fontSize: 12, color: '#9aa5bf' }}>Saving…</div>}
                {noteError && <div style={{ fontSize: 12, color: '#c0392b' }}>{noteError}</div>}
              </div>
            )}

            {/* Action row */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
              <button
                onClick={() => setNoteEditing(e => !e)}
                disabled={noteSaving}
                style={{ background: 'none', border: '1px solid #dde3ef', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: '#7a8aaa', cursor: 'pointer' }}
              >
                {noteSaving ? 'Saving…' : noteText ? '✏️ Edit note' : '✏️ Add note'}
              </button>
              <button
                onClick={copyCitation}
                style={{ background: 'none', border: '1px solid #dde3ef', borderRadius: 5, padding: '3px 10px', fontSize: 12, color: copied ? '#22c55e' : '#7a8aaa', cursor: 'pointer' }}
              >
                {copied ? '✓ Copied' : '📋 Copy citation'}
              </button>
            </div>
          </div>

          <button
            onClick={() => onRemove(row.rowId)}
            style={{ background: '#fff5f5', border: '1.5px solid #fcc', color: '#c0392b', padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontWeight: 500, flexShrink: 0 }}
          >
            Remove
          </button>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/components/PaperRow.tsx
  git commit -m "feat: PaperRow — add notes, date added, abstract toggle, citation copy"
  ```

---

## Chunk 5: Bibliography Detail Page Enhancements

### Task 12: Update `BibliographyDetailPage` — tags, description, date-added filter/sort, citation style, print/share buttons

**Files:**
- Modify: `src/pages/BibliographyDetailPage.tsx`

This is the most complex single-file change. Read the full current file first.

- [ ] **Step 1: Read the current file**

  Read: `src/pages/BibliographyDetailPage.tsx` (full file)

- [ ] **Step 2: Add citation style state, share state, and new filter/sort state**

  At the top of the component, after existing state declarations, add:

  ```tsx
  // Citation style — persisted in localStorage
  const [citationStyle, setCitationStyle] = useState<CitationStyle>(
    () => (localStorage.getItem('sla-citation-style') as CitationStyle | null) ?? 'vancouver'
  )
  const handleCitationStyleChange = (style: CitationStyle) => {
    setCitationStyle(style)
    localStorage.setItem('sla-citation-style', style)
  }

  // Date added filter
  const [filterAddedFrom, setFilterAddedFrom] = useState('')
  const [filterAddedTo, setFilterAddedTo] = useState('')

  // Sort options now include date-added
  type SortKey = 'none' | 'date-desc' | 'date-asc' | 'az' | 'za' | 'added-desc' | 'added-asc'

  // Share state — initialized to null; set from bib data in useEffect below
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)

  // Inline edit state for description + tags
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  ```

- [ ] **Step 3: Add the `filterAddedFrom`/`filterAddedTo` to the filter logic**

  In the filter chain (`allRows.filter(...)`), add after the existing type filter:

  ```ts
  if (filterAddedFrom && row.addedAt && row.addedAt < filterAddedFrom) return false
  if (filterAddedTo && row.addedAt && row.addedAt > filterAddedTo + 'T23:59:59') return false
  ```

  In the sort chain, add the new cases:
  ```ts
  case 'added-desc': return new Date(b.addedAt ?? 0).getTime() - new Date(a.addedAt ?? 0).getTime()
  case 'added-asc': return new Date(a.addedAt ?? 0).getTime() - new Date(b.addedAt ?? 0).getTime()
  ```

- [ ] **Step 4: Add share toggle handler and description/tags save handler**

  ```tsx
  const handleEnableShare = async () => {
    if (!bib) return
    setShareLoading(true)
    try {
      const { shareUrl: url } = await enableBibliographySharing(bib.id)
      setShareUrl(url)
      setBib(b => b ? { ...b, isShared: true } : null)
    } finally {
      setShareLoading(false)
    }
  }

  const handleDisableShare = async () => {
    if (!bib) return
    setShareLoading(true)
    try {
      await disableBibliographySharing(bib.id)
      setShareUrl(null)
      setBib(b => b ? { ...b, isShared: false } : null)
    } finally {
      setShareLoading(false)
    }
  }

  const handleSaveDescription = async () => {
    if (!bib) return
    setEditSaving(true)
    setEditError('')
    try {
      await updateBibliography(bib.id, { description: editDescription })
      setBib(b => b ? { ...b, description: editDescription } : null)
    } catch {
      setEditError('Failed to save')
      setEditDescription(bib.description)
    } finally {
      setEditSaving(false)
    }
  }

  const handleSaveTags = async () => {
    if (!bib) return
    const normalised = editTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 10).join(',')
    setEditSaving(true)
    setEditError('')
    try {
      await updateBibliography(bib.id, { tags: normalised })
      setBib(b => b ? { ...b, tags: normalised } : null)
      setEditTags(normalised)
    } catch {
      setEditError('Failed to save')
      setEditTags(bib.tags ?? '')
    } finally {
      setEditSaving(false)
    }
  }
  ```

- [ ] **Step 5: Add citation style selector, share button, print button, date-added filter inputs, and "Copy all citations" to the UI**

  In the page header area (after the bibliography name/creator), add:

  ```tsx
  {/* Citation style + Print + Share actions */}
  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
    <select
      value={citationStyle}
      onChange={e => handleCitationStyleChange(e.target.value as CitationStyle)}
      style={{ padding: '5px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, background: '#f7f9fc' }}
    >
      <option value="vancouver">Vancouver</option>
      <option value="apa">APA 7th</option>
      <option value="harvard">Harvard</option>
    </select>
    <a
      href={`/bibliographies/${bib.id}/print`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, color: '#5a6a8a', textDecoration: 'none', background: '#fff' }}
    >
      🖨️ Print / PDF
    </a>
    {/* Share panel */}
    {!bib.isShared ? (
      <button onClick={handleEnableShare} disabled={shareLoading} style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, color: '#5a6a8a', background: '#fff', cursor: 'pointer' }}>
        {shareLoading ? 'Enabling…' : '🔗 Share'}
      </button>
    ) : (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#7a8aaa', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(shareUrl ?? ''); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000) }}
          style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #dde3ef', fontSize: 12, color: shareCopied ? '#22c55e' : '#5a6a8a', background: '#fff', cursor: 'pointer' }}
        >
          {shareCopied ? '✓ Copied' : '📋 Copy link'}
        </button>
        <button onClick={handleDisableShare} disabled={shareLoading} style={{ padding: '4px 10px', borderRadius: 5, border: 'none', fontSize: 12, color: '#c0392b', background: 'none', cursor: 'pointer' }}>
          Stop sharing
        </button>
      </div>
    )}
  </div>

  {/* Inline description + tags */}
  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <textarea
      value={editDescription}
      onChange={e => setEditDescription(e.target.value)}
      onBlur={handleSaveDescription}
      placeholder="Add a description..."
      rows={2}
      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
    />
    <input
      value={editTags}
      onChange={e => setEditTags(e.target.value)}
      onBlur={handleSaveTags}
      placeholder="Tags (comma-separated, e.g. regulatory, ibd, draft)"
      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #dde3ef', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
    />
    {editError && <div style={{ fontSize: 12, color: '#c0392b' }}>{editError}</div>}
    {/* Tag chips preview */}
    {editTags && (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {editTags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
          <span key={tag} style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#f0f4ff', color: '#1a3a6b' }}>{tag}</span>
        ))}
      </div>
    )}
  </div>
  ```

  Initialize `editDescription`, `editTags`, and `shareUrl` from `bib` in the `useEffect` that loads the bib:
  ```ts
  setBib(data)
  setEditDescription(data.description ?? '')
  setEditTags(data.tags ?? '')
  // shareUrl must be set here (after bib loads) — not at state declaration time
  if (data.isShared && data.shareToken) {
    setShareUrl(`${window.location.origin}/share/${data.shareToken}`)
  }
  ```

  In the filter panel, add date-added range inputs:
  ```tsx
  <div>
    <label style={labelStyle}>Date Added From</label>
    <input type="date" value={filterAddedFrom} onChange={e => setFilterAddedFrom(e.target.value)} style={inputStyle} />
  </div>
  <div>
    <label style={labelStyle}>Date Added To</label>
    <input type="date" value={filterAddedTo} onChange={e => setFilterAddedTo(e.target.value)} style={inputStyle} />
  </div>
  ```

  In the sort dropdown, add:
  ```tsx
  <option value="added-desc">Date Added (newest)</option>
  <option value="added-asc">Date Added (oldest)</option>
  ```

  Pass `citationStyle` to `PaperRow`:
  ```tsx
  <PaperRow key={row.rowId} row={row} onRemove={handleRemove} citationStyle={citationStyle} />
  ```

  Add "Copy all citations" button near the export controls:
  ```tsx
  <button
    onClick={() => {
      const text = displayedRows.map((r, i) => `${i + 1}. ${formatCitation(r.paper, citationStyle)}`).join('\n\n')
      navigator.clipboard.writeText(text)
    }}
    style={{ padding: '8px 16px', border: '1.5px solid #dde3ef', borderRadius: 6, fontSize: 13, color: '#5a6a8a', background: '#fff', cursor: 'pointer' }}
  >
    📋 Copy all citations
  </button>
  <button
    onClick={() => {
      const text = displayedRows.map((r, i) => `${i + 1}. ${formatCitation(r.paper, citationStyle)}`).join('\n\n')
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${bib.name.replace(/\s+/g, '-').toLowerCase()}-citations.txt`
      a.click()
      URL.revokeObjectURL(url)
    }}
    style={{ padding: '8px 16px', border: '1.5px solid #dde3ef', borderRadius: 6, fontSize: 13, color: '#5a6a8a', background: '#fff', cursor: 'pointer' }}
  >
    ⬇️ Download .txt
  </button>
  ```

- [ ] **Step 6: Add missing imports at top of file**

  Add to the import block:
  ```ts
  import type { CitationStyle } from '../types'
  import { formatCitation } from '../lib/citations'
  import { enableBibliographySharing, disableBibliographySharing } from '../lib/api'
  ```

- [ ] **Step 7: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/pages/BibliographyDetailPage.tsx
  git commit -m "feat: bibliography detail — tags, description, date-added filter/sort, citation style, print, share"
  ```

---

## Chunk 6: Bibliographies List + Print Page + Share Page

### Task 13: Update `BibliographiesPage` — description snippets and tag filter

**Files:**
- Modify: `src/pages/BibliographiesPage.tsx`

- [ ] **Step 1: Add tag filter state and logic**

  After the `bibs` state declaration, add:
  ```tsx
  const [activeTag, setActiveTag] = useState<string | null>(null)

  const allTags = [...new Set(
    bibs.flatMap(b => (b.tags ?? '').split(',').map(t => t.trim()).filter(Boolean))
  )].sort()

  const displayedBibs = activeTag
    ? bibs.filter(b => (b.tags ?? '').split(',').map(t => t.trim()).includes(activeTag))
    : bibs
  ```

- [ ] **Step 2: Add tag filter bar above the bib grid**

  After the page header row and before the loading check, add:
  ```tsx
  {allTags.length > 0 && (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {allTags.map(tag => (
        <button
          key={tag}
          onClick={() => setActiveTag(t => t === tag ? null : tag)}
          style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: activeTag === tag ? '#1a3a6b' : '#f0f4ff',
            color: activeTag === tag ? '#fff' : '#1a3a6b',
          }}
        >
          {tag}
        </button>
      ))}
    </div>
  )}
  ```

- [ ] **Step 3: Update bib card to show description truncated + tag chips**

  Inside the bib card loop (after `bib.description` display), add tag chips:
  ```tsx
  {/* Truncated description */}
  {bib.description && (
    <div style={{ fontSize: 13, color: '#7a8aaa', marginBottom: 6, lineHeight: 1.5 }}>
      {bib.description.length > 80 ? bib.description.slice(0, 80) + '…' : bib.description}
    </div>
  )}
  {/* Tag chips */}
  {bib.tags && (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
      {bib.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
        <span key={tag} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#f0f4ff', color: '#1a3a6b' }}>{tag}</span>
      ))}
    </div>
  )}
  ```

  Replace `bibs.map(bib =>` with `displayedBibs.map(bib =>`.

- [ ] **Step 4: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/pages/BibliographiesPage.tsx
  git commit -m "feat: bibliographies list — description snippets, tag chips, tag filter bar"
  ```

---

### Task 14: Create `BibliographyPrintPage`

**Files:**
- Create: `src/pages/BibliographyPrintPage.tsx`

- [ ] **Step 1: Create the print page**

  ```tsx
  // src/pages/BibliographyPrintPage.tsx
  import { useState, useEffect } from 'react'
  import { useParams } from 'react-router-dom'
  import type { BibliographyWithPapers, CitationStyle } from '../types'
  import { getBibliography } from '../lib/api'
  import { formatCitation } from '../lib/citations'

  export default function BibliographyPrintPage() {
    const { id } = useParams<{ id: string }>()
    const [bib, setBib] = useState<BibliographyWithPapers | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const citationStyle: CitationStyle =
      (localStorage.getItem('sla-citation-style') as CitationStyle | null) ?? 'vancouver'

    useEffect(() => {
      if (!id) return
      getBibliography(Number(id))
        .then(setBib)
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }, [id])

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#9aa5bf' }}>Loading…</div>
    if (error || !bib) return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#c0392b' }}>Unable to load bibliography.</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 6, border: '1.5px solid #dde3ef', cursor: 'pointer' }}>Retry</button>
      </div>
    )

    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', fontFamily: 'Georgia, serif' }}>
        {/* Print controls — hidden on print */}
        <div className="no-print" style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          <button onClick={() => window.history.back()} style={{ padding: '7px 14px', borderRadius: 6, border: '1.5px solid #dde3ef', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            ← Back
          </button>
          <button onClick={() => window.print()} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: '#1a3a6b', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            🖨️ Print / Save as PDF
          </button>
        </div>

        {/* Header */}
        <div style={{ borderBottom: '2px solid #1a2a4a', paddingBottom: 16, marginBottom: 24 }}>
          <img src="/sla-logo.png" alt="SLA Pharma" style={{ height: 48, marginBottom: 12 }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a2035', margin: 0 }}>{bib.name}</h1>
          {bib.creatorName && <p style={{ margin: '4px 0 0', color: '#7a8aaa', fontSize: 13 }}>Created by {bib.creatorName}</p>}
          {bib.description && <p style={{ margin: '6px 0 0', color: '#5a6a8a', fontSize: 13 }}>{bib.description}</p>}
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9aa5bf' }}>
            Exported {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{bib.papers.length} reference{bib.papers.length !== 1 ? 's' : ''}
            {' · '}{citationStyle.toUpperCase()}
          </p>
          {/* Tag chips */}
          {bib.tags && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {bib.tags.split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                <span key={tag} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#f0f4ff', color: '#1a3a6b' }}>{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Reference list — force page break after every 30 items */}
        <ol style={{ paddingLeft: 24, margin: 0 }}>
          {bib.papers.map((row, i) => (
            <li
              key={row.rowId}
              style={{
                marginBottom: 14,
                fontSize: 13,
                lineHeight: 1.7,
                color: '#1a2035',
                pageBreakInside: 'avoid',
                // Insert a forced page break before every 31st item (after every 30)
                ...((i > 0 && i % 30 === 0) ? { pageBreakBefore: 'always' } : {}),
              }}
            >
              {formatCitation(row.paper, citationStyle)}
            </li>
          ))}
        </ol>

        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white; }
            li { page-break-inside: avoid; }
          }
        `}</style>
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/pages/BibliographyPrintPage.tsx
  git commit -m "feat: add BibliographyPrintPage for print/PDF export"
  ```

---

### Task 15: Create `SharedBibliographyPage`

**Files:**
- Create: `src/pages/SharedBibliographyPage.tsx`

- [ ] **Step 1: Create the public share page**

  ```tsx
  // src/pages/SharedBibliographyPage.tsx
  import { useState, useEffect } from 'react'
  import { useParams } from 'react-router-dom'
  import type { BibliographyWithPapers } from '../types'
  import { getSharedBibliography } from '../lib/api'
  import { SOURCE_COLORS, SOURCE_LABELS } from '../lib/sourceColors'

  export default function SharedBibliographyPage() {
    const { token } = useParams<{ token: string }>()
    const [bib, setBib] = useState<BibliographyWithPapers | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<'not-found' | 'network' | null>(null)

    const load = () => {
      if (!token) return
      setLoading(true)
      setError(null)
      getSharedBibliography(token)
        .then(setBib)
        .catch(e => {
          if (e.message?.includes('404')) setError('not-found')
          else setError('network')
        })
        .finally(() => setLoading(false))
    }

    useEffect(load, [token])

    if (loading) return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        <div style={{ color: '#9aa5bf', fontSize: 15 }}>Loading bibliography…</div>
      </div>
    )

    if (error === 'not-found') return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Montserrat, system-ui, sans-serif', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, color: '#1a2035', marginBottom: 8 }}>Bibliography Not Available</h2>
          <p style={{ color: '#7a8aaa', fontSize: 14 }}>This bibliography is not available. The link may have been deactivated.</p>
        </div>
      </div>
    )

    if (error === 'network' || !bib) return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#c0392b', fontSize: 14 }}>Unable to load — please try again.</p>
          <button onClick={load} style={{ marginTop: 12, padding: '8px 16px', borderRadius: 6, border: '1.5px solid #dde3ef', cursor: 'pointer' }}>Retry</button>
        </div>
      </div>
    )

    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: '1.5px solid #dde3ef' }}>
          <img src="/sla-logo.png" alt="SLA Pharma" style={{ height: 44, background: '#fff', borderRadius: 6, padding: 4 }} />
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a2035', margin: 0 }}>{bib.name}</h1>
            <div style={{ fontSize: 13, color: '#7a8aaa', marginTop: 4 }}>
              {bib.creatorName && `By ${bib.creatorName} · `}
              {bib.papers.length} paper{bib.papers.length !== 1 ? 's' : ''}
              {' · '}Shared bibliography (read-only)
            </div>
          </div>
        </div>

        {/* Papers */}
        {bib.papers.map(row => {
          const p = row.paper
          const color = SOURCE_COLORS[p.source] ?? { bg: '#f0f2f7', text: '#5a6a8a' }
          return (
            <div key={row.rowId} style={{ background: '#fff', border: '1.5px solid #dde3ef', borderRadius: 10, padding: '18px 20px', marginBottom: 10, boxShadow: '0 1px 3px rgba(26,42,74,0.04)' }}>
              <div style={{ fontSize: 15, color: '#1a2035', fontWeight: 600, marginBottom: 6, lineHeight: 1.5 }}>{p.title}</div>
              <div style={{ fontSize: 13, color: '#7a8aaa', display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {(p.authors ?? []).slice(0, 3).join(', ')}{(p.authors ?? []).length > 3 ? ' et al.' : ''}
                {p.journal && ` · ${p.journal}`}
                {p.year && ` · ${p.year}`}
                <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: color.bg, color: color.text }}>
                  {SOURCE_LABELS[p.source] ?? p.source}
                </span>
                {p.doi && (
                  <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1a3a6b', fontSize: 12, textDecoration: 'none' }}>
                    DOI ↗
                  </a>
                )}
              </div>
              {p.abstract && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ fontSize: 12, color: '#1a3a6b', cursor: 'pointer', fontWeight: 500 }}>Show abstract</summary>
                  <div style={{ marginTop: 8, padding: '10px 14px', background: '#f7f9fc', borderRadius: 8, fontSize: 13, color: '#5a6a8a', lineHeight: 1.7 }}>
                    {p.abstract}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/pages/SharedBibliographyPage.tsx
  git commit -m "feat: add SharedBibliographyPage for public read-only bibliography view"
  ```

---

### Task 16: Register new routes in `App.tsx`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Read the current file**

  Read the full `src/App.tsx` first to identify all existing routes. The replacement below must include every existing route that is currently in the file — do not drop any existing routes.

- [ ] **Step 2: Add imports and new routes**

  ```tsx
  import { Routes, Route } from 'react-router-dom'
  import Layout from './components/Layout'
  import HomePage from './pages/HomePage'
  import SearchPage from './pages/SearchPage'
  import BibliographiesPage from './pages/BibliographiesPage'
  import BibliographyDetailPage from './pages/BibliographyDetailPage'
  import BibliographyPrintPage from './pages/BibliographyPrintPage'
  import SharedBibliographyPage from './pages/SharedBibliographyPage'
  import SavedSearchesPage from './pages/SavedSearchesPage'
  import HistoryPage from './pages/HistoryPage'

  export default function App() {
    return (
      <Routes>
        {/* Standalone routes — no sidebar */}
        <Route path="/bibliographies/:id/print" element={<BibliographyPrintPage />} />
        <Route path="/share/:token" element={<SharedBibliographyPage />} />

        {/* Main app with sidebar layout */}
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/bibliographies" element={<BibliographiesPage />} />
          <Route path="/bibliographies/:id" element={<BibliographyDetailPage />} />
          <Route path="/saved-searches" element={<SavedSearchesPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Route>
      </Routes>
    )
  }
  ```

- [ ] **Step 3: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/App.tsx
  git commit -m "feat: register /bibliographies/:id/print and /share/:token routes"
  ```

---

## Chunk 7: Saved Search Re-run + NEW Badge + Excel Notes Export

### Task 17: Update `SavedSearchCard` + `SearchPage` + `ResultsList` + `ResultCard` for one-click re-run

**Files:**
- Modify: `src/components/SavedSearchCard.tsx`
- Modify: `src/pages/SearchPage.tsx`
- Modify: `src/components/ResultsList.tsx` (or wherever `ResultCard` is rendered from `SearchPage`)
- Modify: `src/components/ResultCard.tsx`

Note: `SavedSearchesPage.tsx` itself does not need changes — the "Run now" button lives in `SavedSearchCard`.

- [ ] **Step 1: Read current `SearchPage.tsx` and `ResultsList.tsx`**

  Read both files fully before editing. You need to know the exact signature of `handleSearch`, how `ResultsList` is called, and how `ResultCard` is rendered. Do not add imports that already exist.

- [ ] **Step 2: Update `SavedSearchCard` to use `?savedId=` query param**

  In `src/components/SavedSearchCard.tsx`, change `handleLoadAndRun`:

  ```tsx
  const handleLoadAndRun = () => {
    navigate(`/search?savedId=${search.id}`)
  }
  ```

  Change the button label from `▶ Load & Run` to `▶ Run now`.

- [ ] **Step 3: Update `SearchPage` to handle `?savedId=` and auto-run**

  In `src/pages/SearchPage.tsx`:

  Add these imports at the top:
  ```ts
  import { useLocation, useSearchParams } from 'react-router-dom'
  import { updateSavedSearchResultIds } from '../lib/api'
  import type { SavedSearch } from '../types'
  ```

  After existing state declarations, add:
  ```ts
  const [searchParams] = useSearchParams()
  const [savedId, setSavedId] = useState<number | null>(null)
  const [lastResultIds, setLastResultIds] = useState<string[]>([])
  const [autoRunDone, setAutoRunDone] = useState(false)
  ```

  Add a `useEffect` that loads saved search params and auto-runs:
  ```ts
  useEffect(() => {
    const id = parseInt(searchParams.get('savedId') ?? '0')
    if (!id || autoRunDone) return
    setAutoRunDone(true)
    setSavedId(id)
    // Fetch saved search, pre-fill form, auto-run
    fetch(`/api/saved-searches`)
      .then(r => r.json())
      .then((searches: SavedSearch[]) => {
        const found = searches.find(s => s.id === id)
        if (!found) return
        setLastResultIds(found.lastResultIds ?? [])
        handleSearch(found.params)
      })
      .catch(() => {}) // silently ignore — user can run manually
  }, [searchParams])
  ```

  After `setResults(response)` in `handleSearch`, add:
  ```ts
  // If this was a saved search re-run, update lastResultIds
  if (savedId) {
    const allPapers = response.results.flatMap(r => r.papers)
    const ids = allPapers.map(p => p.doi ?? p.id)
    updateSavedSearchResultIds(savedId, ids).catch(() => {})
    setLastResultIds(ids) // update local state so NEW badges show immediately
  }
  ```

  Pass `lastResultIds` down to `ResultsList` (it'll forward to `ResultCard`):
  ```tsx
  <ResultsList ... lastResultIds={lastResultIds} />
  ```

- [ ] **Step 4: Update `ResultsList` to accept `lastResultIds` and pass `isNew` to each `ResultCard`**

  In `ResultsList.tsx`, add `lastResultIds: string[]` to the Props interface:
  ```ts
  interface Props {
    // ...existing props...
    lastResultIds: string[]
  }
  ```

  When rendering each `ResultCard`, compute and pass `isNew`:
  ```tsx
  const key = paper.doi ?? paper.id
  const isNew = lastResultIds.length > 0 && !lastResultIds.includes(key)
  // ...
  <ResultCard ... isNew={isNew} />
  ```

- [ ] **Step 5: Update `ResultCard` to accept and show `isNew` prop**

  In `src/components/ResultCard.tsx`:

  Add `isNew?: boolean` to the `Props` interface.

  The card's outer wrapper `<div>` must have `position: 'relative'` for the badge to position correctly.

  Add to the component's JSX (inside the card's outer div, as a badge):
  ```tsx
  {isNew && (
    <div style={{ position: 'absolute', top: 12, right: 12, background: '#22c55e', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.05em' }}>
      NEW
    </div>
  )}
  ```

- [ ] **Step 6: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/components/SavedSearchCard.tsx src/pages/SearchPage.tsx src/components/ResultsList.tsx src/components/ResultCard.tsx
  git commit -m "feat: saved search one-click re-run with NEW badge on first-seen results"
  ```

---

### Task 18: Update Excel export to include Notes column

**Files:**
- Modify: `src/lib/export.ts`
- Modify: `src/pages/BibliographyDetailPage.tsx`

- [ ] **Step 1: Add `exportBibliographyToExcel` function that includes notes**

  In `src/lib/export.ts`, add a new function after `exportToExcel`:

  ```ts
  export function exportBibliographyRowsToExcel(rows: import('../types').BibliographyPaperRow[], filename = 'bibliography.xlsx') {
    const data = rows.map(row => ({
      Title: row.paper.title,
      Authors: (row.paper.authors ?? []).join('; '),
      Journal: row.paper.journal ?? '',
      Year: row.paper.year ?? '',
      DOI: row.paper.doi ?? '',
      URL: row.paper.url,
      Source: row.paper.source,
      Type: row.paper.type ?? '',
      Abstract: row.paper.abstract ?? '',
      'Citation Count': row.paper.citationCount ?? '',
      Notes: row.note ?? '',
      'Date Added': row.addedAt ? new Date(row.addedAt).toLocaleDateString('en-GB') : '',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(data)
    const colWidths = Object.keys(data[0] ?? {}).map(key => ({
      wch: Math.max(key.length, ...data.map(r => String((r as any)[key] ?? '').length).slice(0, 50)),
    }))
    ws['!cols'] = colWidths
    XLSX.utils.book_append_sheet(wb, ws, 'Bibliography')
    XLSX.writeFile(wb, filename)
  }
  ```

- [ ] **Step 2: Update `BibliographyDetailPage` to use `exportBibliographyRowsToExcel`**

  Replace the call to `exportToExcel(...)` with:
  ```ts
  exportBibliographyRowsToExcel(displayedRows, `${bib.name.replace(/\s+/g, '-')}.xlsx`)
  ```

  Update the import line:
  ```ts
  import { exportBibliographyRowsToExcel } from '../lib/export'
  ```

- [ ] **Step 3: Verify and commit**

  ```bash
  npx tsc --noEmit
  git add src/lib/export.ts src/pages/BibliographyDetailPage.tsx
  git commit -m "feat: Excel export includes Notes and Date Added columns"
  ```

---

### Task 19: Final build verification + push

- [ ] **Step 1: Run full TypeScript check**

  ```bash
  npx tsc --noEmit
  ```
  Expected: 0 errors

- [ ] **Step 2: Run Vitest**

  ```bash
  npx vitest run
  ```
  Expected: all tests pass (citation formatter tests + existing source adapter tests)

- [ ] **Step 3: Build**

  ```bash
  npm run build
  ```
  Expected: build succeeds with no errors

- [ ] **Step 4: Push to trigger Vercel deploy**

  ```bash
  git push
  ```

- [ ] **Step 5: Verify Vercel deployment is READY**

  Check: https://sla-bibliography-generator.vercel.app/
  - Home dashboard loads
  - Search page works
  - Bibliographies list shows with tag filter bar
  - Bibliography detail shows citation style dropdown, Print button, Share button
  - `/share/nonexistent-token` shows "Bibliography Not Available" page
