import type { SearchParams, Paper } from './types'
import { buildGenericTitleTerms, buildNotClause } from './queryBuilder'

export async function searchClinicalTrials(params: SearchParams): Promise<Paper[]> {
  // Use dedicated condition param for indication (more precise than query.term)
  const condParam = params.indication
    ? `&query.cond=${encodeURIComponent(params.indication)}`
    : ''

  // For clinical: keywords in query.term; for non-clinical: title terms in query.term
  const termParts: string[] = []
  if (params.bibliographyType === 'clinical' && params.keywords) termParts.push(params.keywords)
  const titleTerms = buildGenericTitleTerms(params).trim()
  if (titleTerms) termParts.push(titleTerms)
  const notClause = buildNotClause(params).trim()
  if (notClause) termParts.push(notClause)
  const termParam = termParts.length > 0
    ? `&query.term=${encodeURIComponent(termParts.join(' '))}`
    : ''

  // Multi-country: join with OR for location query
  const countries = params.country?.split(',').map(c => c.trim()).filter(Boolean) ?? []
  const locationParam = countries.length > 0
    ? `&query.locn=${encodeURIComponent(countries.join(' OR '))}`
    : ''

  // For non-clinical types, only return completed studies (more relevant for guidelines/HE/prevalence)
  const statusParam = params.bibliographyType !== 'clinical'
    ? '&filter.overallStatus=COMPLETED'
    : ''

  const url = `https://clinicaltrials.gov/api/v2/studies?format=json&pageSize=200${condParam}${termParam}${locationParam}${statusParam}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return (data.studies ?? []).map((s: any): Paper => {
    const p = s.protocolSection
    const id = p?.identificationModule?.nctId ?? 'unknown'
    return {
      id: `clinicaltrials:${id}`,
      source: 'clinicaltrials',
      title: p?.identificationModule?.briefTitle ?? 'Unknown Trial',
      authors: [p?.contactsLocationsModule?.overallOfficials?.[0]?.name ?? 'Unknown PI'],
      journal: 'ClinicalTrials.gov',
      year: p?.statusModule?.startDateStruct?.date
        ? parseInt(p.statusModule.startDateStruct.date.slice(0, 4))
        : undefined,
      url: `https://clinicaltrials.gov/study/${id}`,
      abstract: p?.descriptionModule?.briefSummary,
      type: p?.designModule?.studyType,
    }
  })
}
