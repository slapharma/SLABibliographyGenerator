import type { SearchParams, Paper } from './types'
import { buildBaseQuery, appendAuthor, appendCountry, buildGenericTitleTerms, buildNotClause } from './queryBuilder'

export async function searchSemanticScholar(params: SearchParams): Promise<Paper[]> {
  let query = buildBaseQuery(params)
  query = appendAuthor(query, params)
  query = appendCountry(query, params)
  query = query + buildGenericTitleTerms(params) + buildNotClause(params)

  const limit = process.env.SEMANTIC_SCHOLAR_KEY ? 500 : 100
  const yearFrom = params.dateFrom.slice(0, 4)
  const yearTo = params.dateTo.slice(0, 4)

  // S2 paper/search only supports sort=relevance — citationCount sort is not available on this endpoint
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&year=${yearFrom}-${yearTo}&fields=title,authors,year,journal,externalIds,abstract,citationCount,publicationTypes`
  const headers: Record<string, string> = {}
  if (process.env.SEMANTIC_SCHOLAR_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_KEY
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 429) {
      // Rate limited — requires API key for reliable access
      throw new Error('Semantic Scholar rate limit exceeded (429). Add SEMANTIC_SCHOLAR_KEY env var for higher limits.')
    }
    console.error(`SemanticScholar error ${res.status}:`, body)
    return []
  }
  const data = await res.json()
  if (data.error || data.message) {
    console.error('SemanticScholar API error:', JSON.stringify(data).slice(0, 300))
    return []
  }
  return (data.data ?? []).map((p: any): Paper => ({
    id: `semanticscholar:${p.paperId}`,
    source: 'semanticscholar',
    title: p.title ?? 'Unknown',
    authors: (p.authors ?? []).map((a: any) => a.name),
    journal: p.journal?.name,
    year: p.year,
    doi: p.externalIds?.DOI,
    url: `https://www.semanticscholar.org/paper/${p.paperId}`,
    abstract: p.abstract,
    citationCount: p.citationCount,
    type: p.publicationTypes?.[0],
  }))
}
