import { describe, it, expect } from 'vitest'
import { formatVancouver, formatAPA, formatHarvard, formatCitation } from './citations'
import type { Paper } from '../types'

const fullPaper: Paper = {
  id: 'pubmed:1',
  source: 'pubmed',
  title: 'Effect of Drug X on Condition Y',
  authors: ['Jane Smith', 'Bob Jones', 'Alice Brown'],
  journal: 'The Lancet',
  year: 2023,
  doi: '10.1000/xyz',
  url: 'https://pubmed.ncbi.nlm.nih.gov/1',
}

const minimalPaper: Paper = {
  id: 'crossref:2',
  source: 'crossref',
  title: '',
  authors: [],
  url: 'https://example.com/paper',
}

describe('formatVancouver', () => {
  it('formats a full paper', () => {
    const result = formatVancouver(fullPaper)
    expect(result).toContain('Smith')
    expect(result).toContain('Effect of Drug X')
    expect(result).toContain('2023')
    expect(result).toContain('The Lancet')
    expect(result).toContain('doi.org/10.1000/xyz')
  })
  it('handles missing authors — starts with title', () => {
    const result = formatVancouver({ ...fullPaper, authors: [] })
    expect(result).toMatch(/^Effect of Drug X/)
  })
  it('uses n.d. for missing year', () => {
    expect(formatVancouver({ ...fullPaper, year: undefined })).toContain('n.d.')
  })
  it('uses [No title] when title is empty', () => {
    expect(formatVancouver(minimalPaper)).toContain('[No title]')
  })
  it('falls back to url when doi is absent', () => {
    const result = formatVancouver({ ...fullPaper, doi: undefined })
    expect(result).toContain('https://pubmed.ncbi.nlm.nih.gov/1')
  })
  it('omits link entirely when both doi and url are absent', () => {
    const result = formatVancouver({ ...fullPaper, doi: undefined, url: '' })
    expect(result).not.toContain('Available from')
  })
})

describe('formatAPA', () => {
  it('formats a full paper', () => {
    const result = formatAPA(fullPaper)
    expect(result).toContain('(2023)')
    expect(result).toContain('Effect of Drug X')
  })
  it('handles no authors', () => {
    expect(formatAPA({ ...fullPaper, authors: [] })).toContain('(2023)')
  })
  it('uses n.d. for missing year', () => {
    expect(formatAPA({ ...fullPaper, year: undefined })).toContain('(n.d.)')
  })
  it('falls back to url when doi is absent', () => {
    const result = formatAPA({ ...fullPaper, doi: undefined })
    expect(result).toContain('https://pubmed.ncbi.nlm.nih.gov/1')
  })
})

describe('formatHarvard', () => {
  it('formats a full paper', () => {
    const result = formatHarvard(fullPaper)
    expect(result).toContain('Smith')
    expect(result).toContain('(2023)')
    expect(result).toContain("'Effect of Drug X")
  })
  it('handles no authors — uses year only', () => {
    const result = formatHarvard({ ...fullPaper, authors: [] })
    expect(result).toContain('(2023)')
    expect(result).not.toContain('Smith')
  })
  it('uses n.d. for missing year', () => {
    expect(formatHarvard({ ...fullPaper, year: undefined })).toContain('(n.d.)')
  })
})

describe('formatCitation', () => {
  it('delegates to correct formatter', () => {
    expect(formatCitation(fullPaper, 'vancouver')).toEqual(formatVancouver(fullPaper))
    expect(formatCitation(fullPaper, 'apa')).toEqual(formatAPA(fullPaper))
    expect(formatCitation(fullPaper, 'harvard')).toEqual(formatHarvard(fullPaper))
  })
})
