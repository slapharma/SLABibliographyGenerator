import type { SearchParams } from './types'

const BIB_TYPE_TERMS: Record<string, string> = {
  guidelines: '(guidelines OR "consensus statement" OR recommendation OR "clinical practice guideline")',
  'health-economics': '(cost-effectiveness OR "health economics" OR QALY OR "economic evaluation")',
  prevalence: '(prevalence OR incidence OR epidemiology OR "burden of disease")',
}

/** Core topic query: indication + keywords + bibliographyType modifier */
export function buildBaseQuery(params: SearchParams, sep = ' AND '): string {
  const parts: string[] = []
  if (params.indication) parts.push(params.indication)
  if (params.keywords) parts.push(params.keywords)
  const bibTerms = BIB_TYPE_TERMS[params.bibliographyType ?? '']
  if (bibTerms) parts.push(bibTerms)
  return parts.join(sep)
}

/** NOT clause from negativeKeywords.
 *  Splits on commas to support multi-word phrases (e.g. "case report, animal study").
 *  Multi-word phrases are automatically quoted.
 */
export function buildNotClause(params: SearchParams): string {
  const neg = params.negativeKeywords?.trim()
  if (!neg) return ''
  const terms = neg.split(/\s*,\s*/).map(t => t.trim()).filter(Boolean)
  const quoted = terms.map(t => (t.includes(' ') ? `"${t}"` : t))
  return ` NOT (${quoted.join(' OR ')})`
}

/** PubMed author field tag */
export function buildPubMedAuthorClause(params: SearchParams): string {
  return params.author?.trim() ? ` AND ${params.author.trim()}[au]` : ''
}

/** PubMed affiliation/country field tag */
export function buildPubMedCountryClause(params: SearchParams): string {
  return params.country?.trim() ? ` AND ${params.country.trim()}[ad]` : ''
}

/** EuropePMC author syntax */
export function buildEuropePMCAuthorClause(params: SearchParams): string {
  return params.author?.trim() ? ` AND AUTH:${params.author.trim()}` : ''
}

/** EuropePMC country syntax */
export function buildEuropePMCCountryClause(params: SearchParams): string {
  return params.country?.trim() ? ` AND COUNTRY:"${params.country.trim()}"` : ''
}

/** Generic: append country as a plain search term */
export function appendCountry(query: string, params: SearchParams): string {
  return params.country?.trim() ? `${query} ${params.country.trim()}` : query
}

/** Generic: append author as a plain search term */
export function appendAuthor(query: string, params: SearchParams): string {
  return params.author?.trim() ? `${query} ${params.author.trim()}` : query
}

/** PubMed publication-type clause for multi-select paper types.
 *  Multiple types are joined with OR (not AND) so papers matching ANY selected type are returned.
 */
export function buildPubMedPaperTypeClause(params: SearchParams): string {
  if (!params.paperType) return ''
  const typeMap: Record<string, string> = {
    'RCT': 'randomized controlled trial[pt]',
    'Systematic Review': 'systematic review[pt]',
    'Meta-Analysis': 'meta-analysis[pt]',
    'Observational': 'observational study[pt]',
  }
  const types = params.paperType.split(',').map(s => s.trim())
  const clauses = types.map(t => typeMap[t]).filter(Boolean)
  if (clauses.length === 0) return ''
  return clauses.length === 1 ? ` AND ${clauses[0]}` : ` AND (${clauses.join(' OR ')})`
}
