import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchClinicalTrials } from '../../../netlify/functions/_sources/clinicaltrials'
vi.stubGlobal('fetch', vi.fn())
describe('searchClinicalTrials', () => {
  beforeEach(() => vi.mocked(fetch).mockReset())
  it('returns empty array on no results', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ studies: [] }) } as any)
    const r = await searchClinicalTrials({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['clinicaltrials'] })
    expect(r).toEqual([])
  })
  it('maps NCT fields to Paper', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true, json: async () => ({ studies: [{
        protocolSection: {
          identificationModule: { nctId: 'NCT123', briefTitle: 'Test Trial' },
          descriptionModule: { briefSummary: 'A summary' },
          statusModule: { startDateStruct: { date: '2022-01' } },
          designModule: { studyType: 'Interventional' },
          contactsLocationsModule: { overallOfficials: [{ name: 'Dr Smith' }] },
        }
      }] })
    } as any)
    const r = await searchClinicalTrials({ indication: 'x', keywords: '', paperType: '', dateFrom: '2020-01-01', dateTo: '2026-01-01', sources: ['clinicaltrials'] })
    expect(r[0].id).toBe('clinicaltrials:NCT123')
    expect(r[0].type).toBe('Interventional')
  })
})
