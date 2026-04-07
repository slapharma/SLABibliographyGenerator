// api/screen.ts — Vercel Edge runtime
//
// Phase 1 screening, ported from netlify/functions/screen.ts and fixed to use
// drizzle-orm's select/update/eq API (the neon-http driver doesn't expose the
// `db.query.*` proxy the old handler assumed).

export const config = { runtime: 'edge' }

import { eq } from 'drizzle-orm'
import {
  migrate,
  getDb,
  protocols,
  pipelineExecutions,
  auditLog,
} from '../netlify/functions/_db'
import {
  screenPapers,
  createScreeningBatches,
  type Paper,
} from '../netlify/functions/_sources/screeningEngine'

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

interface ScreeningRequest {
  protocolId: number
  papers: Paper[]
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    await migrate()
    const db = getDb()

    const { protocolId, papers } = (await req.json()) as ScreeningRequest
    if (!protocolId || !papers || papers.length === 0) {
      return json({ error: 'protocolId and papers array required' }, 400)
    }

    const protocolRows = await db.select().from(protocols).where(eq(protocols.id, protocolId))
    const protocol = protocolRows[0]
    if (!protocol) return json({ error: 'Protocol not found' }, 404)

    const inserted = await db
      .insert(pipelineExecutions)
      .values({ protocolId, status: 'screening', totalPapers: papers.length })
      .returning({ id: pipelineExecutions.id })
    const executionId = inserted[0]?.id
    if (!executionId) return json({ error: 'Failed to create execution' }, 500)

    const batches = createScreeningBatches(
      protocolId,
      protocol.picoQuestion,
      protocol.inclusionCriteria,
      papers
    )

    const allResults: Array<{ paperId: string; decision: string; reasoning: string; confidence: number }> = []
    let relevantCount = 0
    let irrelevantCount = 0

    for (const batch of batches) {
      try {
        const batchResults = await screenPapers(batch)
        for (const result of batchResults) {
          await db.insert(auditLog).values({
            executionId,
            paperId: result.paperId,
            stage: 'screening',
            decision: {
              decision: result.decision,
              reasoning: result.reasoning,
              confidence: result.confidence,
            },
          })
          allResults.push(result)
          if (result.decision === 'relevant') relevantCount++
          else irrelevantCount++
        }
      } catch (batchError) {
        console.error(`Error screening batch for protocol ${protocolId}:`, batchError)
      }
    }

    await db
      .update(pipelineExecutions)
      .set({ status: 'screened', includedCount: relevantCount, excludedCount: irrelevantCount })
      .where(eq(pipelineExecutions.id, executionId))

    return json({
      executionId,
      status: 'screened',
      totalPapers: papers.length,
      relevantCount,
      irrelevantCount,
      results: allResults,
    })
  } catch (err) {
    console.error('Screening error:', err)
    return json(
      { error: 'Screening failed', details: err instanceof Error ? err.message : String(err) },
      500
    )
  }
}
