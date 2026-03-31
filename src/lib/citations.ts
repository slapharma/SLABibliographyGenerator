// src/lib/citations.ts
import type { Paper, CitationStyle } from '../types'

// Fallback rules (from spec):
// - authors empty → omit author segment, begin with title
// - year missing → 'n.d.'
// - journal missing → omit journal segment
// - doi missing → use paper.url; if also absent, omit link
// - title missing → '[No title]'

function authorList(authors: string[], max = 6): string {
  if (!authors.length) return ''
  if (authors.length <= max) return authors.join(', ')
  return `${authors.slice(0, max).join(', ')} et al`
}

function firstAuthorLastFirst(authors: string[]): string {
  if (!authors.length) return ''
  const first = authors[0]
  const parts = first.trim().split(' ')
  if (parts.length < 2) return first
  const last = parts[parts.length - 1]
  const initials = parts.slice(0, -1).map(p => p[0] + '.').join('')
  return `${last} ${initials}`
}

function link(paper: Paper): string {
  if (paper.doi) return `https://doi.org/${paper.doi}`
  if (paper.url) return paper.url
  return ''
}

export function formatVancouver(p: Paper): string {
  const title = p.title || '[No title]'
  const year = p.year ?? 'n.d.'
  const l = link(p)

  let citation = ''
  if (p.authors?.length) {
    citation += `${authorList(p.authors)}. `
  }
  citation += `${title}. `
  if (p.journal) citation += `${p.journal}. `
  citation += `${year}`
  if (l) citation += `. Available from: ${l}`
  return citation.trim()
}

export function formatAPA(p: Paper): string {
  const title = p.title || '[No title]'
  const year = p.year ?? 'n.d.'
  const l = link(p)

  let citation = ''
  if (p.authors?.length) {
    const formatted = p.authors.map(a => {
      const parts = a.trim().split(' ')
      if (parts.length < 2) return a
      const last = parts[parts.length - 1]
      const initials = parts.slice(0, -1).map(pp => pp[0] + '.').join(' ')
      return `${last}, ${initials}`
    })
    citation += `${formatted.join(', ')}. `
  }
  citation += `(${year}). ${title}. `
  if (p.journal) citation += `*${p.journal}*. `
  if (l) citation += `${l}`
  return citation.trim().replace(/\.\s*$/, '.')
}

export function formatHarvard(p: Paper): string {
  const title = p.title || '[No title]'
  const year = p.year ?? 'n.d.'
  const l = link(p)

  let citation = ''
  if (p.authors?.length) {
    citation += `${firstAuthorLastFirst(p.authors)}`
    if (p.authors.length > 1) citation += ` et al.`
    citation += ` (${year}) `
  } else {
    citation += `(${year}) `
  }
  citation += `'${title}'`
  if (p.journal) citation += `, *${p.journal}*`
  if (l) citation += `. Available at: ${l}`
  return citation.trim().replace(/\s+\.$/, '.')
}

export function formatCitation(p: Paper, style: CitationStyle): string {
  switch (style) {
    case 'vancouver': return formatVancouver(p)
    case 'apa': return formatAPA(p)
    case 'harvard': return formatHarvard(p)
  }
}
