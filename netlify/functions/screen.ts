import { Handler } from '@netlify/functions'
import { migrate, getDb, protocols, pipelineExecutions, auditLog } from './_db'
import { screenPapers, createScreeningBatches } from './_sources/screeningEngine'
import type { Paper } from './_sources/screeningEngine'

interface ScreeningRequest {
  protocolId: number
  papers: Paper[]
}

interface ScreeningResponse {
  executionId: number
  status: string
  totalPapers: number
  relevantCount: number
  irrelevantCount: number
  results: Array<{
    paperId: string
    decision: string
    reasoning: string
    confidence: number
  }>
}

const handler: Handler = async (event, context) => {
  try {
    // Initialize database
    await migrate()
    const db = getDb()

    // Parse request
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Request body required' }),
      }
    }

    const req: ScreeningRequest = JSON.parse(event.body)
    const { protocolId, papers } = req

    if (!protocolId || !papers || papers.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'protocolId and papers array required' }),
      }
    }

    // Fetch protocol details
    const protocolResult = await db.query.protocols.findFirst({
      where: (t) => ({
        id: protocolId,
      }),
    })

    if (!protocolResult) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Protocol not found' }),
      }
    }

    // Create pipeline execution record
    const executionResult = await db.insert(pipelineExecutions).values({
      protocolId: protocolId,
      status: 'screening',
      totalPapers: papers.length,
    })

    const executionId = (executionResult as any).insertId ?? protocolId * 1000 // Fallback for HTTP client

    // Create screening batches
    const batches = createScreeningBatches(
      protocolId,
      protocolResult.picoQuestion,
      protocolResult.inclusionCriteria,
      papers
    )

    // Screen each batch
    const allResults = []
    let relevantCount = 0
    let irrelevantCount = 0

    for (const batch of batches) {
      try {
        const batchResults = await screenPapers(batch)

        // Log results to audit_log
        for (const result of batchResults) {
          await db.insert(auditLog).values({
            executionId: executionId,
            paperId: result.paperId,
            stage: 'screening',
            decision: {
              decision: result.decision,
              reasoning: result.reasoning,
              confidence: result.confidence,
            },
            userDecision: null,
            userNote: null,
          })

          allResults.push(result)

          if (result.decision === 'relevant') {
            relevantCount++
          } else {
            irrelevantCount++
          }
        }
      } catch (batchError) {
        console.error(`Error screening batch for protocol ${protocolId}:`, batchError)
        // Continue with other batches
      }
    }

    // Update pipeline execution status
    await db.query.pipelineExecutions.update({
      where: {
        id: executionId,
      },
      data: {
        status: 'complete',
        includedCount: relevantCount,
        excludedCount: irrelevantCount,
      },
    })

    const response: ScreeningResponse = {
      executionId,
      status: 'complete',
      totalPapers: papers.length,
      relevantCount,
      irrelevantCount,
      results: allResults,
    }

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    }
  } catch (err) {
    console.error('Screening error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Screening failed',
        details: err instanceof Error ? err.message : String(err),
      }),
    }
  }
}

export { handler }
