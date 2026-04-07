// api/extract.ts — Vercel Node runtime (pdf-parse is Node-only)
export const config = { runtime: 'nodejs' }

import { eq } from 'drizzle-orm'
import {
  migrate,
  getDb,
  protocols,
  pipelineExecutions,
  extractionResults,
  auditLog,
} from '../netlify/functions/_db'
import {
  createExtractionBatches,
  extractFromPapers,
  type ExtractionField,
  type ExtractionPaper,
} from '../netlify/functions/_sources/extractionEngine'
import { retrievePapersText } from '../netlify/functions/_sources/pdfRetrieval'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

interface ExtractRequest {
  protocolId: number
  executionId?: number
  papers: Array<{ id: string; title: string; doi?: string }>
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    await migrate()
    const db = getDb()

    const body = (await req.json()) as ExtractRequest
    const { protocolId, papers } = body
    if (!protocolId || !papers || papers.length === 0) {
      return json({ error: 'protocolId and papers array required' }, 400)
    }

    const protocolRows = await db.select().from(protocols).where(eq(protocols.id, protocolId))
    const protocol = protocolRows[0]
    if (!protocol) return json({ error: 'Protocol not found' }, 404)
    const template = protocol.extractionTemplate as ExtractionField[]
    if (!Array.isArray(template) || template.length === 0) {
      return json({ error: 'Protocol has no extraction template defined' }, 400)
    }

    let executionId = body.executionId
    if (!executionId) {
      const inserted = await db
        .insert(pipelineExecutions)
        .values({ protocolId, status: 'extracting', totalPapers: papers.length })
        .returning({ id: pipelineExecutions.id })
      executionId = inserted[0]?.id
    } else {
      await db
        .update(pipelineExecutions)
        .set({ status: 'extracting' })
        .where(eq(pipelineExecutions.id, executionId))
    }
    if (!executionId) return json({ error: 'Failed to create execution' }, 500)

    const retrievals = await retrievePapersText(papers)
    const retrievalById = new Map(retrievals.map((r) => [r.paperId, r]))

    let skippedCount = 0
    for (const r of retrievals) {
      if (!r.text) {
        skippedCount++
        await db.insert(auditLog).values({
          executionId,
          paperId: r.paperId,
          stage: 'extraction',
          decision: { stage: 'pdf_retrieval', error: r.error ?? 'unknown', source: r.source },
        })
      }
    }

    const extractable: ExtractionPaper[] = papers
      .map((p) => {
        const r = retrievalById.get(p.id)
        return r?.text ? { id: p.id, title: p.title, fullText: r.text } : null
      })
      .filter((p): p is ExtractionPaper => p !== null)

    const batches = createExtractionBatches(template, extractable, 10)
    let processedCount = 0
    let failedCount = 0
    const allResults: Array<{ paperId: string; fields: Array<Record<string, unknown>> }> = []

    for (const batch of batches) {
      try {
        const batchResults = await extractFromPapers(batch)
        for (const result of batchResults) {
          processedCount++
          allResults.push(result)
          for (const field of result.fields) {
            await db.insert(extractionResults).values({
              executionId,
              paperId: result.paperId,
              fieldName: field.fieldName,
              extractedValue: field.value as any,
              rawText: field.rawText ?? null,
              confidence: field.confidence != null ? String(field.confidence) : null,
              errorMessage: field.error ?? null,
            })
          }
          await db.insert(auditLog).values({
            executionId,
            paperId: result.paperId,
            stage: 'extraction',
            decision: {
              stage: 'extraction',
              fieldCount: result.fields.length,
              source: retrievalById.get(result.paperId)?.source,
              fields: result.fields,
            },
          })
        }
      } catch (batchError) {
        console.error(`Error extracting batch for protocol ${protocolId}:`, batchError)
        failedCount += batch.papers.length
      }
    }

    await db
      .update(pipelineExecutions)
      .set({ status: 'extracted' })
      .where(eq(pipelineExecutions.id, executionId))

    return json({
      success: true,
      executionId,
      processedCount,
      skippedCount,
      failedCount,
      results: allResults,
    })
  } catch (err) {
    console.error('Extraction error:', err)
    return json(
      { error: 'Extraction failed', details: err instanceof Error ? err.message : String(err) },
      500
    )
  }
}
