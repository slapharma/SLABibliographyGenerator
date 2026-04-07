import { Handler } from '@netlify/functions'
import { migrate, getDb, auditLog } from './_db'

interface DecisionUpdate {
  paperId: string
  userDecision: 'approved' | 'rejected' | 'override' | null
  userNote?: string
}

interface SaveDecisionsRequest {
  executionId: number
  decisions: DecisionUpdate[]
}

const handler: Handler = async (event, context) => {
  try {
    // Initialize database
    await migrate()
    const db = getDb()

    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body required' }),
      }
    }

    const req: SaveDecisionsRequest = JSON.parse(event.body)
    const { executionId, decisions } = req

    if (!executionId || !decisions || decisions.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'executionId and decisions array required',
        }),
      }
    }

    // Update audit log entries with user decisions
    const updates = []
    for (const decision of decisions) {
      // Find existing audit log entry
      const existingEntry = await db.query.auditLog.findFirst({
        where: (t) => ({
          executionId: executionId,
          paperId: decision.paperId,
          stage: 'screening',
        }),
      })

      if (existingEntry) {
        // Update existing entry
        await db
          .query
          .auditLog
          .update({
            where: {
              id: existingEntry.id,
            },
            data: {
              userDecision: decision.userDecision ?? undefined,
              userNote: decision.userNote ?? undefined,
            },
          })

        updates.push({
          paperId: decision.paperId,
          status: 'updated',
        })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        executionId,
        updatedCount: updates.length,
      }),
    }
  } catch (err) {
    console.error('Error saving screening decisions:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to save decisions',
        details: err instanceof Error ? err.message : String(err),
      }),
    }
  }
}

export { handler }
