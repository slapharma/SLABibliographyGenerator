// netlify/functions/assessQuality.ts
//
// Phase 2 orchestrator: Cochrane RoB 2 quality assessment.
//
//   POST /assessQuality
//   body: { executionId }
//
// Reads the rows previously written to extraction_results by extract.ts,
// reshapes them into per-paper field maps, runs them through the quality
// engine in batches of 30, and writes one row per paper to quality_assessments
// plus a roll-up to audit_log.

import { Handler } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import {
  migrate,
  getDb,
  pipelineExecutions,
  extractionResults,
  qualityAssessments,
  auditLog,
} from './_db'
import {
  assessQualityBatch,
  createQualityBatches,
  QUALITY_MODEL,
  type QualityPaperInput,
} from './_sources/qualityAssessmentEngine'

interface AssessQualityRequest {
  executionId: number
  /** Optional: caller can supply paper titles since extraction_results doesn't store them */
  paperTitles?: Record<string, string>
}

const handler: Handler = async (event) => {
  try {
    await migrate()
    const db = getDb()

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request body required' }) }
    }
    const req: AssessQualityRequest = JSON.parse(event.body)
    const { executionId, paperTitles = {} } = req

    if (!executionId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'executionId required' }) }
    }

    // 1. Pull every extracted-field row for this execution and group by paper
    const rows = await db
      .select()
      .from(extractionResults)
      .where(eq(extractionResults.executionId, executionId))

    if (rows.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No extraction results found for this execution' }),
      }
    }

    const byPaper = new Map<string, Record<string, unknown>>()
    for (const row of rows) {
      const map = byPaper.get(row.paperId) ?? {}
      map[row.fieldName] = row.extractedValue
      byPaper.set(row.paperId, map)
    }

    const papers: QualityPaperInput[] = Array.from(byPaper.entries()).map(([id, fields]) => ({
      id,
      title: paperTitles[id] ?? id,
      extractedFields: fields,
    }))

    // 2. Mark execution as 'assessing'
    await db
      .update(pipelineExecutions)
      .set({ status: 'assessing' })
      .where(eq(pipelineExecutions.id, executionId))

    // 3. Run batches
    const batches = createQualityBatches(papers, 30)
    let assessedCount = 0
    const allResults: Array<Record<string, unknown>> = []

    for (const batch of batches) {
      try {
        const batchResults = await assessQualityBatch(batch)

        for (const r of batchResults) {
          assessedCount++
          allResults.push(r as unknown as Record<string, unknown>)

          await db.insert(qualityAssessments).values({
            executionId,
            paperId: r.paperId,
            biasDomainSelection: r.biasDomains?.selection ?? null,
            biasDomainPerformance: r.biasDomains?.performance ?? null,
            biasDomainDetection: r.biasDomains?.detection ?? null,
            biasDomainAttrition: r.biasDomains?.attrition ?? null,
            biasDomainReporting: r.biasDomains?.reporting ?? null,
            biasReasoning: r.biasReasoning as any,
            overallQuality: r.overallQuality ?? null,
            assessmentReasoning: r.assessmentReasoning ?? null,
            claudeModel: QUALITY_MODEL,
          })

          await db.insert(auditLog).values({
            executionId,
            paperId: r.paperId,
            stage: 'quality_assessment',
            decision: r as any,
          })
        }
      } catch (err) {
        console.error(`Quality assessment batch failed for execution ${executionId}:`, err)
      }
    }

    // 4. Mark stage complete
    await db
      .update(pipelineExecutions)
      .set({ status: 'assessed' })
      .where(eq(pipelineExecutions.id, executionId))

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        executionId,
        assessedCount,
        results: allResults,
      }),
    }
  } catch (err) {
    console.error('Quality assessment error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Quality assessment failed',
        details: err instanceof Error ? err.message : String(err),
      }),
    }
  }
}

export { handler }
