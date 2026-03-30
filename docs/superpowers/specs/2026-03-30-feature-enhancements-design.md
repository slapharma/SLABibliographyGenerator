# SLA Bibliography Generator — Feature Enhancements Design

**Date:** 2026-03-30
**Status:** Approved
**Scope:** 7 new features + 1 field addition across the existing React/Vite/Neon stack

---

## Context

The app is used by a mixed team at SLA Pharma: researchers building evidence dossiers and medical affairs / comms teams pulling papers quickly for materials. Key pain points: no way to annotate papers, no sharing mechanism, no formatted citation output, and discovery friction when re-running saved searches.

### Architecture note
Edge functions live in `api/` (Vercel). The shared database module and schema live in `netlify/functions/_db.ts` — all `api/` Edge functions import from that shared module. New API files follow the same pattern. New migrations are added as additional `db.execute()` calls inside `migrate()` in `netlify/functions/_db.ts`.

---

## Database Migrations

All new columns added via `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — safe against existing data.

```sql
-- Feature 1
ALTER TABLE bibliography_papers ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT '';

-- Feature 3
ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT '';

-- Feature 7
ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT false;

-- Feature 8
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_result_ids JSONB NOT NULL DEFAULT '[]';
```

| Table | New Column | Type | Default |
|---|---|---|---|
| `bibliography_papers` | `note` | `TEXT NOT NULL` | `''` |
| `bibliographies` | `tags` | `TEXT NOT NULL` | `''` |
| `bibliographies` | `share_token` | `TEXT` | `NULL` |
| `bibliographies` | `is_shared` | `BOOLEAN NOT NULL` | `false` |
| `saved_searches` | `last_result_ids` | `JSONB NOT NULL` | `'[]'` |

---

## Feature 1 — Paper Annotations & Notes

### What
Each paper row inside a bibliography gets an inline "✏️ Add note" button. Clicking it reveals a textarea where the user can type a private annotation. Notes are private — excluded from shared bibliography views (Feature 7).

### API

**`PATCH /api/bibliography-paper-note?rowId=:rowId`**
- File: `api/bibliography-paper-note.ts`
- URL uses query param `rowId` (integer), consistent with existing `api/bibliography-papers.ts` pattern
- Request body: `{ note: string }` (max 2000 chars; longer values rejected with 400)
- Success response: `{ rowId: number, note: string }`
- Error responses (plain text, matching existing pattern):
  - `400 Bad Request` — missing or invalid `rowId`, missing `note` field, note exceeds 2000 chars
  - `404 Not Found` — `rowId` does not exist in `bibliography_papers`
  - `500 Internal Server Error` — database failure

### UI
- `PaperRow`: when `note` is non-empty, show it below title as grey italic text
- "✏️ Add note" / "✏️ Edit note" toggle button reveals inline `<textarea>` (4 rows)
- **Save trigger:** blur or Ctrl+Enter. Shift+Enter inserts newline.
- **Loading state:** button shows "Saving…" and is disabled during PATCH. On success, textarea closes.
- **Error state:** if PATCH fails, textarea stays open and a red inline message shows "Failed to save note — try again"
- Notes included as a "Notes" column in the Excel export

---

## Feature 2 — Date Added Field

### What
Surface `bibliography_papers.added_at` (the existing column, not `created_at`) as "Date Added" in the bibliography detail view, with sort and filter support.

### API
`GET /api/bibliography/:id` response: add `addedAt: string` (ISO timestamp) to each paper row object.

### UI
- `PaperRow`: show "Added [DD Mon YYYY]" in the metadata line
- `BibliographyDetailPage` sort dropdown: add "Date Added (newest)" and "Date Added (oldest)"
- Filter panel: add "Date Added From / To" date inputs (renders as `<input type="date">`)
- **Interaction with year filter:** both filters are active simultaneously and combine with AND. A paper must satisfy both year range AND date-added range to appear.

---

## Feature 3 — Bibliography Description & Tags

### What
Surface the existing `bibliographies.description` field and add a tags system for labelling and filtering.

### Tag storage
Tags stored as `TEXT` (comma-separated). Rules:
- Tags are trimmed and lowercased on save (e.g. " IBD " → `"ibd"`)
- Max 10 tags per bibliography; max 30 chars per tag
- Filtering is **client-side**: load all bibliographies, filter in JS. No server-side LIKE query. Matching is exact per normalised tag (after trim + lowercase).

### API
- `GET /api/bibliographies` and `GET /api/bibliography/:id`: include `tags: string` and `description: string` in responses (already in schema, just not returned)
- `PATCH /api/bibliography/:id` — accepts `{ name?, description?, tags? }`. Returns updated bibliography object. Existing endpoint extended.

### UI
- `BibliographiesPage`: show description (max 80 chars, truncated with "…") below name. Tags rendered as small coloured chips below description.
- Tag filter bar above grid: all unique tags across all bibliographies shown as clickable chips. Active tag is highlighted; clicking filters the list (client-side).
- `BibliographyDetailPage` header: inline-editable description (single `<textarea>`) and tags (comma-separated text input with chip preview)
- **Save trigger for description and tags:** blur — consistent with note save (Feature 1). No explicit Save button.
- **Error state:** inline red text "Failed to save" if PATCH fails. Field reverts to previous value.

---

## Feature 4 — Inline Abstract Preview

### What
Expand/collapse toggle for abstracts on search result cards and bibliography paper rows.

### UI
- `ResultCard`: "Show abstract ▼" / "Hide abstract ▲" small link button below the metadata line. Abstract rendered in a light-grey rounded box when expanded. Gracefully hidden (no toggle shown) when `paper.abstract` is absent or empty string.
- `PaperRow` (in bibliography detail): same toggle pattern.
- **State:** local per-card `useState` — not persisted. Collapses on page navigation.

---

## Feature 5 — Formatted Citation Export

### What
Client-side citation formatter. Produces Vancouver, APA 7th, and Harvard formatted strings from the existing `Paper` object.

### Citation fallback rules (applied consistently across all formats)
| Field missing | Fallback |
|---|---|
| `authors` empty | Omit author segment; begin with title |
| `year` missing | Use `n.d.` |
| `journal` missing | Omit journal segment |
| `doi` missing | Use `paper.url` as the link; if also absent, omit entirely |
| `title` missing | Use `"[No title]"` |

### Implementation
- New file: `src/lib/citations.ts`
- Exports: `formatVancouver(p: Paper): string`, `formatAPA(p: Paper): string`, `formatHarvard(p: Paper): string`, `formatCitation(p: Paper, style: CitationStyle): string`
- `CitationStyle = 'vancouver' | 'apa' | 'harvard'`

### UI
- `BibliographyDetailPage` header: citation style dropdown (default `vancouver`). Selection persisted in `localStorage` key `sla-citation-style`.
- Each `PaperRow`: "📋 Copy" button. Copies formatted citation to clipboard. Shows "✓ Copied" for 2 seconds then reverts.
- Export panel: "Copy all citations" — copies numbered list of **currently filtered and sorted** papers only (not all papers in the bibliography).
- Export panel: "Download .txt" — downloads same list as `bibliography-name-citations.txt`.

---

## Feature 6 — PDF Export

### What
Print-optimised page opened in a new tab. Uses `window.print()`.

### Route
`/bibliographies/:id/print` → `BibliographyPrintPage`

### Data loading
`BibliographyPrintPage` fetches its own data via `GET /api/bibliography/:id` on mount (does not rely on passed Router state, so direct URL navigation works). Uses the same `getBibliography()` API function.

### Citation style
`BibliographyPrintPage` reads citation style from `localStorage` key `sla-citation-style` (same key as Feature 5). Since the print page is same-origin (opened via `window.open()` or `<Link target="_blank">`), localStorage is accessible. Defaults to `vancouver` if key absent.

### UI
- Full-page layout: SLA logo, bibliography name, creator name, date exported, tag chips, citation format label
- Numbered reference list using the selected citation format
- "← Back" link (hidden on print via `@media print { display: none }`)
- "🖨️ Print / Save as PDF" button calls `window.print()`
- `@media print`: hide Back link, hide Print button, white background, 12pt serif font, page breaks between every 30 references
- **Loading state:** spinner shown while fetching. **Error state:** "Unable to load bibliography" message with a retry button.

---

## Feature 7 — Shareable Read-Only Link

### What
Each bibliography can be made publicly accessible via a stable UUID-based URL. No login required for viewers. Notes (Feature 1) are **excluded** from the shared view.

### Token policy
- `share_token` is a UUID generated once on first share enable. It is **never regenerated** — disabling and re-enabling sharing restores the same URL.
- `is_shared = false` + non-null `share_token` = sharing disabled (token reserved)
- `is_shared = true` + non-null `share_token` = sharing active

### API

**`POST /api/bibliography-share?id=:id`**
- Generates UUID token if `share_token` is NULL, sets `is_shared = true`
- Response: `{ shareToken: string, shareUrl: string }` (shareUrl = full URL e.g. `https://sla-bibliography-generator.vercel.app/share/:token`)
- 404 if bibliography `id` not found

