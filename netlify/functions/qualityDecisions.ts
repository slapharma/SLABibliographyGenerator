// netlify/functions/qualityDecisions.ts
//
// Phase 2: Persist user approve/override decisions on a quality assessment.
//
//   POST /qualityDecisions
//   body: {
//     executionId: number,
//     paperId: string,
//     decision: 'approved' | 'overridden',
//     overrides?: { selection?, performance?, detection?, attrition?, reporting? },
//     reasoning?: string
//   }
//
// Updates the matching quality_assessments row and appends a roll-up to
// audit_log so the human review is captured in the same audit trail as the
// AI assessment.

import { Handler } from '@netlify/functions'
import { and, eq } from 'drizzle-orm'
import { migrate, getDb, qualityAssessments, auditLog } from './_db'

type BiasJudgement = 'low' | 'some_concern' | 'high'

interface DecisionRequest {
  executionId: number
  paperId: string
  decision: 'approved' | 'overridden'
  overrides?: Partial<{
    selection: BiasJudgement
    performance: BiasJudgement
    detection: BiasJudgement
    attrition: BiasJudgement
    reporting: BiasJudgement
  }>
  reasoning?: string
}

const handler: Handler = async (event) => {
  try {
    await migrate()
    const db = getDb()

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request body required' }) }
    }
    const req: DecisionRequest = JSON.parse(event.body)
    const { executionId, paperId, decision, overrides, reasoning } = req

    if (!executionId || !paperId || !decision) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'executionId, paperId, decision required' }),
      }
    }
    if (decision === 'overridden' && (!reasoning || !reasoning.trim())) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'reasoning required when overriding' }),
      }
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

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('Quality decision error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to record decision',
        details: err instanceof Error ? err.message : String(err),
      }),
    }
  }
}

export { handler }
