import type { SearchParams, Paper } from './types'
import { buildBaseQuery, buildEuropePMCAuthorClause, buildEuropePMCCountryClause, buildEuropePMCTitleTerms, buildNotClause } from './queryBuilder'

export async function searchEuropePMC(params: SearchParams): Promise<Paper[]> {
  const query = buildBaseQuery(params)
    + buildEuropePMCTitleTerms(params)
    + buildEuropePMCAuthorClause(params)
    + buildEuropePMCCountryClause(params)
    + buildNotClause(params)
    + (params.bibliographyType === 'clinical' ? ' AND HAS_ABSTRACT:Y' : '')

  // EuropePMC expects YYYYMMDD format, not YYYY-MM-DD
  const fromDate = params.dateFrom.replace(/-/g, '')
  const toDate = params.dateTo.replace(/-/g, '')
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=500&sort=cited%20desc&fromDate=${fromDate}&toDate=${toDate}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.resultList?.result ?? []).map((r: any): Paper => ({
    id: `europepmc:${r.id}`,
    source: 'europepmc',
    title: r.title ?? 'Unknown',
    authors: r.authorString ? r.authorString.split(', ') : [],
    journal: r.journalTitle,
    year: r.pubYear ? parseInt(r.pubYear) : undefined,
    doi: r.doi,
    url: `https://europepmc.org/article/${r.source}/${r.id}`,
    abstract: r.abstractText,
  }))
}