**`DELETE /api/bibliography-share?id=:id`**
- Sets `is_shared = false` (token preserved)
- Response: `{ ok: true }`

**`GET /api/share?token=:token`** (file: `api/share.ts`)
- Public, unauthenticated
- Returns bibliography + papers (excluding `note` fields) if `is_shared = true`
- Returns `404` if token not found **or** if `is_shared = false` (does not distinguish the two cases — prevents token existence leakage)
- CORS: `Access-Control-Allow-Origin: *` (read-only public data, no credentials involved)
- No rate limiting required at this stage (internal tool, low traffic)

### UI
- `BibliographyDetailPage` header: "🔗 Share" button
  - When `isShared = false`: button opens a small panel — "Enable sharing" toggle. On enable, shows the URL + "📋 Copy link" button + "Stop sharing" link.
  - When `isShared = true`: shows URL inline with "📋 Copy link" and "Stop sharing" link.
  - Re-enabling sharing after disabling: same URL is restored. UI shows "Your previous link is restored."
- New page: `SharedBibliographyPage` at `/share/:token`
  - Standalone layout (no sidebar, no bottom nav) — own `<Layout>` wrapper
  - Shows: SLA logo header, bibliography name, creator, paper count, paper list with source badges, abstracts, DOI links
  - Notes are **not shown**
  - **Loading state:** spinner
  - **Error state (404 or network):** "This bibliography is not available. The link may have been deactivated." — no redirect
  - **Network error:** "Unable to load — please try again" with retry button

