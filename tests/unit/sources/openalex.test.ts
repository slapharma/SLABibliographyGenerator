import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchOpenAlex } from '../../../netlify/functions/_sources/openalex'
vi.stubGlobal('fetch', vi.fn())
describe('searchOpenAlex', () => {
  beforeEach(() => vi.mocked(fetch).mockReset())
  it('returns empty array on no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) } as any)
    const r = await searchOpenAlex({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['openalex'] })
    expect(r).toEqual([])
  })
  it('maps OpenAlex fields to Paper', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({
        results: [{ id: 'https://openalex.org/W123', title: 'OA Paper', authorships: [{ author: { display_name: 'Garcia M' } }], publication_year: 2023, primary_location: { source: { display_name: 'Lancet' }, landing_page_url: 'https://lancet.com/1' }, doi: 'https://doi.org/10.1/oa', abstract_inverted_index: { 'An': [0], 'abstract': [1] } }]
      })
    } as any)
    const r = await searchOpenAlex({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['openalex'] })
    expect(r[0].id).toBe('openalex:https://openalex.org/W123')
    expect(r[0].doi).toBe('10.1/oa')
    expect(r[0].abstract).toBe('An abstract')
  })
})
