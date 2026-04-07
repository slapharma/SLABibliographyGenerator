// netlify/functions/extract.ts
//
// Phase 2 orchestrator: drives the extraction stage of the protocol pipeline.
//
//   POST /extract
//   body: { protocolId, executionId?, papers: [{id, title, doi}] }
//
// Flow:
//   1. Load protocol (for the extraction template).
//   2. Reuse-or-create a pipeline_executions row in 'extracting' state.
//   3. Retrieve full text for each paper (PMC → CrossRef fallback).
//   4. Batch the papers that have text and call the extraction engine.
//   5. Persist every field result to extraction_results.
//   6. Append per-paper summary rows to audit_log (stage='extraction').
//   7. Return aggregated counts + the extracted rows.
//
// Mirrors the screen.ts orchestration pattern. Designed to be additive —
// nothing in the existing screening flow is touched.

import { Handler } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import {
  migrate,
  getDb,
  protocols,
  pipelineExecutions,
  extractionResults,
  auditLog,
} from './_db'
import {
  createExtractionBatches,
  extractFromPapers,
  type ExtractionField,
  type ExtractionPaper,
} from './_sources/extractionEngine'
import { retrievePapersText } from './_sources/pdfRetrieval'

interface ExtractRequest {
  protocolId: number
  executionId?: number
  papers: Array<{ id: string; title: string; doi?: string }>
}

const handler: Handler = async (event) => {
  try {
    await migrate()
    const db = getDb()

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request body required' }) }
    }
    const req: ExtractRequest = JSON.parse(event.body)
    const { protocolId, papers } = req

    if (!protocolId || !papers || papers.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'protocolId and papers array required' }),
      }
    }

    // 1. Load the protocol (we need its extractionTemplate)
    const protocolRows = await db.select().from(protocols).where(eq(protocols.id, protocolId))
    const protocol = protocolRows[0]
    if (!protocol) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Protocol not found' }) }
    }
    const template = protocol.extractionTemplate as ExtractionField[]
    if (!Array.isArray(template) || template.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Protocol has no extraction template defined' }),
      }
    }

    // 2. Reuse or create a pipeline_executions row
    let executionId = req.executionId
    if (!executionId) {
      const inserted = await db
        .insert(pipelineExecutions)
        .values({
          protocolId,
          status: 'extracting',
          totalPapers: papers.length,
        })
        .returning({ id: pipelineExecutions.id })
      executionId = inserted[0]?.id
    } else {
      await db
        .update(pipelineExecutions)
        .set({ status: 'extracting' })
        .where(eq(pipelineExecutions.id, executionId))
    }
    if (!executionId) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create execution' }) }
    }

    // 3. Retrieve full text for each paper
    const retrievals = await retrievePapersText(papers)
    const retrievalById = new Map(retrievals.map((r) => [r.paperId, r]))

    // Log retrieval failures so the user can decide whether to upload PDFs
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

    // 4. Build extraction batches from papers that have text
    const extractable: ExtractionPaper[] = papers
      .map((p) => {
        const r = retrievalById.get(p.id)
        return r?.text ? { id: p.id, title: p.title, fullText: r.text } : null
      })
      .filter((p): p is ExtractionPaper => p !== null)

    const batches = createExtractionBatches(template, extractable, 10)

    // 5. Run each batch and persist results
    let processedCount = 0
    let failedCount = 0
    const allResults: Array<{ paperId: string; fields: Array<Record<string, unknown>> }> = []

    for (const batch of batches) {
      try {
        const batchResults = await extractFromPapers(batch)

        for (const result of batchResults) {
          processedCount++
          allResults.push(result)

          // One row per (paper, field) for fine-grained audit
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

          // Per-paper roll-up to audit_log
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

    // 6. Mark execution as having completed the extraction stage
    await db
      .update(pipelineExecutions)
      .set({ status: 'extracted' })
      .where(eq(pipelineExecutions.id, executionId))

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        executionId,
        processedCount,
        skippedCount,
        failedCount,
        results: allResults,
      }),
    }
  } catch (err) {
    console.error('Extraction error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Extraction failed',
        details: err instanceof Error ? err.message : String(err),
      }),
    }
  }
}

export { handler }
