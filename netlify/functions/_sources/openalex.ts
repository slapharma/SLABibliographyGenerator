import type { SearchParams, Paper } from './types'
import { buildBaseQuery, appendAuthor, appendCountry, buildNotClause } from './queryBuilder'

export async function searchOpenAlex(params: SearchParams): Promise<Paper[]> {
  let query = buildBaseQuery(params, ' ')
  query = appendAuthor(query, params)
  query = appendCountry(query, params)
  query = query + buildNotClause(params)

  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=200&filter=publication_year:${params.dateFrom.slice(0,4)}-${params.dateTo.slice(0,4)}&mailto=info@slapharma.com`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []).map((w: any): Paper => ({
    id: `openalex:${w.id}`,
    source: 'openalex',
    title: w.title ?? 'Unknown',
    authors: (w.authorships ?? []).map((a: any) => a.author?.display_name ?? ''),
    journal: w.primary_location?.source?.display_name,
    year: w.publication_year,
    doi: w.doi?.replace('https://doi.org/', ''),
    url: w.primary_location?.landing_page_url ?? w.id,
    abstract: w.abstract_inverted_index ? rebuildAbstract(w.abstract_inverted_index) : undefined,
  }))
}

function rebuildAbstract(inv: Record<string, number[]>): string {
  const words: string[] = []
  for (const [word, positions] of Object.entries(inv)) {
    for (const pos of positions) words[pos] = word
  }
  return words.filter((w): w is string => w !== undefined).join(' ')
}
