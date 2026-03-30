# SLA Bibliography Generator — Feature Enhancements Design

**Date:** 2026-03-30
**Status:** Approved
**Scope:** 7 new features + 1 field addition across the existing React/Vite/Neon stack

---

## Context

The app is used by a mixed team at SLA Pharma: researchers building evidence dossiers and medical affairs / comms teams pulling papers quickly for materials. Key pain points identified: no way to annotate papers, no sharing mechanism, no formatted citation output, and discovery friction when re-running saved searches.

---

## Feature 1 — Paper Annotations & Notes

### What
Each paper row inside a bibliography gets an inline "Add note" button. Clicking it reveals a text area where the user can type a private annotation (e.g. "Key study for Section 3", "Contradicts Smith 2021"). The note is saved on blur.

### Data
- New column: `bibliography_papers.note TEXT NOT NULL DEFAULT ''`
- Added via `ALTER TABLE bibliography_papers ADD COLUMN IF NOT EXISTS note TEXT NOT NULL DEFAULT ''`
- Existing rows default to empty string — no migration data risk

### API
- `PATCH /api/bibliography-papers/:rowId` — update `note` field. New Edge function.
- Returns `{ rowId, note }` on success

### UI
- `PaperRow` component: show note text below title (grey italic) when note is non-empty
- "✏️ Add note" / "✏️ Edit note" button toggles inline `<textarea>`
- Saves on blur or Enter (Shift+Enter = newline)
- Notes included as an extra "Notes" column in the Excel export

---

## Feature 2 — Date Added Field

### What
Surface the existing `bibliography_papers.created_at` as "Date Added" in the bibliography detail view. Add it as a sort option and filter range.

### Data
No schema change — `created_at` already exists on `bibliography_papers`. The API just needs to return it.

### API
- `GET /api/bibliography/:id` response: add `addedAt: string` (ISO) to each paper row in the response

### UI
- `PaperRow`: show "Added [date]" in the metadata line (alongside year, journal)
- `BibliographyDetailPage` sort options: add "Date Added ↑" and "Date Added ↓"
- Filter panel: add "Date Added From / To" date range inputs (mirrors existing year range pattern)

---

## Feature 3 — Bibliography Description & Tags

### What
Surface the existing (but unused) `bibliographies.description` field in the UI. Add a tags system for labelling and filtering bibliographies.

### Data
- `description` column already exists — just needs UI
- New column: `bibliographies.tags TEXT NOT NULL DEFAULT ''` (comma-separated, e.g. `"regulatory,IBD,draft"`)
- Added via `ALTER TABLE bibliographies ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT ''`

### API
- `GET /api/bibliographies` and `GET /api/bibliography/:id`: include `tags` in response
- `PATCH /api/bibliography/:id` — update `name`, `description`, `tags`. Existing endpoint extended.

### UI
- `BibliographiesPage`: show description snippet (max 80 chars) below bib name on cards. Tag chips rendered as small coloured pills below.
- Tag filter bar above the grid: clicking a tag filters the list to matching bibliographies
- `BibliographyDetailPage` header: inline-editable description and tags field

---

## Feature 4 — Inline Abstract Preview

### What
Expand/collapse toggle on every paper card (search results) and paper row (bibliography detail). No API change needed — `abstract` already exists on the `Paper` type.

### UI
- `ResultCard`: "Show abstract ▼" / "Hide abstract ▲" toggle button below the metadata line. Renders abstract text in a light grey box when expanded.
- `PaperRow`: same pattern — small toggle link. Gracefully hidden when `paper.abstract` is absent or empty.
- State is local (per card) — no persistence needed

---

## Feature 5 — Formatted Citation Export

### What
Client-side citation formatter. Formats Vancouver, APA 7th, and Harvard from the `Paper` object fields already available. Per-paper copy button + "Copy all citations" for the full bibliography.

### Implementation
- New file: `src/lib/citations.ts` — pure functions:
  - `formatVancouver(paper: Paper): string`
  - `formatAPA(paper: Paper): string`
  - `formatHarvard(paper: Paper): string`
  - `formatCitation(paper: Paper, style: CitationStyle): string`
- Handles graceful fallback when fields (authors, journal, year) are missing
- No API call needed — fully client-side

### UI
- `BibliographyDetailPage` header: citation style dropdown (Vancouver / APA 7 / Harvard). Selection persisted in `localStorage` key `sla-citation-style`.
- Each `PaperRow`: "📋 Copy" button — copies formatted citation for that paper to clipboard
- Export panel: "Copy all citations" button — copies numbered list of all filtered/sorted papers
- Export panel: "Download .txt" — downloads formatted citation list as a text file

---

## Feature 6 — PDF Export

### What
Print-optimised view of a bibliography. Opens in a new tab as a clean printable page. Uses `window.print()` — no server-side PDF generation.

### Route
- New route: `/bibliographies/:id/print` → `BibliographyPrintPage`
- Accessible via "Print / Save PDF" button in the bibliography detail header

