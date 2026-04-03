// src/lib/conclusion.ts

/** Extract the conclusion section from a structured abstract.
 *  Many clinical abstracts use "Conclusion:" or "Conclusions:" headings.
 *  Returns undefined if no such section is found.
 */
export function extractConclusion(abstract: string | undefined): string | undefined {
  if (!abstract) return undefined
  const match = abstract.match(/conclusion[s]?\s*:\s*(.+?)(?:\n[A-Z]|\n\n|$)/is)
  return match?.[1]?.trim() || undefined
}
