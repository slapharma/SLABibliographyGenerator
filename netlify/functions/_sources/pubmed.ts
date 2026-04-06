import type { SearchParams, Paper } from './types'
import { buildBaseQuery, buildPubMedPaperTypeClause, buildPubMedAuthorClause, buildPubMedCountryClause, buildPubMedTitleTerms, buildNotClause } from './queryBuilder'

const BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const KEY = process.env.PUBMED_API_KEY ? `&api_key=${process.env.PUBMED_API_KEY}` : ''

export async function searchPubMed(params: SearchParams): Promise<Paper[]> {
  const query = buildBaseQuery(params)
    + buildPubMedTitleTerms(params)
    + buildPubMedPaperTypeClause(params)
    + buildPubMedAuthorClause(params)
    + buildPubMedCountryClause(params)
    + buildNotClause(params)

  const minDate = params.dateFrom.replace(/-/g, '/')
  const maxDate = params.dateTo.replace(/-/g, '/')
  const searchUrl = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=200&datetype=pdat&mindate=${minDate}&maxdate=${maxDate}&retmode=json${KEY}`
  const searchRes = await fetch(searchUrl)
  if (!searchRes.ok) return []
  const searchData = await searchRes.json()
  const ids: string[] = searchData.esearchresult?.idlist ?? []
  if (ids.length === 0) return []

  // Fetch metadata and abstracts in parallel
  const [fetchRes, efetchRes] = await Promise.all([
    fetch(`${BASE}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${KEY}`),
    fetch(`${BASE}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=abstract&retmode=xml${KEY}`),
  ])

  if (!fetchRes.ok) return []
  const fetchData = await fetchRes.json()

  // Parse abstracts from efetch XML — structured abstracts have multiple <AbstractText> with Label attributes
  const abstractMap: Record<string, string> = {}
  if (efetchRes.ok) {
    const xml = await efetchRes.text()
    const articleRegex = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g
    for (const match of xml.matchAll(articleRegex)) {
      const article = match[1]
      const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)
      if (!pmidMatch) continue
      const pmid = pmidMatch[1]
      const texts: string[] = []
      const abRegex = /<AbstractText(?:[^>]*Label="([^"]*)")?[^>]*>([\s\S]*?)<\/AbstractText>/g
      for (const ab of article.matchAll(abRegex)) {
        const label = ab[1] ? `${ab[1]}: ` : ''
        const text = ab[2].replace(/<[^>]+>/g, '').trim()
        if (text) texts.push(label + text)
      }
      if (texts.length > 0) abstractMap[pmid] = texts.join(' ')
    }
  }

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
      abstract: abstractMap[id],
      type: params.paperType || undefined,
    }
  }).filter(p => p.title !== 'Unknown Title')
}
