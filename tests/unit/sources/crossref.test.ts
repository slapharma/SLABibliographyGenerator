import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchCrossRef } from '../../../netlify/functions/_sources/crossref'
vi.stubGlobal('fetch', vi.fn())
describe('searchCrossRef', () => {
  beforeEach(() => vi.mocked(fetch).mockReset())
  it('returns empty array on no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ message: { items: [] } }) } as any)
    const r = await searchCrossRef({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['crossref'] })
    expect(r).toEqual([])
  })
  it('maps CrossRef fields to Paper', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({
        message: { items: [{ DOI: '10.1/cr', title: ['CrossRef Paper'], author: [{ family: 'Brown', given: 'C' }], 'container-title': ['NEJM'], published: { 'date-parts': [[2022]] }, type: 'journal-article' }] }
      })
    } as any)
    const r = await searchCrossRef({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['crossref'] })
    expect(r[0].id).toBe('crossref:10.1/cr')
    expect(r[0].year).toBe(2022)
  })
})
