// netlify/functions/_sources/pubmed.ts
import type { SearchParams, Paper } from './types'

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const KEY = process.env.PUBMED_API_KEY ? `&api_key=${process.env.PUBMED_API_KEY}` : ''

export async function searchPubMed(params: SearchParams): Promise<Paper[]> {
  const query = buildQuery(params)
  const minDate = params.dateFrom.replace(/-/g, '/')
  const maxDate = params.dateTo.replace(/-/g, '/')

  const searchUrl = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=200&datetype=pdat&mindate=${minDate}&maxdate=${maxDate}&retmode=json${KEY}`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) return []
  const searchData = await searchRes.json()
  const ids: string[] = searchData.esearchresult?.idlist ?? []
  if (ids.length === 0) return []

  const fetchRes = await fetch(`${BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${KEY}`)
  if (!fetchRes.ok) return []
  const fetchData = await fetchRes.json()

  return ids.map((id): Paper => {
    const rec = fetchData.result?.[id] ?? {}
    const doi = rec.articleids?.find((a: any) => a.idtype === 'doi')?.value
    return {
      id: `pubmed:${id}`,
      source: 'pubmed',
      title: rec.title ?? 'Unknown Title',
      authors: (rec.authors ?? []).map((a: any) => a.name),
      journal: rec.fulljournalname ?? rec.source,
      year: rec.pubdate ? parseInt(rec.pubdate.slice(0, 4)) : undefined,
      doi,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      abstract: rec.abstract,
      type: params.paperType || undefined,
    }
  }).filter(p => p.title !== 'Unknown Title')
}

function buildQuery(params: SearchParams): string {
  const parts: string[] = []
  if (params.indication) parts.push(params.indication)
  if (params.keywords) parts.push(params.keywords)
  if (params.paperType) {
    const typeMap: Record<string, string> = {
      'RCT': 'randomized controlled trial[pt]',
      'Systematic Review': 'systematic review[pt]',
      'Meta-Analysis': 'meta-analysis[pt]',
      'Observational': 'observational study[pt]',
    }
    const mapped = typeMap[params.paperType]
    if (mapped) parts.push(mapped)
  }
  return parts.join(' AND ')
}
