import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchSemanticScholar } from '../../../netlify/functions/_sources/semanticscholar'
vi.stubGlobal('fetch', vi.fn())
describe('searchSemanticScholar', () => {
  beforeEach(() => vi.mocked(fetch).mockReset())
  it('returns empty array on no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) } as any)
    const r = await searchSemanticScholar({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['semanticscholar'] })
    expect(r).toEqual([])
  })
  it('maps Semantic Scholar fields to Paper', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({
        data: [{ paperId: 'SS1', title: 'SS Paper', authors: [{ name: 'Jones B' }], year: 2021, journal: { name: 'Nature' }, externalIds: { DOI: '10.1/ss' }, abstract: 'abs', citationCount: 42, publicationTypes: ['Review'] }]
      })
    } as any)
    const r = await searchSemanticScholar({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['semanticscholar'] })
    expect(r[0].id).toBe('semanticscholar:SS1')
    expect(r[0].citationCount).toBe(42)
  })
})
