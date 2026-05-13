export const config = { runtime: 'edge' }

interface VerifyRequest {
  key: string
  title: string
  authors?: string[]
  year?: number
  doi?: string
}

type Status = 'verified' | 'mismatch' | 'not_found' | 'manual_review' | 'error'

interface VerifyResult {
  key: string
  status: Status
  score: number
  pubmedId?: string
  doi?: string
  foundTitle?: string
  foundUrl?: string
  note?: string
}

const PUBMED = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const KEY = process.env.PUBMED_API_KEY ? `&api_key=${process.env.PUBMED_API_KEY}` : ''

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
const STOP = new Set(['the','a','an','of','in','for','to','and','or','with','on','by','from','at','as','is'])
const tokens = (s: string) => norm(s).split(' ').filter(t => t.length > 2 && !STOP.has(t))

function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

async function verifyDoi(doi: string, title: string): Promise<Partial<VerifyResult>> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}?mailto=info@slapharma.com`)
    if (!res.ok) return { status: 'not_found', score: 0, note: `Crossref ${res.status}` }
    const data = await res.json()
    const item = data.message
    const foundTitle = Array.isArray(item?.title) ? item.title[0] : item?.title ?? ''
    const score = title ? similarity(title, foundTitle) : 1
    return {
      status: score >= 0.5 || !title ? 'verified' : 'mismatch',
      score,
      doi,
      foundTitle,
      foundUrl: `https://doi.org/${doi}`,
    }
  } catch (e: any) {
    return { status: 'error', score: 0, note: e?.message ?? 'fetch failed' }
  }
}

async function verifyByTitle(title: string, authors: string[] = [], year?: number): Promise<Partial<VerifyResult>> {
  try {
    const lastName = authors[0]?.split(/\s+/).filter(Boolean).slice(-1)[0] ?? ''
    const term = `"${title.replace(/"/g, '').slice(0, 200)}"` + (lastName ? ` AND ${lastName}[au]` : '')
    const searchUrl = `${PUBMED}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=3&retmode=json${KEY}`
    const searchRes = await fetch(searchUrl)
    if (!searchRes.ok) return { status: 'error', score: 0, note: `PubMed ${searchRes.status}` }
    const searchData = await searchRes.json()
    let ids: string[] = searchData.esearchresult?.idlist ?? []

    if (ids.length === 0) {
      // Fallback: title-only, looser
      const loose = await fetch(`${PUBMED}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title.slice(0, 200))}&retmax=3&retmode=json${KEY}`)
      if (loose.ok) ids = (await loose.json()).esearchresult?.idlist ?? []
    }
    if (ids.length === 0) {
      // Final fallback: Crossref title search
      const cr = await fetch(`https://api.crossref.org/works?query.title=${encodeURIComponent(title.slice(0, 200))}&rows=3&mailto=info@slapharma.com`)
      if (cr.ok) {
        const data = await cr.json()
        const items = data.message?.items ?? []
        let best = { score: 0, item: null as any }
        for (const it of items) {
          const ft = Array.isArray(it.title) ? it.title[0] : it.title ?? ''
          const s = similarity(title, ft)
          if (s > best.score) best = { score: s, item: it }
        }
        if (best.item) {
          return {
            status: best.score >= 0.5 ? 'verified' : 'mismatch',
            score: best.score,
            doi: best.item.DOI,
            foundTitle: Array.isArray(best.item.title) ? best.item.title[0] : best.item.title,
            foundUrl: best.item.DOI ? `https://doi.org/${best.item.DOI}` : undefined,
            note: 'matched via Crossref',
          }
        }
      }
      return { status: 'not_found', score: 0, note: 'no PubMed or Crossref hit' }
    }

    const sumRes = await fetch(`${PUBMED}/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json${KEY}`)
    if (!sumRes.ok) return { status: 'error', score: 0, note: `esummary ${sumRes.status}` }
    const sumData = await sumRes.json()
    let best = { score: 0, id: '', rec: null as any }
    for (const id of ids) {
      const rec = sumData.result?.[id]
      if (!rec) continue
      const s = similarity(title, rec.title ?? '')
      if (s > best.score) best = { score: s, id, rec }
    }
    if (!best.rec) return { status: 'not_found', score: 0 }

    const pubYear = best.rec.pubdate ? parseInt(String(best.rec.pubdate).slice(0, 4)) : undefined
    const yearMismatch = year && pubYear && Math.abs(year - pubYear) > 1
    const status: Status = best.score >= 0.6 && !yearMismatch ? 'verified' : best.score >= 0.4 ? 'mismatch' : 'not_found'

    const doi = best.rec.articleids?.find((a: any) => a.idtype === 'doi')?.value
    return {
      status,
      score: best.score,
      pubmedId: best.id,
      doi,
      foundTitle: best.rec.title,
      foundUrl: `https://pubmed.ncbi.nlm.nih.gov/${best.id}/`,
      note: yearMismatch ? `year mismatch: claimed ${year}, found ${pubYear}` : undefined,
    }
  } catch (e: any) {
    return { status: 'error', score: 0, note: e?.message ?? 'fetch failed' }
  }
}

async function verifyOne(req: VerifyRequest): Promise<VerifyResult> {
  if (!req.title || req.title.length < 5) {
    return { key: req.key, status: 'manual_review', score: 0, note: 'title too short' }
  }
  const partial = req.doi
    ? await verifyDoi(req.doi, req.title)
    : await verifyByTitle(req.title, req.authors, req.year)
  return { key: req.key, status: partial.status ?? 'error', score: partial.score ?? 0, ...partial }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const body = await req.json().catch(() => null) as { items?: VerifyRequest[] } | null
  const items = body?.items ?? []
  if (!Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ results: [] }), { headers: { 'Content-Type': 'application/json' } })
  }
  // Concurrency cap to avoid PubMed rate limits (3/sec without key, 10/sec with)
  const concurrency = process.env.PUBMED_API_KEY ? 6 : 3
  const results: VerifyResult[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const idx = cursor++
      if (idx >= items.length) return
      results[idx] = await verifyOne(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } })
}
