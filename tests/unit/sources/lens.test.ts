import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchLens } from '../../../netlify/functions/_sources/lens'
vi.stubGlobal('fetch', vi.fn())
describe('searchLens', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
    delete process.env.LENS_API_KEY
  })
  it('returns empty array when no API key is set', async () => {
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
  })
})
