import type { SearchParams, Paper } from './types'
import { buildBaseQuery, appendAuthor, appendCountry, buildGenericTitleTerms, buildNotClause } from './queryBuilder'

export async function searchScholar(params: SearchParams): Promise<Paper[]> {
  const key = process.env.SERPAPI_KEY
  if (!key) return []

  let query = buildBaseQuery(params, ' ')
  query = appendAuthor(query, params)
  query = appendCountry(query, params)
  query = query + buildGenericTitleTerms(params) + buildNotClause(params)

  const url = `https://serpapi.com/search?engine=google_scholar&q=${encodeURIComponent(query)}&as_ylo=${params.dateFrom.slice(0,4)}&as_yhi=${params.dateTo.slice(0,4)}&api_key=${key}&num=100`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.organic_results ?? []).map((r: any): Paper => ({
    id: `scholar:${r.result_id ?? encodeURIComponent(r.title)}`,
    source: 'scholar',
    title: r.title ?? 'Unknown',
    authors: r.publication_info?.authors?.map((a: any) => a.name) ?? [],
    journal: r.publication_info?.summary?.split(' - ')[1],
    year: r.publication_info?.summary ? parseInt(r.publication_info.summary.match(/\d{4}/)?.[0] ?? '0') : undefined,
    url: r.link ?? '',
    abstract: r.snippet,
  }))
}
