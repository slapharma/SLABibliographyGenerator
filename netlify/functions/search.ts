import type { Config } from '@netlify/functions'
import { getDb, searchHistory, migrate } from './_db'
import { searchPubMed } from './_sources/pubmed'
import { searchEuropePMC } from './_sources/europepmc'
import { searchClinicalTrials } from './_sources/clinicaltrials'
import { searchSemanticScholar } from './_sources/semanticscholar'
import { searchCrossRef } from './_sources/crossref'
import { searchScholar } from './_sources/scholar'
import type { SearchParams, Source, SourceResult, Paper } from '../../src/types/index'

function deduplicateResults(results: SourceResult[]): SourceResult[] {
  // Build a flat list with source tracking, keyed by normalised DOI or title
  const seen = new Map<string, Paper>()

  for (const sourceResult of results) {
    for (const paper of sourceResult.papers) {
      const key = paper.doi
        ? `doi:${paper.doi.toLowerCase().trim()}`
        : `title:${paper.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)}`

      if (seen.has(key)) {
        // Merge: add this source to the existing paper's sources array
        const existing = seen.get(key)!
        if (!existing.sources) existing.sources = [existing.source]
        if (!existing.sources.includes(paper.source)) {
          existing.sources.push(paper.source)
        }
        // Prefer the version with an abstract if current one lacks it
        if (!existing.abstract && paper.abstract) {
          existing.abstract = paper.abstract
        }
        // Prefer higher citation count
        if (paper.citationCount && (!existing.citationCount || paper.citationCount > existing.citationCount)) {
          existing.citationCount = paper.citationCount
        }
      } else {
        const paperWithSources = { ...paper, sources: [paper.source] }
        seen.set(key, paperWithSources)
      }
    }
  }

  // Rebuild per-source results with dedup applied (for tally display)
  return results.map(sr => ({
    ...sr,
    papers: sr.papers
      .map(p => {
        const key = p.doi
          ? `doi:${p.doi.toLowerCase().trim()}`
          : `title:${p.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80)}`
        return seen.get(key)!
      })
      // Remove papers where this source is not the "owner" (i.e. it was merged into another source's entry)
      .filter(p => p.source === p.sources?.[0] || !p.sources),
  }))
}

const HANDLERS: Record<Source, (p: SearchParams) => Promise<any[]>> = {
  pubmed: searchPubMed,
  europepmc: searchEuropePMC,
  clinicaltrials: searchClinicalTrials,
  semanticscholar: searchSemanticScholar,
  crossref: searchCrossRef,
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

  const deduped = deduplicateResults(results)
  const totalCount = deduped.reduce((n, r) => n + r.papers.length, 0)

  // Fire-and-forget history logging
  getDb().insert(searchHistory).values({
    params: params as any,
    resultCount: totalCount,
  }).catch(console.error)

  return new Response(JSON.stringify({ results: deduped, totalCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const config: Config = { path: '/api/search' }