### UI (`BibliographyPrintPage`)
- Full-page print layout: SLA logo, bibliography name, creator name, date exported, citation style used
- Numbered reference list using the selected citation format
- Print-specific CSS (`@media print`): hide browser chrome, force white background, clean typography
- "← Back" link (hidden on print) and "Print this page" button

---

## Feature 7 — Shareable Read-Only Link

### What
Each bibliography can be made publicly accessible via a unique URL. No login required for viewers. Toggle on/off by the bibliography owner.

### Data
- New columns on `bibliographies`:
  - `share_token TEXT` — UUID generated on first share, never regenerated (stable URL)
  - `is_shared BOOLEAN NOT NULL DEFAULT false`
- Added via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`

### API
- `POST /api/bibliography/:id/share` — generates token if absent, sets `is_shared = true`. Returns `{ shareToken, shareUrl }`.
- `DELETE /api/bibliography/:id/share` — sets `is_shared = false` (token preserved for re-enabling)
- New public endpoint: `GET /api/share/:token` — returns bibliography + papers if `is_shared = true`, else 404

### UI
- `BibliographyDetailPage` header: "🔗 Share" button. When shared: shows the URL with a "📋 Copy link" button and a "Stop sharing" link.
- New page: `SharedBibliographyPage` at `/share/:token` — read-only view, no sidebar (standalone layout), shows papers with source badges, abstracts, DOI links. No editing controls.

---

## Feature 8 — Re-run Saved Search + New Result Highlighting

### What
One-click re-run of a saved search from the Saved Searches page. Results from the new run are compared against the previous run — papers not seen before get a "NEW" badge.

### Data
- New column: `saved_searches.last_result_ids JSONB NOT NULL DEFAULT '[]'`
- Stores array of paper IDs (DOI or `source:externalId`) from the most recent run
- Updated automatically after each re-run

### API
- `GET /api/saved-searches` and `GET /api/saved-search/:id`: include `lastResultIds: string[]`
- `PATCH /api/saved-search/:id` — update `last_result_ids` after a run

### UI
- `SavedSearchCard`: "▶ Run now" button. Navigates to `/search?savedId=X` which pre-fills the form and auto-triggers the search.
- `SearchPage`: reads `savedId` from query string. If present, loads saved search params, runs immediately, and after results load calls `PATCH /api/saved-search/:id` with the new result IDs.
- `ResultCard`: if the paper's ID is not in `lastResultIds`, render a green "NEW" badge in the top-right corner of the card.

---

## Database Migration Summary

All changes use `ADD COLUMN IF NOT EXISTS` — safe to run against the existing live Neon database without data loss.

| Table | New Column | Type | Default |
|---|---|---|---|
| `bibliography_papers` | `note` | `TEXT` | `''` |
| `bibliographies` | `tags` | `TEXT` | `''` |
| `bibliographies` | `share_token` | `TEXT` | `NULL` |
| `bibliographies` | `is_shared` | `BOOLEAN` | `false` |
| `saved_searches` | `last_result_ids` | `JSONB` | `'[]'` |

Migrations run inside the existing `migrate()` function in `netlify/functions/_db.ts` as additional `db.execute()` calls.

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/citations.ts` | Pure citation formatter functions |
| `src/pages/BibliographyPrintPage.tsx` | Print-optimised bibliography view |
| `src/pages/SharedBibliographyPage.tsx` | Public read-only share view |
| `api/share.ts` | Edge function: GET /api/share/:token |
| `api/bibliography-paper-note.ts` | Edge function: PATCH /api/bibliography-papers/:rowId |
| `api/bibliography-share.ts` | Edge functions: POST/DELETE /api/bibliography/:id/share |

---

## Modified Files

| File | Change |
|---|---|
| `netlify/functions/_db.ts` | 5 new ALTER TABLE migrations |
| `src/types/index.ts` | Add `note`, `addedAt`, `tags`, `shareToken`, `isShared`, `lastResultIds` fields |
| `src/lib/api.ts` | New API call functions for share, note, saved-search update |
| `src/components/PaperRow.tsx` | Note UI, date added, abstract toggle, citation copy |
| `src/components/ResultCard.tsx` | Abstract toggle, NEW badge |
| `src/pages/BibliographyDetailPage.tsx` | Tags, description, date-added filter/sort, citation style, print/share buttons |
| `src/pages/BibliographiesPage.tsx` | Tag filter bar, description on cards |
| `src/pages/SavedSearchesPage.tsx` | Run now button |
| `src/pages/SearchPage.tsx` | savedId query param handling, post-search result ID save |
| `src/components/Layout.tsx` | Add `/share/:token` route to App (no sidebar) |
| `src/App.tsx` | New routes: print, share |

---

## Out of Scope

- Real-time collaboration / multi-user editing
- Email notifications
- Full-text PDF download (requires publisher API access)
- Citation import from RIS/BibTeX files
