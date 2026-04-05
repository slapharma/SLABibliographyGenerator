import type { SearchParams, Paper } from './types'
import { buildBaseQuery, appendAuthor, appendCountry, buildGenericTitleTerms, buildNotClause } from './queryBuilder'

export async function searchCrossRef(params: SearchParams): Promise<Paper[]> {
  let query = buildBaseQuery(params, ' ')
  query = appendAuthor(query, params)
  query = appendCountry(query, params)
  query = query + buildGenericTitleTerms(params) + buildNotClause(params)

  const authorParam = params.author?.trim()
    ? `&query.author=${encodeURIComponent(params.author.trim())}`
    : ''
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}${authorParam}&rows=1000&filter=from-pub-date:${params.dateFrom},until-pub-date:${params.dateTo}&mailto=info@slapharma.com`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.message?.items ?? [])
    .map((item: any): Paper | null => {
      const doi = item.DOI
      if (!doi) return null
      const year = item.published?.['date-parts']?.[0]?.[0]
      return {
        id: `crossref:${doi}`,
        source: 'crossref',
        title: Array.isArray(item.title) ? item.title[0] : item.title ?? 'Unknown',
        authors: (item.author ?? []).map((a: any) => `${a.family ?? ''} ${a.given?.[0] ?? ''}`.trim()),
        journal: item['container-title']?.[0],
        year,
        doi,
        url: `https://doi.org/${doi}`,
        type: item.type,
      }
    })
    .filter((p): p is Paper => p !== null)
}
