// netlify/functions/_sources/qualityAssessmentEngine.ts
//
// Phase 2: Cochrane RoB 2 risk-of-bias + overall quality scoring.
//
// Inputs are the *extracted* per-paper fields (already produced by
// extractionEngine.ts), not the full PDF text — that's what lets us batch
// 30 papers per call instead of 10. The model returns five domain
// judgements ('low' | 'some_concern' | 'high'), short reasoning per domain,
// and an overall 0-10 quality score.

import Anthropic from '@anthropic-ai/sdk'

export type BiasJudgement = 'low' | 'some_concern' | 'high'

export interface QualityPaperInput {
  id: string
  title: string
  /** Flat key→value map of already-extracted fields. */
  extractedFields: Record<string, unknown>
}

export interface QualityAssessmentResult {
  paperId: string
  biasDomains: {
    selection: BiasJudgement
    performance: BiasJudgement
    detection: BiasJudgement
    attrition: BiasJudgement
    reporting: BiasJudgement
  }
  biasReasoning: {
    selection: string
    performance: string
    detection: string
    attrition: string
    reporting: string
  }
  overallQuality: number // 0-10
  assessmentReasoning: string
}

export interface QualityBatch {
  papers: QualityPaperInput[]
}

const MODEL = 'claude-3-5-haiku-20241022'

function formatPaperFields(fields: Record<string, unknown>): string {
  return Object.entries(fields)
    .map(([k, v]) => `  - ${k}: ${v == null ? 'not reported' : JSON.stringify(v)}`)
    .join('\n')
}

function buildQualityPrompt(batch: QualityBatch): string {
  const papersBlock = batch.papers
    .map(
      (p, idx) =>
        `\n=== Paper ${idx + 1} (ID: ${p.id}) ===\nTitle: ${p.title}\nExtracted fields:\n${formatPaperFields(p.extractedFields)}\n=== END Paper ${idx + 1} ===`
    )
    .join('\n')

  return `You are applying the Cochrane Risk of Bias 2 (RoB 2) framework to assess the methodological quality of randomised studies. Score each paper across five bias domains.

DOMAINS (each gets one of: "low", "some_concern", "high"):
  1. selection   — bias arising from the randomisation process (allocation sequence, concealment, baseline imbalance).
  2. performance — bias due to deviations from intended interventions (blinding of participants/personnel, protocol adherence).
  3. detection   — bias in measurement of the outcome (blinding of assessors, outcome ascertainment).
  4. attrition   — bias due to missing outcome data (completeness of follow-up, intention-to-treat).
  5. reporting   — bias in selection of the reported result (selective outcome reporting, prespecified analyses).

JUDGEMENT ANCHORS:
  - "low"          → method is clearly described AND clearly adequate.
  - "some_concern" → method is unclear or partially described, or minor concerns.
  - "high"         → method is clearly inadequate, or evidence of bias is present.

OVERALL QUALITY (integer 0-10):
  - 9-10 = excellent (all domains low risk)
  - 7-8  = good (mostly low risk, ≤1 some_concern)
  - 5-6  = moderate (multiple some_concern OR one high-risk domain)
  - 3-4  = weak (several high-risk domains)
  - 0-2  = very weak / fundamentally flawed

PAPERS:
${papersBlock}

Return ONLY this JSON array, no other text:
[
  {
    "paperId": "<id>",
    "biasDomains": {
      "selection": "low|some_concern|high",
      "performance": "low|some_concern|high",
      "detection": "low|some_concern|high",
      "attrition": "low|some_concern|high",
      "reporting": "low|some_concern|high"
    },
    "biasReasoning": {
      "selection": "1-2 sentence justification",
      "performance": "...",
      "detection": "...",
      "attrition": "...",
      "reporting": "..."
    },
    "overallQuality": 0-10,
    "assessmentReasoning": "2-3 sentence overall summary"
  }
]
`
}

export async function assessQualityBatch(batch: QualityBatch): Promise<QualityAssessmentResult[]> {
  const client = new Anthropic()
  const prompt = buildQualityPrompt(batch)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('no JSON array in response')
    const parsed = JSON.parse(jsonMatch[0])
    return Array.isArray(parsed) ? (parsed as QualityAssessmentResult[]) : []
  } catch (e) {
    console.error('Failed to parse quality assessment response:', e)
    throw new Error(`Invalid quality assessment response: ${responseText.slice(0, 500)}`)
  }
}

export function createQualityBatches(
  papers: QualityPaperInput[],
  batchSize = 30
): QualityBatch[] {
  const batches: QualityBatch[] = []
  for (let i = 0; i < papers.length; i += batchSize) {
    batches.push({ papers: papers.slice(i, i + batchSize) })
  }
  return batches
}

export function estimateQualityCost(paperCount: number): number {
  const batches = Math.ceil(paperCount / 30)
  const tokens = batches * 4500
  return (tokens / 1_000_000) * 0.8
}

export const QUALITY_MODEL = MODEL
