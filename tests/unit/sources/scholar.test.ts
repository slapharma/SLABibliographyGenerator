import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchScholar } from '../../../netlify/functions/_sources/scholar'
vi.stubGlobal('fetch', vi.fn())
describe('searchScholar', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
    delete process.env.SERPAPI_KEY
  })
  it('returns empty array and skips fetch when SERPAPI_KEY is absent', async () => {
    const r = await searchScholar({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['scholar'] })
    expect(r).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })
})
