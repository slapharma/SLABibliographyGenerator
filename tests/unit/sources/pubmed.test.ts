import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchPubMed } from '../../../netlify/functions/_sources/pubmed'

vi.stubGlobal('fetch', vi.fn())

describe('searchPubMed', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockReset()
  })

  it('returns empty array when fetch returns no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ esearchresult: { idlist: [] } }) } as any)
    const results = await searchPubMed({
      indication: 'hypertension', keywords: '', paperType: '',
      dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['pubmed']
    })
    expect(results).toEqual([])
  })

  it('maps PubMed fields to Paper interface correctly', async () => {
    vi.mocked(fetch)
      // 1. esearch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ esearchresult: { idlist: ['12345678'] } })
      } as any)
      // 2. esummary (parallel with efetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          result: {
            '12345678': {
              uid: '12345678',
              title: 'Test Paper Title',
              authors: [{ name: 'Smith J' }],
              fulljournalname: 'Test Journal',
              pubdate: '2023',
              articleids: [{ idtype: 'doi', value: '10.1234/test' }],
              source: 'TJ',
            }
          }
        })
      } as any)
      // 3. efetch (parallel with esummary) — return empty XML, abstract optional
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      } as any)

    const results = await searchPubMed({
      indication: 'hypertension', keywords: 'ACE inhibitor', paperType: 'RCT',
      dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['pubmed']
    })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('pubmed:12345678')
    expect(results[0].source).toBe('pubmed')
    expect(results[0].title).toBe('Test Paper Title')
    expect(results[0].doi).toBe('10.1234/test')
  })
})
