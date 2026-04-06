// src/types/index.ts

export type Source =
  | 'pubmed'
  | 'europepmc'
  | 'clinicaltrials'
  | 'semanticscholar'
  | 'crossref'
  | 'scholar'

export interface Paper {
  id: string              // source:externalId  e.g. "pubmed:38123456"
  source: Source          // primary source (first found)
  sources?: Source[]      // all sources this paper was found in (populated after dedup)
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

export type BibliographyType = 'clinical' | 'guidelines' | 'health-economics' | 'prevalence'

export interface SearchParams {
  indication: string
  keywords: string
  paperType: string
  dateFrom: string
  dateTo: string
  sources: Source[]
  bibliographyType: BibliographyType   // default 'clinical'
  country?: string                      // shown for all types except 'clinical'
  author?: string                       // search by author name
  negativeKeywords?: string             // comma-separated terms to exclude
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
  creatorName: string
  tags: string            // comma-separated, e.g. "regulatory,ibd"
  shareToken: string | null
  isShared: boolean
  createdAt: string
  updatedAt: string
  paperCount: number
}

export interface BibliographyPaperRow {
  rowId: number   // bibliography_papers.id — needed for DELETE
  paper: Paper
  note: string        // annotation text, empty string when unset
  addedAt: string     // ISO timestamp from bibliography_papers.added_at
  searchParams?: SearchParams  // search context used when paper was added
}

export interface BibliographyWithPapers extends Bibliography {
  papers: BibliographyPaperRow[]
}

export interface SavedSearch {
  id: number
  name: string
  params: SearchParams
  createdAt: string
  lastResultIds: string[] // DOIs or source:externalId keys from last run
}

export interface HistoryEntry {
  id: number
  params: SearchParams
  resultCount: number
  searchedAt: string
}

export type CitationStyle = 'vancouver' | 'apa' | 'harvard'
