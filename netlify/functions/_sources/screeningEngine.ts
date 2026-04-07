import Anthropic from '@anthropic-ai/sdk'

export interface Paper {
  id: string
  source: string
  title: string
  abstract?: string
  authors?: string[]
  year?: number
  doi?: string
}

export interface ScreeningResult {
  paperId: string
  decision: 'relevant' | 'irrelevant'
  reasoning: string
  confidence: number // 0.0 to 1.0
}

export interface ScreeningBatch {
  protocolId: number
  picoQuestion: string
  inclusionCriteria: string
  papers: Paper[]
}

/**
 * Builds the screening prompt for Claude Haiku.
 * Includes detailed instructions for classification with confidence scoring.
 */
function buildScreeningPrompt(batch: ScreeningBatch): string {
  const papersList = batch.papers
    .map(
      (p, idx) =>
        `\nPaper ${idx + 1} (ID: ${p.id})
Title: ${p.title}
Year: ${p.year ?? 'Unknown'}
Authors: ${p.authors?.slice(0, 3).join(', ') ?? 'Unknown'}${p.authors && p.authors.length > 3 ? ` et al.` : ''}
Abstract: ${p.abstract ?? 'No abstract available'}
DOI: ${p.doi ?? 'N/A'}`
    )
    .join('\n')

  return `You are a systematic review screening assistant. Your task is to evaluate whether each paper below is relevant for inclusion in a systematic review.

RESEARCH QUESTION (PICO):
${batch.picoQuestion}

INCLUSION CRITERIA:
${batch.inclusionCriteria}

PAPERS TO SCREEN:
${papersList}

SCREENING INSTRUCTIONS:
1. For each paper, determine if it meets the inclusion criteria based on title, abstract, and metadata
2. Provide a structured JSON response for each paper with: paperId, decision (relevant/irrelevant), reasoning (2-3 sentences explaining your decision), and confidence (0.0 to 1.0)
3. Be conservative: if the abstract is unclear, lean toward "relevant" to avoid missing studies
4. Confidence = your certainty in the decision (1.0 = certain, 0.5 = borderline, 0.0 = very uncertain)
5. Low confidence (<0.6) papers will be flagged for manual review

RESPONSE FORMAT:
Return a JSON array of objects:
[
  {
    "paperId": "source:id",
    "decision": "relevant" or "irrelevant",
    "reasoning": "clear explanation",
    "confidence": 0.85
  },
  ...
]

Only return the JSON array, no other text.`
}

/**
 * Screens a batch of papers using Claude Haiku.
 * Batches papers in groups of 50 for cost efficiency.
 */
export async function screenPapers(batch: ScreeningBatch): Promise<ScreeningResult[]> {
  const client = new Anthropic()

  const prompt = buildScreeningPrompt(batch)

  const message = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // Extract JSON from response
  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''

  let results: ScreeningResult[] = []
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      results = Array.isArray(parsed) ? parsed : []
    }
  } catch (e) {
    console.error('Failed to parse screening response:', e)
    throw new Error(`Invalid screening response format: ${responseText}`)
  }

  return results
}

/**
 * Splits papers into batches for efficient screening.
 * Each batch contains up to 50 papers.
 */
export function createScreeningBatches(
  protocolId: number,
  picoQuestion: string,
  inclusionCriteria: string,
  papers: Paper[]
): ScreeningBatch[] {
  const batches: ScreeningBatch[] = []
  const batchSize = 50

  for (let i = 0; i < papers.length; i += batchSize) {
    batches.push({
      protocolId,
      picoQuestion,
      inclusionCriteria,
      papers: papers.slice(i, i + batchSize),
    })
  }

  return batches
}

/**
 * Estimates cost for screening a set of papers.
 * Claude Haiku costs ~$0.80 per 1M input tokens, ~$4.00 per 1M output tokens.
 * Rough estimate: ~1500 tokens per 50-paper batch.
 */
export function estimateScreeningCost(paperCount: number): number {
  const tokensPerBatch = 1500
  const batchesNeeded = Math.ceil(paperCount / 50)
  const totalTokens = tokensPerBatch * batchesNeeded
  // Haiku pricing: $0.80/M input tokens, $4.00/M output tokens
  // Conservative estimate: treat all as input tokens for ~$0.001 per paper
  return (totalTokens / 1_000_000) * 0.80
}
