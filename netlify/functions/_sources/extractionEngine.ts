// netlify/functions/_sources/extractionEngine.ts
//
// Phase 2: Field-by-field data extraction from full-text papers using Claude
// Haiku. Builds the prompt dynamically from the protocol's ExtractionField[]
// template so each protocol can extract its own bespoke set of variables.
//
// Mirrors the structure of screeningEngine.ts (batching, JSON-only response,
// graceful parse failure) so the rest of the codebase has one mental model.

import Anthropic from '@anthropic-ai/sdk'

export interface ExtractionField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'boolean'
  required: boolean
}

export interface ExtractionPaper {
  id: string
  title: string
  /** Full plain-text body of the paper. May be truncated for token budget. */
  fullText: string
}

export interface ExtractionFieldResult {
  fieldName: string
  value: string | number | boolean | null
  confidence: number // 0.0 to 1.0
  rawText?: string
  error?: string
}

export interface ExtractionResult {
  paperId: string
  fields: ExtractionFieldResult[]
}

export interface ExtractionBatch {
  template: ExtractionField[]
  papers: ExtractionPaper[]
}

const MODEL = 'claude-3-5-haiku-20241022'

/** PDF text gets BIG. Cap each paper so a 10-paper batch fits in context. */
const MAX_CHARS_PER_PAPER = 12_000

function truncate(text: string, max = MAX_CHARS_PER_PAPER): string {
  if (text.length <= max) return text
  // Keep head + tail (methods/results sections often live at both ends).
  const head = text.slice(0, Math.floor(max * 0.7))
  const tail = text.slice(-Math.floor(max * 0.3))
  return `${head}\n\n[...truncated...]\n\n${tail}`
}

function buildExtractionPrompt(batch: ExtractionBatch): string {
  const fieldSpec = batch.template
    .map(
      (f) =>
        `  - "${f.name}" (${f.type}${f.required ? ', REQUIRED' : ''}): ${f.label}`
    )
    .join('\n')

  const papersBlock = batch.papers
    .map(
      (p, idx) =>
        `\n=== Paper ${idx + 1} (ID: ${p.id}) ===\nTitle: ${p.title}\n\nFull text:\n${truncate(p.fullText)}\n=== END Paper ${idx + 1} ===`
    )
    .join('\n')

  return `You are a systematic-review data extractor. For each paper below, extract values for the following fields.

FIELDS TO EXTRACT:
${fieldSpec}

EXTRACTION RULES:
1. Extract values ONLY when they are explicitly stated in the paper. Never invent or infer numbers.
2. For each field, return: value, confidence (0.0-1.0), and a short rawText snippet quoting the source sentence (≤200 chars).
3. If a field is not reported in the paper, return value: null, confidence: 0.0, error: "not_reported".
4. Confidence: 1.0 = explicit and unambiguous; 0.6 = stated but ambiguous wording; 0.0 = absent.
5. Respect the field type — numbers as JSON numbers, booleans as JSON true/false.

PAPERS:
${papersBlock}

RESPONSE FORMAT — return ONLY this JSON, no other text:
[
  {
    "paperId": "<paper id>",
    "fields": [
      { "fieldName": "<name>", "value": <typed value or null>, "confidence": 0.0-1.0, "rawText": "<quote>", "error": "<optional>" }
    ]
  }
]
`
}

/** Run a single extraction batch through Claude Haiku. */
export async function extractFromPapers(batch: ExtractionBatch): Promise<ExtractionResult[]> {
  const client = new Anthropic()
  const prompt = buildExtractionPrompt(batch)

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
    return Array.isArray(parsed) ? (parsed as ExtractionResult[]) : []
  } catch (e) {
    console.error('Failed to parse extraction response:', e)
    // Degrade gracefully: return one error-row per paper so the orchestrator
    // still records something in extraction_results for the audit trail.
    return batch.papers.map((p) => ({
      paperId: p.id,
      fields: batch.template.map((f) => ({
        fieldName: f.name,
        value: null,
        confidence: 0,
        error: 'parse_failed',
      })),
    }))
  }
}

/** Group papers into batches small enough to fit in a single Haiku call. */
export function createExtractionBatches(
  template: ExtractionField[],
  papers: ExtractionPaper[],
  batchSize = 10
): ExtractionBatch[] {
  const batches: ExtractionBatch[] = []
  for (let i = 0; i < papers.length; i += batchSize) {
    batches.push({ template, papers: papers.slice(i, i + batchSize) })
  }
  return batches
}

/** Rough cost estimate (Haiku $0.80/M input). ~3000 tokens per 10-paper batch. */
export function estimateExtractionCost(paperCount: number): number {
  const batches = Math.ceil(paperCount / 10)
  const tokens = batches * 3000
  return (tokens / 1_000_000) * 0.8
}
