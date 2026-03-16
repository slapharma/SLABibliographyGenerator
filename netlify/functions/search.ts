import type { Config } from '@netlify/functions'
import { getDb, searchHistory, migrate } from './_db'
import { searchPubMed } from './_sources/pubmed'
import { searchEuropePMC } from './_sources/europepmc'
import { searchClinicalTrials } from './_sources/clinicaltrials'
import { searchSemanticScholar } from './_sources/semanticscholar'
import { searchCrossRef } from './_sources/crossref'
import { searchOpenAlex } from './_sources/openalex'
import { searchLens } from './_sources/lens'
import { searchScholar } from './_sources/scholar'
import type { SearchParams, Source, SourceResult } from '../../src/types/index'

const HANDLERS: Record<Source, (p: SearchParams) => Promise<any[]>> = {
  pubmed: searchPubMed,
  europepmc: searchEuropePMC,
  clinicaltrials: searchClinicalTrials,
  semanticscholar: searchSemanticScholar,
  crossref: searchCrossRef,
  openalex: searchOpenAlex,
  lens: searchLens,
  scholar: searchScholar,
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  await migrate()

  let params: SearchParams
  try {
    params = await req.json()
  } catch {
    return new Response('Invalid JSON body', { status: 400 })
  }

  if (!Array.isArray(params?.sources) || params.sources.length === 0) {
    return new Response('sources must be a non-empty array', { status: 400 })
  }

  const sources = params.sources.filter(s => s in HANDLERS)

  const settled = await Promise.allSettled(
    sources.map(source => HANDLERS[source](params).then(papers => ({ source, papers, error: undefined })))
  )

  const results: SourceResult[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: sources[i], papers: [], error: (r.reason as Error).message }
  )

  const totalCount = results.reduce((n, r) => n + r.papers.length, 0)

  // Fire-and-forget history logging
  getDb().insert(searchHistory).values({
    params: params as any,
    resultCount: totalCount,
  }).catch(console.error)

  return new Response(JSON.stringify({ results, totalCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config: Config = { path: '/api/search' }
