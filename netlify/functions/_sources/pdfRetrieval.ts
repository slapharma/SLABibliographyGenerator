// netlify/functions/_sources/pdfRetrieval.ts
//
// Phase 2: Resolve a paper to plain-text full content for downstream
// extraction. Strategy (cheapest → most expensive):
//   1. PubMed Central via DOI → PMCID → JATS XML (free, no parsing)
//   2. CrossRef content negotiation → PDF bytes → pdf-parse (fallback)
//
// All failures are non-fatal: callers receive { text: null, error } and
// can decide whether to skip the paper or surface a manual-upload prompt.

export interface PdfRetrievalResult {
  paperId: string
  source: 'pmc' | 'crossref' | null
  text: string | null
  /** Number of characters in the extracted text (useful for token estimation) */
  length: number
  error?: string
}

const PMC_IDCONV = 'https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/'
const PMC_EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi'

/** Strip JATS / generic XML tags down to readable plain text. */
function stripXml(xml: string): string {
  return xml
    .replace(/<\?xml[^?]*\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\s+/g, ' ')
    .trim()
}

/** Resolve a DOI to a PMCID using NCBI's idconv service. */
async function doiToPmcId(doi: string): Promise<string | null> {
  try {
    const url = `${PMC_IDCONV}?ids=${encodeURIComponent(doi)}&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data: any = await res.json()
    const record = data?.records?.[0]
    return record?.pmcid ?? null
  } catch {
    return null
  }
}

/** Fetch JATS XML for a PMCID and return plain text. */
async function fetchPmcText(pmcid: string): Promise<string | null> {
  try {
    const stripped = pmcid.replace(/^PMC/i, '')
    const url = `${PMC_EFETCH}?db=pmc&id=${stripped}&rettype=xml`
    const res = await fetch(url)
    if (!res.ok) return null
    const xml = await res.text()
    if (!xml || xml.length < 200) return null
    const text = stripXml(xml)
    return text.length > 200 ? text : null
  } catch {
    return null
  }
}

/** Fallback: ask CrossRef for the publisher PDF, then pdf-parse it. */
async function fetchCrossrefPdf(doi: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`)
    if (!res.ok) return null
    const data: any = await res.json()
    const links: Array<{ URL: string; 'content-type'?: string }> = data?.message?.link ?? []
    const pdfLink = links.find(
      (l) => l['content-type']?.includes('pdf') || l.URL?.toLowerCase().endsWith('.pdf')
    )
    if (!pdfLink) return null

    const pdfRes = await fetch(pdfLink.URL)
    if (!pdfRes.ok) return null
    const buffer = Buffer.from(await pdfRes.arrayBuffer())

    // Lazy-load pdf-parse so cold starts don't pay for it when PMC succeeds.
    const { default: pdfParse } = await import('pdf-parse')
    const parsed = await pdfParse(buffer)
    return parsed.text?.trim() || null
  } catch {
    return null
  }
}

/**
 * Retrieve full text for a single paper. Tries PMC first, then CrossRef.
 * Returns a structured result; never throws.
 */
export async function retrievePaperText(paper: {
  id: string
  doi?: string
}): Promise<PdfRetrievalResult> {
  const base: PdfRetrievalResult = { paperId: paper.id, source: null, text: null, length: 0 }

  if (!paper.doi) {
    return { ...base, error: 'no_doi' }
  }

  // 1. PubMed Central
  const pmcId = await doiToPmcId(paper.doi)
  if (pmcId) {
    const text = await fetchPmcText(pmcId)
    if (text) return { paperId: paper.id, source: 'pmc', text, length: text.length }
  }

  // 2. CrossRef → PDF
  const pdfText = await fetchCrossrefPdf(paper.doi)
  if (pdfText) return { paperId: paper.id, source: 'crossref', text: pdfText, length: pdfText.length }

  return { ...base, error: 'no_full_text_available' }
}

/**
 * Retrieve full text for many papers sequentially. Sequential rather than
 * parallel because PMC rate-limits aggressively and we'd rather take an
 * extra few seconds than get 429'd halfway through a run.
 */
export async function retrievePapersText(
  papers: Array<{ id: string; doi?: string }>
): Promise<PdfRetrievalResult[]> {
  const out: PdfRetrievalResult[] = []
  for (const p of papers) {
    out.push(await retrievePaperText(p))
  }
  return out
}
