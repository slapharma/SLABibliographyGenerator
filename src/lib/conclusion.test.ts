import { describe, it, expect } from 'vitest'
import { extractConclusion } from './conclusion'

describe('extractConclusion', () => {
  it('returns undefined for undefined abstract', () => {
    expect(extractConclusion(undefined)).toBeUndefined()
  })

  it('returns undefined for abstract with no conclusion section', () => {
    expect(extractConclusion('This is a study about cancer.')).toBeUndefined()
  })

  it('extracts text after "Conclusion:"', () => {
    const abstract = 'Background: something. Methods: stuff. Conclusion: Biologics improved outcomes.'
    expect(extractConclusion(abstract)).toBe('Biologics improved outcomes.')
  })

  it('extracts text after "Conclusions:"', () => {
    const abstract = 'Purpose: X. Results: Y. Conclusions: This treatment is effective.'
    expect(extractConclusion(abstract)).toBe('This treatment is effective.')
  })

  it('is case-insensitive', () => {
    const abstract = 'CONCLUSION: Strong evidence supports use.'
    expect(extractConclusion(abstract)).toBe('Strong evidence supports use.')
  })

  it('handles multi-sentence conclusions', () => {
    const abstract = 'Conclusion: Biologic therapy reduced inflammation. Further studies are needed.'
    const result = extractConclusion(abstract)
    expect(result).toContain('Biologic therapy reduced inflammation')
  })

  it('trims leading/trailing whitespace', () => {
    const abstract = 'Conclusion:   Effective treatment.   '
    expect(extractConclusion(abstract)).toBe('Effective treatment.')
  })
})
