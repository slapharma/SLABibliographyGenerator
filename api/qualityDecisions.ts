// api/qualityDecisions.ts — Vercel Edge runtime
export const config = { runtime: 'edge' }

import { and, eq } from 'drizzle-orm'
import { migrate, getDb, qualityAssessments, auditLog } from '../netlify/functions/_db'

type BiasJudgement = 'low' | 'some_concern' | 'high'

interface DecisionRequest {
  executionId: number
  paperId: string
  decision: 'approved' | 'overridden'
  overrides?: Partial<Record<'selection' | 'performance' | 'detection' | 'attrition' | 'reporting', BiasJudgement>>
  reasoning?: string
}

const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })

  try {
    await migrate()
    const db = getDb()

    const { executionId, paperId, decision, overrides, reasoning } =
      (await req.json()) as DecisionRequest

    if (!executionId || !paperId || !decision) {
      return json({ error: 'executionId, paperId, decision required' }, 400)
    }
    if (decision === 'overridden' && (!reasoning || !reasoning.trim())) {
      return json({ error: 'reasoning required when overriding' }, 400)
    }

    const updates: Record<string, unknown> = {
      userDecision: decision,
      userOverrideReasoning: reasoning ?? null,
      updatedAt: new Date(),
    }
    if (decision === 'overridden' && overrides) {
      if (overrides.selection) updates.biasDomainSelection = overrides.selection
      if (overrides.performance) updates.biasDomainPerformance = overrides.performance
      if (overrides.detection) updates.biasDomainDetection = overrides.detection
      if (overrides.attrition) updates.biasDomainAttrition = overrides.attrition
      if (overrides.reporting) updates.biasDomainReporting = overrides.reporting
    }

    await db
      .update(qualityAssessments)
      .set(updates)
      .where(
        and(
          eq(qualityAssessments.executionId, executionId),
          eq(qualityAssessments.paperId, paperId)
        )
      )

    await db.insert(auditLog).values({
      executionId,
      paperId,
      stage: 'quality_assessment',
      decision: { stage: 'user_decision', decision, overrides, reasoning } as any,
      userDecision: decision,
      userNote: reasoning ?? null,
    })

    return json({ success: true })
  } catch (err) {
    console.error('Quality decision error:', err)
    return json(
      { error: 'Failed to record decision', details: err instanceof Error ? err.message : String(err) },
      500
    )
  }
}
