import { describe, it, expect } from 'vitest'
import { buildBaseQuery, buildNotClause, buildPubMedAuthorClause, buildPubMedCountryClause, buildPubMedPaperTypeClause, appendCountry } from '../../../netlify/functions/_sources/queryBuilder'
import type { SearchParams } from '../../../netlify/functions/_sources/types'

const base: SearchParams = {
  indication: "Crohn's disease",
  keywords: 'biologic',
  paperType: '',
  dateFrom: '2021-01-01',
  dateTo: '2026-01-01',
  sources: ['pubmed'],
  bibliographyType: 'clinical',
}

describe('buildBaseQuery', () => {
  it('joins indication and keywords', () => {
    expect(buildBaseQuery(base)).toBe("Crohn's disease AND biologic")
  })
  it('appends guidelines terms for guidelines type', () => {
    const p = { ...base, bibliographyType: 'guidelines' as const }
    expect(buildBaseQuery(p)).toContain('guidelines OR')
  })
  it('appends health-economics terms', () => {
    const p = { ...base, bibliographyType: 'health-economics' as const }
    expect(buildBaseQuery(p)).toContain('cost-effectiveness')
  })
  it('appends prevalence terms', () => {
    const p = { ...base, bibliographyType: 'prevalence' as const }
    expect(buildBaseQuery(p)).toContain('prevalence')
  })
  it('omits empty indication', () => {
    expect(buildBaseQuery({ ...base, indication: '' })).toBe('biologic')
  })
})

describe('buildNotClause', () => {
  it('returns empty string when no negative keywords', () => {
    expect(buildNotClause(base)).toBe('')
  })
  it('returns NOT clause for single term', () => {
    expect(buildNotClause({ ...base, negativeKeywords: 'animal' })).toBe(' NOT (animal)')
  })
  it('handles comma-separated single-word terms', () => {
    expect(buildNotClause({ ...base, negativeKeywords: 'animal, mouse' })).toBe(' NOT (animal OR mouse)')
  })
  it('quotes multi-word comma-separated phrases', () => {
    expect(buildNotClause({ ...base, negativeKeywords: 'case report, animal study' })).toBe(' NOT ("case report" OR "animal study")')
  })
})

describe('buildPubMedAuthorClause', () => {
  it('returns empty when no author', () => {
    expect(buildPubMedAuthorClause(base)).toBe('')
  })
  it('returns PubMed [au] tag', () => {
    expect(buildPubMedAuthorClause({ ...base, author: 'Smith J' })).toBe(' AND Smith J[au]')
  })
})

describe('buildPubMedCountryClause', () => {
  it('returns empty when no country', () => {
    expect(buildPubMedCountryClause(base)).toBe('')
  })
  it('returns PubMed [ad] tag', () => {
    expect(buildPubMedCountryClause({ ...base, country: 'United Kingdom' })).toBe(' AND United Kingdom[ad]')
  })
})

describe('appendCountry', () => {
  it('returns query unchanged when no country', () => {
    expect(appendCountry('cancer', base)).toBe('cancer')
  })
  it('appends country to query', () => {
    expect(appendCountry('cancer', { ...base, country: 'France' })).toBe('cancer France')
  })
})

describe('buildPubMedPaperTypeClause', () => {
  it('returns empty when no paper type', () => {
    expect(buildPubMedPaperTypeClause(base)).toBe('')
  })
  it('returns single AND clause for one type', () => {
    expect(buildPubMedPaperTypeClause({ ...base, paperType: 'RCT' })).toBe(' AND randomized controlled trial[pt]')
  })
  it('returns OR-joined clause for multiple types (not AND)', () => {
    const result = buildPubMedPaperTypeClause({ ...base, paperType: 'RCT,Systematic Review' })
    expect(result).toBe(' AND (randomized controlled trial[pt] OR systematic review[pt])')
  })
  it('ignores unknown paper types', () => {
    expect(buildPubMedPaperTypeClause({ ...base, paperType: 'Unknown' })).toBe('')
  })
})
