// src/lib/api.ts
import type {
  SearchParams,
  SearchResponse,
  Bibliography,
  BibliographyWithPapers,
  SavedSearch,
  HistoryEntry,
  Paper,
} from '../types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${path} failed (${res.status}): ${text}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Search ────────────────────────────────────────────────
export const searchAll = (params: SearchParams) =>
  req<SearchResponse>('/search', { method: 'POST', body: JSON.stringify(params) })

// ── Bibliographies ────────────────────────────────────────
export const listBibliographies = () =>
  req<Bibliography[]>('/bibliographies')

export const createBibliography = (name: string, description: string, creatorName = '') =>
  req<Bibliography>('/bibliographies', {
    method: 'POST',
    body: JSON.stringify({ name, description, creatorName }),
  })

export const getBibliography = (id: number) =>
  req<BibliographyWithPapers>(`/bibliography?id=${id}`)

export const updateBibliography = (id: number, name: string, description: string) =>
  req<Bibliography>(`/bibliography?id=${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name, description }),
  })

export const deleteBibliography = (id: number) =>
  req<void>(`/bibliography?id=${id}`, { method: 'DELETE' })

// ── Bibliography Papers ───────────────────────────────────
export const addPaperToBibliography = (bibliographyId: number, paper: Paper) =>
  req<void>('/bibliography-papers', {
    method: 'POST',
    body: JSON.stringify({ bibliographyId, paper }),
  })

export const removePaperFromBibliography = (bibliographyId: number, paperId: number) =>
  req<void>(`/bibliography-papers?bibliographyId=${bibliographyId}&paperId=${paperId}`, {
    method: 'DELETE',
  })

// ── Saved Searches ────────────────────────────────────────
export const listSavedSearches = () =>
  req<SavedSearch[]>('/saved-searches')

export const createSavedSearch = (name: string, params: SearchParams) =>
  req<SavedSearch>('/saved-searches', {
    method: 'POST',
    body: JSON.stringify({ name, params }),
  })

export const deleteSavedSearch = (id: number) =>
  req<void>(`/saved-searches?id=${id}`, { method: 'DELETE' })

// ── History ───────────────────────────────────────────────
export const listHistory = () =>
  req<HistoryEntry[]>('/history')

export const deleteHistoryEntry = (id: number) =>
  req<void>(`/history?id=${id}`, { method: 'DELETE' })

export const clearHistory = () =>
  req<void>('/history', { method: 'DELETE' })
