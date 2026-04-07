import type { SearchParams } from './types'

/** Title-specific keyword sets per bibliography type.
 *  For clinical type, title filtering is not applied (free-form search).
 */
const TITLE_TERMS: Record<string, string[]> = {
  guidelines: [
    'guideline',
    'guidelines',
    'consensus',
    'position statement',
    'recommendation',
    'recommendations',
    'clinical practice',
  ],
  'health-economics': [
    'health economics',
    'cost-effectiveness',
    'cost effectiveness',
    'economic burden',
    'healthcare costs',
    'budget impact',
    'cost analysis',
  ],
  prevalence: [
    'prevalence',
    'incidence',
    'epidemiology',
    'disease burden',
    'burden of disease',
    'epidemiological',
  ],
}

/** Core topic query: indication + keywords (keywords only for clinical type).
 *  indication may already be an OR-expanded string like ("disease" OR "alternate").
 */
export function buildBaseQuery(params: SearchParams, sep = ' AND '): string {
  const parts: string[] = []
  if (params.indication) parts.push(params.indication)
  if (params.bibliographyType === 'clinical' && params.keywords) parts.push(params.keywords)
  return parts.join(sep)
}


/** PubMed-specific base query: uses indication as-is (phrase-quoted in SearchForm),
 *  letting PubMed match via MeSH, title, abstract, and all indexed fields.
 */
export function buildPubMedBaseQuery(params: SearchParams): string {
  const parts: string[] = []
  if (params.indication) parts.push(params.indication)
  if (params.bibliographyType === 'clinical' && params.keywords) parts.push(params.keywords)
  return parts.join(' AND ')
}

/** PubMed title-field clause for non-clinical types.
 *  Single-word terms use bare [ti] tag; multi-word phrases are quoted.
 *  e.g. AND (guideline[ti] OR "position statement"[ti] OR ...)
 */
export function buildPubMedTitleTerms(params: SearchParams): string {
  const terms = TITLE_TERMS[params.bibliographyType]
  if (!terms) return ''
  const clauses = terms.map(t => t.includes(' ') ? `"${t}"[ti]` : `${t}[ti]`)
  return ` AND (${clauses.join(' OR ')})`
}

/** EuropePMC title-field clause for non-clinical types.
 *  Single-word terms unquoted; multi-word phrases quoted.
 *  e.g. AND (TITLE:guideline OR TITLE:"position statement" OR ...)
 */
export function buildEuropePMCTitleTerms(params: SearchParams): string {
  const terms = TITLE_TERMS[params.bibliographyType]
  if (!terms) return ''
  const clauses = terms.map(t => t.includes(' ') ? `TITLE:"${t}"` : `TITLE:${t}`)
  return ` AND (${clauses.join(' OR ')})`
}

/** Generic title terms for sources without field-specific syntax.
 *  Includes AND connector. Multi-word phrases quoted, single words bare.
 */
export function buildGenericTitleTerms(params: SearchParams): string {
  const terms = TITLE_TERMS[params.bibliographyType]
  if (!terms) return ''
  const clauses = terms.map(t => t.includes(' ') ? `"${t}"` : t)
  return ` AND (${clauses.join(' OR ')})`
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

/** PubMed country: affiliation [ad] only, multiple countries always OR-joined */
export function buildPubMedCountryClause(params: SearchParams): string {
  const countries = params.country?.split(',').map(c => c.trim()).filter(Boolean) ?? []
  if (countries.length === 0) return ''
  const clauses = countries.map(c => `${c}[ad]`)
  return clauses.length === 1 ? ` AND ${clauses[0]}` : ` AND (${clauses.join(' OR ')})`
}

/** EuropePMC author syntax */
export function buildEuropePMCAuthorClause(params: SearchParams): string {
  return params.author?.trim() ? ` AND AUTH:${params.author.trim()}` : ''
}

/** EuropePMC country syntax — supports comma-separated multiple countries */
export function buildEuropePMCCountryClause(params: SearchParams): string {
  const countries = params.country?.split(',').map(c => c.trim()).filter(Boolean) ?? []
  if (countries.length === 0) return ''
  const clauses = countries.map(c => `COUNTRY:"${c}"`)
  return clauses.length === 1 ? ` AND ${clauses[0]}` : ` AND (${clauses.join(' OR ')})`
}

/** Generic: append country as plain search term(s) — supports comma-separated multiple countries */
export function appendCountry(query: string, params: SearchParams): string {
  const countries = params.country?.split(',').map(c => c.trim()).filter(Boolean) ?? []
  if (countries.length === 0) return query
  return countries.length === 1
    ? `${query} ${countries[0]}`
    : `${query} (${countries.join(' OR ')})`
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
    'Case Report': 'case reports[pt]',
    'Review': 'review[pt]',
    'Clinical Trial': 'clinical trial[pt]',
  }
  const types = params.paperType.split(',').map(s => s.trim())
  const clauses = types.map(t => typeMap[t]).filter(Boolean)
  if (clauses.length === 0) return ''
  return clauses.length === 1 ? ` AND ${clauses[0]}` : ` AND (${clauses.join(' OR ')})`
}
