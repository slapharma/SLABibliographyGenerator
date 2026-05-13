import type { SearchParams, Paper } from './types'
import { buildBaseQuery, appendCountry, buildGenericTitleTerms, buildNotClause } from './queryBuilder'

export async function searchCrossRef(params: SearchParams): Promise<Paper[]> {
  // Build the main bibliographic query: indication + title terms + country + not-clause
  // query.title with boolean OR syntax is not supported by CrossRef — all terms go in query.bibliographic
  let bibQuery = buildBaseQuery(params, ' ')
  bibQuery = bibQuery + buildGenericTitleTerms(params)
  bibQuery = appendCountry(bibQuery, params)
  bibQuery = bibQuery + buildNotClause(params)

  const authorParam = params.author?.trim()
    ? `&query.author=${encodeURIComponent(params.author.trim())}`
    : ''

  const url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(bibQuery)}${authorParam}&rows=1000&sort=score&filter=from-pub-date:${params.dateFrom},until-pub-date:${params.dateTo}&mailto=info@slapharma.com`
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
