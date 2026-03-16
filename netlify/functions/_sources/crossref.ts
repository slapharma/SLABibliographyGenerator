import type { SearchParams, Paper } from './types'
export async function searchCrossRef(params: SearchParams): Promise<Paper[]> {
  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=1000&filter=from-pub-date:${params.dateFrom},until-pub-date:${params.dateTo}&mailto=info@slapharma.com`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.message?.items ?? [])
    .map((item: any): Paper | null => {
      const doi = item.DOI
      if (!doi) return null  // Skip items without a DOI
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
