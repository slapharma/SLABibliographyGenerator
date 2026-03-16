import type { SearchParams, Paper } from './types'
export async function searchSemanticScholar(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=100&fields=title,authors,year,journal,externalIds,abstract,citationCount,publicationTypes`
  const headers: Record<string, string> = {}
  if (process.env.SEMANTIC_SCHOLAR_KEY) headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_KEY
  const res = await fetch(url, { headers })
  if (!res.ok) return []
  const data = await res.json()
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
