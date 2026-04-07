// api/assessQuality.ts — Vercel Edge runtime
export const config = { runtime: 'edge' }

import { eq } from 'drizzle-orm'
import {
  migrate,
  getDb,
  pipelineExecutions,
  extractionResults,
  qualityAssessments,
  auditLog,
} from '../netlify/functions/_db'
import {
  assessQualityBatch,
  createQualityBatches,
  QUALITY_MODEL,
  type QualityPaperInput,
} from '../netlify/functions/_sources/qualityAssessmentEngine'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    await migrate()
    const db = getDb()

    const { executionId, paperTitles = {} } = (await req.json()) as {
      executionId: number
      paperTitles?: Record<string, string>
    }
    if (!executionId) return json({ error: 'executionId required' }, 400)

    const rows = await db
      .select()
      .from(extractionResults)
      .where(eq(extractionResults.executionId, executionId))
    if (rows.length === 0) {
      return json({ error: 'No extraction results found for this execution' }, 400)
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

    await db
      .update(pipelineExecutions)
      .set({ status: 'assessing' })
      .where(eq(pipelineExecutions.id, executionId))

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

    await db
      .update(pipelineExecutions)
      .set({ status: 'assessed' })
      .where(eq(pipelineExecutions.id, executionId))

    return json({ success: true, executionId, assessedCount, results: allResults })
  } catch (err) {
    console.error('Quality assessment error:', err)
    return json(
      {
        error: 'Quality assessment failed',
        details: err instanceof Error ? err.message : String(err),
      },
      500
    )
  }
}
