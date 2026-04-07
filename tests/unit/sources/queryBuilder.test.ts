import { describe, it, expect } from 'vitest'
import { buildBaseQuery, buildNotClause, buildPubMedAuthorClause, buildPubMedCountryClause, buildPubMedPaperTypeClause, buildPubMedTitleTerms, buildEuropePMCTitleTerms, buildGenericTitleTerms, appendCountry } from '../../../netlify/functions/_sources/queryBuilder'
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
  it('excludes keywords for non-clinical type', () => {
    expect(buildBaseQuery({ ...base, bibliographyType: 'guidelines' })).toBe("Crohn's disease")
  })
  it('excludes keywords for health-economics type', () => {
    expect(buildBaseQuery({ ...base, bibliographyType: 'health-economics' })).toBe("Crohn's disease")
  })
  it('excludes keywords for prevalence type', () => {
    expect(buildBaseQuery({ ...base, bibliographyType: 'prevalence' })).toBe("Crohn's disease")
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
  it('returns PubMed [ad] tag for single country', () => {
    expect(buildPubMedCountryClause({ ...base, country: 'United Kingdom' })).toBe(' AND United Kingdom[ad]')
  })
  it('returns OR-joined [ad] tags for multiple countries', () => {
    expect(buildPubMedCountryClause({ ...base, country: 'United Kingdom,Germany' })).toBe(' AND (United Kingdom[ad] OR Germany[ad])')
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

describe('buildPubMedTitleTerms', () => {
  it('returns empty for clinical type', () => {
    expect(buildPubMedTitleTerms(base)).toBe('')
  })
  it('returns PubMed title clause for guidelines — single words unquoted, phrases quoted', () => {
    const result = buildPubMedTitleTerms({ ...base, bibliographyType: 'guidelines' })
    expect(result).toContain('guideline[ti]')
    expect(result).toContain('"position statement"[ti]')
    expect(result).toMatch(/^ AND \(/)
  })
  it('returns PubMed title clause for health-economics', () => {
    const result = buildPubMedTitleTerms({ ...base, bibliographyType: 'health-economics' })
    expect(result).toContain('"health economics"[ti]')
  })
  it('returns PubMed title clause for prevalence', () => {
    const result = buildPubMedTitleTerms({ ...base, bibliographyType: 'prevalence' })
    expect(result).toContain('prevalence[ti]')
    expect(result).toContain('"disease burden"[ti]')
  })
})

describe('buildEuropePMCTitleTerms', () => {
  it('returns empty for clinical type', () => {
    expect(buildEuropePMCTitleTerms(base)).toBe('')
  })
  it('returns EuropePMC TITLE clause for guidelines — single words unquoted', () => {
    const result = buildEuropePMCTitleTerms({ ...base, bibliographyType: 'guidelines' })
    expect(result).toContain('TITLE:guideline')
    expect(result).toContain('TITLE:"position statement"')
    expect(result).toMatch(/^ AND \(/)
  })
})

describe('buildGenericTitleTerms', () => {
  it('returns empty for clinical type', () => {
    expect(buildGenericTitleTerms(base)).toBe('')
  })
  it('includes AND connector and quoted multi-word phrases for guidelines', () => {
    const result = buildGenericTitleTerms({ ...base, bibliographyType: 'guidelines' })
    expect(result).toContain('"position statement"')
    expect(result).toMatch(/^ AND \(/)
  })
})
