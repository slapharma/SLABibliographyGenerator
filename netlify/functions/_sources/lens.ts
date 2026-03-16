import type { SearchParams, Paper } from './types'

export async function searchLens(params: SearchParams): Promise<Paper[]> {
  const key = process.env.LENS_API_KEY
  if (!key) return []

  const query = [params.indication, params.keywords].filter(Boolean).join(' ')
  const body = {
    query: {
      bool: {
        must: [{ query_string: { query } }],
        filter: [
          { range: { year_published: { gte: parseInt(params.dateFrom.slice(0, 4)), lte: parseInt(params.dateTo.slice(0, 4)) } } }
        ],
      },
    },
    size: 50,
    sort: [{ year_published: 'desc' }],
    include: ['lens_id', 'title', 'authors', 'year_published', 'source', 'doi', 'abstract', 'publication_type'],
  }
  const res = await fetch('https://api.lens.org/scholarly/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data ?? []).map((d: any): Paper => ({
    id: `lens:${d.lens_id}`,
    source: 'lens',
    title: d.title ?? 'Unknown',
    authors: (d.authors ?? []).map((a: any) => a.display_name ?? [a.last_name, a.first_name].filter(Boolean).join(' ')),
    journal: d.source?.title,
    year: d.year_published,
    doi: d.doi,
    url: `https://www.lens.org/lens/scholar/article/${d.lens_id}`,
    abstract: d.abstract,
    type: d.publication_type,
  }))
}
