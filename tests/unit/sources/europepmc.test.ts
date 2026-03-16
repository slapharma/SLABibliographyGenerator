import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchEuropePMC } from '../../../netlify/functions/_sources/europepmc'
vi.stubGlobal('fetch', vi.fn())
describe('searchEuropePMC', () => {
  beforeEach(() => vi.mocked(fetch).mockReset())
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