---

## Feature 8 — Re-run Saved Search + New Result Highlighting

### What
One-click re-run from the Saved Searches page. New papers (not seen on the previous run) get a green "NEW" badge.

### New result comparison key
Paper IDs used for comparison: DOI takes priority (stable across sources). If no DOI, falls back to `paper.id` (`source:externalId`). This means a paper re-discovered from a different source but with the same DOI is correctly recognised as "not new".

### API

**`PATCH /api/saved-searches?id=:id`** (added to existing `api/saved-searches.ts`)
- Request body: `{ lastResultIds: string[] }`
- Response: `{ ok: true }`
- 404 if saved search not found

`GET /api/saved-searches` response: add `lastResultIds: string[]` to each saved search object.

### UI

**`SavedSearchesPage` / `SavedSearchCard`:**
- "▶ Run now" button navigates immediately to `/search?savedId=X` (no loading state on the card — navigation is instant)

**`SearchPage`:**
- On mount: reads `?savedId` from query string. If present, fetches saved search via `GET /api/saved-search/:id`, pre-fills form fields, and **auto-triggers the search** (calls `handleSearch()` after params are set)
- After results load: calls `PATCH /api/saved-searches?id=X` with the array of paper IDs (DOI or `source:externalId`) from the new results. If user navigates away before results load, the PATCH never fires — this is acceptable; `lastResultIds` remains from the previous run (conservative: fewer false "NEW" badges next time)
- `lastResultIds` is stored in `SearchPage` state alongside the savedId, passed down to `ResultsList`

**`ResultCard`:**
- Receives `isNew?: boolean` prop
- If `true`: green "NEW" badge (pill, top-right corner of card)
- Badge shown for papers whose comparison key (`doi ?? id`) is **not** in `lastResultIds`

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/citations.ts` | Pure citation formatter — Vancouver, APA 7, Harvard |
| `src/pages/BibliographyPrintPage.tsx` | Print-optimised bibliography view |
| `src/pages/SharedBibliographyPage.tsx` | Public read-only share view (no sidebar) |
| `api/share.ts` | GET /api/share?token= (public) |
| `api/bibliography-paper-note.ts` | PATCH /api/bibliography-paper-note?rowId= |
| `api/bibliography-share.ts` | POST/DELETE /api/bibliography-share?id= |

---

## Modified Files

| File | Change |
|---|---|
| `netlify/functions/_db.ts` | 5 new `ALTER TABLE … ADD COLUMN IF NOT EXISTS` migrations in `migrate()` |
| `src/types/index.ts` | Add `note`, `addedAt`, `tags`, `shareToken`, `isShared`, `lastResultIds` fields to relevant interfaces |
| `src/lib/api.ts` | New API call functions for share, note, saved-search PATCH |
| `src/lib/export.ts` | Add Notes column to Excel export |
| `src/components/PaperRow.tsx` | Note UI, date added, abstract toggle, citation copy button |
| `src/components/ResultCard.tsx` | Abstract toggle, NEW badge |
| `src/pages/BibliographyDetailPage.tsx` | Tags, description, date-added filter/sort, citation style selector, print/share buttons |
| `src/pages/BibliographiesPage.tsx` | Tag filter bar, description on cards |
| `src/pages/SavedSearchesPage.tsx` | "Run now" button |
| `src/pages/SearchPage.tsx` | `savedId` query param handling, auto-run, post-search `lastResultIds` PATCH |
| `src/App.tsx` | New routes: `/bibliographies/:id/print`, `/share/:token` (SharedBibliographyPage uses standalone layout, not the main Layout) |

---

## Out of Scope

- Real-time collaboration / multi-user editing
- Email notifications
- Full-text PDF download (requires publisher API access)
- Citation import from RIS/BibTeX files
- Token regeneration (intentionally excluded — stable URL policy)
