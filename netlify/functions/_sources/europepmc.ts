import type { SearchParams, Paper } from './types'
export async function searchEuropePMC(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' AND ')
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=50&fromDate=${params.dateFrom}&toDate=${params.dateTo}`
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
